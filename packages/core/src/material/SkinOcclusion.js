// Cavity occlusion for skin — the bake half.
//
// ## What this is for, and the measurement that put it here
//
// The look spec's single most saturated sample is the ear: `#755052`, HSV S 0.414, luma 0.344, and
// §2 names it as the objective SSS test. Measured on `alive.html?bare&freeze&frame=face` at
// 3840x2160 with every default toggle (aa=msaa, grade off, specaa on, ground on, shadows on), a
// 110x200 px patch of the ear reads **`#daaba0`, luma 0.7072, S 0.2646** — 2.06x the reference's
// luma at 0.64x its saturation. The lit cheek on the same plate reads luma 0.7935, so our ear
// sits at **0.891x the cheek** where the reference's sits at **0.450x**.
//
// 🎯 THE FIRST INSTINCT — "there is no transmission" — IS WRONG TODAY, AND IT WAS MEASURED WRONG.
// `SkinMaterial.transmitted()` shipped in commit dc078ad and it works. Swept on
// `skin.html?frame=face` at 1600x1600, the same 60x170 px ear patch reads:
//
//     ?trans=0   luma 0.7373    ?trans=1   luma 0.7381    ?trans=8   luma 0.7433
//
// i.e. the shipped transmission is worth **0.0008 of luma** at the ear, 0.11%. Not because the
// term is broken — under a warm back light alone (`?key=0&fill=0&rim=0&kicker=9`) the same patch
// moves from `#4d2c1b` S 0.648 hue 20.4° to `#622c1b` S 0.722 hue 14.2° when transmission is
// switched on, which is exactly the spec's signature: RED rises, green and blue do not move at
// all. The term is starved, not broken. The shipped rig's only back lights are a blue rim
// (`#8fb6ff`) and a 0.5-intensity kicker, and red-filtered tissue transmits almost nothing of a
// blue light. `SkinMaterial`'s header already says the ceiling on that effect is the colour of the
// back light rather than the shader; this is the number behind the sentence.
//
// So the ear is not too dim for want of a glow. **It is too bright for want of a shadow.** Nothing
// in this material darkens a cavity: the concha is a bowl, the gap between the ear and the skull is
// a crevice, the alar crease and the lip seam are grooves, and all four render at very nearly the
// brightness of open cheek. The rig's shadow maps cannot resolve any of them — they are
// millimetres across at a shadow texel footprint of centimetres.
//
// This module bakes the missing term: for every vertex, what fraction of its own hemisphere can
// see out. `SkinMaterial` then applies it CHROMATICALLY, so a cavity does not merely go grey — it
// goes darker AND redder AND more saturated, which is the direction the reference moves in.
//
// ## Why the answer is "visibility", not "darkness"
//
// The value baked is the cosine-weighted fraction of the hemisphere that escapes, 1 = wide open,
// 0 = sealed. It is stored that way rather than as an occlusion amount because every published
// multi-bounce formula (Jimenez et al. 2016 among them) is written in terms of visibility, and a
// value that has to be flipped on the way in is a value somebody eventually forgets to flip.
//
// ## Why the radius is short
//
// `OCCLUSION_RADIUS_MILLIMETRES` is deliberately a LOCAL radius. Long rays would fold the whole
// shape of the body into this map — the underside of the jaw, the inside of the arm, the hollow
// behind the collarbone — and those are lit shapes that the rig's shadow casters already resolve
// correctly. Baking them here too would darken them twice. The cavities this term exists for are
// all small: the concha, the ear-to-skull gap, the nostril, the alar crease, the lip seam, the
// inner canthus.

import {
    buildCentroidGrid,
    meanEdgeLength,
    nearestHit,
    orthonormalBasis
} from './SkinRegions.js';

/**
 * How far a ray looks before it declares the sky open, in millimetres.
 *
 * See the header: this is a LOCAL radius on purpose. 35 mm comfortably spans every facial cavity —
 * the deepest, the concha, is about 15 mm — and stops well short of the body-scale hollows the
 * shadow casters own.
 */
export const OCCLUSION_RADIUS_MILLIMETRES = 35;

/** Rays per vertex. See `occlusionPerVertex` for why this number and not a bigger one. */
export const OCCLUSION_RAYS = 32;

