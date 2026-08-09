/**
 * ReflexAffect — tier 1. Valence from the text, arousal from the acoustics, in under a
 * millisecond. Punch-list 5.2.
 *
 * THE MODALITY SPLIT IS THE WHOLE DESIGN
 * --------------------------------------
 * research/affect-and-animation.md §2, in one line: **"Valence lives in the text. Arousal lives in
 * the acoustics."** Two independent confirmations sit under it. Yildirim et al. (ICSLP 2004) get
 * 67.0% discriminant accuracy from all acoustic features against human listeners' 68.3%, and the
 * classifier makes the *same* mistakes — angry→happy 42, happy→angry 31 — so "conventional
 * acoustic parameters are ineffective for valence". Wagner et al. (IEEE TPAMI 2023) reach CCC .638
 * for valence only "by covertly learning linguistic information."
 *
 * So this module has two halves that never touch: `estimateFromText` and `estimateFromProsody`,
 * each returning its own axis with its own confidence, and `estimate` merges them.
 *
 * WHY TIER 1 EXISTS AT ALL
 * ------------------------
 * research/lm-studio-integration.md, finding 4: a schema-constrained affect call to the local 35B
 * costs 0.6-0.95 s. "~1 s is fine per-utterance and impossible per-frame." Tier 1 drives the face
 * the instant sound starts; tier 2 blends a richer vector in about a second later. And the sentence
 * that shapes this file: **"Tier 1 must stand alone and look right on its own, because Tier 2 is
 * allowed to fail."**
 *
 * 🚩 ANIMATE EARLY. `estimateFromProsody` takes READINGS, not a live analyser, and the readings it
 * is meant to be handed are the ones `voice/Prosody.js#analyseBuffer` produces from a decoded TTS
 * buffer BEFORE a sample of it plays. Pointing it at `Prosody.attach()` on our own output is
 * structurally one window late and fights every timing constraint in research §8. Attaching to the
 * MICROPHONE is correct, because that audio is not our mouth.
 *
 * 🚩 THE LEXICON LICENCE. Punch-list 5.2 says "resolve the NRC-VAD non-commercial licence before
 * shipping a lexicon", and `SeedLexicon.js` is where that is resolved and recorded. Short version:
 * NRC-VAD and Warriner are both non-commercial and neither is in this repo; VADER is MIT and its
 * rule layer is implemented here from the published description; the shipped word list is authored
 * for this repo and `loadLexicon()` swaps in VADER's real file.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * No jitter, no shimmer — research §2 calls them voice-pathology measures, "meaningless on vocoder
 * output where the TTS controls them". No smoothing: the asymmetric attack/decay belongs to
 * `AffectState`, and a smoother here would put two in series with no one owning the time constant.
 * No dominance worth the name; see `SeedLexicon.DOMINANCE_MARKERS` for why the stopgap is a stopgap.
 */

import { VOICE_REFERENCE_SECONDS } from '../voice/Prosody.js';
import {
    BOOSTERS, DOMINANCE_CONFIDENCE, DOMINANCE_MARKERS, NEGATIONS, SEED_LEXICON,
    SEED_LEXICON_PROVENANCE
} from './SeedLexicon.js';

/**
 * VADER's published rule constants (Hutto & Gilbert, ICWSM 2014, MIT).
 *
 * ⚠️ These are NOT in `docs/research/`, which records only that VADER is MIT and that its
 * `compound` is well calibrated. They are the algorithm's own constants, transcribed from its
 * published description, and a documentation fix is filed to put them in the research doc so the
 * next reader does not have to take this comment's word for it.
 */
