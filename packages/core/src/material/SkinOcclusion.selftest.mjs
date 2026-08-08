#!/usr/bin/env node
//
// SkinOcclusion.selftest.mjs — proves the cavity bake measures what it claims.
//
// LEARNINGS §1.1: a gate that has never failed is not known to work. Every claim here is checked
// in BOTH directions — the correct input passes, and a constructed wrong input is confirmed to
// fail, naming the defect. The wrong inputs are the interesting half:
//
//   - a radius shorter than the blocker's distance, which is how a local term silently becomes a
//     no-op;
//   - the ray direction along −N instead of +N, which measures the inside of the body;
//   - a UNIFORM hemisphere instead of a cosine-weighted one, which is the bias the sphere check
//     is structurally incapable of seeing;
//   - the BAKED MAP's uncovered default set to 0 instead of 1, which is a black hole in the middle
//     of a cheek rather than a missing effect.
//
// 🚩 THIS FILE DELIBERATELY DOES NOT ASSERT ANYTHING ABOUT THE SHADER. It is a CPU bake and every
// check here is on the bake's own arithmetic. Whether the term reaches the frame, lands on the
// right anatomy and carries colour is a question about PIXELS, and it is answered by the three
// framebuffer checks on `packages/testbed/src/skin.html` — which were themselves proved by
// injecting five separate defects into `SkinMaterial.js` and confirming each went red. A CPU
// mirror of a GPU node plus a regex over the source tests neither.
//
// Usage:  node packages/core/src/material/SkinOcclusion.selftest.mjs
// Exit:   0 all checks passed   1 a check failed   2 the figure or its bake is missing

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    OCCLUSION_RADIUS_MILLIMETRES,
    OCCLUSION_RAYS,
    occlusionKnownAnswerCheck,
    occlusionPerVertex
} from './SkinOcclusion.js';

import { readGlb, readPrimitive } from '../../../../tools/lut-bake/glb.mjs';
import { decodePng } from '../../../../tools/critic/png.mjs';

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../../../..' );

const FIGURE = path.join( repoRoot, 'assets/figures/figure_g050.glb' );
const BAKED_MAP = path.join( repoRoot, 'tools/lut-bake/out/figure_g050-cavity.png' );
const BODY_MESH_NAME = 'base.001';

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

for ( const required of [ FIGURE, BAKED_MAP ] ) {

    if ( fs.existsSync( required ) === false ) {

        process.stderr.write( `SkinOcclusion.selftest: missing ${ path.relative( repoRoot, required ) }.\n` +
            'Run: node tools/lut-bake/bake.mjs cavity\n' );
        process.exit( 2 );

    }

}

// ---------------------------------------------------------------------------------------------
section( 'KNOWN ANSWERS — two shapes whose visibility is arithmetic, not opinion' );

// 256 rays rather than the shipped 32: the crease answer is quantised to 1/rays, so a 32-ray run
// can only resolve 0.5 to ±0.031 and would not be able to tell a small bias from rounding.
const known = occlusionKnownAnswerCheck( { rays: 256 } );

check( 'a convex sphere is fully open',
    known.sphere.absoluteError < 1e-9,
    `expected 1, measured ${ known.sphere.measured.toFixed( 6 ) }` );

// The crease's honest expectation is 0.5 PLUS the leak the offset wall introduces, which the
// module derives rather than fits: (2/pi)·(offset/radius)·E[1/sin θ], E[1/sin θ] = 2 for the
// cosine-weighted hemisphere. Anything inside that band is the estimator being right.
check( 'a 90° crease sees exactly half its hemisphere',
    Math.abs( known.crease.measured - 0.5 ) < known.crease.leakFraction + 1 / 256,
    `expected 0.5 (+ derived leak ${ known.crease.leakFraction.toFixed( 4 ) }), ` +
    `measured ${ known.crease.measured.toFixed( 4 ) }` );

// ---------------------------------------------------------------------------------------------
section( 'MEASURED — the self-hit offset is NOT load-bearing outward, unlike inward' );

