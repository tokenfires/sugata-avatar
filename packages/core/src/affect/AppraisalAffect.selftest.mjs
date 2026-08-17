/**
 * Gate for `affect/AppraisalAffect.js` — punch-list 5.3, the BLENDING half of tier 2.
 *
 * Everything here runs headless and offline. The transport half has its own gate
 * (`LMStudioClient.selftest.mjs`, 61/61) and is not re-measured; this file injects a STUB CLIENT
 * with the same two methods, so every clause below is about what a tier-2 result is allowed to do
 * to `AffectState` rather than about how it got here. The END-TO-END section is the exception: it
 * composes the REAL `LMStudioClient` over a stub `fetch` with the REAL `ExpressionMap` anchor set,
 * because two halves that each pass their own gate can still disagree at the seam.
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   CONSTRUCTION  The two injections are required and throw when missing. A layer that defaulted to
 *                 its own `AffectState` would blend tier 2 into a state nothing renders from, and
 *                 every other clause here would still pass.
 *
 *   WEIGHTS       🎯 The blend weight is ARITHMETIC on the two tiers' own published confidences,
 *                 re-derived in this process from a REAL `ReflexAffect.estimate()` rather than
 *                 compared to numbers typed here. The two ends of the range are asserted by name:
 *                 tier 1 confident pools to exactly 1/2, tier 1 with no evidence hands the axis
 *                 over at exactly 1, and an UNDECLARED prior is not the same statement as a zero.
 *
 *   WARM          The 22.285 s cold load is paid ONCE, at construction, and never again — proved
 *                 across three appraisals and proved red by `warmPerCall`. Also that it is NOT
 *                 awaited: an appraisal issued while the model is still loading must reach the
 *                 client, because the per-utterance timeout is what turns a cold model into tier 1.
 *
 *   REFUSAL       🚩 The clause the research doc's degenerate-output guard is written for. EVERY
 *                 reason in `REFUSAL` leaves the state BIT-IDENTICAL — target, emotion, mood and
 *                 clock — not merely "close". Proved red by `blendOnRefusal`.
 *
 *   BLEND         A good result moves the target TOWARD the tier-2 vector and lands on the exact
 *                 pooled midpoint, `pad` does not move at all on the frame the result arrives, and
 *                 the face converges over the following second. Proved red by `snapOnBlend`, which
 *                 puts the target on the tier-2 vector outright — the pop.
 *
 *   VECTOR        🎯 `LMStudioClient`'s measured happy/surprised row, replayed: the vector sits
 *                 0.2236 from WASABI's happy anchors and 0.7348 from surprised's under
 *                 `ExpressionMap`'s own metric — inside the 0.645 activation threshold for one and
 *                 outside it for the other — while the label says `surprised`. The blend must
 *                 follow the VECTOR. Proved red by `trustLabel`, which writes the label's anchor
 *                 instead and lands in a different corner of the cube.
 *
 *   CLOCK         The contract's trap (c): one clock owner. An appraisal advances nothing. Proved
 *                 red by `advanceClock`, which catches the state up by the latency it measured.
 *
 *   FENCE         🚩 The mechanism that makes "never from a frame path" structural. A frame loop
 *                 calling with one utterance's text is refused on frame 2 and on all 59 after it,
 *                 while a genuinely new utterance supersedes cleanly — and the superseded reply,
 *                 which settles LATER, never writes. Both directions, because a fence that refuses
 *                 everything passes the first half alone. Proved red by `noFence`, which puts all
 *                 60 frames on the wire, and by `writeStale`, which lets the overtaken reply write.
 *
 *   INVARIANCE    🚩 The section this project has earned four times. The whole tier-1-then-tier-2
 *                 trajectory, driven at 30, 60 and 120 Hz with the blend landing at the same wall
 *                 instant, compared at every shared sample. This layer has no integrator of its own
 *                 — that is WHY it is invariant — so the red proof reintroduces `AffectState`'s own
 *                 licensed `frameLerp` to prove the comparison can see a rate-dependent trajectory
 *                 at all.
 *
 *   END-TO-END    The real transport over a stub socket, the real anchor set, the real state.
 *
 *
 * 🎯 PROVED RED OUT OF PROCESS AS WELL AS IN IT, AND THE OUT-OF-PROCESS PASS FOUND SOMETHING
 * ------------------------------------------------------------------------------------------
 * The seven `defects` flags prove the clauses they were written for. Six MUTATIONS OF THE MODULE
 * ITSELF — no flag involved — were then run to check the gate sees breakage it was not designed
 * around, and every one goes red with a named clause:
 *
 *   | mutation                                              | red |
 *   |-------------------------------------------------------|-----|
 *   | `appraisalWeights` returns a constant 1                | 13  |
 *   | `push` drops the `confidence` object                   |  7  |
 *   | the constructor no longer calls `warm()`               |  6  |
 *   | the `result.ok === false` branch is removed            |  3  |
 *   | `warm()` deferred one microtask (this file's own bug)  |  2  |
 *   | the `neutral` guard on `trigger()` is removed          |  1  |
 *
 * 🚩 The `no warm()` mutation is the one that changed this file: it made the WARM section THROW on
 * a null promise and the whole suite EXITED ON AN UNCAUGHT ERROR — a stack trace instead of a red
 * line, with every later section unrun. `section()` below is the fix and its comment is the record.
 *
 * A measurement outside its range prints FAIL and the process exits non-zero.
 *
 * Usage:  node "packages/core/src/affect/AppraisalAffect.selftest.mjs"
 */

import { AffectState, PAD_AXES } from './AffectState.js';
import { APPRAISAL_EVIDENCE, AppraisalAffect, SUPERSEDED, appraisalWeights } from './AppraisalAffect.js';
import { LMStudioClient, NEUTRAL_PRIMARY, REFUSAL } from './LMStudioClient.js';
import {
    ACTIVATION_THRESHOLD, ANCHOR_SETS, DOMINANCE_METRIC_WEIGHT, ExpressionMap, WASABI_ANCHORS,
    nearestDistance
} from './ExpressionMap.js';
import { ReflexAffect } from './ReflexAffect.js';

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

