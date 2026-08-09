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

## The foundation layer (punch-list 9.8)

    blender --background --python build_figure.py -- \
        --gender 0.5 --output body_g050.glb \
        --foundation foundation_bra --foundation foundation_briefs \
        --hide-mask-attribute --garment-fragment-dir assets/wardrobe

🎯 **A foundation garment is not an mhclo. It is generated from the figure's own skin**, as a
conformal shell: a region of body faces, duplicated, pushed out along the vertex normals by 3 mm,
and tapered back to 0.8 mm over the last two rings so the hem melts into the skin instead of
showing an open edge.

Three properties fall out of that construction rather than being engineered, and each one is a
problem the mhclo path has:

  * **It fits every identity exactly.** §3.3 measured `female_casualsuit01` drifting mean
    95.145 mm / max 143.066 mm between g000 and g100 because `fit_clothes_to_human` re-solves
    barycentrically against the basemesh. A shell cut from the basemesh AT that identity has no
    fitting step to drift. This is why 9.8 can ship while 9.4 is blocked.
  * **Its skin weights are the body's own**, copied vertex-for-vertex rather than interpolated
    through mhclo correspondences, so there is no class of vertex that can be left unweighted.
  * **It needs no texture.** A flat base colour plus a roughness from the `knit_jersey` row of
    research §5.3 is the whole material, which matters because §3.4 makes textures 81–87% of the
    wardrobe's cost. The four foundation fragments together carry no image at all.

⚠️ The regions are AUTHORED. There is no reference for underwear anywhere in the 638 supplied
images (docs/BRIEF.md), so every fraction in `FOUNDATION_GARMENTS` below is a design decision.
What is NOT authored is the frame they are expressed in: every cut is a fraction of a distance
between two measured anatomical landmarks — rig bone heads, and MakeHuman's own `nipple` vertex
group — so the same numbers produce a correctly placed garment at any point on the identity axes.

`--foundation` also writes the three `_decency_*` regions onto the body. Those are the TARGET the
coverage gate measures against, and they are deliberately derived from a DIFFERENT source than the
garment regions — MakeHuman's `nipple` group and measured extrema, not the landmark fractions
above — so a garment that is cut too small fails instead of moving the target with it.
"""

import argparse
import json
import math
import os
import sys

import bmesh
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

# --- punch-list 9.8: the foundation layer -------------------------------------------------------
#
# How far a foundation shell stands off the skin, and how it ends.
#
# 3 mm is the smallest offset that is unambiguously more than the noise floor of everything else in
# the pipeline: the runtime rebuild and the bake agree on positions to 1 µm (wardrobe.selftest.mjs
# CENTROID_TOLERANCE_M), and the fit gate works in millimetres. It is also thin enough that a
# uniform normal offset does not self-intersect in the concave places — the crotch and the armpit —
# which is measured per build by `describe_foundation` and fails the build if it stops being true.
#
# The hem tapers back to 0.8 mm over the last two rings rather than to zero, because a shell edge
# AT the skin z-fights with it. 0.8 mm still reads as "the fabric ends here" and is 800× the
# position agreement above.
FOUNDATION_OFFSET_M = 0.0030
FOUNDATION_HEM_OFFSET_M = 0.0008
FOUNDATION_HEM_RINGS = 2

# The closest the shell may come to the skin anywhere, after every clamp and every relaxation.
FOUNDATION_MINIMUM_CLEARANCE_M = 0.00005

# 🚩 How many times the patch is subdivided before the garment is cut out of it, and WHY the first
# build had to grow this: the base mesh is a body, and its edge loops run where a body's anatomy
# runs, not where a hem does. Cut straight out of it, every hem is a staircase of whole quads —
# measured on the first build, the briefs came out at 162 faces and the leg openings stepped by a
# visible half-centimetre. A garment whose entire requirement is to go UNNOTICED cannot have a
# staircase for an edge.
#
# Subdivision is LINEAR, not Catmull-Clark, and that is the load-bearing half: linear subdivision
# puts every new vertex exactly on the polygon it splits, so the patch stays exactly on the body's
# own surface and the 3 mm standoff is still 3 mm. Catmull-Clark would shrink it into the skin.
#
# ONE level, not two, and the second one was tried and rejected on a measurement rather than on
# taste: at two levels the vest came out at 18,484 triangles against the whole suit's 4,236, for a
# garment that is worn in every state the avatar can reach and is therefore always resident. One
# level halves the hem step and costs 4,621.
FOUNDATION_SUBDIVISIONS = 1

# How far past the garment the patch is cut before subdividing. The offset direction at a hem
# vertex is its smooth normal, which needs its neighbours to exist — cut the patch flush with the
# garment and the outermost ring would be offset along a normal computed from half a neighbourhood.
FOUNDATION_PATCH_MARGIN_RINGS = 3

# How many extra rounds of subdivision the hem band gets after the uniform pass. See the call site.
#
# Two, because one was not enough to look at: at one pass the bra band and the brief's leg opening
# still stepped visibly at the scale of a base-mesh quad, which on a garment whose entire
# requirement is to go unnoticed is the only thing anyone notices.
FOUNDATION_HEM_REFINEMENTS = 2

# `knit_jersey` from research §5.3: roughness 0.65–0.80 [I], soft sheen, clings. The middle of the
# band. No texture at all — see the module docstring.
FOUNDATION_ROUGHNESS = 0.78

# 🎯 The region a foundation garment inherits from an OUTER garment's hide mask: "this part of me
# is underneath that, and must not be drawn while it is worn."
#
# This is NOT a hide mask of the foundation garment's own — 9.8 says a foundation garment hides
# nothing, and it does not: it never removes a single body vertex. It is the same occlusion rule
# the BODY already obeys, applied to the shell that replaced the body's surface there. Without it
# the layer is unwearable under anything: the g050 baseline has 26.37% of the suit's covered skin
# sitting OUTSIDE the cloth at rest, worst depth 9.19 mm (punch-list 9.4), and a shell 3 mm proud
# of that skin pokes through the suit everywhere the skin already would.
#
# 🚩 A DIFFERENT PREFIX FROM `_hide_`, deliberately. `verify_glb.mjs` asserts that every `_HIDE_*`
# attribute it finds is some manifest garment's own and flags between 0.1% and 90% of its mesh —
# and on a bra fragment `_HIDE_FEMALE_CASUALSUIT01` flags nearly all of it, which is correct and
# would read as the degenerate "erases the figure" case.
UNDER_MASK_ATTRIBUTE_PREFIX = "_under_"

# The decency regions the coverage gate measures against, written onto the body by `--foundation`.
#
# ⚠️ Derived on purpose from a DIFFERENT source than the garment cuts below: MakeHuman's own
# `nipple` vertex group, and measured extrema of the body surface. If both came from the same
# fractions, shrinking a garment would shrink its target with it and the gate would be a
# tautology — docs/LEARNINGS.md §1.25a.
DECENCY_ATTRIBUTE_PREFIX = "_decency_"
DECENCY_REGIONS = ("chest", "groin", "seat")

# How far each decency region reaches, as a multiple of a measured body dimension.
#
# ⚠️ AUTHORED, and there is no reference to author against — docs/BRIEF.md records that the 638
# supplied images contain no foundation layer at all. `CHEST_DILATION` is a multiple of the radius
# of MakeHuman's own areola ring; the other two are multiples of the hip half-width, which is the
# nearest measured dimension that scales with the pelvis on every identity axis.
DECENCY_CHEST_DILATION = 1.35
DECENCY_GROIN_RADIUS_IN_HIP_HALF_WIDTHS = 0.75
DECENCY_SEAT_RADIUS_IN_HIP_HALF_WIDTHS = 0.55

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
    parser.add_argument("--foundation", action="append", default=[], metavar="ID",
                        help="Punch-list 9.8. Generate a foundation garment from the figure's own "
                             "skin as a conformal shell, e.g. 'foundation_bra'. Repeatable. Also "
                             "writes the three _decency_* regions onto the body, which is what "
                             "the coverage gate measures against. Known ids: " +
                             ", ".join(sorted(FOUNDATION_GARMENTS)) + ".")
    parser.add_argument("--garment-fragment-dir", default=None, metavar="DIR",
                        help="Write each garment to DIR/<id>/g<NNN>.glb as a standalone fragment "
                             "and leave it out of the body GLB.")
    parser.add_argument("--wardrobe-manifest", default=DEFAULT_WARDROBE_MANIFEST,
                        help="Garment manifest the build reads alphaMode from. One authority for "
                             "the build, the runtime and the asset gate.")

    return parser.parse_args(script_arguments)


def read_wardrobe_manifest(manifest_path, garment_ids):
    """The manifest entry per garment id, read from the wardrobe manifest.

    The build does NOT decide a garment's alpha mode from its name. `verify_glb.mjs` reads the
    same field out of the same file, so a garment whose manifest entry says MASK and whose GLB
    says OPAQUE is a gate failure rather than two files quietly disagreeing — which is exactly the
    hole the five-regex whitelist left (research §3.7).

    An unlisted garment stops the build. A garment nothing describes cannot be dressed, layered or
    verified, so shipping one is worse than not building it.

    The whole entry is returned rather than just `alphaMode`, because a foundation garment takes
    its base colour from the same place — `palette[0]` — and one authority beating two is the
    reason this function exists at all.
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

    return {garment_id: by_id[garment_id] for garment_id in garment_ids}


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


