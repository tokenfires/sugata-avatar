/**
 * post — the browsercheck for antialiasing and the grade (punch-list 3.11, 3.12, 3.13).
 *
 * It exists to answer three questions by A/B rather than by argument, on the same figure, the
 * same rig and the same framing constants `alive.html` uses, so a number taken here is
 * comparable with a number taken there:
 *
 *   1. **What is actually antialiasing the shipped page?** `?aa=msaa` and `?aa=off` are the exact
 *      pair `alive.html` exposes as `?msaa=0`, on the FORWARD path, because that is what ships.
 *      `?aa=traa` and `?aa=taau` are the deferred proposals. Any claim about edges has to name
 *      which of the four it was measured on.
 *   2. **Does temporal AA survive this figure's morph-driven face?** `?morph=1` drives a large
 *      ARKit target continuously. Morph targets write a motion vector that is wrong rather than
 *      absent (`render/TRAAPost.js` has the mechanism and the source lines), so this is the toggle
 *      that turns "TRAA might ghost the face" into a measurement.
 *   3. **Does the shimmer go away under a MOVING camera?** LEARNINGS §1.3 and punch-list 3.11 both
 *      say a still frame cannot answer that, so `?orbit=1` yaws the camera about the focus at a
 *      fixed rate and `__SUGATA_STEP__` advances it in exact 1/60 steps.
 *
 * URL parameters:
 *
 *   ?aa=msaa|off|traa|taau   default msaa — what `alive.html` ships today
 *   ?scale=0.66              scene-pass resolution scale. Defaults to 0.66 for taau, 1 otherwise.
 *   ?grade=1                 install `render/Grade.js`. Forces the deferred path.
 *   ?tone=aces|agx|neutral   the grade's tone curve
 *   ?bloom=0.30 ?grain=1.5 ?vignette=0.12 ?sat=1.02   grade dials, so a gate can be attributed
 *   ?orbit=1                 yaw the camera. ?orbit=0.5 halves the rate.
 *   ?morph=1                 drive jawOpen continuously — the morph-velocity probe
 *   ?hold=0.8                pin jawOpen at a constant weight — the decisive velocity case
 *   ?blink=1                 the fastest morph the rig produces, from Blink.js's own constants
 *   ?morphvel=off|hold|exact whether morph targets get a previous-frame position. `exact` ships;
 *                            `off` is three r185 unpatched and is the rejection proof
 *   ?probe=grade             replace the scene with the grade's measurement target
 *   ?graindefect=flat|…      🚩 rebuild a grain defect on purpose, so a gate can go red
 *   ?frame=body              full-body framing instead of the portrait crop
 *   ?gender=0.5 ?pose=…      same meaning as on `alive.html`
 *   ?bare                    hide the overlays for a clean plate
 *   ?webgl                   force the WebGL2 tier. There is no velocity buffer there, so
 *                            traa/taau are refused rather than silently degraded.
 *
 * `window.__SUGATA_STEP__(dt)` advances orbit and morph by a fixed step, so a capture tool drives
 * the same simulation the live page runs. `window.__SUGATA_ENV__` reports what actually came up.
 */

import { Color, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry, Vector3 } from 'three/webgpu';
import { float, normalView, screenUV, vec3 } from 'three/tsl';
import { Box3 } from 'three';

import { BLINK_CONSTANTS } from '../../core/src/motion/Blink.js';
import { Stage } from '../../core/src/render/Stage.js';
import { morphOffsetBytes } from '../../core/src/render/MorphVelocity.js';
import { LightingRig } from '../../core/src/render/LightingRig.js';
import { Grade } from '../../core/src/render/Grade.js';
import { EyeMaterial } from '../../core/src/material/EyeMaterial.js';
import { applySkinMaterial, createSkinMaterial, curvatureMapUrlFor } from '../../core/src/material/SkinMaterial.js';
import { filteredRoughness } from '../../core/src/render/Toksvig.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { RestPose } from '../../core/src/figure/RestPose.js';
import { Skeleton } from '../../core/src/figure/Skeleton.js';

