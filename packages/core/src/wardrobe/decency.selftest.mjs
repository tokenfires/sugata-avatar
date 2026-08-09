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
 *      by reading the code: the change is STARTED BUT NOT AWAITED, and the live scene is sampled
 *      on every turn of the event loop until it settles, each sample through the same measurement.
 *      ⚠️ The hook point is the YIELD, not the fragment load. Hooking the loader instead — which
 *      is what this file shipped with — left the strip-back-to-the-floor transition sampled zero
 *      times while the gate's own message counted it as covered. See the section comment.
 *
 * ## PROVEN RED SIX WAYS, IN THREE DIFFERENT MECHANISMS
 *
 * 🚩 A gate that only catches its own known-bad is decorative, so each half of the measurement —
 * and the sampler that decides which states the measurement is even pointed at — is broken alone:
 *
 * *bookkeeping — the wrong garments are worn:*
 *   1. a foundation piece REMOVED FROM THE MANIFEST — the red the punch list names;
 *   2. the floor emptied, which is what a `decencyFloor` returning `[]` does;
 *
 * *geometry — the right garments are worn and the skin is still visible:*
 *   3. a foundation garment whose GEOMETRY IS TRIMMED at the gusset, manifest untouched, floor
 *      untouched, every id present — only the ray cast can see this one;
 *   4. an outer garment whose hide mask is dropped, which does not undress the avatar but removes
 *      the OTHER way a region can be decent, and is the mechanism clause (a) exists for.
 *
 * *coverage — the measurement is correct and is looking at nothing:*
 *   5. the mid-change sampler hooked to the fragment LOADER, blind to any change that loads
 *      nothing because every fragment it needs is already cached. This is the defect that shipped;
 *   6. the mid-change sampler hooked to the right thing but woken only on MACROTASKS, blind to any
 *      change whose only yields are microtasks. Same silent zero, a different cause.
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

/**
 * Which body vertices are still drawn — everything else was removed by a worn garment's hide mask.
 *
 * The complement is what the caller cares about, so read the call site as "drawn, and therefore
 * still capable of being indecent".
 */