/**
 * 🚩 EVERY SECTION RUNS INSIDE THIS, AND THE REASON IS A MEASUREMENT ON THIS FILE.
 *
 * Deleting the constructor's `warm()` call — one of the four out-of-process mutations this gate was
 * proved against — made the WARM section THROW on a null promise instead of printing red. The suite
 * then exited on an uncaught error, which is the same shape `LMStudioClient.selftest.mjs`'s TIMEOUT
 * watchdog was written for: a gate that catches a defect by dying has caught it in the worst
 * available way, because the run reports a stack trace instead of a clause that names itself and
 * every clause after it never runs at all.
 *
 * So a thrown section becomes a FAIL that says which section threw, and the sections after it still
 * run and still report.
 */
async function section( name, body ) {

    try {

        await body();

    } catch ( error ) {

        check( `🚩 ${ name }  SECTION THREW — its remaining clauses never ran`, false,
            `${ error?.name ?? 'Error' }: ${ error?.message ?? error }` );

    }

}

/**
 * `LMStudioClient`'s measured row for the HAPPY utterance, verbatim from its module header — the
 * one where the label and the vector disagree. It is the fixture for the VECTOR section and the
 * well-formed result everywhere else.
 */
const HAPPY = Object.freeze( {
    pleasure: 0.80, arousal: 0.70, dominance: 0.60, primary: 'surprised', intensity: 0.8

} );

/** Its measured ANGRY row, used where a second, differently-signed vector is needed. */
const ANGRY = Object.freeze( {
    pleasure: -0.80, arousal: 0.60, dominance: 0.70, primary: 'angry', intensity: 0.8

} );

const ok = ( value ) => ( { ok: true, value, latencyMs: 674, channel: 'reasoning_content' } );

/** A client that answers immediately. `warmCalls` is what the WARM section counts. */
function immediateClient( result = ok( HAPPY ) ) {

    return {
        warmCalls: 0,
        utterances: [],
        async warm() { this.warmCalls += 1; return { warmed: true, latencyMs: 22285, reason: null }; },
        async appraise( utterance, options ) {

            this.utterances.push( { utterance, options } );
            return typeof result === 'function' ? result( utterance ) : result;

        }
    };

}

/** A client whose replies are held open, so two appraisals can be in flight at once. */
function deferredClient() {

    const client = {
        warmCalls: 0,
        pending: [],
        async warm() { this.warmCalls += 1; return { warmed: true, latencyMs: 22285, reason: null }; },
        appraise( utterance ) {

            return new Promise( ( resolve ) => client.pending.push( { utterance, resolve } ) );

        },
        settle( at, result ) { client.pending[ at ].resolve( result ); }
    };

    return client;

}

/** Everything about a state that a refusal must not change. */
function snapshot( state ) {

    return JSON.stringify( {
        target: state.target, emotion: state.emotion, mood: state.mood, time: state.time
    } );

}

function distance( a, b ) {

    return Math.hypot( a.pleasure - b.pleasure, a.arousal - b.arousal, a.dominance - b.dominance );

}

// --- CONSTRUCTION --------------------------------------------------------------------------------

await section( 'CONSTRUCTION', async () => {

    let noClient = false;
    try { new AppraisalAffect( { state: new AffectState() } ); } catch { noClient = true; }
    check( '🎯 CONSTRUCTION  no client THROWS rather than constructing one', noClient );

    let noState = false;
    try { new AppraisalAffect( { client: immediateClient() } ); } catch { noState = true; }
    check( '🎯 CONSTRUCTION  no state THROWS rather than defaulting to a private AffectState',
        noState,
        'a private state would blend tier 2 into something nothing renders from, silently' );

    // 🚩 STRUCTURAL, NOT DOCUMENTED. No delta-taking method exists, so a MotionStack cannot hold
    // this and a render loop has nothing to call.
    const surface = Object.getOwnPropertyNames( AppraisalAffect.prototype ).sort();
    check( '🎯 CONSTRUCTION  the class exposes NO update() — a frame loop has nothing to call',
        AppraisalAffect.prototype.update === undefined
            && surface.join( ',' ) === 'appraise,constructor,report,warm',
        surface.join( ', ' ) );

    let badUtterance = false;
    try {

        await new AppraisalAffect( { client: immediateClient(), state: new AffectState(),
            warmOnConstruction: false } ).appraise( '   ' );

    } catch { badUtterance = true; }
    check( 'CONSTRUCTION  an empty utterance throws rather than becoming a silent refusal', badUtterance );

} );

// --- WEIGHTS -------------------------------------------------------------------------------------

