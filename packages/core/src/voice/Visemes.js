/**
 * Visemes — the vocabulary, and the one place a foreign viseme name is allowed to exist.
 *
 * WHAT THIS FILE IS FOR
 * ---------------------
 * The figure carries two viseme sets as named morph targets, verified straight out of
 * `assets/figures/figure_g050.glb`: the 15 Meta/Oculus shapes (`viseme_sil` … `viseme_U`) and the
 * 22 Microsoft/Azure shapes (`sil_00` … `p_b_m_21`). Downstream, exactly one of those is real:
 * `figure/ExpressionBank.js` knows the OVR 15 and refuses everything else. That refusal is
 * deliberate and this file is the boundary it implies — **every foreign naming convention is
 * normalised here, and nothing past this module ever sees an Azure id or an Oculus `ih`.**
 *
 * Three separate naming problems arrive at that boundary, and research/affect-and-animation.md §3
 * names all three:
 *
 *   1. **The Oculus tail is renamed everywhere.** OVR's own last three are `ih / oh / ou`, but
 *      "Ready Player Me, VRM and TalkingHead all ship `viseme_I / viseme_O / viseme_U`" — and so
 *      does our GLB. `OVR_ALIASES` accepts both spellings; only the shipped spelling leaves here.
 *
 *   2. **Azure has 22 ids and OVR has 15.** A collapse table is required. Two of the seven lost
 *      distinctions are not losses at all but genuine structure, and are handled rather than
 *      flattened — see DIPHTHONGS and TRANSPARENT below.
 *
 *   3. **A timeline may arrive with repeats, gaps, unsorted entries or zero durations.** A
 *      scheduler that has to defend against all of that on every frame is a scheduler with the
 *      timing bug hidden inside the defending. `normaliseTimeline()` does it once, up front.
 *
 * TWO PLACES THE COLLAPSE REFUSES TO GUESS
 * ----------------------------------------
 * **Diphthongs.** Azure has separate ids for aʊ, ɔɪ and aɪ "which OVR lacks". Collapsing aɪ to a
 * single shape throws away the thing that makes it a diphthong: the mouth travels. So a diphthong
 * expands into TWO timed entries across its own duration rather than picking a winner. The split
 * point is documented at its constant.
 *
 * **The glottal /h/.** Azure id 12 has NO oral constriction — the visible
 * articulation during /h/ is entirely the vowel on either side of it. Every single-shape answer
 * here is invented: `viseme_sil` closes a mouth that is open, `viseme_kk` asserts a velar closure
 * that is not happening, and `viseme_aa` guesses at a vowel we have not been told. So id 12 maps to
 * `TRANSPARENT` and is dropped from the timeline, leaving the neighbouring envelopes'
 * anticipation and release to cover the interval — which is what the articulation actually does.
 *
 * 🚩 EVERY OTHER COLLAPSE IS LOSSY AND THE LOSSES ARE LISTED. See MICROSOFT_TO_OVR's comments.
 * A collapse table that does not say what it destroyed is a table nobody can audit later.
 */

import { OVR_VISEMES } from '../figure/ExpressionBank.js';

export { OVR_VISEMES };

/**
 * The 22 Microsoft/Azure viseme shapes, in Azure id order, under the names the MPFB2 `visemes01`
 * pack bakes into the GLB. Verified present on `figure_g050.glb` by reading the GLB's own
 * `meshes[].extras.targetNames`.
 *
 * The index IS the Azure viseme id, which is what makes `microsoftVisemeName(id)` a lookup rather
 * than a table.
 */
export const MICROSOFT_VISEMES = Object.freeze( [
    'sil_00',
    'aa_ah_ax_01',
    'aa_02',
    'ao_03',
    'ey_eh_uh_04',
    'er_05',
    'y_iy_ih_ix_06',
    'w_uw_07',
    'ow_08',
    'aw_09',
    'oy_10',
    'ay_11',
    'h_12',
    'r_13',
    'l_14',
    's_z_15',
    'sh_ch_jh_zh_16',
    'th_dh_17',
    'f_v_18',
    'd_t_n_19',
    'k_g_ng_20',
    'p_b_m_21'
] );

