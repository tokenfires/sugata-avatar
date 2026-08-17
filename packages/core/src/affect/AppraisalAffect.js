/**
 * AppraisalAffect — tier 2, the BLENDING half. Punch-list 5.3.
 *
 * `LMStudioClient.js` is the transport: it returns a validated PAD vector or a reason it refused,
 * and it holds no state. This file is the other half — the one that decides what a tier-2 result
 * is allowed to do to `AffectState`, and, far more often, what it is NOT allowed to do.
 *
 * research/lm-studio-integration.md, finding 4's architectural consequence, is the whole brief:
 *
 *   > Tier 2 — appraisal (~1 s, async). The LLM pass. Returns a richer affect vector that is
 *   > *blended into* the running state rather than snapped to, so the correction reads as a natural
 *   > settling rather than a pop. ... **Tier 1 must stand alone and look right on its own, because
 *   > Tier 2 is allowed to fail.**
 *
 * Both halves of that sentence are mechanisms here, not intentions.
 *
 *
 * 🎯 THE BLEND IS `AffectState.push()`'s CONFIDENCE, AND THE WEIGHT IS ARITHMETIC, NOT A TASTE CALL
 * ------------------------------------------------------------------------------------------------
 * `AffectState.push()` already carries the mechanism the research sentence describes, and says so in
 * its own JSDoc: "A confidence of 1 replaces the axis outright; 0 leaves it alone." So tier 2 does
 * not need — and must not have — a smoother of its own. Two smoothers in series over one signal is
 * the defect `ReflexAffect`'s header refuses for the same reason: nobody owns the time constant.
 *
 * What tier 2 does need is a WEIGHT, and a weight typed into this file would be a number with no
 * gate on it. So it is derived, from quantities the two tiers already publish about themselves:
 *
 *     weight[axis] = APPRAISAL_EVIDENCE / ( APPRAISAL_EVIDENCE + tier1Confidence[axis] )
 *
 * That is plain evidence pooling — two estimators, each with a stated confidence, and the pooled
 * belief is their confidence-weighted mean, which is exactly what `push()` computes. There is one
 * assumption in it and it is `APPRAISAL_EVIDENCE = 1`: tier 2 states ALL THREE AXES ON EVERY TURN,
 * which is punch-list 5.3's own sentence, so it is a full observation on every axis and the unit is
 * the only weight that is not a fudge factor. Everything else falls out as arithmetic:
 *
 *   | axis      | tier 1's own confidence                       | tier 2's weight |
 *   |-----------|-----------------------------------------------|-----------------|
 *   | pleasure  | 1 when any lexicon word matched               | 0.5             |
 *   | arousal   | the voiced fraction of the prosody window     | 1/(1+v)         |
 *   | dominance | 0 with no marker, else DOMINANCE_CONFIDENCE   | 1.0, else 0.8   |
 *   | any       | not stated by the caller                      | 0.5             |
 *
 * 🎯 **THE DOMINANCE ROW IS THE POINT OF THE WHOLE PUNCH-LIST ITEM, AND IT IS NOT AN ACCIDENT OF
 * THE FORMULA.** `SeedLexicon.js`'s own header says the marker table exists only "to keep anger and
 * fear from collapsing onto the same posture while tier 2 does not exist" and is "REPLACED OUTRIGHT
 * the moment punch-list 5.3's tier 2 lands". Tier 1 reports confidence 0 on an utterance with no
 * stance marker — no evidence either way, which is why 5.2 left dominance STICKY between utterances
 * — and 1/(1+0) is 1. Tier 2 takes the axis. That is the intended behaviour arriving out of the
 * pooling rather than out of a special case.
 *
 * ⚠️ And a weight of 1 on dominance is NOT a pop, for a reason that is structural rather than
 * lucky: `AffectState.faceInput()` has two keys and `ExpressionMap.face()` throws on a third, so no
 * amount of dominance can reach a face. It reaches posture, through the same 0.200 s attack
 * constant as everything else. The axis that tier 2 is allowed to replace outright is precisely the
 * axis that cannot snap anything.
 *
 * ⚠️ When the caller states no tier-1 confidence, the prior is taken as `APPRAISAL_EVIDENCE` too —
 * "assume the estimator that spoke before us was as confident as we are" — and the pooled weight is
 * exactly 1/2. Not a chosen 0.5: 1/(1+1). A caller that has a real tier-1 estimate should pass it,
 * and `ReflexAffect.estimate()` returns one in the shape this takes.
 *
 *
 * 🚩 EVERY REFUSAL KEEPS TIER 1'S VALUE, AND "KEEPS" MEANS BIT-IDENTICAL
 * ----------------------------------------------------------------------
 * The research doc's degenerate-output guard ends "on any rejection, keep Tier 1's value and log —
 * never let a bad Tier 2 result snap the face", and `LMStudioClient` returns a REASON rather than
 * throwing so that this file can obey it on the normal path. The rule here is simple enough to be
 * checkable: **`state` is touched on exactly one code path**, the one where `client.appraise()`
 * returned `ok: true` and the call was not superseded. A refusal returns a report and writes
 * nothing — not a zero, not a neutral, not a decayed anything. `defects.blendOnRefusal` is the
 * reintroduction of the defect so the gate can prove that clause red.
 *
 *
 * 🚩 THE VECTOR IS THE SIGNAL. `primary` IS A LOG LINE.
 * ----------------------------------------------------
 * `LMStudioClient`'s header records this as a MEASUREMENT, not a worry: on its eight-utterance
 * probe the plainly happy utterance returned `P +0.80 A +0.70 D +0.60` — WASABI's own happy anchor
 * — with `primary: "surprised"`. The label and the vector disagreed, and the vector was right.
 *
 * So `push()` is fed the VECTOR and only the vector. `primary` is recorded in `report()` and, if a
 * caller opts in with `triggerPrimary` and hands over an `ExpressionMap`, it is offered to
 * `map.trigger()` — which is geometrically gated and will produce nothing when the label disagrees
 * with the PAD point, per `ExpressionMap.trigger`'s own header. That gate is what makes the option
 * safe; the default is off because a caller who switches on `primary` has re-introduced a discrete
 * emotion model underneath a dimensional one. `defects.trustLabel` drives from the label instead.
 *
 * 🚩 AND THE TWO FILES DISAGREE ABOUT ONE LABEL, WHICH IS WHY THAT PATH HAS A CONDITION ON IT.
 * `LMStudioClient` accepts `neutral` deliberately — "it is the absence of one" — and
 * `ExpressionMap.trigger()` validates against `ANCHOR_SETS`, which has no such row, and THROWS:
 * measured, `ExpressionMap: 'neutral' is not an emotion`. A flat utterance is the commonest thing a
 * person says, so an unguarded `trigger( primary )` takes down the appraisal of every host that
 * opted in. The absence of an emotion is nothing to trigger, so it is skipped at the call site.
 *
 *
 * 🎯 THE COLD LOAD IS PAID AT CONSTRUCTION, AND DELIBERATELY NOT AWAITED
 * ----------------------------------------------------------------------
 * `LMStudioClient`'s header measured **22.285 s** for the first schema-constrained call against an
 * idle LM Studio, against 0.670 s for the next. A tier 2 that does not warm pays that on the user's
 * first utterance. So `warm()` is called from the constructor, ONCE, and the promise is kept so a
 * second call cannot start a second load.
 *
 * ⚠️ It is fire-and-forget on purpose and `appraise()` never awaits it. If an utterance arrives
 * while the weights are still loading, the appraisal times out at the client's per-utterance
 * `TIMEOUT_MS` and the face keeps tier 1 — which is what that timeout is sized for, in that file's
 * own words: "a cold model must time out into tier 1 rather than freeze a conversation for
 * twenty-two seconds". Awaiting the warm here would convert that 4 s timeout back into a 22 s
 * freeze, which is the exact failure `warm()` exists to prevent.
 *
 *
 * 🚩 NOT REACHABLE FROM A FRAME PATH, STRUCTURALLY
 * -----------------------------------------------
 * Finding 4 again: ~0.7 s per call. Three mechanisms, in increasing order of loudness:
 *
 *   1. **This class takes no delta anywhere and is not a `Layer`.** There is no `update()`, so a
 *      `MotionStack` cannot hold it and a render loop has nothing to call.
 *   2. **It never advances the affect clock.** The contract's trap (c) — one clock owner —
 *      belongs to `ExpressionLayer({ advanceState: true })`, and an appraisal that "caught the state
 *      up" by the latency it just measured would double-advance affect at every utterance.
 *      `defects.advanceClock` is that mistake, made reachable.
 *   3. 🎯 **`appraise()` THROWS when the SAME utterance is already in flight.** A frame loop calls
 *      with one utterance's text over and over; the second frame reaches this line about 16 ms in,
 *      while the first call has ~680 ms left to run, and gets an exception naming the fix. A genuine
 *      new utterance carries different text, supersedes the pending one, and never sees the fence.
 *      That is the difference between a comment and a mechanism: the wrong caller cannot get to the
 *      third frame.
 *
 * Supersession is the other half of (3) and closes an ordering bug worth closing on its own: two
 * appraisals in flight can settle out of order, and a stale reply that pushed after a newer one had
 * already landed would silently overwrite the newer belief. Only the newest generation may write.
 */