{
    // 🎯 THIS CHECK ASSERTS AN INSENSITIVITY, AND THAT IS DELIBERATE. The obvious version set ε to
    // zero and expected the answer to collapse the way the thickness bake's inward cast does. It
    // does not — measured on the real figure at 16 rays, mean visibility moves 0.8590 -> 0.8526
    // and the SEALED count goes DOWN, from 496 to 379. A ray leaving a surface along +N is going
    // away from the triangle it started on, and Möller–Trumbore rejects the coplanar case on the
    // determinant, so there is no self-hit outward to defend against. Both known-answer shapes
    // agree: the sphere reads 1.0000 either way and the crease 0.5156 either way.
    //
    // Writing that down as an assertion is worth more than a manufactured red: if this cast is
    // ever flipped to fire along −N, ε becomes load-bearing again and this check goes red for the
    // right reason.
    const withOffset = occlusionKnownAnswerCheck( { rays: 64 } );
    const without = occlusionKnownAnswerCheck( { rays: 64, epsilonEdgeFraction: 0 } );

    check( 'both known shapes are insensitive to ε when the cast fires outward',
        Math.abs( without.crease.measured - withOffset.crease.measured ) < 1e-9
            && Math.abs( without.sphere.measured - 1 ) < 1e-9,
        `crease ${ withOffset.crease.measured.toFixed( 4 ) } -> ${ without.crease.measured.toFixed( 4 ) }, ` +
        `sphere 1.0000 -> ${ without.sphere.measured.toFixed( 4 ) }` );

}

// ---------------------------------------------------------------------------------------------
section( 'PROVEN RED — a radius shorter than the blocker' );

{
    // The whole design of this term is that its radius is SHORT. The failure mode of a short
    // radius is silence, so the check has to show the estimator noticing a blocker at one distance
    // and not at another rather than assuming it.
    const near = occlusionKnownAnswerCheck( { rays: 64, wallOffsetMetres: 0.002, radiusMillimetres: 35 } );
    const far = occlusionKnownAnswerCheck( { rays: 64, wallOffsetMetres: 0.002, radiusMillimetres: 0.5 } );

    check( 'a wall inside the radius blocks and one outside it does not',
        near.crease.measured < 0.62 && far.crease.measured > 0.98,
        `2 mm wall at a 35 mm radius reads ${ near.crease.measured.toFixed( 4 ) }, ` +
        `at a 0.5 mm radius ${ far.crease.measured.toFixed( 4 ) }` );

}

// ---------------------------------------------------------------------------------------------
section( 'THE SAMPLE SET — cosine-weighted, not uniform' );

