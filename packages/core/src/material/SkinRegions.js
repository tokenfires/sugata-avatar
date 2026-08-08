/**
 * SkinRegions — the two things a skin shader needs to know about a *place* on a body, baked from
 * the asset itself: **how thick the tissue is there** and **which facial region it belongs to**.
 *
 * Punch-list 3.2 shipped one roughness value and no transmission, and `docs/PROGRESS.md` records
 * why in one line each:
 *
 *   > "No transmission and no roughness map on the skin. The reference's glowing ear (#755052 at
 *   >  saturation 0.41) needs a baked thickness map and a back-lit term. […] the look spec's
 *   >  T-zone / cheek / lip 0.32–0.50 / 0.18–0.28 split cannot be honoured; one value (0.46, the
 *   >  cheek figure) ships."
 *
 * This module is the missing input for both. It is dependency-free and pure so that the browser,
 * `tools/lut-bake/bake.mjs` and the selftest all run the same arithmetic — the same arrangement
 * `SkinCurvature.js` uses, and for the same reason.
 *
 * ## 🎯 The face is already segmented, and nobody had noticed
 *
 * The obvious way to get a lip mask is to paint one, and a painted mask is wrong the moment the
 * figure pipeline emits a different bake. But `tools/figure-pipeline/build.sh` already bakes the
 * ARKit 52 onto the body mesh, and **a morph target is a region**: `mouthPucker` moves exactly the
 * vermillion and the immediate perioral skin; `noseSneerLeft` moves exactly the left alar rim;
 * `eyeBlinkLeft` moves exactly the left lid. Reading the deltas out of the GLB gives an
 * anatomically-authored segmentation that was verified by punch-list 0.3's own gate — *"all 52
 * morphs addressable by name"* — and that re-bakes correctly for figures nobody has built yet.
 *
 * `figure/ExpressionBank.js` already partitions those 52 names into seven regions for the
 * animation side. This file deliberately does **not** import it: the shading partition is not the
 * animation partition. `jaw` belongs with the cheeks for roughness and in its own region for
 * blending, and `tongue` is a different mesh entirely. The name lists here are short, explicit and
 * annotated with which spec line sets each roughness.
 *
 * ## Thickness is ray-cast, not guessed
 *
 * For each vertex, rays are fired from just under the surface into the body along −N and over a
 * cone, and the SHORTEST distance to the far surface is the thickness. That is the standard
 * offline thickness bake with the one reduction that survives a face full of cavities, and it is
 * the only definition under which an ear comes out at a few millimetres and a cheek at several
 * centimetres *without anyone deciding that in advance*. `thicknessPerVertex` explains why the
 * arithmetic mean fails, with the number it fails by.
 *
 * The estimator is checked against a shape whose answer is known on paper before it is pointed at
 * a face — a sphere of radius r has an axial thickness of exactly 2r — exactly as
 * `SkinCurvature.js` checks its curvature against spheres and a plane.
 *
 * ## What the map does NOT contain
 *
 * No pore structure, no blemish field, no asymmetry. PUNCHLIST's standing constraints forbid all
 * three and they are measured, not stylistic. The region classification is symmetric by
 * construction because the morph set is (`noseSneerLeft` and `noseSneerRight` resolve to the same
 * region), and the thickness bake is symmetric because the mesh is.
 */

// --- roughness, one line of docs/research/stellar-blade-look-spec.md §5 per entry ---------------
//
//     roughness  T-zone     0.32 – 0.40
//                cheeks     0.42 – 0.50
//                limbs      0.45 – 0.55
//                lips       0.18 – 0.28
//
// Every value below is the midpoint of its band. None of them is a taste judgement, and the one
// place this file departs from a literal reading of the spec is labelled where it happens.

/** Midpoint of the spec's lip band. The glossiest surface on the head, by a wide margin. */
export const LIP_ROUGHNESS = 0.23;

/** Midpoint of the spec's T-zone band. Nose and brow/forehead. */
export const T_ZONE_ROUGHNESS = 0.36;

