/**
 * HemGeometry — finds the rolled hem band in a foundation shell and measures it, from nothing but
 * positions and an index buffer.
 *
 * ## The defect this exists because of
 *
 * A foundation garment is a SURFACE, and a surface has no thickness. 9.8 shipped with shells whose
 * hem tapered to a knife edge, and three blind judges read the result as *"a texture region, not a
 * garment"* and *"a jaggy texture boundary on bare skin"*. `roll_the_hem()` in
 * `tools/figure-pipeline/build_figure.py` fixes that by extruding the shell's open boundary back
 * toward the skin as a band of real faces, so the edge is an edge.
 *
 * That band went into the artefact at R11 and **nobody had ever measured it anywhere except in the
 * script that wrote it.** `describe_foundation` prints a face count out of its own bookkeeping,
 * which is the build checking its arithmetic against itself. This module reads the shipped GLB.
 *
 * ## Why the band is found geometrically rather than by a marker
 *
 * The build could have written a `_ROLL` attribute and this module could have read it, and that
 * gate would pass on a shell whose band was flagged and flat. What can be trusted is topology:
 *
 *   * after `extrude_edge_only` the ONLY open boundary left on the shell is the band's outer ring,
 *     because the ring the band was extruded from now has a face on both sides;
 *   * so the band's triangles are exactly the triangles with a vertex on that ring, and there are
 *     exactly TWO of them per boundary edge — one quad, triangulated;
 *   * and each ring vertex is paired to the hem vertex it was extruded from by the band quad's own
 *     vertical edge, which is its SHORTEST edge into the interior.
 *
 * A shell built with `--no-hem-roll` has an open boundary too — its hem — so a boundary is not the
 * measurement. The measurement is DEPTH: how far each ring vertex sits beneath the shell's surface
 * ALONG THAT SURFACE'S OWN NORMAL. A rolled ring sits `FOUNDATION_HEM_ROLL_M` under it. A knife
 * edge's neighbours lie in the surface, so the same number is a tessellation residue near zero.
 * Measured on the shipped g050 shells against a `--no-hem-roll` build of the same command:
 *
 *     median depth mm   bra 1.200 / vest 1.200 / briefs 1.200 / boxer 1.200
 *     --no-hem-roll     bra 0.114 / vest 0.119 / briefs 0.125 / boxer 0.112
 *
 * ## Welding, and why it is not optional
 *
 * glTF has no shared vertices: the exporter splits a vertex per distinct normal or UV, so the
 * band's crease duplicates every ring vertex and a naive edge count finds a boundary everywhere.
 * Positions are welded on an exact quantised key first. ⚠️ The weld is also where two DISTINCT
 * vertices can be merged: at the g000 crotch seam two hem walls face each other and are coincident
 * to a micrometre (see `roll_the_hem`'s own note). That shows up as a handful of non-manifold
 * edges rather than as a wrong depth, and `measureHemRoll` reports the count rather than hiding it.
 */

/**
 * The weld key's resolution, in metres. 0.1 µm is four orders finer than anything the build moves
 * a vertex by and four orders coarser than float32's spacing at body scale, so it merges the
 * exporter's duplicates and nothing else.
 */
const WELD_QUANTUM_M = 1e-7;

/**
 * Welds an indexed triangle soup on position, and returns the topology the rest of this module
 * needs: which welded vertex each source vertex became, where each welded vertex is, and the
 * triangle list in welded indices with degenerate triangles dropped.
 *
 * @param {ArrayLike<number>} positions - Flat xyz triples, one per source vertex.
 * @param {ArrayLike<number>} indices - Triangle list into `positions`.
 */
