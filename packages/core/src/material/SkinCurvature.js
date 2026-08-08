/**
 * SkinCurvature — mean curvature off a triangle mesh, rasterised into its own UV layout.
 *
 * No three.js import: the bake runs in node (`tools/lut-bake/bake.mjs`) and the encoding constants
 * have to be readable from `SkinMaterial.js` in the browser so the shader's decode and the bake's
 * encode cannot drift apart. Those two halves are the only thing in here that MUST agree, so they
 * live side by side and `tools/lut-bake/lut-bake.selftest.mjs` round-trips them.
 *
 * ## Why baked and not computed in the shader
 *
 * Penner's own paper computes curvature per pixel as
 * `length(fwidth(normalWorld)) / length(fwidth(positionWorld))`. On a static prop that is fine. On
 * this asset it is not: the face is 100% morph-driven (no jaw bone, no eye bones — LEARNINGS
 * Part 2) and the body is skinned, so the interpolated normal is being rewritten every frame by
 * 89 morph targets, and screen-space derivatives of it carry the 2×2 quad's own stair-stepping.
 * `docs/research/rendering-stack.md` puts it plainly: *"On a skinned, morphing face this is noisy
 * and produces quad-derivative artifacts. Production practice is a baked curvature map blended
 * with the runtime term. Budget for baking it."* `SkinMaterial` keeps the runtime term available
 * behind a blend uniform; the bake is what it blends against.
 *
 * ## What is computed
 *
 * Discrete mean curvature from the cotangent Laplace–Beltrami operator (Meyer, Desbrun, Schröder &
 * Barr, *Discrete Differential-Geometry Operators for Triangulated 2-Manifolds*, VisMath 2002):
 *
 *     Δx_i = 1/(2·A_i) · Σ_j (cot α_ij + cot β_ij)·(x_j − x_i)          and     Δx_i = −2·H_i·n_i
 *
 * so `H_i = ½·|Δx_i|`, signed by which way `Δx_i` points relative to the surface normal. The sign
 * is not asserted from the formula's stated convention — `curvatureOfSphere()` exists so the bake
 * and the selftest can both check it against a mesh whose answer is known on paper.
 *
 * Two practical points that decide whether the numbers mean anything:
 *
 * **Vertices must be welded by position first.** A glTF duplicates every vertex that sits on a UV
 * seam, and an unwelded Laplacian sees each copy as a boundary vertex with half its neighbours
 * missing. On this figure that is a seam straight down the middle of the face.
 *
 * **Curvature is a per-vertex quantity here, whatever the map's resolution.** The body mesh is
 * 14,517 vertices; rasterising them into a 1024² map does not invent detail, it just puts a
 * smoothly interpolated vertex attribute somewhere the fragment shader can read without a custom
 * attribute on a geometry this module does not own.
 */

/**
 * The steepest curvature the map encodes, in 1/mm — a 1 mm radius of curvature. Nothing on a face
 * is tighter than that at 14.5k vertices, and the encoding wants its range spent where the data is.
 */
export const CURVATURE_ENCODE_MAX_PER_MILLIMETRE = 1.0;

/**
 * The map stores `sqrt( |H| / MAX )`, not `|H| / MAX`.
 *
 * A face's broad surfaces sit near 0.015 /mm (a 65 mm radius) and its features near 0.5 /mm. Linear
 * 8-bit encoding gives the cheek four code values out of 255 and wastes the top half of the range
 * on curvatures the mesh cannot represent. The square root gives the cheek 31 code values and still
 * resolves the lip border. `SkinMaterial` squares it back.
 */
export function encodeCurvature( curvaturePerMillimetre ) {

    const normalised = Math.min( 1, Math.abs( curvaturePerMillimetre ) / CURVATURE_ENCODE_MAX_PER_MILLIMETRE );
    return Math.sqrt( normalised );

}

