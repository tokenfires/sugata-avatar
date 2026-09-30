# Native band prototype: independent source review

## Scope and recommendation

One isolated g050 band-only prototype is a justified next observation. Keep the original anatomical band predicate and torso-bone admission; omit only its shoulder-strap branch. Keep the existing refinement, offsets, relaxation, hem roll and material. Compare with an unmodified native bra control from the same admitted body. Neither output replaces an accepted asset.

The [completed coverage critique](../foundation-band/CRITIQUE.md) establishes finite coverage feasibility, while documenting thirteen selection-induced pinches and a five-influence clipping edge. It does not qualify the proposed native construction. No native process or asset construction was performed for this review.

## 1. Load definitions without executing the production build

[build_figure.py](../../../../tools/figure-pipeline/build_figure.py) ends with unconditional `main()`. Importing it normally parses arguments, clears the scene and writes configured exports. Its imports also depend on `__file__` at lines 90–108.

- **A — recommended:** pin the complete source; parse its AST; require the final node to be exactly a no-argument `main()` expression and remove only that node. Compile with the original filename and `__file__`, retaining every definition, constant and import. Record original hash, removed node/location and transformed AST/source receipt. Refuse an unexpected final node.
- **B:** run the normal entry point in a disposable environment with every output path isolated. This preserves the usual pipeline, but constructs unrelated parts and requires a separate scoped recipe override. It is broader than the needed shell observation.

Do not edit the production builder or strip arbitrary text containing `main`.

## 2. Admit the exact construction-stage body first

The shell starts with `basemesh.copy()` and `basemesh.data.copy()`, then clears shape keys (lines 1326–1335). The normal build deliberately constructs foundations only **after helper removal and macro baking** (lines 2626–2642). An unbaked 19,158-vertex oracle object is therefore not the correct direct input: clearing its keys can lose the intended shaped surface. A GLB-imported triangulated mesh is also a different refinement input from the native mesh used by `subdivide_edges(...use_grid_fill=True)` at lines 1705–1728.

- **A — recommended:** recreate the pinned neutral native recipe, admit its full coordinates, weights and rig against the existing native packet, then perform the original helper-strip/macro-bake sequence. Verify retained source IDs, native polygon topology, body positions and rest transforms before constructing either shell. Bridge to the unchanged accepted body using the existing coordinate conversion and vertex mapping; preserve the established strict `<0.001 mm` mapped-body and `<0.1 mm` bone-witness comparisons as separate receipts.
- **B:** explicitly construct from an imported shipped body. This directly anchors its visible coordinates, but changes native topology/refinement and requires a new reference contract. It must not be labelled reproduction of the original native authoring path.

Record the body and rig again after each shell build to establish that construction did not mutate the shared input. The band rule still includes `dominant in TORSO_BONES` and the original lower bound; merely replacing the predicate with `height <= ceiling` would broaden the cut.

## 3. Carry actual masks and independent coverage targets

`write_hide_mask_attributes` creates body POINT-domain values before helper stripping and removes garment MASK modifiers (lines 837–870). `cut_conformal_shell` renames `_hide_*` to `_under_*` and removes `_decency_*` from the shell (lines 1337–1344). Runtime [Wardrobe.js](../../../../packages/core/src/wardrobe/Wardrobe.js), lines 301–357, thresholds masks above 0.5 and drops a triangle when **any corner** is hidden.

- **A — recommended:** map the exact accepted body `_HIDE_*` and `_DECENCY_*` values onto admitted native body source IDs; require all exported duplicates to agree. Preserve those body values exactly and record actual shell `_UNDER_*` values through refinement and roll. Keep independent chest targets on the body only.
- **B:** recreate the original garment attachments and mask-writing sequence, then require equality with the accepted body attributes before continuing. This gives direct authoring provenance but introduces more asset-loading and stage correspondence work.

The roll's documentation says custom data follows its source boundary vertex, but the implementation relies on BMesh extrusion (lines 1448 onward); the explicit pairing loop moves positions rather than assigning every mask/weight. Observe actual inherited attributes and full deform rows instead of treating the comment as proof. Fractional interpolated mask values must remain observable; do not force them to binary or invent replacement outer/body masks. A correct new source mask still needs actual dressed-index and floor-only coverage checks later.

## 4. Preserve full native weights and establish export correspondence

Record every positive deform-bone membership after subdivision and hem construction, with names and unnormalized sums. Preserve native evaluated rest and posed positions before any matched-weight control. The existing [posed-skin plan](../skeleton-posed-skin/PLAN.md) specifies the admitted linear modifier/hierarchy and separates unmodified native weights from exported-four controls; its observed full-reference failure cannot be erased by a matching reduced-weight pass.

The new shell's vertex order is not the old body map. Export can split vertices for normals/UVs. Establish a complete native-final-vertex-to-export-corner mapping, and preserve material, UV, normal, mask, joint names, inverse binds and raw/loader-normalized weights. Use explicit diagnostic provenance or unambiguous full-attribute matching; refuse ambiguous correspondence rather than accepting a nearest-position match.

Root's proposed pre-strip source-ID attribute is appropriate for body admission, but subdivision can interpolate it on the shell; those new values are not original source IDs. Use the separate postconstruction native-index attribute for export mapping. Unique diagnostic IDs can prevent otherwise possible exporter deduplication. Alternative A, recommended for this isolated prototype, is to retain that attribute and qualify those exact exported bytes. Alternative B is a second export without diagnostic attributes plus an independent corner/geometry/weight correspondence receipt; it adds work but establishes a production-like artifact. Also compare the reconstructed full-bra control to the accepted original explicitly; shared native input alone does not establish their equivalence.

- **A:** retain complete native influences in an explicitly supported isolated representation. This avoids silent truncation but broadens storage, renderer and integration obligations; prior eight-influence arithmetic probes are not production support.
- **B — smaller initial export scope:** retain current four-slot export, inventory every dropped/reweighted influence, and compare its actual posed output with the untouched full-native shell under a separately declared finite gate. A labelled matched-four native control can distinguish arithmetic from representation loss, but cannot rescue a failed full-native comparison. The existing `<0.342 mm` bar must not be loosened in response to this candidate.

Admit actual modifier settings and pose matrices, reset poses explicitly, and retain identity and controlled torso/arm observations. A finite binding pass is not a clothing-motion or normal/tangent pass. Runtime additionally rebinds fragments by bone name to the body skeleton; inspect actual exported matrices and remapping rather than relying on matching joint order.

## 5. Keep hem and appearance obligations explicit

The unchanged pipeline refines the region, offsets/relaxes it, then calls `roll_the_hem` (lines 1346–1384). `describe_foundation` rejects an absent roll and checks post-roll clearance (lines 1846–1920), but those existing checks do not establish complete triangle/body or self-intersection clearance.

Before any appearance disposition, inspect the new mesh's complete vertex links, boundary loops, winding and actual roll geometry; preserve the original body targets and both relevant floor configurations. Then inspect actual matched dressed and foundation-only views. If a construction or binding prerequisite fails, preserve that candidate and diagnose the witnessed stage before considering another recipe.

**No intrinsic blocker to one isolated construction was found.** The stage-body admission, actual mask inheritance and full-native/export correspondence above are prerequisites, not completed results. No broader identity range, runtime transition, moving coverage, garment physics or promotion is implied.
