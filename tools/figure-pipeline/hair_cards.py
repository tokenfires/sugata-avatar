"""Punch-list 3.6 — a procedural hair CARD groom, grown on the figure's own scalp at build time.

The workflow this serves: the figure has no hair, and `docs/OPEN-REQUESTS.md` REQ-061 records that
the whole frame carries no clipping highlight because there is nothing small and bright enough in
it to make one. A face clips where it has hair specular, a wet lip or metal trim, and hair is the
largest of those three. So the groom is the unblocking artefact, and it has to be GEOMETRY before
it can be shading — 3.5's material has nothing to shade until this file runs.

Cards, not strands. `docs/PUNCHLIST.md` 3.5 says "cards default"; three r185 has no strand
primitive and strand rendering is a different performance class.

## Where the hair grows, and why nobody painted it

🎯 **MakeHuman's base mesh already carries a `scalp` vertex group, and this pipeline had never
looked at it.** It is 376 body vertices on the cranium, it is authored by the base mesh rather than
by this build, and — the part that matters — it MOVES WITH THE IDENTITY, because it is a group over
basemesh vertex numbers and every macro and modelling target displaces those vertices. A hand-
painted mask would be correct for `figure_g050.glb` and wrong for the other four the moment they
were rebuilt. `packages/core/src/material/SkinRegions.js` makes the same argument for the facial
shading regions and reads them out of the ARKit morph deltas for the same reason; this is that
argument applied to a region the asset happens to name outright.

The `ears` group is subtracted, because it overlaps the scalp group's lower lateral edge and hair
does not grow out of an ear.

⚠️ The region is read AFTER the macro bake and AFTER the helper strip, in the same place and for
the same reason `--foundation` cuts its shells there: the group has to be read off the vertices
that ship, at the identity that ships.

## The growth field

Three terms, blended, then projected onto the scalp's tangent plane at each root:

  * **radially away from the whorl.** The whorl is measured — the highest point of the scalp
    region, set back by a fraction of the region's own depth — and hair leaves a whorl radially.
    That single term is what makes the crown read as a crown rather than as a seam.
  * **away from the part plane.** A vertical plane at `--hair-part` of the scalp half-width.
    Weighted by a Gaussian in distance from the plane, so it does nothing at the back of the head
    and everything at the fringe.
  * **down.** Gravity at the root, which is small; the rest of gravity arrives during growth.

## The guide curve, and why the collision is inside the integrator rather than after it

Each guide is integrated in `GUIDE_SEGMENTS` steps. After every step the point is pushed back out
to `HAIR_CLEARANCE_M` off the nearest body surface, and while it is still riding the surface the
inward component of the direction is removed so the curve SLIDES over the skull instead of
burrowing into it.

🚩 **A collision pass run only at the end produces a groom that satisfies the clearance gate and
looks wrong.** The curve has already gone through the skull by then, and pushing its vertices out
afterwards flattens them onto the surface in a hard shelf — the shape is a projection of the error,
not a shape. Correcting each step keeps the curve's own arc intact. A final clamp still runs,
because the ribbon's half-width puts card corners where the guide never went, and that one is
genuinely a repair.

## What this file does NOT do

No shading. No anisotropic highlight, no transmission, no per-strand AO — 3.5 owns all of it and
runs after this. What is owed here is geometry worth shading plus the four channel maps
`hair_texture.py` draws, and a material flat enough that the next agent can replace it wholesale.
"""

import math
import os

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import hair_texture


# --- the scalp ----------------------------------------------------------------------------------

# MakeHuman's own names. Both are asserted present rather than defaulted: a silently empty region
# would grow a groom of zero cards and every downstream assertion would pass on nothing.
SCALP_VERTEX_GROUP = "scalp"
EAR_VERTEX_GROUP = "ears"

# 🎯 **THE HAIRLINE IS THE EDGE OF THE FACE'S OWN MOTION, and that is a measurement rather than a
# cut.** MakeHuman's `scalp` group runs down onto the forehead, so roots taken from it unfiltered
# put hair over the brows — the first build did exactly that and the fringe started above the eyes.
# The obvious repair is a height threshold, and a height threshold is wrong in two directions at
# once: the hairline is HIGHER at the front than at the nape, and where it sits depends on the
# skull, so one number cannot serve five identities.
#
# What the asset already knows is which vertices belong to the FACE: the 52 ARKit face units are
# baked onto this mesh (punch-list 0.3), and `browInnerUp` and the two `browOuterUp` targets move
# exactly the forehead skin. Any scalp vertex those targets displace is forehead, by the base
# mesh's own authorship, and it re-derives correctly for a figure nobody has built yet. This is the
# argument `packages/core/src/material/SkinRegions.js` makes for the shading regions, applied to a
# region boundary instead of a region.
#
# The floor is the displacement at which a vertex counts as moved.
#
# ⚠️ **MEASURED, AND SMALLER THAN IT LOOKS.** At 0.15 mm this rule removes 39 of the 376 scalp
# vertices — the forehead-most band of the group and nothing else — because the brow targets simply
# do not reach the rest of the cranium. Raising the floor to 1.2 mm removes ZERO, which is the
# measurement that says what this clause is and is not: it is a precise trim at the front hairline,
# not the thing keeping hair off the face. Keep it small or it does nothing at all.
FACE_MOTION_TARGETS = ("browInnerUp", "browOuterUpLeft", "browOuterUpRight",
                       "browDownLeft", "browDownRight",
                       "eyeWideLeft", "eyeWideRight", "eyeBlinkLeft", "eyeBlinkRight")
FACE_MOTION_FLOOR_M = 0.00015

# A backstop under the morph rule, as a fraction of the surviving region's own height. The morph
# rule cannot reach a vertex no ARKit target happens to touch, and there is a band of temple
# between the brow's reach and the hair — measured at g050, dropping this to 0.0 leaves roots
# 6 mm above the eyebrow. Small, because the morph rule is doing the work.
HAIRLINE_LIFT = 0.06

# The whorl, set back from the highest scalp vertex by this fraction of the region's depth. A whorl
# sits behind the crown on a real head; at 0.0 the radial field is symmetric front-to-back and the
# fringe and the nape get the same treatment, which reads as a bowl.
WHORL_SETBACK = 0.34


# --- the groom ----------------------------------------------------------------------------------

