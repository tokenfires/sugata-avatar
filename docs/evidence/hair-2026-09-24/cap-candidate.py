"""Unqualified scalp-cap experiment from September 24, 2026.

Run only with separate --output and --hair-dir paths under tmp/. CAP_RINGS=1
extends one adjacent face ring; 2 adds geometry without further closing the
measured ear gap. Neither candidate is promoted. See PROGRESS-2026-09-24.md.
"""
import json, os, runpy, sys
from types import SimpleNamespace
from pathlib import Path
pipeline = Path(__file__).resolve().parents[3] / 'tools' / 'figure-pipeline'
sys.path.insert(0, str(pipeline))
import hair_cards
original = hair_cards.build_scalp_cap

def candidate(basemesh, frame):
    mesh = basemesh.data
    ear = basemesh.vertex_groups.get(hair_cards.EAR_VERTEX_GROUP)
    forbidden = hair_cards.face_moved_vertices(basemesh) | {v.index for v in mesh.vertices if ear and any(g.group == ear.index for g in v.groups)}
    faces = list(frame.faces)
    for _ in range(int(os.environ.get('CAP_RINGS', '1'))):
        vertices = {i for p in faces for i in p.vertices}
        selected = {p.index for p in faces}
        faces += [p for p in mesh.polygons if p.index not in selected
                  and sum(i in vertices for i in p.vertices) >= 2
                  and not any(i in forbidden for i in p.vertices)
                  and p.center.z >= frame.hairline_z]
    print('CAP CANDIDATE', len(frame.faces), '->', len(faces), 'faces')
    altered = SimpleNamespace(**vars(frame))
    altered.faces = faces
    return original(basemesh, altered)

hair_cards.build_scalp_cap = candidate
runpy.run_path(str(pipeline / 'build_figure.py'), run_name='__main__')
