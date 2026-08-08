#!/usr/bin/env node
//
// bake.mjs — writes every offline input punch-list 3.2's skin material needs.
//
//   curvature   the BAKED curvature map, per figure. This one genuinely has to be a file: it is
//               a property of the mesh, and the shader cannot derive it without the quad-
//               derivative noise the bake exists to avoid.
//   lut         a PNG of the pre-integrated table. The material builds its own copy in float at
//               load (see PreintegratedSkinLut.js for why), so this is for looking at and for
//               regression-diffing, NOT for the renderer to load.
//   micronormal a PNG of the tiled micro-normal, same deal.
//
// Usage:
//   node tools/lut-bake/bake.mjs                       # everything, default figure
//   node tools/lut-bake/bake.mjs curvature --figure assets/figures/figure_g000.glb
//   node tools/lut-bake/bake.mjs --size 2048
//
// Exit codes match the rest of the harness: 0 fine, 2 tool error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodePng } from '../critic/png.mjs';
import { readGlb, readMorphTargets, readPrimitive } from './glb.mjs';

import {
    CURVATURE_ENCODE_MAX_PER_MILLIMETRE,
    curvatureOfSphere,
    dilate,
    encodeCurvature,
    meanCurvaturePerVertex,
    rasteriseToUv
} from '../../packages/core/src/material/SkinCurvature.js';

import {
    buildPreintegratedSkinLut,
    profileRmsRadiiMillimetres,
    specScatterScales
} from '../../packages/core/src/material/PreintegratedSkinLut.js';

import { buildSkinMicroNormal } from '../../packages/core/src/material/SkinMicroNormal.js';

import {
    OCCLUSION_RADIUS_MILLIMETRES,
    OCCLUSION_RAYS,
    occlusionKnownAnswerCheck,
    occlusionPerVertex
} from '../../packages/core/src/material/SkinOcclusion.js';

import {
    BODY_ROUGHNESS,
    REGION_CLAIM_FRACTION,
    SHADING_REGIONS,
    THICKNESS_ENCODE_MAX_MILLIMETRES,
    classifyRegionsPerVertex,
    encodeThickness,
    lipMaskPerVertex,
    roughnessPerVertex,
    thicknessOfSphereCheck,
    thicknessPerVertex
} from '../../packages/core/src/material/SkinRegions.js';

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../..' );
const outDirectory = path.join( here, 'out' );

// The body mesh's name inside the figure GLB. The other six meshes (teeth, tongue, lashes, brows,
// eyeball, cornea) are not skin and get their own materials.
const BODY_MESH_NAME = 'base.001';

const DEFAULT_FIGURE = path.join( repoRoot, 'assets/figures/figure_g050.glb' );

// 1024, not 2048. The body mesh is 14,517 vertices and 26,756 triangles; at 1024² that is about
// 39 texels per triangle, which is already several times finer than the data underneath. Doubling
// it would quadruple a 4 MB texture to interpolate the same vertex attribute more smoothly.
const DEFAULT_MAP_SIZE = 1024;

// Where the chin sits, as a fraction of stature measured down from the crown. Winter puts the
// vertex-to-chin head segment at 0.130 of stature; the head-only curvature statistic below wants
// a little more than that so the jaw line is inside it rather than straddling the boundary.
const HEAD_HEIGHT_FRACTION = 0.145;

main( process.argv.slice( 2 ) );

function main( argv ) {

    try {

        const options = parseArguments( argv );

        fs.mkdirSync( outDirectory, { recursive: true } );

        if ( options.targets.includes( 'lut' ) ) bakeLut();
        if ( options.targets.includes( 'micronormal' ) ) bakeMicroNormal();
        if ( options.targets.includes( 'curvature' ) ) bakeCurvature( options );
        if ( options.targets.includes( 'regions' ) ) bakeRegions( options );
        if ( options.targets.includes( 'cavity' ) ) bakeCavity( options );

    } catch ( error ) {

        process.stderr.write( `bake.mjs: ${ error.message }\n` );
        process.exitCode = 2;

    }

}

// --- the pre-integrated table -------------------------------------------------------------------

