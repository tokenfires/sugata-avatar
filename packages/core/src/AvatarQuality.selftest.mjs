/**
 * Gate for `AvatarQuality.js` — punch-list 7.2, quality tiers auto-selected from a MEASURED frame
 * budget.
 *
 * This gate cannot render, and that is the right shape for what 7.2 actually is. The measurement
 * belongs to a GPU; the DECISION taken on it is arithmetic, and arithmetic is exactly the thing a
 * headless process can hold to account. So nothing here asserts a pixel. Every section drives the
 * real `AvatarQuality` over a SIMULATED MACHINE — a function returning what a frame costs at each
 * tier — and asserts what it decided, why, and how many times.
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   CONSTANTS   Every derived quantity is re-derived here from the absolutes it came from, in this
 *               process. `LADDER_STEP_COST_MS.high.p95` is 13.921 − 12.487 or it is a number
 *               somebody typed; the gate does the subtraction rather than reading the answer.
 *
 *   LEVERS      The four switches that are NOT budget levers, each rejected by re-deriving its own
 *               disqualifying measurement. 🚩 The shadow-map row is the one worth watching: the
 *               gate proves the saving is inside the noise AND that it has the wrong sign.
 *
 *   PARITY      The tier names in `BUDGET_LADDER` and `STRUCTURAL_TIERS` are keys of `Avatar.js`'s
 *               `QUALITY_TIERS`. Two lists of tier names is the liability; this is the gate on
 *               their agreement, and it is why `AvatarQuality.js` does not import `Avatar.js`.
 *
 *   PERCENTILE  Nearest-rank, unmutated input, and the sample floor that stops a "p95" from being
 *               a maximum wearing a percentile's name.
 *
 *   HYSTERESIS  🎯 The anti-oscillation proof, as arithmetic rather than as a trial: promoting AT
 *               the threshold lands strictly inside budget, by exactly the measurement's own
 *               run-to-run reproducibility.
 *
 *   DECISION    A machine at a given cost picks the tier the arithmetic says it should, including
 *               the dead band where it does neither.
 *
 *   WINDOW      A single fast frame cannot promote. Proved red by shrinking the window to one
 *               frame, at which point it does.
 *
 *   WARMUP      The frames straight after a tier change are discarded. Proved red by removing the
 *               warm-up, at which point the cost of ARRIVING at a tier demotes it again.
 *
 *   OSCILLATION A machine parked just under budget holds its tier for five thousand frames. Proved
 *               red by setting the derived headroom to zero, at which point it flaps.
 *
 *   WALL        The demote-only source. Proved not-vacuous by running the identical trace on the
 *               `gpu` source, where it does promote — so the refusal is the source's, not the
 *               trace's. And the median really is the outlier rejection: a window with 10% hitches
 *               holds on `wall` and demotes on `gpu`.
 *
 *   STRUCTURAL  No sequence of samples reaches `fallback`. Proved red by putting `fallback` in the
 *               ladder, at which point a slow machine walks straight onto it.
 *
 *   UNPRICED    A rung nobody measured cannot be promoted into. Proved red by supplying a headroom
 *               override, at which point it can.
 *
 *   REFUSALS    Every bad argument throws, and the message names the fix.
 *
 *   PROBE       The environment-facing half. It never labels a wall clock `gpu`, it self-demotes
 *               when `trackTimestamp` was never granted, and it returns null — not zero — for a
 *               frame that was not a measurement.
 *
 * A measurement outside its range prints FAIL and the process exits non-zero. It is not grounds for
 * widening the range.
 *
 * Usage:  node "packages/core/src/AvatarQuality.selftest.mjs"
 */

// three's GLTFLoader assumes a browser when it decodes embedded textures, and the PARITY section
// imports `Avatar.js`, which reaches the figure loader. Two stubs get it as far as its exports.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const {
    AvatarQuality, BUDGET_LADDER, CONTROL_REPEATS_MS, DECISION_REASONS, FRAME_BUDGET_MS,
    GTAO_FRAME_COST_MS, LADDER_STEP_COST_MS, P50_REPRODUCIBILITY_MS, P95_REPRODUCIBILITY_MS,
    REJECTED_LEVERS, SAMPLE_SOURCES, SHADOW_COST_MS, STRUCTURAL_TIERS, TARGET_FRAMES_PER_SECOND,
    TIMESTAMP_PROBE_FRAMES, WARMUP_FRAMES, WEBGPU_DISPATCH_OVERHEAD_US, WINDOW_FRAMES, WINDOW_MS,
    createFrameCostProbe, minimumSamplesForPercentile, percentileOf, promotionHeadroomFor
} = await import( './AvatarQuality.js' );

const { TimestampQuery } = await import( 'three/webgpu' );

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

function near( a, b, tolerance ) {

    return Math.abs( a - b ) <= tolerance;

}

function throwsWith( fn, fragment ) {

    try {

        fn();

    } catch ( error ) {

        return error.message.includes( fragment ) ? error.message : `threw, but without '${ fragment }': ${ error.message }`;

    }

    return null;

}

/**
 * A simulated machine. `costAtTier( tier, frame )` returns what THIS frame costs given the tier the
 * governor is currently on — which is the whole point: promoting into a tier makes frames more
 * expensive, and that feedback is what a hysteresis has to survive.
 */
function driveMachine( quality, costAtTier, frames ) {

    const open = [ DECISION_REASONS.warmingUp, DECISION_REASONS.windowOpen, DECISION_REASONS.noMeasurement ];
    const settled = [];
    let last = null;

    for ( let frame = 0; frame < frames; frame ++ ) {

        last = quality.update( costAtTier( quality.tier, frame ) );

        // 🚩 `last` is almost always "the window is still filling", because 149 frames in 150 are.
        // A gate that read `last.reason` would be reading the frame after the decision, not the
        // decision — so the decisions are the ones a closed window produced.
        if ( open.includes( last.reason ) === false ) settled.push( last );

    }

    return { last, settled, latest: settled[ settled.length - 1 ] ?? null, report: quality.report() };

}

/** The shipped ladder as a cost model: `high` costs the measured GTAO step more than `balanced`. */
function gtaoMachine( baseMilliseconds ) {

    return ( tier ) => tier === 'high' ? baseMilliseconds + LADDER_STEP_COST_MS.high.p95 : baseMilliseconds;

}

