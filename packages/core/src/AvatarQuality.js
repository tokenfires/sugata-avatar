/**
 * AvatarQuality — punch-list 7.2. Which tier this machine gets, decided from frames it ACTUALLY
 * DREW.
 *
 * `Avatar.js`'s `resolveTier` says so about itself in words: `quality: 'auto'` resolves on a
 * STRUCTURAL fact — can this adapter carry a velocity buffer at all — and never on a timing. That
 * is the right answer to "which tier can run here" and it is not an answer to "which tier can run
 * here at 60 fps", because the second question is about the machine in front of the viewer and no
 * capability string knows anything about it. This file answers the second question, and it answers
 * it the only way this repository accepts: by measuring the frame.
 *
 * 🚩 A TIER PICKED FROM A GPU NAME OR A `userAgent` IS A GUESS WEARING A MEASUREMENT'S CLOTHES.
 * There is no adapter string in this file and there is not going to be one. `requestAdapter()`
 * answers a capability question; `navigator.userAgent` answers a marketing question; neither has
 * ever seen this scene at this resolution on this thermal state. What decides here is a percentile
 * of measured per-frame cost against a budget, and every threshold it is compared to is derived
 * in-process from a measurement this repository already took and can cite.
 *
 *
 * ## THE MEASUREMENT, AND WHY THE SHIPPED SOURCE CAN ONLY EVER DEMOTE
 *
 * Two sources of a per-frame number exist, they measure DIFFERENT THINGS, and the difference
 * decides what each is allowed to conclude.
 *
 *   `gpu`   `renderer.resolveTimestampsAsync( 'render' )` — real GPU cost in milliseconds.
 *           Measures COST, so it can see headroom, so it can promote as well as demote.
 *
 *   `wall`  the interval between successive frame callbacks. Under `setAnimationLoop` that clock
 *           is vsync-locked, so it measures whether the budget was MET and never how much of it
 *           was spent. **A wall sample above 16.6 ms means 60 fps was missed on any display; a
 *           wall sample below it means nothing at all** — 8.33 ms on a 120 Hz panel is a frame
 *           with zero headroom, not a frame with half the budget spare. So this source demotes
 *           and is REFUSED promotion, in code, with the refusal named in the decision.
 *
 * 🎯 AND THE `gpu` SOURCE IS NOT AVAILABLE TO A FREE-RUNNING AVATAR, WHICH IS WHY THE DEMOTE-ONLY
 * SOURCE IS THE SHIPPING ONE RATHER THAN THE CONSOLATION PRIZE. Two independent gates close on it:
 *
 *   1. `trackTimestamp` has to be asked for AT DEVICE CREATION and cannot be turned on later.
 *      `renderer.trackTimestamp = true` after `init()` leaves `info.render.timestamp` undefined
 *      forever — measured, 0 of 200 samples valid on three r185 — because the `timestamp-query`
 *      feature was never requested of the adapter (`alive.js:769-775`). A tier decision that needs
 *      it must therefore be paid for before the first frame, by every avatar, including the ones
 *      that will never demote.
 *   2. **Nothing may render while a resolve is outstanding.** `resolveTimestampsAsync` reports the
 *      total for whichever frame is last in the pending set, so a free-running loop detaches the
 *      number from the frame. Measured, not argued: polling a free-running rAF loop on `alive.js`
 *      logs `WebGPUTimestampQueryPool [render]: Maximum number of queries exceeded` and returns
 *      samples as low as 4.03 ms on a frame that cannot be that cheap, with the `hash` hair arm
 *      reading 2.4 ms FASTER than the same page carrying no groom at all (`alive.js:2137-2145`).
 *      An `autoStart: true` avatar owns its own rAF and cannot await between frames. It therefore
 *      cannot have this source, and that is a property of the measurement rather than of this file.
 *
 * So: `autoStart: false` + an awaiting host gets `gpu` and a two-way ladder. Everything else gets
 * `wall` and a one-way ratchet down. Both are honest; only one of them is available by default.
 *
 *
 * ## THE LEVERS — AND FOUR OF THE SEVEN SWITCHES ARE NOT LEVERS
 *
 * A tier is only worth having if moving it moves the frame, and this repository has priced enough
 * of its own switches to say which do. Every row below is either a citation or a rejection with its
 * own citation; a switch with no attributed cost does not get to be a tier.
 *
 *   | switch                     | what the repo measured                         | rung? |
 *   |----------------------------|------------------------------------------------|-------|
 *   | GTAO `low` <-> `off`       | +0.845 ms p50, +1.434 ms p95 (`GTAO.js`)       | ✅ ships |
 *   | one shadow caster on/off   | +2.624 ms p95 (`PROGRESS.md`, real figure)     | ⏸ no tier name |
 *   | shadow map 2048 -> 1024    | 2.62 -> 2.74 ms, inside ±1 ms noise            | ❌ not a lever |
 *   | grade / bloom chain        | 1.217 ms, RETRACTED by its own author          | ❌ unpriced today |
 *   | temporalAA taau <-> msaa   | free-running only, "is not a measurement"      | ❌ + structural |
 *   | resolutionScale 1 -> 0.66  | a pass number on a synthetic scene             | ❌ wrong quantity |
 *   | forceWebGL                 | ~15.6 ms/frame of Firefox dispatch overhead    | ❌ structural |
 *
 * ⚠️ **THE SHADOW MAP SIZE IS THE INSTRUCTIVE REJECTION.** It is the switch that looks most like a
 * quality dial and it buys nothing: the cost sweep moved the key shadow from 2.62 ms at 2048 to
 * 2.74 ms at 1024 — the WRONG DIRECTION, and inside the run-to-run p95 noise of about ±1 ms the
 * same measurement states — because the shadow pass is bound by the extra GEOMETRY draw, not by
 * fill (`LightingRig.js:186-190`, `LEARNINGS.md`). A tier that shrank the map would spend a
 * visible amount of shadow crispness for a saving this project has measured to be zero.
 * `REJECTED_LEVERS.shadowMapSize` re-derives that verdict rather than asserting it.
 *
 * ⚠️ The grade row is a retraction and is carried as one. `Grade.js:316-326` measured the bloom
 * chain at 1.217 ms by toggle and then said, in the same comment, "do not quote 1.217 as the bloom
 * chain's cost on the current build" — re-measured after `TRAAPost`'s redundant-RTT removal the
 * same pair fell inside run-to-run spread. So `grade` is a switch whose cost is UNKNOWN, and an
 * unknown saving cannot be spent.
 *
 * ⚠️ The temporal row is why `fallback` is unreachable from here. WebGL2 has no velocity buffer, so
 * `taau` and `traa` cannot run on it at all; `fallback` is MSAA instead of TAAU and nothing else
 * moved (`Avatar.js`, `QUALITY_TIERS`). That makes it a different antialiasing on a different
 * backend, not a cheaper rung — and the only number anyone has for the swap (7.31 -> 21.36 ms) was
 * taken free-running, which `alive.js` itself rules out as a measurement two hundred lines later.
 * **No sequence of samples, however slow, moves this governor to `fallback`.** `STRUCTURAL_TIERS`
 * is the list, and the gate asserts the unreachability rather than trusting the comment.
 *
 *
 * ## THE HYSTERESIS IS DERIVED, NOT TUNED — AND THAT IS THE WHOLE ANTI-OSCILLATION ARGUMENT
 *
 * The failure mode a budget-driven tier has is not "picks wrong", it is "picks, repents, picks
 * again" — a figure whose occlusion blinks on and off every few seconds. The usual fix is a fudge
 * factor, which is a number typed into a file. This one is arithmetic:
 *
 *     promote into a tier only when the measured frame leaves room for what that tier COSTS,
 *     plus the reproducibility of the measurement that priced it.
 *
 *     headroom( high )  = Δp95( GTAO low vs off ) + p95 reproducibility
 *                       = ( 13.921 − 12.487 ) + | 13.347 − 12.663 |
 *                       = 1.434 + 0.684  =  2.118 ms
 *
 *     promote at        = 16.667 − 2.118 = 14.549 ms
 *     after promoting   = 14.549 + 1.434 = 15.983 ms  <  16.667 ms  ✅
 *
 * The post-promotion frame lands inside the budget by 0.684 ms, which is EXACTLY the run-to-run
 * spread of the measurement — so a machine that promotes cannot immediately demote, and the margin
 * it keeps is the noise floor rather than a preference. Both inputs are measured: the step cost
 * from `GTAO.js`'s sweep, the reproducibility from `alive.js`'s hair round, where the same control
 * was measured at both ends of one run and read 13.347 then 12.663 p95.
 *
 * Demotion carries no headroom on purpose. Over budget is a thing the viewer is watching happen;
 * headroom is not. The asymmetry is the hysteresis.
 *
 *
 * ## WIRING (the host owns the loop; this file owns the decision and nothing else)
 *
 * ```js
 * const probe   = await createFrameCostProbe( stage );
 * const quality = new AvatarQuality( { tier: avatar.report().quality.tier, source: probe.source } );
 *
 * // ...once per frame, AFTER stage.draw():
 * const decision = quality.update( await probe.read() );
 * if ( decision.changed === true ) applyTier( decision.tier );
 * ```
 *
 * 🚩 **THIS FILE NEVER MUTATES A `Stage`, AND THAT IS DELIBERATE RATHER THAN UNFINISHED.** The
 * `high` <-> `balanced` swap is two changes that have to happen together: `stage.setAmbientOcclusion`
 * AND the rig's hemisphere ambient, because with GTAO on the ambient is re-evaluated per pixel in
 * the composite and leaving the light in the scene double-counts it — step 1 of the construction
 * order, `alive.js:734-737`. Applying half of that is a tier change that silently doubles the
 * ambient. The actuator belongs beside the constructor that made the pair, which is `Avatar.js`.
 * See REQUESTS at the foot of this file.
 *
 * Usage gate: `node "packages/core/src/AvatarQuality.selftest.mjs"`
 */