// --- framing, copied value-for-value from alive.js -------------------------------------------
//
// Copied rather than imported on purpose: `alive.js` is a browsercheck, and one browsercheck
// importing another's internals couples two pages that are meant to be independently readable.
// The values are what make a measurement here comparable with a measurement there, so any drift
// between the two files is a bug in whichever one moved, and it is visible as a differently
// framed plate rather than as a silent offset.
const PORTRAIT_FIELD_OF_VIEW_DEGREES = 26;
const PORTRAIT_HEIGHT_METRES = 0.42;
const EYE_LINE_FROM_TOP = 1 / 3;
const CAMERA_AZIMUTH_DEGREES = 12;
const BODY_FRAME_MARGIN = 1.10;
const EYEBALL_MESH_PATTERN = /high-poly|low-poly|eyeball/i;
const BACKDROP_EMISSIVE = 0x11151f;
const BACKDROP_DISTANCE_METRES = 1.9;
const DEFAULT_REST_POSE = 'relaxed-standing';

/** Degrees per second the orbit yaws. Slow enough to read, fast enough to break a bad TAA. */
const ORBIT_DEGREES_PER_SECOND = 6;

/** The morph the velocity probe drives, and how fast it cycles. jawOpen is the largest one there is. */
const PROBE_MORPH = 'jawOpen';
const PROBE_MORPH_HZ = 0.5;

const FIXED_STEP_SECONDS = 1 / 60;

/**
 * `?blink=1` — the FASTEST morph this rig ever produces, which is the other end of the
 * morph-velocity question from `?hold`.
 *
 * A held expression and a sweeping one are different cases and were measured to disagree; a blink
 * is a third, because it is an order of magnitude faster than the jawOpen sweep. Every number here
 * is `motion/Blink.js`'s own constant, taken at the fast end of its range so this is the worst case
 * the layer can produce rather than a typical one: closing 0.050 s (range 0.050-0.100), closed hold
 * 0.010 s (0.010-0.030), opening 0.150 s (0.150-0.300), to a full closure of 0.752 morph weight.
 * At 60 Hz that is 0.25 of morph weight per frame on the way down.
 */
const BLINK_MORPHS = [ 'eyeBlinkLeft', 'eyeBlinkRight' ];
const BLINK_CLOSING_SECONDS = BLINK_CONSTANTS.CLOSING_DURATION_RANGE_SECONDS[ 0 ];
const BLINK_HOLD_SECONDS = BLINK_CONSTANTS.CLOSED_HOLD_RANGE_SECONDS[ 0 ];
const BLINK_OPENING_SECONDS = BLINK_CONSTANTS.OPENING_DURATION_RANGE_SECONDS[ 0 ];
const BLINK_FULL_CLOSURE = BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT;

/** Seconds between synthetic blinks, from `Blink.js`'s 20/min baseline. */
const BLINK_PERIOD_SECONDS = 60 / BLINK_CONSTANTS.BASELINE_RATE_PER_MINUTE;

/**
 * `?probe=grade` — the synthetic target the RENDERED grade gate measures.
 *
 * `bands` vertical strips of constant linear radiance on a geometric ladder from 1e-5 to 1, drawn
 * by one unlit quad with no figure, no rig and no backdrop in the frame. That is deliberate: the
 * black point is a property of the GRADE, and measuring it on a picture of a person makes it a
 * property of the person's silhouette as well (which is exactly how G6 came to be measuring the
 * eyelashes — `docs/PROGRESS.md`).
 */
const GRADE_PROBE_BANDS = 16;
const GRADE_PROBE_MIN_RADIANCE = 1e-5;

