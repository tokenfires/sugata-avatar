# Source stages of the original bob

The isolated rebuild has **exact geometry correspondence with the preserved original fixture**. This permits tracing the original bends through the generator. It does not establish an improved hairstyle.

## Correspondence and provenance

Blender5.2.2LTS, build `d13f752e3b9c`, ran from a verified cached read-only disk image with an isolated profile and cached MPFB2.0.17 dependencies. No application installation, download or production asset write was needed. The [overnight checkpoint](../../../OVERNIGHT-2026-09-29.md) records the mount, dependency pin, command and cleanup obligation.

`tools/critic/trace-bob-authoring.py` calls original production functions once in their original order, retaining RNG draws. Observer wrappers record the grown/cut guide, pre-clearance clump blend, post-clearance guide, ribbon rings and before/after vertex clamp. All496cards are recorded. The pre-clearance blend is reconstructed by the same expression without RNG or mutation.

The separate `node tools/critic/analyse-bob-authoring.mjs` confirms exact equality with `tools/figure-pipeline/fixtures/bob02-g050-original.glb` for all positions, normals, both UV sets, joints, weights and indices, as well as nodes, skins, scenes, inverse bind matrices and lock extras. The trace's post-clamp coordinates map exactly to exported positions with `[x,z,−y]`, identity object matrix and card vertex base652. The rebuilt exporter reports5.2.40 and the original5.2.39; full GLB bytes are not claimed equal.

The accepted asset additionally contains post-export edits. Direct comparison shows that the six cards below have **zero post-export vertex changes**, allowing these particular trace witnesses to describe their accepted authored geometry.

## Specific witnesses

Angles are between successive guide segments. Each entry is that card's maximum, which can occur at different rings across stages; this is a shape diagnostic, not an appearance score.

| Card / layer | Grown and cut | Blended before clearance | After guide clearance | After ribbon vertex clamp |
| --- | ---: | ---: | ---: | ---: |
|276 body|4.74°|4.32°|4.32°|20.53°|
|281 body / nape hook|14.65°|49.26°|49.26°|49.26°|
|285 body|7.99°|5.81°|18.71°|22.54°|
|322 surface|6.19°|6.36°|53.84°|53.84°|
|380 veil|5.99°|4.99°|18.55°|16.39°|
|449 veil|14.77°|13.91°|61.99°|63.33°|

Card322 is a particularly clean source witness: guide clearance introduces the ring2 bend, while the subsequent vertex clamp makes no change. Card449's clump-clearance displacement reaches14.796mm; its original radial ribbon construction has a92.20° adjacent width-axis turn. Card276 instead gains most of its sharp bend at the final vertex clamp. The hook's bend already enters through blending two differently shaped paths.

The original analysis did not handle zero-length segments: its maximum became null on some cards. The preserved v2 explicitly records spans≤1e-9m and undefined turns, then reports the maximum of finite turns. No collapsed span is classified as smooth. All six table witnesses have valid spans.

This pattern extends beyond the small posterior cluster. Among78rootcards, the median of each card's maximum bend is8.70°before guide clearance,25.99°after it and35.60°after vertex clamping (conventional median, averaging the two middle values). The number with a finite turn above30°rises from2 to30 to49. Rootcard25 additionally has undefined turns after guide clearance, retained separately in the summary. This locates a widespread source-stage contribution; it does not attribute every visible pixel to that stage.

The [earlier native ablation](../posterior-cluster/README.md) establishes that five of these cards contribute to the rear diagonal bands. Root directly re-inspected the original rear-oblique rendering during this trace review. Numerical continuity alone did not make the rejected endpoint/frame candidates look better, so the next source intervention still needs a matched actual-image comparison.

## Limits and next decision

- `grownToCut` already contains integration, body projection/hug, cut adjustment and resampling. A bend present there cannot yet be attributed to one of those internal operations.
- Signed clearance uses interpolated vertex normals already. Face-normal discontinuity is not an established explanation.
- The clamp's1399“moved” count records operations across passes, not necessarily1399unique vertices. There are zero radial rescues in this build.
- Returning a smooth curve without enforcing clearance is not a qualified repair. A diagnostic can isolate a projection stage while retaining the final body clamp; any resulting output remains experimental until actual geometry and images are reviewed.
- A wider smooth support envelope is a different representation, with greater scope and its own coverage/clearance risks. Do not return to arbitrary endpoint or width-frame tweaks without a new witness.

The [independent critique](CRITIQUE.md) confirms correspondence and supports the two-card source probe, with the broader envelope as the alternative.

Full captured curves, rebuilt outputs and source snapshots remain local under `captures/bob-authoring-trace-v1`. See [summary](summary.json) and [archive manifest](archive-manifest.json). Tracked manifests are recovery indexes, not remote backups of ignored raw files.