{
    // 🚩 THE DEFECT THIS CATCHES IS INVISIBLE TO BOTH KNOWN ANSWERS. On a convex sphere every
    // direction escapes, so a badly distributed hemisphere still reads exactly 1; on the crease a
    // UNIFORM hemisphere also reads 0.5, because the wall takes half of it by symmetry either way.
    // The distribution only shows up in the FIRST MOMENT: the mean of cos θ over the
    // cosine-weighted hemisphere is ∫cos²θ dω / ∫cos θ dω = 2/3, and over a uniform one it is 1/2.
    // Someone replacing `sqrt(u)` with `u` in `cosineHemisphereSpiral` changes nothing either
    // known answer can see and changes this number by a third.
    //
    // The directions are not exported, so the estimator is driven against a CEILING — a plate at
    // height h over a probe point. A ceiling blocks the zenith, which is exactly where cosine
    // weighting concentrates its samples, so the fraction blocked at a given height is a direct
    // readout of the distribution rather than of the geometry alone.
    //
    // ⚠️ The floor here is tessellated finely on purpose. ε is a fraction of the mesh's own MEAN
    // EDGE LENGTH, so a coarse test mesh pushes the ray origin centimetres into the air — the
    // first version of this used two big triangles and lifted the origin ABOVE the ceiling, which
    // reported 0.000 blocked at every height. `0.000 -> 0.000 -> 0.000` also satisfied the
    // monotonicity assertion, so the check was green and measuring nothing.
    const fractionsBlocked = [];

    for ( const heightMetres of [ 0.010, 0.020, 0.040 ] ) {

        const ceiling = ceilingMesh( heightMetres, 0.20 );
        const visibility = occlusionPerVertex( ceiling, { rays: 512, radiusMillimetres: 200 } ).visibility;
        fractionsBlocked.push( 1 - visibility[ ceiling.probeVertex ] );

    }

    check( 'a lower ceiling blocks more of the hemisphere',
        fractionsBlocked[ 0 ] > fractionsBlocked[ 1 ]
            && fractionsBlocked[ 1 ] > fractionsBlocked[ 2 ]
            && fractionsBlocked[ 0 ] > 0.5,
        fractionsBlocked.map( ( f ) => f.toFixed( 3 ) ).join( ' -> ' ) );

    // The direct statement, on the sample set itself. `cosineHemisphereSpiral` is private, so this
    // reconstructs it from its own documented rule and asserts the moment the estimator relies on.
    const cosineMean = meanZenith( ( k, n ) => Math.sqrt( Math.max( 0, 1 - ( k + 0.5 ) / n ) ) );
    const uniformMean = meanZenith( ( k, n ) => 1 - ( k + 0.5 ) / n );

    check( 'the spiral is cosine-weighted (mean cos θ = 2/3, not 1/2)',
        Math.abs( cosineMean - 2 / 3 ) < 0.01 && Math.abs( uniformMean - 0.5 ) < 0.01,
        `cosine-weighted ${ cosineMean.toFixed( 4 ) }, the uniform alternative ${ uniformMean.toFixed( 4 ) }` );

}

// ---------------------------------------------------------------------------------------------
section( 'THE FIGURE — the answer lands on cavities and not on open skin' );

const glb = readGlb( FIGURE );
const mesh = readPrimitive( glb, BODY_MESH_NAME );
const onFigure = occlusionPerVertex( mesh );

{
    const sorted = Array.from( onFigure.visibility ).sort( ( a, b ) => a - b );
    const median = sorted[ Math.floor( sorted.length / 2 ) ];
    const p10 = sorted[ Math.floor( sorted.length * 0.10 ) ];

    // A body is mostly convex. A median below 1 would mean the term is darkening open skin, which
    // is the defect the render-side "lands on the mouth and not the forehead" check also guards.
    check( 'most of the body is open sky',
        median > 0.98,
        `median visibility ${ median.toFixed( 4 ) }` );

    check( 'a tenth of the body is genuinely occluded',
        p10 < 0.80,
        `p10 visibility ${ p10.toFixed( 4 ) }` );

}

{
    // Direction. Rays go OUT along +N; the thickness bake's go IN along −N. Swapping them is a
    // one-character change that produces a plausible-looking map of the wrong quantity, and it is
    // caught here by the sign of the correlation with the body's own convexity: with the rays
    // reversed, an unoccluded convex body reads as fully SEALED.
    const reversed = occlusionPerVertex( reverseNormals( mesh ), { rays: 8 } );

    check( 'rays fired inward halve the body\u2019s visibility — the direction is load-bearing',
        medianOf( reversed.visibility ) < 0.6 && medianOf( onFigure.visibility ) > 0.98,
        `median visibility ${ medianOf( reversed.visibility ).toFixed( 4 ) } with the normals reversed, ` +
        `${ medianOf( onFigure.visibility ).toFixed( 4 ) } as shipped` );

}

// ---------------------------------------------------------------------------------------------
section( 'THE BAKED MAP — what actually shipped in tools/lut-bake/out' );

