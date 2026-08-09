/**
 * ExpressionMap — PAD in, one or two emotions out, and from those a face and a body. Punch-list
 * 5.4 and 5.5.
 *
 * 🚩 THRESHOLD AND SATURATE. NEVER PROXIMITY-BLEND.
 * ------------------------------------------------
 * research/affect-and-animation.md §1, on WASABI's activation function, is the sharpest
 * instruction in the whole research set and it is a standing constraint of this project:
 *
 *   > This is the direct answer to "how do I map a continuous affect vector to AUs without mush."
 *   > Do NOT linearly blend all emotions weighted by proximity — that produces the average face,
 *   > which IS the mush. Gate with a threshold so only 1-2 emotions are ever active, and saturate
 *   > so near-anchor movement doesn't flicker.
 *
 *      w = (1 - (d - DELTA) / (PHI - DELTA)) * i        where PHI > DELTA
 *
 * `d` is the distance from the current PAD point to the emotion's nearest anchor, DELTA the
 * saturation radius, PHI the activation radius, `i` the emotion's base intensity. A radial basis
 * function with a dead zone. `DEFECTS.proximityBlend` is the forbidden implementation, kept
 * reachable so the gate can be proved red against it rather than against an argument.
 *
 *
 * 🚩 DOMINANCE NEVER REACHES THE FACE, AND THAT IS ENFORCED BY TYPE
 * ----------------------------------------------------------------
 * Arellano et al. (AMDO 2014), n=109: pleasure reliably identified from a static face, arousal
 * mostly, "dominance not at all". `face()` therefore takes `{pleasure, arousal}` and THROWS if
 * handed anything carrying a `dominance` key — pass `AffectState.faceInput()`, which cannot
 * produce one. `body()` takes all three.
 *
 * Two consequences worth stating out loud, because both look like bugs and are not:
 *
 *   - **AU10 (upper lip raiser) is unreachable.** research §1 calls it "pure dominance, this is
 *     contempt". It is also a MOUTH shape, so `figure/ExpressionBank.js` already refuses it from an
 *     emotion caller. The two constraints were written independently and they agree; the one pure
 *     dominance unit in Arellano's table is doubly out of reach.
 *   - **`bored` and `depressed` have the same face.** Their WASABI anchors differ only in
 *     dominance (+100 vs -100). If the face carried dominance they would differ; it does not, so
 *     they differ in the BODY prescription and nowhere else. That is the constraint working, and
 *     it is the cheapest demonstration of why this project is full-body.
 *
 * ⚠️ AND A DEPARTURE FROM THE LETTER OF THE RESEARCH, RECORDED SO IT IS NOT MISTAKEN FOR AN
 * OVERSIGHT. research §1's AU activation table gives AU1, AU4, AU6 and AU10 as functions of
 * dominance. The same section, from the same paper, is where "dominance is not readable from a
 * static face" comes from, and the punch list turned that into a standing constraint. Both cannot
 * hold. This file keeps the constraint and drops the dominance-driven activation functions,
 * supplying AU1, AU2, AU4, AU6, AU7 and AU9 from the EMOTION LABEL instead — a discrete signal, not
 * a dominance level. The pure-pleasure and pure-arousal functions are implemented verbatim.
 *
 *
 * 🎯 THE MOUTH BELONGS TO LIPSYNC
 * -------------------------------
 * research §1 ranks "reserve the mouth for lipsync" as the second most cost-effective mitigation
 * for blendshape mush and says the single rule "eliminates most emotion x speech mush". `face()`
 * returns brow, eye, cheek and nose morphs absolutely, and the mouth appears only as
 * `mouthCornerOffset` — an ADDITIVE AU12/AU15 pair, capped at `ExpressionBank.MAX_CORNER_OFFSET`,
 * that `ExpressionLayer` lays over whatever the viseme put there. AU25 and AU26 are computed and
 * returned in `speechOwned` precisely so it is visible that they were computed and deliberately
 * not written.
 *
 *
 * WHERE THE CONSTANTS COME FROM
 * -----------------------------
 * WASABI's paper gives the anchor geometry and this project measured the two thresholds against
 * it; see DOMINANCE_METRIC_WEIGHT, SATURATION_THRESHOLD and ACTIVATION_THRESHOLD, each of which
 * carries its own derivation. Nothing here is a taste call except where it says so.
 */

import { MAX_CORNER_OFFSET } from '../figure/ExpressionBank.js';

/**
 * WASABI's emotion anchors, research §1, rescaled from the paper's -100..100 to this project's
 * -1..1, with each emotion's base intensity.
 *
 * 🚩 ONE VALUE IS NOT AS THE RESEARCH DOC TRANSCRIBES IT, AND THE REASON IS MEASURED.
 * `docs/research/affect-and-animation.md` §1 reads "Angry (80,80,100) 0.75". At +80 pleasure the
 * angry anchor is BIT-IDENTICAL to one of happy's four — (80,80,100) — and two emotions sharing an
 * anchor are inseparable under any distance-based activation: every PAD point in the cube gives
 * them the same distance, so anger and joy would fire together, at equal weight, forever. Measured
 * separation at the transcribed value: 0.0000. Becker-Asano's WASABI places anger at NEGATIVE
 * pleasure, ALMA's independent OCC table in the same research section gives Anger P = -0.51 and
 * Hate P = -0.6, and `affect.selftest.mjs` refuses any anchor set with a coincident pair. The sign
 * is restored here and a documentation fix is filed against the research doc.
 *
 * Two details from the research worth not losing: happiness occupies FOUR regions because "Ekman
 * has one positive emotion, so it must cover all of +P", and a base intensity of 0 means the
 * emotion "cannot fire from affect drift alone — cognition must trigger it." Surprise is inherently
 * event-driven; fear at 0.25 is "reluctant."
 */
