# Independent control recovery critique

## Disposition

**V1/V2 failed the declared exact ordered control. Preserve that failure.** Independent inspection of V2 proves that its geometric surface and mapped UV data match the parent, while normal values genuinely differ. The revised V3 geometric/data control is a defensible next diagnostic contract with the frozen parent GLB as the rendered baseline. It does not restore an exact normal/shading control, and this review does not interpret any V3 native outcome.

Reviewed [V2 report](../../../../captures/foundation-cut-band-2026-09-30-v2/report.json), SHA256 `1e6ede5d15bb6e4695fed70b02e6a8d0cc376c6cee5acb1296a7bf8f3a41ce77`; decoded the observed control payload `c0fda8bf9eef5137b6cc2af08ca2218e28c1aa8a4c0f14b82b48a992d1ed7d6d` and verified its encoded/decoded report bindings. The parent native payload remains `124370fda57558ba6a4b6efabe9b09355f275625bbd3b58446db9c4894532b35`. No native or browser process was launched by this review.

## Independent numerical diagnosis

Using Python JSON/gzip decoding and NumPy, with polygon cycles canonicalized by vertex IDs while preserving orientation:

- All positions, complete native weight rows and point attributes are exactly equal.
- **875 of 6,400 polygon rows** and **1,750 of 13,218 triangle rows** differ in their ordered arrays. Their full oriented polygon and triangle multisets are nevertheless exact, without duplicate canonical keys.
- All **26,018 corners** have exact UV values after matching an oriented polygon and its vertex. Raw UV-array inequality was therefore an ordering consequence.
- **146 vertex normals**, comprising 214 changed components, genuinely differ. The maximum component difference is **`1.1920928955078125e-7`**.
- **574 mapped corner normals** genuinely differ, with the same maximum component difference. They do not become identical after accounting for face ordering.
- The maximum vertex-normal direction difference calculated with `atan2(norm(cross), dot)` is **0.000004800845 degrees**, at vertex **3483**. This is a measured residual, not a new acceptance tolerance or a visual-equivalence claim.

Concrete witnesses:

1. Polygon **5524** is `[2391,4622,6673,6280]` in the parent and `[3056,4636,6677,6356]` in the observed control. Both polygons exist in both surfaces. The first 5,524 polygons precede the 876 rolled faces; the reordered rows are in that rolled-face suffix. This localizes the ordering difference without proving its cause.
2. Vertex **2379** changes from `[-0.14427632093429565,-0.57498699426651,0.8053411245346069]` to `[-0.14427627623081207,-0.5749868750572205,0.8053410649299622]`.
3. Matched polygon **2288**, vertex **4593**, loop **9400**, has corner-normal Z changing from `-0.8976678848266602` to `-0.8976680040359497`; its other components and UV are unchanged.

The unchanged builder's `roll_the_hem` constructs new boundary faces and then calls `mesh.normal_update()` ([build_figure.py](../../../../tools/figure-pipeline/build_figure.py:1400)). Different face order and float32-scale normal differences are compatible with several native implementation details, including accumulation order. These observations do not establish which detail caused this run's differences. No normal quantization, recomputation or supposed harmless-noise threshold is justified by that inference.

## Two alternatives and selected scope

- **A — selected:** admit an explicitly revised geometric/data control using exact positions, complete weights, masks, canonical oriented topology, per-face smooth flags and per-corner UVs. Archive all normal residuals and retain `exactNormalIdentity=false` when applicable. Use the **frozen exact parent GLB** for actual appearance comparisons. This permits the bounded boundary experiment to proceed with a clear limitation: the rebuilt control does not establish byte-identical shading or isolate every rendered change to the intended cut.
- **B:** stop candidate work until a separate native-builder investigation establishes reproducible face production and normal values. This could restore the stronger original control, but expands the workstream and may require deliberately changing authoring implementation. It does not follow merely from reordering arrays in the observer.

The reviewed [V3 source](../../../../tools/critic/foundation-cut-band.py:418) keeps the raw ordered-field booleans, rejects duplicate oriented polygon keys, compares full oriented triangle multisets, maps UVs/smooth flags by face identity, and archives vertex and matched-corner normal observations. Its required exact fields exclude normal identity explicitly; its scope text states that limit. This matches alternative A. A future aggregate construction success must not be summarized as a pass of V1/V2's failed exact-normal requirement.

V2's recovery change—archiving the full observed control before the same guard—was necessary evidence collection. It did not repair the control. The boundary candidate was not attempted in V1 or V2. Native/export, coverage, topology, rest-body clearance and actual-image gates for any subsequently constructed candidate remain independent and unchanged.
