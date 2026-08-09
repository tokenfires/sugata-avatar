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

    stage.scene.add( new AmbientLight( 0xffffff, 1.6 ) );

    // Three plain directionals rather than the measured RectAreaLight rig. This page is about
    // geometry, and a light rig copied from the look spec would invite the plates to be read as
    // look plates, which they are not.
    for ( const [ x, y, z, intensity ] of [ [ 2, 3, 3, 2.4 ], [ -3, 2, 1, 1.1 ], [ 0, 2, -4, 1.6 ] ] ) {

        const light = new DirectionalLight( 0xffffff, intensity );
        light.position.set( x, y, z );
        stage.scene.add( light );

    }

    const [ figure, manifest ] = await Promise.all( [
        Figure.load( BODY_URL ),
        GarmentManifest.load( MANIFEST_URL )
    ] );

    stage.add( figure.root );

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
        agencyState: () => agency.state()
    };

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

main().catch( ( error ) => {

    setStatus( `${ error.message }`, 'fail' );
    console.error( error );

} );