export const WASABI_ANCHORS = Object.freeze( {

    angry:     freezeAnchor( [ [ -0.80, 0.80, 1.00 ] ], 0.75 ),
    annoyed:   freezeAnchor( [ [ -0.50, 0.00, 1.00 ] ], 0.75 ),
    bored:     freezeAnchor( [ [ 0.00, -0.80, 1.00 ] ], 0.75 ),
    depressed: freezeAnchor( [ [ 0.00, -0.80, -1.00 ] ], 0.75 ),
    fearful:   freezeAnchor( [ [ -0.80, 0.80, -1.00 ] ], 0.25 ),

    happy: freezeAnchor( [
        [ 0.80, 0.80, 1.00 ], [ 0.80, 0.80, -1.00 ],
        [ 0.50, 0.00, 1.00 ], [ 0.50, 0.00, -1.00 ]
    ], 0.75 ),

    sad:       freezeAnchor( [ [ -0.50, 0.00, -1.00 ] ], 0.75 ),
    surprised: freezeAnchor( [ [ 0.10, 0.80, 1.00 ], [ 0.10, 0.80, -1.00 ] ], 0.00 )

} );

/**
 * ALMA's OCC -> PAD table, research §1, verbatim. These are appraisal outcomes, not drift states:
 * every one carries base intensity 0, so none can fire from the PAD point alone and all of them are
 * available to `trigger()`. That is WASABI's own rule for surprise, applied to the whole OCC set —
 * "cognition must trigger it" describes an appraisal exactly.
 *
 * They are also what the two thresholds below were derived against, because a WASABI anchor set
 * that cannot express ALMA's own emotion vectors is not calibrated.
 */
export const ALMA_OCC_PAD = Object.freeze( {
    admiration:     Object.freeze( { pleasure: 0.5, arousal: 0.3, dominance: -0.2 } ),
    anger:          Object.freeze( { pleasure: -0.51, arousal: 0.59, dominance: 0.25 } ),
    disliking:      Object.freeze( { pleasure: -0.4, arousal: 0.2, dominance: 0.1 } ),
    disappointment: Object.freeze( { pleasure: -0.3, arousal: 0.1, dominance: -0.4 } ),
    distress:       Object.freeze( { pleasure: -0.4, arousal: -0.2, dominance: -0.5 } ),
    fear:           Object.freeze( { pleasure: -0.64, arousal: 0.60, dominance: -0.43 } ),
    fearsconfirmed: Object.freeze( { pleasure: -0.5, arousal: -0.3, dominance: -0.7 } ),
    gloating:       Object.freeze( { pleasure: 0.3, arousal: -0.3, dominance: -0.1 } ),
    gratification:  Object.freeze( { pleasure: 0.6, arousal: 0.5, dominance: 0.4 } ),
    gratitude:      Object.freeze( { pleasure: 0.4, arousal: 0.2, dominance: -0.3 } ),
    happyfor:       Object.freeze( { pleasure: 0.4, arousal: 0.2, dominance: 0.2 } ),
    hate:           Object.freeze( { pleasure: -0.6, arousal: 0.6, dominance: 0.3 } ),
    hope:           Object.freeze( { pleasure: 0.2, arousal: 0.2, dominance: -0.1 } ),
    joy:            Object.freeze( { pleasure: 0.4, arousal: 0.2, dominance: 0.1 } ),
    liking:         Object.freeze( { pleasure: 0.40, arousal: 0.16, dominance: -0.24 } ),
    love:           Object.freeze( { pleasure: 0.3, arousal: 0.1, dominance: 0.2 } ),
    pity:           Object.freeze( { pleasure: -0.4, arousal: -0.2, dominance: -0.5 } ),
    pride:          Object.freeze( { pleasure: 0.4, arousal: 0.3, dominance: 0.3 } ),
    relief:         Object.freeze( { pleasure: 0.2, arousal: -0.3, dominance: 0.4 } ),
    remorse:        Object.freeze( { pleasure: -0.3, arousal: 0.1, dominance: -0.6 } ),
    reproach:       Object.freeze( { pleasure: -0.3, arousal: -0.1, dominance: 0.4 } ),
    resentment:     Object.freeze( { pleasure: -0.2, arousal: -0.3, dominance: -0.2 } ),
    satisfaction:   Object.freeze( { pleasure: 0.3, arousal: -0.2, dominance: 0.4 } ),
    shame:          Object.freeze( { pleasure: -0.3, arousal: 0.1, dominance: -0.6 } )
} );

