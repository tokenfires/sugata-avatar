from pathlib import Path
import hashlib,json,struct,math,datetime,os,sys,collections
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume')
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
h=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
read=lambda path:json.loads(Path(path).read_text())
r=read(p/'BUILD-RECEIPT.json');s=read(p/'SUPERVISOR-RECEIPT.json');m=read(p/'mesh.json')
t=read('docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json')
assert h(p/'BUILD-RECEIPT.json')=='5d68a0fb6f509370cd46ce62a331105b06bf0a4c562681f729a2287ed6868057'
assert r['status']=='CPU passed; native/appearance not admitted by this result'
assert s['pass'] and s['workerRetired'] and not s['timedOut'] and s['workerExitCode']==0 and s['errors']==[]
assert s['innerReceipt']==h(p/'BUILD-RECEIPT.json') and s['sourceSHA256']==h(p/'build.mjs')
assert r['pid']==s['pid']==51009 and r['threadId']==s['workerThreadId']==1
assert datetime.datetime.fromisoformat(s['finished'])-datetime.datetime.fromisoformat(s['started'])<datetime.timedelta(seconds=120)
assert all(h(k)==v for k,v in r['pins'].items())
assert all(c['pass'] is True for c in r['checks'])
assert r['geometryCreated'] is True and r['geometryDisposed'] is True
assert len(r['geometryDisposalEvents'])==1 and r['geometryDisposalEvents'][0]['uuid']==r['geometryUUID']
assert r['started']<=r['geometryDisposalEvents'][0]['observed']<=r['finished']
assert m['vertices']==8091 and m['triangles']==16000 and m['subdivisions']==10
assert m['pointDefinitions']==t['vertices'] and m['keys']==[v['key'] for v in t['vertices']]
assert m['edgeCache']==t['canonicalEdgeCache'] and m['patches']==t['patches']
assert m['topologySHA256']==h('docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json')
assert m['interfaceSHA256']==h('docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json')
assert r['meshSHA256']==h(p/'mesh.json') and r['buffers']==m['buffers']
arrays={}
for info in m['buffers']:
 b=(p/info['name']).read_bytes();assert len(b)==info['bytes'] and h(p/info['name'])==info['sha256']==r['outputHashes'][info['name']]
 arrays[info['name']]=struct.unpack('<'+('I' if info['name'].endswith('.u32') else 'f')*(len(b)//4),b)
assert len(arrays)==3
P=arrays['positions.f32'];I=arrays['indices.u32'];Q=arrays['normals.f32']
assert len(P)==len(Q)==8091*3 and len(I)==16000*3
assert all(math.isfinite(x) for x in P+Q)
faces=[tuple(I[i:i+3]) for i in range(0,len(I),3)]
assert faces==[tuple(f) for f in t['faces']]
assert len(set(tuple(sorted(f)) for f in faces))==16000
xyz=lambda i:tuple(P[i*3:i*3+3])
areas=[];edges=collections.defaultdict(list)
for tid,ids in enumerate(faces):
 assert len(set(ids))==3 and all(0<=i<8091 for i in ids)
 a,b,c=map(xyz,ids);x=tuple(b[k]-a[k] for k in range(3));y=tuple(c[k]-a[k] for k in range(3))
 area=math.sqrt(sum(v*v for v in (x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0])))
 assert math.isfinite(area) and area>1e-12;areas.append(area)
 for j in range(3):edges[tuple(sorted((ids[j],ids[(j+1)%3])))].append((ids[j],ids[(j+1)%3]))
assert len(edges)==24090
assert all(len(v)==1 or len(v)==2 and v[0]==v[1][::-1] for v in edges.values())
assert sum(len(v)==1 for v in edges.values())==180 and 8091-len(edges)+16000==1
normResidual=max(abs(math.sqrt(sum(Q[i*3+k]**2 for k in range(3)))-1) for i in range(8091))
assert normResidual<1e-5
areaRows=[c for c in r['checks'] if c['name'].startswith('nondegenerate triangle ')]
assert len(areaRows)==16000
for tid,c in enumerate(areaRows):
 w=c['witness'];assert w['triangle']==tid and w['ids']==list(faces[tid]) and w['vertices']==[list(xyz(i)) for i in faces[tid]]
 assert w['keys']==[m['keys'][i] for i in faces[tid]] and abs(w['doubleArea']-areas[tid])<1e-15
minimum=min(range(16000),key=lambda i:areas[i]);assert minimum==r['minimumDoubleArea']['triangle']==14766
assert abs(areas[minimum]-r['minimumDoubleArea']['doubleArea'])<1e-15
selfRows=[c for c in r['checks'] if c['name']=='nonadjacent self-crossing']
assert len(selfRows)==r['selfPairs']['tested']==5161 and r['selfPairs']['pass'] is True
for c in selfRows:
 w=c['witness'];assert w['intersection'] is None and set(w['aIDs']).isdisjoint(w['bIDs'])
 for arm in ['a','b']:
  assert w[arm+'IDs']==list(faces[w[arm]]) and w[arm+'Vertices']==[list(xyz(i)) for i in faces[w[arm]]]
assert r['selfPairs']['omittedAdjacent']==110646
raw=r['rawBodyCrossings']
assert raw['epsilon']==1e-9 and raw['selectedHairTriangles']==16000 and raw['selectedBodyTriangles']==26756 and raw['candidatePairs']==25
for key in ['headBounds','faceBounds']:assert raw[key]=={'min':[None]*3,'max':[None]*3}
for key in ['head','face','headPairsWithoutFaceIntersection']:assert raw[key]['pairs']==0 and raw[key]['examples']==[]
assert raw['alpha']['enabled'] is False
glb=Path('assets/figures/figure_g050.glb').read_bytes();assert glb[:4]==b'glTF'
n=struct.unpack_from('<I',glb,12)[0];g=json.loads(glb[20:20+n])
body=next(mesh for mesh in g['meshes'] if mesh['name']=='base.001')['primitives'][0]
assert g['accessors'][body['indices']]['count']==26756*3
counts=dict(collections.Counter(c['name'].split(' ')[0] for c in r['checks']))
names=list(r['pins'])+[str(p/n) for n in ['BUILD-RECEIPT.json','SUPERVISOR-RECEIPT.json','mesh.json','positions.f32','indices.u32','normals.f32','critic-cpu-readback.py']]
out={'pid':os.getpid(),'command':'python3 '+str(p/'critic-cpu-readback.py'),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'interpreter':sys.executable,'pythonVersion':sys.version,'sourceSHA256':h(__file__),'status':'independent buffer/receipt readback passed','checksRead':len(r['checks']),'allRecordedChecksPassed':True,'evaluationCountsObserved':r['evaluations'],'buffersExact':True,'frozenDefinitionsAndFacesExact':True,'vertices':8091,'triangles':16000,'edges':24090,'outerEdges':180,'minimumDoubleArea':{'triangle':minimum,'ids':list(faces[minimum]),'value':areas[minimum]},'maximumNormalLengthResidual':normResidual,'selfRecorded':r['selfPairs'],'rawBodyRecorded':{'candidatePairs':25,'selectedBodyTriangles':26756,'pairs':0},'geometryDisposeEvent':r['geometryDisposalEvents'][0],'pins':{n:h(n) for n in names},'limits':['No surface/curve/evaluator/builder rerun.','Actual Float32 buffer arithmetic independently verified; self/raw-body intersection results source/receipt-reviewed and not recomputed.','No world-body, native image, containment, clearance, adjacent-fold, motion or AAA claim.']}
with (p/'CRITIC-CPU-READBACK.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in out.items() if k not in ['pins']},indent=2))
