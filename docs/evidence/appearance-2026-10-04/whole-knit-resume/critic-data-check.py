"""Read saved data only. No author import, surface construction or native activity."""
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timezone
import hashlib, json, math, os, sys

ROOT = Path(__file__).resolve().parent
TOL = 1e-12
RECEIPT = ROOT / 'CRITIC-DATA.json'
NAMES = ['PLAN.md','WORTH.md','author.py','viewer.mjs','index.html','SOURCE-ADMISSION.md',
         'SOURCE-REVIEW.md','SOURCE-PINS.json','CORRECTION-PINS.json','ROOT-SOURCE.json',
         'RAW.json','mesh.json','sweater.obj','AUTHOR-JOB.json','AUTHOR-RETURN.json',
         'AUTHOR.stdout.txt','AUTHOR.stderr.txt','work-window-input.md','critic-data-check.py']
out = {'startedAt':datetime.now(timezone.utc).isoformat(),'pid':os.getpid(),
       'argv':sys.argv,'activity':'Saved-data readback only; no author execution or new mesh',
       'status':'running','failure':None,'tolerance':TOL,'pins':{},'levels':[],'masks':[]}
def require(ok, label, witness=None):
    if not ok:
        raise AssertionError({'label':label,'witness':witness})
def ed(a,b): return tuple(sorted((a,b)))
def reach(g):
    seen=set(); todo=[next(iter(g))]
    while todo:
        v=todo.pop()
        if v not in seen:
            seen.add(v);todo.extend(g[v]-seen)
    return seen
def mid(ps): return [sum(p[c] for p in ps)/len(ps) for c in range(3)]
def delta(a,b): return max(abs(x-y) for x,y in zip(a,b))
def cross(a,b,c):
    u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
    return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
