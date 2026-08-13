/**
 * Stage / G-buffer browsercheck — punch list 3.1.
 *
 * The point of this page is that a deferred pipeline which *compiles* is not a deferred pipeline
 * that *works*. Every claim 3.1 makes is checked here by execution, in two ways:
 *
 *   1. **By eye.** Each of the five MRT attachments can be put on screen full-size, and the grid
 *      view shows six panes at once. Motion vectors and depth are invisible without a display
 *      gain, so both carry one and it is on screen beside the image.
 *
 *   2. **By readback.** `readRenderTargetPixelsAsync` pulls the actual attachment contents back
 *      off the GPU and asserts predictions that a still frame, or an attachment nothing ever
 *      wrote, would fail. LEARNINGS 1.3: a metric a frozen image passes trivially is measuring
 *      nothing — so every velocity assertion is stated against a controlled *change* of scene
 *      state, and the frozen case is asserted to be zero rather than assumed.
 *
 * The scene is built to make each channel separately falsifiable:
 *
 *   - an **orbiting torus knot** moves rigidly, so velocity there comes from the model matrix;
 *   - a **skinned cylinder** bends, so velocity there comes from bone animation only;
 *   - a **morphing sphere** deforms with a static model matrix and no bones, which isolates the
 *     morph path — the one three.js does not write `positionPrevious` for;
 *   - a **skin-tagged sphere** carries `markAsSkin()`, so `sssMask` has exactly one region;
 *   - a **static backdrop** gives every channel a large region that must NOT move.
 *
 * Five distinct roughness values are assigned, because `normal.w` carries roughness and a
 * channel that reads back as one constant everywhere would otherwise look plausible.
 *
 * Query parameters:
 *   `perf=1`     run the GPU cost sweep on load
 *   `webgl=1`    force the WebGL2 fallback tier
 *   `forward=1`  bring the scene up on the old forward path — the control for attributing a
 *                renderer warning to the deferred path rather than to the scene
 *   `noskin=1`   drop the `markAsSkin` tag — the control for the `mrtNode` hazard in `GBuffer.js`
 *   `probe=0`    skip the readback probe and just leave the page running
 *   `only=a,b`   restrict the cost sweep to named variants
 *   `w=&h=`      pin the drawing buffer
 *   `passes`, `warmup`, `frames`, `repeats` tune the sweep as the Phase 0 spikes do
 *
 * ## And one arm that is not the G-buffer browsercheck at all
 *
 * `?hair=1` replaces the synthetic scene with the real groom and the four transparency arms of
 * punch-list 3.6. It lives on this page rather than on `src/hair.html` because two of those arms are
 * G-buffer attachments and one is a resolve pass, and `hair.html` is deliberately a bare
 * `WebGPURenderer` with no pass, no MRT and no temporal resolve — measuring OIT there would measure
 * a renderer this project does not ship. See `runHairArm` for its own parameter list.
 */

import {
    AmbientLight,
    Bone,
    Box3,
    BoxGeometry,
    Color,
    CylinderGeometry,
    DirectionalLight,
    Float32BufferAttribute,
    Mesh,
    MeshPhysicalNodeMaterial,
    PerspectiveCamera,
    RenderPipeline,
    Scene,
    Skeleton,
    SkinnedMesh,
    SphereGeometry,
    TimestampQuery,
    TorusKnotGeometry,
    Uint16BufferAttribute,
    Vector3,
    WebGPURenderer
} from 'three/webgpu';

import { diffuseColor, float, mrt, normalView, output, pass, renderOutput, roughness, vec4, velocity } from 'three/tsl';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { scheduleTask } from './frame-clock.js';

import { Stage } from '../../core/src/render/Stage.js';
import { GBUFFER_CHANNELS, markAsSkin } from '../../core/src/render/GBuffer.js';
import {
    configureHairMaterial,
    HAIR_OIT_DEFAULT_MODE,
    HAIR_OIT_MODES,
    HAIR_WEIGHT_RANGE,
    viewDepthExtent
} from '../../core/src/render/HairOIT.js';

// The Phase 0 spikes already solved "how do you get a trustworthy GPU number in a browser".
// Reuse their statistics and reporting rather than growing a second dialect of the same thing.
import {
    formatMs,
    looksLikeSoftwareRenderer,
    readFlagParam,
    readNumberParam,
    renderEnvironment,
    renderTable,
    summarise
} from '../../../tools/spikes/spike-harness.js';

const VIEW_MODES = [
    'beauty', 'grid', 'output', 'diffuseColor', 'normal', 'roughness', 'velocity', 'sssMask', 'depth'
];

// Perf sweep conditions. Pinned to the Phase 0 spike conditions on purpose: same resolution,
// same pixel ratio, same timestamp discipline, so `docs/PROGRESS.md`'s measured budgets and
// these numbers can be added together without a conversion step.
const PERF_WIDTH = 1920;
const PERF_HEIGHT = 1080;

// --- punch-list 3.6, the hair arm ---------------------------------------------------------------
//
// Declared up here rather than beside `runHairArm` because `main()` is invoked during module
// evaluation: a `const` further down the file is still in its temporal dead zone when the arm runs,
// which fails as `Cannot access 'HAIR_CAMERA_NEAR' before initialization` and looks like a missing
// asset rather than a hoisting mistake. Measured by execution, once.

/** The hair arm's frustum. `HairOIT.js` computes equation (10) at exactly these two numbers. */
export const HAIR_CAMERA_NEAR = 0.05;
export const HAIR_CAMERA_FAR = 20;

const HAIR_ORBIT_RADIUS = 0.66;
const HAIR_ORBIT_HEIGHT = 0.02;

// ⚠️ The literal path has to sit INSIDE `new URL( …, import.meta.url )` for vite to see it. Vite
// rewrites that exact syntactic form into a served asset URL, and `assets/` is outside the dev
// root (`packages/testbed`); with the path in a variable the rewrite does not happen, the browser
// resolves it against the origin, and the loader is handed `index.html` — which fails as
// `Unexpected token '<' … is not valid JSON` from inside `GLTFLoader.parse`, naming neither the
// file nor the reason. Measured by execution.
const HAIR_GLB = new URL( '../../../assets/hair/bob01/g050.glb', import.meta.url ).href;
const FIGURE_GLB = new URL( '../../../assets/figures/figure_g050.glb', import.meta.url ).href;

const status = document.getElementById( 'status' );

main().catch( ( error ) => {

    status.textContent = String( error && error.stack || error );
    console.error( error );

} );

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

async function main() {

    const canvas = document.getElementById( 'view' );

    // A hidden or headless browser pane performs no layout at all — `innerWidth`, `clientWidth`
    // and the canvas' CSS box all read 0, the drawing buffer comes up 1x1, and every readback
    // below would be a measurement of one pixel. Pin the size whenever layout is not answering,
    // or whenever `?w=&h=` asks for a specific budget.
    const forcedWidth = readNumberParam( 'w', 0 );
    const forcedHeight = readNumberParam( 'h', 0 );
    const layoutIsLive = canvas.clientWidth > 0 && canvas.clientHeight > 0;
    const pinnedSize = ( forcedWidth > 0 || layoutIsLive === false )
        ? { width: forcedWidth || 1280, height: forcedHeight || 720 }
        : null;

    // `?hair=1` replaces the synthetic G-buffer scene with the real groom, for punch-list 3.6.
    // It is on THIS page and not on `src/hair.html` because 3.6's four arms are properties of the
    // deferred pipeline — two of them are G-buffer attachments — and `hair.html` is deliberately a
    // bare `WebGPURenderer` with no pass, no MRT and no temporal resolve. Measuring OIT there would
    // measure a renderer this project does not ship.
    if ( readFlagParam( 'hair' ) ) {

        await runHairArm( canvas, pinnedSize );
        return;

    }

    // `?forward=1` brings the same scene up on the OLD forward path — no pass, no MRT, no
    // composite. It is the control for attributing any renderer warning to the deferred path
    // rather than to the scene or the materials.
    const deferred = readFlagParam( 'forward' ) === false;

    const stage = new Stage();
    await stage.create( canvas, {
        pipeline: deferred,
        forceWebGL: readFlagParam( 'webgl' ),
        maxPixelRatio: 1,          // pin the pixel budget so a readback means one thing
        fieldOfView: 35,
        near: 0.1,
        far: 12,
        ...( pinnedSize === null ? {} : pinnedSize )
    } );

    const world = buildTestScene( stage.scene, { skinTag: readFlagParam( 'noskin' ) === false } );
    stage.camera.position.set( 0, 0, 4.6 );
    stage.camera.lookAt( 0, 0, 0 );

    // Takes over the frame clock from `Stage`, which uses rAF. See `createFrameDriver`.
    const driver = await createFrameDriver( stage.renderer );

    // Free-running animation. `probing` hands control of the scene state to the probe, which
    // needs to step it one deterministic frame at a time.
    let probing = false;
    let motionEnabled = true;
    let clock = 0;

    stage.onFrame( ( deltaSeconds ) => {

        if ( probing ) return;
        if ( motionEnabled ) clock += deltaSeconds;

        applySceneState( world, { knotTime: clock, boneTime: clock, morphWeight: 0.5 + 0.5 * Math.sin( clock * 1.7 ) } );

    } );

    driver.startFreeRun( stage.renderFrame );

    wireUp( stage, world, driver, {
        setProbing: ( value ) => { probing = value; },
        isMotionEnabled: () => motionEnabled,
        setMotionEnabled: ( value ) => { motionEnabled = value; }
    } );

    // Handles for interactive poking from the console — this is a diagnostic page, and the
    // ability to re-read one channel by hand is what turns "the probe hangs" into a location.
    globalThis.__stage = stage;
    globalThis.__world = world;
    globalThis.__readChannel = ( name ) => readChannel( stage.renderer, stage.scenePass.renderTarget, name );  // deferred path only
    globalThis.__tsl = { mrt, output, diffuseColor, normalView, roughness, velocity, float, vec4 };

    if ( deferred === false ) {

        status.textContent = 'forward path — no G-buffer, so no readback probe';
        return;

    }

    reportEnvironment( stage, driver );
    startLiveHud( stage );

    // `?probe=0` leaves the page free-running without taking the frame clock. The readback path
    // is WebGPU-only (`readRenderTargetPixelsAsync` never settles on the WebGL2 backend here),
    // so this is how the fallback tier is inspected at all.
    if ( readFlagParam( 'probe' ) === false && new URLSearchParams( location.search ).has( 'probe' ) ) {

        status.textContent = 'readback probe skipped (?probe=0)';
        return;

    }

    status.textContent = 'running readback probe...';
    const probeResult = await runReadbackProbe( stage, world, driver, () => { probing = true; }, () => { probing = false; } );
    publish( probeResult );
    status.textContent = probeResult.allPassed ? 'probe: all checks passed' : 'probe: FAILURES — see tables';

    if ( readFlagParam( 'perf' ) ) await runPerfSweep();

}

