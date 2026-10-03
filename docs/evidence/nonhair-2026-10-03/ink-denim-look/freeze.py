"""Preserve only this closed slice's owned evidence, exact raw copies and admitted files."""
from pathlib import Path
import hashlib, json, datetime, os
ROOT = Path('/Users/robault/GitHub/sugata-avatar')
P = ROOT / 'docs/evidence/nonhair-2026-10-03/ink-denim-look'
V = ROOT / 'docs/evidence/nonhair-2026-10-03/ink-denim-value'
RAW = ROOT / 'captures/ink-denim-look-2026-10-03-v1'
H = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
assert not (P / 'PRESERVATION.json').exists()
pins = json.loads((P / 'ROOT-READBACK.json').read_text())['pins']
pins.update(json.loads((P / 'ROOT-HANDOFF.json').read_text())['pins'])
delivery = json.loads((P / 'DELIVERY.json').read_text())
for file, h in delivery['outputs'].items():
    pins[str(ROOT / file)] = h
for file, h in pins.items():
    assert H(file) == h, file
value = json.loads((V / 'ROOT-VALUE.json').read_text())['pins']
historical = []
for file, h in value.items():
    path = ROOT / file
    if file == 'looks/README.md':
        path = P / 'LOOKS-README-BEFORE.md.source'
    assert H(path) == h
    historical.append({'originalPath': file, 'preservedPath': str(path), 'sha256': h})
copies = json.loads((P / 'ARCHIVE-COPIES.json').read_text())['files']
for c in copies:
    assert H(ROOT / c['source']) == H(ROOT / c['destination']) == c['sha256']
rows = []
for folder in [P, V]:
    for f in sorted(folder.rglob('*')):
        if f.is_file():
            rows.append({'file': str(f.relative_to(ROOT)), 'bytes': f.stat().st_size, 'sha256': H(f)})
for f in [ROOT / 'tools/critic/ink-denim-look.mjs', *RAW.iterdir(), *[ROOT / r['file'] for r in rows]]:
    assert f.is_file()
    f.chmod(0o444)
result = {'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(),
          'command': 'python3 docs/evidence/nonhair-2026-10-03/ink-denim-look/freeze.py', 'files': rows,
          'fileCount': len(rows), 'bytes': sum(r['bytes'] for r in rows), 'currentPins': pins, 'valueHistoricalInputs': historical,
          'rawCopies': copies, 'scope': 'preservation only; no rerun or accepted asset/default/unrelated worktree modification'}
(P / 'PRESERVATION.json').write_text(json.dumps(result, indent=2) + '\n')
(P / 'PRESERVATION.json').chmod(0o444)
print(json.dumps({k: result[k] for k in ['started', 'finished', 'pid', 'command', 'fileCount', 'bytes']}))
print(json.dumps({'currentPins': len(pins), 'historicalValueInputs': len(historical), 'rawCopies': len(copies), 'manifestSHA256': H(P / 'PRESERVATION.json')}))
