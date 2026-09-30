# Rest orientation — one geometric convention

The [predeclared shortest-rotation/local-roll construction](ORIENTATION-PLAN.md) passes its finite matrix comparison at weights 0, 0.25 and 1. No bone-specific sign, offset or tolerance was adjusted after execution. This supplies another prerequisite; it does not close runtime skeleton refitting or skinning.

Using every native endpoint pair and its pinned fixed roll, JS builds an absolute rest matrix. A second calculation uses the preceding SDK endpoint means rounded to float32. Both compare origin, tail and three one-metre basis witnesses for all 53 bones to actual saved native `matrixLocal` values. Parent-relative matrices are also derived and recomposed.

| Input | Weight 0: max mm | Weight 0.25: max mm | Weight 1: max mm |
|---|---:|---:|---:|
| Actual native endpoints | 0.008103127 | 0.005258017 | 0.006025492 |
| SDK float32 endpoints | 0.008103127 | 0.005258017 | 0.006603110 |
| SDK hierarchy recomposed | 0.008103127 | 0.005258017 | 0.006603110 |

All pass the unchanged strict 0.1 mm witness-displacement bar. The largest clean residual is neutral `ball_r` basis X; the maximum basis-axis angular separation is approximately 0.000007716 radians. These are finite numerical comparisons, not a general theorem about every possible bone direction. Antiparallel +Y directions are explicitly refused; none occurs in these fixtures. The tail witness uses the native bone length, while actual SDK endpoint/length accuracy is covered by the preceding endpoint proof.

## A concrete reason endpoints alone are insufficient

The negative control turns `clavicle_l` by an additional 90 degrees around its own length. Its head/tail witnesses still pass: the maximum endpoint residual over the whole skeleton is 0.000170174 mm. Its one-metre basis witness fails at **1,414.213598 mm**. The bone can point to the right places while being twisted incorrectly.

The second control transposes every rotation block. It fails at **1,999.411743 mm**, with a maximum endpoint residual of 958.266444 mm. Both start from the passing full-weight SDK prediction and retain their actual changed matrices and witness results. Neither mutation changes an asset.

## Commands and recovery

```sh
node tools/critic/compare-skeleton-orientation.mjs
```

PID 4457, 17:31:54.459–17:31:54.639 UTC, exit 0. Output `captures/skeleton-orientation-2026-09-30-v1`; report SHA256 `caecc9a7678e5ebc5d15af9979905a1c674d063f3df8d697cdc48ce8880065ed`. The script refuses an existing output root. Source and plan snapshots, all predicted matrices, local and recomposed hierarchy, and every per-bone witness are retained.

The independent critic cleared the source before execution, then independently reconstructed the convention using Rodrigues matrices and an explicit local-Y roll. All 742 retained matrices and 2,915 witnesses agree, including hierarchy locals/recomposition and both corruptions. Residual differences are at most 5.68e-11 mm; symmetric worst-bone labels can swap at rounding precision. Input/source/output hashes match. The critic accepts this bounded convention result. No native or browser process was needed. The preceding native runtime remains detached.

## Next boundary

Before a product change, establish the relationship between these native rest matrices and the actual exported figure's hierarchy, axis conversion, inverse binds and body vertex map. Then compare posed skin against native evidence. Native rest-matrix agreement alone does not establish those behaviors. The broader body range and visual qualification remain open.

The subsequent [accepted neutral export bridge](../skeleton-export-bridge/README.md) completed this one-file coordinate/rest-bind prerequisite. Posed skin and runtime updates remain open.
