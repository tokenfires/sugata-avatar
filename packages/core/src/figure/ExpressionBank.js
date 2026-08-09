/**
 * ExpressionBank — the semantic layer over raw morph names.
 *
 * Figure knows that `jawOpen` lives on four meshes. It does not know that `jawOpen` belongs to
 * speech and `browInnerUp` belongs to emotion, and that letting those two systems write the same
 * shapes is the single largest source of "the face looks like mush." That is this file's job.
 *
 * WHY THE REGIONS ARE LOAD-BEARING
 * --------------------------------
 * Linear blending of overlapping blendshapes double-transforms vertices and drifts off-model.
 * docs/research/affect-and-animation.md §1 ranks the mitigations by cost-effectiveness, and the
 * top two are structural rather than artistic:
 *
 *   1. Region segmentation — brow / eye / mid-face / mouth-jaw blend independently.
 *   2. Reserve the mouth for lipsync. Emotion drives brow/eye/cheek; the mouth gets an
 *      ADDITIVE corner offset (AU12 / AU15) on top of the viseme, never a competing absolute
 *      target. "This single rule eliminates most emotion x speech mush."
 *
 * So the 52 ARKit targets are partitioned into seven regions with no overlap and no omission,
 * and ownership is expressed as data:
 *
 *   EMOTION_REGIONS = brow, eye, cheek, nose     <- affect writes these absolutely
 *   SPEECH_REGIONS  = mouth, jaw, tongue         <- lipsync writes these absolutely
 *
 * `applyRegion` refuses names from outside the region it was handed. That refusal is the whole
 * enforcement mechanism: an affect layer physically cannot reach `mouthPucker` through this
 * module. Its only sanctioned route to the mouth is `addMouthCornerOffset`, which adds rather
 * than assigns and is capped well below full deflection.
 *
 * THE MISSING UNIT
 * ----------------
 * ARKit has no equivalent for AU23 (lip tightener), one of anger's most discriminative units
 * (affect-and-animation.md §1: "If anger must read strongly, author a custom mouthTighten
 * shape."). The shipped figures do not carry one — MPFB2's faceunits01 pack is the canonical 52
 * and nothing more. CUSTOM_SHAPES declares the slot, records where it belongs (mouth region,
 * additive, speech-owned), and ships a documented approximation built from shapes that DO exist
 * so anger is not simply unavailable in the meantime. When a real `mouthTighten` target is
 * sculpted into the pipeline, `applyCustomShape` finds it on the figure and the approximation
 * stops being used — no call sites change.
 *
 * All apply* functions write into `figure.weights` and rely on the caller's frame cycle:
 *
 *     figure.beginFrame();
 *     applyRegion( figure, 'brow', emotionBrow );
 *     applyRegion( figure, 'mouth', visemeMouth );
 *     addMouthCornerOffset( figure, { smile: 0.25 } );
 *     figure.commit();
 */

/**
 * The canonical Apple ARKit 52, partitioned. Every name appears in exactly one region; the
 * self-test asserts that, because a silent overlap here would reintroduce exactly the fighting
 * this structure exists to prevent.
 *
 * The split follows facial anatomy rather than ARKit's name prefixes in one place worth
 * flagging: `cheekSquintLeft/Right` (AU6, the Duchenne marker) sits in `cheek` and not `eye`,
 * even though it is what makes a smile reach the eyes. Affect owns both regions, so the smile
 * still assembles correctly; keeping them separate lets a squint be dialled without disturbing
 * lid aperture, which blink owns.
 */
export const ARKIT_REGIONS = Object.freeze( {

    brow: Object.freeze( [
        'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'
    ] ),

    eye: Object.freeze( [
        'eyeBlinkLeft', 'eyeBlinkRight',
        'eyeLookDownLeft', 'eyeLookDownRight',
        'eyeLookInLeft', 'eyeLookInRight',
        'eyeLookOutLeft', 'eyeLookOutRight',
        'eyeLookUpLeft', 'eyeLookUpRight',
        'eyeSquintLeft', 'eyeSquintRight',
        'eyeWideLeft', 'eyeWideRight'
    ] ),

    cheek: Object.freeze( [
        'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight'
    ] ),

    nose: Object.freeze( [
        'noseSneerLeft', 'noseSneerRight'
    ] ),

    mouth: Object.freeze( [
        'mouthClose',
        'mouthDimpleLeft', 'mouthDimpleRight',
        'mouthFrownLeft', 'mouthFrownRight',
        'mouthFunnel',
        'mouthLeft', 'mouthRight',
        'mouthLowerDownLeft', 'mouthLowerDownRight',
        'mouthPressLeft', 'mouthPressRight',
        'mouthPucker',
        'mouthRollLower', 'mouthRollUpper',
        'mouthShrugLower', 'mouthShrugUpper',
        'mouthSmileLeft', 'mouthSmileRight',
        'mouthStretchLeft', 'mouthStretchRight',
        'mouthUpperUpLeft', 'mouthUpperUpRight'
    ] ),

    jaw: Object.freeze( [
        'jawForward', 'jawLeft', 'jawOpen', 'jawRight'
    ] ),

    tongue: Object.freeze( [
        'tongueOut'
    ] )

} );