async function boot() {

    const query = new URLSearchParams( window.location.search );
    const hud = document.getElementById( 'hud' );

    const aa = query.get( 'aa' ) ?? 'msaa';
    const wantsGrade = query.get( 'grade' ) === '1';
    const forceWebGL = query.has( 'webgl' );

    if ( forceWebGL && ( aa === 'traa' || aa === 'taau' ) ) {

        hud.textContent = 'traa/taau need the velocity buffer, which does not exist on WebGL2.\n' +
            'Drop ?webgl or pick ?aa=msaa.';
        return;

    }

    // MSAA and temporal AA are mutually exclusive and `Stage` throws on the pair. The two
    // non-temporal modes stay on the FORWARD path so they reproduce `alive.html` exactly; the
    // grade needs the pipeline, so asking for it moves even those onto the deferred path — and
    // the HUD says which path is live, because that is a real difference in what shipped.
    const temporalAA = ( aa === 'traa' || aa === 'taau' ) ? aa : 'off';
    const multisampled = aa === 'msaa';
    const pipeline = temporalAA !== 'off' || wantsGrade;

    const stage = new Stage();

    await stage.create( document.getElementById( 'stage' ), {
        fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
        near: 0.01,
        far: 50,
        forceWebGL,
        antialias: multisampled,
        pipeline: pipeline || query.get( 'probe' ) === 'grade',
        temporalAA,
        resolutionScale: query.has( 'scale' ) ? Number( query.get( 'scale' ) ) : undefined,
        // `?sharp=none` removes the RCAS pass, which is the A side of the G4 recovery claim.
        sharpness: query.get( 'sharp' ) === 'none' ? null
            : ( query.has( 'sharp' ) ? Number( query.get( 'sharp' ) ) : undefined ),
        // `?morphvel=off` is three's unpatched behaviour and the known-bad for punch-list 3.12.
        morphVelocity: query.get( 'morphvel' ) ?? 'exact',
        // `?timestamp` turns on GPU timestamp queries. It costs a little per frame, so only the
        // page that is measuring cost asks for it — a default that carries a measurement harness
        // is measuring the harness.
        trackTimestamp: query.has( 'timestamp' )
    } );

    // 🚩 Taken over BEFORE the figure loads, not after.
    //
    // Under `?capture` this page must own every RENDERED frame, and the frames that matter most
    // are the ones nobody thinks about: `Stage.create()` starts the rAF loop, and the figure then
    // takes a variable number of hundreds of milliseconds to load. Every frame drawn in that
    // window advances the temporal filter's history and the Halton jitter index, so a run that
    // loaded fast and a run that loaded slow arrive at "frame 40" in different states. Measured
    // with the take-over placed after the load, the same configuration read temporalRms 1.6455
    // and 0.5831 on two runs — a 2.8x spread with nothing changed. With it here the two runs agree.
    const advanceRendererFrame = query.has( 'capture' ) ? takeOverFrameLoop( stage.renderer ) : null;

    stage.scene.background = new Color( 0x08080a );

    // `?vconf=32` lowers `maxVelocityLength` — how long a reported motion vector may be before
    // the temporal filter stops believing its own history. It is the one dial that can act on the
    // morph-velocity defect without touching a material: the bogus vector is LARGE (a 20 mm jaw
    // excursion is ~57 px at this framing), so a low ceiling rejects history exactly on the
    // morph-driven pixels and keeps it everywhere else.
    if ( stage.temporal !== null && query.has( 'vconf' ) ) {

        stage.temporal.setVelocityConfidence( Number( query.get( 'vconf' ) ) );

    }

    const grade = wantsGrade ? buildGrade( query ) : null;
    if ( grade !== null ) stage.setGrade( grade );

    if ( query.has( 'bare' ) ) {

        for ( const id of [ 'controls', 'hud' ] ) document.getElementById( id ).style.display = 'none';

    }

    // The grade probe replaces the whole scene, so it returns before anything loads a figure.
    if ( query.get( 'probe' ) === 'grade' ) {

        buildGradeProbe( stage, query );

        globalThis.__SUGATA_ENV__ = () => ( { ...stage.stats, aa, grade: grade !== null, probe: 'grade' } );

        // The probe has no simulation to advance, but it still has to DRAW — and under `?capture`
        // the renderer's own loop is already stopped, so a no-op step would screenshot a canvas
        // that has never been rendered into. Measured when this was a no-op: every band came back
        // at the page's own background colour, 0.031939, and four checks went red for a reason
        // that had nothing to do with the grade.
        globalThis.__SUGATA_STEP__ = async () => {

            if ( advanceRendererFrame === null ) return true;

            advanceRendererFrame( FIXED_STEP_SECONDS );
            stage.draw();

            await stage.renderer.backend?.device?.queue?.onSubmittedWorkDone();
            await nextPaint();

            return true;

        };

        return;

    }

    // `?backdrop=0x080a0f` sweeps the card's emissive. It is here because gate G6 measures the
    // WHOLE-IMAGE 0.1st percentile and the backdrop is the darkest thing in the frame, so G6 is a
    // measurement of this hex and of nothing else the grade can reach. The constant lives in
    // `alive.js`, which this agent does not own; a sweep is what turns "darken the card" into a
    // diff request with a number in it.
    const backdrop = buildBackdrop( stage, query.has( 'backdrop' )
        ? Number( query.get( 'backdrop' ) )
        : BACKDROP_EMISSIVE );

    const frameMode = query.get( 'frame' ) === 'body' ? 'body' : 'portrait';

    const lights = new LightingRig( { preset: frameMode, shadows: query.get( 'shadows' ) !== '0' } );
    lights.attachTo( stage.scene, stage.renderer );

    const session = {
        frameMode,
        figure: null,
        skin: null,
        eyes: null,
        focus: new Vector3(),
        distanceMetres: 1,
        orbitRate: query.has( 'orbit' ) ? Number( query.get( 'orbit' ) ) : 0,
        morphing: query.get( 'morph' ) === '1',

        // `?hold=0.8` pins the probe morph at a CONSTANT weight, which is the decisive velocity
        // test rather than the obvious one. A morph that is not changing must produce no motion,
        // and `Morph.js` reports the morph OFFSET instead — measured at 35.5 px/frame on a static
        // sphere, byte-identical whether the weight is held or swept. So a held morph under a
        // still camera is a frame where every honest motion vector is zero and this rig's face
        // hands the temporal filter a large one.
        morphHold: query.has( 'hold' ) ? Number( query.get( 'hold' ) ) : null,

        // `?blink=1` drives the two eyelid morphs through Blink.js's fastest profile. See
        // BLINK_CLOSING_SECONDS: a held morph, a swept morph and a blink are three different
        // rates, and the record disagreed about them because only two had been measured.
        blinking: query.get( 'blink' ) === '1',
        elapsedSeconds: 0
    };

    await loadFigure( session, stage, lights, backdrop, query );

    bindControls( query );

    // One simulated frame. Every clock the page has comes through here so a capture and a live
    // run cannot drift into being different simulations.
    const advance = ( deltaSeconds ) => {

        session.elapsedSeconds += deltaSeconds;

        if ( session.orbitRate !== 0 ) aimCamera( stage, session );

        const weight = session.morphHold !== null
            ? session.morphHold
            : ( session.morphing ? ( Math.sin( session.elapsedSeconds * PROBE_MORPH_HZ * Math.PI * 2 ) + 1 ) / 2 : null );

        const lidWeight = session.blinking ? blinkWeightAt( session.elapsedSeconds ) : null;

        if ( ( weight !== null || lidWeight !== null ) && session.figure !== null ) {

            session.figure.beginFrame();

            if ( weight !== null ) session.figure.setMorph( PROBE_MORPH, weight );

            if ( lidWeight !== null ) {

                for ( const morph of BLINK_MORPHS ) session.figure.setMorph( morph, lidWeight );

            }

            session.figure.commit();

        }

    };

    // With `?capture` the frame loop stops advancing the simulation and the caller owns the
    // clock, so a stepping tool and the rAF loop can never both advance the same frame.
    if ( query.has( 'capture' ) === false ) stage.onFrame( advance );

    // A held morph has to be written once even when nothing is advancing the clock, or `?hold`
    // with `?capture` and no steps would render the un-morphed face.
    advance( 0 );

    // `advanceRendererFrame` was taken over above, before the figure loaded. Temporal AA
    // accumulates one history sample per RENDERED frame and the grain reseeds on `frameId`, so a
    // stepping tool that advances only the simulation is measuring an unknown number of renders
    // per step — `docs/LEARNINGS.md` §1.24 in its other direction.
    globalThis.__SUGATA_STEP__ = async ( deltaSeconds = FIXED_STEP_SECONDS ) => {

        if ( session.figure === null ) return false;

        advance( deltaSeconds );

        if ( advanceRendererFrame !== null ) {

            advanceRendererFrame( deltaSeconds );

            // `stage.draw()`, never `renderer.render()`: on the deferred path the pipeline is
            // what binds the MRT and runs the temporal resolve and the grade.
            stage.draw();

            await stage.renderer.backend?.device?.queue?.onSubmittedWorkDone();
            await nextPaint();

        }

        return true;

    };

    globalThis.__SUGATA_ENV__ = () => ( { ...stage.stats, aa, grade: grade !== null } );

    // GPU milliseconds for the last completed frame, from the renderer's own timestamp query.
    // `null` without `?timestamp`, so a caller that forgot the flag reads nothing rather than a
    // zero it might mistake for a free frame.
    globalThis.__SUGATA_GPU_MS__ = async () => {

        if ( query.has( 'timestamp' ) === false ) return null;

        // 🚩 `info.render.timestamp` stays at 0 until the query is resolved. Reading it without
        // this await returns a plausible zero, which reads as "the frame is free".
        await stage.renderer.resolveTimestampsAsync( 'render' );

        return stage.renderer.info.render.timestamp;

    };

    setInterval( () => {

        if ( query.has( 'bare' ) ) return;

        const stats = stage.stats;
        hud.textContent = [
            `backend  ${ stats.backend }   ${ stats.deferred ? 'deferred' : 'forward' }`,
            `aa       ${ aa }   msaa ${ stats.msaa }   temporal ${ stats.temporalAA }   scale ${ stats.resolutionScale }`,
            `grade    ${ stats.graded ? `${ grade.toneCurveName }  bloom ${ grade.bloomStrength.value } ` +
                `grain ${ grade.grainSigmaCodes.value }/255  vignette ${ grade.vignette.value }` : 'off' }`,
            `frame    ${ stats.fps.toFixed( 1 ) } fps   ${ stats.frameMs.toFixed( 2 ) } ms cpu   ` +
                `${ stats.drawCalls } draws   ${ ( stats.triangles / 1000 ).toFixed( 0 ) }k tris`,
            `motion   orbit ${ session.orbitRate }   morph ${ session.morphing ? PROBE_MORPH : 'off' }` +
                `   hold ${ session.morphHold ?? 'off' }   blink ${ session.blinking ? 'fast' : 'off' }`,
            `morphvel ${ stats.morphVelocity }   offsets ${ ( session.morphOffsetBytes / 1e6 ).toFixed( 1 ) } MB`
        ].join( '\n' );

    }, 250 );

}

