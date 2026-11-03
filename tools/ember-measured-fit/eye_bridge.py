"""One isolated authoring probe on the frozen measured identity; no image fitting.

Plain Python --preflight checks existing inputs. Blender --run builds once. The outer
launcher enforces wall time, RSS and output bounds; partial results are never reused.
"""
import ast
import hashlib
import json
import math
import struct
import sys
import time
import zipfile
from pathlib import Path
from types import ModuleType, SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/evidence/ember-2026-10-31-eye-bridge'
FIT = ROOT / 'docs/evidence/ember-2026-10-31-measured-fit'
MPFB = Path('/Users/robault/Library/Application Support/Blender/5.2/extensions/blender_org/mpfb')
CACHE = ROOT / 'tools/figure-pipeline/.cache'
PARTS = [
    ('eyes/high-poly/high-poly.mhclo', 'Eyes', 'OPAQUE'),
    ('teeth/teeth_base/teeth_base.mhclo', 'Teeth', 'OPAQUE'),
    ('tongue/tongue01/tongue01.mhclo', 'Tongue', 'OPAQUE'),
    ('eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows', 'MASK'),
    ('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes', 'MASK')]
ARCHIVES = ['faceunits01.zip', 'visemes01.zip', 'visemes02.zip']


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def preflight():
    identity = json.loads((OUT / 'identity-input.json').read_text())
    paths = [Path(__file__), ROOT / 'tools/figure-pipeline/build_figure.py',
             OUT / 'identity-input.json', FIT / 'candidate-correction-v001.json',
             FIT / 'candidate-correction-v001-positions.f32',
             ROOT / 'assets/identity/figure-vertex-map.bin',
             MPFB / 'data/3dobjs/base.obj',
             MPFB / 'data/rigs/standard/rig.game_engine.json',
             MPFB / 'data/rigs/standard/weights.game_engine.json']
    paths += list((MPFB / 'services').glob('*.py'))
    # Include macro targets as well as the explicitly resolved detail targets.
    paths += list((MPFB / 'data/targets/macrodetails').rglob('*.gz'))
    for t in identity['stack']:
        paths.append(MPFB / 'data/targets' / t['region'] / (t['target'] + '.target.gz'))
    paths += list((CACHE / 'ember-source').rglob('*'))
    paths = [p for p in paths if not p.is_dir()]
    expressions = {}
    for name in ARCHIVES:
        p = CACHE / name
        paths.append(p)
        with zipfile.ZipFile(p) as z:
            for n in z.namelist():
                if n.endswith('.target'):
                    key = Path(n).stem
                    if key in expressions:
                        raise ValueError('Duplicate expression ' + key)
                    expressions[key] = {'archive': name, 'member': n,
                                        'sha256': hashlib.sha256(z.read(n)).hexdigest()}
    for rel, _, _ in PARTS:
        if not (CACHE / 'ember-source' / rel).is_file():
            raise FileNotFoundError(rel)
    if len(expressions) != 89:
        raise ValueError('Expected existing 89 expression sources')
    inputs = {str(p): {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in sorted(set(paths))}
    report = {'inputs': inputs, 'expressions': expressions, 'identity': identity,
              'limits': {'builds': 1, 'wallSeconds': 180, 'rssBytes': 4*1024**3,
                         'outputBytes': 160*1024**2, 'threads': 2},
              'geometryToleranceMetres': 2e-6,
              'scope': 'Fitted parts, ordinary editable project, rigged export; no hair, garment, renderer or identity fitting.'}
    (OUT / 'preflight.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'inputs': len(inputs), 'inputBytes': sum(v['bytes'] for v in inputs.values()),
                      'expressionSources': len(expressions), 'limits': report['limits']}))


