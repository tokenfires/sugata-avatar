/**
 * IKSolver — the analytic two-bone solve, and the pelvis drop that stops a knee bend from putting
 * the figure on stilts.
 *
 * This is a SOLVER, not a Layer. Nothing here touches a bone, a mesh or the scene graph: every
 * function takes numbers in and hands numbers back, so `Sway`, a future `Gesture` layer or a
 * selftest with no figure at all can drive the same code. That is deliberate, and it is the one
 * design decision the whole file hangs off — see THE FRAME, below, for why it also makes the
 * output drop into `MotionStack` with no wrapper.
 *
 *
 * 🎯 THE DELIVERABLE IS NOT "AN IK SOLVER". IT IS A KNEE BEND THAT KEEPS THE FOOT ON THE FLOOR.
 *
 * Punch-list 6.2(a) is blocked on this in its own words: *"A knee bend that does not also lower
 * the pelvis is a figure on stilts; doing it right is 6.5's analytic two-bone solve plus a pelvis
 * offset plus a foot re-plant."* So the two-bone solve below is the mechanism and
 * `planPlantedKneeBend` is the item: commanded knee flexion in, a root translation and two joint
 * corrections per leg out, with both ankles left exactly where they were.
 *
 * 🚩 AND THE COST OF GETTING IT WRONG IS BIGGER ON THIS RIG THAN THE SURVEY SAID, BECAUSE THE
 * SURVEY MEASURED A LEG THIS FIGURE DOES NOT STAND ON.
 *
 * `docs/research/ik-and-springbones.md` §2.2 computes the stilts error by flexing a STRAIGHT leg:
 * `(L₁+L₂) − √(L₁²+L₂²+2L₁L₂cos θ)`, crossing 1.6 px at 8.9306°. Measured here on
 * `figure_g050.glb` in `relaxed-standing` — the posture the motion stack actually runs in — the
 * knee already carries **6.8176° of flexion** and the hip sits **1.4187 mm inside full reach**.
 * The lift is quadratic in the angle, so starting from a bent knee costs more per degree:
 *
 *     added flexion    lift from a STRAIGHT leg      lift from THIS RIG'S REST POSE
 *              5°       0.763 mm  =  0.50 px          2.842 mm  =  1.87 px
 *             10°       3.051 mm  =  2.01 px          7.201 mm  =  4.73 px
 *             20°      12.182 mm  =  8.01 px         20.439 mm  = 13.44 px
 *
 * 1.68× at 20°. Both columns at the repo's own 0.6574 px/mm (1200 px over a 1825.4 mm frame,
 * LEARNINGS §1.10a), measured by `IKSolver.selftest.mjs`'s ON STILTS section rather than typed.
 *
 * ⚠️ AND THE THRESHOLD THOSE PIXELS ARE COMPARED AGAINST IS NOT A MEASUREMENT. LEARNINGS §1.14a
 * audited the 1.6 px indistinguishability floor and found it quoted out of a block `PROGRESS.md`
 * marks superseded, internally inconsistent by 1.85×, and never a threshold measurement in the
 * first place: *"the honest statement is a bracket, 0.48 px to 10.6 px — a factor of 22 — and
 * 1.6 px is a point inside it with no measurement behind it."* Carried through to this rig's rest
 * pose, the added flexion at which a missing pelvis drop becomes visible is therefore a BAND:
 *
 *     0.48 px (below threshold, judge: "the hands never move")   1.574° of added flexion
 *     1.6  px (the unsupported point)                            4.420°
 *     10.6 px (above threshold, judge counted the events)       17.197°
 *
 * So: below about 1.6° the drop provably does not matter, above about 17° it provably does, and
 * the 10× in between is a question this repository cannot currently answer. Quote the band.
 *
 *
 * WHY THIS IS A REIMPLEMENTATION OF `ozz-animation` AND NOT `three.js`'s `CCDIKSolver`
 *
 * `CCDIKSolver` writes `link.quaternion.multiply( … )` in place and calls
 * `link.updateMatrixWorld( true )` per link per iteration. `MotionStack` owns every declared
 * channel absolutely — *"once a channel is declared by any layer, nothing outside the stack may
 * write it, ever"* (`MotionStack.js:23-24`) — and commits `rest × δ₁ × δ₂ × …` once. Using a
 * solver that mutates needs a seven-step snapshot/write/solve/diff/restore wrapper.
 *
 * `ozz::animation::IKTwoBoneJob` needs none of it. Read at
 * `github.com/guillaumeblanc/ozz-animation/src/animation/runtime/ik_two_bone_job.cc` (fetched
 * 2026-08-16, MIT): it consumes three model-space matrices and emits two correction quaternions,
 * and its header states their frame — *"Local-space corrections to apply to start and middle
 * joints… These quaternions must be multiplied to the local-space quaternion of their respective
 * joints"* (`ik_two_bone_job.h:111-114`).
 *
 * 🎯 THAT IS EXACTLY A `MotionStack` DELTA, AND THE COINCIDENCE IS STRUCTURAL RATHER THAN LUCKY.
 * The stack commits `bone.quaternion = restLocal × δ₁ × δ₂ × …`, post-multiplying each layer's
 * delta in its own frame. ozz post-multiplies its correction onto the joint's local rotation. So
 * if the chain handed to the solver is the pose composed SO FAR this frame, the correction it
 * returns *is* this layer's `contribution.boneRotations` entry, with no conjugation and no
 * conversion. `docs/research/ik-and-springbones.md` §1.6 writes out a seven-step wrapper; steps
 * 1–7 all belong to `CCDIKSolver` and none of them applies here.
 *
 * ⚠️ WHAT THAT BUYS COMES WITH ONE ORDERING OBLIGATION. A layer must be the LAST writer of the
 * bones it IKs, because the delta it computed is the one that lands after every delta already
 * composed. `Sway` sits at `MOTION_ORDER.SWAY` (300) and drives both legs; an IK layer therefore
 * belongs at `GESTURE` (400) or later. And it must be handed the composed pose, which is not what
 * is in `bone.matrixWorld` during `update()` — the bones still hold LAST frame's commit, because
 * the stack does not write until `commit()`. A one-frame-late chain is a defensible choice for a
 * 10 Hz postural signal and a wrong one for a gesture; whoever builds the layer has to pick, and
 * this file cannot pick for them. Reported as a request rather than solved here.
 *
 *
 * THE FRAME, STATED ONCE, BECAUSE EVERY IK BUG IS A FRAME BUG
 *
 *   CHAIN SPACE      `startPosition/Rotation`, `midPosition/Rotation`, `endPosition`,
 *                    `targetPosition` and `poleVector` are all in ONE space of the caller's
 *                    choosing. Rig space is the right one for this project (`Skeleton.js` — the
 *                    normalised frame travels with the character, so turning the avatar 90° in
 *                    the scene does not turn a knee bend into a splay). World space works too:
 *                    the corrections come out identical, because both `startRotation` and the
 *                    rig-space start rotation transform by the same left-multiplication and it
 *                    cancels in the conjugation. `IKSolver.selftest.mjs` gates that.
 *
 *   MID AXIS         `midAxis` is in the MIDDLE JOINT'S OWN LOCAL SPACE, per ozz
 *                    (`ik_two_bone_job.h:72`). Not chain space. This is the one input whose frame
 *                    differs from its neighbours, it is the frame the survey did not state, and
 *                    it is LEARNINGS §1.7 waiting to happen. `TwoBoneSetup.readMidAxisFromPose()`
 *                    derives it correctly from a bent rest pose so nobody has to transcribe it.
 *
 *   OUTPUT           `startCorrection` and `midCorrection` are LOCAL post-multiply corrections:
 *                    `bone.quaternion = boneRestLocal × correction`, which is `MotionStack`'s
 *                    delta. `startCorrectionInChainSpace` is reported beside them for a caller
 *                    that wants the anatomical rotation — it is a diagnostic, not the output.
 *
 *   ROOT OFFSET      `PlantedKneeBendPlan.rootOffset` is in CHAIN space. 🚩 It is NOT what goes
 *                    into `contribution.offsetBone()`, which is *"in the bone's local space"*
 *                    (`Layer.js:265`) and lands as `bone.position = restPosition + offset` — the
 *                    PARENT's frame. On this rig `pelvis`'s parent is `Root`, whose rest rotation
 *                    relative to the rig is (−0.707107, 0, 0, 0.707107): a −90° turn about X, the
 *                    Z-up frame the GLB was authored in. Measured: a rig-space (0, −1, 0) drop
 *                    written raw into `pelvis.position` moves the pelvis (0, 0, +1) — **straight
 *                    forwards instead of down, at full magnitude**. Use `toBoneOffsetFrame()`.
 *
 *
 * THE DEGENERATE CASES, WHICH IS WHERE AN UNGUARDED PORT NaNs
 *
 * Four are named in `docs/research/ik-and-springbones.md` §1.3 and all four are real. Measured on
 * this rig's own radii (reach 802.038 mm, inner |L₁−L₂| 12.624 mm):
 *
 *   (a) TARGET BEYOND REACH      `cos β < −1` → `acos` NaN, and it bites at `reach + 1 µm`, not
 *                                at "obviously too far". One NaN quaternion poisons every
 *                                descendant matrix for the rest of the run.
 *   (b) TARGET INSIDE THE INNER RADIUS   `cos β > +1` → NaN. A 12.6 mm sphere around the hip.
 *   (c) ZERO-LENGTH SEGMENT      divides by zero in both cosines.
 *   (d) TARGET AT THE START JOINT  `d = 0` is the DENOMINATOR of the hip cosine → Infinity. It
 *                                needs its own branch, not a clamp.
 *
 * 🚩 THERE IS A FIFTH, THE SURVEY DID NOT NAME IT, AND ozz'S OWN DEFAULT WALKS INTO IT ON A
 * STANDING LEG.
 *
 * The chain plane is fixed by `cross( targetDirection, poleVector )`. When the pole is parallel to
 * the start→target axis that cross product is zero, the plane normal is undefined, and a naive
 * port divides by its length. ozz declines the problem in the header — *"IK chain orientation will
 * flip when target vector and the pole vector are aligned/crossing each other. It's caller
 * responsibility to ensure that this doesn't happen"* (`ik_two_bone_job.h:82-84`) — and then
 * defaults `pole_vector` to **+Y** (`:85`). A standing leg's hip→ankle axis is −Y. Measured on
 * `figure_g050` in `relaxed-standing`:
 *
 *     pole            |t̂ × p̂|  left    right     angle off the leg axis
 *     +Y (ozz default)          0.0203   0.0678    1.16° / 3.89°
 *     +Z (forward)              0.9998   0.9995   88.84° / 88.17°
 *
 * At 0.02 the plane normal is 2% of unit length and the knee's direction is being set by the
 * 1.16° of forward lean the rest pose happens to carry. **A knee wants a FORWARD pole.** This
 * file keeps ozz's +Y default for fidelity with the primary, guards the exact singularity, and
 * reports `poleConditioning` on every solve so a caller can gate on it rather than discover it.
 *
 *
 * CONDITIONING AT FULL EXTENSION, AND WHY THIS RIG IS NOT IN IT
 *
 * Flexion goes as `√(reach − d)`, so its derivative diverges as the leg straightens. The survey's
 * table is right and its implication for this figure is not: `relaxed-standing` sits 1.4187 mm
 * inside reach, where the measured sensitivity is **2.40 °/mm** — not the 27–90 °/mm of the last
 * hundredth of a millimetre. A micron of target noise is 0.0024° of knee here. The conditioning
 * problem belongs to a leg driven to full extension, which is a locomotion problem, not an idle
 * one; `soften` below is the published answer when it arrives.
 *
 * 🚩 TWO CORRECTIONS TO THE SURVEY'S ACCOUNT OF `soften`, BOTH MEASURED.
 *
 * §1.4 reads: *"The default is `soften = 1.f` … which places the band's start at the full chain
 * length — i.e. the softening only shapes the region beyond reach, turning the hard clamp of
 * §1.3(a) into a smooth asymptote."* **At the default there is no softening at all.** ozz gates
 * the branch on four comparisons and the fourth is `ds > 0` (`ik_two_bone_job.cc:143,150`), where
 * `ds = chainLength − da` and `da = chainLength × soften`. At `soften = 1`, `ds` is exactly zero,
 * the branch is skipped, and what remains is precisely the hard clamp — which is why the clamp on
 * `acos` is load-bearing and not belt-and-braces. Softening does something only below 1.
 *
 * And ozz's own comment on the curve, *"The derivative must be 1 for x = 0"*, is wrong about its
 * own function: measured, it is **4/3**. So where the band does engage, the softened target moves
 * 33% faster than the raw target at the band edge and the join is C⁰ but not C¹.
 *
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 *
 * IT DOES NOT MODEL BALANCE. `Sway.js` owns the pelvis, both legs, both feet and a footprint clamp
 * read off this bake's own mesh — 179.4 mm forward and 54.4 mm behind the ankle midpoint,
 * re-measured here rather than quoted. A second balance model in this file would be a duplicate
 * that cannot see the first one's clamp. `planPlantedKneeBend` is careful to leave the ankles
 * exactly where it found them precisely so that clamp stays valid: the base of support is a fact
 * about where the feet are, and this file does not move them.
 *
 * IT DOES NOT KNOW HOW FAR TO BEND THE KNEE. `ExpressionMap.js` prescribes
 * `fearful: { kneeActivation: 1.77 }`, and `PostureLayer.js` derives every full scale from
 * Coulson Table 1 — which has six columns and none of them is a knee (`PostureLayer.js:113-121`),
 * and `grep -i knee docs/research/body-motion-numbers.md` returns nothing. 1.77 is a relative
 * weight with no full scale to weight. That is a research gap, and the honest thing this file can
 * do about it is state the mechanism in degrees and refuse to invent the degrees.
 *
 * IT DOES NOT AIM THE FOOT. ozz's `foot_ik` sample is a seven-step recipe and step 7 is a second,
 * aim-IK solve that puts the sole on the floor: *"A two-bone solve positions the ankle and says
 * nothing about which way the sole points."* On this figure the ankles do not move, so the soles
 * stay flat by construction — but the moment a caller supplies its own `ankleTarget`, the aim
 * solve becomes necessary and it is not in this file.
 *
 * Usage:
 *
 *     const setup = new TwoBoneSetup();
 *     setup.readChain( hip.matrixWorld, knee.matrixWorld, ankle.matrixWorld );
 *     setup.readMidAxisFromPose();          // the hinge, from the rest pose, once
 *     setup.poleVector.set( 0, 0, 1 );      // forward — NOT ozz's +Y default, see above
 *
 *     const plan = planPlantedKneeBend( { legs: [ { setup: left, flexionRadians: 0.35 },
 *                                                 { setup: right, flexionRadians: 0.35 } ] } );
 *
 *     contribution.offsetBone( 'pelvis', ...toBoneOffsetFrame( plan.rootOffset, rootRestFrame ) );
 *     contribution.rotateBone( 'thigh_l', plan.legs[ 0 ].solution.startCorrection );
 *     contribution.rotateBone( 'calf_l',  plan.legs[ 0 ].solution.midCorrection );
 */

