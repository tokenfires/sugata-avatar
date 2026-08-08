/**
 * Signals — the deterministic randomness and coherent noise every motion layer needs.
 *
 * This lives beside MotionStack rather than inside it because the layers above (Blink, Gaze,
 * Breath, Sway, Gesture) all reach for the same four things and none of them should own the
 * implementation:
 *
 *   - a seedable stream, so a critic run is reproducible frame for frame;
 *   - exponentially distributed intervals, because fixation durations are exponential
 *     (Ruhland et al. 2015, via research/affect-and-animation.md);
 *   - Poisson event timing, because blinks are a Poisson process at 10.5-32.5/min in
 *     conversation (Doughty's meta-study, same source);
 *   - 1D coherent noise, because idle micro-motion is Perlin's N0/N1/N2 at ~1 Hz shoulder,
 *     ~2 Hz elbow, ~4 Hz wrist (Perlin & Goldberg, Improv, SIGGRAPH '96, via
 *     research/body-motion-numbers.md).
 *
 * Nothing here touches three.js or the DOM, so it runs identically in the browser and in a
 * node selftest. That is the point: determinism is only useful if it is testable offline.
 */

const TWO_PI = Math.PI * 2;

/** See `PoissonSchedule.advance`. In unit-rate wait units, where a typical wait is order 1. */
const WAIT_EPSILON = 1e-12;

/**
 * A seeded pseudo-random stream.
 *
 * mulberry32 is used because it is ten lines, has no state beyond one 32-bit word, and passes
 * gjrand's smallcrush — far more than motion noise requires. It is NOT cryptographic and must
 * never be used for anything that needs to be unguessable.
 *
 * The important design point is `fork()`. Every layer gets its own stream derived from the root
 * seed and the layer's name, never a shared one. If layers shared a stream, adding a blink layer
 * would silently change every gaze target that came after it, and no critic run would be
 * comparable to the one before it.
 */
export class MotionRandom {

    /**
     * @param {number} [seed=1] - Any integer. The same seed always produces the same stream.
     */
    constructor( seed = 1 ) {

        this.seed = seed >>> 0;
        this.state = this.seed;

        // Box-Muller produces two normal deviates per pass; the second is kept for the next call.
        this.spareGaussian = null;

    }

    /**
     * A fresh independent stream, named. Derived from the root seed and the label rather than
     * from the current state, so it does not matter when — or whether — the parent was drawn
     * from before the fork happened.
     *
     * @param {string} label - Usually the layer name.
     * @returns {MotionRandom}
     */
    fork( label ) {

        return new MotionRandom( hashStringToSeed( label ) ^ this.seed );

    }

    /** Restores the stream to its first draw. Used by the stack when a run is reset. */
    reset() {

        this.state = this.seed;
        this.spareGaussian = null;

    }

    /** Uniform on [0, 1). */
    next() {

        this.state = ( this.state + 0x6d2b79f5 ) | 0;

        let t = Math.imul( this.state ^ ( this.state >>> 15 ), 1 | this.state );
        t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;

        return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

    }

    /** Uniform on [min, max). */
    range( min, max ) {

        return min + ( max - min ) * this.next();

    }

    /** Uniform integer on [min, maxExclusive). */
    integer( min, maxExclusive ) {

        return Math.floor( this.range( min, maxExclusive ) );

    }

    /** True with the given probability. */
    chance( probability ) {

        return this.next() < probability;

    }

    /** Uniformly picks one element. Returns undefined for an empty list. */
    pick( items ) {

        if ( items.length === 0 ) return undefined;

        return items[ this.integer( 0, items.length ) ];

    }

