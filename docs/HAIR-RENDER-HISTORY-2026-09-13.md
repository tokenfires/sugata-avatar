# Hair render history — runtime integration, September 13

Moving hair now uses the positions and camera transform from its previous successfully rendered image. This reduces the grain and blur on swinging locks in both bobs. The accepted hair geometry, contacts, solver arithmetic, lighting and outfits are unchanged. Broad strips, patchy overlaps, crown gaps and harsh brow/lash edges remain visible; this is progress toward the AAA goal, not its completion.

The independent critic reproduced three callback/MRT defects, supplied two alternatives for each, and verified their repairs. It then reviewed integration/disposal and four saved image pairs independently. The complete review and preserved failed controls are under `captures/render-history-2026-09-13/critic/`.

## Runtime boundary

`Avatar.create({hairHistory:'auto'})` is the default. `hairHistory:'hold'` retains the earlier approximation. The owned history activates for original cards in the supported TAAU beauty path; other rendering modes invalidate it and hold or reseed. Scalp caps retain their native path and have no exact-history claim.

`Stage` owns render participants and observes its actual main scene pass. A completed cached redraw, including PNG export after unrendered physics/camera changes, does not advance the previous-position snapshot. Reset, resize, temporal-mode changes, debug views and direct camera renders invalidate it. A failed image cannot be exported from a partial cached result; the next actual fresh scene reseeds.

The GPU copy is submitted after the successful beauty submission and before yielding. One padded buffer holds 16,864 original-card positions: 269,824 bytes for each tested groom. Hair retirement releases the history before the solver storage it borrows. Pending identity loads and cleanup failures keep their ownership boundaries.

Direct renders temporarily use the original material MRT where required. Nested callbacks have separate receipts, including shadow draws whose before/after material arguments differ. This closes the empty-output WGSL failure without making alternate cameras consume the main camera's history.

The failure-state adapter is verified against the locked **Three 0.185.1**. It restores the native render/light/camera state left by an interrupted callback, including required private bookkeeping. It does not rewind the native frame clock or clear its caches. Dependency upgrades require requalification of this adapter. A renderer rebuild after failure is the critic's alternative if avoiding that private-state dependency becomes necessary.

## Evidence and limits

- **22 owned-history CPU groups**, including public-option validation before GPU allocation; **13 native Three callback/MRT controls**, including the original empty-output failure mechanism.
- **137 Avatar assertions** and **21 real GPU disposal checks** pass. The retained-solver failure control grows storage 9→17→25→33; corrected rebuilds remain at 9, with bit-identical physical output. Unpublished losing loads and loads finishing after Avatar disposal cannot resurrect hair.
- The installed history gate passes **8 real WebGPU cases** covering cached export, reset, debug/temporal transitions, both direct cameras and actual native shadow-callback failure/recovery. Image export passes **13 groups** and resize passes **6 groups**. Both-bob/identity lifecycle checks finish with zero storage and no leaked Avatar handles.
- Against the frozen, independently qualified September 9 V3 shader, **327,639 visible card pixels across seven states match every native RG16F velocity bit**. Physical inputs and actual capture frame/dither/jitter state match. Non-groom components also match. Whole-buffer bit equality fails only on native scalp pixels: signed zeros or differences up to 5.960464477539062e-7 NDC, about 0.000128 pixel in this probe, within the earlier fixed 2e-6 NDC numerical floor. This is an exact-card result, not an exact-cap result.
- Larger appearance comparison: **44 PNGs / 22 paired moving and settled views**, both bobs, natural idle and a controlled nod. The paired physical states, bones, morphs and frame phases match; all eight disposed arms return to zero storage. Root and critic observe reduced moving-lock grain/blur, with little expected difference in settled views. These sampled images do not certify every moment of continuous motion or every camera.
- Pre-change/default comparison in ABBA order at a 932×930 canvas records all 960 timing samples. With 180 steady samples per arm, CPU submission medians are **2.9 / 3.0 / 3.0 / 2.9 ms**; submission-to-GPU-completion medians are **14.7 / 14.7 / 14.8 / 14.7 ms**. This is a bounded measurement on this Mac, not a universal 60 FPS guarantee.
- All 18 testbed pages build and all 92 catalogue assertions pass. REQ-077 now adjudicates as applied. The legacy request-ledger gate remains 25/26 because its round is stale and REQ-088 still names the removed HAIR_BAKES anchor; that anchor is absent from the pre-change Avatar too. A whole-suite-green claim is not made.

The first prepared comparison did not align stochastic frame phases. Its large differences are preserved, along with the controlled rerun and diagnostic normal-attachment tags that isolate the remaining scalp differences. The prepared lifecycle test also incorrectly expected 36 storage buffers for the unmodified g025 groom. The refined test measures the owned-buffer delta independently and retains the original failure.

Two existing test injections were updated for the new material-assignment and guarded-disposal boundaries; their rejection checks remain active. The first regression batch unintentionally included GPU-using tests among nominal CPU checks. Its timings are not qualification evidence. The final GPU checks and ABBA measurement above ran serially.

## Unfinished work

The solver settling clause remains red: **3.1262 mm** worst tip movement versus its unchanged **0.5 mm** limit. An isolated run routing the pre-change `3946b3c` solver and a serial run of the installed solver both report the same result and **34/35** checks. This predates the renderer change and is declared in `RED-GATES.md`.

The shipping g025 long bob still refuses body contact because its geometry does not match the corrected-rest calibration. This is the previously documented boundary in `HAIR-BODY-CONTACT-G025.md`; that experimental groom was not silently promoted. History itself attaches and releases correctly on the original g025 groom.

Next: complete the brow/lash coverage owner's allocation-failure cleanup and qualify it on the shared render boundary. Then isolate the remaining crown/temple strips using coverage and solid-card views before changing an authored region. The critic's alternative is a separate guide/curve hero groom with finer fibers and the existing cards as a fallback; that entails its own shading, motion, shadow and cost work.

## Reproducible checkpoint

Tracked summary: `docs/evidence/render-history-2026-09-13.json`. Full local evidence: `captures/render-history-2026-09-13/`, 256 payload files / 116,668,764 bytes. The manifest SHA-256 is `8ec4a0b0bdaf3f1cb982e6989ffa2d291cbc0a94080877a078b10a1d0e511a86`; a tracked copy sits beside the summary. Large raw captures remain local under the repository's existing capture policy.

Portable checks:

```sh
node packages/core/src/render/CardRenderHistory.selftest.mjs
node packages/core/src/render/CardRenderHistory.native.selftest.mjs
node packages/core/src/render/CardRenderHistory.gpu.selftest.mjs
node packages/core/src/render/CardRenderHistory.lifecycle.gpu.selftest.mjs
```

Run the GPU checks one at a time. The appearance, scoped numeric comparison, every timing sample, critic reproductions, baseline source and failed controls are preserved in the local archive.
