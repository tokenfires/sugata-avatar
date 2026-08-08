/**
 * Stage — the renderer, the scene graph root, the G-buffer, and the frame loop.
 *
 * Everything else in Sugata draws into a Stage. It exists so that no other module has to
 * know which GPU backend is live, how the canvas is sized, or when a frame happens.
 *
 * Backend policy (see docs/research/rendering-stack.md): we author against WebGPU + TSL and
 * treat WebGL2 as a degraded fallback tier, not a co-equal backend. WebGPURenderer already
 * falls back internally when adapter acquisition fails, but callers still need to know which
 * backend actually came up — quality tiers, TRAA and the hair OIT path all branch on it — so
 * `stats.backend` reports the truth read back off the renderer after initialisation.
 *
 * ## Two rendering modes, and why the deferred one is opt-in
 *
 * `create( canvas )` still does what it always did: forward rendering straight to the canvas.
 * `create( canvas, { pipeline: true } )` instead renders the scene once into the five-attachment
 * G-buffer described in `GBuffer.js` and composites through a `RenderPipeline`.
 *
 * The deferred path is opt-in rather than the default because every existing consumer
 * (`alive.js`, the browsercheck pages, the deterministic capture tool) is calibrated against the
 * forward path, and several measured gates in `docs/PROGRESS.md` were taken through it. Flipping
 * the default is a one-word change in this file, and belongs to whichever punch-list item first
 * needs the G-buffer at full-body framing — 3.2 (skin) or 3.8 (lighting rig) — so that the
 * re-measurement happens in the same round as the change.
 *
 * 🚩 `PostProcessing` was renamed to `RenderPipeline` at r183; the old name still exists as a
 * deprecated subclass that emits a `warnOnce`. This file uses `RenderPipeline`.
 */

import {
    ACESFilmicToneMapping,
    PerspectiveCamera,
    RenderPipeline,
    Scene,
    SRGBColorSpace,
    WebGPURenderer
} from 'three/webgpu';

import { pass, renderOutput, screenUV, uniform, vec4 } from 'three/tsl';

import { channelDisplayNode, channelGridNode, GBuffer } from './GBuffer.js';

const MAX_PIXEL_RATIO = 2;
const FPS_SAMPLE_WINDOW_MS = 500;

// The six panes the grid view shows, row-major across 3 columns and 2 rows: all five MRT
// attachments, plus roughness, which rides in the normal attachment's alpha and is otherwise
// invisible. Depth is a full-screen view only — see `channelGridNode`.
const GRID_VIEWS = [ 'output', 'diffuseColor', 'normal', 'velocity', 'sssMask', 'roughness' ];

export class Stage {

    constructor() {

        this.renderer = null;
        this.scene = new Scene();
        this.camera = null;
        this.canvas = null;

        this.frameCallbacks = [];

        // Deferred path. All null on the forward path.
        this.renderPipeline = null;
        this.scenePass = null;
        this.gbuffer = null;
        this.viewMode = 'beauty';
        this.composeOutput = null;
        this.velocityGain = null;
        this.depthGain = null;
        this.resolutionScale = 1;

        // Sizing state. We re-read devicePixelRatio on every viewport update rather than
        // caching it, because dragging a window between a Retina and an external display
        // changes it without changing the CSS pixel size of the canvas.
        this.maxPixelRatio = MAX_PIXEL_RATIO;
        this.pixelRatio = 1;
        this.fixedSize = null;
        this.resizeObserver = null;
        this.pixelRatioWatcher = null;

        // Frame timing. `fps` is the smoothed presentation rate; `frameMs` is the CPU time
        // this Stage spends inside one frame (callbacks + submit), which is not the GPU cost.
        this.backendName = 'uninitialised';
        this.fps = 0;
        this.frameMs = 0;
        this.lastFrameTimeMs = 0;
        this.framesInWindow = 0;
        this.windowStartedAtMs = 0;

        // Geometry counters are snapshotted after each draw rather than read live from
        // renderer.info, because the renderer zeroes them at the start of every frame — a
        // caller reading them from an onFrame callback would always see zero.
        this.drawCalls = 0;
        this.triangles = 0;

        this.renderFrame = this.renderFrame.bind( this );
        this.updateViewport = this.updateViewport.bind( this );

    }

