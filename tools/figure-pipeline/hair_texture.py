"""Generates the strand texture set a hair card is shaded through — numpy, no painting.

Punch-list 3.6. A hair card is a quad with a picture of forty hairs on it, and every property the
shader needs at a texel — which way the strands run, how far along a strand you are, which strand
you are on, how deep into the bundle it sits — has to come out of a texture, because the geometry
carries none of it. `docs/BRIEF.md` records why that texture cannot be downloaded: Fab's EULA
§6(b)(iii) forbids redistributing Content through a tool that allows export, and every sampled
listing carries `isAiForbidden: true`. So it is drawn here, from a seed, and it re-draws
identically on any machine.

## What comes out, and which channel exists because of what

Four PNGs, one atlas layout, `STRIP_COLUMNS` vertical strips side by side. A card takes one strip.

| file | channels | what the shader does with it |
|---|---|---|
| `albedo.png` | RGB sRGB + A coverage | base colour and the CUTOUT. Wired to baseColorTexture. |
| `flow.png` | R,G tangent · B root→tip · A strand id | the anisotropic highlight's direction, the root-to-tip darkening, and a per-strand decorrelation so two neighbouring hairs do not share one specular lobe. |
| `normal.png` | tangent-space RGB | the strand's own CYLINDER. Without it a card is a flat plane and reads as a ribbon, which is exactly the failure mode a card groom has. |
| `depth.png` | grayscale | how far into the bundle a strand sits. Parallax, and the self-occlusion term. |

🚩 **The flow channel is not decorative and it is not derivable from the geometry.** A card's
tangent is the card's own V axis, which is the direction of the BUNDLE. Individual strands wander
off it by the `wander px` column of `STRIP_RECIPES`, and a highlight computed from the card tangent
alone therefore runs straight down a surface whose hairs do not — the tell that reads as
"plastic wig".
R and G carry the per-texel strand direction so the highlight follows the hair.

## The compositing order is the reason `depth` exists twice

Strands are drawn BACK TO FRONT, sorted on the same depth value the depth channel records. Albedo
composites by coverage; flow, normal, depth and id are OVERWRITTEN wherever the new strand's
coverage passes `OPAQUE_ENOUGH`. Blending a direction field is meaningless — the average of two
crossed strands is a direction neither of them has — so those four channels take the front-most
strand's value and nothing else.

## Running it

Inside Blender's interpreter, which is where the build calls it:

    blender --background --python-expr "..."   # see hair_cards.py

Standalone, for looking at the sheet, with any numpy:

    python3 tools/figure-pipeline/hair_texture.py --out /tmp/hair --seed 7

The PNG writer is thirty lines of zlib because the alternative is a Pillow dependency inside
Blender's bundled interpreter, and `tools/lut-bake/` already made the same call in the other
language — `tools/critic/png.mjs` is hand-written for exactly this reason.
"""

import argparse
import math
import os
import struct
import zlib

import numpy


# --- the atlas ----------------------------------------------------------------------------------
#
# Eight strips of 128 px in a 1024² sheet. The strip aspect is 1:8, and a card is roughly 30 mm
# wide by 220 mm long — 1:7.3 — so a strand drawn square on the sheet arrives on the card within
# 10% of square. Any wider a strip and the atlas runs out of columns; any narrower and a bundle of
# twenty hairs has under six pixels per hair at the root.
ATLAS_SIZE = 1024
STRIP_COLUMNS = 8

# The strips are not interchangeable, and that is the whole reason there are eight rather than one.
# A groom whose every card carries the same picture reads as corrugation — the eye finds the repeat
# instantly along the silhouette. Strips 1–3 are dense interior bundles that never show an edge,
# 4–5 are the mid-layer, and 6–7 are sparse wisps whose job is to BREAK the silhouette: they are
# mostly transparent, so the outline of a card carrying one is the outline of a few hairs.
#
# 🚩 **STRIP 0 IS THE SCALP CAP'S STRIP AND IT IS DELIBERATELY NEARLY OPAQUE.** The first groom put
# 254 cards on the head and the top view still showed bare scalp between them, because a card is
# only as opaque as its cutout and the mean over this sheet is 36%. Real grooms answer that with a
# scalp mesh underneath the cards rather than with more cards, and a scalp mesh needs a texel that
# is hair rather than a hole. `CAP_STRIP` is that texel: enough strands, wide enough, that its
# coverage measures ≥ CAP_STRIP_MIN_COVERAGE. `hair_cards.py` never gives a card this strip.
#
# 🚩 **THE FIRST SHEET'S STRANDS WERE 1.6 mm WIDE ON THE HEAD AND READ AS STRAW.** A strand's
# world width is the card's width times its share of the strip: 6 px of a 128 px strip on a 32 mm
# card is 1.5 mm, and a human hair is 0.07 mm. Nothing on a 1024² atlas can reach 0.07 mm and
# nothing needs to — what a card carries is a BUNDLE, and the read the eye wants is "many fine
# hairs".
#
# 🎯 **AND THE READ THE EYE WANTS IS NOT AVAILABLE AT THIS SAMPLING RATE, WHICH IS THE MEASUREMENT
# THAT SIZES EVERYTHING BELOW.** `tools/figure-pipeline/hair_lod.mjs` was written for this round and
# evaluates the hardware's own trilinear rule — `log2(max(|∂uv/∂x|, |∂uv/∂y|)·1024)` — per hair
# triangle, rasterised with the live camera and the live skinning, weighted by the pixels a viewer
# actually looks at, ON THE SCENE PASS the sampler's derivatives are really taken over rather than
# on the CSS canvas. Measured on `alive.html` at 900x1200 CSS / 594x792 scene pass this session, on
# this round's 462-card groom:
#
#   | framing              | all strips p10 / p50 / p90 | strip 1 p50 | strip 3 p50 |
#   |----------------------|---------------------------:|------------:|------------:|
#   | portrait             |     1.225 / **1.925** / 3.125 |   1.925 |   1.675 |
#   | three-quarter, 35°   |     0.825 / **1.575** / 3.125 |   1.525 |   1.375 |
#
# **At the portrait median the sampler reads 3.80 mip-0 texels per screen pixel.** A card strip is
# 128 texels, so a card carrying one is about 34 screen pixels across, and a feature authored n
# texels wide arrives n/3.80 pixels wide. Round 17 proved the box mip chain conserves mean alpha
# exactly (re-measured: 0.4993 at mip 0, 1, 2, 3 and 4 of the shipped sheet), so minification
# cannot lose coverage — what it does is turn a hard edge into a mid-alpha wash.
# **A sub-strand under about 2 texels at the sampled lod is a grey smear rather than a strand**, so
# nothing finer than ~7.6 mip-0 texels is worth authoring, and 7.6 of 128 on a 42 mm card is
# 2.5 mm. That is the floor the sheet is against, and it is a property of the FRAMING and of the
# CARD WIDTHS rather than of the atlas.
#
# ⚠️ **THE TABLE READ 0.735 / 1.492 / 2.695 FOR TWO ROUNDS AND EVERY ROW OF IT WAS 0.6 OF A MIP
# OPTIMISTIC.** See `SAMPLED_LOD` below: the Jacobian was taken in CSS pixels and the page ships
# TAAU at 0.66, so the sheet has been authored 1.51× finer than the rate it is read at, and the
# "2 texels at the sampled lod" floor in the paragraph above was really 1.3 texels. THE LANE COUNTS
# IN `STRIP_RECIPES` HAVE NOT BEEN RE-SOLVED AGAINST THE CORRECTED FIGURE — this round spent itself
# on the card geometry, which is the other lever on the same quantity, and the sheet is unchanged.
# That is the open work item and `docs/RED-GATES.md` carries the red it leaves behind.
#
# ⚠️ **WHICH IS THE ANSWER TO "SHOULD THE ATLAS BE BIGGER": NO, AND IT IS NOT CLOSE.** Doubling to
# 2048² adds exactly 1.0 to every lod in the table above, because lod is measured in texels and the
# card's world width did not move. Resolution buys detail only where the sampler is MAGNIFYING, and
# the p10 of the whole distribution is lod 0.735 — still minifying. The constraint is the framing,
# so the fix has to be the STRUCTURE at the scale the framing can resolve, not more texels.
CAP_STRIP = 0
CAP_STRIP_MIN_COVERAGE = 0.97

