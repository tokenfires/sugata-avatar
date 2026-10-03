"""One read-only source topology ledger, not a source edit or transfer/fit qualification."""
from pathlib import Path
from datetime import datetime, timezone
import json
import hashlib
import os
import struct

root = Path(__file__).resolve().parents[4]
packet = Path(__file__).resolve().parent
control = packet.parent / 'capsule-source/inputs/male_casualsuit02'
started = datetime.now(timezone.utc).isoformat()
assert started < '2026-10-03T14:20:00'
sha = lambda b: hashlib.sha256(b).hexdigest()
inputs = []
def read(p):
    b = p.read_bytes(); inputs.append(dict(path=str(p.relative_to(root)), bytes=len(b), sha256=sha(b))); return b
obj = read(control / 'male_casualsuit02.obj')
mhclo = read(control / 'male_casualsuit02.mhclo')
assert sha(obj) == 'e07cbd1a43d21bd700e6598f01f74341a9dd66eac4e035c8be8de2650eac380f'
assert sha(mhclo) == 'f9e6821704a1508a02d5e416b2360785b705cfe5a130c359021a4b4570dcc43a'
vertices = []; faces = []; faceLines = []
for lineNumber, line in enumerate(obj.decode().splitlines(), 1):
    if line.startswith('v '): vertices.append([float(x) for x in line.split()[1:]])
    if line.startswith('f '):
        ids = [int(x.split('/')[0]) for x in line.split()[1:]]
        assert all(x > 0 for x in ids), 'Negative or nonpositive index needs a different explicit parser.'
        faces.append([x - 1 for x in ids]); faceLines.append(lineNumber)
assert len(vertices) == 2136 and len(faces) == 2060
assert all(len(p) == 3 for p in vertices)
parent = list(range(len(vertices)))
def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]; i = parent[i]
    return i
for face in faces:
    assert len(face) >= 3 and all(0 <= i < len(vertices) for i in face)
    for i in face[1:]: parent[find(i)] = find(face[0])
used = {i for f in faces for i in f}; assert used == set(range(len(vertices)))
groups = {}
for i in range(len(vertices)): groups.setdefault(find(i), []).append(i)
components = []
for ids in sorted(groups.values(), key=lambda a: min(a)):
    owned = set(ids); fids = [i for i, f in enumerate(faces) if f[0] in owned]
    assert all(set(faces[i]) <= owned for i in fids)
    components.append(dict(component=len(components), role='unassigned; connectivity is not semantic garment ownership',
        originalVertexIds=ids, originalFaceIds=fids, originalOBJFaceLines=[faceLines[i] for i in fids],
        vertices=len(ids), faces=len(fids),
        sourceBounds=dict(min=[min(vertices[i][axis] for i in ids) for axis in range(3)],
                          max=[max(vertices[i][axis] for i in ids) for axis in range(3)])))
rows = []; inside = False; start = None
for lineNumber, line in enumerate(mhclo.decode().splitlines(), 1):
    if line == 'verts 0': inside = True; start = lineNumber; continue
    if inside:
        if not line or line.startswith('#'): continue
        fields = line.split()
        if fields[0] in ('delete_verts', 'weights'): break
        assert len(fields) in (1, 9), f'Unspecified fitting row syntax at {lineNumber}'
        ids = [int(x) for x in fields[:(1 if len(fields) == 1 else 3)]]
        assert all(0 <= i < 19158 for i in ids)
        rows.append(dict(sourceGarmentVertexId=len(rows), sourceLine=lineNumber, sourceReferenceIds=ids,
                         rawFields=fields, limit='Source-domain record only; no interpreted g050 or skin transform.'))
assert len(rows) == len(vertices)
body = read(root / 'assets/wardrobe/body/g050.glb')
assert body[:4] == b'glTF' and struct.unpack('<II', body[4:12]) == (2, len(body))
jsonLength, chunkType = struct.unpack('<II', body[12:20]); assert chunkType == 0x4e4f534a
glb = json.loads(body[20:20 + jsonLength])
bodyPrimitives = []
for mesh in glb['meshes']:
    if mesh.get('name') == 'body':
        for primitive in mesh['primitives']:
            accessor = primitive['attributes']['POSITION']
            bodyPrimitives.append(dict(mesh=mesh.get('name'), positionAccessor=accessor, attributeVertices=glb['accessors'][accessor]['count']))
assert bodyPrimitives, 'No explicitly named body mesh; stop rather than guess.'
result = dict(status='recorded', pid=os.getpid(), started=started, finished=datetime.now(timezone.utc).isoformat(),
    command='python3 docs/evidence/nonhair-2026-10-03/capsule-method/source-ownership.py',
    sourceSHA256=sha(Path(__file__).read_bytes()), inputs=inputs, vertices=len(vertices), faces=len(faces),
    components=components, rowSectionStartsAt=start, rows=rows, runtimeBodyPrimitives=bodyPrimitives,
    limits='Read-only connectivity and literal source-row/GLB-header metadata. No top ownership, modified correspondence, source-to-g050/skin transfer, geometry/contact/coverage or appearance qualification.')
assert result['finished'] < '2026-10-03T14:20:00'
with (packet / 'ownership.json').open('x') as f: json.dump(result, f, indent=2); f.write('\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('components', 'rows')}))
print(json.dumps([dict(component=c['component'],vertices=c['vertices'],faces=c['faces'],bounds=c['sourceBounds']) for c in components]))
