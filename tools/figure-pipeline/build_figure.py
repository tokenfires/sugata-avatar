"""Builds one Sugata figure GLB from MPFB2, headlessly.

The workflow this serves: bake a character at a fixed point on the gender axis, load the 52
canonical ARKit face units and the 15 Meta (OVR) visemes onto it as shape keys, strip the
MakeHuman helper geometry that the runtime has no use for, and export a glTF binary in which
every one of those shape keys survives *by name* — because the runtime addresses expressions
by ARKit name, not by index.

MPFB2 is GPLv3 and lives only here, at build time. The GLB it produces is CC0 (MPFB2
LICENSE.md section D) and is the only thing that ships.

Usage:

    blender --background --python build_figure.py -- \
        --gender 0.5 --output /path/to/figure_g050.glb

Run --help through the same '--' separator for the full option list.
"""

import argparse
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mpfb_bridge import dynamic_import

HumanService = dynamic_import("mpfb.services.humanservice", "HumanService")
TargetService = dynamic_import("mpfb.services.targetservice", "TargetService")
FaceService = dynamic_import("mpfb.services.faceservice", "FaceService")
ExportService = dynamic_import("mpfb.services.exportservice", "ExportService")
ObjectService = dynamic_import("mpfb.services.objectservice", "ObjectService")
AssetService = dynamic_import("mpfb.services.assetservice", "AssetService")
HumanObjectProperties = dynamic_import("mpfb.entities.objectproperties", "HumanObjectProperties")
ARKIT_FACEUNITS = dynamic_import("mpfb.services.faceservice", "ARKIT_FACEUNITS")
META_VISEMES = dynamic_import("mpfb.services.faceservice", "META_VISEMES")

# The face needs eyes, teeth and a tongue as real geometry — a talking head without them
# reads as a mask. Each entry is (asset subdirectory, mhclo filename, MPFB asset type).
FACE_PART_ASSETS = [
    ("eyes", "low-poly.mhclo", "Eyes"),
    ("teeth", "teeth_base.mhclo", "Teeth"),
    ("tongue", "tongue01.mhclo", "Tongue"),
    ("eyebrows", "eyebrow001.mhclo", "Eyebrows"),
    ("eyelashes", "eyelashes01.mhclo", "Eyelashes"),
]


def parse_arguments():
    """Reads the arguments Blender passes through after the '--' separator."""
    if "--" in sys.argv:
        script_arguments = sys.argv[sys.argv.index("--") + 1:]
    else:
        script_arguments = []

    parser = argparse.ArgumentParser(
        prog="build_figure.py",
        description="Build one MPFB2 figure GLB with ARKit face units and OVR visemes.")

    parser.add_argument("--gender", type=float, required=True,
                        help="MPFB gender macro. 0.0 fully female, 1.0 fully male, 0.5 androgynous.")
    parser.add_argument("--output", required=True,
                        help="Absolute path of the .glb to write.")
    parser.add_argument("--age", type=float, default=0.5)
    parser.add_argument("--muscle", type=float, default=0.5)
    parser.add_argument("--weight", type=float, default=0.5)
    parser.add_argument("--height", type=float, default=0.5)
    parser.add_argument("--proportions", type=float, default=0.5)
    parser.add_argument("--cupsize", type=float, default=0.5)
    parser.add_argument("--firmness", type=float, default=0.5)
    parser.add_argument("--rig", default="game_engine",
                        help="MPFB builtin rig name, or 'none' to export an unrigged mesh.")
    parser.add_argument("--skin", default="young_caucasian_female.mhmat",
                        help="mhmat filename from the system assets pack, or 'none'.")
    parser.add_argument("--no-face-parts", action="store_true",
                        help="Skip eyes, teeth, tongue, eyebrows and eyelashes.")
    parser.add_argument("--no-microsoft-visemes", action="store_true",
                        help="Skip the 22 Microsoft visemes. The 15 OVR ones are always loaded.")
    parser.add_argument("--keep-morph-normals", action="store_true",
                        help="Export per-morph normals. Roughly doubles file size.")

    return parser.parse_args(script_arguments)


def create_figure(arguments):
    """Creates the MPFB basemesh at the requested point on the macro axes."""
    macro_details = {
        "gender": arguments.gender,
        "age": arguments.age,
        "muscle": arguments.muscle,
        "weight": arguments.weight,
        "proportions": arguments.proportions,
        "height": arguments.height,
        "cupsize": arguments.cupsize,
        "firmness": arguments.firmness,
        "race": {"asian": 0.33, "caucasian": 0.33, "african": 0.33},
    }

    basemesh = HumanService.create_human(macro_detail_dict=macro_details)

    # create_human already applies the dict, but the macro shapes are the entire point of this
    # script, so set gender explicitly and reapply. Cheap, and it makes the intent legible.
    HumanObjectProperties.set_value("gender", arguments.gender, entity_reference=basemesh)
    TargetService.reapply_macro_details(basemesh)

    return basemesh


