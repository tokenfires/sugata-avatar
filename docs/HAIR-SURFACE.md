# CPU hair contact surface

`packages/core/src/motion/HairSurface.js` owns a CPU patch, threaded BVH, reusable staging and submitted-pose history. It imports only Three. It selects no anatomical region and installs no Avatar contact behavior. Query/contact shaders, calibration and body-contact ownership are separate modules.

```js
const patch = createPatch({
  bodyIndices: fullIndex,       // canonical oriented triangle list
  sourceTriangleIds,           // calibrated ordinals into that full list
  sourcePositions, sourceNormals // flat XYZ source arrays
});
const updateSkin = makeSkinnedUpdater(body, patch, { sourceIndex: fullIndex });
updateSkin({ reset: true });
const motion = motionBuffers(patch); // stable arrays for the GPU owner

// Only on a frame that will submit contact work, after updating body/bone world poses:
updateSkin({ advanceHistory: true, reset: resetFrame });
// Upload previous/current vertices, normals and union bounds, then submit substeps.
```

Use `wardrobe.fullIndex` when Wardrobe has compacted the body render index. Source triangle ordinals always refer to the full list. `makeSkinnedUpdater` validates each selected oriented triple against `sourceIndex` once; omitting it uses the current body index only if that index still matches. It does not copy a masked index or derive new triangle ordinals from draw range. Later render-index/mask changes do not affect pose sampling. Replacing the body geometry or skeleton requires a new updater.

The returned updater remains a function. It samples actual Three `getVertexPosition` and direction-mode `applyBoneTransform`, including current morphs, all four skin influences, bind transforms and world transforms. It updates the skeleton buffer by default; the caller updates world matrices first. `updateSkeleton: false` skips that shared buffer refresh, but the native CPU vertex sampler still reads bone world matrices. Selected skin attributes and staged output must be valid and finite. Relative and absolute morphs, unequal weights, nonidentity bind transforms and nonuniform world scale are tested against a separate matrix-blend oracle.

`advanceHistory: true` snapshots the old current pose only when the entire new pose/refit is ready. `reset: true` overrides interval advancement, copies the new pose into both endpoints and clears `historyValid`. Failing skinning/getters, validation, or retirement during staging leave the previous public pose/bounds/history unchanged. No-step frames should not call the updater at all. These CPU commits describe a prepared submission: if later GPU upload/submission fails, the contact owner must retire or reset rather than silently continue against an unsubmitted interval.

Existing explicit `snapshotPreviousPose(patch)`, `resetHistory(patch)` and captured-array updates remain available. Do not combine an explicit snapshot with `advanceHistory: true` for the same frame. `updateFromCaptured(patch, positions, normals, {advanceHistory, reset})` supports the same atomic options. An intentional `updateSkin({refitBounds:false})` publishes positions but blocks queries/history reads until `refit(patch)`; atomic history options require refitting.

The packed contract is unchanged: Float32 vec4 positions/normals; Uint32 vec4 triangles `[localA,localB,localC,sourceBodyTriangle]`; preorder meta `[escapeNode,firstTriangle,triangleCount,rightChild]`, with interior left child `node+1`. Boundary mask bits0–2 identify opposite open edges; bits3–5 identify vertices incident to an open edge, including interior-fan ties. Topology, bounds and history arrays are caller-readable but must not be mutated. Intentional current position/normal edits require `refit`; a failing direct refit blocks queries until repaired.

`nearest` queries current geometry. `nearestAt` linearly interpolates endpoint vertices/normals using bounds covering both endpoints. Alpha 1 works after reset; other alphas require valid history. The `motionBuffers` wrapper contains a snapshot of `historyValid`; fetch a new wrapper when reading that flag. Its underlying typed arrays remain stable. This interpolation is not an intermediate skeletal evaluation or continuous collision detection. A nearest-normal sign on an open patch is not a closed-body inside test. `segmentIntersection` tests transverse current-pose intersections and skips coplanar/degenerate triangles.

`serializePatch` contains current geometry only; `hydratePatch` validates before integer conversion and rebuilds serialized bounds. `disposePatch` is final and idempotent, invalidating patch operations/updaters and dropping private history/staging. It owns no GPU resources and does not dispose borrowed body, skeleton, geometry or material. Callers release their own references and GPU resources separately.

For the five measured neck patches, packed data remains 125,028 bytes (1,069 vertices, 1,872 triangles, 1,023 nodes). History adds 66,944 CPU bytes. Atomic staging uses 66,944 bytes before union staging is needed, 99,680 with union staging. This replaces the scratch updater's 34,208-byte position/normal-only staging so bounds and history can commit together. These byte counts are allocations, not a frame-cost measurement.

Run `node packages/core/src/motion/HairSurface.selftest.mjs`. The 17 CPU groups preserve frozen-v2 geometry/boundary results, all-five-bake packed hashes, actual saved-pose endpoints, interpolation/BVH parity, canonical topology, skinning and failure/disposal behavior. The tracked compressed fixture and its provenance are described in `packages/core/src/motion/fixtures/README.md`. A browser-targeted Vite library build also passes with Three as its only external import. No GPU or full contact/visual acceptance claim is made here.
