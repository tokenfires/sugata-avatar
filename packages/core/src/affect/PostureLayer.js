/**
 * PostureLayer — the actuator for `ExpressionMap.body()`. Punch-list 6.2's affect half, and 6.2(a).
 *
 * 🚩 WHY THIS FILE EXISTS, STATED AS THE DEFECT IT CLOSES.
 * `ExpressionMap.body()` has computed a BAP prescription on every frame since 5.4 landed, and
 * until this file there was no reader anywhere in the tree except a HUD string. Measured on the
 * shipped page: eight `?affect=` presets, and the torso band of five of the seven non-neutral
 * plates was BIT-IDENTICAL to neutral. The face emoted; the body did not exist. R5 asks for the
 * full range of human emotion as a FULL BODY avatar, so a prescription with no actuator is the
 * requirement half-built rather than a missing nice-to-have.
 *
 *
 * WHAT IT DRIVES, AND WHAT IT DELIBERATELY DOES NOT
 * ------------------------------------------------
 * `body()` returns nine numbers. Four of them are postures and this layer owns them; the rest
 * belong to layers that do not exist yet, and naming their owners here is how it stays visible
 * that they were considered rather than forgotten:
 *
 *   approach        ✅ trunk carried forward or back, hinged at the lumbar
 *   armSpread       ✅ shoulder abduction / adduction
 *   headTiltUp      ✅ head pitch
 *   kneeActivation  ⚠️ WIRED, AND ITS AMPLITUDE IS ZERO BECAUSE NO TABLE GIVES ONE. The mechanism
 *                      is complete — planted two-bone solve, pelvis drop, both ankles left where
 *                      they were — and the full scale is 0°. See THE KNEE, below.
 *   illustrative    ❌ a gesture RATE, not a pose. Punch-list 6.3, `motion/Gesture.js`.
 *   gestureAmplitude, temporalExtent   ❌ 6.4's two GRETA parameters.
 *   headAlignment, gazeAwayFraction*   ❌ gaze policy, `motion/Gaze.js`.
 *
 * ⚠️ AND ONE MORE THAT LOOKS LIKE AN OMISSION AND IS A BOUNDARY. `approach` is BAP's "forward
 * whole-body movement", and the whole-body reading of it — the centre of pressure travelling
 * toward the toes with the body rotating rigidly about the ankles — is `motion/Sway.js`'s
 * inverted pendulum, which already owns the pelvis, the legs, the feet and the footprint clamp
 * that keeps them standable. Building a second ankle pendulum here would be a duplicate model
 * that cannot see the first one's clamp, so what this layer realises is the part that is a JOINT
 * ROTATION rather than a balance problem: the trunk hinging at the lumbar, which Coulson codes
 * as its own degree of freedom and gives in degrees.
 *
 * 🎯 PUNCH-LIST 6.9 CLOSED THE OTHER HALF, AND IT IS A PUBLISHED NUMBER RATHER THAN A SECOND
 * PENDULUM. `centreOfPressureBiasMetres` below states, in centre-of-pressure metres, how far
 * forward or back of neutral this emotion wants to stand; `motion/Sway.js` reads it off
 * `MotionStack`'s shared bag and composes it into the SAME `displacement` its balance band and
 * Duarte's weight shifts already sum into, so the one ankle pendulum, the one footprint clamp and
 * the one toe-lift reading all see it. This layer therefore still writes no leg bone for
 * `approach`; what it added is a claim, in the unit `Sway` was rooted in.
 *
 * ⚠️ AND ITS FULL SCALE IS ZERO, for a reason with two independent halves — no source states an
 * emotional centre-of-pressure amplitude, AND the axis has no millimetres left to spend. See
 * `CENTRE_OF_PRESSURE_FULL_SCALE_METRES`.
 *
 *
 * WHERE THE ANGLES COME FROM — Coulson (2004), research `body-motion-numbers.md` §3
 * ---------------------------------------------------------------------------------
 * BAP (Dael/Mortillaro/Scherer) gives factor loadings, not degrees: it says WHICH channel moves
 * for which emotion and by what RELATIVE amount, and `BAP_PRESCRIPTIONS` already carries that.
 * What it cannot give is a full-scale angle. Coulson's Table 1 is the only published emotion →
 * joint-angle table in the record, it covers the same six emotions, and research §2 names it
 * explicitly as the thing to derive our mapping from: "no quantified PAD → body mapping exists…
 * We are building one. The two published sources to derive it from: Coulson's Table 4 betas…"
 *
 * The rule is one line and it is re-derived by the gate rather than trusted from this comment:
 * **each channel's full scale is the smallest non-zero magnitude Coulson lists in the column that
 * codes it.** Coulson's levels are the extremes of a 6-AFC stimulus set built to be maximally
 * discriminable between acted portrayals; the smallest level in a column is the least exaggerated
 * posture the study actually measured, and a settled idle is the least exaggerated case there is.
 * BAP's normalised loading then scales inside that, and the activation weight scales again.
 *
 * 🚩 THE SIGNS ARE MEASURED ON THE RIG, NOT TRANSCRIBED. research §3 carries three flagged
 * problems in the published paper — shoulder-swing signs inverted between Tables 1 and 4, mis-set
 * level lists, offset figure labels — and it ends with "verify sign conventions visually in our
 * rig before trusting either table." Coulson's own stated convention for the shoulder column
 * ("positive = arms toward trunk") contradicts his own verbal summary for happiness and sadness,
 * so there is no reading of that table that is self-consistent. This layer therefore takes
 * MAGNITUDE from Coulson and DIRECTION from BAP, and resolves left-versus-right by MEASURING
 * which side of the spine each arm is on at bind. A rig that mirrors, or a pose that crosses the
 * arms, gets the right answer without anyone editing a sign. The knee's hinge and the direction
 * its patella points are measured the same way, off the rest chain, for the same reason.
 *
 * ⚠️ ADDUCTION IS CLAMPED BY ANATOMY AND THE LIMIT IS MEASURED, NOT PICKED. On `figure_g050` in
 * `relaxed-standing` the upper arms already hang 10.18° (left) and 11.94° (right) from vertical,
 * so "arms drawn in" has about ten degrees of room before the arm is inside the ribcage. The limit
 * is each arm's own measured abduction at bind. The visible consequence, stated so it is not read
 * as a bug: anger and sadness both SATURATE it, so their arms are the same, and they separate on
 * the trunk instead.
 *
 *
 * 🎯 THE KNEE — 6.2(a). THE MECHANISM SHIPS; THE AMPLITUDE IS ZERO AND SAYS WHY
 * -----------------------------------------------------------------------------
 * `kneeActivation` was deferred three times with one stated reason — *"a knee bend that does not
 * also lower the pelvis is a figure on stilts; doing it right is 6.5's analytic two-bone solve
 * plus a pelvis offset plus a foot re-plant"* — and 6.5 landed. `motion/IKSolver.js` exports
 * exactly that, built as this item's deliverable: `planPlantedKneeBend()` takes a commanded
 * flexion per leg and returns a root translation plus two corrections per leg, with both ankles
 * left where they were. That reason is now closed and this layer drives it.
 *
 * 🚩 AND THE ITEM IS STILL NOT FINISHABLE, FOR A DIFFERENT REASON, WHICH IS WHY THE FULL SCALE IS
 * ZERO RATHER THAN A NUMBER.
 *
 * The rule above needs a Coulson column. **Coulson Table 1 has six columns and none of them is a
 * knee** — `COULSON_COLUMNS` is derived from the transcribed table below, so the gate re-runs that
 * claim rather than trusting this sentence, and `smallestListedMagnitude( 'kneeBend' )` THROWS.
 * `grep -in knee docs/research/body-motion-numbers.md` returns nothing; `docs/research/
 * ik-and-springbones.md` §2.5 records the same gap independently and files it as research, not
 * implementation. `BAP_PRESCRIPTIONS.fearful.kneeActivation` is 1.77/2.07 — a normalised factor
 * loading, a RELATIVE weight with no full scale to weight.
 *
 * So the honest thing is a channel that is wired, gated, and set to zero pending a number:
 *
 *   • every bone the bend needs is DECLARED, so the stack owns it and a conflict would be named
 *   • the chain, the hinge and the pole are MEASURED off the rest pose at bind
 *   • the solve, the pelvis drop and the re-plant run the instant an amplitude exists
 *   • `KNEE_FULL_SCALE_DEGREES` is 0, so on the shipped tree this contributes EXACTLY nothing —
 *     not "nearly nothing": the write is skipped above the epsilon test and measured at 0.000000
 *     mm of body displacement over 600 frames of live sway
 *
 * `kneeFullScaleDegrees` is the constructor option that supplies one anyway. It is not a tuning
 * knob, it is a declaration that the caller is supplying an UNSOURCED angle, and every gate that
 * uses it prints the angle it supplied. A made-up number in the most visible place on the figure
 * is the one thing worse than a channel that does not move.
 *
 * ⚠️ THE COMMAND IS AN ADDITION TO WHAT THE POSE ALREADY CARRIES, AND THAT IS NOT PEDANTRY.
 * `figure_g050` in `relaxed-standing` stands with 6.8176° of knee flexion already in it. Reading an
 * affect command as an ABSOLUTE joint angle makes a small fear bend STRAIGHTEN the leg and lift the
 * pelvis: at an unsourced 5° full scale the absolute reading takes the knee to 1.069° and RAISES the
 * pelvis 1.3841 mm, where adding to the pose takes it to 7.889° and lowers it 0.4806 mm. That is the
 * sign of the thing inverted on a channel whose whole content is "bend".
 * `PlannedLeg.restFlexionRadians` exists in the solver for exactly this, and
 * `kneeIgnoresRestFlexion` is the defect that proves it red.
 *
 * ⚠️ WHAT THE DROP COSTS WHERE IT MEETS `Sway`, MEASURED, BECAUSE `Sway` OWNS THE PELVIS.
 * Two different answers, and only the first is good news:
 *
 *   THE PELVIS COMPOSES EXACTLY. `MotionContribution.offsetBone` states a translation from rest
 *   and the stack SUMS offsets across layers (`Layer.js:261-263`), so this layer's drop and
 *   `Sway`'s pendulum travel add with no interaction. Measured over 600 frames of live sway: the
 *   pelvis sits the plan's full travel below where Sway alone put it — 2.340819 mm asked,
 *   2.340819 mm delivered, and 0.08 nm sideways. Nothing had to be taken away from `Sway`, and
 *   `Sway.js` was not edited.
 *
 *   THE FOOT PLANT DOES NOT. `Sway` also rotates both legs and pins both feet, using cumulative
 *   rotations of its own that cannot see this layer's knee correction — and `MOTION_ORDER` puts
 *   POSTURE (100) BEFORE SWAY (300), so `Sway`'s leg deltas post-multiply onto ours and act in a
 *   frame our correction has already turned. `IKSolver.js`'s header states the obligation the
 *   other way round: *"A layer must be the LAST writer of the bones it IKs… an IK layer therefore
 *   belongs at GESTURE (400) or later."* Measured over 600 frames on `figure_g050`, worst ankle
 *   displacement against the same run with the knee at the shipped scale:
 *
 *       the knee half AS SHIPPED (full scale 0°)                    0.000000 mm  bit-identical
 *       fear at an unsourced 20°, at POSTURE (100), where this is   0.1392 mm
 *       the same solve moved to GESTURE (400), after Sway           0.0646 mm    2.2× better
 *       the same bend with no Sway underneath it at all             0.000104 mm
 *
 *   The first row is the shipped tree, so this is a measured PRECONDITION on sourcing the angle
 *   rather than a defect in what runs today — and the last row says the residue is COMPOSITION and
 *   not arithmetic. Whoever lands the number has to move the knee half to a layer at or after
 *   GESTURE that re-reads the composed chain, or hand the commanded flexion to `Sway`, which
 *   already owns the legs, the feet and the footprint clamp. Filed as a request; `Sway.js` is not
 *   this file's to edit.
 *
 *
 * 🚩 REST FRAMES ARE READ FROM THE POSE THE DELTAS ARE MEASURED AGAINST, NOT FROM THE BONES
 * -----------------------------------------------------------------------------------------
 * `MotionStack` commits `bone.quaternion = restQuaternion × δ₁ × δ₂ × …`, where `restQuaternion`
 * was snapshotted at `bind()`. A delta that means "rotate by θ about rig +X" is therefore
 * `restFrame⁻¹ · R · restFrame` with `restFrame` composed from THAT snapshot — and
 * `Breath.restRotationRelativeToRig()` composes it from whatever is on the bones right now, which
 * is the same thing only until a frame has run.
 *
 * `onBind` runs again on `MotionStack.reset()` and on a re-add, by which point the bones hold the
 * pose this layer committed. Measured, with the live read: the rest frames drift **18.54°** and the
 * SAME anger lands **4.60 mm** away from where it landed the first time. The adduction-budget
 * check in the gate stayed green through all of it, because a budget is not a pose.
 *
 * So the frames here are composed from `stack.restRotationOf()` where a bone is declared, and from
 * the bone's own local transform where it is not — and that fallback is exactly right rather than
 * a compromise: an undeclared bone is one no layer writes, so its live local transform IS its rest.
 * It is also immune to the stale-world-matrix trap below, because it reads local transforms and
 * never a `matrixWorld`. `restFramesFromLivePose` is the defect that proves the difference.
 *
 *
 * WHY IT SITS AT MOTION_ORDER.POSTURE
 * -----------------------------------
 * "The pose everything else is a deviation from." Breath, sway, idle, gaze and gesture are all
 * deviations from the stance a person is holding, and an emotional stance is a stance. Running
 * first also means the head channel composes UNDER gaze rather than over it, so the eyes still
 * aim where the gaze layer asked from whatever attitude the posture put the head in. The knee is
 * the one channel that wants the opposite, and the measurement above is what that costs.
 */

