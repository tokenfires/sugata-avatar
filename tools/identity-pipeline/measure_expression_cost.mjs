/**
 * What an identity costs an expression, measured on the SHIPPED figure rather than on the basemesh.
 *
 * 🚩 THE RISK THIS EXISTS TO SIZE. `research/identity-sculpting.md` §1.2 measured that identity and
 * ARKit compose with **exactly zero superposition error**, and then flagged that as the problem
 * rather than the reassurance: a blendshape is a fixed absolute displacement, so `jawOpen` travels
 * the same distance on a delicate face and a heavy one. An identity that changes the size of a gap
 * leaves the expression under- or over-shooting it. §1.2a put the worst single target at −1.543 mm
 * of a 15.50 mm blink and called the effect exactly linear in weight and exactly zero for
 * rigid-motion targets. **All of that was measured on the 19,158-vertex basemesh inside Blender.
 * None of it was measured on a figure the renderer would ever draw.**
 *
 * This measures it where it matters: `base.001` in `assets/figures/figure_g050.glb`, 14,517 glTF
 * positions, with the identity applied through `IdentityTargets` exactly as the runtime applies it.
 * The numbers are therefore NOT comparable to §1.2a's line for line, and the difference is not
 * noise — the research doc says so itself: peak `eyeBlinkLeft` vertical travel reads 15.50 mm on
 * the basemesh with helpers and 12.600 mm on the export, because the helper strip removes the
 * vertices that carried the peak. **Quote the number with its mesh.**
 *
 *
 * THE INSTRUMENT, AND WHAT IT IS NOT
 *
 * §1.2a's, transcribed, because three direct mesh-space closure instruments were written and
 * discarded before it (§7) and this is not the place to invent a fourth. A blendshape closes a gap
 * when the margin it drives, displaced by its own fixed delta, arrives at the margin it does not
 * drive. Identity moves both, so
 *
 *     closure error = identity's mean vertical displacement of the WEAKLY driven margin
 *                   − identity's mean vertical displacement of the STRONGLY driven margin
 *
 * with the two margins identified by the blendshape itself — strongly driven is |Δy| ≥ 75% of the
 * faceunit's own peak vertical travel, weakly driven is a NON-ZERO |Δy| ≤ 15% of it. The non-zero
 * qualifier is this file's, and it is load-bearing: on the exported mesh the ≤ 15% band would
 * otherwise sweep in all 12,000-odd vertices the morph does not touch at all, and the answer would
 * be a statistic about the shins.
 *
 * ⚠️ It measures a VERTICAL GAP between two blendshape-defined vertex sets. It does not prove the
 * lids meet in three dimensions, says nothing about the corners of the fissure, and cannot see a
 * lid that closes but folds wrongly. The correct instrument is a ray-cast against triangles or a
 * render, and building it is punch-list 10.3's job, not this file's.
 *
 * Usage:  node tools/identity-pipeline/measure_expression_cost.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { IdentityTargets, AXIS_GLTF } = await import( "../../packages/core/src/figure/IdentityTargets.js" );
const { IdentityCatalogue } = await import( "../../packages/core/src/figure/IdentityCatalogue.js" );

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO = path.resolve( HERE, "../.." );

const STRONGLY_DRIVEN = 0.75;
const WEAKLY_DRIVEN = 0.15;

/** The faceunits §1.2a reported, plus the two that carry the most travel. */
const FACEUNITS = [ "eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthClose", "mouthPucker" ];

/**
 * The identities to price. The first five are §1.2a's own set, so the shapes of the answers can be
 * compared even though the magnitudes cannot; the last three are what this pass adds — a whole
 * composed face identity, the same at a quarter, and the extreme the brief asked for.
 */
const IDENTITIES = {
    "eye-height2-incr @1.0": { "eyes/eye-height2-decr-incr": 1.0 },
    "eye-scale-incr @1.0": { "eyes/eye-scale-decr-incr": 1.0 },
    "eye-scale-decr @1.0": { "eyes/eye-scale-decr-incr": - 1.0 },
    "eye-trans-out @1.0": { "eyes/eye-trans-in-out": 1.0 },
    "head-scale-horiz-incr @1.0": { "head/head-scale-horiz-decr-incr": 1.0 },
    "face identity @1.0": {
        "eyes/eye-scale-decr-incr": 1.0, "chin/chin-height-decr-incr": - 1.0,
        "forehead/forehead-scale-vert-decr-incr": 1.0, "nose/nose-scale-horiz-decr-incr": - 1.0,
        "mouth/mouth-scale-horiz-decr-incr": 1.0, "head/head-oval": 1.0
    },
    "face identity @0.25": {
        "eyes/eye-scale-decr-incr": 0.25, "chin/chin-height-decr-incr": - 0.25,
        "forehead/forehead-scale-vert-decr-incr": 0.25, "nose/nose-scale-horiz-decr-incr": - 0.25,
        "mouth/mouth-scale-horiz-decr-incr": 0.25, "head/head-oval": 0.25
    }
};

