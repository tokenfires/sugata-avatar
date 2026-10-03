"""Independent matrix/SVG audit of five images and offline sixth failure; no capture."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import struct
import sys
import xml.etree.ElementTree as ET
import numpy as np

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
out = Path('captures/hair-guide-targets-2026-10-02-v1')
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
report = json.loads((out / 'report.json').read_text())
assert report['status'] == 'failed' and len(report['views']) == 5
assert len(report['errors']) == 1 and 'Target annotation outside native frame' in report['errors'][0]
assert report['cleanup'] == {'page': 'closed', 'browser': 'closed', 'server': 'closed'}
assert report['finalPinsUnchanged'] and report['borrowedReviewServerRetained']
pins, snapshots = {}, 0
for p, h in report['sourceHashes'].items():
    assert sha(p) == h
    copy = out / 'sources' / p
    if copy.exists():
        assert sha(copy) == h
        snapshots += 1
    pins[p] = h
assert sha(out / 'inputs.json') == report['prepared']['sha256']
data = json.loads((out / 'inputs.json').read_text())
target = json.loads(Path('docs/evidence/appearance-2026-10-02/front-design/guide-targets-v1.json').read_text())
assert data['target'] == target
native = json.loads(Path('captures/hair-boundary-2026-10-02-v1/report.json').read_text())
native_by_view = {v['view']: v for v in native['views']}
for v in data['views']:
    assert v['state'] == native_by_view[v['view']]['state']
    assert v['beauty'] == native_by_view[v['view']]['beauty']
assert native_by_view['front-full']['state']['camera'] == native_by_view['front-bare']['state']['camera']

mat = lambda a: np.array(a).reshape(4, 4, order='F')
maximum_error = {'world': 0.0, 'ndc': 0.0, 'pixel': 0.0, 'svgPixel': 0.0}
projected_points = 0
failures, views, images = [], [], {}
def svg_points(e):
    return np.array([[float(c) for c in p.split(',')] for p in e.attrib['points'].split()])

for index, (view, orientation) in enumerate([('front-full', 'A'), ('front-full', 'B'), ('front-bare', 'A'), ('front-bare', 'B'), ('left-bare', 'A'), ('right-bare', 'B')]):
    state = native_by_view[view]['state']
    assert state['bones'][44]['name'] == 'head'
    pose = mat(state['bodyMatrix']) @ mat(state['bindMatrixInverse']) @ mat(state['bones'][44]['matrix']) @ mat(state['boneInverses'][44]) @ mat(state['bindMatrix'])
    camera = mat(state['camera']['projection']) @ mat(state['camera']['inverse'])
    def project(rest):
        world = pose @ np.r_[rest, 1.]
        clip = camera @ world
        assert abs(world[3] - 1) < 1e-10 and clip[3] > 0
        ndc = clip[:3] / clip[3]
        return {'rest': np.array(rest), 'world': world[:3], 'ndc': ndc, 'pixel': np.array([(ndc[0] + 1) * 450, (1 - ndc[1]) * 434])}
    def outside(p):
        return not (0 <= p['ndc'][2] <= 1 and 0 <= p['pixel'][0] <= 900 and 0 <= p['pixel'][1] <= 868)
    actual = report['views'][index] if index < 5 else None
    if actual:
        assert actual['view'] == view and actual['orientation'] == orientation and actual['state'] == state
        assert actual['nativeInput'] == native_by_view[view]['beauty']
        assert actual['avatarRuns'] == 0 and actual['replay'] and actual['unoccluded']
        image_path = out / actual['file']
        raw = image_path.read_bytes()
        assert sha(image_path) == actual['sha256'] and struct.unpack('>II', raw[16:24]) == (900, 868)
        images[actual['file']] = sha(image_path)
        svg = ET.fromstring(actual['svgOuterHTML'])
        polygons = [e for e in svg if e.tag.split('}')[-1] == 'polygon']
        polylines = [e for e in svg if e.tag.split('}')[-1] == 'polyline']
        assert len(polygons) == 192 and len(polylines) == 18
    rendered_outside, control_outside = 0, 0
    for g, guide in enumerate(target['orientations'][orientation]['guides']):
        expected_records = [{k: project(r[k]) for k in ['centre', 'minus', 'plus']} for r in guide['records']]
        expected_centres = [project(r['centre']) for r in guide['annotation']]
        expected_controls = [project(p) for p in guide['points']]
        projected_points += 51 + 257 + 4
        for category, points in [('sheet-record', [(k, i, r[k]) for i, r in enumerate(expected_records) for k in ['centre', 'minus', 'plus']]), ('centreline', [('centre', i, p) for i, p in enumerate(expected_centres)]), ('nonrendered-control', [('control', i, p) for i, p in enumerate(expected_controls)])]:
            for field, sample, p in points:
                if outside(p):
                    if category == 'nonrendered-control': control_outside += 1
                    else: rendered_outside += 1
                    failures.append({'view': view, 'orientation': orientation, 'role': guide['role'], 'category': category, 'field': field, 'sample': sample, 'rest': p['rest'].tolist(), 'pixel': p['pixel'].tolist(), 'ndc': p['ndc'].tolist()})
        if actual:
            a = actual['projected'][g]
            assert a['role'] == guide['role'] and a['width'] == guide['width'] and a['triangleCount'] == 32
            pairs = [(a['records'][i][k], r[k]) for i, r in enumerate(expected_records) for k in ['centre', 'minus', 'plus']]
            pairs += list(zip(a['controls'], expected_controls)) + list(zip(a['centreline'], expected_centres))
            for recorded, expected in pairs:
                assert np.array_equal(recorded['rest'], expected['rest'])
                for field in ['world', 'ndc', 'pixel']:
                    maximum_error[field] = max(maximum_error[field], float(np.max(abs(np.array(recorded[field]) - expected[field]))))
            expected_triangles = []
            for i in range(16):
                expected_triangles += [[expected_records[i]['minus']['pixel'], expected_records[i]['plus']['pixel'], expected_records[i+1]['plus']['pixel']], [expected_records[i]['minus']['pixel'], expected_records[i+1]['plus']['pixel'], expected_records[i+1]['minus']['pixel']]]
            for e, expected in zip(polygons[g*32:(g+1)*32], expected_triangles):
                assert e.attrib['data-role'] == guide['role'] and e.attrib['fill-opacity'] == '.23'
                maximum_error['svgPixel'] = max(maximum_error['svgPixel'], float(np.max(abs(svg_points(e) - expected))))
            expected_lines = [[r['minus']['pixel'] for r in expected_records], [r['plus']['pixel'] for r in expected_records], [r['pixel'] for r in expected_centres]]
            for e, expected in zip(polylines[g*3:(g+1)*3], expected_lines):
                maximum_error['svgPixel'] = max(maximum_error['svgPixel'], float(np.max(abs(svg_points(e) - expected))))
    views.append({'view': view, 'orientation': orientation, 'captured': actual is not None, 'renderedPointFailures': rendered_outside, 'nonrenderedControlFailures': control_outside})
assert maximum_error['world'] < 1e-12 and maximum_error['ndc'] < 1e-12 and maximum_error['pixel'] < 1e-9 and maximum_error['svgPixel'] < 1e-9
assert len(failures) == 1 and failures[0]['view'] == 'right-bare' and failures[0]['orientation'] == 'B' and failures[0]['role'] == 'dominant-inner-sweep' and failures[0]['category'] == 'nonrendered-control' and failures[0]['sample'] == 2
assert all(v['renderedPointFailures'] == 0 for v in views)
assert not (out / 'right-bare-B.png').exists()
assert pins == {p: sha(p) for p in pins}
result = {'status': 'independent verification of refused packet passed; packet remains failed', 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/appearance-2026-10-02/front-design/verify-guide-target-packet.py', 'interpreter': sys.executable, 'pythonVersion': platform.python_version(), 'numpyVersion': np.__version__, 'verifierSHA256': sha(__file__), 'packetSHA256': sha(out / 'report.json'), 'inputPins': pins, 'snapshotsChecked': snapshots, 'preparedSHA256': sha(out / 'inputs.json'), 'authoredSHA256': sha('docs/evidence/appearance-2026-10-02/front-design/guide-targets-v1.json'), 'images': images, 'offlineProjectedPoints': projected_points, 'recordedViewsChecked': 5, 'maximumComponentErrors': maximum_error, 'views': views, 'failureWitnesses': failures, 'limits': ['Five actual screenshots and their SVG geometry; sixth is offline mathematical classification only, no sixth capture or retry.', 'Unoccluded sheet projection overlap does not establish physical visibility or body contact.', 'No author rerun, rendering, geometry asset, fit or solver.']}
print(json.dumps(result, indent=2))
