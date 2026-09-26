"""Read-only, independent binding/witness review. Does not rerun the count operator."""
from pathlib import Path
from fractions import Fraction as F
import gzip
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'captures/hand-attribution-2026-09-26'
CAPTURE = BASE / 'primary-v4'
HERE = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
read = lambda p: json.loads(p.read_bytes())


def bound_record(entry):
    file = (CAPTURE / entry['file']).resolve()
    assert file.is_relative_to(CAPTURE)
    raw = file.read_bytes()
    assert sha(raw) == entry['sha256']
    decoded = gzip.decompress(raw)
    assert sha(decoded) == entry['decodedSHA256']
    return json.loads(decoded)


raw_report = (CAPTURE / 'report.json').read_bytes()
report = json.loads(raw_report)
seal = read(CAPTURE / 'seal.json')
raw_manifest = (CAPTURE / 'manifest.json').read_bytes()
manifest = json.loads(raw_manifest)
assert sha(raw_report) == seal['reportSHA256']
assert sha(raw_manifest) == report['manifestSHA256'] == seal['manifestSHA256']
assert sha(raw_manifest) == 'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d'
assert report['completed'] and [r['arm'] for r in report['runs']] == ['A', 'B', 'C']
assert report['sourceHashes'] == manifest['sourceHashes']
for name, digest in manifest['sourceHashes'].items():
    assert sha((ROOT / name).read_bytes()) == digest, name

analysis_raw = (BASE / 'analysis-v4/analysis.json').read_bytes()
analysis = json.loads(analysis_raw)
assert analysis['completed'] and analysis['captureReportSHA256'] == sha(raw_report)
assert analysis['captureSealSHA256'] == sha((CAPTURE / 'seal.json').read_bytes())
assert analysis['manifestSHA256'] == sha(raw_manifest)
for name, digest in analysis['sourceHashes'].items():
    assert sha((ROOT / name).read_bytes()) == digest, name
assert sha((BASE / 'analysis-v4' / analysis['csv']['file']).read_bytes()) == analysis['csv']['sha256']

kept = {}
geometry_count = 0
for run in report['runs']:
    arm = run['arm']
    assert run['completed'] and not run['errors'] and not run.get('failure')
    disposal = run['disposal']
    assert disposal['disposed'] and not disposal['leaks']
    assert disposal['memory'] and all(v == 0 for v in disposal['memory'].values())
    assert disposal['instrument']['status'] == 'disposed'
    assert disposal['instrument']['failure'] is None and not disposal['instrument']['cleanup']['lost']
    states = bound_record(run['states'])
    assert len(states) == run['states']['count'] == 721
    assert [s['step'] for s in states] == list(range(721))
    assert all(s['instrument']['arm'] == arm and s['instrument']['status'] == 'active'
               and s['instrument']['failure'] is None for s in states)
    assert run['plannedNumericalSteps'] == manifest['planned']['numericalSteps']
    assert [g['step'] for g in run['geometry']] == manifest['planned']['numericalSteps']
    analyzed = next(r for r in analysis['runs'] if r['arm'] == arm)
    assert len(analyzed['poses']) == len(run['geometry']) == 109
    for entry, measured in zip(run['geometry'], analyzed['poses']):
        for key in ['step', 'time', 'file', 'sha256', 'decodedSHA256']:
            assert entry[key] == measured[key]
        snapshot = bound_record(entry)
        assert snapshot['capture']['step'] == entry['step']
        assert snapshot['capture']['arm'] == arm and snapshot['capture']['mode'] == 'primary'
        assert snapshot['capture']['manifestSHA256'] == sha(raw_manifest)
        assert snapshot['time'] == entry['time'] == states[entry['step']]['clock']
        if (arm, entry['step']) in [('C', 455), ('B', 637)]:
            kept[(arm, entry['step'])] = snapshot, measured
        geometry_count += 1

retained = read(HERE / 'retained-witness.json')
control = next(r for r in analysis['runs'] if r['arm'] == 'A')
for step in [0, 637, 720]:
    assert next(p['sides'] for p in control['poses'] if p['step'] == step) == next(
        p['sides'] for p in retained['poses'] if p['step'] == step)


def sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def exact_edge_hits(source, target):
    """Exact rational strict edge-through-face intersections; no epsilon/AABB kernel."""
    a, b, c = target
    u, v = sub(b, a), sub(c, a)
    n = cross(u, v)
    uu, uv, vv = dot(u, u), dot(u, v), dot(v, v)
    denominator = uu * vv - uv * uv
    assert denominator > 0
    hits = []
    for edge in range(3):
        p, q = source[edge], source[(edge + 1) % 3]
        d0, d1 = dot(n, sub(p, a)), dot(n, sub(q, a))
        if d0 * d1 >= 0:
            continue
        t = d0 / (d0 - d1)
        point = [p[i] + t * (q[i] - p[i]) for i in range(3)]
        w = sub(point, a)
        ub = (dot(w, u) * vv - dot(w, v) * uv) / denominator
        vb = (dot(w, v) * uu - dot(w, u) * uv) / denominator
        bary = [1 - ub - vb, ub, vb]
        if all(x > 0 for x in bary):
            hits.append({'edge': edge, 't': str(t), 'targetBarycentric': [str(x) for x in bary],
                         'pointRational': [str(x) for x in point], 'point': [float(x) for x in point]})
    return hits


witnesses = []
for (arm, step), (snapshot, measured) in kept.items():
    witness = measured['sides']['l']['trousers']['witnesses'][0]
    for mesh_id, face_key, ids_key, points_key in [
        ('body', 'handFace', 'handVertexIds', 'handVertices'),
        ('female_casualsuit01', 'targetFace', 'targetVertexIds', 'targetVertices')]:
        mesh = next(m for m in snapshot['meshes'] if m['id'] == mesh_id)
        face = witness[face_key]
        ids = mesh['fullIndices'][face * 3:face * 3 + 3]
        assert ids == witness[ids_key]
        assert [mesh['positions'][i * 3:i * 3 + 3] for i in ids] == witness[points_key]
        assert ids in [mesh['drawnIndices'][i:i + 3] for i in range(0, len(mesh['drawnIndices']), 3)]
    hand = [[F(x) for x in p] for p in witness['handVertices']]
    cloth = [[F(x) for x in p] for p in witness['targetVertices']]
    forward, reverse = exact_edge_hits(hand, cloth), exact_edge_hits(cloth, hand)
    hits = forward + reverse
    assert len({tuple(h['pointRational']) for h in hits}) >= 2
    length = math.dist(hits[0]['point'], hits[1]['point'])
    witnesses.append({'arm': arm, 'step': step, 'side': 'l', 'target': 'trousers',
                      'handFace': witness['handFace'], 'targetFace': witness['targetFace'],
                      'exactlyMappedToHashedDrawnSnapshotTriangles': True,
                      'handEdgeHits': forward, 'clothEdgeHits': reverse,
                      'intersectionSegmentLengthMetres': length,
                      'limit': 'Exact arithmetic on stored floating coordinates; segment length is not penetration depth or severity.'})

negative = read(BASE / 'analyzer-admission-v4/receipt.json')
assert negative['analyzerSHA256'] == analysis['sourceHashes']['docs/evidence/nonhair-2026-09-26/hand-clearance/analyze-attribution.mjs']
assert negative['sourceReportSHA256'] == sha(raw_report)
for case in negative['cases']:
    folder = BASE / 'analyzer-admission-v4' / case['case']
    assert sha((folder / 'rejection.log').read_bytes()) == case['rejectionLogSHA256']
    assert case['exitCode'] == 1 and case['outputNotCreated'] and case['expectedRejectionObserved']

receipt = {'reviewer': '/root/critic', 'primaryReportSHA256': sha(raw_report),
           'manifestSHA256': sha(raw_manifest), 'analysisSHA256': sha(analysis_raw),
           'currentSourceBindings': len(manifest['sourceHashes']), 'analysisSourceBindings': len(analysis['sourceHashes']),
           'compressedAndDecodedGeometryBindings': geometry_count, 'stateRecordsBound': 2163,
           'exactRetainedAResultSteps': [0, 637, 720], 'negativeRejectionLogsBound': len(negative['cases']),
           'witnesses': witnesses,
           'scope': 'Independent hashes/metadata/time/mapping and two rational transverse witnesses. Counts are read from the reviewed operator result; no duplicate full count or owner analysis. Native rendered review remains separate.'}
(HERE / 'native-evidence/critic-primary-verification.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: v for k, v in receipt.items() if k != 'witnesses'}, indent=2))
print('Strict rational witnesses:', [(w['arm'], w['step'], w['handFace'], w['targetFace'], w['intersectionSegmentLengthMetres']) for w in witnesses])
