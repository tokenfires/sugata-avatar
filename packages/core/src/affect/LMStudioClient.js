/**
 * LMStudioClient — the transport half of tier 2. Punch-list 5.3.
 *
 * This file talks to LM Studio and returns either a validated affect vector or a REASON it
 * refused. It does no smoothing, holds no PAD state and imports nothing from the render tree, so
 * it can be gated headlessly against a stub `fetch` with no browser and no model running.
 * `AppraisalAffect.js` is what blends a result into `AffectState`; the split exists because
 * "networking gets proven in an isolated prototype before it is built into the application".
 *
 *
 * WHY A RESULT OBJECT AND NOT AN EXCEPTION
 * ----------------------------------------
 * research/lm-studio-integration.md's degenerate-output guard ends with the sentence this file is
 * shaped by: **"on any rejection, keep Tier 1's value and log — never let a bad Tier 2 result snap
 * the face."** A rejection is therefore an EXPECTED outcome on the normal path, not an error, and
 * an expected outcome that travels as an exception gets caught by whatever `try` happens to be
 * nearest. Every call returns `{ ok, reason }` and the reason is always a string a log can print.
 *
 * The one place that genuinely throws is a programming error in the CALLER — a schema with no
 * `properties`, a non-finite timeout — because those cannot be recovered from and must not be
 * swallowed into a silent tier-1 fallback that looks like the model being slow.
 *
 *
 * THE FOUR PUBLISHED FINDINGS THIS FILE IMPLEMENTS
 * ------------------------------------------------
 * All four are from research/lm-studio-integration.md, probed 2026-08-06. Findings 1 and 3 are
 * re-measured below because they decide code paths.
 *
 *   1. Schema-constrained output arrives in `reasoning_content` and `content` is EMPTY, because the
 *      grammar stops the model ever emitting the `</think>` sentinel LM Studio splits channels on.
 *      → `readCompletionChannel` tries `content` first anyway, so this stays correct against a
 *        non-thinking model and against a future LM Studio that fixes the split.
 *   2. Thinking cannot be disabled through the API. All four documented routes were tried and none
 *      suppressed reasoning tokens; unconstrained, the model reasons past 1199 tokens and never
 *      answers. → the schema is NOT optional and this client has no unconstrained call.
 *   3. `response_format: {type:'json_object'}` returns HTTP 400. Only the full `json_schema` form
 *      works. → `REFUSED_JSON_OBJECT_MODE` exists so a caller cannot reintroduce it by accident.
 *   4. ~1 s per call is fine per utterance and impossible per frame. → two tiers, and nothing here
 *      may be called from a frame path.
 *
 *
 * 🎯 WHAT WAS RE-MEASURED 2026-08-16, AND THE TWO THINGS THAT ARE NEW
 * -------------------------------------------------------------------
 * Same host, same endpoint, model `qwen/qwen3.6-35b-a3b`, schema-constrained, 11 calls.
 *
 *   Finding 1 REPRODUCES EXACTLY and without exception: **11 of 11 completions arrived in
 *   `reasoning_content` with `content` an empty string.** Not "usually" — every one.
 *
 *   Warm latency REPRODUCES: 0.656-1.133 s over 11 calls against the doc's 0.6-0.95 s, with the
 *   first call of a burst at the top of the range exactly as the doc records (1.133 s vs ~0.93 s).
 *
 * 🚩 **NEW, AND IT IS AN ARCHITECTURAL REQUIREMENT RATHER THAN A FOOTNOTE: A COLD CALL COSTS
 * 22.28 SECONDS.** The research doc measured a model that was already resident and never recorded
 * a load. Measured today against an idle LM Studio, the first schema-constrained call returned in
 * **22.285 s** — the 37.75 GB weight load — against 0.670 s for the next one. A tier-2 client that
 * does not warm the model pays that on THE USER'S FIRST UTTERANCE, which is the worst possible
 * moment and looks like a hung avatar rather than a slow one. `warm()` exists for this and
 * `WARM_TIMEOUT_MS` is sized for it; the per-utterance `TIMEOUT_MS` deliberately is NOT, so a cold
 * model times out into tier 1 rather than freezing a conversation for twenty-two seconds.
 *
 * 🎯 **NEW, AND IT DECIDES THE SCHEMA: THE AROUSAL AXIS HAD TO BE MADE BIPOLAR ON PURPOSE.** This
 * project's PAD is `{pleasure, arousal, dominance}`, ALL THREE on [-1, 1] (`AffectState.js`
 * `PAD_AXES`, and `ExpressionMap.WASABI_ANCHORS` puts `bored` at arousal **-0.80** and `depressed`
 * at -0.80). The research doc's probe used `valence` and its returned arousals were 0.3-0.7 —
 * readable as [0, 1]. A tier-2 vector on [0, 1] fed to a layer expecting [-1, 1] does not crash: it
 * makes the entire NEGATIVE-AROUSAL HALF OF THE CUBE UNREACHABLE, so the avatar can never be bored
 * or depressed and nothing anywhere reports a fault.
 *
 * Measured over eight utterances chosen one per WASABI anchor, with the bipolar range stated in
 * both the system prompt and the schema description:
 *
 *   | utterance  |     P |     A |     D | primary   |
 *   |------------|------:|------:|------:|-----------|
 *   | bored      | -0.30 | -0.20 | -0.60 | bored     |
 *   | depressed  | -0.90 | **-0.80** | -0.95 | sad       |
 *   | sad        | -0.80 | -0.20 | -0.65 | sad       |
 *   | angry      | -0.80 |  0.60 | **+0.70** | angry     |
 *   | fearful    | -0.80 |  0.60 | **-0.50** | fearful   |
 *   | annoyed    | -0.80 |  0.30 |  0.60 | annoyed   |
 *   | surprised  | -0.20 |  0.60 | -0.30 | surprised |
 *   | happy      |  0.80 |  0.70 |  0.60 | surprised |
 *
 * Three things follow, and all three are in the code below rather than in this comment alone:
 *
 *   (a) **The negative half IS reachable** — depressed returns -0.80, which is WASABI's own bored/
 *       depressed anchor value. So the fix is the PROMPT plus the schema description, and it works.
 *       `PAD_SYSTEM_PROMPT` states the bipolarity twice and names low-energy states explicitly,
 *       because the shorter phrasing is what produced the [0, 1]-looking numbers.
 *   (b) **Dominance separates anger from fear on our own probe**, +0.70 against -0.50, at equal
 *       pleasure (-0.80) and equal arousal (0.60). That is the research doc's whole argument for
 *       three axes, reproduced here rather than cited.
 *   (c) 🚩 **The LABEL AND THE VECTOR CAN DISAGREE, and the vector is the one to trust.** The happy
 *       utterance returned `primary: "surprised"` while its PAD sits on WASABI's happy anchor. The
 *       face is driven from PAD through `ExpressionMap`'s threshold-and-saturate; `primary` is
 *       returned for logging and for an optional `trigger()`, and this client never lets it
 *       override the vector. A caller that switches on `primary` alone has re-introduced a
 *       discrete-emotion model underneath a dimensional one.
 *
 * ⚠️ AND ONE CALIBRATION OBSERVATION THAT IS NOT ACTED ON HERE. The model is CONSERVATIVE in
 * arousal magnitude: a plainly bored utterance returned -0.20 where WASABI's `bored` anchor is
 * -0.80 and its activation threshold is 0.645, so that vector will not fire `bored` in
 * `ExpressionMap`. That is a real observation about tier 2's dynamic range and it is recorded
 * rather than corrected, because a gain applied here would be a number nobody measured against the
 * face. Whoever closes it should measure the correction against rendered plates, not against this
 * table.
 */

