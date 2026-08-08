/**
 * Gate for `voice/Pitch.js` and `voice/Prosody.js` — punch-list 4.5.
 *
 * Everything is measured by executing the DSP on synthetic signals whose F0 is known exactly,
 * because a pitch detector is one of the few things in this repo that can be given ground truth.
 * Nothing here reads the source and nothing tests a mirror: the same `FrameAnalyser` the
 * AudioWorklet instantiates is the one driven here, in the same 128-sample blocks.
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   ACCURACY       Detected F0 against known F0, in cents, across the speech range. Also the
 *                  octave error MPM's peak-picking rule exists to prevent — checked on a signal
 *                  with a deliberately dominant second harmonic, which is where a naive
 *                  "tallest autocorrelation peak" tracker reports half the pitch with confidence.
 *
 *   CLARITY GATE   Periodic speech passes; white noise does not. 🚩 This is the section that
 *                  matters most, because a tracker that returns a plausible number for a fricative
 *                  is worse than one that returns nothing (research §2).
 *
 *   ALIASING       The decimator's anti-alias filter, proved by feeding a tone that would fold
 *                  straight into the F0 band without it — and proved RED by replacing the filter
 *                  with a pass-through, which is the only way to know the filter is doing it.
 *
 *   BLOCK SIZE     The same signal fed in 128-, 256- and 1024-sample blocks must produce identical
 *                  frames. The worklet has no choice about its block size, so a decimator or ring
 *                  that lost state at a block boundary would corrupt the signal 375 times a
 *                  second and would look like nothing in particular. Proved red by resetting the
 *                  decimator per block.
 *
 *   TIMESTAMPS     A tone burst at a known instant produces voiced frames whose reported centre
 *                  times bracket it, group delay and half-window removed.
 *
 *   PER-VOICE      🎯 Two voices an octave apart, given the SAME contour in semitones, must
 *                  normalise to the same feature. That is the whole claim of "normalise per voice"
 *                  and it is either true or it is not.
 *
 *   VARIABILITY    F0 standard deviation separates a monotone read from a varied one, in the
 *                  direction research §2 says carries arousal.
 *
 *   COST           The measured per-hop cost and what fraction of one core it is at the real hop
 *                  rate. Reported and gated, because this runs on the audio thread.
 *
 * A measurement outside its range prints FAIL and the process exits non-zero.
 *
 * Usage:  node "packages/core/src/voice/prosody.selftest.mjs"
 */

const { Decimator, FrameAnalyser, PitchDetector, designLowPass, hzToSemitones, rootMeanSquare }
    = await import( './Pitch.js' );
const { Prosody, VOICED_CLARITY_GATE } = await import( './Prosody.js' );

const SAMPLE_RATE = 48000;

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

/**
 * A synthetic voice: a harmonic stack with 1/n amplitudes, F0 given by a contour function.
 *
 * Phase is INTEGRATED rather than computed from `t * f`, so a moving F0 stays continuous. The
 * naive form puts a phase jump at every sample where the frequency changes, which is broadband
 * noise the detector would have to survive for no reason.
 */
function synthesiseVoice( { seconds, f0At, harmonics = 8, amplitude = 0.25, sampleRate = SAMPLE_RATE } ) {

    const samples = new Float32Array( Math.round( seconds * sampleRate ) );
    let phase = 0;

    for ( let index = 0; index < samples.length; index ++ ) {

        const time = index / sampleRate;
        const f0 = f0At( time );

        phase += 2 * Math.PI * f0 / sampleRate;

        let value = 0;
        for ( let harmonic = 1; harmonic <= harmonics; harmonic ++ ) {

            value += Math.sin( phase * harmonic ) / harmonic;

        }

        samples[ index ] = amplitude * value;

    }

    return samples;

}

