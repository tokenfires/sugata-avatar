# Inward bob ends during movement

**The inward turn improves the inspected contour, but this version fails the upward-tilt body check.** The completed head audit finds 634 selected triangle/body pairs across 39 poses. The ordinary-motion check clears all 721 states, but does not override that failure. All captured geometry and simulation settings remain frozen; the qualified side version remains the moving lead.

- [Turns and tilts, with original PNG slider](../../../../captures/lower-head-v1/review.html)
- [Ordinary movement, with original PNG slider](../../../../captures/lower-ordinary-v1/review.html)
- [Static construction and dark comparison](../lower-curve/README.md)
- [Independent critique](CRITIQUE.md)

## Exact comparison

The control is the qualified experimental side version, SHA256 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`. The candidate is the inward lower curve, SHA256 `2b0c68c05802d0f515aa84b7e505fd325735befbc0159a50bd37cc887e274802`. Accepted assets and defaults are preserved.

The head sequence has 556 physical states at 60 Hz and 186 PNGs at 20 Hz, viewed from the right profile. It includes yaw ±30°, downward tilt 20°, upward tilt 15°, roll ±15° and a two-second return observation. The ordinary sequence has 721 physical states and 241 PNGs over twelve seconds, with 17 motion layers and seed 20260807, viewed from the opposite profile. All 338 selected cards and all 158 other cards have retained live coordinates. Caps are outside that per-card readback.

Both paired comparisons verify equal recorded body positions and normals, rig, head transform, steps, time, clock, capsule values and non-hair setup controls. The fitted skull collider is exactly equal too. See [head controls](../../../../captures/lower-head-v1/paired-controls.json) and [ordinary controls](../../../../captures/lower-ordinary-v1/paired-controls.json).

## A changed shape can affect untouched strands

Authored isolation does not imply identical simulated motion. The largest other-card difference is 6.296428 mm at fringe card 494, ring 16, side 1, head frame 373. In ordinary motion it is 0.552372 mm at card 238, ring 16, side 1, frame 397. These are measurements, not established visible defects.

The runtime derives per-card stiffness from a shared median of all guide lengths. The actual `deriveCardGroom` export gives medians of 151.325583 mm for the control and 153.144032 mm for the candidate. Card 494's own 120.998107 mm arc is unchanged, but its derived Float32 compliance changes from 1.250644207 to 1.265672922. In total, 157 otherwise unchanged cards receive different derived compliance. The [read-only calculation and source snapshots](../../../../captures/lower-head-v1/derived-compliance.json) preserve this concrete dependency. No causal ablation was run, so this does not establish that the shared median alone explains the measured movement.

Both front replays now match their respective profile run in every recorded physical field across all 556 states. Root and critic inspected frames 372, 373 and 375. A tiny horizontal brown dash near x507–518/y343–347 is visible in candidate frame 373 and absent from its control. A geometric projection places card 494 nearby, but does not establish pixel ownership. A supplemental body check of that card at those three poses finds zero pairs and at least 13.21 mm signed vertex clearance; it is not a whole-fringe pass.

Decision: retain this minor frontal exception for attribution. The next useful alternatives are to carry the witness into the planned fringe diagnostic or hide card 494 only in an exact replay to test its contribution. No stiffness adjustment is justified by the number alone. The side version remains the moving lead because of the separate neck-contact failure.

## Clearance and reuse boundaries

Both unchanged controls exactly replay every physical field of the earlier side-version candidate capture, including the selected hair positions, body positions, body normals and index descriptors consumed by the oracle. Their completed body audits can therefore be reused: zero selected body pairs in all 556 head states and all 721 ordinary states. Minimum vertex clearances are 1.379665 mm and 2.331497 mm respectively.

The [head reuse record](../../../../captures/lower-head-v1/control-replay-v2.json) and [ordinary reuse record](../../../../captures/lower-ordinary-v1/control-replay.json) verify report, raw sample, audit and source-snapshot hashes. The first head replay record remains preserved; its source check covered common paths only. The final version also verifies the differently named capture drivers and keeps its own source by content hash. These records explicitly link prior results; they do not impersonate fresh audits or infer pixel equality.

**Fresh head audit: failed.** All 556 states were audited. There are 634 triangle/body pairs across 39 states, with a maximum of 53 at frame 256. The minimum signed vertex clearance is −2.908619 mm at frame 255, card 172, ring 16, side 1. All 19 affected cards belong to the inner mass layer: 78, 80, 86, 101, 112, 113, 120, 127, 130, 131, 133, 135, 146, 151, 154, 162, 172, 173 and 177. The first failing state is 249. [Final head result](../../../../captures/lower-head-v1/candidate-right-profile-brown/numerical-checks.json).

The outer contour can look improved while inner cards enter the neck. These geometric pairs are not a count of visible pixels or garment contacts. The fresh ordinary audit clears all 721 states, with zero pairs and zero negative vertices. Minimum clearance is 2.311071 mm at frame 718, card 164, ring 16, side 0. Its result cannot override the head failure. No previous clearance pass transfers to this modified geometry.

## Appearance and limits

Root inspected head frames 90, 150, 210, 255, 315, 360, 435 and 555 in both arms, plus front 255, 372, 373 and 375. Root also inspected ordinary frames 0, 120, 240, 351, 354, 357, 396, 480 and 720. The rear tips keep their inward turn through those sampled poses. Shared texture softness, noisy boundaries and unfinished crown/fringe structure remain. The upward-tilt frame places hair close to the shirt, but proximity in that image is not a garment-contact result.

The largest head-local selected vertex step is 0.960470 mm at card 296 from frame 230 to 231. Ordinary motion's maximum is the previously identified rotating root edge of card 40, 8.180976 mm from 353 to 354; the root midpoint remains anchored within 0.000169 mm. Edge displacement is not root detachment or a demonstrated visible jump. Original neighboring PNGs remain the visual evidence.

The videos have verified uniform 20 Hz presentation timestamps and durations of 9.30 and 12.05 seconds, including the last display interval. They are compressed previews. Native page checks passed desktop and mobile image loading, layout, keyboard frame controls and advancing video playback. Root inspected the actual lower comparison and head mobile page. A second native pass captured the failure-labelled overview and preserved every reviewed HTML source. Root inspected its mobile inward-ends section too; both passes pin the exact reviewed versions. No continuous perceptual playback, general settling, garment contact, hair-hair contact, all-view or all-motion acceptance is claimed. Body audits exclude alpha, final occlusion, nonselected cards and time between captured updates. Local ignored raw files are not an off-machine backup.

## Frozen evidence and next decision

The final archive inventories 5,083 files, 5,701,225,079 bytes and 1,244 original PNGs across six local roots. See [summary](summary.json) and [manifest](archive-manifest.json). These roots are frozen.

The critic recommends one bounded alternative: restore the 19 proven triangle-contact cards from the qualified side version, keeping the remaining inward curves. The other alternative is a layer-aware inner-clearance constraint, which needs broader authoring work. Root selected the exact-card restoration as a separate candidate; it inherits no visual or motion pass. If it fails, reconsider the layer representation rather than repeatedly widening the fallback or tuning amplitude.
