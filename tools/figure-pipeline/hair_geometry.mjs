/**
 * hair_geometry.mjs — the measurements punch-list 3.6's gate makes on an exported groom.
 *
 * Separated from `verify_glb.mjs` for exactly the reason `cornea_geometry.mjs` is: the clause
 * belongs in the one verifier, and the arithmetic under it belongs somewhere it can be pointed at
 * a shape whose answer is known on paper. Everything here takes plain typed arrays and returns
 * numbers; nothing here decides whether a number is acceptable.
 *
 * ## What "measured" means for a groom, and what it deliberately excludes
 *
 * Four questions, and each one is a way a groom can satisfy every other assertion and be wrong:
 *
 *   1. **How many cards are there, and are they cards?** Counted as connected components of the
 *      exported index buffer and CLASSIFIED by topology — a ribbon is a quad strip and satisfies
 *      `triangles === vertices − 2`; the scalp cap shells do not. Nothing is taken on the build
 *      script's word, and the gate never has to be told how many of either to expect.
 *   2. **Does any of it go through the head?** Signed distance from every hair vertex to the body
 *      surface, signed by the body's own interpolated vertex normal at the closest point. Unsigned
 *      distance is not enough: a card buried in the skull is 4 mm from the surface too.
 *   3. **Does the scalp show through?** ⚠️ **This is the one that cannot be answered with geometry
 *      alone, and answering it with geometry alone is the trap.** A hair card is a solid quad
 *      whose hair lives entirely in an alpha cutout, so a ray from the scalp hits a card whether
 *      or not there is a strand at that texel. So the ray is followed through every card it meets,
 *      the ATLAS IS SAMPLED at the barycentric UV of each hit, and the transmittances multiply.
 *      Coverage is what a viewer would see, not what the triangles claim.
 *   4. **Are the UVs inside the atlas, and inside ONE strip per card?** A card that straddles two
 *      strips samples half of somebody else's bundle down one edge.
 *
 * No claim is made here about whether the groom looks like hair. It cannot be; LEARNINGS §1.2 is
 * about precisely that, and `packages/testbed/src/hair.html` is where a person looks at it.
 */

/**
 * Connected components of a triangle soup, by shared vertex index.
 *
 * Union-find rather than a flood fill because the index buffer is the only adjacency this has —
 * there is no half-edge structure and building one to answer "how many pieces" would be more code
 * than the question deserves.
 *
 * @param {ArrayLike<number>} indices - triangle list.
 * @param {number} vertexCount
 * @returns {{vertices:number[], triangles:number[]}[]} one entry per component.
 */
export function connectedComponents( indices, vertexCount ) {

    const parent = new Int32Array( vertexCount );
    for ( let vertex = 0; vertex < vertexCount; vertex ++ ) parent[ vertex ] = vertex;

    const find = ( vertex ) => {

        let root = vertex;
        while ( parent[ root ] !== root ) root = parent[ root ];
        // Path compression, so a groom with 7,000 vertices does not walk a 7,000-deep chain.
        while ( parent[ vertex ] !== root ) {

            const next = parent[ vertex ];
            parent[ vertex ] = root;
            vertex = next;

        }
        return root;

    };

    const union = ( a, b ) => {

        const rootA = find( a );
        const rootB = find( b );
        if ( rootA !== rootB ) parent[ rootB ] = rootA;

    };

    for ( let triangle = 0; triangle < indices.length; triangle += 3 ) {

        union( indices[ triangle ], indices[ triangle + 1 ] );
        union( indices[ triangle + 1 ], indices[ triangle + 2 ] );

    }

    const byRoot = new Map();
    for ( let vertex = 0; vertex < vertexCount; vertex ++ ) {

        const root = find( vertex );
        if ( ! byRoot.has( root ) ) byRoot.set( root, { vertices: [], triangles: [] } );
        byRoot.get( root ).vertices.push( vertex );

    }

    for ( let triangle = 0; triangle < indices.length; triangle += 3 ) {

        byRoot.get( find( indices[ triangle ] ) ).triangles.push( triangle / 3 );

    }

    // Vertices no triangle touches are not a component of anything. The exporter does not write
    // them, but a future one might, and a phantom component would be counted as a card.
    return [ ...byRoot.values() ].filter( ( component ) => component.triangles.length > 0 );

}

