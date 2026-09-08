/** Analytic rejection fixtures for triangle interiors; no Blender, browser or supplied assets. */
import assert from 'node:assert/strict';
import { Ray, Vector3 } from 'three';
import { intersectTriangles, clipIntersectionToBounds, measureHairSurface } from './hair_surface.mjs';
let checks = 0;
function check( label, fn ) { fn(); checks ++; console.log( `PASS ${ label }` ); }
const triangle = [ [ -2, -2, 0 ], [ 2, -2, 0 ], [ 0, 2, 0 ] ];
const vertical = [ [ -1, 0, -1 ], [ 1, 0, -1 ], [ 0, 0, 2 ] ];
const box = { min: [ -.1, -.1, -.1 ], max: [ .1, .1, .1 ] };
const whole = { min: [ -10, -10, -10 ], max: [ 10, 10, 10 ] };
const mesh = vertices => ( { positions: vertices.flat(), indices: [ 0, 1, 2 ], uvs: [ 0, 0, 1, 0, 0, 1 ] } );
const near = ( a, b ) => assert.ok( Math.abs( a - b ) < 1e-8, `${ a } != ${ b }` );
check( 'Actual interiors cross with all six vertices off the other triangle', () => {
    const hit = intersectTriangles( triangle, vertical );
    assert.equal( hit.kind, 'transverse' ); assert.equal( hit.points.length, 2 );
    const x = hit.points.map( p => p[ 0 ] ).sort( ( a, b ) => a - b ); near( x[ 0 ], -2 / 3 ); near( x[ 1 ], 2 / 3 );
    hit.points.forEach( p => { near( p[ 1 ], 0 ); near( p[ 2 ], 0 ); } );
} );
check( 'Winding and argument order preserve the same crossing', () => {
    for ( const [ a, b ] of [ [ triangle, vertical ], [ vertical, triangle ], [ [ ...triangle ].reverse(), vertical ], [ triangle, [ ...vertical ].reverse() ] ] ) {
        const hit = intersectTriangles( a, b ); assert.equal( hit.points.length, 2 );
        near( Math.min( ...hit.points.map( p => p[ 0 ] ) ), -2 / 3 ); near( Math.max( ...hit.points.map( p => p[ 0 ] ) ), 2 / 3 );
    }
} );
check( 'Overlapping boxes alone do not imply triangle overlap', () => {
    assert.equal( intersectTriangles( [ [ 0, 0, 0 ], [ 2, 0, 0 ], [ 0, 2, 0 ] ], [ [ 2, 2, 0 ], [ 2, .5, 0 ], [ .5, 2, 0 ] ] ), null );
    assert.equal( intersectTriangles( triangle, triangle.map( p => [ p[ 0 ], p[ 1 ], .1 ] ) ), null );
} );
check( 'Region slice finds a crossing even when neither segment endpoint is inside', () => {
    const points = clipIntersectionToBounds( [ [ -1, 0, 0 ], [ 1, 0, 0 ] ], box );
    assert.equal( points.length, 2 ); near( Math.min( ...points.map( p => p[ 0 ] ) ), -.1 ); near( Math.max( ...points.map( p => p[ 0 ] ) ), .1 );
    assert.deepEqual( clipIntersectionToBounds( [ [ -1, 1, 0 ], [ 1, 1, 0 ] ], box ), [] );
} );
check( 'Coplanar containment and partial overlap return the actual overlap polygon', () => {
    const small = [ [ -.2, -.2, 0 ], [ .2, -.2, 0 ], [ 0, .2, 0 ] ];
    for ( const [ a, b ] of [ [ triangle, small ], [ small, triangle ] ] ) {
        const hit = intersectTriangles( a, b ); assert.equal( hit.kind, 'coplanar' ); assert.equal( hit.points.length, 3 );
        near( Math.min( ...hit.points.map( p => p[ 1 ] ) ), -.2 ); near( Math.max( ...hit.points.map( p => p[ 1 ] ) ), .2 );
    }
    const clipped = clipIntersectionToBounds( intersectTriangles( triangle, small ).points, box );
    assert.ok( clipped.length >= 4 ); assert.ok( clipped.every( p => p.every( ( x, i ) => x >= box.min[ i ] - 1e-8 && x <= box.max[ i ] + 1e-8 ) ) );
} );
check( 'Point and edge contact count conservatively, including coplanar edge contact', () => {
    const base = [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 0, 1, 0 ] ];
    const pointHit = intersectTriangles( base, [ [ 1, 0, 0 ], [ 2, 0, 1 ], [ 2, 1, 1 ] ] );
    assert.equal( pointHit.points.length, 1 ); assert.equal( pointHit.kind, 'transverse' );
    const hit = intersectTriangles( base, [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 0, -1, 0 ] ] ); assert.equal( hit.points.length, 2 );
} );
check( 'Vertical coplanar triangles and translated triangles do not assume the XY plane', () => {
    const rotate = p => [ p[ 2 ] + 10, p[ 0 ] - 2, p[ 1 ] + 4 ];
    assert.equal( intersectTriangles( triangle.map( rotate ), triangle.map( rotate ) ).points.length, 3 );
    assert.equal( intersectTriangles( triangle.map( rotate ), vertical.map( rotate ) ).points.length, 2 );
} );
check( 'Malformed, nonfinite and degenerate triangles fail rather than quietly passing', () => {
    assert.throws( () => intersectTriangles( triangle, [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 2, 0, 0 ] ] ), /Degenerate/ );
    assert.throws( () => intersectTriangles( triangle, [ [ NaN, 0, 0 ], [ 1, 0, 0 ], [ 0, 1, 0 ] ] ), /finite/ );
    assert.throws( () => intersectTriangles( triangle, vertical, 0 ), /epsilon/ );
    assert.throws( () => measureHairSurface( { ...mesh( triangle ), indices: [ 0, 1, 30 ] }, mesh( vertical ), { headBounds: whole } ), /index/ );
} );
check( 'Mesh gate clips entire intersections and alpha cannot change a crossing verdict', () => {
    const opts = { headBounds: whole, faceBounds: box };
    const clearAlpha = measureHairSurface( mesh( triangle ), mesh( vertical ), { ...opts, alphaSampler: () => 0 } );
    const opaque = measureHairSurface( mesh( triangle ), mesh( vertical ), { ...opts, alphaSampler: () => 1 } );
    assert.equal( clearAlpha.head.pairs, 1 ); assert.equal( clearAlpha.face.pairs, 1 ); assert.equal( opaque.face.pairs, 1 );
    assert.equal( clearAlpha.face.pairsWithNonzeroAlphaWitness, 0 ); assert.equal( opaque.face.pairsWithAlphaAtLeastHalfWitness, 1 );
    assert.equal( clearAlpha.headPairsWithoutFaceIntersection.pairs, 0 );
    near( opaque.face.examples[ 0 ].alphaWitnesses.at( -1 ).uv[ 0 ], .25 );
    near( opaque.face.examples[ 0 ].alphaWitnesses.at( -1 ).uv[ 1 ], .5 );
} );
check( 'Head-only crossings are reported separately and empty selections pass', () => {
    const away = { min: [ 5, 5, 5 ], max: [ 6, 6, 6 ] };
    const head = measureHairSurface( mesh( triangle ), mesh( vertical ), { headBounds: whole, faceBounds: away } );
    assert.equal( head.head.pairs, 1 ); assert.equal( head.face.pairs, 0 ); assert.equal( head.headPairsWithoutFaceIntersection.pairs, 1 );
    assert.equal( measureHairSurface( mesh( triangle ), mesh( vertical ), { headBounds: away } ).head.pairs, 0 );
} );
check( 'Bad bounds and invalid alpha annotations fail explicitly', () => {
    assert.throws( () => clipIntersectionToBounds( [ [ 0, 0, 0 ] ], { min: [ 1, 0, 0 ], max: [ 0, 0, 0 ] } ), /bounds/ );
    assert.throws( () => measureHairSurface( { ...mesh( triangle ), uvs: [] }, mesh( vertical ), { alphaSampler: () => 1 } ), /UVs/ );
    assert.throws( () => measureHairSurface( mesh( triangle ), mesh( vertical ), { headBounds: whole, faceBounds: box, alphaSampler: () => NaN } ), /Alpha sampler/ );
} );
check( 'Seeded general-position pairs agree with an independent six-edge ray test', () => {
    // Different construction: each finite edge ray against the opposite triangle in both
    // directions. Coplanar/degenerate cases are covered by analytic fixtures above.
    let seed = 13297;
    const random = () => { seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0; return seed / 2 ** 32 * 2 - 1; };
    const ray = new Ray(), hit = new Vector3(), direction = new Vector3();
    let crossings = 0;
    for ( let sample = 0; sample < 1000; sample ++ ) {
        const a = Array.from( { length: 3 }, () => [ random(), random(), random() ] );
        const b = Array.from( { length: 3 }, () => [ random(), random(), random() ] );
        const aa = a.map( p => new Vector3( ...p ) ), bb = b.map( p => new Vector3( ...p ) );
        let reference = false;
        for ( const [ edges, opposite ] of [ [ aa, bb ], [ bb, aa ] ] ) for ( let i = 0; i < 3; i ++ ) {
            direction.copy( edges[ ( i + 1 ) % 3 ] ).sub( edges[ i ] );
            const length = direction.length(); ray.set( edges[ i ], direction.divideScalar( length ) );
            if ( ray.intersectTriangle( ...opposite, false, hit ) && hit.distanceTo( edges[ i ] ) <= length + 1e-9 ) reference = true;
        }
        assert.equal( !! intersectTriangles( a, b ), reference, `seeded pair ${ sample }` );
        if ( reference ) crossings ++;
    }
    assert.ok( crossings > 100 && crossings < 900, 'fixture exercises both crossing and separated pairs' );
} );
console.log( `\n${ checks }/${ checks } analytic groups passed.` );
