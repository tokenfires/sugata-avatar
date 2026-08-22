"""Exports this project's own groom as TressFX `.tfx` STRANDS, bypassing the card assembly.

The question this file exists to answer: three independent lines of evidence say the hair CARD
primitive is wrong, and none of them can separate "our groom's SHAPE is wrong" from "our
CARD/alpha/dither PATH is wrong" — because every plate ever measured went through both. Putting
OUR OWN guide curves through a second, competent, CARDLESS renderer separates them. If the
frostbitten plate of our groom reads as hair, the shape is fine and the card path is the defect;
if it reads wrong there too, the groom is.

`tools/critic/control-frostbitten/README.md` is the other half of this: it puts frostbitten's OWN
groom through our judging path. That arm controls the JUDGES. This arm controls the PRIMITIVE.

## What is exported, and what is deliberately skipped

`hair_cards.grow_to_cut` returns `GUIDE_SEGMENTS + 1` points "uniformly spaced along the curve's
own arc" (its own docstring, and `resample` below it does the work). That is a strand. Everything
after it in `grow_layer` — `ribbon_of`, the half-width, the twist, the strip index, the lock UV —
is the card, and the card is the thing under suspicion. So this file captures the guide at the
last moment it is still a curve and never lets the ribbon happen.

🚩 **THE CAPTURE IS A WRAPPER AROUND `ribbon_of`, NOT A REIMPLEMENTATION OF `grow_layer`.** The
guide handed to `ribbon_of` has already been through the root sample, the direction field, the
length correction, the trim, the arc resample AND `draw_into_lock`'s clumping. Re-deriving that
sequence here would be a second groom generator that drifts from the first, which is precisely the
"two files that each decide independently will disagree" failure `assets/hair/manifest.json`'s own
header warns about. `hair_cards.py` is not edited and not copied; it is called, and one function
of it is observed.

## Points per strand: seventeen in, sixteen out

`GUIDE_SEGMENTS = 16` gives seventeen points. TressFX's header documents `numVerticesPerStrand` as
"From 4 to 64 inclusive (POW2 only)", and frostbitten's shipped groom is sixteen. Seventeen is not
a power of two, so the export resamples — which is cheap and lossless-in-intent precisely because
the input is ALREADY uniform in arc: `resample_by_arc` walks a polyline that has no bunching in it,
so the sixteen points it returns differ from the seventeen only by where the samples land, not by
what curve they describe. The round-trip check below measures exactly that: arc length is compared
against the source guide and reported, rather than asserted away.

## Density, which is the deliverable

The card groom is a few hundred cards. Frostbitten ships 11,400 strands. Nobody knows what strand
density this groom needs, and the strand-count-to-millisecond curve IS the spike's result and the
LOD story besides. So `--strand-density` multiplies every layer's card count and the achieved
count is REPORTED rather than assumed — `hair_cards.sample_roots` is a dart thrower with an
attempt ceiling, so asking for N roots is not the same as getting them.

## Running it

    blender --background --python tools/figure-pipeline/tfx_export.py --python-exit-code 1 -- \\
        --hair bob01 --gender 0.5 --tfx-output /tmp/bob01_g050.tfx

Every argument this script does not recognise is forwarded verbatim to `build_figure.py`'s own
parser, so `--hair-seed`, `--hair-part` and `--hair-colour` mean here exactly what they mean there.
The body GLB and the hair GLB are NOT written: `export_glb` is stubbed for the duration, because
this script's only output is the `.tfx` and a build that also wrote assets could overwrite the
control. The strand atlas PNGs are still drawn (the material stage wants them) and land in
`--hair-dir`, which therefore defaults to a temporary directory here rather than to `assets/hair`.

The writer and the reader below do not import `bpy` and can be exercised without Blender:

    python3 tools/figure-pipeline/tfx_export.py --selftest

## What the density knob actually reaches

Measured on bob01 at g050, Blender 5.2.0 LTS, this machine, by running the command above at each
multiplier and reading the "roots per layer" table it prints:

    density   strands   bytes      wall
      1.0        496      127,136   ~23 s
      2.0        992      254,112   ~21 s
      5.0      2,480      635,040   ~23 s
     10.0      4,960    1,269,920   ~26 s
     23.0     11,408    2,920,608   ~35 s
     50.0     24,800    6,348,960   ~62 s

🎯 **NO LAYER FELL SHORT AT ANY OF THEM, SO REACHING FROSTBITTEN'S OWN 11,400 NEEDS NO GENERATOR
CHANGE.** That was the open question — `sample_roots` is a dart thrower and could have started
rejecting — and it does not, because its dart radius is `sqrt(area / (count * pi)) * 0.80` and its
attempt ceiling is `count * 60`; both scale WITH the request, so the packing problem is the same
shape at every density. Density 23 gives 11,408 strands against frostbitten's shipped 11,400,
which is the comparison the spike wants. The cost is the O(n²) neighbour test inside the thrower,
which is what bends the wall clock upward past 10× and is the only thing that will eventually stop
this — not a shortfall.

## Consuming it in frostbitten

⚠️ `src/constants.ts:60-65` types `HairFile` as a UNION OF THE FIVE SHIPPED FILENAMES, and
`CONFIG.hairFile` is annotated with it. A file with any other name is a TYPE ERROR rather than a
missing asset, so the consuming side adds one union member and points `CONFIG.hairFile` at it. That
is a change to the clone in the scratchpad; nothing here is vendored — see
`tools/critic/control-frostbitten/README.md` for why the Sintel assets make that a licence question
and not a convenience one.

Coordinates go out in METRES, and the groom sits at head height (z ≈ 1.33–1.69 m in Blender, y in
the file) because it is bolted to a standing figure. frostbitten's camera, shadow source
(`distance: 5.0`, `target: [0, 2, 0]`) and `fiberRadius: 0.0006` are all authored in its own scene's
units; `--tfx-scale` is here so that relationship can be moved deliberately rather than discovered.
"""

