/**
 * Sway — postural sway and weight shift, the two things a standing body never stops doing.
 *
 * Quiet standing is not stillness. It is a continuous, low-frequency balance correction with a
 * very specific spectrum, plus a sparse series of larger weight shifts. This layer produces both
 * and keeps them separate, because they are measured separately and they mean different things:
 * the balance band is physiology, the weight shifts are *behaviour* and belong to the
 * conversation.
 *
 *
 * 🎯 SWAY IS AN INVERTED PENDULUM ABOUT THE ANKLES, NOT A BEND IN THE SPINE
 *
 * The version this replaced modelled sway as a spine bend: it declared spine_01..03 and the neck
 * and nothing else. Every head statistic it was gated on passed. It still failed the only test
 * that matters, and the diagnosis was unambiguous — a per-pixel temporal-sigma heat map over 600
 * frames of full-body idle was DEAD BLACK below the hips, with a hard horizontal cut at the hip
 * line while the arm a centimetre away glowed. Measured pelvis, calf and foot world path over
 * 20 s: exactly 0.0000 mm. A living torso bolted to a statue's legs.
 *
 * 🚩 THAT IS TRUE FORE-AND-AFT, AND FALSE SIDE TO SIDE. Read the title of the paper: Winter,
 * Prince, Frank, Powell & Zabjek 1996, *"Unified theory regarding A/P and M/L balance in quiet
 * stance"* — two axes, two mechanisms. Antero-posteriorly the body really is an inverted pendulum
 * turning about the ankles. Medio-laterally, with the feet apart, the ankle has almost no lateral
 * authority: the body uses a HIP LOAD/UNLOAD strategy, moving the centre of pressure between the
 * feet by redistributing vertical load. The pelvis travels over the loaded foot, the abductors
 * hike that side, the lumbar spine counter-bends, and the head stays roughly where it was.
 *
 * Running the lateral axis through the pendulum instead produces exactly the wrong shape, and a
 * visual judge named it before anyone looked at the code: "a well-animated head bolted to a rigid
 * mannequin being tilted on an ankle hinge." Measured on that clip — left-leg tilt against
 * right-leg tilt r = 0.94, hip against neck r = 0.95, and lateral displacement proportional to
 * height above the ankle, so the head travelled 2.5x as far as the pelvis. A real weight shift is
 * the other way round. So the lateral axis is delivered by the contrapposto, which already has
 * the right shape, and the pendulum keeps the axis it is right about.
 *
 * 🚩 MOSTLY — AND THE EXCEPTION IS IN THE SAME ABSTRACT, TWO SENTENCES LATER. "M/L balance is under
 * hip control" is Winter's SIDE-BY-SIDE row. At an intermediate, toed-out stance he measures both
 * mechanisms contributing and says *"in the M/L direction the two strategies reinforce"*. This
 * figure stands at 18.6 degrees of included foot angle, so the side-by-side row is the wrong one
 * and the ankle owns a derived share of the lateral signal — see MEDIO_LATERAL_ANKLE_SHARE. Third
 * time this one paper has answered a question it was not asked; read the whole table.
 *
 * Quiet-stance balance fore-and-aft is an ANKLE STRATEGY. The body rotates about the ankles as a
 * near-rigid inverted pendulum; the trunk barely participates. So the rotation is authored at the
 * bottom of the chain and everything above it — pelvis, knees, spine, head — TRANSLATES as a
 * consequence.
 * The head excursion the literature reports is then an OUTPUT of the pendulum rather than the
 * thing this file authors, which is what makes the lower body move without changing a single one
 * of the validated head numbers: the wanted head displacement is still stated in millimetres, and
 * the pendulum angle that produces it is solved for from the rig's own geometry.
 *
 * The rig is hip-rooted — the legs hang off the pelvis — so an ankle-rooted rotation is written
 * as three things that together are one rigid rotation about the ankle line:
 *
 *   1. the pelvis rotates by the lean, carrying spine, arms, head AND legs with it;
 *   2. the pelvis translates so the rotation pivots about the ankles rather than about itself;
 *   3. each foot counter-rotates by the same lean, so the soles stay flat on the floor.
 *
 * See `PIVOT_HEIGHT_FRACTION_OF_ANKLE` and `planted feet` below for how the last millimetre of
 * that is kept honest without foot IK.
 *
 *
 * THE BALANCE BAND — Quijoux et al. 2021, force-plate column (§7 of the research doc)
 *
 *     measure                ML      AP
 *     frequency mode (Hz)    0.33    0.27
 *     f50 median power (Hz)  0.43    0.42
 *     f95 (Hz)               1.09    1.23
 *     RMS distance (mm)      3.0     4.9
 *
 * 95% of the power sits below 1.1–1.3 Hz and ESSENTIALLY NOTHING sits above 2 Hz. Anything
 * faster than that does not read as balance, it reads as tremor — the fastest way to make a
 * standing avatar look ill.
 *
 * AP is consistently 1.5–2× ML in amplitude, in velocity AND in high-frequency content. Sway is
 * not isotropic and making it isotropic is visible: an isotropic wobble reads as floating.
 *
 * 🎯 THE ANISOTROPY IS A CLAIM ABOUT THE BALANCE BAND, AND ONLY ABOUT THE BALANCE BAND. Quiet
 * stance is anisotropic; UNCONSTRAINED standing is not. Bates et al. 2021, fifteen minutes with
 * subjects told they could move as they wished, measures centre-of-pressure SD at 16.87 mm ML
 * against 16.32 mm AP — a ratio of 1.03, inverted from quiet stance, because Duarte's larger and
 * more frequent lateral weight shifts have had time to assert themselves. So the anisotropy gate
 * belongs on `balanceDisplacement` and NOT on the composite, and a composite trace whose ratio
 * wanders below 1.0 over a long window is the model being right rather than wrong.
 *
 *
 * 🎯 EVERY AMPLITUDE IN THIS FILE IS A CENTRE-OF-PRESSURE AMPLITUDE, AND THE HEAD IS AN OUTPUT
 *
 * This is the second re-rooting this layer has had, and it is the same lesson as the first. The
 * version before it authored these amplitudes as HEAD excursion, on the reasoning that a body
 * swaying as a near-rigid inverted pendulum moves its head at least as far as its centre of
 * pressure. That inequality is true, and the file then used it backwards: setting head excursion
 * EQUAL to the published centre-of-pressure figure under-moves the head by exactly the lever
 * ratio it had just identified. Measured on this rig at bind, the effective levers are 1.298 m of
 * head travel and 0.785 m of centre-of-mass travel per radian of lean — a ratio of 1.653.
 *
 * The weight shifts had the same error, larger and in the other direction. They carried a
 * hand-set coefficient, POSTURE_HEAD_TRANSFER = 0.20, for "the fraction of a weight shift that
 * reaches the head" — a number with no support in the record, and one that turns out to be
 * decidable rather than tunable. Static equilibrium fixes it: a body that is not accelerating has
 * no net moment, so the ground reaction force must act along a line through the centre of mass,
 * and its point of application on the floor — which is what a force plate calls the centre of
 * pressure — sits directly beneath it. A SUSTAINED 22 mm change of centre-of-pressure region is
 * therefore a 22 mm change of centre of mass, full stop. Measured on this rig's own contrapposto,
 * that lands the head 33 mm across. The coefficient should have been about 1.5. It was 0.20, and
 * the shifts were consequently invisible: 1.6 pixels at full-body framing, which is what failed
 * the Phase 2 gate.
 *
 * So the model is rooted where the measurements were taken. Every amplitude below is stated in
 * centre-of-pressure metres, `figure/BodyMass.js` says where the centre of mass is for a given
 * pose, and both the pendulum lean and the contrapposto blend are SOLVED so the centre of mass
 * lands where the literature says it should. Where the head ends up is then a fact about the
 * body's geometry rather than a number this file gets to choose — which is exactly what made the
 * lower body start moving when the pendulum was re-rooted, and for the same reason.
 *
 * ⚠️ The identity holds for SUSTAINED posture. During a transient the centre of pressure leads
 * the centre of mass — that is how balance is corrected at all — and the two separate by a few
 * millimetres over a sway cycle. The separation is zero-mean, so it does not bias anything here,
 * but a critic comparing a single frame against a force plate needs to know it is there.
 *
 *
 * HOW THE SPECTRUM IS BUILT
 *
 * Two bands of gradient noise, summed. Gradient noise at lattice rate f puts its spectral mode
 * near 0.5f and its f95 near 0.94f — measured, not assumed (see the band constants below). One
 * band cannot hit both a 0.3 Hz mode and a 1.1 Hz f95: the low band sets the mode, the upper
 * band supplies the tail. The band frequencies and weights below were found by sweeping against
 * the four measured statistics and are verified by the selftest's FFT, not by eye.
 *
 *
 * WEIGHT SHIFTS — Duarte & Zatsiorsky 1999, 30 min unconstrained standing
 *
 *     pattern                        AP interval   AP amplitude   ML interval   ML amplitude
 *     fidgeting (fast, returns)       59 ± 15 s         —          49 ± 16 s         —
 *     shifting (fast, new region)    316 ± 292 s     17 ± 15 mm   199 ± 148 s    22 ± 38 mm
 *     drifting (slow, continuous)    319 ± 173 s        —         529 ± 333 s        —
 *
 * ≈ 1.0/min AP and 1.2/min ML fidget; 0.19/min AP and 0.30/min ML shift; drift 0.19 and 0.11/min.
 *
 * A weight shift is not a lean. It is the pelvis travelling over the stance foot with the lumbar
 * spine counter-bending above it — contrapposto — and the figure package already has that pose
 * authored and reasoned about in `figure/poses/weight-left.json` and `weight-right.json`. The
 * medio-lateral half of the shift process therefore drives a blend toward those poses rather than
 * more pendulum lean, and the blend is the one that puts the centre of mass where the amplitude
 * above says it went. Measured on this rig at bind: a unit blend moves the centre of mass 38.7 mm
 * to the left or 41.3 mm to the right, so Duarte's mean 22 mm asks for about 0.57 of the pose.
 *
 * 🚩 FIDGETS ARE WEIGHT SHIFTS TOO, and treating them as anything else was half of why the idle
 * looked static. Duarte's three patterns differ in whether the body RETURNS to the region it came
 * from, not in whether it loaded a leg: a fidget is a shift that comes back. The version this
 * replaced relayed only the `shifting` process, at 0.30/min — so 7 of 12 ninety-second windows
 * contained no postural event at all. Counting the fidget process as well gives 1.5 medio-lateral
 * events per minute, which is both what punch-list item 2.9 asks for and where Cassell's
 * independently-measured conversational rate of 1.4–1.6/min lands.
 *
 *
 * 🎯 WHY markDiscourseBoundary() EXISTS, AND WHY IT IS NOT A TIMER
 *
 * Cassell et al. 2001, 70.5 minutes double-coded: a posture shift accompanies **26% of discourse
 * boundaries that coincide with a speaker change**, but only **8% of turn boundaries that are not
 * discourse boundaries**. The shift lands *at* the topic change.
 *
 * That coupling is a large part of why an avatar reads as UNDERSTANDING rather than ANIMATING.
 * A posture shift on a timer is decoration; the same shift, same amplitude, same duration, fired
 * at the moment the topic turns, is read by a viewer as the body agreeing with the mind. It is
 * the cheapest legibility win in the whole motion stack and it costs one call from the dialogue
 * layer. Do not replace it with a scheduler.
 *
 * The Duarte idle rates continue underneath regardless — a listener who is not at a boundary
 * still fidgets — and the two independently-measured background rates agree: Cassell's
 * conversational 1.4–1.6 shifts/min and Duarte's force-plate ~1/min fidget rate.
 */

import { Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { CoherentNoise1D, PoissonSchedule } from './Signals.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from './Breath.js';
import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';
import { RestPose } from '../figure/RestPose.js';
import { BodyMass } from '../figure/BodyMass.js';

// --- measured constants ------------------------------------------------------------------

/**
 * Balance-band shape. `frequencyHz` is the noise lattice rate, which is about twice the spectral
 * mode it produces — that factor is measured, not theoretical.
 *
 * Verified by FFT over eight seeds, 300 s each (Welch, 34 s Hann segments):
 *
 *     axis  bands                        mode    f50     f95     >2 Hz
 *     ML    0.66 @1.0 + 1.60 @0.5        0.330   0.388   1.066   0.09%
 *     AP    0.62 @1.0 + 1.90 @0.5        0.300   0.370   1.263   0.18%
 *
 * against targets ML 0.33 / 0.43 / 1.09 and AP 0.27 / 0.42 / 1.23. AP's higher upper band is
 * what gives it the greater high-frequency content the literature reports.
 */
const BALANCE_BANDS_MEDIO_LATERAL = [
    { frequencyHz: 0.66, weight: 1.0 },
    { frequencyHz: 1.60, weight: 0.5 }
];

const BALANCE_BANDS_ANTERO_POSTERIOR = [
    { frequencyHz: 0.62, weight: 1.0 },
    { frequencyHz: 1.90, weight: 0.5 }
];

/**
 * The RMS of either band sum at unit weight, measured over eight seeds × 300 s: 0.3142 (ML) and
 * 0.3141 (AP). Dividing by it makes the amplitude options below mean literal millimetres.
 */
const BALANCE_BAND_UNIT_RMS = 0.314;

/**
 * 🎯 Quijoux's force-plate column, VERBATIM, in CENTRE-OF-PRESSURE metres — which is the quantity
 * that paper measured and the quantity this layer now solves the centre of mass to.
 *
 * The version this replaced sat at 3.45 / 6.04 mm and called them HEAD excursion. Two things
 * changed and they pull in opposite directions, which is why both are done in one pass:
 *
 *   THE FRAME. Naming them centre of pressure is what makes the head an output. It comes out
 *   1.65x larger, because that is where the head sits relative to the centre of mass on this rig.
 *
 *   ⚠️ THE COHORT. Quijoux's two sets are aged 71.3 ± 6.5 (plate) and 78.7 ± 6.7 (board), and
 *   `research/body-motion-numbers.md` records that sway rises systematically from about age 60.
 *   These are elderly reference values being used for a young avatar, which is the SAME class of
 *   error as the frame one and points the other way. No young-adult centre-of-pressure RMS in
 *   millimetres was found to substitute — the closest is an ellipse-area study whose convention
 *   may not match — so the correction taken here is to author at the force-plate column itself
 *   rather than at the midpoint of the gate band, which is the low end of the 3–5 / 5–7 mm range
 *   and the side the age bias says to err on. The research doc already says to prefer that column.
 *
 * The design anisotropy that falls out is 4.9 / 3.0 = 1.633, comfortably inside the measured
 * 1.5–2.0 rather than on its edge, so nothing has to be derived from the ratio any more.
 */
const BALANCE_RMS_MEDIO_LATERAL_METRES = 0.0030;
const BALANCE_RMS_ANTERO_POSTERIOR_METRES = 0.0049;

/**
 * The measured 1.5–2.0 anisotropy, at its midpoint. No longer used to derive an amplitude — see
 * above — but the drift amplitudes still carry it so a slow wander cannot quietly undo the
 * anisotropy the balance band is gated on.
 */
const BALANCE_ANISOTROPY_ANTERO_POSTERIOR_OVER_MEDIO_LATERAL = 1.75;

/** Duarte & Zatsiorsky 1999, derived rates, events per second. */
const FIDGET_RATE_MEDIO_LATERAL = 1.2 / 60;
const FIDGET_RATE_ANTERO_POSTERIOR = 1.0 / 60;
const SHIFT_RATE_MEDIO_LATERAL = 0.30 / 60;
const SHIFT_RATE_ANTERO_POSTERIOR = 0.19 / 60;

/**
 * Duarte & Zatsiorsky 1999, shift amplitudes, metres. Mean and SD, both reported. Note that the
 * standard deviation exceeds the mean on the medio-lateral axis; see `drawAmplitude` for why that
 * makes the distribution skewed rather than merely wide, and what goes wrong if it is read as a
 * gaussian.
 */
const SHIFT_AMPLITUDE_MEDIO_LATERAL_METRES = 0.022;
const SHIFT_AMPLITUDE_MEDIO_LATERAL_SD_METRES = 0.038;
const SHIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES = 0.017;
const SHIFT_AMPLITUDE_ANTERO_POSTERIOR_SD_METRES = 0.015;

/** Duarte & Zatsiorsky 1999, drift intervals as frequencies: 529 s ML, 319 s AP. */
const DRIFT_FREQUENCY_MEDIO_LATERAL_HZ = 1 / 529;
const DRIFT_FREQUENCY_ANTERO_POSTERIOR_HZ = 1 / 319;

/** Cassell et al. 2001. The two numbers Rea actually used. */
const SHIFT_PROBABILITY_AT_SPEAKER_CHANGE = 0.26;
const SHIFT_PROBABILITY_AT_PLAIN_TURN_BOUNDARY = 0.08;

// --- tuning constants, with no primary support -------------------------------------------

/**
 * 🎯 Fidget amplitude, as a fraction of a shift's — and a constant that was wrong for a reason
 * worth keeping, because the paper had already answered it.
 *
 * Duarte reports fidget INTERVALS and no fidget amplitude, so this cannot be read off his table.
 * What it used to say was: "a fidget is by definition smaller than a shift because it returns to
 * the same region", and half was the assumption. The first clause does not follow from the second,
 * and the paper's own words say otherwise — FIDGETING is *"a fast and LARGE displacement and
 * returning of COP to approximately the same position"* against SHIFTING's *"a fast displacement of
 * the average position of COP from one region to another"*. The word that separates them is
 * RETURNING, not smaller; "large" is in the description of the fidget.
 *
 * 🚩 AND IT WAS THE LEGIBILITY DEFECT. A blind visual judge watching seven minutes read THREE
 * postural events, 0.43 a minute, against a relay firing at 1.5. Measured over 90 minutes on this
 * figure: the balance band alone moves the pelvis 3.7 mm RMS, the median relayed event moved it
 * 11.4 mm, and the excursion at which the judge's count comes out right is about 5.5x the
 * background — roughly 20 mm. Half the relays were the same size as the sway they were supposed to
 * stand out from, and 78% of the relays are fidgets, so halving them halved almost the whole
 * stream. It is not a rate problem and it is not the lognormal's tail; it is signal against
 * background.
 *
 * At parity the median event moves the pelvis 16.1 mm against a 3.7 mm background — see the
 * selftest's LEGIBILITY section for the measured rate above the judge's own threshold. It costs the
 * fifteen-minute composite almost nothing, because a fidget returns: 11.63 mm of lateral
 * centre-of-pressure SD becomes 11.80, well inside Bates' interquartile range either way.
 */
const FIDGET_AMPLITUDE_FRACTION_OF_SHIFT = 1.0;

/**
 * 🎯 How long a fidget's out-and-back takes, and how that time is split between going and coming
 * back. "Fast" is all Duarte says — and reading it as symmetric was the second half of the
 * legibility defect.
 *
 * The version this replaced was a raised cosine over 1.4 s: 0.7 s out, 0.7 s back. At 1.2 fidgets a
 * minute that is a duty cycle of **2.5%** — the figure is mid-fidget for one frame in forty. A judge
 * that samples the timeline rather than staring at it continuously therefore expects to catch about
 * one fidget in seven minutes however large they are, which is part of why it read THREE postural
 * events in seven minutes when the relay was firing at 1.5 a minute. The other part was amplitude,
 * and amplitude alone cannot fix this, because an event that is not on screen cannot be seen at any
 * size.
 *
 * 🚩 The word "fast" in Duarte's definition attaches to the DISPLACEMENT — *"a fast and large
 * displacement and returning of COP to approximately the same position"* — and not to the return.
 * Muscle says the same thing: loading the other leg is an active push and coming back off it is
 * largely passive, so a fidget is fast out and slow back in exactly the way `BodyIdle`'s shoulder
 * settle already argues for. The SHAPE is the argued part of this change: the time to peak drops
 * from 0.70 s to 0.45 s — the displacement is faster than it was, which is the half Duarte's wording
 * supports — and the return stretches from 0.70 s to 1.35 s.
 *
 * 🎯 AND THE DURATION HAS A MEASURED CEILING, WHICH IS THE PART WORTH KNOWING. A longer fidget is a
 * better fidget by every legibility measure — 3.0 s takes the duty cycle to 5.3% — and it is not
 * free: a 1.2/min process with a multi-second time constant puts real power below 0.25 Hz, and the
 * COMPOSITE lateral spectral mode measured at the head falls out of the postural band with it.
 * Measured, `idle-motion.selftest.mjs`'s median across twelve seeds:
 *
 *     1.4 s  0.308 Hz     1.8 s  0.264 Hz     2.0 s  0.234 Hz     3.0 s  0.176 Hz
 *
 * against a band of 0.250-0.360. 1.8 s is the longest duration that keeps it inside, so 1.8 s is
 * what this is, and the duty cycle it buys is 3.2% rather than 5.3%.
 *
 * ⚠️ That ceiling is stated against a composite measured with a quiet-standing number, which is the
 * category error §1.7b is about — Quijoux's 60 s "stand as still as possible" trials cannot contain
 * a weight-shift process at 49-199 s intervals. `sway.selftest.mjs` gates the same claim on
 * `balanceDisplacement`, where it belongs, and reads 0.322 Hz at any of these durations. So the
 * ceiling may well be an artefact of the wrong gate. It is honoured anyway, because a slower
 * composite rock is a real change in what a viewer sees and there is no source saying it is right —
 * and honouring it costs 0.02 legible events a minute, measured. Revisit with a source, not a
 * preference.
 */
const FIDGET_DURATION_SECONDS = 1.8;
const FIDGET_RISE_FRACTION = 0.25;

/**
 * The largest rise fraction a stretched fidget may reach. Past 0.5 the push onto the other leg
 * takes longer than the drift back off it, which inverts the fast-out, slow-back reading of
 * Duarte's "a fast and LARGE displacement and returning" that FIDGET_DURATION_SECONDS argues for.
 * At exactly 0.5 the two halves are equal, which is the boundary rather than a preference. See
 * `fidgetShapeFor` for why this ceiling is where the amplitude stretch is spent first.
 */
const FIDGET_RISE_STRETCH_CEILING = 0.5;

/** TUNING. How long a shift takes to settle into its new region. */
const SHIFT_SETTLE_SECONDS = 0.8;

/**
 * 🎯 How long a shifted stance holds before leaking back toward centre — ONE INTER-SHIFT
 * INTERVAL, per axis, which is Duarte's own number rather than a tuning constant.
 *
 * The version this replaced held for 30 s against a medio-lateral shift interval of 199 s, and
 * that contradicted the paper it was implementing. Duarte's taxonomy separates the two fast
 * patterns precisely on this: FIDGETING is "a fast and large displacement and returning of COP to
 * approximately the same position"; SHIFTING is "a fast displacement of the average position of
 * COP from one region to another". A shift that springs back inside half a minute is a fidget.
 *
 * The cost of getting it wrong was not visible as a wrong pose — it was visible as a missing
 * amplitude. For jumps arriving at rate λ and decaying over τ the stationary variance is
 * λ·τ·E[A²]/2, so a stance that leaks away in 30 s of every 199 spends most of its life near
 * centre and the whole shift process contributed about 7 mm of centre-of-pressure SD over a
 * quarter of an hour. Bates et al. 2021, measuring exactly that quantity over exactly that
 * window, report 16.87 mm. Holding for an interval instead puts the process where the measurement
 * says it should be, and the leak still guarantees the random walk cannot wander off.
 */
const SHIFT_RETURN_INTERVALS = 1.0;

/**
 * 🎯 Hard limit on the accumulated posture offset, stated as a number of MEAN WEIGHT SHIFTS.
 *
 * Duarte's medio-lateral shift amplitude has a standard deviation of 38 mm on a mean of 22 mm, so
 * without a clamp a single draw from the tail puts the stance somewhere no standing human goes,
 * and the random walk eventually wanders the avatar out of frame. The clamp is what stops both.
 *
 * It is anchored on the shift amplitude rather than on the base of support, and that is the second
 * try. The first read a quarter of the base off the rig — the half-stance medio-laterally, the
 * ankle-to-ball distance fore-and-aft — which is defensible on the lateral axis and simply the
 * wrong quantity on the other one. The rig has no heel joint, so ankle-to-ball is neither the
 * forward base nor the rear one. Measured off this figure's own footprint (every mesh vertex below
 * ankle height): the foot is 232 mm long, running 183 mm forward of the ankle joint and 50 mm
 * behind it, against the 117 mm that was being used. The **rear** extent is the one that limits a
 * standing person — people fall backwards long before they fall forwards — and 117 mm is more than
 * twice it.
 *
 * Anchoring on the shift amplitude instead makes the two axes mean the same thing: the stance may
 * accumulate about two average weight shifts in one direction before it is held. On figure_g050
 * that is 44 mm laterally and 34 mm fore-and-aft, and the fore-and-aft figure sits comfortably
 * inside the 50 mm rear footprint measured above.
 */
const POSTURE_OFFSET_MEAN_SHIFTS = 2.0;

/**
 * 🚩 A ceiling on the lateral clamp for a figure posed with its feet unusually close together — and
 * a constant whose value changed the day the stance width did, which is §1.11b again.
 *
 * It used to be a QUARTER of the half-stance, and that was safe only because the half-stance was
 * 181.8 mm: it allowed 45.4 mm against the 44 mm the shift rule asks for, and never bound. Bringing
 * the feet to McIlroy & Maki's preferred separation halves the half-stance to 77.7 mm, and a quarter
 * of that is 19.4 mm — BELOW Duarte's own mean medio-lateral shift of 22 mm, so more than half of
 * every shift the layer draws would be clipped. Measured: the 900 s composite fell from 11.63 mm to
 * 6.63 mm, outside Bates' interquartile range, and the sway this whole file exists to produce
 * halved. A rail that binds harder than the paper being implemented is not a rail.
 *
 * A quarter was never a physical limit. The physical limit is the base of support: the centre of
 * pressure cannot leave the feet. Measured on this figure at its new stance, the stance ankle sits
 * 77.7 mm from the midline and the OUTER BORDER of that foot sits 147.7 mm from it — so a clamp at
 * the ankle is already conservative by 70 mm. It is exactly where the centre of pressure sits when
 * the load is fully on one leg, which is the most a weight shift can ever be.
 *
 * So the ceiling is the half-stance itself and there is no fraction any more. On the shipped figure
 * it allows 77.7 mm against the 44 mm the shift rule asks for, so Duarte's amplitude is what decides
 * a quiet-standing stance — which is the right way round. There is no fore-and-aft equivalent
 * because the rig has no heel landmark to read one from.
 */

/**
 * 🎯 Drift amplitude, in COP metres — the one free parameter in the weight-shift half of this
 * file, and the one thing a composite gate can be calibrated against.
 *
 * Duarte reports drift INTERVALS (529 s ML, 319 s AP) and no amplitude at all, so this cannot be
 * read off his table. What it can be calibrated against is the total: Bates et al. 2021 stood 22
 * normal-flexibility controls for fifteen minutes, told them they could move as they wished, and
 * measured centre-of-pressure SD at 16.87 mm ML and 16.32 mm AP (IQR 9.58–66.5 and 10.34–28.75).
 * That is a composite of everything this layer models, measured under this layer's own conditions,
 * and the drift term is what closes the gap between the processes that ARE pinned and that total.
 *
 * 🚩 AND IT IS STILL UNPINNED, BECAUSE THE TWO PAPERS DISAGREE ON THE FORE-AND-AFT AXIS.
 *
 * Calibrating this against Bates was tried and abandoned twice, and the second attempt is the
 * interesting one. Raising the amplitude 2.2x moved the antero-posterior composite from 6.2 mm to
 * only 7.6 mm, because a process whose lattice turns over every 319 s has barely three degrees of
 * freedom in a fifteen-minute window; and widening the postural clamp from 29 mm to 34 mm moved it
 * by 0.05 mm, which proves the clamp was never what was holding it down.
 *
 * Work it the other way and the reason is structural. Measured, the balance band contributes
 * 4.87 mm of the 8.27 mm composite, so Duarte's fore-and-aft processes are carrying 6.7 mm.
 * Reaching Bates' 16.32 mm would need them to carry 15.6 mm — 2.3x more — which means either
 * 2.3x his 17 mm shift amplitude or roughly five times his 316 s shift rate. **Both contradict the
 * paper this layer implements.** Duarte's antero-posterior processes, implemented faithfully,
 * cannot produce Bates' antero-posterior composite.
 *
 * So the shortfall is recorded rather than tuned away. Duarte is the paper whose PROCESS this file
 * models, event by event; Bates is a composite from a different task — fifteen minutes of watching
 * a documentary, free to move, with only fidgets excised — and where the two conflict, the
 * process wins and the composite is reported. The lateral axis, which is the visible one, sits
 * inside Bates' interquartile range without any of this.
 *
 * They carry the same 1.75 anisotropy the balance band's own literature reports, so a slow wander
 * cannot quietly undo the anisotropy the balance band is gated on. Note this is the only place
 * that ratio is still used — see BALANCE_RMS_MEDIO_LATERAL_METRES.
 */
const DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES = 0.007;
const DRIFT_AMPLITUDE_MEDIO_LATERAL_METRES =
    DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES / BALANCE_ANISOTROPY_ANTERO_POSTERIOR_OVER_MEDIO_LATERAL;

/**
 * TUNING. How much of the trunk's lean the neck takes back, so the head stays nearer vertical
 * than the chest. Head stabilisation in quiet stance is real but weak — it is much stronger
 * during locomotion — and no coefficient for quiet standing is in the record. Set to 0 to sway
 * as a rigid plank, which is closer to the literature and slightly worse to look at.
 */
const HEAD_STABILISATION = 0.3;

/**
 * 🎯 TUNING, and the number that decides whether this layer has a lower body at all.
 *
 * The fraction of the total lean carried as a rigid rotation about the ankles. The remainder is
 * shared down the spine by SPINE_SHARE. The posturography literature treats quiet-stance balance
 * as a SINGLE inverted pendulum — 1.0 here — and a value near that is what makes the pelvis,
 * knees and feet move at all.
 *
 * It is not set to exactly 1.0 because a perfectly rigid plank reads as a mannequin on a hinge:
 * multi-segment models of quiet stance do find a small trunk contribution in phase with the
 * ankle, and 15% of the lean spread over three spine joints is under a hundredth of a degree
 * each — invisible as a bend, but enough to keep the silhouette from looking welded.
 */
const PENDULUM_ANKLE_SHARE = 0.85;

/**
 * TUNING. How the spine's small remaining share is distributed. Weighting the lower spine most
 * makes what little trunk motion there is start from the base rather than fold in the middle.
 */
const SPINE_SHARE = [ 0.5, 0.3, 0.2 ];

/**
 * 🎯 Where the pendulum pivots, as a fraction of the way from the sole to the ankle joint. 1.0 is
 * the talocrural joint itself; 0.0 is the floor.
 *
 * The anatomical pivot is the ankle joint, and a pivot exactly there is also geometrically tidy:
 * the ankle does not move, the foot is held at its rest orientation, so the SOLE IS PLANTED FOR
 * FREE. That is what 1.0 buys, and it is why the value is 1.0.
 *
 * 🚩 It used to be 0.5, and the reasoning for that is worth keeping because it was good reasoning
 * that stopped being true. A real foot is not a rigid link welded to the ground: the heel pad
 * compresses as the centre of pressure travels under it, and the shank's instantaneous centre of
 * rotation sits a little below the malleolus. The midpoint of the two defensible extremes was
 * chosen to be honest about that, and it cost the ankle a tenth of a millimetre of path — well
 * inside skin compliance, invisible, a fair price for a more truthful model.
 *
 * Then the re-rooting multiplied the lean by about six, and the price went with it. The sole sits
 * 29 mm below a half-way pivot, so it slides by 29 mm times the lean; measured over 900 s the
 * worst sole slide went from 0.54 mm to **2.49 mm**, which is a foot visibly skating on the floor.
 * A 2.5 mm lie about where the foot is, is a worse lie than a sub-millimetre one about where the
 * heel pad compresses. Moving the pivot to the joint takes the default configuration's worst
 * slide to 0.16 mm.
 *
 * What is left is second order and unavoidable for a rigid rotation: the two ankles are 181 mm
 * apart, so a frontal-plane lean of θ moves each of them 181 mm × (1 − cos θ) horizontally. At
 * the largest lean this layer produces that is 0.29 mm, and no choice of pivot height removes it —
 * only foot IK would.
 */
const PIVOT_HEIGHT_FRACTION_OF_ANKLE = 1.0;

/**
 * The upper bound on how far toward full contrapposto a weight shift may blend.
 *
 * The blend is solved, not tuned: the medio-lateral half of the shift process states where the
 * centre of pressure went, the pose's own centre-of-mass response per unit blend is measured on
 * the actual rig at bind, and the blend is the ratio. At the ML posture clamp that solve lands
 * near 1.15 on this rig — the clamp, not this limit, is what normally bounds it.
 *
 * 🚩 So this is a safety rail rather than a design parameter, and it is set to 1.0 because a
 * blend past 1.0 extrapolates BEYOND the authored pose: the poses were drawn by eye at blend 1
 * and nothing about them stays sensible past it. Before this file was re-rooted the limit was
 * 0.20 and it was load-bearing, which was a sign the solve was being asked for the wrong thing.
 */
const STANCE_BLEND_LIMIT = 1.0;

/**
 * 🎯 THE FRACTION OF MEDIO-LATERAL BALANCE THE ANKLE CARRIES — WHICH IS ZERO ONLY IF THE FEET ARE
 * PARALLEL, AND THEY ARE NOT.
 *
 * 🚩 This file already cites Winter, Prince, Frank, Powell & Zabjek 1996 for the claim that lateral
 * balance is a hip mechanism, and that claim is a row of Winter's table rather than the whole of
 * it. The abstract states the rows separately and they are not the same:
 *
 *   *"In SIDE-BY-SIDE STANCE, A/P balance is totally under ankle (plantar/dorsiflexor) control,
 *   whereas M/L balance is under hip (abductor/adductor) control."*
 *
 *   *"In an INTERMEDIATE 45 degrees stance position, BOTH ankle and hip mechanisms contribute to
 *   the net balance control in totally different ways. IN THE M/L DIRECTION THE TWO STRATEGIES
 *   REINFORCE... the ankle control is not orthogonal to the load/unload line; rather, it acts at
 *   an angle of approximately 60 degrees."*
 *
 * The side-by-side row was implemented on a figure that does not stand side by side.
 * `relaxed-standing.json` turns the femurs out by 9.56° and 9.06° — an included foot angle of
 * 18.6°, which is McIlroy & Maki's preferred stance and is also Quijoux's own protocol ("feet at
 * 20°"). §1.7d, again, and on the same paper: *a citation delivered in support of one claim can be
 * the answer to a different one*, and this time the different one was two sentences further down.
 *
 * 🎯 THE SHARE IS DERIVED, NOT SET. The ankle mechanism acts along ONE control line. Its magnitude
 * is already decided — it carries the whole of the antero-posterior balance, which this layer
 * authors at Quijoux's 4.9 mm — so the only free quantity is the line's direction, and Winter gives
 * that: the line rotates away from antero-posterior as the stance opens. Reading his 45° stance as
 * 45° BETWEEN THE FEET, the line has rotated 30° for 22.5° of toe-out per foot, so it turns 1.333×
 * the foot; reading it as 45° per foot gives 0.667×. This figure's 9.31° mean toe-out therefore
 * puts the line 6.2° to 12.4° off antero-posterior, and the ankle's lateral contribution is
 * `4.9 mm × tan(that)` = 0.53 to 1.08 mm against a lateral balance amplitude of 3.0 mm.
 *
 * ⚠️ THE LOW READING IS TAKEN, on the same principle as the elderly-cohort correction above: where
 * an ambiguity in a source spans a range, author at the end that claims less. 0.53 / 3.0 = 0.18.
 *
 * ⚠️ AND IT IS A SHARE OF THE WHOLE LATERAL SIGNAL, not of the balance band alone, which is the one
 * place this goes beyond Winter. He measured quiet stance; the weight-shift process is Duarte's and
 * Winter says nothing about it. Applying the share to the composite is the simpler model and is
 * conservative in the direction that matters — a weight shift routed through the ankle moves the
 * head further than one routed through the hip, and the head/centre-of-mass gate is what bounds
 * that. It closes at 1.00 either way because `lateralRightingPerRadian` is solved against the
 * realised mechanism mix.
 */
const MEDIO_LATERAL_ANKLE_SHARE = 0.18;

/**
 * 🎯 How much of the head's LATERAL overshoot the pendulum's own lumbar counter-bend takes back.
 *
 * The lateral signal is supposed to go through the hip mechanism, and mostly it does — but the
 * contrapposto saturates. A unit blend moves the centre of mass 32.1 mm to the left or 34.7 mm to
 * the right, and the medio-lateral command reaches 52 mm on a bad seed: two of Duarte's mean shifts
 * plus a balance band on top. Whatever the pose cannot deliver falls through to the pendulum, and
 * measured over four 900 s traces that is **16 to 29 per cent of frames** carrying up to **19.8 mm**
 * of centre-of-mass travel on an ankle mechanism that Winter says has almost no lateral authority.
 *
 * It is visible in exactly the way the judge described. The pendulum is a rigid rotation, so it
 * moves the head 1.674x as far as the centre of mass, where the contrapposto moves it 1.00x — so
 * the head/pelvis ratio is fine in RMS (0.88-0.96) and wrong at the PEAKS (0.99-1.16), and peaks
 * are what a viewer sees.
 *
 * 🚩 The fix is NOT to give the pendulum a bigger share or the pose a bigger blend. It is that head
 * stabilisation is a reflex about the HEAD, not about the hips: whichever mechanism moves the body
 * sideways, the righting reflex parks the head over the base of support. So the head's lateral
 * response must not depend on which internal mechanism happened to deliver the displacement, and
 * this target is shared with the contrapposto's own `STANCE_TRUNK_RIGHTING`.
 *
 * ⚠️ MEDIO-LATERAL ONLY. Fore-and-aft the inverted pendulum is right and the head really does travel
 * further than the centre of mass; that is what `headPerCentreOfMass` still gates against the rig's
 * raw height ratio. Applying this on both axes would break the one mechanism this file gets right.
 *
 * 🎯 THE TARGET IS A RATIO AND IT IS SOLVED, NOT SET. Writing it as "cancel the measured overshoot"
 * is the obvious thing and it is wrong by a third, because the counter-bend moves the CENTRE OF MASS
 * as well as the head — it is rotating half the body's mass. Measured on the contrapposto: an extra
 * unit of righting moves the head 23.2 mm and the centre of mass 5.9 mm, so cancelling the whole
 * overshoot lands the head 17% short of where the centre of mass ends up. The angle is therefore
 * found by secant iteration on the realised ratio, which converges in one step because the relation
 * is linear, and the residual is asserted by the selftest rather than assumed.
 *
 * 🚩 That is also, retrospectively, what the old hand-tuned STANCE_TRUNK_RIGHTING = 1.35 was: not a
 * number someone liked, but the fixed point of exactly this equation, found by eye and recorded as
 * a tuning constant. Solving it makes it survive a change to the poses or the rig.
 */
const LATERAL_HEAD_PER_CENTRE_OF_MASS = 1.0;

/**
 * How many passes the righting solve takes. The relation between the counter-bend angle and the
 * realised head/centre-of-mass ratio is linear, so a secant step from two probes lands on it: one
 * pass to measure the mechanism as authored, one at a first guess, one to land, one to leave the
 * measured residual in the layer for the gate to read.
 */
const RIGHTING_SOLVE_PASSES = 4;

/**
 * The lean the pendulum response is measured at during bind, in radians.
 *
 * A rigid rotation is exactly linear in the angle to first order and the runtime never exceeds
 * about 0.01 rad — a centimetre of centre-of-mass travel on a metre of lever — so the probe sits
 * at the top of the range the layer actually uses. Probing much larger would start to measure the
 * cosine term; probing much smaller would start to measure float32 bone positions.
 */
const PENDULUM_PROBE_RADIANS = 0.01;

/**
 * The blend the pose's CENTRE-OF-MASS and HEAD response is measured at during bind.
 *
 * Those two really are almost linear in the blend — measured across 0.05 to 1.0 the per-unit
 * centre-of-mass response varies by 0.3%, and the selftest's loop-closure section confirms the
 * realised centre of mass lands within 0.4–1.6% of where it was commanded — so a single probe is
 * enough for them, and it sits at half blend to keep the worst case symmetric.
 */
const STANCE_RESPONSE_PROBE_BLEND = 0.50;

/**
 * 🚩 The blends the pose's ANKLE response is measured at, which is a different question and was
 * got wrong once.
 *
 * The ankle is NOT linear in the blend, and the reason is structural rather than incidental: the
 * contrapposto poses differ at the hip by tens of degrees and are combined by slerp, so a foot on
 * the end of that chain rides an arc. A single probe scaled linearly is fine while the runtime
 * stays near it — the version this replaced probed at 0.10 and capped the blend at 0.20 — but the
 * re-rooting raised the cap to 1.0 and the runtime now saturates there, extrapolating 2x past a
 * 0.5 probe. Measured error at blend 1.0: **+1.5 to +2.0 mm of vertical**, which is a foot leaving
 * the floor, and it failed the planting gate by 40x.
 *
 * The fix is a table rather than a bigger single probe, because the curvature does not go away —
 * it only gets averaged differently. Piecewise-linear error falls with the SQUARE of the spacing,
 * so eight intervals cut the 2 mm to about 0.008 mm, comfortably inside the gate's 0.05 mm, and
 * eight extra probes cost nothing: this runs once, at bind.
 *
 * The pelvis needs no table. `stanceHipsOffset` is a straight lerp between two authored offsets,
 * so it is exactly linear by construction.
 */
const STANCE_ANKLE_PROBE_COUNT = 8;

/**
 * 🎯 How much of the contrapposto's head overshoot is taken back by an extra lumbar counter-bend.
 *
 * The authored contrapposto moves the pelvis 38 mm and the head 57 mm per unit blend — the head
 * travels 1.5x as far. That is a defensible shape for a POSED stance and the wrong one for a
 * BALANCE-DRIVEN shift, and a visual judge caught it on a 7-minute clip before anyone looked at
 * the code: the head listed 127 mm peak-to-peak against a pelvis moving 50 mm, which reads as
 * someone going slightly at the knees rather than as someone shifting their weight.
 *
 * A real lateral weight shift is the other way round. The pelvis stacks over the loaded foot and
 * travels furthest; the lumbar spine counter-bends; the righting reflex parks the head near where
 * it already was, over the base of support. That is the long S every life class teaches, and the
 * pose file describes it correctly in prose — "the lumbar spine bends back the other way to bring
 * the head over the support" — while its measured angles do not deliver it.
 *
 * It is expressed as a FRACTION of the measured overshoot rather than as an angle, so it stays right
 * if the poses are re-authored: 0 leaves the pose exactly as drawn, 1.0 lands the head where the
 * centre of mass lands, and above 1.0 the head travels less than the centre of mass. The pose is
 * left alone deliberately — a deliberate contrapposto and an involuntary balance correction are
 * different behaviours that happen to share a shape, and only the second one wants its head parked.
 *
 * 🎯 IT IS NO LONGER A FRACTION. It was 1.35 — a tuning constant with no support — and it is now
 * the solved angle that lands the head where the centre of mass lands, against the shared target
 * `LATERAL_HEAD_PER_CENTRE_OF_MASS`. See that constant for why the obvious "cancel the measured
 * overshoot" is wrong by a third, and for why 1.35 was in fact the fixed point of this same
 * equation found by eye.
 *
 * 🚩 And it is solved PER SIDE. The two contrapposto poses are deliberately asymmetric and their
 * overshoots differ by a fifth, so one angle averaged over both left the left side parked (head over
 * centre of mass 0.996) and the right side still overshooting (1.095). Averaging two measurements
 * that were taken separately, and are applied separately, buys nothing.
 */

/**
 * 🎯 How far the toes lift off the floor when a foot is fully unloaded, in degrees of extension at
 * the metatarsophalangeal joint.
 *
 * TUNING, with no published amplitude, and stated as EXTENSION ONLY on purpose. A loaded foot's toes
 * are already flat on the floor and have nowhere to go; what a life class draws, and what a camera
 * sees, is the FREE foot — its toes relax and come off the ground a millimetre or two while the
 * stance foot stays pressed. Driving it from unloading rather than from loading is therefore both
 * the truthful direction and the safe one: the toes can only ever move away from the floor, so no
 * amount of this can push geometry through it.
 *
 * It is applied at the toe joint, which is the metatarsal head, so the joint itself does not move —
 * only the geometry beyond it rotates. That is what keeps it clear of the planting gate entirely:
 * every marker that gate follows, ankle and toe joint alike, is at or behind this pivot.
 *
 * Two and a half degrees lifts the tip of a 234 mm foot by about 2 mm at full unload, and the
 * contrapposto reaches full blend on a sixth of frames. The selftest prints the realised angle
 * rather than trusting this number.
 */
const TOE_UNLOAD_LIFT_DEGREES = 2.5;

/**
 * 🎯 THE OTHER THING THAT UNLOADS A TOE, AND THE ONE THAT NEVER STOPS: THE CENTRE OF PRESSURE
 * MOVING FORE AND AFT UNDER THE FOOT.
 *
 * 🚩 Read this next to the constant above, because between them they are the difference between a
 * foot that articulates ONCE A CLIP and a foot that articulates all the time, and the round before
 * this one shipped only the first.
 *
 * The lateral unload is a fine mechanism and it has a fatal duty cycle. `unloadFractionOf` is the
 * stance blend, and the free foot's yaw release is a fraction OF A CHAIN YAW THAT IS ITSELF
 * PROPORTIONAL TO THAT BLEND — so everything below the ankle scales as the SQUARE of the load
 * transfer. Measured on the shipped layer, seed 1, 420 s at 30 Hz, in the foot band (rows 1110-1176
 * of a 1200 px capture, -47 to +54 mm about the floor): the median travel inside a 15 s window is
 * **0.223 px on the worst single vertex and 0.074-0.138 px on either foot's centroid**, while the
 * WHOLE-CLIP range is 1.7-3.5 px. The clip's entire range is spent inside one window — the median
 * and the range disagree by a factor of twenty-five, which is LEARNINGS §1.11 and §1.14 in one
 * measurement. |stanceBlend| swings 0.213 in a median 15 s window, and 0.213 squared is 0.045.
 *
 * Fore-and-aft there is a driver with no duty-cycle problem at all. Quiet stance IS an ankle
 * strategy: the centre of pressure travels fore and aft under the feet continuously, and this
 * layer's own antero-posterior signal measures a **25.25 mm median sliding-window swing** over the
 * same 420 s, with the QUIETEST window still at 15.35 mm. That is 4-5 cycles of Quijoux's 0.27 Hz
 * mode inside every glance, on both feet, whether or not a weight transfer ever happens.
 *
 * What it does to a toe is not subtle and needs no citation to state the DIRECTION: as the centre
 * of pressure moves back off the forefoot, the toes stop being pressed and relax into extension; as
 * it moves forward they are pressed flat again. Extension only, exactly as above, so this can no
 * more push geometry through the floor than the unload lift can.
 *
 * ⚠️ THE AMPLITUDE IS TUNING AND IS DELIBERATELY NOT A NEW MAGNITUDE. It is stated as a gain that
 * reaches `TOE_UNLOAD_LIFT_DEGREES` — the ceiling already argued above — at the rearmost centre of
 * pressure this layer can produce: the antero-posterior posture clamp (2.0 mean shifts = 34 mm on
 * this figure) plus three standard deviations of the balance band (3 x 4.9 = 14.7 mm), so 48.7 mm.
 * Nothing here claims a published toe angle; it claims that the fore-and-aft mechanism should reach
 * the same ceiling the lateral one does, at the extreme each of them can reach.
 */
const TOE_COP_REFERENCE_EXCURSION_METRES =
    POSTURE_OFFSET_MEAN_SHIFTS * SHIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES
    + 3 * BALANCE_RMS_ANTERO_POSTERIOR_METRES;

/**
 * 🎯 PLANTED IS A CONSEQUENCE OF LOAD, NOT A PROPERTY OF A FOOT — and getting that backwards is
 * what made both feet pixel-identical for 420 seconds.
 *
 * This layer computes a load transfer between the legs; that is the whole of the lateral model.
 * It then applied a foot constraint that ignored the transfer completely. `writePose` pinned BOTH
 * feet to their rest orientation and `writeFootPlanting` pinned BOTH ankles to their rest position,
 * so the free foot was held exactly as rigidly as the one carrying the body. Measured on the shipped
 * layer over 420 s, seed 1, at the framing `alive.js?frame=body` uses: the foot band's
 * outer-to-outer silhouette extent had a standard deviation of **0.024 px**, against this project's
 * own 1.6 px visibility floor. Nothing below the ankle moved except one toe on one foot.
 *
 * The floor does not freeze a foot. It constrains three of its six degrees of freedom — the height
 * of the sole, and the two rotations that would tilt the sole out of the floor plane. FRICTION
 * freezes the rest, and friction is a function of the load. So:
 *
 *   THE LOADED FOOT stays exactly as it was: position pinned, orientation pinned, sole flat. A foot
 *   carrying the body does not turn under it.
 *
 *   THE UNLOADED FOOT keeps the YAW the leg chain hands it — the transverse rotation about the rig's
 *   vertical, which maps the floor plane to itself and therefore cannot tilt or lift the sole by
 *   construction. That is a free foot turning out as the weight leaves it, which is what the pose
 *   files already describe ("free feet always splay wider") and what `writePose` was deleting.
 *
 * What is deliberately NOT released is the free foot's horizontal TRANSLATION, even though the
 * contrapposto poses author up to 20 mm of it and say so. §1.11b of LEARNINGS is the record of what
 * that looks like: 2.49 mm of sole slide read as a foot visibly skating. A rotation about the ankle
 * is a different motion from a translation of the whole foot — the ankle and the heel stay where
 * they are and the forefoot swings — and it is the one a real free foot makes.
 *
 * 1.0 keeps all of the chain's yaw at full unload. Set to 0 for the welded foot the judge reported;
 * the selftest builds exactly that to prove its own gate can see it.
 *
 * 🎯 THE FREE KNEE TURNS **IN**, DELIBERATELY — AND THIS HEADER SAID THE OPPOSITE FOR A ROUND.
 *
 * The free leg's release is delivered as a swivel about a near-vertical axis, so it presents mostly
 * as FEMORAL AXIAL ROTATION rather than as the foot turning on the floor. That much was right. The
 * DIRECTION written here was not, and the pose files it was supposedly derived from say so in
 * words: `weight-right.json`'s `leftUpperLeg` is *"Free leg, SWIVELLED … turned 16 degrees about
 * its own hip-to-ankle axis, which moves the knee 14.3 mm TOWARD THE MIDLINE"*. Medial. On purpose.
 *
 * Measured frame-free on figure_g050, seed 1, on the MESH rather than on an Euler angle — the
 * patella patch's own world-space facing, joint centre to patella centroid, against the
 * relaxed-standing rest:
 *
 *     state              free knee faces        loaded knee
 *     rest                 L +5.74   R -10.46          —
 *     LEFT leg free        L -6.30  (-12.04 deg)     +1.34
 *     RIGHT leg free       R  +0.09 (+10.55 deg)     -1.38
 *
 * Positive is toward +X, the character's LEFT. So the free knee turns 10-12 degrees TOWARD the
 * midline on both sides, and the loaded knee stays inside 1.4 — which is the asymmetry this whole
 * mechanism is for.
 *
 * 🚩 HOW THE SIGN GOT INVERTED, BECAUSE IT IS A TRAP THE NEXT READER WILL WALK INTO. There are two
 * different `+y` in play and they point opposite ways.
 *
 *   `relaxed-standing.json` writes `leftUpperLeg` `y = +9.56` and calls it external rotation. That
 *   is authored in the NORMALISED rig, where +Y is up, and it is correct: applying a further +14
 *   there swings the left patella from +5.74 to +19.66 and the left foot from +13.08 to +27.15 —
 *   OUT, exactly as the file says.
 *
 *   `sway.selftest.mjs` reported the swivel as the y term of `restWorld⁻¹ · currentWorld`, which is
 *   a delta in the BONE's own rest frame — and `thigh_l`'s local +Y points DOWN in world
 *   (0.017, -0.997, 0.078). A positive y there is a rotation about world −Y. The two `+y` are
 *   antiparallel, the header compared them as if they were the same axis, and the conclusion
 *   inverted. §1.7 is exactly this: a number carries a frame of reference, and these two did not
 *   share one.
 *
 * The measurement that settles it takes no frame at all: where does the patella POINT. That is now
 * what the selftest measures and gates, in `measureFreeLimbSwivel`.
 *
 * ⚠️ STILL FOR A PAIR OF EYES, and narrower than it was. The direction is settled and the pose
 * files own it; what no number here can answer is whether TWELVE DEGREES of medial femoral rotation
 * reads as a relaxed leg letting go — the free knee drifting in toward the stance leg, which is
 * what a life class draws — or as knock-kneed. Look at the free kneecap on a frame at full transfer
 * against the same frame at rest.
 */
const FREE_FOOT_YAW_RELEASE = 1.0;

/**
 * Rig-space anatomical axes, verified on figure_g050.glb (2026-08-07): +X is the character's
 * left-right axis, +Y is up, +Z is forward — the nose sits at z = +0.144 and the toes at
 * z = +0.139, against a heel at z = +0.022.
 *
 * A sagittal (forward/back) lean is therefore a rotation about +X, and a frontal (side-to-side)
 * lean is a rotation about +Z. A foot turning out on the floor is a rotation about +Y, and that is
 * the one rotation the floor does not constrain — see FREE_FOOT_YAW_RELEASE.
 */
const RIG_MEDIO_LATERAL_AXIS = new Vector3( 1, 0, 0 );
const RIG_FORWARD_AXIS = new Vector3( 0, 0, 1 );
const RIG_UP_AXIS = new Vector3( 0, 1, 0 );

/**
 * The chain this layer drives, parent first.
 *
 * This table IS the model. Read top to bottom it says: the pelvis carries the lean, the spine
 * takes a token share of it, the neck gives a little back, and both legs ride along so the
 * pendulum reaches the floor. `pendulum` names which of the four roles a joint plays.
 *
 * Arms, hands and the head itself are deliberately absent. The contrapposto poses do move the
 * upper arms by a couple of degrees and level the head, but at the blends this layer reaches
 * that is under half a degree, and claiming those channels would put Sway into a permanent
 * channel conflict with BodyIdle, IdleMotion and Gaze for a motion nobody can see.
 */
const SWAY_CHAIN = [
    { humanoid: 'hips', parent: null, pendulum: 'lean' },
    { humanoid: 'spine', parent: 'hips', pendulum: 'spine' },
    { humanoid: 'chest', parent: 'spine', pendulum: 'spine' },
    { humanoid: 'upperChest', parent: 'chest', pendulum: 'spine' },
    { humanoid: 'neck', parent: 'upperChest', pendulum: 'headStabilisation' },
    { humanoid: 'leftUpperLeg', parent: 'hips', pendulum: 'carried' },
    { humanoid: 'leftLowerLeg', parent: 'leftUpperLeg', pendulum: 'carried' },
    { humanoid: 'leftFoot', parent: 'leftLowerLeg', pendulum: 'plant' },
    { humanoid: 'rightUpperLeg', parent: 'hips', pendulum: 'carried' },
    { humanoid: 'rightLowerLeg', parent: 'rightUpperLeg', pendulum: 'carried' },
    { humanoid: 'rightFoot', parent: 'rightLowerLeg', pendulum: 'plant' },

    // 🎯 The toes, and the reason they are here at all. A judge watching 6300 frames reported the
    // feet as "pixel-for-pixel identical", and was right: planting is correct — the sole slides
    // 0.16 mm over fifteen minutes — but a foot with zero deformation reads as WELDED rather than
    // as standing. The toes are the only articulation below the ankle this rig has, and they are
    // driven by unloading alone. See TOE_UNLOAD_LIFT_DEGREES.
    { humanoid: 'leftToes', parent: 'leftFoot', pendulum: 'toes' },
    { humanoid: 'rightToes', parent: 'rightFoot', pendulum: 'toes' }
];

/** The two feet, and which pose loads each of them. Used for planting and for the stance blend. */
const STANCE_FEET = [
    { key: 'left', foot: 'leftFoot', shank: 'leftLowerLeg', toes: 'leftToes' },
    { key: 'right', foot: 'rightFoot', shank: 'rightLowerLeg', toes: 'rightToes' }
];

/**
 * The per-axis constants gathered into one shape, so `advanceAxis` reads as one process
 * parameterised by which axis it is running rather than as two copies of the same code.
 */
const MEDIO_LATERAL_SETTINGS = {
    key: 'medioLateral',
    fidgetRate: FIDGET_RATE_MEDIO_LATERAL,
    shiftRate: SHIFT_RATE_MEDIO_LATERAL,
    shiftAmplitude: SHIFT_AMPLITUDE_MEDIO_LATERAL_METRES,
    shiftAmplitudeSd: SHIFT_AMPLITUDE_MEDIO_LATERAL_SD_METRES,
    driftFrequencyHz: DRIFT_FREQUENCY_MEDIO_LATERAL_HZ,
    driftAmplitude: DRIFT_AMPLITUDE_MEDIO_LATERAL_METRES,

    // A weight shift is a LATERAL load transfer, so only this axis relays one. An antero-
    // posterior shift is a lean into or away from the conversation, and the arm swing a
    // consumer plays on the relay is a lateral motion that would read as a flinch if a
    // fore-and-aft shift triggered it.
    relaysWeightShift: true
};

const ANTERO_POSTERIOR_SETTINGS = {
    key: 'anteroPosterior',
    fidgetRate: FIDGET_RATE_ANTERO_POSTERIOR,
    shiftRate: SHIFT_RATE_ANTERO_POSTERIOR,
    shiftAmplitude: SHIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES,
    shiftAmplitudeSd: SHIFT_AMPLITUDE_ANTERO_POSTERIOR_SD_METRES,
    driftFrequencyHz: DRIFT_FREQUENCY_ANTERO_POSTERIOR_HZ,
    driftAmplitude: DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES,
    relaysWeightShift: false
};

/**
 * The clamp used when the rig has no feet to read a base of support from. Metres, and the same
 * two numbers the hand-set version of this file used, so a footless rig behaves as it used to.
 */
const FALLBACK_POSTURE_LIMIT_MEDIO_LATERAL_METRES = 0.030;
const FALLBACK_POSTURE_LIMIT_ANTERO_POSTERIOR_METRES = 0.022;

export class Sway extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.balanceRmsMedioLateralMetres=0.0030] - Wanted CENTRE-OF-PRESSURE
     *   RMS. The lean that puts the centre of mass there is solved for at bind; where the head
     *   ends up is an output. Quijoux's force-plate column.
     * @param {number} [options.balanceRmsAnteroPosteriorMetres=0.0049]
     * @param {number} [options.headStabilisation=0.3]
     * @param {number} [options.anklePendulumShare=0.85] - Fraction of the lean carried as a
     *   rigid rotation about the ankles. See PENDULUM_ANKLE_SHARE.
     * @param {number[]} [options.spineShare=[0.5,0.3,0.2]] - How the remaining share is spread
     *   down the three spine joints. Must sum to 1.
     * @param {boolean} [options.weightShiftsEnabled=true] - Turn off to measure the balance band
     *   on its own. The gates are stated against the layer AS CONSTRUCTED, not against this.
     * @param {boolean} [options.stanceBlendEnabled=true] - Turn off to keep the weight shifts as
     *   pure pendulum lean, without the contrapposto pose blend.
     * @param {boolean} [options.lateralRightingEnabled=true] - Turn off to run both lateral
     *   mechanisms without the lumbar counter-bend that parks the head. See
     *   LATERAL_HEAD_PER_CENTRE_OF_MASS.
     * @param {number} [options.medioLateralAnkleShare=0.18] - The fraction of the lateral signal
     *   the ANKLE carries rather than the hip, which is a function of how far the feet are turned
     *   out. Set to 0 for the parallel-feet case, which is the state the lower leg was measured
     *   dead in. See MEDIO_LATERAL_ANKLE_SHARE.
     * @param {number} [options.toeLiftDegrees=2.5] - Toe extension on a fully unloaded foot. Set to
     *   0 for the welded foot a visual judge reported; see TOE_UNLOAD_LIFT_DEGREES.
     * @param {boolean} [options.eventDurationScalesWithAmplitude=true] - Whether a postural event
     *   larger than its axis's mean amplitude takes proportionally longer, holding peak speed at the
     *   mean event's. Set to false for the fixed duration this file shipped with, which measured a
     *   49 mm centre-of-pressure move in half a second. See `eventStretch`.
     * @param {boolean} [options.toeCopLiftEnabled=true] - Whether the toes also respond to the
     *   centre of pressure travelling fore and aft under the foot. Set to false for the lateral
     *   mechanism alone, which is the foot whose articulation is QUADRATIC in the load transfer and
     *   therefore lives entirely inside a weight transfer. See TOE_COP_REFERENCE_EXCURSION_METRES;
     *   the selftest builds exactly that state to prove its own gate can see it.
     * @param {number} [options.freeFootYawRelease=1] - Fraction of the leg chain's yaw an UNLOADED
     *   foot is allowed to keep. Set to 0 to pin both feet as rigidly as each other, which is the
     *   welded foot the judge reported. See FREE_FOOT_YAW_RELEASE.
     * @param {Object} [options.fidget] - The fidget profile, whose three numbers are the least
     *   supported in this file and the ones that decide whether a postural event is legible at all:
     *   `{ amplitudeFraction, durationSeconds, riseFraction }`. See
     *   FIDGET_AMPLITUDE_FRACTION_OF_SHIFT and FIDGET_DURATION_SECONDS.
     * @param {boolean} [options.frameCoupledArrivals=false] - Set to true to advance the fidget and
     *   shift processes with one Bernoulli draw per FRAME, the way this layer used to. The event
     *   rate stays correct and the trajectory becomes a function of the frame rate; it is the
     *   defect the FRAME-RATE INVARIANCE gate exists to catch, and the selftest builds it.
     * @param {number} [options.driftScale=1] - Scales the slow drift. Set to 0 to isolate the
     *   processes that are pinned to published amplitudes; see DRIFT_AMPLITUDE_*.
     * @param {Function} [options.onWeightShift] - Called as `({ magnitude, axis, pattern })` at
     *   the instant a lateral postural event begins. `magnitude` is the drawn amplitude over
     *   Duarte's measured mean, signed by direction, which is what BodyIdle.onWeightShift()
     *   wants; `pattern` is 'shift' or 'fidget'.
     * @param {string} [options.referenceBone='head'] - The marker whose excursion is REPORTED.
     *   It is an output, not an input: nothing is solved to land it anywhere.
     * @param {Object} [options.bones] - Overrides for the figure bone behind any humanoid name
     *   in SWAY_CHAIN, e.g. `{ hips: 'root_hips' }`. Everything not named keeps the standard
     *   mapping.
     */
    constructor( options = {} ) {

        const boneNameOf = ( humanoidName ) =>
            options.bones?.[ humanoidName ] ?? HUMANOID_TO_FIGURE_BONE[ humanoidName ];

        super( {
            name: options.name ?? 'sway',
            order: MOTION_ORDER.SWAY,
            boneChannels: SWAY_CHAIN.map( ( joint ) => boneNameOf( joint.humanoid ) )
        } );

        this.referenceBoneName = options.referenceBone ?? HUMANOID_TO_FIGURE_BONE.head;

        this.anklePendulumShare = options.anklePendulumShare ?? PENDULUM_ANKLE_SHARE;
        this.spineShare = options.spineShare ?? SPINE_SHARE;
        this.headStabilisation = options.headStabilisation ?? HEAD_STABILISATION;

        this.balanceRmsMedioLateral = options.balanceRmsMedioLateralMetres ?? BALANCE_RMS_MEDIO_LATERAL_METRES;
        this.balanceRmsAnteroPosterior = options.balanceRmsAnteroPosteriorMetres ?? BALANCE_RMS_ANTERO_POSTERIOR_METRES;

        // Overridable so a gate can isolate one process at a time. The drift amplitude is the
        // only unpinned number in the weight-shift half of this file; see its constant.
        this.driftScale = options.driftScale ?? 1;

        this.weightShiftsEnabled = options.weightShiftsEnabled ?? true;
        this.stanceBlendEnabled = options.stanceBlendEnabled ?? true;

        // The pre-fix arrival mechanism, kept only so the invariance gate has a known-bad. See
        // `advanceAxis`, and `Signals.poissonEventOccurs` for why it is wrong.
        this.frameCoupledArrivals = options.frameCoupledArrivals ?? false;

        // Turn off to run both lateral mechanisms as they were before the head was parked — the
        // contrapposto exactly as drawn, the pendulum as a rigid rotation. That is the state a
        // visual judge measured at head/hip 1.34, and the selftest builds it deliberately to prove
        // the ratio gates can see it.
        this.lateralRightingEnabled = options.lateralRightingEnabled ?? true;

        // Set to 0 for the side-by-side row of Winter's table, which is what this layer implemented
        // on a figure standing at 18.6° of toe-out. See MEDIO_LATERAL_ANKLE_SHARE.
        this.medioLateralAnkleShare = options.medioLateralAnkleShare ?? MEDIO_LATERAL_ANKLE_SHARE;

        this.toeLiftDegrees = options.toeLiftDegrees ?? TOE_UNLOAD_LIFT_DEGREES;
        this.toeCopLiftEnabled = options.toeCopLiftEnabled ?? true;

        // Set to false for the fixed event duration this file shipped with, which divides a
        // lognormal amplitude by a constant and lets the distribution's tail out as SPEED. See
        // `eventStretch`; the selftest builds exactly that to prove its own peak gate can see it.
        this.eventDurationScalesWithAmplitude = options.eventDurationScalesWithAmplitude ?? true;

        // Set to 0 for the welded foot a visual judge reported and measured at 0.024 px of
        // silhouette travel; see FREE_FOOT_YAW_RELEASE.
        this.freeFootYawRelease = options.freeFootYawRelease ?? FREE_FOOT_YAW_RELEASE;

        this.fidget = {
            amplitudeFraction: options.fidget?.amplitudeFraction ?? FIDGET_AMPLITUDE_FRACTION_OF_SHIFT,
            durationSeconds: options.fidget?.durationSeconds ?? FIDGET_DURATION_SECONDS,
            riseFraction: options.fidget?.riseFraction ?? FIDGET_RISE_FRACTION
        };

        // Where the centre of mass is, for whatever pose the rig is in. This is what makes every
        // published centre-of-pressure amplitude in this file mean something on this figure.
        this.bodyMass = new BodyMass( { bones: options.bones } );

        /** Called at the instant a lateral shift begins. See the constructor options. */
        this.onWeightShift = options.onWeightShift ?? null;

        this.elapsedSeconds = 0;

        // The three signals, all in CENTRE-OF-PRESSURE metres — where this body's centre of mass
        // is being asked to stand, which is the quantity every paper behind this file measured.
        // Kept apart because the two processes are gated against different papers measured under
        // different protocols, and because a critic reading "the avatar drifted 30 mm" needs to
        // know which process did it.
        this.balanceDisplacement = new Vector3();  // continuous, Quijoux's quiet-standing spectrum
        this.postureDisplacement = new Vector3();  // fidget + shift + drift, Duarte's processes
        this.displacement = new Vector3();         // the sum, which is what gets posed

        // What is left for the pendulum once the contrapposto blend has delivered its share.
        this.pendulumDisplacement = new Vector3();

        // Signed: positive blends toward 'weight-left', negative toward 'weight-right'.
        this.stanceBlend = 0;

        // Per-axis weight-shift state. Two identical structures rather than one interleaved
        // one, because AP and ML are independent processes with different measured rates. Each
        // carries its own settings so the shared advance/shift code never has to ask which axis
        // it is running.
        this.medioLateral = createAxisState( MEDIO_LATERAL_SETTINGS, FALLBACK_POSTURE_LIMIT_MEDIO_LATERAL_METRES );
        this.anteroPosterior = createAxisState( ANTERO_POSTERIOR_SETTINGS, FALLBACK_POSTURE_LIMIT_ANTERO_POSTERIOR_METRES );

        this.eventCounts = { fidget: 0, shift: 0, discourseShift: 0 };

        // Built in onBind from the layer's own stream, so a reset reproduces the run exactly.
        this.balanceNoise = { medioLateral: [], anteroPosterior: [] };
        this.driftNoise = { medioLateral: null, anteroPosterior: null };

        // The poses the weight shift blends between. Compiled once here rather than at bind
        // because they are figure-independent: a pose is a statement in the normalised humanoid
        // frame and costs nothing to hold.
        this.relaxedPose = RestPose.load( 'relaxed-standing' );
        this.stancePoses = { left: RestPose.load( 'weight-left' ), right: RestPose.load( 'weight-right' ) };

        // One entry per driven joint, in SWAY_CHAIN order, each holding its bone name, its role,
        // its rest frame and its own preallocated scratch. Built here, filled at bind.
        this.joints = SWAY_CHAIN.map( ( entry ) => createJointState( entry, boneNameOf( entry.humanoid ) ) );
        this.jointsByHumanoid = new Map( this.joints.map( ( joint ) => [ joint.humanoid, joint ] ) );

        this.accumulateRelaxedPose();

        // The two feet, with the per-frame planting arithmetic they each need.
        this.feet = STANCE_FEET.map( ( foot ) => ( {
            key: foot.key,
            joint: this.jointsByHumanoid.get( foot.foot ),
            shank: this.jointsByHumanoid.get( foot.shank ),
            toes: this.jointsByHumanoid.get( foot.toes ),
            pendulumArm: new Vector3()
        } ) );

        // The way back, so the joint loop in writePose can ask a foot how loaded it is without
        // searching for it every frame.
        for ( const foot of this.feet ) foot.joint.foot = foot;

        // What each foot is doing this frame, in radians. Reported so a gate can read the realised
        // angles rather than recompute them from the blend: `toeLiftRadians` is the extension at the
        // metatarsal head, `footYawRadians` the turn-out the foot's own unloading released.
        this.toeLiftRadians = { left: 0, right: 0 };
        this.footYawRadians = { left: 0, right: 0 };

        // Bind-time rig facts.
        this.pivot = new Vector3();               // where the pendulum turns, in rig space
        this.pelvisArm = new Vector3();           // pelvis rest position relative to the pivot
        this.pelvisParentFrameInverse = new Quaternion();
        this.pendulumPlanted = false;             // false on a rig with no feet to pivot about

        // 🎯 The lever the lean is SOLVED against: centre-of-mass displacement per radian, per
        // axis. It is the centre of mass and not the head because the amplitudes this layer is
        // given are centre-of-pressure amplitudes, and a sustained centre of pressure IS the
        // centre of mass. Measured on the rig at bind rather than derived — see
        // measurePendulumResponse.
        this.centreOfMassLever = { anteroPosterior: 1, medioLateral: 1 };

        // Reported, never solved against: how far the head goes per radian, and per unit of
        // centre-of-mass travel. The second is the number the old POSTURE_HEAD_TRANSFER was
        // guessing at, and having it measured is the whole point of the re-rooting.
        //
        // 🎯 It is the ANTERO-POSTERIOR ratio, because that is the axis the inverted pendulum
        // governs and the only one where a rigid-plank prediction is the right thing to check
        // against. The lateral figure is reported beside it and is a different claim entirely —
        // see LATERAL_HEAD_PER_CENTRE_OF_MASS.
        this.headLever = { anteroPosterior: 1, medioLateral: 1 };
        this.headPerCentreOfMass = 1;
        this.headPerCentreOfMassLateral = 1;

        // The lumbar counter-roll the pendulum adds per radian of LATERAL lean, sized at bind from
        // the rig's own measured overshoot. See LATERAL_HEAD_PER_CENTRE_OF_MASS.
        this.lateralRightingPerRadian = 0;

        // Per-unit-blend response of the contrapposto, measured on this rig at bind.
        this.stanceResponse = {
            left: createStanceResponse(),
            right: createStanceResponse()
        };

        // Sized at bind from each pose's own measured overshoot. See STANCE_TRUNK_RIGHTING.
        this.trunkRightingRadians = { left: 0, right: 0 };

        this.ankleRotation = new Quaternion();
        this.scratchRigRotation = new Quaternion();
        this.scratchAxisRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();
        this.scratchDisplacement = new Vector3();
        this.scratchOffset = new Vector3();
        this.scratchStance = new Vector3();
        this.scratchPelvisTravel = new Vector3();
        this.scratchCentreOfMass = new Vector3();

    }

    // --- action -----------------------------------------------------------------------------

    /**
     * Tells the layer that the conversation just crossed a boundary. Call this from the dialogue
     * layer at the moment the topic turns, NOT on a schedule — see the file header.
     *
     * @param {Object} [boundary]
     * @param {boolean} [boundary.speakerChanged=false] - True when the boundary coincides with a
     *   change of speaker, which is the case Cassell measured at 26%. A turn boundary that is not
     *   a discourse boundary is the 8% case.
     * @returns {boolean} Whether a shift was actually triggered. Most boundaries produce none;
     *   that is the finding, not a bug.
     */
    markDiscourseBoundary( { speakerChanged = false } = {} ) {

        if ( this.random === null ) return false;

        const probability = speakerChanged
            ? SHIFT_PROBABILITY_AT_SPEAKER_CHANGE
            : SHIFT_PROBABILITY_AT_PLAIN_TURN_BOUNDARY;

        if ( this.random.chance( probability ) === false ) return false;

        // A posture shift is a whole-body event, so both axes move. ML carries the larger
        // amplitude, which is what a weight transfer onto one leg looks like.
        this.beginShift( this.medioLateral );
        this.beginShift( this.anteroPosterior );

        this.eventCounts.discourseShift ++;

        return true;

    }

    onBind( context ) {

        this.buildNoise();
        this.buildSchedules();
        this.bodyMass.bind( context.target );
        this.resolveRigGeometry( context.target );
        this.measurePendulumResponse( context.target );
        this.measureStanceResponse( context.target );

    }

    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        this.elapsedSeconds += deltaSeconds;

        this.balanceDisplacement.set(
            this.sampleBalanceBand( this.balanceNoise.medioLateral, this.balanceRmsMedioLateral ),
            0,
            this.sampleBalanceBand( this.balanceNoise.anteroPosterior, this.balanceRmsAnteroPosterior )
        );

        if ( this.weightShiftsEnabled ) {

            this.advanceAxis( this.medioLateral, deltaSeconds );
            this.advanceAxis( this.anteroPosterior, deltaSeconds );

        }

        // Both processes are already in centre-of-pressure metres, so there is nothing to
        // convert. That is the point of the re-rooting: there used to be a coefficient here.
        this.postureDisplacement.set(
            this.weightShiftsEnabled ? this.medioLateral.displacement : 0,
            0,
            this.weightShiftsEnabled ? this.anteroPosterior.displacement : 0
        );

        this.displacement.copy( this.balanceDisplacement ).add( this.postureDisplacement );

        // The contrapposto delivers the lateral part of the weight shift as an articulated
        // pose; whatever it does not deliver — all of the balance band, and the fore-and-aft
        // posture — is left for the pendulum. Splitting it here rather than adding the two is
        // what keeps the centre of mass landing exactly where `displacement` says it should.
        this.stanceBlend = this.solveStanceBlend();
        this.resolvePendulumDisplacement();

        this.writePose();

        return this.contribution;

    }

    reset() {

        this.elapsedSeconds = 0;

        this.balanceDisplacement.set( 0, 0, 0 );
        this.postureDisplacement.set( 0, 0, 0 );
        this.displacement.set( 0, 0, 0 );
        this.pendulumDisplacement.set( 0, 0, 0 );

        this.stanceBlend = 0;

        this.toeLiftRadians = { left: 0, right: 0 };
        this.footYawRadians = { left: 0, right: 0 };

        // The clamp is a fact about the rig's base of support, read at bind, so it survives a
        // reset — rebuilding it from the fallback here would silently narrow the stance on
        // every reset and only show up as a slow drift in the gate matrix.
        this.medioLateral = createAxisState( MEDIO_LATERAL_SETTINGS, this.medioLateral.limit, this.medioLateral );
        this.anteroPosterior = createAxisState( ANTERO_POSTERIOR_SETTINGS, this.anteroPosterior.limit, this.anteroPosterior );

        // A reset outside the stack does not re-run `onBind`, so the carried schedules are rewound
        // here. In the stack's own reset path `onBind` replaces them a moment later with schedules
        // on freshly forked streams, which is the stronger rewind of the two.
        for ( const axis of [ this.medioLateral, this.anteroPosterior ] ) {

            axis.fidgets?.reset();
            axis.shifts?.reset();

        }

        this.eventCounts = { fidget: 0, shift: 0, discourseShift: 0 };

    }

    // --- signal -------------------------------------------------------------------------------

    /**
     * Noise tables are drawn from the layer's own stream at bind, which MotionStack rewinds
     * before every reset — so the same seed gives the same 60 seconds of sway, every run.
     */
    buildNoise() {

        const seedFor = () => this.random.integer( 0, 0x7fffffff );

        this.balanceNoise.medioLateral = BALANCE_BANDS_MEDIO_LATERAL.map(
            ( band ) => ( { band, noise: new CoherentNoise1D( seedFor(), 512 ) } ) );

        this.balanceNoise.anteroPosterior = BALANCE_BANDS_ANTERO_POSTERIOR.map(
            ( band ) => ( { band, noise: new CoherentNoise1D( seedFor(), 512 ) } ) );

        this.driftNoise.medioLateral = new CoherentNoise1D( seedFor(), 512 );
        this.driftNoise.anteroPosterior = new CoherentNoise1D( seedFor(), 512 );

    }

    /**
     * The four arrival processes — fidget and shift on each axis — each on its own named stream.
     *
     * 🎯 FOUR STREAMS AND NOT ONE. Sharing a stream would put the draw order at the mercy of which
     * process happened to fire first inside a given frame, and which frame a firing lands in is a
     * function of dt. The whole dt-invariance argument would then hold only until two arrivals fell
     * inside the same frame — expected about once every 900 s at 30 Hz, which is exactly often
     * enough to poison a long gate and never often enough to be reproduced by hand.
     *
     * Built here rather than in the constructor because `this.random` does not exist until the
     * stack forks it, and rebuilt on every bind because `MotionStack.reset()` rewinds the stream
     * and then calls `onBind` again — so a reset genuinely replays the same arrivals.
     */
    buildSchedules() {

        this.medioLateral.fidgets = new PoissonSchedule( this.random.fork( 'medioLateral.fidget' ) );
        this.medioLateral.shifts = new PoissonSchedule( this.random.fork( 'medioLateral.shift' ) );
        this.anteroPosterior.fidgets = new PoissonSchedule( this.random.fork( 'anteroPosterior.fidget' ) );
        this.anteroPosterior.shifts = new PoissonSchedule( this.random.fork( 'anteroPosterior.shift' ) );

    }

    sampleBalanceBand( bands, rmsMetres ) {

        let total = 0;

        for ( const { band, noise } of bands ) {

            total += band.weight * noise.at( this.elapsedSeconds * band.frequencyHz );

        }

        return total * ( rmsMetres / BALANCE_BAND_UNIT_RMS );

    }

    /**
     * One axis of weight-shift behaviour for one frame: the slow drift, any fidget in progress,
     * the settled shift baseline, and the arrivals that start new events.
     *
     * 🎯 THE FRAME IS WALKED IN SUB-INTERVALS SPLIT AT EACH ARRIVAL, AND THAT IS THE WHOLE POINT.
     *
     * The version this replaced asked `poissonEventOccurs(rate, dt)` twice per axis per frame. The
     * rate that produced was correct at any frame rate — the probability form is exact — and the
     * TRAJECTORY was not, because four random draws per frame means the stream advances at the
     * frame rate. Measured, seed 1, 900 s: at 60 Hz the stance blend spanned -0.990..1.000 and
     * first crossed -0.95 at 434 s; at 30 Hz it spanned -0.771..1.000 and NEVER crossed. The judge
     * captures at 30 fps and the gates ran at 60 Hz, so the gate proving the free foot articulates
     * was proving it of a trajectory the camera never rendered.
     *
     * Now each process owns a `PoissonSchedule` on its OWN forked stream, arrival times are drawn
     * one per event, and the frame is cut at each arrival so the event's shape begins at the exact
     * instant it was drawn for rather than at the next frame boundary. Everything integrated below
     * is an exact exponential or a linear countdown, so a frame containing no arrival takes a
     * single step and is unchanged.
     *
     * ⚠️ One residue is inherent and is not removed by any of this: `shiftCurrent` chases a target
     * that is itself decaying, and two exponentials in series do not compose exactly across a
     * split. The coupling error is order dt²/(0.8 s × 199 s) — about 7e-6 of the step at 30 Hz —
     * and it is what the invariance gate's tolerance is sized for.
     */
    advanceAxis( axis, deltaSeconds ) {

        const settings = axis.settings;

        if ( this.frameCoupledArrivals ) {

            // 🚩 THE DEFECT, REBUILT ON PURPOSE. One Bernoulli draw per frame per process, exactly
            // as this layer used to do it, so the gate has something to reject.
            if ( axis.fidgets.random.poissonEventOccurs( settings.fidgetRate, deltaSeconds ) ) this.beginFidget( axis );
            if ( axis.shifts.random.poissonEventOccurs( settings.shiftRate, deltaSeconds ) ) this.beginShift( axis );

            this.integrateAxis( axis, deltaSeconds );

        }

        let remaining = this.frameCoupledArrivals ? 0 : deltaSeconds;

        while ( remaining > 0 ) {

            const step = Math.min(
                remaining,
                axis.fidgets.secondsUntilArrival( settings.fidgetRate ),
                axis.shifts.secondsUntilArrival( settings.shiftRate ) );

            this.integrateAxis( axis, step );

            remaining -= step;

            // Fidgets are asked before shifts, always. The two are separate streams, so the order
            // decides nothing about the numbers drawn — only which callback a consumer sees first
            // in the vanishingly rare frame that contains both.
            axis.fidgets.advance( settings.fidgetRate, step, () => this.beginFidget( axis ) );
            axis.shifts.advance( settings.shiftRate, step, () => this.beginShift( axis ) );

        }

        // A fidget is a single out-and-back: a quick raised-cosine push onto the other leg and a
        // longer raised-cosine return off it. See FIDGET_DURATION_SECONDS for why the two halves
        // are not the same length. Both halves have zero slope at both ends, so nothing snaps.
        const fidget = axis.fidgetRemaining > 0
            ? axis.fidgetAmplitude
                * fidgetShape( 1 - axis.fidgetRemaining / axis.fidgetDuration, axis.fidgetRiseFraction )
            : 0;

        // Drift is a pure function of elapsed time rather than an integrated state, so it is read
        // once at the end of the frame and needs no part in the walk above.
        const drift = this.driftScale * settings.driftAmplitude
            * this.driftNoise[ settings.key ].at( this.elapsedSeconds * settings.driftFrequencyHz );

        const total = axis.shiftCurrent + fidget + drift;

        axis.displacement = Math.min( Math.max( total, -axis.limit ), axis.limit );

    }

    /**
     * The continuous state of one axis, moved forward by `seconds` — which is a sub-interval of a
     * frame, never necessarily the whole frame. Nothing here draws a random number: every arrival
     * happens between calls to this, which is what keeps the trajectory a property of the seed.
     */
    integrateAxis( axis, seconds ) {

        if ( seconds <= 0 ) return;

        const settings = axis.settings;

        if ( axis.fidgetRemaining > 0 ) {

            axis.fidgetRemaining = Math.max( axis.fidgetRemaining - seconds, 0 );

        }

        // A shift settles toward its new region, then that region leaks slowly back to centre.
        axis.shiftTarget *= Math.exp( -seconds * settings.shiftRate / SHIFT_RETURN_INTERVALS );
        axis.shiftCurrent += ( axis.shiftTarget - axis.shiftCurrent )
            * ( 1 - Math.exp( -seconds / axis.shiftSettleSeconds ) );

    }

    /**
     * Starts a shift on one axis: the body loads a leg and STAYS there.
     *
     * The callback carries the DRAWN amplitude rather than a bare "a shift occurred", because a
     * consumer scaling an arm swing to the shift needs to know whether this was a 5 mm settle or
     * a 60 mm transfer. Watching `eventCounts` instead — which is what integrations had to do
     * before this existed — loses the magnitude and arrives a frame late.
     */
    beginShift( axis ) {

        // The event's own draws come from the SHIFT process's stream, not the layer's. One stream
        // per process is what makes the draw sequence a property of the seed: two processes
        // sharing a stream interleave in whatever order they happen to fire, and which frame a
        // firing lands in depends on dt — the frame rate would leak back in through the ordering.
        const random = axis.shifts.random;
        const amplitude = this.drawAmplitude( axis.settings, random ) * this.drawDirection( random );

        axis.shiftSettleSeconds = SHIFT_SETTLE_SECONDS
            * eventStretch( amplitude, axis.settings, this.eventDurationScalesWithAmplitude );

        // A shift moves to a NEW region, so it is drawn as a signed displacement away from where
        // the stance already is rather than as an absolute position.
        axis.shiftTarget += amplitude;
        axis.shiftTarget = Math.min( Math.max( axis.shiftTarget, -axis.limit ), axis.limit );

        this.eventCounts.shift ++;

        this.relayWeightShift( axis, amplitude, 'shift' );

    }

    /**
     * Starts a fidget on one axis: the body loads a leg and COMES BACK.
     *
     * 🎯 That is the ONLY thing distinguishing it from a shift in Duarte's coding, and treating
     * it as a lesser kind of event was half of why the idle read as static. It relays like a
     * shift because it is one — a consumer swinging an arm to a weight transfer wants to know
     * about the transfer that returns as much as the one that does not — and at 1.2/min medio-
     * laterally it is the process that actually populates a ninety-second window.
     *
     * 🚩 The direction is drawn. The version this replaced took the absolute amplitude and never
     * signed it, so every fidget in the layer's history pushed the body toward the character's
     * left, and the medio-lateral posture signal carried a standing bias no gate was looking for.
     */
    beginFidget( axis ) {

        // The FIDGET process's own stream; see beginShift for why it is not the layer's.
        const random = axis.fidgets.random;

        const amplitude = this.drawAmplitude( axis.settings, random )
            * this.fidget.amplitudeFraction * this.drawDirection( random );

        const shape = fidgetShapeFor( amplitude, axis.settings, this.fidget,
            this.eventDurationScalesWithAmplitude );

        axis.fidgetDuration = shape.durationSeconds;
        axis.fidgetRiseFraction = shape.riseFraction;
        axis.fidgetRemaining = shape.durationSeconds;
        axis.fidgetAmplitude = amplitude;

        this.eventCounts.fidget ++;

        this.relayWeightShift( axis, amplitude, 'fidget' );

    }

    /**
     * Tells anyone listening that the body just transferred load, at the instant it happens.
     *
     * Only the lateral axis relays. A fore-and-aft shift is a lean into or away from the
     * conversation, and the arm swing a consumer plays on the relay is a lateral motion that
     * would read as a flinch if a fore-and-aft shift triggered it.
     */
    relayWeightShift( axis, amplitude, pattern ) {

        if ( this.onWeightShift === null || axis.settings.relaysWeightShift === false ) return;

        this.onWeightShift( {
            magnitude: amplitude / axis.settings.shiftAmplitude,
            axis: axis.settings.key,
            pattern
        } );

    }

    /** A weight transfer goes either way, and the coin is fair. */
    drawDirection( random ) {

        return random.chance( 0.5 ) ? 1 : -1;

    }

    /**
     * 🎯 Draws one shift amplitude, LOGNORMAL on Duarte's reported mean and standard deviation.
     *
     * The obvious reading of "22 ± 38 mm" is a gaussian, and that is what this used to be —
     * `Math.abs( gaussian( 22, 38 ) )`, floored. It is wrong, and measurably so: a gaussian whose
     * standard deviation is nearly twice its mean spends a third of its mass below zero, so
     * folding it produces a mean of 35 mm rather than 22. The layer was drawing shifts 60% larger
     * than the paper reports, and the relay's own selftest saw it — mean relayed magnitude 1.59
     * against a distribution that should average 1.0 — without anyone reading it as a defect.
     *
     * An amplitude is a positive quantity, so a standard deviation larger than the mean does not
     * describe a symmetric spread; it describes a SKEW. Most weight shifts are small and a few
     * are large. A lognormal is the standard two-parameter positive distribution and reproduces
     * both reported moments exactly:
     *
     *     sigma^2 = ln( 1 + (sd/mean)^2 )      mu = ln( mean ) - sigma^2 / 2
     *
     * For the medio-lateral shift that is mu = 2.400, sigma = 1.176, and the fraction of draws
     * past the postural clamp falls from 40% to 15% — which is the difference between a figure
     * that is usually pinned at the edge of its stance and one that occasionally reaches it.
     *
     * 🚩 No floor and no clamp here. The old version floored at a tenth of the mean to keep the
     * folded gaussian off zero; a lognormal cannot reach zero, so a floor would only distort the
     * small end. The postural clamp still bounds the large end, where it belongs.
     */
    drawAmplitude( settings, random ) {

        const variance = Math.log( 1 + ( settings.shiftAmplitudeSd / settings.shiftAmplitude ) ** 2 );
        const median = Math.log( settings.shiftAmplitude ) - variance / 2;

        return Math.exp( random.gaussian( median, Math.sqrt( variance ) ) );

    }

    /**
     * How far toward a contrapposto this frame's lateral weight shift has moved the body.
     *
     * Solved rather than tuned: the shift process states a wanted head displacement in metres,
     * the pose's head response per unit blend was measured on this rig at bind, and the blend is
     * the ratio. That keeps the authored, validated head amplitude intact while moving the
     * pelvis over the stance foot — which is what a weight shift actually is.
     */
    solveStanceBlend() {

        if ( this.stanceBlendEnabled === false ) return 0;

        // 🎯 ALMOST the whole lateral signal, balance band included. Medio-lateral balance is a hip
        // mechanism and this is where it is delivered — but not ALL of it, because these feet are
        // turned out. See `medioLateralAnkleShare`: Winter's own paper gives the ankle a share of
        // the lateral control the moment the stance stops being side-by-side, and what that share
        // does not carry is what the contrapposto has to.
        const wantedMedioLateral = this.displacement.x * ( 1 - this.medioLateralAnkleShare );
        const response = wantedMedioLateral >= 0 ? this.stanceResponse.left : this.stanceResponse.right;

        if ( response.usable === false ) return 0;

        const blend = wantedMedioLateral / response.centreOfMass.x;

        return Math.min( Math.max( blend, 0 ), STANCE_BLEND_LIMIT ) * Math.sign( wantedMedioLateral );

    }

    /** Whatever head displacement the contrapposto did not deliver is the pendulum's to produce. */
    resolvePendulumDisplacement() {

        this.pendulumDisplacement.copy( this.displacement );

        if ( this.stanceBlend === 0 ) return;

        const response = this.stanceBlend > 0 ? this.stanceResponse.left : this.stanceResponse.right;

        this.pendulumDisplacement.x -= Math.abs( this.stanceBlend ) * response.centreOfMass.x;
        this.pendulumDisplacement.z -= Math.abs( this.stanceBlend ) * response.centreOfMass.z;

    }

    // --- posing -------------------------------------------------------------------------------

    /**
     * Reads the rig facts the pendulum needs: every driven joint's rest frame and rest world
     * position, where the pendulum pivots, how far each joint shares the lean, and how much of
     * the base of support the weight shifts are allowed to use.
     *
     * The pivot is the midpoint of the two ankle joints, dropped toward the sole by
     * PIVOT_HEIGHT_FRACTION_OF_ANKLE. The LEVER — how far the body travels per radian of lean —
     * is not derived here; it is measured, by `measurePendulumResponse`. See that method for why.
     *
     * Note that the heights are read from the pose the figure is in when this runs. On the first
     * bind that is the rest pose. On a `MotionStack.reset()` mid-run it is a leaned pose, which
     * shifts the geometry by well under a tenth of a millimetre at these angles — worth knowing
     * about, not worth correcting.
     */
    resolveRigGeometry( target ) {

        for ( const joint of this.joints ) {

            joint.bone = target.getBone( joint.boneName );

            restRotationRelativeToRig( joint.bone, null, joint.restFrame );
            worldPositionOf( joint.bone, joint.restPosition );

        }

        this.resolvePivot();

        // A rig with no feet cannot pivot about them, so the whole lean falls back to the spine
        // and the layer behaves as its predecessor did. The stack's missing-channel report names
        // the actual cause; this just keeps the geometry finite.
        const spineParticipation = this.pendulumPlanted ? 1 - this.anklePendulumShare : 1;

        this.spineJoints().forEach( ( joint, index ) => {

            // Two different shares, and conflating them would silently shrink the righting by the
            // ankle share: `share` is this joint's slice of the PENDULUM lean, which sums to the
            // spine's 15% participation; `spineFraction` is its slice of any angle spread over the
            // spine alone, and sums to 1.
            joint.share = spineParticipation * this.spineShare[ index ];
            joint.spineFraction = this.spineShare[ index ];

        } );

        const pelvis = this.jointsByHumanoid.get( 'hips' );

        this.pelvisArm.copy( pelvis.restPosition ).sub( this.pivot );
        restRotationRelativeToRig( pelvis.bone?.parent ?? null, null, this.pelvisParentFrameInverse ).invert();

        for ( const foot of this.feet ) {

            foot.pendulumArm.copy( foot.joint.restPosition ).sub( this.pivot );

        }

        this.resolvePostureLimits();

    }

    /**
     * How far the accumulated weight-shift offset may travel.
     *
     * Duarte's own shift amplitude decides it — POSTURE_OFFSET_MEAN_SHIFTS — and the rig's base of
     * support is only a ceiling on top of that, for a figure posed with its feet nearly touching.
     * Medio-laterally that ceiling is the distance from the midline out to the stance ankle, which
     * is where the centre of pressure sits with the load fully on one leg; see the comment above
     * POSTURE_OFFSET_MEAN_SHIFTS's neighbour for why it is no longer a quarter of that.
     */
    resolvePostureLimits() {

        for ( const axis of [ this.medioLateral, this.anteroPosterior ] ) {

            axis.limit = POSTURE_OFFSET_MEAN_SHIFTS * axis.settings.shiftAmplitude;

        }

        if ( this.pendulumPlanted === false ) return;

        const [ left, right ] = this.feet;
        const halfStance = Math.abs( left.joint.restPosition.x - right.joint.restPosition.x ) / 2;

        // A figure standing with its ankles touching keeps the shift-anchored clamp rather than
        // being pinned to nothing: half a centimetre of stance is a bad read, not a narrow stance.
        if ( halfStance <= 0.005 ) return;

        this.medioLateral.limit = Math.min( this.medioLateral.limit, halfStance );

    }

    /**
     * 🎯 Measures how far the centre of mass — and, for the record, the head — travels per radian
     * of lean, by leaning this rig and looking.
     *
     * The centre of mass is what the lean is solved against, because every amplitude this layer
     * is given is a centre-of-pressure amplitude and a sustained centre of pressure sits under
     * the centre of mass. So this is the number that turns "3 mm of medio-lateral sway" into an
     * angle.
     *
     * It is measured rather than derived because the closed form is worse reading than the
     * measurement and easier to get subtly wrong. The rigid ankle share moves the whole body, so
     * its contribution really is the centre of mass's height above the pivot — but a spine joint
     * rotates only the mass ABOVE it, and the neck's give-back only the head, so each of those
     * contributes its own share times its own height times its own mass fraction. Leaning the rig
     * and reading the result gets all of that for free, and stays right if the chain changes.
     *
     * Both axes are probed even though a symmetric figure's levers are equal, because a figure
     * that stands with its weight slightly forward has a centre of mass that is not on the frontal
     * plane and the two are then genuinely different by a hair.
     */
    measurePendulumResponse( target ) {

        const head = target.getBone( this.referenceBoneName );
        const snapshot = this.snapshotJoints();

        if ( snapshot.length === 0 ) return;

        const root = rootOf( snapshot[ 0 ].joint.bone );

        root.updateMatrixWorld( true );

        const restCentreOfMass = this.bodyMass.centreOfMass( new Vector3() );
        const restHead = isPresent( head ) ? worldPositionOf( head, new Vector3() ) : null;

        // Same order as the runtime lean, so a probe cannot measure something the frame loop
        // will not reproduce.
        const probes = [
            { key: 'anteroPosterior', component: 'z', anteroPosterior: PENDULUM_PROBE_RADIANS, medioLateral: 0 },
            { key: 'medioLateral', component: 'x', anteroPosterior: 0, medioLateral: PENDULUM_PROBE_RADIANS }
        ];

        // Repeated passes, because the lateral righting cannot be sized without measuring what it
        // does — and what it does includes moving the centre of mass it is being measured against.
        // Pass one is the rigid rotation; the rest are the secant solve. Everything downstream reads
        // the last pass, which is the pendulum the frame loop will actually run.
        const solve = createRightingSolve();
        const passes = this.lateralRightingEnabled ? RIGHTING_SOLVE_PASSES : 1;

        for ( let pass = 0; pass < passes; pass ++ ) {

        if ( pass > 0 ) this.lateralRightingPerRadian = this.stepLateralRighting( solve, restHead );

        for ( const probe of probes ) {

            this.buildPendulumRotations( probe.anteroPosterior, probe.medioLateral );
            this.applyPendulumToBones( snapshot );

            root.updateMatrixWorld( true );

            const centreOfMass = this.bodyMass.centreOfMass( this.scratchCentreOfMass );

            // A positive rotation about the medio-lateral axis carries the body toward +Z, and a
            // lateral lean moves it toward -X — the same sign convention writePose() states. The
            // lever is taken as a magnitude and the sign lives in writePose() alone, so there is
            // exactly one place to get it wrong.
            this.centreOfMassLever[ probe.key ] = Math.abs(
                ( centreOfMass[ probe.component ] - restCentreOfMass[ probe.component ] ) / PENDULUM_PROBE_RADIANS );

            if ( restHead !== null ) {

                const posedHead = worldPositionOf( head, this.scratchDisplacement );

                this.headLever[ probe.key ] = Math.abs(
                    ( posedHead[ probe.component ] - restHead[ probe.component ] ) / PENDULUM_PROBE_RADIANS );

            }

            this.restoreJoints( snapshot );

        }

        // A degenerate rig — no reference bone, or a body whose mass all sits at the pivot —
        // would divide by zero and fling the figure. One metre keeps the layer harmless.
        for ( const key of [ 'anteroPosterior', 'medioLateral' ] ) {

            if ( this.centreOfMassLever[ key ] < 1e-4 ) this.centreOfMassLever[ key ] = 1;
            if ( this.headLever[ key ] < 1e-4 ) this.headLever[ key ] = 1;

        }

        }

        root.updateMatrixWorld( true );

        // Reported, not used: the coefficient POSTURE_HEAD_TRANSFER used to guess at. On
        // figure_g050 posed into relaxed-standing it reads 1.674 FORE AND AFT, against the 0.20
        // assumed — and it is a MEASUREMENT, so do not expect the digits to survive a change to the
        // rig, the pivot height or the rest pose. The selftest gates it against the raw height ratio
        // rather than against a literal, for exactly that reason.
        //
        // 🎯 Antero-posterior, not medio-lateral, and the axis matters: this is the rigid-inverted-
        // pendulum claim, and the pendulum is only an inverted pendulum fore and aft. The lateral
        // figure below is the OTHER claim — the head parked over the base of support — and lands
        // near 1.0 by construction.
        this.headPerCentreOfMass = this.headLever.anteroPosterior / this.centreOfMassLever.anteroPosterior;
        this.headPerCentreOfMassLateral = this.headLever.medioLateral / this.centreOfMassLever.medioLateral;

    }

    /**
     * One secant step toward the lumbar counter-roll that parks the head during a LATERAL pendulum
     * lean.
     *
     * The first step needs a starting guess and takes the obvious one — the angle that would cancel
     * the whole measured overshoot if the counter-bend moved only the head. It does not; it rotates
     * half the body's mass, so it moves the centre of mass too, and every step after this one is
     * measuring that and correcting for it. Identical in form to `stepTrunkRighting`, deliberately:
     * it is the same reflex doing the same thing to a different mechanism.
     */
    stepLateralRighting( solve, restHead ) {

        const spine = this.spineJoints()[ 0 ];

        if ( restHead === null || spine === undefined || isPresent( spine.bone ) === false ) return 0;

        const lever = restHead.y - spine.restPosition.y;

        if ( Math.abs( lever ) < 0.05 ) return 0;

        const overshoot = this.headLever.medioLateral
            - LATERAL_HEAD_PER_CENTRE_OF_MASS * this.centreOfMassLever.medioLateral;

        return secantStep( solve, this.lateralRightingPerRadian, overshoot, overshoot / lever );

    }

    /**
     * The pendulum's pivot: between the ankles, and between the ankle joint and the sole.
     *
     * The sole's height is taken from the toe joint rather than assumed to be y = 0, so a figure
     * placed anywhere in the scene pivots about its own feet rather than about the world origin.
     */
    resolvePivot() {

        const left = this.jointsByHumanoid.get( 'leftFoot' );
        const right = this.jointsByHumanoid.get( 'rightFoot' );

        this.pendulumPlanted = isPresent( left.bone ) && isPresent( right.bone );

        if ( this.pendulumPlanted === false ) {

            this.pivot.set( 0, 0, 0 );
            return;

        }

        this.pivot.copy( left.restPosition ).add( right.restPosition ).multiplyScalar( 0.5 );

        const soleHeight = Math.min(
            toeHeightOf( left.bone, this.scratchDisplacement ),
            toeHeightOf( right.bone, this.scratchDisplacement )
        );

        this.pivot.y = soleHeight + PIVOT_HEIGHT_FRACTION_OF_ANKLE * ( this.pivot.y - soleHeight );

    }

    /**
     * Measures what the contrapposto poses actually do to THIS rig, in millimetres.
     *
     * The poses are authored against the figure's proportions, so the only way to convert "a
     * 22 mm centre-of-pressure shift" into a blend is to ask the rig. Both poses are applied at a
     * probe blend, the head and both ankles are read, and the result is divided back to a
     * per-unit-blend response. The two sides are measured separately because the poses are
     * deliberately asymmetric — a real body does not shift identically both ways.
     *
     * This drives the real bones for the length of the measurement and puts every one of them
     * back exactly as it found it. The stack captured its rest pose before onBind ran, so a
     * perfect restore is invisible to it; an imperfect one would silently bias every absolute
     * measurement in the stack, which is why the snapshot is taken from the bones themselves
     * rather than reconstructed.
     */
    measureStanceResponse( target ) {

        const head = target.getBone( this.referenceBoneName );
        const feet = this.feet;

        for ( const side of [ 'left', 'right' ] ) {

            const response = this.stanceResponse[ side ];

            response.usable = false;
            response.centreOfMass.set( 0, 0, 0 );
            response.head.set( 0, 0, 0 );

            for ( const key of [ 'left', 'right' ] ) {

                for ( const sample of response.ankle[ key ] ) sample.set( 0, 0, 0 );

            }

        }

        const snapshot = this.snapshotJoints();

        if ( snapshot.length === 0 ) return;

        const root = rootOf( snapshot[ 0 ].joint.bone );

        root.updateMatrixWorld( true );

        const restCentreOfMass = this.bodyMass.centreOfMass( new Vector3() );
        const restHead = isPresent( head ) ? worldPositionOf( head, new Vector3() ) : null;

        // Pass one measures the pose as authored, so pass two can be told how far the head
        // overshoots the centre of mass. Sizing the righting term needs a number that the righting
        // term itself would otherwise change, so the circle is broken by measuring twice — and
        // everything downstream reads pass two, which is the pose the runtime actually plays.
        const solve = { left: createRightingSolve(), right: createRightingSolve() };
        const passes = this.lateralRightingEnabled ? RIGHTING_SOLVE_PASSES : 1;

        for ( let pass = 0; pass < passes; pass ++ ) {

        if ( pass > 0 ) this.stepTrunkRighting( solve, restHead );

        for ( const side of [ 'left', 'right' ] ) {

            const response = this.stanceResponse[ side ];

            this.buildStanceRotations( STANCE_RESPONSE_PROBE_BLEND, side );
            this.applyStanceToBones( STANCE_RESPONSE_PROBE_BLEND, side, snapshot );

            // The whole rig, not just the driven chain: the centre of mass reads the hands and
            // the feet, which ride the pose without being posed by it.
            root.updateMatrixWorld( true );

            response.centreOfMass.copy( this.bodyMass.centreOfMass( this.scratchCentreOfMass ) )
                .sub( restCentreOfMass ).divideScalar( STANCE_RESPONSE_PROBE_BLEND );

            if ( restHead !== null ) {

                response.head.copy( worldPositionOf( head, this.scratchDisplacement ) ).sub( restHead )
                    .divideScalar( STANCE_RESPONSE_PROBE_BLEND );

            }

            this.restoreJoints( snapshot );

            // The ankle needs the whole curve, not a rate. See STANCE_ANKLE_PROBE_COUNT.
            for ( let step = 0; step < STANCE_ANKLE_PROBE_COUNT; step ++ ) {

                const blend = ( step + 1 ) / STANCE_ANKLE_PROBE_COUNT;

                this.buildStanceRotations( blend, side );
                this.applyStanceToBones( blend, side, snapshot );

                root.updateMatrixWorld( true );

                for ( const foot of feet ) {

                    response.ankle[ foot.key ][ step ]
                        .copy( worldPositionOf( foot.joint.bone, this.scratchDisplacement ) )
                        .sub( foot.joint.restPosition );

                }

                this.restoreJoints( snapshot );

            }

            // A pose that barely moves the centre of mass sideways cannot be solved for a blend
            // without dividing by something close to zero, so the blend is simply not used on
            // that rig. 5 mm per unit blend is two orders below what the shipped poses produce.
            response.usable = Math.abs( response.centreOfMass.x ) > 0.005;

        }

        }

        root.updateMatrixWorld( true );

    }

    /**
     * Sizes the lumbar counter-bend that parks the head, from the overshoot just measured.
     *
     * The overshoot is how much further the pose carries the head than it carries the centre of
     * mass, per unit blend, PER SIDE — the two poses are deliberately asymmetric and their
     * overshoots differ by a fifth, so one averaged angle parks one side and leaves the other
     * overshooting. The angle that cancels a chosen fraction of it is that distance over the lever
     * from the lumbar spine to the head — first order, which at four degrees is exact to four
     * decimal places.
     */
    stepTrunkRighting( solve, restHead ) {

        const spine = this.spineJoints()[ 0 ];

        if ( restHead === null || spine === undefined || isPresent( spine.bone ) === false ) return;

        const lever = restHead.y - spine.restPosition.y;

        if ( Math.abs( lever ) < 0.05 ) return;

        for ( const side of [ 'left', 'right' ] ) {

            const response = this.stanceResponse[ side ];
            const overshoot = Math.abs( response.head.x )
                - LATERAL_HEAD_PER_CENTRE_OF_MASS * Math.abs( response.centreOfMass.x );

            this.trunkRightingRadians[ side ] = secantStep(
                solve[ side ], this.trunkRightingRadians[ side ], overshoot, overshoot / lever );

        }

    }

    /**
     * Every driven bone's current rotation and position, so a measurement can drive the real rig
     * and put it back exactly as it found it.
     *
     * The stack captured its rest pose before onBind ran, so a perfect restore is invisible to
     * it; an imperfect one would silently bias every absolute measurement in the stack. That is
     * why the snapshot is taken from the bones themselves rather than reconstructed from a pose.
     */
    snapshotJoints() {

        return this.joints
            .filter( ( joint ) => isPresent( joint.bone ) )
            .map( ( joint ) => ( {
                joint,
                quaternion: joint.bone.quaternion.clone(),
                position: joint.bone.position.clone()
            } ) );

    }

    restoreJoints( snapshot ) {

        for ( const entry of snapshot ) {

            entry.joint.bone.quaternion.copy( entry.quaternion );
            entry.joint.bone.position.copy( entry.position );

        }

    }

    /**
     * Drives the real bones into a pure pendulum lean, for the response measurement.
     *
     * Mirrors `writePose` with the stance blend at zero — feet held at their rest orientation,
     * pelvis carried around the pivot arc — so the lever that comes out is the lever the frame
     * loop will reproduce rather than an independent derivation that might drift from it.
     */
    applyPendulumToBones( snapshot ) {

        for ( const entry of snapshot ) {

            const joint = entry.joint;

            if ( joint.pendulum === 'plant' ) joint.cumulative.identity();
            else joint.cumulative.copy( joint.pendulumCumulative );

        }

        this.writeCumulativeToBones( snapshot );

        const pelvis = this.jointsByHumanoid.get( 'hips' );
        const pelvisEntry = snapshot.find( ( entry ) => entry.joint === pelvis );

        if ( pelvisEntry === undefined ) return;

        this.scratchOffset.copy( this.pelvisArm ).applyQuaternion( this.ankleRotation ).sub( this.pelvisArm );
        this.scratchOffset.applyQuaternion( this.pelvisParentFrameInverse );

        pelvis.bone.position.copy( pelvisEntry.position ).add( this.scratchOffset );

    }

    /**
     * Turns each joint's cumulative rig-space rotation into a bone rotation, on top of whatever
     * the snapshot found there. The shared half of the two bind-time probes.
     */
    writeCumulativeToBones( snapshot ) {

        for ( const entry of snapshot ) {

            const joint = entry.joint;
            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            joint.rigRotation.copy( joint.cumulative );

            if ( parent !== null ) {

                this.scratchRigRotation.copy( parent.cumulative ).invert();
                joint.rigRotation.premultiply( this.scratchRigRotation );

            }

            toBoneDeltaFrame( joint.rigRotation, joint.restFrame, this.scratchBoneDelta );
            joint.bone.quaternion.copy( entry.quaternion ).multiply( this.scratchBoneDelta );

        }

    }

    /**
     * Drives the real bones into the stance pose at `blend`, for the response measurement.
     *
     * Runs the same arithmetic the frame loop does — cumulative rotation per joint, parent's
     * taken back off to get the joint's own — so the number that comes out is the number the
     * runtime will reproduce, not an independent derivation that might drift from it.
     */
    applyStanceToBones( blend, side, snapshot ) {

        for ( const entry of snapshot ) entry.joint.cumulative.copy( entry.joint.stanceCumulative );

        this.writeCumulativeToBones( snapshot );

        const pelvis = this.jointsByHumanoid.get( 'hips' );
        const pelvisEntry = snapshot.find( ( entry ) => entry.joint === pelvis );

        if ( pelvisEntry === undefined ) return;

        this.stanceHipsOffset( blend, side, this.scratchOffset );
        this.scratchOffset.applyQuaternion( this.pelvisParentFrameInverse );
        pelvis.bone.position.copy( pelvisEntry.position ).add( this.scratchOffset );

    }

    /**
     * Turns the wanted displacement into a lean, distributes it, and writes every channel.
     *
     * Sign convention, derived from the rig-space axes and confirmed by measuring the reference
     * marker's world displacement in the selftest: a positive rotation about the rig's
     * medio-lateral axis (+X) carries the trunk toward +Z, which is forward. A lateral lean is
     * therefore a rotation about the FORWARD axis, and it moves the marker toward -X, so its
     * angle is negated.
     */
    writePose() {

        const leanAnteroPosterior = this.pendulumDisplacement.z / this.centreOfMassLever.anteroPosterior;
        const leanMedioLateral = -this.pendulumDisplacement.x / this.centreOfMassLever.medioLateral;

        this.buildPendulumRotations( leanAnteroPosterior, leanMedioLateral );
        this.buildStanceRotations( Math.abs( this.stanceBlend ), this.stanceBlend >= 0 ? 'left' : 'right' );

        for ( const joint of this.joints ) {

            if ( isPresent( joint.bone ) === false ) continue;

            if ( joint.pendulum === 'toes' ) {

                // The toes end the chain at the foot's orientation plus their own lift. Reading the
                // foot's cumulative rather than starting from identity is what keeps the lift a
                // rotation ABOUT THE METATARSAL HEAD rather than a second, competing plant.
                joint.cumulative.copy( this.jointsByHumanoid.get( joint.parent ).cumulative );
                continue;

            }

            if ( joint.pendulum === 'plant' ) {

                // 🎯 The foot ends the chain at its rest orientation TURNED BY WHATEVER YAW ITS OWN
                // LOAD ALLOWS. The rest-orientation half is "the sole stays flat", and it overrides
                // the contrapposto's own foot angles on purpose: those angles exist in the pose file
                // to level the sole after the shank swings, and levelling it exactly is strictly
                // better. The yaw half is FREE_FOOT_YAW_RELEASE — a rotation about the rig's
                // vertical maps the floor plane to itself, so it cannot cost a hundredth of a degree
                // of sole tilt, and it is the only thing below the ankle that distinguishes the foot
                // carrying the body from the one that is not.
                this.resolvePlantedRotation( joint, joint.cumulative );
                continue;

            }

            // Pendulum outside, pose inside: the body takes its stance, then the whole thing
            // tips. At these angles the two commute to five decimal places, so the order is a
            // statement of intent rather than a correctness constraint.
            joint.cumulative.multiplyQuaternions( joint.pendulumCumulative, joint.stanceCumulative );

        }

        for ( const joint of this.joints ) {

            if ( isPresent( joint.bone ) === false ) continue;

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            joint.rigRotation.copy( joint.cumulative );

            if ( parent !== null ) {

                this.scratchRigRotation.copy( parent.cumulative ).invert();
                joint.rigRotation.premultiply( this.scratchRigRotation );

            }

            toBoneDeltaFrame( joint.rigRotation, joint.restFrame, this.scratchBoneDelta );
            this.contribution.rotateBone( joint.boneName, this.scratchBoneDelta );

        }

        this.writePelvisTravel();
        this.writeFootPlanting();
        this.writeToeLift();

    }

    /**
     * The rigid rotation about the ankles, the spine's token share of it, the neck's give-back,
     * and the counter-rotation that keeps the soles flat — as one cumulative rotation per joint.
     */
    buildPendulumRotations( leanAnteroPosterior, leanMedioLateral ) {

        const ankleShare = this.pendulumPlanted ? this.anklePendulumShare : 0;

        this.composeRigRotation( leanAnteroPosterior * ankleShare, leanMedioLateral * ankleShare );
        this.ankleRotation.copy( this.scratchRigRotation );

        for ( const joint of this.joints ) {

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            switch ( joint.pendulum ) {

                case 'lean':
                    joint.pendulumCumulative.copy( this.ankleRotation );
                    break;

                case 'spine':
                    // The spine's token share of the lean, MINUS the lumbar counter-roll that parks
                    // the head during a lateral lean. Both are frontal-plane angles on the same
                    // joints, so they are one number rather than two rotations to compose.
                    this.composeRigRotation(
                        leanAnteroPosterior * joint.share,
                        leanMedioLateral * ( joint.share - this.lateralRightingPerRadian * joint.spineFraction ) );
                    joint.pendulumCumulative.multiplyQuaternions( parent.pendulumCumulative, this.scratchRigRotation );
                    break;

                case 'headStabilisation':
                    this.composeRigRotation(
                        -leanAnteroPosterior * this.headStabilisation,
                        -leanMedioLateral * this.headStabilisation
                    );
                    joint.pendulumCumulative.multiplyQuaternions( parent.pendulumCumulative, this.scratchRigRotation );
                    break;

                default:
                    // 'carried', 'plant' and 'toes' — the leg rides the pelvis and adds nothing of
                    // its own. The foot's counter-rotation and the toes' lift are applied in
                    // writePose(), against the pose as well as the lean.
                    joint.pendulumCumulative.copy( parent.pendulumCumulative );

            }

        }

    }

    /**
     * The contrapposto, as a cumulative rig-space rotation per joint.
     *
     * A pose states one rotation per bone in the normalised humanoid frame, and those accumulate
     * down the chain. The rotation this layer contributes is the difference between where the
     * blended pose puts a bone and where relaxed-standing puts it — so at blend 0 every joint is
     * identity no matter what pose the figure is actually resting in, which is the only sane
     * semantics for a layer that adds to a stack rather than replacing it.
     */
    buildStanceRotations( blend, side ) {

        if ( blend === 0 ) {

            for ( const joint of this.joints ) joint.stanceCumulative.identity();

            return;

        }

        const pose = this.stancePoses[ side ];

        // The extra lumbar counter-bend that parks the head. Signed so it always opposes the
        // direction the pose is carrying the head; see STANCE_TRUNK_RIGHTING.
        const righting = ( side === 'left' ? 1 : -1 ) * this.trunkRightingRadians[ side ] * blend;

        for ( const joint of this.joints ) {

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            const from = this.relaxedPose.rotationFor( joint.humanoid ) ?? IDENTITY;
            const to = pose.rotationFor( joint.humanoid ) ?? IDENTITY;

            this.scratchRigRotation.copy( from ).slerp( to, blend );

            if ( joint.pendulum === 'spine' && righting !== 0 ) {

                this.scratchAxisRotation.setFromAxisAngle( RIG_FORWARD_AXIS, righting * joint.spineFraction );
                this.scratchRigRotation.multiply( this.scratchAxisRotation );

            }

            if ( parent === null ) {

                joint.stanceAccumulated.copy( this.scratchRigRotation );

            } else {

                joint.stanceAccumulated.multiplyQuaternions( parent.stanceAccumulated, this.scratchRigRotation );

            }

            joint.stanceCumulative.multiplyQuaternions( joint.stanceAccumulated, joint.relaxedAccumulatedInverse );

        }

    }

    /**
     * The relaxed pose's accumulated rotation at each joint, inverted, cached once.
     *
     * This is what makes the contrapposto a DELTA rather than a pose: subtracting it means blend
     * 0 contributes identity everywhere, whatever stance the figure is actually resting in. A
     * layer that replaced the rest pose instead would silently discard everything the posture
     * layer and every other contributor had said.
     */
    accumulateRelaxedPose() {

        for ( const joint of this.joints ) {

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );
            const own = this.relaxedPose.rotationFor( joint.humanoid ) ?? IDENTITY;

            if ( parent === null ) {

                joint.relaxedAccumulated.copy( own );

            } else {

                joint.relaxedAccumulated.multiplyQuaternions( parent.relaxedAccumulated, own );

            }

            joint.relaxedAccumulatedInverse.copy( joint.relaxedAccumulated ).invert();

        }

    }

    /**
     * Moves the pelvis. Two things live here and they are the reason the lower body moves at all:
     * the arc the pelvis travels because the body is turning about the ankles rather than about
     * its own hip joints, and the lateral travel over the stance foot that a weight shift is.
     */
    writePelvisTravel() {

        const pelvis = this.jointsByHumanoid.get( 'hips' );

        if ( isPresent( pelvis.bone ) === false ) return;

        // r' - r for the pelvis on the end of the pendulum arm. Written as the full rotation
        // rather than the small-angle cross product because it costs the same and stays exact.
        this.scratchOffset.copy( this.pelvisArm ).applyQuaternion( this.ankleRotation ).sub( this.pelvisArm );

        if ( this.stanceBlend !== 0 ) {

            this.stanceHipsOffset(
                Math.abs( this.stanceBlend ),
                this.stanceBlend > 0 ? 'left' : 'right',
                this.scratchDisplacement
            );

            this.scratchOffset.add( this.scratchDisplacement );

        }

        this.scratchOffset.applyQuaternion( this.pelvisParentFrameInverse );

        this.contribution.offsetBone( pelvis.boneName, this.scratchOffset.x, this.scratchOffset.y, this.scratchOffset.z );

    }

    /** The pelvis travel the contrapposto asks for, in rig space, at a given blend. */
    stanceHipsOffset( blend, side, target ) {

        return target
            .copy( this.relaxedPose.hipsOffset )
            .lerp( this.stancePoses[ side ].hipsOffset, blend )
            .sub( this.relaxedPose.hipsOffset );

    }

    /**
     * 🎯 Keeps both feet on the floor, in millimetres, without foot IK.
     *
     * Two residues have to go, and they are different problems:
     *
     *   VERTICAL. A body cannot rigidly rotate about a fore-and-aft axis and keep two laterally
     *   separated feet both flat — one ankle rises and the other falls by half the stance width
     *   times the lean. That is not a bug in the model, it is what medio-lateral balance IS: the
     *   load transfers between the legs and the loaded one shortens. Cancelling it at the ankle
     *   is the cheapest available stand-in for that leg-length change, and it is under a
     *   millimetre.
     *
     *   HORIZONTAL, from the pose. The contrapposto poses were authored without IK and move the
     *   feet by up to 20 mm at full blend — the pose files say so, and say why. At the blends
     *   this layer reaches that is a couple of millimetres, and it is pinned out here so the
     *   planted foot is planted regardless of what the pose does.
     *
     * What is deliberately NOT cancelled is the horizontal residue of the pendulum itself: the
     * ankle sits a little above the pivot, so it travels a tenth of a millimetre as the body
     * rocks, and the sole slides with it. See PIVOT_HEIGHT_FRACTION_OF_ANKLE — that residue is
     * the model being honest rather than the model being wrong.
     */
    writeFootPlanting() {

        for ( const foot of this.feet ) {

            if ( isPresent( foot.joint.bone ) === false ) continue;

            // The arc this ankle rides because the body is turning about a pivot below it.
            this.scratchDisplacement.copy( foot.pendulumArm )
                .applyQuaternion( this.ankleRotation )
                .sub( foot.pendulumArm );

            this.stanceAnkleTravel( foot, this.scratchStance );

            this.scratchOffset.set(
                -this.scratchStance.x,
                -( this.scratchDisplacement.y + this.scratchStance.y ),
                -this.scratchStance.z
            );

            // A bone's offset is read in its parent's space, so the correction goes into the
            // shank's frame AS POSED — rest frame times everything the lean and the pose did to
            // it. Using the rest frame alone would leave a couple of hundredths of a millimetre
            // of the correction pointing the wrong way, which is the difference between a gate
            // that says "planted" and one that says "nearly".
            this.scratchBoneDelta.multiplyQuaternions( foot.shank.cumulative, foot.shank.restFrame ).invert();
            this.scratchOffset.applyQuaternion( this.scratchBoneDelta );

            this.contribution.offsetBone(
                foot.joint.boneName, this.scratchOffset.x, this.scratchOffset.y, this.scratchOffset.z );

        }

    }

    /**
     * 🎯 How much of the body's weight has left this foot, from 0 (carrying its share) to 1 (free).
     *
     * The stance blend IS the load transfer — a positive blend loads the left leg, so the right foot
     * is the one unloading — and this is the single place that reading is written down. Both things
     * a free foot is allowed to do, the yaw release and the toe lift, are scaled by it, so a reader
     * asking "what does this layer think it means for a foot to be free?" has one answer to find and
     * the two behaviours cannot drift apart.
     */
    unloadFractionOf( foot ) {

        return foot.key === 'left' ? Math.max( -this.stanceBlend, 0 ) : Math.max( this.stanceBlend, 0 );

    }

    /**
     * The rig-space rotation a planted foot ends up with: its rest orientation, turned by the share
     * of the leg chain's yaw that its own unloading permits.
     *
     * The yaw is taken as the TWIST about the rig's vertical of the rotation the chain would
     * otherwise have handed this foot — pendulum lean outside, contrapposto inside, exactly as the
     * unplanted joints compose it. Twist about the vertical is the one component that maps the floor
     * plane to itself, so what is discarded here is precisely what would have tilted the sole.
     */
    resolvePlantedRotation( joint, target ) {

        target.identity();

        const foot = joint.foot;

        if ( foot === undefined ) return target;

        const release = this.unloadFractionOf( foot ) * this.freeFootYawRelease;

        this.scratchRigRotation.multiplyQuaternions( joint.pendulumCumulative, joint.stanceCumulative );

        const yaw = release === 0 ? 0 : twistAngleAbout( this.scratchRigRotation, RIG_UP_AXIS ) * release;

        this.footYawRadians[ foot.key ] = yaw;

        if ( yaw === 0 ) return target;

        return target.setFromAxisAngle( RIG_UP_AXIS, yaw );

    }

    /**
     * 🎯 The other thing a free foot is allowed to do: its toes coming off the floor as the weight
     * leaves it.
     *
     * Scaled by the same `unloadFractionOf` the yaw release uses. Extension only, so the toes can
     * only leave the floor; see TOE_UNLOAD_LIFT_DEGREES for why that direction is the truthful one
     * as well as the safe one. Written as a rotation about the medio-lateral axis at the metatarsal
     * head, which is where a toe actually hinges and which leaves the joint itself exactly where the
     * planting correction put it.
     */
    writeToeLift() {

        // The fore-and-aft half, shared by both feet because the centre of pressure moves under
        // both at once. Negative z is BACKWARD on this rig, and backward is what takes the pressure
        // off the toes — hence the negation. Clamped at zero so the toes can only ever leave the
        // floor: the loaded direction has nowhere to go and the planting gate is why.
        const copLift = this.toeCopLiftEnabled
            ? Math.max( -this.displacement.z, 0 ) / TOE_COP_REFERENCE_EXCURSION_METRES
            : 0;

        for ( const foot of this.feet ) {

            if ( foot.toes === undefined || isPresent( foot.toes.bone ) === false ) continue;

            // The two mechanisms are the LARGER of the two rather than their sum. They are two
            // readings of one quantity — how hard this foot's forefoot is pressed — and adding them
            // would double-count a frame where the body is both leaning back and standing on the
            // other leg. `Math.min( ..., 1 )` is then redundant, which is the point: neither branch
            // can carry the toes past the ceiling that was argued for one full unload.
            const unloaded = Math.max( this.unloadFractionOf( foot ), copLift );

            const lift = Math.min( unloaded, 1 ) * this.toeLiftDegrees * Math.PI / 180;

            this.toeLiftRadians[ foot.key ] = lift;

            if ( lift === 0 ) continue;

            // Negative about +X carries the far end of a forward-pointing bone upward, which is the
            // same sign trap the pose files warn about — the toes point along +Z, not down.
            this.scratchAxisRotation.setFromAxisAngle( RIG_MEDIO_LATERAL_AXIS, -lift );

            toBoneDeltaFrame( this.scratchAxisRotation, foot.toes.restFrame, this.scratchBoneDelta );

            this.contribution.rotateBone( foot.toes.boneName, this.scratchBoneDelta );

        }

    }

    /**
     * Where the contrapposto alone would put one ankle this frame, in rig space.
     *
     * The pose response was measured with no lean applied, so it cannot simply be added to the
     * pendulum's arc: everything below the pelvis rides the lean, and the pelvis's own travel
     * does not. Splitting the measured displacement into the part the pelvis translated and the
     * part the legs articulated, and rotating only the second by the lean, is what makes the two
     * processes compose exactly instead of leaving a cross term behind.
     */
    stanceAnkleTravel( foot, target ) {

        if ( this.stanceBlend === 0 ) return target.set( 0, 0, 0 );

        const blend = Math.abs( this.stanceBlend );
        const side = this.stanceBlend > 0 ? 'left' : 'right';

        this.stanceHipsOffset( blend, side, this.scratchPelvisTravel );

        return this.sampleStanceAnkle( this.stanceResponse[ side ].ankle[ foot.key ], blend, target )
            .sub( this.scratchPelvisTravel )
            .applyQuaternion( this.ankleRotation )
            .add( this.scratchPelvisTravel );

    }

    /**
     * Reads the ankle's travel off the bind-time table, interpolating between the two probes the
     * requested blend falls between.
     *
     * Piecewise-linear rather than a fitted curve because the table is dense enough that the
     * residual is a hundredth of a millimetre, and because a reader can check a table against the
     * rig by hand. Below the first probe it interpolates from the origin, which is exact: a blend
     * of zero is the rest pose by definition.
     */
    sampleStanceAnkle( table, blend, target ) {

        const scaled = Math.min( Math.max( blend, 0 ), 1 ) * STANCE_ANKLE_PROBE_COUNT;
        const upper = Math.min( Math.ceil( scaled ), STANCE_ANKLE_PROBE_COUNT );

        if ( upper <= 0 ) return target.set( 0, 0, 0 );

        const mix = scaled - ( upper - 1 );

        // The entry below the first probe is the origin, not table[-1].
        if ( upper === 1 ) return target.copy( table[ 0 ] ).multiplyScalar( mix );

        return target.copy( table[ upper - 2 ] ).lerp( table[ upper - 1 ], mix );

    }

    /** A sagittal lean and a frontal lean, composed into one rig-space rotation. */
    composeRigRotation( anteroPosteriorRadians, medioLateralRadians ) {

        this.scratchRigRotation.setFromAxisAngle( RIG_MEDIO_LATERAL_AXIS, anteroPosteriorRadians );
        this.scratchAxisRotation.setFromAxisAngle( RIG_FORWARD_AXIS, medioLateralRadians );

        // At well under a degree the two rotations commute to five decimal places, so the order
        // here is a readability choice rather than a correctness one.
        this.scratchRigRotation.multiply( this.scratchAxisRotation );

    }

    // --- helpers ------------------------------------------------------------------------------

    spineJoints() {

        return this.joints.filter( ( joint ) => joint.pendulum === 'spine' );

    }

}

