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
 * A small cube texture, built at runtime with no asset and no fetch, holding a dark field and one
 * or two SOFTBOXES — rectangular emitters with soft edges. Rectangular matters: a round catchlight
 * reads as a point light and is the single most common tell of a real-time character. Every AAA
 * portrait reference in `research/stellar-blade-look-spec.md` has an elongated rectangular
 * highlight in the eye, because the source is a panel.
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

import { CubeTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three/webgpu';
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

// 128 is chosen from the size the highlight actually occupies. A softbox 14° across, sampled by a
// face that spans 90°, lands on about 20 texels — enough that the panel's straight edge reads as
// straight and its corners as corners. Doubling it costs 4x the fill for a highlight that is a few
// dozen pixels on screen at portrait framing.
const FACE_SIZE = 128;

/**
 * Ready-made rigs. `softbox` matches the portrait key in `packages/testbed/src/alive.js` — offset
 * (+0.90, +0.45, +0.95) from the focus point, i.e. up, forward and to the character's left — with
 * a dim fill panel opposite it at the fill's own offset (-1.05, +0.10, +0.85).
 *
 * The intensities are ratios, not photometry: the key panel reads as a hard white highlight and the
 * fill as a faint second one, which is what a two-source portrait rig puts in an eye.
 */
export const CATCHLIGHT_PRESETS = {

    softbox: {
        ambient: [ 0.004, 0.005, 0.007 ],
        emitters: [
            {
                direction: [ 0.90, 0.45, 0.95 ],
                up: [ 0, 1, 0 ],
                halfWidth: 0.115,
                halfHeight: 0.160,
                softness: 0.045,
                colour: [ 1.0, 0.95, 0.88 ],
                intensity: 1.0
            },
            {
                direction: [ -1.05, 0.10, 0.85 ],
                up: [ 0, 1, 0 ],
                halfWidth: 0.210,
                halfHeight: 0.210,
                softness: 0.090,
                colour: [ 0.74, 0.83, 1.0 ],
                intensity: 0.16
            }
        ]
    },

    // One panel, no fill. Useful as a control: with a single emitter the catchlight's position on
    // the eye is a pure readout of the corneal normal, so a wrong frame is obvious.
    single: {
        ambient: [ 0.002, 0.002, 0.003 ],
        emitters: [
            {
                direction: [ 0.90, 0.45, 0.95 ],
                up: [ 0, 1, 0 ],
                halfWidth: 0.115,
                halfHeight: 0.160,
                softness: 0.040,
                colour: [ 1, 1, 1 ],
                intensity: 1.0
            }
        ]
    }

};

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
    const images = CUBE_FACES.map( ( face ) => renderFace( face, emitters, rig.ambient ) );

    const texture = new CubeTexture( images );
    texture.name = 'sugata.eye.catchlight';
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
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
    return accumulate( normalise( direction ), emitters, rig.ambient );

}

// --- internals -----------------------------------------------------------------------------------

function prepareEmitter( emitter ) {

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
function accumulate( direction, emitters, ambient ) {

    const colour = [ ambient[ 0 ], ambient[ 1 ], ambient[ 2 ] ];

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

function renderFace( face, emitters, ambient ) {

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

            const colour = accumulate( direction, emitters, ambient );
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
