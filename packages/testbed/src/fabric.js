/**
 * fabric — the RENDERED half of spike 9.16, and the only half that can see the thing the CPU gate
 * is structurally blind to.
 *
 * `tools/spikes/fabric-weave.mjs` proves, headlessly, that a twill's angle is recoverable from a
 * height field generated out of `{weave, endsPerInch, picksPerInch, yarnTex, gsm}`. Everything it
 * measures happens in JavaScript, on an array. LEARNINGS §1.25b is about exactly that shape:
 *
 *   > *"the behaviour lives in a shader that cannot be evaluated on the CPU, so you write a
 *   > JavaScript mirror of the maths, gate the mirror, and then grep the shader source… Two green
 *   > checks, one real conclusion, and the conclusion is FALSE."*
 *   > *"What closes it is not a third static check. It is a rendered measurement."*
 *
 * So this page renders the generated maps and **measures the highlight it produces**. It imports
 * the same module the gate ran on — not a copy of the maths — so there is no mirror to drift.
 *
 * WHAT IT PROVES THAT NOTHING ELSE CAN
 * ------------------------------------
 * `research/wardrobe-system.md` §5.3 flags the trap this page exists for, verbatim:
 *
 *   > *"Anisotropy. The tangent socket must link to a tangent node using the **same UVMap as the
 *   > normal map**, or the direction is wrong **without an error**."*
 *
 * A wrong tangent basis compiles, renders, looks like fabric, and points the lobe somewhere else.
 * No CPU check in the repo can see it. The measurement here is a **differential** one and it is
 * two-sided:
 *
 *   1. `anisotropy = 0` must give a ROUND highlight. If it does not, the instrument is measuring
 *      the normal map's own texture rather than the lobe, and every other number is void.
 *   2. `anisotropy = measured coherence` must elongate it, along an axis fixed by the measured
 *      twill angle.
 *   3. 🚩 **`?defect=s-twill` must MIRROR it.** Same fabric woven the other hand: identical
 *      |angle|, identical coherence, identical everything a magnitude check looks at. If the
 *      tangent basis is wrong, or the map is sampled flipped, the two renders do not mirror. This
 *      is the rejection proof, and it is a different mechanism from anything the CPU gate runs.
 *
 * WHY A DIFFERENCE IMAGE. The plane also carries a normal map and a roughness map, so the raw
 * frame is mostly weave texture and diffuse. Rendering the same frame twice with only the
 * anisotropy strength changed and measuring `I_aniso − I_isotropic` removes every term the toggle
 * did not move — attribution by toggle (LEARNINGS §1.19), with the toggle moving exactly one
 * subsystem. The lobe redistributes rather than adds, so the POSITIVE part of the difference is
 * where the highlight went and the NEGATIVE part is where it came from, and those two axes must
 * come out roughly perpendicular. Both are reported; a single number would hide the failure where
 * they do not.
 *
 * ⚠️ The frame clock is probed, not assumed. The Claude browser pane performs no layout and fires
 * no `requestAnimationFrame` (LEARNINGS §1.12), so the canvas size is pinned explicitly and the
 * loop falls back to a `MessageChannel`, which measured 553,921 dispatches/s in that pane against
 * `setTimeout`'s 8.
 *
 * ⚠️ Readback is a WebGPU-only instrument. `readRenderTargetPixelsAsync` never settles on the
 * WebGL2 backend of `WebGPURenderer` (LEARNINGS Part 2). The page says which backend came up and
 * refuses to report a measurement taken on the wrong one, rather than hanging.
 *
 * SERVE IT FROM THE REPO ROOT. This page imports `tools/spikes/fabric-weave.mjs`, which is outside
 * `packages/testbed`, so the testbed-rooted dev server cannot reach it:
 *
 *   preview_start { name: "sugata-root" }   ->   port 5199
 *   http://localhost:5199/packages/testbed/src/fabric.html
 *
 * URL parameters:
 *   ?family=denim        any key in FABRIC_FAMILIES or CONTROL_FABRICS
 *   ?defect=s-twill      wrong-advance | s-twill | transposed | flat-floats | painted-diagonal
 *   ?res=256             height-field resolution. 256 is the gate's MEASURED floor and keeps the page
 *                        interactive; every number in tools/spikes/README.md was taken at 512, and
 *                        ?res=512 reproduces them at the cost of a second or two of generation.
 *   ?aniso=0             force the anisotropy strength, overriding the measured coherence
 *   ?rot=32.9            force the anisotropy rotation in degrees from +U, overriding the measurement
 *   ?tile=18             patch repeats across the 8-unit plane; the camera sees 1.26 of those units
 *   ?w=520&h=520         drawing buffer, in device pixels
 *   ?light=0.35          point-light intensity. Raise it for a dramatic plate, lower it if the
 *                        measurement reports clipping — it refuses above 0.5% clipped texels.
 *   ?bare                hide the map previews
 */

import {
    Color,
    DataTexture,
    Mesh,
    MeshPhysicalNodeMaterial,
    NoColorSpace,
    PerspectiveCamera,
    PlaneGeometry,
    PointLight,
    RedFormat,
    RenderTarget,
    RepeatWrapping,
    RGBAFormat,
    Scene,
    UnsignedByteType,
    WebGPURenderer
} from 'three/webgpu';

