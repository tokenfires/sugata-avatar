# Independent vertex-group reconstruction review

## Disposition

**V2 failed native reconstruction bookkeeping.** The preserved intended emission permits a bounded repair of group definitions without changing the domain geometry recipe. It does not establish that the rebuilt mesh, offset/relaxed shell or exported candidate passed any qualification gate.

Reviewed [V2 report](../../../../captures/foundation-domain-native-2026-09-30-v2/report.json), SHA256 `f5ccbd19b1dc04ea3677209ebc81a692bee9a12fce183c883b3e8d0b63de004f`, PID 39248, 22:04:44.681540–22:04:55.466115 UTC. Independently verified all **47 archived source/artifact bindings**, including encoded/decoded payloads. The [failed source](../../../../captures/foundation-domain-native-2026-09-30-v2/source/tools/critic/foundation-domain-native.py) has SHA256 `b637a18ea802dcb4a8ef3907a80bf8a46c50bdea380c80d56905f66bbd557be3`.

## Exact failure and preserved data

After line 310 assigns `shell.data=new`, the loop over existing `shell.vertex_groups` validates nothing when the collection is empty. Line 314 then attempts the first saved weight assignment and raises **`index 4 out of range, size 0`**. This directly witnesses the broken assumption that group definitions would survive the new mesh assignment.

The first intended vertex row references:

| Original index | Name | Weight |
|---:|---|---:|
| 4 | Right | 1 |
| 5 | body | 1 |
| 155 | spine_03 | 0.11769999563694 |
| 175 | clavicle_r | 0.28850001096725464 |
| 176 | upperarm_r | 0.5938000082969666 |

The error therefore occurs before even the first nondeform entry is restored. Recreating only deform bones would not repair the saved index namespace.

The encoded `domain-emission.json.gz` SHA256 is `82bd17cb91f5376e3825fa400bb3b1fc10ba186fb514cb4412a8ca16e616a140`. Independent inspection confirms:

- **204 unique named definitions**, with exact contiguous indices 0–203; all definitions remain necessary to preserve that namespace even though only 16 group indices occur in the current patch's rows.
- Intended emission has **10,869 vertices, 10,479 polygons and 267 new cuts**.
- All 10,602 original position rows, complete group dictionaries and point-mask values are exactly preserved in the intended emission.
- Independent Python float32 calculation reproduces all 267 new cut positions and full group interpolations from the saved original endpoints, without failures.

These observations establish recoverable inputs and intended data, not successful Blender readback. No completed domain band or final fit result exists from V2.

## Two alternatives

- **A — selected:** after assigning the new mesh, inspect the actual group-definition collection. If empty, recreate **all 204** saved names in original index order and assert each resulting name/index. If nonempty, admit it only if the complete map already matches. Then write the saved weights and require complete per-vertex dictionary equality. This repairs the observed failure directly while retaining the same intended emission and qualification gates.
- **B:** reconstruct topology within the existing mesh/datablock, preserving its group association. This avoids relying on group-definition recreation, but changes more native reconstruction mechanics and requires new proofs for topology replacement, stale attributes and corner ordering.

Do not renumber only the used groups, normalize their values, reduce them to four influences, or interpret this failure as a reason to change the domain contour.

## V3 source addition reviewed before execution

Reviewed [current source](../../../../tools/critic/foundation-domain-native.py), SHA256 `5fde0e904d90691d05d46b4721b4ba88e696c95095c45d5c43ddc08d0b42dec6`, and [GROUP-RECOVERY](GROUP-RECOVERY.md). Lines 313–322 record the post-assignment definitions, reject nonempty mismatches, recreate an empty collection by sorted original indices, assert exact names/indices and verify the full restored map before adding weights. The complete stored weight-row equality check remains at line 337.

**No remaining blocker found in this bounded addition.** This is an actual reconstruction repair, not merely an observer correction. V2 remains failed; a fresh native run must demonstrate the restored group map and weights and then pass all later admissions. Its output cannot inherit success from the intended emission alone. No native, GPU or browser process was launched by the critic.
