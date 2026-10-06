"""Inert source until the separately admitted first MIDI CPU trial."""
from pathlib import Path
import datetime
import hashlib
import json
import math
import os
import stat

HERE = Path(__file__).resolve().parent
SCALE = 100000000
MAX_FILE = 10 * 1024 * 1024


def inputs():
    manifest = json.loads((HERE / 'INPUTS.json').read_text())
    files = manifest['files']
    assert {r['role'] for r in files} == {'design', 'contract', 'writer_addendum', 'producer', 'checker', 'supervisor', 'python'}
    assert len(files) == 7 and len({r['path'] for r in files}) == 7
    for r in files:
        q = Path(r['path'])
        assert q.is_absolute() and stat.S_ISREG(q.lstat().st_mode)
        b = q.read_bytes()
        assert len(b) == r['bytes'] and hashlib.sha256(b).hexdigest() == r['sha256'], r['role']
    return manifest, {r['role']: r for r in files}


def lattice(value):
    assert math.isfinite(value)
    numerator, denominator = value.as_integer_ratio()
    quotient, remainder = divmod(abs(numerator) * SCALE, denominator)
    rounded = quotient + (2 * remainder >= denominator)
    return -rounded if numerator < 0 else rounded


def decimal(integer):
    sign = '-' if integer < 0 else ''
    whole, remainder = divmod(abs(integer), SCALE)
    return f'{sign}{whole}.{remainder:08d}'


def kd(channel):
    quotient, remainder = divmod(channel * SCALE, 255)
    return decimal(quotient + (2 * remainder >= 255))


def write(out, name, data):
    assert len(data) <= MAX_FILE
    with (out / name).open('xb') as f:
        f.write(data)
    return {'path': str(out / name), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    config, pins = inputs()
    out = Path(config['output_directory'])
    assert out == HERE.parent / 'midi-skirt-first-cpu' / 'output'
    assert not out.exists() and not out.is_symlink()
    design = json.loads(Path(pins['design']['path']).read_text())
    assert design['angular_samples'] == 64 and len(design['rows']) == 21
    vertices = []
    for surface in ['outer', 'inner']:
        offset = 0.0 if surface == 'outer' else 0.006
        for j, (u, rx, rz, cz, amplitude) in enumerate(design['rows']):
            for i in range(64):
                theta = 2 * math.pi * i / 64
                q = (0.65 * math.cos((8 * theta) + (0.4 * u))) + (0.35 * math.cos((6 * theta) - 0.2))
                m = 1 + (amplitude * q)
                x = ((rx - offset) * m) * math.sin(theta)
                y = 1 - u
                z = cz + (((rz - offset) * m) * math.cos(theta))
                vertices.append({'id': len(vertices), 'row': j, 'angle': i, 'surface': surface,
                                 'xyz_lattice': [lattice(x), lattice(y), lattice(z)]})
    quads = []
    for surface in ['outer', 'inner']:
        offset = 0 if surface == 'outer' else 1344
        for j in range(20):
            for i in range(64):
                n = (i + 1) % 64
                a, b, c, d = [offset + k for k in [64*j+i, 64*(j+1)+i, 64*(j+1)+n, 64*j+n]]
                region = 'inside' if surface == 'inner' else ('outer-band' if j < 2 else 'outer-plum')
                material = 'inside' if surface == 'inner' else ('band' if j < 2 else 'plum')
                indices = [a, d, c, b] if surface == 'inner' else [a, b, c, d]
                quads.append({'id': len(quads), 'region': region, 'material': material, 'vertices': indices})
    for j in [0, 20]:
        for i in range(64):
            n = (i + 1) % 64
            a, b = 64*j+i, 64*j+n
            indices = [a, b, b+1344, a+1344] if j == 0 else [a, a+1344, b+1344, b]
            quads.append({'id': len(quads), 'region': 'rims', 'material': 'band', 'vertices': indices})
    triangles = []
    for quad in quads:
        a, b, c, d = quad['vertices']
        triangles.extend([[a, b, c], [a, c, d]])
    mesh = {'identity': design['identity'], 'frame': design['frame'],
            'source_hashes': {role: pins[role]['sha256'] for role in ['design', 'contract', 'writer_addendum']},
            'coordinate_quantum': design['coordinate_quantum'], 'vertices': vertices,
            'quads': quads, 'triangles': triangles, 'materials': design['material_palette'],
            'excluded_claims': design['claims_excluded']}
    obj = ['mtllib mara-midi.mtl']
    for v in vertices:
        obj.append('v ' + ' '.join(decimal(k) for k in v['xyz_lattice']))
    previous = None
    for face in quads:
        group = (face['region'], face['material'])
        if group != previous:
            obj.extend(['g ' + group[0], 'usemtl ' + group[1]])
            previous = group
        obj.append('f ' + ' '.join(str(k + 1) for k in face['vertices']))
    mtl = []
    for name, material in design['material_palette'].items():
        color = material['srgb_hex'][1:]
        mtl.extend(['newmtl ' + name, 'Kd ' + ' '.join(kd(int(color[i:i+2], 16)) for i in [0, 2, 4]),
                    'Ka 0 0 0', 'Ks 0 0 0', 'd 1', 'illum 1'])
    payloads = [('mesh.json', (json.dumps(mesh, indent=2, allow_nan=False)+'\n').encode()),
                ('mara-midi.obj', ('\n'.join(obj)+'\n').encode()),
                ('mara-midi.mtl', ('\n'.join(mtl)+'\n').encode())]
    out.mkdir()
    result = [write(out, name, data) for name, data in payloads]
    assert set(q.name for q in out.iterdir()) == {'mesh.json', 'mara-midi.obj', 'mara-midi.mtl'}
    print(json.dumps({'actor': 'producer', 'pid': os.getpid(), 'status': 'three_exports_only',
                      'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'files': result}))


if __name__ == '__main__':
    main()