// ---------------------------------------------------------------------------------------------

const catalogue = new IdentityCatalogue(
    JSON.parse( fs.readFileSync( path.join( REPO, "assets/identity/catalogue.json" ), "utf8" ) ) );

const targets = new IdentityTargets( catalogue, {
    baseUrl: "file:///",
    fetchBytes: async ( url ) => {
        const bytes = fs.readFileSync( path.join( REPO, "assets/identity", url.slice( "file:///".length ) ) );
        return bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.length );
    }
} );
await targets.loadRegions( catalogue.regions.filter( ( r ) => r.exposed ).map( ( r ) => r.id ) );

const manifest = JSON.parse( fs.readFileSync( path.join( REPO, "assets/identity/figure-vertex-map.json" ), "utf8" ) );
const mapBytes = fs.readFileSync( path.join( REPO, "assets/identity", manifest.bin ) );
const vertexMap = new Uint16Array( mapBytes.buffer.slice( mapBytes.byteOffset, mapBytes.byteOffset + mapBytes.length ) );
targets.useVertexMap( vertexMap );

// The extreme the brief asked for: every exposed slider in the eyes region hard over, both sides.
IDENTITIES[ "eyes region, every slider @1.0" ] = Object.fromEntries(
    catalogue.slidersIn( "eyes" ).map( ( s ) => [ s.id, 1.0 ] ) );

const morphs = readBodyMorphs( path.join( REPO, "assets/figures/figure_g050.glb" ) );

console.log( "\nmesh: base.001 of figure_g050.glb, 14,517 glTF positions "
    + "(NOT the 19,158-vertex basemesh research §1.2a measured)\n" );

console.log( "PEAK TRAVEL, on the shipped mesh, no identity\n" );
const peak = {};
for ( const unit of FACEUNITS ) {
    peak[ unit ] = peakTravel( morphs[ unit ] );
    console.log( `  ${ unit.padEnd( 16 ) } 3-D ${ peak[ unit ].magnitudeMm.toFixed( 3 ) } mm`
        + `   vertical ${ peak[ unit ].verticalMm.toFixed( 3 ) } mm` );
}

console.log( "\nTRAVEL INVARIANCE — does identity change what the morph does?\n" );
for ( const [ label, values ] of Object.entries( IDENTITIES ) ) {
    // A morph target is stored as a delta and applied to whatever the base positions are, so this
    // is arithmetic rather than an experiment — but it is the arithmetic the whole risk rests on,
    // and it costs nothing to show it holding on the actual buffer.
    const stack = catalogue.resolve( values );
    const base = new Float64Array( manifest.positionCount * 3 );
    targets.apply( base, stack, { axis: AXIS_GLTF } );
    const worst = Math.max( ...FACEUNITS.map( ( unit ) => Math.abs( peakTravel( morphs[ unit ] ).magnitudeMm - peak[ unit ].magnitudeMm ) ) );
    console.log( `  ${ label.padEnd( 30 ) } worst change in peak travel ${ worst.toFixed( 6 ) } mm` );
}

console.log( "\nCLOSURE ERROR — how much of the gap the fixed delta now fails to cross\n" );
console.log( "  identity".padEnd( 34 ) + FACEUNITS.map( ( u ) => u.padStart( 16 ) ).join( "" ) );

for ( const [ label, values ] of Object.entries( IDENTITIES ) ) {

    const stack = catalogue.resolve( values );
    const displacement = new Float64Array( manifest.positionCount * 3 );
    targets.apply( displacement, stack, { axis: AXIS_GLTF } );

    const row = FACEUNITS.map( ( unit ) => {
        const error = closureErrorMm( morphs[ unit ], displacement, peak[ unit ].verticalMm );
        const percent = ( 100 * error / peak[ unit ].verticalMm ).toFixed( 1 );
        return `${ error >= 0 ? "+" : "" }${ error.toFixed( 3 ) } (${ percent }%)`.padStart( 16 );
    } );

    console.log( `  ${ label.padEnd( 32 ) }${ row.join( "" ) }` );

}

