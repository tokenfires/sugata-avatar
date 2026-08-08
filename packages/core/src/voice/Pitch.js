/**
 * Pitch — F0 by the McLeod Pitch Method, built here rather than depended on.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * research/affect-and-animation.md §2 names `pitchy` (0BSD, McLeod Pitch Method, returns
 * `[pitchHz, clarity]`) as "the only unencumbered piece of the prosody stack". It is not vendored
 * here, and the project's standing preference is to build rather than add a dependency when the
 * tradeoff is not clearly too great. MPM is one normalised autocorrelation and a peak pick; the
 * whole algorithm is below and it is shorter than the argument for taking a dependency on it.
 *
 * 🎯 CLARITY IS THE POINT, NOT THE PITCH. The same source: "Clarity is the voiced/unvoiced gate —
 * reject <0.8-0.9 rather than smoothing garbage." A pitch tracker that returns a confident-looking
 * number for a fricative is worse than one that says nothing, because the affect layer downstream
 * has no way to tell the difference. MPM gives the gate for free: the NSDF peak height IS the
 * periodicity of the frame.
 *
 *
 * THE ONE ENGINEERING DECISION, AND THE MEASUREMENT THAT MADE IT
 * -------------------------------------------------------------
 * NSDF is O(window x tau-range) and it has to run on the AUDIO THREAD (research §2: an
 * `AudioWorkletNode`, not an `AnalyserNode`). Whether that is affordable is a measurement, not an
 * opinion, so it was measured on this machine — brute-force NSDF, 187.5 hops/s (a 256-sample hop
 * at 48 kHz), F0 range 70-400 Hz:
 *
 *     48 kHz, 2048-sample window   0.664 ms/hop   124.4 ms/s   12.44% of one core
 *     48 kHz, 1024-sample window   0.253 ms/hop    47.5 ms/s    4.75%
 *     16 kHz,  683-sample window   0.077 ms/hop    14.5 ms/s    1.45%
 *     12 kHz,  512-sample window   0.043 ms/hop     8.1 ms/s    0.81%
 *
 * 🚩 The 48 kHz rows are not affordable and the 1024-sample one is not even correct: a reliable
 * NSDF needs the window to hold at least two periods of the lowest F0 sought, and 1024 samples at
 * 48 kHz is 21.3 ms against the 28.6 ms that two periods of 70 Hz occupy. The window that IS long
 * enough at 48 kHz is the one that costs 12% of a core on the thread that must never miss a
 * deadline.
 *
 * So the signal is decimated to ~12 kHz first. F0 lives below 400 Hz and its harmonics matter only
 * as far as the autocorrelation can see them; 6 kHz of bandwidth is a great deal more than a pitch
 * detector needs. The cost falls by 15x and the window gets LONGER in milliseconds, not shorter.
 *
 * ⚠️ Decimation without a low-pass folds everything above the new Nyquist back into the band. The
 * folded energy is mostly fricative noise, which is unvoiced and would fail the clarity gate
 * anyway — but "it would probably fail the gate" is not a filter, so there is a real one:
 * `designLowPass` builds a Hamming-windowed sinc, and it costs 33 multiplies per output sample at
 * 12 kHz, which is 0.4 M/s and does not appear in a profile.
 *
 * Nothing here imports anything. That is deliberate: this module is loaded inside an
 * AudioWorklet's global scope, where the module graph is a different and less forgiving place.
 */

/** research §2 and §4: speech F0. Below 70 Hz is creak; above 400 Hz is not this voice. */
export const DEFAULT_MIN_F0_HZ = 70;
export const DEFAULT_MAX_F0_HZ = 400;

/**
 * McLeod's own peak-picking constant `k`. The first NSDF peak at or above `k x (the tallest peak)`
 * is chosen, which is what makes MPM prefer the fundamental over a louder octave-down artifact.
 *
 * 🚩 NOT the same number as the voiced/unvoiced gate, even though both are "0.8-0.9". This one
 * decides WHICH peak; `Prosody.js`'s `VOICED_CLARITY_GATE` decides whether to believe the answer.
 * Conflating them is an easy and silent mistake.
 */
export const MPM_PEAK_THRESHOLD = 0.9;

/** The working rate the decimator aims for. See the header's measurement table. */
export const TARGET_WORKING_RATE_HZ = 12000;

/** Taps in the anti-alias filter. Odd, so the filter has an integer group delay. */
export const LOWPASS_TAPS = 33;

