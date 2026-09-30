# Front flow: two rejected constructions

Layer-colour evidence separates the short forehead stubs from longer crown and face-framing sections. Two isolated constructions tried to replace those abrupt ends with a shared sweep. **Both are rejected.** The side and inward-end leads remain preserved, and no accepted asset changed.

| Source-rest check, all158 front cards | Triangle/body pairs | Negative vertices | Minimum clearance |
| --- | ---: | ---: | ---: |
| Unmodified side control | 0 | 0 | 3.513636 mm |
| Free Cartesian curves | 896 | 168 | −26.794815 mm |
| Shared ellipsoid support | 42 | 5 | −6.717103 mm |

## What the images establish

The [free-curve front](../../../../captures/bob-front-flow-v1/neutral/casual-front-medium-brown.png) appears to remove the short bangs and open the face, but its geometry passes deeply through the head. The apparent gain is invalid: hidden penetrating hair cannot count as a styling improvement. The [front-right view](../../../../captures/bob-front-flow-v1/neutral/casual-front-right-medium-brown.png) also retains the crown slit.

The [supported front](../../../../captures/bob-front-support-v1/neutral/casual-front-medium-brown.png) and [opposite oblique](../../../../captures/bob-front-support-v1/neutral/casual-front-left-medium-brown.png) show inflated crown arcs and large angular joins. Fewer intersections do not make this a better hairstyle. The global conservative envelope and exact short joins need a different construction, not another handle or amplitude sweep.

Root inspected all six candidate renders and the three corresponding [control images](../../../../captures/bob-fringe-ablation-v1/control/review.html). The [independent critique](CRITIQUE.md) records actual regions, source witnesses and two alternatives per actionable finding.

## What stayed fixed

Both candidates start from side-v3 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`. All338 protected side/posterior cards, the cap, roots and declared lower long-card suffixes retain exact authored POSITION/NORMAL records. UVs, weights, topology and materials remain.156 front cards changed; cards159 and352 were skipped because their proposed upper prefixes were infeasible. Coordinates and the sustainedY1.55 boundary are computed in authored GLB space, not copied from posed-world inventory.

The new curves retain original widths. The second prototype interpolates angle and height over one body-enclosing ellipsoid, with width allowance and endpoint offsets. Its finite sampled joins reach65.34° at card204; smooth analytic endpoint derivatives do not make a short sampled join smooth.

Matched source, camera, light, material, physical settings and owned clock checks pass for all six comparisons. Authored-to-live vertex differences are at most0.000657mm. Thus the renderer did **not** materially repair the invalid rest curves in these captures. Protected live vertices differ by at most0.000120mm for the free curves and are exact for the support candidate. Per-card geometry readback excludes the cap; cap preservation is established by authored record checks.

## Exact recovery

- Free curves: `tools/critic/bob-front-flow.mjs`; asset `captures/bob-front-flow-v1/candidate.glb`, SHA256 `8503966620ed993eea2e2dbb2a60bea6265c84256e1848e6e72c0cfde8dde412`. Native capture16102 completed and collected.
- Support: `tools/critic/bob-front-support.mjs`; asset `captures/bob-front-support-v1/candidate.glb`, SHA256 `488f5ea56c7afdebf83b6c65330f86e24109f798c81468e14ee0f5b78e847cc0`. Native capture76345 completed and collected.
- Focused comparison and baseline body oracle: `tools/critic/audit-bob-front-prototypes.mjs`; `captures/bob-front-prototype-audit-v1/summary.json`, session60682 completed and collected.
- Both captures use `hair-colour-diagnostic.mjs --lighting=neutral-chromaticity --views=front,front-right,front-left --colours=medium-brown --geometry=on` with the respective isolated candidate/output paths. Exact sources, image hashes, process IDs and times are retained in each report.

No motion sweeps were launched for these failed candidates. Body checks do not include garment, hair/hair or alpha visibility. Raw local files and reports remain preserved; archival hashes do not constitute off-machine backup. The next attempt must justify its support and joining space from the actual head and valid existing roots before native capture. Keep these failures as controls.

## Four-witness follow-up and frozen evidence

The critic's [read-only constraint packet](../../../../captures/bob-front-constraints-v1/report.json) pins cards 7, 46, 145 and 204. At the two crown-root heights, its explicitly defined horizontal rays find no forward body hit while the ellipsoid imposes large radii. No-hit means no intersection on that ray; it is not converted to a zero body radius or a clearance pass. Cards 145 and 204 each have only one free ring, exposing the lack of space for the proposed outward transition. At card 46, an almost perfectly tangent-orthogonal width axis still leaves one edge inside the head: simple frame orthogonalization is insufficient.

The next step is a local mesh-supported full-ribbon feasibility study for these witnesses. It must distinguish a clear original path from feasibility of the requested swept endpoint. No feasibility solver has run. A broader redesign of front attachment frames and transition boundaries is the second alternative, with a larger qualification cost; it must explicitly revise the protected boundary instead of silently changing it.

[Summary](summary.json) and [manifest](archive-manifest.json) freeze **74 files, 64,059,418 bytes and six PNGs** across the two candidate roots, comparison audit and four-witness inventory. The nine original candidate/control images were reviewed directly; the three controls remain in their earlier frozen archive. The front packet was frozen at 11:27:44 UTC. Do not append to these roots.