/**
 * How much a dominance disagreement counts in the activation distance. 1.0 would be plain
 * Euclidean PAD.
 *
 * 🎯 WHY IT IS NOT 1.0, AND WHY THE VALUE IS MEASURED RATHER THAN PICKED.
 *
 * Every WASABI anchor sits at |D| = 1, because WASABI's dominance is an essentially bimodal
 * appraisal — "am I in control of this or not" — while the dominance this project carries is a
 * continuous estimate that spends most of its life near the middle. At weight 1.0 a PAD point with
 * D = 0 is at least 1.0 from every anchor in the set, so nothing ever activates: measured, ALMA's
 * own Anger vector (-0.51, 0.59, 0.25) sits 0.833 from the angry anchor and fires nothing at any
 * threshold tight enough to keep the face legible.
 *
 * So the weight was derived against a criterion the research can adjudicate, since it supplies two
 * independent tables: EVERY ONE OF ALMA'S 24 OCC VECTORS MUST ACTIVATE AT LEAST ONE WASABI EMOTION,
 * at most two may be active on any of them, and Anger and Hate must reach `angry` with no `fearful`
 * component while Fear reaches `fearful` with no `angry` component — the pair
 * `docs/research/lm-studio-integration.md` says is "distinguishable ONLY by dominance". Sweeping
 * both thresholds over a 41^3 PAD grid, the feasible (weight, PHI) set is:
 *
 *      weight  feasible PHI    >=2 active   3+ active   worst discarded   coverage
 *      0.35    0.51..0.53         9.31%       0.000%      0.0000            65.3%
 *      0.40    0.54..0.59        11.03%       0.015%      0.0209            70.7%
 *      0.45    0.56..0.64        12.02%       0.049%      0.1229            73.5%
 *      0.50    0.59..0.70        15.85%       0.331%      0.2186            77.7%
 *      0.55    0.62..0.76        19.77%       0.844%      0.2889            81.1%
 *      0.60    0.65..0.82        24.18%       1.561%      0.3428            84.0%
 *      0.70    0.73..0.86        27.59%       2.832%      0.3977            85.7%
 *      0.80    0.81..0.90        32.03%       4.852%      0.4396            86.6%
 *      0.90    0.89..0.93        36.16%       7.356%      0.4701            85.5%
 *
 * (percentages over the 41^3 grid at each row's window midpoint; "coverage" is the fraction of
 * points with |(P,A)| >= 0.35 that activate anything at all.)
 *
 * The objective is the standing constraint — fewest simultaneous activations — subject to the
 * window being at least 0.10 wide, because a threshold sitting on the edge of its own feasible
 * window is a value one re-derivation away from being wrong. 0.50 is the smallest weight meeting
 * that, and PHI is its window's midpoint. Both are re-derived by `affect.selftest.mjs` rather than
 * trusted from this comment.
 */
export const DOMINANCE_METRIC_WEIGHT = 0.50;

/**
 * DELTA. Inside this radius an emotion sits at its full base intensity and small PAD movement
 * changes nothing — the anti-flicker half of the mechanism.
 *
 * Derived, not chosen: it is HALF THE MEASURED MINIMUM SEPARATION between the anchors of two
 * distinct emotions (0.7000, the happy/surprised pair, and independent of the dominance weight
 * above 0.35 because that pair differs only in pleasure). Half the minimum separation is the
 * largest radius at which two saturation balls can never overlap, so AT MOST ONE EMOTION IS EVER
 * SATURATED anywhere in the PAD cube. The self-test measures the separation and re-derives this.
 */
export const SATURATION_THRESHOLD = 0.35;

/** PHI. Beyond this an emotion contributes nothing at all. See DOMINANCE_METRIC_WEIGHT. */
export const ACTIVATION_THRESHOLD = 0.645;

/**
 * The hard cap, and why it exists on top of the threshold.
 *
 * research §1 says to "gate with a threshold so only 1-2 emotions are ever active", which reads as
 * though the threshold alone delivers it. Measured over a 41^3 grid, it does not: at the shipped
 * constants 63.3% of the cube has one emotion active, 15.5% has two, and 0.331% has three, the
 * largest third-place weight being 0.2186. Making the threshold tight enough to guarantee two by
 * geometry alone costs most of the cube — PHI <= 0.50 is required, and it silences eight of ALMA's
 * own emotion vectors. So the invariant is enforced where an invariant belongs, by construction,
 * and the threshold is tuned to make the cap almost never bite.
 */
export const MAX_ACTIVE_EMOTIONS = 2;