function drawnBodyVertices( wardrobe ) {

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

    const drawn = drawnBodyVertices( wardrobe );
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
 * OBSERVED rather than read.
 *
 * ⚠️ **THE HOOK POINT IS THE YIELD, NOT THE LOAD, AND GETTING THAT WRONG COST THIS GATE ITS TEETH.**
 *
 * The sampler used to live inside the instrumented loader, which made it blind to precisely the
 * transition it most needed to watch. `Wardrobe` caches fragments, so a change that puts nothing
 * NEW on loads nothing, calls the loader zero times, and was therefore sampled zero times.
 *
 * Measured on the five-change list this file shipped with, by counting samples per change:
 * **6, 6, 3, 3, 0**. The zero was the strip from a full outfit back to the foundation floor — the
 * one change with nothing but the floor between the avatar and bare skin, and so the one where a
 * decency failure is most likely. The gate's own message read "across 5 outfit changes". It had
 * covered 4, and nothing in it could tell the difference.
 *
 * The fix is to stop inferring the yield from the load. The change is started and not awaited, and
 * the scene is sampled on every turn of the event loop until the change settles. A sixth change was
 * added at the same time — a pure removal from a dressed state — so the blind class is represented
 * more than once and cannot be re-broken by editing a single line of the list.
 *
 * **Both kinds of turn are load-bearing, in opposite directions:**
 *
 *   * a MACROTASK turn is where a frame can actually be painted, so a change spanning one is a
 *     change a user could see half of. `macrotaskSpanningLoader` spreads each fetch over three of
 *     them deliberately, because a real network fetch does.
 *   * a MICROTASK turn is the ONLY yield a fully-cached change has. No frame is painted inside one,
 *     so a cached change is atomic with respect to the renderer — but it is not atomic with respect
 *     to other JavaScript, and a sampler woken only on macrotasks reports zero samples for it and
 *     calls that a pass. That is RED 6.
 *
 * Alternating the two is also what stops the observer deadlocking: a microtask-only spin would
 * starve the timer queue the loader is waiting on, and the loop would never terminate.
 */

/** One sample of the live scene, through the same decency measurement as every other state here. */
function sampleScene( wardrobe ) {

    return {
        worn: [ ...wardrobe.wornMeshes.keys() ],
        bodyVisible: wardrobe.body.visible,
        exposed: totalExposed( exposureOf( wardrobe, regions ) )
    };

}

/**
 * A fragment load that spans three macrotasks, so a real frame could be drawn part-way through it.
 *
 * `onTick` exists only for RED 5, which reconstructs the load-coupled sampler this file shipped
 * with. Nothing on the green path samples from inside it — that coupling is the defect.
 */
function macrotaskSpanningLoader( onTick = null ) {

    return async ( url ) => {

        for ( let tick = 0; tick < 3; tick += 1 ) {

            await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
            if ( onTick !== null ) onTick();

        }

        return loadFragmentFromDisk( url );

    };

}

/**
 * How many microtask turns the observer takes before letting the timer queue have one.
 *
 * ⚠️ **A FLOOR, NOT A TUNING KNOB.** Set it below what a cached change yields and the observer
 * silently degrades back towards the defect — at 1, the two cached changes are seen ONCE each. Set
 * it far above and every extra turn lands on a change that is waiting for a timer, re-measuring a
 * scene that has not moved. Swept on this build, this machine, 2026-08-09, every row re-derived
 * together against the file as it stands:
 *
 *     burst | the 2 cached | the 4 that load  | wall   | the saturation clause
 *     ------|--------------|------------------|--------|----------------------
 *        1  |     1, 1     |  11, 13,  7,  7  | 1.81 s | RED
 *        2  |     2, 2     |  17, 17,  8,  8  | 1.82 s | RED
 *        3  |     3, 3     |  23, 23, 11, 11  | 1.76 s | RED
 *        4  |     4, 3     |  29, 29, 14, 14  | 1.91 s | green — saturation
 *        5  |     4, 3     |  35, 35, 17, 17  | 2.18 s | green
 *      → 8  |     4, 3     |  53, 53, 26, 26  | 2.54 s | green — chosen
 *       16  |     4, 3     | 101, 101, 50, 50 | 3.49 s | green
 *       32  |     4, 3     | 197, 197, 98, 98 | 5.94 s | green
 *
 * **Saturation is at 4 and the value below is 8** — 2× margin, bought for 0.6 s. The margin is the
 * point, not caution: the yield depth of a cached `dress()` belongs to `Wardrobe` and to V8's
 * `await` desugaring, and neither is this file's to pin.
 *
 * 🚩 **HOW MUCH THAT MOVES, MEASURED THE HARD WAY.** An earlier draft of this table read saturation
 * at 3. Adding a single `.catch()` to the observer's own promise chain — a correctness fix in
 * `dressWhileObserving`, nothing to do with `Wardrobe` — put one more microtask in the chain and
 * moved saturation to 4. A constant sitting exactly ON saturation is a constant that goes red on a
 * change that has nothing to do with it.
 *
 * That is also the whole argument for asserting the saturation rather than recording it. The wall
 * column is indicative, noisy at the low end, and nothing asserts on it; the cached column is the
 * subject, and the clause "doubling the burst observes a cached change no more times" re-derives it
 * on every run. Proven: at 1, 2 and 3 that clause goes RED; from 4 up it is green.
 */
const MICROTASK_BURST = 8;

/**
 * Starts one change and calls `take` on every turn of the event loop until the change settles.
 *
 * Returns how many turns it observed — the number this gate has to assert on, because a zero here
 * is the gate measuring nothing and reporting a pass.
 *
 * @param {boolean} [options.microtaskTurns] - false wakes on macrotasks only. RED 6 uses that.
 * @param {number} [options.microtaskBurst] - overridden only to prove the default has saturated.
 */
async function dressWhileObserving( wardrobe, outfit, take,
    { microtaskTurns = true, microtaskBurst = MICROTASK_BURST } = {} ) {

    let settled = false;
    let taken = 0;
    let failure = null;

    // The rejection is caught HERE rather than at the `await` below, because the loop can span many
    // turns and an unhandled rejection that old is a process-level crash in Node — which would look
    // like an infrastructure fault rather than the refused outfit it is. Rethrown after the loop, so
    // a caller still sees `dress()` throw exactly as it would have.
    const pending = wardrobe.dress( outfit )
        .catch( ( error ) => { failure = error; } )
        .finally( () => { settled = true; } );

    for ( let turn = 0; settled === false; turn += 1 ) {

        // Exhaust the microtask turns first — they are the only yields a fully-cached change has —
        // then hand the timer queue one, or a change waiting on a fetch would spin here forever.
        const microtaskTurn = microtaskTurns && ( turn % ( microtaskBurst + 1 ) ) !== microtaskBurst;

        if ( microtaskTurn ) await Promise.resolve();
        else await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

        if ( settled ) break;

        take( wardrobe );
        taken += 1;

    }

    await pending;

    if ( failure !== null ) throw failure;

    return taken;

}

/**
 * The changes, chosen so both classes are present. The first four each pull at least one fragment
 * off disk; the last two cannot, because by then everything they name is cached — one removes
 * garments and adds none, the other strips to the floor. Those last two ARE the class the old
 * sampler never saw, and there are deliberately two of them.
 *
 * Which are which is measured by `countTurnsPerChange`, not asserted here, so this comment cannot
 * quietly stop being true.
 */
const changes = [
    [],
    [ 'female_casualsuit01', 'shoes01' ],
    [ 'fedora01' ],
    [ 'female_elegantsuit01', 'shoes01', 'fedora01' ],
    [ 'female_elegantsuit01' ],
    []
];

function nameOf( change ) {

    return change.join( '+' ) || 'undress';

}

function describeCounts( counts ) {

    return counts.map( ( entry ) => `${ entry.name } ${ entry.taken }` ).join( ', ' );

}

/**
 * Runs the whole change list on a fresh wardrobe and returns how many turns each change was
 * observed for, without the ray cast — what is under test here is WHETHER a turn was seen.
 *
 * 🎯 It also measures, rather than declares, which changes loaded nothing. "The cached ones" is
 * the whole subject of this section, and a hand-maintained list of which those are would rot the
 * first time the change list moved.
 */
async function countTurnsPerChange( options = {} ) {

    let loaded = 0;

    const spanning = macrotaskSpanningLoader();

    const run = await wardrobeFor( manifestSource, {}, {
        loadFragment: ( url ) => { loaded += 1; return spanning( url ); }
    } );

    const counts = [];

    for ( const change of changes ) {

        const before = loaded;
        const taken = await dressWhileObserving( run.wardrobe, change, () => {}, options );

        counts.push( { name: nameOf( change ), taken, cached: loaded === before } );

    }

    return counts;

}

const samples = [];
const perChange = [];

const transitions = await wardrobeFor( manifestSource, {}, { loadFragment: macrotaskSpanningLoader() } );

for ( const change of changes ) {

    const taken = await dressWhileObserving( transitions.wardrobe, change,
        ( wardrobe ) => samples.push( sampleScene( wardrobe ) ) );

    perChange.push( { name: nameOf( change ), taken } );

}

// 🚩 THE CLAUSE THAT WAS MISSING, AND IT IS A §1.25a CHECK ON THE GATE'S OWN INPUT RATHER THAN ON
// ITS SUBJECT — the same shape as the region-size clause above. "18 samples across 5 changes" is a
// coverage claim, and a coverage claim has to be measured per change or it is an average hiding a
// zero. Every clause below this one is only worth as much as this one.
const unobserved = perChange.filter( ( entry ) => entry.taken === 0 );

record( unobserved.length === 0,
    'every outfit change was actually observed — no change contributed zero samples',
    unobserved.length === 0
        ? describeCounts( perChange )
        : `${ unobserved.length } of ${ changes.length } unobserved: ` +
          `${ unobserved.map( ( entry ) => entry.name ).join( ', ' ) }` );

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

// Read, not declared. PROGRESS.md quotes 21,380 for the suit alone; a literal here would be a
// second copy of that number free to drift away from the build without anything noticing.
const maskedBodyTriangles = unmasked.wardrobe.stats().bodyTriangles;

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
    `triangles instead of ${ maskedBodyTriangles }` );

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