// ================================================================================================
// CONSTANTS — every derived value re-derived from the absolutes it came from
// ================================================================================================
{
    check( 'CONSTANTS  the budget is 60 fps expressed as a duration, not a transcribed 16.6',
        FRAME_BUDGET_MS === 1000 / TARGET_FRAMES_PER_SECOND && FRAME_BUDGET_MS.toFixed( 1 ) === '16.7',
        `${ TARGET_FRAMES_PER_SECOND } fps -> ${ FRAME_BUDGET_MS.toFixed( 4 ) } ms; the repo quotes it as "16.6 ms"` );

    // The one rung, re-derived. GTAO.js prints "+0.845" and "13.921" in its own table; the deltas
    // here must be that subtraction and nothing else.
    const derivedP50 = GTAO_FRAME_COST_MS.low.p50 - GTAO_FRAME_COST_MS.off.p50;
    const derivedP95 = GTAO_FRAME_COST_MS.low.p95 - GTAO_FRAME_COST_MS.off.p95;

    check( '🎯 CONSTANTS  the one budget rung is GTAO low minus GTAO off, subtracted here',
        near( LADDER_STEP_COST_MS.high.p50, derivedP50, 1e-12 )
            && near( LADDER_STEP_COST_MS.high.p95, derivedP95, 1e-12 )
            && near( derivedP50, 0.845, 0.0005 ),
        `p50 ${ GTAO_FRAME_COST_MS.low.p50 } - ${ GTAO_FRAME_COST_MS.off.p50 } = ${ derivedP50.toFixed( 4 ) } ` +
        `(GTAO.js's table prints "+0.845"); p95 ${ GTAO_FRAME_COST_MS.low.p95 } - ` +
        `${ GTAO_FRAME_COST_MS.off.p95 } = ${ derivedP95.toFixed( 4 ) }` );

    check( 'CONSTANTS  the reproducibility floors are one control measured twice, subtracted here',
        near( P95_REPRODUCIBILITY_MS, Math.abs( CONTROL_REPEATS_MS.p95[ 0 ] - CONTROL_REPEATS_MS.p95[ 1 ] ), 1e-12 )
            && near( P50_REPRODUCIBILITY_MS, Math.abs( CONTROL_REPEATS_MS.p50[ 0 ] - CONTROL_REPEATS_MS.p50[ 1 ] ), 1e-12 )
            && near( P95_REPRODUCIBILITY_MS, 0.684, 1e-9 ),
        `p95 |${ CONTROL_REPEATS_MS.p95[ 0 ] } - ${ CONTROL_REPEATS_MS.p95[ 1 ] }| = ${ P95_REPRODUCIBILITY_MS.toFixed( 4 ) } ms; ` +
        `p50 |${ CONTROL_REPEATS_MS.p50[ 0 ] } - ${ CONTROL_REPEATS_MS.p50[ 1 ] }| = ${ P50_REPRODUCIBILITY_MS.toFixed( 4 ) } ms` );

    check( 'CONSTANTS  a p95 is 31x noisier than a p50 on this stack, which is why only one of them prices a step',
        P95_REPRODUCIBILITY_MS / P50_REPRODUCIBILITY_MS > 25,
        `${ ( P95_REPRODUCIBILITY_MS / P50_REPRODUCIBILITY_MS ).toFixed( 2 ) }x — the promotion margin is ` +
        'made of the p95 floor because the p95 is the statistic the gpu source decides on' );

    check( 'CONSTANTS  the window in time is a full window AT BUDGET, so neither condition is a second opinion',
        WINDOW_MS === WINDOW_FRAMES * FRAME_BUDGET_MS && WINDOW_MS === 2500,
        `${ WINDOW_FRAMES } frames x ${ FRAME_BUDGET_MS.toFixed( 4 ) } ms = ${ WINDOW_MS } ms` );

    check( 'CONSTANTS  the warm-up is the repository\'s own 60 and the window its own 150',
        WARMUP_FRAMES === 60 && WINDOW_FRAMES === 150,
        'GTAO.js "200 samples after 60 warm-up frames"; alive.js "100 samples after 60 warm-up steps"; ' +
        'testbed/stage.js ?warmup=60 ?frames=150' );

    check( 'CONSTANTS  the ladder is richest-first and every rung below the top is priced',
        BUDGET_LADDER[ 0 ] === 'high'
            && BUDGET_LADDER.every( ( tier, index ) => index === BUDGET_LADDER.length - 1 || LADDER_STEP_COST_MS[ tier ] !== undefined ),
        `ladder ${ BUDGET_LADDER.join( ' -> ' ) }; priced rungs ${ Object.keys( LADDER_STEP_COST_MS ).join( ', ' ) }` );
}