def attach_face_parts(basemesh, arguments):
    """Adds eyes, teeth, tongue, brows and lashes from the makehuman_system_assets pack."""
    if arguments.no_face_parts:
        print("Skipping face parts (--no-face-parts).")
        return

    for asset_subdir, mhclo_filename, asset_type in FACE_PART_ASSETS:
        asset_path = AssetService.find_asset_absolute_path(mhclo_filename, asset_subdir=asset_subdir)
        if asset_path is None:
            print(f"  MISSING {asset_type}: {mhclo_filename} "
                  "(install the makehuman_system_assets pack)")
            continue
        HumanService.add_mhclo_asset(asset_path, basemesh,
                                     asset_type=asset_type, material_type="GAMEENGINE")
        print(f"  added {asset_type}: {mhclo_filename}")


def apply_skin(basemesh, arguments):
    """Applies a single-Principled-BSDF skin, which is what a glTF consumer expects."""
    if arguments.skin == "none":
        print("Skipping skin (--skin none).")
        return

    skin_path = AssetService.find_asset_absolute_path(arguments.skin, asset_subdir="skins")
    if skin_path is None:
        print(f"  MISSING skin: {arguments.skin} (install the makehuman_system_assets pack)")
        return

    HumanService.set_character_skin(skin_path, basemesh, skin_type="GAMEENGINE")
    print(f"  applied skin: {arguments.skin}")


def load_expression_shape_keys(basemesh, arguments):
    """Loads the ARKit face units and visemes as named shape keys on the basemesh.

    MPFB names each shape key after its target file, so 'jawOpen.target' becomes a shape key
    literally called 'jawOpen'. That is the contract the runtime depends on.
    """
    FaceService.load_targets(
        basemesh,
        load_microsoft_visemes=not arguments.no_microsoft_visemes,
        load_meta_visemes=True,
        load_arkit_faceunits=True)

    # Push the same shape keys onto eyes / teeth / tongue so the tongue moves with tongueOut
    # and the eyelids do not shear away from the eyeballs.
    FaceService.interpolate_targets(basemesh)


def bake_macro_shape_keys(mesh_object):
    """Folds MPFB's macro shape keys into the geometry, then deletes them.

    MPFB expresses gender / age / muscle as live shape keys named "macrodetail-..." held at
    non-zero weights. Exported as-is they would become eight junk morph targets, and the GLB's
    neutral pose would be the genderless base mesh rather than the figure we asked for. The
    whole point of baking discrete figures is that the identity lives in the vertices.

    Blender shape keys store absolute positions, so adding the same displacement to the Basis
    and to every expression key leaves each expression's relative offset untouched.
    """
    shape_keys = mesh_object.data.shape_keys
    if shape_keys is None:
        return 0

    key_blocks = shape_keys.key_blocks
    basis = key_blocks[0]

    macro_blocks = []
    for block in key_blocks:
        decoded_name = TargetService.decode_shapekey_name(block.name)
        if decoded_name.startswith("macrodetail-"):
            macro_blocks.append(block)

    if not macro_blocks:
        return 0

    vertex_count = len(mesh_object.data.vertices)
    displacement = [Vector((0.0, 0.0, 0.0)) for _ in range(vertex_count)]

    for block in macro_blocks:
        weight = block.value
        if weight == 0.0:
            continue
        for index in range(vertex_count):
            displacement[index] += (block.data[index].co - basis.data[index].co) * weight

    keys_to_keep = [block for block in key_blocks if block not in macro_blocks]
    for block in keys_to_keep:
        for index in range(vertex_count):
            block.data[index].co += displacement[index]

    # The mesh's own vertex positions are what a consumer sees with all morphs at zero, so they
    # have to move with the Basis.
    for index in range(vertex_count):
        mesh_object.data.vertices[index].co += displacement[index]

    for block in macro_blocks:
        mesh_object.shape_key_remove(block)

    return len(macro_blocks)


def collect_figure_hierarchy(basemesh):
    """Returns every object belonging to the figure: the rig, the basemesh and all face parts.

    MPFB parents the basemesh to the rig and the face parts to the basemesh, so the figure is
    two levels deep. Walking it here rather than asking for direct children is what keeps the
    eyes, teeth and tongue in the export.
    """
    root = basemesh.parent if basemesh.parent else basemesh

    hierarchy = [root]
    frontier = [root]
    while frontier:
        parent = frontier.pop()
        for candidate in bpy.data.objects:
            if candidate.parent is parent:
                hierarchy.append(candidate)
                frontier.append(candidate)

    return hierarchy