/** Midpoint of the spec's cheek band — and the single value punch-list 3.2 shipped. */
export const CHEEK_ROUGHNESS = 0.46;

/** Midpoint of the spec's limb band. Everything no facial morph claims: torso, arms, scalp, neck. */
export const BODY_ROUGHNESS = 0.50;

/**
 * The shading partition, in priority order — earlier entries win where morphs overlap, and they
 * overlap a great deal around the mouth.
 *
 * `lips` leads because `mouthPucker` and the two roll targets move the vermillion hardest and
 * every other mouth target also moves it a little; without the priority the lip would be claimed
 * by whichever list happened to be visited first.
 *
 * ⚠️ `mouthSmile*`, `mouthStretch*`, `jawOpen` and friends are deliberately in `cheek` and not in
 * `lips`. They move the whole lower face, so treating them as lip would paint a glossy patch from
 * ear to ear. What separates the two lists is not anatomy-by-name but *how localised* the target
 * is, and the bake prints the claimed vertex count per region so an over-broad list is visible
 * rather than merely rendered.
 */
export const SHADING_REGIONS = Object.freeze( [

    // 🎯 The vermillion, and only the vermillion. Getting here took three measured failures, and
    // all three failed the same way: a morph target names an ACTION, and every mouth action drags
    // the philtrum and the chin along with the lip it moves. Measured against this figure, whose
    // lip seam sits at y = 1486.5 mm — found from where `jawOpen`'s vertical delta jumps from
    // −6.2 mm to −16.1 mm, i.e. from the tissue the jaw carries to the tissue it does not:
    //
    //     claim                                  verts   y range      verdict
    //     roll upper ∪ lower, magnitude @0.25      372   1450..1506   57 mm: nose to chin point
    //     mouthClose, magnitude @0.30              157   1465..1490   lower lip + 10 mm of chin
    //     mouthFunnel, outward @0.20               365   1448..1517   69 mm: worse than either
    //     mouthFunnel @0.15 ∩ seam ± 11 mm         534   22 mm tall but 94 mm WIDE
    //     mouthFunnel @0.45 ∩ seam ± 11 mm         139   21 mm tall, 51 mm wide — the vermillion
    //
    // Every one of the first three rendered as a grey-mauve goatee once an albedo tint was hung on
    // it, and NONE of them looked suspicious as a vertex count: 157 of 14,517 sounds tiny. The
    // count is the wrong statistic. The right one is the claim's extent in millimetres against an
    // anatomical lip, which the look spec itself sizes — §2, "lip vermillion height ÷ face width
    // 0.138", on a 140 mm face, is a 19 mm band.
    //
    // So the lip is the INTERSECTION of a morph claim and a band about the seam. Both halves come
    // out of the mesh: the seam is measured per figure rather than assumed, so the five gender
    // bakes each get their own.
    Object.freeze( {
        name: 'lips',
        roughness: LIP_ROUGHNESS,
        claimFraction: 0.45,
        seamBandMillimetres: 11,
        morphs: Object.freeze( [ 'mouthFunnel' ] )
    } ),

    Object.freeze( {
        name: 'nose',
        roughness: T_ZONE_ROUGHNESS,
        claimFraction: 0.20,
        morphs: Object.freeze( [ 'noseSneerLeft', 'noseSneerRight' ] )
    } ),

    Object.freeze( {
        name: 'brow',
        roughness: T_ZONE_ROUGHNESS,
        morphs: Object.freeze( [
            'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browDownLeft', 'browDownRight'
        ] )
    } ),

    Object.freeze( {
        name: 'eyelid',
        roughness: CHEEK_ROUGHNESS,
        claimFraction: 0.20,
        morphs: Object.freeze( [
            'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
            'eyeWideLeft', 'eyeWideRight'
        ] )
    } ),

    Object.freeze( {
        name: 'cheek',
        roughness: CHEEK_ROUGHNESS,
        morphs: Object.freeze( [
            'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
            'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
            'mouthDimpleLeft', 'mouthDimpleRight', 'mouthPressLeft', 'mouthPressRight',
            'mouthStretchLeft', 'mouthStretchRight',
            'mouthUpperUpLeft', 'mouthUpperUpRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
            'mouthLeft', 'mouthRight',
            'jawOpen', 'jawForward', 'jawLeft', 'jawRight'
        ] )
    } )

] );

