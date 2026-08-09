/**
 * ExpressionLayer — affect, wired into the motion stack, owning brow, eye, cheek and nose, and
 * reaching the mouth only through an additive corner offset. Punch-list 5.5.
 *
 * 🎯 THIS FILE IS THE OTHER HALF OF A PAIR, AND THE PAIR WAS DESIGNED BEFORE EITHER EXISTED.
 * `voice/VisemeLayer.js`'s header, written in Phase 4, says exactly what Phase 5 would have to do:
 *
 *   > An affect layer that declares `mouthSmileLeft/Right` and `mouthFrownLeft/Right` itself at
 *   > `MOTION_ORDER.EXPRESSION` composes correctly for free, because MotionStack SUMS morph
 *   > contributions across layers: the viseme sits on `viseme_aa`, the corner offset sits on
 *   > `mouthSmileLeft`, they are different shapes, and the sum is exactly the "additive AU12/AU15
 *   > corner offset over the viseme" that research §1 calls the single rule that "eliminates most
 *   > emotion x speech mush".
 *
 * That is what this layer is. Its declared channel set IS the enforcement: `Layer` throws on any
 * write to an undeclared channel, so this layer physically cannot touch `viseme_aa`, `mouthPucker`
 * or `jawOpen`, and the exception names the channel on the first frame rather than producing a
 * face that reads subtly wrong for a round. Nothing here restates the rule as a runtime check,
 * because a declaration that is already load-bearing does not need one.
 *
 * The four channels it does declare in the mouth region are `mouthSmileLeft/Right` and
 * `mouthFrownLeft/Right`, capped at `ExpressionBank.MAX_CORNER_OFFSET`, which is imported rather
 * than repeated so there is one number.
 *
 *
 * WHY IT DOES NOT OWN THE AFFECT STATE
 * ------------------------------------
 * `AffectState` is passed in. Tier 1 and tier 2 both push into it, `motion/` layers other than this
 * one will read it (posture and gesture need dominance, which this layer must never see), and a
 * browsercheck wants to scrub it directly. A layer that owned the state would make all three of
 * those reach through the rig to get at it.
 *
 * The layer advances the state itself by default, because something has to and doing it here keeps
 * the affect clock on the same delta the rig is on. Set `advanceState: false` when the host is
 * already calling `AffectState.update()` — running two clocks over one state doubles its rate,
 * which is the kind of defect that looks like a tuning problem.
 *
 *
 * ⚠️ EYELIDS ARE SHARED WITH BLINK, ON PURPOSE
 * AU43 (eye closure, negative arousal) lands on `eyeBlinkLeft/Right`, which `motion/Blink.js` also
 * declares. That is the case `motion/Layer.js`'s own header opens with — "blink and emotion both
 * want the eyelids... Contributors add up" — and the sum is right: a bored lid droop of 0.4 plus a
 * full blink of 1.0 clamps to a fully shut eye, which is what a blink is. The channel-conflict
 * report will name both layers, and that is the report working rather than a warning.
 */

import { MAX_CORNER_OFFSET } from '../figure/ExpressionBank.js';
import { Layer } from '../motion/Layer.js';
import { MOTION_ORDER } from '../motion/MotionStack.js';
import { AffectState } from './AffectState.js';
import { EMOTION_MORPHS, ExpressionMap, MOUTH_CORNER_MORPHS } from './ExpressionMap.js';

/** Below this a morph is not worth a write or a line in the conflict report. */
const EXPRESSION_EPSILON = 1e-6;

export class ExpressionLayer extends Layer {

    /**
     * @param {Object} [options]
     * @param {AffectState} [options.state] - Bring your own; one is made if absent.
     * @param {ExpressionMap} [options.map] - Likewise.
     * @param {boolean} [options.advanceState=true] - See the header.
     */
    constructor( options = {} ) {

        super( {
            name: 'expression',
            order: MOTION_ORDER.EXPRESSION,

            // 🚩 The whole mouth-ownership guarantee is this list. Brow, eye, cheek and nose in
            // full; from the mouth, four corner shapes and nothing else; from the jaw and the
            // viseme set, nothing at all.
            morphChannels: [ ...EMOTION_MORPHS, ...MOUTH_CORNER_MORPHS ],

            enabled: options.enabled ?? true,
            weight: options.weight ?? 1
        } );

        this.state = options.state ?? new AffectState();
        this.map = options.map ?? new ExpressionMap();
        this.advanceState = options.advanceState ?? true;

        /** Last frame's read-out, for the HUD, the gates and anything driving the body. */
        this.activations = [];
        this.faceResult = null;
        this.bodyPrescription = null;

    }

    /** Convenience passthrough so a caller can drive the layer without holding the state. */
    feel( estimate ) {

        this.state.push( estimate );
        return this;

    }

    /** Fires an emotion that drift cannot reach. See `ExpressionMap.trigger`. */
    trigger( name, intensity ) {

        this.map.trigger( name, intensity );
        return this;

    }

    reset() {

        this.state.reset();
        this.map.clearTriggers();
        this.activations = [];
        this.faceResult = null;
        this.bodyPrescription = null;

    }

    update( deltaSeconds ) {

        if ( this.advanceState === true ) this.state.update( deltaSeconds );

        this.activations = this.map.activate( this.state.pad );

        // 🚩 `faceInput()` is a two-key frozen object and `bodyInput()` is a three-key one. The
        // face call physically cannot see dominance; the body call is the only consumer that can.
        this.faceResult = this.map.face( this.activations, this.state.faceInput() );
        this.bodyPrescription = this.map.body( this.activations, this.state.bodyInput() );

        let wrote = false;

        for ( const [ name, value ] of Object.entries( this.faceResult.morphs ) ) {

            if ( value <= EXPRESSION_EPSILON ) continue;

            this.contribution.setMorph( name, value );
            wrote = true;

        }

        const { smile, frown } = this.faceResult.mouthCornerOffset;

        if ( smile > EXPRESSION_EPSILON ) {

            const capped = Math.min( smile, MAX_CORNER_OFFSET );
            this.contribution.setMorph( 'mouthSmileLeft', capped );
            this.contribution.setMorph( 'mouthSmileRight', capped );
            wrote = true;

        }

        if ( frown > EXPRESSION_EPSILON ) {

            const capped = Math.min( frown, MAX_CORNER_OFFSET );
            this.contribution.setMorph( 'mouthFrownLeft', capped );
            this.contribution.setMorph( 'mouthFrownRight', capped );
            wrote = true;

        }

        // A neutral face returns null so it stays out of the conflict report entirely, rather than
        // claiming eighteen shapes at zero on every frame of every silence.
        return wrote ? this.contribution : null;

    }

    /** One line for a HUD. `happy 0.75 (sat)  ·  P +0.80 A +0.70 D +0.60` */
    describe() {

        const pad = this.state.pad;
        const active = this.activations.length === 0
            ? '(neutral)'
            : this.activations
                .map( ( a ) => `${ a.emotion } ${ a.weight.toFixed( 3 ) }${ a.saturated ? ' (sat)' : '' }` )
                .join( '   ' );

        return `${ active }   ·   P ${ signed( pad.pleasure ) } A ${ signed( pad.arousal ) } D ${ signed( pad.dominance ) }` +
            `   ·   mood ${ this.state.moodOctant } ${ this.state.moodStrength.toFixed( 3 ) }`;

    }

}

function signed( value ) {

    return `${ value >= 0 ? '+' : '' }${ value.toFixed( 2 ) }`;

}