function bakeLut() {

    const lut = buildPreintegratedSkinLut();
    const rms = profileRmsRadiiMillimetres();
    const scales = specScatterScales();

    const rgba = new Uint8Array( lut.width * lut.height * 4 );

    for ( let i = 0; i < lut.width * lut.height; i ++ ) {

        rgba[ i * 4 ] = toByte( lut.data[ i * 3 ] );
        rgba[ i * 4 + 1 ] = toByte( lut.data[ i * 3 + 1 ] );
        rgba[ i * 4 + 2 ] = toByte( lut.data[ i * 3 + 2 ] );
        rgba[ i * 4 + 3 ] = 255;

    }

    write( 'preintegrated-skin-lut.png', encodePng( lut.width, lut.height, rgba ) );

    writeJson( 'preintegrated-skin-lut.json', {
        note: 'PREVIEW ONLY. SkinMaterial builds this table in float at load; nothing fetches the PNG.',
        width: lut.width,
        height: lut.height,
        ringSamples: lut.ringSamples,
        maxRingCurvature: lut.maxRingCurvature,
        vAxis: 'sqrt( ringCurvature / maxRingCurvature )',
        uAxis: 'dotNL * 0.5 + 0.5',
        publishedProfileRmsRadiiMillimetres: rms,
        publishedProfileRatio: rms.map( ( value ) => value / rms[ 0 ] ),
        specChannelRatio: [ 1.00, 0.35, 0.22 ],
        appliedRadialScales: scales,
        buildMilliseconds: lut.buildMilliseconds
    } );

    report( 'lut', [
        [ 'size', `${ lut.width } x ${ lut.height }, ${ lut.ringSamples } ring samples` ],
        [ 'build', `${ lut.buildMilliseconds.toFixed( 2 ) } ms` ],
        [ 'published RMS radii', rms.map( ( v ) => v.toFixed( 4 ) ).join( ' / ' ) + ' mm' ],
        [ 'published ratio', rms.map( ( v ) => ( v / rms[ 0 ] ).toFixed( 3 ) ).join( ' : ' ) ],
        [ 'spec ratio', '1.000 : 0.350 : 0.220' ],
        [ 'radial rescale applied', scales.map( ( v ) => v.toFixed( 4 ) ).join( ' / ' ) ]
    ] );

}

// --- the micro-normal -----------------------------------------------------------------------------

function bakeMicroNormal() {

    const micro = buildSkinMicroNormal();

    write( 'skin-micro-normal.png', encodePng( micro.size, micro.size, micro.rgba ) );

    report( 'micronormal', [
        [ 'size', `${ micro.size } x ${ micro.size }` ],
        [ 'height RMS', micro.heightRms.toFixed( 4 ) + ' (normalised, so 1.0 by construction)' ],
        [ 'slope RMS', micro.slopeRms.toFixed( 4 ) ]
    ] );

}

// --- the curvature map -------------------------------------------------------------------------

