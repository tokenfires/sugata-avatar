from pathlib import Path
from collections import Counter
from html.parser import HTMLParser
import json, hashlib, os, sys
from datetime import datetime, timezone
base=Path('/Users/robault/GitHub/sugata-avatar')
packet=base/'docs/evidence/nonhair-2026-10-03/editor-focus-value'
started=datetime.now(timezone.utc).isoformat()
hashbytes=lambda b:hashlib.sha256(b).hexdigest()
html=(base/'packages/testbed/src/showcase.html').read_text()
old=(packet/'BEFORE.html.source').read_bytes()
m=json.loads((packet/'ID-MATRIX.json').read_text())
restored=html
removed=0
for identifier in ['clothing-colour-guidance','clothing-picker-help']+[m[p]['appliedId'] for p in m]:
    text=' id="'+identifier+'"'
    assert restored.count(text)==1, identifier
    restored=restored.replace(text,'',1);removed+=1
for part in m:
    for kind in ['checkbox','text','color']:
        text=' aria-describedby="'+' '.join(m[part][kind])+'"'
        assert text in restored, (part,kind)
        restored=restored.replace(text,'',1);removed+=1
assert removed==14
assert restored.encode()==old, 'another source/text/attribute changed'
class Reader(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.divs=[];self.controls=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='div':self.divs.append(a.get('data-colour-part'))
        if tag=='input':
            part=next((v for v in reversed(self.divs) if v),None)
            if part:self.controls.append((part,a))
    def handle_endtag(self,tag):
        if tag=='div':self.divs.pop()
r=Reader();r.feed(html)
assert len(r.ids)==len(set(r.ids))
assert len(r.controls)==9
rows=[]
for part,a in r.controls:
    assert a['aria-describedby'].split()==m[part][a['type']]
    assert all(Counter(r.ids)[i]==1 for i in a['aria-describedby'].split())
    rows.append({'part':part,'type':a['type'],'describedBy':a['aria-describedby']})
files=['packages/testbed/src/showcase.html','packages/testbed/src/showcase.js','packages/testbed/src/showcase-colour-controls.mjs','packages/testbed/src/showcase-colour-controls.css','packages/testbed/src/showcase-hair-colours.css','packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-collection.mjs','packages/core/src/render/MotionProbe.mjs','tools/critic/clothing-descriptions.mjs','docs/evidence/nonhair-2026-10-03/editor-focus-value/PROPOSED-CONTRACT.md','docs/evidence/nonhair-2026-10-03/editor-focus-value/ID-MATRIX.json','docs/evidence/nonhair-2026-10-03/editor-focus-value/EDIT.json']
result={'status':'source-qualified','pid':os.getpid(),'startedUTC':started,'finishedUTC':datetime.now(timezone.utc).isoformat(),'command':'python3 docs/evidence/nonhair-2026-10-03/editor-focus-value/critic-source-check.py','python':sys.version,'readerSHA256':hashbytes(Path(__file__).read_bytes()),'exact14AttributesReverseToBefore':True,'allIDsUnique':True,'nineControls':rows,'pins':{f:hashbytes((base/f).read_bytes())for f in files},'scope':'fs/HTML source-only readback, no runtime, browser, AX, shader, geometry or appearance qualification'}
(packet/'critic-source-check.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'pid':result['pid'],'startedUTC':started,'finishedUTC':result['finishedUTC'],'readerSHA256':result['readerSHA256'],'html':result['pins']['packages/testbed/src/showcase.html'],'observer':result['pins']['tools/critic/clothing-descriptions.mjs'],'receiptSHA256':hashbytes((packet/'critic-source-check.json').read_bytes())}))
