"""Independent read-only saved-result consumer; never imports/calls the oracle."""
import signal
signal.alarm(5)
import datetime
from fractions import Fraction as F
import hashlib
import json
import os
from pathlib import Path
import sys

root = Path(__file__).resolve().parent
if sys.flags.optimize != 0:
    raise RuntimeError('nonoptimized assertions required')
admission = json.loads((root/'ROOT-ADMISSION.json').read_text())
assert admission['admitted'] is True and admission['scope'] == 'one synthetic local-cell packet only'
for name in ('cell_oracle.py', 'fixed_fixture.py', 'verify_owners.py'):
    assert hashlib.sha256((root/name).read_bytes()).hexdigest() == admission['sha256'][name]
raw_path = root/'RESULT.json'
assert raw_path.stat().st_size <= 1048576
raw = raw_path.read_bytes()
assert len(raw) <= 1048576


def revive(value):
    if isinstance(value, dict):
        if set(value) == {'n', 'd'}:
            n, d = value['n'], value['d']
            assert type(n) is int and type(d) is int and d > 0
            assert max(n.bit_length(), d.bit_length()) <= 4096
            return F(n, d)
        return {k: revive(v) for k, v in value.items()}
    if isinstance(value, list):
        return [revive(v) for v in value]
    return value


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


result = revive(json.loads(raw))
assert result['status'] == 'FIXTURE_PASS' and result['oracle_calls'] == 24
assert result['groups'] == 22 and len(result['observations']) == 24
assert all(o['passed'] is True for o in result['observations'])
rows = []
ok_cells = 0
for observation in result['observations']:
    cell = observation['actual']
    if not isinstance(cell, dict) or cell['status'] != 'OK':
        continue
    ok_cells += 1
    inputs = observation['inputs']
    gids = inputs['gids']
    assert len(gids) == len(set(gids)) == 4
    points = [[F(*x.as_integer_ratio()) for x in p] for p in inputs['points']]
    fields = {name: [F(*x.as_integer_ratio()) for x in values] for name, values in inputs['cuts']}
    for facet in cell['facets']:
        kind, owner = facet['kind'], facet['owner']
        if kind == 'cut':
            assert owner in fields
            values = fields[owner]
        else:
            assert kind == 'tet' and len(owner) == len(set(owner)) == 3
            assert owner == sorted(owner) and set(owner) < set(gids)
            omitted = (set(gids)-set(owner)).pop()
            values = [F(-1) if g == omitted else F(0) for g in gids]
        normal = facet['normal_world']
        assert len(normal) == 3 and any(normal)
        edge_checks = []
        for i in range(1, 4):
            edge = [points[i][a]-points[0][a] for a in range(3)]
            derivative = dot(normal, edge)
            assert derivative == values[i]-values[0]
            edge_checks.append(derivative)
        for index in facet['vertices']:
            vertex = cell['vertices'][index]
            weights = dict(vertex['weights'])
            assert set(weights) == set(gids)
            assert sum(weights[g]*values[i] for i, g in enumerate(gids)) == 0
            relative = [vertex['position'][a]-points[0][a] for a in range(3)]
            assert dot(normal, relative)+values[0] == 0
        rows.append({'group': observation['group'], 'part': observation['part'],
                     'kind': kind, 'owner': owner, 'facet_vertices': len(facet['vertices']),
                     'normal_bound': True, 'all_facet_points_on_input_plane': True})
assert ok_cells == 10 and rows
record = {'scope': 'saved synthetic local-cell facet owner readback only', 'status': 'OWNERS_PASS',
          'pid': os.getpid(), 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'input_bytes': len(raw), 'input_sha256': hashlib.sha256(raw).hexdigest(),
          'ok_cells': ok_cells, 'facets_checked': len(rows), 'rows': rows,
          'oracle_invocations': 0, 'limits': 'No case replay or oracle import; no real field/grid/global cancellation/physical/fit/appearance credit.'}
encoded = (json.dumps(record, indent=2)+'\n').encode()
assert len(encoded) <= 1048576
with (root/'OWNERS-RESULT.json').open('xb') as handle:
    handle.write(encoded)
signal.alarm(0)
print(json.dumps({'status': 'OWNERS_PASS', 'ok_cells': ok_cells, 'facets_checked': len(rows),
                  'bytes': len(encoded), 'sha256': hashlib.sha256(encoded).hexdigest(), 'pid': os.getpid()}))
