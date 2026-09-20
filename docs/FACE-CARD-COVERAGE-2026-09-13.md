# Softer eyebrows and eyelashes — September 13, 2026

The current Avatar now uses the original brow and eyelash atlas alpha as fractional coverage during supported temporal beauty rendering. The opaque black brow bars become softer, visible brown brows; pointed black lash shapes become a finer eye edge. Root and independent critic inspected still, closed-eye, reopening and natural head-turn samples. This is a visible improvement in the existing avatar, not whole-avatar AAA qualification.

`Avatar.create({ faceCardCoverage: 'auto' })` is the default. The explicit `binary` setting retains the previous behavior. Direct rendering, debug views, temporal-off paths and unsupported active passes use the original binary cutoff. The fallback quality tier retains its original MSAA alpha-to-coverage material graph. TAAU and TRAA activation were exercised in real Chromium WebGPU.

## Implementation and boundaries

`render/FaceCardCoverage.js` owns a Stage participant, per-material alpha-test graph, uniforms and disposal listeners. It observes the actual main-pass receipt, renderer, camera, scene, object, target and unjittered projection before enabling coverage. No renderer prototype or mesh render callback is replaced. Numeric shadow alpha cutoff remains 0.1; original color, atlas, geometry, morph/skinning inputs and material motion path are retained. It owns no storage buffers.

The Avatar integration was merged onto the September 13 hair-history implementation. It does not restore the older September 9 Avatar. Shading teardown detaches the coverage owner first and attempts every remaining shading resource even when a disposal listener throws. Material retirement restores only its owned graph and disables retained uniform callbacks.

Qualified and installed module hashes:

- Avatar.js: `e8ee3f0f770c71e950711052b670fdcb1c25b9a42c9d2e681bcad6010debb504`
- FaceCardCoverage.js: `729ed498df7fc0a20d6da09771d74ddddf8fe59b2fb4c626d70feba2a20ed1da`

## Critic: proved defect and two alternatives

The preserved initial owner failed cleanup when its first or third uniform allocation threw before assignment: it retained material ownership and the Stage registration, and refused reinstallation. Chaining configuration onto allocation also left an allocated node unreachable if configuration threw. These are reproduced CPU exception boundaries with real TSL nodes; ordinary native allocation failure or GPU out-of-memory was not observed.

Alternative A, selected: tolerate missing partial uniforms, always attempt retirement/unregistration after an active-state reset error, and assign each allocated uniform before configuring it. Alternative B: construct privately with a complete rollback scope and publish ownership only after successful construction; this requires a larger installation rewrite. The exact selected module passes the critic's 12 independent cleanup controls.

For the baseline visual defect, the critic recommends adopting the qualified owner. Its second alternative is a newly authored brow/lash asset with a thinner silhouette and revised atlas transitions, retaining binary rendering; that asset alternative has not been demonstrated. Reviews and original red proofs are preserved in the local archive below.

## Visual and renderer evidence

The fresh study uses three arms—original binary, September 9 visual prototype, and current owner—on current September 13 sources. It contains 120 PNGs: six still images at 12°/45° and 114 sampled natural/blink images. Recorded physical state, skinned card vertices, morph weights, bones, camera and actual draw phase match across arms. The critic independently verified every PNG hash, 80 physical frame pairs, eight complete canonical trace pairs and all 40 prototype/owner image comparisons. Every one of 816 owned submitted frames records both face materials enabled at the correct phase.

The owned and prototype images are visually indistinguishable at the inspected presentation size, but are not universally bit-identical. Still residuals affect 72/52 RGBA channels with maxima of four/two code values. Early natural residuals decay to bit-identical images at frames 90–180. Blink samples retain 17–187 differing channels with maxima of three code values. These residuals remain recorded; no whole-image bit-equality claim is made.

All six captured native shadow fragment programs are byte-identical. Eight shadow vertex programs match after normalizing generated NodeBuffer names only. Both face-card vertex entry functions retain identical arithmetic after generated identifier renaming, including previous morph/skinning expressions. This compiler evidence plus matched inputs does not independently establish every runtime velocity or shadow texel.

## Integration checks

- 16 portable CPU coverage/Avatar contract groups and 12 independent partial-construction/retirement groups pass.
- Real production WebGPU checks pass for TAAU/TRAA, debug/off return, primary and alternate-camera direct rendering, reactivation, retained-node retirement and final disposal.
- Three real attach/dispose cycles return to the same listener, participant, uniform, pipeline, builder and storage counts. Full Avatar disposal leaves zero tracked allocations and no leaked handles. Actual WebGPU MSAA creation retains both original face material graphs.
- Both bobs, repeated hair-history attachment, and a g025 identity change pass the existing renderer lifecycle checks with the additional face participant. g025 is a lifecycle check, not a new appearance or contact-calibration qualification.
- All 13 existing PNG-export groups pass with the exact candidate modules: same-task canvas pixels, exact physical/camera/clock state, outfit changes, live clock pause/resume, encoder failures and retirement. All-page build, 137 Avatar assertions, 22 history CPU groups and 13 native MRT controls pass. The catalogue's final 92 assertions pass once this evidence page is present.

The first new lifecycle harness attempted to inspect `avatar.stage` after disposal had nulled it. That failed report is retained; the corrected harness retains the stage reference before disposal. The first catalogue run preceded this evidence document and correctly rejected its missing link. Neither is represented as a product defect. Existing build size warnings remain.

## Remaining work and recovery

Moving-lid grain, broad hair strips, crown/temple gaps, and unfinished skin/eye and outfit quality remain visible. Sampled images do not prove continuous flicker quality, all expressions, every bake/lighting configuration or a performance improvement. The pre-existing hair settling and g025 contact-calibration limitations remain documented in [hair history](HAIR-RENDER-HISTORY-2026-09-13.md) and [red gates](RED-GATES.md).

Full local evidence is preserved in `captures/face-card-coverage-2026-09-13/`: candidates, actual source freeze, images, physical/draw traces, compiled shaders, failed/successful harness reports, independent critic and production checks. The tracked inventory is [the evidence manifest](evidence/face-card-coverage-2026-09-13.manifest.json). Historical scratch harnesses retain their original paths; portable rerun gates live beside the production module:

```sh
node packages/core/src/render/FaceCardCoverage.selftest.mjs
node packages/core/src/render/FaceCardCoverage.cleanup.selftest.mjs
node packages/core/src/render/FaceCardCoverage.gpu.selftest.mjs --out=/tmp/sugata-face-check
```

Serialize GPU work. Preserve the accepted bob assets and collision calibration. Next visual investigation: prove where crown/temple coverage is lost, then compare a localized tapered-strand repair against a separately authored groom study. Do not replace the full groom without evidence and a recovery path.
