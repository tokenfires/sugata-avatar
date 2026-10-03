"""Read-only independent exported-byte audit. Does not import constructor or JS gates.

Run from repository root. Emits JSON to stdout; never writes candidate/assets/captures.
Uses direct GLB accessors, plane/edge nearest triangles, triangle SAT and vector ray tests.
"""
import hashlib
import json
import struct
import zlib
from pathlib import Path

import numpy as np

OUT = Path('captures/bob-local-coverage-2026-10-02-v1')
REPORT = json.loads((OUT / 'candidate-report.json').read_text())
SELECTED = [11, 23, 28, 36, 38, 44, 52]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def glb(path):
    data = Path(path).read_bytes()
    assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 8)[0] == len(data)
    offset, result = 12, {}
    while offset < len(data):
        length, kind = struct.unpack_from('<II', data, offset)
        chunk = data[offset + 8:offset + 8 + length]
        result['json' if kind == 0x4e4f534a else 'bin'] = json.loads(chunk) if kind == 0x4e4f534a else chunk
        offset += 8 + length
    return result


def accessor(asset, index):
    a = asset['json']['accessors'][index]
    assert not a.get('sparse')
    v = asset['json']['bufferViews'][a['bufferView']]
    dtype = {5120: '<i1', 5121: '<u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']]
    size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', np.dtype(dtype).itemsize * size)
    return np.ndarray((a['count'], size), dtype=dtype, buffer=asset['bin'], offset=offset,
                      strides=(stride, np.dtype(dtype).itemsize)).copy()


def mesh(asset, name):
    p = next(m for m in asset['json']['meshes'] if m['name'] == name)['primitives'][0]
    attrs = {k: accessor(asset, a) for k, a in p['attributes'].items()}
    indices = accessor(asset, p['indices']).reshape(-1, 3).astype(int)
    return p, attrs, indices