import { PAD_AXES } from './AffectState.js';
import { ANCHOR_SETS } from './ExpressionMap.js';
import { NEUTRAL_PRIMARY } from './LMStudioClient.js';

/**
 * The evidence weight a tier-2 appraisal claims for itself, on every axis, on every turn.
 *
 * 🚩 THE ONLY ASSUMPTION IN THE BLEND, AND IT IS A UNIT RATHER THAN A MEASUREMENT. Punch-list 5.3:
 * "Tier 2 returns all three axes every turn." A full observation on every axis is one observation;
 * any other number would be a confidence in the model that nobody in this repository has measured,
 * and `LMStudioClient`'s header is explicit that its own calibration observation — the model is
 * conservative in arousal magnitude — is "recorded rather than corrected, because a gain applied
 * here would be a number nobody measured against the face". The same restraint applies here.
 *
 * What would settle it: rendered plates of the same utterance blended at several weights, judged
 * against the tier-1-only plate. Until that exists this is the unit and the pooling does the rest.
 */
export const APPRAISAL_EVIDENCE = 1;

/**
 * The per-axis blend weight for one tier-2 result, given whatever tier 1 said about its own
 * confidence.
 *
 * Pure, exported and taking plain numbers, because the arithmetic is the part worth gating and a
 * gate should not have to build a client and a state to reach it.
 *
 * @param {number|Object|null} [tier1Confidence] - `ReflexAffect.estimate().confidence`, or a scalar,
 *   or null/undefined when the caller has no tier-1 estimate to declare. An axis the object does not
 *   mention is treated as undeclared, not as zero — see the header: undeclared pools to 1/2, zero
 *   pools to 1, and those are different statements.
 * @returns {{pleasure: number, arousal: number, dominance: number}} each in [0.5, 1].
 */