import { Matrix4, Quaternion, Vector3 } from 'three';

import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from '../motion/Breath.js';
import {
    PlantedKneeBendPlan, TwoBoneSetup, flexionAtChainLength, planPlantedKneeBend, toBoneOffsetFrame
} from '../motion/IKSolver.js';
import { Layer } from '../motion/Layer.js';
import { MOTION_ORDER } from '../motion/MotionStack.js';
import { AffectState } from './AffectState.js';
import { ExpressionMap } from './ExpressionMap.js';

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Rig-space anatomical axes, the same three `motion/Sway.js` verified on figure_g050: +X is the
 * character's left-right axis, +Y is up, +Z is forward. A sagittal (forward/back) rotation is
 * therefore about +X and a frontal (arm out to the side) rotation is about +Z.
 *
 * The SENSE of each is derived once, here, rather than left to a reader to re-derive:
 *   +θ about +X carries +Y toward +Z, so a positive sagittal angle tips the top FORWARD.
 *   +θ about +Z carries −Y toward +X, so a positive frontal angle swings a hanging limb toward +X.
 * Both are asserted by measurement in `affect.selftest.mjs`, because a comment cannot fail.
 *
 * `RIG_DOWN_AXIS` is the direction the pelvis travels when the knees bend, and it is a UNIT
 * TRANSLATION rather than a rotation axis — `planPlantedKneeBend` intersects it with the sphere
 * each planted ankle allows. Down is −Y for the same measured reason up is +Y.
 */
const RIG_SAGITTAL_AXIS = new Vector3( 1, 0, 0 );
const RIG_FRONTAL_AXIS = new Vector3( 0, 0, 1 );
const RIG_DOWN_AXIS = new Vector3( 0, -1, 0 );

/** Rig +Z, kept apart from `RIG_FRONTAL_AXIS` because one is a direction and one is an axis. */
const RIG_FORWARD_DIRECTION = new Vector3( 0, 0, 1 );

/**
 * Coulson (2004) Table 1, transcribed from `docs/research/body-motion-numbers.md` §3. Degrees, and
 * one array per cell because the paper states the LEVELS a degree of freedom was sampled at rather
 * than a single value.
 *
 * ⚠️ Transcribed for the MAGNITUDES. See the header on why the signs are not used.
 */
export const COULSON_TABLE_1 = Object.freeze( {
    //            abdomen twist  chest bend   head bend        shoulder ad/ab  swing          elbow
    anger:     coulsonRow( [ 0 ], [ 20, 40 ], [ -20, 25 ], [ -60, -80 ], [ 45, 90 ], [ 50, 110 ] ),
    disgust:   coulsonRow( [ -25, -50 ], [ -20, 0 ], [ -20 ], [ -60, -80 ], [ -25, 45 ], [ 0, 50 ] ),
    fear:      coulsonRow( [ 0 ], [ 20, 40 ], [ 25, 50, -20 ], [ -60 ], [ 45, 90 ], [ 50, 110 ] ),
    happiness: coulsonRow( [ 0 ], [ 0, -20 ], [ 0, -20 ], [ 50 ], [ 0, 45 ], [ 0, 50 ] ),
    sadness:   coulsonRow( [ 0, -25 ], [ 0, 20 ], [ 25, 50 ], [ -60, -80 ], [ 0 ], [ 0 ] ),
    surprise:  coulsonRow( [ 0 ], [ -20 ], [ 25, 50 ], [ 50 ], [ -25, 0, 45 ], [ 0, 50 ] )
} );

/**
 * 🚩 COULSON'S SEVENTH COLUMN, AND IT IS DELIBERATELY NOT IN THE TABLE ABOVE.
 *
 * Coulson measured 7 degrees of freedom — "weight transfer + 6 joint rotations"
 * (`body-motion-numbers.md` §3) — and the seventh is the one punch-list 6.9 is about. It is kept
 * out of `COULSON_TABLE_1` because that table is transcribed for MAGNITUDES, `coulsonRow` takes six
 * numeric arrays, and `smallestListedMagnitude` reduces a column by `Math.abs`. This column has no
 * numbers in it at all:
 *
 *     Anger  Forwards   ·   Disgust  Backwards   ·   Fear  Backwards, Neutral
 *     Happiness  Forwards, Neutral   ·   Sadness  Backwards, Neutral   ·   Surprise  Backwards
 *
 * Three NOMINAL levels where every other column is degrees. Putting a label into a magnitude table
 * would break the derivation rule the knee's own zero is proved by, so it lives here and is used
 * for exactly one thing: CROSS-CHECKING THE SIGN that BAP supplies. It can never supply a scale.
 *
 * ⚠️ AND COULSON'S OWN PROSE CONTRADICTS HIS OWN TABLE, ON EXACTLY THE TWO ROWS 6.9 NAMES. The
 * verbal summary in the same section reads anger as "weight forward **or backward**" and fear as
 * "weight backward **or forward**" — ambiguous precisely where the table is not, and unusable as a
 * direction for either. So the direction here comes from BAP as everywhere else in this file, and
 * this column is the corroborating read rather than the source. §3 of the research doc already
 * carries four other places that paper contradicts itself; this is the fifth.
 */
