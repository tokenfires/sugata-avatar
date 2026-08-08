/**
 * FacialIdle — the resting substrate of a silent face.
 *
 * WHY THIS LAYER EXISTS
 *
 * A twenty-second capture of the motion stack before this file was written showed exactly ten
 * morph channels ever leaving zero: eight `eyeLook*` and two `eyeBlink*`. Nothing else on the
 * face moved at all. The judge's words: "a completely static mask under moving eyes reads as a
 * photograph someone animated the eyes onto." That is the failure this layer answers, and the
 * answer is not more expression — it is the involuntary activity a face has when it is doing
 * nothing.
 *
 *
 * WHAT IT IS NOT
 *
 * Not emotion (Phase 5 owns affect → AU). Not speech (Phase 4 owns visemes and the jaw). This is
 * the floor both of those sit on: muscle tone, obligatory lid mechanics, slow asymmetric drift,
 * and four involuntary events. If a viewer can name anything this layer is doing, its amplitudes
 * are wrong.
 *
 *
 * THE FIVE THINGS IT DOES
 *
 *   1. LID FOLLOW GAZE — the one that is anatomically obligatory. The upper lid rides the globe:
 *      look down and the lid comes down with it, look up and it retracts. A face whose lids
 *      ignore its eyes reads as a doll on the first frame, and no amount of brow or mouth
 *      activity buys that back. Derived from the asset's own eye excursions, below.
 *
 *   2. BROW MICRO-MOTION — slow, asymmetric, low-amplitude drift, plus occasional small raises.
 *      Humans mark conversational and cognitive boundaries with the brow even in silence.
 *
 *   3. RESTING MOUTH — a neutral mouth is not a zeroed mouth. A small standing asymmetry, a very
 *      slow drift on it, an occasional lip press, and a swallow at roughly one a minute.
 *
 *   4. NOSTRIL/BREATH COUPLING — a trace of `noseSneer` phase-locked to the Breath layer's tidal
 *      level, so the face participates in the breath the body is already taking.
 *
 *   5. CHEEK AND JAW SETTLE — resting tone in the cheeks, and the millimetre of freeway space a
 *      real jaw hangs at rather than being clamped shut.
 *
 *
 * 🚩 THE MOUTH IS RESERVED FOR LIPSYNC, AND THIS LAYER RESPECTS THAT
 *
 * `docs/research/affect-and-animation.md` §1 ranks "reserve the mouth for lipsync" as the single
 * architectural rule that removes most emotion×speech mush, and `figure/ExpressionBank.js` makes
 * it structural: `mouth`, `jaw` and `tongue` are speech-owned, and the only sanctioned route into
 * them from outside speech is an ADDITIVE offset. Three things keep this layer inside that rule:
 *
 *   - Everything it writes is additive at the point it matters. MotionStack sums morph channels
 *     across layers, so a 0.06 `mouthPressLeft` from here lands ON TOP of whatever the viseme
 *     layer wrote rather than replacing it. The emotion-owned regions go through ExpressionBank's
 *     `applyRegion`, which refuses misfiled names; the speech-owned regions never do, because
 *     `applyRegion` is an absolute write by contract and this layer has no right to one there.
 *   - The corners go through `addMouthCornerOffset`, the one sanctioned affect→mouth route.
 *   - Every region can be switched off on its own: `setRegionEnabled( 'mouth', false )` and
 *     `setRegionEnabled( 'jaw', false )` hand both back to Phase 4 with no other change.
 *
 *
 * AMPLITUDES
 *
 * The failure mode of a layer like this is a face that pulls faces at itself, so every channel
 * carries a hard ceiling (`IDLE_CHANNELS` below) and the clamp is applied at the single choke
 * point every write passes through. Drift sits under 0.06; only a deliberate event — a brow
 * raise, a swallow — reaches ~0.25. `FacialIdle.selftest.mjs` measures the RMS and peak of every
 * channel over 300 s and fails if any ceiling is breached.
 *
 *
 * USAGE
 *
 *     const facialIdle = new FacialIdle();
 *     stack.add( facialIdle );                       // after Gaze and Blink; it reads both
 *
 *     facialIdle.setRegionEnabled( 'mouth', false ); // Phase 4 taking the mouth back
 *     facialIdle.setBreathPhase( tidalLevel );       // only if no Breath layer is in the stack
 */

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { CoherentNoise1D, PoissonSchedule } from './Signals.js';
import { EYE_MORPH_EXCURSION_DEGREES } from './Gaze.js';
import { BLINK_CONSTANTS } from './Blink.js';
import { EMOTION_REGIONS, addMouthCornerOffset, applyRegion, regionOf } from '../figure/ExpressionBank.js';

// --- channels and their ceilings ----------------------------------------------------------------

/**
 * Every channel this layer may write, grouped by ExpressionBank region, with the hard ceiling on
 * each. This table is the single source of truth for three things — the layer's channel
 * declaration, the per-region scratch buffers, and the clamp — so a channel cannot be written
 * without a ceiling, and a ceiling cannot exist for a channel nobody declared.
 *
 * The numbers are the answer to "what is the largest this channel is ever allowed to be", not
 * "what it normally is". Normal is roughly a fifth of these; see the drift constants below.
 */