export function appraisalWeights( tier1Confidence ) {

    const weights = {};

    for ( const axis of PAD_AXES ) {

        const prior = priorConfidenceOn( tier1Confidence, axis );
        weights[ axis ] = APPRAISAL_EVIDENCE / ( APPRAISAL_EVIDENCE + prior );

    }

    return weights;

}

/**
 * What tier 1 claimed on one axis, in [0, 1].
 *
 * An unstated confidence is NOT zero. Zero is a claim — "I have no evidence on this axis", which is
 * exactly what `ReflexAffect` reports for dominance with no marker — and it hands the axis to tier 2
 * outright. Silence is the absence of a claim and pools at parity instead.
 */
function priorConfidenceOn( tier1Confidence, axis ) {

    if ( tier1Confidence === null || tier1Confidence === undefined ) return APPRAISAL_EVIDENCE;

    const stated = typeof tier1Confidence === 'number'
        ? tier1Confidence
        : tier1Confidence[ axis ];

    if ( typeof stated !== 'number' || Number.isNaN( stated ) ) return APPRAISAL_EVIDENCE;

    return Math.min( Math.max( stated, 0 ), 1 );

}

/**
 * 🚩 Ways this layer could be wrong, each reachable so `AppraisalAffect.selftest.mjs` can prove its
 * clauses red. LEARNINGS §1.25a: write the known-bad you had in mind, then one you did not.
 *
 * The class being defended is *a tier-2 result reaching the face when it should not, or reaching it
 * the wrong way*, and these are seven structurally different members of it — a write on the refusal
 * path, a write at full weight, a write of the wrong quantity, a write from a stale generation, a
 * second clock, a second cold load, and no fence at all. `warmPerCall` is the one that was not on
 * the original list: it breaks nothing visible and costs 22 s of GPU on every utterance.
 */
