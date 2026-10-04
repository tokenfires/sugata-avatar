"""Read-only bounded source/image pin receipt; no GLB parsing or runtime import."""
from pathlib import Path
import hashlib, json, os, datetime

root = Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/body-breadth-worth'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
paths = [
    'docs/evidence/nonhair-2026-10-03/body-breadth-worth/PLAN.md',
    'packages/core/src/figure/Identity.js',
    'packages/core/src/Avatar.js',
    'docs/PRODUCT-ROADMAP.md',
    'docs/NONHAIR-QUEUE-2026-09-26.md',
    'docs/OVERNIGHT-2026-09-08.md',
    'docs/evidence/nonhair-2026-10-03/endpoint-starter-value/CRITIC-VALUE.md',
    'docs/evidence/nonhair-2026-10-03/representation-recipes/receipt.json',
    'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-portrait.png',
]
pins = []
for name in paths:
    data = (root / name).read_bytes()
    pins.append({'path': str(root / name), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
source = Path(__file__).read_bytes()
receipt = {
    'scope': 'FS bytes/hash receipt only; no GLB parse/import/evaluator/runtime/browser/GPU',
    'command': 'python3 docs/evidence/nonhair-2026-10-03/body-breadth-worth/critic-worth-pins.py',
    'pid': os.getpid(), 'startUTC': started,
    'sourcePath': str(Path(__file__).resolve()), 'sourceSHA256': hashlib.sha256(source).hexdigest(),
    'pins': pins, 'exitCode': 0,
    'endUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
target = packet / 'CRITIC-WORTH-PINS.json'
with target.open('x') as f:
    json.dump(receipt, f, indent=2)
    f.write('\n')
print(json.dumps({'pid': receipt['pid'], 'startUTC': receipt['startUTC'], 'endUTC': receipt['endUTC'], 'exitCode': 0, 'pins': len(pins), 'sourceSHA256': receipt['sourceSHA256'], 'receiptSHA256': hashlib.sha256(target.read_bytes()).hexdigest()}))
