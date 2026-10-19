"""One root-admitted 34-call packet. Frozen oracle data is READ ONLY.

Never imports or runs the closed oracle or its driver. Exclusive CLAIM consumes
the only attempt. A failure is retained and closes this candidate without retry.
"""
import signal
signal.alarm(10)
import datetime
from fractions import Fraction as F
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time

UTC = datetime.datetime.now(datetime.timezone.utc)
START = time.monotonic()
ROOT = Path(__file__).resolve().parent
REFERENCE = ROOT.parents[1]/'appearance-2026-10-18/material-cell-oracle/RESULT.json'
if sys.flags.optimize != 0 or UTC >= datetime.datetime(2026, 10, 19, 7, 55, tzinfo=datetime.timezone.utc):
    raise RuntimeError('nonoptimized assertions and fixed trial deadline required')
admission_bytes = (ROOT/'ROOT-ADMISSION.json').read_bytes()
assert len(admission_bytes) <= 65536
admission = json.loads(admission_bytes)
if admission.get('admitted') is not True or admission.get('scope') != 'one 34-call sequential local packet only':
    raise RuntimeError('exact root admission required')
for name in ('sequential_cell.py', 'compare_packet.py'):
    if hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != admission['sha256'][name]:
        raise RuntimeError('admitted source changed')
reference_bytes = REFERENCE.read_bytes()
if len(reference_bytes) > 1048576 or hashlib.sha256(reference_bytes).hexdigest() != admission['reference_sha256']:
    raise RuntimeError('frozen expected data changed')
with (ROOT/'CLAIM.json').open('x') as handle:
    json.dump({'pid': os.getpid(), 'utc': UTC.isoformat(), 'attempt': 1,
               'scope': admission['scope'], 'admission_sha256': hashlib.sha256(admission_bytes).hexdigest()}, handle)
    handle.write('\n')
spec = importlib.util.spec_from_file_location('isolated_sequential_cell', ROOT/'sequential_cell.py')
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


def decode(x):
    if isinstance(x, dict):
        if set(x) == {'n', 'd'}:
            return F(x['n'], x['d'])
        return {k: decode(v) for k, v in x.items()}
    if isinstance(x, list):
        return [decode(v) for v in x]
    return x