await section( 'WEIGHTS', async () => {

    // The two named ends of the range, each stated as arithmetic rather than as a literal.
    const confident = appraisalWeights( { pleasure: 1, arousal: 1, dominance: 1 } );
    check( '🎯 WEIGHTS  a fully confident tier 1 pools to exactly 1/2 — neither tier owns the axis',
        PAD_AXES.every( ( axis ) => confident[ axis ] === APPRAISAL_EVIDENCE / ( APPRAISAL_EVIDENCE + 1 ) ),
        JSON.stringify( confident ) );

    const noEvidence = appraisalWeights( { pleasure: 0, arousal: 0, dominance: 0 } );
    check( '🎯 WEIGHTS  a tier 1 with NO evidence hands the axis over at exactly 1',
        PAD_AXES.every( ( axis ) => noEvidence[ axis ] === 1 ),
        'this is punch-list 5.3\'s sticky-dominance fix arriving out of the pooling, not a special case' );

    // ⚠️ Silence is not a zero. Undeclared pools at parity; a declared zero hands the axis over.
    // A layer that read `undefined` as 0 would let tier 2 replace every axis outright on any caller
    // that did not pass a tier-1 estimate, which is most of them.
    const undeclared = appraisalWeights( undefined );
    check( '🎯 WEIGHTS  an UNDECLARED prior pools at 1/2, which is NOT what a declared zero does',
        PAD_AXES.every( ( axis ) => undeclared[ axis ] === 0.5 && noEvidence[ axis ] === 1 ),
        `undeclared ${ undeclared.pleasure }, declared zero ${ noEvidence.pleasure }` );

    check( 'WEIGHTS  a partially stated confidence object treats the missing axis as undeclared',
        appraisalWeights( { pleasure: 0 } ).pleasure === 1
            && appraisalWeights( { pleasure: 0 } ).dominance === 0.5 );

    // 🎯 RE-DERIVED FROM A REAL TIER-1 ESTIMATE IN THIS PROCESS. The identity is what is asserted,
    // so the clause survives ReflexAffect changing its own confidences and fails if this file
    // stops pooling.
    const reflex = new ReflexAffect();
    const tier1 = reflex.estimate( { text: 'That is the third time you have ignored me. I am done asking nicely.' } );
    const derived = appraisalWeights( tier1.confidence );

    check( '🎯 WEIGHTS  against a REAL ReflexAffect estimate, every axis is c2/(c2+c1) exactly',
        PAD_AXES.every( ( axis ) =>
            derived[ axis ] === APPRAISAL_EVIDENCE / ( APPRAISAL_EVIDENCE + tier1.confidence[ axis ] ) ),
        `tier1 P=${ tier1.confidence.pleasure } A=${ tier1.confidence.arousal } D=${ tier1.confidence.dominance }`
            + ` -> tier2 P=${ derived.pleasure.toFixed( 3 ) } A=${ derived.arousal.toFixed( 3 ) }`
            + ` D=${ derived.dominance.toFixed( 3 ) }` );

    check( 'WEIGHTS  every weight lands in [0.5, 1] — tier 2 never gets less than parity',
        PAD_AXES.every( ( axis ) => derived[ axis ] >= 0.5 && derived[ axis ] <= 1 ) );

    // 🎯 THE RED PROOF FOR THE IDENTITY ABOVE, AND IT IS A PROPERTY RATHER THAN A DEFECT FLAG. On
    // this one real utterance the three derived weights are MUTUALLY DISTINCT, so no constant — not
    // 0.5, not 1, not any number a future hand might type here — can satisfy the identity clause.
    // Without this, a `return { pleasure: 0.5, arousal: 0.5, dominance: 0.5 }` would pass every
    // WEIGHTS clause whose prior happened to be 1.
    const distinct = new Set( PAD_AXES.map( ( axis ) => derived[ axis ] ) );
    check( '🎯 WEIGHTS  the three derived weights are mutually DISTINCT — no constant can pass',
        distinct.size === 3,
        `[${ [ ...distinct ].map( ( value ) => value.toFixed( 3 ) ).join( ', ' ) }] from one utterance` );

    // Out-of-range priors are clamped rather than producing a weight outside the range.
    check( 'WEIGHTS  a prior outside [0,1] is clamped, not propagated',
        appraisalWeights( { pleasure: 9, arousal: -4, dominance: NaN } ).pleasure === 0.5
            && appraisalWeights( { pleasure: 9, arousal: -4, dominance: NaN } ).arousal === 1
            && appraisalWeights( { pleasure: 9, arousal: -4, dominance: NaN } ).dominance === 0.5 );

} );

// --- WARM ----------------------------------------------------------------------------------------

await section( 'WARM', async () => {

    const client = immediateClient();
    const appraisal = new AppraisalAffect( { client, state: new AffectState() } );

    check( '🎯 WARM  the 22.285 s cold load is started AT CONSTRUCTION, before any utterance',
        client.warmCalls === 1, `${ client.warmCalls } warm call(s) before the first appraisal` );

    await appraisal.appraise( 'one' );
    await appraisal.appraise( 'two' );
    await appraisal.appraise( 'three' );

    check( '🎯 WARM  three appraisals later it has still been warmed exactly ONCE',
        client.warmCalls === 1, `${ client.warmCalls }` );

    check( 'WARM  a second explicit warm() returns the same promise rather than a second load',
        appraisal.warm() === appraisal.warming && client.warmCalls === 1 );

    // 🚩 RED PROOF. A warm on every utterance breaks nothing visible and costs a 37.75 GB load per
    // turn, so nothing but a count can see it.
    const perCall = immediateClient();
    const defective = new AppraisalAffect( {
        client: perCall, state: new AffectState(), defects: { warmPerCall: true } } );
    await defective.appraise( 'one' );
    await defective.appraise( 'two' );
    check( '🎯 WARM  RED PROOF — defects.warmPerCall makes the count 3, so the clause can fail',
        perCall.warmCalls === 3, `${ perCall.warmCalls } warm calls for 2 appraisals` );

    check( 'WARM  warmOnConstruction:false pays nothing, for a gate that does not want the call',
        immediateClient().warmCalls === 0 );

    // 🚩 A fire-and-forget promise that rejects is an unhandled rejection, which in node is a
    // process exit. The warm's failure has to arrive as a result, not as a throw.
    const throwing = {
        warmCalls: 0,
        async warm() { this.warmCalls += 1; throw new Error( 'ECONNREFUSED' ); },
        async appraise() { return { ok: false, reason: REFUSAL.TRANSPORT, detail: 'down', latencyMs: 1 }; }
    };
    const survivor = new AppraisalAffect( { client: throwing, state: new AffectState() } );
    const warmOutcome = await survivor.warming;
    check( '🎯 WARM  a warm-up that THROWS resolves as { warmed: false } and never rejects',
        warmOutcome.warmed === false && /ECONNREFUSED/.test( warmOutcome.reason ), warmOutcome.reason );

    // ⚠️ NOT AWAITED, ON PURPOSE. An utterance during the load must reach the client so the
    // per-utterance timeout can drop it into tier 1; awaiting the warm turns a 4 s timeout into a
    // 22 s freeze, which is the failure warm() exists to prevent.
    const slowWarm = {
        warmCalls: 0,
        reached: 0,
        warm() { this.warmCalls += 1; return new Promise( () => {} ); },
        async appraise() {

            this.reached += 1;
            return { ok: false, reason: REFUSAL.TIMEOUT, detail: '4000 ms', latencyMs: 4000 };

        }
    };
    const duringLoad = new AppraisalAffect( { client: slowWarm, state: new AffectState() } );
    const timedOut = await duringLoad.appraise( 'said while the weights were still loading' );
    check( '🎯 WARM  an utterance DURING the load reaches the client and times out into tier 1',
        slowWarm.reached === 1 && timedOut.ok === false && timedOut.reason === REFUSAL.TIMEOUT
            && timedOut.applied === false,
        'awaiting the warm here would convert a 4 s timeout into a 22 s freeze' );

} );