// --- the scene -------------------------------------------------------------------------------

/**
 * The same emissive black card `alive.html` stands the figure against.
 *
 * Reproduced here because the backdrop is not scenery for this page — it is the darkest thing in
 * a full-body frame, so it is what gate G6's whole-image p0.1 is actually measuring. A page about
 * the grade that used a different backdrop would report a different black point for a reason that
 * had nothing to do with the grade.
 */
function buildBackdrop( stage, emissiveHex ) {

    const material = new MeshStandardNodeMaterial();
    material.color.setHex( 0x000000 );
    material.emissive.setHex( emissiveHex );
    material.roughness = 1;
    material.metalness = 0;

    const backdrop = new Mesh( new PlaneGeometry( 8, 6 ), material );
    stage.add( backdrop );

    return backdrop;

}

async function loadFigure( session, stage, lights, backdrop, query ) {

    const identity = new Identity( { gender: Number( query.get( 'gender' ) ?? 0.5 ) } );
    const plan = await identity.resolve();
    const url = plan.figures[ 0 ].url;

    const figure = await Figure.load( url );

    // `?skin=0` keeps the shipped GLB material, exactly as `alive.html` does. It is also the
    // safety net for a shared tree: `material/SkinMaterial.js` belongs to another agent and a
    // half-saved edit there would otherwise take this page down and quietly turn a grade
    // measurement into a measurement of a broken import.
    let skin = null;

    if ( query.get( 'skin' ) !== '0' ) {

        try {

            skin = await createSkinMaterial( {
                albedoMap: figure.body.material.map ?? null,
                curvatureMapUrl: curvatureMapUrlFor( url.slice( url.lastIndexOf( '/' ) + 1 ).replace( '.glb', '' ) )
            } );

        } catch ( error ) {

            console.warn( `post: skin material unavailable, using the shipped GLB material — ${ error.message }` );

        }

    }

    stage.add( figure.root );
    figure.root.updateMatrixWorld( true );

    const poseName = query.get( 'pose' ) ?? DEFAULT_REST_POSE;

    if ( poseName !== 'bind' ) {

        const skeleton = new Skeleton( figure.root );
        RestPose.load( poseName ).applyTo( skeleton );
        skeleton.update();
        figure.root.updateMatrixWorld( true );

    }

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        object.castShadow = true;
        object.receiveShadow = true;

    } );

    // `?specaa=1` — punch-list 3.11, run as an experiment FROM THE PAGE.
    //
    // The fix belongs in `material/SkinMaterial.js`, which this agent does not own, so it is
    // applied here to the material instance this page constructed. That is a page-level A/B, not
    // an edit to the material: `render/Toksvig.js` supplies the node, the round report carries
    // the diff request, and this switch is what makes the claim measurable in the meantime.
    //
    // `normalView` is deliberately the SHADING normal — the one `material.normalNode` has already
    // perturbed with the micro-normal. That is the whole point: three's own specular AA takes
    // derivatives of `normalViewGeometry`, the interpolated VERTEX normal, so the micro-normal is
    // invisible to it.
    if ( skin !== null && query.get( 'specaa' ) === '1' ) {

        const base = skin.roughnessNode ?? float( skin.roughness );
        skin.roughnessNode = filteredRoughness( base, normalView );
        skin.needsUpdate = true;

        console.log( 'post: normal-variance roughness (3.11) applied to the skin material' );

    }

    if ( skin !== null ) applySkinMaterial( figure, skin );

    try {

        const eyes = new EyeMaterial( { figure } );
        eyes.attach();
        session.eyes = eyes;

    } catch ( error ) {

        console.warn( `eye material not applied: ${ error.message }` );

    }

    session.figure = figure;
    session.skin = skin;

    // Printed rather than asserted: `render/MorphVelocity.js` re-encodes the position offsets
    // because three's copy is unreachable, and the size of that second copy is the whole cost of
    // the fix. A comment could go stale; this cannot.
    session.morphOffsetBytes = 0;

    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true ) session.morphOffsetBytes += morphOffsetBytes( object.geometry );

    } );

    console.log( `post: morph offset re-encoding costs ${ ( session.morphOffsetBytes / 1e6 ).toFixed( 2 ) } MB` );

    frameFigure( stage, session, figure );

    lights.aimAt( {
        focus: session.focus,
        subjectHeightMetres: session.framedHeightMetres,
        cameraPosition: stage.camera.position
    } );

    if ( session.eyes !== null ) {

        const key = lights.units.find( ( unit ) => unit.placement.name === 'key' );

        if ( key !== undefined ) {

            session.eyes.keyLightDirectionUniform.value
                .copy( key.area.position ).sub( session.focus ).normalize();

        }

    }

    backdrop.position.set( session.focus.x, session.focus.y, session.focus.z - BACKDROP_DISTANCE_METRES );

}

