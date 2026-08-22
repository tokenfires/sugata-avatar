/**
 * strand-spike.js — an ISOLATED prototype that answers one question and refuses every other:
 * what does it cost THIS stack to raster and shade many thin camera-facing ribbons?
 *
 * ## Why this page exists
 *
 * The only strand-cost figure on this project's record is frostbitten's ~3.3 ms `HairFinePass` on
 * an RTX 3060, which on this machine ablates to 0.695 ms at 720x900 — and that number is the cost
 * of their COMPUTE SOFTWARE RASTERIZER (8 px tiles x 32 depth bins, per-pixel linked lists), a
 * transparency architecture this project would not adopt. The closest analogue to what we would
 * actually build is their HARDWARE hair raster plus `hairShading`, ablated here at 0.858 ms of a
 * 4.319 ms frame. Our own CARD groom costs +1.46 to +1.71 ms p50 on our own stack.
 *
 * 🎯 **SO THE ANALOGUE SAYS STRANDS MAY BE CHEAPER THAN OUR CARDS, AND THIS PAGE IS WHAT TURNS
 * THAT ANALOGUE INTO OUR OWN NUMBER** — our three r185 stack, our `HairMaterial`, our lighting rig,
 * our coverage decision, our resolve.
 *
 * ## 🔴 THIS FILE DOES NOT TIME ITSELF AND MUST NOT BE TIMED CASUALLY
 *
 * This machine has been shown to swing 6.3x on an IDENTICAL fixed workload purely from other
 * agents running (0.01785 ms against 0.11228 ms in one session). `?gputime=1` is wired and
 * `__STRAND_GPU_MS__()` resolves the RENDER pool, but a reading taken while anything else is on
 * this GPU is not data, it is a picture of the contention. The timings belong to a separate
 * serialised phase with exclusive access; `tools/critic/strand-spike.mjs --probe` deliberately
 * takes none.
 *
 * ## What is here, and what is deliberately absent
 *
 * Here:
 *   - camera-facing ribbons, one per strand, expanded in the VERTEX stage through `positionNode`
 *     (`position ± (width/2) · normalize(cross(tangent, viewDir))`), which is the same hook the
 *     shipped path already uses for `dynamics.positionNode`;
 *   - a `.tfx` loader for the files `tools/figure-pipeline/tfx_export.py` writes;
 *   - OUR `HairMaterial`, unmodified, with its Karis lobes reading a GEOMETRIC fibre tangent;
 *   - analytic across-ribbon coverage — frostbitten's `alpha = 1 − |u·2 − 1|` — resolved by our
 *     shipped `alphaHash` through `configureHairMaterial`.
 *
 * Absent, on purpose, because every extra system makes the number less attributable:
 *   - no dynamics, no skinning, no OIT rewrite, no LOD, no strand atlas, no mip chain;
 *   - 🚩 **no `strandTangentJitter`, and it is not switched off — it does not exist here.** That
 *     subsystem statistically reinstates the tangent variance the mip chain deletes from
 *     `flow.png` (hair.md §10.1, amplitude 13.8 degrees). A ribbon has no flow sheet and no mip
 *     chain: its tangent is geometry, sampled from the file. The whole subsystem deletes itself,
 *     which is what `?tangent=geometric` (the default) means. It is reachable only through
 *     `?tangent=derivative`, which exists as the control — see `RibbonHairLightingModel`.
 *
 * ## The one place this page reaches into `HairMaterial` rather than around it
 *
 * `HairMaterial.js` is not edited by this spike and must not be. But its private
 * `strandTangentNode` derives the fibre tangent from the CARD's UV parameterisation through
 * screen-space derivatives, and on a primitive that is one pixel wide a 2x2 derivative quad
 * straddles different ribbons and open background. Reusing that expression on ribbons would
 * re-import the card's weakness into the measurement of the thing meant to replace it.
 *
 * So the tangent is injected the way the class already allows: `HairLightingModel.strandTangent()`
 * is a METHOD, `HairLightingModel` is exported, and `HairNodeMaterial.setupLightingModel()` is
 * overridden per instance. Nothing in `packages/core` changes. `?tangent=derivative` runs the
 * shipped expression instead, so the difference between a geometric tangent and a derived one is
 * a query key on one build rather than an argument.
 *
 * ## Query keys
 *
 *   ?strands=496|992|2480|4960|11408|24800   which exported groom. Default 11408 (frostbitten's
 *                          own 11,400 is the comparison the spike wants).
 *   ?tfxurl=<url>          explicit override. Without it the page asks for `/tfx/<name>.tfx`,
 *                          which ONLY the critic driver serves — see the driver's header.
 *   ?width=<metres>        full ribbon width in world metres. Default 0.0012, which is twice
 *                          frostbitten's `fiberRadius: 0.0006` (their value is a HALF width —
 *                          `hwRasterizeHair.wgsl.ts:40` offsets ±`fiberRadius`).
 *   ?tangent=geometric|derivative     see above. Default geometric.
 *   ?coverage=analytic|opaque         `opaque` forces alpha to 1 and the cutoff to 0, so a
 *                          silhouette measurement reads geometry rather than a hash. It is the
 *                          instrument for the width probe and is not a rendering arm.
 *   ?oit=hash|stochastic|cutout|blend|wboit   passed to `configureHairMaterial`. Default `hash`,
 *                          which is the arm this spike was asked for; note that
 *                          `HAIR_OIT_DEFAULT_MODE` is `stochastic`.
 *   ?probe=beauty|strandid  `strandid` swaps the hair material for a flat per-strand identity
 *                          write, so the strand count IN THE FRAME can be counted rather than
 *                          assumed from the file.
 *   ?azimuth=<degrees>     orbits the camera about the subject's vertical axis. The camera-facing
 *                          proof is that a ribbon's rendered FOOTPRINT does not change with this.
 *   ?strandlimit=<n>       draw only the first n strands. The footprint probe needs a primitive it
 *                          can attribute a pixel to, and 11,408 overlapping ribbons is not that.
 *   ?w= ?h=                drawing buffer, in DEVICE pixels. Default 720x900.
 *   ?shadows=1             build the rig's shadow caster. OFF by default: a shadow pass draws the
 *                          ribbons a second time, which is a real cost and a DIFFERENT one.
 *   ?aa=off|traa|taau      the shipped temporal resolve, which is the OTHER half of the coverage
 *                          decision — a hashed alpha is an unbiased estimator that has to be
 *                          INTEGRATED by something downstream, and on this project that something
 *                          is `render/TRAAPost.js`. 🚩 OFF BY DEFAULT AND THAT IS NOT A DEFAULT
 *                          ABOUT LOOK: turning it on brings the whole five-attachment G-buffer and
 *                          a velocity channel with it, and a raster-and-shade number measured
 *                          through those is measuring them too. Run the timing arms at `off`;
 *                          run `taau` to see the coverage decision resolve.
 *   ?frames=<n>            how many frames to render before the page reports ready. 1 with no
 *                          temporal resolve, 32 with one — a history has to be built before a
 *                          plate of it means anything.
 *   ?gputime=1             request GPU timestamps. Read them with `__STRAND_GPU_MS__()`, and read
 *                          the paragraph above first.
 *
 * The page renders on demand — there is no animation loop — so nothing is running while a
 * measurement is not being taken.
 */