export const VADER = Object.freeze( {
    boosterIncrement: 0.293,        // B_INCR
    capsIncrement: 0.733,           // C_INCR, applied when a word is shouted and the text is not
    negationScalar: -0.74,          // N_SCALAR
    exclamationIncrement: 0.292,    // per '!', up to four
    maximumExclamations: 4,
    questionTwo: 0.180,             // exactly two '?'
    questionMany: 0.960,            // three or more
    negationWindow: 3,              // words back a negator reaches
    boosterDistanceDamping: Object.freeze( [ 1.0, 0.95, 0.90 ] ),
    butBefore: 0.5,                 // clause weighting around 'but'
    butAfter: 1.5,
    normaliserAlpha: 15             // compound = x / sqrt(x^2 + alpha)
} );

/**
 * GeMAPS percentage change from neutral, RAVDESS, research §2. Transcribed verbatim; the arousal
 * feature weights below are ARITHMETIC ON THIS TABLE rather than numbers this project picked.
 */
export const GEMAPS_PERCENT_CHANGE = Object.freeze( {
    anger:    Object.freeze( { f0Mean: 20.7, f0Std: 24.6, loudness: 365.5 } ),
    fear:     Object.freeze( { f0Mean: 25.3, f0Std: -7.6, loudness: 208.0 } ),
    joy:      Object.freeze( { f0Mean: 18.4, f0Std: 12.5, loudness: 165.1 } ),
    surprise: Object.freeze( { f0Mean: 18.7, f0Std: 44.6, loudness: 98.8 } ),
    sadness:  Object.freeze( { f0Mean: 7.7, f0Std: 2.2, loudness: 34.3 } )
} );

/**
 * How much each acoustic feature counts toward arousal.
 *
 * Derived: the mean percentage change across the five emotions in the table above, normalised to
 * sum to 1. research §2's own summary of that table is "loudness is the dominant arousal carrier by
 * a wide margin", and the arithmetic says how wide — 0.839 against 0.087 and 0.073, a factor of
 * about ten. Computing it here rather than typing the three numbers means the weights cannot drift
 * away from the table they come from.
 */
export const AROUSAL_FEATURE_WEIGHTS = Object.freeze( ( () => {

    const rows = Object.values( GEMAPS_PERCENT_CHANGE );
    const mean = ( key ) => rows.reduce( ( sum, row ) => sum + row[ key ], 0 ) / rows.length;

    const f0Mean = mean( 'f0Mean' );
    const f0Std = mean( 'f0Std' );
    const loudness = mean( 'loudness' );
    const total = f0Mean + f0Std + loudness;

    return { f0Mean: f0Mean / total, f0Std: f0Std / total, loudness: loudness / total };

} )() );

/**
 * The lift each feature shows at FULL arousal — the denominator that turns a runtime reading into
 * evidence in [-1, 1].
 *
 * f0Mean   research §2: "High arousal lifts F0 ~45-49 Hz ≈ +3.7 semitones." Cited, in the unit
 *          `Prosody` already reports.
 * f0Std    research §2: "F0 SD nearly doubles — variability is the stronger cue." A doubling, so
 *          the evidence is `std / reference - 1`.
 * loudness ⚠️ DERIVED WITH ONE ASSUMPTION, FLAGGED. The table's largest loudness figure is anger's
 *          +365.5%, which is the top of the arousal axis. Read as an amplitude ratio of 4.655 that
 *          is 20*log10(4.655) = 13.36 dB, and dB against the per-voice reference is what `Prosody`
 *          reports. The assumption is that GeMAPS "loudness" is proportional to amplitude; it is an
 *          auditory-model quantity and may not be. What would settle it: measure the same utterance
 *          through openSMILE's GeMAPS loudness and through this repo's RMS-dB and fit the two.
 *          Until then the number is a scale, not a measurement, and it is wrong by at most the
 *          slope of that fit — which changes how fast arousal saturates, not its sign or its order.
 */
export const AROUSAL_FULL_SCALE = Object.freeze( {
    f0MeanSemitones: 3.7,
    f0StdRatio: 1.0,
    loudnessDb: 20 * Math.log10( 1 + GEMAPS_PERCENT_CHANGE.anger.loudness / 100 )
} );

