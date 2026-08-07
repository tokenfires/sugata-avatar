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
ClothesService = dynamic_import("mpfb.services.clothesservice", "ClothesService")
Mhclo = dynamic_import("mpfb.entities.clothes.mhclo", "Mhclo")
HumanObjectProperties = dynamic_import("mpfb.entities.objectproperties", "HumanObjectProperties")
ARKIT_FACEUNITS = dynamic_import("mpfb.services.faceservice", "ARKIT_FACEUNITS")
META_VISEMES = dynamic_import("mpfb.services.faceservice", "META_VISEMES")

# The face needs eyes, teeth and a tongue as real geometry — a talking head without them
# reads as a mask. Each entry is (asset subdirectory, mhclo filename, MPFB asset type, alpha mode).
#
# The alpha mode is the glTF one the part must export with. Brows and lashes are flat cards whose
# silhouette lives entirely in the texture's alpha channel, so they need a cutout. Everything else
# is closed, solid geometry that must write depth — see force_alpha_mode for why that matters.
FACE_PART_ASSETS = [
    ("eyes", "low-poly.mhclo", "Eyes", "OPAQUE"),
    ("teeth", "teeth_base.mhclo", "Teeth", "OPAQUE"),
    ("tongue", "tongue01.mhclo", "Tongue", "OPAQUE"),
    ("eyebrows", "eyebrow001.mhclo", "Eyebrows", "MASK"),
    ("eyelashes", "eyelashes01.mhclo", "Eyelashes", "MASK"),
]

# glTF's default alphaCutoff, and the value the runtime expects on a cutout material.
ALPHA_MASK_CUTOFF = 0.5

# Every face part sits inside the skull, so a vertex the weight interpolation missed belongs to
# the head and nowhere else. Present in MPFB's game_engine rig.
FALLBACK_BONE_NAME = "head"


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
    """Adds eyes, teeth, tongue, brows and lashes from the makehuman_system_assets pack.

    Returns a list of (part object, mhclo path, alpha mode) for the steps that follow, because
    both remaining jobs — binding each part to the rig and giving it the right alpha mode — need
    to know which asset a given Blender object came from.
    """
    if arguments.no_face_parts:
        print("Skipping face parts (--no-face-parts).")
        return []

    attached = []
    for asset_subdir, mhclo_filename, asset_type, alpha_mode in FACE_PART_ASSETS:
        asset_path = AssetService.find_asset_absolute_path(mhclo_filename, asset_subdir=asset_subdir)
        if asset_path is None:
            print(f"  MISSING {asset_type}: {mhclo_filename} "
                  "(install the makehuman_system_assets pack)")
            continue
        part_object = HumanService.add_mhclo_asset(asset_path, basemesh,
                                                   asset_type=asset_type,
                                                   material_type="GAMEENGINE")
        attached.append((part_object, asset_path, alpha_mode))
        print(f"  added {asset_type}: {mhclo_filename}")

    return attached


def bind_face_parts_to_rig(basemesh, rig, face_parts):
    """Gives every face part the armature modifier and bone weights it needs to export skinned.

    MPFB only rigs an mhclo asset if a skeleton already exists when the asset is added
    (HumanService.add_mhclo_asset), and this build deliberately adds the face parts first — see
    the ordering note in main(). Left alone the parts export with POSITION/NORMAL/TEXCOORD_0 and
    nothing else: they become plain child nodes of the skinned body, inherit its identity object
    transform, and stay behind the moment a bone moves. At a 14 degree head yaw the eyebrows sit
    over the temple and the eyeballs sink into the skull.

    Rigging them here, after the rig exists but before the helper geometry is stripped, is the
    same call MPFB makes when the asset is loaded onto an already-rigged figure. It has to happen
    before the strip, because the weights are interpolated through mhclo vertex correspondences
    that index the basemesh by vertex number.
    """
    for part_object, asset_path, _alpha_mode in face_parts:
        mhclo = Mhclo()
        mhclo.load(asset_path)

        ClothesService.set_up_rigging(basemesh, part_object, rig, mhclo, import_subrig=False)
        strays = bind_unweighted_vertices_to_fallback_bone(part_object, rig)

        weighted = count_weighted_vertices(part_object, rig)
        print(f"  rigged {part_object.name}: {weighted}/{len(part_object.data.vertices)} verts "
              f"weighted ({strays} rigidly bound to '{FALLBACK_BONE_NAME}')")