/**
 * Cosine-weighted hemisphere visibility per vertex.
 *
 * ## The estimator
 *
 * Rays are placed on a **Fibonacci spiral over the cosine-weighted hemisphere**, not sampled at
 * random. Two reasons, and the second is the important one:
 *
 *   - a bake has to give the same answer on every run, and a random set does not unless it also
 *     carries a seeded generator, which is a second thing to get right;
 *   - a spiral of N directions has far lower discrepancy than N random ones, so 32 deterministic
 *     rays resolve a cavity that would need several hundred random ones to stop speckling. The
 *     speckle matters more than the mean here: this value is rasterised into a texture and
 *     neighbouring vertices that disagree by noise render as mottling on a face, which the look
 *     spec forbids outright ("blemish layer OFF", "facial asymmetry NONE").
 *
 * Cosine weighting is folded into the ray PLACEMENT rather than into a per-ray weight —
 * `sin(theta) = sqrt(u)` for u evenly spaced — so the estimate is an unweighted mean over rays and
 * cannot be biased by a weight that does not sum to one.
 *
 * ## The self-hit offset, and the measurement that says it is NOT the hazard it is inward
 *
 * The origin is pushed OUT along the normal by the same epsilon rule `thicknessPerVertex` uses — a
 * fraction of the mesh's own mean edge length. It was added by analogy with that bake, where an
 * origin exactly on the surface self-hits and turns the whole body to glass, and the analogy is
 * WRONG in an instructive way.
 *
 * 🎯 Measured on `figure_g050` at 16 rays: with the offset, mean visibility 0.8590 and 496 sealed
 * vertices; with `epsilonEdgeFraction: 0`, mean 0.8526 and 379 sealed. A 0.6% difference, and the
 * offset produces MORE sealed vertices rather than fewer. A ray leaving a surface along +N is
 * going away from the triangle it started on, and Möller–Trumbore rejects the coplanar case on the
 * determinant, so the outward cast has no self-hit to defend against. The inward cast does, which
 * is exactly why the two look symmetric and are not.
 *
 * The offset stays — it costs nothing and it matters where a surface folds back on itself within
 * one edge length — and `SkinOcclusion.selftest.mjs` asserts the INSENSITIVITY as a measured fact,
 * so that flipping this cast inward without noticing turns that check red.
 *
 * @param {Object} mesh - `{ positions, normals, indices, vertexCount }`, positions in METRES.
 * @param {Object} [options]
 * @param {number} [options.rays=OCCLUSION_RAYS]
 * @param {number} [options.radiusMillimetres=OCCLUSION_RADIUS_MILLIMETRES]
 * @param {number} [options.epsilonEdgeFraction=0.25]
 * @returns {{visibility: Float64Array, blockedRays: number, sealedVertices: number,
 *            milliseconds: number}}
 *   `sealedVertices` counts vertices whose every ray was blocked — on a closed body that means a
 *   vertex facing into the mesh interior, which is a normals problem and not an occlusion one, so
 *   the bake reports it rather than averaging it away.
 */
export function occlusionPerVertex( mesh, options = {} ) {

    const started = Date.now();

    const { positions, normals, indices, vertexCount } = mesh;
    const rays = options.rays ?? OCCLUSION_RAYS;
    const radiusMetres = ( options.radiusMillimetres ?? OCCLUSION_RADIUS_MILLIMETRES ) / 1000;
    const epsilonEdgeFraction = options.epsilonEdgeFraction ?? 0.25;

    const triangleCount = indices.length / 3;
    const grid = buildCentroidGrid( positions, indices, triangleCount );
    const epsilon = meanEdgeLength( positions, indices, triangleCount ) * epsilonEdgeFraction;

    const directions = cosineHemisphereSpiral( rays );

    const visibility = new Float64Array( vertexCount );
    let blockedRays = 0;
    let sealedVertices = 0;

    for ( let v = 0; v < vertexCount; v ++ ) {

        const px = positions[ v * 3 ], py = positions[ v * 3 + 1 ], pz = positions[ v * 3 + 2 ];
        const nx = normals[ v * 3 ], ny = normals[ v * 3 + 1 ], nz = normals[ v * 3 + 2 ];

        // OUT along the normal, where the thickness bake goes in. Same epsilon, opposite sign.
        const ox = px + nx * epsilon, oy = py + ny * epsilon, oz = pz + nz * epsilon;
        const candidates = grid.gather( ox, oy, oz, radiusMetres );

        const basis = orthonormalBasis( nx, ny, nz );

        let open = 0;

        for ( let r = 0; r < rays; r ++ ) {

            const [ tangentU, tangentW, alongNormal ] = directions[ r ];

            const dx = basis.f[ 0 ] * alongNormal + basis.u[ 0 ] * tangentU + basis.w[ 0 ] * tangentW;
            const dy = basis.f[ 1 ] * alongNormal + basis.u[ 1 ] * tangentU + basis.w[ 1 ] * tangentW;
            const dz = basis.f[ 2 ] * alongNormal + basis.u[ 2 ] * tangentU + basis.w[ 2 ] * tangentW;

            const hit = nearestHit( positions, indices, candidates, ox, oy, oz, dx, dy, dz, radiusMetres );

            if ( hit === Infinity ) open += 1;
            else blockedRays += 1;

        }

        visibility[ v ] = open / rays;
        if ( open === 0 ) sealedVertices += 1;

    }

    return { visibility, blockedRays, sealedVertices, milliseconds: Date.now() - started };

}

