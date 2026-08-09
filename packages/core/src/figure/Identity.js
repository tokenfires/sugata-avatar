/**
 * Identity — the AI's body configuration, and the rule for turning it into files to load.
 *
 * The gender axis runs 0.0 feminine → 0.5 androgynous → 1.0 masculine, and **0.5 is the
 * default because the androgynous midpoint is the neutral base of this project, not a
 * fallback for when nobody chose.** Every expression in the figure pipeline was authored at
 * 0.5; the two ends are excursions from it. An AI that never touches this dial has a real
 * body, not a placeholder.
 *
 * Identity decides *what to load*, and nothing else. It never touches a mesh, a bone or the
 * renderer. Figure.js consumes `resolve()` and does the loading and any blending.
 *
 *
 * WHY THERE ARE FIVE BAKED FILES INSTEAD OF ONE MORPH SLIDER
 *
 * The gender axis is linear in the source model: max |V(0.5) − ½(V(0)+V(1))| is 2.2e-13 mm,
 * i.e. exactly linear to floating-point precision (docs/research/base-mesh-verification.md,
 * finding 3). A blend between two figures is therefore an exact reconstruction of the shape
 * in between, not an approximation — which would argue for shipping one mesh and one morph.
 *
 * It does not work, because **glTF cannot morph a skeleton.** Measured on the shipped bakes
 * (2026-08-07): across the full sweep g000 → g100 the joints move a mean of 113.6 mm and a
 * max of 137.1 mm in world space; a single quarter-step such as g050 → g075 already moves
 * them ~34 mm. Morph the mesh of one baked figure toward the other end of the axis and the
 * bones stay where they were, so the skin slides off the skeleton by centimetres. Discrete
 * bakes exist so that the skeleton travels with the mesh.
 *
 * The five bakes sit at gender 0.00 / 0.25 / 0.50 / 0.75 / 1.00, so every point on the axis
 * is within 0.125 of a bake. That is why this file does not implement the "clamp the runtime
 * axis to a narrow band" mitigation the research doc lists third — bracketed bakes make it
 * unnecessary.
 *
 *
 * THE TWO MODES, AND THE HONEST ERROR BAND FOR EACH
 *
 * NEAREST (the default, and what ships). Snap to the closest of the five bakes. Zero
 *   approximation of any kind: it is the file the pipeline produced, mesh and skeleton
 *   agreeing exactly. The cost is that the dial has five stops, so a slider drag jumps.
 *
 * LIVE_PREVIEW. Load the two bakes that bracket the requested gender and cross-fade between
 *   them — both the vertices and the bone rest transforms, which is why both figures must be
 *   resident. Gives a continuous dial for an AI exploring what body it wants.
 *
 *   Measured error, 2026-08-07, chord vs a degree-4 interpolant through all five bakes
 *   (that proxy was validated against a real bake: it predicted the g000/g050 → g025 error
 *   as 0.469 mm, and the direct comparison against the g025 file is also 0.469 mm):
 *
 *     interval        whole body max      head region max
 *     [g000, g025]        0.221 mm            0.098 mm
 *     [g025, g050]        0.041 mm            0.028 mm
 *     [g050, g075]        0.089 mm            0.088 mm
 *     [g075, g100]        0.342 mm            0.273 mm
 *
 *   Worst case anywhere on the axis is 0.342 mm of body and 0.273 mm of face — roughly a
 *   third of a millimetre, well under the ~1 mm at which a silhouette change becomes visible
 *   at portrait framing. Bone rest positions blend to the same order: worst quarter-span
 *   joint chord error is 0.328 mm. **Live preview is visually safe on this asset set.**
 *
 *   For scale, the two errors it is NOT: morphing a fixed skeleton costs ~34 mm per quarter
 *   step, and lerping the two extremes g000/g100 to reach the midpoint costs 1.229 mm.
 *
 *   One quirk worth knowing before it is mistaken for a bug: the g025/g075 → g050 blend is
 *   off by 0.111 mm, and that error is *entirely* a rigid +0.111 mm vertical offset. The
 *   shape residual after cancelling it is 0.0004 mm across all six meshes the figure had when
 *   this was measured — the eye proxy has since become two shells, so the count is seven and the
 *   residual on the corneal shell has NOT been re-measured — and 0.0001 mm on
 *   the body — float32 round-off at metre scale, i.e. the blend is exact and there is nothing
 *   left to measure. The bakes are re-grounded to Y = 0 after export and that grounding is
 *   not quite linear in gender. A consumer that re-grounds a blended figure removes the term.
 */

const BAKED_FIGURES = [
    { gender: 0.00, url: new URL( '../../../../assets/figures/figure_g000.glb', import.meta.url ).href },
    { gender: 0.25, url: new URL( '../../../../assets/figures/figure_g025.glb', import.meta.url ).href },
    { gender: 0.50, url: new URL( '../../../../assets/figures/figure_g050.glb', import.meta.url ).href },
    { gender: 0.75, url: new URL( '../../../../assets/figures/figure_g075.glb', import.meta.url ).href },
    { gender: 1.00, url: new URL( '../../../../assets/figures/figure_g100.glb', import.meta.url ).href }
];

