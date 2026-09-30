# Independent material review — custom wardrobe colours

## Disposition

**Accept the bounded static part-mapping and visible-detail observation. The exact-image property remains failed. Combined native UI qualification is separate and pending this review.** No material or shader adjustment is justified by the inspected examples. These are illustrative custom inputs, not qualified fashion presets or universal colour accuracy.

I directly inspected all 16 original PNGs in [the completed packet](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/report.json): four current-main base views, and twelve integration views covering base/custom/returned base for Casual and Elegant at yaw 0 and 145 degrees. I did not launch a browser, alter assets, or rerun rendering.

## Source and recorded controls

The preceding source review covered main `73b37b1` plus the staged wardrobe-colour port in the reused integration worktree. No proved integration blocker was found. Hair base/tint and wardrobe overrides use separate fields; each Apply preserves the other system's applied configuration. Palette reset clears wardrobe overrides only. Report export, URL/JSON reconstruction and named-look canonicalization retain both recipes, while draft edits stay outside the applied configuration. Original refuses wardrobe overrides before loading. The qualified asset allowlist, garment masks, geometry and default recipes are unchanged. These source observations do not replace the forthcoming combined UI run.

The [capture source](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/capture.mjs:15) creates independent pages against main and integration. The fixed choices are Ecru, Studio, g050, relaxed-standing, body framing, Brown hair `#413934` with tint `#8063ac` at 0.35. Casual overrides are Top `#617a70` and Shoes `#252a30`; Bottom is omitted. Elegant overrides are Top `#627e9b`, Bottom `#4b354f`, Shoes `#35291f`.

I independently verified:

- All 16 PNG hashes and compressed/decoded state hashes match the report; the four outfit/view groups have exactly equal decoded fixed state across their respective main/base/custom/return arms.
- All 273 archived baseline source bindings and 278 feature source bindings match their recorded hashes. Asset hashes do not differ between phases. The captured source and plan hashes also match.
- The recorded state contains CPU-skinned body/worn positions, full/drawn indices, rig, physical hair hashes, camera and lights. Final frame/grain are 99, time/delta zero, with matching temporal epoch records. These are observed controls, not a complete census of GPU or renderer history.
- Every arm records the expected applied configuration and attached material identity, matching loaded GLB response digests, completion, disposal and an empty leaked-handle list. Recorded browser/page/request errors are empty. Retained warnings include rig fallbacks, zero-index draws, inline TSL returns and adaptive-contact shader unreachable-code warnings; “no errors” must not be rewritten as “no warnings” or a complete device/memory guarantee.

The report's colour observation remains **creation-time recipe plus attached material identity**. [Wardrobe.appearance()](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/source/feature/packages/core/src/wardrobe/Wardrobe.js:582) checks that each applied material object is still attached and returns immutable recipe metadata. It does not detect arbitrary edits inside that same material's node graph. No supported UI path makes such edits. Two scope choices are: **A**, retain this ownership contract and state it precisely, requiring no feature expansion; or **B**, add node-recipe integrity tracking if external mutation detection later becomes a requirement, at the cost of shader-specific maintenance. A is sufficient for this slice.

## Actual appearance observations

Approximate image regions refer to the original 900 × 868 files. They locate visible features and do not establish per-pixel mesh ownership.

