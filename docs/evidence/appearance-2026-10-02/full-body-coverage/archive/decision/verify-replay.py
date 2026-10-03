"""Independent retained-byte and Gram-Schmidt/matrix projection audit; no rendering."""
import datetime
import gzip
import hashlib
import json
import os
from pathlib import Path
import platform
import struct
import sys
import numpy as np

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
out = Path('captures/full-body-coverage-2026-10-02-v1')
old = Path('captures/skeleton-full-influences-gpu-2026-09-30-v2')
sha = lambda b: hashlib.sha256(b).hexdigest()
digest = lambda p: sha(Path(p).read_bytes())
report = json.loads((out / 'report.json').read_text())
assert digest(out / 'report.json') == '2f378f0772b1b6750f280d15b1e67fbdeb527669e4dadbc9d749f65e6dd92f75'
assert report['status'] == 'observed' and report['errors'] == [] and report['computeRuns'] == 0
assert report['finalInputHashesUnchanged'] and report['borrowedReviewServerRetained']
assert datetime.datetime.fromisoformat(report['finished'].replace('Z', '+00:00')) < datetime.datetime.fromisoformat(report['hardStop'].replace('Z', '+00:00'))
pins = {}
for p, expected in report['inputs'].items():
    snapshot = out / 'sources' / p
    pins[p] = {'live': digest(p), 'snapshot': digest(snapshot) if snapshot.exists() else None, 'expected': expected}
    assert pins[p]['live'] == expected
    if snapshot.exists():
        assert pins[p]['snapshot'] == expected
previous = json.loads((old / 'report.json').read_text())
prepared = json.loads((old / 'inputs.json').read_text())
retained_bytes = gzip.decompress((old / '1-coupled.json.gz').read_bytes())
assert sha(retained_bytes) == '7c84a5b1703ba406ca2ac524dbb0982dcefebf202f86897d7cf1258f367aee13'
retained = json.loads(retained_bytes)
case = next(c for c in prepared['cases'] if c['name'] == '1-coupled')
row = next(c for c in previous['cases'] if c['name'] == '1-coupled')
assert previous['passed'] and row['passed'] and row['interpretable'] and not row['negative']
assert report['retained']['previousVersusNative'] == row['versusNative']
assert case['weight'] == 1 and case['pose'] == 'coupled' and retained['observed']['name'] == '1-coupled'
native = np.array(case['expected'], dtype='<f4').astype(float).reshape(-1, 3)
gpu = np.array(retained['observed']['positions'], dtype=float).reshape(-1, 3)
assert native.shape == gpu.shape == (14517, 3)
assert np.isfinite(native).all() and np.isfinite(gpu).all()
assert np.array_equal(gpu, gpu.astype('<f4').astype(float))
assert sha(native.astype('<f4').tobytes()) == report['retained']['nativeFloat32Sha256']
assert sha(gpu.astype('<f4').tobytes()) == report['retained']['gpuFloat32Sha256']
new = json.loads((out / 'inputs.json').read_text())
assert digest(out / 'inputs.json') == report['prepared']['sha256']
assert new['vertexCount'] == 14517 and new['indices'] == prepared['indices'] and len(new['indices']) == 26756 * 3
assert np.array_equal(native.ravel(), new['native']) and np.array_equal(gpu.ravel(), new['gpu'])

# Gram-Schmidt projection of world-up onto the normal plane supplies the camera
# up axis, followed by its orthogonal right axis. Does not use Three lookAt or
# the observer's helper functions. Reconstruct all matrices from the plan.
z = np.array([-2.4, .56, 4.0]); z /= np.linalg.norm(z)
y = np.array([0., 1., 0.]) - z * z[1]; y /= np.linalg.norm(y)
x = np.cross(y, z); x /= np.linalg.norm(x)
basis = np.array([x, y, z])
projected = native @ basis.T
lo, hi = projected.min(axis=0), projected.max(axis=0)
mid = (lo + hi) / 2
target = basis.T @ mid
camera_position = target + 5 * z
half = max((hi[1] - lo[1]) / 2, (hi[0] - lo[0]) / (2 * 1.2)) / .70
derivation = report['cameraDerivation']
assert derivation == new['camera']
assert np.allclose(basis, derivation['basis'], atol=1e-14, rtol=0)
assert np.allclose(np.column_stack((lo, hi)), derivation['bounds'], atol=1e-14, rtol=0)
assert np.allclose(target, derivation['target'], atol=1e-14, rtol=0)
assert np.allclose(camera_position, derivation['position'], atol=1e-14, rtol=0)
assert abs(half - derivation['halfSpan']) < 1e-14 and derivation['derivedFrom'] == 'native-float32-only'
view_matrix = np.eye(4); view_matrix[:3, :3] = basis; view_matrix[:3, 3] = -(basis @ camera_position)
world_matrix = np.eye(4); world_matrix[:3, :3] = basis.T; world_matrix[:3, 3] = camera_position
near, far = .01, 20.
projection_matrix = np.array([[1/(half*1.2), 0, 0, 0], [0, 1/half, 0, 0], [0, 0, -1/(far-near), -near/(far-near)], [0, 0, 0, 1.]])
assert report['views'][0]['common'] == report['views'][1]['common']
common = report['views'][0]['common']
assert common['coordinateSystem'] == 2001 and not common['reversedDepth']
assert common['backend'] == 'webgpu' and common['three'] == '185'
assert common['replay'] and common['computeRuns'] == 0 and common['viewport'] == [1200, 1000] and common['pixelRatio'] == 1
assert common['material'] == {'color': 0xb9b9b9, 'roughness': .7, 'metalness': 0}
assert common['lights'] == [{'type': 'hemisphere', 'sky': 0xffffff, 'ground': 0x4c5060, 'intensity': 2}, {'type': 'directional', 'color': 0xffffff, 'position': [-3, 4, 4], 'intensity': 3}, {'type': 'directional', 'color': 0xd3e1ff, 'position': [3, 1, -2], 'intensity': 1}]
assert common['colorSpace'] == 'srgb' and common['toneMapping'] == 4 and common['exposure'] == 1 and common['clearColor'] == 0x24282d
assert common['normals'] == 'recomputed-from-each-retained-surface' and common['triangles'] == 26756
matrix_errors = {}
for name, actual, expected in [('view', common['viewMatrix'], view_matrix), ('projection', common['projectionMatrix'], projection_matrix), ('cameraWorld', common['camera']['object']['matrix'], world_matrix)]:
    error = np.max(abs(np.array(actual).reshape(4, 4, order='F') - expected)).item()
    assert error < 1e-14
    matrix_errors[name] = error