export function decodeCurvature( encoded ) {

    return encoded * encoded * CURVATURE_ENCODE_MAX_PER_MILLIMETRE;

}

/**
 * Welds vertices that share a position, so the Laplacian sees one surface rather than a set of
 * UV islands.
 *
 * Quantised to a 1e-6 grid before hashing. Exact float equality would miss vertices that a
 * modelling package emitted at the same point through two different code paths, and 1e-6 of a
 * metre is a nanometre at figure scale — far below anything the mesh distinguishes.
 *
 * @param {Float64Array} positions - xyz per vertex.
 * @param {number} vertexCount
 * @returns {{weldOf: Int32Array, weldedCount: number}} `weldOf[v]` is v's welded index.
 */
export function weldByPosition( positions, vertexCount ) {

    const weldOf = new Int32Array( vertexCount );
    const seen = new Map();
    let weldedCount = 0;

    for ( let v = 0; v < vertexCount; v ++ ) {

        const key = `${ Math.round( positions[ v * 3 ] * 1e6 ) },`
            + `${ Math.round( positions[ v * 3 + 1 ] * 1e6 ) },`
            + `${ Math.round( positions[ v * 3 + 2 ] * 1e6 ) }`;

        const existing = seen.get( key );

        if ( existing === undefined ) {

            seen.set( key, weldedCount );
            weldOf[ v ] = weldedCount;
            weldedCount ++;

        } else {

            weldOf[ v ] = existing;

        }

    }

    return { weldOf, weldedCount };

}

/**
 * Signed discrete mean curvature per original vertex, in 1/metre (the mesh's own unit).
 *
 * Positive is convex — the surface bulges toward its outward normal, which is the case
 * pre-integrated skin is about. Concave regions come back negative and the caller decides what to
 * do with them; `SkinMaterial` clamps them off, because a crease scatters light into itself rather
 * than wrapping it around a limb.
 *
 * @param {Object} mesh
 * @param {Float64Array} mesh.positions
 * @param {Float64Array} mesh.normals
 * @param {Uint32Array} mesh.indices
 * @param {number} mesh.vertexCount
 * @returns {Float64Array} one signed curvature per original vertex, 1/metre.
 */
export function meanCurvaturePerVertex( { positions, normals, indices, vertexCount } ) {

    const { weldOf, weldedCount } = weldByPosition( positions, vertexCount );

    // Welded positions and normals: the first original vertex to claim a welded slot supplies the
    // position (they are identical by construction) and normals are averaged, because two copies
    // of a seam vertex can carry slightly different normals.
    const weldedPosition = new Float64Array( weldedCount * 3 );
    const weldedNormal = new Float64Array( weldedCount * 3 );

    for ( let v = 0; v < vertexCount; v ++ ) {

        const w = weldOf[ v ];
        weldedPosition[ w * 3 ] = positions[ v * 3 ];
        weldedPosition[ w * 3 + 1 ] = positions[ v * 3 + 1 ];
        weldedPosition[ w * 3 + 2 ] = positions[ v * 3 + 2 ];
        weldedNormal[ w * 3 ] += normals[ v * 3 ];
        weldedNormal[ w * 3 + 1 ] += normals[ v * 3 + 1 ];
        weldedNormal[ w * 3 + 2 ] += normals[ v * 3 + 2 ];

    }

    const laplacian = new Float64Array( weldedCount * 3 );
    const area = new Float64Array( weldedCount );

    for ( let t = 0; t < indices.length; t += 3 ) {

        const a = weldOf[ indices[ t ] ];
        const b = weldOf[ indices[ t + 1 ] ];
        const c = weldOf[ indices[ t + 2 ] ];

        if ( a === b || b === c || c === a ) continue;   // degenerate after welding

        accumulateTriangle( weldedPosition, laplacian, area, a, b, c );

    }

    const curvature = new Float64Array( vertexCount );

    for ( let v = 0; v < vertexCount; v ++ ) {

        const w = weldOf[ v ];

        if ( area[ w ] <= 0 ) continue;

        const lx = laplacian[ w * 3 ] / ( 2 * area[ w ] );
        const ly = laplacian[ w * 3 + 1 ] / ( 2 * area[ w ] );
        const lz = laplacian[ w * 3 + 2 ] / ( 2 * area[ w ] );

        const magnitude = Math.hypot( lx, ly, lz );

        // Δx = −2·H·n, so a Laplacian pointing AGAINST the outward normal means positive (convex)
        // mean curvature. Checked against a sphere rather than trusted — see `curvatureOfSphere`.
        const alongNormal = lx * weldedNormal[ w * 3 ] + ly * weldedNormal[ w * 3 + 1 ] + lz * weldedNormal[ w * 3 + 2 ];
        const sign = alongNormal < 0 ? 1 : -1;

        curvature[ v ] = sign * 0.5 * magnitude;

    }

    return curvature;

}

