/**
 * The measured gate for punch-list 9.8 — the foundation layer — run against real built GLBs.
 *
 *   node packages/core/src/wardrobe/decency.selftest.mjs
 *
 * It needs the wardrobe build, which is gitignored build output:
 *
 *   blender --background --python tools/figure-pipeline/build_figure.py -- \
 *     --gender 0.5 --output assets/wardrobe/body/g050.glb \
 *     --garment female_casualsuit01 --garment shoes01 --garment fedora01 \
 *     --garment female_elegantsuit01 \
 *     --foundation foundation_bra --foundation foundation_vest \
 *     --foundation foundation_briefs --foundation foundation_boxer_brief \
 *     --hide-mask-attribute --garment-fragment-dir assets/wardrobe
 *
 * ## WHAT IS BEING MEASURED, AND WHY IT IS NOT THE BUILD'S OWN ARITHMETIC
 *
 * The build knows which body vertices it cut each shell from, and could assert coverage from that
 * in one line of set algebra. It would also be checking its own bookkeeping — docs/LEARNINGS.md
 * §1.25a — so this file does not read it. It reads the SHIPPED artefacts and measures where the
 * cloth is:
 *
 *   * the decency regions come off the body GLB as `_DECENCY_CHEST/GROIN/SEAT`, written by the
 *     build from MakeHuman's own `nipple` vertex group and from measured extrema of the skin;
 *   * coverage is a RAY CAST from each region vertex along its own normal into whatever geometry
 *     is currently drawn, using the index buffers the runtime actually produced after `dress()`,
 *     cut at `drawRange` exactly as the GPU would see them.
 *
 * A body vertex is decent when it is not drawn at all — some garment's `_HIDE_*` mask removed it —
 * or when a drawn garment surface is in front of it. Those are the only two ways skin is not seen.
 *
 * ## THE SWEEP IS EXHAUSTIVE, AND "EVERY REACHABLE STATE" INCLUDES THREE THINGS THAT ARE EASY TO MISS
 *
 *   1. **The empty set.** `dress( [] )` is a state a user reaches with one button.
 *   2. **Every foundation preference.** The floor is one garment per slot and the user picks which,
 *      so a state is (outer garments) × (which bra) × (which brief), not just the first of each.
 *   3. **Every intermediate frame of a change.** `dress()` awaits its fragments before it mutates
 *      anything, which is a CLAIM about atomicity and is checked here by observation rather than
 *      by reading the code: the loader is instrumented to sample the live scene at every point the
 *      event loop can yield, and every sample is run through the same decency measurement.
 *
 * ## PROVEN RED FOUR WAYS, IN TWO DIFFERENT MECHANISMS
 *
 * 🚩 A gate that only catches its own known-bad is decorative, so the geometry half and the
 * bookkeeping half are each broken independently:
 *
 *   1. a foundation piece REMOVED FROM THE MANIFEST — the red the punch list names;
 *   2. the floor emptied, which is what a `decencyFloor` returning `[]` does;
 *   3. a foundation garment whose GEOMETRY IS TRIMMED at the gusset, manifest untouched, floor
 *      untouched, every id present — only the ray cast can see this one;
 *   4. an outer garment whose hide mask is dropped, which does not undress the avatar but removes
 *      the OTHER way a region can be decent, and is the mechanism clause (a) exists for.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { Figure } = await import( '../figure/Figure.js' );
const { GarmentManifest } = await import( './GarmentManifest.js' );
const { Wardrobe } = await import( './Wardrobe.js' );
const { FoundationLayer, FOUNDATION_LAYER } = await import( './FoundationLayer.js' );

const repoRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );

const MANIFEST_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'manifest.json' );
const BODY_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'body', 'g050.glb' );

/** The three regions the build writes onto the body, in the exporter's upper-cased spelling. */
const DECENCY_REGIONS = [ 'chest', 'groin', 'seat' ];

/**
 * How far in front of a skin vertex a garment surface may be and still be covering it.
 *
 * Measured on this build rather than picked. Along its own normal, a decency-region skin vertex
 * meets `female_casualsuit01` at a median of 1.1 mm (chest), 5.9 mm (groin) and 1.2 mm (seat), and
 * at a worst case of 24.9 mm on the groin; the foundation shells stand 0.40–4.20 mm off the skin.
 * 30 mm clears the worst observed by 20% and is far short of anything that is not on the body.
 *
 * ⚠️ Note what that measurement also says: only 27 of the 110 chest vertices hit the suit AT ALL
 * along their normal. The other 83 are outside the cloth — the poke-through punch-list 9.4 puts at
 * 26.37% of covered skin — and are decent only because the suit's hide mask removes them.
 */
