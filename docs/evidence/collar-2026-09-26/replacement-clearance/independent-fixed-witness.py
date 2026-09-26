"""Read-only exact-rational intersection proof for four recorded immutable cloth faces.

No Three geometry predicates, clearance operator, solver, asset writes or GPU are used.
The saved Float32 coordinates are exact dyadic rationals in this calculation.
"""
import gzip
import hashlib
import json
import math
import pathlib
import struct
from fractions import Fraction as F

ROOT = pathlib.Path(__file__).resolve().parents[4]
HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'independent-fixed-witness.json'
INVENTORY = ROOT / 'captures/collar-replacement-2026-09-26/clearance-inventory-v1/expressive-vest-interior-98'
CAPTURE = ROOT / 'captures/collar-replacement-2026-09-26/capture-v2'
CASE = 'bob02-expressive-foundation_vest-frozen-interior'
OUTER = ROOT / 'captures/collar-stress-2026-09-22/gpu-v1/assets/collar-interior.glb'
VEST = ROOT / 'assets/wardrobe/foundation_vest/g050.glb'
SUPPORT = ROOT / 'docs/evidence/collar-2026-09-26/support.json'
EXPECTED = {
    OUTER: 'd81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a',
    VEST: '4804bd9e11c7aafacc19ca9fa3ded25fbbd2c4d72c25a17d566087ee09ba6152',
    SUPPORT: 'fc84784680066aaa5997e41eac3a60ea06ec542d68a4e7cd004ccd665267c9b8',
}
sha = lambda b: hashlib.sha256(b).hexdigest()
for file, digest in EXPECTED.items():
    assert sha(file.read_bytes()) == digest, file


def glb_primitive(file, name):
    raw = file.read_bytes()
    magic, version, size = struct.unpack_from('<III', raw)
    assert magic == 0x46546c67 and version == 2 and size == len(raw)
    chunks = {}
    cursor = 12
    while cursor < len(raw):
        length, kind = struct.unpack_from('<II', raw, cursor)
        chunks[kind] = raw[cursor + 8:cursor + 8 + length]
        cursor += 8 + length
    document = json.loads(chunks[0x4e4f534a])
    binary = chunks[0x004e4942]
    primitive = next(m for m in document['meshes'] if m['name'] == name)['primitives'][0]

    def accessor(index):
        a = document['accessors'][index]
        assert 'sparse' not in a
        view = document['bufferViews'][a['bufferView']]
        fmt = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
        count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        width = struct.calcsize('<' + fmt * count)
        start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = view.get('byteStride', width)
        return [x for i in range(a['count']) for x in struct.unpack_from('<' + fmt * count, binary, start + i * stride)]

    return accessor(primitive['indices']), {name: accessor(i) for name, i in primitive['attributes'].items()}


packed = (INVENTORY / 'inventory.json.gz').read_bytes()
inventory = json.loads(gzip.decompress(packed))
record_bytes = gzip.decompress((INVENTORY / 'capture-record.json.gz').read_bytes())
assert sha(record_bytes) == inventory['capture']['reportSha256']
record = json.loads(record_bytes)
assert sha((CAPTURE / 'manifest.json').read_bytes()) == record['manifestSHA256']
run = next(r for r in record['runs'] if r['name'] == CASE)
assert run['completed'] and not run['errors']
assert run['asset']['sha256'] == EXPECTED[OUTER]
assert any(r['sha256'] == EXPECTED[OUTER] for r in run['loadedAssets'])
assert any(r['id'] == 'foundation_vest' and r['sha256'] == EXPECTED[VEST] for r in run['loadedFoundations'])
for entry in record['sourceFreeze']:
    assert sha((CAPTURE / entry['file']).read_bytes()) == entry['sha256']
