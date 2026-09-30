# Independent native refit critique

## Disposition

**Accept this bounded arithmetic and helper-coordinate proof.** Native V2 and the JS comparison satisfy the unchanged [plan](PLAN.md) for g050 and the two declared detail targets at joint weights 0, 0.25 and 1. This supplies the native oracle missing from September 26. It does not qualify the installed corrected garment, visual fit, motion, other identities, foundations or skeleton refitting. Keep accepted assets and defaults unchanged.

Reviewed native V2 PID 56774, completed 2026-09-30 17:01:27.207716 UTC, and comparison PID 58235, completed 17:02:16.575 UTC. Native V1's schema failure remains preserved. No native application, browser or GPU work was launched by this critic; independent calculations read the saved arrays and source archives.

## Evidence identity and independent checks

- [Native V2 report](../../../../captures/wardrobe-native-oracle-2026-09-30-v2/report.json): SHA-256 `28b28844d2e9391314650ad489e4c45c72cfd42542f088ebe931b6c9a8203261`.
- [Comparison report](../../../../captures/wardrobe-native-comparison-2026-09-30-v1/report.json): SHA-256 `72ec13e07764e185f166da410177673298026a670f5e2acb7f5eab28c5d8c7a8`.
- Captured native observer: `85b4797cf2cf32eaa688d10b3b4db9551e72564a44ec3dd7a021671b0695d010`; [comparator](../../../../tools/critic/compare-wardrobe-native.mjs): `cf115b6c2a724c459000b78f08cc0d80e6612214bd6318e13f852bff2962e101`.

I independently verified all 2,399 declared native inputs and 12 comparator inputs; all four native and seven comparison artifacts' compressed and decoded hashes; 552 native-source/data snapshots and ten comparator snapshots. The extra archived `native-mpfb` and `native-data` files were compared with their cached ZIP members, not assumed to be repository paths. All 2,384 installed MPFB archive members match the pinned ZIP. Initial and final loaded-module censuses contain the same 526 entries, each matching its source member. These checks cover this recorded dependency set; they are not a claim about every external library or Blender implementation file.

The observed Blender build is 5.2.2 LTS `d13f752e3b9c`, using the isolated profile. All three native cases retain 19,158 full body/helper vertices and 2,197 garment vertices. Every one of the 2,118 original OBJ face records exactly matches the saved native garment polygon ordering. Body and garment world matrices are identity in all cases. Both detail keys have their declared case weight, are unmuted, and remain relative to Basis. Raw native macro pairs and normalized records preserve identical values and order.

The observer captures fitter locals at native `clothesservice.py:189`, after all three scale calculations. Its saved body input equals the separately evaluated full body array exactly in every case. The source restores masking and tracing through `finally`. Reading raw `clothes.data` is appropriate to this original, pre-export arithmetic contract; it is not an evaluated subdivision-surface qualification.

## Independently reproduced results

I used a separate Python calculation rather than calling the JS comparator or kernel again: parsed the cached original mhclo, reproduced explicit float32 vector storage/arithmetic with `struct.pack/unpack`, and fitted each native body array. Separately decoded the packed SDK records as little-endian `uint32,float32,float32,float32`, applied the recorded weights and Blender `(x,-z,y)` conversion, added those deltas to the saved native neutral body, and refitted. These independently calculated arrays equal the saved JS arrays. Euclidean maximum, RMS, exact-vertex counts and worst indices were recomputed over the full arrays; they agree with the report to ordinary calculation roundoff.

| Joint target weight | Native body → JS garment, max mm | SDK body delta, max mm | Native neutral + SDK → garment, max mm |
| --- | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 |
| 0.25 | 0 | 0.0000373374923 | 0.0001194418933 |
| 1 | 0 | 0.0000447422719 | 0.0000596046448 |

Native-body fitting equals all 2,197 native garment vertices exactly in each case. The second path passes the strict `< 0.001 mm` all-body-delta bar and `< 0.1 mm` garment bar. Neutral passes before the deformed cases are interpreted. No fitted alignment or changed threshold is involved.

Concrete coordinate witnesses, in Blender metres:

