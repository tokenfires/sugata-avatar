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

## Clothing (punch-list 9.2)

    blender --background --python build_figure.py -- \
        --gender 0.5 --output body_g050.glb \
        --garment female_casualsuit01 --garment shoes01 \
        --hide-mask-attribute --garment-fragment-dir assets/wardrobe

`--garment` attaches an MPFB CLOTHES asset through the same `add_mhclo_asset` +
`ClothesService.set_up_rigging` path the face parts already use — no new code path, and the
garment arrives fully skinned to the figure's own rig.

`--hide-mask-attribute` is what makes a wardrobe possible at all. Left alone, MPFB hides the body
under a garment with a `Delete.<asset>` vertex group behind a MASK modifier, and
`bake_modifiers_remove_helpers(bake_masks=True)` makes that deletion permanent. **A body whose
torso has been deleted cannot undress.** With this flag the same vertex set travels as a
per-vertex `_hide_<asset>` attribute instead, the MASK modifier is dropped, and the runtime
rebuilds the body's index buffer from the union of whichever masks are worn. That is
geometrically lossless: `docs/research/wardrobe-system.md` §2.4 measured the rebuilt body at
17,012 triangles against 17,012 for the baked build, at 0.1609 ms median over 30 runs.

`--garment-fragment-dir` writes each garment to its own small GLB — the fragment the runtime
fetches on demand — and leaves it out of the body GLB. §3.5 of the research chose fragments over
one atlas GLB because textures are 81–87% of a clothed figure and VRAM is the binding constraint.
"""

import argparse
import json
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
#
# The eyeball proxy is 'high-poly', not the 'low-poly' one MakeHuman lists first. That is not a
# fidelity preference, it is a geometry requirement: docs/research/eyes-and-lighting.md §1 states
# that cornea refraction needs "a distinct dome at the front to represent the cornea", and the
# low-poly proxy has none. Measured on the built figure, low-poly against high-poly:
#
#   low-poly   48 verts/eye, one shell.   Front radius minus equator radius:  0.051 mm.
#   high-poly 532 verts/eye, two shells.  Same measurement on the outer shell: 0.494 mm,
#                                         and the front sits 0.688 mm proud of a sphere fitted
#                                         to the sclera alone (that fit's own RMS is 0.202 mm).
#
# The low-poly figure is a sphere with a flat facet where the pupil goes. See split_cornea_shell.
FACE_PART_ASSETS = [
    ("eyes", "high-poly.mhclo", "Eyes", "OPAQUE"),
    ("teeth", "teeth_base.mhclo", "Teeth", "OPAQUE"),
    ("tongue", "tongue01.mhclo", "Tongue", "OPAQUE"),
    ("eyebrows", "eyebrow001.mhclo", "Eyebrows", "MASK"),
    ("eyelashes", "eyelashes01.mhclo", "Eyelashes", "MASK"),
]

# Which entry above is the eyeballs. The corneal split needs to find that one object again after
# the whole list has been attached, and matching on the filename keeps the two in step.
EYE_ASSET_FILENAME = "high-poly.mhclo"

# What the two halves of the split eyeball are called. GLTFLoader strips the dot, so the runtime
# sees 'Humanhigh-poly' (the globe: sclera, iris, pupil) and 'Humancornea' (the clear shell).
GLOBE_OBJECT_NAME = "Human.high-poly"
GLOBE_MESH_NAME = "high-poly"
CORNEA_OBJECT_NAME = "Human.cornea"
CORNEA_MESH_NAME = "cornea"
CORNEA_MATERIAL_NAME = "Human.cornea"

# HDRP's CORNEA_IOR, quoted from docs/research/eyes-and-lighting.md §1, which gives the usable
# range as 1.333–1.336 and HDRP's own default as 1.3333.
CORNEA_IOR = 1.3333

# docs/research/eyes-and-lighting.md §6 puts sclera roughness at 0.0–0.1, and the cornea is the
# wet surface the specular highlight actually comes off, so it is the smoothest thing on the figure.
CORNEA_ROUGHNESS = 0.0

# Telling the two shells apart relies on one enclosing the other. This is the margin, as a fraction
# of mean radius, below which "which one is outside" is not a safe call and the build should stop
# rather than guess: a silently inverted split would put the opaque globe on the refractive material
# and hide the iris behind it. Measured on figure_g050 the margin is 0.122, so 0.03 leaves four
# times the observed headroom while still failing loudly if MakeHuman reshapes the asset.
MINIMUM_SHELL_SEPARATION_FRACTION = 0.03

# glTF's default alphaCutoff, and the value the runtime expects on a cutout material.
ALPHA_MASK_CUTOFF = 0.5

# Every face part sits inside the skull, so a vertex the weight interpolation missed belongs to
# the head and nowhere else. Present in MPFB's game_engine rig.
FALLBACK_BONE_NAME = "head"

# Where MPFB keeps CLOTHES assets, and the vertex group it names the hidden body region after.
# `update_delete_group` (clothesservice.py:295) creates 'Delete.<assetname>' and hangs an inverted
# MASK modifier off it; both are named this way and both are found by this prefix.
GARMENT_ASSET_SUBDIR = "clothes"
DELETE_GROUP_PREFIX = "Delete."

# The per-vertex attribute a garment's hidden body region travels as when --hide-mask-attribute is
# on. 1.0 means "this body vertex is under the garment and must not be drawn while it is worn".
#
# 🚩 Blender's glTF exporter UPPER-CASES a custom attribute name: authored '_hide_shoes01', the
# file carries '_HIDE_SHOES01'. Verified on the built GLB, not read off a wiki. Every consumer —
# GarmentManifest.js, Wardrobe.js and verify_glb.mjs — matches case-insensitively for that reason.
#
# 🚩 And the exporter's `export_attributes` DEFAULTS OFF, which is the quiet half: the first build
# of this path exported cleanly, reported success, and carried no attribute at all. `export_glb`
# passes it explicitly, and `describe_hide_masks` reads the written file back rather than trusting
# the export call, because a silent drop here is invisible until the runtime has nothing to hide.
HIDE_MASK_ATTRIBUTE_PREFIX = "_hide_"

# A garment fragment is a garment mesh plus the rig it is skinned to, and nothing else. The
# filename is the point on the gender axis, because a fragment CANNOT be shared across the five
# figures — `female_casualsuit01` drifts mean 95.145 mm / max 143.066 mm between g000 and g100
# (research §3.3), and cross-fitting puts 84.4% of the covered skin outside the cloth.
GARMENT_FRAGMENT_FILENAME = "g{:03d}.glb"

# The manifest the build reads a garment's alphaMode from, relative to the repo root two levels up.
DEFAULT_WARDROBE_MANIFEST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "assets", "wardrobe", "manifest.json")


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
    parser.add_argument("--eye-proxy", default=EYE_ASSET_FILENAME,
                        choices=["high-poly.mhclo", "low-poly.mhclo"],
                        help="Eyeball proxy. 'high-poly.mhclo' is what ships: two shells per eye "
                             "with a corneal dome. 'low-poly.mhclo' is the superseded single "
                             "sphere, kept buildable so the asset gate can be run against a "
                             "known-bad figure and shown to fail.")
    parser.add_argument("--no-microsoft-visemes", action="store_true",
                        help="Skip the 22 Microsoft visemes. The 15 OVR ones are always loaded.")
    parser.add_argument("--keep-morph-normals", action="store_true",
                        help="Export per-morph normals. Roughly doubles file size.")
    parser.add_argument("--garment", action="append", default=[], metavar="ID",
                        help="MPFB clothes asset id, e.g. 'female_casualsuit01'. Repeatable.")
    parser.add_argument("--hide-mask-attribute", action="store_true",
                        help="Carry each garment's hidden body region as a per-vertex "
                             "'_hide_<id>' attribute instead of baking the MASK modifier. The "
                             "body keeps all its geometry and the runtime rebuilds the index "
                             "buffer, which is what lets the figure undress.")
    parser.add_argument("--garment-fragment-dir", default=None, metavar="DIR",
                        help="Write each garment to DIR/<id>/g<NNN>.glb as a standalone fragment "
                             "and leave it out of the body GLB.")
    parser.add_argument("--wardrobe-manifest", default=DEFAULT_WARDROBE_MANIFEST,
                        help="Garment manifest the build reads alphaMode from. One authority for "
                             "the build, the runtime and the asset gate.")

    return parser.parse_args(script_arguments)


def read_wardrobe_manifest(manifest_path, garment_ids):
    """alphaMode per garment id, read from the wardrobe manifest.

    The build does NOT decide a garment's alpha mode from its name. `verify_glb.mjs` reads the
    same field out of the same file, so a garment whose manifest entry says MASK and whose GLB
    says OPAQUE is a gate failure rather than two files quietly disagreeing — which is exactly the
    hole the five-regex whitelist left (research §3.7).

    An unlisted garment stops the build. A garment nothing describes cannot be dressed, layered or
    verified, so shipping one is worse than not building it.
    """
    if not garment_ids:
        return {}

    if not os.path.exists(manifest_path):
        raise SystemExit(f"Build failed: no wardrobe manifest at {manifest_path}, and "
                         f"--garment was given for {garment_ids}.")

    with open(manifest_path, encoding="utf-8") as handle:
        manifest = json.load(handle)

    by_id = {entry["id"]: entry for entry in manifest.get("garments", [])}

    unlisted = [garment_id for garment_id in garment_ids if garment_id not in by_id]
    if unlisted:
        raise SystemExit(f"Build failed: {unlisted} are not in {manifest_path}. Add a manifest "
                         "entry — id, layer, alphaMode, clo, fabric, formality, palette — first.")

    return {garment_id: by_id[garment_id]["alphaMode"] for garment_id in garment_ids}


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
        if asset_type == "Eyes":
            mhclo_filename = arguments.eye_proxy
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


def bind_mhclo_parts_to_rig(basemesh, rig, parts):
    """Gives every mhclo part the armature modifier and bone weights it needs to export skinned.

    Face parts and garments arrive by the same route and are rigged by the same call. Measured on
    `female_casualsuit01`: 2,197 of 2,197 garment vertices weighted, 0 strays
    (`docs/research/wardrobe-system.md` §1.1).

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
    for part_object, asset_path, _alpha_mode in parts:
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


