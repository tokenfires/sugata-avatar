"""Saved JSON/OBJ arithmetic only. Never import the author or construct a mesh."""
from collections import defaultdict
from fractions import Fraction as Q
from datetime import datetime,timezone
from pathlib import Path
import json,math,hashlib,os
p=Path(__file__).resolve().parent; root=p.parents[3]
started=datetime.now(timezone.utc).isoformat()
r=json.loads((p/'RAW.json').read_text());m=json.loads((p/'mesh.json').read_text());c=json.loads((p/'ARTIST.json').read_text())
j=json.loads((p/'AUTHOR-JOB.json').read_text());proc=json.loads((p/'RUN-PROCESS.json').read_text())
assert r['artist']==m['artist']==c and j==json.loads((p/'STDOUT.txt').read_text())
assert proc['childExit']==0 and proc['childReaped'] and not(proc['timedOut'] or proc['late'] or proc['recordingErrors'])
assert (p/'STDERR.txt').read_bytes()==b''
for name,w in json.loads((p/'INPUTS.json').read_text())['files'].items():
 b=(root/name).read_bytes();assert len(b)==w['bytes'] and hashlib.sha256(b).hexdigest()==w['sha256'],name
for name,w in proc['actualFiles'].items():
 b=(p/name).read_bytes();assert w['exists'] and len(b)==w['bytes'] and hashlib.sha256(b).hexdigest()==w['sha256']
for name,w in j['outputs'].items():
 b=(p/name).read_bytes();assert len(b)==w['bytes'] and hashlib.sha256(b).hexdigest()==w['sha256']
