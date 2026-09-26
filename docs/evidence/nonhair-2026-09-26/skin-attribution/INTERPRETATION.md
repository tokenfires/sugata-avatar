# Kitchen body-view micro-normal attribution

The completed native v2 comparison isolates a visible contribution from the existing micro-normal term to fine leg texture. Turning its strength from 0.25 to 0 makes the exposed shins look more even in these 657×868 body plates. The broad reddish knee patches and blue jaw edge remain plainly visible. This supports investigating their colour/lighting inputs separately; disabling micro-normal is not a demonstrated solution to them, and this experiment does not select a new skin default.

I inspected the actual unmodified `default-a.png` and `micro-off.png` at their native size. The effect is subtle in the full figure and clearer on the exposed shins. These are visual observations about this fixed view, not an anatomical segmentation, face-calibration result or assessment of motion/other rooms. The reference groom was unchanged throughout and is outside the comparison's quality scope.

The returned fresh default A2 is byte-identical to A, including its PNG encoding: SHA-256 `a215c2ff86d583a437af2b2bc8c824c8d74862664bbcd313f0877d8839718b7d`. B has SHA-256 `e293423dfff9669f74635b89f4e04dc47229313fb5638769da623104efe7d7aa`. All three have identical complete finite CPU-skinned body/worn positions, indices and masks, morphs, rig/bone palettes, camera and native physical-groom hashes in the same retained state artifact. The exact state JSON digest is `088fa095afb47a9e4d7342a6ee56113ff1e8286f9f2ea0a3a66533e254da5384`.

Every arm used Kitchen/After hours/Ecru/body, seed 20260807 and the same current g050 assets. After one explicit shared temporal reset, each completed 64 indexed zero-time native updates and one native Save image draw. At export the renderer frame was 1000065, temporal jitter index 3 of 31, history width 657, grain frame 641 and motion clock 0. Other skin/material/grade values stayed exact. Distinct exposure owners remained renderer 1, Grade 1, and LightingRig irradiance multiplier 2.04. This proves matched diagnostic histories for these captures; it does not describe normal idle renderer cadence.

Descriptive image differences are retained in `native-v2/image-differences.json`. They use 8-bit sRGB-encoded PNG code values, with no new acceptance threshold:

| Display-space comparison | Result |
| --- | ---: |
| A vs returned A2 | 0 changed pixels; exact PNG bytes |
| A vs B, whole 657×868 plate | 21,509 of 570,276 pixels have any RGB change (3.772%) |
| A vs B, whole-plate mean absolute RGB difference | 0.03684 code values out of 255 |
| A vs B, maximum single-channel difference | 11 code values |
| Left/right inner-shin windows, mean absolute RGB difference | 1.718 / 1.478 code values |
| Left/right knee windows, mean absolute RGB difference | 1.119 / 1.096 code values |
| Jaw-edge window, mean absolute RGB difference | 0.216 code values; maximum 2 |

The windows are explicitly listed image-coordinate rectangles selected for review after inspecting the native plates. They are not source-defined anatomy/material masks and may include boundaries or background. Their difference magnitudes describe where this intervention affects pixels; they do not establish realism, smoothness quality or G4 compliance. In particular, a small whole-image mean is diluted by unchanged room/clothing pixels. No high-pass calibration claim is made from these body-scale images.

All three owners retired through the existing nonpersisted pagehide handler fixture with no leaked handles and all renderer-memory counters zero. No browser or captured WebGPU errors/losses occurred. Twelve raw startup warnings are retained, separate from errors. The packet reverified 1,486 retained non-asset source files against the 1,586-entry manifest and all 438 actual response records / 146 distinct retained bodies. The compact package includes exact manifest/report/seal, three untouched PNGs, one lossless state archive and the essential original controller/runtime/test/fixture sources. Full source and served-body archives remain in the original capture directory; nothing was deleted.

The first rejected attempt remains in `rejected-native-v1/`, bound from the new package receipt. It failed an instrument assertion that confused the renderer's exposure owner with the lighting rig; `EXPOSURE-REPAIR.md` records the correction and the separately rejected Grade hypothesis. No exposure was changed to obtain v2.

The bounded next visual question is the appearance of the baked diffuse and coloured lighting under this same honest view. The separate source-bound albedo study already found front-knee chroma in the embedded texture; that does not by itself assign the full rendered colour to albedo. A future alternative diffuse or light study would need its own exact source provenance, matched native controls and visual review. Keep the shipped micro-normal setting and current assets while that question is resolved.