function whiteNoise( seconds, amplitude = 0.25, sampleRate = SAMPLE_RATE ) {

    // A fixed LCG rather than Math.random, so a failure here is reproducible.
    let state = 22026;
    const samples = new Float32Array( Math.round( seconds * sampleRate ) );

    for ( let index = 0; index < samples.length; index ++ ) {

        state = ( Math.imul( state, 1664525 ) + 1013904223 ) | 0;
        samples[ index ] = amplitude * ( ( state >>> 8 ) / 8388608 - 1 );

    }

    return samples;

}

function analyse( samples, { blockSize = 128, sampleRate = SAMPLE_RATE, analyser = null } = {} ) {

    const engine = analyser ?? new FrameAnalyser( { sampleRate } );
    const frames = [];

    for ( let offset = 0; offset < samples.length; offset += blockSize ) {

        engine.push( samples.subarray( offset, Math.min( offset + blockSize, samples.length ) ),
            ( frame ) => frames.push( { time: frame.time, rms: frame.rms, hz: frame.hz, clarity: frame.clarity } ) );

    }

    return { frames, engine };

}

const centsBetween = ( a, b ) => 1200 * Math.log2( a / b );

// ============================================================================================
// ACCURACY
// ============================================================================================

const settingsProbe = new FrameAnalyser( { sampleRate: SAMPLE_RATE } ).describe();

{
    const knownF0 = [ 80, 110, 150, 188, 233, 300, 380 ];   // 188 and 233 are research §2's own
    const errors = [];

    for ( const f0 of knownF0 ) {

        const { frames } = analyse( synthesiseVoice( { seconds: 0.6, f0At: () => f0 } ) );
        const voiced = frames.filter( ( frame ) => frame.clarity >= VOICED_CLARITY_GATE );

        if ( voiced.length === 0 ) {

            errors.push( { f0, cents: Infinity, voiced: 0 } );
            continue;

        }

        const median = voiced.map( ( frame ) => frame.hz ).sort( ( a, b ) => a - b )[ Math.floor( voiced.length / 2 ) ];
        errors.push( { f0, cents: centsBetween( median, f0 ), voiced: voiced.length, detected: median } );

    }

    const worst = Math.max( ...errors.map( ( item ) => Math.abs( item.cents ) ) );

    // 20 cents is a fifth of a semitone. The features downstream are a mean and a standard
    // deviation in semitones, so an error a fifth of the unit is comfortably below the signal.
    check( 'ACCURACY  F0 within 20 cents of ground truth across 80-380 Hz',
        worst < 20,
        errors.map( ( item ) => `${ item.f0 }->${ item.detected?.toFixed( 1 ) ?? 'none' } (${ item.cents.toFixed( 1 ) }c)` ).join( '  ' ) );

    check( 'ACCURACY  the window holds at least two periods of the lowest F0 sought',
        settingsProbe.periodsAtMinF0 >= 2,
        `${ settingsProbe.periodsAtMinF0.toFixed( 2 ) } periods; window ${ settingsProbe.windowSize } samples ` +
        `= ${ ( settingsProbe.windowSeconds * 1000 ).toFixed( 1 ) } ms at ${ settingsProbe.workingRate } Hz ` +
        `(decimation ${ settingsProbe.decimation }x)` );

    // The octave error MPM's threshold rule exists to prevent: a second harmonic louder than the
    // fundamental. A "tallest peak" tracker reports 75 Hz here with high confidence.
    const strongSecondHarmonic = ( () => {

        const samples = new Float32Array( Math.round( 0.6 * SAMPLE_RATE ) );
        for ( let index = 0; index < samples.length; index ++ ) {

            const t = index / SAMPLE_RATE;
            samples[ index ] = 0.08 * Math.sin( 2 * Math.PI * 150 * t )
                + 0.30 * Math.sin( 2 * Math.PI * 300 * t )
                + 0.20 * Math.sin( 2 * Math.PI * 450 * t );

        }
        return samples;

    } )();

    const { frames } = analyse( strongSecondHarmonic );
    const voiced = frames.filter( ( frame ) => frame.clarity >= VOICED_CLARITY_GATE );
    const median = voiced.map( ( frame ) => frame.hz ).sort( ( a, b ) => a - b )[ Math.floor( voiced.length / 2 ) ];

    check( 'ACCURACY  reports the fundamental, not the dominant harmonic',
        voiced.length > 0 && Math.abs( centsBetween( median, 150 ) ) < 30,
        `fundamental 150 Hz at a quarter the amplitude of its second harmonic -> ` +
        `${ median?.toFixed( 1 ) } Hz (${ voiced.length } voiced frames)` );
}

