/**
 * Gate for `affect/LMStudioClient.js` — punch-list 5.3, the transport half of tier 2.
 *
 * Everything here runs HEADLESS AND OFFLINE against an injected `fetch`, so the gate is a real gate
 * on a machine with no LM Studio, no model and no network. That is deliberate and it is the reason
 * the transport was split out of `AppraisalAffect`: a gate that can only run when a 37 GB model
 * happens to be resident is a gate that gets skipped, and a skipped gate is not a gate.
 *
 * The LIVE section at the bottom is the exception. It probes the real host and, when the host is
 * not there, records SKIP — never PASS. A skip that reads as a pass is how a transport claim
 * survives its own transport being broken.
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   CHANNEL      Finding 1's fallback, in both directions. `content` wins when both are present —
 *                proved by a message carrying DIFFERENT payloads in the two channels, so a client
 *                that read the wrong one returns a different vector rather than the same one.
 *
 *   REPETITION   The gemma known-bad `"surprise-surprise-surprise-surprise"` is rejected, AND the
 *                two-repeat words that are real language are NOT. A detector that rejects "so-so"
 *                would silently drop a valid label, so the boundary is asserted from both sides.
 *
 *   VALIDATE     All four of the research doc's degenerate guards, each proved red by the exact
 *                shape the doc records gemma returning, and each carrying its own reason code so a
 *                rejection can be attributed rather than counted.
 *
 *   PRIMARIES    🚩 The accepted label set is DERIVED from `ExpressionMap.WASABI_ANCHORS` in this
 *                process, not compared to a literal. A label this client accepts and
 *                `ExpressionMap.trigger()` throws on is a runtime error the JSON schema certified
 *                as valid — the two sets are asserted equal, both ways.
 *
 *   WIRE         What actually goes on the socket, read off the stub: the full `json_schema` form,
 *                never finding 3's `json_object`, and the bipolar range present in the SCHEMA and
 *                not only in the prompt. Proved red by asserting the assertion can fail.
 *
 *   TRANSPORT    Every failure a network has becomes a reason code and never an exception: HTTP
 *                non-2xx (which is what finding 3's `json_object` returns), abort/timeout, a thrown
 *                fetch, and a 200 carrying no message at all.
 *
 *   TIMEOUT      🚩 The clause that separates this file from a mock that always resolves. A stub
 *                that never settles must produce REFUSAL.TIMEOUT and must do it in about
 *                `timeoutMs`, measured — because an AbortController wired to the wrong signal
 *                produces a promise that hangs forever and every other clause here would still pass.
 *
 *   LIVE         One real call if the host answers. Records the channel finding 1 predicts as a
 *                MEASUREMENT of this run rather than as a constant, and SKIPs when the host is
 *                absent.
 *
 * A measurement outside its range prints FAIL and the process exits non-zero.
 */

import {
    DEFAULT_ENDPOINT, DEFAULT_MODEL, LMStudioClient, NEUTRAL_PRIMARY, PAD_SYSTEM_PROMPT,
    REFUSAL, TIMEOUT_MS, buildAffectSchema, isRepetitionCollapsed, readCompletionChannel,
    validateAffect
} from './LMStudioClient.js';
import { WASABI_ANCHORS } from './ExpressionMap.js';

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

/** The label set every clause below derives from, rather than from a list typed here. */
const PRIMARIES = Object.keys( WASABI_ANCHORS );
const KNOWN = new Set( [ ...PRIMARIES, NEUTRAL_PRIMARY ] );

/** A well-formed vector, used as the base every known-bad is a single mutation of. */
const GOOD = Object.freeze( {
    pleasure: -0.8, arousal: 0.6, dominance: 0.7, primary: 'angry', intensity: 0.8
} );

/**
 * A stub `fetch` that returns one canned completion and records what it was asked for.
 * `sent` is what the WIRE section reads.
 */
function stubFetch( { message = null, status = 200, throws = null, hang = false } = {} ) {

    const calls = [];

    const impl = async ( url, init ) => {

        calls.push( { url, init, body: JSON.parse( init.body ) } );

        if ( throws !== null ) throw throws;

        if ( hang === true ) {

            // Never settles on its own. Only the client's AbortController can end this, which is
            // exactly what the TIMEOUT section is measuring.
            return new Promise( ( resolve, reject ) => {

                init.signal?.addEventListener( 'abort', () => {

                    const error = new Error( 'aborted' );
                    error.name = 'AbortError';
                    reject( error );

                } );

            } );

        }

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => ( { choices: message === null ? [] : [ { message } ] } )
        };

    };

    impl.calls = calls;
    return impl;

}

