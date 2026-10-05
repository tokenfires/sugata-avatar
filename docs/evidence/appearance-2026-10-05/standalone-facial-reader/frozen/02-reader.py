"""Inert until a separate first-decode admission; complete original g100 packet.

Standard library only. No old producer imported. The installed CPU oracle reads
the original independently. These guards are this study's supported boundary,
not an assertion of complete glTF conformance or source/appearance acceptance.
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import sys

ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / 'assets/figures/figure_g100.glb'
SOURCE_BYTES = 11567784
SOURCE_SHA = 'c2a21d403636a81aff77969c0089c91379172c8764aabb14d1cb7de47c685811'
PER_JSON = 64 * 1024 * 1024
TOTAL_OUTPUT = 256 * 1024 * 1024
SCALARS_EACH = 2000000
SCALARS_TOTAL = 16000000
POINTS_EACH = 1000000
POINTS_TOTAL = 4000000
MATRIX_TOL = 1e-9
UNIT_TOL = 2e-6  # declared before data; diagnose, never normalize source rotation
CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
      5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
SHAPE = {'SCALAR': (1, 1), 'VEC2': (2, 1), 'VEC3': (3, 1),
         'VEC4': (4, 1), 'MAT2': (2, 2), 'MAT3': (3, 3), 'MAT4': (4, 4)}
IDENTITY = [1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.]


def demand(condition, witness):
    if not condition:
        raise ValueError(witness)


def uint(value, witness, minimum=0):
    demand(type(value) is int and value >= minimum, witness)
    return value


def index(value, items, witness):
    uint(value, witness)
    demand(value < len(items), witness)
    return value


def finite_tree(value, path='$', semantic=True):
    if isinstance(value, dict):
        for k, v in value.items():
            demand(not semantic or k != 'extensions' or not v, path + '.extensions unsupported')
            finite_tree(v, path + '.' + k, semantic and k != 'extras')
    elif isinstance(value, list):
        for i, v in enumerate(value):
            finite_tree(v, f'{path}[{i}]', semantic)
    elif type(value) is float:
        demand(math.isfinite(value), path + ' nonfinite')


def array(value, length, witness):
    demand(isinstance(value, list) and len(value) == length, witness)
    demand(all(type(x) in (int, float) and math.isfinite(x) for x in value), witness)
    return value


def sha(data):
    return hashlib.sha256(data).hexdigest()


def f32(x):
    return struct.unpack('<f', struct.pack('<f', x))[0]


def normalized(x, component):
    if component == 5120:
        return max(x / 127., -1.)
    if component == 5121:
        return x / 255.
    if component == 5122:
        return max(x / 32767., -1.)
    if component == 5123:
        return x / 65535.
    return x


def matmul(a, b):
    return [sum(a[k*4+r] * b[c*4+k] for k in range(4))
            for c in range(4) for r in range(4)]


def transform(m, p):
    return [sum(m[c*4+r] * p[c] for c in range(4)) for r in range(4)]


def xyz(m, p):
    v = transform(m, [*p, 1.])
    demand(v[3] != 0 and all(math.isfinite(x) for x in v), 'homogeneous position')
    return [x / v[3] for x in v[:3]]


def determinant(m):
    a, b, c = m[0], m[4], m[8]
    d, e, f = m[1], m[5], m[9]
    g, h, i = m[2], m[6], m[10]
    return a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g)


def inverse(m):
    det = determinant(m)
    demand(math.isfinite(det) and det != 0, 'singular source matrix')
    a, b, c, d, e, f, g, h, i = (m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10])
    rows = [[(e*i-f*h)/det, (c*h-b*i)/det, (b*f-c*e)/det],
            [(f*g-d*i)/det, (a*i-c*g)/det, (c*d-a*f)/det],
            [(d*h-e*g)/det, (b*g-a*h)/det, (a*e-b*d)/det]]
    t = [-sum(row[k]*m[12+k] for k in range(3)) for row in rows]
    return [rows[r][c] if r < 3 and c < 3 else
            t[r] if r < 3 and c == 3 else 1. if r == c == 3 else 0.
            for c in range(4) for r in range(4)]


def local_matrix(node, name):
    if 'matrix' in node:
        demand(not any(k in node for k in ('translation', 'rotation', 'scale')), name + ' matrix+TRS')
        m = list(array(node['matrix'], 16, name + '.matrix'))
    else:
        t = array(node.get('translation', [0., 0., 0.]), 3, name + '.translation')
        q = array(node.get('rotation', [0., 0., 0., 1.]), 4, name + '.rotation')
        s = array(node.get('scale', [1., 1., 1.]), 3, name + '.scale')
        demand(abs(sum(x*x for x in q) - 1.) <= UNIT_TOL, name + ' unit quaternion criterion')
        x, y, z, w = q
        m = [(1-2*(y*y+z*z))*s[0], 2*(x*y+w*z)*s[0], 2*(x*z-w*y)*s[0], 0.,
             2*(x*y-w*z)*s[1], (1-2*(x*x+z*z))*s[1], 2*(y*z+w*x)*s[1], 0.,
             2*(x*z+w*y)*s[2], 2*(y*z-w*x)*s[2], (1-2*(x*x+y*y))*s[2], 0., *t, 1.]
    demand(m[3] == m[7] == m[11] == 0 and m[15] == 1, name + ' affine row')
    cols = [[m[c*4+r] for r in range(3)] for c in range(3)]
    norms = [math.sqrt(sum(v*v for v in col)) for col in cols]
    demand(all(v > 0 for v in norms) and determinant(m) != 0, name + ' singular')
    # A literal matrix must be TRS-decomposable. TRS inputs retain original q.
    if 'matrix' in node:
        for a in range(3):
            for b in range(a):
                demand(abs(sum(cols[a][k]*cols[b][k] for k in range(3))/(norms[a]*norms[b])) <= MATRIX_TOL,
                       name + ' shear/decomposition criterion')
    demand(all(math.isfinite(v) for v in m), name + ' finite local')
    return m


class CompleteSource:
    def __init__(self):
        self.bytes = SOURCE.read_bytes()
        demand(len(self.bytes) == SOURCE_BYTES and sha(self.bytes) == SOURCE_SHA, 'original source pin')
        demand(len(self.bytes) >= 20, 'GLB header extent')
        magic, version, length = struct.unpack_from('<III', self.bytes)
        demand(magic == 0x46546c67 and version == 2 and length == len(self.bytes), 'GLB header')
        self.chunks = []
        cursor = 12
        while cursor < length:
            demand(cursor + 8 <= length, 'chunk header extent')
            size, kind = struct.unpack_from('<II', self.bytes, cursor)
            start, end = cursor+8, cursor+8+size
            demand(cursor % 4 == size % 4 == 0 and end <= length, 'aligned chunk extent')
            self.chunks.append({'type': kind, 'offset': start, 'bytes': size, 'sha256': sha(self.bytes[start:end])})
            cursor = end
        demand(cursor == length and self.chunks[0]['type'] == 0x4e4f534a, 'JSON first')
        demand(sum(c['type'] == 0x4e4f534a for c in self.chunks) == 1, 'one JSON')
        bins = [c for c in self.chunks if c['type'] == 0x004e4942]
        demand(len(bins) == 1 and self.chunks[1] is bins[0], 'self-contained BIN second')
        jc = self.chunks[0]
        self.json_bytes = self.bytes[jc['offset']:jc['offset']+jc['bytes']]
        self.doc = json.loads(self.json_bytes.decode('utf-8'),
                              parse_constant=lambda x: (_ for _ in ()).throw(ValueError('JSON nonfinite '+x)))
        demand(isinstance(self.doc, dict), 'root object')
        finite_tree(self.doc)
        asset = self.doc.get('asset', {})
        demand(asset.get('version') == '2.0' and asset.get('minVersion', '2.0') == '2.0', 'asset version/minVersion')
        demand(not self.doc.get('extensionsRequired'), 'required extensions unsupported')
        self.lists = {}
        for name in ('buffers', 'bufferViews', 'accessors', 'scenes', 'nodes', 'meshes', 'skins',
                     'materials', 'images', 'textures', 'samplers', 'animations', 'cameras'):
            value = self.doc.get(name, [])
            demand(isinstance(value, list) and all(isinstance(x, dict) for x in value), name + ' definitions')
            self.lists[name] = value
            setattr(self, name, value)
        demand(len(self.buffers) == 1 and 'uri' not in self.buffers[0], 'single embedded buffer')
        n = uint(self.buffers[0].get('byteLength'), 'buffer.byteLength', 1)
        bc = bins[0]
        demand(0 <= bc['bytes']-n <= 3, 'BIN padding length')
        self.bin = self.bytes[bc['offset']:bc['offset']+n]
        demand(all(v == 0 for v in self.bytes[bc['offset']+n:bc['offset']+bc['bytes']]), 'BIN padding zeros')
        for i, v in enumerate(self.bufferViews):
            demand(v.get('buffer') == 0, f'bufferViews[{i}].buffer')
            o = uint(v.get('byteOffset', 0), 'view offset')
            sz = uint(v.get('byteLength'), 'view length', 1)
            demand(o+sz <= n, f'bufferViews[{i}] extent')
            if 'byteStride' in v:
                st = uint(v['byteStride'], 'stride', 4)
                demand(st <= 252 and st % 4 == 0, 'view stride criterion')
            demand(v.get('target', 34962) in (34962, 34963), 'bufferView target')
        self.decoded = []
        self.scalar_count = 0
        for i, a in enumerate(self.accessors):
            self.decoded.append(self.decode_accessor(i, a))
        self.refs = [[] for _ in self.accessors]
        self.parents = [None] * len(self.nodes)
        demand(len(self.nodes) <= 1000000, 'node resource cap')
        self.locals = [local_matrix(n, f'nodes[{i}]') for i, n in enumerate(self.nodes)]
        for i, node in enumerate(self.nodes):
            children = node.get('children', [])
            demand(isinstance(children, list) and len(children) == len(set(children)), 'node children')
            for c in children:
                index(c, self.nodes, 'child reference')
                demand(self.parents[c] is None and c != i, 'strict node parent')
                self.parents[c] = i
        self.worlds = [None] * len(self.nodes)
        def world(i, visiting):
            demand(i not in visiting, 'node cycle')
            if self.worlds[i] is None:
                p = self.parents[i]
                self.worlds[i] = self.locals[i] if p is None else matmul(world(p, visiting | {i}), self.locals[i])
            return self.worlds[i]
        for i in range(len(self.nodes)):
            world(i, set())
        self.scene_nodes = []
        for s, scene in enumerate(self.scenes):
            roots = scene.get('nodes', [])
            demand(isinstance(roots, list) and len(roots) == len(set(roots)), 'scene roots')
            members = set()
            def visit(i):
                index(i, self.nodes, 'scene node')
                demand(i not in members, 'scene duplicate node')
                members.add(i)
                for child in self.nodes[i].get('children', []):
                    visit(child)
            for i in roots:
                index(i, self.nodes, 'scene root')
                demand(self.parents[i] is None, 'scene root has parent')
                visit(i)
            self.scene_nodes.append(sorted(members))
        self.selected_scene = index(self.doc.get('scene'), self.scenes, 'explicit default scene')
        self.validate_definitions()

    def span(self, view_id, offset, count, stride, offsets, width, witness):
        index(view_id, self.bufferViews, witness + ' view')
        v = self.bufferViews[view_id]
        uint(offset, witness + ' offset')
        end = offset + (count-1)*stride + max(offsets) + width
        demand(end <= v['byteLength'], witness + ' extent')
        demand((v.get('byteOffset', 0)+offset) % width == 0 and offset % width == 0, witness + ' alignment')
        return v.get('byteOffset', 0) + offset

    def decode_accessor(self, i, a):
        name = f'accessors[{i}]'
        ct, shape = a.get('componentType'), a.get('type')
        demand(ct in CT and shape in SHAPE, name + ' type')
        fmt, width = CT[ct]
        rows, cols = SHAPE[shape]
        size = rows * cols
        count = uint(a.get('count'), name + '.count', 1)
        demand(count*size <= SCALARS_EACH, name + ' scalar cap')
        self.scalar_count += count*size
        demand(self.scalar_count <= SCALARS_TOTAL, 'aggregate scalar cap')
        norm = a.get('normalized', False)
        demand(type(norm) is bool and not (norm and ct in (5125, 5126)), name + ' normalized')
        column_stride = ((rows*width+3)//4)*4 if cols > 1 else rows*width
        component_offsets = [(c//rows)*column_stride+(c % rows)*width for c in range(size)]
        packed = cols*column_stride
        view_id = a.get('bufferView')
        offset = uint(a.get('byteOffset', 0), name + '.byteOffset')
        raw = [[0]*size for _ in range(count)]
        stride = packed
        backing = 'allocated-accessor:' + str(i)
        if view_id is not None:
            index(view_id, self.bufferViews, name + ' bufferView')
            v = self.bufferViews[view_id]
            stride = v.get('byteStride', packed)
            demand(stride >= packed and stride % width == 0, name + ' stride')
            start = self.span(view_id, offset, count, stride, component_offsets, width, name)
            for k in range(count):
                raw[k] = [struct.unpack_from('<'+fmt, self.bin, start+k*stride+c)[0] for c in component_offsets]
            backing = 'bufferView:' + str(view_id)
        else:
            demand(offset == 0, name + ' baseless offset')
        sparse_record = None
        if 'sparse' in a:
            s = a['sparse']; sc = uint(s.get('count'), name + ' sparse count', 1)
            demand(sc <= count, name + ' sparse count extent')
            si, sv = s.get('indices', {}), s.get('values', {})
            ict = si.get('componentType')
            demand(ict in (5121, 5123, 5125), name + ' sparse index component')
            ifmt, iw = CT[ict]
            iv, vv = si.get('bufferView'), sv.get('bufferView')
            for v in (iv, vv):
                index(v, self.bufferViews, name + ' sparse view')
                demand('byteStride' not in self.bufferViews[v], name + ' sparse stride')
            istart = self.span(iv, si.get('byteOffset', 0), sc, iw, [0], iw, name + ' sparse indices')
            vstart = self.span(vv, sv.get('byteOffset', 0), sc, packed, component_offsets, width, name + ' sparse values')
            indices = [struct.unpack_from('<'+ifmt, self.bin, istart+k*iw)[0] for k in range(sc)]
            demand(all(0 <= v < count for v in indices) and all(a < b for a, b in zip(indices, indices[1:])), name + ' sparse index order')
            values = [[struct.unpack_from('<'+fmt, self.bin, vstart+k*packed+c)[0] for c in component_offsets] for k in range(sc)]
            for k, value in zip(indices, values):
                raw[k] = value
            sparse_record = {'indices': indices, 'values': values, 'source': s}
            backing = 'allocated-accessor:' + str(i)
            demand(not (view_id is not None and stride != packed), name + ' interleaved+sparse engine path unsupported')
            demand(size < 5, name + ' sparse matrix engine path unsupported')
        demand(all(math.isfinite(v) for row in raw for v in row), name + ' nonfinite values')
        decoded = [[normalized(v, ct) if norm else v for v in row] for row in raw]
        bounds = {}
        for kind in ('min', 'max'):
            if kind in a:
                bound = array(a[kind], size, name + '.' + kind)
                stored = [f32(v) if ct == 5126 else v for v in bound]
                observed = [min(row[c] for row in raw) if kind == 'min' else max(row[c] for row in raw) for c in range(size)]
                # Bounds describe raw typed extrema after sparse substitution.
                # The core explicitly exempts baseless, non-sparse accessors.
                if view_id is not None or 'sparse' in a:
                    demand(stored == observed, name + ' exact typed extrema')
                bounds[kind] = {'declared': bound, 'typed': stored, 'observed': observed}
        return {'index': i, 'source': a, 'raw': raw, 'decoded': decoded, 'sparse': sparse_record,
                'count': count, 'itemSize': size, 'componentType': ct, 'normalized': norm,
                'storage': {'backing': backing, 'view': view_id, 'offset': offset, 'stride': stride,
                            'componentOffsets': component_offsets, 'componentBytes': width}, 'bounds': bounds}

    def use(self, value, witness):
        i = index(value, self.accessors, witness)
        if witness not in self.refs[i]:
            self.refs[i].append(witness)
        return self.decoded[i]

    def attribute(self, semantic, value, witness, count=None, morph=False):
        a = self.use(value, witness); src = a['source']; ct = a['componentType']; ty = src['type']; norm = a['normalized']
        if count is not None:
            demand(a['count'] == count, witness + ' count')
        if semantic == 'POSITION' or semantic == 'NORMAL':
            demand(ct == 5126 and ty == 'VEC3' and not norm, witness + ' semantic')
            if semantic == 'POSITION':
                demand('min' in src and 'max' in src, witness + ' POSITION bounds')
        elif semantic == 'TANGENT':
            demand(ct == 5126 and ty == ('VEC3' if morph else 'VEC4') and not norm, witness + ' tangent')
        elif semantic.startswith('JOINTS_'):
            demand(ct in (5121, 5123) and ty == 'VEC4' and not norm and not morph, witness + ' joints')
        elif semantic.startswith('WEIGHTS_'):
            demand(ty == 'VEC4' and (ct == 5126 and not norm or ct in (5121, 5123) and norm) and not morph, witness + ' weights')
        elif semantic.startswith('TEXCOORD_'):
            demand(ty == 'VEC2' and (ct == 5126 and not norm or ct in (5121, 5123) and norm), witness + ' UV')
        elif semantic.startswith('COLOR_'):
            demand(ty in ('VEC3', 'VEC4') and (ct == 5126 and not norm or ct in (5121, 5123) and norm), witness + ' color')
        else:
            demand(semantic.startswith('_') and not morph, witness + ' unsupported semantic')
        v = src.get('bufferView')
        if v is not None:
            demand(src.get('byteOffset', 0) % 4 == 0 and self.bufferViews[v].get('byteOffset', 0) % 4 == 0, witness + ' vertex alignment')
        return a

    def validate_definitions(self):
        self.mesh_primitives = []
        self.weight_creation = {}
        self.target_counts = []
        mesh_nodes = [[] for _ in self.meshes]
        for ni, node in enumerate(self.nodes):
            if 'mesh' in node:
                mesh_nodes[index(node['mesh'], self.meshes, 'node mesh')].append(ni)
            if 'skin' in node:
                index(node['skin'], self.skins, 'node skin'); demand('mesh' in node, 'skin without mesh')
            if 'camera' in node:
                index(node['camera'], self.cameras, 'node camera')
        for mi, mesh in enumerate(self.meshes):
            ps = mesh.get('primitives', []); demand(isinstance(ps, list) and ps, 'mesh primitives')
            flags = {'skin' in self.nodes[n] for n in mesh_nodes[mi]}
            demand(len(flags) <= 1, f'mesh[{mi}] mixed skin ownership')
            skinned = flags == {True}
            ntargets = None
            for pi, p in enumerate(ps):
                name = f'meshes[{mi}].primitives[{pi}]'; attrs = p.get('attributes', {})
                demand(isinstance(attrs, dict) and 'POSITION' in attrs, name + ' POSITION')
                pos = self.attribute('POSITION', attrs['POSITION'], name + '.POSITION')
                for semantic, value in attrs.items():
                    self.attribute(semantic, value, name+'.'+semantic, pos['count'])
                mode = p.get('mode', 4); demand(type(mode) is int and 0 <= mode <= 6, name + ' mode')
                demand(not skinned or mode in (4, 5, 6), name + ' skinned nontriangle class unsupported')
                if 'indices' in p:
                    ix = self.use(p['indices'], name+'.indices')
                    demand(ix['source']['type'] == 'SCALAR' and ix['componentType'] in (5121, 5123, 5125) and not ix['normalized'], name + ' indices type')
                    values = [x[0] for x in ix['raw']]
                else:
                    values = list(range(pos['count']))
                demand(all(0 <= x < pos['count'] for x in values), name + ' index extent')
                demand(mode != 4 or len(values) % 3 == 0, name+' triangle arity')
                demand(mode != 1 or len(values) % 2 == 0, name+' line arity')
                demand(mode not in (5, 6) or len(values) >= 3, name+' strip/fan arity')
                if 'material' in p:
                    index(p['material'], self.materials, name+'.material')
                targets = p.get('targets', []); demand(isinstance(targets, list), name+' targets')
                if ntargets is None:
                    ntargets = len(targets)
                demand(ntargets == len(targets), name+' morph count across primitives')
                for ti, target in enumerate(targets):
                    demand(isinstance(target, dict), name+' target map')
                    for semantic, value in target.items():
                        demand(semantic in ('POSITION', 'NORMAL', 'TANGENT', 'COLOR_0'), name+' target semantic')
                        demand(semantic in attrs, name+' morph target requires original base attribute')
                        self.attribute(semantic, value, name+f'.targets[{ti}].'+semantic, pos['count'], True)
                sets_j = {k[7:] for k in attrs if k.startswith('JOINTS_')}
                sets_w = {k[8:] for k in attrs if k.startswith('WEIGHTS_')}
                demand(sets_j == sets_w and all(s.isdecimal() and str(int(s)) == s for s in sets_j), name+' paired canonical influence sets')
                if skinned:
                    demand('0' in sets_w, name+' primary influence set')
                    wa = attrs['WEIGHTS_0']; self.weight_creation.setdefault(wa, []).append((mi, pi))
                self.mesh_primitives.append({'mesh': mi, 'primitive': pi, 'source': p, 'indices': values,
                                             'class': 'SkinnedMesh' if skinned else 'Mesh' if mode in (4, 5, 6) else
                                             {0: 'Points', 1: 'LineSegments', 2: 'LineLoop', 3: 'Line'}[mode],
                                             'positionCount': pos['count'], 'targetCount': len(targets)})
            self.target_counts.append(ntargets or 0)
            if 'weights' in mesh:
                array(mesh['weights'], ntargets or 0, f'mesh[{mi}] weights')
        for ni, node in enumerate(self.nodes):
            if 'weights' in node:
                demand('mesh' in node, 'node weights without mesh')
                array(node['weights'], self.target_counts[node['mesh']], f'node[{ni}] weights')
        self.inverse_binds = []
        for si, skin in enumerate(self.skins):
            joints = skin.get('joints', []); demand(isinstance(joints, list) and joints and len(joints) == len(set(joints)), 'skin ordered joints')
            for joint in joints:
                index(joint, self.nodes, 'skin joint')
            if 'skeleton' in skin:
                index(skin['skeleton'], self.nodes, 'skin skeleton')
            if 'inverseBindMatrices' in skin:
                a = self.use(skin['inverseBindMatrices'], f'skins[{si}].inverseBindMatrices')
                demand(a['source']['type'] == 'MAT4' and a['componentType'] == 5126 and not a['normalized'] and a['count'] >= len(joints), 'IBM type/count')
                mats = a['decoded'][:len(joints)]
            else:
                mats = [IDENTITY[:] for _ in joints]
            for m in mats:
                demand(m[3] == m[7] == m[11] == 0 and m[15] == 1, 'IBM affine row')
            self.inverse_binds.append(mats)
            ancestors = []
            for j in joints:
                chain = {j}; p = self.parents[j]
                while p is not None:
                    chain.add(p); p = self.parents[p]
                ancestors.append(chain)
            common = set.intersection(*ancestors)
            demand(common, 'skin common ancestor')
            if 'skeleton' in skin:
                demand(skin['skeleton'] in common, 'skin skeleton ancestry')
            for ni, node in enumerate(self.nodes):
                if node.get('skin') == si:
                    scenes = [set(x) for x in self.scene_nodes if ni in x]
                    demand(all(set(joints) <= s and common & s for s in scenes), 'skin joint scene membership')
        for ai, anim in enumerate(self.animations):
            samplers = anim.get('samplers', []); channels = anim.get('channels', [])
            demand(isinstance(samplers, list) and isinstance(channels, list), 'animation arrays')
            for sj, sampler in enumerate(samplers):
                a = self.use(sampler.get('input'), f'animations[{ai}].samplers[{sj}].input')
                self.use(sampler.get('output'), f'animations[{ai}].samplers[{sj}].output')
                demand(a['source']['type'] == 'SCALAR' and a['componentType'] == 5126 and not a['normalized'], 'animation time')
                demand('min' in a['source'] and 'max' in a['source'], 'animation input bounds')
                ts = [v[0] for v in a['raw']]
                demand(all(t >= 0 for t in ts) and all(a < b for a, b in zip(ts, ts[1:])), 'animation time order')
                demand(sampler.get('interpolation', 'LINEAR') in ('LINEAR', 'STEP', 'CUBICSPLINE'), 'animation interpolation')
            for ch in channels:
                index(ch.get('sampler'), samplers, 'animation sampler')
                target = ch.get('target', {}); index(target.get('node'), self.nodes, 'animation node')
                demand(target.get('path') in ('translation', 'rotation', 'scale', 'weights'), 'animation target')
        self.image_records = []
        for ii, image in enumerate(self.images):
            demand('uri' not in image and image.get('mimeType') in ('image/png', 'image/jpeg'), 'self-contained core image')
            vi = index(image.get('bufferView'), self.bufferViews, 'image view'); v = self.bufferViews[vi]
            demand('byteStride' not in v, 'image view stride')
            start, n = v.get('byteOffset', 0), v['byteLength']
            self.image_records.append({'index': ii, 'source': image, 'bufferView': vi, 'BINOffset': start,
                                       'GLBOffset': self.chunks[1]['offset']+start, 'bytes': n,
                                       'sha256': sha(self.bin[start:start+n]), 'interpretation': 'raw embedded bytes hashed only, no pixel decode'})
        for ti, texture in enumerate(self.textures):
            index(texture.get('source'), self.images, f'textures[{ti}].source')
            if 'sampler' in texture:
                index(texture['sampler'], self.samplers, 'texture sampler')
        for sampler in self.samplers:
            demand(sampler.get('magFilter', 9729) in (9728, 9729), 'magFilter')
            demand(sampler.get('minFilter', 9987) in (9728, 9729, 9984, 9985, 9986, 9987), 'minFilter')
            for k in ('wrapS', 'wrapT'):
                demand(sampler.get(k, 10497) in (33071, 33648, 10497), 'wrap')
        self.material_uses = []
        self.texture_sampler_policies = []
        for ti, texture in enumerate(self.textures):
            sid = texture.get('sampler')
            sampler = self.samplers[sid] if sid is not None else {}
            self.texture_sampler_policies.append({'texture': ti, 'originalSampler': sid,
                                                  'installedLoaderDefaults': {'magFilter': sampler.get('magFilter', 9729),
                                                                              'minFilter': sampler.get('minFilter', 9987),
                                                                              'wrapS': sampler.get('wrapS', 10497),
                                                                              'wrapT': sampler.get('wrapT', 10497), 'flipY': False},
                                                  'scope': 'selected installed loader defaults, no image decode/upload'})
        for mi, mat in enumerate(self.materials):
            pbr = mat.get('pbrMetallicRoughness', {})
            array(pbr.get('baseColorFactor', [1., 1., 1., 1.]), 4, 'baseColorFactor')
            array(mat.get('emissiveFactor', [0., 0., 0.]), 3, 'emissiveFactor')
            demand(mat.get('alphaMode', 'OPAQUE') in ('OPAQUE', 'MASK', 'BLEND'), 'alphaMode')
            demand(type(mat.get('doubleSided', False)) is bool, 'doubleSided')
            for role, info in [('baseColor', pbr.get('baseColorTexture')), ('metallicRoughness', pbr.get('metallicRoughnessTexture')),
                               ('normal', mat.get('normalTexture')), ('occlusion', mat.get('occlusionTexture')), ('emissive', mat.get('emissiveTexture'))]:
                if info is not None:
                    tex = index(info.get('index'), self.textures, 'material texture')
                    uv = uint(info.get('texCoord', 0), 'material texCoord')
                    self.material_uses.append({'material': mi, 'role': role, 'texture': tex, 'texCoord': uv,
                                               'colorInterpretation': 'sRGB' if role in ('baseColor', 'emissive') else 'linear-data', 'source': info})
        for prim in self.mesh_primitives:
            material = prim['source'].get('material')
            for use in self.material_uses:
                if material == use['material']:
                    demand('TEXCOORD_'+str(use['texCoord']) in prim['source']['attributes'], 'material missing original UV')
        self.alias_guard()

    def alias_guard(self):
        for wa, owners in self.weight_creation.items():
            demand(len(owners) == 1, f'weights accessor[{wa}] repeated creation owners {owners}')
            mi, pi = owners[0]
            allowed = f'meshes[{mi}].primitives[{pi}].WEIGHTS_0'
            demand(self.refs[wa] == [allowed], f'weights accessor[{wa}] cross-semantic reuse')
            a = self.decoded[wa]; s = a['storage']
            # Exact component-byte spans, grouped by loader-effective backing.
            written = set()
            for k in range(a['count']):
                for c in s['componentOffsets']:
                    written.update(range(s['offset']+k*s['stride']+c, s['offset']+k*s['stride']+c+s['componentBytes']))
            if s['backing'].startswith('bufferView:'):
                for other in self.decoded:
                    if other['index'] == wa or other['storage']['backing'] != s['backing']:
                        continue
                    o = other['storage']
                    for k in range(other['count']):
                        for c in o['componentOffsets']:
                            demand(all(b not in written for b in range(o['offset']+k*o['stride']+c, o['offset']+k*o['stride']+c+o['componentBytes'])),
                                   f'weights accessor[{wa}] mutable overlap accessor[{other["index"]}]')
                # Images use copied immutable byte payloads later, but preserve
                # conservative refusal for an image sharing mutable view bytes.
                for image in self.image_records:
                    demand(image['bufferView'] != s['view'], f'weights accessor[{wa}] image view sharing')

    def world_packet(self):
        instances = []; total = 0
        for ni, node in enumerate(self.nodes):
            if 'mesh' not in node:
                continue
            mi = node['mesh']; si = node.get('skin'); wm = self.worlds[ni]; inv = inverse(wm)
            for prim in (p for p in self.mesh_primitives if p['mesh'] == mi):
                pi = prim['primitive']; p = prim['source']; attrs = p['attributes']; points = self.decoded[attrs['POSITION']]['decoded']
                demand(len(points) <= POINTS_EACH, 'instance point cap'); total += len(points)
                demand(total <= POINTS_TOTAL, 'total point cap')
                effective = []; cpu = []; shader = []; zero = []; changed = []; sums = []; extra = []
                max_weight_diff = {'value': 0., 'vertex': None, 'component': None}
                if si is not None:
                    skin = self.skins[si]; joints = skin['joints']; transforms = [matmul(self.worlds[j], b) for j, b in zip(joints, self.inverse_binds[si])]
                    keys = sorted(k[8:] for k in attrs if k.startswith('WEIGHTS_'))
                    wr = self.decoded[attrs['WEIGHTS_0']]; jr = self.decoded[attrs['JOINTS_0']]
                    for vi, point in enumerate(points):
                        seen = set(); source_sum = 0.
                        for key in keys:
                            ws = self.decoded[attrs['WEIGHTS_'+key]]; js = self.decoded[attrs['JOINTS_'+key]]
                            for w, j in zip(ws['decoded'][vi], js['raw'][vi]):
                                demand(0 <= j < len(joints), f'node[{ni}] primitive[{pi}] vertex[{vi}] all joint range')
                                demand(w >= 0 and math.isfinite(w), 'nonnegative finite source weight')
                                if w:
                                    demand(j not in seen, 'duplicate positive joint'); seen.add(j)
                                if key != '0':
                                    demand(w == 0, 'positive extra influence unsupported'); extra.append(key)
                                source_sum += w
                        if wr['componentType'] in (5121, 5123):
                            max_int = 255 if wr['componentType'] == 5121 else 65535
                            demand(sum(wr['raw'][vi]) == max_int, 'quantized primary raw total')
                        weights = wr['decoded'][vi]
                        length = ((abs(weights[0])+abs(weights[1]))+abs(weights[2]))+abs(weights[3])
                        scale = 1./length if length else None
                        norm = [w*scale for w in weights] if length else [1., 0., 0., 0.]
                        if not length:
                            zero.append(vi)
                        if wr['componentType'] == 5126:
                            ew = [f32(v) for v in norm]
                        else:
                            max_int = 255 if wr['componentType'] == 5121 else 65535
                            ew = [math.floor(v*max_int+0.5)/max_int for v in norm]
                        if ew != weights:
                            changed.append(vi)
                        for component, (a, b) in enumerate(zip(weights, ew)):
                            error = abs(a-b)
                            if error > max_weight_diff['value']:
                                max_weight_diff = {'value': error, 'vertex': vi, 'component': component,
                                                   'source': a, 'effective': b}
                        effective.append(ew); sums.append({'source': source_sum, 'effective': sum(ew)})
                        q4 = [0., 0., 0., 0.]
                        for j, w in zip(jr['raw'][vi], ew):
                            if w:
                                v = transform(transforms[j], [*point, 1.])
                                q4 = [a+w*b for a, b in zip(q4, v)]
                        # Vector3 CPU reintroduces implicit1 before inverse.
                        cpu.append(xyz(wm, xyz(inv, q4[:3])))
                        # Source-level ideal shader: vec4 through bind inverse,
                        # xyz then subsequent mesh world with implicit1.
                        shader.append(xyz(wm, transform(inv, q4)[:3]))
                else:
                    cpu = [xyz(wm, point) for point in points]; shader = [v[:] for v in cpu]
                demand(all(math.isfinite(v) for row in cpu+shader for v in row), 'finite world outputs')
                maxdiff = {'value': 0., 'vertex': None, 'axis': None}
                for vi, (a, b) in enumerate(zip(cpu, shader)):
                    for axis in range(3):
                        error = abs(a[axis]-b[axis])
                        if error > maxdiff['value']:
                            maxdiff = {'value': error, 'vertex': vi, 'axis': axis}
                default = node.get('weights', self.meshes[mi].get('weights', [0.]*prim['targetCount']))
                instances.append({'node': ni, 'mesh': mi, 'primitive': pi, 'skin': si, 'class': prim['class'],
                                  'positionAccessor': attrs['POSITION'], 'points': cpu, 'idealShaderPoints': shader,
                                  'effectiveWeights': effective, 'weightSums': sums, 'zeroRows': zero, 'changedRows': changed,
                                  'maxSourceEffectiveWeightDifference': max_weight_diff,
                                  'zeroExtraSets': sorted(set(extra)), 'maxCpuIdealShaderDifference': maxdiff,
                                  'sourceDefaultMorphWeights': default, 'selectedMorphWeights': [0.]*prim['targetCount'],
                                  'sceneMembership': [s for s, ns in enumerate(self.scene_nodes) if ni in ns],
                                  'bounds': {'min': [min(row[c] for row in cpu) for c in range(3)],
                                             'max': [max(row[c] for row in cpu) for c in range(3)]}})
        return {'frame': 'selected zero-source-morph/original-node-transforms/no-animation; not runtime neutral',
                'instances': instances, 'totalPoints': total, 'localMatrices': self.locals, 'worldMatrices': self.worlds,
                'inverseBinds': self.inverse_binds, 'matrixPositionCpuCriterion': MATRIX_TOL,
                'shaderScope': 'ideal double-precision source semantics only, not actual upload/GPU or appearance'}


def main():
    demand(len(sys.argv) == 2, 'one isolated new output directory argument required')
    out = Path(sys.argv[1]).resolve()
    demand(out.parent == Path(__file__).resolve().parent and out.name == 'output' and not out.exists(), 'fixed empty output path')
    source = CompleteSource()
    world = source.world_packet()
    owner = {'original': {'path': str(SOURCE), 'bytes': SOURCE_BYTES, 'sha256': SOURCE_SHA},
             'chunks': source.chunks, 'allDefinitions': source.lists, 'accessorReferences': source.refs,
             'parents': source.parents, 'sceneNodes': source.scene_nodes, 'selectedScene': source.selected_scene,
             'primitives': source.mesh_primitives, 'images': source.image_records, 'materialTextureUses': source.material_uses,
             'textureSamplerPolicies': source.texture_sampler_policies,
             'absentMaterialPolicy': {'installedClass': 'MeshStandardMaterial', 'color': [1., 1., 1.],
                                      'emissive': [0., 0., 0.], 'metalness': 1., 'roughness': 1.,
                                      'transparent': False, 'depthTest': True, 'side': 'FrontSide',
                                      'witness': 'installed GLTFLoader.createDefaultMaterial; no render qualification'},
             'weightCreationOwners': source.weight_creation, 'scalarCount': source.scalar_count,
             'qualification': 'complete selected supported-boundary source packet only; independent oracle/checker and actual images still required'}
    out.mkdir()
    files = {}; aggregate = 0
    def write(name, data, json_file=True):
        nonlocal aggregate
        blob = (json.dumps(data, allow_nan=False, separators=(',', ':'))+'\n').encode() if json_file else data
        demand(not json_file or len(blob) <= PER_JSON, name + ' per JSON output cap')
        aggregate += len(blob); demand(aggregate <= TOTAL_OUTPUT, 'aggregate output cap')
        (out/name).write_bytes(blob); files[name] = {'bytes': len(blob), 'sha256': sha(blob)}
    write('source.glb', source.bytes, False)
    demand(len(source.json_bytes) <= PER_JSON, 'raw source JSON cap')
    write('source.json', source.json_bytes, False)
    write('accessors.json', source.decoded)
    write('ownership.json', owner)
    write('world.json', world)
    write('manifest.json', {'files': files, 'bytesBeforeManifest': aggregate,
                           'allOriginalAccessorCount': len(source.accessors), 'allOriginalInstanceCount': len(world['instances']),
                           'limits': 'no image decode, original source unchanged, no formal whole glTF validity/rig/anatomy/appearance/GPU proof'})
    print(json.dumps({'reader': 'complete output written, unqualified pending independent oracle/checker',
                      'accessors': len(source.accessors), 'instances': len(world['instances']), 'points': world['totalPoints'], 'bytes': aggregate}))


if __name__ == '__main__':
    main()
