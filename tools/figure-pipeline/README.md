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

Then:

```bash
node packages/core/src/wardrobe/wardrobe.selftest.mjs
```

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
normals, tapers to 0.8 mm at the hem, low-pass filters the result so it behaves like cloth rather
than paint, and reprojects. Because the shell is cut from the basemesh **at the requested
identity**, it has **no fitting step and therefore nothing to drift** — unlike 9.4's mhclo garments,
it can be regenerated for any `--gender` by re-running the command above.

The flag also writes the three `_DECENCY_*` vertex regions onto the body, which is what
`packages/core/src/wardrobe/decency.selftest.mjs` measures coverage against, and it turns
`export_attributes` on for the same reason `--hide-mask-attribute` does.

⚠️ **Leave `--foundation` off the command and the very next rebuild silently drops the four
fragments and the decency attributes**, which turns `decency.selftest.mjs` red for a reason that has
nothing to do with the code. That is why it is on the documented command above rather than in a
footnote.

Measured at g050, all four with **ZERO images**:

| fragment | faces | bytes | textures |
|---|---:|---:|---:|
| `foundation_bra` | 8,956 | 778,516 | **0** |
| `foundation_vest` | 12,134 | 1,035,740 | **0** |
| `foundation_briefs` | 5,072 | 452,836 | **0** |
| `foundation_boxer_brief` | 5,358 | 470,364 | **0** |

Build-time clearance **0.48–4.20 mm** with **0 vertices through the body**; 22–38 vertices per lower
garment are deliberately thinned where the crotch leaves no room. The build FAILS rather than ships
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
