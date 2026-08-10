/**
 * wardrobe — the punch-list 9.1 / 9.2 / 9.3 / 9.5 / 9.8 / 9.13 browsercheck.
 *
 * The failure this page exists to catch is a dressed figure that looks plausible in a triangle
 * count and wrong on screen. `wardrobe.selftest.mjs` proves the rebuilt index buffer is
 * geometrically identical to the baked one; it cannot tell you that the garment is on the body,
 * facing the right way, moving with the skeleton, and that the skin underneath really went away.
 * So this page draws it, and prints the same numbers beside it.
 *
 * ## Toggle state of every plate taken here
 *
 * Forward path, no G-buffer, no temporal AA, no grade, MSAA off, `morphVelocity` inert on the
 * forward path. **Deliberately not the shipped default** (`aa=taau` + grade + RCAS 1.2), because
 * this page measures geometry and draw calls rather than image quality, and the shipped default's
 * grain phase and Halton jitter make a still plate a draw rather than a value — six loads of the
 * default recipe return five distinct PNGs. Nothing on this page is a look gate; 8.1 owns those.
 *
 * ## What 9.8 and 9.13 add to it, and why they need a page at all
 *
 * `decency.selftest.mjs` proves the foundation layer covers every decency region in all 48
 * reachable states by casting a ray from each region vertex into the drawn geometry. It cannot
 * tell you the bra looks like a bra. **There is no reference for this layer anywhere in the 638
 * images the user supplied** — it is authored blind, and the standard it is authored to is that
 * nobody notices it, which is a judgement a person makes and a number does not.
 *
 * `agency.selftest.mjs` proves a pin survives a restart by rebuilding an agency from its own
 * serialised bytes. It cannot tell you that reloading the page really does bring the avatar back
 * in the same clothes, because it never loads a page. This one does, out of `localStorage`.
 *
 * ## Why this page and not alive.js
 *
 * `alive.js` carries every measured motion gate in `docs/PROGRESS.md`. Adding a wardrobe to it
 * would move numbers four other punch-list items were validated against.
 */

import { AmbientLight, Box3, DirectionalLight, Vector3 } from 'three';

import { Stage } from '../../core/src/render/Stage.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { GarmentManifest } from '../../core/src/wardrobe/GarmentManifest.js';
import { Wardrobe } from '../../core/src/wardrobe/Wardrobe.js';
import { FoundationLayer } from '../../core/src/wardrobe/FoundationLayer.js';
import { AGENCY_MODES, LocalStorageStore, MOOD_LAYER, STORE_KEY_PREFIX, WardrobeAgency }
    from '../../core/src/wardrobe/WardrobeAgency.js';

// The wardrobe-ready body: the same figure as `assets/figures/figure_g050.glb` plus the per-vertex
// `_HIDE_*` attributes for the catalogue. Kept as a separate artefact this round rather than
// replacing the shipped figure, because adding attributes changes that file's sha256 and every
// gate measured against it. The request that merges them is `docs/OPEN-REQUESTS.md` REQ-024,
// which is where its status is adjudicated rather than in a document this repository does not hold.
const BODY_URL = new URL( '../../../assets/wardrobe/body/g050.glb', import.meta.url ).href;
const MANIFEST_URL = new URL( '../../../assets/wardrobe/manifest.json', import.meta.url ).href;

// Full-body framing with a little air. The figure is about 1.7 m tall.
const FIELD_OF_VIEW_DEGREES = 30;
const FRAME_MARGIN = 1.12;
const CAMERA_AZIMUTH_DEGREES = 14;

// 🎯 Punch-list 3.9's wardrobe half, and why an ambient level is a named constant on this page.
//
// The defect three blind judges each put in their top three is that nothing worn casts a shadow
// onto the body — the fedora sits over a fully lit forehead. `Wardrobe.js` now shades every
// fragment as it adopts it, and `shadow.selftest.mjs` measures the consequence HERE, because this is
// the wardrobe's own page and `alive.js` carries motion gates a light change would move.
//
// A shadow is a RATIO of lit to unlit, so the ambient sets the measurement's floor: at 1.6 the
// darkening under a brim was there and small. 0.55 leaves the page perfectly readable and gives
// the gate a signal that a threshold can be set against without the threshold being the noise.
const AMBIENT_IRRADIANCE = 0.55;