// --- RED 5 and 6: the sampler blinded, twice, by two unrelated causes ------------------------------------

/**
 * 🚩 **A THIRD CLASS, AND THE ONLY ONE THAT MAKES EVERY OTHER CLAUSE WORTHLESS WITHOUT SAYING SO.**
 *
 * Reds 1–4 break the measurement: the wrong garments are worn, or the right ones are and the skin
 * still shows. Both leave the gate reading a real state and reporting the truth about it.
 *
 * These two break the COVERAGE. The measurement is untouched and correct. What changes is which
 * states it is ever pointed at — and a sampler that observes nothing reports zero indecent samples,
 * which reads identically to a pass. This file shipped in exactly that condition, so the two causes
 * below are deliberately unrelated to each other:
 *
 *   * RED 5 hooks the sampler to the wrong EVENT. The load is a proxy for the yield and the proxy
 *     is exact only while nothing is cached.
 *   * RED 6 hooks it to the right event at the wrong GRANULARITY. A cached change's only yields are
 *     microtasks, and an observer that wakes on timers has already missed the whole change.
 *
 * Both are run over the same `changes` list as the green path, and both are asserted against the
 * same `taken === 0` predicate the green clause uses, so what is proven is that the new clause goes
 * red — not merely that the counts differ.
 */
// RED 5: the sampler this file shipped with, reconstructed. It counts a turn only from inside the
// loader, so a change that loads nothing counts nothing.
const loadCoupled = [];

const loadCoupledRun = await wardrobeFor( manifestSource, {}, {
    loadFragment: macrotaskSpanningLoader( () => { loadCoupled.at( -1 ).taken += 1; } )
} );

for ( const change of changes ) {

    loadCoupled.push( { name: nameOf( change ), taken: 0 } );
    await loadCoupledRun.wardrobe.dress( change );

}