# Minimum standoff from the body, anywhere. The same order as `FOUNDATION_OFFSET_M`, and for the
# same reason: below about 1 mm the depth buffer starts deciding, and this asset is drawn against
# skin that already carries a curvature-driven shading term.
#
# ⚠️ **3.5 mm HERE AGAINST verify_glb.mjs's 3.0 mm FLOOR, AND THE HALF-MILLIMETRE IS NOT SLACK.**
# The two instruments triangulate the body's quads independently — Blender's
# `BVHTree.FromPolygons` on one side, the glTF exporter on the other — and they do not always pick
# the same diagonal, so the same vertex reads differently in each. Measured: a build that converged
# to 3.015 mm by its own instrument read 2.737 mm off the exported file and failed the gate. The
# build aims high enough that the disagreement cannot cross the floor.
HAIR_CLEARANCE_M = 0.0035

# How many times the final repair is allowed to walk a vertex out of a concave crease, and how far
# above the floor it aims.
#
# 🚩 **THE REPAIR AIMS ABOVE THE FLOOR BECAUSE AIMING AT IT MISSES.** Placing a vertex at exactly
# `HAIR_CLEARANCE_M` from its nearest triangle leaves it slightly nearer to a DIFFERENT triangle
# wherever the surface curves, and the build measured that: aiming at 3.000 mm converged to a
# nearest approach of 2.983 mm and failed its own gate by 17 µm. 1.25× is comfortably more than
# the worst curvature error on this body and is invisible at the scale of a hair card.
CLAMP_PASSES = 24
CLAMP_OVERSHOOT = 1.50

# Layers, outermost last. Each is (cards, base standoff m, length m, root half-width m, strip set).
#
# 🚩 **A ONE-SHELL GROOM IS THE "HELMET MADE OF RIBBONS" FAILURE**, and it is the failure this
# structure exists to avoid. A single layer of cards lying on the scalp has exactly the silhouette
# of the scalp; hair has volume because it is many layers of strands at different depths, and the
# only way a card groom gets that is by actually being many layers. The inner layers are dense and
# short and never show an edge — they are there so the scalp does not show through the cutouts —
# and the outer layers are sparse, longer and carry the WISPY strips, so the silhouette is broken
# by a few hairs rather than by a ribbon's straight edge.
#
# The strip set indexes `hair_texture.STRIP_RECIPES`: 0–2 dense, 3–5 mid, 6–7 wisps.
#
# 🎯 **THE `root` LAYER IS THE COVERAGE LAYER AND IT WAS PARTING WITH EVERYTHING ELSE.** A blind
# critic saw a lit scalp at the parting; `verify_glb.mjs`'s new judge-view clause put a number on
# it — 229.1 mm² of bare cranium visible from the front at (0.032, 1.633, 0.105), just to the
# parting's own side of it. The cause is that every layer took the full part push, so at the part
# plane even the innermost cards leaned away from it, and from the front a viewer looked straight
# under them at skin. Real hair parts at the SURFACE; the hair underneath still lies across the
# scalp, which is why a parting is a line and not a bald strip.
#
# So `root` takes a fraction of the part push (`part`) and is denser. It is the only layer that
# gets either: `underlayer` outward is what the eye actually reads as a style, and a groom whose
# every layer ignored the part would have no part.
# How sharply the crown over-sampling concentrates on the faces that point straight up.
# See `sample_roots`; 1 would spread it over the whole upper half of the skull.
CROWN_BIAS_POWER = 2.0

HAIR_LAYERS = [
    {"name": "root", "cards": 104, "standoff": 0.0060, "length": 0.085,
     "half_width": 0.0210, "strips": (1, 2), "gravity": 0.85, "jitter": 0.08,
     "part": 0.20, "crown": 1.60},
    {"name": "underlayer", "cards": 58, "standoff": 0.0110, "length": 0.150,
     "half_width": 0.0180, "strips": (2, 3), "gravity": 1.00, "jitter": 0.11},
    {"name": "body", "cards": 56, "standoff": 0.0165, "length": 0.195,
     "half_width": 0.0160, "strips": (3, 4), "gravity": 1.10, "jitter": 0.14},
    {"name": "surface", "cards": 48, "standoff": 0.0225, "length": 0.225,
     "half_width": 0.0140, "strips": (4, 5, 6), "gravity": 1.20, "jitter": 0.17},
    {"name": "flyaway", "cards": 28, "standoff": 0.0285, "length": 0.245,
     "half_width": 0.0110, "strips": (6, 7), "gravity": 1.30, "jitter": 0.22},
]

# --- the scalp cap ------------------------------------------------------------------------------
#
# 🎯 **THE CAP IS THE FIX FOR BARE SCALP, AND MORE CARDS IS NOT.** The 254-card groom rendered from
# directly above still showed skin between the cards, because a card is only as opaque as its
# cutout and the sheet's cards average 36% coverage — stacking five layers of 36% leaves 10% of the
# crown looking at skin, and it looks exactly like thinning hair. Every production card groom
# answers this the same way: a scalp mesh under the cards, hair-coloured and effectively opaque.
#
# The cap is cut from the scalp region itself, so it fits every identity for the same reason
# `--foundation`'s shells do — it is derived from the body it sits on and has no fitting step to
# drift. Two shells at different offsets, with the radial UV rotated between them, so a texel that
# the inner shell somehow leaves open is not open on the outer one.
CAP_SHELL_OFFSETS_M = (0.0038, 0.0068)

# How many times the cap's strip repeats around the whorl, per shell.
#
# 🚩 **THE TWO SHELLS TILE DIFFERENTLY ON PURPOSE.** A polar UV has a singularity at the whorl —
# every wedge boundary converges on one point — and tiling the same wedge count twice made the two
# rosettes reinforce into a visible kaleidoscope on the crown, which is the one part of the cap a
# top-down view sees. Different counts put the two interference patterns out of phase, and the
# whorl itself is set back (WHORL_SETBACK) so what is left sits behind the crown rather than on it.
#
# ⚠️ **THE WEDGE COUNT IS NOT THE LEVER ON THE "PATENT LEATHER" CROWN, AND IT WAS TRIED.** The
# polar UV's azimuthal density is `wedges / (2π·r)`, which diverges at the whorl — so the strand
# normal there is finer than a texel, the sampler averages it to flat, and a flat dark surface
# under a key light is a mirror. Halving the wedges halves the radius of that collapsed zone, so
# it should have helped. Measured on the `top` plate of `tools/figure-pipeline/hair_shots.mjs`,
# largest connected blown-out blob: 2,280 px at (12, 7) against 2,185 px at (6, 5) — a 4% change,
# bought with strands twice as wide in world space at the cap's rim, which is the "straw" failure
# `hair_texture.py`'s header records. Not worth it. What DID move the crown is cards over it
# (`crown` on the `root` layer, 2,817 px → 2,280 px); the residue is the cap's own shading and
# belongs to whoever owns the strand BSDF, not to the UV.
CAP_WEDGES_PER_SHELL = (12, 7)