import { TimestampQuery } from 'three/webgpu';

// ================================================================================================
// The budget
// ================================================================================================

/**
 * The frame rate every cost in this repository is stated against. Written as a rate rather than as
 * a duration so the 16.6 ms quoted throughout `PROGRESS.md`, `GTAO.js`, `LightingRig.js` and
 * `HairOIT.js` is derived here instead of transcribed.
 */
export const TARGET_FRAMES_PER_SECOND = 60;

/** 16.6667 ms. Every budget comparison in this file is against this and nothing else. */
export const FRAME_BUDGET_MS = 1000 / TARGET_FRAMES_PER_SECOND;

// ================================================================================================
// The measurements — absolutes as recorded, so every delta below is arithmetic on this page
// ================================================================================================
//
// 🚩 NOTHING HERE IS A DELTA. LEARNINGS §1.25r is about numbers that arrive already reduced: a
// "+0.845" in a comment cannot be checked against anything, whereas 12.9949 and 12.1494 can be
// checked against the page they were read from and subtracted here in front of a witness. Every
// derived quantity in this file is a subtraction of two members of one of these tables, and the
// gate re-does each subtraction.

/**
 * `GTAO.js`'s own quality sweep — the measurement that chose `low` as the shipping preset, and the
 * one that prices this file's single budget rung.
 *
 * Recipe, verbatim from `GTAO_SHIPPING_QUALITY`: GPU timestamps at 1080x1920 full body on
 * `alive.html?bare&freeze&seed=1&frame=body&gputime=1`, 200 samples after 60 warm-up frames, three
 * rounds per arm alternating, median of the three per-round p50s.
 */
