/**
 * GarmentManifest — punch-list 9.1. What the wardrobe knows about a garment before it loads one.
 *
 * THE PROBLEM THIS CLASS EXISTS TO SOLVE
 * --------------------------------------
 * 🚩 **The mhclo format's own layering field does not work.** `z_depth` is INERT in MPFB: an
 * exhaustive grep of the source tree finds four write sites and no consumer — a property
 * declaration, a parse, a save, and a copy onto a Blender custom property — and nothing ever
 * reads it. Its only historical meaning was legacy MakeHuman's OpenGL viewport sorting, which
 * MPFB does not implement. The shipped values do not even encode a sensible order: measured
 * across all 20 CC0 garments, **14 suits at 50, 2 hats at 50, 6 shoes at 5** — shoes UNDER suits.
 * (`docs/research/wardrobe-system.md` §2.1.)
 *
 * And MPFB will happily attach two garments that occupy the same space. Built with
 * `female_casualsuit01` + `female_elegantsuit01`, both at `z_depth 50`: both meshes attach, both
 * delete groups apply as a union, the two suits interpenetrate, and there is **no ordering, no
 * conflict detection and no warning** (§2.2).
 *
 * So layer order is ours to define, and this file is where it is defined — as DATA, in
 * `assets/wardrobe/manifest.json`, not as a constant in code. Three consumers read the same file:
 * `build_figure.py` takes each garment's `alphaMode` from it, `Wardrobe.js` takes the layer order
 * and hide-mask names, and `verify_glb.mjs` gates the built GLB against it. One authority.
 *
 * ## The two rules, and why the second one has a slot dimension
 *
 *   1. **`layer` is a total order.** Every layer name resolves to a distinct integer `order`, so
 *      any two garments are strictly comparable and the dress sequence is deterministic. Two
 *      layer NAMES sharing one `order` value is the interesting failure: a naive "no duplicate
 *      names" check reads green on it while the order it claims to establish is not total.
 *      `validateManifest` rejects it, and the selftest proves that with two distinct names at the
 *      same rung.
 *
 *   2. **Two garments may not occupy the same layer AND the same body slot.** The punch list
 *      states this as "two garments claiming the same layer are rejected", and the slot dimension
 *      is a deliberate refinement of that, made because the unqualified rule is wrong in one
 *      common case and right in the case that matters:
 *
 *        - a shirt and trousers are both `BASE` and do not interpenetrate — disjoint slots;
 *        - two suits are both `BASE` and DO interpenetrate — `TORSO`, `ARMS`, `HIPS`, `LEGS`
 *          each claimed twice, which is the exact state MPFB accepts silently.
 *
 *      Collapsing the slot dimension away would force a `BASE_TOP` / `BASE_BOTTOM` split that a
 *      one-piece suit or a dress cannot honestly answer. The rejection the gate asks for still
 *      happens, on the garments it was asked about.
 *
 * ## What is authored and what is derived
 *
 * `clo` is ASHRAE 55-2013 Table 5.2.2.2B and is additive by that standard's §5.2.2.2(c), so a
 * composite is arithmetic over published rows and says so in `cloSource`. `formality` has no
 * literature behind it at all (research §6) and every entry marks itself AUTHORED. A garment the
 * table cannot describe — a hat — carries `clo: null` rather than a plausible number, because
 * `Dresser` (9.11) sums these to hit a target insulation and a fabricated row would corrupt every
 * ensemble it appears in.
 */

/** glTF's three alpha modes. A garment declares which it needs; nothing infers it from a name. */
export const ALPHA_MODES = [ 'OPAQUE', 'MASK', 'BLEND' ];

/**
 * Every field a garment entry must carry, and the check each one has to pass.
 *
 * Kept as data rather than as a wall of `if` statements so the error messages are uniform and so
 * the selftest can knock out one field at a time and watch exactly one rule fire.
 */
