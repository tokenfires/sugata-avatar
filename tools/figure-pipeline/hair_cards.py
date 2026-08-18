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

## One haircut, or many

`--hair <name>` selects a SHAPE out of `HAIR_STYLES`, not just an output directory. Everything that
describes the physics of growing hair on a body — the clearance floor, the two solvers, the segment
count — is a module constant; everything that describes one haircut is a key in that table, and
`apply_style` binds the chosen entry over this module's globals once, at the top of `build_hair`.
The table's own header carries the split, the reasoning for the rebind, and what it costs. A second
style is a dict.

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

# The three numbers that decide WHERE ON THE SCALP one haircut starts — the hairline lift, the
# whorl setback and the forehead band — are in HAIR_STYLES rather than here. ⚠️ The whorl is the
# closest call in the whole split: a real head's whorl does not move when the hair is cut, so it is
# anatomy by that reading. It is style by the one that decided it — the whorl is the ORIGIN of the
# radial growth field, and a groom that runs its hair off a different point is a different groom.


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

# How far the radial rescue may walk a vertex the passes could not free, in units of the
# clamp's own overshoot. 24 is 126 mm, comfortably past the deepest fold on this body — the
# ear — and the count is reported so a groom that needs many of them is visible rather than
# quietly repaired. See `clamp_cards_off_the_body`.
RESCUE_STEPS = 24

# The layer stack itself — HAIR_LAYERS and CROWN_BIAS_POWER — is the style's, not the
# physics'. It is in HAIR_STYLES.

# --- locks --------------------------------------------------------------------------------------
#
# 🎯 **THE FOLLICLES ARE EVEN AND THE SHAFTS ARE NOT, AND THAT IS WHY THE FIX IS NOT IN
# `sample_roots`.** The obvious reading of "hair clumps" is "clump the roots", and it is wrong on
# the head and wrong here. Follicles really are close to evenly distributed — `sample_roots`'s dart
# throwing is right and stays — and a lock forms further down, where neighbouring shafts touch and
# then travel together. Clumping the roots instead would move the bald patches around without
# making a single lock, because two roots 3 mm apart still fly apart at the tip if nothing holds
# them.
#
# So a lock is a shared ATTRACTOR CURVE. `LOCK_COUNT` centres are dart-thrown over the scalp once
# for the whole groom, every layer grows its own guide from each centre with its own standoff and
# length, and every card is drawn toward the guide of its nearest centre by a weight that is zero at
# the root and `clump` at the tip.
#
# 🚩 **THE CENTRES ARE SHARED ACROSS THE LAYERS ON PURPOSE.** Per-layer locks were the first
# arrangement and they are five independent grooms stacked: the surface layer's locks land between
# the body layer's, so the mass has no through-line and reads as depth-sorted noise. One set of
# centres means a lock is a column of hair from the scalp to the tip, which is what a lock is.
#
# HOW MANY locks, how their centres are spread, how hard a card is drawn into one and how much of
# the deflection budget the lock owns are all in HAIR_STYLES: a bob shows a dozen locks and a
# tight curl shows a hundred. The mechanism above is not a style's to change. ⚠️ LOCK_COUNT is
# also written into the mesh's own extras (`assemble_cards`) and `verify_glb.mjs` re-derives the
# channel from THOSE, so a style that changes it does not break the gate.

# How many times a blended guide is walked back out of the body. See `draw_into_lock`.
CLUMP_CLEARANCE_PASSES = 3

# 🎯 **THE LOCK CHANNEL — R25. THE MEMBERSHIP `nearest_lock` ALREADY COMPUTES, CARRIED OUT OF THIS
# FILE AND INTO THE MESH.**
#
# Everything above this line has existed since R22 and NONE of it reached the shader.
# `assemble_cards` writes `u` = the atlas STRIP (one of eight, shared by every card on it) and
# `v` = root-to-tip, and the exported GLB carried POSITION / NORMAL / TEXCOORD_0 / JOINTS_0 /
# WEIGHTS_0 and nothing else. So the renderer had no lock id, no card id and no per-card UV offset
# to derive one from, and `HairMaterial.js` re-derived a lock field in SPACE — a hashed-cell Voronoi
# over `positionGeometry.xz` — because that was the only lock-scale coordinate available to it.
# R24 measured what that cost: the re-derived field is a lock-scale FIELD and not lock MEMBERSHIP,
# it changes down a card that wanders horizontally, and it agrees with this file's own Voronoi
# nowhere in particular. See `docs/CHECKPOINT.md` §7.
#
# A SECOND UV LAYER IS THE CHANNEL, and the choice was verified rather than assumed:
#
#   * Blender's exporter writes one `TEXCOORD_i` per entry of `mesh.uv_layers`, in creation order,
#     with no filter for "used by a material" — `io_scene_gltf2/blender/exp/primitive_extract.py:110`
#     sets `tex_coord_max = len(self.blender_mesh.uv_layers)` under `gltf_texcoords` alone.
#   * three r185's `GLTFLoader.js:2228` maps `TEXCOORD_1` → the geometry attribute `uv1`, and TSL's
#     `nodes/accessors/UV.js` resolves `uv(1)` to `attribute('uv1','vec2')`. Both were read in the
#     installed tree, not recalled.
#
# 🚩 **AND A CUSTOM `_LOCK` ATTRIBUTE WAS THE OTHER CANDIDATE AND IS WORSE HERE.** It works — the
# `_HIDE_*` garment masks prove the path — but it needs `export_attributes=True`, which this build
# only sets when a garment asked for it, and `GLTFLoader` lower-cases the name the exporter
# upper-cases (LEARNINGS Part 2). Two spellings and a conditional export flag, against a channel
# three already names.
#
# WHAT THE TWO FLOATS ARE:
#
#   u1  the LOCK INDEX, as `(index + 0.5) / LOCK_COUNT`. Recovered in the shader by
#       `floor(u1 * LOCK_COUNT)`, which is exact: with LOCK_COUNT 16 every emitted value is an
#       odd multiple of 1/32 and binary-exact in f32, and the +0.5 puts it in the middle of its
#       bin so no rounding at either end can walk it into a neighbour. It is CONSTANT over a whole
#       card — `nearest_lock` is evaluated once at the root, exactly as the groom's own clumping
#       is — so it interpolates to itself and carries no seam.
#
#   v1  the VORONOI EDGE DISTANCE `(d2 − d1)`, normalised and clamped to [0,1]. Zero on a lock
#       boundary, one at a lock core. This is false-earth's `centerFactor` input measured on the
#       GENERATOR'S OWN sites rather than re-hashed from a grid, and it is what the two shading
#       mechanisms this round did not ship would need: a card in a groove is the card whose root
#       sits where two locks meet.
#
# 🚩 **THE SECOND-NEAREST IS COMPUTED, NOT ESTIMATED.** `lock_membership` sorts all sixteen centres
# rather than taking a 3x3 neighbourhood, because sixteen sites over one scalp is not a grid and a
# neighbourhood scan on a dart-thrown set can miss the true second-nearest. Sixteen is small enough
# that the exact answer is free.
LOCK_UV_LAYER = "LockMap"

# The metre scale `(d2 − d1)` is divided by before it is clamped, and it is a division rather than
# a taste: `LOCK_COUNT` centres spread over the scalp's own measured area give a cell of
# `sqrt(area / LOCK_COUNT)` a side, which is the spacing between neighbouring centres and therefore
# the largest `d2 − d1` a cell core can produce. Taken off `ScalpFrame.area` so it tracks the
# identity like every other length in this file — 513.2 cm² at g050 gives 56.6 mm — and written
# into the mesh's own extras so `verify_glb.mjs` can re-derive the channel instead of trusting it.
# `lock_edge_scale` is the function, down with the other lock code.

# --- the scalp cap ------------------------------------------------------------------------------
#
# 🎯 **THE CAP IS THE FIX FOR BARE SCALP, AND MORE CARDS IS NOT.** The 254-card groom rendered from
# directly above still showed skin between the cards, because a card is only as opaque as its
# cutout and the sheet's cards average 36% coverage — stacking five layers of 36% leaves 10% of the
# crown looking at skin, and it looks exactly like thinning hair. Every production card groom
# answers this the same way: a scalp mesh under the cards, hair-coloured and effectively opaque.
#
# Its three constants — the shell offsets, the wedge counts, the UV reach — are in HAIR_STYLES: how
# far a cap stands off is the stack the cards are laid over, and that is the haircut. ⚠️ The inner
# shell is 3.8 mm on bob01 against a HAIR_CLEARANCE_M of 3.5 mm, and the cap's vertices go through
# `clamp_cards_off_the_body` with everything else — so a style that puts the shell under the floor
# is authoring a surface the clamp will push back out. The offsets are style; the floor is not.


# --- the guide curve ----------------------------------------------------------------------------

# Segments per card. Sixteen segments is seventeen rings, 34 vertices and 32 triangles, and the
# number is set by the ring SPACING rather than chosen: the groom's tightest radius is the turn over
# the crown, roughly 90 mm, and a silhouette reads as a polygon somewhere past a ~15 degree bend per
# ring, which is about 24 mm of arc at that radius.
#
# ⚠️ **TWELVE WAS RIGHT FOR A 215 mm CARD AND IS NOT RIGHT FOR THIS ONE.** Cutting to a plane means
# a card rooted at the crown travels over the skull AND down to the cut. Measured over the five
# bakes the median card is 187–202 mm and the 90th percentile 322–344 mm; twelve segments would put
# 27–29 mm between rings at that percentile, over the 24 mm the crown's turn allows. Sixteen brings
# it to 20–21 mm and costs 29% more triangles — 8,184 to 10,536, measured on the 294-card groom
# this number was taken from. The `mass` layer has since taken the same groom to 13,224.
GUIDE_SEGMENTS = 16

# 🚩 **GUIDE_SEGMENTS IS THE ONE JUDGEMENT CALL IN THE STYLE/PHYSICS SPLIT, AND IT STAYED GLOBAL.**
# It reads like a style number — the ring count is a tessellation choice and a short groom could
# carry fewer — and three other things are already pinned to it, none of them in this file:
#
#   * GRAVITY_PER_SEGMENT, GRAVITY_POWER and CURL_SHARE_OF_JITTER are authored PER SEGMENT and say
#     so in their own comments ("0.55 over twelve is 0.41 over sixteen"). Those three ARE style, so
#     a style that moved the count without rescaling all three would silently change the fall of
#     every card it thought it had left alone — the exact silent-difference failure this table's
#     guards exist to stop, arriving through a number the guards cannot see.
#   * the runtime's spring chains are one particle per ring: `docs/CHECKPOINT.md` §13 measures 496
#     chains and 8,432 particles on this groom, which is 17 each.
#   * `docs/research/rendering-stack.md` names TressFX `.tfx` as the interchange pivot and its
#     strands are 16 points.
#
# A style may not move a number three other systems have agreed on. Moving it later is a decision
# about all four, not about this line.

# --- the cut ------------------------------------------------------------------------------------
#
# 🎯 **A HAIRCUT IS A CUT, AND THE GROOM DID NOT HAVE ONE.** See HAIR_LAYERS for the measurement.
# The cut plane for a layer is `frame.hairline_z - cut · frame.height`, so it is derived from the
# region the same way every other number in this file is and lands correctly on an identity nobody
# has built. Two mechanisms take a card to it, and both are needed:
#
#   THE LENGTH IS CORRECTED, not the curve. The naive fix is to grow every card long and trim the
#   overshoot, and it deforms the SHAPE: the gravity bend and the attached phase are both functions
#   of the arc fraction `s`, so a card grown to 400 mm and trimmed at 140 mm keeps only its first
#   third — which is the part that is still lying flat against the skull. The card comes out as a
#   curve that never falls. So the length is re-derived from where the card actually landed and the
#   card is REGROWN at it, which keeps `s` meaning what it means.
#
#   THEN IT IS TRIMMED. The correction is a Newton step on a nearly-linear relation and it leaves a
#   few millimetres; a few millimetres times 484 cards is a fuzzy line rather than a cut one.
#
# ⚠️ The upper bound is a runaway guard rather than a style choice. A card that leaves the crown
# almost horizontally descends a few millimetres over its whole length, so `wanted / achieved` is
# enormous and one Newton step asks for a metre of hair; measured, the first build with 2.60 in
# here produced a 655 mm card against a 90th percentile of 322 mm.
CUT_CORRECTIONS = 3
CUT_LENGTH_BOUNDS = (0.45, 1.80)

# The shortest a cut may leave a card, as a fraction of the layer's own first guess. A root at the
# nape sits barely above the underlayer's cut plane, and without a floor its card is trimmed to a
# stub whose ribbon is a triangle.
CUT_MINIMUM_LENGTH = 0.35

# 🚩 **AND A FOURTH GUARD, WHICH IS THE ONE THE CUT FIELD BELOW MADE NECESSARY.** `cut_height` may
# now RAISE a card's cut plane, and a plane raised past the card's own root is a plane the guide
# never descends through — so `arc_length_at_height` falls through to "never crossed" and returns
# the WHOLE polyline. The card that should have been the shortest in the groom comes out the
# longest, silently, at one root. `grow_to_cut` therefore asks which side of the root the plane is
# on before it trusts the arc length; see the guard there for the measurement that says how close
# bob01 already runs to it — 15.35 mm at the fringe and 60.38 mm at `underlayer`'s nape, which a
# CUT_FADE_HEIGHT of 0.38 at line 0.0 closes exactly.

# 🚩 **THREE OF THE `CUT_*` FAMILY ARE HERE AND THREE ARE IN THE STYLE TABLE, WHICH LOOKS LIKE
# AN OVERSIGHT AND IS NOT.** These three are guards on a SOLVER: how many Newton steps the
# length correction takes, how far one step may ask for, and the floor under a trimmed card so
# its ribbon is not a triangle. All three are expressed as multiples of the layer's own first
# guess, so they are scale-free — a groom twice as long scales them with it and needs none of
# them changed. CUT_LOCK_JITTER, CUT_CARD_JITTER and CUT_GRADUATION are the opposite: they are
# the point-cut scatter and the face-framing rake, which is what a stylist would call the cut.
# The test used throughout this split: changing it for a new haircut is a DESIGN act (style) or
# a BUG FIX (physics).


# --- the export ---------------------------------------------------------------------------------

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


# --- the style table ----------------------------------------------------------------------------
#
# 🎯 **`--hair STYLE` SELECTS A SHAPE HERE, AND UNTIL THIS TABLE EXISTED IT SELECTED A DIRECTORY
# NAME.** `docs/CHECKPOINT.md` §13 measured what that cost: the three CLI knobs that were the only
# authored variation — `--hair-part`, `--hair-seed`, `--hair-colour` — move the silhouette LESS
# than baking the same groom on a different gender does (front IoU 0.8352 against a 0.8329
# control), so shipping them as a second style would have shipped one haircut twice. The lever the
# same section found is this file's module globals, and this is that lever with a handle on it.
#
# Everything ABOVE this line is the physics of growing hair on a body: a clearance floor, two
# solvers' iteration counts, the segment count three other systems have agreed on, the region the
# base mesh itself names. Everything BELOW it is one haircut. The dividing question, applied
# constant by constant: changing it for a new style is a DESIGN act, or it is a BUG FIX.
#
# THE MECHANISM IS A REBIND OF THIS MODULE'S OWN GLOBALS, once, from the first statement of
# `build_hair`. That is the crudest of the obvious designs and it is deliberate:
#
#   * the build is single-shot. `build_figure.py` grows one groom per process — one `--hair`
#     argument, one call to `build_hair` — so there is never a second style in flight and there is
#     no state to keep apart. A module global IS the process's one style.
#   * the alternative is threading a style object through the ~15 geometry functions below, and
#     that is the change most likely to introduce a silent numerical difference. The only warrant
#     this refactor has is that bob01 still bakes byte for byte to sha256 `98ca6c23…`, and that
#     warrant is worth something only because the diff inside the geometry code is ZERO — not one
#     expression in `grow_guide`, `root_direction`, `cut_height` or `ribbon_of` changed. A
#     parameter object would have touched every one of them.
#   * it keeps the table DECLARATIVE. A style is a dict of numbers and a list of layer dicts, with
#     no code in it, which is what makes a second haircut an edit to data.
#
# ⚠️ **WHAT IT COSTS, PRICED HONESTLY FOR WHOEVER WANTS TO OVERTURN IT.** The module carries
# process-wide mutable state, so two grooms in one process would need the second `apply_style` to
# clobber the first — correct only because nothing holds a reference to a value across a call. The
# names have no value at all until `apply_style` runs, so a unit test that imports this module and
# calls a geometry function directly gets `NameError` rather than a bob default; that is the
# intended trade, because a default is the failure mode below. When a second process-level consumer
# appears — a batch baker, a server — this is the thing to change, and the change is mechanical.
#
# 🚩 **A TYPO MUST NOT FALL BACK TO THE BOB, WHICH IS WHY BOTH DIRECTIONS FAIL LOUDLY.** This
# project's recurring failure is a wrong number that nothing checks, and `"WHORL_SETBAK": 0.20` in
# a new style would be exactly that: the groom builds, the whorl is bob01's, and the author spends
# the round wondering why the crown will not move. So `apply_style` requires the style's key set to
# equal STYLE_PARAMETERS EXACTLY — an unknown key and a missing one are both a failed build, at the
# first statement of `build_hair`, before Blender has spent a second on geometry.
#
# ⚠️ **`grow_layer` SEEDS ITS RNG WITH `HAIR_LAYERS.index(layer)`, SO THE LAYER ORDER IS PART OF
# THE STYLE'S IDENTITY.** A style with a different number of layers, or the same layers in a
# different order, re-rolls every root, every deflection and every cut jitter below the change.
# That is FINE ACROSS STYLES — a new haircut is a new draw, and its own bake is its own control —
# and it is FATAL WITHIN ONE: inserting an entry into bob01's stack in envelope order would rebuild
# the groom underneath it, which is why both `veil` and `fringe` are appended rather than inserted
# and say so in their own comments. Add to the END of a stack that has already shipped.