export const DEFECTS = Object.freeze( {
    blendOnRefusal: 'a refused appraisal pushes a neutral vector instead of keeping tier 1',
    snapOnBlend: 'the blend pushes at confidence 1 on every axis — the pop research §4 forbids',
    trustLabel: 'PAD is driven from the primary LABEL\'s anchor instead of the returned VECTOR',
    advanceClock: 'the appraisal advances AffectState by the latency it measured — a second clock',
    warmPerCall: 'warm() is called again on every appraisal instead of once at construction',
    noFence: 'the same-utterance guard is gone, so a frame loop reaches the wire 60 times a second',
    writeStale: 'a superseded reply still writes, so a late answer overwrites a newer belief'
} );

const DEFECTS_OFF = Object.freeze( Object.fromEntries( Object.keys( DEFECTS ).map( ( key ) => [ key, false ] ) ) );

/** The outcome of an appraisal that a newer one overtook. Not a refusal — nothing went wrong. */
export const SUPERSEDED = 'superseded';

export class AppraisalAffect {

    /**
     * @param {Object} options
     * @param {Object} options.client - An `LMStudioClient`, or anything with the same two methods:
     *   `warm()` and `appraise( utterance, { history } )`. Injected rather than constructed here for
     *   the same reason the client takes `fetchImpl`: the gate runs offline, with no model.
     * @param {import('./AffectState.js').AffectState} options.state - The state tier 1 also pushes
     *   into. Shared on purpose — the two tiers are two estimators of one quantity.
     * @param {import('./ExpressionMap.js').ExpressionMap} [options.map=null] - Only needed for
     *   `triggerPrimary`. See the header on why the label is not trusted by default.
     * @param {boolean} [options.triggerPrimary=false] - Offer `primary` to `map.trigger()` as well
     *   as driving PAD from the vector.
     * @param {boolean} [options.warmOnConstruction=true] - Pays the 22.285 s cold load up front.
     *   False only for a gate that does not want the call counted.
     * @param {Object} [options.defects] - 🚩 Gate fodder only. See DEFECTS.
     */
    constructor( options = {} ) {

        if ( options.client === null || typeof options.client !== 'object' ) {

            throw new TypeError(
                'AppraisalAffect: options.client is required — pass an LMStudioClient. The transport '
                + 'is injected so this layer can be gated offline with no model resident.' );

        }

        if ( options.state === null || typeof options.state !== 'object'
            || typeof options.state.push !== 'function' ) {

            throw new TypeError(
                'AppraisalAffect: options.state must be the AffectState tier 1 pushes into. Tier 2 '
                + 'blends into the running state; it does not own one.' );

        }

        this.client = options.client;
        this.state = options.state;
        this.map = options.map ?? null;
        this.triggerPrimary = options.triggerPrimary ?? false;

        this.defects = { ...DEFECTS_OFF, ...( options.defects ?? {} ) };

        /** The warm-up promise. Non-null from the first `warm()`, which is what makes it once-only. */
        this.warming = null;

        /** The warm-up's outcome once it settles, for `report()`. Null while it is still loading. */
        this.warmResult = null;

        /** The utterance currently on the wire, or null. The frame fence reads this. */
        this.pendingUtterance = null;

        /** Monotonic. Only the newest generation may write to the state. */
        this.generation = 0;

        this.appraisals = 0;
        this.applied = 0;
        this.superseded = 0;
        this.refusals = new Map();

        this.lastValue = null;
        this.lastWeights = null;
        this.lastLatencyMs = null;

        if ( options.warmOnConstruction !== false ) this.warm();

    }

