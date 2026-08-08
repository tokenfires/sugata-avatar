/**
 * EyeCatchlight — punch-list 3.4's third item: a per-eye catchlight cubemap.
 *
 * WHY A SEPARATE CUBEMAP RATHER THAN THE SCENE IBL
 * ------------------------------------------------
 * From `docs/research/eyes-and-lighting.md` §6: Epic hand-places a *separate* cubemap reflection
 * per eye (`SecondaryEnvBalance` 0.00-0.03, manual rotation axis) purely so closeups get a
 * controllable catchlight independent of scene IBL. The doc's own verdict is "steal this", and §8
 * ranks a hand-placed catchlight **fourth** in the whole AAA portrait stack, above tonemapping and
 * DoF: *"Non-negotiable for portraits."*
 *
 * The reason it cannot come out of the scene lighting is structural. Our key is a RectAreaLight,
 * and three.js RectAreaLights **contribute nothing to the environment**: the LTC integration is a
 * direct-lighting term only, there is no probe, and a PMREM built from a studio HDRI carries
 * whatever windows that HDRI happened to have rather than the softbox this rig is actually using.
 * So without this file the eye's brightest highlight is either absent or borrowed from the wrong
 * room, and the eye reads as matte.
 *
 * WHAT IS GENERATED
 * -----------------
 * A small cube texture, built at runtime with no asset and no fetch, holding a black field and ONE
 * SOFTBOX — a rectangular emitter with soft edges. Rectangular matters: a round catchlight reads as
 * a point light and is the single most common tell of a real-time character. Every AAA portrait
 * reference in `research/stellar-blade-look-spec.md` has an elongated rectangular highlight in the
 * eye, because the source is a panel.
 *
 * The spec's "soft ambient wash" is NOT in the texture. It has no edge, no shape and no direction,
 * so it is a constant the shader adds — and keeping it out of the texture is what keeps it out of
 * the peak multiplier that gives the highlight its HDR headroom. See `rig.wash` below.
 *
 * Each emitter is specified in angles rather than pixels, so face resolution is a quality dial and
 * nothing else:
 *
 *     direction   unit vector, where the panel sits as seen from the eye
 *     up          which way the panel's short axis runs
 *     halfWidth   half the panel's angular width, radians
 *     halfHeight  half its angular height
 *     softness    angular width of the falloff at the edge
 *
 * The sampling direction is WORLD space, not eye space, and that is deliberate: a reflection of a
 * fixed panel stays put in the world while the eye rotates under it. Sampling in eye space would
 * paste the catchlight onto the iris and drag it around with gaze, which is exactly the "painted-on
 * dot" this exists to avoid.
 */

import { CubeTexture, LinearFilter, SRGBColorSpace } from 'three/webgpu';
import { cubeTexture } from 'three/tsl';

// Face order three.js expects for a CubeTexture, and the axes each face looks down. The u and v
// vectors are the standard cube-map convention (v points DOWN the face for every face but +Y/-Y),
// and getting them wrong shows up immediately as a catchlight that jumps between faces.
const CUBE_FACES = [
    { forward: [ 1, 0, 0 ], right: [ 0, 0, -1 ], down: [ 0, -1, 0 ] },   // +X
    { forward: [ -1, 0, 0 ], right: [ 0, 0, 1 ], down: [ 0, -1, 0 ] },   // -X
    { forward: [ 0, 1, 0 ], right: [ 1, 0, 0 ], down: [ 0, 0, 1 ] },     // +Y
    { forward: [ 0, -1, 0 ], right: [ 1, 0, 0 ], down: [ 0, 0, -1 ] },   // -Y
    { forward: [ 0, 0, 1 ], right: [ 1, 0, 0 ], down: [ 0, -1, 0 ] },    // +Z
    { forward: [ 0, 0, -1 ], right: [ -1, 0, 0 ], down: [ 0, -1, 0 ] }   // -Z
];

// Chosen from the size the highlight actually occupies, and raised from 128 when the emitter
// shrank. The spec-sized softbox spans 2 x 0.042 rad = 4.8° on g050; a face covering 90° at 128
// texels gives that highlight 6.8 texels and its 1.0° edge falloff barely one, which aliases into
// a staircase. At 256 the same highlight is 13.6 texels across with a 2.7-texel edge. The cost is
// one-off: six 256x256 faces are 393k texel evaluations at construction, and nothing per frame.
const FACE_SIZE = 256;

