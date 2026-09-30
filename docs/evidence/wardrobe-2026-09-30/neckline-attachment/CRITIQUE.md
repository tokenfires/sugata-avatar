# Independent attachment-boundary critique

## Verdict

**The declared full-body-exterior attachment closure found no admissible cycle. Close this method with its seed, growth rule and 1 µm guard unchanged.** Its failure is supported by real triangle intersections and containment, rather than a near-contact tolerance alone. It does not prove every local visual neckline repair impossible, require a whole-bodice replacement, or count visible defects.

No garment or mask was changed. No native/GPU process or closure rerun was performed by the critic. The next justified bounded question is a separately authored lower-cut foundation's coverage feasibility, before any candidate construction; rationale and alternatives follow below.

## Evidence and source review

Reviewed the [declared plan](PLAN.md), [inventory source](../../../../tools/figure-pipeline/neckline_attachment_inventory.mjs), complete [result](../../../../captures/neckline-attachment-2026-09-30-v1/report.json) and [terminal supplement](../../../../captures/neckline-attachment-terminal-2026-09-30-v1/report.json).

Independently verified:

- Main report SHA256 `6e2fb1fea5470e73188a68f67c9c5d48eacf33663eabb7c3e3c2ee7b6db6b0ca`, all 27 declared pins, 19 archived source copies and the saved snapshot hash.
- Both original snapshot files match their report's compressed and decoded hashes. The complete recorded body, shirt, bra and briefs mesh objects and rig match exactly between old `accepted-0` and current Neutral portrait. The saved inventory snapshot equals the old snapshot.
- All 1,273 stored classification decisions agree with their recorded distances, winding and parity under the declared rule. Stored additions are disjoint from the prior region; their union reproduces the final 1,219 faces. This checks the recorded transitions without rerunning the closure or geometric classifier.
- The terminal report SHA256 is `3c36860ff0fa5b843e08b0e0082d7f62e478474a1677a330fd3e040d37213b37`; its four pins, touched-edge coordinates and membership in the last addition agree.

The implementation uses every retained face incident to a separating vertex, rather than just edge-adjacent faces. It adds bad faces and the complete stars of their current separating vertices simultaneously. Classification is cached against unchanged geometry. Every nonterminal iteration adds a previously retained face, so the finite shirt bounds termination. It stops before trying to certify an attachment when another opening is reached.

The exact source shirt independently reconstructs as 2,524 faces and 1,311 welded vertices: 1,209 cycle links and 102 path links, with no invalid vertex links. The declared seed is 240 faces after adding raw vertex 312's full star; it has 146 vertices, 94 cycle links and 52 path links. No source or seed pinch was observed. Explicit link checks were added for the source shirt and potential final region/retained shirt; the final admissibility branch was not reached in this failed run. Do not report a final annulus or final-strip clearance receipt that was never produced.

Two preflight choices were appropriately resolved:

- **Empty briefs:** the actual retained briefs index set is empty. Alternative A, selected, records count 0 and null distance and skips its query. Alternative B was a nonempty-only target list plus separate exclusion inventory—simpler querying, less uniform reporting. The full briefs mesh was not substituted.
- **Vertex links:** edge manifoldness and Euler accounting alone are weaker receipts. Alternative A, selected, explicitly checks connected path/cycle links and rejects duplicate link edges. Alternative B would rely on a separately pinned source-manifold proof plus combined-boundary reasoning, which is less straightforward to maintain. Neither change edits geometry or relaxes the result.

The body receipt reports one closed, oriented component, Euler 2 and zero posed weld separation. Twelve existing geometric controls and six segment-distance controls are recorded passing. These do not constitute interval proofs or a global body self-intersection audit.

## Actual obstructions and termination

Across nineteen recorded iterations, the region grows from 240 to 1,219 of 2,524 shirt faces. There are 718 inadmissible classified faces: 531 contact/near-contact records and 478 inside-centroid records, with overlap. All growth reasons concern the full body. None concerns bra separation; retained briefs are explicitly empty. No classified centroid has an ambiguous parity ray in this result.

Two independently recomputed intersections demonstrate why positive vertex samples or outside centroids are insufficient:

