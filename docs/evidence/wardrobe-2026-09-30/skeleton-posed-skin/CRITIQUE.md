# Independent critique: posed skeleton and skin

## Disposition

**The overall predeclared comparison fails.** The finite matrix and skinning arithmetic agrees with the native control carrying the accepted export's four influences. The proposed path does not meet the unchanged **below 0.342 mm** gate against the unmodified native weight reference. These are separate results; the matched control does not supersede the failed reference.

The ordinary images show a subtle local surface difference in this one pose, without an obvious gross defect at the captured body scale. They do not justify changing the numerical gate or claiming a visible product regression. Keep accepted assets and defaults unchanged. Proceed, if desired, with one isolated full-influence CPU representation experiment; no renderer or runtime integration is qualified here.

## Independently checked evidence

- [Native observations](/Users/robault/GitHub/sugata-avatar/captures/skeleton-native-pose-2026-09-30-v1/report.json), report SHA-256 `226a55bc568bec712c847b5a12b91b6c7a019170d91dd26c2d56e60c140f2be1`.
- [Numerical comparison](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-comparison-2026-09-30-v1/report.json), report SHA-256 `ea6f19c3cef8e60e5d9bd8f9936cf0c83eeeb0d363bd08d7f7c635897a0a83ef`.
- [Visual capture](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-visual-2026-09-30-v1/report.json) and [actual mapped geometry](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-visual-2026-09-30-v1/geometry.json), geometry SHA-256 `2782fa5b2a04b486d1b5cfc6960b84cb35ba4f5682fe2e0a25c896a4dd18db67`.

I launched no native process, browser or GPU capture and changed no asset, instrument or product source. Independent verification used read-only Python calculations on the actual retained packets and inputs.

### Native observations and admissions

Verified 2,417 declared input bindings across the evidence chain, the four current source copies, identical initial/final censuses of 526 loaded MPFB modules, and all 28 compressed and decoded native output hashes. The three body cases contain exactly the declared 18 observations: body weights 0, 0.25 and 1; native-full and export-four weight arms; identity, elbow and coupled poses.

All three unrigged body arrays and rest-bone records equal the previously retained fresh native cases. Actual full weights match the original source for all 19,158 vertices. Actual exported-four weights match the canonical mapped weights on all 13,380 original body vertices; all 5,778 helper weight lists remain unchanged. Body influence counts include 597 vertices with five positive weights and 11 with six. Helpers include four vertices with seven influences, retained by the variable-length native arithmetic.

Observed metadata satisfies the declared identity transforms, 53 deform bones, FULL scale inheritance, rotation inheritance, local-location behavior, disconnected bones, absent pose constraints, and single linear vertex-group armature conditions. All 906 uncommanded bone observations reset to exact identity. The 48 commanded observations have identical bases/quaternions across the body shapes; evaluated bone matrices are exact between the two weight arms. Native quaternion storage differs from ideal double-precision command quaternions by at most `6.9169883e-8` per component; this distinction remains observed rather than silently erased.

### Independent numerical reconstruction

Reconstructed propagation using a separate affine-adjugate inverse and axis-angle command matrices, rather than copying the comparator's Gauss–Jordan inverse and quaternion construction. Recomputed **794,871 vertex residuals and 4,770 matrix witnesses**, including both negative controls and their mutations. The maximum difference from archived residual arithmetic is **1.35814e-12 mm**. Only effectively zero identity-propagation worst-bone locators differ through floating-point roundoff; no gate or meaningful witness changes.

Verified the six current comparison input pins, its copied source/plan, native source pins, and 57 compressed/decoded artifact reads across this recomputation. Checked the case control dependencies separately.

| Measurement across the nine body/pose cases | Maximum error | Disposition |
|---|---:|---|
| Proposed path versus native four-influence control | 0.000594698250 mm | Passes the finite matched-representation gate |
| Native full/four variable-length linear arithmetic | 0.000423458045 mm | Passes the native arithmetic controls |
| Constructed pose, including one-metre basis witnesses | 0.008110914807 mm | Passes the 0.1 mm witness gate |
| Proposed versus unmodified native, neutral coupled pose | 1.589239584 mm | Fails the 0.342 mm gate with passing required controls |
| Proposed versus unmodified native, 0.25 coupled pose | 1.590665829 mm | Raw failure retained; full-reference interpretation blocked by failed neutral coupled control |
| Proposed versus unmodified native, 1 coupled pose | 1.592797756 mm | Raw failure retained; full-reference interpretation blocked by failed neutral coupled control |

The stale-neutral-bind negative control fails at **106.885736742 mm**; omitted elbow propagation fails at **247.117799112 mm**. Both have passing matched parents and nonzero mutations. The recorded overall `passed: false`, `matchedRepresentationPassed: true`, `unmodifiedNativePassed: false` and `negativeControlsPassed: true` are correct.

