"""Offline text structure; no reconstruction, masks, import or native render."""
from collections import Counter, defaultdict
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import signal
import time

root = Path(__file__).resolve().parent
def stop(signum, frame):
    raise TimeoutError('Offline inspection 10s cap')
signal.signal(signal.SIGALRM, stop)
signal.alarm(10)
start = time.monotonic()
assert dt.datetime.now(dt.timezone.utc) < dt.datetime.fromisoformat('2026-10-09T23:42:00+00:00')
vertices, faces, objects = [], [], []
for number, line in enumerate((root/'source.obj').read_text().splitlines(), 1):
    tokens = line.split()
    if not tokens or tokens[0].startswith('#'):
        continue
    if tokens[0] == 'v':
        assert len(tokens) == 4
        point = tuple(map(float, tokens[1:])); assert all(map(math.isfinite, point))
        vertices.append(point); assert len(vertices) <= 100000
    elif tokens[0] == 'f':
        ids = [int(t.split('/')[0]) for t in tokens[1:]]
        ids = [i-1 if i>0 else len(vertices)+i for i in ids]
        assert len(ids) >= 3 and len(set(ids)) == len(ids)
        assert all(0 <= i < len(vertices) for i in ids)
        faces.append(ids); assert len(faces) <= 200000
    elif tokens[0] in ('o', 'g', 'usemtl', 'mtllib'):
        objects.append({'line': number, 'declaration': line})
assert vertices and faces
edges = defaultdict(list)
adj = [set() for _ in vertices]
for face_id, face in enumerate(faces):
    for a,b in zip(face, face[1:]+face[:1]):
        edges[tuple(sorted((a,b)))].append((face_id,a,b))
        adj[a].add(b); adj[b].add(a)
def components(adjacency):
    unseen = set(range(len(adjacency))); groups=[]
    while unseen:
        pending=[min(unseen)]; group=[]; unseen.remove(pending[0])
        while pending:
            current=pending.pop(); group.append(current)
            for next_id in adjacency[current]:
                if next_id in unseen: unseen.remove(next_id); pending.append(next_id)
        groups.append(sorted(group))
    return groups
face_adj=[set() for _ in faces]
boundary=defaultdict(set)
for (a,b), owners in edges.items():
    for owner in owners:
        face_adj[owner[0]].update(o[0] for o in owners if o[0]!=owner[0])
    if len(owners)==1: boundary[a].add(b); boundary[b].add(a)
boundary_ids=sorted(boundary)
assert all(len(boundary[i])==2 for i in boundary_ids), 'Boundary branches; stop simple-loop claim'
unseen=set(boundary_ids); loops=[]
while unseen:
    first=min(unseen); previous=None; current=first; loop=[]
    while True:
        assert current in unseen
        unseen.remove(current); loop.append(current)
        choices=sorted(boundary[current]-({previous} if previous is not None else set()))
        following=choices[0]
        if following==first: break
        previous,current=current,following
    points=[vertices[i] for i in loop]
    loops.append({'obj_zero_based_ids':loop,'vertices':len(loop),
                  'bounds':[[min(p[k] for p in points),max(p[k] for p in points)] for k in range(3)],
                  'anatomical_role':'UNKNOWN; no body correspondence or pixels'})
lines=(root/'source.mhclo').read_text().splitlines()
first=lines.index('verts 0'); last=lines.index('delete_verts')
references=[]
for number,line in enumerate(lines[first+1:last], first+2):
    tokens=line.split()
    if not tokens or tokens[0].startswith('#'): continue
    assert len(tokens) in (1,9), ('Unowned reference format',number)
    ids=list(map(int,tokens[:1 if len(tokens)==1 else 3])); assert min(ids)>=0
    values=list(map(float,tokens[3:])) if len(tokens)==9 else []
    assert all(map(math.isfinite,values))
    references.append({'line':number,'body_ids':ids,'values':values})
assert len(references)==len(vertices), 'Reference/vertex cardinality mismatch'
result={'utc':dt.datetime.now(dt.timezone.utc).isoformat(), 'elapsed_seconds':time.monotonic()-start,
 'sources':{}, 'vertices':len(vertices),'faces':len(faces),'face_arities':dict(Counter(map(len,faces))),
 'edges':len(edges),'edge_incidence':dict(Counter(map(len,edges.values()))),
 'same_directed_two_owner_edges':sum(len(o)==2 and o[0][1:]==o[1][1:] for o in edges.values()),
 'vertex_component_sizes':list(map(len,components(adj))), 'edge_connected_face_component_sizes':list(map(len,components(face_adj))),
 'unused_vertices':[i for i,a in enumerate(adj) if not a],
 'euler_polygon_census':len(vertices)-len(edges)+len(faces),
 'bounds':[[min(p[k] for p in vertices),max(p[k] for p in vertices)] for k in range(3)],
 'boundary_loops':loops,'obj_declarations':objects,
 'mhclo_header':lines[:first+1], 'reference_rows':len(references),
 'reference_row_arities':dict(Counter(len(r['body_ids']) for r in references)),
 'body_index_range':[min(i for r in references for i in r['body_ids']),max(i for r in references for i in r['body_ids'])],
 'negative_weight_rows':[r['line'] for r in references if r['values'] and min(r['values'][:3])<0],
 'mask_declaration_line':last+1, 'mask_applied':False,
 'decision':'CONNECTED SOURCE AND DECLARED hm08 REFERENCE MECHANISM ONLY; sleeve/body/design/inner/rig ownership HOLD',
 'limits':'Source row syntax/cardinality only; exact base topology/coordinate transform, anatomical boundaries, physical embedding/fit/coverage/occupancy/pose and appearance UNKNOWN. No reconstruction or mask application.'}
for name in ['source.obj','source.mhclo']:
    b=(root/name).read_bytes(); result['sources'][name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
assert result['elapsed_seconds'] < 10
assert dt.datetime.now(dt.timezone.utc) < dt.datetime.fromisoformat('2026-10-09T23:42:00+00:00')
with (root/'STRUCTURE.json').open('x') as out: json.dump(result,out,indent=2);out.write('\n')
signal.alarm(0)
print(json.dumps({k:result[k] for k in ['vertices','faces','edges','edge_incidence','edge_connected_face_component_sizes','reference_rows','decision']}))
