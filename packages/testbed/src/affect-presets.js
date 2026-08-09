/**
 * The demonstration PAD points every testbed page poses, in one place.
 *
 * 🎯 It is a module rather than a table in `affect.js` because `alive.html` — the page the seven
 * objective gates are measured on and the page a judge captures — carries `?affect=<preset>` and
 * must pose the SAME points. Two copies of a preset table is how two pages come to disagree about
 * what "joy" is, and then a critic compares a plate from one against a plate from the other.
 *
 * The presets a screenshot pass compares.
 *
 * These are PAD points, not emotion names, because the point of the page is that the emotion is
 * SELECTED from the point. `joy`, `anger` and `fear` are the three the punch list asks a judge to
 * look at; `anger` and `fear` are deliberately identical in pleasure and arousal and opposite in
 * dominance, which makes them the demonstration that dominance decides the label and never the AU
 * intensities.
 */
export const EMOTION_PRESETS = Object.freeze( {
    neutral: { pleasure: 0, arousal: 0, dominance: 0 },
    joy: { pleasure: 0.90, arousal: 0.60, dominance: 0.50 },
    anger: { pleasure: -0.80, arousal: 0.70, dominance: 0.70 },
    fear: { pleasure: -0.80, arousal: 0.70, dominance: -0.70 },
    sadness: { pleasure: -0.60, arousal: -0.10, dominance: -0.60 },
    bored: { pleasure: 0.00, arousal: -0.70, dominance: 0.60 },
    surprise: { pleasure: 0.10, arousal: 0.80, dominance: 0.20, trigger: 'surprised' },
    disgust: { pleasure: -0.45, arousal: 0.20, dominance: 0.10, trigger: 'disliking' }
} );

/** The preset names, for an error message that tells a caller what it could have asked for. */
export const EMOTION_PRESET_NAMES = Object.freeze( Object.keys( EMOTION_PRESETS ) );

/**
 * Runs an `AffectState` forward until the fast layer has arrived, so a still plate is reproducible.
 *
 * Not a back door: it is the same arithmetic the frame loop does, at a larger fixed step. A plate
 * of a face caught mid-attack is a plate of a different face, and 3 s is fifteen attack time
 * constants — the residual is under 1e-6 of an axis.
 */
export function settleAffect( state ) {

    for ( let step = 0; step < 300; step ++ ) state.update( 0.01 );

}
