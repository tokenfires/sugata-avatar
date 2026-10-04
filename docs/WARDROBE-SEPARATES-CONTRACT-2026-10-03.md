# Existing pieces: geometry lead, incomplete authoring ownership

Sugata's tee, trousers, blouse and skirt can supply separate source triangle sets without cutting a triangle. That useful result does **not** make them independently wearable: the current body and manifest declare whole-outfit hide masks. The two inspected outer garment primitives contain no `_UNDER_*` attributes; foundation GLBs were not inspected, so no per-piece foundation-occlusion authority is established. No assets or reachable combinations changed.

The [single CPU ledger](evidence/nonhair-2026-10-03/separates-feasibility/OWNERSHIP.json) retains every original triangle ordinal, attribute accessor metadata, source hashes, indexed connectivity and exact-position alias observations. The [independent review](evidence/nonhair-2026-10-03/separates-feasibility/CRITIC-RESULT.md) and [receipt](evidence/nonhair-2026-10-03/separates-feasibility/RECEIPT.md) qualify the narrow decision.

| Existing source region | Original vertex ordinals | Original triangles | Source vertex array |
| --- | --- | ---: | ---: |
| Tee, casual suit | 0–1426 | 2,524 | 2,377 |
| Denim, casual suit | 1427–2376 | 1,712 | 2,377 |
| Skirt, elegant suit | 0–407 | 728 | 2,424 |
| Blouse, elegant suit | 408–2423 | 3,464 | 2,424 |

All 8,428 triangles are region-pure. Casual has six indexed components; elegant has ten. Components are not semantic garment counts. Neither asset has exact decoded-position aliases across its upper/lower region boundary; this is not tolerance welding, a seam-closure test, or a fit result. Region names come from the existing material recipe and observed complete outfits.

The accepted casual source is `assets/wardrobe/female_casualsuit01/g050.glb`, SHA256 44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783. Elegant is `assets/wardrobe/female_elegantsuit01/g050.glb`, SHA256 0acd22bbf9a847de6fa051bec0860157b72ba626f9504a26f8313713938f1440. These exact arrays underpin the ledger. A future exporter must preserve every retained source position, normal, UV, joint and weight association, triangle winding, skeleton binding and source-to-output ordinal map. Keeping full source arrays with separate index sets is a possible control; compacting vertices requires an explicit exact map. Neither has been exported or rendered here.

The glTF specification defines primitive indices against equally sized vertex attribute arrays, and separate joint/weight attributes for skinning. It supplies data-layout rules, not wardrobe coverage semantics. The fetched primary document confirms why a partition must preserve attribute and skin associations; this study does not validate every glTF rule or numerical weight. [Khronos glTF2 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes)

Before construction can be admitted, a new authoring contract must name:

1. **Independent coverage owners.** Explicit body and foundation-under masks for each piece, with visual waist, neckline, sleeve and skirt/leg coverage responsibilities. Whole-suit masks cannot be copied into a top-only or bottom-only declaration. No height/nearest-region/generated-mask inference is qualified by this ledger.
2. **Material owners.** Four new experimental piece IDs and verified source provenance. The existing factory accepts qualified whole-suit hashes and uses source `vertexIndex` thresholds; reindexed separate assets cannot silently inherit that identity. Preserve imported cloth detail and independently specify colour/material behavior.
3. **Slots and boundaries.** Decide each piece's BASE body slots and overlap/hem treatment from its intended design, then test real compatibility. The existing combined suits occupy TORSO/ARMS/HIPS/LEGS; colour labels do not author a pleasant waist join.
4. **Complete qualification.** Retain current suits as controls. Review tee/denim, blouse/skirt, tee/skirt and blouse/denim on the declared g050 body with foundation and shoes, whole and close oblique views, rest and relevant expressive/head/body motion. Verify body/foundation/garment contact, mask coverage, exact settings/save/reload and every reachable combination before exposing mix-and-match. Broader identities need their own coupled fit gates.

**Decision:** retain these exact geometric partitions as reusable authoring leads; defer complete separates construction until independent coverage/material/slot ownership exists. This reduces uncertainty about mesh cutting while preserving the complete wardrobe goal in PUNCHLIST 9.12. The current visible examples remain two combined outfits. Overall character finish, expression, representative bodies and AAA quality remain open. Do not respond to the mask gap with another local offset/mask tuning or closed source-preview chain.