export const IDLE_CHANNELS = Object.freeze( {

    brow: Object.freeze( {
        browInnerUp: 0.28,
        browOuterUpLeft: 0.29,
        browOuterUpRight: 0.29,
        browDownLeft: 0.11,
        browDownRight: 0.11
    } ),

    // `eyeBlink*` is stated in MORPH weight like everything else here, so its ceiling looks small
    // beside the others: on this asset the lid is fully sealed at weight ~0.735, so 0.22 is very
    // nearly the 0.25 of APERTURE that lid follow actually asks for. See writeLidFollow().
    eye: Object.freeze( {
        eyeBlinkLeft: 0.22,
        eyeBlinkRight: 0.22,
        eyeSquintLeft: 0.16,
        eyeSquintRight: 0.16,
        eyeWideLeft: 0.20,
        eyeWideRight: 0.20
    } ),

    cheek: Object.freeze( {
        cheekSquintLeft: 0.10,
        cheekSquintRight: 0.10
    } ),

    nose: Object.freeze( {
        noseSneerLeft: 0.06,
        noseSneerRight: 0.06
    } ),

    // Speech-owned. Written additively, never absolutely, and capped an order of magnitude below
    // anything a viseme asks for so the mouth still reads as the mouth lipsync shaped.
    mouth: Object.freeze( {
        mouthSmileLeft: 0.10,
        mouthSmileRight: 0.10,
        mouthDimpleLeft: 0.14,
        mouthDimpleRight: 0.14,
        mouthLeft: 0.05,
        mouthRight: 0.05,
        mouthPressLeft: 0.22,
        mouthPressRight: 0.22,
        mouthShrugUpper: 0.20,
        mouthShrugLower: 0.12,
        mouthClose: 0.25
    } ),

    jaw: Object.freeze( {
        jawOpen: 0.05,
        jawForward: 0.08
    } )

} );

export const IDLE_REGIONS = Object.freeze( Object.keys( IDLE_CHANNELS ) );

/** Channel name -> ceiling, flattened once. Asked on every write; built here rather than there. */
const CEILING_BY_CHANNEL = new Map();
for ( const region of IDLE_REGIONS ) {

    for ( const [ name, ceiling ] of Object.entries( IDLE_CHANNELS[ region ] ) ) {

        CEILING_BY_CHANNEL.set( name, ceiling );

    }

}

const ALL_CHANNELS = Object.freeze( [ ...CEILING_BY_CHANNEL.keys() ] );

// --- lid follow ---------------------------------------------------------------------------------

/*
 * The upper lid is not attached to the globe, but it behaves as though it were: the levator and
 * the superior rectus share innervation, so vertical eye rotation and lid height move together.
 * The magnitudes below are arithmetic over two standard anatomical figures rather than a feel:
 *
 *     globe radius            ~12 mm
 *     palpebral fissure       ~9.5 mm at primary gaze
 *
 * DOWNGAZE. The lid margin follows the limbus at close to gain 1. This asset's eyes reach 11.09°
 * down (see Gaze.js), which is 12 mm x 11.09° x pi/180 = 2.32 mm of travel, i.e. 24% of the
 * fissure. So `eyeBlink` at 0.25 at full down excursion — a quarter-closed lid, which is what a
 * face reading something on a desk actually looks like. The lower lid rises perhaps half as far,
 * which is `eyeSquint` (AU7 is the lid tightener, and it is what narrows an aperture from below).
 *
 * UPGAZE. Retraction is smaller than the globe's rotation — roughly two thirds of it — because
 * the lid is held by the septum and the levator's excursion is finite. 9.64° up gives 2.02 mm of
 * globe travel, x 0.66 = 1.33 mm, i.e. 14% of the fissure.
 *
 * 🚩 DOWN_CLOSURE IS IN APERTURE, NOT IN MORPH WEIGHT, and the two are not the same number on
 * this asset. Blink.js measured the lid as fully SEALED at `eyeBlink` weight ~0.735 — everything
 * above that drives the margin on down through the lower lid — so the aperture figure is
 * converted at the output exactly the way Blink converts its own, through the same constant read
 * off the same layer. Stating it in aperture is also what makes the blink backoff below correct:
 * lid follow and a blink then sum in the units closure is actually measured in.
 *
 * ⚠️ There is no equivalent constant for `eyeWide`, whose extreme was authored as a startle
 * rather than as a doubled fissure. UP_WIDEN is therefore the fissure figure nudged up slightly
 * for readability, and is marked TUNABLE.
 */
const LID_FOLLOW_DOWN_CLOSURE = 0.25;   // APERTURE closed at full downward eye excursion
const LID_FOLLOW_DOWN_SQUINT = 0.12;    // eyeSquint at the same, the lower lid rising
const LID_FOLLOW_UP_WIDEN = 0.16;       // TUNABLE — eyeWide at full upward eye excursion

/**
 * Sustained upgaze recruits frontalis: people raise their brows to look up, which is why an
 * avatar that looks up with a flat forehead reads as a puppet on a stick. Small, and only on the
 * upward half.
 */
const UPGAZE_BROW_ASSIST = 0.07;

/**
 * TUNABLE. Left/right lid asymmetry, as a fraction. No two palpebral fissures are the same
 * height, and a perfectly matched pair is one of the things that reads as manufactured. Drawn per
 * instance at bind so two figures in a scene are not the same face.
 */
const LID_ASYMMETRY_MAXIMUM = 0.05;

// --- drift --------------------------------------------------------------------------------------

/*
 * Resting tone and its wander. Each entry is `[ noiseLane, frequencyHz, baseline, swing ]`, and
 * the channel's drift is `max( 0, baseline + swing * noise( t * frequencyHz + lane ) )`.
 *
 * BASELINE is the point. A resting face is not at the sculpted neutral — it carries tone, and
 * that tone is asymmetric. The left and right members of every pair below differ in baseline AND
 * in frequency, and the frequencies are deliberately non-harmonic so the two sides never fall
 * into step. Symmetric drift reads as mechanical however small it is.
 *
 * SWING is what actually moves, and it is tiny by design: every one of these is under 0.03, which
 * is at or below the threshold where a viewer can say what changed but well above the threshold
 * where they notice the face is alive.
 *
 * The frequencies are all in the 0.04–0.12 Hz band — eight to twenty-five seconds a cycle. Faster
 * than that stops being tone and starts being expression.
 */
