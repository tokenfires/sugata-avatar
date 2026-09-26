# Native attribution harness

This is a separate disposable A/B/C capture instrument following `ATTRIBUTION-DESIGN.md`. It does not change accepted sources/assets and is not a clearance remedy. CPU preflight is separate from native authorization; only the root controller may launch a granted GPU run.

## Files and preflight

- `hand-attribution-manifest.mjs`: pins the protocol, accepted inputs, old reproduction case, current project/Three sources and assets. It derives the discrete sample plan from the retained **actual** schedules. Every native run rederives its own plan and validates observed plateau intervals.
- `hand-attribution-runtime.mjs`: performs the original native wardrobe/setup recipe, installs the separately owned `HandAttributionArm`, preserves primary draw history, extracts native state/geometry, renders separate views, then retires the instrument and Avatar without another update.
- `hand-attribution-capture.mjs`: fresh-output Node controller, loader-response receipts, lossless geometry/state files, source archive, reproduction/parity gates and completion seal.
- `hand-attribution.selftest.mjs`: three CPU groups test the bounded native scheduling plan and rejected protocol/source changes. This is separate from the adapter's own mechanism/lifecycle CPU tests.

The current plan is **109 geometry samples and 721 native owner/state samples per primary arm**, capped at 120 geometry samples. Visual passes contain 244 image times (15 Hz plus selected plateau/onset/return witnesses), with two extra close views at steps 0, 455 and 637: **250 PNGs per arm**. This samples plateau boundaries and centres; it is neither every plateau frame nor continuous collision coverage.

The schedule-derived held intervals are 91–109, 264–281, 448–466 and 630–647. Their derived centres are 98, 270, 455 and 637. Each first/centre/last sample has ±2 geometry/image steps; preparation/return boundaries have ±1. The 30-step geometry cadence and initial/phase/final adjacent samples remain present. Actual returned gesture telemetry must confirm the same intervals after each trace.

## Two explicitly different passes

**Primary** uses one fresh Avatar per arm, historical portrait camera and exact historical warmup. Its renderer frame must equal `1000257 + step` throughout; it adds no diagnostic draws. Only the original public happy and angry commands run at steps 0 and 360. Step 720 stops before the fearful command.

A must reproduce every retained mesh position/full-index/drawn-index array, rig and time at 0/637/720 exactly. Full historical `helper.physical()` records are available at 0/636/639/720 and must also match, including their camera and GPU readback fields. A full physical record at 637 was not retained; its exact rig/mesh witness is the reproduction gate there. Old step-720 scheduling telemetry follows the fearful command and is deliberately not compared to this pre-fearful prefix. Any A reproduction failure stops before B/C.

All native owners' actual returned-output/null/disabled status, raw/effective contribution maps, PRNG state, authored posture/gesture reports and schedule are retained for every step. Across A/B/C, the raw posture/gesture prescription and schedules must agree. Other owner output differences are recorded for dependency analysis; the harness does not demand false global equality where an owner reads a changed physical pose.

**Views** requires a completed, hash-sealed primary report and all its referenced geometry/state files. It starts fresh A/B/C Avatars, then uses a fixed full-body camera. At every saved geometry step, all posed meshes/rig/time and complete semantic owner state must exactly match the corresponding primary arm. Centreline position/velocity, head, clock and physical-step hashes also match. Camera, projection, render-frame, cards and GPU hair-vertex differences are recorded separately; GPU hair vertices are not required equal across projections and hair is not a qualification target.

Front full-body images use the ongoing visual camera without extra per-image draws. The initial state and two angry centres also receive left/right hand–hip views, using 16 zero-delta convergence draws, followed by restoration and 16 full-body convergence draws. Native owner and centreline/head/clock invariants must survive these view-only operations. No `setFraming`, rig re-aim, light change or physics update is used to produce the close views.

## Provenance and teardown

Before any browser exists, the controller checks the manifest and baseline hashes and requires a fresh output directory and at least 4 GiB free space. It archives all pinned source/assets and old reproduction inputs into the output's `source/` tree. Actual asset requests are fulfilled from those exact archived bytes; the real browser response bodies are independently hashed. The g050 body, bob02, accepted casual outfit, bra, briefs and shoes must each produce one exact native GLB response. Subsequent source drift fails the run and prevents a seal.

Geometry files preserve the original helper's `{time,rig,meshes:[{id,positions,fullIndices,drawnIndices}]}` fields, adding telemetry and `{arm,step,manifestSHA256,mode}` identity. Primary report entries include compressed/decoded hashes, pose fingerprints and physical readbacks. State arrays are gzip-compressed losslessly. Reports are diagnostic; the separate root-owned geometry audit consumes only a sealed completed primary capture.

Cleanup retires the instrument/native Avatar before calling `AttentionAction.dispose()`, because that action removes its layer and the live instrument deliberately forbids removal. The helper's draw callbacks are restored; controls, action, Avatar, browser context, browser and temporary server are closed. Memory counts, leaked handles and adapter descriptor restoration are asserted. No filtered Avatar resumes interactively. Failed output folders are retained and never overwritten.

## Commands

From repository root, after all instrument sources are approved and frozen:

```sh
node docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution.selftest.mjs
node docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-manifest.mjs --write FRESH_MANIFEST.json
node docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-capture.mjs FRESH_MANIFEST.json FRESH_PREFLIGHT_DIR --preflight
```

Only after the root grants the GPU slot:

```sh
node docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-capture.mjs MANIFEST.json FRESH_PRIMARY_DIR --primary-only
node docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-capture.mjs MANIFEST.json FRESH_VIEWS_DIR --views-only SEALED_PRIMARY_DIR
```

Primary and views use the same manifest and frozen helper bytes. A later visual-only source correction requires an explicit successor/parity design; silently changing pinned files cannot pass this instrument. Native mechanism, disposal and rendering remain unverified until those authorized runs complete.