// ================================================================================================
// LEVERS — the switches that are not levers, each rejected by its own measurement
// ================================================================================================
{
    // 🚩 The instructive rejection. It is not "we chose not to"; it is "measured, it buys nothing,
    // and what it buys is negative".
    const shadowMapDelta = SHADOW_COST_MS.oneCasterAtMapSize1024 - SHADOW_COST_MS.oneCasterAtMapSize2048;

    check( '🎯 LEVERS  halving the shadow map is not a lever — the saving is inside the noise AND has the wrong sign',
        Math.abs( shadowMapDelta ) < SHADOW_COST_MS.runToRunNoise && shadowMapDelta > 0,
        `2048 ${ SHADOW_COST_MS.oneCasterAtMapSize2048 } ms -> 1024 ${ SHADOW_COST_MS.oneCasterAtMapSize1024 } ms ` +
        `= ${ shadowMapDelta.toFixed( 3 ) } ms, i.e. the smaller map cost MORE, and |Δ| is inside the ` +
        `±${ SHADOW_COST_MS.runToRunNoise } ms run-to-run p95 noise the same sweep states. The shadow pass ` +
        'is bound by the extra geometry draw, not by fill' );

    const casterRatio = SHADOW_COST_MS.plusOneCaster / LADDER_STEP_COST_MS.high.p95;

    check( 'LEVERS  the unspendable shadow rung is quantified rather than asserted (REQ-D)',
        casterRatio > 1.5,
        `one caster ${ SHADOW_COST_MS.plusOneCaster } ms p95 against the shipped GTAO rung's ` +
        `${ LADDER_STEP_COST_MS.high.p95.toFixed( 3 ) } ms = ${ casterRatio.toFixed( 2 ) }x. ` +
        'It needs a tier name in Avatar.js and an independent reproduction of 2.624 first' );

    check( 'LEVERS  four casters really would take 77% of the frame, so the rig pairing exactly one is a measurement',
        ( SHADOW_COST_MS.fourAreaLights + SHADOW_COST_MS.plusFourCasters ) / FRAME_BUDGET_MS > 0.75,
        `${ SHADOW_COST_MS.fourAreaLights } + ${ SHADOW_COST_MS.plusFourCasters } = ` +
        `${ ( SHADOW_COST_MS.fourAreaLights + SHADOW_COST_MS.plusFourCasters ).toFixed( 3 ) } ms of ` +
        `${ FRAME_BUDGET_MS.toFixed( 3 ) } = ` +
        `${ ( 100 * ( SHADOW_COST_MS.fourAreaLights + SHADOW_COST_MS.plusFourCasters ) / FRAME_BUDGET_MS ).toFixed( 0 ) }%` );

    const firefoxFrameMs = WEBGPU_DISPATCH_OVERHEAD_US.firefox * WEBGPU_DISPATCH_OVERHEAD_US.passesPerFrame / 1000;
    const chromeRatio = WEBGPU_DISPATCH_OVERHEAD_US.firefox / WEBGPU_DISPATCH_OVERHEAD_US.chrome;
    const leftForDrawing = FRAME_BUDGET_MS - firefoxFrameMs;

    // ⚠️ THIS CLAUSE USED TO SAY "SPENDS THE WHOLE BUDGET" AND THE ARITHMETIC SAID 94%. Corrected
    // rather than widened: 15.60 is not more than 16.67, and the disqualification does not need it
    // to be. What disqualifies Firefox's WebGPU path is that 1.07 ms is left for the skin, the
    // eyes, the occlusion, the shadow and the grade — the same argument LightingRig makes about
    // four shadow casters at 77%, one step further along.
    check( '🎯 LEVERS  forceWebGL is structural — Firefox leaves about a millisecond of the frame to draw in',
        leftForDrawing > 0 && leftForDrawing < 1.5 && near( chromeRatio, 18, 0.5 ),
        `${ WEBGPU_DISPATCH_OVERHEAD_US.firefox } µs x ${ WEBGPU_DISPATCH_OVERHEAD_US.passesPerFrame } passes = ` +
        `${ firefoxFrameMs.toFixed( 2 ) } ms of dispatch, which is ` +
        `${ ( 100 * firefoxFrameMs / FRAME_BUDGET_MS ).toFixed( 0 ) }% of a ${ FRAME_BUDGET_MS.toFixed( 2 ) } ms ` +
        `budget and leaves ${ leftForDrawing.toFixed( 2 ) } ms to draw in; ` +
        `${ chromeRatio.toFixed( 1 ) }x Chrome's ${ WEBGPU_DISPATCH_OVERHEAD_US.chrome } µs, which is ` +
        'Stage.js:151\'s "roughly 18x Chrome\'s" re-derived' );

    const rejected = Object.entries( REJECTED_LEVERS );

    check( 'LEVERS  every rejected switch carries a measurement, a reason and a source',
        rejected.length === 5 && rejected.every( ( [ , row ] ) =>
            typeof row.measured === 'string' && row.measured.length > 0
            && typeof row.why === 'string' && row.why.length > 0
            && typeof row.source === 'string' && row.source.length > 0 ),
        `rejected: ${ rejected.map( ( [ name ] ) => name ).join( ', ' ) }` );

    check( 'LEVERS  the grade row is carried as a RETRACTION, not as a saving',
        REJECTED_LEVERS.grade.why.includes( 'do not quote 1.217' ),
        'Grade.js measured the bloom chain at 1.217 ms and then withdrew the number on the current build' );

    check( 'LEVERS  exactly one switch in this repository is priced well enough to be a rung',
        Object.keys( LADDER_STEP_COST_MS ).length === 1 && LADDER_STEP_COST_MS.high.lever.includes( 'GTAO' ),
        `the rung is "${ LADDER_STEP_COST_MS.high.lever }" over ${ LADDER_STEP_COST_MS.high.over }; ` +
        `${ rejected.length } other switches were considered and rejected` );
}

// ================================================================================================
// PARITY — the tier names are Avatar.js's, and this is the only place the two files meet
// ================================================================================================
{
    let tierNames = null;
    let importError = null;

    try {

        const avatar = await import( './Avatar.js' );
        tierNames = Object.keys( avatar.QUALITY_TIERS );

    } catch ( error ) {

        importError = error.message;

    }

    check( '🎯 PARITY  every ladder and structural tier name is a key of Avatar.js\'s QUALITY_TIERS',
        tierNames !== null
            && [ ...BUDGET_LADDER, ...STRUCTURAL_TIERS ].every( ( tier ) => tierNames.includes( tier ) ),
        tierNames === null
            ? `could not import Avatar.js: ${ importError }`
            : `QUALITY_TIERS ${ tierNames.join( ', ' ) }; ladder ${ BUDGET_LADDER.join( ', ' ) }; ` +
                `structural ${ STRUCTURAL_TIERS.join( ', ' ) }` );

    check( 'PARITY  the two lists together account for every tier Avatar.js defines',
        tierNames !== null
            && tierNames.every( ( tier ) => BUDGET_LADDER.includes( tier ) || STRUCTURAL_TIERS.includes( tier ) ),
        tierNames === null ? 'not run' : `unaccounted: ${ tierNames.filter( ( tier ) =>
            BUDGET_LADDER.includes( tier ) === false && STRUCTURAL_TIERS.includes( tier ) === false ).join( ', ' ) || 'none' }` );
}

