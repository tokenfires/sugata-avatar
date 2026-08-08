/**
 * Prosody — RMS and F0, clarity-gated and normalised per voice. Punch-list 4.5.
 *
 * WHAT IT IS FOR, AND THE CONSTRAINT THAT SHAPES IT
 * ------------------------------------------------
 * research/affect-and-animation.md §2: "Valence lives in the text. Arousal lives in the acoustics."
 * Arousal is the half of the affect estimate that text cannot give, and this module produces the
 * three features it is actually carried by: loudness (the dominant carrier by a wide margin —
 * +365.5% for anger against +20.7% on F0 mean), F0 mean, and F0 standard deviation, which the same
 * source calls "the stronger cue" because variability nearly doubles under arousal where the mean
 * moves ~3.7 semitones.
 *
 * 🚩 ANIMATE EARLY — AND THAT IS A CONSTRAINT ON WHERE THIS MODULE MAY BE POINTED.
 * The punch list's standing constraint is "never analyse output audio reactively", and research §8
 * explains why: every timing constraint in the project points the same way, and "a reactive
 * architecture that analyses output audio is fighting all four". So there are two entry points and
 * they are not interchangeable:
 *
 *   `attach(sourceNode)`   — for audio arriving from OUTSIDE: the microphone, a remote speaker.
 *                            Reacting to it is correct, because it is not our mouth. This is the
 *                            input side of Phase 5.6's `ear/Mic.js`.
 *
 *   `analyseBuffer(buffer)` — 🎯 for our OWN synthesised speech, run over the decoded buffer BEFORE
 *                            a sample of it is played. The whole prosody envelope is then known in
 *                            advance and can drive the body AHEAD of the audio, the same way
 *                            `VisemeSchedule` drives the mouth ahead of it. Same DSP, opposite sign
 *                            in time.
 *
 * ⚠️ Pointing `attach()` at our own TTS output would produce numbers that look identical and are
 * structurally one window late. `attach()` warns if it is handed a node the caller has flagged as
 * self-produced; it cannot detect that on its own, which is why the two methods exist separately.
 *
 *
 * PER-VOICE NORMALISATION
 * -----------------------
 * research §2: "Normalise per-voice. Absolute Hz is meaningless across voices." A 233 Hz frame is
 * anger in a male voice and a calm sentence in a female one. So nothing here reports raw Hz as a
 * feature: F0 is reported in SEMITONES relative to a running estimate of this voice's own median,
 * which is the unit the research states the arousal lift in ("+3.7 semitones") and the only one
 * that transfers.
 *
 * The running estimate is a geometric mean over VOICED frames only, with a slow time constant. It
 * is deliberately slower than the affect envelope it feeds: a reference that adapted at the speed
 * of the signal would normalise the signal away.
 *
 * Loudness gets the same treatment in dB, for the same reason — the same voice at the same arousal
 * measures 20 dB apart on a headset and across a room.
 *
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * -----------------------------------------
 * No jitter, no shimmer. research §2: they are voice-PATHOLOGY measures, "fragile in real time,
 * inconsistent in the emotion literature (a 38-study review finds increase, decrease, AND no
 * effect), and meaningless on vocoder output where the TTS controls them."
 *
 * No smoothing into an affect state. The asymmetric attack/decay smoothing (150-250 ms attack,
 * 1.5-3 s decay) belongs to Phase 5's `affect/AffectState.js`, above this. Smoothing here would
 * mean two smoothers in series with no one owning the time constant.
 */

import { FrameAnalyser, hzToSemitones } from './Pitch.js';

/**
 * The voiced/unvoiced gate. research §2: "Clarity is the voiced/unvoiced gate — reject <0.8-0.9
 * rather than smoothing garbage", and punch-list 4.5 restates the band. 0.85 is its midpoint;
 * there is no measurement in the record that picks a point inside the band, and inventing one
 * would be worse than saying so.
 *
 * 🚩 Distinct from `Pitch.MPM_PEAK_THRESHOLD`, which also happens to be 0.9 and decides something
 * else entirely — which NSDF peak to believe, not whether to believe the frame.
 */
export const VOICED_CLARITY_GATE = 0.85;

/**
 * Time constant of the per-voice reference, in seconds of VOICED speech.
 *
 * Chosen against ALMA's affect timescales (research §1) rather than picked: emotion decays over
 * 20 s and mood over 20 minutes, so a reference that settles over ~15 s of voiced audio sits below
 * the mood layer and above the emotion layer. It must not track the emotion it is there to expose.
 */