def run():
    import bpy
    import numpy as np
    started = time.monotonic()
    manifest = json.loads((OUT / 'preflight.json').read_text())
    for name, info in manifest['inputs'].items():
        if digest(Path(name)) != info['sha256']:
            raise ValueError('Preflight changed: ' + name)
    if (OUT / 'candidate.blend').exists() or (OUT / 'candidate.glb').exists():
        raise FileExistsError('Preserve prior output')
    sys.path.insert(0, str(ROOT / 'tools/figure-pipeline'))
    path = ROOT / 'tools/figure-pipeline/build_figure.py'
    tree = ast.parse(path.read_text(), filename=str(path))
    last = tree.body[-1]
    if not (isinstance(last, ast.Expr) and isinstance(last.value, ast.Call)
            and isinstance(last.value.func, ast.Name) and last.value.func.id == 'main'
            and not last.value.args and not last.value.keywords):
        raise ValueError('Legacy pipeline entry point changed')
    tree.body.pop()
    p = ModuleType('ember_eye_bridge_pipeline')
    p.__file__ = str(path)
    exec(compile(tree, str(path), 'exec'), p.__dict__)
    p.clear_startup_scene()
    body = p.HumanService.create_human(macro_detail_dict=manifest['identity']['macro'])
    p.HumanObjectProperties.set_value('gender', 0.0, entity_reference=body)
    p.TargetService.reapply_macro_details(body)
    for t in manifest['identity']['stack']:
        path = MPFB / 'data/targets' / t['region'] / (t['target'] + '.target.gz')
        p.TargetService.load_target(body, str(path), weight=t['weight'])
    blocks = list(body.data.shape_keys.key_blocks)
    basis = blocks[0]
    coords = np.array([v.co[:] for v in basis.data], dtype=np.float64)
    for block in blocks[1:]:
        if block.value:
            coords += (np.array([v.co[:] for v in block.data]) - np.array([v.co[:] for v in basis.data])) * block.value
    mapping = np.fromfile(ROOT / 'assets/identity/figure-vertex-map.bin', dtype='<u2')
    wanted = np.fromfile(FIT / 'candidate-correction-v001-positions.f32', dtype='<f4').reshape(-1, 3)
    yup = coords[:, [0, 2, 1]] * [1, 1, -1]
    worst = float(np.max(np.abs(yup[mapping] - wanted)))
    if worst > manifest['geometryToleranceMetres']:
        raise ValueError(f'Identity changed during authoring: {worst} metres')
    body.shape_key_clear()
    for v, co in zip(body.data.vertices, coords):
        v.co = co
    body.data.update()
    # Stock pigment is only an integration aid. Ember skin/hazel finish remains open.
    p.HumanService.set_character_skin(str(CACHE / 'ember-source/skins/young_caucasian_female/young_caucasian_female.mhmat'), body, skin_type='GAMEENGINE')
    parts = []
    for rel, kind, alpha in PARTS:
        path = CACHE / 'ember-source' / rel
        obj = p.HumanService.add_mhclo_asset(str(path), body, asset_type=kind, material_type='GAMEENGINE')
        parts.append((obj, str(path), alpha))
    # Explicit cached bytes avoid bulk_load_targets silently skipping an absent user asset.
    for name, src in manifest['expressions'].items():
        with zipfile.ZipFile(CACHE / src['archive']) as z:
            data = z.read(src['member'])
        if hashlib.sha256(data).hexdigest() != src['sha256']:
            raise ValueError('Expression changed')
        key = p.TargetService.target_string_to_shape_key(data.decode(), name, body)
        key.value = 0
    # MPFB stores only a relative asset-source fragment on attached parts. Its
    # interpolator searches configured roots and silently skips our private cache.
    # Resolve only these five new objects, without changing external preferences.
    paths_by_pointer = {obj.as_pointer(): path for obj, path, _ in parts}
    original_descriptor = p.ClothesService.__dict__['find_clothes_absolute_path']
    original_resolver = p.ClothesService.find_clothes_absolute_path
    def resolve_part(obj):
        path = paths_by_pointer.get(obj.as_pointer())
        return path if path is not None else original_resolver(obj)
    p.ClothesService.find_clothes_absolute_path = staticmethod(resolve_part)
    try:
        p.FaceService.interpolate_targets(body)
    finally:
        p.ClothesService.find_clothes_absolute_path = original_descriptor
    if set(p.shape_key_names(body)) != set(manifest['expressions']):
        raise ValueError('Body expression source mismatch')
    gaze = {f'eyeLook{direction}{side}' for direction in ['Up', 'Down', 'In', 'Out']
            for side in ['Left', 'Right']}
    for obj, path, _ in parts:
        keys = set(p.shape_key_names(obj))
        required = gaze if Path(path).name == 'high-poly.mhclo' else (
            {'jawOpen'} if Path(path).name in ['teeth_base.mhclo', 'tongue01.mhclo'] else
            {'eyeBlinkLeft', 'eyeBlinkRight'} if Path(path).name == 'eyelashes01.mhclo' else set())
        if not required.issubset(keys):
            raise ValueError(f'Missing part motion: {obj.name}: {required-keys}')
    rig = p.HumanService.add_builtin_rig(body, 'game_engine')
    p.bind_mhclo_parts_to_rig(body, rig, parts)
    p.bake_for_export(body)
    eye = p.find_eye_object(parts, 'high-poly.mhclo')
    cornea = p.split_cornea_shell(eye)
    if cornea is None:
        raise ValueError('Missing separate cornea')
    parts.append((cornea, '', 'OPAQUE'))
    p.force_alpha_modes(body, parts)
    hierarchy = p.collect_figure_hierarchy(body)
    p.bake_macro_shape_keys_on_hierarchy(hierarchy)
    meshes = []
    for obj in hierarchy:
        if obj.type != 'MESH':
            continue
        if not all(math.isfinite(c) for v in obj.data.vertices for c in v.co):
            raise ValueError('Nonfinite mesh')
        weighted = p.count_weighted_vertices(obj, rig)
        if weighted != len(obj.data.vertices):
            raise ValueError('Unweighted vertices: ' + obj.name)
        meshes.append({'name': obj.name, 'vertices': len(obj.data.vertices),
                       'weighted': weighted,
                       'keys': p.shape_key_names(obj)})
    args = SimpleNamespace(keep_morph_normals=False, rig='game_engine', hide_mask_attribute=False, foundation=[])
    p.export_glb(hierarchy, str(OUT / 'candidate.glb'), args)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'candidate.blend'))
    outputs = {name: {'bytes': (OUT/name).stat().st_size, 'sha256': digest(OUT/name)}
               for name in ['candidate.glb', 'candidate.blend']}
    report = {'blender': bpy.app.version_string, 'seconds': time.monotonic()-started,
              'preflightSha256': digest(OUT/'preflight.json'), 'maxIdentityDifferenceMetres': worst,
              'meshes': meshes, 'outputs': outputs,
              'limits': 'Source/geometry/export checks only; seating, blink, gaze, likeness and finish require actual images.'}
    (OUT / 'build-result.json').write_text(json.dumps(report, indent=2)+'\n')
    print('EMBER_EYE_BRIDGE_RESULT=' + json.dumps(outputs))


if __name__ == '__main__':
    if '--preflight' in sys.argv:
        preflight()
    elif '--run-admitted-eye-bridge-v001' in sys.argv:
        run()
    else:
        raise SystemExit('Explicit preflight or admitted-run flag required')
