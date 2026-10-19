"""One explicit alarm-bounded synthetic packet; no real source/collector/native work.

Run only after ROOT-ADMISSION.json binds this exact driver and oracle.
CLAIM.json is exclusive: no second attempt, including after a failed first attempt.
"""
import signal
signal.alarm(5)
import datetime
from fractions import Fraction as F
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

START = time.monotonic()
UTC = datetime.datetime.now(datetime.timezone.utc)
ROOT = Path(__file__).resolve().parent
if sys.flags.optimize != 0 or UTC >= datetime.datetime(2026, 10, 19, 7, 15, tzinfo=datetime.timezone.utc):
    raise RuntimeError("nonoptimized assertions and fixed trial deadline required")
admission = json.loads((ROOT / 'ROOT-ADMISSION.json').read_text())
if admission.get('admitted') is not True or admission.get('scope') != 'one synthetic local-cell packet only':
    raise RuntimeError("exact root admission required")
for name in ('cell_oracle.py', 'fixed_fixture.py'):
    if hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != admission['sha256'][name]:
        raise RuntimeError("admitted source changed")
with (ROOT/'CLAIM.json').open('x') as handle:
    json.dump({'pid': os.getpid(), 'utc': UTC.isoformat(), 'attempt': 1,
               'scope': admission['scope'], 'admission_sha256': hashlib.sha256((ROOT/'ROOT-ADMISSION.json').read_bytes()).hexdigest()}, handle)
    handle.write('\n')
spec = importlib.util.spec_from_file_location('bounded_cell_oracle', ROOT/'cell_oracle.py')
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)

POINTS = [(0., 0., 0.), (1., 0., 0.), (0., 1., 0.), (0., 0., 1.)]
GIDS = [10, 11, 12, 13]
LABELS = [{'r'}, {'l'}, {'torso'}, {'torso'}]
observations = []
calls = 0