const COVER_REACH_M = 0.030;

/** Started just off the surface so a ray cannot hit the body's own triangle it starts on. */
const RAY_LIFT_M = 0.0001;

const results = [];

function record( ok, label, detail ) {

    results.push( { ok, label, detail } );
    console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ label }${ detail ? ` — ${ detail }` : '' }` );

}

// --- loading ------------------------------------------------------------------------------------

async function loadGltf( filePath ) {

    const file = fs.readFileSync( filePath );
    const buffer = file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength );

    return new Promise( ( resolve, reject ) => {
        new GLTFLoader().parse( buffer, '', resolve, reject );
    } );

}

function loadFragmentFromDisk( url ) {

    return loadGltf( fileURLToPath( url ) );

}

/** The body's decency regions, as arrays of vertex indices. */
function decencyRegionsOf( geometry ) {

    const regions = new Map();

    for ( const name of DECENCY_REGIONS ) {

        const attribute = attributeNamed( geometry, `_decency_${ name }` );

        if ( attribute === null ) {

            regions.set( name, null );
            continue;

        }

        const members = [];
        for ( let vertex = 0; vertex < attribute.count; vertex += 1 ) {

            if ( attribute.getX( vertex ) > 0.5 ) members.push( vertex );

        }

        regions.set( name, members );

    }

    return regions;

}

function attributeNamed( geometry, name ) {

    for ( const [ candidate, attribute ] of Object.entries( geometry.attributes ) ) {

        if ( candidate.toLowerCase() === name.toLowerCase() ) return attribute;

    }

    return null;

}

// --- the measurement ------------------------------------------------------------------------------

/**
 * A uniform grid over triangles, so a 25 mm ray does not have to be tested against 20,000 of them.
 *
 * The cell is the ray's own reach, so a ray starting in one cell can only reach the 27 cells
 * around it — and in practice one or two of those hold anything.
 */
class TriangleGrid {

    constructor( cellSize ) {

        this.cellSize = cellSize;
        this.cells = new Map();

    }

    add( triangle ) {

        const minimum = [ 0, 1, 2 ].map( ( axis ) =>
            Math.floor( Math.min( triangle[ 0 ][ axis ], triangle[ 1 ][ axis ], triangle[ 2 ][ axis ] ) / this.cellSize ) );
        const maximum = [ 0, 1, 2 ].map( ( axis ) =>
            Math.floor( Math.max( triangle[ 0 ][ axis ], triangle[ 1 ][ axis ], triangle[ 2 ][ axis ] ) / this.cellSize ) );

        for ( let x = minimum[ 0 ]; x <= maximum[ 0 ]; x += 1 ) {
            for ( let y = minimum[ 1 ]; y <= maximum[ 1 ]; y += 1 ) {
                for ( let z = minimum[ 2 ]; z <= maximum[ 2 ]; z += 1 ) {

                    const key = `${ x },${ y },${ z }`;
                    if ( this.cells.has( key ) === false ) this.cells.set( key, [] );
                    this.cells.get( key ).push( triangle );

                }
            }
        }

    }

    /** Whether a ray of length `reach` from `origin` along `direction` hits anything. */
    hits( origin, direction, reach ) {

        const steps = Math.ceil( reach / this.cellSize );
        const seen = new Set();

        for ( let step = 0; step <= steps; step += 1 ) {

            const point = [
                origin[ 0 ] + direction[ 0 ] * ( step * this.cellSize ),
                origin[ 1 ] + direction[ 1 ] * ( step * this.cellSize ),
                origin[ 2 ] + direction[ 2 ] * ( step * this.cellSize )
            ];

            const base = point.map( ( value ) => Math.floor( value / this.cellSize ) );

            for ( let x = -1; x <= 1; x += 1 ) {
                for ( let y = -1; y <= 1; y += 1 ) {
                    for ( let z = -1; z <= 1; z += 1 ) {

                        const key = `${ base[ 0 ] + x },${ base[ 1 ] + y },${ base[ 2 ] + z }`;
                        if ( seen.has( key ) ) continue;
                        seen.add( key );

                        for ( const triangle of this.cells.get( key ) ?? [] ) {

                            if ( rayHitsTriangle( origin, direction, reach, triangle ) ) return true;

                        }

                    }
                }
            }

        }

        return false;

    }

}

/** Möller–Trumbore, two-sided. Two-sided on purpose: a garment's facing is not the question. */
function rayHitsTriangle( origin, direction, reach, triangle ) {

    const [ a, b, c ] = triangle;

    const edge1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ];
    const edge2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];

    const pvec = cross( direction, edge2 );
    const determinant = dot( edge1, pvec );

    if ( Math.abs( determinant ) < 1e-12 ) return false;

    const inverse = 1 / determinant;
    const tvec = [ origin[ 0 ] - a[ 0 ], origin[ 1 ] - a[ 1 ], origin[ 2 ] - a[ 2 ] ];
    const u = dot( tvec, pvec ) * inverse;

    if ( u < 0 || u > 1 ) return false;

    const qvec = cross( tvec, edge1 );
    const v = dot( direction, qvec ) * inverse;

    if ( v < 0 || u + v > 1 ) return false;

    const distance = dot( edge2, qvec ) * inverse;

    return distance > 0 && distance <= reach;

}

function cross( first, second ) {

    return [
        first[ 1 ] * second[ 2 ] - first[ 2 ] * second[ 1 ],
        first[ 2 ] * second[ 0 ] - first[ 0 ] * second[ 2 ],
        first[ 0 ] * second[ 1 ] - first[ 1 ] * second[ 0 ]
    ];

}

function dot( first, second ) {

    return first[ 0 ] * second[ 0 ] + first[ 1 ] * second[ 1 ] + first[ 2 ] * second[ 2 ];

}

/**
 * A grid over every triangle the worn garments are CURRENTLY drawing.
 *
 * 🎯 `drawRange.count`, not `index.count`. The foundation layer carries `_UNDER_*` masks and the
 * runtime cuts its index buffer down under an opaque outer garment, so the two numbers differ by
 * design — and a gate that read the whole index buffer would credit the bra for covering a region
 * it is not drawing. That is the difference between measuring the render and measuring the file.
 */
function drawnGeometryGrid( wardrobe ) {

    const grid = new TriangleGrid( COVER_REACH_M );

    for ( const mesh of wardrobe.wornMeshes.values() ) {

        const positions = mesh.geometry.attributes.position;
        const index = mesh.geometry.index;
        const drawn = Number.isFinite( mesh.geometry.drawRange.count )
            ? Math.min( mesh.geometry.drawRange.count, index.count )
            : index.count;

        for ( let offset = 0; offset < drawn; offset += 3 ) {

            grid.add( [ 0, 1, 2 ].map( ( corner ) => {

                const vertex = index.getX( offset + corner );
                return [ positions.getX( vertex ), positions.getY( vertex ), positions.getZ( vertex ) ];

            } ) );

        }

    }

    return grid;

}

/** Which body vertices are not drawn at all, because a worn garment's hide mask removed them. */
function undrawnBodyVertices( wardrobe ) {

    const geometry = wardrobe.body.geometry;
    const drawn = new Set();
    const index = geometry.index;

    for ( let offset = 0; offset < geometry.drawRange.count; offset += 1 ) {

        drawn.add( index.getX( offset ) );

    }

    return drawn;

}

/**
 * How many vertices of each decency region are exposed: drawn skin with nothing in front of it.
 *
 * Returns `{ region: [ exposed vertex indices ] }`, so a failure names where rather than how many.
 */
function exposureOf( wardrobe, regions ) {

    const geometry = wardrobe.body.geometry;
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    const drawn = undrawnBodyVertices( wardrobe );
    const grid = drawnGeometryGrid( wardrobe );

    const exposed = {};

    // A body that is not drawn cannot be indecent. `Wardrobe` hides it between construction and
    // the first dress for exactly this reason, and a measurement that ignored `visible` would
    // report the window it was added to close.
    if ( wardrobe.body.visible === false ) {

        for ( const [ name ] of regions ) exposed[ name ] = [];
        return exposed;

    }

    for ( const [ name, members ] of regions ) {

        exposed[ name ] = [];

        for ( const vertex of members ) {

            // Not drawn at all: a garment's hide mask took this triangle fan away.
            if ( drawn.has( vertex ) === false ) continue;

            const normal = [ normals.getX( vertex ), normals.getY( vertex ), normals.getZ( vertex ) ];
            const origin = [
                positions.getX( vertex ) + normal[ 0 ] * RAY_LIFT_M,
                positions.getY( vertex ) + normal[ 1 ] * RAY_LIFT_M,
                positions.getZ( vertex ) + normal[ 2 ] * RAY_LIFT_M
            ];

            if ( grid.hits( origin, normal, COVER_REACH_M ) ) continue;

            exposed[ name ].push( vertex );

        }

    }

    return exposed;

}

function totalExposed( exposed ) {

    return Object.values( exposed ).reduce( ( total, list ) => total + list.length, 0 );

}

function describeExposure( exposed ) {

    return DECENCY_REGIONS.map( ( name ) => `${ name } ${ exposed[ name ].length }` ).join( ', ' );

}

// --- the states -----------------------------------------------------------------------------------

/** Every subset of the non-foundation catalogue, as arrays. 2^n, including the empty one. */
function everySubset( ids ) {

    let subsets = [ [] ];

    for ( const id of ids ) {

        subsets = subsets.concat( subsets.map( ( subset ) => [ ...subset, id ] ) );

    }

    return subsets;

}

/** Every combination of foundation preferences the user can pick, as slot -> id maps. */
function everyPreference( foundation ) {

    let choices = [ {} ];

    for ( const slot of foundation.slots ) {

        choices = foundation.alternativesFor( slot ).flatMap( ( id ) =>
            choices.map( ( choice ) => ( { ...choice, [ slot ]: id } ) ) );

    }

    return choices;

}

// --- main -------------------------------------------------------------------------------------------

console.log( '='.repeat( 78 ) );
console.log( 'decency selftest — punch-list 9.8, the foundation layer' );
console.log( '='.repeat( 78 ) );

const missing = [ MANIFEST_PATH, BODY_PATH ].filter( ( candidate ) => fs.existsSync( candidate ) === false );

if ( missing.length > 0 ) {

    for ( const candidate of missing ) console.log( `  SKIP ${ path.relative( repoRoot, candidate ) } — not built` );
    console.log( 'FAIL — build the wardrobe artefacts first; the header has the command.' );
    process.exit( 1 );

}

const manifestSource = JSON.parse( fs.readFileSync( MANIFEST_PATH, 'utf8' ) );
const manifestUrl = pathToFileURL( MANIFEST_PATH ).href;

async function wardrobeFor( source, preference, options = {} ) {

    const manifest = new GarmentManifest( source, manifestUrl );
    const foundation = new FoundationLayer( manifest, { preference } );
    const figure = new Figure( await loadGltf( BODY_PATH ) );

    const wardrobe = new Wardrobe( figure, manifest, {
        decencyFloor: options.floor ?? foundation.floor,
        loadFragment: options.loadFragment ?? loadFragmentFromDisk
    } );

    return { manifest, foundation, wardrobe };

}

// --- the artefact carries what the gate reads ---------------------------------------------------

console.log( '' );
console.log( '--- the body carries the decency regions ---' );

const base = await wardrobeFor( manifestSource, {} );
const regions = decencyRegionsOf( base.wardrobe.body.geometry );

const absent = [ ...regions ].filter( ( [ , members ] ) => members === null ).map( ( [ name ] ) => name );

record( absent.length === 0, 'the body GLB carries all three _DECENCY_* regions',
    absent.length === 0
        ? DECENCY_REGIONS.map( ( name ) => `${ name } ${ regions.get( name ).length }` ).join( ', ' )
        : `missing ${ absent.join( ', ' ) } — rebuild with --foundation` );

if ( absent.length > 0 ) {

    console.log( '' );
    console.log( 'FAIL — the gate has no target to measure against.' );
    process.exit( 1 );

}

// A region of zero vertices would make every clause below pass trivially. This is the §1.25a
// check on the gate's own input rather than on its subject.
record( DECENCY_REGIONS.every( ( name ) => regions.get( name ).length >= 20 ),
    'every region is big enough to be a target, not a rounding error',
    DECENCY_REGIONS.map( ( name ) => `${ name } ${ regions.get( name ).length }` ).join( ', ' ) );

const foundationIds = base.manifest.ids()
    .filter( ( id ) => base.manifest.get( id ).layer === FOUNDATION_LAYER );
const otherIds = base.manifest.ids()
    .filter( ( id ) => base.manifest.get( id ).layer !== FOUNDATION_LAYER );

record( foundationIds.length === 4, 'the manifest declares the four foundation garments',
    foundationIds.join( ', ' ) );

record( foundationIds.every( ( id ) => base.manifest.get( id ).hideMask === null ),
    'no foundation garment hides any body region of its own',
    'a foundation garment that deleted skin could not be worn under anything that also deleted it' );

// --- the nude control: this is the state the layer exists for ------------------------------------

console.log( '' );
console.log( '--- the empty set, and the control that proves the measurement can fail ---' );

const bare = await wardrobeFor( manifestSource, {}, { floor: () => [] } );
const bareExposure = exposureOf( bare.wardrobe, regions );

const regionTotal = [ ...regions.values() ].reduce( ( total, list ) => total + list.length, 0 );

record( totalExposed( bareExposure ) === regionTotal,
    'CONTROL: with no floor at all, every decency vertex measures as exposed',
    `${ describeExposure( bareExposure ) } of ${ regionTotal } — the measurement is capable ` +
    'of reading a failure' );

const floored = await wardrobeFor( manifestSource, {} );
await floored.wardrobe.dress( [] );
const flooredExposure = exposureOf( floored.wardrobe, regions );

record( totalExposed( flooredExposure ) === 0,
    'a body with no garments at all still renders the foundation layer',
    `worn ${ floored.wardrobe.worn.join( ', ' ) }; exposed ${ describeExposure( flooredExposure ) }` );

// --- the exhaustive sweep -------------------------------------------------------------------------

console.log( '' );
console.log( '--- the exhaustive sweep ---' );

const preferences = everyPreference( floored.foundation );
const subsets = everySubset( otherIds );

let swept = 0;
let refused = 0;
const failures = [];

for ( const preference of preferences ) {

    const run = await wardrobeFor( manifestSource, preference );

    for ( const subset of subsets ) {

        let stats = null;

        try {

            stats = await run.wardrobe.dress( subset );

        } catch ( error ) {

            // The only legitimate refusal is the manifest's own conflict rule — two suits. An
            // outfit refused for any other reason is an unreachable state, which is a failure.
            if ( /cannot be worn/.test( error.message ) === false ) {

                failures.push( `${ subset.join( '+' ) || 'nothing' }: ${ error.message }` );

            }

            refused += 1;
            continue;

        }

        swept += 1;

        const exposure = exposureOf( run.wardrobe, regions );

        if ( totalExposed( exposure ) > 0 ) {

            failures.push( `${ stats.worn.join( '+' ) }: ${ describeExposure( exposure ) } exposed` );

        }

        // Every state must actually be wearing the floor, not merely be decent by accident.
        for ( const id of run.foundation.currentFloor() ) {

            if ( stats.worn.includes( id ) === false ) {

                failures.push( `${ stats.worn.join( '+' ) }: the floor garment ${ id } is not worn` );

            }

        }

    }

}

record( failures.length === 0,
    `every reachable state is decent — ${ swept } states swept`,
    failures.length === 0
        ? `${ preferences.length } foundation preferences x ${ subsets.length } outer subsets, ` +
          `${ refused } refused by the manifest's conflict rule`
        : `${ failures.length } failing: ${ failures.slice( 0, 3 ).join( '; ' ) }` );

