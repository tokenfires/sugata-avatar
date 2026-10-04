from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os

started = datetime.now(timezone.utc).isoformat()
root = Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-04/rowan-portrait'
paths = [
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/PLAN.md',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/ROWAN.json',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/preview.html',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/preview.mjs',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/SOURCE-FINDING.md',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/CHECKS.md',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/PREVIOUS-CLOSEOUT.md',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait-worth/CRITIC-VALUE.md',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait-worth/SOURCE-CORRECTION.md',
    'packages/core/src/Avatar.js',
    'packages/core/src/figure/Identity.js',
    'packages/core/src/material/HairColourOptions.js',
    'packages/core/src/render/Stage.js',
    'packages/testbed/src/portrait.js',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/critic-source-pins.py',
]
pins = []
for relative in paths:
    data = (root / relative).read_bytes()
    pins.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
receipt = {
    'scope': 'Filesystem source-byte readback only; no import, asset parsing, evaluator, renderer or browser execution.',
    'command': 'python3 docs/evidence/nonhair-2026-10-04/rowan-portrait/critic-source-pins.py',
    'pid': os.getpid(), 'startedAt': started,
    'finishedAt': datetime.now(timezone.utc).isoformat(), 'pins': pins,
}
with (packet / 'CRITIC-SOURCE-PINS.json').open('x') as handle:
    json.dump(receipt, handle, indent=2)
    handle.write('\n')
print(json.dumps({'pid': receipt['pid'], 'startedAt': started, 'finishedAt': receipt['finishedAt'], 'pins': len(pins)}))