/**
 * The endpoint and model the brief names, verbatim.
 *
 * ⚠️ `qwen/qwen3.6-35b-a3b` is the id to send. The host also lists `qwen3.6-35b-a3b-mtp`,
 * `qwen3.6-35b-a3b-q4km` and `unsloth/qwen3.6-35b-a3b-mlx`, which are DIFFERENT BUILDS of the same
 * weights with their own latencies. research/lm-studio-integration.md nominates the first two as
 * worth benchmarking and none of them has been; sending one of those ids in place of this one is a
 * change of model, not a spelling variant.
 */
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234';
export const DEFAULT_MODEL = 'qwen/qwen3.6-35b-a3b';

/**
 * Per-utterance ceiling. Deliberately far below the 22.285 s cold load measured above: a cold model
 * must time out INTO TIER 1 rather than hold a conversation still, and `warm()` is the supported
 * way to pay that cost once, up front, where it is invisible.
 *
 * 4000 ms is 3.5x the slowest warm call measured (1.133 s) and 5.9x the median (0.674 s).
 */
export const TIMEOUT_MS = 4000;

/** The warm-up call is allowed the full weight load. 30 s against a measured 22.285 s. */
export const WARM_TIMEOUT_MS = 30000;

/** research §4: 0.2 in the doc's reference request shape. Affect inference is not a creative task. */
export const TEMPERATURE = 0.2;