import { Quaternion, Vector3 } from 'three';

// --- measured constants -------------------------------------------------------------------

/**
 * One float32 unit in the last place at metre scale, computed rather than typed.
 *
 * Every position this solver reads arrives from a glTF accessor, which is float32, so two joints
 * closer together than this are not distinguishable in the source data and calling their
 * separation a bone length is reading noise. It is the threshold for "this segment has no
 * length" and for "the target is at the start joint", both of which are divisions.
 *
 * ⚠️ It is deliberately NOT a tolerance on the solve. A tolerance would be a taste value with no
 * source; this is a property of the file format.
 */
const FLOAT32_ULP_AT_ONE_METRE = Math.fround( 1 + 2 ** -23 ) - 1;

/** Below this, a segment or a target distance is treated as zero. See above: 1.192e-7 m. */
const DEGENERATE_LENGTH_METRES = FLOAT32_ULP_AT_ONE_METRE;

/**
 * Below this, `cross( targetDirection, poleVector )` is treated as having no direction, so the
 * chain-plane rotation is skipped rather than divided by. Both inputs are unit vectors, so the
 * cross product's length is the sine of the angle between them and this is a sine: one float32
 * ULP of it is 6.8e-6 degrees off parallel.
 *
 * 🚩 This is the HARD singularity only. The SOFT problem — a pole 1.16° off the leg axis, which
 * is what ozz's +Y default gives a standing figure — is not guarded, because there is no
 * defensible threshold to guard it with and a silent clamp would hide it. It is reported as
 * `TwoBoneSolution.poleConditioning` instead, and the selftest measures what it costs.
 */
