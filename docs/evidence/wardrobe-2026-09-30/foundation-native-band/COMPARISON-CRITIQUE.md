# Independent comparison critique — native band, V3

## Disposition

**Accept V3 as the declared finite correspondence, topology and source-coverage prerequisite. The band remains experimental.** This result supports proceeding to the separately declared complete rest-body audit and actual foundation-only/dressed views. It does not establish appearance, body clearance, posed coverage, arbitrary motion, or production readiness.

The reviewed [V3 report](../../../../captures/foundation-native-band-comparison-2026-09-30-v3/report.json) has SHA256 `ac55da64915afcf30b7121d21c94d9508f10f9b1b2f944667c72b23bf602beba`. The exact band export is `c82805f09177627376a9b6ec821c754c020ef1b2cc7a074e6960523e8f5641bd`. No asset was changed or native job launched by this review.

## Independent checks

I parsed the GLBs directly with Python `struct`/NumPy, independently of the JavaScript GLB reader and Three matrix implementation. I checked all 33 live input/source hashes against both the report and its archived copies, the native encoded/decoded gzip bindings used below, the GLB bindings, and the comparison residual/coverage artifact hashes.

Both exports have one triangle primitive and only `JOINTS_0`/`WEIGHTS_0`, with finite, nonnegative float32 weight rows and no zero-sum row. Predictions use the actual inverse binds, `C * nativePoseMatrix`, reciprocal L1 normalization followed by float32 storage, then a weighted XYZ blend without another normalization. Native evaluated positions remain the full-influence reference.

| Export | Identity maximum, mm | Elbow maximum, mm | Coupled maximum, mm |
| --- | ---: | ---: | ---: |
| Rebuilt original control | 0.000185811 | 0.000185811 | 0.184982428 |
| Band | 0.000174651 | 0.000174651 | 0.123488117 |

All six are below the unchanged strict **0.342 mm** bar. Independently calculated prediction components agree with the stored Three results within `4.44e-16 m`. The added 50 mm X-offset controls produce maxima of 50.000025–50.100272 mm against passing parents. They demonstrate rejection of that displacement, not comprehensive observer fault coverage. The elbow observation produces the same garment result as identity; it is not an additional independent garment deformation. The coupled observation is the substantive posed comparison here.

The band's worst coupled witness is export vertex **1267**, native **1256**. Its native row contains six influences, including `spine_01=0.0035497150` and `pelvis=0.0001499850`, which the four-slot export omits. The reported 0.123488117 mm includes this loss against the full native surface. Passing this pose does not make truncation loss zero or establish all-motion adequacy.

Independent raw-node composition reproduces the native/export rest-frame origin and one-metre basis maximum of **0.001958841 mm**, below the separate 0.1 mm admission. All mapped rest positions and custom attributes are exact. Oriented triangles match through `_NATIVE_VERTEX`; UVs, with the export V-coordinate convention, are exact. Native/export corner normals are **not exact**: maximum component differences are `6.5356493e-5` for the control and `6.1720610e-5` for the band.

Independent native triangle adjacency agrees with the exported correspondence: the band has 7,047 unique native vertices, 13,218 triangles, one component, Euler characteristic zero, and two simple boundary loops of **392 and 484** vertices. All 7,047 vertex links are valid (876 paths, 6,171 cycles), with no nonmanifold edge or orientation error. This avoids the thirteen pinches in the preceding whole-face subset; it does not test self-intersection or body penetration.

I reconstructed the 110 targets and the 3,780 fixed order-four fan samples from the accepted body, then independently queried the shipped bra, rebuilt control and band using double-sided ray/triangle arithmetic. All three cover **110/110 and 3,780/3,780**, with no newly lost sample. Positions agree exactly with the saved targets; hit-parameter differences are at most `2.17e-18 m`. Primary rays preserve the original raw-normal convention; fan normals are normalized. These are finite source-rest samples, including repeated fan boundary points, not continuous or moving coverage.

## Actionable interpretation findings and alternatives

### 1. The rebuilt control is not the dressed product baseline

**Witness:** the control matches all eight attributes of the pinned original-authoring fixture `69fb5b0ae4efd9e99650d31e3e28676cebc8bd881f2a4adea39ef050d31455a8` exactly, with an equal oriented triangle multiset. The shipped bra has later calibrated masks. Casual differs at 2,074 vertices: **327 shipped versus 3,996 rebuilt drawn faces**. Elegant differs at 3,222 vertices: **284 versus 5,990**. Triangle order also differs, while geometry, normals, UVs and four-weight arrays are exact. The calibration is explicitly implemented in [wardrobe_under_masks.mjs](../../../../tools/figure-pipeline/wardrobe_under_masks.mjs).

The band's inherited casual mask flags every vertex, so its runtime casual result is **zero drawn foundation faces**. The V3 inventory correctly follows Wardrobe's any-hidden-corner removal rule. A cleaner dressed neckline would therefore reflect the new cut and inherited culling together; it cannot independently prove the band surface fits or covers the body.

- **A — selected:** preserve the candidate's declared inherited masks and compare actual dressed images against the **shipped** original, alongside separate foundation-only views. This evaluates the proposed product state while exposing the cut independently of culling; the rebuilt control remains a construction receipt.
- **B:** establish a separate mask-calibrated control/protocol before comparing dressed states. This could isolate mask effects more narrowly, but needs new coverage evidence and cannot transplant old vertex indices or mask edits onto the new topology by assumption.

### 2. The finite pass is narrower than an appearance or full-motion pass

**Witness:** [comparator lines 92–100 and 132](../../../../tools/critic/foundation-native-band-compare.mjs:92) record nonzero corner-normal differences but do not gate normal fidelity; identity and elbow produce identical surface errors, and the six-to-four influence witness above is already nonzero. Coverage is computed at source rest. No rendered candidate was part of this comparison.

- **A — recommended:** retain these exact finite receipts, finish the separately owned full-triangle/body audit, and inspect the exact band in matched foundation-only and dressed views before choosing any further qualification. This is the smallest useful next observation and does not invent a normal tolerance after the result.
- **B:** pause appearance work and declare a separate posed-normal/tangent and broader influence/coverage protocol first. This would establish stronger deformation prerequisites, at the cost of postponing the visible question and expanding this bounded construction study.

No offset, cut, hem, mask, weight or gate adjustment follows from this comparison alone. Any concrete failure in the subsequent evidence requires its own diagnosis.

## Preserved observer history

- **V1** used `C * M * C^-1` for exported bone-local matrices. The established export bridge requires `C * M`; the large V1 identity errors are an invalid comparison, not a proved garment defect. Its report remains `3a3eb9d2a49ec56aac4bdccfe1343525d21cc95b5ceb693076b8e7faf85dfe0f`.
- **V2** corrected the coordinate frame, but its casual face inventory used any unmasked corner and its blend used ideal float64-normalized weights. Its report remains `b2c5697f9b0dd7cdc71de20caec418dcfb9656a473875f2f6f75f3a57a3cc7a4`; its positive status is not a complete runtime-correspondence verdict.
- **V3** corrects both observers without changing native data, assets, poses, targets or thresholds. Stored float32 normalization changes 12,035 control and 7,690 band scalar values, so it was not merely a wording correction. Negative-control detection now explicitly depends on a passing clean pose. The preflight choice and limits are recorded in [COMPARISON-V3.md](COMPARISON-V3.md).

The declared 33-file pin set was verified; this critique does not upgrade that inventory to a complete transitive dependency archive. Exact diagnostic exports retain `_NATIVE_VERTEX`; any later clean export requires its own correspondence receipt.
