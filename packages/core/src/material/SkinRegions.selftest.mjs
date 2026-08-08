#!/usr/bin/env node
//
// SkinRegions.selftest.mjs — proves the region map measures what it claims.
//
// LEARNINGS §1.1: a gate that has never failed is not known to work. Every check here runs in BOTH
// directions — the correct input passes, and a constructed wrong input is confirmed to fail,
// naming the defect. The wrong inputs are the interesting half:
//
//   - the MEAN over rays instead of the shortest, to prove that the reduction is what makes the
//     ala thin rather than the ray count;
//   - a ray origin ON the surface instead of ε under it, to prove the offset is load-bearing;
//   - the OLD, over-broad lip morph list, to prove the 372-vertex vermillion is a decision the
//     bake can defend and not an accident of thresholding;
//   - a map sampled at 1 − v, which is the flip that shipped inside `SkinMaterial` until this
//     round and made the whole transmission term inert.
//
// Usage:  node packages/core/src/material/SkinRegions.selftest.mjs
// Exit:   0 all checks passed   1 a check failed   2 the figure or its bake is missing

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    BODY_ROUGHNESS,
    LIP_ROUGHNESS,
    SHADING_REGIONS,
    THICKNESS_ENCODE_MAX_MILLIMETRES,
    T_ZONE_ROUGHNESS,
    classifyRegionsPerVertex,
    decodeThickness,
    encodeThickness,
    lipMaskPerVertex,
    lipSeamHeightMetres,
    roughnessPerVertex,
    thicknessOfSphereCheck,
    thicknessPerVertex
} from './SkinRegions.js';

import { curvatureOfSphere } from './SkinCurvature.js';
import { readGlb, readMorphTargets, readPrimitive } from '../../../../tools/lut-bake/glb.mjs';
import { decodePng } from '../../../../tools/critic/png.mjs';

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../../../..' );

const FIGURE = path.join( repoRoot, 'assets/figures/figure_g050.glb' );
const BAKED_MAP = path.join( repoRoot, 'tools/lut-bake/out/figure_g050-regions.png' );
const BODY_MESH_NAME = 'base.001';

let passed = 0;
let failed = 0;
let cachedClassification = null;

function check( name, condition, detail ) {

    if ( condition ) {

        passed ++;
        process.stdout.write( `  PASS  ${ name }${ detail ? `  — ${ detail }` : '' }\n` );

    } else {

        failed ++;
        process.stdout.write( `  FAIL  ${ name }${ detail ? `  — ${ detail }` : '' }\n` );

    }

}

function section( title ) {

    process.stdout.write( `\n${ title }\n` );

}

for ( const required of [ FIGURE, BAKED_MAP ] ) {

    if ( fs.existsSync( required ) === false ) {

        process.stderr.write( `SkinRegions.selftest: missing ${ path.relative( repoRoot, required ) }.\n` +
            'Run: node tools/lut-bake/bake.mjs regions\n' );
        process.exit( 2 );

    }

}

const glb = readGlb( FIGURE );
const mesh = readPrimitive( glb, BODY_MESH_NAME );
const morphTargets = readMorphTargets( glb, BODY_MESH_NAME );

// ---------------------------------------------------------------------------------------------
section( 'ENCODING — the shader squares what the bake square-roots' );

for ( const millimetres of [ 0, 2, 5.5, 20, 59 ] ) {

    const round = decodeThickness( encodeThickness( millimetres ) );
    check( `encode/decode ${ millimetres } mm`, Math.abs( round - millimetres ) < 1e-9,
        `round-trips to ${ round.toFixed( 6 ) } mm` );

}

check( 'thickness saturates at the ceiling',
    decodeThickness( encodeThickness( 500 ) ) === THICKNESS_ENCODE_MAX_MILLIMETRES,
    `${ THICKNESS_ENCODE_MAX_MILLIMETRES } mm` );

// The square root exists to spend code values on thin tissue. A 3 mm ear must survive 8-bit.
{
    const linearCodeValues = Math.round( 3 / THICKNESS_ENCODE_MAX_MILLIMETRES * 255 );
    const sqrtCodeValues = Math.round( encodeThickness( 3 ) * 255 );

    check( 'the square-root encoding is load-bearing at ear thickness',
        sqrtCodeValues >= 4 * linearCodeValues,
        `3 mm gets ${ sqrtCodeValues } code values, a linear encoding would give ${ linearCodeValues }` );
}