export function weldPositions( positions, indices ) {

    const sourceCount = positions.length / 3;
    const weld = new Int32Array( sourceCount );
    const byKey = new Map();
    const coordinates = [];

    for ( let vertex = 0; vertex < sourceCount; vertex ++ ) {

        const x = Math.round( positions[ vertex * 3 ] / WELD_QUANTUM_M );
        const y = Math.round( positions[ vertex * 3 + 1 ] / WELD_QUANTUM_M );
        const z = Math.round( positions[ vertex * 3 + 2 ] / WELD_QUANTUM_M );
        const key = `${ x },${ y },${ z }`;

        let welded = byKey.get( key );

        if ( welded === undefined ) {

            welded = coordinates.length / 3;
            byKey.set( key, welded );
            coordinates.push( positions[ vertex * 3 ],
                positions[ vertex * 3 + 1 ],
                positions[ vertex * 3 + 2 ] );

        }

        weld[ vertex ] = welded;

    }

    const triangles = [];
    let degenerate = 0;

    for ( let offset = 0; offset < indices.length; offset += 3 ) {

        const a = weld[ indices[ offset ] ];
        const b = weld[ indices[ offset + 1 ] ];
        const c = weld[ indices[ offset + 2 ] ];

        if ( a === b || b === c || a === c ) { degenerate ++; continue; }

        triangles.push( a, b, c );

    }

    return {
        weld,
        coordinates: Float64Array.from( coordinates ),
        vertexCount: coordinates.length / 3,
        triangles: Int32Array.from( triangles ),
        triangleCount: triangles.length / 3,
        degenerate
    };

}

/**
 * The whole hem measurement for one shell: where its open boundary is, how many triangles hang off
 * it, how deep each ring vertex sits under the surface, and how far the deepest of them is from a
 * skin surface if one is supplied.
 *
 * `depthsMm` is returned sorted, because every threshold worth setting on it is a percentile: the
 * band has a handful of legitimate outliers where the hem turns a corner and the ring pairing has
 * two equally short candidates, and a `min` would be a gate on those instead of on the band.
 *
 * @param {ArrayLike<number>} positions - Flat xyz triples in metres.
 * @param {ArrayLike<number>} indices - Triangle list.
 */
export function measureHemRoll( positions, indices ) {

    const mesh = weldPositions( positions, indices );
    const { coordinates, triangles, triangleCount, vertexCount } = mesh;

    const edgeUse = edgeUseOf( triangles, triangleCount );
    const { boundary, boundaryEdges, nonManifoldEdges } = boundaryOf( edgeUse );

    // The band is every triangle touching the ring, and the interior is everything else. The
    // interior is what the surface normal has to be computed from: a normal averaged over the band
    // as well would already be turned under, and the depth would be measured against itself.
    const bandTriangles = [];
    const normals = new Float64Array( vertexCount * 3 );

    for ( let face = 0; face < triangleCount; face ++ ) {

        const a = triangles[ face * 3 ];
        const b = triangles[ face * 3 + 1 ];
        const c = triangles[ face * 3 + 2 ];

        if ( boundary.has( a ) || boundary.has( b ) || boundary.has( c ) ) {

            bandTriangles.push( face );
            continue;

        }

        const ux = coordinates[ b * 3 ] - coordinates[ a * 3 ];
        const uy = coordinates[ b * 3 + 1 ] - coordinates[ a * 3 + 1 ];
        const uz = coordinates[ b * 3 + 2 ] - coordinates[ a * 3 + 2 ];
        const vx = coordinates[ c * 3 ] - coordinates[ a * 3 ];
        const vy = coordinates[ c * 3 + 1 ] - coordinates[ a * 3 + 1 ];
        const vz = coordinates[ c * 3 + 2 ] - coordinates[ a * 3 + 2 ];

        // Not normalised: the cross product's length is twice the triangle's area, which is the
        // weighting a vertex normal wants anyway.
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        for ( const vertex of [ a, b, c ] ) {

            normals[ vertex * 3 ] += nx;
            normals[ vertex * 3 + 1 ] += ny;
            normals[ vertex * 3 + 2 ] += nz;

        }

    }

    const neighbours = adjacencyOf( edgeUse, vertexCount );
    const pairs = [];
    const depths = [];
    let unpaired = 0;

    for ( const ringVertex of boundary ) {

        const source = nearestInteriorNeighbour( ringVertex, neighbours, boundary, coordinates );

        if ( source === -1 ) { unpaired ++; continue; }

        const length = Math.hypot( normals[ source * 3 ],
            normals[ source * 3 + 1 ], normals[ source * 3 + 2 ] );

        if ( length === 0 ) { unpaired ++; continue; }

        const dx = coordinates[ source * 3 ] - coordinates[ ringVertex * 3 ];
        const dy = coordinates[ source * 3 + 1 ] - coordinates[ ringVertex * 3 + 1 ];
        const dz = coordinates[ source * 3 + 2 ] - coordinates[ ringVertex * 3 + 2 ];

        pairs.push( [ ringVertex, source ] );
        depths.push( ( dx * normals[ source * 3 ] + dy * normals[ source * 3 + 1 ] +
            dz * normals[ source * 3 + 2 ] ) / length * 1000 );

    }

    depths.sort( ( first, second ) => first - second );

    return {
        vertexCount,
        triangleCount,
        degenerate: mesh.degenerate,
        boundaryEdges,
        boundaryVertices: boundary.size,
        nonManifoldEdges,
        bandTriangles: bandTriangles.length,
        unpaired,
        depthsMm: depths,
        pairs,
        weld: mesh.weld,
        coordinates,
        boundary,

        // Area-weighted vertex normals over the INTERIOR triangles only — the surface the shell
        // would have if the band had never been extruded. Un-normalised; the caller that needs
        // unit vectors is the one that knows it does. `hem.selftest.mjs`'s red proof writes these
        // back over the exported normals, which is the half of "no roll" that positions alone
        // cannot reproduce: see its own note.
        interiorNormals: normals
    };

}