const DRIFT = Object.freeze( {
    browInnerUp: [ 11.3, 0.070, 0.030, 0.022 ],
    browOuterUpLeft: [ 27.9, 0.090, 0.026, 0.020 ],
    browOuterUpRight: [ 43.1, 0.062, 0.021, 0.020 ],
    browDownLeft: [ 58.7, 0.051, 0.014, 0.014 ],
    browDownRight: [ 71.5, 0.044, 0.017, 0.014 ],
    cheekSquintLeft: [ 89.3, 0.055, 0.018, 0.015 ],
    cheekSquintRight: [ 103.7, 0.048, 0.014, 0.015 ],
    mouthDimpleLeft: [ 119.1, 0.043, 0.045, 0.018 ],
    mouthDimpleRight: [ 131.9, 0.037, 0.022, 0.018 ],
    mouthCorner: [ 149.3, 0.040, 0.035, 0.015 ],
    mouthSide: [ 163.7, 0.029, 0.022, 0.012 ],
    jawOpen: [ 181.1, 0.045, 0.016, 0.012 ]
} );

/**
 * TUNABLE. Nostril flare at peak inspiration. Nasal flaring at rest is real and it is very nearly
 * invisible — which is the correct amplitude for it. Its whole job is to tie the face to the
 * breath the ribcage is already taking, so that the two are not obviously separate systems.
 */
const NOSTRIL_BREATH_GAIN = 0.045;

// --- events ---------------------------------------------------------------------------------------

/**
 * The four involuntary events, their Poisson rates and their envelopes.
 *
 * SWALLOW is the only rate here with a physiological figure behind it: spontaneous swallowing at
 * rest runs at roughly one a minute (it climbs steeply while eating or speaking, neither of which
 * applies to a silent idle). The other three are TUNABLE and chosen low — the brief for this
 * layer is micro-activity, and an event every few seconds stops being involuntary and starts
 * being a performance.
 *
 * `riseFraction` is where in the event's life the peak sits. All four rise faster than they
 * decay, which is what a muscle released rather than relaxed looks like.
 */
const EVENTS = Object.freeze( {

    browRaise: Object.freeze( {
        ratePerMinute: 4.0,
        minimumSeconds: 0.55,
        maximumSeconds: 1.10,
        riseFraction: 0.28
    } ),

    browFurrow: Object.freeze( {
        ratePerMinute: 1.5,
        minimumSeconds: 0.80,
        maximumSeconds: 1.80,
        riseFraction: 0.30
    } ),

    lipPress: Object.freeze( {
        ratePerMinute: 2.2,
        minimumSeconds: 0.35,
        maximumSeconds: 0.75,
        riseFraction: 0.35
    } ),

    swallow: Object.freeze( {
        ratePerMinute: 1.0,
        minimumSeconds: 0.70,
        maximumSeconds: 1.00,
        riseFraction: 0.30
    } )

} );

export const EVENT_KINDS = Object.freeze( Object.keys( EVENTS ) );

/**
 * Peak contribution of each event to each channel, at event amplitude 1 and on the stronger side.
 *
 * Every one of these sits at or below the ~0.25 the brief allows a deliberate event, with the
 * channel's ceiling above it by roughly the drift and upgaze assist that can land on the same
 * frame. The ceiling is a backstop for that coincidence, not the operating point — a layer whose
 * clamp bites on a normal frame has its amplitudes wrong, not its clamp.
 */
const BROW_RAISE_INNER_PEAK = 0.18;
const BROW_RAISE_OUTER_PEAK = 0.17;
const BROW_FURROW_PEAK = 0.07;

const LIP_PRESS_PEAK = 0.20;
const LIP_PRESS_SHRUG_PEAK = 0.05;
const LIP_PRESS_CHEEK_PEAK = 0.025;

const SWALLOW_CLOSE_PEAK = 0.22;
const SWALLOW_SHRUG_UPPER_PEAK = 0.14;
const SWALLOW_SHRUG_LOWER_PEAK = 0.10;
const SWALLOW_JAW_FORWARD_PEAK = 0.06;

/**
 * TUNABLE. Every event's peak is scaled by a draw from this band, so no two brow raises are the
 * same size. A fixed-amplitude event is the tell that gives a procedural face away.
 */
const EVENT_AMPLITUDE_MINIMUM = 0.55;
const EVENT_AMPLITUDE_MAXIMUM = 1.00;

/**
 * TUNABLE. Left/right imbalance within one event, as a fraction. Brows are not a matched pair and
 * a symmetric raise is the single most doll-like thing a brow can do.
 *
 * Applied as a REDUCTION on the weaker side rather than as ±  on both, which matters: the latter
 * puts the strong side 30% above the event's stated peak and turns the channel ceiling into a
 * clamp that bites on every asymmetric event. This way the peak means what it says.
 */
const EVENT_ASYMMETRY_MAXIMUM = 0.30;

// --- the layer ------------------------------------------------------------------------------------

export class FacialIdle extends Layer {

