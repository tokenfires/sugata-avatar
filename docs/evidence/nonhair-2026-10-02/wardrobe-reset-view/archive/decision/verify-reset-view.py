"""Independent static audit of one native camera-recovery packet; no browser/render."""
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import struct
import sys

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
out = Path('captures/wardrobe-reset-view-2026-10-02-v1')
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
report = json.loads((out / 'report.json').read_text())
assert sha(out / 'report.json') == 'fa7b787ab84489d050983aca6084bcfe4d474e13b3efb98e6bfbd88712a4b68e'
assert report['status'] == 'observed' and report['errors'] == [] and report['finalPinsUnchanged']
assert report['backend'] == {'backend': 'webgpu', 'isWebGPUBackend': True}
assert report['cleanup'] == {'page': 'closed', 'browser': 'closed'}
assert report['borrowedReviewServerRetained'] and report['retirements'] == [{'disposed': True, 'leaked': []}]
assert datetime.datetime.fromisoformat(report['finished'].replace('Z', '+00:00')) < datetime.datetime.fromisoformat(report['hardStop'].replace('Z', '+00:00'))
pins = {}
for p, h in report['sources'].items():
    assert sha(p) == h
    pins[p] = h
for p, h in report['dependencies'].items():
    assert sha(p) == h and sha(out / Path(p).name) == h
assert sha('tools/critic/wardrobe-reset-view-ui.mjs') == report['instrumentSHA256'] == sha(out / 'instrument.mjs')
for f in ['showcase.js', 'showcase.html', 'viewer-framing.mjs']:
    assert sha(out / f) == report['sources']['packages/testbed/src/' + f]
for asset in report['assets']:
    assert sha(asset['file']) == asset['sha256'] == report['sources'][asset['file']]

def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
def max_component(a, b):
    return max(abs(x-y) for x, y in zip(a, b))
def preserve(a, b):
    for field in ['configuration', 'url', 'storage', 'pause', 'clock']:
        assert a[field] == b[field], field
    assert b['ownerSame']
def validate_snapshot(s):
    assert all(finite(v) for k in ['position', 'target', 'quaternion'] for v in s[k])
    assert finite(s['zoom']) and s['zoom'] > 0
    assert set(s['clock']) == {'motion', 'utterance'} and all(finite(v) and v >= 0 for v in s['clock'].values())
    assert s['ownerSame'] and not s['disabled']
    assert abs(sum(v*v for v in s['quaternion']) - 1) < 1e-10
    w, h, aspect = s['viewport'][2:]
    assert w > 0 and h > 0 and aspect > 0 and s['framing']['gutterPixels'] == 16
    if s['framing']['mode'] == 'portrait':
        bounds = s['framing']['boundsAtUnitAspect']
        extent_x = max(abs(bounds['minX']), abs(bounds['maxX']))
        extent_y = max(abs(bounds['minY']), abs(bounds['maxY']))
        expected = min(1, max(.1, 1-32/w)*aspect/extent_x, max(.1, 1-32/h)/extent_y)
    else:
        assert s['framing']['mode'] == 'body'
        expected = 1
    assert abs(expected-s['zoom']) < 1e-12 and abs(expected-s['framing']['zoom']) < 1e-12
    expected_fov = math.degrees(2*math.atan(math.tan(math.radians(26)/2)/expected))
    assert abs(expected_fov-s['framing']['effectiveFov']) < 1e-10
    return expected