def encode(x):
    if isinstance(x, F):
        return {'n': x.numerator, 'd': x.denominator}
    if isinstance(x, float) and not math.isfinite(x):
        return {'nonfinite_binary64': str(x)}
    if isinstance(x, dict):
        return {str(k): encode(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [encode(v) for v in x]
    if isinstance(x, (set, frozenset)):
        return sorted(x)
    return x


def scalar(x):
    return F(*x.as_integer_ratio())


def product(a, b):
    return sum(x*y for x, y in zip(a, b))


def difference(a, b):
    return tuple(x-y for x, y in zip(a, b))


def vector_cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def consume(result, payload):
    """Literal saved-output consumer, independent of clipping implementation."""
    status = result['status']
    if status in ('REFUSED', 'UNKNOWN'):
        assert set(result) <= {'status', 'reason'}
        return
    if status == 'EMPTY':
        assert result.get('vertices', []) == [] and result.get('facets', []) == []
        return
    assert status in ('OK', 'DEGENERATE')
    gids, labels = payload['gids'], payload['labels']
    points = {g: tuple(scalar(x) for x in p) for g, p in zip(gids, payload['points'])}
    source_labels = dict(zip(gids, labels))
    fields = {name: dict(zip(gids, (scalar(x) for x in values))) for name, values in payload['cuts']}
    vertices, keys = result['vertices'], []
    for vertex in vertices:
        weights = dict(vertex['weights'])
        assert set(weights) == set(gids) and min(weights.values()) >= 0 and sum(weights.values()) == 1
        support = tuple(sorted(g for g in gids if weights[g] > 0))
        active = []
        for name, values in fields.items():
            value = sum(weights[g]*values[g] for g in gids)
            assert value <= 0
            if value == 0:
                active.append(name)
        assert vertex['key'] == (support, tuple(sorted(active)))
        assert vertex['u'] == tuple(weights[g] for g in gids[1:])
        assert vertex['position'] == tuple(sum(weights[g]*points[g][a] for g in gids) for a in range(3))
        assert vertex['regions'] == sorted(set().union(*(source_labels[g] for g in support)))
        keys.append(vertex['key'])
    assert keys == sorted(set(keys))
    if status == 'DEGENERATE':
        assert result['dimension'] in (0, 1, 2) and result['volume'] == 0 and result['facets'] == []
        return
    assert result['dimension'] == 3
    edges, used, volume = {}, set(), F(0)
    for facet in result['facets']:
        cycle = facet['vertices']
        assert len(cycle) >= 3 and len(set(cycle)) == len(cycle)
        assert vertices[cycle[0]]['key'] == min(vertices[i]['key'] for i in cycle)
        if facet['kind'] == 'cut':
            values = fields[facet['owner']]
        else:
            assert facet['kind'] == 'tet'
            owner = set(facet['owner'])
            assert len(owner) == 3 and owner < set(gids)
            values = {g: F(0 if g in owner else -1) for g in gids}
        normal = facet['normal_world']
        for g in gids[1:]:
            assert product(normal, difference(points[g], points[gids[0]])) == values[g]-values[gids[0]]
        for i in cycle:
            v = vertices[i]
            assert sum(w*values[g] for g, w in v['weights']) == 0
            assert product(normal, difference(v['position'], points[gids[0]])) + values[gids[0]] == 0
        regions = sorted(set().union(*(vertices[i]['regions'] for i in cycle)))
        assert facet['regions'] == regions
        fans = [(cycle[0], cycle[j], cycle[j+1]) for j in range(1, len(cycle)-1)]
        assert [t['vertices'] for t in facet['triangles']] == fans
        for triangle in facet['triangles']:
            assert triangle['regions'] == regions
            a, b, c = (vertices[i]['position'] for i in triangle['vertices'])
            assert product(normal, vector_cross(difference(b, a), difference(c, a))) > 0
            volume += product(a, vector_cross(b, c))/6
        used.update(cycle)
        for a, b in zip(cycle, cycle[1:] + cycle[:1]):
            edges.setdefault(frozenset((a, b)), []).append((a, b))
    assert used == set(range(len(vertices)))
    assert all(len(v) == 2 and v[0] == tuple(reversed(v[1])) for v in edges.values())
    assert len(vertices)-len(edges)+len(result['facets']) == 2
    assert result['edge_count'] == len(edges) and result['volume'] == volume > 0


frozen = decode(json.loads(reference_bytes))
observations, calls, current = [], 0, None


def payload(gids=None, points=None, labels=None, cuts=()):
    return {'gids': [10, 11, 12, 13] if gids is None else gids,
            'points': [(0., 0., 0.), (1., 0., 0.), (0., 1., 0.), (0., 0., 1.)] if points is None else points,
            'labels': [{'r'}, {'l'}, {'torso'}, {'torso'}] if labels is None else labels, 'cuts': cuts}


def invoke(name, data, expected, *, reference_index=None, positions=None):
    global calls, current
    calls += 1
    assert calls <= 34
    current = {'name': name, 'inputs': data, 'expected': expected, 'reference_index': reference_index}
    row = dict(current)
    observations.append(row)
    if expected == 'ValueError':
        try:
            candidate.material_cell(**data)
        except ValueError as error:
            row['actual'] = {'exception': 'ValueError', 'message': str(error)}
        else:
            raise AssertionError((name, 'invalid input accepted'))
    else:
        actual = candidate.material_cell(**data)
        row['actual'] = actual
        consume(actual, data)
        assert actual['status'] == expected['status'], (name, actual)
        for key in ('dimension', 'vertices', 'facets', 'volume', 'edge_count'):
            if key in expected:
                assert encode(actual[key]) == encode(expected[key]), (name, key)
        if positions is not None:
            assert {v['position'] for v in actual['vertices']} == set(positions), (name, 'positions')
            row['expected_positions'] = positions
    row['passed'] = True


def plane(name, normal, intercept):
    points = payload()['points']
    return (name, [float(sum(a*b for a, b in zip(normal, p))+intercept) for p in points])


def degen(dimension):
    return {'status': 'DEGENERATE', 'dimension': dimension, 'facets': [], 'volume': F(0)}


failure = None
try:
    for i, observation in enumerate(frozen['observations']):
        if 'inputs' not in observation:
            continue
        data = dict(observation['inputs'])
        data['labels'] = [set(x) for x in data['labels']]
        invoke('frozen:' + observation['group'] + ':' + observation['part'], data, observation['actual'], reference_index=i)
    assert calls == 17
    invoke('invalid:duplicate_gids', payload(gids=[10, 10, 12, 13]), 'ValueError')
    invoke('invalid:nonfinite_point', payload(points=[(float('nan'), 0., 0.), (1., 0., 0.), (0., 1., 0.), (0., 0., 1.)]), 'ValueError')
    invoke('invalid:label', payload(labels=[{'head'}, {'l'}, {'torso'}, {'torso'}]), 'ValueError')
    invoke('invalid:orientation', payload(points=[(0., 0., 0.), (0., 1., 0.), (1., 0., 0.), (0., 0., 1.)]), 'ValueError')
    invoke('invalid:cut_names', payload(cuts=[('A', [-1.]*4), ('A', [-2.]*4)]), 'ValueError')
    invoke('invalid:cut_count', payload(cuts=[(f'A{i}', [-1.]*4) for i in range(8)]), 'ValueError')
    invoke('invalid:ratio', payload(cuts=[('TINY', [1e-200]*4)]), 'ValueError')
    x0 = plane('XZERO', (1., 0., 0.), 0.)
    yhalf = plane('YHALF', (0., 1., 0.), -.5)
    ylow = plane('YLOW', (0., -1., 0.), .25)
    zlow = plane('ZLOW', (0., 0., -1.), .25)
    yzhalf = plane('YZHALF', (0., 1., 1.), -.5)
    xlow = plane('XLOW', (-1., 0., 0.), .125)
    edge = plane('EDGE', (0., 1., 1.), 0.)
    point = plane('POINT', (1., 1., 1.), 0.)
    invoke('fresh:plane_then_quad', payload(cuts=[x0, yhalf]), degen(2),
           positions=[(F(0), F(0), F(0)), (F(0), F(1, 2), F(0)), (F(0), F(1, 2), F(1, 2)), (F(0), F(0), F(1))])
    invoke('fresh:plane_then_point', payload(cuts=[x0, ylow, zlow, yzhalf]), degen(0), positions=[(F(0), F(1, 4), F(1, 4))])
    invoke('fresh:plane_then_empty', payload(cuts=[x0, xlow]), {'status': 'EMPTY'})
    invoke('fresh:edge_then_segment', payload(cuts=[edge, plane('XQUARTER', (-1., 0., 0.), .25), plane('XHALF', (1., 0., 0.), -.5)]), degen(1),
           positions=[(F(1, 4), F(0), F(0)), (F(1, 2), F(0), F(0))])
    invoke('fresh:edge_then_empty', payload(cuts=[edge, plane('XNEG', (1., 0., 0.), .125)]), {'status': 'EMPTY'})
    invoke('fresh:point_then_empty', payload(cuts=[point, xlow]), {'status': 'EMPTY'})
    invoke('fresh:constant_empty', payload(cuts=[('POSITIVE', [1.]*4)]), {'status': 'EMPTY'})
    # Exact affine expectations are transformed from saved data, never another target call.
    slab = frozen['observations'][1]
    transformed_data = dict(slab['inputs'])
    transformed_data['labels'] = [set(x) for x in transformed_data['labels']]
    transformed_data['points'] = [(3.+2*x+y/2, -2.+y+z/4, 5.+3*z) for x, y, z in transformed_data['points']]
    expected = decode(encode(slab['actual']))
    for v in expected['vertices']:
        x, y, z = v['position']
        v['position'] = (3+2*x+y/2, -2+y+z/4, 5+3*z)
    for face in expected['facets']:
        nx, ny, nz = face['normal_world']
        gx = nx/2
        gy = ny-gx/2
        face['normal_world'] = (gx, gy, (nz-gy/4)/3)
    expected['volume'] *= 6
    assert expected['volume'] == F(19, 64)
    invoke('fresh:skewed_translated_slab', transformed_data, expected)
    box = frozen['observations'][4]
    reversed_data = dict(box['inputs'])
    reversed_data['labels'] = [set(x) for x in reversed_data['labels']]
    reversed_data['cuts'] = list(reversed(reversed_data['cuts']))
    invoke('fresh:reversed_cut_order', reversed_data, box['actual'])
    invoke('fresh:coincident_then_point', payload(cuts=[plane('REDUNDANT', (1., 1., 1.), -1.), point]), degen(0), positions=[(F(0), F(0), F(0))])
    assert calls == len(observations) == 34 and all(r['passed'] for r in observations)
except Exception as error:
    failure = {'exception': type(error).__name__, 'message': str(error), 'current_case': current['name'] if current else None}

result = {'scope': admission['scope'], 'status': 'PACKET_PASS' if failure is None else 'PACKET_FAIL',
          'pid': os.getpid(), 'utc_started': UTC.isoformat(), 'utc_finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'elapsed_seconds_after_imports': time.monotonic()-START, 'candidate_calls': calls,
          'reference_sha256': hashlib.sha256(reference_bytes).hexdigest(), 'failure': failure, 'observations': observations,
          'limits': 'Finite local synthetic evidence only; no real source/field/global assembly/garment/physical/appearance or OS memory qualification.'}
encoded = (json.dumps(encode(result), indent=2, allow_nan=False)+'\n').encode()
assert len(encoded) <= 2097152
with (ROOT/'RESULT.json').open('xb') as handle:
    handle.write(encoded)
signal.alarm(0)
print(json.dumps({'status': result['status'], 'candidate_calls': calls, 'result_bytes': len(encoded),
                  'result_sha256': hashlib.sha256(encoded).hexdigest(), 'pid': os.getpid(), 'failure': failure}))
if failure is not None:
    raise SystemExit(1)