# --- punch-list 9.8: the foundation layer --------------------------------------------------------


class BodyLandmarks:
    """Where this figure's anatomy actually is, measured rather than assumed.

    Every field is in the basemesh's own local space, in metres, and every one of them moves with
    the identity sliders. That is the whole point: `FOUNDATION_GARMENTS` states its cuts as
    fractions of distances between two of these, so one set of numbers dresses g000 and g100 alike.

    Two independent sources, deliberately:

      * the RIG's bone heads, which MPFB fits to the shaped figure's own joint cubes, and
      * the MESH — MakeHuman's `nipple` vertex group, and measured extrema of the skin surface.

    The decency regions come only from the second. The garment cuts come mostly from the first.
    """

    def __init__(self, bone_head, bust_centre, bust_radius, crotch, seat, hip_half_width):
        self.hip = {1.0: bone_head["thigh_l"].copy(), -1.0: bone_head["thigh_r"].copy()}
        self.knee = {1.0: bone_head["calf_l"].copy(), -1.0: bone_head["calf_r"].copy()}

        self.pelvis_z = bone_head["pelvis"].z
        self.spine_01_z = bone_head["spine_01"].z
        self.spine_02_z = bone_head["spine_02"].z
        self.spine_03_z = bone_head["spine_03"].z
        self.clavicle_z = bone_head["clavicle_l"].z
        self.thigh_z = bone_head["thigh_l"].z
        self.knee_z = bone_head["calf_l"].z
        self.shoulder_half_width = abs(bone_head["upperarm_l"].x)
        self.hip_half_width = hip_half_width

        # Left and right, so the chest region is two balls rather than one that spans the sternum.
        self.bust_centre = bust_centre
        self.bust_radius = bust_radius
        self.bust_z = sum(centre.z for centre in bust_centre) / len(bust_centre)

        self.crotch = crotch
        self.seat = seat

        self.thigh_length = self.thigh_z - self.knee_z
        self.torso_height = self.clavicle_z - self.pelvis_z

    def between(self, lower, upper, fraction):
        """A height a stated fraction of the way from one landmark to another."""
        return lower + (upper - lower) * fraction

    def describe(self):
        return (f"pelvis {self.pelvis_z:.4f}  spine_01 {self.spine_01_z:.4f}  "
                f"spine_03 {self.spine_03_z:.4f}  bust {self.bust_z:.4f}  "
                f"clavicle {self.clavicle_z:.4f}  thigh {self.thigh_z:.4f}  "
                f"knee {self.knee_z:.4f}  crotch {self.crotch.z:.4f}  "
                f"hip half-width {self.hip_half_width:.4f}  "
                f"shoulder half-width {self.shoulder_half_width:.4f}")


# Which bones a foundation garment is allowed to grow on. This is what keeps a horizontal cut from
# picking up the arms: the figure stands in an A-pose, so the hands sit at z 0.988–1.076 and the
# fingertips reach 0.911 — a waistband at 0.910 is 1.4 mm from swallowing a finger on g050, and
# closer than that on some identities. A bone allowlist is not a threshold and cannot drift.
TORSO_BONES = frozenset({"spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r"})
LOWER_BONES = frozenset({"pelvis", "spine_01", "thigh_l", "thigh_r"})


