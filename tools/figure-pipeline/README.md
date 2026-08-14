# Figure pipeline

Build-time only. Turns MPFB2 (MakeHuman for Blender) into the GLB figures the runtime loads.

MPFB2's Python is GPLv3 and never ships. Its *output* is CC0 (MPFB2 `LICENSE.md` §D), and the
GLBs in `assets/figures/` are the only thing that crosses into the app.

## One-time setup

```bash
bash tools/figure-pipeline/install_deps.sh
```

Downloads and installs, into the local Blender:

| Thing | Source | Size |
|---|---|---|
| MPFB2 2.0.17 | extensions.blender.org (sha256-pinned) | 45 MB |
| `makehuman_system_assets` (CC0) | files.makehumancommunity.org | 281 MB |
| `faceunits01` — the 52 ARKit face units | files.makehumancommunity.org | 258 KB |
| `visemes01` / `visemes02` — 22 MS / 15 OVR visemes | files.makehumancommunity.org | 310 KB |

Downloads are cached in `.cache/` (gitignored). `--force` re-downloads.
Override the interpreter with `BLENDER=/path/to/blender`.

The script ends by running `verify_install.py` inside Blender, which resolves all 89 target
names to files and exits non-zero if any is missing. That is the gate for punch-list item 0.2.

## Building figures

```bash
npm run figure                       # the full gender sweep
bash tools/figure-pipeline/build.sh  # same thing
```

Writes `assets/figures/figure_g000.glb` … `figure_g100.glb` — gender 0.00, 0.25, 0.50, 0.75,
1.00. Roughly 5 s and 11 MB each.

One figure at a time, with the full option list:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/figure-pipeline/build_figure.py -- --help
```

Useful flags: `--age/--muscle/--weight/--height/--proportions`, `--rig none`, `--skin none`,
`--no-face-parts`, `--no-microsoft-visemes`, `--keep-morph-normals`, `--eye-proxy`.

## Building a wardrobe-ready body and its garment fragments

Punch-list 9.2. Three commands, and all of their output is gitignored build output exactly like
`assets/figures/*.glb`:

```bash
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender

# 1. the body: whole geometry plus a per-vertex _HIDE_* mask per garment, and one fragment GLB
#    per garment written into assets/wardrobe/<id>/g050.glb
$BLENDER --background --python tools/figure-pipeline/build_figure.py --python-exit-code 1 -- \
  --gender 0.5 --output assets/wardrobe/body/g050.glb \
  --garment female_casualsuit01 --garment shoes01 --garment fedora01 \
  --garment female_elegantsuit01 \
  --foundation foundation_bra --foundation foundation_vest \
  --foundation foundation_briefs --foundation foundation_boxer_brief \
  --hide-mask-attribute --garment-fragment-dir assets/wardrobe

# 2 and 3. the BAKED controls the runtime rebuild is measured against
$BLENDER --background --python tools/figure-pipeline/build_figure.py --python-exit-code 1 -- \
  --gender 0.5 --output assets/wardrobe/baked/suit_shoes_g050.glb \
  --garment female_casualsuit01 --garment shoes01
$BLENDER --background --python tools/figure-pipeline/build_figure.py --python-exit-code 1 -- \
  --gender 0.5 --output assets/wardrobe/baked/suit_g050.glb \
  --garment female_casualsuit01
```

🎯 **`--garment` ALSO RECOVERS THE GARMENT'S BAKED AO — punch-list 9.7.** MPFB's
`NodeWrapperGameEngine` wires diffuse, diffuse alpha and normal and has no occlusion node at all, so
each garment's hand-baked `aomapTexture` was read off disk by nobody. `wire_garment_ao_maps()` reads
the mhmat directly and feeds the declared map to the exporter's Occlusion socket. ⚠️ **Only TWO of
the four CC0 garments declare one** — `female_casualsuit01` and `female_elegantsuit01`; `shoes01`
and `fedora01` do not, and the punch-list's claim that all of them did was wrong. It is not free:
the casualsuit fragment grows **8.93 → 11.08 MB** and the elegantsuit **3.72 → 5.07 MB**, +3.5 MB of
PNG, which lands squarely on 9.6's transcode item. `verify_glb.mjs` asserts the invariant in both
directions, so a build that stopped wiring the node — or started wiring it onto everything — is
caught without a GPU.

Then:

```bash
node packages/core/src/wardrobe/wardrobe.selftest.mjs
```

⚠️ **`assets/wardrobe/**/*.glb` IS GITIGNORED BUILD OUTPUT AND R11 REBUILT ALL OF IT** — three
identities × eight garments, plus the three bodies. Another checkout is measuring the PREVIOUS
round's artefacts until these commands are re-run, and `wardrobe.selftest.mjs`,
`decency.selftest.mjs`, `shadow.selftest.mjs` and `verify_glb.mjs` will all report on them without
saying so. The two baked controls in `assets/wardrobe/baked/` were deliberately NOT rebuilt: the AO
wiring does not touch geometry, and they are the reference the runtime rebuild is compared against.

Measured on this machine, Blender 5.2.0 LTS `fbe6228777e7`, M5 Max:

| build | wall | body verts | body tris |
|---|---:|---:|---:|
| nude control — sha256 `b56115d0cb52…`, identical to the committed `figure_g050.glb` | 8.56 s | 14,517 | 26,756 |
| `--garment female_casualsuit01`, masks BAKED | ~9 s | 11,779 | **21,380** |
| `--garment` suit + shoes, masks BAKED | 8.73 s | 9,247 | **17,012** |
| four garments, `--hide-mask-attribute` + fragments | 9.54 s | 14,517 | 26,756 |

The attribute body is **11,742,100 bytes** against the nude control's 11,567,392 — +174,708 for
three FLOAT32 masks over 14,517 vertices, which is §2.4's 58,068 bytes per garment. Ship them as
`UNSIGNED_BYTE` and that becomes 14.5 KB each; a hide flag is a boolean.

### `--foundation` — punch-list 9.8

🚩 **A foundation garment is generated from the figure's OWN SKIN rather than fitted from an
mhclo.** `--foundation <id>` takes a region of body faces, refines it, offsets it 3 mm along its
normals, holds **2.0 mm at the hem** and then **FOLDS THE HEM BACK** as a band of real faces, low-pass
filters the result so it behaves like cloth rather than paint, and reprojects.

🚩 **THAT HEM USED TO TAPER TO 0.8 MM SO IT "MELTED INTO THE SKIN", AND THE MELT WAS THE DEFECT.**
Three blind judges were pointed at `packages/testbed/src/wardrobe.html` as 9.8's own text asks, and
**two ranked the foundation layer their single strongest tell that this was a render** — *"a texture
region, not a garment"*, *"a jaggy texture boundary on bare skin"*. They were wrong about the
mechanism, since there is not one texture byte on this layer, and right about the read: **a surface
tapered to nothing at its edge has visibly no thickness.** `roll_the_hem()` extrudes the open
boundary and turns it under, precisely so the edge IS visible. Do not restore the taper.

    FOUNDATION_HEM_OFFSET_M      0.0020   (was 0.0008)  where the shell body ends
    FOUNDATION_HEM_ROLL_M        0.0012                 how far the band folds back
    FOUNDATION_HEM_ROLL_FLOOR_M  0.0008                 the standoff the fold lands at

🎯 **AND AT R12 THE ROLL WAS MEASURED IN PIXELS FOR THE FIRST TIME, which is what the judges were
actually looking at.** `packages/core/src/wardrobe/hem.selftest.mjs` reads the band out of the
shipped GLB topologically — exactly two triangles per boundary edge, median depth **1.200 mm** on
all twelve fragments — and then renders the briefs' leg opening and measures how much darker the
garment is in the 1.5 mm before its edge than it is 4–8 mm inside: **52.32%** leaning in, **40.19%**
at conversational distance. `verify_glb.mjs` carries the geometric half of the same measurement.

🚩 **THE ROLL READS THROUGH THE NORMALS IT INDUCES, NOT THROUGH THE BAND'S OWN AREA.** At a hem
seen face-on the band extrudes along the view direction and its projected area is nearly zero; what
darkens is the shell's LAST RING OF FACES, whose vertex normals the extrusion turned through most of
a right angle. Measured: a break that flattened the band's positions and left the exported normals
alone moved 1,003 vertices and changed the statistic by **nothing**. Anything that keeps the band
but re-authors the normals — a hard-edge split, a custom normal pass, a decimation — loses the fix
while every face count stays right.

    --no-hem-roll     build the shells WITHOUT the band. RED PROOF ONLY, never for assets/.

That flag is what makes the pixel gate honest: built to a scratch directory it reproduces the
pre-roll face counts to the unit (bra 8,956, vest 12,134, briefs 5,072, boxer 5,358), its shells
read **0.112–0.125 mm** of depth instead of 1.200, and the same trough collapses to **3.86% /
3.65%**. Point `HEM_NOROLL_FRAGMENTS` at that directory and the gate measures it as well as its own
runtime reconstruction of it.

**The 2.0 mm offset is a measured ceiling, not a round number.** Swept at g000, the tightest
perineal slot, reading the briefs' minimum clearance off the build: 0.8 mm → 0.22, 1.2 → 0.13,
1.6 → 0.11, **2.0 → 0.14**, and **2.2 mm reads 0.049 mm and FAILS the build** against the 0.05 mm
z-fight floor.

⚠️ **`describe_foundation` now FAILS a shell with zero rolled faces**, so losing the band is a build
failure rather than a line nobody reads. Per-garment roll faces at g050: bra 1,872, vest 1,904,
briefs 1,000, boxer brief 780. The winding of those faces is asserted consistent on the exported
triangles — a foundation garment exports OPAQUE and is backface culled, so a band built the other
way round would be *invisible*, which is the defect it exists to fix with extra triangles. Because the shell is cut from the basemesh **at the requested
identity**, it has **no fitting step and therefore nothing to drift** — unlike 9.4's mhclo garments,
it can be regenerated for any `--gender` by re-running the command above.

The flag also writes the three `_DECENCY_*` vertex regions onto the body, which is what
`packages/core/src/wardrobe/decency.selftest.mjs` measures coverage against, and it turns
`export_attributes` on for the same reason `--hide-mask-attribute` does.

⚠️ **Leave `--foundation` off the command and the very next rebuild silently drops the four
fragments and the decency attributes**, which turns `decency.selftest.mjs` red for a reason that has
nothing to do with the code. That is why it is on the documented command above rather than in a
footnote.

🎯 **MEASURED AT THREE IDENTITIES, NOT ONE.** 9.8 shipped with `g050` and nothing else, and the
claim that the shells fit every identity *by construction* — they are cut from the basemesh AT the
requested identity, so there is no fitting step to drift — was an argument rather than a
measurement. It is a measurement now. Built 2026-08-09 at R10, three runs of the documented command
above with `--gender 0`, `--gender 0.5` and `--gender 1`, **10.6–14.3 s each**, all three exit 0:

| fragment | | g000 | g050 | g100 |
|---|---|---:|---:|---:|
| `foundation_bra` | faces | 9,342 | 8,956 | 8,654 |
| | bytes | 809,112 | 778,516 | 756,872 |
| | standoff mm | 0.80–4.33 | 0.80–4.12 | 0.80–4.57 |
| `foundation_vest` | faces | 12,318 | 12,134 | 12,006 |
| | bytes | 1,050,904 | 1,035,740 | 1,024,140 |
| | standoff mm | 0.58–4.41 | 0.48–4.20 | **0.28**–4.81 |
| `foundation_briefs` | faces | 5,042 | 5,072 | 5,222 |
| | bytes | 450,784 | 452,836 | 466,628 |
| | standoff mm | **0.22**–4.57 | 0.80–4.18 | 0.64–4.29 |
| `foundation_boxer_brief` | faces | 5,246 | 5,358 | 5,566 |
| | bytes | 462,548 | 470,364 | 486,988 |
| | standoff mm | **0.22**–4.61 | 0.80–4.18 | 0.65–4.29 |

All twelve fragments carry **ZERO images** and **0 vertices through the body**. The g050 column
reproduces the numbers this table shipped with to the byte, which is what makes the other two
columns comparable rather than merely present.

⚠️ **THE FACE COUNTS AND THE LOWER CLEARANCES IN THAT TABLE ARE SUPERSEDED BY THE HEM ROLL** and are
kept because the comparison across identities is still the point. Rebuilt at R11 with the roll, all
three identities, all exit 0:

| fragment | | g000 | g050 | g100 |
|---|---|---:|---:|---:|
| `foundation_bra` | faces | 11,270 | 10,828 | 10,508 |
| | roll faces | 1,928 | 1,872 | 1,854 |
| | standoff mm | 0.80–4.33 | 0.80–4.12 | 0.80–4.57 |
| `foundation_vest` | faces | 14,266 | 14,038 | 13,870 |
| | roll faces | 1,948 | 1,904 | 1,864 |
| | standoff mm | 0.54–4.41 | 0.48–4.20 | **0.22**–4.81 |
| `foundation_briefs` | faces | 6,054 | 6,072 | 6,228 |
| | roll faces | 1,012 | 1,000 | 1,006 |
| | standoff mm | **0.14**–4.57 | 0.77–4.18 | 0.50–4.29 |
| `foundation_boxer_brief` | faces | 6,062 | 6,138 | 6,304 |
| | roll faces | 816 | 780 | 738 |
| | standoff mm | **0.14**–4.61 | 0.77–4.18 | 0.50–4.29 |

🚩 **The clearance is now measured AFTER the roll, and that correction matters more than the
numbers.** The first version measured before it and was therefore reporting on every vertex except
the ones at risk. A worn floor pair costs **+5,744 triangles** over the pre-roll shells, on the one
garment set that can never be taken off.

⚠️ **"0.48–4.20 mm clearance" was a g050 property and this table is why it is no longer written as
a general one.** The nearest approach falls to **0.22 mm** on both lower garments at g000 — less
than half the g050 minimum, against a 0.05 mm floor — and the vest reaches **0.28 mm** at g100. Both
pass, and neither is comfortable: the margin over the 0.05 mm z-fighting floor is **4.4×** at g000
and **5.6×** at g100, against **9.6×** at the identity the claim was written from. A judge has
looked at none of the twelve.

The decency regions are themselves identity-dependent, which is the other thing one figure could
not show: chest **122 / 110 / 118** body vertices and seat **30 / 40 / 44** across g000 / g050 /
g100. Every floor combination the build enumerates covers every region at all three.

🚩 **AND THE BUILD ENUMERATES TWO OF THE FOUR LEGAL FLOORS, WHICH THIS RUN FOUND BY GOING OFF
g050.** At g100 `foundation_briefs` covers **42 of 44** seat vertices — and the build passed,
because `floor_candidates` takes one garment per SLOT and `LEGS` has exactly one candidate, so
`foundation_boxer_brief` is forced into every enumerated outfit and every outfit containing
`foundation_briefs` then conflicts out at `HIPS`. The two floors never checked are `bra + briefs`
and `vest + briefs` — and `bra + briefs` is the floor the shipped runtime default actually picks.
Filed as **REQ-059** in [`docs/OPEN-REQUESTS.md`](../../docs/OPEN-REQUESTS.md), with the note that
the build's set algebra and `decency.selftest.mjs`'s ray cast are different instruments: a vertex
outside the cut region may still have cloth in front of it, and only the ray cast can say.

Build-time clearance at g050 **0.48–4.20 mm** with **0 vertices through the body**; 22–38 vertices
per lower garment are deliberately thinned where the crotch leaves no room (55 at g000, 42 at g100).
The build FAILS rather than ships
if a shell folded through the body, if a standoff falls outside [0.05 mm, 2× the cut offset], or if
any decency-floor combination leaves a region uncovered. It fired three times while 9.8 was being
built and was right every time.

🚩 **Two traps this path walks into, both silent, both handled here rather than discovered again.**

- `export_attributes` **defaults OFF** in Blender's glTF exporter and the build reports success
  without it. `export_glb` passes it explicitly and `describe_hide_masks` reads the baked mesh
  back rather than trusting the export call. A figure built without it can wear a garment and
  will never hide the body underneath.
- The exporter **UPPER-CASES** the attribute name: authored `_hide_shoes01`, the file carries
  `_HIDE_SHOES01` — and three.js's `GLTFLoader` lowercases unknown attributes on the way back in,
  so the runtime sees `_hide_shoes01` again. Both spellings exist in the wild. Every consumer
  matches case-insensitively.

⚠️ `assets/wardrobe/body/g050.glb` is deliberately a **separate artefact** from the shipped
`assets/figures/figure_g050.glb` this round. Adding the attributes changes that file's sha256, and
several measured gates in `docs/PROGRESS.md` were taken against it.

## The hair groom — punch-list 3.6

```bash
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender

# one identity
$BLENDER --background --python tools/figure-pipeline/build_figure.py --python-exit-code 1 -- \
  --gender 0.5 --output assets/figures/figure_g050.glb --hair bob01

# all five, because build.sh forwards its extra arguments
tools/figure-pipeline/build.sh --hair bob01
```

Writes `assets/hair/bob01/g<NNN>.glb` plus the four strand sheets beside it. All of it is
gitignored build output; `assets/hair/manifest.json` is authored and committed and is what the
build, `verify_glb.mjs` and `packages/testbed/src/hair.js` all read the groom's alphaMode, cutoff,
bone and map names from.

🎯 **THE SCALP REGION IS MakeHuman's OWN `scalp` VERTEX GROUP, and this pipeline had never looked
at it.** 376 body vertices on the cranium, authored by the base mesh, moving with every macro and
modelling target — so the groom's region tracks the identity for the same reason `--foundation`'s
shells fit it: derived from the body it sits on, with no fitting step to drift. `ears` is
subtracted, and a further 39 vertices go to the ARKit brow targets' own reach, which is
`SkinRegions.js`'s argument used on a region boundary rather than on a region. Measured across the
sweep, one command per identity, all five exit 0:

| | g000 | g025 | g050 | g075 | g100 |
|---|---:|---:|---:|---:|---:|
| scalp verts after the cut | 337 | 337 | 337 | 337 | 337 |
| scalp area above the hairline | 472.6 cm² | 492.1 | 513.2 | 535.9 | 561.0 |
| crown z | 1.5912 | 1.6255 | 1.6594 | 1.6936 | 1.7291 |
| nearest approach, build's instrument | 3.505 mm | 3.501 | 3.504 | 3.503 | 3.501 |
| nearest approach, `verify_glb.mjs` | 3.505 mm | 3.501 | 3.504 | 3.503 | 3.501 |
| cranium hidden through the cutout | 100.00% | 100.00 | 100.00 | 99.98 | 99.95 |
| largest connected exposed patch | 0.0 mm² | 0.0 | 0.0 | 5.0 | 5.5 |
| bare cranium seen from the worst judge view | 0.0 mm² | 10.6 | 4.9 | 11.0 | 5.9 |
| **cards deep, p50 on the worst judge view (ceiling 18)** | **16** | **14** | **14** | **13** | **13** |
| card tips over card roots (ceiling 0.95) | 0.866 | 0.856 | 0.829 | 0.812 | 0.847 |
| a tip's height step to its 5 nearest | 6.4 mm | 6.4 | 6.4 | 6.6 | 6.7 |
| fragment bytes | 3,119,236 | 3,119,572 | 3,118,972 | 3,119,388 | 3,119,352 |

The g050 groom is **462 cards of 17 rings each + 2 cap shells of 564 triangles**, 16,360 verts,
15,912 triangles, 3,118,972 bytes. The four sheets are shared and written once per build: albedo
1,090,362 · normal 1,064,393 · flow 348,510 · depth 63,001 bytes.

### R25 — the lock id now leaves this file, in TEXCOORD_1

🎯 **THE GROOM HAS HAD A REAL LOCK IDENTITY SINCE R22 AND NONE OF IT REACHED THE SHADER.**
`LOCK_COUNT = 16` dart-thrown scalp centres shared by every layer, every card assigned by
`nearest_lock(root)` — a Voronoi on the scalp — and `LOCK_DIRECTION_SHARE = 0.75` giving the lock
three quarters of a card's deflection and curl. But `assemble_cards` wrote `u` = the atlas STRIP
(one of eight, shared by every card on it) and `v` = root-to-tip, and the GLB carried
POSITION / NORMAL / TEXCOORD_0 / JOINTS_0 / WEIGHTS_0 and nothing else. R24 spent a round hashing a
lock-scale field out of `positionGeometry.xz` because that was the only lock-scale coordinate a
shader could reach.

A **second UV layer** is the channel, and the choice was verified in the installed trees rather
than assumed: `io_scene_gltf2/blender/exp/primitive_extract.py:110` sets
`tex_coord_max = len(mesh.uv_layers)` with no "used by a material" filter, and three r185's
`GLTFLoader.js:2228` maps `TEXCOORD_1` to the `uv1` attribute that TSL's `uv(1)` reads.

| | meaning | written |
|---|---|---|
| `u1` | `(nearest_lock index + 0.5) / 16` | per CARD, constant over the whole card |
| `v1` | `clamp((d2 − d1) / lock_edge_scale, 0, 1)` — the Voronoi edge distance at the root | per CARD |

plus `sugata_lock_count`, `sugata_lock_edge_scale_m` and the sixteen `sugata_lock_centres` in the
mesh's own extras, converted to glTF's Y-up because `export_yup=True` rotates POSITION and leaves
custom properties exactly as written.

🚩 **THE CAP IS WRITTEN PER VERTEX AND THE CARDS PER CARD, AND THE ASYMMETRY PROTECTS THE
COMPONENT COUNT.** Blender's exporter de-duplicates on the whole attribute tuple, so a per-FACE
value on the cap — whose vertices are shared — would split every one of them and shatter the cap
into hundreds of components, which is the exact failure `export_hair_fragment` records for
`export_tangents=True` and is what the card-count gate is built on. Measured: the groom is
**17,516 verts / 8,500 quads / 17,000 triangles before and after**, and `verify_glb.mjs` still reads
496 quad-strip components and 2 cap patches. The channel costs **141,352 bytes a bake** — 3,185,880
to 3,327,232 at g000 — which is 17,516 vec2s of f32 plus the accessor, and nothing else.

**The gate RE-DERIVES the channel rather than reading it back**, which is why the centres travel
with the file: `reportLockChannel` finds the nearest centre to every card's own exported root and
compares. Over the five bakes it agrees on **95.97 / 96.37 / 96.17 / 96.98 / 95.36%** of cards, and
the emitted edge distance sits **0.083–0.089** (p90) from the re-derived one. The gap is geometric
and is not slack: the generator assigns from the scalp root and the file carries the ribbon's first
ring, `root + normal · standoff`, 3.8–30 mm off the surface. `hair_lockid.selftest.mjs` pins the
operator on one site, two collinear sites, a square lattice and an f32 index round trip first —
36 assertions.

🔴 **TWO DEFECTS WERE FOUND BY THAT GATE AND BOTH WERE IN THE NEW CODE.**
1. **Blender's exporter flips `v` on EVERY UV layer**, so the first build shipped the edge distance
   inside out — the gate read p50 0.753 off the file against the 0.245 the build had just printed,
   the same number the wrong way up. `lock_uv()` applies the flip at the write, and the gate's
   edge clause is what catches it in either direction.
2. **The gate's own root-ring pick was on the wrong end of the card**, for the same reason read from
   the other side: `assemble_cards` writes the root at `v = 1` and the FILE carries it at `v = 0`.
   Reading the source and stopping there re-derived 23% of the indices and looked like a broken
   channel. Measured on `g050.glb`: the `v = 0` ring sits at y 1.5083 and the `v = 1` ring at
   y 1.4362, and the scalp is the higher of the two.

**And the groom itself did not move.** `hair_cards.py` was reverted to HEAD and all five bakes
rebuilt: every sha256 came back identical to the pre-round record (g000 `2b81e0ba…`, g025
`969e29c8…`, g050 `0daf4978…`, g075 `8ee63065…`, g100 `e83adc64…`), as did all four atlas sheets.
The coherent-lock-relief row is unchanged at 3.27 / 3.10 / 3.25 / 3.74 / 4.71 mm, which is the
declared red this file has carried for three rounds and is not this round's to clear.

```bash
node tools/figure-pipeline/hair_lockid.selftest.mjs   # PASS — 36 assertions
node tools/figure-pipeline/verify_glb.mjs             # the lock clause, five bakes
```

### R23 — the scatter is ONE SHELL's own thickness, and the standoff ladder was never the lever

🚩 **R22 LEFT THIS ROUND ONE INSTRUCTION — "the lever is the SCATTER, thin the shell" — AND THE
FIRST THING R23 DID WAS MEASURE WHETHER THE SHELL IS WHAT THE SCATTER IS MADE OF. IT IS NOT.**
Everything below is measured on the shipped R22 groom (`g050.glb` sha256 `5de7300e…`, rebuilt
byte-identically from `hair_cards.py` sha256 `8ebad215…` before anything was touched).

**The instrument first.** `hair_locks.measureGroom` already split its relief into a coherent ridge
`rms·√r`; the twin `rms·√(1−r)` is the SCATTER and nobody had ever printed it. It is one line and it
is now a column. `hair_locks.envelopeSpread` is the p85-minus-p50 gap R22's finding was quoted in,
which existed only as a one-off script and as fifteen open-coded lines inside `verify_glb.mjs` —
both now call the one function, which carries five arithmetic assertions including the one that
says what it CANNOT see. `hair_locks.selftest.mjs` runs 45.

```bash
node tools/figure-pipeline/hair_locks.selftest.mjs   # PASS — 45 assertions
node tools/figure-pipeline/hair_locks.mjs            # the five bakes, six columns
```

🎯 **AND THEN THE GROOM WAS READ ONE LAYER AT A TIME, WHICH IS THE ROUND.** Card vertices are
emitted layer by layer, so a subset of the shipped file IS a single shell — every card at exactly
one standoff, no ladder at all. Read about the whole groom's axis and height window so the seven
readings are comparable:

| layer, on the shipped g050 | cards | relief mm | coherence | LOCK mm | **SCATTER mm** | p85−p50 mm |
|---|---:|---:|---:|---:|---:|---:|
| `root` | 78 | 4.911 | −0.034 | 0.000 | **4.911** | 4.506 |
| `mass` | 100 | 7.102 | 0.254 | 3.581 | **6.133** | 7.571 |
| `underlayer` | 70 | 4.808 | −0.106 | 0.000 | **4.808** | 4.810 |
| `body` | 48 | 6.237 | 0.022 | 0.926 | **6.168** | 7.202 |
| `surface` | 48 | 5.310 | 0.469 | 3.637 | **3.869** | 6.017 |
| `flyaway` | 28 | 13.260 | −0.533 | 0.000 | **13.260** | 7.719 |
| `veil` | 90 | 6.919 | −0.003 | 0.000 | **6.919** | 8.255 |
| **all seven together** | **462** | 7.291 | 0.183 | 3.123 | **6.588** | 11.399 |

🚩 **`veil` IS NINETY CARDS AT ONE STANDOFF AND IT READS 6.919 mm OF SCATTER AGAINST THE WHOLE
GROOM'S 6.588.** Six of the seven shells individually read more scatter than the seven-shell stack
reads together. The eleven-millimetre cloud is not seven standoffs seen at once; it is what a single
shell of long curved ribbons measures, because a card's radius inside a 30 mm height band is set by
how far along its own fall it happens to be — a card rooted at the crown crosses that band having
swung out, and one rooted at the temple crosses it still hugging. The standoff is not the variable.

⚠️ **AND THE PRESCRIPTION WAS BUILT ANYWAY, BECAUSE AN ARGUMENT IS NOT A MEASUREMENT.** The visible
layers' standoff span was halved — 11.0/13.5/16.5/20.0/22.5/28.5 mm to 14.5/15.8/17.3/19.0/20.3/
23.3, 17.5 mm of ladder down to 8.8 — and rebuilt:

| g050 | relief mm | coherence | LOCK mm | SCATTER mm | p85−p50 mm |
|---|---:|---:|---:|---:|---:|
| shipped, 462 cards | 7.291 | 0.183 | 3.123 | 6.588 | 11.399 |
| **ladder halved** | 6.976 | 0.141 | **2.620** | **6.466** | 9.966 |
| per-card levers (twist 0.35→0.16, lock share 0.75→0.90, width spread ±25%→±15%) | 7.526 | 0.238 | **3.673** | 6.569 | 11.554 |
| + per-lock standoff, 10 mm | 7.816 | 0.243 | **3.849** | 6.802 | 10.725 |
| + per-lock standoff, 24 mm | 7.360 | 0.194 | **3.245** | 6.607 | 10.686 |

**Halving the ladder moved the scatter by 0.12 mm and made the LOCK WORSE.** Five grooms, four of
them built this round, and `SCATTER` sits in 6.47–6.80 mm on every one of them — invariant under a
change that removed half the standoff structure and under a change that more than halved the
per-card twist. That is the negative result, and it is the useful half of the round.

🎯 **AND THE GATE CANNOT BE CLEARED BY TIGHTENING THE ENVELOPE EVEN IN PRINCIPLE, WHICH FOLLOWS FROM
ITS OWN ARITHMETIC.** `coherentReliefMm` is `rms·√r` = the RIDGE's own RMS, and
`hair_locks.selftest.mjs` clause 6 pins exactly that: a lobed shell buried in scatter of equal
variance reads back its lobe amplitude to the micrometre. Removing scatter lowers `rms` and raises
`r` and leaves the product where it was. So "thin the cloud until the locks show" is a statement
about the EYE, and this gate is not measuring the eye — it is measuring ridge amplitude, and only a
louder ridge moves it. R22 found the amplitude that clears it (±45 mm) renders as storm damage.

🚩 **THE PER-LOCK STANDOFF IS THE ONE IDEA THAT SHOULD HAVE WORKED AND DID NOT SURVIVE THE SWEEP.**
Unlike R22's global `cos 16θ` displacement it re-seats whole BUNDLES — the cards of one lock stand
further off the skull than the cards of the next, which is what a real bob does — and at g050 it was
worth +0.73 mm of ridge. It is **non-monotonic in amplitude** (10 mm reads 3.849, 24 mm reads 3.245:
the cut correction re-lengthens every card and the 0–3 detrend absorbs more of a louder, broader
lobe) and the g050 gain **reversed on three of the five bakes**, which is what took the whole lever
set out of the shipped groom. Reproduce it by threading a per-lock offset through
`grow_to_cut`/`grow_guide` and adding it to the standoff the hug and the push-out are measured
against, faded in as `s^0.70`.

⚠️ **THE LESSON THAT COST THE MOST TIME: FOUR LEVERS WERE TUNED ON g050 ALONE AND THREE OF THE FIVE
BAKES DISAGREED.** Coherent lock relief per bake, g000 → g100, and the mean of each row:

| coherent lock relief, floor 5.0 mm | g000 | g025 | g050 | g075 | g100 | mean |
|---|---:|---:|---:|---:|---:|---:|
| R22's shipped groom, 462 cards | 3.437 | 3.193 | 3.123 | 3.501 | 4.586 | **3.568** |
| whole lever set + a 44-card fringe, 506 cards | 3.138 | 3.119 | **3.425** | **3.789** | 3.552 | **3.405** |
| a 44-card fringe alone, 506 cards | 3.443 | 2.849 | 3.052 | 3.534 | 4.837 | **3.543** |
| **a 34-card fringe alone, 496 cards — SHIPPED** | 3.272 | 3.096 | 3.253 | 3.741 | 4.710 | **3.414** |

The lever set is +0.30 at the bake it was tuned on and a **loss over the sweep**, which is why it is
in this README and not in `hair_cards.py`. `build.sh --hair bob01` is 110 seconds for all five.
Tune on the sweep. Every fringe row is inside 0.15 mm of R22's, which is the honest reading of a
change that alters the SHAPE of the front of the head and touches the envelope nowhere.

⚠️ **THE FRINGE WENT 44 CARDS TO 34 BECAUSE OF A CLAUSE THAT IS NOT THIS ONE.** At 44 the `cards
deep` clause read **p50 18 on g000 against a ceiling of 18** — green by nothing, on the bake with
the smallest skull, where the same card count is packed into the least area. R22's groom reads 16
there. 34 reads 17, and the row it costs is the one above: mean coherent relief 3.543 → 3.414. A
gate at its ceiling is a gate that goes red on the next round's unrelated change, and the fringe's
opacity is not what makes the front of the head opaque — `mass` and `veil` are still under it.

### R23 — the fringe, which is the part that shipped

🎯 **OBSERVATION 4 OF THE REFERENCE — "a flat plane at its own angle from the side masses, with a
clean lower edge at eyebrow level" — AND THIS GROOM HAD NO FRINGE AT ALL.** Every layer grew from
one field, that field runs radially forward from the whorl and is then swept sideways by the part,
and what the front of the head had was the front of the side masses. Three keys make it its own
element, all on the appended `fringe` entry in `HAIR_LAYERS`:

  - **`front`** restricts `sample_roots` to the frontmost 34% of the region's depth AND to faces at
    or above `frame.forehead_z`. The second half matters: a root on the TEMPLE is inside the front
    third and is not in the fringe, and a card grown down from one lands on the cheekbone.
  - **`fringe`** replaces the radial and part terms in `root_direction` with down-plus-forward
    (`FRINGE_FORWARD` 0.45). It is the only layer that does not use the growth field.
  - **`graduation: 0.0`** with `cut_scatter: 0.12` gives it the one deliberate edge in the groom.

🚩 **`frame.hairline_z` IS NOT THE FOREHEAD HAIRLINE, AND THE FIRST TWO FRINGE BUILDS WERE DESTROYED
BY ASSUMING IT WAS.** It is `low.z + HAIRLINE_LIFT · height` over the WHOLE scalp region, and the
region reaches the NAPE — so at g050 it is **1.4970 while the figure's own `eyebrow001` mesh spans
1.5568–1.5672**. The plane every layer's cut is measured from sits 60 mm BELOW the brow, at the
level of the nose bridge. Harmless for a layer cut 0.35–0.88 of the region's height below it,
because those numbers were fitted against that plane; fatal for a fringe. Cut 0.13 below it, the
plate showed a curtain across both eyes and down to the mouth. `ScalpFrame.forehead_z` is the
lowest the region reaches at the FRONT and is the hairline in the sense a hairdresser means it:
**1.5615 at g050, which lands on the eyebrow mesh**, and it is derived from the region so it travels
the identity axis like everything else here. It is printed on the `region` line of every build.

| the fringe's own cut line, g050 | tips |
|---|---|
| first build, `cut` 0.13 below `hairline_z`, graduation and jitter live | z 1.5356 ± 35.3 mm, spread 95.7 mm — over both eyes |
| graduation off, jitter to 0.12 | z 1.4828 ± 7.9 mm — a clean line, still at the mouth |
| **`cut` 0.02 below `forehead_z` — shipped** | **z 1.5688 ± 12.0 mm at 44 cards, 1.5697 ± 13.3 at the 34 that ship — the brow** |

The whole sweep's fringe lands on its own identity's brow without a constant being touched: tips at
**1.4970 / 1.5343 / 1.5697 / 1.6010 / 1.6355** for g000 → g100, against `forehead_z` of
**1.4954 / 1.5287 / 1.5615 / 1.5946 / 1.6290** — the derivation travels, which is the whole reason
it is taken off the region rather than typed in.

Rendered at `front`, `three-quarter`, `side`, `back` and `top` on `packages/testbed/src/hair.html`
at every one of those three, which is the only reason the second one was caught: **its numbers were
better than the third's** — a 7.9 mm tip band against 12.0 — and it was a blindfold.

⚠️ **WHAT THE FRINGE DID NOT FIX, NAMED SO THE NEXT ROUND DOES NOT RE-DISCOVER IT.** The portrait
plate still carries (a) a hard-edged card slab across the character's-right cheekbone, (b) a tangle
of straps crossing the THROAT where the two sides' cards sweep round the jaw and meet, and (c) the
patent-leather crown. None of them is a lock-relief problem and none of them is measured by any
clause in `verify_glb.mjs`. (b) is the strongest tell at portrait range.

🚩 **AND THE `back` PLATE IS THE WORST OF THE FIVE, WHICH IS OBSERVATION 6 UNADDRESSED AND A GATE
BLINDNESS UNDER IT.** The reference says volume at the crown falling to a tucked-under line at the
neck. This groom does the opposite: the back mass is one flat swept slab crossed by a single long
diagonal card, and there is **bare neck visible through a hole beside the nape**. `no skin on show`
is green on all five bakes at 0.0–3.1 mm², because that clause casts at the CRANIUM — it is the
scalp-coverage measurement wearing a judge's camera, and the nape is below the region it samples.
So the one plate with a hole in it is the one plate no clause can see. Whoever takes observation 6
needs a back-view clause that samples the NECK before they need a tuck.

### R22 — the geometry half, and why it did not ship

🚩 **R22 BUILT THE GROOM R21 ASKED FOR, MEASURED IT, LOOKED AT IT, AND PUT IT BACK.** The ask was
*fewer, wider, more opaque cards in visible locks*. Everything except the last word landed, the last
word is the one the round was for, and the trade that came with it was not worth making blind. The
whole thing is recorded here because the next round should not pay for it twice.

**What the variant was.** 462 → **404 cards**, every layer 4% wider, `surface` (2,3) → **(1,2)** —
the last strip on a face-framing layer whose mean alpha starts with a 3 — `TIP_WIDTH_FRACTION`
0.62 → **0.42**, `CLUMP_POWER` 1.7 → 1.55, `clump` up 0.06–0.08 on every visible layer, and a new
per-lock radial relief (`hair_cards.LOCK_RELIEF_M`). Measured this session on g050, both builds,
same commands:

| | 462 cards | 404-card variant |
|---|---:|---:|
| cards deep, worst judge view p50 / p90 (`verify_glb.mjs`) | 14 / 25 | **13 / 22** |
| card tips over card roots (ceiling 0.95) | 0.829 | **0.817** |
| a tip's height step to its 5 nearest | 6.4 mm | 7.1 mm |
| bare cranium, worst judge view (ceiling 60 mm²) | 4.9 mm² | 9.2 mm² |
| C1 mean transmittance (ceiling 0.28) | 0.2148 | **0.1973** |
| C2 share over T > 0.5 (ceiling 28%) | 20.55% | **18.72%** |
| C3 the mass (ceiling 0.10) | 0.0812 | **0.0809** |
| C4 the curtain (ceiling 0.35, RED both ways) | 0.4103 | **0.4013** |
| coherent lock relief (`hair_locks.mjs`, floor 5.0 mm) | 3.12 mm | 3.11 mm |
| `HairDynamics.selftest.mjs` | **32/32** | **30/32** |
| triangles | 15,912 | 14,056 |

⚠️ **ALL FOUR TRANSMITTANCE CLAUSES IMPROVED WHILE 58 CARDS LEFT** — the opposite of R21's honest
cost, and bought by the strip move. **AND IT TOOK A GREEN PHYSICS GATE RED.** `HairDynamics`
clause S (*the worst tip moves under 0.5 mm in the quarter second after 6 s of held head*) reads
**2.7212 mm**, and its own `hairdefect=kinematic` control reads 2.518 mm against 24.02 mm green.
Isolated by rebuilding one lever at a time, 30/32 on every one of them: **not the lock relief**
(built at 0), **not the clump** (built at R21's values), **not the tip taper** (built at 0.62). What
is left is the card count and width themselves — the change the round exists to make. That is where
the next agent starts, and it is one build from an answer.

🚩 **AND THE LOCKS NEVER ARRIVED, IN EITHER BUILD.** `tools/figure-pipeline/hair_locks.mjs` measures
the outer envelope's azimuthal corrugation and separates the ridge that runs down the head from the
per-card scatter. **The groom's outer surface is 10.03–11.69 mm of radius between its p50 and its
p85 inside one 3°×30 mm bin** — an eleven-millimetre-thick cloud of cards — and no lock relief that
looks like hair is louder than that. Built and measured, a pure sixteen-lobe corrugation on every
non-root layer: none 3.11 mm of ridge, ±25 mm 4.13, ±45 mm 6.22. The last clears the 5.0 mm floor,
fails `cards gather` at 0.981, and renders as storm damage. **The lever for the next round is the
SCATTER, not the relief.** `docs/RED-GATES.md` carries the declaration.

⚠️ **TWO EARLIER VARIANTS WERE REJECTED BY EYE AND THEIR NUMBERS WERE BETTER.** 384 cards at +8%
width with `clump` to 0.85 and `CLUMP_POWER` 1.35 measured better depth and better gathering and
turned the hem into hard vertical slabs with square ends — the tapering tips, the one thing every
blind critic in this phase has praised, were gone. A wider card keeping the same fraction of its
width at the tip is a wider STRAP, and clumping stacks the straps; that is what forced
`TIP_WIDTH_FRACTION` to 0.42 in the variant above. R21's own bound arriving on a different lever,
third round running.

```bash
node tools/figure-pipeline/hair_locks.selftest.mjs          # PASS — 38 assertions
node tools/figure-pipeline/hair_locks.mjs --map             # the field, looked at
```

🎯 **THIS IS THE 462-CARD SWEEP AND THE ROUND THAT MADE IT DID NOT TOUCH THE ATLAS — 28.7% FEWER
CARDS, 12–18% WIDER, AND THE FOUR SHEETS ARE BYTE-IDENTICAL TO THE 648-CARD BUILD's.** Round 20
proved the sheet's strand structure cannot survive the sampler at this card size and redirected the
phase: alpha's remaining job is the silhouette and the wisps, so the cards get to be fewer, wider
and more opaque and the strand frequency moves into the shading. A card's width is the lever on both
halves of the collapse — the lod a strip is read at is `log2(128 / its scene-pass width)`, and the
stack's depth is total card AREA over the footprint, which only falls when the area does. Measured
on `alive.html` at the shipped framing, before and after:

| | 648 cards | 462 cards |
|---|---:|---:|
| cards deep between the eye and the face, p50 / p90 (`hair_layers.mjs`) | 9 / 64 | **8 / 48** |
| lod the sampler reads, portrait p50 (`hair_lod.mjs`, scene pass) | 2.011 | **1.925** |
| one card's width, CSS / scene-pass px | 55.3 / 36.5 | **59.6 / 39.4** |
| C4 the curtain, transmittance where 1–2 cards deep over the face (ceiling 0.35) | 0.4516 | **0.4098** |
| C3 the mass, transmittance where 3+ deep (ceiling 0.10) | 0.0943 | **0.0808** |
| C1 mean transmittance (ceiling 0.28) | 0.2060 | 0.2144 |
| C2 share over T > 0.5 (ceiling 28%) | 19.44% | 20.56% |
| triangles | 21,864 | **15,912** |

⚠️ **C1 AND C2 WENT THE WRONG WAY BY A POINT AND STAYED GREEN, AND THAT IS THE HONEST COST.** Fewer
cards is less coverage at the thin edges of the groom. What paid for the rest is the strip
reassignment in `hair_cards.HAIR_LAYERS` — `body` (2,3) → (1,2) and `surface` (3,4,5) → (2,3) — so
the two layers that are the frontier over the cheek no longer carry a strip whose mean alpha starts
with a 3. **C4 IS STILL RED AGAINST ITS 0.35 CEILING** and was red before this round at 0.4516; it
moved 0.042 the right way and is reported rather than widened.

🚩 **AND THE FIRST ATTEMPT WENT TWICE AS FAR AND WAS REJECTED BY EYE.** 336 cards at 1.36× the width
measures better on every number in the table above — depth 7/40, lod 1.664, 49.6 scene-pass pixels a
card, and the best delivered structure any build has recorded at 0.734 STACKED runs per card against
the shipped 0.599 — and at 49.6 px a card's own QUAD becomes a readable shape: the crown grows
hard-edged bright parallelograms two to three times the shipped groom's, and a dead-straight card
border runs from the crown past the jaw, which is verbatim the launch blocker a blind critic named
at 3.6. The facets exist in all three builds — they are cards catching the key light — so the bound
is not "wide cards make facets", it is that a card's edge treatment is a fixed share of its
128-texel strip, so magnifying the card magnifies the facet with it. `verify_glb.mjs`'s card-border
clause cannot see this: it measures the boundary's raggedness on the ATLAS, in texels, and the atlas
did not change. `hair_cards.HAIR_LAYERS` carries the table.

🎯 **THE 648-CARD SWEEP THAT PRECEDED IT, KEPT BECAUSE THE PATTERN IS THE POINT. Every one of its
rows was re-measured too, because the round that made it 648 changed the atlas as well as the
counts.** `hair_texture.py`'s strip 1 stopped
being a solid rectangle — see its "sub-strands" header — and a card carrying it now transmits
0.380 where it transmitted 0.163, so `mass`, `underlayer` and `veil` went 84/58/76 to 147/102/133
to buy that opacity back by STACKING instead of by per-card alpha. Every `verify_glb.mjs` clause is
green on all five: the gather ratio improved again to 0.748–0.798 against the 0.95 ceiling, the cut
line tightened to 5.3–5.5 mm, cranium coverage is 99.98–100.00% and the worst judge view sees
5.5–6.4 mm² of scalp against a 60 mm² ceiling.

⚠️ **AND THE COST OF +31.6% TRIANGLES IS NOT MEASURED IN THIS TABLE.** `tools/spikes/alive-perf.mjs`
refuses to report on this machine — *"trackTimestamp patch did not take — refusing to report wall
clock as GPU cost"* — and the cost clause in `HairMaterial.selftest.mjs` runs on its own
7,224-triangle scene rather than on the groom, so neither instrument answers the question. It is
one draw call and no extra pass either way; the number is owed.

🎯 **THE 484-CARD SWEEP THAT PRECEDED IT, KEPT BECAUSE THE PATTERN IS THE POINT — every round that
added a layer re-measured all five bakes rather than the one it was looking at.** Punch-list 3.22 added the 84-card `mass` layer; the round
after it added the 76-card `veil` and moved `underlayer`, `body` and `surface` one strip denser, all
of it aimed at the SIDE CURTAIN (`hair_cards.HAIR_LAYERS`, and
`tools/figure-pipeline/hair_opacity.mjs` C4 for what it is for). Re-measured across all five bakes
this round, every clause green on every bake:

  - the cut line tightened again, 7.7–8.1 mm to **6.5–6.8 mm**, for the reason 3.22's did — another
    layer whose tips land on their own plane inside the others.
  - the gather ratio IMPROVED on all five, 0.810–0.884 to **0.763–0.846** against the same 0.95
    ceiling: `veil` clumps at 0.70, so it pulls its cards into the sixteen shared locks harder than
    the layers whose place it takes in the stack.
  - g100 is unchanged where it matters — cranium hidden 99.93% to 99.95%, largest exposed patch
    4.5 mm² either way, worst judge view 21.2 mm² either way, all far inside their ceilings. That
    bake is the one an interior layer historically breaks, and this one does not touch it.
  - clearance is 3.500–3.505 mm on all five and the build's instrument still agrees with the gate's
    to the last digit, which is the property the next block is about.

🎯 **THE TWO CLEARANCE ROWS ARE NOW THE SAME ROW, AND THEY USED TO DIFFER BY UP TO 0.9 mm.** The
build aimed at 3.5 mm against a 3.0 mm gate floor to cover a disagreement between its own
instrument and the gate's; when 3.6.1's cut made the cards long enough to reach the ear and the
brow the disagreement outgrew the margin and g075 and g100 failed the floor at **2.945** and
**2.584 mm**. Both halves were then found and removed rather than budgeted for: `BVHTree.
FromPolygons` was being handed the base mesh's QUADS and picking its own diagonals where the
exporter writes `calc_loop_triangles()`, and `find_nearest`'s FACE normal decides the sign of a
distance differently from the gate's interpolated vertex normal inside the fold of an ear (g000
read +3.502 mm one way and −5.267 mm the other). `hair_cards.BodySurface` now uses the exporter's
triangles and the gate's sign rule, and the two instruments agree in the third decimal on all five.

⚠️ **The coverage row is not comparable with the one this table used to carry.** It read
99.14–100.00% then and it reads 99.95–100.00% now, and the two are different measurements: the old
one asked 257 cranium VERTICES along their own normals and blended the alpha; this one samples the
cranium's SURFACE at 4 mm and applies the material's cutoff. The old figure passed a groom with a
bald patch you could not miss — see "the gate that passed on a hole" below.

### Six things that were silent failures while this was being built

🚩 **UNSIGNED DISTANCE IS NOT A CLEARANCE.** The first build tested `BVHTree.find_nearest`'s raw
distance against a 3 mm floor and reported a nearest approach of **3.015 mm** while **161 vertices
sat inside the skull** — a card that has travelled through the head is 17 mm from the nearest
surface, comfortably outside the floor. `verify_glb.mjs` caught it off the exported file because
its clause signs the distance with the body's own interpolated normal. This is the clearest case
this repository has of why a gate reads the artefact and not the script.

🚩 **THE BUILD AIMED AT 3.5 mm AGAINST A 3.0 mm FLOOR, AND THE HALF-MILLIMETRE WAS COVERING A BUG
RATHER THAN BUYING SLACK.** Blender's `BVHTree.FromPolygons` over the base mesh's QUADS and the
glTF exporter's `calc_loop_triangles()` do not always pick the same diagonal — measured: a build
that converged to 3.015 mm by its own instrument read **2.737 mm** off the file. 3.6.1 removed it
at source; see the two identical clearance rows in the table above and `hair_cards.BodySurface`.

🚩 **A COVERAGE MEASUREMENT THAT IGNORES THE CUTOUT MEASURES NOTHING.** A hair card is a solid
quad; its hair is in the alpha channel. The gate fires a ray along every cranium vertex's normal,
samples the embedded albedo at each hit's barycentric UV, and multiplies the transmittances. The
first version of the sampler divided `decodePng`'s output by 255 — it returns normalised floats —
and reported the sheet's mean alpha as **0.0020** and the groom's coverage as **2.54%**.

🚩 **`matrix_world` THEN `matrix_parent_inverse` IS BACKWARDS.** Blender composes world as
parent · parent-inverse · basis, so setting the world matrix and then changing the parent inverse
silently moves the object. Set the parent, set the inverse, set the world matrix last.

🚩 **`hash()` ON A `str` IS SALTED PER PROCESS, and the layer seeds were derived from it.**
`PYTHONHASHSEED` is random unless it is set, so the groom was a different groom every run while
`assets/hair/manifest.json` claimed a seed reproduced it exactly. It surfaced as a rebuild of an
identity that had cleared 3.517 mm coming out with a card **5.250 mm inside the skull** — the build
failed, correctly, on a command that had passed minutes earlier. The layer's INDEX is stable.

🚩 **BAKING TANGENT SHATTERS THE CARD TOPOLOGY, so the groom does not.** `docs/research/hair.md`
§6.1 asks for the fibre direction as a baked vertex attribute. It was tried: `export_tangents=True`
makes Blender's exporter split vertices at tangent discontinuities, and the clean quad-strip
components — 254 of 13 rings each at the time, plus 2 cap shells of 564 triangles — came out as
**284 ragged components with ring counts of 2/3/6/7/9/10/11/13/63 and the cap in 12 fragments**. That destroys the property
the card-count gate stands on and buys nothing: a card's UV is axis-aligned **by construction**, so
the UV tangent is exactly the card's U axis and the strand direction is its bitangent, with no
degeneracy anywhere on the mesh. What has to be protected is that the UV *stays* axis-aligned, and
`verify_glb.mjs` asserts exactly that instead — **484 of 484 cards on exactly two u columns**.

### The strand atlas

`hair_texture.py`, numpy, no painting — the wardrobe's licence finding (`docs/BRIEF.md`, Fab EULA
§6(b)(iii), every sampled listing `isAiForbidden: true`) applies to a hair texture exactly as it
does to a garment. One 1024² sheet, eight vertical strips, four channels:

| file | channels | in the GLB? |
|---|---|---|
| `albedo.png` | RGB sRGB + A coverage | embedded, `baseColorTexture` |
| `normal.png` | tangent-space RGB, the strand's own cylinder | embedded, `normalTexture` |
| `flow.png` | RG strand tangent, B root-to-tip, A strand id | sidecar — glTF has no socket for it |
| `depth.png` | grey, depth within the bundle | sidecar |

Coverage per strip, measured AFTER the 0.5 cutout the MASK material applies, at the shipped seed:
**s0 0.997 · s1 0.665 · s2 0.635 · s3 0.548 · s4 0.469 · s5 0.404 · s6 0.232 · s7 0.139**. Strip 0
is the scalp cap's and the build FAILS below 0.97 on it; strips 6–7 are the wisps that break the
silhouette. ⚠️ Reporting a strip's MEAN alpha instead of its post-cutout coverage said the cap
covered 99.6% of its texels when the renderer was going to keep 88%.

### The two red-proof flags

Both are `RED PROOF ONLY` and both write somewhere that is not `assets/hair`:

    --no-hair-collision   the guide integrator's collision response and the final clamp, off.
    --no-hair-cap         the groom without its scalp cap shells.

```bash
$BLENDER --background --python tools/figure-pipeline/build_figure.py --python-exit-code 1 -- \
  --gender 0.5 --output /tmp/red/body.glb --hair bob01 --hair-dir /tmp/red/nocollide \
  --no-hair-collision
