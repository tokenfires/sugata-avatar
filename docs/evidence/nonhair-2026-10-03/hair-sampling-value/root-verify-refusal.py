"""Hash/state reconciliation of the one already completed refusal; never renders."""
from pathlib import Path
import datetime,hashlib,json,os
root=Path.cwd();base=root/'docs/evidence/nonhair-2026-10-03/hair-sampling-value';capture=root/'captures/hair-input-resolution-2026-10-03-v1';started=datetime.datetime.now(datetime.timezone.utc).isoformat()
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((capture/'report.json').read_text());assert digest(capture/'report.json')=='6547b61b58ce5bb56f906cd76bd53af77da8f1503975b65ae54f151cd321f7ad';assert r['status']=='failed' and len(r['cases'])==1
c=r['cases'][0];assert c['scale']==.66 and c['images']==[];assert not list(capture.glob('*.png'));a,b=c['encoding']['before'],c['encoding']['after'];assert c['final']==a
assert a['rendering']['clock']==b['rendering']['clock']=={'frameId':65,'time':0,'deltaTime':0};assert a['rendering']['temporal']=={'jitterIndex':3,'jitterPeriod':31,'historyWidth':900};assert b['rendering']['temporal']=={'jitterIndex':4,'jitterPeriod':31,'historyWidth':900}
assert a['physical']==b['physical'];assert a['physical']['clock']==a['physical']['motion']==0;assert a['camera']['view']['enabled']==b['camera']['view']['enabled']==False;assert a['camera']['projection']==b['camera']['projection'];assert a['rendering']['passDimensions']==b['rendering']['passDimensions']==[594,561]
assert a['rendering']['receipts']==[{'frameId':i,'passes':1,'completed':1}for i in range(1,66)];assert b['rendering']['receipts']==a['rendering']['receipts']+[{'frameId':65,'passes':0,'completed':0}];assert b['report']['hair']['history']['cachedDraws']==a['report']['hair']['history']['cachedDraws']+1
diffs=[]
def compare(x,y,p=''):
 if type(x)!=type(y):diffs.append(p);return
 if isinstance(x,dict):
  assert x.keys()==y.keys()
  for k in x:compare(x[k],y[k],p+'/'+k)
 elif isinstance(x,list):
  if len(x)!=len(y):diffs.append(p)
  for i,(v,w)in enumerate(zip(x,y)):compare(v,w,p+'/'+str(i))
 elif x!=y:diffs.append(p)
compare(a,b);assert set(diffs)=={'/camera/view/offsetX','/camera/view/offsetY','/rendering/temporal/jitterIndex','/rendering/receipts','/report/hair/history/cachedDraws'}
pins={**r['sources'],**r['dependencies']};assert len(pins)==390
for p,h in pins.items():assert digest(root/p)==h,p
assert digest(root/'tools/critic/hair-input-resolution.mjs')==r['instrumentSHA256']=='a8c284224f027ec3c1863b21f287fbf22069c8de595fe19cad65e2ffdaeac288';assert (capture/'instrument.mjs').read_bytes()==(root/'tools/critic/hair-input-resolution.mjs').read_bytes()
assert len(r['assets'])==6 and len({x['file']for x in r['assets']})==6
for x in r['assets']:assert digest(root/x['file'])==x['sha256'] and (root/x['file']).stat().st_size==x['bytes'];assert x['url']=='http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/'+x['file']
assert r['failureRetirement']=={'disposed':True,'leaked':[]};assert r['cleanup']=={'page':'closed','browser':'closed'};assert r['finalPinsUnchanged'] and len(r['errors'])==1 and len(r['warnings'])==4
original=(base/'unexecuted-instrument.mjs').read_bytes();revised=(root/'tools/critic/hair-input-resolution.mjs').read_bytes();assert revised.replace(b"stop='2026-10-03T12:30:00Z'",b"stop='2026-10-03T12:20:00Z'")==original
receipt={'pid':os.getpid(),'startedUTC':started,'finishedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 docs/evidence/nonhair-2026-10-03/hair-sampling-value/verify-refusal.py','rawReportSHA256':digest(capture/'report.json'),'pins':len(pins),'assets':len(r['assets']),'differences':diffs,'deadlineOnlyByteEquality':True,'finalEqualsBeforeEncoding':True,'clockAndPhysicalExact':True,'retainedImages':0,'fullResolutionArms':0,'scope':'Already retained source/state refusal only; no pixel/radiance/history-texture difference or resolution preference established','postflightSourcePins':{p:digest(root/p)for p in ['node_modules/three/src/renderers/common/RenderPipeline.js','node_modules/three/examples/jsm/tsl/display/TAAUNode.js','node_modules/three/src/nodes/core/NodeFrame.js','packages/core/src/render/Stage.js','packages/core/src/render/TRAAPost.js','packages/core/src/render/CardRenderHistory.js']}}
(base/'root-refusal.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
