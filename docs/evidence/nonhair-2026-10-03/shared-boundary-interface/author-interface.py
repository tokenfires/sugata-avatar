"""Canonical curve graph and Coons contract only; no surface/mesh/native evaluation."""
from pathlib import Path
import hashlib,json,datetime,os,collections,math
p=Path('docs/evidence/nonhair-2026-10-03/shared-boundary-interface');old=Path('docs/evidence/nonhair-2026-10-03/control-net-authorship/control-net.json');start=datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
assert start<'2026-10-03T18:02:00' and sha(old)=='ee2808f9c4c2a04d6582beee454786dde2c3303e91430a9f259d1158a4982936'
n=json.loads(old.read_text());nodes={};edges={};panels={};occurrences=collections.Counter()
for panel in n['panels'].values():
 for row in panel['nodes']:
  for a in row:
   if a['id']in nodes:assert nodes[a['id']]==a['P']
   nodes[a['id']]=a['P']
back=[n['panels']['minusX']['nodes'][j][4]['P']for j in range(6)]
backJets=[]
for j in range(6):
 a=max(0,j-1);b=min(5,j+1);dv=[(back[b][k]-back[a][k])/(n['v'][b]-n['v'][a])for k in range(3)]
 dv[0]=(back[1][0]-back[0][0])/(n['v'][1]-n['v'][0]) if j==0 else 0
 backJets.append(dv)
def edge(a,b,key,width,backIndex=None):
 eid='edge:'+'|'.join(sorted([a['id'],b['id']]))
 da=a[key] if backIndex is None else backJets[backIndex]
 db=b[key] if backIndex is None else backJets[backIndex+1]
 declaration={'endpoints':[a['id'],b['id']],'localParameter':[0,1],'M0':[x*width for x in da],'M1':[x*width for x in db],'kind':'cubic Hermite, P0/P1 from canonical node IDs','policy':'new common entire back trace' if backIndex is not None else 'literal authored guide derivative scaled to local edge parameter'}
 if eid not in edges:edges[eid]=declaration
 else:assert edges[eid]==declaration,(eid,'canonical definition mismatch')
 occurrences[eid]+=1
 return {'id':eid,'orientation':1,'parameter':'local0..1 along stored endpoints; reverse requests use1-t'}
for side,panel in n['panels'].items():
 A=panel['nodes'];U={};V={}
 for j in range(6):
  for i in range(4):U[j,i]=edge(A[j][i],A[j][i+1],'du',n['u'][i+1]-n['u'][i])
 for j in range(5):
  for i in range(5):V[j,i]=edge(A[j][i],A[j+1][i],'dv',n['v'][j+1]-n['v'][j],j if i==4 else None)
 patches=[]
 for j in range(5):
  for i in range(4):
   patches.append({'id':side+':'+str(j)+':'+str(i),'grid':[j,i],'corners':{'P00':A[j][i]['id'],'P10':A[j][i+1]['id'],'P01':A[j+1][i]['id'],'P11':A[j+1][i+1]['id']},'south':U[j,i],'north':U[j+1,i],'west':V[j,i],'east':V[j,i+1]})
 panels[side]={'patches':patches,'futureOrientationSign':1 if side=='minusX'else -1,'meaning':'source directions rise in u/v on both panels; future triangle winding must account for opposite half orientations; not mesh orientation qualification'}
