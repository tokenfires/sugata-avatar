/**
 * IdentityCatalogue — what the identity parameters ARE, and which targets a setting selects.
 *
 * The geometry lives next door in `IdentityTargets.js`. This file is the taxonomy and the
 * resolution rule: 203 slider categories across 21 regions, plus the eight macro parameters and
 * the three ethnicity weights, plus the arithmetic that turns a set of values into the stack of
 * targets `IdentityTargets.apply()` consumes.
 *
 *
 * 🚩 THE TAXONOMY IS READ, NOT INVENTED
 *
 * MPFB ships `targets/target.json`, which is its own grouping of the 530 detail target files into
 * slider categories, with `has_left_and_right`, a label, and an `opposites` block naming the
 * negative and positive file for each side. **A category is literally a slider running −1 → +1 and
 * the library has already done the work of saying which file is which end**
 * (`research/identity-sculpting.md` §2.2, which says in as many words: do not re-derive this
 * grouping, read `target.json`).
 *
 * `tools/identity-pipeline/build_identity_assets.mjs` transcribes it into
 * `assets/identity/catalogue.json`; this class reads that. Measured against the installed
 * library, the transcription lands on §2.2's table to the unit: 203 categories, 66 sided, 269 if
 * left and right are split, 530 raw files, and the per-region counts down to `buttocks 1`.
 *
 * ⚠️ **One correction to §2.2, found by transcribing it.** The table calls all 203 "bidirectional
 * slider categories". Eight are not: the seven `head-<shape>` categories and `chin-triangle` have
 * no `opposites` block at all, name one file each, and run 0 → +1. The file arithmetic still
 * closes on 530 (66 sided × 4 + 129 unsided-bidirectional × 2 + 8 unipolar × 1), so every count
 * §2.2 gates on is right and only the adjective was loose. Each slider carries `range` for it, and
 * `resolve()` refuses a negative weight on a unipolar slider rather than applying a shape backwards.
 *
 *
 * WHAT IS DELIBERATELY OFF THE DIAL
 *
 * `asym` (62 files) and `expression/units` (102 files) need no exclusion rule, and that is worth
 * saying out loud because it is easy to mistake for an oversight: **they are not in `target.json`
 * at all**, so MPFB's own taxonomy already excludes them and the census in the catalogue proves
 * every one of the 1,258 installed files was seen and classified. `genitals` (3 categories) IS in
 * `target.json` and is excluded here, because Phase 9.8's decency invariant makes it unreachable
 * and a slider nothing can show is a lie. Author-declared left/right asymmetry is 10.12's item and
 * is reached through the 66 sided categories — `resolve()` takes `{ left, right }` per slider —
 * never through the `asym` files.
 *
 *
 * 🚩 THE MACRO LAYER SHIPS ITS SOLVER AND NOT ITS CORPUS, AND THE REASON IS A MEASUREMENT
 *
 * `macroTargetStack()` reproduces MPFB's `TargetService.calculate_target_stack_from_macro_info_dict`
 * exactly: eight piecewise-linear parameters from `macro.json`, five combination families, a 0.01
 * cutoff, and the two hand-written exclusions MPFB carries for combinations that have no file.
 * Measured against MPFB's own emitted stack, recorded off the running addon: the same files in the
 * same order, and a worst weight error of **0.000e+0** — 8 targets at the shipped defaults, 77 at
 * an off-midpoint setting. Exact, not close: the float32 property reads and Python's half-to-even
 * rounding are both reproduced below, and leaving either out moves a weight.
 *
 * **The corpus behind it does not ship, and the number is why: the 564 macro and breast-macro
 * files hold 5,323,086 moved-vertex records, which is 85.2 MB packed** — against 10.81 MB for all
 * 530 detail targets. That is punch-list 10.8's problem to solve (continuous gender is the item
 * that needs it), and it needs the solver to exist first. So the solver is here, gated, and
 * `macroTargetStack()` returns plain data that no `IdentityTargets` call can consume yet. Saying
 * so beats a silent nothing — the same choice `Identity.js` made with `NOT_YET_BAKED`.
 */

/**
 * `macro.json`'s own piecewise-linear segments, transcribed. Each part contributes a low and a
 * high component when the value falls strictly inside it; an empty name means that end of the
 * segment is the neutral figure and contributes no file.
 *
 * ⚠️ The odd-looking bounds are MPFB's, not a transcription slip: 0.1874998 against 0.1874999, and
 * segments that do not meet (height's parts stop at 0.49 and resume at 0.51). At exactly 0.5 the
 * proportions and height parameters therefore contribute NOTHING, which is why the shipped default
 * figure has an 8-target macro stack rather than a 20-target one. Reproducing MPFB means
 * reproducing that.
 */