/**
 * A viseme whose visible articulation belongs entirely to its neighbours. Dropped by
 * `normaliseTimeline`; see the header.
 */
export const TRANSPARENT = null;

/**
 * Azure id -> OVR shape, with the loss stated wherever there is one.
 *
 * The OVR groupings this is collapsing onto are Oculus's own: PP=(p,b,m) FF=(f,v) TH=(θ,ð)
 * DD=(t,d) kk=(k,g) CH=(tʃ,dʒ,ʃ) SS=(s,z) nn=(n,l) RR=(r) plus five vowels.
 */
export const MICROSOFT_TO_OVR = Object.freeze( {

    0:  'viseme_sil',
    1:  'viseme_aa',   // æ ə ʌ  -> aa.  LOSS: schwa is far more closed than æ; both read as aa.
    2:  'viseme_aa',   // ɑ
    3:  'viseme_O',    // ɔ
    4:  'viseme_E',    // ɛ ʊ  -> E.  LOSS: ʊ is rounded and belongs with U. Azure fused them; ɛ is
                       //       the commoner of the two in running speech, so ɛ wins the shape.
    5:  'viseme_RR',   // ɝ
    6:  'viseme_I',    // j i ɪ
    7:  'viseme_U',    // w u
    8:  'viseme_O',    // o
    9:  'DIPHTHONG',   // aʊ — see DIPHTHONGS
    10: 'DIPHTHONG',   // ɔɪ
    11: 'DIPHTHONG',   // aɪ
    12: TRANSPARENT,   // h — no oral constriction. See the header.
    13: 'viseme_RR',   // ɹ
    14: 'viseme_nn',   // l  — OVR's nn covers n AND l.
    15: 'viseme_SS',   // s z
    16: 'viseme_CH',   // ʃ tʃ dʒ ʒ
    17: 'viseme_TH',   // ð θ
    18: 'viseme_FF',   // f v
    19: 'viseme_DD',   // d t n -> DD.  LOSS: OVR puts n in nn, but all three share the same
                       //       tongue-tip alveolar closure and DD is the one that shows the
                       //       plosive release.
    20: 'viseme_kk',   // k g ŋ
    21: 'viseme_PP'    // p b m

} );

/**
 * The three Azure diphthongs, as an ordered pair of OVR shapes.
 *
 * The 0.6 split is the nucleus/offglide proportion: an English diphthong spends the majority of its
 * duration on the first target and glides to the second. ⚠️ 0.6 is an authored proportion, not a
 * measured one — no per-segment diphthong timing was found in `docs/research/` and none was
 * measured for this item. It is here so the mouth TRAVELS during a diphthong instead of sitting on
 * one shape, which is the property that matters; the exact split is a knob.
 */
export const DIPHTHONG_NUCLEUS_FRACTION = 0.6;

export const DIPHTHONGS = Object.freeze( {
    9:  Object.freeze( [ 'viseme_aa', 'viseme_U' ] ),   // aʊ
    10: Object.freeze( [ 'viseme_O', 'viseme_I' ] ),    // ɔɪ
    11: Object.freeze( [ 'viseme_aa', 'viseme_I' ] )    // aɪ
} );

/**
 * Every spelling of an OVR shape this module will accept, mapped to the one the figure carries.
 *
 * The `ih/oh/ou` rows are the naming gotcha from research §3: those are Oculus's own names for the
 * last three, and nothing else in the ecosystem uses them. Accepting a bare `PP` costs one row per
 * shape and removes a whole category of "why is nothing moving".
 */
export const OVR_ALIASES = Object.freeze( ( () => {

    const aliases = {};

    for ( const name of OVR_VISEMES ) {

        aliases[ name ] = name;
        aliases[ name.slice( 'viseme_'.length ) ] = name;   // 'PP', 'aa', 'sil', ...

    }

    aliases.ih = 'viseme_I';
    aliases.oh = 'viseme_O';
    aliases.ou = 'viseme_U';
    aliases.viseme_ih = 'viseme_I';
    aliases.viseme_oh = 'viseme_O';
    aliases.viseme_ou = 'viseme_U';

    return Object.freeze( aliases );

} )() );