// --- local helpers ----------------------------------------------------------------------------

const IDENTITY = new Quaternion();

/**
 * 🎯 HOW MUCH LONGER A LARGE POSTURAL EVENT TAKES THAN AN AVERAGE ONE — the constant that stops a
 * fidget from being a startle.
 *
 * 🚩 THE DEFECT THIS FIXES IS A DISTRIBUTION LEAKING INTO A DERIVATIVE, and every gate in this file
 * was blind to it because they all gate positions. `drawAmplitude` is a lognormal whose standard
 * deviation EXCEEDS its mean, deliberately and correctly (§1.7c). The event shapes had FIXED
 * durations — 1.8 s for a fidget, 0.8 s for a shift's settle — so peak SPEED was amplitude divided
 * by a constant, and it inherited that whole skewed tail undivided.
 *
 * Measured on the shipped layer, seed 1: the pelvis went from -0.4 px at t = 210.5 s to -32.9 at
 * 211.0 — **32.5 px, 49 mm, in half a second, about 99 mm/s** — and was fully back by 212.5. This
 * layer's own mean resultant centre-of-pressure velocity is **18.22 mm/s** (docs/PROGRESS.md),
 * against Quijoux's 11-20 mm/s eyes-open band. A 61 mm round trip inside two seconds has a
 * transfer's amplitude and a fidget's return, and it was the largest postural event in the clip.
 *
 * ⚠️ THE RULE IS AN ASSUMPTION AND IS STATED AS ONE, because the alternative is worse. Duarte's
 * only word about the timing of either fast pattern is *"fast"*, and he reports no fidget amplitude
 * at all — so the record does not decide between "one duration for every event" and "one speed for
 * every event". What the record DOES say is that the amplitudes are lognormal with SD > mean. Read
 * one duration into "fast" and the speed distribution has that tail; read one speed into it and the
 * duration distribution does, which is invisible. Between two readings of one word, the one that
 * does not put a startle in a quiet-standing idle is the honest choice.
 *
 * So: an event at or below its axis's mean amplitude is EXACTLY as it was — the median event, every
 * rate gate, every spectral gate and the legibility section are untouched — and an event above it
 * is stretched in proportion, holding peak speed at the mean event's. `Math.max( 1, ... )` is the
 * whole of that: it is a rule about the tail and nothing else.
 */
