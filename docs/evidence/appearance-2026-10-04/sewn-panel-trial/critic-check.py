"""Saved-data-only refusal verification; no producer/helper import or classifier."""
import collections,datetime,hashlib,json,math,os,pathlib
from fractions import Fraction as F
R=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
T=pathlib.Path(__file__).resolve().parent
S=R/'docs/evidence/appearance-2026-10-04/sewn-panel-builder'
def utc():return datetime.datetime.now(datetime.UTC).isoformat()
def pin(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def read(p):return json.loads(p.read_text())
def verify(rows):
 out=[]
 for row in rows:
  p=pathlib.Path(row['path']);p=p if p.is_absolute() else R/p;a=pin(p)
  assert all(a[k]==row[k] for k in ('bytes','sha256')),(row,a)
  out.append(a)
 return out
def rational(x):return F(int(x['n']),int(x['d'])) if isinstance(x,dict) else F(x)
def diff(a,b):return tuple(x-y for x,y in zip(a,b))
def product(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def ratios(v):return [{'n':str(x.numerator),'d':str(x.denominator)} for x in v]
def topology(mesh):
 pts=[tuple(map(F,p)) for p in mesh['vertices']];faces=mesh['faces'];edges=collections.defaultdict(list);links=collections.defaultdict(list)
 for faceid,face in enumerate(faces):
  assert len(face)==3 and len(set(face))==3 and all(0<=v<len(pts) for v in face)
  assert product(cross(diff(pts[face[1]],pts[face[0]]),diff(pts[face[2]],pts[face[0]])),cross(diff(pts[face[1]],pts[face[0]]),diff(pts[face[2]],pts[face[0]])))>0
  for i,u in enumerate(face):
   v=face[(i+1)%3];edges[tuple(sorted((u,v)))].append((u,v,faceid));links[u].append((v,face[(i+2)%3]))
 assert set(links)==set(range(len(pts)))
 boundaries=[];adj=collections.defaultdict(set)
 for key,uses in edges.items():
  assert len(uses) in (1,2)
  if len(uses)==2:assert uses[0][:2]==uses[1][:2][::-1]
  else:boundaries.append(uses[0][:2])
  adj[key[0]].add(key[1]);adj[key[1]].add(key[0])
 pending=[0];seen={0}
 while pending:
  for v in adj[pending.pop()]:
   if v not in seen:seen.add(v);pending.append(v)
 assert len(seen)==len(pts)
 for vertex,wedges in links.items():
  graph=collections.defaultdict(set)
  for a,b in wedges:graph[a].add(b);graph[b].add(a)
  assert len(wedges)==sum(len(v) for v in graph.values())//2
  degrees=sorted(map(len,graph.values()));assert set(degrees)<=set((1,2)) and degrees.count(1) in (0,2)
  stack=[next(iter(graph))];visited=set(stack)
  while stack:
   for q in graph[stack.pop()]:
    if q not in visited:visited.add(q);stack.append(q)
  assert visited==set(graph)
 return {'vertices':len(pts),'edges':len(edges),'faces':len(faces),'Euler':len(pts)-len(edges)+len(faces),'boundaryDirectedEdges':[list(e) for e in boundaries],'allVertexLinksConnected':True}
started=utc();run=read(T/'RUN.json');plan=read(T/'PLAN.json');job=read(T/'JOB.json');partial=read(T/'PARTIAL.json');refusal=read(T/'REFUSAL.json');report=read(T/'REPORT.json')
assert run['status']==job['status']==partial['status']==report['status']=='refused' and run['exitCode']==1
assert len(run['outputs'])==22 and 'timeoutObserved' not in run
assert run['maximumInvocations']==1 and run['wallLimitSeconds']==600 and job['pid']==run['childPid']==run['processGroup']
assert datetime.datetime.fromisoformat(run['started'])<datetime.datetime.fromisoformat(plan['executeBeforeUTC'])
assert datetime.datetime.fromisoformat(run['fullReturn'])<datetime.datetime.fromisoformat(plan['criticSaveGate'])
assert report['job']==job and report['report']==refusal
assert not (T/'COVERAGE.json').exists() and not (T/'sweater.obj').exists()
pins={'outputs':verify(run['outputs']),'source':verify(read(S/'SOURCE-INPUTS.json')['sources']),'original':verify(read(S/'INPUTS.json')['inputs']),'trial':verify(read(T/'INPUTS.json')['inputs'])}
stdout=[json.loads(line) for line in (T/'STDOUT.txt').read_text().splitlines()]
assert stdout[-1]=={'status':'refused','fullAuthorReturn':job['ended'],'phase':job['phase']}
assert 'physicalClearance' in (T/'STDERR.txt').read_text()
physical=read(T/'PHYSICAL.json');test=read(T/'TEST-SOLID.json');frags=read(T/'FRAGMENTS.json');domain=read(T/'SOURCE-DOMAIN.json')
ledger=read(R/'docs/evidence/appearance-2026-10-04/original-surface-ledger/LEDGER.json');partition=read(R/'docs/evidence/appearance-2026-10-04/sweater-coverage-owned/PARTITION.json')
assert len(frags)==domain['requiredPolygons']==34984
assert len(ledger['owners'])==len(partition['owners'])==len(domain['owners'])==9
offset=0;sourceCounts=[]
for owner,intent,declared in zip(ledger['owners'],partition['owners'],domain['owners']):
 assert (owner['uuid'],owner['key'],owner['name'])==(intent['uuid'],intent['key'],intent['name']) and declared['uuid']==owner['uuid']
 ids=intent['required']+[x for values in intent['exposed'].values() for x in values]+[x['id'] for x in intent['cut']]+intent['degenerate']
 assert sorted(ids)==list(range(len(owner['triangles']))) and len(owner['triangles'])==declared['originalTriangles'] and len(owner['worldPositions'])==declared['originalPoints']
 expected={tid:[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]] for tid in intent['required']}
 expected.update({x['id']:x['required'] for x in intent['cut'] if x['required']})
 chunk=frags[offset:offset+len(expected)];assert len(chunk)==declared['requiredPolygons'];assert {x['triangleID'] for x in chunk}==set(expected)
 for frag in chunk:
  tid=frag['triangleID'];assert frag['key']==[owner['uuid'],tid,0] and frag['ordinal']==0 and frag['owner']==owner['uuid'] and frag['barycentric']==expected[tid]
  vid=owner['triangles'][tid];assert vid==frag['originalVertexIDs'];corners=[owner['worldPositions'][i] for i in vid]
  observed=[[(b[0]*corners[0][k]+b[1]*corners[1][k])+b[2]*corners[2][k] for k in range(3)] for b in frag['barycentric']]
  assert observed==frag['points']
 if owner['key']=='bra':assert len(expected)==22090 and not intent['cut'] and not any(intent['exposed'].values())
 sourceCounts.append({'uuid':owner['uuid'],'triangles':len(owner['triangles']),'points':len(owner['worldPositions']),'required':len(expected)});offset+=len(expected)
assert offset==34984 and sum(x['triangles'] for x in sourceCounts)==71512 and sum(x['points'] for x in sourceCounts)==39546
prefix=[json.loads(line) for line in (T/'FRAGMENT-CERTIFICATES.jsonl').read_text().splitlines()]
assert len(prefix)==partial['completedFragmentRows']==709 and [x['key'] for x in prefix]==[x['key'] for x in frags[:709]]
for row in prefix:
 assert len(row['classification'])==3 and all(len(x['hits'])%2==1 for x in row['classification'])
 assert len(row['capPlaneDistances'])==4 and row['sourceFan']
 for fan in row['sourceFan']:
  assert 'failure' not in fan['physicalCertificate'] and 'failure' not in fan['capDisjointCertificate']
  assert all(rational(pair[2])>=F(1,10000) for pair in fan['physicalCertificate']['pairs'])
  assert all(rational(pair[2])>0 for pair in fan['capDisjointCertificate']['pairs'])
# The retained completed-prefix records are accounted, not independently reclassified.
w=refusal['operands'][0];assert w['physicalClearance']==frags[709]['key'] and w['fan']==1
frag=frags[709];assert frag['key']==['6a387a24-324d-438d-b152-fb4b7edc4a45',2810,0] and frag['originalVertexIDs']==[1837,1838,1855]
assert 2810 in partition['owners'][0]['required'] and frag['barycentric']==[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]]
tri=[tuple(map(F,p)) for p in frag['points']];assert tri==[tuple(map(rational,p)) for p in w['sourceTriangle']]
failure=w['rowPrefix']['sourceFan'][0]['physicalCertificate']['failure'];assert failure[1]==54 and failure[2][:4]==['vertex-face',0,2,'face']
face=physical['faces'][54];assert face==[18,17,36]
a,b,c=[tuple(map(F,physical['vertices'][i])) for i in face];p=tri[2];normal=cross(diff(b,a),diff(c,a));n2=product(normal,normal);height=product(diff(p,a),normal)
q=tuple(p[i]-normal[i]*height/n2 for i in range(3));distanceSquared=height*height/n2
# Independent normal projection plus 2D oriented-area weights, not Gram-matrix minimization.
axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
def signed(x,y,z):
 i,j=axes;return (y[i]-x[i])*(z[j]-x[j])-(y[j]-x[j])*(z[i]-x[i])