artifacts = {}
for a in report['artifacts']:
    compressed = (out / a['file']).read_bytes()
    decoded = gzip.decompress(compressed)
    assert len(compressed) == a['bytes'] and sha(compressed) == a['sha256'] and sha(decoded) == a['decodedSHA256']
    artifacts[a['file']] = {'compressedSHA256': sha(compressed), 'decodedSHA256': sha(decoded)}
assert gzip.decompress((out / 'inputs.json.gz').read_bytes()) == (out / 'inputs.json').read_bytes()
observations, screenshots = [], {}
for v, points in zip(report['views'], (native, gpu)):
    homogeneous = np.column_stack((points, np.ones(len(points))))
    clip = homogeneous @ view_matrix.T @ projection_matrix.T
    ndc = clip[:, :3] / clip[:, 3:4]
    pixels = np.column_stack(((ndc[:, 0] + 1) * 600, (1 - ndc[:, 1]) * 500, ndc[:, 2]))
    stored = np.array(json.loads(gzip.decompress((out / v['projections']['file']).read_bytes())))
    assert stored.shape == (14517, 3)
    error = np.max(abs(stored - pixels), axis=0)
    assert error[0] < 1e-9 and error[1] < 1e-9 and error[2] < 1e-12
    assert np.all(pixels[:, 0] >= 180 - .001) and np.all(pixels[:, 0] <= 1020 + .001)
    assert np.all(pixels[:, 1] >= 150 - .001) and np.all(pixels[:, 1] <= 850 + .001)
    assert np.all(pixels[:, 2] >= 0) and np.all(pixels[:, 2] <= 1)
    extrema = np.column_stack((pixels.min(axis=0), pixels.max(axis=0)))
    assert np.allclose(extrema, v['extrema'], atol=1e-9, rtol=0)
    assert v['labelRect']['bottom'] <= 94 and v['labelRect']['x'] + v['labelRect']['width'] <= 1200
    path = out / v['file']; raw = path.read_bytes()
    assert digest(path) == v['sha256'] and raw[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', raw[16:24]) == (1200, 1000)
    screenshots[str(path)] = {'sha256': digest(path), 'dimensions': [1200, 1000]}
    observations.append({'arm': v['arm'], 'vertices': len(points), 'maximumProjectionError': error.tolist(), 'extrema': extrema.tolist()})
assert [v['arm'] for v in report['views']] == ['native', 'gpu']
assert report['views'][0]['positionNode'] == 'geometry-attribute' and report['views'][1]['positionNode'] == 'retained-observed-storage'
assert report['views'][1]['uploaded'] == {'stride': 4, 'vertices': 14517, 'exactFloat32XYZAndW': True}
assert report['cleanup'] == {'gpu': {'disposed': True, 'privateStorageAttributesReleased': 1, 'errors': []}, 'page': 'closed', 'browser': 'closed', 'server': 'closed'}
result = {'status': 'independent retained replay verification passed', 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/appearance-2026-10-02/full-body-coverage/verify-replay.py', 'interpreter': sys.executable, 'pythonVersion': platform.python_version(), 'numpyVersion': np.__version__, 'reportSHA256': digest(out / 'report.json'), 'verifierSHA256': digest(__file__), 'inputPins': pins, 'snapshotsChecked': sum(p['snapshot'] is not None for p in pins.values()), 'artifacts': artifacts, 'screenshots': screenshots, 'camera': {'halfSpan': float(half), 'target': target.tolist(), 'position': camera_position.tolist(), 'matrixMaximumErrors': matrix_errors}, 'observations': observations, 'projectedVertices': 29034, 'limits': ['Read-only independent retained-byte and camera/matrix/projection audit; no new render, compute or network job.', 'Actual GPU storage equality is supported by the pinned in-page readback comparison and its successful receipt, not a separately retained new raw GPU-readback array.', 'Two static images at context scale do not qualify production normals/history/queries, movement, other poses or clothed avatar.']}
print(json.dumps(result, indent=2))