    /**
     * Normally distributed, via Box-Muller. Used for amplitudes and offsets that should cluster
     * around a mean rather than spread flat — saccade overshoot, breath depth variation.
     */
    gaussian( mean = 0, standardDeviation = 1 ) {

        if ( this.spareGaussian !== null ) {

            const spare = this.spareGaussian;
            this.spareGaussian = null;
            return mean + standardDeviation * spare;

        }

        // next() can return exactly 0 and log(0) is -Infinity, so the radius draw is taken from
        // the open interval by rejecting zero rather than by adding an epsilon fudge.
        let uniform = this.next();
        while ( uniform === 0 ) uniform = this.next();

        const radius = Math.sqrt( -2 * Math.log( uniform ) );
        const angle = TWO_PI * this.next();

        this.spareGaussian = radius * Math.sin( angle );

        return mean + standardDeviation * radius * Math.cos( angle );

    }

    /**
     * An exponentially distributed interval — the waiting time of a memoryless process.
     *
     * This is the distribution of gaze fixation durations and of the gap between blinks. The
     * bounds exist because physiology has floors the mathematics does not: the intersaccadic
     * interval never drops below ~150 ms however the die falls.
     *
     * 🚩 AN EXPONENTIAL IS ALMOST SURELY POSITIVE AND THIS ONE WAS NOT, AND THE COST IS A HANG.
     * `next()` returns `t / 2^32` and `t` can be exactly 0, so `1 - next()` can be exactly 1 and
     * the sample exactly 0. A zero drawn by `PoissonSchedule` at CONSTRUCTION or RESET leaves
     * `waiting` at 0 forever: `secondsUntilArrival` returns 0, a caller that cuts its frame at the
     * arrival takes a step of 0, and `advance` returns on its own `seconds <= 0` guard without
     * consuming anything. Reproduced on the caller shape `Blink.advanceTimeline` and
     * `Sway.advanceAxis` both use — 1,000,000 iterations for a single 1/30 s frame with
     * `remaining` still exactly 0.03333333333333333. (Mid-stream zeros self-heal, because
     * `advance`'s inner `while` redraws; construction and reset have no such loop.)
     *
     * The zero is rejected rather than nudged, exactly as `gaussian` above rejects its own, and on
     * the COMPLEMENT rather than on `next()` so that every non-degenerate draw maps to the value it
     * always did. Rejecting costs one extra draw with probability 2^-32; a redrawn stream would
     * have cost every gate in the repo its measured numbers. The smallest surviving sample is
     * `meanSeconds × 2.33e-10`, which is still three orders of magnitude above `WAIT_EPSILON`, so
     * the schedule makes progress rather than merely avoiding the exact zero.
     *
     * @param {number} meanSeconds - The distribution's mean, i.e. 1 / rate.
     * @param {Object} [bounds]
     * @param {number} [bounds.min=0] - Hard floor applied after sampling.
     * @param {number} [bounds.max=Infinity] - Hard ceiling applied after sampling.
     * @returns {number} Seconds. Strictly positive for a positive mean, whatever the draw.
     */
    exponential( meanSeconds, bounds = {} ) {

        // 1 - next() lands in (0, 1], which keeps log() finite at both ends of the draw. The
        // closed end is the degenerate one — log(1) is 0 — so it is redrawn.
        let complement = 1 - this.next();
        while ( complement === 1 ) complement = 1 - this.next();

        const sample = -meanSeconds * Math.log( complement );

        const min = bounds.min ?? 0;
        const max = bounds.max ?? Infinity;

        return Math.min( Math.max( sample, min ), max );

    }

    /**
     * The gap until the next event of a Poisson process. Sugar over `exponential(1 / rate)`,
     * named for how the callers think about it: "blinks arrive at 20 a minute".
     *
     * @param {number} eventsPerSecond
     * @param {Object} [bounds] - Same shape as `exponential`.
     */
    poissonInterval( eventsPerSecond, bounds = {} ) {

        if ( eventsPerSecond <= 0 ) return Infinity;

        return this.exponential( 1 / eventsPerSecond, bounds );

    }