def average(vs):return [sum(Q(v[k]) for v in vs)/len(vs) for k in range(3)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def determinant(a,b,d):return sum(a[k]*cross(b,d)[k] for k in range(3))
def reachable(g,start):
 seen=set();todo=[start]
 while todo:
  v=todo.pop()
  if v not in seen:seen.add(v);todo.extend(g[v]-seen)
 return seen
summaries={};incidences={};boundaries={};maxres=0.0
def close(actual,expected):
 global maxres
 delta=abs(actual-float(expected));maxres=max(maxres,delta);assert delta<8e-15,(actual,float(expected),delta)
for stage in ['raw','smooth']:
 ps=r[stage+'Points'];fs=r[stage+'Faces'];roles={(a,b):name for a,b,name in r[stage+'Roles']}
 assert len(roles)==len(r[stage+'Roles']) and all(a<b for a,b in roles)
 es=defaultdict(list);g=defaultdict(set);links=defaultdict(lambda:defaultdict(list));used=set();minarea=math.inf
 assert len({tuple(sorted(f)) for f in fs})==len(fs)
 for fi,f in enumerate(fs):
  assert len(set(f))==4 and all(0<=v<len(ps) for v in f);used.update(f)
  for i,a in enumerate(f):
   b=f[(i+1)%4];es[tuple(sorted((a,b)))].append((fi,a,b));g[a].add(b);g[b].add(a)
   before,after=f[i-1],b;links[a][before].append(after);links[a][after].append(before)
  for ids in [(f[0],f[1],f[2]),(f[0],f[2],f[3])]:
   a,b,d=[ps[v] for v in ids];area=math.hypot(*cross([b[k]-a[k] for k in range(3)],[d[k]-a[k] for k in range(3)]))/2
   assert area>c['minimumTriangleArea'];minarea=min(minarea,area)
 assert used==set(range(len(ps))) and reachable(g,0)==used
 boundary={e for e,rows in es.items() if len(rows)==1};assert boundary==set(roles)
 bg=defaultdict(set)
 for e,rows in es.items():
  assert len(rows) in [1,2]
  if len(rows)==2:assert rows[0][1:]==rows[1][1:][::-1]
  else:bg[e[0]].add(e[1]);bg[e[1]].add(e[0])
 assert all(len(ns)==2 for ns in bg.values())
 for v,link in links.items():
  assert reachable({k:set(ns) for k,ns in link.items()},next(iter(link)))==set(link)
  degrees=[len(ns) for ns in link.values()]
  assert (sorted(degrees).count(1)==2 and all(d in [1,2] for d in degrees)) if v in bg else all(d==2 for d in degrees)
 remaining=set(bg);loops=[]
 while remaining:
  component=reachable(bg,min(remaining));remaining-=component
  names={roles[e] for e in boundary if e[0] in component};assert len(names)==1
  loops.append((next(iter(names)),component))
 assert sorted(name for name,_ in loops)==sorted(c['roles'])
 expected=c['expectedRaw' if stage=='raw' else 'expectedSmooth'];assert (len(ps),len(es),len(fs),len(boundary))==(expected['V'],expected['E'],expected['F'],expected['boundaryEdges'])
 assert len(ps)-len(es)+len(fs)==-2
 recorded=r[stage+'Check'];close(recorded['minimumTriangleArea'],minarea)
 assert {(x['role'],frozenset(x['vertices'])) for x in recorded['cycles']}=={(name,frozenset(vs)) for name,vs in loops}
 volume=Q(0)
 for f in fs:
  for ids in [(f[0],f[1],f[2]),(f[0],f[2],f[3])]:volume+=determinant(*[[Q(x) for x in ps[v]] for v in ids])/6
 capbyedge={tuple(x['edge']):x for x in r[stage+'CheckOnlyCaps']};assert len(capbyedge)==len(boundary)
 for name,vs in loops:
  center=average([ps[v] for v in vs])
  for e in boundary:
   if roles[e]!=name:continue
   _,a,b=es[e][0];row=capbyedge[(a,b)];assert row['role']==name
   for actual,expectedvalue in zip(row['centre'],center):close(actual,expectedvalue)
   term=determinant([Q(x) for x in ps[b]],[Q(x) for x in ps[a]],center)/6;close(row['term'],term);volume+=term
 assert volume>0;close(recorded['signedCappedVolume'],volume)
 incidences[stage]=es;boundaries[stage]=boundary;summaries[stage]={'vertices':len(ps),'edges':len(es),'quads':len(fs),'boundaryEdges':len(boundary),'Euler':-2,'loopSizes':{name:len(vs) for name,vs in loops},'minimumArea':minarea,'signedCappedVolume':float(volume)}
assert r['unusedOldIDs']==[64,72] and len(r['uncompactedPoints'])==160
old=r['uncompactedPoints'];of=r['uncompactedFaces'];used=r['usedOldIDs'];renum={v:i for i,v in enumerate(used)}
assert used==sorted({v for f in of for v in f}) and r['rawPoints']==[old[v] for v in used]
assert r['rawFaces']==[[renum[v] for v in f] for f in of]
assert r['points']==r['rawPoints'] and r['faces']==r['rawFaces'] and r['boundaryRoles']==r['rawRoles']
N=c['torsoAngularCount'];omitted={tuple(x) for x in c['omittedTorsoQuadRowColumns']};cursor=0
for row,(y,w,d,z) in enumerate(c['torsoRowsYWidthDepthCenterZ']):
 for a in range(N):
  expected=[w*math.cos(2*math.pi*a/N),y,z+d*math.sin(2*math.pi*a/N)]
  for actual,want in zip(old[N*row+a],expected):close(actual,want)
  if row<6 and (row,a) not in omitted:
   assert of[cursor]==[N*row+a,N*(row+1)+a,N*(row+1)+(a+1)%N,N*row+(a+1)%N];cursor+=1
framecursor=0
for sign,name,first in [(-1,'negative-X-cuff',112),(1,'positive-X-cuff',136)]:
 prior=c['sharedRootOldIDs'][name];centres=[[sign*x,y,z] for x,y,z in c['positiveSleeveCentres']];C0=average([old[v] for v in prior])
 for ri in range(3):
  fr=r['frames'][framecursor];framecursor+=1;assert fr['role']==name and fr['ring']==ri and fr['centre']==centres[ri] and fr['radiiUV']==c['sleeveRadiiUV'][ri]
  expectedinput=[centres[1][k]-float(C0[k]) for k in range(3)] if ri==0 else [centres[2][k]-centres[ri-1][k] for k in range(3)]
  for actual,want in zip(fr['dInput'],expectedinput):close(actual,want)
  for actual,want in zip(fr['C0'],C0):close(actual,want)
  length=math.hypot(*fr['dInput']);assert length>1e-12
  for actual,want in zip(fr['d'],fr['dInput']):close(actual,want/length)
  d=fr['d'];u=[-d[1]*d[0],1-d[1]**2,-d[1]*d[2]];length=math.hypot(*u)
  for actual,want in zip(fr['U'],u):close(actual,want/length)
  for actual,want in zip(fr['V'],cross(fr['U'],d)):close(actual,want)
  ring=list(range(first+8*ri,first+8*(ri+1)))
  for a,v in enumerate(ring):
   t=2*math.pi*a/8;want=[centres[ri][k]+fr['radiiUV'][0]*math.cos(t)*fr['U'][k]+fr['radiiUV'][1]*math.sin(t)*fr['V'][k] for k in range(3)]
   for actual,expectedvalue in zip(old[v],want):close(actual,expectedvalue)
   assert of[cursor]==[prior[a],v,ring[(a+1)%8],prior[(a+1)%8]];cursor+=1
  prior=ring
 assert r['declaredLoops'][name]==prior
assert cursor==136
rawps=r['rawPoints'];rawfs=r['rawFaces'];sp=r['smoothPoints'];sf=r['smoothFaces'];np=len(rawps);ne=len(incidences['raw']);ep={};vfaces=defaultdict(list)
for fi,f in enumerate(rawfs):
 facepoint=average([rawps[v] for v in f]);fid=np+ne+fi
 for actual,want in zip(sp[fid],facepoint):close(actual,want)
 for a,v in enumerate(f):
  child=sf[4*fi+a];assert child[0]==v and child[2]==fid
  for e,eid in [(tuple(sorted((v,f[(a+1)%4]))),child[1]),(tuple(sorted((f[a-1],v))),child[3])]:
   assert e not in ep or ep[e]==eid;ep[e]=eid
  vfaces[v].append(fi)
assert len(set(ep.values()))==ne and set(ep.values())==set(range(np,np+ne))
for e,eid in ep.items():
 rows=incidences['raw'][e];values=[rawps[v] for v in e]
 if len(rows)==2:values += [average([rawps[v] for v in rawfs[fi]]) for fi,_,_ in rows]
 for actual,want in zip(sp[eid],average(values)):close(actual,want)
for v,point in enumerate(rawps):
 edges=[e for e in ep if v in e]
 if any(e in boundaries['raw'] for e in edges):assert sp[v]==point;continue
 n=len(vfaces[v]);F=average([average([rawps[x] for x in rawfs[fi]]) for fi in vfaces[v]]);R=average([average([rawps[x] for x in e]) for e in edges])
 for actual,want in zip(sp[v],[(F[k]+2*R[k]+(n-3)*Q(point[k]))/n for k in range(3)]):close(actual,want)
rawroles={(a,b):name for a,b,name in r['rawRoles']};newroles={}
for (a,b),name in rawroles.items():
 newroles[tuple(sorted((a,ep[(a,b)])))]=name;newroles[tuple(sorted((ep[(a,b)],b)))]=name
assert newroles=={(a,b):name for a,b,name in r['smoothRoles']}
assert m['vertices']==sp and m['quads']==sf and m['boundaryRoles']==r['smoothRoles'] and m['checks']==j['checks']=={'raw':r['rawCheck'],'smooth':r['smoothCheck']}
lines=(p/'sweater.obj').read_text().splitlines();ovs=[list(map(float,line.split()[1:])) for line in lines if line.startswith('v ')];ofs=[[int(x)-1 for x in line.split()[1:]] for line in lines if line.startswith('f ')]
assert ovs==sp and ofs==sf
record={'pid':os.getpid(),'startedUTC':started,'completedUTC':datetime.now(timezone.utc).isoformat(),'dataDecision':'A saved artist mesh only; native-source review still required','stages':summaries,'maximumArithmeticResidual':maxres,'limits':'No author/helper import or rerun, no new mesh, GLB decode, renderer or native. Checks concern retained source/index/arithmetic/export data, not fit or appearance.'}
for name in ['RAW.json','mesh.json','sweater.obj','AUTHOR-JOB.json','RUN-PROCESS.json','STDOUT.txt','STDERR.txt','PLAN.md','ARTIST.json','author.py','runner.py','INPUTS.json','SOURCE.md','SURFACE-CONTRACT.md','HELPER-COPY.json']:
 b=(p/name).read_bytes();record.setdefault('pins',{})[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
record['readerSHA256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(p/'CRITIC-DATA.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
