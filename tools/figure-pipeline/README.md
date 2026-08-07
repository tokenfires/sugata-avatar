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
`--no-face-parts`, `--no-microsoft-visemes`, `--keep-morph-normals`.

## Verifying

```bash
node tools/figure-pipeline/verify_glb.mjs                       # every figure
node tools/figure-pipeline/verify_glb.mjs assets/figures/x.glb  # one
```

Checks each GLB twice: once by parsing the GLB container's JSON chunk by hand, and once through
three.js `GLTFLoader.parse()` reading `morphTargetDictionary`. Both must show all 52 ARKit names
and all 15 OVR viseme names. Exit code is the gate for punch-list item 0.3.

## What a built figure contains

| Object | Verts | Morphs |
|---|---|---|
| `Human` (body + head) | 13,380 | 89 — 52 ARKit + 15 OVR + 22 MS |
| `Human.teeth_base` | 3,868 | 27 interpolated |
| `Human.tongue01` | 226 | 28 interpolated |
| `Human.eyelashes01` | 250 | 27 interpolated |
| `Human.eyebrow001` | 124 | 49 interpolated |
| `Human.low-poly` (eyeballs) | 96 | 8 interpolated |
| `Human.rig` | — | `game_engine` armature |

glTF reports 14,517 vertices for the body because the exporter splits vertices at UV and normal
seams. The 13,380 figure is the Blender-side count and is what the morph targets index.

## Order of operations that the build depends on

Two orderings are load-bearing and both fail *silently* if swapped:

1. **Expressions before the rig.** `FaceService.interpolate_targets` looks for face parts among
   the *direct* children of the figure root. Adding the rig makes the rig that root, so the
   eyes, teeth and tongue become grandchildren and get skipped — the jaw opens and the teeth
   stay behind.
2. **Macro shape keys are baked into the geometry before export.** MPFB holds gender/age/muscle
   as live shape keys at non-zero weights. Exported as-is, the GLB's neutral pose is the
   genderless base mesh and the identity sits in eight junk morph weights.

For the same reason the build does not use `ExportService.create_character_copy` — it only
duplicates direct children, and would drop the face parts.
