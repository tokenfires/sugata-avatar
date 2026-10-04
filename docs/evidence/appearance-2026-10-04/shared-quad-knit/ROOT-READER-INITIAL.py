"""Independent saved native operand reader; no Three import or rendering."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,math,os,struct
p=Path(__file__).resolve().parent;root=p.parents[3]
def load(n):return json.loads((p/n).read_text())
def pin(q):
 b=q.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
def invert(flat):
 a=[[flat[4*j+i] for j in range(4)]+[float(i==j) for j in range(4)] for i in range(4)]
 for i in range(4):
  k=max(range(i,4),key=lambda k:abs(a[k][i]));a[i],a[k]=a[k],a[i];d=a[i][i];assert abs(d)>1e-20;a[i]=[v/d for v in a[i]]
  for j in range(4):
   if j!=i:
    d=a[j][i];a[j]=[v-d*w for v,w in zip(a[j],a[i])]
 return [a[i][4+j] for j in range(4) for i in range(4)]
def mv(m,v):return [sum(m[4*j+i]*v[j] for j in range(4)) for i in range(4)]
o=load('OBSERVATIONS.json');job=load('NATIVE-JOB.json');mesh=load('mesh.json');old=json.loads((p.parent/'source-rest-addressed/OBSERVATIONS.json').read_text());r={'started':datetime.now(timezone.utc).isoformat(),'pid':os.getpid(),'savedOnly':True,'pins':{n:pin(p/n) for n in ['OBSERVATIONS.json','NATIVE-JOB.json','CONSOLE.json','front-oblique.jpg','front-back.jpg','mesh.json','NATIVE-SOURCE.md','NATIVE-INPUTS.json','viewer.mjs','index.html']}}
for name,w in load('NATIVE-INPUTS.json')['files'].items():assert pin(root/name)==w
assert o['status']=='ready' and len(o['sources'])==3 and len(o['draws'])==2 and job['readyWaits']==1 and job['readyWait']=='returned' and job['originalCaptures']==2 and job['tabId']=='30'
assert o['garmentDocument']==mesh and o['garmentInput']['observedBytes']==92038 and o['garmentInput']['observedSHA256']==pin(p/'mesh.json')['sha256'] and o['garmentInput']['httpStatus']==200
assert all(x['observedBytes']==x['bytes'] and x['observedSHA256']==x['sha256'] and x['httpStatus']==200 and x['parseCompleted']>=x['parseStarted'] for x in o['inputs'])
nodeFields=['name','type','association','position','quaternion','scale','matrix','world'];meshFields=['name','association','skinned','vertexCount','originalMorphInfluences','zeroMorphInfluences','bind','bindInverse'];bonesFields=['name','association','world','inverseBind'];counts={};nodes=0;bones=0
for new,prior in zip(o['sources'],old['sources']):
 assert new['key']==prior['key'] and new['rawDocument']==prior['rawDocument'] and len(new['nodes'])==len(prior['nodes']) and len(new['meshes'])==len(prior['meshes'])
 for a,b in zip(new['nodes'],prior['nodes']):assert all(a[k]==b[k] for k in nodeFields);nodes+=1
 for a,b in zip(new['meshes'],prior['meshes']):
  assert all(a[k]==b[k] for k in meshFields) and len(a['bones'])==len(b['bones']) and all(v==0 for v in a['zeroMorphInfluences'])
  for aa,bb in zip(a['bones'],b['bones']):assert all(aa[k]==bb[k] for k in bonesFields);bones+=1
 counts[new['key']]=sum(x['skinned'] for x in new['meshes'])
assert counts=={'body':7,'bra':1,'briefs':1} and nodes==171 and bones==477
ref=next(m for s in o['sources'] for m in s['meshes'] if m['uuid']==o['referenceUUID']);refs={b['name']:b for b in ref['bones']};assert len(refs)==53
recomputed=0;maxDelta=0
for s in o['sources']:
 for m in s['meshes']:
  if not m['skinned']:continue
  row=next(v for v in o['comparisons'] if v['meshUUID']==m['uuid']);assert row['pass'] and row['unique'] and not row['missing'] and not row['extra'] and {b['name'] for b in m['bones']}==set(refs)
  for b in m['bones']:
   x=next(x for x in row['bones'] if x['name']==b['name']);assert x['pass']
   for field,key in [('world','world'),('inverseBind','inverseBind')]:
    a=b[field];z=refs[b['name']][field];translation=math.sqrt(sum((a[i]-z[i])**2 for i in [12,13,14]));linear=max(abs(a[i]-z[i]) for i in [0,1,2,4,5,6,8,9,10]);assert abs(translation-x[key]['translation'])<1e-14 and linear==x[key]['linear'];maxDelta=max(maxDelta,translation,linear)
   recomputed+=1
assert recomputed==477 and maxDelta==0
assert o['framing']==old['framing'];assert o['cameras'][:2]==old['cameras'];assert len(o['cameras'])==3
g=o['garmentDrawSource'];identity=[float(i%5==0) for i in range(16)];assert g['matrix']==g['matrixWorld']==identity and g['position']==[0,0,0] and g['quaternion']==[0,0,0,1] and g['scale']==[1,1,1]
assert g['positionsFloat32']==[f32(x) for v in mesh['vertices'] for x in v];assert g['indices']==[v for f in mesh['quads'] for v in [f[0],f[1],f[2],f[0],f[2],f[3]]] and len(g['indices'])==3264
assert len(g['normalsFloat32'])==1770 and all(math.isfinite(v) for v in g['normalsFloat32']);assert g['material']=={'color':0x9bb4c8,'side':0,'roughness':1,'metalness':0}
clipResidual=0;ndc=[]
for i,camera in enumerate(o['cameras']):
 inv=invert(camera['matrixWorld']);values=[]
 for j in range(590):
  P=g['positionsFloat32'][3*j:3*j+3]+[1];Q=mv(camera['projection'],mv(inv,P));v=[Q[k]/Q[3] for k in range(3)];assert abs(v[0])<=.97 and abs(v[1])<=.97 and -1<=v[2]<=1;values.append(v)
 mn=[min(v[k] for v in values) for k in range(3)];mx=[max(v[k] for v in values) for k in range(3)];row=o['garmentClip'][i];assert row['camera']==i and row['vertices']==590 and row['pass'] and row['xyLimit']==.97 and row['depthLimits']==[-1,1]
 clipResidual=max(clipResidual,*[abs(a-b) for a,b in zip(mn+mx,row['minimumNDC']+row['maximumNDC'])]);ndc.append({'camera':i,'min':mn,'max':mx})
assert clipResidual<1e-12
for draw,mode,indices in zip(o['draws'],['Front/Oblique','Front/Back'],[[0,1],[0,2]]):
 assert draw['mode']==mode and draw['cameraIndices']==indices and draw['garmentVisible'] and len(draw['rootVisibility'])==3 and all(v['visible'] for v in draw['rootVisibility'])
 assert draw['cameraMatrices']==[{'world':o['cameras'][i]['matrixWorld'],'projection':o['cameras'][i]['projection']} for i in indices]
assert o['cleanupReason']=='explicit Finish reference' and len(o['disposals'])==33 and all(v.get('attempted') and v.get('returned') and not v.get('error') for v in o['disposals'])
assert {v['id'] for v in job['tabsBefore']}=={v['id'] for v in job['tabsAfter']}=={'1','24','25','26','27','28'} and job['closeReturnedUTC']>job['closeRequestedUTC']
assert pin(p/'OBSERVATIONS.json')=={'bytes':job['observationsBytes'],'sha256':job['observationsSHA256']}
for label,name in [('firstImage','front-oblique.jpg'),('secondImage','front-back.jpg')]:assert pin(p/name)==job[label]
from PIL import Image
for name in ['front-oblique.jpg','front-back.jpg']:
 with Image.open(p/name) as im:assert im.size==(1280,838) and im.format=='JPEG'
r.update({'completed':datetime.now(timezone.utc).isoformat(),'originalSourceNodeOperandEquality':nodes,'sourceOwnerCounts':counts,'recomputedNamedComparisons':recomputed,'maximumNamedDelta':maxDelta,'sourceFramingAndFrontObliqueMatricesUnchanged':True,'candidateFloat32PositionAndIndexExact':True,'candidateWorldIdentity':True,'clipMaxDifference':clipResidual,'all590VerticesThreeCamerasNDC':ndc,'draws':2,'disposalAttemptsReturned':33,'knownOwnedTabClosed':True,'existingTabsPreserved':True,'decision':'A observed operand identity; B actual rear appearance, independently viewed full originals','visualWitness':'Back beige shoulder strips and upperarm/elbow patches, teal strap edges interrupt sweater. Front continuity is artist scaffold utility, not contextual acceptance. No exclusive cause or physical clearance diagnosis from pixels.','limits':'Numerical data supports rendered originals; no clearance/contact/coverage,morph/pose/motion/material qualification or post-closeGPUmemoryclaim'})
(p/'ROOT-OBSERVATION.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k] for k in ['pid','completed','sourceOwnerCounts','recomputedNamedComparisons','clipMaxDifference','disposalAttemptsReturned','decision']}))