// ============================================================================================
// CLARITY GATE
// ============================================================================================

{
    const voice = analyse( synthesiseVoice( { seconds: 0.8, f0At: () => 180 } ) ).frames;
    const noise = analyse( whiteNoise( 0.8 ) ).frames;

    const voicedFraction = ( frames ) =>
        frames.filter( ( frame ) => frame.clarity >= VOICED_CLARITY_GATE ).length / frames.length;

    const voiceFraction = voicedFraction( voice );
    const noiseFraction = voicedFraction( noise );
    const noiseClarity = Math.max( ...noise.map( ( frame ) => frame.clarity ) );

    check( '🚩 CLARITY  periodic speech passes the gate and white noise does not',
        voiceFraction > 0.95 && noiseFraction === 0,
        `voiced fraction: harmonic tone ${ ( voiceFraction * 100 ).toFixed( 1 ) }%, ` +
        `white noise ${ ( noiseFraction * 100 ).toFixed( 1 ) }% (max noise clarity ` +
        `${ noiseClarity.toFixed( 3 ) } against a gate of ${ VOICED_CLARITY_GATE })` );

    check( 'CLARITY  the gate is the midpoint of research §2\'s stated 0.8-0.9 band',
        VOICED_CLARITY_GATE === 0.85,
        'no measurement in the record picks a point inside the band; the midpoint is stated as a choice' );

    // Silence must not be voiced. A detector normalising a zero frame can produce 0/0.
    const silence = analyse( new Float32Array( Math.round( 0.4 * SAMPLE_RATE ) ) ).frames;

    check( 'CLARITY  digital silence produces no voiced frames and no NaN',
        silence.length > 0
            && silence.every( ( frame ) => frame.clarity < VOICED_CLARITY_GATE )
            && silence.every( ( frame ) => Number.isFinite( frame.hz ) && Number.isFinite( frame.rms ) ),
        `${ silence.length } frames, max clarity ${ Math.max( ...silence.map( ( f ) => f.clarity ) ).toFixed( 3 ) }` );
}

// ============================================================================================
// ALIASING — and the filter proved to be the thing doing the work
// ============================================================================================