// --- takeOff and undress are states too --------------------------------------------------------------

console.log( '' );
console.log( '--- undress, and taking off every garment one at a time ---' );

const stripping = await wardrobeFor( manifestSource, {} );
await stripping.wardrobe.dress( [ 'female_casualsuit01', 'shoes01', 'fedora01' ] );

const strippingFailures = [];

for ( const id of [ ...stripping.wardrobe.worn ] ) {

    await stripping.wardrobe.takeOff( [ id ] );
    const exposure = exposureOf( stripping.wardrobe, regions );

    if ( totalExposed( exposure ) > 0 ) {

        strippingFailures.push( `after takeOff(${ id }): ${ describeExposure( exposure ) }` );

    }

}

await stripping.wardrobe.undress();
const undressedExposure = exposureOf( stripping.wardrobe, regions );

if ( totalExposed( undressedExposure ) > 0 ) {

    strippingFailures.push( `after undress(): ${ describeExposure( undressedExposure ) }` );

}

record( strippingFailures.length === 0,
    'takeOff of every worn garment in turn, then undress, all stay decent',
    strippingFailures.length === 0
        ? `ended wearing ${ stripping.wardrobe.worn.join( ', ' ) }`
        : strippingFailures.join( '; ' ) );

// --- every intermediate frame of a change ---------------------------------------------------------