/**
 * Which AUs each emotion label contributes, on top of the continuous pleasure and arousal
 * functions. Every entry is at full strength and is scaled by the emotion's activation weight.
 *
 * This table is deliberately thin, and the reason is structural rather than economical. Six of
 * Arellano's ten activation functions are pure functions of pleasure or arousal, so an emotion that
 * also listed them would be restating a value the continuous path already owns — AU12 and AU15 for
 * pleasure, AU5, AU25, AU26 and AU43 for arousal. What is left over after removing those from the
 * validated per-mood sets is almost entirely BROW, which is exactly the region the continuous path
 * cannot supply, because Arellano gives AU1 and AU4 as functions of dominance and this project does
 * not let dominance near a face.
 *
 * Sources, per row:
 *   angry      Arellano validated Hostile set {4,10,5,15,25,26}. AU10 dropped (pure dominance, and
 *              a mouth shape); AU5/15/25/26 owned by the continuous path. AU7 added -- ⚠️ EMFACS
 *              anger prototype, NOT in docs/research. It is here because research §1 records that
 *              ARKit has no AU23 ("one of anger's most discriminative AUs") and the standing mouth
 *              constraint blocks the documented `mouthTighten` workaround, so anger has to read
 *              from the eyes.
 *   annoyed    Arellano Disdainful {4,15,43}, same removals; AU7 at the same reduced footing.
 *   bored      Arellano Bored {1,2,4,15,43}, matched by NAME rather than by octant: its anchor has
 *              pleasure exactly 0, so a sign lookup is ambiguous and the name is not.
 *   depressed  Arellano Bored, same as `bored` — they differ only in dominance. See the header.
 *   fearful    Arellano Anxious {1,2,4,5,15,25,26}.
 *   happy      Arellano Exuberant {6,5,12,25,26}. AU6 is the Duchenne marker and the one AU the
 *              continuous path would otherwise never produce.
 *   sad        Arellano Bored set. Its FACE separates from `bored` through the continuous path:
 *              sad's pleasure of -0.5 drives AU15 to full where bored's 0.0 drives it to nothing.
 *   surprised  Arellano Dependent {1,2,5,12,25,26}, AU12 dropped as pleasure-owned. What remains,
 *              AU1 + AU2 + AU5, is also the EMFACS surprise prototype.
 *   disliking  ⚠️ EMFACS disgust prototype {9,15,16}, of which only AU9 is reachable (AU15 is
 *              pleasure-owned, AU16 has no ARKit shape). Included because punch-list 5.7 names
 *              disgust explicitly and WASABI has no disgust anchor; ALMA's Disliking is the
 *              nearest thing either table offers, and AU9 is in the nose region, which affect owns.
 */
export const EMOTION_AU_SETS = Object.freeze( {
    angry:     Object.freeze( { AU4: 1.0, AU7: 0.7 } ),
    annoyed:   Object.freeze( { AU4: 1.0, AU7: 0.4 } ),
    bored:     Object.freeze( { AU1: 1.0, AU2: 1.0, AU4: 0.5 } ),
    depressed: Object.freeze( { AU1: 1.0, AU2: 1.0, AU4: 0.5 } ),
    fearful:   Object.freeze( { AU1: 1.0, AU2: 1.0, AU4: 1.0 } ),
    happy:     Object.freeze( { AU6: 1.0 } ),
    sad:       Object.freeze( { AU1: 1.0, AU2: 0.5, AU4: 1.0 } ),
    surprised: Object.freeze( { AU1: 1.0, AU2: 1.0 } ),
    disliking: Object.freeze( { AU9: 1.0 } )
} );

/**
 * AU -> ARKit morph targets, per Melinda Ozel's FACS cheat sheet, which research §1 names as the
 * best table available and which notes "there are many mistranslations out there".
 *
 * Partitioned by who owns the region. `emotion` is written absolutely by `ExpressionLayer`;
 * `additiveMouth` is the one sanctioned emotion route into the mouth and is capped; `speechOwned`
 * is computed and never written, because the mouth and jaw belong to lipsync.
 */
export const AU_MORPHS = Object.freeze( {

    emotion: Object.freeze( {
        AU1: Object.freeze( [ 'browInnerUp' ] ),
        AU2: Object.freeze( [ 'browOuterUpLeft', 'browOuterUpRight' ] ),
        AU4: Object.freeze( [ 'browDownLeft', 'browDownRight' ] ),
        AU5: Object.freeze( [ 'eyeWideLeft', 'eyeWideRight' ] ),
        AU6: Object.freeze( [ 'cheekSquintLeft', 'cheekSquintRight' ] ),
        AU7: Object.freeze( [ 'eyeSquintLeft', 'eyeSquintRight' ] ),
        AU9: Object.freeze( [ 'noseSneerLeft', 'noseSneerRight' ] ),
        AU43: Object.freeze( [ 'eyeBlinkLeft', 'eyeBlinkRight' ] )
    } ),

    additiveMouth: Object.freeze( {
        AU12: Object.freeze( [ 'mouthSmileLeft', 'mouthSmileRight' ] ),
        AU15: Object.freeze( [ 'mouthFrownLeft', 'mouthFrownRight' ] )
    } ),

    speechOwned: Object.freeze( {
        AU25: Object.freeze( [ 'mouthClose' ] ),
        AU26: Object.freeze( [ 'jawOpen' ] ),
        AU10: Object.freeze( [ 'mouthUpperUpLeft', 'mouthUpperUpRight' ] )
    } )

} );

/** Every morph name `face()` may return in its `morphs` bag. Declared by `ExpressionLayer`. */
export const EMOTION_MORPHS = Object.freeze(
    Object.values( AU_MORPHS.emotion ).flatMap( ( names ) => [ ...names ] ) );