# How far the thigh's own surface lies from its bone, as a multiple of the hip half-width, and how
# fast the hem is allowed to drop away past that. Together these are the gusset.
#
# 🚩 **THE LEG HEM AND THE CROTCH ARE THE SAME CUT AND THEY CANNOT BE THE SAME THRESHOLD**, which
# took three attempts. Measured on g050: the thigh surface is at most 88 mm from its own bone, and
# the crotch is 114.9 mm from the nearest one — 0.87 and 1.13 of the hip half-width. A hem stated
# as "how far down the thigh" alone cuts the crotch off, because the crotch is 0.315 of the way to
# the knee, further down than any brief's leg opening. A hem stated as "inside this tube, cut;
# outside it, keep" is a STEP, and a step across a skinning boundary comes out as the notched,
# tabbed hem the second build produced.
#
# So the hem is a threshold that GROWS with distance from the thigh bone: at the thigh surface it
# is the garment's own hem parameter, and by the time it reaches the crotch it is 0.70 further down
# the leg than that, which no brief reaches. Continuous in both coordinates, so the boundary it
# draws on the body is a smooth closed curve.
THIGH_SURFACE_IN_HIP_HALF_WIDTHS = 0.90
CROTCH_RELIEF_PER_HIP_HALF_WIDTH = 3.0


def foundation_region_briefs(point, dominant, marks):
    """Briefs: the pelvis to the waistband, with the leg openings just below the hip joint."""
    return lower_body_region(point, dominant, marks,
                             waist_fraction=0.45, leg_fraction=0.08)


def foundation_region_boxer_brief(point, dominant, marks):
    """A boxer brief: the same garment with the legs taken to mid-thigh."""
    return lower_body_region(point, dominant, marks,
                             waist_fraction=0.45, leg_fraction=0.50)


def lower_body_region(point, dominant, marks, waist_fraction, leg_fraction):
    """Below the waistband; and if it is on a leg, above that leg's hem.

    🚩 THE SPLIT INTO TWO CASES IS THE WHOLE FUNCTION, and the first build got it wrong by not
    having it. A single "how far down the thigh" cut puts the crotch at 0.315 of the way to the
    knee — further down the leg than a brief's leg opening — so a brief cut that way has no gusset
    at all, and the decency gate still passed because the boxer brief covered the groin instead.
    A garment is not decent because another garment is.

    So: the leg is a TUBE around the thigh bone, and the crotch, the pubis and the buttocks are
    outside it. Inside the tube the garment ends at a hem measured along the bone — along the bone
    and not at a height, because the thigh runs outward as well as down, 41 mm of x over 391 mm of
    z on g050, and a horizontal cut across it is a slanted hem.
    """
    if dominant not in LOWER_BONES:
        return False

    if point.z > marks.between(marks.pelvis_z, marks.spine_01_z, waist_fraction):
        return False

    along, across = thigh_coordinates(point, marks)

    clear_of_thigh = max(0.0, across / marks.hip_half_width - THIGH_SURFACE_IN_HIP_HALF_WIDTHS)
    hem = leg_fraction + CROTCH_RELIEF_PER_HIP_HALF_WIDTH * clear_of_thigh

    return along <= hem


def thigh_coordinates(point, marks):
    """(how far down the nearer thigh, how far out from its bone). 0 at the hip, 1 at the knee."""
    side = 1.0 if point.x >= 0.0 else -1.0
    hip = marks.hip[side]
    axis = marks.knee[side] - hip

    offset = point - hip
    along = offset.dot(axis) / axis.length_squared

    return along, (offset - axis * along).length


def foundation_region_bra(point, dominant, marks):
    """A band around the bust, and a strap over each shoulder.

    The band's height comes off the `nipple` group rather than off a spine bone, because the bust
    moves 50.2 mm up the torso between g000 and g100 while spine_03 moves 45.5 mm — close, but not
    the same, and the band has to enclose the breast at both ends of the axis.
    """
    if dominant not in TORSO_BONES:
        return False

    underbust = marks.bust_z - 0.50 * (marks.bust_z - marks.spine_03_z)
    overbust = marks.bust_z + 0.45 * (marks.clavicle_z - marks.bust_z)

    if underbust <= point.z <= overbust:
        return True

    return is_shoulder_strap(point, marks, overbust, inner=0.36, outer=0.56)


def foundation_region_vest(point, dominant, marks):
    """A plain sleeveless undershirt: hem at the hip, armholes, a neck opening, two wide straps."""
    if dominant not in TORSO_BONES.union({"pelvis"}):
        return False

    hem = marks.between(marks.pelvis_z, marks.spine_01_z, 0.15)
    if point.z < hem:
        return False

    # Below the armholes the vest is a full tube; above them it is two straps, and the same pair of
    # bounds cuts the armhole on the outside and the neck opening on the inside.
    armhole = marks.bust_z + 0.25 * (marks.clavicle_z - marks.bust_z)
    if point.z < armhole:
        return True

    return is_shoulder_strap(point, marks, armhole, inner=0.22, outer=0.75)


def is_shoulder_strap(point, marks, from_height, inner, outer):
    """A vertical band of skin at a fixed distance from the midline, above a given height.

    Bounding only |x| is what makes one rule produce a strap that runs up the chest, over the
    shoulder and down the back: the band is a plane pair, and the shoulder is the only place the
    body crosses it.
    """
    if point.z < from_height:
        return False

    lateral = abs(point.x) / marks.shoulder_half_width
    return inner <= lateral <= outer


# The four garments 9.8 names, and nothing else. Each is a region rule plus the manifest id it
# ships under; everything else about it — layer, slots, clo, palette — lives in the manifest.
FOUNDATION_GARMENTS = {
    "foundation_bra": foundation_region_bra,
    "foundation_briefs": foundation_region_briefs,
    "foundation_boxer_brief": foundation_region_boxer_brief,
    "foundation_vest": foundation_region_vest,
}


def measure_landmarks(basemesh, rig):
    """Reads the figure's anatomy off the rig and the skin. Must run after the macro bake."""
    to_local = basemesh.matrix_world.inverted()
    bone_head = {bone.name: to_local @ (rig.matrix_world @ bone.head_local)
                 for bone in rig.data.bones}

    required = ["pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "thigh_l", "calf_l",
                "upperarm_l"]
    missing = [name for name in required if name not in bone_head]
    if missing:
        raise SystemExit(f"Build failed: the rig has no {missing}. The foundation layer measures "
                         "its cuts from bone heads, and cannot be placed on a rig it cannot read.")

    mesh = basemesh.data
    hip_half_width = abs(bone_head["thigh_l"].x)

    bust_centre, bust_radius = measure_bust(basemesh)
    crotch = measure_crotch(mesh, bone_head, hip_half_width)
    seat = measure_seat(mesh, bone_head, crotch, hip_half_width)

    return BodyLandmarks(bone_head, bust_centre, bust_radius, crotch, seat, hip_half_width)