    /**
     * Starts the weight load, or returns the one already running.
     *
     * Idempotent by holding the promise: a second call cannot start a second 37.75 GB load. The
     * rejection path is handled here rather than left to the caller, because a fire-and-forget
     * promise that rejects is an unhandled rejection and, in node, that is a process exit.
     *
     * 🚩 THE CLIENT IS CALLED SYNCHRONOUSLY, AND THE FIRST DRAFT OF THIS METHOD WAS NOT. Written as
     * `Promise.resolve().then( () => this.client.warm() )` the load starts one MICROTASK after the
     * constructor returns, and a host that constructs the avatar and appraises in the same tick puts
     * its first utterance on the wire AHEAD of the warm-up — measured in this file's own gate, which
     * saw the two requests arrive in the wrong order. The load must be in flight by the time the
     * constructor returns, so the call is made here and only its OUTCOME is deferred. The `try`
     * exists because a client that throws synchronously would otherwise take the constructor with it.
     *
     * @returns {Promise<{warmed: boolean, latencyMs: number, reason: string|null}>}
     */
    warm() {

        if ( this.warming !== null && this.defects.warmPerCall !== true ) return this.warming;

        let started;

        try {

            started = Promise.resolve( this.client.warm() );

        } catch ( error ) {

            started = Promise.reject( error );

        }

        this.warming = started
            .then(
                ( result ) => {

                    this.warmResult = result;
                    return result;

                },
                ( error ) => {

                    // A warm-up that failed is not an error worth propagating: the model is simply
                    // still cold, and the per-utterance timeout already covers that case.
                    this.warmResult = { warmed: false, latencyMs: 0, reason: String( error?.message ?? error ) };
                    return this.warmResult;

                } );

        return this.warming;

    }

    /**
     * One tier-2 appraisal, at an utterance boundary.
     *
     * 🚩 NEVER FROM A FRAME PATH. See the header's three mechanisms; this method is the third of
     * them and it throws rather than refusing, because a frame-path caller is a programming error
     * and an expected-outcome result object would be swallowed by whatever handles refusals.
     *
     * @param {string} utterance - what was said.
     * @param {Object} [options]
     * @param {Array<{role: string, content: string}>} [options.history=[]] - passed straight to the
     *   client. Affect is contextual; "fine." reads differently after an apology than after an insult.
     * @param {Object} [options.tier1] - `ReflexAffect.estimate()` for this same utterance, or just
     *   its `confidence`. Absent means "no declared prior" and pools every axis at 1/2.
     * @returns {Promise<Object>} `{ok, applied, ...}`. `ok: false` carries the client's own `reason`
     *   and `detail`; `applied: false` with `outcome: SUPERSEDED` means a newer utterance overtook
     *   this one. In every case but `applied: true`, the state was not touched.
     */
    async appraise( utterance, options = {} ) {

        if ( typeof utterance !== 'string' || utterance.trim() === '' ) {

            throw new TypeError( 'AppraisalAffect.appraise: utterance must be a non-empty string.' );

        }

        if ( this.pendingUtterance === utterance && this.defects.noFence !== true ) {

            throw new Error(
                'AppraisalAffect.appraise: an appraisal of this exact utterance is already in '
                + 'flight. Tier 2 costs about 0.7 s and is called ONCE at an utterance boundary, '
                + 'never from update( dt ) — a frame loop reaches this line on its second frame. '
                + 'Await the promise the first call returned, or pass the new utterance.' );

        }

        if ( this.defects.warmPerCall === true ) this.warm();

        const generation = this.generation + 1;
        this.generation = generation;
        this.pendingUtterance = utterance;

        const tier1Confidence = readTier1Confidence( options.tier1 );
        const result = await this.client.appraise( utterance, { history: options.history ?? [] } );

        this.appraisals += 1;
        this.lastLatencyMs = result.latencyMs ?? null;

        if ( generation === this.generation ) this.pendingUtterance = null;

        // A newer utterance overtook this one while it was on the wire. Its belief is older than
        // the state's, so writing it would undo the newer appraisal.
        if ( generation !== this.generation && this.defects.writeStale !== true ) {

            this.superseded += 1;
            return { ok: result.ok === true, applied: false, outcome: SUPERSEDED, utterance, result };

        }

        if ( result.ok === false ) {

            this.refusals.set( result.reason, ( this.refusals.get( result.reason ) ?? 0 ) + 1 );

            if ( this.defects.blendOnRefusal === true ) {

                // 🚩 The exact thing research §"degenerate-output guard" forbids: a refusal reaching
                // the face as a neutral vector. Tier 1's belief is erased by a call that failed.
                this.state.push( { pleasure: 0, arousal: 0, dominance: 0, confidence: 1 } );

            }

            return {
                ok: false, applied: false, outcome: result.reason, utterance,
                reason: result.reason, detail: result.detail, latencyMs: result.latencyMs
            };

        }

        const weights = this.defects.snapOnBlend === true
            ? { pleasure: 1, arousal: 1, dominance: 1 }
            : appraisalWeights( tier1Confidence );

        const vector = this.defects.trustLabel === true
            ? anchorVectorFor( result.value.primary ) ?? result.value
            : result.value;

        this.state.push( {
            pleasure: vector.pleasure,
            arousal: vector.arousal,
            dominance: vector.dominance,
            confidence: weights
        } );

        if ( this.defects.advanceClock === true ) {

            // 🚩 "Catch the state up to the time the call took." It reads as reasonable and it is a
            // second clock over one state — the contract's trap (c) — so affect runs at double rate
            // for the length of every appraisal.
            this.state.update( ( result.latencyMs ?? 0 ) / 1000 );

        }

        // 🚩 `neutral` IS ADMISSIBLE AS A PRIMARY AND IS NOT AN EMOTION, AND THE TWO FILES DISAGREE
        // ABOUT IT. `LMStudioClient` adds `NEUTRAL_PRIMARY` to its accepted set on purpose — "it is
        // the absence of one" — while `ExpressionMap.trigger()` validates against `ANCHOR_SETS` and
        // THROWS on it: measured, `ExpressionMap: 'neutral' is not an emotion`. So a perfectly
        // ordinary flat utterance would take down the appraisal of every host that opted in. The
        // absence of an emotion is nothing to trigger, so it is skipped rather than translated.
        if ( this.triggerPrimary === true && this.map !== null
            && result.value.primary !== NEUTRAL_PRIMARY ) {

            this.map.trigger( result.value.primary, result.value.intensity );

        }

        this.applied += 1;
        this.lastValue = { ...result.value };
        this.lastWeights = weights;

        return {
            ok: true, applied: true, outcome: 'applied', utterance,
            value: this.lastValue, weights, tier1Confidence,
            latencyMs: result.latencyMs, channel: result.channel
        };

    }