import {
    ACESFilmicToneMapping,
    Box3,
    BufferAttribute,
    BufferGeometry,
    Color,
    LinearSRGBColorSpace,
    Mesh,
    MeshBasicNodeMaterial,
    NoToneMapping,
    PerspectiveCamera,
    RenderPipeline,
    Scene,
    Sphere,
    SRGBColorSpace,
    TimestampQuery,
    Vector3,
    WebGPURenderer
} from 'three/webgpu';

import {
    attribute,
    cameraPosition,
    cross,
    float,
    floor,
    length,
    mix,
    modelViewMatrix,
    modelWorldMatrixInverse,
    normalize,
    pass,
    positionGeometry,
    positionViewDirection,
    renderOutput,
    smoothstep,
    uniform,
    uv,
    vec3,
    vec4
} from 'three/tsl';

import { createHairMaterial, HairLightingModel } from '../../packages/core/src/material/HairMaterial.js';
import {
    buildRibbonGeometry,
    DEFAULT_RIBBON_WIDTH_METRES,
    loadTfx,
    ribbonNodes,
    RibbonHairLightingModel,
    TFX_FLOATS_PER_POINT
} from '../../packages/core/src/material/HairRibbons.js';
import { GBuffer } from '../../packages/core/src/render/GBuffer.js';
import { configureHairMaterial, HAIR_OIT_MODES } from '../../packages/core/src/render/HairOIT.js';
import { LightingRig } from '../../packages/core/src/render/LightingRig.js';
import {
    createTemporalResolve,
    TAAU_RESOLUTION_SCALE,
    TEMPORAL_AA_MODES
} from '../../packages/core/src/render/TRAAPost.js';


