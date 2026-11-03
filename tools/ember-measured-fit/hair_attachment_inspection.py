"""One read-only source census for the original Ember hair plan; no geometry output."""
import hashlib
import json
from pathlib import Path
import resource
import struct
import time

resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
started = time.process_time()
root = Path(__file__).resolve().parents[2]
out = root / 'docs/evidence/ember-2026-10-31-hair-authoring-plan'
out.mkdir(exist_ok=True)
source_path = root / 'docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb'
assert source_path.stat().st_size < 16 * 1024 * 1024
raw = source_path.read_bytes()
n = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+n])
data = memoryview(raw)[28+n:]

def accessor(i):
    a = doc['accessors'][i]
    v = doc['bufferViews'][a['bufferView']]
    arity = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    typ = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
    fmt = '<' + typ * arity
    size = struct.calcsize(fmt)
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', size)
    assert not a.get('sparse') and not a.get('normalized') and a['count'] < 100000
    return [struct.unpack_from(fmt, data, offset+k*stride) for k in range(a['count'])]

primitive = doc['meshes'][0]['primitives'][0]
source = accessor(primitive['attributes']['POSITION'])
joints = accessor(primitive['attributes']['JOINTS_0'])
weights = accessor(primitive['attributes']['WEIGHTS_0'])
flat = [x[0] for x in accessor(primitive['indices'])]
head_node = next(i for i, x in enumerate(doc['nodes']) if x.get('name') == 'head')
head_joint = doc['skins'][0]['joints'].index(head_node)
patch = root / 'docs/evidence/ember-2026-10-31-local-feature-v001/positions.f32'
positions = list(struct.iter_unpack('<fff', patch.read_bytes()))
assert len(positions) == len(source) == 14517
head_weights = [sum(w for j, w in zip(js, ws) if j == head_joint) for js, ws in zip(joints, weights)]

def bounds(ids):
    return {'count': len(ids), 'min': [min(positions[i][k] for i in ids) for k in range(3)],
            'max': [max(positions[i][k] for i in ids) for k in range(3)]} if ids else {'count': 0}

head = [i for i, w in enumerate(head_weights) if w >= .999]
crown = [i for i in head if positions[i][1] >= 1.51]
crown_set = set(crown)
scalp_triangles = sum(all(i in crown_set for i in flat[k:k+3]) for k in range(0, len(flat), 3))
shoulder = [i for i, p in enumerate(positions) if 1.27 <= p[1] <= 1.38 and .065 <= abs(p[0]) <= .23]
files = ['packages/testbed/src/ember-local-feature-v001.js', 'packages/testbed/src/ember-ocular-v003-material.js',
         'packages/core/src/material/HairMaterial.js', 'packages/core/src/figure/Skeleton.js',
         'tools/figure-pipeline/hair_texture.py', 'reference/ember/portraits/face-reference-1.png']
files += ['assets/hair/bob01/' + name + '.png' for name in ['albedo', 'normal', 'flow', 'depth']]
manifest = {str(p.relative_to(root)): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in [root/f for f in files] + [source_path, patch]}
textures = {name: {'dimensions': struct.unpack('>II', (root/'assets/hair/bob01'/name).read_bytes()[16:24])}
            for name in ['albedo.png', 'normal.png', 'flow.png', 'depth.png']}
parents = {child: i for i, node in enumerate(doc['nodes']) for child in node.get('children', [])}
chain, node = [], head_node
while True:
    value = doc['nodes'][node]
    chain.append({'node': node, **{k: value[k] for k in ['name', 'matrix', 'translation', 'rotation', 'scale'] if k in value}})
    if node not in parents:
        break
    node = parents[node]
report = {
    'purpose': 'Read-only attachment and texture census, not a groom build or root selection',
    'preflight': {'cpuSeconds': 15, 'rssCeilingBytes': 512*1024*1024, 'reportBytes': 2*1024*1024,
                  'memoryEnforcement': 'bounded inputs plus observed RSS; RLIMIT_AS unavailable on this host',
                  'priorAttempt': 'RLIMIT_AS rejected before any source read/output; corrected preflight only'},
    'bodyVertexCount': len(positions), 'bodyTriangleCount': len(flat)//3,
    'headJointIndex': head_joint, 'headNode': head_node, 'headAncestorChain': chain,
    'meshNode': {k: doc['nodes'][53][k] for k in ['name', 'matrix', 'translation', 'rotation', 'scale', 'skin'] if k in doc['nodes'][53]},
    'allBody': bounds(list(range(len(positions)))), 'fullyHeadWeighted': bounds(head),
    'upperHead_yGe1_51': bounds(crown), 'upperHeadTriangles': scalp_triangles,
    'upperHeadPatchMaxDeltaM': max(sum((positions[i][k]-source[i][k])**2 for k in range(3))**.5 for i in crown),
    'shoulderBandNotAnatomicalSegmentation': bounds(shoulder), 'textures': textures, 'manifest': manifest,
    'cpuSeconds': time.process_time()-started, 'maxRssBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    'limitsOfInference': ['Not a fitted hairline or silhouette.', 'Head weights include face; roots require explicit scalp masks and normals.',
                          'Shoulder band is a bounding aid; actual posed collision tests remain necessary.']}
assert report['maxRssBytes'] < 512*1024*1024
encoded = json.dumps(report, indent=2)+'\n'
assert len(encoded) < 2*1024*1024
with (out/'source-inspection.json').open('x') as handle:
    handle.write(encoded)
print(json.dumps({k: report[k] for k in ['bodyVertexCount', 'fullyHeadWeighted', 'upperHead_yGe1_51', 'upperHeadTriangles',
    'upperHeadPatchMaxDeltaM', 'shoulderBandNotAnatomicalSegmentation', 'textures', 'cpuSeconds', 'maxRssBytes']}, indent=2))