const DEGENERATE_SINE = FLOAT32_ULP_AT_ONE_METRE;

/**
 * ozz's soften curve, `ratio = 3⁴ / (α + 3)⁴`, with the base and exponent named rather than
 * inlined so the shape is legible: `ik_two_bone_job.cc:154-161`, whose own comment reads
 * *"Approximate an exponential function with : 1-(3^4)/(alpha+3)^4. The derivative must be 1 for
 * x = 0, and y must never exceeds 1."*
 *
 * ⚠️ The derivative is 4/3, not 1 — measured in `IKSolver.selftest.mjs`. The asymptote claim is
 * right: `ratio → 0` as `α → ∞`, so the softened length approaches the chain length and never
 * exceeds it, which is the property that turns "beyond reach" from a hard clamp into a limit —
 * for `soften < 1`. At `soften = 1` the band has no width and none of this runs; see the header.
 */
const SOFTEN_CURVE_BASE = 3;
const SOFTEN_CURVE_EXPONENT = 4;
const SOFTEN_CURVE_NUMERATOR = SOFTEN_CURVE_BASE ** SOFTEN_CURVE_EXPONENT;

/** Where the chain sits relative to the two radii it cannot cross. Reported, never guessed. */
export const IK_BRANCH = {
    INTERIOR: 'interior',                     // |L₁−L₂| ≤ d ≤ L₁+L₂ — the solvable annulus
    BEYOND_REACH: 'beyondReach',              // d > L₁+L₂ — the chain straightens and falls short
    INSIDE_INNER_RADIUS: 'insideInnerRadius'  // d < |L₁−L₂| — the chain folds and still overshoots
};

/** The three inputs that make the solve undefined rather than merely unreachable. */
export const IK_DEGENERATE = {
    ZERO_SEGMENT: 'zeroSegment',        // a bone with no length; both cosines divide by zero
    TARGET_AT_START: 'targetAtStart',   // d = 0; the hip cosine divides by zero
    POLE_ALIGNED: 'poleAligned'         // pole ∥ start→target; the chain plane has no normal
};

// --- module scratch -----------------------------------------------------------------------
//
// Preallocated once and consumed inside the synchronous call that fills it, the way `Layer.js`
// and `RestPose.js` already do it. A frame is single-threaded, and a solver called twice per
// frame per limb must not allocate.

const scratchStartToMid = new Vector3();
const scratchMidToEnd = new Vector3();
const scratchStartToEnd = new Vector3();
const scratchStartToTarget = new Vector3();
const scratchMidAxisChain = new Vector3();
const scratchPole = new Vector3();
const scratchTargetDirection = new Vector3();
const scratchChainDirection = new Vector3();
const scratchReferenceNormal = new Vector3();
const scratchJointNormal = new Vector3();
const scratchPlaneAxis = new Vector3();
const scratchBentSide = new Vector3();
const scratchEndToTarget = new Quaternion();
const scratchPlaneRotation = new Quaternion();
const scratchTwist = new Quaternion();
const scratchChainRotation = new Quaternion();
const scratchScale = new Vector3();
const scratchOffsetFrame = new Quaternion();

// --- the two-bone chain -------------------------------------------------------------------

/**
 * Everything one two-bone solve needs, as a struct the caller fills once and reuses.
 *
 * It is a struct rather than eight arguments for the reason the house style gives — past five or
 * six parameters a call site stops being readable — and because half of these fields (`midAxis`,
 * `poleVector`, `soften`) are rig constants that a layer resolves at bind and never touches
 * again, while the other half change every frame.
 */
export class TwoBoneSetup {

