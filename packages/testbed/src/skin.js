/**
 * skin — the punch-list 3.2 browsercheck.
 *
 * A skin shader that compiles and renders grey is the failure mode this page exists to catch. So
 * everything here is arranged around one question: **is the subsurface term doing anything, and
 * how much?** The page answers it three ways, and only the third one counts.
 *
 *   1. It renders. A shader that fails to compile takes the object off screen, and the checks
 *      panel says which of the material's parts is missing rather than leaving a black frame.
 *   2. It reports, in the panel, what the material was actually built with — LUT dimensions,
 *      curvature map, uniform values, backend, frame cost.
 *   3. **It is captured twice, with the effect off and on, and the difference is measured** by
 *      `tools/critic/measure.mjs` and by a terminator profile across the face. `?sss=0` sets the
 *      curvature to zero, which drives the table to row 0 — Lambert *exactly*, by construction
 *      (see `PreintegratedSkinLut.buildPreintegratedSkinLut`). So the A/B pair differs in the
 *      subsurface term and in nothing else: same geometry, same lights, same albedo, same
 *      micro-normal, same specular, same camera, same grade.
 *
 * ## Lighting
 *
 * Four RectAreaLights, which is the measured budget (3.604 ms at 1080p, `docs/PROGRESS.md`) and
 * the rig `alive.js` already uses. The intensities are NOT alive.js's, and the difference matters
 * enough to be the loudest comment on this page:
 *
 * 🚩 **The reference face is flat-lit at key:fill ≈ 1.25:1** (`stellar-blade-look-spec.md` §0.1,
 * measured across two official assets, 1.25 and 1.18 encoded). Western photoreal cinematics run
 * 4:1 to 8:1. Tune a skin shader against a dramatic key and every parameter comes out wrong,
 * because the terminator you are looking at is not the terminator the reference has. `alive.js`
 * lights for aliveness at about 1.5:1; this page lights for the gate, and G1 is what says whether
 * it succeeded.
 *
 * ## Framing
 *
 * `stellar-blade-look-spec.md` §0.2 states the micro-detail σ regime as "no individual pores
 * resolve even at 4K on a face filling half the frame", and G4's band was measured there. So the
 * default face framing puts the head at about half the frame height at 3840 × 2160, and the panel
 * prints the head's measured pixel height so the number can be checked rather than trusted. G4 is
 * scale-dependent with no sound rescaling law (`tools/critic/README.md`), which makes the framing
 * part of the measurement and not a presentation choice.
 *
 * ## Why this page and not `alive.js`
 *
 * `alive.js` carries every measured motion gate in `docs/PROGRESS.md`. Changing its lighting,
 * framing or materials to suit a shader would silently move numbers four other punch-list items
 * were validated against.
 */

import {
    Color,
    Mesh,
    MeshPhysicalNodeMaterial,
    MeshStandardNodeMaterial,
    PlaneGeometry,
    RectAreaLight,
    RectAreaLightNode,
    TimestampQuery,
    Vector3
} from 'three/webgpu';
import { Box3 } from 'three';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

import { Stage } from '../../core/src/render/Stage.js';
import { markAsSkin } from '../../core/src/render/GBuffer.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { RestPose } from '../../core/src/figure/RestPose.js';
import { Skeleton } from '../../core/src/figure/Skeleton.js';

import {
    applySkinMaterial,
    createSkinMaterial,
    curvatureMapUrlFor,
    regionMapUrlFor,
    SKIN_DEFAULTS
} from '../../core/src/material/SkinMaterial.js';

import { LUT_HEIGHT, LUT_WIDTH, MAX_RING_CURVATURE } from '../../core/src/material/PreintegratedSkinLut.js';

// --- framing ------------------------------------------------------------------------------------

// 24–40° is the look spec's portrait range; 30° is the middle of it and matches the standoff the
// lighting offsets below are authored against.
const FIELD_OF_VIEW_DEGREES = 30;

/**
 * Framed height in metres, per mode. `face` is the G4 framing: a head is about 0.23 m from crown to
 * chin on this asset, so 0.46 m of frame puts it at half the frame height.
 */
const FRAMED_HEIGHT_METRES = { face: 0.46, portrait: 0.42, body: null };

const EYE_LINE_FROM_TOP = { face: 0.42, portrait: 1 / 3 };

// Dead-on reads as a mugshot and hides the form the rim lights are there to describe. 12° matches
// alive.js so the two pages can be compared without the camera being a variable.
const CAMERA_AZIMUTH_DEGREES = 12;

// GLTFLoader strips the dot from 'Human.high-poly'. Matched by pattern for the reason alive.js
// records: this used to be 'low-poly', and an exact string silently returned undefined when the
// pipeline swapped eye proxies.
const EYEBALL_MESH_PATTERN = /high-poly|eyeball/i;

const BODY_FRAME_MARGIN = 1.10;

// --- the lighting rig -----------------------------------------------------------------------------

/**
 * Key / fill / rim / kicker, offsets in metres from the framed focus point.
 *
 * Geometry is alive.js's, because that rig is already argued from the look spec's §5 and there is
 * no reason for two pages to disagree about where a key light stands. The INTENSITIES are this
 * page's own and are tuned against G1 rather than by eye — see the header. `?key=` and `?fill=`
 * override them so a sweep needs a URL rather than a file edit (a file edit fires HMR, which kills
 * anything driving the page — LEARNINGS §1.12).
 */