function eventStretch( amplitude, settings, enabled ) {

    if ( enabled === false ) return 1;

    return Math.max( 1, Math.abs( amplitude ) / settings.shiftAmplitude );

}

/**
 * 🎯 SPEND THE FREE LEVER BEFORE THE EXPENSIVE ONE — and there are two, which is the whole reason
 * this is a function rather than one multiplication.
 *
 * Holding a fidget's peak speed constant means holding its RISE TIME proportional to its amplitude,
 * and rise time is `duration x riseFraction`. Those two factors do not cost the same thing:
 *
 *   THE RISE FRACTION IS FREE. Moving it leaves the event's total length alone, so it moves no
 *   power in the composite spectrum at all. It is bounded by shape rather than by cost: past 0.5
 *   the rise is longer than the return and Duarte's fast-out, slow-back reading is inverted. From a
 *   base of 0.25 that allows a factor of 2.
 *
 *   THE DURATION IS NOT FREE, and `FIDGET_DURATION_SECONDS` is where the price is written down: a
 *   1.2/min process with a multi-second time constant puts real power below 0.25 Hz and drags the
 *   composite lateral spectral mode out of the postural band with it. Measured this round — with
 *   the whole stretch taken out of duration, `idle-motion.selftest.mjs`'s median across twelve
 *   seeds fell from **0.264 Hz to 0.234**, under its 0.250 floor, and re-solving the base duration
 *   down to 1.3 s to recover it put the peak speed back to ~126 mm/s, which is no better than the
 *   defect being fixed. Two levers pulling opposite ways on one number.
 *
 * So the rise fraction absorbs everything up to twice the mean amplitude, and only past that does
 * the duration start to grow. Measured on the lognormal this layer draws from (mu 2.400, sigma
 * 1.176), that is the difference between lengthening **35%** of fidgets and lengthening **12%**.
 *
 * @returns {{ riseFraction: number, durationSeconds: number }}
 */