    /**
     * Whether a Poisson event lands inside this frame.
     *
     * 🚩 THE RATE IS RIGHT AND THE TRAJECTORY IS NOT. Read this before reaching for it.
     *
     * The probability is exact for any dt — it is `1 - exp(-rate*dt)` rather than `rate * dt`, so
     * the long-run event RATE is correct at 30, 60 or 120 Hz. What is not correct is the realised
     * SEQUENCE. Every call consumes one draw from the stream, so a layer that calls this once per
     * frame advances its randomness at the frame rate, and the same seed produces a different run
     * at a different frame rate. Measured on `Sway` before it was converted: 120.1 draws/s at
     * 30 Hz, 240.1 at 60 Hz, 480.1 at 120 Hz — and the worst bone divergence between the 30 Hz and
     * 60 Hz traces of seed 1 over 300 s was **49.4 mm**. A body's sway does not depend on how often
     * you look at it.
     *
     * That defect is invisible to any gate stated on an amplitude or a rate, because both of those
     * really are dt-invariant. It is visible only in a gate that compares two frame rates frame for
     * frame, which is what `sway.selftest.mjs`'s FRAME-RATE INVARIANCE section does.
     *
     * 🎯 USE `PoissonSchedule` INSTEAD for anything a viewer will see. This is kept for a caller
     * that genuinely only wants a per-frame coin — and there is no such caller in the motion stack.
     *
     * 🎯 EVERY LAYER IN THE STACK IS CONVERTED: `Sway`, `BodyIdle`, `Gaze`, `FacialIdle`,
     * `HandIdle` — and `Blink`, which coupled through a countdown rather than through this call
     * (§1.13a). The only remaining callers are the `frameCoupledArrivals` rebuilds each layer keeps
     * behind an option so its invariance gate has a defect to reject. If a new caller appears
     * outside such a branch, it is a regression.
     *
     * ⚠️ AND CONVERTING THE ARRIVALS IS NOT THE WHOLE JOB. `Gaze` swapped this call for a schedule
     * and was still 905× outside its own invariance tolerance, because arrivals are only one of the
     * ways a frame can become the clock. The other three it had, all of which had to go as well:
     * countdowns advanced per frame with the overshoot DISCARDED (which rounds every drawn interval
     * up to a multiple of dt); a smoother using a rational approximation of `exp(−x)` instead of
     * `exp(−x)`, which breaks the two-half-steps-are-one-whole-step identity; and a feedback target
     * that was a continuous function of a fast signal, so it was only ever sampled wherever the
     * frame rate happened to put a boundary. Check for all four.
     */
    poissonEventOccurs( eventsPerSecond, deltaSeconds ) {

        if ( eventsPerSecond <= 0 || deltaSeconds <= 0 ) return false;

        return this.next() < 1 - Math.exp( -eventsPerSecond * deltaSeconds );

    }

    /**
     * How many Poisson events land in one interval. Knuth's method — fine for the small means
     * motion code uses (it costs one draw per event, so it is not for large lambda).
     */
    poissonCount( mean ) {

        if ( mean <= 0 ) return 0;

        const threshold = Math.exp( -mean );
        let product = this.next();
        let count = 0;

        while ( product > threshold ) {

            count ++;
            product *= this.next();

        }

        return count;

    }

}

/**
 * A Poisson arrival schedule that advances in SIMULATED TIME rather than in frames.
 *
 * 🎯 THIS IS THE dt-INVARIANT WAY TO FIRE A RARE EVENT, and the reason it exists is worth reading
 * once. A layer that asks `poissonEventOccurs(rate, dt)` every frame draws one random number per
 * FRAME. The rate that comes out is right; the trajectory is not, because the stream is being
 * advanced by the renderer instead of by the body. Halve the frame rate and every subsequent event
 * lands somewhere else. The judge's capture runs at 30 fps and the gates ran at 60 Hz, so the gates
 * were proving properties of a trajectory the camera never rendered — see LEARNINGS §1.3 and the
 * FRAME-RATE INVARIANCE section of `sway.selftest.mjs`.
 *
 * The fix is to draw ONE interval PER EVENT and count time down against it. Then the arrival times
 * are a property of the seed alone: the only thing the frame rate decides is which frame observes
 * an arrival that was always going to happen at the same instant.
 *
 * The countdown is held in UNIT-RATE units — the wait of a rate-1 process — and consumed at
 * `rate × seconds`. That is the standard time-rescaling of a Poisson process, and it is what makes
 * a rate that CHANGES mid-run correct rather than merely plausible: `BodyIdle`'s shoulder settle is
 * scaled by arousal, and rescaling integrates the rate over the interval instead of freezing it at
 * whatever value the last frame happened to see.
 *
 * @example
 * // Cut the frame at the arrival so the event's own shape starts at the exact instant it arrived.
 * const step = Math.min( remaining, schedule.secondsUntilArrival( rate ) );
 * integrate( step );
 * schedule.advance( rate, step, () => beginEvent() );
 */
