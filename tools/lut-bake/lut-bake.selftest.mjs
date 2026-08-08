#!/usr/bin/env node
//
// lut-bake.selftest.mjs — proves the three generators measure what they claim.
//
// LEARNINGS §1.1: a gate that has never failed is not known to work. Every check here is run in
// BOTH directions — the correct input passes, and a constructed wrong input is confirmed to fail,
// naming the defect. The wrong inputs are the interesting half of this file:
//
//   - a GREY diffusion profile, to prove the red-shifted terminator comes from the profile's
//     channel widths and not from the integrator;
//   - an UNWELDED mesh, to prove the vertex weld is load-bearing rather than tidy;
//   - a PLANE, whose curvature is exactly zero, to prove the estimator does not invent structure;
//   - an octave that does not divide the map, to prove the tiling constraint is enforced.
//
// Usage:  node tools/lut-bake/lut-bake.selftest.mjs
// Exit:   0 all checks passed   1 a check failed

import {
    buildPreintegratedSkinLut,
    decodeRingCurvature,
    diffusionProfile,
    encodeRingCurvature,
    LUT_HEIGHT,
    LUT_WIDTH,
    MAX_RING_CURVATURE,
    profileRmsRadiiMillimetres,
    sampleLut,
    SKIN_PROFILE_GAUSSIANS,
    specScatterScales
} from '../../packages/core/src/material/PreintegratedSkinLut.js';

import {
    CURVATURE_ENCODE_MAX_PER_MILLIMETRE,
    curvatureOfSphere,
    decodeCurvature,
    dilate,
    encodeCurvature,
    meanCurvaturePerVertex,
    rasteriseToUv,
    weldByPosition
} from '../../packages/core/src/material/SkinCurvature.js';

import { buildSkinMicroNormal, MICRO_NORMAL_SIZE } from '../../packages/core/src/material/SkinMicroNormal.js';

let passed = 0;
let failed = 0;

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

// ---------------------------------------------------------------------------------------------
section( 'the diffusion profile' );

{
    const radii = profileRmsRadiiMillimetres();
    const ratio = radii.map( ( value ) => value / radii[ 0 ] );

    // External oracle: these come out of d'Eon & Luebke's published weights and variances, not out
    // of anything this repository chose, so the generator cannot be self-consistently wrong here.
    check( 'published profile RMS radii reproduce',
        Math.abs( radii[ 0 ] - 1.6631 ) < 5e-4 && Math.abs( radii[ 1 ] - 0.3691 ) < 5e-4 && Math.abs( radii[ 2 ] - 0.2226 ) < 5e-4,
        radii.map( ( v ) => v.toFixed( 4 ) ).join( ' / ' ) + ' mm' );

    check( 'the published profile is REDDER than the look spec asks for',
        ratio[ 1 ] < 0.35 && ratio[ 2 ] < 0.22,
        `published 1.000 : ${ ratio[ 1 ].toFixed( 3 ) } : ${ ratio[ 2 ].toFixed( 3 ) } against the spec's 1.00 : 0.35 : 0.22` );

    const scales = specScatterScales();

    // After rescaling, red must be exactly 1 mm (the table is dimensionless) and the ratio must be
    // the spec's.
    const scaledRadii = [ 0, 1, 2 ].map( ( channel ) => {

        let weightSum = 0;
        let secondMoment = 0;

        for ( const gaussian of SKIN_PROFILE_GAUSSIANS ) {

            const variance = gaussian.variance * scales[ channel ] * scales[ channel ];
            weightSum += gaussian.weight[ channel ];
            secondMoment += gaussian.weight[ channel ] * 2 * variance;

        }

        return Math.sqrt( secondMoment / weightSum );

    } );

    check( 'rescaling lands red at exactly 1 mm and the spec ratio on the other two',
        Math.abs( scaledRadii[ 0 ] - 1 ) < 1e-9
        && Math.abs( scaledRadii[ 1 ] - 0.35 ) < 1e-9
        && Math.abs( scaledRadii[ 2 ] - 0.22 ) < 1e-9,
        scaledRadii.map( ( v ) => v.toFixed( 6 ) ).join( ' / ' ) );

    check( 'the profile falls monotonically with distance',
        [ 0.1, 0.5, 1, 2, 4 ].every( ( r, i, all ) =>
            i === 0 || diffusionProfile( r )[ 0 ] < diffusionProfile( all[ i - 1 ] )[ 0 ] ),
        'red channel, 0.1 -> 4 mm' );
}

// ---------------------------------------------------------------------------------------------
section( 'the pre-integrated table' );

