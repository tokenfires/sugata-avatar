/**
 * hair.js — the page where somebody LOOKS at punch-list 3.6's groom.
 *
 * ## Why this page exists when `verify_glb.mjs` already passes
 *
 * The gate measures the exported file: at g050 today, 294 quad-strip cards of 17 rings, two cap
 * shells, zero vertices inside the body with a 3.504 mm nearest approach, and 100.00% of the
 * cranium hidden through the CUTOUT rather than through the triangles. Every one of those numbers
 * is true of a groom that looks like a helmet made of ribbons, and LEARNINGS §1.2 — the most-cited
 * entry in that file — is exactly this: a selftest proves the numbers and is structurally blind to
 * whether the picture is right. So this page draws the thing, from five fixed angles including the
 * one that catches a bald crown, and prints the atlas beside it.
 *
 * 🎯 **AND THAT BLINDNESS WAS DEMONSTRATED, NOT ARGUED — TWICE.** A blind critic shown this page
 * named three launch blockers the gate had passed: a dead-straight card border slicing the eyebrow,
 * a lit scalp at the parting, and a staircase at every strand tip. The coverage clause read
 * 99.14–100.00% throughout, because it asked 257 cranium VERTICES along their own normals and
 * blended the alpha where the material masks it. `verify_glb.mjs` now samples the cranium's
 * surface at 4 mm, applies the cutoff, fails on the largest CONNECTED exposed patch rather than on
 * a mean, and casts from the five camera angles this file's VIEWS define — which is the clause
 * that found the parting, at 229.1 mm² seen from the front.
 *
 * Then the owner looked at the composed build and said the style "still looks odd, messy I
 * suppose", with every clause green over the top of it. That one turned out to be measurable after
 * all: the cards FANNED, ending 33–42% further from their neighbours than they started, where hair
 * gathers into locks and ends tighter. `verify_glb.mjs`'s `cards gather` clause is that ratio and
 * `hair_cards.HAIR_LAYERS` carries the `clump` and `cut` values that answer it. Which is the
 * pattern rather than the exception: the page finds it, and then somebody works out what number
 * the page was seeing.
 *
 * Capture the five plates with:
 *   node tools/figure-pipeline/hair_shots.mjs --out captures/hair
 *
 * ## `?motion=1` — punch-list 6.6, and the second thing this page is for
 *
 * A still frame cannot show whether hair MOVES believably, which is the same argument the header
 * above makes about geometry and a selftest. `?motion=1` rebinds the groom to the figure's own
 * skeleton the way `alive.js` does, turns the head, and runs `motion/HairDynamics.js` — DFTL on the
 * card centrelines in one WebGPU compute pass. The A side is the same page with the key absent, on
 * which the groom rides the head rigidly through ordinary skinning: **that is the control every
 * number below is stated against, and it is one query key away.**
 *
 *   ?motion=1              the solver on
 *   ?head=shake|idle|still what turns the head. `shake` is the deterministic ±0.85 rad yaw the
 *                          research doc's spike used, `idle` is the shipped `MotionStack` — the
 *                          motion a judge actually sees — and `still` holds the head for the
 *                          settling measurement.
 *   ?hairdefect=           one of `none`, `noftl`, `kinematic`, `novelocity`, `nocollide`.
 *                          Every one of them is a red proof for one gate clause and nothing else.
 *   ?hairstep=fixed|perframe   🚩 `perframe` is LEARNINGS §1.13's defect, kept reachable: the
 *                          solver advanced once per FRAME by the frame's own delta, so its
 *                          trajectory depends on the frame rate and no amplitude gate can see it.
 *   ?gputime=1             request GPU timestamps; `__HAIR_GPU_MS__()` resolves the COMPUTE pool.
 *
 * `packages/core/src/motion/HairDynamics.selftest.mjs` drives this page through
 * `__HAIR_STEP__` / `__HAIR_MEASURE__` and holds every clause above to a number.
 *
 * ⚠️ **THIS IS NOT THE HAIR SHADER, and the page says so on screen.** Punch-list 3.5 owns the
 * anisotropic strand model, the transmission and the per-strand occlusion, and it runs after 3.6.
 * What is drawn here is the geometry under a deliberately plain material: the cutout, the strand
 * normal map, and nothing else. Judge the SHAPE here — the silhouette, the parting, whether the
 * scalp shows, whether a card intersects the ear — and judge the SHADING on 3.5's page.
 *
 * Deliberately self-contained rather than built on `Stage`. The deferred G-buffer carries the skin
 * material, the GTAO tier and the tone curve, and every one of them is another thing between a
 * card's silhouette and the eye; this page wants the geometry with as little between as possible,
 * and it must not go red when another agent changes a render pass it does not use.
 *
 *   npm run dev  ->  http://localhost:5173/src/hair.html
 */