/**
 * A vertex joins a region when some member target moves it by at least this fraction of that
 * target's own largest displacement.
 *
 * Relative, not absolute, because the 52 targets differ by an order of magnitude in stroke —
 * measured on `figure_g050`, `jawOpen` peaks at **38.74 mm** and `noseSneerLeft` at **4.82 mm** —
 * so one absolute threshold would claim the whole lower face for the jaw and nothing at all for
 * the nose. A region may override it; `lips`, `nose` and `eyelid` all do, and each says why.
 */
export const REGION_CLAIM_FRACTION = 0.08;

// --- thickness ---------------------------------------------------------------------------------

/**
 * The map's thickness ceiling. Anything at or past this is "opaque" as far as transmission goes,
 * and the encoding spends none of its range above it.
 *
 * 60 mm because that is roughly a cheek-to-cheek half-width on this head, so the broad planes of
 * the face all saturate and the map's resolution is spent where transmission actually happens —
 * the ear, the alae, the lip, the eyelid, the fingers, the nostril.
 */
export const THICKNESS_ENCODE_MAX_MILLIMETRES = 60;

/** How far a ray looks before giving up and reporting the ceiling. */
export const THICKNESS_RAY_MAX_MILLIMETRES = 120;

/**
 * Square-root encoded, and for exactly `SkinCurvature.js`'s reason: the interesting part of the
 * range is the bottom of it. A 3 mm ear is 0.05 of the ceiling, which linear 8-bit renders as
 * **13** code values against the 55 the square root gives it — and every millimetre there is a
 * visible change in how much light comes through.
 */
export function encodeThickness( millimetres ) {

    return Math.sqrt( Math.min( Math.max( millimetres, 0 ), THICKNESS_ENCODE_MAX_MILLIMETRES ) / THICKNESS_ENCODE_MAX_MILLIMETRES );

}

/** The shader does this same square in WGSL. Change one, change both. */
export function decodeThickness( encoded ) {

    return encoded * encoded * THICKNESS_ENCODE_MAX_MILLIMETRES;

}

// --- region classification ---------------------------------------------------------------------

/**
 * Which shading region owns each vertex.
 *
 * @param {Object} options
 * @param {Map<string, Float64Array>} options.morphTargets - name -> xyz deltas per vertex.
 * @param {number} options.vertexCount
 * @param {?Float64Array} [options.positions] - per-vertex xyz, in metres. Required only by regions
 *   that declare a `seamBandMillimetres`; one that asks for it without positions claims its whole
 *   morph set and says so through the returned `warnings`.
 * @param {number} [options.claimFraction=REGION_CLAIM_FRACTION]
 * @returns {{regionOf: Int8Array, counts: Object<string, number>, missing: string[],
 *            warnings: string[]}}
 *   `regionOf[v]` indexes `SHADING_REGIONS`, or −1 for "no facial morph moves this vertex".
 */