/**
 * Whether a component is a ribbon — a strip of quads, each split into two triangles.
 *
 * A strip of n rings has 2n vertices and 2(n−1) triangles, so `triangles === vertices − 2` and
 * nothing else about the build has to be known. A cap shell is a 2-manifold patch with far more
 * triangles than that, and an accidental weld between two cards fails the test in the other
 * direction.
 */
export function isRibbon( component ) {

    return component.vertices.length >= 4 &&
        component.vertices.length % 2 === 0 &&
        component.triangles.length === component.vertices.length - 2;

}

/**
 * A uniform grid over a triangle mesh, answering "what is the nearest point on this surface".
 *
 * A BVH would be faster to query and slower to write; the body is 26,756 triangles and the groom
 * asks about 7,000 points, and a 20 mm grid answers that in about a second. Cells hold triangle
 * indices, a triangle is inserted into every cell its bounding box touches, and a query expands
 * ring by ring until the nearest hit found so far is closer than the next ring can possibly be.
 */
export class SurfaceGrid {

    constructor( positions, normals, indices, cellSize = 0.02 ) {

        this.positions = positions;
        this.normals = normals;
        this.indices = indices;
        this.cellSize = cellSize;

        this.low = [ Infinity, Infinity, Infinity ];
        for ( let vertex = 0; vertex < positions.length; vertex += 3 ) {

            for ( let axis = 0; axis < 3; axis ++ ) {

                this.low[ axis ] = Math.min( this.low[ axis ], positions[ vertex + axis ] );

            }

        }

        this.cells = new Map();
        for ( let triangle = 0; triangle < indices.length; triangle += 3 ) {

            const box = this.#triangleBounds( triangle );
            for ( let x = box.min[ 0 ]; x <= box.max[ 0 ]; x ++ ) {

                for ( let y = box.min[ 1 ]; y <= box.max[ 1 ]; y ++ ) {

                    for ( let z = box.min[ 2 ]; z <= box.max[ 2 ]; z ++ ) {

                        const key = `${ x },${ y },${ z }`;
                        if ( ! this.cells.has( key ) ) this.cells.set( key, [] );
                        this.cells.get( key ).push( triangle );

                    }

                }

            }

        }

    }

    #cellOf( x, y, z ) {

