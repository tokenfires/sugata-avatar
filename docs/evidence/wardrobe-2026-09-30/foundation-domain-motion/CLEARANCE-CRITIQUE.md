# Independent four-pose body-clearance critique

## Disposition

**The exact candidate fails the declared full-body exterior gate in every sampled runtime pose.** Preserve candidate `3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd` as an unsuccessful qualification, with its real static contour gains and separate elegant-outfit appearance failure. No geometry, mask, weight, or offset change follows from this review.

Reviewed [completed audit](../../../../captures/foundation-domain-motion-clearance-2026-09-30-v1/report.json), SHA256 `1e22fbe045b34606fdcced937b2442eb9b8785ece4da5d3e7497193019fe5e0f`, PID 8037, finished `2026-09-30T23:12:43.162Z`. `status: audited` records completion; `allFourStatesExterior: false` is the substantive result. No native/browser job or duplicate full audit was run by the critic.

## Bindings and scope independently checked

All **35 current input hashes and 35 archived copies** match. The pinned capture report is `24071200867f77630521e51202fe3c9de6069173cee905d0a5ecda713176953b`; its completed receipts were independently checked in [CAPTURE-CRITIQUE](CAPTURE-CRITIQUE.md). The audit uses CPU-skinned world positions saved as Float32, complete original band/body indices, and all 15,401 band triangles at each of four times.

The [instrument, lines 35–53](../../../../tools/critic/foundation-domain-motion-clearance.mjs) admits exact full band/body geometry, rig and time across the three candidate outfits before sharing each audit. This is valid for those full surfaces, although outfit draw masks differ. Source-welded body receipts report 13,380 vertices, 26,756 triangles, one component, Euler 2, no edge-manifold/orientation errors, and zero posed weld separation. These are topology/seam admissions, **not proof that the deformed surface has no self-overlap**. Twelve helper controls are recorded as passing; their results are not a substitute for the actual witness below.

I independently recounted every saved row and verified each state contains exactly the 15,401 unique band triangle IDs:

| Step / approximate seconds | Crossing band triangles | Centroids with absolute winding > 0.5 | Centroids with any inside parity ray | Ambiguous centroids | Negative vertex samples, with duplicates |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 / 0 | 436 | 963 | 837 | 0 | 1,634 |
| 240 / 4 | 429 | 1,003 | 853 | 0 | 1,616 |
| 480 / 8 | 433 | 1,044 | 892 | 0 | 1,621 |
| 720 / 12 | 431 | 1,004 | 859 | 0 | 1,620 |

These are crossing **triangle counts**, not every intersecting pair, visible defects, or unique negative vertices. Winding and parity totals differ and remain separately reported. This review does not infer their discrepancy's cause or present one as a correction to the other. The transverse intersection suffices to reject the gate independently of that unresolved aggregate difference.

## Concrete geometric failure

In the actual [step-0 snapshot](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/meshes-0.json.gz):

- Band triangle **26**, vertex IDs **[1950, 11, 1225]**, crosses body triangle **2215**, IDs **[1519, 1530, 1520]**.
- An independent NumPy segment/triangle calculation places the intersection at **(-0.1762569325084941, 1.2244314947201507, 0.034415769467256385) metres**, within **2.78e-17 m** per component of the stored witness.
- On band edge 1 the segment parameter is **0.7438192679049734**; body barycentric coordinates are **u=0.26540370243826733, v=0.522446679135472**. All are strictly interior to their respective valid ranges. The two triangle areas are approximately **29.07195 mm²** and **180.50697 mm²**, so this is not a zero-area-edge artifact.
- The independent solid-angle sum for the band centroid is **1.0000000000000002**; five independent vectorized ray casts reproduce **3 / 1 / 3 / 3 / 1** hits, all nonambiguous and odd. A second saved witness, band triangle 4, independently gives winding **0.9999999999999994**.
- The report additionally records **−0.839949205 mm** minimum local-normal-signed vertex distance for triangle 26. That local signed value is the instrument's auxiliary sample, not an independently recomputed penetration depth here. The direct triangle crossing is the independent failure proof.

The computation uses only the bound snapshot's full index triples and positions: standard segment/triangle barycentric intersection, summed oriented solid angles, and the five directions declared by [the predicate helper](../../../../tools/figure-pipeline/collar_clearance_review.mjs). It does not reuse the helper's triangle-distance function.

## Actual-image limit and two next alternatives

Reinspection of the [exposed candidate step 0](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/frame-0000.png) finds no attributable abrupt break at this witness. Its recorded-camera projection is approximately **(97.17, 628.72)** on the 800×1000 image, within the smooth-looking grey band. Body triangle 2215 belongs to the actual drawn body index, but a world-point projection does not establish visible pixel ownership or rule out nearer occlusion. The [elegant step-0 patches](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-elegant/frame-0000.png) are a separate visible failure; this body witness does not establish their cause.

1. **A — preserve the failed candidate and finish bounded attribution before any reconstruction.** The selected elegant colour-tag/ray/triangle/mask study addresses the conspicuous product regression. Any later fit investigation should trace this exact step-0 contact from source-rest geometry through the admitted runtime pose and binding, with the original candidate preserved. This separates appearance ownership from deformation mechanism; it costs diagnostic work and does not itself produce a qualified foundation.
2. **B — close this candidate's qualification now and retain the shipped foundation as the product default.** Carry the smoother-boundary method and these witnesses into a separately declared pose-aware foundation construction contract. This avoids local offsets or mask changes without a demonstrated mechanism, but defers the visible neckline improvement and requires renewed native/export, coverage, body/outfit and motion qualification.

The earlier source-rest exterior result remains valid for its own surfaces. Runtime step 0 already uses the relaxed-standing pose and is distinct. No conclusion identifies weight truncation, rig error, insufficient offset, or masks as the cause. There is no moving chest-ray coverage, band self-intersection, GPU vertex, intermediate-time, other-gesture, other-identity, or promotion certificate. The declared full-body gate remains failed even where ordinary imagery looks smooth.