export function classifyRegionsPerVertex( { morphTargets, vertexCount, positions = null, claimFraction = REGION_CLAIM_FRACTION } ) {

    const regionOf = new Int8Array( vertexCount ).fill( -1 );
    const counts = {};
    const missing = [];
    const warnings = [];

    // Reverse priority: paint the broadest region first and let the tighter ones overwrite it.
    // Writing it this way rather than as a first-match search keeps the priority in one place —
    // the order of SHADING_REGIONS — instead of splitting it between a list and a loop condition.
    for ( let r = SHADING_REGIONS.length - 1; r >= 0; r -- ) {

        const region = SHADING_REGIONS[ r ];
        let band = null;

        if ( region.seamBandMillimetres !== undefined ) {

            const seamMetres = lipSeamHeightMetres( { morphTargets, positions, vertexCount } );

            if ( seamMetres === null ) warnings.push( `region '${ region.name }' wants a seam band but the seam could not be found; it claimed its whole morph set` );
            else band = { seamMetres, halfHeightMetres: region.seamBandMillimetres / 1000 };

        }

        for ( const name of region.morphs ) {

            const deltas = morphTargets.get( name );

            if ( deltas === undefined ) {

                if ( missing.includes( name ) === false ) missing.push( name );
                continue;

            }

            const displacement = ( v ) => Math.hypot( deltas[ v * 3 ], deltas[ v * 3 + 1 ], deltas[ v * 3 + 2 ] );

            let largest = 0;
            for ( let v = 0; v < vertexCount; v ++ ) largest = Math.max( largest, displacement( v ) );

            const threshold = largest * ( region.claimFraction ?? claimFraction );
            if ( threshold <= 0 ) continue;

            for ( let v = 0; v < vertexCount; v ++ ) {

                if ( displacement( v ) < threshold ) continue;
                if ( band !== null && Math.abs( positions[ v * 3 + 1 ] - band.seamMetres ) > band.halfHeightMetres ) continue;

                regionOf[ v ] = r;

            }

        }

    }

    for ( let r = 0; r < SHADING_REGIONS.length; r ++ ) counts[ SHADING_REGIONS[ r ].name ] = 0;
    counts.unclaimed = 0;

    for ( let v = 0; v < vertexCount; v ++ ) {

        if ( regionOf[ v ] < 0 ) counts.unclaimed += 1;
        else counts[ SHADING_REGIONS[ regionOf[ v ] ].name ] += 1;

    }

    return { regionOf, counts, missing, warnings };

}

/** Roughness per vertex, straight off the classification. Unclaimed vertices are body. */
export function roughnessPerVertex( regionOf ) {

    const roughness = new Float64Array( regionOf.length );

    for ( let v = 0; v < regionOf.length; v ++ ) {

        roughness[ v ] = regionOf[ v ] < 0 ? BODY_ROUGHNESS : SHADING_REGIONS[ regionOf[ v ] ].roughness;

    }

    return roughness;

}

/** 1 on the lip region, 0 everywhere else. Rasterisation softens the boundary for free. */
export function lipMaskPerVertex( regionOf ) {

    const lipIndex = SHADING_REGIONS.findIndex( ( region ) => region.name === 'lips' );
    const mask = new Float64Array( regionOf.length );

    for ( let v = 0; v < regionOf.length; v ++ ) mask[ v ] = regionOf[ v ] === lipIndex ? 1 : 0;

    return mask;

}

// --- thickness bake ------------------------------------------------------------------------------

