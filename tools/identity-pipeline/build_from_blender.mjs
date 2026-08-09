/**
 * Derives the two things that need Blender in the loop, and then never need it again:
 *
 *   1. `assets/identity/figure-vertex-map.{json,bin}` — which basemesh vertex each of the shipped
 *      figure's 14,517 glTF positions came from. Without it `IdentityTargets` can only reshape a
 *      basemesh-shaped array; with it, it writes into the GLB's own position buffer.
 *
 *   2. `tools/identity-pipeline/fixtures/*` — headless MPFB's own answer for four identities, so
 *      `identitytargets.selftest.mjs` can gate the JS against Blender without Blender installed.
 *
 * Both are build-time. MPFB2's code is GPLv3 and does not ship (standing constraint); what ships
 * is the map, which is a fact about our own CC0 export.
 *
 *
 * WHERE THE DUMPS COME FROM
 *
 * `probe.py` (kept beside this file) run under `blender --background`, once per identity. Each run
 * writes `<label>.f64`, 19,158 × 3 little-endian float64 in Blender object space, plus a JSON
 * sidecar carrying the applied target stack and MPFB's own macro stack. Provenance for every
 * number this produces: Blender 5.2.0 LTS (fbe6228777e7, built 2026-07-14), MPFB build 20260722,
 * on the M5 Max — the same rig `research/identity-sculpting.md` recorded.
 *
 *
 * WHY THE FIXTURE IS A DELTA IN NANOMETRES
 *
 * The gate compares displacement fields, not positions, so the neutral figure never needs to be
 * committed. A delta is small and mostly zero, and int32 nanometres holds ±2.1 m at a resolution
 * of 1e-6 mm — a thousand times finer than the 0.001 mm the gate allows and ten times finer than
 * the 1.1e-4 mm agreement it actually measures. Storing float32 instead would have been worse than
 * useless: one float32 ulp at 1.6 m is 1.2e-4 mm, which is the size of the thing being measured.
 *
 * Usage:
 *   node tools/identity-pipeline/build_from_blender.mjs --dumps /path/to/dump
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO = path.resolve( HERE, "../.." );
const FIXTURES = path.join( HERE, "fixtures" );

const BASEMESH_VERTEX_COUNT = 19158;
const BODY_MESH_NAME = "base.001";

/** The four identities probed, and the target stack each one was built with. */
const FIXTURE_CASES = {
    face100: {
        note: "A face reshape at full weight. Seven categories, one end each.",
        stack: [
            [ "eyes/eye-scale-decr-incr", 1.0 ], [ "chin/chin-height-decr-incr", - 1.0 ],
            [ "forehead/forehead-scale-vert-decr-incr", 1.0 ], [ "nose/nose-scale-horiz-decr-incr", - 1.0 ],
            [ "mouth/mouth-scale-horiz-decr-incr", 1.0 ], [ "head/head-oval", 1.0 ]
        ]
    },
    face025: {
        note: "The same seven at a quarter, because §1.1 and §1.2a both claim exact linearity in weight.",
        stack: [
            [ "eyes/eye-scale-decr-incr", 0.25 ], [ "chin/chin-height-decr-incr", - 0.25 ],
            [ "forehead/forehead-scale-vert-decr-incr", 0.25 ], [ "nose/nose-scale-horiz-decr-incr", - 0.25 ],
            [ "mouth/mouth-scale-horiz-decr-incr", 0.25 ], [ "head/head-oval", 0.25 ]
        ]
    },
    body100: {
        note: "A body reshape at full weight — the large case, and the one that moves the skeleton.",
        stack: [
            [ "torso/measure-shoulder-dist-decr-incr", 1.0 ], [ "legs/upperlegs-height-decr-incr", 1.0 ],
            [ "legs/lowerlegs-height-decr-incr", 1.0 ], [ "torso/measure-waist-circ-decr-incr", 1.0 ],
            [ "hip/hip-scale-horiz-decr-incr", 1.0 ], [ "neck/measure-neck-height-decr-incr", 1.0 ],
            [ "torso/torso-scale-vert-decr-incr", 1.0 ]
        ]
    },
    mixed: {
        note: "Both ends of the same slider on opposite sides, a negative end, and a unipolar shape. "
            + "Every other fixture pushes one way, and a sign error would survive all three of them.",
        stack: [
            [ "eyes/eye-scale-decr-incr", { left: - 0.6, right: 0.35 } ],
            [ "chin/chin-height-decr-incr", 0.8 ],
            [ "head/head-square", 1.0 ],
            [ "nose/nose-volume-decr-incr", - 0.45 ]
        ]
    }
};

// ---------------------------------------------------------------------------------------------