export const COULSON_WEIGHT_COLUMN = Object.freeze( {
    anger: Object.freeze( [ 'Forwards' ] ),
    disgust: Object.freeze( [ 'Backwards' ] ),
    fear: Object.freeze( [ 'Backwards', 'Neutral' ] ),
    happiness: Object.freeze( [ 'Forwards', 'Neutral' ] ),
    sadness: Object.freeze( [ 'Backwards', 'Neutral' ] ),
    surprise: Object.freeze( [ 'Backwards' ] )
} );

/**
 * 🚩 EVERY DEGREE OF FREEDOM COULSON MEASURED, READ OFF THE TABLE RATHER THAN COUNTED BY HAND.
 *
 * This exists so that "there is no knee column" is a statement the gate re-derives from the data
 * in this file, in this process, instead of a claim in a comment that a later edit could falsify
 * silently. Six columns: abdomen twist, chest bend, head bend, shoulder ad/abduction, shoulder
 * swing, elbow bend. None of them is a knee, and that is the whole reason `kneeActivation` ships
 * with a full scale of zero.
 */
export const COULSON_COLUMNS = Object.freeze( Object.keys( COULSON_TABLE_1.anger ) );

/**
 * Which Coulson column codes which BAP channel. One line, so the mapping is a statement rather
 * than something spread across the file.
 *
 *   approach   -> chest bend. The trunk carried forward or back of neutral.
 *   armSpread  -> shoulder ad/abduction. The arm's angle away from the trunk.
 *   headTiltUp -> head bend. The head's pitch.
 *
 * ⚠️ `kneeActivation` is deliberately ABSENT rather than mapped to something adjacent. There is no
 * defensible column for it and the nearest ones code the trunk, so a mapping here would be an
 * invention wearing the derivation's clothes.
 */
export const CHANNEL_TO_COULSON_COLUMN = Object.freeze( {
    approach: 'chestBend',
    armSpread: 'shoulderAdAbduct',
    headTiltUp: 'headBend'
} );

/**
 * 🚩 THE UNSOURCED AMPLITUDE, WRITTEN AS ZERO AND NAMED AS A GAP.
 *
 * Not "a small value to be safe" and not "disabled": zero is the only number that is honest here.
 * The derivation rule this file is gated on needs a Coulson column and there is none (see
 * `COULSON_COLUMNS`), BAP gives a loading rather than a scale, and no other source in this
 * repository's record states a knee angle for an emotion. Every other route considered and
 * rejected, so nobody re-walks them:
 *
 *   • Wallbott (1998) — three movement-QUALITY scales rated 1–3 (`body-motion-numbers.md` §4). A
 *     gain on amplitude, and no amplitude to gain.
 *   • the visibility band in `IKSolver.js` — 1.57° to 17.2° of added flexion is where a MISSING
 *     PELVIS DROP starts to show. That is a threshold on this file's own error, not a statement
 *     about how far a frightened person bends their knees, and using it would be circular.
 *   • Coulson's stimulus set itself — six degrees of freedom, legs straight in all of them.
 *
 * The consequence, stated plainly: on the shipped tree `fear` prescribes its LARGEST loading into
 * a channel that moves nothing. That is visible in `describe()` and in the gate, and it stays
 * visible until somebody sources an angle.
 */
export const KNEE_FULL_SCALE_DEGREES = 0;

/**
 * 🚩 Defect fodder: the number somebody reaches for when the table has no column — "use the same
 * 20° the trunk got". It is the shape of the mistake this file exists to refuse, so it is named
 * and gated rather than left as a thing a future edit might do quietly. See POSTURE_DEFECTS.
 */
const INVENTED_KNEE_FULL_SCALE_DEGREES = 20;

/**
 * 🚩 PUNCH-LIST 6.9'S AMPLITUDE, WRITTEN AS ZERO AND NAMED AS A GAP — THE SECOND CONSTANT IN THIS
 * FILE TO SHIP AT ZERO, AND THE FIRST ONE TO HAVE **TWO** INDEPENDENT REASONS.
 *
 * How far, in metres of centre of pressure, a fully-committed emotion at `approach = ±1` wants to
 * stand forward of or behind neutral. `motion/Sway.js` composes it into the same `displacement` its
 * balance band and Duarte's weight shifts sum into. Positive is FORWARD, toward the toes — and
 * "forward is +Z" is not asserted here, it is MEASURED off this rig's own toe joints by the gate
 * (paid-for failure #4: an axis convention derived for a trunk that extends UP, applied to
 * something that does not).
 *
 * REASON 1 — THE AXIS IS ALREADY OVER-BUDGET, AND THIS ONE IS A MEASUREMENT RATHER THAN A READING
 * OF THE LITERATURE. Measured this session on the SHIPPED tree, with no 6.9 in it at all:
 * `ExpressionLayer + PostureLayer + Sway`, 900 s × 12 seeds (`SWAY_SEEDS`), whole-body centre of mass against each
 * bake's own footprint read off its own mesh, ankle midpoint as origin:
 *
 *     bake   rear edge raw / skinned    fear's deepest rear CoM    margin raw / skinned
 *     g000      -44.60 / -49.00 mm            -50.958 mm           -6.357 / -1.963   OUTSIDE BOTH
 *     g025      -49.34 / -53.15 mm            -50.153 mm           -0.818 / +2.996   OUTSIDE RAW
 *     g050      -54.43 / -57.92 mm            -49.147 mm           +5.284 / +8.769
 *     g075      -59.83 / -63.54 mm            -48.141 mm          +11.685 / +15.397
 *     g100      -65.37 / -69.58 mm            -46.896 mm          +18.476 / +22.687
 *
 * Neutral is inside on every bake (worst +3.037 mm, g000). It is fear's chest bend — −9.393 mm of
 * centre of mass, measured — landing on top of `Sway`'s deepest rearward drift, both individually
 * inside budget and summing outside. **There is no millimetre on this axis to spend**, and adding
 * one to the rear would deepen an excursion that is already out of the base of support. That is a
 * precondition on sourcing an amplitude, not an argument about which source to use.
 *
 * ⚠️ AND THE MARGIN IS A FUNCTION OF THE SAMPLING WINDOW, because Duarte's antero-posterior drift
 * lattice turns over every 319 s and the deepest excursion on g000 is at t = 373.4 s. Same twelve
 * seeds, same bake, same preset, skinned margin — every figure below is PRINTED BY THE GATE as a
 * prefix of the trace the red clause reads, rather than quoted here:
 *
 *     60 s  +4.584 mm      120 s  +4.197 mm      300 s  +4.197 mm      900 s  -1.963 mm
 *
 * A short window buys 6.547 mm of headroom that is not there, which flips the sign of the verdict.
 * Any margin quoted without a window length is meaningless, and note that 120 s and 300 s AGREE —
 * which is the stability that makes a short window feel converged when it is not.
 *
 * 🚩 THIS ROW READ +19.166 mm UNTIL R29 AND NO CLAUSE COMPUTED IT. It was prose here, in
 * `docs/RED-GATES.md` and in `docs/LEARNINGS.md`, and it was REASON 1's headline evidence for the
 * zero below. Two adversarial re-measurements and then the gate all read +4.584. The conclusion
 * held and its evidence did not, which is the more dangerous of the two failures.
 *
 * REASON 2 — NO SOURCE IN THIS REPOSITORY'S RECORD STATES A MAGNITUDE. Every candidate that IS in
 * the record is the wrong construct, and each one is cited to the document that carries it:
 *
 *   • Coulson's weight column — CATEGORICAL. Three nominal levels, no unit, `body-motion-numbers.md`
 *     §3. See `COULSON_WEIGHT_COLUMN`, which exists to make that a fact in the file, not a claim.
 *   • BAP's loadings (+1.96 anger, −1.46 fear, `ExpressionMap.BAP_PRESCRIPTIONS`) — a normalised
 *     factor loading. This file's header already names that correctly: a RELATIVE weight with no
 *     full scale to weight.
 *   • Duarte & Zatsiorsky's 17 ± 15 mm antero-posterior shift (`body-motion-numbers.md` §7) — a
 *     VOLUNTARY change of stance over thirty minutes of unconstrained standing, with no emotion in
 *     the protocol. And already spent: it IS the clamp `Sway.resolvePostureLimits` derives.
 *   • Quijoux's 4.9 mm antero-posterior RMS (§7, force-plate column) — the quiet-stance balance
 *     BAND, which `Sway` already authors, and an elderly cohort at that. Not an offset.
 *
 * ⚠️ 🚩 AND THE RECORD'S OWN GAP NOTE APPLIES HERE VERBATIM. §7 ends: *"No young-adult COP RMS in
 * millimetres was found to substitute. Nothing here is an estimate of one, and none should be
 * invented."* That is written about the balance band. The emotional OFFSET is a strictly smaller
 * literature than the band, and this repository holds no document that states one at all.
 *
 * ⚠️ THREE OFF-RECORD CANDIDATES WERE NOMINATED BY THE DESIGN PASS AND ARE NOT CITED HERE, because
 * `grep -rn 'Lemay\|Lebert\|Sloot' docs/` returns nothing — no document in this repository carries
 * them, so their numbers cannot be checked by anyone reading this file, and transcribing a figure
 * from another agent's summary is the one thing this project's evidence rule forbids outright.
 * They are named without numbers so the next agent can go and read them rather than rediscover
 * them: a maximal-voluntary-lean study, a normalised functional base-of-support study, and an
 * observer-response study whose anger is reported BACKWARD. If any of them is brought in, it lands
 * in `docs/research/` first and this constant is derived from the document, not from this comment.
 *
 * So the honest shape is DIRECTION FROM BAP, MAGNITUDE ABSENT — which is not this file's usual
 * "magnitude from Coulson, direction from BAP" rule but its exact inverse with the magnitude half
 * missing. The consequence, stated plainly: on the shipped tree `affectCentreOfPressureBias` reads
 * EXACTLY 0.000000 on every preset, and 6.9 ships a wired, gated, reachable mechanism at zero — the
 * `KNEE_FULL_SCALE_DEGREES` pattern, which this repository has already paid for and documented.
 *
 * `centreOfPressureFullScaleMetres` is the constructor option that supplies one anyway. It is not a
 * tuning knob; it is a declaration that the caller is supplying an UNSOURCED amplitude, and every
 * gate that uses it prints the value it supplied.
 *
 * ⚠️ NOT IN `POSTURE_FULL_SCALE_DEGREES`, and that is a unit statement rather than an oversight.
 * Everything in that object is a joint angle in degrees derived by `smallestListedMagnitude`. This
 * is a length, on the floor, in metres, derived by nothing. Putting it in that table would make the
 * table's own gate — "every full scale is re-derived from Coulson Table 1 by the stated rule" — a
 * lie about one of its rows.
 */
