"""Independent retained-byte/state audit. Does not launch or replay native work."""
from pathlib import Path
import hashlib, json, struct, datetime, os, collections

ROOT = Path('/Users/robault/GitHub/sugata-avatar')
PACKET = ROOT / 'docs/evidence/nonhair-2026-10-03/ink-denim-look'
RAW = ROOT / 'captures/ink-denim-look-2026-10-03-v1'
utc = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
digest = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
started = utc()
r = json.loads((RAW / 'report.json').read_text())
job = json.loads((PACKET / 'NATIVE-JOB.json').read_text())
assert r['status'] == 'observed' and job['exitCode'] == 0 and not job['timeout']
assert job['nativePID'] == r['pid'] == 59879 and job['collection'] == 'collected'
assert digest(RAW / 'report.json') == 'ef33303c76dde505cb3f274c6de29f3b3d2e45716d94d233b836144b8fdd26d7'
assert digest(PACKET / 'native.log') == job['logSHA256']
pins = {}
for file, h in {**r['sources'], **r['inputs']}.items():
    p = Path(file) if Path(file).is_absolute() else ROOT / file
    assert digest(p) == h, file
    pins[str(p)] = h
assert digest(ROOT / 'tools/critic/ink-denim-look.mjs') == r['instrumentSHA256'] == digest(RAW / 'instrument.mjs')
pins[str(ROOT / 'tools/critic/ink-denim-look.mjs')] = r['instrumentSHA256']
assert (RAW / 'ink-denim.json').read_bytes() == (PACKET / 'CANDIDATE.json').read_bytes()
assert digest(RAW / 'ink-denim.json') == r['download']['sha256']
assert json.loads((RAW / 'ink-denim.json').read_text()) == r['recipe'] == r['download']['configuration']
assert 'hairTint' not in r['recipe'] and r['recipe']['frame'] == 'body' and r['recipe']['lighting'] == 'neutral'
assert not r['errors'] and not r['failedResources'] and r['finalPinsUnchanged'] is True
assert len(r['states']) == 18 and len(r['images']) == 6
storage = r['states'][0]['storage']
for s in r['states']:
    config = s['configuration']
    assert config['scene'] in ['studio', 'kitchen'] and config['frame'] in ['body', 'portrait']
    expected = dict(r['recipe'], scene=config['scene'], frame=config['frame'])
    if config['scene'] == 'kitchen':
        del expected['lighting']
    assert config == expected and s['storage'] == storage
    assert s['backend'] == 'webgpu' and s['webGPU'] is True
    assert s['attached']['hair']['attached'] and s['attached']['wardrobe']['attached']
    assert s['attached']['wardrobe']['pendingCandidates'] == 0
    assert s['attached']['hair']['loadedStyle'] == 'bob02'
images = []
names = ['neutral-body.png', 'neutral-portrait.png', 'kitchen-body.png', 'kitchen-portrait.png', 'smile-held.png', 'smile-released.png']
assert [x['file'] for x in r['images']] == names
for row in r['images']:
    p = RAW / row['file']
    b = p.read_bytes()
    assert b[:8] == b'\x89PNG\r\n\x1a\n' and row['completed'] is True
    assert len(b) == row['bytes'] and digest(p) == row['sha256']
    assert row['before']['configuration'] == row['after']['configuration']
    size = struct.unpack('>II', b[16:24])
    assert size == (900, 868)
    images.append({'file': row['file'], 'sha256': row['sha256'], 'size': size, 'bytes': len(b)})
    pins[str(p)] = row['sha256']
steps = r['steps']
assert len(steps) == 102
for segment, count in [('held', 72), ('released', 30)]:
    rows = [s for s in steps if s['segment'] == segment]
    assert len(rows) == count and [s['i'] for s in rows] == list(range(1, count + 1))
    assert all(s['delta'] == 1 / 60 for s in rows)
states = {s['label']: s for s in r['states']}
held = states['held-end']['attention']
assert held['phase'] == 'attending' and held['expression'] == 'soft-smile' and abs(held['time'] - 1.2) < 1e-10
assert held['smile'] == {'amount': .18, 'status': 'applied'}
assert states['manual-release']['attention']['phase'] == 'releasing'
assert states['released-end']['attention']['phase'] == 'idle'
assert states['released-end']['attention']['smile'] == {'amount': 0, 'status': 'inactive'}
assert states['before-smile']['pausePressed'] == 'true' and states['smile-start']['pausePressed'] == 'false'
assert len(r['assets']) == 24
counts = collections.Counter(a['file'] for a in r['assets'])
assert len(counts) == 6 and set(counts.values()) == {4}
for a in r['assets']:
    assert a['sha256'] == a['expectedSHA256'] == r['sources'][a['file']]
assert [x['label'] for x in r['retirements']] == ['json-reopen', 'kitchen-load', 'studio-return']
for x in r['retirements']:
    assert not x['persisted'] and x['disposal'] == {'disposed': True, 'leaked': []}
assert r['retirement'] == {'disposed': True, 'leaked': []}
assert r['cleanup'] == {'page': 'closed', 'browser': 'closed', 'server': 'closed', 'assetReads': {'drained': True, 'recordedPromises': 24}}
assert len(r['warnings']) == 18
for p in [RAW / 'report.json', RAW / 'ink-denim.json', RAW / 'instrument.mjs', PACKET / 'native.log', PACKET / 'NATIVE-JOB.json']:
    pins[str(p)] = digest(p)
result = {'started': started, 'finished': utc(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/nonhair-2026-10-03/ink-denim-look/root-readback.py',
          'status': 'retained evidence checked; appearance requires actual originals', 'pins': pins, 'images': images,
          'states': 18, 'steps': 102, 'assetResponses': 24, 'warnings': dict(collections.Counter(w['message'] for w in r['warnings'])),
          'nativeReplay': False}
(PACKET / 'ROOT-READBACK.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: result[k] for k in ['started', 'finished', 'pid', 'command', 'status', 'states', 'steps', 'assetResponses', 'nativeReplay']}))
print(json.dumps({'pins': len(pins), 'imageHeaders': len(images), 'receiptSHA256': digest(PACKET / 'ROOT-READBACK.json')}))