// --- REFUSAL -------------------------------------------------------------------------------------

await section( 'REFUSAL', async () => {

    // Tier 1's belief, pushed first, exactly as a host does at the start of an utterance.
    const TIER1 = {
        pleasure: -0.6, arousal: 0.4, dominance: 0.2,
        confidence: { pleasure: 1, arousal: 0.8, dominance: 0 }
    };

    let allHeld = true;
    const moved = [];

    for ( const reason of Object.values( REFUSAL ) ) {

        const state = new AffectState();
        state.push( TIER1 );
        for ( let frame = 0; frame < 30; frame ++ ) state.update( 1 / 60 );

        const before = snapshot( state );

        const appraisal = new AppraisalAffect( {
            client: immediateClient( { ok: false, reason, detail: 'stub', latencyMs: 700 } ),
            state, warmOnConstruction: false } );

        // ⚠️ A THROW IS A FAILURE OF THIS CLAUSE, NOT AN ACCIDENT OF THE HARNESS. Deleting the
        // `result.ok === false` branch makes the refusal path fall through into the blend and die on
        // an undefined vector; without this catch that arrives as a dead section rather than as this
        // clause naming the reason it died on.
        try {

            const result = await appraisal.appraise( 'anything at all' );
            if ( result.applied !== false ) { allHeld = false; moved.push( `${ reason }:applied` ); }

        } catch ( error ) {

            allHeld = false;
            moved.push( `${ reason }:threw ${ error?.message ?? error }` );

        }

        if ( snapshot( state ) !== before ) { allHeld = false; moved.push( reason ); }

    }

    check( '🎯 REFUSAL  ALL 11 refusal reasons leave the state BIT-IDENTICAL — target, emotion, mood, clock',
        allHeld,
        moved.length === 0
            ? `${ Object.values( REFUSAL ).length } reasons, none touched the state`
            : `moved on: ${ moved.join( ', ' ) }` );

    // 🚩 RED PROOF. The exact thing the research doc's guard forbids — a refusal reaching the face
    // as a neutral vector, erasing tier 1's belief with a call that failed.
    const state = new AffectState();
    state.push( TIER1 );
    for ( let frame = 0; frame < 30; frame ++ ) state.update( 1 / 60 );
    const before = snapshot( state );

    await new AppraisalAffect( {
        client: immediateClient( { ok: false, reason: REFUSAL.DEGENERATE_ZERO, detail: 'stub', latencyMs: 700 } ),
        state, warmOnConstruction: false, defects: { blendOnRefusal: true } } ).appraise( 'anything' );

    check( '🎯 REFUSAL  RED PROOF — defects.blendOnRefusal moves the state, so the clause can fail',
        snapshot( state ) !== before,
        `target pleasure ${ JSON.parse( before ).target.pleasure } -> ${ state.target.pleasure }` );

    // A refusal is still counted, so a session can say WHY tier 2 was quiet rather than that it was.
    const counting = new AppraisalAffect( {
        client: immediateClient( { ok: false, reason: REFUSAL.HTTP, detail: 'HTTP 400', latencyMs: 3 } ),
        state: new AffectState(), warmOnConstruction: false } );
    await counting.appraise( 'a' );
    await counting.appraise( 'b' );
    check( 'REFUSAL  refusals are counted by reason and nothing was applied',
        counting.report().refusals[ REFUSAL.HTTP ] === 2 && counting.report().applied === 0
            && counting.report().appraisals === 2,
        JSON.stringify( counting.report().refusals ) );

} );

// --- BLEND ---------------------------------------------------------------------------------------

