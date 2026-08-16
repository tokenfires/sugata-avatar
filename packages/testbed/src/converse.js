/**
 * converse — punch-list 7.3, "testbed wired to LM Studio for live conversation".
 *
 * Type a sentence. The avatar appraises it, feels it, answers it, and speaks the answer with a face
 * and a body that had already moved before the answer arrived. It is the only page in the testbed
 * that runs the WHOLE brief at once — R6 (text drives the face), R7 (a one-call runtime API), Phase
 * 5 (PAD, expression, posture) and 5.3 (the two-tier appraisal) — and it is deliberately the only
 * page that OWNS none of them: every subsystem here is reached through `Avatar.create()` and the two
 * affect tiers through `LMStudioClient` and `AppraisalAffect`, which already exist and are already
 * gated. What this file contributes is the reply call, the ordering, and the readout.
 *
 *     const avatar = await Avatar.create( { canvas } );
 *
 * That single call is the acceptance gate for 7.1 and it is the first executable statement of
 * `boot()` below, unwrapped. If this page renders, that claim is true on real hardware.
 *
 *
 * 🚩 A TURN IS FOUR STEPS AND THE ORDER IS THE MOST LOAD-BEARING THING ON THIS PAGE
 * ---------------------------------------------------------------------------------
 *   1. **Tier 1, synchronously, before any await** — `ReflexAffect` over the text you typed, pushed
 *      through `avatar.feel()`. The face has an opinion the instant the words exist, so the second
 *      the model spends thinking is spent watching a figure that already reacted.
 *   2. **The reply call** — measured median 388 ms.
 *   3. **`avatar.say( reply )`** — which starts the mouth AND pushes its own tier-1 estimate.
 *   4. **Tier 2 last** — `AppraisalAffect.appraise()`, measured median 625 ms.
 *
 * Steps 2 and 4 are two independent network calls and issuing them in PARALLEL measured
 * 768/820/1292 ms min/median/max wall (n=5). **They are still run in sequence — measured
 * 1027/1089/1106 ms through the code below, also n=5 — and the ~0.2 s is bought deliberately**,
 * because of this:
 *
 * 🎯 **`Avatar.say()` PUSHES ITS OWN TIER-1 ESTIMATE OF THE REPLY TEXT AT CONFIDENCE 1**
 * (`Avatar.js:925-929`, synchronously, before it returns its promise). Run against the seventeen
 * replies this host actually produced during the measurements below, **12 of 17 (71%) carried a
 * lexicon hit and would therefore overwrite tier 2's pleasure outright.** The worst case is not
 * marginal: on the anger turn, tier 2 read **anger 0.80, P -0.80 A +0.70 D +0.60** from what was
 * heard, and the reply *"I apologize for missing you earlier, I am fully focused on our conversation
 * now"* reads **P -0.49 D -0.25 at confidence 1**.
 *
 * 🚩 **AND THE ORDER IS WORTH THAT 0.2 s, MEASURED RATHER THAN ASSERTED.** One live appraisal,
 * replayed arithmetically into two identical `AffectState`s with the three writes of a turn in the
 * two possible orders — so the ONLY difference between them is the order. From
 * tier 1 `P -0.42 conf 1 · D +0.40 conf 0.25`, `say()` `P -0.49 conf 1 · D -0.25 conf 0.25`, and
 * tier 2 `anger 0.80 · P -0.80 A +0.70 D +0.60` at its derived weights `P 0.50 A 1.00 D 0.80`:
 *
 *     tier 1 -> say() -> tier 2   (this page)   P -0.647  A +0.700  D +0.482
 *     tier 1 -> tier 2 -> say()   (the defect)  P -0.494  A +0.700  D +0.313
 *                                               ΔP 0.153            ΔD 0.170
 *
 * ⚠️ The model is stochastic and a re-run returns a slightly different dominance — a second run read
 * D +0.65 and moved the pair to +0.522 / +0.343, ΔD 0.180. The DELTAS are the claim; the arithmetic
 * above reproduces exactly from the four stated inputs, which is what makes the table checkable
 * without the host.
 *
 * The defect order is the avatar finishing an angry turn a third of the way back toward the
 * sentiment of its own apology. ⚠️ Arousal is identical in both because `say()`'s estimate has no
 * arousal confidence to push with — which is the same "arousal lives in the acoustics" hole that
 * makes tier 2 the only source of that axis on this page.
 *
 * The reply is the faster of the two calls in every measured pair (388 ms against 625 ms median), so
 * running them in parallel would USUALLY produce the right order. "Usually" is not an order. Tier 2
 * is the considered estimate and 5.3's whole purpose is that it replaces tier 1's stopgaps, so it is
 * made the LAST write of a turn by sequencing rather than by hoping.
 *
 *
 * 🎯 WHICH TEXT THE FACE COMES FROM, DECIDED BY MEASUREMENT AND NOT BY ARGUMENT
 * ----------------------------------------------------------------------------
 * Two candidates, and the choice changes everything the page demonstrates: appraise what was
 * **HEARD** (the avatar mirrors what you brought it) or what is about to be **SPOKEN** (the avatar
 * feels its own words). Both were run on the same five utterances against the live host on
 * 2026-08-16, `qwen/qwen3.6-35b-a3b`, one appraisal each way per turn:
 *
 *   | you said                             | HEARD                                  | SPOKEN                          |
 *   |--------------------------------------|----------------------------------------|---------------------------------|
 *   | "…third time you have ignored me…"   | P -1.00 A +0.80 D **+0.95** anger 0.85 | **REFUSED degenerate-zero**     |
 *   | "I got the job! I actually got it!"  | P +0.90 A +0.80 D +0.75 joy 0.85       | P +0.90 A +0.80 D +0.25 joy     |
 *   | "I do not know. Nothing much…"       | REFUSED degenerate-uniform             | P +0.10 A +0.20 D +0.35 neutral |
 *   | "Something moved behind me…"         | P -0.80 A +0.70 D **-0.60** fear 0.80  | P 0.00 A +0.50 D +0.50 neutral  |
 *   | "Hello there. What are you?"         | P 0.00 A 0.00 D +0.25 neutral          | P +0.50 A +0.20 D +0.10 neutral |
 *
 * HEARD wins and it is not close: anger 0.85, joy 0.85, fear 0.80, against SPOKEN's `neutral` on
 * three of five and a `degenerate-zero` refusal on the one turn with the strongest affect in it. The
 * cause is not subtle — an assistant reply is written to be even-tempered, so appraising it means
 * appraising the flattest text in the conversation.
 *
 * 🎯 And the HEARD column reproduces this repository's own dominance claim live, on this page's own
 * path and from a model nobody tuned for it: anger **+0.95** against fear **-0.60** at comparable
 * pleasure and identical arousal sign. That is `LMStudioClient`'s finding (b) and `PostureLayer`'s
 * entire reason for existing.
 *
 * ⚠️ So this page is an EMPATHIC MIRROR and says so in the transcript. It is a modelling choice, it
 * is the one the punch-list line describes ("the avatar appraises it, feels it"), and the losing
 * side stays reachable at `?mirror=spoken` so the table can be re-run rather than believed.
 *
 *
 * 🎯 THE TIER READOUT IS THE POINT OF THE HUD, AND TIER 1 BEING SILENT IS A FINDING
 * --------------------------------------------------------------------------------
 * On those same five utterances `ReflexAffect.estimate({ text })` matched **1 of 14** lexicon tokens
 * on the anger utterance and **0 tokens on the other four**, so `confidence.pleasure` was 0 and
 * `AffectState.push` correctly moved NOTHING four times out of five.
 *
 * That is not this page failing. `SeedLexicon`'s own provenance says it: *"Authored, not measured.
 * Load VADER's MIT lexicon for production accuracy."* So the HUD prints the lexicon hit count beside
 * the tier, because "tier 1 ran and declined to have an opinion" and "tier 1 was never wired up" are
 * the same picture and completely different bugs.
 *
 * The other half of the same instrument: **2 refusals in 10 appraisals** (`degenerate-zero`,
 * `degenerate-uniform`) across that session. research/lm-studio-integration.md's rule is *"on any
 * rejection, keep Tier 1's value and log — never let a bad Tier 2 result snap the face"*, and
 * `AppraisalAffect` is where that is enforced; this page is where it is VISIBLE. The transcript
 * prints the reason code and the face does not move.
 *
 *
 * WHY TIER 2 DOES NOT GO THROUGH `avatar.feel()`
 * ---------------------------------------------
 * `feel( { pleasure, arousal, dominance } )` pushes at confidence 1 — it replaces the axes outright.
 * That is right for a caller SAYING what the avatar feels and wrong for an ESTIMATOR, and
 * `AppraisalAffect` exists for exactly that distinction: it derives the per-axis blend weight as
 * `1 / ( 1 + tier1Confidence[axis] )`, so a lexicon-backed pleasure pools at 0.5 and a dominance
 * tier 1 had no marker for is handed over at 1.0. Writing that arithmetic again here would be a
 * second copy of a measured rule.
 *
 * Both rows of that rule were observed live through this file: an utterance where tier 1 DID match a
 * lexicon word produced weights **P 0.50 · A 1.00 · D 0.80**, and the four where it matched nothing
 * produced **1.00 · 1.00 · 1.00** — tier 2 taking every axis, because tier 1 declared no evidence on
 * any of them.
 *
 * ⚠️ It needs the `AffectState` tier 1 also pushes into, and the only handle on that is
 * `avatar.affectState` — a public field, but not one `report()` or the API contract mentions. Filed
 * as a request: `Avatar` has no way to accept an estimator, only an assertion.
 *
 *
 * WHAT WAS MEASURED FOR THE REPLY CALL, BECAUSE IT IS A WIRE CALL THIS FILE OWNS
 * -----------------------------------------------------------------------------
 * `LMStudioClient` is the transport for AFFECT and has no chat verb, so the reply call is written
 * here — and held to the same standard as if it were in that file. Same host, same model,
 * 2026-08-16, twelve schema-constrained reply calls:
 *
 *   - **Finding 1 reproduces exactly for a second schema: 12 of 12 replies arrived in
 *     `reasoning_content` with `content` an empty string.** So `readCompletionChannel` is IMPORTED
 *     from `LMStudioClient` rather than reimplemented — one channel-reading rule, in one place.
 *   - **Completion tokens 11–26**, median 22, `finish_reason: stop` every time. That is what sizes
 *     `REPLY_MAX_TOKENS`.
 *   - **Warm latency 196–584 ms**, median 388 — faster than an appraisal, because the reply schema
 *     is one string and the affect schema is five constrained numbers.
 *   - 🚩 **The first reply call of a process cost 9,977 ms with the model already resident.** That
 *     is NOT the 22.285 s weight load `LMStudioClient` documents; it is a second, separate
 *     first-call cost, and a page that warms only the affect schema still pays it on the user's
 *     first sentence. Both schemas are warmed at boot — see `warmBothSchemas`.
 *
 *
 * WHAT A LIVE RUN OF THIS FILE ACTUALLY DID
 * -----------------------------------------
 * `createConversation()` driven headless against the host in the four-step order, two sessions of
 * five turns each, on the same five utterances:
 *
 *   A. warm-up 1,154 ms · replies 327–420 ms, 17–23 completion tokens · turns 940 / 1008 / 2671 ms ·
 *      **tier 2 applied 3, refused 2** — `degenerate-zero` on "Hello there. What are you?", the
 *      guard doing its job on a genuinely neutral utterance, plus one `unparseable`.
 *   B. warm-up 1,216 ms · replies 376–445 ms, 20–27 tokens · turns 1027 / 1089 / 1106 ms ·
 *      **tier 2 applied 5, refused 0** — anger 0.80, joy 0.85, fear 0.95, bored 0.60, neutral 0.10.
 *
 * `reasoning_content` on 10 of 10 replies across both.
 *
 * ⚠️ Session A's `unparseable` is worth recording, because it is not a transport failure and it is
 * not this page's. The affect completion came back as
 * `{"pleasure": -1, "arousal": 0.8, "dominance": 0.99999999999999…}` — the constrained decoder ran
 * away on the nines and hit `LMStudioClient`'s own `max_tokens: 200` mid-number, so a VALID
 * appraisal arrived truncated and unparseable. It is the whole of the 2,671 ms outlier. Filed as an
 * observation against `LMStudioClient.js`; the face was unaffected, because a refusal keeps tier 1.
 *
 *
 * AND IT WAS LOOKED AT, WHICH IS THE ONLY CHECK THAT COUNTS FOR A PAGE
 * -------------------------------------------------------------------
 * LEARNINGS §1.2. Two turns in a real browser, WebGPU, tier `high`, through the `/lmstudio` proxy:
 *
 *   *"That is the third time you have ignored me…"* → `anger 0.80` · PAD `-0.38 / +0.70 / +0.49` ·
 *   mood `hostile` · face `angry 0.367` · body **approach +6.95°, armSpread -14.80°** — the figure
 *   leans in with its arms clamped to its sides.
 *
 *   *"I got the job! I actually got it! I am so happy right now!"* → `joy 0.85` · PAD
 *   `+0.95 / +0.80 / +0.47` · mood `exuberant` · face `happy 0.750 SAT` · body **armSpread +21.20°,
 *   headTiltUp +15.00°** — chin up, arms open.
 *
 * Two sentences, two visibly different bodies, and dominance is what separated them. Both turns hit
 * the seed lexicon, so both read weights `P 0.50 A 1.00 D 0.80` in the HUD — the pooled row. The
 * `1.00 / 1.00 / 1.00` row is the one the headless sessions above show, on the four utterances where
 * tier 1 matched nothing at all.
 *
 *
 * TWO MORE TRAPS
 * --------------
 * 🚩 **TIER 2's `primary` NEVER DRIVES `feel( label )`.** `Avatar.feel( 'joy' )` does two things —
 * triggers the emotion AND pushes that emotion's anchor — and `LMStudioClient`'s finding (c)
 * measured the label and the vector DISAGREEING on a happy utterance. The vector is the one to
 * trust. `AppraisalAffect` is constructed with `triggerPrimary` left at its default `false` and
 * `primary` is printed in the transcript and nowhere else. A page that switched on `primary` would
 * have put a discrete-emotion model underneath a dimensional one.
 *
 * 🚩 **CORS: LM STUDIO CANNOT BE REACHED DIRECTLY FROM A PAGE.** Measured and recorded in both
 * `vite.config.js` and `LMStudioClient.js` — no `Access-Control-Allow-Origin` on any response, and
 * HTTP 400 on the preflight. The dev server proxies `/lmstudio`, which makes the call same-origin so
 * no preflight is ever sent. `defaultEndpointFor()` is imported rather than a path being typed here,
 * so this page and that proxy cannot disagree about the string. ⚠️ **A BUILT page has no dev server
 * and therefore no proxy.** `npm run build:pages` compiles this file, and the compiled page fails
 * every call unless it is served behind an equivalent proxy or a CORS-enabled gateway.
 *
 *
 * ⚠️ THE MOUTH IS THE ONE THING THIS PAGE CANNOT DO HONESTLY
 * ----------------------------------------------------------
 * `Avatar.say( text )` drives the face and the body from text alone and CANNOT drive the mouth,
 * because a viseme timeline comes out of a TTS engine and punch-list **4.3** (`voice/Speech.js`) is
 * the item that produces one. Deriving a timeline from letters means typing a speaking rate into
 * this file, and PUNCHLIST 4.2 states that `docs/research/` carries no speaking-rate or
 * phoneme-duration figure at all and that one has to be MEASURED first.
 *
 * So the composer's checkbox hands `say()` the SYNTHETIC canned timeline that `voice.js` and
 * `affect.js` already share: the mouth moves, for 0.985 s, in shapes that have nothing to do with
 * the words, and the HUD says so on every frame it is on. Turn it off and the mouth is still and
 * `report().speech.timelineSupplied` reads false, which is the honest state of the feature today.
 *
 * ⚠️ And prosody is absent for the same reason one step further out. `say()` takes `prosody`
 * readings and `ReflexAffect` maps them to the AROUSAL axis — *"valence lives in the text, arousal
 * lives in the acoustics"* — but readings come from `voice/Prosody.js` analysing real audio, and
 * there is no audio here to analyse. **Every non-zero arousal on this page comes from tier 2**,
 * which is a real answer to that sentence rather than a workaround: with no acoustics, the language
 * model is the only estimator of arousal on the page.
 *
 *
 * URL parameters
 *
 *   ?gender=0.5     which bake, 0 masculine to 1 feminine.
 *   ?quality=high   'auto' | 'high' | 'balanced' | 'fallback'. See `QUALITY_TIERS`.
 *   ?frame=portrait 'portrait' | 'body'. The body frame is where the posture channel is legible.
 *   ?seed=20260807  motion seed.
 *   ?model=…        an LM Studio model id. ⚠️ The host lists several BUILDS of the same weights with
 *                   their own latencies; sending a different id is a change of model.
 *   ?mirror=spoken  appraise the reply instead of the utterance — the losing side of the table.
 *   ?ownclock       take the frame loop off the avatar — see `startOwnClock`. Needed in a pane
 *                   that performs no layout; measured to be needed, not assumed.
 *   ?bare           hide the HUD, the transcript and the composer, for a clean plate.
 */

