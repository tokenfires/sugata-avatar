//
// HairRibbons.js — the strand primitive: a .tfx of guide curves in, camera-facing ribbons out.
//
// ## Why this is in `packages/core` and not in the spike that wrote it
//
// R31 decided the primitive question: short styles move to strands, the bob keeps cards plus a
// strand flyaway shell. The evidence was a prototype in `tools/spikes/strand-spike.js`, and the
// next step — ribbons inside `alive.html`'s own deferred stack, measured as a delta against
// no-hair — needs the same loader, the same geometry builder and the same lighting model on a
// SHIPPING page. A page under `packages/testbed` importing out of `tools/spikes` is backwards, and
// two copies that each decide independently is the failure `assets/hair/manifest.json`'s header
// already warns about. So the reusable core moved here and the spike imports it.
//
// ⚠️ NOTHING HERE HAS SHIPPED IN A PICTURE. It is the measured-but-unadopted primitive: the
// decision rule's ACCEPT half is still provisional on the frame-budget delta this module exists to
// make measurable. Do not read its presence in `packages/core` as adoption.
//
// ## What a ribbon is, and what it deletes
//
// One camera-facing quad strip per strand, expanded in the vertex stage across the strand's own
// tangent. The Karis BSDF in `HairMaterial.js` is PRIMITIVE-AGNOSTIC — R, TT, TRT and the
// multiple-scattering term all read a fibre tangent and never an interpolated surface normal — so
// the material carries over unchanged. What does NOT carry over is every term that existed to
// compensate for a card:
//
//   - the strand ATLAS and its alpha channel, and CHECKPOINT §2's finding that alpha cannot carry a
//     strand at card size. Coverage here is analytic across the ribbon, so there is no texel, no
//     mip chain and nothing for a trilinear filter to correctly remove.
//   - `strandTangentJitter` and its 13.8° amplitude, which exists ONLY to statistically reinstate
//     the tangent variance `flow.png`'s mip chain deletes. A ribbon's tangent is geometric.
//   - the Nyquist fade and the lock-scale pitch solve, both of which are properties of a card's
//     atlas `u` and its screen width.
//   - `flow.png`'s strand-id channel, which a filter cannot carry because the mean of two labels is
//     not a label. Here the id is a vertex attribute and is exact.
//

import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    Sphere,
    Vector3
} from 'three/webgpu';

import {
    attribute,
    cameraPosition,
    cross,
    float,
    length,
    mix,
    modelViewMatrix,
    modelWorldMatrixInverse,
    normalize,
    positionGeometry,
    smoothstep,
    uniform,
    uv,
    vec3,
    vec4
} from 'three/tsl';

import { HairLightingModel } from './HairMaterial.js';

// --- the file format ---------------------------------------------------------------------------
//
// Transcribed from `tools/figure-pipeline/tfx_export.py`, which is this repository's own writer,
// and cross-read against the consuming loader that file cites
// (`Scthe/frostbitten-hair-webgpu/src/scene/hair/tfxFileLoader.ts:31-63`). One f32 version at byte
// 0, then seven u32: numHairStrands, numVerticesPerStrand, offsetVertexPosition, and four offsets
// that are written as zero and never dereferenced. The array is STRAND-MAJOR float4 —
// `[strandIdx · pointsPerStrand + pointIdx]` — and `.w` is an is-movable flag rather than a
// thickness, so this loader reads xyz and ignores w. There is no simulation here to pin a root for.

const TFX_HEADER_BYTES = 160;
export const TFX_FLOATS_PER_POINT = 4;

// 🔴 THERE IS NO STRAND-COUNT WHITELIST, AND THERE WAS. The spike carried
// `TFX_STRAND_COUNTS = [496, 992, 2480, 4960, 11408, 24800]` — the six densities that existed the
// day it was written — and refused anything else "so a typo is caught". It then refused 3,840 and
// 8,832, which are `crop01`'s densities and the counts R31's own parity figure was measured at, so
// the guard rejected the exact grooms the round needed and R31's decision document had to file it
// as a blocker on P1.
//
// The file already declares its own `numHairStrands` in the header, so the count is a FACT to be
// READ rather than a claim to be validated. `loadTfx` returns what the file says; a caller that
// wants to know what it got asks the returned object. A typo now yields a 404 on a URL that does
// not exist, which is a better error than a list that goes stale every time the generator runs.