function wireUp( stage, world, driver, hooks ) {

    const views = document.getElementById( 'views' );

    for ( const mode of VIEW_MODES ) {

        const button = document.createElement( 'button' );
        button.textContent = mode;
        button.setAttribute( 'aria-pressed', String( mode === 'beauty' ) );
        button.addEventListener( 'click', () => {

            stage.setViewMode( mode );
            document.body.classList.toggle( 'grid', mode === 'grid' );

            for ( const other of views.querySelectorAll( 'button' ) ) {

                other.setAttribute( 'aria-pressed', String( other === button ) );

            }

        } );
        views.appendChild( button );

    }

    bindSlider( 'velocity-gain', ( value ) => {

        stage.setVelocityGain( value );
        return `${ value }x`;

    } );

    bindSlider( 'depth-gain', ( value ) => {

        stage.setDepthGain( value );
        return `${ value }x`;

    } );

    bindSlider( 'resolution-scale', ( value ) => {

        stage.setResolutionScale( value );
        return value.toFixed( 2 );

    } );

    // The sliders start at their markup values; push those into the stage so what is on screen
    // matches what the panel says before anything is touched.
    document.getElementById( 'depth-gain' ).dispatchEvent( new Event( 'input' ) );
    document.getElementById( 'velocity-gain' ).dispatchEvent( new Event( 'input' ) );

    const motionButton = document.getElementById( 'toggle-motion' );
    motionButton.addEventListener( 'click', () => {

        const next = ! hooks.isMotionEnabled();
        hooks.setMotionEnabled( next );
        motionButton.textContent = `motion: ${ next ? 'on' : 'off' }`;
        motionButton.setAttribute( 'aria-pressed', String( next ) );

    } );

    document.getElementById( 'run-probe' ).addEventListener( 'click', async () => {

        status.textContent = 'running readback probe...';
        const result = await runReadbackProbe(
            stage, world, driver, () => hooks.setProbing( true ), () => hooks.setProbing( false )
        );
        publish( result );
        status.textContent = result.allPassed ? 'probe: all checks passed' : 'probe: FAILURES — see tables';

    } );

    document.getElementById( 'run-perf' ).addEventListener( 'click', () => runPerfSweep() );

}

function bindSlider( id, onChange ) {

    const input = document.getElementById( id );
    const readout = document.getElementById( `${ id }-value` );

    input.addEventListener( 'input', () => {

        readout.textContent = onChange( Number( input.value ) );

    } );

}

function reportEnvironment( stage, driver ) {

    const target = stage.scenePass.renderTarget;

    renderEnvironment( 'env', {
        backend: stage.backendName,
        threeRevision: '185',
        adapter: 'see the cost sweep below for the GPU string',
        compatibilityMode: stage.renderer.backend.compatibilityMode ?? null,
        canvasWidth: target.width,
        canvasHeight: target.height,
        timestampsAvailable: false,
        timestampNote: `frame clock: ${ driver.rafWorks ? 'requestAnimationFrame' : 'manual — rAF never fires in this pane' }`
    } );

}

function startLiveHud( stage ) {

    const gbufferBytes = stage.gbuffer.bytesPerPixel;

    setInterval( () => {

        const target = stage.scenePass.renderTarget;
        const megapixels = ( target.width * target.height ) / 1e6;

        renderTable( 'live', [ { key: 'k', label: '' }, { key: 'v', label: '' } ], [
            { k: 'backend', v: stage.stats.backend },
            { k: 'deferred', v: String( stage.stats.deferred ) },
            { k: 'fps', v: stage.stats.fps.toFixed( 1 ) },
            { k: 'cpu frame ms', v: stage.stats.frameMs.toFixed( 2 ) },
            { k: 'draw calls', v: String( stage.stats.drawCalls ) },
            { k: 'scene pass', v: `${ target.width } x ${ target.height } (scale ${ stage.resolutionScale.toFixed( 2 ) })` },
            { k: 'attachments', v: `${ target.textures.length } — ${ target.textures.map( ( t ) => t.name ).join( ', ' ) }` },
            { k: 'g-buffer', v: `${ gbufferBytes } B/px = ${ ( gbufferBytes * megapixels ).toFixed( 1 ) } MB` }
        ] );

    }, 250 );

}

function publish( result ) {

    globalThis.__STAGE_PROBE__ = result;
    globalThis.__STAGE_PROBE_DONE__ = true;
    console.log( 'STAGE_PROBE ' + JSON.stringify( result ) );

}

// ---------------------------------------------------------------------------
// The test scene
// ---------------------------------------------------------------------------

/**
 * Builds a scene in which each G-buffer channel can be falsified independently.
 *
 * Positions are chosen so that no two animated objects share a horizontal band: the velocity
 * centroid check compares against a screen x, and x is unaffected by whichever way up the
 * render target's rows run.
 */
function buildTestScene( scene, { skinTag = true } = {} ) {

    scene.add( new AmbientLight( 0xffffff, 0.35 ) );

    const key = new DirectionalLight( 0xffffff, 2.6 );
    key.position.set( 2.5, 3, 4 );
    scene.add( key );

    const backdrop = new Mesh(
        new BoxGeometry( 8, 5, 0.2 ),
        physicalMaterial( 0x33333d, 0.92 )
    );
    backdrop.position.set( 0, 0, -1.6 );
    scene.add( backdrop );

    const skinSphere = new Mesh( new SphereGeometry( 0.34, 48, 32 ), physicalMaterial( 0xc98a72, 0.36 ) );
    skinSphere.position.set( -1.05, 0.48, 0 );
    if ( skinTag ) markAsSkin( skinSphere.material );
    scene.add( skinSphere );

    const morphSphere = new Mesh( buildMorphingSphere(), physicalMaterial( 0x6fa8dc, 0.14 ) );
    morphSphere.position.set( 1.05, 0.48, 0 );
    morphSphere.morphTargetInfluences = [ 0 ];
    scene.add( morphSphere );

    const skinnedCylinder = buildSkinnedCylinder();
    skinnedCylinder.position.set( -1.05, -0.55, 0 );
    scene.add( skinnedCylinder );

    const knot = new Mesh( new TorusKnotGeometry( 0.18, 0.055, 96, 16 ), physicalMaterial( 0xd8b04a, 0.24 ) );
    scene.add( knot );

    return { backdrop, skinSphere, morphSphere, skinnedCylinder, knot };

}

function physicalMaterial( colour, roughnessValue ) {

    const material = new MeshPhysicalNodeMaterial( { color: colour } );
    material.roughness = roughnessValue;
    material.metalness = 0;   // keep `diffuseColor` equal to the base colour; the metalness
                              // workflow multiplies it by (1 - metalness) before the MRT sees it
    return material;

}

/**
 * A sphere with one morph target that pushes the surface out along +x.
 *
 * The displacement is deliberately large (0.18 world units at full weight) so that if the
 * velocity channel mistakes a morph offset for motion, the error is unmistakable rather than
 * something that could be argued away as noise.
 */
