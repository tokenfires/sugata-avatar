"""One expansion of the complete literal original artist source. No fitting."""
import collections
import datetime
import json
import math
import os
from pathlib import Path
import sys

source, output = map(Path, sys.argv[1:3])
state = {"pid": os.getpid(), "utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "phase": "start", "error": None}
positions, quads, regions = [], [], []

def save(name, value):
    (output / name).write_text(json.dumps(value, indent=2) + "\n")

def phase(name):
    state.update(phase=name, vertices=len(positions), quads=len(quads))
    save("PARTIAL.json", state)

def require(ok, message):
    if not ok:
        raise ValueError(message)

def component(nodes, graph):
    todo = [next(iter(nodes))]
    seen = set(todo)
    while todo:
        for neighbour in graph[todo.pop()]:
            if neighbour not in seen:
                seen.add(neighbour)
                todo.append(neighbour)
    return seen == set(nodes)

try:
    phase("literal-source")
    data = json.loads(source.read_text())
    def ring(row, shape, centre):
        front, back = [], []
        for t, factor in zip(shape["x"], shape["depth"], strict=True):
            front.append(len(positions))
            positions.append([centre + row["halfWidth"]*t, row["y"], row["frontDepth"]*factor])
        for j, (t, factor) in enumerate(zip(shape["x"], shape["depth"], strict=True)):
            if j in (0, len(front)-1):
                back.append(front[j])
            else:
                back.append(len(positions))
                positions.append([centre + row["halfWidth"]*t, row["y"], -row["backDepth"]*factor])
        return front, back

    def strip(top, bottom, region):
        tf, tb = top
        bf, bb = bottom
        require(len(tf) == len(bf) == len(tb) == len(bb), "arc size")
        for j in range(len(tf)-1):
            quads.append([tf[j], bf[j], bf[j+1], tf[j+1]])
            regions.append(region)
        for j in range(len(tb)-1):
            quads.append([tb[j], tb[j+1], bb[j+1], bb[j]])
            regions.append(region)

    phase("whole-surface-expansion")
    upper = [ring(row, data["upperShape"], 0) for row in data["upperRows"]]
    legs = [[ring(row, data["legShape"], sign*row["centreMagnitude"]) for row in data["legRows"]] for sign in (-1,1)]
    for i in range(len(upper)-1):
        strip(upper[i], upper[i+1], "waistband" if i == 0 else "body")
    uf, ub = upper[-1]
    strip((uf[:9], ub[:9]), legs[0][0], "body")
    strip((uf[8:], ub[8:]), legs[1][0], "body")
    quads.append([uf[8], legs[0][0][0][-1], ub[8], legs[1][0][0][0]])
    regions.append("body")
    for leg in legs:
        for i in range(len(leg)-1):
            strip(leg[i], leg[i+1], "body")
    ports = {"waist-mouth":upper[0][0]+list(reversed(upper[0][1][1:-1])),
             "left-hem-mouth":legs[0][-1][0]+list(reversed(legs[0][-1][1][1:-1])),
             "right-hem-mouth":legs[1][-1][0]+list(reversed(legs[1][-1][1][1:-1]))}
    triangles = [t for a,b,c,d in quads for t in ([a,b,c],[a,c,d])]
    save("surface-partial.json", {"positions":positions,"quads":quads,"regions":regions,"ports":ports,"limits":data["limits"]})
    phase("physical-topology-check")
    require(all(math.isfinite(c) for p in positions for c in p), "nonfinite coordinate")
    edges = collections.defaultdict(list)
    face_graph = collections.defaultdict(set)
    links = collections.defaultdict(lambda: collections.defaultdict(set))
    min_cross2 = math.inf
    for fi, t in enumerate(triangles):
        require(len(set(t)) == 3, "duplicate triangle corner")
        a,b,c = (positions[i] for i in t)
        u,v = [b[i]-a[i] for i in range(3)], [c[i]-a[i] for i in range(3)]
        cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        cross2 = sum(x*x for x in cross)
        require(cross2 > 1e-12, "zero/nearzero triangle in unitless source")
        min_cross2 = min(min_cross2, cross2)
        for i in range(3):
            a,b = t[i],t[(i+1)%3]
            edges[tuple(sorted((a,b)))].append((fi,a,b))
            centre, x, y = t[i],t[(i+1)%3],t[(i+2)%3]
            links[centre][x].add(y)
            links[centre][y].add(x)
    boundary = set()
    boundary_graph = collections.defaultdict(set)
    for edge, uses in edges.items():
        require(len(uses) in (1,2), "nonmanifold edge")
        if len(uses) == 2:
            f,a,b = uses[0]
            g,c,d = uses[1]
            require((a,b) == (d,c), "inconsistent face orientation")
            face_graph[f].add(g)
            face_graph[g].add(f)
        else:
            boundary.add(edge)
            a,b = edge
            boundary_graph[a].add(b)
            boundary_graph[b].add(a)
    require(component(range(len(triangles)), face_graph), "disconnected surface")
    named = set()
    for name, cycle in ports.items():
        require(len(set(cycle)) == len(cycle), "repeated port vertex")
        for a,b in zip(cycle, cycle[1:]+cycle[:1], strict=True):
            edge = tuple(sorted((a,b)))
            require(edge not in named, "ports share edge")
            named.add(edge)
    require(boundary == named, "unnamed/missing opening edge")
    require(all(len(n) == 2 for n in boundary_graph.values()), "noncycle boundary")
    for vertex, link in links.items():
        require(component(link, link), "disconnected vertex link")
        degrees = sorted(len(v) for v in link.values())
        if vertex in boundary_graph:
            require(degrees.count(1) == 2 and all(d in (1,2) for d in degrees), "boundary vertex link not interval")
        else:
            require(all(d == 2 for d in degrees), "interior vertex link not cycle")
    actual = {"vertices":len(positions),"quads":len(quads),"triangles":len(triangles),"triangleEdges":len(edges),"boundaryEdges":len(boundary),"boundaryLoops":len(ports),"euler":len(positions)-len(edges)+len(triangles)}
    require(actual == data["expected"], "literal topology counts differ")
    save("CHECK.json", {"actual":actual,"minimumSquaredTriangleCross":min_cross2,"gates":"finite/nonzero/oriented-edge/connected-face/exact-ports/connected-vertex-links/counts pass", "limits":data["limits"]})
    phase("export")
    save("mesh.json", {"author":data["author"],"frame":data["frame"],"positions":positions,"quads":quads,"regions":regions,"ports":ports,"limits":data["limits"]})
    text = "# Cora original unitless trouser artist blockout; no fit\n"
    text += "".join("v " + " ".join(format(v,".17g") for v in p) + "\n" for p in positions)
    for region, q in zip(regions, quads, strict=True):
        text += "g " + region + "\nf " + " ".join(str(v+1) for v in q) + "\n"
    (output / "trousers.obj").write_text(text)
    phase("complete")
except Exception as error:
    state["error"] = repr(error)
    save("PARTIAL.json", state)
    raise