/**
 * frostbitten's `fiberRadius` is a HALF width — `hwRasterizeHair.wgsl.ts:40` builds
 * `thicknessVector = right · fiberRadius` and offsets ±it — so their shipped 0.0006 m is a
 * 1.2 mm ribbon. Quoted rather than chosen: it is the width at which their 11,400-strand groom
 * was authored to read, and this spike's whole purpose is to be comparable to that ablation.
 */
export const DEFAULT_RIBBON_WIDTH_METRES = 0.0012;

/**
 * The floor under `|cross(tangent, viewDir)|` before the division that normalises it.
 *
 * A strand pointing straight at the camera has no across-ribbon direction at all — the cross
 * product genuinely IS zero there, and no choice of axis is more correct than another. Dividing by
 * a clamped length rather than selecting a fallback axis means such a vertex collapses toward its
 * own centreline (a tiny numerator over a fixed floor is a tiny offset) instead of jumping to an
 * arbitrary orientation, which is the behaviour that keeps the ribbon continuous as it turns.
 */
const DEGENERATE_CROSS_FLOOR = 1e-6;


// --- loading -----------------------------------------------------------------------------------

/**
 * Reads a `.tfx` file into strand-major xyz positions.
 *
 * Every field is checked against the file's own length rather than trusted, because the consuming
 * shader indexes off the HEADER alone: a header that disagrees with the byte count is silently
 * misaligned rather than rejected, and this loader is the last place that can say so.
 *
 * @param {string} url
 * @returns {Promise<{ version:number, strandCount:number, pointsPerStrand:number,
 *   positions:Float32Array, url:string }>} `positions` is `strandCount · pointsPerStrand · 4`
 *   floats, exactly as the file stores them — xyz then the is-movable flag.
 */
export async function loadTfx( url ) {

    const response = await fetch( url );

    if ( response.ok === false ) {

        throw new Error( `strand-spike: ${ response.status } fetching '${ url }'. The .tfx files ` +
            'live outside the vite root and are mounted at /tfx/ by tools/critic/strand-spike.mjs; ' +
            'a plain `npm run dev` does not serve them. Pass ?tfxurl= to point somewhere else.' );

    }

    const buffer = await response.arrayBuffer();

    if ( buffer.byteLength < TFX_HEADER_BYTES ) {

        throw new Error( `strand-spike: '${ url }' is ${ buffer.byteLength } bytes, shorter than ` +
            `the ${ TFX_HEADER_BYTES }-byte header.` );

    }

    const view = new DataView( buffer );
    const version = view.getFloat32( 0, true );
    const strandCount = view.getUint32( 4, true );
    const pointsPerStrand = view.getUint32( 8, true );
    const offsetVertexPosition = view.getUint32( 12, true );

    const expectedBytes = offsetVertexPosition +
        strandCount * pointsPerStrand * TFX_FLOATS_PER_POINT * Float32Array.BYTES_PER_ELEMENT;

    if ( buffer.byteLength !== expectedBytes ) {

        throw new Error( `strand-spike: '${ url }' declares ${ strandCount } strands x ` +
            `${ pointsPerStrand } points from byte ${ offsetVertexPosition }, which needs ` +
            `${ expectedBytes } bytes; the file is ${ buffer.byteLength }.` );

    }

    const positions = new Float32Array( buffer, offsetVertexPosition,
        strandCount * pointsPerStrand * TFX_FLOATS_PER_POINT );

    return { version, strandCount, pointsPerStrand, positions, url };

}


// --- the ribbon ---------------------------------------------------------------------------------

