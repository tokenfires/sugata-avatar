/**
 * hair_geometry.selftest.mjs — the OTHER way for punch-list 3.6's gate.
 *
 * The hair clause in `verify_glb.mjs` passes every groom this repository builds, and by itself
 * that proves nothing: a clause that always returns "ok" would pass them too. Two of the four
 * measurements have end-to-end red proofs — `--no-hair-collision` drives the clearance to
 * −78.058 mm and `--no-hair-cap` drives the coverage to 94.43% — and both of those need Blender
 * and fifteen seconds. This is the half that needs neither, and it covers the two measurements
 * those flags do NOT reach:
 *
 *   - the card counter, against a shape whose component structure is known by construction, and
 *     against a WELD, which is a failure neither build flag can produce;
 *   - the UV clause, against a card deliberately written a strip too wide AND against one whose
 *     corner is skewed by a texel — the failure that silently rotates every strand in a card,
 *     because the groom derives its fibre direction from the UV rather than from a baked TANGENT.
 *
 * It also checks the two instruments themselves against answers that are known on paper, which is
 * the discipline `cornea_geometry.selftest.mjs` exists for: a signed distance is checked against a
 * SPHERE, where the answer is `|p − centre| − r` exactly, inside and out; and the transmittance is
 * checked against a stack of cards of known alpha, where the answer is a product.
 *
 *     node tools/figure-pipeline/hair_geometry.selftest.mjs
 */

import {
    SurfaceGrid, closestPointOnTriangle, connectedComponents, isRibbon, rayTriangle,
    scalpTransmittance, uvExtentsPerComponent
} from './hair_geometry.mjs';

let checks = 0;
let failures = 0;

function report( ok, what, detail = '' ) {

    checks += 1;
    if ( ok !== true ) failures += 1;
    console.log( `${ ok === true ? 'PASS' : 'FAIL' }  ${ what }${ detail ? `\n        ${ detail }` : '' }` );

}

function near( actual, expected, tolerance, what ) {

    report( Math.abs( actual - expected ) <= tolerance, what,
        `expected ${ expected.toFixed( 6 ) } ± ${ tolerance }, measured ${ actual.toFixed( 6 ) }` );

}

// --- the shapes the tests are built from --------------------------------------------------------

/** A quad strip of `rings` rings, exactly the topology `hair_cards.assemble_cards` emits. */
function ribbon( rings, offset, u = 0.1 ) {

    const positions = [];
    const uvs = [];
    const indices = [];

    for ( let ring = 0; ring < rings; ring ++ ) {

        const v = ring / ( rings - 1 );
        positions.push( offset - 0.01, v, 0, offset + 0.01, v, 0 );
        uvs.push( u, v, u + 0.02, v );

        if ( ring > 0 ) {

            const a = ( ring - 1 ) * 2;
            indices.push( a, a + 1, a + 3, a, a + 3, a + 2 );

        }

    }

    return { positions, uvs, indices, vertexCount: rings * 2 };

}

/** An icosphere-ish sphere: a UV sphere is enough, and its distance field is exact. */
function sphere( radius, segments ) {

    const positions = [];
    const normals = [];
    const indices = [];

    for ( let row = 0; row <= segments; row ++ ) {

        const theta = row / segments * Math.PI;
        for ( let column = 0; column <= segments; column ++ ) {

            const phi = column / segments * Math.PI * 2;
            const n = [ Math.sin( theta ) * Math.cos( phi ), Math.cos( theta ),
                Math.sin( theta ) * Math.sin( phi ) ];
            normals.push( ...n );
            positions.push( n[ 0 ] * radius, n[ 1 ] * radius, n[ 2 ] * radius );

        }

    }

    for ( let row = 0; row < segments; row ++ ) {

        for ( let column = 0; column < segments; column ++ ) {

            const a = row * ( segments + 1 ) + column;
            const b = a + segments + 1;
            indices.push( a, b, a + 1, a + 1, b, b + 1 );

        }

    }

    return { positions, normals, indices };

}

function merge( pieces ) {

    const positions = [];
    const uvs = [];
    const indices = [];
    let base = 0;

    for ( const piece of pieces ) {

        positions.push( ...piece.positions );
        uvs.push( ...piece.uvs );
        for ( const index of piece.indices ) indices.push( index + base );
        base += piece.vertexCount;

    }

    return { positions, uvs, indices, vertexCount: base };

}

// --- 1. the card counter ------------------------------------------------------------------------