def measure_bust(basemesh):
    """The centre and radius of each areola, from MakeHuman's own `nipple` vertex group.

    Ground truth this build did not author: the group is part of the base mesh and is the only
    place in the whole pipeline that says where the chest region is without someone deciding.
    """
    group = basemesh.vertex_groups.get("nipple")
    if group is None:
        raise SystemExit("Build failed: the basemesh has no 'nipple' vertex group, which is where "
                         "the chest decency region is measured from.")

    sides = {1.0: [], -1.0: []}
    for vertex in basemesh.data.vertices:
        if not any(entry.group == group.index for entry in vertex.groups):
            continue
        sides[1.0 if vertex.co.x >= 0.0 else -1.0].append(vertex.co.copy())

    centres = []
    radii = []
    for side in (-1.0, 1.0):
        points = sides[side]
        if not points:
            raise SystemExit("Build failed: the 'nipple' vertex group has no vertices on one side "
                             "of the body.")
        centre = sum(points, Vector((0.0, 0.0, 0.0))) / len(points)
        centres.append(centre)
        radii.append(max((point - centre).length for point in points))

    return centres, radii


def measure_crotch(mesh, bone_head, hip_half_width):
    """The lowest point of the skin on the midline between the legs.

    Measured rather than derived from the pelvis bone, because the pelvis bone head sits inside the
    body and the perineum is 80–90 mm below it, by an amount that changes with weight and gender.
    """
    thigh_z = bone_head["thigh_l"].z
    knee_z = bone_head["calf_l"].z
    floor = thigh_z - 0.35 * (thigh_z - knee_z)

    candidates = [vertex.co for vertex in mesh.vertices
                  if abs(vertex.co.x) < 0.28 * hip_half_width
                  and floor < vertex.co.z < bone_head["pelvis"].z]

    if not candidates:
        raise SystemExit("Build failed: no skin found on the midline between the legs, so the "
                         "groin decency region cannot be placed.")

    return min(candidates, key=lambda point: point.z).copy()


def measure_seat(mesh, bone_head, crotch, hip_half_width):
    """The rearmost point of each buttock, in the band between the crotch and the pelvis bone."""
    apexes = []

    for side in (-1.0, 1.0):
        candidates = [vertex.co for vertex in mesh.vertices
                      if vertex.co.x * side > 0.15 * hip_half_width
                      and crotch.z < vertex.co.z < bone_head["pelvis"].z]

        if not candidates:
            raise SystemExit("Build failed: no skin found on one buttock, so the seat decency "
                             "region cannot be placed.")

        apexes.append(max(candidates, key=lambda point: point.y).copy())

    return apexes


def decency_region_membership(basemesh, marks, dominant):
    """Which body vertices belong to each decency region. Balls around measured anatomy.

    ⚠️ Authored radii — see `DECENCY_CHEST_DILATION` and friends. What is not authored is where the
    balls are centred, and the centres are what a shrunken garment fails against.

    🎯 The groin has one extra clause, and it is the difference between a target and a tautology.
    The ball around the crotch reaches 76 mm on g050, which runs a little way down the inside of
    each thigh — and no brief covers the inside of a thigh. So the region excludes anything the
    RIG says is leg. That is MPFB's own weight painting deciding where the leg starts, which is a
    different authority from the leg tube the garment rule uses; shrink the garment's gusset and
    this target does not move with it.
    """
    membership = {name: set() for name in DECENCY_REGIONS}

    groin_radius = DECENCY_GROIN_RADIUS_IN_HIP_HALF_WIDTHS * marks.hip_half_width
    seat_radius = DECENCY_SEAT_RADIUS_IN_HIP_HALF_WIDTHS * marks.hip_half_width
    leg_bones = {"thigh_l", "thigh_r", "calf_l", "calf_r"}

    for vertex in basemesh.data.vertices:
        point = vertex.co

        for centre, radius in zip(marks.bust_centre, marks.bust_radius):
            if (point - centre).length <= radius * DECENCY_CHEST_DILATION:
                membership["chest"].add(vertex.index)

        if ((point - marks.crotch).length <= groin_radius
                and dominant[vertex.index] not in leg_bones):
            membership["groin"].add(vertex.index)

        for apex in marks.seat:
            if (point - apex).length <= seat_radius:
                membership["seat"].add(vertex.index)

    return membership


def write_decency_attributes(basemesh, membership):
    """Ships the decency regions on the body, so the coverage gate reads them off the artefact.

    A gate that recomputed the regions from its own copy of the anatomy would be measuring its own
    arithmetic. These are written by the build that cut the garments and read by a gate that did
    not, which is the only arrangement where a disagreement means something.
    """
    written = []

    for name in DECENCY_REGIONS:
        attribute_name = f"{DECENCY_ATTRIBUTE_PREFIX}{name}"
        attribute = basemesh.data.attributes.new(attribute_name, "FLOAT", "POINT")
        for index in membership[name]:
            attribute.data[index].value = 1.0
        written.append((name, attribute_name, len(membership[name])))
        print(f"  decency region {name}: {len(membership[name]):,} body verts as {attribute_name}")

    return written


def build_foundation_garments(basemesh, rig, marks, arguments, manifest_entries):
    """Cuts each requested foundation garment out of the figure's own skin.

    Returns the same (object, mhclo path, id) shape `attach_garments` returns, so the alpha pass
    and the fragment export treat a bra and a jacket identically.
    """
    if not arguments.foundation:
        return [], {}, {}

    dominant = dominant_bone_per_vertex(basemesh, rig)
    built = []
    regions = {}
    standoffs = {}

    for garment_id in arguments.foundation:
        region_of = FOUNDATION_GARMENTS.get(garment_id)
        if region_of is None:
            raise SystemExit(f"Build failed: '{garment_id}' is not a foundation garment. Known: "
                             f"{', '.join(sorted(FOUNDATION_GARMENTS))}.")

        entry = manifest_entries[garment_id]
        if entry["layer"] != "FOUNDATION":
            raise SystemExit(f"Build failed: '{garment_id}' is at layer {entry['layer']} in the "
                             "manifest. A garment generated by --foundation must be at FOUNDATION "
                             "— it is the layer nothing can remove, and a shell 3 mm off the skin "
                             "worn over anything else would be inside it.")

        region = {vertex.index for vertex in basemesh.data.vertices
                  if region_of(vertex.co, dominant[vertex.index], marks)}

        if not region:
            raise SystemExit(f"Build failed: the region rule for '{garment_id}' selected no "
                             "vertices at this identity.")

        shell, standoff = cut_conformal_shell(basemesh, rig, garment_id, region, region_of,
                                              marks, entry)
        built.append((shell, "", garment_id))
        regions[garment_id] = region
        standoffs[garment_id] = standoff

    return built, regions, standoffs


