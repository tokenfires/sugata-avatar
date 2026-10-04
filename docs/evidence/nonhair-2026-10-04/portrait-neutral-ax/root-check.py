"""Read-only reconciliation of the saved native trial, not a renderer test."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os

repo = Path(__file__).resolve().parents[4]
packet = Path(__file__).resolve().parent
started = datetime.now(timezone.utc).isoformat()
sha = lambda b: hashlib.sha256(b).hexdigest()
pre = json.loads((packet / 'ROOT-PREFLIGHT.json').read_text())
for item in pre['inputs']:
    data = (repo / item['path']).read_bytes()
    assert len(data) == item['bytes'] and sha(data) == item['sha256'], item['path']

def read(name):
    return (packet / name).read_text()

assert 'Live portrait' in read('ready-ax.txt')
assert 'Portrait unavailable' not in read('ready-ax.txt')
for name, selected, focused in [
    ('desktop-neutral-enter-ax.txt', 'Neutral', 47),
    ('desktop-warm-space-ax.txt', 'Warm', 46),
    ('desktop-studio-return-ax.txt', 'Studio', 45),
    ('mobile-neutral-ax.txt', 'Neutral', 47),
]:
    text = read(name)
    light = text.split('Description: LIGHT, ID: light-controls', 1)[1].split('ID: pause', 1)[0]
    for label in ('Studio', 'Warm', 'Neutral'):
        assert f'checkbox {label}, Value: {int(label == selected)}' in light, (name, label)
    assert f'The focused UI element is {focused} checkbox {selected}, Value: 1' in text, name
    assert 'Motion paused' in text, name
kitchen = read('stopped-kitchen-context-ax.txt')
assert 'checkbox Kitchen, Value: 1' in kitchen and 'Live portrait' in kitchen
assert 'Description: LIGHT' not in kitchen
assert 'scene=kitchen' in kitchen
stop = json.loads(read('STOP.json'))
assert '3000ms' in stop['error'] and 'Runtime.evaluate' in stop['error']
closed = json.loads(read('CLOSED.json'))
assert closed['tabId'] == '13' and closed['viewportReset'] is True
assert closed['closedObservedAt'] < '2026-10-04T07:46:00Z'
logs = json.loads(read('console.json'))
assert len(logs) == 8 and all(x['level'] == 'warn' for x in logs)
assert not (packet / 'kitchen-ready-ax.txt').exists()
assert not (packet / 'kitchen.jpg').exists()
assert not (packet / 'adopted-neutral.jpg').exists()
images = ['desktop-studio.jpg', 'desktop-neutral.jpg', 'desktop-warm.jpg',
          'mobile-neutral.jpg', 'mobile-upper.jpg', 'stopped-kitchen-context.jpg']
for name in images:
    data = (packet / name).read_bytes()
    assert data[:2] == b'\xff\xd8' and data[-2:] == b'\xff\xd9', name
payloads = []
for path in sorted(packet.iterdir()):
    if path.is_file() and path.name not in ('ROOT-RESULT.json', 'SHA256SUMS', 'FREEZE.json'):
        data = path.read_bytes()
        payloads.append({'path': path.name, 'bytes': len(data), 'sha256': sha(data),
                         'filesystemMtimeUTC': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()})
result = {'pid': os.getpid(), 'started': started,
          'finished': datetime.now(timezone.utc).isoformat(),
          'inputsChecked': pre['inputs'], 'payloads': payloads,
          'decision': 'B: first declared readiness failure; exact accepted Portrait untouched; no adoption or retry',
          'successfulSubset': 'Native Studio/Neutral/Warm exclusive selection and focus; readable 390x844 Neutral row',
          'imageReview': 'Root actually viewed all six untouched native JPEGs in Cua; mobile-upper is partial adjacent content, Kitchen context is top viewport only',
          'limits': 'No numeric overflow, matched appearance, actual tier/backend, calibration, motion/AAA acceptance, SDK/GPU/late-owner ledger or proven timeout cause. Filesystem mtimes are not capture acquisition timestamps.'}
(packet / 'ROOT-RESULT.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