function fidgetShapeFor( amplitude, settings, profile, enabled ) {

    const ratio = eventStretch( amplitude, settings, enabled );
    const riseStretch = Math.min( ratio, FIDGET_RISE_STRETCH_CEILING / profile.riseFraction );

    return {
        riseFraction: profile.riseFraction * riseStretch,
        durationSeconds: profile.durationSeconds * ( ratio / riseStretch )
    };

}

function createAxisState( settings, limit, schedules = {} ) {

    return {
        settings,
        limit,             // metres, read off the rig's base of support at bind
        displacement: 0,   // metres, this frame
        shiftTarget: 0,    // where the stance is heading
        shiftCurrent: 0,   // where the stance is now
        fidgetRemaining: 0,
        fidgetAmplitude: 0,
        fidgetDuration: 0,       // seconds, drawn per event — see fidgetShapeFor
        fidgetRiseFraction: 0,   // where the peak sits, drawn per event — see fidgetShapeFor
        shiftSettleSeconds: SHIFT_SETTLE_SECONDS,

        // The two arrival processes, each on its own stream. Null until `buildSchedules` runs at
        // bind; carried across a `reset()` so a layer reset outside the stack still has them, and
        // replaced wholesale by the `onBind` the stack runs immediately afterwards.
        fidgets: schedules.fidgets ?? null,
        shifts: schedules.shifts ?? null
    };

}

