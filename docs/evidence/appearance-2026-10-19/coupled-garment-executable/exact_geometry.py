"""Pure geometry definitions for the separately gated sweater trial; no entry point."""
from fractions import Fraction as Q
import heapq
import math


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def scale(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm2(a): return dot(a, a)
def mean(points):
    n = len(points)
    return tuple(sum(p[k] for p in points) / n for k in range(3))
def unit(a):
    n = math.sqrt(norm2(a))
    if not n or not math.isfinite(n): raise ValueError("zero/nonfinite direction")
    return scale(a, 1/n)
def rational(a): return tuple(Q(x) for x in a)
def bounds(triangle):
    return (tuple(min(p[k] for p in triangle) for k in range(3)),
            tuple(max(p[k] for p in triangle) for k in range(3)))
def merged(boxes):
    return (tuple(min(b[0][k] for b in boxes) for k in range(3)),
            tuple(max(b[1][k] for b in boxes) for k in range(3)))
def box_gap2(a, b):
    return sum(max(0, a[0][k]-b[1][k], b[0][k]-a[1][k])**2 for k in range(3))
def overlaps(a, b): return all(a[0][k] <= b[1][k] and b[0][k] <= a[1][k] for k in range(3))


def point_segment(p, a, b):
    e = sub(b, a)
    d = norm2(e)
    t = max(0, min(1, dot(sub(p, a), e)/d)) if d else 0
    c = add(a, scale(e, t))
    return norm2(sub(p, c)), c, t


def point_triangle(p, tri):
    """Complete face/edge candidates, deterministic feature priority, float or Q."""
    a, b, c = tri
    x, y, z = sub(b, a), sub(c, a), sub(p, a)
    xx, xy, yy = dot(x, x), dot(x, y), dot(y, y)
    det = xx*yy-xy*xy
    candidates = []
    if det > 0:
        v = (yy*dot(x, z)-xy*dot(y, z))/det
        w = (xx*dot(y, z)-xy*dot(x, z))/det
        u = 1-v-w
        if min(u, v, w) >= 0:
            cp = add(a, add(scale(x, v), scale(y, w)))
            candidates.append((norm2(sub(p, cp)), 0, cp, (u, v, w)))
    for rank, (i, j) in enumerate(((0, 1), (1, 2), (2, 0)), 1):
        d2, cp, t = point_segment(p, tri[i], tri[j])
        beta = [0, 0, 0]
        beta[i], beta[j] = 1-t, t
        feature = (4+i if t == 0 else 4+j) if t in (0, 1) else rank
        candidates.append((d2, feature, cp, tuple(beta)))
    return min(candidates, key=lambda r: (r[0], r[1]))


def segment_distance2(a, b, c, d):
    candidates = [point_segment(a, c, d)[0], point_segment(b, c, d)[0],
                  point_segment(c, a, b)[0], point_segment(d, a, b)[0]]
    u, v, w = sub(b, a), sub(d, c), sub(a, c)
    aa, bb, cc, dd, ee = dot(u, u), dot(u, v), dot(v, v), dot(u, w), dot(v, w)
    det = aa*cc-bb*bb
    if det > 0:
        s, t = (bb*ee-cc*dd)/det, (aa*ee-bb*dd)/det
        if 0 <= s <= 1 and 0 <= t <= 1:
            candidates.append(norm2(sub(add(a, scale(u, s)), add(c, scale(v, t)))))
    return min(candidates)


def orient2(a, b, c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def project2(p, axis): return tuple(p[k] for k in range(3) if k != axis)
def between2(p, a, b):
    return orient2(a, b, p) == 0 and all(min(a[k], b[k]) <= p[k] <= max(a[k], b[k]) for k in range(2))
def inside2(p, tri):
    s = [orient2(tri[i], tri[(i+1)%3], p) for i in range(3)]
    return min(s) >= 0 or max(s) <= 0


def segment_intersections2(a, b, c, d):
    ab, cd = (b[0]-a[0], b[1]-a[1]), (d[0]-c[0], d[1]-c[1])
    det = ab[0]*cd[1]-ab[1]*cd[0]
    if det:
        ac = (c[0]-a[0], c[1]-a[1])
        t = (ac[0]*cd[1]-ac[1]*cd[0])/det
        s = (ac[0]*ab[1]-ac[1]*ab[0])/det
        return [(a[0]+t*ab[0], a[1]+t*ab[1])] if 0 <= t <= 1 and 0 <= s <= 1 else []
    if orient2(a, b, c): return []
    return list(dict.fromkeys(p for p in (a, b, c, d) if between2(p, a, b) and between2(p, c, d)))


def point_in_triangle3(p, tri):
    n = cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]))
    if dot(n, sub(p, tri[0])): return False
    axis = max(range(3), key=lambda k: (abs(n[k]), -k))
    return inside2(project2(p, axis), [project2(q, axis) for q in tri])