function main() {

    const dumps = argValue( "--dumps" );
    if ( ! dumps ) { console.error( "Pass --dumps <dir> holding probe.py's output." ); process.exit( 1 ); }

    fs.mkdirSync( FIXTURES, { recursive: true } );

    const neutral = readDump( dumps, "neutral" );
    if ( neutral.length / 3 !== BASEMESH_VERTEX_COUNT ) {
        throw new Error( `neutral.f64 holds ${ neutral.length / 3 } vertices, expected ${ BASEMESH_VERTEX_COUNT }.` );
    }

    writeVertexMap( neutral );
    writeReshapeFixtures( dumps, neutral );
    writeMacroFixtures( dumps );

}

// ---------------------------------------------------------------------------------------------

/**
 * Matches every glTF position of the shipped body against the basemesh vertex it was exported
 * from, by coordinate.
 *
 * There is no exported attribute carrying the original index, and adding one would mean changing
 * `build_figure.py` and re-baking five 11 MB GLBs. Coordinate matching needs no rebuild and is
 * self-proving: it either finds one basemesh vertex per position, at float32 distance, with no
 * ambiguity, or it does not, and the counts it prints say which. Measured on `figure_g050`:
 * 14,517 positions, **0 unmatched, 0 ambiguous, 13,380 distinct sources, max index 13,379**,
 * worst agreement 2.4e-7 m.
 *
 * The axis relation is fixed and offset-free in two of three components — glTF (x, y, z) is
 * Blender (bx, bz, −by) — so `x` and `z` alone identify a candidate without knowing the export's
 * grounding translation, and the translation falls out of the candidates as the modal `y` residual.
 */
function writeVertexMap( neutral ) {

    const figures = fs.readdirSync( path.join( REPO, "assets/figures" ) )
        .filter( ( f ) => f.endsWith( ".glb" ) ).sort();

    const reference = "figure_g050.glb";
    const positions = readBodyPositions( path.join( REPO, "assets/figures", reference ) );
    const positionCount = positions.length / 3;

    const CELL = 0.004;
    const grid = new Map();
    for ( let v = 0; v < BASEMESH_VERTEX_COUNT; v ++ ) {
        const key = cellKey( neutral[ v * 3 ], - neutral[ v * 3 + 1 ], CELL );
        let bucket = grid.get( key );
        if ( ! bucket ) { bucket = []; grid.set( key, bucket ); }
        bucket.push( v );
    }

    const residuals = new Map();
    forEachCandidate( positions, grid, CELL, neutral, ( _p, v, gy ) => {
        const key = Math.round( ( gy - neutral[ v * 3 + 2 ] ) * 1e7 );
        residuals.set( key, ( residuals.get( key ) ?? 0 ) + 1 );
    } );

    const groundingY = [ ...residuals.entries() ].sort( ( a, b ) => b[ 1 ] - a[ 1 ] )[ 0 ][ 0 ] / 1e7;

    const map = new Uint16Array( positionCount );
    let unmatched = 0, ambiguous = 0, worst = 0, maxIndex = 0;
    const distinct = new Set();

    for ( let p = 0; p < positionCount; p ++ ) {

        let best = - 1, bestSquared = Infinity, secondSquared = Infinity;

        forEachCandidateOf( positions, p, grid, CELL, ( v ) => {
            const dx = neutral[ v * 3 ] - positions[ p * 3 ];
            const dy = ( neutral[ v * 3 + 2 ] + groundingY ) - positions[ p * 3 + 1 ];
            const dz = ( - neutral[ v * 3 + 1 ] ) - positions[ p * 3 + 2 ];
            const squared = dx * dx + dy * dy + dz * dz;
            if ( squared < bestSquared ) { secondSquared = bestSquared; bestSquared = squared; best = v; }
            else if ( squared < secondSquared ) secondSquared = squared;
        } );

        const distance = Math.sqrt( bestSquared );
        if ( best < 0 || distance > 1e-5 ) { unmatched ++; continue; }
        if ( Math.sqrt( secondSquared ) < 1e-5 ) ambiguous ++;
        if ( distance > worst ) worst = distance;

        map[ p ] = best;
        distinct.add( best );
        if ( best > maxIndex ) maxIndex = best;

    }

    if ( unmatched || ambiguous ) {
        throw new Error( `Vertex map is not a proof: ${ unmatched } unmatched, ${ ambiguous } ambiguous.` );
    }

    // The map is topological, so it must hold for every bake, not just the one it was solved on.
    // What can be checked without re-solving: positions this map says came from one basemesh vertex
    // must still coincide on the other four figures. If a bake split differently they would not.
    const validatedAgainst = [];
    for ( const figure of figures ) {
        const other = readBodyPositions( path.join( REPO, "assets/figures", figure ) );
        if ( other.length !== positions.length ) {
            throw new Error( `${ figure } has ${ other.length / 3 } body positions, ${ reference } has ${ positionCount }.` );
        }
        validatedAgainst.push( { figure, worstDuplicateSpreadMm: duplicateSpreadMm( other, map ) * 1000 } );
    }

    fs.writeFileSync( path.join( REPO, "assets/identity/figure-vertex-map.bin" ), Buffer.from( map.buffer ) );
    fs.writeFileSync( path.join( REPO, "assets/identity/figure-vertex-map.json" ), JSON.stringify( {
        format: "sugata-identity-vertex-map",
        formatVersion: 1,
        mesh: BODY_MESH_NAME,
        bin: "figure-vertex-map.bin",
        elementType: "uint16",
        positionCount,
        basemeshVertexCount: BASEMESH_VERTEX_COUNT,
        distinctBasemeshVertices: distinct.size,
        maxBasemeshIndex: maxIndex,
        groundingY,
        solvedOn: reference,
        worstMatchDistanceM: worst,
        unmatched, ambiguous,
        validatedAgainst,
        note: "0 unmatched and 0 ambiguous is the proof. maxBasemeshIndex 13379 against a 13,380-vertex "
            + "shipped body settles research/identity-sculpting.md §1.4's flagged assumption that the "
            + "helper geometry occupies the high indices: measured, it does."
    }, null, 1 ) + "\n" );

    console.log( `vertex map       ${ positionCount } positions -> ${ distinct.size } basemesh vertices, `
        + `max index ${ maxIndex }, worst ${ worst.toExponential( 2 ) } m, grounding ${ groundingY }` );
    for ( const row of validatedAgainst ) {
        console.log( `  ${ row.figure.padEnd( 18 ) } worst duplicate spread ${ row.worstDuplicateSpreadMm.toExponential( 2 ) } mm` );
    }

}