# The parameters a style owns, and the authority on what a style dict may contain. Explicit rather
# than derived from bob01's keys: a schema taken off one entry is not a schema, it is that entry.
STYLE_PARAMETERS = (
    # where on the scalp this haircut starts
    "HAIRLINE_LIFT", "WHORL_SETBACK", "FOREHEAD_FRACTION",
    # the shells, and how their roots are spread
    "HAIR_LAYERS", "CROWN_BIAS_POWER",
    # the locks
    "LOCK_COUNT", "LOCK_CROWN_BIAS", "CLUMP_POWER", "LOCK_DIRECTION_SHARE",
    # the fringe's own field
    "FRINGE_FORWARD",
    # the opaque scalp cap under the cards
    "CAP_SHELL_OFFSETS_M", "CAP_WEDGES_PER_SHELL", "CAP_UV_REACH",
    # the cut line
    "CUT_LOCK_JITTER", "CUT_CARD_JITTER", "CUT_GRADUATION", "TIP_WIDTH_FRACTION",
    # the cut FIELD — how the cut line varies over the scalp. See `taper_at`.
    "CUT_FADE_HEIGHT", "CUT_FADE_HEIGHT_LINE", "CUT_FADE_SIDE", "CUT_FADE_SIDE_LINE",
    # the growth field at the root
    "RADIAL_WEIGHT", "PART_WEIGHT", "ROOT_GRAVITY_WEIGHT", "PART_FALLOFF",
    # what happens to a card on the way down
    "GRAVITY_PER_SEGMENT", "GRAVITY_POWER", "CURL_SHARE_OF_JITTER",
    "ATTACH_FADE", "ATTACH_STRENGTH", "HUG_REACH", "CARD_TWIST",
)

# What one entry of a style's HAIR_LAYERS may carry. The optional ones are the trap: every reader
# of them below is a `layer.get(name, default)`, so `"clmup": 0.6` would build a groom with the
# default clump and no complaint from anything. Same rule as the style keys — declare or fail.
LAYER_REQUIRED = ("name", "cards", "standoff", "length", "half_width", "strips", "gravity",
                  "jitter", "cut", "clump")
LAYER_OPTIONAL = ("crown", "part", "tip_width", "cut_scatter", "graduation", "front", "fringe",
                  "taper")


# =================================================================================================
# bob01 — the collarbone bob. Side-parted, face-framing, cut to a graduated plane, with a fringe.
#
# Every number below shipped in `assets/hair/bob01/`, and each arrived with the paragraph above it.
# Nothing here changed when the table was built: the file it came out of bakes g050 to the same
# sha256 it did before, which is the only claim this refactor makes.
# =================================================================================================

HAIR_STYLES = {}