/**
 * A Hamming-windowed sinc low-pass.
 *
 * @param {number} taps - Odd. Even is rounded up, because an even-length linear-phase filter has
 *   a half-sample delay and nothing here wants to reason about that.
 * @param {number} cutoffNormalised - Cutoff as a fraction of the SAMPLE rate (so 0.25 is Nyquist/2).
 * @returns {Float32Array} Coefficients, summing to 1.
 */
export function designLowPass( taps, cutoffNormalised ) {

    const length = taps % 2 === 0 ? taps + 1 : taps;
    const middle = ( length - 1 ) / 2;
    const coefficients = new Float32Array( length );

    let sum = 0;

    for ( let index = 0; index < length; index ++ ) {

        const offset = index - middle;

        // sinc, with the removable singularity at 0 handled rather than nudged.
        const sinc = offset === 0
            ? 2 * cutoffNormalised
            : Math.sin( 2 * Math.PI * cutoffNormalised * offset ) / ( Math.PI * offset );

        const hamming = 0.54 - 0.46 * Math.cos( 2 * Math.PI * index / ( length - 1 ) );

        coefficients[ index ] = sinc * hamming;
        sum += coefficients[ index ];

    }

    for ( let index = 0; index < length; index ++ ) coefficients[ index ] /= sum;

    return coefficients;

}

/**
 * Anti-aliased integer decimation, streaming.
 *
 * Holds the filter's tail between calls, so a signal fed in 128-sample blocks decimates to exactly
 * what the same signal fed in one block would have produced. That property is not decoration — the
 * worklet has no choice about its block size, and a decimator that restarted every block would put
 * a discontinuity into the signal 375 times a second.
 */
export class Decimator {

    /**
     * @param {number} factor - Integer >= 1. 1 makes this a pure low-pass pass-through.
     * @param {number} [taps=LOWPASS_TAPS]
     */
    constructor( factor, taps = LOWPASS_TAPS ) {

        this.factor = Math.max( 1, Math.round( factor ) );

        // Cut at 90% of the new Nyquist. The 10% guard is the filter's transition band, which a
        // 33-tap Hamming design cannot make arbitrarily narrow.
        this.coefficients = designLowPass( taps, 0.9 * 0.5 / this.factor );

        this.history = new Float32Array( this.coefficients.length );
        this.historyIndex = 0;
        this.phase = 0;

    }

    reset() {

        this.history.fill( 0 );
        this.historyIndex = 0;
        this.phase = 0;

    }

    /**
     * One input sample in; one output sample out on every `factor`-th call, `null` otherwise.
     *
     * 🚩 SAMPLE AT A TIME, DELIBERATELY. The block form of this was the shipped shape for exactly
     * one selftest run, and it produced a real bug: `FrameAnalyser` accumulated full-rate loudness
     * energy for a whole input block before feeding any of it to the decimator, so with a
     * 1024-sample block the first hop of that block received all 1024 samples' worth of energy and
     * the next three received none. Frames were identical at a 128-sample block size and wrong at
     * 1024 — invisible in the browser, where the worklet's block size is always 128. Interleaving
     * the two rates one sample at a time is what makes the block size stop mattering.
     */
    processSample( sample ) {

        const taps = this.coefficients.length;

        this.history[ this.historyIndex ] = sample;
        this.historyIndex = ( this.historyIndex + 1 ) % taps;

        this.phase ++;
        if ( this.phase < this.factor ) return null;
        this.phase = 0;

        // Convolve against the ring, oldest sample first.
        let accumulator = 0;
        let cursor = this.historyIndex;

        for ( let tap = taps - 1; tap >= 0; tap -- ) {

            accumulator += this.coefficients[ tap ] * this.history[ cursor ];
            cursor = ( cursor + 1 ) % taps;

        }

        return accumulator;

    }

    /**
     * Block convenience over `processSample`, for callers that are not interleaving anything.
     *
     * @param {Float32Array} input
     * @param {Float32Array} output - At least `ceil(input.length / factor)` long.
     * @returns {number} How many samples were written to `output`.
     */
    process( input, output ) {

        let written = 0;

        for ( let index = 0; index < input.length; index ++ ) {

            const value = this.processSample( input[ index ] );
            if ( value !== null ) output[ written ++ ] = value;

        }

        return written;

    }

}

/**
 * The detector. Holds its scratch so `detect()` allocates nothing.
 */