import {
    AmbientLight,
    Box3,
    Color,
    DirectionalLight,
    Matrix4,
    MeshStandardNodeMaterial,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Skeleton,
    TimestampQuery,
    Vector3,
    WebGPURenderer
} from 'three/webgpu';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { createHairDynamics } from '../../core/src/motion/HairDynamics.js';
import { MotionStack, createMotionTarget } from '../../core/src/motion/MotionStack.js';
import { IdleMotion } from '../../core/src/motion/IdleMotion.js';
import { Breath } from '../../core/src/motion/Breath.js';
import { Sway } from '../../core/src/motion/Sway.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from '../../core/src/motion/Breath.js';

const WIDTH = 720;
const HEIGHT = 900;

const FIGURE_URL = new URL( '../../../assets/figures/figure_g050.glb', import.meta.url ).href;
const HAIR_URL = new URL( '../../../assets/hair/bob01/g050.glb', import.meta.url ).href;
const HAIR_MANIFEST_URL = new URL( '../../../assets/hair/manifest.json', import.meta.url ).href;
const HAIR_DIRECTORY = new URL( '../../../assets/hair/bob01/', import.meta.url ).href;

/**
 * The four angles, and each one is here because it catches something the others cannot.
 *
 *   front         the fringe, the parting, and whether hair is across the eyes
 *   three-quarter the framing angle a judge plate is captured at
 *   side          the silhouette — the one view where "helmet" is unmistakable
 *   top           the crown. ⚠️ This is the view that found the bald patch the scalp cap exists
 *                 to fix, and it is the only view that could have.
 */
const VIEWS = [
    { name: 'front', azimuth: 0, elevation: 0.04, distance: 0.78 },
    { name: 'three-quarter', azimuth: 40, elevation: 0.05, distance: 0.80 },
    { name: 'side', azimuth: 90, elevation: 0.03, distance: 0.80 },
    { name: 'back', azimuth: 180, elevation: 0.05, distance: 0.80 },
    { name: 'top', azimuth: 0, elevation: 0.62, distance: 0.62 }
];

const hud = document.getElementById( 'hud' );
let hudText = '';

function log( line = '' ) {

    hudText += `${ line }\n`;
    hud.textContent = hudText;

}

main().catch( ( error ) => {

    log( `FAILED — ${ error.message }` );
    console.error( error );

} );