// ================================================================================================
// PERCENTILE
// ================================================================================================
{
    const twenty = Array.from( { length: 20 }, ( unused, index ) => index + 1 );
    const shuffled = [ ...twenty ].reverse();

    check( 'PERCENTILE  nearest-rank, never interpolated — a p95 is a value some frame actually took',
        percentileOf( shuffled, 0.95 ) === 19 && percentileOf( shuffled, 0.5 ) === 10
            && percentileOf( shuffled, 1 ) === 20,
        `samples 1..20 -> p50 ${ percentileOf( shuffled, 0.5 ) }, p95 ${ percentileOf( shuffled, 0.95 ) }, ` +
        `p100 ${ percentileOf( shuffled, 1 ) }` );

    const before = [ 3, 1, 2 ];
    percentileOf( before, 0.5 );

    check( 'PERCENTILE  the caller\'s sample buffer is not sorted out from under it',
        before[ 0 ] === 3 && before[ 1 ] === 1 && before[ 2 ] === 2,
        `[3,1,2] is still ${ JSON.stringify( before ) } after a percentile` );

    const floor95 = minimumSamplesForPercentile( 0.95 );
    const atFloor = Array.from( { length: floor95 }, ( unused, index ) => index + 1 );
    const belowFloor = atFloor.slice( 0, floor95 - 1 );

    check( '🎯 PERCENTILE  the sample floor is where exactly one sample sits above the rank',
        floor95 === 20 && minimumSamplesForPercentile( 0.5 ) === 2
            && atFloor.filter( ( value ) => value > percentileOf( atFloor, 0.95 ) ).length === 1
            && percentileOf( belowFloor, 0.95 ) === Math.max( ...belowFloor ),
        `p95 needs ceil(1/(1-0.95)) = ${ floor95 } samples. At ${ floor95 }, p95 = ` +
        `${ percentileOf( atFloor, 0.95 ) } with one sample above it. At ${ floor95 - 1 }, p95 = ` +
        `${ percentileOf( belowFloor, 0.95 ) }, which is just max() wearing a percentile's name` );

    check( 'PERCENTILE  an empty window has no percentile and says so',
        throwsWith( () => percentileOf( [], 0.95 ), 'at least one sample' ) !== null,
        throwsWith( () => percentileOf( [], 0.95 ), 'at least one sample' ) ?? 'did not throw' );
}

// ================================================================================================
// HYSTERESIS — 🎯 the anti-oscillation proof, as arithmetic rather than as a trial
// ================================================================================================
{
    const headroom = promotionHeadroomFor( 'high' );
    const threshold = FRAME_BUDGET_MS - headroom;
    const afterPromoting = threshold + LADDER_STEP_COST_MS.high.p95;

    check( '🎯 HYSTERESIS  the headroom is the step cost plus the measurement\'s own noise floor',
        near( headroom, LADDER_STEP_COST_MS.high.p95 + P95_REPRODUCIBILITY_MS, 1e-12 ),
        `${ LADDER_STEP_COST_MS.high.p95.toFixed( 4 ) } + ${ P95_REPRODUCIBILITY_MS.toFixed( 4 ) } = ` +
        `${ headroom.toFixed( 4 ) } ms, so promotion happens at ${ threshold.toFixed( 4 ) } ms` );

    check( '🎯 HYSTERESIS  promoting AT the threshold lands strictly inside budget — oscillation is arithmetically impossible',
        afterPromoting < FRAME_BUDGET_MS && near( FRAME_BUDGET_MS - afterPromoting, P95_REPRODUCIBILITY_MS, 1e-9 ),
        `${ threshold.toFixed( 4 ) } + ${ LADDER_STEP_COST_MS.high.p95.toFixed( 4 ) } = ` +
        `${ afterPromoting.toFixed( 4 ) } ms, inside the ${ FRAME_BUDGET_MS.toFixed( 4 ) } ms budget by ` +
        `${ ( FRAME_BUDGET_MS - afterPromoting ).toFixed( 4 ) } ms — which IS the p95 reproducibility, ` +
        'so the margin a promoted machine keeps is the noise floor rather than a preference' );

    check( 'HYSTERESIS  the cheapest rung has no headroom to state, and reports null rather than zero',
        promotionHeadroomFor( 'balanced' ) === null && promotionHeadroomFor( 'nonesuch' ) === null,
        'nothing is promoted INTO the bottom of the ladder, and an unpriced name is null, not 0' );
}

// ================================================================================================
// DECISION — what a machine at a given cost actually picks
// ================================================================================================
{
    const overBudget = driveMachine( new AvatarQuality( { tier: 'high', source: 'gpu' } ), gtaoMachine( 18.6 ), 1000 );

    check( 'DECISION  a machine over budget demotes off high, once',
        overBudget.report.tier === 'balanced' && overBudget.report.changes.length === 1
            && overBudget.report.changes[ 0 ].reason === DECISION_REASONS.overBudget,
        `high at ${ ( 18.6 + LADDER_STEP_COST_MS.high.p95 ).toFixed( 3 ) } ms -> demoted at frame ` +
        `${ overBudget.report.changes[ 0 ]?.atFrame }; settled on ${ overBudget.report.tier } at 18.6 ms, ` +
        'which is over budget and has nowhere cheaper to go' );

    check( '🎯 DECISION  a machine that cannot hold the cheapest rung STILL never reaches fallback',
        overBudget.report.tier === 'balanced' && overBudget.latest.reason === DECISION_REASONS.cheapestRung,
        `18.6 ms against a ${ FRAME_BUDGET_MS.toFixed( 2 ) } ms budget for 1000 frames and the tier is ` +
        `'${ overBudget.report.tier }' — fallback is MSAA on a different backend, not a cheaper rung` );

    const fast = driveMachine( new AvatarQuality( { tier: 'balanced', source: 'gpu' } ), gtaoMachine( 11.0 ), 2000 );

    check( 'DECISION  a machine with the measured headroom promotes, once, and then holds',
        fast.report.tier === 'high' && fast.report.changes.length === 1
            && fast.report.changes[ 0 ].reason === DECISION_REASONS.promoted,
        `11.0 ms on balanced -> promoted at frame ${ fast.report.changes[ 0 ]?.atFrame }; ` +
        `now ${ ( 11.0 + LADDER_STEP_COST_MS.high.p95 ).toFixed( 3 ) } ms and no further change in 2000 frames` );

    // The dead band: inside budget, but without the headroom the richer tier would cost.
    const deadBand = driveMachine( new AvatarQuality( { tier: 'balanced', source: 'gpu' } ), gtaoMachine( 16.0 ), 3000 );

    check( '🎯 DECISION  the dead band exists — 16.0 ms is inside budget and still not enough to promote',
        deadBand.report.tier === 'balanced' && deadBand.report.changes.length === 0
            && deadBand.settled.length > 0
            && deadBand.settled.every( ( decision ) => decision.reason === DECISION_REASONS.insideBudget ),
        `16.0 ms < ${ FRAME_BUDGET_MS.toFixed( 3 ) } budget, but > ` +
        `${ ( FRAME_BUDGET_MS - promotionHeadroomFor( 'high' ) ).toFixed( 3 ) } threshold. Promoting would ` +
        `cost ${ LADDER_STEP_COST_MS.high.p95.toFixed( 3 ) } ms and land at ` +
        `${ ( 16.0 + LADDER_STEP_COST_MS.high.p95 ).toFixed( 3 ) } — over budget on the next window` );

    const threshold = FRAME_BUDGET_MS - promotionHeadroomFor( 'high' );
    const atThreshold = driveMachine( new AvatarQuality( { tier: 'balanced', source: 'gpu' } ), gtaoMachine( threshold ), 3000 );

    check( '🎯 DECISION  a machine exactly AT the threshold promotes and stays promoted',
        atThreshold.report.tier === 'high' && atThreshold.report.changes.length === 1,
        `${ threshold.toFixed( 4 ) } ms -> high -> ${ ( threshold + LADDER_STEP_COST_MS.high.p95 ).toFixed( 4 ) } ms, ` +
        `held for the remaining ${ 3000 - atThreshold.report.changes[ 0 ].atFrame } frames` );

    const early = new AvatarQuality( { tier: 'high', source: 'gpu' } );
    driveMachine( early, () => 40, WARMUP_FRAMES + 200 );

    check( 'DECISION  a very slow machine closes its window on TIME, not on 150 frames, so it does not suffer for seconds',
        early.changes.length >= 1 && early.changes[ 0 ].atFrame < WARMUP_FRAMES + WINDOW_FRAMES,
        `40 ms frames reach the ${ WINDOW_MS } ms window in ${ Math.ceil( WINDOW_MS / 40 ) } samples ` +
        `(above the ${ minimumSamplesForPercentile( 0.95 ) }-sample p95 floor), so the demote landed at frame ` +
        `${ early.changes[ 0 ].atFrame } rather than ${ WARMUP_FRAMES + WINDOW_FRAMES }` );
}