/**
 * How far light has to travel through the tissue, per vertex, in millimetres.
 *
 * Rays leave from just under the surface — `position − N·ε` — and travel into the solid along −N
 * and over a cone around it. The first triangle each one hits is the far wall.
 *
 * 🎯 **The reduction over those rays is the SHORTEST path, not the mean, and that choice is the
 * difference between a map that works and one that does not.** Transmitted radiance falls as
 * `exp(−d/L)`, so a sum over paths is dominated by its shortest terms — one 3 mm path outweighs a
 * dozen 40 mm ones by four orders of magnitude. Taking the mean instead was measured on this head
 * and it fails exactly where the map is needed: the mean thickness at the ALA came out at
 * **78.10 mm**, because rays fired inward from the nostril wing fly straight down the open nostril
 * and out the far side of the skull, and the arithmetic mean lets those long escapes drown the
 * 2 mm crossing that light actually takes.
 *
 * 🚩 **The offset ε is load-bearing and it is not epsilon-sized.** Start exactly on the surface
 * and a ray immediately re-hits one of the triangles that share the vertex, reporting a thickness
 * of zero and turning the whole body into stained glass. ε is set to a fraction of the mesh's own
 * mean edge length rather than to a fixed number, so it survives a figure authored at a different
 * scale, and it is added back onto every hit distance so the answer is a thickness rather than a
 * thickness minus ε. The bake reports how many rays still self-hit.
 *
 * Acceleration is a uniform grid of triangle centroids, gathered once per vertex and reused by
 * every ray from it. A BVH would be faster and is not worth its own correctness risk here: this
 * runs offline, once per figure, and the grid version is checkable against a sphere in a minute.
 *
 * @param {Object} mesh - `{ positions, normals, indices, vertexCount }`, positions in METRES.
 * @param {Object} [options]
 * @param {number} [options.rays=9] - one axial plus a ring around it.
 * @param {number} [options.coneDegrees=40]
 * @param {number} [options.epsilonEdgeFraction=0.25] - ε as a fraction of the mesh's mean edge
 *   length. Named rather than hard-coded so the selftest can set it to zero and watch the body
 *   turn to glass, which is the only way to know the offset is doing anything.
 * `meanPathMillimetres` is returned alongside it — the arithmetic mean over the same rays, i.e.
 * the answer this function used to give. It is not the one the map is built from and nothing
 * consumes it in production; it exists so the bake can print both and the selftest can prove the
 * reduction is what makes the ala thin, without either of them re-running the cast.
 *
 * @returns {{thicknessMillimetres: Float64Array, meanPathMillimetres: Float64Array,
 *            nearZeroHits: number, misses: number, milliseconds: number}}
 *   `nearZeroHits` counts vertices that came back under one millimetre thick — an ABSOLUTE
 *   threshold rather than one relative to ε, because with ε at zero a relative count reports zero
 *   self-hits while forty vertices are reading 0.022 mm and rendering as holes in the body.
 */
export function thicknessPerVertex( mesh, options = {} ) {

    const started = Date.now();

    const { positions, normals, indices, vertexCount } = mesh;
    const rays = options.rays ?? 9;
    const coneRadians = ( options.coneDegrees ?? 40 ) * Math.PI / 180;
    const epsilonEdgeFraction = options.epsilonEdgeFraction ?? 0.25;

    const triangleCount = indices.length / 3;
    const grid = buildCentroidGrid( positions, indices, triangleCount );
    const epsilon = meanEdgeLength( positions, indices, triangleCount ) * epsilonEdgeFraction;

    const maxMetres = THICKNESS_RAY_MAX_MILLIMETRES / 1000;
    const thicknessMillimetres = new Float64Array( vertexCount );
    const meanPathMillimetres = new Float64Array( vertexCount );

    let nearZeroHits = 0;
    let misses = 0;

    for ( let v = 0; v < vertexCount; v ++ ) {

        const px = positions[ v * 3 ], py = positions[ v * 3 + 1 ], pz = positions[ v * 3 + 2 ];
        const nx = normals[ v * 3 ], ny = normals[ v * 3 + 1 ], nz = normals[ v * 3 + 2 ];

        const ox = px - nx * epsilon, oy = py - ny * epsilon, oz = pz - nz * epsilon;
        const candidates = grid.gather( ox, oy, oz, maxMetres );

        const basis = orthonormalBasis( -nx, -ny, -nz );

        let shortest = Infinity;
        let total = 0;

        for ( let r = 0; r < rays; r ++ ) {

            // Ray 0 is axial; the rest ring the cone. A ring rather than a random hemisphere
            // because the answer has to be identical on every run of the bake.
            const angle = r === 0 ? 0 : coneRadians;
            const phi = r === 0 ? 0 : ( r - 1 ) / Math.max( 1, rays - 1 ) * Math.PI * 2;

            const s = Math.sin( angle ), c = Math.cos( angle );
            const dx = basis.f[ 0 ] * c + ( basis.u[ 0 ] * Math.cos( phi ) + basis.w[ 0 ] * Math.sin( phi ) ) * s;
            const dy = basis.f[ 1 ] * c + ( basis.u[ 1 ] * Math.cos( phi ) + basis.w[ 1 ] * Math.sin( phi ) ) * s;
            const dz = basis.f[ 2 ] * c + ( basis.u[ 2 ] * Math.cos( phi ) + basis.w[ 2 ] * Math.sin( phi ) ) * s;

            const hit = nearestHit( positions, indices, candidates, ox, oy, oz, dx, dy, dz, maxMetres );

            if ( hit === Infinity ) { misses += 1; total += maxMetres; }
            else { total += hit; if ( hit < shortest ) shortest = hit; }

        }

        if ( shortest === Infinity ) shortest = maxMetres;

        thicknessMillimetres[ v ] = ( shortest + epsilon ) * 1000;
        meanPathMillimetres[ v ] = ( total / rays + epsilon ) * 1000;

        if ( thicknessMillimetres[ v ] < 1 ) nearZeroHits += 1;

    }

    return { thicknessMillimetres, meanPathMillimetres, nearZeroHits, misses, milliseconds: Date.now() - started };

}