export const GTAO_FRAME_COST_MS = Object.freeze( {
    off: Object.freeze( { p50: 12.1494, p95: 12.487 } ),
    low: Object.freeze( { p50: 12.9949, p95: 13.921 } ),
    medium: Object.freeze( { p50: 14.0262, p95: 25.855 } ),
    high: Object.freeze( { p50: 22.4699, p95: 28.426 } )
} );

/**
 * The same control frame, measured at both ends of one run — which is the only thing in this
 * repository that states how reproducible a p95 on this stack IS.
 *
 * `alive.js:2137-2160`, the hair round: `?bare&freeze&seed=1&capture&gputime=1` at 1920x1080 dpr 1,
 * driven through `__SUGATA_STEP__( 0 )` so one resolve corresponds to exactly one drawn frame, 100
 * samples after 60 warm-up steps. The no-hair control opened the run at 12.038 p50 / 13.347 p95 and
 * closed it at 12.016 / 12.663.
 *
 * 🎯 This is the number the promotion margin is made of. Without it the margin would be a taste,
 * and a tier system with a tasteful margin is a tier system nobody can argue with or reproduce.
 */
export const CONTROL_REPEATS_MS = Object.freeze( {
    p50: Object.freeze( [ 12.038, 12.016 ] ),
    p95: Object.freeze( [ 13.347, 12.663 ] )
} );

/** 0.684 ms — how far apart one control's two p95 readings landed in one run. */
export const P95_REPRODUCIBILITY_MS = Math.abs( CONTROL_REPEATS_MS.p95[ 0 ] - CONTROL_REPEATS_MS.p95[ 1 ] );

/** 0.022 ms — the same for p50, kept so the two statistics' noise floors can be compared. */
export const P50_REPRODUCIBILITY_MS = Math.abs( CONTROL_REPEATS_MS.p50[ 0 ] - CONTROL_REPEATS_MS.p50[ 1 ] );

/**
 * The shadow sweep, `PROGRESS.md` 2026-08-07: the real 74k-triangle skinned figure at 1920x1080,
 * WebGPU, 3 repeats x 120 samples, variant order alternated, one render per frame, p95 headline.
 * `Δ over ambient only` for the first three; the last two are the key shadow's own delta measured
 * at two map sizes.
 *
 * ⚠️ The 2.624 figure is SINGLE-SOURCE with no independent reproduction and `PROGRESS.md:1362` says
 * so — it is higher than a 74k-triangle depth-only pass ought to cost and may be a three.js WebGPU
 * shadow-path inefficiency. It is quoted here to price a rung that does not exist yet, not to
 * justify one that does.
 */
export const SHADOW_COST_MS = Object.freeze( {
    fourAreaLights: 3.608,
    plusOneCaster: 2.624,
    plusFourCasters: 9.114,
    oneCasterAtMapSize2048: 2.62,
    oneCasterAtMapSize1024: 2.74,
    runToRunNoise: 1.0
} );

/**
 * WebGPU command-dispatch overhead per pass, `docs/research/rendering-stack.md:39` citing
 * arXiv 2604.02344, with this stack's own pass count.
 *
 * Firefox's 1040 µs against Chrome's 58.7 is where `Stage.js:151`'s "roughly 18x Chrome's" comes
 * from, and 15 passes of it is 15.6 ms — **94% of the frame, gone before the first draw call**,
 * leaving 1.07 ms for the skin, the eyes, the occlusion, the shadow and the grade. That is why
 * `forceWebGL` is a structural decision taken from the browser and never from a timing: no
 * measurement taken inside that 1.07 ms can buy any of it back.
 *
 * ⚠️ It is 94%, not 100%. This file's own gate caught the stronger claim and refused it — the
 * disqualification does not need the overhead to exceed the budget and it does not.
 */
export const WEBGPU_DISPATCH_OVERHEAD_US = Object.freeze( {
    safari: 31.7,
    chrome: 58.7,
    firefox: 1040,
    passesPerFrame: 15
} );

// ================================================================================================
// The ladder
// ================================================================================================

/**
 * The tiers a MEASUREMENT may move between, richest first.
 *
 * These are `Avatar.js`'s `QUALITY_TIERS` keys, and the gate asserts that rather than this file
 * trusting it: two lists of tier names is exactly the liability the parity gate exists for. The
 * import is deliberately not here — `Avatar.js` pulls in `Stage`, `LightingRig` and the whole
 * figure loader, and a governor that a host can construct before the renderer exists is worth more
 * than a shared constant. The gate holds the two together.
 */
export const BUDGET_LADDER = Object.freeze( [ 'high', 'balanced' ] );

/**
 * Tiers reachable only from a structural fact, never from a frame time. See the temporal row of the
 * lever table: `fallback` is a different backend's own default antialiasing, not a cheaper rung.
 */
export const STRUCTURAL_TIERS = Object.freeze( [ 'fallback' ] );