export class PoissonSchedule {

    /**
     * @param {MotionRandom} random - Give each process its OWN forked stream. Two processes
     *   sharing one stream re-couple to the frame rate through the order their draws interleave:
     *   whichever fires first in a given frame draws first, and which frame that is depends on dt.
     */
    constructor( random ) {

        this.random = random;
        this.waiting = random.exponential( 1 );

    }

    /** Redraws the first arrival. Call from the layer's `reset()`, after the stream is rewound. */
    reset() {

        this.waiting = this.random.exponential( 1 );

    }

    /**
     * How long until the next arrival at this rate. `Infinity` when the rate is zero, which is
     * what makes it safe to pass straight into a `Math.min` that is choosing a step length.
     */
    secondsUntilArrival( eventsPerSecond ) {

        if ( eventsPerSecond <= 0 ) return Infinity;

        return this.waiting / eventsPerSecond;

    }

    /**
     * Consumes `seconds` of waiting time and reports every arrival inside it, oldest first.
     *
     * @param {number} eventsPerSecond - May vary between calls; see the class note on rescaling.
     * @param {number} seconds
     * @param {Function} [onArrival] - Called as `onArrival(secondsSinceArrival)`. The argument is
     *   how long ago inside this interval the event actually landed, so a caller that did not cut
     *   its step at the arrival can still start the event's shape at the right phase. A caller
     *   that did cut its step will see 0.
     * @returns {number} How many arrived.
     */
    advance( eventsPerSecond, seconds, onArrival = null ) {

        if ( eventsPerSecond <= 0 || seconds <= 0 ) return 0;

        this.waiting -= eventsPerSecond * seconds;

        let arrivals = 0;

        // The epsilon is not defensive padding, it is what makes `secondsUntilArrival` usable as a
        // step length: a caller that cuts its frame exactly at the arrival computes
        // `waiting / rate` and this then computes `rate * that`, and the round trip lands a few
        // ulps either side of zero. Without it the caller spins on sub-femtosecond steps. The
        // waits themselves are unit-rate exponentials, order 1, so 1e-12 cannot swallow a real one.
        while ( this.waiting <= WAIT_EPSILON ) {

            arrivals ++;

            if ( onArrival !== null ) onArrival( Math.max( -this.waiting, 0 ) / eventsPerSecond );

            this.waiting += this.random.exponential( 1 );

        }

        return arrivals;

    }

}

/**
 * 1D coherent (gradient) noise — smooth, band-limited, and repeatable.
 *
 * Value noise was rejected in favour of gradient noise because value noise's extrema always sit
 * on integer lattice points, which reads as a visible pulse at exactly the driving frequency —
 * the one artifact idle motion cannot have.
 *
 * MEASURED OUTPUT RANGE: `at()` returns roughly [-0.94, +0.94] over a long sweep (see the
 * selftest, which asserts the bound). It is treated as [-1, 1] by callers and never normalised,
 * because rescaling to exactly fill the range would flatten the distribution's natural centre
 * bias, and that centre bias is what makes idle motion sit still most of the time.
 *
 * Improv's N0/N1/N2 map onto this as `unitAt(t)`, `unitAt(t * 2)`, `unitAt(t * 4)` — one octave
 * apart, on [0, 1], driving shoulder, elbow and wrist respectively.
 */
