import datetime,hashlib,json,os,pathlib,platform,struct,sys
from html.parser import HTMLParser
from urllib.parse import urlsplit
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet=root/'docs/evidence/nonhair-2026-10-03/review-hub'
page=packet.parent/'review.candidate.html'
def pin(p):
 b=p.read_bytes(); return {'file':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
source=json.loads((packet/'SOURCE.json').read_text())
assert source['status']=='passed' and len(source['acceptedSources'])==380
baseline=json.loads((root/'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/report.json').read_text())['sources']
assert source['acceptedSources']==baseline
accepted=[]
for name,h in source['acceptedSources'].items():
 r=pin(root/name);assert r['sha256']==h,name;accepted.append(r)
worth=json.loads((packet.parent/'review-hub-value/CRITIC-VALUE-PINS.json').read_text())
worth_pins=[]
for r in worth['pins']:
 observed=pin(root/r['file']);assert observed['sha256']==r['sha256'];worth_pins.append(observed)
assert len(worth_pins)==19 and source['worthInputsUnchanged']==19
for r in source['pins']:
 assert pin(root/r['file'])==r
class H(HTMLParser):
 def __init__(self):
  super().__init__();self.links=[];self.images=[];self.ids=[];self.sections=0;self.scripts=[];self.events=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='a':self.links.append(a)
  if t=='img':self.images.append(a)
  if t=='section':self.sections+=1
  if t=='script':self.scripts.append(a)
  if 'id' in a:self.ids.append(a['id'])
  self.events.extend([k for k in a if k.lower().startswith('on')])
h=H();h.feed(page.read_text());h.close()
assert h.sections==2 and len(h.images)==4 and not h.scripts and not h.events
assert len(h.ids)==len(set(h.ids)) and h.ids==source['ids']
links=[];fragments=[]
for a in h.links:
 u=urlsplit(a['href']);assert not u.scheme and not u.netloc and not u.query
 if not u.path:
  assert u.fragment in h.ids;fragments.append(u.fragment);continue
 target=(root/'packages/testbed'/u.path.lstrip('/')) if u.path.startswith('/') else (page.parent/u.path).resolve()
 if u.path=='/':target=target/'index.html'
 assert target.is_file()
 links.append({'href':a['href'],**pin(target)})
assert links==source['links'] and len(links)==15 and fragments==['ink']
media=[]
for a in h.images:
 p=(page.parent/a['src']).resolve();b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n'
 dims=list(struct.unpack('>II',b[16:24]));assert dims==[int(a['width']),int(a['height'])] and a.get('alt')
 media.append({**pin(p),'dimensions':dims})
assert media==source['media']
copy_equalities=[]
for r,name in zip(media[:2],['desktop-before.png','desktop-long-bob.png']):
 raw=root/'captures/wardrobe-hair-cut-2026-10-03-v1'/name
 assert (root/r['file']).read_bytes()==raw.read_bytes();copy_equalities.append({'archive':r['file'],'raw':str(raw.relative_to(root)),'equalBytes':True})
packet_pins=[pin(packet/f) for f in ['PLAN.md','check-source.py','SOURCE.json','CRITIC-SOURCE.md','critic-source-readback.py']]+[pin(page)]
receipt={'scope':'FS/source/link/media admission only; no rendering/build/browser/SDK execution','command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/critic-source-readback.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','accepted':accepted,'worthPins':worth_pins,'packetPins':packet_pins,'links':links,'fragments':fragments,'media':media,'copyEqualities':copy_equalities,'sections':h.sections,'scripts':h.scripts,'inlineEvents':h.events,'sourceSha256':pin(pathlib.Path(__file__))['sha256'],'noteSha256':pin(packet/'CRITIC-SOURCE.md')['sha256']}
dest=packet/'CRITIC-SOURCE-PINS.json'
with dest.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({'status':'passed','pid':receipt['pid'],'started':started,'ended':receipt['ended'],'acceptedPins':len(accepted),'worthPins':len(worth_pins),'links':len(links),'images':len(media),'sourceSha256':receipt['sourceSha256'],'noteSha256':receipt['noteSha256'],'receiptSha256':pin(dest)['sha256']}))