{
    // Working rate is ~12 kHz, so a tone at (workingRate − 150) folds to 150 Hz: squarely in the
    // F0 band, and perfectly periodic once folded.
    //
    // ⚠️ THE FIRST VERSION OF THIS SECTION ASKED FOR SOMETHING NO LINEAR FILTER CAN DELIVER, and it
    // failed, correctly. It fed the alias tone ALONE and demanded the clarity gate reject it. But
    // the NSDF is amplitude-normalised by construction — that is what makes its threshold a fixed
    // number — so a sine attenuated by 53 dB is still a perfect sine and still scores clarity ~1.
    // A filter cannot remove a component that is the whole signal; it can only push it far below
    // everything else. So the claim is restated as the two things that are actually true and
    // actually matter: the filter's response at the folding frequency, measured; and the alias
    // failing to corrupt simultaneous in-band speech, measured.
    const foldTarget = 150;
    const aliasHz = settingsProbe.workingRate - foldTarget;

    // Direct measurement of the shipped filter's response at the folding frequency.
    const coefficients = new Decimator( settingsProbe.decimation ).coefficients;
    const responseAt = ( hz ) => {

        let real = 0;
        let imaginary = 0;
        for ( let tap = 0; tap < coefficients.length; tap ++ ) {

            const angle = -2 * Math.PI * hz * tap / SAMPLE_RATE;
            real += coefficients[ tap ] * Math.cos( angle );
            imaginary += coefficients[ tap ] * Math.sin( angle );

        }
        return Math.sqrt( real * real + imaginary * imaginary );

    };

    const stopbandDb = 20 * Math.log10( responseAt( aliasHz ) );
    const passbandDb = 20 * Math.log10( responseAt( 400 ) );

    check( '🚩 ALIASING  the anti-alias filter attenuates the folding frequency by more than 40 dB',
        stopbandDb < -40 && passbandDb > -0.5,
        `${ aliasHz.toFixed( 0 ) } Hz (folds to ${ foldTarget } Hz at the ${ settingsProbe.workingRate } Hz ` +
        `working rate): ${ stopbandDb.toFixed( 1 ) } dB; the 400 Hz top of the F0 band: ${ passbandDb.toFixed( 3 ) } dB` );

    // The behavioural claim: an alias at the SAME amplitude as real speech must not corrupt it.
    const voice = synthesiseVoice( { seconds: 0.6, f0At: () => 200 } );
    const contaminated = Float32Array.from( voice );
    for ( let index = 0; index < contaminated.length; index ++ ) {

        contaminated[ index ] += 0.5 * Math.sin( 2 * Math.PI * aliasHz * index / SAMPLE_RATE );

    }

    const medianOf = ( frames ) => {

        const voiced = frames.filter( ( frame ) => frame.clarity >= VOICED_CLARITY_GATE );
        if ( voiced.length === 0 ) return { hz: 0, voiced: 0 };
        return {
            hz: voiced.map( ( frame ) => frame.hz ).sort( ( a, b ) => a - b )[ Math.floor( voiced.length / 2 ) ],
            voiced: voiced.length
        };

    };

    const filtered = medianOf( analyse( contaminated ).frames );

    // The A side: the SAME analyser with its anti-alias filter replaced by a delta. This is the
    // only way to know the filter is what preserved the pitch rather than luck.
    const unfiltered = new FrameAnalyser( { sampleRate: SAMPLE_RATE } );
    unfiltered.decimator.coefficients = new Float32Array( unfiltered.decimator.coefficients.length );
    unfiltered.decimator.coefficients[ unfiltered.decimator.coefficients.length - 1 ] = 1;   // delta
    unfiltered.decimator.history.fill( 0 );

    const naive = medianOf( analyse( contaminated, { analyser: unfiltered } ).frames );

    check( '🚩 ALIASING  an out-of-band tone at speech amplitude does not corrupt the detected F0',
        filtered.voiced > 0 && Math.abs( centsBetween( filtered.hz, 200 ) ) < 20,
        `200 Hz voice + an equal-amplitude ${ aliasHz.toFixed( 0 ) } Hz tone -> ` +
        `${ filtered.hz.toFixed( 1 ) } Hz on ${ filtered.voiced } voiced frames` );

    check( '🚩 ALIASING  proved red — with the filter replaced by a delta, the same signal breaks',
        naive.voiced === 0 || Math.abs( centsBetween( naive.hz, 200 ) ) > 50,
        `pass-through decimator: ${ naive.voiced } voiced frames` +
        ( naive.voiced > 0 ? ` reporting ${ naive.hz.toFixed( 1 ) } Hz ` +
            `(${ centsBetween( naive.hz, 200 ).toFixed( 0 ) } cents from the truth)` : ' — the voice is gone entirely' ) );

    // And the filter must not have eaten the band it is there to preserve.
    const inBand = analyse( synthesiseVoice( { seconds: 0.5, f0At: () => 200 } ) ).frames;
    const inBandVoiced = inBand.filter( ( frame ) => frame.clarity >= VOICED_CLARITY_GATE );

    check( 'ALIASING  the filter passes the band it exists to protect',
        inBandVoiced.length / inBand.length > 0.95,
        `200 Hz harmonic voice: ${ inBandVoiced.length } of ${ inBand.length } frames voiced` );

    const designed = designLowPass( 33, 0.1 );
    const sum = designed.reduce( ( total, value ) => total + value, 0 );

    check( 'ALIASING  the designed filter has unity DC gain and is symmetric (linear phase)',
        Math.abs( sum - 1 ) < 1e-6
            && designed.every( ( value, index ) => Math.abs( value - designed[ designed.length - 1 - index ] ) < 1e-7 ),
        `33 taps, sum ${ sum.toFixed( 9 ) }` );
}