/**
 * The emotions `ExpressionMap` can actually render, plus `neutral`.
 *
 * 🚩 THIS LIST IS NOT AUTHORED HERE AND MUST NOT BE. It is `ExpressionMap.WASABI_ANCHORS`' own key
 * set, and the gate re-derives it from that import rather than comparing to a literal — because a
 * `primary` this client accepts and `ExpressionMap.trigger()` throws on is a runtime error the
 * schema certified as valid. LEARNINGS §1.25b: a constant mirrored in two files is a constant that
 * will drift in one of them.
 */
export const NEUTRAL_PRIMARY = 'neutral';

/**
 * The system prompt, and every clause in it is load-bearing.
 *
 * The bipolarity of `arousal` is stated TWICE — once in the axis definition and once as an
 * imperative about low-energy states — because that is what the measurement above required. A
 * single mention produced vectors that read as [0, 1].
 */
export const PAD_SYSTEM_PROMPT = [
    'You infer the affective state of the speaker of an utterance and return it as a PAD vector.',
    '',
    'ALL THREE AXES ARE BIPOLAR AND RANGE FROM -1 TO +1.',
    '  pleasure:  -1 misery, 0 neutral, +1 delight.',
    '  arousal:   -1 sleepy, bored, lethargic; 0 neutral alertness; +1 frantic, excited.',
    '             LOW-ENERGY STATES MUST BE NEGATIVE, NOT NEAR ZERO.',
    '  dominance: -1 submissive, controlled, helpless; 0 neutral; +1 dominant, in control.',
    '',
    'Dominance is what separates anger from fear: both are unpleasant and high-arousal, and only',
    'dominance tells them apart. Do not leave it at zero unless the utterance genuinely carries no',
    'stance.',
    '',
    'Judge the SPEAKER\'S state, not the subject matter: a calm description of a disaster is calm.'
].join( '\n' );

/**
 * The response schema. `strict: true` and `additionalProperties: false` are both required — see
 * finding 3 for why `json_object` mode is not an option and the full schema always goes on the wire.
 *
 * The `description` on `arousal` repeats the bipolarity for the third time, because the grammar is
 * what the model is actually decoding against and a range stated only in the prompt is a range the
 * constrained decoder never sees.
 */
