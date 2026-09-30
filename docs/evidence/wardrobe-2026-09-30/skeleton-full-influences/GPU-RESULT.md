# Eight-influence WebGPU position observation

The [fixed GPU experiment](GPU-PLAN.md) passes its nine numerical comparisons and two negative controls on actual WebGPU, using the complete float32 influence representation. Maximum native-reference error is **0.000716119 mm** under the unchanged strict below 0.342 mm bar. This is a finite compute-position result and a limited static geometry inspection, not production integration or complete avatar appearance acceptance.

## Actual path

The shader reads eight weights/joint indices, the unskinned shaped positions and the pose × inverse(rest) matrices. It performs all eight weighted transforms itself. Positions, matrices and weights are uploaded as float32. Stored uint8 joint indices are expanded to uint32 for WGSL storage, so no equivalent production bandwidth/performance claim is made. The output is a vec4 storage buffer; all 14,517 actual GPU XYZ positions are read back for each of the 11 cases.

The candidate material's positionNode directly reads that same computed output. Readbacks are used to reconstruct geometric normals and bounds for static inspection; the native reference uses the identical normal-reconstruction method on its own observed positions. This does not qualify normal/tangent skinning or the ordinary avatar material, shadow, history and CPU surface-query paths.

All 11 observations report WebGPU, adapter vendor `apple` and architecture `metal-3` (device/description strings are empty). The browser ran locally on the previously observed Apple M5 Max host; this report's adapter record establishes Apple Metal hardware but does not independently name the exact chip. No fallback backend was accepted.

## Measured results

Distances are maximum Euclidean millimetres over all exported body vertices.

| Case | GPU → native full | GPU → corresponding CPU | Disposition |
| --- | ---: | ---: | --- |
| 0-identity | 0.000477782 | 0.000151133 | pass |
| 0-elbow | 0.000477782 | 0.000183517 | pass |
| 0-coupled | 0.000602899 | 0.000242365 | pass |
| 0.25-identity | 0.000477782 | 0.000151133 | pass |
| 0.25-elbow | 0.000491512 | 0.000212126 | pass |
| 0.25-coupled | 0.000520955 | 0.000250960 | pass |
| 1-identity | 0.000478000 | 0.000151133 | pass |
| 1-elbow | 0.000507515 | 0.000218367 | pass |
| 1-coupled | 0.000716119 | 0.000239494 | pass |
| restore-accepted-four | 1.589272120 | 0.000250420 | expected failure |
| stale-neutral-binds | 106.885741028 | 0.000249559 | expected failure |

The neutral same-pose and same-body identity controls pass before dependent cases. Restoring accepted-four weights and using stale neutral binds both fail against passing parents, while their GPU outputs still agree with the corresponding deliberately corrupted CPU predictions. No threshold, pose, weight or matrix was tuned after execution.

## Actual images and visual limits

Root inspected all eight original V2 PNGs: native/candidate context and waist pairs for neutral and full-target coupled poses. Visible geometry and the local waist shading agree without an obvious new silhouette break or crease. The camera/light pairs are fixed, positions unamplified, and plain materials intentionally expose the surface. The images are diagnostic body meshes, not complete clothed avatar candidates.

- [Neutral context, native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-context-native.png) / [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-context-gpu.png)
- [Neutral waist, native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-waist-native.png) / [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-waist-gpu.png)
- [Full-target context, native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-context-native.png) / [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-context-gpu.png)
- [Full-target waist, native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-waist-native.png) / [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-waist-gpu.png)

**Framing shortfall:** the full-target context pair clips the feet at the bottom. The intended complete-body visual coverage is therefore incomplete for that body. Retain these originals and restrict their visual conclusion to what is visible; numeric comparisons still include every vertex. A supplementary wider fixed camera pair could qualify that omitted view, at the cost of another capture. This is a camera/coverage limit, not a demonstrated skinning defect or reason to retune the candidate.

The independent review is recorded in [GPU-CRITIQUE.md](GPU-CRITIQUE.md). No pixel-exact image or complete movement/appearance claim follows. The separate earlier product exact-image gate remains failed.

## Failure and recovery preserved

V1 remains **FAILED**, even though its 11 readbacks and 8 images were collected. The no-console-error assertion encountered a 404 after observations. It did not record the request URL. An identical-source initial-load replay then identified `/favicon.ico` as the sole missing request in console location, CDP Log and Network receipts; all page/module/data requests were 200. The replay ran no compute cases or draws.

V2 adds an explicit empty inline icon, a fresh output root, error-location recording and the [recovery note](GPU-RECOVERY.md). It preserves the strict no-error gate. The entire prepared input JSON is byte-identical between versions, SHA256 `7b6880c44fe4ccbcd3453c00ad1f00cc86a6ccb9a9e9ce732826983896488cea`, and the GPU computation/view module hash is unchanged. Source snapshots retain the original failed instrument. No numerical failure was filtered or reclassified.

## Jobs, commands and recovery

```sh
node tools/critic/capture-eight-influence-gpu.mjs
node tools/critic/eight-influence-network-diagnostic.mjs
```

The capture script now targets fresh V2 and refuses overwrite. The exact V1 source is preserved in its raw source snapshot; do not rerun it into the frozen folder.

| Job | PID / session | UTC interval | Status / report SHA256 |
| --- | --- | --- | --- |
| GPU V1 | 6641 / 97068 | 18:33:25.846–18:33:30.854 | Failed · `32563e6d2bb31c22a514862c445749f16647e8b78d249fbecb6472fb7ac7872d` |
| Network diagnostic | 9254 / 90671 | 18:35:08.005–18:35:09.348 | Observed · `146527ff18e53e9fe418ed91090a26a6761cc05092ad9f67abb0adc19c57fa34` |
| GPU V2 | 11942 / 51599 | 18:36:51.367–18:36:56.118 | Passed numerical/console checks · `0b272c6531241d18992d8e99c90bc723654c233cf110aa832042e4d3133a478d` |

Raw roots: `captures/skeleton-full-influences-gpu-2026-09-30-v1`, `captures/skeleton-full-influences-network-2026-09-30-v1`, and `captures/skeleton-full-influences-gpu-2026-09-30-v2`. V1/V2 cleanup records each release all five private storage attributes; browser and temporary service close afterward. No job remains. Keep main review PID 2323; accepted assets and prior frozen packets are unchanged.

## Remaining integration boundary

Installed Three uses four-component skinIndex/skinWeight in both its current/previous GPU skin paths and CPU SkinnedMesh queries. Preserving extra data alone cannot extend those consumers. The accepted isolated compute candidate is useful evidence for a subsequent deliberate integration contract covering positions, normals/tangents, bounds/queries, motion history, skeleton rebinding and shared face/wardrobe ownership. Alternatively, remain at the proven prototype and choose another product workstream. No ordinary-avatar default changes follow automatically from this packet.
