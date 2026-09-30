# Independent critique — anchored inward lower curve v1

## Disposition

**The inward-contour mechanism is visible and modestly improves the medium-bob shape in all five inspected neutral views, with the tip/corner gain retained in three original-dark Studio comparisons. Both profile rear corners and the back corners now roll inward; the coherent upper/posterior flow and neutral front view's open face framing remain. No new broad opening, ear dome or sharp join seam is established by these images. The exact frozen candidate warrants matched motion qualification.**

This is a positive static appearance result on one figure under two colour/lighting conditions, supported by the completed paired-control audits below. The completed side-v3 motion evidence belongs to the control asset. It does not qualify this changed lower curve for motion, garments, all views or production promotion.

## Exact inputs and preserved scope

- Control: [frozen side v3](../../../../captures/bob-side-envelope-v3/candidate.glb), SHA `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`.
- Candidate: [lower curve v1](../../../../captures/bob-lower-curve-v1/candidate.glb), SHA `2b0c68c05802d0f515aa84b7e505fd325735befbc0159a50bd37cc887e274802`.
- [Frozen construction source](../../../../captures/bob-lower-curve-v1/bob-lower-curve.mjs), SHA `0cf7f5c9a587c063568dde8013cca3908f8c38bb6c1cccba2c093f3d81328069`.
- [Construction report](../../../../captures/bob-lower-curve-v1/candidate-report.json).
- [Candidate capture report](../../../../captures/bob-lower-curve-v1/neutral/report.json), `captured`, five cases, empty recorded errors, completed 08:29:20.212 UTC on September 30. [Control capture report](../../../../captures/bob-side-envelope-v3/neutral/report.json) is also complete.

I read the construction source and report and independently checked the candidate and frozen-source hashes. The source operates on the exact final side-v3 bytes. Its four completed-audit prerequisites precede geometry construction. It translates both edges of each eligible distal ring in XZ with the recorded `2u³−u⁴` displacement and short-card scaling. The radial direction is computed from each frozen ring centre. It does not reconstruct the full cubic or transport width axes.

The construction report records 336 affected cards, 2,451 eligible rings, **4,879 POSITION records** and **4,902 NORMAL records** changed. Twenty-three eligible vertices retain their original Float32 position despite the tiny prescribed offset, while their normals are recomputed. Protected upper vertices/normals, exact-original fallback cards 47 and 182, other attributes and topology are retained. Both edge Y values are exact. Maximum width-vector difference is only **0.000004165mm**, attributable to recorded Float32 rounding; maximum measured width/tangent departure is **0.092178941°**, card 1/ring 16. These are construction measurements, not appearance scores.

The full **338-card / 10,816-triangle rest audit** in the report finds **zero triangle/body pairs** and zero negative sampled vertices; minimum signed vertex clearance is **+3.506313786mm**, card 68/global vertex 2973. The source includes retained fallbacks in that selected union and uses unbounded body regions. This result has the rest/body-only scope stated in the report; it is not a new moving or garment audit.

## Completed paired held-pose controls

I read the [paired-capture audit](../../../../captures/bob-lower-curve-v1/paired-captures.json) and its [preserved source](../../../../captures/bob-lower-curve-v1/audit-bob-lower-captures.mjs). Across all five views, it checks common source hashes, the recorded fixed state excluding the intentionally changed hair position/velocity/vertex hashes, clock, applied material, lighting changes, hidden/identity settings, size, backend and adapter. It verifies image and geometry hashes, one candidate load per arm, and equal head matrix, topology/UV streams, chain layout and step count. Those comparisons are exact.

The per-card geometry readbacks contain **11,962 protected authored vertices**, all exact between control and candidate. The **160 wholly unaffected cards / 5,440 vertices** also have bit-identical live coordinates at this held pose. Protected upper portions of affected cards have **150 changed live components**, with maximum vertex displacement **0.000119224mm**, card 40/ring 6/side 0; the values repeat across all five views. Thus protected authored bytes do not imply completely identical live upper coordinates. This tiny measured consequence is not a demonstrated visible defect. Cap vertices are outside this per-card readback comparison; their authored preservation is covered separately by the constructor's isolation check.

## Actual image comparison with the medium references

I directly reopened [R1, medium rear flow](../../../../reference/bob-appearance-2026-09-29/01-medium-rear-flow.jpg) and [R3, medium side volume](../../../../reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg), then all five control/candidate pairs below. R1's underside and R3's nape have visible inward turning. The candidate moves toward that feature while retaining the longer downward shafts. The references do not supply a physical angle or amplitude target.

Coordinates below are approximate in the original 900×868 captures.