/**
 * What each rung of the ladder costs over the rung below it, DERIVED from `GTAO_FRAME_COST_MS`.
 *
 * Keyed by the richer tier, because that is the direction the number is needed in: it is what a
 * promotion into that tier will spend, and therefore what a promotion has to have in hand first.
 */
export const LADDER_STEP_COST_MS = Object.freeze( {
    high: Object.freeze( {
        over: 'balanced',
        lever: 'GTAO low (8 samples at half resolution) on',
        p50: GTAO_FRAME_COST_MS.low.p50 - GTAO_FRAME_COST_MS.off.p50,
        p95: GTAO_FRAME_COST_MS.low.p95 - GTAO_FRAME_COST_MS.off.p95
    } )
} );

/**
 * The switches that look like tier levers and are not, each with the measurement that disqualifies
 * it. Exported because a rejection nobody can read is a rejection that gets re-proposed every
 * round, and because `verdict` is re-derived by the gate rather than asserted here.
 */
export const REJECTED_LEVERS = Object.freeze( {

    shadowMapSize: Object.freeze( {
        measured: 'the key shadow cost 2.62 ms at 2048 and 2.74 ms at 1024 — the wrong direction',
        why: 'the shadow pass is bound by the extra geometry draw, not by fill; the difference is ' +
            'inside the ±1 ms run-to-run p95 noise the same sweep states',
        source: 'LightingRig.js:186-190, LEARNINGS.md, PROGRESS.md:1355-1360'
    } ),

    grade: Object.freeze( {
        measured: 'the bloom chain toggled 15.808 -> 14.591 ms, and that number was RETRACTED',
        why: 're-measured after TRAAPost removed its redundant RTT the same pair fell inside ' +
            'run-to-run spread; Grade.js says "do not quote 1.217 as the bloom chain\'s cost on ' +
            'the current build". An unknown saving cannot be spent',
        source: 'Grade.js:307-326'
    } ),

    temporalAA: Object.freeze( {
        measured: '7.31 -> 21.36 ms at 1920x1080, taken FREE-RUNNING',
        why: 'alive.js rules out free-running polling as a measurement in its own hair round — ' +
            'queries-exceeded warnings and 4.03 ms samples on frames that cannot be that cheap. ' +
            'And WebGL2 has no velocity buffer, so the swap is structural before it is anything else',
        source: 'alive.js:675-678 against alive.js:2137-2145'
    } ),

    resolutionScale: Object.freeze( {
        measured: 'the G-buffer scene pass 0.655 -> 0.393 ms p95 at 0.66 on stage.html',
        why: 'that is a PASS cost on a synthetic control scene, not a frame cost on this figure ' +
            'under this rig — and 0.66 is already what the shipped TAAU tier runs at, so the ' +
            'saving has been taken',
        source: 'packages/testbed/src/stage.js runPerfSweep'
    } ),

    forceWebGL: Object.freeze( {
        measured: "Firefox's WebGPU dispatch overhead is ~1040 µs per pass against Chrome's 58.7",
        why: 'about 15.6 ms of a 16.6 ms frame is gone before the first draw, so the WebGL2 tier ' +
            'is chosen from the browser and cannot be chosen from a frame time',
        source: 'docs/research/rendering-stack.md:39 (arXiv 2604.02344), Stage.js:150-152'
    } )

} );

// ================================================================================================
// The window
// ================================================================================================

/**
 * Frames discarded before any sample counts, and discarded AGAIN after every tier change.
 *
 * 60 is this repository's own warm-up everywhere it measures: `GTAO_SHIPPING_QUALITY` ("200 samples
 * after 60 warm-up frames"), `alive.js`'s hair round ("100 samples after 60 warm-up steps"), and
 * `stage.js`'s perf sweep, whose `?warmup` defaults to 60. A tier change recompiles shaders and
 * reallocates attachments, so the frames straight after one are the same kind of cold as the frames
 * straight after a page load — the reset is not politeness, it is the reason a promotion cannot be
 * judged on the cost of the promotion itself.
 */
export const WARMUP_FRAMES = 60;

/**
 * Samples in a decision window. `stage.js`'s perf sweep takes 150 (`?frames`, default 150), which
 * is the sample count every cost table quoted in this file was built on the same order of.
 */
export const WINDOW_FRAMES = 150;

/**
 * 2500 ms — the same window expressed as time, so a machine that is drawing at 12 fps does not wait
 * 12 seconds to admit it. Derived, not chosen: a full window AT BUDGET is exactly this long, so on
 * a machine holding 60 fps the two conditions close together and neither is a second opinion.
 */
export const WINDOW_MS = WINDOW_FRAMES * FRAME_BUDGET_MS;

/**
 * What each source is allowed to measure and to conclude. See the header — the two have their
 * artefacts in OPPOSITE tails, so each names its own honest statistic.
 *
 *   `gpu`  dropout only ever pushes a sample DOWN: Chrome quantises WebGPU timestamps to 0.065536
 *          ms and some resolves come back holding only part of a frame's work, so `min` is exactly
 *          one quantum in variants that cannot possibly run that fast. The upper envelope is the
 *          honest estimate and the low tail is dropout — hence p95, which `stage.js` measured as
 *          reproducible to the quantum across three runs while the median wandered over a 5x range.
 *
 *   `wall` hitches only ever push a sample UP: a garbage collection, a tab switch, a compositor
 *          stall. The median is the outlier rejection, and it needs no threshold to be one.
 */