await section( 'BLEND', async () => {

    const TIER1 = { pleasure: -0.6, arousal: 0.4, dominance: 0.2 };
    const TIER1_CONFIDENCE = { pleasure: 1, arousal: 1, dominance: 0 };

    function settledState() {

        const state = new AffectState();
        state.push( { ...TIER1, confidence: 1 } );
        // A full second at 60 Hz: the fast layer is at 99.3% of tier 1's target before tier 2 lands.
        for ( let frame = 0; frame < 60; frame ++ ) state.update( 1 / 60 );
        return state;

    }

    const state = settledState();
    const padBefore = state.pad;
    const targetBefore = { ...state.target };

    const appraisal = new AppraisalAffect( {
        client: immediateClient( ok( ANGRY ) ), state, warmOnConstruction: false } );

    const result = await appraisal.appraise( 'That is the third time you have ignored me.',
        { tier1: { confidence: TIER1_CONFIDENCE } } );

    // 🎯 THE POOLED MIDPOINT, EXACTLY. With tier 1 confident on pleasure the weight is 1/2, so the
    // target lands halfway — not on tier 2's vector, which is the pop, and not left alone, which is
    // tier 2 doing nothing.
    const midpoint = ( targetBefore.pleasure + ANGRY.pleasure ) / 2;
    check( '🎯 BLEND  the target lands on the exact pooled midpoint on a confidently-primed axis',
        result.applied === true && Math.abs( state.target.pleasure - midpoint ) < 1e-12,
        `${ targetBefore.pleasure.toFixed( 4 ) } and ${ ANGRY.pleasure } -> ${ state.target.pleasure.toFixed( 4 ) }` );

    check( '🎯 BLEND  the target moved TOWARD the tier-2 vector without reaching it',
        Math.abs( state.target.pleasure - ANGRY.pleasure ) < Math.abs( targetBefore.pleasure - ANGRY.pleasure )
            && state.target.pleasure !== ANGRY.pleasure );

    // 🚩 THE FACE DOES NOT MOVE ON THE FRAME THE RESULT ARRIVES. `push` writes the target and
    // nothing else; the 0.200 s attack is what carries the correction. This is the "settling rather
    // than a pop" sentence, measured as zero displacement at dt = 0.
    check( '🎯 BLEND  pad is UNCHANGED on the instant the result lands — nothing snaps',
        distance( state.pad, padBefore ) === 0,
        `|Δpad| = ${ distance( state.pad, padBefore ) }` );

    const distanceBefore = distance( padBefore, ANGRY );
    for ( let frame = 0; frame < 60; frame ++ ) state.update( 1 / 60 );
    const distanceAfter = distance( state.pad, ANGRY );

    check( '🎯 BLEND  one second later the face has SETTLED toward the tier-2 vector',
        distanceAfter < distanceBefore,
        `|pad - tier2| ${ distanceBefore.toFixed( 4 ) } -> ${ distanceAfter.toFixed( 4 ) }` );

    // 🎯 THE DOMINANCE ROW. Tier 1 reported confidence 0 — no stance marker, no evidence either way
    // — so the pooling hands the axis over outright, which is exactly what SeedLexicon.js says must
    // happen "the moment punch-list 5.3's tier 2 lands".
    const handover = settledState();
    await new AppraisalAffect( { client: immediateClient( ok( ANGRY ) ), state: handover,
        warmOnConstruction: false } ).appraise( 'x', { tier1: { confidence: TIER1_CONFIDENCE } } );

    check( '🎯 BLEND  dominance is REPLACED OUTRIGHT when tier 1 had no stance marker',
        handover.target.dominance === ANGRY.dominance,
        `tier 1 held ${ TIER1.dominance }, tier 2 wrote ${ handover.target.dominance }` );

    // ⚠️ And that outright replacement cannot snap a face, structurally rather than by luck.
    check( '⚠️ BLEND  the axis tier 2 may replace outright is the one a face CANNOT see',
        Object.keys( handover.faceInput() ).includes( 'dominance' ) === false,
        `faceInput keys: ${ Object.keys( handover.faceInput() ).join( ', ' ) }` );

    // 🚩 RED PROOF. Confidence 1 on every axis: the target snaps to tier 2 and the midpoint clause
    // goes red. This is the pop research/lm-studio-integration.md forbids.
    const snapped = settledState();
    const snapTargetBefore = { ...snapped.target };
    await new AppraisalAffect( { client: immediateClient( ok( ANGRY ) ), state: snapped,
        warmOnConstruction: false, defects: { snapOnBlend: true } } )
        .appraise( 'x', { tier1: { confidence: TIER1_CONFIDENCE } } );

    const snapMidpoint = ( snapTargetBefore.pleasure + ANGRY.pleasure ) / 2;
    check( '🎯 BLEND  RED PROOF — defects.snapOnBlend puts the target ON the vector, so the clause can fail',
        snapped.target.pleasure === ANGRY.pleasure && Math.abs( snapped.target.pleasure - snapMidpoint ) > 1e-12,
        `snapped to ${ snapped.target.pleasure } instead of the midpoint ${ snapMidpoint.toFixed( 4 ) }` );

} );

// --- VECTOR --------------------------------------------------------------------------------------

