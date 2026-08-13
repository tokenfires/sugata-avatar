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
 * ## The end of the chain: temporal AA, then the grade
 *
 * `create({ temporalAA: 'traa' | 'taau' })` installs punch-list 3.12, `setAmbientOcclusion()`
 * installs 3.10 and `setGrade()` installs 3.13. All three hang off the deferred path, in this
 * fixed order:
 *
 *     scene pass -> temporal resolve -> ambient occlusion -> composeOutput -> grade
 *                -> tone map + transfer
 *
 * The order is not arbitrary. Temporal AA has to see the raw jittered scene colour, so nothing
 * may blur or bloom ahead of it; 3.10 adds scene-referred light and so has to land before
 * anything that tone-maps or blooms; the grade has to see a resolved image, because bloom applied
 * to a crawling edge blooms the crawl. `renderOutput` (tone map + output transfer) stays last
 * unless the grade says it does that part itself.
 *
 * ⚠️ MSAA and temporal AA are mutually exclusive — `TRAANode` and `TAAUNode` both say so in their
 * own headers, and the mechanism is that MSAA resolves coverage about a pixel centre that the
 * temporal jitter has already moved. `create()` throws rather than let a caller ship the pair.
 *
 * 🚩 `PostProcessing` was renamed to `RenderPipeline` at r183; the old name still exists as a
 * deprecated subclass that emits a `warnOnce`. This file uses `RenderPipeline`.
 */

import {
    ACESFilmicToneMapping,
    PCFShadowMap,
    PerspectiveCamera,
    RenderPipeline,
    Scene,
    SRGBColorSpace,
    WebGPURenderer
} from 'three/webgpu';

import { pass, renderOutput, screenUV, uniform, vec4 } from 'three/tsl';