// --- the spike page's own framing -----------------------------------------------------------------
//
// ⚠️ THESE ARE THE PAGE'S, NOT THE RIBBON'S. They travelled to `HairRibbons.js` with the extraction
// and came straight back: a camera field of view and a default viewport are properties of THIS
// harness, and a shipping page that consumes ribbons brings its own camera. Only the two constants
// that describe a RIBBON — its default width, and the file's floats per point — stayed in the core
// module and are imported above. An extraction that drags the caller's framing along with the thing
// being extracted has not found the seam, it has just moved the wall.

const DEFAULT_WIDTH_PIXELS = 720;
const DEFAULT_HEIGHT_PIXELS = 900;

/** Vertical field of view, matching `hair.js`'s own groom page so two plates frame alike. */
const CAMERA_FOV_DEGREES = 38;

/** How much taller than the subject the frame is. 1.06 leaves a hair's breadth of margin. */
const FRAMING_MARGIN = 1.06;


// --- the ribbon core ------------------------------------------------------------------------------
//
// 🚩 MOVED TO `packages/core/src/material/HairRibbons.js` AND IMPORTED, NOT COPIED. The loader, the
// geometry builder, the ribbon lighting model and its node set were written here and now have a
// second consumer: `alive.html` needs the identical primitive inside the shipped deferred stack to
// close R31's frame-budget comparand. Two copies that each decide independently would drift, which
// is the failure `assets/hair/manifest.json`'s own header warns about — so this spike consumes the
// same module the page does, and a change to the ribbon is a change to both by construction.

// --- the page ------------------------------------------------------------------------------------

function queryNumber( query, key, fallback ) {

    if ( query.has( key ) === false ) return fallback;

    const value = Number( query.get( key ) );

    if ( Number.isFinite( value ) === false ) {

        throw new Error( `strand-spike: ?${ key }=${ query.get( key ) } is not a number.` );

    }

    return value;

}

/**
 * Where the camera goes so the groom fills the frame.
 *
 * Derived from the groom's own bounds rather than from a constant, for `hair.js`'s reason: a
 * number typed here would be wrong the first time the density or the style changed, and every
 * plate this spike produces has to be framed identically across six strand counts of the SAME
 * groom. Both axes are solved and the larger distance wins, so a portrait frame does not crop a
 * wide groom.
 */
function frameCamera( bounds, aspect, fovDegrees, margin ) {

    const size = bounds.getSize( new Vector3() );
    const centre = bounds.getCenter( new Vector3() );

    const halfFov = ( fovDegrees * Math.PI / 180 ) / 2;
    const verticalDistance = ( size.y * margin / 2 ) / Math.tan( halfFov );
    const horizontalDistance = ( Math.max( size.x, size.z ) * margin / 2 ) / ( Math.tan( halfFov ) * aspect );

    return { centre, size, distance: Math.max( verticalDistance, horizontalDistance ) };

}

/**
 * Expected on-screen width, in device pixels, of a world-space width `w` at view depth `d`.
 *
 * `2 · d · tan(fovY/2)` is the world height the frustum spans at that depth, so `h / that` is
 * pixels per metre. Stated as a function rather than inline because it is the PREDICTION the
 * width probe is measured against, and a prediction buried in a driver is a prediction nobody
 * can check.
 */
export function expectedScreenWidthPixels( widthMetres, viewDepthMetres, fovDegrees, heightPixels ) {

    const spanMetres = 2 * viewDepthMetres * Math.tan( ( fovDegrees * Math.PI / 180 ) / 2 );

    return widthMetres * heightPixels / spanMetres;

}