/** alive.js' framing maths, reproduced so the plates line up pixel for pixel. */
function frameFigure( stage, session, figure ) {

    figure.root.updateMatrixWorld( true );

    const bounds = new Box3().setFromObject( figure.root );

    session.framedHeightMetres = session.frameMode === 'body'
        ? ( bounds.max.y - bounds.min.y ) * BODY_FRAME_MARGIN
        : PORTRAIT_HEIGHT_METRES;

    session.focus = session.frameMode === 'body'
        ? new Vector3( 0, ( bounds.min.y + bounds.max.y ) / 2, 0 )
        : new Vector3( 0, eyeLineHeight( figure ) + session.framedHeightMetres * ( EYE_LINE_FROM_TOP - 0.5 ), 0 );

    const halfFieldOfView = ( PORTRAIT_FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180;
    session.distanceMetres = ( session.framedHeightMetres / 2 ) / Math.tan( halfFieldOfView );

    aimCamera( stage, session );

}

/**
 * Places the camera at the framing azimuth plus however far the orbit has turned.
 *
 * The orbit is what punch-list 3.11 means by "verify with a MOVING camera": specular aliasing is
 * a temporal artefact, and a still frame of a shimmering surface looks exactly like a still frame
 * of a stable one.
 */
function aimCamera( stage, session ) {

    const azimuth = ( CAMERA_AZIMUTH_DEGREES + session.orbitRate * ORBIT_DEGREES_PER_SECOND * session.elapsedSeconds )
        * Math.PI / 180;

    stage.camera.position.set(
        session.focus.x + Math.sin( azimuth ) * session.distanceMetres,
        session.focus.y,
        session.focus.z + Math.cos( azimuth ) * session.distanceMetres
    );

    stage.camera.lookAt( session.focus );

}

/** Two rAF ticks: the GPU being done is not the compositor having painted. */
function nextPaint() {

    return new Promise( ( resolve ) => {

        requestAnimationFrame( () => requestAnimationFrame( resolve ) );

    } );

}

/**
 * Takes the renderer's per-frame tick away from requestAnimationFrame so a capture can drive it.
 *
 * Same implementation as `alive.js`'s, and duplicated for the same reason the framing constants
 * are: two browsercheck pages that import each other's internals stop being independently
 * readable. If this drifts from `alive.js` the symptom is a temporal measurement here that does
 * not reproduce there, which is visible rather than silent.
 */
function takeOverFrameLoop( renderer ) {

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

    console.warn( 'post: could not reach renderer._animation / _nodes.nodeFrame; rAF still owns the frame.' );

    return null;

}

function eyeLineHeight( figure ) {

    let eyeballs = null;

    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && EYEBALL_MESH_PATTERN.test( object.name ) ) eyeballs = object;

    } );

    if ( eyeballs === null ) {

        console.warn( 'post: no eyeball mesh found — the portrait crop is a guess.' );
        return new Box3().setFromObject( figure.root ).max.y - 0.11;

    }

    return new Box3().setFromObject( eyeballs ).getCenter( new Vector3() ).y;

}

