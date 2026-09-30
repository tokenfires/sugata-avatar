# Which front sections need reauthoring?

**The separate short fringe contributes the eyebrow-length ends and some crown coverage. Removing it leaves shorter broken panels underneath.** This controlled visibility experiment identifies a dependency; deletion is not a finished hairstyle.

## One visibility change

The asset is the qualified experimental side version `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`. Both arms attach the full groom and initialize its solver normally. The intervention then removes exactly 1,088 render triangles belonging to the 34 fringe cards, IDs462–495. Cap, solver layout and all physical buffers remain. The pinned asset has no triangles crossing card or cap component boundaries, so the existing index classifier is applicable.

Three matched pairs show front and both front obliques. Every recorded state field, including centreline, velocity and vertex hashes, is exact. All exported geometry values are exact except for the declared triangle indices. Full camera, material, lighting and owned-clock controls match. See [paired controls](../../../../captures/bob-fringe-ablation-v1/paired-controls.json).

| View | Full groom | Fringe hidden |
| --- | --- | --- |
| Front | [Control](../../../../captures/bob-fringe-ablation-v1/control/casual-front-medium-brown.png) | [Diagnostic](../../../../captures/bob-fringe-ablation-v1/hidden/casual-front-medium-brown.png) |
| Front right | [Control](../../../../captures/bob-fringe-ablation-v1/control/casual-front-right-medium-brown.png) | [Diagnostic](../../../../captures/bob-fringe-ablation-v1/hidden/casual-front-right-medium-brown.png) |
| Front left | [Control](../../../../captures/bob-fringe-ablation-v1/control/casual-front-left-medium-brown.png) | [Diagnostic](../../../../captures/bob-fringe-ablation-v1/hidden/casual-front-left-medium-brown.png) |

## Actual observations and decision

Root and independent critic inspected all six images. Front eyebrow ends at roughly x325–550/y300–340 diminish, while shorter abrupt panels remain at x310–520/y190–305. The front-right crown slit near x210–350/y105–135 becomes larger. In the opposite oblique, the forehead ledge disappears, while long sections beside the face remain. These regions refer to original 900×868 images.

R2 and R3 call for continuous part/root-to-face curves. They differ in face coverage and do not dictate a mandatory fringe, part side or exact final length. This diagnostic does not support changing only the 34 fringe cards or accepting the uncovered result.

The selected next discriminator uses calibrated source-layer colours with the fringe still hidden. It can separate visible contributions of roots, mass, veil and cap while retaining the same geometry and visibility selection. The alternative is to project residual triangles into the observed regions, shortlist card IDs, then perform a smaller visibility intervention. That is narrower but requires more work; projection alone cannot establish alpha-visible pixel ownership. See [independent critique](CRITIQUE.md).

## Preservation and limits

The [summary](summary.json) and [manifest](archive-manifest.json) freeze 58 files, 55,421,175 bytes and six PNGs under `captures/bob-fringe-ablation-v1`. Any follow-up must use a new root. Commands, job identities and subsequent decisions are in the [overnight checkpoint](../../../OVERNIGHT-2026-09-29.md).

Index removal also changes occlusion, shadows and temporal image inputs. Attribution is to the whole visible fringe group, not individual strand pixels. No new GLB, moving appearance or body-clearance result is established here. The raw files are local and ignored; the tracked manifest is not an off-machine backup. Accepted assets remain intact.

## Layer follow-up and protected authoring boundary

Three matching layer-colour renders under `captures/bob-front-layers-v1` preserve every exported geometry value and recorded fixed state relative to fringe-hidden beauty captures. Red root cards own the remaining short forehead stubs; purple flyaway, blue surface and yellow mass layers contribute crown silhouette breaks. The grey cap remains visible through the front-right slit. This supports a shared front support/flow experiment instead of fringe deletion alone. The independent critique records actual regions and two alternatives.

The [separate layer manifest](layer-archive-manifest.json) freezes34files/29,633,350bytes, including three actual colour renders and both projected inventories. `front-boundary-v2.json` is the current inventory: v1 incorrectly subtracted no cap prefix for its localTriangle field; v2 removes that field. Full primitive IDs and overlap areas are unchanged. Projected overlap is a shortlist, not alpha/occlusion ownership. These coordinates are posed world coordinates, not authored GLB coordinates.

Chosen boundary: preserve all338 already-qualified side/posterior cards and the cap; preserve long front-card lower suffixes and roots. Recompute a sustainedY1.55 boundary in GLB coordinates. Skip a card if its earlier prefix already dips below the plane or if fewer than three rings precede the join. A preceding fixed ring supplies the tangent into the exact suffix. Short root and fringe cards need coherent swept coverage, not another abrupt forehead cutoff. Card159 is too short above the boundary;352 dips then rises, so both remain unchanged in the first prototype. No final part side, bangs design or length was inferred as a user requirement.