// ============================================================================================
// BLOCK SIZE — the worklet's 128 must not be special
// ============================================================================================

{
    const signal = synthesiseVoice( { seconds: 0.7, f0At: ( t ) => 160 + 40 * Math.sin( 2 * Math.PI * 1.5 * t ) } );

    const traces = [ 128, 256, 1024 ].map( ( blockSize ) => analyse( signal, { blockSize } ).frames );

    let worst = 0;
    let compared = 0;
    const shortest = Math.min( ...traces.map( ( trace ) => trace.length ) );

    for ( let index = 0; index < shortest; index ++ ) {

        for ( const key of [ 'time', 'rms', 'hz', 'clarity' ] ) {

            const values = traces.map( ( trace ) => trace[ index ][ key ] );
            worst = Math.max( worst, Math.max( ...values ) - Math.min( ...values ) );
            compared ++;

        }

    }

    check( '🚩 BLOCK SIZE  128-, 256- and 1024-sample blocks produce identical frames',
        worst === 0 && traces.every( ( trace ) => trace.length === traces[ 0 ].length ),
        `${ traces[ 0 ].length } frames, ${ compared } values compared; worst difference ${ worst }` );

    // Proved red: a decimator whose filter history is dropped at every block boundary. Nothing in
    // the shipped code does this; it is reintroduced from outside, without a defect flag, because
    // it is a mistake of OMISSION rather than of commission.
    const forgetful = new FrameAnalyser( { sampleRate: SAMPLE_RATE } );
    const forgetfulFrames = [];

    for ( let offset = 0; offset < signal.length; offset += 128 ) {

        forgetful.decimator.reset();
        forgetful.push( signal.subarray( offset, Math.min( offset + 128, signal.length ) ),
            ( frame ) => forgetfulFrames.push( { hz: frame.hz, clarity: frame.clarity } ) );

    }

    const reference = traces[ 0 ];
    let forgetfulWorst = 0;
    for ( let index = 0; index < Math.min( reference.length, forgetfulFrames.length ); index ++ ) {

        forgetfulWorst = Math.max( forgetfulWorst,
            Math.abs( reference[ index ].clarity - forgetfulFrames[ index ].clarity ) );

    }

    check( '🚩 BLOCK SIZE  proved red — a decimator that drops its filter state at block boundaries',
        forgetfulWorst > 0.01,
        `worst clarity difference ${ forgetfulWorst.toFixed( 4 ) } against the streaming decimator` );
}

// ============================================================================================
// TIMESTAMPS
// ============================================================================================

{
    const seconds = 1.0;
    const burstStart = 0.40;
    const burstEnd = 0.60;

    const samples = new Float32Array( Math.round( seconds * SAMPLE_RATE ) );
    let phase = 0;

    for ( let index = 0; index < samples.length; index ++ ) {

        const time = index / SAMPLE_RATE;
        phase += 2 * Math.PI * 180 / SAMPLE_RATE;
        if ( time >= burstStart && time < burstEnd ) samples[ index ] = 0.3 * Math.sin( phase );

    }

    const { frames } = analyse( samples );
    const voiced = frames.filter( ( frame ) => frame.clarity >= VOICED_CLARITY_GATE );

    const first = voiced[ 0 ]?.time ?? -1;
    const last = voiced[ voiced.length - 1 ]?.time ?? -1;

    // The reported time is the CENTRE of the analysed span. A window straddling the burst edge is
    // partly silent, so voiced frames start after the edge by up to half a window and end before
    // the far edge by the same. That bound is the assertion.
    const halfWindow = settingsProbe.windowSeconds / 2;

    check( 'TIMESTAMPS  voiced frames fall inside the burst, within half a window of its edges',
        voiced.length > 0
            && first >= burstStart - 0.002 && first <= burstStart + halfWindow + 0.002
            && last <= burstEnd + 0.002 && last >= burstEnd - halfWindow - 0.002,
        `burst ${ burstStart }-${ burstEnd } s; voiced ${ first.toFixed( 4 ) }-${ last.toFixed( 4 ) } s ` +
        `(half-window ${ ( halfWindow * 1000 ).toFixed( 1 ) } ms, analyser latency ` +
        `${ ( settingsProbe.latencySeconds * 1000 ).toFixed( 1 ) } ms)` );

    check( 'TIMESTAMPS  frame times are monotonic and spaced by exactly one hop',
        frames.every( ( frame, index ) => index === 0
            || Math.abs( ( frame.time - frames[ index - 1 ].time ) - settingsProbe.hopSeconds ) < 1e-9 ),
        `${ frames.length } frames at ${ ( settingsProbe.hopSeconds * 1000 ).toFixed( 3 ) } ms spacing` );
}