await section( 'VECTOR', async () => {

    // 🎯 THE MEASURED DISAGREEMENT, REPLAYED. LMStudioClient's header, eight-utterance probe: the
    // happy utterance returned P +0.80 A +0.70 D +0.60 — WASABI's own happy anchor — with
    // `primary: "surprised"`. The vector is the one to trust.
    const surprisedAnchor = ANCHOR_SETS.surprised.points[ 0 ];
    const point = [ HAPPY.pleasure, HAPPY.arousal, HAPPY.dominance ];

    // ⚠️ MEASURED RATHER THAN ASSERTED FROM THE HEADER'S WORDING. `LMStudioClient`'s header says the
    // happy row's "PAD sits on WASABI's happy anchor"; measured under ExpressionMap's own metric it
    // sits 0.2236 from happy and 0.7348 from surprised, so it is inside the activation threshold for
    // one and outside it for the other. That is the disagreement, stated in the units the face
    // actually uses — and the first draft of this clause asserted bit-equality with the anchor and
    // went red, because 0.60 dominance is not 1.00.
    const toHappy = nearestDistance( point, WASABI_ANCHORS.happy.points, DOMINANCE_METRIC_WEIGHT );
    const toSurprised = nearestDistance( point, ANCHOR_SETS.surprised.points, DOMINANCE_METRIC_WEIGHT );

    check( '🎯 VECTOR  the fixture really IS the disagreement — the vector activates happy, not the label',
        toHappy < ACTIVATION_THRESHOLD && toSurprised > ACTIVATION_THRESHOLD
            && HAPPY.primary === 'surprised',
        `vector (${ HAPPY.pleasure }, ${ HAPPY.arousal }, ${ HAPPY.dominance }) is `
            + `${ toHappy.toFixed( 4 ) } from happy and ${ toSurprised.toFixed( 4 ) } from `
            + `surprised (${ surprisedAnchor.join( ', ' ) }), threshold ${ ACTIVATION_THRESHOLD }` );

    const fromVector = new AffectState();
    await new AppraisalAffect( { client: immediateClient( ok( HAPPY ) ), state: fromVector,
        warmOnConstruction: false } ).appraise( 'Look at it go!' );

    check( '🎯 VECTOR  the blend follows the VECTOR, at the undeclared-prior weight of 1/2',
        Math.abs( fromVector.target.pleasure - HAPPY.pleasure * 0.5 ) < 1e-12,
        `target pleasure ${ fromVector.target.pleasure }` );

    // 🚩 RED PROOF. Driving from the label writes the surprised anchor instead — a different corner
    // of the cube, and on this utterance a nearly neutral pleasure where the model reported +0.80.
    const fromLabel = new AffectState();
    await new AppraisalAffect( { client: immediateClient( ok( HAPPY ) ), state: fromLabel,
        warmOnConstruction: false, defects: { trustLabel: true } } ).appraise( 'Look at it go!' );

    check( '🎯 VECTOR  RED PROOF — defects.trustLabel lands in a different corner, so the clause can fail',
        Math.abs( fromLabel.target.pleasure - HAPPY.pleasure * 0.5 ) > 1e-12
            && Math.abs( fromLabel.target.pleasure - surprisedAnchor[ 0 ] * 0.5 ) < 1e-12,
        `label path wrote pleasure ${ fromLabel.target.pleasure }, vector path wrote `
            + `${ fromVector.target.pleasure }` );

    // `primary` is still reported, because it is a log line and an optional trigger — "a weak
    // secondary signal at most" — and dropping it entirely would lose the disagreement itself.
    const reporting = new AppraisalAffect( { client: immediateClient( ok( HAPPY ) ),
        state: new AffectState(), warmOnConstruction: false } );
    await reporting.appraise( 'Look at it go!' );
    check( 'VECTOR  primary survives into report() as a log line rather than a signal',
        reporting.report().lastValue.primary === 'surprised' );

    // 🚩 THE SEAM BETWEEN THE TWO FILES, AND THE HAZARD IS ASSERTED BEFORE THE GUARD IS. The client
    // accepts `neutral` on purpose; ExpressionMap has no such anchor row and throws. Without the
    // first clause the second is decorative — a guard against a hazard nobody demonstrated.
    let neutralThrows = false;
    const map = new ExpressionMap();
    try { map.trigger( NEUTRAL_PRIMARY, 0.5 ); } catch { neutralThrows = true; }

    check( '🎯 VECTOR  the hazard is real — ExpressionMap.trigger( \'neutral\' ) THROWS',
        neutralThrows && ANCHOR_SETS[ NEUTRAL_PRIMARY ] === undefined,
        'the client accepts neutral deliberately; the map has no anchor row for it' );

    const FLAT = { pleasure: 0.05, arousal: -0.02, dominance: 0.01, primary: NEUTRAL_PRIMARY, intensity: 0.1 };
    const flatState = new AffectState();
    const opted = new AppraisalAffect( { client: immediateClient( ok( FLAT ) ), state: flatState,
        map, triggerPrimary: true, warmOnConstruction: false } );

    const flat = await opted.appraise( 'It is on the table.' );

    check( '🎯 VECTOR  a flat utterance with primary "neutral" applies instead of throwing',
        flat.applied === true && map.triggers.size === 0
            && Math.abs( flatState.target.pleasure - FLAT.pleasure * 0.5 ) < 1e-12,
        `triggers ${ map.triggers.size }, target pleasure ${ flatState.target.pleasure }` );

    // The other direction: a real label still reaches trigger(), at the model's own intensity.
    const angryMap = new ExpressionMap();
    await new AppraisalAffect( { client: immediateClient( ok( ANGRY ) ), state: new AffectState(),
        map: angryMap, triggerPrimary: true, warmOnConstruction: false } ).appraise( 'Enough.' );

    check( 'VECTOR  an opted-in real label still triggers, at the model\'s own intensity',
        angryMap.triggers.get( 'angry' ) === ANGRY.intensity,
        `triggers: ${ [ ...angryMap.triggers ].map( ( [ k, v ] ) => `${ k }=${ v }` ).join( ', ' ) }` );

} );

// --- CLOCK ---------------------------------------------------------------------------------------

await section( 'CLOCK', async () => {

    // The contract's trap (c): exactly one owner of the affect clock, and it is not this file.
    const state = new AffectState();
    for ( let frame = 0; frame < 30; frame ++ ) state.update( 1 / 60 );
    const timeBefore = state.time;
    const emotionBefore = { ...state.emotion };

    await new AppraisalAffect( { client: immediateClient( ok( ANGRY ) ), state,
        warmOnConstruction: false } ).appraise( 'anything' );

    check( '🎯 CLOCK  an appraisal advances NOTHING — time and the fast layer are untouched',
        state.time === timeBefore
            && PAD_AXES.every( ( axis ) => state.emotion[ axis ] === emotionBefore[ axis ] ),
        `time ${ timeBefore } -> ${ state.time }` );

    // 🚩 RED PROOF. "Catch the state up to the time the call took" reads as reasonable and is a
    // second clock over one state — affect runs at double rate for the length of every appraisal.
    const doubled = new AffectState();
    for ( let frame = 0; frame < 30; frame ++ ) doubled.update( 1 / 60 );
    const doubledBefore = doubled.time;

    await new AppraisalAffect( { client: immediateClient( ok( ANGRY ) ), state: doubled,
        warmOnConstruction: false, defects: { advanceClock: true } } ).appraise( 'anything' );

    check( '🎯 CLOCK  RED PROOF — defects.advanceClock moves the clock 0.674 s, so the clause can fail',
        doubled.time > doubledBefore,
        `time ${ doubledBefore.toFixed( 4 ) } -> ${ doubled.time.toFixed( 4 ) } with no update() call` );

} );