def dominant_bone_per_vertex(basemesh, rig):
    """The bone each body vertex is weighted to most, by name. Unweighted vertices report ''."""
    bone_names = {bone.name for bone in rig.data.bones}
    group_name = {group.index: group.name for group in basemesh.vertex_groups}

    dominant = [""] * len(basemesh.data.vertices)

    for vertex in basemesh.data.vertices:
        best_weight = 0.0
        for entry in vertex.groups:
            name = group_name[entry.group]
            if name in bone_names and entry.weight > best_weight:
                best_weight = entry.weight
                dominant[vertex.index] = name

    return dominant


def cut_conformal_shell(basemesh, rig, garment_id, region, region_of, marks, manifest_entry):
    """Duplicates the body, refines a patch of it, and cuts the garment out of the patch.

    Four steps, and each one is in the order it is for a reason:

      1. **Cut a patch** three rings wider than the garment. Everything after this works on a few
         hundred faces instead of thirteen thousand, and the margin means the hem's own normals are
         computed from a complete neighbourhood.
      2. **Subdivide the patch linearly**, so the hem can follow a curve instead of the base mesh's
         anatomy-shaped edge loops. See FOUNDATION_SUBDIVISIONS.
      3. **Offset the WHOLE patch** along its normals, before anything else is deleted. Deleting
         first would recompute the normals around the new boundary and flare the hem outward.
      4. **Cut the garment** out of the offset patch.
    """
    shell = basemesh.copy()
    shell.data = basemesh.data.copy()
    shell.name = f"Human.{garment_id}"
    shell.data.name = garment_id
    basemesh.users_collection[0].objects.link(shell)

    # A bra has no use for `viseme_kk`, and a shape key on a mesh about to lose 90% of its vertices
    # is 89 morph targets of noise in the fragment. Cleared first because bmesh cannot subdivide a
    # mesh that has them.
    shell.shape_key_clear()

    rename_hide_masks_to_under_masks(shell.data)

    # The decency regions are the gate's TARGET and belong on the body. Shipping a copy of them on
    # the garment would let a coverage check answer itself out of the garment's own bookkeeping
    # instead of measuring where the cloth is.
    for name in [name for name in shell.data.attributes.keys()
                 if name.lower().startswith(DECENCY_ATTRIBUTE_PREFIX)]:
        shell.data.attributes.remove(shell.data.attributes[name])

    patch = dilate(region, vertex_neighbours(shell.data), FOUNDATION_PATCH_MARGIN_RINGS)
    keep_only(shell, patch)

    subdivide_linearly(shell, [edge.index for edge in shell.data.edges],
                       FOUNDATION_SUBDIVISIONS)
    refined = region_on(shell, rig, region_of, marks)

    # 🎯 And then again, only where it shows. The hem is the only part of a foundation garment
    # anyone can see the resolution of — the interior is a flat colour lying on skin — so the
    # second refinement is spent entirely on the two rings either side of the cut. Uniform, it
    # would have cost the vest 13,527 extra triangles to smooth an edge that is 8% of it.
    for _pass in range(FOUNDATION_HEM_REFINEMENTS):
        subdivide_linearly(shell, edges_near_boundary(shell.data, refined), 1)
        refined = region_on(shell, rig, region_of, marks)

    # Snapshotted before anything moves. `vertex_normals` is a derived cache and the first write
    # to a position invalidates it, so reading it inside the loop would offset later vertices
    # along normals that already reflect earlier ones.
    normals = [normal.vector.copy() for normal in shell.data.vertex_normals]
    skin = skin_surface_of(shell.data)

    offsets = shell_offsets(shell.data, refined)
    thinned = clamp_offsets_to_available_gap(shell.data, refined, normals, skin, offsets)
    through = count_penetrations(shell.data, refined, normals, skin, offsets)

    for vertex in shell.data.vertices:
        vertex.co += normals[vertex.index] * offsets[vertex.index]

    relax_onto_the_body(shell.data, refined, offsets, skin)

    nearest, furthest = measure_clearance(shell.data, refined, skin)
    standoff = Standoff(nearest, furthest, through, thinned)

    keep_only(shell, refined)
    assign_foundation_material(shell, garment_id, manifest_entry)

    return shell, standoff


# A vertex may not use more than this share of the space in front of it. 🚩 The crotch is why:
# the perineum is a slot between two surfaces that FACE EACH OTHER and close to nothing, so a
# uniform 3 mm offset pushes each wall 3 mm into the other and the shell crosses itself. Measured
# on the first build with the leg tube in place: the briefs reached 10.28 mm from their own surface
# with 3 vertices inside the body, all of them at the crotch seam.
#
# A third rather than a half so that both walls together take two thirds and there is still a gap.
GAP_SHARE_PER_WALL = 0.33


def clamp_offsets_to_available_gap(mesh, region, normals, skin, offsets):
    """Thins the shell wherever the body does not leave 3 mm of room in front of it.

    Cloth in a crease is thinner than cloth on a thigh. This is that, measured: look straight out
    of each vertex, and if the body is in the way, take a third of whatever distance there is.
    """
    reach = FOUNDATION_OFFSET_M / GAP_SHARE_PER_WALL

    # Far enough off the surface not to hit the vertex's own faces, small against the offset.
    lift = FOUNDATION_OFFSET_M / 60.0

    thinned = 0

    for index in region:
        origin = mesh.vertices[index].co + normals[index] * lift
        hit = skin.ray_cast(origin, normals[index], reach)

        if hit[0] is None:
            continue

        allowed = (hit[3] + lift) * GAP_SHARE_PER_WALL
        if allowed < offsets[index]:
            offsets[index] = allowed
            thinned += 1

    return thinned