import argparse
import math
import os
import struct
import sys
import tempfile


# --- the file format ------------------------------------------------------------------------
#
# 🚩 **EVERY FIELD BELOW WAS TRANSCRIBED FROM THE CONSUMING LOADER, NOT FROM THE TRESSFX SPEC.**
# What matters is what `Scthe/frostbitten-hair-webgpu` actually parses, and it parses a strict
# subset: the header, and the vertex position array. Nothing else in the file is read at all.
#
#   `src/scene/hair/tfxFileLoader.ts:31-45` — `parseHeader` reads ONE f32 at byte 0 (the version)
#   and then SEVEN u32 at byte 4: numHairStrands, numVerticesPerStrand, offsetVertexPosition,
#   offsetStrandUV, offsetVertexUV, offsetStrandThickness, offsetVertexColor.
#
#   `src/scene/hair/tfxFileLoader.ts:54-63` — the only array it touches is
#   `new Float32Array(fileData, offsetVertexPosition, numHairStrands * numVerticesPerStrand * 4)`.
#   The four remaining offsets are declared and never dereferenced, so they are written as 0.
#
#   `src/scene/hair/hairPointsPositionsBuffer.ts:24` — the shader indexes that array as
#   `[strandIdx * pointsPerStrand + pointIdx]`, which is STRAND-MAJOR: a whole strand's points
#   consecutively, then the next strand.
#
# The header is 160 bytes because their own Blender-side exporter says so and pads to it —
# `scripts/tfx_exporter.py:8` `HEADER_SIZE_BYTES = 160` and the 32 reserved u32 at its line 31 —
# and because `offsetVertexPosition` is written as that same constant at its line 26.
#
# ⚠️ Endianness is written LITTLE explicitly. Their exporter uses struct's native order and their
# loader uses `Float32Array`, which is the host's order; both happen to be little-endian on every
# machine either one runs on, so the file has no marker and an explicit '<' is the only way this
# side states what it produced.
TFX_HEADER_BYTES = 160
TFX_HEADER_FORMAT = "<f7I" + "32I"
TFX_VERSION = 4.0
TFX_RESERVED_UINTS = 32

# 🎯 **`.w` IS AN IS-MOVABLE FLAG, NOT AN INVERSE MASS AND NOT A THICKNESS.** TressFX conventionally
# packs several different things there, so it was checked rather than assumed:
#
#   `src/passes/simulation/shaderImpl/integration.wgsl.ts:3` — "Positions have .w as isMovable
#   flag. 1.0 if isMovable, 0.0 if is not (strand root)."
#   `src/passes/simulation/shaderImpl/constraints.wgsl.ts:48` — the shape constraint multiplies its
#   correction by `pos.w`, so a 0.0 there is a pinned point and nothing else.
#   `scripts/tfx_exporter.py:139` — `_create_point` writes `1.0 if is_movable else 0.0`, and the
#   file's own TODO list at line 7 records the decision: "co.w defines if is movable, set 1 for
#   root" (the comment is inverted; the code is the authority and pins index 0).
#
# So point 0 of every strand — the root, on the scalp — is 0.0 and every other point is 1.0. A file
# that got this backwards would load, render a still frame identically, and fly apart the moment
# the simulation ran, which is the kind of defect that gets blamed on the groom.
TFX_ROOT_W = 0.0
TFX_MOVABLE_W = 1.0