const lut = buildPreintegratedSkinLut();

{
    check( 'built at the shipping size',
        lut.width === LUT_WIDTH && lut.height === LUT_HEIGHT,
        `${ lut.width } x ${ lut.height } in ${ lut.buildMilliseconds.toFixed( 2 ) } ms` );

    // THE identity the whole A/B experiment rests on. Row 0 must be Lambert exactly, or "SSS off"
    // is not a controlled comparison against "SSS on" — it is a comparison against a different
    // diffuse term, and every delta measured on the page would be uninterpretable.
    let worstRow0 = 0;
    for ( let i = 0; i < lut.width; i ++ ) {

        const dotNL = ( i / ( lut.width - 1 ) ) * 2 - 1;
        const lambert = Math.fround( Math.max( 0, dotNL ) );
        for ( let c = 0; c < 3; c ++ ) worstRow0 = Math.max( worstRow0, Math.abs( lut.data[ i * 3 + c ] - lambert ) );

    }

    // Compared against the float32 rounding of the analytic value, not against the float64 one:
    // the table is a Float32Array, so `Math.fround` is what "exactly" can mean here. Left explicit
    // rather than loosened to a tolerance, because a tolerance would also admit a table that was
    // merely close, and this identity has to be exact.
    check( 'row 0 (zero curvature) is saturate(N·L) EXACTLY',
        worstRow0 === 0,
        `worst deviation ${ worstRow0 }` );

    // Same thing read the way the shader reads it, through the bilinear sampler.
    let worstSampled = 0;
    for ( let step = 0; step <= 40; step ++ ) {

        const dotNL = -1 + ( 2 * step ) / 40;
        const sampled = sampleLut( lut, dotNL, 0 );
        for ( const value of sampled ) worstSampled = Math.max( worstSampled, Math.abs( value - Math.max( 0, dotNL ) ) );

    }

    check( 'sampled at zero curvature it is Lambert to within one bilinear step',
        worstSampled < 0.005,
        `worst ${ worstSampled.toFixed( 6 ) }` );

    check( 'monotone in N·L at every row',
        ( () => {

            for ( let j = 0; j < lut.height; j ++ ) {

                for ( let i = 1; i < lut.width; i ++ ) {

                    if ( lut.data[ ( j * lut.width + i ) * 3 ] < lut.data[ ( j * lut.width + i - 1 ) * 3 ] - 1e-9 ) return false;

                }

            }

            return true;

        } )(),
        'red channel never decreases as the surface turns toward the light' );

    // The effect itself: red must outrun blue at the terminator, and by more as curvature rises —
    // but only up to the turning point. This assertion was written as monotone all the way to ring
    // 1.0 and FAILED at 1.0 (R/B 1.1891 at 0.5 falling to 1.1616 at 1.0), which is not a defect:
    // past about 0.7 the ring is smaller than the profile in every channel and the separation
    // closes again. The check now says what is true and the next one pins the turning point.
    const atTerminator = [ 0.1, 0.25, 0.5 ].map( ( ring ) => {

        const value = sampleLut( lut, 0.05, ring );
        return { ring, redOverBlue: value[ 0 ] / value[ 2 ] };

    } );

    check( 'red outruns blue at the terminator, and by more as curvature rises',
        atTerminator.every( ( entry, index, all ) =>
            entry.redOverBlue > 1 && ( index === 0 || entry.redOverBlue > all[ index - 1 ].redOverBlue ) ),
        atTerminator.map( ( e ) => `ring ${ e.ring }: R/B ${ e.redOverBlue.toFixed( 4 ) }` ).join( ', ' ) );

    check( 'the separation peaks in the middle of the table and closes again',
        sampleRedOverBlue( lut, 0.5 ) > sampleRedOverBlue( lut, 0.1 )
        && sampleRedOverBlue( lut, 0.5 ) > sampleRedOverBlue( lut, 1.5 ),
        [ 0.1, 0.5, 1.0, 1.5, 2.0 ].map( ( r ) => `${ r }: ${ sampleRedOverBlue( lut, r ).toFixed( 4 ) }` ).join( ', ' ) );

    // 🚩 KNOWN-BAD. Rebuild the table with a grey profile and no retint, and the colour separation
    // must vanish entirely. If it did not, the separation the real table shows would be coming from
    // the integrator rather than from the physics, and every red-terminator claim in this item
    // would be an artefact.
    //
    // The first attempt at this check FAILED at |R − B| = 5.1e-2 with grey WEIGHTS alone, and that
    // was the check working: the spec's 1.00 : 0.35 : 0.22 retint is a second, independent source
    // of separation, and a known-bad has to remove both or it is not measuring what it claims.
    const greyLut = buildGreyProfileLut();
    let greyWorst = 0;
    for ( const ring of [ 0.1, 0.25, 0.5, 1.0, 2.0 ] ) {

        for ( const dotNL of [ -0.2, 0, 0.05, 0.3, 0.8 ] ) {

            const value = sampleLut( greyLut, dotNL, ring );
            greyWorst = Math.max( greyWorst, Math.abs( value[ 0 ] - value[ 2 ] ) );

        }

    }

    check( 'KNOWN-BAD: a grey profile produces no colour separation at all',
        greyWorst < 1e-12,
        `worst |R − B| ${ greyWorst.toExponential( 2 ) } (the real table reaches ${ ( sampleLut( lut, 0.05, 0.7 )[ 0 ] - sampleLut( lut, 0.05, 0.7 )[ 2 ] ).toFixed( 5 ) })` );

    check( 'the v-axis encoding round-trips',
        [ 0, 0.05, 0.4, 1.3, MAX_RING_CURVATURE ].every( ( ring ) =>
            Math.abs( decodeRingCurvature( encodeRingCurvature( ring ) ) - ring ) < 1e-9 ),
        `sqrt encoding over 0..${ MAX_RING_CURVATURE }` );

    check( 'the v-axis clamps rather than wrapping past its top',
        encodeRingCurvature( 99 ) === 1 && encodeRingCurvature( -5 ) === 0,
        'a curvature past the last row saturates, it does not fold onto row 0' );

    // The table's own top end: past the turning point every channel converges on the ring mean of
    // saturate(cos), so MAX_RING_CURVATURE has to be beyond it or the table would be truncating a
    // still-rising function.
    const top = sampleLut( lut, 0.05, MAX_RING_CURVATURE );
    const before = sampleLut( lut, 0.05, MAX_RING_CURVATURE * 0.5 );

    check( 'MAX_RING_CURVATURE is past the colour-separation turning point',
        ( top[ 0 ] - top[ 2 ] ) < ( before[ 0 ] - before[ 2 ] ),
        `R−B ${ ( before[ 0 ] - before[ 2 ] ).toFixed( 5 ) } at ring ${ ( MAX_RING_CURVATURE * 0.5 ).toFixed( 2 ) } falls to ${ ( top[ 0 ] - top[ 2 ] ).toFixed( 5 ) } at ${ MAX_RING_CURVATURE }` );
}