source, candidate, body_asset = glb(REPORT['input']), glb(OUT / 'candidate.glb'), glb(REPORT['bodyPath'])
sp, sa, si = mesh(source, 'hair_bob02')
cp, ca, ci = mesh(candidate, 'hair_bob02')
bp, ba, bi = mesh(body_asset, 'base.001')
spos, cpos = sa['POSITION'].astype(float), ca['POSITION'].astype(float)
bpos, bnorm = ba['POSITION'].astype(float), ba['NORMAL'].astype(float)
cards = np.where(si[:, 0] < 652, -1, (si[:, 0] - 652) // 34)
selected_indices = si[np.isin(cards, SELECTED)]
movable = np.array([652 + c * 34 + r * 2 + side for c in SELECTED for r in range(1, 17) for side in range(2)])
allowed = set(movable.tolist())

pins = {p: {'live': digest(p) == h, 'snapshot': digest(OUT / 'sources' / p) == h} for p, h in REPORT['sourceHashes'].items()}
assert all(v['live'] and v['snapshot'] for v in pins.values())
assert digest(OUT / 'candidate.glb') == REPORT['outputSha256']
assert digest(OUT / 'observations.json') == REPORT['observationsSha256']
attributes = {}
for name in sa:
    assert sa[name].shape == ca[name].shape
    changed = np.flatnonzero(np.any(sa[name] != ca[name], axis=1)).tolist()
    illegal = [v for v in changed if v not in allowed or name not in ('POSITION', 'NORMAL')]
    attributes[name] = {'changed': len(changed), 'illegal': illegal}
    assert not illegal
assert np.array_equal(si, ci)
json_exact = {key: source['json'].get(key) == candidate['json'].get(key)
              for key in ('nodes', 'skins', 'scenes', 'materials', 'textures', 'images', 'samplers')}
assert all(json_exact.values())
byte_allow = np.zeros(len(source['bin']), dtype=bool)
for name in ('POSITION', 'NORMAL'):
    a = source['json']['accessors'][sp['attributes'][name]]
    v = source['json']['bufferViews'][a['bufferView']]
    base, stride = v.get('byteOffset', 0) + a.get('byteOffset', 0), v.get('byteStride', 12)
    for vertex in movable:
        byte_allow[base + vertex * stride:base + vertex * stride + 12] = True
assert len(source['bin']) == len(candidate['bin'])
illegal_bytes = np.flatnonzero((np.frombuffer(source['bin'], dtype='u1') != np.frombuffer(candidate['bin'], dtype='u1')) & ~byte_allow)
assert not len(illegal_bytes)
assert all(np.isfinite(ca[k]).all() for k in ('POSITION', 'NORMAL'))

shapes = []
for card in SELECTED:
    start = 652 + card * 34
    before, after = spos[start:start + 34].reshape(17, 2, 3), cpos[start:start + 34].reshape(17, 2, 3)
    bw, aw = np.linalg.norm(before[:, 1] - before[:, 0], axis=1), np.linalg.norm(after[:, 1] - after[:, 0], axis=1)
    bs, cs = np.linalg.norm(np.diff(before.mean(axis=1), axis=0), axis=1), np.linalg.norm(np.diff(after.mean(axis=1), axis=0), axis=1)
    shapes.append({'card': card, 'widthErrorMm': float(np.max(abs(bw - aw)) * 1000),
                   'arcFraction': float((cs.sum() - bs.sum()) / bs.sum()),
                   'maximumSpanErrorMm': float(np.max(abs(bs - cs)) * 1000)})
    reported = next(row for row in REPORT['shape'] if row['card'] == card)
    assert abs(shapes[-1]['widthErrorMm'] - reported['maxWidthErrorMm']) < 1e-9
    assert np.allclose(bs * 1000, [s['beforeMm'] for s in reported['spanResiduals']], atol=1e-10)
    assert np.allclose(cs * 1000, [s['afterMm'] for s in reported['spanResiduals']], atol=1e-10)
    for span in next(row for row in REPORT['records'] if row['card'] == card)['spans']:
        previous = before.mean(axis=1)[0] if span['ring'] == 1 else np.array(REPORT['records'][SELECTED.index(card)]['spans'][span['ring'] - 2]['centre'])
        err = abs(np.linalg.norm(np.array(span['centre']) - previous) - bs[span['ring'] - 1]) * 1000
        assert abs(err - span['spanErrorMm']) < 1e-9 and err <= 0.002

# Freeze body-domain arithmetic independently of the stored observations.
btri = bpos[bi]
bmin, bmax = btri.min(axis=1), btri.max(axis=1)
centroids = btri.mean(axis=1)
obs_ids = np.flatnonzero((abs(centroids[:, 0]) <= .055) & (centroids[:, 1] >= 1.610) & (centroids[:, 2] >= .070))
normals = bnorm[bi[obs_ids]].sum(axis=1)
normals /= np.linalg.norm(normals, axis=1)[:, None]
obs = json.loads((OUT / 'observations.json').read_text())['observations']
assert len(obs_ids) == 108
assert obs_ids.tolist() == [o['bodyTriangle'] for o in obs]
assert np.allclose(centroids[obs_ids], [o['point'] for o in obs], rtol=0, atol=1e-15)
assert np.allclose(normals, [o['normal'] for o in obs], rtol=0, atol=1e-15)


def closest(point):
    """Global nearest mesh: AABB distance exclusion, then plane+three clamped edges.

    If the chosen point is within 10mm, all excluded triangles have a larger lower
    bound. Otherwise recalculate over every triangle. No SurfaceGrid is used.
    """
    delta = np.maximum(np.maximum(bmin - point, point - bmax), 0)
    choices = np.flatnonzero(np.sum(delta * delta, axis=1) <= .01 ** 2)
    if not len(choices):
        choices = np.arange(len(bi))
    for attempt in range(2):
        a, b, c = btri[choices, 0], btri[choices, 1], btri[choices, 2]
        ab, ac = b - a, c - a
        face = np.cross(ab, ac)
        f2 = np.sum(face * face, axis=1)
        projection = point - face * (np.sum((point - a) * face, axis=1) / f2)[:, None]
        aa, bb, cc = np.sum(ab * ab, axis=1), np.sum(ab * ac, axis=1), np.sum(ac * ac, axis=1)
        d, e = np.sum((projection - a) * ab, axis=1), np.sum((projection - a) * ac, axis=1)
        denom = aa * cc - bb * bb
        v, w = (cc * d - bb * e) / denom, (aa * e - bb * d) / denom
        bary = np.column_stack((1 - v - w, v, w))
        inside = np.all(bary >= -1e-14, axis=1)
        dist = np.sum((projection - point) ** 2, axis=1)
        dist[~inside] = np.inf
        points, barys = [projection], [bary]
        distances = [dist]
        for i, j in ((0, 1), (1, 2), (2, 0)):
            start, end = btri[choices, i], btri[choices, j]
            edge = end - start
            t = np.clip(np.sum((point - start) * edge, axis=1) / np.sum(edge * edge, axis=1), 0, 1)
            q = start + edge * t[:, None]
            weights = np.zeros((len(choices), 3)); weights[:, i], weights[:, j] = 1 - t, t
            points.append(q); barys.append(weights); distances.append(np.sum((q - point) ** 2, axis=1))
        ds = np.stack(distances)
        flat = int(np.argmin(ds)); mode, local = np.unravel_index(flat, ds.shape)
        distance = np.sqrt(ds[mode, local])
        if distance <= .01 or attempt:
            triangle = int(choices[local]); q, weights = points[mode][local], barys[mode][local]
            normal = (bnorm[bi[triangle]] * weights[:, None]).sum(axis=0)
            signed = (-1 if np.dot(point - q, normal) < 0 else 1) * distance
            return signed * 1000, triangle, q.tolist(), weights.tolist()
        choices = np.arange(len(bi))
    raise AssertionError('No closest point')


def triangle_sat(a, b, epsilon=1e-9):
    """Independent separating axes; includes in-plane axes for coplanar triangles."""
    ae, be = np.roll(a, -1, axis=0) - a, np.roll(b, -1, axis=0) - b
    an, bn = np.cross(ae[0], ae[1]), np.cross(be[0], be[1])
    axes = [an, bn] + [np.cross(x, y) for x in ae for y in be]
    axes += [np.cross(n, e) for n in (an, bn) for e in (*ae, *be)]
    for axis in axes:
        length = np.linalg.norm(axis)
        if length < 1e-18:
            continue
        pa, pb = a @ axis, b @ axis
        if pa.min() > pb.max() + epsilon * length or pb.min() > pa.max() + epsilon * length:
            return False
    return True


rest = {}
for arm, pos in (('baseline', spos), ('candidate', cpos)):
    vmin, tmin = (np.inf, None), (np.inf, None)
    for card in SELECTED:
        for ring in range(17):
            for side in range(2):
                vertex = 652 + card * 34 + ring * 2 + side
                result = closest(pos[vertex])
                if result[0] < vmin[0]:
                    vmin = (result[0], {'vertex': vertex, 'card': card, 'ring': ring, 'side': side, 'bodyTriangle': result[1]})
    for t, ids in enumerate(selected_indices):
        for i in range(5):
            for j in range(5 - i):
                bary = np.array([i / 4, j / 4, 1 - (i + j) / 4])
                point = bary @ pos[ids]
                result = closest(point)
                if result[0] < tmin[0]:
                    tmin = (result[0], {'selectedTriangle': t, 'vertices': ids.tolist(), 'bary': bary.tolist(), 'point': point.tolist(), 'bodyTriangle': result[1], 'closest': result[2], 'bodyBary': result[3]})
    crossings, broad = [], 0
    for t, ids in enumerate(selected_indices):
        tri = pos[ids]
        possible = np.flatnonzero(np.all((bmin <= tri.max(axis=0) + 1e-9) & (bmax >= tri.min(axis=0) - 1e-9), axis=1))
        broad += len(possible)
        for b in possible:
            if triangle_sat(tri, btri[b]):
                crossings.append([t, int(b)])
    rest[arm] = {'vertexMm': vmin[0], 'vertexWitness': vmin[1], 'sampleMm': tmin[0], 'triangleWitness': tmin[1], 'samples': 3360,
                 'aabbPairs': broad, 'satCrossingPairs': crossings}
    assert abs(vmin[0] - REPORT['rest'][arm]['minimumVertexMm']) < 1e-8
    assert abs(tmin[0] - REPORT['rest'][arm]['minimumSurfaceSampleMm']) < 1e-8
    assert not crossings

# Direct PNG scanline reconstruction is independent of the source JS decoder.
info = source['json']['materials'][sp['material']]['pbrMetallicRoughness']['baseColorTexture']
texture = source['json']['textures'][info['index']]
image = source['json']['images'][texture['source']]
view = source['json']['bufferViews'][image['bufferView']]
atlas_bytes = source['bin'][view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
assert atlas_bytes[:8] == b'\x89PNG\r\n\x1a\n'
offset, compressed = 8, []
while offset < len(atlas_bytes):
    length = struct.unpack_from('>I', atlas_bytes, offset)[0]
    kind = atlas_bytes[offset + 4:offset + 8]
    data = atlas_bytes[offset + 8:offset + 8 + length]
    assert zlib.crc32(kind + data) == struct.unpack_from('>I', atlas_bytes, offset + 8 + length)[0]
    if kind == b'IHDR':
        width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', data)
        assert (depth, color, compression, filtering, interlace) == (8, 6, 0, 0, 0)
    if kind == b'IDAT':
        compressed.append(data)
    offset += 12 + length
raw, stride = zlib.decompress(b''.join(compressed)), width * 4
decoded = np.zeros((height, stride), dtype=np.uint8)
for row in range(height):
    mode = raw[row * (stride + 1)]
    scan = raw[row * (stride + 1) + 1:(row + 1) * (stride + 1)]
    for i, value in enumerate(scan):
        left = int(decoded[row, i - 4]) if i >= 4 else 0
        above = int(decoded[row - 1, i]) if row else 0
        upper_left = int(decoded[row - 1, i - 4]) if row and i >= 4 else 0
        if mode == 0:
            predictor = 0
        elif mode == 1:
            predictor = left
        elif mode == 2:
            predictor = above
        elif mode == 3:
            predictor = (left + above) // 2
        elif mode == 4:
            estimate = left + above - upper_left
            differences = [abs(estimate - v) for v in (left, above, upper_left)]
            predictor = (left, above, upper_left)[differences.index(min(differences))]
        else:
            raise AssertionError('Unknown PNG filter')
        decoded[row, i] = (value + predictor) % 256
atlas = decoded.reshape(height, width, 4).astype(np.float32) / np.float32(255)
sampler = source['json'].get('samplers', [{}])[texture.get('sampler', 0)]
assert hashlib.sha256(atlas_bytes).hexdigest() == REPORT['coverage']['atlasSha256']


def wrap(value, mode):
    if mode == 33071:
        return np.clip(value, 0, 1)
    if mode == 33648:
        return 1 - abs((value % 2) - 1)
    return value % 1


def rays(pos, indices):
    tri = pos[indices]
    edges1, edges2 = tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]
    values, all_hits = [], []
    for sample, (origin, direction) in enumerate(zip(centroids[obs_ids], normals)):
        pvec = np.cross(direction, edges2)
        det = np.sum(edges1 * pvec, axis=1)
        good = abs(det) >= 1e-12
        inv = np.divide(1., det, out=np.zeros_like(det), where=good)
        tvec = origin - tri[:, 0]
        u = np.sum(tvec * pvec, axis=1) * inv
        qvec = np.cross(tvec, edges1)
        v = np.sum(direction * qvec, axis=1) * inv
        distance = np.sum(edges2 * qvec, axis=1) * inv
        hits = np.flatnonzero(good & (u >= 0) & (u <= 1) & (v >= 0) & (u + v <= 1) & (distance > 0) & (distance <= .15))
        through, receipt = 1., []
        for hit in hits:
            bary = np.array([1 - u[hit] - v[hit], u[hit], v[hit]])
            uv = bary @ sa['TEXCOORD_0'][indices[hit]].astype(float)
            x = min(atlas.shape[1] - 1, int(np.floor(wrap(uv[0], sampler.get('wrapS', 10497)) * atlas.shape[1])))
            y = min(atlas.shape[0] - 1, int(np.floor(wrap(uv[1], sampler.get('wrapT', 10497)) * atlas.shape[0])))
            alpha = float(atlas[y, x, 3])
            through *= 1 - alpha
            receipt.append({'vertices': indices[hit].tolist(), 'card': int((indices[hit, 0] - 652) // 34) if indices[hit, 0] >= 652 else -1,
                            'distanceMm': float(distance[hit] * 1000), 'uv': uv.tolist(), 'texel': [x, y], 'alpha': alpha})
            if through < 1e-4:
                break
        values.append(through); all_hits.append(receipt)
    return np.array(values), all_hits


coverage = {}
for name, indices in (('selected', selected_indices), ('cardsNoFringe', si[(cards >= 0) & (cards < 462)]), ('withCapNoFringe', si[cards < 462])):
    before, bh = rays(spos, indices); after, ah = rays(cpos, indices)
    assert np.allclose(before, REPORT['coverage'][name]['before'], atol=1e-12, rtol=0)
    assert np.allclose(after, REPORT['coverage'][name]['after'], atol=1e-12, rtol=0)
    positives = np.flatnonzero(before <= .5).tolist()
    lost = np.flatnonzero((before <= .5) & (after > .5)).tolist()
    worst = int(np.argmax(after - before))
    coverage[name] = {'positiveCount': len(positives), 'positiveIds': positives, 'lost': lost,
                      'maximumRegression': float((after - before).max()), 'worstSample': worst,
                      'witnesses': {str(i): {'bodyTriangle': int(obs_ids[i]), 'point': centroids[obs_ids[i]].tolist(),
                                           'normal': normals[i].tolist(), 'before': float(before[i]), 'after': float(after[i]),
                                           'beforeHits': bh[i], 'afterHits': ah[i]} for i in sorted(set(lost + [59, worst]))}}

print(json.dumps({'method': 'Direct GLB accessors; independent plane/edge global nearest with AABB lower-bound exclusion; separating-axis triangle crossings; vector ray tests; independent PNG scanlines/CRC and float32 base alpha. No constructor/JS gate import.',
                  'reportSha256': digest(OUT / 'candidate-report.json'), 'candidateSha256': digest(OUT / 'candidate.glb'),
                  'observationsSha256': digest(OUT / 'observations.json'), 'pins': pins, 'attributes': attributes,
                  'jsonExact': json_exact, 'indicesExact': True, 'otherBinIllegalBytes': len(illegal_bytes),
                  'shapes': shapes, 'observations': len(obs_ids), 'rest': rest, 'coverage': coverage}, indent=2))