console.log( '' );
console.log( '--- every point the event loop can yield during a change ---' );

/**
 * 🎯 `dress()` claims to load every fragment before it mutates anything. This is that claim
 * OBSERVED rather than read: the loader hands back a promise that resolves several macrotasks
 * later — so a real frame could be drawn — and samples the live scene each time.
 */
let samples = [];
let sampledWardrobe = null;

const slowLoader = async ( url ) => {

    for ( let tick = 0; tick < 3; tick += 1 ) {

        await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

        if ( sampledWardrobe !== null ) {

            samples.push( {
                worn: [ ...sampledWardrobe.wornMeshes.keys() ],
                bodyVisible: sampledWardrobe.body.visible,
                exposed: totalExposed( exposureOf( sampledWardrobe, regions ) )
            } );

        }

    }

    return loadFragmentFromDisk( url );

};

const transitions = await wardrobeFor( manifestSource, {}, { loadFragment: slowLoader } );
sampledWardrobe = transitions.wardrobe;

const changes = [
    [],
    [ 'female_casualsuit01', 'shoes01' ],
    [ 'fedora01' ],
    [ 'female_elegantsuit01', 'shoes01', 'fedora01' ],
    []
];

for ( const change of changes ) await transitions.wardrobe.dress( change );

const indecentSamples = samples.filter( ( sample ) => sample.exposed > 0 );