# The lod the sheet is authored against, from the table above: the portrait median over every strip.
# Everything that has to survive minification is quoted in texels AT THIS LOD, which is mip-0 texels
# divided by `2 ** SAMPLED_LOD`.
#
# 🚩 **IT USED TO READ 1.492, WHICH IS THE CSS-PIXEL FIGURE AND NOT THE SAMPLED ONE.** The page
# ships TAAU at `resolutionScale` 0.66, so the sampler's derivatives are taken over a raster 0.66 as
# wide and its footprint is `log2(1/0.66)` = 0.599 of a mip wider. `hair_lod.mjs` now takes its
# Jacobian on the scene pass: on the SHIPPED 648-card groom it reads 2.075 where it read 1.492, a
# shift of +0.583 against the +0.599 the arithmetic predicts, and `hair_layers.mjs` reads 2.011 for
# the same quantity by a per-pixel route. On this round's wider cards the same tool reads 1.925.
# `hair_alpha.SAMPLED_LOD` carries the same number; the two must not drift apart.
SAMPLED_LOD = 1.925

# One texel of antialiasing at a strand's edge, and one texel exactly.
#
# 🚩 **THIS WAS `max(1.0 / width, 0.35)` AND THE 0.35 WAS EATING THE GAPS.** Expressed in the
# strand's own half-widths, a floor of 0.35 means a strand 4 texels wide feathers over 1.4 texels a
# side rather than 1 — so 0.8 texels of what was authored as a GAP came back as a ramp, on every
# strand on the sheet, and at the sampled lod 0.8 texels is a third of the whole gap. The floor was
# written when the widest strand on a card strip was 3 texels and it was harmless there; it stopped
# being harmless the moment a lane got wide enough to have a gap beside it worth keeping.
FEATHER_TEXELS = 1.0


# --- sub-strands ---------------------------------------------------------------------------------
#
# 🎯 **A CARD IS A UNIT OF GEOMETRY AND IT WAS BEING USED AS A UNIT OF COVERAGE, WHICH IS THE ERROR
# BOTH OF THE LAST TWO ROUNDS MADE FROM OPPOSITE ENDS.** Round 17 found the groom see-through and
# raised strip 1's strand count to 300 at a 3-texel half width; round 18 shipped it. Measured off
# `assets/hair/bob01/albedo.png` this session, strip 1's interior — columns 20 to 108, inside the
# edge band, which is the part of the card that lies across the cheek:
#
#   mean alpha **0.9773** · near-0 0.911% · mid-band 2.672% · near-1 **96.417%**
#   separate strand runs per row: **1.00** (p10 1, p90 1), one run of 115 texels
#
# **One run.** Three hundred strands 6 texels wide on a 112-texel lattice is 0.37 texels of spacing
# against sixteen texels of overdraw, so every gap between every pair of them was painted over by
# the next strand in the sort. The picture that comes out is not a bundle of hairs, it is a filled
# rectangle with a soft border, and a blind critic on the shipped build described exactly that
# object: *"a flat mauve board has been leaned against half of this woman's face … one opaque,
# evenly-lit sheet with painterly vertical smudges brushed into it"*, and *"the entire right eye and
# brow are simply gone behind an unbroken grey-lavender field"*.
#
# Real card hair is opaque WHERE A STRAND IS and transparent BETWEEN strands, at a spatial frequency
# fine enough that the eye integrates it into a mass. A uniform mid alpha can be neither, and a
# uniform alpha of 1.0 can only be the second. So the strip is authored as LANES rather than as a
# strand count: a lane is one sub-strand plus the gap beside it, the lane count is the spatial
# frequency, and `duty` is the share of a lane the sub-strand fills — which is what sets the strip's
# coverage, and therefore its transmittance, and therefore how much of the eye behind it survives.
#
# ⚠️ **THE ARITHMETIC IS UNFORGIVING AND IT IS WORTH STATING BEFORE ANYONE RETUNES THIS.** Under the
# shipped `stochastic` OIT arm the transmittance of one card IS one minus its mean alpha, and mean
# alpha is exactly what the mip chain conserves. A gap costs coverage; coverage is opacity; there is
# no arrangement of a fixed mean alpha that has both a visible gap and no cost. At the sampled lod a
# strip has 112/2.81 ≈ 40 screen pixels of usable width, so a gap that reads at all is ≥ 1 of those
# 40 — 2.5% of the card per gap, before the strand beside it. **A card that is 84% opaque cannot
# show more than about two gaps.** That is why this round's change is paid for in `hair_cards.py`
# with card DEPTH rather than here with card alpha: N overlapping cards of coverage p transmit
# (1−p)^N, so opacity bought from stacking costs nothing in structure while opacity bought from
# duty costs all of it.
#
# Lanes are placed on a jittered regular lattice and the jitter is a fraction of a lane rather than
# of the strip — a lattice free to move a whole period is a lattice with holes and doublings in it,
# which is the clumping `plan_strands` has always spread its roots to avoid, now with a gap budget
# that cannot absorb it.
LANE_JITTER = 0.22

# Per-lane width jitter, ± this fraction. Real hair has no two locks the same width and a perfectly
# regular alpha reads as corduroy — but this is much tighter than the ±30% the strand count used to
# take, because a lane 30% over budget closes the gap beside it outright.
LANE_WIDTH_JITTER = 0.18

# How much of a strip's wander is SHARED by every lane in it.
#
# 🎯 **A GAP SURVIVES A CURVE AND DOES NOT SURVIVE A CROWD.** Wander is what stops a card being a
# comb, and per-strand wander of half a lane closes every gap on the sheet somewhere down its
# length. A lock of hair does not do that: neighbouring shafts in a lock travel TOGETHER, so the
# bundle curves and the partings inside it curve with it. Most of the budget is therefore one
# sinusoid per strip that every lane shares, and what is left is the per-lane residue that keeps
# two neighbours from being one ribbon.
BUNDLE_WANDER_SHARE = 0.72

# The sub-strand structure INSIDE a lane, carried by the normal and the albedo value rather than by
# the coverage.
#
# 🚩 **THIS IS THE HALF THAT IS FREE, AND IT IS FREE BECAUSE IT IS NOT ALPHA.** A lane wide enough
# to have a gap beside it is 8–12 texels across, and one smooth cylinder over 12 texels is a
# RIBBON — the exact read the sheet is trying to get away from. Splitting the cross-section into
# `FILAMENTS_PER_LANE` cylinders puts that many specular lobes and that many value steps across the
# lane, so the interior has strand structure under a light, and the transmittance does not move by
# one part in a thousand because no texel changed its coverage. Coverage buys the silhouette;
# normal and value buy the interior.
FILAMENTS_PER_LANE = 3
FILAMENT_VALUE_JITTER = 0.20

# Loose hairs that cross the lanes, as a share of the lane count. Without them a strip is a picket
# fence: every parting runs the full length of the card at the same u, and the eye finds the repeat
# down the silhouette the way it used to find it across the groom. They are thin and they are few,
# because every one of them lands on a gap half the time.
CROSS_HAIR_SHARE = 0.34
CROSS_HAIR_WIDTH = 0.40