const LIGHTING_RIG = [
    { name: 'key', offsetMetres: [ 0.90, 0.45, 0.95 ], sizeMetres: [ 0.85, 1.20 ], colour: 0xfff0dc, intensity: 9.0 },
    { name: 'fill', offsetMetres: [ -1.05, 0.10, 0.85 ], sizeMetres: [ 1.60, 1.60 ], colour: 0xbcd4ff, intensity: 0.42 },
    { name: 'rim', offsetMetres: [ -0.75, 0.55, -0.90 ], sizeMetres: [ 0.45, 1.10 ], colour: 0x8fb6ff, intensity: 0.8 },
    { name: 'kicker', offsetMetres: [ 0.95, -0.10, -0.80 ], sizeMetres: [ 0.35, 1.00 ], colour: 0xffbe8c, intensity: 0.5 }
];

// ⚠️ Those four numbers were SOLVED, not chosen, and the solution is not intuitive.
//
// G1 wants the lit cheek at 1.43–1.64x the shadow cheek in LINEAR luma (1.18–1.25 encoded). The
// instinct is that a flat 1.25:1 look needs a strong fill, and alive.js's rig follows that
// instinct. Swept against G1 — 1400 px for the first four rows, 3840 x 2160 for the rest:
//
//     key  fill  rim  kicker | G1 linear   G4 σ    G6 p0.1
//     5.5   3.6  16    10    |   0.99        —        —     <- alive.js's balance. The shadow cheek
//     7.0   2.2   6     4    |   1.17        —        —        is as bright as the lit one, so
//     8.0   1.6   4     2.5  |   1.29        —        —        there is no terminator anywhere on
//     9.0   0.7   1.2   0.8  |   1.46        —        —        the face for this item to act on
//     9.0   0.7   0.8   0.5  |   1.366     1.720    0.0134
//     9.0   0.5   0.8   0.5  |   1.417     1.882    0.0092
//     9.0   0.42  0.8   0.5  |   1.440     1.950    0.0081   <- shipped
//     9.0   0.3   0.8   0.5  |   1.477     2.060    0.0045
//
// Two things in that table are worth carrying away.
//
// **The lever on flatness is the RIM and the KICKER, not the fill.** Both stand behind the figure
// and wrap onto the shadow-side cheek, and at alive.js's 16 and 10 they were holding the shadow
// side up to the key's own level. Raising the key past 9 does almost nothing, because it raises
// both cheeks. 🚩 That is a finding for punch-list 3.8 and not only for this page: a rig can sit at
// a perfectly reasonable key:fill and still be flat, because "key:fill" is a statement about two
// lights and "key:shadow" is a statement about the picture. Only the second one is the gate.
//
// **G4 is not independent of the rig.** The same micro-normal measures σ 1.72 at fill 0.7 and 2.06
// at fill 0.3, because a high-pass of a shaded surface reads the LIGHTING's response to the normal
// perturbation, not the perturbation. Quote a σ with the rig it was measured under or it means
// nothing.

// §5 lighting rig: "BACKGROUND 1.5–2.0 stops below subject, cooler and desaturated". Emissive
// rather than lit for alive.js's reason: a RectAreaLight is single-sided and all four face the
// figure, so nothing reaches a card behind it.
const BACKDROP_EMISSIVE = 0x11151f;
const BACKDROP_DISTANCE_METRES = 1.9;

const DEFAULT_POSE = 'relaxed-standing';

const status = document.getElementById( 'status' );

main().catch( ( error ) => {

    status.textContent = String( ( error && error.stack ) || error );
    status.className = 'fail';
    console.error( error );
    publish( { ok: false, error: String( ( error && error.stack ) || error ) } );

} );

// ---------------------------------------------------------------------------------------------