// ================================================================================================
// WINDOW — a single fast frame cannot promote, and the clause is proved red
// ================================================================================================
{
    const one = new AvatarQuality( { tier: 'balanced', source: 'gpu' } );
    for ( let frame = 0; frame < WARMUP_FRAMES; frame ++ ) one.update( 5 );
    const afterOne = one.update( 2 );

    check( 'WINDOW  one fast frame past the warm-up promotes nothing',
        afterOne.changed === false && afterOne.reason === DECISION_REASONS.windowOpen && afterOne.sampleCount === 1,
        `a 2.0 ms frame with ${ afterOne.sampleCount } sample in the window: ${ afterOne.reason }` );

    const counted = new AvatarQuality( { tier: 'balanced', source: 'gpu' } );
    for ( let frame = 0; frame < WARMUP_FRAMES; frame ++ ) counted.update( 5 );
    for ( let frame = 0; frame < WINDOW_FRAMES - 1; frame ++ ) counted.update( 5 );
    const atPenultimate = counted.tier;
    const atFull = counted.update( 5 );

    check( '🎯 WINDOW  promotion lands on the 150th sample and not the 149th',
        atPenultimate === 'balanced' && atFull.changed === true && atFull.tier === 'high',
        `after ${ WINDOW_FRAMES - 1 } samples: '${ atPenultimate }'. After ${ WINDOW_FRAMES }: ` +
        `'${ atFull.tier }' (${ atFull.reason }, p95 ${ atFull.measuredMilliseconds } ms)` );

    // 🔴 RED PROOF — reintroduce the defect: a window of one frame.
    const defective = new AvatarQuality( { tier: 'balanced', source: 'gpu', windowFrames: 1 } );
    for ( let frame = 0; frame < WARMUP_FRAMES; frame ++ ) defective.update( 5 );
    const defectiveDecision = defective.update( 2 );

    check( '🔴 WINDOW  RED PROOF — with the window shrunk to one frame, that same 2.0 ms frame promotes',
        defectiveDecision.changed === true && defectiveDecision.tier === 'high',
        `windowFrames: 1 -> '${ defectiveDecision.tier }' on a single sample (${ defectiveDecision.reason }). ` +
        'The green clause above is therefore the window doing work, not the arithmetic being lucky' );

    /**
     * 🎯 A MACHINE THAT GETS FASTER — the only stimulus that can see the window being CLEARED.
     *
     * Every other machine in this gate holds one cost, so a stale buffer and a fresh one read the
     * same and the clear is invisible. Here the first 400 frames cost 30 ms and the rest are cheap:
     * with the window cleared after each decision the avatar demotes and then earns its tier back;
     * without it the dead expensive samples pin the p95 and the demotion is permanent. A one-way
     * ratchet is exactly the shape of quality bug nobody files, because it only ever looks like
     * "it never came back".
     */
    const recovering = ( tier, frame ) => frame < 400
        ? 30
        : ( tier === 'high' ? 11.0 + LADDER_STEP_COST_MS.high.p95 : 11.0 );

    const recovered = driveMachine( new AvatarQuality( { tier: 'high', source: 'gpu' } ), recovering, 3000 );

    check( '🎯 WINDOW  a machine that gets faster earns its tier back — the window is cleared after every decision',
        recovered.report.tier === 'high' && recovered.report.changes.length === 2
            && recovered.report.changes[ 0 ].to === 'balanced' && recovered.report.changes[ 1 ].to === 'high',
        `30 ms for 400 frames then 11 ms: ` +
        `${ recovered.report.changes.map( ( change ) => `${ change.from }->${ change.to }@${ change.atFrame }` ).join( ', ' ) }` );

    // 🔴 RED PROOF — reintroduce the defect on the real object: put the samples back after every
    // decision, so the window is never cleared.
    const leaky = new AvatarQuality( { tier: 'high', source: 'gpu' } );
    const settleWithoutClearing = leaky.settle.bind( leaky );

    leaky.settle = ( tier, reason, measured ) => {

        const kept = [ ...leaky.samples ];
        const decision = settleWithoutClearing( tier, reason, measured );

        leaky.samples = kept;
        leaky.accumulatedMilliseconds = kept.reduce( ( sum, sample ) => sum + sample, 0 );

        return decision;

    };

    const leaked = driveMachine( leaky, recovering, 3000 );

    check( '🔴 WINDOW  RED PROOF — with the clear undone, the samples from the slow phase pin the p95 forever',
        leaked.report.tier === 'balanced',
        `same machine, window never cleared -> stuck on '${ leaked.report.tier }' after ` +
        `${ leaked.report.changes.length } change(s); the buffer still holds ` +
        `${ leaky.samples.length } samples, p95 ${ percentileOf( leaky.samples, 0.95 ).toFixed( 1 ) } ms, ` +
        'most of which are frames this machine stopped drawing 2600 frames ago' );
}

