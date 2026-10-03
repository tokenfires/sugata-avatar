"""Index-only forensic readback; no curve/P/interior/surface evaluation or builder rerun."""
from pathlib import Path
import json,hashlib,datetime,os
p=Path('docs/evidence/nonhair-2026-10-03/whole-head-volume');start=datetime.datetime.now(datetime.timezone.utc).isoformat();h=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
b=json.loads((p/'BUILD-RECEIPT.json').read_text());s=json.loads((p/'SUPERVISOR-RECEIPT.json').read_text())
assert h(p/'BUILD-RECEIPT.json')=='2c3523941089801e9130740721c153ff3bc1eaee017b9fa3b5ae945064ddd271'==s['innerReceipt']
assert b['status']=='refused' and s['pass']==False and s['workerRetired'] and not s['timedOut'] and s['workerExitCode']==2
assert b['geometryDisposed']==False and b['outputHashes']=={}
assert [x['name']for x in b['checks']if not x['pass']]==['unique triangle 4618']
for name,sha in b['pins'].items():assert h(Path(name))==sha,name
x=json.loads(Path('docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json').read_text());cache={};edgeIds={}
for eid,e in x['edges'].items():
 edgeIds[eid]=[]
 for k in range(11):
  key='node:'+e['endpoints'][0]if k==0 else 'node:'+e['endpoints'][1]if k==10 else eid+':'+str(k)
  if key not in cache:cache[key]=len(cache)
  edgeIds[eid].append(cache[key])
ids=[edgeIds['edge:part-3|part-4'][9],cache['node:part-4'],edgeIds['edge:back-1|part-4'][1]]
rows=[]
for side in ['minusX','plusX']:
 panel=x['panels'][side];q=panel['patches'][3];assert q['id']==side+':0:3' and q['grid']==[0,3]
 assert q['south']['id']=='edge:part-3|part-4' and q['east']['id']=='edge:back-1|part-4' and q['south']['orientation']==q['east']['orientation']==1
 assert q['corners']['P10']=='part-4';ordinal=0 if side=='minusX'else 1;triangle=ordinal*20*200+3*200+9*2
 order=ids if panel['futureOrientationSign']==1 else [ids[0],ids[2],ids[1]]
 rows.append({'patch':q['id'],'cell':[0,9],'triangle':triangle,'indices':order,'sortedKey':sorted(order),'boundaryKeys':['edge:part-3|part-4:9','node:part-4','edge:back-1|part-4:1']})
assert rows[0]['triangle']==618 and rows[1]['triangle']==4618 and rows[0]['sortedKey']==rows[1]['sortedKey'] and len(set(ids))==3
assert all(next(c for c in b['checks']if c['name']==name)['pass']for name in ['unique triangle 618','triangle index/distinct 4618','nondegenerate triangle 4618'])
r={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/whole-head-volume/root-witness.py','started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':h(Path(__file__)),'buildReceiptSHA256':h(p/'BUILD-RECEIPT.json'),'supervisorSHA256':h(p/'SUPERVISOR-RECEIPT.json'),'pinsUnchanged':len(b['pins']),'witness':rows,'status':'duplicate opposite-wound shared-corner triangle independently reconstructed from exact source ordering; executed gate refusal agrees','limits':['Index-only forensic reconstruction; no curve, position, full mesh or interior evaluation.','No geometry/normal/intersection/native/appearance pass; original runtime packed buffers were not exported.','This specific fixed-diagonal ownership failure does not refute the C0 function interface.']}
(p/'ROOT-WITNESS.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