def attach_garments(basemesh, arguments):
    """Adds each --garment as an MPFB CLOTHES asset, through the existing mhclo path.

    Returns the same (object, mhclo path, alpha mode) shape the face parts use, so the rigging and
    alpha passes can treat a garment and an eyebrow identically.

    Two ordering facts this depends on, both load-bearing:

      * Garments are attached AFTER the expression shape keys are loaded. `interpolate_targets`
        pushes all 89 morphs onto the figure's direct children, and a jacket has no use for
        `viseme_kk` — attaching later keeps the fragment small and its morph list empty.
      * They are attached BEFORE the rig, like the face parts, because `set_up_rigging` needs the
        mhclo's vertex correspondences into the basemesh and those are read before the helper
        strip.

    Alpha mode is deliberately not decided here. `assets/wardrobe/manifest.json` owns it — a wool
    coat is OPAQUE and a mesh panel is MASK, and that is a property of the garment, not of a
    filename pattern. The value is looked up per garment at export time by `garment_alpha_mode`.
    """
    attached = []
    for garment_id in arguments.garment:
        asset_path = AssetService.find_asset_absolute_path(
            f"{garment_id}.mhclo", asset_subdir=GARMENT_ASSET_SUBDIR)
        if asset_path is None:
            raise SystemExit(
                f"Build failed: no clothes asset '{garment_id}.mhclo' under the MPFB "
                f"'{GARMENT_ASSET_SUBDIR}' data directory.")

        garment_object = HumanService.add_mhclo_asset(asset_path, basemesh,
                                                      asset_type="Clothes",
                                                      material_type="GAMEENGINE")
        attached.append((garment_object, asset_path, garment_id))
        print(f"  added garment: {garment_id} ({len(garment_object.data.vertices):,} verts)")

    return attached