/** Word characters plus the apostrophes contractions and negations need. */
const TOKEN_PATTERN = /[a-zÀ-ɏ']+/gi;

export class ReflexAffect {

    /**
     * @param {Object} [options]
     * @param {Object<string, number>} [options.lexicon] - Replaces the seed. See `loadLexicon`.
     * @param {string} [options.lexiconName]
     * @param {number} [options.referenceSeconds=VOICE_REFERENCE_SECONDS] - Time constant of the
     *   running F0-variability reference, in seconds of audio. Matched to `Prosody`'s own so the
     *   two references settle together rather than one chasing the other.
     */
    constructor( options = {} ) {

        this.lexicon = new Map();
        this.boosters = new Map( Object.entries( BOOSTERS ) );
        this.negations = NEGATIONS;
        this.dominanceMarkers = new Map( Object.entries( DOMINANCE_MARKERS ) );

        this.lexiconProvenance = SEED_LEXICON_PROVENANCE;
        this.loadLexicon( options.lexicon ?? SEED_LEXICON, options.lexiconName );

        this.referenceSeconds = options.referenceSeconds ?? VOICE_REFERENCE_SECONDS;

        /** Running estimate of this voice's own F0 variability, in semitones. Null until voiced. */
        this.referenceF0Std = null;

    }

    /**
     * Replaces the word list.
     *
     * The production call is `loadLexicon(vaderEntries, 'vader')` with VADER's `vader_lexicon.txt`
     * parsed into `{word: valence}` — MIT, 7,500+ terms, the mean of ten human ratings each. See
     * `SeedLexicon.js` for why that file is not vendored in this round and why NRC-VAD and Warriner
     * are not an option at all.
     */
    loadLexicon( entries, name ) {

        this.lexicon.clear();

        for ( const [ word, valence ] of Object.entries( entries ) ) {

            this.lexicon.set( word.toLowerCase(), valence );

        }

        this.lexiconProvenance = entries === SEED_LEXICON
            ? SEED_LEXICON_PROVENANCE
            : Object.freeze( {
                name: name ?? 'caller-supplied',
                licence: 'stated by the caller',
                entries: this.lexicon.size,
                warning: ''
            } );

        return this;

    }

    // --- valence, from the text -------------------------------------------------------------

    /**
     * VADER's rule layer over the loaded lexicon, returning `compound` in [-1, 1] plus the
     * dominance stopgap.
     *
     * The rules, in the order VADER applies them: lexicon lookup; ALL-CAPS emphasis when the whole
     * text is not shouted; degree modifiers damped by how far back they sit; negation inside a
     * three-word window; the `but` clause reweighting; punctuation amplification; and finally the
     * `x / sqrt(x^2 + 15)` squash, which is what makes `compound` comparable across sentence
     * lengths. research §2 records that there is "no canonical published algorithm" for pooling
     * word VAD into sentence VAD and names VADER's `compound` as the alternative to rolling one.
     *
     * @param {string} text
     * @returns {{pleasure, dominance, confidence, matched, tokens}}
     */
    estimateFromText( text ) {

        if ( typeof text !== 'string' || text.length === 0 ) return emptyTextEstimate();

        const raw = text.match( TOKEN_PATTERN ) ?? [];
        if ( raw.length === 0 ) return emptyTextEstimate();

        const words = raw.map( ( word ) => word.toLowerCase() );
        const shoutedText = isShouted( raw );

        const valences = new Array( words.length ).fill( 0 );
        let matched = 0;

        for ( let index = 0; index < words.length; index ++ ) {

            const word = words[ index ];
            const base = this.lexicon.get( word );

            if ( base === undefined || this.boosters.has( word ) ) continue;

            matched ++;

            let valence = base;

            // Emphasis by shouting, but only when the shout is distinctive.
            if ( shoutedText === false && isAllCaps( raw[ index ] ) ) {

                valence += Math.sign( valence ) * VADER.capsIncrement;

            }

            valence += this.boostAt( words, raw, index, valence, shoutedText );
            valence *= this.negationScalarAt( words, index );

            valences[ index ] = valence;

        }

        applyButClause( words, valences );

        let sum = 0;
        for ( const valence of valences ) sum += valence;

        sum += punctuationAmplifier( text, sum );

        const compound = sum / Math.sqrt( sum * sum + VADER.normaliserAlpha );

        return {
            pleasure: clampAxis( compound ),
            dominance: clampAxis( this.dominanceFrom( words ) ),
            confidence: {
                // No lexicon hit is no evidence, not evidence of neutrality. Pushing a confident
                // zero on every function word would drag the face flat.
                pleasure: matched === 0 ? 0 : 1,

                // ⚠️ And dominance needs a dominance MARKER, not merely a valence hit. An utterance
                // with sentiment and no stance is not weak evidence that the speaker is neither
                // dominant nor submissive; it is no evidence either way, and claiming 0.25
                // confidence in a zero would drag the axis flat on every sentence. The consequence
                // is that dominance is STICKY between utterances until a marker appears or the
                // caller releases — which is correct for a stance and is what punch-list 5.3's
                // tier 2 will replace, since the appraisal pass returns all three axes every turn.
                dominance: this.markerCount( words ) === 0 ? 0 : DOMINANCE_CONFIDENCE
            },
            matched,
            tokens: words.length
        };

    }

    /** Degree modifiers in the three words before `index`, damped by distance. VADER's rule. */
    boostAt( words, raw, index, valence, shoutedText ) {

        let boost = 0;

        for ( let back = 1; back <= VADER.boosterDistanceDamping.length; back ++ ) {

            const at = index - back;
            if ( at < 0 ) break;

            const scalar = this.boosters.get( words[ at ] );
            if ( scalar === undefined ) continue;

            let amount = scalar * VADER.boosterIncrement * VADER.boosterDistanceDamping[ back - 1 ];

            if ( valence < 0 ) amount = -amount;
            if ( shoutedText === false && isAllCaps( raw[ at ] ) ) {

                amount += Math.sign( valence ) * VADER.capsIncrement * ( scalar > 0 ? 1 : -1 );

            }

            boost += amount;

        }

        return boost;

    }

    /** -0.74 per negator inside the window, VADER's N_SCALAR. Repeated negators re-flip. */
    negationScalarAt( words, index ) {

        let scalar = 1;

        for ( let back = 1; back <= VADER.negationWindow; back ++ ) {

            const at = index - back;
            if ( at < 0 ) break;

            if ( this.negations.has( words[ at ] ) ) scalar *= VADER.negationScalar;

        }

        return scalar;

    }

    /** 🚩 The stopgap. Mean of the markers present, so a long sentence is not louder than a short one. */
    dominanceFrom( words ) {

        let sum = 0;
        let count = 0;

        for ( const word of words ) {

            const marker = this.dominanceMarkers.get( word );
            if ( marker === undefined ) continue;

            sum += marker;
            count ++;

        }

        return count === 0 ? 0 : sum / count;

    }

    markerCount( words ) {

        let count = 0;
        for ( const word of words ) if ( this.dominanceMarkers.has( word ) ) count ++;
        return count;

    }

    // --- arousal, from the acoustics ------------------------------------------------------------

    /**
     * Arousal from a window of `Prosody` readings.
     *
     * research §2's pooling rule is asymmetric and this is the arousal half of it: **"Arousal —
     * max, or mean of top-k (k≈3). Arousal is unsigned; mean-pooling one intense word among nine
     * calm ones gives 'calm,' which is wrong — the intense word IS the content."** So loudness is
     * pooled as the mean of the top three frames and not as the mean of the window.
     *
     * @param {Array} readings - From `Prosody.ingest`/`readingsFor`. Anything shorter than one
     *   frame returns no evidence rather than zero.
     * @returns {{arousal, confidence, voicedFraction, evidence}}
     */
    estimateFromProsody( readings ) {

        if ( Array.isArray( readings ) === false || readings.length === 0 ) return emptyProsodyEstimate();

        const voiced = readings.filter( ( reading ) => reading.voiced === true );
        const voicedFraction = voiced.length / readings.length;

        if ( voiced.length === 0 ) return emptyProsodyEstimate();

        const last = readings[ readings.length - 1 ];

        // Loudness: top-k mean, per the asymmetric pooling rule above.
        const loudnessZ = meanOfTop( readings.map( ( reading ) => reading.loudnessZ ?? 0 ), 3 );
        const loudnessDb = loudnessZ * LOUDNESS_Z_TO_DB;

        const f0MeanSemitones = last.f0MeanSemitones ?? 0;
        const f0StdSemitones = last.f0StdSemitones ?? 0;

        this.updateVariabilityReference( f0StdSemitones, readings.length );

        const evidence = {
            loudness: clampAxis( loudnessDb / AROUSAL_FULL_SCALE.loudnessDb ),
            f0Mean: clampAxis( f0MeanSemitones / AROUSAL_FULL_SCALE.f0MeanSemitones ),
            f0Std: this.referenceF0Std === null || this.referenceF0Std <= 0
                ? 0
                : clampAxis( ( f0StdSemitones / this.referenceF0Std - 1 ) / AROUSAL_FULL_SCALE.f0StdRatio )
        };

        const arousal =
            evidence.loudness * AROUSAL_FEATURE_WEIGHTS.loudness +
            evidence.f0Mean * AROUSAL_FEATURE_WEIGHTS.f0Mean +
            evidence.f0Std * AROUSAL_FEATURE_WEIGHTS.f0Std;

        return {
            arousal: clampAxis( arousal ),
            // Unvoiced frames carry no pitch and little loudness information worth normalising, so
            // the voiced fraction IS the confidence.
            confidence: { arousal: voicedFraction },
            voicedFraction,
            evidence
        };

    }

    /**
     * Slides the F0-variability reference. Slower than the affect envelope it feeds, for the same
     * reason `Prosody`'s own references are: a reference that adapted at the speed of the signal
     * would normalise the signal away.
     */
    updateVariabilityReference( f0StdSemitones, frameCount ) {

        if ( ! ( f0StdSemitones > 0 ) ) return;

        if ( this.referenceF0Std === null ) {

            this.referenceF0Std = f0StdSemitones;
            return;

        }

        // One window's share of the time constant, from the window's own length.
        const windowSeconds = frameCount * DEFAULT_HOP_SECONDS;
        const alpha = Math.min( 1, windowSeconds / this.referenceSeconds );

        this.referenceF0Std += alpha * ( f0StdSemitones - this.referenceF0Std );

    }

    // --- the two halves together ------------------------------------------------------------

    /**
     * One estimate, shaped for `AffectState.push`. Either input may be absent — text with no audio
     * yet is the normal case at the start of an utterance, and it is exactly the case tier 1 exists
     * to cover.
     *
     * @param {Object} [input]
     * @param {string} [input.text]
     * @param {Array} [input.prosody] - Readings.
     */
    estimate( { text, prosody } = {} ) {

        const fromText = text === undefined ? emptyTextEstimate() : this.estimateFromText( text );
        const fromProsody = prosody === undefined ? emptyProsodyEstimate() : this.estimateFromProsody( prosody );

        return {
            pleasure: fromText.pleasure,
            arousal: fromProsody.arousal,
            dominance: fromText.dominance,
            confidence: {
                pleasure: fromText.confidence.pleasure,
                arousal: fromProsody.confidence.arousal,
                dominance: fromText.confidence.dominance
            },
            detail: { text: fromText, prosody: fromProsody }
        };

    }

    /** Forgets the voice. Mirrors `Prosody.resetVoice()`; call when the speaker changes. */
    resetVoice() {

        this.referenceF0Std = null;

    }

}

/**
 * `Prosody` reports loudness as a z-score against the voice's own running variance, and the full
 * scale above is in dB, so one of the two has to be converted. A z of 1 is one standard deviation,
 * and the standard deviation of speech loudness is not something `docs/research/` measures.
 *
 * ⚠️ 6 dB is a stated scale, not a measurement — it is the doubling that "one standard deviation of
 * conversational level" is conventionally taken to be, and it exists so the loudness term has a
 * defined unit rather than a silent one. What would settle it: `Prosody.loudnessVarianceDb` over a
 * few minutes of real TTS output, which the Phase 4.3 work will produce. Until then, note that this
 * scales the dominant arousal term directly and is the largest single uncertainty in tier 1.
 */
const LOUDNESS_Z_TO_DB = 6;

/** `Prosody`'s hop at 48 kHz. Used only to age the variability reference; see `Prosody.settings`. */
const DEFAULT_HOP_SECONDS = 256 / 48000;

// --- helpers ---------------------------------------------------------------------------------

function emptyTextEstimate() {

    return {
        pleasure: 0, dominance: 0,
        confidence: { pleasure: 0, dominance: 0 },
        matched: 0, tokens: 0
    };

}

function emptyProsodyEstimate() {

    return {
        arousal: 0,
        confidence: { arousal: 0 },
        voicedFraction: 0,
        evidence: { loudness: 0, f0Mean: 0, f0Std: 0 }
    };

}

/** A single word in capitals, at least two letters so "I" and "A" do not read as shouting. */
function isAllCaps( word ) {

    return word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();

}

/** Whether the WHOLE text is shouted, in which case no individual word is emphatic. */
function isShouted( raw ) {

    let caps = 0;
    for ( const word of raw ) if ( isAllCaps( word ) ) caps ++;

    return caps > 0 && caps === raw.filter( ( word ) => word.length > 1 ).length;

}

/**
 * VADER's contrastive conjunction rule: everything before `but` is halved and everything after is
 * amplified by half again, because the clause after the `but` is the one the speaker means.
 */
function applyButClause( words, valences ) {

    const at = words.indexOf( 'but' );
    if ( at === -1 ) return;

    for ( let index = 0; index < valences.length; index ++ ) {

        valences[ index ] *= index < at ? VADER.butBefore : VADER.butAfter;

    }

}

/** Exclamation and question marks, signed to follow the sentence. VADER's punctuation rules. */
function punctuationAmplifier( text, sum ) {

    if ( sum === 0 ) return 0;

    const exclamations = Math.min( countOf( text, '!' ), VADER.maximumExclamations );
    const questions = countOf( text, '?' );

    let amplifier = exclamations * VADER.exclamationIncrement;

    if ( questions === 2 ) amplifier += VADER.questionTwo;
    else if ( questions > 2 ) amplifier += VADER.questionMany;

    return Math.sign( sum ) * amplifier;

}

function countOf( text, character ) {

    let count = 0;
    for ( const glyph of text ) if ( glyph === character ) count ++;
    return count;

}

/**
 * Mean of the k largest values. research §2's asymmetric pooling recipe for arousal, which is
 * unsigned: "the intense word IS the content."
 */
function meanOfTop( values, k ) {

    if ( values.length === 0 ) return 0;

    const sorted = [ ...values ].sort( ( a, b ) => b - a ).slice( 0, Math.min( k, values.length ) );

    let sum = 0;
    for ( const value of sorted ) sum += value;

    return sum / sorted.length;

}

function clampAxis( value ) {

    if ( typeof value !== 'number' || Number.isNaN( value ) ) return 0;
    return Math.min( Math.max( value, -1 ), 1 );

}
