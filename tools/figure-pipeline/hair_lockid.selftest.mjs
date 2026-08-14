#!/usr/bin/env node
//
// hair_lockid.selftest.mjs — the lock channel's operators, against shapes whose answer is
// arithmetic.
//
// 🚩 WHY THIS FILE EXISTS RATHER THAN A `console.log` IN THE GATE. This project's signature failure
// is a statistic structurally blind to the defect it was written for — `docs/CHECKPOINT.md` §5
// lists six, the most recent found on the judges' own side. The standing rule that came out of it
// is: **validate the operator against a shape whose answer is arithmetic BEFORE pointing it at the
// groom.** `verify_glb.mjs`'s lock clause re-derives every card's lock membership from the sixteen
// centres in the file's own extras; if `nearestTwoSites` were wrong, the clause would agree with a
// wrong generator and pass. These are the shapes where the right answer is known on paper.
//
//   node tools/figure-pipeline/hair_lockid.selftest.mjs
//

import {
    cardRoot, componentLockSpread, decodeLockIndex, encodeLockChannel, nearestTwoSites
} from './hair_lockid.mjs';

let checks = 0;
let failures = 0;

function check( label, actual, expected, tolerance = 0 ) {

    checks ++;

    const ok = typeof expected === 'number'
        ? Math.abs( actual - expected ) <= tolerance
        : actual === expected;

    if ( ok === false ) {

        failures ++;
        console.log( `  FAIL  ${ label }: ${ actual } != ${ expected } (tolerance ${ tolerance })` );

    } else {

        console.log( `  ok    ${ label }  ${ typeof actual === 'number' ? actual.toFixed( 6 ) : actual }` );

    }

}

console.log( '--- 1. one site: F1 is the distance to it and F2 is defined to be the same ---' );
//
// The degenerate case has to be pinned rather than left to whatever `Infinity` does downstream:
// `edge = (F2 − F1)/scale` must come out 0, not NaN, so a one-lock groom reads as "everywhere is a
// boundary" instead of poisoning the channel.
{
    const one = nearestTwoSites( [ 3, 4, 0 ], [ 0, 0, 0 ] );
    check( 'index', one.index, 0 );
    check( 'F1 = |(3,4,0)| = 5', one.nearest, 5, 1e-12 );
    check( 'F2 = F1', one.second, 5, 1e-12 );

    const encoded = encodeLockChannel( [ 3, 4, 0 ], [ 0, 0, 0 ], 0.05 );
    check( 'edge is 0 and not NaN', encoded.edge, 0, 0 );
    check( 'identity = 0.5 for a single site', encoded.identity, 0.5, 0 );
}

console.log( '' );
console.log( '--- 2. two sites on a line: F2 − F1 is exactly the offset from the midpoint, doubled ---' );
//
// Sites at x = 0 and x = 1. A point at x = t between them has F1 = t, F2 = 1 − t for t < 0.5, so
// F2 − F1 = 1 − 2t. Every reading below is that line evaluated.
{
    const sites = [ 0, 0, 0, 1, 0, 0 ];

    for ( const [ t, expectedIndex, expectedEdge ] of [
        [ 0.00, 0, 1.0 ], [ 0.10, 0, 0.8 ], [ 0.25, 0, 0.5 ],
        [ 0.50, 0, 0.0 ], [ 0.75, 1, 0.5 ], [ 1.00, 1, 1.0 ] ] ) {

        const found = nearestTwoSites( sites, [ t, 0, 0 ] );
        check( `t=${ t.toFixed( 2 ) } index`, found.index, expectedIndex );
        check( `t=${ t.toFixed( 2 ) } F2−F1 = |1−2t|`, found.second - found.nearest, expectedEdge, 1e-12 );

    }

    // The tie at the midpoint goes to the lower index, which is what Python's stable `sorted` does.
    check( 'the midpoint tie breaks low', nearestTwoSites( sites, [ 0.5, 0, 0 ] ).index, 0 );
}