// ---------------------------------------------------------------------------------------------
section( 'the curvature estimator' );

{
    for ( const radiusMetres of [ 0.05, 0.01, 0.002 ] ) {

        const sphere = curvatureOfSphere( radiusMetres, 96 );
        const measured = median( Array.from( meanCurvaturePerVertex( sphere ) ) );
        const expected = 1 / radiusMetres;

        check( `a sphere of radius ${ ( radiusMetres * 1000 ).toFixed( 0 ) } mm reads 1/r`,
            Math.abs( measured - expected ) / expected < 0.01 && measured > 0,
            `expected ${ expected.toFixed( 3 ) } /m, measured ${ measured.toFixed( 3 ) } /m` );

    }

    // 🚩 KNOWN-BAD. The same sphere with every triangle given its own three vertices, nudged apart
    // by 10 µm so the position weld cannot put them back together. Every vertex is then an isolated
    // island with no shared neighbours, and the cotangent Laplacian has nothing to work with. This
    // is exactly what an unwelded glTF looks like along a UV seam.
    const sphere = curvatureOfSphere( 0.05, 96 );
    const shredded = shredMesh( sphere );
    const shreddedMedian = median( Array.from( meanCurvaturePerVertex( shredded ) ) );

    check( 'KNOWN-BAD: an unwelded mesh gives the wrong answer, so the weld is load-bearing',
        Math.abs( shreddedMedian - 20 ) / 20 > 0.2,
        `welded ${ median( Array.from( meanCurvaturePerVertex( sphere ) ) ).toFixed( 3 ) } /m against unwelded ${ shreddedMedian.toFixed( 3 ) } /m (true value 20)` );

    const weld = weldByPosition( sphere.positions, sphere.vertexCount );

    check( 'the weld actually merges the sphere\'s seam column',
        weld.weldedCount < sphere.vertexCount,
        `${ sphere.vertexCount } vertices -> ${ weld.weldedCount } welded` );

    // A plane: exactly zero in the interior. The open boundary is excluded and named, because a
    // cotangent Laplacian is undefined there by construction rather than merely inaccurate.
    const plane = buildPlane( 24 );
    const planeCurvature = meanCurvaturePerVertex( plane );
    let interiorMax = 0;
    for ( let v = 0; v < plane.vertexCount; v ++ ) {

        const x = v % 25;
        const y = Math.floor( v / 25 );
        if ( x === 0 || y === 0 || x === 24 || y === 24 ) continue;
        interiorMax = Math.max( interiorMax, Math.abs( planeCurvature[ v ] ) );

    }

    check( 'KNOWN-BAD: a plane has exactly zero curvature in its interior',
        interiorMax < 1e-9,
        `interior max ${ interiorMax.toExponential( 2 ) } /m` );

    check( 'the curvature encoding round-trips and clamps',
        Math.abs( decodeCurvature( encodeCurvature( 0.25 ) ) - 0.25 ) < 1e-12
        && encodeCurvature( 99 ) === 1
        && decodeCurvature( 1 ) === CURVATURE_ENCODE_MAX_PER_MILLIMETRE,
        `max ${ CURVATURE_ENCODE_MAX_PER_MILLIMETRE } /mm` );

    // The encoding's whole justification: a cheek must get more than a handful of code values.
    const cheekCode = Math.round( encodeCurvature( 0.00455 ) * 255 );
    const linearCode = Math.round( ( 0.00455 / CURVATURE_ENCODE_MAX_PER_MILLIMETRE ) * 255 );

    check( 'the square-root encoding is worth having at facial curvatures',
        cheekCode >= 8 * Math.max( 1, linearCode ),
        `the measured head median of 0.00455 /mm gets ${ cheekCode } code values, against ${ linearCode } under a linear encoding` );
}