/**
 * HOW BIG A CATCHLIGHT IS, AND WHY IT IS NOT A TUNED NUMBER
 * --------------------------------------------------------
 * `docs/research/stellar-blade-look-spec.md` § Eyes states the highlight as a fraction of the
 * IRIS, not as an angle: *"Single dominant catchlight, small (2-4% of iris diameter), upper-outer,
 * plus soft ambient wash — not a multi-light array."* So the angular size is derived rather than
 * chosen, and it is derived per figure from geometry this project has already measured.
 *
 * On a mirror sphere of radius R the reflected direction turns at TWICE the rate of the surface
 * normal, so an emitter spanning a full angle 2θ paints an arc of only R·θ on the surface. With
 * the highlight width `w` written as a fraction `f` of the iris diameter 2·r:
 *
 *     w = R · θ  and  w = f · 2r      ⇒      θ = 2 · r · f / R
 *
 * R here is the CORNEAL anterior radius (6.91-7.64 mm across the gender sweep, LEARNINGS § figure
 * asset), not the globe radius — the highlight lives on the corneal cap and that cap is a separate,
 * much tighter sphere. Getting those two confused makes the catchlight twice the size it should be.
 *
 * ⚠️ This model is checked against a render, not trusted. `angularHalfSize()` is exercised by
 * `EyeCatchlight.selftest.mjs` against the measured geometry, and the delivered on-screen span is
 * measured on `eye.html` — see PROGRESS for the numbers.
 */
export function angularHalfSize( fractionOfIrisDiameter, irisRadius, corneaRadius ) {

    return 2 * irisRadius * fractionOfIrisDiameter / corneaRadius;

}

/**
 * The spec's own numbers, as the only place a catchlight's size or count is stated.
 *
 * `width`/`height` are fractions of iris diameter and sit inside the spec's 2-4% band — 2.0% across
 * and 3.0% tall, because a softbox is taller than it is wide and the spec's single figure has to
 * bound the larger dimension.
 *
 * ⚠️ The AUTHORED fraction is not the DELIVERED one. Sampling and the peak multiplier together add
 * a fixed skirt: measured on eye.html at 2160x2700 across authored sizes 1.8%, 3.6% and 7.2%, the
 * delivered span came out authored + 2.3 px with mipmaps on and authored + 1.0 px with them off,
 * against an iris 85 px wide. These values are chosen so the DELIVERED span lands inside the band;
 * the sweep is in PROGRESS.
 */
export const CATCHLIGHT_SIZE = Object.freeze( {
    widthFraction: 0.020,
    heightFraction: 0.030
} );

/**
 * Ready-made rigs. `softbox` matches the portrait key in `packages/testbed/src/alive.js` — offset
 * (+0.90, +0.45, +0.95) from the focus point, i.e. up, forward and to the character's left.
 *
 * 🎯 ONE DOMINANT EMITTER. The previous form of this file carried two hard-edged panels of nearly
 * equal size, and they rendered as two rectangles of comparable brightness on the iris — measured
 * at 15-17% of iris diameter each on a 2160x2700 `eye.html` portrait. The spec calls that out by
 * name: a *single* dominant catchlight "plus soft ambient wash — not a multi-light array". So the
 * fill is no longer an emitter at all: it is `rig.wash`, a constant with no shape.
 *
 * The RADIANCE lives in `EyeMaterial.CATCHLIGHT_PEAK` rather than here. The cube texture is an
 * 8-bit sRGB image and clamps at 1.0, so on its own the brightest catchlight this file can express
 * tonemaps to about 0.73 encoded — DARKER than the cheek beside it, which is the exact failure this
 * rewrite exists to remove. The texture carries the SHAPE; the shader carries the radiance.
 */
export const CATCHLIGHT_PRESETS = {

    softbox: {
        // The wash. It is a CONSTANT, not an emitter, and that is a deliberate simplification:
        // "soft ambient wash" has no edge, no shape and no position, so it needs no cubemap. It is
        // added in the shader at unit scale, which is also what keeps it OUT of the peak multiplier
        // — the first attempt at this fix put the wash in the texture and multiplied everything by
        // the peak together, and a 0.018 wash times a peak of 26 is a 0.47 veil over the whole
        // iris. It was measured by looking: the eye went uniformly grey-blue.
        wash: { colour: [ 0.74, 0.83, 1.0 ], intensity: 0.020 },

        emitters: [
            {
                direction: [ 0.90, 0.45, 0.95 ],
                up: [ 0, 1, 0 ],
                sizeFraction: [ CATCHLIGHT_SIZE.widthFraction, CATCHLIGHT_SIZE.heightFraction ],
                softnessFraction: 0.003,
                colour: [ 1.0, 0.97, 0.93 ],
                intensity: 1.0
            }
        ]
    },

    // One panel, no wash at all. The control: the only thing in the picture is the dominant
    // highlight, so its position is a pure readout of the corneal normal and its count is known to
    // be one — which is what makes it the A side of the "how many catchlights" question.
    single: {
        wash: { colour: [ 1, 1, 1 ], intensity: 0.0 },
        emitters: [
            {
                direction: [ 0.90, 0.45, 0.95 ],
                up: [ 0, 1, 0 ],
                sizeFraction: [ CATCHLIGHT_SIZE.widthFraction, CATCHLIGHT_SIZE.heightFraction ],
                softnessFraction: 0.003,
                colour: [ 1, 1, 1 ],
                intensity: 1.0
            }
        ]
    }

};

