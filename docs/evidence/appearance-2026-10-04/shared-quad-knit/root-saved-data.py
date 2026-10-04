"""Independent saved-data reader. Never imports or reruns the author."""
from pathlib import Path
from datetime import datetime,timezone
from collections import defaultdict,Counter
import hashlib,json,math,os
p=Path(__file__).resolve().parent;root=p.parents[3]
def read(n):return json.loads((p/n).read_text())
def digest(q):
 b=q.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def avg(ps):return [sum(v[k] for v in ps)/len(ps) for k in range(3)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def minus(a,b):return [x-y for x,y in zip(a,b)]
def flood(graph,v):
 seen={v};todo=[v]
 while todo:
  for n in graph[todo.pop()]:
   if n not in seen:seen.add(n);todo.append(n)
 return seen
r={'started':datetime.now(timezone.utc).isoformat(),'pid':os.getpid(),'savedOnly':True,'bindings':{n:digest(p/n) for n in ['ARTIST.json','INPUTS.json','author.py','runner.py','RAW.json','mesh.json','sweater.obj','AUTHOR-JOB.json','RUN-PROCESS.json','STDOUT.txt','STDERR.txt']}}
for name,pin in read('INPUTS.json')['files'].items():assert digest(root/name)==pin
raw=read('RAW.json');mesh=read('mesh.json');job=read('AUTHOR-JOB.json');process=read('RUN-PROCESS.json');c=read('ARTIST.json')
assert process['childExit']==0 and process['childReaped'] and not process['timedOut'] and not process['late'] and not process['recordingErrors']
assert read('STDOUT.txt')==job and (p/'STDERR.txt').read_bytes()==b''
for name,pin in job['outputs'].items():assert digest(p/name)==pin
for name,row in process['actualFiles'].items():assert row['exists'] and digest(p/name)=={k:row[k] for k in ['bytes','sha256']}
assert raw['artist']==mesh['artist']==c and raw['unusedOldIDs']==[64,72]
old=raw['uncompactedPoints'];used=raw['usedOldIDs'];assert used==sorted(set(range(160))-{64,72});assert raw['points']==[old[v] for v in used]
reindex={v:i for i,v in enumerate(used)};assert raw['faces']==[[reindex[v] for v in f] for f in raw['uncompactedFaces']]
maxCoord=0
for row,(y,w,d,z) in enumerate(c['torsoRowsYWidthDepthCenterZ']):
 for j in range(16):
  want=[w*math.cos(math.tau*j/16),y,z+d*math.sin(math.tau*j/16)];maxCoord=max(maxCoord,max(abs(a-b) for a,b in zip(want,old[16*row+j])))
for frame in raw['frames']:
 ri=frame['ring'];sign=-1 if frame['role']=='negative-X-cuff' else 1;rootIDs=c['sharedRootOldIDs'][frame['role']];C0=avg([old[v] for v in rootIDs]);cs=[[sign*a,b,z] for a,b,z in c['positiveSleeveCentres']];dv=minus(cs[1],C0) if ri==0 else minus(cs[2],cs[0] if ri==1 else cs[1]);D=[x/math.sqrt(sum(v*v for v in dv)) for x in dv];U0=[-D[1]*D[0],1-D[1]**2,-D[1]*D[2]];U=[x/math.sqrt(sum(v*v for v in U0)) for x in U0];V0=cross(U,D);V=[x/math.sqrt(sum(v*v for v in V0)) for x in V0]
 for key,want in [('C0',C0),('centre',cs[ri]),('dInput',dv),('d',D),('U',U),('V',V)]:maxCoord=max(maxCoord,max(abs(a-b) for a,b in zip(want,frame[key])))
 start=112+(0 if sign<0 else 24)+8*ri
 for j in range(8):
  a,b=c['sleeveRadiiUV'][ri];theta=math.tau*j/8;want=[cs[ri][k]+a*math.cos(theta)*U[k]+b*math.sin(theta)*V[k] for k in range(3)];maxCoord=max(maxCoord,max(abs(x-y) for x,y in zip(want,old[start+j])))
assert maxCoord<1e-14;r['authoredCoordinateMaxDifference']=maxCoord
r['stages']={}
for stage in ['raw','smooth']:
 ps=raw[stage+'Points'];fs=raw[stage+'Faces'];roles={tuple(sorted((a,b))):name for a,b,name in raw[stage+'Roles']};es=defaultdict(list);graph=defaultdict(set);links=defaultdict(lambda:defaultdict(set));terms=[];areas=[]
 assert all(len(f)==4 and len(set(f))==4 and all(0<=v<len(ps) for v in f) for f in fs) and all(math.isfinite(x) for v in ps for x in v)
 for fi,f in enumerate(fs):
  for i,a in enumerate(f):
   b=f[(i+1)%4];es[tuple(sorted((a,b)))].append((a,b));graph[a].add(b);graph[b].add(a);prior=f[(i-1)%4];links[a][prior].add(b);links[a][b].add(prior)
  for i,j,k in [(0,1,2),(0,2,3)]:
   a,b,d=[ps[f[t]] for t in [i,j,k]];areas.append(math.sqrt(sum(x*x for x in cross(minus(b,a),minus(d,a))))/2);terms.append(sum(x*y for x,y in zip(a,cross(b,d)))/6)
 assert flood(graph,0)==set(range(len(ps)))
 boundaries={e for e,v in es.items() if len(v)==1};assert boundaries==set(roles)
 assert all(len(v) in [1,2] and (len(v)==1 or v[0]==v[1][::-1]) for v in es.values())
 bg=defaultdict(set)
 for a,b in boundaries:bg[a].add(b);bg[b].add(a)
 assert all(len(v)==2 for v in bg.values());groups=[];todo=set(bg)
 while todo:
  comp=flood(bg,min(todo));todo-=comp;names={name for e,name in roles.items() if e[0] in comp};assert len(names)==1;groups.append({'role':next(iter(names)),'vertices':len(comp)})
 assert sorted(x['role'] for x in groups)==sorted(c['roles'])
 for v,l in links.items():
  assert flood(l,min(l))==set(l);ds=Counter(len(n) for n in l.values());assert (ds[1]==2 and set(ds)<={1,2}) if v in bg else set(ds)=={2}
 for role in c['roles']:
  edges=[e for e,name in roles.items() if name==role];center=avg([ps[v] for v in sorted({v for e in edges for v in e})])
  for e in edges:
   a,b=es[e][0];terms.append(sum(x*y for x,y in zip(ps[b],cross(ps[a],center)))/6)
 check={'V':len(ps),'E':len(es),'F':len(fs),'Euler':len(ps)-len(es)+len(fs),'boundaryEdges':len(boundaries)};assert check==c['expectedRaw' if stage=='raw' else 'expectedSmooth'];assert min(areas)>c['minimumTriangleArea'] and math.fsum(terms)>0
 r['stages'][stage]={**check,'loops':groups,'minimumTriangleArea':min(areas),'signedCappedVolume':math.fsum(terms),'allEdgeOrientationAndVertexLinksPass':True}
 for k,v in r['stages'][stage].items():
  if k in ['minimumTriangleArea','signedCappedVolume']:assert abs(v-raw[stage+'Check'][k])<1e-14
 if stage=='raw':rawes=es
assert mesh['vertices']==raw['smoothPoints'] and mesh['quads']==raw['smoothFaces'] and mesh['boundaryRoles']==raw['smoothRoles']
# Independent subdivision arithmetic on saved raw records, without author helper/import.
ps=raw['rawPoints'];fs=raw['rawFaces'];out=raw['smoothPoints'];fps=[avg([ps[v] for v in f]) for f in fs];vfs=defaultdict(list);ves=defaultdict(list);boundary={v for e,rows in rawes.items() if len(rows)==1 for v in e};maxSmooth=0
for fi,f in enumerate(fs):
 for v in f:vfs[v].append(fi)
for e in rawes:
 for v in e:ves[v].append(e)
for v,P in enumerate(ps):
 if v in boundary:want=P
 else:
  n=len(vfs[v]);F=avg([fps[t] for t in vfs[v]]);R=avg([avg([ps[a],ps[b]]) for a,b in ves[v]]);want=[(F[k]+2*R[k]+(n-3)*P[k])/n for k in range(3)]
 maxSmooth=max(maxSmooth,max(abs(a-b) for a,b in zip(want,out[v])))
assert maxSmooth<1e-14
edgeIDs={e:len(ps)+i for i,e in enumerate(rawes)}
for e,rows in rawes.items():
 adjacent=[i for i,f in enumerate(fs) if e[0] in f and e[1] in f]
 assert len(adjacent)==len(rows)
 want=avg([ps[e[0]],ps[e[1]]]+([fps[i] for i in adjacent] if len(rows)==2 else []));maxSmooth=max(maxSmooth,max(abs(a-b) for a,b in zip(want,out[edgeIDs[e]])))
faceStart=len(ps)+len(rawes)
for i,P in enumerate(fps):maxSmooth=max(maxSmooth,max(abs(a-b) for a,b in zip(P,out[faceStart+i])))
for fi,f in enumerate(fs):
 for i,v in enumerate(f):assert raw['smoothFaces'][4*fi+i]==[v,edgeIDs[tuple(sorted((v,f[(i+1)%4])))],faceStart+fi,edgeIDs[tuple(sorted((f[(i-1)%4],v)))]]
expectedRoles={}
for a,b,role in raw['rawRoles']:
 middle=edgeIDs[tuple(sorted((a,b)))];expectedRoles[tuple(sorted((a,middle)))]=role;expectedRoles[tuple(sorted((middle,b)))]=role
assert expectedRoles=={tuple(sorted((a,b))):role for a,b,role in raw['smoothRoles']}
assert maxSmooth<1e-14;r['subdivisionAllVertexMaxDifference']=maxSmooth;r['subdivisionAllFaceAndRoleIdentity']=True
obj=(p/'sweater.obj').read_text().splitlines();verts=[[float(t) for t in line.split()[1:]] for line in obj if line.startswith('v ')];quads=[[int(t)-1 for t in line.split()[1:]] for line in obj if line.startswith('f ')];assert verts==mesh['vertices'] and quads==mesh['quads']
r['completed']=datetime.now(timezone.utc).isoformat();r['status']='A saved artist data only; appearance pending';(p/'ROOT-DATA.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'pid':r['pid'],'completed':r['completed'],'stages':r['stages'],'maxCoordinates':maxCoord,'maxSubdivision':maxSmooth,'status':r['status']}))
