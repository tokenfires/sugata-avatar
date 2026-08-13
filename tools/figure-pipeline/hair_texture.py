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
# hairs", which arrives somewhere around a quarter of a millimetre. These half-widths put a strand
# at 3 px, i.e. 0.75 mm on a 32 mm card, at the cost of a heavier antialiasing feather — and the
# feather is a gain rather than a cost, because a soft-edged strand is what stops a hair card
# crawling under TAA.
#
# (strands, half-width px at the root, wander px, tip taper)
CAP_STRIP = 0
CAP_STRIP_MIN_COVERAGE = 0.97

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
STRIP_GUTTER_PX = 3.0
EDGE_BAND_PX = 20.0

#
# ⚠️ **THE COUNTS ON STRIPS 1–5 PAY FOR THE GUTTER AND THE EDGE WISPS.** Those two cost a card
# strip real coverage — the gutter is 6 of 128 texels outright and a wisp covers a fraction of the
# card's length where a full strand covered all of it — and coverage is what keeps scalp from
# showing between the cards. Measured at the 0.5 cutoff, per strip, before and after the counts
# were raised:
#
#   strip           1      2      3      4      5      6      7
#   as shipped   0.665  0.635  0.548  0.469  0.404  0.232  0.139
#   with edges   0.548  0.504  0.474  0.395  0.318  0.193  0.126   <- the cost
#   raised       0.592  0.550  0.507  0.437  0.381  0.175  0.121   <- what ships
#
# Strips 6 and 7 are NOT raised, and they still move: the strand plan draws from one RNG stream, so
# changing an earlier strip's count changes every later strip's draw. Their figures are reported
# because they were measured, not because they were aimed at. They are the wisps whose whole job is
# to be mostly transparent so that the silhouette of a card carrying one is the outline of a few
# hairs; making them cover more would undo the thing they exist for.
STRIP_RECIPES = [
    (168, 2.4, 4.0, 0.20),
    (74, 1.6, 10.0, 0.55),
    (66, 1.5, 12.0, 0.60),
    (58, 1.4, 14.0, 0.62),
    (48, 1.3, 16.0, 0.68),
    (40, 1.2, 18.0, 0.72),
    (17, 1.1, 24.0, 0.84),
    (11, 1.0, 28.0, 0.90),
]

# Coverage above which a strand owns a texel outright in the non-blendable channels — and, not by
# coincidence, the alphaCutoff the groom exports with.
#
# 🚩 **THESE HAVE TO BE THE SAME NUMBER OR THE COVERAGE REPORT IS FICTION.** The groom exports as
# MASK through `build_figure.force_alpha_mode`, whose `ALPHA_MASK_CUTOFF` is 0.5, so a texel at
# alpha 0.4 is not a soft hair — it is a hole. Reporting the MEAN alpha of a strip would have said
# the cap covered 99.6% of its texels when the renderer was going to keep 88% of them.
OPAQUE_ENOUGH = 0.5

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
    for column, (count, half_width, wander, taper) in enumerate(STRIP_RECIPES[:STRIP_COLUMNS]):
        strands = plan_strands(random, count, column, strip_width, half_width, wander, taper)

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