# The cap's radial UV runs 0 at the whorl to 1 at CAP_UV_REACH of the region's own radius. Under 1
# because the strand sheet's last rows are its tips: reaching exactly 1.0 would ring the hairline
# with strand ends, and the hairline is the one edge of the cap a viewer can see.
CAP_UV_REACH = 1.35

# Segments per card. Twelve rings is 26 vertices and 24 triangles per card, and it is where the
# curve stops looking faceted at conversational distance: the groom's tightest radius is the turn
# over the crown, roughly 90 mm, and twelve segments over a 215 mm card put 18 mm between rings —
# a 11.5 degree bend, under the ~15 degrees at which a silhouette reads as a polygon.
GUIDE_SEGMENTS = 12

# How much of the card's root width survives to the tip. Hair narrows toward the ends; the alpha
# in the strand sheet does most of that work, and this does the rest so the SILHOUETTE narrows too
# — alpha alone leaves a card whose transparent corners still occlude nothing but still exist.
TIP_WIDTH_FRACTION = 0.62

# Weights of the three root-direction terms, before the tangent projection. Radial dominates
# because it is the term that carries the crown; the part term is strong but local (see
# PART_FALLOFF); gravity at the root is deliberately small, because a root that already points
# down cannot lie along the skull.
RADIAL_WEIGHT = 1.00
PART_WEIGHT = 1.05
ROOT_GRAVITY_WEIGHT = 0.30

# Width of the part's influence, as a fraction of the scalp half-width.
#
# 🚩 **WIDE ON PURPOSE — THIS IS ALSO WHAT KEEPS HAIR OFF THE FACE.** At 0.55 the part is a local
# feature and the fringe falls straight down over the eyes and the nose, which is the single worst
# thing a groom can do on a page whose whole purpose is a face. At 1.10 the term reaches the whole
# front half of the scalp and the fringe sweeps sideways past the cheek instead of down it.
PART_FALLOFF = 1.10

# How far gravity turns the heading at each segment, at the tip, before the layer's own `gravity`
# multiplier. Applied as s^GRAVITY_POWER so the root end stays flat against the skull.
#
# 🚩 **THE FIRST VERSION EXPRESSED THIS PER METRE AND THE GROOM CAME OUT AS A SEA URCHIN.** The
# heading is a UNIT vector; adding `2.30 · s^1.6 · step` to it with a 15.5 mm step adds 0.045 at
# the tip, which is a 2.6° turn — over twelve segments the card left the scalp tangentially and
# flew straight out. A bend is an angle and has to be authored as one: 0.55 at the tip is a 29°
# turn per segment, and the last third of a card ends up pointing at the floor.
GRAVITY_PER_SEGMENT = 0.55
GRAVITY_POWER = 1.60

# 🎯 **THE HUG, which is the whole difference between hair and a hedgehog.** A curve leaving a
# convex skull along its tangent plane travels in a straight line and the skull curves away
# underneath it, so a "push out when too close" rule NEVER FIRES AGAIN after the first step and the
# card sails off into space. Hair does the opposite: it lies on the head until the head stops
# supporting it. So while the card is still in its attached phase the point is pulled back DOWN to
# `standoff` above the nearest surface, and the heading is re-derived from where it actually landed
# rather than from where it was aimed.
#
#   ATTACH_END      the arc fraction at which the hair stops being supported and starts falling
#   ATTACH_STRENGTH how much of the gap is closed per segment while attached
#   HUG_REACH       how far the surface can be and still hold the hair. Beyond this the nearest
#                   body point is something the hair is merely passing — the cheek, the shoulder —
#                   and hugging it would drag the fall onto the face.
ATTACH_END = 0.62
ATTACH_STRENGTH = 0.75
HUG_REACH = 0.045

# Twist along a card, radians end to end. A ribbon with a constant frame is a flat plane and reads
# as one; a small twist means the card presents a different profile at its tip than at its root.
CARD_TWIST = 0.35

# Bone every hair vertex is weighted to.
#
# 🚩 **100% head, and that is a decision rather than a shortcut.** Hair grows out of the skull and
# there is no cloth simulation on this asset; a blend toward `neck_01` would make the tail LAG the
# surface it is rooted in every time the head turns, which is a worse artefact than a tail that
# moves rigidly. When a sim exists the tail's weights are where it attaches.
HAIR_BONE = "head"

HAIR_MATERIAL_PREFIX = "hair_"
HAIR_FRAGMENT_FILENAME = "g{:03d}.glb"

# Which channel maps the GLB carries and which ship beside it.
#
# `albedo` is embedded, because the fragment has to render on its own — a groom that needs a
# sidecar to show a silhouette cannot be looked at, and looking at it is the acceptance test.
# `normal` is embedded for the same reason: without the strand cylinder a card is a flat plane.
# `flow` and `depth` are written loose next to the GLB, because nothing in glTF's material model
# has a socket for them and packing them into an unused one would be a lie the next reader has to
# discover. 3.5 loads them by name out of the manifest.
EMBEDDED_MAPS = ("albedo", "normal")
SIDECAR_MAPS = ("flow", "depth")


def build_hair(basemesh, rig, arguments):
    """Grows the groom and returns (object, style id, report). Call after the macro bake.

    Mirrors `build_foundation_garments`'s contract closely enough that main() treats a groom and a
    foundation shell the same way at export time, and deliberately does not return the
    (object, path, id) garment triple: hair is not in the wardrobe manifest and must not resolve
    against it.
    """
    style = arguments.hair
    collide = not arguments.no_hair_collision
    scalp = read_scalp_region(basemesh)
    frame = ScalpFrame(basemesh, scalp)

    body = body_surface_of(basemesh)

    cards = []
    per_layer = []
    for layer in HAIR_LAYERS:
        grown = grow_layer(basemesh, frame, body if collide else None, layer, arguments)
        per_layer.append((layer["name"], len(grown)))
        cards.extend(grown)

    if not cards:
        raise SystemExit("Build failed: the groom came out with zero cards, which means the scalp "
                         "region selected nothing at this identity.")

    # 🚩 `--no-hair-cap` is the red proof for the coverage gate and nothing else. Without the
    # shells the groom is cards only, which is the state the top-down render showed bare skin in.
    shells = [] if arguments.no_hair_cap else build_scalp_cap(basemesh, frame)

    hair_object = assemble_cards(basemesh, cards, shells, style)
    clamped, nearest = clamp_cards_off_the_body(hair_object, body, collide)
    weight_to_head(hair_object, rig)
    bind_to_rig(hair_object, basemesh, rig)

    texture_directory = hair_texture_directory(arguments, style)
    maps = hair_texture.write_strand_atlas(texture_directory, seed=arguments.hair_seed,
                                           colour=arguments.hair_colour)
    assign_hair_material(hair_object, style, dict((name, path) for name, path, _ in maps))

    report = HairReport(style, frame, per_layer, hair_object, clamped, nearest, maps,
                        texture_directory, collide, len(shells))

    return hair_object, style, report