export const SAMPLE_SOURCES = Object.freeze( {

    gpu: Object.freeze( {
        percentile: 0.95,
        canPromote: true,
        measures: 'GPU cost in milliseconds',
        note: 'renderer.resolveTimestampsAsync — needs trackTimestamp at device creation and a ' +
            'host that awaits the resolve before drawing again'
    } ),

    wall: Object.freeze( {
        percentile: 0.50,
        canPromote: false,
        measures: 'whether the frame budget was met',
        note: 'vsync-locked, so it can see a missed budget and can never see headroom — 8.33 ms ' +
            'on a 120 Hz panel is a full frame, not half of one'
    } )

} );

// ================================================================================================
// Statistics — small, plain, and shared with the gate
// ================================================================================================

/**
 * Nearest-rank percentile. No interpolation: an interpolated p95 is a value no frame ever took, and
 * every table quoted in this file reports observed samples.
 *
 * @param {number[]} samples - unsorted; not mutated.
 * @param {number} fraction - on (0, 1].
 * @returns {number}
 */
export function percentileOf( samples, fraction ) {

    if ( samples.length === 0 ) throw new RangeError( 'AvatarQuality: percentileOf needs at least one sample.' );

    const sorted = [ ...samples ].sort( ( a, b ) => a - b );
    const rank = Math.ceil( fraction * sorted.length );
    const index = Math.min( Math.max( rank - 1, 0 ), sorted.length - 1 );

    return sorted[ index ];

}

/**
 * How many samples a percentile needs before it is that percentile rather than a synonym for `max`.
 *
 * `ceil( 1 / ( 1 - f ) )` is the count at which exactly one sample sits above the rank — 20 for
 * p95, 2 for p50. Below it, `percentileOf( samples, 0.95 )` returns the largest sample, so a two
 * sample "p95" is a maximum wearing a percentile's name, which is precisely the reading that would
 * demote a healthy machine on one hitch.
 *
 * @param {number} fraction - on (0, 1).
 * @returns {number}
 */
export function minimumSamplesForPercentile( fraction ) {

    if ( fraction <= 0 || fraction >= 1 ) {

        throw new RangeError( `AvatarQuality: a percentile needs a fraction on (0, 1), got ${ fraction }.` );

    }

    return Math.ceil( 1 / ( 1 - fraction ) );

}

/**
 * The measured cost a tier must have in hand before it may be promoted INTO.
 *
 * Derived: what the tier costs over the one below it, plus the reproducibility of the measurement
 * that priced it. See the header's arithmetic — this is the whole hysteresis.
 *
 * @param {string} tier - a `BUDGET_LADDER` name.
 * @returns {?number} null for the cheapest rung, which nothing is promoted into.
 */
export function promotionHeadroomFor( tier ) {

    const step = LADDER_STEP_COST_MS[ tier ];

    if ( step === undefined ) return null;

    return step.p95 + P95_REPRODUCIBILITY_MS;

}

// ================================================================================================
// The governor
// ================================================================================================

/**
 * Reasons a decision can carry. Enumerated so a HUD, a gate and a log line all read the same
 * strings, and so "held" is never indistinguishable from "was never asked".
 */
export const DECISION_REASONS = Object.freeze( {
    noMeasurement: 'no measurement this frame',
    warmingUp: 'warm-up frames are being discarded',
    windowOpen: 'the decision window is still filling',
    insideBudget: 'inside budget, and without the headroom the richer tier costs',
    overBudget: 'over budget',
    promoted: 'headroom exceeds what the richer tier costs, plus the measurement noise',
    cheapestRung: 'already on the cheapest measured rung',
    richestRung: 'already on the richest rung',
    sourceCannotPromote: 'this source measures whether the budget was met, never how much was spent',
    unpricedRung: 'the richer rung has no measured cost, so no promotion into it can be justified',
    structuralTier: 'this tier was chosen structurally and no frame time may move it'
} );

/**
 * The tier decision, driven one frame at a time.
 *
 * Pure: no DOM, no renderer, no clock of its own. Everything it knows arrives through `update()`,
 * which is what lets the gate drive a simulated machine at an exact cost and watch what it decides.
 *
 * @example
 * const quality = new AvatarQuality( { tier: 'high', source: 'wall' } );
 * const decision = quality.update( millisecondsSinceLastFrame );
 * if ( decision.changed === true ) applyTier( decision.tier );
 */
export class AvatarQuality {

