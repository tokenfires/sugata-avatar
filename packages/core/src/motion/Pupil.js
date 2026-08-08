/**
 * Pupil — arousal made visible, deliberately larger than life.
 *
 * WHY THIS HAS TO BE EXAGGERATED, STATED UP FRONT
 * -----------------------------------------------
 * The task-evoked pupillary response is about **0.1 mm** above baseline (research §4). Portrait
 * framing on a 1080p canvas puts roughly 60 px across the iris, and the pupil edge sits about
 * 10 px from centre. Measured in ocular.selftest.mjs: a faithful 0.1 mm response moves that edge
 * by **0.25 px**, and still only **0.74 px** after this layer's default 3x exaggeration.
 *
 * So modelling the physiological response is not merely subtle, it is *unrenderable*, and no
 * exaggeration factor short of absurd rescues it. The design consequence is the important part:
 *
 *   This layer does NOT model the task-evoked response. It maps an AFFECT arousal scalar across
 *   the whole recorded emotional-dilation range (2–8 mm), which is already a large amplification
 *   of anything cognitive, and THEN exaggerates the deviation on top of that.
 *
 * That is defensible because emotional-arousal dilation genuinely is the large effect, and
 * because Ruhland reports viewers identify a "scared" avatar at **75% accuracy from eye cues
 * alone** — the channel is legible when it is visible. Measured: with the default 3x, a 0.1 step
 * on the arousal scalar moves the pupil edge 4.46 px — unmistakable, and 18x the displacement the
 * real physiological response it stands in for would have produced.
 *
 * `exaggeration` is a named, exposed number rather than a fudge buried in a curve precisely so
 * that nobody later mistakes this layer's output for a measurement, and
 * `physiologicalDiameterMillimetres` is kept alongside it, un-exaggerated, so the honest figure
 * stays auditable.
 *
 * THIS FIGURE HAS NO PUPIL MORPH — VERIFIED
 * -----------------------------------------
 * The eye in figure_g000..g100 is two meshes — the opaque globe (`high-poly`, named for its
 * topology rather than its anatomy) and the clear corneal shell over it (`cornea`) — and each
 * carries exactly the same 8 morph targets, all eight of them gaze:
 *
 *     eyeLookDownLeft  eyeLookDownRight  eyeLookInLeft   eyeLookInRight
 *     eyeLookOutLeft   eyeLookOutRight   eyeLookUpLeft   eyeLookUpRight
 *
 * There is no pupil shape anywhere on any of the seven meshes. So this layer does not write a morph
 * on the shipped asset. It computes a scalar and publishes it to whatever will consume it — a
 * shader uniform, `context.shared`, or an arbitrary sink. If a future asset does ship a pupil
 * morph under one of PUPIL_MORPH_CANDIDATES, `onBind()` finds it and drives it as well, with no
 * change at the call site.
 *
 * WHAT PHASE 3.3 (material/EyeMaterial.js) MUST PROVIDE
 * -----------------------------------------------------
 * A two-piece radial UV remap, the same shape HDRP's `CirclePupilAnimation` uses. NOT a plain
 * scale of a pupil circle: the iris fibres have to STRETCH as the pupil opens, which means the
 * annulus outside the pupil is remapped too. In iris-disc UV, centred at 0.5 with the limbus at
 * radius 1 after the x2 below:
 *
 *     uniform float pupilScale;              // <- THIS LAYER WRITES THIS. 1 = authored size.
 *     const   float authoredPupilRadius;     // pupil radius in iris-disc UV at pupilScale == 1
 *
 *     vec2  fromCentre = irisUv - 0.5;
 *     float radius     = length( fromCentre ) * 2.0;              // 0 at centre, 1 at limbus
 *     float pupilEdge  = authoredPupilRadius * pupilScale;
 *
 *     float remapped = radius < pupilEdge
 *         // Inside the pupil: uniform scale. (Everything here is black anyway; the piece exists
 *         // so the two halves meet continuously at the pupil edge.)
 *         ? ( radius / pupilEdge ) * authoredPupilRadius
 *         // Outside: compress or stretch the remaining annulus onto the authored annulus, so
 *         // the fibre texture is squeezed toward the limbus as the pupil opens.
 *         : authoredPupilRadius
 *           + ( radius - pupilEdge ) / ( 1.0 - pupilEdge ) * ( 1.0 - authoredPupilRadius );
 *
 *     vec2 sampleUv = 0.5 + normalize( fromCentre ) * remapped * 0.5;
 *
 * `pupilScale` is clamped here to PUPIL_SCALE_BOUNDS so `pupilEdge` can never reach 1 and the
 * `1.0 - pupilEdge` divide can never blow up. That clamp is this layer's half of the contract.
 *
 * Unreal's equivalent single control is Pupil Scale 0.5–1.0; MetaHuman exposes Dilation and
 * Feather. Same scalar, different names.
 *
 * USAGE
 *
 *     const pupil = stack.add( new Pupil() );
 *     pupil.driveUniform( eyeMaterial.pupilScaleUniform );   // anything with a `.value`
 *     pupil.setArousal( 0.8 );
 *
 * With no eye shader yet, the geometric stand-in is one line in a sink — scale a pupil disc mesh:
 *
 *     pupil.addSink( ( scale ) => pupilDisc.scale.setScalar( scale ) );
 */

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { CoherentNoise1D } from './Signals.js';