export const CENTRE_OF_PRESSURE_FULL_SCALE_METRES = 0;

/**
 * 🚩 Defect fodder, and the mistake here is a subtler one than the knee's. Nobody reaching for an
 * emotional centre-of-pressure amplitude invents a number from nothing — they reach for the one
 * antero-posterior displacement in metres that IS in this codebase, Duarte & Zatsiorsky's 17 mm
 * mean weight shift, and it is a VOLUNTARY shift of stance measured over thirty minutes of
 * unconstrained standing with no emotion in the protocol at all. It is also already spent: it is
 * the quantity `Sway`'s own antero-posterior clamp is anchored on. See POSTURE_DEFECTS.
 */
const INVENTED_CENTRE_OF_PRESSURE_FULL_SCALE_METRES = 0.017;

/** The derived full scales. See the header for the rule; `smallestListedMagnitude` IS the rule. */
export const POSTURE_FULL_SCALE_DEGREES = Object.freeze( {

    ...Object.fromEntries( Object.entries( CHANNEL_TO_COULSON_COLUMN )
        .map( ( [ channel, column ] ) => [ channel, smallestListedMagnitude( column ) ] ) ),

    // Not derived, because the rule cannot reach it. Carried here anyway so that the set of
    // channels this layer ACTUATES is one object rather than three plus a special case.
    kneeActivation: KNEE_FULL_SCALE_DEGREES

} );

/** Below this an angle is not worth a quaternion, and the layer stays out of the conflict report. */
const POSTURE_EPSILON_RADIANS = 1e-6;

/**
 * The two legs, as the three joints a two-bone solve needs. The ankle is READ and never written —
 * it is the chain's end point and the thing the plan holds still — so it is deliberately not in
 * `bones` and therefore not a declared channel. Same shape as the arm code's elbow read.
 */
const KNEE_LEGS = Object.freeze( [
    Object.freeze( { key: 'left', hip: 'leftUpperLeg', knee: 'leftLowerLeg', ankle: 'leftFoot' } ),
    Object.freeze( { key: 'right', hip: 'rightUpperLeg', knee: 'rightLowerLeg', ankle: 'rightFoot' } )
] );

export class PostureLayer extends Layer {

    /**
     * @param {Object} [options]
     * @param {AffectState} [options.state] - The SAME state `ExpressionLayer` holds. Bring your
     *   own; `ExpressionLayer.postureLayer()` is the paired constructor that cannot mismatch them.
     * @param {ExpressionMap} [options.map] - Likewise.
     * @param {number} [options.amplitude=1] - One art-direction multiplier over every channel. The
     *   per-channel degrees stay readable as the statement of intent they are.
     * @param {number} [options.kneeFullScaleDegrees=KNEE_FULL_SCALE_DEGREES] - ⚠️ AN UNSOURCED
     *   ANGLE. The shipped value is 0 and it is 0 because no published table in this repository's
     *   record states a knee angle for an emotion — see `KNEE_FULL_SCALE_DEGREES`. Passing a number
     *   here is supplying one anyway, and whoever passes it owns it: say where it came from at the
     *   call site, because this file cannot.
     * @param {number} [options.centreOfPressureFullScaleMetres=CENTRE_OF_PRESSURE_FULL_SCALE_METRES]
     *   - ⚠️ AN UNSOURCED CENTRE-OF-PRESSURE AMPLITUDE, and the same declaration as the knee's.
     *   The shipped value is 0 for two independent measured reasons; see
     *   `CENTRE_OF_PRESSURE_FULL_SCALE_METRES`. Metres, positive FORWARD.
     * @param {Object} [options.bones] - Overrides for the humanoid names this drives.
     * @param {Object} [options.defects] - 🚩 Gate fodder only. See POSTURE_DEFECTS.
     */
    constructor( options = {} ) {

        const bones = {
            spine: HUMANOID_TO_FIGURE_BONE.spine,
            head: HUMANOID_TO_FIGURE_BONE.head,
            leftUpperArm: HUMANOID_TO_FIGURE_BONE.leftUpperArm,
            rightUpperArm: HUMANOID_TO_FIGURE_BONE.rightUpperArm,

            // The knee half. Declared even at a full scale of zero: declaration is how the stack
            // takes ownership and how it would name a conflict with `Sway`, and a channel that
            // appears only once an amplitude is supplied is a channel nobody has ever tested.
            hips: HUMANOID_TO_FIGURE_BONE.hips,
            leftUpperLeg: HUMANOID_TO_FIGURE_BONE.leftUpperLeg,
            leftLowerLeg: HUMANOID_TO_FIGURE_BONE.leftLowerLeg,
            rightUpperLeg: HUMANOID_TO_FIGURE_BONE.rightUpperLeg,
            rightLowerLeg: HUMANOID_TO_FIGURE_BONE.rightLowerLeg,

            ...( options.bones ?? {} )
        };

        super( {
            name: options.name ?? 'affectPosture',
            order: options.order ?? MOTION_ORDER.POSTURE,
            boneChannels: Object.values( bones ),
            enabled: options.enabled ?? true,
            weight: options.weight ?? 1
        } );

        this.bones = bones;
        this.amplitude = options.amplitude ?? 1;

        this.state = options.state ?? new AffectState();
        this.map = options.map ?? new ExpressionMap();

        this.defects = { ...POSTURE_DEFECTS_OFF, ...( options.defects ?? {} ) };

        // Read out of `POSTURE_FULL_SCALE_DEGREES` rather than off `KNEE_FULL_SCALE_DEGREES`
        // directly, so that one object is the whole statement of what every actuated channel is
        // scaled by and `update()` has no channel that gets its scale from somewhere else.
        this.kneeFullScaleDegrees = this.defects.inventedKneeFullScale === true
            ? INVENTED_KNEE_FULL_SCALE_DEGREES
            : options.kneeFullScaleDegrees ?? POSTURE_FULL_SCALE_DEGREES.kneeActivation;

        // Punch-list 6.9's amplitude, and 0 on the shipped tree for two measured reasons. Read
        // straight off the constant rather than out of `POSTURE_FULL_SCALE_DEGREES`, because it is
        // metres of floor rather than degrees of joint — see the constant.
        this.centreOfPressureFullScaleMetres = this.defects.inventedCentreOfPressureFullScale === true
            ? INVENTED_CENTRE_OF_PRESSURE_FULL_SCALE_METRES
            : options.centreOfPressureFullScaleMetres ?? CENTRE_OF_PRESSURE_FULL_SCALE_METRES;

        /**
         * ⚠️ This layer never advances the affect state. `ExpressionLayer` does, and two clocks over
         * one state doubles its rate — the defect that layer's own header warns about. It also
         * recomputes `activate()` rather than reading the other layer's cached result, because the
         * two layers sit at opposite ends of MOTION_ORDER and reading across would hand this one
         * last frame's emotion. Eight anchors and a distance is cheaper than a frame of lag.
         */
        this.prescription = null;
        this.activations = [];

        /**
         * Last frame's angles in degrees, for a HUD and for the gates. `armSpread` is what the
         * prescription ASKED for and the two per-side numbers are what anatomy allowed, kept apart
         * so a reader can see the adduction clamp bite instead of wondering why the arms stopped.
         * The knee reports the same way: what was ADDED, what each leg realised, and how far the
         * pelvis had to come down to keep both feet on the floor.
         *
         * ⚠️ `kneeLeft`/`kneeRight` are ABSOLUTE joint angles when the layer wrote a bend, and 0 when
         * it wrote nothing — 0 means "this layer contributed no knee", not "the leg is straight".
         * The rig stands at 6.8176° with nothing written at all, which is exactly the confusion
         * `kneeIgnoresRestFlexion` is built out of.
         */
        this.appliedDegrees = { ...NOTHING_APPLIED };

        /**
         * 🎯 PUNCH-LIST 6.9 — WHAT THIS LAYER PUBLISHES TO THE BALANCE MODEL, IN METRES OF CENTRE
         * OF PRESSURE, POSITIVE FORWARD.
         *
         * It is deliberately NOT in `appliedDegrees`: that object is degrees of joint and this is
         * metres of floor, and 6.9's own second red proof is somebody sourcing the balance command
         * from `appliedDegrees.approach` — a Coulson CHEST-BEND column standing in for a
         * centre-of-pressure amplitude, at a silent one-millimetre-per-degree. Keeping the two
         * quantities in different objects is what makes that read look as wrong as it is.
         *
         * `motion/Sway.js`'s `affectCentreOfPressureBiasOf( context )` reads this off
         * `MotionStack.context.shared.posture` every frame. There is no setter anywhere in the
         * chain: this is recomputed from `this.state.pad` on every `update()` and never stored by
         * the consumer, so a gate cannot drive the mechanism through a path the product bypasses.
         */
        this.centreOfPressureBiasMetres = 0;

        /**
         * 🚩 THE STALENESS STAMP, AND IT CLOSES A HOLE `enabled` CANNOT.
         *
         * A layer `MotionStack` skipped this frame keeps last frame's numbers for ever — `update()`
         * simply did not run. Measured on `figure_g050`, anger, with `posture.enabled = false` set
         * at frame 60: `prescription.approach` still reads 0.946860 and `appliedDegrees.approach`
         * still reads 14.2029° sixty frames later, BOTH STALE. A consumer that reads either one
         * without asking WHEN it was written is reading a disabled layer's opinion.
         *
         * So the frame this was computed on is published beside it, and `Sway` refuses any value
         * that is not this frame's. That also catches the case `enabled` misses entirely: a
         * `PostureLayer` published to `shared` and never added to the stack at all.
         */
        this.centreOfPressureFrame = -1;

        /** Filled in by `onBind`. Rest frames, plus the things that must be measured per rig. */
        this.restFrames = new Map();
        this.armSides = { leftUpperArm: 1, rightUpperArm: -1 };
        this.maxAdductionRadians = { leftUpperArm: 0, rightUpperArm: 0 };

        /**
         * The two leg chains as they stand in the REST pose, in the order of `KNEE_LEGS`, plus the
         * flexion each one already carries. Empty when this figure has no legs, or when its rest
         * pose is too straight to read a hinge off — see `bindKneeChains`.
         *
         * @type {Array<{ setup: TwoBoneSetup, flexionRadians: number, restFlexionRadians: number }>}
         */
        this.kneeLegs = [];
        this.kneeRequest = { legs: this.kneeLegs, travelAxis: RIG_DOWN_AXIS };
        this.kneePlan = new PlantedKneeBendPlan();

        /**
         * How well determined the knee hinge was, as `|sin(flexion)|` of the rest pose. 0 means the
         * rest pose is straight, the axis is numerical noise, and the knee half refuses to run.
         * Measured 0.1187 on `figure_g050` in `relaxed-standing` — the sine of its 6.8176°.
         */
        this.kneeHingeDetermination = 0;

        /** How far the measured knee pole sits off rig-forward, degrees. Reported, never assumed. */
        this.kneePoleOffForwardDegrees = 0;

        /**
         * `|t̂ × p̂|` for the worst leg: 1 is a pole square to the hip→ankle axis, 0 is the
         * singularity where the chain plane has no normal and the knee's direction is set by
         * whatever noise the rest pose carries. ozz defaults the pole to +Y and a standing leg's
         * axis IS −Y, which is why this is measured and gated rather than assumed.
         */
        this.kneePoleConditioning = 0;

        /** The pelvis's parent frame, for `toBoneOffsetFrame`. On this rig `Root`, −90° about X. */
        this.pelvisParentRestFrame = new Quaternion();

        /**
         * What this layer put on each arm last frame, signed, positive for abduction. Read by
         * `onBind` and by nothing else — see the note there on why re-binding needs it.
         */
        this.appliedArmRadians = { leftUpperArm: 0, rightUpperArm: 0 };

        this.scratchRigRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();
        this.scratchShoulder = new Vector3();
        this.scratchElbow = new Vector3();
        this.scratchSpine = new Vector3();
        this.scratchPelvisOffset = new Vector3();

    }