    /**
     * @param {Object} [options]
     * @param {string} [options.tier='high'] - where the avatar starts. A `STRUCTURAL_TIERS` name is
     *   accepted and pins the governor: it will report, and it will never move.
     * @param {'gpu'|'wall'} [options.source='wall'] - which clock the caller can actually supply.
     *   Take it from `createFrameCostProbe( stage ).source` rather than assuming.
     * @param {number} [options.budgetMilliseconds] - defaults to `FRAME_BUDGET_MS`. An embedder
     *   targeting 30 fps has a different budget and the same arithmetic.
     * @param {number} [options.warmupFrames] - defaults to `WARMUP_FRAMES`.
     * @param {number} [options.windowFrames] - defaults to `WINDOW_FRAMES`.
     * @param {string[]} [options.ladder] - defaults to `BUDGET_LADDER`, richest first. An embedder
     *   with its own tier table supplies its own rungs; a rung with no entry in
     *   `LADDER_STEP_COST_MS` can be demoted TO and never promoted INTO, because promoting into an
     *   unpriced tier is the guess this whole file exists to refuse.
     *   🚩 It is also how the gate reintroduces the defect: put a `STRUCTURAL_TIERS` name in here
     *   and a slow machine walks straight down onto it, which is the thing `BUDGET_LADDER` is
     *   shaped to make impossible.
     * @param {?number} [options.promotionHeadroomMilliseconds=null] - null derives it per step from
     *   `promotionHeadroomFor`.
     *   🚩 THE KNOWN-BAD LIVES HERE ON PURPOSE, the way `GTAO.js`'s `packedNormalDefect` does.
     *   Setting this to 0 removes the hysteresis and the governor oscillates — promote, exceed,
     *   demote, repeat — and `AvatarQuality.selftest.mjs` sets it to 0 to prove that the derived
     *   value is load-bearing rather than decorative. Production has no reason to move it.
     */
    constructor( options = {} ) {

        const ladder = options.ladder ?? BUDGET_LADDER;

        if ( Array.isArray( ladder ) === false || ladder.length === 0 ) {

            throw new TypeError( 'AvatarQuality: ladder must be a non-empty array of tier names, richest first.' );

        }

        const tier = options.tier ?? ladder[ 0 ];

        if ( ladder.includes( tier ) === false && STRUCTURAL_TIERS.includes( tier ) === false ) {

            const known = [ ...ladder, ...STRUCTURAL_TIERS ].join( ', ' );

            throw new TypeError( `AvatarQuality: tier must be one of ${ known }, got '${ tier }'.` );

        }

        const source = options.source ?? 'wall';

        if ( SAMPLE_SOURCES[ source ] === undefined ) {

            const known = Object.keys( SAMPLE_SOURCES ).join( ', ' );

            throw new TypeError( `AvatarQuality: source must be one of ${ known }, got '${ source }'.` );

        }

        this.tier = tier;
        this.ladder = ladder;
        this.source = source;
        this.budgetMilliseconds = options.budgetMilliseconds ?? FRAME_BUDGET_MS;
        this.warmupFrames = options.warmupFrames ?? WARMUP_FRAMES;
        this.windowFrames = options.windowFrames ?? WINDOW_FRAMES;
        this.windowMilliseconds = this.windowFrames * this.budgetMilliseconds;
        this.promotionHeadroomMilliseconds = options.promotionHeadroomMilliseconds ?? null;

        this.samples = [];
        this.warmupRemaining = this.warmupFrames;
        this.accumulatedMilliseconds = 0;

        /** Every tier change, in order, so a report can show the trace rather than the endpoint. */
        this.changes = [];

        this.framesSeen = 0;
        this.framesMeasured = 0;
        this.windowsClosed = 0;

    }

    /**
     * One frame. Call it once per drawn frame, after the draw.
     *
     * @param {?number} costMilliseconds - the frame's measured cost, or **null for "this frame was
     *   not a measurement"**. Null is not an error and not a zero: a timestamp resolve that came
     *   back empty, or a frame drawn while the document was hidden, must advance neither the
     *   warm-up nor the window. `createFrameCostProbe` returns null for both cases.
     * @returns {Object} the decision — always populated, always carrying its reason.
     */
    update( costMilliseconds ) {

        this.framesSeen ++;

        if ( costMilliseconds === null || costMilliseconds === undefined ) {

            return this.decision( false, DECISION_REASONS.noMeasurement );

        }

        if ( Number.isFinite( costMilliseconds ) === false || costMilliseconds < 0 ) {

            throw new TypeError( `AvatarQuality.update: a frame cost must be a finite number of ` +
                `milliseconds or null, got ${ costMilliseconds }.` );

        }

        this.framesMeasured ++;

        // A structural tier is pinned before anything is even recorded: keeping samples for a
        // decision that cannot be taken would let `report()` imply one is coming.
        if ( STRUCTURAL_TIERS.includes( this.tier ) === true ) {

            return this.decision( false, DECISION_REASONS.structuralTier );

        }

        if ( this.warmupRemaining > 0 ) {

            this.warmupRemaining --;
            return this.decision( false, DECISION_REASONS.warmingUp );

        }

        this.samples.push( costMilliseconds );
        this.accumulatedMilliseconds += costMilliseconds;

        if ( this.windowIsClosed() === false ) {

            return this.decision( false, DECISION_REASONS.windowOpen );

        }

        this.windowsClosed ++;

        return this.decide();

    }

    /**
     * Whether enough has been seen to decide.
     *
     * Two conditions, either of which closes it, and the second exists only so a machine drawing at
     * 12 fps does not spend twelve seconds over budget before it is allowed to say so. The sample
     * floor on that path keeps the percentile honest — see `minimumSamplesForPercentile`.
     */
    windowIsClosed() {

        if ( this.samples.length >= this.windowFrames ) return true;

        const floor = minimumSamplesForPercentile( SAMPLE_SOURCES[ this.source ].percentile );

        return this.accumulatedMilliseconds >= this.windowMilliseconds && this.samples.length >= floor;

    }

    /**
     * The rule, once a window has closed. Demote first, promote second, hold otherwise — and every
     * branch resets the window, because a statistic computed over samples from two different tiers
     * describes neither.
     */
    decide() {

        const source = SAMPLE_SOURCES[ this.source ];
        const measured = percentileOf( this.samples, source.percentile );
        const index = this.ladder.indexOf( this.tier );

        if ( measured > this.budgetMilliseconds ) {

            const cheaper = this.ladder[ index + 1 ];

            if ( cheaper === undefined ) {

                return this.settle( null, DECISION_REASONS.cheapestRung, measured );

            }

            return this.settle( cheaper, DECISION_REASONS.overBudget, measured );

        }

        const richer = this.ladder[ index - 1 ];

        if ( richer === undefined ) return this.settle( null, DECISION_REASONS.richestRung, measured );

        if ( source.canPromote === false ) {

            return this.settle( null, DECISION_REASONS.sourceCannotPromote, measured );

        }

        const headroom = this.headroomInto( richer );

        // An unpriced rung is one nobody has measured the cost of, and spending an unmeasured
        // amount of a 16.6 ms budget is the exact move `REJECTED_LEVERS` exists to refuse.
        if ( headroom === null ) return this.settle( null, DECISION_REASONS.unpricedRung, measured );

        if ( measured <= this.budgetMilliseconds - headroom ) {

            return this.settle( richer, DECISION_REASONS.promoted, measured );

        }

        return this.settle( null, DECISION_REASONS.insideBudget, measured );

    }

