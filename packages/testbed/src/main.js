/**
 * Sugata testbed — Phase 0.1 harness.
 *
 * Proves the renderer scaffold end to end: WebGPU (or WebGL2) comes up, the canvas resizes and
 * respects devicePixelRatio, a node material shades correctly under an image-based environment,
 * and the HUD reports which backend actually won. Nothing here is production code; it exists so
 * that every later phase has a place to look at one thing in isolation.
 */

import {
    Color,
    Mesh,
    MeshPhysicalNodeMaterial,
    PMREMGenerator,
    SphereGeometry
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Stage } from '../../core/src/render/Stage.js';

const SPHERE_RADIUS = 0.25;

async function boot() {

    const canvas = document.getElementById( 'stage' );
    const hud = document.getElementById( 'hud' );

    // ?webgl forces the degraded WebGL2 tier so it can be eyeballed on a machine that has
    // working WebGPU. Firefox will be pushed down this path in production for dispatch-cost
    // reasons; without a switch the fallback would only ever be seen by accident.
    const forceWebGL = new URLSearchParams( window.location.search ).has( 'webgl' );

    const stage = new Stage();
    await stage.create( canvas, { fieldOfView: 35, near: 0.01, far: 50, forceWebGL } );

    stage.scene.background = new Color( 0x0b0b0d );
    stage.scene.environment = buildRoomEnvironment( stage.renderer );

    stage.add( buildTestSphere() );

    const controls = new OrbitControls( stage.camera, canvas );
    controls.enableDamping = true;
    controls.target.set( 0, 0, 0 );
    stage.camera.position.set( 0, 0.15, 1.1 );
    controls.update();

    stage.onFrame( () => controls.update() );
    stage.onFrame( () => updateHud( hud, stage.stats ) );

    // Handy for poking at the scene from the browser console during a spike.
    window.stage = stage;

}

/**
 * A neutral studio-ish IBL. RoomEnvironment is a box of emissive panels; PMREMGenerator
 * pre-filters it into the roughness-mipped cube the physical material samples.
 *
 * Note for later: PMREMGenerator.fromSceneAsync() is deprecated since r180 — awaiting
 * renderer.init() (which Stage.create already does) is the supported way to be ready.
 */
function buildRoomEnvironment( renderer ) {

    const pmrem = new PMREMGenerator( renderer );
    const room = new RoomEnvironment();
    const environmentTarget = pmrem.fromScene( room, 0.04 );

    room.dispose();
    pmrem.dispose();

    return environmentTarget.texture;

}

/**
 * One lit sphere on a node material — the smallest thing that proves the TSL material path
 * compiles and shades on whichever backend came up.
 */
function buildTestSphere() {

    const material = new MeshPhysicalNodeMaterial( {
        color: 0xc8ccd4,
        metalness: 0.1,
        roughness: 0.25,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2
    } );

    return new Mesh( new SphereGeometry( SPHERE_RADIUS, 128, 64 ), material );

}

function updateHud( hud, stats ) {

    hud.textContent = [
        `backend   ${ stats.backend }`,
        `fps       ${ stats.fps.toFixed( 1 ) }`,
        `frame cpu ${ stats.frameMs.toFixed( 2 ) } ms`,
        `dpr       ${ stats.dpr }`,
        `draws     ${ stats.drawCalls }`,
        `tris      ${ stats.triangles }`
    ].join( '\n' );

}

// The one catch-all: this is the boundary where a failure has to become something a human
// can read. Backend acquisition and shader compilation both fail here, not deeper down.
boot().catch( ( error ) => {

    document.getElementById( 'hud' ).textContent = `boot failed\n${ error.message }`;
    console.error( error );

} );