export function buildAffectSchema( primaryValues ) {

    if ( Array.isArray( primaryValues ) === false || primaryValues.length === 0 ) {

        throw new TypeError( 'buildAffectSchema: primaryValues must be a non-empty array of emotion names.' );

    }

    return {
        type: 'object',
        additionalProperties: false,
        required: [ 'pleasure', 'arousal', 'dominance', 'primary', 'intensity' ],
        properties: {
            pleasure: {
                type: 'number', minimum: -1, maximum: 1,
                description: 'Bipolar: -1 misery, +1 delight.'
            },
            arousal: {
                type: 'number', minimum: -1, maximum: 1,
                description: 'BIPOLAR: NEGATIVE for sleepy, bored or lethargic; positive for excited.'
            },
            dominance: {
                type: 'number', minimum: -1, maximum: 1,
                description: 'Bipolar: -1 submissive or helpless, +1 dominant or in control.'
            },
            primary: { type: 'string', enum: [ ...primaryValues ] },
            intensity: { type: 'number', minimum: 0, maximum: 1 }
        }
    };

}

/** Every reason a call can fail, as a closed set so a log line can be counted rather than grepped. */
export const REFUSAL = Object.freeze( {
    TRANSPORT: 'transport',                 // the fetch itself failed or the host is not there
    TIMEOUT: 'timeout',                     // exceeded TIMEOUT_MS
    HTTP: 'http',                           // a non-2xx, which finding 3 says json_object mode gives
    NO_CHANNEL: 'no-channel',               // neither content nor reasoning_content carried anything
    UNPARSEABLE: 'unparseable',             // the channel held something that is not JSON
    SCHEMA: 'schema',                       // parsed, but a required key is missing or mistyped
    OUT_OF_RANGE: 'out-of-range',           // an axis outside [-1, 1] or intensity outside [0, 1]
    DEGENERATE_ZERO: 'degenerate-zero',     // the all-zero vector gemma returned on the anger utterance
    DEGENERATE_UNIFORM: 'degenerate-uniform', // all three axes identical and non-zero
    DEGENERATE_REPEAT: 'degenerate-repeat', // "surprise-surprise-surprise-..."
    UNKNOWN_PRIMARY: 'unknown-primary'      // a label ExpressionMap.trigger() would throw on
} );

/**
 * Reads the completion out of whichever channel LM Studio put it in.
 *
 * `content` FIRST, always, even though 11 of 11 measured completions arrived in the other one.
 * Finding 1's cause is a parser splitting on a sentinel the grammar prevents; a non-thinking model
 * or a fixed LM Studio build puts it back in `content`, and a client that reads `reasoning_content`
 * first would then be reading the thinking of a model that also emitted an answer.
 *
 * @returns {{text: string, channel: string}|null} null when neither channel carried anything.
 */
export function readCompletionChannel( message ) {

    if ( message === null || typeof message !== 'object' ) return null;

    const content = typeof message.content === 'string' ? message.content.trim() : '';
    if ( content !== '' ) return { text: content, channel: 'content' };

    const reasoning = typeof message.reasoning_content === 'string'
        ? message.reasoning_content.trim()
        : '';
    if ( reasoning !== '' ) return { text: reasoning, channel: 'reasoning_content' };

    return null;

}

/**
 * True when a string is a short unit repeated three or more times, with or without a separator.
 *
 * The known-bad is gemma's `"surprise-surprise-surprise-surprise-..."`. A length check cannot catch
 * it (the string is long, which is what a real label is not) and neither can a dictionary check (the
 * unit IS a real word). What identifies it is PERIODICITY, so that is what this measures: the
 * smallest period the string is built from, against a floor of three repeats.
 *
 * ⚠️ Three repeats, not two, deliberately. "so-so" and "bye-bye" are two, and both are language.
 */
export function isRepetitionCollapsed( text, minimumRepeats = 3 ) {

    if ( typeof text !== 'string' ) return false;

    const stripped = text.trim();
    if ( stripped.length < minimumRepeats * 2 ) return false;

    // Try every period that could divide the string into at least `minimumRepeats` whole units,
    // shortest first, so "aaaa" reports period 1 rather than period 2.
    for ( let period = 1; period <= Math.floor( stripped.length / minimumRepeats ); period ++ ) {

        if ( stripped.length % period !== 0 ) continue;

        const unit = stripped.slice( 0, period );
        let periodic = true;

        for ( let at = period; at < stripped.length; at += period ) {

            if ( stripped.slice( at, at + period ) !== unit ) { periodic = false; break; }

        }

        if ( periodic ) return true;

    }

    // The separator case: "surprise-surprise-surprise" has no whole-string period because the
    // trailing unit carries no separator. Split on the common joiners and check unit equality.
    for ( const separator of [ '-', ' ', ',', '_' ] ) {

        const parts = stripped.split( separator ).filter( ( part ) => part !== '' );
        if ( parts.length < minimumRepeats ) continue;
        if ( parts.every( ( part ) => part === parts[ 0 ] ) ) return true;

    }

    return false;

}