/**
 * The estimator's own sanity check, run before it is pointed at a face.
 *
 * A sphere of radius r has an axial thickness of exactly 2r everywhere. Cone rays cut a longer
 * chord, so the mean over a 25° cone lands slightly above 2r — the closed form for one ray at
 * angle θ off the axis is `2r·cos θ`, which is *shorter*, and the reason the measured mean comes
 * out near 2r is that the cone is narrow. The check asserts the axial ray, which has no ambiguity.
 *
 * @param {Object} sphere - a mesh from `SkinCurvature.curvatureOfSphere`.
 * @param {number} radiusMetres
 * @returns {{expectedMillimetres: number, axialMedianMillimetres: number, relativeError: number}}
 */
export function thicknessOfSphereCheck( sphere, radiusMetres ) {

    const { thicknessMillimetres } = thicknessPerVertex( sphere, { rays: 1 } );

    const sorted = Array.from( thicknessMillimetres ).sort( ( a, b ) => a - b );
    const median = sorted[ Math.floor( sorted.length / 2 ) ];
    const expected = 2 * radiusMetres * 1000;

    return {
        expectedMillimetres: expected,
        axialMedianMillimetres: median,
        relativeError: Math.abs( median - expected ) / expected
    };

}

// --- the geometry the thickness bake needs -------------------------------------------------------

function meanEdgeLength( positions, indices, triangleCount ) {

    let total = 0;

    for ( let t = 0; t < triangleCount; t ++ ) {

        const a = indices[ t * 3 ], b = indices[ t * 3 + 1 ];
        total += Math.hypot(
            positions[ a * 3 ] - positions[ b * 3 ],
            positions[ a * 3 + 1 ] - positions[ b * 3 + 1 ],
            positions[ a * 3 + 2 ] - positions[ b * 3 + 2 ]
        );

    }

    return total / triangleCount;

}

/**
 * A uniform grid over triangle centroids.
 *
 * Centroids rather than full triangle AABBs: a triangle whose centroid is outside the gather
 * radius but whose corner is inside can be missed, and on a mesh whose edges average ~7 mm against
 * a 120 mm gather radius that is a sub-percent effect on a statistic the shader then square-roots.
 * Stated rather than hidden, because the alternative — inserting every triangle into every cell
 * its box touches — costs several times the memory for no measurable change in the answer.
 */