import { Avatar } from '../../core/src/Avatar.js';

import { AppraisalAffect } from '../../core/src/affect/AppraisalAffect.js';
import { ANCHOR_SETS } from '../../core/src/affect/ExpressionMap.js';
import { ReflexAffect } from '../../core/src/affect/ReflexAffect.js';
import {
    DEFAULT_MODEL,
    LMStudioClient,
    REFUSAL,
    TIMEOUT_MS,
    WARM_TIMEOUT_MS,
    defaultEndpointFor,
    readCompletionChannel
} from '../../core/src/affect/LMStudioClient.js';

/**
 * What the avatar is told it is.
 *
 * Every clause is here because of something the model did without it. "ONE short spoken sentence"
 * and the word cap are what hold a reply in a face-to-face register instead of an essay; "no stage
 * directions, no emoji, no markdown" is because a reply containing `*smiles warmly*` is a reply the
 * viseme layer would be asked to pronounce.
 *
 * ⚠️ Twenty-five words is a POLICY, not a measurement — it is the length that reads as speech rather
 * than as prose. It is stated in the prompt and bounded again by the schema's `maxLength`, because a
 * constrained decoder only ever sees the schema.
 */
export const REPLY_SYSTEM_PROMPT = [
    'You are an embodied avatar in a face-to-face conversation. You have a face, a voice and a body,',
    'and the person can see you.',
    '',
    'Reply in ONE short spoken sentence, at most 25 words, as if speaking aloud.',
    'No stage directions, no emoji, no markdown, no lists.'
].join( '\n' );