/**
 * Resolves any `sizeFraction` emitters against one eye's measured geometry, leaving explicit
 * `halfWidth`/`halfHeight` emitters alone.
 *
 * Kept separate from `buildCatchlightCubeTexture` so the conversion can be tested without a canvas,
 * and so a caller can print what it resolved to — a size stated as "2.4% of iris diameter" is
 * meaningless to a reviewer until it is also stated in radians and in millimetres on the cornea.
 *
 * @param {Object} rig       - one of CATCHLIGHT_PRESETS.
 * @param {Object} geometry  - { irisRadius, corneaRadius } in metres, from `measureEye`.
 */
export function resolveCatchlightRig( rig, geometry, sizeScale = 1 ) {

    const emitters = rig.emitters.map( ( emitter ) => {

        if ( emitter.sizeFraction === undefined ) return emitter;

        const [ widthFraction, heightFraction ] = emitter.sizeFraction;
        const half = ( fraction ) =>
            angularHalfSize( fraction * sizeScale, geometry.irisRadius, geometry.corneaRadius );

        return {
            ...emitter,
            halfWidth: half( widthFraction ),
            halfHeight: half( heightFraction ),
            softness: Math.max( half( emitter.softnessFraction ?? 0.01 ), 1e-4 )
        };

    } );

    return { ...rig, emitters };

}

/**
 * Builds the cube texture and the TSL node that samples it.
 *
 * Returns null in a headless environment rather than throwing, so the self-test can measure the
 * emitter maths (`evaluateCatchlight`) without a canvas and `EyeMaterial` can fall back to no
 * catchlight rather than failing to construct.
 *
 * @param {Object} rig - one of CATCHLIGHT_PRESETS, or the same shape.
 * @returns {?{texture: CubeTexture, node: function, dispose: function}}
 */
export function buildCatchlightCubeTexture( rig ) {

    if ( typeof document === 'undefined' ) return null;

    const emitters = rig.emitters.map( prepareEmitter );
    const images = CUBE_FACES.map( ( face ) => renderFace( face, emitters ) );

    const texture = new CubeTexture( images );
    texture.name = 'sugata.eye.catchlight';
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter;

    // 🎯 NO MIPMAPS, and this is a measured decision rather than a default.
    //
    // The reflected direction sweeps roughly 240° across an iris that is 85 px wide at 2160x2700
    // portrait framing, so a mipmapped lookup lands three or four levels down the chain and the
    // highlight arrives pre-blurred. That blur then gets multiplied by CATCHLIGHT_PEAK, which
    // pushes the whole blurred skirt over the tonemapper's shoulder — so the delivered highlight is
    // the skirt, not the panel. Measured on eye.html at three authored sizes, the delivered span
    // was authored + 2.3 px regardless of what was authored, which is the signature of a fixed blur
    // rather than of a size error. See PROGRESS for the sweep.
    //
    // The cost of turning them off is aliasing when the reflection minifies, and the reason it is
    // affordable here is that the emitter is the ONLY content in the texture and its edge is a
    // smoothstep rather than a step.
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return {
        texture,
        node: ( directionNode ) => cubeTexture( texture, directionNode ).rgb,
        dispose: () => texture.dispose()
    };

}

/**
 * The emitter field in one direction, as linear RGB. Exported so it can be tested without a GPU or
 * a canvas — this is the function that decides where the highlight lands, and it is the only part
 * of the file with an argument worth checking.
 */
export function evaluateCatchlight( rig, direction ) {

    const emitters = rig.emitters.map( prepareEmitter );
    return accumulate( normalise( direction ), emitters );

}

// --- internals -----------------------------------------------------------------------------------