/**
 * Turns strand-major points into ONE indexed geometry of camera-facing ribbon quads.
 *
 * The vertices carry the strand's CENTRELINE position; the ±half-width expansion happens in the
 * vertex stage, where the view direction is known. Two vertices per point — the ribbon's two
 * edges — so `pointsPerStrand` points become a strip of `pointsPerStrand − 1` quads.
 *
 * Attributes, and why each one is here:
 *   `position`      the centreline point. Expanded, never drawn as-is.
 *   `strandTangent` the fibre direction, by central difference along the curve. 🎯 THIS IS THE
 *                   INPUT THE WHOLE PRIMITIVE ARGUMENT RESTS ON — hair.md §1.10 calls a card's
 *                   geometric normal "a lie about a fibre bundle", and a ribbon's tangent is not a
 *                   lie about anything: it is the curve the groom generator emitted.
 *   `uv`            u is 0 or 1 ACROSS the ribbon and is both the expansion sign and the analytic
 *                   coverage ramp; v is 0 at the root and 1 at the tip, which is the root-occlusion
 *                   parameter the flow sheet used to carry.
 *   `uv1`           lock membership, only read by the `?tangent=derivative` control. See below.
 *   `strandId`      the file's own strand index, so a rendered frame can be counted against it.
 *
 * ⚠️ CENTRAL DIFFERENCES, NOT FORWARD ONES, and it changes the shading rather than only the shape.
 * A forward difference gives the last point the second-to-last point's tangent, which puts a
 * discontinuity at every tip — exactly where a strand's silhouette is thinnest and the lobes are
 * most sensitive to the tangent. The endpoints fall back to the one-sided difference because there
 * is nothing beyond them.
 *
 * @param {{strandCount:number, pointsPerStrand:number, positions:Float32Array}} tfx
 * @returns {{ geometry:BufferGeometry, triangles:number, vertices:number, degenerateTangents:number,
 *   bounds:Box3, arcLengthMetres:{mean:number, min:number, max:number} }}
 */
