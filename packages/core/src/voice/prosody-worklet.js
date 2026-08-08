/**
 * The prosody AudioWorkletProcessor. Runs on the audio thread; nothing else in this package does.
 *
 * 🚩 WHY THIS IS A WORKLET AND NOT AN ANALYSERNODE. research/affect-and-animation.md §2 is
 * unambiguous: "Use an `AudioWorkletNode`, not `AnalyserNode` — deterministic 128-sample blocks on
 * the audio thread vs. a smoothed snapshot at the mercy of rAF jank." An AnalyserNode hands the
 * main thread whatever the last render quantum happened to leave in its buffer, smoothed by a
 * constant nobody chose, sampled whenever requestAnimationFrame next fires. Every frame this
 * processor emits is timestamped from a sample count instead.
 *
 * It does the analysis and posts FRAMES, not audio. Posting raw blocks to the main thread and
 * analysing there would reintroduce exactly the jank the worklet exists to avoid, and would cost
 * 48,000 floats a second of structured cloning to do it.
 *
 * Measured cost of the analysis it performs: 0.043 ms per hop at the shipped decimation, 187.5
 * hops a second, 0.81% of one core. `Pitch.js`'s header has the table and the rejected
 * alternatives.
 *
 * ⚠️ This file is loaded by `audioWorklet.addModule()`, which evaluates it as a module in a scope
 * with no `window` and no DOM. It imports exactly one file for that reason. Do not add a second.
 */

import { FrameAnalyser } from './Pitch.js';

class ProsodyProcessor extends AudioWorkletProcessor {

    constructor( options ) {

        super();

        const settings = options?.processorOptions ?? {};

        // `sampleRate` is a global inside the worklet scope, and it is the authority — a caller
        // that guessed 48000 on a 44.1 kHz device would put every F0 out by 8.8%.
        this.analyser = new FrameAnalyser( {
            sampleRate,
            hopSeconds: settings.hopSeconds,
            minHz: settings.minHz,
            maxHz: settings.maxHz,
            windowPeriods: settings.windowPeriods
        } );

        this.pending = [];
        this.running = true;

        this.port.postMessage( { type: 'ready', settings: this.analyser.describe() } );

        this.port.onmessage = ( event ) => {

            if ( event.data?.type === 'stop' ) this.running = false;
            if ( event.data?.type === 'reset' ) this.analyser.reset();

        };

        this.onFrame = ( frame ) => {

            // Copied, because the analyser reuses one object and this array outlives the call.
            this.pending.push( { time: frame.time, rms: frame.rms, hz: frame.hz, clarity: frame.clarity } );

        };

    }

    process( inputs ) {

        if ( this.running === false ) return false;

        const channel = inputs[ 0 ]?.[ 0 ];

        // A disconnected or silent-by-omission input gives an empty array rather than zeros.
        if ( channel !== undefined ) this.analyser.push( channel, this.onFrame );

        if ( this.pending.length > 0 ) {

            // One message per render quantum at most, carrying however many frames completed.
            this.port.postMessage( { type: 'frames', frames: this.pending } );
            this.pending = [];

        }

        return true;

    }

}

registerProcessor( 'sugata-prosody', ProsodyProcessor );