    /**
     * @param {Object} [options]
     * @param {string} [options.name='facialIdle']
     * @param {number} [options.order] - Defaults to just after BLINK, which is later than the
     *   layer's place in the story and deliberate. Morphs ADD in MotionStack and the sum does not
     *   depend on order, so a slot number here buys exactly one thing: which layers have already
     *   published their state when this one runs. Lid follow needs two of them — Gaze's eye angle
     *   and Blink's closure — and reading either one frame late is a real artifact (see
     *   `writeLidFollow`, where a 16.7 ms stale closure drove the lids 1.6% past the asset's seal
     *   point). This layer writes no bones, so nothing else about order applies to it.
     * @param {string} [options.gazeLayerName='gaze'] - Where the vertical eye angle comes from.
     * @param {string} [options.blinkLayerName='blink'] - Where the asset's lid seal point is
     *   read from at bind. The closure itself arrives every frame through `shared.blink`.
     * @param {string} [options.breathLayerName='breath'] - Nostril coupling. Optional; without it
     *   the layer falls back to whatever `setBreathPhase()` was last given.
     * @param {Object} [options.eyeExcursionDegrees] - Override the asset's measured eye range.
     *   Resolved from the live Gaze layer when not given, so an overridden Gaze stays consistent.
     * @param {number} [options.fullClosureMorphWeight] - The `eyeBlink` weight at which THIS
     *   asset's lid is sealed. Resolved from the live Blink layer when not given, for the same
     *   reason: it is one fact about the asset and it should have one value in the stack.
     * @param {number} [options.noiseSeed=20260807] - Seeds the drift field. Separate from the
     *   layer's event stream so changing one does not reshuffle the other.
     * @param {boolean} [options.frameCoupledArrivals=false] - Rebuilds the pre-conversion defect:
     *   one Bernoulli coin per frame per event kind, off one shared stream. The rate stays correct
     *   and the trajectory becomes a function of the frame rate. Exists so the invariance gate has
     *   something to reject; see `Signals.poissonEventOccurs` and LEARNINGS §1.13.
     * @param {boolean} [options.enabled=true]
     */
    constructor( options = {} ) {

        super( {
            name: options.name ?? 'facialIdle',
            order: options.order ?? ( MOTION_ORDER.BLINK + 10 ),
            enabled: options.enabled,
            morphChannels: ALL_CHANNELS
        } );

        this.gazeLayerName = options.gazeLayerName ?? 'gaze';
        this.blinkLayerName = options.blinkLayerName ?? 'blink';
        this.breathLayerName = options.breathLayerName ?? 'breath';

        this.requestedEyeExcursionDegrees = options.eyeExcursionDegrees ?? null;
        this.eyeExcursionDegrees = { ...EYE_MORPH_EXCURSION_DEGREES, ...( options.eyeExcursionDegrees ?? {} ) };

        this.requestedFullClosureMorphWeight = options.fullClosureMorphWeight ?? null;
        this.fullClosureMorphWeight = options.fullClosureMorphWeight ?? BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT;

        // Drift is deterministic in time rather than in draw order, so it comes from a noise field
        // seeded independently of the layer's event stream.
        this.noise = new CoherentNoise1D( options.noiseSeed ?? 20260807 );

        this.frameCoupledArrivals = options.frameCoupledArrivals ?? false;

        /**
         * 🎯 ONE SCHEDULE PER EVENT KIND, EACH ON ITS OWN FORKED STREAM — and the "per kind" is the
         * part that is not obvious.
         *
         * Four kinds used to be advanced in one loop off `this.random`, so whichever fired first in
         * a frame drew first and every later kind's draws shifted behind it. That re-couples the
         * frame rate through the DRAW ORDER even after the arrivals themselves are scheduled: which
         * frame a kind fires in depends on dt, and which kind fires first in that frame decides the
         * sequence for all four. One stream each removes the ordering entirely — a kind's draws are
         * a property of its own seed and of nothing else in the layer.
         *
         * Built at bind rather than here, because `this.random` is handed to the layer by the stack.
         */
        this.eventSchedules = {};

        // Resolved at bind. Null is a supported state for all three: the layer degrades to no lid
        // follow, no blink suppression, and a caller-supplied breath phase.
        this.breathLayer = null;

        /**
         * A Figure-shaped façade over one frame's output, so ExpressionBank's real `applyRegion`
         * and `addMouthCornerOffset` run against this layer rather than being reimplemented here.
         * `applyRegion` is an absolute write into `weights`, which is exactly right at this scope:
         * the frame's contribution is this layer's alone, and additivity against every OTHER layer
         * is MotionStack's job.
         */
        this.face = new ContributionFace( ALL_CHANNELS );

        // One reusable value object per region, so a running frame allocates nothing.
        this.regionValues = {};
        for ( const region of IDLE_REGIONS ) {

            this.regionValues[ region ] = {};
            for ( const name of Object.keys( IDLE_CHANNELS[ region ] ) ) this.regionValues[ region ][ name ] = 0;

        }

        this.publishedState = {
            lidFollow: 0,
            browRaising: 0,
            swallowing: 0,
            lipPressing: 0,
            breathLevel: 0
        };

        this.resetState();

    }

    // --- public API ---------------------------------------------------------------------------

    /**
     * Switches one region off. The route by which Phase 4 takes the mouth and the jaw back, and
     * by which Phase 5 takes the brow if it ever wants sole ownership of it.
     *
     * @param {string} region - One of IDLE_REGIONS.
     * @param {boolean} enabled
     */
    setRegionEnabled( region, enabled ) {

        if ( this.regionEnabled[ region ] === undefined ) {

            throw new Error(
                `FacialIdle has no '${ region }' region. Expected one of ${ IDLE_REGIONS.join( ', ' ) }.`
            );

        }

        this.regionEnabled[ region ] = enabled !== false;

        return this;

    }

    /** Whether this layer is currently writing that region. */
    isRegionEnabled( region ) {

        return this.regionEnabled[ region ] === true;

    }

    /**
     * The breath's tidal level, 0 at end-expiration and 1 at peak inspiration.
     *
     * Only consulted when no Breath layer is in the stack. When one is, its own `level` is read
     * every frame instead, because a phase passed in by hand is a phase that can drift out of step
     * with the ribcage the viewer can see moving.
     */
    setBreathPhase( tidalLevel ) {

        this.suppliedBreathLevel = clamp( tidalLevel, 0, 1 );

        return this;

    }