export const MOUTH_CORNER_MORPHS = Object.freeze(
    Object.values( AU_MORPHS.additiveMouth ).flatMap( ( names ) => [ ...names ] ) );

/**
 * BAP loadings, Dael/Mortillaro/Scherer via research §5, and the reason this file has a `body()`
 * at all. The research reads them directly: "anger = forward lean + restrained symmetric arms +
 * rigid knees; fear = backward retreat + head aversion + knee activation; joy = broad symmetric
 * arms + head up + asymmetry; sadness = arms drawn in." An approach/avoidance axis crossed with an
 * arousal axis — "exactly the dominance channel the face cannot carry."
 *
 * Loadings are the published factor scores, normalised here by the largest of them (2.07) so every
 * channel lands in roughly [-1, 1]. The normaliser is arithmetic on the table, not a taste call.
 */
export const BAP_LOADING_SCALE = 2.07;

export const BAP_PRESCRIPTIONS = Object.freeze( {
    angry:     bap( { approach: 1.96, armSpread: -1.67, illustrative: 0.88 } ),
    annoyed:   bap( { approach: 1.96, armSpread: -1.67, illustrative: 0.88 } ),
    fearful:   bap( { approach: -1.46, kneeActivation: 1.77 } ),
    happy:     bap( { armSpread: 1.17, headTiltUp: 2.07 } ),
    surprised: bap( { armSpread: 1.17, headTiltUp: 2.07 } ),
    sad:       bap( { armSpread: -1.08 } ),
    depressed: bap( { armSpread: -1.08 } ),
    bored:     bap( {} )
} );

// ================================================================================================

export class ExpressionMap {

    /**
     * @param {Object} [options]
     * @param {number} [options.activationThreshold=ACTIVATION_THRESHOLD]
     * @param {number} [options.saturationThreshold=SATURATION_THRESHOLD]
     * @param {number} [options.dominanceWeight=DOMINANCE_METRIC_WEIGHT]
     * @param {number} [options.maxActive=MAX_ACTIVE_EMOTIONS]
     * @param {Object} [options.defects] - 🚩 Gate fodder only. See DEFECTS.
     */
    constructor( options = {} ) {

        this.activationThreshold = options.activationThreshold ?? ACTIVATION_THRESHOLD;
        this.saturationThreshold = options.saturationThreshold ?? SATURATION_THRESHOLD;
        this.dominanceWeight = options.dominanceWeight ?? DOMINANCE_METRIC_WEIGHT;
        this.maxActive = options.maxActive ?? MAX_ACTIVE_EMOTIONS;

        this.defects = { ...DEFECTS_OFF, ...( options.defects ?? {} ) };

        /** name -> intensity, set by `trigger()` and cleared by `clearTriggers()`. */
        this.triggers = new Map();

    }

    // --- selection ----------------------------------------------------------------------------

    /**
     * Fires an emotion that affect drift cannot reach on its own.
     *
     * research §1: "base intensity 0.0 means the emotion cannot fire from affect drift alone —
     * cognition must trigger it. Surprise is inherently event-driven." That applies to every ALMA
     * OCC emotion here, all of which are appraisal outcomes rather than drift states.
     *
     * A trigger still has to be geometrically plausible: it supplies the base intensity, and the
     * threshold still decides whether the current PAD point is anywhere near the emotion's anchor.
     * A `feel('joy')` while the PAD point sits in the depressive corner correctly produces nothing,
     * which is the behaviour that stops a bad tier-2 result from snapping the face.
     *
     * @param {string} name - A WASABI emotion or an ALMA OCC emotion, case-insensitive.
     * @param {number} [intensity=0.75] - Replaces the anchor's base intensity for this trigger.
     *   0.75 is WASABI's own base for its non-special emotions.
     */
    trigger( name, intensity = 0.75 ) {

        const key = String( name ).toLowerCase();

        if ( ANCHOR_SETS[ key ] === undefined ) {

            throw new Error(
                `ExpressionMap: '${ name }' is not an emotion. Known: ${ Object.keys( ANCHOR_SETS ).join( ', ' ) }.` );

        }

        this.triggers.set( key, Math.min( Math.max( intensity, 0 ), 1 ) );
        return this;

    }

    clearTriggers() {

        this.triggers.clear();
        return this;

    }

    /**
     * The WASABI activation, over the full PAD point.
     *
     * Selection is categorical and is NOT a face channel, which is why it sees dominance: choosing
     * between anger and fear is exactly the decision the record says only dominance can make, and
     * the label it produces then drives a face and a body that are computed separately.
     *
     * @param {{pleasure, arousal, dominance}} pad
     * @returns {Array<{emotion, weight, distance, saturated}>} At most `maxActive`, strongest first.
     */
    activate( pad ) {

        const point = [ pad.pleasure ?? 0, pad.arousal ?? 0, pad.dominance ?? 0 ];

        if ( this.defects.proximityBlend === true ) return this.proximityBlend( point );

        const delta = this.defects.noSaturation === true ? 0 : this.saturationThreshold;
        const phi = this.defects.wideThreshold === true ? WIDE_THRESHOLD_DEFECT : this.activationThreshold;

        const active = [];

        for ( const [ emotion, anchors ] of Object.entries( ANCHOR_SETS ) ) {

            const intensity = this.triggers.get( emotion ) ?? anchors.base;
            if ( intensity <= 0 ) continue;

            const distance = nearestDistance( point, anchors.points, this.dominanceWeight );
            if ( distance >= phi ) continue;

            const falloff = Math.min( 1, Math.max( 0, 1 - ( distance - delta ) / ( phi - delta ) ) );
            const weight = falloff * intensity;
            if ( weight <= 0 ) continue;

            active.push( { emotion, weight, distance, saturated: distance <= delta } );

        }

        active.sort( ( a, b ) => b.weight - a.weight || ( a.emotion < b.emotion ? -1 : 1 ) );

        return active.slice( 0, this.maxActive );

    }