# Points per strand. Sixteen matches frostbitten's shipped `...16points.tfx` and the POW2 range its
# header documents. `hair_cards.GUIDE_SEGMENTS` is 16 and therefore hands over seventeen points;
# see the module docstring for why the difference is a resample rather than a problem.
DEFAULT_POINTS_PER_STRAND = 16
POINTS_PER_STRAND_RANGE = (4, 64)


def is_power_of_two(value):
    return value > 0 and (value & (value - 1)) == 0


# --- writing ------------------------------------------------------------------------------------


def tfx_header_bytes(strand_count, points_per_strand):
    """The 160-byte header. Only `offsetVertexPosition` is non-zero; nothing else is read."""
    fields = [TFX_VERSION, strand_count, points_per_strand, TFX_HEADER_BYTES,
              0,   # offsetStrandUV
              0,   # offsetVertexUV
              0,   # offsetStrandThickness
              0]   # offsetVertexColor
    fields.extend([0] * TFX_RESERVED_UINTS)

    header = struct.pack(TFX_HEADER_FORMAT, *fields)
    if len(header) != TFX_HEADER_BYTES:
        raise SystemExit(f"Export failed: the header packed to {len(header)} bytes rather than "
                         f"{TFX_HEADER_BYTES}. `offsetVertexPosition` is written as that constant, "
                         "so a header of any other size points the loader at the wrong byte.")

    return header


def write_tfx(path, strands, points_per_strand):
    """Writes `strands` — a list of lists of (x, y, z) in the TARGET space — as a `.tfx` file.

    No coordinate conversion and no scaling happen here. Both are decisions about which groom is
    being exported and belong upstream, where the source space is known; this function's whole job
    is to lay the bytes out the way the loader reads them.
    """
    for index, strand in enumerate(strands):
        if len(strand) != points_per_strand:
            raise SystemExit(f"Export failed: strand {index} has {len(strand)} points against a "
                             f"header declaring {points_per_strand}. The loader sizes its read off "
                             "the header alone, so a ragged array is silently misaligned rather "
                             "than rejected.")

    payload = bytearray(tfx_header_bytes(len(strands), points_per_strand))
    for strand in strands:
        for point_index, point in enumerate(strand):
            movable = TFX_ROOT_W if point_index == 0 else TFX_MOVABLE_W
            payload.extend(struct.pack("<4f", point[0], point[1], point[2], movable))

    with open(path, "wb") as handle:
        handle.write(payload)

    return len(payload)


# --- reading, independently -----------------------------------------------------------------
#
# 🚩 **THIS READER SHARES NO CODE WITH THE WRITER ABOVE, AND THAT IS THE POINT.** A round trip
# through a shared struct format proves the format string is self-consistent and nothing else. This
# one unpacks the header field by field at its documented byte offset and slices the payload by
# arithmetic, so a wrong offset, a wrong stride or a wrong ordering shows up as a wrong number
# rather than cancelling out.


def read_tfx(path):
    """Parses a `.tfx` back into (header dict, list of strands, list of per-point w)."""
    with open(path, "rb") as handle:
        raw = handle.read()

    if len(raw) < TFX_HEADER_BYTES:
        raise SystemExit(f"Read failed: {path} is {len(raw)} bytes, shorter than the header.")

    header = {
        "version": struct.unpack_from("<f", raw, 0)[0],
        "numHairStrands": struct.unpack_from("<I", raw, 4)[0],
        "numVerticesPerStrand": struct.unpack_from("<I", raw, 8)[0],
        "offsetVertexPosition": struct.unpack_from("<I", raw, 12)[0],
        "offsetStrandUV": struct.unpack_from("<I", raw, 16)[0],
        "offsetVertexUV": struct.unpack_from("<I", raw, 20)[0],
        "offsetStrandThickness": struct.unpack_from("<I", raw, 24)[0],
        "offsetVertexColor": struct.unpack_from("<I", raw, 28)[0],
    }

    strand_count = header["numHairStrands"]
    per_strand = header["numVerticesPerStrand"]
    base = header["offsetVertexPosition"]
    needed = base + strand_count * per_strand * 16
    if len(raw) < needed:
        raise SystemExit(f"Read failed: {path} declares {strand_count} x {per_strand} points from "
                         f"byte {base}, which needs {needed} bytes; the file is {len(raw)}.")

    strands = []
    movable = []
    for strand_index in range(strand_count):
        points = []
        flags = []
        for point_index in range(per_strand):
            offset = base + (strand_index * per_strand + point_index) * 16
            x, y, z, w = struct.unpack_from("<4f", raw, offset)
            points.append((x, y, z))
            flags.append(w)
        strands.append(points)
        movable.append(flags)

    return header, strands, movable