/**
 * The reply schema.
 *
 * 🚩 THE SCHEMA IS NOT OPTIONAL AND IT IS NOT A STYLE CHOICE. `LMStudioClient`'s finding 2: thinking
 * cannot be disabled through the API, all four documented routes were tried, and unconstrained the
 * model reasons past 1199 tokens and never answers. A grammar is what makes it stop reasoning and
 * emit. There is no unconstrained call on this page, for the same reason there is none in that file.
 *
 * `strict: true` with `additionalProperties: false` because finding 3 measured
 * `response_format: {type:'json_object'}` returning HTTP 400 on this host — only the full
 * `json_schema` form works.
 */
export const REPLY_SCHEMA = Object.freeze( {
    type: 'object',
    additionalProperties: false,
    required: [ 'reply' ],
    properties: {
        reply: {
            type: 'string',
            maxLength: 220,
            description: 'One short spoken sentence, at most 25 words. Speech, not prose.'
        }
    }
} );

/**
 * The generation ceiling.
 *
 * Measured over twelve reply calls: 11–26 completion tokens including reasoning tokens, median 22,
 * and `finish_reason` was `stop` every time. 300 is **11.5x the largest measured completion**.
 *
 * The headroom is the point rather than the thrift. A generation cut off at the ceiling returns
 * `finish_reason: 'length'` and a truncated JSON fragment, which arrives here as `TRUNCATED` — a
 * refusal, on a turn somebody is waiting for. Erring high costs nothing when nothing reaches it.
 */
export const REPLY_MAX_TOKENS = 300;

/**
 * ⚠️ **NO `temperature` IS SENT ON THE REPLY CALL, DELIBERATELY.**
 *
 * `LMStudioClient` sends 0.2 and cites the research doc for it — correct there, because affect
 * inference is not a creative task. A conversational reply is a different job and 0.2 is the wrong
 * number for it; but this repository has no measurement of what the right one would be, and a number
 * typed into this file would be a claim with no gate on it. Omitting the field lets the host's own
 * default apply, which is the only honest option available: the page then states no temperature at
 * all rather than stating one nobody measured.
 *
 * What would settle it: reply quality rated against a fixed prompt set across a temperature sweep.
 * Until then this constant exists to hold the reasoning where the next reader will look for it.
 */
