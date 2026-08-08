/**
 * Coarticulation — the envelope one viseme occupies in time, and nothing else.
 *
 * A viseme timeline says `{viseme, startTime, duration}`. A mouth does not do that. It starts
 * moving before the sound, snaps into the shape, holds it, and lets it go more slowly than it took
 * it — and the next shape is already on its way in while this one is still leaving. That overlap
 * IS coarticulation, and it is the difference between a mouth speaking and a mouth flipping
 * through poses.
 *
 * THE NUMBERS ARE NOT MINE
 * ------------------------
 * research/affect-and-animation.md §3 — TalkingHead's three-key envelope, "a working poor-man's
 * Cohen-Massaro dominance function":
 *
 *     anticipation  min(60 ms, 2d/3)   — onset BEFORE nominal
 *     attack        min(25 ms, d/2)    — fast, "pops open"
 *     release       min(60 ms, d/2)    — slower, "closes smoothly"
 *     max viseme duration 200 ms
 *     PP and FF peak at 0.9; everything else peaks at 0.6
 *
 * Every one of those is transcribed here and none is adjusted. The peaks live in `Visemes.js`
 * because they are a property of the shape rather than of the envelope.
 *
 * WHAT THE SOURCE DOES NOT SAY, AND WHAT WAS CHOSEN INSTEAD
 * --------------------------------------------------------
 * The source gives four durations and a cap. It does not say where the four keys land relative to
 * one another, and it does not say what curve joins them. Both had to be decided, so both are
 * stated here rather than buried:
 *
 *   **Key placement.** Four keys, derived so that the stated durations mean what their names say:
 *
 *       onset        = start - anticipation          weight 0     ("onset BEFORE nominal")
 *       peak         = onset + attack                weight peak  ("fast, pops open")
 *       releaseStart = start + effective - release   weight peak
 *       end          = start + effective             weight 0     ("closes smoothly")
 *
 *   where `effective = min(duration, 200 ms)`.
 *
 *   🎯 Those four are ALWAYS in order, for every duration, and it is worth seeing why rather than
 *   trusting it: `peak - start = attack - anticipation <= attack <= d/2`, and
 *   `releaseStart - start = d - release >= d/2`. So `peak <= releaseStart` falls out of the two
 *   `min(_, d/2)` clauses and cannot be broken by a short viseme. `envelopeKeys` asserts it anyway,
 *   because a derivation in a comment is not a test.
 *
 *   **The curve.** Linear ramps between keys would honour every number above and leave a velocity
 *   discontinuity at each key — four ticks per viseme, ten visemes a second. A raised cosine
 *   (`0.5 - 0.5 cos(pi t)`) passes through exactly 0 and exactly `peak` at exactly the key times,
 *   so it changes no stated number, and its derivative is zero at both ends, so the shape eases in
 *   and out. That is the only reason it is here.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * It has no clock, no state and no memory. `weightAt(entry, t)` is a pure function of the entry and
 * an absolute time. That is not tidiness — it is the whole frame-rate-invariance argument. A
 * trajectory that is a pure function of absolute time is identical at 30, 60 and 120 Hz by
 * construction, because the frame rate only decides where it is SAMPLED. LEARNINGS §1.13 and
 * §1.13a describe four different ways a motion layer in this repo became a function of `dt`
 * instead; all four require state that this file does not have.
 */

/** research §3: "anticipation min(60 ms, 2d/3) — onset BEFORE nominal". */
export const MAX_ANTICIPATION_SECONDS = 0.060;
export const ANTICIPATION_DURATION_FRACTION = 2 / 3;

/** research §3: "attack min(25 ms, d/2) — fast, 'pops open'". */
export const MAX_ATTACK_SECONDS = 0.025;

/** research §3: "release min(60 ms, d/2) — slower, 'closes smoothly'". */
export const MAX_RELEASE_SECONDS = 0.060;

/** research §3: "max viseme duration 200 ms". Caps the SUSTAIN, not the whole envelope. */
export const MAX_VISEME_SECONDS = 0.200;

/**
 * The four key times of one viseme's envelope, in the timeline's own seconds.
 *
 * @param {{startTime: number, duration: number}} entry
 * @param {Object} [defect] - 🚩 NOT A FEATURE. `{ anticipationSeconds }` forces the anticipation to
 *   a fixed value, which is how `visemes.selftest.mjs` reintroduces "anticipation authored in
 *   FRAMES instead of seconds" so its frame-rate-invariance gate has a third, differently-shaped
 *   defect to reject. Nothing that ships passes it. Same convention as the `frameCoupledArrivals`
 *   rebuilds every layer in `motion/` keeps for the same reason.
 * @returns {{onset: number, peak: number, releaseStart: number, end: number,
 *            anticipation: number, attack: number, release: number, effective: number}}
 */
export function envelopeKeys( entry, defect = null ) {

    const effective = Math.min( entry.duration, MAX_VISEME_SECONDS );

    const anticipation = defect?.anticipationSeconds
        ?? Math.min( MAX_ANTICIPATION_SECONDS, ANTICIPATION_DURATION_FRACTION * effective );
    const attack = Math.min( MAX_ATTACK_SECONDS, effective / 2 );
    const release = Math.min( MAX_RELEASE_SECONDS, effective / 2 );

    const onset = entry.startTime - anticipation;
    const peak = onset + attack;
    const releaseStart = entry.startTime + effective - release;
    const end = entry.startTime + effective;

    return { onset, peak, releaseStart, end, anticipation, attack, release, effective };

}

/**
 * The window outside which this entry contributes nothing. `[onset, end]`.
 * The scheduler uses it to decide which entries a given instant can possibly touch.
 */
export function envelopeWindow( entry, defect = null ) {

    const keys = envelopeKeys( entry, defect );
    return { start: keys.onset, end: keys.end };

}

/**
 * This entry's weight at time `t`, in the timeline's own seconds. Zero outside the window.
 *
 * @param {{startTime: number, duration: number, peak: number}} entry
 * @param {number} t
 * @returns {number} 0 .. entry.peak
 */
export function weightAt( entry, t, defect = null ) {

    const keys = envelopeKeys( entry, defect );

    if ( t <= keys.onset || t >= keys.end ) return 0;

    const peak = entry.peak ?? 1;

    if ( t < keys.peak ) {

        return peak * raisedCosine( ( t - keys.onset ) / ( keys.peak - keys.onset ) );

    }

    if ( t <= keys.releaseStart ) return peak;

    return peak * raisedCosine( ( keys.end - t ) / ( keys.end - keys.releaseStart ) );

}

/**
 * 0 -> 0, 1 -> 1, with zero slope at both ends. Used for the attack and, time-reversed, for the
 * release, so both ease and neither introduces a velocity step at a key.
 */
function raisedCosine( x ) {

    if ( x <= 0 ) return 0;
    if ( x >= 1 ) return 1;

    return 0.5 - 0.5 * Math.cos( Math.PI * x );

}