function buildMorphingSphere() {

    const geometry = new SphereGeometry( 0.3, 48, 32 );
    const base = geometry.attributes.position;
    const delta = new Float32Array( base.count * 3 );

    for ( let i = 0; i < base.count; i ++ ) {

        delta[ i * 3 ] = 0.18 * Math.max( 0, base.getY( i ) / 0.3 );

    }

    geometry.morphTargetsRelative = true;   // matches how our glTF figures store morphs
    geometry.morphAttributes.position = [ new Float32BufferAttribute( delta, 3 ) ];

    return geometry;

}

/**
 * A two-bone cylinder that bends. This is the positive control for deforming velocity: three.js
 * r185 *does* write `positionPrevious` for skinning, so if this region shows velocity and the
 * morph sphere does not, the difference is attributable to the deformation path rather than to
 * the velocity channel being broken.
 */
function buildSkinnedCylinder() {

    const height = 1.0;
    const geometry = new CylinderGeometry( 0.1, 0.1, height, 16, 20 );
    const position = geometry.attributes.position;

    const indices = [];
    const weights = [];

    for ( let i = 0; i < position.count; i ++ ) {

        const fraction = ( position.getY( i ) + height / 2 ) / height;   // 0 at the base, 1 at the tip
        indices.push( 0, 1, 0, 0 );
        weights.push( 1 - fraction, fraction, 0, 0 );

    }

    geometry.setAttribute( 'skinIndex', new Uint16BufferAttribute( indices, 4 ) );
    geometry.setAttribute( 'skinWeight', new Float32BufferAttribute( weights, 4 ) );

    const root = new Bone();
    const tip = new Bone();
    root.position.y = -height / 2;
    tip.position.y = height;
    root.add( tip );

    const mesh = new SkinnedMesh( geometry, physicalMaterial( 0x9fd07a, 0.55 ) );
    mesh.add( root );
    mesh.bind( new Skeleton( [ root, tip ] ) );

    return mesh;

}

/**
 * Puts the scene into an exactly reproducible state. Every animated quantity is a pure function
 * of its argument, so the probe can render the same state twice and know that anything the
 * velocity channel reports is a defect rather than drift.
 */
function applySceneState( world, { knotTime, boneTime, morphWeight } ) {

    world.knot.position.set( 1.05 + 0.22 * Math.cos( knotTime * 1.6 ), -0.55 + 0.22 * Math.sin( knotTime * 1.6 ), 0 );
    world.knot.rotation.set( knotTime * 0.7, knotTime * 0.9, 0 );

    world.skinnedCylinder.skeleton.bones[ 1 ].rotation.z = 0.7 * Math.sin( boneTime * 1.3 );

    world.morphSphere.morphTargetInfluences[ 0 ] = morphWeight;

}

// ---------------------------------------------------------------------------
// Readback
// ---------------------------------------------------------------------------

/**
 * Describes how one attachment's bytes come back, so the reader never has to guess.
 * `readRenderTargetPixelsAsync` returns the raw texel type for the GPU format, and WebGPU pads
 * every row up to a 256-byte boundary — both of which silently corrupt a naive read.
 */
const CHANNEL_LAYOUT = {
    output: { bytesPerTexel: 8, components: 4, half: true },
    diffuseColor: { bytesPerTexel: 4, components: 4, half: false },
    normal: { bytesPerTexel: 8, components: 4, half: true },
    velocity: { bytesPerTexel: 4, components: 2, half: true },
    sssMask: { bytesPerTexel: 1, components: 1, half: false }
};

function halfToFloat( bits ) {

    const sign = ( bits & 0x8000 ) ? -1 : 1;
    const exponent = ( bits & 0x7C00 ) >> 10;
    const fraction = bits & 0x03FF;

    if ( exponent === 0 ) return sign * Math.pow( 2, -14 ) * ( fraction / 1024 );
    if ( exponent === 0x1F ) return fraction === 0 ? sign * Infinity : NaN;

    return sign * Math.pow( 2, exponent - 15 ) * ( 1 + fraction / 1024 );

}

/**
 * Reads one whole attachment back as a flat Float32Array of `components` per pixel, with the
 * GPU's row padding removed and half floats decoded.
 *
 * @returns {Promise<{data: Float32Array, width: number, height: number, components: number}>}
 */
async function readChannel( renderer, renderTarget, name ) {

    const index = renderTarget.textures.findIndex( ( texture ) => texture.name === name );
    if ( index === -1 ) throw new Error( `readChannel: no attachment named '${ name }'` );

    const layout = CHANNEL_LAYOUT[ name ];
    const height = renderTarget.height;

    // `mapAsync` rejects a buffer size that is not a multiple of 4, and three.js sizes the
    // readback buffer as `(h - 1) * paddedRow + w * bytesPerTexel`. The padded rows are always
    // multiples of 256, so only that last partial row can offend — which it does for the R8
    // sssMask channel at any width that is not a multiple of 4. Trimming up to three columns
    // costs nothing here: every consumer of this function wants a statistic, not the edge.
    const texelsPerWord = Math.max( 1, Math.ceil( 4 / layout.bytesPerTexel ) );
    const width = renderTarget.width - ( renderTarget.width % texelsPerWord );

    globalThis.__probeStage = `readChannel ${ name } ${ width }x${ height }`;   // see stepStates

    const raw = await renderer.readRenderTargetPixelsAsync( renderTarget, 0, 0, width, height, index );

    const bytesPerRow = Math.ceil( ( width * layout.bytesPerTexel ) / 256 ) * 256;
    const elementsPerRow = bytesPerRow / raw.BYTES_PER_ELEMENT;

    const data = new Float32Array( width * height * layout.components );
    const scale = layout.half ? 1 : 1 / 255;

    for ( let y = 0; y < height; y ++ ) {

        const sourceRow = y * elementsPerRow;
        const targetRow = y * width * layout.components;

        for ( let x = 0; x < width; x ++ ) {

            for ( let c = 0; c < layout.components; c ++ ) {

                const value = raw[ sourceRow + x * layout.components + c ];
                data[ targetRow + x * layout.components + c ] = layout.half ? halfToFloat( value ) : value * scale;

            }

        }

    }

    return { data, width, height, components: layout.components };

}

// ---------------------------------------------------------------------------
// Frame driver
// ---------------------------------------------------------------------------

/**
 * Advances the renderer exactly one frame at a time.
 *
 * `nodeFrame.frameId` MUST change between two probe renders. `Skinning.js` gates its
 * previous-bone-matrix bookkeeping on the frame id, so two renders sharing one id leave the
 * skeleton stale — the velocity channel would then report zero for a bend that really happened,
 * which is a false negative on the exact question this page exists to answer.
 *
 * Normally three.js stamps that id inside its own `requestAnimationFrame` loop, which is why
 * `tools/spikes/spike-harness.js` insists on driving measurements through `setAnimationLoop`.
 * That assumption breaks in a headless or hidden browser pane, where rAF never fires at all and
 * the whole page silently stalls after one frame. So the driver probes rAF once and, if it is
 * dead, advances the node frame itself and renders on a timer. Both paths do the same two things
 * in the same order; only the clock differs.
 *
 * `driver.rafWorks` is reported in the published results, because a wall-clock frame time means
 * nothing on the fallback path and a reader has to be able to see which one produced the numbers.
 */
// The frame clock lives in `./frame-clock.js` and is imported at the top of this file. It used to
// be fifteen private lines here, and by the time anyone counted, `lighting.js` and `fabric.js` had
// each pasted their own copy with a comment explaining that this file did not export it.
// `docs/OPEN-REQUESTS.md` REQ-023.

async function createFrameDriver( renderer ) {

    const rafWorks = await new Promise( ( resolve ) => {

        let ticks = 0;
        renderer.setAnimationLoop( () => { ticks ++; } );
        setTimeout( () => {

            renderer.setAnimationLoop( null );
            resolve( ticks >= 2 );

        }, 250 );

    } );

    const advanceManually = () => {

        renderer._nodes.nodeFrame.update();
        if ( renderer.info.autoReset === true ) renderer.info.reset();
        renderer.info.frame = renderer._nodes.nodeFrame.frameId;

    };

    return {

        rafWorks,

        nextFrame( body ) {

            if ( rafWorks ) {

                return new Promise( ( resolve ) => {

                    renderer.setAnimationLoop( () => {

                        renderer.setAnimationLoop( null );
                        body();
                        resolve();

                    } );

                } );

            }

            return new Promise( ( resolve ) => {

                scheduleTask( () => {

                    advanceManually();
                    body();
                    resolve();

                } );

            } );

        },

        /** Keeps the page animating for a viewer even when rAF is dead. */
        startFreeRun( body ) {

            if ( rafWorks ) {

                renderer.setAnimationLoop( body );
                return;

            }

            const loop = () => {

                advanceManually();
                body( performance.now() );
                setTimeout( loop, 16 );

            };

            loop();

        }

    };

}

/** Renders one frame per state, so `nodeFrame.frameId` advances between them. */
async function stepStates( driver, draw, states, apply ) {

    // Breadcrumb for the console. A probe that stops making progress is otherwise a silent
    // hang, and this says which step it stopped on.
    globalThis.__probeStage = `stepStates x${ states.length }`;

    for ( const state of states ) {

        await driver.nextFrame( () => {

            apply( state );
            draw();

        } );

    }

}

