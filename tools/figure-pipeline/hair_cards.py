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

# The share of the region's depth that counts as "the front" — the band the fringe is rooted in and
# the band `ScalpFrame.forehead_z` is taken over. One constant rather than a per-layer key, because
# the cut reference and the root set have to be the SAME band or the fringe is cut to a line it was
# never grown from.
FOREHEAD_FRACTION = 0.34


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
CROWN_BIAS_POWER = 2.0

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
HAIR_LAYERS = [
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
    {"name": "fringe", "cards": 34, "standoff": 0.0185, "length": 0.070,
     "half_width": 0.0160, "strips": (1, 2), "gravity": 1.00, "jitter": 0.09,
     "front": FOREHEAD_FRACTION, "fringe": True, "cut": 0.02, "clump": 0.30,
     "tip_width": 0.45, "cut_scatter": 0.12, "graduation": 0.0},
]

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
# 16 rather than 30: a bob shows on the order of a dozen locks, and 484 cards over 16 centres is
# 30 a lock — on average 6.5 of the `root` layer's, down to 1.75 of the `flyaway` layer's, which is
# enough for a lock to read as a mass in the layers that carry one and correctly leaves the
# outermost wisps as individual hairs.
LOCK_COUNT = 16
LOCK_CROWN_BIAS = 0.80

# How the clump weight climbs from root to tip. Above 1 so the roots stay where `sample_roots` put
# them and the gathering happens down the shaft, which is where a lock forms.
CLUMP_POWER = 1.7

# How many times a blended guide is walked back out of the body. See `draw_into_lock`.
CLUMP_CLEARANCE_PASSES = 3

# 🎯 **AND THE SAME LOCK OWNS THE DEFLECTION, WHICH IS THE FRIZZ FIX.** Every card used to draw its
# own direction jitter and its own curl, so two neighbours 8 mm apart disagreed by the full jitter
# budget — measured as a direction coherence of 0.9373 (mean cosine between a card's root-to-tip
# heading and its five nearest neighbours'). Neighbouring cards whose flow disagrees is the
# definition of frizz. Most of the budget now belongs to the LOCK and is shared by every card in
# it; what is left is the per-card residue that keeps a lock from being one wide ribbon.
LOCK_DIRECTION_SHARE = 0.75

# How far forward the fringe leans as it leaves the hairline, against one unit of straight down.
# It is what stops the plane from lying on the forehead: at 0 the tangent projection at a front
# hairline root still points down the brow, and the standoff is then the only thing holding the
# cards off the face. See the `fringe` entry in HAIR_LAYERS and `root_direction`.
FRINGE_FORWARD = 0.45

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

# 🚩 **A DEAD-FLAT CUT LINE IS A WIG, AND THIS IS THE ONLY THING BETWEEN THE TWO.** The defect
# being fixed is 140 mm of scatter; the failure on the other side is 0 mm of it, which reads as a
# plastic bob straight off a shelf. A real cut is point-cut: the stylist takes the line with the
# scissors at an angle, so a LOCK sits a few millimetres off its neighbours and the hairs inside a
# lock sit a few off each other. Both are fractions of the region's height, and the lock's is the
# larger because a lock is what the eye resolves.
CUT_LOCK_JITTER = 0.035
CUT_CARD_JITTER = 0.030

# How much longer the front is than the back, as a fraction of the region's height, across the
# region's full depth. The style is "side-parted, FACE-FRAMING" — a bob that is level all the way
# round is a helmet, and the face-framing read comes from the front of the cut hanging lower.
CUT_GRADUATION = 0.09

# The shortest a cut may leave a card, as a fraction of the layer's own first guess. A root at the
# nape sits barely above the underlayer's cut plane, and without a floor its card is trimmed to a
# stub whose ribbon is a triangle.
CUT_MINIMUM_LENGTH = 0.35

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
TIP_WIDTH_FRACTION = 0.62

# Weights of the three root-direction terms, before the tangent projection. Radial dominates
# because it is the term that carries the crown; the part term is strong but local (see
# PART_FALLOFF); gravity at the root is deliberately small, because a root that already points
# down cannot lie along the skull.
RADIAL_WEIGHT = 1.00
PART_WEIGHT = 1.45
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
# flew straight out. A bend is an angle and has to be authored as one: 0.41 at the tip is a 22°
# turn per segment, and the last third of a card ends up pointing at the floor.
#
# ⚠️ **PER SEGMENT, SO IT MOVES WITH GUIDE_SEGMENTS.** The total turn is the sum over the segments,
# so raising the count from twelve to sixteen would have bent the groom a third further for free.
# 0.55 over twelve is 0.41 over sixteen for the same fall.
GRAVITY_PER_SEGMENT = 0.41
GRAVITY_POWER = 1.60

# The curl's share of the layer's jitter budget. Per segment and cumulative, so it carries the same
# GUIDE_SEGMENTS scaling the gravity bend does: 0.15 over twelve segments is 0.11 over sixteen.
CURL_SHARE_OF_JITTER = 0.11

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
ATTACH_FADE = 0.30
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
    locks = place_locks(basemesh, frame, arguments)

    cards = []
    per_layer = []
    for layer in HAIR_LAYERS:
        grown = grow_layer(basemesh, frame, body if collide else None, layer, locks, arguments)
        per_layer.append((layer["name"], len(grown)))
        cards.extend(grown)

    if not cards:
        raise SystemExit("Build failed: the groom came out with zero cards, which means the scalp "
                         "region selected nothing at this identity.")

    # 🚩 `--no-hair-cap` is the red proof for the coverage gate and nothing else. Without the
    # shells the groom is cards only, which is the state the top-down render showed bare skin in.
    shells = [] if arguments.no_hair_cap else build_scalp_cap(basemesh, frame)

    hair_object = assemble_cards(basemesh, cards, shells, style)
    clamped, rescued, nearest, nearest_at = clamp_cards_off_the_body(
        hair_object, body, frame, collide)
    weight_to_head(hair_object, rig)
    bind_to_rig(hair_object, basemesh, rig)

    texture_directory = hair_texture_directory(arguments, style)
    maps = hair_texture.write_strand_atlas(texture_directory, seed=arguments.hair_seed,
                                           colour=arguments.hair_colour)
    assign_hair_material(hair_object, style, dict((name, path) for name, path, _ in maps))

    report = HairReport(style, frame, per_layer, hair_object, clamped, nearest, maps,
                        texture_directory, collide, len(shells), cards, nearest_at, rescued)

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


def nearest_lock(locks, position):
    """The lock a root belongs to. Straight-line nearest — the scalp is convex at this scale."""
    return min(locks, key=lambda lock: (lock.position - position).length_squared)


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


def grow_layer(basemesh, frame, body, layer, locks, arguments):
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
        cards.append(ribbon_of(guide, frame, layer, strip, random))

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

    reference = frame.forehead_z if layer.get("fringe") else frame.hairline_z
    return reference - drop * frame.height


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

    return resample(guide, max(floor, arc_length_at_height(guide, cut_z)))


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

        tip_width = layer.get("tip_width", TIP_WIDTH_FRACTION)
        half = (layer["half_width"] * width_scale
                * (1.0 - (1.0 - tip_width) * s))

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
                 rescued=0):
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