def hide_mask_attribute_name(garment_id):
    """The per-vertex attribute a garment's hidden body region travels under."""
    return f"{HIDE_MASK_ATTRIBUTE_PREFIX}{garment_id}"


def write_hide_mask_attributes(basemesh, garments):
    """Turns each 'Delete.<id>' vertex group into a per-vertex attribute and drops its modifier.

    This is the whole of punch-list 9.2. MPFB's `update_delete_group` does not delete anything by
    itself — it makes a vertex group and an inverted MASK modifier, and the destruction happens
    later, at `bake_modifiers_remove_helpers(bake_masks=True)`. So the deletion is ours, at one
    line, and it is optional.

    Written BEFORE the bake on purpose: Blender remaps a mesh attribute through the helper strip
    exactly as it remaps positions, so the flags stay on the right vertices without this code
    knowing anything about which vertices the strip removes.

    Returns [(garment id, attribute name, flagged vertex count)].
    """
    written = []

    for _garment_object, _asset_path, garment_id in garments:
        group = basemesh.vertex_groups.get(f"{DELETE_GROUP_PREFIX}{garment_id}")

        # A hat hides nothing — `fedora01` ships no delete_verts at all — so an absent group is a
        # legitimate garment, not a failure. It gets no attribute and the manifest records no mask.
        if group is None:
            print(f"  {garment_id}: no delete group, nothing to hide")
            continue

        flagged = [vertex.index for vertex in basemesh.data.vertices
                   if any(entry.group == group.index for entry in vertex.groups)]

        attribute_name = hide_mask_attribute_name(garment_id)
        attribute = basemesh.data.attributes.new(attribute_name, "FLOAT", "POINT")
        for index in flagged:
            attribute.data[index].value = 1.0

        remove_mask_modifier(basemesh, f"{DELETE_GROUP_PREFIX}{garment_id}")

        written.append((garment_id, attribute_name, len(flagged)))
        print(f"  {garment_id}: {len(flagged):,} body verts flagged as {attribute_name}, "
              "MASK modifier removed")

    return written