def topology(m, number):
    p=m['positions'];q=m['quads'];edges=defaultdict(list);links=defaultdict(list);g=defaultdict(set)
    require(all(len(x)==3 and all(math.isfinite(c) for c in x) for x in p),'finite',number)
    minimum=math.inf
    for fi,f in enumerate(q):
        require(len(f)==4 and len(set(f))==4 and all(type(v)==int and 0<=v<len(p) for v in f),'face indices',[number,fi,f])
        for j,a in enumerate(f):
            b=f[(j+1)%4];edges[ed(a,b)].append((fi,a,b));g[a].add(b);g[b].add(a)
            links[a].append(ed(f[(j-1)%4],b))
        for tri in [(f[0],f[1],f[2]),(f[0],f[2],f[3])]:
            cv=cross(*(p[v] for v in tri));area=math.sqrt(sum(c*c for c in cv))/2
            require(math.isfinite(area) and area>1e-12,'triangle area',[number,fi,tri,area])
            minimum=min(minimum,area)
    require(reach(g)==set(range(len(p))),'connected used vertices',number)
    bdy={e for e,u in edges.items() if len(u)==1}
    for e,u in edges.items():
        require(len(u) in [1,2],'edge incidence',[number,e,u])
        if len(u)==2: require(u[0][1:]==u[1][1:][::-1],'opposite edge',[number,e,u])
    declared={ed(*i['edge']):i['role'] for i in m['boundaries']}
    require(len(declared)==len(m['boundaries']) and set(declared)==bdy,'exact boundary ownership',number)
    bv={v for e in bdy for v in e};cycles={};role_vertices=[]
    for v in range(len(p)):
        l=defaultdict(set)
        require(len(set(links[v]))==len(links[v]),'unique link germ',[number,v])
        for a,b in links[v]:l[a].add(b);l[b].add(a)
        degrees=Counter(len(a) for a in l.values())
        require(reach(l)==set(l),'connected vertex link',[number,v])
        require((set(degrees)<={1,2} and degrees[1]==2) if v in bv else set(degrees)=={2},'link path/cycle',[number,v,dict(degrees)])
    roles={'hem','neck','negative-X-cuff','positive-X-cuff'}
    require(set(declared.values())==roles,'four roles',number)
    for role in sorted(roles):
        ring=defaultdict(set)
        for (a,b),r in declared.items():
            if r==role:ring[a].add(b);ring[b].add(a)
        require(all(len(n)==2 for n in ring.values()) and reach(ring)==set(ring),'role simple cycle',[number,role])
        for other in role_vertices:require(not set(ring)&other,'distinct role cycles',[number,role])
        role_vertices.append(set(ring));cycles[role]={'vertices':len(ring),'edges':sum(map(len,ring.values()))//2}
    require(len(p)-len(edges)+len(q)==-2,'Euler',number)
    result={'level':number,'V':len(p),'E':len(edges),'F':len(q),'euler':-2,'openings':cycles,'minimumTriangleArea':minimum}
    out['levels'].append(result)
    return edges,declared

code=1
try:
    require(not RECEIPT.exists(),'exclusive checker receipt')
    for n in NAMES:
        b=(ROOT/n).read_bytes();out['pins'][n]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
    raw=json.loads((ROOT/'RAW.json').read_text());mesh=json.loads((ROOT/'mesh.json').read_text())
    job=json.loads((ROOT/'AUTHOR-JOB.json').read_text());ret=json.loads((ROOT/'AUTHOR-RETURN.json').read_text())
    require(job['status']=='passed' and job['failure'] is None and job['exitCode']==0 and job['inventoryErrors']==[],'author receipt')
    require(ret['exitCode']==0 and ret['authorPid']==job['pid'],'actual exit/identity')
    require(datetime.fromisoformat(ret['endedAt'])<datetime(2026,10,4,17,15,tzinfo=timezone.utc),'full return deadline')
    for n,entry in job['filesExcludingSelf'].items():
        b=(ROOT/n).read_bytes();require(len(b)==entry['bytes'] and hashlib.sha256(b).hexdigest()==entry['sha256'],'actual file inventory',n)
    require(ret['stdoutSha256']==out['pins']['AUTHOR.stdout.txt']['sha256'] and ret['stderrSha256']==out['pins']['AUTHOR.stderr.txt']['sha256'],'transcript hashes')
    stdout=json.loads((ROOT/'AUTHOR.stdout.txt').read_text());require(stdout['status']=='passed' and stdout['failure'] is None and stdout['checks']==raw['checks'],'stdout content')
    a=raw['artist'];keys=a['gridKeys'];control=raw['levels'][0];grid=a['grid']
    require(grid=={'X':[-.75,-.50,-.25,-.10,.10,.25,.50,.75],'Y':[0,.08,.50,.70,.75],'Z':[-.14,-.09,.09,.14]},'frozen grid')
    require(len(keys)==len(set(map(tuple,keys)))==len(control['positions']),'unique grid cache')
    max_control=0
    for key,stored in zip(keys,control['positions']):
        x,y,z=[grid[c][i] for c,i in zip('XYZ',key)]
        k=1-.5*(abs(x)-.25)/.5 if abs(x)>.25 else 1
        expected=[x,.60+(y-.60)*k,z*k] if abs(x)>.25 else [x,y,z]
        max_control=max(max_control,delta(expected,stored))
    require(max_control<=TOL,'control coordinate/taper',max_control)
    cells=set(map(tuple,a['occupiedCells']));faces=a['faceOwners'];omitted=a['omittedFaces']
    require(len(faces)==len(control['quads']) and a['unknownBoundaryRoles']==[],'complete recorded control owners')
    ownership=set()
    for i,owner in enumerate(faces+omitted):
        c=tuple(owner['cell']);axis=tuple(owner['axis']);role=owner.get('role')
        require(c in cells and tuple(c[d]+axis[d] for d in range(3)) not in cells,'outer face authority',i)
        require((c,axis) not in ownership,'unique outer face',i);ownership.add((c,axis))
        require(sum(abs(v) for v in axis)==1,'axis normal',i)
        cr=cross(*owner['gridQuad'][:3]);require(sum(x*y for x,y in zip(cr,axis))>0,'grid outward winding',i)
        expected_role=('hem' if axis==(0,-1,0) and c[1]==0 else 'negative-X-cuff' if axis==(-1,0,0) and c[0]==0 else 'positive-X-cuff' if axis==(1,0,0) and c[0]==6 else 'neck' if axis==(0,1,0) and c[1]==3 and c[2]==1 else None)
        require(role==expected_role,'omitted semantic role',i)
        if i<len(faces):require([keys[v] for v in control['quads'][i]]==owner['gridQuad'],'face-grid correspondence',i)
    axes=[(s if d==0 else 0,s if d==1 else 0,s if d==2 else 0) for d in range(3) for s in [-1,1]]
    require(ownership=={(c,axis) for c in cells for axis in axes if tuple(c[d]+axis[d] for d in range(3)) not in cells},'all and only exterior owners')
    out['control']={'occupiedCells':len(cells),'faceOwners':len(faces),'omittedFaces':len(omitted),'maxCoordinateDelta':max_control}
    graphs=[]
    require(len(raw['levels'])==3,'exactly three levels')
    for number,m in enumerate(raw['levels']):
        graph,bdy=topology(m,number);graphs.append((graph,bdy))
        for k in ['level','V','E','F','euler','openings']:require(out['levels'][-1][k]==raw['checks'][number][k],'reported topology',[number,k])
        require(abs(out['levels'][-1]['minimumTriangleArea']-raw['checks'][number]['minimumTriangleArea'])<=TOL,'reported area',number)
        if number==0:continue
        old=raw['levels'][number-1];ps=old['positions'];quads=old['quads'];edges,roles=graphs[number-1]
        parent=m['parent'];eid={tuple(e['edge']):e['vertex'] for e in parent['edgePoints']};fid=parent['facePoints']
        require(set(eid)==set(edges) and len(fid)==len(quads),'full child authority',number)
        require(len(set(eid.values())|set(fid))==len(edges)+len(quads) and set(eid.values())|set(fid)==set(range(len(ps),len(m['positions']))),'unique child caches',number)
        centres=[mid([ps[v] for v in f]) for f in quads];neigh=defaultdict(set);bf=defaultdict(set);vf=defaultdict(list);maximum=0
        for (x,y),uses in edges.items():
            neigh[x].add(y);neigh[y].add(x)
            if len(uses)==1:bf[x].add(y);bf[y].add(x)
            expected=mid([ps[x],ps[y]]+([centres[t[0]] for t in uses] if len(uses)==2 else []))
            maximum=max(maximum,delta(expected,m['positions'][eid[(x,y)]]))
        for fi,f in enumerate(quads):
            maximum=max(maximum,delta(centres[fi],m['positions'][fid[fi]]))
            for v in f:vf[v].append(fi)
        for v,p in enumerate(ps):
            if v in bf:
                require(len(bf[v])==2,'crease two neighbours',[number,v]);bn=list(bf[v]);expected=[.75*p[c]+.125*sum(ps[w][c] for w in bn) for c in range(3)]
            else:
                n=len(neigh[v]);require(len(vf[v])==n,'interior face-edge valence',[number,v])
                favg=mid([centres[i] for i in vf[v]]);ravg=mid([mid([p,ps[w]]) for w in neigh[v]])
                expected=[(favg[c]+2*ravg[c]+(n-3)*p[c])/n for c in range(3)]
            maximum=max(maximum,delta(expected,m['positions'][v]))
        require(maximum<=TOL,'all primary point masks',[number,maximum])
        expected_faces=[[v,eid[ed(v,f[(i+1)%4])],fid[fi],eid[ed(f[(i-1)%4],v)]] for fi,f in enumerate(quads) for i,v in enumerate(f)]
        require(m['quads']==expected_faces,'every child quad correspondence',number)
        expected_roles={ed(x,eid[(x,y)]):r for (x,y),r in roles.items()}|{ed(eid[(x,y)],y):r for (x,y),r in roles.items()}
        require(graphs[number][1]==expected_roles,'all role propagation',number)
        out['masks'].append({'level':number,'comparedVertices':len(m['positions']),'maxCoordinateDelta':maximum,'formula':'Equivalent Favg/2Ravg interior mask; primary crease/edge/face masks'})
    final=raw['levels'][-1]
    for k in ['positions','quads','boundaries']:require(mesh[k]==final[k],'export exact last level',k)
    require(mesh['checks']==raw['checks'] and mesh['limits']==raw['limits'],'export qualification')
    obj=(ROOT/'sweater.obj').read_text().splitlines();verts=[];quad=[]
    for line in obj:
        if line.startswith('#'):continue
        fields=line.split();require(fields and fields[0] in ['v','f'],'OBJ strict emitted record',line)
        if fields[0]=='v':verts.append(list(map(float,fields[1:])))
        else:quad.append([int(v)-1 for v in fields[1:]])
    require(verts==mesh['positions'] and quad==mesh['quads'],'all OBJ coordinates and winding exact')
    out['obj']={'vertices':len(verts),'quads':len(quad),'exactFloatRoundtrip':True}
    out['status']='passed';code=0
except Exception as exc:
    out['status']='failed';out['failure']={'type':type(exc).__name__,'message':str(exc)}
finally:
    out['endedAt']=datetime.now(timezone.utc).isoformat();out['exitCode']=code
    with RECEIPT.open('x') as f:json.dump(out,f,indent=2);f.write('\n')
    print(json.dumps({k:out[k] for k in ['status','failure','pid','startedAt','endedAt','levels','masks']}))
sys.exit(code)
