from pathlib import Path
import hashlib,json,re,os
from datetime import datetime,timezone
started=datetime.now(timezone.utc).isoformat()
root=Path('/Users/robault/GitHub/sugata-avatar')
packet=root/'docs/evidence/nonhair-2026-10-04/portrait-outfit-final'
note=(packet/'CRITIC-SOURCE.md').read_text()
rows=re.findall(r'^\| ([^|]+?) \| ([0-9a-f]{64}) \|$',note,re.M)
assert len(rows)==15
pins=[]
for name,expected in rows:
    b=(root/name).read_bytes(); actual=hashlib.sha256(b).hexdigest()
    assert actual==expected,(name,expected,actual)
    pins.append(dict(path=name,bytes=len(b),sha256=actual))
extras=['STOP.json','NATIVE-JOB.json','refused-desktop.jpg','refused-mobile.jpg','refused-desktop-ax.txt','refused-mobile-ax.txt','refused-console.json','ROOT-SOURCE.json','ROOT-PREFLIGHT.json','CRITIC-SOURCE.md','original-portrait.html.source','original-portrait.js.source','candidate-portrait.html.source','candidate-portrait.js.source','portrait-outfit.mjs.source']
for name in extras:
    b=(packet/name).read_bytes()
    pins.append(dict(path=str((packet/name).relative_to(root)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
for name,live in [('original-portrait.html.source','portrait.html'),('original-portrait.js.source','portrait.js'),('candidate-portrait.html.source','portrait-outfit-final-candidate.html'),('candidate-portrait.js.source','portrait-outfit-final-candidate.js'),('portrait-outfit.mjs.source','portrait-outfit.mjs')]:
    assert (packet/name).read_bytes()==(root/'packages/testbed/src'/live).read_bytes()
def jpeg_size(path):
    data=path.read_bytes(); assert data[:2]==b'\xff\xd8' and data[-2:]==b'\xff\xd9'
    pos=2
    while pos<len(data):
        assert data[pos]==255
        while data[pos]==255:pos+=1
        marker=data[pos];pos+=1
        if marker in [0xd8,0xd9,0x01] or 0xd0<=marker<=0xd7:continue
        n=int.from_bytes(data[pos:pos+2],'big');assert n>=2
        if marker in [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]:
            return dict(width=int.from_bytes(data[pos+5:pos+7],'big'),height=int.from_bytes(data[pos+3:pos+5],'big'),eoi=True)
        pos+=n
    raise AssertionError('No SOF')
images={name:jpeg_size(packet/name) for name in ['refused-desktop.jpg','refused-mobile.jpg']}
job=json.loads((packet/'NATIVE-JOB.json').read_text());stop=json.loads((packet/'STOP.json').read_text())
assert stop['knownClosed'] is True and stop['viewportReset'] is True
assert json.loads((packet/'refused-console.json').read_text())==[]
for name in ['refused-desktop-ax.txt','refused-mobile-ax.txt']:
    t=(packet/name).read_text()
    assert 'Continue without an outfit' in t
    assert 'scene=studio, ID: continue-without-outfit' in t
    assert 'checkbox (disabled) No outfit, Value: 0' in t
    assert 'checkbox (disabled) Ink outfit, Value: 0' in t
    assert 'Original long bob' in t and 'Portrait unavailable' in t
cutoff=datetime.fromisoformat('2026-10-04T08:44:00+00:00')
request=datetime.fromisoformat(job['requestedAt'].replace('Z','+00:00'))
handle=datetime.fromisoformat(job['handleObservedAt'].replace('Z','+00:00'))
record=dict(pid=os.getpid(),started=started,finished=datetime.now(timezone.utc).isoformat(),command='python3 docs/evidence/nonhair-2026-10-04/portrait-outfit-final/CRITIC-READBACK.py',sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),pins=pins,images=images,requestedAt=job['requestedAt'],handleObservedAt=job['handleObservedAt'],requestAfterCutoffSeconds=(request-cutoff).total_seconds(),handleAfterCutoffSeconds=(handle-cutoff).total_seconds(),knownClosed=stop['knownClosed'],viewportReset=stop['viewportReset'],finiteConsoleEntries=0,scope='FS/header/source/recorded-AX readback only; no DOM/runtime/asset parsing or replay. Original-detail image inspection performed separately. No claim page layout caused JPEG scaling.')
out=packet/'CRITIC-READBACK.json'
with out.open('x') as f:json.dump(record,f,indent=2);f.write('\n')
print(json.dumps(dict(pid=record['pid'],started=started,finished=record['finished'],pins=len(pins),images=images,requestAfterCutoffSeconds=record['requestAfterCutoffSeconds'],handleAfterCutoffSeconds=record['handleAfterCutoffSeconds'],sourceSha256=record['sourceSha256'],receiptSha256=hashlib.sha256(out.read_bytes()).hexdigest())))
