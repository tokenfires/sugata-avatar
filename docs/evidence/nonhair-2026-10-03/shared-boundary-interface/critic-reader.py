"""Independent source-interface readback; no edge/surface samples or geometry."""
from pathlib import Path
import json, hashlib, os, sys, datetime, math, collections
p=Path(__file__).parent
start=datetime.datetime.now(datetime.UTC).isoformat()
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
j=json.loads((p/'interface.json').read_text())
old=Path(j['positionSource']['path']); n=json.loads(old.read_text())
assert sha(old)==j['positionSource']['sha256']=='ee2808f9c4c2a04d6582beee454786dde2c3303e91430a9f259d1158a4982936'
assert sha(p/'interface.json')=='e734947c8e594b7396bf5f4359c0979b569d9ead92554a9b9a3d656b69248c2c'
assert sha(p/'author-interface.py')=='ac9c7e42d558dc9b3b3b2aecef2a0a563152e37a5d10598c0c5ab0fa90da5e96'
assert j['coordinateFrame']==n['coordinateFrame'] and j['attachment']==n['attachment'] and j['roles']==n['responsibilities']
assert sha(j['coordinateFrame']['asset'])==j['coordinateFrame']['sha256']
hair=Path('packages/core/src/motion/HairSkinTransform.js')
assert sha(hair)=='8bb7137ac68b88c8a2fe213f34757d44f5b6addf0b63141f29f98ab3ac4adf7e'
P={}
for panel in n['panels'].values():
 for row in panel['nodes']:
  for a in row:
   assert a['id'] not in P or P[a['id']]==a['P']
   P[a['id']]=a['P']
assert P==j['nodes'] and len(P)==50
back=[n['panels']['minusX']['nodes'][r][4] for r in range(6)]
jets=[]
for r in range(6):
 lo=max(0,r-1); hi=min(5,r+1)
 v=[(back[hi]['P'][k]-back[lo]['P'][k])/(n['v'][hi]-n['v'][lo]) for k in range(3)]
 v[0]=(back[1]['P'][0]-back[0]['P'][0])/(n['v'][1]-n['v'][0]) if r==0 else 0
 jets.append(v)
assert jets==j['backPolicy']['globalDerivativeVectors']
uses=collections.Counter(); expected_outer=set(); checked_edges=set(); proofs=0
for side,panel in n['panels'].items():
 a=panel['nodes']; patches=j['panels'][side]['patches']
 assert len(patches)==20 and j['panels'][side]['futureOrientationSign']==(1 if side=='minusX' else -1)
 for patch in patches:
  r,c=patch['grid']; assert patch['id']==f'{side}:{r}:{c}'
  corners={'P00':a[r][c]['id'],'P10':a[r][c+1]['id'],'P01':a[r+1][c]['id'],'P11':a[r+1][c+1]['id']}
  assert patch['corners']==corners
  spans={'south':(a[r][c],a[r][c+1],'du',n['u'][c+1]-n['u'][c],None),'north':(a[r+1][c],a[r+1][c+1],'du',n['u'][c+1]-n['u'][c],None),'west':(a[r][c],a[r+1][c],'dv',n['v'][r+1]-n['v'][r],r if c==4 else None),'east':(a[r][c+1],a[r+1][c+1],'dv',n['v'][r+1]-n['v'][r],r if c+1==4 else None)}
  for name,(x,y,key,width,bi) in spans.items():
   ref=patch[name]; eid='edge:'+'|'.join(sorted((x['id'],y['id']))); e=j['edges'][eid]
   assert ref['id']==eid and ref['orientation']==1 and ref['parameter']=='local0..1 along stored endpoints; reverse requests use1-t'
   assert e['endpoints']==[x['id'],y['id']] and e['localParameter']==[0,1]
   assert e['M0']==[v*width for v in (x[key] if bi is None else jets[bi])]
   assert e['M1']==[v*width for v in (y[key] if bi is None else jets[bi+1])]
   assert all(math.isfinite(v) for k in ('M0','M1') for v in e[k])
   assert e['policy']==('new common entire back trace' if bi is not None else 'literal authored guide derivative scaled to local edge parameter')
   uses[eid]+=1;checked_edges.add(eid)
   if (name=='west' and c==0) or (name=='north' and r==4): expected_outer.add(eid)
  # Exact polynomial residual of the two endpoint terms minus bilinear corner correction.
  for ends in [('P00','P10'),('P01','P11'),('P00','P01'),('P10','P11')]:
   residual=collections.Counter()
   for sign in (1,-1):
    residual[(corners[ends[0]],0)]+=sign;residual[(corners[ends[0]],1)]-=sign;residual[(corners[ends[1]],1)]+=sign
   assert not any(residual.values());proofs+=1
assert len(j['edges'])==89 and checked_edges==set(j['edges']) and sum(uses.values())==160
assert collections.Counter(uses.values())=={2:71,1:18}
outer={k for k,v in uses.items() if v==1};assert outer==expected_outer
adj=collections.defaultdict(set)
for eid in outer:
 x,y=j['edges'][eid]['endpoints'];adj[x].add(y);adj[y].add(x)
assert len(adj)==18 and all(len(v)==2 for v in adj.values())
seen=set();todo=[next(iter(adj))]
while todo:
 a=todo.pop()
 if a not in seen:seen.add(a);todo.extend(adj[a]-seen)
assert len(seen)==18
first=j['edges']['edge:back-1|part-4'];assert uses['edge:back-1|part-4']==2 and first['M0'][0]==-.018 and first['M1'][0]==0
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/shared-boundary-interface/critic-reader.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':sys.version,'started':start,'finished':datetime.datetime.now(datetime.UTC).isoformat(),'sourceSHA256':sha(__file__),'pins':{str(f):sha(f) for f in (p/'interface.json',p/'author-interface.py',old,hair,Path(j['coordinateFrame']['asset']))},'all50OriginalPositionsExact':True,'all89CurveDeclarationsRead':True,'all40PatchCornersAnd160ReferencesExact':True,'canonicalSharedEdges':71,'outerEdges':18,'outerCycleNodes':18,'outerRoles':'ten opening/front edges plus eight hem edges','backDerivativesExact':True,'boundaryPolynomialResiduals':proofs,'firstBackLocalTangents':[first['M0'],first['M1']],'result':'PASS source C0 interface only; no surface/edge sampling, regularity, geometry, native or appearance inference'}
with (p/'CRITIC-READBACK.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps(receipt))
