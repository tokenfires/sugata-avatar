# Independent critic — accepted neutral export bridge

Reviewer `/root/hair_critic` first checked actual GLB structure and comparator source, then independently parsed the GLB/accessors, scene hierarchy, body map and native packets for recomputation. No files were changed by the critic.

## Accepted scope

All nine declared comparisons pass. The critic independently reconstructed 530 joint-matrix witnesses and 130,653 vertex residuals, including all six rest-skin arms and both negative controls. Maximum residual-arithmetic difference is 6.61e-13 mm; worst locations are unchanged. Ten current input pins, eight copied sources and all twelve compressed/decoded output artifacts match. Identity body/container admission and all 89 zero default morph weights are confirmed.

The accepted neutral asset's coordinate and rest-bind relationship is established within the declared bars. Posed skinning, variation and runtime integration are not qualified.

## Pre-execution findings and decisions

### Preserve the actual quaternion values

Source example: `GLTFLoader.js:4388` assigns raw quaternion values via `fromArray`; `Matrix4.js:1029–1059` composes without normalizing. The actual lowerarm_l/r quaternion norm differs from one by approximately 4.18e-8.

- **Chosen:** compose raw stored values, matching the current loader.
- **Alternative:** a separately labelled normalized-quaternion diagnostic. This can study ideal rotations but cannot replace the loaded baseline.

The implementation already followed the chosen path; the contract now states it explicitly. No quaternion or asset was repaired.

### Match float32 weight normalization

Actual source example: `SkinnedMesh.js:272–284` takes reciprocal L1 sum, multiplies, then writes the values back into the float32 buffer. The accepted file contains 6,156 nonexact raw sums, ranging from 0.999999875203 to 1.000000111060, with no negative or all-zero rows.

- **Chosen:** retain both raw and loader-normalized arms and reproduce reciprocal multiplication plus float32 storage exactly.
- **Alternative:** report raw export weights alone with that narrower label. This would omit the loader-normalized baseline.

The final implementation uses the chosen method; direct division was replaced before execution so operation order matches the source.

### Keep direct XYZ skinning within its admitted frame

The computation omits general nonidentity mesh bind transforms. Actual `Human` and its armature container are identity, and default body morphs are zero.

- **Chosen:** assert those properties and keep the bridge specific to this asset.
- **Alternative:** implement and separately qualify general mesh/bind-frame conversion before extending fixtures.

The identity and zero-morph assertions passed. This is no evidence that omitted general transforms are safe for other assets.

## Actual failure controls

Wrong global axis mapping fails at 2,347.862663 mm. Shifting every world joint by 5 mm while retaining old body and inverse binds fails at 5.000318485 mm. Both have verified passing clean parents, nonzero mutations and preserved changed data. No gate or packet repair was needed.