def bone_vertex_group_indices(mesh_object, rig):
    """Indices of the mesh's vertex groups that name a bone — the only ones a skin export reads."""
    bone_names = {bone.name for bone in rig.data.bones}
    return {group.index for group in mesh_object.vertex_groups if group.name in bone_names}


def count_weighted_vertices(mesh_object, rig):
    """How many vertices carry any deform weight at all."""
    bone_group_indices = bone_vertex_group_indices(mesh_object, rig)

    weighted = 0
    for vertex in mesh_object.data.vertices:
        for group in vertex.groups:
            if group.group in bone_group_indices and group.weight > 0.0:
                weighted += 1
                break

    return weighted


def bind_unweighted_vertices_to_fallback_bone(mesh_object, rig):
    """Rigidly binds any vertex the interpolation missed to the head bone.

    Interpolated weights come from whichever basemesh vertices the mhclo maps to, and a face part
    can map to helper geometry the rig never weighted. An unweighted vertex stays at the bind pose
    while the rest of the head turns, which tears the part in half. Every one of these parts lives
    inside the skull, so the head is where a stray belongs.
    """
    if FALLBACK_BONE_NAME not in rig.data.bones:
        raise SystemExit(
            f"Build failed: rig has no '{FALLBACK_BONE_NAME}' bone to bind stray vertices to.")

    bone_group_indices = bone_vertex_group_indices(mesh_object, rig)

    stray_indices = []
    for vertex in mesh_object.data.vertices:
        has_weight = any(group.group in bone_group_indices and group.weight > 0.0
                         for group in vertex.groups)
        if not has_weight:
            stray_indices.append(vertex.index)

    if not stray_indices:
        return 0

    fallback_group = mesh_object.vertex_groups.get(FALLBACK_BONE_NAME)
    if fallback_group is None:
        fallback_group = mesh_object.vertex_groups.new(name=FALLBACK_BONE_NAME)
    fallback_group.add(stray_indices, 1.0, "REPLACE")

    return len(stray_indices)


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


def force_alpha_modes(basemesh, face_parts):
    """Pins each material to the glTF alphaMode the part actually needs.

    MakeHuman ships an alpha channel on every diffuse texture and MPFB wires it into the shader's
    Alpha socket unconditionally. Blender's glTF exporter reads alphaMode straight off that socket
    — constant 1.0 exports OPAQUE, an alpha put through a threshold comparison exports MASK,
    anything else exports BLEND — so left alone every material on the figure exports BLEND,
    including the solid body. A blended material writes no depth, and without depth writes the
    teeth and tongue draw straight through closed lips and the eyeballs draw over the eyelids.

    Only the brows and lashes are genuinely cutouts. Everything else is closed geometry.
    """
    force_alpha_mode(basemesh, "OPAQUE")
    print(f"  {basemesh.name}: OPAQUE, backface culled")

    for part_object, _asset_path, alpha_mode in face_parts:
        force_alpha_mode(part_object, alpha_mode)
        sidedness = "backface culled" if alpha_mode == "OPAQUE" else "double sided"
        print(f"  {part_object.name}: {alpha_mode}, {sidedness}")