function clientWith( fetchImpl, options = {} ) {

    return new LMStudioClient( { primaries: PRIMARIES, fetchImpl, ...options } );

}

/** The completion shape LM Studio actually returns, per finding 1. */
function reasoningMessage( payload ) {

    return { role: 'assistant', content: '', reasoning_content: JSON.stringify( payload ) };

}

// --- CHANNEL -------------------------------------------------------------------------------------

{
    check( 'CHANNEL  a schema completion in reasoning_content is read (finding 1)',
        readCompletionChannel( reasoningMessage( GOOD ) )?.channel === 'reasoning_content' );

    check( 'CHANNEL  a completion in content is read',
        readCompletionChannel( { content: '{"a":1}', reasoning_content: '' } )?.channel === 'content' );

    // 🚩 THE RED PROOF FOR THE ORDER. Both channels carry JSON and they DISAGREE, so a client that
    // read reasoning_content first returns a different vector rather than an equal one. An
    // assertion on a message where both channels agree cannot fail and would be decorative.
    const both = readCompletionChannel( {
        content: JSON.stringify( { primary: 'happy' } ),
        reasoning_content: JSON.stringify( { primary: 'angry' } )
    } );
    check( '🎯 CHANNEL  content WINS when both are present, proved on disagreeing payloads',
        both.channel === 'content' && JSON.parse( both.text ).primary === 'happy',
        `read '${ JSON.parse( both.text ).primary }' from ${ both.channel }` );

    check( 'CHANNEL  both channels empty reads as no channel',
        readCompletionChannel( { content: '', reasoning_content: '   ' } ) === null );

    check( 'CHANNEL  a whitespace-only content falls through to reasoning_content',
        readCompletionChannel( { content: '  \n ', reasoning_content: '{"x":1}' } )?.channel
            === 'reasoning_content' );

    check( 'CHANNEL  a null message is not a channel',
        readCompletionChannel( null ) === null );
}

// --- REPETITION ----------------------------------------------------------------------------------

{
    // The known-bad verbatim from research/lm-studio-integration.md's degenerate-output guard.
    check( '🎯 REPETITION  gemma\'s "surprise-surprise-surprise-surprise" is rejected',
        isRepetitionCollapsed( 'surprise-surprise-surprise-surprise' ) === true );

    check( 'REPETITION  a space-separated collapse is rejected',
        isRepetitionCollapsed( 'angry angry angry' ) === true );

    check( 'REPETITION  a whole-string period is rejected',
        isRepetitionCollapsed( 'abcabcabc' ) === true );

    // ⚠️ THE OTHER SIDE OF THE BOUNDARY, and it is the half a detector gets wrong. Two repeats are
    // language; three are a collapse. Without these, a detector that rejects everything passes the
    // clause above.
    check( '🎯 REPETITION  two-repeat real words are NOT rejected — "so-so", "bye-bye"',
        isRepetitionCollapsed( 'so-so' ) === false && isRepetitionCollapsed( 'bye-bye' ) === false );

    check( 'REPETITION  every real emotion label survives the detector',
        PRIMARIES.every( ( name ) => isRepetitionCollapsed( name ) === false ),
        PRIMARIES.filter( ( name ) => isRepetitionCollapsed( name ) ).join( ', ' ) || 'none rejected' );

    check( 'REPETITION  a non-string is not a collapse',
        isRepetitionCollapsed( null ) === false && isRepetitionCollapsed( 7 ) === false );
}

// --- VALIDATE ------------------------------------------------------------------------------------