// ---------------------------------------------------------------------------
// The probe
// ---------------------------------------------------------------------------

async function runReadbackProbe( stage, world, driver, beginProbing, endProbing ) {

    beginProbing();

    const renderer = stage.renderer;
    const draw = () => stage.draw();
    const apply = ( state ) => applySceneState( world, state );

    // The probe reads the attachment at its native size, so the scene pass runs unscaled for
    // the duration and is put back afterwards.
    const previousScale = stage.resolutionScale;
    stage.setResolutionScale( 1 );

    const checks = [];
    const velocityRows = [];

    // --- content: every channel written, with plausible values -------------------------

    const settled = { knotTime: 1.0, boneTime: 1.0, morphWeight: 0.0 };
    await stepStates( driver, draw, [ settled, settled, { ...settled, knotTime: 1.05 } ], apply );

    const target = stage.scenePass.renderTarget;
    const width = target.width;
    const height = target.height;

    const outputChannel = await readChannel( renderer, target, 'output' );
    const albedo = await readChannel( renderer, target, 'diffuseColor' );
    const normal = await readChannel( renderer, target, 'normal' );
    const mask = await readChannel( renderer, target, 'sssMask' );

    checks.push( check(
        'output is lit and varied',
        `${ target.textures.length } attachments; ${ width }x${ height }`,
        ( () => {

            const stats = componentStats( outputChannel, 0 );
            return {
                passed: stats.max > 0.02 && stats.max - stats.min > 0.02,
                detail: `luminance-ish R in [${ stats.min.toFixed( 4 ) }, ${ stats.max.toFixed( 4 ) }], mean ${ stats.mean.toFixed( 4 ) }`
            };

        } )()
    ) );

    checks.push( check(
        'diffuseColor holds the authored albedo',
        'backdrop 0x33333d -> linear 0.0356; knot 0xd8b04a -> linear (0.708, 0.435, 0.0685)',
        ( () => {

            const backdropPixel = samplePixel( albedo, Math.floor( width * 0.5 ), Math.floor( height * 0.06 ) );
            const expected = srgbToLinear( 0x33 / 255 );
            const error = Math.abs( backdropPixel[ 0 ] - expected );
            return {
                passed: error < 0.02,
                detail: `backdrop reads ${ backdropPixel.slice( 0, 3 ).map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) }, expected R ${ expected.toFixed( 3 ) } (err ${ error.toFixed( 4 ) })`
            };

        } )()
    ) );

    checks.push( check(
        'normal.xyz is a unit view-space direction',
        'GTAO normalises what it samples, so a packed 0..1 buffer would read as a wrong direction, not as an error',
        ( () => {

            let counted = 0;
            let unit = 0;
            let minZ = Infinity;
            let maxZ = -Infinity;

            for ( let i = 0; i < normal.width * normal.height; i ++ ) {

                const x = normal.data[ i * 4 ];
                const y = normal.data[ i * 4 + 1 ];
                const z = normal.data[ i * 4 + 2 ];
                const length = Math.hypot( x, y, z );

                if ( length < 0.2 ) continue;   // untouched background
                counted ++;
                if ( Math.abs( length - 1 ) < 0.02 ) unit ++;
                if ( z < minZ ) minZ = z;
                if ( z > maxZ ) maxZ = z;

            }

            const fraction = counted === 0 ? 0 : unit / counted;
            return {
                passed: counted > 1000 && fraction > 0.98 && minZ < 0.5,
                detail: `${ counted } shaded px, ${ ( fraction * 100 ).toFixed( 2 ) }% unit length, view z in [${ minZ.toFixed( 3 ) }, ${ maxZ.toFixed( 3 ) }]`
            };

        } )()
    ) );

    checks.push( check(
        'normal.w carries the five authored roughness values',
        'a channel that read back as one constant would still look plausible',
        ( () => {

            const wanted = [ 0.92, 0.36, 0.14, 0.55, 0.24 ];
            const seen = new Set();

            for ( let i = 0; i < normal.width * normal.height; i ++ ) {

                const length = Math.hypot( normal.data[ i * 4 ], normal.data[ i * 4 + 1 ], normal.data[ i * 4 + 2 ] );
                if ( length < 0.2 ) continue;

                const w = normal.data[ i * 4 + 3 ];
                for ( const value of wanted ) if ( Math.abs( w - value ) < 0.02 ) seen.add( value );

            }

            return {
                passed: seen.size === wanted.length,
                detail: `found ${ seen.size }/5 — ${ [ ...seen ].sort().join( ', ' ) }`
            };

        } )()
    ) );

    const maskRegion = regionStats( mask, 0, 0.5 );
    const skinCentre = projectToPixels( world.skinSphere, stage.camera, width, height );

    checks.push( check(
        'sssMask is 1 on the skin material and 0 everywhere else',
        `material.mrtNode merged over the pass MRT; skin sphere projects to x=${ skinCentre.x.toFixed( 0 ) }px`,
        ( () => {

            const coverage = maskRegion.count / ( width * height );
            const centroidError = Math.abs( maskRegion.centroidX - skinCentre.x ) / width;
            return {
                passed: coverage > 0.002 && coverage < 0.15 && centroidError < 0.05,
                detail: `coverage ${ ( coverage * 100 ).toFixed( 2 ) }%, centroid x ${ maskRegion.centroidX.toFixed( 0 ) }px vs expected ${ skinCentre.x.toFixed( 0 ) }px (${ ( centroidError * 100 ).toFixed( 2 ) }% of width)`
            };

        } )()
    ) );

    // --- velocity, against motion rather than against a still frame --------------------

    const velocityCases = [
        {
            name: 'nothing moves, morph at 0',
            expectation: 'zero everywhere',
            states: [ settled, settled ],
            expectMoving: false
        },
        {
            name: 'nothing moves, morph held at 0.8',
            expectation: 'zero — a constant deformation is not motion',
            states: [ { ...settled, morphWeight: 0.8 }, { ...settled, morphWeight: 0.8 } ],
            expectMoving: false,
            attributedTo: world.morphSphere
        },
        {
            name: 'torus knot moves, nothing else',
            expectation: 'non-zero, centred on the knot',
            states: [ settled, { ...settled, knotTime: 1.06 } ],
            expectMoving: true,
            attributedTo: world.knot
        },
        {
            name: 'skinned cylinder bends, nothing else',
            expectation: 'non-zero, centred on the cylinder',
            states: [ settled, { ...settled, boneTime: 1.35 } ],
            expectMoving: true,
            attributedTo: world.skinnedCylinder
        },
        {
            name: 'morph sweeps 0 -> 0.8, nothing else',
            expectation: 'non-zero if morph deformation reaches the velocity buffer',
            states: [ settled, { ...settled, morphWeight: 0.8 } ],
            expectMoving: null,          // this is the question, not an assertion
            attributedTo: world.morphSphere
        }
    ];

    for ( const testCase of velocityCases ) {

        // Two settling ticks first, so the previous-frame matrices belong to the first state
        // rather than to whatever the last case left behind.
        await stepStates( driver, draw, [ testCase.states[ 0 ], testCase.states[ 0 ], ...testCase.states ], apply );

        const velocityChannel = await readChannel( renderer, target, 'velocity' );
        const measured = velocityStats( velocityChannel, width, height );

        const expected = testCase.attributedTo === undefined
            ? null
            : projectToPixels( testCase.attributedTo, stage.camera, width, height );

        const centroidError = expected === null || measured.count === 0
            ? null
            : Math.abs( measured.centroidX - expected.x ) / width;

        velocityRows.push( {
            case: testCase.name,
            expectation: testCase.expectation,
            maxpx: measured.maxPixels.toFixed( 3 ),
            movingpx: String( measured.count ),
            centroid: measured.count === 0 ? '—' : `${ measured.centroidX.toFixed( 0 ) }px`,
            expectedx: expected === null ? '—' : `${ expected.x.toFixed( 0 ) }px`,
            error: centroidError === null ? '—' : `${ ( centroidError * 100 ).toFixed( 1 ) }%`
        } );

        if ( testCase.expectMoving === true ) {

            checks.push( check(
                `velocity — ${ testCase.name }`,
                testCase.expectation,
                {
                    passed: measured.maxPixels > 0.5 && centroidError !== null && centroidError < 0.06,
                    detail: `peak ${ measured.maxPixels.toFixed( 2 ) } px/frame over ${ measured.count } px, centroid ${ measured.centroidX.toFixed( 0 ) } vs expected ${ expected.x.toFixed( 0 ) }`
                }
            ) );

        } else if ( testCase.expectMoving === false ) {

            checks.push( check(
                `velocity — ${ testCase.name }`,
                testCase.expectation,
                {
                    passed: measured.maxPixels < 0.25,
                    detail: `peak ${ measured.maxPixels.toFixed( 3 ) } px/frame over ${ measured.count } px above 0.25 px`
                }
            ) );

        }

    }

    stage.setResolutionScale( previousScale );
    endProbing();
    driver.startFreeRun( stage.renderFrame );

    renderTable( 'probe',
        [ { key: 'name', label: 'check' }, { key: 'verdict', label: '' }, { key: 'detail', label: 'measured' } ],
        checks.map( ( c ) => ( { name: c.name, verdict: c.passed ? 'PASS' : 'FAIL', detail: c.detail } ) )
    );
    markVerdicts( 'probe', checks );

    renderTable( 'velocity', [
        { key: 'case', label: 'case' },
        { key: 'maxpx', label: 'peak px/frame' },
        { key: 'movingpx', label: 'px > 0.25' },
        { key: 'centroid', label: 'centroid x' },
        { key: 'expectedx', label: 'object x' },
        { key: 'error', label: 'err' }
    ], velocityRows );

    return {
        page: 'stage-gbuffer',
        backend: stage.backendName,
        frameClock: driver.rafWorks ? 'requestAnimationFrame' : 'manual (hidden pane; rAF never fires)',
        renderTarget: { width, height, attachments: target.textures.map( ( t ) => t.name ) },
        gbufferBytesPerPixel: stage.gbuffer.bytesPerPixel,
        channels: GBUFFER_CHANNELS.map( ( c ) => ( { name: c.name, description: c.description } ) ),
        checks,
        velocity: velocityRows,
        allPassed: checks.every( ( c ) => c.passed )
    };

}