function buildCentroidGrid( positions, indices, triangleCount ) {

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    const centroids = new Float64Array( triangleCount * 3 );

    for ( let t = 0; t < triangleCount; t ++ ) {

        let cx = 0, cy = 0, cz = 0;

        for ( let k = 0; k < 3; k ++ ) {

            const i = indices[ t * 3 + k ];
            cx += positions[ i * 3 ]; cy += positions[ i * 3 + 1 ]; cz += positions[ i * 3 + 2 ];

        }

        cx /= 3; cy /= 3; cz /= 3;
        centroids[ t * 3 ] = cx; centroids[ t * 3 + 1 ] = cy; centroids[ t * 3 + 2 ] = cz;

        if ( cx < minX ) minX = cx; if ( cx > maxX ) maxX = cx;
        if ( cy < minY ) minY = cy; if ( cy > maxY ) maxY = cy;
        if ( cz < minZ ) minZ = cz; if ( cz > maxZ ) maxZ = cz;

    }

    // ~2 triangles per cell on this mesh, which keeps the gather list short without making the
    // cell count itself the cost.
    const volume = Math.max( ( maxX - minX ) * ( maxY - minY ) * ( maxZ - minZ ), 1e-9 );
    const cell = Math.cbrt( volume / triangleCount * 2 );

    const nx = Math.max( 1, Math.ceil( ( maxX - minX ) / cell ) );
    const ny = Math.max( 1, Math.ceil( ( maxY - minY ) / cell ) );
    const nz = Math.max( 1, Math.ceil( ( maxZ - minZ ) / cell ) );

    const buckets = new Array( nx * ny * nz );

    for ( let t = 0; t < triangleCount; t ++ ) {

        const key = cellIndex( centroids[ t * 3 ], centroids[ t * 3 + 1 ], centroids[ t * 3 + 2 ] );
        if ( buckets[ key ] === undefined ) buckets[ key ] = [];
        buckets[ key ].push( t );

    }

    return { cell, gather };

    function cellIndex( x, y, z ) {

        const ix = clampInteger( Math.floor( ( x - minX ) / cell ), nx );
        const iy = clampInteger( Math.floor( ( y - minY ) / cell ), ny );
        const iz = clampInteger( Math.floor( ( z - minZ ) / cell ), nz );

        return ( iz * ny + iy ) * nx + ix;

    }

    function gather( x, y, z, radius ) {

        const span = Math.ceil( radius / cell );
        const ix = clampInteger( Math.floor( ( x - minX ) / cell ), nx );
        const iy = clampInteger( Math.floor( ( y - minY ) / cell ), ny );
        const iz = clampInteger( Math.floor( ( z - minZ ) / cell ), nz );

        const found = [];

        for ( let dz = -span; dz <= span; dz ++ ) {

            const cz = iz + dz;
            if ( cz < 0 || cz >= nz ) continue;

            for ( let dy = -span; dy <= span; dy ++ ) {

                const cy = iy + dy;
                if ( cy < 0 || cy >= ny ) continue;

                for ( let dx = -span; dx <= span; dx ++ ) {

                    const cx = ix + dx;
                    if ( cx < 0 || cx >= nx ) continue;

                    const bucket = buckets[ ( cz * ny + cy ) * nx + cx ];
                    if ( bucket !== undefined ) found.push( ...bucket );

                }

            }

        }

        return found;

    }

}

function clampInteger( value, count ) {

    return value < 0 ? 0 : ( value >= count ? count - 1 : value );

}

/** Möller–Trumbore, both faces, nearest hit inside `maxDistance`. */
function nearestHit( positions, indices, candidates, ox, oy, oz, dx, dy, dz, maxDistance ) {

    let nearest = Infinity;

    for ( let c = 0; c < candidates.length; c ++ ) {

        const t = candidates[ c ];
        const a = indices[ t * 3 ], b = indices[ t * 3 + 1 ], k = indices[ t * 3 + 2 ];

        const ax = positions[ a * 3 ], ay = positions[ a * 3 + 1 ], az = positions[ a * 3 + 2 ];
        const e1x = positions[ b * 3 ] - ax, e1y = positions[ b * 3 + 1 ] - ay, e1z = positions[ b * 3 + 2 ] - az;
        const e2x = positions[ k * 3 ] - ax, e2y = positions[ k * 3 + 1 ] - ay, e2z = positions[ k * 3 + 2 ] - az;

        const px = dy * e2z - dz * e2y;
        const py = dz * e2x - dx * e2z;
        const pz = dx * e2y - dy * e2x;

        const determinant = e1x * px + e1y * py + e1z * pz;
        if ( determinant > -1e-12 && determinant < 1e-12 ) continue;

        const inverse = 1 / determinant;
        const tx = ox - ax, ty = oy - ay, tz = oz - az;

        const u = ( tx * px + ty * py + tz * pz ) * inverse;
        if ( u < 0 || u > 1 ) continue;

        const qx = ty * e1z - tz * e1y;
        const qy = tz * e1x - tx * e1z;
        const qz = tx * e1y - ty * e1x;

        const v = ( dx * qx + dy * qy + dz * qz ) * inverse;
        if ( v < 0 || u + v > 1 ) continue;

        const distance = ( e2x * qx + e2y * qy + e2z * qz ) * inverse;
        if ( distance > 1e-9 && distance < nearest && distance <= maxDistance ) nearest = distance;

    }

    return nearest;

}