// The shadow map's frustum, in metres around the figure. A directional light's shadow camera is
// orthographic and defaults to a 10 m box, which spends a 2048² map on nine metres of nothing.
const SHADOW_RADIUS_M = 1.2;
const SHADOW_MAP_SIZE = 2048;

// 🚩 A hat brim is a few millimetres of geometry a few centimetres from the surface it darkens, so
// the depth bias that stops a torso self-shadow-acneing is the same bias that erases the brim's
// shadow entirely. Both are set here rather than left at three's defaults, and the normal bias
// carries most of the load because it is measured in world units rather than in depth units.
const SHADOW_BIAS = -0.00015;
const SHADOW_NORMAL_BIAS = 0.004;

/**
 * A stand-in for 9.11's `Dresser`, and it is labelled one everywhere it appears on the page.
 *
 * ⚠️ It reads the mood's arousal and picks the more formal of two outfits when it is high. That is
 * NOT 9.11's design — no clo arithmetic, no Schiavon & Lee equation, no colour mapping — and the
 * whole reason it is this thin is that what this page is showing is the AGENCY: who is allowed to
 * change the avatar's clothes, and when. 9.11 drops into the same seam.
 */
class StandInDresser {

    constructor( manifest ) {

        this.manifest = manifest;

    }

    choose( context ) {

        return context.mood.arousal > 0
            ? [ 'female_elegantsuit01', 'shoes01', 'fedora01' ]
            : [ 'female_casualsuit01', 'shoes01' ];

    }

    explain( context ) {

        return context.mood.arousal > 0
            ? 'arousal is up, so something sharper — STAND-IN for 9.11, not its design'
            : 'a quiet mood, so the casual suit — STAND-IN for 9.11, not its design';

    }

}

/** The mood the page hands the agency. Slider-free: two buttons is enough to show the gate. */
let pageMood = { layer: MOOD_LAYER, pleasure: 0.2, arousal: -0.3, dominance: 0.0 };

const elements = {
    garments: document.getElementById( 'garments' ),
    foundation: document.getElementById( 'foundation' ),
    modes: document.getElementById( 'modes' ),
    agency: document.getElementById( 'agency' ),
    preferences: document.getElementById( 'preferences' ),
    occlusion: document.getElementById( 'occlusion' ),
    stats: document.getElementById( 'stats' ),
    masks: document.getElementById( 'masks' ),
    manifest: document.getElementById( 'manifest' ),
    env: document.getElementById( 'env' ),
    status: document.getElementById( 'status' )
};

function setStatus( message, className = 'info' ) {

    elements.status.className = className;
    elements.status.textContent = message;

}

function table( rows ) {

    return '<table>' + rows.map( ( row ) =>
        `<tr><th>${ row[ 0 ] }</th><td class="${ row[ 2 ] ?? '' }">${ row[ 1 ] }</td></tr>`
    ).join( '' ) + '</table>';

}