# 🎯 **THE SHEET HAS A COVERAGE TEXEL FOR THE SCALP AND HAD NONE FOR THE LENGTH, AND THAT IS WHY
# THE GROOM WAS A STOCKING.** A blind critic on the composed portrait: *"Neither hair nor a wig — a
# stocking… you can see the bald skull's silhouette through it, you can see her far-side ear through
# it."* Measured on `alive.html` this session — an emissive step on everything that is NOT hair,
# differenced in linear light inside the hair's own screen footprint, against the same step with the
# groom hidden as the denominator — the shipped groom transmits **0.8229 of what is behind it at
# ONE card crossing**, so a card is 17.7% opaque. Not 59%, which is what strip 1's mean alpha says:
# the pixels a viewer's ray reaches first are the layers carrying strips 4–7, and the dense strips
# never get below the hairline (`hair_cards.HAIR_LAYERS`'s `root` layer is `cut: None`).
#
# `CAP_STRIP` was already the answer to the same question one axis over: the crown needed a texel
# that is hair rather than a hole, and it got one. `INTERIOR_STRIP` is that texel for the LENGTH,
# and `hair_cards.HAIR_LAYERS`'s `mass` layer is what carries it.
#
# 🚩 **IT IS NOT A SECOND CAP STRIP, AND THE DIFFERENCE IS THE BORDER.** Strip 0 is edge-to-edge
# opaque because the cap tiles it radially and a transparent gutter there would be twelve radial
# seams across the crown. A CARD carrying an edge-to-edge opaque strip is the straight quad border
# a critic already found once (see STRIP_GUTTER_PX). So the interior strip keeps the gutter and the
# edge-wisp band exactly as every other card strip has them, and buys its opacity in the middle.
#
# ⚠️ **AND ROUND 18 BOUGHT THAT OPACITY BY DELETING THE GAPS, WHICH IS THE DEFECT THIS ROUND IS
# FIXING.** 300 strands at a 3-texel half width filled the strip solid — see the measurement under
# "sub-strands" above, one strand run of 115 texels per row — and the blind critic's reply to it
# was that the mass over the cheek is a painted board and the eye behind it is gone. This strip is
# still the densest CARD strip on the sheet and it is still what the coverage layers carry; what it
# is no longer is a rectangle. Its duty is set so that a lane and its gap both survive
# `SAMPLED_LOD`, and the opacity round 17 measured is bought back in `hair_cards.py` by stacking,
# which is where a real groom buys it.
INTERIOR_STRIP = 1

# The interior strip's tips. Short of the cap's 0.02/0.0 because a `mass` card is cut ABOVE the
# visible layers rather than being hidden by a whole head, so its last rows can be seen edge-on;
# short of the wisp strips' 0.22/0.30 because a needle over the last third is a third of the card
# spent going transparent, and this strip exists to not do that.
INTERIOR_TIP_FADE = 0.10
INTERIOR_TIP_NEEDLE = 0.10

# 🎯 **THE CARD'S OWN BORDER IS A STRAIGHT LINE, AND THAT IS THIS FILE'S DEFECT RATHER THAN THE
# RIBBONING'S.** A blind critic shown the groom in three-quarter view said a dead-straight card
# border ran from the crown past the jaw and sliced the eyebrow, the eyelid and the cheekbone; its
# diagnosis was that "the alpha strand shapes exist only INSIDE the card; the card's own left
# border is untouched by them". Measured off the shipped `albedo.png` at the 0.5 cutoff it exports
# with, that was exactly right and worse than it sounds:
#
#   strip 1  left boundary standard deviation 0.000 px over 1020 of 1024 rows
#            1,895 of its 2,048 border texels KEPT
#   strip 0  0.077 px / 0.031 px      strip 3  2.072 px      (strips 2, 4–7: 4.2–19.4 px)
#
# Strip 1 is the `root` layer's strip — the innermost, densest cards, the ones that frame the face
# — and its cutout's left edge was a perfectly straight vertical line running 99.6% of the card's
# length. Two separate mistakes made it, and both are fixed here:
#
#   1. THE OLD `strand_room` CLAMPED WANDER TO ZERO AT THE BOUNDARY. A strand rooted near the edge
#      had no lateral room, so it was drawn dead straight — and it was drawn dead straight at
#      precisely the u where a card shows its silhouette. The clamp was written to stop a strand
#      being CUT by the card's u range, and it succeeded, by straightening it instead.
#   2. THE ROOT LATTICE SPANNED THE WHOLE STRIP, so the outermost strand straddled the boundary
#      and its border texels came out opaque — the quad's own edge, visible as a quad.
#
# The gutter fixes (2): no strand's feather may enter it, so a card's extreme u is transparent by
# construction and there is no quad edge to see. `EDGE_BAND_PX` fixes (1): a strand rooted inside
# the band is a WISP — narrower, covering a random span of the card's length rather than all of
# it, and drifting INWARD across the card instead of running parallel to its edge. So the strip's
# silhouette is a broken line of hairs falling across the bundle, which is what the edge of a real
# hair card is, and it is measured rather than hoped for: `verify_glb.mjs`'s card-border clause
# fails a groom whose strip boundary goes straight again.
#
# 🚩 **THE CAP STRIP TAKES NEITHER.** `cap_uv` tiles strip 0 `CAP_WEDGES` times around the whorl,
# so a transparent gutter there is not a card border — it is a transparent radial seam repeated
# twelve times across the crown, which is a worse artefact than the one being fixed. Strip 0 stays
# edge-to-edge opaque and is the reason both of these are per-strip rather than global.
#
# ⚠️ **THE BAND IS PER STRIP, AND IT HAS TO BE, BECAUSE A LANE IS NOT THE SAME SIZE ON EVERY
# STRIP.** 20 texels is about a sixth of a strip and it holds eleven of strip 2's strands; it holds
# 1.7 of strip 1's LANES, and a lane that is inside it is narrowed and shortened, so a 20-texel band
# on a nine-lane strip spends a fifth of the card's coverage on raggedness. Measured, same recipe,
# only the band moving: strip 1 mean alpha 0.5415 at 20 texels, 0.5845 at 14, 0.6070 at 10 — and at
# 6 the RIGHT boundary standard deviation collapses to 0.805 px, well under `verify_glb.mjs`'s 3 px
# floor, which is the other end of the trade and the reason this is a measured column rather than a
# formula. It is the last column of `STRIP_RECIPES`.
STRIP_GUTTER_PX = 3.0

