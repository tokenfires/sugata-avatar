"""Independent reconstruction and saved-data audit; unrun during source preparation."""
from pathlib import Path
from collections import defaultdict
from fractions import Fraction
import datetime
import hashlib
import json
import math
import os
import re
import stat

HERE = Path(__file__).resolve().parent
DEN = 100000000
FILES = {'mesh.json', 'mara-midi.obj', 'mara-midi.mtl'}
LIMIT = 10 * 1024 * 1024


def load_inputs():
    config = json.loads((HERE / 'INPUTS.json').read_text())
    rows = config['files']
    assert len(rows) == 7 and len({r['path'] for r in rows}) == 7
    assert {r['role'] for r in rows} == {'design', 'contract', 'writer_addendum', 'producer', 'checker', 'supervisor', 'python'}
    for row in rows:
        q = Path(row['path'])
        assert q.is_absolute() and stat.S_ISREG(q.lstat().st_mode)
        b = q.read_bytes()
        assert len(b) == row['bytes'] and hashlib.sha256(b).hexdigest() == row['sha256'], row['role']
    return config, {r['role']: r for r in rows}


def rounded(value):
    assert math.isfinite(value)
    fraction = Fraction.from_float(value) * DEN
    whole, rest = divmod(abs(fraction.numerator), fraction.denominator)
    if rest * 2 >= fraction.denominator:
        whole += 1
    return -whole if fraction < 0 else whole