// ---------------------------------------------------------------------------------------------
section( 'THICKNESS — checked against a shape whose answer is known on paper' );

{
    const sphere = thicknessOfSphereCheck( curvatureOfSphere( 0.05, 64 ), 0.05 );

    check( 'sphere r=50 mm measures 2r along its own normal',
        sphere.relativeError < 0.01,
        `expected ${ sphere.expectedMillimetres.toFixed( 2 ) }, measured ${ sphere.axialMedianMillimetres.toFixed( 2 ) } mm` );

}

const thickness = thicknessPerVertex( mesh );

{
    // KNOWN-BAD: ε at zero, so the rays start exactly on the surface. Forty vertices of this body
    // then come back under a millimetre thick — the shortest one at 0.022 mm — and each of those
    // is a hole the transmission term would render as glass. The sphere is no use for this check:
    // its shared triangles pass exactly through the origin and are rejected at distance zero, so
    // the defect only appears on a real mesh with seams and duplicated vertices.
    const noOffset = thicknessPerVertex( mesh, { epsilonEdgeFraction: 0 } );

    check( 'PROVEN RED: rays launched from the surface punch holes in the body',
        noOffset.nearZeroHits > 20 && thickness.nearZeroHits === 0,
        `${ noOffset.nearZeroHits } vertices under 1 mm with no offset, ${ thickness.nearZeroHits } with it` );

    const ear = earBandVertices( mesh );
    const values = ear.map( ( v ) => thickness.thicknessMillimetres[ v ] ).sort( ( a, b ) => a - b );
    const median = values[ Math.floor( values.length / 2 ) ];

    // Anatomy, not a tuned number: a pinna is skin over cartilage, a few millimetres through.
    check( 'the ear bakes as thin tissue',
        median > 2 && median < 12,
        `median ${ median.toFixed( 2 ) } mm over ${ ear.length } lateral head vertices` );

    // The forehead, not the cheek: with the lip region correctly narrowed the `cheek` list picks
    // up the thin perioral tissue around it, so its median is a mixture. A brow is unambiguous.
    const brow = medianOfRegion( thickness.thicknessMillimetres, mesh, 'brow', classificationOfMesh() );

    check( 'the ear is several times thinner than the forehead',
        brow / median > 2.5,
        `brow median ${ brow.toFixed( 2 ) } mm vs ear ${ median.toFixed( 2 ) } mm` );

    // KNOWN-BAD: the arithmetic MEAN over the ray cone. `thicknessPerVertex` returns it alongside
    // the shipped statistic for exactly this check. Measured on this head it puts the nose region
    // at four times its shortest-path thickness, because rays fired inward from the nostril wing
    // escape down the open nostril and out of the skull, and the mean lets those drown the
    // 2 mm crossing that light actually takes.
    const byMean = medianOfRegion( thickness.meanPathMillimetres, mesh, 'nose', classificationOfMesh() );
    const byShortest = medianOfRegion( thickness.thicknessMillimetres, mesh, 'nose', classificationOfMesh() );

    check( 'PROVEN RED: the mean over the ray cone loses the nose to the nostril cavity',
        byMean > byShortest * 2.5,
        `mean ${ byMean.toFixed( 2 ) } mm vs shortest-path ${ byShortest.toFixed( 2 ) } mm` );

}

// ---------------------------------------------------------------------------------------------
section( 'REGIONS — the face segmentation the asset already carries' );

const classification = classifyRegionsPerVertex( { morphTargets, positions: mesh.positions, vertexCount: mesh.vertexCount } );

check( 'every morph the partition names exists on the mesh',
    classification.missing.length === 0,
    classification.missing.length === 0 ? `${ SHADING_REGIONS.length } regions resolved` : classification.missing.join( ', ' ) );