// ---------------------------------------------------------------------------------------------
section( 'UV rasterisation' );

{
    const sphere = curvatureOfSphere( 0.05, 32 );
    const constant = new Float64Array( sphere.vertexCount ).fill( 0.375 );
    const map = rasteriseToUv( sphere, constant, 128, 128 );

    let worst = 0;
    let covered = 0;
    for ( let i = 0; i < map.value.length; i ++ ) {

        if ( map.covered[ i ] !== 1 ) continue;
        covered ++;
        worst = Math.max( worst, Math.abs( map.value[ i ] - 0.375 ) );

    }

    check( 'a constant attribute rasterises to that constant everywhere it lands',
        worst < 1e-9 && covered > 0,
        `${ covered } texels, worst deviation ${ worst.toExponential( 2 ) }` );

    check( 'a sphere\'s UV unwrap covers essentially the whole map',
        map.coveredFraction > 0.9,
        `${ ( map.coveredFraction * 100 ).toFixed( 1 ) }%` );

    // Dilation: an island with a hole around it must grow into it, and must not run away along the
    // scan direction (which is what a naive in-place fill does).
    const value = new Float32Array( 32 * 32 );
    const coveredMask = new Uint8Array( 32 * 32 );
    for ( let y = 12; y < 20; y ++ ) for ( let x = 12; x < 20; x ++ ) { value[ y * 32 + x ] = 1; coveredMask[ y * 32 + x ] = 1; }

    const filled = dilate( value, coveredMask, 32, 32, 1 );

    check( 'one dilation pass grows the island by exactly its one-texel ring',
        filled === 10 * 10 - 8 * 8,
        `${ filled } texels filled, expected ${ 10 * 10 - 8 * 8 }` );

    check( 'dilation does not streak along the scan direction',
        value[ 16 * 32 + 22 ] === 0,
        'a texel two rings out stays untouched after one pass' );
}

// ---------------------------------------------------------------------------------------------
section( 'the micro-normal' );

