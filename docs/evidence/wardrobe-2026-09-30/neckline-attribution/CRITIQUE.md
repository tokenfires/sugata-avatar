# Independent current-neckline attribution critique

Reviewed 2026-09-30. The critic directly inspected all five original V2 PNGs, the capture/picker/analyzer sources, their completed reports, and the declared sampled ray witnesses. No native capture, geometry construction, or asset change was performed by the critic.

## Disposition

**The current grey neckline islands visibly expose the retained bra.** Their coherent magenta response and corresponding CPU first-hit ownership support this attribution at the sampled current static view. Making the outer cloth double-sided does not remove them. Restoring full-body indices for CPU picking does not place body in front of the 46 bra-first witnesses.

This establishes a useful appearance target: a continuous intentional neckline without these isolated foundation patches. It does not establish that every exposed sample is a cloth/bra triangle intersection, prove a missing-body cause, or qualify a garment repair. Keep accepted `44ebc3…` as default. The September 26 joint bra/vest experiment remains closed under its original support and gates.

## Evidence integrity and capture scope

- [Completed V2 capture report](../../../../captures/neckline-attribution-2026-09-30-v2/report.json), SHA-256 `185e179b319535d14ec559db8f31408f201c72861b4c4e009713163787081fcd`: five completed arms, 900×868 canvases, Apple metal-3 WebGPU, no recorded page/console/HTTP errors, five successful disposals with empty leak arrays.
- All five compressed and decoded physical-state hashes match. Recorded GPU hair state, CPU-skinned body/garment world positions and indices, rig, camera and lights are equal. Final frame/grain are 99, time/delta are zero, and recorded temporal state matches across arms. This is equality of recorded fields, not an exhaustive render-history proof.
- Every observed GLB response is bound to its pinned source hash; the actual outer response is accepted `44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783`. The critic independently verified all five PNGs, compressed/decoded state files, archived non-asset/non-node_modules source copies and report asset-hash bindings without mismatch.
- [Analyzer report](../../../../captures/neckline-attribution-2026-09-30-analysis-v1/report.json), SHA-256 `8847a3ae6011dbe9649fbca4c6b951707ed635db4de415ef9c1c8c0b05b310ae`: input report, analyzer source and PNG decoder hashes agree. The analyzer samples the exact pixel selected by each pixel-centre ray and records all 90 predeclared samples without applying an RGB causality threshold.
- V1's failed browser import is preserved. V2 moves the `vec4` import into the Vite-loaded helper, maintaining the intended diffuse tag. The final-clock comparison requested in source review is present and passed. Neither change edits product or garment geometry.

## Actual images and ownership witnesses

The [ordinary image](../../../../captures/neckline-attribution-2026-09-30-v2/ordinary.png) retains the stepped grey left island at approximately x198–220/y696–735 and the smaller right interruption at x504–523/y714–735. Both become coherent bright magenta regions in [bra-magenta](../../../../captures/neckline-attribution-2026-09-30-v2/bra-magenta.png). They persist in [cloth-double](../../../../captures/neckline-attribution-2026-09-30-v2/cloth-double.png). In [body-green](../../../../captures/neckline-attribution-2026-09-30-v2/body-green.png), the surrounding skin turns green while the foundation regions remain visually distinct. The [ordinary repeat](../../../../captures/neckline-attribution-2026-09-30-v2/ordinary-repeat.png) provides the unchanged-look control.

The 90 samples comprise 46 bra-first rays (34 left, 12 right), 20 body-first rays and 24 cloth-first rays. All 46 retain the same first bra triangle under outer DoubleSide and CPU full-body restoration. Bra-tag RGB differences on bra-first samples are R +48…+98/G −108…−29/B +61…+99 on the left and R +54…+92/G −95…−29/B +61…+94 on the right. These summaries support, rather than replace, direct image inspection.

| Pixel centre | Ordinary → bra tag RGB | Ordinary CPU hit order | Bounded interpretation |
| --- | --- | --- | --- |
| Left (206.5, 708.5) | [137,114,104] → [231,12,201] | bra 8881 → near-front cloth 1509 → body 2401 | Bra visibly precedes a nearby outer-cloth surface. Body-green, DoubleSide and repeat are exactly unchanged at this sample. |
| Right (516.5, 726.5) | [179,161,146] → [233,132,207] | bra 12280 → body 15651 | Bra exposure is demonstrated; the ordinary ray does not establish near-front cloth behind it. DoubleSide adds far rear cloth 645, behind the body. |

The left bra/cloth ray-depth difference is approximately 1.563 mm. This is a view-dependent ordering distance, **not penetration depth**. The right DoubleSide cloth hit is approximately 104.414 mm beyond the first bra hit and cannot be treated as a local neckline covering surface.