// 🎯 Measured in MILLIMETRES against a mouth, not counted. Three earlier definitions all had
// plausible vertex counts and all three painted a goatee; the extent is the statistic that caught
// them. The look spec sizes a vermillion at §2: height ÷ face width 0.138 on a ~140 mm face.
{
    const extent = extentOfRegion( mesh, classification.regionOf, 'lips' );

    check( 'the lip region is one vermillion tall',
        extent.heightMillimetres > 14 && extent.heightMillimetres < 28,
        `${ extent.heightMillimetres.toFixed( 1 ) } mm over ${ classification.counts.lips } vertices` );

    check( 'the lip region is one mouth wide',
        extent.widthMillimetres > 36 && extent.widthMillimetres < 60,
        `${ extent.widthMillimetres.toFixed( 1 ) } mm` );

    const seam = lipSeamHeightMetres( { morphTargets, positions: mesh.positions, vertexCount: mesh.vertexCount } );

    check( 'the lip seam is found from the mesh rather than assumed',
        seam !== null && Math.abs( extent.centreMillimetres - seam * 1000 ) < 4,
        `seam ${ ( seam * 1000 ).toFixed( 1 ) } mm, region centre ${ extent.centreMillimetres.toFixed( 1 ) } mm` );

    // KNOWN-BAD, judged by the SAME criterion as the good case rather than by a ratio: the claim
    // without its seam band, and the roll-target definition an earlier plate actually shipped.
    // Both exceed a vermillion's height, which is what the check above is for.
    const unbanded = claimExtent( mesh, morphTargets, [ 'mouthFunnel' ], 0.45 );
    const rolls = claimExtent( mesh, morphTargets, [ 'mouthRollUpper', 'mouthRollLower' ], 0.25 );

    check( 'PROVEN RED: without the seam band the lip claim is taller than a vermillion',
        unbanded.heightMillimetres > 28,
        `${ unbanded.heightMillimetres.toFixed( 1 ) } mm unbanded against ${ extent.heightMillimetres.toFixed( 1 ) } mm banded` );

    check( 'PROVEN RED: the roll-target definition reaches from the nose to the chin point',
        rolls.heightMillimetres > 50,
        `${ rolls.heightMillimetres.toFixed( 1 ) } mm — this one shipped a plate and rendered as a goatee` );
}

{
    // KNOWN-BAD: the list this started with. `mouthPucker`, `mouthFunnel`, the two shrugs and
    // `mouthClose` all drag the perioral ring, and claiming them paints the chin glossy.
    const broad = classifyRegionsPerVertex( {
        morphTargets,
        positions: mesh.positions,
        vertexCount: mesh.vertexCount,
        claimFraction: 0.08
    } );

    const wide = countClaimedBy( morphTargets, mesh.vertexCount, [
        'mouthPucker', 'mouthFunnel', 'mouthRollUpper', 'mouthRollLower',
        'mouthShrugUpper', 'mouthShrugLower', 'mouthClose'
    ], 0.08 );

    check( 'PROVEN RED: the over-broad lip list claims three times the vermillion',
        wide > classification.counts.lips * 2.5,
        `${ wide } vertices against ${ classification.counts.lips }` );

    check( 'per-region claim fractions are doing work',
        broad.counts.lips === classification.counts.lips,
        `a region overrides the default, so the global fraction does not move it (${ broad.counts.lips })` );
}

check( 'the partition is left/right symmetric',
    symmetricPairsAgree( mesh, classification.regionOf ) > 0.98,
    `${ ( symmetricPairsAgree( mesh, classification.regionOf ) * 100 ).toFixed( 1 ) }% of mirrored vertex pairs share a region` );

{
    const roughness = roughnessPerVertex( classification.regionOf );
    const lipIndex = SHADING_REGIONS.findIndex( ( region ) => region.name === 'lips' );

    let lipRoughnessCorrect = true;
    let bodyRoughnessCorrect = true;

    for ( let v = 0; v < mesh.vertexCount; v ++ ) {

        if ( classification.regionOf[ v ] === lipIndex && roughness[ v ] !== LIP_ROUGHNESS ) lipRoughnessCorrect = false;
        if ( classification.regionOf[ v ] < 0 && roughness[ v ] !== BODY_ROUGHNESS ) bodyRoughnessCorrect = false;

    }

    check( 'lips carry the spec\'s lip roughness', lipRoughnessCorrect, `${ LIP_ROUGHNESS }` );
    check( 'unclaimed vertices carry the spec\'s limb roughness', bodyRoughnessCorrect, `${ BODY_ROUGHNESS }` );

    check( 'the lip is the glossiest surface on the figure',
        LIP_ROUGHNESS < T_ZONE_ROUGHNESS && T_ZONE_ROUGHNESS < BODY_ROUGHNESS,
        `${ LIP_ROUGHNESS } < ${ T_ZONE_ROUGHNESS } < ${ BODY_ROUGHNESS }` );

    const mask = lipMaskPerVertex( classification.regionOf );
    let masked = 0;
    for ( let v = 0; v < mesh.vertexCount; v ++ ) if ( mask[ v ] === 1 ) masked ++;

    check( 'the lip mask and the lip region are the same set',
        masked === classification.counts.lips, `${ masked } vertices` );
}