def triangle_intersection_points(a, b):
    """Exact intersection vertices; convexity makes their hull the intersection."""
    na, nb = cross(sub(a[1], a[0]), sub(a[2], a[0])), cross(sub(b[1], b[0]), sub(b[2], b[0]))
    if not norm2(na) or not norm2(nb): raise ValueError("singular triangle")
    da, db = [dot(nb, sub(p, b[0])) for p in a], [dot(na, sub(p, a[0])) for p in b]
    if min(da) > 0 or max(da) < 0 or min(db) > 0 or max(db) < 0: return []
    points = []
    if all(x == 0 for x in da):
        axis = max(range(3), key=lambda k: (abs(na[k]), -k))
        aa, bb = [project2(p, axis) for p in a], [project2(p, axis) for p in b]
        points += [p for p, p2 in zip(a, aa) if inside2(p2, bb)]
        points += [p for p, p2 in zip(b, bb) if inside2(p2, aa)]
        for i in range(3):
            for j in range(3):
                for q2 in segment_intersections2(aa[i], aa[(i+1)%3], bb[j], bb[(j+1)%3]):
                    edge = sub(a[(i+1)%3], a[i])
                    candidates = [k for k in range(3) if k != axis and edge[k] != 0]
                    if not candidates: raise ValueError("projection collapsed nonzero edge")
                    k = candidates[0]
                    projected_index = [h for h in range(3) if h != axis].index(k)
                    t = (q2[projected_index]-a[i][k])/edge[k]
                    points.append(add(a[i], scale(edge, t)))
    else:
        for tri, distances, other in ((a, da, b), (b, db, a)):
            for i in range(3):
                j = (i+1)%3
                if distances[i] == 0 and point_in_triangle3(tri[i], other): points.append(tri[i])
                if distances[i]*distances[j] < 0:
                    t = distances[i]/(distances[i]-distances[j])
                    p = add(tri[i], scale(sub(tri[j], tri[i]), t))
                    if point_in_triangle3(p, other): points.append(p)
                elif distances[i] == distances[j] == 0:
                    # An entire edge lies in the other plane: its clipped endpoints
                    # are obtained using the other triangle's coplanar projection.
                    n = cross(sub(other[1], other[0]), sub(other[2], other[0]))
                    axis = max(range(3), key=lambda k: (abs(n[k]), -k))
                    p2, q2 = project2(tri[i], axis), project2(tri[j], axis)
                    oo = [project2(q, axis) for q in other]
                    if inside2(q2, oo): points.append(tri[j])
                    for h in range(3):
                        for hit in segment_intersections2(p2, q2, oo[h], oo[(h+1)%3]):
                            uv = (q2[0]-p2[0], q2[1]-p2[1])
                            k = 0 if uv[0] else 1
                            t = (hit[k]-p2[k])/uv[k]
                            points.append(add(tri[i], scale(sub(tri[j], tri[i]), t)))
    return list(dict.fromkeys(points))


def triangle_distance2(a, b):
    if triangle_intersection_points(a, b): return Q(0)
    values = [point_triangle(p, b)[0] for p in a]+[point_triangle(p, a)[0] for p in b]
    for i in range(3):
        for j in range(3):
            values.append(segment_distance2(a[i], a[(i+1)%3], b[j], b[(j+1)%3]))
    return min(values)