// --- physiology, measured (research §4) --------------------------------------------------------
//
// The endpoints are the extremes of emotional-arousal dilation, not typical values: arousal 0 is
// a maximally constricted pupil and arousal 1 a maximally dilated one. A resting indoor pupil of
// about 4 mm therefore sits near arousal 0.33, which is where the default resting arousal lands.
const PUPIL_DIAMETER_RANGE_MILLIMETRES = [ 2, 8 ];

// The diameter the iris texture is authored at, and so the diameter at which pupilScale is 1.
// A rendering reference, not a physiological claim — change it to match whatever the Phase 3.3
// iris texture actually ships with.
const AUTHORED_PUPIL_DIAMETER_MILLIMETRES = 4;

const DEFAULT_EXAGGERATION = 3;

// Keeps the shader's `1 - pupilEdge` divide away from zero, and keeps the pupil inside the iris.
const PUPIL_SCALE_BOUNDS = [ 0.35, 2.2 ];

// --- dynamics, NOT MEASURED --------------------------------------------------------------------
//
// The research doc records pupil *amplitudes* and no time constants. The asymmetry below is
// standard autonomic physiology rather than a number from our sources: constriction is
// parasympathetic and quick (the light reflex constricts in roughly half a second), redilation is
// sympathetic and slow (several seconds). Direction is safe; the magnitudes are tuning.
const DILATION_TIME_CONSTANT_SECONDS = 0.9;
const CONSTRICTION_TIME_CONSTANT_SECONDS = 0.35;

// Hippus — the small spontaneous oscillation a real pupil never stops doing, 0.05–0.3 Hz. Applied
// to the final scale rather than to the physiological diameter, so that raising `exaggeration`
// does not also multiply the wobble into a visible flicker. Also NOT from our sources.
const HIPPUS_FREQUENCY_HZ = 0.2;
const HIPPUS_SCALE_AMPLITUDE = 0.02;

// If a future asset ships a pupil shape, it will almost certainly be called one of these. Checked
// in order; the first one the figure actually has wins.
const PUPIL_MORPH_CANDIDATES = [ 'pupilDilate', 'pupilDilation', 'eyeDilate', 'pupilWide' ];

export class Pupil extends Layer {