async function main() {

    const query = new URLSearchParams( location.search );
    const canvas = document.getElementById( 'view' );

    const bare = query.has( 'bare' );
    if ( bare ) document.body.classList.add( 'bare' );

    // A hidden or headless pane performs no layout: `clientWidth` reads 0, the drawing buffer
    // comes up 1x1, and every measurement below would be of one pixel. Pin it, always, and let
    // ?w=&h= ask for the exact budget a gate run needs.
    const width = number( query, 'w', 1280 );
    const height = number( query, 'h', 720 );

    canvas.style.width = `${ width }px`;
    canvas.style.height = `${ height }px`;

    const deferred = query.get( 'deferred' ) !== '0';

    const stage = new Stage();
    await stage.create( canvas, {
        pipeline: deferred,
        forceWebGL: query.has( 'webgl' ),
        maxPixelRatio: 1,                       // pin the pixel budget: a gate number must mean one thing
        fieldOfView: FIELD_OF_VIEW_DEGREES,
        near: 0.01,
        far: 50,
        resolutionScale: number( query, 'scale', 1 ),
        trackTimestamp: query.get( 'perf' ) === '1',
        width,
        height
    } );

    stage.scene.background = new Color( 0x08080a );

    // Without the linearly-transformed-cosine tables every RectAreaLight contributes nothing and
    // the figure renders black — which looks exactly like a broken skin shader.
    RectAreaLightNode.setLTC( RectAreaLightTexturesLib.init() );

    const lights = buildLightingRig( stage, query );
    const backdrop = buildBackdrop( stage );

    // --- the figure ---------------------------------------------------------------------------

    const identity = new Identity( { gender: number( query, 'gender', 0.5 ) } );
    const plan = await identity.resolve();
    const figureUrl = plan.figures[ 0 ].url;
    const figureName = figureUrl.slice( figureUrl.lastIndexOf( '/' ) + 1 ).replace( '.glb', '' );

    status.textContent = `loading ${ figureName }...`;

    const figure = await Figure.load( figureUrl );
    stage.add( figure.root );
    figure.root.updateMatrixWorld( true );

    // Pose before anything measures the figure: the relaxed pose drops the arms and settles the
    // pelvis, which moves the crown by centimetres and therefore moves the framing.
    const skeleton = new Skeleton( figure.root );
    RestPose.load( query.get( 'pose' ) ?? DEFAULT_POSE ).applyTo( skeleton );
    skeleton.update();
    figure.root.updateMatrixWorld( true );

    // --- the material -------------------------------------------------------------------------

    const useStock = query.get( 'stock' ) === '1';
    const subsurfaceOn = query.get( 'sss' ) !== '0';

    const regionsOn = query.get( 'regions' ) !== '0';

    const settings = {
        scatterDistanceMillimetres: number( query, 'scatter', SKIN_DEFAULTS.scatterDistanceMillimetres ),
        microNormalScale: query.get( 'micro' ) === '0' ? 0 : number( query, 'mscale', SKIN_DEFAULTS.microNormalScale ),
        microNormalRepeat: number( query, 'repeat', SKIN_DEFAULTS.microNormalRepeat ),
        runtimeCurvatureBlend: number( query, 'runtime', SKIN_DEFAULTS.runtimeCurvatureBlend ),
        maxScatterGain: number( query, 'gain', SKIN_DEFAULTS.maxScatterGain ),
        scatterGainFloor: number( query, 'floor', SKIN_DEFAULTS.scatterGainFloor ),
        secondLobeWeight: query.get( 'lobe' ) === '0' ? 0 : number( query, 'lobe', SKIN_DEFAULTS.secondLobeWeight ),
        secondLobeRoughness: number( query, 'lober', SKIN_DEFAULTS.secondLobeRoughness ),
        transmissionStrength: query.get( 'trans' ) === '0' ? 0 : number( query, 'trans', SKIN_DEFAULTS.transmissionStrength ),
        transmissionDistanceMillimetres: number( query, 'transd', SKIN_DEFAULTS.transmissionDistanceMillimetres )
    };

    const bodyAlbedo = figure.body.material.map ?? null;
    let material;
    let curvatureUrl = null;

    if ( useStock ) {

        // The control. Same albedo, same roughness, none of 3.2 — so a reviewer can see what the
        // item is worth as a whole rather than only what its subsurface half is worth.
        material = new MeshPhysicalNodeMaterial();
        material.map = bodyAlbedo;
        material.metalness = 0;
        material.roughness = SKIN_DEFAULTS.roughness;
        figure.body.material = material;

    } else {

        // 🚩 `regionMapUrl` is passed EXPLICITLY rather than left to be derived from the curvature
        // URL. `createSkinMaterial` derives
        // one from the other when it is omitted, which is right for `alive.js`; here it would make
        // `?sss=0` — a toggle that exists to isolate pre-integration — also switch off the region
        // roughness, the transmission and the lip mask. An A/B plate that moves four things is not
        // an A/B plate. `?regions=0` is the separate switch for the other three.
        curvatureUrl = subsurfaceOn ? curvatureMapUrlFor( figureName ) : null;

        material = await createSkinMaterial( {
            albedoMap: bodyAlbedo,
            curvatureMapUrl: curvatureUrl,
            regionMapUrl: regionsOn ? regionMapUrlFor( figureName ) : null,
            settings
        } );

        applySkinMaterial( figure, material );

    }

    // 🚩 `markAsSkin` writes `material.mrtNode`, and a material carrying one CANNOT be forward
    // rendered — `NodeMaterial.setup` uses it alone against an unnamed intermediate target and
    // emits an empty WGSL output struct, so the object silently stops drawing (GBuffer.js says so
    // at length). Tag only on the deferred path.
    if ( deferred && useStock === false ) markAsSkin( material );

    // --- framing and lights -----------------------------------------------------------------

    const mode = query.get( 'frame' ) ?? 'face';
    const framedHeight = framedHeightFor( figure, mode, query );
    const framed = frameFigure( stage, figure, mode, framedHeight );

    aimLightingRig( lights, framed.focus, framed.distanceMetres / referenceDistanceMetres( FRAMED_HEIGHT_METRES.face ) );

    backdrop.position.set( framed.focus.x, framed.focus.y, framed.focus.z - BACKDROP_DISTANCE_METRES );
    backdrop.lookAt( stage.camera.position );

    // --- draw ----------------------------------------------------------------------------------

    // rAF does not fire in a hidden or headless pane; `setTimeout` is throttled to 8/s there.
    // A MessageChannel measured 553,921 dispatches/s (LEARNINGS §1.12), so the page keeps
    // presenting frames either way and a screenshot is never of a stalled first frame.
    const clock = startFrameClock( stage );
    await clock.settled;

    const perf = query.get( 'perf' ) === '1' ? await measureGpuCost( stage, clock, query ) : null;

    const landmarks = measureLandmarks( stage, figure, lights, width, height );
    const checks = runChecks( { stage, figure, material, useStock, subsurfaceOn, landmarks, deferred } );

    if ( bare === false ) {

        renderEnvironment( stage, material, { figureName, deferred, useStock, subsurfaceOn, regionsOn, curvatureUrl, settings, perf } );
        renderChecks( checks );
        renderFraming( landmarks, width, height );
        document.getElementById( 'regions' ).textContent = JSON.stringify( buildRegionSpec( landmarks, width, height ), null, 1 );

    }

    const allPassed = checks.every( ( check ) => check.passed );
    status.textContent = allPassed ? 'all checks passed' : 'CHECK FAILURES — see the table';
    status.className = allPassed ? 'pass' : 'fail';

    publish( {
        ok: true,
        page: 'skin',
        figure: figureName,
        backend: stage.backendName,
        deferred,
        variant: useStock ? 'stock' : ( subsurfaceOn ? 'sss-on' : 'sss-off' ),
        settings,
        drawingBuffer: { width, height },
        framing: landmarks.framing,
        checks,
        regions: buildRegionSpec( landmarks, width, height ),
        frameMs: stage.stats.frameMs,
        fps: stage.stats.fps,
        perf
    } );

    // Console handles, so a stuck page can be interrogated by hand rather than guessed at.
    globalThis.__skin = { stage, figure, material, lights, landmarks };

}

