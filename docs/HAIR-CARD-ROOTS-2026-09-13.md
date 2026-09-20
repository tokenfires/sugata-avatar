# Softer crown roots on both bobs — September 13, 2026

The current Avatar preview has fewer dark, square card starts across the crown. Both supported bobs now use a short root alpha feather, correct card root coordinates, and a conservative fallback for absent strand directions. The long-bob collision repair, accepted groom assets, solver, and motion-history implementation are unchanged.

This is a localized appearance improvement. Broad, flat card planes remain visible down the sides and back. The softer root transition also exposes a shallow step near the part, especially in the chin-length bob. The sampled images do not establish a new geometric hole. AAA appearance remains the ambition.

## What was proved and changed

| Observed mechanism | Chosen correction | Second alternative and tradeoff |
| --- | --- | --- |
| Ordinary card roots start at full width; the atlas fades tips but not those starts. Root widths have layer medians of roughly 35–48 mm. Material isolation and both-bob comparisons show root darkening contributes to the square crown patches. | Fade card alpha over the first 0.18 of its root-to-tip coordinate, preserving the opaque cap. A 0.08 comparison was less effective. The stronger fade exposes the existing part/contour step. | Author staggered, narrow individual root starts in the atlas or groom. This can break up the repeated silhouette more deliberately but requires a new asset and separate visual/contact qualification. |
| Flow-map blue is left at zero where no individual strand exceeds the generator's ownership threshold, even when accumulated alpha is visibly opaque. One middle-card texel has alpha 0.9333 and blue zero. The shader therefore darkens it as a root. | Derive root position from card UV v on the verified bob layout; keep the cap's existing blue convention. | Populate blue by row for every card texel in the generator. This repairs the data itself but requires rebaking and qualifying the affected sheets. |
| Unwritten direction RG=(128,128) decodes to a small diagonal rather than zero. With jitter disabled, the old epsilon produces a 44.279° direction error on an orthonormal card. This is a source/CPU counterexample, not a measured screen-space angle. | Treat squared decoded length at or below `(2/255)^2` as absent and use the card axis before existing jitter/tilt. The bound catches all 88,687 qualifying missing mip-zero directions and none of 492,761 authored directions in the inspected sheets. | Author directions from the strongest contributing strand and extend them into padding. This handles filtered boundaries more completely but changes the generator and requires an atlas study. |

The direction guard alone gives a subtle visual change. The combined root profile gives the larger crown improvement. Caps already cover the scalp: flat-alpha isolation shows nearly continuous coverage, so dark patches were not assumed to be holes. Forced-opacity diagnostic images retain their original shadow mask and cannot establish geometry in every pass.

## Integration boundary

`createHairMaterial({ cardRoots })` accepts an optional copied, frozen profile. The default is `null`, preserving standalone callers' flow-blue layout. Avatar opts in with `{ capStripEnd: 1/8, fadeLength: 0.18 }` for its current bob registry. Invalid numeric bounds reject before sheet loading. Legacy direct `HairLightingModel` callers need no new field.

The critic read all six supported groom files: bob01 g000/g025/g050/g075/g100 and bob02 g050. Each has 496 cards with 17 rings, root v=0, tip v=1, and every intermediate ring v=r/16. Caps stay below u=0.125; cards begin at u=0.1259765625. This proves addressing for those exact assets, not visual or collision qualification of every identity.

Root alpha is built before `configureHairMaterial` binds the shadow mask, so the new feather participates in beauty and shadow coverage. Shadow coverage intentionally changes. No extra buffers, ownership layer, asset rewrite, physics update, or production prototype patch is introduced. The direction guard also applies to standalone materials; only the bob coordinate/feather profile is opt-in.

Qualified production source hashes:

- `packages/core/src/material/HairMaterial.js`: `123b772a0f844805859f3013116ec4e8c019f99bdf84007ff0fdac52241380ab`
- `packages/core/src/Avatar.js`: `e099e2ebc1eb3baeadc1a1438618541357f8d311406231fc8c70c262107c2660`

## Evidence and limits

- Four successful isolation studies contain 50 still PNGs. The independent critic inspected the meaningful comparisons, verified every image hash, and checked 36 exact physical-state pairs and disposal of all 25 studied avatars.
- The integration study contains 54 PNGs from baseline, prototype, and integrated arms on both bobs, at 12°/45° and through 180 controlled natural-motion frames. All 18 prototype/integration PNG pairs are byte-identical. Hair centers, velocities, vertices, facial bone/morph state, camera, and clock match the baseline at all sampled comparison points. All six avatars finish with zero owned storage attributes and no leaked handles. The independent critic confirms the sampled motion comparisons; discrete frames cannot rule out intervening flicker.
- The five portable card-root CPU groups pass: default layout, copied/frozen profile and shared shadow alpha graph, rejection before loading, zero feather, and legacy direct model construction. Existing 137 Avatar assertions pass. These are API/graph checks, separate from shader execution.
- Actual WebGPU fallback MSAA renders both bobs with alpha-to-coverage, the expected profile, and the completed shadow graph. Both dispose with zero storage attributes, no render participants, and no leaked handles.
- All 13 image-export groups, 92 catalogue assertions, and the all-page build pass; the existing build size warning remains. Prior [owned hair history](HAIR-RENDER-HISTORY-2026-09-13.md) and [brow/lash coverage](FACE-CARD-COVERAGE-2026-09-13.md) qualifications remain separate; this change does not claim a new performance result or broader expression quality.

Failed harness starts are preserved: one used an unresolved bare browser import; another malformed the import argument during scratch preparation. Both failed before images. Neither is represented as an avatar defect. The corrected runs have distinct directories and source hashes.

Full local evidence lives in `captures/hair-card-roots-2026-09-13/`, including reviewed sources, saved programs, physical records, successful/failed reports, and the critic's proofs and two alternatives. The [tracked summary](evidence/hair-card-roots-2026-09-13.json) and [inventory](evidence/hair-card-roots-2026-09-13.manifest.json) identify it. Historical exploratory harnesses retain their scratch paths; use their frozen sources when reconstructing a comparison against the previous commit, rather than silently running a baseline arm on newer production code.

Portable check:

```sh
node packages/core/src/material/HairMaterial.card-roots.selftest.mjs
```

Next appearance work should address the broad card planes and the part/contour step as authored shape and layering problems. Preserve this accepted root correction while comparing a localized geometry or strand-layer alternative. The separate Converse truncation/timeout/server-error diagnostics also remain pending.