| View | Side-v3 control | Lower-curve candidate | Actual observation |
| --- | --- | --- | --- |
| Right profile | [Image](../../../../captures/bob-side-envelope-v3/neutral/casual-right-profile-medium-brown.png) | [Image](../../../../captures/bob-lower-curve-v1/neutral/casual-right-profile-medium-brown.png) | Around x475–535/y495–580, the rear tip curves toward the neck instead of continuing as a near-vertical square wall. Lower shafts around x275–440/y510–590 retain a joined fall. No new broad ear bulge, opening or angular fold is apparent. |
| Left profile | [Image](../../../../captures/bob-side-envelope-v3/neutral/casual-left-profile-medium-brown.png) | [Image](../../../../captures/bob-lower-curve-v1/neutral/casual-left-profile-medium-brown.png) | The opposite rear corner around x355–435/y520–605 becomes rounded/inward. The formerly corrected side zigzag stays absent. The narrow pale lower channel and forward separated ends remain comparable to the control; they are not demonstrated new holes. |
| Front | [Image](../../../../captures/bob-side-envelope-v3/neutral/casual-front-medium-brown.png) | [Image](../../../../captures/bob-lower-curve-v1/neutral/casual-front-medium-brown.png) | Both lower side contours turn in slightly while the face remains open. The existing longer forward section and shorter inner edge on screen right, around x500–580/y540–645, remain distinct. No new broad cheek occlusion or exposed gap is apparent. Fringe/crown irregularities remain. |
| Back | [Image](../../../../captures/bob-side-envelope-v3/neutral/casual-back-medium-brown.png) | [Image](../../../../captures/bob-lower-curve-v1/neutral/casual-back-medium-brown.png) | The corners around x315–385 and x645–710/y495–590 roll inward. The central long flow remains coherent. A soft lighter sweep is visible around x435–540/y515–555; it does not resolve into a sharp join seam in this intact view. The hem still contains strand-group variation and some pointed lower divisions. |
| Rear oblique | [Image](../../../../captures/bob-side-envelope-v3/neutral/casual-rear-oblique-medium-brown.png) | [Image](../../../../captures/bob-lower-curve-v1/neutral/casual-rear-oblique-medium-brown.png) | Lower tips around x280–585/y525–585 turn toward the neck while the upper/posterior shaft field persists. The more rounded terminal contour does not reintroduce the earlier hook or a broad horizontal panel. Existing front strands at the left edge remain. |

The hairstyle is not finished: crown/fringe fragments, soft rendering boundaries and irregular lower divisions remain visible. The narrower terminal contour is a real change, but this comparison does not establish exact reference matching or support adding more curl simply because more is possible.

## Completed original-dark Studio confirmation

I read the [dark control report](../../../../captures/bob-lower-curve-v1/dark-control/report.json), [dark candidate report](../../../../captures/bob-lower-curve-v1/dark/report.json), [dark-control audit](../../../../captures/bob-lower-curve-v1/dark-controls.json) and its [preserved source](../../../../captures/bob-lower-curve-v1/audit-bob-lower-dark.mjs), then directly inspected all six PNGs below. Both reports are `captured` with three cases and empty recorded errors, completed at **08:33:54.335** and **08:35:43.538 UTC** respectively on September 30.

The audit pins the control/candidate asset hashes above, equal common source hashes and equal recorded held controls. It excludes the intentionally changed hair position/velocity/vertex hashes, checks equal clock, material, lighting changes, hidden/identity settings, size, backend, adapter and exact-default vector, and verifies each original PNG hash. Each arm loads its candidate exactly once. The applied linear colour vector is identical in all six cases: `[0.010505784538312107, 0.004360574652180827, 0.0038367111648802705]`. Both clocks retain frame/grain 98, time and deltaTime zero, and the same recorded temporal state. I found no material comparison flaw in this audit's stated held-control scope. It does not perform a moving audit or the neutral report's separate live-upper-vertex comparison.

The strong blue Studio illumination affects hair, neck and shirt in both arms. These images confirm appearance under that original lighting condition; they are not neutral measurements of natural hair colour.

| View | Side-v3 original-dark control | Lower-curve original-dark candidate | Actual observation |
| --- | --- | --- | --- |
| Back | [Image](../../../../captures/bob-lower-curve-v1/dark-control/casual-back-exact-default.png) | [Image](../../../../captures/bob-lower-curve-v1/dark/casual-back-exact-default.png) | The lower corners around x315–385 and x645–710/y495–590 retain the inward roll. The centre retains long directional shafts and the existing pointed lower divisions. The lower sweep near x435–540/y515–555 is visible as soft changing illumination; no new crisp horizontal join line or broad exposed opening is established. |
| Right profile | [Image](../../../../captures/bob-lower-curve-v1/dark-control/casual-right-profile-exact-default.png) | [Image](../../../../captures/bob-lower-curve-v1/dark/casual-right-profile-exact-default.png) | The rear tip around x475–535/y495–580 remains rounder and turns inward. No new broad fold, ear dome or sharp seam is apparent through the lower side band. Existing crown/front fragments and long cheek-side ends remain. |
| Left profile | [Image](../../../../captures/bob-lower-curve-v1/dark-control/casual-left-profile-exact-default.png) | [Image](../../../../captures/bob-lower-curve-v1/dark/casual-left-profile-exact-default.png) | The rear corner around x355–435/y520–605 retains the inward bend. Its lower band has curved highlights without a demonstrated sharp break. The existing narrow pale lower channel around x565–610/y520–600 and forward separated ends remain; the pair does not establish a newly opened gap. |