def remove_mask_modifier(mesh_object, modifier_name):
    """Drops the MASK modifier that would otherwise bake the hidden region away permanently."""
    modifier = mesh_object.modifiers.get(modifier_name)
    if modifier is not None:
        mesh_object.modifiers.remove(modifier)


def describe_hide_masks(basemesh, expected_attribute_names):
    """Fails the build if a hide-mask attribute did not survive to the exported mesh.

    🚩 This exists because the failure it catches is silent. Blender's glTF exporter drops custom
    attributes unless `export_attributes=True`, and the build still reports success: the first run
    of this path wrote `POSITION,NORMAL,TEXCOORD_0,JOINTS_0,WEIGHTS_0` and nothing else, printed a
    clean summary, and produced a figure that could never undress.
    """
    present = {name.lower() for name in basemesh.data.attributes.keys()}
    missing = [name for name in expected_attribute_names if name.lower() not in present]

    if missing:
        raise SystemExit(
            f"Build failed: hide-mask attributes {missing} are not on the baked basemesh. They "
            "were written before the bake, so the helper strip dropped them.")


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


def find_eye_object(face_parts, eye_proxy):
    """The Blender object the eyeball proxy became, or None if face parts were skipped."""
    for part_object, asset_path, _alpha_mode in face_parts:
        if os.path.basename(asset_path) == eye_proxy:
            return part_object
    return None