console.log( "\nmm of residual gap, and % of that faceunit's own peak VERTICAL travel." );
console.log( "positive = the margins overlap and the lid drives through itself." );
console.log( "negative = the lid no longer reaches, by that many mm.\n" );

// ---------------------------------------------------------------------------------------------

function peakTravel( delta ) {

    let magnitude = 0, vertical = 0;

    for ( let i = 0; i < delta.length / 3; i ++ ) {
        const dx = delta[ i * 3 ], dy = delta[ i * 3 + 1 ], dz = delta[ i * 3 + 2 ];
        magnitude = Math.max( magnitude, Math.hypot( dx, dy, dz ) );
        vertical = Math.max( vertical, Math.abs( dy ) );
    }

    return { magnitudeMm: magnitude * 1000, verticalMm: vertical * 1000 };

}

function closureErrorMm( delta, displacement, peakVerticalMm ) {

    const peakVertical = peakVerticalMm / 1000;
    let strongSum = 0, strongCount = 0, weakSum = 0, weakCount = 0;

    for ( let i = 0; i < delta.length / 3; i ++ ) {

        const dy = Math.abs( delta[ i * 3 + 1 ] );
        if ( dy === 0 ) continue;

        if ( dy >= STRONGLY_DRIVEN * peakVertical ) { strongSum += displacement[ i * 3 + 1 ]; strongCount ++; }
        else if ( dy <= WEAKLY_DRIVEN * peakVertical ) { weakSum += displacement[ i * 3 + 1 ]; weakCount ++; }

    }

    if ( strongCount === 0 || weakCount === 0 ) return NaN;

    return ( weakSum / weakCount - strongSum / strongCount ) * 1000;

}

/** Every named morph target of the body mesh, as a dense per-position delta array. */
function readBodyMorphs( glbPath ) {

    const file = fs.readFileSync( glbPath );
    const jsonLength = file.readUInt32LE( 12 );
    const gltf = JSON.parse( file.subarray( 20, 20 + jsonLength ).toString( "utf8" ) );
    const binStart = 20 + jsonLength + 8;

    const mesh = gltf.meshes.find( ( m ) => m.name === "base.001" );
    const primitive = mesh.primitives[ 0 ];
    const names = mesh.extras.targetNames;

    const bytesOf = ( bufferViewIndex, byteOffset, length ) => {
        const view = gltf.bufferViews[ bufferViewIndex ];
        const at = binStart + ( view.byteOffset ?? 0 ) + byteOffset;
        return file.buffer.slice( file.byteOffset + at, file.byteOffset + at + length );
    };

    /**
     * 🚩 Every morph target in this figure is a SPARSE accessor with no base bufferView — 2,194 of
     * 14,517 positions for the first one. Reading `accessor.bufferView` and finding it undefined
     * returns an all-zero array that looks exactly like a morph that does nothing, which is how
     * this file first reported jawOpen's peak travel as 0.000 mm. The zero was the reader, not the
     * figure.
     */
    const read = ( accessorIndex ) => {

        const accessor = gltf.accessors[ accessorIndex ];
        const dense = new Float32Array( accessor.count * 3 );

        if ( accessor.bufferView !== undefined ) {
            dense.set( new Float32Array( bytesOf( accessor.bufferView, accessor.byteOffset ?? 0, accessor.count * 12 ) ) );
        }

        if ( accessor.sparse ) {

            const { count, indices, values } = accessor.sparse;
            const indexBytes = indices.componentType === 5125 ? 4 : indices.componentType === 5123 ? 2 : 1;
            const indexBuffer = bytesOf( indices.bufferView, indices.byteOffset ?? 0, count * indexBytes );
            const sparseIndices = indexBytes === 4 ? new Uint32Array( indexBuffer )
                : indexBytes === 2 ? new Uint16Array( indexBuffer ) : new Uint8Array( indexBuffer );
            const sparseValues = new Float32Array( bytesOf( values.bufferView, values.byteOffset ?? 0, count * 12 ) );

            for ( let i = 0; i < count; i ++ ) {
                const at = sparseIndices[ i ] * 3;
                dense[ at ] = sparseValues[ i * 3 ];
                dense[ at + 1 ] = sparseValues[ i * 3 + 1 ];
                dense[ at + 2 ] = sparseValues[ i * 3 + 2 ];
            }

        }

        return dense;

    };

    const morphs = {};
    primitive.targets.forEach( ( target, i ) => { morphs[ names[ i ] ] = read( target.POSITION ); } );
    return morphs;

}