    /** Signed lid displacement this frame: positive is a retracted lid, negative a lowered one. */
    get lidFollow() {

        return this.publishedState.lidFollow;

    }

    // --- the frame ------------------------------------------------------------------------------

    onBind( context ) {

        const gaze = this.stack?.findLayer( this.gazeLayerName ) ?? null;

        // Precedence: what the caller asked for, then whatever Gaze is actually using, then the
        // measured default. The middle case is the one that matters — an asset with different eye
        // morphs is configured on Gaze, and lid follow has to normalise against the same numbers.
        this.eyeExcursionDegrees = {
            ...EYE_MORPH_EXCURSION_DEGREES,
            ...( gaze?.eyeExcursionDegrees ?? {} ),
            ...( this.requestedEyeExcursionDegrees ?? {} )
        };

        const blink = this.stack?.findLayer( this.blinkLayerName ) ?? null;

        this.fullClosureMorphWeight = this.requestedFullClosureMorphWeight
            ?? blink?.fullClosureMorphWeight
            ?? BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT;

        this.breathLayer = this.stack?.findLayer( this.breathLayerName ) ?? null;

        // One arrival stream per event kind, forked from the layer's own. Forked from the seed and
        // the label rather than from the current state, so it does not matter that the two lid
        // asymmetries below are drawn from `this.random` immediately afterwards.
        for ( const kind of EVENT_KINDS ) {

            this.eventSchedules[ kind ] = new PoissonSchedule( this.random.fork( `facialIdle:${ kind }` ) );

        }

        // Drawn here and not in reset(), because the stack calls reset() and THEN onBind(); a
        // draw in both would advance this layer's stream one sample further on a reset run than on
        // a fresh one and the two runs would stop matching. Layer.onBind is documented as being
        // called with the stream already rewound, which is what makes this reproducible.
        this.leftLidScale = 1 + this.random.range( -LID_ASYMMETRY_MAXIMUM, LID_ASYMMETRY_MAXIMUM );
        this.rightLidScale = 1 + this.random.range( -LID_ASYMMETRY_MAXIMUM, LID_ASYMMETRY_MAXIMUM );

        // Which way this particular face's mouth sits. One side or the other, never both.
        this.mouthSideChannel = this.random.chance( 0.5 ) ? 'mouthLeft' : 'mouthRight';

        this.publishState( context );

    }

    update( deltaSeconds, context ) {

        this.elapsed += deltaSeconds;

        this.advanceEvents( deltaSeconds );

        this.face.clear();

        this.writeLidFollow( context );
        this.writeBrow();
        this.writeCheek();
        this.writeNose();
        this.writeMouth();
        this.writeJaw();

        this.face.flushTo( this.contribution );
        this.publishState( context );

        return this.contribution;

    }

    reset() {

        this.resetState();

    }

    // --- lid follow -------------------------------------------------------------------------------

    /**
     * The upper lid rides the globe. See the derivation above LID_FOLLOW_DOWN_CLOSURE.
     *
     * Two details are load-bearing. The eye angle read is `eyeYaw/PitchDegrees` — the eye WITHIN
     * the head, after the vestibulo-ocular reflex — and not the gaze direction in rig space,
     * because the lid rides the globe in the orbit and does not care where the head is pointing.
     * And the whole block is scaled down by the current blink closure, so that lid follow and a
     * blink can never sum past the lid's seal point: during a blink the lid belongs to
     * orbicularis, not to gaze, and the aperture it hands back is exactly `1 - closure`.
     *
     * That bound holds by construction only because this layer runs AFTER Blink and reads the
     * closure Blink published on THIS frame — see the note on `options.order`. With last frame's
     * closure the lids overshot the seal by 1.6% during the fall, which is measured, small and
     * entirely avoidable.
     */
    writeLidFollow( context ) {

        const eyePitchDegrees = context.shared.gaze?.eyePitchDegrees ?? 0;
        const blinkClosure = context.shared.blink?.closure ?? 0;

        const excursion = eyePitchDegrees >= 0
            ? this.eyeExcursionDegrees.up
            : this.eyeExcursionDegrees.down;

        // Normalised vertical eye position: +1 is the top of the eye's travel, -1 the bottom.
        const vertical = excursion > 0 ? clamp( eyePitchDegrees / excursion, -1, 1 ) : 0;
        const available = 1 - clamp( blinkClosure, 0, 1 );

        const lookingUp = Math.max( vertical, 0 ) * available;
        const lookingDown = Math.max( -vertical, 0 ) * available;

        const values = this.regionValues.eye;

        // Aperture -> morph weight, through the asset's own seal point. Same conversion Blink
        // makes at the same boundary, so the two layers' closures add in the same units.
        const closure = LID_FOLLOW_DOWN_CLOSURE * lookingDown * this.fullClosureMorphWeight;

        values.eyeBlinkLeft = closure * this.leftLidScale;
        values.eyeBlinkRight = closure * this.rightLidScale;

        values.eyeSquintLeft = LID_FOLLOW_DOWN_SQUINT * lookingDown * this.leftLidScale;
        values.eyeSquintRight = LID_FOLLOW_DOWN_SQUINT * lookingDown * this.rightLidScale;

        values.eyeWideLeft = LID_FOLLOW_UP_WIDEN * lookingUp * this.leftLidScale;
        values.eyeWideRight = LID_FOLLOW_UP_WIDEN * lookingUp * this.rightLidScale;

        this.writeRegion( 'eye', values );

        // Kept for the brow, which recruits on upgaze whether or not the lids are this layer's to
        // write, and published for anything downstream. The published figure reports what actually
        // reached the frame, so a released eye region reads as zero rather than as an intent.
        this.upgazeFraction = lookingUp;
        this.publishedState.lidFollow = this.regionEnabled.eye === false ? 0
            : ( values.eyeWideLeft + values.eyeWideRight ) / 2
                - ( values.eyeBlinkLeft + values.eyeBlinkRight ) / 2;

    }

