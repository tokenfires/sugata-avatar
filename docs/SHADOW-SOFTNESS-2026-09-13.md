# Softer hair shadows — September 13, 2026

The studio rig now gives its shadow filter approximately **10 mm of support at the light focus**. This softens the card-shaped patches on the chin-bob neck and the long-bob upper chest while retaining shading. The support is converted to shadow-map texels on each framing solve: approximately 22.16 in the recorded portraits and 5.01 in the full-body views. Hair geometry, collision, transparency coverage, lighting energy and the existing normal bias are preserved.

[Open the comparison](../captures/shadow-softness-2026-09-13/gallery/review.html). It includes both bobs, two framings, six sampled moments and matched portrait recordings. The runtime change is in `packages/core/src/render/LightingRig.js`; the existing declared-state check in `LightingRig.selftest.mjs` now expects this filter support.

## Cause and choice

Seven matched diagnostic portraits isolate the coarse neck patches to hair-cast shadows: disabling body casting leaves them; disabling hair casting removes them. The alpha mask is functioning. A zero cutoff and a removed mask produce identical images, while cutoff 1.5 matches disabled hair casting. The current 0.05 mask differs from the zero-cutoff control. Increasing the cutoff to 0.5 removes substantial shadow density but leaves the coarse silhouette; it is rejected as the fix.

The independent critic recommends **bounded filter support** as the smaller visible improvement. The alternative is **blocker-aware shadow filtering**, which can keep close contacts sharper while widening more distant shadows, at greater implementation and sampling cost. The accepted change remains an authored fixed-support approximation, not physical area-light penumbra. Installed Three 0.185.1 uses five Vogel samples, each with hardware PCF; only the radius changes, not the number of samples or shadow passes. This does not establish unchanged frame time.

In the manually selected chin-bob neck rectangle, mean encoded darkening relative to no hair casting is 11.49/255 at the original radius and 11.22/255 at radius 24. The latter softens the boundaries while retaining most of the density. These are descriptive local measurements, not a whole-skin contact gate.

## Validation and limits

Both bobs were compared at portrait and full-body framing across 4.5 seconds of native attention motion. All 24 paired saved samples preserve the recorded clock, action, body bones/morphs, hair simulation/vertices, face-card geometry and camera. Skin, cast flags and other recorded shadow settings agree; only radius/support changes. Eight Avatar retirements are clean.

A separate four-run portrait study records 136 frames per run at 30 Hz from 60 Hz simulation, plus six states per run. Its 12 paired states retain the same controls, all four retirements are clean, and four encoded clips contain the expected 136 frames. Root and critic inspect stills and consecutive frames; an encoded clip or a successful playback check alone is not a claim of perceptual review of every instant. Descriptive neck-region temporal changes decrease for bob02 and remain close for bob01; these include real motion and shading and do not prove absence of flicker.

The production integration adds four fresh runs. All 24 saved physical/control states match the selected scratch candidate, and the shadow-support values match as float32 uniforms. Across 24 images, 103 pixels differ in total, with a maximum channel difference of 2/255; exact pixel identity is not claimed. All four retirements are clean. The existing lighting and ground-contact gates pass 145/145 and 78/78 checks. All testbed pages build with the existing large-chunk warning. The gallery loads 24 paired moments, both 4.533-second videos advance, and its 390 px layout has no horizontal overflow.

The broader character target remains open. Coarse hair strips, mottled highlights, tee neckline/fit, more identities and complete outfit styling need further work. Fixed-support filtering can soften close contacts as well as distant shadows. The recorded body views preserve visible garment and shoe/ground attachment; this is bounded evidence for the tested configurations, not universal wardrobe or camera acceptance.

## Reproduction and retained evidence

The local archive is `captures/shadow-softness-2026-09-13`; tracked hashes and capture metadata are under `docs/evidence/shadow-softness-2026-09-13*`. Source, state and image controls are recorded in the individual reports. Earlier source for the two changed files is retained under `capture-source/`, with base commit `c510772`. Drivers retain their executed scratch paths and no-overwrite guards. Original PNGs are the visual authority; retained JPEG files are viewing copies. Ignored captures remain local evidence, not an off-machine backup.

The first softness driver used a `hair` query rejected by the deliberately constrained lookbook, timed out before creating an Avatar, and is excluded. The corrected driver uses the authored presets with a shared casual outfit and asserts the resulting hair/framing. An initial cross-job comparator also expected bit-identical original portraits; one green-channel value on the tee differed by 1/255. The final report records that difference instead of claiming exact cross-job pixels. Neither probe correction changed production behavior.

The archive manifest and current preview verification are linked from the tracked evidence ledger. This is a saved visual improvement, not a pause or completion of the AAA character goal.