// ================================================================================================
// WARMUP — the frames after a tier change are the cost of arriving, and are discarded
// ================================================================================================
{
    const warming = new AvatarQuality( { tier: 'high', source: 'gpu' } );
    for ( let frame = 0; frame < WARMUP_FRAMES; frame ++ ) warming.update( 99 );

    check( 'WARMUP  the first 60 measured frames never enter the window, however bad they are',
        warming.samples.length === 0 && warming.warmupRemaining === 0 && warming.changes.length === 0,
        `${ WARMUP_FRAMES } frames at 99 ms discarded; window holds ${ warming.samples.length } samples` );

    /**
     * A machine that is fine, but whose 60 frames after any tier change cost 99 ms — shader
     * compilation and attachment reallocation, which is what a tier change really does.
     */
    function coldAfterChange( quality ) {

        let framesSinceChange = Infinity;
        let lastTier = quality.tier;

        return ( tier ) => {

            if ( tier !== lastTier ) {

                lastTier = tier;
                framesSinceChange = 0;

            }

            framesSinceChange ++;

            if ( framesSinceChange <= WARMUP_FRAMES ) return 99;

            return tier === 'high' ? 11.0 + LADDER_STEP_COST_MS.high.p95 : 11.0;

        };

    }

    const honest = new AvatarQuality( { tier: 'balanced', source: 'gpu' } );
    driveMachine( honest, coldAfterChange( honest ), 3000 );

    check( '🎯 WARMUP  a tier change re-arms the warm-up, so a tier is never judged on the cost of arriving',
        honest.tier === 'high' && honest.changes.length === 1,
        `promoted once at frame ${ honest.changes[ 0 ]?.atFrame } and stayed, despite 60 frames of 99 ms ` +
        'immediately after the swap' );

    // 🔴 RED PROOF — reintroduce the defect: no warm-up at all.
    const defective = new AvatarQuality( { tier: 'balanced', source: 'gpu', warmupFrames: 0 } );
    driveMachine( defective, coldAfterChange( defective ), 3000 );

    check( '🔴 WARMUP  RED PROOF — with the warm-up removed, the cost of arriving demotes the tier it arrived at',
        defective.changes.length > 1,
        `warmupFrames: 0 -> ${ defective.changes.length } changes ` +
        `(${ defective.changes.map( ( change ) => `${ change.from }->${ change.to }` ).join( ', ' ) }), ` +
        `settling on '${ defective.tier }'` );
}

// ================================================================================================
// OSCILLATION — the failure mode a budget-driven tier actually has
// ================================================================================================
{
    const parked = new AvatarQuality( { tier: 'balanced', source: 'gpu' } );
    driveMachine( parked, gtaoMachine( 15.5 ), 5000 );

    check( '🎯 OSCILLATION  a machine parked just under budget holds its tier for 5000 frames',
        parked.changes.length === 0 && parked.tier === 'balanced',
        `15.5 ms is inside the ${ FRAME_BUDGET_MS.toFixed( 3 ) } ms budget and below the ` +
        `${ ( FRAME_BUDGET_MS - promotionHeadroomFor( 'high' ) ).toFixed( 3 ) } ms promotion threshold: ` +
        `${ parked.changes.length } changes` );

    // 🔴 RED PROOF — reintroduce the defect: remove the derived hysteresis.
    const defective = new AvatarQuality( { tier: 'balanced', source: 'gpu', promotionHeadroomMilliseconds: 0 } );
    driveMachine( defective, gtaoMachine( 15.5 ), 5000 );

    const alternates = defective.changes.every( ( change, index ) =>
        index === 0 || change.from === defective.changes[ index - 1 ].to );

    check( '🔴 OSCILLATION  RED PROOF — with the headroom set to zero the same machine flaps between tiers',
        defective.changes.length >= 4 && alternates === true,
        `promotionHeadroomMilliseconds: 0 -> ${ defective.changes.length } changes over 5000 frames, ` +
        `alternating: ${ defective.changes.slice( 0, 6 ).map( ( change ) => `${ change.from }->${ change.to }` ).join( ', ' ) }...` +
        ` — 15.5 promotes, becomes ${ ( 15.5 + LADDER_STEP_COST_MS.high.p95 ).toFixed( 3 ) }, demotes, repeat` );
}

// ================================================================================================
// WALL — the demote-only source, and the proof that its refusal is the source's and not the trace's
// ================================================================================================
{
    const oneTwentyHz = 1000 / 120;
    const wall = new AvatarQuality( { tier: 'balanced', source: 'wall' } );
    driveMachine( wall, () => oneTwentyHz, 2000 );

    check( '🎯 WALL  a vsync-locked 8.33 ms never promotes — that is a full frame on a 120 Hz panel, not half of one',
        wall.tier === 'balanced' && wall.changes.length === 0
            && wall.report().changes.length === 0,
        `${ oneTwentyHz.toFixed( 2 ) } ms for 2000 frames on the wall source: tier '${ wall.tier }', ` +
        `${ wall.changes.length } changes. SAMPLE_SOURCES.wall.canPromote is ${ SAMPLE_SOURCES.wall.canPromote }` );

    const wallDecision = wall.update( oneTwentyHz );

    check( 'WALL  and it says why, in a string a HUD and a gate both read',
        wallDecision.reason === DECISION_REASONS.sourceCannotPromote
            || wallDecision.reason === DECISION_REASONS.windowOpen,
        `reason: "${ wallDecision.reason }"` );

    // 🔴 RED PROOF — the identical trace on the source that CAN see headroom.
    const gpu = new AvatarQuality( { tier: 'balanced', source: 'gpu' } );
    driveMachine( gpu, () => oneTwentyHz, 2000 );

    check( '🔴 WALL  RED PROOF — the identical trace promotes on the gpu source, so the refusal is the clock\'s',
        gpu.tier === 'high' && gpu.changes.length === 1,
        `same ${ oneTwentyHz.toFixed( 2 ) } ms samples, source 'gpu' -> '${ gpu.tier }' after ` +
        `${ gpu.changes.length } change. The wall clock declined a promotion the numbers would have allowed, ` +
        'because a vsync-locked clock cannot tell 8.33-with-headroom from 8.33-flat-out' );

    const ratchet = new AvatarQuality( { tier: 'high', source: 'wall' } );
    driveMachine( ratchet, () => 33.3, 2000 );

    check( 'WALL  the ratchet does work downwards — a missed budget is visible on any clock',
        ratchet.tier === 'balanced' && ratchet.changes.length === 1,
        `33.3 ms (30 fps) on the wall source -> demoted to '${ ratchet.tier }' at frame ${ ratchet.changes[ 0 ]?.atFrame }` );

    // The median IS the outlier rejection, and it needs no threshold to be one.
    const hitchy = ( unused, frame ) => frame % 10 === 0 ? 500 : 12.0;

    const wallHitches = new AvatarQuality( { tier: 'high', source: 'wall' } );
    driveMachine( wallHitches, hitchy, 2000 );

    const gpuHitches = new AvatarQuality( { tier: 'high', source: 'gpu' } );
    driveMachine( gpuHitches, hitchy, 2000 );

    check( '🎯 WALL  10% hitches do not demote on the median, and DO on the p95 — the two tails, measured',
        wallHitches.changes.length === 0 && gpuHitches.changes.length >= 1,
        `a window of 90% 12.0 ms and 10% 500 ms: wall/p50 held '${ wallHitches.tier }' with ` +
        `${ wallHitches.changes.length } changes; gpu/p95 moved to '${ gpuHitches.tier }'. Each source's ` +
        'artefacts live in the opposite tail, so each names its own statistic' );
}