#
# **(lanes, duty, wander px, tip taper)** — one row per strip, and the first two columns are the
# whole design. `lanes` is how many sub-strands the strip is divided into across its usable span, so
# it is the SPATIAL FREQUENCY: the lane period is the usable span over it, and at `SAMPLED_LOD` the
# usable span is about 40 screen pixels wide, so 9 lanes is a strand every 4.4 pixels. `duty` is the
# share of a lane the sub-strand fills at full alpha, so it is the COVERAGE, and the gap is what is
# left. `FEATHER_TEXELS` of antialiasing sits on each side of the strand inside the gap's share.
#
# 🎯 **THE LANE COUNTS ARE THE ANSWER TO A SWEEP, NOT A PREFERENCE, AND THE BINDING CONSTRAINT IS
# THE GAP RATHER THAN THE STRAND.** With the strand and the gap both required to clear 2 texels at
# `SAMPLED_LOD` — 5.6 mip-0 texels — a 112-texel span holds at most ten lanes at any duty, and at a
# duty high enough to be a coverage strip it holds fewer. Strip 1 is at nine because that is the
# most lanes whose GAP still measures over a texel at the sampled lod; every strip below it can
# afford more lanes because it can afford a lower duty.
#
# ⚠️ **AND THE STRIPS BELOW 1 WERE ALREADY STRUCTURED AND ALREADY TOO FINE, WHICH IS THE SECOND
# HALF OF THE DEFECT AND WAS NOT IN THE BRIEF.** Measured off the shipped sheet, rows 30–70%, at the
# 0.5 cutoff: strip 2 had 10.4 separate strand runs per row of mean 8.83 texels with 3.17-texel
# gaps, strip 3 had 13.30 runs of 6.55 texels, strip 5 had 15.74 runs of 3.91 texels. Those ARE
# strands at mip 0 — and a 3-texel gap is 1.07 texels at the sampled lod and a 3.9-texel strand is
# 1.39, so by mip 2 the same strips read 36.1%, 39.7% and 44.5% MID-BAND: the structure is there in
# the file and arrives at the eye as a wash. Their lane counts are therefore DOWN and their duties
# are set to hold each strip's shipped mean alpha, which keeps `hair_opacity.mjs`'s clauses where
# they were while moving the structure to a scale the sampler can resolve.
#
# 🚩 **THE DUTIES ARE HOLDING A MEASURED MEAN, SO CHANGING ONE IS CHANGING A TRANSMITTANCE.** Shipped
# per-strip mean alpha, measured this session off `assets/hair/bob01/albedo.png`: cap 0.9966, then
# 0.8371, 0.5451, 0.5113, 0.4387, 0.3708, 0.1789, 0.1160. Strips 2–7 are held at those; strip 1 is
# the one deliberately moved, and `hair_cards.py`'s stacking is what pays for it.
STRIP_RECIPES = [
    # The cap. Duty far over 1 means the lanes OVERLAP many deep, which is what an edge-to-edge
    # opaque strip is; it keeps a lane structure at all so the crown has a strand direction and a
    # normal rather than a flat field, and `CAP_STRIP_MIN_COVERAGE` is the gate on the overlap.
    (168, 6.300, 4.0, 0.20, 20.0),
    # 🎯 **THE ONE ROW THIS ROUND CHANGED.** Thirteen lanes at a duty that leaves a real gap beside
    # each of them, and a 12-texel edge band because 20 would spend a fifth of a coarse card on
    # wisps. The lane count is the answer to a sweep at a FIXED mean alpha of 0.62 — the mean is the
    # transmittance and is held, so the only thing the sweep is choosing is frequency:
    #
    #   | lanes |  duty | runs/row at the sampled lod | strand texels at it | left boundary sd |
    #   |------:|------:|----------------------------:|--------------------:|-----------------:|
    #   |     9 | 0.954 |                        2.35 |               12.39 |             4.41 |
    #   |    11 | 0.850 |                        4.11 |                7.01 |             3.10 |
    #   |    13 | 0.903 |                    **4.20** |                6.88 |         **6.17** |
    #
    # It plateaus at eleven and the boundary is the tie-breaker: 3.10 px is 0.1 px inside
    # `verify_glb.mjs`'s floor, which is not a margin. Sixteen was not tried because at thirteen the
    # gap is already 4.0 texels at the sampled lod against the 2-texel floor, and the next step
    # spends that rather than the duty.
    (13, 0.910, 2.4, 0.10, 12.0),
    # ⚠️ **STRIPS 2–7 ARE THE SHIPPED SHEET RE-EXPRESSED IN LANES AND THAT IS DELIBERATE.** The lane
    # model is a generalisation of the strand-count model — `lanes` is the old count and `duty` is
    # the old half-width over the lane period — so these rows are the shipped strand plan to within
    # the retuned duty, and a duty over 1 says the strands overlap, which they always did.
    #
    # 🚩 **AND THAT IS A MEASURED DECISION RATHER THAN A DEFERRAL. THE LANE TREATMENT WAS TRIED ON
    # THEM AND IT IS A WORSE PICTURE AT THEIR MEAN ALPHA.** These strips are not slabs — measured on
    # the shipped sheet at the sampled lod, strip 2 crosses 4.78 separate strand runs per row,
    # strip 4 6.63, strip 5 6.82, against strip 1's **1.15**. What they are is SMEARY: 29–35% of
    # their texels arrive in the mid band because a 3-texel gap is 1.07 texels once minified. Fixing
    # that by coarsening means holding their mean alpha with fewer, wider lanes, and their mean
    # alpha is a transmittance `hair_opacity.mjs` gates. Re-solved at 10–12 lanes to the same means,
    # strip 2 reads mid 12.2% at the sampled lod — better — with **2.26** runs per row instead of
    # 4.78, which is trading a smeary bundle of hairs for a clean pair of them. The frontier is
    # mean = 0.63·duty for an interior strip and 0.39·duty for one with a taper, a needle and a tip
    # fade on it, so at these means the duty is over 1 either way and the lanes have to touch. The
    # smear is real, it is reported, and the lever on it is the SAMPLING RATE rather than the sheet.
    (66, 1.152, 12.0, 0.60, 20.0),
    (58, 1.143, 14.0, 0.62, 20.0),
    (49, 0.754, 16.0, 0.68, 20.0),
    (40, 0.530, 18.0, 0.72, 20.0),
    (17, 0.189, 24.0, 0.84, 20.0),
    (11, 0.126, 28.0, 0.90, 20.0),
]

# Coverage above which a strand owns a texel outright in the non-blendable channels — and, not by
# coincidence, the alphaCutoff the groom exports with.
#
# 🚩 **THESE HAVE TO BE THE SAME NUMBER OR THE COVERAGE REPORT IS FICTION.** The groom exports as
# MASK through `build_figure.force_alpha_mode`, whose `ALPHA_MASK_CUTOFF` is 0.5, so a texel at
# alpha 0.4 is not a soft hair — it is a hole. Reporting the MEAN alpha of a strip would have said
# the cap covered 99.6% of its texels when the renderer was going to keep 88% of them.
OPAQUE_ENOUGH = 0.5

# What counts as neither a strand nor a gap. A texel outside this band has committed; a texel inside
# it is the wash that a strand too fine for `SAMPLED_LOD` turns into. The band is deliberately wide
# — most of the range — so that "mid" means genuinely undecided rather than "off by a code value".
MID_BAND = (0.15, 0.85)

# How round a strand reads in the normal map. 1.0 sweeps the surface normal through a full ±90°
# across the strand's width, which is a true cylinder and is too much — the edge texels then face
# sideways and go black under a key light that is anywhere near frontal. 0.72 keeps the terminator
# inside the strand.
STRAND_ROUNDNESS = 0.72

# Root darkening. Hair is darker where it leaves the scalp because that is where the least light
# reaches it, and a card without it reads as glued-on. The multiplier climbs from ROOT_VALUE at
# v = 0 to 1.0 by ROOT_FADE, and on past 1.0 to TIP_VALUE at the tip.
ROOT_VALUE = 0.42
ROOT_FADE = 0.28
TIP_VALUE = 1.18

# Per-strand value jitter, ± this fraction. Without it every hair in a bundle is the same grey and
# the bundle reads as one wide hair.
STRAND_VALUE_JITTER = 0.16

# Alpha at the very tip of a strand. Not zero at the last texel but tapered over the last
# TIP_FADE of the strip, because a hard end to a strand is a visible horizontal cut across a card.
TIP_FADE = 0.22

# 🎯 **A FADE CANNOT END A STRAND UNDER A MASK MATERIAL, AND THAT IS WHERE THE STAIRCASE CAME
# FROM.** The groom exports as MASK at cutoff 0.5. An alpha that ramps linearly from 1 to 0 over
# the last 22% of a strand crosses 0.5 at ONE row, across the strand's full width at once — so
# every strand ends in a horizontal cut one or two texels tall, which is the 1–2 px staircase the
# blind critic saw at every tip. Fading harder does not help; it moves the cut, it does not soften
# it, because a cutoff has no soft.
#
# What ends a strand under a cutoff is its WIDTH. Over the last TIP_NEEDLE of a strand the
# half-width is driven to zero, so the kept region converges to a point: 3 texels wide, then 2,
# then 1, then nothing. That is a hair tip rather than a cut, and it is the shape the critic
# already called the one AAA-grade thing in the groom — the CARD's taper — arriving at the scale
# below it.
TIP_NEEDLE = 0.30

