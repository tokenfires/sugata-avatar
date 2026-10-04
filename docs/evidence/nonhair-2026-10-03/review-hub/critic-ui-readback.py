import datetime,hashlib,json,os,pathlib,platform,struct,sys
from urllib.parse import urljoin
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');packet=root/'docs/evidence/nonhair-2026-10-03/review-hub';native=packet/'native'
def pin(p):
 b=p.read_bytes();return {'file':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def jpeg_dims(b):
 assert b[:2]==b'\xff\xd8';i=2
 while i<len(b):
  assert b[i]==255;i+=1
  while b[i]==255:i+=1
  m=b[i];i+=1
  if m in (0xd8,0xd9) or 0xd0<=m<=0xd7:continue
  n=int.from_bytes(b[i:i+2],'big')
  if m in (0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf):
   return [int.from_bytes(b[i+5:i+7],'big'),int.from_bytes(b[i+3:i+5],'big')]
  i+=n
 raise AssertionError('JPEG SOF absent')
report=json.loads((native/'NATIVE.json').read_text());prior=json.loads((packet/'CRITIC-SOURCE-PINS.json').read_text())
assert report['closed'] is True and report['viewportReset'] is True and report['logs']==[]
assert len(report['states'])==len(report['captures'])==4
assert report['operations'][0]['at']<'2026-10-04T01:43:00Z' and report['ended']<'2026-10-04T02:00:00Z'
protected=[]
for r in prior['accepted']+prior['worthPins']+prior['packetPins']:
 p=pin(root/r['file']);assert p==r;protected.append(p)
expected_names=['candidate-desktop','candidate-phone','candidate-phone-ink','candidate-gallery-link']
assert [s['name'] for s in report['states']]==expected_names
images=[];individual=[];ratios=[]
for index,(s,c) in enumerate(zip(report['states'],report['captures'])):
 p=native/(s['name']+'.json');assert json.loads(p.read_text())==s;individual.append(pin(p))
 image=pathlib.Path(c['file']);assert image==native/(s['name']+'.jpg')
 rec=pin(image);assert rec['bytes']==c['bytes'] and rec['sha256']==c['sha256']
 rec['dimensions']=jpeg_dims(image.read_bytes());images.append(rec)
 v=s['state']['viewport'];d=s['state']['document'];assert d['width']==v['width']
 if index<3:
  assert len(s['state']['images'])==4 and len(s['state']['links'])==16
  for im,m in zip(s['state']['images'],prior['media']):
   assert im['complete'] is True and [im['naturalWidth'],im['naturalHeight']]==m['dimensions']
   assert im['src']=='http://127.0.0.1:5173/@fs'+str(root/m['file'])
   residual=abs(im['height']-im['width']*im['naturalHeight']/im['naturalWidth']);assert residual<.02
   ratios.append({'state':s['name'],'source':im['src'],'width':im['width'],'height':im['height'],'residualCSS':residual})
assert [r['dimensions'] for r in images]==[[1280,3080],[390,4260],[390,844],[390,844]]
base=report['states'][0]['state']['url']
assert report['states'][2]['state']['url']==base+'#ink'
assert report['states'][3]['state']['url']=='http://127.0.0.1:5173/@fs'+str(root/'looks/ink-denim-review.html')
assert report['operations'][2]['key']==report['operations'][3]['key']=='Enter'
for s in report['states'][:3]:
 assert 'head may stay more frontal' in s['dom'] and 'hair finish' in s['dom'] and s['ax']
pins=[pin(packet/f) for f in ['PLAN.md','SOURCE.json','CRITIC-SOURCE.md','CRITIC-SOURCE-PINS.json','CRITIC-UI.md','critic-ui-readback.py','ROOT-VISUAL.md','read-native.py','ROOT-NATIVE.json']]+[pin(native/'NATIVE.json')]
receipt={'scope':'FS-only native metadata/image/source readback; no browser/build/SDK/render replay','command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/critic-ui-readback.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','protected':protected,'pins':pins,'images':images,'individual':individual,'states':report['states'],'operations':report['operations'],'ratioChecks':ratios,'closed':report['closed'],'viewportReset':report['viewportReset'],'logs':report['logs'],'sourceSha256':pin(pathlib.Path(__file__))['sha256'],'noteSha256':pin(packet/'CRITIC-UI.md')['sha256']}
dest=packet/'CRITIC-UI-PINS.json'
with dest.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({'status':'passed','pid':receipt['pid'],'started':started,'ended':receipt['ended'],'protectedRows':len(protected),'images':len(images),'ratioChecks':len(ratios),'sourceSha256':receipt['sourceSha256'],'noteSha256':receipt['noteSha256'],'receiptSha256':pin(dest)['sha256']}))