const GARMENT_FIELDS = [
    { name: 'id', check: ( value ) => typeof value === 'string' && value.length > 0,
        expected: 'a non-empty string' },
    { name: 'name', check: ( value ) => typeof value === 'string' && value.length > 0,
        expected: 'a non-empty display name' },
    { name: 'layer', check: ( value ) => typeof value === 'string' && value.length > 0,
        expected: 'a layer name declared in the manifest\'s layers table' },
    { name: 'slots', check: ( value ) => Array.isArray( value ) && value.length > 0,
        expected: 'a non-empty array of body slots' },
    { name: 'hideMask', check: ( value ) => value === null || ( typeof value === 'string' && value.length > 0 ),
        expected: 'a _hide_* attribute name, or null for a garment that hides nothing' },
    { name: 'alphaMode', check: ( value ) => ALPHA_MODES.includes( value ),
        expected: `one of ${ ALPHA_MODES.join( ', ' ) }` },
    { name: 'clo', check: ( value ) => value === null || ( typeof value === 'number' && value >= 0 ),
        expected: 'a non-negative ASHRAE clo value, or null when the table has no row for it' },
    { name: 'cloSource', check: ( value ) => typeof value === 'string' && value.length > 0,
        expected: 'where the clo value came from — a table row, an arithmetic, or NONE' },
    { name: 'fabric', check: ( value ) => typeof value === 'string' && value.length > 0,
        expected: 'a fabric taxonomy key (research/wardrobe-system.md §5.3)' },
    { name: 'formality', check: ( value ) => Number.isInteger( value ) && value >= 1 && value <= 5,
        expected: 'an integer 1-5' },
    { name: 'palette', check: ( value ) => Array.isArray( value ) && value.length > 0 &&
        value.every( ( entry ) => /^#[0-9a-f]{6}$/i.test( entry ) ),
        expected: 'a non-empty array of #rrggbb colourway hexes' },
    { name: 'fragments', check: ( value ) => value !== null && typeof value === 'object' &&
        Object.keys( value ).length > 0,
        expected: 'a map of figure key -> fragment GLB path' }
];

/**
 * One parsed, validated wardrobe manifest.
 *
 * Construction validates. There is no way to hold an invalid manifest, so no consumer has to
 * check one.
 */
export class GarmentManifest {

    /**
     * @param {Object} source - The parsed manifest.
     * @param {?string} [baseUrl] - Where the manifest was loaded from. Fragment paths are stored
     *   relative to the manifest file, so this is what resolves them. Null leaves them as-is,
     *   which is what a caller reading from disk wants.
     */
    constructor( source, baseUrl = null ) {

        const problems = validateManifest( source );

        if ( problems.length > 0 ) {

            throw new Error( `GarmentManifest: ${ problems.length } problem(s):\n  ` +
                problems.join( '\n  ' ) );

        }

        this.version = source.version;
        this.baseUrl = baseUrl;
        this.slots = [ ...source.slots ];

        // Layer name -> order. The total order every comparison below runs through.
        this.layerOrder = new Map( source.layers.map( ( layer ) => [ layer.name, layer.order ] ) );
        this.layers = source.layers
            .map( ( layer ) => ( { ...layer } ) )
            .sort( ( first, second ) => first.order - second.order );

        this.garments = new Map( source.garments.map( ( garment ) => [ garment.id, garment ] ) );

    }

    /** Loads and validates a manifest over the network. The browser path. */
    static async load( url ) {

        const response = await fetch( url );

        if ( response.ok !== true ) {

            throw new Error( `GarmentManifest: ${ url } returned HTTP ${ response.status }.` );

        }

        return new GarmentManifest( await response.json(), response.url );

    }

    /**
     * Where one garment's fragment for one figure lives, resolved against the manifest.
     *
     * Throws rather than returning undefined: a missing fragment is a build that did not run, and
     * a caller that gets `undefined` here would pass it to a loader and read a 404 in the console
     * instead of a sentence about which garment and which figure.
     */
    fragmentUrl( id, figureKey ) {

        const garment = this.require( id );
        const relative = garment.fragments[ figureKey ];

        if ( relative === undefined ) {

            throw new Error( `GarmentManifest: '${ id }' has no fragment for figure ` +
                `'${ figureKey }'. It declares ${ Object.keys( garment.fragments ).join( ', ' ) }.` );

        }

        return this.baseUrl === null ? relative : new URL( relative, this.baseUrl ).href;

    }

    /** The garment entry for an id, or undefined. */
    get( id ) {

        return this.garments.get( id );

    }

    /** Every garment id, in the manifest's own order. */
    ids() {

        return [ ...this.garments.keys() ];

    }

    /** Where a garment sits on the ladder. Throws on an unknown id rather than returning NaN. */
    orderOf( id ) {

        const garment = this.require( id );
        return this.layerOrder.get( garment.layer );

    }

    /** The garment entry for an id, or a thrown error naming the id. */
    require( id ) {

        const garment = this.garments.get( id );

        if ( garment === undefined ) {

            throw new Error( `GarmentManifest: no garment '${ id }'. Known: ${ this.ids().join( ', ' ) }.` );

        }

        return garment;

    }

    /**
     * Garment ids sorted innermost-first, by layer order and then by id.
     *
     * The id tiebreak is what makes this a total order on GARMENTS rather than only on layers:
     * a shirt and trousers share a rung, and two runs of the same outfit must still dress them in
     * the same sequence or a later diff against the worn set is not comparable.
     */
    sortByLayer( ids ) {

        return [ ...ids ].sort( ( first, second ) => {

            const difference = this.orderOf( first ) - this.orderOf( second );
            return difference !== 0 ? difference : first.localeCompare( second );

        } );

    }

    /**
     * Why this set of garments cannot be worn together, as a list of human-readable reasons.
     *
     * Empty means the outfit is wearable. This is the check that stands where MPFB has none —
     * §2.2 measured two suits attaching with no ordering, no conflict detection and no warning.
     */
    conflicts( ids ) {

        const problems = [];
        const occupancy = new Map();

        for ( const id of this.sortByLayer( ids ) ) {

            const garment = this.require( id );

            for ( const slot of garment.slots ) {

                const key = `${ garment.layer }/${ slot }`;
                const incumbent = occupancy.get( key );

                if ( incumbent !== undefined ) {

                    problems.push( `'${ id }' and '${ incumbent }' both claim ${ slot } at layer ` +
                        `${ garment.layer } — they would interpenetrate.` );
                    continue;

                }

                occupancy.set( key, id );

            }

        }

        return problems;
    }

    /** The hide-mask attribute names for a set of garments, skipping those that hide nothing. */
    hideMasksFor( ids ) {

        return ids
            .map( ( id ) => this.require( id ).hideMask )
            .filter( ( mask ) => mask !== null );

    }

    /** Total clo for an outfit, and which garments contributed nothing measurable.
     *
     * Split deliberately. A caller that sums a null to zero has silently claimed the fedora
     * insulates like bare skin; a caller that sees `unrated` can decide what to do about it.
     */
    insulationOf( ids ) {

        let clo = 0;
        const unrated = [];

        for ( const id of ids ) {

            const garment = this.require( id );
            if ( garment.clo === null ) unrated.push( id );
            else clo += garment.clo;

        }

        return { clo: Number( clo.toFixed( 4 ) ), unrated };

    }

}

/**
 * Everything wrong with a candidate manifest, as a list of messages. Empty means valid.
 *
 * A free function rather than a method because the selftest and `verify_glb.mjs` both need to run
 * it over a manifest that is expected to FAIL, and a constructor that throws cannot be asked what
 * would have gone wrong.
 */
export function validateManifest( source ) {

    const problems = [];

    if ( source === null || typeof source !== 'object' ) {

        return [ 'the manifest is not an object' ];

    }

    if ( Number.isInteger( source.version ) === false ) {

        problems.push( 'version must be an integer' );

    }

    problems.push( ...validateLayers( source.layers ) );

    const slots = Array.isArray( source.slots ) ? source.slots : [];
    if ( slots.length === 0 ) problems.push( 'slots must be a non-empty array of body slot names' );

    const layerNames = new Set( ( Array.isArray( source.layers ) ? source.layers : [] )
        .map( ( layer ) => layer?.name ) );

    problems.push( ...validateGarments( source.garments, layerNames, new Set( slots ) ) );

    return problems;

}

/** The total-order rule: layer names unique, order values integers, order values unique. */
function validateLayers( layers ) {

    if ( Array.isArray( layers ) === false || layers.length === 0 ) {

        return [ 'layers must be a non-empty array' ];

    }

    const problems = [];
    const seenNames = new Map();
    const seenOrders = new Map();

    for ( const layer of layers ) {

        if ( typeof layer?.name !== 'string' || layer.name.length === 0 ) {

            problems.push( 'a layer has no name' );
            continue;

        }

        if ( Number.isInteger( layer.order ) === false ) {

            problems.push( `layer '${ layer.name }' has order ${ layer.order }, expected an integer` );
            continue;

        }

        if ( seenNames.has( layer.name ) ) {

            problems.push( `layer '${ layer.name }' is declared twice` );

        }

        // 🚩 The one a name-uniqueness check misses. Two distinct rungs at the same height are not
        // a total order: which of them is "outer" has no answer, and the dress sequence stops
        // being deterministic while every other check stays green.
        if ( seenOrders.has( layer.order ) ) {

            problems.push( `layers '${ seenOrders.get( layer.order ) }' and '${ layer.name }' ` +
                `both claim order ${ layer.order } — layer order would not be total` );

        }

        seenNames.set( layer.name, true );
        seenOrders.set( layer.order, layer.name );

    }

    return problems;

}

function validateGarments( garments, layerNames, slotNames ) {

    if ( Array.isArray( garments ) === false || garments.length === 0 ) {

        return [ 'garments must be a non-empty array' ];

    }

    const problems = [];
    const seenIds = new Set();

    for ( const [ index, garment ] of garments.entries() ) {

        const label = typeof garment?.id === 'string' ? `'${ garment.id }'` : `garments[${ index }]`;

        if ( garment === null || typeof garment !== 'object' ) {

            problems.push( `${ label } is not an object` );
            continue;

        }

        for ( const field of GARMENT_FIELDS ) {

            if ( field.check( garment[ field.name ] ) === false ) {

                problems.push( `${ label }.${ field.name } is ${ JSON.stringify( garment[ field.name ] ) }, ` +
                    `expected ${ field.expected }` );

            }

        }

        if ( seenIds.has( garment.id ) ) problems.push( `${ label } is declared twice` );
        seenIds.add( garment.id );

        if ( typeof garment.layer === 'string' && layerNames.has( garment.layer ) === false ) {

            problems.push( `${ label }.layer '${ garment.layer }' is not a declared layer` );

        }

        for ( const slot of Array.isArray( garment.slots ) ? garment.slots : [] ) {

            if ( slotNames.has( slot ) === false ) {

                problems.push( `${ label }.slots contains '${ slot }', which is not a declared slot` );

            }

        }

        // A MASK garment is a cutout, and a cutout with the glTF default 0.5 cutoff is what
        // discarded 15,368 lash and 20,262 brow texels in item 3.16. Any garment asking for MASK
        // must state its own cutoff so the number is a decision rather than an inheritance.
        if ( garment.alphaMode === 'MASK' &&
             ( typeof garment.alphaCutoff !== 'number' || garment.alphaCutoff <= 0 ||
               garment.alphaCutoff >= 1 ) ) {

            problems.push( `${ label }.alphaCutoff is ${ JSON.stringify( garment.alphaCutoff ) }, ` +
                'expected a number strictly between 0 and 1 on a MASK garment' );

        }

    }

    return problems;

}
