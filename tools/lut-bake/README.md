# tools/lut-bake — the offline inputs for the skin material

Everything punch-list 3.2 needs that cannot be computed in a fragment shader.

```bash
node tools/lut-bake/bake.mjs                     # all three, default figure
node tools/lut-bake/bake.mjs curvature --figure assets/figures/figure_g100.glb
node tools/lut-bake/lut-bake.selftest.mjs        # 32 checks, both directions
```

Output lands in `out/`. Exit codes match the rest of the harness: `0` fine, `2` tool error.

| target | writes | who reads it |
|---|---|---|
| `curvature` | `figure_gNNN-curvature.png` + `.json` | **the renderer** — `SkinMaterial` fetches it |
| `lut` | `preintegrated-skin-lut.png` + `.json` | **a human**. See below |
| `micronormal` | `skin-micro-normal.png` | **a human**. See below |

> ⚠️ **Only the curvature map is loaded at runtime.** The pre-integrated table and the micro-normal
> are *generated in the browser* by `packages/core/src/material/PreintegratedSkinLut.js` and
> `SkinMicroNormal.js`; the PNGs here are for looking at and for diffing across a change. Editing
> them does nothing. Both cost single-digit milliseconds to build (the selftest prints the LUT's),
> and generating them sidesteps 8-bit quantisation on a function whose interesting range is a few
> percent wide, plus a fetch, plus a URL that has to resolve under two different Vite roots.

## The maths lives in `packages/core/src/material/`, not here

`bake.mjs` is a CLI over three dependency-free modules that the browser also imports:

- **`PreintegratedSkinLut.js`** — d'Eon & Luebke's six-Gaussian skin BSSRDF, retinted onto the look
  spec's channel ratio, and Penner's ring integral over it.
- **`SkinCurvature.js`** — cotangent-Laplacian mean curvature, UV rasterisation, seam dilation, and
  the encode/decode pair the shader has to agree with.
- **`SkinMicroNormal.js`** — tileable band-limited value noise, differentiated into a normal map.

One implementation, three readers (browser, CLI, selftest). `glb.mjs` is the eighty-line glTF
accessor reader the curvature bake needs — deliberately not `GLTFLoader`, which wants a DOM.

## The curvature map

`R = sqrt( max(H,0) / 1.0 )`, `G = sqrt( max(−H,0) / 1.0 )`, H in 1/mm, B unused, 1024².
`SkinMaterial` squares R back. The square root is not decoration: a face's broad planes sit near
0.005 /mm and a linear 8-bit encoding gives them **one** code value where the square root gives 17.

⚠️ **Load it with `NoColorSpace`.** An sRGB decode on the way in applies a 2.4 gamma to a number the
shader then squares, and every surface silently reports as far flatter than it is.

### What the bake measures, and the number that matters

Every run re-checks the estimator against inputs whose answer is known on paper before it touches a
face — spheres of 50 mm and 2 mm radius (mean curvature exactly 1/r) and a plane (exactly 0). Both
spheres come back inside 0.03%; the plane's interior is exactly zero.

Then, on `figure_g050`:

| | median | p90 | p99 |
|---|---|---|---|
| whole body | 0.01365 /mm (r 73 mm) | 0.1174 (r 8.5 mm) | 0.4029 (r 2.5 mm) |
| head only | **0.00455 /mm (r 220 mm)** | 0.1453 (r 6.9 mm) | 0.4389 (r 2.3 mm) |

🎯 **Read the head median next to the look spec's 1.0–1.5 mm scatter distance before expecting
anything from pre-integrated SSS on a cheek.** The two multiply into a *ring curvature* of about
0.006, and the table is Lambert to four decimal places there. The technique is an effect on the
alar rim, the lip border, the eyelid, the nostril and the ear — the p90-and-above of the surface —
and it is very nearly a no-op on the broad planes of a face. `SkinMaterial.js` carries the measured
consequence at the render.

The five bakes agree closely: head median 0.00437–0.00510 /mm across the gender sweep.

## The micro-normal's amplitude is solved, not chosen

The look spec gives both a tuning range (`normalScale 0.15 – 0.25`) and a target (`high-pass σ
1.5–2.1 / 255`), and those only agree for one baked steepness. `SkinMicroNormal.HEIGHT_TO_SLOPE` is
set so the σ target lands in the *middle* of the scale range rather than at one end, measured on
the browsercheck page at 3840 × 2160. Change the octaves or the steepness and the selftest's slope-
RMS pin goes red, which is the cheap warning that G4 needs re-measuring.

## Regenerating

The curvature map is per figure and has to be re-baked whenever `tools/figure-pipeline/build.sh`
changes the body mesh:

```bash
for f in g000 g025 g050 g075 g100; do
  node tools/lut-bake/bake.mjs curvature --figure "assets/figures/figure_$f.glb"
done
```

## Known limits

- **Single-buffer `.glb` only.** No sparse accessors, no external `.bin`, no draco — each throws
  rather than returning something plausible.
- **Curvature is a per-vertex quantity**, whatever the map's resolution. The body mesh is 14,517
  vertices over a 1024² map; rasterising does not invent detail, it puts a vertex attribute
  somewhere a fragment shader can read it without a custom attribute on a geometry these modules do
  not own. Folds finer than the mesh's ~7 mm vertex spacing are not in the map because they are not
  in the asset.
- **Barycentric vertex areas**, not Meyer's mixed Voronoi area. The two differ on obtuse triangles;
  this mesh is quad-derived and well-shaped, and the simpler form is checkable against the paper in
  a minute.
- **UV coverage is 62.4%** of the atlas, and the eight dilation passes fill 96,470 texels outward
  from the islands. A bilinear tap or a mip that reaches past that is reading dilated data.