assert [c['label'] for c in report['cases']] == ['desktop-body', 'desktop-portrait', 'mobile-portrait', 'mobile-body']
observations, snapshots = [], 0
recovery_max, drift_max, canonical_max = 0.0, 0.0, 0.0
for case in report['cases']:
    baseline, disturbed, recovered = (case[k] for k in ['baseline', 'disturbed', 'recovered'])
    expected_zoom = validate_snapshot(baseline)
    assert baseline['pause'] == 'true' and baseline['attention'] == 'idle'
    assert len(case['drift']) == 8
    for key in ['position', 'target']:
        canonical_max = max(canonical_max, max_component(baseline[key], baseline['saved'][key]))
    canonical_max = max(canonical_max, abs(baseline['zoom']-baseline['saved']['zoom']))
    assert canonical_max <= 1e-10
    distance = lambda s: math.dist(s['position'], s['target'])
    orbit_change = math.dist(disturbed['position'], baseline['position'])
    distance_change = abs(distance(disturbed)-distance(baseline))
    assert orbit_change > .001 and distance_change > 1e-5
    preserve(baseline, disturbed)
    for name, states in [('recovered', [recovered]), ('drift', case['drift'])]:
        for s in states:
            validate_snapshot(s); snapshots += 1; preserve(baseline, s)
            assert s['saved'] == baseline['saved']
            error = max([max_component(s[k], baseline[k]) for k in ['position', 'target', 'quaternion']] + [abs(s['zoom']-baseline['zoom'])])
            assert error <= 1e-10
            if name == 'recovered': recovery_max = max(recovery_max, error)
            else: drift_max = max(drift_max, error)
    geo = case['geometry']; assert not geo['overflow'] and geo['text'] == 'Reset view' and geo['label'] == 'View controls'
    assert geo['button']['height'] >= 40 and geo['button']['width'] >= 70
    assert geo['pill']['x'] >= 0 and geo['pill']['x']+geo['pill']['width'] <= baseline['viewport'][0]
    assert case['keyboard'] == case['label'].startswith('mobile')
    observations.append({'case': case['label'], 'expectedZoom': expected_zoom, 'observedZoom': baseline['zoom'], 'orbitPositionChangeMetres': orbit_change, 'cameraDistanceChangeMetres': distance_change, 'buttonDimensions': [geo['button']['width'], geo['button']['height']]})
assert report['cases'][1]['baseline']['framing']['boundsAtUnitAspect'] == report['cases'][2]['baseline']['framing']['boundsAtUnitAspect']
assert report['cases'][2]['baseline']['zoom'] != report['cases'][1]['baseline']['zoom']

guards = report['guards']; assert len(guards) == 4
attention = guards[0]; assert attention['kind'] == 'active attention expected cancellation'
before, after = attention['before'], attention['after']
validate_snapshot(before); validate_snapshot(after); preserve(before, after)
assert before['pause'] == after['pause'] == 'false'
assert before['attention'] == 'attending' and after['attention'] == 'idle'
assert all(v > 0 for v in before['clock'].values())
assert guards[1]['kind'] == 'real outfit loading' and guards[1]['resetDisabled'] and guards[1]['status'] == 'Changing clothes…'
png = guards[2]; assert png['kind'] == 'held real PNG callback'
assert png['blocked']['before'] == png['blocked']['after']
validate_snapshot(png['before']); validate_snapshot(png['after']); preserve(png['before'], png['after'])
assert not png['after']['disabled'] and sha(out / 'guard-export.png') == png['exportSHA256']
raw = (out / 'guard-export.png').read_bytes(); assert raw[:8] == b'\x89PNG\r\n\x1a\n'
export_size = struct.unpack('>II', raw[16:24]); assert all(v > 0 for v in export_size)
assert guards[3]['kind'] == 'deliberate observed failure' and guards[3]['resetDisabled'] and 'Owned reset-availability probe' in guards[3]['text']
images = {}
assert len(report['images']) == 4
for image in report['images']:
    p = out / image['file']; raw = p.read_bytes()
    assert sha(p) == image['sha256'] and raw[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', raw[16:24]) == (image['viewport']['width'], image['viewport']['height'])
    images[image['file']] = image['sha256']
assert pins == {p: sha(p) for p in pins}
result = {'status': 'independent reset-view packet audit passed', 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/nonhair-2026-10-02/wardrobe-reset-view/verify-reset-view.py', 'interpreter': sys.executable, 'pythonVersion': platform.python_version(), 'verifierSHA256': sha(__file__), 'reportSHA256': sha(out / 'report.json'), 'sourcePins': pins, 'sourcePinsChecked': len(pins), 'dependenciesChecked': report['dependencies'], 'servedAssetsChecked': len(report['assets']), 'images': images, 'canonicalMaximumComponentError': canonical_max, 'recoveryMaximumComponentError': recovery_max, 'driftMaximumComponentError': drift_max, 'recoveredPlusDriftSnapshotsChecked': snapshots, 'observations': observations, 'activeClocksBefore': before['clock'], 'activeClocksAfter': after['clock'], 'realExportSHA256': png['exportSHA256'], 'realExportDimensions': export_size, 'warnings': report['warnings'], 'limits': ['No additional browser, GPU, render, asset construction or implementation mutation.', 'Portrait zoom/FOV verified from reported neutral-support bounds and current CSS dimensions/aspect; full support geometry was not independently recomputed.', 'Direct actor state/owner flags are observation evidence, not another independent live observer.', 'Busy/failure availability is observed; forced blocked handler dispatch is exercised only during held PNG export.', 'Keyboard Enter after explicit focus is not a complete tab-order or screen-reader test; no AAA appearance acceptance.']}
print(json.dumps(result, indent=2))
