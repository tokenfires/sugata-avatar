# Cached g050 helper data and isolated garment arithmetic

The CPU baseline matches the current shipped g050 body within the existing **strictly less than 0.001 mm** mapped-coordinate bar. Maximum error is **0.000716806261 mm**, RMS **0.000273291040 mm**, across all 14,517 glTF positions / 13,380 distinct body indices. No alignment was fitted. None of the positions is exactly equal; the residual and worst-coordinate witness are retained in [proof-v1/report.json](proof-v1/report.json).

This is a cached-source data reconstruction and an isolated arithmetic implementation. **It is not a native MPFB refit result or a garment-fit qualification.** The 5,778 unexported helper coordinates still lack an independent native positional oracle. Blender's precise OBJ-import and evaluated-key rounding have not been observed in this run. The same missing Blender application and extension environment recorded in [inventory-v1.json](inventory-v1.json) block the native comparison. No install, GPU job, core/default change or accepted-asset edit occurred. 9.4 remains held.

## What is reusable

- [cpu-refit.mjs](cpu-refit.mjs): read-only input arithmetic for the declared source model, explicit original-index dependency mapping, original mhclo parsing, shape-dependent scale computation and signed, unnormalized fitting weights. It offers float32-vector arithmetic and a separately labeled float64 diagnostic reference.
- [proof-v1/portable-inputs.json.gz](proof-v1/portable-inputs.json.gz): the original casual garment's 2,197 rules, all 1,885 dependency IDs and reconstructed neutral coordinates, and both declared detail targets restricted to those dependencies. Source/macro/scale provenance is bound through the inventory and proof report. It contains no accepted trouser corrective.
- [verify-portable.mjs](verify-portable.mjs): hash-verifies and replays the sealed packet without the archive cache, current GLBs or Blender. Across neutral, quarter and full detail weights, all **5,655 body-dependency components and 6,591 garment components per case** exactly reproduce the source-bound full-array CPU calculation.
- [read-cache.py](read-cache.py) and [prove-refit.mjs](prove-refit.mjs): rebuild the result from the pinned ZIPs, current source/data bytes and retained macro recipe into a fresh evidence directory. Archive contents are read in memory, without installing or extracting the addon. The final input hash check passed.

All five compressed evidence files have both encoded and decoded SHA-256s in the report; total compressed size is 924,096 bytes. `baseline.json.gz` retains all 19,158 reconstructed positions and the exact recipe. The three `case-*.json.gz` files retain dependency deltas/positions, garment output and scaling at weights 0, 0.25 and 1. Neither a displacement field nor successful body-only correspondence is substituted for native helper validation.

## Arithmetic and checks

The reconstruction starts from the cached 19,158-vertex OBJ and eight pinned macro targets in the retained order. It models float32 basis/key storage, float32 weights and ordered relative-key additions; grounds from the evaluated minimum over body indices below 13,380; translates basis and keys; then reevaluates the unchanged macro recipe. Grounding is **0.8177425265312195 m**, from source index 6461. This is a declared CPU float32 model, not an assertion of byte-identical Blender evaluation. The source-derived `(x,-z,y)` / `(x,z,-y)` axis conversions and 0.10000000149011612 scale are unchanged.

The two detail stacks use the actual current `IdentityCatalogue.resolve` and `IdentityTargets` implementation. The compact data path matches that full-array calculation exactly. Each refit recalculates all six-reference scale measurements. The selected two targets happen to leave those scales unchanged; an independent nonuniform synthetic reshape exercises changing all three scales. The vector/double diagnostic discrepancy is at most **0.000215326007 mm** here; it measures two CPU calculations, not accuracy against Blender.

Nine focused CPU groups pass, including negative/non-unit weights, offset axes, scalar/vector rounding, body-only grounding, repeated/invalid indices, missing helpers, nonfinite/overflow arithmetic, malformed rules, collapsed scale references and strict mapped-coordinate gating. Separate analytical witnesses establish known coordinates instead of using the same fitter as its own oracle.

The [sealed portable verification](verification-v1.json) also retains actual-data corruption witnesses:

| Deliberate corruption | Maximum change from source-bound CPU output |
| --- | ---: |
| Omit helper target deltas | 106.886572 mm |
| Reverse the offset's Blender Y sign | 30.558497 mm |
| Substitute one valid but wrong helper ID | 3.530130 mm |
| Clamp and normalize signed weights | 87.062847 mm |

These prove that the packet/comparator notices the declared errors. They are **not** independent native geometry comparisons. Pure arithmetic functions can accept analytical fixtures; the runner and portable verifier supply the production-data hash admission. Consumers must preserve that admission when reusing the packet.

## Rerun

From the repository root:

```sh
node docs/evidence/nonhair-2026-09-26/wardrobe-coupling/cpu-refit.selftest.mjs
node docs/evidence/nonhair-2026-09-26/wardrobe-coupling/verify-portable.mjs
```

To reconstruct from the cached archives, choose a new output directory name; existing output is refused:

```sh
node docs/evidence/nonhair-2026-09-26/wardrobe-coupling/prove-refit.mjs proof-next
```

The full reconstruction intentionally rejects changed pinned inputs. The portable replay intentionally consumes the exact sealed `proof-v1` and kernel. A successor requires an explicit new binding, not an automatic hash refresh.

The [original plan](PLAN.md) describes the remaining native oracle: three fresh MPFB humans, the same two targets, all-vertex body data and original garment outputs, comparing JS/native body deltas below 0.001 mm and garment coordinates below 0.1 mm. The subsequent [garment correspondence proof](garment-map/README.md) now establishes the exact 2,197-source-to-2,377-glTF split map and separately records installed trouser corrections. Native helper validation, preservation or requalification of those corrections across identities, skeleton and foundation behavior, and actual fit remain open.