/**
 * Peak weight per shape.
 *
 * research/affect-and-animation.md §3, TalkingHead's envelope: "PP and FF peak at 0.9; everything
 * else peaks at 0.6." Not a stylistic choice — a bilabial closure and a labiodental have to LAND
 * or the consonant is not visible, whereas a vowel driven to full deflection reads as a shout.
 */
export const DEFAULT_VISEME_PEAK = 0.6;
export const STRONG_VISEME_PEAK = 0.9;

export const VISEME_PEAK = Object.freeze( ( () => {

    const peaks = {};
    for ( const name of OVR_VISEMES ) peaks[ name ] = DEFAULT_VISEME_PEAK;

    peaks.viseme_PP = STRONG_VISEME_PEAK;
    peaks.viseme_FF = STRONG_VISEME_PEAK;

    return Object.freeze( peaks );

} )() );

/**
 * Consecutive identical visemes collapse into one entry at 0.7x the span they jointly covered
 * (research §3, TalkingHead's rule). Two `viseme_nn` back to back are one closure held slightly
 * short, not two closures — re-attacking the same shape produces a visible flutter that no
 * speaker's mouth does.
 */
export const REPEAT_MERGE_FACTOR = 0.7;

const warnedMessages = new Set();

/**
 * The canonical OVR name for whatever a caller handed us, or `TRANSPARENT`/`undefined`.
 *
 * Accepts: a shipped name (`viseme_PP`), a bare shape (`PP`), an Oculus tail name (`ou`), a
 * Microsoft shape name (`p_b_m_21`), or an Azure numeric id (21, or the string '21').
 *
 * @returns {string|null|undefined} The OVR name; `TRANSPARENT` (null) for a shape with no
 *   articulation of its own; `undefined` when the input is not a viseme at all. Diphthongs return
 *   the string 'DIPHTHONG' — resolve those with `diphthongPairFor` before scheduling.
 */
export function canonicalViseme( viseme ) {

    if ( typeof viseme === 'number' ) return microsoftIdToOvr( viseme );

    if ( typeof viseme !== 'string' ) return undefined;

    const direct = OVR_ALIASES[ viseme ];
    if ( direct !== undefined ) return direct;

    const microsoftIndex = MICROSOFT_VISEMES.indexOf( viseme );
    if ( microsoftIndex >= 0 ) return microsoftIdToOvr( microsoftIndex );

    // '21' arrives from JSON payloads that stringify their ids.
    if ( /^\d+$/.test( viseme ) ) return microsoftIdToOvr( Number( viseme ) );

    return undefined;

}

/** The OVR pair a diphthong travels between, or undefined if this is not one. */
export function diphthongPairFor( viseme ) {

    const id = typeof viseme === 'number' ? viseme
        : ( /^\d+$/.test( String( viseme ) ) ? Number( viseme ) : MICROSOFT_VISEMES.indexOf( String( viseme ) ) );

    return DIPHTHONGS[ id ];

}

/** Peak weight for a canonical OVR name. Unknown names get the default rather than zero. */
export function peakFor( ovrName ) {

    return VISEME_PEAK[ ovrName ] ?? DEFAULT_VISEME_PEAK;

}

/**
 * Turns whatever a TTS engine handed us into the timeline the scheduler is allowed to assume:
 * canonical OVR names, sorted by start, no transparent entries, no zero or negative durations, no
 * consecutive repeats, diphthongs expanded, and `peak` resolved per entry.
 *
 * Doing this once is not a convenience. A scheduler that normalises inside its own sampling loop
 * has its timing arithmetic tangled with its parsing, and this repo has spent three rounds proving
 * that timing arithmetic must be readable in isolation to be trustworthy.
 *
 * @param {Array<{viseme: string|number, startTime: number, duration: number}>} timeline
 *   `startTime` and `duration` in SECONDS, relative to the start of the utterance.
 * @param {Object} [options]
 * @param {boolean} [options.expandDiphthongs=true] - Split Azure 9/10/11 into their two targets.
 * @param {boolean} [options.mergeRepeats=true] - Apply REPEAT_MERGE_FACTOR to adjacent identicals.
 * @returns {Array<{viseme: string, startTime: number, duration: number, peak: number}>} Frozen
 *   entries in a frozen array — the schedule holds this for the life of an utterance and nothing
 *   downstream has any business editing it.
 */