    /**
     * Brings up the renderer against an existing canvas and starts the frame loop.
     *
     * Resolves only once the GPU backend has really initialised, so callers may safely
     * build PMREMs and compile materials immediately afterwards.
     *
     * @param {HTMLCanvasElement} canvas - The canvas to draw into. Sized by CSS, not by us.
     * @param {Object} [options]
     * @param {boolean} [options.forceWebGL=false] - Skip WebGPU entirely. The quality-tier
     *   layer uses this to serve Firefox the WebGL2 tier, where WebGPU dispatch overhead is
     *   roughly 18x Chrome's.
     * @param {boolean} [options.antialias=false] - MSAA. Leave off once TRAA is in the pipeline.
     * @param {number} [options.maxPixelRatio=2] - Upper bound on devicePixelRatio.
     * @param {number} [options.fieldOfView=35] - Vertical FOV in degrees. Portrait range is 24-40.
     * @param {number} [options.near=0.01]
     * @param {number} [options.far=100]
     * @param {number} [options.toneMappingExposure=1]
     * @param {boolean} [options.pipeline=false] - Render deferred, through the G-buffer.
     * @param {boolean} [options.trackTimestamp=false] - Enable GPU timestamp queries. Costs a
     *   little per frame, so only measurement pages ask for it.
     * @param {number} [options.resolutionScale=1] - Scene-pass resolution as a fraction of the
     *   drawing buffer. 0.66 is the TAAU operating point from `research/rendering-stack.md`.
     * @param {number} [options.width] - Pins the drawing buffer instead of following CSS.
     *   Give both, or neither. See `setFixedSize`.
     * @param {number} [options.height]
     * @returns {Promise<Stage>}
     */
    async create( canvas, options = {} ) {

        this.canvas = canvas;
        this.maxPixelRatio = options.maxPixelRatio ?? MAX_PIXEL_RATIO;

        if ( options.width !== undefined && options.height !== undefined ) {

            this.fixedSize = { width: options.width, height: options.height };

        }

        const wantsWebGPU = options.forceWebGL !== true && this.isWebGPUAvailable();

        this.renderer = new WebGPURenderer( {
            canvas,
            antialias: options.antialias === true,
            forceWebGL: wantsWebGPU === false,
            trackTimestamp: options.trackTimestamp === true
        } );

        this.renderer.toneMapping = ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = options.toneMappingExposure ?? 1;
        this.renderer.outputColorSpace = SRGBColorSpace;

        await this.renderer.init();

        // Read the backend back rather than trusting the request: Renderer.init() swaps in a
        // WebGL2 backend if adapter acquisition throws, and the caller needs to know.
        this.backendName = this.renderer.backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';

        this.camera = new PerspectiveCamera(
            options.fieldOfView ?? 35,
            1,
            options.near ?? 0.01,
            options.far ?? 100
        );

        if ( options.pipeline === true ) {

            this.buildPipeline( options.resolutionScale ?? 1 );

        }

        this.watchViewport();
        this.updateViewport();

        this.windowStartedAtMs = performance.now();
        this.renderer.setAnimationLoop( this.renderFrame );

        return this;

    }

    /**
     * Adds an object to the scene root. Sugar over `stage.scene.add` so callers that only
     * need to park something in the world never touch the scene graph directly.
     */
    add( object ) {

        this.scene.add( object );
        return object;

    }

    /**
     * Registers a per-frame callback, invoked as `fn(deltaSeconds, elapsedSeconds)` before
     * the draw. Returns a function that unregisters it again.
     */
    onFrame( callback ) {

        this.frameCallbacks.push( callback );

        return () => {

            const index = this.frameCallbacks.indexOf( callback );
            if ( index !== -1 ) this.frameCallbacks.splice( index, 1 );

        };

    }

    /**
     * Switches what reaches the screen. `beauty` is the shipping path; the rest render one
     * G-buffer channel, and `grid` shows six of them at once.
     *
     * @param {'beauty'|'grid'|'output'|'diffuseColor'|'normal'|'roughness'|'velocity'|'sssMask'|'depth'} view
     */
    setViewMode( view ) {

        this.requirePipeline( 'setViewMode' );

        this.viewMode = view;
        this.refreshOutputNode();

    }