    // --- brow ---------------------------------------------------------------------------------------

    /**
     * Slow asymmetric tone, the frontalis assist that comes with looking up, and the two brow
     * events.
     *
     * The furrow is suppressed under a raise rather than summed with it: AU4 lowers the brow and
     * AU1/AU2 raise it, and a face doing both at once is a face doing neither legibly.
     */
    writeBrow() {

        const raise = this.eventLevel( 'browRaise' );
        const raiseSide = this.eventSideScales( 'browRaise' );
        const furrow = this.eventLevel( 'browFurrow' ) * ( 1 - raise );
        const furrowSide = this.eventSideScales( 'browFurrow' );

        const assist = UPGAZE_BROW_ASSIST * this.upgazeFraction;

        const values = this.regionValues.brow;

        values.browInnerUp = this.drift( 'browInnerUp' ) + assist * 0.6
            + BROW_RAISE_INNER_PEAK * raise;

        values.browOuterUpLeft = this.drift( 'browOuterUpLeft' ) + assist
            + BROW_RAISE_OUTER_PEAK * raise * raiseSide.left;

        values.browOuterUpRight = this.drift( 'browOuterUpRight' ) + assist
            + BROW_RAISE_OUTER_PEAK * raise * raiseSide.right;

        values.browDownLeft = this.drift( 'browDownLeft' ) * ( 1 - raise )
            + BROW_FURROW_PEAK * furrow * furrowSide.left;

        values.browDownRight = this.drift( 'browDownRight' ) * ( 1 - raise )
            + BROW_FURROW_PEAK * furrow * furrowSide.right;

        this.writeRegion( 'brow', values );

    }

    // --- cheek ----------------------------------------------------------------------------------------

    /**
     * Resting cheek tone, plus the small orbicularis recruitment that comes with a lip press.
     *
     * Deliberately NOT tied to lid follow. `cheekSquint` is AU6, the Duchenne marker, and letting
     * it ride the eyes would put a trace of a genuine smile on a neutral face every time it
     * looked down.
     */
    writeCheek() {

        const press = this.eventLevel( 'lipPress' );

        const values = this.regionValues.cheek;

        values.cheekSquintLeft = this.drift( 'cheekSquintLeft' ) + LIP_PRESS_CHEEK_PEAK * press;
        values.cheekSquintRight = this.drift( 'cheekSquintRight' ) + LIP_PRESS_CHEEK_PEAK * press;

        this.writeRegion( 'cheek', values );

    }

    // --- nose -----------------------------------------------------------------------------------------

    /**
     * Nostril flare, phase-locked to the breath the body is already taking. Reads the Breath
     * layer's tidal level directly when one is in the stack; falls back to `setBreathPhase()`
     * otherwise.
     */
    writeNose() {

        const level = this.breathLayer !== null
            ? clamp( this.breathLayer.level ?? 0, 0, 1 )
            : this.suppliedBreathLevel;

        this.publishedState.breathLevel = level;

        const values = this.regionValues.nose;

        // A hair of imbalance, because a nose is not symmetric and a symmetric flare is uncanny.
        values.noseSneerLeft = NOSTRIL_BREATH_GAIN * level;
        values.noseSneerRight = NOSTRIL_BREATH_GAIN * level * 0.8;

        this.writeRegion( 'nose', values );

    }

    // --- mouth ------------------------------------------------------------------------------------------

    /**
     * The resting mouth: a standing asymmetry, a very slow wander on it, an occasional lip press,
     * and a swallow.
     *
     * 🚩 Everything here is additive against the rest of the stack and capped an order of
     * magnitude below a viseme. The corners go through ExpressionBank's `addMouthCornerOffset`,
     * which is the one sanctioned affect→mouth route; the remaining shapes are added directly
     * because ExpressionBank has no additive residual API yet — see `writeRegion()`.
     *
     * The resting corner tone is a small SMILE and never a frown. A neutral face with depressed
     * corners does not read as neutral, it reads as sad, and that is Phase 5's call to make.
     */
    writeMouth() {

        const press = this.eventLevel( 'lipPress' );
        const pressSide = this.eventSideScales( 'lipPress' );
        const swallow = this.eventLevel( 'swallow' );

        const values = this.regionValues.mouth;

        values.mouthDimpleLeft = this.drift( 'mouthDimpleLeft' ) + LIP_PRESS_PEAK * 0.3 * press;
        values.mouthDimpleRight = this.drift( 'mouthDimpleRight' ) + LIP_PRESS_PEAK * 0.3 * press;

        values.mouthLeft = 0;
        values.mouthRight = 0;
        values[ this.mouthSideChannel ] = this.drift( 'mouthSide' );

        values.mouthPressLeft = LIP_PRESS_PEAK * press * pressSide.left;
        values.mouthPressRight = LIP_PRESS_PEAK * press * pressSide.right;

        values.mouthShrugUpper = LIP_PRESS_SHRUG_PEAK * press + SWALLOW_SHRUG_UPPER_PEAK * swallow;
        values.mouthShrugLower = SWALLOW_SHRUG_LOWER_PEAK * swallow;

        values.mouthClose = SWALLOW_CLOSE_PEAK * swallow;

        // The corners are the sanctioned route, so they are stated as an offset rather than as a
        // value and are left out of the additive write below.
        values.mouthSmileLeft = 0;
        values.mouthSmileRight = 0;

        this.writeRegion( 'mouth', values );

        if ( this.regionEnabled.mouth ) {

            addMouthCornerOffset( this.face, { smile: this.drift( 'mouthCorner' ) } );

        }

    }

    // --- jaw --------------------------------------------------------------------------------------------