node tools/figure-pipeline/verify_glb.mjs /tmp/red/nocollide/bob01/g050.glb
#   FAIL clearance      nearest signed approach -77.974 mm, 621 vertices inside the body
```

```bash
$BLENDER --background --python tools/figure-pipeline/build_figure.py --python-exit-code 1 -- \
  --gender 0.5 --output /tmp/red/body.glb --hair bob01 --hair-dir /tmp/red/nocap --no-hair-cap
node tools/figure-pipeline/verify_glb.mjs /tmp/red/nocap/bob01/g050.glb
#   FAIL scalp cap        0 non-ribbon component(s)
#   ok   scalp coverage   98.53% of 5324 cranium surface samples at 4 mm hidden (floor 97%)
#   FAIL no bald patch    largest connected exposed patch 226.7 mm² (ceiling 50 mm²)
#   FAIL no skin on show  worst view 'back' at 309.7 mm² of bare cranium (ceiling 60 mm²)
```

🎯 **READ THE THIRD LINE OF THAT OUTPUT: THE MEAN COVERAGE CLAUSE STILL PASSES A GROOM WITH NO
SCALP CAP AT ALL.** 98.53% against a 97% floor, on a build whose top view is bare skin between the
cards. That is not a threshold set too low — it is the wrong statistic. A hole is LOCAL, and no
average over a whole cranium can see one; 3% of a cranium gathered into one place is the hole and
3% spread evenly is a groom that is slightly thin everywhere. The mean survives as a report and the
two clauses under it are what fail.

The clauses the two flags do NOT reach — the card counter, the axis-aligned UV rule, and both
instruments' own arithmetic — are proven against known answers, with no Blender and in 0.2 s:

```bash
node tools/figure-pipeline/hair_geometry.selftest.mjs   # PASS — 22 assertions
```

A signed distance is checked against a SPHERE, where the answer is `|p − centre| − r` exactly on
both sides; a transmittance against a stack of cards of known alpha, where the answer is a product;
and the card counter against a soup with a deliberate WELD in it, which is the failure neither
build flag can produce.

### The card border, and the gate that passed on a hole

A blind critic shown `packages/testbed/src/hair.html` named three launch blockers that every
number above had passed. Two of them were the atlas's and the third was the target's.

🎯 **THE RAZOR ACROSS THE FACE WAS DRAWN BY A NEIGHBOURING STRIP.** In three-quarter view a
dead-straight border ran from the crown past the jaw and sliced the eyebrow, the eyelid and the
cheekbone. Measured off the shipped `albedo.png` at the 0.5 cutoff it exports with: **strip 1's
left boundary had a standard deviation of 0.000 px over 1,020 of 1,024 rows, and 1,895 of its
2,048 border texels were kept.** Strip 1 is the innermost, face-framing layer's strip and none of
its own strands were there — the CAP strip's were, spilling across the boundary because
`draw_strand` clamped its columns to the ATLAS rather than to the strand's own strip. Fixed at
source three ways: per-strip containment (the cap wraps inside strip 0, everything else clips), a
3 px gutter no strand's feather may enter, and a 20 px edge band whose strands are wisps that lean
inward across the card. After: **0 border texels kept, worst card strip 7.210 px over 943 rows.**

| clause | what breaks it at source | red | green |
|---|---|---:|---:|
| `card borders` | `"strip_span": strip_width * STRIP_COLUMNS` | 4,066 opaque texels | 0 |
| `card borders` | `STRIP_GUTTER_PX = 0.0` | 234 opaque texels | 0 |
| `border is hair` | `"strip_span": strip_width * STRIP_COLUMNS` | 0.000 px / 1,020 rows | 7.210 px / 943 |
| `no bald patch` | `--no-hair-cap` | 226.7 mm² | 0.0–5.5 |
| `no skin on show` | `--no-hair-cap` | 309.7 mm² ('back') | 5.8–10.1 |
| `no skin on show` | `"part": 1.00, "crown": 0.00` on the `root` layer | 216.8 mm² ('front') | 5.8–10.1 |

⚠️ **`border is hair` does NOT fire on `EDGE_BAND_PX = 0.0`** — that measures 4.507 px, above the
3 px floor. Said plainly because a gate should be described by what it catches: the floor is set
against the defect (0.000 px), not against every groom that is less good than this one.

🚩 **AND THE COVERAGE CLAUSE HAD THREE HOLES, NOT A LOW THRESHOLD.** It read 99.14–100.00% on a
groom with a lit scalp at the parting. It asked 257 cranium VERTICES, 10–20 mm apart on this base
mesh, so a two-centimetre patch fit between them; it built a transmittance PRODUCT out of raw alpha
where the material masks at 0.5, so three cards at alpha 0.4 read as 78% covered when the renderer
draws three holes; and it was a MEAN, which cannot see a hole by construction. All three are fixed,
and the fix found the defect immediately — **229.1 mm² of bare cranium at (0.032, 1.633, 0.105),
seen from the front.** The clause that found it casts from the five camera angles
`packages/testbed/src/hair.js`'s `VIEWS` defines, because the normal ray from a forehead sample
goes UP through the cards over the crown and a critic is looking FORWARD between them.

### Looking at it

```bash
npm run dev                                            # http://localhost:5173/src/hair.html
node tools/figure-pipeline/hair_shots.mjs --out captures/hair   # the same five plates as PNGs
node tools/figure-pipeline/hair_opacity.mjs            # is the mass opaque? on alive.html
node tools/figure-pipeline/hair_tips.mjs --arms stochastic,cutout,blend   # does it RESOLVE?
```

Five fixed angles and the four sheets. The gate proves 484 cards clear the skull; it is
structurally blind to whether they read as hair, which is LEARNINGS §1.2 and is why the page
exists.

🎯 **AND `verify_glb.mjs` IS BLIND TO ONE THING IN PARTICULAR, WHICH IS WHY `hair_opacity.mjs`
EXISTS.** Punch-list 3.22's blind critic: *"Neither hair nor a wig — a stocking… you can see the
bald skull's silhouette through it, you can see her far-side ear through it."* Every clause in this
section was green over the top of that, because opacity is a property of the rendered frame and
every clause here reads the exported bytes — the cranium-coverage clause comes closest and casts
only at the SCALP, so it never sees the two thirds of the groom that hang below the hairline.
`hair_opacity.mjs` steps the emissive of everything that is NOT hair on `alive.html` and measures
how much of the step survives the groom, per pixel, inside a mask rasterised from the groom's own
triangles. Measured on the shipped groom before the fix: **0.3989 mean transmittance at portrait,
37.17% of the hair's screen area passing more than half of what is behind it.** After: 0.2488 and
24.30%, and 0.0807 through the mass proper against 0.2476. `hair_shots.mjs` drives the page's own `window.hairShot`, which awaits `renderAsync`, so a
before/after pair is two states of one framing rather than two framings. ⚠️ It is NOT the hair
shader — punch-list 3.5 owns the anisotropic strand model and runs after this. What is drawn is the
geometry under a plain Principled material.

🎯 **AND `hair_opacity.mjs` IS ITSELF BLIND TO ONE THING, WHICH IS WHY `hair_tips.mjs` EXISTS.** It
asks how much of what is behind the groom reaches the camera, which is a question about WHERE THE
CARDS ARE. The same critic's other two complaints are not that question: *"the tips are dither
confetti"* and *"there is a circuit-board texture artifact sitting on the cheek at portrait range"*
are about how a card's coverage RESOLVES, and a groom can be perfectly opaque and still hand a
viewer salt and pepper. `hair_tips.mjs` high-passes the converged plate — a pixel minus the mean of
its own 3x3 — and counts the share of a region that disagrees with its neighbourhood by more than
8 code values, over masks cut from the same CPU raster, at one page load per `?hairoit` arm.

Measured this session, portrait, 24 converged steps, masks intersected with a geometric-stability
test so that no statistic is about a silhouette:

| region (px)                       | `stochastic`, ships | `cutout` | `blend` |
|-----------------------------------|--------------------:|---------:|--------:|
| tips — 1 card deep over sky, 11,539 |          **5.00%** |   2.57%  |  1.15%  |
| curtain — 1–2 deep over skin, 115,377 |      **16.02%** |  12.47%  |  4.08%  |
| mass — 3+ deep over skin, 195,885 |          **6.56%** |   4.66%  |  1.12%  |
| skin — no hair over it, 314,590   |               1.20% |   1.20%  |  1.20%  |
| backdrop — nothing at all, 225,478 |              0.31% |   0.31%  |  0.31%  |

🚩 **THE `skin` ROW IS 1.20% ON ALL THREE ARMS TO THREE FIGURES, AND IT IS WHAT MAKES THE OTHER
ROWS MEAN SOMETHING.** Bare skin does not care which transparency arm the groom is drawn through.
So the four-to-six-fold spread everywhere hair IS belongs to the coverage decision and to nothing
else — same geometry, same atlas, same framing, same 24 steps. The shipped arm is the worst of the
three in every row that contains hair, and the worst region is not the tips: it is the CURTAIN, the
one-to-two-card layer lying over the cheek, at 16.02% against sorted alpha's 4.08%. Crop that
region at 6x from the two plates and the two named artefacts turn out to be one: under `blend` the
card reads as clean diagonal strand stripes, and under `stochastic` the same stripes are quantised
into an axis-aligned dot pattern — which is what "circuit board on the cheek" and "dither confetti"
are both describing.

⚠️ **THE FIX IS NOT IN THIS DIRECTORY.** The coverage decision is `packages/core/src/render/
HairOIT.js`'s, and `--defect flat` says the atlas is not the whole story either: an opaque,
texture-free groom still reads 3.81% at the tips and 10.47% at the curtain, so a third of the
curtain's speckle survives with no atlas at all. What this tool contributes is the number, the
attribution and a red proof; `docs/RED-GATES.md` carries the rest.

### What was checked before any of this was built

MPFB2's asset packs **do** carry hair: `<user data>/hair/` holds eleven CC0 grooms — `afro01`,
`bob01`, `bob02`, `braid01`, `long01`, `ponytail01`, `short01`–`short04` — each an `.obj` of 525 to
4,237 card faces with a 2.3–4.8 MB painted diffuse, released CC0 in September 2020 by Data
Collection AB / Joel Palmius / Jonas Hauquier. They are usable and they were not used, for one
reason that is not licensing: **they carry a painted diffuse and nothing else.** No flow, no
root-to-tip, no per-strand id, no depth — the four channels punch-list 3.5's shader needs and the
only reason a card groom can carry an anisotropic highlight that follows the hair rather than the
card. A generated sheet also re-derives for a colour, a seed or an atlas size nobody has asked for
yet. The MakeHuman grooms remain a legitimate fallback if the procedural one is ever judged worse.

## Verifying

```bash
node tools/figure-pipeline/verify_glb.mjs                       # every figure AND the wardrobe
node tools/figure-pipeline/verify_glb.mjs assets/figures/x.glb  # one
node tools/figure-pipeline/verify_glb.mjs --manifest path.json  # gate against another manifest
```

Checks each GLB twice: once by parsing the GLB container's JSON chunk by hand, and once through
three.js `GLTFLoader.parse()` reading `morphTargetDictionary`. Both must show all 52 ARKit names
and all 15 OVR viseme names. Exit code is the gate for punch-list item 0.3.

It also **measures the eye geometry**, because the eyes are the only part of the figure whose
shape is load-bearing and the only part where a wrong shape is invisible in every other assertion:
the corneal dome, the anterior chamber, and the cornea material's transmission and IOR. See "The
eye is two meshes" below.

```bash
node tools/figure-pipeline/cornea_geometry.selftest.mjs
```

Sanity-checks the dome measurement itself against synthesised shapes where the answer is known by
construction — a perfect sphere must read as no dome, a dome of height *h* must measure *h*, and
noise at the asset's own 0.24 mm floor must not manufacture one. `verify_glb.mjs`'s cornea checks
stop at "no corneal shell" on both real known-bad figures, so without this the dome test itself
would never have been run in the failing direction.

### The garment clause (punch-list 9.5)

The gate used to **fail a clothed figure by construction**: `OPAQUE_MATERIAL_PARTS` was a
five-regex whitelist over `body`, the eye parts, `teeth` and `tongue`, and a garment matched none
of them, so `suit_g050` reported one problem and `layered_g050` reported three while every eye,
lip-seal and morph assertion stayed green (research §3.7).

The replacement is not a sixth regex — **a wool coat is OPAQUE and a mesh panel is MASK, and no
name pattern can know which.** A material resolves to a manifest garment by **exact id**, and the
expectation comes from that entry's `alphaMode` and its own `alphaCutoff`. A garment the manifest
does not list still fails as unrecognised; falling through to a pass would make the gate weaker
for clothed figures than for nude ones.

It also asserts the hide masks on the body: every `_HIDE_*` attribute belongs to a declared
garment, and none of them is degenerate (all-zero hides nothing; near-all erases the figure).
Measured on `assets/wardrobe/body/g050.glb`: 2,738 / 2,574 / 2,536 of 14,517 vertices, 18.9% /
17.7% / 17.5%.

Both directions are proven red, and the end-to-end version of the one the punch list names is a
real build rather than a mock:

```bash
# 1. build the suit as a genuine cutout, by pointing the build at a manifest that says MASK …
$BLENDER --background --python tools/figure-pipeline/build_figure.py --python-exit-code 1 -- \
  --gender 0.5 --output /tmp/cutout_body.glb --garment female_casualsuit01 \
  --wardrobe-manifest /tmp/cutout_manifest.json \
  --hide-mask-attribute --garment-fragment-dir /tmp/cutout_fragments