export function buildRibbonGeometry( tfx ) {

    const { strandCount, pointsPerStrand, positions } = tfx;

    const vertexCount = strandCount * pointsPerStrand * 2;
    const segmentCount = strandCount * ( pointsPerStrand - 1 );

    const position = new Float32Array( vertexCount * 3 );
    const tangent = new Float32Array( vertexCount * 3 );
    const texture = new Float32Array( vertexCount * 2 );
    const lockTexture = new Float32Array( vertexCount * 2 );
    const strandId = new Float32Array( vertexCount );

    // 32-bit throughout. 24,800 strands x 16 points x 2 is 793,600 vertices, which is past the
    // 65,535 a Uint16 index can reach by an order of magnitude — and a silently-wrapped index
    // draws a plausible tangle rather than erroring.
    const index = new Uint32Array( segmentCount * 6 );

    const bounds = new Box3();
    const point = new Vector3();

    let degenerateTangents = 0;
    let arcSum = 0;
    let arcMin = Infinity;
    let arcMax = 0;

    const current = new Vector3();
    const before = new Vector3();
    const after = new Vector3();
    const direction = new Vector3();
    const previousDirection = new Vector3( 0, 1, 0 );

    for ( let strand = 0; strand < strandCount; strand ++ ) {

        const strandBase = strand * pointsPerStrand * TFX_FLOATS_PER_POINT;
        let arcLength = 0;

        previousDirection.set( 0, 1, 0 );

        for ( let pointIndex = 0; pointIndex < pointsPerStrand; pointIndex ++ ) {

            const source = strandBase + pointIndex * TFX_FLOATS_PER_POINT;
            current.set( positions[ source ], positions[ source + 1 ], positions[ source + 2 ] );

            const beforeIndex = strandBase + Math.max( pointIndex - 1, 0 ) * TFX_FLOATS_PER_POINT;
            const afterIndex = strandBase +
                Math.min( pointIndex + 1, pointsPerStrand - 1 ) * TFX_FLOATS_PER_POINT;

            before.set( positions[ beforeIndex ], positions[ beforeIndex + 1 ], positions[ beforeIndex + 2 ] );
            after.set( positions[ afterIndex ], positions[ afterIndex + 1 ], positions[ afterIndex + 2 ] );

            direction.subVectors( after, before );

            // A coincident pair leaves a zero-length difference. Carrying the previous direction
            // forward keeps the ribbon oriented through the gap rather than folding it flat, and
            // the occurrence is COUNTED so the census can say whether the groom has any.
            if ( direction.lengthSq() > 0 ) previousDirection.copy( direction.normalize() );
            else degenerateTangents += 1;

            if ( pointIndex > 0 ) arcLength += current.distanceTo( before );

            bounds.expandByPoint( point.copy( current ) );

            const vertexBase = ( strand * pointsPerStrand + pointIndex ) * 2;
            const alongStrand = pointIndex / ( pointsPerStrand - 1 );

            for ( let edge = 0; edge < 2; edge ++ ) {

                const vertex = vertexBase + edge;

                position[ vertex * 3 ] = current.x;
                position[ vertex * 3 + 1 ] = current.y;
                position[ vertex * 3 + 2 ] = current.z;

                tangent[ vertex * 3 ] = previousDirection.x;
                tangent[ vertex * 3 + 1 ] = previousDirection.y;
                tangent[ vertex * 3 + 2 ] = previousDirection.z;

                texture[ vertex * 2 ] = edge;              // 0 and 1: the expansion sign AND the ramp
                texture[ vertex * 2 + 1 ] = alongStrand;   // 0 at the root, 1 at the tip

                // 🚩 LOCK MEMBERSHIP IS A STAND-IN HERE AND THE CENSUS SAYS SO. On the card groom
                // `hair_cards.py` writes the nearest of sixteen lock centres into TEXCOORD_1, and
                // that is a SPATIAL label. This spike has no lock solve, so the strand's own file
                // index is spread across the same sixteen buckets — which gives `lockTiltNode` a
                // per-strand-group tilt with the right statistics and the wrong spatial layout.
                // It is read ONLY by `?tangent=derivative`; the geometric arm never touches it.
                lockTexture[ vertex * 2 ] = ( strand + 0.5 ) / strandCount;
                lockTexture[ vertex * 2 + 1 ] = alongStrand;

                strandId[ vertex ] = strand;

            }

        }

        arcSum += arcLength;
        arcMin = Math.min( arcMin, arcLength );
        arcMax = Math.max( arcMax, arcLength );

        for ( let segment = 0; segment < pointsPerStrand - 1; segment ++ ) {

            const quad = ( strand * pointsPerStrand + segment ) * 2;
            const target = ( strand * ( pointsPerStrand - 1 ) + segment ) * 6;

            index[ target ] = quad;
            index[ target + 1 ] = quad + 1;
            index[ target + 2 ] = quad + 2;
            index[ target + 3 ] = quad + 1;
            index[ target + 4 ] = quad + 3;
            index[ target + 5 ] = quad + 2;

        }

    }

    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new BufferAttribute( position, 3 ) );
    geometry.setAttribute( 'strandTangent', new BufferAttribute( tangent, 3 ) );
    geometry.setAttribute( 'uv', new BufferAttribute( texture, 2 ) );
    geometry.setAttribute( 'uv1', new BufferAttribute( lockTexture, 2 ) );
    geometry.setAttribute( 'strandId', new BufferAttribute( strandId, 1 ) );
    geometry.setIndex( new BufferAttribute( index, 1 ) );

    // 🚩 THE BOUNDS ARE SET HERE AND GROWN BY THE CALLER, and leaving them to three would be a
    // silent half-width error at the silhouette: `computeBoundingBox` would measure the UNEXPANDED
    // centreline, and the vertex stage then pushes every edge vertex outside it. A frustum cull
    // decided on a box that is too small drops ribbons that are half on screen.
    geometry.boundingBox = bounds.clone();
    geometry.boundingSphere = bounds.getBoundingSphere( new Sphere() );

    return {
        geometry,
        triangles: segmentCount * 2,
        vertices: vertexCount,
        degenerateTangents,
        bounds,
        arcLengthMetres: { mean: arcSum / strandCount, min: arcMin, max: arcMax }
    };

}


// --- the shading frame ---------------------------------------------------------------------------

/**
 * OUR lighting model, with the fibre tangent taken from geometry instead of from screen
 * derivatives, and the root darkening taken from the ribbon's own v.
 *
 * 🎯 **NOTHING IN `packages/core` IS EDITED TO MAKE THIS WORK.** `HairLightingModel.strandTangent`
 * and `.rootOcclusion` are methods on an exported class, and `HairNodeMaterial.setupLightingModel`
 * is overridden on the INSTANCE. Every lobe — R, TT, TRT and slide 39's fake — is the shipped
 * expression reading a different tangent, which is the whole claim the spike exists to test: the
 * Karis path is primitive-agnostic because it never reads an interpolated surface normal.
 *
 * ⚠️ `geometric: false` runs the SHIPPED `strandTangentNode` instead, and it is a control rather
 * than an alternative. That expression divides two screen-space derivatives of the card's UV; on a
 * primitive whose across-ribbon extent is about one pixel, the 2x2 derivative quad straddles
 * different ribbons and open background, so `∂P/∂u` is not the ribbon's across-direction and
 * `∂P/∂v` is not the strand. It is here so that claim can be LOOKED AT rather than asserted.
 */