export class PitchDetector {

    /**
     * @param {Object} options
     * @param {number} options.sampleRate - The rate of the buffers handed to `detect`, i.e. the
     *   WORKING rate after any decimation, not the audio context's rate.
     * @param {number} options.windowSize - Samples per analysis window.
     * @param {number} [options.minHz=70]
     * @param {number} [options.maxHz=400]
     * @param {number} [options.threshold=MPM_PEAK_THRESHOLD]
     */
    constructor( { sampleRate, windowSize, minHz = DEFAULT_MIN_F0_HZ, maxHz = DEFAULT_MAX_F0_HZ,
        threshold = MPM_PEAK_THRESHOLD } ) {

        this.sampleRate = sampleRate;
        this.windowSize = windowSize;
        this.minHz = minHz;
        this.maxHz = maxHz;
        this.threshold = threshold;

        this.tauMin = Math.max( 2, Math.floor( sampleRate / maxHz ) );
        this.tauMax = Math.min( windowSize - 2, Math.ceil( sampleRate / minHz ) );

        this.nsdf = new Float32Array( this.tauMax + 1 );

        /**
         * How many periods of the lowest F0 the window holds. Below 2 the NSDF's normalising term
         * has too few overlapping samples to mean anything, and the detector will report octave
         * errors with high confidence. Exposed rather than asserted so a caller that deliberately
         * wants a short window can see what it bought.
         */
        this.periodsAtMinF0 = windowSize / this.tauMax;

    }

    /**
     * @param {Float32Array} samples - Exactly `windowSize` samples at `sampleRate`.
     * @returns {{hz: number, clarity: number}} `hz` is 0 when no periodicity was found; `clarity`
     *   is the NSDF height of the chosen peak, on [-1, 1] but in practice [0, 1] for speech.
     */
    detect( samples ) {

        const window = Math.min( samples.length, this.windowSize );
        const nsdf = this.nsdf;

        let tallest = 0;

        for ( let tau = this.tauMin; tau <= this.tauMax; tau ++ ) {

            let correlation = 0;
            let magnitude = 0;
            const overlap = window - tau;

            for ( let index = 0; index < overlap; index ++ ) {

                const a = samples[ index ];
                const b = samples[ index + tau ];
                correlation += a * b;
                magnitude += a * a + b * b;

            }

            // The normalised square difference function. 2r/m is 1 for a perfectly periodic frame
            // at its own period and falls away from it; the normalisation is what makes the
            // threshold below a fixed number instead of a level-dependent one.
            const value = magnitude > 0 ? ( 2 * correlation ) / magnitude : 0;

            nsdf[ tau ] = value;
            if ( value > tallest ) tallest = value;

        }

        if ( tallest <= 0 ) return { hz: 0, clarity: 0 };

        // McLeod's pick: the FIRST local maximum at or above k x tallest. Taking the tallest peak
        // outright is the classic octave error — a signal with a strong second harmonic often
        // correlates marginally better at two periods than at one.
        const cutoff = this.threshold * tallest;

        for ( let tau = this.tauMin + 1; tau < this.tauMax; tau ++ ) {

            if ( nsdf[ tau ] < cutoff ) continue;
            if ( nsdf[ tau ] < nsdf[ tau - 1 ] || nsdf[ tau ] < nsdf[ tau + 1 ] ) continue;

            const refined = parabolicVertex( nsdf[ tau - 1 ], nsdf[ tau ], nsdf[ tau + 1 ] );
            const period = tau + refined.offset;

            return {
                hz: period > 0 ? this.sampleRate / period : 0,
                clarity: Math.min( refined.value, 1 )
            };

        }

        return { hz: 0, clarity: tallest };

    }

}

/**
 * Sub-sample peak location and height, from three equally spaced samples around a maximum.
 *
 * Without this the reported F0 is quantised to the tau lattice: at 12 kHz a 200 Hz voice has a
 * period of 60 samples, and the neighbouring lattice points are 196.7 Hz and 203.4 Hz. That is
 * 0.3 semitones of quantisation noise on a signal whose whole use is a standard deviation.
 */
function parabolicVertex( left, middle, right ) {

    const denominator = left - 2 * middle + right;

    if ( denominator === 0 ) return { offset: 0, value: middle };

    const offset = 0.5 * ( left - right ) / denominator;
    return { offset, value: middle - 0.25 * ( left - right ) * offset };

}