        return [
            Math.floor( ( x - this.low[ 0 ] ) / this.cellSize ),
            Math.floor( ( y - this.low[ 1 ] ) / this.cellSize ),
            Math.floor( ( z - this.low[ 2 ] ) / this.cellSize )
        ];

    }

    #triangleBounds( triangle ) {

        const min = [ Infinity, Infinity, Infinity ];
        const max = [ - Infinity, - Infinity, - Infinity ];

        for ( let corner = 0; corner < 3; corner ++ ) {

            const vertex = this.indices[ triangle + corner ] * 3;
            for ( let axis = 0; axis < 3; axis ++ ) {

                min[ axis ] = Math.min( min[ axis ], this.positions[ vertex + axis ] );
                max[ axis ] = Math.max( max[ axis ], this.positions[ vertex + axis ] );

            }

        }

        return { min: this.#cellOf( ...min ), max: this.#cellOf( ...max ) };

    }

    /**
     * The nearest point on the surface, and the SIGNED distance to it.
     *
     * The sign comes from the body's own interpolated vertex normal at the closest point, dotted
     * with the direction from that point to the query. That is the standard smooth-mesh inside
     * test and it is right here because the body is closed and smooth-shaded; a face normal would
     * disagree with itself across every edge the closest point lands on.
     *
     * @returns {{signed:number, closest:number[], triangle:number}|null}
     */
    nearest( point ) {

        const centre = this.#cellOf( point[ 0 ], point[ 1 ], point[ 2 ] );

        let best = null;
        for ( let ring = 0; ring < 64; ring ++ ) {

            for ( let x = centre[ 0 ] - ring; x <= centre[ 0 ] + ring; x ++ ) {

                for ( let y = centre[ 1 ] - ring; y <= centre[ 1 ] + ring; y ++ ) {

                    for ( let z = centre[ 2 ] - ring; z <= centre[ 2 ] + ring; z ++ ) {

                        // Only the shell of the ring; the interior was searched last time round.
                        const onShell = Math.abs( x - centre[ 0 ] ) === ring ||
                            Math.abs( y - centre[ 1 ] ) === ring ||
                            Math.abs( z - centre[ 2 ] ) === ring;
                        if ( ! onShell ) continue;

                        for ( const triangle of this.cells.get( `${ x },${ y },${ z }` ) ?? [] ) {

                            const hit = this.#closestOnTriangle( point, triangle );
                            if ( best === null || hit.distance < best.distance ) best = hit;

                        }

                    }

                }

            }

            // Nothing in a further ring can beat a hit already inside the searched box.
            if ( best !== null && best.distance <= ring * this.cellSize ) break;

        }

        if ( best === null ) return null;

        const normal = this.#interpolatedNormal( best.triangle, best.bary );
        const away = [
            point[ 0 ] - best.closest[ 0 ],
            point[ 1 ] - best.closest[ 1 ],
            point[ 2 ] - best.closest[ 2 ]
        ];
        const side = away[ 0 ] * normal[ 0 ] + away[ 1 ] * normal[ 1 ] + away[ 2 ] * normal[ 2 ];

        return {
            signed: side < 0 ? - best.distance : best.distance,
            closest: best.closest,
            triangle: best.triangle
        };

    }

    #interpolatedNormal( triangle, bary ) {

        const normal = [ 0, 0, 0 ];
        for ( let corner = 0; corner < 3; corner ++ ) {

            const vertex = this.indices[ triangle + corner ] * 3;
            for ( let axis = 0; axis < 3; axis ++ ) {

                normal[ axis ] += this.normals[ vertex + axis ] * bary[ corner ];

            }

        }

        const length = Math.hypot( ...normal ) || 1;
        return normal.map( ( value ) => value / length );

    }

    #closestOnTriangle( point, triangle ) {

        const a = this.indices[ triangle ] * 3;
        const b = this.indices[ triangle + 1 ] * 3;
        const c = this.indices[ triangle + 2 ] * 3;

        const A = [ this.positions[ a ], this.positions[ a + 1 ], this.positions[ a + 2 ] ];
        const B = [ this.positions[ b ], this.positions[ b + 1 ], this.positions[ b + 2 ] ];
        const C = [ this.positions[ c ], this.positions[ c + 1 ], this.positions[ c + 2 ] ];

        const { closest, bary } = closestPointOnTriangle( point, A, B, C );

        return {
            distance: Math.hypot( point[ 0 ] - closest[ 0 ], point[ 1 ] - closest[ 1 ],
                point[ 2 ] - closest[ 2 ] ),
            closest,
            bary,
            triangle
        };

    }

}

/** Ericson's closest-point-on-triangle, returning the barycentric coordinates with the point. */
export function closestPointOnTriangle( point, A, B, C ) {

    const sub = ( u, v ) => [ u[ 0 ] - v[ 0 ], u[ 1 ] - v[ 1 ], u[ 2 ] - v[ 2 ] ];
    const dot = ( u, v ) => u[ 0 ] * v[ 0 ] + u[ 1 ] * v[ 1 ] + u[ 2 ] * v[ 2 ];

    const ab = sub( B, A );
    const ac = sub( C, A );
    const ap = sub( point, A );

    const d1 = dot( ab, ap );
    const d2 = dot( ac, ap );
    if ( d1 <= 0 && d2 <= 0 ) return { closest: A, bary: [ 1, 0, 0 ] };

    const bp = sub( point, B );
    const d3 = dot( ab, bp );
    const d4 = dot( ac, bp );
    if ( d3 >= 0 && d4 <= d3 ) return { closest: B, bary: [ 0, 1, 0 ] };

    const vc = d1 * d4 - d3 * d2;
    if ( vc <= 0 && d1 >= 0 && d3 <= 0 ) {

        const v = d1 / ( d1 - d3 );
        return { closest: [ A[ 0 ] + ab[ 0 ] * v, A[ 1 ] + ab[ 1 ] * v, A[ 2 ] + ab[ 2 ] * v ],
            bary: [ 1 - v, v, 0 ] };

    }

    const cp = sub( point, C );
    const d5 = dot( ab, cp );
    const d6 = dot( ac, cp );
    if ( d6 >= 0 && d5 <= d6 ) return { closest: C, bary: [ 0, 0, 1 ] };

    const vb = d5 * d2 - d1 * d6;
    if ( vb <= 0 && d2 >= 0 && d6 <= 0 ) {

        const w = d2 / ( d2 - d6 );
        return { closest: [ A[ 0 ] + ac[ 0 ] * w, A[ 1 ] + ac[ 1 ] * w, A[ 2 ] + ac[ 2 ] * w ],
            bary: [ 1 - w, 0, w ] };

    }

    const va = d3 * d6 - d5 * d4;
    if ( va <= 0 && ( d4 - d3 ) >= 0 && ( d5 - d6 ) >= 0 ) {

        const w = ( d4 - d3 ) / ( ( d4 - d3 ) + ( d5 - d6 ) );
        return { closest: [ B[ 0 ] + ( C[ 0 ] - B[ 0 ] ) * w, B[ 1 ] + ( C[ 1 ] - B[ 1 ] ) * w,
            B[ 2 ] + ( C[ 2 ] - B[ 2 ] ) * w ], bary: [ 0, 1 - w, w ] };

    }

    const denominator = 1 / ( va + vb + vc );
    const v = vb * denominator;
    const w = vc * denominator;

    return {
        closest: [ A[ 0 ] + ab[ 0 ] * v + ac[ 0 ] * w,
            A[ 1 ] + ab[ 1 ] * v + ac[ 1 ] * w,
            A[ 2 ] + ab[ 2 ] * v + ac[ 2 ] * w ],
        bary: [ 1 - v - w, v, w ]
    };

}

