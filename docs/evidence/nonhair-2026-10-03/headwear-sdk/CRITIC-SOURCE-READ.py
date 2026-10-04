import hashlib, json, os
from datetime import datetime, timezone
from pathlib import Path

root = Path('/Users/robault/GitHub/sugata-avatar')
folder = root / 'docs/evidence/nonhair-2026-10-03/headwear-sdk'
started = datetime.now(timezone.utc).isoformat()
source = json.loads((folder / 'SOURCE.json').read_text())
rows = []
for item in source['pins']:
    b = (root / item['file']).read_bytes()
    h = hashlib.sha256(b).hexdigest()
    assert h == item['sha256'] and len(b) == item['bytes'], item['file']
    rows.append(dict(item))
for name in ['PLAN.md', 'SDK-OPTIONS.json', 'SOURCE.json', 'native.mjs', 'CRITIC-WORTH.md', 'CRITIC-SOURCE.md', 'CRITIC-SOURCE-READ.py']:
    b = (folder / name).read_bytes()
    rows.append({'file': str((folder / name).relative_to(root)), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
result = {'command': 'python3 docs/evidence/nonhair-2026-10-03/headwear-sdk/CRITIC-SOURCE-READ.py', 'pid': os.getpid(), 'started': started, 'finished': datetime.now(timezone.utc).isoformat(), 'status': 'source-only-readback', 'decision': 'WITHHELD; substantive async ownership blocker; no runtime execution', 'pins': rows}
with (folder / 'CRITIC-SOURCE-PINS.json').open('x') as f:
    f.write(json.dumps(result, indent=2) + '\n')
print(json.dumps({'pid': result['pid'], 'started': started, 'finished': result['finished'], 'pins': len(rows), 'noteSha256': hashlib.sha256((folder / 'CRITIC-SOURCE.md').read_bytes()).hexdigest(), 'receiptSha256': hashlib.sha256((folder / 'CRITIC-SOURCE-PINS.json').read_bytes()).hexdigest()}))