HAIR_STYLES["bob01"] = {
    # A backstop under the morph rule, as a fraction of the surviving region's own height. The morph
    # rule cannot reach a vertex no ARKit target happens to touch, and there is a band of temple
    # between the brow's reach and the hair — measured at g050, dropping this to 0.0 leaves roots
    # 6 mm above the eyebrow. Small, because the morph rule is doing the work.
    "HAIRLINE_LIFT": 0.06,

    # The whorl, set back from the highest scalp vertex by this fraction of the region's depth. A whorl
    # sits behind the crown on a real head; at 0.0 the radial field is symmetric front-to-back and the
    # fringe and the nape get the same treatment, which reads as a bowl.
    "WHORL_SETBACK": 0.34,

    # The share of the region's depth that counts as "the front" — the band the fringe is rooted in and
    # the band `ScalpFrame.forehead_z` is taken over. One constant rather than a per-layer key, because
    # the cut reference and the root set have to be the SAME band or the fringe is cut to a line it was
    # never grown from.
    "FOREHEAD_FRACTION": 0.34,

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
    #
    # 🎯 **ROUND 21: FEWER AND WIDER, AND THE REASON IS THE SAMPLING RATE RATHER THAN THE FILL BUDGET.**
    # Round 20 traced the strand from the sheet to the pixel and proved it cannot survive: the atlas
    # offers 3.637 runs per card width and the frame delivers 0.786. Two links ate it, and a card's
    # WIDTH is the lever on both.
    #
    #   1. **THE LOD.** The lod a card is sampled at is `log2(128 / its scene-pass width)` — a strip is
    #      128 texels wide however wide the quad is — so a card 40% wider is read half a mip finer and
    #      the same sheet arrives with more of its structure intact. Measured on the shipped groom at
    #      the shipped framing: 55.3 CSS px per card, 36.5 on the scene pass, lod 2.011.
    #   2. **THE STACK.** Median NINE cards between the eye and the face, and 64.51% of front-most hair
    #      pixels over 0.99 opaque through that stack, so a gap in the front card is a window onto the
    #      next card of the same albedo. Expected depth is TOTAL CARD AREA over the groom's footprint,
    #      which is the arithmetic that says what does and does not move it: trading count for width at
    #      constant area moves it NOT AT ALL. Depth falls only when the area falls.
    #
    # So every layer's count is cut harder than its width is raised — the area comes down, the cards
    # come up in size, and the opacity that the removed layers were providing is bought back by moving
    # the layers that lie across the face onto DENSER STRIPS instead (`body` and `surface` below).
    #
    # 🚩 **AND THE FIRST ATTEMPT WENT TWICE AS FAR AND WAS REJECTED BY EYE, WHICH IS THE BOUND ON THIS
    # WHOLE IDEA AND IS WHY IT IS RECORDED RATHER THAN DELETED.** Built, rendered at portrait and
    # three-quarter on `alive.html` and on `hair.html`, and looked at:
    #
    #   |                                | cards | half-width | depth p50/p90 | scene card px | lod p50 |
    #   |--------------------------------|------:|-----------:|--------------:|--------------:|--------:|
    #   | shipped before this round      |   648 |      1.00× |          9/64 |          36.5 |   2.011 |
    #   | attempt 1, rejected            |   336 |      1.36× |          7/40 |          49.6 |   1.664 |
    #   | this list                      |   462 |      1.18× |          8/48 |          39.4 |   1.962 |
    #
    # **EVERY NUMBER IN ATTEMPT 1's ROW IS BETTER AND THE PICTURE IS WORSE.** Its delivered structure
    # was the best any build has measured — STACKED runs per card 0.734 against the shipped 0.599, and
    # the atlas arriving at 3.681 sampled runs against 3.496 — and at 49.6 scene-pass pixels a card's
    # own QUAD becomes a readable shape: the crown grows hard-edged bright parallelograms two to three
    # times the size of the shipped groom's, and a dead-straight card border runs from the crown past
    # the jaw, which is verbatim the defect a blind critic named at round 18 and `STRIP_GUTTER_PX` was
    # written for. The facets are present in all three builds — they are the cards catching the key
    # light — so the bound is not "wide cards make facets", it is that **a card's edge treatment is a
    # fixed share of its 128-texel strip, so magnifying the card magnifies the facet with it.** 39 px
    # is inside the shipped groom's own facet size and 50 px is not. `verify_glb.mjs`'s card-border
    # clause cannot see this: it measures the boundary's raggedness on the ATLAS, in texels, and the
    # atlas did not change.
    #
    # ⚠️ **`flyaway` IS UNTOUCHED, AND THAT IS THE ONE ENTRY IN THIS LIST THAT MUST STAY THAT WAY.** It
    # is the outermost layer, it carries strips 6 and 7, and the tapering tips it draws are the one part
    # of this groom every blind critic has praised. The round's thesis is that alpha's remaining job is
    # the silhouette and the wisps; this layer IS that job.
    #
    # How sharply the crown over-sampling concentrates on the faces that point straight up.
    # See `sample_roots`; 1 would spread it over the whole upper half of the skull.
    "CROWN_BIAS_POWER": 2.0,

    # 🎯 **"MESSY" IS TWO MEASURABLE PROPERTIES, AND `cut` AND `clump` ARE THEM.** The owner said the
    # groom "still looks odd, messy I suppose"; the generator's own author had already flagged "the card
    # ends are stringy"; a blind critic independently called it "a wet, matted black mop … the visual
    # language of 'unwashed' rather than 'styled'" and "brush strokes". Three observers, one word, so
    # the question was what the word IS. Measured off the shipped `assets/hair/bob01/g050.glb`:
    #
    #   1. **THE ENDS DO NOT LINE UP.** Card tips, per layer, spanned 123–163 mm from the 10th to the
    #      90th percentile — on a scalp region 172.8 mm tall. Over the whole groom the tip z p10→p90 was
    #      211 mm. A haircut IS a cut line; this had none anywhere, because a card's length was the
    #      layer's length times `0.80 + 0.40 · random()` and its tip therefore landed wherever its root
    #      happened to be, plus 20% either way. That is the "stringy tips" verbatim.
    #   2. **THE CARDS DIVERGE.** Nearest-neighbour distance between card TIPS was 16.3 mm against
    #      11.5 mm between their ROOTS — a ratio of 1.416, so every card ended 42% further from its
    #      neighbours than it started. Hair does the opposite: it gathers into locks and a lock's tip is
    #      tighter than its root. A groom whose cards fan apart is a mop by construction, whatever each
    #      individual card looks like.
    #
    # So `cut` is the drop below the hairline, as a fraction of the region's own height, that this
    # layer is cut to (`None` for the coverage layer, which is never seen from outside and must not be
    # shortened). And `clump` is how far this layer's cards are drawn into their lock by the tip.
    #
    # ⚠️ **THE COVERAGE LAYER TAKES ALMOST NO CLUMP, AND THAT IS THE CONSTRAINT ON THE WHOLE IDEA.**
    # Clumping is cards moving TOGETHER, which is cards moving AWAY from somewhere else, and the
    # somewhere else is the scalp the `root` layer exists to hide. `verify_glb.mjs`'s exposed-patch and
    # visible-skin clauses are what hold that line; `root` is at 0.15 because at 0.5 they go red.
    #
    # `length` is now the FIRST GUESS at the arc a card needs to reach its cut plane rather than the
    # length it ends up with — see `grow_to_cut`, which corrects it against where the card actually
    # landed. The guesses are roughly 1.35× the drop, which is what the wrap over the skull costs.
    "HAIR_LAYERS": [
        {"name": "root", "cards": 78, "standoff": 0.0060, "length": 0.085,
         "half_width": 0.0235, "strips": (1, 2), "gravity": 0.85, "jitter": 0.08,
         "part": 0.20, "crown": 1.60, "cut": None, "clump": 0.15},
        # 🎯 **`mass` IS THE COVERAGE LAYER FOR THE LENGTH, AND ITS ABSENCE IS WHY A BLIND CRITIC CALLED
        # THE GROOM A STOCKING.** *"You can see the bald skull's silhouette through it, you can see her
        # far-side ear through it, and from a rear three-quarter you can read her nose and eye socket."*
        #
        # The groom already had a coverage layer and a coverage texel — `root` above and
        # `hair_texture.CAP_STRIP` — and both stop at the scalp. `root` is `cut: None`, so its tips sit
        # at z 1.5411 ± 56.7 mm against a hairline at 1.4970: it is a hat. Everything below the hairline
        # — the fringe over the forehead, the side masses past the jaw, the ends over the collarbone —
        # was covered only by `underlayer`, `body`, `surface` and `flyaway`, which carry strips 2–7,
        # whose mean alpha runs 0.55 down to 0.12.
        #
        # Measured on `alive.html` this session, per hair-covered pixel, as the share of the light from
        # behind the groom that still reaches the camera (`tools/figure-pipeline/hair_opacity.mjs`):
        # **0.8229 at one card crossing, 0.6487 at two, 0.4240 at three** — an effective per-card alpha
        # of 0.18–0.25 where the strips say 0.38–0.59, because the layers a viewer's ray meets first are
        # the thin ones. The transmittance map is green over the crown, where `root` and the cap are,
        # and red everywhere they are not.
        #
        # 🚩 **IT IS AN INTERIOR LAYER AND EVERY NUMBER IN IT IS CHOSEN TO KEEP IT ONE.** A layer that
        # made the mass opaque and then showed its own quad edge at the silhouette would trade this
        # defect for the one `STRIP_GUTTER_PX` was written for. So: `standoff` inside `underlayer`'s,
        # `gravity` below every visible layer's so it swings less far out, `cut` above `surface`'s so
        # its ends stop short of the ones a viewer reads, `clump` high enough that it gathers into the
        # same sixteen locks rather than fanning between them, and `strips` the one strip in the sheet
        # that is near-opaque WITH a broken border (`hair_texture.INTERIOR_STRIP`).
        {"name": "mass", "cards": 100, "standoff": 0.0135, "length": 0.290,
         "half_width": 0.0200, "strips": (1,), "gravity": 1.06, "jitter": 0.10,
         "crown": 0.50, "cut": 0.84, "clump": 0.60, "tip_width": 0.26},
        # 🎯 **THE STRIPS ON THESE THREE MOVED ONE COLUMN DENSER, AND THAT IS THE OTHER HALF OF THE
        # CURTAIN FIX.** See `veil` at the bottom of this list for the measurement that forced it. The
        # short version: 17,312 px of the portrait's face is under EXACTLY ONE card and nothing else,
        # that card transmits 0.70, and no layer added behind it can help because those cards are the
        # frontier of the groom — an interior shell placed inboard of them missed by 4 points of reach
        # and one placed outboard missed entirely, leaving the face-conditioned raster byte-identical to
        # the build before it. What is left is the card itself, and a card's opacity is its strip.
        #
        # So each of the three layers that actually lie across the face gives up its thinnest strip and
        # takes the next one down the sheet. Coverage at the 0.5 cutoff, from `hair_texture`'s own
        # table: strip 1 0.592, 2 0.550, 3 0.507, 4 0.437, 5 0.381, 6 0.175, 7 0.121.
        #
        # 🎯 **ROUND 21 SHIFTED THEM A SECOND COLUMN, AND THIS IS HOW THE ROUND PAYS FOR ITS MISSING
        # CARDS.** `body` goes (2,3) → (1,2) and `surface` goes (3,4,5) → (2,3), so the two layers that
        # are the frontier over the cheek no longer carry a strip whose mean alpha starts with a 3. It
        # is the same argument one column further and it is what keeps the transmittance clauses from
        # regressing when a third of the cards leave: MEASURED, whole change together, portrait —
        #
        #   C4 the curtain 0.4516 → **0.4098** (ceiling 0.35, red both ways)   C3 the mass 0.0943 →
        #   **0.0808** (ceiling 0.1)   C1 0.2060 → 0.2144   C2 19.44% → 20.56% (ceilings 0.28, 28%)
        #
        # ⚠️ C1 and C2 went the WRONG way by a point and stayed green: fewer cards is less coverage at
        # the thin edges of the groom, and that is the honest cost of the trade. C4 and C3 — the mass
        # and the curtain, which are where a viewer reads a face through hair — went the right way.
        #
        # 🚩 **`flyaway` IS NOT IN THIS AND MUST NOT BE.** Strips 6 and 7 are the wisps, and
        # `hair_texture.STRIP_RECIPES` is explicit that making them cover more would undo the one thing
        # they exist for — a card carrying one has the outline of a few hairs rather than of a ribbon.
        # `flyaway` is the outermost layer, it is the silhouette a viewer reads against the background,
        # and it keeps (6, 7). What changes is the layers UNDER it, which are seen against skin rather
        # than against sky and whose thin third was buying nothing.
        {"name": "underlayer", "cards": 70, "standoff": 0.0110, "length": 0.200,
         "half_width": 0.0205, "strips": (1, 2), "gravity": 1.00, "jitter": 0.11,
         "cut": 0.35, "clump": 0.45},
        {"name": "body", "cards": 48, "standoff": 0.0165, "length": 0.260,
         "half_width": 0.0185, "strips": (1, 2), "gravity": 1.10, "jitter": 0.14,
         "cut": 0.62, "clump": 0.62},
        {"name": "surface", "cards": 48, "standoff": 0.0225, "length": 0.300,
         "half_width": 0.0165, "strips": (2, 3), "gravity": 1.20, "jitter": 0.17,
         "cut": 0.80, "clump": 0.75},
        # ⚠️ `cut_scatter` multiplies the cut jitter, and the flyaway layer is the one place it is
        # above 1. That layer exists to BREAK the silhouette — it carries the wispiest strips and it is
        # the outermost thing a viewer sees against the background — so cutting it to a plane with
        # everything else would take away the only thing it does. It is cut, so it hangs with the
        # style; it is cut untidily, so the outline is a hairline rather than a hem.
        {"name": "flyaway", "cards": 28, "standoff": 0.0285, "length": 0.320,
         "half_width": 0.0110, "strips": (6, 7), "gravity": 1.30, "jitter": 0.22,
         "cut": 0.88, "clump": 0.60, "cut_scatter": 2.4},
        # 🎯 **`veil` IS `mass` FOR THE OUTER ENVELOPE, AND THE CRITIC'S NUMBER ONE IS WHY.** *"Through
        # the character's-right curtain at portrait range I can read, unambiguously: the full eyebrow
        # arc, the eyelid crease, individual eyelashes, the nostril wing, the corner of the mouth, and
        # the jawline. Not hinted — legible enough that I could trace them."*
        #
        # 🚩 **AND THE PARAGRAPHS BELOW OVERSTATE WHAT THIS LAYER DID FOR THAT SENTENCE. MEASURED, BY
        # DELETING IT.** Standing rule 2's cycle run on this entry alone — the three-line dict removed,
        # `g050.glb` rebuilt, `hair_opacity.mjs` run, the entry restored and the groom confirmed
        # byte-identical at sha256 `f33c1aa1…`:
        #
        #   |               |     C4 the curtain |  C3 the mass |  C1 mean |
        #   |---------------|-------------------:|-------------:|---------:|
        #   | with `veil`   |             0.3248 |       0.0462 |   0.1757 |
        #   | without it    |             0.3301 |       0.0763 |   0.2269 |
        #
        # **76 cards move C4 by 0.0053 and C3 by 0.0301.** Against a ceiling of 0.35 and a pre-round
        # curtain of 0.3781, this layer is a twentieth of the distance travelled; the STRIP CHANGE three
        # entries up is the rest of it, and that one is red-proven at source — putting the three tuples
        # back reads C4 0.3590 and takes C1, C2 and C3 with it not at all.
        #
        # So the layer stays, because 0.030 on the mass and 0.051 on the mean for 76 cards is a real
        # contribution and the picture is better for it, but it is a MASS layer that happens to sit
        # outboard, not the curtain fix its own heading claims. The heading is left standing with this
        # correction under it rather than rewritten, because the reasoning below is what produced the
        # placement and a reader who only sees the conclusion cannot check it.
        #
        # `mass` above made the MASS opaque and it did: the far-side ear reads transmittance 0.0006
        # through it. It did not touch this, because the side curtains are somewhere `mass` does not
        # go. Measured this session on `alive.html` at 900x1200 by `hair_opacity.mjs`, over the pixels
        # where the groom is 1–2 cards deep AND the nearest surface behind it is head — the CURTAIN,
        # 53,570 px of the portrait — and split by which atlas strip is in front:
        #
        #   | region of the curtain                        |     px | transmittance |
        #   |----------------------------------------------|-------:|--------------:|
        #   | `hair_texture.INTERIOR_STRIP` reaches it      | 26,631 |    **0.1377** |
        #   | it does not                                   | 26,939 |    **0.6159** |
        #
        # 🎯 **HALF THE CURTAIN IS ONE MID-TO-WISP CARD AND NOTHING ELSE BEHIND IT, AND THAT HALF IS
        # THE PICTURE THE CRITIC DESCRIBED.** The heatmap says exactly where: the temple-to-cheek sweep
        # on the character's right, the inner edge of the far curtain, and the arc where the curtain
        # crosses the jaw. All three are places where `surface` and `flyaway` swing PAST the head's own
        # silhouette and hang over the face, and where the layers with any coverage — `root`, `mass`,
        # `underlayer` — have already curved back in against the skull and are not there.
        #
        # Which is last round's own conclusion arriving one layer out: *"an interior layer that is long
        # must ride the same envelope as the layers around it; interiority is standoff and gravity, not
        # shortness."* `mass` rides `underlayer`'s envelope, so it backs up `underlayer`. Nothing backs
        # up `surface` and `flyaway`, so wherever those two are the only cards over a pixel, the pixel
        # is a window.
        #
        # 🚩 **AND IT DOES NOT EXTEND THE GROOM, WHICH IS THE WHOLE REASON IT IS SAFE.** Last round's
        # two failed attempts put an opaque curtain over the FACE and lost an eye. This layer is placed
        # strictly INSIDE `surface` — standoff 0.0200 against 0.0225, gravity 1.16 against 1.20 — so
        # every card it draws lands under cards that are already there. It makes the existing footprint
        # opaque; it does not reach one pixel further across the face than `surface` already does, and
        # `surface` and `flyaway` are still outboard of it and still the ones that break the silhouette.
        #
        # `crown` 0.35 rather than `mass`'s 0.50 because the defect is at the SIDES: `sample_roots`
        # weights a face by its own upwardness, so a lower bias moves roots off the crown, which is the
        # one part of the head this layer is not needed on.
        #
        # ⚠️ **APPENDED RATHER THAN INSERTED IN STANDOFF ORDER, AND THAT IS DELIBERATE.**
        # `grow_layer` seeds its RNG with `HAIR_LAYERS.index(layer)`, so inserting an entry re-rolls
        # every layer below it and the groom that came out could not be attributed to this layer rather
        # than to the re-draw. Appended, the other five are byte-identical to the build before it —
        # confirmed by sha256 on `g050.glb` — and the only difference in the asset is these cards. The
        # "outermost last" comment at the top of this list is about the ENVELOPE and this entry breaks
        # it; nothing reads the order except the seed and the vertex-buffer order, and the groom is
        # drawn depth-tested out of one opaque bucket, so neither is visible.
        # ⚠️ `tip_width` 0.22 — NARROWER THAN `mass`'s, and it is the one number here that is about the
        # LOOK rather than about the transmittance. Strip 1 is 300 strands at a 3-texel half width in a
        # 128-texel column, which is fourteen strands deep: it is a solid sheet, not a bundle, and that
        # is deliberate — `hair_texture.INTERIOR_STRIP` exists to be near-opaque. A card carrying it
        # therefore reads as a flat grey ribbon wherever it is wide enough to see, and at 0.40 this
        # layer's ends were doing exactly that over the collarbone. Driven to 0.22 the card converges to
        # a point over its last third, so the coverage stays where the curtain is and the ends stop
        # being slabs. Measured: it costs nothing on C4 — see the run table at CEILINGS.
        {"name": "veil", "cards": 90, "standoff": 0.0200, "length": 0.300,
         "half_width": 0.0175, "strips": (1,), "gravity": 1.16, "jitter": 0.15,
         "crown": 0.35, "cut": 0.84, "clump": 0.70, "tip_width": 0.22},
        # 🎯 **THE FRINGE IS A SEPARATE STRUCTURAL ELEMENT AND UNTIL R23 THIS GROOM DID NOT HAVE ONE.**
        # The reference is unambiguous about it: a flat plane at its own angle from the side masses,
        # with a clean lower edge at eyebrow level. Every layer above grows from one field, and that
        # field runs radially forward from the whorl and is then swept sideways by the part — so what
        # the front of this groom had was the front of the side masses, which is why a blind critic
        # could read an eyebrow through it and why the portrait plate carries a card slab across the
        # cheek. `fringe` and `front` are the two keys that make this its own element: `front`
        # restricts the roots to the frontmost third of the region, `fringe` replaces the radial and
        # part terms with down-and-forward. See `root_direction` and `sample_roots`.
        #
        # ⚠️ **SHORT, AND THAT IS NOT THE MISTAKE ROUND 19 MADE.** Its finding — an interior layer that
        # is long must ride the same envelope as its neighbours; interiority is standoff and gravity,
        # not shortness — is about a layer hiding INSIDE the mass. This one is the outermost thing on
        # the front of the head and it is short because a fringe is cut short; the cut is what a viewer
        # reads.
        #
        # ⚠️ **`cut` IS MEASURED FROM `frame.forehead_z` AND NOT FROM `frame.hairline_z` — SEE
        # `ScalpFrame` FOR WHY, AND IT COST TWO BUILDS.** 0.02 of the region's height below the front
        # edge of the region lands the tips at z 1.5697 ± 13.3 mm at g050, against an `eyebrow001` mesh
        # spanning 1.5568–1.5672. `graduation: 0.0` and `cut_scatter: 0.12` are what make that a LINE:
        # at the layer defaults the same 0.02 runs from 14 mm to 41 mm of drop and 41 mm is the eye.
        #
        # ⚠️ **34 CARDS AND NOT 44, AND THE REASON IS `cards deep` RATHER THAN ANYTHING HERE.** At 44
        # that clause reads p50 18 against its ceiling of 18 on g000 — the smallest skull, so the most
        # cards per square centimetre. 34 reads 17 and costs 0.13 mm of the sweep's mean coherent lock
        # relief. A gate sitting on its ceiling goes red on the next round's unrelated change, and the
        # fringe is not what makes the front of the head opaque: `mass` and `veil` are still under it.
        #
        # ⚠️ **APPENDED, FOR THE REASON `veil` IS APPENDED.** `grow_layer` seeds its RNG with
        # `HAIR_LAYERS.index(layer)`, so an entry inserted in envelope order re-rolls every layer below
        # it and the groom that came out could not be attributed to this layer rather than to the
        # re-draw.
        #
        # ⚠️ **`front` IS THIS STYLE'S OWN `FOREHEAD_FRACTION`, WRITTEN OUT.** It was the name until
        # the table existed; a style's layer list cannot read the style's own keys while the dict is
        # still being built, so the number is repeated and `apply_style` refuses a style whose fringe
        # roots in one band and cuts from another. See FOREHEAD_FRACTION for why they are one band.
        {"name": "fringe", "cards": 34, "standoff": 0.0185, "length": 0.070,
         "half_width": 0.0160, "strips": (1, 2), "gravity": 1.00, "jitter": 0.09,
         "front": 0.34, "fringe": True, "cut": 0.02, "clump": 0.30,
         "tip_width": 0.45, "cut_scatter": 0.12, "graduation": 0.0},
    ],

    # 16 rather than 30: a bob shows on the order of a dozen locks, and 484 cards over 16 centres is
    # 30 a lock — on average 6.5 of the `root` layer's, down to 1.75 of the `flyaway` layer's, which is
    # enough for a lock to read as a mass in the layers that carry one and correctly leaves the
    # outermost wisps as individual hairs.
    "LOCK_COUNT": 16,
    "LOCK_CROWN_BIAS": 0.80,

    # How the clump weight climbs from root to tip. Above 1 so the roots stay where `sample_roots` put
    # them and the gathering happens down the shaft, which is where a lock forms.
    "CLUMP_POWER": 1.7,

    # 🎯 **AND THE SAME LOCK OWNS THE DEFLECTION, WHICH IS THE FRIZZ FIX.** Every card used to draw its
    # own direction jitter and its own curl, so two neighbours 8 mm apart disagreed by the full jitter
    # budget — measured as a direction coherence of 0.9373 (mean cosine between a card's root-to-tip
    # heading and its five nearest neighbours'). Neighbouring cards whose flow disagrees is the
    # definition of frizz. Most of the budget now belongs to the LOCK and is shared by every card in
    # it; what is left is the per-card residue that keeps a lock from being one wide ribbon.
    "LOCK_DIRECTION_SHARE": 0.75,

    # How far forward the fringe leans as it leaves the hairline, against one unit of straight down.
    # It is what stops the plane from lying on the forehead: at 0 the tangent projection at a front
    # hairline root still points down the brow, and the standoff is then the only thing holding the
    # cards off the face. See the `fringe` entry in HAIR_LAYERS and `root_direction`.
    "FRINGE_FORWARD": 0.45,

    # The cap is cut from the scalp region itself, so it fits every identity for the same reason
    # `--foundation`'s shells do — it is derived from the body it sits on and has no fitting step to
    # drift. Two shells at different offsets, with the radial UV rotated between them, so a texel that
    # the inner shell somehow leaves open is not open on the outer one.
    "CAP_SHELL_OFFSETS_M": (0.0038, 0.0068),

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
    "CAP_WEDGES_PER_SHELL": (12, 7),

    # The cap's radial UV runs 0 at the whorl to 1 at CAP_UV_REACH of the region's own radius. Under 1
    # because the strand sheet's last rows are its tips: reaching exactly 1.0 would ring the hairline
    # with strand ends, and the hairline is the one edge of the cap a viewer can see.
    "CAP_UV_REACH": 1.35,

    # 🚩 **A DEAD-FLAT CUT LINE IS A WIG, AND THIS IS THE ONLY THING BETWEEN THE TWO.** The defect
    # being fixed is 140 mm of scatter; the failure on the other side is 0 mm of it, which reads as a
    # plastic bob straight off a shelf. A real cut is point-cut: the stylist takes the line with the
    # scissors at an angle, so a LOCK sits a few millimetres off its neighbours and the hairs inside a
    # lock sit a few off each other. Both are fractions of the region's height, and the lock's is the
    # larger because a lock is what the eye resolves.
    "CUT_LOCK_JITTER": 0.035,
    "CUT_CARD_JITTER": 0.030,

    # How much longer the front is than the back, as a fraction of the region's height, across the
    # region's full depth. The style is "side-parted, FACE-FRAMING" — a bob that is level all the way
    # round is a helmet, and the face-framing read comes from the front of the cut hanging lower.
    "CUT_GRADUATION": 0.09,

    # 🎯 **THE CUT FIELD, AND bob01 IS THE PROOF THAT IT IS OFF.** `CUT_GRADUATION` above varies the
    # cut over ONE axis of the scalp — front to back — and a men's cut is the same idea over the
    # other two: short at the sides and the nape, long on top, with a graduation between. Both
    # amounts are zero here, so `taper_at` returns exactly 0.0 and this style's cut is the plane it
    # has always been; `assets/hair/bob01/g050.glb` still bakes to sha256 `98ca6c23…`.
    #
    # ⚠️ The two LINES are 0.0 rather than a fade's knee, and that is the honest value for a style
    # with no fade in it: at 0.0 the ramp starts at the crown, which is a graduation rather than a
    # fade, and it is what a style copied from this one gets until its author sets a line. A number
    # here that described a knee bob01 does not have would be a claim nothing checks.
    "CUT_FADE_HEIGHT": 0.0,
    "CUT_FADE_HEIGHT_LINE": 0.0,
    "CUT_FADE_SIDE": 0.0,
    "CUT_FADE_SIDE_LINE": 0.0,

    # How much of the card's root width survives to the tip. Hair narrows toward the ends; the alpha
    # in the strand sheet does most of that work, and this does the rest so the SILHOUETTE narrows too
    # — alpha alone leaves a card whose transparent corners still occlude nothing but still exist.
    #
    # 🎯 **A LAYER MAY OVERRIDE IT, AND THE `mass` LAYER HAS TO.** 0.62 is the right taper for a card
    # whose atlas strip is 40% opaque: it ends as a soft, half-transparent wedge among five other
    # cards. The interior strip is 84% opaque, so the same wedge ends as a STRAP — and at the bottom of
    # the bob, where only two or three cards remain, each strap is separately readable. Rendered at
    # portrait with `mass` at 0.62 the ends over the collarbone read as a row of flat ribbons with
    # black tips, which is a different failure from the one this round is fixing and not an improvement
    # on it. The override is on the layer rather than on the strip because the WIDTH is geometry and
    # the strip is texture; a card can carry an opaque texel and still come to a point.
    "TIP_WIDTH_FRACTION": 0.62,

    # Weights of the three root-direction terms, before the tangent projection. Radial dominates
    # because it is the term that carries the crown; the part term is strong but local (see
    # PART_FALLOFF); gravity at the root is deliberately small, because a root that already points
    # down cannot lie along the skull.
    "RADIAL_WEIGHT": 1.00,
    "PART_WEIGHT": 1.45,
    "ROOT_GRAVITY_WEIGHT": 0.30,

    # Width of the part's influence, as a fraction of the scalp half-width.
    #
    # 🚩 **WIDE ON PURPOSE — THIS IS ALSO WHAT KEEPS HAIR OFF THE FACE.** At 0.55 the part is a local
    # feature and the fringe falls straight down over the eyes and the nose, which is the single worst
    # thing a groom can do on a page whose whole purpose is a face. At 1.10 the term reaches the whole
    # front half of the scalp and the fringe sweeps sideways past the cheek instead of down it.
    "PART_FALLOFF": 1.10,

    # How far gravity turns the heading at each segment, at the tip, before the layer's own `gravity`
    # multiplier. Applied as s^GRAVITY_POWER so the root end stays flat against the skull.
    #
    # 🚩 **THE FIRST VERSION EXPRESSED THIS PER METRE AND THE GROOM CAME OUT AS A SEA URCHIN.** The
    # heading is a UNIT vector; adding `2.30 · s^1.6 · step` to it with a 15.5 mm step adds 0.045 at
    # the tip, which is a 2.6° turn — over twelve segments the card left the scalp tangentially and
    # flew straight out. A bend is an angle and has to be authored as one: 0.41 at the tip is a 22°
    # turn per segment, and the last third of a card ends up pointing at the floor.
    #
    # ⚠️ **PER SEGMENT, SO IT MOVES WITH GUIDE_SEGMENTS.** The total turn is the sum over the segments,
    # so raising the count from twelve to sixteen would have bent the groom a third further for free.
    # 0.55 over twelve is 0.41 over sixteen for the same fall.
    "GRAVITY_PER_SEGMENT": 0.41,
    "GRAVITY_POWER": 1.60,

    # The curl's share of the layer's jitter budget. Per segment and cumulative, so it carries the same
    # GUIDE_SEGMENTS scaling the gravity bend does: 0.15 over twelve segments is 0.11 over sixteen.
    "CURL_SHARE_OF_JITTER": 0.11,

    # 🎯 **THE HUG, which is the whole difference between hair and a hedgehog.** A curve leaving a
    # convex skull along its tangent plane travels in a straight line and the skull curves away
    # underneath it, so a "push out when too close" rule NEVER FIRES AGAIN after the first step and the
    # card sails off into space. Hair does the opposite: it lies on the head until the head stops
    # supporting it. So while the card is still in its attached phase the point is pulled back DOWN to
    # `standoff` above the nearest surface, and the heading is re-derived from where it actually landed
    # rather than from where it was aimed.
    #
    #   ATTACH_FADE     the band above the hairline over which support runs out, as a fraction of the
    #                   scalp region's own height
    #   ATTACH_STRENGTH how much of the gap is closed per segment while attached
    #   HUG_REACH       how far the surface can be and still hold the hair. Beyond this the nearest
    #                   body point is something the hair is merely passing — the cheek, the shoulder —
    #                   and hugging it would drag the fall onto the face.
    #
    # 🚩 **A HEIGHT, AND IT WAS AN ARC FRACTION — AND THE ARC FRACTION PUT THE FRINGE OVER AN EYE THE
    # FIRST TIME THE CARDS GOT LONGER.** At 0.62 of the arc the attached phase was 93 mm on a 150 mm
    # card and 152 mm on a 245 mm one, close enough to a fixed distance that nobody noticed. Cutting to
    # a plane made the longest card 463 mm, so 0.62 of it reached 287 mm — past the cheekbone — and
    # `HUG_REACH` duly pulled the sweep flat onto the face: the `front` plate showed hair over the left
    # eye and the nose bridge where the previous groom cleared both.
    #
    # ⚠️ **AND THE OBVIOUS REPAIR — MAKE IT AN ARC DISTANCE — IS WORSE, MEASURED.** A fixed 124 mm of
    # support releases a 463 mm card while it is still on TOP of the skull, and a card released on the
    # crown leaves along its tangent: the `front` plate grew a wing of hair standing
    # out horizontally to the figure's right and threw four cards diagonally across the nose. A
    # distance is no more the question than a fraction is. The question the header already asks is
    # "until the head stops supporting it", and the head stops at the HAIRLINE — which this file has
    # measured off the face's own motion since it was written. Above the hairline the skull is under
    # the hair however long the card is; at the hairline the next thing down is the cheek.
    #
    # The wing was seen on `packages/testbed/src/hair.html` through `hair_shots.mjs`, and no path to the
    # plate is quoted here on purpose: `captures/` is gitignored, so a comment pointing into it rots the
    # moment the directory is cleaned. Reproduce it instead by replacing the `attached` line in
    # `grow_guide` with `max(0.0, (0.72 * frame.height - along) / (0.72 * frame.height))`, `along`
    # accumulating `step`, and re-running the five plates.
    "ATTACH_FADE": 0.30,
    "ATTACH_STRENGTH": 0.75,
    "HUG_REACH": 0.045,

    # Twist along a card, radians end to end. A ribbon with a constant frame is a flat plane and reads
    # as one; a small twist means the card presents a different profile at its tip than at its root.
    "CARD_TWIST": 0.35,
}