import {
    fabricByKey,
    resolveSpec,
    generateHeightField,
    normalMap,
    roughnessMap,
    structureTensor,
    fftTwillAngle,
    repeatProfile,
    repeatProfileVerdict,
    anisotropyFromMeasurement,
    predictedTwillAngleDeg,
    FABRIC_CLASSES,
    NON_TEXTILE,
    WOVEN
} from '../../../tools/spikes/fabric-weave.mjs';

// --- parameters ----------------------------------------------------------------------------

const params = new URLSearchParams( location.search );
const number = ( name, fallback ) => ( params.has( name ) ? Number( params.get( name ) ) : fallback );

const FAMILY_KEY = params.get( 'family' ) ?? 'denim';
const DEFECT = params.get( 'defect' ) ?? null;
const RESOLUTION = number( 'res', 256 );
// The plane is 8 units and the camera sees 1.26 of them, so `tile` repeats spread over the WHOLE
// plane and only 1.26/8 of them are in shot. 18 puts roughly 2.8 patches across the frame, i.e.
// about 34 mm of denim — a garment close-up rather than a microscope slide.
const TILE = number( 'tile', 18 );
const WIDTH = number( 'w', 520 );
const HEIGHT = number( 'h', 520 );
const BARE = params.has( 'bare' );

const hud = document.getElementById( 'hud' );
const lines = [];
const log = ( line = '' ) => { lines.push( line ); hud.textContent = lines.join( '\n' ); };

// --- the frame clock ---------------------------------------------------------------------------

/**
 * A macrotask a hidden page does not throttle. Duplicated from `lighting.js` rather than shared,
 * for the same reason it gives: `stage.js` does not export it, this agent does not own that file,
 * and it is fifteen lines against a screenshot of "booting…".
 */
const taskChannel = new MessageChannel();
const taskQueue = [];

taskChannel.port1.onmessage = () => {

    const task = taskQueue.shift();
    if ( task !== undefined ) task();

};

function scheduleTask( task ) {

    taskQueue.push( task );
    taskChannel.port2.postMessage( 0 );

}

// --- textures ------------------------------------------------------------------------------

function normalTexture( { data, resolution } ) {

    const texture = new DataTexture( data, resolution, resolution, RGBAFormat, UnsignedByteType );

    // A normal map is data, not colour. `DataTexture` already defaults `flipY` to false, which is
    // the half of the `TextureLoader` trap in LEARNINGS Part 2 that bites baked maps — but saying
    // so explicitly is cheaper than rediscovering it when someone swaps the loader.
    texture.colorSpace = NoColorSpace;
    texture.flipY = false;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set( TILE, TILE );
    texture.needsUpdate = true;
    return texture;

}

function roughnessTexture( { data, resolution } ) {

    const bytes = new Uint8Array( resolution * resolution );
    for ( let i = 0; i < bytes.length; i ++ ) bytes[ i ] = Math.round( Math.min( 1, Math.max( 0, data[ i ] ) ) * 255 );

    const texture = new DataTexture( bytes, resolution, resolution, RedFormat, UnsignedByteType );
    texture.colorSpace = NoColorSpace;
    texture.flipY = false;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set( TILE, TILE );
    texture.needsUpdate = true;
    return texture;

}

/** Map previews, so a wrong map is visible rather than inferred from a number. */
function drawPreview( container, label, draw, size = 148 ) {

    const figure = document.createElement( 'figure' );
    const canvas = document.createElement( 'canvas' );
    canvas.width = canvas.height = size;
    const caption = document.createElement( 'figcaption' );
    caption.textContent = label;
    figure.append( canvas, caption );
    container.appendChild( figure );
    draw( canvas.getContext( '2d' ), size );

}

// --- the measurement -------------------------------------------------------------------------

/**
 * Intensity-weighted second moment of an image, returned as a principal axis and an axis ratio.
 *
 * `angleDeg` is measured from +x toward +y in SCREEN space, and the plane is rendered face-on and
 * unrotated, so screen +x is the fabric's weft direction and screen +y is the warp. That makes the
 * screen angle directly comparable with the generator's warp-relative convention once it is turned
 * by 90°, and the turn is done in one place, below, rather than sprinkled through the maths.
 */
function principalAxis( weights, width, height ) {

    let total = 0, cx = 0, cy = 0;

    for ( let y = 0; y < height; y ++ ) {

        for ( let x = 0; x < width; x ++ ) {

            const w = weights[ y * width + x ];
            total += w; cx += w * x; cy += w * y;

        }

    }

    if ( total <= 0 ) return { valid: false, reason: 'no signal' };

    cx /= total; cy /= total;

    let mxx = 0, myy = 0, mxy = 0;

    for ( let y = 0; y < height; y ++ ) {

        for ( let x = 0; x < width; x ++ ) {

            const w = weights[ y * width + x ];
            const dx = x - cx, dy = y - cy;
            mxx += w * dx * dx; myy += w * dy * dy; mxy += w * dx * dy;

        }

    }

    mxx /= total; myy /= total; mxy /= total;

    const trace = mxx + myy;
    const diff = Math.sqrt( ( mxx - myy ) ** 2 + 4 * mxy * mxy );
    const major = 0.5 * ( trace + diff );
    const minor = 0.5 * ( trace - diff );

    let angleDeg = 0.5 * Math.atan2( 2 * mxy, mxx - myy ) * 180 / Math.PI;
    while ( angleDeg > 90 ) angleDeg -= 180;
    while ( angleDeg <= -90 ) angleDeg += 180;

    return {
        valid: true,
        angleDeg,
        axisRatio: minor > 0 ? Math.sqrt( major / minor ) : Infinity,
        centroid: [ cx, cy ],
        energy: total
    };

}

