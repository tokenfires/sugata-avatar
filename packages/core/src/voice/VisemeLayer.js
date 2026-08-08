/**
 * VisemeLayer — the schedule, wired into the motion stack, owning the mouth and only the mouth.
 *
 * WHY THIS IS A LAYER AND NOT A DIRECT WRITER
 * -------------------------------------------
 * `motion/Layer.js`: "blink and emotion both want the eyelids, breath and sway both want the
 * spine... Direct writers fight and the last one wins. Contributors add up." Speech is the sharpest
 * case of that in the whole rig, because Phase 5 is going to arrive and want the mouth.
 *
 * 🎯 THE MOUTH BELONGS TO LIPSYNC, AND THIS FILE IS WHERE THAT STOPS BEING A POLICY.
 *
 * A layer declares its channels, and writing an undeclared channel THROWS. This layer declares the
 * fifteen OVR viseme shapes and nothing else. So:
 *
 *   - An affect layer that tries to route an expression through the speech layer gets an exception
 *     on its first frame, naming the channel.
 *   - An affect layer that declares `mouthSmileLeft/Right` and `mouthFrownLeft/Right` itself at
 *     `MOTION_ORDER.EXPRESSION` composes correctly for free, because MotionStack SUMS morph
 *     contributions across layers: the viseme sits on `viseme_aa`, the corner offset sits on
 *     `mouthSmileLeft`, they are different shapes, and the sum is exactly the "additive AU12/AU15
 *     corner offset over the viseme" that research §1 calls the single rule that "eliminates most
 *     emotion x speech mush".
 *   - `figure/ExpressionBank.js` closes the other door: `applyRegion` refuses mouth names from an
 *     emotion caller, and `addMouthCornerOffset` is additive and capped at
 *     `MAX_CORNER_OFFSET = 0.35`.
 *
 * So the sanctioned route composes and the unsanctioned route throws. That is the design the
 * punch list asks for — "design your API so that is natural and the alternative is awkward" — and
 * it is worth noting that it required no new mechanism, only declaring the right channel set.
 *
 *
 * WHY THE CLOCK IS INJECTED AND `deltaSeconds` IS IGNORED
 * ------------------------------------------------------
 * `update(deltaSeconds, context)` is the Layer contract, and this layer throws `deltaSeconds`
 * away. The schedule is sampled at an absolute audio-clock instant instead, because that is the
 * only clock the sound is actually on and because a pure function of absolute time cannot acquire
 * the frame-rate coupling that four layers in `motion/` have already shipped once each
 * (LEARNINGS §1.13, §1.13a). `VisemeSchedule.js` carries the full argument.
 *
 * ⚠️ In a browser, `audioContext.currentTime` does not advance while the context is suspended, and
 * a context created without a user gesture starts suspended. A page that wants the mouth to move
 * before the first click must pass a `performance.now()`-based clock and swap it on resume. That is
 * the page's problem, not this layer's, which is exactly why the clock is a constructor argument.
 */

import { Layer } from '../motion/Layer.js';
import { MOTION_ORDER } from '../motion/MotionStack.js';
import { OVR_VISEMES } from './Visemes.js';
import { VisemeSchedule } from './VisemeSchedule.js';

/** Below this a viseme is not worth a morph write or a line in the conflict report. */
const SILENCE_EPSILON = 1e-6;

export class VisemeLayer extends Layer {

    /**
     * @param {Object} [options]
     * @param {Function} [options.clock] - `() => audioContext.currentTime`, in seconds.
     * @param {number} [options.leadSeconds] - See `VisemeSchedule.DEFAULT_LEAD_SECONDS`.
     * @param {VisemeSchedule} [options.schedule] - Bring your own, e.g. one already loaded.
     * @param {Object} [options.defects] - 🚩 Gate fodder. See `VisemeSchedule`.
     */
    constructor( options = {} ) {

        super( {
            name: 'viseme',
            order: MOTION_ORDER.VISEME,
            morphChannels: [ ...OVR_VISEMES ],
            enabled: options.enabled ?? true,
            weight: options.weight ?? 1
        } );

        this.schedule = options.schedule ?? new VisemeSchedule( {
            clock: options.clock,
            leadSeconds: options.leadSeconds,
            defects: options.defects
        } );

        /** True on any frame the layer contributed something. Read by the HUD and the gates. */
        this.speaking = false;

    }

    /** Loads an utterance. Signature matches `VisemeSchedule.speak`. */
    speak( timeline, options ) {

        this.schedule.speak( timeline, options );
        return this;

    }

    /** Stops mid-utterance. The mouth closes over the next frame's envelope tails, not instantly. */
    stop() {

        this.schedule.stop();
        return this;

    }

    reset() {

        this.schedule.stop();
        this.speaking = false;

    }

    update( deltaSeconds ) {

        const weights = this.schedule.update( deltaSeconds );

        let wrote = false;

        for ( const name of OVR_VISEMES ) {

            const weight = weights[ name ];
            if ( weight <= SILENCE_EPSILON ) continue;

            this.contribution.setMorph( name, weight );
            wrote = true;

        }

        this.speaking = wrote;

        // A silent layer returns null so it stays out of the channel-conflict report entirely,
        // rather than claiming fifteen shapes at zero on every frame of every silence.
        return wrote ? this.contribution : null;

    }

}