/**
 * Every separate opening in a mesh, as a group of welded boundary vertices with the box it spans.
 *
 * ## The defect this exists because of
 *
 * `measureHemRoll` treats "the boundary" as one thing, which is true of a foundation shell —
 * `extrude_edge_only` leaves exactly one open ring — and false of everything else in the wardrobe.
 * `female_casualsuit01` has SEVEN open boundaries: two trouser hems, two sleeve hems, a neck, and
 * the two rings of its own waist seam. R13 was asked how far the SLEEVE hem stands off the arm, and
 * a statistic pooled over all seven would have averaged a sleeve against a trouser leg and reported
 * a number belonging to neither.
 *
 * The grouping is connected components over the boundary graph — two boundary vertices are in the
 * same opening when a boundary edge joins them. That is topology, not a spatial cluster with a
 * radius in it: a sleeve hem and the arm hole it is nowhere near are separated by the mesh's own
 * connectivity, and two openings that pass within a millimetre of each other still come back
 * separate.
 *
 * Loops are returned largest first, and each carries `vertices` in welded indices so a caller can
 * pull coordinates out of the same `mesh` this returns — the welded indices are meaningless against
 * the source positions.
 *
 * @param {ArrayLike<number>} positions - Flat xyz triples in metres.
 * @param {ArrayLike<number>} indices - Triangle list.
 */
export function findBoundaryLoops( positions, indices ) {

    const mesh = weldPositions( positions, indices );
    const edgeUse = edgeUseOf( mesh.triangles, mesh.triangleCount );
    const { boundaryEdges, nonManifoldEdges, boundaryAdjacency } = boundaryOf( edgeUse );

    const visited = new Set();
    const loops = [];

    for ( const start of boundaryAdjacency.keys() ) {

        if ( visited.has( start ) ) continue;

        const pending = [ start ];
        const vertices = [];
        visited.add( start );

        while ( pending.length > 0 ) {

            const vertex = pending.pop();
            vertices.push( vertex );

            for ( const neighbour of boundaryAdjacency.get( vertex ) ) {

                if ( visited.has( neighbour ) ) continue;

                visited.add( neighbour );
                pending.push( neighbour );

            }

        }

        loops.push( describeLoop( vertices, mesh.coordinates ) );

    }

    loops.sort( ( first, second ) => second.vertices.length - first.vertices.length );

    return { mesh, loops, boundaryEdges, nonManifoldEdges };

}

/** The p-th percentile of an already-sorted array, by nearest rank. */
export function percentile( sorted, fraction ) {

    if ( sorted.length === 0 ) return NaN;

    const rank = Math.round( fraction * ( sorted.length - 1 ) );

    return sorted[ Math.min( sorted.length - 1, Math.max( 0, rank ) ) ];

}