/**
 * How much of the scalp a viewer standing on its normal would still see.
 *
 * For each scalp point a ray is fired along the surface normal, every hair triangle it crosses
 * within `reachMetres` is collected, the atlas is sampled at the hit's barycentric UV, and the
 * transmittances multiply. Returns one transmittance per scalp point: 0 is fully hidden, 1 is
 * bare skin.
 *
 * 🚩 **The alpha sample is what makes this a coverage measurement rather than a triangle count.**
 * A card is a solid quad and its hair is a cutout, so geometry alone reports a groom with no cap
 * and a groom with one as identically opaque. Measured on this asset, that is exactly what
 * happens — see the gate's own red proof.
 *
 * @param {{points:Float64Array, normals:Float64Array}} scalp - flat xyz triples.
 * @param {{positions:ArrayLike<number>, uvs:ArrayLike<number>, indices:ArrayLike<number>}} hair
 * @param {(u:number, v:number)=>number} alphaAt - the atlas's alpha, 0–1, at a UV.
 * @param {number} reachMetres
 * @returns {Float64Array} transmittance per scalp point.
 */
export function scalpTransmittance( scalp, hair, alphaAt, reachMetres ) {

    const count = scalp.points.length / 3;
    const transmittance = new Float64Array( count ).fill( 1 );

    for ( let point = 0; point < count; point ++ ) {

        const origin = [ scalp.points[ point * 3 ], scalp.points[ point * 3 + 1 ],
            scalp.points[ point * 3 + 2 ] ];
        const direction = [ scalp.normals[ point * 3 ], scalp.normals[ point * 3 + 1 ],
            scalp.normals[ point * 3 + 2 ] ];

        let through = 1;
        for ( let triangle = 0; triangle < hair.indices.length; triangle += 3 ) {

            const hit = rayTriangle( origin, direction, hair.positions, hair.indices, triangle );
            if ( hit === null || hit.distance > reachMetres ) continue;

            const uv = interpolateUv( hair.uvs, hair.indices, triangle, hit.bary );
            through *= 1 - Math.min( 1, Math.max( 0, alphaAt( uv[ 0 ], uv[ 1 ] ) ) );
            if ( through < 1e-4 ) break;

        }

        transmittance[ point ] = through;

    }

    return transmittance;

}

