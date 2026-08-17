"""Headless MPFB probe: build the pipeline's g050 basemesh, dump vertex arrays with and
without a named set of identity detail targets applied.

Usage:
  blender --background --python probe.py -- --out DIR [--target rel=weight ...] [--label NAME]

Dumps <label>.f64 (N*3 little-endian float64, Blender Z-up, object space) and <label>.json.
"""
import argparse, json, os, struct, sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "figure-pipeline"))
from mpfb_bridge import dynamic_import

HumanService = dynamic_import("mpfb.services.humanservice", "HumanService")
TargetService = dynamic_import("mpfb.services.targetservice", "TargetService")
HumanObjectProperties = dynamic_import("mpfb.entities.objectproperties", "HumanObjectProperties")
GeneralObjectProperties = dynamic_import("mpfb.entities.objectproperties", "GeneralObjectProperties")
LocationService = dynamic_import("mpfb.services.locationservice", "LocationService")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--label", default="dump")
    p.add_argument("--target", action="append", default=[])
    p.add_argument("--gender", type=float, default=0.5)
    p.add_argument("--age", type=float, default=0.5)
    p.add_argument("--muscle", type=float, default=0.5)
    p.add_argument("--weight", type=float, default=0.5)
    p.add_argument("--proportions", type=float, default=0.5)
    p.add_argument("--height", type=float, default=0.5)
    p.add_argument("--cupsize", type=float, default=0.5)
    p.add_argument("--firmness", type=float, default=0.5)
    return p.parse_args(argv)


def evaluated_coords(obj):
    """Blender's own evaluation of the shape-key stack, on ALL basemesh vertices.

    mask_helpers=True leaves a MASK modifier on the basemesh that hides the helper geometry, so
    a naive depsgraph evaluation returns 13,380 of the 19,158 vertices. The helpers are exactly
    what 10.7 and 10.9 need, so every modifier is switched off for the dump and switched back.
    """
    states = [(m, m.show_viewport) for m in obj.modifiers]
    for m, _ in states:
        m.show_viewport = False
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(depsgraph).to_mesh()
    coords = [tuple(v.co) for v in mesh.vertices]
    obj.evaluated_get(depsgraph).to_mesh_clear()
    for m, was in states:
        m.show_viewport = was
    return coords


def basis_coords(obj):
    """The unmodified base mesh at this scale, before any shape key."""
    if obj.data.shape_keys:
        return [tuple(d.co) for d in obj.data.shape_keys.key_blocks[0].data]
    return [tuple(v.co) for v in obj.data.vertices]


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)

    macro = {"gender": args.gender, "age": args.age, "muscle": args.muscle,
             "weight": args.weight, "proportions": args.proportions, "height": args.height,
             "cupsize": args.cupsize, "firmness": args.firmness,
             "race": {"asian": 0.33, "caucasian": 0.33, "african": 0.33}}

    basemesh = HumanService.create_human(macro_detail_dict=macro)
    HumanObjectProperties.set_value("gender", args.gender, entity_reference=basemesh)
    TargetService.reapply_macro_details(basemesh)

    scale_factor = GeneralObjectProperties.get_value("scale_factor", entity_reference=basemesh)

    # The macro stack MPFB itself computed, so the JS solver can be diffed against it.
    macro_stack = TargetService.calculate_target_stack_from_macro_info_dict(
        TargetService.get_macro_info_dict_from_basemesh(basemesh))

    targets_dir = LocationService.get_mpfb_data("targets")
    applied = []
    for spec in args.target:
        rel, _, w = spec.partition("=")
        weight = float(w) if w else 1.0
        path = os.path.join(targets_dir, rel + ".target.gz")
        if not os.path.exists(path):
            path = os.path.join(targets_dir, rel + ".target")
        TargetService.load_target(basemesh, path, weight=weight, name=os.path.basename(rel))
        applied.append([rel, weight])

    coords = evaluated_coords(basemesh)
    basis = basis_coords(basemesh)

    def dump(name, rows):
        with open(os.path.join(args.out, name + ".f64"), "wb") as fh:
            fh.write(struct.pack("<%dd" % (len(rows) * 3), *[c for v in rows for c in v]))

    dump(args.label, coords)
    dump(args.label + "_basis", basis)

    meta = {
        "label": args.label,
        "vertexCount": len(coords),
        "basisVertexCount": len(basis),
        "modifiers": [m.name + ":" + m.type for m in basemesh.modifiers],
        "scaleFactor": scale_factor,
        "macro": {k: v for k, v in macro.items()},
        "macroStack": macro_stack,
        "appliedTargets": applied,
        "shapeKeyNames": [k.name for k in basemesh.data.shape_keys.key_blocks] if basemesh.data.shape_keys else [],
        "boundsZ": [min(c[2] for c in coords), max(c[2] for c in coords)],
    }
    with open(os.path.join(args.out, args.label + ".json"), "w") as fh:
        json.dump(meta, fh, indent=1)

    print("PROBE OK", args.label, len(coords), "verts, scale_factor", scale_factor)


main()