# --- deriving one haircut from another ------------------------------------------------------------
#
# 🎯 **SIX MORE HAIRCUTS AND THE PARAGRAPHS ARE THE ASSET, WHICH IS WHY THEY ARE NOT COPIED.** A
# style is 32 parameters and eight layer dicts. Written out in full, six styles is ~190 numbers of
# which perhaps 70 differ from bob01 — and the reasoning attached to the other 120 would have to be
# duplicated six times or dropped. A paragraph duplicated six times is a paragraph that gets
# corrected in one place; this file's whole durable value is that each number has exactly one
# paragraph and that paragraph is where the number is.
#
# 🚩 **AND THIS IS NOT THE DEFAULT THE TABLE'S HEADER REFUSES.** That header's failure is a number
# the author BELIEVES is in effect and is not — `"WHORL_SETBAK": 0.20` building a perfectly good
# groom with bob01's whorl. Nothing here weakens it: `derive_style` returns a COMPLETE dict which
# `apply_style` then validates exactly as it validates a hand-written one, every changed number is
# written on the page beside the style that changes it, and the base is NAMED in the call — an
# author who writes `derive_style("bob01", ...)` has said out loud where the rest comes from. The
# three ways to get it wrong all fail loudly here rather than quietly later: a parameter this file
# has no name for, a layer this style's base does not have, and a layer key nothing reads.
#
# ⚠️ **WHAT IT DOES NOT SOLVE, and it is the one the next author will hit.** A derived style still
# INHERITS a number nobody thought about. bob01's `CROWN_BIAS_POWER` is in every style below
# because none of them had a reason to move it, and "no reason to move it" and "never considered"
# are indistinguishable from the outside. The guard against that is the same one this project uses
# everywhere else — a measurement of the groom that came out, not a schema.


def derive_style(base, layers=None, **changes):
    """`base`'s numbers with the ones this haircut actually moves written out. Returns a new dict.

    `layers` is either a full HAIR_LAYERS list — for a style whose stack is a different SET of
    shells, which is a different groom and not an edit to one — or a dict of layer name to the
    keys that layer changes. Everything is copied, so a derived style cannot reach back and edit
    the one it came from; bob01 in particular is the reproducibility anchor and nothing may touch
    it.
    """
    parent = HAIR_STYLES.get(base)
    if parent is None:
        raise SystemExit(
            f"Build failed: a style is derived from {base!r}, which is not in HAIR_STYLES. The "
            f"entries that exist at this point in the file are: {', '.join(sorted(HAIR_STYLES))}.")

    unknown = sorted(set(changes) - set(STYLE_PARAMETERS))
    if unknown:
        raise SystemExit(
            f"Build failed: a style derived from {base!r} changes {unknown}, which this file has "
            "no parameter for. Same rule as a hand-written style — a key nothing reads is a "
            f"number the author thinks is in effect. STYLE_PARAMETERS: {list(STYLE_PARAMETERS)}.")

    style = dict(parent)
    style.update(changes)

    if isinstance(layers, list):
        style["HAIR_LAYERS"] = [dict(layer) for layer in layers]
        return style

    style["HAIR_LAYERS"] = [dict(layer) for layer in parent["HAIR_LAYERS"]]
    if layers is None:
        return style

    by_name = {layer["name"]: layer for layer in style["HAIR_LAYERS"]}
    absent = sorted(set(layers) - set(by_name))
    if absent:
        raise SystemExit(
            f"Build failed: a style derived from {base!r} edits layers {absent}, which that style "
            f"does not have. Its stack is {list(by_name)}; a style that wants a different set of "
            "shells passes the whole list rather than editing one that is not there.")

    for name, edits in layers.items():
        for key, value in edits.items():
            if key not in LAYER_REQUIRED and key not in LAYER_OPTIONAL:
                raise SystemExit(
                    f"Build failed: a style derived from {base!r} sets {key!r} on layer {name!r}, "
                    f"which no layer reader looks at. A layer's keys are {list(LAYER_REQUIRED)} "
                    f"plus any of {list(LAYER_OPTIONAL)}.")
            by_name[name][key] = value

    return style


# =================================================================================================
# bob02 — THE BOB. The one the owner looked at and rejected, cut to the length a bob actually is.
#
# 🎯 **bob01 IS 107 mm TOO LONG AND THAT IS THE WHOLE COMPLAINT.** `docs/research/hairstyle-
# targets.md` measured it against the figure rather than against taste: the jaw plane on
# `figure_g050` is z ≈ 1.4350 — the midline profile's most-forward y steps −86.9 → −136.9 mm
# between z 1.430 and 1.440, which is the chin coming off the throat — every one of the ten
# reference plates ends AT the jaw within ±15 mm, and bob01's longest cards reach **1.3279**, past
# the clavicle. The manifest's own words for it are "roughly to the collarbone", which is accurate
# and is a LOB. The generator built what it was told; the target was wrong.
#
# ⚠️ **AUTHORED AS A NEW STYLE RATHER THAN AS AN EDIT, AND THAT IS NOT TIMIDITY.** bob01 bakes
# g050 to sha256 `98ca6c23…` byte for byte and every measurement this project has committed was
# taken on that groom. Editing it retires the control and the record in one commit. It survives
# here as a control-only entry.
#
# WHAT MOVED, and each of the five is one of the reference's own read-off features:
#
#   1. THE LENGTH. Per the targets table, scaled — see the layer entries.
#   2. THE WEDGE. `CUT_GRADUATION` 0.09 → 0.22.
#   3. THE NAPE. `CUT_FADE_HEIGHT` 0.20 at a line of 0.50 — the cut field's first real use.
#   4. THE LINE. The two cut jitters cut by a third; a bob is blunter than a lob.
#   5. THE AIR. `ATTACH_STRENGTH` and `HUG_REACH` reduced, NOT removed.
#
# 🚩 **WHAT IS NOT HERE, STATED SO NOBODY LOOKS FOR IT.** Reference feature 4 — *the ends turn
# UNDER* — is not expressible. `curl` is a constant nudge per segment with a per-lock RANDOM
# direction, so it bows a lock one way or another and has no notion of "inward". A directional tip
# curl is a new term in `grow_guide` (an outward-facing basis is already there in `ribbon_of`), and
# it is the single highest-value thing left undone on this style.
# =================================================================================================

HAIR_STYLES["bob02"] = derive_style(
    "bob01",

    # 🎯 **THE WEDGE, AND THE SIGN WAS ALREADY RIGHT.** `cut_height` measures `front_to_back` from
    # the region's own mid-depth and the face is at −Y, so a FRONT root has the negative value and
    # `drop -= CUT_GRADUATION * front_to_back` makes its drop LARGER — the front already hung
    # lower. bob01's 0.09 is 15.5 mm of it across the whole region, which on a 360 mm groom is
    # invisible; the reference plates read 55–65 mm of difference between the front tips at the
    # chin and the back edge at the upper nape. 0.22 across the roots' own ±0.4 span of
    # `front_to_back` is 30 mm, and the nape fade below adds the rest at the back.
    CUT_GRADUATION=0.22,

    # 🎯 **THE TAPERED NAPE, WHICH IS THE FEATURE EVERY REFERENCE PLATE SHARES AND WE HAD NONE OF.**
    # Ours hangs as a curtain of constant length from the crown — the same length at the nape as at
    # the temple. `taper_at`'s height ramp is measured DOWN from the crown, so 0.50 puts the guard
    # line at the middle of the skull and the sides (mean height fraction 0.600, see `taper_at`)
    # are untouched. 0.20 of the region's height is 34.6 mm taken off the deepest nape root and
    # nothing at all off anything above the line.
    #
    # ⚠️ **THE SIDE AMOUNT STAYS AT ZERO, AND A BOB IS WHY.** The sides are the face-framing
    # length; a bob is a men's cut's opposite in exactly this parameter.
    CUT_FADE_HEIGHT=0.20,
    CUT_FADE_HEIGHT_LINE=0.50,

    # A bob's lower edge is a LINE — the plates are blunt or near-blunt and the one thing they all
    # have is a readable edge. bob01's 6.0 mm and 5.2 mm of scatter were sized against a 360 mm
    # groom where they are 1.7% of the length; on a 210 mm one they are 3%, and the same scatter
    # reads as an untidy hem rather than as point-cutting. Two thirds of it, which keeps the
    # "dead-flat cut line is a wig" failure at arm's length.
    CUT_LOCK_JITTER=0.022,
    CUT_CARD_JITTER=0.018,

    # 🎯 **THE AIR UNDER IT, AND THIS IS THE ONE THAT COULD GO WRONG.** Reference feature 5: a bob
    # has body at the root and a silhouette wider than the head, where the hug pulls hair ONTO the
    # skull. ⚠️ That hug is what keeps a curve LYING on the head instead of leaving along its own
    # tangent, and the note at ATTACH_FADE records the plate where a released card threw a wing of
    # hair across the nose. So this is a reduction of about a fifth in each, not a removal, and the
    # thing to watch is the clearance report and the front plate rather than these numbers.
    ATTACH_STRENGTH=0.58,
    HUG_REACH=0.034,

    layers={
        # 🎯 **`cut` FROM THE TARGETS TABLE, SHIFTED UP BY 0.03, AND THE SHIFT IS THE GRADUATION.**
        # That table solves `tip_z = 1.4970 − cut × 0.1728` for a LEVEL plane: `mass` at 0.36 lands
        # 1.4348, the jaw. This style is not level — 0.22 of graduation puts the front 19 mm below
        # the base plane and the back 19 mm above it — so the base is set so that the FRONT of the
        # wedge lands at the jaw rather than the middle of it. At `front_to_back` −0.40 the mass
        # reads 1.4248 and at +0.35 it reads 1.4533, which brackets the reference's own ±15 mm.
        #
        # ⚠️ **`length` FOLLOWS, AND IT IS NOT PROPORTIONAL.** It is the FIRST GUESS at the arc a
        # card needs, corrected by `grow_to_cut` within CUT_LENGTH_BOUNDS 0.45–1.80×; halving a cut
        # without moving it asks the corrector for 0.45× at its floor and it CLAMPS instead of
        # reaching, silently. The arc is a wrap over the skull PLUS the drop, so the wrap does not
        # scale. Least squares over bob01's own six (drop, length) pairs — which were themselves
        # authored guesses, so this is a fit to an author's judgement rather than to an arc —
        # gives `length_mm = 128.1 + 1.205 × drop_mm`, and every number below is that line
        # evaluated at the new drop and rounded to the millimetre.
        #
        # 🚩 **AND THE FLOOR IS WHAT THE NAPE ACTUALLY GETS.** `CUT_MINIMUM_LENGTH` is 0.35 of the
        # layer's own first guess, so `underlayer` cannot make a card shorter than 57 mm however
        # far the fade raises its plane. Where the fade lifts the plane past the root the guard in
        # `grow_to_cut` takes over and the card is exactly that floor. Solved arithmetically for
        # this style: `underlayer` floors below a height fraction of 0.123 and `mass` essentially
        # never does, so the taper is a real graduation over the nape and a constant under it.
        "mass": {"cut": 0.33, "length": 0.197},
        "underlayer": {"cut": 0.165, "length": 0.163},
        "body": {"cut": 0.25, "length": 0.180},
        "surface": {"cut": 0.31, "length": 0.193},
        "flyaway": {"cut": 0.36, "length": 0.203},
        "veil": {"cut": 0.33, "length": 0.197},
        # ⚠️ **THE FRINGE IS UNCHANGED AND THAT IS DELIBERATE.** The ten plates carry blunt fringes,
        # curtain bangs and none at all in roughly equal numbers, so a fringe is not what makes a
        # bob a bob and tuning one here would be tuning the wrong thing. `taper` 0.0 for the reason
        # it already carries `graduation` 0.0: its lower edge is the one line in the groom that is
        # deliberate and the fade must not reach it. Arithmetically the fade would take 1.7 mm off
        # it, which is inside the fringe's own scatter — the key is here because a later author
        # raising CUT_FADE_HEIGHT must not have to rediscover that.
        "fringe": {"taper": 0.0},
    },
)


# =================================================================================================
# crop01 — a men's short back-and-sides with length on top. The cut field's other half.
#
# 🎯 **THIRTEEN REFERENCE PLATES AND WHAT THEY SHARE IS NOT LENGTH, IT IS STRUCTURE** — short,
# tapered or faded sides and back, the length concentrated on top, the top styled directionally.
# `docs/research/hairstyle-targets.md` §4 puts it as the third independent line of evidence for one
# mechanism: a bob's tapered nape and a men's fade are the same operator at two settings.
#
# 🚩 **AND BUILDING IT FOUND THE OPERATOR'S REAL LIMIT, WHICH IS NOT IN `taper_at`.** The cut is a
# PLANE, and a plane above a root is a plane the card never descends through — `grow_to_cut`'s
# guard then hands back `CUT_MINIMUM_LENGTH × the layer's first guess` and nothing else. Solve it:
# with a cut of `c` (negative, i.e. a plane above the hairline) and a taper of `t`, the floor binds
# wherever the root's height fraction `u` satisfies `u ≤ 0.0596 + |c| + t`. For this style's `mass`
# at −0.72 that is `u ≤ 0.78 + t`, so the top 22% of the scalp is cut by the plane and EVERYTHING
# BELOW IT IS AT THE FLOOR. The fade does not grade the sides; it decides WHERE THE TRANSITION
# CONTOUR RUNS, which is exactly what a barber's guard line is, and the floor sets the side length.
# That is a coherent cut and it is not the cut the field was designed to make. Two consequences:
#
#   * the side length is `0.35 × length` per layer and nothing else, so the only way to vary it is
#     to vary `length` — which is why the eight entries below carry eight different floors, 16 to
#     34 mm, rather than one. The mixture is the texture.
#   * a skin fade is still impossible, for the reason `taper_at` already gives: the roots are
#     everywhere the scalp region is, and a cut driven to zero leaves a stub, not skin.
# =================================================================================================

HAIR_STYLES["crop01"] = derive_style(
    "bob01",

    # The fade itself. The HEIGHT half takes the nape and the occiput; the SIDE half takes the
    # temples and above the ear, and it is the half a bob refuses. Both lines sit near the middle
    # of their axis because that is where a parietal ridge is — above it the hair is left, below it
    # it is taken off, which is the whole grammar of the cut.
    CUT_FADE_HEIGHT=0.30,
    CUT_FADE_HEIGHT_LINE=0.45,
    CUT_FADE_SIDE=0.35,
    CUT_FADE_SIDE_LINE=0.45,

    # Near level front to back on top. A crop is not face-framing; the wedge belongs to the bob.
    CUT_GRADUATION=0.05,

    # Point-cut, and on a 40 mm top a 5 mm scatter is a texture rather than a ragged hem — this is
    # the one place where holding a jitter CONSTANT while the groom shrinks is the right move.
    CUT_LOCK_JITTER=0.030,
    CUT_CARD_JITTER=0.028,

    # More locks and less crown bias: short hair separates into more, finer sections and it does so
    # over the whole head rather than radiating from a crown a viewer cannot see under 40 mm of
    # hair. CLUMP_POWER down because a 40 mm card has no shaft over which to gather.
    LOCK_COUNT=24,
    LOCK_CROWN_BIAS=0.55,
    CLUMP_POWER=1.4,

    # A crop has no part. PART_WEIGHT 1.45 and a falloff of 1.10 were authored to sweep a long
    # fringe sideways past the cheek — run on 40 mm of hair the same field combs the whole top to
    # one side, which is a different haircut in the set (the side part, plate 1) and not this one.
    PART_WEIGHT=0.55,
    PART_FALLOFF=0.75,
    ROOT_GRAVITY_WEIGHT=0.18,

    # Short hair does not hang, it stands and it lies. Roughly half bob01's per-segment bend, a
    # stronger hug over a wider band, and a shorter reach so the hug cannot catch the neck.
    GRAVITY_PER_SEGMENT=0.22,
    ATTACH_FADE=0.42,
    ATTACH_STRENGTH=0.88,
    HUG_REACH=0.030,

    # Tips come to a point faster on a short card: the taper has a third of the arc to happen over.
    TIP_WIDTH_FRACTION=0.45,
    CARD_TWIST=0.45,
    FRINGE_FORWARD=0.65,

    # ⚠️ **THE STANDOFFS COME IN AND THE CAP DOES NOT.** bob01's shells span 6.0–28.5 mm, which is
    # most of this haircut's total length — a 26 mm card standing 28 mm off the skull is a card
    # floating in air. They are scaled to roughly 0.6×, with the innermost held at 8.0 mm because
    # `CAP_SHELL_OFFSETS_M`'s outer shell is at 6.8 mm and a `root` layer inside the cap is a layer
    # nobody can see. The cap itself is unchanged: its inner shell is already 3.8 mm against a
    # HAIR_CLEARANCE_M of 3.5 mm and there is no room under it.
    #
    # 🚩 **CARD COUNTS COME DOWN A THIRD, AND IT IS NOT A CONCESSION TO THE GATE.** Total card AREA
    # is what fills a groom, and this one covers the same scalp with cards a fifth of bob01's
    # length. Holding the count at 496 would put five times bob01's card area per square
    # centimetre on the head — which is the `cards deep` failure `docs/research/hairstyle-
    # targets.md` §5.4 predicts, arriving for a real reason rather than a threshold one.
    layers=[
        {"name": "root", "cards": 70, "standoff": 0.0080, "length": 0.055,
         "half_width": 0.0180, "strips": (1, 2), "gravity": 0.85, "jitter": 0.10,
         "part": 0.20, "crown": 1.60, "cut": None, "clump": 0.15},
        {"name": "mass", "cards": 70, "standoff": 0.0105, "length": 0.075,
         "half_width": 0.0150, "strips": (1,), "gravity": 0.95, "jitter": 0.14,
         "crown": 0.50, "cut": -0.72, "clump": 0.45, "tip_width": 0.26},
        {"name": "underlayer", "cards": 52, "standoff": 0.0095, "length": 0.055,
         "half_width": 0.0155, "strips": (1, 2), "gravity": 0.90, "jitter": 0.15,
         "cut": -0.80, "clump": 0.35},
        {"name": "body", "cards": 40, "standoff": 0.0125, "length": 0.082,
         "half_width": 0.0140, "strips": (1, 2), "gravity": 1.00, "jitter": 0.18,
         "cut": -0.68, "clump": 0.45},
        {"name": "surface", "cards": 40, "standoff": 0.0155, "length": 0.088,
         "half_width": 0.0125, "strips": (2, 3), "gravity": 1.05, "jitter": 0.22,
         "cut": -0.66, "clump": 0.50},
        {"name": "flyaway", "cards": 24, "standoff": 0.0195, "length": 0.098,
         "half_width": 0.0085, "strips": (6, 7), "gravity": 1.15, "jitter": 0.28,
         "cut": -0.62, "clump": 0.40, "cut_scatter": 2.4},
        {"name": "veil", "cards": 60, "standoff": 0.0140, "length": 0.076,
         "half_width": 0.0130, "strips": (1,), "gravity": 1.00, "jitter": 0.18,
         "crown": 0.35, "cut": -0.71, "clump": 0.50, "tip_width": 0.22},
        # The textured crop fringe: short, forward, and cut to its own line off `forehead_z`. It
        # keeps `graduation` 0.0 for bob01's reason and takes `taper` 0.0 for the fade's — the side
        # half of the field reaches the temples, and the temples are where this layer's roots are.
        {"name": "fringe", "cards": 28, "standoff": 0.0130, "length": 0.045,
         "half_width": 0.0125, "strips": (1, 2), "gravity": 1.00, "jitter": 0.14,
         "front": 0.34, "fringe": True, "cut": 0.04, "clump": 0.25,
         "tip_width": 0.45, "cut_scatter": 0.60, "graduation": 0.0, "taper": 0.0},
    ],
)


