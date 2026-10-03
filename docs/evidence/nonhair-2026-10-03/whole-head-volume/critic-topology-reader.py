"""Read-only cache/key/index forensics. Never reads P vectors or evaluates curves/surfaces."""
from pathlib import Path
import json, hashlib, datetime, os, sys, collections
p=Path(__file__).parent
start=datetime.datetime.now(datetime.UTC).isoformat()
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
build=json.loads((p/'BUILD-RECEIPT.json').read_text())
supervisor=json.loads((p/'SUPERVISOR-RECEIPT.json').read_text())
assert sha(p/'BUILD-RECEIPT.json')=='2c3523941089801e9130740721c153ff3bc1eaee017b9fa3b5ae945064ddd271'
assert supervisor['innerReceipt']==sha(p/'BUILD-RECEIPT.json')
assert supervisor['pass'] is False and supervisor['workerRetired'] is True and supervisor['workerExitCode']==2
assert supervisor['timedOut'] is False and supervisor['errors']==[]
assert build['status']=='refused' and build['geometryDisposed'] is False and build['outputHashes']=={}
assert len(build['checks'])==13859
assert [c for c in build['checks'] if not c['pass']]==[{'name':'unique triangle 4618','pass':False,'witness':{}}]
for f,h in build['pins'].items():assert sha(f)==h,(f,h)
netpath=Path('docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json')
net=json.loads(netpath.read_text())
# Only endpoint IDs and cache ownership: no node positions, M vectors or interior evaluation.
N=10; cache={};edges={}
for eid,e in net['edges'].items():
 row=[]
 for k in range(N+1):
  key='node:'+e['endpoints'][0] if k==0 else 'node:'+e['endpoints'][1] if k==N else eid+':'+str(k)
  if key not in cache:cache[key]=len(cache)
  row.append(key)
 edges[eid]=row
assert len(cache)==851
def key(q,r,c):
 border=[]
 for condition,name,k in [(r==0,'south',c),(r==N,'north',c),(c==0,'west',r),(c==N,'east',r)]:
  if condition:
   ref=q[name];assert ref['orientation'] in (1,-1)
   border.append(edges[ref['id']][k if ref['orientation']==1 else N-k])
 if border:
  assert all(x==border[0] for x in border)
  return border[0]
 return q['id']+':'+str(r)+':'+str(c)
seen={};counter=0;failure=None
for side,panel in net['panels'].items():
 for q in panel['patches']:
  for r in range(N):
   for c in range(N):
    a,b,z,d=key(q,r,c),key(q,r,c+1),key(q,r+1,c+1),key(q,r+1,c)
    faces=[(a,b,z),(a,z,d)] if panel['futureOrientationSign']==1 else [(a,z,b),(a,d,z)]
    for half,ordered in enumerate(faces):
     row={'triangle':counter,'panel':side,'patch':q['id'],'quad':[r,c],'half':half,'orderedKeys':list(ordered)}
     unique=tuple(sorted(ordered))
     if unique in seen:
      failure={'first':seen[unique],'duplicate':row,'sortedKeys':list(unique)};break
     seen[unique]=row;counter+=1
    if failure:break
   if failure:break
  if failure:break
 if failure:break
assert failure['first']['triangle']==618 and failure['duplicate']['triangle']==4618
assert failure['first']['patch']=='minusX:0:3' and failure['duplicate']['patch']=='plusX:0:3'
assert failure['first']['quad']==failure['duplicate']['quad']==[0,9]
for row in (failure['first'],failure['duplicate']):row['cacheIDs']=[cache[k] for k in row['orderedKeys']]
assert failure['first']['orderedKeys']==[failure['duplicate']['orderedKeys'][0],failure['duplicate']['orderedKeys'][2],failure['duplicate']['orderedKeys'][1]]
assert set(failure['sortedKeys'])=={'edge:part-3|part-4:9','node:part-4','edge:back-1|part-4:1'}
missing=['mesh.json','positions.f32','indices.u32','normals.f32']
assert all(not (p/name).exists() for name in missing)
assert not Path('captures/whole-head-volume-2026-10-03-v1').exists()
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/whole-head-volume/critic-topology-reader.py','pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.UTC).isoformat(),'interpreter':sys.executable,'pythonVersion':sys.version,'sourceSHA256':sha(__file__),'buildReceiptSHA256':sha(p/'BUILD-RECEIPT.json'),'supervisorReceiptSHA256':sha(p/'SUPERVISOR-RECEIPT.json'),'allBuildPinsUnchanged':len(build['pins']),'checksRead':len(build['checks']),'forensicFirstDuplicate':failure,'edgeCacheRecords':len(cache),'absentExportFiles':missing,'nativeOutputDirectoryAbsent':True,'scope':'Semantic cache/key/index reconstruction only, through first duplicate; no coordinates/curves/interiors/areas/contact/renderer evaluated and no candidate written'}
with (p/'CRITIC-TOPOLOGY-READBACK.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps(receipt))