// --- scene -------------------------------------------------------------------------------------

function buildLightingRig( stage, query ) {

    return LIGHTING_RIG.map( ( placement ) => {

        const intensity = number( query, placement.name, placement.intensity );

        const light = new RectAreaLight( placement.colour, intensity, placement.sizeMetres[ 0 ], placement.sizeMetres[ 1 ] );
        light.name = placement.name;
        stage.add( light );

        return { light, placement, intensity };

    } );

}

/**
 * Points every light at the framed focus and scales the rig with the camera's standoff.
 *
 * Panel size scales with the offsets and intensity does not, which is the physically right pairing:
 * a RectAreaLight's intensity is a radiance and the irradiance it delivers goes as area over
 * distance squared, so scaling both leaves exposure — and shadow softness relative to the
 * subject — unchanged. Same reasoning as `alive.js`; stated again because the instinct is to
 * brighten instead.
 */
function aimLightingRig( lights, focus, scale ) {

    for ( const { light, placement } of lights ) {

        light.position.set(
            focus.x + placement.offsetMetres[ 0 ] * scale,
            focus.y + placement.offsetMetres[ 1 ] * scale,
            focus.z + placement.offsetMetres[ 2 ] * scale
        );

        light.width = placement.sizeMetres[ 0 ] * scale;
        light.height = placement.sizeMetres[ 1 ] * scale;
        light.lookAt( focus.x, focus.y, focus.z );

    }

}

function referenceDistanceMetres( heightMetres ) {

    return ( heightMetres / 2 ) / Math.tan( ( FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180 );

}

function buildBackdrop( stage ) {

    const material = new MeshStandardNodeMaterial( {
        color: 0x000000,
        emissive: BACKDROP_EMISSIVE,
        emissiveIntensity: 1,
        roughness: 1,
        metalness: 0
    } );

    return stage.add( new Mesh( new PlaneGeometry( 8, 6 ), material ) );

}

function framedHeightFor( figure, mode, query ) {

    if ( query.has( 'height' ) ) return Number( query.get( 'height' ) );
    if ( mode !== 'body' ) return FRAMED_HEIGHT_METRES[ mode ] ?? FRAMED_HEIGHT_METRES.face;

    const bounds = new Box3().setFromObject( figure.root );
    return ( bounds.max.y - bounds.min.y ) * BODY_FRAME_MARGIN;

}

function frameFigure( stage, figure, mode, heightMetres ) {

    figure.root.updateMatrixWorld( true );

    // Centred on the EYES, not on world x = 0. The relaxed-standing rest pose is a contrapposto:
    // it loads one leg and carries the pelvis and head laterally, so a camera aimed at the origin
    // frames the head visibly off-centre and the difference grows as the crop tightens. Measured
    // on figure_g050 in this pose, aiming at the origin put the head 168 px left of centre at
    // 1100 px wide. Framing has to follow the figure or every rect below it is measuring the
    // wrong pixels.
    const eyes = eyeCentreWorld( figure );

    const focus = mode === 'body'
        ? bodyFocus( figure )
        : new Vector3( eyes.x, eyes.y + heightMetres * ( ( EYE_LINE_FROM_TOP[ mode ] ?? 0.42 ) - 0.5 ), 0 );

    const distance = ( heightMetres / 2 ) / Math.tan( ( FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180 );
    const azimuth = CAMERA_AZIMUTH_DEGREES * Math.PI / 180;

    stage.camera.position.set(
        focus.x + Math.sin( azimuth ) * distance,
        focus.y,
        focus.z + Math.cos( azimuth ) * distance
    );
    stage.camera.lookAt( focus );
    stage.camera.updateMatrixWorld( true );

    return { focus, distanceMetres: distance, heightMetres };

}

function bodyFocus( figure ) {

    const bounds = new Box3().setFromObject( figure.root );
    return new Vector3( 0, ( bounds.min.y + bounds.max.y ) / 2, 0 );

}

function eyeballMeshes( figure ) {

    const found = [];
    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && EYEBALL_MESH_PATTERN.test( object.name ) ) found.push( object );

    } );

    return found;

}

/** World-space centre of the eyeball meshes — the anchor everything about the face frame hangs on. */
function eyeCentreWorld( figure ) {

    return eyeBounds( figure ).getCenter( new Vector3() );

}