## Finding 1: construct an intentional neckline around the actual layer stack

**Mismatch:** the current visible boundary is interrupted by foundation islands instead of reading as a continuous pale collar. The exact left and right witnesses above establish the visible owner. The historical lining mechanism only renders selected back faces at unchanged positions (`GarmentInterior.js` lines 89–104); current DoubleSide evidence gives no basis to extend that band as the remedy for these chips.

### Two concrete approaches and tradeoffs

**A — Recommended next construction direction: one separately specified outer-neckline patch.** Design a continuous collar rim and a connected upper-cloth transition around the actual body and retained foundations. Work from accepted44 as the comparison, preserving lower garment, unrelated materials, body and foundation masks. Give the new patch enough explicit geometric support to cover the observed front/side exposure and maintain a coherent contour; assess front and both oblique views before adding decorative seam detail. A narrow facing/binding may be part of the construction, but must have a declared surface and clearance purpose rather than merely recolouring the exposed bra.

This is a new construction contract, not the old 102-variable solve with loosened thresholds. For a bra-and-vest claim, support/boundary design must explicitly account for the known rear contact region, including faces 1503/1515/1516/1517 or their replacements. Keeping those obstructing faces fixed while promising joint vest clearance would reproduce the old contradiction. Start by declaring the replacement boundary and protected attributes; do not export a trial until those constraints are meaningful. Added thickness can consume clearance and needs its own evidence. The benefit is direct control of the desired visible collar; the cost is fresh topology/fit/coverage and motion qualification, with no inherited promotion.

**B — Distinct alternative: author a compatible lower-cut foundation variant.** Preserve the accepted outer neckline and create a genuinely lower neckline/strap shape for the foundation so its physical surface lies under the intended outer coverage. Keep this a separate authored garment/configuration; do not delete currently retained triangles, paint the chips to match cloth, or remove the foundation from the outfit. This preserves the outer silhouette, but transfers the work to foundation fit, standalone coverage, layering and lifecycle compatibility. It also does not solve vest compatibility or the outer garment's other known contact/shape defects. It is a larger product-contract change and therefore less attractive than A for this collar appearance slice.

Neither option promotes the historical d81 candidate or restarts the closed support experiment. Its exact fixed-face counterexample remains valid: see [replacement clearance](../../collar-2026-09-26/replacement-clearance/README.md) and the immutable-support restriction in [the old interface](../../collar-2026-09-26/replacement-clearance/CONSTRAINT-INTERFACE.md).

## Finding 2: exposed foundation is not an all-sample crossing diagnosis

**Actual limits:** only 14 of the 46 ordinary bra-first rays contain a later cloth hit. Even a nearby later cloth hit proves depth order, not triangle intersection. The right witness above instead looks through the neckline toward body; far rear cloth supplied by DoubleSide is irrelevant to a local crossing assertion.

A boundary counterexample also prevents treating the CPU first-hit map as exact raster ownership: at (198.5,696.5), ordinary CPU picking is cloth 1488 first, yet the bra tag changes RGB by [23,−6,+43]. Finite pixel coverage and temporal reconstruction mix neighbouring contributions; this packet does not separately identify their individual contributions. Some bra-first boundary samples also respond to body-green. Accordingly, the visually distinct grey patches and strong central witness support regional attribution, not a claim that each final pixel contains only one surface.

### Two alternatives and tradeoffs

- **A — Recommended for this completed slice:** carry the result as visible retained-bra exposure with explicitly recorded per-witness depth order. Use the two different left/right witnesses to guide the new collar boundary rather than fitting all 46 rays as penetration constraints. This is sufficient for selecting the appearance problem and avoids an unsupported geometric diagnosis.
- **B:** if the next construction requires contact directions, check exact triangle intersections and separation for the identified nearby cloth/foundation pairs in the saved actual pose, then distinguish contact from exposed edge coverage. This supplies geometric constraints but is additional work and still cannot turn the sampled static view into all-motion or all-foundation acceptance.

## Repeat, sampling and stop limits

All 90 sampled RGB triples are exactly unchanged by cloth-double and ordinary-repeat. The complete ordinary/repeat canvases nevertheless differ at 410 of 781,200 pixels, with maximum channel difference six codes. The sample equality is not full-image identity or a tolerance waiver. CPU picks retain only six nearest hits, exclude GPU hair and do not reproduce shadows, raster coverage or temporal filtering. Their missing deeper hits are not complete ray-miss proofs.

No source defect requiring repair was found in the analyzer for these recorded inputs. No additional attribution arm is necessary before deciding the new construction boundary. This packet establishes the current visible owner and rules against the proposed culling-only remedy at these samples; it does not construct, clear or promote a garment.