    /**
     * Installs the composite that produces the final image, so temporal AA (3.12) and the
     * grade (3.13) can own the end of the chain without this file knowing about either.
     *
     * The callback receives `(gbuffer, sceneColourNode)` and returns a vec4 in working colour
     * space; Stage applies tone mapping and the output transfer afterwards.
     *
     * @param {?function(GBuffer, Node): Node} compose - Pass `null` to restore the default.
     */
    setComposeOutput( compose ) {

        this.requirePipeline( 'setComposeOutput' );

        this.composeOutput = compose;
        this.refreshOutputNode();

    }

    /**
     * Renders the scene pass at a fraction of the drawing buffer. This is the lever that pays
     * for an expensive skin shader: `research/rendering-stack.md` puts the TAAU operating point
     * at 0.66, which is 44% of the shaded pixels.
     *
     * The composite still runs at full resolution, so post effects and the grade are unaffected.
     *
     * @param {number} scale
     */
    setResolutionScale( scale ) {

        this.requirePipeline( 'setResolutionScale' );

        this.resolutionScale = scale;
        this.scenePass.setResolutionScale( scale );

    }

    /** Display gain applied to motion vectors in the `velocity` view. */
    setVelocityGain( gain ) {

        this.requirePipeline( 'setVelocityGain' );
        this.velocityGain.value = gain;

    }

    /** Display gain applied to linear depth in the `depth` view. */
    setDepthGain( gain ) {

        this.requirePipeline( 'setDepthGain' );
        this.depthGain.value = gain;

    }

    /**
     * Live counters for the HUD and for the quality-tier logic that picks a rendering
     * budget from measured frame cost.
     */
    get stats() {

        return {
            backend: this.backendName,
            deferred: this.renderPipeline !== null,
            fps: this.fps,
            frameMs: this.frameMs,
            dpr: this.pixelRatio,
            drawCalls: this.drawCalls,
            triangles: this.triangles
        };

    }

    /**
     * Stops the loop and releases GPU resources. Safe to call twice.
     */
    dispose() {

        this.unwatchViewport();
        this.frameCallbacks.length = 0;

        this.renderPipeline = null;
        this.scenePass = null;
        this.gbuffer = null;

        // Renderer.dispose() stops its own animation loop, so we do not stop it twice.
        if ( this.renderer !== null ) {

            this.renderer.dispose();
            this.renderer = null;

        }

        this.backendName = 'disposed';

    }

    // --- helpers -----------------------------------------------------------------------

    /**
     * Stands up the deferred path: one scene pass writing the G-buffer, one composite.
     *
     * `outputColorTransform` is turned off and tone mapping is applied by this file instead.
     * `RenderPipeline` would otherwise tone-map whatever the output node produced, which is
     * right for the beauty view and destructive for every debug view — ACES applied to a
     * motion vector is not a diagnostic.
     */
    buildPipeline( resolutionScale ) {

        this.scenePass = pass( this.scene, this.camera );
        this.gbuffer = new GBuffer( this.scenePass );

        if ( resolutionScale !== 1 ) {

            this.scenePass.setResolutionScale( resolutionScale );
            this.resolutionScale = resolutionScale;

        }

        this.velocityGain = uniform( 200 );
        this.depthGain = uniform( 1 );

        this.renderPipeline = new RenderPipeline( this.renderer );
        this.renderPipeline.outputColorTransform = false;

        this.refreshOutputNode();

    }

    /**
     * Rebuilds the composite. Node graphs are compiled, so changing what is on screen means
     * building a new output node and telling the pipeline to recompile — cheap, and it only
     * happens on an explicit view or composite change.
     */
    refreshOutputNode() {

        const gbuffer = this.gbuffer;
        const gains = { velocityGain: this.velocityGain, depthGain: this.depthGain };

        if ( this.viewMode === 'grid' ) {

            this.renderPipeline.outputNode = vec4( channelGridNode(
                gbuffer, GRID_VIEWS, screenUV, 3, 2, gains
            ), 1 );

        } else if ( this.viewMode !== 'beauty' ) {

            this.renderPipeline.outputNode = vec4( channelDisplayNode( gbuffer, this.viewMode, gains ), 1 );

        } else {

            const sceneColour = gbuffer.node( 'output' );
            const composed = this.composeOutput === null
                ? sceneColour
                : this.composeOutput( gbuffer, sceneColour );

            this.renderPipeline.outputNode = renderOutput( composed );

        }

        this.renderPipeline.needsUpdate = true;

    }

    requirePipeline( methodName ) {

        if ( this.renderPipeline === null ) {

            throw new Error( `Stage.${ methodName }() needs create({ pipeline: true }).` );

        }

    }

