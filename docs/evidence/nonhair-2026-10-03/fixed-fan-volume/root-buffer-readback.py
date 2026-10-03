"""Saved actual arrays/receipt readback; no surface or crossing re-evaluation."""
from pathlib import Path
import json,hashlib,struct,math,os,datetime
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume');start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest()
r=json.loads((p/'BUILD-RECEIPT.json').read_text());s=json.loads((p/'SUPERVISOR-RECEIPT.json').read_text());m=json.loads((p/'mesh.json').read_text());t=json.loads(Path('docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json').read_text())
assert r['status']=='CPU passed; native/appearance not admitted by this result'and s['pass']and s['workerRetired']and not s['timedOut']and s['workerExitCode']==0 and not s['errors']
assert s['innerReceipt']==sha(p/'BUILD-RECEIPT.json')and s['sourceSHA256']==r['pins'][str(p/'build.mjs')]
for n,h in r['pins'].items():assert sha(n)==h,n
for n,h in r['outputHashes'].items():assert sha(p/n)==h,n
assert m['vertices']==8091 and m['triangles']==16000 and m['pointDefinitions']==t['vertices']and m['keys']==[v['key']for v in t['vertices']]and m['edgeCache']==t['canonicalEdgeCache']and m['patches']==t['patches']
assert m['interfaceSHA256']==t['sourceInterface']['sha256']and m['topologySHA256']==sha('docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json')
arrays={}
for b in m['buffers']:
 data=(p/b['name']).read_bytes();assert len(data)==b['bytes']and sha(p/b['name'])==b['sha256'];arrays[b['name']]=struct.unpack('<'+('I'if b['name'].endswith('.u32')else'f')*(len(data)//4),data)
P=arrays['positions.f32'];N=arrays['normals.f32'];I=arrays['indices.u32']
assert len(P)==len(N)==8091*3 and len(I)==16000*3 and list(I)==[i for f in t['faces']for i in f]
assert all(math.isfinite(v)for v in P+N)and all(abs(math.hypot(*N[i:i+3])-1)<1e-5 for i in range(0,len(N),3))
assert all(c['pass']for c in r['checks'])
values=[c['witness']for c in r['checks']if c['name'].startswith('finite Float64 evaluation ')]
assert len(values)==8091
for i,w in enumerate(values):
 assert w['id']==i and w['key']==t['vertices'][i]['key']and w['evaluation']==t['vertices'][i]['evaluation']
 assert tuple(struct.unpack('<f',struct.pack('<f',v))[0]for v in w['value'])==P[3*i:3*i+3]
assert r['geometryCreated']and r['geometryDisposed']and len(r['geometryDisposalEvents'])==1 and r['geometryDisposalEvents'][0]['uuid']==r['geometryUUID']
assert r['selfPairs']['pass']and r['rawBodyCrossings']['head']['pairs']==0 and r['rawBodyCrossings']['selectedHairTriangles']==16000 and r['rawBodyCrossings']['selectedBodyTriangles']==26756
assert all(x is None for b in ['headBounds','faceBounds']for k in ['min','max']for x in r['rawBodyCrossings'][b][k])
w=r['minimumDoubleArea'];assert list(I[3*w['triangle']:3*w['triangle']+3])==w['ids']and [list(P[3*i:3*i+3])for i in w['ids']]==w['vertices']
receipt={'pid':os.getpid(),'command':'python3 '+str(p/'root-buffer-readback.py'),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':sha(p/'root-buffer-readback.py'),'buildSHA256':sha(p/'BUILD-RECEIPT.json'),'supervisorSHA256':sha(p/'SUPERVISOR-RECEIPT.json'),'inputPins':len(r['pins']),'checksPassed':len(r['checks']),'allSavedBuffersExact':True,'all8091StoredFloat64RecordsConvertExactlyOnceToSavedFloat32':True,'all16000FacesExact':True,'normalUnitTolerance':1e-5,'actualMatchingGeometryDisposalEvent':True,'selfPairs':r['selfPairs'],'rawBodyPairs':0,'minimumAreaWitnessExact':True,'status':'saved-array/readback and retired CPU gates qualified; conditional native only','limits':'No curve/surface/position/crossing re-evaluation; no adjacent-fold/containment/clearance/native/appearance/motion proof'}
(p/'ROOT-BUFFER-READBACK.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