def plan_strands(random, count, column, strip_width, half_width, wander, taper):
    """One dictionary per strand in a strip: where it starts, how it wanders, how dark it is.

    The strands are spread across the strip on a jittered regular lattice rather than uniformly at
    random. Pure uniform sampling clumps — with twenty-six strands in a 128 px strip, uniform
    placement leaves visible gaps and doubled hairs, and a bundle with a hole in it reads as two
    bundles.

    The lattice is laid over the strip's USABLE span, inside the gutter, so no strand's feather can
    reach a border texel. See `STRIP_GUTTER_PX` for what that border texel was doing to the render.
    """
    is_cap = column == CAP_STRIP
    gutter = 0.0 if is_cap else STRIP_GUTTER_PX
    left = column * strip_width

    # ⚠️ **THE GUTTER IS A CONSTRAINT ON THE FOOTPRINT, NOT ON THE ROOT.** The first attempt at
    # this inset only the root lattice, and the sheet still had alpha 1.000 inside the gutter of
    # strips 1 and 6 — a strand rooted exactly on the gutter's inner edge is still `half_width + 1`
    # texels wide about that root. So the lattice is inset by the widest strand this strip can
    # draw plus its feather, which is what makes the border texels empty by construction rather
    # than by hope. Costs strip 1 six texels a side of a hundred and twenty-eight; the counts above
    # pay it back.
    widest = 0.0 if is_cap else half_width * 1.3 + 1.0
    lattice_left = left + gutter + widest
    lattice_width = strip_width - 2.0 * (gutter + widest)

    lattice = (numpy.arange(count) + 0.5) / count
    jitter = (random.random(count) - 0.5) / count * 0.9

    planned = []
    for index in range(count):
        root_x = lattice_left + (lattice[index] + jitter[index]) * lattice_width

        # 1 at the very edge of the lattice, 0 once EDGE_BAND_PX in. Everything below that is a
        # wisp is scaled by it, so the band has no boundary of its own to become the next straight
        # line.
        to_edge = min(root_x - lattice_left, lattice_left + lattice_width - root_x)
        edge = 0.0 if is_cap else max(0.0, min(1.0, 1.0 - to_edge / EDGE_BAND_PX))

        strand_half_width = half_width * (0.7 + 0.6 * random.random()) * (1.0 - 0.45 * edge)
        room = strand_room(root_x, left + gutter, strip_width - 2.0 * gutter, strand_half_width)

        # An interior strand runs nearly the whole card. A wisp covers a random SPAN of it, which
        # is what breaks the silhouette into hairs: two neighbouring wisps end at different rows,
        # so the strip's kept boundary is ragged in v as well as in u.
        interior_length = 1.0 if is_cap else 0.80 + 0.20 * random.random()
        wisp_length = 0.18 + 0.42 * random.random()
        length = interior_length + (wisp_length - interior_length) * edge
        start = edge * random.random() * max(0.0, 1.0 - length)

        # The inward lean. A hair at the edge of a bundle falls ACROSS it; only a ribbon runs
        # parallel to its own border. The sign is toward the middle of the strip, and the travel
        # is a share of the room the strand actually has rather than a constant.
        inward = 1.0 if root_x < left + strip_width * 0.5 else -1.0
        free_drift = (random.random() - 0.5) * 2.0 * room * 0.35
        lean_drift = inward * (0.25 + 0.65 * random.random()) * room

        planned.append({
            "root_x": root_x,
            "half_width": strand_half_width,
            # 🚩 EVERY STRAND IS CONTAINED IN ITS OWN STRIP, and the first sheet was not. A card
            # samples one strip, so a strand that wanders into the neighbour is CUT by the card's
            # u range — a hard vertical slice across a hair, repeated down every card edge in the
            # groom. `strand_room` is how much lateral travel this root has before it hits the
            # gutter, and the wander and the drift share it.
            "wander": min(wander * (0.5 + 1.0 * random.random()), room * 0.65),
            "wander_phase": random.random() * math.tau,
            "wander_turns": 0.6 + 1.4 * random.random(),
            "drift": free_drift + (lean_drift - free_drift) * edge,
            "taper": taper,
            "value": 1.0 + (random.random() * 2.0 - 1.0) * STRAND_VALUE_JITTER,
            # The cap strip runs the full height with no ragged ends, no tip fade and no needle.
            # Its job is coverage, not silhouette: it is behind every card in the groom and its
            # bottom edge is the crown of the head, which must not be a row of tapering points.
            "length": length,
            "start": start,
            "tip_fade": 0.02 if is_cap else TIP_FADE,
            "tip_needle": 0.0 if is_cap else TIP_NEEDLE,
            # The strip this strand is confined to, and whether it wraps inside it or is clipped
            # by it. See the containment clause in `draw_strand`.
            "strip_left": left,
            "strip_span": strip_width,
            "wrap": is_cap,
            "depth": random.random(),
            "id": random.random(),
        })

    return planned


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
                                                + strand["wander_turns"] * math.tau * along))

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

        # Antialiasing is one texel of feather at the strand's edge, expressed in the strand's own
        # half-widths so a thin strand does not vanish: a hair 1.2 px across is mostly feather.
        feather = max(1.0 / width, 0.35)
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

        value = strand["value"] * root_shading(v)
        colour = numpy.clip(base_rgb * value, 0.0, 1.0)

        # Standard over-compositing, back to front, so a wisp in front of a bundle tints it.
        # Fancy-indexed rather than sliced, because `texels` is a wrapped or a clipped set of
        # columns and neither is contiguous in general.
        albedo[row, texels] = (albedo[row, texels] * (1.0 - hit)[:, None]
                               + colour[None, :] * hit[:, None])
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

        # The cross-section. `offset` is −1 at the strand's left edge and +1 at its right, so the
        # surface normal sweeps through ±STRAND_ROUNDNESS·90° across the hair — and is then turned
        # into the strand's own frame so the highlight runs along the hair rather than down the
        # card.
        angle = numpy.clip(offset[owned], -1.0, 1.0) * STRAND_ROUNDNESS * (math.pi * 0.5)
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