    /** What tier 2 did this session, and — when it did nothing — why. A HUD and a gate both read this. */
    report() {

        return {
            tier: 2,
            appraisals: this.appraisals,
            applied: this.applied,
            superseded: this.superseded,
            refusals: Object.fromEntries( this.refusals ),
            inFlight: this.pendingUtterance !== null,
            warm: this.warmResult,
            lastValue: this.lastValue,
            lastWeights: this.lastWeights,
            lastLatencyMs: this.lastLatencyMs,
            client: typeof this.client.report === 'function' ? this.client.report() : null
        };

    }

}

/**
 * Accepts either a whole `ReflexAffect.estimate()` or the `confidence` object out of one, because
 * both are things a caller has in hand at an utterance boundary and guessing wrong is silent.
 */
function readTier1Confidence( tier1 ) {

    if ( tier1 === null || tier1 === undefined ) return null;
    if ( typeof tier1 === 'number' ) return tier1;

    return tier1.confidence ?? tier1;

}

/**
 * 🚩 `defects.trustLabel`'s vector: the first anchor of the emotion `primary` names.
 *
 * This is what "believe the label" actually means in PAD terms, and `LMStudioClient`'s measured
 * happy/surprised row is what makes it visible — that utterance's vector sits on WASABI's happy
 * anchor while its label says `surprised`, so the two paths write to opposite corners.
 */
function anchorVectorFor( primary ) {

    const set = ANCHOR_SETS[ String( primary ).toLowerCase() ];
    if ( set === undefined ) return null;

    const [ pleasure, arousal, dominance ] = set.points[ 0 ];
    return { pleasure, arousal, dominance };

}
