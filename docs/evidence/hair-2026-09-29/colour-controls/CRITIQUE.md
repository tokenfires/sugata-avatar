# Independent critique: hair colour controls

Reviewed September 30, 2026 UTC by the hair critic. Read-only inspection of implementation, retained native reports and actual PNGs; capture execution belonged to the root agent. This file is the critic's only edit in this worktree.

## Disposition

**Recommend integration of the bounded creation-time hair-colour feature, using Brown `#413934` and Auburn `#4c3028`. No blocking finding remains in the reviewed slice.** The final source replay is [ui-v5](../../../../captures/hair-colour-controls/ui-v5/report.json). Its eleven recorded source hashes match the current files at review time. Original still omits the option and retains the exact derived linear vector. The colour controls do not qualify the existing haircut geometry, motion, or natural-dye accuracy.

Stop preset calibration here. Actual images justified the two input changes; there is no new witness requiring another round of values, lighting changes, or shader changes.

## Evidence examined

| Packet | Direct image inspection and report scope |
| --- | --- |
| `material-v1` | All 20 distinct front/rear-oblique images: Original, seven proposed shades, pure black and pure white. Two additional Original repeats assessed from their recorded differences. |
| `calibration-v1` | All six images: two Brown candidates and one Auburn candidate, each front/rear-oblique. |
| `confirmation-v1` | All 13 images: seven final shades on bob01 in Studio front; Black/Brown/White on bob02 in Kitchen front/rear-oblique. |
| `ui-v2` | Original, draft, applied and mobile images; initial interaction and persistence report. |
| `ui-v4` | Picker/scene/outfit state report, harness source and actual mobile image. |
| `ui-v5` | All four final screenshots, all 12 state checkpoints, invalid-input and nonuniform-node evidence, eight owner disposals and source snapshot hashes. |

Across the 23 material reports, all 41 cases completed with empty recorded error arrays. All share the owned-clock signature: node frame 98, time/delta 0, grain frame 98, temporal jitter index 5, period 31, history width 900. Live centreline, vertex and velocity hashes are identical within each haircut. Material and calibration captures also match the recorded pose, camera, noncolour settings, lights, grading and rendering state for each view; configuration and colour uniforms intentionally differ. Calibration changed only three recorded UI source hashes relative to the initial material run.

Original repeats are not image-identical in every view: front changes 122 pixels, maximum 7/255; rear-oblique is exact. These residuals do not explain the broad visible palette changes. No bit-exact screenshot claim is made.

## Resolved findings and alternatives

### 1. A diagnostic colour node could break attachment reporting

**Actual source witness:** the existing [layer attribution helper](../../../../tools/critic/hair-attribution-browser.mjs), lines 30–33, installs `attribute('diagnosticLayerColour', 'vec3')` as `material.hair.baseColour`. That node does not supply the uniform vector assumed by the first report expression, `baseColour?.value.toArray()`. This was a real compatibility mismatch with an existing diagnostic consumer, rather than an unsupported hypothetical material mutation.

- **Alternative A, selected:** guard the live vector read and report `linear: null`, `matchesAttached: false` for unsupported nodes. This is small and keeps saved-look export honest; the report cannot describe the colour of an arbitrary graph.
- **Alternative B:** retain the attached uniform handle and track node identity separately. This distinguishes original ownership from later graph replacement more explicitly, but introduces more state and lifecycle bookkeeping for a creation-time option.

**Resolution evidence:** [Avatar.js](../../../../packages/core/src/Avatar.js), lines 2634–2641, guards the read and vector comparison. The native ui-v4 and ui-v5 reports show a nonuniform node returning null/false and export refusing it with `The attached hair colour does not match this saved look.` The harness restores the original node afterward. Current tracked uniform changes are likewise compared against the attachment seed; requested hex alone is not treated as evidence of the live material.

### 2. Original showed an unrelated Brown swatch and 36% lightness

**Actual image witness:** [ui-v2 Original](../../../../captures/hair-colour-controls/ui-v2/desktop-original.png), right-hand Hair colour panel, shows Original selected beside a brown swatch and 36% lightness. The corresponding report's actual default vector is `[0.010505784538312107, 0.004360574652180827, 0.0038367111648802705]`. The swatch came from the UI seed `#765344`, not a conversion of that attached default. Disabling the controls did not remove the misleading appearance of an Original preview.

- **Alternative A, selected:** hide tint/lightness controls while Original is selected. This preserves exact omission and removes false displayed values; editing starts after choosing a shade or Custom.
- **Alternative B:** display a disabled swatch converted from the attached linear colour, without persisting the rounded hex. This offers a closer starting preview but needs live-material plumbing and a clear distinction between approximation and exact Original.

**Resolution evidence:** [showcase-hair-colours.mjs](../../../../packages/testbed/src/showcase-hair-colours.mjs), lines 35–43, hides the group for a null draft. [Final Original screenshot](../../../../captures/hair-colour-controls/ui-v5/desktop-original.png) shows only the Original selector, Apply and status. The final native replay explicitly checks visibility, and later restores the exact default vector and omitted configuration field. The internal Custom seed is now visible only after selecting a non-Original choice.

### 3. Initial Brown/Auburn inputs did not read as the intended starting shades

**Actual image witness:** in [initial Brown front](../../../../captures/hair-colour-controls/material-v1/brown/casual-front-exact-default.png), the crown and left framing curtain, approximately x150–490/y70–640 in the 900×868 PNG, read peach/copper-orange. [Initial Auburn](../../../../captures/hair-colour-controls/material-v1/auburn/casual-front-exact-default.png) is strongly orange-red, reducing separation from the vivid Red choice. These are judgments of the actual rendered result, not of the input swatches.