def force_alpha_mode(mesh_object, alpha_mode):
    """Rewrites every material on a mesh to export with the given alphaMode and sidedness.

    Cutout cards have to render from both sides — a lash card seen from behind is still a lash.
    Closed geometry is backface culled, which is what makes the body single-sided.
    """
    for material_slot in mesh_object.material_slots:
        material = material_slot.material
        if material is None or material.node_tree is None:
            continue

        material.use_backface_culling = alpha_mode == "OPAQUE"

        for node in material.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            if alpha_mode == "OPAQUE":
                make_alpha_socket_constant(material.node_tree, node.inputs["Alpha"])
            else:
                make_alpha_socket_thresholded(material.node_tree, node.inputs["Alpha"])


def make_alpha_socket_constant(node_tree, alpha_socket):
    """Disconnects the alpha map and pins alpha to 1.0, which the exporter reads as OPAQUE."""
    for link in list(alpha_socket.links):
        node_tree.links.remove(link)
    alpha_socket.default_value = 1.0


def make_alpha_socket_thresholded(node_tree, alpha_socket):
    """Puts the alpha through 'alpha > cutoff', the node shape the exporter reads as MASK.

    A socket with nothing feeding it has no cutout to preserve, so it becomes opaque instead —
    a MASK material driven by a constant alpha would be a lie in the file.
    """
    incoming = list(alpha_socket.links)
    if not incoming:
        make_alpha_socket_constant(node_tree, alpha_socket)
        return

    alpha_source_socket = incoming[0].from_socket
    node_tree.links.remove(incoming[0])

    threshold = node_tree.nodes.new("ShaderNodeMath")
    threshold.name = threshold.label = "AlphaClip"
    threshold.operation = "GREATER_THAN"
    threshold.inputs[1].default_value = ALPHA_MASK_CUTOFF

    node_tree.links.new(threshold.inputs[0], alpha_source_socket)
    node_tree.links.new(alpha_socket, threshold.outputs[0])


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

    # An unrigged build (--rig none) has nothing to skin to, so only hold the skinning bar up
    # when there is actually an armature in the export.
    figure_is_rigged = any(member.type == "ARMATURE" for member in hierarchy)

    unskinned = []
    print("exported objects:")
    for member in hierarchy:
        if member.type != "MESH":
            print(f"  {member.name} ({member.type})")
            continue

        skinned = any(modifier.type == "ARMATURE" for modifier in member.modifiers)
        if figure_is_rigged and not skinned:
            unskinned.append(member.name)

        print(f"  {member.name} ({member.type}) "
              f"{len(member.data.vertices):,} verts, {len(shape_key_names(member))} morphs, "
              f"{'skinned' if skinned else 'NOT SKINNED'}")

    if missing_arkit:
        print(f"MISSING ARKit   : {missing_arkit}")
    if missing_visemes:
        print(f"MISSING visemes : {missing_visemes}")
    if unskinned:
        print(f"NOT SKINNED     : {unskinned}")

    if missing_arkit or missing_visemes:
        raise SystemExit("Build failed: expected shape keys are absent from the exported mesh.")
    if unskinned:
        raise SystemExit("Build failed: some meshes carry no armature modifier and would export "
                         "unskinned, leaving the face behind when a bone moves.")


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
    face_parts = attach_face_parts(basemesh, arguments)

    # Expressions must be loaded before the rig. FaceService.interpolate_targets looks for the
    # face parts among the *direct* children of the figure's root, and adding the rig makes the
    # rig that root — at which point the eyes, teeth and tongue become grandchildren and are
    # silently skipped, leaving the teeth behind when the jaw opens.
    load_expression_shape_keys(basemesh, arguments)

    if arguments.rig != "none":
        rig = HumanService.add_builtin_rig(basemesh, arguments.rig)
        print(f"  added rig: {arguments.rig}")
        bind_face_parts_to_rig(basemesh, rig, face_parts)

    bake_for_export(basemesh)

    force_alpha_modes(basemesh, face_parts)

    hierarchy = collect_figure_hierarchy(basemesh)
    bake_macro_shape_keys_on_hierarchy(hierarchy)
    export_glb(hierarchy, output_path, arguments)
    describe_result(basemesh, hierarchy, output_path)


main()
