import { AttentionAction } from '../../core/src/motion/AttentionAction.js';
import { Avatar } from '../../core/src/Avatar.js';
import { portraitSelection, validatePortraitHair } from './portrait-selection.mjs';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = new URLSearchParams( location.search );
const hair = params.get( 'hair' ) ?? 'bob02';
const captured = params.has( 'capture' );
const reducedMotion = matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
const canvas = document.getElementById( 'stage' );
const status = document.getElementById( 'status' );
const pauseButton = document.getElementById( 'pause' );
let avatar = null;
let controls = null;
let attention = null;
let attentionError = null;
let paused = reducedMotion;
let frame = 0;
let previousTime = null;

function showFailure( reason ) {
    cancelAnimationFrame( frame );
    attention?.cancel( { immediate: true } );
    document.getElementById( 'loading' ).hidden = true;
    const error = document.getElementById( 'error' );
    error.textContent = `The portrait could not load.\n${ reason?.message ?? reason }`;
    error.hidden = false;
    status.textContent = 'Portrait unavailable';
}
addEventListener( 'error', event => showFailure( event.error ?? event.message ) );
addEventListener( 'unhandledrejection', event => showFailure( event.reason ) );

function updatePause() {
    pauseButton.textContent = paused ? 'Resume motion' : 'Pause motion';
    pauseButton.setAttribute( 'aria-pressed', String( paused ) );
    status.textContent = paused ? 'Motion paused · you can still explore' : 'Live portrait';
    updateAttention();
}

function updateAttention() {
    const phase = attention?.phase ?? 'idle';
    for ( const id of [ 'look-toward-me', 'look-with-smile' ] )
        document.getElementById( id ).disabled = paused || attention === null;
    document.getElementById( 'release-attention' ).disabled = phase !== 'attending';
    const message = paused ? 'Resume motion to try attention.' : attentionError ?? (
        phase === 'attending' ? ( attention.expression === 'soft-smile' ? 'Looking toward you with a small smile' : 'Looking toward this view' ) :
        phase === 'releasing' ? 'Returning to idle' : 'Ready when you are' );
    const label = document.getElementById( 'attention-status' );
    if ( label.textContent !== message ) label.textContent = message;
}

// All rendering goes through Avatar.update/step, including paused frames. The runtime owns the
// material, physics, motion composition, and post pipeline; this page owns only the viewing clock.
function animate( time ) {
    const delta = previousTime === null ? 0 : Math.min( ( time - previousTime ) / 1000, 0.05 );
    previousTime = time;
    controls.update();
    avatar.update( paused ? 0 : delta );
    updateAttention();
    frame = requestAnimationFrame( animate );
}

document.addEventListener( 'visibilitychange', () => { previousTime = null; } );

try {
    const selection = portraitSelection( params );
    if ( params.getAll( 'hair' ).length > 1 ) throw new Error( 'Duplicate URL hair selection.' );
    validatePortraitHair( hair, selection.bake );
    if ( selection.bake !== 'g050' ) document.querySelector( '#hair-style option[value="bob02"]' ).disabled = true;
    document.getElementById( 'hair-style' ).value = hair;
    document.getElementById( 'portrait-name' ).textContent = hair === 'bob02'
        ? 'The chin-length bob' : 'The original long bob';
    avatar = await Avatar.create( { canvas, identity: { gender: selection.gender }, hair,
        autoStart: false, frame: 'portrait', lighting: 'studio', seed: 20260807 } );
    attention = new AttentionAction( avatar );
    controls = new OrbitControls( avatar.stage.camera, canvas );
    controls.target.copy( avatar.focus );
    // Frame the top of the groom as well as the skin. This is a viewer composition offset;
    // the avatar's calibrated light target and the comparison between styles stay unchanged.
    controls.target.y += 0.045;
    avatar.stage.camera.position.y += 0.045;
    controls.enablePan = false;
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.1;
    const distance = avatar.stage.camera.position.distanceTo( avatar.focus );
    controls.minDistance = distance * 0.7;
    controls.maxDistance = distance * 1.5;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.72;
    controls.update();
    controls.saveState();
    await avatar.step( 0 );
    const report = avatar.report();
    if ( report.hair?.attached !== true ) throw new Error( `The ${ hair } groom did not attach.` );
    document.getElementById( 'loading' ).hidden = true;
    for ( const el of document.querySelectorAll( 'fieldset, #pause, #reset-view' ) ) el.disabled = false;
    updatePause();

    const expressions = {
        calm: { pleasure: 0.08, arousal: 0, dominance: 0.05 },
        joy: { pleasure: 0.7, arousal: 0.25, dominance: 0.35 },
        curious: { pleasure: 0.15, arousal: 0.5, dominance: 0.05 },
        determined: { pleasure: 0, arousal: 0.4, dominance: 0.85 }
    };
    for ( const button of document.querySelectorAll( '[data-expression]' ) ) {
        button.addEventListener( 'click', () => {
            avatar.feel( expressions[ button.dataset.expression ] );
            for ( const peer of document.querySelectorAll( '[data-expression]' ) )
                peer.setAttribute( 'aria-pressed', String( peer === button ) );
        } );
    }
    for ( const button of document.querySelectorAll( '[data-light]' ) ) {
        button.addEventListener( 'click', () => {
            avatar.setLighting( button.dataset.light );
            for ( const peer of document.querySelectorAll( '[data-light]' ) )
                peer.setAttribute( 'aria-pressed', String( peer === button ) );
        } );
    }
    for ( const [ id, expression ] of [ [ 'look-toward-me', 'neutral' ], [ 'look-with-smile', 'soft-smile' ] ] )
        document.getElementById( id ).addEventListener( 'click', () => {
            if ( paused ) return;
            try {
                attention.lookAtCamera( avatar.stage.camera, { expression } );
                attentionError = null;
            } catch ( error ) { attentionError = error.message; }
            updateAttention();
        } );
    document.getElementById( 'release-attention' ).addEventListener( 'click', () => {
        attention.cancel();
        updateAttention();
    } );
    controls.addEventListener( 'start', () => {
        attention.cancel();
        attentionError = null;
        updateAttention();
    } );
    pauseButton.addEventListener( 'click', () => {
        paused = !paused;
        if ( paused ) attention.cancel( { immediate: true } );
        updatePause();
    } );
    document.getElementById( 'reset-view' ).addEventListener( 'click', () => {
        attention.cancel();
        attentionError = null;
        controls.reset();
        updateAttention();
    } );
    document.getElementById( 'hair-style' ).addEventListener( 'change', event => {
        // A fresh document isolates the renderer and its prototype state. Hair's current
        // patch has no uninstall, so this comparison does not claim a clean in-place style swap.
        const url = new URL( location.href );
        url.searchParams.set( 'hair', event.target.value );
        location.assign( url );
    } );
    window.avatar = avatar;
    window.portrait = { avatar, controls, attention, step: async delta => {
        if ( !captured ) throw new Error( 'Manual stepping requires ?capture.' );
        controls.update();
        await avatar.step( paused ? 0 : delta );
        updateAttention();
    } };
    if ( !captured ) frame = requestAnimationFrame( animate );
} catch ( error ) { showFailure( error ); }

addEventListener( 'pagehide', event => {
    cancelAnimationFrame( frame );
    attention?.cancel( { immediate: true } );
    if ( event.persisted ) return;
    attention?.dispose();
    controls?.dispose();
    avatar?.dispose();
} );

addEventListener( 'pageshow', event => {
    if ( event.persisted && avatar !== null && !captured ) {
        previousTime = null;
        frame = requestAnimationFrame( animate );
    }
} );