async function main() {

    const query = new URLSearchParams( location.search );

    const manifest = await ( await fetch( HAIR_MANIFEST_URL ) ).json();
    const groom = manifest.grooms[ 0 ];

    const canvas = document.getElementById( 'stage' );
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const renderer = new WebGPURenderer( {
        canvas, antialias: true, alpha: false,
        trackTimestamp: query.get( 'gputime' ) === '1'
    } );
    renderer.setPixelRatio( 1 );
    renderer.setSize( WIDTH, HEIGHT, false );
    await renderer.init();

    const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';

    const scene = new Scene();
    scene.background = new Color( 0x14161a );

    const loader = new GLTFLoader();
    const figure = await loader.loadAsync( FIGURE_URL );
    const hair = await loader.loadAsync( HAIR_URL );

    scene.add( figure.scene );
    scene.add( hair.scene );

    // Head-height, off the HAIR's own bounds rather than off a constant. The groom is the subject;
    // framing it from a number typed here would be wrong the first time the style changed.
    // Taken BEFORE `?motion=1` rebinds anything, so the A and B sides frame identically.
    const bounds = new Box3().setFromObject( hair.scene );
    const centre = bounds.getCenter( new Vector3() );

    const motion = query.get( 'motion' ) === '1'
        ? await attachHairMotion( { renderer, figure, hair, query } )
        : null;

    const camera = new PerspectiveCamera( 38, WIDTH / HEIGHT, 0.05, 20 );

    // Three lights and no environment. A rim behind and above is what makes a hair silhouette
    // legible — it is the light that separates a card's edge from the head — and its absence is
    // why an unlit groom always looks like a solid mass.
    const key = new DirectionalLight( 0xfff2e4, 2.6 );
    const rim = new DirectionalLight( 0xcfe0ff, 3.4 );
    const fill = new AmbientLight( 0x66707f, 0.55 );
    scene.add( key, rim, fill );

    let view = VIEWS[ 1 ];

    function aimCamera() {

        const angle = view.azimuth * Math.PI / 180;
        const flat = Math.cos( Math.asin( Math.min( 1, view.elevation * 1.4 ) ) );

        camera.position.set(
            centre.x + Math.sin( angle ) * view.distance * flat,
            centre.y + view.distance * view.elevation * 1.4,
            centre.z + Math.cos( angle ) * view.distance * flat
        );
        camera.lookAt( centre );

        key.position.copy( camera.position ).add( new Vector3( 0.5, 0.6, 0.2 ) );
        rim.position.copy( centre ).addScaledVector(
            camera.position.clone().sub( centre ).normalize(), - 1.0 );
        rim.position.y += 0.9;
        key.target.position.copy( centre );
        rim.target.position.copy( centre );
        scene.add( key.target, rim.target );

    }

    function place() {

        aimCamera();
        return renderer.renderAsync( scene, camera );

    }

    /**
     * The hook a capture script drives the page through, because clicking a button and guessing
     * how long the render took is how a before/after pair ends up comparing two different frames.
     * Awaits the actual `renderAsync`, so the canvas is finished when this resolves.
     *
     *   node tools/figure-pipeline/hair_shots.mjs --out /tmp/before
     */
    window.hairShot = async ( name ) => {

        const wanted = VIEWS.find( ( candidate ) => candidate.name === name );
        if ( wanted === undefined ) throw new Error( `no view named '${ name }'` );

        view = wanted;
        await place();
        return { name, width: WIDTH, height: HEIGHT };

    };

    const views = document.getElementById( 'views' );
    for ( const candidate of VIEWS ) {

        const button = document.createElement( 'button' );
        button.textContent = candidate.name;
        button.setAttribute( 'aria-pressed', String( candidate === view ) );
        button.addEventListener( 'click', () => {

            view = candidate;
            for ( const other of views.children ) {

                other.setAttribute( 'aria-pressed', String( other === button ) );

            }
            place();

        } );
        views.appendChild( button );

    }

    place();

    // --- ?motion=1: the frame loop, the step hook and the measurement hook -----------------------
    //
    // Two frame paths, and they must not diverge — `alive.js`'s `trackFigure` is in the repo
    // because a contact shadow once stopped following the feet on exactly the plates a judge
    // measures. So both paths call `advance()` and nothing else touches the solver.
    if ( motion !== null ) {

        const advance = ( deltaSeconds ) => {

            motion.driveHead( deltaSeconds );
            motion.step( deltaSeconds );

        };

        /** The deterministic clock a gate drives, in the shape `alive.js`'s `__SUGATA_STEP__` has. */
        window.__HAIR_STEP__ = async ( deltaSeconds ) => {

            advance( deltaSeconds );
            aimCamera();
            await renderer.renderAsync( scene, camera );
            await renderer.backend?.device?.queue?.onSubmittedWorkDone();

            return true;

        };

        // The whole solver, for poking at from the console: `__HAIR__.dynamics.uniforms.
        // globalStiffness.value = 0.02` is how the two chosen-not-sourced constants were swept.
        window.__HAIR__ = motion;
        window.__HAIR_MEASURE__ = () => motion.measure();
        window.__HAIR_RESET__ = () => motion.reset();
        window.__HAIR_STATE__ = () => ( {
            ...motion.state(),
            // 🎯 The submission SHAPE, as an integer rather than as a duration. Research doc §0.3's
            // rule — every substep in ONE array-shaped `renderer.compute()` — is worth ten times the
            // simulation, and a millisecond comparison is the wrong instrument for it: the two arms
            // differ by tens of microseconds on a clock whose noise is the same size. This counter
            // is 1 or 3 and nothing in between.
            computeCallsThisFrame: motion.dynamics.computeCallsLastFrame
        } );

        window.__HAIR_GPU_MS__ = async () => {

            if ( query.get( 'gputime' ) !== '1' ) return null;

            // 🚩 The COMPUTE pool is a SEPARATE pool from RENDER (`constants.js:1672`), and this is
            // the one that carries the solver. Resolving RENDER here would report the cost of
            // drawing the groom and call it hair physics.
            await renderer.resolveTimestampsAsync( TimestampQuery.COMPUTE );
            await renderer.resolveTimestampsAsync( TimestampQuery.RENDER );

            return { compute: renderer.info.compute.timestamp, render: renderer.info.render.timestamp };

        };

        /**
         * 🎯 The solver's cost, AMORTISED, because a single frame of it is under the clock's own
         * resolution.
         *
         * Measured on this page 2026-08-13: one frame's compute pass reads **0.06554 ms p50 and
         * 0.13107 ms p95** — and those are 65,536 ns and 131,072 ns exactly, one and two counts of
         * a 65.536 µs quantum. Chromium quantises GPU timestamps, so a per-frame reading of
         * something this cheap is a coin toss between one tick and two, and quoting either as the
         * cost of the solver would be quoting the clock. The spike hit the same wall and answered
         * it the same way (`tools/spikes/README.md`: eight whole simulation frames per tick).
         *
         * ⚠️ AND IT HAS TO BE ONE PASS WITH `repeats` COPIES OF THE DISPATCHES, not `repeats`
         * passes. `WebGPUTimestampQueryPool._resolveQueries` sums durations into
         * `framesDuration[frame]` keyed by `${name}:f${frame}` (r185, :203–222) — so thirty-two
         * `renderer.compute()` calls in one frame all carry the same uid, collide in the offsets
         * map, and the resolve reports ONE of them. Measured: 32 passes read 0.06554 ms, exactly
         * what 1 pass reads. That reading is not a fast solver, it is a collided key.
         *
         * So what this measures is the DISPATCH arithmetic amortised, without the per-pass
         * overhead the research doc §0.3 puts at 30.8–54.1 µs. Both halves are named when it is
         * quoted, because a number that silently omits 93% of the cost is worse than no number.
         */
        window.__HAIR_GPU_COST__ = async ( repeats = 64 ) => {

            if ( query.get( 'gputime' ) !== '1' ) return null;

            const nodes = motion.dynamics.computeNodesFor( 2 );
            const batch = [];
            for ( let repeat = 0; repeat < repeats; repeat ++ ) batch.push( ...nodes );

            renderer.compute( batch );

            await renderer.renderAsync( scene, camera );
            await renderer.backend?.device?.queue?.onSubmittedWorkDone();
            await renderer.resolveTimestampsAsync( TimestampQuery.COMPUTE );

            return { repeats, totalMs: renderer.info.compute.timestamp,
                perFrameMs: renderer.info.compute.timestamp / repeats };

        };

        // A gate steps the clock itself. Everything else — a person with the page open — gets a
        // real frame loop, because the whole point of this key is that somebody LOOKS at it moving.
        if ( query.has( 'capture' ) === false ) {

            let previousMilliseconds = null;

            renderer.setAnimationLoop( ( nowMilliseconds ) => {

                const deltaSeconds = previousMilliseconds === null
                    ? 1 / 60
                    : Math.min( ( nowMilliseconds - previousMilliseconds ) / 1000, 0.1 );
                previousMilliseconds = nowMilliseconds;

                advance( deltaSeconds );
                aimCamera();
                renderer.render( scene, camera );

            } );

        }

    }

    // --- the atlas, beside the render ----------------------------------------------------------
    //
    // All four sheets, including the two the GLB does NOT carry. A shader author arriving at 3.5
    // needs to see that `flow` and `depth` exist and what is in them; a manifest entry naming a
    // file is a claim, and an <img> pointed at it is the file.
    const maps = document.getElementById( 'maps' );
    for ( const [ name, entry ] of Object.entries( groom.maps ) ) {

        const figureElement = document.createElement( 'figure' );
        const image = document.createElement( 'img' );
        image.src = HAIR_DIRECTORY + entry.file;
        image.alt = `${ name }: ${ entry.channels }`;
        const caption = document.createElement( 'figcaption' );
        caption.textContent = `${ name }${ entry.embedded ? '' : ' (sidecar)' }`;
        figureElement.append( image, caption );
        maps.appendChild( figureElement );

    }

    // --- what the page can say for itself --------------------------------------------------------
    let triangles = 0;
    let vertices = 0;

    hair.scene.traverse( ( object ) => {

        if ( ! object.isMesh ) return;

        const position = object.geometry.attributes.position;
        vertices += position.count;
        triangles += object.geometry.index.count / 3;

    } );

    log( `Renderer            : ${ backend }` );
    log( `Groom               : ${ groom.id } — ${ groom.description }` );
    log( `Figure              : ${ FIGURE_URL.split( '/' ).pop() }` );
    log();
    log( `geometry            : ${ vertices.toLocaleString() } verts, ` +
        `${ triangles.toLocaleString() } triangles` );
    log( `material            : ${ groom.alphaMode }, cutoff ${ groom.alphaCutoff }, ` +
        `${ groom.doubleSided ? 'double sided' : 'backface culled' }` );
    log( `skinned to          : ${ groom.bone }` );
    log( `atlas               : ${ groom.atlas.size }², ${ groom.atlas.strips } strips, ` +
        `cap strip ${ groom.atlas.capStrip }` );
    log();
    log( `!! THIS IS NOT THE HAIR SHADER. Punch-list 3.5 owns the` );
    log( `anisotropic strand model and runs after this. What is drawn here is a plain` );
    log( `Principled material with the generated albedo + normal sheets, so that the` );
    log( `GEOMETRY can be judged without a shader in front of it.` );
    log();
    log( `What to look for, in the order it goes wrong:` );
    log( `  3/4    does a STRAIGHT line cross the brow, the lid or the cheekbone? That is a` );
    log( `         card's own quad edge.` );
    log( `  side   is the silhouette hair, or a helmet with ribbon edges? And does the mass` );
    log( `         separate into LOCKS, or is every card going its own way? A fan reads as a mop.` );
    log( `  top    does the scalp show between the cards? That is what the cap is for.` );
    log( `  front  is the parting readable, and is hair across the EYES? A groom may cross the` );
    log( `         temple and must not cross an eye — this page is a face.` );
    log( `  back   do the ends land on a CUT LINE, or scatter over a hand's width? Scattered ends` );
    log( `         are what three separate observers called "messy", "stringy" and "unwashed".` );
    log();
    log( `The numbers are gated elsewhere and none of them can answer any of the above:` );
    log( `  node tools/figure-pipeline/verify_glb.mjs assets/hair/bob01/g050.glb` );

    if ( motion !== null ) {

        log();
        log( `?motion=1  DFTL on ${ motion.description }` );
        log( `head       ${ motion.headMode }, timestep ${ motion.stepMode }, defect ${ motion.defect }` );
        log( `skull      sphere r=${ ( motion.colliders.skullRadius * 1000 ).toFixed( 1 ) } mm ` +
            `at the least-squares scalp centre (fit r=${ ( motion.colliders.scalpRadius * 1000 ).toFixed( 1 ) } mm), ` +
            `nearest rest particle ${ ( motion.colliders.nearestRestParticle * 1000 ).toFixed( 1 ) } mm` );
        log( `A/B        drop ?motion=1 for the rigid control — same page, same framing.` );

    }

}