{
    check( 'VALIDATE  a well-formed vector passes', validateAffect( GOOD, KNOWN ).ok === true );

    // research doc: gemma returned an all-zero vector on the anger utterance.
    check( '🎯 VALIDATE  the all-zero vector is rejected as DEGENERATE_ZERO',
        validateAffect( { ...GOOD, pleasure: 0, arousal: 0, dominance: 0 }, KNOWN ).reason
            === REFUSAL.DEGENERATE_ZERO );

    check( '🎯 VALIDATE  three identical non-zero axes are rejected as DEGENERATE_UNIFORM',
        validateAffect( { ...GOOD, pleasure: 0.5, arousal: 0.5, dominance: 0.5 }, KNOWN ).reason
            === REFUSAL.DEGENERATE_UNIFORM );

    // ⚠️ The threshold is THREE identical axes, not two, and this is why. Both of the vectors this
    // project's own probe returned for anger and fear have two equal axes; rejecting on two would
    // reject the two emotions the dominance axis exists to separate.
    check( '🎯 VALIDATE  TWO equal axes are accepted — the measured anger vector has them',
        validateAffect( { pleasure: -0.8, arousal: 0.6, dominance: 0.6, primary: 'angry', intensity: 0.8 },
            KNOWN ).ok === true );

    check( '🎯 VALIDATE  a repetition-collapsed primary is rejected as DEGENERATE_REPEAT',
        validateAffect( { ...GOOD, primary: 'surprise-surprise-surprise-surprise' }, KNOWN ).reason
            === REFUSAL.DEGENERATE_REPEAT );

    check( 'VALIDATE  a primary outside the known set is rejected as UNKNOWN_PRIMARY',
        validateAffect( { ...GOOD, primary: 'ennui' }, KNOWN ).reason === REFUSAL.UNKNOWN_PRIMARY );

    check( 'VALIDATE  an axis above +1 is rejected as OUT_OF_RANGE',
        validateAffect( { ...GOOD, arousal: 1.4 }, KNOWN ).reason === REFUSAL.OUT_OF_RANGE );

    check( 'VALIDATE  an axis below -1 is rejected as OUT_OF_RANGE',
        validateAffect( { ...GOOD, dominance: -3 }, KNOWN ).reason === REFUSAL.OUT_OF_RANGE );

    check( 'VALIDATE  intensity outside [0,1] is rejected as OUT_OF_RANGE',
        validateAffect( { ...GOOD, intensity: 1.2 }, KNOWN ).reason === REFUSAL.OUT_OF_RANGE );

    check( 'VALIDATE  a missing axis is rejected as SCHEMA',
        validateAffect( { arousal: 0.5, dominance: 0.1, primary: 'angry', intensity: 0.5 }, KNOWN )
            .reason === REFUSAL.SCHEMA );

    check( 'VALIDATE  a NaN axis is rejected as SCHEMA',
        validateAffect( { ...GOOD, pleasure: NaN }, KNOWN ).reason === REFUSAL.SCHEMA );

    check( 'VALIDATE  a string axis is rejected as SCHEMA',
        validateAffect( { ...GOOD, pleasure: '-0.8' }, KNOWN ).reason === REFUSAL.SCHEMA );

    check( 'VALIDATE  an array is not a vector',
        validateAffect( [ -0.8, 0.6, 0.7 ], KNOWN ).reason === REFUSAL.SCHEMA );

    // 🎯 The exact boundary values are legal. A clamp written as `< -1 || > 1` and a clamp written
    // as `<= -1 || >= 1` differ only here, and WASABI's own anchors sit AT ±1.00 on dominance.
    check( '🎯 VALIDATE  ±1 is INSIDE the range — WASABI anchors sit at dominance ±1.00',
        validateAffect( { pleasure: -0.8, arousal: 0.8, dominance: 1, primary: 'angry', intensity: 1 },
            KNOWN ).ok === true
        && validateAffect( { pleasure: 0, arousal: -0.8, dominance: -1, primary: 'depressed', intensity: 0 },
            KNOWN ).ok === true );
}

// --- PRIMARIES -----------------------------------------------------------------------------------