## Concrete failure and representation decision

The neutral coupled maximum is **exported vertex 4561, original basemesh vertex 4169**. It is not the earlier illustrative source vertex 10991. The actual native weights at 4169 are:

| Bone | Unmodified native weight | Accepted exported-four weight |
|---|---:|---:|
| pelvis | 0.26245248317718506 | 0.2703482210636139 |
| spine_01 | 0.5060012340545654 | 0.5212240219116211 |
| spine_02 | 0.1626325249671936 | 0.16752523183822632 |
| spine_03 | 0.03970794379711151 | 0.04090253636240959 |
| thigh_r | 0.029205841943621635 | Omitted |

At this point in the neutral coupled pose, proposed versus native-four error is only **0.000044362 mm**. Native-four versus native-full error is **1.589217064 mm**. The two native arms have exact matching bone poses and unrigged coordinates; their controlled weight difference produces the surface discrepancy. This is evidence for a representation limitation in the admitted calculation, not evidence that the refitted skeleton propagation is wrong.

Two concrete directions preserve the failed gate:

1. **Recommended and selected by root: retain every source influence in one isolated CPU representation.** Map full native weights through the existing split-vertex map, retain the same exported coordinates/SDK deltas and independently reconstructed rest/pose matrices, and compare all nine cases against native-full under the same 0.342 mm bar. This directly examines the lost-influence mechanism without changing geometry or poses. It requires later encoding, loader, GPU, performance and appearance qualification before any shipping representation change. A finite CPU pass would not supply those results.
2. **Retain four slots and run a separately declared constrained reweighting study.** Preserve source-supported bones and nonnegative normalized weights, choose the broader pose set and acceptance conditions before fitting, and continue checking against unmodified native skin. This retains the current runtime format but adds optimization and risks fitting only the sampled poses. It must not relabel the existing truncated weights as native-equivalent or weaken the gate.

No bone-offset adjustment, bind correction or tolerance change is supported by the current failure witness.

## Actual image review

Directly inspected all five original PNGs:

- [Body context, native full](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-visual-2026-09-30-v1/context-full.png) and [native four](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-visual-2026-09-30-v1/context-four.png): the overall silhouette and pose look alike at this 1.95 m vertical framing. I do not see an obvious gross change attributable to weight reduction in these images.
- [Waist, native full](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-visual-2026-09-30-v1/waist-full.png) and [native four](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-visual-2026-09-30-v1/waist-four.png): at the 180 mm vertical span, the central/right waist region has a subtle changed tonal transition, approximately x600–1000/y350–700 in the 1200×1000 originals. I do not see a clearly broken silhouette, opening or pronounced new crease. This is a static plain-material observation with recomputed normals, not a complete-avatar comparison.
- [Marked waist](/Users/robault/GitHub/sugata-avatar/captures/skeleton-posed-visual-2026-09-30-v1/waist-four-marked.png): orange helps locate the affected surface. The orange polygonal region and its blended boundary are interpolated vertex colours; neither is a measured per-pixel threshold contour or the size of a visible defect.

Independently verified all 13 visual input pins, nine copied sources, five PNG hashes and the geometry hash. Both saved arms equal their actual native arrays after the declared axis mapping. Every coordinate of the 14,517 uploaded vertices is already exactly representable as float32; there is no displacement amplification. The 26,756 triangles exactly match the accepted body index accessor. Recomputed all vertex distances and confirmed **49 vertices at or above 0.342 mm**; largest arithmetic discrepancy from the saved distances is `2.22045e-16 mm`.

Context, ordinary close-up and marked close-up camera/light pairings match exactly in the recorded fields. The same native-full witness location is the close camera target in every arm. The report records Apple Metal hardware through ANGLE, one mesh draw, no recorded page/HTTP errors, and cleanup of the owned browser and temporary service. No exact-image-repeatability claim follows.

### Prelaunch correction, resolved

Source review found that the first draft selected a node named `base.001`; in the actual accepted GLB, node 53 is named `Human`, while its referenced mesh is `base.001`. That would have caused a refusal before rendering. Two valid corrections were identified: select the unique node by its referenced mesh name, or use the pinned bridge `bodyId` with explicit node/mesh/skin assertions. Root applied the first alternative before the first capture. The saved source and successful topology verification confirm the intended body was used. No failed capture or changed asset was hidden by this correction.

## Remaining bounds

These are three coupled body values, three fixed poses and one neutral coupled visual viewpoint pair. They do not qualify other identities, continuous motion, skin normals, GPU skinning, animation-layer rebinding, face parts, garment/foundation coupling or rendered product quality. The matched four-influence result is useful arithmetic evidence; the full-native failure remains an open representation decision. PUNCHLIST 10.7 is not completed by this packet.