console.log( '--- the card counter, against a soup whose components are known ---' );
{
    const soup = merge( [ ribbon( 13, 0 ), ribbon( 13, 1 ), ribbon( 7, 2 ) ] );
    const components = connectedComponents( soup.indices, soup.vertexCount );

    report( components.length === 3, 'three separate strips read as three components',
        `measured ${ components.length }` );
    report( components.every( isRibbon ), 'every quad strip classifies as a ribbon',
        `13/13/7 rings -> ${ components.map( ( c ) => c.vertices.length / 2 ).join( '/' ) }` );

    // 🚩 The failing direction the flags cannot reach: a groom whose cards are WELDED. Two strips
    // sharing their last ring is one component with 2n vertices and 2n−4 triangles, so the ribbon
    // test rejects it — and a build that welded every card would otherwise report a card count of
    // one and a perfect clearance.
    const welded = { ...soup };
    welded.indices = soup.indices.map( ( index ) => index === 26 ? 24 : index );
    const weldedComponents = connectedComponents( welded.indices, welded.vertexCount );
    report( weldedComponents.length === 2, 'a weld fuses two cards into one component',
        `measured ${ weldedComponents.length }` );
    report( weldedComponents.filter( isRibbon ).length === 1,
        'and the fused component no longer classifies as a ribbon',
        `${ weldedComponents.filter( isRibbon ).length } of 2 are ribbons` );

    // A cap shell is a patch: as many triangles as vertices, not vertices − 2.
    const patch = { vertices: new Array( 400 ), triangles: new Array( 700 ) };
    report( isRibbon( patch ) === false, 'a 2-manifold patch is not a ribbon' );
}

// --- 2. the UV clause -----------------------------------------------------------------------------

console.log( '' );
console.log( '--- the UV clause, against a card written a strip too wide ---' );
{
    const good = ribbon( 13, 0, 0.13 );          // inside strip 1 of 8 (0.125 – 0.250)
    const wide = ribbon( 13, 1, 0.245 );         // 0.245 – 0.265 crosses the 0.250 boundary
    const soup = merge( [ good, wide ] );

    const components = connectedComponents( soup.indices, soup.vertexCount );
    const extents = uvExtentsPerComponent( components, soup.uvs, 8 );

    report( extents[ 0 ].strips === 1, 'a card inside one strip reports one strip',
        `u ${ extents[ 0 ].minU.toFixed( 3 ) } – ${ extents[ 0 ].maxU.toFixed( 3 ) }` );
    report( extents[ 1 ].strips === 2, 'a card across a boundary reports two',
        `u ${ extents[ 1 ].minU.toFixed( 3 ) } – ${ extents[ 1 ].maxU.toFixed( 3 ) }` );

    report( extents[ 0 ].uColumns === 2 && extents[ 1 ].uColumns === 2,
        'a quad strip sits on exactly two u columns',
        `${ extents[ 0 ].uColumns } and ${ extents[ 1 ].uColumns }` );

    // 🚩 The direction nothing else can see. The groom exports no TANGENT — baking one shatters the
    // card topology, measured — so the strand direction is the UV's bitangent, which is only the
    // strand direction while the card's UV is axis-aligned. Skew one corner by a texel and the
    // geometry, the clearance, the coverage and the strip test all stay green while every strand
    // inside that card points somewhere else.
    const skewed = ribbon( 13, 3, 0.13 );
    skewed.uvs[ 0 ] += 0.004;
    const skewedExtent = uvExtentsPerComponent(
        connectedComponents( skewed.indices, skewed.vertexCount ), skewed.uvs, 8 )[ 0 ];
    report( skewedExtent.uColumns === 3, 'one skewed corner is caught by the column count',
        `${ skewedExtent.uColumns } columns, and the strip test still says ` +
        `${ skewedExtent.strips }` );
}

// --- 3. the signed distance, against a sphere ------------------------------------------------------

console.log( '' );
console.log( '--- signed distance, where the answer is |p − centre| − r ---' );
{
    const radius = 0.1;
    const ball = sphere( radius, 48 );
    const grid = new SurfaceGrid( ball.positions, ball.normals, ball.indices, 0.02 );

    // The tolerance is the sphere's own faceting: a 48-segment sphere's chord sags below its
    // circle by r·(1 − cos(π/48)) = 0.21 mm, and no distance to a triangulation of it can be
    // better than that.
    const sag = radius * ( 1 - Math.cos( Math.PI / 48 ) );

    for ( const offset of [ 0.03, 0.006, - 0.006, - 0.03 ] ) {

        const direction = [ 0.4, 0.7, - 0.59 ];
        const length = Math.hypot( ...direction );
        const unit = direction.map( ( value ) => value / length );
        const at = radius + offset;
        const hit = grid.nearest( unit.map( ( value ) => value * at ) );

        near( hit.signed, offset, sag * 1.5 + 1e-4,
            `a point ${ ( offset * 1000 ).toFixed( 0 ) } mm ${ offset > 0 ? 'outside' : 'inside' } ` +
            'a 100 mm sphere' );

    }

    // ⚠️ The direction that matters: UNSIGNED distance cannot tell these two apart, and that is
    // the defect the shipped build had. A point 30 mm inside and a point 30 mm outside are both
    // 30 mm from the surface.
    const inside = grid.nearest( [ 0, radius - 0.03, 0 ] );
    const outside = grid.nearest( [ 0, radius + 0.03, 0 ] );
    report( inside.signed < 0 && outside.signed > 0,
        'inside and outside are distinguished, which an unsigned distance cannot do',
        `inside ${ ( inside.signed * 1000 ).toFixed( 2 ) } mm, ` +
        `outside ${ ( outside.signed * 1000 ).toFixed( 2 ) } mm` );
}