function prepareEmitter( emitter ) {

    if ( emitter.halfWidth === undefined || emitter.halfHeight === undefined ) {

        throw new Error( 'EyeCatchlight: emitter has a sizeFraction and no angles. ' +
            'Pass the rig through resolveCatchlightRig( rig, eyeGeometry ) first — the angular ' +
            'size of a catchlight is derived from the corneal radius, not chosen.' );

    }

    const forward = normalise( emitter.direction );

    // Gram-Schmidt the caller's `up` against the panel direction, so a rig can be written with a
    // world up and still get an orthonormal frame.
    const rawUp = emitter.up ?? [ 0, 1, 0 ];
    const projected = subtract( rawUp, scale( forward, dot( rawUp, forward ) ) );
    const up = Math.hypot( ...projected ) < 1e-6 ? normalise( [ 1, 0, 0 ] ) : normalise( projected );
    const right = cross( up, forward );

    return {
        forward,
        up,
        right,
        halfWidth: emitter.halfWidth,
        halfHeight: emitter.halfHeight,
        softness: Math.max( emitter.softness, 1e-4 ),
        colour: emitter.colour,
        intensity: emitter.intensity
    };

}

/**
 * A soft-edged angular rectangle.
 *
 * The two angles are measured independently — horizontal angle about the panel's up axis, vertical
 * angle about its right axis — which is what makes the shape a rectangle rather than an ellipse.
 * Multiplying the two falloffs rounds the corners slightly, exactly as a real softbox's diffuser
 * does at its frame.
 */
function accumulate( direction, emitters ) {

    const colour = [ 0, 0, 0 ];

    for ( const emitter of emitters ) {

        const along = dot( direction, emitter.forward );
        if ( along <= 0 ) continue;

        const horizontal = Math.abs( Math.atan2( dot( direction, emitter.right ), along ) );
        const vertical = Math.abs( Math.atan2( dot( direction, emitter.up ), along ) );

        const across = falloff( horizontal, emitter.halfWidth, emitter.softness );
        const down = falloff( vertical, emitter.halfHeight, emitter.softness );
        const value = across * down * emitter.intensity;

        if ( value <= 0 ) continue;

        for ( let channel = 0; channel < 3; channel ++ ) {

            colour[ channel ] += emitter.colour[ channel ] * value;

        }

    }

    return colour;

}

function falloff( angle, half, softness ) {

    if ( angle <= half ) return 1;
    if ( angle >= half + softness ) return 0;

    const t = ( angle - half ) / softness;
    return 1 - t * t * ( 3 - 2 * t );   // smoothstep, descending

}

function renderFace( face, emitters ) {

    const canvas = document.createElement( 'canvas' );
    canvas.width = FACE_SIZE;
    canvas.height = FACE_SIZE;

    const context = canvas.getContext( '2d' );
    const image = context.createImageData( FACE_SIZE, FACE_SIZE );

    for ( let y = 0; y < FACE_SIZE; y ++ ) {

        // Texel centres, mapped to [-1, 1] across the face.
        const b = ( y + 0.5 ) / FACE_SIZE * 2 - 1;

        for ( let x = 0; x < FACE_SIZE; x ++ ) {

            const a = ( x + 0.5 ) / FACE_SIZE * 2 - 1;

            const direction = normalise( [
                face.forward[ 0 ] + face.right[ 0 ] * a + face.down[ 0 ] * b,
                face.forward[ 1 ] + face.right[ 1 ] * a + face.down[ 1 ] * b,
                face.forward[ 2 ] + face.right[ 2 ] * a + face.down[ 2 ] * b
            ] );

            const colour = accumulate( direction, emitters );
            const offset = ( y * FACE_SIZE + x ) * 4;

            // The texture is tagged sRGB, so the byte written has to be the sRGB encoding of the
            // linear value the emitter model produced. Writing the linear value directly is the
            // classic silent gamma bug: the catchlight comes out washed and its edge goes soft.
            image.data[ offset ] = encodeSrgbByte( colour[ 0 ] );
            image.data[ offset + 1 ] = encodeSrgbByte( colour[ 1 ] );
            image.data[ offset + 2 ] = encodeSrgbByte( colour[ 2 ] );
            image.data[ offset + 3 ] = 255;

        }

    }

    context.putImageData( image, 0, 0 );
    return canvas;

}

function encodeSrgbByte( linear ) {

    const clamped = Math.min( 1, Math.max( 0, linear ) );
    const encoded = clamped <= 0.0031308
        ? clamped * 12.92
        : 1.055 * Math.pow( clamped, 1 / 2.4 ) - 0.055;

    return Math.round( encoded * 255 );

}

function normalise( v ) {

    const length = Math.hypot( ...v );
    return [ v[ 0 ] / length, v[ 1 ] / length, v[ 2 ] / length ];

}

function dot( a, b ) {

    return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];

}

function cross( a, b ) {

    return [
        a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
        a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
        a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
    ];

}

function subtract( a, b ) {

    return [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];

}

function scale( v, k ) {

    return [ v[ 0 ] * k, v[ 1 ] * k, v[ 2 ] * k ];

}