function check( name, expectation, outcome ) {

    return { name, expectation, passed: outcome.passed, detail: outcome.detail };

}

/** Colours the verdict column after `renderTable` has written plain text into it. */
function markVerdicts( containerId, checks ) {

    const rows = document.querySelectorAll( `#${ containerId } tbody tr` );

    rows.forEach( ( row, index ) => {

        const cell = row.children[ 1 ];
        if ( cell !== undefined && checks[ index ] !== undefined ) {

            cell.className = checks[ index ].passed ? 'pass' : 'fail';

        }

    } );

}

// ---------------------------------------------------------------------------
// Statistics over a read-back channel
// ---------------------------------------------------------------------------

function componentStats( channel, component ) {

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    const pixels = channel.width * channel.height;

    for ( let i = 0; i < pixels; i ++ ) {

        const value = channel.data[ i * channel.components + component ];
        if ( value < min ) min = value;
        if ( value > max ) max = value;
        sum += value;

    }

    return { min, max, mean: sum / pixels };

}

function samplePixel( channel, x, y ) {

    const base = ( y * channel.width + x ) * channel.components;
    return Array.from( channel.data.slice( base, base + channel.components ) );

}

/** Coverage and horizontal centroid of the pixels whose `component` exceeds `threshold`. */
function regionStats( channel, component, threshold ) {

    let count = 0;
    let weightedX = 0;

    for ( let y = 0; y < channel.height; y ++ ) {

        for ( let x = 0; x < channel.width; x ++ ) {

            const value = channel.data[ ( y * channel.width + x ) * channel.components + component ];
            if ( value <= threshold ) continue;
            count ++;
            weightedX += x;

        }

    }

    return { count, centroidX: count === 0 ? NaN : weightedX / count };

}

/**
 * Motion vectors converted from NDC offsets to pixels per frame, which is the unit the question
 * is actually asked in. `TRAANode` reads the same buffer as `velocity.xy * vec2(0.5, -0.5)` in
 * UV, so a pixel offset is `v * 0.5 * size`.
 */
function velocityStats( channel, width, height ) {

    let maxPixels = 0;
    let count = 0;
    let weightedX = 0;
    let weightSum = 0;

    for ( let y = 0; y < channel.height; y ++ ) {

        for ( let x = 0; x < channel.width; x ++ ) {

            const base = ( y * channel.width + x ) * channel.components;
            const dx = channel.data[ base ] * 0.5 * width;
            const dy = channel.data[ base + 1 ] * 0.5 * height;
            const magnitude = Math.hypot( dx, dy );

            if ( magnitude > maxPixels ) maxPixels = magnitude;

            if ( magnitude > 0.25 ) {

                count ++;
                weightedX += x * magnitude;
                weightSum += magnitude;

            }

        }

    }

    return { maxPixels, count, centroidX: weightSum === 0 ? NaN : weightedX / weightSum };

}

const _worldPosition = new Vector3();

function projectToPixels( object, camera, width, height ) {

    object.getWorldPosition( _worldPosition ).project( camera );

    return {
        x: ( _worldPosition.x * 0.5 + 0.5 ) * width,
        yTopDown: ( 1 - ( _worldPosition.y * 0.5 + 0.5 ) ) * height
    };

}

function srgbToLinear( value ) {

    return value < 0.04045 ? value / 12.92 : Math.pow( ( value + 0.055 ) / 1.055, 2.4 );

}

// ---------------------------------------------------------------------------
// GPU cost sweep
// ---------------------------------------------------------------------------

/**
 * What does the pipeline itself cost, before any shading work is added?
 *
 * Four variants, each rendering the same scene at 1920x1080 with dpr 1:
 *
 *   `forward`            renderer.render() straight to the canvas — no pass, no MRT
 *   `pipeline-output`    RenderPipeline with a single `output` attachment
 *   `pipeline-gbuffer`   the full five-attachment G-buffer
 *   `gbuffer@0.66`       the same, with the scene pass at the TAAU operating point
 *
 * `forward -> pipeline-output` is the cost of the indirection: an offscreen target plus a
 * full-screen composite. `pipeline-output -> pipeline-gbuffer` is what the four extra
 * attachments cost. `gbuffer@0.66` is what 3.12 buys back.
 *
 * The measurement runs on its own renderer with `trackTimestamp`, deliberately not on the live
 * one: the visible Stage is what a viewer is judging, and a timestamp query per frame is a cost
 * that does not belong in that picture.
 */