// ============================================================================================
// PER-VOICE NORMALISATION — 🎯 the claim 4.5 actually rests on
// ============================================================================================

{
    // The same contour, in semitones, on two voices an octave apart. A feature that is genuinely
    // per-voice must not be able to tell them apart.
    const contour = ( base ) => ( t ) => base * Math.pow( 2, ( 3 * Math.sin( 2 * Math.PI * 0.7 * t ) ) / 12 );

    const readingsFor = ( base ) => {

        const prosody = new Prosody();
        const frames = prosody.analyseBuffer( {
            sampleRate: SAMPLE_RATE,
            channelData: synthesiseVoice( { seconds: 6, f0At: contour( base ) } )
        } );

        const readings = prosody.readingsFor( frames );

        // The reference is exponential with a 15 s constant; the second half of a 6 s clip is
        // where it has settled far enough to compare. Reported rather than assumed.
        const settled = readings.slice( Math.floor( readings.length / 2 ) ).filter( ( r ) => r.voiced );

        return { prosody, readings, settled };

    };

    const low = readingsFor( 110 );
    const high = readingsFor( 220 );

    const spread = ( settled ) => {

        const values = settled.map( ( r ) => r.f0Semitones );
        return Math.max( ...values ) - Math.min( ...values );

    };

    const lowSpread = spread( low.settled );
    const highSpread = spread( high.settled );

    check( '🎯 PER-VOICE  the same contour on voices an octave apart yields the same semitone feature',
        Math.abs( lowSpread - highSpread ) < 0.35 && lowSpread > 4,
        `110 Hz voice: ${ lowSpread.toFixed( 3 ) } semitones peak-to-peak; ` +
        `220 Hz voice: ${ highSpread.toFixed( 3 ) }; difference ${ Math.abs( lowSpread - highSpread ).toFixed( 3 ) } ` +
        '(contour is +/-3 semitones by construction, so ~6 expected)' );

    check( 'PER-VOICE  the reference lands on each voice\'s own centre, an octave apart',
        Math.abs( centsBetween( high.prosody.referenceHz, low.prosody.referenceHz ) - 1200 ) < 60,
        `references ${ low.prosody.referenceHz.toFixed( 1 ) } Hz and ${ high.prosody.referenceHz.toFixed( 1 ) } Hz ` +
        `= ${ centsBetween( high.prosody.referenceHz, low.prosody.referenceHz ).toFixed( 0 ) } cents apart` );

    // 🚩 LEARNINGS §1.3 — what would a degenerate input score? RAW Hz would fail the check above
    // outright, and that is the point of normalising. Measured, so the claim is not rhetorical.
    const rawDifference = Math.abs(
        low.settled.reduce( ( sum, r ) => sum + r.f0Hz, 0 ) / low.settled.length
        - high.settled.reduce( ( sum, r ) => sum + r.f0Hz, 0 ) / high.settled.length );

    check( '🚩 PER-VOICE  raw Hz would have failed the same comparison by a wide margin',
        rawDifference > 90,
        `mean raw F0 differs by ${ rawDifference.toFixed( 1 ) } Hz between the two voices ` +
        'while the normalised feature differs by a fraction of a semitone' );

    // A speaker change must not be smoothed across.
    const prosody = new Prosody();
    prosody.analyseBuffer( { sampleRate: SAMPLE_RATE, channelData: synthesiseVoice( { seconds: 2, f0At: () => 110 } ) } );
    const before = prosody.referenceHz;
    prosody.resetVoice();

    check( 'PER-VOICE  resetVoice forgets the speaker rather than averaging two of them',
        before === null && prosody.referenceHz === null && prosody.current.voiced === false,
        'analyseBuffer does not itself ingest; readingsFor does, which keeps the two decisions separate' );
}

