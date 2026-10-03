"""Read-only audit of a refused sampling packet; no renderer or image generation."""
from pathlib import Path
import hashlib,json,math,os,sys,datetime,copy
ROOT=Path('/Users/robault/GitHub/sugata-avatar')
OUT=ROOT/'docs/evidence/nonhair-2026-10-03/hair-sampling-value'
RAW=ROOT/'captures/hair-input-resolution-2026-10-03-v1'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((RAW/'report.json').read_text())
assert digest(RAW/'report.json')=='6547b61b58ce5bb56f906cd76bd53af77da8f1503975b65ae54f151cd321f7ad'
assert r['status']=='failed' and r['pid']==94730 and len(r['cases'])==1
assert len(r['errors'])==1 and 'jitterIndex: 4' in r['errors'][0] and 'jitterIndex: 3' in r['errors'][0]
c=r['cases'][0];assert c['scale']==.66 and c['images']==[]
assert not list(RAW.glob('*.png')) and 'retirement' not in c and 'commonStateExact' not in r
assert r['failureRetirement']=={'disposed':True,'leaked':[]}
assert r['cleanup']=={'page':'closed','browser':'closed'} and r['finalPinsUnchanged'] is True
assert r['borrowedReviewServerRetained'] is True
assert r['started']=='2026-10-03T12:10:40.896Z' and r['finished']=='2026-10-03T12:10:46.558Z'
assert datetime.datetime.fromisoformat(r['finished'].replace('Z','+00:00'))<datetime.datetime.fromisoformat(r['stop'].replace('Z','+00:00'))
pins={**r['sources'],**r['dependencies']}
for p,h in pins.items():assert digest(ROOT/p)==h,(p,h,digest(ROOT/p))
source=(RAW/'instrument.mjs').read_bytes()
assert hashlib.sha256(source).hexdigest()==r['instrumentSHA256']=='a8c284224f027ec3c1863b21f287fbf22069c8de595fe19cad65e2ffdaeac288'
assert source==(ROOT/'tools/critic/hair-input-resolution.mjs').read_bytes()
assert source.count(b"stop='2026-10-03T12:30:00Z'")==1
original=source.replace(b"stop='2026-10-03T12:30:00Z'",b"stop='2026-10-03T12:20:00Z'",1)
assert hashlib.sha256(original).hexdigest()=='860f1d38c0800e3be4145cea454f10505f96dd3118758661bb792cc366a4e763'
d=json.loads((OUT/'deadline-only.json').read_text())
assert d['originalSHA256']==hashlib.sha256(original).hexdigest() and d['revisedSHA256']==hashlib.sha256(source).hexdigest()
assert d['reverseByteEquality'] and d['nativeOutputAbsent']
assert digest(OUT/'EXECUTION-PLAN.md')==d['planSHA256']
expected={'frame':'portrait','hair':'bob02','hairColour':'#413934','identity':{'gender':.5,'mode':'nearest'},'lighting':'neutral','pose':'relaxed-standing','quality':'balanced','scene':'studio','seed':20260807,'wardrobe':{'foundation':{'HIPS':'foundation_briefs','TORSO':'foundation_bra'},'outfit':['female_casualsuit01','shoes01'],'style':'ecru'}}
assert c['expected']==expected
states=[c['setup']['state'],c['final'],c['encoding']['before'],c['encoding']['after']]
def finite(o):
 if isinstance(o,float):assert math.isfinite(o)
 elif isinstance(o,dict):
  for v in o.values():finite(v)
 elif isinstance(o,list):
  for v in o:finite(v)
finite(r)
def decode(h):
 v=[int(h[i:i+2],16)/255 for i in (1,3,5)]
 return [x*.0773993808 if x<.04045 else (x*.9478672986+.0521327014)**2.4 for x in v]
max_projection=0.;max_world=0.;max_dither=0.
for s in states:
 assert s['configuration']==expected and s['canvas']==[900,850,900,850]
 cam=s['camera'];assert cam['view']['enabled'] is False and cam['aspect']==900/850
 assert s['rendering']['passDimensions']==[594,561] and s['rendering']['passScale']==.66
 assert s['rendering']['stats']['backend']=='webgpu' and s['rendering']['stats']['temporalAA']=='taau'
 assert s['rendering']['stats']['ambientOcclusion']=='off' and s['report']['quality']['tier']=='balanced'
 assert s['report']['hair']['loadedStyle']=='bob02' and s['report']['hair']['colour']['matchesAttached'] is True
 assert s['report']['hair']['colour']['applied']=='#413934' and s['report']['hair']['colour']['appliedTint'] is None
 assert s['report']['wardrobe']['appearance']['attached'] is True and s['report']['wardrobe']['appearance']['style']=='ecru'
 assert max(abs(a-b) for a,b in zip(decode('#413934'),s['report']['hair']['colour']['linear']))<1e-15
 assert s['uniforms']['baseColour']==s['report']['hair']['colour']['linear']
 assert s['physical']['clock']==s['physical']['motion']==0
 clock=s['rendering']['clock'];assert clock['time']==clock['deltaTime']==0
 golden=(math.sqrt(5)-1)/2;expected_dither=(clock['frameId']*golden)%1
 max_dither=max(max_dither,abs(expected_dither-s['material']['ditherOffset']))
 n,f=cam['near'],cam['far'];y=cam['zoom']/math.tan(math.radians(cam['fov'])/2);x=y/cam['aspect']
 projection=[x,0,0,0,0,y,0,0,0,0,f/(n-f),-1,0,0,f*n/(n-f),0]
 max_projection=max(max_projection,max(abs(a-b) for a,b in zip(projection,cam['projection'])))
 qx,qy,qz,qw=cam['quaternion'];px,py,pz=cam['position']
 world=[1-2*(qy*qy+qz*qz),2*(qx*qy+qz*qw),2*(qx*qz-qy*qw),0,2*(qx*qy-qz*qw),1-2*(qx*qx+qz*qz),2*(qy*qz+qx*qw),0,2*(qx*qz+qy*qw),2*(qy*qz-qx*qw),1-2*(qx*qx+qy*qy),0,px,py,pz,1]
 max_world=max(max_world,max(abs(a-b) for a,b in zip(world,cam['matrixWorld'])))