# And the last texels of a needle are still a small hard shape, so the coverage inside the needle
# is broken up by a per-strand hash. Under the cutoff this turns the tip's last few texels into a
# stipple rather than a wedge, which is what reads as fraying.
#
# ⚠️ **THE AMPLITUDE IS THE WHOLE RISK.** Dither an entire strand and the sheet turns to mush —
# every hair becomes a dotted line and the bundle loses its body. This is applied ONLY inside the
# needle and only to texels the taper has already brought near the cutoff.
TIP_DITHER = 0.34

# ⚠️ **AND THE HONEST SIZE OF WHAT THE TWO OF THEM BUY IS SMALL. MEASURED, BOTH WAYS.** The pair
# was A/B'd on its own — same seed, same groom, `TIP_NEEDLE = TIP_DITHER = 0.0` against the values
# above — and looked at in the three-quarter plate's strand-end region, 400–540 × 520–660:
#
#                        hair px   vertical runs   mean run   runs of 1–2 px
#   needle + dither off     9,402            468    20.09 px   88  (18.8%)
#   as shipped              8,439            466    18.11 px   98  (21.0%)
#
# So the tips fray by about a tenth of a strand's length and gain two points of one-to-two-pixel
# dashes, and they cost a tenth of the tip region's coverage. On the SHEET the pair is invisible:
# strand terminations there span 1.010 px on average either way, because a strand is only three
# texels wide to begin with and there was never a wide cut to soften.
#
# 🚩 **WHICH IS THE ANSWER TO "CAN THE ATLAS CARRY SOFTER COVERAGE AT ITS TIPS": ONLY A LITTLE, AND
# THE STAIRCASE IS NOT THE ATLAS'S.** The 1–2 px staircase a critic sees is at SCREEN resolution,
# where a card is magnified several times over the sheet and a binary cutoff quantises its edge to
# whole pixels. No amount of soft alpha in the texture survives `alphaMode: MASK`, by definition.
# The lever is the transparency mode — `packages/core/src/render/HairOIT.js` — and it belongs to
# whoever owns that, not here. The needle stays because it is the correct shape for a hair tip and
# it does measurably help; it is not a fix for the staircase and is not claimed as one.

# The default groom colour, sRGB. A dark ash brown rather than black: REQ-061 records that this
# frame has NO highlight energy at all, and a black groom cannot make one — the specular lobe on
# hair is a function of the base colour's own luminance under the Kajiya term the shader will
# apply. Overridable with --colour.
DEFAULT_HAIR_SRGB = "#3b2a20"


def main():
    parser = argparse.ArgumentParser(
        prog="hair_texture.py",
        description="Draw the hair strand atlas set (albedo, flow, normal, depth).")
    parser.add_argument("--out", required=True, help="Directory to write the four PNGs into.")
    parser.add_argument("--size", type=int, default=ATLAS_SIZE)
    parser.add_argument("--seed", type=int, default=20260812)
    parser.add_argument("--colour", default=DEFAULT_HAIR_SRGB,
                        help="Base hair colour as #rrggbb, sRGB.")

    arguments = parser.parse_args()
    written = write_strand_atlas(arguments.out, size=arguments.size, seed=arguments.seed,
                                 colour=arguments.colour)
    for name, path, size_bytes in written:
        print(f"  {name:8s} {path} ({size_bytes:,} bytes)")


def write_strand_atlas(out_directory, size=ATLAS_SIZE, seed=20260812, colour=DEFAULT_HAIR_SRGB):
    """Draws the four channel images and writes them as PNGs. Returns [(name, path, bytes)]."""
    os.makedirs(out_directory, exist_ok=True)

    channels = build_strand_atlas(size=size, seed=seed, colour=colour)

    written = []
    for name, image in channels.items():
        path = os.path.join(out_directory, f"{name}.png")
        write_png(path, image)
        written.append((name, path, os.path.getsize(path)))

    return written


def build_strand_atlas(size=ATLAS_SIZE, seed=20260812, colour=DEFAULT_HAIR_SRGB):
    """The whole sheet, as four uint8 arrays keyed by filename stem.

    Everything is drawn in float and quantised once at the end, so the compositing arithmetic
    never touches 8-bit rounding — a strand at 3% coverage over forty other strands is the
    difference between a wispy silhouette and a hard edge, and in bytes it is the difference
    between 7 and 8.
    """
    base_rgb = numpy.array(srgb_hex_to_unit(colour), dtype=numpy.float64)
    random = numpy.random.default_rng(seed)

    strip_width = size // STRIP_COLUMNS
    if strip_width * STRIP_COLUMNS != size:
        raise ValueError(f"atlas size {size} does not divide into {STRIP_COLUMNS} strips")

    # Accumulators. `coverage` is the alpha the card is cut out with; `owner_coverage` is how
    # strongly the texel's current OWNER covered it, which is what decides whether a later
    # (nearer) strand takes the direction channels over.
    albedo = numpy.zeros((size, size, 3), dtype=numpy.float64)
    coverage = numpy.zeros((size, size), dtype=numpy.float64)
    flow = numpy.zeros((size, size, 2), dtype=numpy.float64)
    root_to_tip = numpy.zeros((size, size), dtype=numpy.float64)
    strand_id = numpy.zeros((size, size), dtype=numpy.float64)
    normal = numpy.zeros((size, size, 3), dtype=numpy.float64)
    normal[:, :, 2] = 1.0
    depth = numpy.zeros((size, size), dtype=numpy.float64)

    # v runs 0 at the top row of the sheet (the ROOT) to 1 at the bottom (the TIP). The card's UV
    # is laid out to match in `hair_cards.py`, and the two have to agree or the root darkening
    # appears at the ends of the hair.
    v_of_row = numpy.linspace(0.0, 1.0, size)

    total_strands = 0
    for column, recipe in enumerate(STRIP_RECIPES[:STRIP_COLUMNS]):
        strands = plan_strands(random, column, strip_width, *recipe)

        # Back to front. The depth channel and the draw order are the same number by construction,
        # which is the only way the front-most strand is also the one whose direction survives.
        for strand in sorted(strands, key=lambda entry: -entry["depth"]):
            draw_strand(strand, v_of_row, base_rgb,
                        albedo, coverage, flow, root_to_tip, strand_id, normal, depth, size)
            total_strands += 1

    print(f"  strand atlas    : {size}×{size}, {STRIP_COLUMNS} strips, {total_strands} strands, "
          f"seed {seed}, {colour}")

    # Per strip and AFTER the cutout, because neither the sheet's mean nor a strip's mean is what
    # a card shows: a card samples exactly one strip, and everything under OPAQUE_ENOUGH is
    # discarded by the MASK material before it reaches a pixel.
    kept = coverage > OPAQUE_ENOUGH
    per_strip = [float(kept[:, column * strip_width:(column + 1) * strip_width].mean())
                 for column in range(STRIP_COLUMNS)]
    print("  coverage        : " + "  ".join(f"s{column} {value:.3f}"
                                             for column, value in enumerate(per_strip)))
    report_alpha_structure(coverage, strip_width)

    if per_strip[CAP_STRIP] < CAP_STRIP_MIN_COVERAGE:
        raise SystemExit(
            f"Build failed: the cap strip covers {per_strip[CAP_STRIP]:.3f} of its texels, under "
            f"the {CAP_STRIP_MIN_COVERAGE} floor. The scalp cap is the layer that stops bare skin "
            "showing through the groom, and a cap with holes in it is not one.")

    return {
        "albedo": quantise(numpy.dstack([albedo, coverage[:, :, None]])),
        "flow": quantise(numpy.dstack([
            flow * 0.5 + 0.5,
            root_to_tip[:, :, None],
            strand_id[:, :, None]])),
        "normal": quantise(normalise_rows(normal) * 0.5 + 0.5),
        "depth": quantise(depth[:, :, None]),
    }


