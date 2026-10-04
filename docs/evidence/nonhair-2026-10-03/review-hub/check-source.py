import datetime, hashlib, json, os, pathlib, platform, struct, sys
from html.parser import HTMLParser
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root/'docs/evidence/nonhair-2026-10-03/review-hub'
page = packet.parent/'review.candidate.html'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.images=[]; self.scripts=[]; self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a': self.links.append(a)
        if tag=='img': self.images.append(a)
        if tag=='script': self.scripts.append(a)
        if 'id' in a: self.ids.append(a['id'])
p=Page(); p.feed(page.read_text())
assert not p.scripts and len(p.images)==4 and len(p.ids)==len(set(p.ids))
def pin(file):
    b=file.read_bytes()
    return {'file':str(file.relative_to(root)), 'bytes':len(b), 'sha256':hashlib.sha256(b).hexdigest()}
baseline=json.loads((root/'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/report.json').read_text())['sources']
assert len(baseline)==380
for name,sha in baseline.items(): assert pin(root/name)['sha256']==sha, name
old=json.loads((packet.parent/'review-hub-value/CRITIC-VALUE-PINS.json').read_text())
for row in old['pins']: assert pin(root/row['file'])['sha256']==row['sha256'], row['file']
targets=[]
for a in p.links:
    href=a['href']
    if href.startswith('#'):
        assert href[1:] in p.ids; continue
    target=(root/'packages/testbed'/href.lstrip('/')) if href.startswith('/') else (page.parent/href).resolve()
    if href=='/': target=target/'index.html'
    assert target.is_file(), href
    targets.append({'href':href, **pin(target)})
media=[]
for a in p.images:
    file=(page.parent/a['src']).resolve(); b=file.read_bytes()
    assert b[:8]==b'\x89PNG\r\n\x1a\n'
    dims=list(struct.unpack('>II',b[16:24]))
    assert dims==[int(a['width']),int(a['height'])] and a.get('alt')
    media.append({**pin(file),'dimensions':dims})
for row,name in zip(media[:2],['desktop-before.png','desktop-long-bob.png']):
    assert row['sha256']==pin(root/'captures/wardrobe-hair-cut-2026-10-03-v1'/name)['sha256']
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/check-source.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','author':'functions.exec tools.apply_patch: complete literal candidate and PLAN saved before this FS qualification; no script or renderer in page','pins':[pin(page),pin(pathlib.Path(__file__)),pin(packet/'PLAN.md')],'acceptedSources':baseline,'worthInputsUnchanged':len(old['pins']),'media':media,'links':targets,'scripts':p.scripts,'ids':p.ids}
dest=packet/'SOURCE.json'
with dest.open('x') as f: json.dump(receipt,f,indent=2); f.write('\n')
print(json.dumps({'pid':receipt['pid'],'started':started,'ended':receipt['ended'],'status':'passed','acceptedSources':len(baseline),'worthPins':len(old['pins']),'links':len(targets),'media':len(media),'pageSha256':receipt['pins'][0]['sha256'],'receiptSha256':hashlib.sha256(dest.read_bytes()).hexdigest()}))