def skin_surface_of(mesh):
    """A BVH of the patch as it stands BEFORE the offset — the exact surface the shell came off.

    🚩 Deliberately not a BVH of the whole body, and the first attempt was, which cost a build.
    `BVHTree.FromPolygons` triangulates, the base mesh is quads, and a quad spanning a curved
    torso is not planar — so a subdivided vertex that sits exactly on the bilinear patch sits up to
    1.25 mm off the triangulation of it. Measured: every shell reported a maximum standoff of
    4.25 mm for a 3.00 mm offset, and none of them was wrong.
    """
    from mathutils.bvhtree import BVHTree

    return BVHTree.FromPolygons([vertex.co.copy() for vertex in mesh.vertices],
                                [list(polygon.vertices) for polygon in mesh.polygons])


class Standoff:
    """What a finished shell measured: how clear of the skin it is, and whether it went through.

    ⚠️ `through` is the number of vertices whose offset crossed a surface that was in front of
    them. It is the direct verification of `clamp_offsets_to_available_gap`'s precondition, and it
    replaced two attempts at a general inside/outside test that both produced false positives on
    correct geometry — the record is in `count_penetrations`.
    """

    def __init__(self, nearest, furthest, through, thinned):
        self.nearest = nearest
        self.furthest = furthest
        self.through = through
        self.thinned = thinned


def count_penetrations(mesh, region, normals, skin, offsets):
    """How many vertices would be pushed THROUGH a surface standing in front of them.

    This is the whole of the fold check, and it is deliberately narrow. Two wider tests were built
    first and both called correct geometry broken:

      * nearest-point-and-sign says a vertex is inside whenever its nearest surface faces away from
        it, which at the bottom of the gluteal cleft is every vertex — the two walls face EACH
        OTHER. Three vertices on the midline at z 0.838–0.858 failed the build.
      * filtering to same-facing surfaces then reports the far side of the buttock, 10.28 mm away,
        as the surface a 3 mm offset was measured against.
      * a ray-parity test along the vertex normal called four bra hem vertices inside the body at a
        measured clearance of 0.797 mm, which they plainly are not.

    A fold is caused by exactly one thing here — an offset larger than the space in front of it —
    so that is what is measured, at the vertex where it would happen, against the surface it would
    hit. Nothing about it is a proxy.
    """
    lift = FOUNDATION_OFFSET_M / 60.0
    through = 0

    for index in region:
        if offsets[index] <= lift:
            continue

        origin = mesh.vertices[index].co + normals[index] * lift
        hit = skin.ray_cast(origin, normals[index], offsets[index] - lift)

        if hit[0] is not None:
            through += 1

    return through


def measure_clearance(mesh, region, skin):
    """(nearest, furthest) distance from the offset shell back to the skin it was cut from."""
    nearest = float("inf")
    furthest = 0.0

    for index in region:
        _location, _normal, _face, distance = skin.find_nearest(mesh.vertices[index].co)

        if distance is None:
            continue

        nearest = min(nearest, distance)
        furthest = max(furthest, distance)

    return nearest, furthest


def dilate(region, neighbours, rings):
    """The region plus everything within `rings` edges of it."""
    grown = set(region)

    for _ring in range(rings):
        grown |= {neighbour for index in grown for neighbour in neighbours[index]}

    return grown


# How much of the body's small detail the cloth is allowed to forget, and how hard the skin pushes
# back afterwards. 🚩 A pure normal offset is not fabric, it is PAINT: it reproduces every bump it
# is laid over, and on the vest that meant the areola came through the cloth. Cloth spans a small
# concavity and rides over a small convexity, which is a low-pass filter over the surface — so the
# shell is smoothed, and then anything the smoothing pulled back under the hem clearance is pushed
# out again along its own normal. Smooth-then-reproject rather than smooth-and-hope.
FOUNDATION_RELAX_PASSES = 4
FOUNDATION_RELAX_STRENGTH = 0.55


def relax_onto_the_body(mesh, region, offsets, skin):
    """Low-pass filters the shell, then pushes anything that sank back out to the hem clearance.

    The hem is pinned. Smoothing moves a vertex toward the average of its neighbours, and at a free
    boundary that average is one-sided, so an unpinned hem creeps inward and the garment shrinks a
    little on every pass — which is the shape of the cut, not a detail of the fabric.
    """
    neighbours = vertex_neighbours(mesh)
    inside = [index for index in region
              if all(neighbour in region for neighbour in neighbours[index])]

    for _pass in range(FOUNDATION_RELAX_PASSES):
        moved = {}

        for index in inside:
            average = Vector((0.0, 0.0, 0.0))
            for neighbour in neighbours[index]:
                average += mesh.vertices[neighbour].co
            average /= len(neighbours[index])

            moved[index] = mesh.vertices[index].co.lerp(average, FOUNDATION_RELAX_STRENGTH)

        for index, position in moved.items():
            mesh.vertices[index].co = position

    for index in region:
        # 🚩 The target is the vertex's OWN offset, not the hem constant. Vertices in a crease were
        # deliberately thinned by `clamp_offsets_to_available_gap` — 28 of them at the crotch —
        # and pushing those back out to the full hem would undo the one thing standing between the
        # shell and the surface it is folded against.
        target = min(FOUNDATION_HEM_OFFSET_M, offsets[index])

        # Along the SKIN's normal at the nearest point, not the vertex's own. Its own normal is
        # from before the smoothing and can be almost tangential to the direction that actually
        # buys clearance; measured, that left the briefs 0.14 mm off the body at the crotch.
        for _attempt in range(5):
            _location, normal, _face, distance = skin.find_nearest(mesh.vertices[index].co)

            if distance is None or distance >= target:
                break

            mesh.vertices[index].co += normal * (target - distance)


def region_on(shell, rig, region_of, marks):
    """Which of the shell's CURRENT vertices the garment's own region rule selects."""
    dominant = dominant_bone_per_vertex(shell, rig)

    return {vertex.index for vertex in shell.data.vertices
            if region_of(vertex.co, dominant[vertex.index], marks)}


def edges_near_boundary(mesh, region):
    """Every edge within two rings of the region's boundary, by index."""
    neighbours = vertex_neighbours(mesh)

    boundary = {index for index in region
                if any(neighbour not in region for neighbour in neighbours[index])}
    band = dilate(boundary, neighbours, 2)

    return [edge.index for edge in mesh.edges
            if edge.vertices[0] in band and edge.vertices[1] in band]


