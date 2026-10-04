from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,os,struct,zlib
root=Path('/Users/robault/GitHub/sugata-avatar');p=root/'docs/evidence/nonhair-2026-10-03/skin-finish-sdk';start=datetime.now(timezone.utc).isoformat();h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
pre=json.loads((p/'ROOT-PREFLIGHT.json').read_text())
for row in pre['currentPins']:
 f=Path(row['path']);assert h(f)==row['sha256'] and f.stat().st_size==row['bytes']
r=json.loads((p/'NATIVE-STATE.json').read_text());assert not r['complete'] and not r['pending'] and 'old skin disposal event mismatch' in r['failure']['message']
assert len(r['requests'])==2 and len(r['creations'])==2 and len(r['states'])==2 and len(r['retirements'])==2
recipe=json.loads((root/'looks/sage-lavender-chin.json').read_text());assert recipe==r['recipe'] and h(root/'looks/sage-lavender-chin.json')==r['recipeSHA256']
for req,finish in zip(r['requests'],['original','reduced-sheen']):
 options={**recipe,'autoStart':False,**({} if finish=='original' else {'skinFinish':finish})};assert req['options']==options
for item,finish,weight in zip(r['states'],['original','reduced-sheen'],[.34,.12]):
 expected={'requestedFinish':finish,'attached':True,'clearcoat':weight,'clearcoatRoughness':.24,'settings':{'secondLobeWeight':weight,'secondLobeRoughness':.24}}
 assert item['complete'] and item['skinUUID']==item['bodyMaterialUUID'] and item['canvas']=={'width':900,'height':1120}
 for phase in ['before','after']:
  s=item[phase];assert s['skin']==expected and s['quality']['backend']=='webgpu' and s['quality']['tier']=='balanced' and not s['quality']['backendMismatch']
  assert s['identity']['bake']=='figure_g050' and s['identity']['gender']==.5
  assert s['hair']['attached'] and s['hair']['loadedStyle']=='bob02' and s['hair']['colour']['applied']==recipe['hairColour'] and s['hair']['colour']['appliedTint']==recipe['hairTint'] and s['hair']['colour']['matchesAttached']
  assert s['wardrobe']['attached'] and not s['wardrobe']['pendingCandidates'] and s['wardrobe']['lastError'] is None
  assert sorted(s['wardrobe']['state']['worn'])==sorted(recipe['wardrobe']['outfit']+list(recipe['wardrobe']['foundation'].values()))
  assert s['wardrobe']['appearance']['attached'] and s['wardrobe']['appearance']['colours']==recipe['wardrobe']['colours'] and s['wardrobe']['appearance']['style']=='ecru'
  assert s['scene']['id']=='studio' and s['scene']['lighting']['look']=='neutral' and not s['scene']['lighting']['calibrated'] and s['framing']['mode']=='portrait'
 assert item['clockSeconds']==0
rb=r['rebuild'];assert not rb['complete'] and rb['disposeEvents']==2 and rb['beforeSkinUUID']!=rb['afterSkinUUID']
assert rb['after']['skin']==r['states'][1]['after']['skin']
for d in r['retirements']:
 assert d['error'] is None and d['disposal']=={'disposed':True,'leaked':[]} and not d['skinAfter']['attached'] and d['skinAfter']['clearcoat'] is None
close=json.loads((p/'CLOSE.json').read_text());assert close['closedTab']=='9' and [t['id'] for t in close['tabs']]==['1']
logs=json.loads((p/'CONSOLE.json').read_text())['logs'];assert len(logs)==7 and all(x['level']=='warn' for x in logs)
pngs=[]
for name in ['original.png','reduced.png']:
 b=(p/name).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(900,1120)
 pos=8;chunks=[];complete=True
 while pos+12<=len(b):
  size=int.from_bytes(b[pos:pos+4],'big');typ=b[pos+4:pos+8];end=pos+12+size
  if end>len(b):complete=False;chunks.append({'type':typ.decode(),'declaredBytes':size,'availableBytes':max(0,len(b)-pos-12),'truncated':True});break
  data=b[pos+8:pos+8+size];crc=int.from_bytes(b[pos+8+size:end],'big');assert zlib.crc32(typ+data)&0xffffffff==crc;chunks.append({'type':typ.decode(),'bytes':size,'CRCmatches':True});pos=end
 assert not complete and not any(x['type']=='IEND' for x in chunks)
 pngs.append({'file':name,'bytes':len(b),'sha256':h(p/name),'dimensions':[900,1120],'completePNG':False,'chunks':chunks,'appearanceInspected':False})
names=['NATIVE-STATE.json','NATIVE-IMAGES.json','DOM-COPY-LIMIT.json','DOM-COPY-CORRECTION.md','CONSOLE.json','CLOSE.json','native-context.jpg','original.png','reduced.png']
out={'command':'python3 '+str(Path(__file__).relative_to(root)),'pid':os.getpid(),'startUTC':start,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':0,'passed':True,'decision':'B: source candidate retained, no API adoption, no gate repair/replay','scope':'Independently verified actual state/retirement/current pins/incomplete PNG structure; actual context image separately viewed, no missing-original appearance proof','eventCount':2,'defaultAndReducedOfferRecords':2,'completedRebuildPortraits':0,'PNGCopyValidation':pngs,'pins':[{'file':n,'bytes':(p/n).stat().st_size,'sha256':h(p/n)} for n in names],'sourceSHA256':h(Path(__file__))}
with (p/'ROOT-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({k:out[k] for k in ['pid','startUTC','endUTC','passed','sourceSHA256']}));print('receiptSHA',h(p/'ROOT-RESULT.json'))