export const REGION_NAMES = Object.freeze( Object.keys( ARKIT_REGIONS ) );

/** The 52, flattened. Order is region order, not alphabetical. */
export const ARKIT_52 = Object.freeze(
    REGION_NAMES.flatMap( ( region ) => ARKIT_REGIONS[ region ] )
);

/**
 * Who owns what. Punch-list 1.4 and standing constraint "the mouth belongs to lipsync" reduce
 * to these two lists, and every guard in this file reads them rather than restating the rule.
 */
export const EMOTION_REGIONS = Object.freeze( [ 'brow', 'eye', 'cheek', 'nose' ] );
export const SPEECH_REGIONS = Object.freeze( [ 'mouth', 'jaw', 'tongue' ] );

/**
 * The 15 Meta/Oculus visemes, kept deliberately separate from the ARKit regions. They are a
 * parallel namespace over the same mouth geometry, driven by the speech timeline rather than by
 * the affect state, and they must never be treated as one more region to blend.
 */
export const OVR_VISEMES = Object.freeze( [
    'viseme_sil',
    'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH',
    'viseme_SS', 'viseme_nn', 'viseme_RR',
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
] );

/**
 * Shapes ARKit does not have, that this project needs anyway.
 *
 * `approximation` is a fallback built from shapes the figure really carries, used only while
 * `morph` is absent from the asset. It is an approximation and is labelled as one: AU23 narrows
 * and firms the vermilion border, which mouthPress (AU24-ish) plus a trace of funnel gestures at
 * without truly reproducing. Good enough to keep anger legible; not good enough to ship as final.
 */
export const CUSTOM_SHAPES = Object.freeze( {

    mouthTighten: Object.freeze( {
        morph: 'mouthTighten',
        facs: 'AU23 lip tightener',
        region: 'mouth',
        reason: 'ARKit omits AU23, one of anger\'s most discriminative units.',
        status: 'not authored — sculpt into tools/figure-pipeline and it will be used automatically',
        approximation: Object.freeze( {
            mouthPressLeft: 0.60,
            mouthPressRight: 0.60,
            mouthFunnel: 0.15
        } )
    } )

} );

// Reverse index, built once. Region membership is asked far more often than it changes.
const REGION_BY_MORPH_NAME = new Map();
for ( const region of REGION_NAMES ) {

    for ( const name of ARKIT_REGIONS[ region ] ) {

        REGION_BY_MORPH_NAME.set( name, region );

    }

}

const warnedMessages = new Set();

/**
 * Which region a morph belongs to, or undefined for anything outside the ARKit 52 (visemes,
 * the Microsoft SSML set, gender morphs).
 */
export function regionOf( morphName ) {

    return REGION_BY_MORPH_NAME.get( morphName );

}

/**
 * Writes one region's shapes, absolutely, into the figure's frame accumulator.
 *
 * Absolute rather than additive is the correct semantic INSIDE a region: the layer that owns a
 * region owns it outright for the frame, so blink can assert full closure without an emotion
 * layer's residual lid weight fighting it. Independence between regions is what makes that safe.
 *
 * Names outside the named region are rejected and warned about once. That rejection is how
 * "emotion never writes absolute mouth targets" is enforced rather than merely documented.
 *
 * @param {import('./Figure.js').Figure} figure
 * @param {string} region - One of REGION_NAMES.
 * @param {Object<string, number>} values - Morph name -> weight, all within that region.
 */
export function applyRegion( figure, region, values ) {

    const members = ARKIT_REGIONS[ region ];

    if ( members === undefined ) {

        warnOnce( `ExpressionBank: '${ region }' is not a region. Expected one of ${ REGION_NAMES.join( ', ' ) }.` );
        return;

    }

    for ( const name in values ) {

        if ( REGION_BY_MORPH_NAME.get( name ) !== region ) {

            const actual = REGION_BY_MORPH_NAME.get( name ) ?? 'no ARKit region';
            warnOnce(
                `ExpressionBank: '${ name }' belongs to ${ actual }, not '${ region }'. Ignored. ` +
                'Emotion must reach the mouth through addMouthCornerOffset, never applyRegion.'
            );
            continue;

        }

        if ( ! figure.hasMorph( name ) ) continue;   // Figure warns; no need to warn twice.

        figure.weights[ name ] = values[ name ];

    }

}