    /**
     * The frame body: advance every registered callback, then draw. Timing is sampled around
     * the whole body so `frameMs` reflects what Sugata costs the main thread, and `fps` is
     * averaged over a short window so the HUD does not flicker on single-frame noise.
     */
    renderFrame( timeMs ) {

        const deltaSeconds = this.lastFrameTimeMs === 0 ? 0 : ( timeMs - this.lastFrameTimeMs ) / 1000;
        this.lastFrameTimeMs = timeMs;

        const startedAtMs = performance.now();

        for ( const callback of this.frameCallbacks ) {

            callback( deltaSeconds, timeMs / 1000 );

        }

        this.draw();

        this.frameMs = performance.now() - startedAtMs;
        this.drawCalls = this.renderer.info.render.drawCalls;
        this.triangles = this.renderer.info.render.triangles;
        this.sampleFrameRate( timeMs );

    }

    /**
     * One image. On the deferred path this must go through `RenderPipeline.render()` rather
     * than `renderer.render()` — the pipeline is what binds the MRT and runs the composite.
     */
    draw() {

        if ( this.renderPipeline !== null ) {

            this.renderPipeline.render();

        } else {

            this.renderer.render( this.scene, this.camera );

        }

    }

    sampleFrameRate( timeMs ) {

        this.framesInWindow ++;

        const windowMs = timeMs - this.windowStartedAtMs;

        if ( windowMs >= FPS_SAMPLE_WINDOW_MS ) {

            this.fps = ( this.framesInWindow * 1000 ) / windowMs;
            this.framesInWindow = 0;
            this.windowStartedAtMs = timeMs;

        }

    }

    /**
     * Presence of `navigator.gpu` is necessary but not sufficient — an adapter request can
     * still fail — so this only decides which backend to *ask* for. The authoritative answer
     * comes from `renderer.backend` after init.
     */
    isWebGPUAvailable() {

        return typeof navigator !== 'undefined' && navigator.gpu !== undefined;

    }

    /**
     * Pins the drawing buffer to an explicit size, ignoring the canvas' CSS box.
     *
     * Two callers need this. A measurement page wants a fixed pixel budget so its numbers mean
     * the same thing on every machine. And an environment with no layout — a hidden browser
     * pane reports `innerWidth` and `clientWidth` as 0 — would otherwise render into a 1x1
     * target and every readback would be meaningless.
     *
     * Pass `null` to go back to following CSS.
     */
    setFixedSize( width, height ) {

        this.fixedSize = width === null ? null : { width, height };
        this.updateViewport();

    }

    /**
     * Matches the drawing buffer to the canvas' CSS box and the current display density.
     * CSS owns layout, so `setSize` is told not to write inline styles back onto the canvas.
     */
    updateViewport() {

        if ( this.renderer === null ) return;

        const width = this.fixedSize !== null ? this.fixedSize.width : ( this.canvas.clientWidth || 1 );
        const height = this.fixedSize !== null ? this.fixedSize.height : ( this.canvas.clientHeight || 1 );

        this.pixelRatio = Math.min( window.devicePixelRatio || 1, this.maxPixelRatio );

        this.renderer.setPixelRatio( this.pixelRatio );
        this.renderer.setSize( width, height, false );

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

    }

    watchViewport() {

        this.resizeObserver = new ResizeObserver( this.updateViewport );
        this.resizeObserver.observe( this.canvas );

        this.watchPixelRatio();

    }

    /**
     * devicePixelRatio changes when the window moves to a display of different density, and
     * that does not necessarily resize the canvas. A media query pinned to the current ratio
     * fires exactly once when it stops being true; we then re-pin it to the new ratio.
     */
    watchPixelRatio() {

        const currentRatio = window.devicePixelRatio || 1;

        this.pixelRatioWatcher = window.matchMedia( `(resolution: ${ currentRatio }dppx)` );
        this.pixelRatioWatcher.addEventListener( 'change', () => {

            if ( this.renderer === null ) return; // disposed while the query was pending

            this.updateViewport();
            this.watchPixelRatio();

        }, { once: true } );

    }

    unwatchViewport() {

        if ( this.resizeObserver !== null ) {

            this.resizeObserver.disconnect();
            this.resizeObserver = null;

        }

        this.pixelRatioWatcher = null;

    }

}