async function main() {

    const query = new URLSearchParams( location.search );
    const hud = document.getElementById( 'hud' );

    // 🚩 `?strands=` NAMES A FILE; IT DOES NOT ASSERT A COUNT. This used to be validated against a
    // hardcoded list of the six densities that existed when the spike was written, which then
    // refused 3,840 and 8,832 — `crop01`'s densities, and the counts R31's parity figure was
    // measured at. A whitelist of generated artefacts goes stale the first time the generator runs.
    // The `.tfx` header declares `numHairStrands`, so the count is read from the file below and
    // reported by `describe()`; a typo yields a 404 rather than a list that has to be maintained.
    const strands = queryNumber( query, 'strands', 11408 );
    const tfxUrl = query.get( 'tfxurl' ) ?? `/tfx/strands-${ strands }.tfx`;
    const widthMetres = queryNumber( query, 'width', DEFAULT_RIBBON_WIDTH_METRES );
    const widthPixels = queryNumber( query, 'w', DEFAULT_WIDTH_PIXELS );
    const heightPixels = queryNumber( query, 'h', DEFAULT_HEIGHT_PIXELS );
    const azimuthDegrees = queryNumber( query, 'azimuth', 0 );
    const strandLimit = Math.min( queryNumber( query, 'strandlimit', Infinity ), strands );
    const geometricTangent = ( query.get( 'tangent' ) ?? 'geometric' ) === 'geometric';
    const coverageMode = query.get( 'coverage' ) ?? 'analytic';
    const probe = query.get( 'probe' ) ?? 'beauty';
    const oitMode = query.get( 'oit' ) ?? 'hash';
    const shadows = query.get( 'shadows' ) === '1';
    const timing = query.get( 'gputime' ) === '1';
    const temporalMode = query.get( 'aa' ) ?? 'off';

    if ( TEMPORAL_AA_MODES.includes( temporalMode ) === false ) {

        throw new Error( `strand-spike: ?aa=${ temporalMode } is not one of ` +
            `${ TEMPORAL_AA_MODES.join( ', ' ) }.` );

    }

    // A temporal resolve holds a history and jitters the camera on a 32-entry Halton sequence, so
    // one frame of it is a picture of an empty history rather than of the filter. 32 is that
    // sequence's own period (`TRAAPost.HALTON_JITTER_PERIOD` is 31, and the node's table is 32),
    // which is the shortest number of frames after which every jitter offset has been visited once.
    const frames = queryNumber( query, 'frames', temporalMode === 'off' ? 1 : 32 );

    if ( HAIR_OIT_MODES.includes( oitMode ) === false ) {

        throw new Error( `strand-spike: ?oit=${ oitMode } is not one of ${ HAIR_OIT_MODES.join( ', ' ) }.` );

    }

    const tfx = await loadTfx( tfxUrl );
    const ribbon = buildRibbonGeometry( tfx );
    const nodes = ribbonNodes( widthMetres );

    const canvas = document.getElementById( 'stage' );
    canvas.width = widthPixels;
    canvas.height = heightPixels;

    // 🚩 `antialias: false`, and it is not a saving. MSAA is mutually exclusive with the hashed
    // coverage this spike measures — `configureHairMaterial`'s `stochastic` branch refuses the
    // pair outright, and on the `hash` arm an MSAA resolve would average a stochastic test into
    // something that is no longer an unbiased estimator of coverage while still looking fine.
    const renderer = new WebGPURenderer( {
        canvas, antialias: false, alpha: false, trackTimestamp: timing
    } );
    renderer.setPixelRatio( 1 );
    renderer.setSize( widthPixels, heightPixels, false );
    await renderer.init();

    // 🚩 `autoReset` IS OFF BECAUSE THIS PAGE HAS NO ANIMATION LOOP AND THE COUNTERS ARE STILL BEING
    // CLEARED BY ONE. `Animation.js:75` resets `renderer.info` from requestAnimationFrame, and
    // `Renderer.init` starts that internal animation whether or not a caller ever passes a callback
    // — so a rAF tick between the render and the read wipes `render.triangles` to zero. Measured:
    // every plate reported 0 triangles for a frame that visibly drew hundreds of thousands. The
    // census resets manually instead, immediately before the draw it is counting.
    renderer.info.autoReset = false;

    const scene = new Scene();
    scene.background = new Color( 0x000000 );

    const camera = new PerspectiveCamera( CAMERA_FOV_DEGREES, widthPixels / heightPixels, 0.02, 20 );

    const framing = frameCamera( ribbon.bounds, widthPixels / heightPixels,
        CAMERA_FOV_DEGREES, FRAMING_MARGIN );

    const azimuth = azimuthDegrees * Math.PI / 180;
    camera.position.set(
        framing.centre.x + Math.sin( azimuth ) * framing.distance,
        framing.centre.y,
        framing.centre.z + Math.cos( azimuth ) * framing.distance
    );
    camera.lookAt( framing.centre );
    camera.updateMatrixWorld();

    // --- the material -----------------------------------------------------------------------
    //
    // No flow sheet and no depth sheet: both are CARD artefacts. `flowMapUrl: null` is what makes
    // the shipped `strandTangentNode` fall back to the card's own ∂P/∂v with no per-texel rotation,
    // and it is also what would delete the root occlusion — which `RibbonHairLightingModel` puts
    // back on the ribbon's own parameter instead. `depthMapUrl: null` makes slide 44's exponential
    // a constant 1; there is no within-bundle depth to sample without a bundle.
    //
    // 🚩 `strandTangentJitter: 0` IS NOT "THE SUBSYSTEM SWITCHED OFF" — the geometric arm never
    // calls `strandTangentNode` at all, so the expression is not in the emitted shader. The zero is
    // here so the `?tangent=derivative` CONTROL is a control: it isolates the derivative frame,
    // with no statistical reinstatement of variance a ribbon never lost, exactly as hair.md §10.1
    // says that subsystem exists to do for a mip chain this spike does not have.
    const material = await createHairMaterial( {
        flowMapUrl: null,
        depthMapUrl: null,
        multisampled: false,
        settings: { strandTangentJitter: 0 }
    } );

    material.name = 'sugata.strand-spike.hair';

    material.positionNode = nodes.positionNode;

    // Karis' fake normal, rebuilt from the ribbon's tangent. `createHairMaterial` already assigned
    // this expression from `strandTangentNode`; the formula is copied unchanged and only the
    // tangent differs, so the G-buffer normal and the lit tangent stay the same vector.
    const tangentForNormal = geometricTangent ? nodes.tangentView : null;

    if ( tangentForNormal !== null ) {

        material.normalNode = normalize( positionViewDirection.sub(
            tangentForNormal.mul( tangentForNormal.dot( positionViewDirection ) ) ) );

    }

    material.setupLightingModel = () => new RibbonHairLightingModel( material.hair, {
        tangentView: nodes.tangentView,
        geometric: geometricTangent
    } );

    // The lobes carry the colour; `colorNode` is the G-buffer's diffuse guide and mirrors what
    // `createHairMaterial` does when it is handed an alpha map. The alpha rides `opacityNode`
    // instead, which `NodeMaterial.setupDiffuseColor` multiplies into `diffuseColor.a` — the same
    // product, kept in the channel that names what it is.
    material.colorNode = vec4( material.hair.baseColour, 1 );
    material.opacityNode = coverageMode === 'opaque' ? float( 1 ) : nodes.coverage;

    if ( coverageMode === 'opaque' ) {

        // The silhouette instrument: solid ribbons, no hash, no cutoff, so a measured pixel width
        // is the rasteriser's coverage of the quad and nothing else. `?? 0.5` in
        // `configureHairMaterial` keeps an explicit 0 — it is a nullish coalesce, not an or.
        configureHairMaterial( material, 'cutout', { alphaTest: 0 } );

    } else {

        configureHairMaterial( material, oitMode, { alphaToCoverage: false } );

    }

    // --- the strand-identity probe ------------------------------------------------------------
    //
    // 🎯 THE COUNT IN THE FRAME IS NOT THE COUNT IN THE FILE, AND ONLY A RENDER CAN SAY WHICH.
    // A strand can be in the buffer and outside the frustum, or behind another strand, or too thin
    // at this width to win a single pixel. So this arm writes the file's own strand index into the
    // colour attachment and the driver counts the distinct values it gets back.
    //
    // `strand + 1` because the clear is black and 0 is a real strand index. Little-endian base 256
    // over three channels reaches 16,777,215, which is 676x the largest export.
    const identity = attribute( 'strandId', 'float' ).add( 1 );
    const high = floor( identity.div( 65536 ) );
    const middle = floor( identity.sub( high.mul( 65536 ) ).div( 256 ) );
    const low = identity.sub( high.mul( 65536 ) ).sub( middle.mul( 256 ) );

    const identityMaterial = new MeshBasicNodeMaterial();
    identityMaterial.name = 'sugata.strand-spike.identity';
    identityMaterial.positionNode = nodes.positionNode;
    identityMaterial.colorNode = vec3( low.div( 255 ), middle.div( 255 ), high.div( 255 ) );
    identityMaterial.side = material.side;
    identityMaterial.toneMapped = false;

    const drawn = probe === 'strandid' ? identityMaterial : material;

    // ⚠️ The identity arm needs its bytes back UNTOUCHED. ACES on a code-value payload is not a
    // grade, it is corruption, and an sRGB transfer on the way out would land 1/255 on 5/255.
    if ( probe === 'strandid' ) {

        renderer.toneMapping = NoToneMapping;
        renderer.outputColorSpace = LinearSRGBColorSpace;

    } else {

        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.outputColorSpace = SRGBColorSpace;

    }

    const mesh = new Mesh( ribbon.geometry, drawn );
    mesh.name = 'strand-ribbons';

    // 🚩 IDENTITY TRANSFORM, AND `ribbonNodes` DEPENDS ON IT BEING CHEAP RATHER THAN ON IT BEING
    // IDENTITY. `modelWorldMatrixInverse` does the local/world conversion properly either way; what
    // matters is that nothing here moves the groom, so two plates of two densities are of the same
    // scene. `frustumCulled` is left ON — the bounding box is the centreline's, so it is grown by
    // half a width to cover the expansion the vertex stage adds.
    ribbon.geometry.boundingBox.expandByScalar( widthMetres / 2 );
    ribbon.geometry.boundingBox.getBoundingSphere( ribbon.geometry.boundingSphere );

    // 🎯 `?strandlimit=` IS THE PROBE'S INSTRUMENT AND NOT AN LOD. The geometry is strand-major and
    // so is the index buffer, so the first n strands are the first n·(points−1)·6 indices — one
    // `setDrawRange` and no second buffer, which means the probe measures the SAME vertices the
    // full plate does rather than a rebuilt approximation of them.
    if ( Number.isFinite( strandLimit ) ) {

        ribbon.geometry.setDrawRange( 0, strandLimit * ( tfx.pointsPerStrand - 1 ) * 6 );

    }

    scene.add( mesh );

    // --- the rig ------------------------------------------------------------------------------
    //
    // The SHIPPED four RectAreaLights plus the hemisphere, because the BSDF is evaluated once per
    // light and a spike lit by one directional would report a cost the real page never pays.
    // `HairLightingModel.indirect()` is empty, so the hemisphere reaches everything except the
    // hair — which is true on the shipped page too, and is a property of the model rather than of
    // this rig.
    //
    // Shadows OFF by default: a shadow caster draws the ribbons a SECOND time through
    // `maskShadowNode`, which is a real cost and a different one from raster-and-shade.
    const rig = new LightingRig( { preset: 'portrait', shadows, ambient: true } );
    rig.attachTo( scene, renderer );
    rig.aimAt( {
        focus: framing.centre,
        subjectHeightMetres: framing.size.y,
        cameraPosition: camera.position
    } );

    // --- the census ----------------------------------------------------------------------------

    const centreDepth = camera.position.distanceTo( framing.centre );

    const describe = () => ( {
        file: {
            url: tfx.url,
            version: tfx.version,
            strandCount: tfx.strandCount,
            pointsPerStrand: tfx.pointsPerStrand
        },
        geometry: {
            vertices: ribbon.vertices,
            triangles: ribbon.triangles,
            expectedTriangles: tfx.strandCount * ( tfx.pointsPerStrand - 1 ) * 2,
            degenerateTangents: ribbon.degenerateTangents,
            arcLengthMetres: ribbon.arcLengthMetres,
            boundsMetres: {
                min: ribbon.bounds.min.toArray(),
                max: ribbon.bounds.max.toArray()
            }
        },
        ribbon: {
            widthMetres,
            strandsDrawn: strandLimit,
            halfWidthMetres: widthMetres / 2,
            expectedWidthPixelsAtCentre:
                expectedScreenWidthPixels( widthMetres, centreDepth, CAMERA_FOV_DEGREES, heightPixels ),
            cameraFacing: 'per-vertex toEye, exact at every azimuth'
        },
        camera: {
            fovDegrees: CAMERA_FOV_DEGREES,
            azimuthDegrees,
            position: camera.position.toArray(),
            target: framing.centre.toArray(),
            distanceToCentre: centreDepth,
            widthPixels,
            heightPixels
        },
        shading: {
            tangent: geometricTangent ? 'geometric (attribute)' : 'derivative (shipped strandTangentNode)',
            coverage: coverageMode,
            oit: coverageMode === 'opaque' ? 'cutout@0 (probe)' : oitMode,
            alphaHash: material.alphaHash,
            alphaTest: material.alphaTest,
            probe,
            temporalAA: temporalMode,
            resolutionScale: temporalMode === 'taau' ? TAAU_RESOLUTION_SCALE : 1,
            framesRendered: Math.max( 1, frames ),
            lights: rig.units.length,
            shadows,
            hair: material.describe()
        },
        render: {
            drawCalls: renderer.info.render.drawCalls,
            triangles: renderer.info.render.triangles
        }
    } );

    // --- the loop that is not a loop -------------------------------------------------------------
    //
    // There is no `setAnimationLoop`. Nothing about this spike is temporal, and a page quietly
    // rendering in the background is exactly the contention this machine has been shown to punish.
    // A caller renders when it wants a frame.

    // --- the composite, or the deliberate absence of one -----------------------------------------
    //
    // 🚩 THE DEFAULT PATH HAS NO POST STACK AT ALL, AND THAT IS WHAT MAKES THE NUMBER ATTRIBUTABLE.
    // `?aa=off` renders the scene straight to the canvas: ONE colour attachment and a depth buffer,
    // so the render pool's cost is the ribbons being rasterised and shaded and nothing else.
    //
    // `?aa=taau` builds the SHIPPED composite instead — `pass()` into the five-attachment G-buffer
    // (output, diffuseColor, normal, velocity, sssMask; 25 bytes per pixel by `GBuffer.bytesPerPixel`)
    // and out through `createTemporalResolve`. That is the arm on which the coverage decision is
    // legible, because a hashed alpha is an UNBIASED ESTIMATOR and an estimator has to be
    // integrated by something: hair.md §5 measured our alpha-hash plus this resolve at 27.1%
    // single-pixel silhouette transitions against the reference's own 21.5%. It is also an arm on
    // which a raster-and-shade timing would be measuring five attachments and a velocity write, so
    // the two are kept apart by a query key rather than blended into one default.
    let pipeline = null;
    let temporal = null;

    if ( temporalMode !== 'off' ) {

        const scenePass = pass( scene, camera );
        const gbuffer = new GBuffer( scenePass );

        // TAAU renders the scene SMALLER than the drawing buffer and reconstructs with a 9-tap
        // Blackman-Harris filter. 0.66 in each axis is `rendering-stack.md`'s operating point,
        // quoted rather than chosen, and it is 44% of the shaded pixels — which is precisely why a
        // strand cost measured through it would be a different quantity from one measured at `off`.
        if ( temporalMode === 'taau' ) scenePass.setResolutionScale( TAAU_RESOLUTION_SCALE );

        temporal = createTemporalResolve( {
            mode: temporalMode,
            gbuffer,
            camera,

            // `TRAAPost.DEFAULT_SHARPNESS` is null — measured, on this project's own G4 statistic —
            // but its own header says a TAAU caller should pass one explicitly because the 0.66
            // upscale removes 61% of the high-pass band where full-resolution TRAA removes 25%.
            sharpness: temporalMode === 'taau' ? 0.4 : undefined
        } );

        pipeline = new RenderPipeline( renderer );

        // The transform is applied by `renderOutput` below rather than by the pipeline, for
        // `Stage.buildPipeline`'s reason: the pipeline would tone-map whatever the output node
        // produced, and this page has an arm whose output node is a code-value payload.
        pipeline.outputColorTransform = false;
        pipeline.outputNode = renderOutput( temporal.node );

    }

    const renderOnce = async () => {

        renderer.info.reset();

        if ( pipeline === null ) renderer.render( scene, camera );
        else await pipeline.renderAsync();

        // The submission is not the frame. Waiting on the device queue is what makes a screenshot
        // taken the instant `__STRAND_READY__` flips a picture of a FINISHED frame rather than of
        // a cleared attachment, and it is also what a timing phase must do before resolving.
        await renderer.backend?.device?.queue?.onSubmittedWorkDone();

    };

    for ( let frame = 0; frame < Math.max( 1, frames ); frame ++ ) await renderOnce();

    window.__STRAND_RENDER__ = renderOnce;
    window.__STRAND_DESCRIBE__ = describe;

    /**
     * 🎯 THE PREDICTION THE SILHOUETTE IS MEASURED AGAINST, and it is computed on the page because
     * the page is the only thing that knows the camera, the geometry and the width together.
     *
     * A drawn segment is a screen-space PARALLELOGRAM whose area is exactly `L · w`, and the "exactly"
     * is a property of the expansion rather than an approximation of it: `across = cross(tangent,
     * toEye)` is perpendicular to the view ray, so it lies in the plane parallel to the image plane
     * and projects to a screen vector of length `w` pixels; it is also perpendicular to the tangent,
     * and therefore perpendicular to whatever the tangent projects to. The two sides meet at a right
     * angle on screen, so no `sin θ` term survives.
     *
     * Which makes the comparison worth making: a ribbon expanded in a FIXED plane instead of toward
     * the eye would keep this same prediction and fail it the moment `?azimuth=` moved, because its
     * across-vector would tilt out of the image plane and foreshorten. The prediction is
     * azimuth-invariant BY CONSTRUCTION; the measured area is only azimuth-invariant if the
     * expansion really is camera-facing. That is the whole test.
     *
     * ⚠️ IT IS AN UPPER BOUND WHERE A STRAND CROSSES ITSELF, and the driver is told so rather than
     * having to infer it: two segments over one pixel are counted twice here and once by the
     * rasteriser. Run it with a small `?strandlimit=` and the residue is a strand doubling back on
     * itself, which at 16 points is rare and is reported as `selfOverlapRisk`.
     */
    window.__STRAND_FOOTPRINT__ = () => {

        const drawnStrands = Number.isFinite( strandLimit ) ? strandLimit : tfx.strandCount;
        const points = tfx.pointsPerStrand;

        const halfWidthPixels = widthPixels / 2;
        const halfHeightPixels = heightPixels / 2;

        const world = new Vector3();
        const view = new Vector3();
        const clip = new Vector3();

        const screenX = new Float64Array( points );
        const screenY = new Float64Array( points );
        const depth = new Float64Array( points );
        const visible = new Uint8Array( points );

        let expectedAreaPixels = 0;
        let projectedLengthPixels = 0;
        let widthSum = 0;
        let widthMin = Infinity;
        let widthMax = 0;
        let segments = 0;
        let skippedSegments = 0;

        camera.updateMatrixWorld();
        const viewMatrix = camera.matrixWorldInverse;

        for ( let strand = 0; strand < drawnStrands; strand ++ ) {

            const strandBase = strand * points * TFX_FLOATS_PER_POINT;

            for ( let pointIndex = 0; pointIndex < points; pointIndex ++ ) {

                const source = strandBase + pointIndex * TFX_FLOATS_PER_POINT;
                world.set( tfx.positions[ source ], tfx.positions[ source + 1 ], tfx.positions[ source + 2 ] );

                view.copy( world ).applyMatrix4( viewMatrix );
                depth[ pointIndex ] = - view.z;

                clip.copy( world ).project( camera );
                screenX[ pointIndex ] = ( clip.x * 0.5 + 0.5 ) * widthPixels;
                screenY[ pointIndex ] = ( 0.5 - clip.y * 0.5 ) * heightPixels;

                visible[ pointIndex ] = depth[ pointIndex ] > camera.near &&
                    Math.abs( clip.x ) <= 1 && Math.abs( clip.y ) <= 1 ? 1 : 0;

            }

            for ( let segment = 0; segment < points - 1; segment ++ ) {

                // Both endpoints, because a segment with one endpoint off screen contributes a
                // partial footprint this arithmetic cannot bound. Counted rather than clipped: a
                // probe whose subject is half outside the frame should say so, not guess.
                if ( visible[ segment ] === 0 || visible[ segment + 1 ] === 0 ) {

                    skippedSegments += 1;
                    continue;

                }

                const dx = screenX[ segment + 1 ] - screenX[ segment ];
                const dy = screenY[ segment + 1 ] - screenY[ segment ];
                const lengthPixels = Math.hypot( dx, dy );

                const meanDepth = ( depth[ segment ] + depth[ segment + 1 ] ) / 2;
                const segmentWidthPixels = expectedScreenWidthPixels(
                    widthMetres, meanDepth, CAMERA_FOV_DEGREES, heightPixels );

                expectedAreaPixels += lengthPixels * segmentWidthPixels;
                projectedLengthPixels += lengthPixels;
                widthSum += segmentWidthPixels;
                widthMin = Math.min( widthMin, segmentWidthPixels );
                widthMax = Math.max( widthMax, segmentWidthPixels );
                segments += 1;

            }

        }

        return {
            drawnStrands,
            segments,
            skippedSegments,
            projectedLengthPixels,
            expectedAreaPixels,
            expectedWidthPixels: {
                mean: segments === 0 ? null : widthSum / segments,
                min: segments === 0 ? null : widthMin,
                max: segments === 0 ? null : widthMax
            },
            selfOverlapRisk: 'expectedAreaPixels double-counts any pixel two segments both cover',
            azimuthDegrees
        };

    };

    /**
     * 🔴 THE RENDER-POOL TIMESTAMP, AND READING IT IS NOT THE SAME AS MEASURING WITH IT.
     *
     * This resolves the RENDER pool — the raster and the shade, which is what the spike is about —
     * and it is deliberately a bare accessor with no batching, no minimum-of-trials and no
     * contention gate. This machine measured an IDENTICAL fixed workload at 0.01785 ms and
     * 0.11228 ms in one session purely from other agents running; a single reading off this
     * function is a sample of that distribution and nothing more. The serialised timing phase
     * round-robins arms inside one process, reports minima, and prints a fixed-workload gate
     * beside every row. Anything else that quotes this number is quoting the contention.
     */
    window.__STRAND_GPU_MS__ = async () => {

        if ( timing === false ) return null;

        await renderer.resolveTimestampsAsync( TimestampQuery.RENDER );

        return renderer.info.render.timestamp;

    };

    window.__STRAND_READY__ = true;

    if ( hud !== null ) hud.textContent = JSON.stringify( describe(), null, 2 );

}

main().catch( ( error ) => {

    window.__STRAND_ERROR__ = String( error && error.stack ? error.stack : error );

    const hud = document.getElementById( 'hud' );
    if ( hud !== null ) hud.textContent = window.__STRAND_ERROR__;

    console.error( error );

} );