{
    const client = clientWith( stubFetch( { message: reasoningMessage( GOOD ) } ) );

    // 🚩 BOTH DIRECTIONS. A subset check passes on a client that accepts nothing; a superset check
    // passes on one that accepts everything. Equality is the only assertion that can fail usefully.
    const accepted = [ ...client.primaries ].sort();
    const expected = [ ...PRIMARIES, NEUTRAL_PRIMARY ].sort();

    check( '🎯 PRIMARIES  the accepted set EQUALS ExpressionMap\'s anchors plus neutral, both ways',
        accepted.length === expected.length && accepted.every( ( name, at ) => name === expected[ at ] ),
        `accepted [${ accepted.join( ', ' ) }]` );

    check( 'PRIMARIES  every WASABI anchor is renderable AND accepted',
        PRIMARIES.every( ( name ) => client.primaries.has( name ) ),
        `${ PRIMARIES.length } anchors` );

    check( 'PRIMARIES  the schema enum carries the same set as the validator',
        buildAffectSchema( [ ...client.primaries ] ).properties.primary.enum.length
            === client.primaries.size );

    // A client with no primaries is a programming error and must throw rather than default to a
    // list authored in the transport, which is the drift this section exists to prevent.
    let threw = false;
    try { new LMStudioClient( { fetchImpl: stubFetch() } ); } catch { threw = true; }
    check( '🎯 PRIMARIES  constructing with no primaries THROWS rather than defaulting', threw );

    let schemaThrew = false;
    try { buildAffectSchema( [] ); } catch { schemaThrew = true; }
    check( 'PRIMARIES  buildAffectSchema refuses an empty label set', schemaThrew );
}

// --- WIRE ----------------------------------------------------------------------------------------

{
    const impl = stubFetch( { message: reasoningMessage( GOOD ) } );
    const client = clientWith( impl );
    await client.appraise( 'That is the third time you have ignored me.' );

    const sent = impl.calls[ 0 ];

    check( 'WIRE  the request goes to /v1/chat/completions on the configured endpoint',
        sent.url === `${ DEFAULT_ENDPOINT }/v1/chat/completions`, sent.url );

    check( 'WIRE  the model id is the one the brief names',
        sent.body.model === DEFAULT_MODEL, sent.body.model );

    // 🎯 FINDING 3. `json_object` is an HTTP 400 on this host, so the client must be structurally
    // incapable of sending it. Asserting the type is `json_schema` is the check; asserting it is
    // not `json_object` is the check that can fail if someone adds a branch.
    check( '🎯 WIRE  response_format is the FULL json_schema form (finding 3)',
        sent.body.response_format.type === 'json_schema'
            && sent.body.response_format.json_schema.strict === true
            && typeof sent.body.response_format.json_schema.schema === 'object',
        `type=${ sent.body.response_format.type }` );

    check( '🎯 WIRE  response_format is NEVER json_object, which this host answers with HTTP 400',
        sent.body.response_format.type !== 'json_object' );

    check( 'WIRE  additionalProperties is false, as strict mode requires',
        sent.body.response_format.json_schema.schema.additionalProperties === false );

    // 🚩 THE BIPOLAR RANGE MUST BE IN THE SCHEMA, NOT ONLY IN THE PROMPT. The constrained decoder
    // sees the grammar; a range stated only in the system message is a range the sampler never
    // reads. This is the clause that would have caught the [0,1] arousal defect.
    const arousal = sent.body.response_format.json_schema.schema.properties.arousal;
    check( '🎯 WIRE  arousal carries minimum -1 in the SCHEMA, not only in the prompt',
        arousal.minimum === -1 && arousal.maximum === 1,
        `minimum=${ arousal.minimum } maximum=${ arousal.maximum }` );

    check( '🎯 WIRE  the schema description names the negative half explicitly',
        /NEGATIVE/.test( arousal.description ), arousal.description );

    check( 'WIRE  the system prompt states the bipolar range',
        /-1 TO \+1/.test( PAD_SYSTEM_PROMPT ) && /LOW-ENERGY STATES MUST BE NEGATIVE/.test( PAD_SYSTEM_PROMPT ) );

    check( 'WIRE  the system prompt is the first message and the utterance is last',
        sent.body.messages[ 0 ].role === 'system'
            && sent.body.messages[ sent.body.messages.length - 1 ].role === 'user' );

    check( 'WIRE  temperature is the research doc\'s 0.2', sent.body.temperature === 0.2 );

    // History is inserted BETWEEN system and the new utterance, so the model reads the turn in
    // context. "fine." after an apology is a different affect from "fine." after an insult.
    const withHistory = stubFetch( { message: reasoningMessage( GOOD ) } );
    await clientWith( withHistory ).appraise( 'Fine.', {
        history: [ { role: 'user', content: 'I am sorry.' }, { role: 'assistant', content: 'Thank you.' } ]
    } );
    const messages = withHistory.calls[ 0 ].body.messages;
    check( '🎯 WIRE  history is inserted between the system prompt and the new utterance',
        messages.length === 4 && messages[ 1 ].content === 'I am sorry.'
            && messages[ 3 ].content === 'Fine.',
        messages.map( ( m ) => m.role ).join( ' -> ' ) );
}

