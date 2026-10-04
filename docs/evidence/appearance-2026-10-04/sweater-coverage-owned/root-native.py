"""Independent native saved-data replay: ordinary source diagnostic arrays only."""
from pathlib import Path
import hashlib,json,math,struct,datetime,os
H=Path(__file__).resolve().parent;R=H.parents[3]
d=json.loads((H/'PARTITION.json').read_text());ledger=json.loads((R/d['policy']['ledger']['path']).read_text())
observed=json.loads((H/'OBSERVATIONS.json').read_text())
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def digest(a):return hashlib.sha256(struct.pack('<'+'f'*len(a),*a)).hexdigest()
def world(owner,tid,b):
 ids=owner['triangles'][tid];out=[]
 for k in range(3):
  value=0.
  for j in range(3):value+=b[j]*owner['worldPositions'][ids[j]][k]
  out.append(value)
 return out
def normals(a):
 out=[]
 for i in range(0,len(a),9):
  ab=[a[i+j]-a[i+3+j] for j in range(3)];cb=[a[i+6+j]-a[i+3+j] for j in range(3)]
  v=[f32(cb[1]*ab[2]-cb[2]*ab[1]),f32(cb[2]*ab[0]-cb[0]*ab[2]),f32(cb[0]*ab[1]-cb[1]*ab[0])]
  length=math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]) or 1.
  # Vector3.divideScalar multiplies by reciprocal, rather than divides components.
  inv=1./length;n=[f32(x*inv) for x in v];out+=n*3
 return out
unit=[[1,0,0],[0,1,0],[0,0,1]];groups=[];boundary=[];buffers=[]
for p,owner in zip(d['owners'],ledger['owners']):
 arrays={'required':[],'exposed':[]}
 def append(tid,poly,kind):
  pts=[world(owner,tid,b) for b in poly]
  for j in range(1,len(pts)-1):arrays[kind]+=pts[0]+pts[j]+pts[j+1]
 for tid in p['required']:append(tid,unit,'required')
 for ids in p['exposed'].values():
  for tid in ids:append(tid,unit,'exposed')
 for c in p['cut']:
  append(c['id'],c['required'],'required')
  for e in c['exposed']:append(c['id'],e['polygon'],'exposed')
  if owner['key']=='body' and owner['name']=='Human':
   for t in c['traces']:
    for j in range(1,len(t['polygon'])):boundary+=world(owner,c['id'],t['polygon'][j-1])+world(owner,c['id'],t['polygon'][j])
 for tid in p['degenerate']:append(tid,unit,'exposed')
 for kind,positions in arrays.items():
  if not positions:continue
  a=[f32(x) for x in positions];buffers.append(a)
  groups.append({'uuid':p['uuid'],'kind':kind,'vertices':len(a)//3,'triangles':len(a)//9,'positionsSHA256':digest(a),'normalsSHA256':digest(normals(a))})
assert len(groups)==len(observed['groups'])
for expected,actual in zip(groups,observed['groups']):
 assert all(actual[k]==v for k,v in expected.items()),(expected,actual)
 assert actual['side']==2 and actual['matrix']==[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
assert digest([f32(x) for x in boundary])==observed['boundary']['positionsSHA256']
assert len(boundary)//6==observed['boundary']['segments']
assert observed['draws'][0]['cameraIndices']==[0,1] and observed['draws'][1]['cameraIndices']==[0,2] and len(observed['draws'])==2
assert observed['bounds']==ledger['bounds'] and observed['framing']['sourceVertexCount']==39546
assert all(c['pass'] for c in observed['clip'])
assert all(row.get('returned') and not row.get('error') for row in observed['disposals'])
pins=json.loads((H/'NATIVE-INPUTS.json').read_text())
for expected,actual in zip(pins.values(),observed['inputs']):
 assert actual['url']==expected['url'] and actual['observedBytes']==expected['bytes'] and actual['observedSHA256']==expected['sha256'] and actual['status']==200
assert observed['status']=='ready' and observed['cleanupReason']=='explicit Finish' and len(observed['owners'])==9
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'result':'A saved diagnostic geometry ownership only','groups':groups,'boundarySegments':len(boundary)//6,'allFloat32PositionsAndStandardNormalsHashesMatch':True,'inputs':{n:pin(H/n) for n in ['PARTITION.json','OBSERVATIONS.json','NATIVE-INPUTS.json','root-native.py']},'limits':'Image readability reviewed separately; recorded clip flags not independently replayed here; no source GPU equivalence or post-close allocator ledger.'}
(H/'ROOT-NATIVE.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items() if k!='groups'}))