entry = next(x for x in run['geometry'] if x['step'] == 98)
snapshot_bytes = (CAPTURE / entry['file']).read_bytes()
decoded = gzip.decompress(snapshot_bytes)
assert sha(snapshot_bytes) == entry['sha256'] == inventory['snapshot']['sha256']
assert sha(decoded) == entry['decodedSHA256'] == inventory['snapshot']['decodedSHA256']
snapshot = json.loads(decoded)
assert snapshot['capture']['asset'] == run['asset']
assert snapshot['capture']['foundation'] == 'foundation_vest'
assert snapshot['capture']['hair'] == 'bob02' and snapshot['capture']['sequence'] == 'expressive'
assert snapshot['capture']['step'] == 98 and snapshot['capture']['manifestSHA256'] == record['manifestSHA256']
outer = next(m for m in snapshot['meshes'] if m['id'] == 'female_casualsuit01')
vest = next(m for m in snapshot['meshes'] if m['id'] == 'foundation_vest')
outer_indices, _ = glb_primitive(OUTER, 'female_casualsuit01')
vest_indices, vest_attributes = glb_primitive(VEST, 'foundation_vest')
assert outer['fullIndices'] == outer_indices and vest['fullIndices'] == vest_indices
mask = vest_attributes['_UNDER_FEMALE_CASUALSUIT01']
retained_ids = [t for t in range(len(vest_indices) // 3) if all(mask[i] <= .5 for i in vest_indices[t * 3:t * 3 + 3])]
assert vest['drawnIndices'] == [i for t in retained_ids for i in vest_indices[t * 3:t * 3 + 3]]
assert len(retained_ids) == 1411
support = json.loads(SUPPORT.read_text())['support']
assert len(support['movingGroups']) == 34 and len(support['movingVertices']) == 43
moving = set(support['movingVertices'])
rear = set(support['rearGuard']['vertices'])

add = lambda a, b: tuple(x + y for x, y in zip(a, b))
sub = lambda a, b: tuple(x - y for x, y in zip(a, b))
scale = lambda a, s: tuple(x * s for x in a)
dot = lambda a, b: sum(x * y for x, y in zip(a, b))
cross = lambda a, b: (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def triangle(mesh, source_id):
    ids = mesh['fullIndices'][source_id * 3:source_id * 3 + 3]
    return ids, [tuple(F(x) for x in mesh['positions'][i * 3:i * 3 + 3]) for i in ids]


def barycentric(point, tri):
    e, f, p = sub(tri[1], tri[0]), sub(tri[2], tri[0]), sub(point, tri[0])
    ee, ef, ff, pe, pf = dot(e, e), dot(e, f), dot(f, f), dot(p, e), dot(p, f)
    denominator = ee * ff - ef * ef
    assert denominator > 0
    v, w = (ff * pe - ef * pf) / denominator, (ee * pf - ef * pe) / denominator
    return 1 - v - w, v, w


def edge_plane_hits(edges, face):
    n = cross(sub(face[1], face[0]), sub(face[2], face[0]))
    hits = []
    for index in range(3):
        a, b = edges[index], edges[(index + 1) % 3]
        da, db = dot(n, sub(a, face[0])), dot(n, sub(b, face[0]))
        if da == db:
            continue
        t = da / (da - db)
        if not 0 <= t <= 1:
            continue
        p = add(a, scale(sub(b, a), t))
        assert dot(n, sub(p, face[0])) == 0
        if all(weight >= 0 for weight in barycentric(p, face)):
            hits.append(p)
    return hits


rows = []
for cloth_id, vest_id in [(1503, 18271), (1515, 6120), (1516, 19672), (1517, 26194)]:
    ci, a = triangle(outer, cloth_id)
    vi, b = triangle(vest, vest_id)
    assert vest_id in retained_ids
    assert not moving.intersection(ci)
    recorded = next(w for w in inventory['witnesses'] if w['teeTriangle'] == cloth_id and w['targetOriginalTriangle'] == vest_id)
    assert [[float(x) for x in p] for p in a] == recorded['teeWorld']
    assert [[float(x) for x in p] for p in b] == recorded['targetWorld']
    assert recorded['minimum']['targetTriangle'] == retained_ids.index(vest_id)
    na, nb = cross(sub(a[1], a[0]), sub(a[2], a[0])), cross(sub(b[1], b[0]), sub(b[2], b[0]))
    assert any(cross(na, nb)), 'not a transverse pair'
    points = list(dict.fromkeys(edge_plane_hits(a, b) + edge_plane_hits(b, a)))
    assert len(points) == 2 and points[0] != points[1]
    midpoint = scale(add(*points), F(1, 2))
    ba, bb = barycentric(midpoint, a), barycentric(midpoint, b)
    assert all(x > 0 for x in ba + bb), 'intersection must enter both triangle interiors'
    row = {
        'clothSourceTriangle': cloth_id, 'clothVertices': ci,
        'vestSourceTriangle': vest_id, 'vestVertices': vi, 'vestRetainedIndex': retained_ids.index(vest_id),
        'allClothVerticesImmutable': True, 'rearGuardVertices': sorted(rear.intersection(ci)),
        'transverseAndStrictInterior': True,
        'intersectionSegmentLengthMetres': math.dist(*[[float(x) for x in p] for p in points]),
        'segmentEndpointsExactRational': [[str(x) for x in p] for p in points],
        'midpointWorld': [float(x) for x in midpoint],
        'midpointClothBarycentric': [float(x) for x in ba],
        'midpointVestBarycentric': [float(x) for x in bb],
    }
    rows.append(row)

images = []
for step in [96, 99]:
    item = next(x for x in run['images'] if x['step'] == step)
    assert sha((CAPTURE / item['file']).read_bytes()) == item['sha256']
    images.append(item)
result = {
    'reviewer': '/root/critic', 'method': 'Exact Fraction edge-plane intersections and Gram barycentrics on saved Float32 positions; no epsilon or reused triangle predicate',
    'scriptSha256': sha(pathlib.Path(__file__).read_bytes()),
    'sourceHashes': {str(p.relative_to(ROOT)): h for p, h in EXPECTED.items()},
    'snapshot': {'file': entry['file'], 'sha256': entry['sha256'], 'decodedSHA256': entry['decodedSHA256']},
    'immutableCaptureRecordSha256': sha(record_bytes), 'verifiedFrozenCaptureSources': len(record['sourceFreeze']),
    'wholeCaptureCompleteAtInventory': record['completed'], 'selectedRunComplete': run['completed'],
    'retainedVestTriangles': len(retained_ids), 'rows': rows, 'ordinaryImageWitnesses': images,
    'conclusion': 'Four transverse crossings cannot be removed by the permitted34groups because all vertices of each crossing cloth triangle are fixed. Joint bra-plus-vest clearance is infeasible under this fixed support and unchanged target pose. A bra-only problem is not decided.',
    'limits': ['Exact geometry is the saved CPU-skinned Float32 snapshot, not GPU deformed coordinates or continuous motion.', 'No asset solve, export, changed support, or promotion.'],
}
with OUT.open('x') as f:
    json.dump(result, f, indent=2)
    f.write('\n')
print(json.dumps({'output': str(OUT.relative_to(ROOT)), 'rows': [{k: v for k, v in row.items() if k != 'segmentEndpointsExactRational'} for row in rows]}, indent=2))