// ---------------------------------------------------------------------------------------------
section( 'THE BAKED MAP — what the shader will actually sample' );

const map = decodePng( fs.readFileSync( BAKED_MAP ) );

{
    const ear = earBandVertices( mesh );

    const upright = sampleThicknessAt( map, mesh, ear, false );
    const flipped = sampleThicknessAt( map, mesh, ear, true );
    const baked = ear.map( ( v ) => thickness.thicknessMillimetres[ v ] ).sort( ( a, b ) => a - b );
    const bakedMedian = baked[ Math.floor( baked.length / 2 ) ];

    check( 'the map agrees with the ray cast at the ear, sampled at v',
        Math.abs( upright - bakedMedian ) < 2,
        `map ${ upright.toFixed( 2 ) } mm vs per-vertex ${ bakedMedian.toFixed( 2 ) } mm` );

    // 🎯 THE ONE THIS FILE EXISTS FOR. `TextureLoader` defaults flipY to true and `GLTFLoader`
    // sets it false, so a baked map loaded the DOM way is sampled at 1 − v against the albedo on
    // the same mesh. That shipped, and it made the transmission term measure exactly 0.0000 of
    // luma change at the ear at 8x strength.
    check( 'PROVEN RED: sampled at 1 − v the ear reads as the middle of a skull',
        flipped > 6 * upright,
        `${ flipped.toFixed( 2 ) } mm against the correct ${ upright.toFixed( 2 ) } mm — load these maps with flipY = false` );
}

{
    // Nothing a bilinear tap can reach may be zero: zero roughness is a mirror and zero thickness
    // is tissue paper. The bake fills the uncovered remainder with body defaults for that reason.
    let zeroRoughness = 0;
    let zeroThickness = 0;

    for ( let i = 0; i < map.width * map.height; i ++ ) {

        if ( map.pixels[ i * 4 ] <= 0 ) zeroRoughness ++;
        if ( map.pixels[ i * 4 + 1 ] <= 0 ) zeroThickness ++;

    }

    check( 'no texel is a mirror', zeroRoughness === 0, `${ zeroRoughness } texels at roughness 0` );
    check( 'no texel is tissue paper', zeroThickness === 0, `${ zeroThickness } texels at thickness 0` );
}

// ---------------------------------------------------------------------------------------------

