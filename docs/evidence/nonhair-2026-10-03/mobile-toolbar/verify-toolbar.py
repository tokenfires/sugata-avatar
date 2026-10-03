"""Independent scalar/byte audit of the single retained native toolbar packet."""
import json, math, hashlib, pathlib, struct, sys, os, datetime
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
root = pathlib.Path(__file__).resolve().parents[4]
out = root / 'captures/mobile-toolbar-ui-2026-10-03-v1'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
r = json.loads((out/'report.json').read_text())
assert r['status']=='observed' and r['errors']==[] and r['finalPinsUnchanged']
assert r['cleanup']==dict(reference='closed',page='closed',browser='closed')
assert r['retirement']==dict(disposed=True,leaked=[])
assert r['finished'] < r['hardStop']
pins = {}
for group in ['sources','dependencies','referenceInputs']:
 for p,h in r[group].items():
  assert sha(root/p)==h, p
  pins[p]=h
assert sha(root/'tools/critic/mobile-toolbar-ui.mjs')==r['instrumentSHA256']
for name,p in [('showcase.html','packages/testbed/src/showcase.html'),('showcase.js','packages/testbed/src/showcase.js'),('viewer-framing.mjs','packages/testbed/src/viewer-framing.mjs')]:
 assert sha(out/name)==r['sources'][p]
assert sha(out/'instrument.mjs')==r['instrumentSHA256']
oldpath = next(p for p in r['referenceInputs'] if p.endswith('report.json'))
htmlpath = next(p for p in r['referenceInputs'] if p.endswith('showcase.html'))
assert sha(out/'before.html')==r['referenceInputs'][htmlpath]
old = json.loads((root/oldpath).read_text())
assert [p for p,h in r['sources'].items() if old['sources'].get(p)!=h]==['packages/testbed/src/showcase.html']
for a in r['assets']:
 assert sha(root/a['file'])==a['sha256']==r['sources'][a['file']]
images=[]
for a in r['images']:
 p=out/a['file']; assert sha(p)==a['sha256']
 data=p.read_bytes(); assert data[:8]==b'\x89PNG\r\n\x1a\n'
 size=list(struct.unpack('>II',data[16:24])); assert size==[a['size']['width'],a['size']['height']]
 images.append(dict(file=a['file'],sha256=a['sha256'],size=size))
def err(a,b):
 if isinstance(a,list): return max((err(x,y) for x,y in zip(a,b)),default=0)
 return abs(a-b)
def camera(a,b,extras=True):
 v=max(err(a[k],b[k]) for k in ['position','quaternion','target','zoom','aspect'])
 if extras:
  v=max(v,err(a['projection'],b['projection']))
  for k in ['fov','near','far','coordinateSystem','viewEnabled']: assert a[k]==b[k],k
 assert v<1e-10
 return v
def preserved(a,b):
 for k in ['configuration','url','storage','paused','clock']: assert a[k]==b[k],k
 assert b['sameOwner']