assert max_projection<1e-14 and max_world<1e-14 and max_dither<1e-15
final=c['final'];before=c['encoding']['before'];after=c['encoding']['after']
assert final==before
assert final['rendering']['clock']['frameId']==after['rendering']['clock']['frameId']==65
receipts=[{'frameId':i,'passes':1,'completed':1} for i in range(1,66)]
assert final['rendering']['receipts']==receipts
assert after['rendering']['receipts']==receipts+[{'frameId':65,'passes':0,'completed':0}]
assert before['rendering']['temporal']=={'jitterIndex':65%31,'jitterPeriod':31,'historyWidth':900}
assert after['rendering']['temporal']=={'jitterIndex':66%31,'jitterPeriod':31,'historyWidth':900}
assert before['physical']==after['physical']==states[0]['physical']
assert before['report']['hair']['history']['commits']==after['report']['hair']['history']['commits']==65
assert before['report']['hair']['history']['cachedDraws']==1 and after['report']['hair']['history']['cachedDraws']==2
assert before['report']['hair']['history']['invalidations']==after['report']['hair']['history']['invalidations']==2
assert before['report']['hair']['history']['lastDraw']==after['report']['hair']['history']['lastDraw']
assert before['report']['hair']['history']['mode']==after['report']['hair']['history']['mode']=='exact'
def differences(a,b,p=''):
 if type(a)!=type(b):return [{'path':p,'before':a,'after':b}]
 if isinstance(a,dict):
  assert set(a)==set(b)
  return [d for k in a for d in differences(a[k],b[k],p+'.'+k)]
 if isinstance(a,list):
  if len(a)!=len(b):return [{'path':p+'.length','before':len(a),'after':len(b)}]
  return [d for i,(v,w) in enumerate(zip(a,b)) for d in differences(v,w,p+'.'+str(i))]
 return [] if a==b else [{'path':p,'before':a,'after':b}]
diff=differences(before,after)
assert {d['path'] for d in diff}=={'.report.hair.history.cachedDraws','.camera.view.offsetX','.camera.view.offsetY','.rendering.temporal.jitterIndex','.rendering.receipts.length'}
def halton(i,base):
 f=1.;v=0.
 while i:
  f/=base;v+=f*(i%base);i//=base
 return v
for s,i in [(before,3),(after,4)]:
 assert abs(s['camera']['view']['offsetX']-(halton(i,2)-.5))<1e-15
 assert abs(s['camera']['view']['offsetY']-(halton(i,3)-.5))<1e-15
assert len(r['assets'])==len(c['assets'])==6 and r['assets']==c['assets']
for a in r['assets']:
 assert a['sha256']==digest(ROOT/a['file']) and a['bytes']==(ROOT/a['file']).stat().st_size
 assert a['url']=='http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/'+a['file']
warningCounts={'rig':sum('this rig has no jaw' in w for w in r['warnings']),'zeroIndex':sum('index count of 0' in w for w in r['warnings']),'inlineReturn':sum("inline 'Fn()'" in w for w in r['warnings'])}
assert warningCounts=={'rig':1,'zeroIndex':1,'inlineReturn':2} and len(r['warnings'])==4
support=['node_modules/three/src/renderers/common/RenderPipeline.js','packages/core/src/render/CardRenderHistory.js']
additional=[{'path':p,'bytes':(ROOT/p).stat().st_size,'sha256':digest(ROOT/p)} for p in support]
finished=datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt={'status':'verified refusal only','pid':os.getpid(),'startedUTC':started,'finishedUTC':finished,'interpreter':sys.executable,'version':sys.version,'command':'python3 docs/evidence/nonhair-2026-10-03/hair-sampling-value/verify-refusal.py','sourceSHA256':digest(Path(__file__)),'reportSHA256':digest(RAW/'report.json'),'sourcePinCount':len(r['sources']),'dependencyPinCount':len(r['dependencies']),'distinctRehashedInputCount':len(pins),'runtimeSnapshots':4,'expectedConfigurationIndependent':True,'finiteNumericFields':True,'nominalCameraProjectionMaxDifference':max_projection,'quaternionWorldMatrixMaxDifference':max_world,'goldenDitherMaxDifference':max_dither,'encodingDifferences':diff,'observedCompleteFreshPasses':65,'additionalFreshPassesOnEncoding':0,'observedCachedReceipt':after['rendering']['receipts'][-1],'assets':r['assets'],'imageInventory':[],'warningCounts':warningCounts,'deadlineOnlyReverseEquality':True,'additionalSourcePins':additional,'limits':['No second arm or saved image; no preference or pixel/history-texture claim.','GPU array digests are compared as recorded values, not independently recomputed from unretained buffers.','Actual API retirement/cleanup observations are rechecked, not a new browser process inspection.']}
(OUT/'independent.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'pid':receipt['pid'],'status':receipt['status'],'receiptSHA256':digest(OUT/'independent.json'),'sourceSHA256':receipt['sourceSHA256'],'distinctPins':len(pins),'projection':max_projection,'world':max_world,'dither':max_dither}))
