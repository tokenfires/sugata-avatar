# Fixed-geometry material attribution

This diagnostic starts from `a0f8ede` and keeps the shipping crop01/g050 GLB fixed. See
[the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md) for the findings and next step.
No material arm is proposed for promotion. The four existing red gates remain open.

The five arms share geometry, albedo, alpha/cutout, camera, body and lights:

- `baseline`: embedded MeshStandardMaterial, roughness 0.38, generated normal map.
- `no-normal`: baseline clone with its normal map removed.
- `rough-one`: baseline clone with roughness 1 and its normal map retained.
- `lambert`: MeshLambertNodeMaterial carrying the same color, maps and cutout settings.
- `lambert-no-normal`: the Lambert arm without its normal map.

Lambert has no specular lobe, but it also differs in diffuse energy allocation. This is a
lighting-model diagnostic, not an exact subtraction of the PBR specular term. Source hashes in
`summary.json` bind the local Three implementation inspected for that distinction. No external
literature claim or runtime HairMaterial qualification is inferred from these arms.

`capture.mjs` routes Vite's **transformed** hair-page source and exact GLB bytes. Browser hooks
hold and restore original material objects, check all geometry attributes/indices and capture
camera/head matrices and light parameters. For each view/arm, a separate detached-hair image
and an independent white-hair/black-body mask must match baseline pixel-for-pixel. All four
ablations must change actual hair pixels. A zero-cutoff mask must differ, full hair removal must
produce black, and restoration must reproduce the original PBR plate. Console, page and HTTP
errors fail the run. The renderer's capture clock must remain at time zero with one frame ID
per draw. The report records the actual Apple/Metal WebGPU adapter.

`report.json` contains 25 arm/view results. Its luma is a weighted sum of **sRGB-encoded channel
values**, measured only at fully covered white mask pixels. This is neither linear radiance nor
an appearance score; no acceptance threshold is attached. `summary.json` also expresses the
same values on the 0–255 code scale and hashes every captured image and relevant source file.
The native files retained here include all 25 ordinary material plates and five three-quarter
control plates. Other control images remain under ignored `tmp/` and are hash-bound.

The first run passed its controls. Explicit assertions on the ablation parameters were then
added and the capture was repeated serially. `first-image-hashes.json` preserves the first run's
100 images; `summarize.mjs` requires the repeat to match every one byte-for-byte. It also compares
the five baseline plates with the prior narrow-density experiment's shipping captures. These
controls pass in `validation.txt`. Both GPU jobs exited before checkpointing.

Replay from the repository root, preserving the scripts' tested relative imports:

```sh
mkdir -p tmp/hair-sep24/material-attribution
cp docs/evidence/hair-2026-09-24/material-attribution/*.mjs tmp/hair-sep24/material-attribution/
cp docs/evidence/hair-2026-09-24/material-attribution/first-image-hashes.json tmp/hair-sep24/material-attribution/
node tmp/hair-sep24/material-attribution/capture.mjs
node tmp/hair-sep24/material-attribution/summarize.mjs
```

The summary's historical comparison requires the preceding checkpoint's baseline captures at
their recorded scratch paths; replay that checkpoint first if they are absent. Changed sources,
assets, browser rendering or dependency versions may require fresh evidence instead of bypassing
an exact-image assertion. `manifest.json` hashes this archived evidence. No full runtime suite,
geometry verification, motion or cost run is claimed for this fixed-geometry diagnostic.

The white highlights survive normal-map removal and largely disappear under high roughness or
Lambert, while the angular plates remain. Runtime HairMaterial deliberately uses fibre lighting
and a different normal; its quality must be checked in its own path. Public Avatar currently
supports bob01/bob02, not this experimental crop style. The next bounded step returns to the
supported bob and its real coverage path.