/**
 * Two shapes whose cosine-weighted visibility is known on paper, answered by the estimator itself.
 *
 * Same discipline as `thicknessOfSphereCheck`: the bake proves its instrument on arithmetic before
 * it is pointed at a face, and both answers are exact rather than approximate.
 *
 *   - **A convex sphere.** No ray from a sphere's surface into its own outward hemisphere can hit
 *     the sphere again, so visibility is exactly **1** everywhere. This is the check that catches
 *     a self-hit epsilon that is too small, and it is the one that would have caught the thickness
 *     bake's original bug from the other side.
 *
 *   - **A right-angle crease.** A point on an infinite floor beside an infinitely tall
 *     perpendicular wall sees exactly half of its hemisphere, whatever its distance from the wall:
 *     a wall of unbounded height occupies every elevation on its side of the crease line, so it
 *     takes exactly the **0.5** of the cosine-weighted measure that lies in that azimuthal half.
 *     This is the check that catches a hemisphere that is not actually cosine-weighted — the
 *     sphere check cannot see sampling bias at all, because on a convex surface every direction
 *     escapes regardless of how the directions are distributed.
 *
 *     🚩 THE WALL CANNOT PASS THROUGH THE SAMPLE POINT, and the first version of this check read
 *     1.000 instead of 0.500 because it did. A zero-thickness wall coincident with the ray origin
 *     blocks nothing: every ray leaves the plane it started in and never comes back. The wall is
 *     therefore set back by `wallOffsetMetres`, which reintroduces a known, bounded leak — rays
 *     shallow enough in x that they run past the ray radius before reaching the wall. At the
 *     default 0.5 mm against a 35 mm radius that leak is about 0.9% of the hemisphere, so the
 *     honest expectation is 0.5 plus a leak the caller can shrink by shortening the offset.
 *
 * @param {Object} [options] - forwarded to `occlusionPerVertex`. `rays` matters here: the crease
 *   answer is quantised to 1/rays, so a 32-ray check can only resolve 0.5 to ±0.031.
 * @returns {{sphere: {expected: number, measured: number, absoluteError: number},
 *            crease: {expected: number, measured: number, absoluteError: number,
 *                     leakFraction: number}}}
 */
export function occlusionKnownAnswerCheck( options = {} ) {

    const sphereMedian = median( occlusionPerVertex( sphereMesh( 0.05, 48 ), options ).visibility );

    const wallOffsetMetres = options.wallOffsetMetres ?? 0.0005;
    const radiusMetres = ( options.radiusMillimetres ?? OCCLUSION_RADIUS_MILLIMETRES ) / 1000;

    const crease = creaseMesh( 0.20, wallOffsetMetres );
    const creaseVisibility = occlusionPerVertex( crease, options ).visibility;

    // Only the vertices ON the crease line have the closed-form answer; the rest of the floor is a
    // gradient away from the wall and the rest of the wall is its mirror.
    const onCrease = [];
    for ( const index of crease.creaseVertices ) onCrease.push( creaseVisibility[ index ] );
    const creaseMedian = median( Float64Array.from( onCrease ) );

    // The leak, derived rather than fitted: a ray misses the wall when its x-component is smaller
    // than offset/radius. For the cosine-weighted hemisphere, sin(theta) = sqrt(u) with u uniform,
    // so E[1/sin(theta)] = 2 and the escaping fraction of the blocked half is (2/pi)·(d/R)·2.
    const leakFraction = 2 / Math.PI * ( wallOffsetMetres / radiusMetres ) * 2;

    return {
        sphere: {
            expected: 1,
            measured: sphereMedian,
            absoluteError: Math.abs( sphereMedian - 1 )
        },
        crease: {
            expected: 0.5,
            measured: creaseMedian,
            absoluteError: Math.abs( creaseMedian - 0.5 ),
            leakFraction
        }
    };

}

// --- the sample set ------------------------------------------------------------------------------

/**
 * `rays` directions in the +Z hemisphere, cosine-distributed, returned as `[ u, w, alongNormal ]`
 * in the tangent frame.
 *
 * The golden-angle spiral: the k-th of N points takes `sin(theta) = sqrt((k + 0.5) / N)` — the
 * inverse CDF of the cosine-weighted hemisphere — and an azimuth advanced by the golden angle each
 * step, which is the arrangement that keeps neighbouring samples maximally far apart.
 */