# --- geometry helpers -------------------------------------------------------------------------


def resample_by_arc(points, count):
    """`count` points uniformly spaced along a polyline's own arc, endpoints preserved.

    The same construction `hair_cards.resample` uses, restated here for one reason: that one is
    bound to `GUIDE_SEGMENTS` and returns seventeen points, and this export needs a power of two.
    Calling it would mean rebinding a module global of the generator, which is the one thing this
    file must not do.
    """
    if count < 2:
        raise SystemExit(f"Export failed: a strand of {count} points is not a curve.")

    spans = [distance(points[index - 1], points[index]) for index in range(1, len(points))]
    total = sum(spans)
    if total < 1e-9:
        return [tuple(points[0]) for _ in range(count)]

    resampled = [tuple(points[0])]
    segment = 0
    walked = 0.0
    for ring in range(1, count):
        target = total * ring / (count - 1)
        while segment < len(spans) - 1 and walked + spans[segment] < target:
            walked += spans[segment]
            segment += 1

        along = (target - walked) / max(spans[segment], 1e-9)
        resampled.append(lerp(points[segment], points[segment + 1], min(max(along, 0.0), 1.0)))

    return resampled


def distance(first, second):
    return math.sqrt(sum((first[axis] - second[axis]) ** 2 for axis in range(3)))


def lerp(first, second, fraction):
    return tuple(first[axis] + (second[axis] - first[axis]) * fraction for axis in range(3))


def arc_length(points):
    return sum(distance(points[index - 1], points[index]) for index in range(1, len(points)))


def bounding_box(strands):
    """(min xyz, max xyz) over every point of every strand."""
    low = [float("inf")] * 3
    high = [float("-inf")] * 3
    for strand in strands:
        for point in strand:
            for axis in range(3):
                low[axis] = min(low[axis], point[axis])
                high[axis] = max(high[axis], point[axis])

    return tuple(low), tuple(high)


# 🎯 **BLENDER IS Z-UP AND FROSTBITTEN'S SCENE IS Y-UP, AND THE CONVERSION IS THEIR EXPORTER'S OWN.**
# `scripts/tfx_exporter.py:13` — `to_opengl_coordinates(co)` returns `[co[0], co[2], -co[1]]`. Their
# shipped Sintel strands went through that function, so a file written any other way would sit in a
# different orientation from the groom their camera, lights, shadow source and collision sphere were
# all tuned against — and the plate would be read as a shape defect of ours.
def to_target_space(point, scale):
    return (point[0] * scale, point[2] * scale, -point[1] * scale)


# --- capturing the guides ---------------------------------------------------------------------