record( samples.length > 0 && indecentSamples.length === 0,
    'no observable intermediate state is indecent',
    `${ samples.length } samples taken mid-change across ${ changes.length } outfit changes; ` +
    `${ indecentSamples.length } indecent` );

// And the composition of every sample is a COMPLETE outfit, never a half-applied one.
const floorSize = transitions.foundation.currentFloor().length;

const mixed = samples.filter( ( sample ) => {

    if ( sample.bodyVisible === false ) return false;

    const foundationWorn = sample.worn.filter( ( id ) => foundationIds.includes( id ) );
    return foundationWorn.length !== floorSize;

} );

record( mixed.length === 0,
    'the foundation layer is complete in every drawn sample, never half-applied',
    `${ samples.length } samples, ` +
    `${ samples.filter( ( sample ) => sample.bodyVisible === false ).length } taken before the ` +
    `first dress finished (body not drawn), the rest wearing all ${ floorSize } floor garments` );

// --- the _UNDER_ mechanism, measured both ways -------------------------------------------------------

console.log( '' );
console.log( '--- _UNDER_: what an opaque outer garment is allowed to stop being drawn ---' );

const layered = await wardrobeFor( manifestSource, { TORSO: 'foundation_vest', HIPS: 'foundation_boxer_brief' } );