def split_cornea_shell(eye_object):
    """Moves the clear corneal shells onto their own object and their own refractive material.

    The workflow this serves: the runtime needs the cornea as a surface it can shade separately
    from the globe, because that is where the specular highlight, the refraction and the catchlight
    live (docs/research/eyes-and-lighting.md §1 and §6). MakeHuman ships them as one object.

    Left unsplit the cornea is worse than useless. MakeHuman keeps its UV island at alpha 0 in
    brown_eye.png — measured mean alpha 21/255 over the island, against 255/255 over the iris
    island — and force_alpha_modes pins every OPAQUE part's alpha to a constant 1.0. The clear
    shell would export as an opaque dome covering the iris.

    Returns the new cornea object.
    """
    mesh = eye_object.data
    islands = connected_vertex_islands(mesh)

    if len(islands) == 2:
        print(f"  no corneal split: {eye_object.name} is a single shell per eye. This is the "
              "superseded low-poly proxy and it has no cornea to separate.")
        return None

    if len(islands) != 4:
        raise SystemExit(
            f"Build failed: expected 4 shells in {eye_object.name} (two per eye), found "
            f"{len(islands)}. The eyeball proxy is no longer the two-shell one this step assumes.")

    outer_vertices = set()
    for pair in pair_islands_into_eyes(mesh, islands):
        outer_vertices.update(outer_shell_of(mesh, pair))

    cornea_material = build_cornea_material()
    mesh.materials.append(cornea_material)
    cornea_slot = len(mesh.materials) - 1

    moved = 0
    for polygon in mesh.polygons:
        if all(vertex in outer_vertices for vertex in polygon.vertices):
            polygon.material_index = cornea_slot
            moved += 1

    if moved == 0:
        raise SystemExit("Build failed: no polygon lies entirely on an outer shell, so the "
                         "corneal split would produce an empty material.")

    keys_before = set(shape_key_names(eye_object))
    globe_object, cornea_object = separate_by_material(eye_object, cornea_material)

    # The separation is only useful if the gaze morphs survive it on both halves. Blender rebuilds
    # shape keys across a separate, but a silent loss here would leave the cornea welded to the
    # skull while the globe looks around, and nothing downstream measures the cornea's morphs
    # until the runtime is already rendering.
    for part in (globe_object, cornea_object):
        keys_after = set(shape_key_names(part))
        if keys_after != keys_before:
            raise SystemExit(
                f"Build failed: {part.name} came out of the corneal split with shape keys "
                f"{sorted(keys_after)}, expected {sorted(keys_before)}.")

    # Both halves are named explicitly. Blender decides for itself which half keeps the original
    # datablock, and the runtime addresses these meshes by name.
    globe_object.name = GLOBE_OBJECT_NAME
    globe_object.data.name = GLOBE_MESH_NAME
    cornea_object.name = CORNEA_OBJECT_NAME
    cornea_object.data.name = CORNEA_MESH_NAME

    print(f"  split cornea: {globe_object.name} {len(globe_object.data.vertices)} verts + "
          f"{cornea_object.name} {len(cornea_object.data.vertices)} verts, "
          f"{len(keys_before)} shape keys on each")

    return cornea_object


def connected_vertex_islands(mesh):
    """Vertex sets that are connected to each other through edges, largest first.

    Connectivity rather than a coordinate test, for the same reason tools/spikes/eye-geometry.mjs
    uses it: "everything with x > 0 is one eye" is a guess about how the asset happens to be laid
    out, and the shells are exactly the thing being identified.
    """
    parent = list(range(len(mesh.vertices)))

    def find(vertex):
        while parent[vertex] != vertex:
            parent[vertex] = parent[parent[vertex]]
            vertex = parent[vertex]
        return vertex

    for edge in mesh.edges:
        first, second = (find(index) for index in edge.vertices)
        if first != second:
            parent[second] = first

    islands = {}
    for vertex in range(len(mesh.vertices)):
        islands.setdefault(find(vertex), []).append(vertex)

    return sorted(islands.values(), key=len, reverse=True)


def island_centroid(mesh, island):
    total = Vector((0.0, 0.0, 0.0))
    for vertex in island:
        total += mesh.vertices[vertex].co
    return total / len(island)


def pair_islands_into_eyes(mesh, islands):
    """Groups the four shells into two eyes by which centroids sit on top of one another.

    The two shells of one eye are concentric to a fraction of a millimetre; the two eyes are an
    interpupillary distance apart. So nearest-centroid pairing is not a heuristic here, it is a
    reading of a gap three orders of magnitude wide.
    """
    centroids = [island_centroid(mesh, island) for island in islands]

    unpaired = list(range(len(islands)))
    pairs = []
    while unpaired:
        first = unpaired.pop(0)
        nearest = min(unpaired, key=lambda other: (centroids[other] - centroids[first]).length)
        unpaired.remove(nearest)
        pairs.append((islands[first], islands[nearest]))

    if len(pairs) != 2:
        raise SystemExit(f"Build failed: the four eye shells grouped into {len(pairs)} eyes.")

    return pairs


def outer_shell_of(mesh, pair):
    """Which of one eye's two shells is the cornea — the one that encloses the other.

    Measured from the pair's own common centroid rather than from either shell's fitted sphere
    centre: the two shells have centres 0.35 mm apart, and measuring each in its own frame makes
    the inner shell appear to poke outside the outer one across a 45 degree band. It does not.
    """
    common_centre = island_centroid(mesh, list(pair[0]) + list(pair[1]))

    radii = [
        sum((mesh.vertices[vertex].co - common_centre).length for vertex in island) / len(island)
        for island in pair
    ]

    separation = abs(radii[0] - radii[1]) / max(radii)
    if separation < MINIMUM_SHELL_SEPARATION_FRACTION:
        raise SystemExit(
            f"Build failed: the two shells of one eye have mean radii {radii[0]:.5f} and "
            f"{radii[1]:.5f}, a separation of {separation:.4f}. Below "
            f"{MINIMUM_SHELL_SEPARATION_FRACTION} there is no safe way to say which is the cornea.")

    return pair[0] if radii[0] > radii[1] else pair[1]