/**
 * One triangle's contribution to the cotangent Laplacian and to the barycentric vertex areas.
 *
 * Barycentric (A/3 per corner) rather than Meyer's mixed Voronoi area. On an obtuse triangle the
 * two differ, but this mesh is a quad-derived character body with well-shaped triangles, and the
 * simpler form is one the reader can check against the paper in a minute.
 */
function accumulateTriangle( position, laplacian, area, a, b, c ) {

    const ax = position[ a * 3 ], ay = position[ a * 3 + 1 ], az = position[ a * 3 + 2 ];
    const bx = position[ b * 3 ], by = position[ b * 3 + 1 ], bz = position[ b * 3 + 2 ];
    const cx = position[ c * 3 ], cy = position[ c * 3 + 1 ], cz = position[ c * 3 + 2 ];

    // Edge vectors out of each corner, for the angle at that corner.
    const cotA = cotangentAt( bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az );
    const cotB = cotangentAt( ax - bx, ay - by, az - bz, cx - bx, cy - by, cz - bz );
    const cotC = cotangentAt( ax - cx, ay - cy, az - cz, bx - cx, by - cy, bz - cz );

    // The angle at a is opposite edge (b,c), so it weights that edge's Laplacian term.
    addEdge( position, laplacian, b, c, cotA );
    addEdge( position, laplacian, c, a, cotB );
    addEdge( position, laplacian, a, b, cotC );

    const triangleArea = 0.5 * Math.hypot(
        ( by - ay ) * ( cz - az ) - ( bz - az ) * ( cy - ay ),
        ( bz - az ) * ( cx - ax ) - ( bx - ax ) * ( cz - az ),
        ( bx - ax ) * ( cy - ay ) - ( by - ay ) * ( cx - ax )
    );

    area[ a ] += triangleArea / 3;
    area[ b ] += triangleArea / 3;
    area[ c ] += triangleArea / 3;

}

function cotangentAt( ux, uy, uz, vx, vy, vz ) {

    const dot = ux * vx + uy * vy + uz * vz;
    const cross = Math.hypot(
        uy * vz - uz * vy,
        uz * vx - ux * vz,
        ux * vy - uy * vx
    );

    // A sliver triangle drives the cross product to zero and the cotangent to infinity. Clamped
    // to the cotangent of about 0.06°, which is far outside anything a character mesh contains and
    // stops one bad triangle poisoning its whole neighbourhood.
    if ( cross < 1e-12 ) return 0;

    return Math.max( -1000, Math.min( 1000, dot / cross ) );

}

function addEdge( position, laplacian, i, j, weight ) {

    for ( let axis = 0; axis < 3; axis ++ ) {

        const delta = position[ j * 3 + axis ] - position[ i * 3 + axis ];
        laplacian[ i * 3 + axis ] += weight * delta;
        laplacian[ j * 3 + axis ] -= weight * delta;

    }

}