    /**
     * Resolves rest frames, and measures the rig facts the model refuses to assume: which side of
     * the spine each arm is on, how much adduction that arm has before it is inside the ribcage,
     * and — for each leg — the two-bone chain, the hinge the knee turns about and the direction its
     * patella points.
     */
    onBind( context ) {

        const stack = context.stack;
        const target = stack.target;

        this.restFrames.clear();

        for ( const boneName of Object.values( this.bones ) ) {

            const bone = target.getBone( boneName );
            if ( isMissing( bone ) === true ) continue;

            this.restFrames.set( boneName, this.measureRestFrame( bone, stack ) );

        }

        this.bindArmBudget( target );
        this.bindKneeChains( target, stack );

    }

    /**
     * The arm's adduction budget: which way is "away from the midline", and how far each humerus
     * can travel toward the trunk before it is where the ribs are.
     */
    bindArmBudget( target ) {

        const spine = target.getBone( this.bones.spine );
        if ( isMissing( spine ) === true ) return;

        // 🚩 REFRESH BEFORE READING, and this line is a bug fix rather than defensiveness. `onBind`
        // runs when the layer joins the stack, which is normally the instant after a rest pose was
        // written into the bones' LOCAL quaternions — and nothing has recomputed a world matrix
        // since. Reading `matrixWorld` there measures the BIND pose, not the posed one. On this
        // figure the bind pose is an A-pose: measured, the adduction budget came out at 30°+
        // instead of the 10.18°/11.94° the relaxed stance actually has, so the clamp silently did
        // not bite and anger swung its arms 30° into the ribcage.
        spine.updateWorldMatrix( true, false );
        this.scratchSpine.setFromMatrixPosition( spine.matrixWorld );

        for ( const humanoid of [ 'leftUpperArm', 'rightUpperArm' ] ) {

            const shoulder = target.getBone( this.bones[ humanoid ] );
            const elbow = target.getBone( HUMANOID_TO_FIGURE_BONE[
                humanoid === 'leftUpperArm' ? 'leftLowerArm' : 'rightLowerArm' ] );

            if ( isMissing( shoulder ) === true || isMissing( elbow ) === true ) continue;

            elbow.updateWorldMatrix( true, false );
            this.scratchShoulder.setFromMatrixPosition( shoulder.matrixWorld );
            this.scratchElbow.setFromMatrixPosition( elbow.matrixWorld );

            // Which way is "away from the midline" for this arm, and therefore which sign of a
            // frontal rotation abducts it. Measured, because a mirrored rig flips it.
            const side = Math.sign( this.scratchShoulder.x - this.scratchSpine.x ) || 1;
            this.armSides[ humanoid ] = side;

            // How far the arm already hangs from vertical, in its own frontal plane. That angle IS
            // the adduction budget: swinging it back to vertical is the most a shoulder can draw in
            // before the humerus is where the ribs are.
            const lateral = ( this.scratchElbow.x - this.scratchShoulder.x ) * side;
            const downward = this.scratchShoulder.y - this.scratchElbow.y;

            // 🚩 MINUS WHAT THIS LAYER ITSELF PUT THERE. `onBind` runs again on `MotionStack.reset()`
            // and on a rebind, and by then the arm is carrying the pose this layer committed on the
            // last frame — so a settled anger, whose arms are held AT vertical, would re-measure its
            // own budget as zero and never adduct again. Subtracting the layer's own last
            // contribution makes the measurement idempotent, which is what `Layer.onBind`'s contract
            // asks for. ⚠️ It does not subtract anyone ELSE's: an idle layer's degree or two of arm
            // noise is inside this measurement, and on the first bind — before any frame has run —
            // there is none of either.
            this.maxAdductionRadians[ humanoid ] = Math.max( 0,
                Math.atan2( lateral, downward ) - this.appliedArmRadians[ humanoid ] );

        }

    }