def build_cornea_material():
    """A clear, smooth, refractive shell — the only material on the figure that is not a surface.

    Exported through KHR_materials_transmission rather than as an alpha-blended material on
    purpose. A blended material writes no depth, which is the defect force_alpha_modes exists to
    prevent; a transmissive one stays alphaMode OPAQUE, keeps its depth write, and is what
    three.js needs to see to build a MeshPhysicalMaterial that refracts the globe behind it.
    """
    material = bpy.data.materials.new(CORNEA_MATERIAL_NAME)
    material.use_nodes = True
    material.use_backface_culling = True

    for node in material.node_tree.nodes:
        if node.type != "BSDF_PRINCIPLED":
            continue
        # No base-colour texture. The cornea's UV island in brown_eye.png is a flat pale blue held
        # at alpha 0; used as a base colour it would tint everything seen through the cornea.
        node.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        node.inputs["Metallic"].default_value = 0.0
        node.inputs["Roughness"].default_value = CORNEA_ROUGHNESS
        node.inputs["IOR"].default_value = CORNEA_IOR
        node.inputs["Transmission Weight"].default_value = 1.0
        node.inputs["Alpha"].default_value = 1.0

    return material


def separate_by_material(mesh_object, cornea_material):
    """Splits one object into one object per material, and says which is which.

    Returns (globe object, cornea object). Both keep the armature modifier, the vertex groups and
    the shape keys; the caller checks the last of those rather than trusting it.
    """
    before = set(bpy.data.objects)

    bpy.ops.object.select_all(action="DESELECT")
    mesh_object.select_set(True)
    bpy.context.view_layer.objects.active = mesh_object

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")

    produced = [mesh_object] + [obj for obj in bpy.data.objects if obj not in before]
    if len(produced) != 2:
        raise SystemExit(f"Build failed: separating {mesh_object.name} by material produced "
                         f"{len(produced)} objects, expected 2.")

    for part in produced:
        collapse_to_single_material(part)

    cornea = [part for part in produced if part.data.materials[0] is cornea_material]
    globe = [part for part in produced if part.data.materials[0] is not cornea_material]

    if len(cornea) != 1 or len(globe) != 1:
        raise SystemExit("Build failed: the corneal split did not produce exactly one cornea "
                         "object and one globe object.")

    return globe[0], cornea[0]


def collapse_to_single_material(mesh_object):
    """Drops the material slots a separated half no longer uses.

    Blender's separate copies every slot to every half, so without this the globe would still
    carry a cornea slot and the exporter would write a material nothing references — which the
    asset gate reads as an unrecognised material and fails on, correctly.
    """
    used = {polygon.material_index for polygon in mesh_object.data.polygons}
    if len(used) != 1:
        raise SystemExit(f"Build failed: {mesh_object.name} uses {len(used)} materials after a "
                         "separate-by-material, expected 1.")

    keep = mesh_object.data.materials[used.pop()]
    mesh_object.data.materials.clear()
    mesh_object.data.materials.append(keep)
    for polygon in mesh_object.data.polygons:
        polygon.material_index = 0


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
        # 🚩 Defaults OFF, and the build reports success without it. Passed explicitly, as a
        # boolean rather than a conditional keyword, so the nude control build keeps exporting
        # byte-for-byte what it always did: measured, sha256 b56115d0cb52… either way.
        export_attributes=arguments.hide_mask_attribute,
        export_yup=True)