import { channelDisplayNode, channelGridNode, GBuffer } from './GBuffer.js';
import { createHairOIT, HAIR_OIT_MINIMUM_ATTACHMENT_BYTES, HAIR_OIT_MODES } from './HairOIT.js';
import { installMorphVelocity, MORPH_VELOCITY_MODES, setMorphVelocityMode } from './MorphVelocity.js';
import { createTemporalResolve, TAAU_RESOLUTION_SCALE, TEMPORAL_AA_MODES } from './TRAAPost.js';

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

        // The end of the chain. `temporal` owns a frame of history and two render targets, so it
        // is built once per mode and kept across output-node recompiles — rebuilding it would
        // reset the history every time and the image would never converge.
        this.temporal = null;
        this.ambientOcclusion = null;
        this.grade = null;

        // Punch-list 3.6. `off` for every page that has no groom; the mode is fixed at `create()`
        // because only `wboit` allocates the two extra attachments and an attachment set belongs to
        // the render target the pass was built with. There is deliberately no setter — a page A/B-ing
        // the arms reloads with a different `?oit=`, which is also what makes two judge plates
        // comparable, since every arm then boots through the same code path.
        this.hairOITMode = 'off';
        this.hairOITDefect = null;
        this.hairOIT = null;
        this.multisampled = false;
        this.morphVelocity = 'off';

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
     * @param {boolean} [options.antialias=false] - 4x MSAA on the frame-buffer target.
     *   ⚠️ This is NOT a no-op on the forward path and never was: `Renderer._getFrameBufferTarget`
     *   builds the tone-mapping intermediate with `samples: this.samples`, so a forward,
     *   tone-mapped canvas frame really is multisampled. Measured on `alive.html?bare&freeze` at
     *   900x1200, row y=300, the silhouette edge at x=537-539: with MSAA
     *   `0.7814 -> 0.6747 -> 0.0278` (one intermediate coverage sample), with `?msaa=0`
     *   `0.7921 -> 0.7431 -> 0.0278`. Mutually exclusive with `temporalAA`.
     * @param {'off'|'traa'|'taau'} [options.temporalAA='off'] - Punch-list 3.12. Implies
     *   `pipeline: true`, forbids `antialias`, and — for `taau` — defaults `resolutionScale` to
     *   the 0.66 operating point.
     * @param {?number} [options.sharpness] - RCAS strength for the temporal path, in
     *   `SharpenNode`'s scale (0 maximum, 2 none). `null` removes the pass; omit for the
     *   measured default in `TRAAPost.js`.
     * @param {'off'|'hold'|'exact'} [options.morphVelocity='exact'] - Whether morph targets get a
     *   previous-frame position. three r185 gives them none, which makes a HELD expression report
     *   a large constant motion vector; `render/MorphVelocity.js` has the mechanism and the
     *   measurements. `off` is three's behaviour and exists as the rejection proof. Inert on the
     *   forward path, where nothing binds a velocity attachment.
     * @param {'off'|'blend'|'cutout'|'hash'|'stochastic'|'wboit'} [options.hairOIT='off'] -
     *   Punch-list 3.6/3.21, how hair cards reach the frame buffer. `blend` is the naive control
     *   and is the DEFECT; the other four are order independent. Only `wboit` changes this Stage —
     *   it adds two attachments and one resolve pass and therefore implies `pipeline: true`; the
     *   other modes are entirely properties of the hair material and are recorded here so
     *   `stats.hairOIT` can name the arm a plate was captured on. See `render/HairOIT.js`.
     *   ⚠️ `stochastic` is the shipped arm and its estimate is only integrated by a TEMPORAL
     *   resolve — on `temporalAA: 'off'` it renders a one-sample stipple, which is the arm working
     *   as specified and not a defect. `HairOIT.js`'s ## THE COVERAGE DECISION carries the numbers.
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

        const temporalAA = options.temporalAA ?? 'off';

        if ( TEMPORAL_AA_MODES.includes( temporalAA ) === false ) {

            throw new Error( `Stage: temporalAA must be one of ${ TEMPORAL_AA_MODES.join( ', ' ) }.` );

        }

        // Refused rather than silently resolved, because the pair does not fail loudly: it
        // produces a soft image that still crawls, which reads as "TRAA is not working" and
        // sends the next reader after the wrong file.
        if ( temporalAA !== 'off' && options.antialias === true ) {

            throw new Error( 'Stage: MSAA and temporal AA cannot both be on — TRAANode/TAAUNode ' +
                'jitter the camera, so MSAA would resolve coverage about a moved pixel centre.' );

        }

        this.multisampled = options.antialias === true;

        // Punch-list 3.6. Fixed here and not settable later: only `wboit` allocates `hairAccum` and
        // `hairWeight`, and an attachment set belongs to the render target the pass was built with.
        // A page A/B-ing the four arms reloads with a different `?oit=` — which is also what makes
        // a judge plate honest, since every arm then boots from the same code path.
        this.hairOITMode = options.hairOIT ?? 'off';

        // Carried rather than acted on here: `GBuffer` withholds the pass-level blend modes and the
        // caller's `configureHairMaterial` puts them on the material instead. The two halves have to
        // agree or the "defect" is not the defect. `HairOIT.selftest.mjs` owns it.
        this.hairOITDefect = options.hairOITDefect ?? null;

        if ( this.hairOITMode !== 'off' && HAIR_OIT_MODES.includes( this.hairOITMode ) === false ) {

            throw new Error( `Stage: hairOIT must be 'off' or one of ${ HAIR_OIT_MODES.join( ', ' ) }.` );

        }

        if ( this.hairOITMode === 'wboit' && options.pipeline !== true && ( options.temporalAA ?? 'off' ) === 'off' ) {

            throw new Error( 'Stage: hairOIT "wboit" needs the deferred path — its two accumulation ' +
                'attachments are G-buffer attachments. Pass pipeline: true.' );

        }

        // Installed before any material compiles, because it is a vertex-stage assignment and a
        // material built earlier would keep three's broken previous position for its whole life.
        this.morphVelocity = options.morphVelocity ?? 'exact';

        if ( MORPH_VELOCITY_MODES.includes( this.morphVelocity ) === false ) {

            throw new Error( `Stage: morphVelocity must be one of ${ MORPH_VELOCITY_MODES.join( ', ' ) }.` );

        }

        if ( this.morphVelocity === 'off' ) setMorphVelocityMode( 'off' );
        else installMorphVelocity( this.morphVelocity );

        const wantsWebGPU = options.forceWebGL !== true && this.isWebGPUAvailable();

        // 🚩 The `wboit` arm takes the pass over WebGPU's DEFAULT colour-attachment budget, and the
        // failure is per-pipeline and names the material rather than the attachment set — see
        // `HairOIT.js`'s HAIR_OIT_MINIMUM_ATTACHMENT_BYTES. The limit is raised to the adapter's own
        // maximum rather than to a constant, because a constant would be a guess about hardware
        // this project has never run on, and asking for exactly what the adapter reports cannot be
        // refused. `WebGPUBackend` passes `requiredLimits` straight into `requestDevice` (:243).
        const requiredLimits = { ...( options.requiredLimits ?? {} ) };

        if ( this.hairOITMode === 'wboit' && wantsWebGPU ) {

            await this.raiseColorAttachmentBudget( requiredLimits );

        }

        this.renderer = new WebGPURenderer( {
            canvas,
            antialias: this.multisampled,
            forceWebGL: wantsWebGPU === false,
            trackTimestamp: options.trackTimestamp === true,
            requiredLimits
        } );

        this.renderer.toneMapping = ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = options.toneMappingExposure ?? 1;
        this.renderer.outputColorSpace = SRGBColorSpace;

        // 🚩 THE SHADOW FILTER IS DECIDED HERE, AND IT USED TO BE DECIDED BY NOBODY.
        //
        // `LightingRig.attachTo` sets `shadowMap.enabled` and deliberately does not touch `type`,
        // because the renderer belongs to this file — and until R10 nothing in the repository had
        // an opinion about `type` at all. `grep -n shadow packages/core/src/render/Stage.js`
        // returned nothing, so the whole shadow filter was three's default arriving by omission.
        //
        // That is not a cosmetic field. `ShadowNode.setupShadow` reads
        // `getShadowFilterFn( renderer.shadowMap.type )` and selects the ENTIRE filter from it —
        // `_shadowFilterLib[ type ]`, one of Basic / PCF / PCF-soft / VSM — and THROWS
        // "Shadow map type not supported yet" for a type the WebGPU path has no entry for. The
        // neighbouring field is the cautionary tale: `shadowMap.enabled` defaults to FALSE on this
        // path and `AnalyticLightNode.setupShadow` returns immediately when it is false, which is a
        // rig that builds a perfect caster casting nothing.
        //
        // `PCFShadowMap` IS three's default (`Renderer.js`: `this.shadowMap = { enabled: false,
        // transmitted: false, type: PCFShadowMap }`), so writing it changes no pixel — every plate
        // measured before this line reproduces after it. Writing it changes who is answerable for
        // it: this is now a decision a plate can be attributed to, and a three release that moves
        // the default moves nothing here. The one shadow caster this project can afford costs
        // 2.62 ms, and the filter it is resolved through should not be an accident.
        this.renderer.shadowMap.type = PCFShadowMap;

        await this.renderer.init();

        // Read the backend back rather than trusting the request: Renderer.init() swaps in a
        // WebGL2 backend if adapter acquisition throws, and the caller needs to know.
        this.backendName = this.renderer.backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';

        if ( this.hairOITMode === 'wboit' ) this.requireIndependentBlending();

        this.camera = new PerspectiveCamera(
            options.fieldOfView ?? 35,
            1,
            options.near ?? 0.01,
            options.far ?? 100
        );

        // Temporal AA is a deferred-path effect — it needs the velocity attachment and the depth
        // texture the G-buffer pass owns — so asking for it is enough to ask for the pipeline.
        const wantsPipeline = options.pipeline === true || temporalAA !== 'off';

        if ( wantsPipeline ) {

            const defaultScale = temporalAA === 'taau' ? TAAU_RESOLUTION_SCALE : 1;

            this.buildPipeline( options.resolutionScale ?? defaultScale );

            // Between the pass and the resolve, in that order and for a reason: the two OIT
            // attachments have to exist before the composite can sample them, and the composite
            // has to exist before the temporal resolve can be built on top of it.
            if ( this.hairOITMode === 'wboit' ) {

                this.hairOIT = createHairOIT( { gbuffer: this.gbuffer, resolutionScale: this.resolutionScale } );

            }

            if ( temporalAA !== 'off' ) this.setTemporalAA( temporalAA, { sharpness: options.sharpness } );
            else this.refreshOutputNode();

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

        // The OIT resolve reads the scene pass's attachments at their own texel centres, so it has
        // to be exactly the same size. `TAAUNode` also reads the input dimensions off this node
        // (`:398`), so a mismatch here is a mis-scaled upscale rather than a visible tear.
        this.hairOIT?.setResolutionScale( scale );

    }

    /**
     * Switches temporal antialiasing on, off, or between its two forms (punch-list 3.12).
     *
     * `taau` does not change the resolution by itself — `setResolutionScale` is a separate,
     * explicit decision, because a caller measuring cost wants to move one thing at a time.
     * `create({ temporalAA: 'taau' })` sets the 0.66 operating point for you.
     *
     * @param {'off'|'traa'|'taau'} mode
     * @param {Object} [options]
     * @param {?number} [options.sharpness] - RCAS strength passed through to `TRAAPost`.
     */
    setTemporalAA( mode, options = {} ) {

        this.requirePipeline( 'setTemporalAA' );

        if ( TEMPORAL_AA_MODES.includes( mode ) === false ) {

            throw new Error( `Stage: temporalAA must be one of ${ TEMPORAL_AA_MODES.join( ', ' ) }.` );

        }

        if ( mode !== 'off' && this.multisampled ) {

            throw new Error( 'Stage: cannot enable temporal AA on a renderer built with MSAA.' );

        }

        if ( this.temporal !== null ) {

            this.temporal.dispose();
            this.temporal = null;

        }

        if ( mode !== 'off' ) {

            this.temporal = createTemporalResolve( {
                mode,
                gbuffer: this.gbuffer,
                camera: this.camera,
                sharpness: options.sharpness,

                // The groom reaches the temporal filter already composited, so hair is antialiased
                // by the same resolve as everything else. `null` on every page without a groom.
                beauty: this.hairOIT === null ? null : this.hairOIT.beautyNode
            } );

        }

        this.refreshOutputNode();

    }

    /**
     * Installs punch-list 3.10 — GTAO, bent normals and specular occlusion — between the temporal
     * resolve and the grade.
     *
     * That slot is not negotiable in either direction. It has to be AFTER the resolve because the
     * effect's own dither is a spatial pattern the resolve would otherwise be asked to treat as
     * scene detail, and because handing `TAAUNode` a computed node instead of a texture costs a
     * full-resolution copy pass every frame (see `TRAAPost.js`). It has to be BEFORE the grade
     * because bloom applied to an unoccluded crease blooms light that is not there.
     *
     * ⚠️ **The effect OWNS the ambient term when it is installed.** It re-evaluates the hemisphere
     * per pixel through the bent normal, so `LightingRig` must be built with `ambient: false` on
     * the same page. Installing it against a rig that still has its `HemisphereLight` attached
     * does not fail — it renders the ambient twice, which looks like a lift and not like a bug.
     *
     * @param {?{ compose: function, dispose: function }} effect - from
     *   `createGroundTruthOcclusion`. `null` removes it.
     */
    setAmbientOcclusion( effect ) {

        this.requirePipeline( 'setAmbientOcclusion' );

        if ( this.ambientOcclusion !== null && this.ambientOcclusion !== effect ) {

            this.ambientOcclusion.dispose();

        }

        this.ambientOcclusion = effect;
        this.refreshOutputNode();

    }

    /**
     * Installs the grade (punch-list 3.13) at the very end of the chain.
     *
     * A grade object supplies `compose( gbuffer, colourNode )` and a boolean
     * `appliesOutputTransform`. When it is true this Stage does NOT wrap the result in
     * `renderOutput` — the grade has tone-mapped and encoded it already, which is what a grade
     * that adds film grain has to do, because grain is a display-referred quantity and 1/255 of
     * signal means nothing in a linear HDR buffer.
     *
     * @param {?{ compose: function, appliesOutputTransform: boolean }} grade - `null` removes it.
     */
    setGrade( grade ) {

        this.requirePipeline( 'setGrade' );

        this.grade = grade;
        this.refreshOutputNode();

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
            msaa: this.multisampled,
            temporalAA: this.temporal === null ? 'off' : this.temporal.mode,
            ambientOcclusion: this.ambientOcclusion === null ? 'off' : this.ambientOcclusion.quality,
            hairOIT: this.hairOITMode,
            morphVelocity: this.morphVelocity,
            graded: this.grade !== null,
            resolutionScale: this.resolutionScale,
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

        if ( this.temporal !== null ) {

            this.temporal.dispose();
            this.temporal = null;

        }

        if ( this.ambientOcclusion !== null ) {

            this.ambientOcclusion.dispose();
            this.ambientOcclusion = null;

        }

        if ( this.hairOIT !== null ) {

            this.hairOIT.dispose();
            this.hairOIT = null;

        }

        this.grade = null;
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
        this.gbuffer = new GBuffer( this.scenePass, {
            hairOIT: this.hairOITMode === 'wboit',
            hairOITDefect: this.hairOITDefect
        } );

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

            // scene pass -> temporal resolve -> ambient occlusion -> composeOutput -> grade ->
            // tone map + transfer. Nothing may blur or bloom before the temporal resolve; see the
            // file header, and `setAmbientOcclusion` for why 3.10 sits where it does.
            // Without a temporal resolve the OIT composite IS the scene colour; with one, the
            // resolve was already built on top of it (`setTemporalAA`) and re-inserting it here
            // would composite the groom twice.
            const sceneColour = this.hairOIT === null ? gbuffer.node( 'output' ) : this.hairOIT.beautyNode;

            let colour = this.temporal === null ? sceneColour : this.temporal.node;

            if ( this.ambientOcclusion !== null ) colour = this.ambientOcclusion.compose( gbuffer, colour );

            if ( this.composeOutput !== null ) colour = this.composeOutput( gbuffer, colour );

            if ( this.grade !== null ) {

                const graded = this.grade.compose( gbuffer, colour );

                this.renderPipeline.outputNode = this.grade.appliesOutputTransform === true
                    ? graded
                    : renderOutput( graded );

            } else {

                this.renderPipeline.outputNode = renderOutput( colour );

            }

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
     * Refuses the `wboit` arm on a backend that cannot give each attachment its own blend state.
     *
     * 🚩 **The failure this prevents is silent and it produces a plausible picture.** Weighted-blended
     * OIT is two attachments with two DIFFERENT blend functions — additive on the sums, multiplicative
     * on the revealage. Given one blend for both, the accumulation buffer still fills, the resolve
     * still divides, and the groom still renders; it is simply wrong, and wrong in a way that looks
     * like a shading choice.
     *
     * Two backends, two mechanisms, both source-verified at r185:
     *
     *   - **WebGPU in compatibility mode.** `WebGPUPipelineUtils.js` checks
     *     `this.backend.compatibilityMode !== true` before it consults the MRT at all, and otherwise
     *     `warnOnce`s and applies the material's blending to every target. `compatibilityMode` is
     *     itself derived — `WebGPUBackend.js` sets it from `! device.features.has(
     *     'core-features-and-limits' )` — so it is a property of the adapter and not of a flag we
     *     pass.
     *   - **WebGL2.** `WebGLState.setMRTBlending()` returns early with the same warning unless
     *     `OES_draw_buffers_indexed` is present (`WebGLBackend.js:272`).
     *
     * ⚠️ **And this is the half of punch-list 3.6 that the measurements corrected.** 3.6 reads
     * "weighted-blended on WebGL2, tile-binned on WebGPU". It is the other way round: weighted
     * blended is the arm that needs the MORE capable backend, because it is the one that needs
     * independent per-attachment blending, and WebGL2 is where it is least likely to be available.
     * A `warnOnce` in a console is not a fallback, so this throws.
     */
    requireIndependentBlending() {

        if ( this.backendName === 'webgl2' ) {

            const gl = this.renderer.backend.gl;
            const indexed = gl?.getExtension?.( 'OES_draw_buffers_indexed' ) ?? null;

            if ( indexed === null ) {

                throw new Error( 'Stage: the hair "wboit" arm needs per-attachment blending, and this ' +
                    'WebGL2 context has no OES_draw_buffers_indexed. three would apply one blend to ' +
                    'both accumulation targets and warn once, which is a wrong picture rather than a ' +
                    'downgrade. Use hairOIT: "hash".' );

            }

            return;

        }

        if ( this.renderer.backend.compatibilityMode === true ) {

            throw new Error( 'Stage: the hair "wboit" arm needs per-attachment blending, and this ' +
                'WebGPU device came up in compatibility mode (no core-features-and-limits), where ' +
                'WebGPUPipelineUtils applies the material blending to every render target. ' +
                'Use hairOIT: "hash".' );

        }

    }

    /**
     * Asks this machine's adapter for its whole colour-attachment budget, so the seven-attachment
     * G-buffer the `wboit` arm needs can be bound at all.
     *
     * The adapter is requested here and then requested AGAIN inside `WebGPUBackend.init()`, which
     * looks wasteful and is deliberate: three does not expose the adapter it chose, and the
     * alternative is creating the device ourselves and handing it over, which would also make this
     * file responsible for every feature `WebGPUBackend.js:227–242` enumerates. Two adapter requests
     * cost microseconds and one of them is the honest question "what can this machine do".
     *
     * A refusal is loud and names the reason. An adapter at the spec floor of 32 cannot run the arm,
     * and a viewer meeting that as a black frame with seven pipeline-creation errors would go
     * looking in the material.
     */
    async raiseColorAttachmentBudget( requiredLimits ) {

        const adapter = await navigator.gpu.requestAdapter( { featureLevel: 'compatibility' } );

        const available = adapter?.limits?.maxColorAttachmentBytesPerSample ?? 0;

        if ( available < HAIR_OIT_MINIMUM_ATTACHMENT_BYTES ) {

            throw new Error( 'Stage: this adapter reports maxColorAttachmentBytesPerSample ' +
                `${ available }, and the hair "wboit" arm needs at least ` +
                `${ HAIR_OIT_MINIMUM_ATTACHMENT_BYTES } for the seven-attachment G-buffer. ` +
                'Use hairOIT: "hash" or "cutout", which need no attachments at all.' );

        }

        requiredLimits.maxColorAttachmentBytesPerSample = available;

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