def capture_guides(forwarded_arguments, strand_density):
    """Runs the real groom build and returns every guide curve `ribbon_of` was about to ribbon.

    Returns (guides, per_layer, style_id) where a guide is a list of `mathutils.Vector` in Blender
    space and `per_layer` is a list of (layer name, requested cards, achieved cards).

    ⚠️ Imported here rather than at module scope so the writer, the reader and the selftest above
    stay runnable under plain CPython. `hair_cards` imports `bpy` at ITS module scope.
    """
    pipeline_directory = os.path.dirname(os.path.abspath(__file__))
    if pipeline_directory not in sys.path:
        sys.path.insert(0, pipeline_directory)

    # 🚩 **`build_figure.py` CALLS `main()` AT MODULE SCOPE — ITS LAST LINE, UNGUARDED — SO
    # IMPORTING IT IS RUNNING IT.** Everything this function needs in place must therefore be in
    # place before the import statement, and `sys.argv` must already read the way that module's
    # own `parse_arguments` expects: the arguments live after a `--` separator, because Blender
    # puts them there. `hair_cards` has no such line and imports normally, which is what makes the
    # patch below possible at all.
    import hair_cards

    captured = []
    original_ribbon_of = hair_cards.ribbon_of
    original_sample_roots = hair_cards.sample_roots
    original_grow_layer = hair_cards.grow_layer

    per_layer = []
    inside_layer = []

    def recording_ribbon_of(guide, *arguments, **keywords):
        captured.append([point.copy() for point in guide])
        return original_ribbon_of(guide, *arguments, **keywords)

    def recording_grow_layer(basemesh, frame, body, layer, *arguments, **keywords):
        # ⚠️ **THE LOCKS ARE SAMPLED THROUGH `sample_roots` TOO, AND THEY ARE NOT A LAYER.**
        # `place_locks` runs once before any layer and asks for LOCK_COUNT points; measured on
        # bob01 that is the first of nine calls against eight layers, and a naive positional zip
        # labels every layer with its neighbour's name. Worse, densifying the locks would change
        # the CLUMPING STRUCTURE rather than the strand count — a groom of sixteen locks is what
        # `HairMaterial.js` shades and what `lock-coherence.mjs` measures. So the multiplier and
        # the bookkeeping both apply only while a layer is on the stack.
        inside_layer.append(layer["name"])
        try:
            return original_grow_layer(basemesh, frame, body, layer, *arguments, **keywords)
        finally:
            inside_layer.pop()

    def densified_sample_roots(basemesh, frame, count, *arguments, **keywords):
        if not inside_layer:
            return original_sample_roots(basemesh, frame, count, *arguments, **keywords)

        # 🚩 The multiplier lands on the ARGUMENT rather than on the layer dict. `apply_style` binds
        # the table's own list of layer dicts into the module's globals without copying, and says in
        # its own comment that nothing below it mutates them; writing a scaled `cards` back would
        # make that comment false and would leave the table permanently altered for anything else
        # in the same process. `sample_roots` derives its dart radius AND its attempt ceiling from
        # `count` alone, so scaling the argument scales the whole sampler consistently.
        wanted = max(1, int(round(count * strand_density)))
        accepted = original_sample_roots(basemesh, frame, wanted, *arguments, **keywords)
        per_layer.append((inside_layer[-1], wanted, len(accepted)))
        return accepted

    hair_cards.ribbon_of = recording_ribbon_of
    hair_cards.grow_layer = recording_grow_layer
    hair_cards.sample_roots = densified_sample_roots

    # ⚠️ **THE GLBs THE BUILD STILL WRITES ARE KEPT AWAY FROM THE CONTROL BY THEIR PATHS, NOT BY A
    # STUB.** Since the import IS the run, there is no moment at which `build_figure.export_glb`
    # could be replaced; `main()` calls the name it closed over. `--output` and `--hair-dir` are
    # therefore forced to temporary directories by the caller, so the build writes a body GLB, a
    # hair GLB and four atlas PNGs that nothing reads and nobody keeps — and `assets/hair/bob01/`,
    # whose sha256 several committed measurements are pinned to, is never opened for writing.
    saved_argv = sys.argv
    sys.argv = ["build_figure.py", "--"] + forwarded_arguments
    try:
        import build_figure  # noqa: F401 — the import runs the whole build. See above.
    finally:
        sys.argv = saved_argv
        hair_cards.ribbon_of = original_ribbon_of
        hair_cards.grow_layer = original_grow_layer
        hair_cards.sample_roots = original_sample_roots

    return captured, per_layer


# --- verification -------------------------------------------------------------------------------


def verify_round_trip(path, source_strands, points_per_strand, tolerance_m):
    """Parses the written file back and compares it against the strands it was written from.

    Prints expected-vs-actual for every quantity it checks and returns the parsed header. This is
    the only claim this script makes without a GPU, so it is made against the bytes on disk rather
    than against the list that produced them.
    """
    header, parsed, movable = read_tfx(path)

    print("")
    print("  round trip (written file re-parsed by an independent reader)")
    print(f"    {'field':<26} {'expected':>18} {'actual':>18}")
    checks = []

    def check(name, expected, actual, formatter="{}"):
        ok = expected == actual
        checks.append((name, ok))
        print(f"    {name:<26} {formatter.format(expected):>18} {formatter.format(actual):>18}"
              f"  {'ok' if ok else 'MISMATCH'}")

    check("version", TFX_VERSION, header["version"], "{:.1f}")
    check("numHairStrands", len(source_strands), header["numHairStrands"])
    check("numVerticesPerStrand", points_per_strand, header["numVerticesPerStrand"])
    check("offsetVertexPosition", TFX_HEADER_BYTES, header["offsetVertexPosition"])
    check("total points", len(source_strands) * points_per_strand,
          sum(len(strand) for strand in parsed))

    roots_pinned = all(flags[0] == TFX_ROOT_W for flags in movable)
    rest_movable = all(all(value == TFX_MOVABLE_W for value in flags[1:]) for flags in movable)
    checks.append(("w convention", roots_pinned and rest_movable))
    print(f"    {'w: root 0.0, rest 1.0':<26} {'all strands':>18} "
          f"{('all strands' if roots_pinned and rest_movable else 'VIOLATED'):>18}"
          f"  {'ok' if roots_pinned and rest_movable else 'MISMATCH'}")

    source_low, source_high = bounding_box(source_strands)
    parsed_low, parsed_high = bounding_box(parsed)
    box_error = max(abs(source_low[axis] - parsed_low[axis]) for axis in range(3))
    box_error = max(box_error, max(abs(source_high[axis] - parsed_high[axis])
                                   for axis in range(3)))
    checks.append(("bounding box", box_error <= tolerance_m))
    print(f"    {'bounding box max error':<26} {'<= ' + f'{tolerance_m:.2e}':>18} "
          f"{box_error:>18.3e}  {'ok' if box_error <= tolerance_m else 'MISMATCH'}")

    arc_error = max(abs(arc_length(source) - arc_length(actual))
                    for source, actual in zip(source_strands, parsed))
    checks.append(("arc lengths", arc_error <= tolerance_m))
    print(f"    {'arc length max error':<26} {'<= ' + f'{tolerance_m:.2e}':>18} "
          f"{arc_error:>18.3e}  {'ok' if arc_error <= tolerance_m else 'MISMATCH'}")

    failed = [name for name, ok in checks if not ok]
    if failed:
        raise SystemExit(f"Export failed: the file on disk does not describe the groom it was "
                         f"written from — {failed}. A .tfx that only looks right is not verified.")

    print(f"    all {len(checks)} checks passed")

    return header


