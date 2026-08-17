/**
 * Gate for `motion/Sway.js` — the inverted pendulum, measured on a real figure, in the frame the
 * literature was measured in.
 *
 * This file has been re-rooted twice, for the same reason both times, and the second one is why it
 * is worth reading the header before the code.
 *
 * The first version gated a spine bend and passed. A per-pixel temporal-sigma heat map over 600
 * frames of full-body idle came back DEAD BLACK below the hips, with a hard horizontal cut at the
 * hip line, and the measured pelvis, calf and foot world path over 20 s was exactly 0.0000 mm. So
 * the model became an ankle-rooted pendulum and this file grew a LOWER BODY section.
 *
 * The second version gated ONE trace against ONE set of numbers, and that was a category error.
 * There are two regimes in the record and they are measured under different protocols, with
 * different amplitudes, and with OPPOSITE anisotropy:
 *
 *   QUIET STANDING — Quijoux et al. 2021, *Physiol Rep* 9:e15067, force-plate column. 60 s, "stand
 *   as still as possible", eyes open. Centre-of-pressure RMS 3.0 mm ML / 4.9 mm AP, anisotropy
 *   1.5–2.0 with AP always the larger, mode 0.33/0.27 Hz, f50 0.43/0.42, f95 1.09/1.23, essentially
 *   nothing above 2 Hz.
 *
 *   ⚠️ The cohort mean age is 71.3 years on the plate and 78.7 on the board, and
 *   `research/body-motion-numbers.md` records that sway rises systematically from about age 60.
 *   These are elderly reference values standing in for a young avatar. No young-adult
 *   centre-of-pressure RMS in millimetres was found to substitute.
 *
 *   ⚠️ Duarte's shortest weight-shift interval is 199 s — longer than Quijoux's whole trial — so
 *   the weight-shift process is absent from that data BY CONSTRUCTION. Gating a composite trace
 *   against it therefore gates the wrong signal.
 *
 *   UNCONSTRAINED STANDING — Bates AV, McGregor AH, Alexander CM (2021), *BMC Musculoskelet Disord*
 *   22:1005. 22 normal-flexibility controls, FIFTEEN MINUTES, told they could change position as
 *   they wished, watching a documentary. Centre-of-pressure SD 16.87 mm ML (IQR 9.58–66.5) and
 *   16.32 mm AP (IQR 10.34–28.75), sway area 48.31 cm², anisotropy ≈1.03 — INVERTED from quiet
 *   stance, because Duarte's larger and more frequent lateral weight shifts have had time to
 *   assert themselves.
 *
 * So the balance band is gated against Quijoux and the composite against Bates, and the anisotropy
 * gate lives on the balance band and ONLY on the balance band.
 *
 *
 * 🎯 EVERY AMPLITUDE HERE IS A CENTRE-OF-PRESSURE AMPLITUDE. THE HEAD IS AN OUTPUT.
 *
 * `Sway.js` no longer authors head excursion. `POSTURE_HEAD_TRANSFER = 0.20` — a hand-set guess at
 * "what fraction of a weight shift reaches the head" — is deleted, because static equilibrium
 * decides it rather than a tuner: a body that is not accelerating has no net moment, so the ground
 * reaction passes through the centre of mass and a SUSTAINED centre-of-pressure offset IS a
 * centre-of-mass offset. Measured on this rig the true head-per-centre-of-mass figure is 1.653.
 *
 * That has a consequence for what this file must check. `layer.balanceDisplacement` is a COMMANDED
 * quantity: it is the noise table times an authored amplitude, and it would read correctly on a rig
 * with no legs at all (§1.3 — what would a degenerate input score?). So the balance-band section
 * gates the command AND closes the loop, by computing the figure's actual whole-body centre of mass
 * with `figure/BodyMass.js` on every frame and requiring the two to agree. A wrong lever passes the
 * first and fails the second, and THE OTHER WAY proves exactly that.
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   RIG            The measured levers, the head-per-centre-of-mass ratio against the rig's own raw
 *                  geometry, the posture clamps read off the base of support, and the centre of mass
 *                  against Winter's independent anatomy via BodyMass's two self-checks.
 *
 *   BALANCE BAND   `balanceDisplacement` in centre-of-pressure millimetres over a seed × window
 *                  matrix, against Quijoux. Anisotropy gated here and nowhere else. Plus the loop
 *                  closure above.
 *
 *   COMPOSITE      900 s of balance + posture against Bates' INTERQUARTILE RANGE. The anisotropy is
 *                  reported and deliberately NOT gated, because it inverts and that is correct.
 *
 *   HEAD EXCURSION Measured and REPORTED. 🚩 No published absolute head-sway amplitude in
 *                  millimetres for healthy adult quiet stance was found, so this number has no
 *                  direct empirical check — only the lever that produces it does. It gets a wide
 *                  sanity envelope and nothing more, and §1.9 requires saying so out loud.
 *
 *   AMPLITUDES     An analytic oracle on the lognormal shift draw: it must reproduce Duarte's mean
 *                  AND his standard deviation, and it must NOT be the folded gaussian it replaced.
 *
 *   LOWER BODY     The pelvis, knee and ankle move at all, on the layer as constructed — the
 *                  failure this file was born from measured 0.0000 mm there.
 *
 *   PENDULUM       And they move as a rotation about the ankles: excursion against the pendulum's
 *                  OWN geometric prediction, read off the rig at test time. Getting the right
 *                  answer for the wrong reason fails here.
 *
 *   PLANTED FEET   There is no foot IK, so the soles are gated in millimetres and degrees. ⚠️ THIS
 *                  SECTION CURRENTLY FAILS, and it is a real defect in the layer rather than a
 *                  range that wants widening. See its own header for the measurement.
 *
 *   POSTURAL BAND  The spectrum, so a lower body was not bought with a faster sway. Above 2 Hz
 *                  reads as tremor, which is the fastest way to make a standing figure look ill.
 *
 *   EVENT RATES    Duarte's fidget and shift rates, and the RELAY rate separately — the relay is
 *                  punch-list 2.9's gate. Both patterns must appear and the direction draw must be
 *                  a fair coin, which it demonstrably was not before the rewrite.
 *
 *   DISCOURSE      Cassell's 26% / 8% coupling.
 *
 *   TRUNK          the shoulder line the layer realises against the one the pose draws, and the
 *   ARTICULATION   shoulder band minus the hip band — a DIFFERENCE, because every other lateral
 *                  gate here is a ratio of two travels and a rigid torso scores 1.000 on all of
 *                  them. That is how a torso 93% rigid on its pelvis passed the whole file.
 *
 *   GLANCE         per-band silhouette travel in PIXELS inside the fifteen seconds a viewer spends
 *   LEGIBILITY     deciding whether a thing is alive, at the framing `alive.js?frame=body` uses,
 *                  over the same twelve seeds as every other amplitude gate here. A raw standard
 *                  deviation is structurally unable to see this defect, and the section header
 *                  records why the number it was first reported against was out by an order of
 *                  magnitude — a peak-to-peak floor compared against an SD. It also records the
 *                  §1.1a round: the first version ran on ONE seed and its ankle/knee ratio failed
 *                  on two of the twelve.
 *
 *   THE OTHER WAY  §1.1 — a gate that has never failed is not known to work. Known-bad layers are
 *                  constructed and the gates above must reject them, by name.
 *
 *   FRAME-RATE     the same seed at 30, 60 and 120 Hz must produce the same TRAJECTORY. It did not:
 *   INVARIANCE     the arrival processes drew one random number per FRAME, so at the 30 fps the
 *                  judge captures at, the figure never completed a weight transfer that this file
 *                  proved it completes at 60 Hz. Every other section here was green throughout,
 *                  because the event RATE was correct the whole time — see that section's header.
 *
 * A measurement outside its range is printed as FAIL and the process exits non-zero. It is not
 * grounds for widening the range.
 *
 * 🚩 The figure is posed into `relaxed-standing` before anything is measured, because that is what
 * `testbed/src/alive.js` does and every number in this file is a fact about the posture the stack
 * actually runs in. The bind pose holds the arms 41.8° out, which lifts a tenth of the body's mass
 * and moves the centre of mass — and therefore every lever below — by a measurable amount.
 *
 * 🚩 The Welch/FFT helpers at the bottom are the third copy in this directory
 * (`idle-motion.selftest.mjs` and `BodyIdle.selftest.mjs` have the other two). They belong in a
 * shared `motion/spectrum.mjs`. They are duplicated here rather than extracted because this gate
 * has to be runnable on its own — a gate that only works as part of another file's run is not a
 * gate — and because the file that owns the existing copies is not this change's to move.
 *
 * Usage:  node "packages/core/src/motion/sway.selftest.mjs"
 *         node "packages/core/src/motion/sway.selftest.mjs" assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader to the skinning data. They must be in place before the
// dynamic imports below.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Box3, Quaternion, Vector3 } = await import( 'three' );
const { Figure } = await import( '../figure/Figure.js' );
const { Skeleton, HUMANOID_TO_FIGURE_BONE } = await import( '../figure/Skeleton.js' );
const { RestPose } = await import( '../figure/RestPose.js' );
const { BodyMass, WHOLE_BODY_COM_FRACTION_OF_STATURE } = await import( '../figure/BodyMass.js' );
const { MotionStack, createMotionTarget } = await import( './MotionStack.js' );
const { MotionRandom } = await import( './Signals.js' );
const { Sway } = await import( './Sway.js' );

// 🚩 THE REST OF THE STACK, imported only for the FULL STACK section at the end of this file.
// A layer gated only on its own is gated in one composition, and every verdict this project has
// ever taken on head-over-hip was taken on a render of all ten of these running together. See
// `measureFullStackHeadOverHip`.
const { Breath } = await import( './Breath.js' );
const { BodyIdle } = await import( './BodyIdle.js' );
const { HandIdle } = await import( './HandIdle.js' );
const { IdleMotion } = await import( './IdleMotion.js' );
const { Gaze } = await import( './Gaze.js' );
const { Blink } = await import( './Blink.js' );
const { FacialIdle } = await import( './FacialIdle.js' );
const { Pupil } = await import( './Pupil.js' );

// 🚩 THE AFFECT HALF, imported for punch-list 6.9's AFFECT → BALANCE section. The presets come from
// `testbed/src/affect-presets.js` rather than being restated, for the reason `affect.selftest.mjs`
// gives at its own import: that module exists because `alive.html` and `affect.html` must pose the
// SAME PAD points, and a gate with a private copy is a third table to disagree with the other two.
const { ExpressionLayer } = await import( '../affect/ExpressionLayer.js' );
const { CENTRE_OF_PRESSURE_FULL_SCALE_METRES, COULSON_WEIGHT_COLUMN } =
    await import( '../affect/PostureLayer.js' );
const { EMOTION_PRESETS, settleAffect } = await import( '../../../testbed/src/affect-presets.js' );

// The capture tool's postural nomination — which seeds it will hand a judge, and what it claims is
// in them. Imported rather than restated so that the claim and its proof cannot drift apart: this
// file re-measures every number in that table on every run. capture.mjs only runs its main() when
// it is the process entry point, so importing it here costs a module parse and nothing else.
const {
    POSTURAL_JUDGEMENT_SEEDS,
    POSTURAL_EMPTY_SEEDS,
    POSTURAL_CLIP_SECONDS,
    POSTURAL_HOLD_PIXELS,
    POSTURAL_HOLD_SECONDS,
    POSTURAL_SMOOTHING_SECONDS
} = await import( '../../../../tools/critic/capture.mjs' );

const SAMPLE_RATE_HZ = 60;
const FRAME_SECONDS = 1 / SAMPLE_RATE_HZ;

const SEED = 20260807;

/**
 * The seed × window matrix every amplitude gate runs over.
 *
 * Twelve seeds because the sway statistics are estimates with real sampling error and one draw of
 * any of them proves nothing; three windows because the two regimes this file gates live at
 * different window lengths — Quijoux recorded 60 s, Bates recorded 900 s — and §1.4 says the
 * observation window is itself a gate parameter. The three windows are PREFIXES of one 900 s trace
 * per seed, so the whole matrix costs twelve runs rather than thirty-six.
 */
const SWAY_SEEDS = [ 1, 7, 42, 101, 777, 1234, 4242, 9999, 31337, 65537, 20260807, 99999989 ];
const SWAY_WINDOWS_SECONDS = [ 60, 300, 900 ];
const TRACE_SECONDS = Math.max( ...SWAY_WINDOWS_SECONDS );

/**
 * The bands the glance-legibility gate measures, identical to `tools/critic/travel.mjs`'s defaults
 * so that an offline prediction and a capture measurement can be laid side by side. The bounds are
 * fractions of the CAPTURE FRAME with 0 at the top, which is that tool's convention.
 */
const GLANCE_BANDS = [
    { name: 'head', top: 0.08, bottom: 0.20 },
    { name: 'shoulder', top: 0.20, bottom: 0.32 },
    { name: 'hip', top: 0.42, bottom: 0.52 },
    { name: 'knee', top: 0.62, bottom: 0.72 },
    { name: 'ankle', top: 0.82, bottom: 0.92 },

    // 🚩 THE FEET, AND THIS ONE IS AHEAD OF `travel.mjs` RATHER THAN COPIED FROM IT. That tool's
    // table stops at the ankle band and its `whole` band is 0.05-0.95 explicitly to keep the floor
    // contact shadow out of a THRESHOLDED silhouette. Nothing is thresholded here — the vertices
    // are the figure's own — so the rows the tool has to avoid are exactly the rows a judge
    // reported the feet welded in. 0.925-0.980 is rows 1110-1176 of a 1200 px capture, which is
    // the band that report was measured in.
    { name: 'foot', top: 0.925, bottom: 0.980 }
];

/**
 * The window a viewer is given. Fifteen seconds is the span the defect was reported over, and it is
 * long enough to contain four sway cycles at Quijoux's 0.33 Hz mode and one fidget at Duarte's
 * 1.2/min — so a band that is still under the floor here is under it for a reason other than the
 * observation window (§1.4).
 */
const GLANCE_WINDOW_SECONDS = 15;
const GLANCE_SECONDS = 420;

/**
 * 30 Hz, deliberately: it is the rate the judge's captures run at, and after the frame-rate fix it
 * is also the rate everything else in this file would produce. Sampling the prediction at the rate
 * the arbiter samples at removes one way for the two to disagree.
 */
const GLANCE_SAMPLE_RATE_HZ = 30;

/**
 * Every 11th vertex. The bands are thin horizontal slices, so this leaves 29-971 per band, measured
 * on `figure_g050.glb`: head 971, shoulder 106, hip 89, knee 31, ankle 29.
 *
 * ⚠️ The two lowest bands are THIN, and that is a property of the figure rather than of the stride:
 * the legs are narrow and the bands are 183 mm of a 1659 mm stature. Re-measured at stride 1 the
 * ankle band holds 313 vertices and its 15 s travel moves from 1.013 px to 1.165 px at seed 1 —
 * about a seventh — so the stride is not what decides any verdict here. GLANCE BAND POPULATION
 * gates the counts so that a later change to either the stride or the band bounds cannot silently
 * empty one.
 */
const GLANCE_VERTEX_STRIDE = 11;

/**
 * The smallest number of vertices a band may hold and still be a measurement. 25 sits just under
 * the measured worst (29, the ankle band) so the gate fires on a change that empties a band rather
 * than on the figure this file already runs against.
 */
const GLANCE_BAND_VERTEX_FLOOR = 25;

/**
 * The correlation the lower shank's screen position must keep with its own knee's, measured where
 * the pendulum runs alone. 0.5 is a long way below the measured 0.879-0.889 and a long way above
 * the -1.000 the spine-bend model scores; nothing in between is a body.
 */
const SHANK_TRACKS_KNEE_CORRELATION_FLOOR = 0.5;

/**
 * The floor under the shipped layer's ankle-band travel, in pixels. It is NOT the 1.6 px
 * indistinguishability floor — see the section header for why that band cannot reach it — it is the
 * separation from a lower body that is not moving at all. The spine-bend model scores exactly
 * 0.0000 px on all twelve seeds; the shipped layer's worst seed scores 0.292.
 */
const ANKLE_BAND_NOT_DEAD_PIXELS = 0.10;

/**
 * A ceiling as well as a floor, because over-animating an idle is as bad as having none and this
 * gate is the one place a "make the lower body move more" change would be measured. 40 px is a
 * band travelling 61 mm in fifteen seconds — five times Duarte's mean lateral weight shift, which
 * nothing in quiet standing reaches.
 */
const GLANCE_TRAVEL_CEILING_PIXELS = 40;

/**
 * The ceiling on head-band travel divided by hip-band travel, ON THE AXIAL READING OF BOTH BANDS.
 *
 * 🚩 IT USED TO BE 1.40 ON THE ARM-INCLUSIVE READING, AND THAT NUMBER WAS NEVER ABOUT THE PELVIS.
 * The hip band is the 793-976 mm rows; 56 of its 89 vertices are on the arm chain, both of
 * its silhouette edges are arm, and its silhouette centre correlates with an ARM-ONLY reading of the
 * same rows at r = 1.000. The arms hang from the thorax, so the denominator moved with the RIBCAGE.
 * A ceiling on that ratio therefore rejected trunk articulation as though it were a head that had
 * run away — which is exactly what happened: the round before this one measured the pure couple at
 * 2.5-3.5 against this ceiling, called it twenty red gates, and shipped an 80% partial instead. See
 * `isOnTheArmChain` and BAND PROVENANCE.
 *
 * 🚩 THIS IS ALSO NOT THE 1.00 THE BONE-MARKER GATE USES, and that difference is unchanged. On bone
 * markers HEAD PARKED measures head/pelvis peak-to-peak with half the range to spare; restated on
 * BANDS the same quantity is not the same quantity, because the hip band's centroid sits at 864 mm
 * and the head band's at 1506.
 *
 * What the band ratio can resolve is the MECHANISM BEING ABSENT ALTOGETHER. A body that does not
 * right its lumbar is a rigid lever about the ankles, which predicts (1506 - 67) / (864 - 67) =
 * 1.805 on the arm-inclusive reading and measures 1.697-1.905 there. On the axial reading the same
 * known-bad measures **1.47-1.54** and the shipped layer measures **0.67-0.80**, so 1.08 — the
 * geometric mean of 0.80 and 1.47 — admits the shipped layer by 1.35x and rejects an unrighted
 * lumbar by 1.36x.
 *
 * ⚠️ WHAT IT DOES NOT CATCH, SAID OUT LOUD. The tilt (0.97-1.11) and the top-joint give-back
 * (1.01-1.15) straddle it, so it catches some of their seeds and not others. Both are SHAPE defects
 * and the shoulder-line band in TRUNK ARTICULATION rejects them by 11x and by sign. A ratio of two
 * travels cannot see a shape; that is the whole reason that section exists.
 */
const HEAD_BAND_OVER_HIP_BAND_CEILING = 1.08;

/**
 * 🎯 AND THE FLOOR, WHICH WAS 0.50, THEN 0.80, AND IS NOW RE-DERIVED BECAUSE THE STATISTIC CHANGED.
 *
 * A ratio has two failure directions and this is the other one: "the pelvis leads" does not exclude
 * a head that has stopped moving, and a head bolted to the world is maximally "stabilised". The
 * known-bad is `lateralHeadPerCentreOfMass: 0.30` — the mannequin head an independent verifier once
 * built, which scored BETTER than the shipped layer on every one-sided ratio gate in HEAD PARKED.
 *
 * 🚩 AND IT IS BUILT ON THE SHIPPED COUPLE RATHER THAN ON THE TILT IT USED TO BE PAIRED WITH (§1.25n
 * — a rejection proof anchored on a configuration that has moved dies silently). With the shipped
 * spread the parked head measures **0.24-0.35** on the axial reading against the shipped layer's
 * **0.67-0.80**. 0.48 is the geometric mean of 0.35 and 0.67: it rejects the parked head by 1.37x
 * and admits the shipped layer by 1.40x.
 *
 * ⚠️ The floor is LOWER than it was, and that is the model changing rather than a tolerance being
 * relaxed. A hip strategy puts the pelvis over the loaded foot and parks the head over the base of
 * support, so the pelvis is SUPPOSED to out-travel the head; on the arm-inclusive reading it could
 * not, because the denominator was hanging off the thorax.
 */
const HEAD_BAND_OVER_HIP_BAND_FLOOR = 0.48;

/**
 * 🎯 THE FRACTION OF THE SHOULDER LINE THE POSE DRAWS THAT THE LAYER MUST STILL BE DELIVERING AT
 * UNIT BLEND — AND IT IS A BAND ROUND 1.000 NOW, NOT A FLOOR AT 0.25.
 *
 * ⚠️ THE PREVIOUS ROUND STATED THIS AS A FLOOR BECAUSE THE VALUE IT COULD REACH WAS 0.35. That is no
 * longer the constraint. `LATERAL_SHIFT_COUPLE` now sums to ZERO, and a spread summing to zero
 * rotates the shoulder girdle by zero at ANY righting angle — so the realised line is the authored
 * line as an identity of the mechanism rather than as a tuned outcome. Measured at unit blend:
 * **0.996442 / 0.995974**, the residue being that two finite rotations about the same axis at
 * different joints do not compose to exactly zero net rotation through the intervening bones.
 *
 * So the gate is an EQUALITY with 10% of room, and that is worth more than a floor: any future
 * spread whose shares sum to `s != 0` scales the artist's tilt by `1 - s x righting / authored`,
 * which is a number nobody chose. Measured, over the spreads this file builds:
 *
 *     [ 1,  0,  -1 ]   shipped, sum 0        0.996 / 0.996
 *     [ 0,  1, -0.8 ]  the 80% partial       0.350 / 0.324      rejected by 2.78x
 *     [ 0.5, 0.3, 0.2 ] the pure tilt        0.082 / 0.044      rejected by 11.0x
 *     [ 0,  0,   1 ]   all at the top joint -0.064 / -0.107     rejected by SIGN
 *
 * ⚠️ It does NOT reject an unrighted layer (1.000 by definition — it IS the pose) or a parked head
 * (0.994, because that defect is in the head target and not in the spread). Those are the head-over-
 * hip band gate's job, and each of the two gates is blind to the other's failure.
 */
const SHOULDER_LINE_REALISED_BAND = [ 0.90, 1.10 ];

/**
 * The floor under the shoulder-band-minus-hip-band differential, in pixels of 15 s median
 * peak-to-peak at the full-body framing, ON THE AXIAL READING OF BOTH BANDS.
 *
 * 🚩 IT WAS 1.5 PX ON THE ARM-INCLUSIVE READING, AND ON THAT READING IT SEPARATED THE SHIPPED LAYER
 * FROM ITS OWN KNOWN-BAD BY A FIFTH. The header that stood here said so and blamed the statistic:
 * "a band centroid averages a tilt away". That was half right. A band centroid does average a tilt
 * away — but the reason THIS pair barely moved is that both of its terms were riding the thorax:
 * 56 of the hip band's 89 vertices are arm. Restated on the axial vertices the same twelve seeds
 * separate the shipped layer from the tilt by **1.7x** rather than by a fifth, and the shipped layer
 * itself reads 5.39-6.70 px where the arm-inclusive form read 1.69-2.31.
 *
 * 3.6 is the geometric mean of the tilt's best (2.46) and the shipped layer's worst (5.39): it
 * rejects the tilt by 1.46x and the top-joint give-back by 1.48x, and admits the shipped layer by
 * 1.50x.
 *
 * ⚠️ AND IT STILL CANNOT SEE THE UNRIGHTED KNOWN-BAD, WHICH IS A PROPERTY OF THE STATISTIC AND IS
 * RECORDED RATHER THAN PAPERED OVER. A DIFFERENCE between two band positions is large when the trunk
 * articulates AND when the whole body swings as a rigid lever about a pivot far below both bands —
 * an unrighted layer measures 4.61-5.90 px here, overlapping the shipped layer's range. The
 * shoulder-line band above is what separates those two, and it is still the primary claim.
 */
const TRUNK_DIFFERENTIAL_FLOOR_PIXELS = 3.6;

/**
 * The smallest number of AXIAL vertices a band may hold and still support an axial statistic.
 *
 * Measured at stride 11: head 970 of 971, shoulder 67 of 106, hip 33 of 88, knee 31 of 31, ankle 29
 * of 29, foot 210 of 210. 20 sits under the measured worst so the gate fires on a change that
 * empties an axial band — a band bounds change, a stride change, or a rig whose arms hang
 * differently — rather than on the figure this file already runs against. Without it, an axial
 * reading over three vertices would silently become a very quiet, very green statistic.
 */
const AXIAL_BAND_VERTEX_FLOOR = 20;

/**
 * The arm from the shoulder joint out, in this rig's bone naming. See `isOnTheArmChain`, which is
 * where the defect this exists for is written up; it lives here because the whole module body runs
 * before `main()` and a `const` declared beside its own function is in the temporal dead zone.
 */
const ARM_CHAIN_BONE = /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;

/**
 * `Sway`'s own `spineShare` default, mirrored so THE OTHER WAY can put the pure tilt back. It is not
 * exported, and a copy that drifts would silently stop reproducing the defect — so the shoulder-line
 * numbers this reproduces are printed rather than asserted from a literal.
 */
const SPINE_SHARE_TILT = [ 0.5, 0.3, 0.2 ];

/**
 * The 80% give-back `Sway.js` shipped for one round, kept as a THIRD known-bad.
 *
 * It is here because it is the hardest of the three to see: it is not a mechanism error, it restores
 * a third of the authored shoulder line, and it passed every gate the round that shipped it had. The
 * defect is that its shares sum to 0.2, so the artist's tilt comes out multiplied by a number the
 * balance solve chose. §1.25a — the near-miss is what a successor will reach for.
 */
const PARTIAL_GIVE_BACK = [ 0.0, 1.0, -0.8 ];

/**
 * How closely the head band's vertex centroid and its silhouette centre must agree on a Sway-only
 * layer. See `measureBandStatisticDisagreement` for what moved it and what it still rejects.
 */
const HEAD_BAND_STATISTIC_AGREEMENT = [ 0.70, 1.20 ];

/**
 * How long the CLIP CONTENT section traces each seed. Long enough to reach the latest first
 * transfer in `capture.mjs`'s empty-seed table (968.6 s at seed 777) plus one hold, so that table's
 * numbers are re-measured rather than trusted.
 */
const CLIP_CONTENT_SECONDS = 1200;

/**
 * A first transfer must open early enough that the judge sees the TRANSITION and then has time to
 * read the held pose. 0.75 of the clip leaves 105 s after the onset — seven times the 15 s glance
 * window — and the latest nominated seed opens at 0.707 of the clip.
 */
const CLIP_CONTENT_ONSET_FRACTION = 0.75;

/** The nomination is a set, not a seed: one draw is what produced this defect in the first place. */
const CLIP_CONTENT_MINIMUM_SEEDS = 3;

/** The declared table is deterministic, so it is checked for agreement rather than for closeness. */
const CLIP_CONTENT_ONSET_TOLERANCE_SECONDS = 0.1;
const CLIP_CONTENT_PEAK_TOLERANCE_PIXELS = 0.1;

/**
 * The frame-rate invariance matrix. 900 s because the defect it catches was reported at 900 s and
 * because a full weight transfer onto one leg needs that long to be reliable; seed 1 because that
 * is the seed the re-verifier's measurement was taken at, so the numbers printed here can be read
 * straight against its report.
 */
const INVARIANCE_RATES = [ 30, 60, 120 ];
const INVARIANCE_SECONDS = 900;
const INVARIANCE_SEED = 1;

/** The markers compared. The whole driven chain, top to bottom, plus both feet. */
const INVARIANCE_MARKERS = [ 'head', 'pelvis', 'kneeLeft', 'kneeRight', 'ankleLeft', 'ankleRight', 'toeLeft', 'toeRight' ];

/**
 * 🎯 How far two frame rates may disagree, in millimetres.
 *
 * ⚠️ THIS USED TO SAY "stated against the project's own indistinguishability floor", meaning 1.6 px.
 * There is no such floor — see JUDGE_REPORTED_INVISIBLE_PIXELS. Re-anchored on the one end of the
 * owned bracket that bounds this claim in the right direction: 0.48 px, the fingertip travel a blind
 * judge reported as *"the hands never move"*, is 0.73 mm at the framing `alive.js?frame=body` uses,
 * and this tolerance is a THIRTIETH of it. Measured residue on the shipped layer is 0.0008 mm — nine
 * hundred times inside it — so the tolerance is not what is deciding the result either way. The
 * pre-fix layer scores tens of millimetres.
 */
const INVARIANCE_TOLERANCE_MM = 0.025;

/**
 * The stance blend at which the body has transferred essentially all its weight onto one leg —
 * the state the FREE FOOT section needs in order to mean anything, and the one the pre-fix layer
 * reached at 60 Hz and never reached at 30 Hz.
 */
const FULL_TRANSFER_BLEND = -0.95;

/** Bates' protocol length, and the window the composite is gated at. */
const UNCONSTRAINED_WINDOW_SECONDS = 900;

const SPECTRUM_DURATION_SECONDS = 300;

/**
 * Event rates are Poisson, so the gate band below is derived from the expected count rather than
 * hand-set — which means the window length has to be stated once and used everywhere. Three seeds
 * of two hours puts ~540 lateral relays on the counter, enough that a 3-sigma band is ±13%.
 */
const EVENT_DURATION_SECONDS = 7200;
const EVENT_SEEDS = [ 1, 42, 20260807 ];

/** How many amplitudes the distribution oracle draws. Sets the precision of its own gates. */
const AMPLITUDE_DRAWS = 200000;

// --- the literature, verbatim -------------------------------------------------------------------

/**
 * Quijoux et al. 2021, force-plate column. Centre-of-pressure RMS in millimetres, and the spectral
 * mode of each axis — the mode is here as well as in the spectrum section because it is what sets
 * how many independent cycles a window of a given length contains, which is what the gate bands
 * below are derived from.
 */
const QUIJOUX_RMS_MEDIO_LATERAL_MM = 3.0;
const QUIJOUX_RMS_ANTERO_POSTERIOR_MM = 4.9;
const QUIJOUX_MODE_MEDIO_LATERAL_HZ = 0.33;
const QUIJOUX_MODE_ANTERO_POSTERIOR_HZ = 0.27;

/**
 * The same column's f95 — the frequency below which 95% of centre-of-pressure power sits. Declared
 * here rather than typed into the two gates that used to carry it inline, because the peak-velocity
 * ceiling is now derived from it and a number used in three places must have one home.
 */
const QUIJOUX_F95_MEDIO_LATERAL_HZ = 1.09;
const QUIJOUX_F95_ANTERO_POSTERIOR_HZ = 1.23;

/** Quijoux's measured anisotropy: AP is 1.5–2x ML, always. The design ratio is 4.9/3.0 = 1.633. */
const QUIJOUX_ANISOTROPY_LOW = 1.5;
const QUIJOUX_ANISOTROPY_HIGH = 2.0;
const DESIGN_ANISOTROPY = QUIJOUX_RMS_ANTERO_POSTERIOR_MM / QUIJOUX_RMS_MEDIO_LATERAL_MM;

/**
 * Bates et al. 2021, 15 minutes unconstrained, 22 normal-flexibility controls. Centre-of-pressure
 * SD in millimetres, median and interquartile range.
 *
 * 🎯 The IQR is what the composite is gated against, not the median. Twenty-two people standing
 * unconstrained for a quarter of an hour produce an enormous spread — his lateral upper quartile is
 * four times his median — because whether a given subject happened to make two large weight shifts
 * or none dominates the statistic. A gate on the median would be gating our seed draw against his
 * subject draw.
 */
const BATES_SD_MEDIO_LATERAL_MM = 16.87;
const BATES_IQR_MEDIO_LATERAL_MM = [ 9.58, 66.5 ];
const BATES_SD_ANTERO_POSTERIOR_MM = 16.32;
const BATES_IQR_ANTERO_POSTERIOR_MM = [ 10.34, 28.75 ];

/** Duarte & Zatsiorsky 1999, shift amplitudes. Mean and SD, millimetres, as reported. */
const DUARTE_SHIFT_MEDIO_LATERAL_MM = 22;
const DUARTE_SHIFT_MEDIO_LATERAL_SD_MM = 38;
const DUARTE_SHIFT_ANTERO_POSTERIOR_MM = 17;
const DUARTE_SHIFT_ANTERO_POSTERIOR_SD_MM = 15;

/** Duarte & Zatsiorsky 1999, derived rates, events per minute. */
const DUARTE_FIDGET_RATE_MEDIO_LATERAL = 1.2;
const DUARTE_FIDGET_RATE_ANTERO_POSTERIOR = 1.0;
const DUARTE_SHIFT_RATE_MEDIO_LATERAL = 0.30;
const DUARTE_SHIFT_RATE_ANTERO_POSTERIOR = 0.19;

/** Cassell et al. 2001's independently measured conversational rate, and punch-list item 2.9. */
const CASSELL_SHIFT_RATE_PER_MINUTE = [ 1.4, 1.6 ];
const PUNCH_LIST_RELAY_RATE_PER_MINUTE = [ 1.0, 1.5 ];

// --- gate tolerances, and where each comes from --------------------------------------------------

/**
 * Everything below 0.15 Hz is excluded from the spectral statistics. That is not a convenience: the
 * literature figures come from 25–60 s quiet-standing recordings, which cannot resolve a
 * weight-shift process whose intervals are 200–500 s, so the postural band the papers describe
 * excludes it by construction. Duarte measures that process separately, and so does this file.
 */
const POSTURAL_BAND_FLOOR_HZ = 0.15;

/**
 * How far a measured segment ratio may sit from the pendulum's geometric prediction, on the
 * pendulum-only layer.
 *
 * The prediction is first-order and ignores the spine's 15% share and the neck's give-back, which
 * move the true ratio by a few percent at the top of the chain and by nothing at the bottom. Four
 * percent absorbs that; a segment driven by the wrong pivot is out by tens of percent, and one not
 * driven at all is out by everything.
 */
const PENDULUM_RATIO_TOLERANCE = 0.04;

/** The pendulum-geometry run. Ratios converge far faster than amplitudes, so this is short. */
const PENDULUM_SEEDS = [ 1, 42, 777, 20260807 ];
const PENDULUM_SECONDS = 300;

/** Planted means planted. Millimetres of travel at the ankle and toe, and degrees of sole tilt. */
const PLANTED_HORIZONTAL_LIMIT_MM = 1.5;
const PLANTED_VERTICAL_LIMIT_MM = 0.05;
const SOLE_TILT_LIMIT_DEGREES = 0.02;

/**
 * How far the toe joint may sit from where the released turn-out says it should, in millimetres.
 *
 * This is a closure residual on exact arithmetic — the layer rotates the foot rigidly about the
 * vertical and reports the angle, so the prediction and the rig are computing the same thing twice.
 * A twentieth of a millimetre is the same allowance the vertical planting limit uses and three
 * orders of magnitude below the 6.0 mm arc the free foot actually travels, so a foot that slid
 * instead of pivoting cannot fit inside it.
 */
const PLANTED_YAW_RESIDUAL_LIMIT_MM = 0.05;

/**
 * Rig up, for reconstructing the foot's turn-out and for stating what "flat on the floor" means.
 * `Sway.js` states the same axis convention. Two names for one vector because they are two claims:
 * the axis the free foot is allowed to turn about, and the direction a planted sole must face.
 */
const RIG_UP_AXIS = new Vector3( 0, 1, 0 );
const WORLD_UP = new Vector3( 0, 1, 0 );

/**
 * How far the head-per-centre-of-mass ratio the layer MEASURES may sit from the rig's own raw
 * geometry ratio — head height above the pivot, over centre-of-mass height above the pivot.
 *
 * They are not identical and should not be: the raw ratio is what a perfectly rigid plank would
 * give, and the layer's chain is not a plank — 15% of the lean is shared down the spine, which
 * lifts the head's share, and the neck gives 30% of it back, which lowers it. On figure_g050 the
 * two land 1.5% apart. Six percent is enough room for that and for a differently-proportioned
 * figure, and far too little room for a lever measured against the wrong bone: substituting the
 * centre of mass for the head, or vice versa, moves this by 65%.
 */
const HEAD_PER_CENTRE_OF_MASS_TOLERANCE = 0.06;

/**
 * How far the SOLVED lateral head-over-centre-of-mass ratio may sit from its target of 1.0.
 *
 * This is a solve residual, not a modelling allowance: the secant lands on the target in one step
 * because the relation is linear, so the only thing left is the linearisation of a rotation over the
 * probe angle. Measured, it is under a part in a thousand. One per cent is three orders of magnitude
 * larger than that and thirty times smaller than the 1.674 a rigid rotation would give, so a
 * righting that silently stopped being applied cannot hide inside it.
 */
const LATERAL_RIGHTING_TOLERANCE = 0.01;

/**
 * 🎯 How far the head's REALISED lateral travel may sit from the centre of mass's, measured on the
 * trace rather than read off the layer.
 *
 * `LATERAL_RIGHTING_TOLERANCE` above gates the same ratio at 1%, and it is not a substitute for this
 * one: it reads `layer.headPerCentreOfMassLateral`, a bind-time probe of a single lean, so it can
 * only ever catch a defect that originates in the solve. This is the same claim asked of the frame
 * loop's own output — head displacement against the figure's own realised centre of mass, over
 * twelve seeds of 900 s — so it also catches head travel lost to a neck-righting change, to another
 * mechanism, or to a refactor that never touched the solve.
 *
 * Five per cent is derived, not chosen. The two mechanisms are solved to 1% each and mixing them
 * across the posture clamp costs a little more: measured over the seed matrix the realised ratio
 * spans 0.9904 to 1.0115, so 1.15% is the whole observed excursion and this leaves four times that
 * as headroom for a differently-proportioned figure. It is still 16x tighter than the 0.182 a head
 * with twice the righting scores, and 5x tighter than the 0.25 the reproduced constant defect
 * scored, so nothing that parks the head fits inside it.
 */
const HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE = 0.05;

/**
 * 🚩 The band the head-over-pelvis ratio must land inside, and the reason it is a BAND.
 *
 * The ceiling is the pelvis-leads claim of §1.7d — medio-laterally the body loads a hip, so the
 * pelvis travels furthest and the head must not out-travel it. That half was gated first and gated
 * alone, and gating it alone was a §1.3 failure with a name attached: an independent verifier set
 * `LATERAL_HEAD_PER_CENTRE_OF_MASS` to 0.30, producing a head moving 20.6% of the pelvis — a
 * mannequin head nailed in space over a swaying body, the exact mirror of the defect the judge
 * reported — and every one of these ratio gates scored it BETTER than the shipped model. A one-sided
 * band on a ratio silently declares one direction to be free improvement.
 *
 * The floor is coarse ON PURPOSE and is not where the tight claim lives. The tight claim is
 * `HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE`: the head goes where the centre of mass goes, to 5%. This
 * floor exists so that nobody reading the band can conclude that smaller is better, and so that a
 * parked head fails on the pelvis relationship as well as on the centre-of-mass one. Its value
 * follows from the rig: the realised centre of mass travels 0.814-0.834 of the pelvis medio-
 * laterally (RMS) and 0.825-0.832 (peak-to-peak), and the model parks the head ON the centre of
 * mass, so the true ratio sits near 0.83. Half of that rejects the 0.206 the reproduced defect
 * scored by 2.4x and the 0.116 an over-righted layer scores by 4.3x, without pretending to a
 * precision this quantity does not have.
 */
const PELVIS_LEADS_FLOOR = 0.50;
const PELVIS_LEADS_CEILING = 1.0;

/**
 * 🎯 The band the head-on-neck GAIN must land inside — the slope, which is what the correlation
 * could not see.
 *
 * `pearson` answers "does the head-on-neck rotation oppose the trunk," and that sign was the judge's
 * finding, so gating the sign was right. It is also scale-free, and that is the hole: a head nailed
 * rigidly in space scores r = -1.000, the best mark the gate can award. The degenerate input got the
 * top score on the gate written to catch its mirror image.
 *
 * The slope of the head's position-relative-to-the-neck on the neck's own displacement carries the
 * magnitude the correlation throws away, and both of its bounds are structural rather than tuned.
 * Head displacement is neck displacement plus head-on-neck displacement, so a slope of s gives a
 * head that travels (1 + s) of the neck: s = 0 is no righting at all, the state the judge measured,
 * and s = -1 is a head held perfectly still in space while the trunk moves under it. The honest band
 * is therefore the interior of (-1, 0), and this takes the lower half of it — the neck may take back
 * up to half of the trunk's lateral displacement, and must take back a measurable part of it.
 *
 * Measured on the shipped layer over twelve seeds of 900 s: -0.1165 to -0.0947, comfortably inside.
 * An over-righted layer scores -0.654 and is rejected.
 *
 * ⚠️ AND THE MARGIN, STATED BECAUSE IT IS THIN. Against the reproduced constant defect this gate
 * reads -0.507 to -0.531 — it catches it, but by 1.4% on the worst seed, and a differently-
 * proportioned figure could plausibly move it across. This is NOT the gate that carries the claim;
 * `HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE` rejects the same defect by 13x its tolerance. What this one
 * adds is a different KIND of assertion — the neck's own gain, independent of where the centre of
 * mass went — and it should be read as corroboration rather than as cover.
 */
const HEAD_ON_NECK_GAIN_BAND = [ -0.50, -0.01 ];

/**
 * The trace length the head-on-neck claim is measured over, in the PENDULUM regime.
 *
 * Shorter than the 900 s every amplitude gate uses, and that is affordable here for a reason rather
 * than for convenience: this is a CORRELATION and a SLOPE between two signals that share one
 * mechanism, and it lands at -1.0000 and -0.0975 to -0.0979 — there is no sampling error to average
 * away. 300 s at 60 Hz is 18,000 samples. Twelve extra 900 s traces would have added about a fifth
 * to this file's wall clock for no change in the third decimal.
 */
const HEAD_ON_NECK_REGIME_SECONDS = 300;

/**
 * How far the known-bad "parked head" layer over-drives the solved righting, in `measureTheOtherWay`.
 *
 * Measured across factors of 2, 4, 6 and 8: at 2 the head lands at 0.182 of the centre of mass and
 * 0.116 of the pelvis, which is the defect — a head nailed in space over a body swaying under it,
 * and a slightly harsher version of the 0.206 the reproduced constant defect produced. Past 4 the
 * head crosses over and leans the OTHER way (head/COM 4.64 at x4, 31.5 at x6), which is a different
 * defect and would prove the gates against the wrong thing.
 */
const PARKED_HEAD_RIGHTING_FACTOR = 2;

/**
 * The legibility run, and the three thresholds it is stated against.
 *
 * `JUDGE_DETECTION_MULTIPLE` is CALIBRATED, not chosen: measured over 90 minutes at the constants
 * the judge watched, the rate of events whose peak pelvis excursion exceeds 5.5x the balance band's
 * own pelvis RMS is 0.51/min, and the judge read 3 events in 7 minutes, 0.43/min. It is reported
 * rather than gated, because it is one observation by one judge on one clip and it should not be
 * loadbearing — but it is the only empirical anchor that exists for "a viewer noticed", and an
 * anchor with a provenance beats a threshold with none.
 *
 * `LEGIBLE_EVENT_MULTIPLE` is the gate, at 3x, and it is deliberately BELOW the judge's threshold:
 * asserting the calibrated number would be fitting a gate to a single observation. Three standard
 * deviations of the background is the standard statement of "distinguishable from the background",
 * and it is far above the 1x the median event used to sit at.
 *
 * `LEGIBLE_EVENT_RATE_PER_MINUTE` is 0.75, which is half of punch-list 2.9's 1.5 — the half that
 * does not need a conversation. See the section header for why the other half requires
 * `markDiscourseBoundary()` and cannot be reached from Duarte's own intervals.
 *
 * `FIDGET_DUTY_CYCLE_PERCENT` is 3%, against the 2.47% the symmetric 1.4 s fidget produced and the
 * 3.20% the asymmetric 1.8 s one does. It is the gate that catches an amplitude-only fix, and its
 * ceiling is not a preference: see FIDGET_DURATION_SECONDS for the measured spectral constraint that
 * decides how long a fidget may be.
 */
const LEGIBILITY_SEEDS = [ 1, 42, 20260807 ];
const LEGIBILITY_SECONDS = 1800;
const LEGIBILITY_WINDOW_SECONDS = 4.0;
const JUDGE_DETECTION_MULTIPLE = 5.5;
const LEGIBLE_EVENT_MULTIPLE = 3.0;
const LEGIBLE_EVENT_RATE_PER_MINUTE = 0.75;
const FIDGET_DUTY_CYCLE_PERCENT = 3.0;

/**
 * The toe run. `TOE_LIFT_FLOOR_MM` is the least the free foot's toes must come off the floor at a
 * full weight transfer for the foot to stop reading as welded: one millimetre, which at the framing
 * the judge used is under a pixel on its own but is what turns a rigid silhouette into a deforming
 * one. The realised figure is 1.5 mm and it is printed, not assumed. `TOE_BAND_HEIGHT_METRES` is how
 * far above the metatarsal head a vertex may sit and still be counted as toe rather than instep.
 */
const TOE_TRACE_SECONDS = 900;
const TOE_LIFT_FLOOR_MM = 1.0;
const TOE_BAND_HEIGHT_METRES = 0.03;

/**
 * 🎯 THE FREE-FOOT ARTICULATION FLOOR, in pixels of silhouette travel at full-body framing, and the
 * gate this whole round exists because nobody had written.
 *
 * The section above it is the record of how a gate can be honest, precise, green, and still measure
 * something no viewer can see. `TOE_LIFT_FLOOR_MM = 1.0` is a millimetre — **0.66 px** at the
 * framing every capture in this project is taken at — asserted on the rise of the single LOWEST
 * skinned vertex forward of one metatarsal head. The layer cleared it at 1.484 mm and the gate went
 * green for a round, while an independent verifier measuring the same feet on 4200 rendered frames
 * found the foot band's outer-to-outer silhouette extent had a standard deviation of **0.00 px** and
 * called the feet welded. Both measurements are correct. Only one of them is about the defect.
 *
 * LEARNINGS §1.10b named this failure mode already, on the finger idle, in the same words: an
 * amplitude stated in a unit nobody can picture will pass every review it is given. It named it and
 * the toe constant was authored in degrees anyway, three weeks of project time later, on the same
 * body. So this gate is stated in the unit the defect will be judged in, at a named framing, with
 * the conversion printed beside the result.
 *
 * ⚠️ 3.0 px WAS justified as "a little under twice" a 1.6 px indistinguishability figure, and that
 * figure was never measured — see JUDGE_REPORTED_INVISIBLE_PIXELS. Re-anchored, without changing the
 * number: 3.0 px is 6.3x the 0.48 px a judge reported as *"the hands never move"* and 0.28x the
 * 10.6 px a judge reported as a counted event, so it sits inside the owned bracket nearer the
 * invisible end. It is a judgement about a rendered avatar and nothing more; there is no published
 * free-foot excursion in docs/research/ and none is invented here.
 *
 * ⚠️ Asserted on BOTH feet, which is the other half of the finding. The toe lift was real and it
 * only ever fired on the character's right foot within the 420 s the judge watched: measured over
 * five seeds, the first full transfer onto the RIGHT leg arrives at 40-592 s and on seed 1 — the
 * capture's own seed — not until 434 s, fourteen seconds after the clip ends. A gate that reads one
 * foot cannot see that.
 */
const FREE_FOOT_TRAVEL_FLOOR_PIXELS = 3.0;

/**
 * 🚩 The same claim on the statistic the verifier actually reported, at a DELIBERATELY WEAKER floor.
 *
 * Outer-to-outer extent is the headline number in the defect report — sd 0.00 px over 4200 frames —
 * so it is gated here rather than only quoted, because a number that appears in a finding and not in
 * a gate is a number nobody will check again. It is a weaker statistic than the toe region and the
 * floor says so: a foot pivoting about its own ankle swings its toe furthest and its extreme
 * silhouette edge least, and the shipped fix measures 4.6-5.5 px at the toe against 2.7 px of extent.
 * Setting this at 3.0 as well would be asserting the same sensitivity from two statistics that do not
 * have it.
 *
 * ⚠️ THE 1.6 px THIS USED TO CITE IS NOT DATA AND THE SENTENCE HAS BEEN REMOVED. It said "1.6 px is
 * not a judgement, it is the one empirical datum this project owns" and cited docs/PROGRESS.md:550.
 * Those lines sit five lines below PROGRESS's own `superseded` marker; their two halves disagree by
 * 1.85x (4.5 mm at this file's own 0.6574 px/mm is 2.958 px); and "indistinguishable" is one agent
 * looking at two stills it did not keep. See LEARNINGS §1.14a and the standing constraint in
 * PUNCHLIST. Every floor in this file that used to lean on it now leans on the BRACKET below.
 *
 * 1.6 px is kept as the NUMBER here only because the measurement that justifies it is a separation
 * between two states, not a citation: the shipped fix measures 2.7 px of extent against a welded
 * foot's 0.02 px sd, and 1.6 sits between them. It is a judgement and it now says so.
 */
const SILHOUETTE_WIDTH_FLOOR_PIXELS = 1.6;

/**
 * 🎯 THE ONLY VISIBILITY EVIDENCE THIS PROJECT OWNS, AND IT IS A BRACKET RATHER THAN A THRESHOLD.
 *
 * Two blind visual judges, both with provenance, in the same statistic every gate in this file is
 * stated in — peak-to-peak pixels at the full-body capture framing:
 *
 *   0.48 px  fingertip travel over 7 minutes, reported as *"the hands never move"*.  BELOW threshold.
 *   10.6 px  pelvis excursion of the median legible postural event, which a judge COUNTED.  ABOVE it.
 *
 * A factor of twenty-two, with the threshold somewhere inside and nothing locating it. So a floor in
 * this file may say "above the figure a judge reported as invisible" (0.48) or "short of the figure a
 * judge reported as legible" (10.6), and may NOT say "above the measured visibility floor", because
 * there is no such number. LEARNINGS §1.14a §"What would actually measure it" designs the staircase.
 */
const JUDGE_REPORTED_INVISIBLE_PIXELS = 0.48;
const JUDGE_REPORTED_LEGIBLE_PIXELS = 10.6;

/**
 * The framing every full-body capture in this project is taken at, and the camera it is taken from.
 *
 * 1200 px is the capture command in docs/LEARNINGS.md Part 3 (`--width 700 --height 1200`); the 1.10
 * margin and the 12 degrees of azimuth are `BODY_FRAME_MARGIN` and `CAMERA_AZIMUTH_DEGREES` in
 * `packages/testbed/src/alive.js`. Stature is measured off this GLB rather than assumed, because the
 * five bakes differ by centimetres. Identical to `idle-motion.selftest.mjs`'s framing block, which
 * is the file that first had to state one.
 *
 * The azimuth is here because feet are the one place it changes the answer. A hand's idle is
 * lateral, so the projection costs it nothing; a foot's turn-out swings the toe both sideways and
 * fore-and-aft, and the fore-and-aft half is nearly pure depth to a camera 12 degrees off the axis.
 * Projecting properly rather than taking the world-space resultant costs this gate about a third of
 * its own measurement, and reporting the larger number would be reporting travel the camera cannot
 * see.
 */
const FULL_BODY_CAPTURE_PIXELS = 1200;
const BODY_FRAME_MARGIN = 1.10;
const CAMERA_AZIMUTH_DEGREES = 12;

/**
 * The seeds FULL STACK runs, and they are not a choice: they are the two `capture.mjs` handed the
 * judge whose measurement this section exists to reproduce (`captures/r8-judge-body/seed-4242` and
 * `seed-42`). Two rather than twelve because each one is ten layers over 12,600 frames and this file
 * is already the slowest in the repo.
 */
const FULL_STACK_SEEDS = [ 4242, 42 ];

/** The seed and window the free-foot gate runs at. Every seed tried reaches both transfers by 900 s. */
const FREE_FOOT_SEED = 1;
const FREE_FOOT_SECONDS = 900;

/** The other-way run only has to reach one full weight transfer, so it is short. */
const TOE_OTHER_WAY_SECONDS = 900;

/**
 * 🎯 THE DIRECTION THE FREE KNEE TURNS, GATED — because for a whole round it was asserted backwards
 * in prose while every number in this file stayed green.
 *
 * The pose files author the swivel as a rotation about the free limb's own hip-to-ankle axis that
 * *"moves the knee 14.3 mm toward the midline"* (`weight-right.json`, `leftUpperLeg`). Medially.
 * Measured on the mesh at seed 1, the free patella's bearing swings 12.04 degrees medially on the
 * left and 10.55 on the right, against a loaded knee that stays inside 1.4.
 *
 * The floor is what makes this a gate rather than a report: it is signed, so a sign flip anywhere
 * in the swivel — in the pose files, in the blend, or in a future refactor of either — lands at
 * about −11 and fails by a mile rather than by a tolerance. The ceiling is the pose files' own
 * 16 degrees of swivel plus room for the shank's counter-rotation, so a swivel that grew would be
 * caught too.
 */
const FREE_KNEE_MEDIAL_SWIVEL_FLOOR_DEGREES = 5;
const FREE_KNEE_MEDIAL_SWIVEL_CEILING_DEGREES = 20;

/**
 * The patella patch: half-height of the knee band it is cut from, and the frontmost fraction of
 * that band kept. 30 mm either side of the knee joint holds the kneecap and nothing above or below
 * it; the frontmost quarter is the anterior face. Both are stated here rather than inline because
 * changing either changes what "the patella" means and the next reader should see that at once.
 */
const PATELLA_BAND_HALF_HEIGHT_METRES = 0.030;
const PATELLA_PATCH_FRACTION = 0.25;

/**
 * 🎯 THE FOOT BAND'S FLOORS. TWO OF THEM, AND THE SECOND ONE IS THE ONE THE ARBITER MEASURES.
 *
 * ⚠️ THE PREVIOUS VERSION OF THIS BLOCK GATED THE RESULTANT AND *RECORDED* THE HORIZONTAL, AND THAT
 * IS BACKWARDS. `tools/critic/travel.mjs` — the tool a judge scores this defect with, and the only
 * instrument that has ever looked at a rendered foot — reports the HORIZONTAL centroid of a
 * silhouette band. It has no vertical channel at all. So the resultant, which adds the toe lift's
 * vertical, was the statistic nothing outside this file could see, and the horizontal, which is the
 * statistic the verdict is taken in, was the one carried as a footnote. Both are gated now, with the
 * horizontal stated first.
 *
 * NEITHER FLOOR IS THIS PROJECT'S "INDISTINGUISHABILITY FIGURE", BECAUSE THERE ISN'T ONE. See
 * JUDGE_REPORTED_INVISIBLE_PIXELS: what is owned is a 0.48-10.6 px bracket from two blind judges, and
 * both of these floors sit inside it near the invisible end. They are separations between measured
 * states, which is what a gate floor is for, and they say so.
 *
 * Measured at seed 1 over 420 s at 30 Hz, per vertex, worst-moving vertex per 15 s window, median
 * over windows — with the free-foot release fix and with each mechanism removed in turn:
 *
 *     configuration                       horizontal   resultant
 *     as shipped                               1.013       1.326
 *     proportional release (last round)        0.272       0.903
 *     no toe articulation at all               1.012       1.012
 *     welded — no yaw release either           0.272       0.374
 *
 * Read the first column: the ONLY mechanism that moves a foot horizontally is the yaw release, and
 * the whole of this round's gain is the breakaway fix in `Sway.js` (0.272 -> 1.013, **3.7x**). The
 * toe mechanisms contribute 0.001 px horizontally, which is why the second column exists and why the
 * old attribution gate — stated on the resultant — was measuring a channel the judge cannot see.
 *
 * 0.75 px horizontal sits between the proportional release (0.272) and the fix (1.013), rejecting
 * the old state by 2.8x and admitting the new one by 1.4x. 1.20 px resultant does the same job for
 * the second column against the 0.903 the old release scored.
 */
const FOOT_BAND_HORIZONTAL_FLOOR_PIXELS = 0.75;
const FOOT_BAND_MEDIAN_FLOOR_PIXELS = 1.20;

/**
 * The attribution the release toggle has to show, on the horizontal channel. Measured 3.72x
 * (1.013 against 0.272); 2.5 leaves room for seed drift while still failing if the breakaway stops
 * carrying the change.
 *
 * ⚠️ The fore-and-aft toe coupling's own attribution is NOT here any more and the reason is worth a
 * sentence. It was 1.91x on the resultant, and on the horizontal it is 1.001x — the toes move
 * vertically, by construction, so the coupling cannot appear in the statistic the verdict is taken
 * in. It is still gated, on the resultant, where it is real.
 */
const FOOT_BAND_RELEASE_ATTRIBUTION_FLOOR = 2.5;
const FOOT_BAND_COP_ATTRIBUTION_FLOOR = 1.15;

/**
 * The floor under the foot band's VERTICAL travel, in pixels of 15 s median per-vertex peak-to-peak.
 *
 * Derived between two measured populations on this rig, over the same 420 s clip as every other
 * number in that section: the shipped layer scores 0.876 px and a foot with no toe articulation at
 * all scores 0.375. 0.57 is their geometric mean — it rejects the known-bad by 1.52x and admits the
 * shipped layer by 1.54x.
 *
 * ⚠️ AND WHAT THE VERTICAL CHANNEL CANNOT SEE, per §1.25d. A welded foot scores the SAME 0.375 as
 * one with no toes: the yaw release is a rotation about the rig's vertical and cannot move a vertex
 * up or down, so this channel is blind to it by construction. The horizontal floor is what rejects a
 * welded foot, at 0.314 against 0.75. Two channels, two failure modes, and neither covers the other.
 */
const FOOT_BAND_VERTICAL_FLOOR_PIXELS = 0.57;

/** The window the foot band is traced over. The judge's clip length. */
const FOOT_BAND_SECONDS = 420;

/**
 * The postural-velocity trace. 420 s is the judge's clip length, and it is long enough to contain
 * several fidgets on both axes at Duarte's 1.0-1.2/min — which is what a PEAK statistic needs, as
 * distinct from a mean, which only needs the trace to be stationary.
 */
const VELOCITY_SECONDS = 420;

/**
 * The window the peak speed is measured over. Half a second is the interval the defect was reported
 * in — "32.5 px in 0.5 s" — and it is short enough to resolve a 0.45 s fidget rise while being long
 * enough not to differentiate the balance band's own noise.
 */
const VELOCITY_PEAK_WINDOW_SECONDS = 0.5;

/**
 * Quijoux's eyes-open resultant mean velocity, 11-20 mm/s (research/body-motion-numbers.md), and
 * this layer's own recorded position inside it. The reference is quoted from docs/PROGRESS.md
 * rather than re-derived so that a drift shows up as a failing gate instead of as a new number.
 */
const MEAN_COP_SPEED_RANGE_MM_PER_SECOND = { low: 11, high: 20 };

/**
 * 🎯 THE PEAK CEILING, RE-DERIVED FROM THE LITERATURE — because the one it replaces WAS THE LAYER'S
 * OWN PREDICTED MAXIMUM AND THEREFORE COULD NOT FAIL.
 *
 * 🚩 Read the mechanism of the old defect before the new derivation, because it is subtle and it is
 * a shape this repository will meet again. The old ceiling was computed live, inside the section,
 * from `shape.fidget.durationSeconds`, `shape.fidget.riseFraction` and `shape.medioLateral
 * .settings.shiftAmplitude` — the very constants that decide how fast the layer moves. Halve the
 * fidget duration and the layer moves twice as fast AND THE CEILING DOUBLES WITH IT, so the gate
 * stays green through the exact change it exists to catch. It was not a weak ceiling; it was a
 * mirror. Everything it ever proved is that the layer agrees with itself.
 *
 * THE REPLACEMENT IS A CONSTANT AND IT READS NOTHING FROM `Sway.js`. Two published numbers:
 *
 *   THE BANDWIDTH is Quijoux's f95 — 95% of centre-of-pressure power below **1.09 Hz** laterally and
 *   **1.23 Hz** fore-and-aft on the force plate. A displacement whose whole spectral content lies
 *   inside that band cannot rise faster than one half-cycle of a sinusoid at its edge.
 *
 *   THE AMPLITUDE is Duarte's mean weight-shift excursion, **22 mm ML / 17 mm AP**.
 *
 * A half-cosine rise to A at frequency f peaks at pi*f*A, so the fastest event the published
 * spectrum admits at the published amplitude is **75.3 mm/s** laterally and **65.7 mm/s** fore-and-
 * aft, or **99.9 mm/s** with both axes at their steepest instant at once. The last is a worst case,
 * not a prediction: the two axes are independent processes here and never peak together.
 *
 * ⚠️ TWO REGIMES, AND THIS DOES NOT CONFLATE THEM — §1.7b is the standing warning and it is why the
 * split is stated. Quijoux's trial is 60 s of "stand as still as possible", so Duarte's 199 s shift
 * process is absent from it BY CONSTRUCTION and Quijoux's AMPLITUDES may not be used for a shift.
 * What is taken from Quijoux here is a BANDWIDTH, and a bandwidth is the one property of that
 * spectrum a weight shift cannot exceed without putting power where the paper measures none — which
 * this file already checks independently on the composite trace, in `POSTURAL SPECTRUM`'s
 * "power > 2 Hz, worst" gate. The amplitude comes from the paper that measured shifts.
 *
 * ⚠️ AND THE HONEST NOTE ABOUT WHAT THE NEW NUMBER PROVES. 99.9 mm/s lands within 3% of the 97.1 the
 * old mirror produced, so the verdict on TODAY's layer does not change: the worst of twelve seeds is
 * 91.263 mm/s and passes either way. That agreement is worth recording — the layer's event shapes
 * sit right at the edge of what the published spectrum admits, with 9% to spare — but it must not be
 * read as one number validating the other. What changes is that the ceiling no longer moves, which
 * is proved below by halving the fidget duration: the old ceiling followed it and stayed green.
 */
const PEAK_SPEED_CEILING_MM_PER_SECOND = Math.hypot(
    Math.PI * QUIJOUX_F95_MEDIO_LATERAL_HZ * DUARTE_SHIFT_MEDIO_LATERAL_MM,
    Math.PI * QUIJOUX_F95_ANTERO_POSTERIOR_HZ * DUARTE_SHIFT_ANTERO_POSTERIOR_MM );

/**
 * How far the shipped layer must out-travel a fully welded foot in this band. Measured 2.41x
 * (0.903 against 0.374); 2.0 leaves seed room while still failing if the articulation stops
 * carrying the difference. It is NOT larger because it cannot be — see the note beside it: a
 * welded foot still rides the lean, so the band's own floor is 0.374 px rather than zero.
 */
const FOOT_BAND_WELDED_SEPARATION = 2.0;

/**
 * How far the figure's REALISED centre of mass may sit from the displacement the layer commanded,
 * as a fraction, and in millimetres at the worst single frame.
 *
 * This is the loop closure, and it is the only gate in the file that can see a wrong lever. The
 * residue it tolerates is linearisation: the pendulum lever is measured at one probe angle and the
 * contrapposto response at one probe blend, and both are used linearly across the whole range the
 * runtime reaches. Two percent of RMS and a millimetre of worst frame is what that costs on this
 * rig; a lever that is wrong by a factor is out by tens of percent.
 */
const CENTRE_OF_MASS_CLOSURE_TOLERANCE = 0.02;
const CENTRE_OF_MASS_WORST_FRAME_LIMIT_MM = 1.5;

/**
 * How far the centre of mass may sit from Winter's 0.553 of stature, and the trunk span from his
 * 0.288. Both are `figure/BodyMass.js`'s own published self-checks, run here because every lever in
 * this file is derived from that centre of mass and a mis-resolved landmark would move all of them
 * together and silently. The two numbers match `bodymass.selftest.mjs`, deliberately: this is the
 * same claim asserted at the point of use rather than a second, looser opinion about it.
 */
const STATURE_FRACTION_TOLERANCE = 0.03;
const TRUNK_SPAN_TOLERANCE = 0.096;

// ================================================================================================
// PUNCH-LIST 6.9 — affect reaching the balance model. Constants, all of them stated here so the
// section below reads as one argument rather than as numbers appearing mid-loop.
// ================================================================================================

/**
 * 🚩 THE EXERCISE AMPLITUDE, AND IT HAS NO SOURCE. Read this before reading any millimetre the
 * AFFECT → BALANCE section prints.
 *
 * `PostureLayer.CENTRE_OF_PRESSURE_FULL_SCALE_METRES` is **0** on the shipped tree, for two
 * independent measured reasons set out in that constant. A mechanism at zero cannot be measured, so
 * this file supplies an amplitude of its own to drive it with — exactly as `affect.selftest.mjs`
 * supplies `UNSOURCED_GATE_KNEE_DEGREES = 20` to exercise a knee whose full scale is also zero,
 * and for the same reason and with the same warning.
 *
 * 20 mm is ARBITRARY. It is not a claim about how far an angry person's centre of pressure moves;
 * no such number exists in this repository's record. It is chosen only to be large enough to
 * measure against a 4.9 mm balance band and small enough to stay inside the 34.000 mm clamp, so
 * that the clamp is exercised by a separate clause rather than by every clause. Every gate that
 * uses it prints it.
 */
const UNSOURCED_GATE_COP_FULL_SCALE_MM = 20;

/**
 * A second exercise amplitude, used by ONE clause: the full-scale linearity check, which is the
 * only thing that separates the real channel from `affectBiasFromChestBend`. Twice the first, so
 * the expected answer is exactly 2x and the arithmetic is checkable by eye.
 */
const UNSOURCED_GATE_COP_DOUBLE_SCALE_MM = 2 * UNSOURCED_GATE_COP_FULL_SCALE_MM;

/**
 * The seeds and window the affect clauses run over.
 *
 * Six of the twelve, at 60 s: the statistic is a PAIRED same-seed difference, whose measured
 * standard deviation across seeds is 0.0037 mm against an effect of 14+ mm, so the seed count is
 * not what decides any verdict here. The composite footprint clause below is the opposite case and
 * runs all twelve at 900 s, because there the window IS the measurement.
 */
const AFFECT_SEEDS = SWAY_SEEDS.slice( 0, 6 );
const AFFECT_SECONDS = 60;

/**
 * How closely the realised centre of mass must follow the commanded bias, trunk frozen.
 *
 * A QUARTER of `CENTRE_OF_MASS_CLOSURE_TOLERANCE`, derived rather than picked, and tighter than it
 * for a stated reason. That constant tolerates linearisation residue across the WHOLE range the
 * runtime reaches, sampled as an RMS over a noisy trace. This statistic is a paired difference of
 * MEANS at a sustained offset, where the linearisation error is nearly constant and mostly cancels
 * between the two runs — so the same tolerance would be four times looser than the measurement
 * needs. Measured on `figure_g050`: 0.99972 (anger) and 0.99995 (fear), i.e. the realised residue
 * is 0.028% against a 0.5% band, so the band is not what decides this clause.
 */
const AFFECT_CLOSURE_TOLERANCE = CENTRE_OF_MASS_CLOSURE_TOLERANCE / 4;

/**
 * The bakes the composite footprint clause reads. All five, because the defect it measures is a
 * function of the FOOT the bake was built with — the rear footprint runs 44.60 mm (g000) to
 * 65.37 mm (g100) — and it is red on the small feet and green on the large ones.
 */
const FOOTPRINT_BAKES = [ 'g000', 'g025', 'g050', 'g075', 'g100' ];

/**
 * The prefixes the footprint trace reports its deepest excursion at. 900 must be the last and
 * must equal `TRACE_SECONDS`, so the final row of the window table IS the row the red gate reads.
 * Duarte's A/P drift lattice turns over every 319 s, so anything under that samples one phase of
 * it and reports whatever headroom that phase happens to have.
 */
const FOOTPRINT_WINDOWS_SECONDS = [ 60, 120, 300, 900 ];

/**
 * g050's rear footprint edge behind the ankle midpoint, in mm, raw. Quoted in the clamp section's
 * red proof so that clause can say what it is comparing against. The COMPOSITE FOOTPRINT section
 * re-measures this off the mesh every run and prints it, so a drift shows up there rather than
 * silently ageing inside a sentence.
 */
const REAR_FOOTPRINT_G050_MM = -54.4;

const results = [];

/**
 * The shipped layer's legibility, measured once by `measureEventLegibility` and quoted again by
 * THE OTHER WAY so the known-bad numbers sit beside the shipped ones from the same run rather than
 * beside a figure typed into a comment months ago.
 */
let measuredLegibility = null;

/**
 * The glance section's per-band travel, kept for the same reason: CLIP CONTENT's known-bad has to
 * show that the glance gate passes on the very clip that contains no weight transfer, and quoting
 * that from the same run is the only way the two numbers are known to be about the same trace.
 */
let measuredGlanceBands = null;

// --- the figure ---------------------------------------------------------------------------------

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../../../..' );
const figurePath = process.argv[ 2 ]
    ? path.resolve( process.cwd(), process.argv[ 2 ] )
    : path.join( repoRoot, 'assets/figures/figure_g050.glb' );

const bytes = fs.readFileSync( figurePath );
const figure = await Figure.parse( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );

figure.root.updateMatrixWorld( true );

const bounds = new Box3().setFromObject( figure.root );
const stature = bounds.max.y - bounds.min.y;

// The posture the motion stack actually runs in. See the header: the bind pose holds the arms out
// and every lever measured below is a fact about the pose the rig is in when Sway binds.
const skeleton = new Skeleton( figure.root );
const absentFromPose = RestPose.load( 'relaxed-standing' ).applyTo( skeleton );

if ( absentFromPose.length > 0 ) {
    console.warn( `relaxed-standing: this figure has no ${ absentFromPose.join( ', ' ) }` );
}

skeleton.update();
figure.root.updateMatrixWorld( true );

// The rest pose, snapshotted after relaxed-standing has been applied and before anything has run.
// Restored before every stack is bound; see buildStack() for why that matters.
const restPose = new Map();

figure.root.traverse( ( object ) => {

    restPose.set( object, {
        quaternion: object.quaternion.clone(),
        position: object.position.clone()
    } );

} );

/** The `getBone` surface `BodyMass.bind` wants, over the loaded rig. */
const boneTarget = { getBone: ( name ) => figure.root.getObjectByName( name ) ?? null };

/**
 * One centre-of-mass model for the whole file. It resolves bones once and reads their world
 * matrices live, so a single instance follows the rig through every trace below.
 */
const bodyMass = new BodyMass().bind( boneTarget );

/**
 * The markers every trace follows. `segment` names the four points the pendulum makes a prediction
 * about, from the top of the chain to the bottom; the toes are followed only to prove the sole did
 * not move.
 */
const MARKERS = [
    { key: 'head', bone: 'head', segment: true },
    // The neck is followed only so the head can be measured RELATIVE to it. See measureHeadParked.
    { key: 'neck', bone: 'neck_01', segment: false },
    { key: 'pelvis', bone: 'pelvis', segment: true },
    { key: 'kneeLeft', bone: 'calf_l', segment: true },
    { key: 'kneeRight', bone: 'calf_r', segment: false },
    { key: 'ankleLeft', bone: 'foot_l', segment: true },
    { key: 'ankleRight', bone: 'foot_r', segment: false },
    { key: 'toeLeft', bone: 'ball_l', segment: false },
    { key: 'toeRight', bone: 'ball_r', segment: false }
];

const SEGMENT_ORDER = [ 'head', 'pelvis', 'kneeLeft', 'ankleLeft' ];
const PLANTED_MARKERS = [ 'ankleLeft', 'ankleRight', 'toeLeft', 'toeRight' ];

/**
 * 🚩 THE OTHER FOUR BAKES, parsed and posed here because `Figure.parse` is async and every
 * `measure*` function below is not.
 *
 * COMPOSITE FOOTPRINT is the one section in this file that cannot be stated about a single figure.
 * What it measures is a centre of mass against a BASE OF SUPPORT, and the base of support is the
 * one quantity that changes materially between bakes: the rear footprint runs 44.60 mm on g000 to
 * 65.37 mm on g100, while the sway trace that has to fit inside it is nearly the same on all five.
 * So the defect it finds is red on the small feet and green on the large ones, and a run against
 * the default figure alone would report the wrong verdict for four fifths of the shipped figures.
 *
 * Each entry carries its own rest pose, snapshotted after `relaxed-standing` and before anything
 * has run, for exactly the reason `buildStack` restores one: `MotionStack` captures its rest from
 * whatever the rig is in at bind, so binding a second stack to an already-driven figure captures a
 * displaced rest and every absolute measurement after it is off by the last frame of the last run.
 */
const footprintBakes = new Map();

for ( const bake of FOOTPRINT_BAKES ) {

    const bakePath = path.join( repoRoot, `assets/figures/figure_${ bake }.glb` );

    if ( fs.existsSync( bakePath ) === false ) continue;

    // The figure under test is already parsed and posed; re-parsing it would double the cost and
    // then measure a different object than every other section in the file.
    if ( path.resolve( bakePath ) === path.resolve( figurePath ) ) {

        footprintBakes.set( bake, { figure, restPose } );
        continue;

    }

    const bakeBytes = fs.readFileSync( bakePath );
    const bakeFigure = await Figure.parse(
        bakeBytes.buffer.slice( bakeBytes.byteOffset, bakeBytes.byteOffset + bakeBytes.byteLength ) );

    bakeFigure.root.updateMatrixWorld( true );

    const bakeSkeleton = new Skeleton( bakeFigure.root );
    RestPose.load( 'relaxed-standing' ).applyTo( bakeSkeleton );
    bakeSkeleton.update();
    bakeFigure.root.updateMatrixWorld( true );

    const bakeRestPose = new Map();

    bakeFigure.root.traverse( ( object ) => {

        bakeRestPose.set( object, {
            quaternion: object.quaternion.clone(),
            position: object.position.clone()
        } );

    } );

    footprintBakes.set( bake, { figure: bakeFigure, restPose: bakeRestPose } );

}

console.log( `\nfigure: ${ path.relative( repoRoot, figurePath ) }` );
console.log( `stature: ${ stature.toFixed( 4 ) } m, posed into relaxed-standing` );
console.log( `sampling: ${ SAMPLE_RATE_HZ } Hz, ${ SWAY_SEEDS.length } seeds x ${ TRACE_SECONDS } s` );
console.log( `footprint bakes: ${ [ ...footprintBakes.keys() ].join( ', ' ) }\n` );

// --- the run ------------------------------------------------------------------------------------

measureRig();

const traces = SWAY_SEEDS.map( ( seed ) => traceSway( seed, TRACE_SECONDS ) );

measureBalanceBand( traces );
measureCentreOfMassClosure( traces );
measureComposite( traces );
measureHeadExcursion( traces );
measureHeadParked( traces );
measureEventLegibility();
measureToeArticulation();
measureFreeFootArticulation();
measureFootBandArticulation();
measureGlanceLegibility();
measureTrunkArticulation();
measureClipContent();
measureFullStackHeadOverHip();
measureAmplitudeDistribution();
measureSegmentPaths( traces );
measurePendulumGeometry();
measurePlantedFeet( traces );
measureSpectrum();
measurePosturalVelocity();
measureEventRates();
measureDiscourseCoupling();
measureTheOtherWay();
measureFrameRateInvariance();
measureVariableFrameTime();
measureDeterminism();
measureAffectBalance();
measureCompositeFootprint();

report();

// ================================================================================================

/**
 * The rig facts every prediction below is derived from.
 *
 * Two of them are gated rather than printed, and they are the two that would move every other
 * number in the file if they were wrong:
 *
 *   THE CENTRE OF MASS, against Winter's independent anatomy. Every amplitude in `Sway.js` is a
 *   centre-of-pressure amplitude realised by putting the centre of mass somewhere, so a centre of
 *   mass in the wrong place produces a perfectly smooth weight shift of the wrong size and nothing
 *   about the output says so.
 *
 *   HEAD PER CENTRE OF MASS, against the rig's own raw geometry. This is the coefficient the
 *   deleted POSTURE_HEAD_TRANSFER used to guess at — 0.20 against a true 1.65 — and the whole point
 *   of the re-rooting is that it is now measured. A measurement is only better than a guess if
 *   something checks it, so it is checked against a quantity computed from bone heights alone,
 *   which shares no code with the probe that produced it.
 */
function measureRig() {

    section( 'RIG — the levers the whole file is derived from' );

    const { stack, layer, root } = buildStack( SEED );

    root.updateMatrixWorld( true );

    const centreOfMass = bodyMass.centreOfMass( new Vector3() );
    const headHeight = worldHeightOfBone( root, 'head' );

    note( 'pivot height (m)', layer.pivot.y.toFixed( 4 ),
        'between the sole and the ankle joint; see PIVOT_HEIGHT_FRACTION_OF_ANKLE' );
    note( 'COM lever ML / AP (m)',
        `${ layer.centreOfMassLever.medioLateral.toFixed( 4 ) } / ` +
        `${ layer.centreOfMassLever.anteroPosterior.toFixed( 4 ) }`,
        'centre-of-mass travel per radian — what the lean is SOLVED against' );
    note( 'head lever ML / AP (m)',
        `${ layer.headLever.medioLateral.toFixed( 4 ) } / ${ layer.headLever.anteroPosterior.toFixed( 4 ) }`,
        'head travel per radian — reported, never solved against' );
    note( 'ankle pendulum share', layer.anklePendulumShare.toFixed( 2 ),
        'the rest is shared down the spine' );
    note( 'posture clamp ML / AP (mm)',
        `${ ( layer.medioLateral.limit * 1000 ).toFixed( 1 ) } / ` +
        `${ ( layer.anteroPosterior.limit * 1000 ).toFixed( 1 ) }`,
        'two of Duarte\'s mean shifts, capped laterally by the half-stance' );
    note( 'contrapposto COM response (mm)',
        `${ ( layer.stanceResponse.left.centreOfMass.x * 1000 ).toFixed( 2 ) } / ` +
        `${ ( layer.stanceResponse.right.centreOfMass.x * 1000 ).toFixed( 2 ) }`,
        'per unit blend, left / right — what the stance blend is SOLVED against' );
    note( 'contrapposto head response (mm)',
        `${ ( layer.stanceResponse.left.head.x * 1000 ).toFixed( 2 ) } / ` +
        `${ ( layer.stanceResponse.right.head.x * 1000 ).toFixed( 2 ) }`,
        'per unit blend, left / right — reported only' );
    note( 'whole-body COM (m)', centreOfMass.y.toFixed( 4 ),
        `${ ( centreOfMass.y / stature ).toFixed( 4 ) } of stature ${ stature.toFixed( 4 ) } m` );

    // 🎯 The raw geometry ratio: what a perfectly rigid plank rotating about the pivot would give.
    // Computed from two bone heights and the pivot, sharing no code with measurePendulumResponse,
    // so a probe that leaned the wrong chain or read the wrong bone cannot agree with it.
    const rawGeometryRatio = ( headHeight - layer.pivot.y ) / ( centreOfMass.y - layer.pivot.y );

    note( 'raw geometry ratio', rawGeometryRatio.toFixed( 4 ),
        `head ${ headHeight.toFixed( 3 ) } m over COM ${ centreOfMass.y.toFixed( 3 ) } m, both above the pivot` );

    gate( 'head per unit COM / raw ratio', layer.headPerCentreOfMass / rawGeometryRatio,
        1 - HEAD_PER_CENTRE_OF_MASS_TOLERANCE, 1 + HEAD_PER_CENTRE_OF_MASS_TOLERANCE,
        `measured ${ layer.headPerCentreOfMass.toFixed( 4 ) }; the deleted POSTURE_HEAD_TRANSFER guessed 0.20` );

    gate( 'head per unit COM, absolute', layer.headPerCentreOfMass, 1.0, 3.0,
        'the head is further from the ankle than the centre of mass is, so this is always > 1' );

    // BodyMass's own two self-checks, run at the point of use. See the tolerance constants.
    const statureCheck = bodyMass.selfCheckFractionOfStature( stature );
    const spanCheck = bodyMass.selfCheckTrunkSpan( stature );

    gate( 'COM as fraction of stature', statureCheck.fraction,
        WHOLE_BODY_COM_FRACTION_OF_STATURE - STATURE_FRACTION_TOLERANCE,
        WHOLE_BODY_COM_FRACTION_OF_STATURE + STATURE_FRACTION_TOLERANCE,
        'Winter 0.553 — an INDEPENDENT figure, not one derived from the segment table' );

    gate( 'trunk span as fraction of stature', spanCheck.fraction,
        spanCheck.expected - TRUNK_SPAN_TOLERANCE, spanCheck.expected + TRUNK_SPAN_TOLERANCE,
        'Winter: shoulder 0.818 less hip 0.530 = 0.288; this is what catches a mis-resolved trunk' );

    gate( 'mass accounted for', bodyMass.massAccountedFor, 0.9999, 1.0001,
        'a shortfall means a segment landmark did not resolve on this rig' );

    gate( 'posture clamp ML (mm)', layer.medioLateral.limit * 1000, 20, 90,
        '2 x Duarte ML 22 mm; the half-stance ceiling would allow 77.7 and does not bind' );
    // 🚩 THE SOURCE NOTE ON THIS LINE USED TO READ "inside the 50 mm rear footprint measured on this
    // figure", AND THAT IS THE SAFETY ARGUMENT THE COMPOSITE FOOTPRINT SECTION FALSIFIES. Three
    // things are wrong with it. The clamp reads no rig geometry fore-and-aft at all — measured
    // 34.000 mm on all five bakes, whose rear footprints run 44.60 to 65.37 mm — so it is not
    // "measured on this figure" in the way the lateral one is. "50 mm" is roughly g050's and is
    // 5.4 mm past g000's. And the clamp is only one of three terms in `displacement.z`: adding the
    // balance band and `PostureLayer`'s chest bend takes `fear` OUTSIDE the base of support on two
    // of the five bakes. A margin argued term-by-term is not a margin.
    gate( 'posture clamp AP (mm)', layer.anteroPosterior.limit * 1000, 10, 60,
        '2 x Duarte AP 17 mm, and it reads NO rig geometry — see COMPOSITE FOOTPRINT for what the ' +
        'sum of the three antero-posterior terms actually does to the base of support' );

    stack.dispose();

}

/**
 * One run of the default layer, following every marker, the commanded signals, and the figure's
 * own realised centre of mass.
 *
 * Positions are absolute world metres. Nothing is subsampled: the balance band runs to about 1.3 Hz
 * and the planting claim is about the WORST frame, not the typical one.
 *
 * The commanded signals are stored as flat arrays rather than vectors because there are six of them
 * per frame across twelve 900 s traces, and that is 4 million numbers whichever way it is written.
 */
function traceSway( seed, seconds, options = {}, afterBind = null ) {

    const { stack, layer, root } = buildStack( seed, options );

    if ( afterBind !== null ) afterBind( layer );

    const bones = new Map( MARKERS.map( ( marker ) => [ marker.key, root.getObjectByName( marker.bone ) ] ) );
    const samples = new Map( MARKERS.map( ( marker ) => [ marker.key, [] ] ) );

    const frames = Math.round( seconds * SAMPLE_RATE_HZ );

    const signals = {
        balanceMedioLateral: new Float64Array( frames ),
        balanceAnteroPosterior: new Float64Array( frames ),
        commandedMedioLateral: new Float64Array( frames ),
        commandedAnteroPosterior: new Float64Array( frames ),
        realisedMedioLateral: new Float64Array( frames ),
        realisedAnteroPosterior: new Float64Array( frames )
    };

    const restPositions = new Map();
    const restSoleRotations = new Map();

    root.updateMatrixWorld( true );

    for ( const marker of MARKERS ) {

        restPositions.set( marker.key, new Vector3().setFromMatrixPosition( bones.get( marker.key ).matrixWorld ) );

    }

    // 🚩 The SOLE's NORMAL, not the foot's rotation. See soleTiltDegrees below for why that
    // distinction is the whole gate. Resolved in each foot's OWN frame, where it is a constant.
    for ( const key of [ 'ankleLeft', 'ankleRight' ] ) {

        restSoleRotations.set( key, soleNormalInBoneFrame( bones.get( key ), new Vector3() ) );

    }

    const restCentreOfMass = bodyMass.centreOfMass( new Vector3() );
    const centreOfMass = new Vector3();
    const soleNormal = new Vector3();

    /**
     * 🚩 THE ANGLE THE SOLE'S NORMAL HAS TURNED THROUGH, which is not what this used to measure.
     *
     * It used to take the angle between the foot bone's world quaternion and its rest quaternion —
     * the TOTAL rotation, on a gate named "sole tilt" and tolerated at 0.02 degrees. Those are two
     * different quantities and the difference is exactly the defect this round is about: a foot
     * turning out on the floor is a rotation about the vertical, which changes the total rotation by
     * degrees and tilts the sole by nothing at all. The old form therefore forbade the one motion a
     * free foot is allowed to make, in the name of a floor constraint that has no opinion about it,
     * and it passed for two rounds because nothing was releasing that rotation. §1.7e: a gate can
     * encode the defect it was written to catch.
     *
     * The normal is the foot bone's own +Y in world space. Tracking it answers the question the gate
     * is named for — is the sole still parallel to the floor — and says nothing whatever about yaw.
     */
    let soleTiltDegrees = 0;
    let stanceBlendPeak = 0;

    // The turn-out each foot's own unloading released this frame, in radians. Recorded so the
    // planting section can subtract the arc it accounts for rather than forbidding it.
    const footYaw = { left: [], right: [] };

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        for ( const marker of MARKERS ) {

            samples.get( marker.key ).push(
                new Vector3().setFromMatrixPosition( bones.get( marker.key ).matrixWorld ) );

        }

        for ( const key of [ 'ankleLeft', 'ankleRight' ] ) {

            soleNormalOf( bones.get( key ), restSoleRotations.get( key ), soleNormal );
            soleTiltDegrees = Math.max( soleTiltDegrees,
                angleBetweenVectorsDegrees( soleNormal, WORLD_UP ) );

        }

        footYaw.left.push( layer.footYawRadians.left );
        footYaw.right.push( layer.footYawRadians.right );

        bodyMass.centreOfMass( centreOfMass );

        signals.balanceMedioLateral[ frame ] = layer.balanceDisplacement.x;
        signals.balanceAnteroPosterior[ frame ] = layer.balanceDisplacement.z;
        signals.commandedMedioLateral[ frame ] = layer.displacement.x;
        signals.commandedAnteroPosterior[ frame ] = layer.displacement.z;
        signals.realisedMedioLateral[ frame ] = centreOfMass.x - restCentreOfMass.x;
        signals.realisedAnteroPosterior[ frame ] = centreOfMass.z - restCentreOfMass.z;

        stanceBlendPeak = Math.max( stanceBlendPeak, Math.abs( layer.stanceBlend ) );

    }

    const geometry = {
        pivotHeight: layer.pivot.y,
        headLever: headLeverMetres( layer ),
        ankleShare: layer.anklePendulumShare,
        predictedRatio: new Map( SEGMENT_ORDER.map( ( key ) => {

            const marker = MARKERS.find( ( entry ) => entry.key === key );

            return [ key, predictedSegmentRatio( layer, worldHeightOfBone( root, marker.bone ) ) ];

        } ) )
    };

    stack.dispose();

    return { seed, samples, signals, restPositions, soleTiltDegrees, stanceBlendPeak, geometry, footYaw,
        layerHeadPerCentreOfMassLateral: layer.headPerCentreOfMassLateral };

}

/**
 * 🎯 THE QUIET-STANDING GATE. `layer.balanceDisplacement`, in centre-of-pressure millimetres,
 * against Quijoux's force-plate column, over the seed × window matrix.
 *
 * This is sampled from the layer AS A CONSUMER CONSTRUCTS IT — `new Sway()`, weight shifts running.
 * The balance band is a separate field precisely so it can be read out of a live layer, and §1.5
 * records what happened last time this gate was stated against `{ weightShiftsEnabled: false }`: a
 * configuration no consumer would build passed while the default failed on 9 of 9 runs with the
 * anisotropy inverted.
 *
 * THE GATE BANDS ARE DERIVED, NOT TUNED. An RMS estimate over a window containing n independent
 * cycles has a relative standard error of about 1/sqrt(2n), and a window of T seconds of a signal
 * whose spectral mode is f contains n = fT of them. So the band at each window length falls out of
 * Quijoux's own published mode, and the only judgement in it is how many sigma: three for the
 * extremes over twelve seeds (a two-sigma band would be expected to clip one of twelve about four
 * times in ten), one for the median, whose own standard error is 0.36 of a single seed's.
 */
function measureBalanceBand( traces ) {

    section( 'BALANCE BAND — `new Sway()` as constructed, centre-of-pressure mm vs Quijoux' );

    console.log( '  window       seed   ML_RMS  AP_RMS  ratio' );

    const byWindow = new Map();

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const frames = Math.round( seconds * SAMPLE_RATE_HZ );
        const window = { medioLateral: [], anteroPosterior: [], ratio: [] };

        for ( const trace of traces ) {

            const mlRms = rootMeanSquare( trace.signals.balanceMedioLateral.subarray( 0, frames ) ) * 1000;
            const apRms = rootMeanSquare( trace.signals.balanceAnteroPosterior.subarray( 0, frames ) ) * 1000;

            window.medioLateral.push( mlRms );
            window.anteroPosterior.push( apRms );
            window.ratio.push( apRms / mlRms );

            console.log( `  ${ String( seconds ).padStart( 5 ) }s ${ String( trace.seed ).padStart( 10 ) }   ` +
                `${ mlRms.toFixed( 2 ).padStart( 6 ) }  ${ apRms.toFixed( 2 ).padStart( 6 ) }  ` +
                `${ ( apRms / mlRms ).toFixed( 2 ).padStart( 5 ) }` );

        }

        byWindow.set( seconds, window );

    }

    console.log( '' );

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const window = byWindow.get( seconds );
        const label = `${ seconds }s`;

        const sigmaMedioLateral = rmsEstimatorSigma( seconds, QUIJOUX_MODE_MEDIO_LATERAL_HZ );
        const sigmaAnteroPosterior = rmsEstimatorSigma( seconds, QUIJOUX_MODE_ANTERO_POSTERIOR_HZ );

        gateBand( `[${ label }] ML RMS lowest (mm)`, Math.min( ...window.medioLateral ),
            QUIJOUX_RMS_MEDIO_LATERAL_MM, 3 * sigmaMedioLateral,
            `plate ML 3.0 mm, +/- 3 sigma of an RMS estimate over ${ seconds } s` );
        gateBand( `[${ label }] ML RMS highest (mm)`, Math.max( ...window.medioLateral ),
            QUIJOUX_RMS_MEDIO_LATERAL_MM, 3 * sigmaMedioLateral, '' );
        gateBand( `[${ label }] ML RMS median (mm)`, median( window.medioLateral ),
            QUIJOUX_RMS_MEDIO_LATERAL_MM, sigmaMedioLateral,
            'the median must sit ON the column, not at the edge of its scatter' );

        gateBand( `[${ label }] AP RMS lowest (mm)`, Math.min( ...window.anteroPosterior ),
            QUIJOUX_RMS_ANTERO_POSTERIOR_MM, 3 * sigmaAnteroPosterior,
            `plate AP 4.9 mm, +/- 3 sigma over ${ seconds } s` );
        gateBand( `[${ label }] AP RMS highest (mm)`, Math.max( ...window.anteroPosterior ),
            QUIJOUX_RMS_ANTERO_POSTERIOR_MM, 3 * sigmaAnteroPosterior, '' );
        gateBand( `[${ label }] AP RMS median (mm)`, median( window.anteroPosterior ),
            QUIJOUX_RMS_ANTERO_POSTERIOR_MM, sigmaAnteroPosterior, '' );

        // 🎯 THE ANISOTROPY GATE, AND THE ONLY ONE IN THIS FILE. Quiet stance is anisotropic and
        // AP is always the larger. It is stated on the MEDIAN over seeds against the measured
        // band undilated, because that is how Quijoux's own figure was produced — a median across
        // subjects, not a single recording.
        gate( `[${ label }] AP/ML ratio median`, median( window.ratio ),
            QUIJOUX_ANISOTROPY_LOW, QUIJOUX_ANISOTROPY_HIGH,
            `AP is 1.5-2x ML and must never be isotropic; design ${ DESIGN_ANISOTROPY.toFixed( 3 ) }` );

        note( `[${ label }] AP/ML ratio spread`,
            `${ Math.min( ...window.ratio ).toFixed( 2 ) }-${ Math.max( ...window.ratio ).toFixed( 2 ) }`,
            'a ratio of two noisy estimates; the per-seed extremes are gated at the longest window only' );

    }

    // The extremes of the ratio are gated once, at 900 s. A ratio inherits the quadrature sum of
    // its two estimators' scatter, which at 60 s is +/- 24% per seed — a 3-sigma band there spans
    // 0.5 to 2.8 and would be measuring the estimator rather than the layer (§1.4).
    const longest = byWindow.get( TRACE_SECONDS );
    const sigmaRatio = Math.hypot(
        rmsEstimatorSigma( TRACE_SECONDS, QUIJOUX_MODE_MEDIO_LATERAL_HZ ),
        rmsEstimatorSigma( TRACE_SECONDS, QUIJOUX_MODE_ANTERO_POSTERIOR_HZ ) );

    gateBand( `[${ TRACE_SECONDS }s] AP/ML ratio lowest`, Math.min( ...longest.ratio ),
        DESIGN_ANISOTROPY, 3 * sigmaRatio, 'design 1.633, +/- 3 sigma of a ratio of two RMS estimates' );
    gateBand( `[${ TRACE_SECONDS }s] AP/ML ratio highest`, Math.max( ...longest.ratio ),
        DESIGN_ANISOTROPY, 3 * sigmaRatio, '' );

}

/**
 * 🎯 THE LOOP CLOSURE, and the only gate here that can see a wrong lever.
 *
 * `balanceDisplacement` is a COMMANDED quantity — a noise table times an authored amplitude — and
 * it would read correctly on a rig whose legs were welded, whose lever was measured against the
 * wrong bone, or whose centre of mass sat in its knees. §1.3: what would a degenerate input score
 * here? Full marks.
 *
 * So the figure's actual whole-body centre of mass is computed from `figure/BodyMass.js` on every
 * frame of every trace and required to be where the layer said it would be. That is the physical
 * claim the whole re-rooting rests on: a sustained centre-of-pressure offset IS a centre-of-mass
 * offset, so if the model is honest the body must actually GO there.
 *
 * THE OTHER WAY doubles the lever and shows this gate rejecting it while the band gate above does
 * not notice.
 */
function measureCentreOfMassClosure( traces ) {

    section( 'LOOP CLOSURE — the body actually goes where the layer said it would' );

    console.log( '        seed   commanded ML   realised ML   commanded AP   realised AP   worst frame (mm)' );

    const ratios = [];
    let worstFrameMm = 0;

    for ( const trace of traces ) {

        const commandedMl = rootMeanSquare( trace.signals.commandedMedioLateral ) * 1000;
        const realisedMl = rootMeanSquare( trace.signals.realisedMedioLateral ) * 1000;
        const commandedAp = rootMeanSquare( trace.signals.commandedAnteroPosterior ) * 1000;
        const realisedAp = rootMeanSquare( trace.signals.realisedAnteroPosterior ) * 1000;

        let worst = 0;

        for ( let frame = 0; frame < trace.signals.commandedMedioLateral.length; frame ++ ) {

            worst = Math.max( worst, Math.hypot(
                trace.signals.realisedMedioLateral[ frame ] - trace.signals.commandedMedioLateral[ frame ],
                trace.signals.realisedAnteroPosterior[ frame ] - trace.signals.commandedAnteroPosterior[ frame ]
            ) * 1000 );

        }

        worstFrameMm = Math.max( worstFrameMm, worst );
        ratios.push( realisedMl / commandedMl, realisedAp / commandedAp );

        console.log( `  ${ String( trace.seed ).padStart( 10 ) }   ` +
            `${ commandedMl.toFixed( 3 ).padStart( 12 ) }  ${ realisedMl.toFixed( 3 ).padStart( 12 ) }  ` +
            `${ commandedAp.toFixed( 3 ).padStart( 13 ) }  ${ realisedAp.toFixed( 3 ).padStart( 12 ) }  ` +
            `${ worst.toFixed( 3 ).padStart( 16 ) }` );

    }

    console.log( '' );

    gate( 'realised / commanded, lowest', Math.min( ...ratios ),
        1 - CENTRE_OF_MASS_CLOSURE_TOLERANCE, 1 + CENTRE_OF_MASS_CLOSURE_TOLERANCE,
        'both axes, every seed; the residue is the linearised lever and blend' );
    gate( 'realised / commanded, highest', Math.max( ...ratios ),
        1 - CENTRE_OF_MASS_CLOSURE_TOLERANCE, 1 + CENTRE_OF_MASS_CLOSURE_TOLERANCE, '' );
    gate( 'worst single frame (mm)', worstFrameMm, 0, CENTRE_OF_MASS_WORST_FRAME_LIMIT_MM,
        'the largest instantaneous gap between where the body was asked to be and where it is' );

}

/**
 * The composite — balance band plus Duarte's three weight-shift processes — over Bates' own
 * fifteen-minute window, against Bates' own interquartile range.
 *
 * 🎯 THE ANISOTROPY IS REPORTED AND DELIBERATELY NOT GATED, AND THAT IS THE POINT OF SPLITTING
 * THIS FROM THE BALANCE BAND. Quiet stance is anisotropic with AP larger; unconstrained standing is
 * not — Bates measures 16.87 ML against 16.32 AP, a ratio of 1.03 — because Duarte's lateral shifts
 * are both larger and more frequent than his fore-and-aft ones and fifteen minutes is long enough
 * for them to assert themselves. A composite ratio that wanders below 1.0 is the model being right.
 *
 * ⚠️ WHERE THIS DEVIATES FROM BATES' PROTOCOL. He excises ±1.5 s around each fidget before taking
 * the SD; this does not, because the layer relays only LATERAL postural events and the fore-and-aft
 * fidget times are not exposed. A fidget is a 1.4 s out-and-back at half the shift amplitude, so
 * including them can only inflate our figure relative to his — which means the antero-posterior
 * shortfall reported below is a LOWER bound on the real gap, not an artefact of it.
 */
function measureComposite( traces ) {

    section( `COMPOSITE — balance + posture over ${ UNCONSTRAINED_WINDOW_SECONDS } s, vs Bates et al. 2021` );

    console.log( '        seed   ML_SD   AP_SD   ratio' );

    const frames = Math.round( UNCONSTRAINED_WINDOW_SECONDS * SAMPLE_RATE_HZ );
    const medioLateral = [];
    const anteroPosterior = [];
    const ratio = [];

    for ( const trace of traces ) {

        const ml = rootMeanSquare( trace.signals.commandedMedioLateral.subarray( 0, frames ) ) * 1000;
        const ap = rootMeanSquare( trace.signals.commandedAnteroPosterior.subarray( 0, frames ) ) * 1000;

        medioLateral.push( ml );
        anteroPosterior.push( ap );
        ratio.push( ap / ml );

        console.log( `  ${ String( trace.seed ).padStart( 10 ) }  ${ ml.toFixed( 2 ).padStart( 6 ) }  ` +
            `${ ap.toFixed( 2 ).padStart( 6 ) }  ${ ( ap / ml ).toFixed( 2 ).padStart( 6 ) }` );

    }

    console.log( '' );

    note( 'ML median / range (mm)',
        `${ median( medioLateral ).toFixed( 2 ) }  ${ Math.min( ...medioLateral ).toFixed( 2 ) }-` +
        `${ Math.max( ...medioLateral ).toFixed( 2 ) }`,
        `Bates ML ${ BATES_SD_MEDIO_LATERAL_MM } mm, IQR ${ BATES_IQR_MEDIO_LATERAL_MM.join( '-' ) }` );
    note( 'AP median / range (mm)',
        `${ median( anteroPosterior ).toFixed( 2 ) }  ${ Math.min( ...anteroPosterior ).toFixed( 2 ) }-` +
        `${ Math.max( ...anteroPosterior ).toFixed( 2 ) }`,
        `Bates AP ${ BATES_SD_ANTERO_POSTERIOR_MM } mm, IQR ${ BATES_IQR_ANTERO_POSTERIOR_MM.join( '-' ) }` );
    note( 'AP/ML ratio, median / range',
        `${ median( ratio ).toFixed( 2 ) }  ${ Math.min( ...ratio ).toFixed( 2 ) }-${ Math.max( ...ratio ).toFixed( 2 ) }`,
        'Bates 1.03 — NOT gated: unconstrained anisotropy inverts, and that is correct' );

    gate( 'ML SD median (mm)', median( medioLateral ),
        BATES_IQR_MEDIO_LATERAL_MM[ 0 ], BATES_IQR_MEDIO_LATERAL_MM[ 1 ],
        'inside Bates\' lateral interquartile range' );

    gate( 'ML SD highest (mm)', Math.max( ...medioLateral ), 0, BATES_IQR_MEDIO_LATERAL_MM[ 1 ],
        'no seed may exceed his upper quartile — that is what the posture clamp is for' );

    gate( 'AP SD highest (mm)', Math.max( ...anteroPosterior ), 0, BATES_IQR_ANTERO_POSTERIOR_MM[ 1 ],
        'no seed may exceed his fore-and-aft upper quartile' );

    // 🚩 A MEASURED SHORTFALL, RECORDED RATHER THAN TOLERATED — the same pattern
    // `bodymass.selftest.mjs` uses for the check it knows cannot catch a mis-resolved trunk.
    //
    // Our antero-posterior composite sits BELOW Bates' lower quartile of 10.34 mm. The range has
    // NOT been widened to admit it and the number below is not a target; it is a gate that will
    // start failing the day the shortfall is fixed, which is what forces this comment to be
    // rewritten rather than quietly outlived.
    //
    // Where the gap is: `Sway.js` says so in DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES. Duarte
    // publishes drift INTERVALS and no drift amplitude, so the fore-and-aft drift term is the one
    // unpinned number in the layer, and a process whose lattice turns over every 319 s has barely
    // three degrees of freedom in a fifteen-minute window — raising it 2.2x moved the composite
    // from 6.2 mm to 7.6 mm against a target of 16.3. Closing this needs a published fore-and-aft
    // drift amplitude, or Bates' raw traces, and neither is in hand.
    const anteroPosteriorShortfall = BATES_IQR_ANTERO_POSTERIOR_MM[ 0 ] - median( anteroPosterior );

    note( 'AP shortfall vs Bates Q1 (mm)', anteroPosteriorShortfall.toFixed( 2 ),
        'DOCUMENTED KNOWN STATE, not a pass: see the comment above and Sway.js DRIFT_AMPLITUDE_*' );

    gate( 'AP median is BELOW Bates Q1', anteroPosteriorShortfall > 0 ? 1 : 0, 1, 1,
        'recorded, not tolerated: 1 means the known shortfall is still there and this note is current' );

}

/**
 * Head excursion — measured, printed, and NOT gated against any published figure, because there
 * is not one.
 *
 * 🚩 §1.9. A search of the postural literature for an absolute head-sway amplitude in millimetres
 * for healthy adult quiet stance came back empty. The posturography record is measured at the
 * FLOOR, with force plates; head-mounted and optical studies of quiet stance report velocities,
 * frequencies, correlations and clinical contrasts, not a millimetre figure in a standardised
 * stance. So this number has NO direct empirical check. What is checked is the lever that produces
 * it — against the rig's own raw geometry, in the RIG section — and the centre of mass it hangs
 * off, against Winter. The envelope below is a sanity check and nothing more: it catches a head
 * that has stopped moving and a head that has come off, and it is honest about catching nothing in
 * between.
 *
 * The previous version of this file gated exactly this quantity at 3–5 mm ML and 5–7 mm AP, by
 * applying Quijoux's centre-of-pressure column to the head. That is the frame-of-reference error
 * (§1.7) the whole rewrite exists to remove.
 */
function measureHeadExcursion( traces ) {

    section( 'HEAD EXCURSION — an OUTPUT of the rig geometry, reported, with no literature to gate it' );

    const medioLateral = [];
    const anteroPosterior = [];

    for ( const trace of traces ) {

        const head = trace.samples.get( 'head' );

        medioLateral.push( rootMeanSquare( head.map( ( point ) => point.x ) ) * 1000 );
        anteroPosterior.push( rootMeanSquare( head.map( ( point ) => point.z ) ) * 1000 );

    }

    note( 'head ML RMS median / range (mm)',
        `${ median( medioLateral ).toFixed( 2 ) }  ${ Math.min( ...medioLateral ).toFixed( 2 ) }-` +
        `${ Math.max( ...medioLateral ).toFixed( 2 ) }`,
        `over ${ TRACE_SECONDS } s; NO published head amplitude exists to compare this against` );
    note( 'head AP RMS median / range (mm)',
        `${ median( anteroPosterior ).toFixed( 2 ) }  ${ Math.min( ...anteroPosterior ).toFixed( 2 ) }-` +
        `${ Math.max( ...anteroPosterior ).toFixed( 2 ) }`, '' );

    // The envelope: wide on purpose. Its lower bound is the failure this file was born to catch —
    // a marker that has stopped moving — and its upper bound is a head that has left the body.
    gate( 'head ML RMS lowest (mm)', Math.min( ...medioLateral ), 1, 100,
        'sanity envelope ONLY: not zero, not absurd' );
    gate( 'head ML RMS highest (mm)', Math.max( ...medioLateral ), 1, 100, '' );
    gate( 'head AP RMS lowest (mm)', Math.min( ...anteroPosterior ), 1, 100, '' );
    gate( 'head AP RMS highest (mm)', Math.max( ...anteroPosterior ), 1, 100, '' );

}

/**
 * 🎯 IS THE HEAD PARKED? THE RATIO AND CORRELATION GATES, AND WHY THEY DID NOT EXIST BEFORE.
 *
 * Every one of this file's 97 gates was green when a blind visual judge watched seven minutes of
 * the full stack and reported two defects it could not see:
 *
 *   "the head still travels 1.34x the hip" — the direction was right, the target is pelvis-leads;
 *   "head-on-neck motion adds to the trunk lean instead of cancelling it, r = +0.10 against neck
 *   displacement, when head stabilisation in space should make it negative."
 *
 * 🚩 THE REASON THE GATES MISSED BOTH IS THE SAME REASON, AND IT IS WORTH STATING PLAINLY: every
 * gate in this file measured a MAGNITUDE, and both defects are RELATIONSHIPS. Nothing here compared
 * two body parts to each other, and nothing here correlated anything with anything. A layer can put
 * exactly the right number of millimetres into every marker and still distribute them up the body
 * the wrong way round, and that is precisely what a viewer notices first.
 *
 * 🚩🚩 AND THEN THE GATES WRITTEN TO CLOSE THAT WERE ONE-SIDED, WHICH IS §1.3 REAPPEARING INSIDE THE
 * FIX FOR §1.11. An independent verifier set `LATERAL_HEAD_PER_CENTRE_OF_MASS` to 0.30 and ran this
 * file. That is a head moving 20.6% of the pelvis — a mannequin head nailed in space over a body
 * that sways under it, the exact mirror of what the judge saw — and it scored BETTER than the
 * shipped model on every ratio gate here, and took the best mark the correlation gate can award:
 *
 *     head / pelvis lateral RMS         0.206  target 0 .. 1.000   (shipped 0.843)
 *     head / pelvis lateral p2p         0.205  target 0 .. 1.000   (shipped 0.832)
 *     r(head-on-neck, neck)            -1.000  target -1 .. 0      (shipped -0.996)
 *
 * The three gates that did fail were the solve residuals, and they fail only because they read the
 * constant that was changed. Head under-travel arriving from a neck-righting change, from another
 * mechanism, or from a refactor would have been invisible. Two lessons, both already in LEARNINGS
 * and both freshly earned here:
 *
 *   A RATIO HAS TWO FAILURE DIRECTIONS AND A ONE-SIDED BAND DECLARES ONE OF THEM FREE. "The pelvis
 *   leads" does not exclude a head that has stopped moving, and neither does "the head is
 *   stabilised" — a head bolted to the world is maximally stabilised.
 *
 *   A CORRELATION IS SCALE-FREE, SO IT CANNOT GATE AN AMOUNT. r = -1 is what a perfectly parked head
 *   scores. Anywhere the claim is about HOW MUCH one part answers another, the slope has to be gated
 *   beside the sign. See `regressionSlope`.
 *
 * So this section now gates five relationships, all on `new Sway()` as constructed:
 *
 *   THE SOLVE CLOSED. Both lateral mechanisms are solved so the head lands where the centre of mass
 *   lands — see LATERAL_HEAD_PER_CENTRE_OF_MASS — and this asserts the solve's residual rather than
 *   trusting it. Per side, because the contrapposto poses are asymmetric and one averaged angle
 *   parked one side and left the other overshooting by 10%.
 *
 *   🎯 AND THE SOLVE'S CLAIM SURVIVED THE FRAME LOOP. The one above reads a bind-time probe off the
 *   layer, so it can only catch a defect that originates in the solve; this reads the same ratio off
 *   the TRACE — realised head displacement against the figure's own realised centre of mass, twelve
 *   seeds of 900 s — and it is the gate the 0.30 experiment needed. It is two-sided at 1.00 ± 5%,
 *   and it is stated twice on purpose: as an RMS ratio, which asks whether the head moved as far,
 *   and as a regression slope, which asks whether it moved WITH the centre of mass. A head carrying
 *   independent noise of the right amplitude passes the first and fails the second.
 *
 *   THE PELVIS LEADS — AND THE HEAD HAS NOT STOPPED. Head over pelvis lateral travel, in RMS and
 *   peak-to-peak, over 12 seeds of 900 s, now inside a BAND. Peak-to-peak as well as RMS because the
 *   original defect lived in the peaks: the contrapposto saturates on 16-29% of frames and what it
 *   cannot deliver used to fall through to a rigid pendulum that moves the head 1.674x the centre of
 *   mass. See PELVIS_LEADS_FLOOR for why the floor is coarse and where the tight claim lives.
 *
 *   THE HEAD IS STABILISED. The sign of the correlation between the head's position RELATIVE TO THE
 *   NECK and the neck's own displacement. Negative means the head-on-neck rotation opposes the trunk
 *   — which is what head stabilisation in space IS — and positive means it adds to it. This is the
 *   judge's own measurement, reproduced offline so it can be gated without a video capture.
 *
 *   🎯 BY THE RIGHT AMOUNT. The slope of the same pair, banded strictly inside (-1, 0): 0 is no
 *   righting, -1 is a head held still in space while the trunk moves under it. See
 *   HEAD_ON_NECK_GAIN_BAND.
 *
 * ⚠️ AND THE LIMIT, BECAUSE §1.9 REQUIRES IT. These all run on THIS LAYER, not on the stack the
 * judge watched. Measured on the full `alive.js` stack the head/pelvis peak-to-peak ratio is 1.40
 * and the correlation is +0.11; with `gaze.head` removed and nothing else changed they are 1.07 and
 * -0.94. The remaining defect is a layer this file does not own and cannot gate, and saying so is
 * the point: what is asserted here is that Sway is not the one adding to the head.
 *
 * ⚠️ AND A SECOND LIMIT. The centre of mass these gates compare the head against is `BodyMass`'s,
 * computed from the same posed rig, so this is a check that the layer's two mechanisms distribute a
 * displacement up the body correctly — NOT an independent check that the displacement itself is the
 * right size. That claim belongs to the balance-band and composite sections, which gate amplitudes
 * against Quijoux and Bates.
 */
function measureHeadParked( traces ) {

    section( 'HEAD PARKED — ratios and a correlation, which is what no gate here measured' );

    const { layer, stack } = buildStack( SEED );

    // The solve's own residual, read off the layer rather than recomputed, because what has to be
    // true is that the thing the frame loop uses landed on its target.
    for ( const side of [ 'left', 'right' ] ) {

        const response = layer.stanceResponse[ side ];

        gate( `contrapposto head / COM, ${ side }`,
            Math.abs( response.head.x ) / Math.abs( response.centreOfMass.x ),
            1 - LATERAL_RIGHTING_TOLERANCE, 1 + LATERAL_RIGHTING_TOLERANCE,
            'the lumbar counter-bend is solved per side; a single averaged angle left this at 1.095' );

    }

    gate( 'pendulum lateral head / COM', layer.headPerCentreOfMassLateral,
        1 - LATERAL_RIGHTING_TOLERANCE, 1 + LATERAL_RIGHTING_TOLERANCE,
        'a rigid rotation would give 1.674 — the pendulum carries 16-29% of frames when the pose saturates' );

    note( 'lumbar righting, pendulum (deg per deg of lean)', layer.lateralRightingPerRadian.toFixed( 3 ),
        'solved by secant against the ratio above, not set as a fraction of the overshoot' );
    note( 'lumbar righting, contrapposto (deg at blend 1)',
        `${ ( layer.trunkRightingRadians.left * 180 / Math.PI ).toFixed( 2 ) } / ` +
        `${ ( layer.trunkRightingRadians.right * 180 / Math.PI ).toFixed( 2 ) }`,
        'left / right; the pose files are asymmetric on purpose so these differ' );

    stack.dispose();

    const rmsRatios = [];
    const peakRatios = [];
    const correlations = [];
    const neckGains = [];
    const headPerCentreOfMass = [];
    const headOnCentreOfMassSlopes = [];

    console.log( '' );
    console.log( '        seed   head/pelvis RMS   head/pelvis p2p   r(head-on-neck, neck)   ' +
        'neck gain   head/COM RMS' );

    for ( const trace of traces ) {

        const relative = lateralDisplacements( trace );
        const { head, neck, pelvis, centreOfMass } = relative;

        // The head's position relative to the neck is what the head-on-neck rotation produces, and
        // it is the only part of the head's motion the neck can be said to stabilise.
        const headOnNeck = head.map( ( value, index ) => value - neck[ index ] );

        const rmsRatio = rootMeanSquare( head ) / rootMeanSquare( pelvis );
        const peakRatio = peakToPeak( head ) / peakToPeak( pelvis );
        const correlation = pearson( headOnNeck, neck );
        const neckGain = regressionSlope( neck, headOnNeck );
        const headOverCom = rootMeanSquare( head ) / rootMeanSquare( centreOfMass );

        rmsRatios.push( rmsRatio );
        peakRatios.push( peakRatio );
        correlations.push( correlation );
        neckGains.push( neckGain );
        headPerCentreOfMass.push( headOverCom );
        headOnCentreOfMassSlopes.push( regressionSlope( centreOfMass, head ) );

        console.log( `  ${ String( trace.seed ).padStart( 10 ) }   ${ rmsRatio.toFixed( 4 ).padStart( 15 ) }   ` +
            `${ peakRatio.toFixed( 4 ).padStart( 15 ) }   ${ correlation.toFixed( 4 ).padStart( 21 ) }   ` +
            `${ neckGain.toFixed( 4 ).padStart( 9 ) }   ${ headOverCom.toFixed( 4 ).padStart( 12 ) }` );

    }

    console.log( '' );

    // 🎯 THE GATE THE 0.30 EXPERIMENT NEEDED, and the one that would have caught it whatever had
    // caused it. Both directions, because the head lands ON the centre of mass — not at most on it.
    gate( 'head / COM lateral RMS, lowest seed', Math.min( ...headPerCentreOfMass ),
        1 - HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE, 1 + HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE,
        'a head parked in space scores 0.18-0.25 here; a rigid pendulum scores 1.674' );
    gate( 'head / COM lateral RMS, highest seed', Math.max( ...headPerCentreOfMass ),
        1 - HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE, 1 + HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE, '' );

    // Amplitude is not tracking: a head carrying independent noise of exactly the right size passes
    // the ratio above and fails this one.
    gate( 'slope of head on COM, lowest seed', Math.min( ...headOnCentreOfMassSlopes ),
        1 - HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE, 1 + HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE,
        'the head must move WITH the centre of mass, not merely as far' );
    gate( 'slope of head on COM, highest seed', Math.max( ...headOnCentreOfMassSlopes ),
        1 - HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE, 1 + HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE, '' );

    gate( 'head / pelvis lateral RMS, worst seed', Math.max( ...rmsRatios ),
        PELVIS_LEADS_FLOOR, PELVIS_LEADS_CEILING,
        'pelvis-leads. The judge measured 1.34 on screen; this layer alone measured 1.02 before the fix' );

    gate( 'head / pelvis lateral RMS, lowest seed', Math.min( ...rmsRatios ),
        PELVIS_LEADS_FLOOR, PELVIS_LEADS_CEILING,
        'the floor half: a head that has stopped moving is not a head that leads less' );

    gate( 'head / pelvis lateral peak-to-peak, worst seed', Math.max( ...peakRatios ),
        PELVIS_LEADS_FLOOR, PELVIS_LEADS_CEILING,
        'the peaks are where the pendulum fallback lived, and the peaks are what a viewer sees' );

    gate( 'head / pelvis lateral peak-to-peak, lowest seed', Math.min( ...peakRatios ),
        PELVIS_LEADS_FLOOR, PELVIS_LEADS_CEILING, '' );

    measureHeadOnNeckWhereTheReflexLives( correlations, neckGains );

    note( 'head / COM range', `${ Math.min( ...headPerCentreOfMass ).toFixed( 4 ) } to ` +
        `${ Math.max( ...headPerCentreOfMass ).toFixed( 4 ) }`,
        `the target is 1.0 exactly — LATERAL_HEAD_PER_CENTRE_OF_MASS — realised by the frame loop` );

}

/**
 * 🎯 THE HEAD-ON-NECK CLAIM, MOVED TO THE REGIME IT IS ENTITLED TO SPEAK FOR — §1.7e, again, and
 * this file has now paid for that lesson twice.
 *
 * WHAT THE CLAIM IS. A judge measured, on a render, "head-on-neck motion adds to the trunk lean
 * instead of cancelling it, r = +0.10", and this gate exists to make that measurable offline. The
 * statistic is the head JOINT's position relative to the NECK joint against the neck's own
 * displacement — which is produced entirely by the neck bone's rotation, since the head bone is not
 * in `SWAY_CHAIN`.
 *
 * 🚩 WHY IT MOVED. Head stabilisation in this layer is a NECK give-back of `HEAD_STABILISATION`
 * applied to the pendulum's lean, and it lives on the pendulum path alone. The contrapposto parks
 * the head by TRANSLATING it — that is what `LATERAL_SHIFT_COUPLE` summing to zero means — so on
 * the contrapposto path there is no head-on-neck rotation to have a sign, only the pose's own
 * authored neck angle and whatever the solve leaves behind. Measured over the shipped composite the
 * correlation runs -0.94 to +0.20 and the gain -0.041 to +0.005: small, and signed by whichever
 * process happened to dominate that seed.
 *
 * ⚠️ AND IT USED TO READ -0.97 TO -0.999 ON THE COMPOSITE, WHICH IS WHY THIS WAS NOT NOTICED. Under
 * a righting spread that did NOT sum to zero, the contrapposto's net girdle rotation — 0.2 x a
 * 9.4 degree righting, about 1.9 degrees — counter-rolled the head as a SIDE EFFECT and dominated
 * the statistic. The gate was green because of an artefact of the spread, not because the reflex was
 * doing anything on that path. Taking the girdle rotation to zero took the mask off. That is §1.7e
 * exactly: a gate stated on a composite silently asserts one mechanism on two paths.
 *
 * SO IT IS GATED WHERE THE PENDULUM RUNS ALONE, and there it is not marginal — it is
 * **-1.0000 on every seed**, gain -0.0975 to -0.0979, because on that path the neck give-back is the
 * only thing between the trunk and the head. The composite is printed beside it, always.
 *
 * ⚠️ AND WHAT IS NO LONGER COVERED, SAID OUT LOUD RATHER THAN QUIETLY DROPPED. Nothing now gates the
 * SIGN of the head-on-neck residue on the contrapposto path. What does cover that path is
 * `LATERAL_HEAD_PER_CENTRE_OF_MASS`: head over centre-of-mass lateral RMS is gated at 1.000 +- 0.05
 * and measures 0.991-1.013, and the bind-time solve residual is gated at 1.000 +- 0.010. A head that
 * leaned further than the trunk would fail those before it failed this. A head that leaned the same
 * distance by a slightly different internal route would not — and no gate in this file would see it.
 */
function measureHeadOnNeckWhereTheReflexLives( compositeCorrelations, compositeGains ) {

    const pendulum = SWAY_SEEDS.map( ( seed ) =>
        traceSway( seed, HEAD_ON_NECK_REGIME_SECONDS, { stanceBlendEnabled: false } ) );

    const correlations = [];
    const gains = [];

    for ( const trace of pendulum ) {

        const { head, neck } = lateralDisplacements( trace );
        const headOnNeck = head.map( ( value, index ) => value - neck[ index ] );

        correlations.push( pearson( headOnNeck, neck ) );
        gains.push( regressionSlope( neck, headOnNeck ) );

    }

    note( 'composite r(head-on-neck, neck) over 12 seeds',
        `${ Math.min( ...compositeCorrelations ).toFixed( 3 ) } to ${ Math.max( ...compositeCorrelations ).toFixed( 3 ) }`,
        `gain ${ Math.min( ...compositeGains ).toFixed( 4 ) } to ${ Math.max( ...compositeGains ).toFixed( 4 ) } — ` +
        'RECORDED, not gated: the contrapposto parks the head by translating it, so on that path the ' +
        'residue has no required sign. See this function\'s header' );

    gate( 'head-on-neck vs neck, PENDULUM regime, worst correlation', Math.max( ...correlations ), -1, 0,
        `negative on EVERY seed: the head-on-neck rotation must oppose the trunk, not add to it. ` +
        `Measured ${ Math.min( ...correlations ).toFixed( 4 ) } to ${ Math.max( ...correlations ).toFixed( 4 ) } ` +
        `over ${ HEAD_ON_NECK_REGIME_SECONDS } s per seed` );

    // 🚩 The correlation above awards a parked head -1.000, its best possible mark. This is the
    // amount, which is the part a scale-free statistic cannot carry.
    gate( 'head-on-neck gain, PENDULUM regime, weakest seed', Math.max( ...gains ),
        HEAD_ON_NECK_GAIN_BAND[ 0 ], HEAD_ON_NECK_GAIN_BAND[ 1 ],
        'slope, not sign: 0 is no righting at all and -1 is a head held still in space' );

    gate( 'head-on-neck gain, PENDULUM regime, strongest seed', Math.min( ...gains ),
        HEAD_ON_NECK_GAIN_BAND[ 0 ], HEAD_ON_NECK_GAIN_BAND[ 1 ], '' );

    return { correlations, gains };

}

/**
 * The lateral displacement of the markers the head-parking gates relate to each other, all measured
 * from the same rest pose so they are comparable, plus the figure's own realised centre of mass.
 *
 * 🚩 The centre of mass is already a DISPLACEMENT — `traceSway` stores it relative to the rest
 * centre of mass — and the marker samples are absolute world positions. Subtracting the rest
 * position from the markers is what puts all four in the same frame. RMS is blind to the offset and
 * the ratio gates would not have noticed, but the regression slopes would have, and a helper that
 * returns three of four series in one frame and the fourth in another is a trap for the next gate
 * written against it.
 */
function lateralDisplacements( trace ) {

    const lateralOf = ( key ) => trace.samples.get( key )
        .map( ( point ) => point.x - trace.restPositions.get( key ).x );

    return {
        head: lateralOf( 'head' ),
        neck: lateralOf( 'neck' ),
        pelvis: lateralOf( 'pelvis' ),
        centreOfMass: Array.from( trace.signals.realisedMedioLateral )
    };

}

/**
 * 🎯 CAN A VIEWER SEE A POSTURAL EVENT? The gate the judge's third finding needs, and the one this
 * file could not have had, because every rate here counted events the SIMULATION fired.
 *
 * The relay fires at 1.51 a minute and the event-rate gates above are green. A blind judge watched
 * seven minutes and read THREE postural events — 0.43 a minute. Both numbers are right, and the gap
 * between them is the whole finding: a rate gate counts what the model does and a viewer counts what
 * the SCREEN does, and nothing here had ever measured the second.
 *
 * Measured over 90 minutes, at the constants the judge watched:
 *
 *   the balance band alone moves the pelvis  3.7 mm RMS   <- the background an event must beat
 *   the median relayed event moved it       11.4 mm       <- three times it, and the judge missed it
 *   the excursion matching the judge's count ~20 mm       <- about 5.5x the background
 *   the timeline spent mid-fidget            2.5%         <- 1.2/min x 1.4 s
 *
 * 🚩 TWO SEPARATE CAUSES, AND ONLY ONE OF THEM IS AMPLITUDE. 78% of relays are fidgets, they carried
 * half a shift's amplitude on an assumption the source paper contradicts, and they lasted 1.4 s —
 * so the figure was mid-fidget for one frame in forty. A judge sampling the timeline expects to
 * catch about one of those in seven minutes AT ANY SIZE. Both constants are fixed, both
 * are argued from Duarte's own wording rather than dialled, and the two fixes attack different
 * halves of the problem: see FIDGET_AMPLITUDE_FRACTION_OF_SHIFT and FIDGET_DURATION_SECONDS.
 *
 * ⚠️ AND THE PART THAT CANNOT BE FIXED WITHOUT CONTRADICTING THE PAPER, RECORDED RATHER THAN TUNED
 * AWAY — the same shape as the antero-posterior composite shortfall above. Punch-list 2.9 asks for
 * 1–1.5 posture shifts a minute. That is CASSELL'S CONVERSATIONAL rate, and this layer delivers it
 * through `markDiscourseBoundary()`, which a silent idle never calls. Duarte's *sustained* lateral
 * shift — the pattern a viewer reads as "it changed its stance" — fires at 0.30/min, which is 2.1 in
 * seven minutes. The judge read 3. **The model was not under-firing; the gate was counting a
 * different quantity from the one being watched.** Raising the sustained rate to 1.5/min would mean
 * five times Duarte's measured interval.
 *
 * So what is gated here is the part that IS ours to get right: an event that fires must be big
 * enough and last long enough to be seen.
 */
function measureEventLegibility() {

    section( 'LEGIBILITY — not whether an event fired, but whether it could be seen' );

    // Cached module-side so THE OTHER WAY can quote the shipped numbers beside the known-bad ones
    // without paying for the measurement twice; it is six 420 s traces.
    measuredLegibility = legibilityOf( LEGIBILITY_SEEDS, {} );

    const measured = measuredLegibility;

    note( 'balance-band pelvis RMS (mm)', measured.backgroundMm.toFixed( 2 ),
        'the background, measured on { weightShiftsEnabled: false } rather than assumed' );
    note( 'relayed events', `${ measured.count } over ${ measured.minutes.toFixed( 0 ) } min`,
        `${ ( measured.count / measured.minutes ).toFixed( 3 ) }/min` );
    note( 'peak pelvis excursion (mm)',
        `p25 ${ measured.quantile( 0.25 ).toFixed( 1 ) }  median ${ measured.quantile( 0.5 ).toFixed( 1 ) }` +
        `  p75 ${ measured.quantile( 0.75 ).toFixed( 1 ) }  p90 ${ measured.quantile( 0.9 ).toFixed( 1 ) }`,
        'per relayed event, over its own duration' );
    note( 'rate past the judge\'s own threshold (/min)',
        measured.ratePastMultiple( JUDGE_DETECTION_MULTIPLE ).toFixed( 3 ),
        `${ JUDGE_DETECTION_MULTIPLE }x background is where the count matches the 3 events it read in 7 minutes` );

    gate( 'median event / background', measured.medianMultiple,
        LEGIBLE_EVENT_MULTIPLE, Infinity,
        'the typical event must be several times the sway it is supposed to stand out from' );

    gate( 'legible events per minute', measured.ratePastMultiple( LEGIBLE_EVENT_MULTIPLE ),
        LEGIBLE_EVENT_RATE_PER_MINUTE, Infinity,
        'a postural event a viewer cannot see does not count as one' );

    gate( 'fraction of the timeline mid-fidget (%)', measured.dutyPercent,
        FIDGET_DUTY_CYCLE_PERCENT, Infinity,
        'an event that is not on screen when a viewer looks cannot be seen at any amplitude' );

}

/**
 * The legibility measurement itself, over a set of seeds and one layer configuration.
 *
 * Separated from the gates so THE OTHER WAY can run the identical measurement on the constants the
 * judge actually watched. §1.1 — a gate that has never failed is not known to work, and a
 * legibility gate is exactly the kind that can be written to pass by construction.
 */
function legibilityOf( seeds, options ) {

    const background = [];
    const excursions = [];
    let fidgetFrames = 0;
    let totalFrames = 0;

    for ( const seed of seeds ) {

        // The background is MEASURED, not assumed: the same layer with the weight-shift process off
        // is exactly the trace an event has to stand out from.
        const quiet = traceSway( seed, LEGIBILITY_SECONDS, { ...options, weightShiftsEnabled: false } );
        const quietPelvis = quiet.samples.get( 'pelvis' ).map( ( point ) => point.x );

        background.push( rootMeanSquare( quietPelvis ) * 1000 );

        const { stack, layer, root } = buildStack( seed, options );
        const pelvis = root.getObjectByName( 'pelvis' );
        const relayed = [];

        layer.onWeightShift = ( event ) => relayed.push( { frame: totalFrames, ...event } );

        const frames = Math.round( LEGIBILITY_SECONDS * SAMPLE_RATE_HZ );
        const track = new Float64Array( frames );
        const startFrame = totalFrames;

        for ( let frame = 0; frame < frames; frame ++ ) {

            stack.update( FRAME_SECONDS );
            root.updateMatrixWorld( true );

            track[ frame ] = pelvis.matrixWorld.elements[ 12 ];

            // Time spent mid-fidget, on either axis: the duty cycle a sampling viewer integrates.
            if ( layer.medioLateral.fidgetRemaining > 0 ) fidgetFrames ++;

            totalFrames ++;

        }

        stack.dispose();

        const window = Math.round( LEGIBILITY_WINDOW_SECONDS * SAMPLE_RATE_HZ );

        for ( const event of relayed ) {

            const start = event.frame - startFrame;
            const end = Math.min( start + window, frames );
            let peak = 0;

            for ( let frame = start; frame < end; frame ++ ) {

                peak = Math.max( peak, Math.abs( track[ frame ] - track[ start ] ) );

            }

            excursions.push( peak * 1000 );

        }

    }

    const backgroundMm = median( background );
    const sorted = [ ...excursions ].sort( ( a, b ) => a - b );
    const quantile = ( fraction ) => sorted[ Math.min( sorted.length - 1, Math.floor( fraction * sorted.length ) ) ];
    const minutes = seeds.length * LEGIBILITY_SECONDS / 60;

    return {
        backgroundMm,
        quantile,
        minutes,
        count: excursions.length,
        medianMultiple: quantile( 0.5 ) / backgroundMm,
        dutyPercent: 100 * fidgetFrames / totalFrames,
        ratePastMultiple: ( multiple ) =>
            excursions.filter( ( value ) => value >= multiple * backgroundMm ).length / minutes
    };

}

/**
 * 🎯 THE FEET ARE NOT WELDED. The judge's last finding, and the only one below the ankle.
 *
 * "The feet are pixel-for-pixel identical for 6300 frames." Planting is correct — the sole slides
 * 0.16 mm over fifteen minutes and the section above gates it in millimetres — but a foot with
 * literally zero deformation reads as a boot glued to the floor. The rig has exactly one
 * articulation below the ankle, the metatarsophalangeal joint, and this drives it from unloading.
 *
 * Three claims, and the second is the one that makes this safe to have at all:
 *
 *   THE UNLOADED FOOT'S TOES COME UP, and the loaded foot's do not move. Measured on the SKIN, not
 *   on the bone: the toe joint is the pivot, so it does not move by construction and reading it
 *   would prove nothing.
 *
 *   NOTHING GOES THROUGH THE FLOOR. Extension only, so the toes can only ever move away from it —
 *   which is why the direction was chosen before the amplitude was.
 *
 *   THE PLANTING GATE IS UNTOUCHED. Every marker it follows sits at or behind the pivot, so this
 *   cannot move any of them, and the section above still runs at 0.05 mm of vertical.
 */
function measureToeArticulation() {

    section( 'TOES — the one articulation below the ankle this rig has' );

    const { stack, layer, root } = buildStack( SEED );

    const restToes = toeGeometry( root );
    let loaded = null;
    let peakLift = 0;
    let liftOnLoadedFoot = 0;
    let liftAsymmetry = -Infinity;

    for ( let frame = 0; frame < TOE_TRACE_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        peakLift = Math.max( peakLift, layer.toeLiftRadians.left, layer.toeLiftRadians.right );

        // 🚩 TWO CLAIMS NOW, BECAUSE THERE ARE TWO MECHANISMS AND THEY ARE ENTITLED TO DIFFERENT
        // ASSERTIONS. The LATERAL unload must never lift the loaded foot's toes — that foot is
        // carrying the body and its forefoot has nowhere to go. The FORE-AND-AFT coupling lifts
        // BOTH feet together, correctly: a body leaning back takes the pressure off both forefeet
        // at once, and asserting zero here would be asserting that it does not. What survives as a
        // fact about the lateral mechanism is the ASYMMETRY — the loaded foot may never lift MORE
        // than the free one.
        const loadedLift = layer.stanceBlend > 0 ? layer.toeLiftRadians.left : layer.toeLiftRadians.right;
        const freeLift = layer.stanceBlend > 0 ? layer.toeLiftRadians.right : layer.toeLiftRadians.left;

        liftOnLoadedFoot = Math.max( liftOnLoadedFoot, loadedLift );
        liftAsymmetry = Math.max( liftAsymmetry, loadedLift - freeLift );

        if ( loaded === null && layer.stanceBlend > 0.95 ) {

            loaded = { blend: layer.stanceBlend, toes: toeGeometry( root ) };

        }

    }

    stack.dispose();

    gate( 'peak toe lift (deg)', peakLift * 180 / Math.PI, 0.5, layer.toeLiftDegrees + 0.01,
        'extension at full unload; the constant is a tuning number and this is the realised angle' );

    note( 'toe lift on the LOADED foot (deg)', ( liftOnLoadedFoot * 180 / Math.PI ).toFixed( 3 ),
        'NOT zero any more, and correctly so: the fore-and-aft coupling unloads both forefeet ' +
        'together when the body leans back. The two gates below are what is left of the old claim' );

    gate( 'the loaded foot never lifts MORE than the free one (deg)', liftAsymmetry * 180 / Math.PI, -1e9, 1e-9,
        'a foot carrying the load has its toes pressed flatter than the one that is not' );

    gate( 'the LATERAL mechanism alone lifts no loaded toe (deg)',
        lateralOnlyLoadedToeLiftDegrees(), 0, 1e-9,
        'measured with `toeCopLiftEnabled: false`, which is the claim this gate always made' );

    if ( loaded === null ) {

        gate( 'the trace reached a full weight transfer', 0, 1, 1,
            'no frame in the window loaded a leg; nothing below can be measured' );
        return;

    }

    note( 'measured at blend', loaded.blend.toFixed( 3 ), 'weight on the left leg, so the right foot unloads' );

    const freeRise = ( loaded.toes.right.lowest - restToes.right.lowest ) * 1000;
    const stanceRise = Math.abs( loaded.toes.left.lowest - restToes.left.lowest ) * 1000;

    gate( 'unloaded toe geometry rises (mm)', freeRise, TOE_LIFT_FLOOR_MM, Infinity,
        'measured on skinned vertices forward of the metatarsal head, not on the joint' );

    // 🚩 THE SAME NUMBER IN THE UNIT THE DEFECT WAS JUDGED IN, printed rather than gated, because it
    // does not clear the floor and saying so is the point. LEARNINGS §1.10b: an amplitude stated in
    // a unit nobody can picture will pass every review it is given. This gate is honest, precise and
    // green, and a millimetre of rise is 0.66 px at the framing every capture in this project is
    // taken at — inside the 0.48-10.6 px bracket at its invisible end, and only 1.4x the 0.48 px a
    // blind judge reported as "the hands never move". The toe lift is a real motion authored down
    // where nothing this project owns says it is visible, and the FREE FOOT section holds the claim
    // it cannot.
    note( 'the same rise, in pixels', ( freeRise * fullBodyFraming().pixelsPerMillimetre ).toFixed( 2 ),
        `against the ${ FREE_FOOT_TRAVEL_FLOOR_PIXELS } px articulation floor — the toe lift alone ` +
        'does not reach it, and the gate above cannot see that' );

    // ⚠️ Measured with the fore-and-aft coupling OFF. With it on this is not a planting claim any
    // more — a loaded forefoot legitimately rises when the body leans back — and it would be
    // measuring the new mechanism rather than the constraint. The constraint that still applies to
    // BOTH mechanisms is `nothing is driven below the floor`, immediately below.
    gate( 'loaded toe geometry does not move (mm)', lateralOnlyLoadedToeRiseMillimetres(),
        0, PLANTED_VERTICAL_LIMIT_MM,
        'the same tolerance the planting section uses, with `toeCopLiftEnabled: false`' );

    gate( 'nothing is driven below the floor (mm)',
        Math.min( loaded.toes.left.lowest, loaded.toes.right.lowest ) * 1000,
        Math.min( restToes.left.lowest, restToes.right.lowest ) * 1000 - PLANTED_VERTICAL_LIMIT_MM, Infinity,
        'extension only: the toes can leave the floor and can never enter it. The allowance is the ' +
        'planting section\'s own 0.05 mm, because the loaded foot still rides the lean' );

}

/**
 * 🎯 THE ARTICULATION GATE FOR THE FEET. Does a foot move enough for a viewer to see it?
 *
 * Stated in pixels of silhouette travel at the framing every capture in this project is taken at,
 * because that is the question, and because the units the layer was authored in — a millimetre of
 * rise at one vertex, 2.5 degrees at a metatarsal head — are what let a foot band whose outer-to-
 * outer extent had a standard deviation of 0.00 px pass the section above it. See
 * FREE_FOOT_TRAVEL_FLOOR_PIXELS.
 *
 * Three assertions, each catching a different way of being wrong:
 *
 *   FREE-FOOT TRAVEL, in pixels, ON BOTH FEET — the defect itself, and the half of it that a
 *     one-sided measurement cannot see.
 *   LOADED-FOOT TRAVEL, in the same pixels, with a CEILING — the foot carrying the body must stay
 *     put, and this is the direction it is easy to buy travel in dishonestly.
 *   OUTER-TO-OUTER EXTENT — the exact statistic the verifier measured on 4200 rendered frames and
 *     found dead. Gated here so the number in the report and the number in the gate are the same
 *     number.
 *
 * 🎯 MEASURED ON THE TOE REGION, which is this rig's fingertip. Tried the whole foot band first and
 * it was the wrong instrument in both directions at once: the worst-moving vertex of the band is up
 * at the ankle collar, whose skin is part-weighted to the shank and therefore moves 2.6 px on a foot
 * that is doing nothing at all, while the band's extreme silhouette edge sits on the side of a
 * toed-out foot and under-reads a pivot by half. Forward of the metatarsal head — the same band
 * `toeGeometry` uses — is where a foot's articulation actually shows and where a 4x crop looks.
 */
function measureFreeFootArticulation() {

    section( 'FREE FOOT — silhouette travel in pixels at full-body framing' );

    const framing = fullBodyFraming();

    note( 'full-body framing (mm / px per mm)',
        `${ framing.framedHeightMillimetres.toFixed( 0 ) } / ${ framing.pixelsPerMillimetre.toFixed( 4 ) }`,
        `measured stature x ${ BODY_FRAME_MARGIN } margin over a ${ FULL_BODY_CAPTURE_PIXELS } px capture, ` +
        `camera ${ CAMERA_AZIMUTH_DEGREES } degrees off axis; alive.js and LEARNINGS Part 3` );

    const shipped = freeFootTravelPixels( {}, framing );

    if ( shipped.reachedBothTransfers === false ) {

        gate( 'the trace loaded each leg in turn', 0, 1, 1,
            `${ FREE_FOOT_SECONDS } s did not contain a full transfer both ways; nothing below means anything` );
        return;

    }

    console.log( '        foot   released yaw(deg)   free toe(px)   loaded toe(px)' );

    for ( const side of [ 'left', 'right' ] ) {

        console.log( `  ${ side.padStart( 10 ) }   ${ shipped.yawDegrees[ side ].toFixed( 2 ).padStart( 14 ) }   ` +
            `${ shipped.free[ side ].toFixed( 3 ).padStart( 12 ) }   ` +
            `${ shipped.loaded[ side ].toFixed( 3 ).padStart( 13 ) }` );

    }

    console.log( '' );

    note( 'outer-to-outer extent (px)',
        `${ shipped.extentAtRest.toFixed( 1 ) } at rest, range ${ shipped.extentRangePixels.toFixed( 3 ) }`,
        'the verifier measured this at sd 0.00 px over 4200 frames and called the feet welded' );

    gate( 'free-foot toe travel (px, worse foot)', Math.min( shipped.free.left, shipped.free.right ),
        FREE_FOOT_TRAVEL_FLOOR_PIXELS, 40,
        'BOTH feet: the toe lift alone scores 1.89 px and, in the 420 s the judge watched, only ever ' +
        'fired on one of them' );

    gate( 'loaded-foot toe travel (px, worse foot)', Math.max( shipped.loaded.left, shipped.loaded.right ),
        0, PLANTED_HORIZONTAL_LIMIT_MM * framing.pixelsPerMillimetre,
        'the foot carrying the body stays put — the planting limit, in the same pixels' );

    gate( 'the two feet articulate alike (ratio)',
        Math.min( shipped.free.left, shipped.free.right ) / Math.max( shipped.free.left, shipped.free.right ),
        0.5, 1.0,
        'the poses are deliberately asymmetric, not asymmetric by a factor: an unmirrored hips yaw ' +
        'in weight-right.json scored 0.16 here' );

    gate( 'outer-to-outer extent range (px)', shipped.extentRangePixels,
        SILHOUETTE_WIDTH_FLOOR_PIXELS, 40,
        'the statistic the verifier measured; a silhouette whose width never changes reads as one object' );

}

/**
 * Known-bad input for the gate above, and the strongest form of LEARNINGS §1.1 available here: the
 * known-bad is THE CODE AS IT SHIPPED.
 *
 * Two configurations, because the round before this one fixed half the defect and the gate has to
 * reject both halves. `freeFootYawRelease: 0` alone is the layer exactly as the verifier measured it
 * — the toe lift running, everything else welded. Adding `toeLiftDegrees: 0` is the foot before the
 * toe lift existed at all, which is the state the visual judge originally reported.
 */
function measureFreeFootTheOtherWay( framing ) {

    const shipped = freeFootTravelPixels( { freeFootYawRelease: 0 }, framing );
    const welded = freeFootTravelPixels( { freeFootYawRelease: 0, toeLiftDegrees: 0 }, framing );

    note( 'toe lift alone, free toe travel (px)',
        `${ shipped.free.left.toFixed( 3 ) } / ${ shipped.free.right.toFixed( 3 ) }`,
        'the layer as the verifier measured it: 2.5 degrees of toe extension and nothing else' );

    gate( 'the pixel gate REJECTS the toe lift alone',
        Math.min( shipped.free.left, shipped.free.right ) < FREE_FOOT_TRAVEL_FLOOR_PIXELS ? 1 : 0, 1, 1,
        '1 means the gate caught it; 0 means a foot the judge called welded would pass' );

    // ⚠️ REJECTED BY 1.6x AND NOT MORE, AND THAT IS THE POINT RATHER THAN A WEAKNESS. The toe lift
    // is a real motion authored at half the floor; it is the marginal case, which is exactly why it
    // took a judge with a 4x crop rather than a gate to find it. The welded foot below is the one
    // that has to fail by orders of magnitude.
    note( 'rejection margin, toe lift alone (floor / measured)',
        ( FREE_FOOT_TRAVEL_FLOOR_PIXELS / Math.min( shipped.free.left, shipped.free.right ) ).toFixed( 2 ),
        'the marginal known-bad; a real motion authored below the floor' );

    gate( 'the extent gate REJECTS it too',
        shipped.extentRangePixels < SILHOUETTE_WIDTH_FLOOR_PIXELS ? 1 : 0, 1, 1,
        `outer-to-outer range ${ shipped.extentRangePixels.toFixed( 3 ) } px against a ${ SILHOUETTE_WIDTH_FLOOR_PIXELS } px floor` );

    gate( 'rejection margin, welded foot (floor / measured)',
        FREE_FOOT_TRAVEL_FLOOR_PIXELS / Math.max( welded.free.left, welded.free.right, 1e-6 ), 3, 1e9,
        'the fully welded foot, which must fail by a wide margin rather than by a whisker' );

    gate( 'the sole-tilt gate still REJECTS a tilted sole',
        tiltedSoleIsRejected() ? 1 : 0, 1, 1,
        'the tilt measurement was rewritten this round to ignore yaw; it must still see a real tilt' );

    reportFreeLimbSwivelForTheJudge();

}

/**
 * 🎯 WHICH WAY THE FREE KNEE TURNS — MEASURED ON THE MESH, IN NO FRAME AT ALL.
 *
 * This replaces a report that had the direction backwards for a round, and the reason is worth
 * keeping because it is §1.7 in miniature. The old measurement read the y term of
 * `restWorld⁻¹ · currentWorld` — a delta expressed in the BONE's own rest frame — and compared it
 * against `relaxed-standing.json`'s `leftUpperLeg` `y = +9.56`, which is authored in the NORMALISED
 * rig. `thigh_l`'s local +Y points DOWN in world (0.017, -0.997, 0.078), so the two `+y` are
 * ANTIPARALLEL and the comparison inverted the answer. The header then wrote "the free knee turns
 * OUT" over pose files that say, in words, that the swivel *"moves the knee 14.3 mm toward the
 * midline"*.
 *
 * An Euler angle needs a frame and a convention; **a direction does not**. So the quantity here is
 * where the patella POINTS: the world-space vector from the knee joint to the centroid of the
 * patella patch — the frontmost quarter of the knee band, chosen once at rest and then followed.
 * Its horizontal bearing is compared against the same bearing at rest, and "medial" is decided by
 * which way the midline lies from that leg. Nothing in it can be inverted by a convention.
 *
 * Both directions are gated, because both are facts and only one of them used to be:
 *   - the FREE knee turns MEDIALLY, by the amount the pose files author;
 *   - the LOADED knee does not turn at all.
 *
 * ⚠️ WHAT IS STILL FOR EYES, and it is narrower than it was: whether twelve degrees of medial
 * femoral rotation reads as a relaxed leg letting go or as knock-kneed. §1.9 — a gate file that
 * quietly omits the thing it cannot measure is hiding its blind spots.
 */
function reportFreeLimbSwivelForTheJudge() {

    const facing = freeKneeFacingDegrees();

    console.log( '' );
    console.log( '  FREE-LIMB SWIVEL — where the patella POINTS, in world degrees. Positive is' );
    console.log( '  toward +X, the character\'s LEFT. Measured on the mesh, so no frame convention' );
    console.log( '  can invert it — which the Euler version this replaced did, for a whole round.' );
    console.log( '' );
    console.log( '        state                 left knee   right knee' );
    console.log( `        rest                  ${ facing.rest.left.toFixed( 2 ).padStart( 9 ) }   ${ facing.rest.right.toFixed( 2 ).padStart( 10 ) }` );

    for ( const [ label, table ] of [ [ 'LEFT leg free ', facing.leftFree ], [ 'RIGHT leg free', facing.rightFree ] ] ) {

        if ( table === null ) { console.log( `        ${ label }        never reached in ${ FREE_FOOT_SECONDS } s` ); continue; }

        console.log( `        ${ label }        ${ table.left.toFixed( 2 ).padStart( 9 ) }   ${ table.right.toFixed( 2 ).padStart( 10 ) }` );

    }

    console.log( '' );
    console.log( '  FOR THE JUDGE — look at the FREE KNEECAP at full transfer against the same frame' );
    console.log( '  at rest. The direction is settled and the pose files own it: the free knee drifts' );
    console.log( '  IN, toward the stance leg. Does twelve degrees of that read as a relaxed leg, or' );
    console.log( '  as knock-kneed? Only eyes decide that half.' );
    console.log( '' );

    if ( facing.leftFree === null || facing.rightFree === null ) {

        gate( 'the trace loaded each leg in turn', 0, 1, 1,
            `${ FREE_FOOT_SECONDS } s did not contain a full transfer both ways` );
        return;

    }

    // Medial for the LEFT leg is a decreasing bearing (toward the midline at +X→0); for the RIGHT
    // leg it is an increasing one. Signing it here means the gate reads the same for both sides.
    const freeMedial = {
        left: -( facing.leftFree.left - facing.rest.left ),
        right: facing.rightFree.right - facing.rest.right
    };

    gate( 'the FREE knee turns MEDIALLY (deg, both sides)',
        Math.min( freeMedial.left, freeMedial.right ),
        FREE_KNEE_MEDIAL_SWIVEL_FLOOR_DEGREES, FREE_KNEE_MEDIAL_SWIVEL_CEILING_DEGREES,
        'weight-right.json: the swivel "moves the knee 14.3 mm toward the midline". A NEGATIVE ' +
        'number here is the direction this file asserted, wrongly, for a round' );

    const loadedTurn = Math.max(
        Math.abs( facing.leftFree.right - facing.rest.right ),
        Math.abs( facing.rightFree.left - facing.rest.left ) );

    gate( 'the LOADED knee does not swivel (deg)', loadedTurn, 0, 3.0,
        'the free knee turns 10-12 degrees; the leg carrying the body must not follow it' );

}

/**
 * The lateral toe mechanism ON ITS OWN, which is what the two planting claims above are about.
 *
 * Run separately rather than read off the shipped trace, because the shipped trace has both
 * mechanisms in it and a number taken from it would be a measurement of their sum. §1.11a: check
 * which quantity the evidence covers.
 *
 * Returns the worst toe-lift angle the loaded foot ever gets from the lateral mechanism, in
 * degrees. Must be exactly zero: `unloadFractionOf` clamps at zero for the loaded side.
 */
function lateralOnlyLoadedToeLiftDegrees() {

    const { stack, layer, root } = buildStack( SEED, { toeCopLiftEnabled: false } ); // eslint-disable-line no-unused-vars

    let worst = 0;

    for ( let frame = 0; frame < TOE_TRACE_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );

        worst = Math.max( worst,
            layer.stanceBlend > 0 ? layer.toeLiftRadians.left : layer.toeLiftRadians.right );

    }

    stack.dispose();

    return worst * 180 / Math.PI;

}

/** The same run, as the rise of the loaded foot's own toe geometry at the first full transfer. */
function lateralOnlyLoadedToeRiseMillimetres() {

    const { stack, layer, root } = buildStack( SEED, { toeCopLiftEnabled: false } );

    root.updateMatrixWorld( true );

    const rest = toeGeometry( root );

    for ( let frame = 0; frame < TOE_TRACE_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );

        if ( layer.stanceBlend <= 0.95 ) continue;

        root.updateMatrixWorld( true );

        const rise = Math.abs( toeGeometry( root ).left.lowest - rest.left.lowest ) * 1000;

        stack.dispose();

        return rise;

    }

    stack.dispose();

    return 0;

}

/**
 * 🎯 THE FEET, IN THE STATISTIC THE DEFECT IS STATED IN — a SLIDING-WINDOW MEDIAN, not a range.
 *
 * 🚩 THIS SECTION EXISTS BECAUSE THE FREE-FOOT GATE ABOVE IS GREEN AND THE FEET STILL READ AS
 * WELDED, AND BOTH OF THOSE ARE TRUE AT ONCE. That gate measures the travel between quiet standing
 * and a full weight transfer — a whole-clip RANGE — and a range cannot see a distribution
 * (LEARNINGS §1.11, §1.14). Measured on the shipped layer before the change this section gates, at
 * seed 1 over 420 s at 30 Hz: the foot band's whole-clip range is 1.7-3.5 px and the MEDIAN inside
 * a 15 s window is **0.074-0.223 px**, a factor of twenty-five apart, with every one of the top
 * extreme frames inside a single 1.5-second window at t = 211. `heatmap.mjs` said the same thing
 * from the other side: 96.9% of the pixels in rows 1100-1199 sit below sigma 0.5 in both clips.
 *
 * ⚠️ TWO STATISTICS, AND THE DIFFERENCE BETWEEN THEM IS THE FINDING RATHER THAN A DETAIL.
 *
 *   HORIZONTAL is what `travel.mjs` reports and what the defect was measured in. It is carried
 *   almost entirely by the free foot's yaw release, and that release is QUADRATIC in the load
 *   transfer — `resolvePlantedRotation` takes a fraction `unload` of a chain yaw that is itself
 *   proportional to the blend. |stanceBlend| swings 0.213 in a median 15 s window and 0.213² is
 *   0.045, so the horizontal signal is dead outside a transfer by construction. This round did NOT
 *   fix that; see the recorded shortfall below.
 *
 *   RESULTANT adds the vertical, which is where the toes live, and it is what a viewer's eye
 *   actually lands on. It is the statistic the fore-and-aft toe coupling moves, and it is gated.
 *
 * Per VERTEX rather than per centroid, for the reason the free-foot section already argued: a foot
 * pivoting about its own ankle swings its heel one way and its toe the other and its centroid
 * barely at all. The window's score is its worst-moving vertex; the section's score is the median
 * over windows.
 */
function measureFootBandArticulation() {

    section( 'FOOT BAND — the median travel inside a 15 s window, in pixels' );

    const framing = fullBodyFraming();
    const shipped = footBandTravel( {}, framing );

    console.log( '' );
    console.log( `  band ${ shipped.lowMillimetres.toFixed( 0 ) } to ${ shipped.highMillimetres.toFixed( 0 ) } mm about the floor, ` +
        `${ shipped.vertexCount } vertices at stride ${ GLANCE_VERTEX_STRIDE }, ${ shipped.windowCount } windows` );
    console.log( '' );
    console.log( '        statistic                  15 s median   worst window   whole clip' );

    for ( const [ label, key ] of [ [ 'worst vertex, resultant', 'resultant' ], [ 'worst vertex, horizontal', 'horizontal' ] ] ) {

        console.log( `        ${ label.padEnd( 24 ) }   ${ shipped[ key ].median.toFixed( 3 ).padStart( 11 ) }   ` +
            `${ shipped[ key ].worstWindow.toFixed( 3 ).padStart( 12 ) }   ${ shipped[ key ].wholeClip.toFixed( 3 ).padStart( 10 ) }` );

    }

    console.log( '' );

    // 🚩 THE HEADLINE. The whole-clip range over the median: a body that articulates its feet only
    // during a weight transfer scores enormously here, and a body that articulates them all the
    // time scores near 1. This is the number the FREE FOOT section's range statistic could not
    // produce, and it is the one that says whether the gate above is measuring a spike.
    note( 'range / median, resultant',
        ( shipped.resultant.wholeClip / shipped.resultant.median ).toFixed( 1 ),
        'the spike ratio. 25.2 on the lateral mechanism alone; 1 would be a foot that never stops' );

    // 🎯 THE HORIZONTAL FIRST, because it is the channel `travel.mjs` reports and therefore the
    // channel every verdict on this defect has ever been taken in. See the constants' header.
    gate( 'foot band, 15 s median HORIZONTAL travel (px)', shipped.horizontal.median,
        FOOT_BAND_HORIZONTAL_FLOOR_PIXELS, GLANCE_TRAVEL_CEILING_PIXELS,
        'per vertex, the statistic travel.mjs measures. The yaw release is the only mechanism that ' +
        'can move a foot in it' );

    gate( 'foot band, 15 s median resultant travel (px)', shipped.resultant.median,
        FOOT_BAND_MEDIAN_FLOOR_PIXELS, GLANCE_TRAVEL_CEILING_PIXELS,
        'horizontal plus the toe lift\'s vertical; no capture instrument in this repo reports it' );

    // 🚩 RECORDED AS A GATE, NOT TOLERATED — §1.11 and §1.14a. This used to say "shortfall against
    // the 1.6 px floor", and there is no such floor: 1.6 px comes from a block PROGRESS marks
    // superseded and its two halves disagree by 1.85x. The shortfall is now stated against the one
    // number this project owns at the LEGIBLE end of its bracket — 10.6 px of pelvis excursion,
    // which a blind judge counted as an event — and it is asserted with a CEILING so that closing it
    // fails this gate and forces the sentence to be rewritten rather than quietly ageing.
    gate( 'shortfall against the legible end of the bracket (x)',
        JUDGE_REPORTED_LEGIBLE_PIXELS / shipped.horizontal.median, 1.0, 14.0,
        `recorded, not tolerated: ${ shipped.horizontal.median.toFixed( 3 ) } px horizontal against the ` +
        `${ JUDGE_REPORTED_LEGIBLE_PIXELS } px a judge COUNTED. A planted foot pivoting about its own ` +
        'ankle cannot reach that — closing it needs a foot that is REPOSITIONED, not one that turns' );

    gate( 'and it clears the invisible end (x)',
        shipped.horizontal.median / JUDGE_REPORTED_INVISIBLE_PIXELS, 1.0, 30.0,
        `${ shipped.horizontal.median.toFixed( 3 ) } px against the ${ JUDGE_REPORTED_INVISIBLE_PIXELS } px ` +
        'a judge reported as "the hands never move". This is the weaker of the two claims and the ' +
        'only one the evidence supports' );

    measureFootBandTheOtherWay( framing, shipped );

}

/**
 * §1.1, three states this gate must reject, each one a real configuration rather than a model of
 * one. The first is THE CODE AS IT SHIPPED LAST ROUND.
 */
function measureFootBandTheOtherWay( framing, shipped ) {

    const proportional = footBandTravel( { freeFootBreakawayBlend: 1 }, framing );
    const lateralOnly = footBandTravel( { toeCopLiftEnabled: false }, framing );
    const noToes = footBandTravel( { toeCopLiftEnabled: false, toeLiftDegrees: 0 }, framing );
    const welded = footBandTravel( { toeCopLiftEnabled: false, toeLiftDegrees: 0, freeFootYawRelease: 0 }, framing );

    console.log( '' );
    console.log( '        configuration                     horizontal   vertical   resultant   range / median' );

    for ( const [ label, report ] of [
        [ 'as shipped', shipped ],
        [ 'proportional release (last round)', proportional ],
        [ 'lateral toe mechanism alone', lateralOnly ],
        [ 'no toe articulation at all', noToes ],
        [ 'welded — no yaw release either', welded ]
    ] ) {

        console.log( `        ${ label.padEnd( 33 ) }   ${ report.horizontal.median.toFixed( 3 ).padStart( 10 ) }   ` +
            `${ report.vertical.median.toFixed( 3 ).padStart( 8 ) }   ` +
            `${ report.resultant.median.toFixed( 3 ).padStart( 9 ) }   ` +
            `${ ( report.resultant.wholeClip / Math.max( report.resultant.median, 1e-9 ) ).toFixed( 1 ).padStart( 14 ) }` );

    }

    console.log( '' );

    // 🎯 ATTRIBUTION BY TOGGLE, on the channel the verdict is taken in. `freeFootBreakawayBlend: 1`
    // reproduces the proportional release EXACTLY — min(unload/1,1) is unload — so this is the layer
    // as it shipped last round and not a model of it.
    gate( 'the breakaway is what moved the horizontal (x)',
        shipped.horizontal.median / proportional.horizontal.median,
        FOOT_BAND_RELEASE_ATTRIBUTION_FLOOR, 20,
        `${ shipped.horizontal.median.toFixed( 3 ) } px with it against ` +
        `${ proportional.horizontal.median.toFixed( 3 ) } with the release proportional to the load` );

    gate( 'the horizontal gate REJECTS the proportional release',
        proportional.horizontal.median < FOOT_BAND_HORIZONTAL_FLOOR_PIXELS ? 1 : 0, 1, 1,
        'the state that shipped last round, whose articulation was the SQUARE of the load transfer' );

    // 🚩 AND THE SAME KNOWN-BAD ON THE RESULTANT, WHERE IT IS NEARLY INVISIBLE. Recorded as a gate
    // because it is the reason the horizontal is now the headline: the resultant moves 1.5x between
    // these two states and the horizontal moves 3.7x, so a reviewer reading only the resultant would
    // have called this round's fix marginal.
    gate( 'the RESULTANT would barely have shown it (x)',
        shipped.resultant.median / proportional.resultant.median, 1.0, 2.0,
        `recorded, not tolerated: ${ shipped.resultant.median.toFixed( 3 ) } against ` +
        `${ proportional.resultant.median.toFixed( 3 ) } on the resultant, where the horizontal moves ` +
        `${ ( shipped.horizontal.median / proportional.horizontal.median ).toFixed( 2 ) }x` );

    // ATTRIBUTION BY TOGGLE. The fore-and-aft coupling is the only difference between these two
    // runs, so whatever the ratio is, it is that mechanism's and nothing else's.
    //
    // ⚠️ IT MOVED FROM THE RESULTANT TO THE VERTICAL THIS ROUND, AND NOT BECAUSE THE RESULTANT WAS
    // INCONVENIENT. A resultant is a hypotenuse: it can only resolve a vertical mechanism while the
    // horizontal leg is small. The trunk-articulation change raised the free foot's HORIZONTAL travel
    // from 1.013 to 1.329 px — the yaw release fires on more frames now that the stance blend runs
    // larger — and the same toe coupling that used to show as 1.91x on the resultant now shows as
    // 1.081x, because it is 0.118 px of vertical added in quadrature to a 1.33 px horizontal. The
    // mechanism did not weaken; the statistic stopped being able to see it. §1.14: a floor and a
    // measurement must be the same KIND of quantity, and the toes are a VERTICAL quantity.
    gate( 'the fore-and-aft toe coupling is what moved the VERTICAL (x)',
        shipped.vertical.median / lateralOnly.vertical.median,
        FOOT_BAND_COP_ATTRIBUTION_FLOOR, 20,
        `${ shipped.vertical.median.toFixed( 3 ) } px with it against ` +
        `${ lateralOnly.vertical.median.toFixed( 3 ) } without. On the RESULTANT the same toggle is now ` +
        `${ ( shipped.resultant.median / lateralOnly.resultant.median ).toFixed( 3 ) }x` );

    gate( 'the VERTICAL gate REJECTS a foot with no toe articulation',
        noToes.vertical.median < FOOT_BAND_VERTICAL_FLOOR_PIXELS ? 1 : 0, 1, 1,
        `${ noToes.vertical.median.toFixed( 3 ) } px vertical against a ` +
        `${ FOOT_BAND_VERTICAL_FLOOR_PIXELS } floor and the shipped ${ shipped.vertical.median.toFixed( 3 ) }` );

    // 🚩 RECORDED, NOT TOLERATED: the resultant floor this clause used to be stated on no longer
    // rejects the same known-bad. Asserted so that the loss of cover is on the report rather than in
    // a commit message, and so that anyone restating the toe claim on the resultant sees this first.
    gate( 'seeds where the RESULTANT floor would still catch a foot with no toes',
        noToes.resultant.median < FOOT_BAND_MEDIAN_FLOOR_PIXELS ? 1 : 0, 0, 0,
        `recorded, not tolerated: ${ noToes.resultant.median.toFixed( 3 ) } px against a ` +
        `${ FOOT_BAND_MEDIAN_FLOOR_PIXELS } floor — a foot with no toe articulation at all now clears ` +
        'the resultant floor on the horizontal channel alone' );

    gate( 'and REJECTS a welded foot on both channels',
        ( welded.horizontal.median < FOOT_BAND_HORIZONTAL_FLOOR_PIXELS
            && welded.resultant.median < FOOT_BAND_MEDIAN_FLOOR_PIXELS ) ? 1 : 0, 1, 1,
        `${ welded.horizontal.median.toFixed( 3 ) } horizontal, ${ welded.resultant.median.toFixed( 3 ) } resultant` );

    // 🚩 THE BAND HAS A FLOOR IT CANNOT GO BELOW, AND IT IS 0.374 PX RATHER THAN ZERO. A foot with
    // no toes, no yaw release and nothing else to do still travels, because the whole body leans
    // about a pivot and the planting correction pins the ankle JOINT rather than every vertex of
    // the foot. So the honest statement is not "the welded foot fails the floor by 3x" — the floor
    // would have to be 1.12 px for that and the shipped layer measures 0.903 — it is that the
    // shipped layer OUT-TRAVELS a welded one by a stated ratio.
    //
    // ⚠️ That ratio is 2.4x, and it is small. Recorded plainly: this band's whole dynamic range
    // between welded and articulated is a factor of two and a half, which is why the section leans
    // on the range/median spike ratio as well and why the floor above is where it is.
    note( 'the band cannot go below (px)', welded.resultant.median.toFixed( 3 ),
        'a welded foot still rides the lean; the planting correction pins the ankle joint, not the ' +
        'geometry around it' );

    gate( 'shipped out-travels a welded foot (x)',
        shipped.resultant.median / Math.max( welded.resultant.median, 1e-6 ),
        FOOT_BAND_WELDED_SEPARATION, 1e9,
        'the band\'s whole dynamic range, and it is narrow — see the note above' );

    // 🚩 RECORDED AS A GATE, §1.3 and §1.11. The range statistic the FREE FOOT section is stated on
    // passes the welded-plus-toes case comfortably; the median does not. Asserted so that nobody
    // restates this claim on a range again.
    gate( 'a whole-clip RANGE would NOT have caught it (px)', lateralOnly.resultant.wholeClip,
        FREE_FOOT_TRAVEL_FLOOR_PIXELS, 1e3,
        `recorded, not tolerated: the same trace whose 15 s median is ${ lateralOnly.resultant.median.toFixed( 3 ) } px ` +
        `has a whole-clip range of ${ lateralOnly.resultant.wholeClip.toFixed( 2 ) } px, over the ${ FREE_FOOT_TRAVEL_FLOOR_PIXELS } px range floor` );

}

/**
 * Per-vertex screen travel of the foot band, as a median over 15 s windows.
 *
 * The vertex set is chosen ONCE in the rest pose and then followed by index, for the reason the
 * patella patch is: a per-frame "which vertices are in the band" set is a different set every frame
 * and the difference between two different sets is not a motion.
 */
function footBandTravel( options, framing ) {

    const { stack, root } = buildStack( FREE_FOOT_SEED, options ); // eslint-disable-line no-unused-vars

    root.updateMatrixWorld( true );

    const bounds = new Box3().setFromObject( root );
    const floor = bounds.min.y;
    const statureMetres = bounds.max.y - floor;

    const band = GLANCE_BANDS.find( ( entry ) => entry.name === 'foot' );
    const framedTop = ( 1 - 1 / BODY_FRAME_MARGIN ) / 2;
    const toHeight = ( fraction ) => 1 - ( fraction - framedTop ) * BODY_FRAME_MARGIN;
    const low = toHeight( band.bottom );
    const high = toHeight( band.top );

    const vertex = new Vector3();
    const sets = [];
    let vertexCount = 0;

    root.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        const position = object.geometry.attributes.position;
        const found = [];

        for ( let index = 0; index < position.count; index += GLANCE_VERTEX_STRIDE ) {

            vertex.fromBufferAttribute( position, index );
            object.applyBoneTransform( index, vertex );
            object.localToWorld( vertex );

            const height = ( vertex.y - floor ) / statureMetres;

            if ( height < low || height > high ) continue;

            found.push( index );

        }

        if ( found.length > 0 ) { sets.push( { mesh: object, position, found } ); vertexCount += found.length; }

    } );

    const frames = Math.round( FOOT_BAND_SECONDS * GLANCE_SAMPLE_RATE_HZ );
    const screenX = new Float64Array( frames * vertexCount );
    const screenY = new Float64Array( frames * vertexCount );

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( 1 / GLANCE_SAMPLE_RATE_HZ );
        root.updateMatrixWorld( true );

        let slot = frame * vertexCount;

        for ( const set of sets ) {

            for ( const index of set.found ) {

                vertex.fromBufferAttribute( set.position, index );
                set.mesh.applyBoneTransform( index, vertex );
                set.mesh.localToWorld( vertex );

                screenX[ slot ] = vertex.dot( framing.screenRight ) * 1000 * framing.pixelsPerMillimetre;
                screenY[ slot ] = vertex.y * 1000 * framing.pixelsPerMillimetre;
                slot ++;

            }

        }

    }

    stack.dispose();

    return {
        vertexCount,
        lowMillimetres: low * statureMetres * 1000,
        highMillimetres: high * statureMetres * 1000,
        windowCount: Math.max( Math.floor( ( frames - GLANCE_WINDOW_SECONDS * GLANCE_SAMPLE_RATE_HZ ) / GLANCE_SAMPLE_RATE_HZ ) + 1, 0 ),
        resultant: worstVertexTravel( screenX, screenY, frames, vertexCount, 'resultant' ),
        horizontal: worstVertexTravel( screenX, screenY, frames, vertexCount, 'horizontal' ),
        vertical: worstVertexTravel( screenX, screenY, frames, vertexCount, 'vertical' )
    };

}

/**
 * The worst single vertex's travel inside each 15 s window, reduced to a median, a worst window and
 * a whole-clip range. The last two are carried so that the section can PRINT the disagreement
 * between a range and a median rather than assert it.
 */
function worstVertexTravel( screenX, screenY, frames, vertexCount, channel ) {

    const width = GLANCE_WINDOW_SECONDS * GLANCE_SAMPLE_RATE_HZ;
    const step = GLANCE_SAMPLE_RATE_HZ;
    const windows = [];

    const spanIn = ( from, to, vertexIndex ) => {

        let lowX = Infinity;
        let highX = -Infinity;
        let lowY = Infinity;
        let highY = -Infinity;

        for ( let frame = from; frame < to; frame ++ ) {

            const slot = frame * vertexCount + vertexIndex;

            if ( screenX[ slot ] < lowX ) lowX = screenX[ slot ];
            if ( screenX[ slot ] > highX ) highX = screenX[ slot ];
            if ( screenY[ slot ] < lowY ) lowY = screenY[ slot ];
            if ( screenY[ slot ] > highY ) highY = screenY[ slot ];

        }

        if ( channel === 'horizontal' ) return highX - lowX;
        if ( channel === 'vertical' ) return highY - lowY;

        return Math.hypot( highX - lowX, highY - lowY );

    };

    for ( let start = 0; start + width <= frames; start += step ) {

        let worst = 0;

        for ( let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex ++ ) {

            worst = Math.max( worst, spanIn( start, start + width, vertexIndex ) );

        }

        windows.push( worst );

    }

    let wholeClip = 0;
    for ( let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex ++ ) {

        wholeClip = Math.max( wholeClip, spanIn( 0, frames, vertexIndex ) );

    }

    windows.sort( ( a, b ) => a - b );

    return {
        median: windows[ Math.floor( windows.length / 2 ) ] ?? 0,
        worstWindow: windows[ windows.length - 1 ] ?? 0,
        wholeClip
    };

}

/**
 * The patella patch: the frontmost quarter of a 60 mm knee band, per leg, chosen ONCE in the rest
 * pose and then followed by index.
 *
 * Chosen at rest rather than per frame because a per-frame "frontmost" set is a different set of
 * vertices every frame, and the difference between two different sets is not a motion. Same shape
 * as §1.10a: pick the statistic that follows the same material through the clip.
 */
function patellaPatch( root ) {

    const kneeHeight = {
        left: new Vector3().setFromMatrixPosition( root.getObjectByName( 'calf_l' ).matrixWorld ).y,
        right: new Vector3().setFromMatrixPosition( root.getObjectByName( 'calf_r' ).matrixWorld ).y
    };

    const vertex = new Vector3();
    const sets = [];

    root.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        const position = object.geometry.attributes.position;
        const found = { left: [], right: [] };

        for ( let index = 0; index < position.count; index ++ ) {

            vertex.fromBufferAttribute( position, index );
            object.applyBoneTransform( index, vertex );
            object.localToWorld( vertex );

            const side = vertex.x >= 0 ? 'left' : 'right';

            if ( Math.abs( vertex.y - kneeHeight[ side ] ) > PATELLA_BAND_HALF_HEIGHT_METRES ) continue;

            found[ side ].push( { index, forward: vertex.z } );

        }

        if ( found.left.length + found.right.length > 0 ) sets.push( { mesh: object, ...found } );

    } );

    // +Z is anterior on this rig, so the frontmost quarter of the band IS the kneecap.
    for ( const side of [ 'left', 'right' ] ) {

        const all = sets.flatMap( ( set, meshIndex ) => set[ side ].map( ( entry ) => ( { ...entry, meshIndex } ) ) )
            .sort( ( a, b ) => b.forward - a.forward );

        const keep = new Set( all.slice( 0, Math.round( PATELLA_PATCH_FRACTION * all.length ) )
            .map( ( entry ) => `${ entry.meshIndex }:${ entry.index }` ) );

        sets.forEach( ( set, meshIndex ) => {
            set[ side ] = set[ side ]
                .filter( ( entry ) => keep.has( `${ meshIndex }:${ entry.index }` ) )
                .map( ( entry ) => entry.index );
        } );

    }

    return sets;

}

/** The horizontal bearing of `knee joint -> patella centroid`, in degrees. +ve is toward +X. */
function patellaBearingDegrees( sets, root, side ) {

    const vertex = new Vector3();
    const centroid = new Vector3();
    let count = 0;

    for ( const set of sets ) {

        const position = set.mesh.geometry.attributes.position;

        for ( const index of set[ side ] ) {

            vertex.fromBufferAttribute( position, index );
            set.mesh.applyBoneTransform( index, vertex );
            set.mesh.localToWorld( vertex );
            centroid.add( vertex );
            count ++;

        }

    }

    const joint = new Vector3().setFromMatrixPosition(
        root.getObjectByName( side === 'left' ? 'calf_l' : 'calf_r' ).matrixWorld );

    centroid.divideScalar( count ).sub( joint );

    return Math.atan2( centroid.x, centroid.z ) * 180 / Math.PI;

}

/** Patella bearing for both knees, at rest and at the first full transfer in each direction. */
function freeKneeFacingDegrees() {

    const { stack, layer, root } = buildStack( FREE_FOOT_SEED );

    root.updateMatrixWorld( true );

    const patch = patellaPatch( root );
    const snapshot = () => ( {
        left: patellaBearingDegrees( patch, root, 'left' ),
        right: patellaBearingDegrees( patch, root, 'right' )
    } );

    const rest = snapshot();

    let leftFree = null;
    let rightFree = null;

    for ( let frame = 0; frame < FREE_FOOT_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );

        if ( leftFree !== null && rightFree !== null ) break;
        if ( layer.stanceBlend > -0.95 && layer.stanceBlend < 0.95 ) continue;

        root.updateMatrixWorld( true );

        if ( layer.stanceBlend <= -0.95 && leftFree === null ) leftFree = snapshot();
        if ( layer.stanceBlend >= 0.95 && rightFree === null ) rightFree = snapshot();

    }

    stack.dispose();

    return { rest, leftFree, rightFree };

}

/**
 * The full-body framing, measured off this GLB. One place, because three gates convert into it and
 * a second opinion about the scale would make two of them silently disagree.
 */
function fullBodyFraming() {

    const stature = new Box3().setFromObject( figure.root );
    const framedHeightMillimetres = ( stature.max.y - stature.min.y ) * BODY_FRAME_MARGIN * 1000;
    const azimuth = CAMERA_AZIMUTH_DEGREES * Math.PI / 180;

    return {
        framedHeightMillimetres,
        pixelsPerMillimetre: FULL_BODY_CAPTURE_PIXELS / framedHeightMillimetres,
        screenRight: new Vector3( Math.cos( azimuth ), 0, -Math.sin( azimuth ) )
    };

}

/**
 * How far each foot's own skinned silhouette travels on screen, in pixels, between quiet standing
 * and a full weight transfer OFF it — and, for the same two configurations, how far it travels when
 * the transfer is ON to it.
 *
 * Measured per vertex rather than on a centroid or an area, because those are the statistics that
 * average a real motion away: a foot pivoting about its own ankle moves its heel one way and its toe
 * the other, and its centroid barely at all. The worst-moving vertex of the band is what a viewer's
 * eye lands on and what a 4x crop shows.
 *
 * The two poses are found by running the layer rather than by forcing a blend, because a blend that
 * is never reached is not a behaviour. `reachedBothTransfers` says so if the window was too short.
 */
function freeFootTravelPixels( options, framing ) {

    const { stack, layer, root } = buildStack( FREE_FOOT_SEED, options );

    root.updateMatrixWorld( true );

    const band = footBandVertices( root );
    const rest = sampleFootBand( band, framing );

    // A positive blend loads the LEFT leg, so it is the right foot that is free at that moment.
    let leftFree = null;
    let rightFree = null;

    const yawDegrees = { left: 0, right: 0 };

    for ( let frame = 0; frame < FREE_FOOT_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );

        for ( const side of [ 'left', 'right' ] ) {

            yawDegrees[ side ] = Math.max(
                yawDegrees[ side ], Math.abs( layer.footYawRadians[ side ] ) * 180 / Math.PI );

        }

        if ( leftFree !== null && rightFree !== null ) continue;
        if ( layer.stanceBlend > -0.95 && layer.stanceBlend < 0.95 ) continue;

        root.updateMatrixWorld( true );

        if ( layer.stanceBlend >= 0.95 && rightFree === null ) rightFree = sampleFootBand( band, framing );
        if ( layer.stanceBlend <= -0.95 && leftFree === null ) leftFree = sampleFootBand( band, framing );

    }

    stack.dispose();

    if ( leftFree === null || rightFree === null ) return { reachedBothTransfers: false };

    // Each snapshot names the foot that is FREE in it, so the other foot in the same snapshot is the
    // one carrying the body — which is where the loaded-foot ceiling comes from, at no extra cost.
    const extents = [ rest.extentPixels, leftFree.extentPixels, rightFree.extentPixels ];

    return {
        reachedBothTransfers: true,
        yawDegrees,
        free: {
            left: worstToeTravel( rest, leftFree, 'left' ),
            right: worstToeTravel( rest, rightFree, 'right' )
        },
        loaded: {
            left: worstToeTravel( rest, rightFree, 'left' ),
            right: worstToeTravel( rest, leftFree, 'right' )
        },
        extentAtRest: rest.extentPixels,
        extentRangePixels: Math.max( ...extents ) - Math.min( ...extents )
    };

}

/**
 * Every skinned vertex at or below ankle height, split by side and tagged for whether it lies
 * forward of that foot's metatarsal head — the foot, definitionally, and the same two rules
 * `Sway.js` used to read this figure's footprint and `toeGeometry` uses to find its toes.
 *
 * Resolved once at rest and then followed by index, so the travel measurement compares each vertex
 * against itself rather than against whichever vertex happens to be on the silhouette that frame.
 */
function footBandVertices( root ) {

    const ankle = {
        left: new Vector3().setFromMatrixPosition( root.getObjectByName( 'foot_l' ).matrixWorld ),
        right: new Vector3().setFromMatrixPosition( root.getObjectByName( 'foot_r' ).matrixWorld )
    };

    const ball = {
        left: new Vector3().setFromMatrixPosition( root.getObjectByName( 'ball_l' ).matrixWorld ),
        right: new Vector3().setFromMatrixPosition( root.getObjectByName( 'ball_r' ).matrixWorld )
    };

    const ankleHeight = Math.max( ankle.left.y, ankle.right.y );
    const vertex = new Vector3();
    const sets = [];

    root.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        const position = object.geometry.attributes.position;
        const found = { left: { indices: [], toe: [] }, right: { indices: [], toe: [] } };

        for ( let index = 0; index < position.count; index ++ ) {

            vertex.fromBufferAttribute( position, index );
            object.applyBoneTransform( index, vertex );
            object.localToWorld( vertex );

            if ( vertex.y > ankleHeight ) continue;

            const side = vertex.x >= 0 ? 'left' : 'right';

            found[ side ].indices.push( index );
            found[ side ].toe.push( vertex.z >= ball[ side ].z );

        }

        if ( found.left.indices.length + found.right.indices.length > 0 ) {

            sets.push( { mesh: object, left: found.left, right: found.right } );

        }

    } );

    return sets;

}

/** Every tracked vertex's screen position this frame, in pixels, in the order it was resolved in. */
function sampleFootBand( band, framing ) {

    const vertex = new Vector3();
    const sample = { left: [], right: [], toe: { left: [], right: [] } };

    let minimum = Infinity;
    let maximum = -Infinity;

    for ( const { mesh, left, right } of band ) {

        const position = mesh.geometry.attributes.position;

        for ( const [ side, set ] of [ [ 'left', left ], [ 'right', right ] ] ) {

            set.indices.forEach( ( index, order ) => {

                vertex.fromBufferAttribute( position, index );
                mesh.applyBoneTransform( index, vertex );
                mesh.localToWorld( vertex );

                const x = vertex.dot( framing.screenRight ) * 1000 * framing.pixelsPerMillimetre;
                const y = vertex.y * 1000 * framing.pixelsPerMillimetre;

                sample[ side ].push( x, y );
                sample.toe[ side ].push( set.toe[ order ] );

                minimum = Math.min( minimum, x );
                maximum = Math.max( maximum, x );

            } );

        }

    }

    sample.extentPixels = maximum - minimum;

    return sample;

}

/**
 * The largest screen displacement any one TOE vertex of that foot underwent between two poses.
 *
 * The worst vertex rather than a centroid or an area, because those are the statistics that average
 * a real motion away: a foot pivoting about its own ankle carries its heel one way and its toe the
 * other, and its centroid barely at all.
 */
function worstToeTravel( from, to, side ) {

    let worst = 0;

    for ( let index = 0; index < from.toe[ side ].length; index ++ ) {

        if ( from.toe[ side ][ index ] !== true ) continue;

        worst = Math.max( worst, Math.hypot(
            to[ side ][ 2 * index ] - from[ side ][ 2 * index ],
            to[ side ][ 2 * index + 1 ] - from[ side ][ 2 * index + 1 ] ) );

    }

    return worst;

}

/**
 * Drives one foot into a real tilt and asks whether the rewritten sole-tilt measurement still sees
 * it. §1.1, aimed at the instrument rather than at the layer: the measurement was changed this round
 * to stop counting a yaw as a tilt, and a measurement relaxed in one direction has to be shown still
 * to bite in the other.
 */
function tiltedSoleIsRejected() {

    restoreRestPose();

    const foot = figure.root.getObjectByName( 'foot_l' );
    const inBoneFrame = soleNormalInBoneFrame( foot, new Vector3() );

    // A degree of roll about the rig's forward axis: a sole lifting its outer border off the floor.
    foot.quaternion.multiply( new Quaternion().setFromAxisAngle( new Vector3( 0, 0, 1 ), Math.PI / 180 ) );
    figure.root.updateMatrixWorld( true );

    const tilt = angleBetweenVectorsDegrees( soleNormalOf( foot, inBoneFrame, new Vector3() ), WORLD_UP );

    restoreRestPose();
    figure.root.updateMatrixWorld( true );

    return tilt > SOLE_TILT_LIMIT_DEGREES;

}

/** The lowest skinned vertex of each foot forward of its metatarsal head, in world metres. */
function toeGeometry( root ) {

    const ball = {
        left: new Vector3().setFromMatrixPosition( root.getObjectByName( 'ball_l' ).matrixWorld ),
        right: new Vector3().setFromMatrixPosition( root.getObjectByName( 'ball_r' ).matrixWorld )
    };

    const result = { left: { lowest: Infinity }, right: { lowest: Infinity } };
    const vertex = new Vector3();

    root.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        const position = object.geometry.attributes.position;

        for ( let index = 0; index < position.count; index ++ ) {

            vertex.fromBufferAttribute( position, index );
            object.applyBoneTransform( index, vertex );
            object.localToWorld( vertex );

            const side = vertex.x >= 0 ? 'left' : 'right';

            // Forward of the metatarsal head and below the ankle: the toes, and nothing else.
            if ( vertex.z < ball[ side ].z || vertex.y > ball[ side ].y + TOE_BAND_HEIGHT_METRES ) continue;

            result[ side ].lowest = Math.min( result[ side ].lowest, vertex.y );

        }

    } );

    return result;

}

/**
 * 🎯 AN ANALYTIC ORACLE ON THE SHIFT AMPLITUDE DRAW, AND THE DEFECT IT REPLACED.
 *
 * Duarte reports his medio-lateral shift amplitude as 22 ± 38 mm. The obvious reading is a
 * gaussian, and that is what `Sway.js` used to draw — `Math.abs( gaussian( 22, 38 ) )`. It is
 * wrong, and measurably so: a gaussian whose standard deviation is nearly twice its mean puts a
 * third of its mass below zero, so FOLDING it produces a mean of 35 mm rather than 22. The layer
 * drew every weight shift 60% too large for as long as that stood, and its own relay report
 * printed the evidence — mean relayed magnitude 1.59 against a distribution that should average
 * 1.0 — without anyone reading it as a defect.
 *
 * An amplitude is a positive quantity, so a standard deviation larger than the mean describes a
 * SKEW rather than a symmetric spread. The lognormal is the standard two-parameter positive
 * distribution and reproduces both reported moments exactly, which is what makes this an oracle:
 * the answer is known before the code runs.
 *
 * Then the same measurement is run THE OTHER WAY. `foldedNormalMean` is the closed form for
 * E|N(mu, sigma)| — the mean the folded gaussian WOULD have produced — computed here from an erf
 * approximation rather than from a number written down by hand. The draw must reproduce Duarte and
 * must be nowhere near that. §1.1: the defect that was just fixed must not come back silently.
 */
function measureAmplitudeDistribution() {

    section( 'AMPLITUDE DISTRIBUTION — the lognormal draw, and the folded gaussian it replaced' );

    const { stack, layer } = buildStack( SEED );

    // 🚩 The oracle draws from a stream of its OWN rather than from the layer's. `drawAmplitude`
    // now takes the process's stream explicitly — each of the four arrival processes owns one, so
    // that a frame rate cannot leak into the draw order — and pouring two hundred thousand draws
    // through a live process stream here would leave the layer somewhere no run would ever put it.
    const oracleRandom = new MotionRandom( SEED );

    for ( const [ axisKey, reportedMean, reportedSd ] of [
        [ 'medioLateral', DUARTE_SHIFT_MEDIO_LATERAL_MM, DUARTE_SHIFT_MEDIO_LATERAL_SD_MM ],
        [ 'anteroPosterior', DUARTE_SHIFT_ANTERO_POSTERIOR_MM, DUARTE_SHIFT_ANTERO_POSTERIOR_SD_MM ]
    ] ) {

        const settings = layer[ axisKey ].settings;
        const draws = new Float64Array( AMPLITUDE_DRAWS );

        for ( let i = 0; i < AMPLITUDE_DRAWS; i ++ ) draws[ i ] = layer.drawAmplitude( settings, oracleRandom ) * 1000;

        const drawnMean = mean( draws );
        const drawnSd = standardDeviation( draws );
        const axis = axisKey === 'medioLateral' ? 'ML' : 'AP';

        // The standard error of a mean is sd/sqrt(n); of a standard deviation on a distribution
        // this skewed it is several times larger, because the fourth moment of a lognormal with
        // sigma = 1.18 is enormous. Two percent and ten percent are those two errors at 3 sigma.
        gate( `${ axis } drawn mean (mm)`, drawnMean, reportedMean * 0.98, reportedMean * 1.02,
            `Duarte ${ reportedMean } mm; ${ AMPLITUDE_DRAWS } draws, +/- 3 standard errors` );
        gate( `${ axis } drawn SD (mm)`, drawnSd, reportedSd * 0.90, reportedSd * 1.10,
            `Duarte ${ reportedSd } mm — the second moment, which a mean-only fit would miss` );
        gate( `${ axis } drawn minimum (mm)`, smallest( draws ), 0, Infinity,
            'a lognormal cannot reach zero, so no floor is needed and none is applied' );

    }

    // THE OTHER WAY. What the folded gaussian would have produced, closed form and measured.
    const foldedClosedForm = foldedNormalMean( DUARTE_SHIFT_MEDIO_LATERAL_MM, DUARTE_SHIFT_MEDIO_LATERAL_SD_MM );
    const foldedDraws = new Float64Array( AMPLITUDE_DRAWS );

    for ( let i = 0; i < AMPLITUDE_DRAWS; i ++ ) {

        foldedDraws[ i ] = Math.abs(
            oracleRandom.gaussian( DUARTE_SHIFT_MEDIO_LATERAL_MM, DUARTE_SHIFT_MEDIO_LATERAL_SD_MM ) );

    }

    const foldedMeasured = mean( foldedDraws );
    const lognormalMean = mean( Float64Array.from( { length: AMPLITUDE_DRAWS },
        () => layer.drawAmplitude( layer.medioLateral.settings, oracleRandom ) * 1000 ) );

    note( 'folded |N(22,38)| mean, closed form (mm)', foldedClosedForm.toFixed( 2 ),
        'sigma*sqrt(2/pi)*exp(-mu^2/2sigma^2) + mu*(1-2*Phi(-mu/sigma))' );

    gate( 'folded gaussian oracle, measured (mm)', foldedMeasured,
        foldedClosedForm * 0.99, foldedClosedForm * 1.01,
        'the oracle checks itself: the draw must reproduce the closed form' );

    gate( 'the draw is NOT the folded gaussian (mm)', foldedClosedForm - lognormalMean,
        0.5 * ( foldedClosedForm - DUARTE_SHIFT_MEDIO_LATERAL_MM ), Infinity,
        `the fixed defect: 35.3 mm drawn where Duarte says ${ DUARTE_SHIFT_MEDIO_LATERAL_MM }` );

    gate( 'folded gaussian would OVERSHOOT Duarte by', foldedClosedForm / DUARTE_SHIFT_MEDIO_LATERAL_MM,
        1.5, 1.7, 'recorded, not tolerated: this is the 60% the layer used to be wrong by' );

    stack.dispose();

}

/**
 * 🎯 THE GATE THIS FILE WAS ORIGINALLY WRITTEN FOR. The pelvis, the knee and the ankle move, and
 * none of them is a mathematical zero.
 *
 * Two claims live here, and the re-rooting split them apart:
 *
 *   THERE IS A LOWER BODY. Total path travelled over 900 s, and the height ordering. Both are
 *   asserted on the DEFAULT layer, because the failure this file was born from — a per-pixel
 *   temporal-sigma heat map that was dead black below the hips, and 0.0000 mm of measured pelvis,
 *   calf and foot path — was a property of the shipped configuration and has to stay gated there.
 *
 *   IT MOVES AS A ROTATION ABOUT THE ANKLES. That is a claim about the PENDULUM, and it has moved
 *   to `measurePendulumGeometry` below, on a pendulum-only layer.
 *
 * 🚩 WHY THE SECOND CLAIM MOVED, because it looks like a gate being relaxed and it is the opposite.
 * A rigid rotation puts a segment's excursion in proportion to its height above the pivot, and the
 * default trace no longer satisfies that — not because the pendulum is wrong, but because the
 * pendulum is no longer what most of the lateral motion IS. The weight shift is delivered as a
 * contrapposto pose blend, and before the re-rooting that blend was capped at 0.20 and contributed
 * almost nothing; it now reaches 1.000. A contrapposto is a pelvis translating over the stance foot
 * with the lumbar spine counter-bending, which moves the knee and the pelvis in proportions that
 * have nothing to do with their height above the ankles. Comparing a composite trace against a
 * pendulum-only prediction is the same category error this whole rewrite exists to remove, so the
 * prediction is tested where it applies — and the tolerance there drops from 25% to 4%.
 *
 * The default-configuration ratios are still PRINTED, per seed, because their departure from the
 * prediction is the contrapposto's own signature and a reader diagnosing this layer wants to see it.
 */
function measureSegmentPaths( traces ) {

    section( `LOWER BODY — segment excursion against the pendulum prediction, ${ TRACE_SECONDS } s` );

    console.log( '        seed   segment      ML_RMS  AP_RMS   ratio  predicted   path(mm)' );

    const ratioBySegment = new Map( SEGMENT_ORDER.map( ( key ) => [ key, [] ] ) );
    const pathBySegment = new Map( SEGMENT_ORDER.map( ( key ) => [ key, [] ] ) );
    const lateralHeadOverPelvis = [];
    let orderingBreaks = 0;

    for ( const trace of traces ) {

        const headRms = resultantRms( trace.samples.get( 'head' ) );
        const excursions = [];

        lateralHeadOverPelvis.push(
            rootMeanSquare( trace.samples.get( 'head' ).map( ( point ) => point.x ) )
            / rootMeanSquare( trace.samples.get( 'pelvis' ).map( ( point ) => point.x ) ) );

        for ( const key of SEGMENT_ORDER ) {

            const track = trace.samples.get( key );

            const mlRms = rootMeanSquare( track.map( ( point ) => point.x ) ) * 1000;
            const apRms = rootMeanSquare( track.map( ( point ) => point.z ) ) * 1000;
            const ratio = resultantRms( track ) / headRms;
            const predicted = trace.geometry.predictedRatio.get( key );

            ratioBySegment.get( key ).push( ratio / predicted );
            pathBySegment.get( key ).push( pathLengthMillimetres( track ) );

            // 🎯 TOTAL PATH, not excursion. What this section claims on the shipped layer is that
            // there IS a lower body and that it moves less the further down the chain you go — the
            // failure it was born from measured 0.0000 mm here. Excursion cannot carry that claim
            // any more: medio-laterally the pelvis now leads the head deliberately, and fore-and-aft
            // the contrapposto swings the free knee forward, so on 3 of 12 seeds the knee out-travels
            // the pelvis. Both are the model being right. The pendulum's own height ordering is
            // asserted where the pendulum runs alone, in measurePendulumGeometry.
            excursions.push( pathLengthMillimetres( track ) );

            console.log( `  ${ String( trace.seed ).padStart( 10 ) }   ${ key.padEnd( 10 ) } ` +
                `${ mlRms.toFixed( 3 ).padStart( 7 ) } ${ apRms.toFixed( 3 ).padStart( 7 ) }  ` +
                `${ ratio.toFixed( 4 ).padStart( 6 ) }  ${ predicted.toFixed( 4 ).padStart( 9 ) }  ` +
                `${ pathLengthMillimetres( track ).toFixed( 1 ).padStart( 9 ) }` );

        }

        // An inverted pendulum orders its segments by height, without exception and on every seed.
        // This is the cheap structural check that survives any retune of the amplitudes.
        for ( let i = 1; i < excursions.length; i ++ ) {

            if ( excursions[ i ] >= excursions[ i - 1 ] ) orderingBreaks ++;

        }

    }

    console.log( '' );

    gate( 'path-length ordering breaks', orderingBreaks, 0, 0,
        'head > pelvis > knee > ankle in total travel, on every seed — a body, not a plank on a hinge' );

    // 🎯 THE OTHER AXIS, AND THE OTHER MECHANISM. Medio-laterally the body loads a hip, the pelvis
    // travels over the stance foot and the lumbar spine counter-bends to park the head over the base
    // of support — so the PELVIS leads and the head must not. A blind visual judge measured 1.34
    // here on the full stack and 1.13 on this layer alone, and every one of the 97 gates in this
    // file was green at the time, because they all measured amplitudes and the defect was a ratio.
    //
    // 🚩 AND IT IS A BAND, not a ceiling. Stated as `0 .. 1.0` this gate scored a head moving 20.6%
    // of the pelvis at 0.206 and passed it — see the header of `measureHeadParked` and
    // PELVIS_LEADS_FLOOR. Pelvis-leads is a claim about ORDER, and order has a bottom.
    gate( 'ML head / pelvis RMS, worst seed', Math.max( ...lateralHeadOverPelvis ),
        PELVIS_LEADS_FLOOR, PELVIS_LEADS_CEILING,
        'pelvis-leads: the hip mechanism moves the pelvis furthest and parks the head' );
    gate( 'ML head / pelvis RMS, lowest seed', Math.min( ...lateralHeadOverPelvis ),
        PELVIS_LEADS_FLOOR, PELVIS_LEADS_CEILING,
        'the head is parked over the base of support, not nailed to the world' );
    note( 'ML head / pelvis RMS, range',
        `${ Math.min( ...lateralHeadOverPelvis ).toFixed( 3 ) }-${ Math.max( ...lateralHeadOverPelvis ).toFixed( 3 ) }`,
        'over 12 seeds x 900 s; the judge measured 1.34 on screen before the head was parked' );

    for ( const key of SEGMENT_ORDER.slice( 1 ) ) {

        const observed = ratioBySegment.get( key );

        // The zero this file exists to catch. Stated as a floor of one millimetre of travel over
        // fifteen minutes, which any real motion clears by three orders of magnitude and a dead
        // bone cannot clear at all.
        gate( `${ key } path over ${ TRACE_SECONDS } s, lowest (mm)`, Math.min( ...pathBySegment.get( key ) ),
            1, Infinity, 'the previous model measured 0.0000 mm here' );

        note( `${ key } ratio / predicted, default layer`,
            `${ Math.min( ...observed ).toFixed( 2 ) }-${ Math.max( ...observed ).toFixed( 2 ) }`,
            'the contrapposto\'s signature; the pendulum prediction is gated on the pendulum below' );

    }

    note( 'peak contrapposto blend', Math.max( ...traces.map( ( trace ) => trace.stanceBlendPeak ) ).toFixed( 3 ),
        'solved from the shift amplitude; STANCE_BLEND_LIMIT is 1.0 and the posture clamp normally binds first' );

}

/**
 * 🎯 IS IT ACTUALLY A ROTATION ABOUT THE ANKLES? Measured on the pendulum alone.
 *
 * A rigid rotation about a pivot puts every segment's excursion in exact proportion to its height
 * above that pivot. The prediction is read off THIS RIG at test time — bone heights, the layer's own
 * pivot, its own ankle share and its own measured head lever — so a segment driven by the wrong
 * pivot, or driven by something that is not a rotation at all, cannot pass. Getting the right answer
 * for the wrong reason fails here.
 *
 * `{ stanceBlendEnabled: false }` is the layer's own documented option for exactly this: it leaves
 * the weight shifts running but delivers them as pendulum lean rather than as a pose blend, so the
 * trace contains one process and the prediction describes one process. §1.5 warns against gating a
 * configuration no consumer would construct, and the warning is respected rather than dodged — every
 * AMPLITUDE claim in this file is stated on `new Sway()`, and so is every claim that the lower body
 * moves at all. What is isolated here is a geometric relationship, which is the one kind of claim
 * that gets sharper rather than weaker when the superposition is taken apart.
 */
function measurePendulumGeometry() {

    section( 'PENDULUM GEOMETRY — segment excursion vs the rigid prediction, contrapposto disabled' );

    console.log( '        seed   segment      ML_RMS  AP_RMS   ratio  predicted  ratio/pred' );

    const observed = new Map( SEGMENT_ORDER.slice( 1 ).map( ( key ) => [ key, [] ] ) );
    const ankleDeviationMm = [];
    let pendulumOrderingBreaks = 0;

    for ( const seed of PENDULUM_SEEDS ) {

        const { stack, layer, root } = buildStack( seed, { stanceBlendEnabled: false } );

        const bones = new Map( SEGMENT_ORDER.map( ( key ) =>
            [ key, root.getObjectByName( MARKERS.find( ( entry ) => entry.key === key ).bone ) ] ) );
        const tracks = new Map( SEGMENT_ORDER.map( ( key ) => [ key, [] ] ) );

        for ( let frame = 0; frame < PENDULUM_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

            stack.update( FRAME_SECONDS );
            root.updateMatrixWorld( true );

            for ( const key of SEGMENT_ORDER ) {

                tracks.get( key ).push( new Vector3().setFromMatrixPosition( bones.get( key ).matrixWorld ) );

            }

        }

        // 🎯 ANTERO-POSTERIOR only. The rigid-rotation prediction is a claim about the axis the
        // inverted pendulum governs; medio-laterally this layer deliberately adds a lumbar
        // counter-bend that parks the head, so a lateral excursion is NOT proportional to height
        // above the pivot and asserting that it is would gate the defect back in.
        const headRms = rootMeanSquare( tracks.get( 'head' ).map( ( point ) => point.z ) );
        const apExcursions = [];

        for ( const key of SEGMENT_ORDER ) {

            const track = tracks.get( key );
            const apRms = rootMeanSquare( track.map( ( point ) => point.z ) );
            const ratio = apRms / headRms;

            apExcursions.push( apRms );
            const predicted = predictedSegmentRatio( layer, worldHeightOfBone( root, bones.get( key ).name ) );

            if ( key !== 'head' ) observed.get( key ).push( ratio / predicted );
            if ( key === 'ankleLeft' ) ankleDeviationMm.push( Math.abs( ratio - predicted ) * headRms * 1000 );

            console.log( `  ${ String( seed ).padStart( 10 ) }   ${ key.padEnd( 10 ) } ` +
                `${ ( rootMeanSquare( track.map( ( p ) => p.x ) ) * 1000 ).toFixed( 3 ).padStart( 7 ) } ` +
                `${ ( apRms * 1000 ).toFixed( 3 ).padStart( 7 ) }  ` +
                `${ ratio.toFixed( 4 ).padStart( 6 ) }  ${ predicted.toFixed( 4 ).padStart( 9 ) }  ` +
                `${ ( ratio / predicted ).toFixed( 4 ).padStart( 10 ) }` );

        }

        for ( let i = 1; i < apExcursions.length; i ++ ) {

            if ( apExcursions[ i ] >= apExcursions[ i - 1 ] ) pendulumOrderingBreaks ++;

        }

        stack.dispose();

    }

    console.log( '' );

    gate( 'AP height ordering breaks', pendulumOrderingBreaks, 0, 0,
        'head > pelvis > knee > ankle fore and aft, every seed — the inverted pendulum\'s signature,' +
        ' asserted where the pendulum runs alone' );

    for ( const key of [ 'pelvis', 'kneeLeft' ] ) {

        gate( `${ key } ratio / predicted, lowest`, Math.min( ...observed.get( key ) ),
            1 - PENDULUM_RATIO_TOLERANCE, 1 + PENDULUM_RATIO_TOLERANCE,
            'measured excursion over the rigid-rotation prediction for its height above the pivot' );
        gate( `${ key } ratio / predicted, highest`, Math.max( ...observed.get( key ) ),
            1 - PENDULUM_RATIO_TOLERANCE, 1 + PENDULUM_RATIO_TOLERANCE, '' );

    }

    // 🚩 THE ANKLE IS GATED IN MILLIMETRES, NOT AS A RATIO, and that is not a softer gate — it is
    // the only honest one at this scale. The layer is actively CANCELLING the ankle's motion: the
    // whole of its vertical arc and the whole of the contrapposto's horizontal travel are taken
    // back out by `writeFootPlanting`, leaving a pendulum arc of about three tenths of a millimetre
    // over fifteen minutes. A ratio taken on a quantity that has been deliberately driven toward
    // zero measures the residue, and the residue swings the ratio between 0.86 and 1.17 while the
    // ABSOLUTE disagreement never exceeds nine hundredths of a millimetre.
    //
    // The limit is anchored on `PIVOT_HEIGHT_FRACTION_OF_ANKLE`'s own comment, which states that the
    // idealisation it makes leaves the ankle a path "of the order of a tenth of a millimetre". Two
    // tenths is that, with room for a differently proportioned figure. What actually protects the
    // ankle is the PLANTED FEET section, which gates its absolute travel against the floor.
    note( 'ankleLeft ratio / predicted',
        `${ Math.min( ...observed.get( 'ankleLeft' ) ).toFixed( 2 ) }-` +
        `${ Math.max( ...observed.get( 'ankleLeft' ) ).toFixed( 2 ) }`,
        'a ratio on a cancelled quantity; the gate below is the same claim in millimetres' );

    gate( 'ankleLeft deviation from prediction (mm)', Math.max( ...ankleDeviationMm ), 0, 0.2,
        'the ankle arc is 0.3 mm and PIVOT_HEIGHT_FRACTION_OF_ANKLE says so; PLANTED FEET owns the rest' );

}

/**
 * The feet. Whatever the body did above them, the soles stayed on the floor and in place.
 *
 * The vertical and horizontal limits are deliberately different. Vertical travel is cancelled
 * exactly at the ankle — a sole that rises off the floor or sinks into it is simply wrong — so it
 * is gated at a twentieth of a millimetre, which is numerical residue. Horizontal travel is NOT
 * fully cancelled: the ankle joint sits slightly above the pendulum's pivot and therefore slides by
 * a tenth of a millimetre as the body rocks, which is inside heel-pad and skin compliance and is
 * the model being honest rather than the model being wrong.
 *
 * ⚠️ THIS SECTION FAILS AS OF THE CENTRE-OF-PRESSURE RE-ROOTING, AND THE LIMITS ARE STAYING WHERE
 * THEY ARE. The cause is measured, not suspected, and it is in `Sway.js` rather than here:
 *
 * `stanceAnkleTravel` scales `stanceResponse[side].ankle` — the pose's ankle travel, probed once at
 * `STANCE_RESPONSE_PROBE_BLEND = 0.50` — LINEARLY by the runtime blend. The contrapposto used to be
 * capped at 0.20, where that extrapolation costs nothing. It now saturates at 1.000, and the ankle
 * path through a slerp between two poses whose hips differ by tens of degrees is not linear in the
 * blend. Blending the poses directly and comparing against the 0.5 probe doubled gives, at blend
 * 1.0, in millimetres:
 *
 *     pose           marker   x        y        z        horizontal
 *     weight-left    foot_r   +0.431   +1.517   -2.053   2.097
 *     weight-left    ball_r   +0.143   +1.521   -2.418   2.422
 *     weight-right   foot_l   -0.054   +2.012   -0.219   0.226
 *
 * Those vertical figures ARE the failures below, to three decimal places — 2.012 mm of lift on the
 * left ankle under a weight-right, 1.517 on the right under a weight-left. The centre-of-mass
 * response really is linear in the blend to 0.3% and the LOOP CLOSURE section confirms it holds at
 * 0.996–1.016, so `STANCE_RESPONSE_PROBE_BLEND`'s comment is right about the quantity it discusses
 * and simply does not cover this one.
 *
 * The fix belongs in `Sway.js`: probe the ankle response at more than one blend, or solve the
 * planting correction against the posed rig rather than against a linearised response.
 */
function measurePlantedFeet( traces ) {

    section( 'PLANTED FEET — no foot IK, so this is the whole safety net' );

    let worstHorizontal = 0;
    let worstVertical = 0;
    let worstTilt = 0;
    let worstToeResidual = 0;
    let worstToeSpan = 0;

    console.log( '        seed   marker       horiz(mm)  vert(mm)' );

    for ( const trace of traces ) {

        for ( const key of PLANTED_MARKERS ) {

            const rest = trace.restPositions.get( key );
            const track = trace.samples.get( key );

            let horizontal = 0;
            let vertical = 0;

            for ( const point of track ) {

                horizontal = Math.max( horizontal, Math.hypot( point.x - rest.x, point.z - rest.z ) );
                vertical = Math.max( vertical, Math.abs( point.y - rest.y ) );

            }

            // 🚩 THE TOE JOINT IS NO LONGER PINNED IN PLACE, AND MUST NOT BE. It rides the free
            // foot's turn-out, so its horizontal travel is a legitimate arc rather than a slide, and
            // asserting it against the ankle's own limit is the assertion that produced the welded
            // foot. What is still true, and is the stronger claim, is measured below: the toe goes
            // exactly where the released yaw says and nowhere else.
            if ( key !== 'toeLeft' && key !== 'toeRight' ) {

                worstHorizontal = Math.max( worstHorizontal, horizontal * 1000 );

            }

            worstVertical = Math.max( worstVertical, vertical * 1000 );

            console.log( `  ${ String( trace.seed ).padStart( 10 ) }   ${ key.padEnd( 10 ) } ` +
                `${ ( horizontal * 1000 ).toFixed( 4 ).padStart( 10 ) }  ` +
                `${ ( vertical * 1000 ).toFixed( 4 ).padStart( 8 ) }` );

        }

        const arc = measureToeArc( trace );

        worstToeResidual = Math.max( worstToeResidual, arc.residualMm );
        worstToeSpan = Math.max( worstToeSpan, arc.spanMm );
        worstTilt = Math.max( worstTilt, trace.soleTiltDegrees );

    }

    console.log( '' );

    gate( 'worst ankle slide (mm)', worstHorizontal, 0, PLANTED_HORIZONTAL_LIMIT_MM,
        'both ankles, every seed, every frame — the free foot pivots ABOUT this point, so it moves ' +
        'no more than the loaded one does' );
    gate( 'worst foot lift (mm)', worstVertical, 0, PLANTED_VERTICAL_LIMIT_MM,
        'ankle and toe: cancelled exactly at the ankle, and a turn about the vertical cannot lift ' +
        'the toe by construction' );
    gate( 'worst sole tilt (deg)', worstTilt, 0, SOLE_TILT_LIMIT_DEGREES,
        'the angle of the SOLE\'S NORMAL from rest. A yaw is not a tilt; see traceSway' );

    note( 'toe arc about the ankle (mm, worst)', worstToeSpan.toFixed( 3 ),
        'how far the released turn-out actually carries the metatarsal head' );

    gate( 'toe travel unexplained by the released yaw (mm)', worstToeResidual, 0,
        PLANTED_YAW_RESIDUAL_LIMIT_MM,
        'the toe minus where a rigid turn about the vertical through its own ankle puts it — a foot ' +
        'that slid, stretched or tilted leaves a residue here and a foot that pivoted leaves none' );

}

/**
 * 🎯 Closes the loop on the one motion below the ankle that is not cancelled.
 *
 * A released turn-out is a rigid rotation of the foot about the vertical axis through its own ankle,
 * and the layer reports the angle it applied. So the toe joint's position is PREDICTABLE, frame by
 * frame, from the ankle's live position and the rest offset between them — and the residue between
 * the prediction and the rig is the gate. It is strictly stronger than the displacement bound it
 * replaced for the toes: a foot that slid 6 mm sideways, or stretched, or tilted, or that applied
 * its neighbour's yaw, all leave a residue, and none of them can hide inside an arc allowance.
 */
function measureToeArc( trace ) {

    const offset = new Vector3();
    const predicted = new Vector3();

    let residualMm = 0;
    let spanMm = 0;

    for ( const [ side, ankleKey, toeKey ] of [
        [ 'left', 'ankleLeft', 'toeLeft' ], [ 'right', 'ankleRight', 'toeRight' ] ] ) {

        const restOffset = new Vector3()
            .copy( trace.restPositions.get( toeKey ) )
            .sub( trace.restPositions.get( ankleKey ) );

        const ankles = trace.samples.get( ankleKey );
        const toes = trace.samples.get( toeKey );
        const yaws = trace.footYaw[ side ];

        for ( let frame = 0; frame < toes.length; frame ++ ) {

            offset.copy( restOffset ).applyAxisAngle( RIG_UP_AXIS, yaws[ frame ] );
            predicted.copy( ankles[ frame ] ).add( offset );

            residualMm = Math.max( residualMm, predicted.distanceTo( toes[ frame ] ) * 1000 );
            spanMm = Math.max( spanMm, offset.distanceTo( restOffset ) * 1000 );

        }

    }

    return { residualMm, spanMm };

}

/**
 * The spectral claim, made seed-robust, and measured on the CENTRE OF PRESSURE.
 *
 * 🎯 TAKEN ON `balanceDisplacement`, FOR THE SAME REASON THE AMPLITUDE GATE IS. Quijoux recorded
 * 60 s of "stand as still as possible" on a force plate, so his spectrum is a spectrum of the
 * BALANCE BAND at the CENTRE OF PRESSURE. The previous version of this file took it on the head's
 * world path over the composite signal, which is wrong twice: the head is the same signal through a
 * constant lever, which does not matter for a frequency but does for the mean-velocity figure at
 * the bottom; and a fidget is a 1.4 s out-and-back whose content sits at about 0.7 Hz, squarely
 * inside the postural band, so the composite carries a process Quijoux's protocol excludes by
 * construction. The layer is still the one a consumer builds — `new Sway()`, everything running —
 * and only the signal read out of it is the quiet-standing one.
 *
 * The frequency mode is the max bin of a Welch periodogram, which has enormous variance even after
 * averaging. Two things keep it meaningful: the statistic is taken as the MEDIAN across seeds,
 * which is how Quijoux's figure was produced in the first place (a median across subjects, not a
 * single recording), and the power-weighted centroid of the postural band is reported alongside as
 * a second, much better-behaved estimator of the same thing.
 */
function measureSpectrum() {

    section( 'POSTURAL BAND — centre-of-pressure spectrum of `new Sway()`, median over seeds' );

    const segment = 2048;
    const medioLateral = [];
    const anteroPosterior = [];
    const meanVelocity = [];

    for ( const seed of SWAY_SEEDS ) {

        const { stack, layer } = buildStack( seed );

        const across = [];
        const fore = [];
        let travelled = 0;
        let previous = null;

        for ( let frame = 0; frame < SPECTRUM_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

            stack.update( FRAME_SECONDS );

            const x = layer.balanceDisplacement.x;
            const z = layer.balanceDisplacement.z;

            across.push( x );
            fore.push( z );

            if ( previous !== null ) travelled += Math.hypot( x - previous.x, z - previous.z );

            previous = { x, z };

        }

        stack.dispose();

        medioLateral.push( welchSpectrum( across, segment ) );
        anteroPosterior.push( welchSpectrum( fore, segment ) );
        meanVelocity.push( travelled * 1000 / SPECTRUM_DURATION_SECONDS );

    }

    console.log( `  ${ SWAY_SEEDS.length } seeds x ${ SPECTRUM_DURATION_SECONDS } s, ` +
        `${ ( SAMPLE_RATE_HZ / segment ).toFixed( 4 ) } Hz FFT bins, ` +
        `statistics taken over the postural band above ${ POSTURAL_BAND_FLOOR_HZ } Hz` );

    for ( const [ axis, spectra, modeLow, modeHigh, source ] of [
        [ 'ML', medioLateral, 0.25, 0.36, 'plate ML 0.33' ],
        [ 'AP', anteroPosterior, 0.22, 0.36, 'plate AP 0.27' ]
    ] ) {

        const modes = spectra.map( ( spectrum ) => spectrum.mode );

        gate( `${ axis } mode, median (Hz)`, median( modes ), modeLow, modeHigh, source );
        note( `${ axis } mode, per-seed spread (Hz)`,
            `${ Math.min( ...modes ).toFixed( 3 ) }-${ Math.max( ...modes ).toFixed( 3 ) }`,
            'a max-bin estimate; this spread is why the gate is on the median' );

        gate( `${ axis } band centroid, median (Hz)`,
            median( spectra.map( ( spectrum ) => spectrum.bandCentroid ) ), 0.35, 0.60,
            'power-weighted centroid, the robust twin of the mode; plate centroidal 0.61-0.66' );

    }

    gate( 'ML f50, median (Hz)', median( medioLateral.map( ( s ) => s.f50 ) ), 0.34, 0.46, 'plate ML 0.43' );
    gate( 'AP f50, median (Hz)', median( anteroPosterior.map( ( s ) => s.f50 ) ), 0.34, 0.46, 'plate AP 0.42' );
    gate( 'ML f95, median (Hz)', median( medioLateral.map( ( s ) => s.f95 ) ), 0.95, 1.30, 'plate ML 1.09' );
    gate( 'AP f95, median (Hz)', median( anteroPosterior.map( ( s ) => s.f95 ) ), 1.05, 1.50, 'plate AP 1.23' );

    // Tail fractions rather than peaks, so they need no median: they are stable seed to seed and
    // the worst case is the number that matters.
    gate( 'ML power > 2 Hz, worst (%)', Math.max( ...medioLateral.map( ( s ) => s.powerAbove2HzPercent ) ), 0, 2,
        'essentially nothing above 2 Hz — faster reads as tremor' );
    gate( 'AP power > 2 Hz, worst (%)', Math.max( ...anteroPosterior.map( ( s ) => s.powerAbove2HzPercent ) ), 0, 2,
        'essentially nothing above 2 Hz — faster reads as tremor' );

    // 🚩 An amplitude-and-frequency statistic in one number, and the one Quijoux reports that no
    // other gate here touches. It now reads about 18 mm/s at the centre of pressure, against a
    // plate column of 11.0 and a Wii-board column of 19.7 — inside the research doc's stated 11-20
    // mm/s eyes-open range, but at the BOARD end while every amplitude in this layer is authored at
    // the PLATE end. Something has to give: either the upper noise band is faster than the plate
    // protocol's, or the two columns disagree about velocity for the same reason they disagree
    // about amplitude by a factor of two (the doc flags a 25 s board protocol against a 60 s plate
    // one and says to prefer the plate).
    //
    // It is REPORTED rather than gated because closing it means retuning the balance band's upper
    // noise band and re-running the f95 gates, which is a change to `Sway.js` and not to its gate.
    // It is the strongest remaining lead on the sway spectrum.
    note( 'mean resultant velocity (mm/s)', median( meanVelocity ).toFixed( 2 ),
        'plate 11.0, board 19.7 mm/s eyes open — REPORTED at the board end; see the note in source' );

}

/**
 * 🎯 HOW FAST THE BODY MOVES, WHICH NO GATE IN THIS FILE MEASURED — and the class of defect it
 * exists to catch is a distribution leaking into a DERIVATIVE.
 *
 * Every amplitude gate here is stated on a position. `drawAmplitude` is a lognormal whose standard
 * deviation exceeds its mean, which is correct (§1.7c) and gated. The event SHAPES had fixed
 * durations, so peak speed was that whole skewed tail divided by a constant — and nothing looked.
 * Measured on the layer before `eventStretch`, seed 1: the pelvis travelled 32.5 px, 49 mm, in half
 * a second at t = 211 s, about **99 mm/s**, and came all the way back inside two seconds. This
 * layer's own mean resultant centre-of-pressure velocity is 18.22 mm/s (docs/PROGRESS.md), against
 * Quijoux's 11-20 mm/s eyes-open band.
 *
 * ⚠️ A MEAN AND A PEAK ARE NOT COMPARABLE AND THIS SECTION DOES NOT COMPARE THEM. §1.14 is exactly
 * this mistake made with a peak-to-peak and a standard deviation, and it cost a round. A long trace
 * of a rare-event process spends most of its life quiet, so its mean is far below any transient by
 * construction; "99 against 18.22" is not a factor of 5.4 of error, it is two different statistics.
 * The mean is therefore GATED against the literature it belongs to, the peak is gated against a
 * PREDICTION DERIVED FROM THIS FILE'S OWN EVENT SHAPES, and the ratio between them is recorded so
 * that a future change to either one is visible.
 *
 * The peak is taken over a 0.5 s window because that is the interval the defect was reported over
 * and because a per-frame derivative of a noise-driven signal measures the noise's slew rather than
 * the body's.
 */
function measurePosturalVelocity() {

    section( `POSTURAL VELOCITY — centre-of-pressure speed, ${ SWAY_SEEDS.length } seeds x ${ VELOCITY_SECONDS } s` );

    const shipped = SWAY_SEEDS.map( ( seed ) => centreOfPressureSpeed( seed, {} ) );

    // What the layer's own event shapes predict. 🚩 THIS IS NOT THE CEILING ANY MORE — it was, and
    // that is the defect this section was rewritten to remove: it is computed from the very
    // constants that decide how fast the layer moves, so it followed them. It is kept as a REPORTED
    // number and gated against the literature ceiling below, which is what makes a change to the
    // shapes fail deterministically rather than waiting for a seed to draw a large event.
    const predicted = shapePredictedPeakSpeed( {} );

    note( 'the layer\'s own event shapes predict (mm/s)', predicted.toFixed( 1 ),
        'a mean-amplitude fidget on each axis at once: pi*A/(2*rise). REPORTED, not the ceiling' );

    note( 'literature ceiling (mm/s)', PEAK_SPEED_CEILING_MM_PER_SECOND.toFixed( 1 ),
        `pi*f95*A on both axes at once: Quijoux ${ QUIJOUX_F95_MEDIO_LATERAL_HZ }/` +
        `${ QUIJOUX_F95_ANTERO_POSTERIOR_HZ } Hz with Duarte ${ DUARTE_SHIFT_MEDIO_LATERAL_MM }/` +
        `${ DUARTE_SHIFT_ANTERO_POSTERIOR_MM } mm — reads nothing from Sway.js` );

    const means = shipped.map( ( report ) => report.meanSpeed );
    const peaks = shipped.map( ( report ) => report.peakSpeed );

    console.log( '' );
    console.log( `        mean resultant speed (mm/s)   ${ median( means ).toFixed( 2 ) } median, ` +
        `${ Math.min( ...means ).toFixed( 2 ) }-${ Math.max( ...means ).toFixed( 2 ) } across seeds` );
    console.log( `        peak 0.5 s speed (mm/s)       ${ median( peaks ).toFixed( 1 ) } median, ` +
        `${ Math.min( ...peaks ).toFixed( 1 ) }-${ Math.max( ...peaks ).toFixed( 1 ) } across seeds` );
    console.log( '' );

    // ⚠️ THE COMPOSITE, not the balance band. POSTURAL BAND above reports 18.22 mm/s and that is a
    // different quantity — `balanceDisplacement` alone, with the weight-shift processes excluded.
    // Both sit inside Quijoux's 11-20 mm/s and neither is a restatement of the other; conflating
    // them would be §1.7b with a velocity instead of an amplitude.
    gate( 'mean resultant speed, median (mm/s)', median( means ),
        MEAN_COP_SPEED_RANGE_MM_PER_SECOND.low, MEAN_COP_SPEED_RANGE_MM_PER_SECOND.high,
        'Quijoux eyes-open 11-20 mm/s, on the COMPOSITE; the balance band alone reads 18.22' );

    gate( 'peak 0.5 s speed, worst seed (mm/s)', Math.max( ...peaks ), 0,
        PEAK_SPEED_CEILING_MM_PER_SECOND,
        'the LITERATURE ceiling, which does not move when the layer does — see its constant' );

    // 🎯 THE DETERMINISTIC HALF, AND THE ONE THE OLD SELF-REFERENTIAL CEILING COULD NOT HAVE. The
    // gate above is stochastic: it needs a seed to draw an event large enough to reach the ceiling.
    // This one asks whether the SHAPES themselves could ever exceed what the published spectrum
    // admits, and it answers in one number with no seed in it at all.
    gate( 'the event shapes fit under the literature ceiling (x)',
        PEAK_SPEED_CEILING_MM_PER_SECOND / predicted, 1.0, 3.0,
        `${ predicted.toFixed( 1 ) } mm/s of shape against a ${ PEAK_SPEED_CEILING_MM_PER_SECOND.toFixed( 1 ) } ` +
        'mm/s bound. The ceiling on THIS one is not decoration either: shapes far under the bound ' +
        'would be a layer that had stopped producing legible events' );

    note( 'peak / mean', ( Math.max( ...peaks ) / median( means ) ).toFixed( 1 ),
        'recorded so a change to either statistic is visible. NOT a gate: a rare-event process is ' +
        'quiet most of the time and its mean is below any transient by construction' );

    measurePosturalVelocityTheOtherWay();

}

/**
 * §1.1. The known-bad is the layer with `eventStretch` defeated — a fixed event duration, which is
 * exactly how this file shipped — run over the same twelve seeds and asserted as a COUNT (§1.1a).
 */
function measurePosturalVelocityTheOtherWay() {

    const fixed = SWAY_SEEDS.map( ( seed ) => centreOfPressureSpeed( seed, { eventDurationScalesWithAmplitude: false } ) );

    const peaks = fixed.map( ( report ) => report.peakSpeed );
    const ceiling = PEAK_SPEED_CEILING_MM_PER_SECOND;

    note( 'fixed-duration events, peak 0.5 s speed (mm/s)',
        `${ Math.min( ...peaks ).toFixed( 1 ) }-${ Math.max( ...peaks ).toFixed( 1 ) }`,
        'the layer as it shipped: a lognormal amplitude divided by a constant duration' );

    gate( 'seeds where the peak gate CATCHES a fixed duration',
        peaks.filter( ( value ) => value > ceiling ).length, 3, SWAY_SEEDS.length,
        `against a ${ ceiling.toFixed( 0 ) } mm/s ceiling. Not all twelve, and that is the point: the ` +
        'defect is in the TAIL, so a seed whose largest draw happens to be modest passes honestly' );

    // 🚩 RECORDED AS A GATE. The mean is what the literature reports and what this file already
    // gated, and it barely moves — 18.2 either way — because stretching the tail changes the path
    // length hardly at all. A gate on the mean is structurally unable to see this defect (§1.11).
    const fixedMeans = fixed.map( ( report ) => report.meanSpeed );

    gate( 'a MEAN speed gate would NOT have caught it (mm/s)', median( fixedMeans ),
        MEAN_COP_SPEED_RANGE_MM_PER_SECOND.low, MEAN_COP_SPEED_RANGE_MM_PER_SECOND.high,
        `recorded, not tolerated: the fixed-duration layer's composite mean is ` +
        `${ median( fixedMeans ).toFixed( 2 ) } mm/s — inside the literature band, and 0.1 mm/s from the ` +
        `shipped layer's — while its peak reaches ${ Math.max( ...peaks ).toFixed( 0 ) }. Stretching the ` +
        'tail changes a path length hardly at all, which is why no existing gate could see this' );

    breakThePeakCeilingADifferentWay();

}

/**
 * 🎯 A SECOND KNOWN-BAD, IN THE SAME CLASS AND BY A DIFFERENT MECHANISM — because a gate proved only
 * against the defect it was written for is proved against nothing (LEARNINGS §1.1, and the standing
 * instruction that a gate which only catches its own known-bad is decorative).
 *
 * The first known-bad above defeats `eventStretch`, which lets the AMPLITUDE distribution's tail out
 * as speed. This one leaves `eventStretch` alone and simply makes every fidget twice as brief — the
 * amplitude distribution is untouched, the event rate is untouched, and the spectrum moves up rather
 * than out. It is the change the OLD ceiling was structurally unable to see, because that ceiling
 * was `pi*A/(2*rise)` read off `fidget.durationSeconds` at run time: halve the duration and the
 * ceiling doubled with the layer.
 *
 * Both halves are asserted, and the first is the one worth reading:
 *
 *   THE OLD CEILING WOULD HAVE STAYED GREEN. Computed here the way the old section computed it,
 *   from the halved layer's own shapes, and compared against that same layer's measured peaks. If
 *   this assertion ever goes red it means the old form was not in fact self-referential and this
 *   whole rewrite was unnecessary — which is exactly what an assertion is for.
 *
 *   THE NEW CEILING GOES RED, deterministically on the shape gate and on a counted number of seeds
 *   on the stochastic one.
 */
function breakThePeakCeilingADifferentWay() {

    // Read off the shipped layer rather than typed, so the known-bad stays a HALVING of whatever
    // `FIDGET_DURATION_SECONDS` currently is instead of drifting into an absolute number.
    const shipped = buildStack( SEED );
    const halved = { fidget: { durationSeconds: shipped.layer.fidget.durationSeconds / 2 } };

    shipped.stack.dispose();

    const mirrorCeiling = shapePredictedPeakSpeed( halved );
    const peaks = SWAY_SEEDS.map( ( seed ) => centreOfPressureSpeed( seed, halved ).peakSpeed );

    note( 'halved fidget duration, peak 0.5 s speed (mm/s)',
        `${ Math.min( ...peaks ).toFixed( 1 ) }-${ Math.max( ...peaks ).toFixed( 1 ) }`,
        'same amplitudes, same rate, every event twice as brief' );

    gate( 'the OLD self-referential ceiling would have stayed green',
        peaks.filter( ( value ) => value > mirrorCeiling ).length, 0, 0,
        `it doubles to ${ mirrorCeiling.toFixed( 0 ) } mm/s with the layer, so none of the twelve ` +
        'seeds crosses it. This is the proof that the old gate could not fail' );

    gate( 'the SHAPE gate catches a halved duration deterministically (x)',
        PEAK_SPEED_CEILING_MM_PER_SECOND / mirrorCeiling, 0, 1.0,
        `${ mirrorCeiling.toFixed( 0 ) } mm/s of shape against a ` +
        `${ PEAK_SPEED_CEILING_MM_PER_SECOND.toFixed( 0 ) } mm/s bound — no seed involved` );

    gate( 'seeds where the LITERATURE ceiling catches a halved duration',
        peaks.filter( ( value ) => value > PEAK_SPEED_CEILING_MM_PER_SECOND ).length,
        3, SWAY_SEEDS.length,
        `against a fixed ${ PEAK_SPEED_CEILING_MM_PER_SECOND.toFixed( 0 ) } mm/s: ` +
        `${ peaks.filter( ( value ) => value > PEAK_SPEED_CEILING_MM_PER_SECOND ).length } of ` +
        `${ SWAY_SEEDS.length }, measured 47.3-107.3. Asserted as a COUNT per §1.1a, and the count is ` +
        'LOW on purpose — a peak lives in the tail, so a seed whose largest draw is modest passes ' +
        'honestly even at twice the speed. The deterministic shape gate above is what carries this ' +
        'known-bad; this one only shows that the stochastic half is not blind to it' );

}

/**
 * The peak resultant speed the layer's event shapes predict, in mm/s, for a layer built however the
 * caller likes. A raised cosine rising to A in T seconds peaks at pi*A/(2T), and `eventStretch`
 * holds every larger event to the mean event's speed, so the mean event is the fastest one.
 *
 * 🚩 This is the OLD CEILING, kept as a function so that it can be REPORTED beside the literature
 * one and so that the known-bad above can show it following a defect it is supposed to catch. It
 * must never be passed to `gate()` as a bound again.
 */
function shapePredictedPeakSpeed( options ) {

    const { stack, layer } = buildStack( SEED, options );
    const riseSeconds = layer.fidget.durationSeconds * layer.fidget.riseFraction;

    const axisPeak = ( axis ) => Math.PI * axis.settings.shiftAmplitude * layer.fidget.amplitudeFraction
        / ( 2 * riseSeconds );

    const predicted = Math.hypot( axisPeak( layer.medioLateral ), axisPeak( layer.anteroPosterior ) ) * 1000;

    stack.dispose();

    return predicted;

}

/** Mean and peak resultant speed of the composite centre of pressure, in mm/s, over one seed. */
function centreOfPressureSpeed( seed, options ) {

    const { stack, layer } = buildStack( seed, options );

    const frames = Math.round( VELOCITY_SECONDS * SAMPLE_RATE_HZ );
    const width = Math.round( VELOCITY_PEAK_WINDOW_SECONDS * SAMPLE_RATE_HZ );
    const positions = new Float64Array( 2 * frames );

    let travelled = 0;
    let previous = null;

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( FRAME_SECONDS );

        const x = layer.displacement.x;
        const z = layer.displacement.z;

        positions[ 2 * frame ] = x;
        positions[ 2 * frame + 1 ] = z;

        if ( previous !== null ) travelled += Math.hypot( x - previous.x, z - previous.z );

        previous = { x, z };

    }

    stack.dispose();

    // The peak is a DISPLACEMENT over the window divided by the window, not a path length: a body
    // that jitters back and forth inside half a second has not gone anywhere and should not score
    // as fast. That is the same quantity the defect was reported in — 32.5 px between two samples
    // half a second apart.
    let peak = 0;

    for ( let start = 0; start + width < frames; start ++ ) {

        const end = start + width;

        peak = Math.max( peak, Math.hypot(
            positions[ 2 * end ] - positions[ 2 * start ],
            positions[ 2 * end + 1 ] - positions[ 2 * start + 1 ] ) / VELOCITY_PEAK_WINDOW_SECONDS );

    }

    return { meanSpeed: travelled * 1000 / VELOCITY_SECONDS, peakSpeed: peak * 1000 };

}

/**
 * Duarte's event rates, and — separately — the RELAY rate, which is punch-list item 2.9's gate.
 *
 * 🎯 THE THREE CLAIMS HERE ARE DIFFERENT AND WERE PREVIOUSLY CONFLATED.
 *
 *   The layer's own counters cover BOTH axes, so they are gated against the sum of the two per-axis
 *   rates. That is a check on the Poisson machinery.
 *
 *   The RELAY covers the LATERAL axis only and covers BOTH patterns, because a fidget is a weight
 *   shift that comes back and a consumer swinging an arm to a load transfer wants to know about it.
 *   That makes the relay rate 1.2 + 0.30 = 1.5/min, which is punch-list 2.9's ask and Cassell's
 *   independently measured conversational rate. Before the rewrite only `shifting` relayed, at
 *   0.30/min, and 7 of 12 ninety-second windows contained no postural event at all (§1.4).
 *
 *   The DIRECTION of a fidget is a fair coin. It was not: `beginFidget` took the absolute amplitude
 *   and never signed it, so every fidget in the layer's history pushed the body toward the
 *   character's left and the lateral posture signal carried a standing bias no gate was looking
 *   for. That is a real, shipped, silently-passing defect and it gets its own gate.
 *
 * EVERY BAND HERE IS DERIVED. These are Poisson counts, so the standard deviation of a count is its
 * square root and a 3-sigma band on a rate is 3/sqrt(expected count) of it. Nothing is hand-set.
 */
function measureEventRates() {

    section( `EVENT RATES — Duarte's processes and the relay, ${ EVENT_SEEDS.length } seeds x ${ EVENT_DURATION_SECONDS } s` );

    const relayed = [];
    let fidgets = 0;
    let shifts = 0;

    for ( const seed of EVENT_SEEDS ) {

        const { stack, layer } = buildStack( seed, { onWeightShift: ( event ) => relayed.push( event ) } );

        for ( let frame = 0; frame < EVENT_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) stack.update( FRAME_SECONDS );

        fidgets += layer.eventCounts.fidget;
        shifts += layer.eventCounts.shift;

        stack.dispose();

    }

    const minutes = EVENT_SEEDS.length * EVENT_DURATION_SECONDS / 60;

    const fidgetRate = DUARTE_FIDGET_RATE_MEDIO_LATERAL + DUARTE_FIDGET_RATE_ANTERO_POSTERIOR;
    const shiftRate = DUARTE_SHIFT_RATE_MEDIO_LATERAL + DUARTE_SHIFT_RATE_ANTERO_POSTERIOR;
    const relayRate = DUARTE_FIDGET_RATE_MEDIO_LATERAL + DUARTE_SHIFT_RATE_MEDIO_LATERAL;

    gatePoissonRate( 'fidgets per minute (both axes)', fidgets / minutes, fidgetRate, minutes,
        'Duarte ML 1.2/min + AP 1.0/min' );
    gatePoissonRate( 'shifts per minute (both axes)', shifts / minutes, shiftRate, minutes,
        'Duarte ML 0.30/min + AP 0.19/min' );

    // The relay fires on the LATERAL axis only. A weight shift is a load transfer between the legs;
    // an antero-posterior shift is a lean into or away from the conversation, and the arm swing a
    // consumer plays on this callback would read as a flinch if that triggered it.
    gatePoissonRate( 'relays per minute', relayed.length / minutes, relayRate, minutes,
        `design ${ relayRate.toFixed( 2 ) }/min; Cassell ${ CASSELL_SHIFT_RATE_PER_MINUTE.join( '-' ) }; ` +
        `punch-list 2.9 asks ${ PUNCH_LIST_RELAY_RATE_PER_MINUTE.join( '-' ) }` );

    // 🚩 Stated plainly rather than hidden inside the band above: the DESIGN rate is 1.50/min,
    // which is the very top of punch-list 2.9's 1.0-1.5 and the middle of Cassell's 1.4-1.6. A
    // measured value a little above 1.5 is Poisson scatter on that design rate, not a rate error —
    // which is why the gate is stated against the design rate and its own counting error rather
    // than against the punch-list interval, whose upper edge our design sits exactly on.
    note( 'relay design rate (per min)', relayRate.toFixed( 2 ),
        'ML fidget 1.2 + ML shift 0.30; the top of punch-list 2.9 and the middle of Cassell' );

    const byPattern = new Map( [ [ 'fidget', [] ], [ 'shift', [] ] ] );

    for ( const event of relayed ) {

        if ( byPattern.has( event.pattern ) ) byPattern.get( event.pattern ).push( event );

    }

    gate( 'relays carrying a known pattern',
        byPattern.get( 'fidget' ).length + byPattern.get( 'shift' ).length, relayed.length, relayed.length,
        'every relay says whether the body came back or stayed' );
    gate( 'relays carrying a magnitude',
        relayed.filter( ( event ) => Number.isFinite( event.magnitude ) && event.magnitude !== 0 ).length,
        relayed.length, relayed.length,
        'the drawn amplitude over Duarte\'s 22 mm mean, signed by direction' );
    gate( 'relays carrying the lateral axis',
        relayed.filter( ( event ) => event.axis === 'medioLateral' ).length, relayed.length, relayed.length,
        'a fore-and-aft shift must never relay' );

    gatePoissonRate( 'fidget relays per minute', byPattern.get( 'fidget' ).length / minutes,
        DUARTE_FIDGET_RATE_MEDIO_LATERAL, minutes, 'Duarte ML fidget 1.2/min' );
    gatePoissonRate( 'shift relays per minute', byPattern.get( 'shift' ).length / minutes,
        DUARTE_SHIFT_RATE_MEDIO_LATERAL, minutes, 'Duarte ML shift 0.30/min' );

    // 🚩 THE FAIR COIN. A binomial proportion has standard error sqrt(0.25/n), so the band is
    // derived from the sample size rather than picked. Before the rewrite this read 1.000.
    gateFairCoin( 'fidget direction, fraction toward left',
        byPattern.get( 'fidget' ).filter( ( event ) => event.magnitude > 0 ).length,
        byPattern.get( 'fidget' ).length,
        'every fidget used to push the same way; that is what this gate exists for' );
    gateFairCoin( 'shift direction, fraction toward left',
        byPattern.get( 'shift' ).filter( ( event ) => event.magnitude > 0 ).length,
        byPattern.get( 'shift' ).length, '' );

    // The relayed magnitude is the drawn amplitude over Duarte's 22 mm mean, so the mixture's
    // expectation is (1.2 x fidgetFraction + 0.30 x 1.0) / 1.5. The fraction is read off the layer
    // rather than written here, because it is the constant this file's LEGIBILITY section exists to
    // argue about and two copies of it would drift apart. The folded gaussian this replaced would
    // have multiplied whatever it is by 35.3 / 22, which is the 1.59-against-1.0 the old report
    // printed without anyone reading it.
    const magnitudes = relayed.map( ( event ) => Math.abs( event.magnitude ) );
    const fidgetFraction = new Sway().fidget.amplitudeFraction;
    const expectedMagnitude =
        ( DUARTE_FIDGET_RATE_MEDIO_LATERAL * fidgetFraction + DUARTE_SHIFT_RATE_MEDIO_LATERAL ) / relayRate;

    // 3 standard errors, where a single draw's relative spread is Duarte's own 38/22.
    const magnitudeError = 3 * expectedMagnitude
        * ( DUARTE_SHIFT_MEDIO_LATERAL_SD_MM / DUARTE_SHIFT_MEDIO_LATERAL_MM ) / Math.sqrt( magnitudes.length );

    gate( 'relayed |magnitude| mean', mean( magnitudes ),
        expectedMagnitude - magnitudeError, expectedMagnitude + magnitudeError,
        `fidgets at ${ fidgetFraction.toFixed( 2 ) } of a shift mixed with shifts: ` +
        `${ expectedMagnitude.toFixed( 2 ) } expected` );

    note( 'relayed |magnitude| range',
        `${ Math.min( ...magnitudes ).toFixed( 2 ) }-${ Math.max( ...magnitudes ).toFixed( 2 ) }`,
        'lognormal: most shifts are small and a few are large' );

}

function measureDiscourseCoupling() {

    section( 'DISCOURSE COUPLING — Cassell et al. 2001' );

    const trials = 20000;

    for ( const [ label, speakerChanged, low, high, source ] of [
        [ 'at speaker change', true, 0.245, 0.275, 'a shift accompanies 26% of these' ],
        [ 'at plain turn boundary', false, 0.070, 0.092, 'only 8% of these' ]
    ] ) {

        const relayed = [];
        const { stack, layer } = buildStack( SEED, { onWeightShift: () => relayed.push( 1 ) } );

        let shifts = 0;
        for ( let trial = 0; trial < trials; trial ++ ) {
            if ( layer.markDiscourseBoundary( { speakerChanged } ) ) shifts ++;
        }

        gate( `shift probability ${ label }`, shifts / trials, low, high, source );
        gate( `relays ${ label }`, relayed.length, shifts, shifts,
            'a discourse shift is a lateral shift, so it relays exactly once' );

        stack.dispose();

    }

}

/**
 * 🎯 §1.1 — A GATE THAT HAS NEVER FAILED IS NOT KNOWN TO WORK.
 *
 * Three known-bad layers, and what each one proves:
 *
 *   THE PRE-FIX AMPLITUDES. `new Sway({ balanceRms*: 3.0 mm / 1.6528, 4.9 mm / 1.6528 })` is
 *   exactly what the previous version of this layer authored: Quijoux's centre-of-pressure column
 *   applied as HEAD excursion, which under-moves the centre of mass by the head-to-COM lever ratio.
 *   The balance-band gate must reject it.
 *
 *   A WRONG LEVER. The centre-of-mass lever is doubled after bind, so the solved lean is halved and
 *   the body goes half as far as it was told to. The BAND gate cannot see this — the commanded
 *   signal is unchanged — and that is recorded rather than papered over. The LOOP CLOSURE gate
 *   catches it, which is the entire reason that section exists.
 *
 *   NO WEIGHT SHIFTS. `{ weightShiftsEnabled: false }` leaves the balance band alone, which is the
 *   quiet-standing signal and about a fifth of what fifteen unconstrained minutes produce. The
 *   composite gate must reject it.
 */
function measureTheOtherWay() {

    section( 'THE OTHER WAY — known-bad layers, which the gates above must REJECT' );

    const seconds = SPECTRUM_DURATION_SECONDS;
    const sigmaMedioLateral = 3 * rmsEstimatorSigma( seconds, QUIJOUX_MODE_MEDIO_LATERAL_HZ );
    const sigmaAnteroPosterior = 3 * rmsEstimatorSigma( seconds, QUIJOUX_MODE_ANTERO_POSTERIOR_HZ );

    // --- the pre-fix, head-framed amplitudes ---
    const headFramed = runSignals( seconds, {
        balanceRmsMedioLateralMetres: 0.0030 / 1.6528,
        balanceRmsAnteroPosteriorMetres: 0.0049 / 1.6528
    } );

    const headFramedMl = rootMeanSquare( headFramed.balanceMedioLateral ) * 1000;
    const headFramedAp = rootMeanSquare( headFramed.balanceAnteroPosterior ) * 1000;

    note( 'pre-fix balance ML / AP (mm)', `${ headFramedMl.toFixed( 2 ) } / ${ headFramedAp.toFixed( 2 ) }`,
        `against the ${ seconds } s band ` +
        `${ ( QUIJOUX_RMS_MEDIO_LATERAL_MM * ( 1 - sigmaMedioLateral ) ).toFixed( 2 ) }-` +
        `${ ( QUIJOUX_RMS_MEDIO_LATERAL_MM * ( 1 + sigmaMedioLateral ) ).toFixed( 2 ) } / ` +
        `${ ( QUIJOUX_RMS_ANTERO_POSTERIOR_MM * ( 1 - sigmaAnteroPosterior ) ).toFixed( 2 ) }-` +
        `${ ( QUIJOUX_RMS_ANTERO_POSTERIOR_MM * ( 1 + sigmaAnteroPosterior ) ).toFixed( 2 ) }` );

    gate( 'balance band REJECTS the pre-fix ML amplitude',
        outsideBand( headFramedMl, QUIJOUX_RMS_MEDIO_LATERAL_MM, sigmaMedioLateral ) ? 1 : 0, 1, 1,
        '1 means the gate caught it; 0 means the gate is decorative' );
    gate( 'balance band REJECTS the pre-fix AP amplitude',
        outsideBand( headFramedAp, QUIJOUX_RMS_ANTERO_POSTERIOR_MM, sigmaAnteroPosterior ) ? 1 : 0, 1, 1, '' );

    // --- a doubled centre-of-mass lever ---
    //
    // The antero-posterior axis is the one to read, because it has no contrapposto: the whole of a
    // fore-and-aft displacement goes through the pendulum, so a doubled lever halves the realised
    // travel exactly. The lateral axis lands between a half and a whole, because the stance blend
    // still delivers its own share correctly.
    const wrongLever = runSignals( seconds, {}, ( layer ) => {

        layer.centreOfMassLever.medioLateral *= 2;
        layer.centreOfMassLever.anteroPosterior *= 2;

    } );

    const wrongLeverBandMl = rootMeanSquare( wrongLever.balanceMedioLateral ) * 1000;
    const wrongLeverRealisedAp = rootMeanSquare( wrongLever.realisedAnteroPosterior )
        / rootMeanSquare( wrongLever.commandedAnteroPosterior );
    const wrongLeverRealisedMl = rootMeanSquare( wrongLever.realisedMedioLateral )
        / rootMeanSquare( wrongLever.commandedMedioLateral );

    note( 'doubled lever, realised / commanded',
        `ML ${ wrongLeverRealisedMl.toFixed( 3 ) }  AP ${ wrongLeverRealisedAp.toFixed( 3 ) }`,
        'AP has no contrapposto, so a doubled lever halves it exactly' );

    gate( 'band gate alone does NOT catch a wrong lever',
        outsideBand( wrongLeverBandMl, QUIJOUX_RMS_MEDIO_LATERAL_MM, sigmaMedioLateral ) ? 1 : 0, 0, 0,
        'recorded, not tolerated: the commanded signal is unchanged, so the band cannot see it' );

    gate( 'loop closure REJECTS a wrong lever',
        Math.abs( wrongLeverRealisedAp - 1 ) > CENTRE_OF_MASS_CLOSURE_TOLERANCE ? 1 : 0, 1, 1,
        '1 means the realised centre of mass caught it' );

    gate( 'and by a real margin (x the tolerance)',
        Math.abs( wrongLeverRealisedAp - 1 ) / CENTRE_OF_MASS_CLOSURE_TOLERANCE, 5, Infinity,
        'the error must be large enough that the tolerance is not what decided it' );

    // --- no weight shifts at all ---
    const quiet = runSignals( UNCONSTRAINED_WINDOW_SECONDS, { weightShiftsEnabled: false } );
    const quietMl = rootMeanSquare( quiet.commandedMedioLateral ) * 1000;

    note( 'balance band alone, composite ML (mm)', quietMl.toFixed( 2 ),
        `against Bates' lateral IQR ${ BATES_IQR_MEDIO_LATERAL_MM.join( '-' ) }` );

    gate( 'composite gate REJECTS a layer with no weight shifts',
        quietMl < BATES_IQR_MEDIO_LATERAL_MM[ 0 ] || quietMl > BATES_IQR_MEDIO_LATERAL_MM[ 1 ] ? 1 : 0, 1, 1,
        'fifteen unconstrained minutes are not fifteen quiet ones' );

    // --- the lateral righting removed: the state the visual judge measured ---
    //
    // §1.1 for the three newest gates. `lateralRightingEnabled: false` runs the contrapposto exactly
    // as its pose file draws it and the pendulum as a rigid rotation, which is what this layer did
    // when a blind judge reported "the head still travels 1.34x the hip" and "head-on-neck motion
    // adds to the trunk lean instead of cancelling it".
    // 🚩 EVERY SEED, AND IT USED TO BE ONE — which turned out to matter, because the sign of one of
    // these four statistics on the known-bad layer is a COIN TOSS and nobody had looked.
    //
    // The forward gates in the LATERAL RIGHTING section are stated over all twelve seeds
    // ('worst seed', 'lowest seed'). Their rejection proof was stated over `[ SEED ]`. That is a
    // proof of a narrower claim than the gate makes, and the frame-rate fix exposed it: with the
    // arrival times re-drawn, `SEED`'s unrighted correlation moved from positive to -0.313 and the
    // sign gate stopped catching the very configuration it was written for. Measured over all
    // twelve seeds below: the ratio and centre-of-mass gates catch it 12/12; the SIGN catches it
    // 6/12.
    const unrightedTraces = SWAY_SEEDS.map(
        ( seed ) => traceSway( seed, UNCONSTRAINED_WINDOW_SECONDS, { lateralRightingEnabled: false } ) );

    const unrightedRms = [];
    const unrightedPeak = [];
    const unrightedCorrelations = [];

    for ( const trace of unrightedTraces ) {

        const { head, neck, pelvis } = lateralDisplacements( trace );

        unrightedRms.push( rootMeanSquare( head ) / rootMeanSquare( pelvis ) );
        unrightedPeak.push( peakToPeak( head ) / peakToPeak( pelvis ) );
        unrightedCorrelations.push( pearson( head.map( ( value, index ) => value - neck[ index ] ), neck ) );

    }

    const countWhere = ( values, predicate ) => values.filter( predicate ).length;

    note( 'unrighted head / pelvis, range over 12 seeds',
        `RMS ${ Math.min( ...unrightedRms ).toFixed( 3 ) }-${ Math.max( ...unrightedRms ).toFixed( 3 ) }, ` +
        `p2p ${ Math.min( ...unrightedPeak ).toFixed( 3 ) }-${ Math.max( ...unrightedPeak ).toFixed( 3 ) }`,
        `against a ceiling of ${ PELVIS_LEADS_CEILING }` );

    gate( 'ratio gate REJECTS the unrighted RMS, on every seed',
        countWhere( unrightedRms, ( value ) => value > PELVIS_LEADS_CEILING ), SWAY_SEEDS.length, SWAY_SEEDS.length,
        'the count of seeds caught; anything short of all twelve and the rejection is a draw of the dice' );

    gate( 'ratio gate REJECTS the unrighted peak-to-peak, on every seed',
        countWhere( unrightedPeak, ( value ) => value > PELVIS_LEADS_CEILING ), SWAY_SEEDS.length, SWAY_SEEDS.length, '' );

    note( 'unrighted r(head-on-neck, neck), COMPOSITE, range over 12 seeds',
        `${ Math.min( ...unrightedCorrelations ).toFixed( 3 ) } to ${ Math.max( ...unrightedCorrelations ).toFixed( 3 ) }`,
        'reported only — the sign gate lives in the PENDULUM regime now, and so does its rejection' );

    // 🚩 AND THE SIGN GATE, RE-PROVED IN THE REGIME THE GATE ITSELF MOVED TO. §1.25n: a rejection
    // measured on a statistic the forward gate no longer uses proves a gate that is not there. The
    // forward claim is now `r(head-on-neck, neck)` with `stanceBlendEnabled: false`, so the known-bad
    // is the same regime with the righting removed as well.
    //
    // The reason it is a real gate rather than a coin toss is unchanged and still worth keeping:
    // measured with `medioLateralAnkleShare` at 0 — the side-by-side reading of Winter this layer
    // used to implement — the unrighted correlation came out POSITIVE on 6 of 12 seeds and negative
    // on the other 6, and it had been proved on one seed. With all of the lateral signal at the hip
    // the head-on-neck residue is noise, and noise has no sign. The ankle share makes a rigid frontal
    // rotation put the head in phase with the trunk by construction.
    const unrightedPendulum = SWAY_SEEDS.map( ( seed ) => traceSway(
        seed, HEAD_ON_NECK_REGIME_SECONDS, { stanceBlendEnabled: false, lateralRightingEnabled: false } ) );

    const unrightedPendulumCorrelations = unrightedPendulum.map( ( trace ) => {

        const { head, neck } = lateralDisplacements( trace );

        return pearson( head.map( ( value, index ) => value - neck[ index ] ), neck );

    } );

    gate( 'the correlation SIGN gate REJECTS it, on every seed',
        countWhere( unrightedPendulumCorrelations, ( value ) => value > 0 ), SWAY_SEEDS.length, SWAY_SEEDS.length,
        `pendulum regime, righting off: ${ Math.min( ...unrightedPendulumCorrelations ).toFixed( 3 ) } to ` +
        `${ Math.max( ...unrightedPendulumCorrelations ).toFixed( 3 ) } against the shipped -1.0000. At ` +
        'medioLateralAnkleShare = 0 this caught only 6 of 12 — see the comment' );

    gate( 'the solve residual gate REJECTS it too, on every seed',
        countWhere( unrightedTraces,
            ( trace ) => Math.abs( trace.layerHeadPerCentreOfMassLateral - 1 ) > LATERAL_RIGHTING_TOLERANCE ),
        SWAY_SEEDS.length, SWAY_SEEDS.length,
        `unrighted pendulum lateral head/COM ${ unrightedTraces[ 0 ].layerHeadPerCentreOfMassLateral.toFixed( 3 ) }` );

    // --- THE MIRROR: a head nailed in space over a swaying body ---
    //
    // 🚩 §1.1 AND §1.3 TOGETHER, AND THE REASON THIS BLOCK EXISTS. The three gates above were written
    // to catch a head that out-travels the pelvis, and they were stated as ceilings, so an
    // independent verifier walked straight through them from the other side: with
    // `LATERAL_HEAD_PER_CENTRE_OF_MASS` at 0.30 the head moved 20.6% of the pelvis and every ratio
    // gate scored it BETTER than the shipped model, the correlation gate awarding it -1.000, the best
    // mark available.
    //
    // The known-bad is built here as OVER-RIGHTING rather than by editing that constant, and the
    // difference matters: the constant is only one of the ways the head can stop moving, and a gate
    // that catches the head under-travelling ONLY when it originates in one constant is not gating
    // the behaviour. `lateralRightingPerRadian` and `trunkRightingRadians` are read by the frame
    // loop every frame, one per mechanism, so doubling them after bind is a defect that reaches the
    // trace without passing through the solve at all — which is exactly the class the old gates
    // could not see. Twice the solved righting lands the head at 0.18 of the centre of mass.
    const parked = traceSway( SEED, UNCONSTRAINED_WINDOW_SECONDS, {}, ( layer ) => {

        layer.lateralRightingPerRadian *= PARKED_HEAD_RIGHTING_FACTOR;
        layer.trunkRightingRadians.left *= PARKED_HEAD_RIGHTING_FACTOR;
        layer.trunkRightingRadians.right *= PARKED_HEAD_RIGHTING_FACTOR;

    } );

    const parkedLateral = lateralDisplacements( parked );

    const parkedHeadPerCom = rootMeanSquare( parkedLateral.head )
        / rootMeanSquare( parkedLateral.centreOfMass );
    const parkedRms = rootMeanSquare( parkedLateral.head ) / rootMeanSquare( parkedLateral.pelvis );
    const parkedPeak = peakToPeak( parkedLateral.head ) / peakToPeak( parkedLateral.pelvis );
    // 🚩 The two head-on-neck clauses are measured in the PENDULUM regime, because that is where the
    // forward gate they are proving now lives (§1.7e, §1.25n). Same defect, same factor, same seed —
    // only the composition changes, and it changes to match the gate.
    const parkedPendulum = traceSway( SEED, HEAD_ON_NECK_REGIME_SECONDS, { stanceBlendEnabled: false },
        ( layer ) => {

            layer.lateralRightingPerRadian *= PARKED_HEAD_RIGHTING_FACTOR;
            layer.trunkRightingRadians.left *= PARKED_HEAD_RIGHTING_FACTOR;
            layer.trunkRightingRadians.right *= PARKED_HEAD_RIGHTING_FACTOR;

        } );

    const parkedPendulumLateral = lateralDisplacements( parkedPendulum );
    const parkedPendulumHeadOnNeck = parkedPendulumLateral.head.map(
        ( value, index ) => value - parkedPendulumLateral.neck[ index ] );

    const parkedCorrelation = pearson( parkedPendulumHeadOnNeck, parkedPendulumLateral.neck );
    const parkedNeckGain = regressionSlope( parkedPendulumLateral.neck, parkedPendulumHeadOnNeck );

    note( 'parked head: head/COM, head/pelvis (RMS, p2p)',
        `${ parkedHeadPerCom.toFixed( 3 ) }, ${ parkedRms.toFixed( 3 ) }, ${ parkedPeak.toFixed( 3 ) }`,
        'against 1.00, 0.82 and 0.83 as shipped' );

    gate( 'head/COM gate REJECTS a parked head',
        Math.abs( parkedHeadPerCom - 1 ) > HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE ? 1 : 0, 1, 1,
        '1 means the gate caught it; this is the gate the 0.30 experiment needed' );

    gate( 'and by a real margin (x the tolerance)',
        Math.abs( parkedHeadPerCom - 1 ) / HEAD_TRACKS_CENTRE_OF_MASS_TOLERANCE, 5, Infinity,
        'the error must be large enough that the tolerance is not what decided it' );

    gate( 'the pelvis-leads FLOOR REJECTS a parked head', parkedRms < PELVIS_LEADS_FLOOR ? 1 : 0, 1, 1,
        'the half of the band that did not exist until a verifier walked through the gap' );

    gate( 'the pelvis-leads floor REJECTS its peak-to-peak too',
        parkedPeak < PELVIS_LEADS_FLOOR ? 1 : 0, 1, 1, '' );

    note( 'parked head: r(head-on-neck, neck), gain',
        `${ parkedCorrelation.toFixed( 4 ) }, ${ parkedNeckGain.toFixed( 4 ) }`,
        'against -0.997 and -0.10 as shipped; note the correlation IMPROVES' );

    gate( 'the head-on-neck GAIN gate REJECTS a parked head',
        parkedNeckGain < HEAD_ON_NECK_GAIN_BAND[ 0 ] || parkedNeckGain > HEAD_ON_NECK_GAIN_BAND[ 1 ] ? 1 : 0,
        1, 1, 'the slope carries the amount; the correlation beside it carries only the sign' );

    // 🚩 RECORDED AS GATES, §1.11 AND §1.3. These three are the state this file was actually in — the
    // ceiling-only ratio gates and the sign-only correlation gate, evaluated against a parked head.
    // All three PASS it, and two of them score it better than the shipped model. They are asserted
    // to be 0 so that nobody later reads the surviving one-sided statements as sufficient, and so
    // that if someone removes the floor or the gain gate this section says which cover was lost.
    gate( 'the ceiling ALONE does not catch a parked head (RMS)',
        parkedRms > PELVIS_LEADS_CEILING ? 1 : 0, 0, 0,
        'recorded, not tolerated: a ratio has two failure directions and this end was declared free' );

    gate( 'the ceiling ALONE does not catch a parked head (p2p)',
        parkedPeak > PELVIS_LEADS_CEILING ? 1 : 0, 0, 0, '' );

    gate( 'the correlation SIGN alone does not catch a parked head',
        parkedCorrelation > 0 ? 1 : 0, 0, 0,
        'recorded, not tolerated: a perfectly parked head scores r = -1, the best mark available' );

    // And the direction that made the old gates look like they worked, so this block is not read as
    // an argument for loosening them: over-righting is caught, under-righting still is too.
    gate( 'the SOLVE residual gate does NOT catch it either',
        Math.abs( parked.layerHeadPerCentreOfMassLateral - 1 ) > LATERAL_RIGHTING_TOLERANCE ? 1 : 0, 0, 0,
        'the solve closed correctly and the frame loop then ignored it — the whole reason for a trace gate' );

    // --- the fidget profile the judge watched ---
    //
    // §1.1 for the legibility gates. Half a shift's amplitude over a symmetric 1.4 s is what this
    // layer shipped when a blind judge read three postural events in seven minutes.
    // 🚩 THE SAME SEEDS THE FORWARD GATE USES, AND IT USED TO BE ONE. A rejection proof measured on
    // a narrower sample than the gate it is proving is not a proof of that gate. This one was
    // stated on `[ SEED ]` alone while `measureLegibility` runs three seeds, and it survived only
    // because the single draw happened to fall the right way: the day the arrival times changed —
    // the frame-rate fix, which does not touch amplitude or duration at all — the one seed came out
    // at 3.34% duty and 0.933/min, above BOTH thresholds, and the known-bad configuration stopped
    // being rejected. Over the three seeds it is rejected on both. §1.1 with a sampling-error tail.
    const dim = legibilityOf( LEGIBILITY_SEEDS, {
        fidget: { amplitudeFraction: 0.5, durationSeconds: 1.4, riseFraction: 0.5 }
    } );

    note( 'pre-fix median event / background, duty (%)',
        `${ dim.medianMultiple.toFixed( 2 ) }, ${ dim.dutyPercent.toFixed( 2 ) }`,
        `against ${ measuredLegibility.medianMultiple.toFixed( 2 ) } and ${ measuredLegibility.dutyPercent.toFixed( 2 ) } as shipped, same seeds` );

    gate( 'legibility REJECTS the pre-fix duty cycle',
        dim.dutyPercent < FIDGET_DUTY_CYCLE_PERCENT ? 1 : 0, 1, 1,
        '1 means the gate caught it; a symmetric 1.4 s fidget is on screen for one frame in forty' );

    // 🚩 RECORDED AS GATES, §1.11 AND §1.1: OF THE THREE LEGIBILITY GATES, ONLY THE DUTY CYCLE
    // CATCHES THE PROFILE THE JUDGE WATCHED. The other two are asserted to 0 here so that nobody
    // later reads either as sufficient on its own.
    //
    // The median-amplitude check misses it because half the defect was never amplitude. The
    // legible-RATE check misses it for a subtler reason worth writing down: halving the amplitude
    // pushes some events under the 3x-background line and leaves the rest above it, so the rate
    // degrades gently where the duty cycle — which is set by the DURATION — falls off a cliff.
    //
    // ⚠️ The rate half of this was previously asserted as a rejection and passed, on ONE seed, at
    // 0.600/min. It was a draw of the dice. Measured over the three seeds the forward gate uses, on
    // the layer as it stood BEFORE the frame-rate fix, the same pre-fix profile scores 0.810/min —
    // above the 0.75 floor. The gate never rejected this configuration; one seed said it did.
    gate( 'the median gate alone does NOT catch the pre-fix profile',
        dim.medianMultiple < LEGIBLE_EVENT_MULTIPLE ? 1 : 0, 0, 0,
        'recorded, not tolerated: duration and amplitude are two defects and need two gates' );

    gate( 'the legible-RATE gate alone does NOT catch it either',
        dim.ratePastMultiple( LEGIBLE_EVENT_MULTIPLE ) < LEGIBLE_EVENT_RATE_PER_MINUTE ? 1 : 0, 0, 0,
        `recorded, not tolerated: pre-fix ${ dim.ratePastMultiple( LEGIBLE_EVENT_MULTIPLE ).toFixed( 3 ) }/min against a ${ LEGIBLE_EVENT_RATE_PER_MINUTE } floor` );

    // So the rate gate needs a known-bad of its own, and the record supplies one: the version of
    // this layer that relayed only Duarte's `shifting` process and not his fidgets fired at
    // 0.30/min, and 7 of 12 ninety-second windows contained no postural event at all. Fidgets that
    // do not move the body reproduce exactly that — they still relay, they just cannot be seen —
    // and the legible rate collapses to the shift process alone.
    const shiftsOnly = legibilityOf( LEGIBILITY_SEEDS, { fidget: { amplitudeFraction: 0 } } );

    note( 'fidgets that do not move the body, legible rate (/min)',
        shiftsOnly.ratePastMultiple( LEGIBLE_EVENT_MULTIPLE ).toFixed( 3 ),
        "Duarte's shift process alone is 0.30/min; this is the state that read as three events in seven minutes" );

    gate( 'legibility REJECTS a layer where only shifts are visible',
        shiftsOnly.ratePastMultiple( LEGIBLE_EVENT_MULTIPLE ) < LEGIBLE_EVENT_RATE_PER_MINUTE ? 1 : 0, 1, 1,
        '1 means the rate gate caught it; 0 means the rate gate has no known-bad at all' );

    // --- the welded foot ---
    //
    // §1.1 for the toe gates. `toeLiftDegrees: 0` is the foot the judge watched: correctly planted,
    // and pixel-for-pixel identical for 6300 frames.
    const welded = buildStack( SEED, { toeLiftDegrees: 0 } );
    const weldedRest = toeGeometry( welded.root );
    let weldedRise = 0;

    for ( let frame = 0; frame < TOE_OTHER_WAY_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        welded.stack.update( FRAME_SECONDS );

        if ( welded.layer.stanceBlend > 0.95 ) {

            welded.root.updateMatrixWorld( true );
            weldedRise = ( toeGeometry( welded.root ).right.lowest - weldedRest.right.lowest ) * 1000;
            break;

        }

    }

    welded.stack.dispose();

    note( 'welded foot, unloaded toe rise (mm)', weldedRise.toFixed( 4 ), 'against 1.489 with the toes driven' );

    gate( 'the toe gate REJECTS a welded foot', weldedRise < TOE_LIFT_FLOOR_MM ? 1 : 0, 1, 1,
        '1 means the gate caught it; 0 means a foot that never deforms would pass' );

    // 🚩 AND THE TOE GATE PASSING IS NOT THE FOOT BEING VISIBLE. The same welded foot is run past
    // the pixel gate here, which is the gate that would have caught what the toe gate could not.
    measureFreeFootTheOtherWay( fullBodyFraming() );

    // 🚩 WHAT COULD NOT BE MADE TO FAIL, SAID OUT LOUD. The head-excursion section has no
    // literature behind it, so there is no known-bad head amplitude to construct — its envelope is
    // a sanity check and nothing in this section can strengthen it. The antero-posterior composite
    // is a recorded shortfall rather than a gate, so it cannot reject anything either.
    note( 'not provable in both directions', 'head excursion, AP composite',
        'no published head amplitude exists; the AP composite is a recorded shortfall, not a gate' );

}

/**
 * Everything above runs at a metronomic 1/60 s. A real render loop does not: it jitters, it drops
 * frames, and it hands back a multi-second delta when a backgrounded tab returns. Every rate in
 * this layer is either a Poisson process or an integrator, and both classes have a standard way of
 * being wrong under variable dt — `rate * dt` over-fires, and a fixed per-frame increment makes the
 * whole signal a function of frame rate rather than of time. This checks neither happened, and that
 * the feet stayed planted while it did not.
 */
/**
 * 🎯 THE SAME SEED AT 30, 60 AND 120 Hz MUST PRODUCE THE SAME TRAJECTORY.
 *
 * A body's sway does not depend on how often you look at it, and the runtime will hit all three of
 * these on real hardware. This section exists because it did depend on it, and because the way that
 * defect surfaced is the most expensive shape in LEARNINGS Part 1.
 *
 * 🚩 WHAT WENT WRONG, MEASURED. `advanceAxis` used to ask `poissonEventOccurs(rate, dt)` twice per
 * axis per frame. The probability form is exact, so the event RATE was correct at every frame rate
 * and every rate gate in this file passed. But four random draws per FRAME means the stream is
 * advanced by the renderer: measured at 120.1 draws/s at 30 Hz, 240.1 at 60 Hz, 480.1 at 120 Hz.
 * Same seed, 900 s, one figure:
 *
 *     60 Hz   stance blend spans -0.990 .. 1.000, first crosses -0.95 at 434 s
 *     30 Hz   stance blend spans -0.771 .. 1.000, NEVER crosses -0.95
 *
 * The judge's capture runs at 30 fps and this file runs at 60. So the FREE FOOT section — which
 * proves the unloaded foot articulates, and needs a full transfer onto one leg to do it — was
 * proving a property of a trajectory the camera never renders. That is §1.3 with the degenerate
 * input hiding one level down: the gate was not measuring nothing, it was measuring a different
 * world. `VARIABLE FRAME TIME` below could not see it either, because that section gates AMPLITUDE
 * and amplitude was never the thing that moved.
 *
 * ⚠️ WHAT IS AND IS NOT ASSERTED. Frame-rate invariance is not bit-exactness. Two things remain
 * genuinely dt-dependent and neither is removable:
 *
 *   - an arrival is OBSERVED at the first frame boundary after it happens, so the frame containing
 *     an event differs. The event's own phase does not, because `advanceAxis` cuts the frame at the
 *     arrival, which is why the tolerance below is micrometres rather than millimetres.
 *   - `shiftCurrent` chases a target that is itself decaying, and two exponentials in series do not
 *     compose exactly across a split step. Order dt²/(0.8 s x 199 s), about 7e-6 of the step.
 *
 * The tolerance is stated in millimetres against this project's own 1.6 px indistinguishability
 * floor, which is 2.43 mm at the framing `alive.js?frame=body` uses. Anything under a hundredth of
 * that is not a frame-rate dependence a human or a camera can reach.
 */
/**
 * 🎯 CAN A VIEWER SEE THE LOWER BODY MOVE IN THE FIFTEEN SECONDS THEY SPEND DECIDING WHETHER IT IS
 * ALIVE? Per horizontal band, in pixels, at the framing `alive.js?frame=body` uses.
 *
 * An independent re-verifier measured `captures/r5-body` — 12600 frames of the whole stack — with
 * `tools/critic/travel.mjs` and reported the lower body dead:
 *
 *     band       raw SD    p2p     high-passed >15 s
 *     head       11.03     55.50   5.940
 *     shoulder   10.83     48.00   4.051
 *     knee        5.72     25.37
 *     ankle       2.04      7.45
 *
 * with the conclusion that below the knee everything "sits at or under this project's own recorded
 * 1.6 px indistinguishability floor."
 *
 * 🚩 THE DEFECT IS REAL AND THE COMPARISON IS NOT, AND THE DIFFERENCE MATTERS BECAUSE IT DECIDES
 * WHERE THE WORK GOES. **Whatever 1.6 px is, it is a peak-to-peak**, and the numbers it was compared
 * against are standard deviations; on these traces the peak-to-peak is 10-12x the SD, so the
 * comparison understates the figure by an order of magnitude.
 *
 * ⚠️ AND THE SECOND HALF OF THAT SENTENCE, ADDED 2026-08-08: **1.6 px is not data at all.** It was
 * quoted out of a block `docs/PROGRESS.md` itself marks superseded, and its two halves disagree by
 * 1.85x — 4.5 mm at this file's own 0.6574 px/mm is 2.958 px, not 1.6. The table below is kept
 * because the STATISTIC correction it makes is right and independent of the number; its last column
 * is a ratio against a figure with nothing behind it and should be read as scale, not as a verdict.
 * See JUDGE_REPORTED_INVISIBLE_PIXELS for what this project does own.
 *
 * Re-measured on the SAME capture in the statistic the floor is actually stated in — the median
 * travel inside a sliding 15 s window, which is the question "what does a viewer see in a glance":
 *
 *     band        median 15 s travel    10th percentile     x 1.6 px (see below)
 *     head              20.84 px            16.20              13.0
 *     shoulder          11.88               9.99                7.4
 *     hip               11.79              10.01                7.4
 *     knee               6.40               5.07                4.0
 *     ankle              2.01               1.06                1.3
 *
 * So the knee band is four times the floor, not under it — and the ankle band is MARGINAL rather
 * than dead: above the floor in a typical fifteen seconds and below it in the quietest tenth.
 *
 * ⚠️ AND THE ANKLE BAND HAS A CEILING THAT IS GEOMETRY, NOT AMPLITUDE. That band is the lower
 * shank: its centroid measures 116.5 mm above the floor against an ankle joint at 67.3 mm, so it
 * stands 49.2 mm up a lever 449.1 mm long to the knee band's centroid at 516.4 mm, and its lower
 * end friction pins to the floor. It can only ever travel about an eighth of whatever the knee
 * does. Confirmed by execution rather than argued — turning the free-foot yaw release AND the toe
 * lift off together changes this band by at most 0.03 px on any of the twelve seeds, because both
 * of them live BELOW it. Reaching 1.6 px here would need the knee band at ~12 px against its
 * measured 7.04-8.21, and the only honest ways to buy that are amplitude increases the literature
 * does not support. It is recorded as a reported number with a floor of its own rather than gated
 * at 1.6.
 *
 * 🚩 AND THE RATIO IT WAS FIRST GATED ON CANNOT CARRY THAT CLAIM. The first version of this section
 * asserted `ankle band / knee band` inside 0.08..0.40, ran on seed 1, and read 0.135 — green. Over
 * the twelve seeds every other amplitude gate here uses it measures **0.036 to 0.182**, failing on
 * two of them (1234 at 0.076, 4242 at 0.036). That is §1.1a exactly: the forward gate was stated on
 * a narrower sample than the gates around it, and the failure was invisible because the assertion
 * read green.
 *
 * The reason it swings by a factor of five is not noise and not the layer. The ankle band's signal
 * is the SUM of two processes with different band gains — the near-rigid lean, and the contrapposto
 * the weight shifts blend in — and in that band the second partially CANCELS the first. Measured on
 * the shift process alone, the left shank's band regresses on its own knee at -0.076 while the
 * right regresses at +0.047, so the pooled centroid of the two legs can sit anywhere. Isolate the
 * lean (`weightShiftsEnabled: false`) and the same statistic is rock solid across all twelve seeds:
 * slope 0.1474-0.1545, correlation 0.879-0.889.
 *
 * 🎯 So the tracking claim is gated WHERE THE GEOMETRY IS ENTITLED TO PREDICT IT — §1.7e, one gate
 * per regime — and the bracket is derived rather than fitted: the shank's pivot lies somewhere
 * between the ankle joint and the floor (§1.11b), which brackets the slope by
 * (116.5 - 67.3) / (516.4 - 67.3) = 0.110 and 116.5 / 516.4 = 0.226. The measured 0.147-0.155 sits
 * inside that bracket on every seed, and the spine-bend model scores -0.159 at a correlation of
 * -1.000 on every seed.
 *
 * 🚩 NOTHING HERE IS EVIDENCE THAT THE LEGS ARE ASYMMETRIC. The bone markers were measured to check:
 * over the twelve seeds `calf_l` and `calf_r` travel 6.35-8.61 px and 6.44-7.99 px with a
 * correlation of 0.970-0.997, and both feet stay inside 0.06 px. The legs track each other; it is
 * the pooled band centroid, 49 mm above a pinned joint, that cannot hold the claim.
 *
 * 🚩 WHAT THIS INSTRUMENT IS, AND WHAT IT IS NOT. It is the skinned mesh's own vertices, grouped
 * into `travel.mjs`'s bands by REST height and projected onto the camera's right vector — not the
 * silhouette-area centroid a capture measures. The two agree to about a factor of two at the
 * extremes (this layer alone scores 7.75 px at the knee against the full stack's captured 6.40) and
 * the difference is both instruments and layers: a capture carries Gaze, IdleMotion, BodyIdle and
 * HandIdle as well, and weights by silhouette area rather than by vertex. §1.9 — nothing here has
 * been looked at; it is a prediction of what a capture would show, gated so it cannot regress
 * between captures, and a capture remains the arbiter.
 *
 * ⏱️ COST. Four configurations over twelve seeds is 48 runs of 12,600 frames, about 5.5 minutes,
 * and it is most of this file's wall clock. It buys the thing a single seed cannot: every number
 * below is a worst-of-twelve rather than one draw of a stochastic process.
 */
function measureGlanceLegibility() {

    section( 'GLANCE LEGIBILITY — per-band travel in a 15 s window, in pixels' );

    const framing = fullBodyFraming();

    note( 'full-body framing (mm / px per mm)',
        `${ framing.framedHeightMillimetres.toFixed( 0 ) } / ${ framing.pixelsPerMillimetre.toFixed( 4 ) }`,
        `stature x ${ BODY_FRAME_MARGIN } over ${ FULL_BODY_CAPTURE_PIXELS } px, camera ${ CAMERA_AZIMUTH_DEGREES } degrees off axis` );

    // The same twelve seeds every other amplitude gate in this file runs over. §1.1a: a gate stated
    // on one draw of a stochastic process is not known to work, and this one demonstrably did not —
    // its ankle/knee ratio failed on two of these twelve while reading green on seed 1.
    const shipped = SWAY_SEEDS.map( ( seed ) => bandTravelPixels( seed, {}, framing ) );

    // CLIP CONTENT quotes the seed-1 hip band, because that is the clip a judge is handed.
    measuredGlanceBands = shipped[ SWAY_SEEDS.indexOf( 1 ) ].bands;

    const at = ( report, name ) => report.bands.find( ( band ) => band.name === name );
    const across = ( name, read ) => shipped.map( ( report ) => read( at( report, name ) ) );

    console.log( '' );
    console.log( '        band   height above floor (mm)   centroid   verts   15 s travel, 12 seeds   ' +
        'worst q10   x the floor' );

    for ( const band of measuredGlanceBands ) {

        const travels = across( band.name, ( each ) => each.glanceTravelPixels );
        const quiet = across( band.name, ( each ) => each.glanceQuietTenthPixels );

        console.log( `  ${ band.name.padStart( 10 ) }   ${ `${ band.lowMillimetres.toFixed( 0 ) }-${ band.highMillimetres.toFixed( 0 ) }`.padStart( 23 ) }   ` +
            `${ band.centroidMillimetres.toFixed( 1 ).padStart( 8 ) }   ${ String( band.vertexCount ).padStart( 5 ) }   ` +
            `${ `${ Math.min( ...travels ).toFixed( 2 ) } - ${ Math.max( ...travels ).toFixed( 2 ) }`.padStart( 21 ) }   ` +
            `${ Math.min( ...quiet ).toFixed( 2 ).padStart( 9 ) }   ` +
            `${ ( Math.min( ...travels ) / SILHOUETTE_WIDTH_FLOOR_PIXELS ).toFixed( 2 ).padStart( 11 ) }` );

    }

    console.log( '' );

    // A band with no vertices in it reports a constant and passes every ordering gate here. §1.11:
    // assert the population, because no amount of tightening the travel gates catches an empty band.
    gate( 'smallest band population (vertices)',
        Math.min( ...measuredGlanceBands.map( ( band ) => band.vertexCount ) ),
        GLANCE_BAND_VERTEX_FLOOR, 1e6,
        `stride ${ GLANCE_VERTEX_STRIDE } over the skinned meshes; the ankle band is the thin one` );

    // Every band a viewer reads as body must clear the floor in a glance, ON THE WORST SEED. The
    // ankle band is excluded and reported instead — see the header for the geometry that bounds it.
    for ( const name of [ 'head', 'shoulder', 'hip', 'knee' ] ) {

        const travels = across( name, ( each ) => each.glanceTravelPixels );

        gate( `${ name } band, 15 s travel, worst seed (px)`, Math.min( ...travels ),
            SILHOUETTE_WIDTH_FLOOR_PIXELS, GLANCE_TRAVEL_CEILING_PIXELS,
            'a judgement, not a measured visibility floor — see JUDGE_REPORTED_INVISIBLE_PIXELS' );

        gate( `${ name } band, 15 s travel, liveliest seed (px)`, Math.max( ...travels ),
            SILHOUETTE_WIDTH_FLOOR_PIXELS, GLANCE_TRAVEL_CEILING_PIXELS,
            'the ceiling half: over-animating an idle is as bad as having none' );

    }

    const ankleTravels = across( 'ankle', ( each ) => each.glanceTravelPixels );
    const ankleQuiet = across( 'ankle', ( each ) => each.glanceQuietTenthPixels );

    note( 'ankle band (lower shank), 15 s travel over 12 seeds (px)',
        `${ Math.min( ...ankleTravels ).toFixed( 2 ) } - ${ Math.max( ...ankleTravels ).toFixed( 2 ) }, ` +
        `quiet tenth ${ Math.min( ...ankleQuiet ).toFixed( 2 ) } - ${ Math.max( ...ankleQuiet ).toFixed( 2 ) }`,
        'MARGINAL and geometrically bounded — see the section header. Not gated at 1.6; gated below against a dead one.' );

    // 🚩 THE QUIET TENTH IS NOT A SINGLE NUMBER EITHER, and reporting it from one seed hid that.
    // At seed 1 it reads 0.74 px, which is what the section header describes as marginal. Over the
    // twelve it falls to 0.13-0.16 px on four of them — 101, 1234, 4242 and 20260807, the last of
    // which is this file's own default SEED. Recorded as a gate so the range cannot quietly shrink
    // back to one seed's worth of it.
    gate( 'seeds whose quiet tenth is under a fifth of a pixel',
        ankleQuiet.filter( ( value ) => value < 0.2 ).length, 0, 6,
        `recorded, not tolerated: ${ ankleQuiet.map( ( value ) => value.toFixed( 2 ) ).join( ' ' ) }` );

    // 🎯 The lower shank IS pinned, so what is asserted is that it TRACKS its own knee. Measured
    // where the pendulum runs alone, because that is the only regime a rigid-lever prediction is
    // entitled to speak for — §1.7e. See the header for the ratio this replaced and why it swung by
    // a factor of five on the shipped layer without the layer being at fault.
    const lean = SWAY_SEEDS.map( ( seed ) => bandTravelPixels( seed, { weightShiftsEnabled: false }, framing ) );

    const leanSlopes = lean.map( ( report ) => regressionSlope( at( report, 'knee' ).samples, at( report, 'ankle' ).samples ) );
    const leanCorrelations = lean.map( ( report ) => pearson( at( report, 'ankle' ).samples, at( report, 'knee' ).samples ) );

    const pivot = anklePivotMillimetres();
    const ankleCentroid = measuredGlanceBands.find( ( band ) => band.name === 'ankle' ).centroidMillimetres;
    const kneeCentroid = measuredGlanceBands.find( ( band ) => band.name === 'knee' ).centroidMillimetres;

    // The pivot is somewhere between the ankle joint and the floor — §1.11b argued that exact
    // question for the sole — so the lever ratio is bracketed rather than pinned, and the bracket
    // is computed from this figure rather than typed in.
    const slopeFloor = ( ankleCentroid - pivot ) / ( kneeCentroid - pivot );
    const slopeCeiling = ankleCentroid / kneeCentroid;

    note( 'shank lever bracket, pivot at the ankle joint / at the floor',
        `${ slopeFloor.toFixed( 3 ) } .. ${ slopeCeiling.toFixed( 3 ) }`,
        `ankle band centroid ${ ankleCentroid.toFixed( 1 ) } mm, knee band ${ kneeCentroid.toFixed( 1 ) } mm, ankle joint ${ pivot.toFixed( 1 ) } mm` );

    gate( 'shank on knee, slope, flattest seed', Math.min( ...leanSlopes ), slopeFloor, slopeCeiling,
        'the lean alone; the bracket above is geometry, not a fitted range' );

    gate( 'shank on knee, slope, steepest seed', Math.max( ...leanSlopes ), slopeFloor, slopeCeiling, '' );

    gate( 'shank on knee, correlation, weakest seed', Math.min( ...leanCorrelations ),
        SHANK_TRACKS_KNEE_CORRELATION_FLOOR, 1,
        'a shank that has come off the leg stops tracking before it stops moving' );

    // 🚩 RECORDED AS A GATE, §1.1a. The statistic this section used to assert the same claim on is
    // regime-dependent by a factor of five, which is why it could read green on one seed and fail
    // on two others. Asserted so that nobody restates the tracking claim on it again.
    const shippedRatios = SWAY_SEEDS.map( ( seed, index ) =>
        at( shipped[ index ], 'ankle' ).glanceTravelPixels / at( shipped[ index ], 'knee' ).glanceTravelPixels );

    gate( 'the 15 s RATIO spans too far to gate, x across seeds',
        Math.max( ...shippedRatios ) / Math.min( ...shippedRatios ), 3, 1e3,
        `recorded, not tolerated: ${ Math.min( ...shippedRatios ).toFixed( 3 ) } .. ${ Math.max( ...shippedRatios ).toFixed( 3 ) } ` +
        `against ${ Math.min( ...leanSlopes ).toFixed( 3 ) } .. ${ Math.max( ...leanSlopes ).toFixed( 3 ) } for the slope on the lean` );

    // 🚩 Travel must fall monotonically FROM THE HIP DOWN, and only from the hip down. Below the
    // pelvis the body is a chain pinned at the floor, so a band that out-travels the one above it
    // is a fix that was bought by scaling something rather than by articulating it.
    //
    // ⚠️ The head is deliberately NOT in that chain, and this gate found that out by failing when
    // it was: the head travels LESS laterally than the hip on purpose — because
    // `LATERAL_HEAD_PER_CENTRE_OF_MASS` parks it over the base of support. Stating a head > hip
    // ordering here would re-assert the defect that fixed. The head has its own gates in HEAD
    // PARKED; this one starts at the pelvis.
    //
    // ⚠️ AND IT IS STATED ON THE AXIAL READING, WHICH IT WAS NOT AND WHICH COST IT A ROUND OF BEING
    // WRONG. The arm-inclusive hip band is 56/89 arm; once the trunk articulates, the arms carry it
    // inboard while the pelvis goes outboard and the band's travel collapses to 3.6-5.3 px. Measured
    // on the shipped layer that puts the KNEE band above the "hip" band on all twelve seeds and this
    // gate goes red — on a pelvis that is travelling FURTHER than it did before. The ordering claim
    // is about the pelvis-knee-ankle chain, so it is measured on those vertices. See BAND PROVENANCE.
    const monotone = shipped.map( ( report ) => {

        const chain = [ 'hip', 'knee', 'ankle' ].map( ( name ) => at( report, name ).axialGlanceTravelPixels );

        for ( let index = 1; index < chain.length; index ++ ) if ( chain[ index ] > chain[ index - 1 ] ) return 0;

        return 1;

    } );

    const armInclusiveMonotone = shipped.filter( ( report ) =>
        at( report, 'hip' ).glanceTravelPixels >= at( report, 'knee' ).glanceTravelPixels ).length;

    gate( 'seeds where AXIAL travel falls monotonically from the hip down',
        monotone.filter( ( value ) => value === 1 ).length, SWAY_SEEDS.length, SWAY_SEEDS.length,
        `hip > knee > ankle on every seed; worst margins ` +
        `${ Math.min( ...across( 'hip', ( each ) => each.axialGlanceTravelPixels ) ).toFixed( 2 ) } hip against ` +
        `${ Math.max( ...across( 'knee', ( each ) => each.axialGlanceTravelPixels ) ).toFixed( 2 ) } knee` );

    gate( 'seeds where the ARM-INCLUSIVE reading would order hip above knee',
        armInclusiveMonotone, 0, 0,
        'recorded, not tolerated: on the statistic this file used until now the knee out-travels the ' +
        '"hip" on every seed, because that band is 56/89 arm and the arms ride the thorax' );

    measureHeadOverHipBand( shipped, at );

    measureGlanceLegibilityTheOtherWay( framing, shipped, at );

}

/**
 * 🎯 HEAD OVER HIP, ON A NAMED TIMESCALE AND A NAMED STATISTIC — because the gate had neither, and a
 * gate whose verdict depends on an unstated parameter is not a gate.
 *
 * 🚩 THE DEFECT, IN ONE LINE. A judge measured this ratio on a rendered clip and reported **1.0596**
 * (seed 4242) and **1.2045** (seed 42) against "a target of <= 1.0". THE SAME CLIPS read **0.894**
 * and **0.909** as a whole-clip peak-to-peak, i.e. PASS. Two honest measurements of the same body
 * disagreeing about the verdict, and nothing anywhere said which one the claim was about.
 *
 * THE CLAIM IS ABOUT THE GLANCE, AND HERE IS WHY, FROM WHAT A VIEWER DOES RATHER THAN FROM WHAT IS
 * CONVENIENT TO COMPUTE.
 *
 *   "The pelvis leads the head" is a statement about two body parts AT THE SAME TIME. A whole-clip
 *   peak-to-peak compares the head's largest excursion over 420 seconds against the hip's largest
 *   excursion over 420 seconds — and on a rare-event process those two extremes come from DIFFERENT
 *   EVENTS, minutes apart. No observer makes that comparison; there is nothing to hold it in.
 *
 *   A whole-clip statistic is also ONE NUMBER PER CLIP. It cannot see a distribution, and §1.14 is
 *   the record of what that costs. The 15 s window gives 406 of them and the gate takes their median.
 *
 *   Fifteen seconds is GLANCE_WINDOW_SECONDS and it is not chosen here: it is four cycles of
 *   Quijoux's 0.33 Hz lateral mode and one fidget at Duarte's 1.2/min, so a window that shows nothing
 *   is showing nothing for a reason other than its own length (§1.4).
 *
 * SO THE STATISTIC IS, IN FULL, AND IT IS WHAT EVERY NUMBER BELOW IS IN: **the median, over 15 s
 * windows stepping one second, of the peak-to-peak horizontal travel of a band's silhouette centre,
 * in pixels, at the full-body capture framing.** The whole-clip figure is PRINTED beside it, always,
 * so that the flip can never happen silently again — but it is not the verdict.
 *
 * 🎯 AND THE SECOND HALF, WHICH IS AN INSTRUMENT DEFECT AND MATTERS MORE THAN THE FIRST. This file's
 * GLANCE_BANDS block says the bands are "identical to `tools/critic/travel.mjs`'s defaults so that an
 * offline prediction and a capture measurement can be laid side by side." The BANDS are identical.
 * THE STATISTIC IS NOT. `travel.mjs` takes the centroid of a THRESHOLDED SILHOUETTE — an outline —
 * and this file took the mean of the band's PROJECTED VERTICES, which is density-weighted over the
 * mesh's interior. On the lower body the two agree. On the head they do not, because yawing a skull
 * redistributes vertex density without moving the outline, and the full stack yaws the head 21.0
 * degrees SD. Measured on the stack `alive.js` builds, 420 s at 30 Hz, seed 4242:
 *
 *     statistic                              head/hip 15 s median
 *     vertex centroid (what this file did)                 3.4521
 *     silhouette centre (what travel.mjs does)             1.0257
 *     the judge's rendered clip                            1.0596
 *
 * A factor of 3.4 between two offline numbers, and the silhouette form lands within 3.2% of the
 * render. So the vertex centroid is not comparable with the arbiter and the silhouette centre is;
 * both are now measured and the gate is on the second.
 *
 * ⚠️ AND THE CONSEQUENCE FOR WHAT THE ROUND WAS TOLD TO FIX. The brief for this round says the
 * residue is `gaze.head` amplitude. On the VERTEX statistic that is true and it is enormous — the
 * head band goes 12.28 -> 47.06 px when `gaze.head` is added, 3.83x. On the SILHOUETTE statistic,
 * which is the one the judge measured, removing `gaze.head` moves head/hip by AT MOST 0.013 across
 * three seeds (4242: 1.0257 -> 1.0244; 42: 0.9918 -> 0.9793; 20260807: 0.9456 -> 0.9446) — and Sway
 * ALONE, with no gaze layer in the stack at all, scores 1.0778-1.1101, which is HIGHER than the full
 * stack. `gaze.head` is not the residue. The ratio is what band geometry gives a correctly-righted
 * body, and the "target <= 1.0" it was scored against is the BONE-MARKER ceiling from HEAD PARKED,
 * borrowed onto a statistic it does not describe. Those measurements are in this file's own
 * `measureBandStatisticDisagreement`, not in a report.
 */
function measureHeadOverHipBand( shipped, at ) {

    console.log( '' );
    console.log( `        THE STATISTIC: median over ${ GLANCE_WINDOW_SECONDS } s windows of the ` +
        'peak-to-peak travel of a band\'s SILHOUETTE CENTRE, in pixels, over its AXIAL vertices.' );
    console.log( '' );
    console.log( '        seed        axial 15 s   axial clip   arm-inclusive 15 s   arm-inclusive clip   vertex 15 s' );

    const glanceRatios = [];
    const wholeClipRatios = [];
    const armInclusiveRatios = [];

    for ( let index = 0; index < SWAY_SEEDS.length; index ++ ) {

        const head = at( shipped[ index ], 'head' );
        const hip = at( shipped[ index ], 'hip' );

        const glance = head.axialGlanceTravelPixels / hip.axialGlanceTravelPixels;
        const clip = head.axialWholeClipPixels / hip.axialWholeClipPixels;
        const armInclusive = head.silhouetteGlanceTravelPixels / hip.silhouetteGlanceTravelPixels;
        const vertexGlance = head.glanceTravelPixels / hip.glanceTravelPixels;

        glanceRatios.push( glance );
        wholeClipRatios.push( clip );
        armInclusiveRatios.push( armInclusive );

        console.log( `  ${ String( SWAY_SEEDS[ index ] ).padStart( 10 ) }   ${ glance.toFixed( 4 ).padStart( 12 ) }   ` +
            `${ clip.toFixed( 4 ).padStart( 10 ) }   ${ armInclusive.toFixed( 4 ).padStart( 18 ) }   ` +
            `${ ( head.silhouetteWholeClipPixels / hip.silhouetteWholeClipPixels ).toFixed( 4 ).padStart( 18 ) }   ` +
            `${ vertexGlance.toFixed( 4 ).padStart( 11 ) }` );

    }

    console.log( '' );

    gate( `head/hip, ${ GLANCE_WINDOW_SECONDS } s median, AXIAL silhouette, worst seed`, Math.max( ...glanceRatios ),
        HEAD_BAND_OVER_HIP_BAND_FLOOR, HEAD_BAND_OVER_HIP_BAND_CEILING,
        'THE gate. NOT the bone-marker claim, not a whole-clip range, and NOT the arm-inclusive ' +
        'column beside it — see the constant. An unrighted lumbar scores 1.47-1.54 here' );

    gate( `head/hip, ${ GLANCE_WINDOW_SECONDS } s median, AXIAL silhouette, lowest seed`, Math.min( ...glanceRatios ),
        HEAD_BAND_OVER_HIP_BAND_FLOOR, HEAD_BAND_OVER_HIP_BAND_CEILING, '' );

    // 🚩 RECORDED AS A GATE, NOT AS PROSE. The whole-clip reading of the SAME twelve traces, so that
    // the two timescales sit in one report and a future verdict cannot be taken on whichever one
    // happened to be to hand. It is asserted as a BAND rather than reported, because the day these
    // two stop bracketing each other is the day one of them has started measuring something else.
    gate( 'whole-clip p2p reads LOWER than the glance median (x)',
        Math.max( ...glanceRatios ) / Math.max( ...wholeClipRatios ), 1.0, 1.6,
        `recorded, not tolerated: worst seed ${ Math.max( ...glanceRatios ).toFixed( 4 ) } on the glance ` +
        `against ${ Math.max( ...wholeClipRatios ).toFixed( 4 ) } whole-clip. A judge reported 1.0596 and ` +
        '0.894 for the same clip and the gate had never said which one it meant' );

    // 🎯 THE ARM-INCLUSIVE READING IS WHAT A JUDGE'S `travel.mjs` REPORTS, so it is asserted rather
    // than dropped — but it is asserted as a RECORD of how far the two statistics have parted, not
    // as a claim about the pelvis. The day they agree again is the day the arms have stopped hanging
    // from the thorax, and that is worth a failing gate either way.
    gate( 'arm-inclusive head/hip over the axial one, worst seed (x)',
        Math.max( ...armInclusiveRatios ) / Math.max( ...glanceRatios ), 2.0, 8.0,
        `recorded, not tolerated: the reading a judge's travel.mjs takes is ` +
        `${ Math.min( ...armInclusiveRatios ).toFixed( 3 ) }-${ Math.max( ...armInclusiveRatios ).toFixed( 3 ) } ` +
        `against ${ Math.min( ...glanceRatios ).toFixed( 3 ) }-${ Math.max( ...glanceRatios ).toFixed( 3 ) } here. ` +
        'Its denominator is 56/89 arm and correlates with an arm-only reading at r = 1.000' );

    measureBandProvenance( shipped, at );
    measureBandStatisticDisagreement( shipped, at );

}

/**
 * 🎯 BAND PROVENANCE — is a band measuring the body part it is named for?
 *
 * This section exists because nothing in the repo was asking that question, and the answer for the
 * hip band was no. A band statistic is the midpoint of a horizontal slice's two extreme projected
 * vertices, and on a standing figure the extremes of most slices are limbs. Two numbers per band say
 * whether that has happened:
 *
 *   THE POPULATION — how many of the band's vertices are on the arm chain at all. The hip band is
 *   56 of 89.
 *
 *   THE AGREEMENT — the correlation, over the whole 420 s trace, between the band's arm-inclusive
 *   silhouette centre and an ARM-ONLY reading of the same rows, against the correlation with the
 *   AXIAL reading. On the hip band those are 1.000 and, once the trunk articulates, 0.66. A band
 *   whose published position tracks a body part it is not named for at r = 1 is not a measurement of
 *   the named part, however carefully its bounds were chosen.
 *
 * ⚠️ THIS IS NOT A CRITICISM OF `travel.mjs`. A judge measuring a rendered silhouette sees the arms,
 * and that reading is the truth about pixels. What went wrong was using it as the denominator of a
 * claim about the PELVIS. Two questions, two objects.
 */
function measureBandProvenance( shipped, at ) {

    console.log( '' );
    console.log( '        band     verts axial/arm   r(silhouette, arm-only)   r(silhouette, axial)' );

    for ( const name of [ 'head', 'shoulder', 'hip', 'knee', 'ankle', 'foot' ] ) {

        const band = at( shipped[ 0 ], name );
        const format = ( value ) => Number.isNaN( value ) ? '     none' : value.toFixed( 4 ).padStart( 9 );

        console.log( `  ${ name.padStart( 10 ) }   ${ `${ band.axialCount }/${ band.armCount }`.padStart( 12 ) }   ` +
            `${ format( band.armAgreement ).padStart( 23 ) }   ${ format( band.axialAgreement ).padStart( 20 ) }` );

    }

    console.log( '' );

    gate( 'smallest AXIAL band population (vertices)',
        Math.min( ...shipped[ 0 ].bands.map( ( band ) => band.axialCount ) ),
        AXIAL_BAND_VERTEX_FLOOR, 1e6,
        'an axial statistic computed over three vertices would be very quiet and very green' );

    // 🚩 The finding itself, asserted so that a later change to the bands or to the rest pose cannot
    // quietly make this file's central attribution untrue without failing.
    const hip = at( shipped[ 0 ], 'hip' );

    gate( 'hip band vertices that are ARM, of its total',
        hip.armCount / ( hip.armCount + hip.axialCount ), 0.40, 0.80,
        `recorded, not tolerated: ${ hip.armCount } arm against ${ hip.axialCount } pelvis and thigh, ` +
        'and BOTH silhouette edges are arm — the hands hang wider than the hips' );

    gate( 'hip band silhouette against an ARM-ONLY reading of the same rows (r)',
        hip.armAgreement, 0.99, 1.0,
        'the attribution: the arm-inclusive hip band IS an arm-span midpoint. Against its own ' +
        `axial reading the same trace correlates at ${ hip.axialAgreement.toFixed( 4 ) }` );

}

/**
 * 🚩 ON THIS LAYER THE TWO STATISTICS AGREE, AND THAT IS ASSERTED RATHER THAN ASSUMED — because it is
 * exactly why this file could not see the defect.
 *
 * `Sway` does not rotate the head; it translates it. A translation moves a vertex mean and an
 * outline's centre by the same amount, so the two readings of head/hip agree here to within 15% and
 * either one would have done. Add `gaze.head` — 21.0 degrees SD of yaw — and they part company by a
 * factor of 3.4, because yawing a skull redistributes vertex density inside an outline that barely
 * moves. That is measured in FULL STACK at the end of this file, on the stack `alive.js` builds.
 *
 * The gate is stated here anyway, in the direction that is true here, so that the pair is checked on
 * every run: the day these two disagree on a Sway-only layer, something in this layer has started
 * rotating the head and the whole GLANCE section is measuring a different quantity than it says.
 *
 * ⚠️ THE BAND WAS 0.80-1.20, THEN 0.70-1.20, AND THE COMPARISON HAS NOW MOVED TO THE AXIAL READING —
 * which is a change of instrument, not a widening. The arm-inclusive head band's two silhouette
 * EDGES are `upperarm_r` and `spine_03`, both at 1387-1390 mm, i.e. the bottom row of the band: they
 * are the SHOULDERS, not the head, and the band's silhouette is 289 mm wide on a skull about 150 mm
 * across. Under a pure couple the shoulders travel far less than the head, so the arm-inclusive
 * denominator stops moving and this ratio reads 1.875-2.300 on a layer whose head band is behaving
 * correctly. On the axial reading — 970 of 971 vertices, the arm gone — the pair reads what it says
 * it does. See `isOnTheArmChain`.
 */
function measureBandStatisticDisagreement( shipped, at ) {

    // 🚩 ONE BAND, AND ONE DIFFERENCE BETWEEN THE TWO READINGS. This gate used to be stated on a
    // RATIO OF RATIOS — the head/hip vertex-centroid ratio divided by the head/hip silhouette ratio —
    // which changes the statistic AND the band population at the same time and therefore cannot
    // attribute a disagreement to either. On the shipped layer it read 1.875-2.300 against a
    // 0.70-1.20 band, and every bit of that came from the HIP band's 56 arm vertices rather than
    // from anything about the head. §1.25k: a toggle that moves two things is not an attribution.
    const ratios = shipped.map( ( report ) => {

        const head = at( report, 'head' );

        return head.axialVertexGlanceTravelPixels / head.axialGlanceTravelPixels;

    } );

    gate( 'AXIAL vertex centroid over AXIAL silhouette centre, head band, worst seed',
        Math.max( ...ratios ), HEAD_BAND_STATISTIC_AGREEMENT[ 0 ], HEAD_BAND_STATISTIC_AGREEMENT[ 1 ],
        'they agree HERE because Sway translates the head rather than rotating it. With gaze.head ' +
        'in the stack the same pair parts company by a factor of three — see FULL STACK' );

    gate( 'AXIAL vertex centroid over AXIAL silhouette centre, head band, lowest seed',
        Math.min( ...ratios ), HEAD_BAND_STATISTIC_AGREEMENT[ 0 ], HEAD_BAND_STATISTIC_AGREEMENT[ 1 ], '' );

}

/**
 * 🎯 FULL STACK — the composition a judge actually captures, and the section that settles which of
 * two honest offline statistics is the one a rendered clip agrees with.
 *
 * Every other section in this file runs `Sway` alone. That is right for gating `Sway`, and it is
 * exactly why two rounds of head-over-hip verdicts came back from renders that nothing offline could
 * reproduce. `alive.js` builds TEN layers, and one of them — `gaze.head` — turns the skull through
 * 21.0 degrees SD of yaw. This section builds the same ten, in the same order, with the same
 * options, on the two seeds the judge's clips were taken at.
 *
 * WHAT IT MEASURES, and all four numbers are the same statistic named in `measureHeadOverHipBand`:
 *
 *   THE SILHOUETTE READING REPRODUCES THE RENDER. Measured 1.0257 at seed 4242 against the judge's
 *   1.0596 from `travel.mjs` on `captures/r8-judge-body/seed-4242` — 3.2% apart, on 12,600 frames
 *   neither measurement shares with the other.
 *
 *   THE VERTEX READING DOES NOT. 3.4521 on the same trace: a factor of 3.4 from the render, in a
 *   file whose GLANCE_BANDS block says the bands exist "so that an offline prediction and a capture
 *   measurement can be laid side by side". The bands were right. The statistic was not.
 *
 *   🚩 `gaze.head` IS NOT THE RESIDUE, AND THE ROUND THAT PRODUCED THIS SECTION WAS BRIEFED THAT IT
 *   WAS. Removing it moves the silhouette ratio by at most 0.013 across the seeds here, and `Sway`
 *   ALONE — with no gaze layer in the stack at all — scores HIGHER than the full stack does. What
 *   moves 3.83x when `gaze.head` is added is the head band's VERTEX travel, 12.28 -> 47.06 px, which
 *   is the statistic no camera reports. A verdict was assigned to a layer on the strength of a
 *   number from the wrong instrument; this section is the toggle that says so.
 *
 * ⚠️ LIMITS, per §1.9. This is still a simulation of the stack, not the stack: it drives the same
 * ten layers over the same rig, and it does not render, so it carries no shading, no antialiasing,
 * no contact shadow and no thresholding. Its agreement with the render is measured on ONE seed to
 * 3.2% and on a second to 21% (0.9918 here against the judge's 1.2045), which is close enough to
 * decide WHICH STATISTIC and nowhere near close enough to replace a capture.
 */
function measureFullStackHeadOverHip() {

    section( 'FULL STACK — head over hip on the ten layers alive.js builds' );

    const framing = fullBodyFraming();

    console.log( '' );
    console.log( '        seed   stack             head ax   hip ax   head/hip ax   head/hip arm-incl   head/hip vertex' );

    const withGaze = [];
    const withoutGaze = [];

    for ( const seed of FULL_STACK_SEEDS ) {

        for ( const [ label, gazeHead ] of [ [ 'as alive.js builds', true ], [ 'gazeHead removed', false ] ] ) {

            const report = bandTravelPixels( seed, { gazeHead }, framing, buildAliveStack );

            const head = report.bands.find( ( band ) => band.name === 'head' );
            const hip = report.bands.find( ( band ) => band.name === 'hip' );

            const axial = head.axialGlanceTravelPixels / hip.axialGlanceTravelPixels;
            const silhouette = head.silhouetteGlanceTravelPixels / hip.silhouetteGlanceTravelPixels;
            const vertex = head.glanceTravelPixels / hip.glanceTravelPixels;

            ( gazeHead ? withGaze : withoutGaze ).push( { seed, axial, silhouette, vertex } );

            console.log( `  ${ String( seed ).padStart( 10 ) }   ${ label.padEnd( 18 ) } ` +
                `${ head.axialGlanceTravelPixels.toFixed( 3 ).padStart( 7 ) }  ` +
                `${ hip.axialGlanceTravelPixels.toFixed( 3 ).padStart( 7 ) }   ` +
                `${ axial.toFixed( 4 ).padStart( 11 ) }   ${ silhouette.toFixed( 4 ).padStart( 17 ) }   ` +
                `${ vertex.toFixed( 4 ).padStart( 16 ) }` );

        }

    }

    console.log( '' );

    // The gate the render is judged by, on the composition the render is of.
    gate( `full stack head/hip, ${ GLANCE_WINDOW_SECONDS } s median, AXIAL, worst seed`,
        Math.max( ...withGaze.map( ( each ) => each.axial ) ),
        HEAD_BAND_OVER_HIP_BAND_FLOOR, HEAD_BAND_OVER_HIP_BAND_CEILING,
        'the same statistic and the same band GLANCE LEGIBILITY uses, on ten layers instead of one' );

    // 🎯 AND THE ARM-INCLUSIVE READING OF THE SAME TEN LAYERS, RECORDED — because on the full stack
    // the arms are ALSO being driven, by BodyIdle, HandIdle and IdleMotion, so the hip band's 56/89
    // arm vertices are carrying three other layers' motion into the denominator of a claim about the
    // pelvis. This is the number a judge's `travel.mjs` will report off a render and it must be on
    // the page next to the one the gate uses, or the two will be confused again.
    const armInclusive = withGaze.map( ( each ) => each.silhouette );

    note( 'the same stack, arm-inclusive head/hip',
        `${ Math.min( ...armInclusive ).toFixed( 4 ) } - ${ Math.max( ...armInclusive ).toFixed( 4 ) }`,
        `against ${ Math.min( ...withGaze.map( ( each ) => each.axial ) ).toFixed( 4 ) } - ` +
        `${ Math.max( ...withGaze.map( ( each ) => each.axial ) ).toFixed( 4 ) } axial. A judge's rendered ` +
        'clips scored 1.0596 and 1.2045 on the arm-inclusive form, before this round moved the trunk' );

    // 🎯 THE ATTRIBUTION, BY TOGGLE, AND IT IS THE POINT OF THE SECTION. Asserted as a CEILING on how
    // much gaze.head can move the verdict, so that "the residue is gaze.head amplitude" cannot be
    // restated without this going red first.
    const gazeEffect = withGaze.map( ( each, index ) =>
        Math.abs( each.axial - withoutGaze[ index ].axial ) );

    gate( 'gaze.head\'s effect on the silhouette ratio (absolute)', Math.max( ...gazeEffect ), 0, 0.05,
        `recorded, not tolerated: ${ gazeEffect.map( ( value ) => value.toFixed( 4 ) ).join( ' ' ) }. The ` +
        'brief for this round named gaze.head amplitude as the residue; on the statistic the judge ' +
        'measured it is worth a fortieth of the gap to the ceiling' );

    // 🚩 AND THE SAME TOGGLE ON THE OTHER STATISTIC, WHERE IT IS ENORMOUS. Recorded as a gate because
    // this pair of numbers IS the finding: one instrument says gaze.head triples the head's travel
    // and the other says it changes nothing, and only one of them is what a camera sees.
    const vertexEffect = withGaze.map( ( each, index ) => each.vertex / withoutGaze[ index ].vertex );

    gate( 'the VERTEX statistic says gaze.head triples it (x)', Math.min( ...vertexEffect ), 3.0, 10,
        `recorded, not tolerated: ${ vertexEffect.map( ( value ) => value.toFixed( 2 ) ).join( ' ' ) }x on ` +
        'a vertex mean against ' +
        `${ Math.max( ...gazeEffect ).toFixed( 4 ) } of absolute change on the silhouette` );

}

/**
 * The ten layers `alive.js` builds, in its order, with its options — kept in one place so that a
 * change to the page has one place to be mirrored.
 *
 * ⚠️ THIS IS A COPY AND COPIES DRIFT. `packages/testbed/src/alive.js` is not this agent's file and
 * cannot be imported here (it reaches for a DOM on module load). The mirror is asserted rather than
 * trusted: FULL STACK's own numbers reproduce a render taken from that page to 3.2%, which is the
 * check that the composition is the same one. If that agreement ever widens, suspect this function
 * before suspecting the layers.
 *
 * `gazeHead: false` removes ONLY the head half of the gaze pair, leaving the eyes driven, which is
 * the isolation the attribution needs.
 */
function buildAliveStack( seed, { gazeHead = true } = {} ) {

    restoreRestPose();

    const root = figure.root;
    const stack = new MotionStack( { seed } );

    stack.bind( createMotionTarget( root ) );

    const bodyIdle = new BodyIdle();
    const gaze = new Gaze( { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES } );
    const sway = new Sway( { onWeightShift: ( shift ) => bodyIdle.onWeightShift( shift ) } );

    const layers = [
        new Breath(), sway, new IdleMotion( { armsEnabled: 'auto' } ), bodyIdle, new HandIdle(),
        ...( gazeHead ? [ gaze.head ] : [] ), gaze, new Blink(), new FacialIdle(), new Pupil()
    ];

    for ( const layer of layers ) stack.add( layer );

    return { stack, layer: sway, root };

}

/**
 * The ankle joint's height above the floor, in millimetres, in the pose the stack runs in.
 *
 * Read off the rig rather than typed in, because the shank lever bracket the tracking gate uses is
 * derived from it and a different figure must move the bracket rather than silently keep this one.
 */
function anklePivotMillimetres() {

    restoreRestPose();
    figure.root.updateMatrixWorld( true );

    const bounds = new Box3().setFromObject( figure.root );
    const foot = figure.root.getObjectByName( 'foot_l' );

    return ( new Vector3().setFromMatrixPosition( foot.matrixWorld ).y - bounds.min.y ) * 1000;

}

/**
 * §1.1 and §1.1a. Two states the gates above must reject, each run over THE SAME TWELVE SEEDS the
 * forward gates use, each asserted as a COUNT of seeds caught rather than as one verdict.
 *
 *   - `anklePendulumShare: 0, stanceBlendEnabled: false` is the spine-bend model that produced
 *     exactly 0.0000 mm below the hips over 600 frames, the failure `Sway.js` was rewritten for.
 *   - `lateralRightingEnabled: false` is the body that leans without righting its lumbar: a rigid
 *     lever about the ankles, which is what the head-band ceiling is entitled to resolve and the
 *     only thing it is entitled to resolve. See HEAD_BAND_OVER_HIP_BAND_CEILING.
 *
 * 🚩 The count matters more than the verdict. The version of this section that shipped before ran
 * its rejection on one seed, and so did the forward gate it was proving — which is how a forward
 * gate that fails on two of twelve seeds was signed off as green by a rejection that agreed with it.
 */
function measureGlanceLegibilityTheOtherWay( framing, shipped, at ) {

    const spineBend = SWAY_SEEDS.map( ( seed ) =>
        bandTravelPixels( seed, { anklePendulumShare: 0, stanceBlendEnabled: false }, framing ) );

    const unrighted = SWAY_SEEDS.map( ( seed ) =>
        bandTravelPixels( seed, { lateralRightingEnabled: false }, framing ) );

    const spineBendKnees = spineBend.map( ( report ) => at( report, 'knee' ).glanceTravelPixels );
    const spineBendAnkles = spineBend.map( ( report ) => at( report, 'ankle' ).glanceTravelPixels );
    const shippedAnkles = shipped.map( ( report ) => at( report, 'ankle' ).glanceTravelPixels );

    note( 'spine-bend model, knee / ankle travel over 12 seeds (px)',
        `${ Math.max( ...spineBendKnees ).toFixed( 4 ) } / ${ Math.max( ...spineBendAnkles ).toFixed( 4 ) } at their worst`,
        `against ${ Math.min( ...shipped.map( ( report ) => at( report, 'knee' ).glanceTravelPixels ) ).toFixed( 2 ) } / ` +
        `${ Math.min( ...shippedAnkles ).toFixed( 2 ) } as constructed` );

    gate( 'seeds where the knee floor CATCHES the spine-bend model',
        spineBendKnees.filter( ( value ) => value < SILHOUETTE_WIDTH_FLOOR_PIXELS ).length,
        SWAY_SEEDS.length, SWAY_SEEDS.length,
        'this configuration is the historical 0.0000 mm lower body, on every seed' );

    // The tracking gate is stated on the lean, so its rejection is read off the same two series.
    const spineBendSlopes = spineBend.map( ( report ) => regressionSlope( at( report, 'knee' ).samples, at( report, 'ankle' ).samples ) );
    const spineBendCorrelations = spineBend.map( ( report ) => pearson( at( report, 'ankle' ).samples, at( report, 'knee' ).samples ) );

    gate( 'seeds where the tracking gate CATCHES it too',
        spineBendCorrelations.filter( ( value ) => value < SHANK_TRACKS_KNEE_CORRELATION_FLOOR ).length,
        SWAY_SEEDS.length, SWAY_SEEDS.length,
        `a shank not tracking a knee that is not moving: slope ${ Math.max( ...spineBendSlopes ).toFixed( 3 ) }, ` +
        `correlation ${ Math.max( ...spineBendCorrelations ).toFixed( 3 ) } at their most favourable` );

    // 🎯 THE GATE THE OLD 1.00 CEILING WAS REACHING FOR, stated where the band can resolve it — and
    // stated on the AXIAL silhouette, because that is the statistic the forward gate is on and a
    // rejection measured on a different statistic proves a different gate (§1.1a, one level up).
    const unrightedRatios = unrighted.map( ( report ) =>
        at( report, 'head' ).axialGlanceTravelPixels / at( report, 'hip' ).axialGlanceTravelPixels );

    const unrightedArmInclusive = unrighted.map( ( report ) =>
        at( report, 'head' ).silhouetteGlanceTravelPixels / at( report, 'hip' ).silhouetteGlanceTravelPixels );

    note( 'unrighted lumbar, head band / hip band over 12 seeds',
        `${ Math.min( ...unrightedRatios ).toFixed( 3 ) } - ${ Math.max( ...unrightedRatios ).toFixed( 3 ) } axial`,
        `arm-inclusive the same twelve read ${ Math.min( ...unrightedArmInclusive ).toFixed( 3 ) } - ` +
        `${ Math.max( ...unrightedArmInclusive ).toFixed( 3 ) }, against a rigid-lever prediction of 1.805 from ` +
        'the band centroids — the two statistics agree HERE because a rigid body carries its arms with it' );

    gate( 'seeds where the head-band ceiling CATCHES an unrighted lumbar',
        unrightedRatios.filter( ( value ) => value > HEAD_BAND_OVER_HIP_BAND_CEILING ).length,
        SWAY_SEEDS.length, SWAY_SEEDS.length,
        `every seed, by at least ${ ( Math.min( ...unrightedRatios ) / HEAD_BAND_OVER_HIP_BAND_CEILING ).toFixed( 2 ) }x` );

    // 🚩 A SECOND KNOWN-BAD IN THE SAME CLASS, BY A DIFFERENT MECHANISM — the standing instruction
    // that a gate proved only against its own known-bad is decorative. `lateralRightingEnabled:
    // false` removes the righting entirely and is a big, structural change. This one leaves the
    // righting in place and simply parks the head: `LATERAL_HEAD_PER_CENTRE_OF_MASS` at 0.30 is the
    // mannequin head a verifier once built, which scored BETTER than the shipped layer on every
    // one-sided ratio gate in HEAD PARKED. The FLOOR is what has to catch it.
    //
    // 🚩 AND IT INHERITS THE SHIPPED SPREAD RATHER THAN NAMING ONE (§1.25n). The version of this
    // known-bad that stood here pinned `lateralShiftCouple: SPINE_SHARE_TILT`, and the comment beside
    // it explained at length that the tilt was PART of what made the head a mannequin — because
    // under the 80% give-back that shipped then, a 0.30 target "does not park the head at all... it
    // reads 1.029-1.210". Both halves of that stopped being true the moment the spread became a pure
    // couple: measured here, `{ lateralHeadPerCentreOfMass: 0.30 }` on the shipped spread scores
    // 0.24-0.35 axial, which is a mannequin by any reading. A known-bad that pins a constant the
    // shipped layer has moved away from is testing a configuration nobody ships.
    const parked = SWAY_SEEDS.map( ( seed ) =>
        bandTravelPixels( seed, { lateralHeadPerCentreOfMass: 0.30 }, framing ) );

    const parkedRatios = parked.map( ( report ) =>
        at( report, 'head' ).axialGlanceTravelPixels / at( report, 'hip' ).axialGlanceTravelPixels );

    gate( 'seeds where the head-band FLOOR catches a parked head',
        parkedRatios.filter( ( value ) => value < HEAD_BAND_OVER_HIP_BAND_FLOOR ).length,
        SWAY_SEEDS.length, SWAY_SEEDS.length,
        `a head moving 30% of the centre of mass scores ${ Math.min( ...parkedRatios ).toFixed( 3 ) }-` +
        `${ Math.max( ...parkedRatios ).toFixed( 3 ) } against a ${ HEAD_BAND_OVER_HIP_BAND_FLOOR } floor` );

    // 🎯 AND THE PARKED HEAD ON THE STATISTIC THIS ROUND RETIRED, which is the point of retiring it:
    // arm-inclusive, the same mannequin scores INSIDE the old 0.80-1.40 band on some seeds, so the
    // instrument that blocked the fix could also miss the defect the floor exists for.
    const parkedArmInclusive = parked.map( ( report ) =>
        at( report, 'head' ).silhouetteGlanceTravelPixels / at( report, 'hip' ).silhouetteGlanceTravelPixels );

    note( 'the same parked head, arm-inclusive',
        `${ Math.min( ...parkedArmInclusive ).toFixed( 3 ) } - ${ Math.max( ...parkedArmInclusive ).toFixed( 3 ) }`,
        'against 0.24-0.35 axial: one clip, two readings, and only one of them says mannequin' );

    // 🚩 RECORDED AS A GATE, §1.1a. The ceiling that shipped before was 1.00, and it would have
    // caught the unrighted layer too — but it also caught the SHIPPED layer on several of these
    // twelve seeds. Asserted in both directions so that neither half of that is forgotten, and on
    // the arm-inclusive statistic, which is where a judge's 1.0596 came from.
    const shippedRatios = shipped.map( ( report ) =>
        at( report, 'head' ).silhouetteGlanceTravelPixels / at( report, 'hip' ).silhouetteGlanceTravelPixels );

    gate( 'seeds a 1.00 ceiling would have FAILED on the shipped layer',
        shippedRatios.filter( ( value ) => value > 1.0 ).length, 1, SWAY_SEEDS.length,
        `recorded, not tolerated: ${ shippedRatios.filter( ( value ) => value > 1.0 ).map( ( value ) => value.toFixed( 3 ) ).join( ' ' ) } ` +
        '— which is why a judge measuring 1.0596 on a render scored it against the WRONG gate. 1.00 ' +
        'is the BONE-MARKER ceiling from HEAD PARKED and does not describe a band ratio' );

    // 🚩 RECORDED AS A GATE, §1.3 AND §1.10a. The heat map cannot see this and neither can a raw
    // standard deviation. Over the twelve seeds the ankle band's raw SD spans 0.168-1.398 px while
    // the statistic the 1.6 px floor is actually stated in — the median peak-to-peak inside a 15 s
    // window — spans 0.29-1.50 px. They are not the same measurement even where they are the same
    // size: a 420 s trace carries a slow drift the SD counts in full and a 15 s window barely sees.
    // Asserted so nobody restates this gate on an SD and thinks it says the same thing.
    const ankleSds = shipped.map( ( report ) => at( report, 'ankle' ).rawSdPixels );

    gate( 'seeds where a raw SD would clear the floor',
        ankleSds.filter( ( value ) => value > SILHOUETTE_WIDTH_FLOOR_PIXELS ).length, 0, 0,
        `recorded, not tolerated: raw SD ${ Math.min( ...ankleSds ).toFixed( 3 ) }-${ Math.max( ...ankleSds ).toFixed( 3 ) } px ` +
        `against a peak-to-peak floor of ${ SILHOUETTE_WIDTH_FLOOR_PIXELS }` );

    // The shipped shank is not dead, which is the one absolute statement this band supports.
    gate( 'ankle band travel, worst seed (px)', Math.min( ...shippedAnkles ),
        ANKLE_BAND_NOT_DEAD_PIXELS, GLANCE_TRAVEL_CEILING_PIXELS,
        `against the spine-bend model's ${ Math.max( ...spineBendAnkles ).toFixed( 4 ) } px on its liveliest seed` );

}

/**
 * Per-band screen travel of the skinned mesh, in pixels, over one run of one configuration.
 *
 * The bands are `travel.mjs`'s, whose bounds are fractions of the CAPTURE FRAME. They are converted
 * here into heights above the floor so that they land on the same anatomy offline as they do in a
 * capture, and the converted bounds are printed in millimetres so the two can be checked against
 * each other by hand.
 *
 * The seed is a parameter rather than a constant because the section runs the whole twelve — see
 * §1.1a and the header. The centroid and the population are recorded alongside the travel, because
 * the tracking gate's lever bracket is derived from the first and the second is gated in its own
 * right.
 */
function bandTravelPixels( seed, options, framing, makeStack = buildStack ) {

    const { stack, layer, root } = makeStack( seed, options ); // eslint-disable-line no-unused-vars

    root.updateMatrixWorld( true );

    const bounds = new Box3().setFromObject( root );
    const floor = bounds.min.y;
    const statureMetres = bounds.max.y - floor;

    const bands = GLANCE_BANDS.map( ( band ) => {

        // A frame fraction, measured from the top of the FRAME, becomes a height above the floor.
        // The figure is centred in a frame BODY_FRAME_MARGIN taller than it is.
        const framedTop = ( 1 - 1 / BODY_FRAME_MARGIN ) / 2;
        const toHeight = ( fraction ) => 1 - ( fraction - framedTop ) * BODY_FRAME_MARGIN;

        return {
            name: band.name,
            low: toHeight( band.bottom ),
            high: toHeight( band.top ),
            lowMillimetres: toHeight( band.bottom ) * statureMetres * 1000,
            highMillimetres: toHeight( band.top ) * statureMetres * 1000,
            vertexCount: 0,
            axialCount: 0,
            armCount: 0,
            restHeightSumMillimetres: 0,
            samples: [],
            silhouetteSamples: [],
            axialSilhouetteSamples: [],
            axialVertexSamples: [],
            armSilhouetteSamples: []
        };

    } );

    const vertex = new Vector3();
    const sets = [];

    root.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        const position = object.geometry.attributes.position;

        // One list of vertex indices per band, and a PARALLEL list of flags saying which of them are
        // on the arm chain — rather than three lists. The frame loop below transforms each vertex
        // exactly once and folds it into whichever accumulators it belongs to; three lists would
        // have tripled the cost of the longest section in this file.
        const groups = bands.map( () => ( { all: [], arm: [] } ) );

        for ( let index = 0; index < position.count; index += GLANCE_VERTEX_STRIDE ) {

            vertex.fromBufferAttribute( position, index );
            object.applyBoneTransform( index, vertex );
            object.localToWorld( vertex );

            const height = ( vertex.y - floor ) / statureMetres;
            const onTheArm = isOnTheArmChain( object, index );

            bands.forEach( ( band, index2 ) => {

                if ( height < band.low || height > band.high ) return;

                groups[ index2 ].all.push( index );
                groups[ index2 ].arm.push( onTheArm );

                band.vertexCount ++;
                band.restHeightSumMillimetres += ( vertex.y - floor ) * 1000;

                if ( onTheArm ) band.armCount ++;
                else band.axialCount ++;

            } );

        }

        if ( groups.some( ( group ) => group.all.length > 0 ) ) sets.push( { mesh: object, groups, position } );

    } );

    const frames = Math.round( GLANCE_SECONDS * GLANCE_SAMPLE_RATE_HZ );

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( 1 / GLANCE_SAMPLE_RATE_HZ );
        root.updateMatrixWorld( true );

        const totals = bands.map( () => ( {
            sum: 0, count: 0,
            axialSum: 0, axialCount: 0,
            low: Infinity, high: -Infinity,
            axialLow: Infinity, axialHigh: -Infinity,
            armLow: Infinity, armHigh: -Infinity
        } ) );

        for ( const { mesh, groups, position } of sets ) {

            for ( let index = 0; index < bands.length; index ++ ) {

                const { all, arm } = groups[ index ];
                const total = totals[ index ];

                for ( let slot = 0; slot < all.length; slot ++ ) {

                    const vertexIndex = all[ slot ];

                    vertex.fromBufferAttribute( position, vertexIndex );
                    mesh.applyBoneTransform( vertexIndex, vertex );
                    mesh.localToWorld( vertex );

                    const screen = vertex.dot( framing.screenRight );

                    total.sum += screen;
                    total.count ++;

                    if ( screen < total.low ) total.low = screen;
                    if ( screen > total.high ) total.high = screen;

                    // 🎯 The same rows split two more ways in the same pass, once with the arm chain
                    // removed and once with nothing BUT the arm chain. See BAND PROVENANCE.
                    if ( arm[ slot ] ) {

                        if ( screen < total.armLow ) total.armLow = screen;
                        if ( screen > total.armHigh ) total.armHigh = screen;

                    } else {

                        if ( screen < total.axialLow ) total.axialLow = screen;
                        if ( screen > total.axialHigh ) total.axialHigh = screen;

                        total.axialSum += screen;
                        total.axialCount ++;

                    }

                }

            }

        }

        bands.forEach( ( band, index ) => {

            const scale = 1000 * framing.pixelsPerMillimetre;

            band.samples.push( totals[ index ].sum / totals[ index ].count * scale );

            // 🎯 THE SILHOUETTE'S OWN CENTRE, which is a different quantity from the one above and
            // is the one `travel.mjs` reports. See SILHOUETTE VERSUS VERTEX CENTROID.
            band.silhouetteSamples.push( ( totals[ index ].low + totals[ index ].high ) / 2 * scale );

            band.axialSilhouetteSamples.push(
                Number.isFinite( totals[ index ].axialLow )
                    ? ( totals[ index ].axialLow + totals[ index ].axialHigh ) / 2 * scale : NaN );

            band.axialVertexSamples.push( totals[ index ].axialCount === 0 ? NaN
                : totals[ index ].axialSum / totals[ index ].axialCount * scale );

            band.armSilhouetteSamples.push(
                Number.isFinite( totals[ index ].armLow )
                    ? ( totals[ index ].armLow + totals[ index ].armHigh ) / 2 * scale : NaN );

        } );

    }

    stack.dispose();

    for ( const band of bands ) {

        const glance = slidingWindowPeakToPeak( band.samples, GLANCE_WINDOW_SECONDS ).sort( ( a, b ) => a - b );

        band.rawSdPixels = standardDeviation( band.samples );
        band.highPassedSdPixels = standardDeviation( highPassed( band.samples, GLANCE_WINDOW_SECONDS ) );
        band.glanceTravelPixels = glance[ Math.floor( glance.length / 2 ) ];
        band.glanceQuietTenthPixels = glance[ Math.floor( 0.10 * glance.length ) ];
        band.centroidMillimetres = band.restHeightSumMillimetres / Math.max( band.vertexCount, 1 );

        const silhouette = slidingWindowPeakToPeak( band.silhouetteSamples, GLANCE_WINDOW_SECONDS )
            .sort( ( a, b ) => a - b );

        band.silhouetteGlanceTravelPixels = silhouette[ Math.floor( silhouette.length / 2 ) ];
        band.silhouetteWholeClipPixels = peakToPeak( band.silhouetteSamples );
        band.wholeClipPixels = peakToPeak( band.samples );

        const axial = slidingWindowPeakToPeak( band.axialSilhouetteSamples, GLANCE_WINDOW_SECONDS )
            .sort( ( a, b ) => a - b );

        band.axialGlanceTravelPixels = axial[ Math.floor( axial.length / 2 ) ];
        band.axialWholeClipPixels = peakToPeak( band.axialSilhouetteSamples );

        const axialVertex = slidingWindowPeakToPeak( band.axialVertexSamples, GLANCE_WINDOW_SECONDS )
            .sort( ( a, b ) => a - b );

        band.axialVertexGlanceTravelPixels = axialVertex[ Math.floor( axialVertex.length / 2 ) ];

        // The correlation is the ATTRIBUTION, and it is computed here so every caller gets it for
        // free rather than re-deriving it. On the hip band it reads 1.000 against the arm.
        band.armAgreement = band.armCount === 0 ? NaN
            : pearson( band.silhouetteSamples, band.armSilhouetteSamples );
        band.axialAgreement = band.axialCount === 0 ? NaN
            : pearson( band.silhouetteSamples, band.axialSilhouetteSamples );

    }

    return { bands };

}

/**
 * 🎯 Whether a vertex belongs to the ARM CHAIN — the appendicular skeleton from the shoulder joint
 * out — decided by which bone carries the largest share of its skin weight.
 *
 * This exists because of a defect that cost a round, and the defect is worth stating in full at the
 * one function that answers the question. `travel.mjs` and this file both report a band's position
 * as the CENTRE OF ITS SILHOUETTE: the midpoint of the leftmost and rightmost projected vertex in a
 * horizontal slice of the frame. On a standing human the leftmost and rightmost points of almost any
 * slice are LIMBS. Measured on `figure_g050` in `relaxed-standing` at stride 11:
 *
 *     band       rows (mm)     verts   both silhouette EDGES set by
 *     head       1377-1596       971   upperarm_r and spine_03 — the SHOULDERS, at the bottom row
 *     shoulder   1158-1377       106   upperarm_r and upperarm_l — the deltoids, correctly
 *     hip         793-976         89   hand_r and lowerarm_l — 56 of the 89 verts are arm
 *     knee        428-611         31   thigh_r and calf_l — no arm in the band at all
 *
 * The hip band is 491.7 mm wide on a pelvis 340 mm across, because the hands hang wider than the
 * hips. And the arms are children of the THORAX, so a band named for the pelvis moves with the
 * ribcage. That is not a rounding error in the statistic; it is the statistic measuring a different
 * body part, and every gate whose denominator was the hip band inherited it.
 *
 * The deltoids stay in the shoulder band deliberately — the shoulder line a viewer sees IS where the
 * deltoids are — so this predicate names the chain from the shoulder JOINT outward and the axial
 * reading of the shoulder band is its 67 ribcage-and-clavicle vertices.
 */
function isOnTheArmChain( mesh, index ) {

    const skinIndex = mesh.geometry.attributes.skinIndex;
    const skinWeight = mesh.geometry.attributes.skinWeight;

    let dominant = -1;
    let heaviest = -1;

    for ( const component of [ 'X', 'Y', 'Z', 'W' ] ) {

        const weight = skinWeight[ `get${ component }` ]( index );

        if ( weight > heaviest ) {

            heaviest = weight;
            dominant = skinIndex[ `get${ component }` ]( index );

        }

    }

    return ARM_CHAIN_BONE.test( mesh.skeleton.bones[ dominant ]?.name ?? '' );

}

/**
 * How far a signal travels inside each window of a given length, peak to peak — the quantity the
 * 1.6 px floor is stated in, evaluated over the span a viewer actually watches.
 *
 * Windows step by one second rather than by one sample, which costs nothing: the statistic reported
 * is a median over hundreds of them.
 */
function slidingWindowPeakToPeak( samples, seconds ) {

    const width = Math.round( seconds * GLANCE_SAMPLE_RATE_HZ );
    const step = Math.round( GLANCE_SAMPLE_RATE_HZ );
    const travels = [];

    for ( let start = 0; start + width <= samples.length; start += step ) {

        let low = Infinity;
        let high = -Infinity;

        for ( let index = start; index < start + width; index ++ ) {

            if ( samples[ index ] < low ) low = samples[ index ];
            if ( samples[ index ] > high ) high = samples[ index ];

        }

        travels.push( high - low );

    }

    return travels;

}

/**
 * The signal with everything slower than `seconds` removed, by subtracting a boxcar mean of that
 * width. Reported beside the window travel because it is the statistic the defect was reported in,
 * and the two need to be readable against each other.
 */
function highPassed( samples, seconds ) {

    const half = Math.floor( Math.round( seconds * GLANCE_SAMPLE_RATE_HZ ) / 2 );
    const prefix = new Float64Array( samples.length + 1 );

    for ( let index = 0; index < samples.length; index ++ ) prefix[ index + 1 ] = prefix[ index ] + samples[ index ];

    const out = [];

    for ( let index = half; index < samples.length - half; index ++ ) {

        const from = Math.max( 0, index - half );
        const to = Math.min( samples.length, index + half + 1 );

        out.push( samples[ index ] - ( prefix[ to ] - prefix[ from ] ) / ( to - from ) );

    }

    return out;

}

/**
 * 🎯 TRUNK ARTICULATION — does the weight shift reach the TORSO, or only move it?
 *
 * A hip strategy is by definition trunk-relative-to-pelvis motion: the pelvis stacks over the loaded
 * foot, the stance-side crest rises, and the shoulder line ends up tilted OPPOSITE the hip line.
 * `figure/poses/weight-left.json` draws exactly that and says why — "it is that divergence... that
 * produces the S every life class teaches. Tilt them the same way and the figure looks braced, not
 * resting" — and measures its own result at hip line +5.5°, shoulder line -3.0°.
 *
 * 🚩 NONE OF IT WAS REACHING THE RENDER, AND EVERY GATE IN THIS FILE WAS GREEN. A blind judge
 * measured, on both 420 s clips at the shipped default: shoulder-band centroid minus hip-band
 * centroid, SD 0.756 px and 0.709 px, against hip bands of 9.29 and 10.96 px and a pelvis travelling
 * 52 px peak to peak. Seven per cent articulation inside the translation. An unaligned A/B of the two
 * extreme frames showed the navel and crotch lines level and the shoulder line parallel to the pelvis
 * line; the per-pixel heat map of the same clip showed a bright sweeping silhouette edge around a
 * dead torso interior.
 *
 * 🚩 WHY NOTHING CAUGHT IT, WHICH IS THE PART WORTH KEEPING. Every lateral gate in this file is a
 * RATIO OF TWO LANDMARK TRAVELS — head over centre of mass, head over pelvis, head band over hip
 * band. A rigid body translating sideways moves every landmark by the same amount, so it scores
 * exactly 1.000 on all of them, and 1.000 was the design target. The whole gate battery was
 * satisfiable by the degenerate case, and the solve, being exact, found it. §1.3: ask of any green
 * metric what a degenerate input would score here.
 *
 * 🎯 SO THIS SECTION IS STATED ON A DIFFERENCE AND NOT ON A RATIO. A rigid slab scores ZERO, not one.
 *
 *   THE PRIMARY CLAIM is the realised shoulder line as a FRACTION of the one the pose draws, per
 *   side, at unit blend, read off the rig rather than off a trace. It is a bind-time geometric fact
 *   with no seed in it, it is causally the thing the judge described, and its known-bads separate
 *   from it by 2.8x, by 11x and by SIGN rather than by a few per cent.
 *
 *   THE SECOND CLAIM is the judge's own statistic, in his own units, so the two can be laid side by
 *   side: shoulder-band silhouette centre minus hip-band silhouette centre, over the same twelve
 *   seeds every other amplitude gate here runs over.
 *
 * ✅ AND THE "HONEST PART" THAT USED TO STAND HERE IS CLOSED, BECAUSE ITS DIAGNOSIS WAS WRONG.
 * It read: *"The shipped spread restores 0.33-0.35 of the authored shoulder line... A wider give-back
 * is better on every measure in here and is blocked by GLANCE LEGIBILITY's `head/hip` ceiling — a
 * ratio whose DENOMINATOR is the hip band, which travels furthest exactly when the abdomen is
 * rigid."*
 *
 * The ceiling was the blocker; the reason given for it was not. The hip band does not travel
 * furthest when the abdomen is rigid — the PELVIS travels furthest when the trunk articulates most,
 * 13.92-17.03 px under the pure couple against 9.38-11.50 unrighted. What collapses under
 * articulation is the band's ARM population, which is 56 of its 89 vertices and sets both of its
 * silhouette edges. The arms hang from the thorax; the thorax goes inboard; the "hip" band follows
 * it. Restated on the axial vertices the pure couple is better on every measure in here AND on the
 * ratio that blocked it, and `LATERAL_SHIFT_COUPLE` is now `[ 1, 0, -1 ]`:
 *
 *     spread                  shoulder line    head/hip axial    shoulder-minus-hip axial (px)
 *     [ 1, 0, -1 ]  shipped     0.996 / 0.996       0.67-0.80                   5.39-6.70
 *     [ 0, 1, -0.8 ] the 80%    0.350 / 0.324       0.90-1.03                   2.39-2.99
 *     [ 0.5,0.3,0.2 ] tilt      0.082 / 0.044       0.97-1.11                   2.13-2.46
 *     [ 0, 0, 1 ]  top joint   -0.064 / -0.107      1.01-1.15                   2.03-2.44
 *
 * ⚠️ WHAT IS STILL HONEST-BUT-SHORT, restated on the right statistic. The trace differential
 * separates the shipped layer from the tilt by 1.7x where the geometric shoulder-line claim
 * separates them by 11x, and it CANNOT separate it from an unrighted body at all (4.61-5.90 px,
 * overlapping). A difference between two band positions is large both for an articulated trunk and
 * for a rigid lever about a pivot far below both bands. The shoulder line remains the claim.
 */
function measureTrunkArticulation() {

    section( 'TRUNK ARTICULATION — does the shift reach the torso, or only move it?' );

    const framing = fullBodyFraming();
    const shipped = shoulderLineFractions( {} );

    note( 'shoulder line the pose draws (deg, left / right)',
        `${ shipped.authored.left.toFixed( 2 ) } / ${ shipped.authored.right.toFixed( 2 ) }`,
        `weight-left.json declares -3.0 against a hip line of +5.5; measured here at unit blend ` +
        `against ${ shipped.hipLine.left.toFixed( 2 ) } / ${ shipped.hipLine.right.toFixed( 2 ) }` );

    note( 'shoulder line the layer realises (deg, left / right)',
        `${ shipped.realised.left.toFixed( 2 ) } / ${ shipped.realised.right.toFixed( 2 ) }`,
        'the pose, plus whatever the lateral righting spends on the same three joints' );

    for ( const side of [ 'left', 'right' ] ) {

        gate( `realised shoulder line / authored, ${ side }`, shipped.fraction[ side ],
            SHOULDER_LINE_REALISED_BAND[ 0 ], SHOULDER_LINE_REALISED_BAND[ 1 ],
            'an EQUALITY, because the righting spread sums to zero and therefore cannot rotate the ' +
            'shoulder girdle at all. A torso that translates rigidly scores 1.000 on every other ' +
            'lateral gate in this file and is caught here only by the head-over-hip band' );

    }

    // The judge's own statistic, in the judge's own units, over the twelve seeds. Reported with a
    // floor rather than only reported, because §1.9 is about claims nobody has looked at and this
    // one has been looked at — by a judge, on a render, who called it 7%.
    const differentials = SWAY_SEEDS.map( ( seed ) => trunkDifferential( seed, {}, framing ) );

    console.log( '' );
    console.log( '        shoulder band minus hip band, silhouette centres, per seed' );
    console.log( '        seed     axial SD (px)   axial 15 s (px)   arm-inclusive 15 s   as a fraction of the hip band SD' );

    for ( let index = 0; index < SWAY_SEEDS.length; index ++ ) {

        const each = differentials[ index ];

        console.log( `  ${ String( SWAY_SEEDS[ index ] ).padStart( 12 ) }   ${ each.axialSdPixels.toFixed( 3 ).padStart( 12 ) }   ` +
            `${ each.axialGlancePixels.toFixed( 3 ).padStart( 15 ) }   ${ each.glancePixels.toFixed( 3 ).padStart( 18 ) }   ` +
            `${ each.overHipSd.toFixed( 4 ).padStart( 32 ) }` );

    }

    console.log( '' );

    gate( 'shoulder-minus-hip, AXIAL, 15 s travel, worst seed (px)',
        Math.min( ...differentials.map( ( each ) => each.axialGlancePixels ) ),
        TRUNK_DIFFERENTIAL_FLOOR_PIXELS, GLANCE_TRAVEL_CEILING_PIXELS,
        'the differential a judge measured at 0.756 px of SD; the floor is stated on the same 15 s ' +
        'median peak-to-peak every other band claim in this file uses' );

    // 🚩 The arm-inclusive form of the SAME twelve traces, recorded rather than gated, because it is
    // the number a judge's `travel.mjs` will report and a successor must be able to see both.
    note( 'the same differential arm-inclusive, over 12 seeds (px)',
        `${ Math.min( ...differentials.map( ( each ) => each.glancePixels ) ).toFixed( 3 ) } - ` +
        `${ Math.max( ...differentials.map( ( each ) => each.glancePixels ) ).toFixed( 3 ) }`,
        `against the axial ${ Math.min( ...differentials.map( ( each ) => each.axialGlancePixels ) ).toFixed( 3 ) } - ` +
        `${ Math.max( ...differentials.map( ( each ) => each.axialGlancePixels ) ).toFixed( 3 ) } — the arms ride the ` +
        'thorax, so an arm-inclusive hip band cancels most of the very thing this section measures' );

    measureTrunkArticulationTheOtherWay( framing, shipped, differentials );

}

/**
 * §1.1 and 🚩 the standing instruction that follows it: prove the gate red by putting the defect
 * back, and then BREAK IT A DIFFERENT WAY IN THE SAME CLASS. Three defects here, not two, because
 * the shipped spread changed this round and the state it replaced has to be rejected by name.
 *
 *   THE DEFECT ITSELF is `lateralShiftCouple: SPINE_SHARE_TILT` — the pure tilt this section was
 *   written for. Every degree of righting rotates the shoulder girdle by a degree, so the solve pays
 *   for the head with the S.
 *
 *   🚩 THE DIFFERENT MECHANISM is `[ 0, 0, 1 ]`: the whole righting at the TOP joint, which is the
 *   obvious "put the counter-bend where the shoulders are" edit and is a give-back that gives nothing
 *   back. It parks the head as well as the tilt does — so HEAD PARKED and the whole ratio battery
 *   stay green on it — and it does not merely flatten the shoulder line, it INVERTS it, tilting it
 *   the same way as the hip line. That is the "braced, not resting" figure `weight-left.json` warns
 *   about by name.
 *
 *   🎯 THE THIRD IS THE STATE THIS FILE ITSELF SHIPPED LAST ROUND, `[ 0, 1, -0.8 ]`. It is the
 *   hardest of the three and the one that matters, because it is not obviously broken: it restores a
 *   third of the S and passes every gate the previous round had. It is rejected here by 2.78x, and
 *   it is included because §1.25a is about gates that only catch their own known-bad and a spread
 *   that ALMOST works is the version a successor will reach for.
 *
 * 🚩 AND THE FOURTH THING PROVED RED IS NOT A LAYER AT ALL — it is the INSTRUMENT. The arm-inclusive
 * head-over-hip ratio is re-measured on the shipped layer and required to be OUTSIDE the band the
 * axial gate uses, because that is the whole finding: the two readings of one clip now disagree by
 * enough to flip a verdict, and a round that quietly went back to the arm-inclusive one would look
 * green while re-introducing the blocker.
 */
function measureTrunkArticulationTheOtherWay( framing, shipped, differentials ) {

    const inside = ( fraction ) =>
        fraction >= SHOULDER_LINE_REALISED_BAND[ 0 ] && fraction <= SHOULDER_LINE_REALISED_BAND[ 1 ];

    const tilt = shoulderLineFractions( { lateralShiftCouple: SPINE_SHARE_TILT } );
    const topOnly = shoulderLineFractions( { lateralShiftCouple: [ 0, 0, 1 ] } );
    const partial = shoulderLineFractions( { lateralShiftCouple: PARTIAL_GIVE_BACK } );

    note( 'the tilt this replaced, shoulder line / authored',
        `${ tilt.fraction.left.toFixed( 3 ) } / ${ tilt.fraction.right.toFixed( 3 ) }`,
        `against the shipped ${ shipped.fraction.left.toFixed( 3 ) } / ${ shipped.fraction.right.toFixed( 3 ) }` );

    note( 'the whole righting at the top joint, shoulder line / authored',
        `${ topOnly.fraction.left.toFixed( 3 ) } / ${ topOnly.fraction.right.toFixed( 3 ) }`,
        'NEGATIVE is the point: the shoulder line has been tipped the SAME way as the hip line' );

    note( 'last round\'s 80% give-back, shoulder line / authored',
        `${ partial.fraction.left.toFixed( 3 ) } / ${ partial.fraction.right.toFixed( 3 ) }`,
        'a spread that does not sum to zero scales the artist\'s tilt by a balance constant' );

    gate( 'sides where the shoulder-line band CATCHES the tilt',
        [ 'left', 'right' ].filter( ( side ) => inside( tilt.fraction[ side ] ) === false ).length,
        2, 2,
        `by ${ ( SHOULDER_LINE_REALISED_BAND[ 0 ] / Math.max( tilt.fraction.left, tilt.fraction.right ) ).toFixed( 1 ) }x ` +
        'on its more favourable side' );

    gate( 'sides where it CATCHES a give-back at the top joint too',
        [ 'left', 'right' ].filter( ( side ) => inside( topOnly.fraction[ side ] ) === false ).length,
        2, 2,
        'a different mechanism in the same class: the head is parked just as well and the S is ' +
        'inverted rather than merely lost' );

    gate( 'sides where it CATCHES last round\'s 80% give-back',
        [ 'left', 'right' ].filter( ( side ) => inside( partial.fraction[ side ] ) === false ).length,
        2, 2,
        `by ${ ( SHOULDER_LINE_REALISED_BAND[ 0 ] / Math.max( partial.fraction.left, partial.fraction.right ) ).toFixed( 2 ) }x ` +
        'on its more favourable side — the near-miss is the one worth catching' );

    // 🚩 AND THE RATIO GATES DO NOT CATCH THE SHAPE DEFECTS, which is why this section exists. On the
    // AXIAL reading the top-joint give-back scores 1.01-1.15 and the tilt 0.97-1.11 against a
    // 0.48-1.08 band, so the ceiling catches SOME of their seeds and neither of them reliably.
    // Stated as a count rather than as a pass so the partial coverage is on the report.
    const ratiosOf = ( options ) => SWAY_SEEDS.map( ( seed ) => {

        const report = bandTravelPixels( seed, options, framing );
        const at = ( name ) => report.bands.find( ( band ) => band.name === name );

        return at( 'head' ).axialGlanceTravelPixels / at( 'hip' ).axialGlanceTravelPixels;

    } );

    const topOnlyRatios = ratiosOf( { lateralShiftCouple: [ 0, 0, 1 ] } );
    const caught = topOnlyRatios.filter( ( value ) =>
        value > HEAD_BAND_OVER_HIP_BAND_CEILING || value < HEAD_BAND_OVER_HIP_BAND_FLOOR ).length;

    gate( 'seeds where head/hip catches the inverted shoulder line (partial, by design)',
        caught, 0, SWAY_SEEDS.length - 1,
        `recorded, not tolerated: ${ Math.min( ...topOnlyRatios ).toFixed( 3 ) }-` +
        `${ Math.max( ...topOnlyRatios ).toFixed( 3 ) } against a ${ HEAD_BAND_OVER_HIP_BAND_FLOOR }-` +
        `${ HEAD_BAND_OVER_HIP_BAND_CEILING } band, ${ caught } of ${ SWAY_SEEDS.length } caught — ` +
        'a ratio of two travels cannot see a shape, and the shoulder-line band above is what does' );

    const tiltDifferentials = SWAY_SEEDS.map( ( seed ) =>
        trunkDifferential( seed, { lateralShiftCouple: SPINE_SHARE_TILT }, framing ) );

    gate( 'seeds where the AXIAL differential floor catches the tilt',
        tiltDifferentials.filter( ( each ) => each.axialGlancePixels < TRUNK_DIFFERENTIAL_FLOOR_PIXELS ).length,
        SWAY_SEEDS.length, SWAY_SEEDS.length,
        `${ Math.min( ...tiltDifferentials.map( ( each ) => each.axialGlancePixels ) ).toFixed( 3 ) } - ` +
        `${ Math.max( ...tiltDifferentials.map( ( each ) => each.axialGlancePixels ) ).toFixed( 3 ) } px against a ` +
        `${ TRUNK_DIFFERENTIAL_FLOOR_PIXELS } floor and the shipped ` +
        `${ Math.min( ...differentials.map( ( each ) => each.axialGlancePixels ) ).toFixed( 3 ) } - ` +
        `${ Math.max( ...differentials.map( ( each ) => each.axialGlancePixels ) ).toFixed( 3 ) }` );

    // 🎯 THE SEPARATION EACH STATISTIC BUYS, which is the property that decides which one to gate on
    // and is the thing the previous round's "separates by a fifth" was about.
    //
    // ⚠️ THE FIRST VERSION OF THIS GATE WAS WRONG AND IS KEPT AS A NOTE TO SELF. It asserted that the
    // arm-inclusive differential of the shipped layer would fall BELOW the new floor — that its
    // absolute value was the problem. It does not: it reads 4.57-5.36 px against a 3.6 floor and
    // clears it on all twelve seeds. The arm-inclusive statistic is not too SMALL, it is too BLUNT,
    // and blunt is a property of a gap between two populations rather than of one of them.
    const separation = ( shippedValues, badValues ) =>
        Math.min( ...shippedValues ) / Math.max( ...badValues );

    const axialSeparation = separation(
        differentials.map( ( each ) => each.axialGlancePixels ),
        tiltDifferentials.map( ( each ) => each.axialGlancePixels ) );

    const armInclusiveSeparation = separation(
        differentials.map( ( each ) => each.glancePixels ),
        tiltDifferentials.map( ( each ) => each.glancePixels ) );

    // 🚩 AND THE ANSWER IS NOT THE ONE THIS GATE WAS FIRST WRITTEN TO ASSERT, WHICH IS WHY IT IS
    // RECORDED RATHER THAN DIRECTIONAL. Measured, the arm-inclusive differential separates the
    // shipped layer from the tilt by 2.878x and the axial one by 2.189x — the OLD statistic
    // separates these two populations BETTER. That is not a reason to keep it. It is 56/89 arm and
    // both its edges are arm, so what it separates well is two states of the ARMS; the fact that
    // those happen to track the trunk under these two particular spreads is a coincidence of this
    // known-bad, not a property of the measurement. §1.25g: a gate that compares two observers is
    // blind to a defect that is wrong the same way for both. Provenance decides this, not power.
    gate( 'both differentials separate shipped from the tilt, and the ARM-INCLUSIVE one separates further (x)',
        axialSeparation / armInclusiveSeparation, 0.5, 1.0,
        `recorded, not tolerated: axial ${ axialSeparation.toFixed( 3 ) }x against arm-inclusive ` +
        `${ armInclusiveSeparation.toFixed( 3 ) }x on the same twelve clips. The axial form is gated ` +
        'because of what it MEASURES, not because it discriminates better — see the comment' );

}

/**
 * The frontal-plane tilt of the shoulder line at unit blend, per side, as authored and as realised.
 *
 * Read off the two upper-arm joints rather than off `upperChest`, because the shoulder line a viewer
 * sees is where the deltoids are — 215 mm above the last spine joint, which is the lever that turns
 * a degree of thoracic roll into something on screen.
 *
 * The AUTHORED figure is measured rather than read from the pose file, by running the same code path
 * with the righting off. A number typed in here would go stale the moment the pose is redrawn, and
 * the claim this section makes is about the fraction that survives, not about 3.0 degrees.
 */
function shoulderLineFractions( options ) {

    const measure = ( layerOptions ) => {

        const { stack, layer, root } = buildStack( SEED, layerOptions );

        root.updateMatrixWorld( true );

        const restShoulder = shoulderLineDegrees();
        const restHip = hipLineDegrees();
        const snapshot = layer.snapshotJoints();
        const shoulder = {};
        const hip = {};

        for ( const side of [ 'left', 'right' ] ) {

            layer.buildStanceRotations( 1, side );
            layer.applyStanceToBones( 1, side, snapshot );

            root.updateMatrixWorld( true );

            shoulder[ side ] = shoulderLineDegrees() - restShoulder;
            hip[ side ] = hipLineDegrees() - restHip;

            layer.restoreJoints( snapshot );

        }

        stack.dispose();

        return { shoulder, hip };

    };

    const authored = measure( { ...options, lateralRightingEnabled: false } );
    const realised = measure( options );

    return {
        authored: authored.shoulder,
        hipLine: authored.hip,
        realised: realised.shoulder,
        fraction: {
            left: realised.shoulder.left / authored.shoulder.left,
            right: realised.shoulder.right / authored.shoulder.right
        }
    };

}

/** Frontal-plane tilt of the line through the two upper-arm joints, degrees, left shoulder up. */
function shoulderLineDegrees() {

    return lineTiltDegrees( 'leftUpperArm', 'rightUpperArm' );

}

/** The same, for the two hip joints — the line the shoulder line has to diverge from. */
function hipLineDegrees() {

    return lineTiltDegrees( 'leftUpperLeg', 'rightUpperLeg' );

}

function lineTiltDegrees( leftHumanoid, rightHumanoid ) {

    const left = new Vector3().setFromMatrixPosition(
        figure.root.getObjectByName( HUMANOID_TO_FIGURE_BONE[ leftHumanoid ] ).matrixWorld );
    const right = new Vector3().setFromMatrixPosition(
        figure.root.getObjectByName( HUMANOID_TO_FIGURE_BONE[ rightHumanoid ] ).matrixWorld );

    return Math.atan2( left.y - right.y, left.x - right.x ) * 180 / Math.PI;

}

/**
 * The judge's statistic: the shoulder band's silhouette centre minus the hip band's, per frame.
 *
 * A DIFFERENCE of two bands rather than a ratio, which is the whole point — the two bands of a rigid
 * torso move together, so the difference is flat however far the body travels. Reported three ways
 * because the judge reported it as an SD against the hip band's SD and this file states every other
 * band claim as a 15 s median peak-to-peak (§1.14).
 */
function trunkDifferential( seed, options, framing ) {

    const report = bandTravelPixels( seed, options, framing );
    const at = ( name ) => report.bands.find( ( band ) => band.name === name );

    const of = ( shoulder, hip ) => {

        const difference = shoulder.map( ( value, index ) => value - hip[ index ] );
        const glance = slidingWindowPeakToPeak( difference, GLANCE_WINDOW_SECONDS ).sort( ( a, b ) => a - b );

        return {
            sd: standardDeviation( difference ),
            glance: glance[ Math.floor( glance.length / 2 ) ],
            overHipSd: standardDeviation( difference ) / standardDeviation( hip )
        };

    };

    const armInclusive = of( at( 'shoulder' ).silhouetteSamples, at( 'hip' ).silhouetteSamples );
    const axial = of( at( 'shoulder' ).axialSilhouetteSamples, at( 'hip' ).axialSilhouetteSamples );

    return {
        sdPixels: armInclusive.sd,
        glancePixels: armInclusive.glance,
        overHipSd: armInclusive.overHipSd,
        axialSdPixels: axial.sd,
        axialGlancePixels: axial.glance
    };

}

/**
 * CLIP CONTENT — whether the clip a judge is actually handed contains a sustained weight transfer.
 *
 * 🎯 THE DEFECT. Every capture and every judgement in this repo was pinned to seed 1, because a
 * pinned seed replays to the byte. Reproducible is not representative. Measured here, seed 1's
 * pelvis never leaves a ±5 px band for as long as fifteen seconds anywhere in 420 s — its first
 * sustained transfer opens at 483.0 s, sixty-three seconds after the clip ends. Judges were asked
 * whether the body shifts its weight while watching a clip that, by the draw, contains no shift.
 *
 * IT IS NOT A DEFECT IN THE LAYER, and this section deliberately does not gate the layer's rate —
 * `EVENT RATES` already does, against Duarte. Duarte's medio-lateral SHIFT process runs at
 * 0.30/min, so a 420 s clip carries ~2.1 expected arrivals and the magnitude draw is lognormal:
 * most shifts are small. Five of the twelve seeds this file gates on contain no sustained transfer
 * in 420 s, and the median wait for the first one is measured below.
 *
 * It is LEARNINGS §1.4 one level down. That lesson sized the observation window against the RELAY
 * rate — 1.5/min, the pooled fidget-plus-shift process — and the behaviour a body judge is asked
 * about is governed by the SHIFT rate alone, five times slower. Same shape as §1.7b: two processes,
 * one window, and the window was right for the wrong one. So the SEED is a gate parameter, exactly
 * as the window is, and this section is where it gets gated.
 *
 * WHAT IS GATED. `tools/critic/capture.mjs` nominates the seeds it will hand a judge and declares
 * what is in each. Those constants are imported, not restated, and every number in them is
 * re-measured here: a nomination that stops being true fails, and a seed that has no transfer fails
 * if it is nominated. THE OTHER WAY at the end nominates the five measured-empty seeds and requires
 * all five to be rejected (§1.1a — a rejection stated on one seed is not a proof).
 *
 * THE SIGNAL. The pelvis bone's lateral position, projected on the camera's right vector at the
 * full-body framing, smoothed over 3 s and measured from where it started. Both thresholds come
 * from numbers already in this repo rather than from taste:
 *
 *   5 px is 7.6 mm at this framing, which is 2.46× the layer's own measured medio-lateral balance
 *   RMS of 3.089 mm. Below that a viewer is reading noise; above it, a decision. The 1.6 px figure
 *   is deliberately NOT used — twice over. It is a peak-to-peak where this is a held offset, which
 *   is the statistic mismatch §1.14 cost a round to; and it was never measured in the first place,
 *   which is what §1.14a cost a second one to.
 *
 *   15 s is GLANCE_WINDOW_SECONDS: a hold that fills the span a viewer spends deciding whether the
 *   thing is alive.
 *
 * 🚩 WHAT THIS IS NOT. It is the pelvis BONE, on `Sway` alone, offline — not the silhouette a
 * capture measures on the full `alive.js` stack. Sway's stream is forked by layer name, so its
 * realisation is identical in both, and no other layer drives the pelvis; but nothing here has been
 * looked at (§1.9). It is a prediction of which clips are worth a judge's time, and it is the
 * capture tool's manifest — not this file — that has to carry it to the judge.
 */
function measureClipContent() {

    section( 'CLIP CONTENT — is there a weight transfer in the clip the judge is handed?' );

    const framing = fullBodyFraming();
    const traces = SWAY_SEEDS.map( ( seed ) => pelvisHoldTrace( seed, framing ) );
    const bySeed = new Map( traces.map( ( trace ) => [ trace.seed, trace ] ) );

    note( 'hold definition',
        `>= ${ POSTURAL_HOLD_PIXELS } px for >= ${ POSTURAL_HOLD_SECONDS } s`,
        `${ ( POSTURAL_HOLD_PIXELS / framing.pixelsPerMillimetre ).toFixed( 1 ) } mm of pelvis travel, ` +
        `${ ( POSTURAL_HOLD_PIXELS / framing.pixelsPerMillimetre / 3.089 ).toFixed( 2 ) }x the measured ML balance RMS` );

    console.log( '' );
    console.log( '        seed   holds in clip   held (%)   first hold (s)   peak (px)   side' );

    for ( const trace of traces ) {

        const first = trace.clipHolds[ 0 ] ?? null;

        console.log( `  ${ String( trace.seed ).padStart( 10 ) }   ${ String( trace.clipHolds.length ).padStart( 13 ) }` +
            `   ${ ( 100 * trace.heldFraction ).toFixed( 1 ).padStart( 8 ) }` +
            `   ${ ( trace.firstHoldSeconds === null ? 'never' : trace.firstHoldSeconds.toFixed( 2 ) ).padStart( 14 ) }` +
            `   ${ ( first === null ? '-' : first.peakPixels.toFixed( 2 ) ).padStart( 9 ) }` +
            `   ${ first === null ? '-' : first.direction }` );

    }

    console.log( '' );

    const withHold = traces.filter( ( trace ) => trace.clipHolds.length > 0 );
    const waits = traces.map( ( trace ) => trace.firstHoldSeconds ).filter( ( value ) => value !== null );

    note( `seeds containing a transfer in ${ POSTURAL_CLIP_SECONDS } s`,
        `${ withHold.length } of ${ traces.length }`,
        `Duarte's ML shift runs at 0.30/min, so this is the draw behaving, not the layer failing` );
    note( 'wait for the first transfer (s)',
        `median ${ median( waits ).toFixed( 0 ) }, worst ${ Math.max( ...waits ).toFixed( 0 ) }`,
        `an UNPINNED clip needs ${ Math.max( ...waits ).toFixed( 0 ) } s to contain one on every seed — pin instead` );

    // --- the nomination capture.mjs will act on ---------------------------------------------

    gate( 'nominated seeds', POSTURAL_JUDGEMENT_SEEDS.length,
        CLIP_CONTENT_MINIMUM_SEEDS, Infinity,
        'one draw is what produced this defect; a judgement wants a set' );

    gate( 'nominated seeds containing a transfer',
        POSTURAL_JUDGEMENT_SEEDS.filter( ( entry ) => bySeed.get( entry.seed ).clipHolds.length > 0 ).length,
        POSTURAL_JUDGEMENT_SEEDS.length, POSTURAL_JUDGEMENT_SEEDS.length,
        `every seed capture.mjs hands a judge must hold one, measured over ${ POSTURAL_CLIP_SECONDS } s at ${ GLANCE_SAMPLE_RATE_HZ } Hz` );

    // The manifest quotes these numbers at a judge. A declared onset that no longer matches the
    // layer is a manifest that lies, which is worse than one that says nothing.
    const onsetError = Math.max( ...POSTURAL_JUDGEMENT_SEEDS.map( ( entry ) => {
        const measured = bySeed.get( entry.seed ).firstHoldSeconds;
        return measured === null ? Infinity : Math.abs( measured - entry.onsetSeconds );
    } ) );

    const peakError = Math.max( ...POSTURAL_JUDGEMENT_SEEDS.map( ( entry ) => {
        const first = bySeed.get( entry.seed ).clipHolds[ 0 ];
        return first === undefined ? Infinity : Math.abs( first.peakPixels - entry.peakPixels );
    } ) );

    gate( 'declared onset vs measured, worst (s)', onsetError,
        0, CLIP_CONTENT_ONSET_TOLERANCE_SECONDS,
        'the trace is deterministic; the table is written to one decimal, so this is agreement to the printed precision' );

    gate( 'declared peak vs measured, worst (px)', peakError,
        0, CLIP_CONTENT_PEAK_TOLERANCE_PIXELS,
        'ditto — capture.mjs prints these at the judge before the clip is taken' );

    const worstOnsetFraction = Math.max( ...POSTURAL_JUDGEMENT_SEEDS.map(
        ( entry ) => bySeed.get( entry.seed ).firstHoldSeconds / POSTURAL_CLIP_SECONDS ) );

    gate( 'latest first transfer, as a fraction of the clip', worstOnsetFraction,
        0, CLIP_CONTENT_ONSET_FRACTION,
        'the judge has to see the TRANSITION, not only a body already leaning' );

    // Counted over the seeds that actually hold, so that a nomination with no transfer in it fails
    // the gate above — which is about content — rather than this one, which is about coverage.
    const directions = new Set( POSTURAL_JUDGEMENT_SEEDS
        .map( ( entry ) => bySeed.get( entry.seed ).clipHolds[ 0 ]?.direction )
        .filter( ( direction ) => direction !== undefined ) );

    gate( 'directions represented in the nominated set', directions.size,
        2, 2,
        'three clips that all load the same leg would be reported as a body that always stands left' );

    gate( 'declared direction vs measured',
        POSTURAL_JUDGEMENT_SEEDS.filter(
            ( entry ) => bySeed.get( entry.seed ).clipHolds[ 0 ]?.direction === entry.direction ).length,
        POSTURAL_JUDGEMENT_SEEDS.length, POSTURAL_JUDGEMENT_SEEDS.length,
        'the manifest names the side; it has to be the side' );

    // --- and the seeds capture.mjs warns about ----------------------------------------------

    gate( 'declared-empty seeds with no transfer in the clip',
        POSTURAL_EMPTY_SEEDS.filter( ( entry ) => bySeed.get( entry.seed ).clipHolds.length === 0 ).length,
        POSTURAL_EMPTY_SEEDS.length, POSTURAL_EMPTY_SEEDS.length,
        'capture.mjs refuses these by name; the names have to be right' );

    const emptyWaitError = Math.max( ...POSTURAL_EMPTY_SEEDS.map( ( entry ) => {
        const measured = bySeed.get( entry.seed ).firstHoldSeconds;
        return measured === null ? Infinity : Math.abs( measured - entry.firstTransferSeconds );
    } ) );

    gate( 'declared first transfer vs measured, worst (s)', emptyWaitError,
        0, CLIP_CONTENT_ONSET_TOLERANCE_SECONDS,
        `traced to ${ CLIP_CONTENT_SECONDS } s so the latest of them is reached rather than assumed` );

    measureClipContentTheOtherWay( bySeed );

}

/**
 * §1.1 and §1.1a. The nomination gate has to reject a bad nomination on EVERY seed of a set, and
 * the two gates that were already watching this clip have to be shown NOT to catch it — otherwise
 * the round has bought a gate that was already covered.
 */
function measureClipContentTheOtherWay( bySeed ) {

    const rejected = POSTURAL_EMPTY_SEEDS.filter(
        ( entry ) => bySeed.get( entry.seed ).clipHolds.length === 0 ).length;

    note( 'nominating the measured-empty seeds instead',
        POSTURAL_EMPTY_SEEDS.map( ( entry ) => `${ entry.seed } declared @ ${ entry.firstTransferSeconds.toFixed( 2 ) } s, ` +
            `measured @ ${ ( bySeed.get( entry.seed )?.firstHoldSeconds ?? NaN ).toFixed( 2 ) } s` ).join( '; ' ),
        'each one is a seed somebody could reasonably have pinned' );

    gate( 'the nomination gate REJECTS every empty seed', rejected,
        POSTURAL_EMPTY_SEEDS.length, POSTURAL_EMPTY_SEEDS.length,
        'the COUNT of seeds caught, not a single verdict — one seed of luck is not a proof' );

    // 🚩 RECORDED AS A GATE. The FRAME-RATE section asserts that a full transfer HAPPENS at every
    // frame rate, and it is satisfied by `stanceBlend <= -0.95` at any single instant. Seed 1
    // satisfies it inside the judged clip and still holds nothing: the deep crossing is a fidget
    // lunging through full transfer and snapping back within a second or so. DEPTH is not DURATION.
    const seedOne = bySeed.get( 1 );

    note( 'seed 1 inside the clip: blend depth, longest hold',
        `${ seedOne.blendMinimum.toFixed( 3 ) }, ${ seedOne.longestHoldSeconds.toFixed( 1 ) } s`,
        'a full transfer is REACHED and never HELD — the frame-rate section gates the first and not the second' );

    gate( 'a full-transfer DEPTH check does NOT catch it',
        seedOne.blendMinimum <= FULL_TRANSFER_BLEND ? 0 : 1, 0, 0,
        `recorded, not tolerated: seed 1 reaches ${ seedOne.blendMinimum.toFixed( 3 ) } and would pass a depth gate` );

    // 🚩 AND THE OTHER GATE THAT WAS ALREADY LOOKING AT THIS EXACT CLIP. GLANCE LEGIBILITY includes
    // seed 1 among its twelve, over 420 s, in pixels, at this framing — and passes on it, because
    // its statistic is a peak-to-peak inside a 15 s window, which a 1.4 s fidget satisfies on its
    // own. Same family as §1.14: right unit, wrong statistic for the behaviour being asked about.
    const hip = measuredGlanceBands.find( ( band ) => band.name === 'hip' );

    gate( 'the GLANCE gate does NOT catch it either',
        hip.glanceTravelPixels < SILHOUETTE_WIDTH_FLOOR_PIXELS ? 1 : 0, 0, 0,
        `recorded, not tolerated: the hip band scores ${ hip.glanceTravelPixels.toFixed( 2 ) } px on this very clip, against a ${ SILHOUETTE_WIDTH_FLOOR_PIXELS } px floor` );

}

/**
 * One seed's pelvis trace, in pixels at the full-body framing, and the holds in it.
 *
 * Traced to CLIP_CONTENT_SECONDS and then sliced at POSTURAL_CLIP_SECONDS, so that the clip's own
 * content and the wait for the first transfer come from the same run rather than from two.
 */
function pelvisHoldTrace( seed, framing ) {

    const { stack, layer, root } = buildStack( seed );

    const pelvis = root.getObjectByName( 'pelvis' );
    const frames = Math.round( CLIP_CONTENT_SECONDS * GLANCE_SAMPLE_RATE_HZ );
    const samples = new Float64Array( frames );
    const point = new Vector3();

    const clipFrames = Math.round( POSTURAL_CLIP_SECONDS * GLANCE_SAMPLE_RATE_HZ );
    let blendMinimum = Infinity;

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( 1 / GLANCE_SAMPLE_RATE_HZ );
        root.updateMatrixWorld( true );

        point.setFromMatrixPosition( pelvis.matrixWorld );
        samples[ frame ] = point.dot( framing.screenRight ) * 1000 * framing.pixelsPerMillimetre;

        if ( frame < clipFrames ) blendMinimum = Math.min( blendMinimum, layer.stanceBlend );

    }

    stack.dispose();

    const origin = samples[ 0 ];
    const smoothed = boxcarMean( Array.from( samples, ( value ) => value - origin ), POSTURAL_SMOOTHING_SECONDS );

    const allHolds = sustainedHolds( smoothed );
    const clipHolds = sustainedHolds( smoothed.slice( 0, clipFrames ) );

    const heldSeconds = clipHolds.reduce( ( total, hold ) => total + hold.seconds, 0 );

    return {
        seed,
        clipHolds,
        heldFraction: heldSeconds / POSTURAL_CLIP_SECONDS,
        longestHoldSeconds: clipHolds.reduce( ( longest, hold ) => Math.max( longest, hold.seconds ), 0 ),
        firstHoldSeconds: allHolds.length > 0 ? allHolds[ 0 ].startSeconds : null,
        blendMinimum
    };

}

/**
 * The runs where the signal stays on ONE side of zero, beyond the threshold, for long enough to
 * read as a held pose rather than as a passing fidget.
 *
 * The side matters: a signal that crosses zero has come back, and coming back is what separates
 * Duarte's fidget from his weight shift. A magnitude-only test would splice a lunge left and a
 * lunge right into one long "hold".
 */
function sustainedHolds( signal ) {

    const holds = [];

    let side = 0;
    let start = 0;

    for ( let index = 0; index <= signal.length; index ++ ) {

        const value = index < signal.length ? signal[ index ] : 0;
        const current = index < signal.length && Math.abs( value ) >= POSTURAL_HOLD_PIXELS
            ? Math.sign( value )
            : 0;

        if ( current === side ) continue;

        if ( side !== 0 ) {

            const seconds = ( index - start ) / GLANCE_SAMPLE_RATE_HZ;

            if ( seconds >= POSTURAL_HOLD_SECONDS ) {

                let peak = 0;
                for ( let at = start; at < index; at ++ ) {
                    if ( Math.abs( signal[ at ] ) > Math.abs( peak ) ) peak = signal[ at ];
                }

                holds.push( {
                    startSeconds: start / GLANCE_SAMPLE_RATE_HZ,
                    seconds,
                    peakPixels: peak,
                    // +screenRight is the viewer's right, so a positive pelvis offset is the
                    // figure's own right side. capture.mjs's manifest names the same side.
                    direction: side > 0 ? 'right' : 'left'
                } );

            }

        }

        side = current;
        start = index;

    }

    return holds;

}

/** A centred boxcar mean of the given width. `highPassed` subtracts one; this one is one. */
function boxcarMean( samples, seconds ) {

    const half = Math.floor( Math.round( seconds * GLANCE_SAMPLE_RATE_HZ ) / 2 );
    const prefix = new Float64Array( samples.length + 1 );

    for ( let index = 0; index < samples.length; index ++ ) prefix[ index + 1 ] = prefix[ index ] + samples[ index ];

    const out = new Float64Array( samples.length );

    for ( let index = 0; index < samples.length; index ++ ) {

        const from = Math.max( 0, index - half );
        const to = Math.min( samples.length, index + half + 1 );

        out[ index ] = ( prefix[ to ] - prefix[ from ] ) / ( to - from );

    }

    return out;

}

function measureFrameRateInvariance() {

    section( 'FRAME-RATE INVARIANCE — the same seed at 30, 60 and 120 Hz' );

    const reference = traceAtRate( INVARIANCE_SEED, INVARIANCE_RATES[ 1 ], INVARIANCE_SECONDS, {} );

    console.log( '' );
    console.log( '          rate   fidgets   shifts   blend min   blend max   first blend <= -0.95   ' +
        'worst bone vs 60 Hz (mm)' );

    const worstByRate = new Map();

    for ( const rate of INVARIANCE_RATES ) {

        const trace = rate === INVARIANCE_RATES[ 1 ] ? reference : traceAtRate( INVARIANCE_SEED, rate, INVARIANCE_SECONDS, {} );
        const worst = worstBoneDivergenceMm( trace, reference );

        worstByRate.set( rate, { trace, worst } );

        console.log( `  ${ String( rate + ' Hz' ).padStart( 12 ) }   ${ String( trace.fidgets ).padStart( 7 ) }   ` +
            `${ String( trace.shifts ).padStart( 6 ) }   ${ trace.blendMin.toFixed( 4 ).padStart( 9 ) }   ` +
            `${ trace.blendMax.toFixed( 4 ).padStart( 9 ) }   ` +
            `${ ( trace.firstDeepCross === null ? 'never' : trace.firstDeepCross.toFixed( 1 ) + ' s' ).padStart( 20 ) }   ` +
            `${ worst.toFixed( 6 ).padStart( 24 ) }` );

    }

    console.log( '' );

    const worstAnywhere = Math.max( ...[ ...worstByRate.values() ].map( ( entry ) => entry.worst ) );

    gate( 'worst bone divergence across 30/60/120 Hz (mm)', worstAnywhere, 0, INVARIANCE_TOLERANCE_MM,
        `every driven marker, every common sample instant, over ${ INVARIANCE_SECONDS } s` );

    // The event counts and the blend extremes are the coarse, human-readable statement of the same
    // thing, and they are the two the re-verifier's report was written in. They must agree exactly:
    // an arrival time is now a property of the seed, so a differing count is not a rounding matter.
    const counts = INVARIANCE_RATES.map( ( rate ) => worstByRate.get( rate ).trace.fidgets );
    const shifts = INVARIANCE_RATES.map( ( rate ) => worstByRate.get( rate ).trace.shifts );

    gate( 'fidget count is identical at every frame rate', new Set( counts ).size, 1, 1,
        `${ counts.join( ' / ' ) } — the layer as shipped before this fix scored 30 / 35 / 31` );
    gate( 'shift count is identical at every frame rate', new Set( shifts ).size, 1, 1,
        `${ shifts.join( ' / ' ) } — the layer as shipped before this fix scored 8 / 7 / 5` );

    // 🎯 AND THE ONE THE FREE-FOOT GATE DEPENDS ON. That section asserts a full transfer onto each
    // leg; if the transfer only happens at the rate the gate samples at, the gate is fiction.
    const crossings = INVARIANCE_RATES.map( ( rate ) => worstByRate.get( rate ).trace.firstDeepCross );

    gate( 'a full transfer happens at every frame rate',
        crossings.filter( ( value ) => value !== null ).length, INVARIANCE_RATES.length, INVARIANCE_RATES.length,
        'the layer as shipped reached it at 434.3 s at 60 Hz and NEVER at 30 Hz — the free-foot section\'s whole premise' );

    gate( 'and at the same instant (s, spread)',
        Math.max( ...crossings ) - Math.min( ...crossings ), 0, 2 / INVARIANCE_RATES[ 0 ],
        `${ crossings.map( ( value ) => value.toFixed( 2 ) ).join( ' / ' ) }; two frames of the slowest rate is the observation quantum` );

    measureFrameRateInvarianceTheOtherWay( reference );

}

/**
 * §1.1 for the section above. `frameCoupledArrivals: true` restores the per-frame Bernoulli draw
 * this layer used to make, and every gate above must reject it.
 */
function measureFrameRateInvarianceTheOtherWay( shippedReference ) {

    const coupled = INVARIANCE_RATES.map(
        ( rate ) => traceAtRate( INVARIANCE_SEED, rate, INVARIANCE_SECONDS, { frameCoupledArrivals: true } ) );

    const coupledWorst = Math.max( ...coupled.map( ( trace ) => worstBoneDivergenceMm( trace, coupled[ 1 ] ) ) );
    const coupledCrossings = coupled.map( ( trace ) => trace.firstDeepCross );

    note( 'frame-coupled arrivals, worst divergence (mm)', coupledWorst.toFixed( 3 ),
        `blend minima ${ coupled.map( ( trace ) => trace.blendMin.toFixed( 3 ) ).join( ' / ' ) }` );

    // ⚠️ The rebuild is the same DEFECT, not the same TRACE. Restoring the per-frame draw does not
    // restore the old stream layout — the four arrival processes now own forked streams, which is
    // the other half of the fix — so the coupled run lands its events somewhere else than the
    // original 434.3 s / never did. What reproduces exactly is the symptom: the 30 Hz trace fails
    // to complete a transfer that the faster ones complete.
    note( 'frame-coupled arrivals, full transfer at',
        coupledCrossings.map( ( value ) => value === null ? 'never' : value.toFixed( 1 ) + ' s' ).join( ' / ' ),
        '30 / 60 / 120 Hz — the re-verifier measured never / 434.3 s on the shipped layer' );

    gate( 'the divergence gate REJECTS frame-coupled arrivals',
        coupledWorst > INVARIANCE_TOLERANCE_MM ? 1 : 0, 1, 1,
        `1 means the gate caught it; the coupled layer diverges by ${ coupledWorst.toFixed( 1 ) } mm` );

    gate( 'and by a real margin (x the tolerance)', coupledWorst / INVARIANCE_TOLERANCE_MM, 100, Infinity,
        'the error has to be large enough that the tolerance is not what decided it' );

    gate( 'the event-count gate REJECTS it too',
        new Set( coupled.map( ( trace ) => trace.fidgets ) ).size > 1 ? 1 : 0, 1, 1,
        `fidget counts ${ coupled.map( ( trace ) => trace.fidgets ).join( ' / ' ) }` );

    // 🚩 RECORDED AS A GATE, §1.3 AND §1.11. Everything else in this file passed on the coupled
    // layer, which is why it shipped. The RATE is genuinely dt-invariant — the Bernoulli
    // probability is the exact one — so no rate gate, no amplitude gate and no spectral gate could
    // ever have seen this. Asserted so that nobody reads the green matrix above as covering it.
    const coupledRateSpread = Math.abs( coupled[ 0 ].fidgets - coupled[ 2 ].fidgets )
        / ( 0.5 * ( coupled[ 0 ].fidgets + coupled[ 2 ].fidgets ) );

    gate( 'a RATE gate would NOT have caught it', coupledRateSpread > 0.5 ? 1 : 0, 0, 0,
        `recorded, not tolerated: the coupled layer's 30 vs 120 Hz event counts differ by ${ ( 100 * coupledRateSpread ).toFixed( 0 ) }%, inside Poisson sampling error` );

    note( 'shipped reference, for comparison', `${ shippedReference.fidgets } fidgets, ${ shippedReference.shifts } shifts`,
        `${ INVARIANCE_SECONDS } s at seed ${ INVARIANCE_SEED }` );

}

/**
 * One trace at one frame rate, sampled at whole seconds so that traces taken at different rates are
 * compared at the SAME simulated instants rather than at the same frame index.
 */
function traceAtRate( seed, rateHz, seconds, options ) {

    const { stack, layer, root } = buildStack( seed, options );

    const bones = INVARIANCE_MARKERS.map( ( key ) => root.getObjectByName( MARKERS.find( ( marker ) => marker.key === key ).bone ) );
    const samples = [];

    let blendMin = Infinity;
    let blendMax = -Infinity;
    let firstDeepCross = null;

    const frames = Math.round( seconds * rateHz );

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( 1 / rateHz );

        blendMin = Math.min( blendMin, layer.stanceBlend );
        blendMax = Math.max( blendMax, layer.stanceBlend );

        if ( firstDeepCross === null && layer.stanceBlend <= FULL_TRANSFER_BLEND ) {

            firstDeepCross = ( frame + 1 ) / rateHz;

        }

        if ( ( frame + 1 ) % rateHz !== 0 ) continue;

        root.updateMatrixWorld( true );

        for ( const bone of bones ) {

            samples.push( bone.matrixWorld.elements[ 12 ], bone.matrixWorld.elements[ 13 ], bone.matrixWorld.elements[ 14 ] );

        }

    }

    const fidgets = layer.eventCounts.fidget;
    const shifts = layer.eventCounts.shift;

    stack.dispose();

    return { rateHz, samples, blendMin, blendMax, firstDeepCross, fidgets, shifts };

}

/** The largest world-space disagreement between two traces, over every marker and instant, in mm. */
function worstBoneDivergenceMm( trace, reference ) {

    let worst = 0;

    for ( let index = 0; index < Math.min( trace.samples.length, reference.samples.length ); index ++ ) {

        worst = Math.max( worst, Math.abs( trace.samples[ index ] - reference.samples[ index ] ) );

    }

    return worst * 1000;

}

function measureVariableFrameTime() {

    section( 'VARIABLE FRAME TIME — a jittering 30-120 fps loop, plus one stall' );

    const { stack, layer, root } = buildStack( SEED );

    const ankle = root.getObjectByName( 'foot_l' );
    const jitter = new MotionRandom( 99 );

    const medioLateral = [];
    const anteroPosterior = [];

    root.updateMatrixWorld( true );

    const ankleRest = new Vector3().setFromMatrixPosition( ankle.matrixWorld );
    const anklePosition = new Vector3();
    let worstAnkle = 0;
    let elapsed = 0;

    while ( elapsed < SPECTRUM_DURATION_SECONDS ) {

        // One in every few hundred frames is a 2 s stall, which the stack clamps to its
        // maxDeltaSeconds. Motion time is the integral of clamped deltas, deliberately not wall
        // clock, so the run below is shorter in wall time than in motion time — and the sway
        // statistics must be indifferent to that.
        const delta = jitter.chance( 0.003 ) ? 2 : jitter.range( 1 / 120, 1 / 30 );

        stack.update( delta );
        root.updateMatrixWorld( true );

        elapsed = stack.time;

        medioLateral.push( layer.balanceDisplacement.x );
        anteroPosterior.push( layer.balanceDisplacement.z );

        anklePosition.setFromMatrixPosition( ankle.matrixWorld );
        worstAnkle = Math.max( worstAnkle, anklePosition.distanceTo( ankleRest ) * 1000 );

    }

    gateBand( 'ML RMS under jitter (mm)', rootMeanSquare( medioLateral ) * 1000,
        QUIJOUX_RMS_MEDIO_LATERAL_MM, 3 * rmsEstimatorSigma( SPECTRUM_DURATION_SECONDS, QUIJOUX_MODE_MEDIO_LATERAL_HZ ),
        'the same band as the fixed-step run; frame rate must not change the amplitude' );
    gateBand( 'AP RMS under jitter (mm)', rootMeanSquare( anteroPosterior ) * 1000,
        QUIJOUX_RMS_ANTERO_POSTERIOR_MM,
        3 * rmsEstimatorSigma( SPECTRUM_DURATION_SECONDS, QUIJOUX_MODE_ANTERO_POSTERIOR_HZ ), '' );
    gate( 'ankle travel under jitter (mm)', worstAnkle, 0, PLANTED_HORIZONTAL_LIMIT_MM,
        'a dropped frame must not let the foot skate' );

    stack.dispose();

}

function measureDeterminism() {

    section( 'DETERMINISM — the same seed must give the same trace' );

    const trace = () => {

        const { stack, root } = buildStack( SEED );
        const head = root.getObjectByName( 'head' );
        const pelvis = root.getObjectByName( 'pelvis' );
        const samples = [];

        for ( let frame = 0; frame < 30 * SAMPLE_RATE_HZ; frame ++ ) {

            stack.update( FRAME_SECONDS );
            root.updateMatrixWorld( true );

            samples.push(
                head.matrixWorld.elements[ 12 ], head.matrixWorld.elements[ 14 ],
                pelvis.matrixWorld.elements[ 12 ], pelvis.matrixWorld.elements[ 14 ] );

        }

        stack.dispose();
        return samples;

    };

    const first = trace();
    const second = trace();

    let worst = 0;
    for ( let i = 0; i < first.length; i ++ ) {
        worst = Math.max( worst, Math.abs( first[ i ] - second[ i ] ) );
    }

    gate( 'max divergence between runs (mm)', worst * 1000, 0, 1e-9,
        'two stacks, same seed, same dt sequence' );

}

/**
 * ================================================================================================
 * PUNCH-LIST 6.9 — AFFECT REACHES THE BALANCE MODEL, NOT JUST THE TRUNK BONES
 * ================================================================================================
 *
 * 🎯 WHAT THIS SECTION CLAIMS, AND WHAT GREEN MEANS HERE, BECAUSE IT ASSERTS A CHANNEL THAT DOES
 * NOT MOVE ON THE SHIPPED TREE.
 *
 * `affect/PostureLayer.js` actuates BAP's `approach` as one bone: `writeSagittal( bones.spine )`.
 * Coulson measured SEVEN degrees of freedom and the seventh is a WEIGHT TRANSFER — forwards or
 * backwards — which is not a joint at all. 6.9 gives that half a route into `Sway`'s pendulum, in
 * the unit `Sway` is rooted in, and it ships at an amplitude of ZERO because no source in this
 * repository's record states one and because the axis has no headroom left. So:
 *
 *   • the SHIPPED clauses assert the bias is EXACTLY 0.000000 mm on every preset — not "nearly";
 *   • the MECHANISM clauses supply `UNSOURCED_GATE_COP_FULL_SCALE_MM` and drive the thing, and
 *     every one of them prints the amplitude it supplied;
 *   • the REACHABILITY clauses prove the product's own pages reach it, because 86/86 with zero
 *     call sites is a failure this project has already paid for.
 *
 *
 * 🚩 THE PROPERTY IS SIGNED. THIS IS THE HIGHEST-PROBABILITY REPEAT IN THE WHOLE ITEM.
 *
 * Paid-for failure #2 was a gate that measured a MAGNITUDE for a property whose content is a SIGN —
 * `Math.abs()` on a direction — and it stayed green while an arm swung backwards. This property is
 * literally named "Forwards / Backwards". There is no RMS here, no sway area, no ellipse and no
 * absolute value: the clause asserts an ORDERED SIGNED TRIPLE, `anger > 0 > fear`, and
 * `affectBiasUnsigned` below is that mistake rebuilt so the file can show it passing.
 *
 *
 * 🚩 THE OPERATOR IS A PAIRED SAME-SEED DIFFERENCE, AND AN UNPAIRED ONE MEASURES THE WRONG PROCESS.
 *
 * Measured on `figure_g050`, 6 seeds x 60 s:
 *
 *     unpaired mean realised centre of mass, neutral   mean 5.228 mm, SD ACROSS SEEDS 6.8286 mm
 *     paired anger-minus-neutral, same seeds           SD 0.1108 mm
 *     paired, bias live, trunk frozen                  SD 0.0037 mm
 *
 * The unpaired spread is Duarte's 319 s drift lattice, which has nothing to do with affect and is
 * three orders of magnitude louder than what is being measured. Subtracting the SAME SEED's neutral
 * run removes it exactly, because `Sway`'s processes are a function of the seed and never read the
 * centre of mass back.
 *
 *
 * 🚩 THE TRUNK IS FROZEN, TWO DIFFERENT WAYS, AND SURVIVING BOTH IS THE POINT.
 *
 * The punch-list's own words: *"the emotion must be readable in the CoP trace with the TRUNK BONES
 * FROZEN, which is what proves the channel reached balance rather than being read off the chest
 * bend twice."* With the trunk live, anger's chest bend alone moves the centre of mass 35.5867 mm —
 * twice the effect being measured — so a gate that skipped the freeze would score a large green
 * number on today's tree with no 6.9 in it at all. Four candidate freezes were measured and two
 * were rejected:
 *
 *     mechanism                  separation today   posture.update() ran   verdict
 *     trunk live (shipped)          +35.5867 mm            yes             the contamination
 *     posture.weight = 0              0.0000 mm            yes             ✅ every bone released
 *     bones: { spine: <missing> }     0.0000 mm            yes             ✅ the trunk channel only
 *     posture.enabled = false         0.0000 mm            NO              ❌ kills the hand-off
 *     posture.amplitude = 0           0.0000 mm            yes             ❌ kills the signal
 *
 * `enabled = false` is disqualified because it removes the very hand-off under test — it is
 * `affectBiasIgnoresFrameStamp`'s red proof, not a freeze. `amplitude = 0` zeroes `drive`, and
 * `drive` is what the bias is scaled by, so it silences the thing being measured rather than the
 * thing being excluded. The two survivors fail differently, so running both is what proves the
 * reading is neither the chest bend nor any other bone this layer writes.
 *
 * ⚠️ COLLATERAL EFFECT OF THE SECOND FREEZE, MEASURED, so nobody quotes an arm number out of it:
 * renaming the spine also zeroes arm adduction — `bindArmBudget` returns early on a missing spine —
 * so anger's `armSpreadLeft` reads 0.0000° under it instead of −10.1796°. Harmless for a
 * fore-and-aft gate, a lie if repeated anywhere else.
 */
function measureAffectBalance() {

    section( 'AFFECT → BALANCE — punch-list 6.9, the CoP bias, TRUNK FROZEN' );

    note( 'shipped full scale (mm)', ( CENTRE_OF_PRESSURE_FULL_SCALE_METRES * 1000 ).toFixed( 6 ),
        'PostureLayer.CENTRE_OF_PRESSURE_FULL_SCALE_METRES — authored 0, two measured reasons' );
    note( 'UNSOURCED amplitude this gate supplies (mm)', UNSOURCED_GATE_COP_FULL_SCALE_MM,
        '🚩 arbitrary. Nothing here says how far an angry person\'s centre of pressure moves' );
    note( 'seeds x window', `${ AFFECT_SEEDS.length } x ${ AFFECT_SECONDS } s`,
        `seeds ${ AFFECT_SEEDS.join( ', ' ) }` );

    // --- the rig facts, MEASURED, because an assumed axis is paid-for failure #4 ---------------
    //
    // "Positive is forward" is the whole sign convention of this item, and the failure it repeats
    // is an axis derived for the TRUNK (which extends up) applied to something that does not.
    // Two independent reads, neither of which trusts a constant's name.

    const ankleMid = new Vector3();
    const toeMid = new Vector3();
    const scratch = new Vector3();

    restoreRestPose();

    for ( const side of [ 'left', 'right' ] ) {

        ankleMid.add( scratch.setFromMatrixPosition(
            figure.root.getObjectByName( HUMANOID_TO_FIGURE_BONE[ `${ side }Foot` ] ).matrixWorld ) );
        toeMid.add( scratch.setFromMatrixPosition(
            figure.root.getObjectByName( HUMANOID_TO_FIGURE_BONE[ `${ side }Toes` ] ).matrixWorld ) );

    }

    const toesForwardOfAnkles = ( toeMid.z - ankleMid.z ) / 2 * 1000;

    gate( 'FORWARD is +Z — read off this rig\'s own toes (mm)', toesForwardOfAnkles, 50, Infinity,
        'ball joints minus ankle joints, mean of both feet. NOT assumed: paid-for failure #4' );

    // --- the shipped tree: exactly zero, and exactly is the word --------------------------------

    const shipped = {};

    for ( const preset of [ 'anger', 'fear', 'disgust' ] ) {

        shipped[ preset ] = pairedAffectTrace( preset, { freeze: 'weight', fullScaleMm: 0 } );

    }

    gate( 'SHIPPED  the bias is EXACTLY zero on every preset (mm)',
        Math.max( ...Object.values( shipped ).flatMap(
            ( r ) => [ Math.abs( r.bias ), Math.abs( r.sample.finalBias ) ] ) ), 0, 0,
        'not "small": CENTRE_OF_PRESSURE_FULL_SCALE_METRES is 0, so the product is 0. Both the ' +
        'window mean AND the last frame, so this cannot pass by averaging a sign change away' );

    gate( 'SHIPPED  and the commanded displacement is bit-identical to neutral (mm)',
        Math.max( ...Object.values( shipped ).map( ( r ) => Math.abs( r.commanded ) ) ), 0, 0,
        'paired anger/fear/disgust minus neutral, same seeds, `sway.displacement.z`' );

    // 🎯 AND THE STRONGER FORM OF THE SAME CLAIM: 6.9 changed NOTHING on the shipped tree. The whole
    // mechanism switched off must reproduce the composed trace to the last bit, which is what says
    // the `.add( this.affectDisplacement )` in `update()` is a no-op at the shipped amplitude
    // rather than a small perturbation nobody would notice in a tolerance band.
    {
        const withMechanism = affectTrace( 'fear', AFFECT_SEEDS[ 0 ], { freeze: 'live', fullScaleMm: 0 } );
        const without = affectTrace( 'fear', AFFECT_SEEDS[ 0 ], { freeze: 'live', fullScaleMm: 0,
            swayOptions: { affectBiasEnabled: false } } );

        gate( 'SHIPPED  the trace is bit-identical with the mechanism switched off (mm)',
            Math.abs( withMechanism.realised - without.realised ), 0, 0,
            '`affectBiasEnabled: false` — every trace in this file predates 6.9 and must still' );
    }

    // --- the prescription, through the product's own construction -------------------------------
    //
    // Reported rather than gated, because these are `ExpressionMap`'s numbers and `affect.selftest`
    // owns them. They are printed here because every millimetre below is one of them times the
    // supplied amplitude, and a reader who cannot see the multiplicand cannot check the product.
    //
    // ⚠️ READ AT FRAME 1, after `settleAffect`. `disgust` is the one preset whose prescription is
    // NOT stationary — see the decay note below — so a value read at the end of the window would
    // not be the multiplicand any other line here is using.

    for ( const preset of [ 'anger', 'fear', 'disgust', 'neutral' ] ) {

        const sample = affectTrace( preset, AFFECT_SEEDS[ 0 ], {
            freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM, seconds: FRAME_SECONDS } );

        note( `prescription  ${ preset }  (frame 1)`,
            `${ sample.approach >= 0 ? '+' : '' }${ sample.approach.toFixed( 6 ) }`,
            `intensity ${ sample.intensity.toFixed( 4 ) }   chest bend ` +
            `${ sample.applied.toFixed( 4 ) }°   bias ${ sample.finalBias.toFixed( 4 ) } mm   ` +
            `Coulson weight column: ${ ( COULSON_WEIGHT_COLUMN[ preset ] ?? [ '—' ] ).join( '/' ) }` );

    }

    // --- RED 1: the channel does not reach balance. Free, and red by construction ---------------
    //
    // `affectBiasNotComposed` IS the state of this file before 6.9: the claim is read, reported,
    // and reaches nothing. It is the item's premise, proved rather than asserted.

    const notComposed = pairedAffectTrace( 'anger', {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM,
        swayOptions: { defects: { affectBiasNotComposed: true } } } );

    gate( '🚩 RED  affectBiasNotComposed reaches the pendulum with NOTHING (mm)',
        Math.abs( notComposed.realised ), 0, 1e-9,
        'the tree before 6.9: the bias is reported and composed into nothing. Paid-for failure #5' );

    gate( '🚩 RED  …and it still REPORTS the full bias, which is why reporting is not reaching (mm)',
        notComposed.bias, UNSOURCED_GATE_COP_FULL_SCALE_MM * 0.7, UNSOURCED_GATE_COP_FULL_SCALE_MM,
        'anger\'s prescription x intensity x the supplied amplitude — a field a HUD would show' );

    // --- the contamination the freeze exists to remove ------------------------------------------

    const trunkLive = pairedAffectTrace( 'anger', { freeze: 'live', fullScaleMm: 0 } );

    gate( 'the CHEST BEND alone moves the centre of mass this far (mm)',
        trunkLive.realised, 20, 60,
        'with NO 6.9 at all. A gate without the freeze would score this and call it success' );

    for ( const freeze of [ 'weight', 'bones' ] ) {

        gate( `the ${ freeze } freeze releases every bone — separation at full scale 0 (mm)`,
            Math.abs( pairedAffectTrace( 'anger', { freeze, fullScaleMm: 0 } ).realised ), 0, 1e-9,
            'exactly zero, or the freeze is not a freeze and every number below is the trunk' );

    }

    // --- the mechanism, both freezes ------------------------------------------------------------

    const measured = { weight: {}, bones: {} };

    for ( const freeze of [ 'weight', 'bones' ] ) {

        for ( const preset of [ 'anger', 'fear', 'disgust' ] ) {

            measured[ freeze ][ preset ] = pairedAffectTrace( preset, {
                freeze, fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM } );

        }

        const { anger, fear, disgust } = measured[ freeze ];

        note( `freeze=${ freeze }  realised CoM (mm)`,
            `${ anger.realised.toFixed( 4 ) } / ${ fear.realised.toFixed( 4 ) }`,
            `anger / fear, SD across seeds ${ anger.realisedSd.toFixed( 4 ) } / ` +
            `${ fear.realisedSd.toFixed( 4 ) }; disgust ${ disgust.realised.toFixed( 4 ) }` );

        // 🚩 SIGNED. No Math.abs anywhere in this clause. See the header.
        gate( `freeze=${ freeze }  anger carries the weight FORWARD (mm)`,
            anger.realised, 1, Infinity,
            'BAP approach +1.96; Coulson\'s weight column says Forwards. SIGNED, never a magnitude' );

        gate( `freeze=${ freeze }  fear carries the weight BACK (mm)`,
            fear.realised, -Infinity, -0.1,
            'BAP approach -1.46; Coulson\'s weight column says Backwards, Neutral' );

        gate( `freeze=${ freeze }  the SIGNED anger-minus-fear separation (mm)`,
            anger.realised - fear.realised, 1, Infinity,
            'the ordered triple anger > 0 > fear, stated as one number a reader can check' );

        // The loop closure, with affect live. This is what makes the seam a centre-of-pressure
        // command rather than a lean: the realised centre of mass must land where `displacement`
        // said it would, and `affectBiasOnLeanNotDisplacement` is the version that does not.
        gate( `freeze=${ freeze }  realised / commanded, anger`,
            anger.realised / anger.commanded,
            1 - AFFECT_CLOSURE_TOLERANCE, 1 + AFFECT_CLOSURE_TOLERANCE,
            'the bias is a CoP command, so BodyMass must find the mass where it was commanded' );

    }

    gate( 'the two freezes agree to four decimal places (mm)',
        Math.abs( measured.weight.anger.realised - measured.bones.anger.realised ), 0, 1e-4,
        'they fail differently, so agreement is evidence the reading is neither bone' );

    // --- 🚩 DISGUST IS A KNOWN-WRONG DIRECTION, AND IT IS CITED RATHER THAN SURPRISING ----------
    //
    // The punch-list sentence — "'weight forwards' for anger, 'backwards' for fear and disgust" —
    // is NOT achievable from `prescription.approach`, and this is the one place the item's own text
    // is falsified by the code rather than by the record. Measured: disgust's approach is +0.321015,
    // FORWARD, against Coulson's Backwards.
    //
    // The cause is `BAP_PRESCRIPTIONS.disliking`, an EXPLICIT EMPTY ROW, cited to Coulson's own
    // recognition ceilings: no disgust posture reached 50% from any viewpoint, and the research doc
    // concludes disgust cannot be conveyed by posture at all. The `disgust` preset therefore
    // activates `disliking 0.75` alongside `annoyed 0.3847`, and the only non-empty row in the
    // normaliser is anger's: 0.946860 x 0.3847 / 1.1347 = 0.321015.
    //
    // DECISION: accept it and gate it as a cited expectation. BAP's cited zero for disgust outranks
    // Coulson's categorical level. Manufacturing an `approach` loading for `disliking` would invent
    // a number in two places at once — a magnitude BAP never reported, to satisfy a source that has
    // no magnitude. It is the punch-list sentence that needs fixing, not the prescription.

    gate( '🚩 disgust goes FORWARD, against Coulson, for a cited reason (mm)',
        measured.weight.disgust.realised, 0.1, Infinity,
        'BAP_PRESCRIPTIONS.disliking is an explicit empty row (Coulson: no disgust posture ' +
        'reached 50%), so the disgust preset is carried by its co-active annoyed row' );

    gate( '…and smaller than anger\'s, which is the arithmetic that says why (ratio)',
        measured.weight.disgust.realised / measured.weight.anger.realised, 0.05, 0.60,
        'anger\'s own loading, diluted by disliking\'s zero in the normaliser' );

    // ⚠️ AND DISGUST'S PRESCRIPTION IS NOT STATIONARY, which nothing in the design phase predicted
    // and which a single-frame reading would have hidden. `disgust` is the one preset with a
    // `trigger`, so its activation DECAYS: measured at frame 1 the bias is 4.8152 mm and its mean
    // over 60 s is 4.0964 mm. Reported rather than gated — it belongs to `ExpressionMap` — but a
    // reader comparing this section's numbers against a one-frame plate needs it.
    {
        const firstFrame = affectTrace( 'disgust', AFFECT_SEEDS[ 0 ],
            { freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM, seconds: 1 / 60 } );

        note( 'disgust decays — frame 1 vs 60 s mean (mm)',
            `${ firstFrame.bias.toFixed( 4 ) } -> ${ measured.weight.disgust.commanded.toFixed( 4 ) }`,
            'the only preset with a trigger, so its activation is not stationary' );
    }

    // --- RED 2: the balance command sourced from the CHEST BEND ---------------------------------
    //
    // 🚩 AND THE DISCRIMINATOR THE DESIGN PHASE PROPOSED FOR THIS DOES NOT WORK. That design said
    // the chest-bend read "dies the moment the trunk is frozen under `bones: { spine: … }`, because
    // that freeze leaves `appliedDegrees` reporting an angle no bone received". Measured: under
    // BOTH freezes `appliedDegrees.approach` still reads 14.2029°, because `update()` sets it
    // unconditionally at the end of the frame whatever the bones did. The two reads are identical
    // under every freeze.
    //
    // What actually separates them is a UNIT ERROR. `appliedDegrees.approach` is
    // `POSTURE_FULL_SCALE_DEGREES.approach` — 20°, the smallest magnitude in Coulson's CHEST BEND
    // column — times the same prescription and drive. Reading it as millimetres is a joint-angle
    // table silently supplying a floor distance at 1 mm per degree, and at a 20 mm exercise scale
    // the two are NUMERICALLY IDENTICAL. It is only visible when the supplied amplitude changes:
    // the real channel follows it and the chest-bend read cannot.

    const single = pairedAffectTrace( 'anger', {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM } );
    const doubled = pairedAffectTrace( 'anger', {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_DOUBLE_SCALE_MM } );

    gate( 'the bias is LINEAR in the supplied full scale (ratio)',
        doubled.commanded / single.commanded, 2 - 1e-6, 2 + 1e-6,
        `${ UNSOURCED_GATE_COP_DOUBLE_SCALE_MM } mm over ${ UNSOURCED_GATE_COP_FULL_SCALE_MM } mm ` +
        'must be exactly 2 — the clause that separates the channel from a joint angle' );

    const chestBendSingle = pairedAffectTrace( 'anger', {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM,
        swayOptions: { defects: { affectBiasFromChestBend: true } } } );
    const chestBendDoubled = pairedAffectTrace( 'anger', {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_DOUBLE_SCALE_MM,
        swayOptions: { defects: { affectBiasFromChestBend: true } } } );

    gate( '🚩 RED  affectBiasFromChestBend is INDISTINGUISHABLE at one amplitude (mm)',
        Math.abs( chestBendSingle.commanded - single.commanded ), 0, 1e-9,
        'recorded, not tolerated: 20° of Coulson and 20 mm of floor are the same number' );

    gate( '🚩 RED  …and the linearity clause is what catches it (ratio)',
        chestBendDoubled.commanded / chestBendSingle.commanded, 0.999, 1.001,
        'pinned at 1: a chest-bend read cannot follow centreOfPressureFullScaleMetres' );

    // --- RED 3: the staleness stamp -------------------------------------------------------------

    const disableFrame = Math.round( AFFECT_SECONDS * SAMPLE_RATE_HZ / 2 );

    const guarded = affectTrace( 'anger', AFFECT_SEEDS[ 0 ], {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM, disableAt: disableFrame } );

    const unguarded = affectTrace( 'anger', AFFECT_SEEDS[ 0 ], {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM, disableAt: disableFrame,
        swayOptions: { defects: { affectBiasIgnoresFrameStamp: true } } } );

    note( 'posture disabled mid-run, final prescription',
        `${ guarded.approach.toFixed( 6 ) }`,
        `and appliedDegrees ${ guarded.applied.toFixed( 4 ) }° — BOTH STALE, the layer never ran again` );

    gate( 'a DISABLED posture layer commands nothing (mm)', Math.abs( guarded.finalBias ), 0, 0,
        'the frame stamp, which is the guard `enabled` alone cannot be' );

    gate( '🚩 RED  affectBiasIgnoresFrameStamp keeps commanding it for ever (mm)',
        unguarded.finalBias, 1, Infinity,
        'a layer the stack skipped, still steering the balance model' );

    // --- RED 4: the bias on the LEAN rather than on the displacement ----------------------------
    //
    // The alternative seam. It produces the same centre-of-mass trace — measuring the figure cannot
    // tell them apart — and it breaks the loop closure, which is the only check in this file that
    // can catch a wrong lever. That is the whole argument for where 6.9 landed.

    const onLean = pairedAffectTrace( 'anger', {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM,
        swayOptions: { defects: { affectBiasOnLeanNotDisplacement: true } } } );

    gate( '🚩 RED  affectBiasOnLeanNotDisplacement moves the body the SAME way (mm)',
        Math.abs( onLean.realised - measured.weight.anger.realised ), 0, 0.05,
        'recorded, not tolerated: the centre-of-mass trace cannot discriminate the seam, so ' +
        `both land at ${ onLean.realised.toFixed( 3 ) } mm` );

    gate( '🚩 RED  …and the LOOP CLOSURE rejects it — commanded / realised',
        onLean.commanded / onLean.realised, -1e-6, 1e-6,
        `commanded ${ onLean.commanded.toFixed( 6 ) } mm against realised ` +
        `${ onLean.realised.toFixed( 3 ) } mm: the pendulum went somewhere nothing asked it to go` );

    // --- RED 5: the unsigned reading. Paid-for failure #2, and #4 supplying the known-bad --------
    //
    // 🚩 THE DEFECT LIVES IN THE GATE'S OPERATOR RATHER THAN IN `Sway.js`, which is why it is not in
    // SWAY_DEFECTS: paid-for failure #2 was `Math.abs()` on a direction, and it stayed green while
    // an arm swung backwards. The known-bad it has to reject is supplied by paid-for failure #4 —
    // an INVERTED SIGN CONVENTION, which is exactly what a full scale derived with the axis the
    // wrong way round produces, and which is why "forward is +Z" is measured off the toes above
    // rather than asserted anywhere.
    //
    // Under inversion, fear leans FORWARD. Its MAGNITUDE is untouched — bit-identical — so any
    // operator built on |bias|, RMS, sway area or an ellipse reports success. The signed clause is
    // the only reading of this property that is about the property.

    const invertedConvention = pairedAffectTrace( 'fear', {
        freeze: 'weight', fullScaleMm: -UNSOURCED_GATE_COP_FULL_SCALE_MM } );

    // ⚠️ NOT bit-identical, and the residue is worth stating rather than tolerating: an inverted
    // lean is not the exact mirror of the one it replaces, because the pendulum rotates a body
    // whose mass distribution is not symmetric fore and aft. The residue is what that costs. It is
    // three orders of magnitude below the effect, which is the whole point — it is far too small
    // for any magnitude operator to separate an inverted convention from a correct one.
    const magnitudeResidue = Math.abs( Math.abs( invertedConvention.realised )
        - Math.abs( measured.weight.fear.realised ) );

    gate( '🚩 RED  an inverted axis convention leaves the MAGNITUDE where it was (mm)',
        magnitudeResidue, 0, 0.01,
        'recorded, not tolerated: |bias| cannot see it, and neither can an RMS or a sway area. ' +
        `Residue ${ magnitudeResidue.toFixed( 6 ) } mm against a ` +
        `${ Math.abs( measured.weight.fear.realised ).toFixed( 3 ) } mm effect` );

    gate( '🚩 RED  …and it is the SIGNED clause that rejects it (mm)',
        invertedConvention.realised, 0.1, Infinity,
        'fear now leans FORWARD, so the "fear carries the weight BACK" clause above goes red. ' +
        'That clause requires < -0.1 and this is the value it would have been handed' );

    // --- the clamp -------------------------------------------------------------------------------

    const overdriven = affectTrace( 'anger', AFFECT_SEEDS[ 0 ], { freeze: 'weight', fullScaleMm: 200 } );

    gate( 'the clamp is 2.0 mean AP weight shifts (mm)', overdriven.limit, 33.999, 34.001,
        'POSTURE_OFFSET_MEAN_SHIFTS x SHIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES — Duarte, same rule ' +
        'and same scale as the weight-shift clamp beside it, on a separate signal' );

    gate( 'and it BINDS at an absurd amplitude (mm)', overdriven.finalBias, 33.999, 34.001,
        `driven at 200 mm; clamped flag ${ overdriven.clamped }` );

    // 🚩 THE RED PROOF RUNS ON `fear`, AND THE PRESET IS THE WHOLE POINT OF THE CLAUSE.
    //
    // The first version ran `anger` and justified itself with "the rear footprint on this bake is
    // 54 mm". anger's `approach` is POSITIVE — it leans FORWARD — so the proof was exercising the
    // clamp in the one direction where this figure has room to spare. Measured on g050 at that
    // configuration: furthest forward centre of mass +159.657 mm against a forward edge of +179.396
    // raw / +189.987 skinned, INSIDE by 19.7 / 30.3 mm. The clause was green and its stated
    // consequence was false.
    //
    // The base of support is 3.3x to 3.7x deeper forward than backward — g050 is +179.396 forward
    // against -54.431 rear — so the rail only ever earns its keep on the REAR side, and `fear` is
    // the preset whose `approach` is negative. Same class of error as the beat that swung backwards:
    // a signed quantity checked on the wrong side of zero.
    const unclamped = affectTrace( 'fear', AFFECT_SEEDS[ 0 ], { freeze: 'weight', fullScaleMm: 800,
        swayOptions: { defects: { affectBiasUnclamped: true } } } );

    gate( '🚩 RED  affectBiasUnclamped walks the figure off its own feet, REARWARD (mm)',
        unclamped.finalBias, -Infinity, -100,
        `no rail at all, and the rear footprint on this bake is ${ REAR_FOOTPRINT_G050_MM } mm. ` +
        'Negative is rearward, which is the only side where the rail matters: this base of support ' +
        'is over three times deeper forward than back' );

    // --- THE SIDE EFFECT ON THE TOES, which is a docstring claim made re-runnable ----------------
    //
    // 🚩 `TOE_COP_REFERENCE_EXCURSION_METRES`'s docstring used to call 48.7 mm "the rearmost centre
    // of pressure this layer can produce". 6.9 falsified that — `writeToeLift` reads
    // `this.displacement.z`, which now carries a third term with its own 34 mm clamp on top — and
    // the corrected docstring states the consequence in degrees. These clauses are that statement,
    // measured, so it cannot go stale the way the header's lever numbers did.

    const toeAt = ( fullScaleMm ) => {

        const traces = AFFECT_SEEDS.map(
            ( seed ) => affectTrace( 'fear', seed, { freeze: 'weight', fullScaleMm } ) );

        return {
            mean: traces.reduce( ( total, t ) => total + t.toeLiftMeanDegrees, 0 ) / traces.length,
            floor: Math.max( ...traces.map( ( t ) => t.toeLiftFloorDegrees ) )
        };

    };

    const toeOff = toeAt( 0 );
    const toeDriven = toeAt( UNSOURCED_GATE_COP_FULL_SCALE_MM );

    // 🚩 A FULL SCALE IS NOT A BIAS, AND THE FIRST VERSION OF THIS LINE CONFLATED THEM.
    //
    // It passed `affectBiasLimit` — 34 mm, a limit on the realised BIAS — straight in as
    // `fullScaleMm`, which is the amplitude the prescription is multiplied INTO. The two are equal
    // only when `prescription x drive` is 1, and for fear it is about 0.176: a 34 mm full scale
    // realises a bias of -5.995 mm, 5.7x short of the clamp. The column was labelled "at the clamp"
    // and the clamp never bound in it, understating the published consequence about sevenfold.
    //
    // So the scale is DERIVED from a probe rather than assumed: measure the bias this preset
    // realises per millimetre of full scale, then solve for the scale that reaches the rail. That
    // also survives a change to the prescription or the drive, which a hardcoded 193 would not.
    const probe = affectTrace( 'fear', AFFECT_SEEDS[ 0 ], { freeze: 'weight', fullScaleMm: 100 } );
    const biasPerMm = Math.abs( probe.finalBias ) / 100;
    const clampReachingFullScaleMm = Math.round( ( probe.limit / biasPerMm ) * 1.02 );

    const toeAtClamp = toeAt( clampReachingFullScaleMm );
    const clampCheck = affectTrace( 'fear', AFFECT_SEEDS[ 0 ], { freeze: 'weight', fullScaleMm: clampReachingFullScaleMm } );

    gate( 'the "at the clamp" column really does reach the clamp (mm)',
        Math.abs( clampCheck.finalBias ), probe.limit - 0.001, probe.limit + 0.001,
        `full scale ${ clampReachingFullScaleMm } mm derived from a measured ${ biasPerMm.toFixed( 6 ) } ` +
        `mm of bias per mm of scale, clamped flag ${ clampCheck.clamped }. A full scale is not a bias` );

    note( 'both-feet toe lift, fear, mean (deg)',
        `${ toeOff.mean.toFixed( 4 ) } / ${ toeDriven.mean.toFixed( 4 ) } / ${ toeAtClamp.mean.toFixed( 4 ) }`,
        `at 0 / ${ UNSOURCED_GATE_COP_FULL_SCALE_MM } / 34 mm of affect full scale — the last is the ` +
        'clamp. A REARWARD bias holds the forefoot lighter on BOTH feet at once' );

    gate( 'a rearward bias RAISES the fore-and-aft toe signal (ratio at the clamp)',
        toeAtClamp.mean / toeOff.mean, 2, Infinity,
        'the consequence TOE_COP_REFERENCE_EXCURSION_METRES\'s docstring now states, re-measured ' +
        'here so it cannot go stale' );

    // 🚩 THE TOES DO PARK, AND FINDING THAT OUT IS WHAT FIXING THE MISLABELLED COLUMN BOUGHT.
    //
    // This clause used to assert the opposite — "the FLOOR must still touch zero, because the
    // balance band carries the centre of pressure forward of neutral often enough that
    // `Math.max( -displacement.z, 0 )` reaches 0 even at the clamp" — and it PASSED, because the
    // column feeding it was labelled "at the clamp" while running a full scale 5.7x short of it.
    // Correcting that label turned this clause red immediately, which is the whole argument for
    // correcting labels.
    //
    // The reasoning was right and the arithmetic was never checked against it. The floor touches
    // zero only while the balance band can still swing the centre of pressure forward PAST neutral,
    // and that band is Duarte's weight-shift amplitude — 17 mm. A sustained rearward bias larger
    // than the band's own forward reach can never be cancelled, so beyond that the toes never come
    // down. The rail is 34 mm. It is twice the band.
    //
    // ⚠️ NONE OF THIS HAPPENS ON THE SHIPPED TREE, because the affect full scale is 0 — which is
    // why this is a property of the RAIL rather than a defect, and why the clause below asserts the
    // shipped configuration is clean AND reports where the cliff is. Whoever raises the amplitude
    // needs the second number, not a reassurance derived at a scale nobody will use.
    gate( 'the SHIPPED configuration does not park the toes (deg)', toeOff.floor, 0, 0,
        'affect full scale 0: the toes touch down on every seed, as they must with no bias at all' );

    // Where the floor leaves zero, found by bisection on the realised bias rather than on the full
    // scale, so the number is in the unit the rail is in.
    const parkingBiasMm = ( () => {

        let clean = 0;
        let parked = Math.round( new Sway().affectBiasLimit * 1000 );

        for ( let step = 0; step < 8; step ++ ) {

            const midBias = ( clean + parked ) / 2;
            const scale = midBias / biasPerMm;
            const floor = toeAt( Math.round( scale ) ).floor;

            if ( floor > 0 ) parked = midBias; else clean = midBias;

        }

        return parked;

    } )();

    note( 'rearward bias at which the toes PARK (mm)', parkingBiasMm.toFixed( 2 ),
        `against a rail of ${ ( new Sway().affectBiasLimit * 1000 ).toFixed( 1 ) } mm and Duarte's ` +
        `${ ( new Sway().anteroPosterior.settings.shiftAmplitude * 1000 ).toFixed( 0 ) } mm shift ` +
        'amplitude — ' +
        'past this the balance band can no longer carry the centre of pressure forward of neutral' );

    gate( 'and the rail sits BEYOND that cliff, which is why it is too permissive rearward (mm)',
        new Sway().affectBiasLimit * 1000 - parkingBiasMm, 0.001, Infinity,
        'REQ-086: a symmetric rail on a base of support 3.3x to 3.7x deeper forward than back. ' +
        'Recorded rather than repaired — narrowing the rear rail is a design change and the shipped ' +
        'full scale is 0, so nothing is broken today' );

    // --- REACHABILITY. Correctness is not reachability ------------------------------------------
    //
    // Paid-for failure #5: a module that passed 86/86 of its own gates and had ZERO call sites.
    // Four clauses, escalating, and the third is the one that would have caught the real gap.

    const sourceClaims = [
        [ 'Avatar.js publishes the posture', 'packages/core/src/Avatar.js',
            'this.stack.context.shared.posture = this.posture' ],
        [ 'alive.js publishes the posture', 'packages/testbed/src/alive.js',
            'stack.context.shared.posture = posture' ],
        [ 'PostureLayer.js states the claim', 'packages/core/src/affect/PostureLayer.js',
            'this.centreOfPressureBiasMetres =' ],
        [ 'PostureLayer.js stamps the frame', 'packages/core/src/affect/PostureLayer.js',
            'this.centreOfPressureFrame = context?.frame' ],
        [ 'Sway.js reads it off the context', 'packages/core/src/motion/Sway.js',
            'affectCentreOfPressureBiasOf( context, this.defects )' ],
        [ 'Sway.js composes it into the sum', 'packages/core/src/motion/Sway.js',
            '.add( this.affectDisplacement )' ]
    ];

    for ( const [ label, relative, needle ] of sourceClaims ) {

        const source = fs.readFileSync( path.join( repoRoot, relative ), 'utf8' );

        gate( `REACHABILITY  ${ label }`, source.includes( needle ) ? 1 : 0, 1, 1, `"${ needle }"` );

    }

    // 🚩 THE CLAUSE THAT WOULD HAVE CAUGHT THE REAL GAP. `alive.js` added the PostureLayer to the
    // stack and never published it to `shared`, so before 6.9 the bias read 0 on the exact page the
    // seven objective gates are measured on and a judge captures. Building the identical stack with
    // the publish omitted turns that defect into a permanent tripwire.
    const unpublished = affectTrace( 'anger', AFFECT_SEEDS[ 0 ], {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM, publish: false, seconds: 5 } );

    gate( 'REACHABILITY  an UNPUBLISHED posture layer commands exactly nothing (mm)',
        Math.abs( unpublished.finalBias ), 0, 0,
        'the configuration alive.js shipped before 6.9 — layer added, bag not written' );

    const noPosture = affectTrace( 'anger', AFFECT_SEEDS[ 0 ], {
        freeze: 'weight', fullScaleMm: UNSOURCED_GATE_COP_FULL_SCALE_MM, withPosture: false, seconds: 5 } );

    gate( 'REACHABILITY  a stack with NO affect at all reads "no claim" (mm)',
        Math.abs( noPosture.finalBias ), 0, 0,
        '`hair.js` builds a bare `new Sway()`; 0 must be the correct reading, not an accident' );

    // --- WHAT THIS GATE CANNOT SEE. Printed on every run ----------------------------------------

    note( '⚠️ cannot see 1', 'no amplitude',
        `the shipped full scale is 0; the ${ UNSOURCED_GATE_COP_FULL_SCALE_MM } mm above is supplied ` +
        'by this file and has NO SOURCE' );
    note( '⚠️ cannot see 2', 'direction contested',
        'BAP gives anger +1.96 / fear -1.46 and Coulson\'s table agrees; Coulson\'s own PROSE says ' +
        '"forward or backward" for anger and "backward or forward" for fear' );
    note( '⚠️ cannot see 3', 'disgust is wrong',
        'FORWARD, against Coulson\'s Backwards, for the cited reason gated above' );
    note( '⚠️ cannot see 4', 'no force plate',
        'nothing here is validated against a plate reading an actor; the record holds no ' +
        'emotion -> centre-of-pressure amplitude at all' );
    note( '⚠️ cannot see 5', 'A/P-is-ankle is conditional',
        'Winter\'s tandem row swaps both axes\' owners. This figure stands at 18.6° included foot ' +
        'angle so the intermediate row applies; a re-posed figure invalidates the routing' );
    note( '⚠️ cannot see 6', 'the CoP leads the CoM',
        'BodyMass is a CoM instrument and a SUSTAINED CoP offset is a CoM offset (Sway.js header). ' +
        'During a transient they separate by a few mm, zero-mean, so a paired mean is safe and a ' +
        'single frame is not' );
    note( '⚠️ cannot see 7', 'one bake, one window',
        `${ path.basename( figurePath ) } at ${ AFFECT_SECONDS } s. The footprint section below is ` +
        'the one that varies both, and it is where this axis\'s real limit lives' );

}

/**
 * ================================================================================================
 * COMPOSITE FOOTPRINT — ⚠️ THIS SECTION IS RED, AND THE DEFECT IS OLDER THAN 6.9
 * ================================================================================================
 *
 * 🚩 READ THIS BEFORE READING THE FAILURE. Nothing below is caused by punch-list 6.9 and nothing
 * below is fixed by it. This is a measurement of the SHIPPED tree — `ExpressionLayer` +
 * `PostureLayer` + `Sway`, affect full scale 0, no bias anywhere — and it is 6.9's PRECONDITION:
 * the item asks for an affect-driven fore-and-aft bias, and the first question anybody should have
 * asked is whether this axis has millimetres to spend. It does not. It is already overdrawn.
 *
 * WHAT IT MEASURES. Every emotion's whole-body centre of mass over 900 s of live sway, against the
 * bake's own base of support read off its own mesh. A body that is not accelerating has no net
 * moment, so a SUSTAINED centre-of-pressure offset sits under the centre of mass — `Sway.js`'s own
 * root — and a centre of mass outside the feet is a figure falling over.
 *
 * 🎯 WHY THE EXISTING GATE CANNOT SEE IT, WHICH IS THE INSTRUMENT LESSON. `affect.selftest.mjs`
 * makes exactly this claim — *"every emotion leaves the centre of mass INSIDE the measured
 * footprint"* — and is green, because it measures a STATIC PLATE with no `Sway` in the stack. Its
 * tightest margin is a real number about a figure that is not swaying. Sway's own footprint gates
 * are green for the mirror-image reason: they run with no affect in the stack. Two green gates,
 * one over each half, and the composite of the two halves is what leaves the feet. Neither
 * instrument is wrong; the gap between them was never measured.
 *
 * ⚠️ TWO PROTOCOLS ARE PRINTED AND THE VERDICT CAN FLIP BETWEEN THEM, so neither is quoted alone.
 * RAW pushes the mesh's undeformed vertices through the mesh's world matrix, which is what
 * `affect.selftest.mjs` does today and which reads the figure in its BIND pose. SKINNED pushes each
 * vertex through its own bone matrices, which is where the mesh actually is once `relaxed-standing`
 * has been applied. The skinned foot is 3-4 mm longer at the heel on every bake. **The gate is
 * stated against SKINNED**, because that is the geometry a viewer sees and the more forgiving of
 * the two — a red under the forgiving protocol is not an artefact of the strict one.
 *
 * ⚠️ AND THE WINDOW IS ITSELF A GATE PARAMETER (§1.4). Duarte's antero-posterior drift lattice turns
 * over every 319 s, so the deepest rearward excursion of a 900 s trace is not in its first 120 s:
 * measured, the worst frame across every bake and both presets is seed 1234 at t = 373.4 s. A
 * margin quoted without a window length says nothing, which is why this runs at TRACE_SECONDS.
 *
 * **NEXT AGENT: do not fix this by lowering the affect full scale — it is already 0.** The two
 * mechanisms that sum outside are `Sway`'s own rearward drift (neutral reaches -41.565 mm on g000,
 * inside by 3.037 mm raw) and `PostureLayer`'s fear chest bend (-9.393 mm of centre of mass). Both
 * are individually inside budget and neither is unsourced. The real candidates are: clamp the
 * antero-posterior weight shift against the measured REAR footprint rather than against Duarte's
 * amplitude alone (`resolvePostureLimits` reads no vertex fore-and-aft — measured 34.000 mm on all
 * five bakes whose rear edges span 44.60 to 65.37 mm); or give the pendulum a footprint-aware
 * saturation. Both are balance-model changes and neither belongs to 6.9.
 */
function measureCompositeFootprint() {

    section( 'COMPOSITE FOOTPRINT — ⚠️ RED, and older than 6.9: CoM vs the base of support, Sway LIVE' );

    note( 'window x seeds', `${ TRACE_SECONDS } s x ${ SWAY_SEEDS.length }`,
        'Duarte\'s AP drift lattice turns over every 319 s, so a short window over-reports headroom' );

    let worstSkinnedMargin = Infinity;
    let worstLabel = '';
    let bakesMeasured = 0;

    // 🚩 THE WINDOW TABLE, AND WHY IT IS COLLECTED RATHER THAN WRITTEN DOWN. See
    // `measureBakeFootprint`. Keyed `bake/preset` so the shortening effect is visible per row.
    const windowRows = [];

    for ( const bake of FOOTPRINT_BAKES ) {

        const measured = measureBakeFootprint( bake );

        if ( measured === null ) {

            note( `bake ${ bake }`, 'absent', 'not in assets/figures — skipped, not passed' );
            continue;

        }

        bakesMeasured += 1;

        for ( const [ preset, deepest ] of Object.entries( measured.deepestRear ) ) {

            const rawMargin = deepest - measured.raw.rear;
            const skinnedMargin = deepest - measured.skinned.rear;

            note( `${ bake } ${ preset }  deepest rear CoM (mm)`, deepest.toFixed( 3 ),
                `rear edge ${ measured.raw.rear.toFixed( 2 ) } raw / ${ measured.skinned.rear.toFixed( 2 ) } ` +
                `skinned  ->  margin ${ rawMargin.toFixed( 3 ) } / ${ skinnedMargin.toFixed( 3 ) }` );

            if ( skinnedMargin < worstSkinnedMargin ) {

                worstSkinnedMargin = skinnedMargin;
                worstLabel = `${ bake } / ${ preset }`;

            }

            windowRows.push( { label: `${ bake } ${ preset }`, rear: measured.skinned.rear,
                windows: measured.windowRear[ preset ] } );

        }

    }

    // --- the window table, measured -------------------------------------------------------

    let worstShorteningGainMm = -Infinity;
    let shorteningLabel = '';

    for ( const row of windowRows ) {

        const cells = FOOTPRINT_WINDOWS_SECONDS
            .map( ( w ) => `${ w }s ${ ( row.windows[ w ] - row.rear ).toFixed( 3 ) }` ).join( '   ' );

        note( `${ row.label }  skinned margin by window (mm)`, cells, '' );

        const shortest = row.windows[ FOOTPRINT_WINDOWS_SECONDS[ 0 ] ] - row.rear;
        const longest = row.windows[ FOOTPRINT_WINDOWS_SECONDS[ FOOTPRINT_WINDOWS_SECONDS.length - 1 ] ] - row.rear;

        if ( shortest - longest > worstShorteningGainMm ) {

            worstShorteningGainMm = shortest - longest;
            shorteningLabel = row.label;

        }

    }

    // 🎯 THE CLAIM THE PROSE USED TO MAKE, NOW EXECUTED. "A margin quoted without a window length is
    // meaningless" is only worth writing down if a short window really does over-report headroom, so
    // that is what is gated: the shortest window must claim materially more room than the longest.
    // If this ever went to zero the whole window caveat would be decoration, and three documents
    // would still be repeating it.
    gate( 'a 60 s window over-reports headroom against 900 s (mm)', worstShorteningGainMm, 1, 100,
        `worst row: ${ shorteningLabel }. Duarte's A/P drift lattice turns over every 319 s, so a ` +
        'window under that samples one phase of it. This is measured off the same trace the red ' +
        'clause below reads, so the two cannot disagree' );

    // 🚩 THE DEGENERATE INPUT, AND WHY THIS CLAUSE EXISTS AT ALL.
    //
    // `worstSkinnedMargin` starts at Infinity and is only lowered inside the loop, so with no bake
    // present the red clause below reads `Infinity >= 0 && Infinity <= Infinity` — TRUE — and this
    // file's one declared red silently turns green. That is not hypothetical: the figure bakes are
    // 232 MB of git-LFS objects, and a clone without LFS gets pointer files, which is the single
    // most likely way somebody runs this suite. LEARNINGS §1.3: ask what a degenerate input scores.
    gate( 'the footprint bakes were actually present and measured', bakesMeasured,
        FOOTPRINT_BAKES.length, FOOTPRINT_BAKES.length,
        `${ bakesMeasured } of ${ FOOTPRINT_BAKES.length }. Without this, a partial LFS checkout ` +
        'passes the red clause below at Infinity rather than failing it' );

    gate( 'every emotion stays inside the SKINNED footprint (mm)', worstSkinnedMargin, 0, Infinity,
        `tightest: ${ worstLabel }. ⚠️ PRE-EXISTING — measured on the shipped tree with the affect ` +
        'full scale at 0. Declared in docs/RED-GATES.md; see this section\'s header for why the ' +
        'two green gates either side of it cannot see this' );

}

// --- rig / stack plumbing -------------------------------------------------------------------------

/**
 * A fresh stack driving a fresh copy of the figure's pose.
 *
 * The pose is restored from `relaxed-standing` before every stack is bound. MotionStack captures its
 * rest pose from whatever the rig is in at bind time, so binding a second stack to a figure a
 * previous one has already driven captures a DISPLACED rest and every absolute measurement above
 * would be off by the last frame of the previous run.
 */
function buildStack( seed, options = {} ) {

    restoreRestPose();

    const root = figure.root;
    const stack = new MotionStack( { seed } );

    stack.bind( createMotionTarget( root ) );

    const layer = stack.add( new Sway( options ) );

    return { stack, layer, root };

}

/**
 * The four signals a gate cares about, over one run of a layer built however the caller likes.
 *
 * `afterBind` runs once the layer is bound and before the first frame, which is where a
 * deliberately broken rig fact gets injected — the bind-time probes have finished by then, so a
 * lever written here is the lever the frame loop will actually use.
 */
function runSignals( seconds, options = {}, afterBind = null ) {

    const { stack, layer, root } = buildStack( SEED, options );

    if ( afterBind !== null ) afterBind( layer );

    const frames = Math.round( seconds * SAMPLE_RATE_HZ );

    const signals = {
        balanceMedioLateral: new Float64Array( frames ),
        balanceAnteroPosterior: new Float64Array( frames ),
        commandedMedioLateral: new Float64Array( frames ),
        commandedAnteroPosterior: new Float64Array( frames ),
        realisedMedioLateral: new Float64Array( frames ),
        realisedAnteroPosterior: new Float64Array( frames )
    };

    root.updateMatrixWorld( true );

    const restCentreOfMass = bodyMass.centreOfMass( new Vector3() );
    const centreOfMass = new Vector3();

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        bodyMass.centreOfMass( centreOfMass );

        signals.balanceMedioLateral[ frame ] = layer.balanceDisplacement.x;
        signals.balanceAnteroPosterior[ frame ] = layer.balanceDisplacement.z;
        signals.commandedMedioLateral[ frame ] = layer.displacement.x;
        signals.commandedAnteroPosterior[ frame ] = layer.displacement.z;
        signals.realisedMedioLateral[ frame ] = centreOfMass.x - restCentreOfMass.x;
        signals.realisedAnteroPosterior[ frame ] = centreOfMass.z - restCentreOfMass.z;

    }

    stack.dispose();

    return signals;

}

function restoreRestPose() {

    for ( const [ object, rest ] of restPose ) {

        object.quaternion.copy( rest.quaternion );
        object.position.copy( rest.position );

    }

    figure.root.updateMatrixWorld( true );

}

function worldHeightOfBone( root, boneName ) {

    return root.getObjectByName( boneName ).matrixWorld.elements[ 13 ];

}

/**
 * The head's travel per radian of lean, as one number.
 *
 * The layer measures it per axis because a figure standing with its weight slightly forward has a
 * centre of mass off the frontal plane and the two are then genuinely different. On a symmetric
 * figure they agree to about 0.02%, and the segment prediction below compares a RESULTANT
 * excursion, so it wants the one number.
 */
/**
 * 🎯 The ANTERO-POSTERIOR head lever, and not the mean of the two axes it used to be.
 *
 * The two were within a hair of each other while both axes were rigid rotations, so averaging them
 * was free. They are not any more: the layer parks the head during a lateral lean, which halves the
 * lateral lever by design. Every prediction this feeds is a rigid-rotation prediction, and the
 * rotation is only rigid fore and aft — so averaging in the lateral lever would silently scale every
 * pendulum prediction by 0.73 and fail the geometry gate against a model that is doing the right
 * thing.
 */
function headLeverMetres( layer ) {

    return layer.headLever.anteroPosterior;

}

/** The fraction of the reference marker's excursion a rigid pendulum gives a segment. */
function predictedSegmentRatio( layer, height ) {

    return layer.anklePendulumShare * ( height - layer.pivot.y ) / headLeverMetres( layer );

}

// --- punch-list 6.9: the affect harness -----------------------------------------------------------

/**
 * 🎯 THE PRODUCT'S OWN CONSTRUCTION, and nothing shorter, because a hand-built layer is paid-for
 * failure #1 with extra steps.
 *
 * `new ExpressionLayer()` -> `trigger()` -> `state.push( pad )` -> `settleAffect( state )` ->
 * `stack.add( layer )` -> `stack.add( layer.postureLayer() )` -> publish `shared.posture` ->
 * `stack.add( new Sway() )`. That is the sequence `Avatar.js` and `alive.js` both run, in that
 * order, and driving it from a PAD PRESET rather than by writing to any field of `Sway` is what
 * makes this a measurement of the shipped path.
 *
 * ⚠️ `settleAffect` IS NOT A BACK DOOR — it is the same arithmetic the frame loop runs, at a 10 ms
 * step for 3 s, which is fifteen attack time constants. One frame would be worse than useless here:
 * `ExpressionMap.activate()` re-labels mid-attack, so the prescription is not monotonic in time and
 * an early frame is a different emotion.
 *
 * @param {string} preset - A key of `EMOTION_PRESETS`.
 * @param {number} seed
 * @param {Object} [options]
 * @param {'live'|'weight'|'bones'} [options.freeze='live'] - Which trunk freeze, if any. See the
 *   section header for the four that were measured and why two are refused.
 * @param {number} [options.fullScaleMm=0] - 🚩 THE UNSOURCED AMPLITUDE, in millimetres, supplied by
 *   the caller. 0 is the shipped tree.
 * @param {number} [options.seconds=AFFECT_SECONDS]
 * @param {Object} [options.swayOptions={}] - Passed to `new Sway`, which is where SWAY_DEFECTS go.
 * @param {boolean} [options.publish=true] - Whether `shared.posture` is written. false rebuilds the
 *   configuration `alive.js` shipped before 6.9.
 * @param {boolean} [options.withPosture=true] - false builds a stack with no affect at all.
 * @param {number|null} [options.disableAt=null] - Frame at which `posture.enabled` goes false.
 */
function affectTrace( preset, seed, options = {} ) {

    const {
        freeze = 'live', fullScaleMm = 0, seconds = AFFECT_SECONDS,
        swayOptions = {}, publish = true, withPosture = true, disableAt = null
    } = options;

    restoreRestPose();

    const stack = new MotionStack( { seed } );
    stack.bind( createMotionTarget( figure.root ) );

    const pad = EMOTION_PRESETS[ preset ];
    const expression = new ExpressionLayer();

    if ( pad.trigger !== undefined ) expression.trigger( pad.trigger );

    expression.state.push( { pleasure: pad.pleasure, arousal: pad.arousal, dominance: pad.dominance } );
    settleAffect( expression.state );

    stack.add( expression );

    let posture = null;

    if ( withPosture === true ) {

        // The two surviving freezes, and each is one option. `weight: 0` releases every bone this
        // layer writes while `update()` still runs; `bones: { spine: <missing> }` releases only the
        // trunk channel. Neither touches `enabled`, which would remove the hand-off under test.
        const freezeOptions = freeze === 'weight' ? { weight: 0 }
            : freeze === 'bones' ? { bones: { spine: '__affect_gate_no_such_bone__' } }
                : {};

        posture = expression.postureLayer( {
            centreOfPressureFullScaleMetres: fullScaleMm / 1000,
            ...freezeOptions
        } );

        stack.add( posture );

        if ( publish === true ) stack.context.shared.posture = posture;

    }

    const sway = stack.add( new Sway( swayOptions ) );

    figure.root.updateMatrixWorld( true );

    const rest = bodyMass.centreOfMass( new Vector3() );
    const centreOfMass = new Vector3();

    const frames = Math.max( 1, Math.round( seconds * SAMPLE_RATE_HZ ) );

    let realisedSum = 0;
    let commandedSum = 0;
    let biasSum = 0;

    // The BOTH-FEET toe lift, which is the fore-and-aft mechanism's own signal. `writeToeLift`
    // takes `Math.max` of a per-foot lateral unload and a shared fore-and-aft reading, and the
    // lateral one already saturates `TOE_UNLOAD_LIFT_DEGREES` on whichever foot is free — so the
    // MINIMUM over the two feet is the part a centre-of-pressure bias can move.
    let toeSum = 0;
    let toeFloor = Infinity;

    for ( let frame = 0; frame < frames; frame ++ ) {

        if ( disableAt !== null && frame === disableAt && posture !== null ) posture.enabled = false;

        stack.update( FRAME_SECONDS );
        figure.root.updateMatrixWorld( true );
        bodyMass.centreOfMass( centreOfMass );

        realisedSum += ( centreOfMass.z - rest.z ) * 1000;
        commandedSum += sway.displacement.z * 1000;
        biasSum += sway.affectCentreOfPressureBias * 1000;
        const bothFeetLift =
            Math.min( sway.toeLiftRadians.left, sway.toeLiftRadians.right ) * 180 / Math.PI;

        toeSum += bothFeetLift;
        toeFloor = Math.min( toeFloor, bothFeetLift );

    }

    const trace = {
        realised: realisedSum / frames,
        commanded: commandedSum / frames,
        bias: biasSum / frames,
        toeLiftMeanDegrees: toeSum / frames,
        toeLiftFloorDegrees: toeFloor,
        finalBias: sway.affectCentreOfPressureBias * 1000,
        limit: sway.affectBiasLimit * 1000,
        clamped: sway.affectBiasClamped,
        approach: posture === null ? 0 : posture.prescription.approach,
        intensity: posture === null ? 0 : posture.prescription.intensity,
        applied: posture === null ? 0 : posture.appliedDegrees.approach
    };

    stack.dispose();

    return trace;

}

/**
 * 🚩 THE STATISTIC: a PAIRED same-seed difference against a neutral run, averaged over seeds.
 *
 * Not an absolute mean. Measured on `figure_g050`, 6 seeds x 60 s: the unpaired neutral mean has a
 * standard deviation of 6.8286 mm ACROSS SEEDS, against an effect of 14 mm — so an absolute-mean
 * band would be a band on Duarte's 319 s drift lattice wearing an emotion's name. Pairing removes
 * it exactly, because `Sway`'s processes are a pure function of the seed and never read the centre
 * of mass back: the paired standard deviation is 0.0037 mm, a reduction of about 1800x.
 */
function pairedAffectTrace( preset, options = {} ) {

    const differences = AFFECT_SEEDS.map( ( seed ) => {

        const emotion = affectTrace( preset, seed, options );
        const neutral = affectTrace( 'neutral', seed, options );

        return {
            realised: emotion.realised - neutral.realised,
            commanded: emotion.commanded - neutral.commanded,
            bias: emotion.bias - neutral.bias,
            sample: emotion
        };

    } );

    const meanOf = ( key ) =>
        differences.reduce( ( total, d ) => total + d[ key ], 0 ) / differences.length;

    const realised = meanOf( 'realised' );

    const realisedSd = Math.sqrt( differences
        .reduce( ( total, d ) => total + ( d.realised - realised ) ** 2, 0 ) / differences.length );

    return {
        realised,
        realisedSd,
        commanded: meanOf( 'commanded' ),
        bias: meanOf( 'bias' ),
        sample: differences[ 0 ].sample
    };

}

/**
 * One bake's base of support, and the deepest rearward centre of mass the SHIPPED stack reaches in
 * it. Loads its own figure, because the defect this measures is a function of the FOOT the bake was
 * built with and the module-level figure is only one of five.
 *
 * ⚠️ BOTH FOOTPRINT PROTOCOLS, and they are not the same measurement. RAW pushes the geometry's
 * undeformed vertices through the mesh's world matrix — what `affect.selftest.mjs` does today, and
 * a read of the BIND pose. SKINNED pushes each vertex through its own bone matrices, which is where
 * the mesh is once `relaxed-standing` is applied. Measured, the skinned heel reaches 3-4 mm further
 * back on every bake, so quoting one protocol without naming it can move a verdict.
 *
 * Returns `null` when the bake is not present, which is reported rather than passed.
 */
function measureBakeFootprint( bake ) {

    // `Figure.parse` is async and every `measure*` function in this file is synchronous, so the
    // five bakes are parsed and posed once up front by `loadFootprintBakes()` and read out here.
    const loaded = footprintBakes.get( bake ) ?? null;

    if ( loaded === null ) return null;

    const root = loaded.figure.root;
    const bakeRest = loaded.restPose;

    // 🚩 REST FIRST, AND THIS IS A BUG FIX RATHER THAN TIDINESS. The bake under test is the SAME
    // object every other section in this file has been driving, so without this the footprint is
    // read off whatever pose the last trace left behind. Measured: the g050 rear edge read -54.41
    // mm posed against -54.43 mm at rest, and the deepest centre of mass moved 0.018 mm with it —
    // small, and exactly the order of the margins this section reports.
    const restoreBake = () => {

        for ( const [ object, rest ] of bakeRest ) {

            object.quaternion.copy( rest.quaternion );
            object.position.copy( rest.position );

        }

        root.updateMatrixWorld( true );

    };

    restoreBake();

    const boneAt = ( name, into ) =>
        into.setFromMatrixPosition( root.getObjectByName( name ).matrixWorld );

    const ankleMid = boneAt( HUMANOID_TO_FIGURE_BONE.leftFoot, new Vector3() )
        .add( boneAt( HUMANOID_TO_FIGURE_BONE.rightFoot, new Vector3() ) ).multiplyScalar( 0.5 );

    const footprintOf = ( skinned ) => {

        let rear = Infinity;
        let forward = -Infinity;

        const local = new Vector3();
        const world = new Vector3();

        root.traverse( ( object ) => {

            if ( object.isMesh !== true && object.isSkinnedMesh !== true ) return;

            const positions = object.geometry?.attributes?.position;
            if ( positions === undefined ) return;

            for ( let index = 0; index < positions.count; index ++ ) {

                local.fromBufferAttribute( positions, index );

                if ( skinned === true && object.isSkinnedMesh === true ) {

                    object.applyBoneTransform( index, local );

                }

                world.copy( local ).applyMatrix4( object.matrixWorld );

                if ( world.y > ankleMid.y ) continue;

                rear = Math.min( rear, world.z - ankleMid.z );
                forward = Math.max( forward, world.z - ankleMid.z );

            }

        } );

        return { rear: rear * 1000, forward: forward * 1000 };

    };

    const raw = footprintOf( false );
    const skinned = footprintOf( true );

    const bakeMass = new BodyMass().bind( { getBone: ( name ) => root.getObjectByName( name ) ?? null } );

    const deepestRear = {};
    const windowRear = {};

    // neutral and fear only: fear is the one preset whose `approach` is NEGATIVE, so it is the one
    // that composes with a rearward drift, and neutral is what says how much of the excursion is
    // Sway's alone. anger and disgust both lean forward and are reported by the AFFECT section.
    for ( const preset of [ 'neutral', 'fear' ] ) {

        let deepest = Infinity;

        // 🚩 THE WINDOW PREFIXES ARE MEASURED HERE, NOT QUOTED IN PROSE, AND THAT IS A REPAIR.
        //
        // The first version of this section stated a window-dependence table in three separate
        // documents and had no gate behind any of it. Two independent adversarial passes re-measured
        // the 60 s row and got +4.58 mm where the prose claimed +19.166 mm — a number no run
        // reproduces at any seed count, carrying one of the two stated reasons the affect full scale
        // ships at zero. A claim replicated into three files with nothing executing it is exactly the
        // failure `run-selftests.sh`'s header describes: information that was never missing and was
        // read by nobody.
        //
        // Every window here is a PREFIX of the trace that is already running, so the whole table
        // costs one comparison per frame and cannot drift from the 900 s row beneath it.
        const deepestAtWindow = new Map( FOOTPRINT_WINDOWS_SECONDS.map( ( w ) => [ w, Infinity ] ) );

        for ( const seed of SWAY_SEEDS ) {

            restoreBake();

            const stack = new MotionStack( { seed } );
            stack.bind( createMotionTarget( root ) );

            const pad = EMOTION_PRESETS[ preset ];
            const expression = new ExpressionLayer();

            if ( pad.trigger !== undefined ) expression.trigger( pad.trigger );

            expression.state.push( { pleasure: pad.pleasure, arousal: pad.arousal, dominance: pad.dominance } );
            settleAffect( expression.state );

            stack.add( expression );

            const posture = stack.add( expression.postureLayer() );
            stack.context.shared.posture = posture;
            stack.add( new Sway() );

            const centreOfMass = new Vector3();
            const frames = Math.round( TRACE_SECONDS * SAMPLE_RATE_HZ );

            for ( let frame = 0; frame < frames; frame ++ ) {

                stack.update( FRAME_SECONDS );
                root.updateMatrixWorld( true );
                bakeMass.centreOfMass( centreOfMass );

                const rear = ( centreOfMass.z - ankleMid.z ) * 1000;
                deepest = Math.min( deepest, rear );

                const elapsed = ( frame + 1 ) / SAMPLE_RATE_HZ;

                for ( const window of FOOTPRINT_WINDOWS_SECONDS ) {

                    if ( elapsed <= window ) deepestAtWindow.set( window, Math.min( deepestAtWindow.get( window ), rear ) );

                }

            }

            stack.dispose();

        }

        deepestRear[ preset ] = deepest;
        windowRear[ preset ] = Object.fromEntries( deepestAtWindow );

    }

    return { raw, skinned, deepestRear, windowRear };

}

// --- measurement ----------------------------------------------------------------------------------

/**
 * The 1-sigma relative scatter of an RMS estimate taken over `seconds` of a signal whose spectral
 * mode is `modeHz`.
 *
 * A window of T seconds of a signal at f Hz contains n = fT independent cycles, and the relative
 * standard error of a variance estimate from n independent samples is sqrt(2/n), so an RMS — the
 * square root of that — scatters by half as much, 1/sqrt(2n). This is what every amplitude band in
 * this file is derived from, so the bands widen automatically at short windows instead of being
 * hand-set per window and quietly fitted to whatever the layer happened to produce.
 */
function rmsEstimatorSigma( seconds, modeHz ) {

    return 1 / Math.sqrt( 2 * seconds * modeHz );

}

/** Whether a measurement falls outside `centre * (1 +/- relativeWidth)`. */
function outsideBand( value, centre, relativeWidth ) {

    return value < centre * ( 1 - relativeWidth ) || value > centre * ( 1 + relativeWidth );

}

/**
 * The mean of |N(mu, sigma)| — the folded normal — in closed form.
 *
 * This is the oracle for the defect `drawAmplitude` fixed. Written as the formula rather than as
 * the number it evaluates to, because a hand-computed constant is exactly the sort of thing §1.5
 * found agents reaching for to confirm a result rather than measuring it.
 */
function foldedNormalMean( mu, sigma ) {

    const standardised = mu / sigma;

    return sigma * Math.sqrt( 2 / Math.PI ) * Math.exp( -0.5 * standardised ** 2 )
        + mu * ( 2 * standardNormalCdf( standardised ) - 1 );

}

/** Phi(x), via Abramowitz & Stegun 7.1.26 on erf. Accurate to about 1.5e-7, which is ample here. */
function standardNormalCdf( x ) {

    const sign = x < 0 ? -1 : 1;
    const z = Math.abs( x ) / Math.SQRT2;

    const t = 1 / ( 1 + 0.3275911 * z );
    const series = t * ( 0.254829592 + t * ( -0.284496736
        + t * ( 1.421413741 + t * ( -1.453152027 + t * 1.061405429 ) ) ) );

    const erf = 1 - series * Math.exp( -z * z );

    return 0.5 * ( 1 + sign * erf );

}

/**
 * 🎯 The sole's outward normal, in world space, WITHOUT assuming anything about the rig's local
 * axis convention.
 *
 * The definition used is the only one that needs no such assumption: the sole is flat on the floor
 * in the rest pose, so whichever direction in the foot bone's own frame is world-vertical AT REST
 * is the sole's normal, for good. `soleNormalInBoneFrame` resolves that once; this then carries it
 * through whatever the bone is doing now.
 *
 * Tried the obvious way first and it was wrong: the foot bone's local +Y is not up on this rig, it
 * runs along the bone, so a turn about the world vertical swung it and the gate reported 2.61
 * degrees of "sole tilt" for a rotation that by construction cannot tilt a sole at all.
 */
function soleNormalInBoneFrame( footBone, target ) {

    const rotation = footBone.getWorldQuaternion( new Quaternion() ).invert();

    return target.set( 0, 1, 0 ).applyQuaternion( rotation );

}

function soleNormalOf( footBone, inBoneFrame, target ) {

    return target.copy( inBoneFrame ).applyQuaternion( footBone.getWorldQuaternion( new Quaternion() ) );

}

function angleBetweenVectorsDegrees( a, b ) {

    const cosine = Math.min( Math.max( a.dot( b ) / ( a.length() * b.length() ), -1 ), 1 );

    return Math.acos( cosine ) * 180 / Math.PI;

}

/** RMS of the horizontal excursion about the mean position, in metres. */
function resultantRms( points ) {

    const centreX = mean( points.map( ( point ) => point.x ) );
    const centreZ = mean( points.map( ( point ) => point.z ) );

    let total = 0;

    for ( const point of points ) {

        total += ( point.x - centreX ) ** 2 + ( point.z - centreZ ) ** 2;

    }

    return Math.sqrt( total / points.length );

}

/** Total distance travelled, in millimetres. The statistic the failed model reported as 0.0000. */
function pathLengthMillimetres( points ) {

    let total = 0;

    for ( let i = 1; i < points.length; i ++ ) total += points[ i ].distanceTo( points[ i - 1 ] );

    return total * 1000;

}

function mean( values ) {

    let total = 0;
    for ( const value of values ) total += value;

    return total / values.length;

}

/** The smallest of a large sample. A spread would blow the call stack at a few hundred thousand. */
function smallest( values ) {

    let lowest = Infinity;
    for ( const value of values ) lowest = Math.min( lowest, value );

    return lowest;

}

function standardDeviation( values ) {

    const centre = mean( values );

    let total = 0;
    for ( const value of values ) total += ( value - centre ) ** 2;

    return Math.sqrt( total / values.length );

}

function median( values ) {

    const sorted = [ ...values ].sort( ( a, b ) => a - b );
    const middle = sorted.length >> 1;

    if ( sorted.length % 2 === 1 ) return sorted[ middle ];

    return ( sorted[ middle - 1 ] + sorted[ middle ] ) / 2;

}

function rootMeanSquare( samples ) {

    return standardDeviation( samples );

}

/** Peak-to-peak, because the defect this file's newest gates were written for lived in the peaks. */
function peakToPeak( samples ) {

    return Math.max( ...samples ) - Math.min( ...samples );

}

/**
 * Pearson's r between two equal-length series.
 *
 * The first correlation this repository has ever computed between two body parts, which is the whole
 * finding of §1.7d: a layer that claims a body is ARTICULATED rather than rigid is making a claim
 * about how its parts move relative to each other, and no amplitude can express that.
 */
function pearson( a, b ) {

    const meanA = a.reduce( ( total, value ) => total + value, 0 ) / a.length;
    const meanB = b.reduce( ( total, value ) => total + value, 0 ) / b.length;

    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;

    for ( let index = 0; index < a.length; index ++ ) {

        const deviationA = a[ index ] - meanA;
        const deviationB = b[ index ] - meanB;

        covariance += deviationA * deviationB;
        varianceA += deviationA * deviationA;
        varianceB += deviationB * deviationB;

    }

    const spread = Math.sqrt( varianceA * varianceB );

    return spread === 0 ? 0 : covariance / spread;

}

/**
 * The least-squares slope of `y` on `x`, which is the GAIN a correlation deliberately throws away.
 *
 * Pearson's r is scale-free by construction: it answers "do these two move together, and in which
 * direction," and it answers it identically for a head that opposes the trunk by a tenth and a head
 * bolted rigidly in space. Both score -1. §1.3 asks what a degenerate input scores at a gate, and
 * for a correlation the honest answer is "the best possible mark," so anywhere this file cares HOW
 * MUCH one part answers another it has to gate the slope as well as the sign.
 */
function regressionSlope( x, y ) {

    const meanX = x.reduce( ( total, value ) => total + value, 0 ) / x.length;
    const meanY = y.reduce( ( total, value ) => total + value, 0 ) / y.length;

    let covariance = 0;
    let varianceX = 0;

    for ( let index = 0; index < x.length; index ++ ) {

        const deviationX = x[ index ] - meanX;

        covariance += deviationX * ( y[ index ] - meanY );
        varianceX += deviationX * deviationX;

    }

    return varianceX === 0 ? 0 : covariance / varianceX;

}

/**
 * Welch-averaged power spectrum: overlapping Hann-windowed segments, averaged.
 *
 * A single periodogram of a stochastic signal has ~100% variance per bin, which makes the peak bin —
 * the "frequency mode" the literature quotes — pure noise. Averaging segments is what makes a mode
 * meaningful, and a five-bin moving average on top of that is what keeps it stable across seeds.
 * Both are standard practice in the posturography papers these targets come from.
 */
function welchSpectrum( samples, segmentLength ) {

    const half = segmentLength >> 1;
    const step = segmentLength >> 1;
    const power = new Float64Array( half );
    const window = new Float64Array( segmentLength );

    for ( let i = 0; i < segmentLength; i ++ ) {
        window[ i ] = 0.5 - 0.5 * Math.cos( 2 * Math.PI * i / ( segmentLength - 1 ) );
    }

    let segments = 0;

    for ( let start = 0; start + segmentLength <= samples.length; start += step ) {

        let centre = 0;
        for ( let i = 0; i < segmentLength; i ++ ) centre += samples[ start + i ];
        centre /= segmentLength;

        const windowed = new Float64Array( segmentLength );
        for ( let i = 0; i < segmentLength; i ++ ) {
            windowed[ i ] = ( samples[ start + i ] - centre ) * window[ i ];
        }

        const segmentPower = fastFourierPower( windowed );
        for ( let k = 0; k < half; k ++ ) power[ k ] += segmentPower[ k ];

        segments ++;

    }

    for ( let k = 0; k < half; k ++ ) power[ k ] /= segments;

    const smoothed = new Float64Array( half );
    for ( let k = 0; k < half; k ++ ) {

        let total = 0;
        let count = 0;

        for ( let j = Math.max( 0, k - 2 ); j <= Math.min( half - 1, k + 2 ); j ++ ) {
            total += power[ j ];
            count ++;
        }

        smoothed[ k ] = total / count;

    }

    const frequencyOf = ( k ) => k * SAMPLE_RATE_HZ / segmentLength;

    // Bins below the postural band are dropped from every statistic below. See the note on
    // POSTURAL_BAND_FLOOR_HZ: the weight-shift process lives down there and the papers these
    // targets come from could not see it.
    const firstBin = Math.max( 1, Math.ceil( POSTURAL_BAND_FLOOR_HZ * segmentLength / SAMPLE_RATE_HZ ) );

    let total = 0;
    let above2Hz = 0;
    let mode = 0;
    let modePower = -1;
    let weightedFrequency = 0;

    for ( let k = firstBin; k < half; k ++ ) {

        const frequency = frequencyOf( k );

        total += power[ k ];
        weightedFrequency += power[ k ] * frequency;

        if ( frequency > 2 ) above2Hz += power[ k ];
        if ( smoothed[ k ] > modePower ) { modePower = smoothed[ k ]; mode = frequency; }

    }

    let cumulative = 0;
    let f50 = 0;
    let f95 = 0;

    for ( let k = firstBin; k < half; k ++ ) {

        cumulative += power[ k ];
        if ( f50 === 0 && cumulative >= 0.5 * total ) f50 = frequencyOf( k );
        if ( f95 === 0 && cumulative >= 0.95 * total ) f95 = frequencyOf( k );

    }

    return {
        mode,
        // The power-weighted centroid of the same band. A max-bin estimate reads one bin of a
        // stochastic spectrum and inherits its full variance; the centroid reads all of them, so it
        // moves when the SHAPE moves and not when a single bin happens to spike.
        bandCentroid: weightedFrequency / total,
        f50,
        f95,
        powerAbove2HzPercent: 100 * above2Hz / total,
        segments
    };

}

/** Iterative radix-2 FFT, returning |X(k)|^2 for k < n/2. `real.length` must be a power of two. */
function fastFourierPower( real ) {

    const n = real.length;
    const re = Float64Array.from( real );
    const im = new Float64Array( n );

    for ( let i = 1, j = 0; i < n; i ++ ) {

        let bit = n >> 1;
        for ( ; j & bit; bit >>= 1 ) j ^= bit;
        j ^= bit;

        if ( i < j ) {
            const swapRe = re[ i ]; re[ i ] = re[ j ]; re[ j ] = swapRe;
            const swapIm = im[ i ]; im[ i ] = im[ j ]; im[ j ] = swapIm;
        }

    }

    for ( let length = 2; length <= n; length <<= 1 ) {

        const angle = -2 * Math.PI / length;
        const stepRe = Math.cos( angle );
        const stepIm = Math.sin( angle );

        for ( let start = 0; start < n; start += length ) {

            let twiddleRe = 1;
            let twiddleIm = 0;

            for ( let k = 0; k < length / 2; k ++ ) {

                const evenRe = re[ start + k ];
                const evenIm = im[ start + k ];
                const oddRe = re[ start + k + length / 2 ] * twiddleRe - im[ start + k + length / 2 ] * twiddleIm;
                const oddIm = re[ start + k + length / 2 ] * twiddleIm + im[ start + k + length / 2 ] * twiddleRe;

                re[ start + k ] = evenRe + oddRe;
                im[ start + k ] = evenIm + oddIm;
                re[ start + k + length / 2 ] = evenRe - oddRe;
                im[ start + k + length / 2 ] = evenIm - oddIm;

                const nextRe = twiddleRe * stepRe - twiddleIm * stepIm;
                twiddleIm = twiddleRe * stepIm + twiddleIm * stepRe;
                twiddleRe = nextRe;

            }

        }

    }

    const half = n >> 1;
    const power = new Float64Array( half );
    for ( let k = 0; k < half; k ++ ) power[ k ] = re[ k ] * re[ k ] + im[ k ] * im[ k ];

    return power;

}

// --- reporting ------------------------------------------------------------------------------------

function section( title ) {

    console.log( `\n${ title }\n${ '-'.repeat( title.length ) }` );

}

function gate( label, value, low, high, source ) {

    const passed = value >= low && value <= high;

    results.push( { label, passed } );

    const range = high === Infinity ? `>= ${ format( low ) }`
        : high - low < 1e-6 ? `= ${ format( low ) }`
            : `${ format( low ) } .. ${ format( high ) }`;

    console.log(
        `  ${ passed ? 'PASS' : 'FAIL' }  ${ label.padEnd( 44 ) } ${ format( value ).padStart( 10 ) }` +
        `   target ${ range.padEnd( 18 ) } ${ source }`
    );

}

/** A gate stated as a centre and a relative half-width, which is how every derived band here reads. */
function gateBand( label, value, centre, relativeWidth, source ) {

    gate( label, value, centre * ( 1 - relativeWidth ), centre * ( 1 + relativeWidth ), source );

}

/**
 * A gate on a Poisson rate. The band is 3 standard deviations of the COUNT, converted back to a
 * rate — so a longer observation window automatically tightens it and nothing is hand-set.
 */
function gatePoissonRate( label, measured, expectedPerMinute, minutes, source ) {

    const expectedCount = expectedPerMinute * minutes;
    const width = 3 * Math.sqrt( expectedCount ) / minutes;

    gate( label, measured, expectedPerMinute - width, expectedPerMinute + width, source );

}

/**
 * A gate on a coin. The band is 3 standard errors of a binomial proportion, sqrt(0.25/n), so it is
 * derived from how many draws were observed rather than picked.
 */
function gateFairCoin( label, successes, trials, source ) {

    const width = 3 * Math.sqrt( 0.25 / trials );

    gate( label, successes / trials, 0.5 - width, 0.5 + width,
        source === '' ? `${ successes } of ${ trials }` : `${ successes } of ${ trials }; ${ source }` );

}

function note( label, value, source = '' ) {

    console.log( `  ....  ${ label.padEnd( 44 ) } ${ String( value ).padStart( 10 ) }   ${ source }` );

}

function format( value ) {

    if ( value === 0 ) return '0';
    if ( Math.abs( value ) < 1e-4 ) return value.toExponential( 1 );

    return value.toFixed( 3 );

}

function report() {

    const failed = results.filter( ( result ) => result.passed === false );

    console.log( `\n${ results.length - failed.length }/${ results.length } gates passed` );

    if ( failed.length > 0 ) {

        console.log( 'FAILED:' );
        for ( const result of failed ) console.log( `  - ${ result.label }` );

        process.exitCode = 1;

    }

    console.log( '' );

}