# --- the scalp region ---------------------------------------------------------------------------


def read_scalp_region(basemesh):
    """The body vertex indices hair is allowed to grow from, off MakeHuman's own `scalp` group.

    Ears are subtracted rather than filtered by height: the two groups overlap on the lower lateral
    edge of the cranium, and a height cut there would either keep the top of the ear or lose the
    hair above it, depending on the identity. A group difference cannot drift.
    """
    scalp_group = basemesh.vertex_groups.get(SCALP_VERTEX_GROUP)
    if scalp_group is None:
        raise SystemExit(
            f"Build failed: the basemesh has no '{SCALP_VERTEX_GROUP}' vertex group. The groom's "
            "region is read from the base mesh rather than painted, and there is nothing to read.")

    ear_group = basemesh.vertex_groups.get(EAR_VERTEX_GROUP)

    def in_group(vertex, group):
        return group is not None and any(entry.group == group.index for entry in vertex.groups)

    face = face_moved_vertices(basemesh)

    region = {vertex.index for vertex in basemesh.data.vertices
              if in_group(vertex, scalp_group)
              and not in_group(vertex, ear_group)
              and vertex.index not in face}

    if not region:
        raise SystemExit(f"Build failed: '{SCALP_VERTEX_GROUP}' minus '{EAR_VERTEX_GROUP}' minus "
                         "the face's own motion is empty on this figure.")

    return region


def face_moved_vertices(basemesh):
    """Body vertices any of FACE_MOTION_TARGETS displaces. See the constant for why these decide.

    Reads the shape keys off the mesh rather than being told which vertices are face: the keys are
    already there — `load_expression_shape_keys` put them on before the rig — and a key block is
    literally a list of moved positions.
    """
    shape_keys = basemesh.data.shape_keys
    if shape_keys is None:
        raise SystemExit("Build failed: the basemesh carries no shape keys, so the hairline cannot "
                         "be measured from the face's own motion. --no-face-parts and a build "
                         "without the ARKit units both land here.")

    basis = shape_keys.key_blocks.get("Basis")
    if basis is None:
        raise SystemExit("Build failed: the basemesh has shape keys but no 'Basis' to measure "
                         "displacement against.")

    present = [name for name in FACE_MOTION_TARGETS if name in shape_keys.key_blocks]
    if not present:
        raise SystemExit(f"Build failed: none of {list(FACE_MOTION_TARGETS)} is on the basemesh. "
                         "The hairline is the edge of the face's motion and there is no motion "
                         "to read.")

    moved = set()
    for name in present:
        block = shape_keys.key_blocks[name]
        for index in range(len(block.data)):
            if (block.data[index].co - basis.data[index].co).length > FACE_MOTION_FLOOR_M:
                moved.add(index)

    return moved


class ScalpFrame:
    """Everything the growth field measures itself against, in the basemesh's own local space.

    Every number here comes off the mesh. The AUTHORED constants above are all fractions of one of
    these, which is what makes one set of parameters produce a correctly-placed groom at any point
    on the identity axes — the same construction `BodyLandmarks` uses for the foundation layer.
    """

    def __init__(self, basemesh, region):
        mesh = basemesh.data
        points = [mesh.vertices[index].co.copy() for index in region]

        self.low = Vector((min(p.x for p in points), min(p.y for p in points),
                           min(p.z for p in points)))
        self.high = Vector((max(p.x for p in points), max(p.y for p in points),
                            max(p.z for p in points)))

        self.height = self.high.z - self.low.z
        self.depth = self.high.y - self.low.y
        self.half_width = max(abs(self.low.x), abs(self.high.x))

        # The hairline. Everything below it is forehead, temple and nape that the group reaches
        # into; see HAIRLINE_LIFT.
        self.hairline_z = self.low.z + HAIRLINE_LIFT * self.height

        self.faces = [polygon for polygon in mesh.polygons
                      if all(index in region for index in polygon.vertices)
                      and polygon.center.z >= self.hairline_z]

        if not self.faces:
            raise SystemExit("Build failed: no scalp face survives the hairline cut. "
                             f"HAIRLINE_LIFT is {HAIRLINE_LIFT} of a {self.height * 1000:.1f} mm "
                             "region.")

        self.area = sum(polygon.area for polygon in self.faces)
        self.vertex_count = len(region)
        self.face_count = len(self.faces)

        crown = max((mesh.vertices[index].co for index in region), key=lambda co: co.z)
        # The face is at -Y on this mesh, so setting the whorl BACK means increasing y.
        self.whorl = Vector((0.0, crown.y + WHORL_SETBACK * self.depth, crown.z))
        self.crown = crown.copy()

        # The centre the ribbons face away from. Not the scalp centroid: a card hanging beside the
        # jaw has to face outward from the HEAD, and the scalp's centroid is above the jaw.
        self.head_centre = Vector((0.0,
                                   (self.low.y + self.high.y) * 0.5,
                                   self.low.z - self.height * 0.25))

    def describe(self):
        return (f"scalp {self.vertex_count} verts, {self.face_count} faces above the hairline, "
                f"{self.area * 1e4:.1f} cm²  |  crown z {self.crown.z:.4f}  "
                f"hairline z {self.hairline_z:.4f}  height {self.height * 1000:.1f} mm  "
                f"depth {self.depth * 1000:.1f} mm  half-width {self.half_width * 1000:.1f} mm")


def body_surface_of(basemesh):
    """A BVH of the whole shipped body, which is what the groom must stay outside of.

    The WHOLE body rather than the head: a 215 mm card grown from the nape reaches the trapezius,
    and a groom that clears the skull and passes through a shoulder has solved the easy half.
    """
    mesh = basemesh.data

    return BVHTree.FromPolygons([vertex.co.copy() for vertex in mesh.vertices],
                                [list(polygon.vertices) for polygon in mesh.polygons])


# --- growing a layer ----------------------------------------------------------------------------


def grow_layer(basemesh, frame, body, layer, arguments):
    """One shell of cards: sample roots, grow a guide from each, ribbon each guide."""
    import random as random_module

    # 🚩 **`hash()` ON A str IS SALTED PER PROCESS, and the first version used it.** `PYTHONHASHSEED`
    # is random unless it is set, so `hash(layer["name"])` returned a different number every run and
    # the groom was NOT reproducible from its seed — `assets/hair/manifest.json` says it is. It was
    # caught by a rebuild that produced a card 5.250 mm inside the skull where the previous run of
    # the same command had produced 3.517 mm of clearance. The layer's INDEX is stable, ordered and
    # already unique.
    random = random_module.Random(arguments.hair_seed * 1000 + HAIR_LAYERS.index(layer))

    roots = sample_roots(basemesh, frame, layer["cards"], random,
                         layer.get("crown", 0.0))

    cards = []
    for index, (position, normal) in enumerate(roots):
        direction = root_direction(position, normal, frame, arguments.hair_part, layer, random)
        guide = grow_guide(position, normal, direction, body, frame, layer, random)
        strip = layer["strips"][index % len(layer["strips"])]
        cards.append(ribbon_of(guide, frame, layer, strip, random))

    return cards


