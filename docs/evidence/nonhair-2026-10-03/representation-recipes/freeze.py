"""Preserve this completed small packet and record delivery bytes, without rerunning it."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[4]
packet = Path(__file__).resolve().parent
value = packet.parent / 'representation-value'
digest = lambda b: hashlib.sha256(b).hexdigest()
started = datetime.now(timezone.utc).isoformat()
r = json.loads((packet / 'receipt.json').read_bytes())
assert r['status'] == 'pass'
for pin in r['inputs']:
    b = (root / pin['path']).read_bytes()
    assert len(b) == pin['bytes'] and digest(b) == pin['sha256'], pin['path']
for pin in r['physicalFiles']:
    p = root / pin['path']
    assert p.exists() == pin['present']
    if pin['present']:
        b = p.read_bytes()
        assert len(b) == pin['bytes'] and digest(b) == pin['sha256']
for pin in r['recipes']:
    b = (root / pin['path']).read_bytes()
    assert len(b) == pin['bytes'] and digest(b) == pin['sha256']
assert digest((packet / 'CRITIC-POSTFLIGHT.md').read_bytes()) == 'fcc5c13e3a3bdda2f475bb9ee694aa3a7fca20c818e1e76a926a2e4592f93a4a'
files = sorted(p for folder in (packet, value) for p in folder.iterdir() if p.is_file())
assert not (packet / 'freeze.json').exists()
rows = []
for p in files:
    b = p.read_bytes()
    rows.append(dict(path=str(p.relative_to(root)), bytes=len(b), sha256=digest(b)))
delivery = []
for relative in ['looks/sage-lavender-chin.json', 'looks/sage-lavender-long.json', 'looks/README.md', 'README.md', 'docs/PROGRESS-2026-10-02.md']:
    b = (root / relative).read_bytes()
    delivery.append(dict(path=relative, bytes=len(b), sha256=digest(b), mode='editable delivery/live document; closeout hash only'))
result = dict(status='pass', pid=os.getpid(), started=started, finished=datetime.now(timezone.utc).isoformat(),
    command='python3 docs/evidence/nonhair-2026-10-03/representation-recipes/freeze.py',
    purpose='Documentation/preservation closeout after the investigation deadline; no new experiment',
    unchangedInputPins=len(r['inputs']), physicalRecords=len(r['physicalFiles']),
    files=rows, delivery=delivery, frozenFiles=len(rows), frozenBytes=sum(x['bytes'] for x in rows))
with (packet / 'freeze.json').open('x') as f:
    json.dump(result, f, indent=2); f.write('\n')
for p in [*files, packet / 'freeze.json']:
    p.chmod(0o444)
    assert p.stat().st_mode & 0o222 == 0
print(json.dumps({k:v for k,v in result.items() if k not in ('files', 'delivery')}))
print('freezeSHA256=' + digest((packet / 'freeze.json').read_bytes()))