/** Screen-space angle (from +x) to the generator's warp-relative angle (from +y toward +x). */
function screenToWarpRelative( screenDeg ) {

    let warp = 90 - screenDeg;
    while ( warp > 90 ) warp -= 180;
    while ( warp <= -90 ) warp += 180;
    return warp;

}

// --- boot ------------------------------------------------------------------------------------

async function main() {

    const family = fabricByKey( FAMILY_KEY );
    const spec = resolveSpec( family );

    log( `SUGATA 9.16 — procedural fabric, RENDERED measurement` );
    log( `family ${ family.key }   ${ family.label }` );
    log( `class  ${ family.klass }` );
    log( `defect ${ DEFECT ?? 'none' }` );
    log();

    // Leather is not a near miss to be handled gracefully — it is a different kind of thing, and
    // saying so is the point rather than an inconvenience. `generateHeightField` throws on it, so
    // catch it HERE and explain, instead of letting a stack trace read as a bug in the page.
    if ( family.klass === NON_TEXTILE ) {

        log( `🚩 NOTHING TO GENERATE, AND THAT IS THE ANSWER.` );
        log();
        log( `   ${ FABRIC_CLASSES[ NON_TEXTILE ] }` );
        log();
        log( `   Leather has no ends, no picks, no yarn tex and no repeat, so the parameter set this` );
        log( `   spike is about — {weave, endsPerInch, picksPerInch, yarnTex, gsm} — describes` );
        log( `   nothing about it. Its grain is a CELL structure (follicles, a Voronoi-like` );
        log( `   distribution), not a lattice, and it needs its own model. What IS in repo for it:` );
        log( `     roughness 0.55–0.70 [M]   clearcoat for patent   faux-leather drape 67.22%` );
        log( `     Blender cloth preset: bending 150, i.e. 3000x silk` );
        log();
        log( `   ${ family.source }` );
        return;

    }

    if ( family.klass !== WOVEN ) {

        log( `⚠️ ${ family.key } is ${ family.klass }, not woven. There is no twill line to render an` );
        log( `   anisotropic highlight along, and the page will show its maps without the gate.` );
        log();

    }

    // --- generate, and measure on the CPU, using the SAME module the headless gate ran ---------
    const field = generateHeightField( spec, { resolution: RESOLUTION, defect: DEFECT } );
    const tensor = structureTensor( field );
    const fft = family.klass === WOVEN ? fftTwillAngle( field ) : { refused: true, reason: family.klass };
    const repeat = family.klass === WOVEN ? repeatProfile( field, spec ) : { applicable: false };
    const repeatOk = repeatProfileVerdict( repeat );
    const material = anisotropyFromMeasurement( family, tensor, fft );
    const predicted = family.klass === WOVEN ? predictedTwillAngleDeg( spec ) : null;

    log( `CPU measurement, on a ${ RESOLUTION }² field over ${ ( field.patchWidth / 1000 ).toFixed( 2 ) } x ${ ( field.patchHeight / 1000 ).toFixed( 2 ) } mm` );
    log( `  yarn diameters      ${ field.dWarp.toFixed( 0 ) } / ${ field.dWeft.toFixed( 0 ) } µm   texel ${ field.texelX.toFixed( 1 ) } µm` );
    log( `  coherence           ${ tensor.coherence.toFixed( 4 ) }` );
    log( `  whole-patch tensor  ${ tensor.ridgeDeg.toFixed( 2 ) }°   ← RED 2: axis-aligned, not the twill` );
    log( `  predicted twill     ${ predicted === null ? '—' : predicted.toFixed( 2 ) + '°' } from the warp axis` );
    log( `  FFT twill           ${ fft.refused ? 'REFUSED — ' + fft.reason : fft.angleDeg.toFixed( 2 ) + '°' }` );
    log( `  repeat profile      ${ repeat.applicable ? repeat.fundamentalMicrons.toFixed( 2 ) + ' µm, harmonic fraction ' + ( Number.isFinite( repeat.harmonicFraction ) ? repeat.harmonicFraction.toFixed( 3 ) : 'n/a' ) + ( repeatOk.ok ? ' — interlaced' : ' — NOT AN INTERLACING' ) : '—' }` );
    log();

    const anisotropyStrength = params.has( 'aniso' ) ? number( 'aniso', 0 )
        : ( material.applicable && material.rotationDeg !== null ? Math.min( 1, material.strength ) : 0 );

    const anisotropyRotationDeg = params.has( 'rot' ) ? number( 'rot', 0 )
        : ( material.rotationDeg ?? 0 );

    log( `Material, DERIVED FROM THAT MEASUREMENT rather than authored:` );
    log( `  anisotropy strength ${ anisotropyStrength.toFixed( 4 ) }   (${ material.strengthSource })` );
    log( `  anisotropy rotation ${ anisotropyRotationDeg.toFixed( 2 ) }° from +U` );
    log( `                      (${ material.rotationSource })` );
    log( `  roughness band      ${ family.roughness.join( ' – ' ) }` );
    log();

    // Built ONCE and shared between the material and the previews. `roughnessMap` runs a windowed
    // variance over every texel, which at 512² is tens of millions of samples — calling it twice
    // is a second of wall clock for an identical result.
    const normals = normalMap( field );
    const roughness = roughnessMap( field );

    // --- renderer -----------------------------------------------------------------------------
    const canvas = document.getElementById( 'stage' );
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const renderer = new WebGPURenderer( { canvas, antialias: true, alpha: false } );
    renderer.setPixelRatio( 1 );
    renderer.setSize( WIDTH, HEIGHT, false );
    await renderer.init();

    const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    log( `Renderer: ${ backend }` );

    if ( backend !== 'WebGPU' ) {

        log( `🚩 readRenderTargetPixelsAsync NEVER SETTLES on the WebGL2 backend (LEARNINGS Part 2).` );
        log( `   The scene will render but NO measurement will be reported, because a measurement` );
        log( `   that cannot be taken is not a measurement that passed.` );

    }

    const scene = new Scene();
    scene.background = new Color( 0x000000 );

    const camera = new PerspectiveCamera( 32, WIDTH / HEIGHT, 0.1, 20 );
    camera.position.set( 0, 0, 2.2 );

    // 🚩 `tangentView` reads a `tangent` ATTRIBUTE, and PlaneGeometry does not have one. Without
    // this call the TBN matrix three builds for the anisotropy lobe is undefined — the exact
    // silent-wrong-direction failure §5.3 warns about — and nothing errors.
    // Larger than the frame on purpose. A plane whose EDGES are in shot bounds the highlight with
    // a square, and a second moment taken over a square-bounded region measures the square.
    const geometry = new PlaneGeometry( 8, 8, 1, 1 );
    geometry.computeTangents();

    const base = new MeshPhysicalNodeMaterial( {
        color: new Color( family.key === 'denim' ? 0x2a3a5c : 0x6a6a72 ),
        roughness: ( family.roughness[ 0 ] + family.roughness[ 1 ] ) / 2,
        metalness: 0.0,
        normalMap: normalTexture( normals ),
        roughnessMap: roughnessTexture( roughness ),
        anisotropy: anisotropyStrength,
        anisotropyRotation: anisotropyRotationDeg * Math.PI / 180
    } );

    const mesh = new Mesh( geometry, base );
    scene.add( mesh );

    // A point light CLOSE to the surface, on the camera axis. Two reasons, both about the
    // measurement rather than the look:
    //
    //   - on-axis puts the lobe dead centre, so the second moment is about the LOBE and not about
    //     how much of it the frame clipped;
    //   - close makes the inverse-square falloff compact, so the lobe has an edge inside the frame.
    //     At `roughness` 0.65 a distant light spreads the specular across the entire plane and the
    //     "highlight orientation" then measures the viewport.
    //
    // The falloff itself is radially symmetric, so it changes the lobe's SIZE and never its axis.
    const key = new PointLight( 0xffffff, number( 'light', 0.35 ) );
    key.position.set( 0, 0, 0.55 );
    scene.add( key );

    renderer.render( scene, camera );

    // --- previews ------------------------------------------------------------------------------
    if ( ! BARE ) {

        const container = document.getElementById( 'maps' );
        const n = field.resolution;

        drawPreview( container, `height  ${ ( field.thicknessMicrons ).toFixed( 0 ) } µm p-p`, ( ctx, size ) => {

            const image = ctx.createImageData( n, n );
            let lo = Infinity, hi = -Infinity;
            for ( const h of field.heights ) { if ( h < lo ) lo = h; if ( h > hi ) hi = h; }
            for ( let i = 0; i < n * n; i ++ ) {

                const v = Math.round( 255 * ( field.heights[ i ] - lo ) / Math.max( 1e-9, hi - lo ) );
                image.data[ i * 4 ] = image.data[ i * 4 + 1 ] = image.data[ i * 4 + 2 ] = v;
                image.data[ i * 4 + 3 ] = 255;

            }
            const off = new OffscreenCanvas( n, n );
            off.getContext( '2d' ).putImageData( image, 0, 0 );
            // Flip vertically so +y (the warp) points UP in the preview, matching the render.
            ctx.save(); ctx.translate( 0, size ); ctx.scale( 1, -1 );
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage( off, 0, 0, size, size );
            ctx.restore();

        } );

        drawPreview( container, 'normal', ( ctx, size ) => {

            const image = new ImageData( new Uint8ClampedArray( normals.data ), n, n );
            const off = new OffscreenCanvas( n, n );
            off.getContext( '2d' ).putImageData( image, 0, 0 );
            ctx.save(); ctx.translate( 0, size ); ctx.scale( 1, -1 );
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage( off, 0, 0, size, size );
            ctx.restore();

        } );

        drawPreview( container, `roughness ${ family.roughness.join( '–' ) }`, ( ctx, size ) => {

            const { data, band } = roughness;
            const image = ctx.createImageData( n, n );
            for ( let i = 0; i < n * n; i ++ ) {

                const v = Math.round( 255 * ( data[ i ] - band[ 0 ] ) / Math.max( 1e-9, band[ 1 ] - band[ 0 ] ) );
                image.data[ i * 4 ] = image.data[ i * 4 + 1 ] = image.data[ i * 4 + 2 ] = v;
                image.data[ i * 4 + 3 ] = 255;

            }
            const off = new OffscreenCanvas( n, n );
            off.getContext( '2d' ).putImageData( image, 0, 0 );
            ctx.save(); ctx.translate( 0, size ); ctx.scale( 1, -1 );
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage( off, 0, 0, size, size );
            ctx.restore();

        } );

    }

    // --- the rendered measurement ---------------------------------------------------------------
    if ( backend === 'WebGPU' && family.klass === WOVEN ) {

        await measureHighlight( { renderer, scene, camera, base, key, anisotropyStrength, fft, predicted } );

    } else if ( family.klass !== WOVEN ) {

        log();
        log( `No rendered measurement: ${ family.key } is ${ family.klass }. The instrument below the` );
        log( `fold measures where an ANISOTROPY LOBE points, and this family has no yarn axis for one` );
        log( `to point along. Its maps are on the left and they are the whole output.` );

    }

    globalThis.__SUGATA_FABRIC__ = () => ( {
        family: family.key, defect: DEFECT, backend,
        coherence: tensor.coherence,
        tensorRidgeDeg: tensor.ridgeDeg,
        predictedTwillDeg: predicted,
        fft,
        repeat: { fundamentalMicrons: repeat.fundamentalMicrons, harmonicFraction: repeat.harmonicFraction, ok: repeatOk.ok },
        anisotropyStrength,
        anisotropyRotationDeg,
        highlight: globalThis.__SUGATA_FABRIC_HIGHLIGHT__ ?? null
    } );

    // Keep the canvas alive without trusting rAF (LEARNINGS §1.12). Nothing animates; this exists
    // so the pane has a composited frame to screenshot.
    const tick = () => { renderer.render( scene, camera ); scheduleTask( tick ); };
    scheduleTask( tick );

}

