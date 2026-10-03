"""Independent polynomial/Gram-Schmidt/Gauss-Legendre target audit; no rendering."""
import ast
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import sys
import numpy as np

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
directory = Path('docs/evidence/appearance-2026-10-02/front-design')
source = directory / 'guide-targets-v1.json'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
report = json.loads(source.read_text())
assert report['status'] == 'authored'
pins = {p: sha(p) for p in report['sourceHashes']}
assert pins == report['sourceHashes']
spec = []
for line in (directory / 'GUIDE-TARGET-PLAN.md').read_text().splitlines():
    if not line.startswith('| ') or '[' not in line:
        continue
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    points = np.array([ast.literal_eval(cells[i]) for i in range(1, 5)], dtype=float)
    hint = np.array(ast.literal_eval(cells[6].split(' normalized')[0]), dtype=float)
    spec.append((cells[0].replace(' ', '-'), points, float(cells[5]), hint / np.linalg.norm(hint)))
assert len(spec) == 6
nodes, weights = np.polynomial.legendre.leggauss(64)
observations = []
maximum_record_error = 0.0
for name, sign in [('A', 1), ('B', -1)]:
    guides = report['orientations'][name]['guides']
    assert len(guides) == 6
    for guide, (role, control, width, hint) in zip(guides, spec):
        control = control.copy(); control[:, 0] *= sign
        hint = hint.copy(); hint[0] *= sign
        assert guide['role'] == role and guide['width'] == width
        assert np.array_equal(control, guide['points']) and np.allclose(hint, guide['hint'], atol=1e-15, rtol=0)
        a = -control[0] + 3 * control[1] - 3 * control[2] + control[3]
        b = 3 * control[0] - 6 * control[1] + 3 * control[2]
        c = -3 * control[0] + 3 * control[1]
        d = control[0]
        def derivative(t):
            t = np.asarray(t)[:, None]
            return (3 * a * t + 2 * b) * t + c
        for key, count in [('records', 17), ('annotation', 257)]:
            records = guide[key]
            assert len(records) == count
            t = np.linspace(0, 1, count)[:, None]
            assert np.array_equal(t.ravel(), [r['t'] for r in records])
            centre = ((a * t + b) * t + c) * t + d
            derivatives = derivative(t.ravel())
            speeds = np.linalg.norm(derivatives, axis=1)
            tangent = derivatives / speeds[:, None]
            projected = hint - tangent * (tangent @ hint)[:, None]
            projected_norm = np.linalg.norm(projected, axis=1)
            normal = projected / projected_norm[:, None]
            transverse = np.cross(normal, tangent)
            frame = np.stack([tangent, transverse, normal], axis=2)
            assert np.max(abs(np.linalg.det(frame) - 1)) < 1e-12
            assert speeds.min() > 1e-9 and projected_norm.min() > 1e-4
            for field, expected in [('centre', centre), ('T', tangent), ('N', normal), ('U', transverse), ('minus', centre - width / 2 * transverse), ('plus', centre + width / 2 * transverse), ('derivativeMagnitude', speeds), ('projectedHintMagnitude', projected_norm)]:
                difference = float(np.max(abs(np.array([r[field] for r in records]) - expected)))
                maximum_record_error = max(maximum_record_error, difference)
                assert difference < 1e-12, (name, role, key, field, difference)
            if key == 'records':
                polygon = np.linalg.norm(np.diff(centre, axis=0), axis=1).sum()
            for positions in [centre, centre - width / 2 * transverse, centre + width / 2 * transverse]:
                assert np.all(positions >= [-.18, 1.42, -.12]) and np.all(positions <= [.18, 1.71, .19])
        derivative_controls = 3 * np.diff(control, axis=0)
        lower_y = np.min(-derivative_controls[:, 1])
        upper_speed = np.max(np.linalg.norm(derivative_controls, axis=1))
        assert abs(lower_y - guide['continuousDerivativeLowerBound']) < 1e-15
        assert abs(lower_y / upper_speed - guide['projectedHintLowerBound']) < 1e-15
        assert lower_y > 1e-9 and lower_y / upper_speed > 1e-4
        for axis, limits in enumerate([[-.18, .18], [1.42, 1.71], [-.12, .19]]):
            assert control[:, axis].min() - width / 2 >= limits[0]
            assert control[:, axis].max() + width / 2 <= limits[1]
        arc = float(weights @ np.linalg.norm(derivative((nodes + 1) / 2), axis=1) / 2)
        arc_error = abs(arc - guide['arc']['estimates'][1])
        assert arc_error < 1e-11 and .15 <= arc <= .35
        assert abs(polygon - guide['arc']['polygon17']) < 1e-12
        assert 0 <= arc - polygon <= .002
        observations.append({'orientation': name, 'role': role, 'arcGaussLegendre64': arc, 'arcDifferenceFromSimpson8192': arc_error, 'polygon17': float(polygon), 'polygonDeficit': float(arc - polygon), 'derivativeLowerBound': float(lower_y), 'projectedHintLowerBound': float(lower_y / upper_speed)})

mirror_max = 0.0
for a, b in zip(report['orientations']['A']['guides'], report['orientations']['B']['guides']):
    for key in ['records', 'annotation']:
        for ra, rb in zip(a[key], b[key]):
            for fa, fb, parity in [('centre', 'centre', 1), ('T', 'T', 1), ('N', 'N', 1), ('U', 'U', -1), ('plus', 'minus', 1), ('minus', 'plus', 1)]:
                expected = np.array(ra[fa]) * [-1, 1, 1] * parity
                mirror_max = max(mirror_max, float(np.linalg.norm(expected - rb[fb])))
assert mirror_max < 1e-12
native = json.loads(Path(report['registration']['nativeReport']).read_text())
assert native['setup']['state']['bones'][44]['name'] == 'head'
head_state = native['setup']['state']
assert all(v['state']['bones'][44] == head_state['bones'][44] and v['state']['bodyMatrix'] == head_state['bodyMatrix'] and v['state']['bindMatrix'] == head_state['bindMatrix'] and v['state']['bindMatrixInverse'] == head_state['bindMatrixInverse'] and v['state']['boneInverses'][44] == head_state['boneInverses'][44] for v in native['views'])
assert pins == {p: sha(p) for p in pins}
result = {'status': 'independent author target arithmetic passed', 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/appearance-2026-10-02/front-design/verify-guide-target-author.py', 'interpreter': sys.executable, 'pythonVersion': platform.python_version(), 'numpyVersion': np.__version__, 'verifierSHA256': sha(__file__), 'authorSHA256': sha(source), 'inputPins': pins, 'rolesPerOrientation': 6, 'sampledFramesPerOrientation': 6 * (17 + 257), 'maximumRecordComponentError': maximum_record_error, 'mirrorMaximumResidual': mirror_max, 'observations': observations, 'limits': ['No author rerun, render, geometry asset, fit or solver; exact authored report is input.', 'Horner power-basis and Gram-Schmidt comparison differs from author Bernstein evaluation; Gauss-Legendre64 differs from author composite Simpson.', 'Pose/projection arithmetic and actual-image review remain pending the annotation packet.', 'Numerical arc agreement is not a certified integral or hairstyle acceptance.']}
print(json.dumps(result, indent=2))