/** Möller–Trumbore, double sided — a hair card occludes from either face. */
export function rayTriangle( origin, direction, positions, indices, triangle ) {

    const a = indices[ triangle ] * 3;
    const b = indices[ triangle + 1 ] * 3;
    const c = indices[ triangle + 2 ] * 3;

    const edge1 = [ positions[ b ] - positions[ a ], positions[ b + 1 ] - positions[ a + 1 ],
        positions[ b + 2 ] - positions[ a + 2 ] ];
    const edge2 = [ positions[ c ] - positions[ a ], positions[ c + 1 ] - positions[ a + 1 ],
        positions[ c + 2 ] - positions[ a + 2 ] ];

    const pvec = [
        direction[ 1 ] * edge2[ 2 ] - direction[ 2 ] * edge2[ 1 ],
        direction[ 2 ] * edge2[ 0 ] - direction[ 0 ] * edge2[ 2 ],
        direction[ 0 ] * edge2[ 1 ] - direction[ 1 ] * edge2[ 0 ]
    ];
    const determinant = edge1[ 0 ] * pvec[ 0 ] + edge1[ 1 ] * pvec[ 1 ] + edge1[ 2 ] * pvec[ 2 ];
    if ( Math.abs( determinant ) < 1e-12 ) return null;

    const inverse = 1 / determinant;
    const tvec = [ origin[ 0 ] - positions[ a ], origin[ 1 ] - positions[ a + 1 ],
        origin[ 2 ] - positions[ a + 2 ] ];
    const u = ( tvec[ 0 ] * pvec[ 0 ] + tvec[ 1 ] * pvec[ 1 ] + tvec[ 2 ] * pvec[ 2 ] ) * inverse;
    if ( u < 0 || u > 1 ) return null;

    const qvec = [
        tvec[ 1 ] * edge1[ 2 ] - tvec[ 2 ] * edge1[ 1 ],
        tvec[ 2 ] * edge1[ 0 ] - tvec[ 0 ] * edge1[ 2 ],
        tvec[ 0 ] * edge1[ 1 ] - tvec[ 1 ] * edge1[ 0 ]
    ];
    const v = ( direction[ 0 ] * qvec[ 0 ] + direction[ 1 ] * qvec[ 1 ] +
        direction[ 2 ] * qvec[ 2 ] ) * inverse;
    if ( v < 0 || u + v > 1 ) return null;

    const distance = ( edge2[ 0 ] * qvec[ 0 ] + edge2[ 1 ] * qvec[ 1 ] +
        edge2[ 2 ] * qvec[ 2 ] ) * inverse;
    if ( distance <= 0 ) return null;

    return { distance, bary: [ 1 - u - v, u, v ] };

}

function interpolateUv( uvs, indices, triangle, bary ) {

    let u = 0;
    let v = 0;
    for ( let corner = 0; corner < 3; corner ++ ) {

        const vertex = indices[ triangle + corner ] * 2;
        u += uvs[ vertex ] * bary[ corner ];
        v += uvs[ vertex + 1 ] * bary[ corner ];

    }

    return [ u, v ];

}

/**
 * Where each ribbon starts and ends: the centroid of its root ring and of its tip ring.
 *
 * 🚩 **THE ROOT IS MIN v AND THE TIP IS MAX v, AND GETTING THAT BACKWARDS IS SILENT.** Blender's
 * UV origin is the bottom-left and glTF's is the top-left, so the exporter writes `v_gltf = s` —
 * `hair_cards.assemble_cards` lays the card out as `1 − s` and the export flips it back. A reading
 * taken the other way up reports roots hanging below tips, which is a groom growing out of the
 * collarbone, and every number derived from it is still perfectly self-consistent.
 *
 * @param {{vertices:number[]}[]} ribbons - the quad-strip components, `isRibbon` true.
 * @param {ArrayLike<number>} positions
 * @param {ArrayLike<number>} uvs
 * @returns {{root:number[], tip:number[]}[]} one entry per ribbon.
 */
export function ribbonEnds( ribbons, positions, uvs ) {

    return ribbons.map( ( ribbonComponent ) => {

        let lowest = Infinity;
        let highest = - Infinity;
        for ( const vertex of ribbonComponent.vertices ) {

            lowest = Math.min( lowest, uvs[ vertex * 2 + 1 ] );
            highest = Math.max( highest, uvs[ vertex * 2 + 1 ] );

        }

        const ringCentre = ( atV ) => {

            const centre = [ 0, 0, 0 ];
            let counted = 0;
            for ( const vertex of ribbonComponent.vertices ) {

                if ( Math.abs( uvs[ vertex * 2 + 1 ] - atV ) > 1e-6 ) continue;
                for ( let axis = 0; axis < 3; axis ++ ) centre[ axis ] += positions[ vertex * 3 + axis ];
                counted += 1;

            }

            return counted === 0 ? centre : centre.map( ( value ) => value / counted );

        };

        return { root: ringCentre( lowest ), tip: ringCentre( highest ) };

    } );

}

