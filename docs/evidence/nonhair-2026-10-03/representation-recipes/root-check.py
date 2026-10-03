"""Independent readback of the sole Node receipt; no manifest queries or render replay."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[4]
packet = Path(__file__).resolve().parent
digest = lambda b: hashlib.sha256(b).hexdigest()
started = datetime.now(timezone.utc).isoformat()
raw = (packet / 'receipt.json').read_bytes()
r = json.loads(raw)
assert r['status'] == 'pass'
assert r['finished'] < r['stop']
for pin in r['inputs']:
    b = (root / pin['path']).read_bytes()
    assert len(b) == pin['bytes'] and digest(b) == pin['sha256'], pin['path']
for pin in r['physicalFiles']:
    p = root / pin['path']
    assert p.exists() == pin['present'], pin['path']
    if pin['present']:
        b = p.read_bytes()
        assert len(b) == pin['bytes'] and digest(b) == pin['sha256'], pin['path']
        assert b[:4] == b'glTF' and int.from_bytes(b[4:8], 'little') == 2
        assert int.from_bytes(b[8:12], 'little') == len(b)
for pin in r['recipes']:
    b = (root / pin['path']).read_bytes()
    assert len(b) == pin['bytes'] and digest(b) == pin['sha256'], pin['path']
c = root / 'captures/wardrobe-hair-cut-2026-10-03-v1'
n = json.loads((c / 'report.json').read_bytes())
chin = json.loads((root / 'looks/sage-lavender-chin.json').read_bytes())
long = json.loads((root / 'looks/sage-lavender-long.json').read_bytes())
assert chin == n['guards'][0]['snapshot']['configuration']
assert (root / 'looks/sage-lavender-long.json').read_bytes() == (c / 'changed-look.json').read_bytes()
assert {**chin, 'hair': 'bob01'} == long and chin['hair'] == 'bob02'
manifest = json.loads((root / 'assets/wardrobe/manifest.json').read_bytes())
by_id = {g['id']: g for g in manifest['garments']}
assert len(r['queries']) == 35 and len({(q['id'], q['key']) for q in r['queries']}) == 35
assert sum(q['admitted'] for q in r['queries']) == 7
for q in r['queries']:
    assert q['admitted'] == (q['key'] in by_id[q['id']]['fragments'])
    if q['admitted']: assert q['url'] == by_id[q['id']]['fragments'][q['key']]
    else: assert q['error'] == f"GarmentManifest: '{q['id']}' has no fragment for figure '{q['key']}'. It declares g050."
assert sum(p['present'] and not p['declared'] for p in r['physicalFiles']) == 14
result = dict(status='pass', pid=os.getpid(), started=started,
    finished=datetime.now(timezone.utc).isoformat(),
    command='python3 docs/evidence/nonhair-2026-10-03/representation-recipes/root-check.py',
    sourceSHA256=digest(Path(__file__).read_bytes()), receiptSHA256=digest(raw),
    inputPins=len(r['inputs']), physicalRecords=len(r['physicalFiles']),
    existingPhysicalFiles=sum(p['present'] for p in r['physicalFiles']),
    recipes=2, uniqueQueries=35, admitted=7, refused=28,
    undeclaredEndpointFiles=14, exactOrigins=True, noRuntimeQueryReplay=True)
with (packet / 'root-verification.json').open('x') as f:
    json.dump(result, f, indent=2); f.write('\n')
print(json.dumps(result))
