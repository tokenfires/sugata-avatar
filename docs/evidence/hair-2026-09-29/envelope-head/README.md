# Posterior bob through turns and tilts

**The reviewed head-turn poses retain the cleaner rear flow.** The frozen posterior candidate remains experimental, with zero selected body intersections at all 556 captured updates. The accepted asset is unchanged.

| Accepted source, upward tilt | Frozen posterior v3, same pose |
| --- | --- |
| ![Accepted bob tilted upward](../../../../captures/envelope-head-v1/baseline-rear-oblique-brown/frames/0255.png) | ![Posterior candidate tilted upward](../../../../captures/envelope-head-v1/candidate-rear-oblique-brown/frames/0255.png) |

The [paired video and original-frame viewer](../../../../captures/envelope-head-v1/review.html) shows the recorded sequence. Its Home/End/previous/next controls, video playback and desktop/mobile layout were exercised in the native browser. Root inspected the resulting mobile page. Playback functionality does not establish continuous perceptual quality.

## Fixed sequence and evidence

The same frozen candidate as the [ordinary-motion comparison](../envelope-motion/README.md) is used: SHA256 `d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146`.

Each arm has 555 advancing updates plus frame 0, covering 9.25 seconds at 60 Hz. All 556 selected-hair and posed-body geometry states are retained, with 186 original PNGs at 20 fps. The ordinary procedural layers are disabled before frame 0. A separate head layer applies the preserved anatomical yaw ±30°, downward pitch 20°, upward pitch 15° and roll ±15° keys through the same rig-relative rotation helpers used by the earlier nape diagnostic. The final two seconds show return/recovery; no settled-state criterion was imposed.

The [paired control audit](../../../../captures/envelope-head-v1/paired-controls.json) verifies exact setup and matching body positions, body normals, rig/head transforms, command angles, time and step count at every captured update. The material is medium brown and light chromaticity is neutral. Each arm owns its renderer and temporal clock. Original PNG and geometry hashes are checked.

The candidate changes the fitted shared skull radius by +1.024609650444 mm; shoulder capsules match. The radius is an asset-dependent runtime effect, and the comparison retains it. Other-card coordinates are preserved here, allowing their displacement to be measured. This does not recover the ordinary run's missing nonselected coordinates.

## Actual appearance review

The [independent critic](CRITIQUE.md) directly inspected 13 matched rear pairs spanning neutral, axis extrema, returns and final recovery. Root inspected additional actual candidate images. The candidate retains the continuous rear direction and removes the baseline's low tongue, crossed patch and outward nape hook in those views. There is no newly attributable large posterior opening, crease or returning card-47 diagonal in the inspected sample.

The lower edge is still blunt, the inward turn is incomplete, and crown/forward-side fragments remain. The upward-tilt frame 255 brings the hem close to the shirt. An intact image does not prove a garment intersection; the body audit omits garments and cannot prove garment clearance.

A continuity diagnostic finds a maximum head-relative selected vertex step of 1.075 mm and root-midpoint departure below 0.000187 mm. These values locate motion witnesses; they are not a hairstyle or settling score.

## Front witness for an indirect change

The largest measured change outside the selected cards is 7.193334 mm at fringe card 494's right tip, frame 373. Its authored coordinates were not edited. The changing shared collider is a plausible contributor; this comparison does not isolate the cause.

A second matched front capture includes the exact update 373 and its neighbors. Both arms retain 556 geometry states and 187 PNGs; the extra PNG is update 373. The [camera-repeat audit](../../../../captures/envelope-head-front-v1/view-repeat.json) verifies **bit-exact physical arrays at all 556 updates** between each arm's rear and front captures: selected and other vertices, selected centres, body positions/normals, head transforms, degrees, clocks, steps and colliders. Thus front frame 373 depicts the exact measured witness.

| Accepted source at update 373 | Frozen candidate at update 373 |
| --- | --- |
| ![Accepted front fringe witness](../../../../captures/envelope-head-front-v1/baseline-front-brown/frames/0373.png) | ![Candidate front fringe witness](../../../../captures/envelope-head-front-v1/candidate-front-brown/frames/0373.png) |

At the projected witness around x510–540/y335–360 in the 900×868 originals, root and critic see no obvious new bang gap, forehead exposure or crease in updates 372/373/375. Existing fringe irregularity remains. The outer side outlines differ because rear coverage is visible from the front. This is a bounded negative visual witness, not proof that card 494 is hidden, every fringe motion is acceptable, or the whole front is unchanged. No fringe or collider edit follows solely from the displacement statistic.

## Completed contact qualification

| Scoped result | Accepted source | Frozen candidate v3 |
| --- | --- | --- |
| Audited updates | 556 | 556 |
| Updates with selected triangle/body intersections | 556 | 0 |
| Maximum triangle/body pairs in one update | 434 | 0 |
| Minimum selected vertex clearance | −21.249 mm | 1.780 mm |

The baseline accumulates 93,650 repeated triangle/body pairs. The [baseline audit](../../../../captures/envelope-head-v1/baseline-rear-oblique-brown/numerical-checks.json) completed at 06:52:00 UTC and the [candidate audit](../../../../captures/envelope-head-v1/candidate-rear-oblique-brown/numerical-checks.json) at 07:00:41 UTC. Both exited successfully; original per-frame witnesses are retained.

Both audits evaluate 8,512 selected triangles and 9,044 vertices against the fully posed/morphed body at all captured updates. The comparison excludes garments, hair-hair contact, other groom cards and continuous time between 60 Hz updates. Alpha and rendered occlusion are absent from the geometric audit; intersection pairs are not visible clipping counts.

## Recovery and limits

Native rear batch exec25155 and front batch13051 completed with empty recorded page-error/HTTP-error arrays and clean owner disposal. Exact process IDs, times, source snapshots and hashes are retained in each report. CPU tools are `audit-envelope-head.mjs`, `audit-envelope-pair.mjs`, `audit-envelope-continuity.mjs` and `audit-envelope-view-repeat.mjs`.

The rear preview uses explicit 20 Hz image inputs. All 186 video presentation timestamps equal index × 50 ms; duration is 9.30 seconds including the last image hold. The front stream's extra image at 373 prevents treating all its PNGs as a uniform 20 Hz sequence.

Keep this qualified experimental checkpoint frozen while evaluating the next separate candidate. One body, one outfit and these two motion sequences do not establish other bodies/cuts, wind, garment clearance or complete medium-bob styling. See the [overnight checkpoint](../../../OVERNIGHT-2026-09-29.md) for exact jobs and the next bounded decision.