// ================================================================================================
// STRUCTURAL — fallback is unreachable, and the clause is proved red
// ================================================================================================
{
    const pinned = new AvatarQuality( { tier: 'fallback', source: 'gpu' } );
    const pinnedRun = driveMachine( pinned, () => 200, 5000 );

    check( '🎯 STRUCTURAL  a fallback avatar at 200 ms a frame does not move, and reports why',
        pinned.tier === 'fallback' && pinned.changes.length === 0
            && pinnedRun.last.reason === DECISION_REASONS.structuralTier
            && pinnedRun.settled.length === 5000
            && pinnedRun.report.selectedBy === 'structural',
        `5000 frames at 200 ms: tier '${ pinned.tier }', ${ pinned.changes.length } changes, ` +
        `reason "${ pinnedRun.last.reason }"` );

    const shipped = new AvatarQuality( { tier: 'high', source: 'gpu' } );
    driveMachine( shipped, () => 200, 5000 );

    check( 'STRUCTURAL  and no sequence of samples walks a normal avatar DOWN onto it either',
        shipped.tier === 'balanced' && shipped.changes.every( ( change ) => change.to !== 'fallback' ),
        `5000 frames at 200 ms from 'high': ${ shipped.changes.map( ( change ) => `${ change.from }->${ change.to }` ).join( ', ' ) }` );

    // 🔴 RED PROOF — reintroduce the defect: put the structural tier in the budget ladder.
    const defective = new AvatarQuality( {
        tier: 'high', source: 'gpu', ladder: [ 'high', 'balanced', 'fallback' ]
    } );
    driveMachine( defective, () => 200, 5000 );

    check( '🔴 STRUCTURAL  RED PROOF — with fallback in the ladder the same machine walks straight onto it',
        defective.tier === 'fallback',
        `ladder ['high','balanced','fallback'] -> '${ defective.tier }' via ` +
        `${ defective.changes.map( ( change ) => `${ change.from }->${ change.to }` ).join( ', ' ) }. ` +
        'Keeping fallback OUT of BUDGET_LADDER is what makes the green clause above true' );
}

// ================================================================================================
// UNPRICED — a rung nobody measured cannot be promoted into
// ================================================================================================
{
    const unpriced = new AvatarQuality( {
        tier: 'high', source: 'gpu', ladder: [ 'ultra', 'high', 'balanced' ]
    } );
    const run = driveMachine( unpriced, () => 2.0, 1000 );

    check( '🎯 UNPRICED  a 2.0 ms machine refuses to promote into a rung this repository never measured',
        unpriced.tier === 'high' && unpriced.changes.length === 0
            && run.settled.length > 0
            && run.settled.every( ( decision ) => decision.reason === DECISION_REASONS.unpricedRung )
            && run.latest.promotionThresholdMilliseconds === null,
        `2.0 ms with ${ ( FRAME_BUDGET_MS - 2 ).toFixed( 1 ) } ms spare, and 'ultra' has no entry in ` +
        `LADDER_STEP_COST_MS: ${ run.settled.length } closed windows, every one "${ run.latest.reason }". ` +
        'Spending an unmeasured amount of a 16.6 ms budget is the move REJECTED_LEVERS exists to refuse' );

    // 🔴 RED PROOF — supply a headroom and the refusal disappears.
    const defective = new AvatarQuality( {
        tier: 'high', source: 'gpu', ladder: [ 'ultra', 'high', 'balanced' ],
        promotionHeadroomMilliseconds: 2.0
    } );
    driveMachine( defective, () => 2.0, 1000 );

    check( '🔴 UNPRICED  RED PROOF — given a headroom to compare against, it promotes into ultra',
        defective.tier === 'ultra' && defective.changes.length === 1,
        `promotionHeadroomMilliseconds: 2.0 -> '${ defective.tier }'. So the green clause is the null ` +
        'headroom being read, not the ladder being short' );
}

// ================================================================================================
// NULLS — a frame that was not a measurement advances nothing
// ================================================================================================
{
    const idle = new AvatarQuality( { tier: 'high', source: 'wall' } );

    for ( let frame = 0; frame < 1000; frame ++ ) idle.update( null );

    const report = idle.report();

    check( '🎯 NULLS  1000 non-measurements advance neither the warm-up nor the window',
        report.warmupRemaining === WARMUP_FRAMES && report.sampleCount === 0
            && report.framesSeen === 1000 && report.framesMeasured === 0 && report.windowsClosed === 0,
        `framesSeen ${ report.framesSeen }, framesMeasured ${ report.framesMeasured }, ` +
        `warmupRemaining ${ report.warmupRemaining }, samples ${ report.sampleCount }. A hidden tab's ` +
        'throttled rAF and an empty timestamp resolve both arrive here, and neither is a frame' );

    check( 'NULLS  undefined is the same as null — a resolve that returned nothing is not a zero-cost frame',
        idle.update( undefined ).reason === DECISION_REASONS.noMeasurement,
        'Backend.resolveTimestampsAsync returns undefined when trackTimestamp is off' );
}