/** Snap to one baked figure. Exact, five stops. */
export const NEAREST = 'nearest';

/** Cross-fade the two bracketing bakes. Continuous, costs ≤ 0.342 mm. */
export const LIVE_PREVIEW = 'live-preview';

const ANDROGYNOUS = 0.5;

// age, build and height are declared here so the shape of a full identity is visible in one
// place and callers can round-trip a config through this class today. Nothing is baked along
// those axes yet, so setting them changes nothing about what loads. See NOT_YET_BAKED.
const DEFAULTS = {
    gender: ANDROGYNOUS,
    age: 0.5,
    build: 0.5,
    height: 0.5,
    mode: NEAREST
};

/**
 * Axes that exist in the API but have no baked geometry behind them. They are accepted,
 * stored and reported back — and they are no-ops. Saying so beats a silent nothing.
 *
 * ⚠️ **THE SENTENCE THAT USED TO FOLLOW THIS IS SUPERSEDED, AND IT IS LEFT HERE RETRACTED RATHER
 * THAN DELETED.** It read: *"Adding one means extending the figure pipeline to sweep it and
 * re-baking the matrix, which multiplies the file count: a 5x3 gender-by-age matrix is fifteen
 * 11 MB GLBs."* That describes a solution this project no longer needs. Punch-list 10.1 measured
 * that an MPFB target is a pure additive per-vertex offset with no solver, and that applying the
 * targets in JS reproduces a headless MPFB build to **1.2e-4 mm on all 19,158 vertices** — see
 * `IdentityTargets.js` and its selftest. **There is no matrix to bake.**
 *
 * These three axes are still no-ops HERE, and the reason has narrowed to one thing: this class
 * decides *what file to load*, and the CPU path decides *what to do with it afterwards*. Wiring
 * them together is punch-list **10.8**, which also needs 10.7's skeleton refit — measured, a body
 * identity moves 97 of 106 bone ends by up to 18.727 mm, and glTF still cannot morph a skeleton.
 * A FACE identity needs neither: 0 of 106 bone ends move, by exactly 0.000 mm.
 */
export const NOT_YET_BAKED = [ 'age', 'build', 'height' ];

export class Identity {

    /**
     * @param {Object} [options]
     * @param {number} [options.gender=0.5] - 0.0 feminine, 0.5 androgynous, 1.0 masculine.
     * @param {number} [options.age=0.5] - Accepted, stored, no-op. See NOT_YET_BAKED.
     * @param {number} [options.build=0.5] - Accepted, stored, no-op. See NOT_YET_BAKED.
     * @param {number} [options.height=0.5] - Accepted, stored, no-op. See NOT_YET_BAKED.
     * @param {string} [options.mode='nearest'] - NEAREST or LIVE_PREVIEW.
     */
    constructor( options = {} ) {

        this.gender = DEFAULTS.gender;
        this.age = DEFAULTS.age;
        this.build = DEFAULTS.build;
        this.height = DEFAULTS.height;
        this.mode = DEFAULTS.mode;

        this.set( options );

    }

    /**
     * Merges a partial configuration in. Absent keys keep their current value, so a UI slider
     * can call `identity.set( { gender: 0.7 } )` without restating the rest of the body.
     *
     * @param {Object} partial
     * @returns {Identity} this, so calls chain.
     */
    set( partial = {} ) {

        if ( partial.gender !== undefined ) this.gender = clampToUnitRange( partial.gender );
        if ( partial.age !== undefined ) this.age = clampToUnitRange( partial.age );
        if ( partial.build !== undefined ) this.build = clampToUnitRange( partial.build );
        if ( partial.height !== undefined ) this.height = clampToUnitRange( partial.height );

        if ( partial.mode !== undefined ) {

            if ( partial.mode !== NEAREST && partial.mode !== LIVE_PREVIEW ) {
                throw new Error( `Identity mode must be '${ NEAREST }' or '${ LIVE_PREVIEW }', got '${ partial.mode }'.` );
            }

            this.mode = partial.mode;

        }

        return this;

    }

    /** True when the continuous dial is active and two figures will be loaded. */
    get isLivePreview() {

        return this.mode === LIVE_PREVIEW;

    }