    /**
     * 🎯 The knee half's whole bind: both leg chains, read out of the REST pose rather than off the
     * bones, with the hinge and the pole MEASURED from the bend the rest pose is already in.
     *
     * Reading rest rather than live is what makes this idempotent — `onBind` runs again after
     * frames have committed, and a chain read off a figure already holding a knee bend would plan
     * the next bend from the wrong place. It is also what makes it immune to the stale-world-matrix
     * trap the arm budget has to defend against by hand: nothing here touches a `matrixWorld`.
     *
     * ⚠️ TWO WAYS THIS LEGITIMATELY REFUSES, both of which leave the knee channel dead rather than
     * wrong. A figure with no legs — the rig variants are not all complete — and a rig authored
     * with the legs dead straight, where `readMidAxisFromPose` returns a determination of 0 and the
     * hinge it just wrote is numerical noise. `IKSolver.js` says to check that number rather than
     * assume it, so it is checked and reported.
     */
    bindKneeChains( target, stack ) {

        this.kneeLegs.length = 0;
        this.kneeHingeDetermination = 0;
        this.kneePoleOffForwardDegrees = 0;
        this.kneePoleConditioning = 0;

        const pelvis = target.getBone( this.bones.hips );
        if ( isMissing( pelvis ) === true || isMissing( pelvis.parent ) === true ) return;

        restRotationInRigSpace( pelvis.parent, stack, this.pelvisParentRestFrame );

        let worstDetermination = Infinity;
        let worstPoleOffForward = 0;
        let worstPoleConditioning = Infinity;

        for ( const leg of KNEE_LEGS ) {

            const hip = target.getBone( this.bones[ leg.hip ] );
            const knee = target.getBone( this.bones[ leg.knee ] );
            const ankle = target.getBone( HUMANOID_TO_FIGURE_BONE[ leg.ankle ] );

            if ( isMissing( hip ) === true || isMissing( knee ) === true || isMissing( ankle ) === true ) {

                this.kneeLegs.length = 0;
                return;

            }

            const chain = this.readLegMatrices( hip, knee, ankle, stack );
            const setup = new TwoBoneSetup().readChain( chain.hip, chain.knee, chain.ankle );

            worstDetermination = Math.min( worstDetermination, setup.readMidAxisFromPose() );

            // 🚩 `ozzDefaultKneePole` keeps ozz's own default instead of measuring, which is the
            // fifth degenerate case in `IKSolver.js`'s header rather than a taste difference.
            if ( this.defects.ozzDefaultKneePole === true ) {

                setup.poleVector.set( 0, 1, 0 );
                worstPoleOffForward = Math.max( worstPoleOffForward,
                    setup.poleVector.angleTo( RIG_FORWARD_DIRECTION ) / DEGREES_TO_RADIANS );

            } else {

                worstPoleOffForward = Math.max( worstPoleOffForward, measureKneePole( setup ) );

            }

            worstPoleConditioning = Math.min( worstPoleConditioning, measurePoleConditioning( setup ) );

            const upperLength = setup.startPosition.distanceTo( setup.midPosition );
            const lowerLength = setup.midPosition.distanceTo( setup.endPosition );
            const restDistance = setup.startPosition.distanceTo( setup.endPosition );

            this.kneeLegs.push( {
                setup,
                flexionRadians: 0,
                restFlexionRadians: flexionAtChainLength( upperLength, lowerLength, restDistance )
            } );

        }

        this.kneeHingeDetermination = worstDetermination === Infinity ? 0 : worstDetermination;
        this.kneePoleOffForwardDegrees = worstPoleOffForward;
        this.kneePoleConditioning = worstPoleConditioning === Infinity ? 0 : worstPoleConditioning;

        // A rest pose with no measurable bend has no hinge to turn about, and a hinge read from
        // noise rotates the whole chain plane, which snaps the knee sideways. Refuse, visibly.
        if ( this.kneeHingeDetermination <= 0 ) this.kneeLegs.length = 0;

    }

    /**
     * The three matrices one leg's chain is read from.
     *
     * 🚩 `kneeChainFromLivePose` is the other way to write this and it is wrong twice over: after a
     * frame has committed, `matrixWorld` holds this layer's OWN knee bend, so a re-bind plans the
     * next bend from a figure already bent; and before any world matrix has been recomputed — which
     * is how `alive.js` binds — it holds the GLB's bind pose rather than the rest pose that was just
     * written into the local quaternions. The rest read has neither problem because it composes
     * local transforms out of the stack's snapshot and never reads a world matrix at all.
     */
    readLegMatrices( hip, knee, ankle, stack ) {

        if ( this.defects.kneeChainFromLivePose === true ) {

            for ( const bone of [ hip, knee, ankle ] ) bone.updateWorldMatrix( true, false );

            return { hip: hip.matrixWorld, knee: knee.matrixWorld, ankle: ankle.matrixWorld };

        }

        return {
            hip: restWorldMatrixOf( hip, stack, scratchHipMatrix ),
            knee: restWorldMatrixOf( knee, stack, scratchKneeMatrix ),
            ankle: restWorldMatrixOf( ankle, stack, scratchAnkleMatrix )
        };

    }

    reset() {

        this.prescription = null;
        this.activations = [];
        this.appliedDegrees = { ...NOTHING_APPLIED };

        // 6.9's published claim goes back to "no claim", and its stamp goes back to a frame number
        // `MotionStack` never issues — `frame` starts at 0 and is incremented BEFORE the layers run,
        // so the first frame is 1. -1 rather than 0 so that a consumer reading a reset layer on
        // frame 0 (which is only reachable before any update) still sees a mismatch.
        this.centreOfPressureBiasMetres = 0;
        this.centreOfPressureFrame = -1;

        // 🚩 `appliedArmRadians` IS DELIBERATELY NOT CLEARED HERE. It is not layer state; it is a
        // record of what is on the BONES at this instant, and `MotionStack.reset()` calls
        // `layer.reset()` and then `layer.onBind()` WITHOUT re-committing — so the figure is still
        // standing in the last pose this layer wrote. Zeroing it here would make `onBind`
        // re-measure a settled anger's adduction budget as zero and pin the arms for good.
        //
        // The knee needs no such record: its chain is read from the stack's rest pose, which is
        // the same pose whether a frame has run or not.

    }

    /**
     * @param {number} [deltaSeconds] - Unused. This layer never advances the affect state; see the
     *   note on `prescription` for why.
     * @param {Object} [context] - `MotionStack`'s frame context. Read for `frame` alone, which
     *   stamps 6.9's published centre-of-pressure claim. `MotionStack.update` has always passed
     *   both arguments (`MotionStack.js` — `layer.update( dt, this.context )`); this signature just
     *   stopped throwing them away. ⚠️ A direct `layer.update( 1/60 )` with no context — which
     *   `affect.selftest.mjs` does on purpose — leaves the stamp at -1, so the claim reads as
     *   "no claim" rather than as this frame's. That is the correct answer for a layer nobody is
     *   running a frame for.
     */
    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        this.activations = this.map.activate( this.state.pad );
        this.prescription = this.map.body( this.activations, this.state.bodyInput() );

        // 🎯 The prescription carries DIRECTION AND SHAPE only — `body()` divides by the total
        // activation weight, so a barely-active fear prescribes the same posture as a saturated
        // one. Intensity is the separate number, and using it here is what makes WASABI's own base
        // intensities visible in the body: fear ships at 0.25 because the paper calls it
        // "reluctant", and a reluctant fear should barely move the trunk.
        const intensity = this.defects.ignoreIntensity === true ? 1 : this.prescription.intensity;
        const drive = intensity * this.amplitude;

        const approach = POSTURE_FULL_SCALE_DEGREES.approach * DEGREES_TO_RADIANS
            * this.prescription.approach * drive;

        const headTiltUp = POSTURE_FULL_SCALE_DEGREES.headTiltUp * DEGREES_TO_RADIANS
            * this.prescription.headTiltUp * drive;

        const armSpread = POSTURE_FULL_SCALE_DEGREES.armSpread * DEGREES_TO_RADIANS
            * this.prescription.armSpread * drive;

        // ⚠️ ZERO ON THE SHIPPED TREE, AND ZERO EXACTLY. `kneeFullScaleDegrees` is 0 because no
        // table gives one, so this product is 0 whatever fear prescribes and `writeKneeBend`
        // returns before it plans anything. See KNEE_FULL_SCALE_DEGREES.
        const kneeFlexion = this.kneeFullScaleDegrees * DEGREES_TO_RADIANS
            * this.prescription.kneeActivation * drive;

        let wrote = false;

        // The trunk carried forward or back, hinged at the lumbar so the trunk rotates as a unit.
        // Spreading it down the spine would curl the figure, which is a slouch and not a lean.
        if ( this.writeSagittal( this.bones.spine, approach ) ) wrote = true;

        // Head pitch. Negative sagittal raises the face, since +X carries the head's forward vector
        // downward — hence the sign flip on a channel whose name says "up".
        if ( this.writeSagittal( this.bones.head, -headTiltUp ) ) wrote = true;

        const limited = { leftUpperArm: 0, rightUpperArm: 0 };

        for ( const humanoid of [ 'leftUpperArm', 'rightUpperArm' ] ) {

            limited[ humanoid ] = armSpread >= 0 || this.defects.unclampedAdduction === true
                ? armSpread
                : Math.max( armSpread, -this.maxAdductionRadians[ humanoid ] );

            this.appliedArmRadians[ humanoid ] = limited[ humanoid ];

            if ( this.writeFrontal( this.bones[ humanoid ], limited[ humanoid ] * this.armSides[ humanoid ] ) ) {

                wrote = true;

            }

        }

        if ( this.writeKneeBend( kneeFlexion ) ) wrote = true;

        // 🎯 6.9. The SAME `drive` the chest bend above is scaled by, so the two halves of
        // `approach` cannot drift apart: one emotion, one intensity, two actuators.
        //
        // ⚠️ INCLUDING `intensity` IS DELIBERATE and it is the channel's existing treatment rather
        // than a new decision. Fear ships at WASABI base intensity 0.25 because the paper calls it
        // "reluctant", against anger's 0.75 — measured through the product path, that makes fear's
        // bias 4.03x smaller than anger's, which happens to be conservative on the direction with
        // less headroom. See `CENTRE_OF_PRESSURE_FULL_SCALE_METRES` reason 1.
        //
        // ⚠️ ZERO ON THE SHIPPED TREE, AND ZERO EXACTLY, for the same reason the knee is: the full
        // scale is 0, so this product is 0 whatever the prescription asks for.
        this.centreOfPressureBiasMetres =
            this.centreOfPressureFullScaleMetres * this.prescription.approach * drive;

        this.centreOfPressureFrame = context?.frame ?? -1;

        this.appliedDegrees.approach = approach / DEGREES_TO_RADIANS;
        this.appliedDegrees.armSpread = armSpread / DEGREES_TO_RADIANS;
        this.appliedDegrees.armSpreadLeft = limited.leftUpperArm / DEGREES_TO_RADIANS;
        this.appliedDegrees.armSpreadRight = limited.rightUpperArm / DEGREES_TO_RADIANS;
        this.appliedDegrees.headTiltUp = headTiltUp / DEGREES_TO_RADIANS;

