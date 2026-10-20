"""INERT PROPOSAL. Run only through separately reviewed run_once.py admission.

New implementation of Ari.material-volume.2, no imported historic builders.
Standard library plus the fixed Blender BVHTree interface. No scene or images.
"""
import array
import ast
import bisect
import hashlib
import gzip
import itertools
import json
import math
import os
from pathlib import Path
import resource
import signal
import struct
import sys
import time
import traceback
import zipfile
from collections import defaultdict, deque
from fractions import Fraction as F

HERE = Path(__file__).resolve().parent
ROOT = Path('/Users/robault/GitHub/sugata-avatar')
CONTRACT = ROOT / 'docs/evidence/appearance-2026-10-10/ari-volume-owner-revision/CONTRACT.json'
CONTRACT_SHA = '974c1cbd3ad811717aec75069f8a2c696aaacf2a8c5631599d8244914d1a7fcf'
CAPS = dict(projected=4000000, ray_hits=1000000, range_records=8000000,
            vertices=1000000, facets=2000000, triangles=4000000)
ROLES = ('INNER', 'OUTER', 'neck', 'hem', 'wrist_r', 'wrist_l', 'front')
BITS = {'r': 1, 'l': 2, 'torso': 4}


class Stop(Exception):
    def __init__(self, status, reason):
        super().__init__(reason)
        self.status = status


def require(test, reason, status='UNKNOWN'):
    if not test:
        raise Stop(status, reason)


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def mul(a, t):
    return tuple(x * t for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0])


def sign(v):
    return (v > 0) - (v < 0)


def exact(v):
    return F(*float(v).as_integer_ratio())


def f32(v):
    return struct.unpack('<f', struct.pack('<f', v))[0]


def serial(v):
    if isinstance(v, F):
        return [v.numerator, v.denominator]
    if isinstance(v, dict):
        return {str(k): serial(x) for k, x in v.items()}
    if isinstance(v, (tuple, list)):
        return [serial(x) for x in v]
    return v


def encoded(v):
    return json.dumps(serial(v), separators=(',', ':'), allow_nan=False).encode() + b'\n'


class Ledger:
    def __init__(self, folder):
        self.folder = folder
        self.start = time.monotonic()
        self.counts = defaultdict(int)
        self.stage = 'startup'
        self.files = {}

    def mark(self, stage, **facts):
        self.stage = stage
        p = self.folder / 'stage.tmp'
        p.write_bytes(encoded(dict(stage=stage, elapsed=time.monotonic()-self.start,
                                   counts=dict(self.counts), **facts)))
        os.replace(p, self.folder / 'stage.json')

    def tick(self, name, amount=1):
        self.counts[name] += amount
        require(self.counts[name] <= CAPS[name], 'work cap: ' + name, 'REFUSED')

    def stream(self, name):
        require(name not in self.files, 'duplicate output stream')
        self.files[name] = (gzip.open(self.folder / name, 'xb', compresslevel=1)
                            if name.endswith('.gz') else (self.folder / name).open('xb'))
        return self.files[name]

    def save(self, name, value):
        with (self.folder / name).open('xb') as out:
            out.write(encoded(value))

    def close(self):
        for out in self.files.values():
            out.close()