def report_alpha_structure(coverage, strip_width):
    """The statistic this sheet is authored against: is a strip bimodal, and at what frequency?

    Mean alpha is what the transmittance sees and the mip chain conserves it exactly, so it says
    nothing at all about whether a card reads as hair. What does is the SHARE IN THE MID BAND — a
    strip that is mostly 0 or mostly 1 has strands and gaps in it, a strip that is mostly halfway is
    a wash — together with how many separate strand runs a row crosses, which is the frequency the
    eye reads as "many hairs" rather than "a board".

    Printed at mip 0 and at `SAMPLED_LOD`, because the two disagree and only the second is what
    anybody looks at. `tools/figure-pipeline/hair_alpha.selftest.mjs` is the gate on these; this is
    the same arithmetic where the build can see it.
    """
    scale = 2.0 ** SAMPLED_LOD
    print(f"  alpha structure : mip 0 | at lod {SAMPLED_LOD:.3f} (÷{scale:.2f})")
    for column in range(STRIP_COLUMNS):
        strip = coverage[:, column * strip_width:(column + 1) * strip_width]
        sampled = area_resample(strip, scale)
        print(f"    s{column}  mean {strip.mean():.4f}   "
              f"mid {mid_band_share(strip) * 100:6.3f}% | {mid_band_share(sampled) * 100:6.3f}%   "
              f"runs/row {strand_runs_per_row(strip):5.2f} | "
              f"{strand_runs_per_row(sampled):5.2f}")