/** Root mean square of a block. The loudness term; research §2 calls it the dominant arousal cue. */
export function rootMeanSquare( samples, count = samples.length ) {

    let sum = 0;
    for ( let index = 0; index < count; index ++ ) sum += samples[ index ] * samples[ index ];

    return Math.sqrt( sum / Math.max( count, 1 ) );

}

/**
 * FrameAnalyser — a stream of audio blocks in, a stream of `{rms, hz, clarity}` frames out.
 *
 * 🚩 THIS LIVES IN THE PITCH MODULE FOR ONE REASON: the AudioWorklet's module graph. `addModule`
 * loads a module script into a scope with no DOM, no `window`, and a much less forgiving loader
 * than the page's. Every file the worklet reaches is a file that has to survive that, so the
 * worklet reaches exactly one, and this is it. `Prosody.js` — which knows about AudioContext,
 * nodes and per-voice statistics — is not in that graph and never should be.
 *
 * The framing decisions, all of which are consequences of the header's measurement rather than
 * preferences:
 *
 *   - The signal is decimated to ~12 kHz before anything else touches it.
 *   - The window holds three periods of the lowest F0 sought, not a round power of two. Two is the
 *     floor for a meaningful NSDF; three is the floor with a margin, and at a 70 Hz minimum it
 *     comes out at 42.9 ms, which is comfortably inside the 100 ms-1 s band affect envelopes
 *     actually move in (research §2).
 *   - RMS is taken on the ORIGINAL full-rate samples over the same span, not on the decimated
 *     ones. Loudness is the dominant arousal carrier (+365.5% for anger) and it is not a
 *     band-limited quantity; measuring it after a 5.4 kHz low-pass would quietly discard every
 *     fricative in the utterance.
 */
export class FrameAnalyser {

    /**
     * @param {Object} options
     * @param {number} options.sampleRate - The audio context's rate.
     * @param {number} [options.hopSeconds=256/48000] - research §2's "1024-window/256-hop"; the hop
     *   is the part of that which transfers directly, since it sets the update rate rather than
     *   the frequency resolution.
     * @param {number} [options.minHz=70]
     * @param {number} [options.maxHz=400]
     * @param {number} [options.windowPeriods=3] - Periods of `minHz` the window must hold.
     */
    constructor( { sampleRate, hopSeconds = 256 / 48000, minHz = DEFAULT_MIN_F0_HZ,
        maxHz = DEFAULT_MAX_F0_HZ, windowPeriods = 3 } ) {

        this.sampleRate = sampleRate;
        this.minHz = minHz;
        this.maxHz = maxHz;

        this.decimation = Math.max( 1, Math.round( sampleRate / TARGET_WORKING_RATE_HZ ) );
        this.workingRate = sampleRate / this.decimation;

        this.decimator = new Decimator( this.decimation );
        this.groupDelaySamples = ( this.decimator.coefficients.length - 1 ) / 2;

        this.hopSize = Math.max( 1, Math.round( hopSeconds * this.workingRate ) );

        // Rounded UP to a whole number of hops, so the loudness window (which is assembled from
        // per-hop energy sums) spans exactly the same samples as the pitch window rather than
        // approximately the same ones.
        this.windowSize = Math.ceil( windowPeriods * this.workingRate / minHz / this.hopSize ) * this.hopSize;

        this.detector = new PitchDetector( {
            sampleRate: this.workingRate,
            windowSize: this.windowSize,
            minHz,
            maxHz
        } );

        // The working-rate ring the detector reads, plus a linear copy for it to read FROM, because
        // the NSDF's inner loop must not pay for a modulo on every sample.
        this.ring = new Float32Array( this.windowSize );
        this.ringIndex = 0;
        this.ringFilled = 0;
        this.window = new Float32Array( this.windowSize );

        // Full-rate energy, one accumulator per hop, so RMS spans the same window as the pitch.
        this.hopsPerWindow = this.windowSize / this.hopSize;
        this.hopEnergy = new Float64Array( this.hopsPerWindow );
        this.hopEnergyIndex = 0;
        this.currentHopEnergy = 0;
        this.currentHopSamples = 0;

        this.samplesSinceHop = 0;
        this.inputSamples = 0;

        /** Reusable frame object. The worklet posts a copy; `analyseBuffer` copies too. */
        this.frame = { time: 0, rms: 0, hz: 0, clarity: 0 };

    }