whole=signed(a,b,c);bary=(signed(q,b,c)/whole,signed(a,q,c)/whole,signed(a,b,q)/whole)
assert all(v>=0 for v in bary) and sum(bary)==1
assert q==tuple(sum(bary[j]*v[i] for j,v in enumerate((a,b,c))) for i in range(3))
assert bary==tuple(map(rational,failure[2][4])) and distanceSquared==rational(failure[0])
assert 0<distanceSquared<F(1,10000) and product(diff(p,q),diff(p,q))==distanceSquared
pt=topology(physical);ct=topology(test)
assert [pt[k] for k in ('vertices','edges','faces','Euler')]==[38,98,58,-2] and len(pt['boundaryDirectedEdges'])==22
assert [ct[k] for k in ('vertices','edges','faces','Euler')]==[42,120,80,2] and not ct['boundaryDirectedEdges']
for record,actual in [('TOPOLOGY-PHYSICAL.json',pt),('TOPOLOGY-TEST.json',ct)]:
 saved=read(T/record);assert all(saved[k]==actual[k] for k in ('vertices','edges','faces','Euler'));assert set(map(tuple,saved['boundaryEdges']))==set(map(tuple,actual['boundaryDirectedEdges']))
assert physical['planes'][0]['normal']==partition['planes'][0]['normal']
for actual,intent in zip(physical['planes'],partition['planes']):assert actual['name']==intent['name'] and actual['normal']==intent['normal'] and actual['originalOrigin']==intent['origin']
result={'decision':'B literal source clearance; independent actual counterexample verified','started':started,'completed':utc(),'pid':os.getpid(),'pins':pins,'run':{'runnerPid':run['runnerPid'],'childPid':run['childPid'],'started':run['started'],'launched':run['launched'],'fullReturn':run['fullReturn'],'exitCode':1,'outputs':22,'timeout':False},'sourceCounts':sourceCounts,'fragments':34984,'completedPrefix':709,'failedKey':frag['key'],'failedOriginalVertexIDs':frag['originalVertexIDs'],'sourceVertex':ratios(p),'physicalFace':54,'faceVertexIDs':face,'faceProvenance':physical['faceProvenance'][54],'normalProjection':ratios(q),'garmentBarycentric':ratios(bary),'distanceSquared':{'n':str(distanceSquared.numerator),'d':str(distanceSquared.denominator)},'distanceMillimetresObserver':math.sqrt(float(distanceSquared))*1000,'physicalTopology':pt,'cappedTopology':ct,'scope':'Sufficient actual point-pair counterexample, provenance and complete saved output/prefix accounting. No independent full-prefix classifier, all-intersections, global minimum, fit/GPU/motion/appearance claim.'}
with (T/'CRITIC-CHECK.json').open('x') as stream:json.dump(result,stream,indent=2);stream.write('\n')
print(json.dumps({'decision':result['decision'],'completed':result['completed'],'pid':result['pid'],'sourceFragmentCount':34984,'completedPrefix':709,'distanceMillimetresObserver':result['distanceMillimetresObserver'],'result':pin(T/'CRITIC-CHECK.json')}))
