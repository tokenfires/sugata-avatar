import datetime, hashlib, json, os, pathlib

root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-04/hair-contact-docs-worth'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
paths = [
    'docs/API.md', 'packages/core/src/Avatar.js',
    'packages/core/src/motion/HairBodyContactCalibration.js',
    'packages/core/src/motion/HairDynamics.js',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/FRONT-STATE.json',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/RETIRED-STATE.json',
    'docs/evidence/nonhair-2026-10-04/rowan-portrait/CRITIC-RESULT.md',
]
pins = []
for relative in paths:
    data = (root / relative).read_bytes()
    pins.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
front = json.loads((root / paths[4]).read_text())
retired = json.loads((root / paths[5]).read_text())
fields = ['attached', 'loadedStyle', 'bake', 'unavailableReason', 'bodyContact', 'bodyContactUnavailableReason']
reports = {}
for name, state in [('front', front), ('retired', retired)]:
    reports[name] = {which: {field: report['hair'][field] for field in fields}
        for which, report in [('creation', state['creation']['report']), ('view', state['views'][0]['report'])]}
    for values in reports[name].values():
        assert values == {'attached': True, 'loadedStyle': 'bob01', 'bake': 'figure_g100',
            'unavailableReason': None, 'bodyContact': None,
            'bodyContactUnavailableReason': 'No body-contact calibration for bob01 on figure_g100.'}
api = (root / paths[0]).read_text()
assert 'bodyContactUnavailableReason' not in api and 'bodyContact' not in api
output = {'pid': os.getpid(), 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'inputs': pins, 'observedReports': reports,
    'scope': 'Saved public reports and current API field absence only. Source semantics independently read by root; no runtime, visual cause, contact activation, fit or motion inference.'}
(packet / 'ROOT-READBACK.json').write_text(json.dumps(output, indent=2) + '\n')
print(json.dumps({'pid': output['pid'], 'started': output['started'], 'finished': output['finished'], 'inputs': len(pins), 'observedReports': reports}))
