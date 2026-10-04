import datetime, hashlib, json, os, pathlib, platform, struct, sys
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root/'docs/evidence/nonhair-2026-10-03/review-hub-value'
inputs = [
 'docs/evidence/nonhair-2026-10-03/review-hub-value/PLAN.md',
 'packages/testbed/index.html','packages/testbed/pages.js','packages/testbed/today-review.js',
 'docs/evidence/appearance-2026-10-02/review.html',
 'docs/evidence/nonhair-2026-10-03/hair-cut/README.md',
 'docs/evidence/nonhair-2026-10-03/hair-cut/ROOT-DECISION.md',
 'docs/evidence/nonhair-2026-10-03/ink-denim-look/README.md',
 'docs/evidence/nonhair-2026-10-03/ink-denim-look/RECEIPT.md',
 'looks/INK-DENIM.md','looks/VIEWING-ATTENTION.md','looks/ink-denim-review.html','looks/ink-denim.json',
 'captures/wardrobe-hair-cut-2026-10-03-v1/desktop-before.png',
 'captures/wardrobe-hair-cut-2026-10-03-v1/desktop-long-bob.png',
 'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-body.png',
 'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/kitchen-body.png',
 'docs/evidence/nonhair-2026-10-03/review-hub-value/CRITIC-VALUE.md',
 'docs/evidence/nonhair-2026-10-03/review-hub-value/critic-value-pins.py']
pins=[]
for name in inputs:
    b=(root/name).read_bytes()
    row={'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
    if name.endswith('.png'):
        assert b[:8]==b'\x89PNG\r\n\x1a\n'
        row['dimensions']=list(struct.unpack('>II',b[16:24]))
    pins.append(row)
assert [p['dimensions'] for p in pins if 'dimensions' in p]==[[1440,2060],[1440,2060],[900,868],[900,868]]
receipt={'scope':'FS-only bounded value metadata; no browser/build/SDK/geometry job','command':'python3 docs/evidence/nonhair-2026-10-03/review-hub-value/critic-value-pins.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','pins':pins,'sourceSha256':pins[-1]['sha256'],'noteSha256':pins[-2]['sha256'],'originalInspection':'All four exact source files viewed during this worth gate; tall UI image display resized by tool; no bitmap edits/crops'}
dest=packet/'CRITIC-VALUE-PINS.json'
with dest.open('x') as f:
    json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({'status':receipt['status'],'pid':receipt['pid'],'started':started,'ended':receipt['ended'],'pins':len(pins),'sourceSha256':receipt['sourceSha256'],'noteSha256':receipt['noteSha256'],'receiptSha256':hashlib.sha256(dest.read_bytes()).hexdigest()}))