def sample_roots(basemesh, frame, count, random, crown_bias):
    """`count` root points on the scalp, area-weighted and spread by dart throwing.

    🚩 Uniform random sampling of a surface CLUMPS, and a clumped groom has bald patches next to
    doubled cards — which is the same defect a bald patch is, arriving twice. Dart throwing with a
    minimum separation derived from the region's own area is the cheapest fix that does not need a
    relaxation pass: `radius` is 80% of the spacing a perfect hexagonal packing of `count` discs
    over this area would have, so the target count is reachable but the packing is still even.
    """
    mesh = basemesh.data
    faces = frame.faces

    # 🎯 **AREA-WEIGHTED ALONE PUTS THE FEWEST CARDS WHERE THE MOST ARE NEEDED.** Uniform density
    # over the scalp is uniform density measured ON the scalp, and the scalp is not what a viewer
    # sees. A card on the side of the head is seen edge-on and hides several times its own width;
    # a card on the crown is seen face-on and hides its width and no more. So the crown needs more
    # cards per square centimetre than the sides do, and area weighting gives it the same.
    #
    # The weight is the face's own UPWARDNESS, which needs no length scale and therefore fits every
    # identity — and it is deliberately not a Gaussian about the whorl, which was the first version
    # and which FAILED at g100: the whorl is set back by WHORL_SETBACK, so weighting about it pulls
    # cards off the front of the crown, and `verify_glb.mjs`'s judge-view clause put 227.6 mm² of
    # bare scalp at (0.038, 1.698, 0.112) — the top of the forehead on the largest skull in the
    # sweep. Upwardness covers the whorl and the front of the crown alike.
    #
    # This is also what keeps the cap from being the visible surface at the whorl, where its polar
    # UV converges and reads as the "patent leather" the generator's author flagged.
    weights = [polygon.area * (1.0 + crown_bias * max(0.0, polygon.normal.normalized().z)
                               ** CROWN_BIAS_POWER) for polygon in faces]
    total = sum(weights)

    cumulative = []
    running = 0.0
    for weight in weights:
        running += weight
        cumulative.append(running / total)

    radius = math.sqrt(frame.area / (count * math.pi)) * 0.80

    accepted = []
    attempts = 0
    attempt_ceiling = count * 60

    while len(accepted) < count and attempts < attempt_ceiling:
        attempts += 1

        target = random.random()
        low, high = 0, len(cumulative) - 1
        while low < high:
            middle = (low + high) // 2
            if cumulative[middle] < target:
                low = middle + 1
            else:
                high = middle
        polygon = faces[low]

        point = random_point_on(mesh, polygon, random)
        if any((point - existing).length < radius for existing, _ in accepted):
            continue

        accepted.append((point, polygon.normal.copy().normalized()))

    return accepted


def random_point_on(mesh, polygon, random):
    """A uniform point inside a polygon, by fanning it into triangles about its first vertex."""
    corners = [mesh.vertices[index].co for index in polygon.vertices]

    # Quads only, in practice — the MakeHuman base mesh is all quads and a handful of triangles.
    fan = [(corners[0], corners[i], corners[i + 1]) for i in range(1, len(corners) - 1)]
    areas = [(b - a).cross(c - a).length * 0.5 for a, b, c in fan]
    pick = random.random() * sum(areas)

    running = 0.0
    chosen = fan[-1]
    for triangle, area in zip(fan, areas):
        running += area
        if pick <= running:
            chosen = triangle
            break

    a, b, c = chosen
    u = random.random()
    v = random.random()
    if u + v > 1.0:
        u, v = 1.0 - u, 1.0 - v

    return a + (b - a) * u + (c - a) * v


def root_direction(position, normal, frame, part_fraction, layer, random):
    """Which way the hair leaves the scalp at this root. See "The growth field" in the header."""
    radial = position - frame.whorl
    radial = tangent_component(radial, normal)
    if radial.length < 1e-6:
        radial = tangent_component(Vector((0.0, 1.0, 0.0)), normal)

    part_x = part_fraction * frame.half_width
    from_part = position.x - part_x
    falloff = max(PART_FALLOFF * frame.half_width, 1e-6)
    part_strength = math.exp(-(from_part / falloff) ** 2) * layer.get("part", 1.0)

    # Away from the plane, and toward the front where the part actually shows. `sign` is taken on
    # a nudged value so a root sitting exactly on the plane still picks a side rather than
    # cancelling to zero and falling back on radial alone.
    side = 1.0 if from_part >= 0.0 else -1.0
    part_push = tangent_component(Vector((side, 0.0, 0.0)), normal) * part_strength

    direction = (radial.normalized() * RADIAL_WEIGHT
                 + part_push * PART_WEIGHT
                 + tangent_component(Vector((0.0, 0.0, -1.0)), normal) * ROOT_GRAVITY_WEIGHT)

    jitter = layer["jitter"]
    direction += Vector((random.uniform(-jitter, jitter),
                         random.uniform(-jitter, jitter),
                         random.uniform(-jitter, jitter)))

    direction = tangent_component(direction, normal)
    if direction.length < 1e-6:
        direction = tangent_component(Vector((0.0, 1.0, -1.0)), normal)

    return direction.normalized()


def tangent_component(vector, normal):
    """`vector` with everything along `normal` removed — the tangent plane's copy of it."""
    return vector - normal * vector.dot(normal)