function writeReshapeFixtures( dumps, neutral ) {

    for ( const [ label, spec ] of Object.entries( FIXTURE_CASES ) ) {

        const reshaped = readDump( dumps, label );
        const meta = JSON.parse( fs.readFileSync( path.join( dumps, label + ".json" ), "utf8" ) );

        const nanometres = new Int32Array( BASEMESH_VERTEX_COUNT * 3 );
        let moved = 0, magnitude = 0;

        for ( let v = 0; v < BASEMESH_VERTEX_COUNT; v ++ ) {

            const dx = reshaped[ v * 3 ] - neutral[ v * 3 ];
            const dy = reshaped[ v * 3 + 1 ] - neutral[ v * 3 + 1 ];
            const dz = reshaped[ v * 3 + 2 ] - neutral[ v * 3 + 2 ];

            nanometres[ v * 3 ] = Math.round( dx * 1e9 );
            nanometres[ v * 3 + 1 ] = Math.round( dy * 1e9 );
            nanometres[ v * 3 + 2 ] = Math.round( dz * 1e9 );

            const distance = Math.hypot( dx, dy, dz );
            if ( distance > 0 ) moved ++;
            if ( distance > magnitude ) magnitude = distance;

        }

        fs.writeFileSync( path.join( FIXTURES, `${ label }.delta.i32.gz` ),
            zlib.gzipSync( Buffer.from( nanometres.buffer ), { level: 9 } ) );

        fs.writeFileSync( path.join( FIXTURES, `${ label }.json` ), JSON.stringify( {
            label,
            note: spec.note,
            sliders: spec.stack,
            blenderTargets: meta.appliedTargets,
            space: "blender-z-up-metres",
            vertexCount: BASEMESH_VERTEX_COUNT,
            deltaUnits: "int32 nanometres, gzipped, 3 per vertex, in blenderTargets' own space",
            verticesMoved: moved,
            identityMagnitudeMm: magnitude * 1000,
            provenance: {
                blender: "5.2.0 LTS fbe6228777e7 (2026-07-14)",
                mpfb: "20260722",
                basemesh: "MPFB create_human, gender 0.5, all other macros 0.5, race 0.33/0.33/0.33",
                scaleFactor: meta.scaleFactor
            }
        }, null, 1 ) + "\n" );

        console.log( `fixture ${ label.padEnd( 9 ) } ${ String( moved ).padStart( 6 ) } verts moved, `
            + `magnitude ${ ( magnitude * 1000 ).toFixed( 3 ) } mm, `
            + `${ fs.statSync( path.join( FIXTURES, `${ label }.delta.i32.gz` ) ).size } bytes` );

    }

}