async function main() {

    setStatus( 'loading the body and the manifest…' );

    const stage = await new Stage().create( document.getElementById( 'view' ), {
        fieldOfView: FIELD_OF_VIEW_DEGREES
    } );

    stage.scene.add( new AmbientLight( 0xffffff, AMBIENT_IRRADIANCE ) );

    // Three plain directionals rather than the measured RectAreaLight rig. This page is about
    // geometry, and a light rig copied from the look spec would invite the plates to be read as
    // look plates, which they are not.
    //
    // 🎯 The FIRST one casts, and that is new. `shadow.selftest.mjs` measures the forehead under a hat
    // brim against the same forehead with the brim's shadow switched off, so this page needs
    // exactly one shadow caster — one, because two would light the brim's shadow back in from the
    // side and the measurement would be of the rig rather than of the garment.
    const lights = [ [ 2, 3, 3, 2.4 ], [ -3, 2, 1, 1.1 ], [ 0, 2, -4, 1.6 ] ].map(
        ( [ x, y, z, intensity ] ) => {

            const light = new DirectionalLight( 0xffffff, intensity );
            light.position.set( x, y, z );
            stage.scene.add( light );
            return light;

        } );

    configureShadowCaster( stage, lights[ 0 ] );

    const [ figure, manifest ] = await Promise.all( [
        Figure.load( BODY_URL ),
        GarmentManifest.load( MANIFEST_URL )
    ] );

    stage.add( figure.root );
    applyFigureShading( figure );

    // 🎯 9.8. The floor is a function on the foundation layer, handed to the wardrobe once. From
    // here there is no call that can put this figure on screen without it.
    const foundation = new FoundationLayer( manifest, restoredPreference() );

    const wardrobe = new Wardrobe( figure, manifest, {
        figureKey: 'g050',
        decencyFloor: foundation.floor
    } );

    // 🎯 9.13. A real `localStorage` store, so a reload is a real restart.
    const agency = new WardrobeAgency( wardrobe, {
        dresser: new StandInDresser( manifest ),
        store: new LocalStorageStore(),
        profile: 'browsercheck'
    } );

    frameFigure( stage, figure );
    renderManifest( manifest );
    renderMasks( wardrobe );
    renderGarmentButtons( wardrobe, manifest );
    renderFoundationButtons( wardrobe, foundation );
    renderModeButtons( agency, wardrobe, foundation );
    renderStats( wardrobe );
    renderEnvironment( stage, wardrobe );

    setStatus( 'waking — the body does not draw until the foundation layer is on.' );

    // The figure is not drawn until this resolves. See Wardrobe's constructor: a bare frame
    // between construction and the first dress is a frame, and `decency.selftest.mjs` caught six.
    await run( wardrobe, () => agency.wake(), agency, foundation );

    setStatus( `ready — ${ agency.mode }, wearing ${ wardrobe.worn.join( ', ' ) }.`, 'pass' );

    // The handle the browsercheck screenshots are driven through, and the one an agent embedding
    // this library would reach for.
    // Both entry points go through `run`, so a plate driven from the console and a plate driven
    // from a button cannot disagree — the status line saying "undressed" over a dressed figure is
    // a small lie, and a browsercheck's whole job is not telling small lies.
    window.sugataWardrobe = {
        wardrobe,
        foundation,
        agency,
        figure,
        stage,
        dress: ( ids ) => run( wardrobe, () => wardrobe.dress( ids ), agency, foundation ),
        undress: () => run( wardrobe, () => wardrobe.undress(), agency, foundation ),
        prefer: ( slot, id ) => {
            foundation.prefer( slot, id );
            savePreference( foundation );
            return run( wardrobe, () => wardrobe.dress( wardrobe.worn ), agency, foundation );
        },
        setMood: ( arousal ) => { pageMood = { ...pageMood, arousal }; return pageMood; },
        stats: () => wardrobe.stats(),
        shading: () => wardrobe.shadingOf(),
        agencyState: () => agency.state()
    };

    // 🎯 3.9's wardrobe half, measured rather than configured. See `stageShadowProbe`.
    window.sugataWardrobe.stageShadowProbe = ( request ) =>
        stageShadowProbe( { stage, figure, wardrobe }, request );

    document.getElementById( 'dress-all' ).addEventListener( 'click', () => {

        run( wardrobe, () => wardrobe.dress( [ 'female_casualsuit01', 'shoes01', 'fedora01' ] ),
            agency, foundation );

    } );

    document.getElementById( 'undress' ).addEventListener( 'click', () => {

        run( wardrobe, () => wardrobe.undress(), agency, foundation );

    } );

    document.getElementById( 'pin-current' ).addEventListener( 'click', () => {

        run( wardrobe, () => agency.pin( null, { by: 'user' } ), agency, foundation );

    } );

    document.getElementById( 'ai-consider' ).addEventListener( 'click', () => {

        run( wardrobe, async () => {

            const outcome = await agency.consider( pageContext() );

            if ( outcome.status === 'awaiting-user' ) {

                const accepted = globalThis.confirm(
                    `The AI would like to wear ${ outcome.preference.outfit.join( ', ' ) }.\n\n` +
                    `${ outcome.preference.reason }` );

                if ( accepted ) return agency.confirm( outcome.preference.at.toString(), { by: 'user' } );

                agency.decline( outcome.preference.at.toString(), { by: 'user' } );

            }

            return wardrobe.stats();

        }, agency, foundation );

    } );

    document.getElementById( 'forget' ).addEventListener( 'click', () => {

        globalThis.localStorage?.removeItem( `${ STORE_KEY_PREFIX }:browsercheck` );
        globalThis.localStorage?.removeItem( FOUNDATION_PREFERENCE_KEY );
        globalThis.location.reload();

    } );

}