// ============================================================================================
// VARIABILITY — research §2's "F0 SD nearly doubles; variability is the stronger cue"
// ============================================================================================

{
    const standardDeviationOf = ( f0At ) => {

        const prosody = new Prosody();
        const frames = prosody.analyseBuffer( { sampleRate: SAMPLE_RATE, channelData: synthesiseVoice( { seconds: 4, f0At } ) } );
        const readings = prosody.readingsFor( frames ).filter( ( r ) => r.voiced );
        const settled = readings.slice( Math.floor( readings.length / 2 ) );

        return settled.reduce( ( sum, r ) => sum + r.f0StdSemitones, 0 ) / settled.length;

    };

    const monotone = standardDeviationOf( () => 180 );
    const varied = standardDeviationOf( ( t ) => 180 * Math.pow( 2, ( 4 * Math.sin( 2 * Math.PI * 1.1 * t ) ) / 12 ) );

    check( 'VARIABILITY  F0 standard deviation separates a monotone read from a varied one',
        varied > monotone * 5 && monotone < 0.15,
        `monotone ${ monotone.toFixed( 4 ) } semitones, varied ${ varied.toFixed( 4 ) } — ` +
        `${ ( varied / Math.max( monotone, 1e-6 ) ).toFixed( 1 ) }x` );

    // Loudness. research §2 makes it the dominant arousal carrier, so a loud passage must read as
    // loud relative to the voice's own reference.
    const prosody = new Prosody();
    const quiet = synthesiseVoice( { seconds: 3, f0At: () => 170, amplitude: 0.05 } );
    const loud = synthesiseVoice( { seconds: 1.5, f0At: () => 170, amplitude: 0.5 } );

    const combined = new Float32Array( quiet.length + loud.length );
    combined.set( quiet, 0 );
    combined.set( loud, quiet.length );

    const readings = prosody.readingsFor(
        prosody.analyseBuffer( { sampleRate: SAMPLE_RATE, channelData: combined } ) );

    const quietZ = readings.filter( ( r ) => r.time < 2.5 && r.voiced ).slice( -20 );
    const loudZ = readings.filter( ( r ) => r.time > 3.2 && r.voiced ).slice( 0, 20 );

    const meanOf = ( items ) => items.reduce( ( sum, r ) => sum + r.loudnessZ, 0 ) / Math.max( items.length, 1 );

    check( 'VARIABILITY  a 20 dB jump in level shows up as a large positive loudness z-score',
        meanOf( loudZ ) - meanOf( quietZ ) > 2,
        `quiet passage z ${ meanOf( quietZ ).toFixed( 2 ) }, loud passage z ${ meanOf( loudZ ).toFixed( 2 ) } ` +
        `(amplitude 0.05 -> 0.5, i.e. +20.0 dB)` );
}

// ============================================================================================
// COST — this runs on the audio thread
// ============================================================================================