/**
 * Structural and SEMANTIC validation of a parsed completion.
 *
 * research/lm-studio-integration.md, verbatim: **"A JSON schema guarantees parseable, never
 * meaningful."** Its degenerate-output guard lists four rejections and all four are here, each with
 * its own reason code so a rejection rate can be attributed to a cause rather than counted.
 *
 * @param {Object} parsed - whatever came out of JSON.parse.
 * @param {ReadonlySet<string>} knownPrimaries - the emotions ExpressionMap can actually render.
 * @returns {{ok: true, value: Object}|{ok: false, reason: string, detail: string}}
 */
export function validateAffect( parsed, knownPrimaries ) {

    if ( parsed === null || typeof parsed !== 'object' || Array.isArray( parsed ) ) {

        return { ok: false, reason: REFUSAL.SCHEMA, detail: `not an object: ${ typeof parsed }` };

    }

    const axes = [ 'pleasure', 'arousal', 'dominance' ];

    for ( const axis of [ ...axes, 'intensity' ] ) {

        if ( Number.isFinite( parsed[ axis ] ) === false ) {

            return { ok: false, reason: REFUSAL.SCHEMA, detail: `${ axis } is ${ JSON.stringify( parsed[ axis ] ) }` };

        }

    }

    for ( const axis of axes ) {

        if ( parsed[ axis ] < -1 || parsed[ axis ] > 1 ) {

            return { ok: false, reason: REFUSAL.OUT_OF_RANGE, detail: `${ axis } = ${ parsed[ axis ] }` };

        }

    }

    if ( parsed.intensity < 0 || parsed.intensity > 1 ) {

        return { ok: false, reason: REFUSAL.OUT_OF_RANGE, detail: `intensity = ${ parsed.intensity }` };

    }

    // gemma's all-zero vector on the anger utterance. An utterance that genuinely reads as neutral
    // on all three axes is indistinguishable from this failure, which is why the correct response
    // is to KEEP TIER 1 rather than to write a zero: tier 1 already has an opinion and this call
    // adds nothing to it either way.
    if ( axes.every( ( axis ) => parsed[ axis ] === 0 ) ) {

        return { ok: false, reason: REFUSAL.DEGENERATE_ZERO, detail: 'all three axes exactly 0' };

    }

    // Three identical non-zero axes is the other collapse shape: a model that has learned to emit
    // one number three times. Anger (-0.8, 0.6, 0.7) and fear (-0.8, 0.6, -0.5) both have two axes
    // equal and neither has three, which is what makes three the right threshold rather than two.
    if ( parsed.pleasure === parsed.arousal && parsed.arousal === parsed.dominance ) {

        return {
            ok: false, reason: REFUSAL.DEGENERATE_UNIFORM,
            detail: `all three axes = ${ parsed.pleasure }`
        };

    }

    if ( typeof parsed.primary !== 'string' || parsed.primary === '' ) {

        return { ok: false, reason: REFUSAL.SCHEMA, detail: `primary is ${ JSON.stringify( parsed.primary ) }` };

    }

    if ( isRepetitionCollapsed( parsed.primary ) ) {

        return { ok: false, reason: REFUSAL.DEGENERATE_REPEAT, detail: parsed.primary.slice( 0, 60 ) };

    }

    if ( knownPrimaries.has( parsed.primary ) === false ) {

        return { ok: false, reason: REFUSAL.UNKNOWN_PRIMARY, detail: parsed.primary };

    }

    return {
        ok: true,
        value: {
            pleasure: parsed.pleasure,
            arousal: parsed.arousal,
            dominance: parsed.dominance,
            primary: parsed.primary,
            intensity: parsed.intensity
        }
    };

}

