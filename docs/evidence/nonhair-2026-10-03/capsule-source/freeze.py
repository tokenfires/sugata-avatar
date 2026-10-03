"""Preservation/readback only; the 13:51 source investigation is closed."""
import hashlib
import json
import os
import tomllib
import zipfile
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[4]
packet = Path(__file__).resolve().parent
sha = lambda b: hashlib.sha256(b).hexdigest()
started = datetime.now(timezone.utc).isoformat()
inv = json.loads((packet / 'source-inventory.json').read_bytes())
copy = json.loads((packet / 'control-copy.json').read_bytes())
for pin in inv['archives']:
    p = root / pin['path']; h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1048576), b''): h.update(b)
    assert p.stat().st_size == pin['bytes'] and h.hexdigest() == pin['sha256']
for pin in inv['entries']:
    with zipfile.ZipFile(root / pin['archive']) as z: b = z.read(pin['entry'])
    assert len(b) == pin['bytes'] and sha(b) == pin['sha256']
    if 'exactLocalCopy' in pin: assert (root / pin['exactLocalCopy']).read_bytes() == b
for pin in copy['controls']:
    b = (root / pin['path']).read_bytes()
    assert len(b) == pin['bytes'] and sha(b) == pin['sha256']
with zipfile.ZipFile(root / inv['archives'][1]['path']) as z:
    for pin in copy['textures']:
        b = z.read(pin['archiveEntry']); assert len(b) == pin['bytes'] and sha(b) == pin['sha256']
assert sha((root / 'docs/research/wardrobe-capsule.json').read_bytes()) == copy['capsuleSHA256']
assert all((root / p['path']).exists() == p['present'] for p in copy['historicalReferences'])
assert sha((packet / 'AUTHORING-RESPONSIBILITY.md').read_bytes()) == 'd9ea63005a1916145c0cfb0bf3fb1551521b40a82975869a0261b16a2c18d4f0'
assert sha((packet / 'CRITIC-VALUE.md').read_bytes()) == 'a61e78604ccf525ad4883c7786ddf76b05e2a2ba5768fc705ece4971ce86990b'
automationPath = Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml')
automationBytes = automationPath.read_bytes(); a = tomllib.loads(automationBytes.decode())
assert a['status'] == 'ACTIVE' and a['rrule'] == 'FREQ=MINUTELY;INTERVAL=10'
assert a['target_thread_id'] == '01a0ff57-d720-7db2-923f-9e3e0521216c'
files = sorted(p for p in packet.rglob('*') if p.is_file())
rows = [dict(path=str(p.relative_to(root)), bytes=p.stat().st_size, sha256=sha(p.read_bytes())) for p in files]
result = dict(pid=os.getpid(), started=started, finished=datetime.now(timezone.utc).isoformat(),
    command='python3 docs/evidence/nonhair-2026-10-03/capsule-source/freeze.py', status='pass',
    scope='Preservation-only closeout; no source probe, import, builder or new appearance qualification',
    archivePins=2, memberPins=13, copiedControls=3, copiedThumbnails=3, texturePins=3,
    frozenFiles=len(rows), frozenBytes=sum(p['bytes'] for p in rows), files=rows,
    automation=dict(path=str(automationPath), sha256=sha(automationBytes), status=a['status'], cadenceMinutes=10, targetThread=a['target_thread_id']))
with (packet / 'freeze.json').open('x') as f: json.dump(result, f, indent=2); f.write('\n')
for p in [*files, packet / 'freeze.json']:
    p.chmod(0o444); assert p.stat().st_mode & 0o222 == 0
print(json.dumps({k:v for k,v in result.items() if k != 'files'}))
print('freezeSHA256=' + sha((packet / 'freeze.json').read_bytes()))