export const REPLY_TEMPERATURE = null;

/**
 * Per-reply ceiling, shared with `LMStudioClient`'s own per-utterance timeout rather than restated.
 *
 * 4000 ms is 6.8x the slowest warm reply measured (584 ms) and is deliberately BELOW the 9,977 ms
 * first-call cost, for exactly the reason that file gives for its own value: a cold call must time
 * out into "tier 1 held" rather than hold a conversation still, and the warm-up is the supported way
 * to pay that cost once, up front, where it is invisible.
 */
export const REPLY_TIMEOUT_MS = TIMEOUT_MS;

/**
 * How many prior messages travel with a turn.
 *
 * ⚠️ A POLICY, not a measurement. Context makes both halves better — "fine." means different things
 * after an apology and after an insult, which is why `LMStudioClient.appraise` takes `history` at
 * all — and an unbounded transcript makes every turn slower than the last for no gain anybody has
 * measured. Twelve messages is six turns: a conversation somebody is having rather than reading back.
 */
export const HISTORY_MESSAGE_CAP = 12;

/**
 * The refusal vocabulary, extended rather than mirrored.
 *
 * `LMStudioClient`'s `REFUSAL` is spread in rather than copied, so a reply refusal and an appraisal
 * refusal share codes where they share causes and one session's refusals can be counted in one
 * table. The two new codes are the two failures only a reply can have: a generation that hit the
 * token ceiling, and one that parsed and validated to an empty string.
 */
export const REPLY_REFUSAL = Object.freeze( {
    ...REFUSAL,
    TRUNCATED: 'truncated',
    EMPTY: 'empty-reply'
} );

/**
 * The synthetic mouth, and it IS synthetic — see the mouth section of the header.
 *
 * Lifted verbatim from `affect.js:99-109`, which is itself the canonical-OVR form of the
 * alias-exercising timeline at `voice.js:83-94`. 0.985 s, nine entries, and not a transcription of
 * anything: no part of it was derived from the words it will be played under. It exists so the
 * viseme layer can be seen running under a live expression, and the HUD labels it whenever it is on.
 */
const CANNED_TIMELINE = Object.freeze( [
    { viseme: 'sil', startTime: 0.000, duration: 0.080 },
    { viseme: 'viseme_PP', startTime: 0.080, duration: 0.070 },
    { viseme: 'viseme_aa', startTime: 0.150, duration: 0.110 },
    { viseme: 'viseme_nn', startTime: 0.260, duration: 0.045 },
    { viseme: 'viseme_aa', startTime: 0.350, duration: 0.140 },
    { viseme: 'viseme_E', startTime: 0.490, duration: 0.040 },
    { viseme: 'viseme_FF', startTime: 0.530, duration: 0.075 },
    { viseme: 'viseme_O', startTime: 0.605, duration: 0.260 },
    { viseme: 'sil', startTime: 0.865, duration: 0.120 }
] );

/** The HUD reads `report()`, which walks the scene graph for its census. Ten times a second, not sixty. */
const HUD_INTERVAL_MS = 100;

/**
 * How long `?ownclock` watches `requestAnimationFrame` before deciding it is not coming.
 *
 * 250 ms, matching `affect.js:396` so two pages in the same testbed do not disagree about what
 * "rAF is not firing" means. At a healthy 60 Hz that is fifteen frames; the test is `>= 2`.
 */
const RAF_PROBE_MS = 250;

/**
 * The floor on the fallback loop's frame interval.
 *
 * `frame-clock.js` measured its `MessageChannel` macrotask at **553,921 callbacks per second**,
 * which is a spin loop rather than a frame loop. Punch-list **8.3** states this project's target as
 * 60 fps, so that is the rate the fallback aims at rather than a number chosen here.
 */
const OWN_CLOCK_MIN_FRAME_SECONDS = 1 / 60;

// --- the reply call ------------------------------------------------------------------------

/**
 * One schema-constrained reply, as a RESULT OBJECT.
 *
 * Shaped after `LMStudioClient.appraise` on purpose and for its stated reason: a refusal is an
 * EXPECTED outcome on the normal path — the host is busy, the model is not loaded, the answer came
 * back truncated — and an expected outcome that travels as an exception gets caught by whichever
 * `try` happens to be nearest. Every failure here is a reason code a transcript line can print and a
 * session can count.
 *
 * @param {Object} request
 * @param {string} request.endpoint - Origin, or a same-origin path. See the CORS trap.
 * @param {string} [request.model=DEFAULT_MODEL]
 * @param {Array<{role: string, content: string}>} request.messages - System prompt included.
 * @param {number} [request.timeoutMs=REPLY_TIMEOUT_MS]
 * @param {Function} [request.fetchImpl=globalThis.fetch] - Injected so this is drivable with no
 *   browser, which is how it was measured.
 * @returns {Promise<{ok: true, reply: string, latencyMs: number, channel: string, tokens: number}
 *                  |{ok: false, reason: string, detail: string, latencyMs: number}>}
 */