- Weight 1, body vertex 4512: SDK delta `[-0.021900000050663948, 0, -0.08789999783039093]`; native delta `[-0.0218999981880188, 0, -0.08790004253387451]`. This is the maximum body-delta residual, not a garment-fit measurement.
- Weight 0.25, garment vertex 1740: SDK result `[-0.06021503359079361, -0.11151237785816193, 0.7299473881721497]`; native `[-0.06021504104137421, -0.11151237785816193, 0.7299475073814392]`.
- The earlier reconstructed neutral body agrees with native across all 19,158 vertices within 0.0008356034574 mm, worst body vertex 5709. Its 5,778-helper subset has maximum 0.0008346313179 mm at original vertex 14088: reconstructed `[0.03460200875997543, -0.15191900730133057, 1.5471258163452148]`, native `[0.03460201621055603, -0.15191899240016937, 1.5471266508102417]`. No reconstructed neutral vertex is exactly equal; this is a passing bounded approximation, not byte correspondence.

The three observed scale triples are identical: x `0.10008228481753872`, y `0.10500344378854781`, z `0.1031336559775875`. Thus these native cases validate fitting at those scales but do not exercise a changing scale-reference distance. The old synthetic scaling check retains its separate scope.

## Negative controls

All four controls fail the unchanged 0.1 mm garment bar against passing clean parents. Their raw output geometry is retained. I independently recomputed their errors against native weight-1 garment coordinates.

| Deliberate error | Maximum mm | Worst garment vertex |
| --- | ---: | ---: |
| Valid but wrong helper ID | 3.5301360938 | 0 |
| Reversed Blender offset axis | 30.5585004389 | 266 |
| Omitted helper target deltas | 106.8865717454 | 1324 |
| Injected 0.2 mm coordinate error | 0.2000000000 | 0 |

The helper mutation is substantive: original rule 0 uses indices `17090,17384,17383`; the first becomes 17384 while retaining its nonzero weight 0.16911. The omitted-helper control leaves original vertex IDs 13,380 onward at native neutral while applying skin deltas, exposing why a skin-only seed is insufficient.

## Review findings resolved before acceptance

1. **Dependency binding was initially incomplete.** The original census preceded native creation/attachment, which has local imports; known metadata reads included `macro.json`, `basemesh_vertex_groups.json` and `hm08_config.json`. Two alternatives were explicit dependency binding plus a final module census, or broad installed-archive binding plus that census. The first is smaller but requires a maintained read inventory; the second records more files and avoids those observed omissions. Root selected the second. V2's verified archive members and final census close the identified gap.

2. **V1 compared different stack representations.** [V1](../../../../captures/wardrobe-native-oracle-2026-09-30-v1/report.json) failed before any case because native `[file,weight]` pairs were compared directly with inventory `{file,weight}` objects. The options were normalize native pairs for the assertion while retaining raw pairs, or convert the inventory to pairs and keep a pair-based output schema. The latter is smaller; the former is easier to inspect alongside the existing inventory. V2 selects the former without changing arithmetic, order or weights. V1 remains a failed instrument run, not evidence of a native geometric mismatch.

3. **A failed negative control alone could be overinterpreted if its clean parent failed.** The initial comparator lacked that interpretation condition. The alternatives were retain all corrupted arrays with explicit clean-parent results, or skip negative-control interpretation after a parent failure. Retaining them preserves more diagnostic evidence; skipping is simpler. The completed comparator selects retention, records `interpretable`, and requires validated controls in its overall pass. All parents actually pass here.

No further blocking source or numerical defect was found in this packet.

## Remaining boundary and two next approaches

The arithmetic succeeds for the **original** garment. The preserved [garment correspondence study](../../nonhair-2026-09-26/wardrobe-coupling/garment-map/README.md) establishes that accepted `44eb…c783` contains a separate trouser corrective: 205 GLB vertices / 196 source vertices move, up to 23.633827738 mm. Its source vertex 2154 has a substantial upward correction. The present oracle neither applies nor validates that correction on reshaped bodies. Exact original refitting therefore cannot justify replacing the installed accepted garment or calling broader identity fit complete.

- **A — recommended next prerequisite:** use the existing exact correspondence and retained corrective residuals to define an explicit identity-dependent correction contract. Begin with a bounded inventory of which corrected garment regions and shoe/foundation/skeleton dependencies the declared identity cases move; only then choose an isolated fit candidate and actual-view/motion gates. This preserves the useful accepted work but requires a defensible correction rule rather than assuming the neutral residual transfers.
- **B — separate regenerated garment path:** construct and qualify a fresh identity-specific garment against the reshaped body, foundations and shoes, preserving accepted 44 as default. This avoids assuming the old correction transfers but reopens more authoring, export, fit and appearance work.

Either route is subsequent work. The existing 10.9 coverage/depth thresholds, skeleton coupling, foundation interactions and representative-build appearance review remain open. There are no new rendered images in this arithmetic study and no appearance improvement or all-identity pass to infer from it.