await layered.wardrobe.dress( [] );
const aloneStats = layered.wardrobe.stats();
const aloneDrawn = Object.fromEntries( aloneStats.occlusion.map( ( entry ) => [ entry.id, entry.drawnTriangles ] ) );

await layered.wardrobe.dress( [ 'female_casualsuit01' ] );
const coveredStats = layered.wardrobe.stats();
const coveredDrawn = Object.fromEntries( coveredStats.occlusion.map( ( entry ) => [ entry.id, entry.drawnTriangles ] ) );

record( coveredDrawn.foundation_vest < aloneDrawn.foundation_vest,
    'a suit worn over the vest stops most of the vest being drawn',
    `${ aloneDrawn.foundation_vest } -> ${ coveredDrawn.foundation_vest } triangles ` +
    `(${ ( 100 * ( 1 - coveredDrawn.foundation_vest / aloneDrawn.foundation_vest ) ).toFixed( 1 ) }% occluded)` );

record( coveredStats.worn.includes( 'foundation_vest' ) && coveredStats.worn.includes( 'foundation_boxer_brief' ),
    'and it is still WORN — occluded is not removed',
    coveredStats.worn.join( ', ' ) );

const suitOcclusion = coveredStats.occlusion.find( ( entry ) => entry.id === 'foundation_vest' );

record( suitOcclusion.occludedBy.join( ',' ) === 'female_casualsuit01',
    'the runtime names which garment did the occluding',
    `occludedBy ${ suitOcclusion.occludedBy.join( ', ' ) || 'nothing' }` );

// A hat is OPAQUE and outside everything, and hides nothing — so it must occlude nothing either.
await layered.wardrobe.dress( [ 'fedora01' ] );
const hatted = layered.wardrobe.stats();

record( hatted.occlusion.every( ( entry ) => entry.drawnTriangles === entry.fullTriangles ),
    'a garment that hides nothing occludes nothing',
    'the fedora carries no delete_verts at all, so no _UNDER_ mask names it' );