/**
 * Whether the cards GATHER on their way down, and by how much they miss the same height locally.
 *
 * 🎯 **A MOP AND A HAIRSTYLE DIFFER IN ONE MEASURABLE WAY AND THIS IS IT.** Hair separates into
 * locks: neighbouring shafts touch, travel together, and a lock's tip is TIGHTER than its root.
 * A groom whose cards each go their own way ends with its tips further apart than its roots, and
 * that is what "messy", "stringy" and "a wet, matted mop" all describe from outside.
 *
 * `ratio` is the mean nearest-neighbour distance between tips over the same between roots, so it
 * needs no length scale and holds at every identity. `tipStep` is the mean height difference to a
 * card's nearest tips — the local cut line, reported rather than gated because the layer stack is
 * deliberately graduated and a whole-groom spread measures the graduation instead.
 *
 * @param {{root:number[], tip:number[]}[]} ends - from `ribbonEnds`.
 * @param {number} neighbours - how many nearest tips the height step is averaged over.
 */
export function cardGathering( ends, neighbours = 5 ) {

    const distance = ( a, b ) => Math.hypot( a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] );

    const meanNearest = ( points ) => {

        let total = 0;
        for ( let index = 0; index < points.length; index ++ ) {

            let best = Infinity;
            for ( let other = 0; other < points.length; other ++ ) {

                if ( other === index ) continue;
                best = Math.min( best, distance( points[ index ], points[ other ] ) );

            }

            total += best;

        }

        return total / points.length;

    };

    const roots = ends.map( ( entry ) => entry.root );
    const tips = ends.map( ( entry ) => entry.tip );

    const rootNearest = meanNearest( roots );
    const tipNearest = meanNearest( tips );

    let step = 0;
    for ( let index = 0; index < tips.length; index ++ ) {

        const near = tips
            .map( ( tip, other ) => ( { other, d: distance( tips[ index ], tip ) } ) )
            .filter( ( entry ) => entry.other !== index )
            .sort( ( a, b ) => a.d - b.d )
            .slice( 0, neighbours );

        step += near.reduce(
            ( sum, entry ) => sum + Math.abs( tips[ index ][ 1 ] - tips[ entry.other ][ 1 ] ), 0 )
            / Math.max( near.length, 1 );

    }

    return {
        rootNearest,
        tipNearest,
        ratio: rootNearest > 0 ? tipNearest / rootNearest : Infinity,
        tipStep: step / tips.length
    };

}

/**
 * The u and v extents of every component, and how many atlas strips each one touches.
 *
 * A card must live in ONE strip. `strips` is computed from the u range rather than from the
 * build's bookkeeping, so a card whose UV was written a strip too wide is caught even though its
 * geometry, its skinning and its clearance are all perfect.
 */
export function uvExtentsPerComponent( components, uvs, stripCount ) {

    return components.map( ( component ) => {

        // 🎯 **Whether the card's UV is AXIS-ALIGNED, which is the property the strand shader is
        // actually standing on.** The groom exports no TANGENT — baking one splits vertices at
        // tangent discontinuities and shatters the card topology this same function is counting
        // (measured: 254 clean strips became 284 ragged ones) — so the fibre direction is the
        // card's UV bitangent, derived at load. That derivation is exact only while every vertex
        // of a card sits on one of exactly TWO u values: the strip's two edges. Rotate a card in
        // UV space, or skew it, and every strand direction inside it silently rotates with it,
        // which `docs/research/hair.md` §6.4 names as a trap and which nothing else can see.
        const columns = new Set();
        for ( const vertex of component.vertices ) columns.add( uvs[ vertex * 2 ].toFixed( 6 ) );


        let minU = Infinity;
        let maxU = - Infinity;
        let minV = Infinity;
        let maxV = - Infinity;

        for ( const vertex of component.vertices ) {

            minU = Math.min( minU, uvs[ vertex * 2 ] );
            maxU = Math.max( maxU, uvs[ vertex * 2 ] );
            minV = Math.min( minV, uvs[ vertex * 2 + 1 ] );
            maxV = Math.max( maxV, uvs[ vertex * 2 + 1 ] );

        }

        // Which strip each edge of the card lands in. Equal indices means one strip; the tiny
        // epsilon keeps a card whose right edge sits exactly on a boundary out of the next one.
        const first = Math.floor( ( minU + 1e-6 ) * stripCount );
        const last = Math.floor( ( maxU - 1e-6 ) * stripCount );

        return {
            minU, maxU, minV, maxV,
            strips: Math.max( 1, last - first + 1 ),
            uColumns: columns.size
        };

    } );

}