// --- FENCE ---------------------------------------------------------------------------------------

await section( 'FENCE', async () => {

    // 🚩 A FRAME LOOP, SIMULATED. One utterance, 60 frames, the first call still on the wire.
    const client = deferredClient();
    const state = new AffectState();
    const appraisal = new AppraisalAffect( { client, state } );

    const first = appraisal.appraise( 'I am fine.' );

    let refused = 0;
    let leaked = 0;

    for ( let frame = 2; frame <= 60; frame ++ ) {

        try {

            await appraisal.appraise( 'I am fine.' );
            leaked += 1;

        } catch ( error ) {

            if ( /frame/.test( error.message ) ) refused += 1;

        }

    }

    check( '🎯 FENCE  a 60-frame loop on one utterance is refused on frame 2 and every frame after',
        refused === 59 && leaked === 0 && client.pending.length === 1,
        `${ refused } refused, ${ leaked } reached the client, ${ client.pending.length } call(s) on the wire` );

    client.settle( 0, ok( ANGRY ) );
    const firstResult = await first;
    // ⚠️ At the undeclared-prior weight of 1/2, not at 1 — this caller passed no tier-1 estimate.
    check( 'FENCE  the ONE call that got through still applies normally',
        firstResult.applied === true
            && Math.abs( state.target.dominance - ANGRY.dominance * 0.5 ) < 1e-12,
        `target dominance ${ state.target.dominance }` );

    // ⚠️ THE OTHER DIRECTION. A fence that refused everything would pass the clause above on its
    // own. A genuinely new utterance supersedes the pending one and reaches the client.
    const two = deferredClient();
    const twoState = new AffectState();
    const conversation = new AppraisalAffect( { client: two, state: twoState } );

    const older = conversation.appraise( 'I am fine.' );
    const newer = conversation.appraise( 'No, I am not.' );

    check( 'FENCE  a DIFFERENT utterance supersedes rather than throwing — both reached the client',
        two.pending.length === 2 );

    // 🎯 AND THE STALE REPLY SETTLES FIRST, WHICH IS THE ORDERING BUG. It must not write: its
    // belief is older than the state's.
    two.settle( 0, ok( HAPPY ) );
    const olderResult = await older;

    check( '🎯 FENCE  the superseded reply settles LATER and never writes to the state',
        olderResult.applied === false && olderResult.outcome === SUPERSEDED
            && twoState.target.pleasure === 0,
        `target pleasure after the stale reply: ${ twoState.target.pleasure }` );

    two.settle( 1, ok( ANGRY ) );
    const newerResult = await newer;

    check( 'FENCE  the newest appraisal is the one that lands',
        newerResult.applied === true
            && Math.abs( twoState.target.dominance - ANGRY.dominance * 0.5 ) < 1e-12,
        `superseded=${ conversation.report().superseded } applied=${ conversation.report().applied } `
            + `target dominance ${ twoState.target.dominance }` );

    check( 'FENCE  the fence reopens once the wire is clear',
        conversation.report().inFlight === false );

    // 🚩 RED PROOF FOR THE FENCE. Without the guard the same 60-frame loop puts 60 calls on the
    // wire — 60 requests per second at ~0.7 s each against a 37.75 GB model — and every other
    // clause in this file stays green, because nothing else counts requests.
    const flooded = deferredClient();
    const unfenced = new AppraisalAffect( {
        client: flooded, state: new AffectState(), defects: { noFence: true } } );

    unfenced.appraise( 'I am fine.' );
    for ( let frame = 2; frame <= 60; frame ++ ) unfenced.appraise( 'I am fine.' );

    check( '🎯 FENCE  RED PROOF — defects.noFence lets all 60 frames reach the wire',
        flooded.pending.length === 60,
        `${ flooded.pending.length } calls on the wire for one utterance` );

    // 🚩 RED PROOF FOR SUPERSESSION. The stale reply settles first and, without the generation
    // check, writes its older belief over the newer one — an ordering bug that only appears when
    // two appraisals overlap, which is exactly what a fast second utterance does.
    const staleClient = deferredClient();
    const staleState = new AffectState();
    const overwriting = new AppraisalAffect( {
        client: staleClient, state: staleState, defects: { writeStale: true } } );

    overwriting.appraise( 'I am fine.' );
    overwriting.appraise( 'No, I am not.' );
    staleClient.settle( 0, ok( HAPPY ) );
    await Promise.resolve();

    check( '🎯 FENCE  RED PROOF — defects.writeStale lets the overtaken reply write, so the clause can fail',
        staleState.target.pleasure !== 0,
        `the stale HAPPY reply wrote pleasure ${ staleState.target.pleasure }` );

} );

// --- INVARIANCE ----------------------------------------------------------------------------------

/**
 * The whole two-tier trajectory at one frame rate: tier 1 at t = 0, tier 2 landing at t = 0.6 s —
 * a whole number of frames at 30, 60 and 120 Hz alike, so the blend lands at the same WALL INSTANT
 * in all three runs and any disagreement is the integrator rather than the schedule.
 */
async function trajectory( hz, affectDefects = {} ) {

    const state = new AffectState( { defects: affectDefects } );
    const appraisal = new AppraisalAffect( {
        client: immediateClient( ok( ANGRY ) ), state, warmOnConstruction: false } );

    state.push( { pleasure: 0.5, arousal: 0.3, dominance: 0.1,
        confidence: { pleasure: 1, arousal: 1, dominance: 0 } } );

    const dt = 1 / hz;
    const samples = new Map();
    let blended = false;

    for ( let frame = 1; frame <= Math.round( 3 * hz ); frame ++ ) {

        state.update( dt );
        const time = frame * dt;

        if ( blended === false && time >= 0.6 - 1e-9 ) {

            await appraisal.appraise( 'That is the third time.',
                { tier1: { confidence: { pleasure: 1, arousal: 1, dominance: 0 } } } );
            blended = true;

        }

        // Sample on the 30 Hz grid, which every rate here shares.
        const ticks = time * 30;
        if ( Math.abs( ticks - Math.round( ticks ) ) < 1e-9 ) samples.set( Math.round( ticks ), state.pad );

    }

    return samples;

}

