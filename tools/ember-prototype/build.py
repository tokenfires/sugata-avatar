"""Isolated MPFB facial study. No default assets, rig, expression or appearance pass.

Run inside the installed Blender with --python-exit-code 1. The outer caller supplies
a finite timeout. Only the chosen output directory and a local source cache are written.
"""
import argparse
import ast
import hashlib
import json
import sys
import time
import zipfile
from pathlib import Path
from types import SimpleNamespace, ModuleType

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/figure-pipeline'))
# The legacy entry point executes main() on import (tfx_export relies on it).
# Reuse its definitions privately without changing that existing behavior.
pipeline_path = ROOT / 'tools/figure-pipeline/build_figure.py'
tree = ast.parse(pipeline_path.read_text(), filename=str(pipeline_path))
last = tree.body[-1]
if not (isinstance(last, ast.Expr) and isinstance(last.value, ast.Call)
        and isinstance(last.value.func, ast.Name) and last.value.func.id == 'main'
        and not last.value.args and not last.value.keywords):
    raise RuntimeError('Pipeline entry point changed; inspect adapter before using it')
tree.body.pop()
pipeline = ModuleType('ember_figure_pipeline')
pipeline.__file__ = str(pipeline_path)
exec(compile(tree, str(pipeline_path), 'exec'), pipeline.__dict__)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--identity', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    identity_path = Path(args.identity).resolve()
    output = Path(args.output).resolve()
    output.relative_to(ROOT / 'docs/evidence/ember-2026-10-30')
    if output.exists() or output.with_suffix('.json').exists():
        raise RuntimeError('Preserve existing versions; choose a new output path')
    started = time.monotonic()
    identity = json.loads(identity_path.read_text())
    catalogue_path = ROOT / 'assets/identity/catalogue.json'
    catalogue = json.loads(catalogue_path.read_text())
    sliders = {s['id']: s for s in catalogue['sliders']}
    target_root = Path(pipeline.TargetService.__module__.replace('.', '/'))
    module = sys.modules[pipeline.TargetService.__module__]
    target_root = Path(module.__file__).parents[1] / 'data/targets'
    targets = []
    for slider_id, weight in identity['values'].items():
        slider = sliders[slider_id]
        if not -1 <= weight <= 1 or (slider['range'] == 'unipolar' and weight < 0):
            raise ValueError(slider_id)
        direction = 'positive' if weight >= 0 else 'negative'
        ends = [end for key, end in slider['ends'].items() if key.startswith(direction)]
        for end in ends:
            path = target_root / slider['region'] / (end['target'] + '.target.gz')
            if not path.is_file():
                raise FileNotFoundError(path)
            targets.append((path, abs(weight)))

    # Current Blender extension has an empty user asset directory. Reuse the original
    # cached CC0 archive in a private cache, without changing installed/default assets.
    archive = ROOT / 'tools/figure-pipeline/.cache/makehuman_system_assets_cc0.zip'
    source = ROOT / 'tools/figure-pipeline/.cache/ember-source'
    prefixes = ('eyes/', 'teeth/teeth_base/', 'tongue/tongue01/',
                'eyebrows/eyebrow001/', 'eyelashes/eyelashes01/',
                'skins/young_caucasian_female/')
    with zipfile.ZipFile(archive) as z:
        for member in z.infolist():
            if member.filename.startswith(prefixes) and not member.is_dir():
                dest = (source / member.filename).resolve()
                dest.relative_to(source.resolve())
                data = z.read(member)
                if dest.exists() and dest.read_bytes() != data:
                    raise RuntimeError('Source cache mismatch: ' + str(dest))
                if not dest.exists():
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(data)

    pipeline.clear_startup_scene()
    body = pipeline.HumanService.create_human(macro_detail_dict=identity['macro'])
    for path, weight in targets:
        pipeline.TargetService.load_target(body, str(path), weight=weight)
    # Bake all authored identity keys before fitting accessories. A static candidate
    # avoids exporting residual identity morph weights that a loader could reset.
    blocks = list(body.data.shape_keys.key_blocks)
    basis = blocks[0]
    positions = [v.co.copy() for v in basis.data]
    for block in blocks[1:]:
        if block.value:
            for i, v in enumerate(block.data):
                positions[i] += (v.co - basis.data[i].co) * block.value
    body.shape_key_clear()
    for v, position in zip(body.data.vertices, positions):
        v.co = position
    body.data.update()
    skin_path = source / 'skins/young_caucasian_female/young_caucasian_female.mhmat'
    pipeline.HumanService.set_character_skin(str(skin_path), body, skin_type='GAMEENGINE')
    face_parts = []
    for subdir, filename, asset_type, alpha_mode in pipeline.FACE_PART_ASSETS:
        paths = list((source / subdir).rglob(filename))
        if len(paths) != 1:
            raise RuntimeError('Expected exactly one source: ' + filename)
        part = pipeline.HumanService.add_mhclo_asset(
            str(paths[0]), body, asset_type=asset_type, material_type='GAMEENGINE')
        face_parts.append((part, str(paths[0]), alpha_mode))
    pipeline.bake_for_export(body)
    eye = pipeline.find_eye_object(face_parts, pipeline.EYE_ASSET_FILENAME)
    cornea = pipeline.split_cornea_shell(eye)
    if cornea is None:
        raise RuntimeError('Missing corneal shell')
    face_parts.append((cornea, '', 'OPAQUE'))
    pipeline.force_alpha_modes(body, face_parts)
    hierarchy = pipeline.collect_figure_hierarchy(body)
    bpy.context.view_layer.update()
    for obj in hierarchy:
        if obj.type == 'MESH':
            for v in obj.data.vertices:
                if not all(__import__('math').isfinite(x) for x in v.co):
                    raise RuntimeError('Non-finite geometry')
    export_args = SimpleNamespace(keep_morph_normals=False, rig='none',
                                  hide_mask_attribute=False, foundation=[])
    output.parent.mkdir(parents=True, exist_ok=True)
    pipeline.export_glb(hierarchy, str(output), export_args)
    report = {
        'identity': {'path': str(identity_path.relative_to(ROOT)), 'sha256': digest(identity_path)},
        'archive': {'path': str(archive.relative_to(ROOT)), 'sha256': digest(archive)},
        'pipeline': {'path': str(pipeline_path.relative_to(ROOT)), 'sha256': digest(pipeline_path)},
        'targetInputs': [{'path': str(p), 'weight': w, 'sha256': digest(p)} for p,w in targets],
        'output': {'path': str(output.relative_to(ROOT)), 'bytes': output.stat().st_size, 'sha256': digest(output)},
        'blender': bpy.app.version_string, 'seconds': time.monotonic() - started,
        'meshes': [{'name': o.name, 'vertices': len(o.data.vertices), 'faces': len(o.data.polygons)}
                   for o in hierarchy if o.type == 'MESH'],
        'limits': 'Static unrigged facial candidate only. No hair, expression, likeness or finish qualification.'
    }
    output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
    print('EMBER_BUILD_RESULT=' + json.dumps(report['output']))


if __name__ == '__main__':
    main()