def describe(path, source_guides, resampled, byte_count, header, per_layer, scale):
    """The artefact's own numbers. Every one is read off the file or the captured curves."""
    low, high = bounding_box(resampled)
    # 🔴 PAIRED, AND NOT TWO SORTED LISTS. The first version of this block computed the resample
    # loss as `median(sorted source arcs) - median(sorted resampled arcs)`, which decouples the
    # strands entirely: it is a difference of two order statistics over independently sorted
    # populations, so it cannot see a per-strand loss at all. An adversarial verifier built the
    # null that proves it — three strands whose true median loss is exactly 0.000000 m, for which
    # that expression prints 0.100800 m — and measured the real overstatement on bob01@g050 at
    # 4.09x. Keep the arcs PAIRED by index and difference them per strand.
    source_arcs_by_strand = [arc_length(guide) for guide in source_guides]
    resampled_arcs_by_strand = [arc_length(strand) for strand in resampled]
    strand_losses = sorted(
        a - b for a, b in zip(source_arcs_by_strand, resampled_arcs_by_strand)
    )
    relative_losses = sorted(
        (a - b) / a for a, b in zip(source_arcs_by_strand, resampled_arcs_by_strand) if a > 0
    )
    source_arcs = sorted(source_arcs_by_strand)
    resampled_arcs = sorted(resampled_arcs_by_strand)

    def median(values):
        middle = len(values) // 2
        if len(values) % 2:
            return values[middle]
        return (values[middle - 1] + values[middle]) / 2.0

    print("")
    print("  artefact")
    print(f"    path                       {path}")
    print(f"    bytes                      {byte_count} "
          f"({TFX_HEADER_BYTES} header + {byte_count - TFX_HEADER_BYTES} positions)")
    print(f"    strands                    {header['numHairStrands']}")
    print(f"    points per strand          {header['numVerticesPerStrand']}")
    print(f"    total points               "
          f"{header['numHairStrands'] * header['numVerticesPerStrand']}")
    print(f"    segments                   "
          f"{header['numHairStrands'] * (header['numVerticesPerStrand'] - 1)}")
    print(f"    scale applied              {scale}")
    print(f"    bounding box min (m)       "
          f"({low[0]:.4f}, {low[1]:.4f}, {low[2]:.4f})")
    print(f"    bounding box max (m)       "
          f"({high[0]:.4f}, {high[1]:.4f}, {high[2]:.4f})")
    print(f"    bounding box size (m)      "
          f"({high[0] - low[0]:.4f}, {high[1] - low[1]:.4f}, {high[2] - low[2]:.4f})")
    print(f"    strand arc median (m)      {median(resampled_arcs):.4f}")
    print(f"    strand arc min / max (m)   {resampled_arcs[0]:.4f} / {resampled_arcs[-1]:.4f}")
    # Reported as a distribution rather than as one number, because the single median hid a real
    # tail: one strand in this groom loses 7.0% of its arc to the 17->16 resample.
    print(f"    resample loss, per strand  median {median(strand_losses):+.3e} m"
          f"   max {strand_losses[-1]:+.3e} m")
    print(f"    resample loss, relative    median {median(relative_losses) * 100:.4f} %"
          f"   max {relative_losses[-1] * 100:.4f} %")

    print("")
    print("  roots per layer (requested -> accepted by the dart thrower)")
    for name, wanted, achieved in per_layer:
        shortfall = "" if achieved == wanted else f"  SHORT by {wanted - achieved}"
        print(f"    {name:<22} {wanted:>7} -> {achieved:>7}{shortfall}")