def on_segment3(p, a, b):
    e = sub(b, a)
    if norm2(cross(sub(p, a), e)): return False
    return all(min(a[k], b[k]) <= p[k] <= max(a[k], b[k]) for k in range(3))


def ray_triangle(origin, direction, tri):
    n = cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]))
    denom, numer = dot(n, direction), dot(n, sub(tri[0], origin))
    if denom == 0:
        if numer == 0: raise ValueError("ambiguous coplanar fixed ray")
        return False
    t = numer/denom
    if t <= 0:
        if t == 0 and point_in_triangle3(origin, tri): raise ValueError("ray origin on boundary")
        return False
    hit = add(origin, scale(direction, t))
    if not point_in_triangle3(hit, tri): return False
    if any(on_segment3(hit, tri[i], tri[(i+1)%3]) for i in range(3)):
        raise ValueError("ambiguous fixed ray edge/vertex")
    return True


def ray_box(origin, direction, box):
    lo, hi = Q(0), None
    for k in range(3):
        if direction[k] == 0:
            if origin[k] < box[0][k] or origin[k] > box[1][k]: return False
        else:
            a, b = (box[0][k]-origin[k])/direction[k], (box[1][k]-origin[k])/direction[k]
            low, high = min(a, b), max(a, b)
            lo = max(lo, low)
            hi = high if hi is None else min(hi, high)
            if hi < lo: return False
    return hi is None or hi >= lo


class BVH:
    def __init__(self, triangles):
        self.triangles = triangles
        self.boxes = [bounds(t) for t in triangles]
        self.nodes = []
        def build(ids):
            box = merged([self.boxes[i] for i in ids])
            index = len(self.nodes)
            self.nodes.append(None)
            if len(ids) <= 8:
                self.nodes[index] = (box, tuple(sorted(ids)), None)
            else:
                axis = max(range(3), key=lambda k: (box[1][k]-box[0][k], -k))
                ids.sort(key=lambda i: (sum(p[axis] for p in triangles[i])/3, i))
                middle = len(ids)//2
                children = (build(ids[:middle]), build(ids[middle:]))
                self.nodes[index] = (box, None, children)
            return index
        if not triangles: raise ValueError("empty BVH")
        build(list(range(len(triangles))))

    def nearest(self, point, tick):
        box = (point, point)
        queue = [(box_gap2(box, self.nodes[0][0]), 0)]
        best = None
        while queue:
            lower, node = heapq.heappop(queue)
            if best is not None and lower > best[0]+1e-12: continue
            _, ids, children = self.nodes[node]
            if ids is not None:
                for i in ids:
                    tick("solver")
                    d2, feature, cp, beta = point_triangle(point, self.triangles[i])
                    value = (d2, i, feature, cp, beta)
                    if best is None or value[:3] < best[:3]: best = value
            else:
                for child in children:
                    heapq.heappush(queue, (box_gap2(box, self.nodes[child][0]), child))
        return best

    def overlap_candidates(self, box):
        stack = [0]
        while stack:
            i = stack.pop()
            bounds_, ids, children = self.nodes[i]
            if not overlaps(box, bounds_): continue
            if ids is not None:
                for face in ids:
                    if overlaps(box, self.boxes[face]): yield face
            else: stack.extend(reversed(children))

    def gap_candidates(self, box, limit):
        stack = [0]
        while stack:
            i = stack.pop()
            bounds_, ids, children = self.nodes[i]
            if box_gap2(box, bounds_) >= limit: continue
            if ids is not None:
                for face in ids:
                    if box_gap2(box, self.boxes[face]) < limit: yield face
            else: stack.extend(reversed(children))

    def ray_candidates(self, origin, direction):
        stack = [0]
        while stack:
            i = stack.pop()
            bounds_, ids, children = self.nodes[i]
            if not ray_box(origin, direction, bounds_): continue
            if ids is not None:
                for face in ids:
                    if ray_box(origin, direction, self.boxes[face]): yield face
            else: stack.extend(reversed(children))