    constructor() {

        // The chain, in ONE space of the caller's choosing. See THE FRAME in the header.
        this.startPosition = new Vector3();
        this.startRotation = new Quaternion();
        this.midPosition = new Vector3();
        this.midRotation = new Quaternion();
        this.endPosition = new Vector3();

        /** Where the end joint is asked to land, in chain space. */
        this.targetPosition = new Vector3();

        /**
         * The hinge, in the MIDDLE JOINT'S LOCAL space — the one input in a different frame from
         * its neighbours. ozz: *"a positive rotation around this axis will open the angle between
         * the two bones"* (`ik_two_bone_job.h:74-76`). Defaults to ozz's +Z; call
         * `readMidAxisFromPose()` instead of transcribing one.
         */
        this.midAxis = new Vector3( 0, 0, 1 );

        /**
         * Which way the middle joint points, in chain space. ozz's default is +Y and that is the
         * worst possible value for a standing leg — see the header. A knee wants +Z.
         */
        this.poleVector = new Vector3( 0, 1, 0 );

        /**
         * The fraction of the chain length at which the target starts asymptoting instead of
         * being reached.
         *
         * ⚠️ 1 — ozz's default (`ik_two_bone_job.h:96`) — DISABLES softening entirely rather than
         * placing the band at full reach: the band's width is `chainLength − chainLength × soften`,
         * which is zero, and ozz's own guard requires it to be positive. Below 1 a leg visibly
         * never locks and the target asymptotes to the chain length instead of clamping to it;
         * there is no published value for how far below, and the selftest measures both regimes.
         */
        this.soften = 1;

        /** Rotation of the whole chain about the start→target axis, radians. ozz's `twist_angle`. */
        this.twistRadians = 0;

        /** 0 contributes nothing, 1 is the full solve. NLerped toward identity, as ozz does it. */
        this.weight = 1;

    }

    /**
     * Reads the chain out of three matrices — `bone.matrixWorld` is the usual source.
     *
     * Scale is decomposed and DISCARDED: a two-bone solve is a statement about rotations and fixed
     * lengths, and a correction that honoured a scaled joint frame would mean something different
     * on every bone.
     *
     * 🚩 THE SHIPPED RIG DOES NOT OBLIGE, AND THE SIZE OF THAT IS MEASURED RATHER THAN ASSUMED.
     * **36 of `figure_g050`'s 53 bones carry non-unit scale** — worst on `thigh_l` and `thigh_r` at
     * 3.9339e-6 off unity, with 3.6955e-6 of ANISOTROPY between axes, which is float32
     * quantisation of the exported node TRS rather than anything anyone authored. A non-uniform
     * parent scale means a child's world offset is not a pure rotation of its local offset, so a
     * rigid-chain model and the real skeleton disagree however exact the arithmetic is: bounded at
     * **3.16 µm over the 802 mm leg**, realised at 0.32 µm. `IKSolver.selftest.mjs` derives its
     * on-the-bones tolerance from that measurement, so a cleaner bake tightens the gate by itself.
     *
     * Normalising bone scale belongs to `tools/figure-pipeline/`, not here. Reported as a request.
     */
    readChain( startMatrix, midMatrix, endMatrix ) {

        startMatrix.decompose( this.startPosition, this.startRotation, scratchScale );
        midMatrix.decompose( this.midPosition, this.midRotation, scratchScale );
        endMatrix.decompose( this.endPosition, scratchChainRotation, scratchScale );

        return this;

    }

    /**
     * Derives the hinge axis from the bend the chain is currently in, and returns how well
     * determined it was.
     *
     * 🎯 THIS IS §1.3(d)'s RULE IN CODE: read the knee direction ONCE, from the rest pose, and
     * never from the live pose. At full extension the bend plane is undefined to within numerical
     * noise, so a per-frame read makes the axis jitter, which rotates the whole chain plane,
     * which snaps the knee sideways. `figure_g050` in `relaxed-standing` carries 6.8176° of knee
     * flexion, so this is well determined on the shipped rig (returns 0.119 — the sine of the
     * flexion angle) and would NOT be on a rig authored dead straight.
     *
     * The sign is forced, not chosen. ozz requires that a positive rotation about the axis OPENS
     * the interior angle, and `cross( midToEnd, startToMid )` is the direction that satisfies it:
     * with `n = startToMid × midToEnd`, the test ozz applies is
     * `dot( cross( startToMid, axis ), midToEnd )`, which for `axis = +n̂` evaluates to
     * `((a·b)² − |a|²|b|²) / |n| ≤ 0` and therefore reads as "bent the wrong way". `−n̂` is the
     * one that reads as bent the right way, and `−n̂ = midToEnd × startToMid`.
     *
     * @returns {number} `|sin(flexion)|` — 0 means the pose is straight and the axis it just
     *   wrote is noise. Check it; do not assume it.
     */
    readMidAxisFromPose() {

        scratchStartToMid.subVectors( this.midPosition, this.startPosition );
        scratchMidToEnd.subVectors( this.endPosition, this.midPosition );

        const bendNormal = scratchMidAxisChain.crossVectors( scratchMidToEnd, scratchStartToMid );

        const upperLength = scratchStartToMid.length();
        const lowerLength = scratchMidToEnd.length();
        const scale = upperLength * lowerLength;

        if ( scale < DEGENERATE_LENGTH_METRES * DEGENERATE_LENGTH_METRES ) return 0;

        const determination = bendNormal.length() / scale;

        if ( determination < DEGENERATE_SINE ) return 0;

        // Into the middle joint's own frame, which is the frame ozz states this input in.
        this.midAxis.copy( bendNormal ).normalize()
            .applyQuaternion( scratchChainRotation.copy( this.midRotation ).invert() );

        return determination;

    }

    /** Moves the whole chain, leaving the target where it is. Used by `planPlantedKneeBend`. */
    translate( offset ) {

        this.startPosition.add( offset );
        this.midPosition.add( offset );
        this.endPosition.add( offset );

        return this;

    }

    copy( other ) {

        this.startPosition.copy( other.startPosition );
        this.startRotation.copy( other.startRotation );
        this.midPosition.copy( other.midPosition );
        this.midRotation.copy( other.midRotation );
        this.endPosition.copy( other.endPosition );
        this.targetPosition.copy( other.targetPosition );
        this.midAxis.copy( other.midAxis );
        this.poleVector.copy( other.poleVector );

        this.soften = other.soften;
        this.twistRadians = other.twistRadians;
        this.weight = other.weight;

        return this;

    }

}

/**
 * What one solve produced, and enough of how it got there that a gate never has to recompute it.
 *
 * The two corrections are the output; everything else is measurement. That split is deliberate —
 * `docs/LEARNINGS.md` §1.1, a gate that has never failed is not known to work — and a solver
 * whose only output is two quaternions can only be checked by re-deriving its arithmetic
 * somewhere else, which checks the re-derivation.
 */
export class TwoBoneSolution {