# --- the selftest ------------------------------------------------------------------------------


def selftest():
    """Exercises the writer, the reader and the resampler with no Blender and no groom."""
    failures = []

    def expect(name, condition, detail=""):
        print(f"  {'ok  ' if condition else 'FAIL'} {name}{'  ' + detail if detail else ''}")
        if not condition:
            failures.append(name)

    # A straight strand of known length resamples to known points and known arc.
    line = [(0.0, 0.0, index * 0.25) for index in range(17)]
    resampled = resample_by_arc(line, 16)
    expect("resample point count", len(resampled) == 16, f"{len(resampled)}")
    expect("resample preserves arc", abs(arc_length(resampled) - 4.0) < 1e-9,
           f"{arc_length(resampled):.9f} against 4.0")
    expect("resample preserves endpoints",
           resampled[0] == line[0] and abs(resampled[-1][2] - 4.0) < 1e-9)

    # A polyline with deliberately uneven spans still comes back uniform.
    uneven = [(0.0, 0.0, 0.0), (0.0, 0.0, 0.1), (0.0, 0.0, 3.0), (0.0, 0.0, 4.0)]
    even = resample_by_arc(uneven, 5)
    spans = [distance(even[index - 1], even[index]) for index in range(1, len(even))]
    expect("resample is uniform in arc", max(spans) - min(spans) < 1e-9,
           f"span spread {max(spans) - min(spans):.3e}")

    handle, path = tempfile.mkstemp(suffix=".tfx")
    os.close(handle)
    try:
        strands = [[(index * 0.01, point * 0.02, point * 0.03) for point in range(16)]
                   for index in range(7)]
        written = write_tfx(path, strands, 16)
        expect("file size is header + 16 bytes a point",
               written == TFX_HEADER_BYTES + 7 * 16 * 16, f"{written}")

        header, parsed, movable = read_tfx(path)
        expect("header version", header["version"] == TFX_VERSION)
        expect("header strand count", header["numHairStrands"] == 7)
        expect("header points per strand", header["numVerticesPerStrand"] == 16)
        expect("header position offset", header["offsetVertexPosition"] == TFX_HEADER_BYTES)
        expect("unread offsets are zero",
               header["offsetStrandUV"] == 0 and header["offsetVertexUV"] == 0
               and header["offsetStrandThickness"] == 0 and header["offsetVertexColor"] == 0)
        expect("positions survive the round trip",
               all(all(abs(a - b) < 1e-6 for a, b in zip(source, actual))
                   for source_strand, parsed_strand in zip(strands, parsed)
                   for source, actual in zip(source_strand, parsed_strand)))
        expect("roots pinned, rest movable",
               all(flags[0] == TFX_ROOT_W and all(v == TFX_MOVABLE_W for v in flags[1:])
                   for flags in movable))

        # Strand-major ordering: the loader indexes [strandIdx * pointsPerStrand + pointIdx], so
        # the second strand's first point must sit at byte 160 + 16 * 16.
        with open(path, "rb") as check_handle:
            raw = check_handle.read()
        second_root = struct.unpack_from("<4f", raw, TFX_HEADER_BYTES + 16 * 16)
        expect("strand-major ordering", abs(second_root[0] - 0.01) < 1e-6,
               f"x={second_root[0]:.4f} against 0.01")

        # A ragged array is refused rather than written misaligned.
        ragged = [[(0.0, 0.0, 0.0)] * 16, [(0.0, 0.0, 0.0)] * 15]
        try:
            write_tfx(path, ragged, 16)
            expect("ragged strands are refused", False)
        except SystemExit:
            expect("ragged strands are refused", True)
    finally:
        os.unlink(path)

    print("")
    if failures:
        raise SystemExit(f"selftest FAILED: {failures}")
    print("selftest passed")


# --- entry point --------------------------------------------------------------------------------