function worstDisagreement( a, b ) {

    let worst = 0;

    for ( const [ tick, padA ] of a ) {

        const padB = b.get( tick );
        if ( padB === undefined ) continue;

        for ( const axis of PAD_AXES ) worst = Math.max( worst, Math.abs( padA[ axis ] - padB[ axis ] ) );

    }

    return worst;

}

await section( 'INVARIANCE', async () => {

    const at30 = await trajectory( 30 );
    const at60 = await trajectory( 60 );
    const at120 = await trajectory( 120 );

    const worst = Math.max( worstDisagreement( at30, at60 ), worstDisagreement( at30, at120 ),
        worstDisagreement( at60, at120 ) );

    check( '🎯 INVARIANCE  the tier-1-then-tier-2 trajectory agrees at 30, 60 and 120 Hz',
        worst < 1e-12 && at30.size === 90,
        `worst disagreement ${ worst.toExponential( 3 ) } over ${ at30.size } shared samples` );

    // 🚩 RED PROOF, AND IT IS BORROWED ON PURPOSE. This layer has no integrator of its own — that is
    // WHY the trajectory is invariant — so the only way to prove the comparison can SEE a
    // rate-dependent trajectory is to reintroduce one underneath it. AffectState ships `frameLerp`
    // for exactly this: a fixed per-frame alpha, right steady state, trajectory owned by the frame
    // rate. LEARNINGS §1.13.
    const bad30 = await trajectory( 30, { frameLerp: true } );
    const bad120 = await trajectory( 120, { frameLerp: true } );
    const badWorst = worstDisagreement( bad30, bad120 );

    check( '🎯 INVARIANCE  RED PROOF — AffectState.defects.frameLerp makes the same comparison red',
        badWorst > 1e-3,
        `worst disagreement ${ badWorst.toExponential( 3 ) } with a per-frame alpha underneath` );

    // ⚠️ AND THE WEAKER GATE, MEASURED. A comparison of the FINAL value alone sees almost nothing,
    // because a fixed per-frame alpha has the right steady state — which is how this class of defect
    // survived four rounds in `motion/`.
    const finalTick = Math.max( ...bad30.keys() );
    const finalGap = Math.max( ...PAD_AXES.map(
        ( axis ) => Math.abs( bad30.get( finalTick )[ axis ] - bad120.get( finalTick )[ axis ] ) ) );

    check( '⚠️ INVARIANCE  a settled-value-only gate would have called the defective run FINE',
        finalGap < badWorst / 100,
        `settled gap ${ finalGap.toExponential( 3 ) } against a trajectory gap of ${ badWorst.toExponential( 3 ) }` );

} );

// --- END-TO-END ----------------------------------------------------------------------------------

await section( 'END-TO-END', async () => {

    // The REAL transport over a stub socket, with the REAL anchor set, into a REAL state. Two halves
    // that each pass their own gate can still disagree at the seam: the client returns `value` and
    // this layer reads `value`, and nothing above this line would notice if one of them renamed it.
    const sent = [];

    const fetchImpl = async ( url, init ) => {

        sent.push( { url, body: JSON.parse( init.body ) } );

        return {
            ok: true, status: 200,
            json: async () => ( { choices: [ { message: {
                role: 'assistant', content: '', reasoning_content: JSON.stringify( ANGRY )
            } } ] } )
        };

    };

    const client = new LMStudioClient( {
        primaries: Object.keys( WASABI_ANCHORS ), fetchImpl } );

    const state = new AffectState();
    const reflex = new ReflexAffect();
    const text = 'That is the third time you have ignored me. I am done asking nicely.';

    const tier1 = reflex.estimate( { text } );
    state.push( tier1 );

    const appraisal = new AppraisalAffect( { client, state } );
    const result = await appraisal.appraise( text, { tier1 } );

    check( '🎯 END-TO-END  the real client\'s result blends through the real state',
        result.applied === true && result.value.primary === 'angry'
            && result.channel === 'reasoning_content',
        `P=${ state.target.pleasure.toFixed( 4 ) } A=${ state.target.arousal.toFixed( 4 ) } `
            + `D=${ state.target.dominance.toFixed( 4 ) } via ${ result.channel }` );

    check( 'END-TO-END  two socket calls went out: the warm-up and the appraisal, in that order',
        sent.length === 2 && sent[ 0 ].body.messages[ 1 ].content === 'Hello.'
            && sent[ 1 ].body.messages[ 1 ].content === text,
        `${ sent.length } calls` );

    check( 'END-TO-END  the appraisal carried the full json_schema form (finding 3)',
        sent[ 1 ].body.response_format.type === 'json_schema' );

    check( 'END-TO-END  neutral is admissible as a primary and is not a WASABI anchor',
        client.primaries.has( NEUTRAL_PRIMARY ) && WASABI_ANCHORS[ NEUTRAL_PRIMARY ] === undefined );

    check( 'END-TO-END  report() carries the client\'s own refusal ledger for a HUD to print',
        appraisal.report().client !== null && appraisal.report().client.calls === 1,
        JSON.stringify( appraisal.report().client.refusals ) );

} );

// --- results -------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( `\ntier 2 blending, offline. evidence weight ${ APPRAISAL_EVIDENCE }, `
    + `${ Object.keys( REFUSAL ).length } refusal reasons, ${ Object.keys( WASABI_ANCHORS ).length } anchors\n\n` );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