/**
 * One driven joint. Everything a frame needs is preallocated here, because the frame loop walks
 * eleven of these and allocating a quaternion per joint per frame is exactly the kind of cost
 * that never gets found later because it never looks like the problem.
 */
function createJointState( entry, boneName ) {

    return {
        humanoid: entry.humanoid,
        parent: entry.parent,
        pendulum: entry.pendulum,
        boneName,
        bone: null,
        foot: undefined,   // set on the two 'plant' joints; see the constructor
        share: 0,          // this joint's slice of the pendulum lean
        spineFraction: 0,  // this joint's slice of an angle spread over the spine alone

        restFrame: new Quaternion(),
        restPosition: new Vector3(),
        relaxedAccumulated: new Quaternion(),
        relaxedAccumulatedInverse: new Quaternion(),

        pendulumCumulative: new Quaternion(),
        stanceAccumulated: new Quaternion(),
        stanceCumulative: new Quaternion(),
        cumulative: new Quaternion(),
        rigRotation: new Quaternion()
    };

}

/**
 * A fidget's profile over its own duration, peaking at 1 and starting and ending at 0.
 *
 * Fast out, slow back — see FIDGET_DURATION_SECONDS. Two raised cosines rather than one, which is
 * what makes the two halves independently timed; the symmetric single cosine it replaced is the
 * special case at a rise fraction of 0.5.
 */
