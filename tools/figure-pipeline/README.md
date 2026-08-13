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
| nearest approach, build's instrument | 3.517 mm | 3.502 | 3.504 | 3.535 | 3.509 |
| nearest approach, `verify_glb.mjs` | 3.294 mm | 3.387 | 3.223 | 3.420 | 3.169 |
| cranium hidden through the cutout | 100.00% | 99.58 | 100.00 | 99.60 | 99.14 |
| fragment bytes | 2,665,684 | 2,666,024 | 2,665,420 | 2,665,840 | 2,665,800 |

Every groom is **254 cards of 13 rings each + 2 cap shells of 564 triangles**, 7,256 verts, 7,224
triangles. The four sheets are shared and written once per build: albedo 1,025,454 · normal
1,201,299 · flow 365,090 · depth 62,683 bytes. g050's fragment is sha256 `0057c8367b566c69…`, and
running the same command twice reproduces it byte for byte — which was not true until the seed bug
below was found.

### Six things that were silent failures while this was being built

🚩 **UNSIGNED DISTANCE IS NOT A CLEARANCE.** The first build tested `BVHTree.find_nearest`'s raw
distance against a 3 mm floor and reported a nearest approach of **3.015 mm** while **161 vertices
sat inside the skull** — a card that has travelled through the head is 17 mm from the nearest
surface, comfortably outside the floor. `verify_glb.mjs` caught it off the exported file because
its clause signs the distance with the body's own interpolated normal. This is the clearest case
this repository has of why a gate reads the artefact and not the script.

🚩 **THE BUILD AIMS AT 3.5 mm AND THE GATE ASKS FOR 3.0, AND THE HALF-MILLIMETRE IS NOT SLACK.**
Blender's `BVHTree.FromPolygons` and the glTF exporter triangulate the base mesh's quads
independently and do not always pick the same diagonal. Measured: a build that converged to
3.015 mm by its own instrument read **2.737 mm** off the file.

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
makes Blender's exporter split vertices at tangent discontinuities, and 254 clean quad-strip
components of 13 rings each plus 2 cap shells of 564 triangles came out as **284 ragged components
with ring counts of 2/3/6/7/9/10/11/13/63 and the cap in 12 fragments**. That destroys the property
the card-count gate stands on and buys nothing: a card's UV is axis-aligned **by construction**, so
the UV tangent is exactly the card's U axis and the strand direction is its bitangent, with no
degeneracy anywhere on the mesh. What has to be protected is that the UV *stays* axis-aligned, and
`verify_glb.mjs` asserts exactly that instead — **254 of 254 cards on exactly two u columns**.

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
#   FAIL scalp cap      0 non-ribbon component(s)
#   FAIL scalp coverage 94.27% of 257 cranium vertices hidden (floor 97%)
```

⚠️ **The coverage gap is 94.27% against 100.00%, and that is the measurement rather than a weak
threshold.** 254
cards over a scalp already hide most of it. Five points of bare crown is what a top-down render
shows as thinning hair, which is exactly how the cap came to exist — see
`packages/testbed/src/hair.html`, whose `top` view is the only one that could have found it.

The clauses the two flags do NOT reach — the card counter, the axis-aligned UV rule, and both
instruments' own arithmetic — are proven against known answers, with no Blender and in 0.2 s:

```bash
node tools/figure-pipeline/hair_geometry.selftest.mjs   # PASS — 20 assertions
```

A signed distance is checked against a SPHERE, where the answer is `|p − centre| − r` exactly on
both sides; a transmittance against a stack of cards of known alpha, where the answer is a product;
and the card counter against a soup with a deliberate WELD in it, which is the failure neither
build flag can produce.

### Looking at it

```bash
npm run dev   #  http://localhost:5173/src/hair.html
```

Five fixed angles and the four sheets. The gate proves 254 cards clear the skull; it is
structurally blind to whether they read as hair, which is LEARNINGS §1.2 and is why the page
exists. ⚠️ It is NOT the hair shader — punch-list 3.5 owns the anisotropic strand model and runs
after this. What is drawn is the geometry under a plain Principled material.

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