/** The selection context this page hands the agency. The mood is the page's, not the affect layer's. */
function pageContext() {

    return {
        mood: pageMood,
        temperatureC: 18,
        formality: 2,
        timeOfDay: 'afternoon'
    };

}

/**
 * Where the foundation preference is remembered.
 *
 * ⚠️ Separate from the agency's own key on purpose: which bra the identity wears is a property of
 * the IDENTITY, not of who is allowed to change the outfit, and 9.13 can be switched to `agent`
 * without that being a licence to swap the underwear.
 */
const FOUNDATION_PREFERENCE_KEY = 'sugata.wardrobe.foundation.v1:browsercheck';

function restoredPreference() {

    try {

        return { preference: JSON.parse( globalThis.localStorage?.getItem( FOUNDATION_PREFERENCE_KEY ) ?? '{}' ) };

    } catch ( error ) {

        console.warn( `foundation preference is not JSON (${ error.message }); using the default.` );
        return {};

    }

}

function savePreference( foundation ) {

    globalThis.localStorage?.setItem( FOUNDATION_PREFERENCE_KEY, JSON.stringify( foundation ) );

}

async function run( wardrobe, action, agency = null, foundation = null ) {

    try {

        setStatus( 'loading fragments…' );
        const stats = await action();
        refresh( wardrobe, agency, foundation );
        setStatus( `worn: ${ wardrobe.worn.join( ', ' ) || 'nothing' }`, 'pass' );
        return stats;

    } catch ( error ) {

        // The conflict rule lands here, and it is the point: MPFB attaches two suits with no
        // warning at all, so a refusal a user can read is the feature.
        setStatus( error.message, 'fail' );
        refresh( wardrobe, agency, foundation );
        return wardrobe.stats();

    }

}

function refresh( wardrobe, agency = null, foundation = null ) {

    renderStats( wardrobe );
    renderOcclusion( wardrobe );

    for ( const button of elements.garments.querySelectorAll( 'button[data-garment]' ) ) {

        button.setAttribute( 'aria-pressed',
            String( wardrobe.worn.includes( button.dataset.garment ) ) );

    }

    if ( foundation !== null ) {

        const floor = foundation.currentFloor();

        for ( const button of elements.foundation.querySelectorAll( 'button[data-foundation]' ) ) {

            button.setAttribute( 'aria-pressed', String( floor.includes( button.dataset.foundation ) ) );

        }

    }

    if ( agency !== null ) {

        for ( const button of elements.modes.querySelectorAll( 'button[data-mode]' ) ) {

            button.setAttribute( 'aria-pressed', String( agency.mode === button.dataset.mode ) );

        }

        renderAgency( agency );

    }

}

function renderFoundationButtons( wardrobe, foundation ) {

    elements.foundation.innerHTML = '';

    for ( const slot of foundation.slots ) {

        const row = document.createElement( 'div' );
        const label = document.createElement( 'span' );
        label.textContent = `${ slot }: `;
        label.style.color = '#8a8a97';
        row.append( label );

        for ( const id of foundation.alternativesFor( slot ) ) {

            const button = document.createElement( 'button' );
            button.dataset.foundation = id;
            button.textContent = foundation.manifest.get( id ).name;
            button.setAttribute( 'aria-pressed', String( foundation.forSlot( slot ) === id ) );

            button.addEventListener( 'click', () => {

                foundation.prefer( slot, id );
                savePreference( foundation );
                run( wardrobe, () => wardrobe.dress( wardrobe.worn ), null, foundation );

            } );

            row.append( button );

        }

        elements.foundation.append( row );

    }

}

function renderModeButtons( agency, wardrobe, foundation ) {

    elements.modes.innerHTML = '';

    for ( const mode of AGENCY_MODES ) {

        const button = document.createElement( 'button' );
        button.dataset.mode = mode;
        button.textContent = mode;
        button.setAttribute( 'aria-pressed', String( agency.mode === mode ) );

        button.addEventListener( 'click', () => {

            agency.setMode( mode, { by: 'user' } );
            refresh( wardrobe, agency, foundation );

        } );

        elements.modes.append( button );

    }

    renderAgency( agency );

}