{
    const micro = buildSkinMicroNormal();
    const again = buildSkinMicroNormal();

    check( 'the same seed gives byte-identical output',
        micro.rgba.every( ( byte, index ) => byte === again.rgba[ index ] ),
        `${ micro.size } x ${ micro.size }` );

    check( 'built at the size rendering-stack.md asks for',
        micro.size === MICRO_NORMAL_SIZE && micro.size === 256, `${ micro.size }` );

    // Tileability, measured rather than asserted from the construction: the step across the wrap
    // seam must be statistically the same size as any interior step. A map built with a
    // non-wrapping lattice fails this by an order of magnitude.
    const interior = meanAdjacentStep( micro, ( x ) => x, ( x ) => x + 1, micro.size - 2 );
    const seam = meanAdjacentStep( micro, () => micro.size - 1, () => 0, 1 );

    check( 'the map tiles: the step across the seam matches an interior step',
        seam < interior * 1.5,
        `seam ${ seam.toFixed( 3 ) } code values against interior ${ interior.toFixed( 3 ) }` );

    check( 'KNOWN-BAD: an octave that does not divide the map is refused',
        ( () => {

            try {

                buildSkinMicroNormal( { size: 100 } );
                return false;

            } catch ( error ) {

                return /would not tile/.test( error.message );

            }

        } )(),
        'a 100 px map cannot carry a 16/32/64-cell lattice' );

    // Regression pin. The shipped steepness was SOLVED against G4 (see the header of
    // SkinMicroNormal.js); if someone edits the octaves or the steepness, the measured σ on the
    // browsercheck page moves and this is the cheap early warning.
    check( 'slope RMS matches the value the G4 calibration was done at',
        Math.abs( micro.slopeRms - 0.6823 ) < 5e-4,
        `${ micro.slopeRms.toFixed( 4 ) } — if this moved, re-measure G4 before trusting the σ in the docs` );

    check( 'the encoded normals are unit length and point outward',
        ( () => {

            for ( let i = 0; i < micro.rgba.length; i += 4 ) {

                const x = ( micro.rgba[ i ] / 255 ) * 2 - 1;
                const y = ( micro.rgba[ i + 1 ] / 255 ) * 2 - 1;
                const z = ( micro.rgba[ i + 2 ] / 255 ) * 2 - 1;
                if ( z <= 0 ) return false;
                if ( Math.abs( Math.hypot( x, y, z ) - 1 ) > 0.02 ) return false;

            }

            return true;

        } )(),
        'z > 0 everywhere, |n| = 1 to within the 8-bit quantisation' );
}

// ---------------------------------------------------------------------------------------------

process.stdout.write( `\n${ failed === 0 ? 'PASS' : 'FAIL' }: ${ passed } passed, ${ failed } failed\n` );
process.exitCode = failed === 0 ? 0 : 1;

// --- helpers ---------------------------------------------------------------------------------

/** The table rebuilt with every channel given red's weights. The known-bad for colour. */
function buildGreyProfileLut() {

    const grey = SKIN_PROFILE_GAUSSIANS.map( ( gaussian ) => ( {
        variance: gaussian.variance,
        weight: [ gaussian.weight[ 0 ], gaussian.weight[ 0 ], gaussian.weight[ 0 ] ]
    } ) );

    return buildPreintegratedSkinLut( { gaussians: grey, channelRatio: [ 1, 1, 1 ] } );

}

/** Every triangle given its own three vertices, nudged apart so the position weld cannot help. */
function shredMesh( mesh ) {

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for ( let t = 0; t < mesh.indices.length; t ++ ) {

        const v = mesh.indices[ t ];
        const nudge = ( ( t % 7 ) - 3 ) * 1e-5;

        positions.push( mesh.positions[ v * 3 ] + nudge, mesh.positions[ v * 3 + 1 ], mesh.positions[ v * 3 + 2 ] );
        normals.push( mesh.normals[ v * 3 ], mesh.normals[ v * 3 + 1 ], mesh.normals[ v * 3 + 2 ] );
        uvs.push( mesh.uvs[ v * 2 ], mesh.uvs[ v * 2 + 1 ] );
        indices.push( t );

    }

    return {
        positions: Float64Array.from( positions ),
        normals: Float64Array.from( normals ),
        uvs: Float64Array.from( uvs ),
        indices: Uint32Array.from( indices ),
        vertexCount: positions.length / 3
    };

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

/** Mean absolute difference in code values between two columns, over every row. */
function meanAdjacentStep( micro, columnA, columnB, columns ) {

    let sum = 0;
    let count = 0;

    for ( let column = 0; column < columns; column ++ ) {

        const xa = columnA( column );
        const xb = columnB( column );

        for ( let y = 0; y < micro.size; y ++ ) {

            for ( let channel = 0; channel < 3; channel ++ ) {

                sum += Math.abs( micro.rgba[ ( y * micro.size + xa ) * 4 + channel ] - micro.rgba[ ( y * micro.size + xb ) * 4 + channel ] );
                count ++;

            }

        }

    }

    return sum / count;

}

function sampleRedOverBlue( lut, ringCurvature ) {

    const value = sampleLut( lut, 0.05, ringCurvature );
    return value[ 0 ] / value[ 2 ];

}

function median( values ) {

    const sorted = values.slice().sort( ( a, b ) => a - b );
    return sorted[ Math.floor( sorted.length / 2 ) ];

}