    /**
     * @param {Object} [options]
     * @param {string} [options.name='pupil']
     * @param {number} [options.order] - Defaults to just after GAZE. MOTION_ORDER has no pupil
     *   slot because on the shipped asset this layer writes no morph and no bone; it sits beside
     *   gaze because that is where the eye is dealt with.
     * @param {number} [options.arousal=0.33] - Resting arousal. 0.33 of the 2–8 mm range is a
     *   4 mm pupil, i.e. a normal indoor resting eye.
     * @param {number} [options.exaggeration=3] - How far past physiology to push the deviation
     *   from the authored diameter. 1 is faithful and invisible.
     * @param {number} [options.authoredPupilDiameterMillimetres=4]
     * @param {boolean} [options.hippus=true]
     */
    constructor( options = {} ) {

        super( {
            name: options.name ?? 'pupil',
            order: options.order ?? MOTION_ORDER.GAZE + 1,
            morphChannels: [],
            enabled: options.enabled,
            weight: options.weight,
        } );

        this.restingArousal = clampToUnitRange( options.arousal ?? 0.33 );
        this.exaggeration = options.exaggeration ?? DEFAULT_EXAGGERATION;
        this.authoredDiameterMillimetres = options.authoredPupilDiameterMillimetres ?? AUTHORED_PUPIL_DIAMETER_MILLIMETRES;
        this.hippusEnabled = options.hippus !== false;

        // Target is what the affect system asked for; smoothed is what the eye has got to so far.
        this.targetArousal = this.restingArousal;
        this.smoothedArousal = this.restingArousal;

        this.physiologicalDiameterMillimetres = diameterAtArousal( this.smoothedArousal );
        this.pupilScale = 1;

        // Resolved at bind. Null on the shipped figures, which have no pupil shape at all.
        this.pupilMorphName = null;

        this.sinks = [];
        this.uniforms = [];

        this.hippusNoise = new CoherentNoise1D( hashName( this.name ) );
        this.elapsed = 0;

        this.publishedState = { scale: 1, arousal: this.restingArousal, diameterMillimetres: 0 };

    }

    /**
     * Looks for a pupil morph on the bound figure. Idempotent, and safe to run on every rebind:
     * it only ever narrows to the first candidate the figure actually carries.
     */
    onBind( context ) {

        this.pupilMorphName = null;

        for ( const candidate of PUPIL_MORPH_CANDIDATES ) {

            if ( context.target.hasMorph( candidate ) === false ) continue;

            this.pupilMorphName = candidate;
            break;

        }

        this.declareChannels( { morphChannels: this.pupilMorphName === null ? [] : [ this.pupilMorphName ] } );

    }

    // --- the frame -----------------------------------------------------------------------------

    update( deltaSeconds, context ) {

        this.elapsed += deltaSeconds;

        this.advanceArousal( deltaSeconds );

        this.physiologicalDiameterMillimetres = diameterAtArousal( this.smoothedArousal );
        this.pupilScale = this.scaleFromDiameter( this.physiologicalDiameterMillimetres );

        this.publish( context );

        // No morph on this asset, so nothing to contribute to the stack. The scalar has already
        // gone out to the shader and the sinks above; returning null keeps this layer out of the
        // conflict report, which is correct — it is not competing for anything.
        if ( this.pupilMorphName === null ) return null;

        // A morph runs 0..1 while the scale runs over PUPIL_SCALE_BOUNDS, so the shape is driven
        // by where the scale sits in that band.
        const normalised = ( this.pupilScale - PUPIL_SCALE_BOUNDS[ 0 ] ) / ( PUPIL_SCALE_BOUNDS[ 1 ] - PUPIL_SCALE_BOUNDS[ 0 ] );
        this.contribution.setMorph( this.pupilMorphName, clampToUnitRange( normalised ) );

        return this.contribution;

    }

    // --- drive signal --------------------------------------------------------------------------

    /**
     * Arousal, 0..1 — the P and A of a PAD state's arousal axis remapped to 0..1, or anything
     * else that means "activation". The eye chases this rather than snapping to it, and it chases
     * upward more slowly than downward, because dilation is sympathetic and constriction is not.
     */
    setArousal( arousal ) {

        this.targetArousal = clampToUnitRange( arousal );

    }

    /** Skips the smoothing. For scene setup and for tests, not for the running avatar. */
    snapToArousal( arousal ) {

        this.targetArousal = clampToUnitRange( arousal );
        this.smoothedArousal = this.targetArousal;

    }

    /**
     * How far past physiology to push. 1 is faithful, and faithful is invisible — see the header.
     * Exposed as its own function because the critic pass will want to sweep it.
     */
    setExaggeration( factor ) {

        this.exaggeration = Math.max( factor, 0 );

    }

    // --- output wiring -------------------------------------------------------------------------

    /**
     * Anything with a `.value` — a three.js `IUniform`, a TSL `uniform()` node, or a plain
     * `{ value: 1 }` in a test. Written every frame with the clamped pupil scale.
     */
    driveUniform( uniform ) {

        this.uniforms.push( uniform );
        return uniform;

    }

    /**
     * An arbitrary consumer, called as `sink( pupilScale, physiologicalDiameterMillimetres )`.
     * This is the escape hatch for the geometric stand-in and for instrumentation.
     */
    addSink( sink ) {

        this.sinks.push( sink );
        return sink;

    }