function bakeCurvature( options ) {

    // LEARNINGS §1.1: the estimator is checked against inputs whose answer is known on paper
    // BEFORE it is pointed at a face, and the check runs every bake rather than once in a selftest
    // nobody reruns. A sphere of radius r has mean curvature exactly 1/r; a plane has exactly 0.
    const sphereChecks = verifyAgainstSpheres();

    const glb = readGlb( options.figure );
    const mesh = readPrimitive( glb, BODY_MESH_NAME );

    const metresToMillimetres = 0.001;   // curvature is 1/length, so 1/m -> 1/mm is a DIVIDE by 1000
    const curvaturePerMetre = meanCurvaturePerVertex( mesh );
    const curvaturePerMillimetre = new Float64Array( curvaturePerMetre.length );
    for ( let v = 0; v < curvaturePerMetre.length; v ++ ) {

        curvaturePerMillimetre[ v ] = curvaturePerMetre[ v ] * metresToMillimetres;

    }

    const stats = describeDistribution( curvaturePerMillimetre );

    // The head on its own, because the whole-body figure is dominated by torso and limbs and the
    // gate is measured on a face. Everything above the chin, found from the mesh rather than
    // assumed: the five bakes differ in height by centimetres.
    const highestY = maximumY( mesh );
    const chinY = highestY - HEAD_HEIGHT_FRACTION * highestY;
    const headCurvature = [];
    for ( let v = 0; v < curvaturePerMillimetre.length; v ++ ) {

        if ( mesh.positions[ v * 3 + 1 ] >= chinY ) headCurvature.push( curvaturePerMillimetre[ v ] );

    }

    const headStats = describeDistribution( Float64Array.from( headCurvature ) );

    const convex = new Float64Array( curvaturePerMillimetre.length );
    const concave = new Float64Array( curvaturePerMillimetre.length );

    for ( let v = 0; v < curvaturePerMillimetre.length; v ++ ) {

        convex[ v ] = encodeCurvature( Math.max( 0, curvaturePerMillimetre[ v ] ) );
        concave[ v ] = encodeCurvature( Math.max( 0, - curvaturePerMillimetre[ v ] ) );

    }

    const size = options.size;
    const convexMap = rasteriseToUv( mesh, convex, size, size );
    const concaveMap = rasteriseToUv( mesh, concave, size, size );

    const convexFilled = dilate( convexMap.value, convexMap.covered, size, size );
    dilate( concaveMap.value, concaveMap.covered, size, size );

    const rgba = new Uint8Array( size * size * 4 );

    for ( let i = 0; i < size * size; i ++ ) {

        rgba[ i * 4 ] = toByte( convexMap.value[ i ] );
        rgba[ i * 4 + 1 ] = toByte( concaveMap.value[ i ] );
        rgba[ i * 4 + 2 ] = 0;
        rgba[ i * 4 + 3 ] = 255;

    }

    const name = path.basename( options.figure, '.glb' );

    write( `${ name }-curvature.png`, encodePng( size, size, rgba ) );

    writeJson( `${ name }-curvature.json`, {
        figure: path.relative( repoRoot, options.figure ),
        mesh: BODY_MESH_NAME,
        vertexCount: mesh.vertexCount,
        triangleCount: mesh.triangleCount,
        mapSize: size,
        encoding: {
            red: 'sqrt( max(H,0) / max ) — convex mean curvature',
            green: 'sqrt( max(-H,0) / max ) — concave mean curvature',
            blue: 'unused, reserved',
            maxPerMillimetre: CURVATURE_ENCODE_MAX_PER_MILLIMETRE
        },
        uvCoverageFraction: convexMap.coveredFraction,
        dilatedTexels: convexFilled,
        curvaturePerMillimetre: stats,
        headCurvaturePerMillimetre: headStats,
        headVertexCount: headCurvature.length,
        sphereChecks
    } );

    report( 'curvature', [
        [ 'figure', path.relative( repoRoot, options.figure ) ],
        [ 'mesh', `${ BODY_MESH_NAME }, ${ mesh.vertexCount } verts, ${ mesh.triangleCount } tris` ],
        [ 'map', `${ size } x ${ size }, UV coverage ${ ( convexMap.coveredFraction * 100 ).toFixed( 1 ) }%, ${ convexFilled } texels dilated` ],
        ...sphereChecks.map( ( check ) => check.shape === 'plane'
            ? [ 'plane (exactly 0)', `interior max ${ check.interiorMaxPerMillimetre.toExponential( 2 ) } /mm, open boundary ${ check.boundaryMaxPerMillimetre.toFixed( 5 ) } /mm (excluded, see note)` ]
            : [ `sphere r=${ check.radiusMillimetres } mm`,
                `expected ${ check.expectedPerMillimetre.toFixed( 5 ) }, measured median ${ check.measuredMedian.toFixed( 5 ) } /mm (${ ( check.error * 100 ).toFixed( 2 ) }% err), sign ${ check.signCorrect ? 'OK' : 'WRONG' }` ]
        ),
        ...describeRows( 'whole body', stats ),
        ...describeRows( `head only (${ headCurvature.length } verts above y=${ chinY.toFixed( 3 ) } m)`, headStats )
    ] );

}

// --- the region map ------------------------------------------------------------------------------

/**
 * `figure_gNNN-regions.png` — per-region roughness, baked tissue thickness and a lip mask.
 *
 *     R  roughness, 0..1, read straight into the shader's `roughnessNode`
 *     G  sqrt( thickness_mm / 60 ) — how far light has to travel through the tissue
 *     B  lip mask
 *
 * Both of the first two answer a defect `docs/PROGRESS.md` names explicitly: no transmission
 * anywhere ("needs a baked thickness map and a back-lit term") and one roughness value for a
 * material whose spec gives four.
 */