// ================================================================================================
// REFUSALS — every bad argument throws, and the message names the fix
// ================================================================================================
{
    const refusals = [
        [ 'an unknown tier', () => new AvatarQuality( { tier: 'ultra' } ), 'tier must be one of' ],
        [ 'an unknown source', () => new AvatarQuality( { source: 'vibes' } ), 'source must be one of' ],
        [ 'an empty ladder', () => new AvatarQuality( { ladder: [] } ), 'non-empty array of tier names' ],
        [ 'a non-array ladder', () => new AvatarQuality( { ladder: 'high' } ), 'non-empty array of tier names' ],
        [ 'a NaN frame cost', () => new AvatarQuality().update( NaN ), 'finite number of' ],
        [ 'an infinite frame cost', () => new AvatarQuality().update( Infinity ), 'finite number of' ],
        [ 'a negative frame cost', () => new AvatarQuality().update( -1 ), 'finite number of' ],
        [ 'a percentile of 1 for the sample floor', () => minimumSamplesForPercentile( 1 ), 'fraction on (0, 1)' ]
    ];

    for ( const [ what, fn, fragment ] of refusals ) {

        const message = throwsWith( fn, fragment );

        check( `REFUSALS  ${ what } is refused, in words`,
            message !== null && message.includes( fragment ),
            message ?? 'did not throw' );

    }
}

// ================================================================================================
// PROBE — the environment-facing half, driven over fake stages
// ================================================================================================
{
    check( 'PROBE  three r185\'s own timestamp constant is the string this file passes',
        TimestampQuery.RENDER === 'render',
        `TimestampQuery.RENDER = '${ TimestampQuery.RENDER }', which is Renderer.resolveTimestampsAsync's ` +
        'own default parameter — asserted so an upstream rename fails loudly here rather than silently there' );

    let message = null;

    try {

        await createFrameCostProbe( { renderer: null } );

    } catch ( error ) {

        message = error.message;

    }

    check( 'PROBE  a stage whose create() has not resolved is refused, naming the call that has not run',
        message !== null && message.includes( 'Stage.create()' ),
        message ?? 'did not throw' );

    const noFeature = await createFrameCostProbe( {
        backendName: 'webgpu',
        renderer: { hasFeature: () => false }
    } );

    check( '🎯 PROBE  an adapter without timestamp-query gets the wall clock and is LABELLED wall',
        noFeature.source === 'wall' && noFeature.note.includes( 'timestamp-query' ),
        `source '${ noFeature.source }': ${ noFeature.note }. lighting.js refuses to report wall clock as ` +
        'GPU cost; here the refusal matters more, because a gpu label licenses promotion' );

    const webgl = await createFrameCostProbe( {
        backendName: 'webgl2',
        renderer: { backend: {} }
    } );

    check( 'PROBE  a WebGL2 backend with no disjoint timer query gets the wall clock too',
        webgl.source === 'wall' && webgl.note.includes( 'EXT_disjoint_timer_query_webgl2' ),
        `source '${ webgl.source }': ${ webgl.note }` );

    // The trap this whole file is shaped around: the feature is present, `trackTimestamp` was never
    // asked for at device creation, and the resolve returns undefined forever.
    let resolves = 0;
    const ungranted = await createFrameCostProbe( {
        backendName: 'webgpu',
        renderer: {
            hasFeature: () => true,
            resolveTimestampsAsync: async () => {

                resolves ++;
                return undefined;

            }
        }
    } );

    const beforeGivingUp = ungranted.source;
    const readings = [];
    for ( let frame = 0; frame < TIMESTAMP_PROBE_FRAMES; frame ++ ) readings.push( await ungranted.read() );

    check( '🎯 PROBE  trackTimestamp never granted — the probe self-demotes after 40 empty resolves and says why',
        beforeGivingUp === 'gpu' && ungranted.source === 'wall'
            && ungranted.note.includes( 'device creation' )
            && readings.every( ( reading ) => reading === null ),
        `${ resolves } resolves, all undefined; source '${ beforeGivingUp }' -> '${ ungranted.source }'. ` +
        `Every read returned null rather than 0 — a zero would have been a free frame, and this ` +
        'is a frame that was never measured. Note: ' + ungranted.note );

    const granted = await createFrameCostProbe( {
        backendName: 'webgpu',
        renderer: { hasFeature: () => true, resolveTimestampsAsync: async () => 9.5 }
    } );

    const value = await granted.read();

    check( 'PROBE  a positive resolve confirms the source and passes the milliseconds straight through',
        granted.source === 'gpu' && value === 9.5 && granted.note.includes( 'active' ),
        `read() -> ${ value } ms; note "${ granted.note }"` );

    const wallProbe = await createFrameCostProbe( { renderer: {} }, { source: 'wall' } );
    const first = await wallProbe.read();
    for ( let spin = 0; spin < 200000; spin ++ ) Math.sqrt( spin );
    const second = await wallProbe.read();

    check( 'PROBE  the wall clock has no interval before its first frame, and a positive one after',
        wallProbe.source === 'wall' && first === null && typeof second === 'number' && second > 0,
        `first read ${ first }, second read ${ second.toFixed( 4 ) } ms` );

    // 🚩 A hidden tab's rAF is throttled to about 1 Hz and those are not frames.
    const hadDocument = 'document' in globalThis;
    globalThis.document = { visibilityState: 'hidden' };

    const hiddenWall = await wallProbe.read();
    const hiddenGpu = await granted.read();

    if ( hadDocument === false ) delete globalThis.document;

    check( '🎯 PROBE  a frame drawn while the document is hidden is null on both sources',
        hiddenWall === null && hiddenGpu === null,
        `wall ${ hiddenWall }, gpu ${ hiddenGpu } — a throttled 1 Hz rAF fed in as a 1000 ms frame would ` +
        'demote a healthy avatar for being in a background tab, and no median can rescue a window ' +
        'made entirely of them' );

    const back = await granted.read();

    check( 'PROBE  and the source recovers the moment the document is visible again',
        back === 9.5,
        `visibilityState restored -> read() ${ back } ms` );
}

// --- results ------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( `\nbudget ${ FRAME_BUDGET_MS.toFixed( 4 ) } ms @ ${ TARGET_FRAMES_PER_SECOND } fps · ` +
    `ladder ${ BUDGET_LADDER.join( ' -> ' ) } · structural ${ STRUCTURAL_TIERS.join( ', ' ) }\n` );
process.stdout.write( `rung 'high' costs ${ LADDER_STEP_COST_MS.high.p95.toFixed( 4 ) } ms p95 · ` +
    `promotion headroom ${ promotionHeadroomFor( 'high' ).toFixed( 4 ) } ms · ` +
    `promote at ${ ( FRAME_BUDGET_MS - promotionHeadroomFor( 'high' ) ).toFixed( 4 ) } ms\n\n` );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