    constructor() {

        /** Post-multiply onto the start joint's LOCAL rotation. This is a `MotionStack` delta. */
        this.startCorrection = new Quaternion();

        /** Post-multiply onto the middle joint's LOCAL rotation. */
        this.midCorrection = new Quaternion();

        /** The same start rotation expressed in chain space — a diagnostic, not the output. */
        this.startCorrectionInChainSpace = new Quaternion();

        this.upperLength = 0;
        this.lowerLength = 0;
        this.chainLength = 0;
        this.innerRadius = 0;

        /** How far the target actually is, and how far the solve aimed at after softening. */
        this.targetDistance = 0;
        this.solveDistance = 0;

        /** The interior angle at the middle joint the solve asked for, and its complement. */
        this.interiorRadians = Math.PI;
        this.flexionRadians = 0;

        /** How far the middle joint had to turn to get there. Signed about `midAxis`. */
        this.midDeltaRadians = 0;

        /**
         * `|t̂ × p̂|`. 1 is a pole square to the chain; 0 is the singularity. Measured on this rig
         * with ozz's default pole: 0.0203. See the header.
         */
        this.poleConditioning = 0;

        /** ozz's `reached`: inside the soften band's start AND outside the inner radius AND weight ≥ 1. */
        this.reached = false;

        this.branch = IK_BRANCH.INTERIOR;

        /** One of `IK_DEGENERATE`, or null. Non-null means the corrections are identity or partial. */
        this.degenerate = null;

    }

    reset() {

        this.startCorrection.identity();
        this.midCorrection.identity();
        this.startCorrectionInChainSpace.identity();

        this.upperLength = 0;
        this.lowerLength = 0;
        this.chainLength = 0;
        this.innerRadius = 0;
        this.targetDistance = 0;
        this.solveDistance = 0;
        this.interiorRadians = Math.PI;
        this.flexionRadians = 0;
        this.midDeltaRadians = 0;
        this.poleConditioning = 0;
        this.reached = false;
        this.branch = IK_BRANCH.INTERIOR;
        this.degenerate = null;

        return this;

    }

}

/**
 * The analytic two-bone solve. Closed form, no iteration, no bone writes.
 *
 * Two applications of the law of cosines and one plane rotation, in the order ozz establishes:
 *
 *   1. THE MIDDLE JOINT, from `cos β = (L₁² + L₂² − d²) / (2 L₁ L₂)`. Both the CORRECTED angle
 *      (from the softened target distance) and the INITIAL angle (from where the end joint
 *      actually is) are computed, and the correction is their difference — so the solve composes
 *      onto whatever the animation already did rather than replacing it.
 *
 *   2. THE INITIAL ANGLE'S SIGN, from which side of `midAxis` the chain is currently bent.
 *      🚩 Not optional. Without it a limb already bent the wrong way is "corrected" to the same
 *      numerical angle on the wrong side and stays inverted forever.
 *
 *   3. THE START JOINT, from the chain AFTER the middle correction has been applied. 🎯 This
 *      ordering is load-bearing: building the hip swing from the ORIGINAL end position reaches
 *      the target with the wrong knee angle, because the end joint it is swinging is no longer
 *      where the swing was computed for.
 *
 *   4. THE CHAIN PLANE, a rotation about the start→target axis that aligns the chain's own plane
 *      normal with `cross( target, pole )`. This is the degree of freedom the algebra cannot
 *      remove — three points and a distance fix the interior angle and leave the chain free to
 *      spin about the start→target line — so it must be supplied, and `poleVector` supplies it.
 *
 * @param {TwoBoneSetup} setup
 * @param {TwoBoneSolution} [solution] - Reused across frames. Allocated if omitted.
 * @returns {TwoBoneSolution} `solution`.
 */
export function solveTwoBone( setup, solution = new TwoBoneSolution() ) {

    solution.reset();

    const startToMid = scratchStartToMid.subVectors( setup.midPosition, setup.startPosition );
    const midToEnd = scratchMidToEnd.subVectors( setup.endPosition, setup.midPosition );
    const startToEnd = scratchStartToEnd.subVectors( setup.endPosition, setup.startPosition );
    const startToTarget = scratchStartToTarget.subVectors( setup.targetPosition, setup.startPosition );

    const upperLength = startToMid.length();
    const lowerLength = midToEnd.length();

    solution.upperLength = upperLength;
    solution.lowerLength = lowerLength;
    solution.chainLength = upperLength + lowerLength;
    solution.innerRadius = Math.abs( upperLength - lowerLength );
    solution.targetDistance = startToTarget.length();
    solution.solveDistance = solution.targetDistance;

    solution.branch = branchOf( solution.targetDistance, solution.chainLength, solution.innerRadius );

    // (c) A bone with no length divides by zero in both cosines. ozz reaches the same answer
    // structurally — an uninvertible joint matrix comes back all zeros and yields identity
    // corrections (`ik_two_bone_job.cc:60-62`) — and the behaviour is the one to copy: a limb
    // that cannot be solved contributes NOTHING, which in `MotionStack` terms is an identity
    // delta that `accumulate()` skips at `MotionStack.js:683`.
    if ( upperLength < DEGENERATE_LENGTH_METRES || lowerLength < DEGENERATE_LENGTH_METRES ) {

        solution.degenerate = IK_DEGENERATE.ZERO_SEGMENT;
        return solution;

    }

    // ozz early-outs on zero weight before it computes anything (`ik_two_bone_job.cc:342-351`).
    // The geometry above is filled first here regardless, because a caller ramping the weight
    // through zero still wants to know how far the target was.
    if ( setup.weight <= 0 ) return solution;

    applySoftening( setup, solution );

    const midDelta = solveMidJoint( setup, solution, startToMid, midToEnd, startToEnd );

    // (d) `d = 0` is the denominator of the hip cosine. It is a branch, not a clamp: the target
    // sits ON the start joint, so there is no direction to swing the chain toward and the knee
    // correction — which folds the chain as tight as it goes — is the whole of the answer.
    if ( solution.solveDistance < DEGENERATE_LENGTH_METRES ) {

        solution.degenerate = IK_DEGENERATE.TARGET_AT_START;
        applyWeight( solution.midCorrection, setup.weight );
        return solution;

    }

    solveStartJoint( setup, solution, startToMid, midToEnd, startToTarget, midDelta );

    applyWeight( solution.startCorrection, setup.weight );
    applyWeight( solution.midCorrection, setup.weight );

    return solution;

}

// --- the planted knee bend ------------------------------------------------------------------

/**
 * One leg's share of a planted knee bend: what it was asked for, what it got, and by how much.
 */
export class PlannedLeg {

    constructor() {

        /** The chain as SOLVED — the caller's setup translated by `rootOffset`, never mutated. */
        this.setup = new TwoBoneSetup();
        this.solution = new TwoBoneSolution();

        /** Where the ankle is being held. Copied before anything moves. */
        this.ankleTarget = new Vector3();

        /** The knee flexion this leg was commanded, and the one it carried before the plan ran. */
        this.commandedFlexionRadians = 0;
        this.restFlexionRadians = 0;

        /** The hip→ankle distance the commanded flexion asks for, and how far the root must travel
         *  along the travel axis, on its own, to deliver it. */
        this.wantedChainLength = 0;
        this.requiredTravel = 0;

        /**
         * 🎯 True when this leg cannot reach its commanded flexion by translating the root along
         * the travel axis at all — the axis misses the sphere. It is not an error: it is the
         * geometry saying the bend needs the root to move sideways as well, which is a decision
         * about balance and therefore `Sway`'s, not this file's.
         */
        this.travelLimited = false;

    }

}