export class CoherentNoise1D {

    /**
     * @param {number} [seed=1]
     * @param {number} [tableSize=256] - Lattice period. Motion repeats after this many units of
     *   noise time, which at 1 Hz is over four minutes — long past anyone noticing.
     */
    constructor( seed = 1, tableSize = 256 ) {

        this.tableSize = tableSize;
        this.mask = tableSize - 1;
        this.gradients = new Float32Array( tableSize );

        const random = new MotionRandom( seed );

        for ( let index = 0; index < tableSize; index ++ ) {

            this.gradients[ index ] = random.range( -1, 1 );

        }

    }

    /**
     * Noise at position `x`, approximately on [-1, 1]. `x` is in cycles: pass
     * `elapsedSeconds * frequencyHz` to get noise at that frequency.
     */
    at( x ) {

        const cell = Math.floor( x );
        const fraction = x - cell;

        const gradientLow = this.gradients[ cell & this.mask ];
        const gradientHigh = this.gradients[ ( cell + 1 ) & this.mask ];

        // Each lattice point contributes its gradient times the distance from it. The high side
        // uses a negative distance, which is what makes the curve pass smoothly through zero at
        // every lattice point instead of bouncing off it.
        const contributionLow = gradientLow * fraction;
        const contributionHigh = gradientHigh * ( fraction - 1 );

        const blend = smootherStep( fraction );

        // The x2 restores a usable amplitude: the raw interpolation of two half-cell ramps peaks
        // near 0.5 even when both gradients are at full scale.
        return 2 * ( contributionLow + ( contributionHigh - contributionLow ) * blend );

    }

    /** The same signal remapped to [0, 1], which is the form Improv's N0/N1/N2 are stated in. */
    unitAt( x ) {

        return Math.min( Math.max( ( this.at( x ) + 1 ) * 0.5, 0 ), 1 );

    }

    /**
     * Summed octaves, for signals that want detail on top of a slow drift — postural sway, where
     * the dominant mode is 0.25-0.33 Hz but 95% of the power sits below 1.3 Hz.
     *
     * @param {number} x
     * @param {number} [octaves=3]
     * @param {number} [persistence=0.5] - Amplitude ratio between successive octaves.
     * @param {number} [lacunarity=2] - Frequency ratio between successive octaves.
     */
    fractal( x, octaves = 3, persistence = 0.5, lacunarity = 2 ) {

        let total = 0;
        let amplitude = 1;
        let frequency = 1;
        let normalisation = 0;

        for ( let octave = 0; octave < octaves; octave ++ ) {

            // Each octave is offset along the lattice so the octaves do not share zero crossings,
            // which would otherwise stack into a periodic pulse at the base frequency.
            total += amplitude * this.at( x * frequency + octave * 17.3 );
            normalisation += amplitude;

            amplitude *= persistence;
            frequency *= lacunarity;

        }

        return total / normalisation;

    }

}

// --- helpers ---------------------------------------------------------------------------------

/**
 * Ken Perlin's improved fade curve, 6t^5 - 15t^4 + 10t^3. Chosen over the cheaper smoothstep
 * because its second derivative is zero at both ends, so noise-driven joint angles have
 * continuous acceleration across lattice boundaries — a smoothstep leaves a visible tick.
 */
function smootherStep( t ) {

    return t * t * t * ( t * ( t * 6 - 15 ) + 10 );

}

/**
 * FNV-1a. Turns a layer name into a stable 32-bit seed so `fork('blink')` means the same stream
 * in every process, on every machine, forever.
 */
function hashStringToSeed( text ) {

    let hash = 0x811c9dc5;

    for ( let index = 0; index < text.length; index ++ ) {

        hash ^= text.charCodeAt( index );
        hash = Math.imul( hash, 0x01000193 );

    }

    return hash >>> 0;

}