/** Any orthonormal frame whose forward axis is the given (already unit) direction. */
function orthonormalBasis( fx, fy, fz ) {

    const helper = Math.abs( fy ) < 0.9 ? [ 0, 1, 0 ] : [ 1, 0, 0 ];

    let ux = helper[ 1 ] * fz - helper[ 2 ] * fy;
    let uy = helper[ 2 ] * fx - helper[ 0 ] * fz;
    let uz = helper[ 0 ] * fy - helper[ 1 ] * fx;

    const length = Math.hypot( ux, uy, uz ) || 1;
    ux /= length; uy /= length; uz /= length;

    return {
        f: [ fx, fy, fz ],
        u: [ ux, uy, uz ],
        w: [ fy * uz - fz * uy, fz * ux - fx * uz, fx * uy - fy * ux ]
    };

}

/**
 * The height of the lip seam, in metres, measured off the mesh.
 *
 * 🎯 `jawOpen` is a ruler for this. The jaw carries the lower lip and does not carry the upper
 * one, so the vertical delta down the front of the mouth steps sharply exactly at the seam —
 * measured on `figure_g050`, from **−6.2 mm** at y = 1488 to **−16.1 mm** at y = 1485. Finding the
 * largest such step gives a per-figure landmark, which matters because the five gender bakes place
 * the mouth centimetres apart.
 *
 * Returns null if the mesh has no `jawOpen`, or no positions were supplied, rather than guessing.
 *
 * @returns {?number}
 */
export function lipSeamHeightMetres( { morphTargets, positions, vertexCount } ) {

    const jaw = morphTargets.get( 'jawOpen' );
    if ( jaw === undefined || positions === null ) return null;

    // Only the front of the mouth: a jaw delta measured on the throat or the ear says nothing
    // about where the lips meet. The window is generous because it is a search range, not a claim.
    const BIN_METRES = 0.003;
    const bins = new Map();

    for ( let v = 0; v < vertexCount; v ++ ) {

        const x = Math.abs( positions[ v * 3 ] );
        const y = positions[ v * 3 + 1 ];
        const z = positions[ v * 3 + 2 ];

        if ( Math.hypot( jaw[ v * 3 ], jaw[ v * 3 + 1 ], jaw[ v * 3 + 2 ] ) <= 0 ) continue;
        if ( x > 0.03 || z < 0.10 ) continue;

        const key = Math.round( y / BIN_METRES );
        const bin = bins.get( key ) ?? { total: 0, count: 0 };
        bin.total += jaw[ v * 3 + 1 ];
        bin.count += 1;
        bins.set( key, bin );

    }

    const keys = Array.from( bins.keys() ).sort( ( a, b ) => a - b );
    if ( keys.length < 3 ) return null;

    let seamKey = null;
    let largestStep = 0;

    for ( let i = 1; i < keys.length; i ++ ) {

        if ( keys[ i ] - keys[ i - 1 ] !== 1 ) continue;

        const below = bins.get( keys[ i - 1 ] );
        const above = bins.get( keys[ i ] );
        const step = ( above.total / above.count ) - ( below.total / below.count );

        if ( step > largestStep ) { largestStep = step; seamKey = keys[ i ]; }

    }

    return seamKey === null ? null : seamKey * BIN_METRES;

}