def grow_guide(root, root_normal, direction, body, frame, layer, random):
    """Integrates one guide curve from the scalp outward, sliding over whatever is in the way."""
    standoff = layer["standoff"]
    step = layer["length"] / GUIDE_SEGMENTS

    point = root + root_normal * standoff
    points = [point.copy()]

    # A per-guide length scale so the layer's cards do not all end on the same line, which is a
    # horizontal edge across the groom and the second most obvious card artefact after the ribbon.
    length_scale = 0.80 + 0.40 * random.random()
    # A constant per-guide nudge added at every segment, so a card bows one way over its length
    # rather than wobbling. Scaled small: this is added to a UNIT heading twelve times, so 0.15 of
    # the layer's jitter is already a visible curve by the tip.
    curl = Vector((random.uniform(-1.0, 1.0), random.uniform(-1.0, 1.0),
                   random.uniform(-1.0, 1.0))) * layer["jitter"] * 0.15

    for segment in range(GUIDE_SEGMENTS):
        s = (segment + 1) / GUIDE_SEGMENTS
        previous = point.copy()

        bend = GRAVITY_PER_SEGMENT * layer["gravity"] * (s ** GRAVITY_POWER)
        direction = (direction + Vector((0.0, 0.0, -1.0)) * bend + curl).normalized()

        point = point + direction * step * length_scale

        if body is None:
            points.append(point.copy())
            continue

        location, surface_normal, distance = signed_distance_to(body, point)
        attached = max(0.0, (ATTACH_END - s) / ATTACH_END)

        if location is not None and distance < standoff:
            point = location + surface_normal * standoff
        elif location is not None and attached > 0.0 and distance < standoff + HUG_REACH:
            point = point.lerp(location + surface_normal * standoff, attached * ATTACH_STRENGTH)

        # Re-derived from where the point LANDED, not from where it was aimed. Without this the
        # heading keeps the pre-collision direction and the next step undoes the hug — the curve
        # bounces along the skull instead of lying on it.
        travelled = point - previous
        if travelled.length > 1e-9:
            direction = travelled.normalized()

        points.append(point.copy())

    return points


def ribbon_of(guide, frame, layer, strip, random):
    """Turns a guide curve into a quad strip: positions, UVs and the strip it samples.

    The card's own frame is built from the curve tangent and an OUTWARD direction taken from the
    head centre rather than from the scalp normal. Past the first few segments a scalp normal is
    meaningless — the curve has left the scalp — and a frame that keeps referring to it flips as
    the curve passes the ear.
    """
    twist = random.uniform(-CARD_TWIST, CARD_TWIST)
    width_scale = 0.75 + 0.5 * random.random()

    rings = []
    for index, point in enumerate(guide):
        s = index / (len(guide) - 1)

        if index == 0:
            tangent = (guide[1] - guide[0])
        elif index == len(guide) - 1:
            tangent = (guide[-1] - guide[-2])
        else:
            tangent = (guide[index + 1] - guide[index - 1])
        tangent = tangent.normalized() if tangent.length > 1e-9 else Vector((0.0, 0.0, -1.0))

        outward = point - frame.head_centre
        outward = tangent_component(outward, tangent)
        if outward.length < 1e-9:
            outward = tangent_component(Vector((0.0, 1.0, 0.0)), tangent)
        outward.normalize()

        across = tangent.cross(outward).normalized()

        angle = twist * s
        across = (across * math.cos(angle) + outward * math.sin(angle)).normalized()

        half = (layer["half_width"] * width_scale
                * (1.0 - (1.0 - TIP_WIDTH_FRACTION) * s))

        rings.append((point - across * half, point + across * half, s))

    return {"rings": rings, "strip": strip, "layer": layer["name"]}


# --- assembly -----------------------------------------------------------------------------------


def build_scalp_cap(basemesh, frame):
    """The opaque shells under the cards. Returns a list of {points, faces, uvs} per shell.

    Built straight out of the scalp region's own faces rather than by copying and stripping the
    body: the cap needs custom UVs at every corner anyway, and a fresh bmesh from `frame.faces` is
    both shorter and free of the shape keys, attributes and materials a body copy drags along.

    **The UV is polar about the whorl.** v is the distance from the whorl, so the sheet's root
    darkening lands where a real crown is darkest and its strands radiate the way a crown's do;
    u is the azimuth, wrapped `CAP_WEDGES` times across the cap strip. The azimuth of each corner
    is unwrapped relative to its own FACE's azimuth, because a face that straddles the seam would
    otherwise have one corner at u≈0 and its neighbour at u≈1 and would render the entire strip
    compressed into one quad.
    """
    mesh = basemesh.data
    radius = max((mesh.vertices[index].co - frame.whorl).length
                 for polygon in frame.faces for index in polygon.vertices)

    shells = []
    for shell_index, offset in enumerate(CAP_SHELL_OFFSETS_M):
        # Half a wedge of rotation between shells, so the inner shell's wedge boundary sits in the
        # middle of the outer shell's wedge.
        wedges = CAP_WEDGES_PER_SHELL[shell_index]
        rotation = shell_index * 0.5 / wedges

        points = {}
        faces = []
        for polygon in frame.faces:
            face_azimuth = azimuth_about(polygon.center - frame.whorl)
            corners = []
            for index in polygon.vertices:
                vertex = mesh.vertices[index]
                if index not in points:
                    points[index] = vertex.co + vertex.normal * offset
                corners.append((index, cap_uv(vertex.co - frame.whorl, face_azimuth, radius,
                                              rotation, wedges)))
            faces.append(corners)

        shells.append({"points": points, "faces": faces})

    return shells


def azimuth_about(offset):
    """The angle of a scalp offset about the vertical axis, zero at the FRONT of the head.

    Zero at the front — the face is at −Y on this mesh — so the ±pi wrap lands at the BACK, where
    the seam it causes is under the most hair.
    """
    return math.atan2(offset.x, -offset.y)


def cap_uv(offset, face_azimuth, radius, rotation, wedges):
    """Polar UV for one cap corner. See `build_scalp_cap` for why the azimuth is unwrapped."""
    columns = hair_texture.STRIP_COLUMNS
    inset = 1.0 / hair_texture.ATLAS_SIZE

    angle = azimuth_about(offset)
    while angle - face_azimuth > math.pi:
        angle -= math.tau
    while angle - face_azimuth < -math.pi:
        angle += math.tau

    around = (angle / math.tau + 0.5 + rotation) * wedges
    across = around - math.floor(around)

    strip_left = hair_texture.CAP_STRIP / columns + inset
    strip_right = (hair_texture.CAP_STRIP + 1) / columns - inset

    v = min(offset.length / (radius * CAP_UV_REACH), 1.0)

    return (strip_left + (strip_right - strip_left) * across, 1.0 - v)