function renderAgency( agency ) {

    const state = agency.state();

    elements.agency.innerHTML = table( [
        [ 'mode', state.mode ],
        [ 'pinned outfit', state.pinnedOutfit === null ? '— nothing pinned yet' : state.pinnedOutfit.join( ' → ' ) ],
        [ 'pin holds', state.pinHolds ? 'yes' : 'NO — something dressed the figure behind the agency',
            state.pinHolds ? 'pass' : 'fail' ],
        [ 'preferences stated', String( state.preferencesExpressed ), 'n' ],
        [ 'of those unheard', String( state.preferencesUnheard ), 'n' ],
        [ 'page mood arousal', pageMood.arousal.toFixed( 2 ), 'n' ]
    ] );

    const unheard = agency.unheardPreferences().slice( -5 ).reverse();

    elements.preferences.innerHTML = unheard.length === 0
        ? '<p class="note">nothing unheard — everything it asked for, it got.</p>'
        : '<table><tr><th>would have worn</th><th>because</th></tr>' + unheard.map( ( preference ) =>
            `<tr><td>${ preference.outfit.join( ', ' ) }</td><td>${ preference.reason }</td></tr>`
        ).join( '' ) + '</table>';

}

/** 🎯 9.8's occlusion, printed rather than claimed: worn, and how much of it is actually drawn. */
function renderOcclusion( wardrobe ) {

    const occlusion = wardrobe.stats().occlusion;

    elements.occlusion.innerHTML = occlusion.length === 0
        ? '<p class="note">nothing worn.</p>'
        : '<table><tr><th>garment</th><th>drawn</th><th>of</th><th>occluded by</th></tr>' +
          occlusion.map( ( entry ) =>
              `<tr><td>${ entry.id }</td><td class="n">${ entry.drawnTriangles.toLocaleString() }</td>` +
              `<td class="n">${ entry.fullTriangles.toLocaleString() }</td>` +
              `<td>${ entry.occludedBy.join( ', ' ) || '—' }</td></tr>`
          ).join( '' ) + '</table>';

}

function renderGarmentButtons( wardrobe, manifest ) {

    elements.garments.innerHTML = '';

    for ( const id of manifest.sortByLayer( manifest.ids() ) ) {

        const garment = manifest.get( id );
        const button = document.createElement( 'button' );

        button.dataset.garment = id;
        button.textContent = `${ garment.name } (${ garment.layer })`;
        button.setAttribute( 'aria-pressed', 'false' );

        button.addEventListener( 'click', () => run( wardrobe, () => (
            wardrobe.worn.includes( id ) ? wardrobe.takeOff( [ id ] ) : wardrobe.putOn( [ id ] )
        ) ) );

        elements.garments.append( button );

    }

}

function renderStats( wardrobe ) {

    const stats = wardrobe.stats();
    const insulation = stats.insulation;

    elements.stats.innerHTML = table( [
        [ 'worn', stats.worn.join( ' → ' ) || '—' ],
        [ 'body drawn', stats.bodyVisible ? 'yes' : 'NOT YET — waiting for the foundation layer',
            stats.bodyVisible ? '' : 'info' ],
        [ 'body triangles', stats.bodyTriangles.toLocaleString(), 'n' ],
        [ 'hidden by garments', stats.hiddenTriangles.toLocaleString(), 'n' ],
        [ 'garment triangles', stats.garmentTriangles.toLocaleString(), 'n' ],
        [ 'total drawn', ( stats.bodyTriangles + stats.garmentTriangles ).toLocaleString(), 'n' ],
        [ 'draw calls', String( stats.drawCalls ), 'n' ],
        [ 'last dress', `${ stats.lastDressMs.toFixed( 4 ) } ms`, 'n' ],
        [ 'of which rebuild', `${ stats.lastRebuildMs.toFixed( 4 ) } ms`, 'n' ],
        [ 'insulation', `${ insulation.clo.toFixed( 2 ) } clo` +
            ( insulation.unrated.length > 0 ? ` (+${ insulation.unrated.length } unrated)` : '' ), 'n' ],
        [ 'joint remap', stats.jointRemapIsIdentity ? 'identity' : 'REMAPPED BY NAME',
            stats.jointRemapIsIdentity ? '' : 'info' ]
    ] );

}

function renderMasks( wardrobe ) {

    const masks = wardrobe.availableHideMasks();

    elements.masks.innerHTML = masks.length === 0
        ? '<p class="note fail">none — this body was built without --hide-mask-attribute, so a ' +
          'garment would be worn over skin that is still fully drawn.</p>'
        : table( masks.map( ( name ) => [ name, 'present', 'pass' ] ) );

}