/**
 * The eyelid morph weight at a given moment of the synthetic blink cycle.
 *
 * Piecewise linear rather than eased, on purpose: the quantity under test is the per-frame CHANGE
 * in morph weight, and a linear ramp states it exactly (0.752 over 0.050 s = 15.04 per second,
 * 0.2507 per frame at 60 Hz) instead of leaving it to be read off a curve.
 */
function blinkWeightAt( elapsedSeconds ) {

    const phase = elapsedSeconds % BLINK_PERIOD_SECONDS;

    if ( phase < BLINK_CLOSING_SECONDS ) {

        return BLINK_FULL_CLOSURE * ( phase / BLINK_CLOSING_SECONDS );

    }

    const held = phase - BLINK_CLOSING_SECONDS;

    if ( held < BLINK_HOLD_SECONDS ) return BLINK_FULL_CLOSURE;

    const opening = held - BLINK_HOLD_SECONDS;

    if ( opening < BLINK_OPENING_SECONDS ) {

        return BLINK_FULL_CLOSURE * ( 1 - opening / BLINK_OPENING_SECONDS );

    }

    return 0;

}

// --- the grade --------------------------------------------------------------------------------

/**
 * `?probe=grade` — vertical strips of constant linear radiance, and nothing else in the frame.
 *
 * The strips are laid out in SCREEN space rather than as geometry so their boundaries land on
 * exact pixel columns at any viewport size, which is what lets a gate say "column 240 to 280 is
 * band 4" without a projection calculation.
 *
 * The ladder is geometric from `GRADE_PROBE_MIN_RADIANCE` to 1, so the dark half of it is where
 * the black point lives and the bright half is where the grain's midtone sigma can be measured.
 * Band 0 is forced to exactly zero, so one strip is a true black and the gate has a reference for
 * "what does the pipeline put on screen when nothing is there".
 */