export const VOICE_REFERENCE_SECONDS = 15;

/**
 * Window over which F0 standard deviation is taken.
 *
 * research §2: affect envelopes "move at 100 ms-1 s, not phoneme rate", and F0 variability is the
 * stronger arousal cue. One second is the top of that band — long enough to contain a pitch
 * contour, short enough that the SD still belongs to the current utterance.
 */
export const VARIABILITY_WINDOW_SECONDS = 1.0;

/** Silence floor. Below this the frame carries no loudness information worth normalising. */
const SILENCE_RMS = 1e-5;

export class Prosody {

    /**
     * @param {Object} [options]
     * @param {number} [options.clarityGate=VOICED_CLARITY_GATE]
     * @param {number} [options.minHz] @param {number} [options.maxHz]
     * @param {number} [options.referenceSeconds=VOICE_REFERENCE_SECONDS]
     * @param {number} [options.variabilitySeconds=VARIABILITY_WINDOW_SECONDS]
     */
    constructor( options = {} ) {

        this.clarityGate = options.clarityGate ?? VOICED_CLARITY_GATE;
        this.minHz = options.minHz;
        this.maxHz = options.maxHz;
        this.referenceSeconds = options.referenceSeconds ?? VOICE_REFERENCE_SECONDS;
        this.variabilitySeconds = options.variabilitySeconds ?? VARIABILITY_WINDOW_SECONDS;

        /** The per-voice references. Null until the voice has said something voiced. */
        this.referenceHz = null;
        this.referenceLoudnessDb = null;
        this.loudnessVarianceDb = 0;

        /** Trailing voiced frames, for the variability window. `{time, semitones}`. */
        this.recentVoiced = [];

        /** The latest reading. Replaced, never mutated in place, so a consumer can hold one. */
        this.current = emptyReading();

        this.node = null;
        this.context = null;
        this.settings = null;
        this.onReading = options.onReading ?? null;

        this.frameCount = 0;
        this.voicedFrameCount = 0;

    }

    // --- live input ---------------------------------------------------------------------------

    /**
     * Loads the worklet module into an AudioContext. Idempotent per context; call once at startup
     * so the first `attach` does not pay for a network round trip.
     *
     * 🚩 WHY `?worker&url` AND NOT `new URL('./prosody-worklet.js', import.meta.url)`.
     *
     * The obvious form was the shipped one, it worked perfectly in the dev server, and it is
     * BROKEN IN A PRODUCTION BUILD. Measured, not suspected: `vite build` sees a 2.9 kB asset,
     * decides it is under the inline limit, and rewrites the reference to a
     * `data:text/javascript;base64,...` URL — with `import { FrameAnalyser } from './Pitch.js'`
     * still inside it. A relative import cannot resolve against a `data:` URL, so `addModule`
     * rejects on the first line of the worklet, in production only, on a page that worked all the
     * way through development. The base64 payload was decoded out of the built chunk to confirm
     * the import survived verbatim.
     *
     * `?worker&url` makes the bundler treat the worklet as its own entry point: it resolves and
     * inlines `Pitch.js`, emits ONE real file (5.27 kB measured), and hands back its URL. No
     * imports remain in the emitted module, which is exactly what an AudioWorklet needs.
     *
     * ⚠️ `?worker&url` is a Vite/Rollup convention, so this is one line of build-tool coupling in
     * an otherwise portable package. It is a dynamic import inside a try so that a bundler which
     * does not understand it falls back to the plain URL — which is correct everywhere the
     * inlining problem above does not apply, including every dev server.
     */
    static async addModule( context ) {

        if ( context.__sugataProsodyModule === undefined ) {

            context.__sugataProsodyModule = ( async () => {

                await context.audioWorklet.addModule( await resolveWorkletUrl() );

            } )();

        }

        return context.__sugataProsodyModule;

    }

