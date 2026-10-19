"""Exact sequential clipping of ONE tetrahedron, independent of the oracle.

Pure local API: no I/O, native dependencies, fields or import-time evaluation.
An OK local convex cell is not a garment, global assembly or physical certificate.
"""
from fractions import Fraction as F
import math


class Budget(ArithmeticError):
    pass


class Ambiguous(Exception):
    pass


def bounded(x):
    x = F(x)
    if max(x.numerator.bit_length(), x.denominator.bit_length()) > 4096:
        raise Budget("stored exact arithmetic exceeds 4096 bits")
    return x


def total(xs):
    result = F(0)
    for x in xs:
        result = bounded(result + x)
    return result


def dot(a, b):
    return total(bounded(x*y) for x, y in zip(a, b))


def sub(a, b):
    return tuple(bounded(x-y) for x, y in zip(a, b))


def cross(a, b):
    return tuple(bounded(bounded(a[i]*b[j])-bounded(a[j]*b[i]))
                 for i, j in ((1, 2), (2, 0), (0, 1)))


def coefficient(x):
    if type(x) is not float or not math.isfinite(x):
        raise ValueError("finite binary64 floats required")
    q = F(*x.as_integer_ratio())
    if max(q.numerator.bit_length(), q.denominator.bit_length()) > 128:
        raise ValueError("input ratio exceeds 128 bits")
    return q


def rank(points):
    """Affine rank in the three independent barycentric coordinates."""
    if not points:
        return -1
    vectors = [sub(p[1:], points[0][1:]) for p in points[1:]]
    first = next((v for v in vectors if any(v)), None)
    if first is None:
        return 0
    normal = next((cross(first, v) for v in vectors if any(cross(first, v))), None)
    if normal is None:
        return 1
    return 3 if any(dot(normal, v) for v in vectors) else 2


def clean_cycle(sequence):
    """Keep a convex cycle's order, removing repeated/collinear corners exactly."""
    cycle = []
    for p in sequence:
        if not cycle or p != cycle[-1]:
            cycle.append(p)
    if len(cycle) > 1 and cycle[0] == cycle[-1]:
        cycle.pop()
    dimension = rank(cycle)
    if dimension < 2:
        points = sorted(set(cycle))
        return points if len(points) < 2 else [points[0], points[-1]]
    if dimension != 2 or len(set(cycle)) != len(cycle):
        raise Ambiguous("nonplanar or repeated boundary cycle")
    changed = True
    while changed and len(cycle) > 3:
        changed = False
        for i, q in enumerate(cycle):
            p, r = cycle[i-1], cycle[(i+1) % len(cycle)]
            if not any(cross(sub(q[1:], p[1:]), sub(r[1:], q[1:]))):
                cycle.pop(i)
                changed = True
                break
    return cycle


def clip_cycle(cycle, values):
    """Sutherland-Hodgman; intersections use original barycentric weights."""
    if not cycle:
        return []
    result = []
    previous = cycle[-1]
    fp = dot(previous, values)
    for current in cycle:
        fc = dot(current, values)
        if (fp > 0) != (fc > 0):
            t = bounded(fp / bounded(fp-fc))
            result.append(tuple(bounded(a + bounded(t*bounded(b-a)))
                                for a, b in zip(previous, current)))
        if fc <= 0:
            result.append(current)
        previous, fp = current, fc
    return clean_cycle(result)


def cap_from_boundary(faces, values):
    """Reverse the unmatched directed on-plane face edges; no hull/sort repair."""
    edges = {}
    for face in faces:
        cycle = face['cycle']
        for a, b in zip(cycle, cycle[1:] + cycle[:1]):
            if dot(a, values) != 0 or dot(b, values) != 0:
                continue
            reverse = (b, a)
            if edges.get(reverse, 0):
                edges[reverse] -= 1
            else:
                edges[(a, b)] = edges.get((a, b), 0) + 1
    boundary = [(b, a) for (a, b), count in edges.items() for _ in range(count)]
    if len(boundary) < 3 or len(boundary) > 64:
        raise Ambiguous("cap does not have a bounded polygon boundary")
    outgoing, incoming = {}, {}
    for a, b in boundary:
        if a in outgoing or b in incoming or a == b:
            raise Ambiguous("branched or repeated cap boundary")
        outgoing[a], incoming[b] = b, a
    if set(outgoing) != set(incoming):
        raise Ambiguous("open cap boundary")
    start = min(outgoing)
    cycle, current = [], start
    for _ in range(len(boundary)):
        if current in cycle:
            raise Ambiguous("multiple or premature cap cycles")
        cycle.append(current)
        current = outgoing[current]
    if current != start or len(cycle) != len(outgoing):
        raise Ambiguous("cap cycle does not cover boundary")
    return clean_cycle(cycle)