def assemble_cards(basemesh, cards, shells, style):
    """Builds the one hair mesh out of every card and both cap shells, with their UVs.

    Cards share no vertices. That is deliberate and it is what makes the card count MEASURABLE off
    the exported file — `verify_glb.mjs` counts connected components and classifies each one by its
    topology — and it is also correct: two cards that shared a vertex would share a UV, and their
    strips are different. The cap shells are the components that are NOT quad strips, which is how
    the gate tells them apart without being told how many of either to expect.
    """
    mesh = bmesh.new()
    uv_layer = mesh.loops.layers.uv.new("UVMap")

    for shell in shells:
        made = {index: mesh.verts.new(point) for index, point in shell["points"].items()}
        for corners in shell["faces"]:
            # `faces.new` keeps the order it is given, so the loops come back in corner order and
            # the UVs can be zipped straight on.
            face = mesh.faces.new([made[index] for index, _uv in corners])
            for loop, (_index, uv) in zip(face.loops, corners):
                loop[uv_layer].uv = uv

    columns = hair_texture.STRIP_COLUMNS
    # One texel of inset either side of the strip, so bilinear filtering at the card's edge cannot
    # reach into the neighbouring strip. `hair_texture.strand_room` already keeps the strands off
    # the boundary; this keeps the SAMPLER off it too.
    inset = 1.0 / hair_texture.ATLAS_SIZE

    for card in cards:
        left_column = card["strip"] / columns + inset
        right_column = (card["strip"] + 1) / columns - inset

        previous = None
        for left_point, right_point, s in card["rings"]:
            left = mesh.verts.new(left_point)
            right = mesh.verts.new(right_point)

            if previous is not None:
                face = mesh.faces.new((previous[0], previous[1], right, left))
                loops = face.loops
                for loop in loops:
                    at_left = loop.vert in (previous[0], left)
                    at_root = loop.vert in previous
                    loop[uv_layer].uv = (left_column if at_left else right_column,
                                         1.0 - (previous[2] if at_root else s))

            previous = (left, right, s)

    mesh.verts.index_update()
    mesh.faces.index_update()

    data = bpy.data.meshes.new(f"{HAIR_MATERIAL_PREFIX}{style}")
    mesh.to_mesh(data)
    mesh.free()

    hair_object = bpy.data.objects.new(f"Human.{HAIR_MATERIAL_PREFIX}{style}", data)
    basemesh.users_collection[0].objects.link(hair_object)
    hair_object.matrix_world = basemesh.matrix_world.copy()

    # Hair reads as smooth strands, not as facets. Without this the card's twelve rings are twelve
    # visible bands under any moving light, which is a worse artefact than the twist it hides.
    for polygon in data.polygons:
        polygon.use_smooth = True

    return hair_object


def clamp_cards_off_the_body(hair_object, body, collide=True):
    """Final repair: no hair vertex closer to the body than HAIR_CLEARANCE_M.

    The guide integrator already keeps the CURVE clear, but a card is the curve plus half a width
    either side, and a corner of a card leaning into the neck was never checked by the integrator.
    Returns (vertices moved, nearest approach after the repair, in metres).

    `collide=False` measures without repairing, which is `--no-hair-collision`: the distances are
    still reported so the red proof can quote how far INTO the skull the broken groom reaches.

    🚩 **ONE PASS DOES NOT CONVERGE, and the first version was one pass** — it left a vertex
    1.445 mm off a 3.000 mm floor and failed the build, which is the gate working. Pushing a vertex
    out along its nearest triangle's normal is only exact where the surface is locally flat. In a
    CONCAVE crease — the jaw-to-neck junction and the shoulder gutter, which is precisely where a
    falling card lands — the repaired position is closer to a neighbouring triangle than it was to
    the one that moved it. Repeating the repair walks the vertex out of the crease; the loop stops
    when nothing moves, and the caller fails the build if the floor is still violated.
    """
    moved = 0
    target = HAIR_CLEARANCE_M * CLAMP_OVERSHOOT
    if collide:
        for _pass in range(CLAMP_PASSES):
            moved_this_pass = 0
            for vertex in hair_object.data.vertices:
                location, normal, distance = signed_distance_to(body, vertex.co)
                if location is None or distance >= HAIR_CLEARANCE_M:
                    continue
                vertex.co = location + normal * target
                moved_this_pass += 1

            moved += moved_this_pass
            if moved_this_pass == 0:
                break

    nearest = None
    for vertex in hair_object.data.vertices:
        _location, _normal, distance = signed_distance_to(body, vertex.co)
        if distance is not None and (nearest is None or distance < nearest):
            nearest = distance

    hair_object.data.update()

    return moved, nearest


def signed_distance_to(body, point):
    """Nearest point on the body, its normal, and the SIGNED distance to it.

    🚩 **UNSIGNED DISTANCE IS NOT A CLEARANCE, AND THIS FILE SHIPPED A GROOM THAT PROVED IT.** The
    first version tested `find_nearest`'s raw distance against the floor, and a card that had
    travelled straight through the skull was 17 mm from the nearest surface — comfortably OUTSIDE a
    3 mm floor — so the build reported a nearest approach of 3.018 mm while 161 vertices sat inside
    the head. `verify_glb.mjs` caught it off the exported file, which is the whole argument for
    measuring the artefact rather than the script that wrote it.

    The sign is the face normal at the closest point dotted with the direction out to the query.
    A face normal rather than an interpolated one because that is what `BVHTree.find_nearest`
    hands back, and the disagreement between the two only matters within a fraction of a
    millimetre of the surface — where the clamp is going to move the vertex anyway.
    """
    location, normal, _index, distance = body.find_nearest(point)
    if location is None:
        return None, None, None

    return location, normal, math.copysign(distance, (point - location).dot(normal) or 1.0)


def weight_to_head(hair_object, rig):
    """Every hair vertex rigidly on the head bone. See HAIR_BONE for why it is only that bone."""
    if HAIR_BONE not in rig.data.bones:
        raise SystemExit(f"Build failed: the rig has no '{HAIR_BONE}' bone, and hair that is not "
                         "weighted to the skull stays behind when the head turns.")

    group = hair_object.vertex_groups.new(name=HAIR_BONE)
    group.add([vertex.index for vertex in hair_object.data.vertices], 1.0, "REPLACE")


def bind_to_rig(hair_object, basemesh, rig):
    """Parents the groom to the rig and gives it the armature modifier the skin export reads."""
    hair_object.parent = basemesh.parent if basemesh.parent else rig
    hair_object.matrix_parent_inverse = hair_object.parent.matrix_world.inverted()

    # 🚩 **AFTER the parent inverse, and the first version was before.** Blender composes a world
    # matrix as parent · parent-inverse · basis, so writing `matrix_world` and THEN changing the
    # parent inverse silently moves the object — the groom exported 16.7 mm inside the skull and
    # every Blender-side measurement, taken before the parenting, still read 3.001 mm of
    # clearance. The gate caught it off the file, which is the entire argument for measuring the
    # artefact rather than the script.
    hair_object.matrix_world = basemesh.matrix_world.copy()

    modifier = hair_object.modifiers.new(name="Armature", type="ARMATURE")
    modifier.object = rig


# --- the material -------------------------------------------------------------------------------