| Actual saved-pose witness | Independent observation |
| --- | --- |
| Shirt 190 versus body 15494, first iteration | Transverse segment endpoints approximately `(0.0731588772,1.2800292888,0.1240983566)` and `(0.0731502540,1.2744145230,0.1272220334)` metres. Independent segment/triangle reconstruction agrees with the stored endpoint within 2.28e-16 m. All three reported vertex signs are positive, yet the full triangle crosses and its independently recomputed centroid winding is 1. |
| Shirt 2209 versus body 7504, last iteration | Transverse segment endpoints approximately `(-0.0766056108,1.0970954009,-0.0374185672)` and `(-0.0727148692,1.1042449196,-0.0381983990)` metres. Endpoint agreement is within 2.87e-17 m. Its centroid is outside, but that does not remove the crossing. |

The prior rejection control remains valid: raw vertex 312's independently recomputed winding is 1.0000000000000002. Shirt 2128 supplies a separate contained-surface witness: positive unsigned separation 1.493853 mm, independently recomputed centroid winding 1. These distinctions substantiate the full-triangle and volume checks.

Termination is at the **lower hem**, not a sleeve or exhaustion. The last addition includes faces 245/948/1717/1784, which touch four edges of the 40-edge lower opening: `159:287`, `550:691`, `550:910`, `159:945`. Their endpoints lie at world Y 0.904227–0.910229 m. Both 21-edge sleeve openings remain untouched. Those edge keys use welded-group IDs; they must not be confused with raw vertex 312's separate inside-body witness.

## What this means for the visible neckline

The [current Neutral portrait](../../../../captures/neutral-studio-2026-09-30-v2/feature-casual-portrait-neutral.png) still has the grey islands around x198–220/y695–736 and x504–523/y712–738. The [earlier material-tag/ray attribution](../neckline-attribution/CRITIQUE.md) establishes retained-bra ownership in that sampled view. The full-body obstruction counts above are a different property.

[Wardrobe.js](../../../../packages/core/src/wardrobe/Wardrobe.js), lines 73–89, explicitly describes the existing mask-based layering contract. Its historical penetration percentages were not remeasured here. However, the two independently reconstructed body witnesses 15494 and 7504 are absent from the actual drawn body indices. Independently checking the 531 recorded contact/near-contact rows gives 485 stored nearest body targets masked and 46 drawn. This examines one retained nearest target per row; it does not establish that the corresponding garment face has no other drawn-body crossing, nor that any crossing is visible.

Consequently, this strict exterior-boundary failure must not be converted into a visual-defect count or a claim that broader reconstruction is mandatory.

### Two structural directions for the failed attachment method

- **A — a deliberately body-exterior upper bodice:** choose new chest, shoulder, rear and lower joins as an authoring contract, then construct and qualify the surface. This addresses a stricter physical-fit goal and permits coherent new topology, but entails substantial fit, UV, binding, foundation and motion work. The present failure does not prove it necessary for the visible chips.
- **B — a new rendering-aware local attachment contract:** assess complete actual drawn body/foundation surfaces and explicit opaque coverage obligations, while preserving masks and their limitations. This could preserve more of the existing garment. It needs independent multi-view and moving coverage evidence; today's failed full-body result cannot be relabelled successful, and merely ignoring masked nearest targets is insufficient.

Neither direction authorizes another closure run, a different guard, a larger radius or a new asset under this packet.

## Recommended next bounded action

Prefer the distinct **lower-cut foundation feasibility** over starting a whole-bodice rebuild now. [Foundation authoring](../../../../tools/figure-pipeline/build_figure.py), lines 1038–1054, separately defines an anatomical bust band and shoulder straps. That supplies a concrete design alternative tied to the visible retained-bra ownership.

- **A — selected recommendation:** inventory the exact band/strap transition against the independently defined existing chest-coverage target and each applicable foundation-only floor state. Identify mixed boundary triangles and source/body mappings; establish whether a new lower-cut foundation can preserve required coverage without the exposed high straps. Keep outer shirt/body masks, protected targets and accepted assets unchanged. This is a smaller appearance direction, but source-space height separation alone is not coverage proof. Only after that evidence should one isolated construction be considered, followed by actual view and motion review.
- **B — retain the present foundation and pursue an intentional outer-bodice replacement:** this preserves the existing foundation design and can solve broader garment shape concerns, but is a much larger construction task with the attachment and fit obligations above.

No stronger alternate visible product defect was established in this review. The foundation feasibility is sufficiently distinct and evidence-grounded to be useful; it should not turn into strap-position, mask-deletion or clearance-threshold tuning. Today's attachment study remains closed and failed under its original contract.