function bakeRegions( options ) {

    // Same discipline as the curvature bake: the estimator answers a shape whose thickness is
    // known on paper before it is pointed at a face. A sphere of radius r is exactly 2r thick
    // along its own normal, everywhere.
    const sphereCheck = thicknessOfSphereCheck( curvatureOfSphere( 0.05, 64 ), 0.05 );

    const glb = readGlb( options.figure );
    const mesh = readPrimitive( glb, BODY_MESH_NAME );
    const morphTargets = readMorphTargets( glb, BODY_MESH_NAME );

    const classification = classifyRegionsPerVertex( { morphTargets, positions: mesh.positions, vertexCount: mesh.vertexCount } );

    if ( classification.missing.length > 0 ) {

        throw new Error(
            `mesh '${ BODY_MESH_NAME }' is missing morph targets the region map is built from: ` +
            `${ classification.missing.join( ', ' ) }. Re-run tools/figure-pipeline/build.sh.`
        );

    }

    for ( const warning of classification.warnings ) process.stderr.write( `bake.mjs: ${ warning }\n` );

    const thickness = thicknessPerVertex( mesh );
    const roughness = roughnessPerVertex( classification.regionOf );
    const lipMask = lipMaskPerVertex( classification.regionOf );

    const encodedThickness = new Float64Array( mesh.vertexCount );
    for ( let v = 0; v < mesh.vertexCount; v ++ ) {

        encodedThickness[ v ] = encodeThickness( thickness.thicknessMillimetres[ v ] );

    }

    const size = options.size;
    const roughnessMap = rasteriseToUv( mesh, roughness, size, size );
    const thicknessMap = rasteriseToUv( mesh, encodedThickness, size, size );
    const lipMap = rasteriseToUv( mesh, lipMask, size, size );

    // 🚩 `dilate` MARKS the texels it fills in the `covered` array it is handed, and the fill test
    // below has to see those marks. Handing it a throwaway copy instead — which is the obvious
    // thing to write — leaves the original coverage untouched, so all 96,470 dilated texels are
    // then overwritten with the uncovered defaults and every UV island gets a hard-edged collar of
    // default roughness and default thickness. That renders as blotches with straight edges across
    // the cheek, which is exactly what it did before this comment was written.
    const covered = Uint8Array.from( roughnessMap.covered );

    const dilated = dilate( roughnessMap.value, covered, size, size );
    dilate( thicknessMap.value, Uint8Array.from( roughnessMap.covered ), size, size );
    dilate( lipMap.value, Uint8Array.from( roughnessMap.covered ), size, size );

    // Everything the dilation did not reach has to read as ordinary opaque body skin, not as zero.
    // Zero roughness is a mirror and zero thickness is tissue paper, so an uncovered texel that a
    // bilinear tap happens to reach would render as a chrome hole or a lantern.
    const rgba = new Uint8Array( size * size * 4 );

    for ( let i = 0; i < size * size; i ++ ) {

        const isCovered = covered[ i ] === 1;

        rgba[ i * 4 ] = toByte( isCovered ? roughnessMap.value[ i ] : BODY_ROUGHNESS );
        rgba[ i * 4 + 1 ] = toByte( isCovered ? thicknessMap.value[ i ] : 1 );
        rgba[ i * 4 + 2 ] = toByte( isCovered ? lipMap.value[ i ] : 0 );
        rgba[ i * 4 + 3 ] = 255;

    }

    const name = path.basename( options.figure, '.glb' );

    write( `${ name }-regions.png`, encodePng( size, size, rgba ) );

    const perRegion = {};
    for ( const region of SHADING_REGIONS ) {

        perRegion[ region.name ] = {
            vertices: classification.counts[ region.name ],
            roughness: region.roughness,
            thicknessMillimetres: describeDistribution( subsetOf( thickness.thicknessMillimetres, classification.regionOf, region.name ) )
        };

    }

    writeJson( `${ name }-regions.json`, {
        figure: path.relative( repoRoot, options.figure ),
        mesh: BODY_MESH_NAME,
        vertexCount: mesh.vertexCount,
        mapSize: size,
        encoding: {
            red: 'roughness, 0..1 linear',
            green: `sqrt( thickness_mm / ${ THICKNESS_ENCODE_MAX_MILLIMETRES } )`,
            blue: 'lip mask',
            uncoveredTexels: `roughness ${ BODY_ROUGHNESS }, thickness opaque, lip 0`
        },
        claimFraction: REGION_CLAIM_FRACTION,
        uvCoverageFraction: roughnessMap.coveredFraction,
        dilatedTexels: dilated,
        sphereCheck,
        thicknessBake: {
            rays: 7,
            milliseconds: thickness.milliseconds,
            nearZeroHits: thickness.nearZeroHits,
            missesBeyondRayLimit: thickness.misses,
            wholeBodyMillimetres: describeDistribution( thickness.thicknessMillimetres )
        },
        regions: perRegion,
        unclaimedVertices: classification.counts.unclaimed
    } );

    report( 'regions', [
        [ 'figure', path.relative( repoRoot, options.figure ) ],
        [ 'map', `${ size } x ${ size }, UV coverage ${ ( roughnessMap.coveredFraction * 100 ).toFixed( 1 ) }%, ${ dilated } texels dilated` ],
        [ 'sphere r=50 mm', `expected ${ sphereCheck.expectedMillimetres.toFixed( 2 ) } mm, measured median ${ sphereCheck.axialMedianMillimetres.toFixed( 2 ) } mm (${ ( sphereCheck.relativeError * 100 ).toFixed( 2 ) }% err)` ],
        [ 'thickness bake', `${ thickness.milliseconds } ms, ${ thickness.nearZeroHits } vertices under 1 mm, ${ thickness.misses } rays past 120 mm` ],
        ...SHADING_REGIONS.map( ( region ) => [
            `${ region.name } (r ${ region.roughness })`,
            `${ classification.counts[ region.name ] } verts, thickness median ` +
            `${ describeDistribution( subsetOf( thickness.thicknessMillimetres, classification.regionOf, region.name ) ).median.toFixed( 2 ) } mm`
        ] ),
        [ `body (r ${ BODY_ROUGHNESS })`, `${ classification.counts.unclaimed } verts` ]
    ] );

}