function cosineHemisphereSpiral( rays ) {

    const GOLDEN_ANGLE = Math.PI * ( 3 - Math.sqrt( 5 ) );
    const directions = [];

    for ( let k = 0; k < rays; k ++ ) {

        const sinTheta = Math.sqrt( ( k + 0.5 ) / rays );
        const cosTheta = Math.sqrt( Math.max( 0, 1 - sinTheta * sinTheta ) );
        const phi = k * GOLDEN_ANGLE;

        directions.push( [ Math.cos( phi ) * sinTheta, Math.sin( phi ) * sinTheta, cosTheta ] );

    }

    return directions;

}

// --- the shapes the known-answer check uses ------------------------------------------------------

/** A UV sphere with outward normals, in the `{ positions, normals, indices, vertexCount }` shape. */
function sphereMesh( radiusMetres, segments ) {

    const positions = [];
    const normals = [];
    const indices = [];

    for ( let ring = 0; ring <= segments; ring ++ ) {

        const theta = ring / segments * Math.PI;

        for ( let column = 0; column <= segments; column ++ ) {

            const phi = column / segments * Math.PI * 2;
            const nx = Math.sin( theta ) * Math.cos( phi );
            const ny = Math.cos( theta );
            const nz = Math.sin( theta ) * Math.sin( phi );

            normals.push( nx, ny, nz );
            positions.push( nx * radiusMetres, ny * radiusMetres, nz * radiusMetres );

        }

    }

    const stride = segments + 1;

    for ( let ring = 0; ring < segments; ring ++ ) {

        for ( let column = 0; column < segments; column ++ ) {

            const a = ring * stride + column;
            indices.push( a, a + stride, a + 1, a + 1, a + stride, a + stride + 1 );

        }

    }

    return {
        positions: Float64Array.from( positions ),
        normals: Float64Array.from( normals ),
        indices: Uint32Array.from( indices ),
        vertexCount: positions.length / 3
    };

}

/**
 * A floor and a wall meeting at 90° along x = 0, both `size` metres across, tessellated finely
 * enough that the ray grid has something to bucket.
 *
 * `creaseVertices` lists the floor vertices sitting exactly on x = 0 — the ones whose visibility
 * is exactly 0.5. The planes are made large relative to the occlusion radius so that "infinite" is
 * true to within the ray length rather than only in the comment.
 */
function creaseMesh( size, wallOffsetMetres ) {

    const steps = 40;
    const positions = [];
    const normals = [];
    const indices = [];
    const creaseVertices = [];

    // Floor: y = 0, normal +Y, spanning x in [-size, size] and z in [-size, size].
    const floorStart = 0;
    for ( let iz = 0; iz <= steps; iz ++ ) {

        for ( let ix = 0; ix <= steps; ix ++ ) {

            const x = ( ix / steps * 2 - 1 ) * size;
            const z = ( iz / steps * 2 - 1 ) * size;

            positions.push( x, 0, z );
            normals.push( 0, 1, 0 );

            // The crease samples: on x = 0 and away from the floor's own outer edge, so the plane
            // reads as infinite over the ray radius.
            if ( ix === steps / 2 && iz > steps * 0.3 && iz < steps * 0.7 ) {

                creaseVertices.push( floorStart + iz * ( steps + 1 ) + ix );

            }

        }

    }

    pushGrid( floorStart );

    // Wall: rising to +Y at x = -wallOffsetMetres, normal +X. Set BACK from the sample line rather
    // than through it — see the note on the check above.
    const wallStart = positions.length / 3;
    for ( let iz = 0; iz <= steps; iz ++ ) {

        for ( let iy = 0; iy <= steps; iy ++ ) {

            positions.push( -wallOffsetMetres, iy / steps * size, ( iz / steps * 2 - 1 ) * size );
            normals.push( 1, 0, 0 );

        }

    }

    pushGrid( wallStart );

    return {
        positions: Float64Array.from( positions ),
        normals: Float64Array.from( normals ),
        indices: Uint32Array.from( indices ),
        vertexCount: positions.length / 3,
        creaseVertices
    };

    function pushGrid( start ) {

        const stride = steps + 1;

        for ( let row = 0; row < steps; row ++ ) {

            for ( let column = 0; column < steps; column ++ ) {

                const a = start + row * stride + column;
                indices.push( a, a + stride, a + 1, a + 1, a + stride, a + stride + 1 );

            }

        }

    }

}

function median( values ) {

    const sorted = Array.from( values ).sort( ( a, b ) => a - b );
    return sorted[ Math.floor( sorted.length / 2 ) ];

}