    removeSink( sink ) {

        const index = this.sinks.indexOf( sink );
        if ( index !== -1 ) this.sinks.splice( index, 1 );

    }

    // --- lifecycle -----------------------------------------------------------------------------

    reset() {

        this.targetArousal = this.restingArousal;
        this.smoothedArousal = this.restingArousal;
        this.physiologicalDiameterMillimetres = diameterAtArousal( this.smoothedArousal );
        this.pupilScale = this.scaleFromDiameter( this.physiologicalDiameterMillimetres );
        this.elapsed = 0;

    }

    dispose() {

        this.sinks.length = 0;
        this.uniforms.length = 0;

    }

    // --- helpers -------------------------------------------------------------------------------

    /**
     * First-order chase with a different time constant in each direction. Written as
     * `1 - exp( -dt / tau )` rather than a fixed per-frame fraction so the response is the same
     * at 30, 60 and 120 fps.
     */
    advanceArousal( deltaSeconds ) {

        const dilating = this.targetArousal > this.smoothedArousal;
        const timeConstant = dilating ? DILATION_TIME_CONSTANT_SECONDS : CONSTRICTION_TIME_CONSTANT_SECONDS;

        const approach = 1 - Math.exp( -deltaSeconds / timeConstant );

        this.smoothedArousal += ( this.targetArousal - this.smoothedArousal ) * approach;

    }

    /**
     * Physiological diameter -> the scale the shader consumes.
     *
     * The exaggeration multiplies the DEVIATION from the authored diameter, not the diameter
     * itself, so that a pupil sitting at the authored size stays at scale 1 however hard the
     * exaggeration is cranked. Hippus is added after, at a fixed amplitude, for the same reason.
     */
    scaleFromDiameter( diameterMillimetres ) {

        const faithfulScale = diameterMillimetres / this.authoredDiameterMillimetres;
        const exaggeratedScale = 1 + this.exaggeration * ( faithfulScale - 1 );

        const hippus = this.hippusEnabled
            ? this.hippusNoise.at( this.elapsed * HIPPUS_FREQUENCY_HZ ) * HIPPUS_SCALE_AMPLITUDE
            : 0;

        const scale = exaggeratedScale + hippus;

        return Math.min( Math.max( scale, PUPIL_SCALE_BOUNDS[ 0 ] ), PUPIL_SCALE_BOUNDS[ 1 ] );

    }

    publish( context ) {

        this.publishedState.scale = this.pupilScale;
        this.publishedState.arousal = this.smoothedArousal;
        this.publishedState.diameterMillimetres = this.physiologicalDiameterMillimetres;

        context.shared.pupil = this.publishedState;

        for ( const uniform of this.uniforms ) {

            uniform.value = this.pupilScale;

        }

        for ( const sink of this.sinks ) {

            sink( this.pupilScale, this.physiologicalDiameterMillimetres );

        }

    }

}

/** Arousal 0..1 across the recorded 2–8 mm emotional-dilation range. */
export function diameterAtArousal( arousal ) {

    const [ minimum, maximum ] = PUPIL_DIAMETER_RANGE_MILLIMETRES;

    return minimum + ( maximum - minimum ) * clampToUnitRange( arousal );

}

export const PUPIL_CONSTANTS = {
    PUPIL_DIAMETER_RANGE_MILLIMETRES,
    AUTHORED_PUPIL_DIAMETER_MILLIMETRES,
    DEFAULT_EXAGGERATION,
    PUPIL_SCALE_BOUNDS,
    DILATION_TIME_CONSTANT_SECONDS,
    CONSTRICTION_TIME_CONSTANT_SECONDS,
    HIPPUS_FREQUENCY_HZ,
    HIPPUS_SCALE_AMPLITUDE,
    PUPIL_MORPH_CANDIDATES,
};

function clampToUnitRange( value ) {

    return Math.min( Math.max( value, 0 ), 1 );

}

/** A stable seed from the layer name, so two Pupil layers do not share a hippus phase. */
function hashName( name ) {

    let hash = 2166136261;

    for ( let index = 0; index < name.length; index ++ ) {

        hash ^= name.charCodeAt( index );
        hash = Math.imul( hash, 16777619 );

    }

    return hash >>> 0;

}