/**
 * How far EACH of the named points sits from a triangulated surface, in millimetres, in the order
 * they were given.
 *
 * A uniform grid over the surface's triangles, sized so a query only ever tests the cells its own
 * search radius reaches. Brute force is 26,756 body triangles against 1,900 band vertices per
 * shell and twelve shells to check, which is a minute of nothing; this is under a second.
 *
 * ⚠️ PERPENDICULAR distance to the nearest triangle, which is NOT the along-normal offset the
 * build applied. At a convex ridge it is shorter — `build_figure.py`'s own note measures the vest's
 * 0.8 mm hem crossing the collarbone at 0.40 mm perpendicular. A reader comparing this to
 * FOUNDATION_HEM_ROLL_FLOOR_M is comparing two different quantities.
 *
 * ⚠️ UNSIGNED. A point that has sunk THROUGH the surface reads the same as one hovering the same
 * distance above it. On a foundation shell that cannot happen by construction; on an outer garment
 * fitted over a body it can, at a fold or a crease, and a caller that needs to tell the two apart
 * has to test containment itself.
 *
 * ## Why the distribution and not just the minimum
 *
 * `nearestApproachMm` below reduces this to the single closest approach, which is the right
 * statistic for "does the shell touch the skin anywhere". It is the WRONG statistic for "how far
 * off the body does this hem stand", because one vertex at a seam decides the whole answer. R13
 * needed the second question — how wide a shadow a sleeve hem can physically cast — and a minimum
 * would have answered a question nobody asked. Percentiles need every distance, so this returns
 * every distance and lets the caller reduce.
 */
export function approachDistancesMm( queryPoints, surfacePositions, surfaceIndices ) {

    const grid = buildTriangleGrid( surfacePositions, surfaceIndices );
    const count = queryPoints.length / 3;
    const millimetres = new Float64Array( count );

    for ( let query = 0; query < count; query ++ ) {

        const point = [ queryPoints[ query * 3 ],
            queryPoints[ query * 3 + 1 ], queryPoints[ query * 3 + 2 ] ];

        millimetres[ query ] = nearestTriangleDistance( point, grid ) * 1000;

    }

    return millimetres;

}

/**
 * The closest any of the named vertices comes to a triangulated surface, in millimetres.
 *
 * A thin reduction over `approachDistancesMm` rather than a second traversal, so the two can never
 * disagree about what "distance to the surface" means.
 */
export function nearestApproachMm( queryPoints, surfacePositions, surfaceIndices ) {

    const distances = approachDistancesMm( queryPoints, surfacePositions, surfaceIndices );

    let nearest = Infinity;
    let nearestAt = -1;

    for ( let query = 0; query < distances.length; query ++ ) {

        if ( distances[ query ] < nearest ) { nearest = distances[ query ]; nearestAt = query; }

    }

    return { millimetres: nearest, atVertex: nearestAt };

}

// --- helpers ---------------------------------------------------------------------------------

/**
 * Edge -> how many triangles use it. One means an open boundary; more than two means the weld
 * merged two surfaces that only looked coincident, which is reported rather than corrected.
 */
function edgeUseOf( triangles, triangleCount ) {

    const edgeUse = new Map();
    const edgeKey = ( a, b ) => ( a < b ? `${ a }_${ b }` : `${ b }_${ a }` );

    for ( let face = 0; face < triangleCount; face ++ ) {

        const a = triangles[ face * 3 ];
        const b = triangles[ face * 3 + 1 ];
        const c = triangles[ face * 3 + 2 ];

        for ( const [ from, to ] of [ [ a, b ], [ b, c ], [ c, a ] ] ) {

            const key = edgeKey( from, to );
            edgeUse.set( key, ( edgeUse.get( key ) ?? 0 ) + 1 );

        }

    }

    return edgeUse;

}

/**
 * Which welded vertices sit on an open boundary, and — for a caller that has to tell one opening
 * from another — which of them are joined to which along boundary edges.
 *
 * Shared by `measureHemRoll`, which wants the flat set because a foundation shell has exactly one
 * opening, and by `findBoundaryLoops`, which wants the adjacency because an outer garment has
 * seven. One traversal so the two can never disagree about what a boundary is.
 */
function boundaryOf( edgeUse ) {

    const boundary = new Set();
    const boundaryAdjacency = new Map();
    let boundaryEdges = 0;
    let nonManifoldEdges = 0;

    for ( const [ key, uses ] of edgeUse ) {

        if ( uses > 2 ) nonManifoldEdges ++;
        if ( uses !== 1 ) continue;

        boundaryEdges ++;

        const separator = key.indexOf( '_' );
        const from = Number( key.slice( 0, separator ) );
        const to = Number( key.slice( separator + 1 ) );

        boundary.add( from );
        boundary.add( to );

        if ( boundaryAdjacency.has( from ) === false ) boundaryAdjacency.set( from, [] );
        if ( boundaryAdjacency.has( to ) === false ) boundaryAdjacency.set( to, [] );

        boundaryAdjacency.get( from ).push( to );
        boundaryAdjacency.get( to ).push( from );

    }

    return { boundary, boundaryAdjacency, boundaryEdges, nonManifoldEdges };

}