    /**
     * Applies a decision and clears the window.
     *
     * 🚩 A TIER CHANGE RE-ARMS THE WARM-UP AND A HOLD DOES NOT. The frames straight after a swap are
     * paying for shader compilation and attachment reallocation, and judging the new tier on them
     * would demote it for the cost of arriving. A hold changed nothing, so nothing is cold.
     *
     * @param {?string} tier - the tier to move to, or null to stay.
     */
    settle( tier, reason, measured ) {

        const changed = tier !== null && tier !== this.tier;
        const previous = this.tier;

        if ( changed === true ) {

            this.tier = tier;
            this.warmupRemaining = this.warmupFrames;
            this.changes.push( {
                from: previous, to: tier, reason,
                measuredMilliseconds: measured, atFrame: this.framesSeen
            } );

        }

        this.samples = [];
        this.accumulatedMilliseconds = 0;

        return this.decision( changed, reason, measured, previous );

    }

    /**
     * What promoting into one rung demands in hand: the caller's override if there is one, else the
     * derived figure, else null for a rung this repository has never priced.
     */
    headroomInto( tier ) {

        if ( this.promotionHeadroomMilliseconds !== null ) return this.promotionHeadroomMilliseconds;

        return promotionHeadroomFor( tier );

    }

    /** The shape every branch of `update` returns. One shape, so a caller has one thing to read. */
    decision( changed, reason, measuredMilliseconds = null, previousTier = this.tier ) {

        const richer = this.ladder[ this.ladder.indexOf( this.tier ) - 1 ];
        const headroom = richer === undefined ? null : this.headroomInto( richer );

        return {
            tier: this.tier,
            previousTier,
            changed,
            reason,
            source: this.source,
            statistic: SAMPLE_SOURCES[ this.source ].percentile,
            measuredMilliseconds,
            budgetMilliseconds: this.budgetMilliseconds,
            promotionThresholdMilliseconds: headroom === null ? null : this.budgetMilliseconds - headroom,
            sampleCount: this.samples.length,
            warmupRemaining: this.warmupRemaining
        };

    }

    /**
     * What a HUD and a gate both read. Deliberately the same shape of answer `Avatar.report()`
     * gives: what was decided, on what evidence, and by which of the two clocks.
     */
    report() {

        return {
            tier: this.tier,
            ladder: [ ...this.ladder ],
            source: this.source,
            selectedBy: STRUCTURAL_TIERS.includes( this.tier ) === true
                ? 'structural'
                : 'measured-frame-budget',
            canPromote: SAMPLE_SOURCES[ this.source ].canPromote,
            budgetMilliseconds: this.budgetMilliseconds,
            framesSeen: this.framesSeen,
            framesMeasured: this.framesMeasured,
            windowsClosed: this.windowsClosed,
            sampleCount: this.samples.length,
            warmupRemaining: this.warmupRemaining,
            changes: this.changes.map( ( change ) => ( { ...change } ) )
        };

    }

}

// ================================================================================================
// The probe — the one part of this file that touches an environment
// ================================================================================================

/**
 * How many resolves the probe will wait for a positive duration before it gives up on the GPU
 * source. `stage.js`'s `probeTimestamps` uses 40 for the same purpose, and its reasoning is the one
 * that matters: **`trackTimestamp: true` is a request, not a guarantee**, so the only proof that
 * the source works is a resolve that actually came back positive.
 */
export const TIMESTAMP_PROBE_FRAMES = 40;

/**
 * Picks the best frame-cost clock this stage can actually supply, and refuses to guess.
 *
 * 🚩 IT WILL NOT REPORT WALL CLOCK AS GPU COST. `lighting.js` already refuses this in words —
 * "no timestamp-query on this adapter — refusing to report wall clock as GPU cost" — and the
 * refusal matters more here than there, because a `wall` number labelled `gpu` would be handed to a
 * governor that is allowed to PROMOTE on it, and a vsync-locked clock reading 8.33 ms on a 120 Hz
 * panel would promote a machine that has no headroom at all.
 *
 * The GPU source is not confirmed here — it cannot be, because confirming it needs drawn frames and
 * the host owns the loop. So the probe starts optimistic and self-demotes: `read()` returns null
 * (not a sample) until a resolve comes back positive, and after `TIMESTAMP_PROBE_FRAMES` failed
 * attempts it permanently becomes the wall clock and says so in `note`.
 *
 * ⚠️ ON THE GPU SOURCE THE HOST MUST AWAIT `read()` BEFORE DRAWING AGAIN. `resolveTimestampsAsync`
 * reports the total for whichever frame is last in the pending set, so letting resolves pool up
 * detaches the number from the frame — see the header. A free-running `autoStart: true` avatar
 * cannot do this and should ask for `{ source: 'wall' }` rather than trying.
 *
 * @param {Object} stage - a `Stage`. Read for `renderer`, `backendName`; never written to.
 * @param {Object} [options]
 * @param {'gpu'|'wall'} [options.source] - pin the source instead of probing for it.
 * @returns {Promise<{source: string, note: string, read: function(): Promise<?number>}>}
 */