process.stdout.write( `\n${ passed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );

// --- helpers -----------------------------------------------------------------------------------

/** The ear: the widest |x| vertices in the head band that contains it. */
function earBandVertices( mesh ) {

    let top = -Infinity;
    for ( let v = 0; v < mesh.vertexCount; v ++ ) top = Math.max( top, mesh.positions[ v * 3 + 1 ] );

    const candidates = [];

    for ( let v = 0; v < mesh.vertexCount; v ++ ) {

        const y = mesh.positions[ v * 3 + 1 ];
        if ( y < 0.885 * top || y > 0.945 * top ) continue;
        candidates.push( { v, x: Math.abs( mesh.positions[ v * 3 ] ) } );

    }

    candidates.sort( ( a, b ) => b.x - a.x );
    return candidates.slice( 0, 40 ).map( ( entry ) => entry.v );

}

function sampleThicknessAt( map, mesh, vertices, flipV ) {

    const values = [];

    for ( const v of vertices ) {

        const u = mesh.uvs[ v * 2 ];
        const w = mesh.uvs[ v * 2 + 1 ];

        const x = clampIndex( Math.round( u * map.width ), map.width );
        const y = clampIndex( Math.round( ( flipV ? 1 - w : w ) * map.height ), map.height );

        values.push( decodeThickness( map.pixels[ ( y * map.width + x ) * 4 + 1 ] ) );

    }

    values.sort( ( a, b ) => a - b );
    return values[ Math.floor( values.length / 2 ) ];

}

function clampIndex( value, count ) {

    return value < 0 ? 0 : ( value >= count ? count - 1 : value );

}

/** One classification, reused — it walks 89 morph targets over 14,517 vertices. */
function classificationOfMesh() {

    if ( cachedClassification === null ) {

        cachedClassification = classifyRegionsPerVertex( { morphTargets, positions: mesh.positions, vertexCount: mesh.vertexCount } );

    }

    return cachedClassification;

}

function medianOfRegion( values, mesh, regionName, classification ) {

    const index = SHADING_REGIONS.findIndex( ( region ) => region.name === regionName );
    const subset = [];

    for ( let v = 0; v < mesh.vertexCount; v ++ ) {

        if ( classification.regionOf[ v ] === index ) subset.push( values[ v ] );

    }

    subset.sort( ( a, b ) => a - b );
    return subset[ Math.floor( subset.length / 2 ) ];

}

/** A region's bounding extent on the figure, in millimetres. */
function extentOfRegion( mesh, regionOf, regionName ) {

    const index = SHADING_REGIONS.findIndex( ( region ) => region.name === regionName );

    let low = Infinity, high = -Infinity, halfWidth = 0;

    for ( let v = 0; v < mesh.vertexCount; v ++ ) {

        if ( regionOf[ v ] !== index ) continue;

        const y = mesh.positions[ v * 3 + 1 ];
        low = Math.min( low, y );
        high = Math.max( high, y );
        halfWidth = Math.max( halfWidth, Math.abs( mesh.positions[ v * 3 ] ) );

    }

    return {
        heightMillimetres: ( high - low ) * 1000,
        widthMillimetres: halfWidth * 2000,
        centreMillimetres: ( high + low ) * 500
    };

}

/** The same extent for a raw morph claim, with no seam band applied. */
function claimExtent( mesh, morphTargets, names, fraction ) {

    const claimed = new Int8Array( mesh.vertexCount ).fill( -1 );
    const index = SHADING_REGIONS.findIndex( ( region ) => region.name === 'lips' );

    for ( const name of names ) {

        const deltas = morphTargets.get( name );

        let largest = 0;
        for ( let v = 0; v < mesh.vertexCount; v ++ ) {

            largest = Math.max( largest, Math.hypot( deltas[ v * 3 ], deltas[ v * 3 + 1 ], deltas[ v * 3 + 2 ] ) );

        }

        const threshold = largest * fraction;

        for ( let v = 0; v < mesh.vertexCount; v ++ ) {

            if ( Math.hypot( deltas[ v * 3 ], deltas[ v * 3 + 1 ], deltas[ v * 3 + 2 ] ) >= threshold ) claimed[ v ] = index;

        }

    }

    return extentOfRegion( mesh, claimed, 'lips' );

}

/** Median of a typed array, for the checks that quote one. */
function median( values ) {

    const sorted = Array.from( values ).sort( ( a, b ) => a - b );
    return sorted[ Math.floor( sorted.length / 2 ) ];

}

function countClaimedBy( morphTargets, vertexCount, names, fraction ) {

    const claimed = new Set();

    for ( const name of names ) {

        const deltas = morphTargets.get( name );
        if ( deltas === undefined ) continue;

        let largest = 0;
        for ( let v = 0; v < vertexCount; v ++ ) {

            largest = Math.max( largest, Math.hypot( deltas[ v * 3 ], deltas[ v * 3 + 1 ], deltas[ v * 3 + 2 ] ) );

        }

        const threshold = largest * fraction;

        for ( let v = 0; v < vertexCount; v ++ ) {

            if ( Math.hypot( deltas[ v * 3 ], deltas[ v * 3 + 1 ], deltas[ v * 3 + 2 ] ) >= threshold ) claimed.add( v );

        }

    }

    return claimed.size;

}

/**
 * How often a vertex and its mirror image across x = 0 land in the same region.
 *
 * PUNCHLIST's standing constraint is "no facial asymmetry", and a segmentation built from
 * left/right morph pairs satisfies it by construction — which is exactly the kind of claim that
 * should be measured rather than trusted.
 */
function symmetricPairsAgree( mesh, regionOf ) {

    const byKey = new Map();
    const round = ( value ) => Math.round( value * 10000 );

    for ( let v = 0; v < mesh.vertexCount; v ++ ) {

        byKey.set( `${ round( mesh.positions[ v * 3 ] ) },${ round( mesh.positions[ v * 3 + 1 ] ) },${ round( mesh.positions[ v * 3 + 2 ] ) }`, v );

    }

    let pairs = 0;
    let agree = 0;

    for ( let v = 0; v < mesh.vertexCount; v ++ ) {

        const mirror = byKey.get( `${ round( - mesh.positions[ v * 3 ] ) },${ round( mesh.positions[ v * 3 + 1 ] ) },${ round( mesh.positions[ v * 3 + 2 ] ) }` );
        if ( mirror === undefined ) continue;

        pairs ++;
        if ( regionOf[ v ] === regionOf[ mirror ] ) agree ++;

    }

    return pairs === 0 ? 0 : agree / pairs;

}