// --- the cavity map ------------------------------------------------------------------------------

/**
 * `figure_gNNN-cavity.png` — cosine-weighted hemisphere visibility, 1 = open sky, 0 = sealed.
 *
 * Greyscale into all three channels with an OPAQUE alpha, and both of those are deliberate. The
 * value could have ridden in the region map's spare alpha channel for free; it does not, because a
 * browser decoding a PNG whose alpha is not 255 may hand back premultiplied colour, and that would
 * silently scale the roughness and thickness in the other channels by the occlusion. Three
 * duplicate channels cost 700 KB across five bakes and cannot do that to anything.
 *
 * See `SkinOcclusion.js` for what the number means and why the radius is short.
 */
function bakeCavity( options ) {

    // Same discipline as the other two bakes: the estimator answers shapes whose visibility is
    // known on paper — a convex sphere at exactly 1, a right-angle crease at exactly 0.5 — before
    // it is pointed at a face.
    const knownAnswer = occlusionKnownAnswerCheck();

    const glb = readGlb( options.figure );
    const mesh = readPrimitive( glb, BODY_MESH_NAME );

    const occlusion = occlusionPerVertex( mesh );

    const size = options.size;
    const visibilityMap = rasteriseToUv( mesh, occlusion.visibility, size, size );

    // The same dilation trap `bakeRegions` documents at length: `dilate` marks what it filled in
    // the array it is handed, and the fill test below has to see those marks.
    const covered = Uint8Array.from( visibilityMap.covered );
    const dilated = dilate( visibilityMap.value, covered, size, size );

    const rgba = new Uint8Array( size * size * 4 );

    for ( let i = 0; i < size * size; i ++ ) {

        // Uncovered reads as OPEN. A bilinear tap that strays off an island then loses the effect
        // rather than inventing a black hole in the middle of a cheek.
        const value = toByte( covered[ i ] === 1 ? visibilityMap.value[ i ] : 1 );

        rgba[ i * 4 ] = value;
        rgba[ i * 4 + 1 ] = value;
        rgba[ i * 4 + 2 ] = value;
        rgba[ i * 4 + 3 ] = 255;

    }

    const name = path.basename( options.figure, '.glb' );

    write( `${ name }-cavity.png`, encodePng( size, size, rgba ) );

    writeJson( `${ name }-cavity.json`, {
        figure: path.relative( repoRoot, options.figure ),
        mesh: BODY_MESH_NAME,
        vertexCount: mesh.vertexCount,
        mapSize: size,
        encoding: {
            rgb: 'cosine-weighted hemisphere visibility, 0..1 linear; 1 = open',
            alpha: 'opaque, deliberately — see bakeCavity',
            uncoveredTexels: 'visibility 1 (open)'
        },
        rays: OCCLUSION_RAYS,
        radiusMillimetres: OCCLUSION_RADIUS_MILLIMETRES,
        knownAnswer,
        uvCoverageFraction: visibilityMap.coveredFraction,
        dilatedTexels: dilated,
        milliseconds: occlusion.milliseconds,
        sealedVertices: occlusion.sealedVertices,
        visibility: describeDistribution( occlusion.visibility )
    } );

    report( 'cavity', [
        [ 'figure', path.relative( repoRoot, options.figure ) ],
        [ 'map', `${ size } x ${ size }, UV coverage ${ ( visibilityMap.coveredFraction * 100 ).toFixed( 1 ) }%, ${ dilated } texels dilated` ],
        [ 'sphere (convex)', `expected 1.000, measured ${ knownAnswer.sphere.measured.toFixed( 3 ) } (err ${ knownAnswer.sphere.absoluteError.toFixed( 4 ) })` ],
        [ '90° crease', `expected 0.500, measured ${ knownAnswer.crease.measured.toFixed( 3 ) } (derived leak ${ knownAnswer.crease.leakFraction.toFixed( 4 ) })` ],
        [ 'cast', `${ OCCLUSION_RAYS } rays at ${ OCCLUSION_RADIUS_MILLIMETRES } mm, ${ occlusion.milliseconds } ms, ${ occlusion.sealedVertices } sealed vertices` ],
        [ 'visibility', `median ${ describeDistribution( occlusion.visibility ).median.toFixed( 3 ) }, p10 ${ describeDistribution( occlusion.visibility ).p10.toFixed( 3 ) }` ]
    ] );

}

