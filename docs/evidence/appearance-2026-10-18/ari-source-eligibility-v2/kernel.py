"""Inert exact prerequisite functions. No source reads or evaluation at import."""
import ast
import bisect
import hashlib
import math
import struct
from collections import defaultdict


check = lambda: None  # The single worker supplies its monotonic budget callback.


def f32(x):
    return struct.unpack('<f', struct.pack('<f', x))[0]


def decode_npy(blob, descr, shape, raw_sha=None):
    if blob[:6] != b'\x93NUMPY' or len(blob) < 10:
        raise ValueError('NPY magic/length')
    version = tuple(blob[6:8])
    if version == (1, 0):
        n = struct.unpack('<H', blob[8:10])[0]; start = 10
    elif version in ((2, 0), (3, 0)):
        if len(blob) < 12:
            raise ValueError('NPY uint32 length')
        n = struct.unpack('<I', blob[8:12])[0]; start = 12
    else:
        raise ValueError('NPY unsupported version')
    if not 1 <= n <= 4096 or start + n > len(blob):
        raise ValueError('NPY header cap')
    header = blob[start:start+n]
    if not header.endswith(b'\n'):
        raise ValueError('NPY newline')
    text = header.decode('utf8' if version == (3, 0) else 'latin1')
    tree = ast.parse(text.strip(), mode='eval')
    if not isinstance(tree.body, ast.Dict):
        raise ValueError('NPY dictionary')
    keys = [k.value if isinstance(k, ast.Constant) else None for k in tree.body.keys]
    if len(keys) != 3 or set(keys) != {'descr', 'fortran_order', 'shape'}:
        raise ValueError('NPY keys/duplicates')
    obj = ast.literal_eval(tree)
    if obj['descr'] != descr or obj['fortran_order'] is not False or obj['shape'] != tuple(shape):
        raise ValueError('NPY dtype/order/shape')
    if not all(type(x) is int and x > 0 for x in obj['shape']):
        raise ValueError('NPY dimensions')
    raw = blob[start+n:]
    if len(raw) != math.prod(shape) * 4:
        raise ValueError('NPY data size')
    digest = hashlib.sha256(raw).hexdigest()
    if raw_sha is not None and digest != raw_sha:
        raise ValueError('NPY raw hash')
    fmt = {'<f4': '<fff', '<i4': '<iii'}[descr]
    rows = list(struct.iter_unpack(fmt, raw))
    return rows, {'version': list(version), 'header_bytes': n, 'raw_bytes': len(raw),
                  'raw_sha256': digest, 'descr': descr, 'shape': list(shape)}


def stations(grid):
    q64 = [[grid['origin_world64'][a] + grid['h'] * i
            for i in range(grid['cell_counts'][a] + 1)] for a in range(3)]
    q32 = [[f32(x) for x in row] for row in q64]
    if not all(math.isfinite(x) for row in q32 for x in row):
        raise ValueError('nonfinite grid')
    if not all(all(a < b for a, b in zip(row, row[1:])) for row in q32):
        raise ValueError('non-increasing grid')
    return q64, q32


