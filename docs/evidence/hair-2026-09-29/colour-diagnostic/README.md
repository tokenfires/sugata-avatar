# Hair colour as an appearance diagnostic

Robert proposed changing hair colour to reveal styling defects hidden by the dark default. The first controlled comparison supports using several diagnostic colours: medium brown exposes broad overlaps while retaining useful shadow separation; pale hair reveals silhouette and surface facets but loses some fine internal contrast. These are observations about inspection, not a new hairstyle or qualified colour feature.

The baseline is production g050/bob02 in Showcase, with the avatar at a fixed rest time and a 900 by 868 native canvas. Twenty successful still captures span the initial studio pilot, the controlled-clock pilot, and a three-view neutral-light comparison. Production code, assets, material defaults, and thresholds are unchanged. The reusable capture harness is [hair-colour-diagnostic.mjs](../../../../tools/critic/hair-colour-diagnostic.mjs).

## Evidence and viewing

The [summary](summary.json) records exact source/asset hashes, material vectors, camera-view names, held-state hashes, adapter identities, clocks, and independent dark-repeat differences. The [archive manifest](archive-manifest.json) binds 98 local files totalling 19,672,248 bytes, including complete reports, source snapshots, images, and failed-instrument records. The archive is local and ignored by Git; the manifest does not create an off-machine backup.

- [Original lighting pilot](../../../../captures/hair-colour-2026-09-29/pilot-v1/review.html)
- [Original lighting with owned render clock](../../../../captures/hair-colour-2026-09-29/pilot-v4/review.html)
- [Neutral diagnostic lighting from three views](../../../../captures/hair-colour-2026-09-29/neutral-v1/review.html)

All successful captures used the observed Apple Metal WebGPU adapter. Whole canvas images are retained without retouching or generated detail. The diagnostic colours change hue, chroma, and lightness together, so the experiment tests material-colour choices rather than lightness alone.

## Controls and the first rejected comparison

Pilot v1 held the GPU hair positions, velocities and rebuilt vertices, bone matrices, camera, configuration, and non-colour hair settings exactly across four fresh contexts. However, its independent dark repeat changed 321,313 pixels, with a maximum RGB difference of 87 code values. A measured central-rear rectangle had a p99 maximum RGB-channel difference of approximately 17 code values. Large recurring structures remained visible; fine detail comparisons were not controlled sufficiently.

Source inspection identified a relevant distinction already documented in Avatar: manual stepping fixes simulation time but leaves the renderer's internal node-frame clock running. Hair dithering and grain use that clock. The diagnostic now applies the existing `alive.js` capture pattern: stop that internal animation, reset node and temporal epochs, and tick once per intended rendered frame. This change is confined to the instrument.

Pilot v2 was stopped by an instrument bookkeeping error: the invariant snapshot included `grainFrame`, which should advance. Pilot v3 stopped because the clock check read the uniform object rather than its numeric value. Both source states and failures remain archived. V4 checks that counter explicitly as a clock value and retains exact fixed-state equality. No appearance threshold was relaxed.

V4 also records live light colours, intensities, transforms and dimensions, grade settings, exposure, AA/OIT and resolution scale. Every successful controlled arm reaches frame 98, grain frame 98, zero node time and delta, temporal jitter 5 of period 31, and history width 900. The original-light dark repeat falls to 92 differing pixels with a maximum difference of 6/255. This is a large reduction, not exact repeatability or an isolated attribution to one of the reset components.

## Neutral light comparison

The studio rear view was dominated by a blue rim, including the shirt and neck. The critic supplied two alternatives: neutralize the light colours in a separately labelled diagnostic, or isolate a change to only the blue rim. Root selected the first for this appearance investigation.

Neutralization converts each live light colour and hemisphere ground colour to grey with the same linear RGB Rec.709 luminance proxy. Scalar intensities, light positions, dimensions, exposure, geometry, material settings and pose remain fixed. It is not a replacement production rig or a spectral illuminance calibration. Within each view, the only difference between colour arms is the recorded hair base-colour vector. Each arm starts with fresh context and the same owned capture epoch.

| View | Independently repeated dark pixels that differ | Maximum RGB difference |
| --- | --- | --- |
| Back | 2 | 1/255 |
| Rear oblique | 0 | 0 |
| Right profile | 74 | 2/255 |

The twelve neutral image hashes, Apple adapter identities, expected temporal clocks and light-colour luminance calculations were checked from the saved records. Held physical/camera/material/light/render state matched exactly within each view. These checks support broad appearance diagnosis while retaining the stated pixel-repeat limits.

## Visible findings and decision

Both root and the independent critic directly inspected actual captures. Across colours and views, the crown and central back retain angular overlapping sections instead of the coherent curved flow in Robert's references. The lower edge retains competing lengths, gaps, a central pointed section, and an outward-hooked rear tail. Neutral lighting changes their visibility but does not remove them.

The critic's neutral rear-oblique witness identifies crisscrossed blocks around x350–535, y240–540, and a hooked tail around x535–620, y510–615. The right profile shows a diagonal strip crossing the downward front curtain around x205–395, y325–455. These approximate image regions locate observations; they are not segmentation masks or proof of which authored layer caused them.

Decision: use medium brown plus the exact intended dark appearance for the next structural comparison, with pale colour as a supplementary silhouette view. Stop tuning diagnostic colours. The next bounded step is to map the persistent rear and nape features to authored geometry/layers and any runtime deformation, then select one isolated candidate from evidence. Keep both geometry and shading explanations open until that attribution is established. Return to production lighting and intended colour when judging a replacement candidate.

Face framing, opposite-side ear behavior, movement, clearance, and final colour realism remain unassessed. No groom was changed or promoted during this slice, and the older TAAU ablation program was not resumed.
