import datetime, hashlib, json, os, struct
from pathlib import Path
p = Path(__file__).resolve().parent
receipt = {'pid': os.getpid(), 'startUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'command': 'python3 docs/evidence/nonhair-2026-10-03/ink-ao/critic-result-readback.py', 'pins': {}}
names = ['PLAN.md', 'preview.mjs', 'preview.html', 'CONTROL-STOP.md', 'INK-balanced.json', 'INK-high.json'] + ['capture/' + name for name in ['balanced-body.png', 'balanced-portrait.png', 'high-body.png', 'balanced-body-state.json', 'balanced-portrait-state.json', 'high-body-state.json', 'balanced-retirement.json', 'high-retirement.json', 'balanced-console.json', 'high-console.json']]
for name in names:
    data = (p / name).read_bytes()
    record = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    if name.endswith('.png'):
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        record['dimensions'] = list(struct.unpack('>II', data[16:24]))
        assert record['dimensions'] == [1800, 2100]
    receipt['pins'][name] = record
b, h = [json.loads((p / ('capture/' + n + '-retirement.json')).read_text()) for n in ['balanced', 'high']]
assert [s['name'] for s in b['states']] == ['balanced-body', 'balanced-portrait']
assert [s['name'] for s in h['states']] == ['high-body']
assert not (p / 'capture/high-portrait.png').exists()
for tier, log in [('balanced', b), ('high', h)]:
    assert log['failure'] is None
    assert log['retirement']['disposal'] == {'disposed': True, 'leaked': []}
    assert log['retirement']['error'] is None and log['retirement']['pendingAtRetirement'] is False
    for s in log['states']:
        assert s['complete'] is True and s['clockSeconds'] == 0
        assert s['report']['quality']['tier'] == tier and s['report']['quality']['backend'] == 'webgpu'
        assert s['report']['motion']['frame'] == (64 if s['frame'] == 'portrait' else 32)
    assert json.loads((p / ('capture/' + tier + '-body-state.json')).read_text())['states'] == log['states'][:1]
assert json.loads((p / 'capture/balanced-portrait-state.json').read_text())['states'] == b['states']
assert b['states'][0]['camera'] == h['states'][0]['camera']
assert b['states'][0]['canvas'] == h['states'][0]['canvas']
for tier in ['balanced', 'high']:
    logs = json.loads((p / ('capture/' + tier + '-console.json')).read_text())
    assert len(logs) == 3 and all(row['level'] == 'warn' for row in logs)
receipt.update(status='READBACK-PASS', states=3, images=3, highPortraitPresent=False, bodyCameraEquality=True, endUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(), limits='FS/JSON/header readback only; no rendering, pixel metrics, asset parser, guard replay, network or allocator proof.')
with (p / 'CRITIC-RESULT-READBACK.json').open('x') as f:
    json.dump(receipt, f, indent=2); f.write('\n')
print(json.dumps({k: receipt[k] for k in ['pid', 'startUTC', 'endUTC', 'status', 'states', 'images']}))