export function normaliseTimeline( timeline, options = {} ) {

    const expandDiphthongs = options.expandDiphthongs ?? true;
    const mergeRepeats = options.mergeRepeats ?? true;

    const expanded = [];

    for ( const entry of timeline ) {

        const startTime = Number( entry.startTime );
        const duration = Number( entry.duration );

        if ( ! Number.isFinite( startTime ) || ! Number.isFinite( duration ) ) {

            warnOnce( `Visemes: entry for '${ entry.viseme }' has a non-finite time (${ entry.startTime }, ${ entry.duration }). Dropped.` );
            continue;

        }

        if ( duration <= 0 ) {

            warnOnce( `Visemes: entry for '${ entry.viseme }' has duration ${ duration }. Dropped — a viseme with no duration has no envelope.` );
            continue;

        }

        const canonical = canonicalViseme( entry.viseme );

        if ( canonical === TRANSPARENT ) continue;   // /h/ and anything else with no articulation

        if ( canonical === 'DIPHTHONG' ) {

            const pair = diphthongPairFor( entry.viseme );

            if ( expandDiphthongs === false ) {

                expanded.push( { viseme: pair[ 0 ], startTime, duration } );
                continue;

            }

            const nucleus = duration * DIPHTHONG_NUCLEUS_FRACTION;
            expanded.push( { viseme: pair[ 0 ], startTime, duration: nucleus } );
            expanded.push( { viseme: pair[ 1 ], startTime: startTime + nucleus, duration: duration - nucleus } );
            continue;

        }

        if ( canonical === undefined ) {

            warnOnce( `Visemes: '${ entry.viseme }' is not a viseme in any set this module knows. Dropped.` );
            continue;

        }

        expanded.push( { viseme: canonical, startTime, duration } );

    }

    // Stable sort by start. A TTS engine that streams out of order is not hypothetical: batched
    // payloads arrive per word and words can be revised.
    expanded.sort( ( a, b ) => a.startTime - b.startTime );

    const merged = mergeRepeats ? mergeAdjacentRepeats( expanded ) : expanded;

    return Object.freeze( merged.map( ( entry ) => Object.freeze( {
        viseme: entry.viseme,
        startTime: entry.startTime,
        duration: entry.duration,
        peak: peakFor( entry.viseme )
    } ) ) );

}

/** Total span of a normalised timeline, in seconds. Zero for an empty one. */
export function timelineDuration( timeline ) {

    let end = 0;

    for ( const entry of timeline ) {

        end = Math.max( end, entry.startTime + entry.duration );

    }

    return end;

}

// --- helpers -----------------------------------------------------------------------------------

function microsoftIdToOvr( id ) {

    if ( ! Number.isInteger( id ) || id < 0 || id >= MICROSOFT_VISEMES.length ) return undefined;

    return MICROSOFT_TO_OVR[ id ];

}

/**
 * Collapses runs of the same shape. The merged entry starts where the run started and lasts
 * REPEAT_MERGE_FACTOR of the run's whole span, so the shape is held slightly short and the mouth
 * has somewhere to go before the next one.
 */
function mergeAdjacentRepeats( entries ) {

    const merged = [];

    for ( const entry of entries ) {

        const previous = merged[ merged.length - 1 ];

        if ( previous !== undefined && previous.viseme === entry.viseme ) {

            const spanEnd = Math.max( previous.startTime + previous.duration, entry.startTime + entry.duration );
            previous.duration = ( spanEnd - previous.startTime ) * REPEAT_MERGE_FACTOR;
            continue;

        }

        merged.push( { viseme: entry.viseme, startTime: entry.startTime, duration: entry.duration } );

    }

    return merged;

}

function warnOnce( message ) {

    if ( warnedMessages.has( message ) ) return;

    warnedMessages.add( message );
    console.warn( message );

}