- **Alternative A, selected:** calibrate the two named preset inputs once against the existing rendering and retain the full Custom range. This better satisfies the requested base palette, while remaining dependent on lighting and material response.
- **Alternative B:** keep the initial inputs and label them Copper/Red-orange in a general tint palette. This avoids input calibration but provides weaker coverage of the user's requested Brown/Auburn starting choices.

**Decision evidence:** [Brown low](../../../../captures/hair-colour-controls/calibration-v1/brown-low/casual-front-exact-default.png), `#413934`, reads muted brown in the same region. [Brown mid](../../../../captures/hair-colour-controls/calibration-v1/brown-mid/casual-front-exact-default.png), `#4f443d`, is also plausible but adds warmth/lightness without a clear usability advantage. Select the former. [Auburn low](../../../../captures/hair-colour-controls/calibration-v1/auburn-low/casual-front-exact-default.png), `#4c3028`, retains a red/copper-brown character while being less orange than the first input and clearly less vivid than Red.

All seven final values are distinct in the bob01 Studio front samples. [Bob01 Brown](../../../../captures/hair-colour-controls/confirmation-v1/elegant-studio-brown/elegant-front-exact-default.png) and [Bob01 Auburn](../../../../captures/hair-colour-controls/confirmation-v1/elegant-studio-auburn/elegant-front-exact-default.png) support retaining the selected values on the second haircut. Kitchen front [Black](../../../../captures/hair-colour-controls/confirmation-v1/casual-kitchen-black/casual-front-exact-default.png), [Brown](../../../../captures/hair-colour-controls/confirmation-v1/casual-kitchen-brown/casual-front-exact-default.png) and [White](../../../../captures/hair-colour-controls/confirmation-v1/casual-kitchen-white/casual-front-exact-default.png) remain distinct; White reads warm/cream there. Black/Blonde/Grey/White need no new input change from this evidence. Red is a vivid red option, not a claim of natural red hair.

### 4. The first UI replay did not exercise the colour picker's own input path

**Actual evidence gap:** ui-v2's harness selected a named shade and drove keyboard lightness, then round-tripped the resulting hex. That exercised the slider handler, not the separate picker `input` listener at [showcase-hair-colours.mjs](../../../../packages/testbed/src/showcase-hair-colours.mjs), line 50.

- **Alternative A, selected:** send one nonpreset colour through the real browser input, Apply it and observe persistence through a scene/outfit change. This directly covers the missing handler at low additional scope.
- **Alternative B:** retain the narrower replay and explicitly leave picker interaction unverified. This is honest but leaves an important advertised control without exercised evidence.

**Resolution evidence:** [ui-v4 report](../../../../captures/hair-colour-controls/ui-v4/report.json) and the final replay show `input[type=color]` filled with `#365a78`, an unapplied draft that leaves exported state unchanged, then applied configuration and material vector changing together. Kitchen and an in-place outfit change retain that exact hex and linear vector. [Final mobile screenshot](../../../../captures/hair-colour-controls/ui-v5/mobile-applied.png) shows the resulting blue hair, Custom selector, hex, lightness and Kitchen selection without horizontal clipping. This covers the browser input handler; it does not claim a visual or interaction review of the OS colour-dialog interface.

## Final contract assessment

The optional SDK resolver accepts only six-digit sRGB strings, normalizes hex case, rejects colour without hair and leaves omission intact. Creation supplies the hex to the existing material conversion path. Successful attachment records the applied value and linear vector. Rebuild code reuses the creation option; no live setter is implied. Source inspection and reports agree on these semantics.

The ui-v5 lightness example applies `#998980` while preserving the existing bob02, outfit, wardrobe palette, portrait framing, Studio and Warm light. Downloaded JSON and browser-local named looks reopen the same configuration. Original returns to the exact vector above. Haircut switching retains colour; its existing starting-look framing/light defaults still apply, so this is not evidence that switching starting looks preserves every setting. Apply itself preserves the other selections.

The final twelve states all report native WebGPU and matching attached colour. Eight observed Avatar owners are disposed with empty reported leak arrays. There are no recorded page or HTTP errors. These are observed lifecycle checks, not a proof of every resource path or device configuration. No broad suite, benchmark or new motion run was executed by the critic.

## Interpretation limits and stop point

- Hair colour is a material parameter. HSL lightness is the selected sRGB colour's lightness, not measured luminance or perceived brightness of the lit hair. Scattering and temporal guidance also respond to material colour, so lighter pixels alone are not a grooming improvement.
- The blue Studio rear rim dominates the rear palette images. Kitchen rear-oblique is strongly backlit: in [Brown rear](../../../../captures/hair-colour-controls/confirmation-v1/casual-kitchen-brown/casual-rear-oblique-exact-default.png), the broad pale window wash across x280–680/y130–600 obscures most shade distinctions. These images establish that the scene rendered and expose existing silhouette features; they cannot establish natural shade fidelity.
- Pure `#000000` and `#ffffff` produced valid captured results and expected extreme responses. That does not imply either endpoint is a natural hair recipe or that every intermediate shade has been visually qualified.
- Existing crown breaks, broad jagged cards and the rear hook remain visible. No accepted groom asset or geometric candidate is qualified by this colour feature. Authoring-stage diagnosis and motion qualification remain separate unfinished work.
- Sampling covers two current g050 haircuts, Studio/Warm UI workflow, selected Kitchen samples and one native browser/Apple WebGPU environment. It does not establish every identity, lighting condition, quality level, device, motion or physical dye model.

**Integrate this feature with those bounds. Preserve the captured evidence and the selected preset values. Further geometry work should resume from the prior authored-attribution checkpoint, not from another colour or tiny-frame tuning loop.**