const MACRO_PARTS = {
    gender: [ { lowest: - 0.01, highest: 1.01, low: 'female', high: 'male' } ],
    age: [
        { lowest: - 0.01, highest: 0.1874998, low: 'baby', high: 'child' },
        { lowest: 0.1874999, highest: 0.49998, low: 'child', high: 'young' },
        { lowest: 0.49999, highest: 1.01, low: 'young', high: 'old' }
    ],
    muscle: [
        { lowest: - 0.01, highest: 0.49998, low: 'minmuscle', high: 'averagemuscle' },
        { lowest: 0.49999, highest: 1.01, low: 'averagemuscle', high: 'maxmuscle' }
    ],
    weight: [
        { lowest: - 0.01, highest: 0.49998, low: 'minweight', high: 'averageweight' },
        { lowest: 0.49999, highest: 1.01, low: 'averageweight', high: 'maxweight' }
    ],
    proportions: [
        { lowest: - 0.01, highest: 0.4999, low: 'uncommonproportions', high: '' },
        { lowest: 0.5, highest: 1.01, low: '', high: 'idealproportions' }
    ],
    height: [
        { lowest: - 0.01, highest: 0.49, low: 'minheight', high: '' },
        { lowest: 0.51, highest: 1.01, low: '', high: 'maxheight' }
    ],
    cupsize: [
        { lowest: - 0.01, highest: 0.49998, low: 'mincup', high: 'averagecup' },
        { lowest: 0.49999, highest: 1.01, low: 'averagecup', high: 'maxcup' }
    ],
    firmness: [
        { lowest: - 0.01, highest: 0.4998, low: 'minfirmness', high: 'averagefirmness' },
        { lowest: 0.4999, highest: 1.01, low: 'averagefirmness', high: 'maxfirmness' }
    ]
};

const MACRO_NAMES = [ 'gender', 'age', 'muscle', 'weight', 'proportions', 'height', 'cupsize', 'firmness' ];

/** MPFB's own iteration order over the ethnicity weights. Kept so stacks compare element-wise. */
const RACE_NAMES = [ 'asian', 'caucasian', 'african' ];

/** MPFB drops any combination whose product falls to here or below. `targetservice.py:933`. */
const MACRO_CUTOFF = 0.01;

/** The figure this project builds: an ethnically blended androgynous midpoint. `build_figure.py`. */
export const DEFAULT_MACRO = Object.freeze( {
    gender: 0.5, age: 0.5, muscle: 0.5, weight: 0.5,
    proportions: 0.5, height: 0.5, cupsize: 0.5, firmness: 0.5,
    race: Object.freeze( { asian: 0.33, caucasian: 0.33, african: 0.33 } )
} );

export class IdentityCatalogue {

    /**
     * @param {Object} catalogue - `assets/identity/catalogue.json`, already parsed.
     */
    constructor( catalogue ) {

        if ( catalogue?.format !== 'sugata-identity-catalogue' ) {
            throw new Error( `Not an identity catalogue: format is '${ catalogue?.format }'.` );
        }

        this.raw = catalogue;
        this.library = catalogue.library;
        this.census = catalogue.census;
        this.regions = catalogue.regions;
        this.sliders = catalogue.sliders;

        this.sliderById = new Map( catalogue.sliders.map( ( s ) => [ s.id, s ] ) );
        this.regionById = new Map( catalogue.regions.map( ( r ) => [ r.id, r ] ) );

    }

    /** Loads the shipped catalogue. `fetchJson` is injected so node and the browser share a path. */
    static async load( options = {} ) {

        const url = options.url
            ?? new URL( '../../../../assets/identity/catalogue.json', import.meta.url ).href;

        const fetchJson = options.fetchJson ?? ( async ( at ) => {
            const response = await fetch( at );
            if ( ! response.ok ) throw new Error( `${ at } -> HTTP ${ response.status }` );
            return response.json();
        } );

        return new IdentityCatalogue( await fetchJson( url ) );

    }

    /** Every slider an author may move. 200 of the 203; the 3 genital categories are excluded. */
    get exposedSliders() {

        return this.sliders.filter( ( s ) => s.exposed );

    }

    /**
     * How many widgets a UI has to draw. 🚩 It is not the slider count: 66 categories are
     * `has_left_and_right` and draw two, so the exposed set is 200 sliders and **266 widgets**.
     * research §2.2 reports 269 for the full 203; the difference is the three excluded genital
     * categories, all of them unsided.
     */
    get exposedWidgetCount() {

        const exposed = this.exposedSliders;
        return exposed.length + exposed.filter( ( s ) => s.sided ).length;

    }