// --- TRANSPORT -----------------------------------------------------------------------------------

{
    const http400 = await clientWith( stubFetch( { status: 400 } ) ).appraise( 'anything' );
    check( '🎯 TRANSPORT  a non-2xx becomes REFUSAL.HTTP, never an exception (finding 3\'s 400)',
        http400.ok === false && http400.reason === REFUSAL.HTTP, http400.detail );

    const thrown = await clientWith( stubFetch( { throws: new Error( 'ECONNREFUSED' ) } ) )
        .appraise( 'anything' );
    check( 'TRANSPORT  a thrown fetch becomes REFUSAL.TRANSPORT',
        thrown.ok === false && thrown.reason === REFUSAL.TRANSPORT, thrown.detail );

    const noMessage = await clientWith( stubFetch( { message: null } ) ).appraise( 'anything' );
    check( 'TRANSPORT  a 200 with no choices becomes REFUSAL.NO_CHANNEL',
        noMessage.ok === false && noMessage.reason === REFUSAL.NO_CHANNEL );

    const notJson = await clientWith( stubFetch( {
        message: { content: '', reasoning_content: 'I think the user is angry.' }
    } ) ).appraise( 'anything' );
    check( 'TRANSPORT  prose in the channel becomes REFUSAL.UNPARSEABLE, which is what trinity-mini did',
        notJson.ok === false && notJson.reason === REFUSAL.UNPARSEABLE, notJson.detail );

    const degenerate = await clientWith( stubFetch( {
        message: reasoningMessage( { ...GOOD, pleasure: 0, arousal: 0, dominance: 0 } )
    } ) ).appraise( 'anything' );
    check( '🎯 TRANSPORT  a schema-VALID but meaningless vector is still refused',
        degenerate.ok === false && degenerate.reason === REFUSAL.DEGENERATE_ZERO );

    // Refusals are counted by reason so a session can say WHY tier 2 was quiet.
    const counting = clientWith( stubFetch( { status: 500 } ) );
    await counting.appraise( 'a' );
    await counting.appraise( 'b' );
    check( 'TRANSPORT  refusals are counted by reason',
        counting.report().refusals[ REFUSAL.HTTP ] === 2 && counting.report().calls === 2,
        JSON.stringify( counting.report().refusals ) );

    // An empty utterance is a CALLER error, not a model failure, and must not be laundered into a
    // refusal that reads as the model being unavailable.
    let threw = false;
    try { await clientWith( stubFetch() ).appraise( '   ' ); } catch { threw = true; }
    check( '🎯 TRANSPORT  an empty utterance THROWS rather than becoming a silent refusal', threw );

    const success = await clientWith( stubFetch( { message: reasoningMessage( GOOD ) } ) )
        .appraise( 'anything' );
    check( 'TRANSPORT  a good call reports the channel it arrived in',
        success.ok === true && success.channel === 'reasoning_content' );
}

// --- TIMEOUT -------------------------------------------------------------------------------------

