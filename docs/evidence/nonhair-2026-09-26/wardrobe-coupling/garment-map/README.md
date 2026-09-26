# Exact source-vertex map for the pinned casual garment

All **2,377 GLB vertices map uniquely to the 2,197 source OBJ/mhclo vertices**. There are no unmatched or ambiguous garment vertex IDs. Positions were not used to choose the map.

The [sealed map](proof-v1/map.json.gz) contains the zero-based GLB→source vertex array, each UV witness and matching original `vt` IDs, every GLB triangle's source quad, and the two triangle IDs assigned to every source quad. The [report](proof-v1/report.json) binds source code, the cached OBJ, both GLBs, prior CPU evidence and compressed/decoded output hashes. Its map applies only to those exact assets.

## Discrete proof

The current source/tool inventory contained the body map but no existing source-OBJ garment map. The trouser fitter's position/normal grouping serves smoothing and was not reused as correspondence evidence.

The mapper's API accepts only source UV records/faces/counts and GLB UVs/indices. For this asset, the declared storage conversion is `u=float32(raw u)`, `v=float32(1-float32(raw v))`. It produces an **exact bit match**, with no UV epsilon, UV search radius, coordinate alignment or nearest-position fallback.

| Witness | Result |
| --- | ---: |
| Source OBJ vertices / quad faces | 2,197 / 2,118 |
| Source OBJ `vt` records | 2,406 |
| Distinct transformed UV pairs | 2,377 |
| GLB UV pairs identifying exactly one source vertex | 2,377 / 2,377 |
| GLB triangles identifying exactly one source quad | 4,236 / 4,236 |
| Source quads tiled by two consistently wound triangles | 2,118 / 2,118 |

For each quad, all four corners occur, each boundary edge occurs once, and the one diagonal occurs twice with opposing directions. Every source vertex and every GLB vertex is used. Thus matching UV pairs is also checked against the full discrete surface topology, not merely a count.

Twenty-nine UV pairs have two equivalent source `vt` record IDs, both attached to the same source vertex. Those IDs remain explicit in the witnesses; no unique original `vt` record is invented. They do **not** create ambiguity in the requested garment vertex mapping. The implementation stops with an unresolved set if a UV pair names different source vertices; it does not attempt a coordinate-based rescue.

Original `109dad…5160` and accepted `44eb…c783` have identical UV, index, joint-index and skin-weight accessor bytes, plus identical node, skin and material records. The same map is independently admitted against each one's UV/index arrays.

## Coordinates are checks, after correspondence

The previous full-body CPU reconstruction retained a maximum mapped-body discrepancy of **0.000716806261 mm**, with native helper validation still absent. With the new discrete garment map, its neutral original-mhclo output differs from the pinned original exported garment by maximum **0.000482622824 mm**, RMS **0.000237471188 mm**, over all 2,377 GLB positions. The existing planned 0.1 mm garment-coordinate comparison bar is unchanged. This is a useful comparison against the retained original export; it is not a new native MPFB execution or a deformed-identity oracle.

The [accepted-minus-original residuals](proof-v1/accepted-residuals.json.gz) characterize the existing trouser correction:

- **205 GLB vertices / 196 original vertices** move; maximum displacement is **23.633827738 mm**.
- Every moved vertex originally lies between **0.076937154 and 0.336864799 m** in glTF Y, below the existing 0.35 m correction boundary.
- Every UV split of a source vertex has the exact same original position and accepted displacement. No source-vertex correction conflict remains hidden by aggregation.
- **248 GLB vertex normals** differ. All unchanged positions are exact, and topology/UV/skinning remain exact as above.

Every moved vertex's original/accepted coordinates and delta are retained. The worst is GLB vertex 2328 / source vertex 2154: approximately −0.574 mm X, +23.345 mm Y, +3.638 mm Z. These are rest-accessor residuals, **not a body-dependent corrective rule**. They were not applied to any new body or exported asset.

## Validation and rerun

Five focused analytic groups pass: either valid quad diagonal; invariance to unused source position values; explicit UV ambiguity; invalid indices/missing UV/reversed winding; corrupt mapped IDs; and equivalent `vt` records. Four actual-data controls also reject a wrong valid source ID, reversed GLB triangle, absent GLB UV and a source UV shared by different vertices. The last control's precise unresolved set is retained in [ambiguous-control.json.gz](proof-v1/ambiguous-control.json.gz).

```sh
node docs/evidence/nonhair-2026-09-26/wardrobe-coupling/garment-map/map-topology.selftest.mjs
node docs/evidence/nonhair-2026-09-26/wardrobe-coupling/garment-map/prove-map.mjs proof-next
```

The proof requires a fresh output directory. It reads the pinned cached OBJ and existing assets without modifying them, rereads input hashes at completion, and preserves the sealed earlier CPU kernel/proof. Three compressed output files total **80,442 bytes**.

No Blender installation, native refit, GPU work, asset export or core/default edit occurred. This closes the discrete correspondence prerequisite for the pinned assets. It does not close native helper correctness, continuous identity fit, corrective behavior across bodies, skeleton/foundation coupling or motion qualification; 9.4 remains held.
