# Outer-cloth fit observation — 2026-09-09

**Rejected for promotion.** One bounded scratch fit removes the prominent front foundation and sock patches, but collar self-contact and cuff/shoe contacts remain. Shipping wardrobe GLBs, masks, foundations, materials and runtime are unchanged.

The original `_UNDER_*` masks were copied from body hide masks before the foundation shells were subdivided and offset. At runtime, any marked corner removes its whole triangle. The retained inner shells can nevertheless sit above outer cloth that clears the body skin: measured front protrusions reached 2.024 mm for the bra, 1.321 mm for briefs and 4.401 mm for socks. This is an outer-cloth fit defect; hiding the foundation or changing a mask threshold would not establish a correct fit. Shoes01 also combines shoes and socks in a FOOTWEAR mesh without `_UNDER_*` fields.

The sole candidate lifts outer cloth toward the actual retained inner envelope, with a 0.5 mm target and fixed displacement caps of 4 mm for elegant and 6 mm for casual. It preserves topology, UVs, skinning, textures, materials, all opening/hem boundary positions and unaffected regions. Coincident seam vertices share the same shift. It does not change the foundation or its mask semantics. Elegant moves 608 vertices; casual moves 256. The full recipe and unresolved constraints are archived.

## Authored-coordinate checks

These counts use common authored GLB coordinates, before Avatar morphing and skinning. All four supported torso/hips foundation pairings were checked. All 20 existing decency-ray checks (16 outfit/arm/pair combinations plus four foundation-only states) had zero exposed CHEST/GROIN/SEAT vertices.

| Contact pairs | Elegant control → candidate | Casual control → candidate |
|---|---:|---:|
| Drawn bra | 588 → 154 | 262 → 262 |
| Drawn vest | 681 → 276 | 456 → 456 |
| Drawn briefs | 185 → 0 | 0 → 0 |
| Drawn boxer | 145 → 0 | 0 → 0 |
| Drawn body | 105 → 65 | 232 → 232 |
| Shoes and socks | 0 → 0 | 409 → 129 |
| Nonadjacent self-contact | 53 → 80 | 2 → 2 |

The elegant collar is the concrete regression: all 32 added self-contact identities touch its separate 160-triangle leaf. Lifting the torso while preserving that attachment causes it to run into the collar. The cuff retains two sock contacts; shoe uppers retain additional contacts. More uniform outward displacement is not justified.

## Actual Avatar observation

Four matched control/candidate arms produced 24 images and eight full geometry states at rest and 4 seconds of natural motion. Views cover upper front, lower front and a 35-degree collar angle. The original control is unrouted; each candidate routes only its exact outer garment GLB. The actual foundation pair is the showcase bra/briefs combination.

The front chest, skirt and sock patches disappear at both observed poses, without an obvious broad silhouette change. The small pale collar-tip defect remains. These views do not expose the rear-cuff residual. Every per-draw camera, geometry, velocity, rig and time restoration passed; matched arms have identical body/foundation/shoes/hair states and cameras. Source hashes stayed fixed, all screenshots were nonblank, and no page, console or network errors occurred.

Actual morphed/skinned geometry has different counts and must remain separate:

| Actual contact | Rest control → candidate | 4 s control → candidate |
|---|---:|---:|
| Elegant bra | 663 → 163 | 678 → 145 |
| Elegant briefs | 185 → 0 | 185 → 0 |
| Elegant drawn body | 253 → 219 | 359 → 322 |
| Elegant self-contact | 140 → 171 | 139 → 175 |
| Casual shoes and socks | 406 → 128 | 410 → 132 |

Every added elegant self-contact still involves the separate collar leaf, and every remaining elegant bra crossing lies above Y=1.36 m in these two poses. Casual body, bra and self-contact counts are unchanged. Socks improve from 284 to two pairs at both poses; shoe-upper counts increase by four. Aggregate improvement is not a claim that no contact identities were added.

This is useful mechanism evidence and a visible local improvement, not a whole-outfit or motion acceptance. Root reviews the fixed result before any narrower accepted region or distinct collar/cuff correction. No second fit variant was made.

The [compact ledger](evidence/wardrobe-fit-2026-09-09.json) pins exact inputs, candidates, checks and archive hashes. The ignored local archive is `captures/wardrobe-fit-2026-09-09/`: start with `fit-v1/visual-findings.md`, `fit-v1/views/report.json`, `fit-v1/posed-audit.json`, and `original-audit/report.json`. Its manifest verifies 78 files totaling 147,973,264 bytes; captures are diagnostic evidence, not portable production inputs.