async function runPerfSweep() {

    status.textContent = 'building the cost sweep renderer...';

    const canvas = document.createElement( 'canvas' );
    canvas.width = PERF_WIDTH;
    canvas.height = PERF_HEIGHT;

    const renderer = new WebGPURenderer( {
        canvas,
        antialias: false,
        forceWebGL: readFlagParam( 'webgl' ),
        trackTimestamp: true
    } );
    renderer.setPixelRatio( 1 );
    renderer.setSize( PERF_WIDTH, PERF_HEIGHT, false );
    await renderer.init();

    const backend = renderer.backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';

    const scene = new Scene();
    const world = buildTestScene( scene, { skinTag: readFlagParam( 'noskin' ) === false } );
    const camera = new PerspectiveCamera( 35, PERF_WIDTH / PERF_HEIGHT, 0.1, 12 );
    camera.position.set( 0, 0, 4.6 );
    camera.lookAt( 0, 0, 0 );

    const driver = await createFrameDriver( renderer );
    // `?only=a,b` restricts the sweep to named variants. It exists because isolating one
    // variant is the only way to attribute a shader-compilation error to the draw that caused
    // it — see the note on `forward` below.
    const only = new URLSearchParams( location.search ).get( 'only' );
    const allVariants = buildPerfVariants( renderer, scene, camera );
    const variants = only === null
        ? allVariants
        : allVariants.filter( ( variant ) => only.split( ',' ).includes( variant.name ) );

    const environment = {
        backend,
        threeRevision: '185',
        adapter: await describeAdapter( renderer, backend === 'webgpu' ),
        compatibilityMode: backend === 'webgpu' ? renderer.backend.compatibilityMode === true : null,
        canvasWidth: PERF_WIDTH,
        canvasHeight: PERF_HEIGHT,
        timestampsAvailable: false,
        timestampNote: ''
    };

    if ( looksLikeSoftwareRenderer( environment.adapter ) ) {

        status.textContent = `refusing to report timings from a software rasteriser: ${ environment.adapter }`;
        return;

    }

    const timestampsWork = await probeTimestamps( renderer, driver, variants[ 0 ].draw, environment );

    const repeats = readNumberParam( 'repeats', 3 );
    const warmupFrames = readNumberParam( 'warmup', 60 );
    const sampleFrames = readNumberParam( 'frames', 150 );
    // ⚠️ ONE render call per frame, deliberately, against the Phase 0 spikes' habit of
    // rendering several to lift a sub-millisecond effect out of the noise.
    //
    // Measured here, same page, same scene, 1920x1080: at `passes=4` this sweep reported
    // forward 0.213 / pipeline-output 0.082 / gbuffer 0.098 / gbuffer@0.66 0.066 ms — the
    // deferred path measuring CHEAPER than forward rendering, which cannot be true. At
    // `passes=1`: 0.131 / 0.524 / 0.655 / 0.393, an ordering that is physically coherent and
    // internally consistent (dropping 56% of scene-pass pixels saves 40% of the frame; the four
    // extra attachments cost 0.131 ms, which is 35 MB at 270 GB/s).
    //
    // `Backend.updateTimeStampUID` keys each query on `render.frameCalls`, so repeated renders
    // in one frame are supposed to accumulate — they evidently do not accumulate the way
    // dividing by the pass count assumes. Rather than reverse-engineer it, this sweep does not
    // rely on it. `?passes=N` is still available for anyone who wants to re-open the question.
    const passesPerFrame = readNumberParam( 'passes', 1 );

    const collected = new Map( variants.map( ( variant ) => [ variant.name, [] ] ) );

    for ( let repeat = 0; repeat < repeats; repeat ++ ) {

        // Alternate the order: GPU clocks drift over a sweep, and a variant that always runs
        // third would carry that drift as if it were its own cost. (tools/spikes/README.md)
        const order = repeat % 2 === 0 ? variants : variants.slice().reverse();

        for ( const variant of order ) {

            status.textContent = `cost sweep — pass ${ repeat + 1 }/${ repeats }, ${ variant.name }`;

            const samples = await measureVariant( {
                renderer, driver, variant, world, warmupFrames, sampleFrames, passesPerFrame,
                collectGpuTimestamps: timestampsWork
            } );

            collected.get( variant.name ).push( ...samples );

        }

    }

    const rows = variants.map( ( variant ) => {

        const samples = collected.get( variant.name );
        const stats = summarise( samples );

        // 🚩 The headline here is **p95, not the median**, which is the opposite of what
        // `tools/spikes/spike-harness.js` does, and the reason is measured rather than assumed.
        //
        // Two things distort this distribution, and both only ever push a sample DOWN. Chrome
        // quantises WebGPU timestamps — every sample on this machine is an exact multiple of
        // 0.065536 ms, so a 0.13 ms effect has two steps of resolution. And some resolves come
        // back holding only part of a frame's work: `min` is exactly one quantum in every
        // variant, including ones that cannot possibly run that fast. A missing render context
        // contributes zero, never extra, so the upper envelope is the honest estimate and the
        // low tail is dropout.
        //
        // Measured across three separate runs of this sweep, p95 was reproducible to the
        // quantum (0.655 / 0.590 / 0.721 / 0.459 ms) while the median wandered over a 5x range
        // in the same runs. Median, mean, min and max are all reported so the shape stays
        // visible instead of being asserted.
        const mean = samples.length === 0 ? null : samples.reduce( ( a, b ) => a + b, 0 ) / samples.length;
        const quantum = smallestStep( samples );

        return {
            name: variant.name,
            mean,
            quantum,
            note: variant.note,
            scenePassSize: variant.scenePassSize(),
            median: stats.median,
            p95: stats.p95,
            min: stats.min,
            max: stats.max,
            count: stats.count
        };

    } );

    const baseline = rows[ 0 ].p95;   // `forward` — the same scene drawn straight to the canvas

    renderEnvironment( 'env-perf', environment );
    renderTable( 'perf', [
        { key: 'name', label: 'variant' },
        { key: 'size', label: 'scene pass' },
        { key: 'p95', label: 'GPU ms (p95)' },
        { key: 'delta', label: 'Δ vs forward' },
        { key: 'median', label: 'median' },
        { key: 'mean', label: 'mean' },
        { key: 'quantum', label: 'timer step' },
        { key: 'note', label: '' }
    ], rows.map( ( row ) => ( {
        name: row.name,
        size: row.scenePassSize,
        p95: formatMs( row.p95 ),
        delta: row.p95 === null || baseline === null ? '—' : formatMs( row.p95 - baseline ),
        median: formatMs( row.median ),
        mean: formatMs( row.mean ),
        quantum: formatMs( row.quantum ),
        note: row.note
    } ) ) );

    const payload = {
        page: 'stage-gbuffer-cost',
        environment,
        conditions: { width: PERF_WIDTH, height: PERF_HEIGHT, repeats, warmupFrames, sampleFrames, passesPerFrame, frameClock: driver.rafWorks ? 'requestAnimationFrame' : 'manual (hidden pane; rAF never fires)' },
        rows
    };

    globalThis.__STAGE_PERF__ = payload;
    globalThis.__STAGE_PERF_DONE__ = true;
    console.log( 'STAGE_PERF ' + JSON.stringify( payload ) );

    status.textContent = 'cost sweep complete';

}

function buildPerfVariants( renderer, scene, camera ) {

    const outputOnlyPass = pass( scene, camera );
    outputOnlyPass.setMRT( mrt( { output } ) );
    const outputOnly = pipelineFor( renderer, outputOnlyPass );

    const gbufferPass = pass( scene, camera );
    configureGBufferPass( gbufferPass );
    const gbuffer = pipelineFor( renderer, gbufferPass );

    const scaledPass = pass( scene, camera );
    configureGBufferPass( scaledPass );
    scaledPass.setResolutionScale( 0.66 );
    const scaled = pipelineFor( renderer, scaledPass );

    // `scenePassSize` is provenance, not decoration: a pass that silently came up at the wrong
    // resolution would produce a beautiful, wrong cost curve.
    const sizeOf = ( scenePass ) => () => `${ scenePass.renderTarget.width }x${ scenePass.renderTarget.height }`;

    return [
        {
            name: 'forward', note: 'renderer.render() to canvas',
            draw: () => renderer.render( scene, camera ),
            scenePassSize: () => `${ PERF_WIDTH }x${ PERF_HEIGHT } (canvas)`
        },
        {
            name: 'pipeline-output', note: '1 attachment + composite',
            draw: () => outputOnly.render(), scenePassSize: sizeOf( outputOnlyPass )
        },
        {
            name: 'pipeline-gbuffer', note: '5 attachments + composite',
            draw: () => gbuffer.render(), scenePassSize: sizeOf( gbufferPass )
        },
        {
            name: 'gbuffer@0.66', note: 'scene pass at the TAAU operating point',
            draw: () => scaled.render(), scenePassSize: sizeOf( scaledPass )
        }
    ];

}

/**
 * Mirrors `GBuffer`'s attachment setup without importing the class, because the sweep needs
 * several passes over one scene and `GBuffer` deliberately owns exactly one.
 */
function configureGBufferPass( scenePass ) {

    for ( const channel of GBUFFER_CHANNELS ) {

        const texture = scenePass.getTexture( channel.name );
        if ( channel.format !== null ) texture.format = channel.format;
        texture.type = channel.type;
        texture.minFilter = channel.filter;
        texture.magFilter = channel.filter;
        texture.generateMipmaps = false;

    }

    scenePass.setMRT( mrt( {
        output,
        diffuseColor,
        normal: vec4( normalView, roughness ),
        velocity,
        sssMask: float( 0 )
    } ) );

}

function pipelineFor( renderer, scenePass ) {

    const pipeline = new RenderPipeline( renderer );
    pipeline.outputColorTransform = false;
    pipeline.outputNode = renderOutput( scenePass.getTextureNode( 'output' ) );
    return pipeline;

}

async function probeTimestamps( renderer, driver, draw, environment ) {

    const supported = environment.backend === 'webgpu'
        ? renderer.hasFeature( 'timestamp-query' )
        : renderer.backend.disjoint !== undefined && renderer.backend.disjoint !== null;

    if ( supported !== true ) {

        environment.timestampNote = environment.backend === 'webgpu'
            ? 'WebGPU adapter does not expose timestamp-query.'
            : 'WebGL2 backend has no EXT_disjoint_timer_query_webgl2; GPU timing unavailable.';
        return false;

    }

    // `trackTimestamp: true` is a request, not a guarantee. Render until a resolve actually
    // returns a positive duration, and say so plainly if one never does — reporting vsync-shaped
    // wall clock as if it were GPU cost is the failure mode this guards against.
    for ( let attempt = 0; attempt < 40; attempt ++ ) {

        await driver.nextFrame( draw );

        const duration = await renderer.resolveTimestampsAsync( TimestampQuery.RENDER );

        if ( typeof duration === 'number' && duration > 0 ) {

            environment.timestampsAvailable = true;
            environment.timestampNote = 'GPU timestamp queries active.';
            return true;

        }

    }

    environment.timestampNote = 'Timestamp feature present but never resolved a non-zero duration.';
    return false;

}

/**
 * One variant's timing distribution.
 *
 * Two disciplines are carried over verbatim from `tools/spikes/spike-harness.js`, because each
 * one was a bug there first: the loop is driven by `setAnimationLoop` so three.js stamps a fresh
 * frame id per tick, and **nothing renders while a timestamp resolve is outstanding**, because
 * `resolveTimestampsAsync` reports the total for whichever frame is last in the pending set.
 */
async function measureVariant( { renderer, driver, variant, world, warmupFrames, sampleFrames, passesPerFrame, collectGpuTimestamps } ) {

    const samples = [];

    for ( let frameIndex = 0; frameIndex < warmupFrames + sampleFrames; frameIndex ++ ) {

        const time = frameIndex * 0.016;

        await driver.nextFrame( () => {

            applySceneState( world, { knotTime: time, boneTime: time, morphWeight: 0.5 } );

            // Rendering the same scene several times per frame is how a sub-millisecond effect
            // is lifted clear of the noise floor: three.js sums every pass in a frame into that
            // frame's timestamp total, so dividing by the pass count returns a per-pass figure,
            // and the denser workload keeps the GPU clocks pinned.
            for ( let repeat = 0; repeat < passesPerFrame; repeat ++ ) variant.draw();

        } );

        if ( collectGpuTimestamps !== true ) continue;

        // Awaiting the resolve before the next frame is the guard, not politeness:
        // `resolveTimestampsAsync` returns the total for whichever frame is last in the pending
        // set, so letting several frames' queries pool up detaches the number from the pass
        // count it is divided by. That bug produced an INVERTED morph-cost curve in the Phase 0
        // spikes — 69 targets measuring cheaper than 0.
        const duration = await renderer.resolveTimestampsAsync( TimestampQuery.RENDER );

        if ( frameIndex >= warmupFrames && typeof duration === 'number' && duration > 0 ) {

            samples.push( duration / passesPerFrame );

        }

    }

    return samples;

}