export class RibbonHairLightingModel extends HairLightingModel {

    constructor( nodes, { tangentView, geometric } ) {

        super( nodes );

        this.ribbonTangentView = tangentView;
        this.geometric = geometric;

    }

    strandTangent() {

        if ( this.geometric === false ) return super.strandTangent();

        return this.ribbonTangentView;

    }

    /**
     * The measured root darkening, on the ribbon's own root-to-tip parameter.
     *
     * The shipped path reads it from `flow.png`'s blue channel, and this spike has no flow sheet —
     * which would make `HairLightingModel.rootOcclusion` return a constant 1 and delete a term the
     * look spec measured. A ribbon does not need a sheet to know where its root is: `uv().y` IS the
     * root-to-tip parameter, written by `buildRibbonGeometry` from the point index. Same uniform,
     * same ramp, better input.
     */
    rootOcclusion() {

        if ( this.geometric === false ) return super.rootOcclusion();

        const nodes = this.nodes;
        const ramp = smoothstep( float( 0 ), nodes.rootOcclusionLength, uv().y );

        return mix( nodes.rootOcclusion, float( 1 ), ramp );

    }

}

/**
 * The vertex expansion and the shading tangent, as TSL.
 *
 * Both are built from ONE attribute — the strand direction sampled off the curve — so the ribbon
 * the rasteriser covers and the fibre the BSDF shades cannot disagree about which way the hair
 * runs. That is the property a card cannot have.
 *
 * The expansion is done in LOCAL space because `material.positionNode` assigns into
 * `positionLocal` (`NodeMaterial.js:804`), and the view direction is brought down to meet it by
 * `modelWorldMatrixInverse · cameraPosition` — a true per-vertex direction to the eye, so the
 * ribbon faces the camera exactly rather than facing the view PLANE. frostbitten's own hardware
 * path takes the cheaper approximation (`cross(tangentVS, vec3(0,0,1))` in view space, which is
 * exact only for an orthographic camera); this costs one subtract and is right at every angle,
 * which is what makes `?azimuth=` a fair test of it.
 *
 * @param {number} widthMetres - the FULL ribbon width. Offsets are ±half of it.
 */
export function ribbonNodes( widthMetres ) {

    const halfWidth = uniform( widthMetres / 2 );
    const tangentLocal = attribute( 'strandTangent', 'vec3' );

    // u is 0 on one edge and 1 on the other, so 2u − 1 is the expansion sign — and the SAME u is
    // the coverage ramp below. One attribute doing both is what keeps the alpha profile welded to
    // the geometry it describes: they cannot drift apart because there is nothing to drift.
    const side = uv().x.mul( 2 ).sub( 1 );

    const eyeLocal = modelWorldMatrixInverse.mul( vec4( cameraPosition, 1 ) ).xyz;
    const toEye = normalize( eyeLocal.sub( positionGeometry ) );

    const across = cross( tangentLocal, toEye );
    const acrossUnit = across.div( length( across ).max( DEGENERATE_CROSS_FLOOR ) );

    return {

        halfWidth,

        positionNode: positionGeometry.add( acrossUnit.mul( side.mul( halfWidth ) ) ),

        // The fibre direction in VIEW space, which is the space `HairLightingModel` works in:
        // `positionViewDirection` is view-space and every light reaches `direct()` there. w = 0
        // because a tangent is a direction — 🚩 frostbitten's own hardware path passes w = 1 here
        // (`hwRasterizeHair.wgsl.ts:32`), which adds the model-view translation to a direction and
        // is a bug their view-space `cross(t, (0,0,1))` happens to tolerate. This does not copy it.
        tangentView: normalize( modelViewMatrix.mul( vec4( tangentLocal, 0 ) ).xyz ),

        // frostbitten's analytic across-ribbon coverage, `processHairSegment.wgsl.ts:63`:
        // "interpW.x is in 0..1. Transform it so strand middle is 1.0 and then 0.0 at edges."
        // A triangular profile, integrating to half the ribbon's area — which is the honest
        // coverage of a round fibre seen through a flat quad, and the reason no atlas is needed.
        coverage: float( 1 ).sub( uv().x.mul( 2 ).sub( 1 ).abs() )

    };

}
