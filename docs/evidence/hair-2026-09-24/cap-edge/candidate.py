"""Isolated cap boundary experiment; no production recipe or shipped asset is edited."""
import os, runpy, sys
from pathlib import Path
from types import SimpleNamespace
from collections import defaultdict
from mathutils import Vector
pipeline = Path.cwd() / 'tools' / 'figure-pipeline'
sys.path.insert(0, str(pipeline))
import hair_cards
original = hair_cards.build_scalp_cap

def candidate(basemesh, frame):
    mesh = basemesh.data
    ear = basemesh.vertex_groups.get(hair_cards.EAR_VERTEX_GROUP)
    forbidden = hair_cards.face_moved_vertices(basemesh) | {
        v.index for v in mesh.vertices if ear and any(g.group == ear.index for g in v.groups)}
    faces = list(frame.faces)
    for _ in range(int(os.environ.get('CAP_RINGS', '1'))):
        vertices = {i for p in faces for i in p.vertices}
        selected = {p.index for p in faces}
        faces += [p for p in mesh.polygons if p.index not in selected
                  and sum(i in vertices for i in p.vertices) >= 2
                  and not any(i in forbidden for i in p.vertices)
                  and p.center.z >= frame.hairline_z]
    altered = SimpleNamespace(**vars(frame))
    altered.faces = faces
    shells = original(basemesh, altered)
    edges = defaultdict(list)
    for face in faces:
        ids = list(face.vertices)
        for a, b in zip(ids, ids[1:] + ids[:1]):
            edges[tuple(sorted((a, b)))].append(face)
    outward = defaultdict(lambda: Vector((0, 0, 0)))
    for (a, b), owners in edges.items():
        if len(owners) != 1:
            continue
        midpoint = (mesh.vertices[a].co + mesh.vertices[b].co) * 0.5
        for i in (a, b):
            normal = mesh.vertices[i].normal
            direction = midpoint - owners[0].center
            direction -= normal * direction.dot(normal)
            if direction.length > 1e-9:
                outward[i] += direction.normalized()
    distance = float(os.environ.get('CAP_EDGE_M', '0.001'))
    for shell in shells:
        for i, direction in outward.items():
            if direction.length > 1e-9:
                shell['points'][i] += direction.normalized() * distance
    print('CAP EDGE', len(frame.faces), '->', len(faces), 'faces;', len(outward),
          'boundary vertices per shell;', distance * 1000, 'mm tangential expansion')
    return shells

hair_cards.build_scalp_cap = candidate
runpy.run_path(str(pipeline / 'build_figure.py'), run_name='__main__')