        return wrote ? this.contribution : null;

    }

    /**
     * 🎯 6.2(a), as five lines of writing and one call to the solver.
     *
     * The command is ADDED to what the rest pose already carries, per leg, because a joint angle is
     * measured from a straight limb and this rig stands with 6.8176° of knee in it. The plan then
     * decides how far the pelvis must come down for the DEEPEST leg's ankle to stay put, drops it,
     * and solves both legs against the ankles it started with — so the other leg bends further than
     * commanded rather than lifting its foot. That asymmetry is the geometry being honest and
     * `PlannedLeg.solution.flexionRadians` reports it.
     *
     * @param {number} addedRadians - Flexion to add to each leg's rest flexion. 0 writes nothing.
     * @returns {boolean} Whether anything was written.
     */
    writeKneeBend( addedRadians ) {

        this.appliedDegrees.kneeAdded = 0;
        this.appliedDegrees.kneeLeft = 0;
        this.appliedDegrees.kneeRight = 0;
        this.appliedDegrees.pelvisDropMillimetres = 0;

        if ( this.kneeLegs.length === 0 ) return false;
        if ( Math.abs( addedRadians ) <= POSTURE_EPSILON_RADIANS ) return false;

        for ( const leg of this.kneeLegs ) {

            // 🚩 `kneeIgnoresRestFlexion` reads the command as an ABSOLUTE joint angle, which is the
            // obvious thing to write and inverts the sign for every command below the rest flexion.
            const wanted = this.defects.kneeIgnoresRestFlexion === true
                ? addedRadians
                : leg.restFlexionRadians + addedRadians;

            // A leg cannot extend past straight. The solver clamps its own cosines, but clamping
            // here keeps `PlannedLeg.commandedFlexionRadians` honest about what was asked for.
            leg.flexionRadians = Math.max( wanted, 0 );

        }

        planPlantedKneeBend( this.kneeRequest, this.kneePlan );

        // 🚩 `kneeWithoutPelvisDrop` is the punch-list's own words as a defect: the knees bend, the
        // pelvis stays, and the figure stands on stilts with both ankles in the air.
        if ( this.defects.kneeWithoutPelvisDrop !== true ) {

            toBoneOffsetFrame( this.kneePlan.rootOffset, this.pelvisParentRestFrame, this.scratchPelvisOffset );

            this.contribution.offsetBone( this.bones.hips,
                this.scratchPelvisOffset.x, this.scratchPelvisOffset.y, this.scratchPelvisOffset.z );

        }

        for ( let index = 0; index < KNEE_LEGS.length; index ++ ) {

            const solution = this.kneePlan.legs[ index ].solution;

            // Both corrections are already LOCAL post-multiply rotations — that is ozz's output
            // contract and it is exactly a `MotionStack` delta, so there is no conversion here and
            // there must not be one. `IKSolver.selftest.mjs` §5.2 proves the alternative red.
            this.contribution.rotateBone( this.bones[ KNEE_LEGS[ index ].hip ], solution.startCorrection );
            this.contribution.rotateBone( this.bones[ KNEE_LEGS[ index ].knee ], solution.midCorrection );

        }

        this.appliedDegrees.kneeAdded = addedRadians / DEGREES_TO_RADIANS;
        this.appliedDegrees.kneeLeft = this.kneePlan.legs[ 0 ].solution.flexionRadians / DEGREES_TO_RADIANS;
        this.appliedDegrees.kneeRight = this.kneePlan.legs[ 1 ].solution.flexionRadians / DEGREES_TO_RADIANS;
        this.appliedDegrees.pelvisDropMillimetres = this.kneePlan.travelDistance * 1000;

        return true;

    }

    /** One line for a HUD. `approach +14.2°  ·  arms -10.2°/-11.9° (asked -30.3°)  ·  head +0.0°` */
    describe() {

        const { approach, armSpread, armSpreadLeft, armSpreadRight, headTiltUp } = this.appliedDegrees;

        const clamped = Math.abs( armSpreadLeft - armSpread ) > 1e-6 || Math.abs( armSpreadRight - armSpread ) > 1e-6;

        // 🎯 6.9's published claim is reported in the SAME string as the chest bend, because the two
        // are one channel with two actuators and a HUD that shows only the bone half is the exact
        // reading of `approach` this item exists to correct. `+0.0 mm` on the shipped tree.
        const bias = `${ this.centreOfPressureBiasMetres >= 0 ? '+' : '' }` +
            `${ ( this.centreOfPressureBiasMetres * 1000 ).toFixed( 1 ) } mm`;

        return `approach ${ signedDegrees( approach ) }   ·   arms ${ signedDegrees( armSpreadLeft ) }/` +
            `${ signedDegrees( armSpreadRight ) }${ clamped ? ` (asked ${ signedDegrees( armSpread ) })` : '' }` +
            `   ·   head ${ signedDegrees( headTiltUp ) }   ·   ${ this.describeKnee() }` +
            `   ·   weight ${ bias }`;

    }

    /**
     * The knee's own segment, and it says which of the two zeros it is looking at. A HUD that
     * printed `knees +0.0°` while fear prescribes its LARGEST loading would be hiding the gap this
     * channel ships with, so an unsourced scale prints the loading and the word.
     */
    describeKnee() {

        const asked = this.prescription === null ? 0 : this.prescription.kneeActivation;

        if ( this.kneeLegs.length === 0 ) return 'knees n/a (no chain)';

        if ( this.kneeFullScaleDegrees === 0 ) {

            return asked === 0 ? 'knees +0.0°' : `knees UNSOURCED (asks ${ asked.toFixed( 3 ) })`;

        }

        return `knees ${ signedDegrees( this.appliedDegrees.kneeLeft ) }/` +
            `${ signedDegrees( this.appliedDegrees.kneeRight ) } ` +
            `(pelvis ${ this.appliedDegrees.pelvisDropMillimetres.toFixed( 1 ) } mm)`;

    }

    // --- helpers -----------------------------------------------------------------------------

    /**
     * A bone's rest rotation relative to the rig, taken from the pose the stack's deltas are
     * measured against. See the header: the live read drifts 18.54° across a `reset()`.
     */
    measureRestFrame( bone, stack ) {

        // 🚩 The defect IS the line this file used to ship: compose the frame out of whatever is on
        // the bones right now, which is the rest pose only until a frame has been committed.
        if ( this.defects.restFramesFromLivePose === true ) return restRotationRelativeToRig( bone );

        return restRotationInRigSpace( bone, stack, new Quaternion() );

    }

    writeSagittal( boneName, radians ) {

        return this.writeAxis( boneName, RIG_SAGITTAL_AXIS, radians );

    }

    writeFrontal( boneName, radians ) {

        return this.writeAxis( boneName, RIG_FRONTAL_AXIS, radians );

    }

    writeAxis( boneName, axis, radians ) {

        if ( Math.abs( radians ) <= POSTURE_EPSILON_RADIANS ) return false;

        const restFrame = this.restFrames.get( boneName );
        if ( restFrame === undefined ) return false;

        this.scratchRigRotation.setFromAxisAngle( axis, radians );
        toBoneDeltaFrame( this.scratchRigRotation, restFrame, this.scratchBoneDelta );
        this.contribution.rotateBone( boneName, this.scratchBoneDelta );

        return true;

    }

}

/**
 * 🚩 Named ways this layer could be wrong, kept reachable so the gate is measured against them
 * rather than against an argument. LEARNINGS §1.25a: a gate proved only against the known-bad its
 * author had in mind is decorative, so each of these attacks the same class from a different
 * direction and every one of them still MOVES BONES — a gate that counted moved bones, which is
 * the obvious gate to write for the defect this file closes, says all of them are fine.
 *
 *     ignoreIntensity        the prescription's shape applied at full commitment, so WASABI's
 *                            "reluctant" fear (base 0.25) stands like a saturated anger.
 *     unclampedAdduction     "arms drawn in" driven past the measured anatomical limit, so the
 *                            humerus travels through the ribcage. This one SHIPPED for an hour: the
 *                            limit was measured off stale world matrices and read 30°+ instead of
 *                            10.18°, which is the same failure with none of the code changed.
 *     restFramesFromLivePose the rest frames composed from the bones instead of from the stack's
 *                            snapshot — the line this file shipped until 6.2(a). Costs 18.54° of
 *                            frame drift and 4.60 mm of pose after one `MotionStack.reset()`.
 *     inventedKneeFullScale  a knee amplitude with no table behind it, wearing the derivation's
 *                            clothes. 20°, because that is the number to hand from `approach`.
 *     kneeWithoutPelvisDrop  the punch-list item's own words: a knee bend that does not lower the
 *                            pelvis, so the figure stands on stilts with both feet off the floor.
 *     kneeIgnoresRestFlexion the command read as an ABSOLUTE joint angle, so every command below
 *                            this rig's own 6.8176° of standing flexion STRAIGHTENS the leg.
 *     kneeChainFromLivePose  the chain read off `matrixWorld` instead of the stack's rest snapshot,
 *                            so a re-bind plans the next bend from the bend already on the figure.
 *     ozzDefaultKneePole     ozz's +Y pole kept rather than measured. A standing leg's hip→ankle
 *                            axis is −Y, so the chain plane's normal is 2% of unit length and the
 *                            knee's direction is decided by the rest pose's noise.
 *
 * The remaining member of the class is `ExpressionMap.DEFECTS.bapDenominatorSkipsUnlisted`, because
 * it is a mapping error rather than an actuation one.
 */