# 2. … then verify it against the SHIPPED manifest, which says OPAQUE.
node tools/figure-pipeline/verify_glb.mjs /tmp/cutout_fragments/female_casualsuit01/g050.glb
#   FAIL Human.female_casualsuit01: alphaMode MASK, expected OPAQUE (manifest:
#        female_casualsuit01); doubleSided, expected backface culled
#   FAIL Humanfemale_casualsuit01 in three.js: side 2, expected FrontSide

# and the other direction, no rebuild needed:
node tools/figure-pipeline/verify_glb.mjs assets/wardrobe/female_casualsuit01/g050.glb \
  --manifest /tmp/cutout_manifest.json
#   FAIL … alphaMode OPAQUE, expected MASK; alphaCutoff undefined, expected 0.1;
#        single sided, expected doubleSided
```

`node tools/figure-pipeline/verify_glb.mjs --selftest` runs the fast version of the same decision
against known-bad manifests — an unlisted garment, a near-miss id that a `/suit/i` regex would
have accepted, both alpha directions, and three.js's dot-stripped spelling — alongside the
lip-seal selftest.

## What a built figure contains

| Object | Verts | Morphs |
|---|---|---|
| `Human` (body + head) | 13,380 | 89 — 52 ARKit + 15 OVR + 22 MS |
| `Human.teeth_base` | 3,868 | 27 interpolated |
| `Human.tongue01` | 226 | 28 interpolated |
| `Human.eyelashes01` | 250 | 27 interpolated |
| `Human.eyebrow001` | 124 | 49 interpolated |
| `Human.high-poly` (eyeball globes) | 552 | 8 interpolated |
| `Human.cornea` (corneal shells) | 512 | 8 interpolated |
| `Human.rig` | — | `game_engine` armature |

glTF reports 14,517 vertices for the body because the exporter splits vertices at UV and normal
seams. The 13,380 figure is the Blender-side count and is what the morph targets index. The same
splitting is why the eye meshes read 552 and 524 in a loader against 552 and 512 in Blender.

### The eye is two meshes, and that is deliberate

MakeHuman ships two eyeball proxies. The build uses `high-poly`, which is two nested shells per
eye, because `docs/research/eyes-and-lighting.md` §1 states a **geometry contract** for cornea
refraction — "a distinct dome at the front to represent the cornea" — and the `low-poly` proxy has
none. Measured on figure_g050, front-of-shell against a sphere fitted to the sclera alone:

| proxy | verts/eye | shells | front cap proud of the sclera sphere | that fit's RMS |
|---|---|---|---|---|
| `low-poly` | 48 | 1 | **−0.015 mm** (it curves *inward*) | 0.191 mm |
| `high-poly` | 532 | 2 | **+0.688 mm** | 0.202 mm |

`build_figure.py` splits the outer shell onto its own material, because MakeHuman keeps the
cornea's UV island at alpha 0 in `brown_eye.png` and `force_alpha_modes` pins every OPAQUE part's
alpha to 1.0 — which would turn the clear shell into an opaque dome over the iris. The cornea's
material is transmissive (`KHR_materials_transmission`, IOR 1.3333) rather than alpha-blended, so
it still writes depth.

Both shells carry all eight `eyeLook*` morphs and turn together to within 0.874°. Anterior chamber
— the gap a refracted ray crosses — measures 2.150 to 2.402 mm across the sweep.

### The corneal radius of curvature — the number the eye shader is built from

The cornea has **its own radius**, separate from the globe's, and that is the R in `(n − 1) / R`.
Do not substitute the globe radius, the sclera-band radius or the chamber depth for it; on this
asset they differ by a factor of two and none of them is the refracting surface. Measured by
fitting a least-squares sphere to the **front 15° cap alone** — the same cut the dome gate uses —
on the shipped GLBs, vertices welded by position:

| figure | R anterior, left / right | that fit's RMS | globe (sclera band) R | power at n = 1.376 |
|---|---|---|---|---|
| g000 | 7.644 / 7.629 mm | 0.018 mm | 15.110 mm | 49.19 D |
| g025 | 7.463 / 7.447 mm | 0.020 mm | 15.202 mm | 50.38 D |
| g050 | 7.252 / 7.236 mm | 0.025 mm | 15.295 mm | 51.85 D |
| g075 | 7.117 / 7.104 mm | 0.032 mm | 15.393 mm | 52.83 D |
| g100 | 6.910 / 6.909 mm | 0.042 mm | 15.496 mm | 54.41 D |

A human anterior cornea is 7.7–7.8 mm (48.83–48.21 D), so **this cornea is slightly steeper than
human** — 1.007× the power at g000 rising to 1.114× at g100. The material ships IOR 1.3333 rather
than the cornea's physical 1.376, which brings the delivered anterior power to 43.60–48.24 D.

Two cautions. The cap fit is only valid *inside* the dome: widen the cut to 30° and g075/g100 read
8.802 mm (RMS 0.2725) and 9.088 mm (RMS 0.3034), because the cap has walked onto the sclera. And
the clinical keratometric convention uses n = 1.3375, which would report these as 44.15–48.85 D
against a human 43.27 D — the same conclusion on a different scale. Never compare across conventions.

```bash
node docs/eye-optics-claims.selftest.mjs
```

Re-measures the radius from the GLBs and asserts that this table, `PROGRESS.md` and `LEARNINGS.md`
still agree with the asset. It exists because the radius was recorded nowhere for two phases, and
in its absence `PROGRESS.md` derived the corneal power from the chamber depth and the globe radius
— neither of which appears in the formula — and got the sign backwards. See LEARNINGS §1.11c.

To rebuild the superseded single-shell figure, which is what the asset gate's known-bad checks run
against:

```bash
tools/figure-pipeline/build.sh --eye-proxy low-poly.mhclo
```


## Order of operations that the build depends on

Three orderings are load-bearing, and the first two fail *silently* if swapped:

1. **Expressions before the rig.** `FaceService.interpolate_targets` looks for face parts among
   the *direct* children of the figure root. Adding the rig makes the rig that root, so the
   eyes, teeth and tongue become grandchildren and get skipped — the jaw opens and the teeth
   stay behind.
2. **Macro shape keys are baked into the geometry before export.** MPFB holds gender/age/muscle
   as live shape keys at non-zero weights. Exported as-is, the GLB's neutral pose is the
   genderless base mesh and the identity sits in eight junk morph weights.
3. **The corneal split runs after the helper strip and before the alpha pass.** After, because the
   strip works through mhclo vertex correspondences that index the basemesh; before, because the
   alpha pass is exactly what would turn the clear shell into an opaque dome.

For the same reason the build does not use `ExportService.create_character_copy` — it only
duplicates direct children, and would drop the face parts.