# =================================================================================================
# quiff01 — short sides, real length on top, swept up and back.
#
# 🎯 **THE SWEEP IS THE WHORL, AND THAT IS THE ONE LEVER IN THIS FILE THAT CAN TURN A GROOM ROUND.**
# `root_direction`'s dominant term is radial from `frame.whorl`, and the whorl is
# `crown + WHORL_SETBACK × depth` on the y axis with the face at −Y. Measured at g050: the crown
# sits at y −0.0502 and the region's front edge at −0.1168, so any setback below −0.403 puts the
# whorl IN FRONT OF EVERY ROOT and the radial field runs backward over the entire scalp. −0.55 puts
# it 24 mm clear of the front edge, which is a comb-back rather than a knife edge at the hairline.
#
# ⚠️ **AND IT COSTS THE CROWN AND THE CAP'S ROSETTE, WHICH IS THE HONEST PRICE.** The whorl is also
# the pole of `build_scalp_cap`'s polar UV, so a whorl outside the region turns the cap's rosette
# into a fan — the strand sheet runs one way across the whole cap instead of radiating. On a groom
# whose top is combed one way that is arguably the right texture; it is recorded because it is a
# side effect of a parameter chosen for something else, and `CAP_WEDGES_PER_SHELL`'s own note about
# the two shells' interference patterns is written for a rosette that no longer exists here.
#
# ⚠️ **NO FRINGE LAYER, AND `FRINGE_FORWARD` IS THEREFORE A NUMBER NOTHING READS.** A quiff has no
# fringe — the front is the quiff. `apply_style` still requires the parameter because the schema
# belongs to the FILE and not to a style, so it is declared and inert. That is a wart and the fix
# is to move `FRINGE_FORWARD` into LAYER_OPTIONAL where the layer that uses it lives; it is not
# done here because it would edit bob01's dict, and bob01 is the byte-identical control.
# =================================================================================================

HAIR_STYLES["quiff01"] = derive_style(
    "bob01",

    WHORL_SETBACK=-0.55,

    # The transition contour, solved the same way crop01's was: the floor binds below
    # `u ≤ 0.0596 + |cut| + taper`. At the centre of the top the taper is zero and `mass` at −0.42
    # gives 0.48, so everything above the middle of the skull is cut by the plane — a long top. At
    # a lateral fraction of 0.85 the side half contributes 0.35 and the threshold rises to 0.83, so
    # the sides are at the floor right up to the parietal ridge. Short sides, long top, and the
    # line between them follows a lateral contour rather than a horizontal one, which is the
    # difference between a fade and a bowl cut.
    CUT_FADE_HEIGHT=0.40,
    CUT_FADE_HEIGHT_LINE=0.40,
    CUT_FADE_SIDE=0.55,
    CUT_FADE_SIDE_LINE=0.32,

    # The quiff itself is the front, so the front is the longest part of the top.
    CUT_GRADUATION=0.14,
    CUT_LOCK_JITTER=0.026,
    CUT_CARD_JITTER=0.022,

    LOCK_COUNT=20,
    LOCK_CROWN_BIAS=0.60,
    CLUMP_POWER=1.5,

    # A comb-back has no part and must not be given one: the part push is lateral, and lateral is
    # the one direction a quiff does not go.
    PART_WEIGHT=0.35,
    PART_FALLOFF=0.60,

    # 🚩 **THE ROOT GRAVITY GOES TO ALMOST NOTHING AND THAT IS WHAT MAKES IT STAND UP.** Its own
    # note says a root that already points down cannot lie along the skull; a quiff is the extreme
    # of that — the hair leaves the scalp along the surface and is then carried up and over by the
    # radial field before gravity has any say. The per-segment bend halves for the same reason.
    ROOT_GRAVITY_WEIGHT=0.05,
    GRAVITY_PER_SEGMENT=0.20,

    # And the hug comes off hardest of any style here, because the volume at the front IS the
    # style. Still not removed: at zero the released cards leave along their tangent and the plate
    # ATTACH_FADE describes grows a wing.
    ATTACH_FADE=0.34,
    ATTACH_STRENGTH=0.45,
    HUG_REACH=0.030,

    TIP_WIDTH_FRACTION=0.50,
    CARD_TWIST=0.40,

    layers=[
        {"name": "root", "cards": 72, "standoff": 0.0080, "length": 0.062,
         "half_width": 0.0195, "strips": (1, 2), "gravity": 0.85, "jitter": 0.09,
         "part": 0.20, "crown": 1.60, "cut": None, "clump": 0.15},
        {"name": "mass", "cards": 80, "standoff": 0.0120, "length": 0.160,
         "half_width": 0.0165, "strips": (1,), "gravity": 0.95, "jitter": 0.11,
         "crown": 0.65, "cut": -0.30, "clump": 0.55, "tip_width": 0.26},
        {"name": "underlayer", "cards": 56, "standoff": 0.0105, "length": 0.120,
         "half_width": 0.0170, "strips": (1, 2), "gravity": 0.90, "jitter": 0.12,
         "cut": -0.45, "clump": 0.40},
        {"name": "body", "cards": 44, "standoff": 0.0145, "length": 0.172,
         "half_width": 0.0155, "strips": (1, 2), "gravity": 1.00, "jitter": 0.15,
         "crown": 0.45, "cut": -0.26, "clump": 0.55},
        {"name": "surface", "cards": 44, "standoff": 0.0185, "length": 0.184,
         "half_width": 0.0140, "strips": (2, 3), "gravity": 1.05, "jitter": 0.18,
         "crown": 0.45, "cut": -0.22, "clump": 0.60},
        {"name": "flyaway", "cards": 26, "standoff": 0.0235, "length": 0.198,
         "half_width": 0.0095, "strips": (6, 7), "gravity": 1.15, "jitter": 0.24,
         "crown": 0.45, "cut": -0.18, "clump": 0.50, "cut_scatter": 2.4},
        {"name": "veil", "cards": 66, "standoff": 0.0165, "length": 0.164,
         "half_width": 0.0145, "strips": (1,), "gravity": 1.00, "jitter": 0.14,
         "crown": 0.50, "cut": -0.28, "clump": 0.60, "tip_width": 0.22},
    ],
)


# =================================================================================================
# long01 — straight, past the shoulderblades. The easy one, and it proves the range the other way.
#
# The landmarks it is cut against, from `docs/research/hairstyle-targets.md` §1: clavicle 1.3425,
# shoulder ~1.28. Past the shoulderblades is z ≈ 1.18, which through `cut = (1.4970 − tip_z) /
# 0.1728` is 1.83 — against bob01's 0.84 and bob02's 0.33. `length` follows the same least-squares
# line bob02's does.
#
# ⚠️ **AND IT IS OUTSIDE `GUIDE_SEGMENTS`' OWN STATED RANGE, WHICH IS A REAL COST AND NOT A NIT.**
# That constant's note fixes sixteen rings by the SPACING they give — a silhouette reads as a
# polygon past about 24 mm of arc per ring at the crown's ~90 mm turn, and sixteen was chosen for a
# 187–344 mm card. A 510 mm card is 32 mm a ring. The turn over the crown is where it will show,
# and the fix is not a style's to make: the same note records that GRAVITY_PER_SEGMENT,
# GRAVITY_POWER and CURL_SHARE_OF_JITTER are authored per segment, the runtime's spring chains are
# one particle per ring, and TressFX's strands are sixteen points.
# =================================================================================================

HAIR_STYLES["long01"] = derive_style(
    "bob01",

    # 🚩 **LESS PER-SEGMENT BEND, NOT MORE, AND THE REASON IS THAT THE BEND IS AN ANGLE.** The turn
    # is summed over the segments and is therefore the same total however long the card is — so a
    # 510 mm card at bob01's 0.41 describes the same arc scaled up, and its last third points back
    # in toward the body. On a bob that arc ends at the collarbone and reads as ends turning under;
    # on this it drives the tips into the back and hands the work to `clamp_cards_off_the_body`,
    # whose own header says a repaired curve is a projection of the error rather than a shape.
    # 0.30 is a fall rather than a curl, which is what "straight" means.
    GRAVITY_PER_SEGMENT=0.30,

    # Near level. Long hair is cut to a line or to a shallow V and neither is face-framing.
    CUT_GRADUATION=0.06,

    # ⚠️ Held at bob01's FRACTIONS, which on a 640 mm groom is 6.0 mm and 5.2 mm of scatter on a
    # cut three times as long — proportionally a third of what the bob carries. That is the right
    # direction for long hair, whose ends are softer than a bob's, and it is the only place in this
    # round where leaving a number alone is the design act.
    CLUMP_POWER=1.9,
    LOCK_COUNT=14,
    TIP_WIDTH_FRACTION=0.55,

    layers={
        "mass": {"cut": 1.83, "length": 0.509},
        "underlayer": {"cut": 1.05, "length": 0.347},
        "body": {"cut": 1.55, "length": 0.451},
        "surface": {"cut": 1.78, "length": 0.499},
        "flyaway": {"cut": 1.90, "length": 0.524},
        "veil": {"cut": 1.83, "length": 0.509},
    },
)


# =================================================================================================
# pixie01 — very short, textured, with a side-swept front.
#
# 🎯 **THE SIDE SWEEP IS NOT A FRINGE, AND THAT IS THE ONE STRUCTURAL DECISION IN THIS ENTRY.**
# `root_direction` gives a `fringe` layer down-and-forward and NOTHING ELSE — no radial term, no
# part term, by design and with a plate behind the decision. So a fringe cannot sweep sideways;
# what can is a layer restricted to the front band WITHOUT the fringe flag, which then takes the
# ordinary field, and PART_WEIGHT 1.45 at PART_FALLOFF 1.10 was authored precisely to run that
# field sideways past the cheek instead of down it. This style therefore carries both: a short
# `fringe` for coverage at the hairline and a longer `sweep` outboard of it that is a front-
# restricted ordinary layer. Nine shells, which is the most any style here has.
# =================================================================================================

HAIR_STYLES["pixie01"] = derive_style(
    "bob01",

    CUT_FADE_HEIGHT=0.50,
    CUT_FADE_HEIGHT_LINE=0.38,
    CUT_FADE_SIDE=0.60,
    CUT_FADE_SIDE_LINE=0.30,
    CUT_GRADUATION=0.06,

    # The most scatter of any style in the table, and it is the definition of the cut: a pixie is
    # point-cut and its texture IS its ends. On a 20 mm side card 5 mm of scatter is a quarter of
    # the length, where on bob01 it was a sixtieth.
    CUT_LOCK_JITTER=0.028,
    CUT_CARD_JITTER=0.030,

    LOCK_COUNT=26,
    LOCK_CROWN_BIAS=0.50,
    CLUMP_POWER=1.3,

    # Kept HIGH, against crop01, and the `sweep` layer is why — see the heading.
    PART_WEIGHT=1.60,

    GRAVITY_PER_SEGMENT=0.24,
    ROOT_GRAVITY_WEIGHT=0.20,
    ATTACH_FADE=0.40,
    ATTACH_STRENGTH=0.85,
    HUG_REACH=0.030,

    TIP_WIDTH_FRACTION=0.42,
    CARD_TWIST=0.50,

    layers=[
        {"name": "root", "cards": 66, "standoff": 0.0075, "length": 0.032,
         "half_width": 0.0170, "strips": (1, 2), "gravity": 0.85, "jitter": 0.11,
         "part": 0.20, "crown": 1.60, "cut": None, "clump": 0.15},
        {"name": "mass", "cards": 60, "standoff": 0.0095, "length": 0.038,
         "half_width": 0.0140, "strips": (1,), "gravity": 0.95, "jitter": 0.15,
         "crown": 0.50, "cut": -0.84, "clump": 0.40, "tip_width": 0.26},
        {"name": "underlayer", "cards": 48, "standoff": 0.0085, "length": 0.030,
         "half_width": 0.0145, "strips": (1, 2), "gravity": 0.90, "jitter": 0.16,
         "cut": -0.92, "clump": 0.30},
        {"name": "body", "cards": 36, "standoff": 0.0110, "length": 0.042,
         "half_width": 0.0130, "strips": (1, 2), "gravity": 1.00, "jitter": 0.20,
         "cut": -0.80, "clump": 0.40},
        {"name": "surface", "cards": 36, "standoff": 0.0135, "length": 0.046,
         "half_width": 0.0115, "strips": (2, 3), "gravity": 1.05, "jitter": 0.24,
         "cut": -0.78, "clump": 0.45},
        {"name": "flyaway", "cards": 22, "standoff": 0.0170, "length": 0.052,
         "half_width": 0.0080, "strips": (6, 7), "gravity": 1.15, "jitter": 0.30,
         "cut": -0.74, "clump": 0.35, "cut_scatter": 2.4},
        {"name": "veil", "cards": 50, "standoff": 0.0120, "length": 0.040,
         "half_width": 0.0120, "strips": (1,), "gravity": 1.00, "jitter": 0.18,
         "crown": 0.35, "cut": -0.83, "clump": 0.45, "tip_width": 0.22},
        {"name": "fringe", "cards": 26, "standoff": 0.0115, "length": 0.030,
         "half_width": 0.0115, "strips": (1, 2), "gravity": 1.00, "jitter": 0.14,
         "front": 0.34, "fringe": True, "cut": 0.03, "clump": 0.25,
         "tip_width": 0.45, "cut_scatter": 0.60, "graduation": 0.0, "taper": 0.0},
        # 🎯 The sweep. `front` without `fringe`, so it grows in the ordinary field and the part
        # push carries it across the brow; `cut` is therefore measured from `hairline_z` like every
        # other layer rather than from `forehead_z`, and 0.03 puts its plane at 1.4918 — about
        # 70 mm below its own roots, which is a front section to the cheekbone. `taper` 0.0 because
        # the side half of the fade reaches the temples and the temples are where it is rooted;
        # `graduation` 0.0 because its edge, like a fringe's, is meant to be a line.
        {"name": "sweep", "cards": 46, "standoff": 0.0160, "length": 0.098,
         "half_width": 0.0150, "strips": (2, 3), "gravity": 1.10, "jitter": 0.20,
         "front": 0.34, "cut": 0.10, "clump": 0.35, "part": 1.00,
         "tip_width": 0.40, "graduation": 0.0, "taper": 0.0},
    ],
)


# =================================================================================================
# lob01 — shoulder-length and graduated, and it is the entry most likely not to earn its directory.
#
# 🚩 **bob01 IS ALREADY ALMOST EXACTLY A LOB AND THE MANIFEST SAYS SO IN ITS OWN WORDS** — "roughly
# to the collarbone", tips measured at z 1.3279 against a clavicle at 1.3425. So this entry is
# authored to be a lob DELIBERATELY DIFFERENT from that one rather than a rename of it: longer to
# the shoulder at 1.28, and heavily graduated — 0.30 of front-to-back rake against bob01's 0.09,
# and a layer stack whose cuts span 0.58 to 1.26 rather than 0.35 to 0.88, so the interior layers
# read as layers instead of as coverage.
#
# ⚠️ **AND THE THIRD THING THE BRIEF ASKS FOR — A CENTRE PART — IS NOT A STYLE'S TO SET.** The part
# plane is `arguments.hair_part`, a CLI knob, and `docs/CHECKPOINT.md` §13 measured that the three
# CLI knobs together move the silhouette LESS than baking the same groom on a different gender
# does. A centre-parted lob is `--hair lob01 --hair-part 0.0`, and if the parting is meant to be
# part of a style's identity then `hair_part` belongs in STYLE_PARAMETERS — which is a one-line
# change to `root_direction`'s signature and is not made here.
#
# ⏭️ **THE DECISION THIS ENTRY EXISTS TO INFORM IS WHETHER TO SHIP IT AT ALL**, and the number that
# decides is its silhouette IoU against bob01 measured on the bake. R30's control says the same
# haircut on a different GENDER scores 0.8329; anything above that is bob01 with a different seed.
# =================================================================================================