// RED 6: the right hook, woken only on macrotasks. A fully-cached change resolves inside the
// microtask drain that runs before the first timer callback, so the observer wakes to a settled
// change and takes nothing.
//
// ⚠️ The counts for the changes that LOAD jitter by ±1 between runs — they depend on how the
// observer's own timers interleave with the loader's, which is wall-clock. The zeros do not: they
// are structural, and 6 consecutive runs measured 0 for both cached changes every time. The clause
// asserts only on the zeros, so this red does not flake.
const macrotaskOnly = await countTurnsPerChange( { microtaskTurns: false } );

const blindToLoader = loadCoupled.filter( ( entry ) => entry.taken === 0 );

record( blindToLoader.length > 0,
    'RED 5: a sampler hooked to the fragment LOADER is blind to a change that loads nothing',
    blindToLoader.length > 0
        ? `${ describeCounts( loadCoupled ) } — ${ blindToLoader.length } of ${ loadCoupled.length } ` +
          `unobserved (${ blindToLoader.map( ( entry ) => entry.name ).join( ', ' ) }), so the ` +
          'coverage clause goes red'
        : 'it observed every change — this red no longer reproduces the defect it names' );

const blindToMacrotasks = macrotaskOnly.filter( ( entry ) => entry.taken === 0 );

record( blindToMacrotasks.length > 0,
    'RED 6: a sampler woken only on MACROTASKS is blind to a change that yields only microtasks',
    blindToMacrotasks.length > 0
        ? `${ describeCounts( macrotaskOnly ) } — ${ blindToMacrotasks.length } of ` +
          `${ macrotaskOnly.length } unobserved, a different cause and the same silent zero`
        : 'it observed every change — this red no longer reproduces the defect it names' );

// 🎯 The half that stops reds 5 and 6 being a test of the word "cached": the sampler this file now
// uses sees those same changes on the same wardrobe shape, so what differs above is the sampler.
record( perChange.every( ( entry ) => entry.taken > 0 ),
    'RED 5b/6b: and the sampler this file now uses observes every one of those same changes',
    describeCounts( perChange ) );

// --- and the constant that decides whether the observer is deep enough ------------------------------------

/**
 * 🚩 `MICROTASK_BURST` is the one number in this section that could quietly re-create the defect —
 * too small and a cached change is observed fewer times than it yields, which is the same blindness
 * as RED 6 with a smaller radius. A comment saying "4 was enough when I measured it" is exactly the
 * kind of claim this repo has been burned by, so the saturation is asserted instead of recorded:
 * DOUBLE the burst, and a cached change must be observed the same number of times.
 *
 * Only the cached changes are compared. A change that loads spends its time in the timer queue, so
 * its count depends on how long the loop's own work takes and is not a property of the burst.
 */
const atBurst = await countTurnsPerChange();
const atDoubleBurst = await countTurnsPerChange( { microtaskBurst: MICROTASK_BURST * 2 } );

// Paired by position before filtering, so a failure can name the change and both of its counts —
// once these are filtered down, the array index no longer points at the change it came from.
const paired = atBurst.map( ( entry, at ) => ( { ...entry, doubled: atDoubleBurst[ at ].taken } ) );

const cachedChanges = paired.filter( ( entry ) => entry.cached );
const burstBound = cachedChanges.filter( ( entry ) => entry.taken !== entry.doubled );

function describeSaturation() {

    if ( cachedChanges.length === 0 ) {

        return 'no change in the list loaded nothing, so this clause proved nothing — add one';

    }

    if ( burstBound.length > 0 ) {

        return `the burst IS what bounds ${ burstBound.map( ( entry ) =>
            `${ entry.name } ${ entry.taken } -> ${ entry.doubled }` ).join( ', ' ) } — ` +
            `raise MICROTASK_BURST above ${ MICROTASK_BURST } until doubling it changes nothing`;

    }

    return `${ cachedChanges.length } cached changes ` +
        `(${ describeCounts( cachedChanges ) }) unchanged at a burst of ${ MICROTASK_BURST * 2 }`;

}

record( cachedChanges.length > 0 && burstBound.length === 0,
    `a burst of ${ MICROTASK_BURST } has saturated — doubling it observes a cached change no more times`,
    describeSaturation() );

// --- summary --------------------------------------------------------------------------------------------

const failed = results.filter( ( result ) => result.ok === false );

console.log( '' );
console.log( '='.repeat( 78 ) );
console.log( failed.length === 0
    ? `PASS — ${ results.length } assertions.`
    : `FAIL — ${ failed.length } of ${ results.length }: ${ failed.map( ( result ) => result.label ).join( '; ' ) }` );

process.exit( failed.length === 0 ? 0 : 1 );