    /**
     * 🚩 THE FORBIDDEN IMPLEMENTATION, kept reachable so the gate can be measured against it rather
     * than argued about. Inverse-distance weights over every anchor, normalised, no threshold and
     * no cap — "the average face, which IS the mush."
     */
    proximityBlend( point ) {

        const rows = [];
        let total = 0;

        for ( const [ emotion, anchors ] of Object.entries( ANCHOR_SETS ) ) {

            const distance = nearestDistance( point, anchors.points, this.dominanceWeight );
            const weight = 1 / ( 1 + distance );
            total += weight;
            rows.push( { emotion, weight, distance, saturated: false } );

        }

        for ( const row of rows ) row.weight /= total;
        rows.sort( ( a, b ) => b.weight - a.weight );

        return rows;

    }

    // --- the face -------------------------------------------------------------------------------

    /**
     * AU intensities and the morphs they drive, from the active emotions and PLEASURE AND AROUSAL
     * ONLY.
     *
     * @param {Array} activations - From `activate()`.
     * @param {{pleasure, arousal}} faceInput - `AffectState.faceInput()`. Anything carrying a
     *   `dominance` key throws.
     * @returns {{aus, morphs, mouthCornerOffset, speechOwned}}
     */
    face( activations, faceInput ) {

        assertNoDominance( faceInput );

        const pleasure = clampAxis( faceInput.pleasure );
        const arousal = clampAxis( faceInput.arousal );

        // Arellano's perceptually validated activation functions, verbatim, for the six that are
        // pure functions of one of the two axes a face can carry.
        const aus = {
            AU1: 0, AU2: 0, AU4: 0, AU7: 0, AU9: 0,
            AU5: au5( arousal ),
            AU6: 0,
            AU12: au12( pleasure ),
            AU15: au15( pleasure ),
            AU43: au43( arousal )
        };

        for ( const { emotion, weight } of activations ) {

            const set = EMOTION_AU_SETS[ emotion ];
            if ( set === undefined ) continue;

            // The strongest claim on a unit wins. Summing would double-count AUs that two active
            // emotions share, and with at most two active there is nothing an average buys.
            for ( const [ unit, strength ] of Object.entries( set ) ) {

                aus[ unit ] = Math.max( aus[ unit ] ?? 0, strength * weight );

            }

        }

        if ( this.defects.dominanceToFace === true ) {

            // 🚩 Defect A: the pure-dominance contempt unit, routed to the face through the nose.
            aus.AU9 = Math.max( aus.AU9, Math.max( 0, ( faceInput.__dominance ?? 0 ) ) );

        }

        if ( this.defects.dominanceToBrow === true ) {

            // 🚩 Defect B, structurally different: dominance as a signed BROW term, small enough
            // not to clamp. Any gate that only watches for AU10, or only watches the nose, says
            // this one is fine — and the first draft of this defect DID clamp at both ends of the
            // sweep, which made it invisible to the gate that exists to catch it.
            aus.AU4 = clampUnit( aus.AU4 + 0.25 * ( faceInput.__dominance ?? 0 ) );

        }

        const morphs = {};

        for ( const [ unit, names ] of Object.entries( AU_MORPHS.emotion ) ) {

            const value = clampUnit( aus[ unit ] ?? 0 );
            if ( value <= 0 ) continue;

            for ( const name of names ) morphs[ name ] = value;

        }

        // AU25 and AU26 are pure arousal and they are real. They are also mouth and jaw, so they
        // are reported and not written. Returning them is how "deliberately not routed" stays
        // visible instead of looking like an omission.
        const speechOwned = { AU25: au25( arousal ), AU26: au26( arousal ), AU10: 0 };

        return {
            aus,
            morphs,
            mouthCornerOffset: {
                smile: Math.min( aus.AU12 * MAX_CORNER_OFFSET, MAX_CORNER_OFFSET ),
                frown: Math.min( aus.AU15 * MAX_CORNER_OFFSET, MAX_CORNER_OFFSET )
            },
            speechOwned
        };

    }

    // --- the body -------------------------------------------------------------------------------

