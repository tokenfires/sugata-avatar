"""Independent saved-data checks. Does not import or rerun author.py."""
from collections import defaultdict, Counter
from fractions import Fraction as Q
from pathlib import Path
from datetime import datetime, timezone
import json, math, hashlib, os

p=Path(__file__).resolve().parent
started=datetime.now(timezone.utc).isoformat()
raw=json.loads((p/'RAW.json').read_text())
mesh=json.loads((p/'mesh.json').read_text())
job=json.loads((p/'AUTHOR-JOB.json').read_text())
returned=json.loads((p/'AUTHOR-RETURN.json').read_text())
assert job['status']=='passed' and job['exitCode']==0 and job['failure'] is None
assert job['inventoryErrors']==[]
assert returned['exitCode']==0 and returned['completedBeforeHardStop']
assert job['pid']==returned['authorPid']
for name,entry in job['filesExcludingSelf'].items():
    b=(p/name).read_bytes()
    assert len(b)==entry['bytes'] and hashlib.sha256(b).hexdigest()==entry['sha256'],name

g=raw['artist']['grid']
assert g=={'X':[-.75,-.50,-.25,-.10,.10,.25,.50,.75],'Y':[0,.08,.50,.70,.75],'Z':[-.14,-.09,.09,.14]}
for key,actual in zip(raw['artist']['gridKeys'],raw['levels'][0]['positions'],strict=True):
    x,y,z=[g[name][index] for name,index in zip(['X','Y','Z'],key)]
    if abs(x)>.25:
        k=1-.5*(abs(x)-.25)/.5;y=.60+(y-.60)*k;z=z*k
    assert actual==[x,y,z]
assert raw['artist']['unknownBoundaryRoles']==[]

def walk(graph,start):
    pending=[start];seen=set()
    while pending:
        n=pending.pop()
        if n not in seen:
            seen.add(n);pending.extend(graph[n]-seen)
    return seen

reports=[]
maximum=0.
for li,level in enumerate(raw['levels']):
    pts=level['positions'];quads=level['quads']
    uses=defaultdict(list);links=defaultdict(list);graph=defaultdict(set)
    for fi,face in enumerate(quads):
        assert len(set(face))==4
        for ci,v in enumerate(face):
            nxt=face[(ci+1)%4];prev=face[(ci-1)%4]
            uses[tuple(sorted([v,nxt]))].append((v,nxt,fi))
            links[v].append((prev,nxt));graph[v].add(nxt);graph[nxt].add(v)
        for a,b,c in [(face[0],face[1],face[2]),(face[0],face[2],face[3])]:
            u=[pts[b][d]-pts[a][d] for d in range(3)];v=[pts[c][d]-pts[a][d] for d in range(3)]
            assert math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2>1e-12
    assert walk(graph,0)==set(range(len(pts)))
    free={e for e,owners in uses.items() if len(owners)==1}
    roles={tuple(sorted(item['edge'])):item['role'] for item in level['boundaries']}
    assert len(roles)==len(level['boundaries']) and set(roles)==free
    boundary_vertices={v for e in free for v in e}
    for e,owners in uses.items():
        assert len(owners) in (1,2)
        if len(owners)==2:assert owners[0][:2]==owners[1][:2][::-1]
    for v,edges in links.items():
        lg=defaultdict(set)
        assert len({tuple(sorted(e)) for e in edges})==len(edges)
        for a,b in edges:lg[a].add(b);lg[b].add(a)
        assert walk(lg,next(iter(lg)))==set(lg)
        counts=Counter(len(neighbours) for neighbours in lg.values())
        assert set(counts)<={1,2}
        assert counts[1]==(2 if v in boundary_vertices else 0)
    rings={}
    assert set(roles.values())=={'hem','neck','negative-X-cuff','positive-X-cuff'}
    for role in set(roles.values()):
        rg=defaultdict(set)
        for (a,b),r in roles.items():
            if r==role:rg[a].add(b);rg[b].add(a)
        assert all(len(n)==2 for n in rg.values()) and walk(rg,next(iter(rg)))==set(rg)
        rings[role]=len(rg)
    assert len(pts)-len(uses)+len(quads)==-2
    reports.append({'level':li,'V':len(pts),'E':len(uses),'F':len(quads),'openings':rings})
    if li<2:
        child=raw['levels'][li+1];meta=child['parent']
        # Exact rational arithmetic on saved doubles, independently expressed as F/R/P.
        vfaces=defaultdict(set);vneighbours=defaultdict(set);vb=defaultdict(set)
        for fi,q in enumerate(quads):
            for v in q:vfaces[v].add(fi)
        for a,b in uses:
            vneighbours[a].add(b);vneighbours[b].add(a)
            if (a,b) in free:vb[a].add(b);vb[b].add(a)
        qp=[[Q(c) for c in point] for point in pts]
        fp=[[sum(qp[v][d] for v in q)/4 for d in range(3)] for q in quads]
        expected={}
        for v,point in enumerate(qp):
            if v in vb:
                expected[v]=[(6*point[d]+sum(qp[w][d] for w in vb[v]))/8 for d in range(3)]
            else:
                n=len(vneighbours[v]);assert n==len(vfaces[v])
                expected[v]=[(sum(fp[f][d] for f in vfaces[v])/n
                              +sum(point[d]+qp[w][d] for w in vneighbours[v])/n
                              +(n-3)*point[d])/n for d in range(3)]
        for item in meta['edgePoints']:
            a,b=item['edge'];owners=uses[tuple(sorted([a,b]))]
            expected[item['vertex']]=[(qp[a][d]+qp[b][d]+(sum(fp[f][d] for _,_,f in owners) if len(owners)==2 else 0))/(4 if len(owners)==2 else 2) for d in range(3)]
        for fi,vi in enumerate(meta['facePoints']):expected[vi]=fp[fi]
        assert set(expected)==set(range(len(child['positions'])))
        for v,point in expected.items():
            for d in range(3):
                difference=abs(float(point[d])-child['positions'][v][d]);maximum=max(maximum,difference)
                assert difference<=32*math.ulp(1.)
        expected_roles={}
        for item in meta['edgePoints']:
            e=tuple(sorted(item['edge']))
            if e in roles:
                for v in e:expected_roles[tuple(sorted([v,item['vertex']]))]=roles[e]
        assert expected_roles=={tuple(sorted(i['edge'])):i['role'] for i in child['boundaries']}

for field in ['positions','quads','boundaries']:
    assert mesh[field]==raw['levels'][-1][field]
obj_positions=[];obj_quads=[]
for line in (p/'sweater.obj').read_text().splitlines():
    if line.startswith('v '):obj_positions.append([float(n) for n in line.split()[1:]])
    if line.startswith('f '):obj_quads.append([int(n)-1 for n in line.split()[1:]])
assert obj_positions==mesh['positions'] and obj_quads==mesh['quads']
result={'startedAt':started,'endedAt':datetime.now(timezone.utc).isoformat(),'pid':os.getpid(),
        'status':'passed','levels':reports,'maximumRationalSubdivisionResidual':maximum,
        'rationalResidualCeiling':32*math.ulp(1.),'JSONandOBJmatchFinalLevel':True,
        'inputs':{n:{'bytes':(p/n).stat().st_size,'sha256':hashlib.sha256((p/n).read_bytes()).hexdigest()}
                  for n in ['RAW.json','mesh.json','sweater.obj','AUTHOR-JOB.json','AUTHOR-RETURN.json']},
        'limits':'Saved geometry/arithmetic verification only; not actual appearance, global self-intersection, fit or motion.'}
(p/'ROOT-DATA.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