export async function requestReply( request ) {

    const {
        endpoint,
        model = DEFAULT_MODEL,
        messages,
        timeoutMs = REPLY_TIMEOUT_MS,
        fetchImpl = globalThis.fetch?.bind( globalThis )
    } = request;

    if ( typeof fetchImpl !== 'function' ) {

        throw new TypeError( 'requestReply: no fetch available. Pass request.fetchImpl.' );

    }

    if ( Array.isArray( messages ) === false || messages.length === 0 ) {

        throw new TypeError( 'requestReply: messages must be a non-empty array of { role, content }.' );

    }

    const started = nowMs();
    const controller = new AbortController();
    const timer = setTimeout( () => controller.abort(), timeoutMs );

    const refuse = ( reason, detail ) => ( {
        ok: false,
        reason,
        detail: String( detail ?? '' ),
        latencyMs: nowMs() - started
    } );

    try {

        const body = {
            model,
            max_tokens: REPLY_MAX_TOKENS,
            messages,
            response_format: {
                type: 'json_schema',
                json_schema: { name: 'reply', strict: true, schema: REPLY_SCHEMA }
            }
        };

        // Omitted entirely rather than sent as null. See REPLY_TEMPERATURE.
        if ( REPLY_TEMPERATURE !== null ) body.temperature = REPLY_TEMPERATURE;

        const response = await fetchImpl( `${ endpoint.replace( /\/+$/, '' ) }/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify( body )
        } );

        if ( response.ok === false ) return refuse( REPLY_REFUSAL.HTTP, `HTTP ${ response.status }` );

        const payload = await response.json();
        const choice = payload?.choices?.[ 0 ] ?? null;

        // Checked BEFORE parsing, because a truncated generation is often still parseable JSON with
        // a clipped string, and "the model was cut off" is a different repair from "the model
        // emitted rubbish" — one raises the ceiling, the other is a prompt problem.
        if ( choice?.finish_reason === 'length' ) {

            return refuse( REPLY_REFUSAL.TRUNCATED,
                `hit REPLY_MAX_TOKENS (${ REPLY_MAX_TOKENS }) — raise the ceiling` );

        }

        // 🚩 12 of 12 measured replies arrived in `reasoning_content` with `content` empty. This is
        // `LMStudioClient`'s own reader, imported rather than rewritten: it tries `content` first
        // anyway, so the page stays correct against a non-thinking model and against a future LM
        // Studio that fixes the channel split.
        const channel = readCompletionChannel( choice?.message ?? null );

        if ( channel === null ) {

            return refuse( REPLY_REFUSAL.NO_CHANNEL, 'content and reasoning_content both empty' );

        }

        let parsed;

        try {

            parsed = JSON.parse( channel.text );

        } catch ( error ) {

            return refuse( REPLY_REFUSAL.UNPARSEABLE, channel.text.slice( 0, 120 ) );

        }

        if ( typeof parsed?.reply !== 'string' ) {

            return refuse( REPLY_REFUSAL.SCHEMA, `reply is ${ JSON.stringify( parsed?.reply ) }` );

        }

        const reply = parsed.reply.trim();

        // "A JSON schema guarantees parseable, never meaningful" — the sentence `validateAffect` is
        // built on. An empty string satisfies `type: 'string'` and would be spoken as silence.
        if ( reply === '' ) return refuse( REPLY_REFUSAL.EMPTY, 'the model returned an empty reply' );

        return {
            ok: true,
            reply,
            latencyMs: nowMs() - started,
            channel: channel.channel,
            tokens: payload?.usage?.completion_tokens ?? null
        };

    } catch ( error ) {

        const aborted = error?.name === 'AbortError' || controller.signal.aborted === true;

        return aborted
            ? refuse( REPLY_REFUSAL.TIMEOUT, `${ timeoutMs } ms` )
            : refuse( REPLY_REFUSAL.TRANSPORT, String( error?.message ?? error ) );

    } finally {

        clearTimeout( timer );

    }

}

// --- the conversation ----------------------------------------------------------------------

/**
 * The conversational half of the page, with no DOM and no renderer in it.
 *
 * Separated for the reason this repository separates everything it otherwise could not check.
 * `LMStudioClient`'s own gate is 55 of 55 green under Node's `fetch` and structurally blind to CORS;
 * a turn tangled into a `boot()` is blind to everything. This object is drivable headless against
 * the live host, and that is how every table in the header above was produced.
 *
 * Three verbs rather than one `turn()`, deliberately: the ordering argued for in the header is only
 * enforceable if the caller can put `say()` between two of them, and a fused turn would have to take
 * a callback to allow that. Three sequential lines in `takeTurn` read better than one with a hole
 * in it.
 *
 * @param {Object} options
 * @param {import('../../core/src/affect/AffectState.js').AffectState} options.state - the state tier
 *   1 pushes into, which for a page is `avatar.affectState`. Tier 2 blends into it; it does not own
 *   one.
 * @param {string} [options.endpoint] - `defaultEndpointFor()` by default: the proxy path in a
 *   browser, the direct host in Node. Never a literal — see the CORS trap.
 * @param {string} [options.model=DEFAULT_MODEL]
 * @param {'heard'|'spoken'} [options.mirror='heard'] - which text tier 2 appraises. See the table.
 * @param {Function} [options.fetchImpl]
 * @param {boolean} [options.warmOnConstruction=true]
 */
export function createConversation( options = {} ) {

    const endpoint = options.endpoint ?? defaultEndpointFor();
    const model = options.model ?? DEFAULT_MODEL;
    const mirror = options.mirror ?? 'heard';
    const fetchImpl = options.fetchImpl;

    // 🚩 `primaries` is `ExpressionMap`'s OWN key set and is not authored here. `LMStudioClient`
    // refuses to be constructed without it precisely so a `primary` the schema certifies cannot be
    // one `ExpressionMap.trigger()` would throw on. `ANCHOR_SETS` rather than `WASABI_ANCHORS`,
    // because that is the set `Avatar.feel` validates a label against and the two must agree.
    const client = new LMStudioClient( { endpoint, model, primaries: Object.keys( ANCHOR_SETS ), fetchImpl } );

    // Tier 2's blend, not this page's. `triggerPrimary` is left at its default false — see the
    // `primary` trap. `warmOnConstruction` puts the 22.285 s weight load in flight before this
    // function returns, which is why `warmBothSchemas` only has to add the reply schema.
    const tier2 = new AppraisalAffect( {
        client,
        state: options.state,
        warmOnConstruction: options.warmOnConstruction !== false
    } );

    const reflex = new ReflexAffect();
    const history = [];

    return {

        client,
        tier2,
        reflex,
        history,
        endpoint,
        model,
        mirror,

        /**
         * Tier 1, synchronous, on the caller's thread.
         *
         * Returns rather than pushes, so the page can push it through `avatar.feel()` — the public
         * verb — and so `moved` can be reported. "Ran and declined to have an opinion" and "never
         * ran" are the same picture and different bugs.
         */
        appraiseReflex( text ) {

            const estimate = reflex.estimate( { text } );
            const fromText = estimate.detail.text;

            return {
                estimate,
                moved: estimate.confidence.pleasure > 0 || estimate.confidence.dominance > 0,
                matched: fromText.matched,
                tokens: fromText.tokens
            };

        },

        /**
         * Step 2 — ask the model for something to say.
         *
         * The transcript is appended only on success, because a history containing a turn the
         * avatar never answered would make the model apologise for a silence that was the network's.
         */
        async requestReply( heard ) {

            const messages = [
                { role: 'system', content: REPLY_SYSTEM_PROMPT },
                ...history.slice( -HISTORY_MESSAGE_CAP ),
                { role: 'user', content: heard }
            ];

            const reply = await requestReply( { endpoint, model, messages, fetchImpl } );

            if ( reply.ok === true ) {

                history.push( { role: 'user', content: heard } );
                history.push( { role: 'assistant', content: reply.reply } );

            }

            return reply;

        },

        /**
         * Step 4 — tier 2, and the last write of a turn.
         *
         * `tier1` is forwarded because `AppraisalAffect` derives its per-axis blend weight from it:
         * an axis tier 1 was confident about pools at 0.5, an axis it had no evidence for is handed
         * over at 1.0. Passing nothing would make every axis 0.5 and quietly discard the finding
         * that dominance is tier 2's to take.
         *
         * ⚠️ The history passed is the transcript BEFORE this turn's own reply was appended by
         * `requestReply`, so an appraisal of what was heard is never shown the answer to it.
         */
        async appraise( text, tier1 ) {

            return tier2.appraise( text, {
                history: history.slice( 0, -2 ).slice( -HISTORY_MESSAGE_CAP ),
                tier1
            } );

        },

        /**
         * Pays both first-call costs up front, where nobody is waiting on them.
         *
         * 🚩 TWO WARM-UPS, NOT ONE, AND THAT IS A MEASUREMENT. `AppraisalAffect`'s constructor
         * already covers the 22.285 s weight load. It does NOT cover the reply schema: with the
         * model already resident, the first reply call of a process still measured 9,977 ms against
         * 196–584 ms for every one after it. Warming one schema and not the other just moves the
         * stall from the first sentence to the first sentence.
         *
         * Both results are deliberately ignored beyond reporting: a warm-up that failed validation
         * still warmed the model, which is the only thing it was for.
         */
        async warmBothSchemas() {

            const started = nowMs();

            const [ affect, reply ] = await Promise.all( [
                tier2.warm(),
                requestReply( {
                    endpoint,
                    model,
                    fetchImpl,
                    timeoutMs: WARM_TIMEOUT_MS,
                    messages: [
                        { role: 'system', content: REPLY_SYSTEM_PROMPT },
                        { role: 'user', content: 'Hello.' }
                    ]
                } )
            ] );

            return {
                warmed: affect.warmed === true && reply.ok === true,
                affectReason: affect.reason ?? null,
                replyReason: reply.ok === true ? null : reply.reason,
                latencyMs: nowMs() - started
            };

        }

    };

}

// --- the page ---------------------------------------------------------------------------------

// Guarded so everything above can be driven from Node against the live host with no DOM. Every other
// page in this testbed calls its `boot()` unconditionally and none of them has a wire protocol in
// it; this one does, and a wire protocol nobody can run outside a browser is a wire protocol nobody
// checks.
if ( typeof document !== 'undefined' ) {

    boot().catch( ( error ) => {

        const overlay = document.getElementById( 'boot' );
        const reached = ( window.__SUGATA_CONVERSE_BOOT__ ?? [] ).join( ' -> ' );

        if ( overlay !== null ) overlay.textContent = `failed after [${ reached }]: ${ error.message }`;

        // 🚩 Logged as well as shown. The overlay is removed on the last line of a successful boot,
        // so a failure after that line writes onto an element that is already gone — `affect.js`
        // records the run where that cost an afternoon of looking at "booting…".
        console.error( `converse: boot failed after [${ reached }]`, error );

    } );

}

async function boot() {

    const query = new URLSearchParams( window.location.search );
    const overlay = document.getElementById( 'boot' );
    const stageMarks = [];

    const mark = ( label ) => {

        stageMarks.push( label );
        overlay.textContent = `booting… ${ label }`;
        window.__SUGATA_CONVERSE_BOOT__ = stageMarks;

    };

    mark( 'avatar' );

    const ownsClock = query.has( 'ownclock' );

    // 🎯 THE ACCEPTANCE GATE FOR 7.1, UNWRAPPED. Everything this page shows — the rig, the deferred
    // pipeline, the grade, the occlusion, ten motion layers, the rest pose, the expression and
    // posture pair, the viseme layer — comes out of this one call. The five options are URL
    // parameters and every one of them has a documented default; `autoStart` is the only one that
    // is not, and it is true unless `?ownclock` says otherwise.
    const avatar = await Avatar.create( {
        canvas: document.getElementById( 'stage' ),
        identity: { gender: Number( query.get( 'gender' ) ?? 0.5 ) },
        quality: query.get( 'quality' ) ?? 'auto',
        frame: query.get( 'frame' ) ?? 'portrait',
        seed: Number( query.get( 'seed' ) ?? 20260807 ),
        autoStart: ownsClock === false
    } );

    if ( ownsClock === true ) startOwnClock( avatar );

    mark( 'lm studio' );

    // ⚠️ `avatar.affectState` is the one handle tier 2 needs and the API contract does not name it.
    // See the header; filed as a request rather than worked around, because the alternative — tier 2
    // through `feel()` at confidence 1 — is the thing `AppraisalAffect` exists to prevent.
    const conversation = createConversation( {
        state: avatar.affectState,
        model: query.get( 'model' ) ?? undefined,
        mirror: query.get( 'mirror' ) === 'spoken' ? 'spoken' : 'heard'
    } );

    const session = {
        busy: false,
        turns: 0,

        // What the HUD's tier line reports. Written by exactly one function, `recordTier`, so the
        // readout cannot disagree with what was actually pushed.
        tier: 0,
        tierDetail: 'nothing has been said yet',

        lastReplyMs: null,
        lastAppraisalMs: null,
        lastTurnMs: null,
        warm: 'warming…',

        // Measured between HUD ticks — see `sampleFrameRate` for why not `Stage.fps`.
        fps: 0,
        frameSampleAt: null,
        frameSampleFrame: 0
    };

    const bare = query.has( 'bare' );
    const hud = document.getElementById( 'hud' );
    const transcript = document.getElementById( 'transcript' );
    const input = document.getElementById( 'say' );
    const sendButton = document.getElementById( 'send' );
    const releaseButton = document.getElementById( 'release' );
    const mouthToggle = document.getElementById( 'mouth' );

    /** The one writer of the tier readout. Every push into the avatar is paired with a call here. */
    const recordTier = ( tier, detail ) => {

        session.tier = tier;
        session.tierDetail = detail;

    };

    const write = ( className, who, said ) => {

        if ( bare === true ) return;

        // Built with DOM calls rather than assembled as a string. A transcript line carries model
        // output and typed text, which is exactly the pair that must never reach `innerHTML`:
        // `textContent` cannot be talked into being markup.
        const speaker = document.createElement( 'span' );
        speaker.className = 'who';
        speaker.textContent = who;

        const words = document.createElement( 'span' );
        words.className = 'said';
        words.textContent = said;

        const line = document.createElement( 'div' );
        line.className = `turn ${ className }`;
        line.append( speaker, ' ', words );

        transcript.appendChild( line );
        transcript.scrollTop = transcript.scrollHeight;

    };

    /**
     * One turn, in the four steps the header argues for, and in that order.
     *
     * Read it top to bottom: tier 1 lands before the first `await`, the reply arrives, the avatar
     * starts speaking, and only then does tier 2 write. The `await spoken` is last because the
     * composer stays disabled while the mouth is moving.
     */
    const takeTurn = async ( heard ) => {

        session.busy = true;
        session.turns += 1;
        input.disabled = true;
        sendButton.disabled = true;

        const started = nowMs();

        write( 'you', 'you', heard );

        // --- 1. tier 1, before anything can await --------------------------------------------
        const reflexResult = conversation.appraiseReflex( heard );

        if ( reflexResult.moved === true ) {

            avatar.feel( reflexResult.estimate );
            recordTier( 1, `reflex — ${ reflexResult.matched }/${ reflexResult.tokens } lexicon words` );

        } else {

            recordTier( session.tier, `tier 1 declined — 0/${ reflexResult.tokens } lexicon words, ` +
                'state unchanged (SeedLexicon: authored, not measured)' );
            write( 'note', '·', `tier 1 had no lexicon evidence (0/${ reflexResult.tokens } words) — nothing pushed` );

        }

        // --- 2. the reply --------------------------------------------------------------------
        const reply = await conversation.requestReply( heard );

        session.lastReplyMs = reply.latencyMs;

        if ( reply.ok === false ) {

            write( 'failed', '·', `no reply: ${ reply.reason } — ${ reply.detail }` );

            session.lastTurnMs = nowMs() - started;
            finishTurn();
            return;

        }

        // --- 3. say it, WHICH PUSHES ITS OWN TIER-1 ESTIMATE OF THE REPLY -----------------------
        //
        // 🚩 Measured: 12 of 17 replies from this host carry a lexicon hit, so this push overwrites
        // pleasure at confidence 1 in 71% of turns. It therefore has to happen BEFORE tier 2 writes,
        // not after — which is the whole reason step 4 is not issued in parallel with step 2.
        const spoken = avatar.say( reply.reply, {
            timeline: mouthToggle.checked === true ? CANNED_TIMELINE : undefined
        } );

        write( 'avatar', 'avatar', reply.reply );

        // --- 4. tier 2, last ------------------------------------------------------------------
        const appraised = conversation.mirror === 'spoken' ? reply.reply : heard;
        const appraisal = await conversation.appraise( appraised, reflexResult.estimate );

        session.lastAppraisalMs = appraisal.latencyMs ?? null;

        if ( appraisal.applied === true ) {

            const value = appraisal.value;

            recordTier( 2, `LM Studio · ${ value.primary } ${ value.intensity.toFixed( 2 ) } · ` +
                `weights P ${ appraisal.weights.pleasure.toFixed( 2 ) } ` +
                `A ${ appraisal.weights.arousal.toFixed( 2 ) } ` +
                `D ${ appraisal.weights.dominance.toFixed( 2 ) }` );

        } else if ( appraisal.ok === false ) {

            // research/lm-studio-integration.md, verbatim: "on any rejection, keep Tier 1's value
            // and log — never let a bad Tier 2 result snap the face." This is that log; the not
            // snapping is `AppraisalAffect`'s, on the one code path that writes.
            recordTier( session.tier, `tier 2 REFUSED ${ appraisal.reason } — tier 1 held` );
            write( 'refused', '·', `tier 2 refused: ${ appraisal.reason } — ${ appraisal.detail }` );

        } else {

            recordTier( session.tier, `tier 2 ${ appraisal.outcome } — a newer utterance overtook it` );

        }

        await spoken;

        session.lastTurnMs = nowMs() - started;
        finishTurn();

    };

    function finishTurn() {

        session.busy = false;
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();

    }

    const send = () => {

        const heard = input.value.trim();

        if ( heard === '' || session.busy === true ) return;

        input.value = '';

        // The single catch-all, at the boundary where a turn becomes something a person reads.
        // Everything below it returns reason codes rather than throwing, so anything arriving here
        // is a programming error and is logged as one.
        takeTurn( heard ).catch( ( error ) => {

            write( 'failed', '·', `turn failed: ${ error.message }` );
            console.error( 'converse: turn failed', error );
            finishTurn();

        } );

    };

    if ( bare === true ) {

        for ( const id of [ 'hud', 'transcript', 'composer' ] ) document.getElementById( id ).style.display = 'none';

    } else {

        sendButton.addEventListener( 'click', send );
        input.addEventListener( 'keydown', ( event ) => { if ( event.key === 'Enter' ) send(); } );

        releaseButton.addEventListener( 'click', () => {

            // `release()` on the state drops the TARGET to neutral and lets the layers fall at their
            // own time constants — "calm down", not "freeze". `feel({0,0,0})` would be the same
            // write, and this is the verb that says what it means.
            avatar.affectState.release();
            recordTier( 0, 'released to neutral by hand' );

        } );

        write( 'note', '·', `endpoint ${ conversation.endpoint } · model ${ conversation.model } · ` +
            `appraising what is ${ conversation.mirror }` );

        input.focus();

    }

    mark( 'ready' );
    overlay.remove();

    // Fired and NOT awaited. The figure is already alive and there is no reason to hold a page that
    // renders on a call that can take 22 s; the HUD reports which state the warm-up is in.
    conversation.warmBothSchemas().then( ( warm ) => {

        session.warm = warm.warmed === true
            ? `warm in ${ ( warm.latencyMs / 1000 ).toFixed( 1 ) } s`
            : `NOT WARM — affect ${ warm.affectReason ?? 'ok' }, reply ${ warm.replyReason ?? 'ok' }`;

    } );

    // Deliberately NOT hung off the frame callback: `autoStart: true` means the avatar owns that
    // loop, and a HUD is not a reason to take it away. Ten times a second is plenty for a human and
    // cheap enough not to compete with the frame being drawn.
    if ( bare === false ) {

        setInterval( () => {

            sampleFrameRate( avatar, session );
            hud.textContent = describe( avatar, conversation, session, mouthToggle );

        }, HUD_INTERVAL_MS );

    }

    // Everything a console or a harness needs, in one place, the way every other page here does it.
    window.__SUGATA_CONVERSE__ = { avatar, conversation, session, takeTurn, ready: true };

}

/**
 * `?ownclock` — the frame loop for a pane that does not run `requestAnimationFrame`.
 *
 * 🚩 THIS IS NOT SPECULATIVE AND IT WAS MEASURED ON THIS PAGE. Driven in an automation pane, the
 * default `autoStart: true` avatar ran **0 frames in 3.208 s** with `document.hidden === true`, and
 * over the preceding session managed **18 stack frames in 36.5 s of wall clock — 0.45 fps**. The
 * figure still renders, because a screenshot forces a paint; the SIMULATION barely advances, so
 * expressions crawl and an utterance is over before the viseme layer samples it. LEARNINGS §1.12 is
 * the entry, `frame-clock.js` is the shared fix, and three other pages here already import it.
 *
 * With `?ownclock` on, the same hidden pane ran **224 frames in 3.761 s — 59.6 fps**. Same page,
 * same browser, same `document.hidden === true`; the only difference is who owns the clock.
 *
 * ⚠️ It is opt-in rather than automatic, deliberately. `Avatar.create( { canvas } )` producing a
 * self-driving figure is the whole of R7's acceptance gate, and a page that quietly took the clock
 * away from it every time would be demonstrating something else. A human at a keyboard in a visible
 * tab never needs this.
 *
 * 🎯 AND THE CLAMP HERE IS READ OFF THE STACK RATHER THAN TYPED, WHICH FIXES SOMETHING ON THE WAY.
 * `MotionStack.update()` clamps its delta to `maxDeltaSeconds` (0.1 s) while `Avatar.advanceFrame`
 * adds the RAW delta to `clockSeconds` — the clock `VisemeLayer` reads. Measured live during a
 * throttled run: `clockSeconds 36.51` against `stack.time 0.459`, a 79x divergence, which means an
 * utterance's whole schedule can elapse between two samples. Clamping to the stack's own published
 * value before calling `update()` keeps the two clocks in agreement on this page — measured after
 * the change, `stack.time` and `clockSeconds` both read **11.829** to the millisecond. Filed as a
 * request against `Avatar.js`, because the same divergence exists on its internal path where this
 * cannot reach it.
 */
function startOwnClock( avatar ) {

    let lastSeconds = performance.now() / 1000;
    let rafTicks = 0;
    let driver = 'raf';

    const step = () => {

        const now = performance.now() / 1000;
        const elapsed = now - lastSeconds;

        if ( elapsed < OWN_CLOCK_MIN_FRAME_SECONDS ) return false;

        lastSeconds = now;

        // The stack's own published ceiling, not a repeat of it. See the 🎯 above.
        avatar.update( Math.min( Math.max( 0, elapsed ), avatar.stack.maxDeltaSeconds ) );

        return true;

    };

    const rafLoop = () => {

        if ( driver !== 'raf' ) return;   // the fallback took over; do not drive twice

        rafTicks += 1;
        step();
        requestAnimationFrame( rafLoop );

    };

    requestAnimationFrame( rafLoop );

    setTimeout( () => {

        if ( rafTicks >= 2 ) return;

        driver = 'task';

        console.warn( `converse: requestAnimationFrame fired ${ rafTicks } times in ${ RAF_PROBE_MS } ms — ` +
            'this pane throttles it. Driving the avatar from frame-clock.js instead (LEARNINGS §1.12).' );

        // 🚩 IMPORTED HERE AND NOT AT THE TOP OF THE FILE, AND THAT IS NOT A CODE-SPLITTING
        // PREFERENCE. `frame-clock.js` opens a `MessageChannel` and installs an `onmessage` handler
        // AT MODULE SCOPE. In a browser that is free; in Node a live `MessagePort` handler keeps the
        // event loop alive, and a static import made this whole module un-exitable — measured: the
        // headless probe that produces every table in the header printed its results and then hung
        // until it was killed. The conversation half of this file has to stay drivable from Node,
        // so the browser-only helper is reached only on the browser-only path.
        import( './frame-clock.js' ).then( ( { scheduleTask } ) => {

            const taskLoop = () => {

                step();
                scheduleTask( taskLoop );

            };

            scheduleTask( taskLoop );

        } );

    }, RAF_PROBE_MS );

}

/**
 * Frames per second read off the MOTION STACK's own counter rather than off the renderer.
 *
 * 🚩 `Stage.fps` is computed inside `Stage`'s own rAF callback, and `?ownclock` is precisely the
 * mode that switches that callback off — measured reading **0 fps while the avatar was demonstrably
 * running at 59.6**, which is worse than no readout because it looks like a stalled page. The
 * stack's frame counter advances on `advanceFrame`, the one per-frame path BOTH modes share, so it
 * is right in either.
 */
function sampleFrameRate( avatar, session ) {

    const frame = avatar.stack === null ? 0 : avatar.stack.frame;
    const at = nowMs();

    if ( session.frameSampleAt !== null ) {

        const elapsedSeconds = ( at - session.frameSampleAt ) / 1000;
        if ( elapsedSeconds > 0 ) session.fps = ( frame - session.frameSampleFrame ) / elapsedSeconds;

    }

    session.frameSampleAt = at;
    session.frameSampleFrame = frame;

}

/**
 * The HUD.
 *
 * Ordered by what somebody looking at this page actually asks, top to bottom: is it rendering, is
 * the model there, what does it feel, WHO SAID SO, is the body doing anything, and is the mouth
 * telling the truth.
 */
function describe( avatar, conversation, session, mouthToggle ) {

    const report = avatar.report();
    const tier2 = conversation.tier2.report();

    const pad = report.affect === null ? { pleasure: 0, arousal: 0, dominance: 0 } : report.affect.pad;
    const activations = report.affect === null ? [] : report.affect.activations;
    const posture = report.affect?.postureDegrees ?? null;

    const latency = session.lastTurnMs === null
        ? 'no turn yet'
        : `last turn ${ session.lastTurnMs.toFixed( 0 ) } ms  ` +
            `(reply ${ formatMs( session.lastReplyMs ) }, then appraisal ${ formatMs( session.lastAppraisalMs ) })`;

    return [
        `backend ${ report.quality.backend }  tier ${ report.quality.tier } (${ report.quality.selectedBy })  ` +
            `${ Math.round( session.fps ) } fps  ${ report.framing.mode }  ` +
            `${ avatar.autoStart ? 'avatar clock' : 'page clock (?ownclock)' }`,
        `lm      ${ conversation.endpoint }  ${ conversation.model }`,
        `        ${ session.warm }   ${ session.turns } turn(s)   ${ latency }`,
        '',
        `PAD     P ${ signed( pad.pleasure ) }   A ${ signed( pad.arousal ) }   D ${ signed( pad.dominance ) }`,
        `TIER    ${ session.tier === 0 ? '—' : session.tier }  ${ session.tierDetail }`,
        `mood    ${ report.affect?.moodOctant ?? '—' }`,
        `face    ${ activations.length === 0 ? '(neutral)' : activations.map( ( entry ) =>
            `${ entry.emotion } ${ entry.weight.toFixed( 3 ) }${ entry.saturated ? ' SAT' : '' }` ).join( '   ' ) }`,
        `body    ${ posture === null ? '(no posture layer)' : Object.entries( posture )
            .map( ( [ joint, degrees ] ) => `${ joint } ${ signed( degrees ) }°` ).join( '  ' ) }`,
        '',
        `tier 2  ${ tier2.applied }/${ tier2.appraisals } applied, ${ tier2.superseded } superseded, ` +
            `refusals ${ JSON.stringify( tier2.refusals ) }`,
        `tier 1  ${ conversation.reflex.lexiconProvenance.name }, ` +
            `${ conversation.reflex.lexiconProvenance.entries } entries — ` +
            `${ conversation.reflex.lexiconProvenance.licence }`,
        '',
        `speech  ${ report.speech.speaking ? 'SPEAKING' : 'silent' }   ` +
            `timeline ${ report.speech.timelineSupplied === null ? '—' : report.speech.timelineSupplied }`,
        mouthToggle.checked === true
            ? '🚩 THE MOUTH IS RUNNING A SYNTHETIC 0.985 s TIMELINE whose shapes are not this text\'s'
            : '   mouth off — say( text ) alone cannot move it. A viseme timeline comes from a TTS',
        mouthToggle.checked === true
            ? '   phonemes. A real one comes from a TTS engine — punch-list 4.3, still open.'
            : '   engine and punch-list 4.3 is the open item. Face and body are driven either way.',
        '',
        '⚠️ arousal has no acoustics here — every non-zero A on this page came from tier 2.'
    ].join( '\n' );

}

function signed( value ) {

    return `${ value >= 0 ? '+' : '' }${ value.toFixed( 2 ) }`;

}

function formatMs( value ) {

    return value === null ? '—' : `${ value.toFixed( 0 ) } ms`;

}

/** `performance.now` where it exists, `Date.now` otherwise — matching `LMStudioClient`'s own helper. */
function nowMs() {

    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

}