/** One opening's vertices, where its middle is, and the box it spans — all in metres. */
function describeLoop( vertices, coordinates ) {

    const centroid = [ 0, 0, 0 ];
    const minimum = [ Infinity, Infinity, Infinity ];
    const maximum = [ -Infinity, -Infinity, -Infinity ];

    for ( const vertex of vertices ) {

        for ( let axis = 0; axis < 3; axis ++ ) {

            const value = coordinates[ vertex * 3 + axis ];

            centroid[ axis ] += value / vertices.length;
            minimum[ axis ] = Math.min( minimum[ axis ], value );
            maximum[ axis ] = Math.max( maximum[ axis ], value );

        }

    }

    return { vertices, centroid, minimum, maximum };

}

function adjacencyOf( edgeUse, vertexCount ) {

    const neighbours = Array.from( { length: vertexCount }, () => [] );

    for ( const key of edgeUse.keys() ) {

        const separator = key.indexOf( '_' );
        const from = Number( key.slice( 0, separator ) );
        const to = Number( key.slice( separator + 1 ) );

        neighbours[ from ].push( to );
        neighbours[ to ].push( from );

    }

    return neighbours;

}

/**
 * The hem vertex a ring vertex was extruded from.
 *
 * 🚩 THE SHORTEST EDGE, NOT ANY EDGE, and the difference is a third of a millimetre on this band.
 * A ring vertex touches its own source through the band quad's vertical edge AND its neighbour's
 * source through the quad's triangulation diagonal. The diagonal is √(depth² + spacing²) long and
 * measuring against it reports a depth inflated by the ring spacing — measured on the shipped
 * briefs, taking any edge gave a maximum of 2.247 mm against an authored roll of 1.200.
 */
function nearestInteriorNeighbour( vertex, neighbours, boundary, coordinates ) {

    let best = -1;
    let shortest = Infinity;

    for ( const candidate of neighbours[ vertex ] ) {

        if ( boundary.has( candidate ) ) continue;

        const dx = coordinates[ candidate * 3 ] - coordinates[ vertex * 3 ];
        const dy = coordinates[ candidate * 3 + 1 ] - coordinates[ vertex * 3 + 1 ];
        const dz = coordinates[ candidate * 3 + 2 ] - coordinates[ vertex * 3 + 2 ];
        const length = dx * dx + dy * dy + dz * dz;

        if ( length < shortest ) { shortest = length; best = candidate; }

    }

    return best;

}

/** Cell size for the triangle grid, in metres. About four body-mesh edges across. */
const GRID_CELL_M = 0.02;

function buildTriangleGrid( positions, indices ) {

    const cells = new Map();
    const triangleCount = indices.length / 3;

    for ( let face = 0; face < triangleCount; face ++ ) {

        const corners = [ 0, 1, 2 ].map( ( corner ) => indices[ face * 3 + corner ] );
        let minimum = [ Infinity, Infinity, Infinity ];
        let maximum = [ -Infinity, -Infinity, -Infinity ];

        for ( const corner of corners ) {

            for ( let axis = 0; axis < 3; axis ++ ) {

                const value = positions[ corner * 3 + axis ];
                minimum[ axis ] = Math.min( minimum[ axis ], value );
                maximum[ axis ] = Math.max( maximum[ axis ], value );

            }

        }

        for ( let x = Math.floor( minimum[ 0 ] / GRID_CELL_M );
            x <= Math.floor( maximum[ 0 ] / GRID_CELL_M ); x ++ ) {

            for ( let y = Math.floor( minimum[ 1 ] / GRID_CELL_M );
                y <= Math.floor( maximum[ 1 ] / GRID_CELL_M ); y ++ ) {

                for ( let z = Math.floor( minimum[ 2 ] / GRID_CELL_M );
                    z <= Math.floor( maximum[ 2 ] / GRID_CELL_M ); z ++ ) {

                    const key = `${ x },${ y },${ z }`;
                    const bucket = cells.get( key );

                    if ( bucket === undefined ) cells.set( key, [ face ] ); else bucket.push( face );

                }

            }

        }

    }

    return { cells, positions, indices };

}