    /** One slider, by `<region>/<category>` id. Throws rather than returning undefined. */
    slider( id ) {

        const slider = this.sliderById.get( id );
        if ( ! slider ) throw new Error( `No identity slider '${ id }'.` );
        return slider;

    }

    /** The sliders in one region, in the library's own order. */
    slidersIn( regionId ) {

        return this.sliders.filter( ( s ) => s.region === regionId );

    }

    /**
     * Turns slider values into the stack `IdentityTargets.apply()` consumes.
     *
     * @param {Object<string, number|{left: number, right: number}>} values
     *   Keyed by slider id. A plain number drives both sides of a sided slider — symmetry is the
     *   default because the standing constraint says facial asymmetry is wrong for this look
     *   target. `{ left, right }` drives them apart, which is 10.12's author-declared escape hatch
     *   and is why this signature exists at all; it records nothing and forbids nothing, and the
     *   declaration lives in the identity file (10.5).
     * @returns {Array<{target: string, weight: number, region: string, offset: number, count: number,
     *                  slider: string, side: string}>}
     *   Sparse: only non-zero weights appear. Empty for a default identity.
     */
    resolve( values ) {

        const stack = [];

        for ( const [ id, value ] of Object.entries( values ) ) {

            const slider = this.slider( id );

            if ( ! slider.exposed ) {
                throw new Error( `Identity slider '${ id }' is not exposed: `
                    + `${ this.regionById.get( slider.region ).excludedBecause }` );
            }

            const sides = slider.sided
                ? [ [ 'left', sideValue( value, 'left', id ) ], [ 'right', sideValue( value, 'right', id ) ] ]
                : [ [ 'unsided', sideValue( value, 'unsided', id ) ] ];

            for ( const [ side, amount ] of sides ) {

                if ( amount === 0 ) continue;

                if ( amount < 0 && slider.range === 'unipolar' ) {
                    throw new Error( `'${ id }' is unipolar — the library authored one shape for it, `
                        + `not a shape and its opposite. Got ${ amount }.` );
                }

                const key = `${ amount > 0 ? 'positive' : 'negative' }-${ side }`;
                const end = slider.ends[ key ];

                if ( ! end ) throw new Error( `'${ id }' has no '${ key }' end in the catalogue.` );

                stack.push( {
                    target: end.target,
                    weight: Math.abs( amount ),
                    region: slider.region,
                    offset: end.offset,
                    count: end.count,
                    slider: id,
                    side
                } );

            }

        }

        return stack;

    }