def lattice(vertices, q32):
    values = [x for row in vertices for x in row] + [x for row in q32 for x in row]
    if not all(math.isfinite(x) for x in values):
        raise ValueError('nonfinite source')
    exponent = max(x.as_integer_ratio()[1].bit_length()-1 for x in values)
    if not 0 <= exponent <= 149:
        raise ValueError('F32 dyadic exponent')
    def integer(x):
        n, d = x.as_integer_ratio()
        value = n << (exponent - (d.bit_length()-1))
        if value.bit_length() > 280:
            raise ValueError('coordinate integer size')
        return value
    return exponent, [tuple(integer(x) for x in p) for p in vertices], [[integer(x) for x in r] for r in q32]


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def source_gate(vertices, faces):
    n = len(vertices); parent = list(range(n)); used = set(); edges = defaultdict(list)
    stars = [[] for _ in vertices]; volume6 = 0
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    def fail(kind, witness):
        return {'status': 'REFUSED', 'condition': kind, 'witness': witness}
    for fid, face in enumerate(faces):
        if fid % 256 == 0:
            check()
        if len(face) != 3 or any(type(i) is not int or not 0 <= i < n for i in face):
            return fail('source_indices', {'face_id': fid, 'indices': list(face)})
        a, b, c = face; used.update(face)
        u, v, w = (vertices[i] for i in face)
        if cross(sub(v, u), sub(w, u)) == (0, 0, 0):
            return fail('nonzero_area', {'face_id': fid, 'indices': list(face), 'vertices_int': [u, v, w]})
        vw = cross(v, w); volume6 += sum(u[i]*vw[i] for i in range(3))
        for x, y in ((a,b), (b,c), (c,a)):
            edges[min(x,y), max(x,y)].append((fid, 1 if x < y else -1))
            px, py = find(x), find(y)
            if px != py:
                parent[py] = px
        stars[a].append((b,c)); stars[b].append((c,a)); stars[c].append((a,b))
    if len(used) != n:
        return fail('all_used', {'first_unused': next(i for i in range(n) if i not in used)})
    components = len({find(i) for i in range(n)})
    if components != 1:
        return fail('one_component', {'components': components})
    for edge in sorted(edges):
        incidence = edges[edge]
        if len(incidence) != 2 or sum(x[1] for x in incidence) != 0:
            return fail('two_opposed_edges', {'edge': edge, 'incidences': incidence})
    for vid, links in enumerate(stars):
        if vid % 256 == 0:
            check()
        successor = {}; incoming = defaultdict(int)
        for a, b in links:
            if a in successor:
                return fail('cyclic_vertex_link', {'vertex': vid, 'links': links})
            successor[a] = b; incoming[b] += 1
        if not successor or set(successor) != set(incoming) or any(x != 1 for x in incoming.values()):
            return fail('cyclic_vertex_link', {'vertex': vid, 'links': links})
        first = min(successor); seen = set(); at = first
        while at not in seen:
            seen.add(at); at = successor[at]
        if at != first or len(seen) != len(successor):
            return fail('cyclic_vertex_link', {'vertex': vid, 'links': links})
    euler = n - len(edges) + len(faces)
    if euler != 2:
        return fail('Euler2', {'V': n, 'E': len(edges), 'F': len(faces), 'Euler': euler})
    if volume6 == 0:
        return fail('nonzero_chain_volume', {'volume6_int': 0})
    return {'status': 'PASS', 'V': n, 'E': len(edges), 'F': len(faces), 'components': components,
            'used': len(used), 'Euler': euler, 'cyclic_links': n,
            'volume6_int': volume6, 'orientation': 1 if volume6 > 0 else -1}


def orient(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])


def classify(triangle, axis, point):
    other = [a for a in range(3) if a != axis]
    p = [tuple(v[a] for a in other) for v in triangle]
    area = orient(p[0], p[1], p[2])
    numerators = [orient(p[1], p[2], point), orient(p[2], p[0], point), orient(p[0], p[1], point)]
    if area:
        if any(x*area < 0 for x in numerators):
            return None
        zeros = sum(x == 0 for x in numerators)
        return {'kind': 'VERTEX' if zeros >= 2 else 'EDGE' if zeros else 'PROPER',
                'area_int': area, 'bary_numerators': numerators,
                'hit_axis_numerator': sum(numerators[i]*triangle[i][axis] for i in range(3)),
                'hit_axis_denominator': area}
    for i, j in ((0,1), (1,2), (2,0)):
        a, b = p[i], p[j]
        if orient(a,b,point) or not all(min(a[k],b[k]) <= point[k] <= max(a[k],b[k]) for k in range(2)):
            continue
        delta = sub(b,a); den = sum(x*x for x in delta)
        num = sum((point[k]-a[k])*delta[k] for k in range(2)) if den else 0
        den = den or 1
        return {'kind': 'COPLANAR', 'area_int': 0, 'bary_numerators': numerators,
                'segment': [i,j], 'segment_fraction': [num,den],
                'hit_axis_numerator': triangle[i][axis]*den + num*(triangle[j][axis]-triangle[i][axis]),
                'hit_axis_denominator': den}
    return None


def bins_for_axis(vertices, faces, q, axis, reference_cap):
    other = [a for a in range(3) if a != axis]; bins = defaultdict(list); references = 0
    for fid, face in enumerate(faces):
        if fid % 128 == 0:
            check()
        tri = [vertices[i] for i in face]; ranges = []
        for a in other:
            lo = min(v[a] for v in tri); hi = max(v[a] for v in tri)
            ranges.append(range(bisect.bisect_left(q[a],lo), bisect.bisect_right(q[a],hi)))
        references += len(ranges[0])*len(ranges[1])
        if references > reference_cap:
            raise RuntimeError('projected reference cap')
        for u in ranges[0]:
            for v in ranges[1]:
                bins[u,v].append(fid)
    return bins, references
