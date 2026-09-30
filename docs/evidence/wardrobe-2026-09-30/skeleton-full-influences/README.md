# Complete influences resolve the finite CPU discrepancy

The [declared isolated representation](PLAN.md) passes all nine full-native CPU comparisons under the unchanged strict **below 0.342 mm** bar. Full source rows and eight-slot float32 storage both reach at most **0.000594698 mm**. No pose, skeleton matrix, bind, position, target delta or threshold was tuned. The original four-influence packet remains failed.

## Representation and results

Every positive native body influence is mapped onto the unchanged 14,517 exported vertices. Source rows match exactly across the three bodies. Complete rows are normalized once; the storage arm then rounds weights to float32, stores joint indices in uint8 and pads to eight slots with zero. Blending does not renormalize these float32 rows. Their sums range from 0.9999999515712261 to 1.0000000447034836.

The exported vertex distribution is 7,105 with one influence, 4,575 with two, 1,501 with three, 698 with four, 623 with five and 15 with six. This differs from the original body distribution because exported seams duplicate vertices. No row exceeds six positive influences. The eight-slot data is an isolated candidate; no shipping GLB or renderer was changed.

Distances are maximum Euclidean millimetres over all 14,517 vertices.

| Body target weight | Pose | Full source → native | Eight slots → native | Eight slots → full source |
| ---: | --- | ---: | ---: | ---: |
| 0 | identity | 0.000477782 | 0.000477782 | 0.000064632 |
| 0 | elbow | 0.000477782 | 0.000477782 | 0.000064632 |
| 0 | coupled | 0.000594698 | 0.000594698 | 0.000064461 |
| 0.25 | identity | 0.000477782 | 0.000477782 | 0.000064632 |
| 0.25 | elbow | 0.000477782 | 0.000477782 | 0.000064632 |
| 0.25 | coupled | 0.000475841 | 0.000488556 | 0.000064461 |
| 1 | identity | 0.000478827 | 0.000478827 | 0.000064632 |
| 1 | elbow | 0.000548516 | 0.000548516 | 0.000064632 |
| 1 | coupled | 0.000569197 | 0.000587087 | 0.000064461 |

Neutral same-pose and same-body identity controls pass before interpretation of shaped/posed cases. The comparison uses a separate Three Matrix4 CPU implementation, with frozen parent matrices and geometry read directly rather than reconstructed or fitted again. Actual native full skin is retained as the reference. This is storage/CPU arithmetic, not float32 GPU arithmetic.

## Retained failures and causal interpretation

Restoring the accepted four influences in the neutral coupled case again fails at **1.589239584 mm**, exported vertex 4561. This reproduces the previous prediction to 6.01e-13 mm. Complete weights change only the representation; all other inputs stay fixed. Retaining neutral binds in the full-target coupled case fails at **106.885736742 mm**. Both have passing clean parents and nonzero changed outputs.

These observations support preserving full influences as the next candidate. They do not make the original failure pass or establish a visible repair. The previous actual native surface views showed subtle local waist differences, with no obvious gross context defect. Any GPU candidate needs actual rendering and inspection.

## Source review and next decision

Before execution, the critic found a 15-entry coordinate-matrix literal. **Chosen correction:** restore the exact 16-entry matrix and assert finite length-16 input. **Alternative:** construct explicit basis vectors with Matrix4.makeBasis, avoiding flat-list counts while introducing a different constructor path. The correction happened before the first execution; it was an instrument typo, not a representation result.

Independent post-execution review is recorded in [CRITIQUE.md](CRITIQUE.md). The subsequent [GPU result](GPU-RESULT.md) passes this finite case set with actual readbacks and paired native/candidate visible-region inspection. Full-target feet remain visually unqualified because the context clips them. It does not integrate ordinary avatar skinning, normals/tangents, velocity history, runtime body changes or wardrobe/face coupling.

The deferred alternative is constrained four-slot fitting over a broader predeclared pose set. It preserves format but risks fitting particular poses. Complete influence preservation is preferred here because it addresses the actual omitted thigh weight without changing source intent.

## Recovery

```sh
node tools/critic/compare-skeleton-full-influences.mjs
```

PID 90157 / session 12444 ran 18:23:14.180–18:23:17.004 UTC, exit 0. Raw root `captures/skeleton-full-influences-2026-09-30-v1`; report SHA256 `eac81ac3b1f5e66b17e0dbdb1606bdc0d479290c2b7cd0d85c6ebd6a71f13df3`. The script refuses an existing output root. Source, library dependency, input and compressed/decoded artifact hashes are preserved.

No native/GPU job was needed for this CPU slice, and no CPU job remains. Accepted figure SHA256 remains `b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14`. Temporary Blender is detached; keep the existing review service. The GPU probe is a separate source review/execution with its own output root.