/**
 * The named ways the solver can be broken from a URL, and what each one is the red proof FOR.
 *
 * LEARNINGS §1.25a: a rejection proof written against the defect the gate was designed from proves
 * the two are consistent, not that either is right. So this is a table of MECHANISMS rather than of
 * remembered bugs, every one of them a single uniform, and the gate asserts the whole row — the
 * greens included, because a defect that turns every clause red proves nothing about which clause
 * is doing the work.
 */
/** How long `?head=impulse` shakes before it stops dead. See `driveHead`. */
const IMPULSE_SECONDS = 2;

const HAIR_MOTION_DEFECTS = {
    none: () => ( {} ),

    /** The FTL projection removed and everything else — prediction, gravity, the shape constraint,
     *  the colliders, the DFTL velocity term — left running. Length only. */
    noftl: () => ( { ftlEnabled: 0 } ),

    /** Every particle pinned to the rigid pose, with the solver still running. If the movement
     *  clause stays green here, it is measuring the head transform rather than the simulation. */
    kinematic: () => ( { kinematic: 1 } ),

    /** PBD eq 13 skipped — the position is corrected and the velocity never told. The classic
     *  omission, and the one that stops a chain ever spending its energy. Settling only. */
    novelocity: () => ( { velocityUpdateEnabled: 0 } ),

    /** The colliders off. Penetration only. */
    nocollide: () => ( { collideEnabled: 0 } ),

    /** The full 9.81 m/s² applied instead of the CHANGE in it, so the authored pose stops being the
     *  equilibrium and the groom carries a permanent sag. Rest-exactness only. */
    fullgravity: () => ( { restGravityEnabled: 0 } )
};