function nearestTriangleDistance( point, grid ) {

    // Grow the search ring until a hit is found, then one ring further: a triangle in the next
    // ring out can still be closer than one found in this ring's corner.
    let nearest = Infinity;

    for ( let ring = 0; ring <= 6; ring ++ ) {

        const centre = point.map( ( value ) => Math.floor( value / GRID_CELL_M ) );

        for ( let x = centre[ 0 ] - ring; x <= centre[ 0 ] + ring; x ++ ) {

            for ( let y = centre[ 1 ] - ring; y <= centre[ 1 ] + ring; y ++ ) {

                for ( let z = centre[ 2 ] - ring; z <= centre[ 2 ] + ring; z ++ ) {

                    const onShell = Math.max( Math.abs( x - centre[ 0 ] ),
                        Math.abs( y - centre[ 1 ] ), Math.abs( z - centre[ 2 ] ) ) === ring;

                    if ( onShell === false ) continue;

                    for ( const face of grid.cells.get( `${ x },${ y },${ z }` ) ?? [] ) {

                        nearest = Math.min( nearest,
                            pointToTriangle( point, grid.positions, grid.indices, face ) );

                    }

                }

            }

        }

        if ( nearest < Infinity && nearest <= ring * GRID_CELL_M ) break;

    }

    return nearest;

}

/** Distance from a point to a triangle: Ericson's region test, written out rather than cleverly. */
function pointToTriangle( point, positions, indices, face ) {

    const a = [ 0, 1, 2 ].map( ( axis ) => positions[ indices[ face * 3 ] * 3 + axis ] );
    const b = [ 0, 1, 2 ].map( ( axis ) => positions[ indices[ face * 3 + 1 ] * 3 + axis ] );
    const c = [ 0, 1, 2 ].map( ( axis ) => positions[ indices[ face * 3 + 2 ] * 3 + axis ] );

    const ab = subtract( b, a );
    const ac = subtract( c, a );
    const ap = subtract( point, a );

    const d1 = dot( ab, ap );
    const d2 = dot( ac, ap );
    if ( d1 <= 0 && d2 <= 0 ) return length( ap );

    const bp = subtract( point, b );
    const d3 = dot( ab, bp );
    const d4 = dot( ac, bp );
    if ( d3 >= 0 && d4 <= d3 ) return length( bp );

    const vc = d1 * d4 - d3 * d2;
    if ( vc <= 0 && d1 >= 0 && d3 <= 0 ) {

        return length( subtract( ap, scale( ab, d1 / ( d1 - d3 ) ) ) );

    }

    const cp = subtract( point, c );
    const d5 = dot( ab, cp );
    const d6 = dot( ac, cp );
    if ( d6 >= 0 && d5 <= d6 ) return length( cp );

    const vb = d5 * d2 - d1 * d6;
    if ( vb <= 0 && d2 >= 0 && d6 <= 0 ) {

        return length( subtract( ap, scale( ac, d2 / ( d2 - d6 ) ) ) );

    }

    const va = d3 * d6 - d5 * d4;
    if ( va <= 0 && ( d4 - d3 ) >= 0 && ( d5 - d6 ) >= 0 ) {

        const along = ( d4 - d3 ) / ( ( d4 - d3 ) + ( d5 - d6 ) );
        return length( subtract( point, add( b, scale( subtract( c, b ), along ) ) ) );

    }

    const denominator = 1 / ( va + vb + vc );
    const closest = add( a, add( scale( ab, vb * denominator ), scale( ac, vc * denominator ) ) );

    return length( subtract( point, closest ) );

}

const subtract = ( u, v ) => [ u[ 0 ] - v[ 0 ], u[ 1 ] - v[ 1 ], u[ 2 ] - v[ 2 ] ];
const add = ( u, v ) => [ u[ 0 ] + v[ 0 ], u[ 1 ] + v[ 1 ], u[ 2 ] + v[ 2 ] ];
const scale = ( u, factor ) => [ u[ 0 ] * factor, u[ 1 ] * factor, u[ 2 ] * factor ];
const dot = ( u, v ) => u[ 0 ] * v[ 0 ] + u[ 1 ] * v[ 1 ] + u[ 2 ] * v[ 2 ];
const length = ( u ) => Math.hypot( u[ 0 ], u[ 1 ], u[ 2 ] );
