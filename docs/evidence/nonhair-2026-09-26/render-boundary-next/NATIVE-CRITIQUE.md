# Independent review of the completed boundary pair

Reviewer: `/root/critic`, 2026-09-26. **Accept this as a completed, bounded diagnostic collection. The exact original-image gate fails; causal and held-feature admissions remain false.** This is not a renderer fix or asset qualification.

I independently checked report `9e662e886717c15a93db7c703a79d3f98b4d7fde2898f664dbebd8b04f797f42` against manifest `215b4144ffffde93d0c8a98c0096fee0bbb2be1d91e48ae2e59f75532f8cd600`: all 1,594 current source/asset pins, 1,494 archived sources, 276 actual response bodies, twenty retained readbacks, both original PNGs and the shared complete native state. Both owners have restored capture hooks, disposed native state, zero memory counters and no leaked handles or GPU errors. The report retains eight warnings (four per owner); they are not counted as a warning-free run. No standalone native `seal.json` is present; the report hash and retained artifact bindings identify this collection.

[Independent verifier](critic-verify-native-v4.mjs) (`769c0dd3c6bb25b1ec28d92a47f21c03128f9c56e649a5b353de712918f91f27`) extracts each logical row directly from the raw allocation using the installed stride/final-row contract, without calling the capture packing/comparison helpers. [Its result](critic-native-v4.json) (`d18db7507e17715bfa406a0c9ad9bc4220754e919b8c684ddc64334d93e55b4e`) independently reproduces every logical-byte count, changed-texel count and bounding box. It also verifies compressed and raw hashes, descriptors, unchanged recorded native counters and clean retirement. The shared PNG decoder is used only for the original image comparison.

| Captured boundary | Changed texels | Changed logical bytes |
| --- | ---: | ---: |
| Scene output, diffuse, normal, velocity | 0 each | 0 each |
| Temporal resolve | 166 | 362 |
| Temporal history after copy | 166 | 362 |
| Bloom final composite | 4,681 | 4,707 |
| Bloom first vertical result | 82 | 99 |
| Grade encoded before RCAS | 2,451 | 2,619 |
| Grade encoded after RCAS | 4,061 | 4,374 |

The four Scene attachments match including retained row padding. Temporal resolve is the first **observed** differing boundary; its native-copy-coordinate bounds are x193–429, y35–819. Within each owner, the captured history colour equals the current resolve exactly, consistent with the native post-resolve copy. It is not the prior history used by that resolve. Half-float byte differences are raw bit differences; a byte delta of 255 is not an intensity-error measurement.

The original 657×868 RGBA8 PNGs differ at 170 of 570,276 pixels, across 213 channel codes, with a maximum code difference of 5/255 and bounds x22–585, y48–767. I viewed both unedited images: full figure, outfit, lighting and framing appear the same at the supplied display size. The existing face/groom/neckline rendering limits remain visible in both. No intentional appearance improvement is established, and visual similarity does not waive the exact image mismatch.

The final Scene equality does not prove equality of all resolve inputs. This packet omits prior history colour/lock, current and prior depth, and internal prior-camera uniforms. Readback also adds copy/wait commands after export. Consequently neither TAAU root cause, a defect in its algorithm, nor the cause of earlier rejected unchanged-image trials is established. No shader, hair, default or tolerance change follows from this packet.

## Two bounded follow-up designs

Prefer a smaller final-input witness pair: after the existing draw64, record actual history colour and lock, source-qualified current/prior depth if supported, exact TAAU matrix caches/uniforms, jitter, dimensions and relevant scalar settings. Then perform the original export draw65 and retain the existing output observations. Native `updateBefore` first copies the current camera caches into its previous uniforms; capture both sets before export, not only fields already named `previous`. This would test whether disagreement is already present in the final resolve's inherited inputs. It cannot locate its onset, and unsupported depth readback must remain an explicit missing input. Added synchronization limits apply.

Alternatively, a fixed trace across all existing 65 draws could identify the first sampled output disagreement. It costs substantially more storage and synchronization, perturbs the observed schedule more, and still does not prove a causal mechanism. It must retain all outcomes rather than select a matching run or extend settling. Neither design is a production correction or authorization for an unreviewed native run.
