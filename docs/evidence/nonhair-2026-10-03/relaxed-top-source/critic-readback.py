"""Read existing source and refusal only; never author/evaluate a new shape."""
from pathlib import Path
from collections import defaultdict
import hashlib, json, math, datetime, os, sys
root=Path.cwd(); packet=root/'docs/evidence/nonhair-2026-10-03/relaxed-top-source'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((packet/'run-v1.json').read_text()); pins=json.loads((packet/'INPUTS.json').read_text())
assert not r['ok'] and r['stage']=='triangle orientation' and r['emittedFiles']=={}
assert sha(packet/'author.py')==r['scriptSha256']
assert sha(packet/'PLAN.md')==r['planSha256']
assert sha(packet/'INPUTS.json')==r['inputsSha256']
for name,h in pins.items():assert sha(root/name)==h
assert list((packet/'artifacts-v1').iterdir())==[]
p=[];uv=[];faces=[];lines=[]
source=root/'docs/evidence/nonhair-2026-10-03/capsule-source/inputs/male_casualsuit02/male_casualsuit02.obj'
for ln,line in enumerate(source.read_text().splitlines(),1):
    w=line.split()
    if not w:continue
    if w[0]=='v':p.append(tuple(map(float,w[1:])))
    elif w[0]=='vt':uv.append(tuple(map(float,w[1:])))
    elif w[0]=='f':
        assert len(w)==5
        faces.append(tuple(tuple(int(x)-1 for x in c.split('/')) for c in w[1:]));lines.append(ln)
assert len(p)==2136 and len(faces)==2060
parent=list(range(len(p)))
def find(v):
    while parent[v]!=v:parent[v]=parent[parent[v]];v=parent[v]
    return v
for face in faces:
    assert len({v for v,t in face})==4
    for v,t in face:assert 0<=v<len(p) and 0<=t<len(uv)
    a=face[0][0]
    for b,t in face[1:]:parent[find(b)]=find(a)
groups=defaultdict(set)
for v in range(len(p)):groups[find(v)].add(v)
components=sorted([{'vertices':len(g),'maxY':max(p[v][1] for v in g)} for g in groups.values()],key=lambda c:c['maxY'])
assert components==sorted(r['components'],key=lambda c:c['maxY'])
selected=max(groups.values(),key=lambda g:max(p[v][1] for v in g))
assert components[-1]['maxY']-components[-2]['maxY']>=.50
fids=[i for i,f in enumerate(faces) if f[0][0] in selected]
edge=defaultdict(list);links={v:defaultdict(list) for v in selected}
for fid in fids:
    ids=[v for v,t in faces[fid]];assert set(ids)<=selected
    for k,a in enumerate(ids):
        b=ids[(k+1)%4];edge[tuple(sorted((a,b)))].append((a,b))
        left,right=ids[(k-1)%4],ids[(k+1)%4]
        links[a][left].append(right);links[a][right].append(left)
boundary=defaultdict(set)
for (a,b),rows in edge.items():
    assert len(rows) in (1,2)
    if len(rows)==2:assert rows[0]==rows[1][::-1]
    else:boundary[a].add(b);boundary[b].add(a)
assert all(len(ns)==2 for ns in boundary.values())
for v,link in links.items():
    degrees=sorted(map(len,link.values()))
    assert degrees==([1,1]+[2]*(len(link)-2) if v in boundary else [2]*len(link))
    seen=set();pending=[next(iter(link))]
    while pending:
        x=pending.pop()
        if x not in seen:seen.add(x);pending.extend(link[x])
    assert seen==set(link)
loop_ids=set()
for loop in r['loopCandidates']:
    ids=loop['vertices'];assert len(ids)==len(set(ids)) and not loop_ids.intersection(ids)
    loop_ids.update(ids)
    for a,b in zip(ids,ids[1:]+ids[:1]):assert b in boundary[a]
    for axis in range(3):
        vals=[p[v][axis] for v in ids]
        assert abs(sum(vals)/len(vals)-loop['centroid'][axis])<1e-14
        assert min(vals)==loop['minimum'][axis] and max(vals)==loop['maximum'][axis]
assert loop_ids==set(boundary)
assert r['structural']==dict(vertices=len(selected),faces=len(fids),edges=len(edge),boundaryLoops=len(r['loopCandidates']),euler=len(selected)-len(edge)+len(fids))
assert len(r['loopCandidates'])==4 and r['structural']['euler']==-2
loops=sorted(r['loopCandidates'],key=lambda x:x['centroid'][0]);left,right=loops[0],loops[-1]
center=(min(p[v][0] for v in selected)+max(p[v][0] for v in selected))/2
H=(max(p[v][0] for v in selected)-min(p[v][0] for v in selected))/2
Y=max(p[v][1] for v in selected)-min(p[v][1] for v in selected)
assert H>2 and Y>3
assert center-left['centroid'][0]>.70*H and right['centroid'][0]-center>.70*H
assert all(p[v][0]-center<-.40*H for v in left['vertices']) and all(p[v][0]-center>.40*H for v in right['vertices'])
assert abs(left['centroid'][1]-right['centroid'][1])<.20*Y
central=loops[1:-1]
assert all(abs(l['centroid'][0]-center)<.20*H and all(abs(p[v][0]-center)<.60*H for v in l['vertices']) for l in central)
hem,neck=sorted(central,key=lambda l:l['centroid'][1])
assert neck['centroid'][1]-hem['centroid'][1]>.25*Y
assert all(neck['centroid'][1]-l['centroid'][1]>.10*Y for l in (left,right))
w=r['gateWitness'];fid=w['sourceFace'];ids=w['sourceVertices']
assert fid==1040 and ids==[v for v,t in faces[fid]][:3]
assert [list(p[v]) for v in ids]==w['originalXYZ']
def area(points):
    a,b,c=points;u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
    return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
original=area(w['originalXYZ']);authored=area(w['authoredXYZ'])
dot=sum(a*b for a,b in zip(original,authored));norm=math.sqrt(sum(x*x for x in authored))
assert original==w['originalAreaVector'] and authored==w['authoredAreaVector']
assert dot==w['orientationDot'] and norm==w['authoredAreaLength']
assert norm>w['minimumAreaLength'] and dot<0
displacements=[math.sqrt(sum((b-a)**2 for a,b in zip(old,new))) for old,new in zip(w['originalXYZ'],w['authoredXYZ'])]
assert max(displacements)<=.35
out=dict(status='verified refusal',pid=os.getpid(),started=started,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    command='python3 docs/evidence/nonhair-2026-10-03/relaxed-top-source/critic-readback.py',interpreter=sys.executable,version=sys.version,sourceSha256=sha(Path(__file__)),
    reportSha256=sha(packet/'run-v1.json'),protectedInputs=pins,components=components,structural=r['structural'],boundaryLengths=[len(l['vertices']) for l in r['loopCandidates']],
    sourceFace=fid,sourceOBJLine=lines[fid],sourceCorners=faces[fid],originalAreaVector=original,authoredAreaVector=authored,orientationDot=dot,authoredAreaLength=norm,failedCornerDisplacements=displacements,
    limits='Read original source topology and recorded failed triangle only. No authored-field reconstruction, surface generation, output OBJ, native, fit, contact, appearance or global self-intersection proof.')
with (packet/'critic-readback.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