/**
 * The smallest non-zero gap between adjacent distinct samples — the timer's effective
 * resolution. Reported rather than assumed, because it decides how much of a difference between
 * two variants is signal.
 */
function smallestStep( samples ) {

    const distinct = [ ...new Set( samples ) ].sort( ( a, b ) => a - b );
    let step = Infinity;

    for ( let i = 1; i < distinct.length; i ++ ) {

        const gap = distinct[ i ] - distinct[ i - 1 ];
        if ( gap > 1e-9 && gap < step ) step = gap;

    }

    return step === Infinity ? null : step;

}

async function describeAdapter( renderer, usingWebGPU ) {

    if ( usingWebGPU ) {

        if ( navigator.gpu === undefined ) return 'unknown (no navigator.gpu)';
        const adapter = await navigator.gpu.requestAdapter();
        if ( adapter === null ) return 'unknown (no adapter)';
        const info = adapter.info || {};
        const parts = [ info.vendor, info.architecture, info.device, info.description ].filter( Boolean );
        return parts.length > 0 ? parts.join( ' / ' ) : 'WebGPU adapter (no info exposed)';

    }

    const gl = renderer.backend.gl;
    if ( ! gl ) return 'unknown (no WebGL context)';
    const debugInfo = gl.getExtension( 'WEBGL_debug_renderer_info' );
    if ( ! debugInfo ) return gl.getParameter( gl.RENDERER );
    return gl.getParameter( debugInfo.UNMASKED_RENDERER_WEBGL );

}

// ---------------------------------------------------------------------------
// Punch-list 3.6 — hair order-independent transparency
// ---------------------------------------------------------------------------

/**
 * The real groom, on the real deferred pipeline, with the four OIT arms A/B-able from a query
 * parameter and from buttons on the page.
 *
 * ## Why the artefact is measured as DRAW-ORDER DEPENDENCE
 *
 * "Sorting artefact" is easy to assert and hard to photograph: a groom rendered wrong looks like a
 * groom. So this page can render the identical frame with the hair's TRIANGLE ORDER REVERSED
 * (`?cardorder=reverse`), which changes nothing about the geometry, the camera, the lights or the
 * shading — only the sequence the fragments arrive in. Order independence is exactly the property
 * that the two plates are the same picture, so the difference between them IS the artefact, in code
 * values, with no reference render and no judgement involved.
 *
 * Reversal is by triangle rather than by card because it is the strongest permutation available and
 * needs no topology analysis: every card's triangles AND every card come back in the opposite
 * sequence. Winding inside each triangle is preserved, so back-face culling and normals are
 * untouched — verified by the `cutout` arm, whose two orders must come back byte-identical.
 *
 * ## Query parameters
 *
 *   `hair=1`             this arm
 *   `oit=`               `blend` | `cutout` | `hash` | `wboit` (default `HAIR_OIT_DEFAULT_MODE`)
 *   `cardorder=reverse`  reverse the groom's triangle order — the permutation control
 *   `aa=`                `off` | `traa` | `taau` (default `taau`, the shipped resolve)
 *   `orbit=`             degrees of azimuth per simulated frame (default 0.25)
 *   `azimuth=`           starting azimuth in degrees (default 34, the judge's three-quarter)
 *   `range=`             `HAIR_WEIGHT_RANGE`, the one free parameter of the `wboit` arm
 *   `figure=0`           groom only, no body — isolates hair-on-hair overlap from hair-on-skin
 *   `nohair=1`           load the groom and do NOT add it — the control every cost delta is against
 *   `oitdefect=material-blend`  the red proof: OIT blend modes on the material, where three never
 *                        reads them. The `wboit` arm must go back to being order dependent.
 *   `bare`               hide the panel, so a plate is only the render
 *   `gputime=1`          request GPU timestamp queries; read `__SUGATA_GPU_MS__()`
 *   `capture`            stop the frame loop and hand the clock to `__SUGATA_STEP__`
 */
async function runHairArm( canvas, pinnedSize ) {

    const query = new URLSearchParams( location.search );

    // The default is the module's measured recommendation rather than a literal, so the page and
    // the shipping decision cannot drift apart.
    const mode = query.get( 'oit' ) ?? HAIR_OIT_DEFAULT_MODE;

    if ( HAIR_OIT_MODES.includes( mode ) === false ) {

        throw new Error( `?oit must be one of ${ HAIR_OIT_MODES.join( ', ' ) }` );

    }

    const aa = query.get( 'aa' ) ?? 'taau';
    const reversed = query.get( 'cardorder' ) === 'reverse';
    const orbitDegrees = query.has( 'orbit' ) ? Number( query.get( 'orbit' ) ) : 0.25;
    const weightRange = query.has( 'range' ) ? Number( query.get( 'range' ) ) : HAIR_WEIGHT_RANGE;
    const wantsFigure = query.get( 'figure' ) !== '0';

    const stage = new Stage();

    await stage.create( canvas, {
        pipeline: true,
        temporalAA: aa === 'off' ? 'off' : aa,
        hairOIT: mode,

        // 🚩 `?oitdefect=material-blend` is the rejection proof for the whole pass-level-blending
        // finding, live on the page. It is not a debug view: with it the `wboit` arm must go back to
        // being order dependent, and `HairOIT.selftest.mjs` fails if it does not.
        hairOITDefect: query.get( 'oitdefect' ),
        maxPixelRatio: 1,
        fieldOfView: 32,

        // Asked for at DEVICE CREATION, not at read time. `renderer.info.render.timestamp` stays at
        // exactly 0.000 for every frame without it, which reads as a free pass rather than as an
        // instrument that was never armed — measured, four arms of 0.000 ms, before this line.
        trackTimestamp: query.get( 'gputime' ) === '1',

        // A head fills the frame at 0.7 m, so the frustum is pulled in hard. It is not cosmetic:
        // `HairOIT.js`'s header computes equation (10) at exactly this near/far to show the
        // published weight curve is clamped flat over a groom, and `HairOIT.selftest.mjs` re-derives
        // it from these two numbers.
        near: HAIR_CAMERA_NEAR,
        far: HAIR_CAMERA_FAR,
        ...( pinnedSize === null ? {} : pinnedSize )
    } );

    // `?capture` has to take the clock BEFORE anything loads, so the frames a stepping tool counts
    // are the frames the renderer draws. `alive.js` and `post.js` both do this and say why.
    const advanceRendererFrame = query.has( 'capture' ) ? takeOverHairFrameLoop( stage.renderer ) : null;

    stage.scene.background = new Color( 0x0b0d11 );

    // Three lights, no environment, and the rim is the one that matters: a hair silhouette is only
    // legible when something separates a card's edge from the mass behind it, and an OIT arm that
    // is measured on an unlit groom is measured on a black shape.
    const key = new DirectionalLight( 0xfff2e4, 2.6 );
    const rim = new DirectionalLight( 0xcfe0ff, 3.4 );
    const fill = new AmbientLight( 0x66707f, 0.55 );
    stage.scene.add( key, rim, fill, key.target, rim.target );

    const loader = new GLTFLoader();

    const hairAsset = await loader.loadAsync( HAIR_GLB );

    // `?nohair=1` loads the groom and then does NOT add it, which is the control row every cost
    // number below is a delta against. Loading it anyway keeps the two arms identical in everything
    // except the draw — same textures resident, same decode work, same GPU memory — so the
    // difference is the groom's rendering and not its residency.
    const wantsHair = query.get( 'nohair' ) !== '1';

    if ( wantsHair ) stage.add( hairAsset.scene );

    if ( wantsFigure ) {

        const figureAsset = await loader.loadAsync( FIGURE_GLB );
        stage.add( figureAsset.scene );

    }

    const hairMeshes = [];

    hairAsset.scene.traverse( ( object ) => { if ( object.isMesh === true ) hairMeshes.push( object ); } );

    if ( hairMeshes.length === 0 ) throw new Error( 'the groom GLB contains no mesh' );

    let triangles = 0;

    for ( const mesh of hairMeshes ) {

        if ( reversed ) reverseTriangleOrder( mesh.geometry );

        triangles += mesh.geometry.index.count / 3;

        // The GLTF material is replaced rather than adjusted. `GLTFLoader` builds a
        // `MeshStandardMaterial`, which the WebGPU backend converts to a node material internally
        // and per-render — so `material.mrtNode`, which is the whole `wboit` mechanism, would be
        // set on an object the renderer throws away. Building the node material here is the only
        // way the accumulation outputs survive to the shader.
        mesh.material = configureHairMaterial(
            hairNodeMaterial( mesh.material ),
            mode,
            { slab: stage.hairOIT?.slab, defect: query.get( 'oitdefect' ) }
        );

    }

    const hairBounds = new Box3().setFromObject( hairAsset.scene );
    const focus = hairBounds.getCenter( new Vector3() );
    const scratch = new Vector3();

    stage.hairOIT?.setWeightRange( weightRange );

    let azimuthDegrees = query.has( 'azimuth' ) ? Number( query.get( 'azimuth' ) ) : 34;

    const place = () => {

        const angle = azimuthDegrees * Math.PI / 180;

        stage.camera.position.set(
            focus.x + Math.sin( angle ) * HAIR_ORBIT_RADIUS,
            focus.y + HAIR_ORBIT_HEIGHT,
            focus.z + Math.cos( angle ) * HAIR_ORBIT_RADIUS
        );
        stage.camera.lookAt( focus );
        stage.camera.updateMatrixWorld( true );

        key.position.copy( stage.camera.position ).add( new Vector3( 0.5, 0.6, 0.2 ) );
        rim.position.copy( focus ).addScaledVector(
            scratch.copy( stage.camera.position ).sub( focus ).normalize(), - 1 );
        rim.position.y += 0.9;
        key.target.position.copy( focus );
        rim.target.position.copy( focus );

        // The weight curve is fitted to the groom's own depth extent, which changes every frame of
        // an orbit. Recomputed from the eight world-space corners in VIEW space, because a
        // world-axis-aligned box is not view-axis-aligned and its raw z extent under-reports the
        // slab at every angle except dead-on.
        if ( stage.hairOIT !== null ) {

            const extent = viewDepthExtent( hairBounds, stage.camera, scratch );
            stage.hairOIT.setSlab( extent.near, extent.far );

        }

    };

    const advance = ( deltaSeconds ) => {

        // Per SIMULATED FRAME, not per second: the artefact this page exists to measure is a
        // frame-to-frame pop, so the step has to be the same angular amount whatever the machine's
        // frame rate is. A rate in degrees per second would make the measurement a property of the
        // GPU it ran on.
        if ( deltaSeconds > 0 ) azimuthDegrees += orbitDegrees;
        place();

    };

    advance( 0 );

    if ( query.has( 'capture' ) === false ) stage.onFrame( advance );

    globalThis.__SUGATA_ENV__ = () => ( {
        ...stage.stats,
        oit: mode,
        oitDefect: query.get( 'oitdefect' ),
        cardOrder: reversed ? 'reverse' : 'forward',
        aa,
        weightRange,
        hairTriangles: triangles,
        azimuthDegrees
    } );

    globalThis.__SUGATA_STEP__ = async ( deltaSeconds = 1 / 60 ) => {

        advance( deltaSeconds );

        if ( advanceRendererFrame !== null ) {

            advanceRendererFrame( deltaSeconds );
            stage.draw();

            await stage.renderer.backend?.device?.queue?.onSubmittedWorkDone();
            await hairNextPaint();

        }

        return true;

    };

    globalThis.__SUGATA_GPU_MS__ = async () => {

        if ( query.has( 'gputime' ) === false ) return null;

        // 🚩 `info.render.timestamp` reads 0 until the query resolves, and a plausible zero reads
        // as a free frame. `post.js` carries the same warning for the same reason.
        await stage.renderer.resolveTimestampsAsync( 'render' );

        return stage.renderer.info.render.timestamp;

    };

    globalThis.__stage = stage;

    if ( query.has( 'bare' ) ) {

        // Both halves, and the second one is the half that bit. `stage.html`'s body is a grid of
        // `minmax(0, 1fr) 460px`, so hiding the panel leaves its 460 px COLUMN behind: on a 560 px
        // capture the canvas came back 100 px wide and the plate was 82% black. A bare plate has to
        // collapse the track, not just the element in it.
        document.getElementById( 'panel' ).style.display = 'none';
        document.body.style.gridTemplateColumns = '100%';
        return;

    }

    buildHairPanel( stage, { mode, aa, reversed, weightRange, triangles, cards: hairMeshes.length } );

}