{
    // 🚩 A STUB THAT NEVER SETTLES. Every other clause in this file passes against a client whose
    // AbortController is wired to nothing, because every other stub resolves on its own. This is
    // the only clause that can see a hang, and a hung tier 2 holds a conversation still.
    // ⚠️ AND THE CALL IS ITSELF RACED AGAINST A WATCHDOG, because of what this clause did when it
    // was first proved red. Deleting the `controller.abort()` from the client made this section
    // HANG rather than fail: `run-selftests.sh` would have stalled on it forever instead of
    // printing a red line. A gate that catches a defect by never returning has caught it in the
    // worst available way — the suite reads as "still running", not as "broken" — so the wait is
    // bounded here at 5x the client's own deadline and a breach is reported as a FAIL with the word
    // `watchdog` in it.
    const timeoutMs = 120;
    const WATCHDOG_MS = timeoutMs * 5;
    const started = Date.now();
    const hung = await Promise.race( [
        clientWith( stubFetch( { hang: true } ), { timeoutMs } ).appraise( 'anything' ),
        new Promise( ( resolve ) => setTimeout(
            () => resolve( { ok: false, reason: 'watchdog', detail: `no answer in ${ WATCHDOG_MS } ms` } ),
            WATCHDOG_MS ) )
    ] );
    const elapsed = Date.now() - started;

    check( '🎯 TIMEOUT  a stub that never settles becomes REFUSAL.TIMEOUT rather than hanging',
        hung.ok === false && hung.reason === REFUSAL.TIMEOUT,
        hung.reason === 'watchdog'
            ? `🚩 WATCHDOG FIRED at ${ elapsed } ms — the client's AbortController did not abort, so `
              + 'this call would never have returned and the suite would have stalled here.'
            : `${ elapsed } ms` );

    // Measured, not assumed: the abort has to fire at about the deadline. A 10x band is wide enough
    // for a loaded CI machine and narrow enough to catch a timeout wired to the wrong duration.
    check( '🎯 TIMEOUT  it fires at about timeoutMs, measured',
        elapsed >= timeoutMs * 0.5 && elapsed <= timeoutMs * 10,
        `${ elapsed } ms against a ${ timeoutMs } ms deadline` );

    check( 'TIMEOUT  the per-utterance default is well under the 22.285 s cold load',
        TIMEOUT_MS < 22285,
        `${ TIMEOUT_MS } ms — a cold model must time out into tier 1, not freeze the conversation` );

    let badTimeout = false;
    try { clientWith( stubFetch(), { timeoutMs: 0 } ); } catch { badTimeout = true; }
    check( 'TIMEOUT  a non-positive timeout throws at construction', badTimeout );
}

// --- LIVE ----------------------------------------------------------------------------------------

const live = [];

{
    // Reachability first, on a short deadline, so a machine with no LM Studio spends 1 s here.
    let reachable = false;

    try {

        const controller = new AbortController();
        const timer = setTimeout( () => controller.abort(), 1500 );
        const response = await fetch( `${ DEFAULT_ENDPOINT }/v1/models`, { signal: controller.signal } );
        clearTimeout( timer );
        reachable = response.ok;

    } catch { reachable = false; }

    if ( reachable === false ) {

        live.push( 'SKIP — no LM Studio at ' + DEFAULT_ENDPOINT + '. The offline sections above are'
            + ' the gate; this section is a probe.' );

    } else {

        const client = new LMStudioClient( { primaries: PRIMARIES, timeoutMs: 30000 } );
        const result = await client.appraise( 'That is the third time you have ignored me. I am done asking nicely.' );

        if ( result.ok === true ) {

            live.push( `channel=${ result.channel } latency=${ result.latencyMs.toFixed( 0 ) }ms `
                + `P=${ result.value.pleasure } A=${ result.value.arousal } D=${ result.value.dominance } `
                + `primary=${ result.value.primary }` );

            // The one substantive live claim, and it is the claim tier 2 exists to make: an angry
            // utterance separates from a fearful one on DOMINANCE. Asserted on sign, not magnitude,
            // because magnitude is a calibration question this gate does not own.
            check( '🎯 LIVE  the anger utterance returns negative pleasure and positive dominance',
                result.value.pleasure < 0 && result.value.dominance > 0,
                `P=${ result.value.pleasure } D=${ result.value.dominance }` );

            // Finding 1 as a MEASUREMENT of this run rather than as a constant this file asserts.
            live.push( result.channel === 'reasoning_content'
                ? 'finding 1 HOLDS on this host — the payload arrived in reasoning_content'
                : '🚩 finding 1 NO LONGER HOLDS — the payload arrived in content. That is not a '
                  + 'failure; it means LM Studio fixed the channel split and the fallback order '
                  + 'in readCompletionChannel is now the load-bearing half.' );

        } else {

            check( 'LIVE  the reachable host returned a usable vector', false,
                `refused: ${ result.reason } — ${ result.detail }` );

        }

    }
}

// --- results -------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( `\nendpoint: ${ DEFAULT_ENDPOINT }   model: ${ DEFAULT_MODEL }\n` );
process.stdout.write( `primaries derived from ExpressionMap.WASABI_ANCHORS: ${ PRIMARIES.length } + neutral\n\n` );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

for ( const line of live ) process.stdout.write( `\nLIVE    ${ line }\n` );

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