function renderManifest( manifest ) {

    elements.manifest.innerHTML = '<table><tr><th>garment</th><th>layer</th><th>slots</th>' +
        '<th>clo</th><th>alpha</th></tr>' +
        manifest.sortByLayer( manifest.ids() ).map( ( id ) => {

            const garment = manifest.get( id );
            return `<tr><td>${ garment.id }</td><td>${ garment.layer } ` +
                `${ manifest.orderOf( id ) }</td><td>${ garment.slots.join( ' ' ) }</td>` +
                `<td class="n">${ garment.clo ?? '—' }</td><td>${ garment.alphaMode }</td></tr>`;

        } ).join( '' ) + '</table>';

}

function renderEnvironment( stage, wardrobe ) {

    elements.env.innerHTML = table( [
        [ 'backend', stage.backendName ],
        [ 'path', 'forward, no pipeline' ],
        [ 'antialias', 'off' ],
        [ 'temporal AA', 'off' ],
        [ 'grade', 'off' ],
        [ 'body', 'assets/wardrobe/body/g050.glb' ],
        [ 'whole body', `${ wardrobe.fullTriangleCount.toLocaleString() } triangles`, 'n' ]
    ] );

}

/** Frames the whole figure, with the camera off-axis so the silhouette reads. */
function frameFigure( stage, figure ) {

    const bounds = new Box3().setFromObject( figure.root );
    const size = new Vector3();
    const centre = new Vector3();
    bounds.getSize( size );
    bounds.getCenter( centre );

    const halfHeight = ( size.y * FRAME_MARGIN ) / 2;
    const distance = halfHeight / Math.tan( ( FIELD_OF_VIEW_DEGREES * Math.PI ) / 360 );
    const azimuth = ( CAMERA_AZIMUTH_DEGREES * Math.PI ) / 180;

    stage.camera.position.set(
        centre.x + Math.sin( azimuth ) * distance,
        centre.y,
        centre.z + Math.cos( azimuth ) * distance );
    stage.camera.lookAt( centre );

}

/**
 * Sets up ONE frame for `shadow.selftest.mjs` and hands back the screen boxes to measure it in.
 *
 * 🎯 The gate this serves does not ask whether a flag is set. It asks whether the forehead under a
 * hat brim is DARKER than the same forehead with the brim's shadow switched off, in rendered
 * pixels, and it asks the same of the thigh under a hem. That is the property three blind judges
 * named, and it is the only property that survives someone re-introducing the bug.
 *
 * The page does not read pixels: Playwright screenshots the canvas and the gate crops it. What has
 * to happen here is only what the page knows and node does not — put the outfit on, aim the camera
 * the same way every time, project the probe boxes off the SKELETON so they follow the identity
 * rather than being canvas fractions, and apply the requested `break`.
 *
 * `break` is the gate's red half, and both values break the same thing by different mechanisms:
 *   'garment-cast'    — clears `castShadow` on every worn fragment. The original bug, exactly.
 *   'body-receive'    — clears `receiveShadow` on the body. Cast perfectly, landing on nothing.
 *   'garment-receive' — clears `receiveShadow` on every worn fragment. The half of the pair a
 *                       hurried fix drops: the hat casts onto the face and the jacket beneath it
 *                       is lit as though the hat were not there.
 */