/**
 * What a planted knee bend produced. `rootOffset` and the per-leg corrections are the output.
 */
export class PlantedKneeBendPlan {

    constructor() {

        /**
         * How far the root must move, in CHAIN space, for the ankles to stay planted. 🚩 Not a
         * bone-local offset — see THE FRAME in the header, and `toBoneOffsetFrame()`.
         */
        this.rootOffset = new Vector3();

        /** The signed distance along `travelAxis`. Positive means "further along the axis". */
        this.travelDistance = 0;

        /**
         * Which leg decided it. ozz's `foot_ik` step 5: *"Offsets the character down, so that the
         * LOWEST ankle … reaches its targetted position. The other leg(s) will be ik-ed."*
         */
        this.limitingLegIndex = -1;

        /** @type {PlannedLeg[]} */
        this.legs = [];

    }

}

/**
 * The item 6.2(a) is blocked on: bend the knees by a commanded amount and leave both feet where
 * they are.
 *
 * 🎯 THE ORDER IS THE WHOLE ALGORITHM, AND IT IS ozz's `foot_ik` ORDER, NOT AN OBVIOUS ONE.
 *
 *   1. Each leg says what hip→ankle distance its commanded flexion needs. Pure law of cosines.
 *   2. Each leg says how far the root would have to travel, ALONE, to put its hip that far from
 *      its own planted ankle. That is a ray/sphere intersection, not a subtraction — the legs are
 *      not vertical (this rig's are 1.16° and 3.89° off) and treating the drop as the ankle lift
 *      is wrong by the cosine.
 *   3. 🚩 THE LARGEST OF THOSE WINS, and it is a MAX rather than a mean. The lowest foot decides
 *      how far the body must come down; the other legs absorb the difference by bending FURTHER
 *      than commanded. Splitting the drop between the legs makes every foot float by half, which
 *      is a defect the selftest builds and measures rather than describes.
 *   4. 🚩 THE ROOT MOVES BEFORE THE SOLVE, NOT AFTER. ozz's step 5 precedes its step 6. Solving
 *      first and translating afterwards changes `d` for every leg and invalidates every solve —
 *      also measured.
 *   5. Each leg is then solved to its UNMOVED ankle target.
 *
 * ⚠️ WHAT THIS COSTS THE OTHER LEGS IS REAL AND IS REPORTED, NOT HIDDEN. Commanding 20° on one
 * knee and 0° on the other does not produce a 20°/0° figure — it produces a figure whose pelvis
 * dropped far enough for the bent leg, with the straight leg bent to whatever that drop demands.
 * That is what a body does. `PlannedLeg.solution.flexionRadians` is the realised angle and a
 * caller that needs the commanded one on both legs must move the root sideways too, which is a
 * balance decision and belongs to `Sway`.
 *
 * @param {Object} request
 * @param {Array<{ setup: TwoBoneSetup, flexionRadians: number, ankleTarget?: Vector3 }>} request.legs
 *   `flexionRadians` is the WANTED knee flexion measured from a straight leg, because that is what
 *   a joint angle is. `PlannedLeg.restFlexionRadians` reports what the pose already carried
 *   (6.8176° on this rig) so a caller driving an affect channel can add to it.
 *   `ankleTarget` defaults to where the ankle already is, which is the planted case.
 * @param {Vector3} [request.travelAxis] - Unit, chain space. Defaults to (0, −1, 0): straight down.
 * @param {PlantedKneeBendPlan} [plan] - Reused across frames. Allocated if omitted.
 * @returns {PlantedKneeBendPlan} `plan`.
 */
export function planPlantedKneeBend( request, plan = new PlantedKneeBendPlan() ) {

    const travelAxis = request.travelAxis ?? DEFAULT_TRAVEL_AXIS;

    while ( plan.legs.length < request.legs.length ) plan.legs.push( new PlannedLeg() );
    plan.legs.length = request.legs.length;

    plan.travelDistance = 0;
    plan.limitingLegIndex = -1;

    // 1 and 2 — what each leg needs on its own.
    for ( let index = 0; index < request.legs.length; index ++ ) {

        const requested = request.legs[ index ];
        const planned = plan.legs[ index ];

        planned.setup.copy( requested.setup );
        planned.ankleTarget.copy( requested.ankleTarget ?? requested.setup.endPosition );
        planned.commandedFlexionRadians = requested.flexionRadians;

        const upperLength = planned.setup.startPosition.distanceTo( planned.setup.midPosition );
        const lowerLength = planned.setup.midPosition.distanceTo( planned.setup.endPosition );
        const restDistance = planned.setup.startPosition.distanceTo( planned.setup.endPosition );

        planned.restFlexionRadians = flexionAtChainLength( upperLength, lowerLength, restDistance );
        planned.wantedChainLength = chainLengthAtFlexion( upperLength, lowerLength, requested.flexionRadians );

        planned.requiredTravel = rootTravelForChainLength(
            planned.setup.startPosition, planned.ankleTarget, travelAxis, planned.wantedChainLength );

        planned.travelLimited = isTravelLimited(
            planned.setup.startPosition, planned.ankleTarget, travelAxis, planned.wantedChainLength );

        // 3 — the lowest foot decides. A mean would float every foot by half the difference.
        if ( plan.limitingLegIndex === -1 || planned.requiredTravel > plan.travelDistance ) {

            plan.travelDistance = planned.requiredTravel;
            plan.limitingLegIndex = index;

        }

    }

    plan.rootOffset.copy( travelAxis ).multiplyScalar( plan.travelDistance );

    // 4 and 5 — move first, then solve every leg to the ankle it started on.
    for ( const planned of plan.legs ) {

        planned.setup.translate( plan.rootOffset );
        planned.setup.targetPosition.copy( planned.ankleTarget );

        solveTwoBone( planned.setup, planned.solution );

    }

    return plan;

}

// --- the arithmetic, exposed because callers and gates both need it -------------------------

/**
 * The distance from the start joint to the end joint when the middle joint carries `flexion`.
 *
 * Law of cosines with the interior angle written as `π − flexion`, so the sign of the cosine term
 * flips and a straight chain (flexion 0) reads `L₁ + L₂`:
 *
 *     d² = L₁² + L₂² − 2 L₁ L₂ cos( π − flexion ) = L₁² + L₂² + 2 L₁ L₂ cos( flexion )
 *
 * @param {number} upperLength
 * @param {number} lowerLength
 * @param {number} flexionRadians - 0 is straight, π is folded flat.
 * @returns {number}
 */
export function chainLengthAtFlexion( upperLength, lowerLength, flexionRadians ) {

    const squared = upperLength * upperLength + lowerLength * lowerLength
        + 2 * upperLength * lowerLength * Math.cos( flexionRadians );

    return Math.sqrt( Math.max( squared, 0 ) );

}