    /**
     * Freeway space. A resting jaw hangs two or three millimetres open, teeth apart, and a jaw
     * modelled as clamped shut is one of the small things that makes a face look set in resin.
     * Suppressed during a swallow, where the jaw elevates and the mouth closes.
     */
    writeJaw() {

        const swallow = this.eventLevel( 'swallow' );

        const values = this.regionValues.jaw;

        values.jawOpen = this.drift( 'jawOpen' ) * ( 1 - swallow );
        values.jawForward = SWALLOW_JAW_FORWARD_PEAK * swallow;

        this.writeRegion( 'jaw', values );

    }

    // --- the write choke point ---------------------------------------------------------------------------

    /**
     * The ONE place a value reaches the frame, so the ceiling and the per-region switch cannot be
     * bypassed by a new channel someone adds later.
     *
     * Emotion-owned regions go through ExpressionBank's `applyRegion`, which rejects any name
     * filed under the wrong region — that rejection is the enforcement mechanism this layer wants
     * to be subject to, not one it wants to reimplement.
     *
     * Speech-owned regions deliberately do NOT: `applyRegion` is an absolute write by contract and
     * an idle layer has no right to one over the mouth or the jaw. They are added instead, with
     * the same membership check borrowed from `regionOf()`. When ExpressionBank grows a sanctioned
     * additive residual API, this branch becomes a call to it and nothing else changes.
     */
    writeRegion( region, values ) {

        if ( this.regionEnabled[ region ] === false ) return;

        for ( const name in values ) {

            values[ name ] = clamp( values[ name ], 0, CEILING_BY_CHANNEL.get( name ) );

        }

        if ( EMOTION_REGIONS.includes( region ) ) {

            applyRegion( this.face, region, values );
            return;

        }

        for ( const name in values ) {

            if ( regionOf( name ) !== region ) {

                throw new Error(
                    `FacialIdle filed '${ name }' under '${ region }', but ExpressionBank puts it in ` +
                    `'${ regionOf( name ) ?? 'no ARKit region' }'. Fix IDLE_CHANNELS.`
                );

            }

            this.face.weights[ name ] += values[ name ];

        }

    }

    // --- events -------------------------------------------------------------------------------------------

    /**
     * Poisson arrivals, one at a time per kind. A second brow raise on top of a running one would
     * double the amplitude and break the ceiling's meaning, so a running event blocks the next
     * arrival — which also gives the rate a natural refractory period.
     */
    advanceEvents( deltaSeconds ) {

        for ( const kind of EVENT_KINDS ) this.advanceEventKind( kind, deltaSeconds );

    }

    /**
     * One kind's frame, walked in sub-steps so that nothing about it is decided by where the frame
     * boundaries happen to fall.
     *
     * 🎯 A SCHEDULE, NOT A PER-FRAME COIN. `poissonEventOccurs(rate, dt)` gets the long-run rate
     * right at any frame rate and the realised sequence wrong at all of them, because it consumes
     * one draw per FRAME. See `Signals.poissonEventOccurs` and LEARNINGS §1.13.
     *
     * 🚩 AND THE REFRACTORY IS THE SECOND COUPLING, which converting the arrivals alone does not
     * remove. A running event blocks arrivals, so the block ENDS at `duration`, and a frame that
     * steps over that instant used to carry the block to the next frame boundary — quantising the
     * refractory window to dt exactly the way `Blink`'s countdown quantised its intervals (§1.13a).
     * So the frame is cut at the event's end as well as at each arrival, and the two halves of the
     * step are run in order.
     *
     * Pausing the countdown while an event runs is EXACTLY equivalent to the old "block the draw"
     * behaviour, not an approximation of it: the wait is memoryless, so a paused exponential and a
     * suppressed sequence of coins have the same distribution.
     */
    advanceEventKind( kind, deltaSeconds ) {

        const definition = EVENTS[ kind ];
        const rate = definition.ratePerMinute / 60;
        const schedule = this.eventSchedules[ kind ];

        if ( this.frameCoupledArrivals ) {

            // 🚩 THE DEFECT, REBUILT ON PURPOSE, so the invariance gate has something to reject.
            // One coin per frame, and — as it used to be — off the LAYER's stream rather than a
            // forked one, so the four kinds re-interleave through the draw order too.
            const running = this.activeEvents[ kind ];

            if ( running !== null ) {

                running.elapsed += deltaSeconds;
                if ( running.elapsed >= running.duration ) this.activeEvents[ kind ] = null;
                return;

            }

            if ( this.random.poissonEventOccurs( rate, deltaSeconds ) ) this.beginEvent( kind, this.random );

            return;

        }

        let remaining = deltaSeconds;

        while ( remaining > 0 ) {

            const active = this.activeEvents[ kind ];

            if ( active !== null ) {

                const step = Math.min( remaining, Math.max( active.duration - active.elapsed, 0 ) );

                active.elapsed += step;
                remaining -= step;

                if ( active.elapsed < active.duration ) break;

                this.activeEvents[ kind ] = null;
                continue;

            }

            const step = Math.min( remaining, schedule.secondsUntilArrival( rate ) );

            remaining -= step;

            schedule.advance( rate, step, () => this.beginEvent( kind, schedule.random ) );

        }

    }

    /**
     * One event, drawn from the stream it belongs to.
     *
     * @param {string} kind
     * @param {MotionRandom} random - The kind's OWN stream in the shipped path. The frame-coupled
     *   rebuild passes the layer stream, because sharing one was half of that defect.
     */
    beginEvent( kind, random ) {

        const definition = EVENTS[ kind ];

        this.activeEvents[ kind ] = {
            elapsed: 0,
            duration: random.range( definition.minimumSeconds, definition.maximumSeconds ),
            amplitude: random.range( EVENT_AMPLITUDE_MINIMUM, EVENT_AMPLITUDE_MAXIMUM ),
            asymmetry: random.range( -EVENT_ASYMMETRY_MAXIMUM, EVENT_ASYMMETRY_MAXIMUM )
        };

        this.eventCounts[ kind ] ++;

    }