export class LMStudioClient {

    /**
     * @param {Object} [options]
     * @param {string} [options.endpoint=DEFAULT_ENDPOINT]
     * @param {string} [options.model=DEFAULT_MODEL]
     * @param {number} [options.timeoutMs=TIMEOUT_MS] - per-utterance ceiling. NOT sized for a cold
     *   load; see the module header. Call `warm()` instead of raising this.
     * @param {Iterable<string>} options.primaries - the emotion labels a `primary` may take. Pass
     *   `Object.keys(WASABI_ANCHORS)` — do not author a list here, see NEUTRAL_PRIMARY's note.
     * @param {Function} [options.fetchImpl=globalThis.fetch] - injected so the gate can run with no
     *   network, no browser and no model. Every transport clause in the selftest uses this.
     */
    constructor( options = {} ) {

        this.endpoint = ( options.endpoint ?? DEFAULT_ENDPOINT ).replace( /\/+$/, '' );
        this.model = options.model ?? DEFAULT_MODEL;
        this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind( globalThis );

        if ( typeof this.fetchImpl !== 'function' ) {

            throw new TypeError( 'LMStudioClient: no fetch available. Pass options.fetchImpl.' );

        }

        if ( Number.isFinite( this.timeoutMs ) === false || this.timeoutMs <= 0 ) {

            throw new TypeError( `LMStudioClient: timeoutMs must be a positive number, got ${ this.timeoutMs }.` );

        }

        const primaries = [ ...( options.primaries ?? [] ) ];

        if ( primaries.length === 0 ) {

            throw new TypeError(
                'LMStudioClient: options.primaries is required — pass ExpressionMap\'s own anchor ' +
                'keys. A label this client accepts and ExpressionMap.trigger() throws on is a ' +
                'runtime error the JSON schema certified as valid.' );

        }

        // `neutral` is always admissible and is not a WASABI anchor: it is the absence of one.
        this.primaries = Object.freeze( new Set( [ ...primaries, NEUTRAL_PRIMARY ] ) );
        this.schema = buildAffectSchema( [ ...this.primaries ] );

        /** Counts by reason, so a session can report WHY tier 2 was not driving rather than that it was not. */
        this.refusals = new Map();
        this.calls = 0;
        this.lastLatencyMs = null;

        /** Which channel the last successful completion arrived in. Finding 1 is a live property, not a constant. */
        this.lastChannel = null;

    }

    /**
     * Pays the weight load up front. Measured 22.285 s cold against 0.670 s warm on the next call.
     *
     * Sends the same shape as a real inference so the load is of the same grammar and the same
     * context, and deliberately ignores the RESULT — a warm-up that failed validation still warmed
     * the model, which is the only thing it was for.
     *
     * @returns {Promise<{warmed: boolean, latencyMs: number, reason: string|null}>}
     */
    async warm() {

        const started = nowMs();
        const outcome = await this.#post(
            [ { role: 'system', content: PAD_SYSTEM_PROMPT }, { role: 'user', content: 'Hello.' } ],
            WARM_TIMEOUT_MS );
        const latencyMs = nowMs() - started;