async function stageShadowProbe( { stage, figure, wardrobe }, request ) {

    const { outfit = [], break: breakage = 'none', probes = DEFAULT_PROBES } = request ?? {};

    await wardrobe.dress( outfit );

    // 🚩 THE PROBE ONLY EVER CLEARS A FLAG, NEVER SETS ONE, AND THE FIRST VERSION SET THEM.
    //
    // Written as `mesh.castShadow = breakage !== 'garment-cast'` this line repairs the library on
    // its way past: with `applyFragmentShading` commented out of `Wardrobe.js` the flag gate went
    // red exactly as it should and every luma reading stayed at 31.68%, green, on a build with the
    // original bug fully reintroduced. Measured, not reasoned about.
    //
    // So the flags each object arrived with are snapshotted the first time it is seen — before any
    // break has run — and every call restores from that snapshot before clearing. What the library
    // set is what gets rendered.
    // 🚩 THE BODY FIRST, AND THE WORN MESHES EXCLUDED FROM IT. A garment is parented to
    // `body.parent`, which is inside `figure.root`, so a traverse of the figure visits the
    // garments too. Written the other way round — garments, then a traverse that also touches
    // them — the traverse's restore undid the break the loop had just applied, and the
    // castShadow-cleared reading came back byte-identical to the shadowed one on a build where
    // everything was correct. Measured, and it cost an hour of blaming the renderer.
    const worn = new Set( wardrobe.wornMeshes.values() );

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true || worn.has( object ) ) return;

        rememberShadowFlags( object );
        if ( breakage === 'body-receive' ) object.receiveShadow = false;

    } );

    for ( const mesh of worn ) {

        rememberShadowFlags( mesh );
        if ( breakage === 'garment-cast' ) mesh.castShadow = false;
        if ( breakage === 'garment-receive' ) mesh.receiveShadow = false;

        // 🎯 9.7's own toggle. The AO map is a different mechanism from the shadow map — baked
        // contact darkening in the cloth's own folds rather than a cast shadow — and its gate has
        // to be able to switch it off, because "the occlusionTexture is in the GLB" says the build
        // wrote it and nothing about whether the render reads it.
        setAoMaps( mesh, breakage !== 'garment-ao' );

    }

    stage.renderer.shadowMap.needsUpdate = true;
    stage.renderer.render( stage.scene, stage.camera );

    return {
        worn: [ ...wardrobe.worn ],
        break: breakage,
        canvas: [ stage.renderer.domElement.clientWidth, stage.renderer.domElement.clientHeight ],
        boxes: projectProbeBoxes( stage, figure, probes )
    };

}

/**
 * The shadow flags each object had the first time the probe saw it, and a restore to them.
 *
 * The snapshot is taken once per object and never refreshed, so a break applied on an earlier call
 * cannot become the thing a later call restores to.
 */
const shadowFlagsAsFound = new WeakMap();

/** The `aoMap` each material arrived with, so `garment-ao` can put it back. */
const aoMapsAsFound = new WeakMap();

function setAoMaps( mesh, wanted ) {

    for ( const material of Array.isArray( mesh.material ) ? mesh.material : [ mesh.material ] ) {

        if ( aoMapsAsFound.has( material ) === false ) {

            aoMapsAsFound.set( material, material.aoMap ?? null );

        }

        const found = aoMapsAsFound.get( material );
        const next = wanted ? found : null;

        if ( material.aoMap !== next ) {

            material.aoMap = next;
            material.needsUpdate = true;

        }

    }

}

function rememberShadowFlags( object ) {

    const found = shadowFlagsAsFound.get( object );

    if ( found === undefined ) {

        shadowFlagsAsFound.set( object,
            { cast: object.castShadow, receive: object.receiveShadow } );
        return;

    }

    object.castShadow = found.cast;
    object.receiveShadow = found.receive;

}

/**
 * Where the gate measures, expressed the only way that survives a reframe: off the skeleton.
 *
 * Each entry is [name, bone-name fragment, metres along the figure's up axis from that bone's
 * head, half the size of the box in metres]. The gate may override the list; these are the two the
 * blind judges named.
 */
// ⚠️ The forehead offset is MEASURED, not guessed at. `head`'s bone head sits at the base of the
// skull, and the gate swept 11 boxes from 10 mm to 90 mm above it, reading the darkening the hat
// contributes and — separately — whether the box is pure skin in both outfits:
//
//     +10 to +66 mm   0.0% darkening   the brim's shadow does not reach this far down the face
//     +74 mm         15.8%
//     +82 mm         31.3%             <- taken
//     +90 mm         44.2%             the deepest reading, and deliberately not the one taken
//
// At every one of the eleven, the hatted-not-casting reading equals the bareheaded reading to four
// decimals, so the box is skin in both outfits and none of the delta is the hat's own albedo. +82
// is taken rather than +90 because a constant sitting on the peak of its own sweep is a constant
// fitted to a measurement, and the gate wants headroom on both sides.
//
// `torso` is 9.7's probe rather than 3.9's: a wide box over the jacket, where the CC0 suit's baked
// AO map lives. It is deliberately large — baked occlusion is spread over every fold rather than
// concentrated at one edge, so a small box would sit inside one fold or outside all of them.
const DEFAULT_PROBES = [
    [ 'forehead', 'head', 0.082, 0.016 ],
    [ 'thigh', 'thigh', -0.075, 0.026 ],
    [ 'torso', 'spine_02', 0.0, 0.090 ]
];