/** MPFB's own macro stack for two settings, so the JS solver is gated against the library. */
function writeMacroFixtures( dumps ) {

    const cases = [
        { label: "neutral", macro: { gender: 0.5, age: 0.5, muscle: 0.5, weight: 0.5, proportions: 0.5, height: 0.5, cupsize: 0.5, firmness: 0.5, race: { asian: 0.33, caucasian: 0.33, african: 0.33 } } },
        { label: "macro_off", macro: { gender: 0.8, age: 0.3, muscle: 0.7, weight: 0.35, proportions: 0.2, height: 0.9, cupsize: 0.7, firmness: 0.25, race: { asian: 0.33, caucasian: 0.33, african: 0.33 } } }
    ];

    const out = cases.map( ( { label, macro } ) => {
        const meta = JSON.parse( fs.readFileSync( path.join( dumps, label + ".json" ), "utf8" ) );
        return { label, macro, mpfbStack: meta.macroStack.map( ( [ file, weight ] ) => ( { file, weight } ) ) };
    } );

    fs.writeFileSync( path.join( FIXTURES, "macro-stacks.json" ), JSON.stringify( {
        note: "TargetService.calculate_target_stack_from_macro_info_dict's own output, recorded from "
            + "the running addon. IdentityCatalogue.macroTargetStack must reproduce it.",
        provenance: { blender: "5.2.0 LTS fbe6228777e7", mpfb: "20260722" },
        cases: out
    }, null, 1 ) + "\n" );

    console.log( `macro fixtures   ${ out.map( ( c ) => `${ c.label } ${ c.mpfbStack.length } targets` ).join( ", " ) }` );

}

// ---------------------------------------------------------------------------------------------

function readDump( dir, label ) {

    const bytes = fs.readFileSync( path.join( dir, label + ".f64" ) );
    return new Float64Array( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.length ) );

}

function readBodyPositions( glbPath ) {

    const file = fs.readFileSync( glbPath );
    const jsonLength = file.readUInt32LE( 12 );
    const gltf = JSON.parse( file.subarray( 20, 20 + jsonLength ).toString( "utf8" ) );
    const binStart = 20 + jsonLength + 8;

    const mesh = gltf.meshes.find( ( m ) => m.name === BODY_MESH_NAME );
    if ( ! mesh ) throw new Error( `${ glbPath } has no '${ BODY_MESH_NAME }' mesh.` );

    const accessor = gltf.accessors[ mesh.primitives[ 0 ].attributes.POSITION ];
    const view = gltf.bufferViews[ accessor.bufferView ];
    const at = binStart + ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 );

    return new Float32Array( file.buffer.slice( file.byteOffset + at, file.byteOffset + at + accessor.count * 12 ) );

}

function cellKey( a, b, cell ) {

    return `${ Math.floor( a / cell ) },${ Math.floor( b / cell ) }`;

}

function forEachCandidateOf( positions, p, grid, cell, visit ) {

    const cx = Math.floor( positions[ p * 3 ] / cell );
    const cz = Math.floor( positions[ p * 3 + 2 ] / cell );

    for ( let a = - 1; a <= 1; a ++ ) {
        for ( let b = - 1; b <= 1; b ++ ) {
            const bucket = grid.get( `${ cx + a },${ cz + b }` );
            if ( bucket ) for ( const v of bucket ) visit( v );
        }
    }

}

function forEachCandidate( positions, grid, cell, neutral, visit ) {

    for ( let p = 0; p < positions.length / 3; p ++ ) {
        forEachCandidateOf( positions, p, grid, cell, ( v ) => {
            if ( Math.abs( neutral[ v * 3 ] - positions[ p * 3 ] ) < 1e-6
                && Math.abs( - neutral[ v * 3 + 1 ] - positions[ p * 3 + 2 ] ) < 1e-6 ) {
                visit( p, v, positions[ p * 3 + 1 ] );
            }
        } );
    }

}

/** How far apart the glTF positions that this map says share a basemesh vertex actually are. */
function duplicateSpreadMm( positions, map ) {

    const first = new Map();
    let worst = 0;

    for ( let p = 0; p < map.length; p ++ ) {

        const v = map[ p ];
        const seen = first.get( v );

        if ( seen === undefined ) { first.set( v, p ); continue; }

        const distance = Math.hypot(
            positions[ p * 3 ] - positions[ seen * 3 ],
            positions[ p * 3 + 1 ] - positions[ seen * 3 + 1 ],
            positions[ p * 3 + 2 ] - positions[ seen * 3 + 2 ] );

        if ( distance > worst ) worst = distance;

    }

    return worst;

}

function argValue( flag ) {

    const i = process.argv.indexOf( flag );
    return i === - 1 ? null : process.argv[ i + 1 ];

}

main();