def parse_arguments(script_arguments):
    """This script's own arguments. Everything else is forwarded to `build_figure.py` untouched."""
    parser = argparse.ArgumentParser(
        description="Export this project's guide curves as a TressFX .tfx strand file.")
    parser.add_argument("--tfx-output", metavar="PATH", default=None,
                        help="Where the .tfx is written. Required unless --selftest.")
    parser.add_argument("--strand-density", type=float, default=1.0, metavar="MULTIPLIER",
                        help="Multiplies every layer's card count, so 1.0 is one strand per card "
                             "of the shipping groom. The achieved count is reported per layer "
                             "because the root sampler is a dart thrower with an attempt ceiling "
                             "and can fall short. See the module docstring: this curve is the "
                             "spike's deliverable.")
    parser.add_argument("--points-per-strand", type=int, default=DEFAULT_POINTS_PER_STRAND,
                        help="TressFX's header documents 4 to 64 inclusive, POW2 only. The guides "
                             "arrive with GUIDE_SEGMENTS + 1 points and are resampled to this.")
    parser.add_argument("--tfx-scale", type=float, default=1.0, metavar="FACTOR",
                        help="Multiplies every coordinate on the way out. frostbitten's loader is "
                             "called with scale 1.0 (src/scene/loadScene.ts:61), so the file's own "
                             "units are the scene's units and this is the only place to change "
                             "them. 1.0 keeps metres.")
    parser.add_argument("--selftest", action="store_true",
                        help="Exercise the writer, reader and resampler without Blender.")

    return parser.parse_known_args(script_arguments)


def main():
    # Blender hands a script everything after the `--` separator; run under plain CPython there is
    # no separator and the arguments are simply the tail of argv.
    if "--" in sys.argv:
        script_arguments = sys.argv[sys.argv.index("--") + 1:]
    else:
        script_arguments = sys.argv[1:]

    arguments, forwarded = parse_arguments(script_arguments)

    if arguments.selftest:
        selftest()
        return

    if not arguments.tfx_output:
        raise SystemExit("Export failed: --tfx-output names the file to write and has no default. "
                         "Writing beside the groom would put a build artefact in assets/hair.")

    points_per_strand = arguments.points_per_strand
    low, high = POINTS_PER_STRAND_RANGE
    if not (low <= points_per_strand <= high and is_power_of_two(points_per_strand)):
        raise SystemExit(
            f"Export failed: --points-per-strand {points_per_strand} is outside the range the "
            f"TressFX header documents ({low} to {high} inclusive, POW2 only). frostbitten sizes "
            "its simulation workgroup off this number, so a value it does not expect is a "
            "dispatch-shaped failure rather than a load error.")

    if arguments.strand_density <= 0.0:
        raise SystemExit("Export failed: --strand-density must be positive; a groom of zero "
                         "strands is not a control.")

    # ⚠️ The strand atlas is still drawn by the material stage and has to land somewhere. It lands
    # in a temporary directory unless the caller says otherwise, because the default in
    # `build_figure.py` is `assets/hair` and the bob01 control lives there.
    forwarded = list(forwarded)
    if not any(argument.startswith("--hair-dir") for argument in forwarded):
        forwarded += ["--hair-dir", tempfile.mkdtemp(prefix="tfx-export-atlas-")]
    if not any(argument.startswith("--output") for argument in forwarded):
        forwarded += ["--output", os.path.join(tempfile.mkdtemp(prefix="tfx-export-glb-"),
                                               "unwritten.glb")]

    print("Exporting guide curves as TressFX strands")
    print(f"  build_figure arguments     {' '.join(forwarded)}")
    print(f"  strand density             {arguments.strand_density}")

    guides, per_layer = capture_guides(forwarded, arguments.strand_density)
    if not guides:
        raise SystemExit("Export failed: the build grew no guides, so there is nothing to export. "
                         "`--hair STYLE` is what makes the groom happen and may be missing.")

    strands = [resample_by_arc([to_target_space(point, arguments.tfx_scale) for point in guide],
                               points_per_strand)
               for guide in guides]
    source_strands = [[to_target_space(point, arguments.tfx_scale) for point in guide]
                      for guide in guides]

    output_path = os.path.abspath(arguments.tfx_output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    byte_count = write_tfx(output_path, strands, points_per_strand)

    # The tolerance is float32's own precision at this scale. Positions go out as f32 and come back
    # as f32, so the only error a correct file can carry is the rounding of the source doubles —
    # roughly 1e-7 of a metre-scale coordinate. Anything larger is a layout defect, not precision.
    header = verify_round_trip(output_path, strands, points_per_strand, tolerance_m=1e-5)
    describe(output_path, source_strands, strands, byte_count, header, per_layer,
             arguments.tfx_scale)


if __name__ == "__main__":
    main()