def subdivide_linearly(shell, edge_indices, levels):
    """Splits the given edges in half, `levels` times, without moving any existing surface.

    `smooth=0` is what makes it linear: every new vertex lands on the polygon it split, so the
    patch is still exactly the body's surface and the standoff measured afterwards is the standoff
    that was asked for.

    Edges are passed by INDEX rather than as bmesh elements because the caller reads them off the
    mesh and bmesh builds its own; indices are the only thing the two share.
    """
    if levels <= 0 or not edge_indices:
        return

    mesh = bmesh.new()
    mesh.from_mesh(shell.data)
    mesh.edges.ensure_lookup_table()

    wanted = set(edge_indices)
    edges = [edge for edge in mesh.edges if edge.index in wanted]

    for _level in range(levels):
        result = bmesh.ops.subdivide_edges(mesh, edges=edges, cuts=1, smooth=0.0,
                                           use_grid_fill=True)
        edges = [element for element in result["geom_inner"] if isinstance(element, bmesh.types.BMEdge)]

    mesh.to_mesh(shell.data)
    mesh.free()
    shell.data.update()


def shell_offsets(mesh, region):
    """How far each vertex is pushed out: the full offset inside, tapering to the hem at the edge.

    The taper is measured in RINGS OF THE MESH rather than in metres, because the base mesh's edge
    length varies by a factor of several across the body and a metric falloff would be two
    quads wide at the hip and half a quad wide at the chest.
    """
    neighbours = vertex_neighbours(mesh)

    # Ring 0 is the boundary: in the region, with at least one neighbour outside it.
    ring = {}
    frontier = []
    for index in region:
        if any(neighbour not in region for neighbour in neighbours[index]):
            ring[index] = 0
            frontier.append(index)

    depth = 0
    while frontier and depth < FOUNDATION_HEM_RINGS:
        depth += 1
        nextFrontier = []
        for index in frontier:
            for neighbour in neighbours[index]:
                if neighbour in region and neighbour not in ring:
                    ring[neighbour] = depth
                    nextFrontier.append(neighbour)
        frontier = nextFrontier

    offsets = [0.0] * len(mesh.vertices)
    for index in region:
        depth = ring.get(index, FOUNDATION_HEM_RINGS)
        fraction = min(1.0, depth / FOUNDATION_HEM_RINGS)
        offsets[index] = (FOUNDATION_HEM_OFFSET_M +
                          (FOUNDATION_OFFSET_M - FOUNDATION_HEM_OFFSET_M) * fraction)

    return offsets


def vertex_neighbours(mesh):
    """Adjacency over the mesh's edges."""
    neighbours = [[] for _ in mesh.vertices]

    for edge in mesh.edges:
        first, second = edge.vertices
        neighbours[first].append(second)
        neighbours[second].append(first)

    return neighbours


def rename_hide_masks_to_under_masks(mesh):
    """`_hide_<outer>` on the body becomes `_under_<outer>` on a shell cut from it.

    The vertices are the same vertices, so the mapping is a rename and not a computation. The
    prefix changes because the MEANING does: on the body it says "delete me while that is worn",
    and on a foundation garment it says "do not draw me while that is worn". Neither removes the
    foundation garment; see UNDER_MASK_ATTRIBUTE_PREFIX.
    """
    for name in [name for name in mesh.attributes.keys()
                 if name.lower().startswith(HIDE_MASK_ATTRIBUTE_PREFIX)]:
        mesh.attributes[name].name = (UNDER_MASK_ATTRIBUTE_PREFIX +
                                      name[len(HIDE_MASK_ATTRIBUTE_PREFIX):])


