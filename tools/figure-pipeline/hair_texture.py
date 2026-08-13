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
off it by up to `STRAND_WANDER_PIXELS`, and a highlight computed from the card tangent alone
therefore runs straight down a surface whose hairs do not — the tell that reads as "plastic wig".
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

STRIP_RECIPES = [
    (168, 2.4, 4.0, 0.20),
    (58, 1.6, 10.0, 0.55),
    (52, 1.5, 12.0, 0.60),
    (46, 1.4, 14.0, 0.62),
    (38, 1.3, 16.0, 0.68),
    (32, 1.2, 18.0, 0.72),
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
    """
    left = column * strip_width
    lattice = (numpy.arange(count) + 0.5) / count
    jitter = (random.random(count) - 0.5) / count * 0.9

    planned = []
    for index in range(count):
        root_x = left + (lattice[index] + jitter[index]) * strip_width
        room = strand_room(root_x, left, strip_width, half_width)

        planned.append({
            "root_x": root_x,
            "half_width": half_width * (0.7 + 0.6 * random.random()),
            # 🚩 EVERY STRAND IS CONTAINED IN ITS OWN STRIP, and the first sheet was not. A card
            # samples one strip, so a strand that wanders into the neighbour is CUT by the card's
            # u range — a hard vertical slice across a hair, repeated down every card edge in the
            # groom. `strand_room` is how much lateral travel this root has before it hits the
            # strip boundary, and the wander and the drift share it.
            "wander": min(wander * (0.5 + 1.0 * random.random()), room * 0.65),
            "wander_phase": random.random() * math.tau,
            "wander_turns": 0.6 + 1.4 * random.random(),
            "drift": (random.random() - 0.5) * 2.0 * room * 0.35,
            "taper": taper,
            "value": 1.0 + (random.random() * 2.0 - 1.0) * STRAND_VALUE_JITTER,
            # The cap strip runs the full height with no ragged ends and no tip fade. Its job is
            # coverage, not silhouette: it is behind every card in the groom and its bottom edge is
            # the crown of the head, which must not be a row of tapering points.
            "length": 1.0 if column == CAP_STRIP else 0.80 + 0.20 * random.random(),
            "tip_fade": 0.02 if column == CAP_STRIP else TIP_FADE,
            "depth": random.random(),
            "id": random.random(),
        })

    return planned


def strand_room(root_x, left, strip_width, half_width):
    """How far this root can travel sideways before its strand crosses the strip boundary.

    One texel of margin on top of the strand's own half-width, so the antialiasing feather stays
    inside the strip too — a feathered edge clipped by the card's u range is a grey line, which is
    less obvious than a cut hair and just as wrong.
    """
    to_left = root_x - left - half_width - 1.0
    to_right = left + strip_width - root_x - half_width - 1.0

    return max(0.0, min(to_left, to_right))


def draw_strand(strand, v_of_row, base_rgb,
                albedo, coverage, flow, root_to_tip, strand_id, normal, depth, size):
    """Rasterises one strand down the sheet, one row at a time, with an antialiased cross-section.

    Row by row rather than as one vectorised blit because a strand is only a handful of texels
    wide and its centre moves: a full-width mask per row would be 1024 texels of which six matter.
    The inner slice is vectorised, which is where the work is.
    """
    end_row = int(strand["length"] * (size - 1))

    for row in range(0, end_row + 1):
        v = v_of_row[row]
        along = v / max(strand["length"], 1e-6)

        centre = (strand["root_x"]
                  + strand["drift"] * along
                  + strand["wander"] * math.sin(strand["wander_phase"]
                                                + strand["wander_turns"] * math.tau * along))

        width = strand["half_width"] * (1.0 - strand["taper"] * along)
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

        first = max(0, int(math.floor(centre - width - 1.0)))
        last = min(size - 1, int(math.ceil(centre + width + 1.0)))
        if last < first:
            continue

        columns = numpy.arange(first, last + 1)
        offset = (columns - centre) / width

        # Antialiasing is one texel of feather at the strand's edge, expressed in the strand's own
        # half-widths so a thin strand does not vanish: a hair 1.2 px across is mostly feather.
        feather = max(1.0 / width, 0.35)
        hit = numpy.clip((1.0 + feather - numpy.abs(offset)) / feather, 0.0, 1.0)
        hit = hit * hit * (3.0 - 2.0 * hit)

        tip_alpha = numpy.clip((1.0 - along) / strand["tip_fade"], 0.0, 1.0)
        hit = hit * tip_alpha
        if not numpy.any(hit > 0.0):
            continue

        value = strand["value"] * root_shading(v)
        colour = numpy.clip(base_rgb * value, 0.0, 1.0)

        row_albedo = albedo[row, first:last + 1]
        row_coverage = coverage[row, first:last + 1]

        # Standard over-compositing, back to front, so a wisp in front of a bundle tints it.
        row_albedo *= (1.0 - hit)[:, None]
        row_albedo += colour[None, :] * hit[:, None]
        coverage[row, first:last + 1] = row_coverage + hit * (1.0 - row_coverage)

        owned = hit > OPAQUE_ENOUGH
        if not numpy.any(owned):
            continue

        owned_columns = columns[owned]

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