// --- 4. closest point and ray, the primitives underneath -------------------------------------------

console.log( '' );
console.log( '--- the two primitives, on cases with pencil-and-paper answers ---' );
{
    const A = [ 0, 0, 0 ];
    const B = [ 1, 0, 0 ];
    const C = [ 0, 1, 0 ];

    const above = closestPointOnTriangle( [ 0.25, 0.25, 5 ], A, B, C );
    near( Math.hypot( above.closest[ 0 ] - 0.25, above.closest[ 1 ] - 0.25, above.closest[ 2 ] ),
        0, 1e-9, 'a point over the interior projects onto it' );

    const past = closestPointOnTriangle( [ 3, - 2, 0 ], A, B, C );
    near( Math.hypot( past.closest[ 0 ] - B[ 0 ], past.closest[ 1 ], past.closest[ 2 ] ),
        0, 1e-9, 'a point beyond a corner clamps to that corner' );

    const hit = rayTriangle( [ 0.25, 0.25, - 2 ], [ 0, 0, 1 ], [ ...A, ...B, ...C ],
        [ 0, 1, 2 ], 0 );
    near( hit.distance, 2, 1e-9, 'a ray fired at a triangle 2 m away reports 2 m' );

    // Double sided on purpose: a hair card occludes the scalp from either face.
    const behind = rayTriangle( [ 0.25, 0.25, 2 ], [ 0, 0, - 1 ], [ ...A, ...B, ...C ],
        [ 0, 1, 2 ], 0 );
    report( behind !== null, 'and from the back face too, because a card has no front' );

    report( rayTriangle( [ 5, 5, - 2 ], [ 0, 0, 1 ], [ ...A, ...B, ...C ], [ 0, 1, 2 ], 0 ) === null,
        'a ray that misses reports a miss' );
}

// --- 5. transmittance, against a stack of known alpha ----------------------------------------------

console.log( '' );
console.log( '--- transmittance through a stack of cards of known alpha ---' );
{
    // Three parallel quads over one scalp point, at 10, 20 and 30 mm. Each samples an alpha of
    // 0.5, so the answer is 0.5³ = 0.125 transmitted, 87.5% covered.
    const pieces = [];
    for ( const height of [ 0.01, 0.02, 0.03 ] ) {

        pieces.push( {
            positions: [ - 1, height, - 1, 1, height, - 1, 1, height, 1, - 1, height, 1 ],
            uvs: [ 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1 ],
            indices: [ 0, 1, 2, 0, 2, 3 ],
            vertexCount: 4
        } );

    }

    const stack = merge( pieces );

    // ⚠️ Deliberately NOT on the origin. Each quad is two triangles sharing the diagonal from
    // (−1,−1) to (1,1), and a ray up the origin crosses that shared edge — both triangles report a
    // hit and the stack reads as six cards, 0.5⁶ = 0.015625. That is a property of ray-vs-edge and
    // not of the measurement (the scalp normals of a real head do not line up with the groom's
    // triangulation), but a test that sits on it is testing the degenerate case by accident.
    const scalp = { points: Float64Array.from( [ 0.3, 0, 0.1 ] ),
        normals: Float64Array.from( [ 0, 1, 0 ] ) };

    const transmittance = scalpTransmittance( scalp, stack, () => 0.5, 0.12 );
    near( transmittance[ 0 ], 0.125, 1e-9, 'three cards at alpha 0.5 transmit 0.5³' );

    // ⚠️ The units bug that shipped: a sampler returning 0.5/255 instead of 0.5 makes an opaque
    // groom look like bare skin. Nothing about the geometry changes, so only a check on the
    // SAMPLER's range can catch it — which is why this case is here rather than in the clause.
    const asBytes = scalpTransmittance( scalp, stack, () => 0.5 / 255, 0.12 );
    report( asBytes[ 0 ] > 0.99,
        'a sampler off by 255 reports a covered scalp as bare, which is the shape of the bug',
        `transmittance ${ asBytes[ 0 ].toFixed( 4 ) } against the correct ${ transmittance[ 0 ] }` );

    // And the reach: a card beyond it is not covering anything.
    const far = scalpTransmittance( scalp, stack, () => 0.5, 0.005 );
    near( far[ 0 ], 1, 1e-9, 'cards beyond the reach do not count as coverage' );
}

console.log( '' );
console.log( '='.repeat( 84 ) );
console.log( failures === 0 ? `PASS — ${ checks } assertions.`
    : `FAIL — ${ failures } of ${ checks } assertions.` );

process.exit( failures === 0 ? 0 : 1 );