    /** How strongly an event is expressing right now, on [0, 1]. Zero when it is not running. */
    eventLevel( kind ) {

        const active = this.activeEvents[ kind ];
        if ( active === null ) return 0;

        return active.amplitude * eventEnvelope( active.elapsed / active.duration, EVENTS[ kind ].riseFraction );

    }

    /**
     * This event's per-side scale. One side runs at full amplitude and the other is reduced, so
     * the event's stated peak is genuinely its peak. Reuses one object per kind because this is
     * called two or three times a frame.
     */
    eventSideScales( kind ) {

        const asymmetry = this.activeEvents[ kind ]?.asymmetry ?? 0;
        const scales = this.sideScales[ kind ];

        scales.left = asymmetry >= 0 ? 1 : 1 + asymmetry;
        scales.right = asymmetry >= 0 ? 1 - asymmetry : 1;

        return scales;

    }

    // --- helpers --------------------------------------------------------------------------------------------

    /** One drift channel's toned wander. Clamped at zero because a negative morph is not a shape. */
    drift( key ) {

        const [ lane, frequencyHz, baseline, swing ] = DRIFT[ key ];

        return Math.max( 0, baseline + swing * this.noise.at( this.elapsed * frequencyHz + lane ) );

    }

    publishState( context ) {

        this.publishedState.browRaising = this.eventLevel( 'browRaise' );
        this.publishedState.swallowing = this.eventLevel( 'swallow' );
        this.publishedState.lipPressing = this.eventLevel( 'lipPress' );

        context.shared.facialIdle = this.publishedState;

    }

    /**
     * Everything that varies over a run, in one place, so `reset()` genuinely returns the layer to
     * frame zero. The per-instance asymmetries are NOT here — they are drawn in `onBind()`, which
     * the stack calls after every reset.
     */
    resetState() {

        this.elapsed = 0;
        this.upgazeFraction = 0;
        this.suppliedBreathLevel = 0;

        this.leftLidScale = 1;
        this.rightLidScale = 1;
        this.mouthSideChannel = 'mouthLeft';

        this.activeEvents = {};
        this.eventCounts = {};
        this.sideScales = {};
        for ( const kind of EVENT_KINDS ) {

            this.activeEvents[ kind ] = null;
            this.eventCounts[ kind ] = 0;
            this.sideScales[ kind ] = { left: 1, right: 1 };

            // Redraws the first arrival on the rewound stream. Optional-chained because the stack
            // calls reset() BEFORE onBind(), so on a fresh layer there are no schedules yet.
            this.eventSchedules[ kind ]?.reset();

        }

        this.regionEnabled = {};
        for ( const region of IDLE_REGIONS ) this.regionEnabled[ region ] = true;

        for ( const region of IDLE_REGIONS ) {

            for ( const name in this.regionValues[ region ] ) this.regionValues[ region ][ name ] = 0;

        }

        this.publishedState.lidFollow = 0;
        this.publishedState.browRaising = 0;
        this.publishedState.swallowing = 0;
        this.publishedState.lipPressing = 0;
        this.publishedState.breathLevel = 0;

        this.face.clear();

    }

}

// --- the ExpressionBank façade -------------------------------------------------------------------------------

/**
 * A minimal Figure, over one frame of one layer's output.
 *
 * ExpressionBank writes into `figure.weights` and asks `figure.hasMorph()` what the figure
 * carries. Both are satisfied here by the layer's declared channel list, which lets the real
 * `applyRegion` and `addMouthCornerOffset` run — including their refusals — without this file
 * restating the ownership rules they encode. The accumulated weights are then handed to the
 * MotionContribution, which is where the stack picks them up.
 */
class ContributionFace {

    constructor( channelNames ) {

        this.weights = {};
        for ( const name of channelNames ) this.weights[ name ] = 0;

    }

    hasMorph( name ) {

        return this.weights[ name ] !== undefined;

    }

    clear() {

        for ( const name in this.weights ) this.weights[ name ] = 0;

    }

    /** Copies the frame into the contribution, clamped one last time against its own ceiling. */
    flushTo( contribution ) {

        for ( const name in this.weights ) {

            const value = clamp( this.weights[ name ], 0, CEILING_BY_CHANNEL.get( name ) );

            if ( value === 0 ) continue;   // an unwritten channel stays out of the conflict report

            contribution.setMorph( name, value );

        }

    }

}

// --- pure functions ------------------------------------------------------------------------------------------

/**
 * An event's shape over its life: a raised cosine up to the peak at `riseFraction`, and a raised
 * cosine back down over what is left. Zero at both ends, continuous in value and slope, which is
 * what keeps an event from ticking as it starts and stops.
 *
 * Exported so a critic harness plotting an event against the video is reading the same curve
 * the layer ran, rather than a redrawn approximation of it.
 */
export function eventEnvelope( normalisedTime, riseFraction ) {

    const u = clamp( normalisedTime, 0, 1 );

    if ( u <= riseFraction ) return 0.5 - 0.5 * Math.cos( Math.PI * u / riseFraction );

    return 0.5 + 0.5 * Math.cos( Math.PI * ( u - riseFraction ) / ( 1 - riseFraction ) );

}

/** The ceiling a channel may never exceed, or undefined for a channel this layer does not write. */
export function ceilingOf( channelName ) {

    return CEILING_BY_CHANNEL.get( channelName );

}

function clamp( value, low, high ) {

    return Math.min( Math.max( value, low ), high );

}