/**
 * The ONE sanctioned way for affect to touch the mouth: an additive corner offset laid over
 * whatever the viseme put there.
 *
 * Arellano's perceptually validated activation functions make AU12 (lip corner puller) and AU15
 * (lip corner depressor) pure functions of pleasure, which is why these two and no others.
 * Because the contribution is added rather than assigned, a smile survives a talking mouth
 * instead of replacing it — the viseme keeps its shape and the corners ride on top.
 *
 * The cap exists because a full-deflection smile IS an absolute mouth target by another name.
 * At MAX_CORNER_OFFSET the corners read clearly and the viseme underneath is still legible.
 *
 * @param {import('./Figure.js').Figure} figure
 * @param {Object} offsets
 * @param {number} [offsets.smile=0] - AU12, from positive pleasure.
 * @param {number} [offsets.frown=0] - AU15, from negative pleasure.
 * @param {number} [offsets.cap=MAX_CORNER_OFFSET] - which cap to clamp to; see the two constants.
 */
export const MAX_CORNER_OFFSET = 0.35;

/**
 * The cap when the mouth is SILENT.
 *
 * 🚩 The 0.35 cap's own stated reason is that "the viseme underneath is still legible". When
 * nothing is speaking there is no viseme, and the reason does not apply — while the cost of
 * applying it anyway is measured: `mouthSmileLeft` travels **18.68 mm** at weight 1 on
 * `figure_g050`, so 0.35 delivers **6.54 mm** and discards the other 12.14 mm. That is the single
 * largest reason a settled joy renders as polite rather than joyful (Phase 5.7).
 *
 * This is still the same additive AU12/AU15 offset the standing constraint permits — it is that
 * offset over nothing, rather than a second absolute mouth target.
 *
 * ⚠️ RAMP between the two caps rather than switching, or a smile pops the instant speech starts.
 * `voice/VisemeLayer.js` publishes `context.shared.speaking` for exactly this decision.
 */
export const MAX_CORNER_OFFSET_SILENT = 1.0;

export function addMouthCornerOffset( figure, { smile = 0, frown = 0, cap = MAX_CORNER_OFFSET } = {} ) {

    const smileOffset = clampToCorner( smile, cap );
    const frownOffset = clampToCorner( frown, cap );

    addWeight( figure, 'mouthSmileLeft', smileOffset );
    addWeight( figure, 'mouthSmileRight', smileOffset );
    addWeight( figure, 'mouthFrownLeft', frownOffset );
    addWeight( figure, 'mouthFrownRight', frownOffset );

}

/**
 * Writes viseme weights absolutely. Separate from applyRegion because visemes are their own
 * namespace, not an eighth region — the speech layer owns the whole viseme set for the frame.
 *
 * @param {import('./Figure.js').Figure} figure
 * @param {Object<string, number>} values - Viseme name -> weight.
 */
export function applyVisemes( figure, values ) {

    for ( const name in values ) {

        if ( ! OVR_VISEMES.includes( name ) ) {

            warnOnce( `ExpressionBank: '${ name }' is not an OVR viseme. Ignored.` );
            continue;

        }

        if ( ! figure.hasMorph( name ) ) continue;

        figure.weights[ name ] = values[ name ];

    }

}

/**
 * Applies a shape ARKit does not define. Uses the real morph target when the figure carries one
 * and the documented approximation when it does not, so call sites never branch on whether the
 * art pass has happened yet.
 *
 * Contributions are additive, because every custom shape so far is a corrective laid over
 * whatever the owning region already wrote.
 *
 * @param {import('./Figure.js').Figure} figure
 * @param {string} shapeName - A key of CUSTOM_SHAPES, e.g. 'mouthTighten'.
 * @param {number} weight
 */
export function applyCustomShape( figure, shapeName, weight ) {

    const shape = CUSTOM_SHAPES[ shapeName ];

    if ( shape === undefined ) {

        warnOnce( `ExpressionBank: no custom shape named '${ shapeName }'.` );
        return;

    }

    if ( figure.hasMorph( shape.morph ) ) {

        addWeight( figure, shape.morph, weight );
        return;

    }

    warnOnce(
        `ExpressionBank: '${ shape.morph }' (${ shape.facs }) is not in this figure, ` +
        'falling back to its documented approximation. See CUSTOM_SHAPES.'
    );

    for ( const name in shape.approximation ) {

        addWeight( figure, name, shape.approximation[ name ] * weight );

    }

}

/**
 * Which of the 52 the figure is actually missing. A build that silently drops targets should be
 * caught at startup by the caller, not diagnosed later from a face that will not frown.
 *
 * @returns {string[]} Empty when the figure carries all 52.
 */
export function missingArkitShapes( figure ) {

    return ARKIT_52.filter( ( name ) => ! figure.hasMorph( name ) );

}

// --- helpers -------------------------------------------------------------------------------

function addWeight( figure, name, amount ) {

    if ( ! figure.hasMorph( name ) ) return;

    figure.weights[ name ] += amount;

}

function clampToCorner( offset, cap = MAX_CORNER_OFFSET ) {

    if ( ! ( offset > 0 ) ) return 0;   // also catches NaN and undefined
    return Math.min( offset, cap );

}

function warnOnce( message ) {

    if ( warnedMessages.has( message ) ) return;

    warnedMessages.add( message );
    console.warn( message );

}
