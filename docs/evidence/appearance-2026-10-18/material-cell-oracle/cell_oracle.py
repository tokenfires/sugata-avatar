"""Exact SINGLE synthetic-cell reference, independent of the held grid builder.

No file access, native APIs, global fields, exports or import-time evaluation.
An OK result describes a convex local polytope only, never physical suitability.
"""
from fractions import Fraction as F
from itertools import combinations
import math


class ArithmeticBudget(ArithmeticError):
    pass


def bounded(value):
    value = F(value)
    if max(value.numerator.bit_length(), value.denominator.bit_length()) > 4096:
        raise ArithmeticBudget("exact intermediate exceeds 4096 bits")
    return value


def coefficient(value):
    if type(value) is not float or not math.isfinite(value):
        raise ValueError("coefficients must be finite binary64 floats")
    result = F(*value.as_integer_ratio())
    if max(result.numerator.bit_length(), result.denominator.bit_length()) > 128:
        raise ValueError("input ratio exceeds 128 bits")
    return result


def sub(a, b):
    return tuple(bounded(x-y) for x, y in zip(a, b))


def dot(a, b):
    return bounded(sum(x*y for x, y in zip(a, b)))


def cross(a, b):
    return (bounded(a[1]*b[2]-a[2]*b[1]),
            bounded(a[2]*b[0]-a[0]*b[2]),
            bounded(a[0]*b[1]-a[1]*b[0]))


def det(rows):
    return dot(rows[0], cross(rows[1], rows[2]))


def solve(rows, rhs):
    denominator = det(rows)
    if denominator == 0:
        return None
    columns = []
    for axis in range(3):
        replaced = [tuple(rhs[i] if j == axis else rows[i][j]
                          for j in range(3)) for i in range(3)]
        columns.append(bounded(det(replaced)/denominator))
    return tuple(columns)


def dimension(points):
    if not points:
        return -1
    origin = points[0]
    vectors = [sub(p, origin) for p in points[1:]]
    first = next((v for v in vectors if any(v)), None)
    if first is None:
        return 0
    normal = next((cross(first, v) for v in vectors if any(cross(first, v))), None)
    if normal is None:
        return 1
    return 3 if any(dot(normal, v) for v in vectors) else 2


def hull_cycle(indices, vertices, normal):
    """Exact projected convex hull, independent of sequential face clipping."""
    drop = next(i for i, value in enumerate(normal) if value)
    axes = [i for i in range(3) if i != drop]
    xy = lambda i: tuple(vertices[i]["u"][a] for a in axes)
    ordered = sorted(indices, key=xy)

    def turn(a, b, c):
        p, q, r = xy(a), xy(b), xy(c)
        return bounded((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))

    def chain(sequence):
        result = []
        for index in sequence:
            while len(result) >= 2 and turn(result[-2], result[-1], index) <= 0:
                result.pop()
            result.append(index)
        return result

    cycle = chain(ordered)[:-1] + chain(list(reversed(ordered)))[:-1]
    if len(cycle) < 3:
        return []
    a, b, c = (vertices[i]["u"] for i in cycle[:3])
    orientation = dot(normal, cross(sub(b, a), sub(c, a)))
    if orientation == 0:
        return []
    if orientation < 0:
        cycle.reverse()
    pivot = min(range(len(cycle)), key=lambda i: vertices[cycle[i]]["key"])
    return cycle[pivot:] + cycle[:pivot]


def material_cell(gids, points, labels, cuts):
    """gids/points/labels have length four; cuts are (name, four floats).

    Returns exact Fractions in the reference API. Invalid inputs raise ValueError;
    bounded arithmetic exhaustion is UNKNOWN. Degenerate/ambiguous cells never OK.
    """
    try:
        return _material_cell(gids, points, labels, cuts)
    except ArithmeticBudget as error:
        return {"status": "UNKNOWN", "reason": str(error)}