    reset() {

        this.decimator.reset();
        this.ring.fill( 0 );
        this.ringIndex = 0;
        this.ringFilled = 0;
        this.hopEnergy.fill( 0 );
        this.hopEnergyIndex = 0;
        this.currentHopEnergy = 0;
        this.currentHopSamples = 0;
        this.samplesSinceHop = 0;
        this.inputSamples = 0;

    }

    /**
     * Pushes one block of full-rate mono samples and calls `onFrame` for each analysis frame that
     * completed inside it. Usually zero or one; more only if the block is longer than a hop.
     *
     * @param {Float32Array} block
     * @param {Function} onFrame - `(frame)` with the REUSED frame object. Copy what you keep.
     */
    push( block, onFrame ) {

        for ( let index = 0; index < block.length; index ++ ) {

            const sample = block[ index ];

            // Full-rate energy, interleaved with the decimation rather than batched ahead of it.
            // See `Decimator.processSample` for the bug that made this ordering load-bearing.
            this.currentHopEnergy += sample * sample;
            this.currentHopSamples ++;
            this.inputSamples ++;

            const decimated = this.decimator.processSample( sample );
            if ( decimated === null ) continue;

            this.ring[ this.ringIndex ] = decimated;
            this.ringIndex = ( this.ringIndex + 1 ) % this.windowSize;
            if ( this.ringFilled < this.windowSize ) this.ringFilled ++;

            this.samplesSinceHop ++;
            if ( this.samplesSinceHop < this.hopSize ) continue;

            this.samplesSinceHop = 0;
            this.closeHop();

            if ( this.ringFilled < this.windowSize ) continue;

            this.emit( onFrame );

        }

    }

    /** Rolls the full-rate energy accumulator into the per-hop history. */
    closeHop() {

        this.hopEnergy[ this.hopEnergyIndex ] = this.currentHopSamples > 0
            ? this.currentHopEnergy / this.currentHopSamples : 0;
        this.hopEnergyIndex = ( this.hopEnergyIndex + 1 ) % this.hopsPerWindow;

        this.currentHopEnergy = 0;
        this.currentHopSamples = 0;

    }

    emit( onFrame ) {

        // Unwrap the ring into a linear window, oldest sample first.
        for ( let index = 0; index < this.windowSize; index ++ ) {

            this.window[ index ] = this.ring[ ( this.ringIndex + index ) % this.windowSize ];

        }

        const { hz, clarity } = this.detector.detect( this.window );

        let energy = 0;
        for ( let index = 0; index < this.hopsPerWindow; index ++ ) energy += this.hopEnergy[ index ];

        this.frame.rms = Math.sqrt( energy / this.hopsPerWindow );
        this.frame.hz = hz;
        this.frame.clarity = clarity;

        // The CENTRE of the analysed span, in input-stream seconds, with the anti-alias filter's
        // group delay taken off. A frame timestamped at the moment it was computed would be late
        // by half a window plus the filter — 23 ms at the shipped settings, which is half the
        // AV-sync budget this project spends elsewhere with great care.
        const centreSamples = this.inputSamples
            - this.groupDelaySamples
            - ( this.windowSize * this.decimation ) / 2;

        this.frame.time = centreSamples / this.sampleRate;

        onFrame( this.frame );

    }

    /** What this analyser resolved to, for a HUD or a gate that wants to state its settings. */
    describe() {

        return {
            sampleRate: this.sampleRate,
            decimation: this.decimation,
            workingRate: this.workingRate,
            windowSize: this.windowSize,
            windowSeconds: this.windowSize / this.workingRate,
            hopSize: this.hopSize,
            hopSeconds: this.hopSize / this.workingRate,
            periodsAtMinF0: this.detector.periodsAtMinF0,
            latencySeconds: ( this.groupDelaySamples + ( this.windowSize * this.decimation ) / 2 ) / this.sampleRate
        };

    }

}

/**
 * Hz to semitones above a reference.
 *
 * research §2 states the arousal lift in both units — "~45-49 Hz ~= +3.7 semitones" — and the
 * semitone version is the one that transfers between voices, which is the whole reason
 * `Prosody.js` normalises per voice.
 */
export function hzToSemitones( hz, referenceHz ) {

    if ( ! ( hz > 0 ) || ! ( referenceHz > 0 ) ) return 0;

    return 12 * Math.log2( hz / referenceHz );

}