/**
 * Rebinds the groom to the figure's live skeleton, puts the solver on it, and returns the handful
 * of closures the page drives.
 *
 * ## Why the groom is REBOUND, in one sentence borrowed from `alive.js`
 *
 * The GLB carries its own copy of the 53-bone rig and every vertex is weighted 1.000 to `head`, so
 * its own bones are a bind pose that would sit motionless while the figure's head turned. What is
 * kept is `boneInverses`; what is thrown away is the bones.
 *
 * ## And why the solver does not fight the skinning
 *
 * `hair-motion.md` §8.2 names this as the one piece with real risk — *"the armature modifier and
 * the solver must not both move the same vertices"* — and offers two contracts: unskin the groom
 * entirely, or solve in head-local space and keep skinning. Neither is what happens here, because
 * r185 settles it: `NodeMaterial.setupPosition` runs `skinning( object )` and THEN overwrites
 * `positionLocal` with `positionNode` (`NodeMaterial.js:776`, `:804`). A card vertex therefore
 * takes the solver's answer and never sees the skin matrix, and a scalp-cap vertex — which is head,
 * not hair — keeps its skinning untouched. One `select` on `vertexIndex`, no third dispatch, and no
 * change to the groom's export.
 */
async function attachHairMotion( { renderer, figure, hair, query } ) {

    const skinned = [];
    hair.scene.traverse( ( object ) => {

        if ( object.isSkinnedMesh === true ) skinned.push( object );

    } );

    if ( skinned.length !== 1 ) {

        throw new Error( `hair: ?motion=1 expects one SkinnedMesh in the groom, found ${ skinned.length }.` );

    }

    const mesh = skinned[ 0 ];

    const figureBones = new Map();
    figure.scene.traverse( ( object ) => {

        if ( object.isBone === true ) figureBones.set( object.name, object );

    } );

    const absent = mesh.skeleton.bones.filter( ( bone ) => figureBones.has( bone.name ) === false );
    if ( absent.length > 0 ) {

        throw new Error( `hair: the groom is skinned to ${ absent.map( ( bone ) => bone.name ).join( ', ' ) }, ` +
            'which this figure\'s rig does not have.' );

    }

    const boneIndex = mesh.skeleton.bones.findIndex( ( bone ) => bone.name === 'head' );
    if ( boneIndex < 0 ) throw new Error( 'hair: the groom\'s skeleton has no `head` bone to hang the solver on.' );

    const headBoneInverse = mesh.skeleton.boneInverses[ boneIndex ].clone();
    const headBone = figureBones.get( 'head' );

    mesh.bind( new Skeleton( mesh.skeleton.bones.map( ( bone ) => figureBones.get( bone.name ) ),
        mesh.skeleton.boneInverses ), new Matrix4() );

    // A SkinnedMesh's bounding sphere is computed in BIND pose and three never refits it. With the
    // solver moving vertices metres from where the sphere says they are, a head turn would delete
    // the groom rather than crop it — the same reason `alive.js` turns it off.
    mesh.frustumCulled = false;

    hair.scene.remove( mesh );
    figure.scene.add( mesh );
    figure.scene.updateMatrixWorld( true );

    // --- what the URL asked for, read before anything is built from it ---------------------------

    const headMode = query.get( 'head' ) ?? 'shake';
    if ( [ 'shake', 'impulse', 'idle', 'still' ].includes( headMode ) === false ) {

        throw new Error( `hair: ?head must be shake, impulse, idle or still — got '${ headMode }'.` );

    }

    const stepMode = query.get( 'hairstep' ) ?? 'fixed';
    if ( [ 'fixed', 'perframe' ].includes( stepMode ) === false ) {

        throw new Error( `hair: ?hairstep must be fixed or perframe — got '${ stepMode }'.` );

    }

    // 🚩 `perkernel` is the research doc §0.3 defect: one `renderer.compute()` per kernel per
    // substep instead of one array-shaped call. It is the single most expensive mistake available
    // in this subsystem and it is invisible in the picture, which is why it is reachable from a URL
    // and why the cost gate shoots at it.
    const submitMode = query.get( 'hairsubmit' ) ?? 'onepass';
    if ( [ 'onepass', 'perkernel' ].includes( submitMode ) === false ) {

        throw new Error( `hair: ?hairsubmit must be onepass or perkernel — got '${ submitMode }'.` );

    }

    if ( stepMode === 'perframe' ) {

        console.warn( '🚩 DEFECT PLANTED — hairstep=perframe advances the solver once per FRAME by ' +
            'the frame\'s own delta. LEARNINGS §1.13: its trajectory then depends on the frame rate.' );

    }

    // --- the solver ------------------------------------------------------------------------------

    const dynamics = createHairDynamics( { renderer, geometry: mesh.geometry, submit: submitMode } );

    const defectName = query.get( 'hairdefect' ) ?? 'none';
    if ( HAIR_MOTION_DEFECTS[ defectName ] === undefined ) {

        throw new Error( `hair: ?hairdefect must be one of ${ Object.keys( HAIR_MOTION_DEFECTS ).join( ', ' ) }.` );

    }

    for ( const [ name, value ] of Object.entries( HAIR_MOTION_DEFECTS[ defectName ]() ) ) {

        dynamics.uniforms[ name ].value = value;
        console.warn( `🚩 DEFECT PLANTED — hairdefect=${ defectName } sets ${ name } = ${ value }. ` +
            'This page LOOKS like the shipped solver and is not.' );

    }

    // The material the solver's output is drawn through. `GLTFLoader` builds a
    // `MeshStandardMaterial`, which the WebGPU backend converts internally and per render — so a
    // `positionNode` set on it would be set on an object the renderer discards. It has to be a node
    // material of our own, carrying the groom's own albedo and its MASK cutoff.
    const source = mesh.material;
    const material = new MeshStandardNodeMaterial();
    material.name = 'hair-dynamics';
    material.map = source.map ?? null;
    material.normalMap = source.normalMap ?? null;
    material.normalScale = source.normalScale?.clone() ?? material.normalScale;
    material.roughness = source.roughness ?? 0.6;
    material.metalness = source.metalness ?? 0;
    material.side = source.side;
    material.transparent = false;
    material.alphaTest = source.alphaTest > 0 ? source.alphaTest : 0.5;
    material.positionNode = dynamics.positionNode;
    mesh.material = material;

    dynamics.setHeadMatrix( mesh.matrixWorld, headBone.matrixWorld, headBoneInverse );

    const clavicleLeft = figureBones.get( 'clavicle_l' );
    const clavicleRight = figureBones.get( 'clavicle_r' );
    const shoulderLeft = clavicleLeft?.getWorldPosition( new Vector3() ) ?? null;
    const shoulderRight = clavicleRight?.getWorldPosition( new Vector3() ) ?? null;

    // No `centre`: the fit comes off the groom's own roots. See `fitColliders` for the measurement
    // that says why the head BONE's origin is the wrong place to put a skull.
    const colliders = dynamics.fitColliders( { shoulderLeft, shoulderRight } );

    // --- what turns the head ----------------------------------------------------------------------

    const headRest = headBone.quaternion.clone();
    const headRestWorld = restRotationRelativeToRig( headBone, figure.scene );
    const rigSpace = new Quaternion();
    const boneSpace = new Quaternion();

    const stack = headMode === 'idle' ? buildIdleStack( figure ) : null;
    let simulationSeconds = 0;

    /**
     * The stimulus, and it is a pure function of SIMULATION time rather than of wall clock.
     *
     * `shake` is the spike's own trajectory — ±0.85 rad yaw at 0.6 Hz, ±0.18 rad pitch at 1.7 Hz,
     * ±0.12 rad roll at 2.9 Hz (`hair-motion.md` §9.2) — so the two measurements are of the same
     * motion. Three incommensurate rates rather than one, because a single sinusoid has a moment
     * of zero velocity twice a cycle and a settling check taken there measures nothing.
     *
     * The rotation is composed in RIG space and conjugated into the bone's own frame with
     * `toBoneDeltaFrame`, which is the same path every shipped motion layer takes. Writing an Euler
     * straight onto `head.quaternion` would make "yaw" mean whichever axis the exporter happened to
     * leave pointing up.
     */
    function driveHead( deltaSeconds ) {

        simulationSeconds += deltaSeconds;

        if ( headMode === 'idle' ) {

            stack.update( deltaSeconds );
            figure.scene.updateMatrixWorld( true );
            return;

        }

        if ( headMode === 'shake' || headMode === 'impulse' ) {

            // `impulse` is the same shake stopped dead at IMPULSE_SECONDS, which is the stimulus a
            // settling measurement needs: energy goes in, the driver goes quiet, and what is left
            // is the solver's own dissipation rather than the stimulus's.
            const clock = headMode === 'impulse'
                ? Math.min( simulationSeconds, IMPULSE_SECONDS )
                : simulationSeconds;

            const yaw = 0.85 * Math.sin( 2 * Math.PI * 0.6 * clock );
            const pitch = 0.18 * Math.sin( 2 * Math.PI * 1.7 * clock );
            const roll = 0.12 * Math.sin( 2 * Math.PI * 2.9 * clock );

            rigSpace.setFromAxisAngle( new Vector3( 0, 1, 0 ), yaw );
            rigSpace.multiply( new Quaternion().setFromAxisAngle( new Vector3( 1, 0, 0 ), pitch ) );
            rigSpace.multiply( new Quaternion().setFromAxisAngle( new Vector3( 0, 0, 1 ), roll ) );

            toBoneDeltaFrame( rigSpace, headRestWorld, boneSpace );
            headBone.quaternion.copy( headRest ).multiply( boneSpace );

        }

        figure.scene.updateMatrixWorld( true );

    }

    const leftShoulder = new Vector3();
    const rightShoulder = new Vector3();

    function step( deltaSeconds ) {

        dynamics.setHeadMatrix( mesh.matrixWorld, headBone.matrixWorld, headBoneInverse );

        // The chest moves under Sway, so the capsule is re-read every frame rather than fitted
        // once. The skull needs no such call — it rides the head matrix above.
        if ( clavicleLeft !== undefined && clavicleRight !== undefined ) {

            dynamics.setShoulders(
                clavicleLeft.getWorldPosition( leftShoulder ),
                clavicleRight.getWorldPosition( rightShoulder ) );

        }

        if ( stepMode === 'perframe' ) {

            // 🚩 The defect, in the one line that is the whole of it: the solver is handed the
            // frame's own delta and told to take exactly one step of it.
            dynamics.uniforms.deltaTime.value = Math.min( Math.max( deltaSeconds, 1e-4 ), 0.1 );
            renderer.compute( dynamics.computeNodesFor( 1 ) );
            dynamics.uniforms.resetPositions.value = 0;
            return 1;

        }

        return dynamics.update( deltaSeconds );

    }

    return {
        dynamics,
        colliders,
        headMode,
        stepMode,
        defect: defectName,
        submitMode,
        description: `${ dynamics.groom.chainCount } chains × ${ dynamics.groom.pointsPerChain } ` +
            `rings = ${ dynamics.groom.particleCount } particles, ` +
            `${ dynamics.substepSeconds.toFixed( 6 ) } s substep`,
        driveHead,
        step,
        reset: () => {

            simulationSeconds = 0;
            headBone.quaternion.copy( headRest );
            stack?.reset();
            figure.scene.updateMatrixWorld( true );
            dynamics.setHeadMatrix( mesh.matrixWorld, headBone.matrixWorld, headBoneInverse );
            dynamics.reset();

        },
        state: () => ( {
            simulationSeconds,
            steps: dynamics.stepsTaken,
            headMode,
            stepMode,
            defect: defectName,
            skullRadius: dynamics.uniforms.skull.value.w
        } ),
        measure: () => measureGroom( dynamics )
    };

}