    /**
     * MPFB's macro target stack, reproduced.
     *
     * 🚩 **The files this returns do NOT ship** — see the header. It returns data so 10.8 can be
     * built against a solver that is already gated, and so a caller can be told exactly which
     * corpus a macro setting would need.
     *
     * @param {Object} [macro=DEFAULT_MACRO] - the eight parameters plus `race`.
     * @returns {Array<{file: string, weight: number}>} in MPFB's own emission order.
     */
    static macroTargetStack( macro = DEFAULT_MACRO ) {

        // Every value MPFB reads back off a figure is a float32 Blender property, and the weights
        // below are products of those. Rounding to float32 first is the difference between
        // reproducing MPFB and approximating it.
        const value = ( name ) => Math.fround( macro[ name ] ?? DEFAULT_MACRO[ name ] );
        const race = Object.fromEntries( RACE_NAMES.map(
            ( name ) => [ name, Math.fround( macro.race?.[ name ] ?? DEFAULT_MACRO.race[ name ] ) ] ) );

        const parts = {};
        for ( const name of MACRO_NAMES ) parts[ name ] = interpolateMacroComponents( name, value( name ) );

        const targets = [];
        const add = ( file, weight ) => { if ( weight > MACRO_CUTOFF ) targets.push( { file, weight } ); };

        for ( const raceName of RACE_NAMES ) {
            if ( race[ raceName ] <= 0.0001 ) continue;
            for ( const age of parts.age ) {
                for ( const gender of parts.gender ) {
                    if ( gender.name === 'universal' ) continue;
                    add( `macrodetails/${ raceName }-${ gender.name }-${ age.name }`,
                        race[ raceName ] * gender.weight * age.weight );
                }
            }
        }

        for ( const gender of parts.gender ) {
            for ( const age of parts.age ) {
                for ( const muscle of parts.muscle ) {
                    for ( const weight of parts.weight ) {
                        add( `macrodetails/universal-${ gender.name }-${ age.name }-${ muscle.name }-${ weight.name }`,
                            gender.weight * age.weight * muscle.weight * weight.weight );
                    }
                }
            }
        }

        for ( const gender of parts.gender ) {
            for ( const age of parts.age ) {
                for ( const muscle of parts.muscle ) {
                    for ( const weight of parts.weight ) {
                        for ( const height of parts.height ) {
                            add( `macrodetails/height/${ gender.name }-${ age.name }-${ muscle.name }`
                                + `-${ weight.name }-${ height.name }`,
                                gender.weight * age.weight * muscle.weight * weight.weight * height.weight );
                        }
                    }
                }
            }
        }

        // The breast family carries no gender factor — MPFB's own comment says there are no male
        // complementary targets — and skips two combinations that have no file on disk.
        for ( const gender of parts.gender ) {
            if ( gender.name !== 'female' ) continue;
            for ( const age of parts.age ) {
                for ( const muscle of parts.muscle ) {
                    for ( const weight of parts.weight ) {
                        for ( const cup of parts.cupsize ) {
                            for ( const firmness of parts.firmness ) {
                                const file = `breast/${ gender.name }-${ age.name }-${ muscle.name }`
                                    + `-${ weight.name }-${ cup.name }-${ firmness.name }`;
                                if ( file.includes( 'averagecup-averagefirmness' ) || file.includes( '-baby-' ) ) continue;
                                add( file, age.weight * muscle.weight * weight.weight * cup.weight * firmness.weight );
                            }
                        }
                    }
                }
            }
        }

        for ( const gender of parts.gender ) {
            for ( const age of parts.age ) {
                for ( const muscle of parts.muscle ) {
                    for ( const weight of parts.weight ) {
                        for ( const proportions of parts.proportions ) {
                            const file = `macrodetails/proportions/${ gender.name }-${ age.name }`
                                + `-${ muscle.name }-${ weight.name }-${ proportions.name }`;
                            if ( file.includes( '-baby-' ) ) continue;
                            add( file, gender.weight * age.weight * muscle.weight * weight.weight * proportions.weight );
                        }
                    }
                }
            }
        }

        return targets;

    }

}

/** `targetservice.py:896-929`, transcribed. */
function interpolateMacroComponents( name, value ) {

    const components = [];

    for ( const part of MACRO_PARTS[ name ] ) {

        if ( ! ( value > part.lowest && value < part.highest ) ) continue;

        const fraction = ( value - part.lowest ) / ( part.highest - part.lowest );

        if ( part.low ) components.push( { name: part.low, weight: roundHalfEven( 1 - fraction, 4 ) } );
        if ( part.high ) components.push( { name: part.high, weight: roundHalfEven( fraction, 4 ) } );

    }

    return components;

}

/**
 * Python's `round(x, 4)`, which is what MPFB quantises every macro component with.
 *
 * JavaScript has no equivalent: `Math.round` is half-away-from-zero and `toFixed` is a string
 * conversion with its own rounding. Both differ from Python at a tie, and a tie at the fourth
 * decimal is reachable — gender 0.5 lands one on the nose. So it is written out.
 */
function roundHalfEven( value, decimals ) {

    const scale = 10 ** decimals;
    const scaled = value * scale;
    const floor = Math.floor( scaled );
    const remainder = scaled - floor;

    if ( remainder > 0.5 ) return ( floor + 1 ) / scale;
    if ( remainder < 0.5 ) return floor / scale;

    return ( floor % 2 === 0 ? floor : floor + 1 ) / scale;

}

function sideValue( value, side, id ) {

    // A per-side object is the only non-number this accepts. Anything else — a string from a form
    // field, a null from a half-populated identity file — is a caller error and has to say so:
    // read loosely it would resolve to 0, and a slider that silently does nothing is the failure
    // `Identity.js`'s NOT_YET_BAKED list exists to avoid.
    if ( typeof value !== 'number' && ( value === null || typeof value !== 'object' ) ) {
        throw new Error( `Identity slider '${ id }' takes a number in [-1, 1] or { left, right }, got ${ JSON.stringify( value ) }.` );
    }

    const amount = typeof value === 'number'
        ? value
        : ( side === 'unsided' ? value.value : value[ side ] );

    if ( amount === undefined || amount === null ) return 0;

    if ( typeof amount !== 'number' || Number.isNaN( amount ) ) {
        throw new Error( `Identity slider '${ id }' takes a number in [-1, 1], got ${ amount }.` );
    }

    return Math.min( 1, Math.max( - 1, amount ) );

}