class MetricShards:
    """Lossless gzip JSONL, fixed 65,536-record shards; no record dropping."""
    def __init__(self, ledger):
        self.ledger = ledger
        self.records = 0
        self.out = None

    def write(self, data):
        if self.records % 65536 == 0:
            if self.out is not None:
                self.out.close()
            self.out = self.ledger.stream('metric-%03d.jsonl.gz' % (self.records // 65536))
        self.out.write(data)
        self.records += 1

    def flush(self):
        if self.out is not None:
            self.out.flush()


def pinned_bytes(path, size, sha):
    p = Path(path)
    require(p.is_file() and p.stat().st_size == size, 'source size: ' + str(p))
    data = p.read_bytes()
    require(hashlib.sha256(data).hexdigest() == sha, 'source hash: ' + str(p))
    return data


def read_sources(c):
    for entry in c['sources']:
        pinned_bytes(entry['path'], entry['bytes'], entry['sha256'])
    owners = {
        'Human_world': c['sources'][2]['path'],
        'Human_triangles': c['sources'][2]['path'],
        'l_arm_faces': c['sources'][3]['path'],
        'r_arm_faces': c['sources'][3]['path'],
    }
    arrays = {}
    for spec in c['frame']['buffers']:
        with zipfile.ZipFile(owners[spec['name']]) as archive:
            matches = [i for i in archive.infolist() if i.filename == spec['name']+'.npy']
            require(len(matches) == 1, 'ambiguous member')
            require(matches[0].file_size <= 512*1024, 'member cap')
            data = archive.read(matches[0])
        require(data[:8] == b'\x93NUMPY\x01\x00', 'NPY format')
        n = struct.unpack('<H', data[8:10])[0]
        require(n <= 65536 and 10+n <= len(data), 'NPY header length')
        header = ast.literal_eval(data[10:10+n].decode('ascii'))
        require(header == dict(descr=spec['dtype'], fortran_order=False,
                               shape=tuple(spec['shape'])), 'NPY schema')
        raw = data[10+n:]
        require(len(raw) == spec['bytes'] and hashlib.sha256(raw).hexdigest() ==
                spec['raw_sha256'], 'raw source hash')
        values = array.array('f' if spec['dtype'] == '<f4' else 'i')
        require(values.itemsize == 4, 'host scalar size')
        values.frombytes(raw)
        if sys.byteorder != 'little':
            values.byteswap()
        shape = spec['shape']
        arrays[spec['name']] = ([tuple(values[i:i+3]) for i in range(0, len(values), 3)]
                                if len(shape) == 2 else list(values))
    verts = arrays['Human_world']
    tris = arrays['Human_triangles']
    require(len(verts) == 13380 and len(tris) == 26756, 'full source counts')
    require(all(math.isfinite(x) for v in verts for x in v), 'finite source')
    require(all(0 <= x < len(verts) for t in tris for x in t), 'source index range')
    left, right = set(arrays['l_arm_faces']), set(arrays['r_arm_faces'])
    require(len(left) == len(right) == 4221 and not left & right, 'region selectors')
    require(all(0 <= x < len(tris) for x in left | right), 'selector range')
    labels = [1 if i in right else 2 if i in left else 4 for i in range(len(tris))]
    return verts, tris, labels


def topology(tris, closed, euler):
    """Full simplicial edge, component and vertex-link tests; oriented triangles."""
    require(bool(tris), 'empty complex', 'REFUSED')
    edges = defaultdict(list)
    links = defaultdict(list)
    vertices = set()
    for ti, t in enumerate(tris):
        require(len(set(t)) == 3, 'collapsed topological triangle')
        vertices.update(t)
        for j in range(3):
            a, b, v = t[j], t[(j+1) % 3], t[(j+2) % 3]
            edges[tuple(sorted((a, b)))].append((ti, a, b))
            links[v].append((a, b))
    adjacent = [[] for _ in tris]
    boundary = []
    for key, inc in edges.items():
        require(1 <= len(inc) <= 2, 'edge incidence', 'REFUSED')
        if len(inc) == 1:
            require(not closed, 'open material/source', 'REFUSED')
            boundary.append((inc[0][1], inc[0][2]))
        else:
            require(inc[0][1:] == inc[1][1:][::-1], 'opposed edge orientation')
            a, b = inc[0][0], inc[1][0]
            adjacent[a].append(b)
            adjacent[b].append(a)
    seen = {0}
    todo = [0]
    while todo:
        for other in adjacent[todo.pop()]:
            if other not in seen:
                seen.add(other)
                todo.append(other)
    require(len(seen) == len(tris), 'extra components', 'REFUSED')
    require(len(vertices)-len(edges)+len(tris) == euler, 'Euler characteristic', 'REFUSED')
    for v, pairs in links.items():
        graph = defaultdict(list)
        for a, b in pairs:
            graph[a].append(b)
            graph[b].append(a)
        deg = [len(x) for x in graph.values()]
        require(all(d == 2 for d in deg) or
                (not closed and deg.count(1) == 2 and all(d in (1, 2) for d in deg)),
                'noncyclic/nonpath vertex link')
        reached = set()
        stack = [next(iter(graph))]
        while stack:
            a = stack.pop()
            if a not in reached:
                reached.add(a)
                stack.extend(graph[a])
        require(len(reached) == len(graph), 'disconnected vertex link')
    return boundary, edges


def ordered_components(edges, cycles_only=False, require_direction=True):
    """Return ordered paths/cycles; direction follows the passed directed edges."""
    graph = defaultdict(list)
    directed = set(edges)
    require(len(directed) == len(edges), 'duplicate chain edge', 'HOLD')
    for a, b in edges:
        require(a != b, 'collapsed chain edge', 'HOLD')
        graph[a].append(b)
        graph[b].append(a)
    require(all(len(n) in (1, 2) for n in graph.values()), 'branching chain', 'HOLD')
    unused = set(graph)
    result = []
    while unused:
        seed = min(unused)
        component = set()
        stack = [seed]
        while stack:
            a = stack.pop()
            if a not in component:
                component.add(a)
                stack.extend(graph[a])
        ends = sorted(a for a in component if len(graph[a]) == 1)
        require(len(ends) in (0, 2), 'chain endpoints', 'HOLD')
        require(not cycles_only or not ends, 'cycle required', 'REFUSED')
        start = ends[0] if ends else min(component)
        path, previous, current = [], None, start
        while True:
            path.append(current)
            options = [x for x in graph[current] if x != previous]
            if not options:
                break
            if previous is None and len(options) == 2:
                if require_direction:
                    forwards = [x for x in options if (current, x) in directed]
                    require(len(forwards) == 1, 'cycle orientation', 'HOLD')
                    nxt = forwards[0]
                else:
                    nxt = min(options)
            else:
                nxt = options[0]
            if nxt == start:
                break
            require(nxt not in path, 'nonsimple chain', 'HOLD')
            previous, current = current, nxt
        require(set(path) == component, 'incomplete chain', 'HOLD')
        pairs = list(zip(path, path[1:])) + ([] if ends else [(path[-1], path[0])])
        if require_direction and pairs and pairs[0] not in directed:
            path.reverse()
            pairs = list(zip(path, path[1:])) + ([] if ends else [(path[-1], path[0])])
        require(not require_direction or all(e in directed for e in pairs),
                'inconsistent chain direction', 'HOLD')
        result.append(dict(vertices=path, closed=not bool(ends)))
        unused -= component
    return result


def source_chain(v, t):
    require(set(x for tri in t for x in tri) == set(range(len(v))), 'unused source vertices')
    ev = [tuple(exact(x) for x in p) for p in v]
    volume6 = F(0)
    for a, b, c in t:
        require(cross(sub(ev[b], ev[a]), sub(ev[c], ev[a])) != (0, 0, 0), 'zero source area')
        volume6 += dot(ev[a], cross(ev[b], ev[c]))
    topology(t, True, 2)
    require(volume6 != 0, 'zero signed chain volume')
    return ev, sign(volume6), volume6


def axes(c):
    h = c['grid']['h']
    origin = c['grid']['origin_world64']
    counts = c['grid']['cell_counts']
    a64 = [[origin[j]+h*i for i in range(counts[j]+1)] for j in range(3)]
    a32 = [[f32(x) for x in a] for a in a64]
    require(all(all(a[i] < a[i+1] for i in range(len(a)-1)) for a in a32), 'q32 order')
    return a64, a32, [[exact(x) for x in a] for a in a32]


def on_segment(q, a, b):
    return ((b[0]-a[0])*(q[1]-a[1]) == (b[1]-a[1])*(q[0]-a[0]) and
            all(min(a[j], b[j]) <= q[j] <= max(a[j], b[j]) for j in range(2)))


def projected_weights(q, p):
    a, b, c = p
    det = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    if det == 0:
        return None
    u = ((q[0]-a[0])*(c[1]-a[1])-(q[1]-a[1])*(c[0]-a[0]))/det
    w = ((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]))/det
    return (1-u-w, u, w)


def all_columns(ev, tris, aq, ledger):
    """Exact all-hit scans. The closed projected bbox filter is conservative."""
    output = ledger.stream('rays.jsonl.gz')
    result = []
    for axis in range(3):
        uv = [j for j in range(3) if j != axis]
        columns = {(i, j): [False, []] for i in range(len(aq[uv[0]]))
                   for j in range(len(aq[uv[1]]))}
        for fi, tri in enumerate(tris):
            p = [ev[i] for i in tri]
            pp = [tuple(v[j] for j in uv) for v in p]
            ranges = [range(bisect.bisect_left(aq[uv[k]], min(v[k] for v in pp)),
                            bisect.bisect_right(aq[uv[k]], max(v[k] for v in pp)))
                      for k in range(2)]
            n_axis = cross(sub(p[1], p[0]), sub(p[2], p[0]))[axis]
            for i in ranges[0]:
                for j in ranges[1]:
                    ledger.tick('projected')
                    q = (aq[uv[0]][i], aq[uv[1]][j])
                    weights = projected_weights(q, pp)
                    column = columns[(i, j)]
                    if weights is None:
                        if any(on_segment(q, pp[k], pp[(k+1) % 3]) for k in range(3)):
                            column[0] = True
                        continue
                    if min(weights) < 0:
                        continue
                    if min(weights) == 0:
                        column[0] = True
                        continue
                    require(n_axis != 0, 'projected normal inconsistency')
                    hit = sum(weights[k]*p[k][axis] for k in range(3))
                    ledger.tick('ray_hits')
                    column[1].append((hit, fi, -sign(n_axis)))
            if fi % 1024 == 0:
                ledger.mark('exact columns', axis=axis, source_triangle=fi)
        compact = {}
        for key, (bad, hits) in columns.items():
            hits.sort(key=lambda x: (x[0], x[1]))
            coords, degrees, parities = [], [0], [0]
            for coord, fi, delta in hits:
                coords.append(coord)
                degrees.append(degrees[-1]+delta)
                parities.append(parities[-1] ^ 1)
            output.write(encoded(dict(axis=axis, column=key, ambiguous=bad, hits=hits)))
            compact[key] = (bad, coords, degrees, parities)
        result.append(compact)
    output.flush()
    return result


def classify(q, indexes, columns, orientation):
    observations = []
    for axis in range(3):
        uv = [j for j in range(3) if j != axis]
        bad, coords, degrees, parities = columns[axis][(indexes[uv[0]], indexes[uv[1]])]
        at = bisect.bisect_left(coords, q[axis])
        require(not bad and not (at < len(coords) and coords[at] == q[axis]),
                'ambiguous exact column')
        observations.append((degrees[at], parities[at]))
    if all(x == (0, 0) for x in observations):
        return 1, observations
    if all(x == (orientation, 1) for x in observations):
        return -1, observations
    raise Stop('UNKNOWN', 'axis degree/parity conflict')


def exact_on_triangle(q, tri):
    a, b, d = tri
    n = cross(sub(b, a), sub(d, a))
    if dot(n, sub(q, a)) != 0:
        return False
    axis = max(range(3), key=lambda j: abs(n[j]))
    uv = [j for j in range(3) if j != axis]
    weights = projected_weights(tuple(q[j] for j in uv), [tuple(p[j] for j in uv) for p in tri])
    return weights is not None and min(weights) >= 0


def registration(record, q32, verts, tris, extent):
    require(record is not None and len(record) == 4, 'missing native record')
    position, normal, index, reported = record
    require(type(index) is int and 0 <= index < len(tris), 'native original index')
    require(position is not None and normal is not None and len(position) == len(normal) == 3,
            'native tuple shape')
    p, n = tuple(float(x) for x in position), tuple(float(x) for x in normal)
    d = float(reported)
    require(all(math.isfinite(x) for x in p+n+(d,)) and d >= 0, 'native finite tuple')
    tri = [verts[j] for j in tris[index]]
    a, b, c = tri
    tn = cross(sub(b, a), sub(c, a))
    length = math.sqrt(dot(tn, tn))
    require(length > 0, 'index registration degenerate triangle')
    residual = abs(dot(tn, sub(p, a)))/length
    axis = max(range(3), key=lambda j: abs(tn[j]))
    uv = [j for j in range(3) if j != axis]
    weights = projected_weights(tuple(p[j] for j in uv), [tuple(x[j] for j in uv) for x in tri])
    reconstructed = math.sqrt(dot(sub(q32, p), sub(q32, p)))
    require(weights is not None and all(-2**-12 <= w <= 1+2**-12 for w in weights),
            'reported index barycentric registration')
    require(residual <= 2**-18*extent and abs(reconstructed-d) <= 2**-18*extent,
            'reported index plane/distance registration')
    return dict(position=p, normal=n, index=index, reported=d, barycentric=weights,
                plane_residual=residual, reconstructed_distance=reconstructed,
                distance_error=abs(reconstructed-d))


def cuts(q, label, c):
    cc = c['cuts']
    inactive = c['grid']['fresh_levels']['inactive_cut']
    def plane(name):
        p = cc[name]
        # Fixed binary64 left-to-right affine dot; do not replace with fsum/FMA.
        terms = [p['normal'][j]*(q[j]-p['origin'][j]) for j in range(3)]
        return (terms[0]+terms[1])+terms[2]
    neck = q[2]-cc['neck']['origin'][2]
    hem = cc['hem']['origin'][2]-q[2] if label == 4 else inactive
    wr = plane('wrist_r') if label == 1 else inactive
    wl = plane('wrist_l') if label == 2 else inactive
    front = min(cc['front']['half_gap']-abs(q[0]-cc['front']['cx']), cc['front']['cy']-q[1])
    return tuple(max(v, inactive) for v in (neck, hem, wr, wl, front))


def field(c, verts, tris, regions, ev, orientation, a64, a32, aq, columns, ledger):
    from mathutils.bvhtree import BVHTree
    bvh = BVHTree.FromPolygons(verts, tris, all_triangles=True, epsilon=0.0)
    require(bvh is not None, 'native BVH unavailable')
    extent = max(max(p[j] for p in verts)-min(p[j] for p in verts) for j in range(3))
    samples = [array.array('d') for _ in range(7)]
    labels = bytearray()
    out = MetricShards(ledger)
    h = c['grid']['h']
    inner = c['grid']['fresh_levels']['inner']
    outer = c['grid']['fresh_levels']['outer']
    for ix in range(len(a64[0])):
        for iy in range(len(a64[1])):
            for iz in range(len(a64[2])):
                index = (ix, iy, iz)
                gid = len(labels)
                q64 = tuple(a64[j][index[j]] for j in range(3))
                q32 = tuple(a32[j][index[j]] for j in range(3))
                qe = tuple(aq[j][index[j]] for j in range(3))
                first = registration(bvh.find_nearest(q32), q32, verts, tris, extent)
                u0 = first['reported']
                radius = u0*(1+2**-20)+h*2**-20
                native_range = bvh.find_nearest_range(q32, radius)
                require(native_range is not None and 1 <= len(native_range) <= 64, 'native range size')
                ledger.tick('range_records', len(native_range))
                records = [registration(r, q32, verts, tris, extent) for r in native_range]
                require(any(r['index'] == first['index'] and r['reported'] == u0 for r in records),
                        'first record missing from range')
                u1 = min(r['reported'] for r in records)
                ties = [r for r in records if r['reported'] == u1]
                source_ids = sorted(set(r['index'] for r in ties))
                labelset = set(regions[i] for i in source_ids)
                vectors = [cuts(q64, label, c) for label in sorted(labelset)]
                require(all(v == vectors[0] for v in vectors), 'tie cut-vector ownership')
                mask = 0
                for label in labelset:
                    mask |= label
                boundary = u1 == 0 and any(exact_on_triangle(qe, [ev[x] for x in tris[i]]) for i in source_ids)
                if boundary:
                    d, degree = 0.0, 'independently proven exact boundary'
                else:
                    polarity, degree = classify(qe, index, columns, orientation)
                    d = polarity*u1
                values = (inner-d, d-outer) + vectors[0]
                require(all(math.isfinite(x) for x in values), 'finite sampled fields')
                for j, value in enumerate(values):
                    samples[j].append(value)
                labels.append(mask)
                out.write(encoded(dict(gid=gid, indexes=index, q64=q64, q32=q32,
                                       first=first, U0=u0, radius=radius, range=records,
                                       U1=u1, tie_indices=source_ids, labels=mask,
                                       boundary=boundary, degrees=degree, D=d, fields=values)))
            ledger.mark('native reported field', ix=ix, iy=iy, nodes=len(labels))
    require(len(labels) == c['grid']['node_count'] <= c['grid']['node_cap'], 'full field count')
    out.flush()
    return samples, labels


def bary_eval(b, coefficients):
    return sum(b[j]*coefficients[j] for j in range(4))


def bary_world(b, world):
    return tuple(sum(b[j]*world[j][k] for j in range(4)) for k in range(3))


def clean_polygon(poly):
    result = []
    for v in poly:
        if not result or v != result[-1]:
            result.append(v)
    if len(result) > 1 and result[0] == result[-1]:
        result.pop()
    require(len(set(result)) == len(result), 'repeated polygon vertex', 'REFUSED')
    return result


def area_normal(poly, world):
    if len(poly) < 3:
        return (F(0), F(0), F(0))
    p = [bary_world(b, world) for b in poly]
    return tuple(sum(cross(sub(p[i], p[0]), sub(p[i+1], p[0]))[j]
                     for i in range(1, len(p)-1)) for j in range(3))


def clip_tetra(coeff, world):
    unit = [tuple(F(int(j == k)) for j in range(4)) for k in range(4)]
    faces = [([unit[i] for i in ids], ('lattice', omitted)) for omitted, ids in
             enumerate(((1, 2, 3), (0, 3, 2), (0, 1, 3), (0, 2, 1)))]
    for ci in range(7):
        co = coeff[ci]
        old_vertices = set(v for face, _ in faces for v in face)
        values = {v: bary_eval(v, co) for v in old_vertices}
        if all(x <= 0 for x in values.values()):
            continue
        if all(x >= 0 for x in values.values()):
            return [], 'empty-or-degenerate'
        outside = next(v for v, x in values.items() if x > 0)
        clipped = []
        boundary_edges = []
        for poly, owner in faces:
            result = []
            for a, b in zip(poly, poly[1:]+poly[:1]):
                fa, fb = values[a], values[b]
                if fa <= 0:
                    result.append(a)
                if (fa < 0 and fb > 0) or (fa > 0 and fb < 0):
                    ratio = fa/(fa-fb)
                    result.append(add(a, mul(sub(b, a), ratio)))
            result = clean_polygon(result)
            if len(result) >= 3 and area_normal(result, world) != (0, 0, 0):
                clipped.append((result, owner))
                for a, b in zip(result, result[1:]+result[:1]):
                    if bary_eval(a, co) == bary_eval(b, co) == 0:
                        boundary_edges.append((a, b))
        require(clipped and boundary_edges, 'missing cut adjacency', 'REFUSED')
        graph = defaultdict(set)
        for a, b in boundary_edges:
            graph[a].add(b)
            graph[b].add(a)
        require(all(len(n) == 2 for n in graph.values()), 'cut face rank/adjacency', 'REFUSED')
        start = min(graph)
        cycle, previous, current = [], None, start
        while True:
            cycle.append(current)
            choices = sorted(x for x in graph[current] if x != previous)
            nxt = choices[0]
            if nxt == start:
                break
            require(nxt not in cycle, 'cut nonsimple cycle', 'REFUSED')
            previous, current = current, nxt
        require(set(cycle) == set(graph), 'cut multiple cycles', 'REFUSED')
        normal = area_normal(cycle, world)
        direction = dot(normal, sub(bary_world(outside, world), bary_world(cycle[0], world)))
        require(direction != 0, 'cut rank/orientation ambiguity', 'REFUSED')
        if direction < 0:
            cycle.reverse()
        clipped.append((cycle, ('cut', ci)))
        faces = clipped
    return faces, 'positive-polytope'


def cycle_key(cycle):
    at = min(range(len(cycle)), key=lambda j: cycle[j])
    return tuple(cycle[at:]+cycle[:at])


class Assembly:
    def __init__(self, ledger, labels):
        self.ledger, self.labels = ledger, labels
        self.vertices = []
        self.keys = {}
        self.pending = {}
        self.cancelled = set()
        self.facets = []
        self.tet_count = 0
        self.empty_count = 0
        self.clip_states = defaultdict(int)

    def vertex(self, b, gids, coeff, world):
        support = tuple(sorted((gids[j], b[j]) for j in range(4) if b[j] > 0))
        require(support and all(x >= 0 for x in b) and sum(b) == 1, 'minimal barycentric support')
        active = tuple(ci for ci in range(7) if bary_eval(b, coeff[ci]) == 0)
        key = (tuple(g for g, weight in support), active)
        xyz = bary_world(b, world)
        label = 0
        for gid, weight in support:
            label |= self.labels[gid]
        record = (support, xyz, label)
        if key in self.keys:
            index = self.keys[key]
            require(self.vertices[index]['record'] == record, 'canonical identity mismatch')
            return index
        self.ledger.tick('vertices')
        index = len(self.vertices)
        self.keys[key] = index
        self.vertices.append(dict(key=key, record=record))
        return index

    def face(self, polygon, owner, gids, coeff, world, tid):
        positive = [ci for ci in range(7) if all(bary_eval(v, coeff[ci]) == 0 for v in polygon)]
        require(len(positive) <= 1, 'multiple positive-area cut owners', 'REFUSED')
        if positive:
            require(owner[0] == 'cut' and owner[1] == positive[0], 'lattice/cut coincident owner', 'REFUSED')
        else:
            require(owner[0] == 'lattice', 'unbound positive-area facet')
        ids = [self.vertex(v, gids, coeff, world) for v in polygon]
        require(len(ids) == len(set(ids)), 'canonical collapsed polygon')
        # Rotate by canonical KEY, not insertion index.
        start = min(range(len(ids)), key=lambda j: self.vertices[ids[j]]['key'])
        ids = ids[start:]+ids[:start]
        label = 0
        for i in ids:
            label |= self.vertices[i]['record'][2]
        if owner[0] == 'lattice':
            boundary = tuple(sorted(gids[j] for j in range(4) if j != owner[1]))
            unoriented = min(cycle_key(ids), cycle_key(list(reversed(ids))))
            key = (boundary, unoriented)
            require(key not in self.cancelled, 'more than two lattice owners', 'REFUSED')
            if key in self.pending:
                other = self.pending.pop(key)
                require(cycle_key(ids) == cycle_key(list(reversed(other['vertices']))),
                        'lattice face orientation mismatch', 'REFUSED')
                require(other['tetrahedron'] != tid and other['labels'] == label,
                        'lattice owner/label mismatch')
                self.cancelled.add(key)
            else:
                self.pending[key] = dict(vertices=ids, tetrahedron=tid, labels=label)
        else:
            role = ROLES[owner[1]]
            if role == 'front':
                xs = [self.vertices[i]['record'][1][0] for i in ids]
                require(all(x < 0 for x in xs) or all(x > 0 for x in xs), 'front side ambiguity', 'REFUSED')
                role = 'frontR' if xs[0] < 0 else 'frontL'
            self.facets.append(dict(vertices=ids, role=role, labels=label, tetrahedron=tid))
        require(len(self.pending)+len(self.facets) <= CAPS['facets'], 'facet cap', 'REFUSED')

    def mesh(self):
        require(not self.pending, 'unmatched internal lattice facets', 'REFUSED')
        require(self.facets, 'empty complete material', 'REFUSED')
        triangles = []
        for fi, face in enumerate(self.facets):
            ids = face['vertices']
            points = [self.vertices[i]['record'][1] for i in ids]
            n = tuple(sum(cross(sub(points[j], points[0]), sub(points[j+1], points[0]))[k]
                          for j in range(1, len(points)-1)) for k in range(3))
            require(n != (0, 0, 0), 'zero polygon normal')
            for j in range(len(points)):
                turn = dot(cross(sub(points[(j+1) % len(points)], points[j]),
                                 sub(points[(j+2) % len(points)], points[(j+1) % len(points)])), n)
                require(turn >= 0, 'nonconvex polygon', 'REFUSED')
            for j in range(1, len(ids)-1):
                tri = (ids[0], ids[j], ids[j+1])
                require(dot(cross(sub(points[j], points[0]), sub(points[j+1], points[0])), n) > 0,
                        'nonpositive canonical fan triangle')
                self.ledger.tick('triangles')
                triangles.append(dict(vertices=tri, facet=fi, labels=face['labels'], role=face['role']))
        return triangles


def assemble(c, fields, labels, a64, ledger):
    nx, ny, nz = c['grid']['cell_counts']
    def gid(index):
        x, y, z = index
        return ((x*(ny+1))+y)*(nz+1)+z
    assembly = Assembly(ledger, labels)
    permutations = list(itertools.permutations(range(3)))
    for ix in range(nx):
        for iy in range(ny):
            for iz in range(nz):
                for perm in permutations:
                    base = [ix, iy, iz]
                    corners = [tuple(base)]
                    for axis in perm:
                        base[axis] += 1
                        corners.append(tuple(base))
                    odd = sum(perm[i] > perm[j] for i in range(3) for j in range(i+1, 3)) % 2
                    if odd:
                        corners[1], corners[2] = corners[2], corners[1]
                    gids = [gid(p) for p in corners]
                    assembly.tet_count += 1
                    # A linear inequality positive at every corner empties this tetra;
                    # this is not a maximum-mask shortcut across the paired levels.
                    if any(all(field[g] > 0 for g in gids) for field in fields):
                        assembly.empty_count += 1
                        assembly.clip_states['one-inequality-strictly-empty'] += 1
                        continue
                    coeff = [tuple(exact(field[g]) for g in gids) for field in fields]
                    world = [tuple(exact(a64[j][p[j]]) for j in range(3)) for p in corners]
                    require(dot(sub(world[1], world[0]), cross(sub(world[2], world[0]),
                                                             sub(world[3], world[0]))) > 0,
                            'tetra orientation')
                    faces, state = clip_tetra(coeff, world)
                    assembly.clip_states[state] += 1
                    if not faces:
                        assembly.empty_count += 1
                    for polygon, owner in faces:
                        assembly.face(polygon, owner, gids, coeff, world, assembly.tet_count-1)
            ledger.mark('shared tetrahedra', ix=ix, iy=iy, tetrahedra=assembly.tet_count,
                        vertices=len(assembly.vertices), facets=len(assembly.facets),
                        pending=len(assembly.pending))
    require(assembly.tet_count == 11099520, 'full tetra count')
    return assembly, assembly.mesh()


def bridge_and_surface_gates(assembly, triangles, c):
    mesh = [t['vertices'] for t in triangles]
    _, global_edges = topology(mesh, True, -2)
    roles = set(f['role'] for f in assembly.facets)
    require(roles == {'INNER', 'OUTER', 'neck', 'hem', 'wrist_r', 'wrist_l', 'frontR', 'frontL'},
            'missing/extra boundary roles', 'REFUSED')
    exact_planes = {role: (tuple(exact(x) for x in c['cuts'][role]['origin']),
                           tuple(exact(x) for x in c['cuts'][role]['normal']))
                    for role in ('neck', 'hem', 'wrist_r', 'wrist_l')}
    for face in assembly.facets:
        role = face['role']
        if role in exact_planes:
            origin, n = exact_planes[role]
            for i in face['vertices']:
                xyz = assembly.vertices[i]['record'][1]
                require(abs(float(dot(n, sub(xyz, origin)))) <= 1e-9,
                        'cut source world-plane residual', 'REFUSED')
    chains = {}
    for surface in ('OUTER', 'INNER'):
        selected = [t for t in triangles if t['role'] == surface]
        boundary, edges = topology([t['vertices'] for t in selected], False, -1)
        cycles = ordered_components(boundary, True)
        require(len(cycles) == 3, 'surface three cycles', 'REFUSED')
        byrole = defaultdict(list)
        cycle_roles = []
        for cycle in cycles:
            path = cycle['vertices']
            seen_roles = set()
            for a, b in zip(path, path[1:]+path[:1]):
                incidence = global_edges[tuple(sorted((a, b)))]
                other_roles = [triangles[ti]['role'] for ti, x, y in incidence
                               if triangles[ti]['role'] != surface]
                require(len(other_roles) == 1 and other_roles[0] not in ('INNER', 'OUTER'),
                        'matching cut rim bridge', 'REFUSED')
                role = other_roles[0]
                byrole[role].append((a, b))
                seen_roles.add(role)
            cycle_roles.append(frozenset(seen_roles))
        require(set(cycle_roles) == {frozenset({'wrist_r'}), frozenset({'wrist_l'}),
                                    frozenset({'neck', 'hem', 'frontR', 'frontL'})},
                'missing/extra opening roles', 'REFUSED')
        for role in ('neck', 'hem', 'wrist_r', 'wrist_l', 'frontR', 'frontL'):
            require(bool(byrole[role]), 'empty parent role', 'HOLD')
            parts = ordered_components(byrole[role])
            require(len(parts) == 1, 'nonunique parent role chain', 'HOLD')
            require(parts[0]['closed'] == role.startswith('wrist'), 'parent path/cycle kind', 'HOLD')
            chains[(surface, role)] = parts[0]
    return chains


def pocket_guide(side, assembly, triangles, c):
    spec = c['finishing_attachment_parents']['pocket_mouth_and_bags']
    x0 = exact(side*spec['x_abs_start'])
    x1 = exact(side*spec['x_abs_end'])
    z0, z1 = exact(spec['z_start']), exact(spec['z_end'])
    cy = exact(c['cuts']['front']['cy'])
    zh, zn = exact(c['cuts']['hem']['origin'][2]), exact(c['cuts']['neck']['origin'][2])
    def guide(p):
        return (p[0]-x0)*(z1-z0)-(p[2]-z0)*(x1-x0)
    eligible = set()
    for fi, face in enumerate(assembly.facets):
        points = [assembly.vertices[v]['record'][1] for v in face['vertices']]
        if face['role'] == 'OUTER' and face['labels'] == 4 and all(
                zh <= p[2] <= zn and p[1] < cy for p in points):
            eligible.add(fi)
    points, point_ids, segments = [], {}, []
    def point_id(p):
        if p not in point_ids:
            point_ids[p] = len(points)
            points.append(p)
        return point_ids[p]
    for ti, t in enumerate(triangles):
        if t['facet'] not in eligible:
            continue
        xyz = [assembly.vertices[v]['record'][1] for v in t['vertices']]
        values = [guide(p) for p in xyz]
        if all(v == 0 for v in values):
            raise Stop('HOLD', 'pocket coplanar triangle ambiguity')
        intersections = {}
        for j in range(3):
            k = (j+1) % 3
            if values[j] == 0:
                b = tuple(F(int(a == j)) for a in range(3))
                intersections[xyz[j]] = b
            if values[j]*values[k] < 0:
                ratio = values[j]/(values[j]-values[k])
                b = tuple((1-ratio if a == j else ratio if a == k else F(0)) for a in range(3))
                intersections[add(xyz[j], mul(sub(xyz[k], xyz[j]), ratio))] = b
        if len(intersections) < 2:
            continue
        require(len(intersections) == 2, 'pocket plane intersections', 'HOLD')
        ends = list(intersections.items())
        # Restrict the segment by exact endpoint X planes and strict front Y.
        lo, hi = F(0), F(1)
        p, q = ends[0][0], ends[1][0]
        for axis, lower, upper in ((0, min(x0, x1), max(x0, x1)),):
            delta = q[axis]-p[axis]
            if delta == 0:
                if not lower <= p[axis] <= upper:
                    lo, hi = F(1), F(0)
            else:
                ta, tb = (lower-p[axis])/delta, (upper-p[axis])/delta
                lo, hi = max(lo, min(ta, tb)), min(hi, max(ta, tb))
        if lo >= hi:
            continue
        end_data = []
        for at in (lo, hi):
            pos = add(p, mul(sub(q, p), at))
            bary = add(ends[0][1], mul(sub(ends[1][1], ends[0][1]), at))
            require(pos[1] < cy, 'pocket strict front restriction', 'HOLD')
            end_data.append((point_id(pos), bary))
        a, b = end_data[0][0], end_data[1][0]
        require(a != b, 'pocket collapsed segment', 'HOLD')
        segments.append(dict(vertices=(a, b), triangle=ti, facet=t['facet'],
                             barycentric=(end_data[0][1], end_data[1][1])))
    require(segments, 'missing pocket guide', 'HOLD')
    # A guide may turn in X/Y while remaining simple. It has no material
    # orientation; do not introduce a monotonic-X eligibility requirement.
    chains = ordered_components([s['vertices'] for s in segments], require_direction=False)
    require(len(chains) == 1 and not chains[0]['closed'], 'unique pocket polyline', 'HOLD')
    path = chains[0]['vertices']
    if points[path[-1]][0] == x0:
        path.reverse()
    require(points[path[0]][0] == x0 and points[path[-1]][0] == x1, 'pocket endpoint planes', 'HOLD')
    require(points[path[0]][2] == z0 and points[path[-1]][2] == z1, 'pocket guide endpoints', 'HOLD')
    return dict(points=points, segments=segments, chain=chains[0],
                qualification='attachment guide only; real cut/lip/bag/contact UNKNOWN')


def parents(chains, assembly, triangles, c):
    result = {}
    mapping = {'collar': ('OUTER', 'neck'), 'hem_trim': ('OUTER', 'hem'),
               'cuff_r': ('OUTER', 'wrist_r'), 'cuff_l': ('OUTER', 'wrist_l'),
               'zip_r': ('OUTER', 'frontR'), 'zip_l': ('OUTER', 'frontL'),
               'facing_r': ('INNER', 'frontR'), 'facing_l': ('INNER', 'frontL'),
               'left_guard': ('INNER', 'frontL')}
    for name, key in mapping.items():
        chain = dict(chains[key])
        if name.startswith('zip_'):
            path = list(chain['vertices'])
            z = [assembly.vertices[v]['record'][1][2] for v in path]
            if z[-1] < z[0]:
                path.reverse()
                z.reverse()
            require(all(z[j] <= z[j+1] for j in range(len(z)-1)) and z[0] < z[-1],
                    'nonmonotone zipper ownership', 'HOLD')
            chain['vertices'] = path
        result[name] = dict(status='OWNED_ATTACHMENT_PARENT', chain=chain,
                            child_geometry_material_sewing_UV='UNBUILT')
    result['pocket_r'] = pocket_guide(-1, assembly, triangles, c)
    result['pocket_l'] = pocket_guide(1, assembly, triangles, c)
    return result


def export(assembly, triangles, ledger):
    used = sorted(set(v for t in triangles for v in t['vertices']),
                  key=lambda v: assembly.vertices[v]['key'])
    remap = {old: new for new, old in enumerate(used)}
    vertex_out = ledger.stream('vertices.jsonl.gz')
    obj = ledger.stream('material.obj')
    cast = {}
    for old in used:
        v = assembly.vertices[old]
        support, xyz, labels = v['record']
        p64 = tuple(float(x) for x in xyz)
        p32 = tuple(f32(x) for x in p64)
        require(all(math.isfinite(x) for x in p64+p32), 'finite output position')
        cast[old] = p32
        vertex_out.write(encoded(dict(id=remap[old], construction_id=old, key=v['key'], support=support,
                                     exact_world=xyz, world64=p64, world32=p32, labels=labels)))
        obj.write(('v %.9g %.9g %.9g\n' % p32).encode())
    facets = ledger.stream('facets.jsonl.gz')
    for fi, face in enumerate(assembly.facets):
        facets.write(encoded(dict(id=fi, **{**face, 'vertices': [remap[v] for v in face['vertices']]})))
    tout = ledger.stream('triangles.jsonl.gz')
    for ti, t in enumerate(triangles):
        ids = t['vertices']
        p = [cast[i] for i in ids]
        cast_normal = cross(sub(p[1], p[0]), sub(p[2], p[0]))
        ep = [assembly.vertices[i]['record'][1] for i in ids]
        require(dot(cast_normal, cross(sub(ep[1], ep[0]), sub(ep[2], ep[0]))) > 0,
                'F32 collapsed/flipped export')
        nt = {**t, 'vertices': [remap[v] for v in ids]}
        tout.write(encoded(dict(id=ti, **nt)))
        obj.write(('f %d %d %d\n' % tuple(remap[v]+1 for v in ids)).encode())
    return dict(vertices=len(used), facets=len(assembly.facets), triangles=len(triangles),
                vertex_id_remap='vertices.jsonl.gz IDs; parent chains still construction IDs',
                construction_to_export={str(old): new for old, new in remap.items()})


def main():
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    require(len(args) == 1, 'worker output argument')
    folder = Path(args[0]).resolve()
    require(folder.parent == HERE and folder.name == 'trial-001' and folder.is_dir(), 'owned output directory')
    resource.setrlimit(resource.RLIMIT_CPU, (900, 905))
    resource.setrlimit(resource.RLIMIT_FSIZE, (256*1024**2, 256*1024**2))
    ledger = Ledger(folder)
    def interrupted(number, frame):
        raise Stop('INTERRUPTED', 'worker signal '+str(number))
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, interrupted)
    result = dict(status='UNKNOWN', physical='UNKNOWN', appearance='UNKNOWN', image_scope='separately gated')
    exit_code = 2
    try:
        import bpy
        require(tuple(bpy.app.version) == (5, 2, 2), 'actual Blender worker version')
        require(sys.version_info >= (3, 10), 'worker Python compatibility')
        require(hashlib.sha256(CONTRACT.read_bytes()).hexdigest() == CONTRACT_SHA, 'normative contract hash')
        c = json.loads(CONTRACT.read_bytes())
        ledger.mark('source prerequisites', blender=tuple(bpy.app.version), python=sys.version,
                    pid=os.getpid(), pgid=os.getpgid(0))
        verts, tris, labels = read_sources(c)
        ev, orientation, volume6 = source_chain(verts, tris)
        ledger.save('source-chain.json', dict(status='FORMAL_CHAIN_ONLY', orientation=orientation,
                                             exact_volume_six=volume6, physical='UNKNOWN'))
        a64, a32, aq = axes(c)
        columns = all_columns(ev, tris, aq, ledger)
        fields, node_labels = field(c, verts, tris, labels, ev, orientation,
                                    a64, a32, aq, columns, ledger)
        del columns
        assembly, triangles = assemble(c, fields, node_labels, a64, ledger)
        ledger.save('tetrahedron-status.json', dict(count=assembly.tet_count,
                    empty_count=assembly.empty_count, states=dict(assembly.clip_states)))
        chains = bridge_and_surface_gates(assembly, triangles, c)
        attachment = parents(chains, assembly, triangles, c)
        ledger.save('parents.json', attachment)
        counts = export(assembly, triangles, ledger)
        result.update(status='NUMERICAL_REPRESENTATION_ELIGIBLE', counts=counts,
                      finishing='parents owned; child geometry remains unbuilt',
                      no_acceptance='No physical, fit, moving-avatar, appearance or default promotion')
        exit_code = 0
    except Stop as exc:
        result.update(status=exc.status, reason=str(exc), stage=ledger.stage)
    except BaseException as exc:
        result.update(status='ERROR', reason=type(exc).__name__+': '+str(exc), stage=ledger.stage)
        traceback.print_exc()
    finally:
        ledger.close()
        result.update(elapsed=time.monotonic()-ledger.start, work_counts=dict(ledger.counts))
        ledger.save('worker-result.json', result)
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