/**
 * A tessellated sphere of known radius, and its exact mean curvature.
 *
 * This is the known-good input LEARNINGS §1.1 asks for: a sphere of radius r has mean curvature
 * exactly 1/r everywhere, and a plane has exactly 0. A discrete estimator that cannot reproduce
 * those two is not measuring curvature, whatever it prints on a face.
 *
 * @param {number} radius
 * @param {number} [segments=64]
 * @returns {{positions: Float64Array, normals: Float64Array, uvs: Float64Array,
 *            indices: Uint32Array, vertexCount: number, exactCurvature: number}}
 */
export function curvatureOfSphere( radius, segments = 64 ) {

    const rings = Math.max( 3, Math.round( segments / 2 ) );
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for ( let ring = 0; ring <= rings; ring ++ ) {

        const phi = ( ring / rings ) * Math.PI;

        for ( let segment = 0; segment <= segments; segment ++ ) {

            const theta = ( segment / segments ) * Math.PI * 2;
            const nx = Math.sin( phi ) * Math.cos( theta );
            const ny = Math.cos( phi );
            const nz = Math.sin( phi ) * Math.sin( theta );

            normals.push( nx, ny, nz );
            positions.push( nx * radius, ny * radius, nz * radius );
            uvs.push( segment / segments, ring / rings );

        }

    }

    const stride = segments + 1;

    for ( let ring = 0; ring < rings; ring ++ ) {

        for ( let segment = 0; segment < segments; segment ++ ) {

            const a = ring * stride + segment;
            const b = a + stride;
            indices.push( a, b, a + 1, a + 1, b, b + 1 );

        }

    }

    return {
        positions: Float64Array.from( positions ),
        normals: Float64Array.from( normals ),
        uvs: Float64Array.from( uvs ),
        indices: Uint32Array.from( indices ),
        vertexCount: positions.length / 3,
        exactCurvature: 1 / radius
    };

}

// --- UV rasterisation -----------------------------------------------------------------------

/**
 * Rasterises a per-vertex scalar into the mesh's UV layout.
 *
 * Flat top-left-rule scanline fill over each UV triangle, barycentric interpolation of the value.
 * Texels no triangle covers are left unwritten and filled afterwards by `dilate()`; a texel a
 * bilinear tap can reach must never be black, or every UV island's border reads as a flat surface.
 *
 * @param {Object} mesh - `{ uvs, indices }`.
 * @param {Float64Array} perVertex
 * @param {number} width
 * @param {number} height
 * @param {boolean} [flipY=true] - glTF UV origin is top-left; image rows run the same way, so the
 *   default writes row 0 at v = 0. Kept as a flag because getting it wrong produces a map that
 *   looks entirely plausible and is upside down.
 * @returns {{value: Float32Array, covered: Uint8Array, coveredFraction: number}}
 */
export function rasteriseToUv( { uvs, indices }, perVertex, width, height, flipY = false ) {

    const value = new Float32Array( width * height );
    const covered = new Uint8Array( width * height );

    for ( let t = 0; t < indices.length; t += 3 ) {

        const corner = [];

        for ( let k = 0; k < 3; k ++ ) {

            const v = indices[ t + k ];
            const u = uvs[ v * 2 ];
            const w = uvs[ v * 2 + 1 ];

            corner.push( {
                x: u * width,
                y: ( flipY ? 1 - w : w ) * height,
                value: perVertex[ v ]
            } );

        }

        fillTriangle( value, covered, width, height, corner );

    }

    let coveredCount = 0;
    for ( let i = 0; i < covered.length; i ++ ) if ( covered[ i ] === 1 ) coveredCount ++;

    return { value, covered, coveredFraction: coveredCount / covered.length };

}