def decimal_integer(word):
    assert re.fullmatch(r'-?\d+\.\d{8}', word), word
    negative = word.startswith('-')
    a, b = word.lstrip('-').split('.')
    result = int(a) * DEN + int(b)
    return -result if negative else result


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def audit(config, pins, out, progress):
    def begin(name):
        if progress['active_check'] is not None:
            progress['reached_checks'].append(progress['active_check'])
        progress['active_check'] = name
    begin('three_regular_exports_and_source_schema')
    assert stat.S_ISDIR(out.lstat().st_mode) and not out.is_symlink()
    assert {q.name for q in out.iterdir()} == FILES
    exports = []
    for name in sorted(FILES):
        q = out / name
        assert stat.S_ISREG(q.lstat().st_mode)
        b = q.read_bytes()
        assert len(b) <= LIMIT
        exports.append({'path': str(q), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
    design = json.loads(Path(pins['design']['path']).read_text())
    mesh = json.loads((out / 'mesh.json').read_text(), parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))
    assert set(mesh) == {'identity', 'frame', 'source_hashes', 'coordinate_quantum', 'vertices', 'quads', 'triangles', 'materials', 'excluded_claims'}
    assert mesh['identity'] == design['identity'] and mesh['frame'] == design['frame']
    assert mesh['source_hashes'] == {k: pins[k]['sha256'] for k in ['design', 'contract', 'writer_addendum']}
    assert mesh['coordinate_quantum'] == design['coordinate_quantum']
    assert mesh['materials'] == design['material_palette'] and mesh['excluded_claims'] == design['claims_excluded']
    begin('all_literal_lattice_vertices_and_bounds')
    expected = {}
    for j, row in enumerate(design['rows']):
        u, width, depth, centre, amplitude = row
        for angle in range(64):
            theta = 2 * math.pi * angle / 64
            ripple = (0.65 * math.cos((8 * theta) + (0.4 * u))) + (0.35 * math.cos((6 * theta) - 0.2))
            multiplier = 1 + (amplitude * ripple)
            for surface, offset, start in [('outer', 0.0, 0), ('inner', 0.006, 1344)]:
                ident = start + 64 * j + angle
                coords = [rounded(((width-offset)*multiplier)*math.sin(theta)), rounded(1-u),
                          rounded(centre+(((depth-offset)*multiplier)*math.cos(theta)))]
                expected[ident] = {'id': ident, 'row': j, 'angle': angle, 'surface': surface, 'xyz_lattice': coords}
    vertices = mesh['vertices']
    assert len(vertices) == 2688
    for i, v in enumerate(vertices):
        assert set(v) == {'id', 'row', 'angle', 'surface', 'xyz_lattice'}
        assert all(type(v[k]) is int for k in ['id', 'row', 'angle'])
        assert len(v['xyz_lattice']) == 3 and all(type(n) is int for n in v['xyz_lattice'])
        assert v == expected[i]
    coords = [tuple(v['xyz_lattice']) for v in vertices]
    assert len(set(coords)) == 2688
    assert all(0 <= y <= DEN and abs(x) <= 48000000 and abs(z) <= 34000000 for x, y, z in coords)
    begin('all_literal_faces_and_material_roles')
    face_expected = []
    for start, inner in [(0, False), (1344, True)]:
        for row in range(20):
            for angle in range(64):
                following = (angle+1) % 64
                if inner:
                    ids = [start+64*row+angle, start+64*row+following,
                           start+64*(row+1)+following, start+64*(row+1)+angle]
                    region, material = 'inside', 'inside'
                else:
                    ids = [64*row+angle, 64*(row+1)+angle, 64*(row+1)+following, 64*row+following]
                    region, material = ('outer-band', 'band') if row < 2 else ('outer-plum', 'plum')
                face_expected.append({'id': len(face_expected), 'region': region, 'material': material, 'vertices': ids})
    for row in [0, 20]:
        for angle in range(64):
            following = (angle+1) % 64
            outer, other = 64*row+angle, 64*row+following
            ids = [outer, other, other+1344, outer+1344] if row == 0 else [outer, outer+1344, other+1344, other]
            face_expected.append({'id': len(face_expected), 'region': 'rims', 'material': 'band', 'vertices': ids})
    assert len(mesh['quads']) == 2688 and mesh['quads'] == face_expected
    begin('every_triangle_area_local_winding_and_rim_row')
    triangles = []
    edges, links, graph = defaultdict(list), defaultdict(list), defaultdict(set)
    min_area_squared = None
    winding_min = {}
    for face in mesh['quads']:
        assert set(face) == {'id', 'region', 'material', 'vertices'} and type(face['id']) is int
        vs = face['vertices']
        assert len(vs) == 4 and len(set(vs)) == 4
        assert all(type(v) is int and 0 <= v < 2688 for v in vs)
        for k, v in enumerate(vs):
            nxt = vs[(k+1) % 4]
            edges[tuple(sorted((v, nxt)))].append((v, nxt))
            graph[v].add(nxt); graph[nxt].add(v)
            links[v].append((vs[(k-1) % 4], nxt))
        for ids in [(vs[0], vs[1], vs[2]), (vs[0], vs[2], vs[3])]:
            triangles.append(list(ids))
            a, b, c = [coords[i] for i in ids]
            normal = cross(tuple(b[k]-a[k] for k in range(3)), tuple(c[k]-a[k] for k in range(3)))
            squared = sum(n*n for n in normal)
            assert squared > 10**12
            min_area_squared = squared if min_area_squared is None else min(min_area_squared, squared)
            if face['id'] < 2560:
                j = (face['id'] % 1280) // 64
                mean_centre = (Fraction(str(design['rows'][j][3])) + Fraction(str(design['rows'][j+1][3]))) / 2
                cx = Fraction(a[0]+b[0]+c[0], 3*DEN)
                cz = Fraction(a[2]+b[2]+c[2], 3*DEN) - mean_centre
                dot = normal[0]*cx + normal[2]*cz
                signed = -dot if face['id'] >= 1280 else dot
                role = 'inner' if face['id'] >= 1280 else 'outer'
            else:
                top = face['id'] < 2624
                assert all(coords[i][1] == (DEN if top else 0) for i in vs)
                signed = normal[1] if top else -normal[1]
                role = 'top_rim' if top else 'bottom_rim'
            assert signed > 0, ('winding', face['id'])
            val = float(signed) / (DEN**2)
            winding_min[role] = min(winding_min.get(role, val), val)
    progress['minimum_squared_cross_unitless'] = min_area_squared/(DEN**4)
    progress['winding_minimum'] = winding_min
    begin('triangles_edge_incidence_connected_graph_euler_and_vertex_links')
    assert mesh['triangles'] == triangles and len(triangles) == 5376
    assert all(len(v) == 2 and v[0] == tuple(reversed(v[1])) for v in edges.values())
    assert len(edges) == 5376 and len(vertices)-len(edges)+len(mesh['quads']) == 0
    def connected(adjacency):
        seen, todo = set(), [next(iter(adjacency))]
        while todo:
            v = todo.pop()
            if v not in seen:
                seen.add(v); todo.extend(adjacency[v]-seen)
        return len(seen) == len(adjacency)
    assert connected(graph) and len(graph) == 2688
    for v, pairs in links.items():
        link_graph = defaultdict(set)
        for a, b in pairs:
            link_graph[a].add(b); link_graph[b].add(a)
        assert len(pairs) == len(link_graph) and all(len(s) == 2 for s in link_graph.values()) and connected(link_graph)
    begin('all_corresponding_sample_displacements')
    gaps = []
    for i in range(1344):
        a, b = coords[i], coords[i+1344]
        assert a[1] == b[1]
        squared = (a[0]-b[0])**2 + (a[2]-b[2])**2
        assert 548000**2 <= squared <= 652000**2
        gaps.append(squared)
    progress['corresponding_sample_XZ_displacement'] = [math.sqrt(min(gaps))/DEN, math.sqrt(max(gaps))/DEN]
    begin('complete_exact_OBJ_roundtrip')
    lines = (out/'mara-midi.obj').read_text().splitlines()
    assert lines.pop(0) == 'mtllib mara-midi.mtl'
    for vertex in coords:
        words = lines.pop(0).split()
        assert words[0] == 'v' and len(words) == 4
        assert tuple(decimal_integer(w) for w in words[1:]) == vertex
    previous = None
    for face in face_expected:
        group = (face['region'], face['material'])
        if group != previous:
            assert lines.pop(0) == 'g '+group[0] and lines.pop(0) == 'usemtl '+group[1]
            previous = group
        words = lines.pop(0).split()
        assert words[0] == 'f' and len(words) == 5 and all(re.fullmatch(r'[1-9]\d*', w) for w in words[1:])
        assert [int(w)-1 for w in words[1:]] == face['vertices']
    assert not lines
    begin('complete_exact_MTL_roundtrip')
    lines = (out/'mara-midi.mtl').read_text().splitlines()
    for name, material in design['material_palette'].items():
        assert lines.pop(0) == 'newmtl '+name
        words = lines.pop(0).split()
        assert words[0] == 'Kd' and len(words) == 4
        h = material['srgb_hex'][1:]
        for word, index in zip(words[1:], [0, 2, 4]):
            rational = Fraction(int(h[index:index+2], 16)*DEN, 255)
            quotient, remainder = divmod(rational.numerator, rational.denominator)
            assert decimal_integer(word) == quotient + (2*remainder >= rational.denominator)
        assert [lines.pop(0) for _ in range(4)] == ['Ka 0 0 0', 'Ks 0 0 0', 'd 1', 'illum 1']
    assert not lines
    begin('unchanged_final_three_file_envelope')
    assert {q.name for q in out.iterdir()} == FILES
    progress['reached_checks'].append(progress['active_check'])
    progress['active_check'] = None
    return {'decision': 'A', 'export_inputs': exports, 'source_hashes': mesh['source_hashes'],
            'counts': {'vertices': 2688, 'quads': 2688, 'triangles': 5376, 'material_edges': len(edges), 'euler': 0, 'components': 1},
            'minimum_squared_cross_unitless': min_area_squared/(DEN**4), 'winding_minimum': winding_min,
            'corresponding_sample_XZ_displacement': [math.sqrt(min(gaps))/DEN, math.sqrt(max(gaps))/DEN],
            'all_literal_positions_faces_materials_exports_exact': True,
            'limits': 'Artist source data only; no globalSI/continuousclearance/physicalfit/cloth/motion/appearance qualification'}


def main():
    config, pins = load_inputs()
    out = Path(config['output_directory'])
    assert out == HERE.parent/'midi-skirt-first-cpu'/'output'
    assert stat.S_ISDIR(out.lstat().st_mode) and not out.is_symlink()
    report = out/'CHECK.json'
    assert not report.exists() and not report.is_symlink()
    progress = {'reached_checks': [], 'active_check': None}
    try:
        result = audit(config, pins, out, progress)
    except Exception as error:
        result = {'decision': 'B', 'refusal_type': type(error).__name__, 'refusal': str(error)[:2000],
                  'source_hashes': {k: pins[k]['sha256'] for k in ['design', 'contract', 'writer_addendum']}}
    result['audit_progress'] = progress
    result.update({'actor': 'independent_checker', 'pid': os.getpid(), 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
    data = (json.dumps(result, indent=2, allow_nan=False)+'\n').encode()
    assert len(data) <= LIMIT
    with report.open('xb') as f:
        f.write(data)
    print(json.dumps({'actor': result['actor'], 'pid': result['pid'], 'decision': result['decision'], 'report_bytes': len(data)}))
    raise SystemExit(0 if result['decision'] == 'A' else 2)


if __name__ == '__main__':
    main()