HAIR_STYLES["lob01"] = derive_style(
    "bob01",

    CUT_GRADUATION=0.30,

    # A graduated cut has no single line, so the scatter goes UP where bob02's went down.
    CUT_LOCK_JITTER=0.055,
    CUT_CARD_JITTER=0.032,

    CLUMP_POWER=1.8,
    LOCK_COUNT=18,

    layers={
        "mass": {"cut": 1.20, "length": 0.378},
        "underlayer": {"cut": 0.58, "length": 0.249},
        "body": {"cut": 0.95, "length": 0.326},
        "surface": {"cut": 1.15, "length": 0.367},
        "flyaway": {"cut": 1.26, "length": 0.390},
        "veil": {"cut": 1.20, "length": 0.378},
    },
)

def apply_style(name):
    """Binds one entry of HAIR_STYLES over this module's globals. Called once, from `build_hair`.

    See the style table's header for why a rebind and not a parameter object, and for what it
    costs. This function is the whole of the mechanism; everything below it reads plain globals and
    does not know a table exists.

    🚩 **THE CHECKS ARE THE POINT, AND THEY ARE ALL ONE DEFECT.** A parameter this file does not
    have, a parameter the style forgot, a layer dict with a misspelt optional key, two layers with
    the same name, a fringe rooted in a band it is not cut from — every one of them is a number the
    author believes is in effect and is not, and every one of them grows a perfectly good groom of
    the WRONG SHAPE while nothing complains. They cost microseconds and they run before any
    geometry, so the cheapest possible thing happens to the most expensive possible mistake.
    """
    style = HAIR_STYLES.get(name)
    if style is None:
        raise SystemExit(
            f"Build failed: --hair {name!r} names no entry in HAIR_STYLES, so there is no groom "
            f"shape to grow. The styles this build can grow are: "
            f"{', '.join(sorted(HAIR_STYLES))}.")

    unknown = sorted(set(style) - set(STYLE_PARAMETERS))
    if unknown:
        raise SystemExit(
            f"Build failed: style {name!r} carries {unknown}, which this file has no parameter "
            "for. A key nothing reads is a number the author thinks is in effect; the parameters "
            f"a style may set are STYLE_PARAMETERS in hair_cards.py: {list(STYLE_PARAMETERS)}.")

    missing = sorted(set(STYLE_PARAMETERS) - set(style))
    if missing:
        raise SystemExit(
            f"Build failed: style {name!r} does not set {missing}. A style declares every "
            "parameter it uses — there is deliberately no default to fall back on, because the "
            "default would be another haircut's number arriving silently.")

    for index, layer in enumerate(style["HAIR_LAYERS"]):
        keys = set(layer)
        layer_missing = sorted(set(LAYER_REQUIRED) - keys)
        layer_unknown = sorted(keys - set(LAYER_REQUIRED) - set(LAYER_OPTIONAL))
        if layer_missing or layer_unknown:
            raise SystemExit(
                f"Build failed: style {name!r} layer {index} ({layer.get('name', '?')!r}) "
                f"is missing {layer_missing} and carries unknown {layer_unknown}. "
                f"A layer's keys are {list(LAYER_REQUIRED)} plus any of {list(LAYER_OPTIONAL)}.")

    names = [layer["name"] for layer in style["HAIR_LAYERS"]]
    if len(set(names)) != len(names):
        raise SystemExit(
            f"Build failed: style {name!r} has two layers called the same thing ({names}). "
            "`grow_layer` keys each lock's attractor curve by the layer NAME, so duplicates would "
            "share one guide and the second layer would grow along the first one's curve.")

    # The fringe is rooted in the front band and cut from the plane that band defines, and
    # FOREHEAD_FRACTION is both. See the constant: one number rather than a per-layer key, or the
    # fringe is cut to a line it was never grown from. The table can express the mismatch, so this
    # refuses it.
    for layer in style["HAIR_LAYERS"]:
        if layer.get("fringe") and layer.get("front") != style["FOREHEAD_FRACTION"]:
            raise SystemExit(
                f"Build failed: style {name!r} roots its fringe in the front "
                f"{layer.get('front')} of the scalp region but measures the forehead over the "
                f"front {style['FOREHEAD_FRACTION']}. Those are the same band or the fringe is "
                "cut to a line it was never grown from.")

    # ⚠️ Bound, not copied: HAIR_LAYERS becomes the table's own list. Nothing below mutates a layer
    # dict — `grow_layer` reads them and keys the lock guides by name — so the aliasing is free, and
    # a copy would only hide a mutation that must not exist in the first place.
    globals().update(style)

    return style


def build_hair(basemesh, rig, arguments):
    """Grows the groom and returns (object, style id, report). Call after the macro bake.

    Mirrors `build_foundation_garments`'s contract closely enough that main() treats a groom and a
    foundation shell the same way at export time, and deliberately does not return the
    (object, path, id) garment triple: hair is not in the wardrobe manifest and must not resolve
    against it.
    """
    style = arguments.hair

    # 🎯 FIRST, AND BEFORE ANY MEASUREMENT OF THE BODY. `--hair` names a groom SHAPE, and every
    # constant that shape owns is unbound until this call — so a bad style name or a mistyped
    # parameter costs a rejected argument rather than twenty seconds of Blender and a groom whose
    # wrongness has to be noticed by eye. See the style table's header for the whole mechanism.
    apply_style(style)

    collide = not arguments.no_hair_collision
    scalp = read_scalp_region(basemesh)
    frame = ScalpFrame(basemesh, scalp)

    body = body_surface_of(basemesh)
    locks = place_locks(basemesh, frame, arguments)
    edge_scale = lock_edge_scale(frame)

    cards = []
    per_layer = []
    for layer in HAIR_LAYERS:
        grown = grow_layer(basemesh, frame, body if collide else None, layer, locks, edge_scale,
                           arguments)
        per_layer.append((layer["name"], len(grown)))
        cards.extend(grown)

    if not cards:
        raise SystemExit("Build failed: the groom came out with zero cards, which means the scalp "
                         "region selected nothing at this identity.")

    # 🚩 `--no-hair-cap` is the red proof for the coverage gate and nothing else. Without the
    # shells the groom is cards only, which is the state the top-down render showed bare skin in.
    shells = [] if arguments.no_hair_cap else build_scalp_cap(basemesh, frame)

    hair_object = assemble_cards(basemesh, cards, shells, style, locks, edge_scale)
    clamped, rescued, nearest, nearest_at = clamp_cards_off_the_body(
        hair_object, body, frame, collide)
    weight_to_head(hair_object, rig)
    bind_to_rig(hair_object, basemesh, rig)

    texture_directory = hair_texture_directory(arguments, style)
    maps = hair_texture.write_strand_atlas(texture_directory, seed=arguments.hair_seed,
                                           colour=arguments.hair_colour)
    assign_hair_material(hair_object, style, dict((name, path) for name, path, _ in maps))

    report = HairReport(style, frame, per_layer, hair_object, clamped, nearest, maps,
                        texture_directory, collide, len(shells), cards, nearest_at, rescued,
                        edge_scale)

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

        # 🚩 **`hairline_z` IS NOT THE FOREHEAD HAIRLINE AND R23 LOST A BUILD TO ASSUMING IT WAS.**
        # It is `low.z + HAIRLINE_LIFT · height`, and `low.z` is the minimum over the WHOLE region —
        # which reaches the NAPE. Measured at g050: `hairline_z` is 1.4970 and the figure's own
        # eyebrow mesh spans 1.5568–1.5672, so the plane every layer's cut is measured from sits
        # 60 mm BELOW the brow, at the level of the nose bridge. That is harmless for a layer whose
        # cut is a drop of 0.35–0.88 of the region's height, because the number was fitted against
        # the plane it uses. It is fatal for a fringe: the first build put `cut` 0.13 below it and
        # the plate showed a curtain across both eyes and down to the mouth.
        #
        # So the fringe gets its own reference, taken the same way everything else here is — off the
        # region. `forehead_z` is the lowest the region reaches at the FRONT, which is the hairline
        # in the sense a hairdresser means, and it lands just above the brow on any identity because
        # the region's front edge is trimmed by the brow targets' own reach (FACE_MOTION_TARGETS).
        front_cutoff = self.low.y + FOREHEAD_FRACTION * self.depth
        forehead = [polygon for polygon in self.faces if polygon.center.y <= front_cutoff]
        if not forehead:
            raise SystemExit(f"Build failed: no scalp face is inside the front {FOREHEAD_FRACTION} "
                             "of the region, so the fringe has no hairline to be cut from.")
        self.forehead_z = min(polygon.center.z for polygon in forehead)

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
                f"hairline z {self.hairline_z:.4f}  forehead z {self.forehead_z:.4f}  "
                f"height {self.height * 1000:.1f} mm  "
                f"depth {self.depth * 1000:.1f} mm  half-width {self.half_width * 1000:.1f} mm")


class BodySurface:
    """The body the groom must stay outside of, and everything a SIGNED distance to it needs.

    The WHOLE body rather than the head: a 215 mm card grown from the nape reaches the trapezius,
    and a groom that clears the skull and passes through a shoulder has solved the easy half.

    🎯 **THE SAME TRIANGLES AND THE SAME SIGN RULE AS THE GATE, WHICH IS THE FIX FOR A MARGIN THIS
    FILE USED TO PAY IN MILLIMETRES.** `HAIR_CLEARANCE_M`'s note records the build and
    `verify_glb.mjs` disagreeing about the same vertex and answers it by aiming half a millimetre
    high. The margin held until the cut made the cards long enough to reach the ear and the brow,
    where the quads are small and curved. Both halves of the disagreement were then measured:

      TRIANGULATION. `BVHTree.FromPolygons` over the mesh's QUADS picks its own diagonal; the glTF
      exporter calls `blender_mesh.calc_loop_triangles()` and writes those — `io_scene_gltf2/
      blender/exp/primitive_extract.py:393`. Build-side 3.504–3.519 mm came back as 3.273 / 3.091 /
      3.247 / **2.945** / **2.584** mm off the five exported files, and g075 and g100 failed the
      3 mm floor. Feeding the BVH `loop_triangles` instead brought four of the five to agreement in
      the third decimal — 3.510/3.510, 3.503/3.503, 3.508/3.508, 3.504/3.504.

      THE SIGN. The fifth did not: g000 read +3.502 mm here and **−5.267 mm** there, a vertex the
      gate calls inside the body and this file called clear. `find_nearest` hands back the FACE
      normal, and `hair_geometry.mjs` signs by the body's own INTERPOLATED VERTEX normal — the
      standard smooth-mesh inside test, and the only one that agrees with itself across an edge.
      Inside the fold of an ear the two point different ways. So this file signs the same way.

    Widening the margin instead would have been guessing at a ceiling nobody had measured.
    """

    def __init__(self, basemesh):
        mesh = basemesh.data
        mesh.calc_loop_triangles()

        self.points = [vertex.co.copy() for vertex in mesh.vertices]
        self.normals = [vertex.normal.copy() for vertex in mesh.vertices]
        self.triangles = [tuple(triangle.vertices) for triangle in mesh.loop_triangles]
        self.tree = BVHTree.FromPolygons(self.points,
                                         [list(corners) for corners in self.triangles])

    def normal_at(self, triangle_index, location):
        """The interpolated vertex normal at a point on one of the body's triangles."""
        first, second, third = self.triangles[triangle_index]
        corner = self.points[first]
        along = self.points[second] - corner
        across = self.points[third] - corner
        offset = location - corner

        # Barycentric by Cramer's rule on the triangle's own plane. A degenerate triangle has no
        # interior to interpolate over, so its first corner's normal is as good an answer as any.
        along_along = along.dot(along)
        along_across = along.dot(across)
        across_across = across.dot(across)
        area = along_along * across_across - along_across * along_across
        if abs(area) < 1e-18:
            return self.normals[first].copy()

        offset_along = offset.dot(along)
        offset_across = offset.dot(across)
        second_weight = (across_across * offset_along - along_across * offset_across) / area
        third_weight = (along_along * offset_across - along_across * offset_along) / area
        first_weight = 1.0 - second_weight - third_weight

        normal = (self.normals[first] * first_weight
                  + self.normals[second] * second_weight
                  + self.normals[third] * third_weight)

        return normal.normalized() if normal.length > 1e-9 else self.normals[first].copy()


def body_surface_of(basemesh):
    """The collision surface for this build. See `BodySurface` for why it is not just a BVH."""
    return BodySurface(basemesh)


# --- locks --------------------------------------------------------------------------------------


class Lock:
    """One lock of hair: the centre every layer's nearest cards are drawn toward, and its habits.

    A lock owns three random draws and each of them used to belong to a card. The point of moving
    them here is that a lock is what the eye resolves: sixteen locks that each lean, curl and end
    slightly differently reads as a style, where 484 cards that each do reads as frizz. See
    LOCK_DIRECTION_SHARE for the measurement that says which one the groom was.
    """

    def __init__(self, position, normal, random):
        self.position = position
        self.normal = normal

        # Unit-cube draws rather than metres or radians: they are scaled by the LAYER's own jitter
        # and cut budgets at the point of use, so one lock leans the same WAY at every depth while
        # the outer layers still lean further than the inner ones do.
        self.direction_bias = Vector((random.uniform(-1.0, 1.0), random.uniform(-1.0, 1.0),
                                      random.uniform(-1.0, 1.0)))
        self.curl_bias = Vector((random.uniform(-1.0, 1.0), random.uniform(-1.0, 1.0),
                                 random.uniform(-1.0, 1.0)))
        self.cut_bias = random.uniform(-1.0, 1.0)

        # Filled in per layer by `grow_layer`: the attractor curve this lock's cards converge on.
        self.guides = {}


def place_locks(basemesh, frame, arguments):
    """The groom's lock centres, dart-thrown over the scalp once and shared by every layer.

    Its own RNG stream, seeded off the groom seed and deliberately not off any layer's index, so
    that changing a layer's card count cannot move the locks — the layers would then all re-lock
    around a different set of centres and a one-line change to `flyaway` would rebuild the whole
    style. See LOCK_COUNT for why the centres are shared at all.
    """
    import random as random_module

    random = random_module.Random(arguments.hair_seed * 1000 + 900)
    centres = sample_roots(basemesh, frame, LOCK_COUNT, random, LOCK_CROWN_BIAS)

    if not centres:
        raise SystemExit("Build failed: no lock centre landed on the scalp, so there is nothing "
                         "for the cards to gather into.")

    return [Lock(position, normal, random) for position, normal in centres]


def lock_membership(locks, position):
    """Which lock a point belongs to, and how far it sits from that lock's boundary.

    Returns `(index, nearest_distance, second_distance)`. One function for both because the two
    numbers have to come from the same metric and the same tie-break: `nearest_lock` used to be a
    separate `min()` and a second `min()` beside it would have been two chances to disagree.

    Exact over all `LOCK_COUNT` centres rather than over a neighbourhood — see LOCK_UV_LAYER.
    """
    ordered = sorted(range(len(locks)),
                     key=lambda index: (locks[index].position - position).length_squared)

    nearest = ordered[0]
    second = ordered[1] if len(ordered) > 1 else ordered[0]

    return (nearest,
            (locks[nearest].position - position).length,
            (locks[second].position - position).length)


def nearest_lock(locks, position):
    """The lock a root belongs to. Straight-line nearest — the scalp is convex at this scale."""
    return locks[lock_membership(locks, position)[0]]


def lock_edge_scale(frame):
    """Metres of scalp per unit of the emitted edge channel. See LOCK_UV_LAYER."""
    return math.sqrt(frame.area / LOCK_COUNT)


def lock_channel(locks, position, edge_scale):
    """The two floats that go into TEXCOORD_1 for a point. See LOCK_UV_LAYER for both.

    `(index + 0.5) / LOCK_COUNT` and `clamp((d2 − d1) / edge_scale, 0, 1)`.
    """
    index, nearest, second = lock_membership(locks, position)

    identity = (index + 0.5) / LOCK_COUNT
    edge = min(max((second - nearest) / edge_scale, 0.0), 1.0)

    return (identity, edge)


def lock_uv(channel):
    """The lock channel as it must be WRITTEN into a UV layer, which is not as it is meant.

    🚩 **BLENDER'S glTF EXPORTER FLIPS `v` ON EVERY UV LAYER, AND THE FIRST BUILD OF THIS CHANNEL
    SHIPPED THE EDGE DISTANCE INSIDE OUT.** glTF's UV origin is the top-left and Blender's is the
    bottom-left, so `v_gltf = 1 − v_blender` for TEXCOORD_0 and for every layer after it. It was
    caught by `verify_glb.mjs`, which read an edge p50 of 0.753 off the file against the 0.245 this
    build's own report had just printed — the same number, the wrong way up, which is exactly the
    shape of an unexamined convention.

    Measured on the shipped file rather than recalled: TEXCOORD_0's root ring, which this file
    writes at `v = 1`, arrives at **`v = 0`** with the root at y 1.5083 and the tip at y 1.4362.

    The flip is applied HERE, at the write, so that the file — which is what the shader and the
    gate both read — carries the channel the right way up and nothing downstream has to know this
    paragraph exists. `u` is unaffected.
    """
    identity, edge = channel

    return (identity, 1.0 - edge)