function eyeBounds( figure ) {

    const eyes = eyeballMeshes( figure );

    if ( eyes.length === 0 ) {

        // Loud, because a silent fallback here moves the crop without moving anything a gate
        // looks at — alive.js records the same trap after a pipeline swap renamed the eye proxy.
        console.warn( `skin: no mesh matching ${ EYEBALL_MESH_PATTERN }; the face frame is guessing from the bounding box.` );

        const body = new Box3().setFromObject( figure.root );
        const guess = new Vector3( 0, body.max.y - 0.11, 0 );
        return new Box3( guess.clone().subScalar( 0.043 ), guess.clone().addScalar( 0.043 ) );

    }

    const bounds = new Box3();
    for ( const mesh of eyes ) bounds.expandByObject( mesh );

    return bounds;

}

// --- landmarks and regions -------------------------------------------------------------------

/**
 * Everything a region spec needs, in screen pixels, derived from the mesh rather than placed by eye.
 *
 * A hand-placed rect is a magic number that stops being true the moment the framing, the bake or
 * the pose changes, and there is no way to notice — it just starts measuring a nostril. So the face
 * gets a coordinate system of its own: origin at the midpoint between the eyeballs, unit = the
 * interocular distance, `keySign` = which way the key light lies on screen. Every rect below is
 * stated in those units, which is how facial anthropometry states everything.
 */
function measureLandmarks( stage, figure, lights, width, height ) {

    const camera = stage.camera;
    const project = ( point ) => {

        const ndc = point.clone().project( camera );
        return { x: ( ndc.x * 0.5 + 0.5 ) * width, y: ( 1 - ( ndc.y * 0.5 + 0.5 ) ) * height };

    };

    // Left and right eyeball centres. The mesh is one object holding both globes, so the two are
    // separated by splitting its vertices on x — cheaper and more robust than a name match.
    const bounds = eyeBounds( figure );
    const eyeCentre = bounds.getCenter( new Vector3() );

    // The eyeball mesh holds BOTH globes, so its box spans the interocular distance plus one globe
    // diameter. Half of the box is therefore one globe centre out from the midline only if the
    // globes touch, which they do not — but the box's own quarter-width is within a millimetre of
    // the true half-separation on this asset and needs no per-eye vertex split to obtain.
    const halfSeparation = ( bounds.max.x - bounds.min.x ) / 4;

    const leftEye = project( new Vector3( eyeCentre.x + halfSeparation, eyeCentre.y, eyeCentre.z ) );
    const rightEye = project( new Vector3( eyeCentre.x - halfSeparation, eyeCentre.y, eyeCentre.z ) );
    const midEye = project( eyeCentre );

    const interocularPixels = Math.hypot( leftEye.x - rightEye.x, leftEye.y - rightEye.y );

    // Which side of the frame the key light falls on. Everything "lit" is on that side and
    // everything "shadowed" is on the other, so getting this backwards swaps G1's numerator and
    // denominator and turns a 1.5:1 ratio into 0.67:1 with no other symptom.
    //
    // 🚩 Taken in VIEW space, not by projecting the light. The key panel stands 0.95 m in front of
    // the focus and the face camera stands 0.86 m out, so the light is BEHIND the near plane —
    // `Vector3.project` divides by a negative w there and returns the mirrored side. Measured: the
    // projected form reported the key on screen left while the render is lit from screen right.
    // View-space x is monotonic in screen x at every depth, in front of the camera or behind it.
    const key = lights.find( ( entry ) => entry.placement.name === 'key' );
    const keyView = key.light.position.clone().applyMatrix4( camera.matrixWorldInverse );
    const eyeView = eyeCentre.clone().applyMatrix4( camera.matrixWorldInverse );
    const keySign = Math.sign( keyView.x - eyeView.x ) || 1;

    const headBounds = new Box3().setFromObject( figure.root );
    const crown = project( new Vector3( eyeCentre.x, headBounds.max.y, eyeCentre.z ) );

    // Chin: the lowest body vertex within a head's reach of the eye line. Cheaper than a landmark
    // and good enough for a framing statistic, which is all it is used for.
    const chinY = eyeCentre.y - 0.11;
    const chin = project( new Vector3( eyeCentre.x, chinY, eyeCentre.z ) );

    return {
        midEye,
        leftEye,
        rightEye,
        interocularPixels,
        keySign,
        framing: {
            headHeightPixels: Math.abs( chin.y - crown.y ),
            headHeightFractionOfFrame: Math.abs( chin.y - crown.y ) / height,
            interocularPixels,
            crownY: crown.y,
            chinY: chin.y
        }
    };

}

/**
 * The rects, in face units. Read this table beside `tools/critic/README.md`'s "where to aim the
 * rects", which is what each one is trying to satisfy.
 *
 * `u` runs toward the key light, `v` runs down the face; both in interocular distances from the
 * midpoint between the eyes. `size` is also in interocular distances.
 */