def keep_only(shell, region):
    """Keeps the region's faces and nothing else, then drops whatever is left with no face."""
    mesh = bmesh.new()
    mesh.from_mesh(shell.data)
    mesh.verts.ensure_lookup_table()

    outside = [vertex for vertex in mesh.verts if vertex.index not in region]
    bmesh.ops.delete(mesh, geom=outside, context="VERTS")

    loose = [vertex for vertex in mesh.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(mesh, geom=loose, context="VERTS")

    mesh.to_mesh(shell.data)
    mesh.free()
    shell.data.update()


def assign_foundation_material(shell, garment_id, manifest_entry):
    """One plain Principled BSDF, base colour from the manifest palette, and no texture at all.

    🚩 The material's NAME is the manifest id, and that is load-bearing rather than tidy:
    `verify_glb.mjs` resolves a garment by EXACT material name and fails an unlisted one, precisely
    so a `/suit/i` pattern cannot accept any garment for any entry.
    """
    material = bpy.data.materials.new(garment_id)
    material.use_nodes = True

    principled = material.node_tree.nodes.get("Principled BSDF")
    red, green, blue = srgb_hex_to_linear(manifest_entry["palette"][0])
    principled.inputs["Base Color"].default_value = (red, green, blue, 1.0)
    principled.inputs["Roughness"].default_value = FOUNDATION_ROUGHNESS
    principled.inputs["Metallic"].default_value = 0.0

    shell.data.materials.clear()
    shell.data.materials.append(material)


def srgb_hex_to_linear(hex_colour):
    """#rrggbb to linear RGB, the space Blender's node inputs and glTF's baseColorFactor are in."""
    channels = [int(hex_colour[position:position + 2], 16) / 255.0 for position in (1, 3, 5)]

    return tuple(channel / 12.92 if channel <= 0.04045
                 else ((channel + 0.055) / 1.055) ** 2.4
                 for channel in channels)


def describe_foundation(shells, regions, standoffs, marks, membership, manifest_entries):
    """Prints what each shell came out as, and fails the build on the ways it can silently go bad.

    🚩 **A uniform normal offset folds through itself wherever the surface is concave on a radius
    smaller than the offset**, and the foundation layer is cut for exactly the two places on a body
    where that is plausible: the crotch and the armpit. A fold is not visible in a vertex count, a
    face count or a file size, and on a single-sided shell it renders as a hole. `measure_standoff`
    is where it is looked for.

    The other one is a garment that renders beautifully and does not cover the thing it exists to
    cover — checked here against every outfit the decency floor could pick, not against the union
    of all of them. The runtime half of that is in `wardrobe.selftest.mjs` and measures the built
    GLBs geometrically; both are needed, because this one is set algebra over the build's own
    region sets and would be checking its arithmetic against itself if it stood alone
    (docs/LEARNINGS.md §1.25a).
    """
    if not shells:
        return

    print("")
    print("=== foundation layer (9.8) ===")
    print(f"landmarks       : {marks.describe()}")

    problems = []

    for shell, _path, garment_id in shells:
        standoff = standoffs[garment_id]
        nearest, furthest = standoff.nearest, standoff.furthest

        print(f"{garment_id:<24}: {len(shell.data.vertices):>5,} verts  "
              f"{len(shell.data.polygons):>5,} faces  "
              f"standoff {nearest * 1000:.2f}–{furthest * 1000:.2f} mm  "
              f"{standoff.thinned} verts thinned into a crease  "
              f"{standoff.through} through the skin")

        if standoff.through > 0:
            problems.append(f"{garment_id} pushes {standoff.through} vertices THROUGH a surface "
                            "standing in front of them — the gap clamp did not hold")

        # ⚠️ Twice the offset, not the offset. `relax_onto_the_body` is a low-pass filter and a
        # low-pass filter BRIDGES: the vest spans the sternal notch and stands 4.20 mm off the
        # skin at the bottom of it, correctly. What this catches is a normal field or a taper
        # gone wrong, which does not stop at twice.
        if furthest > FOUNDATION_OFFSET_M * 2.0 + 1e-6:
            problems.append(f"{garment_id} stands off up to {furthest * 1000:.2f} mm, which is "
                            f"more than twice the {FOUNDATION_OFFSET_M * 1000:.1f} mm it was cut "
                            "at; the taper or the normals are wrong")

        # ⚠️ An absolute floor rather than a fraction of the hem, for two measured reasons.
        # `nearest` is a perpendicular distance to a triangulated surface, and at a convex ridge
        # that is shorter than the along-normal offset that produced it — the vest's 0.8 mm hem
        # crosses the collarbone at 0.40 mm perpendicular. And in a crease the offset is
        # deliberately a fraction of the hem, because the body left no room: 28 vertices at the
        # crotch. What is NOT allowed is coplanar.
        if nearest < FOUNDATION_MINIMUM_CLEARANCE_M:
            problems.append(f"{garment_id} comes within {nearest * 1000:.3f} mm of the skin, "
                            f"under the {FOUNDATION_MINIMUM_CLEARANCE_M * 1000:.2f} mm floor; "
                            "that close it z-fights")

    for garment_id, region in regions.items():
        per_region = "  ".join(
            f"{name} {len(membership[name] & region):>3}/{len(membership[name]):<3}"
            for name in DECENCY_REGIONS)
        print(f"{garment_id:<24}: covers {per_region}")

    # 🚩 The clause the first build did not have, and it would have shipped a brief with no gusset:
    # every OUTFIT the floor can pick has to cover every region, and "some shell covers it" is not
    # that. A shell that covers the groin is no use if it is the one the floor did not choose.
    for outfit in floor_candidates(regions, manifest_entries):
        covered = set().union(*(regions[garment_id] for garment_id in outfit))
        short = {name: len(membership[name] - covered) for name in DECENCY_REGIONS
                 if membership[name] - covered}

        if short:
            problems.append(f"the floor {'+'.join(outfit)} leaves " +
                            ", ".join(f"{count} {name}" for name, count in short.items()) +
                            " body vertices uncovered")

    if problems:
        raise SystemExit("Build failed: " + "; ".join(problems))


def floor_candidates(regions, manifest_entries):
    """Every set of foundation garments the decency floor could legally pick.

    One garment per body slot, because two garments at one layer sharing a slot is exactly what
    GarmentManifest refuses. The build enumerates them from the manifest's own slots rather than
    from a hardcoded top/bottom pair, so a fifth foundation garment is covered the day it is added.
    """
    by_slot = {}
    for garment_id in regions:
        for slot in manifest_entries[garment_id]["slots"]:
            by_slot.setdefault(slot, []).append(garment_id)

    outfits = [()]
    for slot in sorted(by_slot):
        outfits = [outfit + (garment_id,)
                   for outfit in outfits
                   for garment_id in by_slot[slot]]

    # A garment claiming two slots appears twice in a product; de-duplicate, and drop the outfits
    # that pair two garments which could never be worn together.
    unique = []
    for outfit in outfits:
        candidate = tuple(sorted(set(outfit)))
        if candidate in unique or conflicts_within(candidate, manifest_entries):
            continue
        unique.append(candidate)

    return unique


def conflicts_within(outfit, manifest_entries):
    """True when two garments in this outfit claim the same body slot at the same layer."""
    claimed = set()

    for garment_id in outfit:
        entry = manifest_entries[garment_id]
        for slot in entry["slots"]:
            key = (entry["layer"], slot)
            if key in claimed:
                return True
            claimed.add(key)

    return False


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
        export_attributes=arguments.hide_mask_attribute or bool(arguments.foundation),
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

    manifest_entries = read_wardrobe_manifest(arguments.wardrobe_manifest,
                                              arguments.garment + arguments.foundation)

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
        alpha_mode = manifest_entries[garment_id]["alphaMode"]
        force_alpha_mode(garment_object, alpha_mode)
        print(f"  {garment_object.name}: {alpha_mode} (from the wardrobe manifest)")

    hierarchy = collect_figure_hierarchy(basemesh)
    bake_macro_shape_keys_on_hierarchy(hierarchy)

    # 🎯 The foundation layer is cut LAST, and every word of that is load-bearing. After the helper
    # strip, so the shell is cut from the vertices that ship. After the macro bake, so it is cut
    # from THIS figure rather than from MakeHuman's genderless base — the whole reason a body-
    # derived shell needs no fitting step is that it is derived from the body it will be worn on.
    foundation = []
    if arguments.foundation:
        if rig is None:
            raise SystemExit("Build failed: --foundation measures its cuts from the rig's bone "
                             "heads, and --rig none leaves no rig to measure.")

        marks = measure_landmarks(basemesh, rig)
        membership = decency_region_membership(basemesh, marks,
                                               dominant_bone_per_vertex(basemesh, rig))
        write_decency_attributes(basemesh, membership)

        foundation, regions, standoffs = build_foundation_garments(
            basemesh, rig, marks, arguments, manifest_entries)
        describe_foundation(foundation, regions, standoffs, marks, membership, manifest_entries)

        for shell, _path, garment_id in foundation:
            force_alpha_mode(shell, manifest_entries[garment_id]["alphaMode"])

    fragments = export_garment_fragments(rig, garments + foundation, arguments)

    # A garment written as its own fragment is deliberately absent from the body GLB: the body
    # carries the hide masks for the whole catalogue and the garments arrive on demand.
    garment_objects = {garment_object for garment_object, _path, _id in garments}
    shell_objects = {shell for shell, _path, _id in foundation}
    body_hierarchy = [member for member in hierarchy
                      if (member not in garment_objects or not fragments)
                      and member not in shell_objects]

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
