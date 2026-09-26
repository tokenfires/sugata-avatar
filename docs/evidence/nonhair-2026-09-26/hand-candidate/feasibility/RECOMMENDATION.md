# First native hand-clearance candidate

Recommend one isolated family with **4° outward shoulder placement on each side and a common native inward posture cap of 0 radians**. Keep elbow, wrist, fingers and all accepted assets unchanged. This is a bounded diagnostic proposal, not an accepted fix or a positive product-clearance requirement.

The data justify testing the shoulder axis before adding a forearm parameter. The source's inward forearm carrying corrections remain unchanged. At initialization the 4° shoulder change carries both wrists about 32.8 mm outward; every selected distal vertex moves outward (left 6.77–43.68 mm, right 6.70–43.09 mm). The signed −1° control moves every selected distal vertex inward. The normalized rig axes coincide with world axes in these retained snapshots, verified from the exact unmapped Root/source ancestry rather than assumed from a joint name. The author's conjugated/prepended local axis is therefore the corresponding relaxed-pose authoring axis.

## What was reproduced and measured

`recorded-skinning.mjs` reconstructs all five native meshes from the exact frozen body/wardrobe GLBs, source morph targets, native normalized skin weights, body inverse binds, retained Float64 joint world matrices and actual body morph influences. It calls the installed, hash-bound Three `getVertexPosition` and writes Float32 positions as the native helper did. All 1,352,592 components in 60 meshes from A/B/C × steps 0/455/637/720 match exactly, including all position hashes. No tolerance admitted a mismatch.

Nonzero trials rotate actual shoulder-descendant matrices around the recorded shoulder, then skin **both body and every worn mesh** from their real weights. These are recorded-pose counterfactuals, not exact predictions of changed RestPose bindings, posture frames, gesture yield, Sway or native mass calibration. No model or asset was exported.

The finite initial grid was −1, 0, 1, 2, 4, 8, 12 degrees; the upper endpoint is roughly the existing 10.18°/11.94° inward humerus allowances. B's selected difficult poses were measured only at 4, 8 and 12 degrees. A final small lower bracket measured B720 at 3 and 3.5 degrees. No monotonic interval, continuous clearance or global optimum is claimed.

The first pass used the historical 3166-face-per-side hand region. The final receipt additionally closes over **every triangle incident to any positive hand/finger support**, unioned across sides and partitioned by strict source-rest x half-space: 3389 faces on each side, including all 3166 historical faces and 223 boundary faces. There is no positive-weight cutoff. These are source-region definitions, not anatomical ground truth.

All targets use full topology, including every worn surface. The declared body target preserves the prior conservative profile: it excludes source faces wholly on the ipsilateral half-space that have positive upper-arm-or-descendant support, retains all 68 midline-touching faces and all opposite-side surfaces, and still has documented mixed torso/attachment coverage holes. Report the body bound with that scope.

The sufficient downward-rounded positive bounds at +4° are:

| Retained pose | Declared full-distal/body L / R (mm) | Hand + boundary / all worn L / R (mm) | Full-distal/all-worn unproven faces L / R |
| --- | ---: | ---: | ---: |
| A0 | 17.038 / 18.611 | 19.522 / 32.477 | 22 / 30 |
| B455 | 22.603 / 26.863 | 71.721 / 80.469 | 22 / 32 |
| B637 | 17.409 / 20.236 | 22.507 / 48.958 | 23 / 31 |
| B720 | 9.486 / 17.810 | 5.632 / 37.926 | 25 / 32 |

At initialization +2° leaves only 0.014 mm in the historical left hand/clothing scope. At B720 +3° leaves 71 unproven left hand-boundary faces; +3.5° gives a positive but small 0.417 mm bound. +4° is the smallest **tested common whole-degree placement** that passes all four selected poses with a measurable reserve. The minimum measured 5.632 mm is evidence about these discrete, transformed inputs; it is not an approved required margin.

## Remaining sleeve results and native decision

No full-distal/clothing failures were discarded. `placement-boundary-v1.json` contains every residual failed face ID, transformed triangle coordinates, source vertex coordinates and all four source joint weights. `proposal-receipt-v1.json` additionally hashes each exact list and details array. The residuals occupy approximately world y 1.121–1.228 m across the selected poses, carry 94.04–100% ipsilateral upper-arm weight, and have no overlap with the expanded hand/finger region. Their only positive joints are upper arm, lower arm and clavicle. For example, the initial left limiting body face 16009 is inward of casual-suit sleeve face 1202; the initial right limiting body face 2770 is inward of sleeve face 1178. These faces remain drawn. Their location and support establish a proximal arm/sleeve relationship; they do not alone establish acceptable visual coverage or contact freedom. A negative outward corridor gap is not penetration depth, and skin normally covered by a sleeve need not lie outside that sleeve.

Use cap0 for this first native test because allowing inward posture would consume the small selected worst-pose reserve. This is a deliberately fixed diagnostic bound, not a derived maximum safe nonzero cap. Keep the native posture owner, actual clamp and shared telemetry honest. In attribution B, arm contributions were suppressed while Gesture still read the original posture prescription; the new native cap0 instead yields 1 rather than 0.35 at sufficiently closed angry peaks. That changed gesture output is expected and must be measured. A0+B measurements select a plausible candidate; they do not prove native equivalence.

The next decision requires the one freshly authored +4° family/cap0 native trace, unchanged source and asset binding, actual owner-state attribution, complete hand/declared-body geometry and original crossing witnesses, preserved masks/topology, clean retirement, and ordinary bilateral/full-body renders. A native failure should be retained and diagnosed. Do not turn this finite feasibility study into a parameter sweep or claim all-motion acceptance.

## Reproduction and binding

All scripts refuse to overwrite their output; use a fresh output directory or explicitly archive the original files before a deliberate reproduction. No existing receipts or source inputs were changed.

- `measure-placement.mjs` → `placement-v1.json`: `ea4aa4f049de5d97e24b56fb0b1b0e48a0254d7a16fb9e356645b806b360c31a`
- `measure-placement-boundary.mjs` → `placement-boundary-v1.json`: `9b56ac8d97b86158fd072ea169a31e51d1da23b1748c3f5c98763050a01084df`
- `summarize-feasibility.mjs` → `proposal-receipt-v1.json`: `7128c95380d3b71d4a9efc2a711dc4a8fad02bd1bf68d70d24134928530a7010`
- `verify-rig-world.mjs` → `rig-world-v1.json`: `e0f273f5f76038951db2c1931062ff6d014ecddec071917034244c2425b8e948`

Each receipt includes its executed script/source hashes and retained snapshot hashes. The input is the completed sealed `captures/hand-attribution-2026-09-26/primary-v4`, report SHA `bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e`. The region and target-profile hashes remain the previously qualified diagnostic inputs. All work here was CPU-only.