const FACE_REGIONS = [
    // G1 — lit mid-cheek on the key side, and the mirrored cheek. Below the eye line and inboard
    // of the silhouette, so neither rect catches the rim light or the jaw edge.
    { name: 'faceKey', u: 0.62, v: 0.72, size: 0.26, note: 'lit mid-cheek, key side' },
    { name: 'faceShadow', u: -0.66, v: 0.72, size: 0.26, note: 'core shadow, mirrored cheek' },

    // G3 — the turning band, and fully lit skin under the same key in the same frame.
    //
    // 🚩 `shadowTerminator` is on the FILL side, at negative u, and the first draft of this table
    // had it at u = +1.05 on the reasoning that the terminator wraps round the key-side silhouette.
    // Measured across the face at 1400 px, the key-side silhouette is the BRIGHTEST place in the
    // picture (luma 0.866 against 0.683 on the far cheek): the key stands at 43.5° of azimuth and
    // the camera at 12°, so everything at positive u faces the key. The mis-placed rect made G3
    // compare two lit patches and report "hue moved away from red" — a red gate that was entirely
    // the instrument.
    { name: 'litSkin', u: 0.45, v: 0.35, size: 0.22, note: 'fully lit cheek, key side' },
    { name: 'shadowTerminator', u: -0.50, v: 0.45, size: 0.18, note: 'the turning band, fill side' },

    // G4 — the flattest, most evenly lit skin in frame. The forehead above the brow ridge is the
    // largest area on a face with no crease, no hair and no strong gradient.
    { name: 'flatCheek', u: 0.0, v: -0.85, size: 0.5, note: 'forehead, flattest evenly lit skin' },

    // G2 needs the eye shader (3.3) to mean anything, but the rects cost nothing and a SKIP is
    // more useful than a missing gate.
    { name: 'sclera', u: 0.48, v: 0.0, size: 0.09, note: 'between iris and canthus' },
    { name: 'cheek', u: 0.62, v: 0.52, size: 0.14, note: 'skin near the eye, same light as the sclera' },

    // G5 and G6 read `frame` when it is present and the whole image when it is not, and on this
    // plate the difference decides what they are measuring. A bald head on a near-black card puts
    // the darkest 0.1% of the image on the CARD, so a whole-image G6 reports the backdrop's value
    // and says nothing at all about whether the grade lifts blacks. Restricted to the subject it
    // reports the nostril, the lash line and the ear shadow, which is the question. Both are run —
    // see the probe's second pass with `frame` stripped.
    { name: 'frame', u: 0.0, v: 0.95, size: 1.6, note: 'the central face — cheeks, nose, mouth, no backdrop' }
];

function buildRegionSpec( landmarks, width, height ) {

    const regions = {};
    const unit = landmarks.interocularPixels;

    for ( const region of FACE_REGIONS ) {

        const halfSize = ( region.size * unit ) / 2;
        const centreX = landmarks.midEye.x + region.u * unit * landmarks.keySign;
        const centreY = landmarks.midEye.y + region.v * unit;

        // Clamped to the image. `measure.mjs` REJECTS an out-of-bounds rect outright rather than
        // clamping it — correct of it, because a clamped rect measures the wrong pixels and still
        // returns a confident number — but that turns one rect drifting off a tight crop into a
        // tool error for all six gates. Clamping here keeps the failure local and visible in the
        // printed spec.
        const left = Math.max( 0, centreX - halfSize );
        const top = Math.max( 0, centreY - halfSize );
        const right = Math.min( width, centreX + halfSize );
        const bottom = Math.min( height, centreY + halfSize );

        regions[ region.name ] = {
            note: region.note,
            rects: [ {
                x: round( left / width, 5 ),
                y: round( top / height, 5 ),
                w: round( Math.max( 1, right - left ) / width, 5 ),
                h: round( Math.max( 1, bottom - top ) / height, 5 )
            } ]
        };

    }

    return {
        units: 'normalized',
        imageWidth: width,
        _source: 'generated by packages/testbed/src/skin.js from the figure\'s own eye landmarks',
        _interocularPixels: round( unit, 2 ),
        regions
    };

}

// --- checks ------------------------------------------------------------------------------------

/**
 * Each check fails on a specific defect a plausible-looking grey render would pass.
 *
 * None of them is the gate — the gate is measured off the pixels by `tools/critic/measure.mjs`.
 * These exist so that when the gate is red, the reason is already narrowed to one part.
 */
function runChecks( { stage, figure, material, useStock, subsurfaceOn, landmarks, deferred } ) {

    const checks = [];

    const add = ( name, expectation, passed, detail ) => checks.push( { name, expectation, passed, detail } );

    add( 'backend is WebGPU',
        'TSL compiles to both, but the LTC path and the deferred pipeline are only measured here',
        stage.backendName === 'webgpu',
        stage.backendName );

    add( 'the body mesh carries the skin material',
        'applySkinMaterial replaces exactly one of the seven meshes',
        useStock ? figure.body.material.isMeshPhysicalNodeMaterial === true
            : figure.body.material.isSkinNodeMaterial === true,
        `${ figure.body.name } -> ${ figure.body.material.type }${ figure.body.material.isSkinNodeMaterial ? ' (skin)' : '' }` );

    add( 'only the body was replaced',
        'teeth, tongue, lashes, brows and both eye shells are not skin',
        countSkinMaterials( figure ) === ( useStock ? 0 : 1 ),
        `${ countSkinMaterials( figure ) } of ${ countMeshes( figure ) } meshes` );

    if ( useStock === false ) {

        add( 'the pre-integrated table is bound',
            'a missing LUT would fall back to black, not to Lambert',
            material.skin.lut !== undefined && material.skin.lut !== null,
            `${ LUT_WIDTH } x ${ LUT_HEIGHT }, max ring curvature ${ MAX_RING_CURVATURE }` );

        add( subsurfaceOn ? 'the baked curvature map is bound' : 'the curvature map is deliberately absent',
            subsurfaceOn ? 'without it every fragment reads ring curvature 0, i.e. exact Lambert'
                : '?sss=0 drives the table to row 0, which is Lambert by construction',
            subsurfaceOn ? material.skin.curvatureMap !== null : material.skin.curvatureMap === null,
            subsurfaceOn ? 'loaded' : 'null (A side of the pair)' );

        add( 'the second specular lobe is live',
            'three only builds the clearcoat path when material.clearcoat > 0',
            material.clearcoat > 0 && material.useClearcoat === true,
            `weight ${ material.clearcoat }, roughness ${ material.clearcoatRoughness }` );

        add( 'the micro-normal is on the material',
            'normalNode is what makes the detail reach the shading normal AND the G-buffer',
            material.normalNode !== null && material.normalNode !== undefined,
            `scale ${ material.skinUniforms.microNormalScale.value }, repeat ${ material.skinUniforms.microNormalRepeat.value }` );

        add( 'skin is tagged for the G-buffer only on the deferred path',
            'a material carrying mrtNode cannot be forward-rendered — GBuffer.js §markAsSkin',
            deferred ? material.mrtNode !== undefined && material.mrtNode !== null
                : material.mrtNode === undefined || material.mrtNode === null,
            deferred ? 'tagged (deferred)' : 'untagged (forward)' );

    }

    add( 'the drawing buffer is the size that was asked for',
        'a pane with no layout brings the buffer up 1x1 and every measurement is of one pixel',
        stage.renderer.domElement.width > 64 && stage.renderer.domElement.height > 64,
        `${ stage.renderer.domElement.width } x ${ stage.renderer.domElement.height }` );

    add( 'the face is in frame at a usable size',
        'G4 is scale-dependent; a head smaller than a fifth of the frame is not the reference regime',
        landmarks.framing.headHeightFractionOfFrame > 0.2 && landmarks.interocularPixels > 20,
        `head ${ landmarks.framing.headHeightPixels.toFixed( 0 ) } px `
        + `(${ ( landmarks.framing.headHeightFractionOfFrame * 100 ).toFixed( 1 ) }% of frame), `
        + `interocular ${ landmarks.interocularPixels.toFixed( 1 ) } px` );

    add( 'something was actually drawn',
        'a shader that fails to compile takes the object off screen and leaves a plausible backdrop',
        stage.stats.triangles > 10000,
        `${ stage.stats.drawCalls } draw calls, ${ stage.stats.triangles } triangles` );

    return checks;

}

