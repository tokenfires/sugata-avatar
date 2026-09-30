# Independent source review — intersected band boundary

## Verdict and scope

**No remaining material source blocker to one isolated native observation was found.** This is preflight approval of the declared experiment, not a prediction that its interpolation, topology, clearance or appearance will pass. Root owns execution and runtime cleanup. I did not launch Blender, a browser, or an authoring job.

Reviewed [PLAN.md](PLAN.md) and [foundation-cut-band.py](../../../../tools/critic/foundation-cut-band.py), source SHA256 `9fd88f3a5541a5748aa8534ab9d6f39916597717a7ebd48830d7abb789ab2f59`. The frozen parent remains unchanged. Its actual stepped upper rim and toothed lower hem, documented in [VISUAL-CRITIQUE.md](../foundation-native-band/VISUAL-CRITIQUE.md), justify changing boundary representation once. They do not justify changing anatomical heights, refinement levels, offset, relaxation, masks or qualification thresholds in this observation.

## Construction ordering and float32 membership

The source admits the exact production builder and removes only its final zero-argument `main()` call. It deep-copies `cut_conformal_shell`, gives the clone a separate name, admits one `normals` assignment anchor, and inserts only `refined = cut_patch_at_planes(...)` immediately before that anchor. The original function remains available for the unchanged band control. The inserted function text and its hash are recorded.

This ordering preserves the padded, fully refined native patch through both bisections. Each uses `dist=0` and neither half is removed. The original normal snapshot, support mesh, offset taper, clamp and relaxation then operate on that complete split patch; final retention and rolling remain in their original order. This matters because [build_figure.py](../../../../tools/figure-pipeline/build_figure.py:1735) discovers taper ring zero through neighbours outside the selected region, and its relaxation pins vertices with an outside neighbour. Splitting after offset, or deleting the outside half before calculating normals, would be a different experiment.

Nominal anatomical values are recorded separately from nearest float32 effective planes. Only vertices returned in `geom_cut` are snapped to the effective Z value; each displacement is recorded. Existing vertices must retain exact positions, deform rows and masks. Selection uses inclusive effective planes and the original torso dominant-bone rule. It does not silently enlarge a tolerance until a cut succeeds. The code requires each new vertex to correspond uniquely to one pre-split crossing edge within the fixed 0.001 mm position bound. Unexpected BMesh return membership or ambiguity stops the observation.

## Two preflight findings, both addressed

### 1. Two loops alone would not exclude an interior-height notch

**Source witness:** the original region predicate rejects a vertex whose dominant bone is outside `TORSO_BONES`, independently of its height (`build_figure.py:1045` and `region_on` at 1685). A notch connected to a rim can retain two loops and Euler characteristic zero. This was an admission gap in the initial contract, not an observed defect in an unbuilt candidate.

- **A — selected and implemented:** enumerate the actual retained-face boundary before offset. Every edge must have both ends on one effective plane, with exactly one connected degree-two loop per plane and no unaccounted boundary edges. Also require the selected plane-vertex set to equal the selected vertices with outside neighbours. Source lines 249–277 implement these checks. This provides a direct geometric/topological receipt without changing membership.
- **B:** track the bisection-created cut edges and require the retained boundary to equal those two recorded loops exactly. This gives stronger operation provenance but requires more bookkeeping through BMesh edge creation and reuse.

The adopted check refuses mixed torso classification that creates another cut; it does not repair that classification or infer band feasibility from the original two-loop result.

### 2. Numeric deform-group keys needed a recoverable name map

**Source witness:** interpolation witnesses use BMesh deform group numbers in `expectedWeights` and `actualWeights`, while `native_mesh` ordinarily records only named positive deform rows. Without their relationship, a recovered witness could not identify a group independently of an assumed ordering.

- **A — selected and implemented:** archive every live vertex-group `{index, name}` pair in each pre-cut snapshot and cut receipt; admit every endpoint/new-vertex group index against that table (lines 156–159, 212 and 239). This is a small explicit provenance record and preserves nondeform groups as well.
- **B:** write the interpolation observations directly by group name. This is more readable, but requires unique-name admission and care not to discard nondeform memberships during serialization.

## Interpolation and seam receipts

For each split, the source archives the complete working patch before and after. It calculates each crossing parameter from the effective plane and the actual pre-split endpoints; the expected position, full group-weight union and every inherited point mask follow that parameter. The fixed component limit is 0.000002. The second split receives its own pre-split snapshot rather than pretending that all its edges existed before the first split.

The temporary face ID distinguishes the two sides of a UV seam. Each new loop must belong to an original face adjacent to the matched crossing edge, and its expected UV is interpolated from that face's own endpoint corners. This avoids averaging UV values across a seam. The temporary face layer is removed before the construction continues. These are explicit receipts for newly created corner interpolation; final native/export corner normals, UVs and topology still require the separate comparator. No native result is inferred merely because BMesh normally interpolates custom data.

Old vertex position/weight/mask equality is checked directly. New-vertex counts, unique matches, complete crossing coverage and returned-cut membership are admitted. An interpolation guard failure must remain a failed observation; no fallback to nearest arbitrary vertices or four-weight truncation is authorized.

## Unchanged control and downstream boundaries

The original constructor runs first on the same admitted body and band predicate. Its reference `band-native.json.gz` is hard-pinned to `124370fda57558ba6a4b6efabe9b09355f275625bbd3b58446db9c4894532b35`. The equality check includes positions, vertex/corner normals, polygons, triangles, loop mappings, UV layers, smooth/custom-normal/sharp metadata, masks and complete native weights. It excludes expected object/material naming differences. Thus a normal or UV change in the control cannot be hidden by position equality alone.

The existing body/source mapping, transferred mask values, rig/rest/full-weight admissions and identity/elbow/coupled native observations are retained. Candidate export still carries the postconstruction `_NATIVE_VERTEX` diagnostic attribute; correspondence applies to those exact bytes. New interpolated vertices may exceed four influences. The unchanged full-native 0.342 mm comparison must judge the actual loader-stored four-slot result without truncating the oracle or transferring the parent's pass.

After construction, one component, two simple loops, Euler zero, valid vertex links, no degenerate triangles and correct winding remain required. The original 110 targets, supplementary 3,780-sample coverage prerequisite, full accepted-body rest audit and actual any-hidden-corner wardrobe masking remain separate gates. The fixed controls and interpolated cut do not prove a smooth rendered rim: offset, relaxation, roll and export can still introduce a visible failure. Inspect the actual foundation-only and dressed originals before deciding any next work. No motion, wider identity range or promotion is qualified by this source review.
