"""Independent raw graph/OBJ observer; no creator import or coordinate reconstruction."""
from pathlib import Path
import collections
import hashlib
import json
import math

BASE = Path(__file__).resolve().parent
raw = (BASE/'export/mesh.json').read_bytes()
m = json.loads(raw)
p, faces = m['positions'], m['quads']
assert len(p) == len(m['vertex_labels']) == len(set(m['vertex_labels']))
assert len(faces) == len(m['face_roles'])
assert all(len(v) == 3 and all(type(c) in (int, float) and math.isfinite(c) for c in v) for v in p)
edges = collections.defaultdict(list)
links = collections.defaultdict(list)
min_area = math.inf
for fi, q in enumerate(faces):
    assert len(q) == 4 and len(set(q)) == 4
    assert all(type(v) == int and 0 <= v < len(p) for v in q)
    total = 0
    for a,b,c in [(q[0],q[1],q[2]), (q[0],q[2],q[3])]:
        u = [p[b][i]-p[a][i] for i in range(3)]; v = [p[c][i]-p[a][i] for i in range(3)]
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        area = math.sqrt(sum(x*x for x in cross))/2
        assert area > 1e-10, ('Degenerate triangle', fi)
        total += area
    min_area = min(min_area, total)
    for i, a in enumerate(q):
        b = q[(i+1)%4]
        edges[tuple(sorted((a,b)))].append((fi,a,b))
        links[a].append((q[(i-1)%4],b))
assert len(links) == len(p), 'Unused vertex'
adj = collections.defaultdict(set); boundary = collections.defaultdict(set)
for (a,b), es in edges.items():
    assert len(es) in (1,2), ('Nonmanifold edge',a,b)
    if len(es) == 2:
        assert es[0][1:] == es[1][1:][::-1], ('Inconsistent winding',a,b)
        adj[es[0][0]].add(es[1][0]); adj[es[1][0]].add(es[0][0])
    else: boundary[a].add(b); boundary[b].add(a)

def component(graph, start):
    seen, pending = set(), [start]
    while pending:
        a = pending.pop()
        if a not in seen:
            seen.add(a); pending.extend(graph[a]-seen)
    return seen

assert len(component(adj,0)) == len(faces), 'Disconnected faces'
assert all(len(ns) == 2 for ns in boundary.values())
for vertex, pairs in links.items():
    graph = collections.defaultdict(set); counts = collections.Counter()
    for a,b in pairs:
        assert (min(a,b),max(a,b)) not in counts, ('Repeated link edge',vertex)
        counts[(min(a,b),max(a,b))] += 1
        graph[a].add(b); graph[b].add(a)
    assert len(component(graph,next(iter(graph)))) == len(graph), ('Disconnected vertex link',vertex)
    degrees = collections.Counter(len(ns) for ns in graph.values())
    if vertex in boundary:
        assert degrees[1] == 2 and set(degrees) <= {1,2}, ('Nonmanifold boundary vertex',vertex)
    else: assert set(degrees) == {2}, ('Nonmanifold interior vertex',vertex)

remaining, observed_loops = set(boundary), []
while remaining:
    loop = component(boundary,min(remaining)); remaining -= loop; observed_loops.append(loop)
declared = m['boundaries']
assert set(declared) == {'continuous_collar_front_hem','left_wrist','right_wrist'}
assert len(observed_loops) == 3
for name, loop in declared.items():
    assert len(loop) == len(set(loop))
    assert set(loop) in observed_loops
    for a,b in zip(loop,loop[1:]+loop[:1]): assert b in boundary[a]
    if name.endswith('wrist'):
        side = name.split('_')[0]
        assert len(loop) == 8 and all(m['vertex_labels'][i].startswith(side+'.sleeve.4.') for i in loop)
perimeter = declared['continuous_collar_front_hem']
for name in ['collar.leaf.0','collar.leaf.6','left.front.0.4','right.front.0.4','back.0.5']:
    assert m['vertex_labels'].index(name) in perimeter
assert len(p)-len(edges)+len(faces) == -1
obj_p, obj_f = [], []
for line in (BASE/'export/overshirt.obj').read_text().splitlines():
    words = line.split()
    if words and words[0] == 'v': obj_p.append(list(map(float,words[1:])))
    elif words and words[0] == 'f': obj_f.append([int(v)-1 for v in words[1:]])
assert obj_p == p and obj_f == faces, 'OBJ roundtrip mismatch'
result = {'mesh_sha256':hashlib.sha256(raw).hexdigest(), 'vertices':len(p),'quads':len(faces),'edges':len(edges),
          'euler':-1,'face_components':1,'boundary_loops':{n:len(v) for n,v in declared.items()},
          'minimum_quad_area':min_area,'checks':'Finite, distinct nondegenerate corners, edge twins, connected face/vertex links, named boundaries, Euler, OBJ roundtrip',
          'limits':'Topology only; no general self-intersection, garment recognizability, cloth, body/pose clearance or wearable-fit proof'}
(BASE/'CPU-RESULT.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