/**
 * The inverse: how flexed a chain of these two lengths is when its ends are `distance` apart.
 *
 * Clamped, so a distance outside the annulus returns the nearest attainable angle rather than
 * `NaN`. That is the guard §1.3(a) and (b) are about, and it is here rather than only inside the
 * solve because a caller planning a bend needs it before any solve happens.
 */
export function flexionAtChainLength( upperLength, lowerLength, distance ) {

    const scale = 2 * upperLength * lowerLength;

    if ( scale < DEGENERATE_LENGTH_METRES ) return 0;

    const cosine = ( upperLength * upperLength + lowerLength * lowerLength - distance * distance ) / scale;

    return Math.PI - Math.acos( clamp( cosine, -1, 1 ) );

}

/**
 * How far the start joint must travel along `travelAxis` for it to sit `wantedLength` from a
 * fixed end target.
 *
 * 🎯 A RAY/SPHERE INTERSECTION, NOT A SUBTRACTION, and the difference is what the naive version
 * gets wrong. `wantedLength − currentLength` is only the answer when the axis runs straight along
 * the chain. This rig's legs lean 1.16° and 3.89° off vertical, and the fore-and-aft offsets
 * `Sway` produces tilt them further.
 *
 * With `v = start − target`, `h` the travel and `û` the axis:
 *
 *     |v + h û|² = wantedLength²
 *     h² + 2 h (v·û) + |v|² − wantedLength² = 0
 *     h = −(v·û) ± √( (v·û)² − |v|² + wantedLength² )
 *
 * The NEAR root is always the right one, in both directions. Shortening the chain (a deeper bend)
 * puts the start joint inside the sphere and the near root is the first crossing; lengthening it
 * puts the start joint inside already and the near root is negative, which is the root that backs
 * the joint out the side it came in. The far root always takes the chain through and out the other
 * side, which is not a pose.
 *
 * ⚠️ When the axis misses the sphere entirely there is no root, and this returns the point of
 * closest approach — the travel that gets nearest to the wanted length. `isTravelLimited()` is the
 * companion that says whether that happened; the two are separate so the common path stays one
 * arithmetic expression with no branch to read.
 *
 * @param {Vector3} startPosition
 * @param {Vector3} endTarget
 * @param {Vector3} travelAxis - Unit.
 * @param {number} wantedLength
 * @returns {number} Signed travel along `travelAxis`.
 */
export function rootTravelForChainLength( startPosition, endTarget, travelAxis, wantedLength ) {

    const offset = scratchStartToEnd.subVectors( startPosition, endTarget );
    const along = offset.dot( travelAxis );
    const discriminant = along * along - offset.lengthSq() + wantedLength * wantedLength;

    if ( discriminant <= 0 ) return -along;

    return -along - Math.sqrt( discriminant );

}

/** Whether `rootTravelForChainLength` had a real root, or returned the closest approach instead. */
export function isTravelLimited( startPosition, endTarget, travelAxis, wantedLength ) {

    const offset = scratchStartToEnd.subVectors( startPosition, endTarget );
    const along = offset.dot( travelAxis );

    return along * along - offset.lengthSq() + wantedLength * wantedLength <= 0;

}

/**
 * Turns a chain-space translation into the offset `MotionContribution.offsetBone()` wants.
 *
 * 🚩 THE ONE-LINE FUNCTION THAT STOPS THE PELVIS GOING FORWARD INSTEAD OF DOWN. The stack commits
 * `bone.position = restPosition + offset` (`MotionStack.js:728`), and a bone's local position
 * lives in its PARENT's frame. On `figure_g050` the pelvis's parent is `Root`, carrying a −90°
 * rotation about X — the Z-up frame the GLB was authored in. Measured: a rig-space (0, −1, 0)
 * drop written raw into `pelvis.position` moves the pelvis (0, 0, +1) in rig space. Full
 * magnitude, wrong axis, and it looks like a lunge.
 *
 * `Skeleton.applyHipsOffset()` and `Sway`'s `pelvisParentFrameInverse` both already do exactly
 * this; the natural long-term home is beside `toBoneDeltaFrame()` in `Breath.js`, which is where
 * the rotational half of the same conversion lives. Filed as a request rather than moved, because
 * `Breath.js` is not this file's to edit.
 *
 * ⚠️ IT IS EXACT ONLY TO THE ASSET'S OWN PRECISION, AND THAT IS NOT A ROUNDING REMARK. The frame
 * this reframes THROUGH is normalised — `restRotationRelativeToRig` normalises on purpose, because
 * `Quaternion.invert()` is a conjugate and is the true inverse only of a unit quaternion — while
 * the frame the skeleton composes WITH is the raw float32 value out of the GLB. On `figure_g050`
 * those are `-0.7071067811865476` and `-0.7071067690849304`, 1.21e-8 apart per component, which
 * costs **0.52 nm on a 10.8 mm drop**. Measured, and asserted against the deliverable rather than
 * the ideal, in `IKSolver.selftest.mjs` §5.1. Do not "fix" it by dropping the normalise.
 *
 * @param {Vector3} chainSpaceOffset
 * @param {Quaternion} parentRestFrame - The parent bone's rest rotation relative to the rig root,
 *   from `Breath.js`'s `restRotationRelativeToRig( bone.parent )`.
 * @param {Vector3} [target]
 * @returns {Vector3} `target`
 */
export function toBoneOffsetFrame( chainSpaceOffset, parentRestFrame, target = new Vector3() ) {

    scratchOffsetFrame.copy( parentRestFrame ).invert();

    return target.copy( chainSpaceOffset ).applyQuaternion( scratchOffsetFrame );

}

// --- helpers ---------------------------------------------------------------------------------

const DEFAULT_TRAVEL_AXIS = new Vector3( 0, -1, 0 );

/**
 * ozz's `SoftenTarget`, which reparameterises the last `soften` fraction of the chain so the
 * target asymptotes to full reach instead of hitting it (`ik_two_bone_job.cc:113-179`).
 *
 * It also decides `reached`, and the condition is exactly ozz's `(comp_mask & 0x5) == 0x4`:
 * the target is NOT beyond the band's start AND IS outside the inner radius. Both degenerate radii
 * are reported through one boolean, which is the right shape for a gate.
 */
function applySoftening( setup, solution ) {

    const soften = clamp( setup.soften, 0, 1 );
    const bandStart = solution.chainLength * soften;
    const bandWidth = solution.chainLength - bandStart;

    if ( solution.targetDistance > bandStart && solution.targetDistance > 0 && bandWidth > 0 ) {

        const alpha = ( solution.targetDistance - bandStart ) / bandWidth;
        const ratio = SOFTEN_CURVE_NUMERATOR / ( ( alpha + SOFTEN_CURVE_BASE ) ** SOFTEN_CURVE_EXPONENT );

        solution.solveDistance = bandStart + bandWidth - bandWidth * ratio;

    }

    solution.reached = solution.targetDistance <= bandStart
        && solution.targetDistance > solution.innerRadius
        && setup.weight >= 1;

}