function fillTriangle( value, covered, width, height, corner ) {

    const minX = Math.max( 0, Math.floor( Math.min( corner[ 0 ].x, corner[ 1 ].x, corner[ 2 ].x ) ) );
    const maxX = Math.min( width - 1, Math.ceil( Math.max( corner[ 0 ].x, corner[ 1 ].x, corner[ 2 ].x ) ) );
    const minY = Math.max( 0, Math.floor( Math.min( corner[ 0 ].y, corner[ 1 ].y, corner[ 2 ].y ) ) );
    const maxY = Math.min( height - 1, Math.ceil( Math.max( corner[ 0 ].y, corner[ 1 ].y, corner[ 2 ].y ) ) );

    const x0 = corner[ 0 ].x, y0 = corner[ 0 ].y;
    const x1 = corner[ 1 ].x, y1 = corner[ 1 ].y;
    const x2 = corner[ 2 ].x, y2 = corner[ 2 ].y;

    const denominator = ( y1 - y2 ) * ( x0 - x2 ) + ( x2 - x1 ) * ( y0 - y2 );
    if ( Math.abs( denominator ) < 1e-12 ) return;

    for ( let y = minY; y <= maxY; y ++ ) {

        const py = y + 0.5;

        for ( let x = minX; x <= maxX; x ++ ) {

            const px = x + 0.5;

            const l0 = ( ( y1 - y2 ) * ( px - x2 ) + ( x2 - x1 ) * ( py - y2 ) ) / denominator;
            const l1 = ( ( y2 - y0 ) * ( px - x2 ) + ( x0 - x2 ) * ( py - y2 ) ) / denominator;
            const l2 = 1 - l0 - l1;

            // A small negative tolerance closes the hairline cracks between adjacent triangles
            // that exact edge tests leave behind, which would otherwise show up as a grid of
            // single-texel holes for `dilate()` to guess at.
            if ( l0 < -0.001 || l1 < -0.001 || l2 < -0.001 ) continue;

            const at = y * width + x;
            value[ at ] = l0 * corner[ 0 ].value + l1 * corner[ 1 ].value + l2 * corner[ 2 ].value;
            covered[ at ] = 1;

        }

    }

}

/**
 * Grows covered texels outward into their unwritten neighbours, `passes` times.
 *
 * Bilinear sampling reaches half a texel past a UV island's edge, mipmapping reaches much further,
 * and an unwritten texel is zero — which decodes as a perfectly flat surface. So the border has to
 * carry the island's own values outward. Eight passes at 1024² covers the widest gap this atlas
 * has between islands; the count is printed by the bake so it can be checked rather than believed.
 *
 * @returns {number} how many texels were newly filled.
 */
export function dilate( value, covered, width, height, passes = 8 ) {

    let filled = 0;

    for ( let pass = 0; pass < passes; pass ++ ) {

        const frontier = [];

        for ( let y = 0; y < height; y ++ ) {

            for ( let x = 0; x < width; x ++ ) {

                const at = y * width + x;
                if ( covered[ at ] === 1 ) continue;

                let sum = 0;
                let count = 0;

                for ( let dy = -1; dy <= 1; dy ++ ) {

                    const ny = y + dy;
                    if ( ny < 0 || ny >= height ) continue;

                    for ( let dx = -1; dx <= 1; dx ++ ) {

                        const nx = x + dx;
                        if ( nx < 0 || nx >= width ) continue;

                        const neighbour = ny * width + nx;
                        if ( covered[ neighbour ] !== 1 ) continue;

                        sum += value[ neighbour ];
                        count ++;

                    }

                }

                if ( count > 0 ) frontier.push( at, sum / count );

            }

        }

        if ( frontier.length === 0 ) break;

        // Written after the whole scan so a texel filled this pass cannot seed another one in the
        // same pass — otherwise the fill runs away along the scan direction and streaks.
        for ( let i = 0; i < frontier.length; i += 2 ) {

            value[ frontier[ i ] ] = frontier[ i + 1 ];
            covered[ frontier[ i ] ] = 1;
            filled ++;

        }

    }

    return filled;

}
