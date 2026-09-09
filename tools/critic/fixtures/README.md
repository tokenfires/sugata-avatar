# Portrait body calibration

`portrait-anatomy-v1.json` pins the five authored bodies (`g000`, `g025`, `g050`, `g075`, `g100`). It derives from the measured correspondence proposal with SHA-256 `0aab6996d97e5416c5126d20364c5ae186a3bc20d7d005a7ab27675f6979abc2`, preserved in `captures/body-surface-2026-09-09/anatomy-calibration.json`. Proposal descriptions and limits refer to that measurement, before runtime capture integration.

The face/head regions map the clipped reference g050 surface through matching triangle vertices and barycentric coordinates. Chin/brow and head/nose landmarks provide an initial mapping; the envelope expands to include actual corresponding surface points. The g050 bounds remain exact. These finite regions exclude parts of the crown and rear head.

The conservative neck/shoulder subset uses corresponding vertices with at least 1% combined neck/clavicle weight at or below the reference chin. Every touching target triangle participates: 1,872 triangles and 1,069 vertices per bake. Replay uses their **same-frame posed world positions** and their current AABB, independently of head movement. The subset includes some upper chest and lower-face border.

`portrait-calibration.mjs` pins the fixture hash. `verifyCalibrationAssets()` independently checks the installed body files, raw position/normal/UV/index/joint/weight hashes, shared UV/skin/morph support, scene transforms, landmarks, mapped face/head envelopes, and semantic neck triangle correspondence. Runtime rest geometry is also pinned. Three r185's GLTFLoader calls the public `SkinnedMesh.normalizeSkinWeights()` method; its resulting Float32 weight hash is recorded separately from raw authored weights and recomputed in the source verification.

## Capture and replay

The default portrait remains bob02/g050. Bob01 has all five bakes; bob02 currently only has g050. The browser and CLI share the same exact authored gender values: 0, 0.25, 0.5, 0.75 and 1. Unsupported, duplicate or contradictory bake/gender selections fail before loading. A non-g050 portrait must select bob01.

```sh
node tools/critic/portrait-clearance.mjs \
  --url 'http://127.0.0.1:5197/src/portrait.html' \
  --hair bob01 --bake g100 --stimulus nod \
  --seconds 4 --fps 60 --stride 60 --out captures/my-g100-nod
node tools/critic/portrait-surface.mjs \
  --input captures/my-g100-nod --out captures/my-g100-nod-surface.json
```

New reports carry `anatomy`, exact body/groom response hashes, runtime rest-geometry hashes, rig/inverse-bind metadata and posed collider metadata. Every frame must match its selected body topology before semantic triangle IDs are used. Face/head testing uses the inverse captured head matrix. New replay gates require both face and neck/shoulder shell-crossing counts to be zero; they expose the two verdicts separately. Head counts remain diagnostic. Recognized original bob01 layout (496 chains, 17 rings, vertex base 652) additionally reports card ranges 0–77 as rootLayer, 78–461 as longCurtains and 462–495 as fringe. Pair sums must equal the full result. These names are diagnostic ranges, not fixed-particle policy or gate exemptions; every chain's ring-0 center is a separate solver concept. Other layouts and bob02 remain unclassified. Scalp/cap geometry is outside the captured ribbon range and is explicitly unverified.

Historical reports without selection/source attestation remain `legacy-unattested` g050 face-only replays. Older explicit g050 reports remain `attested-g050`, with their original face-only scope. Neither historical path acquires a shoulder pass. New or partial anatomy metadata cannot fall back to a historical path. The CLI exit codes are 0 for the applicable gate passing, 1 for measured crossings, and 2 for invalid/incomplete evidence.

No shell crossings does not prove positive clearance, exclude containment, classify alpha visibility, or guarantee uncaptured poses. This integration changes measurement and selection, not hair geometry, physics or material quality.

## Validation

```sh
node tools/critic/portrait-clearance.selftest.mjs
node tools/critic/portrait-surface.selftest.mjs
```

The focused CPU groups cover all five assets and calibrated replays, existing g050 contracts, unsupported selection, rest-hash/topology tampering, and a face-clear posed shoulder crossing, observed original bob01 layout validation on all five assets, and an explicit posed root-card crossing that must still fail when other layers are clear. The short actual WebGPU evidence is in `captures/all-bake-capture-2026-09-09-v2/`: g000/g050/g100, two nod poses each, correct requested/loaded bodies, zero errors. The original bob01 still fails the face/shoulder gates. The two intermediate bakes have asset/calibration/CPU replay coverage, not a live GPU capture in this bounded test.

All 43 poses in the original baseline-final, hem-motion and hem-shake captures retain their previous face verdicts. The baseline rejects; both accepted hem captures pass. Three invalid browser URL cases fail before requesting any GLB. A production build explicitly targeting `packages/testbed/src/portrait.html` passed; the ordinary default build only compiles the landing page.