def export_garment_fragments(rig, garments, arguments):
    """Writes one GLB per garment: the garment mesh, skinned, plus the rig it is skinned to.

    A fragment is what the runtime fetches when the avatar puts something on. It carries no body,
    no face parts and no morph targets — `female_casualsuit01` is 2,197 verts and 4,236 triangles
    — so the whole cost of a garment is its textures, which is what research §3.4 says the wardrobe
    budget actually is.

    The rig travels with the fragment because a skinned glTF mesh has to name its joints, and
    `Wardrobe.js` then throws that copy away and rebinds the geometry to the figure's own live
    skeleton by BONE NAME. Position in the joint array is not assumed to match; it is remapped.
    """
    if arguments.garment_fragment_dir is None:
        return []

    gender_suffix = int(round(arguments.gender * 100))
    written = []

    for garment_object, _asset_path, garment_id in garments:
        fragment_path = os.path.join(os.path.abspath(arguments.garment_fragment_dir), garment_id,
                                     GARMENT_FRAGMENT_FILENAME.format(gender_suffix))
        export_glb([rig, garment_object], fragment_path, arguments)
        written.append((garment_id, fragment_path))
        print(f"  fragment: {garment_id} -> {fragment_path} "
              f"({os.path.getsize(fragment_path):,} bytes)")

    return written


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

    garment_alpha_modes = read_wardrobe_manifest(arguments.wardrobe_manifest, arguments.garment)

    clear_startup_scene()

    basemesh = create_figure(arguments)
    apply_skin(basemesh, arguments)
    face_parts = attach_face_parts(basemesh, arguments)

    # Expressions must be loaded before the rig. FaceService.interpolate_targets looks for the
    # face parts among the *direct* children of the figure's root, and adding the rig makes the
    # rig that root — at which point the eyes, teeth and tongue become grandchildren and are
    # silently skipped, leaving the teeth behind when the jaw opens.
    load_expression_shape_keys(basemesh, arguments)

    # Garments come after the expressions and before the rig. See attach_garments for why both
    # halves of that sentence matter.
    garments = attach_garments(basemesh, arguments)

    rig = None
    if arguments.rig != "none":
        rig = HumanService.add_builtin_rig(basemesh, arguments.rig)
        print(f"  added rig: {arguments.rig}")
        bind_mhclo_parts_to_rig(basemesh, rig, face_parts)
        bind_mhclo_parts_to_rig(basemesh, rig, garments)

    hide_masks = []
    if arguments.hide_mask_attribute:
        hide_masks = write_hide_mask_attributes(basemesh, garments)

    bake_for_export(basemesh)

    if arguments.hide_mask_attribute:
        describe_hide_masks(basemesh, [name for _id, name, _count in hide_masks])

    # After the helper strip, because the strip works through mhclo vertex correspondences that
    # index the basemesh, and before the alpha pass, because the alpha pass is what would otherwise
    # turn the clear corneal shell into an opaque dome.
    eye_object = find_eye_object(face_parts, arguments.eye_proxy)
    if eye_object is not None:
        cornea_object = split_cornea_shell(eye_object)
        if cornea_object is not None:
            face_parts.append((cornea_object, "", "OPAQUE"))

    force_alpha_modes(basemesh, face_parts)
    for garment_object, _asset_path, garment_id in garments:
        alpha_mode = garment_alpha_modes[garment_id]
        force_alpha_mode(garment_object, alpha_mode)
        print(f"  {garment_object.name}: {alpha_mode} (from the wardrobe manifest)")

    hierarchy = collect_figure_hierarchy(basemesh)
    bake_macro_shape_keys_on_hierarchy(hierarchy)

    fragments = export_garment_fragments(rig, garments, arguments)

    # A garment written as its own fragment is deliberately absent from the body GLB: the body
    # carries the hide masks for the whole catalogue and the garments arrive on demand.
    garment_objects = {garment_object for garment_object, _path, _id in garments}
    body_hierarchy = [member for member in hierarchy
                      if member not in garment_objects or not fragments]

    export_glb(body_hierarchy, output_path, arguments)
    describe_result(basemesh, body_hierarchy, output_path)
    describe_wardrobe(hide_masks, fragments)


def describe_wardrobe(hide_masks, fragments):
    """Prints what the wardrobe half of the build produced, so a silent drop cannot pass."""
    if not hide_masks and not fragments:
        return

    print("")
    print("=== wardrobe ===")
    for garment_id, attribute_name, flagged in hide_masks:
        print(f"hide mask       : {attribute_name} ({garment_id}) {flagged:,} body verts")
    for garment_id, fragment_path in fragments:
        print(f"fragment        : {garment_id} -> {fragment_path}")


main()