def bake_macro_shape_keys_on_hierarchy(hierarchy):
    """Applies the macro bake to every mesh in the figure that carries macro shape keys."""
    for candidate in hierarchy:
        if candidate.type != "MESH":
            continue
        baked = bake_macro_shape_keys(candidate)
        if baked:
            print(f"  baked {baked} macro shape keys into {candidate.name}")


def bake_for_export(basemesh):
    """Bakes modifiers and strips helper geometry from the basemesh.

    Helper geometry is MakeHuman's invisible scaffolding for fitting clothes and joints. The
    runtime has no use for it and it accounts for roughly a third of the vertices. ExportService
    bakes the 'Hide helpers' mask modifier through _apply_modifiers_keep_shapekeys, which
    reconstructs every shape key on the reduced mesh — the usual place a naive bake destroys them.

    This mutates the figure in place rather than going through ExportService.create_character_copy.
    The copy only duplicates direct children, which would silently drop the face parts, and a
    headless one-shot build has no original worth preserving.
    """
    ExportService.bake_modifiers_remove_helpers(
        basemesh,
        bake_masks=True,
        bake_subdiv=False,
        remove_helpers=True,
        also_proxy=True)


def export_glb(hierarchy, output_path, arguments):
    """Writes the GLB with morph targets and their names intact."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    for member in hierarchy:
        member.select_set(True)
    bpy.context.view_layer.objects.active = hierarchy[0]

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,            # applying modifiers here would destroy the shape keys
        export_morph=True,
        export_morph_normal=arguments.keep_morph_normals,
        export_morph_tangent=False,
        export_morph_animation=False,
        export_morph_reset_sk_data=True,   # ship the figure at neutral, not at whatever was set
        export_try_sparse_sk=True,         # face units touch a few thousand of 13.7k verts
        export_extras=True,                # carries mesh 'targetNames' through to the loader
        export_skins=arguments.rig != "none",
        export_animations=False,
        export_yup=True)


def shape_key_names(mesh_object):
    """Morph target names on a mesh. 'Basis' is the rest shape, not a morph, so it is dropped."""
    shape_keys = mesh_object.data.shape_keys
    if shape_keys is None:
        return []
    return [block.name for block in shape_keys.key_blocks if block.name != "Basis"]


def describe_result(basemesh, hierarchy, output_path):
    """Prints what actually ended up in the file, so a failed bake cannot pass silently."""
    morph_names = shape_key_names(basemesh)

    missing_arkit = [name for name in ARKIT_FACEUNITS if name not in morph_names]
    missing_visemes = [name for name in META_VISEMES if name not in morph_names]

    print("")
    print("=== build result ===")
    print(f"file            : {output_path}")
    print(f"file size       : {os.path.getsize(output_path):,} bytes")
    print(f"basemesh verts  : {len(basemesh.data.vertices):,}")
    print(f"basemesh polys  : {len(basemesh.data.polygons):,}")
    print(f"shape keys      : {len(morph_names)} (excluding Basis)")
    print(f"ARKit present   : {52 - len(missing_arkit)} / 52")
    print(f"OVR visemes     : {15 - len(missing_visemes)} / 15")

    print("exported objects:")
    for member in hierarchy:
        if member.type == "MESH":
            print(f"  {member.name} ({member.type}) "
                  f"{len(member.data.vertices):,} verts, {len(shape_key_names(member))} morphs")
        else:
            print(f"  {member.name} ({member.type})")

    if missing_arkit:
        print(f"MISSING ARKit   : {missing_arkit}")
    if missing_visemes:
        print(f"MISSING visemes : {missing_visemes}")

    if missing_arkit or missing_visemes:
        raise SystemExit("Build failed: expected shape keys are absent from the exported mesh.")


def clear_startup_scene():
    """Removes Blender's default cube, camera and light so only the figure can be exported."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def main():
    arguments = parse_arguments()
    output_path = os.path.abspath(arguments.output)

    print(f"Building figure at gender={arguments.gender} -> {output_path}")

    clear_startup_scene()

    basemesh = create_figure(arguments)
    apply_skin(basemesh, arguments)
    attach_face_parts(basemesh, arguments)

    # Expressions must be loaded before the rig. FaceService.interpolate_targets looks for the
    # face parts among the *direct* children of the figure's root, and adding the rig makes the
    # rig that root — at which point the eyes, teeth and tongue become grandchildren and are
    # silently skipped, leaving the teeth behind when the jaw opens.
    load_expression_shape_keys(basemesh, arguments)

    if arguments.rig != "none":
        HumanService.add_builtin_rig(basemesh, arguments.rig)
        print(f"  added rig: {arguments.rig}")

    bake_for_export(basemesh)

    hierarchy = collect_figure_hierarchy(basemesh)
    bake_macro_shape_keys_on_hierarchy(hierarchy)
    export_glb(hierarchy, output_path, arguments)
    describe_result(basemesh, hierarchy, output_path)


main()