interface={'kind':'new canonical shared-curve Coons interface; C0-only source contract','positionSource':{'path':str(old),'sha256':sha(old),'role':'unchanged artist P choices only; prior incompatible tensor surface remains refused/frozen'},'coordinateFrame':n['coordinateFrame'],'nodes':nodes,'edges':edges,'panels':panels,'curveFormula':'E(t)=h00(t)*P0+h01(t)*P1+h10(t)*M0+h11(t)*M1; h00=2t^3-3t^2+1,h01=-2t^3+3t^2,h10=t^3-2t^2+t,h11=t^3-t^2; M are local-parameter tangents; exact endpoint ID return at t=0/1 in a future evaluator','surfaceFormula':'S(u,v)=(1-v)*south(u)+v*north(u)+(1-u)*west(v)+u*east(v)-B(u,v); B=(1-u)*(1-v)*P00+u*(1-v)*P10+(1-u)*v*P01+u*v*P11','orientations':'south/north west-to-east, west/east south-to-north. Local0..1 for each patch edge; canonical edge orientation field applied BEFORE function evaluation. Shared edge has one ID and one function, never a panel-specific jet.','backPolicy':{'IDs':[n['panels']['minusX']['nodes'][j][4]['id']for j in range(6)],'globalV':n['v'],'globalDerivativeVectors':backJets,'choice':'at part/back corner the common entire back trace starts toward back-1 using the endpoint secant. Its X reaches0 at back-1 with zero X derivative and stays0 afterward. Y/Z use secants of the shared back P sequence. Neither old side-specific back trace is selected or sampled/welded.','corner':'part-4 is the same position ID for the last part edge and first back edge; distinct prescribed edge tangents are allowed. Both adjoining Coons patches meet their own identical canonical curves at that corner. No single tangent plane/C1/regularity promise; a crease or singularity is a future rejection condition.'},'proof':{'south':'v=0: north term0; west(0)=P00,east(0)=P10 cancel B(u,0), leaving south(u).','north':'v=1: south term0; west(1)=P01,east(1)=P11 cancel B(u,1), leaving north(u).','west':'u=0: east term0; south(0)=P00,north(0)=P01 cancel B(0,v), leaving west(v).','east':'u=1: west term0; south(1)=P10,north(1)=P11 cancel B(1,v), leaving east(v).','shared':'same canonical edge ID and orientation-consistent t imply identical prescribed boundary function for every t, not just knots; cancellation above establishes each patch trace equals it in exact arithmetic.','floatLimit':'mathematical identity is not bit-exact GPU proof. Any future builder must use canonical endpoint/edge sample records byID for identical boundaries and retain finite/arithmetic tolerance checks. No choice between differing panel surfaces occurs because only one prescribed curve exists.'},'roles':n['responsibilities'],'attachment':n['attachment'],'limits':['No C1/tangent-plane/regularity/self-intersection/triangle/normal/skin-clearance/independent coverage claim.','No surface evaluation, mesh/Avatar/material/renderer/native/GPU/browser job; no appearance pass.','No currentmatrix operands/body-morph/moving-fit or complete hairstyle/AAA qualification.','This replaces interpolation/ownership responsibility while preserving position hypotheses; old tensor net is not repaired or rerun.']}
# Independent endpoint-reference/cell-occurrence checks; no surface or numerical edge sampling.
refs=collections.Counter();boundary=[]
for panel in panels.values():
 for patch in panel['patches']:
  c=patch['corners'];expected={'south':[c['P00'],c['P10']],'north':[c['P01'],c['P11']],'west':[c['P00'],c['P01']],'east':[c['P10'],c['P11']]}
  for name,ends in expected.items():
   ref=patch[name];e=edges[ref['id']];assert ref['orientation']==1 and e['endpoints']==ends;refs[ref['id']]+=1
assert len(nodes)==50 and len(edges)==89 and sum(len(p['patches'])for p in panels.values())==40
assert set(refs)==set(edges) and all(x in [1,2]for x in refs.values())
for e in edges.values():assert all(math.isfinite(x)for key in ['M0','M1']for x in e[key])
# One outer-boundary cycle from canonical curves, not geometrical coverage evidence.
degree=collections.Counter();adj={}
for eid,count in refs.items():
 if count==1:
  a,b=edges[eid]['endpoints'];degree[a]+=1;degree[b]+=1;adj.setdefault(a,set()).add(b);adj.setdefault(b,set()).add(a)
assert len(degree)==18 and all(d==2 for d in degree.values());seen=set();todo=[next(iter(degree))]
while todo:
 a=todo.pop()
 if a not in seen:seen.add(a);todo.extend(adj[a]-seen)
assert len(seen)==18
(p/'interface.json').write_text(json.dumps(interface,indent=2)+'\n')
r={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/shared-boundary-interface/author-interface.py','started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'authorSourceSHA256':sha(Path(__file__)),'interfaceSHA256':sha(p/'interface.json'),'positionSourceSHA256':sha(old),'nodes':len(nodes),'canonicalEdges':len(edges),'patches':40,'all160EdgeReferencesEndpointCompatible':sum(refs.values())==160,'sharedEdges':sum(x==2 for x in refs.values()),'outerEdges':sum(x==1 for x in refs.values()),'outerBoundaryNodes':18,'outerComponents':1,'status':'source graph/corner identities passed; generic exact Coons boundary cancellation specified; no surface/native/appearance'}
(p/'AUTHOR-RECEIPT.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