function buildGradeProbe( stage, query ) {

    const bands = query.has( 'bands' ) ? Number( query.get( 'bands' ) ) : GRADE_PROBE_BANDS;

    const index = screenUV.x.mul( bands ).floor().clamp( 0, bands - 1 );

    // 10^(log10(min) * (1 - t)) with t = index / (bands - 1): 10^log10(min) at t=0 rising to 1.
    const decades = Math.log10( GRADE_PROBE_MIN_RADIANCE );
    const exponent = index.div( bands - 1 ).oneMinus().mul( decades );
    const radiance = float( 10 ).pow( exponent );

    // Band 0 is exact zero, so the frame contains a true black to measure against.
    const level = index.lessThan( 0.5 ).select( float( 0 ), radiance );

    const material = new MeshBasicNodeMaterial();
    material.colorNode = vec3( level );
    material.toneMapped = false;
    material.depthWrite = false;

    // A unit quad parented to the camera at the near plane, scaled to overfill the frustum. Sized
    // from the camera rather than from the scene so it fills the frame at any aspect ratio.
    const quad = new Mesh( new PlaneGeometry( 2, 2 ), material );
    quad.frustumCulled = false;
    quad.position.set( 0, 0, -1 );

    const halfHeight = Math.tan( ( stage.camera.fov / 2 ) * Math.PI / 180 );
    quad.scale.set( halfHeight * 4, halfHeight * 4, 1 );

    stage.camera.add( quad );
    stage.scene.add( stage.camera );
    stage.scene.background = new Color( 0x000000 );

    globalThis.__SUGATA_GRADE_PROBE__ = () => ( { bands, minRadiance: GRADE_PROBE_MIN_RADIANCE } );

    return quad;

}