def draw_into_lock(guide, lock_guide, tightness, body, standoff):
    """Blends a card's own curve toward its lock's, by a weight that is 0 at the root.

    Index-wise rather than by arc length: both curves carry GUIDE_SEGMENTS + 1 points and both are
    resampled uniformly by `grow_to_cut`, so index i is the same fraction along either one.

    🚩 **THE BLEND BREAKS THE CLEARANCE THE INTEGRATOR ESTABLISHED, AND IT BROKE THE BUILD.** Both
    curves are clear of the body; the straight line between them is not, because the body is not
    convex — a card on one side of the jaw drawn toward a lock on the other passes THROUGH it. The
    first build with clumping in it wrote g025 at 3.061 mm and g100 at **−5.250 mm**, a vertex
    inside the skull, and `HairReport.describe` failed both. So the blend restores what it took:
    the same push-out `grow_guide` applies at every step, run over the blended curve. Three passes
    for the reason `clamp_cards_off_the_body` runs twenty-four — one pass out of a concave crease
    lands nearer a neighbouring triangle — and the final clamp is still there behind it, because a
    ribbon's corners are half a width off the curve and were never checked here.
    """
    if tightness <= 0.0:
        return guide

    blended = []
    for index, point in enumerate(guide):
        s = index / (len(guide) - 1)
        blended.append(point.lerp(lock_guide[index], tightness * s ** CLUMP_POWER))

    if body is None:
        return blended

    for _pass in range(CLUMP_CLEARANCE_PASSES):
        moved = False
        for index, point in enumerate(blended):
            location, normal, distance = signed_distance_to(body, point)
            if location is not None and distance < standoff:
                blended[index] = location + normal * standoff
                moved = True
        if not moved:
            break

    return blended


# --- growing a layer ----------------------------------------------------------------------------


def grow_layer(basemesh, frame, body, layer, locks, edge_scale, arguments):
    """One shell of cards: sample roots, grow a guide from each, gather them into locks, ribbon."""
    import random as random_module

    # 🚩 **`hash()` ON A str IS SALTED PER PROCESS, and the first version used it.** `PYTHONHASHSEED`
    # is random unless it is set, so `hash(layer["name"])` returned a different number every run and
    # the groom was NOT reproducible from its seed — `assets/hair/manifest.json` says it is. It was
    # caught by a rebuild that produced a card 5.250 mm inside the skull where the previous run of
    # the same command had produced 3.517 mm of clearance. The layer's INDEX is stable, ordered and
    # already unique.
    random = random_module.Random(arguments.hair_seed * 1000 + HAIR_LAYERS.index(layer))

    # This layer's attractor curve for each lock, grown BEFORE any card so that every card in the
    # layer has one to converge on. Grown with the lock's own bias and no card residue at all: it
    # is the lock's canonical curve, not one more card.
    for lock in locks:
        lock.guides[layer["name"]] = grow_to_cut(
            lock.position, lock.normal, frame, body, layer, arguments,
            deflection=layer["jitter"] * lock.direction_bias,
            curl=layer["jitter"] * CURL_SHARE_OF_JITTER * lock.curl_bias,
            cut_z=cut_height(frame, layer, lock.position, lock.cut_bias, 0.0))

    roots = sample_roots(basemesh, frame, layer["cards"], random,
                         layer.get("crown", 0.0), layer.get("front"))

    cards = []
    for index, (position, normal) in enumerate(roots):
        lock = nearest_lock(locks, position)

        guide = grow_to_cut(
            position, normal, frame, body, layer, arguments,
            deflection=layer["jitter"] * shared_with_lock(lock.direction_bias, random),
            curl=(layer["jitter"] * CURL_SHARE_OF_JITTER
                  * shared_with_lock(lock.curl_bias, random)),
            cut_z=cut_height(frame, layer, position, lock.cut_bias,
                             random.uniform(-1.0, 1.0)))

        guide = draw_into_lock(guide, lock.guides[layer["name"]], layer["clump"],
                               body, layer["standoff"])

        strip = layer["strips"][index % len(layer["strips"])]

        # 🎯 THE LOCK CHANNEL IS READ AT THE ROOT, WHICH IS WHERE THE GROOM'S OWN MEMBERSHIP IS
        # DECIDED. `nearest_lock(locks, position)` two statements above is the assignment that
        # gathers this card; emitting anything measured further down the shaft would ship a
        # membership the geometry does not have. See LOCK_UV_LAYER.
        cards.append(ribbon_of(guide, frame, layer, strip, random,
                               lock_channel(locks, position, edge_scale)))

    return cards


def shared_with_lock(lock_bias, random):
    """The lock's deflection plus this card's own residue. See LOCK_DIRECTION_SHARE."""
    own = Vector((random.uniform(-1.0, 1.0), random.uniform(-1.0, 1.0),
                  random.uniform(-1.0, 1.0)))

    return lock_bias * LOCK_DIRECTION_SHARE + own * (1.0 - LOCK_DIRECTION_SHARE)


def sample_roots(basemesh, frame, count, random, crown_bias, front=None):
    """`count` root points on the scalp, area-weighted and spread by dart throwing.

    🚩 Uniform random sampling of a surface CLUMPS, and a clumped groom has bald patches next to
    doubled cards — which is the same defect a bald patch is, arriving twice. Dart throwing with a
    minimum separation derived from the region's own area is the cheapest fix that does not need a
    relaxation pass: `radius` is 80% of the spacing a perfect hexagonal packing of `count` discs
    over this area would have, so the target count is reachable but the packing is still even.

    `front` restricts the region to the frontmost fraction of its own depth, which is what makes a
    FRINGE a separate structural element rather than the front of the same shell — see the `fringe`
    entry in HAIR_LAYERS. The face is at −Y on this mesh, so the front of the region is its low y.
    Everything downstream — the area, the dart radius, the weights — is recomputed over the
    restricted set, so the fringe's 34 cards are 34 cards packed across the front hairline rather
    than 34 cards' worth of dart spacing thrown at the whole scalp and mostly rejected.
    """
    mesh = basemesh.data
    faces = frame.faces
    area = frame.area

    if front is not None:
        cutoff = frame.low.y + front * frame.depth
        # At and above the forehead edge as well as in front of the cutoff: a root on the TEMPLE is
        # in the front third and is not in the fringe, and a card grown down from one lands on the
        # cheek — which is the slab across the cheekbone the portrait plate has carried all phase.
        faces = [polygon for polygon in faces
                 if polygon.center.y <= cutoff and polygon.center.z >= frame.forehead_z]
        if not faces:
            raise SystemExit(f"Build failed: no scalp face is inside the front {front:.2f} of the "
                             "region, so the fringe would have no roots.")
        area = sum(polygon.area for polygon in faces)

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

    radius = math.sqrt(area / (count * math.pi)) * 0.80

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


def root_direction(position, normal, frame, part_fraction, layer, deflection):
    """Which way the hair leaves the scalp at this root. See "The growth field" in the header.

    `deflection` is the already-scaled random lean, passed in rather than drawn here: most of it
    belongs to the card's LOCK and is shared with its neighbours. See LOCK_DIRECTION_SHARE.
    """
    # 🎯 **THE FRINGE DOES NOT LEAVE THE SCALP THE WAY THE REST OF THE GROOM DOES, WHICH IS THE
    # WHOLE OF OBSERVATION 4.** Every other layer's root direction is radial from the whorl plus the
    # part push, and on the front of the head that field runs FORWARD and then sideways — an earlier
    # round learned that the hard way and PART_FALLOFF is 1.10 precisely so the front sweeps past
    # the cheek instead of down it. A fringe is the opposite: it falls straight down in its own
    # plane, at its own angle, and stops at a clean line. So it takes down-and-forward, no radial
    # term and no part term at all, and it is the ONLY layer that does.
    if layer.get("fringe"):
        fringe = (Vector((0.0, 0.0, -1.0))
                  + Vector((0.0, -1.0, 0.0)) * FRINGE_FORWARD
                  + deflection)
        fringe = tangent_component(fringe, normal)
        if fringe.length < 1e-6:
            fringe = tangent_component(Vector((0.0, -1.0, -1.0)), normal)

        return fringe.normalized()

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

    direction += deflection

    direction = tangent_component(direction, normal)
    if direction.length < 1e-6:
        direction = tangent_component(Vector((0.0, 1.0, -1.0)), normal)

    return direction.normalized()


def tangent_component(vector, normal):
    """`vector` with everything along `normal` removed — the tangent plane's copy of it."""
    return vector - normal * vector.dot(normal)


def cut_height(frame, layer, root, lock_bias, card_bias):
    """The z this card is cut at, or None for a layer that is not cut. See "the cut" above.

    Every term is a fraction of the region's own height, so the cut travels with the identity the
    way the hairline and the whorl already do.
    """
    cut = layer.get("cut")
    if cut is None:
        return None

    scatter = layer.get("cut_scatter", 1.0)
    drop = (cut
            + CUT_LOCK_JITTER * scatter * lock_bias
            + CUT_CARD_JITTER * scatter * card_bias)

    # Face-framing: the front of the cut hangs lower. The face is at −Y on this mesh, so a root
    # toward the back has the larger y and the higher cut.
    #
    # ⚠️ **THE FRINGE TURNS THIS OFF, AND THE FIRST BUILD WITH A FRINGE IN IT SHOWS WHY.** The
    # graduation and the two jitters are all measured from the same 0.13 drop, so on the front of
    # the head they ran the fringe's cut from 0.079 to 0.24 of the region's height — 14 mm to 41 mm
    # below the hairline — and 41 mm below the hairline is the EYE. Rendered, the plate showed a
    # fringe hanging over the character's right eye while the left brow stayed bare. A fringe's
    # lower edge is the one line in this groom that is deliberate; see observations 4 and 5.
    front_to_back = (root.y - (frame.low.y + frame.high.y) * 0.5) / max(frame.depth, 1e-6)
    drop -= CUT_GRADUATION * layer.get("graduation", 1.0) * front_to_back

    # The same idea over the other two axes of the scalp, which is what makes a men's cut. A layer
    # may scale it the way it already scales the graduation; the fringe of a style that has a fade
    # will want `taper: 0.0` for the reason the fringe already carries `graduation: 0.0`.
    drop -= taper_at(frame, root) * layer.get("taper", 1.0)

    reference = frame.forehead_z if layer.get("fringe") else frame.hairline_z
    return reference - drop * frame.height


def taper_at(frame, root):
    """How much of the region's height the cut is RAISED at this root. The fade. 0.0 in bob01.

    🎯 **A MEN'S CUT IS NOT A SHORT BOB — IT IS A CUT WHOSE LENGTH VARIES OVER THE SCALP**, short
    at the sides and the nape, long on top, graduated between. `CUT_GRADUATION` in `cut_height`
    above is already that mechanism over the front-to-back axis, expressed as a fraction of the
    region's own depth; this is the same expression over the other two, and it is here rather than
    inline because it is two axes and a knee and that is a paragraph's worth of reasoning.

    🚩 **"A FADE IS A FUNCTION OF HEIGHT ON THE SKULL" IS THE INTUITION AND IT IS REFUTED ON THIS
    REGION.** Measured over all 496 roots of bob01 at g050, in fractions of the region's own height
    and half-width (`(z − low.z)/height`, `|x|/half_width`):

      * the correlation between the two is **−0.2414**. Height is not a proxy for lateral.
      * the roots in the LOWEST quarter of the region are the NAPE, not the sides: 43 of 46 sit in
        the back third of the region's depth, 3 over the ear, and ZERO at the front — the front
        edge of the region is trimmed by the brow targets' own reach (FACE_MOTION_TARGETS), so the
        region's lowest front face is already at 0.4334 of its height.
      * the roots that ARE the sides — `|x|/half_width > 0.75` and below 0.85 of the height, 154
        of them — sit at a mean height fraction of **0.600 ± 0.160**, i.e. the MIDDLE of the skull,
        against **0.934 ± 0.056** for the crown group (`|x|/half_width < 0.35`, height > 0.75).

    So a height-only field shortens the nape and barely touches the sides, and a lateral-only field
    shortens the sides and the temples and leaves the nape long — the nape's own mean lateral
    fraction is 0.409. A short-back-and-sides is the UNION of the two, which is why this is a SUM
    of two ramps and not one term over a blended axis. Separation of the crown group from the
    sides and the nape, in pooled standard deviations, for the candidates that were tried:

      | field                                     | crown−sides | crown−nape |
      |-------------------------------------------|------------:|-----------:|
      | height alone                               |       +2.91 |      +5.71 |
      | lateral alone                              |       −4.52 |      −1.46 |
      | upwardness about `frame.head_centre`       |       +2.50 |      +5.70 |
      | angle from the whorl about `head_centre`   |       +1.77 |      +1.99 |
      | **this sum, both weights 0.5, lines 0.0** |   **+5.82** |  **+4.96** |

    ⚠️ **THE TWO GEOMETRIC CANDIDATES ARE THE TWO THAT LOOK MOST PRINCIPLED AND BOTH ARE WORSE.**
    `head_centre` is deliberately a quarter of the region's height BELOW the region (see
    `ScalpFrame`) so that ribbons face outward from the head rather than from the scalp, and that
    is exactly what ruins it as a fade axis: every point on the cranium is nearly straight up from
    it, so the whole scalp lands between 0.795 and 0.972 of one unit and the field has no dynamic
    range to spend. The whorl angle is worse still — the whorl is set back by WHORL_SETBACK, so its
    contours run round the head the wrong way and the front reads the same as the nape (0.844
    against 0.842).

    Both axes are fractions of a quantity `ScalpFrame` measures off the mesh — `frame.height` and
    `frame.half_width` — which is the invariant every authored constant in this file obeys and the
    only reason a number here lands correctly on an identity nobody has built. `frame.crown.z` is
    the anchor for the height axis rather than `frame.hairline_z`, because the crown is where a
    men's cut is longest and the hairline is not a level surface: it is `low.z + HAIRLINE_LIFT ·
    height` and `low.z` reaches the NAPE, which is the trap `ScalpFrame` records at length.

    ⚠️ **WHAT THIS CANNOT DO, so nobody later believes it bought more than it did.** It moves where
    a card is CUT and nothing else. It cannot produce a ponytail, a bun, a chignon or a braid —
    those are a GATHER POINT the guide has to be drawn toward, which is `draw_into_lock` with a
    world-space attractor rather than a per-layer lock curve. It cannot produce a receding
    hairline, a widow's peak, a bald crown or a shaved-to-skin fade, because the roots are still
    everywhere the scalp region is: those need a per-root DENSITY field in `sample_roots`, and a
    fade that reaches zero length here leaves a stub at `CUT_MINIMUM_LENGTH`, not skin. It cannot
    part the hair differently, sweep it, or spike it — direction is `root_direction`'s. And it
    cannot make the sides LONGER than the top, because both amounts raise the cut plane and a
    negative amount would put it above the root; see the guard in `grow_to_cut`.
    """
    below = (frame.crown.z - root.z) / max(frame.height, 1e-6)
    aside = abs(root.x) / max(frame.half_width, 1e-6)

    return (CUT_FADE_HEIGHT * fade_ramp(below, CUT_FADE_HEIGHT_LINE)
            + CUT_FADE_SIDE * fade_ramp(aside, CUT_FADE_SIDE_LINE))


def fade_ramp(fraction, line):
    """0 until `fraction` passes `line`, then straight to 1 at 1.0. The barber's guard line.

    🚩 **WITHOUT THE LINE THIS IS A GRADUATION AND NOT A FADE, and the difference is the whole
    read.** A ramp anchored at the crown shortens every card that is not at the crown, which is a
    layered cut; a fade leaves the top ONE length and starts taking it away at a line around the
    head. `line` is where that line sits, as a fraction of the same axis the ramp is measured on.

    ⚠️ **MEASURED, ON THE 496 ROOTS OF bob01 AT g050, AND THE LINE IS WORTH ITS NAME.** With both
    weights at 0.5 and both lines at 0.0 the crown group is still raised a mean of **21.5 mm** —
    the top of the head is being cut, which is not what a fade does. With both lines at 0.35 the
    same group reads **exactly 0.0 mm** and the sides still read 83.2 mm and the nape 67.1 mm. The
    line costs 0.4 of a pooled standard deviation of separation (+5.82/+4.96 down to +5.41/+4.37)
    and buys the flat top, which is the read.

    ⚠️ Linear, and a smoothstep is the obvious refinement. It is not here because nothing has
    measured a defect it would fix: the cut already carries CUT_LOCK_JITTER and CUT_CARD_JITTER,
    which are ±6.0 mm and ±5.2 mm of the region's height at bob01's settings, and the kink in the
    ramp's derivative is a contour on a surface already scattered by more than it.
    """
    return min(max((fraction - line) / max(1.0 - line, 1e-6), 0.0), 1.0)


def grow_to_cut(root, root_normal, frame, body, layer, arguments, deflection, curl, cut_z):
    """Grows one guide and lands its tip on the cut plane. See "the cut" for why in two stages.

    Returns GUIDE_SEGMENTS + 1 points, uniformly spaced along the curve's own arc.
    """
    direction = root_direction(root, root_normal, frame, arguments.hair_part, layer, deflection)

    length = layer["length"]
    guide = grow_guide(root, root_normal, direction, body, frame, layer, curl, length)

    if cut_z is None:
        return guide

    low, high = CUT_LENGTH_BOUNDS
    floor = layer["length"] * CUT_MINIMUM_LENGTH

    for _correction in range(CUT_CORRECTIONS):
        achieved = guide[0].z - guide[-1].z
        wanted = guide[0].z - cut_z
        # A root already at or below its own cut plane has nothing to correct toward, and a card
        # that has not descended at all — one lying flat over the crown — would divide by nothing.
        if achieved <= 1e-4 or wanted <= 0.0:
            break

        corrected = min(max(length * wanted / achieved,
                            layer["length"] * low), layer["length"] * high)
        if abs(corrected - length) < 1e-4:
            break

        length = corrected
        guide = grow_guide(root, root_normal, direction, body, frame, layer, curl, length)

    # 🚩 **A CUT PLANE AT OR ABOVE THE ROOT MUST GIVE THE SHORTEST CARD IN THE GROOM, AND WITHOUT
    # THIS LINE IT GIVES THE LONGEST.** `arc_length_at_height` returns the whole polyline when the
    # curve never descends through the plane, and that is the RIGHT answer for the case it was
    # written for — a card that stops short of its own cut keeps all of itself. It is the exact
    # wrong answer for a card whose cut plane is over its own head: the curve cannot descend
    # through a plane it starts below, so the shortest card in the groom comes out uncut.
    #
    # Nothing in bob01 reaches it — measured at g050 with the jitters zeroed, the smallest margin
    # between a root and its own cut plane is 15.35 mm on `fringe` and 60.38 mm on `underlayer`,
    # against a cut jitter of ±1.4 mm on the fringe — which is why this is a guard rather than a
    # bug report. A CUT_FADE_HEIGHT of 0.38 at line 0.0 closes `underlayer`'s 60.38 mm exactly, and
    # a fade of any strength closes the fringe's 15.35 mm unless the fringe carries `taper: 0.0` —
    # which is the same thing it already does with `graduation`, and for the same reason.
    reach = floor if cut_z >= root.z else arc_length_at_height(guide, cut_z)

    return resample(guide, max(floor, reach))