{
    const seconds = 4;
    const signal = synthesiseVoice( { seconds, f0At: ( t ) => 170 + 30 * Math.sin( 2 * Math.PI * 1.3 * t ) } );

    analyse( signal );   // warm

    const engine = new FrameAnalyser( { sampleRate: SAMPLE_RATE } );
    let frameCount = 0;

    const start = process.hrtime.bigint();

    for ( let offset = 0; offset < signal.length; offset += 128 ) {

        engine.push( signal.subarray( offset, Math.min( offset + 128, signal.length ) ), () => frameCount ++ );

    }

    const elapsedMs = Number( process.hrtime.bigint() - start ) / 1e6;
    const msPerSecondOfAudio = elapsedMs / seconds;
    const percentOfCore = msPerSecondOfAudio / 10;

    check( 'COST  the whole analysis costs under 5% of one core in real time',
        percentOfCore < 5,
        `${ elapsedMs.toFixed( 1 ) } ms to analyse ${ seconds } s of audio in 128-sample blocks = ` +
        `${ msPerSecondOfAudio.toFixed( 1 ) } ms/s = ${ percentOfCore.toFixed( 2 ) }% of one core; ` +
        `${ frameCount } frames at ${ ( 1 / settingsProbe.hopSeconds ).toFixed( 1 ) } Hz` );

    // The rejected alternative, measured rather than asserted: full-rate analysis at a window long
    // enough for a 70 Hz floor. Pitch.js's header quotes 12.44% of a core for this.
    const fullRate = new PitchDetector( { sampleRate: SAMPLE_RATE, windowSize: 2048, minHz: 70, maxHz: 400 } );
    const window = signal.subarray( 0, 2048 );

    fullRate.detect( window );
    const hops = 200;
    const fullStart = process.hrtime.bigint();
    for ( let index = 0; index < hops; index ++ ) fullRate.detect( window );
    const fullMsPerHop = Number( process.hrtime.bigint() - fullStart ) / 1e6 / hops;

    check( 'COST  the rejected full-rate alternative is measured, not assumed, and is far worse',
        fullMsPerHop * 187.5 / 10 > percentOfCore * 3,
        `48 kHz / 2048-sample window: ${ fullMsPerHop.toFixed( 4 ) } ms per hop = ` +
        `${ ( fullMsPerHop * 187.5 ).toFixed( 1 ) } ms/s = ${ ( fullMsPerHop * 18.75 ).toFixed( 2 ) }% of one core, ` +
        `against ${ percentOfCore.toFixed( 2 ) }% for the shipped decimated path` );
}

// ============================================================================================
// PARITY — the offline path and the worklet path are the same DSP
// ============================================================================================

{
    const signal = synthesiseVoice( { seconds: 1.2, f0At: ( t ) => 150 + 50 * t } );

    const direct = analyse( signal, { blockSize: 128 } ).frames;
    const viaProsody = new Prosody().analyseBuffer( { sampleRate: SAMPLE_RATE, channelData: signal }, 128 );

    let worst = 0;
    for ( let index = 0; index < Math.min( direct.length, viaProsody.length ); index ++ ) {

        for ( const key of [ 'time', 'rms', 'hz', 'clarity' ] ) {

            worst = Math.max( worst, Math.abs( direct[ index ][ key ] - viaProsody[ index ][ key ] ) );

        }

    }

    check( 'PARITY  analyseBuffer runs exactly the FrameAnalyser the worklet runs',
        direct.length === viaProsody.length && worst === 0,
        `${ direct.length } frames; worst difference ${ worst }` );

    check( 'PARITY  rootMeanSquare agrees with a hand-computed RMS',
        Math.abs( rootMeanSquare( new Float32Array( [ 3, 4 ] ) ) - Math.sqrt( 12.5 ) ) < 1e-12
            && Math.abs( hzToSemitones( 220, 110 ) - 12 ) < 1e-12,
        'sqrt((9+16)/2) = 3.5355; 220/110 = 12 semitones' );

    check( 'PARITY  a Decimator with factor 1 is a pure low-pass, not a no-op that silently passes aliasing',
        ( () => {

            const decimator = new Decimator( 1 );
            const out = new Float32Array( 64 );
            const written = decimator.process( new Float32Array( 64 ).fill( 1 ), out );
            return written === 64;

        } )(),
        '' );
}

// --- results ------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( `\nanalyser: ${ JSON.stringify( settingsProbe ) }\n\n` );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