def state_cap(points, faces):
    if len(points) > 64 or len(faces) > 32 or any(len(f['cycle']) > 64 for f in faces):
        raise Budget("local state exceeds 64 vertices or 32 faces")


def material_cell(gids, points, labels, cuts):
    """Four IDs/XYZ/label sets; <=7 named four-sample f<=0 inequalities.

    Invalid input raises ValueError; bounded arithmetic/state exhaustion UNKNOWN;
    ambiguous local ownership/topology REFUSED. No hard OS memory claim.
    """
    try:
        return _material_cell(gids, points, labels, cuts)
    except Budget as error:
        return {'status': 'UNKNOWN', 'reason': str(error)}
    except Ambiguous as error:
        return {'status': 'REFUSED', 'reason': str(error)}


def _material_cell(gids, points, labels, cuts):
    if any(not isinstance(x, (list, tuple)) for x in (gids, points, labels, cuts)):
        raise ValueError("finite list/tuple inputs required")
    if len(gids) != 4 or any(type(g) is not int or not 0 <= g < 2**63 for g in gids) or len(set(gids)) != 4:
        raise ValueError("four distinct bounded global IDs required")
    if len(points) != 4 or any(not isinstance(p, (list, tuple)) or len(p) != 3 for p in points):
        raise ValueError("four XYZ points required")
    world = [tuple(coefficient(x) for x in p) for p in points]
    if len(labels) != 4 or any(not isinstance(s, (set, frozenset)) or not s or not s <= {'r', 'l', 'torso'} for s in labels):
        raise ValueError("four complete nonempty source-region sets required")
    basis = [sub(world[i], world[0]) for i in (1, 2, 3)]
    cofactors = [cross(basis[1], basis[2]), cross(basis[2], basis[0]), cross(basis[0], basis[1])]
    determinant = dot(basis[0], cofactors[0])
    if determinant <= 0:
        raise ValueError("positive nondegenerate tetrahedron required")
    if len(cuts) > 7:
        raise ValueError("at most seven named global inequalities")
    names, fields = [], []
    for row in cuts:
        if not isinstance(row, (list, tuple)) or len(row) != 2:
            raise ValueError("each inequality needs name and four samples")
        name, values = row
        if type(name) is not str or not name.isascii() or not name or len(name) > 32 or name in names:
            raise ValueError("unique bounded ASCII cut names required")
        if not isinstance(values, (list, tuple)) or len(values) != 4:
            raise ValueError("four cut samples required")
        names.append(name)
        fields.append(tuple(coefficient(v) for v in values))
    original = [tuple(F(int(i == j)) for i in range(4)) for j in range(4)]
    planes = [{'kind': 'tet', 'owner': tuple(sorted(g for j, g in enumerate(gids) if j != i)),
               'values': tuple(F(-int(i == j)) for j in range(4))} for i in range(4)]
    cut_planes = []
    for name, values in zip(names, fields):
        if len(set(values)) == 1:
            if values[0] > 0:
                return {'status': 'EMPTY', 'reason': 'constant positive inequality', 'vertices': []}
            if values[0] == 0:
                return {'status': 'UNKNOWN', 'reason': 'identically zero global inequality'}
            continue
        plane = {'kind': 'cut', 'owner': name, 'values': values}
        cut_planes.append(plane)
        planes.append(plane)
    cycles = ((1, 2, 3), (0, 3, 2), (0, 1, 3), (0, 2, 1))
    faces = [dict(plane, cycle=[original[i] for i in cycle]) for plane, cycle in zip(planes[:4], cycles)]
    vertices, low, dimension, steps = original, None, 3, 0
    for plane in cut_planes:
        steps += 1
        values = plane['values']
        if dimension < 3:
            low = clip_cycle(low, values)
            vertices, dimension = low, rank(low)
            if dimension == -1:
                break
            state_cap(vertices, [])
            continue
        old_vertices = {p for f in faces for p in f['cycle']}
        clipped = [dict(f, cycle=clip_cycle(f['cycle'], values)) for f in faces]
        vertices = list(dict.fromkeys(p for f in clipped for p in f['cycle']))
        dimension = rank(vertices)
        if dimension == -1:
            faces = []
            break
        if dimension < 3:
            if dimension == 2:
                polygons = [f['cycle'] for f in clipped if rank(f['cycle']) == 2]
                if not polygons:
                    raise Ambiguous("collapsed planar state lacks an ordered surviving face")
                low = polygons[0]
                if set(low) != set(vertices):
                    raise Ambiguous("collapsed planar face does not own all extreme vertices")
            else:
                low = clean_cycle(vertices)
            vertices, faces = low, []
            state_cap(vertices, faces)
            continue
        faces = [f for f in clipped if rank(f['cycle']) == 2]
        # A strict outside vertex means a true cut; tangent/redundant cuts add no cap.
        if any(dot(p, values) > 0 for p in old_vertices):
            faces.append(dict(plane, cycle=cap_from_boundary(faces, values)))
        vertices = list(dict.fromkeys(p for f in faces for p in f['cycle']))
        state_cap(vertices, faces)
    output_vertices, key_positions = [], {}
    for weights in vertices:
        if min(weights) < 0 or total(weights) != 1:
            raise Ambiguous("invalid constructed barycentric coordinates")
        support = tuple(sorted(g for g, w in zip(gids, weights) if w > 0))
        active = tuple(sorted(n for n, f in zip(names, fields) if dot(weights, f) == 0))
        key = (support, active)
        position = tuple(total(bounded(w*p[a]) for w, p in zip(weights, world)) for a in range(3))
        if key in key_positions and key_positions[key] != position:
            raise Budget("canonical key collision")
        key_positions[key] = position
        regions = sorted(set().union(*(s for s, w in zip(labels, weights) if w > 0)))
        output_vertices.append({'key': key, 'u': weights[1:], 'weights': tuple(sorted(zip(gids, weights))),
                                'position': position, 'regions': regions})
    output_vertices.sort(key=lambda v: v['key'])
    if dimension < 3:
        return {'status': 'EMPTY' if dimension == -1 else 'DEGENERATE', 'dimension': dimension,
                'vertices': output_vertices, 'facets': [], 'volume': F(0), 'clip_steps': steps}
    index = {tuple(dict(v['weights'])[g] for g in gids): i for i, v in enumerate(output_vertices)}
    facets = []
    for face in faces:
        owners = [p for p in planes if all(dot(w, p['values']) == 0 for w in face['cycle'])]
        if len(owners) != 1 or owners[0]['kind'] != face['kind'] or owners[0]['owner'] != face['owner']:
            raise Ambiguous("multiple or unbound positive-area facet owners")
        cycle = [index[w] for w in face['cycle']]
        pivot = min(range(len(cycle)), key=lambda i: output_vertices[cycle[i]]['key'])
        cycle = cycle[pivot:] + cycle[:pivot]
        values = face['values']
        a = tuple(bounded(values[i]-values[0]) for i in (1, 2, 3))
        normal = tuple(bounded(total(bounded(a[i]*cofactors[i][j]) for i in range(3))/determinant) for j in range(3))
        # The WHOLE pre-fan polygon union is computed once, then copied literally.
        regions = sorted(set().union(*(output_vertices[i]['regions'] for i in cycle)))
        triangles = []
        for j in range(1, len(cycle)-1):
            triangle = (cycle[0], cycle[j], cycle[j+1])
            p, q, r = (output_vertices[i]['position'] for i in triangle)
            if dot(normal, cross(sub(q, p), sub(r, p))) <= 0:
                raise Ambiguous("nonpositive outward fan triangle")
            triangles.append({'vertices': triangle, 'regions': list(regions)})
        facets.append({'kind': face['kind'], 'owner': face['owner'], 'vertices': cycle,
                       'normal_world': normal, 'regions': regions, 'triangles': triangles})
    facets.sort(key=lambda f: (f['kind'], str(f['owner'])))
    edges, used = {}, set()
    for face in facets:
        cycle = face['vertices']
        used.update(cycle)
        for a, b in zip(cycle, cycle[1:] + cycle[:1]):
            edge = tuple(sorted((a, b)))
            edges.setdefault(edge, []).append(1 if (a, b) == edge else -1)
    if used != set(range(len(output_vertices))) or any(len(v) != 2 or sum(v) != 0 for v in edges.values()) or len(output_vertices)-len(edges)+len(facets) != 2:
        raise Ambiguous("local opposed incidence or Euler failure")
    volume = bounded(total(dot(output_vertices[t['vertices'][0]]['position'],
                               cross(output_vertices[t['vertices'][1]]['position'], output_vertices[t['vertices'][2]]['position']))
                           for f in facets for t in f['triangles'])/6)
    if volume <= 0:
        raise Ambiguous("nonpositive oriented local volume")
    return {'status': 'OK', 'dimension': 3, 'vertices': output_vertices, 'facets': facets,
            'volume': volume, 'edge_count': len(edges), 'clip_steps': steps}