console.log( '' );
console.log( '--- 3. a unit square lattice: F1, F2 and the edge distance are all closed form ---' );
//
// Sites on the integer lattice of the plane z = 0. Three points with known answers:
//   at a site        F1 = 0,       F2 = 1            edge = 1
//   at a cell edge   F1 = F2 = 0.5                   edge = 0
//   at a cell corner F1 = F2 = √2/2 = 0.70710678      edge = 0
{
    const sites = [];
    for ( let x = 0; x <= 3; x ++ ) for ( let y = 0; y <= 3; y ++ ) sites.push( x, y, 0 );

    const atSite = nearestTwoSites( sites, [ 1, 1, 0 ] );
    check( 'at a site, F1 = 0', atSite.nearest, 0, 1e-12 );
    check( 'at a site, F2 = 1', atSite.second, 1, 1e-12 );

    const atEdge = nearestTwoSites( sites, [ 1.5, 1, 0 ] );
    check( 'at an edge, F1 = 0.5', atEdge.nearest, 0.5, 1e-12 );
    check( 'at an edge, F2 − F1 = 0', atEdge.second - atEdge.nearest, 0, 1e-12 );

    const atCorner = nearestTwoSites( sites, [ 1.5, 1.5, 0 ] );
    check( 'at a corner, F1 = √2/2', atCorner.nearest, Math.SQRT2 / 2, 1e-12 );
    check( 'at a corner, F2 − F1 = 0', atCorner.second - atCorner.nearest, 0, 1e-12 );

    // 🚩 THE CLAUSE THAT WOULD CATCH A NEIGHBOURHOOD SCAN. A point far outside the lattice has its
    // two nearest sites at the lattice's own corner (3,3) and the site below it (3,2) — 10 and
    // √101 units away, which no 3x3 cell scan around the point would ever reach. ⚠️ The first
    // version of this clause expected √121 by picking (2,3) as the second site, and the run said
    // √101: the lattice's neighbour along the OTHER axis is nearer, because the point is offset in
    // x alone. The operator was right and the prediction was wrong, which is the direction a
    // validation is supposed to be able to fail in.
    const outside = nearestTwoSites( sites, [ 13, 3, 0 ] );
    check( 'far outside, F1 = 10 (the corner site)', outside.nearest, 10, 1e-12 );
    check( 'far outside, F2 = √101', outside.second, Math.sqrt( 101 ), 1e-12 );
}

console.log( '' );
console.log( '--- 4. the index round trip is exact at every count this pipeline could use ---' );
//
// `floor((i + 0.5)/n · n) = i` is arithmetic, but f32 rounding is not, and the whole channel rests
// on the recovery being exact. Swept over every index of every count from 2 to 64, through a
// Float32Array so the storage the GLB actually uses is the one being asserted.
{
    let worst = 0;

    for ( let count = 2; count <= 64; count ++ ) {

        for ( let index = 0; index < count; index ++ ) {

            const stored = new Float32Array( [ ( index + 0.5 ) / count ] )[ 0 ];
            const recovered = decodeLockIndex( stored, count );
            if ( recovered !== index ) worst ++;

        }

    }

    check( 'round-trip failures over 2..64 x every index', worst, 0 );

    // And the property the shipped count relies on: at 16, every emitted value is an odd multiple
    // of 1/32, so f32 stores it with no error at all.
    let exact = 0;
    for ( let index = 0; index < 16; index ++ ) {

        const wanted = ( index + 0.5 ) / 16;
        if ( new Float32Array( [ wanted ] )[ 0 ] === wanted ) exact ++;

    }
    check( 'at 16 locks, values stored exactly in f32', exact, 16 );
}

console.log( '' );
console.log( '--- 5. cardRoot picks the ring at MIN v, which is the file\'s convention and not the build\'s ---' );
//
// A three-ring ribbon laid out the way the exported GLB carries it: v = 0 at the root, rising to 1
// at the tip, because Blender's exporter flips v on every UV layer. The root midpoint is
// arithmetic — (±0.5, 0, 0) averages to the origin — and the tip ring is deliberately at a
// different position so picking the wrong end fails loudly rather than by a rounding.
{
    const positions = new Float32Array( [
        - 0.5, 0, 0, 0.5, 0, 0,          // root ring, v = 0
        - 0.4, - 1, 0, 0.4, - 1, 0,      // middle,    v = 0.5
        - 0.3, - 2, 0, 0.3, - 2, 0       // tip,       v = 1
    ] );
    const uvs = new Float32Array( [ 0, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1, 1, 1 ] );

    const root = cardRoot( [ 0, 1, 2, 3, 4, 5 ], positions, uvs );
    check( 'root ring has two corners', root.corners, 2 );
    check( 'root x', root.point[ 0 ], 0, 1e-12 );
    check( 'root y is the root ring and not the tip ring', root.point[ 1 ], 0, 1e-12 );
}

console.log( '' );
console.log( '--- 6. componentLockSpread reports zero spread for a label and non-zero for a ramp ---' );
{
    const constant = new Float32Array( [ 0.34375, 0.7, 0.34375, 0.7, 0.34375, 0.7 ] );
    const label = componentLockSpread( [ 0, 1, 2 ], constant );
    check( 'constant identity spread', label.identitySpread, 0, 0 );
    check( 'constant edge spread', label.edgeSpread, 0, 0 );
    check( 'identity read back', label.identity, 0.34375, 0 );
    check( 'decodes to lock 5', decodeLockIndex( label.identity, 16 ), 5 );

    const ramp = new Float32Array( [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6 ] );
    const swept = componentLockSpread( [ 0, 1, 2 ], ramp );
    check( 'ramped identity spread', swept.identitySpread, 0.4, 1e-7 );
}

console.log( '' );
console.log( `${ failures === 0 ? 'PASS' : 'FAIL' } — ${ checks - failures }/${ checks } assertions` );

process.exit( failures === 0 ? 0 : 1 );