/** The thickness values belonging to one named region, for the per-region distributions. */
function subsetOf( values, regionOf, regionName ) {

    const index = SHADING_REGIONS.findIndex( ( region ) => region.name === regionName );
    const subset = [];

    for ( let v = 0; v < values.length; v ++ ) if ( regionOf[ v ] === index ) subset.push( values[ v ] );

    return Float64Array.from( subset.length > 0 ? subset : [ 0 ] );

}

/**
 * The estimator, run against two spheres and a plane whose curvature is known exactly.
 *
 * The interior of the sphere is what is checked: the poles of a UV sphere are a fan of slivers and
 * a discrete Laplacian is legitimately worse there, so the median over all vertices is the honest
 * statistic and the maximum is not.
 */
function verifyAgainstSpheres() {

    const checks = [];

    for ( const radiusMetres of [ 0.05, 0.002 ] ) {

        const sphere = curvatureOfSphere( radiusMetres, 96 );
        const measured = meanCurvaturePerVertex( sphere );

        const perMillimetre = Array.from( measured, ( value ) => value * 0.001 );
        const expected = ( 1 / radiusMetres ) * 0.001;

        const sorted = perMillimetre.slice().sort( ( a, b ) => a - b );
        const median = sorted[ Math.floor( sorted.length / 2 ) ];

        checks.push( {
            radiusMillimetres: radiusMetres * 1000,
            expectedPerMillimetre: expected,
            measuredMedian: median,
            error: Math.abs( median - expected ) / expected,
            signCorrect: median > 0
        } );

    }

    // A plane: known-bad input for a curvature reading, in the sense that any non-zero answer in
    // the INTERIOR is the estimator inventing structure. Its four edges are excluded and said to
    // be excluded — an open boundary has no second neighbour ring, so the cotangent Laplacian is
    // undefined there by construction rather than merely inaccurate, and a closed mesh like the
    // figure has no boundary at all.
    const segments = 32;
    const plane = buildPlane( segments );
    const planeCurvature = meanCurvaturePerVertex( plane );

    let interiorMax = 0;
    let boundaryMax = 0;

    for ( let v = 0; v < plane.vertexCount; v ++ ) {

        const x = v % ( segments + 1 );
        const y = Math.floor( v / ( segments + 1 ) );
        const onBoundary = x === 0 || y === 0 || x === segments || y === segments;
        const magnitude = Math.abs( planeCurvature[ v ] ) * 0.001;

        if ( onBoundary ) boundaryMax = Math.max( boundaryMax, magnitude );
        else interiorMax = Math.max( interiorMax, magnitude );

    }

    checks.push( {
        shape: 'plane',
        radiusMillimetres: Infinity,
        expectedPerMillimetre: 0,
        measuredMedian: 0,
        interiorMaxPerMillimetre: interiorMax,
        boundaryMaxPerMillimetre: boundaryMax,
        error: interiorMax,
        signCorrect: true
    } );

    return checks;

}