    /**
     * The prescription dominance is FOR. Numbers only; this file never writes a bone, and Phase
     * 6's `motion/Posture.js` and `motion/Gesture.js` are what consume it.
     *
     * @param {Array} activations - From `activate()`.
     * @param {{pleasure, arousal, dominance}} pad - All three axes, deliberately.
     */
    body( activations, pad ) {

        const dominance = clampAxis( pad.dominance ?? 0 );
        const arousal = clampAxis( pad.arousal ?? 0 );

        const prescription = {
            approach: 0, armSpread: 0, kneeActivation: 0, headTiltUp: 0, illustrative: 0
        };

        let totalWeight = 0;

        for ( const { emotion, weight } of activations ) {

            const loadings = BAP_PRESCRIPTIONS[ emotion ];
            if ( loadings === undefined ) continue;

            totalWeight += weight;
            for ( const channel of Object.keys( prescription ) ) {

                prescription[ channel ] += ( loadings[ channel ] ?? 0 ) * weight;

            }

        }

        if ( totalWeight > 0 ) {

            for ( const channel of Object.keys( prescription ) ) prescription[ channel ] /= totalWeight;

        }

        return {

            ...prescription,

            /**
             * The brief's third destination for dominance, and a bare mapping onto the unit
             * interval because the record names gesture amplitude as a dominance channel and gives
             * no coefficient. research 6.4: spend the expressivity budget on Spatial and Temporal
             * Extent, since "the other four GRETA parameters don't read (43.1% discrimination)".
             */
            gestureAmplitude: ( dominance + 1 ) / 2,
            temporalExtent: ( arousal + 1 ) / 2,

            /**
             * Andrist et al. via research §4: the AMOUNT of head alignment in a gaze shift changes
             * perceived character — more head reads affiliative and higher-rapport, less head reads
             * referential. "One scalar, two social registers."
             *
             * ⚠️ WHAT IS CITED IS THAT THE SCALAR HAS TWO REGISTERS, NOT WHICH END DOMINANCE SITS
             * AT. The direction here is a design choice: a dominant state holds its own frame and
             * turns less, an affiliative one turns to include the other party. Reverse it freely;
             * nothing measured supports either sign.
             */
            headAlignment: ( 1 - dominance ) / 2,

            /**
             * BEAT's literature-faithful rule, research §4: "gaze AWAY at THEME (70%), gaze TOWARD
             * at RHEME (73%)." Passed through unmodulated — dominance has no measured effect on
             * these two numbers and inventing one would put a fabricated coefficient on the one
             * channel research §6 says conveys personality "robust across character realism".
             */
            gazeAwayFractionTheme: 0.70,
            gazeAwayFractionRheme: 1 - 0.73,

            dominance

        };

    }

}

/**
 * 🚩 Named ways this module could be wrong. LEARNINGS §1.25a: a gate proved only against the
 * known-bad its author had in mind is decorative, so each pair below attacks the same class from a
 * different direction.
 *
 * class "the emotion selector produces mush":
 *     proximityBlend   no threshold at all — the exact implementation research §1 forbids
 *     noSaturation     threshold intact, dead zone removed. Still 1-2 active, so an active-count
 *                      gate stays green; what breaks is stability near an anchor.
 *     wideThreshold    dead zone intact, PHI opened up. An anchor-stability gate stays green.
 *
 * class "dominance reached the face":
 *     dominanceToFace  routed to AU9 / the nose
 *     dominanceToBrow  routed to AU4 / the brow, at a different magnitude
 */
export const DEFECTS = Object.freeze( {
    proximityBlend: 'inverse-distance weights over every anchor, normalised — the average face',
    noSaturation: 'the RBF without its dead zone, so near-anchor movement flickers',
    wideThreshold: 'PHI opened past the feasible window, so three or more fire at once',
    dominanceToFace: 'dominance routed into AU9',
    dominanceToBrow: 'dominance routed into AU4'
} );

const DEFECTS_OFF = Object.freeze( Object.fromEntries( Object.keys( DEFECTS ).map( ( key ) => [ key, false ] ) ) );

/** PHI for `defects.wideThreshold`. Past the top of every feasible window in the table above. */
const WIDE_THRESHOLD_DEFECT = 1.2;

/**
 * 🚩 How the two dominance defects get hold of a value the type system is built to keep out.
 *
 * `face()` throws on a `dominance` key, so a leak cannot be modelled by simply passing one. What it
 * CAN be modelled by is the realistic mistake: someone carries the axis past the guard under
 * another name. The two defect modes read `faceInput.__dominance`, which is what a gate supplies,
 * and which no shipping caller produces — `AffectState.faceInput()` returns a frozen two-key
 * object.
 */

// --- Arellano's activation functions, verbatim from research §1 ---------------------------------
//
// Only the pure-pleasure and pure-arousal ones. The dominance-driven members of the same table are
// not implemented; see the file header for why, and note that AU10, the one the research calls
// "pure dominance", is a mouth shape and would be refused by ExpressionBank even if it were.

/** AU12, lip corner puller — "pure valence": 0 for p<0, 2.0p for p in [0,0.5), 1.0 above. */
export function au12( p ) {

    if ( p < 0 ) return 0;
    if ( p < 0.5 ) return 2.0 * p;
    return 1.0;

}

/** AU15, lip corner depressor: 0 for p>0, -2.0p for p in (-0.5,0], 1.0 below. */
export function au15( p ) {

    if ( p > 0 ) return 0;
    if ( p > -0.5 ) return -2.0 * p;
    return 1.0;

}