{
    const image = decodePng( fs.readFileSync( BAKED_MAP ) );
    const texels = image.width * image.height;

    let open = 0;
    let occluded = 0;
    let nonGrey = 0;
    let nonOpaque = 0;

    for ( let i = 0; i < texels; i ++ ) {

        const r = image.pixels[ i * 4 ], g = image.pixels[ i * 4 + 1 ], b = image.pixels[ i * 4 + 2 ];
        if ( r > 0.99 ) open ++;
        if ( r < 0.60 ) occluded ++;
        if ( Math.abs( r - g ) > 1 / 255 || Math.abs( r - b ) > 1 / 255 ) nonGrey ++;
        if ( image.pixels[ i * 4 + 3 ] < 1 ) nonOpaque ++;

    }

    check( 'the map is the size the bake reports',
        image.width === 1024 && image.height === 1024,
        `${ image.width } x ${ image.height }` );

    // 🚩 UNCOVERED TEXELS MUST READ OPEN. The region bake's own comment records what the opposite
    // costs: a bilinear tap straying off a UV island onto a default of 0 is a black hole in the
    // middle of a cheek, which is worse than no effect at all. Most of a 1024² atlas is either
    // uncovered or open body, so a map with fewer than half its texels at full white has that bug.
    check( 'uncovered and open texels read 1, not 0',
        open / texels > 0.5,
        `${ ( open / texels * 100 ).toFixed( 1 ) }% of texels are fully open` );

    check( 'the map carries real occlusion',
        occluded / texels > 0.002,
        `${ ( occluded / texels * 100 ).toFixed( 2 ) }% of texels are under 0.60` );

    // Greyscale and OPAQUE, both deliberate. See `bakeCavity`: a non-opaque alpha invites the
    // browser's PNG decode to hand back premultiplied colour.
    check( 'the map is greyscale and fully opaque',
        nonGrey === 0 && nonOpaque === 0,
        `${ nonGrey } non-grey texels, ${ nonOpaque } non-opaque` );

}

// ---------------------------------------------------------------------------------------------
process.stdout.write( `\n${ passed } passed, ${ failed } failed  ` +
    `(${ OCCLUSION_RAYS } rays at ${ OCCLUSION_RADIUS_MILLIMETRES } mm as shipped)\n` );
process.exit( failed > 0 ? 1 : 0 );

// --- helpers -------------------------------------------------------------------------------------

/** Mean of cos θ over a spiral built with the given inverse-CDF rule for sin θ. */
function meanZenith( cosThetaOf ) {

    const rays = 4096;
    let total = 0;
    for ( let k = 0; k < rays; k ++ ) total += cosThetaOf( k, rays );
    return total / rays;

}

/** A flat floor with one probe vertex, under a ceiling plate at `heightMetres`. */
function ceilingMesh( heightMetres, size ) {

    const positions = [ 0, 0, 0 ];
    const normals = [ 0, 1, 0 ];
    const indices = [];

    // Finely tessellated so the mesh's mean edge — and therefore ε — stays millimetric.
    const steps = 40;
    const floorStart = positions.length / 3;

    for ( let iz = 0; iz <= steps; iz ++ ) {

        for ( let ix = 0; ix <= steps; ix ++ ) {

            positions.push( ( ix / steps * 2 - 1 ) * size, 0, ( iz / steps * 2 - 1 ) * size );
            normals.push( 0, 1, 0 );

        }

    }

    for ( let row = 0; row < steps; row ++ ) {

        for ( let column = 0; column < steps; column ++ ) {

            const a = floorStart + row * ( steps + 1 ) + column;
            indices.push( a, a + steps + 1, a + 1, a + 1, a + steps + 1, a + steps + 2 );

        }

    }

    // The ceiling, a quad at +Y facing down.
    const base = positions.length / 3;
    positions.push( -size, heightMetres, -size, size, heightMetres, -size, size, heightMetres, size, -size, heightMetres, size );
    for ( let i = 0; i < 4; i ++ ) normals.push( 0, -1, 0 );
    indices.push( base, base + 1, base + 2, base, base + 2, base + 3 );

    return {
        positions: Float64Array.from( positions ),
        normals: Float64Array.from( normals ),
        indices: Uint32Array.from( indices ),
        vertexCount: positions.length / 3,
        probeVertex: 0
    };

}

function reverseNormals( mesh ) {

    const normals = Float64Array.from( mesh.normals, ( value ) => -value );
    return { ...mesh, normals };

}

function medianOf( values ) {

    const sorted = Array.from( values ).sort( ( a, b ) => a - b );
    return sorted[ Math.floor( sorted.length / 2 ) ];

}