export const POSTURE_DEFECTS = Object.freeze( {
    ignoreIntensity: 'every emotion commits fully, so a reluctant fear stands like a settled anger',
    unclampedAdduction: 'adduction driven past vertical, so the arm enters the ribcage',
    restFramesFromLivePose: 'rest frames read off the posed bones, so the same emotion lands elsewhere after a reset',
    inventedKneeFullScale: 'a knee angle with no source, presented as if the derivation produced it',
    inventedCentreOfPressureFullScale:
        'Duarte\'s VOLUNTARY 17 mm weight shift read as an emotional centre-of-pressure amplitude',
    kneeWithoutPelvisDrop: 'knees bent with the pelvis held, so the figure stands on stilts',
    kneeIgnoresRestFlexion: 'the knee command read as absolute, so a small bend straightens the leg',
    kneeChainFromLivePose: 'the leg chain read off matrixWorld, so a re-bind plans from its own bend',
    ozzDefaultKneePole: 'ozz\'s +Y pole kept, which on a standing leg is the plane singularity'
} );

const POSTURE_DEFECTS_OFF = Object.freeze(
    Object.fromEntries( Object.keys( POSTURE_DEFECTS ).map( ( key ) => [ key, false ] ) ) );

/** Every reported angle at rest. One object so `reset()` and the constructor cannot disagree. */
const NOTHING_APPLIED = Object.freeze( {
    approach: 0, armSpread: 0, armSpreadLeft: 0, armSpreadRight: 0, headTiltUp: 0,
    kneeAdded: 0, kneeLeft: 0, kneeRight: 0, pelvisDropMillimetres: 0
} );

// --- local helpers ------------------------------------------------------------------------------

// Bind-time scratch. `onBind` is not a frame, but it runs on every `MotionStack.reset()`, so it
// still has no business allocating four matrices per leg per call.
const scratchHipMatrix = new Matrix4();
const scratchKneeMatrix = new Matrix4();
const scratchAnkleMatrix = new Matrix4();
const scratchLocalMatrix = new Matrix4();
const scratchLegAxis = new Vector3();
const scratchKneeDirection = new Vector3();

function coulsonRow( abdomenTwist, chestBend, headBend, shoulderAdAbduct, shoulderSwing, elbowBend ) {

    return Object.freeze( {
        abdomenTwist: Object.freeze( abdomenTwist ),
        chestBend: Object.freeze( chestBend ),
        headBend: Object.freeze( headBend ),
        shoulderAdAbduct: Object.freeze( shoulderAdAbduct ),
        shoulderSwing: Object.freeze( shoulderSwing ),
        elbowBend: Object.freeze( elbowBend )
    } );

}

/**
 * The derivation rule, as code. The smallest non-zero magnitude any emotion's row lists in a
 * column — the least exaggerated level of that degree of freedom the study actually measured.
 *
 * 🚩 It throws for a column Coulson does not have, and that throw is load-bearing rather than
 * defensive: it is how `kneeActivation`'s missing full scale is a fact the gate can execute
 * instead of a sentence in a comment.
 */
export function smallestListedMagnitude( column ) {

    let smallest = Infinity;

    for ( const row of Object.values( COULSON_TABLE_1 ) ) {

        const levels = row[ column ];

        if ( levels === undefined ) {

            throw new Error(
                `PostureLayer: Coulson Table 1 has no column '${ column }'. It has ${ COULSON_COLUMNS.length }: ` +
                `${ COULSON_COLUMNS.join( ', ' ) } — none of them a knee, which is why kneeActivation ` +
                'has no derived full scale.' );

        }

        for ( const degrees of levels ) {

            const magnitude = Math.abs( degrees );
            if ( magnitude > 0 && magnitude < smallest ) smallest = magnitude;

        }

    }

    if ( smallest === Infinity ) {

        throw new Error( `PostureLayer: Coulson Table 1 has no non-zero value in column '${ column }'.` );

    }

    return smallest;

}

/**
 * A bone's rest rotation relative to the rig, composed from the pose `MotionStack` measures deltas
 * against rather than from the live bones.
 *
 * The fallback is the interesting half and it is exact rather than approximate: `restRotationOf`
 * returns null for a bone NO LAYER DECLARES, and a bone no layer declares is a bone nothing writes,
 * so its live local rotation is its rest rotation. Declared or not, this reads the right thing.
 *
 * Normalised for the reason `Breath.restRotationRelativeToRig` gives: the GLB stores quaternions to
 * six decimals, `Quaternion.invert()` is a conjugate, and the error would compound through every
 * frame's composition.
 */
function restRotationInRigSpace( bone, stack, target = new Quaternion() ) {

    target.set( 0, 0, 0, 1 );

    for ( let node = bone; isMissing( node ) === false; node = node.parent ) {

        target.premultiply( stack.restRotationOf( node.name ) ?? node.quaternion );

    }

    return target.normalize();

}

/**
 * A bone's world matrix as it stands in the REST pose — the same composition three.js performs for
 * `matrixWorld`, with each ancestor's local transform taken from the stack's snapshot where it has
 * one. See `restRotationInRigSpace` for why the fallback is exact.
 *
 * This is the read the knee chain is built from, and it is deliberately NOT `bone.matrixWorld`: a
 * world matrix is whatever the last commit left behind, and on a re-bind that is this layer's own
 * knee bend.
 */
function restWorldMatrixOf( bone, stack, target = new Matrix4() ) {

    const chain = [];

    for ( let node = bone; isMissing( node ) === false; node = node.parent ) chain.push( node );

    target.identity();

    for ( let index = chain.length - 1; index >= 0; index -- ) {

        const node = chain[ index ];

        scratchLocalMatrix.compose(
            stack.restPositionOf( node.name ) ?? node.position,
            stack.restRotationOf( node.name ) ?? node.quaternion,
            node.scale );

        target.multiply( scratchLocalMatrix );

    }

    return target;

}

/**
 * 🎯 WHICH WAY THE KNEE POINTS, MEASURED OFF THE REST POSE, WRITTEN INTO `setup.poleVector`.
 *
 * A two-bone solve fixes the interior angle and leaves the chain free to spin about the hip→ankle
 * line; the pole is what removes that freedom. ozz defaults it to +Y and a standing leg's hip→ankle
 * axis IS −Y, so the default is 1.16° off parallel on this rig — the singular case, where the plane
 * normal is 2% of unit length and the knee's direction is set by whatever the rest pose's noise
 * happens to be (`IKSolver.js` header, measured: conditioning 0.0203 against 0.9998 for forward).
 *
 * The pole this writes is the leg's OWN patella direction: the knee's offset from the hip→ankle
 * line, normalised. That is a measurement rather than a transcription — a mirrored rig, a stance
 * pose or a turned-out foot all get the right answer — and it makes the plane rotation a near
 * no-op, which is the correct behaviour for a bend that should not swing the knee sideways.
 *
 * 🎯 IT IS ALSO MAXIMALLY CONDITIONED BY CONSTRUCTION, WHICH IS THE POINT. The axial component is
 * projected out, so `|t̂ × p̂|` is exactly 1 rather than merely large — against 0.020292 for ozz's
 * default on this rig, both measured in `affect.selftest.mjs`. Naming a direction (rig +Z, say)
 * would land near 1 on this bake and near 0 on a rig whose legs are authored splayed; measuring
 * cannot.
 *
 * Falls back to rig-forward when the leg is dead straight, where there is no patella direction to
 * measure; `readMidAxisFromPose`'s determination is the number that catches that case properly.
 *
 * @returns {number} How far the measured pole sits off rig-forward, in degrees. Reported so a rig
 *   whose knees point somewhere unexpected is visible rather than silently accommodated.
 */
function measureKneePole( setup ) {

    const axis = scratchLegAxis.subVectors( setup.endPosition, setup.startPosition );
    const axisLength = axis.length();

    if ( axisLength === 0 ) {

        setup.poleVector.copy( RIG_FORWARD_DIRECTION );
        return 0;

    }

    axis.divideScalar( axisLength );

    const toKnee = scratchKneeDirection.subVectors( setup.midPosition, setup.startPosition );
    toKnee.addScaledVector( axis, -toKnee.dot( axis ) );

    const lateral = toKnee.length();

    if ( lateral === 0 ) {

        setup.poleVector.copy( RIG_FORWARD_DIRECTION );
        return 0;

    }

    setup.poleVector.copy( toKnee ).divideScalar( lateral );

    return setup.poleVector.angleTo( RIG_FORWARD_DIRECTION ) / DEGREES_TO_RADIANS;

}

/**
 * 🎯 HOW WELL THE POLE FIXES THE CHAIN PLANE: `|t̂ × p̂|`, the sine of the angle between the
 * hip→ankle axis and the pole.
 *
 * The same number `TwoBoneSolution.poleConditioning` reports per solve, measured here at bind so
 * the gate can reject a bad pole before any frame runs. 1 is square to the leg and 0 is the
 * singularity, where `cross()` has no direction and the knee's direction comes out of whatever the
 * rest pose happened to carry. Measured on `figure_g050` in `relaxed-standing`: exactly 1 for the
 * measured patella pole — see `measureKneePole`, it is square by construction — against 0.020292
 * for ozz's +Y default, a factor of 49.
 */
function measurePoleConditioning( setup ) {

    const axis = scratchLegAxis.subVectors( setup.endPosition, setup.startPosition );
    const axisLength = axis.length();

    if ( axisLength === 0 ) return 0;

    axis.divideScalar( axisLength );

    return scratchKneeDirection.copy( setup.poleVector ).normalize().cross( axis ).length();

}

function isMissing( value ) {

    return value === null || value === undefined;

}

function signedDegrees( value ) {

    return `${ value >= 0 ? '+' : '' }${ value.toFixed( 1 ) }°`;

}