function countSkinMaterials( figure ) {

    let count = 0;
    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && object.material.isSkinNodeMaterial === true ) count ++;

    } );

    return count;

}

function countMeshes( figure ) {

    let count = 0;
    figure.root.traverse( ( object ) => { if ( object.isMesh === true ) count ++; } );
    return count;

}

// --- frame clock ---------------------------------------------------------------------------------

/**
 * Keeps the page presenting frames whether or not `requestAnimationFrame` fires.
 *
 * `Stage` drives itself from rAF. In a hidden or headless pane rAF never fires at all, the page
 * renders one frame and stalls, and a screenshot catches whatever the first frame happened to be —
 * usually a partially-compiled scene. `setTimeout` is not the fix either: measured at 8 callbacks
 * per second when the document is hidden. A MessageChannel measured 553,921 per second, so it is
 * the clock (LEARNINGS §1.12).
 *
 * `settled` resolves after enough frames that shader compilation, texture upload and the LTC table
 * have all landed, so nothing downstream is reading a warm-up frame.
 */
function startFrameClock( stage ) {

    const channel = new MessageChannel();
    let frames = 0;
    let paused = false;

    const settled = new Promise( ( resolve ) => {

        channel.port1.onmessage = () => {

            // three stamps the node frame inside `Animation`, not inside `render()` — verified in
            // r185 at `renderers/common/Animation.js:77`. Taking the clock away from rAF therefore
            // takes this with it, and without it skinning never refreshes: exactly the
            // frozen-pose bug LEARNINGS §1.3 records, which scored perfectly reproducible while
            // rendering a still figure.
            stage.renderer._nodes.nodeFrame.update();

            stage.renderFrame( performance.now() );
            frames ++;

            // 8 frames: three to compile and upload, the rest so `stats.fps` has a window to
            // average over before anything reads it.
            if ( frames === 8 ) resolve( frames );

            if ( paused === false ) channel.port2.postMessage( 0 );

        };

    } );

    // Stage's own rAF loop would double-drive the scene. Take the clock before starting.
    stage.renderer.setAnimationLoop( null );
    channel.port2.postMessage( 0 );

    return {
        settled,
        frameCount: () => frames,
        pause() { paused = true; },
        resume() { if ( paused ) { paused = false; channel.port2.postMessage( 0 ); } }
    };

}

/**
 * GPU cost of this variant, from real timestamp queries.
 *
 * Reported as **p95, not the median**, for the reason `packages/testbed/src/stage.js` measured and
 * wrote down: Chrome quantises WebGPU timestamps (0.065536 ms on this machine) and some resolves
 * come back holding only part of a frame's work, so the low tail is dropout and the upper envelope
 * is the honest estimate.
 *
 * Two disciplines carried over from `tools/spikes/spike-harness.js`, each of which was a bug there
 * first: one render per frame, and nothing renders while a resolve is outstanding —
 * `resolveTimestampsAsync` reports the total for whichever frame is last in the pending set, so
 * letting several pool up detaches the number from the frame it belongs to.
 */