/**
 * The shipped idle stack, cut to the three layers that reach the head and the neck.
 *
 * Not the full ten `alive.js` runs: this page has no eyes, no lids and no hands, and a layer whose
 * channels are not on the figure is a throw rather than a no-op. What is here is the motion the
 * hair actually has to answer — the neck's noise, the breath that lifts the chest and the sway that
 * moves the whole column — driven by the same `MotionStack` the acceptance page uses, so `?head=idle`
 * is a statement about the shipped motion system rather than about a sine wave.
 */
function buildIdleStack( figure ) {

    const stack = new MotionStack( { seed: 20260813 } );

    stack.bind( createMotionTarget( figure.scene ) );
    stack.add( new Breath() );
    stack.add( new Sway() );
    stack.add( new IdleMotion( { armsEnabled: true } ) );

    return stack;

}

/**
 * Everything a gate needs, computed in the page off the buffer the GPU actually wrote.
 *
 * 🚩 The mask each statistic is taken over is named in its own field, because standing rule 4 is
 * this project's most expensive lesson: the spike's own correctness table reported **0.000 mm of
 * skull penetration in both its green run and its red one**, which is a statistic over a mask that
 * never contained an event. `colliderContacts` is here for exactly that reason — a penetration
 * figure is worth nothing unless the collider can be shown to have fired.
 */