export async function createFrameCostProbe( stage, options = {} ) {

    const renderer = stage?.renderer ?? null;

    if ( renderer === null ) {

        throw new TypeError( 'AvatarQuality.createFrameCostProbe: needs a created Stage — ' +
            'stage.renderer is null, so Stage.create() has not resolved yet.' );

    }

    if ( options.source === 'wall' ) return wallClockProbe( 'pinned by the caller' );

    const backendIsWebGPU = stage.backendName === 'webgpu';
    const supported = backendIsWebGPU === true
        ? renderer.hasFeature?.( 'timestamp-query' ) === true
        : renderer.backend?.disjoint !== undefined && renderer.backend?.disjoint !== null;

    if ( supported !== true && options.source !== 'gpu' ) {

        return wallClockProbe( backendIsWebGPU === true
            ? 'this WebGPU adapter does not expose timestamp-query'
            : 'the WebGL2 backend has no EXT_disjoint_timer_query_webgl2' );

    }

    // The feature being present is not the same as `trackTimestamp` having been asked for at device
    // creation, and the second cannot be checked after the fact — `Backend.resolveTimestampsAsync`
    // returns `undefined` and warns once when tracking is off, which is exactly what a dropped
    // resolve looks like. So both are settled the same way: by a resolve that comes back positive.
    let attemptsLeft = TIMESTAMP_PROBE_FRAMES;
    let confirmed = false;
    const probe = {
        source: 'gpu',
        note: 'GPU timestamps requested; not yet confirmed by a positive resolve',
        read: async () => {

            if ( isDocumentHidden() === true ) return null;

            const duration = await renderer.resolveTimestampsAsync( TimestampQuery.RENDER );

            if ( typeof duration === 'number' && duration > 0 ) {

                confirmed = true;
                probe.note = 'GPU timestamp queries active';
                return duration;

            }

            if ( confirmed === false ) {

                attemptsLeft --;

                if ( attemptsLeft <= 0 ) {

                    const fallback = wallClockProbe( 'trackTimestamp was never granted — ' +
                        `${ TIMESTAMP_PROBE_FRAMES } resolves returned nothing. It has to be asked ` +
                        'for at device creation and cannot be turned on later' );

                    probe.source = fallback.source;
                    probe.note = fallback.note;
                    probe.read = fallback.read;

                }

            }

            return null;

        }
    };

    return probe;

}

/**
 * The clock every host already has. Returns null for its own first call — there is no interval
 * before the first frame — and for any frame drawn while the document is hidden.
 *
 * 🚩 A HIDDEN TAB'S rAF IS THROTTLED TO ABOUT 1 Hz AND THOSE ARE NOT FRAMES. Feeding them in would
 * demote a healthy avatar for being in a background tab, and the median cannot save a window that
 * is entirely made of them. Null is the honest answer: nothing was drawn, so nothing was measured.
 */
function wallClockProbe( note ) {

    let previousMs = null;

    return {
        source: 'wall',
        note,
        read: async () => {

            if ( isDocumentHidden() === true ) {

                previousMs = null;
                return null;

            }

            const nowMs = performance.now();
            const interval = previousMs === null ? null : nowMs - previousMs;

            previousMs = nowMs;

            return interval;

        }
    };

}

/** Outside a browser there is no document, and nothing is hidden. */
function isDocumentHidden() {

    return globalThis.document?.visibilityState === 'hidden';

}

// ================================================================================================
// REQUESTS against files this one does not own
// ================================================================================================
//
// REQ-A `packages/core/src/Avatar.js` — the actuator. This file decides; nothing applies. The
//       `high` <-> `balanced` swap is `stage.setAmbientOcclusion( gtao | null )` AND the rig's
//       hemisphere ambient moving with it, because with GTAO on the ambient is re-evaluated per
//       pixel in the composite and leaving the light in the scene double-counts it
//       (`alive.js:734-737`, construction-order step 1). Applying one half is a tier change that
//       silently doubles the ambient, so the pair belongs beside the constructor that built it.
//       `LightingRig` currently takes `ambient` at construction only, so REQ-B travels with this.
//
// REQ-B `packages/core/src/render/LightingRig.js` — a way to move the hemisphere ambient after
//       `attachTo`. Today `ambientEnabled` is read in the constructor and the rig is built once.
//       Without it, REQ-A can only be satisfied by rebuilding the rig, which is a visible hitch on
//       a tier change that exists to remove hitches.
//
// REQ-C `packages/core/src/render/Stage.js` — `trackTimestamp` in `Avatar`'s `stage.create` call,
//       gated on the caller asking for the `gpu` source. Without it every embedded avatar gets the
//       demote-only wall clock, which is the correct default (the queries cost a little every frame
//       and the flag cannot be revoked) but leaves promotion unreachable for hosts that would
//       happily pay for it. The cost of the queries themselves is UNPRICED in this repository and
//       should be measured before the flag is made attractive.
//
// REQ-D `packages/core/src/Avatar.js` — a fourth tier name for the shadow rung. `PROGRESS.md`
//       prices one shadow caster at 2.624 ms p95 on the real figure, which is 1.8x the whole GTAO
//       rung this file ships, and `LightingRig( { shadows: false } )` already exists. It is the
//       largest measured saving on the table and this file cannot spend it, because a governor may
//       only name tiers `QUALITY_TIERS` defines. ⚠️ `PROGRESS.md:1362` flags 2.624 as single-source
//       with no independent reproduction; reproduce it before shipping a tier on it.