function buildPlane( segments ) {

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for ( let y = 0; y <= segments; y ++ ) {

        for ( let x = 0; x <= segments; x ++ ) {

            positions.push( x / segments, 0, y / segments );
            normals.push( 0, 1, 0 );
            uvs.push( x / segments, y / segments );

        }

    }

    const stride = segments + 1;

    for ( let y = 0; y < segments; y ++ ) {

        for ( let x = 0; x < segments; x ++ ) {

            const a = y * stride + x;
            indices.push( a, a + stride, a + 1, a + 1, a + stride, a + stride + 1 );

        }

    }

    return {
        positions: Float64Array.from( positions ),
        normals: Float64Array.from( normals ),
        uvs: Float64Array.from( uvs ),
        indices: Uint32Array.from( indices ),
        vertexCount: positions.length / 3
    };

}

/** Curvature percentiles printed as both 1/mm and the radius a reader can picture. */
function describeRows( label, stats ) {

    const asRadius = ( value ) => value === 0 ? 'flat' : `${ ( 1 / Math.abs( value ) ).toFixed( 1 ) } mm`;

    return [
        [ `${ label } median`, `${ stats.median.toFixed( 5 ) } /mm  (r ${ asRadius( stats.median ) })` ],
        [ `${ label } p90`, `${ stats.p90.toFixed( 5 ) } /mm  (r ${ asRadius( stats.p90 ) })` ],
        [ `${ label } p99`, `${ stats.p99.toFixed( 5 ) } /mm  (r ${ asRadius( stats.p99 ) })` ],
        [ `${ label } convex`, `${ ( stats.positiveFraction * 100 ).toFixed( 1 ) }%` ]
    ];

}

function maximumY( mesh ) {

    let highest = -Infinity;
    for ( let v = 0; v < mesh.vertexCount; v ++ ) highest = Math.max( highest, mesh.positions[ v * 3 + 1 ] );
    return highest;

}

function describeDistribution( values ) {

    const sorted = Array.from( values ).sort( ( a, b ) => a - b );
    const at = ( q ) => sorted[ Math.min( sorted.length - 1, Math.max( 0, Math.round( q * ( sorted.length - 1 ) ) ) ) ];

    let positive = 0;
    for ( const value of values ) if ( value > 0 ) positive ++;

    return {
        min: sorted[ 0 ],
        p01: at( 0.01 ),
        p10: at( 0.10 ),
        median: at( 0.50 ),
        p90: at( 0.90 ),
        p99: at( 0.99 ),
        max: sorted[ sorted.length - 1 ],
        positiveFraction: positive / values.length
    };

}

// --- plumbing --------------------------------------------------------------------------------------

function parseArguments( argv ) {

    const known = [ 'lut', 'micronormal', 'curvature', 'regions', 'cavity' ];
    const targets = [];
    const options = { figure: DEFAULT_FIGURE, size: DEFAULT_MAP_SIZE };

    for ( let i = 0; i < argv.length; i ++ ) {

        const argument = argv[ i ];

        if ( argument === '--figure' ) options.figure = path.resolve( argv[ ++ i ] );
        else if ( argument === '--size' ) options.size = Number( argv[ ++ i ] );
        else if ( argument.startsWith( '--' ) ) throw new Error( `unknown option ${ argument }` );
        else if ( known.includes( argument ) ) targets.push( argument );
        else throw new Error( `unknown target '${ argument }'. Expected one of: ${ known.join( ', ' ) }` );

    }

    options.targets = targets.length > 0 ? targets : known;
    return options;

}

function write( name, buffer ) {

    fs.writeFileSync( path.join( outDirectory, name ), buffer );

}

function writeJson( name, value ) {

    fs.writeFileSync( path.join( outDirectory, name ), `${ JSON.stringify( value, null, 2 ) }\n` );

}

function report( title, rows ) {

    process.stdout.write( `\n${ title }\n` );
    for ( const [ key, value ] of rows ) process.stdout.write( `  ${ String( key ).padEnd( 24 ) } ${ value }\n` );

}

function toByte( value ) {

    return Math.max( 0, Math.min( 255, Math.round( value * 255 ) ) );

}