function fidgetShape( progress, riseFraction ) {

    if ( progress <= 0 || progress >= 1 ) return 0;

    if ( progress < riseFraction ) {

        return 0.5 * ( 1 - Math.cos( Math.PI * progress / riseFraction ) );

    }

    const release = ( progress - riseFraction ) / ( 1 - riseFraction );

    return 0.5 * ( 1 + Math.cos( Math.PI * release ) );

}

/** The two probes a secant solve remembers: the last angle tried and the error it produced. */
function createRightingSolve() {

    return { angle: 0, error: NaN };

}

/**
 * One secant step toward the angle that drives `error` to zero.
 *
 * The first call has only one probe, so it takes the caller's `firstGuess` — a first-order estimate
 * that ignores the counter-bend's effect on the centre of mass. Every call after that has two probes
 * and solves the line through them, which lands exactly, because the relation between the angle and
 * the error is linear to well past the angles this file reaches.
 *
 * A degenerate pair — two probes with the same error, which means the angle does nothing — returns
 * the angle unchanged rather than dividing by zero and flinging the figure.
 */
function secantStep( solve, angle, error, firstGuess ) {

    const previous = solve.angle;
    const previousError = solve.error;

    solve.angle = angle;
    solve.error = error;

    if ( Number.isNaN( previousError ) ) return angle + firstGuess;

    const slope = ( error - previousError ) / ( angle - previous );

    if ( Number.isFinite( slope ) === false || Math.abs( slope ) < 1e-6 ) return angle;

    return angle - error / slope;

}

