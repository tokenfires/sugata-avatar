"""Root reconciliation of the complete independent handoff, without replay."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, re

p = Path(__file__).resolve().parent
repo = Path(__file__).resolve().parents[4]
start = datetime.now(timezone.utc).isoformat()
digest = lambda data: hashlib.sha256(data).hexdigest()
critic = (p / 'CRITIC-RESULT.md').read_bytes()
assert digest(critic) == 'cada174f2e9b4b444274e0490a2b2e768bca8d0efd42d3a8f27a85069490e5c2'
aliases = {
    'desktop-neutral-enter-ax, mobile-neutral-ax and mobile-upper-ax':
        ['desktop-neutral-enter-ax.txt', 'mobile-neutral-ax.txt', 'mobile-upper-ax.txt'],
    'desktop-studio-return-ax and mobile-before-ax':
        ['desktop-studio-return-ax.txt', 'mobile-before-ax.txt'],
}
pins = []
for name, value in re.findall(r'^\| ([^|]+?) \| ([0-9a-f]{64}) \|$', critic.decode(), re.M):
    for filename in aliases.get(name, [name]):
        data = (p / filename).read_bytes()
        assert digest(data) == value, filename
        pins.append({'path': filename, 'bytes': len(data), 'sha256': value})
assert len(pins) == 23, len(pins)
for item in json.loads((p / 'ROOT-PREFLIGHT.json').read_text())['inputs']:
    data = (repo / item['path']).read_bytes()
    assert len(data) == item['bytes'] and digest(data) == item['sha256'], item['path']
result = {'pid': os.getpid(), 'started': start, 'finished': datetime.now(timezone.utc).isoformat(),
          'criticBytes': len(critic), 'criticSHA256': digest(critic), 'criticPins': pins,
          'sourcePinsChecked': 8,
          'rootReview': 'Complete final handoff read; root independently viewed all six native originals and checked saved AX/context/source. Agrees B with finite successful subsets.',
          'precision': 'STOP observedAt 07:36:20.788 is receipt-write time after stopped context, not the exact failed-wait acquisition timestamp. Source/default auto and private lifetime limits preserved.',
          'decision': 'Close repetition line, no immediate Neutral/wait/evaluator/capture experiment; keep exact accepted Portrait and archive the closed candidate.'}
assert result['finished'] < '2026-10-04T07:49:00+00:00'
(p / 'FINAL-CHECK.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