/**
 * The middle joint, and the sign test that is not optional.
 *
 * `midCorrection` is built directly about `setup.midAxis`, which is in the middle joint's own
 * local space — so what comes out is a local post-multiply correction and no conversion follows.
 *
 * @returns {number} The signed angle the middle joint turns through, about `midAxis`.
 */
function solveMidJoint( setup, solution, startToMid, midToEnd, startToEnd ) {

    const scale = 2 * solution.upperLength * solution.lowerLength;
    const sumOfSquares = solution.upperLength * solution.upperLength
        + solution.lowerLength * solution.lowerLength;

    // (a) and (b): both cosines leave [−1, +1] the moment the target leaves the annulus, and an
    // unclamped `acos` returns NaN at `reach + 1 µm` — not at "obviously too far".
    const wantedInterior = Math.acos( clamp(
        ( sumOfSquares - solution.solveDistance * solution.solveDistance ) / scale, -1, 1 ) );

    const currentDistance = startToEnd.length();
    let currentInterior = Math.acos( clamp(
        ( sumOfSquares - currentDistance * currentDistance ) / scale, -1, 1 ) );

    // 🚩 Which SIDE the chain is currently bent to. `acos` returns [0, π] and cannot tell a knee
    // bent forwards from one bent backwards, so a chain that is already inverted would be
    // "corrected" to the right number on the wrong side and stay inverted forever.
    const bentSide = scratchBentSide.copy( startToMid )
        .cross( chainSpaceMidAxis( setup ) );

    if ( bentSide.dot( midToEnd ) < 0 ) currentInterior = -currentInterior;

    const delta = wantedInterior - currentInterior;

    solution.interiorRadians = wantedInterior;
    solution.flexionRadians = Math.PI - wantedInterior;
    solution.midDeltaRadians = delta;

    solution.midCorrection.setFromAxisAngle( setup.midAxis, delta );

    return delta;

}

/**
 * The start joint: swing the corrected chain onto the target, then spin it about the start→target
 * axis until its plane holds the pole.
 *
 * 🎯 The chain it swings is the one the middle correction has ALREADY been applied to. Reversing
 * the two lands the end joint on the target with the wrong interior angle.
 */
function solveStartJoint( setup, solution, startToMid, midToEnd, startToTarget, midDelta ) {

    const midAxisChain = chainSpaceMidAxis( setup );

    // The chain as it will be once the middle joint has turned. Rotating `midToEnd` about the
    // chain-space hinge by `midDelta` is the same rotation as post-multiplying the local
    // correction onto the middle joint: `midRot · c · midRot⁻¹` is a turn about `midRot · midAxis`.
    const chainDirection = scratchChainDirection
        .copy( midToEnd ).applyAxisAngle( midAxisChain, midDelta )
        .add( startToMid ).normalize();

    const targetDirection = scratchTargetDirection.copy( startToTarget ).normalize();

    const endToTarget = scratchEndToTarget.setFromUnitVectors( chainDirection, targetDirection );

    scratchChainRotation.copy( endToTarget );

    const pole = scratchPole.copy( setup.poleVector );
    const poleLength = pole.length();

    if ( poleLength > DEGENERATE_LENGTH_METRES ) pole.divideScalar( poleLength );

    const referenceNormal = scratchReferenceNormal.crossVectors( targetDirection, pole );

    solution.poleConditioning = referenceNormal.length();

    if ( solution.poleConditioning < DEGENERATE_SINE ) {

        // The fifth degenerate case: pole ∥ start→target, so `cross` has no direction and the
        // chain plane is undefined. ozz declines it in its header and divides by the length
        // anyway; here the plane rotation is skipped, which leaves the chain in whatever plane
        // the swing put it — a defined, continuous answer rather than a NaN.
        solution.degenerate = IK_DEGENERATE.POLE_ALIGNED;

    } else {

        // The chain's own plane normal is the hinge, carried through the swing.
        const jointNormal = scratchJointNormal.copy( midAxisChain ).applyQuaternion( endToTarget );

        const planeCosine = clamp(
            referenceNormal.divideScalar( solution.poleConditioning ).dot( jointNormal.normalize() ),
            -1, 1 );

        // The axis is the start→target line; which WAY round is decided by the side of the pole
        // the chain's normal currently falls on.
        const planeAxis = scratchPlaneAxis.copy( targetDirection );

        if ( jointNormal.dot( pole ) < 0 ) planeAxis.negate();

        scratchPlaneRotation.setFromAxisAngle( planeAxis, Math.acos( planeCosine ) );
        scratchChainRotation.premultiply( scratchPlaneRotation );

    }

    // ozz twists about the UNFLIPPED axis, whichever way the plane rotation went.
    if ( setup.twistRadians !== 0 ) {

        scratchTwist.setFromAxisAngle( targetDirection, setup.twistRadians );
        scratchChainRotation.premultiply( scratchTwist );

    }

    solution.startCorrectionInChainSpace.copy( scratchChainRotation );

    // Chain space → the start joint's own frame, which is where a local post-multiply lives:
    //     bone.quaternion = restLocal × correction  ⟺  correction = startRot⁻¹ · chainRot · startRot
    solution.startCorrection
        .copy( setup.startRotation ).invert()
        .multiply( scratchChainRotation )
        .multiply( setup.startRotation );

}

/** The hinge in chain space. `midAxis` is stated in the middle joint's local frame, per ozz. */
function chainSpaceMidAxis( setup ) {

    return scratchMidAxisChain.copy( setup.midAxis ).applyQuaternion( setup.midRotation ).normalize();

}

/**
 * ozz's `WeightOutput` (`ik_two_bone_job.cc:301-333`): force `w` positive so the interpolation
 * takes the short way round, then NLerp toward identity and renormalise.
 *
 * NLerp rather than Slerp is ozz's choice and it is kept, because the two differ only in the
 * distribution of angle across the blend and matching the primary exactly is what makes the
 * arithmetic gate meaningful. The `w`-positive fixup runs at every weight, including 1, so a
 * caller comparing a full solve against a blended one is comparing the same representative.
 */
function applyWeight( rotation, weight ) {

    if ( rotation.w < 0 ) rotation.set( -rotation.x, -rotation.y, -rotation.z, -rotation.w );

    if ( weight >= 1 ) return rotation;

    const amount = Math.max( weight, 0 );

    rotation.set(
        rotation.x * amount,
        rotation.y * amount,
        rotation.z * amount,
        1 + ( rotation.w - 1 ) * amount
    );

    return rotation.normalize();

}

function branchOf( targetDistance, chainLength, innerRadius ) {

    if ( targetDistance > chainLength ) return IK_BRANCH.BEYOND_REACH;
    if ( targetDistance < innerRadius ) return IK_BRANCH.INSIDE_INNER_RADIUS;

    return IK_BRANCH.INTERIOR;

}

function clamp( value, low, high ) {

    return Math.min( Math.max( value, low ), high );

}