def arc_length_at_height(points, cut_z):
    """How far along a polyline its first descent through `cut_z` is. Its whole length if never."""
    travelled = 0.0
    for index in range(1, len(points)):
        before, after = points[index - 1], points[index]
        span = (after - before).length
        if after.z <= cut_z < before.z:
            drop = before.z - after.z
            return travelled + span * (before.z - cut_z) / max(drop, 1e-9)
        travelled += span

    return travelled


def resample(points, length):
    """The first `length` metres of a polyline, as GUIDE_SEGMENTS + 1 uniformly spaced points.

    Uniform in arc rather than keeping the integrator's own steps: the correction above changes a
    card's length by up to 2.6×, and a ribbon whose rings bunch at one end has its texture bunched
    there too — the strand sheet's root darkening would land halfway down the hair.
    """
    spans = [(points[index] - points[index - 1]).length for index in range(1, len(points))]
    total = sum(spans)
    if total < 1e-9:
        return [point.copy() for point in points]

    length = min(max(length, 1e-4), total)

    resampled = [points[0].copy()]
    segment = 0
    walked = 0.0
    for ring in range(1, GUIDE_SEGMENTS + 1):
        target = length * ring / GUIDE_SEGMENTS
        while segment < len(spans) - 1 and walked + spans[segment] < target:
            walked += spans[segment]
            segment += 1

        along = (target - walked) / max(spans[segment], 1e-9)
        resampled.append(points[segment].lerp(points[segment + 1], min(max(along, 0.0), 1.0)))

    return resampled


def grow_guide(root, root_normal, direction, body, frame, layer, curl, length):
    """Integrates one guide curve from the scalp outward, sliding over whatever is in the way.

    `curl` is a constant nudge added at every segment, so a card bows one way over its length
    rather than wobbling. Scaled small at the call site: it is added to a UNIT heading sixteen
    times, so a fraction of the layer's jitter is already a visible curve by the tip. Most of it
    belongs to the card's lock — see LOCK_DIRECTION_SHARE.
    """
    standoff = layer["standoff"]
    step = length / GUIDE_SEGMENTS

    point = root + root_normal * standoff
    points = [point.copy()]

    # The band the skull's support runs out over. Full above it, nothing at the hairline — see
    # ATTACH_FADE for the eye this cost when it was a fraction of the arc instead.
    band = max(ATTACH_FADE * frame.height, 1e-6)

    for segment in range(GUIDE_SEGMENTS):
        s = (segment + 1) / GUIDE_SEGMENTS
        previous = point.copy()

        bend = GRAVITY_PER_SEGMENT * layer["gravity"] * (s ** GRAVITY_POWER)
        direction = (direction + Vector((0.0, 0.0, -1.0)) * bend + curl).normalized()

        point = point + direction * step

        if body is None:
            points.append(point.copy())
            continue

        location, surface_normal, distance = signed_distance_to(body, point)
        attached = min(1.0, max(0.0, (point.z - frame.hairline_z) / band))

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


def ribbon_of(guide, frame, layer, strip, random, lock):
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

        tip_width = layer.get("tip_width", TIP_WIDTH_FRACTION)
        half = (layer["half_width"] * width_scale
                * (1.0 - (1.0 - tip_width) * s))

        rings.append((point - across * half, point + across * half, s))

    return {"rings": rings, "strip": strip, "layer": layer["name"], "lock": lock}


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


def assemble_cards(basemesh, cards, shells, style, locks, edge_scale):
    """Builds the one hair mesh out of every card and both cap shells, with their UVs.

    Cards share no vertices. That is deliberate and it is what makes the card count MEASURABLE off
    the exported file — `verify_glb.mjs` counts connected components and classifies each one by its
    topology — and it is also correct: two cards that shared a vertex would share a UV, and their
    strips are different. The cap shells are the components that are NOT quad strips, which is how
    the gate tells them apart without being told how many of either to expect.

    🚩 **THE SECOND UV LAYER IS WRITTEN PER VERTEX ON THE CAP AND PER CARD ON THE CARDS, AND THAT
    ASYMMETRY IS WHAT PROTECTS THE COMPONENT COUNT.** A card owns its vertices outright, so a
    per-card constant costs no splits. The cap's vertices are SHARED between faces, and Blender's
    exporter de-duplicates on the whole attribute tuple — so writing a per-FACE lock id there would
    split every shared cap vertex and shatter the cap into hundreds of components, which is exactly
    the failure `export_hair_fragment` records for `export_tangents=True` and exactly what the
    card-count gate is built on. A per-vertex value adds no split that TEXCOORD_0 did not already
    cause. The cost is that the cap's lock id INTERPOLATES across a face; the cap is the opaque
    shell underneath 496 cards, so what interpolates there is a shading term nobody can see.
    """
    mesh = bmesh.new()
    uv_layer = mesh.loops.layers.uv.new("UVMap")

    # Created here rather than after the faces so that every loop carries it from the start — a
    # layer added later leaves the existing loops on (0,0), which decodes as lock 0 everywhere.
    lock_layer = mesh.loops.layers.uv.new(LOCK_UV_LAYER)

    for shell in shells:
        made = {index: mesh.verts.new(point) for index, point in shell["points"].items()}
        shell_locks = {index: lock_uv(lock_channel(locks, point, edge_scale))
                       for index, point in shell["points"].items()}
        for corners in shell["faces"]:
            # `faces.new` keeps the order it is given, so the loops come back in corner order and
            # the UVs can be zipped straight on.
            face = mesh.faces.new([made[index] for index, _uv in corners])
            for loop, (index, uv) in zip(face.loops, corners):
                loop[uv_layer].uv = uv
                loop[lock_layer].uv = shell_locks[index]

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
                    loop[lock_layer].uv = lock_uv(card["lock"])

            previous = (left, right, s)

    mesh.verts.index_update()
    mesh.faces.index_update()

    data = bpy.data.meshes.new(f"{HAIR_MATERIAL_PREFIX}{style}")
    mesh.to_mesh(data)
    mesh.free()

    # 🎯 THE LOCK CENTRES TRAVEL WITH THE FILE, SO THE GATE RE-DERIVES THE CHANNEL RATHER THAN
    # TRUSTING IT. `export_extras=True` is already set for `targetNames`, so mesh custom properties
    # arrive as the primitive's `extras`. `verify_glb.mjs` reads these sixteen sites, finds the
    # nearest one to every card's own exported root, and fails the build if the emitted index
    # disagrees — the same "measure it off the file, never off the report" split every other clause
    # in that gate is built on.
    #
    # 🚩 **CONVERTED TO glTF's Y-UP HERE, BECAUSE EXTRAS ARE NOT CONVERTED BY THE EXPORTER.**
    # `export_yup=True` rotates POSITION and leaves custom properties exactly as written, so a
    # centre stored in Blender's Z-up would be compared against Y-up vertices and every card would
    # look mis-assigned. Blender (x, y, z) → glTF (x, z, −y).
    data["sugata_lock_count"] = LOCK_COUNT
    data["sugata_lock_edge_scale_m"] = edge_scale
    data["sugata_lock_centres"] = [component for lock in locks
                                   for component in (lock.position.x, lock.position.z,
                                                     -lock.position.y)]

    hair_object = bpy.data.objects.new(f"Human.{HAIR_MATERIAL_PREFIX}{style}", data)
    basemesh.users_collection[0].objects.link(hair_object)
    hair_object.matrix_world = basemesh.matrix_world.copy()

    # Hair reads as smooth strands, not as facets. Without this the card's twelve rings are twelve
    # visible bands under any moving light, which is a worse artefact than the twist it hides.
    for polygon in data.polygons:
        polygon.use_smooth = True

    return hair_object


def clamp_cards_off_the_body(hair_object, body, frame, collide=True):
    """Final repair: no hair vertex closer to the body than HAIR_CLEARANCE_M.

    The guide integrator already keeps the CURVE clear, but a card is the curve plus half a width
    either side, and a corner of a card leaning into the neck was never checked by the integrator.
    Returns (vertices moved, nearest approach after the repair, where it is).

    `collide=False` measures without repairing, which is `--no-hair-collision`: the distances are
    still reported so the red proof can quote how far INTO the skull the broken groom reaches.

    🚩 **ONE PASS DOES NOT CONVERGE, and the first version was one pass** — it left a vertex
    1.445 mm off a 3.000 mm floor and failed the build, which is the gate working. Pushing a vertex
    out along its nearest triangle's normal is only exact where the surface is locally flat. In a
    CONCAVE crease — the jaw-to-neck junction and the shoulder gutter, which is precisely where a
    falling card lands — the repaired position is closer to a neighbouring triangle than it was to
    the one that moved it. Repeating the repair walks the vertex out of the crease; the loop stops
    when nothing moves, and the caller fails the build if the floor is still violated.

    🚩 **AND REPEATING IT DOES NOT ALWAYS WORK, WHICH THE EAR PROVED.** A crease is two faces at an
    angle and walking out of it terminates; a SLIVER is two faces back to back a few millimetres
    apart, and pushing a vertex `target` off the front of the pinna puts it behind the back of the
    pinna, which pushes it back. The clamp oscillates and twenty-four passes change nothing. It is
    diagnosable from the number alone: g100 failed at exactly **−5.250 mm**, which is
    `HAIR_CLEARANCE_M · CLAMP_OVERSHOOT` with the sign flipped — the vertex was sitting exactly
    where the repair had just put it, measured against the other face, at (0.088, −0.030, 1.617),
    which is the top of the ear. Longer cards reach the ear; the shorter groom never got there.

    So a vertex the passes cannot free is walked RADIALLY OUT of the head instead. That direction
    is the one thing a fold cannot be re-entered along, it terminates by construction, and it is
    where the hair should have gone anyway — hair goes around an ear, not into it.
    """
    moved = 0
    rescued = 0
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

        for vertex in hair_object.data.vertices:
            _location, _normal, distance = signed_distance_to(body, vertex.co)
            if distance is None or distance >= HAIR_CLEARANCE_M:
                continue

            outward = vertex.co - frame.head_centre
            if outward.length < 1e-9:
                continue
            outward.normalize()

            for _step in range(RESCUE_STEPS):
                vertex.co = vertex.co + outward * target
                _location, _normal, distance = signed_distance_to(body, vertex.co)
                if distance is not None and distance >= HAIR_CLEARANCE_M:
                    break

            rescued += 1

    # The WORST vertex and where it is, not just how bad it is. A clearance failure is always one
    # place on the body — a crease the repair oscillates in — and "3.061 mm" sends the next reader
    # looking at the whole groom where "(0.071, 1.492, 0.043)" sends them to the jaw.
    nearest = None
    at = None
    for vertex in hair_object.data.vertices:
        _location, _normal, distance = signed_distance_to(body, vertex.co)
        if distance is not None and (nearest is None or distance < nearest):
            nearest = distance
            at = vertex.co.copy()

    hair_object.data.update()

    return moved, rescued, nearest, at


def signed_distance_to(body, point):
    """Nearest point on the body, its normal, and the SIGNED distance to it.

    🚩 **UNSIGNED DISTANCE IS NOT A CLEARANCE, AND THIS FILE SHIPPED A GROOM THAT PROVED IT.** The
    first version tested `find_nearest`'s raw distance against the floor, and a card that had
    travelled straight through the skull was 17 mm from the nearest surface — comfortably OUTSIDE a
    3 mm floor — so the build reported a nearest approach of 3.018 mm while 161 vertices sat inside
    the head. `verify_glb.mjs` caught it off the exported file, which is the whole argument for
    measuring the artefact rather than the script that wrote it.

    The sign is the body's own INTERPOLATED VERTEX normal at the closest point, dotted with the
    direction out to the query — `hair_geometry.mjs`'s rule exactly, and `BodySurface` records the
    g000 vertex that read +3.502 mm under the face normal and −5.267 mm under this one.
    """
    location, _face_normal, index, distance = body.tree.find_nearest(point)
    if location is None:
        return None, None, None

    normal = body.normal_at(index, location)

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


def tip_statistics_per_layer(cards):
    """Where each layer's cards END, in z. The build-side view of the cut line.

    See "the cut" above and the `cut` field on each entry of HAIR_LAYERS.

    ⚠️ **PRE-CLAMP, and that is why this is a diagnostic and not the gate.** These are the ribbon
    positions `ribbon_of` produced; `clamp_cards_off_the_body` runs afterwards and walks whatever
    landed inside the body back out, which moves some tips. The clause that FAILS a groom whose
    ends do not line up is `verify_glb.mjs`'s, measured off the exported file — the same split, and
    for the same reason, as the clearance floor above.
    """
    per_layer = {}
    for card in cards:
        left, right, _s = card["rings"][-1]
        per_layer.setdefault(card["layer"], []).append((left.z + right.z) * 0.5)

    statistics = {}
    for name, tips in per_layer.items():
        mean = sum(tips) / len(tips)
        variance = sum((tip - mean) ** 2 for tip in tips) / len(tips)
        ordered = sorted(tips)
        statistics[name] = {
            "mean": mean,
            "sd": math.sqrt(variance),
            # p10 to p90 rather than min to max: one card that snagged on a shoulder is not the
            # cut line, and the cut line is what a viewer reads along the bottom of the groom.
            "spread": ordered[int(len(ordered) * 0.9)] - ordered[int(len(ordered) * 0.1)],
        }

    return statistics


class HairReport:
    """What the groom actually came out as, and the checks that fail the build rather than ship."""

    def __init__(self, style, frame, per_layer, hair_object, clamped, nearest, maps,
                 texture_directory, collide=True, shells=0, cards=(), nearest_at=None,
                 rescued=0, edge_scale=None):
        self.edge_scale = edge_scale
        self.lock_histogram = {}
        self.lock_edges = []
        for card in cards:
            identity, edge = card["lock"]
            index = int(identity * LOCK_COUNT)
            self.lock_histogram[index] = self.lock_histogram.get(index, 0) + 1
            self.lock_edges.append(edge)

        self.collide = collide
        self.shells = shells
        self.style = style
        self.frame = frame
        self.per_layer = per_layer
        self.clamped = clamped
        self.nearest = nearest
        self.nearest_at = nearest_at
        self.rescued = rescued
        self.maps = maps
        self.texture_directory = texture_directory
        self.tips = tip_statistics_per_layer(cards)

        mesh = hair_object.data
        self.vertices = len(mesh.vertices)
        self.faces = len(mesh.polygons)
        self.triangles = sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)
        self.cards = sum(count for _name, count in per_layer)

        lows = [vertex.co.z for vertex in mesh.vertices]
        self.lowest = min(lows)
        self.highest = max(lows)

    def where(self):
        """The worst vertex's position, for a failure message that names a place."""
        if self.nearest_at is None:
            return "(nowhere — no body to measure against)"
        return "(" + ", ".join(f"{axis:.3f}" for axis in self.nearest_at) + ")"

    def describe(self, fragment_path):
        print("")
        print("=== hair (punch-list 3.6) ===")
        print(f"style           : {self.style}")
        print(f"region          : {self.frame.describe()}")
        for name, count in self.per_layer:
            tips = self.tips.get(name)
            print(f"layer           : {name:11s} {count:3d} cards"
                  + ("" if tips is None else
                     f"   tip z {tips['mean']:.4f} ± {tips['sd'] * 1000:5.1f} mm, "
                     f"spread {tips['spread'] * 1000:5.1f} mm"))
        print(f"cards           : {self.cards}")
        if self.edge_scale is not None and self.lock_edges:
            occupied = sorted(self.lock_histogram.items())
            edges = sorted(self.lock_edges)
            print(f"lock channel    : {len(occupied)} of {LOCK_COUNT} locks carry cards, "
                  f"{min(count for _i, count in occupied)}–"
                  f"{max(count for _i, count in occupied)} cards each; "
                  f"edge scale {self.edge_scale * 1000:.1f} mm, "
                  f"edge p10/p50/p90 {edges[len(edges) // 10]:.3f}/"
                  f"{edges[len(edges) // 2]:.3f}/{edges[len(edges) * 9 // 10]:.3f}")
        print(f"scalp cap       : {self.shells} shell(s) at "
              f"{', '.join(f'{offset * 1000:.1f}' for offset in CAP_SHELL_OFFSETS_M[:self.shells])}"
              f" mm{'' if self.shells else '   [--no-hair-cap: RED PROOF BUILD]'}")
        print(f"geometry        : {self.vertices:,} verts, {self.faces:,} quads, "
              f"{self.triangles:,} triangles")
        print(f"extent          : z {self.lowest:.4f} to {self.highest:.4f} "
              f"({(self.highest - self.lowest) * 1000:.1f} mm tall)")
        print(f"clearance       : {self.clamped} vertices clamped, {self.rescued} walked out "
              f"of a fold, nearest approach "
              f"{self.nearest * 1000:.3f} mm at {self.where()} "
              f"(floor {HAIR_CLEARANCE_M * 1000:.1f} mm)"
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
                f"Build failed: a hair vertex sits {self.nearest * 1000:.3f} mm from the body "
                f"at {self.where()}, "
                f"inside the {HAIR_CLEARANCE_M * 1000:.1f} mm floor. The clamp did not converge.")
        if self.cards < 100:
            raise SystemExit(f"Build failed: {self.cards} cards is not a groom. The dart throwing "
                             "in sample_roots ran out of room before it reached the target.")