def assign_hair_material(hair_object, style, maps):
    """One Principled BSDF wired to the generated albedo and normal sheets, cut out with MASK.

    🚩 The material's NAME is `hair_<style>` and that is load-bearing exactly the way
    `assign_foundation_material`'s is: `verify_glb.mjs` recognises a hair fragment by it, and a
    fragment nothing recognises is verified as a FIGURE and fails on 89 missing morph targets.

    Deliberately plain. Punch-list 3.5 replaces every node in here with an anisotropic strand
    model; what it must not have to do is unpick a clever material first.
    """
    material = bpy.data.materials.new(f"{HAIR_MATERIAL_PREFIX}{style}")
    material.use_nodes = True

    # The MASK cutout and the double-sidedness are NOT set here. `build_figure.force_alpha_mode`
    # owns both for every part of the figure — it is what puts the `alpha > ALPHA_MASK_CUTOFF`
    # node in and what clears backface culling — and `hair_texture.OPAQUE_ENOUGH` is pinned to the
    # same cutoff so the sheet's coverage report describes what the renderer will actually keep.

    tree = material.node_tree
    principled = tree.nodes.get("Principled BSDF")
    principled.inputs["Roughness"].default_value = 0.38
    principled.inputs["Metallic"].default_value = 0.0

    albedo = tree.nodes.new("ShaderNodeTexImage")
    albedo.image = bpy.data.images.load(maps["albedo"])
    albedo.image.colorspace_settings.name = "sRGB"
    albedo.location = (-600, 200)
    tree.links.new(principled.inputs["Base Color"], albedo.outputs["Color"])
    tree.links.new(principled.inputs["Alpha"], albedo.outputs["Alpha"])

    normal_texture = tree.nodes.new("ShaderNodeTexImage")
    normal_texture.image = bpy.data.images.load(maps["normal"])
    normal_texture.image.colorspace_settings.name = "Non-Color"
    normal_texture.location = (-600, -200)

    normal_map = tree.nodes.new("ShaderNodeNormalMap")
    normal_map.location = (-300, -200)
    tree.links.new(normal_map.inputs["Color"], normal_texture.outputs["Color"])
    tree.links.new(principled.inputs["Normal"], normal_map.outputs["Normal"])

    hair_object.data.materials.clear()
    hair_object.data.materials.append(material)


# --- output -------------------------------------------------------------------------------------


def hair_texture_directory(arguments, style):
    return os.path.join(os.path.abspath(arguments.hair_dir), style)


def export_hair_fragment(rig, hair_object, arguments, export_glb):
    """Writes the groom to `<hair-dir>/<style>/g<NNN>.glb`, rig included, exactly like a garment.

    `export_glb` is passed in rather than imported: `build_figure.py` imports this module, and a
    module that imports it back is a cycle that Blender's `--python` loader resolves in whichever
    order it happens to reach the files.
    """
    gender_suffix = int(round(arguments.gender * 100))
    path = os.path.join(hair_texture_directory(arguments, arguments.hair),
                        HAIR_FRAGMENT_FILENAME.format(gender_suffix))

    # 🚩 **NO BAKED TANGENT, AND `docs/research/hair.md` §6.1 ASKS FOR ONE.** It was tried and
    # measured: `export_tangents=True` makes Blender's exporter split vertices at tangent
    # discontinuities, and the groom's clean topology — 254 quad-strip components of 13 rings each,
    # plus 2 cap shells of 564 triangles — came out as 284 ragged components with ring counts of
    # 2/3/6/7/9/10/11/13/63 and the cap shattered into 12 fragments. That destroys the property the
    # card-count gate is built on, and it buys nothing: a card's UV is axis-aligned BY
    # CONSTRUCTION, so the UV-derived tangent is exactly the card's U axis and the strand direction
    # is its bitangent, with no degeneracy anywhere on the mesh. What the shader needs protected is
    # that the UV stays axis-aligned, and `verify_glb.mjs` asserts precisely that instead.
    export_glb([rig, hair_object], path, arguments)

    return path


class HairReport:
    """What the groom actually came out as, and the checks that fail the build rather than ship."""

    def __init__(self, style, frame, per_layer, hair_object, clamped, nearest, maps,
                 texture_directory, collide=True, shells=0):
        self.collide = collide
        self.shells = shells
        self.style = style
        self.frame = frame
        self.per_layer = per_layer
        self.clamped = clamped
        self.nearest = nearest
        self.maps = maps
        self.texture_directory = texture_directory

        mesh = hair_object.data
        self.vertices = len(mesh.vertices)
        self.faces = len(mesh.polygons)
        self.triangles = sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)
        self.cards = sum(count for _name, count in per_layer)

        lows = [vertex.co.z for vertex in mesh.vertices]
        self.lowest = min(lows)
        self.highest = max(lows)

    def describe(self, fragment_path):
        print("")
        print("=== hair (punch-list 3.6) ===")
        print(f"style           : {self.style}")
        print(f"region          : {self.frame.describe()}")
        for name, count in self.per_layer:
            print(f"layer           : {name:11s} {count:3d} cards")
        print(f"cards           : {self.cards}")
        print(f"scalp cap       : {self.shells} shell(s) at "
              f"{', '.join(f'{offset * 1000:.1f}' for offset in CAP_SHELL_OFFSETS_M[:self.shells])}"
              f" mm{'' if self.shells else '   [--no-hair-cap: RED PROOF BUILD]'}")
        print(f"geometry        : {self.vertices:,} verts, {self.faces:,} quads, "
              f"{self.triangles:,} triangles")
        print(f"extent          : z {self.lowest:.4f} to {self.highest:.4f} "
              f"({(self.highest - self.lowest) * 1000:.1f} mm tall)")
        print(f"clearance       : {self.clamped} vertices clamped, nearest approach "
              f"{self.nearest * 1000:.3f} mm (floor {HAIR_CLEARANCE_M * 1000:.1f} mm)"
              f"{'' if self.collide else '   [--no-hair-collision: RED PROOF BUILD]'}")
        for name, path, size in self.maps:
            embedded = "embedded" if name in EMBEDDED_MAPS else "sidecar"
            print(f"map             : {name:7s} {embedded:8s} {size:,} bytes  {path}")
        print(f"fragment        : {fragment_path} "
              f"({os.path.getsize(fragment_path):,} bytes)")

        # 🚩 Every one of these has been a silent failure in a neighbouring system on this project,
        # which is why they stop the build rather than print a warning nobody reads.
        if self.collide and self.nearest is not None and self.nearest < HAIR_CLEARANCE_M - 1e-6:
            raise SystemExit(
                f"Build failed: a hair vertex sits {self.nearest * 1000:.3f} mm from the body, "
                f"inside the {HAIR_CLEARANCE_M * 1000:.1f} mm floor. The clamp did not converge.")
        if self.cards < 100:
            raise SystemExit(f"Build failed: {self.cards} cards is not a groom. The dart throwing "
                             "in sample_roots ran out of room before it reached the target.")