/**
 * Where on screen to measure, in CSS pixels, derived from the figure's own bones.
 *
 * ⚠️ Bones rather than canvas fractions. A fraction of the canvas is a number that keeps working
 * while it stops meaning anything — reframe the camera or build a taller identity and the
 * "forehead" box lands on an ear, and every reading stays plausible. `shadow.selftest.mjs` refuses a
 * box it cannot derive rather than falling back to one.
 *
 * The offsets are in metres along the figure's own up axis, from a bone head that is a measured
 * anatomical landmark in MPFB's game_engine rig.
 */
function projectProbeBoxes( stage, figure, probes ) {

    const skeleton = figure.skeleton ?? figure.body?.skeleton ?? null;
    if ( skeleton === null ) return {};

    const boneNamed = ( fragment ) => skeleton.bones.find(
        ( bone ) => bone.name.toLowerCase().includes( fragment ) ) ?? null;

    const boxes = {};

    for ( const [ name, boneFragment, rise, halfSize ] of probes ) {

        const bone = boneNamed( boneFragment );
        if ( bone === null ) continue;

        const centre = new Vector3().setFromMatrixPosition( bone.matrixWorld );
        centre.y += rise;

        const projected = centre.clone().project( stage.camera );

        // 🚩 PAGE coordinates, not canvas coordinates. The canvas is one cell of a grid with a
        // 460 px panel beside it, so a box in canvas space lands on the HUD — and it lands there
        // consistently, which is worse, because two readings taken off the panel differ by a
        // little and read as a shadow. Measured before this line existed: a "forehead" that was
        // 0.003 encoded luma, i.e. black, reporting a plausible 46%.
        const rect = stage.renderer.domElement.getBoundingClientRect();
        const [ width, height ] = [ rect.width, rect.height ];

        // The box is sized in WORLD metres and converted through the projection, so it covers the
        // same patch of skin at any framing rather than the same count of pixels.
        const edge = centre.clone();
        edge.y += halfSize;
        const radiusPx = Math.abs( edge.project( stage.camera ).y - projected.y ) * height / 2;

        boxes[ name ] = [
            Math.round( rect.left + ( projected.x * 0.5 + 0.5 ) * width - radiusPx ),
            Math.round( rect.top + ( -projected.y * 0.5 + 0.5 ) * height - radiusPx ),
            Math.max( 2, Math.round( radiusPx * 2 ) ),
            Math.max( 2, Math.round( radiusPx * 2 ) )
        ];

    }

    return boxes;

}

/**
 * Makes one directional light the page's single shadow caster, aimed at where the figure stands.
 *
 * `Stage` sets `shadowMap.type` and leaves `enabled` alone, because `LightingRig.attachTo` is what
 * turns it on for `alive.js` and this page does not use the rig. So this page turns it on itself.
 */
function configureShadowCaster( stage, light ) {

    stage.renderer.shadowMap.enabled = true;

    light.castShadow = true;
    light.shadow.mapSize.setScalar( SHADOW_MAP_SIZE );
    light.shadow.bias = SHADOW_BIAS;
    light.shadow.normalBias = SHADOW_NORMAL_BIAS;

    const camera = light.shadow.camera;
    camera.left = -SHADOW_RADIUS_M;
    camera.right = SHADOW_RADIUS_M;
    camera.top = SHADOW_RADIUS_M;
    camera.bottom = -SHADOW_RADIUS_M;
    camera.near = 0.1;
    camera.far = 12;
    camera.updateProjectionMatrix();

}

/**
 * Everything the figure ships with casts and receives — the body, the eyes, the brows, the lashes.
 *
 * 🎯 THE GARMENTS ARE DELIBERATELY NOT DONE HERE, and that is the whole point of 3.9's wardrobe
 * half. `alive.js` has a traverse just like this one and it runs before the first `dress()`, which
 * is exactly how every garment in the project came to be invisible to the shadow map. `Wardrobe`
 * shades each fragment as it adopts it; if this function grew a re-traverse after `dress()` the
 * page would paper over a regression in the library and `shadow.selftest.mjs` would go green on a bug.
 */
function applyFigureShading( figure ) {

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        object.castShadow = true;
        object.receiveShadow = true;

    } );

}

main().catch( ( error ) => {

    setStatus( `${ error.message }`, 'fail' );
    console.error( error );

} );