async function measureGroom( dynamics ) {

    const { positions, velocities, headMatrix, skull } = await dynamics.readCentrelines();
    const { chainCount, pointsPerChain, particleCount, restCentres, restLengths } = dynamics.groom;

    const head = new Matrix4().fromArray( headMatrix );
    const rigid = new Vector3();

    let worstSegmentErrorMetres = 0;
    let worstSegmentRelative = 0;
    let maxDisplacementMetres = 0;
    let sumTipDisplacement = 0;
    let maxTipDisplacementMetres = 0;
    let deepestPenetrationMetres = 0;
    let colliderContacts = 0;
    let kineticEnergy = 0;
    let maxSpeed = 0;
    let nonFinite = 0;

    const tips = [];

    for ( let particle = 0; particle < particleCount; particle ++ ) {

        const x = positions[ particle * 3 ];
        const y = positions[ particle * 3 + 1 ];
        const z = positions[ particle * 3 + 2 ];

        if ( Number.isFinite( x ) === false || Number.isFinite( y ) === false || Number.isFinite( z ) === false ) {

            nonFinite ++;
            continue;

        }

        const ring = particle % pointsPerChain;

        if ( ring > 0 ) {

            const measured = Math.hypot(
                x - positions[ ( particle - 1 ) * 3 ],
                y - positions[ ( particle - 1 ) * 3 + 1 ],
                z - positions[ ( particle - 1 ) * 3 + 2 ] );
            const error = Math.abs( measured - restLengths[ particle ] );

            worstSegmentErrorMetres = Math.max( worstSegmentErrorMetres, error );
            worstSegmentRelative = Math.max( worstSegmentRelative, error / Math.max( restLengths[ particle ], 1e-6 ) );

        }

        // The rigid control: where the head transform ALONE would have put this particle. The
        // difference is the simulation, and nothing else — which is what makes it the right
        // stimulus for "does the hair move" on a groom that also rides the head.
        rigid.set( restCentres[ particle * 3 ], restCentres[ particle * 3 + 1 ], restCentres[ particle * 3 + 2 ] )
            .applyMatrix4( head );

        const displacement = Math.hypot( x - rigid.x, y - rigid.y, z - rigid.z );
        maxDisplacementMetres = Math.max( maxDisplacementMetres, displacement );

        if ( ring === pointsPerChain - 1 ) {

            sumTipDisplacement += displacement;
            maxTipDisplacementMetres = Math.max( maxTipDisplacementMetres, displacement );
            tips.push( x, y, z );

        }

        const toSkull = Math.hypot( x - skull[ 0 ], y - skull[ 1 ], z - skull[ 2 ] ) - skull[ 3 ];
        deepestPenetrationMetres = Math.min( deepestPenetrationMetres, toSkull );
        if ( Math.abs( toSkull ) < 1e-5 ) colliderContacts ++;

        const speedSquared = velocities[ particle * 3 ] ** 2 +
            velocities[ particle * 3 + 1 ] ** 2 + velocities[ particle * 3 + 2 ] ** 2;
        kineticEnergy += speedSquared;
        maxSpeed = Math.max( maxSpeed, Math.sqrt( speedSquared ) );

    }

    return {
        particles: particleCount,
        chains: chainCount,
        steps: dynamics.stepsTaken,

        // mask: every interior particle of every chain, chainCount × (pointsPerChain − 1) segments
        worstSegmentErrorMm: worstSegmentErrorMetres * 1000,
        worstSegmentRelative,
        segments: chainCount * ( pointsPerChain - 1 ),

        // mask: every particle, against the rigid pose the same head matrix produces
        maxDisplacementMm: maxDisplacementMetres * 1000,
        maxTipDisplacementMm: maxTipDisplacementMetres * 1000,
        meanTipDisplacementMm: ( sumTipDisplacement / chainCount ) * 1000,

        // mask: every particle, against the fitted skull sphere. `colliderContacts` is how many are
        // sitting ON it, which is the proof the penetration figure was computed over live events.
        deepestPenetrationMm: - deepestPenetrationMetres * 1000,
        colliderContacts,
        skullRadiusMm: skull[ 3 ] * 1000,

        kineticEnergy,
        maxSpeedMetresPerSecond: maxSpeed,
        nonFinite,
        tips
    };

}