function buildGrade( query ) {

    const number = ( key, fallback ) => query.has( key ) ? Number( query.get( key ) ) : fallback;

    return new Grade( {
        toneCurve: query.get( 'tone' ) ?? 'aces',
        exposure: number( 'exposure', 1 ),
        bloomStrength: number( 'bloom', undefined ),
        bloomThreshold: number( 'thresh', undefined ),
        grainSigmaCodes: number( 'grain', undefined ),
        vignette: number( 'vignette', undefined ),
        saturation: number( 'sat', undefined ),
        sharpness: query.has( 'gsharp' ) ? Number( query.get( 'gsharp' ) ) : null,
        // 🚩 `?graindefect=flat` and friends REBUILD A DEFECT. It is how the rendered gate proves
        // itself red; see GRAIN_DEFECTS in render/Grade.js.
        rebuildGrainDefect: query.get( 'graindefect' ) ?? null
    } );

}

// --- controls ---------------------------------------------------------------------------------

/**
 * Every control reloads the page with a new query string rather than mutating live state.
 *
 * That is not laziness: MSAA is a renderer-construction flag and the temporal nodes own a frame
 * of history, so "switch from msaa to traa" is a different renderer and an empty history either
 * way. A reload makes the URL the single description of what is on screen, which is also what
 * makes a plate reproducible from its filename.
 */
function bindControls( query ) {

    const reloadWith = ( key, value ) => {

        const next = new URLSearchParams( window.location.search );

        if ( value === null ) next.delete( key );
        else next.set( key, value );

        window.location.search = next.toString();

    };

    const aa = document.getElementById( 'aa' );
    aa.value = query.get( 'aa' ) ?? 'msaa';
    aa.addEventListener( 'change', () => reloadWith( 'aa', aa.value ) );

    for ( const [ id, param ] of [ [ 'grade', 'grade' ], [ 'orbit', 'orbit' ], [ 'morph', 'morph' ] ] ) {

        const input = document.getElementById( id );
        input.checked = query.get( param ) === '1';
        input.addEventListener( 'change', () => reloadWith( param, input.checked ? '1' : null ) );

    }

}

boot().catch( ( error ) => {

    document.getElementById( 'hud' ).textContent = `post.html failed to boot:\n${ error.stack ?? error.message }`;
    console.error( error );

} );