| Pair | Observation |
|---|---|
| Casual front [base](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-casual-0-base.png) / [custom](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-casual-0-custom.png) | The torso/sleeves around x325–547/y165–407 change from Ecru to muted green. Neck/cuff tone separation and cloth shading remain visible. Denim pockets and leg shading below y405 retain their base appearance; shoes near y785–847 darken. No new broad tint spill onto skin or denim is apparent. |
| Casual rear [base](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-casual-145-base.png) / [custom](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-casual-145-custom.png) | The left sleeve/side around x357–412/y182–396 shows the green change clearly; the back is dominated by the pre-existing blue Studio rim. Denim seams, pockets and shading persist. Shoe leather darkens, with its form and highlight still readable. The trousers largely conceal socks here. |
| Elegant front [base](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-elegant-0-base.png) / [custom](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-elegant-0-custom.png) | The blouse becomes muted blue while vertical stripes, front opening and sleeve folds remain visible around x312–557/y170–432. The skirt below y395 becomes plum, separately from the blouse. Dark socks around y735–788 retain their distinct base-owned region while the shoes use the custom brown. |
| Elegant rear [base](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-elegant-145-base.png) / [custom](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/feature-elegant-145-custom.png) | Blouse stripes and waist/sleeve folds remain visible. Its left side and the skirt's left strip distinguish the blue/plum inputs; the large lit back regions remain strongly blue in both arms. Socks remain a separate dark region above the shoes. No new broad seam in colour assignment is apparent. |

These results agree with the [archived recipe](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-2026-09-30-v1/source/feature/packages/core/src/wardrobe/WardrobeStyles.js:82): custom Top feeds tee/blouse; Bottom feeds denim/skirt; Shoes changes leather while socks use the base palette. Existing texture-derived tone, roughness, normal maps and region thresholds remain in their original paths. The selected inputs visibly retain useful detail; this is not proof that black, white, saturated endpoints or every custom combination will do so.

All main/base/returned-base originals appear broadly consistent at this framing. That observation is distinct from their decoded differences below. No fit or hair-quality improvement is claimed.

## Exact-image failure remains a separate unresolved property

I independently decoded the eight paired comparisons and reproduced every reported count and maximum. Each image contains 781,200 pixels. Maximum differences are 8-bit channel codes, not a perceptual acceptance threshold.

| View | Main base → feature base: changed pixels / max | Feature base → returned base: changed pixels / max |
|---|---:|---:|
| Casual front | 401 / 9 | 0 / 0 |
| Casual rear | 0 / 0 | 0 / 0 |
| Elegant front | 165 / 36 | 165 / 36 |
| Elegant rear | 235 / 53 | 206 / 4 |

Concrete failure witnesses include Elegant front pixel `(378,325)`, blue channel 141→105 between main and feature base, and Elegant rear `(395,391)`, blue 95→42. The front returned-base comparison reverses the former value. These local differences are real; equal recorded geometry/history does not establish their cause or make them harmless. Some exact pairs do not pass the complete gate. `exactImageGatePassed` is correctly **false**, and the September26 and tint failures remain unchanged.

Two concrete disposition alternatives are:

- **A — accept only the declared functional/static material scope after the separate combined UI evidence**, keeping exact-image reproducibility explicitly failed and tracked independently. This makes the useful controls available without claiming a renderer repair, at the cost of leaving strict reproduction unresolved.
- **B — hold the entire feature until a separately designed rendering study explains and resolves the failed property.** This preserves exact reproduction as an integration prerequisite, but delays controls whose observed mapping/detail are useful and does not itself identify a colour-code defect.

Under the current declared plan, A is a defensible bounded decision. This review does not prescribe another settling/epoch trial, change a tolerance, or approve integration before the outstanding UI evidence.

## Pins and remaining scope

Report SHA256: `aeb5497832cee9562ffb1c51fcf6f013a396ce0e49d4d6c21b0a35ac36e405ef`.
Capture source: `7a018c5b8b0e2acf2135677118dda832af99a3c3250223a5038ef954ad642d78`.
Plan: `8438847ec39a054f2435f9e870ae0d46f94b9ecfe681caa0517f2dc591fd84d7`.

This packet covers two outfits, one base palette, two views, one pose/light setup and two illustrative custom recipes with simultaneous applied hair tint. It does not exercise Charcoal's source-denim branch, Original refusal, interactive drafts/Apply, JSON/named-look reopening, mobile layout, motion, geometric clearance, fine-detail close-ups or arbitrary colour-space behavior. Those limits must survive integration and user-facing summaries.
