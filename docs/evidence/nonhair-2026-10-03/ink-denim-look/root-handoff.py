"""Reconcile the critic's new handoff against independently retained evidence."""
from pathlib import Path
import json, hashlib, datetime, os, math
ROOT = Path('/Users/robault/GitHub/sugata-avatar')
P = ROOT / 'docs/evidence/nonhair-2026-10-03/ink-denim-look'
RAW = ROOT / 'captures/ink-denim-look-2026-10-03-v1'
H = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
assert (P / 'CRITIC-POSTFLIGHT.md').exists()
c = json.loads((P / 'critic-state-readback.json').read_text())
r = json.loads((RAW / 'report.json').read_text())
own = json.loads((P / 'ROOT-READBACK.json').read_text())
assert H(P / 'critic-state-check.py') == c['sourceSHA256'] == '6a1d50c879f15cce10c1001f3d393481d0e7544b90990b5342c9b61199891295'
assert H(P / 'critic-state-readback.json') == 'b3e05c8ab98f5d2d5ff43f732736f6ec225d057c3b3290c6cad2338c28542bdb'
assert c['reportSHA256'] == H(RAW / 'report.json')
mapped = {}
for file, h in c['sourceInputPins'].items():
    p = Path(file) if Path(file).is_absolute() else ROOT / file
    assert H(p) == h == own['pins'][str(p)]
    mapped[str(p)] = h
assert len(mapped) == 385 and c['sources'] == 380 and c['inputs'] == 5
assert (c['states'], c['steps'], c['actualGLBResponses'], c['uniqueGLBFiles']) == (18, 102, 24, 6)
for row in own['images']:
    v = c['images'][row['file']]
    assert v['sha256'] == row['sha256'] and v['dimensions'] == row['size'] and v['bytes'] == row['bytes']
assert c['warningCounts'] == own['warnings']
# Source AttentionAction uses this Horner form. The critic uses expanded quintic.
def eased(u):
    v = max(0.0, min(1.0, u))
    return v*v*v*(v*(6*v-15)+10)
residual = 0.0
def compare(actual, expected):
    global residual
    residual = max(residual, abs(actual-expected))
    assert abs(actual-expected) < 2e-12
for s in r['steps']:
    a = s['attention']
    if s['segment'] == 'held':
        t = a['time']
        compare(t, s['i']/60)
        compare(a['poseWeight'], eased((t-.25)/.6))
        compare(a['smileWeight'], eased((t-.25)/.6))
        compare(a['headNoiseScale'], 1-.75*eased(t/.5))
    elif s['i'] < 18:
        t = a['time']
        compare(t, s['i']/60)
        compare(a['poseWeight'], 1-eased(t/.3))
        compare(a['smileWeight'], 1-eased(t/.3))
        compare(a['headNoiseScale'], 1-.75*(1-eased(t/.3)))
    else:
        assert a['phase'] == 'idle' and a['poseWeight'] == a['smileWeight'] == 0
for im in r['images']:
    assert im['before']['camera'] == im['after']['camera']
    assert im['before']['attention'] == im['after']['attention']
    assert im['before']['configuration'] == im['after']['configuration']
    for k in ['frame', 'timeSeconds', 'seed']:
        assert im['before']['attached']['motion'][k] == im['after']['attached']['motion'][k]
for s in r['states']:
    a = s['attached']; h = a['hair']['colour']; w = a['wardrobe']
    assert a['identity'] == {'gender': .5, 'bake': 'figure_g050'}
    assert h['requested'] == h['applied'] == h['resolved'] == '#413934' and h['matchesAttached']
    assert h['requestedTint'] is None and h['appliedTint'] is None
    assert w['appearance'] == {'style': 'ecru', 'colours': r['recipe']['wardrobe']['colours'], 'attached': True}
    assert w['foundation'] == r['recipe']['wardrobe']['foundation'] and w['state']['pendingFragments'] == 0
for path in ['critic-state-check.py', 'critic-state-readback.json', 'CRITIC-POSTFLIGHT.md', 'ROOT-READBACK.json', 'ROOT-VISUAL.md']:
    mapped[str(P / path)] = H(P / path)
result = {'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(),
          'command': 'python3 docs/evidence/nonhair-2026-10-03/ink-denim-look/root-handoff.py', 'pins': mapped,
          'maxEnvelopeResidual': residual, 'actualOriginalsViewedSeparately': 6,
          'decision': 'optional composition only; both independently inspected visual/source handoffs agree', 'nativeReplay': False}
(P / 'ROOT-HANDOFF.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'pins'}))
print(json.dumps({'pins': len(mapped), 'receiptSHA256': H(P / 'ROOT-HANDOFF.json')}))