The original-dark views strengthen the static decision without erasing the existing crown/fringe and hem-detail limitations. They do not establish the visibility of card 337's particular join, and there is no dark front or rear-oblique confirmation in this packet.

## Finding 1 — visible contour gain supports qualification of these exact bytes

**Actual witness:** the right-profile rear corner and both back corners turn inward where side v3 ended almost vertically. R1/R3 show that missing directional feature. The three original-dark pairs retain the same gain without a newly obvious join seam. The remaining uncertainty is whether that benefit survives head and ordinary movement without a new gap, fold or collision.

Two concrete alternatives:

1. **Recommended: freeze this recipe and proceed to matched motion qualification.** Use the exact side-v3 asset as control and the same bounded head and ordinary protocols, retaining full selected-body evidence, actual lower-contour images and shared-collider/protected-live consequences. Include the neck/hem at the pitch extremes and returns in the image review. Tradeoff: additional evidence is required, but it evaluates the demonstrated improvement without introducing another shape variable; no previous moving result is inherited.
2. **Alternative: hold this as a positive static experiment and retain side v3 as the moving experimental lead.** Tradeoff: no new qualification cost or moving risk is introduced, but the visibly squarer lower contour remains the established moving version.

Neither alternative calls for a new displacement scale, join height, target angle or whole-volume change from these images.

## Finding 2 — the normal-join maximum is a locator, not a demonstrated seam

**Source/data witness:** the report's largest join-angle increase is card **337**, side **0**, ring **12→13**: **2.239223° → 6.666814°**, an increase of **4.427591°**. Its first moved ring has only about 0.275mm prescribed displacement; there are four moved rings in total, 13 through 16. The source preserves the upper normal and recalculates the lower normal. The overall largest normal change, **17.984337°** at card 345's tip, is a different measurement.

**Actual image limit:** the five neutral views and three original-dark pairs show no established sharp normal-join seam. The back image's soft lower sweep remains a valid region to retain, but it does not identify card 337, and a lighting change caused by the new bend is not inherently a defect. The record does not yet project this specific card/ring witness into these images.

Two concrete alternatives:

1. **Recommended: retain the source and ranked join measurements while qualifying the moving appearance.** Preserve the back sweep and the completed original-light confirmation without changing normals. Tradeoff: individual-card visibility remains unresolved, but no observed defect justifies another normal/frame pass.
2. **Alternative if a sharp line is subsequently visible: project the recorded card-337 join into that exact held pose and compare a separate identity/wire witness with the intact render.** Tradeoff: this provides attribution before any correction, but the diagnostic overlay itself would not establish alpha coverage or an aesthetically visible seam.

## Finding 3 — retained face framing does not establish dynamic gap or garment clearance

**Actual witness:** the front right lower sections remain separated around x500–580/y540–645 in both versions; the rear-oblique tips now sit closer inward toward the neck. No new broad opening is demonstrated in these held views. The rest audit contains body triangles, not the visible shirt, and the changed lower centres will enter the solver as new rest geometry.

Two concrete alternatives:

1. **Recommended: retain the present contour and inspect the corresponding lower sections in the matched head/ordinary evidence for this new asset.** Record shared-collider and protected-live-card consequences rather than assuming static isolation makes live geometry identical. Tradeoff: moving gap/contact behavior remains unqualified until that evidence exists; the useful shape improvement is kept intact for assessment.
2. **Alternative: keep the result explicitly static-only.** Preserve these front/profile images and the rest result without a moving-use claim. Tradeoff: this is immediately supportable but does not extend the existing side-v3 motion qualification to the lower curve.

## Review boundaries

- Only one g050/bob02 held pose is reviewed: five neutral-light diagnostic-brown views and three original-dark Studio views. Moving evidence for these candidate bytes is outstanding. The dark packet has no front or rear-oblique image.
- The capture report's empty errors refer to its recorded error channels, not a universal renderer or console guarantee.
- Zero body intersections do not prove garment clearance, hair-to-hair clearance, alpha coverage, all-motion acceptance or visual quality.
- This critic did not launch a capture, Blender job, geometry construction or duplicate body audit. Only this assigned critique was written.
