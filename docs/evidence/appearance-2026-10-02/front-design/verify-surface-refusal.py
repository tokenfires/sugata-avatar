"""Independent, read-only topology and control-refusal audit; never constructs a path."""
import ast
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import struct
import sys
import numpy as np

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
base = Path('docs/evidence/appearance-2026-10-02/front-design')
out = Path('captures/hair-surface-domain-2026-10-02-v1')
report = json.loads((out / 'report.json').read_text())
helper = Path('docs/evidence/appearance-2026-10-02/root-coverage/verify-local-result.py')
tree = ast.parse(helper.read_text())
definitions = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('glb', 'accessor', 'mesh')], type_ignores=[])
assert len(definitions.body) == 3
exec(compile(definitions, str(helper), 'exec'))
digest = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert digest(out / 'report.json') == '71ec7693deb6886ba5be32c6a44797c6e98a981dedafb469076b8c860b83a28c'
pins = {}
for p, expected in report['sourceHashes'].items():
    snapshot = out / 'sources' / p
    pins[p] = {'live': digest(p), 'snapshot': digest(snapshot) if snapshot.exists() else None, 'expected': expected}
    assert pins[p]['live'] == expected
    if snapshot.exists():
        assert pins[p]['snapshot'] == expected
asset = glb('assets/figures/figure_g050.glb')
_, attributes, indices = mesh(asset, 'base.001')
positions = attributes['POSITION'].astype(float)
assert np.isfinite(positions).all()
lookup, points, aliases, quotient = {}, [], [], []
for v, p in enumerate(positions):
    key = tuple(p)
    if key not in lookup:
        lookup[key] = len(points)
        points.append(p)
        aliases.append([])
    q = lookup[key]
    aliases[q].append(v)
    quotient.append(q)
quotient = np.array(quotient, dtype=int)
points = np.array(points)
faces = quotient[indices]
assert all(len(set(f)) == 3 for f in faces)
triangle = points[faces]
assert np.all(np.linalg.norm(np.cross(triangle[:, 1] - triangle[:, 0], triangle[:, 2] - triangle[:, 0]), axis=1) > 0)
assert len({tuple(sorted(f)) for f in faces}) == len(faces)
edges, incident, neighbours = {}, [[] for _ in points], [set() for _ in points]
for t, f in enumerate(faces):
    for v in f:
        incident[v].append(t)
    for a, b in zip(f, np.roll(f, -1)):
        edges.setdefault(tuple(sorted((a, b))), []).append(t)
        neighbours[a].add(b)
        neighbours[b].add(a)
assert all(len(v) == 2 for v in edges.values())
for v, tids in enumerate(incident):
    link = {}
    for t in tids:
        a, b = [int(x) for x in faces[t] if x != v]
        link.setdefault(a, set()).add(b)
        link.setdefault(b, set()).add(a)
    assert all(len(n) == 2 for n in link.values())
    seen, queue = set(), [next(iter(link))]
    while queue:
        n = queue.pop()
        if n in seen:
            continue
        seen.add(n)
        queue.extend(link[n] - seen)
    assert len(seen) == len(link)
seen, queue = set(), [0]
while queue:
    n = queue.pop()
    if n in seen:
        continue
    seen.add(n)
    queue.extend(neighbours[n] - seen)
assert len(seen) == len(points)
topology = {'exportedVertices': len(positions), 'quotientVertices': len(points), 'faces': len(faces), 'edges': len(edges), 'euler': len(points) - len(edges) + len(faces), 'aliasGroups': sum(len(a) > 1 for a in aliases)}
assert topology == report['topology']