    /**
     * Works out which GLB(s) this body needs and at what blend weight.
     *
     * Async because the set of available bakes is about to stop being a compile-time constant:
     * once the pipeline sweeps more than one axis, this reads a manifest. Today it resolves
     * immediately — the await costs a microtask and buys callers a stable signature.
     *
     * The returned plan is data, not a loaded figure. Figure.js turns it into meshes.
     *
     * @returns {Promise<{
     *   mode: string,
     *   gender: number,
     *   figures: Array<{url: string, gender: number, weight: number}>,
     *   blendWeight: number,
     *   estimatedErrorMm: number,
     *   ignoredAxes: string[]
     * }>}
     *   `figures` is ordered by gender and its weights sum to 1. In NEAREST mode it holds one
     *   entry at weight 1. In LIVE_PREVIEW it holds the two bracketing bakes, and
     *   `blendWeight` is the weight of the *second* — blend with `lerp(first, second,
     *   blendWeight)` for vertices and for bone rest transforms alike.
     *
     *   `estimatedErrorMm` is the worst-case vertex deviation this plan carries against a
     *   figure the pipeline would have baked at exactly this gender. Zero in NEAREST mode
     *   because the file *is* that figure.
     */
    async resolve() {

        const ignoredAxes = this.listIgnoredAxes();

        if ( this.mode === NEAREST ) {

            const bake = nearestBake( this.gender );

            return {
                mode: NEAREST,
                gender: bake.gender,
                figures: [ { url: bake.url, gender: bake.gender, weight: 1 } ],
                blendWeight: 0,
                estimatedErrorMm: 0,
                ignoredAxes
            };

        }

        const { lower, upper, weight } = bracketingBakes( this.gender );

        // Landing exactly on a bake is not a special case worth branching on elsewhere, but it
        // is worth not fetching a second 11 MB file that would contribute nothing. Both ends
        // of the interval count: gender 0.25 sits on the upper end of [0.00, 0.25].
        if ( weight === 0 || weight === 1 ) {

            const bake = weight === 0 ? lower : upper;

            return {
                mode: LIVE_PREVIEW,
                gender: bake.gender,
                figures: [ { url: bake.url, gender: bake.gender, weight: 1 } ],
                blendWeight: 0,
                estimatedErrorMm: 0,
                ignoredAxes
            };

        }

        return {
            mode: LIVE_PREVIEW,
            gender: this.gender,
            figures: [
                { url: lower.url, gender: lower.gender, weight: 1 - weight },
                { url: upper.url, gender: upper.gender, weight }
            ],
            blendWeight: weight,
            estimatedErrorMm: intervalErrorMm( lower.gender ),
            ignoredAxes
        };

    }

    /** The axes the caller moved that this build cannot honour. Empty when nothing was moved. */
    listIgnoredAxes() {

        return NOT_YET_BAKED.filter( ( axis ) => this[ axis ] !== DEFAULTS[ axis ] );

    }

    /** A plain object suitable for persisting and handing back to the constructor. */
    toJSON() {

        return {
            gender: this.gender,
            age: this.age,
            build: this.build,
            height: this.height,
            mode: this.mode
        };

    }

}

/** The one bake closest to `gender`. Ties go to the lower gender, which never happens on a
 *  five-point grid with 0.125 spacing but keeps the function total. */
function nearestBake( gender ) {

    let closest = BAKED_FIGURES[ 0 ];

    for ( const bake of BAKED_FIGURES ) {
        if ( Math.abs( bake.gender - gender ) < Math.abs( closest.gender - gender ) ) {
            closest = bake;
        }
    }

    return closest;

}

/**
 * The two bakes either side of `gender`, plus the fraction of the way from the lower to the
 * upper. Exactly on a bake returns that bake as `lower` with weight 0.
 */
function bracketingBakes( gender ) {

    for ( let i = 0; i < BAKED_FIGURES.length - 1; i ++ ) {

        const lower = BAKED_FIGURES[ i ];
        const upper = BAKED_FIGURES[ i + 1 ];

        if ( gender >= lower.gender && gender <= upper.gender ) {
            const span = upper.gender - lower.gender;
            return { lower, upper, weight: ( gender - lower.gender ) / span };
        }

    }

    // Unreachable while gender is clamped to [0, 1] and the table spans it, but a caller who
    // edits BAKED_FIGURES should get an answer rather than undefined.
    const last = BAKED_FIGURES[ BAKED_FIGURES.length - 1 ];
    return { lower: last, upper: last, weight: 0 };

}

/**
 * Worst-case blend error for the interval starting at `lowerGender`, in millimetres.
 *
 * Measured 2026-08-07 against a degree-4 interpolant through all five bakes; see the header
 * for the method and the validation. These are constants, not a model — re-measure them if
 * the figures are re-baked.
 */
function intervalErrorMm( lowerGender ) {

    const WORST_CASE_BY_INTERVAL = new Map( [
        [ 0.00, 0.221 ],
        [ 0.25, 0.041 ],
        [ 0.50, 0.089 ],
        [ 0.75, 0.342 ]
    ] );

    return WORST_CASE_BY_INTERVAL.get( lowerGender ) ?? 0.342;

}

function clampToUnitRange( value ) {

    if ( typeof value !== 'number' || Number.isNaN( value ) ) {
        throw new Error( `Identity axes take a number in [0, 1], got ${ value }.` );
    }

    return Math.min( 1, Math.max( 0, value ) );

}