    /**
     * Attaches to a live source — the microphone, or another party's audio.
     *
     * 🚩 NOT for our own TTS. See the header, and use `analyseBuffer`.
     *
     * @param {AudioNode} sourceNode
     * @param {Object} [options]
     * @param {boolean} [options.selfProduced=false] - Set true only to acknowledge deliberately
     *   analysing our own output; it warns and proceeds.
     * @returns {Promise<AudioWorkletNode>}
     */
    async attach( sourceNode, options = {} ) {

        if ( options.selfProduced === true ) {

            console.warn(
                'Prosody.attach() on self-produced audio is reactive by construction and lands one ' +
                'analysis window late. research/affect-and-animation.md §8: every timing constraint ' +
                'in this project points the other way. Use analyseBuffer() before playback.'
            );

        }

        this.context = sourceNode.context;
        await Prosody.addModule( this.context );

        this.node = new AudioWorkletNode( this.context, 'sugata-prosody', {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            processorOptions: { minHz: this.minHz, maxHz: this.maxHz }
        } );

        this.node.port.onmessage = ( event ) => {

            const message = event.data;

            if ( message.type === 'ready' ) {

                this.settings = message.settings;
                return;

            }

            if ( message.type !== 'frames' ) return;

            for ( const frame of message.frames ) this.ingest( frame );

        };

        sourceNode.connect( this.node );

        return this.node;

    }

    /** Stops the processor and releases the node. The source node is left alone. */
    detach() {

        if ( this.node === null ) return;

        this.node.port.postMessage( { type: 'stop' } );
        this.node.disconnect();
        this.node = null;

    }

    // --- ahead-of-playback -----------------------------------------------------------------

    /**
     * 🎯 Analyses a decoded buffer offline, returning the whole prosody track BEFORE it plays.
     *
     * This is the entry point that honours "animate early". Hand it the TTS output the moment it
     * decodes, and the body has the loudness and pitch envelope of the utterance in hand while the
     * first sample is still queued.
     *
     * Runs the same `FrameAnalyser` the worklet runs, so the two paths cannot drift — the
     * self-test asserts they agree frame for frame on the same signal.
     *
     * @param {{sampleRate: number, length: number, getChannelData: Function}|Object} buffer -
     *   An AudioBuffer, or `{sampleRate, channelData: Float32Array}` in a headless test.
     * @param {number} [blockSize=128] - Fed in blocks so the streaming path is the one exercised.
     * @returns {Array<{time, rms, hz, clarity}>} Frames, in order, timestamped from buffer start.
     */
    analyseBuffer( buffer, blockSize = 128 ) {

        const sampleRate = buffer.sampleRate;
        const samples = buffer.channelData ?? buffer.getChannelData( 0 );

        const analyser = new FrameAnalyser( {
            sampleRate,
            minHz: this.minHz,
            maxHz: this.maxHz
        } );

        const frames = [];
        const onFrame = ( frame ) => frames.push( {
            time: frame.time, rms: frame.rms, hz: frame.hz, clarity: frame.clarity
        } );

        for ( let offset = 0; offset < samples.length; offset += blockSize ) {

            analyser.push( samples.subarray( offset, Math.min( offset + blockSize, samples.length ) ), onFrame );

        }

        this.settings = analyser.describe();

        return frames;

    }

    /**
     * Folds a whole frame track through the same normalisation the live path uses, and returns the
     * reading track. For an utterance we already hold, this is the "arousal envelope, in advance".
     */
    readingsFor( frames ) {

        return frames.map( ( frame ) => this.ingest( frame ) );

    }

    // --- normalisation ------------------------------------------------------------------------

    /**
     * One frame in, one reading out. The single place the clarity gate and the per-voice
     * references are applied, so the live and offline paths cannot disagree about them.
     */
    ingest( frame ) {

        this.frameCount ++;

        const voiced = frame.clarity >= this.clarityGate && frame.hz > 0;
        const loudnessDb = frame.rms > SILENCE_RMS ? 20 * Math.log10( frame.rms ) : null;

        if ( voiced ) {

            this.voicedFrameCount ++;
            this.updateReferences( frame, loudnessDb );
            this.recentVoiced.push( { time: frame.time, semitones: hzToSemitones( frame.hz, this.referenceHz ) } );

        }

        // The variability window is trimmed on every frame, voiced or not, so a pause shortens the
        // window rather than freezing a stale standard deviation across it.
        const cutoff = frame.time - this.variabilitySeconds;
        while ( this.recentVoiced.length > 0 && this.recentVoiced[ 0 ].time < cutoff ) this.recentVoiced.shift();

        const semitones = voiced ? hzToSemitones( frame.hz, this.referenceHz ) : 0;
        const statistics = meanAndStandardDeviation( this.recentVoiced.map( ( item ) => item.semitones ) );

        this.current = {
            time: frame.time,
            voiced,
            clarity: frame.clarity,

            rms: frame.rms,
            loudnessDb: loudnessDb ?? -Infinity,
            loudnessZ: this.loudnessZFor( loudnessDb ),

            // 🚩 Reported for diagnostics and never as a feature — it is the quantity research §2
            // says is meaningless across voices.
            f0Hz: voiced ? frame.hz : 0,

            f0Semitones: semitones,
            f0MeanSemitones: statistics.mean,
            f0StdSemitones: statistics.standardDeviation,

            referenceHz: this.referenceHz,
            voicedFraction: this.frameCount > 0 ? this.voicedFrameCount / this.frameCount : 0
        };

        if ( this.onReading !== null ) this.onReading( this.current );

        return this.current;

    }