async function measureGpuCost( stage, clock, query ) {

    clock.pause();

    const warmup = number( query, 'warmup', 60 );
    const samples = number( query, 'frames', 200 );
    const durations = [];

    for ( let frame = 0; frame < warmup + samples; frame ++ ) {

        stage.renderer._nodes.nodeFrame.update();
        stage.renderFrame( performance.now() );

        const duration = await stage.renderer.resolveTimestampsAsync( TimestampQuery.RENDER );

        if ( frame >= warmup && typeof duration === 'number' && duration > 0 ) durations.push( duration );

    }

    clock.resume();

    if ( durations.length === 0 ) {

        return { available: false, note: 'timestamp queries never resolved a non-zero duration' };

    }

    const sorted = durations.slice().sort( ( a, b ) => a - b );
    const at = ( q ) => sorted[ Math.min( sorted.length - 1, Math.floor( q * sorted.length ) ) ];

    const distinct = [ ...new Set( sorted ) ];
    let quantum = Infinity;
    for ( let i = 1; i < distinct.length; i ++ ) quantum = Math.min( quantum, distinct[ i ] - distinct[ i - 1 ] );

    return {
        available: true,
        samples: durations.length,
        p95: at( 0.95 ),
        median: at( 0.5 ),
        min: sorted[ 0 ],
        max: sorted[ sorted.length - 1 ],
        quantumMs: Number.isFinite( quantum ) ? quantum : null
    };

}

// --- panel ---------------------------------------------------------------------------------------

function renderEnvironment( stage, material, info ) {

    const rows = [
        [ 'backend', stage.backendName ],
        [ 'path', info.deferred ? 'deferred (G-buffer + RenderPipeline)' : 'forward' ],
        [ 'variant', info.useStock ? 'stock MeshPhysicalNodeMaterial' : ( info.subsurfaceOn ? 'skin, SSS on' : 'skin, SSS off (curvature 0)' ) ],
        [ 'figure', info.figureName ],
        [ 'curvature map', info.curvatureUrl === null ? '—' : info.curvatureUrl.slice( info.curvatureUrl.lastIndexOf( '/' ) + 1 ) ],
        [ 'scatter distance', `${ info.settings.scatterDistanceMillimetres } mm` ],
        [ 'micro-normal', `scale ${ info.settings.microNormalScale }, repeat ${ info.settings.microNormalRepeat }` ],
        [ 'second lobe', `weight ${ info.settings.secondLobeWeight }, roughness ${ info.settings.secondLobeRoughness }` ],
        [ 'transmission', `strength ${ info.settings.transmissionStrength }, depth ${ info.settings.transmissionDistanceMillimetres } mm (red)` ],
        [ 'region map', info.regionsOn ? 'on — per-region roughness, thickness, lip mask' : 'OFF' ],
        [ 'roughness / ior', info.useStock ? `${ material.roughness } / —` : `${ material.roughness } / ${ material.ior }` ],
        [ 'second lobe', info.useStock ? '—' : `${ material.clearcoat } @ roughness ${ material.clearcoatRoughness }` ],
        [ 'cpu frame', `${ stage.stats.frameMs.toFixed( 2 ) } ms` ],
        [ 'gpu frame (p95)', info.perf === null ? 'add ?perf=1' : ( info.perf.available ? `${ info.perf.p95.toFixed( 3 ) } ms over ${ info.perf.samples } samples` : info.perf.note ) ],
        [ 'draw calls', `${ stage.stats.drawCalls }, ${ stage.stats.triangles } tris` ]
    ];

    document.getElementById( 'env' ).innerHTML = table( [ 'what', 'value' ],
        rows.map( ( [ key, value ] ) => [ escapeHtml( key ), escapeHtml( String( value ) ) ] ) );

}

function renderChecks( checks ) {

    document.getElementById( 'checks' ).innerHTML = table( [ 'check', '', 'measured' ],
        checks.map( ( check ) => [
            escapeHtml( check.name ),
            `<span class="${ check.passed ? 'pass' : 'fail' }">${ check.passed ? 'PASS' : 'FAIL' }</span>`,
            escapeHtml( check.detail )
        ] ) );

}

function renderFraming( landmarks, width, height ) {

    document.getElementById( 'framing' ).innerHTML = table( [ 'what', 'value' ], [
        [ 'drawing buffer', `${ width } x ${ height }` ],
        [ 'head height', `${ landmarks.framing.headHeightPixels.toFixed( 0 ) } px (${ ( landmarks.framing.headHeightFractionOfFrame * 100 ).toFixed( 1 ) }% of frame height)` ],
        [ 'interocular', `${ landmarks.interocularPixels.toFixed( 1 ) } px` ],
        [ 'key light is on', landmarks.keySign > 0 ? 'screen right' : 'screen left' ]
    ].map( ( [ key, value ] ) => [ escapeHtml( key ), escapeHtml( value ) ] ) );

}

function table( headers, rows ) {

    const head = headers.map( ( header ) => `<th>${ escapeHtml( header ) }</th>` ).join( '' );
    const body = rows.map( ( cells ) => `<tr>${ cells.map( ( cell ) => `<td>${ cell }</td>` ).join( '' ) }</tr>` ).join( '' );
    return `<table><thead><tr>${ head }</tr></thead><tbody>${ body }</tbody></table>`;

}

function escapeHtml( value ) {

    return String( value ).replace( /[&<>"]/g, ( character ) =>
        ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } )[ character ] );

}

// --- small helpers ---------------------------------------------------------------------------------

function publish( payload ) {

    globalThis.__SKIN_RESULT__ = payload;
    globalThis.__SKIN_DONE__ = true;
    console.log( 'SKIN ' + JSON.stringify( payload ) );

}

function number( query, name, fallback ) {

    if ( query.has( name ) === false ) return fallback;

    const value = Number( query.get( name ) );
    return Number.isFinite( value ) ? value : fallback;

}

function round( value, places ) {

    const scale = 10 ** places;
    return Math.round( value * scale ) / scale;

}