// --- RED 1: the punch list's own known-bad -------------------------------------------------------------

console.log( '' );
console.log( '--- RED: four ways to break it, in two different mechanisms ---' );

const withoutBriefs = structuredClone( manifestSource );
withoutBriefs.garments = withoutBriefs.garments.filter( ( entry ) => entry.id !== 'foundation_briefs' );

let removalCaught = false;
let removalMessage = '';

try {

    const broken = await wardrobeFor( withoutBriefs, { HIPS: 'foundation_briefs' } );
    await broken.wardrobe.dress( [] );

} catch ( error ) {

    removalCaught = true;
    removalMessage = error.message.split( '\n' )[ 0 ];

}

record( removalCaught,
    'RED 1: a foundation piece removed from the manifest fails loudly rather than quietly substituting',
    removalMessage || 'it did NOT fail — the floor silently wore something else' );

// 🚩 …and the second half of RED 1, which is the interesting half. Removing a piece the floor was
// not asked for must NOT break anything: the floor names what it wants, and what it does not want
// is not its business. A gate that failed here would be testing the manifest's length.
const survivor = await wardrobeFor( withoutBriefs, { HIPS: 'foundation_boxer_brief' } );
await survivor.wardrobe.dress( [] );

record( totalExposed( exposureOf( survivor.wardrobe, regions ) ) === 0,
    'RED 1b: and the same manifest with a DIFFERENT preference is still decent',
    `worn ${ survivor.wardrobe.worn.join( ', ' ) } — the failure above is the floor's, not the sweep's` );

// --- RED 2: the floor emptied --------------------------------------------------------------------------

const emptyFloor = await wardrobeFor( manifestSource, {}, { floor: () => [] } );
await emptyFloor.wardrobe.dress( [ 'fedora01' ] );
const emptyFloorExposure = exposureOf( emptyFloor.wardrobe, regions );

record( totalExposed( emptyFloorExposure ) > 0,
    'RED 2: a decencyFloor returning nothing is caught',
    `${ describeExposure( emptyFloorExposure ) } exposed while wearing ${ emptyFloor.wardrobe.worn.join( ', ' ) }` );

// --- RED 3: the geometry trimmed, everything else intact ------------------------------------------------

/**
 * 🚩 A DIFFERENT MECHANISM IN THE SAME CLASS, and the one the manifest reds cannot see.
 *
 * The manifest is whole. The floor is whole. Every id is present, every garment is worn, and
 * `stats().worn` is identical to a correct run. What has changed is that the briefs' gusset has
 * been cut away — the triangles nearest the crotch removed from the drawn range, which is exactly
 * what a wrong hem parameter in `build_figure.py` would produce.
 *
 * Only the ray cast sees this. Every bookkeeping clause above reads green on it.
 */
const trimmed = await wardrobeFor( manifestSource, { HIPS: 'foundation_briefs' } );
await trimmed.wardrobe.dress( [] );

const beforeTrim = exposureOf( trimmed.wardrobe, regions );
const briefsMesh = trimmed.wardrobe.wornMeshes.get( 'foundation_briefs' );
const trimmedAway = trimGussetTriangles( briefsMesh, trimmed.wardrobe.body.geometry, regions.get( 'groin' ) );
const afterTrim = exposureOf( trimmed.wardrobe, regions );

record( totalExposed( beforeTrim ) === 0 && afterTrim.groin.length > 0,
    'RED 3: a foundation garment trimmed at the gusset is caught by the ray cast alone',
    `${ trimmedAway } triangles removed from the briefs' drawn range; groin exposure ` +
    `${ beforeTrim.groin.length } -> ${ afterTrim.groin.length }, manifest and floor untouched, ` +
    `still wearing ${ trimmed.wardrobe.worn.join( ', ' ) }` );