/** AU5, upper lid raiser — "pure arousal": 0 for a<=0.1, (a-0.1)/0.7 for a in (0.1,0.8), 1.0 above. */
export function au5( a ) {

    if ( a <= 0.1 ) return 0;
    if ( a < 0.8 ) return ( a - 0.1 ) / 0.7;
    return 1.0;

}

/** AU25, lips part — pure arousal: 0 below 0.3, (a-0.3)/0.4 for a in (0.3,0.7), 1.0 above. */
export function au25( a ) {

    if ( a <= 0.3 ) return 0;
    if ( a < 0.7 ) return ( a - 0.3 ) / 0.4;
    return 1.0;

}

/** AU26, jaw drop: 0 below 0.35, (a-0.35)/0.25 for a in (0.35,0.6), 1.0 above. */
export function au26( a ) {

    if ( a <= 0.35 ) return 0;
    if ( a < 0.6 ) return ( a - 0.35 ) / 0.25;
    return 1.0;

}

/** AU43, eye closure — negative arousal: a/(-0.6) for a in (-0.6,0), 1.0 below. */
export function au43( a ) {

    if ( a >= 0 ) return 0;
    if ( a > -0.6 ) return a / -0.6;
    return 1.0;

}

// --- the anchor set, and the distance -----------------------------------------------------------

/**
 * WASABI's eight plus ALMA's twenty-four, in one index. The ALMA rows carry base intensity 0, so
 * they exist only for `trigger()` and cannot change what affect drift produces — which is the
 * property the threshold derivation depends on.
 */
const ANCHOR_SETS = Object.freeze( ( () => {

    const sets = {};

    for ( const [ name, spec ] of Object.entries( WASABI_ANCHORS ) ) {

        sets[ name ] = { points: spec.points, base: spec.base };

    }

    for ( const [ name, pad ] of Object.entries( ALMA_OCC_PAD ) ) {

        if ( sets[ name ] !== undefined ) continue;

        sets[ name ] = { points: [ [ pad.pleasure, pad.arousal, pad.dominance ] ], base: 0 };

    }

    return sets;

} )() );

export { ANCHOR_SETS };

/** Distance to the nearest of an emotion's anchors, with dominance down-weighted. */
export function nearestDistance( point, anchors, dominanceWeight ) {

    let best = Infinity;

    for ( const anchor of anchors ) {

        const dp = point[ 0 ] - anchor[ 0 ];
        const da = point[ 1 ] - anchor[ 1 ];
        const dd = ( point[ 2 ] - anchor[ 2 ] ) * dominanceWeight;

        best = Math.min( best, Math.sqrt( dp * dp + da * da + dd * dd ) );

    }

    return best;

}

/** The minimum separation between two DISTINCT emotions' anchors. SATURATION_THRESHOLD is half it. */
export function minimumAnchorSeparation( dominanceWeight = DOMINANCE_METRIC_WEIGHT, sets = WASABI_ANCHORS ) {

    const names = Object.keys( sets );
    let best = Infinity;
    let pair = '';

    for ( let i = 0; i < names.length; i ++ ) {

        for ( let j = i + 1; j < names.length; j ++ ) {

            for ( const p of sets[ names[ i ] ].points ) {

                const distance = nearestDistance( p, sets[ names[ j ] ].points, dominanceWeight );
                if ( distance < best ) {

                    best = distance;
                    pair = `${ names[ i ] }/${ names[ j ] }`;

                }

            }

        }

    }

    return { separation: best, pair };

}

// --- helpers -------------------------------------------------------------------------------------

function freezeAnchor( points, base ) {

    return Object.freeze( { points: Object.freeze( points.map( ( p ) => Object.freeze( p ) ) ), base } );

}

function bap( loadings ) {

    const scaled = {};
    for ( const [ channel, value ] of Object.entries( loadings ) ) scaled[ channel ] = value / BAP_LOADING_SCALE;
    return Object.freeze( scaled );

}

/**
 * The structural guard. A face input carrying a dominance axis is a programming error, it is the
 * one this project has a standing constraint about, and it surfaces on the first frame with the
 * name of the axis in the message.
 */
function assertNoDominance( faceInput ) {

    if ( faceInput === null || typeof faceInput !== 'object' ) {

        throw new Error( 'ExpressionMap.face() needs a {pleasure, arousal} object — see AffectState.faceInput().' );

    }

    if ( 'dominance' in faceInput ) {

        throw new Error(
            'ExpressionMap.face() was handed a PAD carrying dominance. Dominance is not readable ' +
            'from a static face (Arellano et al., AMDO 2014, n=109) and this project routes it to ' +
            'posture, gaze policy and gesture amplitude instead. Pass AffectState.faceInput(), and ' +
            'pass the full PAD to body().' );

    }

}

function clampAxis( value ) {

    if ( typeof value !== 'number' || Number.isNaN( value ) ) return 0;
    return Math.min( Math.max( value, -1 ), 1 );

}

function clampUnit( value ) {

    if ( typeof value !== 'number' || Number.isNaN( value ) ) return 0;
    return Math.min( Math.max( value, 0 ), 1 );

}