/**
 * A node material carrying the groom's own sheets, because the loader's `MeshStandardMaterial` is
 * converted internally and any `mrtNode` set on it is discarded with the original.
 *
 * `map` carries coverage in its alpha — that is what the atlas is, an RGB strand colour and an A
 * cut-out — and three's `setupDiffuseColor` multiplies the map's alpha into `diffuseColor.a`, which
 * is the `α` every arm below reads. Nothing here is punch-list 3.5's shading model; 3.5 replaces
 * this material wholesale and `configureHairMaterial` is the seam it attaches to.
 */
function hairNodeMaterial( source ) {

    const material = new MeshPhysicalNodeMaterial();

    material.name = 'hair-oit-placeholder';
    material.map = source.map ?? null;
    material.normalMap = source.normalMap ?? null;
    material.color.set( 0xffffff );
    material.roughness = 0.32;
    material.metalness = 0;
    material.side = source.side;

    return material;

}

/**
 * Reverses the order triangles are submitted in, leaving the geometry itself bit-identical.
 *
 * Each triangle's three indices keep their relative order, so winding — and therefore culling and
 * the geometric normal — is unchanged. Only the SEQUENCE changes, which is precisely the variable
 * an order-independent method is supposed to be insensitive to.
 */
function reverseTriangleOrder( geometry ) {

    const index = geometry.index;
    const source = index.array;
    const swapped = source.slice();
    const triangles = source.length / 3;

    for ( let triangle = 0; triangle < triangles; triangle ++ ) {

        const from = ( triangles - 1 - triangle ) * 3;
        const to = triangle * 3;

        swapped[ to ] = source[ from ];
        swapped[ to + 1 ] = source[ from + 1 ];
        swapped[ to + 2 ] = source[ from + 2 ];

    }

    index.array.set( swapped );
    index.needsUpdate = true;

}

/** Two rAFs, so the screenshot that follows sees the frame that was just submitted. */
function hairNextPaint() {

    return new Promise( ( resolve ) => {

        requestAnimationFrame( () => requestAnimationFrame( resolve ) );

    } );

}

/**
 * The same frame-loop takeover `post.js` and `alive.js` use, duplicated for the reason `post.js`
 * gives: two browsercheck pages that import each other's internals stop being independently
 * readable, and a drift shows up as a temporal measurement that does not reproduce.
 */
function takeOverHairFrameLoop( renderer ) {

    const nodeFrame = renderer._nodes?.nodeFrame;

    if ( typeof renderer._animation?.stop === 'function' && typeof nodeFrame?.update === 'function' ) {

        renderer._animation.stop();

        let elapsedSeconds = 0;

        return ( deltaSeconds ) => {

            nodeFrame.update();

            elapsedSeconds += deltaSeconds;
            nodeFrame.deltaTime = deltaSeconds;
            nodeFrame.time = elapsedSeconds;

        };

    }

    console.warn( 'stage: could not reach renderer._animation / _nodes.nodeFrame; rAF still owns the frame.' );

    return null;

}

/**
 * The A/B toggle, built from script rather than from markup because this arm shares a page with the
 * G-buffer browsercheck and the two have nothing else in common.
 *
 * Each button RELOADS with a different `?oit=`. That is deliberate: `wboit` allocates two extra
 * G-buffer attachments, an attachment set belongs to the render target the pass was built with, and
 * a live swap would mean tearing the pipeline down under a running frame loop. Reloading also means
 * every arm boots through exactly the same code path, which is what makes a pair of judge plates
 * comparable.
 */
function buildHairPanel( stage, { mode, aa, reversed, weightRange, triangles, cards } ) {

    const panel = document.getElementById( 'panel' );
    panel.textContent = '';

    const heading = document.createElement( 'h1' );
    heading.textContent = 'Hair OIT — punch-list 3.6';
    panel.appendChild( heading );

    const swap = ( key, value ) => {

        const next = new URLSearchParams( location.search );
        next.set( key, value );
        location.search = next.toString();

    };

    const row = ( label, options, current, key ) => {

        const title = document.createElement( 'h2' );
        title.textContent = label;
        panel.appendChild( title );

        for ( const option of options ) {

            const button = document.createElement( 'button' );
            button.textContent = option;
            button.setAttribute( 'aria-pressed', String( String( option ) === String( current ) ) );
            button.addEventListener( 'click', () => swap( key, option ) );
            panel.appendChild( button );

        }

    };

    row( 'transparency arm', HAIR_OIT_MODES, mode, 'oit' );
    row( 'card draw order', [ 'forward', 'reverse' ], reversed ? 'reverse' : 'forward', 'cardorder' );
    row( 'temporal resolve', [ 'off', 'traa', 'taau' ], aa, 'aa' );

    const notes = document.createElement( 'p' );
    notes.className = 'note';
    notes.textContent =
        `${ cards } hair mesh(es), ${ triangles.toLocaleString() } triangles. ` +
        `weight range ${ weightRange }. ` +
        `G-buffer ${ stage.gbuffer.bytesPerPixel } B/px. ` +
        'blend is the DEFECT and is the control arm: switch card draw order with it selected and ' +
        'the picture changes, which is the artefact this item exists to remove.';
    panel.appendChild( notes );

}