/** Removes from a garment's DRAWN range every triangle near a set of body vertices. */
function trimGussetTriangles( mesh, bodyGeometry, bodyVertices ) {

    const positions = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const bodyPositions = bodyGeometry.attributes.position;

    const targets = bodyVertices.map( ( vertex ) =>
        [ bodyPositions.getX( vertex ), bodyPositions.getY( vertex ), bodyPositions.getZ( vertex ) ] );

    const kept = [];
    let removed = 0;

    for ( let offset = 0; offset < mesh.geometry.drawRange.count; offset += 3 ) {

        const corners = [ 0, 1, 2 ].map( ( corner ) => index.getX( offset + corner ) );
        const centre = [ 0, 1, 2 ].map( ( axis ) => corners.reduce( ( total, vertex ) =>
            total + [ positions.getX, positions.getY, positions.getZ ][ axis ].call( positions, vertex ), 0 ) / 3 );

        const near = targets.some( ( target ) =>
            Math.hypot( target[ 0 ] - centre[ 0 ], target[ 1 ] - centre[ 1 ], target[ 2 ] - centre[ 2 ] ) < 0.03 );

        if ( near ) {

            removed += 1;
            continue;

        }

        kept.push( corners[ 0 ], corners[ 1 ], corners[ 2 ] );

    }

    index.array.set( kept );
    mesh.geometry.setDrawRange( 0, kept.length );

    return removed;

}

// --- RED 4: the other way a region is decent, removed ----------------------------------------------------

/**
 * 🚩 **THE COUPLING BETWEEN `_UNDER_` AND `_HIDE_`, AND IT IS NOT A FREE LUNCH.**
 *
 * The foundation layer stops being drawn under an opaque outer garment, and that is only safe
 * because the same garment's hide mask removed the skin underneath. Take the hide mask away — a
 * build without `export_attributes`, or a manifest naming a mask the body does not carry — and the
 * avatar is fully dressed, `worn` is unchanged, nothing in the manifest moved, and 103 decency
 * vertices are bare: the foundation is occluded there and the skin is not.
 *
 * The measurement finds it. It is worth stating out loud because the two mechanisms look
 * independent and are not, and because the poke-through is why: only 27 of the 110 chest vertices
 * meet the suit along their own normal at all, so for 83 of them the suit is not covering
 * geometrically and never was.
 */
const unmasked = await wardrobeFor( manifestSource, {} );
await unmasked.wardrobe.dress( [ 'female_casualsuit01' ] );

const maskedExposure = exposureOf( unmasked.wardrobe, regions );

for ( const name of unmasked.wardrobe.availableHideMasks() ) {

    unmasked.wardrobe.hideAttributes.delete( name );

}

await unmasked.wardrobe.dress( [ 'female_casualsuit01' ] );
const unmaskedExposure = exposureOf( unmasked.wardrobe, regions );

record( totalExposed( maskedExposure ) === 0 && totalExposed( unmaskedExposure ) > 0,
    'RED 4: an outer garment that occludes the foundation but no longer hides the skin is caught',
    `with the mask ${ describeExposure( maskedExposure ) } exposed, without it ` +
    `${ describeExposure( unmaskedExposure ) } — same manifest, same worn set ` +
    `(${ unmasked.wardrobe.worn.join( ', ' ) }), body ${ unmasked.wardrobe.stats().bodyTriangles } ` +
    'triangles instead of 21,380' );

/**
 * And the invariant that makes the coupling structural rather than a coincidence: a garment can
 * only occlude the foundation layer if it carries a hide mask, because `_under_<id>` is written by
 * `build_figure.py` as a RENAME of `_hide_<id>` and cannot exist without it.
 *
 * Asserted over the shipped fragments rather than argued from the build script, because the
 * fragments are what ships.
 */
const occluders = new Set();

for ( const id of foundationIds ) {

    const fragment = await loadGltf( fileURLToPath( base.manifest.fragmentUrl( id, 'g050' ) ) );

    fragment.scene.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        for ( const name of Object.keys( object.geometry.attributes ) ) {

            if ( name.toLowerCase().startsWith( '_under_' ) === false ) continue;
            occluders.add( name.toLowerCase().replace( /^_under_/, '' ) );

        }

    } );

}

const occludersWithoutMask = [ ...occluders ]
    .filter( ( id ) => base.manifest.get( id )?.hideMask === null || base.manifest.get( id ) === undefined );

record( occluders.size > 0 && occludersWithoutMask.length === 0,
    'every garment that can occlude the foundation layer also deletes the skin under it',
    `${ [ ...occluders ].join( ', ' ) } — each declares a hideMask in the manifest` );

// --- summary --------------------------------------------------------------------------------------------

const failed = results.filter( ( result ) => result.ok === false );

console.log( '' );
console.log( '='.repeat( 78 ) );
console.log( failed.length === 0
    ? `PASS — ${ results.length } assertions.`
    : `FAIL — ${ failed.length } of ${ results.length }: ${ failed.map( ( result ) => result.label ).join( '; ' ) }` );

process.exit( failed.length === 0 ? 0 : 1 );