def serialize(value):
    if isinstance(value, F):
        return {'n': value.numerator, 'd': value.denominator}
    if isinstance(value, dict):
        return {str(k): serialize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize(v) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted(value)
    return value


def product(a, b):
    return sum(x*y for x, y in zip(a, b))


def subtract(a, b):
    return tuple(x-y for x, y in zip(a, b))


def vector_cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def validate_output(result, gids, points, labels, cuts):
    """Independent literal output consumer; analytic volumes are specified below."""
    vertices = result['vertices']
    label_map = dict(zip(gids, labels))
    point_map = {g: tuple(F(*v.as_integer_ratio()) for v in p) for g, p in zip(gids, points)}
    cut_maps = [(name, dict(zip(gids, (F(*v.as_integer_ratio()) for v in values)))) for name, values in cuts]
    keys = []
    for vertex in vertices:
        weights = dict(vertex['weights'])
        assert set(weights) == set(gids) and sum(weights.values()) == 1 and min(weights.values()) >= 0
        support = tuple(sorted(g for g, weight in weights.items() if weight > 0))
        active = []
        for name, samples in cut_maps:
            value = sum(weights[g]*samples[g] for g in gids)
            assert value <= 0
            if value == 0:
                active.append(name)
        assert vertex['key'] == (support, tuple(sorted(active)))
        assert vertex['position'] == tuple(sum(weights[g]*point_map[g][a] for g in gids) for a in range(3))
        assert vertex['regions'] == sorted(set().union(*(label_map[g] for g in support)))
        keys.append(vertex['key'])
    assert keys == sorted(set(keys))
    edges = {}
    signed_volume = F(0)
    for facet in result['facets']:
        cycle = facet['vertices']
        assert len(cycle) >= 3 and len(cycle) == len(set(cycle))
        assert vertices[cycle[0]]['key'] == min(vertices[i]['key'] for i in cycle)
        expected_regions = sorted(set().union(*(vertices[i]['regions'] for i in cycle)))
        assert facet['regions'] == expected_regions
        expected_fan = [(cycle[0], cycle[j], cycle[j+1]) for j in range(1, len(cycle)-1)]
        assert [t['vertices'] for t in facet['triangles']] == expected_fan
        for triangle in facet['triangles']:
            assert triangle['regions'] == expected_regions
            a, b, c = (vertices[i]['position'] for i in triangle['vertices'])
            assert product(facet['normal_world'], vector_cross(subtract(b, a), subtract(c, a))) > 0
            signed_volume += product(a, vector_cross(b, c))/6
        for a, b in zip(cycle, cycle[1:] + cycle[:1]):
            edge = frozenset((a, b))
            edges.setdefault(edge, []).append((a, b))
    assert all(len(v) == 2 and v[0] == tuple(reversed(v[1])) for v in edges.values())
    assert len(vertices)-len(edges)+len(result['facets']) == 2
    assert result['volume'] == signed_volume > 0
    assert result['triple_solves'] <= 165


def call(gids, points, labels, cuts):
    global calls
    calls += 1
    assert calls <= 24
    return oracle.material_cell(gids, points, labels, cuts)


def case(group, cuts, status, volume=None, dim=None, *, gids=GIDS, points=POINTS, labels=LABELS, part='single'):
    result = call(gids, points, labels, cuts)
    assert result['status'] == status, (group, result)
    if status == 'OK':
        validate_output(result, gids, points, labels, cuts)
        assert result['volume'] == volume, (group, result['volume'], volume)
    if dim is not None:
        assert result['dimension'] == dim
    observations.append({'group': group, 'part': part, 'expected_status': status,
                         'expected_volume': volume, 'expected_dimension': dim,
                         'inputs': {'gids': gids, 'points': points, 'labels': labels, 'cuts': cuts},
                         'actual': result, 'passed': True})
    return result


def invalid(group, *, gids=GIDS, points=POINTS, labels=LABELS, cuts=()):
    try:
        call(gids, points, labels, cuts)
    except ValueError as error:
        observations.append({'group': group, 'expected': 'ValueError', 'actual': str(error), 'passed': True})
    else:
        raise AssertionError((group, 'invalid input accepted'))


def plane(name, normal, intercept, points=POINTS):
    return (name, [float(sum(a*b for a, b in zip(normal, p))+intercept) for p in points])


def slab(lo, hi):
    return [plane('INNER', (-1., 0., 0.), lo), plane('OUTER', (1., 0., 0.), -hi)]


# Expected volumes integrate unit-tetra sections: integral (1-x)^2/2 dx.
case('unit_inactive7', [(f'INACTIVE{i}', [-float(i+1)]*4) for i in range(7)], 'OK', F(1, 6))
case('paired_interval_no_inside_corner', slab(.25, .5), 'OK', F(19, 384))
case('thin_interval_no_inside_corner', slab(511/1024, .5), 'OK', F(787969, 6442450944))
case('half_x_cap', [plane('X', (1., 0., 0.), -.5)], 'OK', F(7, 48))
# Inset cube side1/8 minus one corner tetra side1/8: 1/512 - 1/3072.
box_cuts = [plane('XLOW', (-1., 0., 0.), .125), plane('XHIGH', (1., 0., 0.), -.25),
            plane('YLOW', (0., -1., 0.), .125), plane('YHIGH', (0., 1., 0.), -.25),
            plane('ZLOW', (0., 0., -1.), .125), plane('ZHIGH', (0., 0., 1.), -.25),
            plane('CORNER', (1., 1., 1.), -.625)]
box = case('all7_active_mixed_support', box_cuts, 'OK', F(5, 3072))
assert {f['owner'] for f in box['facets']} == {name for name, _ in box_cuts}
assert all(v['regions'] == ['l', 'r', 'torso'] for v in box['vertices'])
case('empty', [plane('NEGATIVE_X', (1., 0., 0.), 1.)], 'EMPTY', dim=-1)
case('point', [plane('ORIGIN', (1., 1., 1.), 0.)], 'DEGENERATE', dim=0)
case('edge', [plane('EDGE', (0., 1., 1.), 0.)], 'DEGENERATE', dim=1)
case('face', [plane('FACE', (1., 0., 0.), 0.)], 'DEGENERATE', dim=2)
touch = case('on_original_vertex', [plane('TOUCH', (1., 0., 0.), -1.)], 'OK', F(1, 6))
assert sum('TOUCH' in v['key'][1] for v in touch['vertices']) == 1
case('coincident_cuts', [plane('A', (1., 0., 0.), -.5), plane('B', (1., 0., 0.), -.5)], 'REFUSED')
case('coincident_tet_face', [plane('TET_DUPLICATE', (1., 1., 1.), -1.)], 'REFUSED')
case('zero_global_field', [('ZERO', [0.]*4)], 'UNKNOWN')

above = case('shared_face', [plane('X', (1., 0., 0.), -.5)], 'OK', F(7, 48), part='above')
below_points = [(0., 0., 0.), (0., 1., 0.), (1., 0., 0.), (0., 0., -1.)]
below = case('shared_face', [plane('X', (1., 0., 0.), -.5, below_points)], 'OK', F(7, 48),
             gids=[10, 12, 11, 14], points=below_points,
             labels=[{'r'}, {'torso'}, {'l'}, {'l'}], part='below')


def shared_signature(result):
    face = next(f for f in result['facets'] if f['kind'] == 'tet' and f['owner'] == (10, 11, 12))
    rows = [(result['vertices'][i]['key'], result['vertices'][i]['position'], result['vertices'][i]['regions'])
            for i in face['vertices']]
    return rows


sa, sb = shared_signature(above), shared_signature(below)
expected_shared = {(F(0), F(0), F(0)), (F(1, 2), F(0), F(0)),
                   (F(1, 2), F(1, 2), F(0)), (F(0), F(1), F(0))}
assert {row[1] for row in sa} == {row[1] for row in sb} == expected_shared
assert sa[0] == sb[0] and sa[1:] == list(reversed(sb[1:]))

base = case('positive_local_order', box_cuts, 'OK', F(5, 3072), part='base')
permutation = [1, 2, 0, 3]  # even three-cycle; determinant stays positive
permuted = case('positive_local_order', [(name, [values[i] for i in permutation]) for name, values in box_cuts],
                'OK', F(5, 3072), gids=[GIDS[i] for i in permutation],
                points=[POINTS[i] for i in permutation], labels=[LABELS[i] for i in permutation], part='permuted')


def global_signature(result):
    return {'vertices': [{k: v for k, v in row.items() if k != 'u'} for row in result['vertices']],
            'facets': result['facets'], 'volume': result['volume']}


assert global_signature(base) == global_signature(permuted)
invalid('duplicate_gids', gids=[10, 10, 12, 13])
invalid('nonfinite_point', points=[(float('nan'), 0., 0.), *POINTS[1:]])
invalid('invalid_label', labels=[{'head'}, *LABELS[1:]])
invalid('inverted_tetra', points=[POINTS[0], POINTS[2], POINTS[1], POINTS[3]])
invalid('duplicate_cut_ids', cuts=[('A', [-1.]*4), ('A', [-2.]*4)])
invalid('too_many_cuts', cuts=[(f'A{i}', [-1.]*4) for i in range(8)])
invalid('excessive_input_ratio', cuts=[('TINY', [1e-200]*4)])

assert len({o['group'] for o in observations}) == 22 and calls == len(observations) == 24
result = {'scope': 'same-function synthetic local-cell packet only', 'status': 'FIXTURE_PASS',
          'pid': os.getpid(), 'utc_started': UTC.isoformat(),
          'utc_finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'elapsed_seconds': time.monotonic()-START, 'groups': 22, 'oracle_calls': calls,
          'cross_checks': {'shared_face_exact_expected_positions_and_opposite_cycles': True,
                           'positive_local_order_global_signature_exact': True,
                           'all7_active_inset_box_facets': True,
                           'literal_facet_copy_requires_separate_source_review': True},
          'observations': observations,
          'limits': 'No real field/source/grid/garment/native/physical/global topology/appearance or OS resource qualification.'}
encoded = (json.dumps(serialize(result), indent=2, allow_nan=False)+'\n').encode()
assert len(encoded) <= 1048576
with (ROOT/'RESULT.json').open('xb') as handle:
    handle.write(encoded)
signal.alarm(0)
print(json.dumps({'status': 'FIXTURE_PASS', 'groups': 22, 'oracle_calls': calls,
                  'result_bytes': len(encoded), 'result_sha256': hashlib.sha256(encoded).hexdigest(),
                  'pid': os.getpid(), 'elapsed_seconds': result['elapsed_seconds']}))