def _material_cell(gids, points, labels, cuts):
    if any(not isinstance(s, (list, tuple)) for s in (gids, points, labels, cuts)):
        raise ValueError("finite list/tuple inputs required")
    if len(gids) != 4 or any(type(g) is not int or not 0 <= g < 2**63 for g in gids) or len(set(gids)) != 4:
        raise ValueError("four distinct bounded global node IDs required")
    if len(points) != 4 or any(not isinstance(p, (list, tuple)) or len(p) != 3 for p in points):
        raise ValueError("four XYZ points required")
    world = [tuple(coefficient(x) for x in p) for p in points]
    if len(labels) != 4 or any(not isinstance(s, (set, frozenset)) or not s or
                               not s <= {"r", "l", "torso"} for s in labels):
        raise ValueError("four nonempty accepted source-region sets required")
    basis = [sub(world[i], world[0]) for i in range(1, 4)]
    if det(basis) <= 0:
        raise ValueError("positive nondegenerate tetra determinant required")
    if len(cuts) > 7:
        raise ValueError("at most seven global inequalities")
    names = []
    fields = []
    for row in cuts:
        if not isinstance(row, (list, tuple)) or len(row) != 2:
            raise ValueError("each cut requires an ID and four values")
        name, values = row
        if type(name) is not str or not name.isascii() or not name or len(name) > 32 or name in names:
            raise ValueError("unique bounded ASCII global inequality IDs required")
        if not isinstance(values, (list, tuple)) or len(values) != 4:
            raise ValueError("four field values required")
        names.append(name)
        fields.append(tuple(coefficient(x) for x in values))
    planes = []
    for i, (a, b) in enumerate([((1, 1, 1), -1), ((-1, 0, 0), 0),
                                ((0, -1, 0), 0), ((0, 0, -1), 0)]):
        planes.append({"a": tuple(F(x) for x in a), "b": F(b), "kind": "tet",
                       "owner": tuple(sorted(g for j, g in enumerate(gids) if j != i))})
    for name, values in zip(names, fields):
        a = tuple(bounded(values[i]-values[0]) for i in range(1, 4))
        if not any(a):
            if values[0] > 0:
                return {"status": "EMPTY", "reason": "constant positive inequality", "vertices": []}
            if values[0] == 0:
                return {"status": "UNKNOWN", "reason": "identically zero global inequality has no outward gradient"}
            continue
        planes.append({"a": a, "b": values[0], "kind": "cut", "owner": name})

    candidates = set()
    attempted = 0
    for triple in combinations(planes, 3):
        attempted += 1
        u = solve([p["a"] for p in triple], [-p["b"] for p in triple])
        if u is not None and all(dot(p["a"], u)+p["b"] <= 0 for p in planes):
            candidates.add(u)
    assert attempted <= 165
    vertices = []
    key_positions = {}
    for u in candidates:
        weights = (bounded(1-sum(u)), *u)
        assert all(w >= 0 for w in weights) and sum(weights) == 1
        support = tuple(sorted(g for g, w in zip(gids, weights) if w > 0))
        active = tuple(sorted(name for name, values in zip(names, fields) if dot(values, weights) == 0))
        key = (support, active)
        position = tuple(bounded(sum(w*p[a] for w, p in zip(weights, world))) for a in range(3))
        if key in key_positions and key_positions[key] != position:
            return {"status": "UNKNOWN", "reason": "canonical key collision"}
        key_positions[key] = position
        regions = sorted(set().union(*(s for s, w in zip(labels, weights) if w > 0)))
        vertices.append({"key": key, "u": u, "weights": tuple(sorted(zip(gids, weights))),
                         "position": position, "regions": regions})
    vertices.sort(key=lambda v: v["key"])
    rank = dimension([v["u"] for v in vertices])
    if rank < 3:
        return {"status": "EMPTY" if rank == -1 else "DEGENERATE", "dimension": rank,
                "vertices": vertices, "facets": [], "volume": F(0), "triple_solves": attempted}

    facets = []
    owner_cycles = set()
    for plane in planes:
        indices = [i for i, v in enumerate(vertices) if dot(plane["a"], v["u"])+plane["b"] == 0]
        if dimension([vertices[i]["u"] for i in indices]) != 2:
            continue
        cycle = hull_cycle(indices, vertices, plane["a"])
        if len(cycle) < 3 or len(set(cycle)) != len(cycle):
            return {"status": "REFUSED", "reason": "facet ordering ambiguity"}
        owner_key = tuple(sorted(cycle))
        if owner_key in owner_cycles:
            return {"status": "REFUSED", "reason": "multiple positive-area facet owners"}
        owner_cycles.add(owner_key)
        normal_world = solve(basis, plane["a"])
        assert normal_world is not None
        # Whole pre-fan polygon union ONCE; every triangle literally copies it.
        facet_regions = sorted(set().union(*(vertices[i]["regions"] for i in cycle)))
        triangles = []
        for j in range(1, len(cycle)-1):
            triangle = (cycle[0], cycle[j], cycle[j+1])
            a, b, c = (vertices[i]["position"] for i in triangle)
            if dot(normal_world, cross(sub(b, a), sub(c, a))) <= 0:
                return {"status": "REFUSED", "reason": "collapsed or non-outward fan triangle"}
            triangles.append({"vertices": triangle, "regions": list(facet_regions)})
        facets.append({"kind": plane["kind"], "owner": plane["owner"], "vertices": cycle,
                       "normal_world": normal_world, "regions": facet_regions, "triangles": triangles})
    facets.sort(key=lambda f: (f["kind"], str(f["owner"])))
    incidences = {}
    used = set()
    for facet in facets:
        cycle = facet["vertices"]
        used.update(cycle)
        for a, b in zip(cycle, cycle[1:] + cycle[:1]):
            edge = tuple(sorted((a, b)))
            incidences.setdefault(edge, []).append(1 if (a, b) == edge else -1)
    if used != set(range(len(vertices))) or any(len(v) != 2 or sum(v) != 0 for v in incidences.values()) or len(vertices)-len(incidences)+len(facets) != 2:
        return {"status": "REFUSED", "reason": "local incidence or Euler failure"}
    volume = bounded(sum(dot(vertices[t["vertices"][0]]["position"],
                             cross(vertices[t["vertices"][1]]["position"], vertices[t["vertices"][2]]["position"]))
                         for f in facets for t in f["triangles"])/6)
    if volume <= 0:
        return {"status": "REFUSED", "reason": "nonpositive oriented local volume"}
    return {"status": "OK", "dimension": 3, "vertices": vertices, "facets": facets,
            "volume": volume, "triple_solves": attempted, "edge_count": len(incidences)}
