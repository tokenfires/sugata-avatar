# Native skeleton to accepted GLB — neutral bridge

The [predeclared bridge](PLAN.md) passes all nine finite comparisons against the actual accepted `figure_g050.glb`. No asset, body map, transform or tolerance was changed. This ties the preceding native arithmetic to the file Sugata loads; it does not qualify posed skinning or runtime body changes.

## Actual asset admissions

The pinned figure has 53 named joints, one `base.001` primitive with 14,517 positions, one four-influence skin stream and 53 float32 inverse-bind matrices. All 89 default body morph weights are zero. The body and armature-container transforms are identity. The existing vertex map covers exactly 13,380 distinct body vertices, with no grounding offset. Joint names and parents match the native rig.

The declared conversion `(x,y,z) → (x,z,-y)` connects native coordinates to the exported figure with no fitted translation, scale or per-bone correction. Native absolute matrices are left-multiplied by that conversion; the encoded child-local basis is retained.

### Precision choices made before execution

The critic found two actual loader details that the comparator preserves:

- Stored export quaternions are slightly nonunit: lowerarm_l/r norm error is approximately 4.18e-8. The local GLTFLoader reads them without normalization, and Matrix4 composes them as stored. **Chosen:** use those raw values. **Alternative:** normalized quaternions in a separately labelled diagnostic arm; this would not represent the actual loaded baseline.
- 6,156 raw weight sums differ from one. **Chosen:** retain both raw and loader-normalized arms, with reciprocal L1 multiplication followed by float32 storage, matching SkinnedMesh. **Alternative:** a raw-only export-data check, which would omit the loader's normalization behavior.

These are representation facts, not established avatar defects. The source snapshots preserve the relevant loader, matrix and skin methods.

## Results

All numbers are maximum Euclidean distances in millimetres. The matrix comparisons include origin, tail and three one-metre basis witnesses for all 53 joints. The body/skin comparisons include all 14,517 exported body vertices.

| Comparison | Maximum mm | Strict gate mm |
|---|---:|---:|
| Converted native matrices vs actual exported matrices | 0.001958841 | 0.1 |
| Independently constructed matrices vs actual exported matrices | 0.007383947 | 0.1 |
| Exported body vs mapped native body | 0.000240736 | 0.001 |
| Rest skin using exported matrices, raw weights | 0.000890950 | 0.342 |
| Rest skin using exported matrices, normalized weights | 0.000890950 | 0.342 |
| Rest skin using converted native matrices, raw weights | 0.000210385 | 0.342 |
| Rest skin using converted native matrices, normalized weights | 0.000188980 | 0.342 |
| Rest skin using constructed matrices, raw weights | 0.000455537 | 0.342 |
| Rest skin using constructed matrices, normalized weights | 0.000437527 | 0.342 |

The rest skin operation uses the **actual exported inverse binds**, retained body positions and four influences. Identity mesh-transform admission makes direct weighted XYZ appropriate here. This is CPU rest arithmetic; it is not a rendering or GPU precision result, nor a posed native-skin comparison.

Two controls fail against their passing clean parents:

- Omitting the declared global axis conversion produces **2,347.862663 mm** maximum body error.
- Moving every joint-world translation by 5 mm while keeping body and inverse binds fixed produces **5.000318485 mm** maximum error. This catches stale bindings.

Full changed matrices, per-vertex results, per-joint witnesses and parsed asset data remain in the raw packet. No corrupted asset was written.

## Commands and recovery

```sh
node tools/critic/compare-skeleton-export.mjs
```

PID 21661 ran 17:42:33.340–17:42:34.113 UTC and exited 0. Output `captures/skeleton-export-bridge-2026-09-30-v1`; report SHA256 `a1c1ec374c41f2fd1c197d666a6b25d7c0f11bf52b796c4a5b02cc03270ed3e9`. Existing output roots are refused. Exact accepted figure SHA256 remains `b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14`.

The source and declared precision contract were independently reviewed before execution. The independent critic then reproduced all nine comparisons, 530 joint witnesses and 130,653 vertex residuals by parsing actual source data. Maximum residual-arithmetic difference is 6.61e-13 mm; source and packet hashes match. See [critique](CRITIQUE.md). The archive preserves the actual accepted GLB, vertex map, comparator/plan and loader source snapshots alongside raw results. It is a local recovery archive.

No native/GPU/browser job was required, and no job remains live. The previous temporary Blender runtime is detached; main review Vite remains available. The next question is actual posed skin under the admitted bone convention, before any runtime refit or broader body-range claim. Face parts, garment/foundation coupling and appearance remain separate open gates.