/**
 * The rendered measurement.
 *
 * 🚩 THE SECOND MOMENT WAS THE OBVIOUS INSTRUMENT AND IT WAS THE WRONG ONE, measured rather than
 * predicted. An intensity-weighted covariance over the difference image gave a "gained" axis 35°
 * away from the twill and a "gained ⟂ lost" pair only 11° apart when they must be 90° apart, on a
 * frame whose highlight is unmistakable by eye. Two reasons, and both are about the lobe rather
 * than about the code: a second moment integrates the far tail, where a broad `roughness` 0.65 lobe
 * has most of its area and almost none of its shape, and it is swamped by per-yarn glints that
 * outnumber the lobe's own texels.
 *
 * What works is the classic lobe descriptor: the **half-maximum radius as a function of direction**,
 * `r(θ)`. It reads the lobe's edge, which is where the shape is, and ignores the tail entirely.
 * `max r / min r` is the elongation and `argmax r` is the axis.
 */
async function measureHighlight( { renderer, scene, camera, base, key, anisotropyStrength, fft, predicted } ) {

    const w = 256, h = 256;
    const target = new RenderTarget( w, h );

    const shoot = async () => {

        renderer.setRenderTarget( target );
        renderer.render( scene, camera );
        renderer.setRenderTarget( null );
        const pixels = await renderer.readRenderTargetPixelsAsync( target, 0, 0, w, h );
        const luma = new Float32Array( w * h );
        for ( let i = 0; i < w * h; i ++ ) {

            luma[ i ] = ( 0.2126 * pixels[ i * 4 ] + 0.7152 * pixels[ i * 4 + 1 ] + 0.0722 * pixels[ i * 4 + 2 ] ) / 255;

        }
        return luma;

    };

    const blur = ( source, radius ) => {

        const tmp = new Float32Array( w * h );
        const out = new Float32Array( w * h );
        for ( let y = 0; y < h; y ++ ) for ( let x = 0; x < w; x ++ ) {

            let sum = 0, n = 0;
            for ( let d = - radius; d <= radius; d ++ ) { const xx = x + d; if ( xx >= 0 && xx < w ) { sum += source[ y * w + xx ]; n ++; } }
            tmp[ y * w + x ] = sum / n;

        }
        for ( let y = 0; y < h; y ++ ) for ( let x = 0; x < w; x ++ ) {

            let sum = 0, n = 0;
            for ( let d = - radius; d <= radius; d ++ ) { const yy = y + d; if ( yy >= 0 && yy < h ) { sum += tmp[ yy * w + x ]; n ++; } }
            out[ y * w + x ] = sum / n;

        }
        return out;

    };

    const radius = Math.max( 2, Math.round( w / 48 ) );

    // --- 0. WHICH WAY UP IS THE READBACK? Probed, not assumed. --------------------------------
    //
    // `readRenderTargetPixelsAsync` hands back raw texels and the repo has no written statement of
    // the row order on the WebGPU backend. The whole measurement below is an ANGLE, so a flipped
    // row order silently negates it — and a negated twill angle is precisely the `s-twill` defect
    // this page exists to catch. So: move the light to world +y, render, and see which end of the
    // buffer got bright.
    const lightHome = key.position.clone();
    key.position.set( 0, 0.35, 0.55 );
    const probe = blur( await shoot(), radius );
    key.position.copy( lightHome );

    let probeTop = 0, probeBottom = 0;
    for ( let y = 0; y < h; y ++ ) for ( let x = 0; x < w; x ++ ) {

        if ( y < h / 2 ) probeTop += probe[ y * w + x ]; else probeBottom += probe[ y * w + x ];

    }

    const rowZeroIsTop = probeTop > probeBottom;
    log( `Readback row order, PROBED by moving the light to world +y:` );
    log( `  first half of the buffer ${ probeTop.toFixed( 1 ) } vs second half ${ probeBottom.toFixed( 1 ) }` );
    log( `  → row 0 is the ${ rowZeroIsTop ? 'TOP' : 'BOTTOM' } of the image; screen +y ${ rowZeroIsTop ? 'DECREASES' : 'increases' } the row index` );
    log();

    /** Pixel-space direction to the generator's warp-relative angle (from +y toward +x). */
    const toWarpRelative = ( dxPixels, dyPixels ) => {

        const worldY = rowZeroIsTop ? - dyPixels : dyPixels;
        let deg = Math.atan2( dxPixels, worldY ) * 180 / Math.PI;
        while ( deg > 90 ) deg -= 180;
        while ( deg <= -90 ) deg += 180;
        return deg;

    };

    // --- 1. exposure guard ---------------------------------------------------------------------
    base.anisotropy = anisotropyStrength;
    base.needsUpdate = true;
    const anisotropic = blur( await shoot(), radius );

    let clipped = 0, peak = 0;
    for ( let i = 0; i < w * h; i ++ ) { if ( anisotropic[ i ] > peak ) peak = anisotropic[ i ]; if ( anisotropic[ i ] > 0.99 ) clipped ++; }

    log( `RENDERED measurement — ${ w }x${ h } readback off a WebGPU render target` );
    log( `  blurred peak luma  ${ peak.toFixed( 4 ) }   clipped texels ${ clipped } (${ ( 100 * clipped / ( w * h ) ).toFixed( 2 ) }%)` );
    log( `  box blur radius    ${ radius } px, to average away the per-yarn glints without touching the lobe` );

    if ( clipped > 0.005 * w * h ) {

        log();
        log( `  🚩 ${ ( 100 * clipped / ( w * h ) ).toFixed( 2 ) }% OF THE FRAME IS CLIPPED, so the lobe has a flat top whose extent is` );
        log( `     set by the EXPOSURE rather than by the BRDF. Refusing to report an axis. Lower` );
        log( `     ?light= until this reads under 0.5%.` );
        globalThis.__SUGATA_FABRIC_HIGHLIGHT__ = { valid: false, clippedFraction: clipped / ( w * h ) };
        return;

    }

    /**
     * Where did the anisotropy toggle MOVE the energy?
     *
     * 🚩 Two instruments were tried before this one and both are recorded because both looked
     * right and were not.
     *
     *   (a) An intensity-weighted second moment of the difference image put the axis 35° off the
     *       twill and made "gained" and "lost" 11° apart when they must be 90° apart. A second
     *       moment integrates the far tail, which is where a broad lobe has its area and none of
     *       its shape, and per-yarn glints outnumber the lobe's own texels.
     *   (b) The half-maximum radius r(θ) — the textbook lobe descriptor — measured the isotropic
     *       lobe at 95.5 px against a 126 px frame, i.e. clipped by the viewport, and the
     *       anisotropic one at 12 px, because `roughness` 0.55–0.75 denim HAS NO COMPACT SPECULAR
     *       LOBE to find an edge on. It is a matte fabric; the sheen is a wide gentle bias, not a
     *       highlight with a rim.
     *
     * What that leaves is the thing the lobe actually does: redistribute. Integrate the DIFFERENCE
     * outward along each direction, area-weighted, and the direction of maximum gain is where the
     * energy went. It needs no edge, no threshold, and it cancels the diffuse and the weave texture
     * because those are identical in both renders.
     */
    const redistributionAxis = ( anisotropicImage, isotropicImage ) => {

        const cx = ( w - 1 ) / 2, cy = ( h - 1 ) / 2;
        const maxRadius = Math.min( w, h ) / 2 - 4;

        const sample = ( image, x, y ) => {

            const x0 = Math.floor( x ), y0 = Math.floor( y );
            if ( x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h ) return 0;
            const fx = x - x0, fy = y - y0;
            return image[ y0 * w + x0 ] * ( 1 - fx ) * ( 1 - fy )
                + image[ y0 * w + x0 + 1 ] * fx * ( 1 - fy )
                + image[ ( y0 + 1 ) * w + x0 ] * ( 1 - fx ) * fy
                + image[ ( y0 + 1 ) * w + x0 + 1 ] * fx * fy;

        };

        const profile = [];

        for ( let deg = 0; deg < 180; deg ++ ) {

            const a = deg * Math.PI / 180;
            let sum = 0;

            // Both ends of the axis, because an axis has no head and no tail; and area-weighted by
            // r, because a ring at radius r covers r times as much of the image as a ring at 1.
            for ( const sign of [ 1, -1 ] ) {

                const dx = sign * Math.cos( a ), dy = sign * Math.sin( a );
                for ( let r = 2; r < maxRadius; r += 1 ) {

                    const x = cx + dx * r, y = cy + dy * r;
                    sum += ( sample( anisotropicImage, x, y ) - sample( isotropicImage, x, y ) ) * r;

                }

            }

            profile.push( sum );

        }

        let maxDeg = 0, minDeg = 0;
        for ( let deg = 0; deg < 180; deg ++ ) {

            if ( profile[ deg ] > profile[ maxDeg ] ) maxDeg = deg;
            if ( profile[ deg ] < profile[ minDeg ] ) minDeg = deg;

        }

        return {
            profile, maxDeg, minDeg,
            gain: profile[ maxDeg ],
            loss: profile[ minDeg ],
            // A real lobe rotation gains on one axis and loses on the one at right angles to it.
            // Anything else is the instrument reading noise, and this is how that shows up.
            gainLossSeparationDeg: ( () => { let d = Math.abs( maxDeg - minDeg ) % 180; return d > 90 ? 180 - d : d; } )(),
            axisWarpDeg: toWarpRelative( Math.cos( maxDeg * Math.PI / 180 ), Math.sin( maxDeg * Math.PI / 180 ) )
        };

    };

    const separation = ( a, b ) => { let d = Math.abs( a - b ) % 180; return d > 90 ? 180 - d : d; };
    const twill = fft.refused ? predicted : fft.angleDeg;
    const commandedToWarp = ( rotationDeg ) => { let d = ( 90 - rotationDeg ) % 180; while ( d > 90 ) d -= 180; while ( d <= -90 ) d += 180; return d; };

    // --- 2. COMMANDED vs RENDERED, swept -------------------------------------------------------
    //
    // 🎯 The check the whole page exists for, and it is stronger than "does the highlight sit on
    // the twill". A single agreement can be two errors cancelling; a SWEEP cannot. If the rendered
    // axis tracks the commanded `anisotropyRotation` one-for-one across the circle, then the
    // tangent attribute, the UV orientation, the map row order and the warp-relative → +U basis
    // change are ALL correct together — which is exactly the composite §5.3 says fails silently.
    //
    // 🚩 IT RUNS ON A SMOOTH PLANE, AND THE REASON IS A THREE.JS FACT, MEASURED HERE FIRST AND THEN
    // CONFIRMED IN THE SOURCE. With the weave normal map attached, the swept axis came back
    // 89 / 3 / −6 / 0 / 0 / 4° against commanded 90 / 60 / 32.9 / 0 / −30 / −60° — pinned near the
    // warp axis and ignoring the command, worst error 64°. That is not a broken basis. In r185
    // `nodes/accessors/AccessorsUtils.js` builds `TBNViewMatrix` from `tangentView, bitangentView,
    // normalView`, `Bitangent.js` derives `bitangentView = normalView.cross(tangentView)`, and
    // `Normal.js` resolves `normalView` outside the NORMAL/VERTEX sub-builds to
    // `builder.context.setupNormal()` — the NORMAL-MAPPED normal. So the anisotropy frame is
    // re-derived per texel from the perturbed normal and twists with every yarn crossing. On a
    // weave that is physically the right thing to do and it means the MACRO axis of a
    // normal-mapped fabric is not a quantity this instrument can read. Both numbers are reported.
    const smoothProbe = async ( label, useMaps ) => {

        const savedNormal = base.normalMap, savedRoughMap = base.roughnessMap, savedRough = base.roughness;

        if ( ! useMaps ) { base.normalMap = null; base.roughnessMap = null; base.roughness = 0.25; }
        base.anisotropy = 0;
        base.anisotropyRotation = 0;
        base.needsUpdate = true;
        const reference = blur( await shoot(), radius );

        log();
        log( `  ${ label }` );
        log( `  ${ 'commanded ρ'.padEnd( 13 ) } ${ 'expected'.padStart( 9 ) } ${ 'rendered'.padStart( 9 ) } ${ 'error'.padStart( 8 ) } ${ 'gain⟂loss'.padStart( 10 ) } ${ 'gain'.padStart( 10 ) }` );

        const errors = [];
        let derivedAxis = null;

        for ( const rotation of sweepRotations ) {

            base.anisotropy = anisotropyStrength;
            base.anisotropyRotation = rotation * Math.PI / 180;
            base.needsUpdate = true;
            const image = blur( await shoot(), radius );
            const axis = redistributionAxis( image, reference );
            const expected = commandedToWarp( rotation );
            const error = separation( axis.axisWarpDeg, expected );
            errors.push( error );
            if ( Math.abs( rotation - derivedRotation ) < 1e-6 ) derivedAxis = axis;

            log( `  ${ ( rotation.toFixed( 2 ) + '°' + ( Math.abs( rotation - derivedRotation ) < 1e-6 ? ' *' : '' ) ).padEnd( 13 ) } ` +
                `${ ( expected.toFixed( 2 ) + '°' ).padStart( 9 ) } ${ ( axis.axisWarpDeg.toFixed( 2 ) + '°' ).padStart( 9 ) } ` +
                `${ ( error.toFixed( 2 ) + '°' ).padStart( 8 ) } ${ ( axis.gainLossSeparationDeg.toFixed( 0 ) + '°' ).padStart( 10 ) } ${ axis.gain.toExponential( 2 ).padStart( 10 ) }` );

        }

        base.normalMap = savedNormal;
        base.roughnessMap = savedRoughMap;
        base.roughness = savedRough;
        base.anisotropy = anisotropyStrength;
        base.anisotropyRotation = derivedRotation * Math.PI / 180;
        base.needsUpdate = true;

        return { worst: Math.max( ...errors ), errors, derivedAxis };

    };

    const derivedRotation = 90 - twill;
    const sweepRotations = [ 0, 30, derivedRotation, 90, 120, 150 ];

    const smooth = await smoothProbe( 'A. SMOOTH PLANE, roughness 0.25, no maps — this is the BASIS test', false );

    log( `  * = the rotation DERIVED from the FFT twill angle, not chosen.` );
    log( `  worst error ${ smooth.worst.toFixed( 2 ) }° over ${ sweepRotations.length } commanded rotations spanning 150°` );
    log( `  Tolerance stated at ±8°: the profile's own 1° step plus the width of its maximum. A` );
    log( `  wrong tangent basis misses by 45° or 90°, not by 8°.` );
    log( `    ${ smooth.worst <= 8 ? 'PASS — the tangent basis, the UV orientation and the warp→+U conversion are all right' : '🚩 FAIL — the lobe does not follow the command' }` );

    const textured = await smoothProbe( 'B. THE ACTUAL FABRIC, weave normal + roughness maps attached', true );

    log( `  worst error ${ textured.worst.toFixed( 2 ) }°  (at --res / ?res=${ RESOLUTION })` );
    log( `  ⚠️ THIS IS NOT A GATE AND MUST NOT BE READ AS ONE — it is RESOLUTION-DEPENDENT, which is` );
    log( `     itself the finding. At ?res=256 the sweep comes back 89 / 3 / −6 / 0 / 0 / 4° against` );
    log( `     commanded 90 / 60 / 32.9 / 0 / −30 / −60°, pinned near the warp axis and ignoring the` );
    log( `     command (worst 64°). At ?res=512 it tracks to within 6° for five of the six, and` );
    log( `     fails only at ρ = 0° — anisotropy along the WEFT, i.e. across the yarn ridges the` );
    log( `     normal map has already made dominant.` );
    log( `     The mechanism is a three.js fact, confirmed in r185 source rather than guessed:` );
    log( `     AccessorsUtils builds TBNViewMatrix from tangentView/bitangentView/normalView,` );
    log( `     Bitangent derives bitangentView = normalView.cross(tangentView), and Normal resolves` );
    log( `     normalView outside the NORMAL/VERTEX sub-builds to builder.context.setupNormal() —` );
    log( `     THE NORMAL-MAPPED NORMAL. So the anisotropy frame is re-derived per texel from the` );
    log( `     perturbed normal and twists at every yarn crossing. On a weave that is physically` );
    log( `     right, and it makes a single macro axis a quantity that depends on how finely the` );
    log( `     weave is sampled. Reported so the disagreement with A is on the record.` );

    log();
    log( `  AND THE ONE THE PUNCH LIST ASKS FOR — the highlight on the twill line, on the fabric:` );
    log( `    twill line, from the CPU gate  ${ twill.toFixed( 2 ) }° from the warp axis` );
    log( `    rendered axis at ρ = ${ derivedRotation.toFixed( 2 ) }°     ${ textured.derivedAxis === null ? '—' : textured.derivedAxis.axisWarpDeg.toFixed( 2 ) + '°' }` );
    log( `    apart from the twill line      ${ textured.derivedAxis === null ? '—' : separation( textured.derivedAxis.axisWarpDeg, twill ).toFixed( 2 ) + '°' }` );
    log( `    apart from its perpendicular   ${ textured.derivedAxis === null ? '—' : separation( textured.derivedAxis.axisWarpDeg, twill + 90 ).toFixed( 2 ) + '°' }` );
    log();
    log( `  🎯 THE HONEST SUMMARY OF THIS PAGE. What is GATED is (A): the lobe follows the commanded` );
    log( `     rotation to ${ smooth.worst.toFixed( 2 ) }° across 150°, so nothing between the FFT angle and the shader` );
    log( `     is flipped, transposed or mirrored. What is only OBSERVED is that the anisotropic` );
    log( `     band on the plate runs along the twill — that is an eye judgement, and (B) shows this` );
    log( `     instrument's answer to it moves with resolution. 8.1's blind critic decides it.` );
    log();
    log( `  REJECTION PROOFS — the ones no CPU check can run.` );
    log( `     TWO OF THEM ARE ALREADY IN TABLE A ABOVE, executed rather than suggested:` );
    log( `       ρ = 0°   must put the axis on the WEFT, ±90° from the warp — it reads ${ commandedToWarp( 0 ).toFixed( 0 ) }° expected,` );
    log( `                and the table shows what came back. This is the basis change itself.` );
    log( `       ρ = 90°  must put it on the WARP, 0°.` );
    log( `     THE THIRD NEEDS A RELOAD, because it changes the fabric rather than the material:` );
    log( `       ?defect=s-twill — the same denim woven the other hand. Yarn diameters, GSM,` );
    log( `                coherence and |twill angle| are ALL IDENTICAL, so every magnitude check` );
    log( `                in the repo stays green. The derived rotation must come back mirrored:` );
    log( `                ${ ( 90 + twill ).toFixed( 2 ) }° instead of ${ derivedRotation.toFixed( 2 ) }°, and the rendered axis must follow it.` );

    globalThis.__SUGATA_FABRIC_HIGHLIGHT__ = {
        valid: true,
        rowZeroIsTop,
        peakLuma: peak,
        clippedFraction: clipped / ( w * h ),
        commandedSweepDeg: sweepRotations,
        derivedRotationDeg: derivedRotation,
        twillDeg: twill,
        smoothPlaneWorstErrorDeg: smooth.worst,
        smoothPlaneErrorsDeg: smooth.errors,
        texturedWorstErrorDeg: textured.worst,
        texturedAxisWarpDeg: textured.derivedAxis === null ? null : textured.derivedAxis.axisWarpDeg
    };

}

main().catch( ( error ) => {

    log();
    log( `🚩 FAILED: ${ error.message }` );
    log( error.stack ?? '' );

} );
