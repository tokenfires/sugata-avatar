/**
 * Stage — the renderer, the scene graph root, and the frame loop.
 *
 * Everything else in Sugata draws into a Stage. It exists so that no other module has to
 * know which GPU backend is live, how the canvas is sized, or when a frame happens.
 *
 * Backend policy (see docs/research/rendering-stack.md): we author against WebGPU + TSL and
 * treat WebGL2 as a degraded fallback tier, not a co-equal backend. WebGPURenderer already
 * falls back internally when adapter acquisition fails, but callers still need to know which
 * backend actually came up — quality tiers, TRAA and the hair OIT path all branch on it — so
 * `stats.backend` reports the truth read back off the renderer after initialisation.
 */

import {
    ACESFilmicToneMapping,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace,
    WebGPURenderer
} from 'three/webgpu';

const MAX_PIXEL_RATIO = 2;
const FPS_SAMPLE_WINDOW_MS = 500;

export class Stage {

    constructor() {

        this.renderer = null;
        this.scene = new Scene();
        this.camera = null;
        this.canvas = null;

        this.frameCallbacks = [];

        // Sizing state. We re-read devicePixelRatio on every viewport update rather than
        // caching it, because dragging a window between a Retina and an external display
        // changes it without changing the CSS pixel size of the canvas.
        this.maxPixelRatio = MAX_PIXEL_RATIO;
        this.pixelRatio = 1;
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
     * @returns {Promise<Stage>}
     */
    async create( canvas, options = {} ) {

        this.canvas = canvas;
        this.maxPixelRatio = options.maxPixelRatio ?? MAX_PIXEL_RATIO;

        const wantsWebGPU = options.forceWebGL !== true && this.isWebGPUAvailable();

        this.renderer = new WebGPURenderer( {
            canvas,
            antialias: options.antialias === true,
            forceWebGL: wantsWebGPU === false
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
     * Live counters for the HUD and for the quality-tier logic that picks a rendering
     * budget from measured frame cost.
     */
    get stats() {

        return {
            backend: this.backendName,
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

        // Renderer.dispose() stops its own animation loop, so we do not stop it twice.
        if ( this.renderer !== null ) {

            this.renderer.dispose();
            this.renderer = null;

        }

        this.backendName = 'disposed';

    }

    // --- helpers -----------------------------------------------------------------------

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

        this.renderer.render( this.scene, this.camera );

        this.frameMs = performance.now() - startedAtMs;
        this.drawCalls = this.renderer.info.render.drawCalls;
        this.triangles = this.renderer.info.render.triangles;
        this.sampleFrameRate( timeMs );

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
     * Matches the drawing buffer to the canvas' CSS box and the current display density.
     * CSS owns layout, so `setSize` is told not to write inline styles back onto the canvas.
     */
    updateViewport() {

        if ( this.renderer === null ) return;

        const width = this.canvas.clientWidth || 1;
        const height = this.canvas.clientHeight || 1;

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