        return {
            warmed: outcome.ok === true,
            latencyMs,
            reason: outcome.ok === true ? null : outcome.reason
        };

    }

    /**
     * One tier-2 appraisal.
     *
     * 🚩 NOT CALLABLE FROM A FRAME PATH. Finding 4: ~1 s per call. The caller is an utterance
     * boundary, never `update(dt)`.
     *
     * @param {string} utterance - what was said.
     * @param {Object} [options]
     * @param {Array<{role: string, content: string}>} [options.history=[]] - prior turns, if the
     *   caller wants the appraisal to see context. Affect is contextual — "fine." means different
     *   things after an apology and after an insult.
     * @returns {Promise<{ok: true, value: Object, latencyMs: number, channel: string}
     *                  |{ok: false, reason: string, detail: string, latencyMs: number}>}
     */
    async appraise( utterance, options = {} ) {

        if ( typeof utterance !== 'string' || utterance.trim() === '' ) {

            throw new TypeError( 'LMStudioClient.appraise: utterance must be a non-empty string.' );

        }

        const started = nowMs();
        const messages = [
            { role: 'system', content: PAD_SYSTEM_PROMPT },
            ...( options.history ?? [] ),
            { role: 'user', content: utterance }
        ];

        const posted = await this.#post( messages, this.timeoutMs );
        const latencyMs = nowMs() - started;

        this.calls += 1;
        this.lastLatencyMs = latencyMs;

        if ( posted.ok === false ) return this.#refuse( posted.reason, posted.detail, latencyMs );

        const channel = readCompletionChannel( posted.message );

        if ( channel === null ) {

            return this.#refuse( REFUSAL.NO_CHANNEL, 'content and reasoning_content both empty', latencyMs );

        }

        let parsed;

        try {

            parsed = JSON.parse( channel.text );

        } catch ( error ) {

            return this.#refuse( REFUSAL.UNPARSEABLE, channel.text.slice( 0, 120 ), latencyMs );

        }

        const validated = validateAffect( parsed, this.primaries );

        if ( validated.ok === false ) {

            return this.#refuse( validated.reason, validated.detail, latencyMs );

        }

        this.lastChannel = channel.channel;

        return { ok: true, value: validated.value, latencyMs, channel: channel.channel };

    }

    /** Refusal counts by reason. A session can print this to say why tier 2 was quiet. */
    report() {

        return {
            calls: this.calls,
            refusals: Object.fromEntries( this.refusals ),
            lastLatencyMs: this.lastLatencyMs,
            lastChannel: this.lastChannel,
            model: this.model,
            endpoint: this.endpoint
        };

    }

    #refuse( reason, detail, latencyMs ) {

        this.refusals.set( reason, ( this.refusals.get( reason ) ?? 0 ) + 1 );
        return { ok: false, reason, detail: String( detail ?? '' ), latencyMs };

    }

    /**
     * The wire call. Everything that can go wrong with a network becomes a reason code here, so no
     * caller above this line ever sees an exception from a socket.
     */
    async #post( messages, timeoutMs ) {

        const controller = new AbortController();
        const timer = setTimeout( () => controller.abort(), timeoutMs );

        try {

            const response = await this.fetchImpl( `${ this.endpoint }/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify( {
                    model: this.model,
                    temperature: TEMPERATURE,
                    max_tokens: 200,
                    messages,

                    // Finding 3: the FULL json_schema form, every time. `{type:'json_object'}` is
                    // an HTTP 400 on this host and there is no code path here that can emit it.
                    response_format: {
                        type: 'json_schema',
                        json_schema: { name: 'affect', strict: true, schema: this.schema }
                    }
                } )
            } );

            if ( response.ok === false ) {

                return { ok: false, reason: REFUSAL.HTTP, detail: `HTTP ${ response.status }` };

            }

            const body = await response.json();
            const message = body?.choices?.[ 0 ]?.message ?? null;

            return { ok: true, message };

        } catch ( error ) {

            const aborted = error?.name === 'AbortError' || controller.signal.aborted === true;

            return aborted
                ? { ok: false, reason: REFUSAL.TIMEOUT, detail: `${ timeoutMs } ms` }
                : { ok: false, reason: REFUSAL.TRANSPORT, detail: String( error?.message ?? error ) };

        } finally {

            clearTimeout( timer );

        }

    }

}

/** `performance.now` where it exists, `Date.now` otherwise. Both are monotonic enough for a latency. */
function nowMs() {

    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

}