# All-face plane projection plus clamped edge segments: independent of SurfaceGrid,
# Three.Triangle region tests, and the constructor's closest-point function.
tri = positions[indices]
a, b, c = tri[:, 0], tri[:, 1], tri[:, 2]
ab, ac = b - a, c - a
normal = np.cross(ab, ac)
normal2 = np.einsum('ij,ij->i', normal, normal)
aa, bb, cc = np.einsum('ij,ij->i', ab, ab), np.einsum('ij,ij->i', ab, ac), np.einsum('ij,ij->i', ac, ac)
denom = aa * cc - bb * bb
def nearest(point):
    projection = point - normal * (np.einsum('ij,ij->i', point - a, normal) / normal2)[:, None]
    d, e = np.einsum('ij,ij->i', projection - a, ab), np.einsum('ij,ij->i', projection - a, ac)
    v, w = (cc * d - bb * e) / denom, (aa * e - bb * d) / denom
    bary = np.column_stack((1 - v - w, v, w))
    candidates = [projection]
    dist = np.sum((projection - point) ** 2, axis=1)
    dist[np.any(bary < 0, axis=1)] = np.inf
    distances = [dist]
    for i, j in ((0, 1), (1, 2), (2, 0)):
        start, end = tri[:, i], tri[:, j]
        edge = end - start
        t = np.clip(np.einsum('ij,ij->i', point - start, edge) / np.einsum('ij,ij->i', edge, edge), 0, 1)
        q = start + edge * t[:, None]
        candidates.append(q)
        distances.append(np.sum((q - point) ** 2, axis=1))
    distances = np.stack(distances)
    mode, face = np.unravel_index(np.argmin(distances), distances.shape)
    return float(np.sqrt(distances[mode, face]) * 1000), int(face), candidates[mode][face]

assert set(report['orientations']) == {'A'}
orientation = report['orientations']['A']
assert orientation['segments'] == [] and set(orientation) == {'controls', 'segments'}
original = json.loads((base / 'boundary-landmarks.json').read_text())
controls, failures = [], []
for p in orientation['controls']:
    i, t = p['index'], p['bodyTriangle']
    assert indices[t].tolist() == p['indices']
    rest = np.array(p['bary']) @ positions[indices[t]]
    assert np.max(abs(rest - p['restSurface'])) < 1e-14
    wanted = np.array(p['wanted'])
    projection = np.linalg.norm(rest - wanted) * 1000
    distance, face, nearest_point = nearest(wanted)
    assert abs(distance - p['projectionDistanceMm']) < 1e-9
    assert abs(projection - p['projectionDistanceMm']) < 1e-9
    assert np.linalg.norm(nearest_point - rest) < 1e-12
    choices = sorted((float(np.linalg.norm(positions[v] - rest) * 1000), int(v)) for v in indices[t])
    snap, vertex = choices[0]
    assert vertex == p['exportedVertex'] and int(quotient[vertex]) == p['q']
    assert abs(snap - p['distanceMm']) < 1e-9 and positions[vertex].tolist() == p['snapped']
    if i < 11:
        for key, value in original['orientations']['A']['opening'][i].items():
            assert p[key] == value
    causes = (['projection > 20mm'] if projection > 20 else []) + (['snap > 8mm'] if snap > 8 else []) + (['projected Y < 1.485m'] if rest[1] < 1.485 else [])
    row = {'index': i, 'projectionDistanceMm': float(projection), 'snapDistanceMm': snap, 'bodyTriangle': t, 'nearestFaceFromIndependentMethod': face, 'vertex': vertex, 'quotientVertex': p['q'], 'causes': causes}
    controls.append(row)
    if causes:
        failures.append(row)
assert [p['index'] for p in failures] == [3, 13, 14, 15]
assert len({p['q'] for p in orientation['controls']}) == 18
assert sum(not c['pass'] for c in report['checks']) == 1
assert report['status'] == 'refused control bounds' and report['stage'] == 'global exact-position topology'
result = {'status': 'independently reproduced refusal', 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/appearance-2026-10-02/front-design/verify-surface-refusal.py', 'interpreter': sys.executable, 'pythonVersion': platform.python_version(), 'numpyVersion': np.__version__, 'reportSha256': digest(out / 'report.json'), 'verifierSha256': digest(__file__), 'helperSha256': digest(helper), 'sources': pins, 'topology': topology, 'controls': controls, 'failureWitnesses': failures, 'unexecuted': ['Dijkstra paths', 'simple cycle', 'dual separation', 'seed and part predicates', 'used-alias pose equivalence', 'cap observations', 'orientation B', 'native capture']}
print(json.dumps(result, indent=2))