    /**
     * Slides the per-voice references toward this frame.
     *
     * The pitch reference is a GEOMETRIC mean — averaged in log space — because pitch is perceived
     * and reported logarithmically and an arithmetic mean of Hz is biased by the high excursions
     * that arousal produces, which is exactly the signal being normalised out.
     */
    updateReferences( frame, loudnessDb ) {

        // One frame's share of the reference time constant. Derived from the analyser's own hop so
        // the constant is 15 seconds of audio at any sample rate or hop size.
        const hopSeconds = this.settings?.hopSeconds ?? ( 256 / 48000 );
        const alpha = Math.min( 1, hopSeconds / this.referenceSeconds );

        if ( this.referenceHz === null ) {

            this.referenceHz = frame.hz;

        } else {

            this.referenceHz = Math.exp(
                ( 1 - alpha ) * Math.log( this.referenceHz ) + alpha * Math.log( frame.hz ) );

        }

        if ( loudnessDb === null ) return;

        if ( this.referenceLoudnessDb === null ) {

            this.referenceLoudnessDb = loudnessDb;
            this.loudnessVarianceDb = 1;
            return;

        }

        const delta = loudnessDb - this.referenceLoudnessDb;
        this.referenceLoudnessDb += alpha * delta;
        this.loudnessVarianceDb = ( 1 - alpha ) * ( this.loudnessVarianceDb + alpha * delta * delta );

    }

    loudnessZFor( loudnessDb ) {

        if ( loudnessDb === null || this.referenceLoudnessDb === null ) return 0;

        const deviation = Math.sqrt( Math.max( this.loudnessVarianceDb, 1e-6 ) );
        return ( loudnessDb - this.referenceLoudnessDb ) / deviation;

    }

    /** Forgets the voice. Call when the speaker changes; keeping the old reference is worse. */
    resetVoice() {

        this.referenceHz = null;
        this.referenceLoudnessDb = null;
        this.loudnessVarianceDb = 0;
        this.recentVoiced.length = 0;
        this.frameCount = 0;
        this.voicedFrameCount = 0;
        this.current = emptyReading();

    }

}

/**
 * The worklet's URL, bundled if the toolchain understands how, plain if it does not.
 * See `Prosody.addModule` for the production failure this exists to avoid.
 */
async function resolveWorkletUrl() {

    try {

        const bundled = await import( './prosody-worklet.js?worker&url' );
        if ( typeof bundled.default === 'string' ) return bundled.default;

    } catch {

        // Not a Vite/Rollup toolchain. The plain URL is correct wherever the module is served as
        // a real file, which is every dev server and every non-inlining bundler.

    }

    // ⚠️ THE FILENAME IS SPLIT ON PURPOSE. Written as one literal, Vite recognises the
    // `new URL(..., import.meta.url)` form and inlines the worklet as the same broken base64
    // `data:` URL described above — 4 kB of dead payload in the main chunk that, if it were ever
    // reached, would fail. Splitting the string takes this path out of the bundler's static
    // analysis and leaves it as what it is: the plain fetch, for toolchains that do not rewrite it.
    return new URL( './prosody-worklet' + '.js', import.meta.url );

}

function emptyReading() {

    return {
        time: 0, voiced: false, clarity: 0,
        rms: 0, loudnessDb: -Infinity, loudnessZ: 0,
        f0Hz: 0, f0Semitones: 0, f0MeanSemitones: 0, f0StdSemitones: 0,
        referenceHz: null, voicedFraction: 0
    };

}

function meanAndStandardDeviation( values ) {

    if ( values.length === 0 ) return { mean: 0, standardDeviation: 0 };

    let sum = 0;
    for ( const value of values ) sum += value;
    const mean = sum / values.length;

    let squared = 0;
    for ( const value of values ) squared += ( value - mean ) ** 2;

    return { mean, standardDeviation: Math.sqrt( squared / values.length ) };

}