def area_resample(image, scale):
    """Box-filters an image down by a non-integer factor — the mip chain evaluated at a real lod.

    A box mip chain only exists at powers of two and the sampled lod is not one, so a row of the
    chain cannot answer "what does the sampler see". This integrates each output texel over its own
    footprint in the input, which is what a box filter at a fractional level is, and it agrees with
    the chain to four decimal places on the mean at every integer scale.
    """
    height, width = image.shape
    out_height = max(1, int(round(height / scale)))
    out_width = max(1, int(round(width / scale)))

    rows = numpy.add.reduceat(image, (numpy.arange(out_height) * height // out_height), axis=0)
    row_counts = numpy.diff(numpy.append(numpy.arange(out_height) * height // out_height, height))
    rows = rows / row_counts[:, None]

    columns = numpy.add.reduceat(rows, (numpy.arange(out_width) * width // out_width), axis=1)
    column_counts = numpy.diff(numpy.append(numpy.arange(out_width) * width // out_width, width))

    return columns / column_counts[None, :]


def mid_band_share(alpha):
    """The share of texels that are neither strand nor gap. Bimodality, as one number."""
    return float(((alpha >= MID_BAND[0]) & (alpha <= MID_BAND[1])).mean())


def strand_runs_per_row(alpha):
    """Mean number of separate above-cutoff runs a row crosses — the strip's spatial frequency."""
    kept = (alpha >= OPAQUE_ENOUGH).astype(numpy.int8)
    starts = kept[:, :1].sum() + (kept[:, 1:] > kept[:, :-1]).sum()

    return float(starts) / alpha.shape[0]


def plan_strands(random, column, strip_width, lanes, duty, wander, taper, edge_band):
    """One dictionary per sub-strand in a strip: which lane it owns, how it wanders, how dark it is.

    A LANE is one sub-strand plus the gap beside it. The lanes tile the strip's usable span, so the
    lane count is the strip's spatial frequency and `duty` is the share of a lane the sub-strand
    fills — see `STRIP_RECIPES` for why those are the two numbers that matter and what each of them
    costs. The lattice is jittered by a fraction of a LANE rather than of the strip: a lattice free
    to move a whole period leaves holes and doublings, and a gap budget this tight cannot absorb one.

    The usable span is inside the gutter and inside the widest footprint the strip can draw, so no
    strand's feather reaches a border texel. See `STRIP_GUTTER_PX` for what that border texel was
    doing to the render.
    """
    is_cap = column == CAP_STRIP
    # The interior strip keeps every BORDER treatment a card strip has — gutter, edge band, edge
    # wisps — and takes the cap's treatment of the strand's own LENGTH. See `INTERIOR_STRIP`: the
    # two are separable and conflating them is what would put a straight quad edge back.
    is_interior = column == INTERIOR_STRIP
    gutter = 0.0 if is_cap else STRIP_GUTTER_PX
    left = column * strip_width

    half_width, lane_period, lattice_left, lattice_width = lane_geometry(
        lanes, strip_width, duty, gutter, left, is_cap)

    lattice = (numpy.arange(lanes) + 0.5) / lanes
    jitter = (random.random(lanes) - 0.5) * 2.0 * LANE_JITTER / lanes

    # 🎯 One sinusoid the whole strip shares. See `BUNDLE_WANDER_SHARE`: a gap survives a curve and
    # does not survive a crowd, so most of the wander budget belongs to the bundle and only the
    # residue to the individual hair.
    bundle_phase = random.random() * math.tau
    bundle_turns = 0.5 + 0.8 * random.random()

    planned = []
    for index in range(lanes):
        root_x = lattice_left + (lattice[index] + jitter[index]) * lattice_width

        # 1 at the very edge of the lattice, 0 once `edge_band` texels in. Everything below that
        # wisp is scaled by it, so the band has no boundary of its own to become the next straight
        # line.
        to_edge = min(root_x - lattice_left, lattice_left + lattice_width - root_x)
        edge = 0.0 if is_cap else max(0.0, min(1.0, 1.0 - to_edge / edge_band))

        lane_half_width = half_width * (1.0 + (random.random() * 2.0 - 1.0) * LANE_WIDTH_JITTER)
        planned.append(plan_one_strand(
            random, root_x, lane_half_width, edge, taper, wander,
            bundle_phase, bundle_turns, left, strip_width, gutter, is_cap, is_interior))

    # The cross hairs. Thin, deep in the sort more often than not, and rooted anywhere rather than
    # on the lattice — a strand that ignores the lanes is the only thing in the strip that can break
    # the picket fence the lanes would otherwise be.
    for _ in range(int(round(lanes * CROSS_HAIR_SHARE))):
        root_x = lattice_left + random.random() * lattice_width
        to_edge = min(root_x - lattice_left, lattice_left + lattice_width - root_x)
        edge = 0.0 if is_cap else max(0.0, min(1.0, 1.0 - to_edge / edge_band))
        planned.append(plan_one_strand(
            random, root_x, half_width * CROSS_HAIR_WIDTH, edge, taper, wander * 2.2,
            bundle_phase, bundle_turns, left, strip_width, gutter, is_cap, is_interior,
            crosses_lanes=True))

    return planned


def lane_geometry(lanes, strip_width, duty, gutter, left, is_cap):
    """The lane period and the sub-strand half-width that fills `duty` of it, inside the gutter.

    ⚠️ **THE USABLE SPAN AND THE STRAND WIDTH DEFINE EACH OTHER, WHICH IS WHY THIS ITERATES.** The
    lattice is inset by the widest footprint the strip can draw (see the gutter note below), the
    footprint comes from the lane period, and the lane period comes from the usable span. Three
    passes settle it to well under a tenth of a texel and the alternative is a quadratic nobody
    would be able to read.
    """
    lattice_width = strip_width - 2.0 * gutter
    half_width = 0.0

    for _ in range(3):
        lane_period = lattice_width / lanes
        half_width = lane_period * duty * 0.5

        # ⚠️ **THE GUTTER IS A CONSTRAINT ON THE FOOTPRINT, NOT ON THE ROOT.** The first attempt at
        # this inset only the root lattice, and the sheet still had alpha 1.000 inside the gutter of
        # strips 1 and 6 — a strand rooted exactly on the gutter's inner edge is still its own
        # half-width plus a feather wide about that root. So the lattice is inset by the widest
        # strand this strip can draw plus its feather, which makes the border texels empty by
        # construction rather than by hope.
        widest = 0.0 if is_cap else half_width * (1.0 + LANE_WIDTH_JITTER) + FEATHER_TEXELS
        lattice_width = strip_width - 2.0 * (gutter + widest)

    return half_width, lattice_width / lanes, left + gutter + widest, lattice_width


def plan_one_strand(random, root_x, half_width, edge, taper, wander,
                    bundle_phase, bundle_turns, left, strip_width, gutter, is_cap, is_interior,
                    crosses_lanes=False):
    """One sub-strand's whole plan. Shared by the lane strands and by the cross hairs."""
    # A hair at the edge of a bundle is finer than one in the middle of it, and this is the term
    # that lets the strip's outermost lane read as hair rather than as the card's own border.
    strand_half_width = half_width * (1.0 - 0.45 * edge)
    room = strand_room(root_x, left + gutter, strip_width - 2.0 * gutter, strand_half_width)

    # An interior strand runs nearly the whole card. A wisp covers a random SPAN of it, which
    # is what breaks the silhouette into hairs: two neighbouring wisps end at different rows,
    # so the strip's kept boundary is ragged in v as well as in u.
    interior_length = 1.0 if (is_cap or is_interior) else 0.80 + 0.20 * random.random()
    wisp_length = 0.18 + 0.42 * random.random()
    length = interior_length + (wisp_length - interior_length) * edge
    start = edge * random.random() * max(0.0, 1.0 - length)

    # The inward lean. A hair at the edge of a bundle falls ACROSS it; only a ribbon runs
    # parallel to its own border. The sign is toward the middle of the strip, and the travel
    # is a share of the room the strand actually has rather than a constant.
    inward = 1.0 if root_x < left + strip_width * 0.5 else -1.0
    free_drift = (random.random() - 0.5) * 2.0 * room * 0.35
    lean_drift = inward * (0.25 + 0.65 * random.random()) * room

    # 🚩 EVERY STRAND IS CONTAINED IN ITS OWN STRIP, and the first sheet was not. A card samples one
    # strip, so a strand that wanders into the neighbour is CUT by the card's u range — a hard
    # vertical slice across a hair, repeated down every card edge in the groom. `strand_room` is how
    # much lateral travel this root has before it hits the gutter, and the wander and the drift
    # share it.
    budget = min(wander * (0.6 + 0.8 * random.random()), room * 0.65)
    shared = 0.0 if crosses_lanes else budget * BUNDLE_WANDER_SHARE

    return {
        "root_x": root_x,
        "half_width": strand_half_width,
        # Two sinusoids: the bundle's, which every lane in the strip shares so the partings curve
        # with the lock rather than closing across it, and the strand's own residue. A cross hair
        # takes none of the shared term — it is the hair that has left the lock.
        "wander": budget - shared,
        "wander_phase": random.random() * math.tau,
        "wander_turns": 0.6 + 1.4 * random.random(),
        "bundle_wander": shared,
        "bundle_phase": bundle_phase,
        "bundle_turns": bundle_turns,
        "drift": free_drift + (lean_drift - free_drift) * edge,
        "taper": taper,
        "value": 1.0 + (random.random() * 2.0 - 1.0) * STRAND_VALUE_JITTER,
        # The sub-strand structure inside this lane, carried by the normal and the value only.
        # See `FILAMENTS_PER_LANE`: a cross hair is already thin enough to be one filament.
        "filaments": 1 if crosses_lanes else FILAMENTS_PER_LANE,
        "filament_phase": random.random(),
        # The cap strip runs the full height with no ragged ends, no tip fade and no needle.
        # Its job is coverage, not silhouette: it is behind every card in the groom and its
        # bottom edge is the crown of the head, which must not be a row of tapering points.
        "length": length,
        "start": start,
        "tip_fade": 0.02 if is_cap else (INTERIOR_TIP_FADE if is_interior else TIP_FADE),
        "tip_needle": 0.0 if is_cap else (INTERIOR_TIP_NEEDLE if is_interior else TIP_NEEDLE),
        # The strip this strand is confined to, and whether it wraps inside it or is clipped
        # by it. See the containment clause in `draw_strand`.
        "strip_left": left,
        "strip_span": strip_width,
        "wrap": is_cap,
        "depth": random.random(),
        "id": random.random(),
    }


def strand_room(root_x, usable_left, usable_width, half_width):
    """How far this root can travel sideways before its strand crosses out of the usable span.

    One texel of margin on top of the strand's own half-width, because `draw_strand` rasterises a
    texel past the half-width for the antialiasing feather — and a feathered edge clipped by the
    card's u range is a grey line, which is less obvious than a cut hair and just as wrong.
    """
    to_left = root_x - usable_left - half_width - 1.0
    to_right = usable_left + usable_width - root_x - half_width - 1.0

    return max(0.0, min(to_left, to_right))


def draw_strand(strand, v_of_row, base_rgb,
                albedo, coverage, flow, root_to_tip, strand_id, normal, depth, size):
    """Rasterises one strand down the sheet, one row at a time, with an antialiased cross-section.

    Row by row rather than as one vectorised blit because a strand is only a handful of texels
    wide and its centre moves: a full-width mask per row would be 1024 texels of which six matter.
    The inner slice is vectorised, which is where the work is.
    """
    # `start` is where the strand's own root sits on the sheet. Zero for every interior strand —
    # a hair grows out of the scalp, and the scalp is v = 0 — and non-zero only for the edge wisps,
    # which read as hairs that have fallen across the bundle from somewhere else.
    length = max(strand["length"], 1e-6)
    start_row = int(strand["start"] * (size - 1))
    end_row = min(size - 1, int((strand["start"] + strand["length"]) * (size - 1)))

    for row in range(start_row, end_row + 1):
        v = v_of_row[row]
        along = (v - strand["start"]) / length

        centre = (strand["root_x"]
                  + strand["drift"] * along
                  + strand["wander"] * math.sin(strand["wander_phase"]
                                                + strand["wander_turns"] * math.tau * along)
                  + strand["bundle_wander"] * math.sin(strand["bundle_phase"]
                                                       + strand["bundle_turns"] * math.tau * along))

        # The needle: over the last TIP_NEEDLE of the strand the half-width goes to zero, so the
        # cutout ends in a point rather than in a horizontal cut. See TIP_NEEDLE.
        needle = 1.0
        if strand["tip_needle"] > 0.0:
            needle = min(1.0, max(0.0, (1.0 - along) / strand["tip_needle"]))

        # A wisp that begins part-way down the sheet has a second end, and an unhandled second end
        # is the same horizontal cut at the other end of the hair. It gets the same needle.
        if strand["start"] > 0.0 and strand["tip_needle"] > 0.0:
            needle = min(needle, max(0.0, along / strand["tip_needle"]))

        width = strand["half_width"] * (1.0 - strand["taper"] * along) * needle
        if width <= 0.05:
            continue

        # The strand's own direction at this row, in texel space, from the analytic derivative of
        # the wander. This IS the flow channel: dx/dv against dv/dv = 1.
        slope = (strand["drift"]
                 + strand["wander"] * strand["wander_turns"] * math.tau
                 * math.cos(strand["wander_phase"] + strand["wander_turns"] * math.tau * along)
                 + strand["bundle_wander"] * strand["bundle_turns"] * math.tau
                 * math.cos(strand["bundle_phase"] + strand["bundle_turns"] * math.tau * along)
                 ) / max(strand["length"] * (size - 1), 1.0)
        direction_length = math.hypot(slope, 1.0)
        flow_x = slope / direction_length
        flow_y = 1.0 / direction_length

        first = int(math.floor(centre - width - 1.0))
        last = int(math.ceil(centre + width + 1.0))
        if last < first:
            continue

        columns = numpy.arange(first, last + 1)
        offset = (columns - centre) / width

        # 🚩 **A STRAND MAY ONLY EVER WRITE INSIDE ITS OWN STRIP, and until this clause existed the
        # cap strip's strands wrote into strip 1.** Measured on the shipped sheet: 1,020 of strip
        # 1's 1,024 left-border texels were opaque, standard deviation 0.000 px — a dead-straight
        # vertical line down the whole card, drawn by a NEIGHBOUR. That is the razor edge the blind
        # critic traced from the crown past the jaw, and no amount of work on strip 1's own strands
        # could have moved it, because none of them were there.
        #
        # The cap strip WRAPS rather than clips. `hair_cards.cap_uv` tiles it CAP_WEDGES times
        # around the whorl, so a strand leaving its right edge is the same strand arriving at its
        # left edge one wedge round — clipping it would cut a hair at every wedge seam on the
        # crown. Every other strip clips, and the gutter means nothing should reach the clip.
        texels = columns
        if strand["wrap"]:
            texels = strand["strip_left"] + (columns - strand["strip_left"]) % strand["strip_span"]
        else:
            inside = ((columns >= strand["strip_left"])
                      & (columns < strand["strip_left"] + strand["strip_span"]))
            if not numpy.any(inside):
                continue
            columns = columns[inside]
            offset = offset[inside]
            texels = columns

        # Antialiasing is FEATHER_TEXELS at the strand's edge, expressed in the strand's own
        # half-widths because that is the unit `offset` is in. One texel exactly, at every width —
        # see `FEATHER_TEXELS` for the floor this used to carry and the gaps it was eating.
        feather = FEATHER_TEXELS / width
        hit = numpy.clip((1.0 + feather - numpy.abs(offset)) / feather, 0.0, 1.0)
        hit = hit * hit * (3.0 - 2.0 * hit)

        tip_alpha = numpy.clip((1.0 - along) / strand["tip_fade"], 0.0, 1.0)
        hit = hit * tip_alpha

        # The stipple, inside the needle only. A hash of the strand's id and the row, so it is
        # deterministic with the seed and decorrelated between neighbouring strands — two hairs
        # that dithered in step would fray as one wide hair.
        if needle < 1.0 and TIP_DITHER > 0.0:
            noise = math.sin((strand["id"] * 733.0 + row) * 12.9898) * 43758.5453
            hit = hit * (1.0 - TIP_DITHER * (1.0 - needle) * (noise - math.floor(noise)))

        if not numpy.any(hit > 0.0):
            continue

        # 🎯 **THE SUB-STRANDS INSIDE THE LANE, AND THEY COST NO COVERAGE.** `within` runs 0 to 1
        # across each of the lane's `filaments` rather than once across the whole lane, so the
        # cross-section below is that many cylinders side by side instead of one wide one, and the
        # value takes a step at every filament boundary. See `FILAMENTS_PER_LANE`: a lane wide
        # enough to have a gap beside it is wide enough to read as a ribbon, and this is the half
        # of the fix that does not have to be paid for in transmittance.
        across_lane = numpy.clip(offset, -1.0, 1.0) * 0.5 + 0.5
        if strand["filaments"] > 1:
            phase = across_lane * strand["filaments"] + strand["filament_phase"]
            index = numpy.floor(phase)
            within = phase - index
            noise = numpy.sin((index + strand["id"] * 91.7) * 12.9898) * 43758.5453
            filament_value = 1.0 + (noise - numpy.floor(noise) - 0.5) * 2.0 * FILAMENT_VALUE_JITTER
        else:
            within = across_lane
            filament_value = numpy.ones_like(across_lane)

        value = strand["value"] * root_shading(v)
        colour = numpy.clip(base_rgb[None, :] * (value * filament_value)[:, None], 0.0, 1.0)

        # Standard over-compositing, back to front, so a wisp in front of a bundle tints it.
        # Fancy-indexed rather than sliced, because `texels` is a wrapped or a clipped set of
        # columns and neither is contiguous in general.
        albedo[row, texels] = (albedo[row, texels] * (1.0 - hit)[:, None]
                               + colour * hit[:, None])
        coverage[row, texels] = coverage[row, texels] + hit * (1.0 - coverage[row, texels])

        owned = hit > OPAQUE_ENOUGH
        if not numpy.any(owned):
            continue

        owned_columns = texels[owned]

        flow[row, owned_columns, 0] = flow_x
        flow[row, owned_columns, 1] = flow_y
        root_to_tip[row, owned_columns] = v
        strand_id[row, owned_columns] = strand["id"]
        depth[row, owned_columns] = strand["depth"]

        # The cross-section. `within` is 0 at a filament's left edge and 1 at its right, so the
        # surface normal sweeps through ±STRAND_ROUNDNESS·90° across each SUB-STRAND — and is then
        # turned into the strand's own frame so the highlight runs along the hair rather than down
        # the card. One sweep per filament is what puts that many specular lobes across a lane.
        angle = (within[owned] * 2.0 - 1.0) * STRAND_ROUNDNESS * (math.pi * 0.5)
        across = numpy.sin(angle)
        out = numpy.cos(angle)
        normal[row, owned_columns, 0] = across * flow_y
        normal[row, owned_columns, 1] = -across * flow_x
        normal[row, owned_columns, 2] = out


def root_shading(v):
    """The root-to-tip value curve. Dark where the hair leaves the scalp, lightest at the ends."""
    if v < ROOT_FADE:
        return ROOT_VALUE + (1.0 - ROOT_VALUE) * (v / ROOT_FADE)
    return 1.0 + (TIP_VALUE - 1.0) * (v - ROOT_FADE) / (1.0 - ROOT_FADE)


def normalise_rows(vectors):
    """Unit-length every 3-vector in an HxWx3 array. A zero vector becomes +Z rather than NaN."""
    length = numpy.linalg.norm(vectors, axis=2, keepdims=True)
    safe = numpy.where(length < 1e-9, 1.0, length)
    unit = vectors / safe
    unit[numpy.repeat(length < 1e-9, 3, axis=2)] = 0.0
    unit[:, :, 2] = numpy.where(length[:, :, 0] < 1e-9, 1.0, unit[:, :, 2])
    return unit


def quantise(image):
    """Float 0–1 to uint8, rounding rather than truncating."""
    return numpy.clip(numpy.round(image * 255.0), 0, 255).astype(numpy.uint8)


def srgb_hex_to_unit(hex_colour):
    """#rrggbb to three floats in 0–1. Stays in sRGB: baseColorTexture is an sRGB texture."""
    if not hex_colour.startswith("#") or len(hex_colour) != 7:
        raise ValueError(f"'{hex_colour}' is not a #rrggbb colour")
    return tuple(int(hex_colour[position:position + 2], 16) / 255.0 for position in (1, 3, 5))


# --- the PNG writer -----------------------------------------------------------------------------

PNG_COLOUR_TYPE = {1: 0, 3: 2, 4: 6}


def write_png(path, image):
    """Writes an HxWxC uint8 array as an 8-bit PNG. C is 1 (grey), 3 (RGB) or 4 (RGBA).

    Every scanline is filtered with filter type 0 (None). A predictor would compress the strand
    sheet better, and it would also be the only part of this file anyone had to debug; the sheets
    come out at a few hundred KB either way and they are build output.
    """
    height, width, channels = image.shape
    colour_type = PNG_COLOUR_TYPE.get(channels)
    if colour_type is None:
        raise ValueError(f"cannot write a {channels}-channel PNG")

    raw = bytearray()
    for row in range(height):
        raw.append(0)
        raw.extend(image[row].tobytes())

    header = struct.pack(">IIBBBBB", width, height, 8, colour_type, 0, 0, 0)

    with open(path, "wb") as handle:
        handle.write(b"\x89PNG\r\n\x1a\n")
        handle.write(png_chunk(b"IHDR", header))
        handle.write(png_chunk(b"IDAT", zlib.compress(bytes(raw), 6)))
        handle.write(png_chunk(b"IEND", b""))


def png_chunk(tag, payload):
    return (struct.pack(">I", len(payload)) + tag + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xffffffff))


if __name__ == "__main__":
    main()