def radius(s): return math.dist(s['position'],s['target'])
max_camera=0.;max_angle=0.;max_fit=0.;cases=[]
assert [c['label'] for c in r['cases']]==['desktop-body','desktop-portrait','mobile-portrait','mobile-body','narrow-body']
for c in r['cases']:
 b=c['baseline']; w,h=c['viewport']; ref=c['referenceDOM']
 assert ref['scriptCount']==0 and ref['avatar'] is False
 assert b['scroll']==[0,0] and not b['overflow']
 assert b['canvas']['css']==ref['css']==b['image']
 assert b['canvas']['client']==ref['client']==b['canvas']['buffer']
 assert b['paused']=='true' and b['sameOwner']
 assert [x['text'] for x in b['buttons']]==['Front','Side','Back','Reset view']
 assert all(not x['disabled'] and x['rect']['height']>=40 for x in b['buttons'])
 assert 0<=b['pill']['x'] and b['pill']['x']+b['pill']['width']<=w
 prior=next((x['baseline'] for x in old['cases'] if x['label']==c['label']),None)
 if prior:
  p={**prior,'aspect':prior['viewport'][4]}; max_camera=max(max_camera,camera(b,p,False))
  assert b['configuration']==p['configuration'] and b['canvas']['client']==p['viewport'][2:4]
 else:
  p={**old['cases'][0]['baseline'],'aspect':old['cases'][0]['baseline']['viewport'][4]}
  max_camera=max(max_camera,camera({**b,'aspect':p['aspect']},p,False));assert b['zoom']==1
 f=b['framing']; cw,ch=b['canvas']['client']
 if c['mode']=='portrait':
  bounds=f['boundsAtUnitAspect'];g=f['gutterPixels']
  expected=min(1,max(.1,1-2*g/cw)*b['aspect']/max(abs(bounds['minX']),abs(bounds['maxX'])),max(.1,1-2*g/ch)/max(abs(bounds['minY']),abs(bounds['maxY'])))
 else: expected=1
 max_fit=max(max_fit,abs(expected-b['zoom']));assert abs(expected-b['zoom'])<1e-12
 expected_fov=math.degrees(2*math.atan(math.tan(math.radians(26)/2)/expected))
 assert abs(expected_fov-f['effectiveFov'])<1e-12
 assert len(c['angles'])==3
 for a in c['angles']:
  before,after=a['before'],a['after']; rad=radius(before);theta=math.radians(a['degrees'])
  pos=[before['target'][0]+rad*math.sin(theta),before['target'][1],before['target'][2]+rad*math.cos(theta)]
  e=err(pos,after['position']);max_angle=max(max_angle,e);assert e<1e-10
  assert abs(rad-a['radius'])<1e-12 and err(pos,a['expected'])<1e-12;preserved(before,after)
 d=c['disturbed'];assert err(d['position'],b['position'])>.001 and abs(radius(d)-radius(b))>1e-5
 assert len(c['drift'])==8
 for s in [c['recovered'],*c['drift'],c['final']]:
  max_camera=max(max_camera,camera(b,s));preserved(b,s)
 if w<=760:
  assert b['controls']['y']>=b['canvas']['css']['y']+b['canvas']['css']['height']+15.9
  assert b['aside']['y']>=b['controls']['y']+b['controls']['height']
  assert b['footer']['y']>=b['aside']['y']+b['aside']['height']
  s=c['focus'];max_camera=max(max_camera,camera(b,s));preserved(b,s)
  button=next(x for x in s['buttons'] if x['id']=='reset-view');box=button['rect'];o=button['outline'];extent=o['width']+max(0,o['offset'])
  assert button['focused'] and button['focusVisible'] and o['style']=='solid' and o['width']>0
  assert box['y']-extent>=s['canvas']['css']['y']+s['canvas']['css']['height']
  assert box['x']-extent>=0 and box['x']+box['width']+extent<=w
  assert box['y']-extent>=0 and box['y']+box['height']+extent<=h
  assert box['y']+box['height']+extent<=s['asideContent']['y'] and not s['overflow']
  if h<700:assert s['scroll'][1]>0
 else:
  assert b['pill']['y']>b['canvas']['css']['y'] and b['pill']['y']+b['pill']['height']<b['canvas']['css']['y']+b['canvas']['css']['height']
 if 'sticky' in c:
  s=c['sticky'];assert s['scroll'][1]>0 and abs(s['canvas']['css']['y']-16)<1/64
  assert [s['canvas']['css'][k] for k in ['width','height']]==[b['canvas']['css'][k] for k in ['width','height']]
  assert abs(s['pill']['y']-s['canvas']['css']['y']-b['pill']['y']+b['canvas']['css']['y'])<1/64
  max_camera=max(max_camera,camera(b,s));preserved(b,s)
 cases.append(dict(label=c['label'],canvas=b['canvas'],zoom=b['zoom'],finalScroll=c['final']['scroll'],wheelRadiusChange=radius(d)-radius(b)))
print(json.dumps(dict(status='passed',command='/opt/homebrew/opt/python@3.14/bin/python3.14 docs/evidence/nonhair-2026-10-03/mobile-toolbar/verify-toolbar.py > docs/evidence/nonhair-2026-10-03/mobile-toolbar/independent.json',interpreter=sys.executable,version=sys.version,pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),verifierSHA256=sha(pathlib.Path(__file__)),reportSHA256=sha(out/'report.json'),pinCount=len(pins),pins=pins,servedAssets=r['assets'],images=images,cases=cases,maxCamera=max_camera,maxAngle=max_angle,maxPortraitFit=max_fit,driftCount=40,limits='Scalar recorded camera/DOM/state/bytes audit; actual five originals reviewed separately. No new capture, pixel identity or physical-visibility inference.'),indent=2))