function createStanceResponse() {

    return {
        usable: false,
        centreOfMass: new Vector3(),   // what the blend is SOLVED against
        head: new Vector3(),           // reported only; an output of the pose, never an input

        // Where each ankle sits at blend (index + 1) / STANCE_ANKLE_PROBE_COUNT, as an absolute
        // displacement from rest rather than a per-unit rate — the whole point is that dividing
        // by the blend does not give a constant. Index 0 is the smallest non-zero blend; blend 0
        // is the origin and needs no entry. See STANCE_ANKLE_PROBE_COUNT.
        ankle: {
            left: Array.from( { length: STANCE_ANKLE_PROBE_COUNT }, () => new Vector3() ),
            right: Array.from( { length: STANCE_ANKLE_PROBE_COUNT }, () => new Vector3() )
        }
    };

}

/**
 * The topmost ancestor of a bone — the loaded figure's scene root.
 *
 * The bind-time probes need `updateMatrixWorld` over the WHOLE rig, not just the driven chain:
 * the centre of mass reads hands and feet that ride the pose without being posed by it, and
 * `Object3D.updateWorldMatrix( true, false )` walks up, not down. The motion target does not
 * expose a root, so it is found by walking.
 */
function rootOf( bone ) {

    let node = bone;

    while ( node.parent !== null ) node = node.parent;

    return node;

}

function isPresent( bone ) {

    return bone !== null && bone !== undefined;

}

/**
 * The signed angle of the component of `rotation` that turns about `axis` — the twist half of a
 * swing-twist decomposition, returned as an angle rather than as a quaternion because the caller
 * wants to scale it.
 *
 * The decomposition is exact for a unit axis: project the quaternion's vector part onto the axis,
 * keep the scalar part, renormalise, and what is left is a pure rotation about the axis whose
 * companion swing carries everything perpendicular to it. `atan2` rather than `2 * acos( w )` so
 * the sign survives, which matters here — a foot turns out on one side and in on the other.
 *
 * A rotation of exactly pi about an axis perpendicular to `axis` is the degenerate case, where the
 * projection vanishes and the twist is undefined; it returns zero, which is the harmless answer and
 * is three orders of magnitude away from anything this layer produces.
 */
function twistAngleAbout( rotation, axis ) {

    const alongAxis = rotation.x * axis.x + rotation.y * axis.y + rotation.z * axis.z;
    const length = Math.hypot( alongAxis, rotation.w );

    if ( length < 1e-8 ) return 0;

    return 2 * Math.atan2( alongAxis / length, rotation.w / length );

}

function worldPositionOf( bone, target ) {

    if ( isPresent( bone ) === false ) return target.set( 0, 0, 0 );

    bone.updateWorldMatrix( true, false );

    return target.setFromMatrixPosition( bone.matrixWorld );

}

/**
 * The height of the sole under one foot, taken from the toe joint when the rig has one. The toe
 * sits lower than the ankle and close to the ground, which makes it a better floor probe than
 * assuming y = 0 — a figure standing on a plinth still pivots about its own feet.
 */
function toeHeightOf( footBone, scratch ) {

    const toe = footBone.children.find( ( child ) => child.isBone === true ) ?? footBone;

    return worldPositionOf( toe, scratch ).y;

}
