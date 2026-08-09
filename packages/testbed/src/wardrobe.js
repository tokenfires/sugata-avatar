/**
 * wardrobe — the punch-list 9.1 / 9.2 / 9.3 / 9.5 browsercheck.
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

// The wardrobe-ready body: the same figure as `assets/figures/figure_g050.glb` plus the per-vertex
// `_HIDE_*` attributes for the catalogue. Kept as a separate artefact this round rather than
// replacing the shipped figure, because adding attributes changes that file's sha256 and every
// gate measured against it. See the report for the diff request that merges them.
const BODY_URL = new URL( '../../../assets/wardrobe/body/g050.glb', import.meta.url ).href;
const MANIFEST_URL = new URL( '../../../assets/wardrobe/manifest.json', import.meta.url ).href;

// Full-body framing with a little air. The figure is about 1.7 m tall.
const FIELD_OF_VIEW_DEGREES = 30;
const FRAME_MARGIN = 1.12;
const CAMERA_AZIMUTH_DEGREES = 14;

const elements = {
    garments: document.getElementById( 'garments' ),
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

    const wardrobe = new Wardrobe( figure, manifest, { figureKey: 'g050' } );

    frameFigure( stage, figure );
    renderManifest( manifest );
    renderMasks( wardrobe );
    renderGarmentButtons( wardrobe, manifest );
    renderStats( wardrobe );
    renderEnvironment( stage, wardrobe );

    setStatus( 'ready — the figure is undressed and the body is whole.', 'pass' );

    // The handle the browsercheck screenshots are driven through, and the one an agent embedding
    // this library would reach for.
    // Both entry points go through `run`, so a plate driven from the console and a plate driven
    // from a button cannot disagree — the status line saying "undressed" over a dressed figure is
    // a small lie, and a browsercheck's whole job is not telling small lies.
    window.sugataWardrobe = {
        wardrobe,
        figure,
        stage,
        dress: ( ids ) => run( wardrobe, () => wardrobe.dress( ids ) ),
        undress: () => run( wardrobe, () => wardrobe.undress() ),
        stats: () => wardrobe.stats()
    };

    document.getElementById( 'dress-all' ).addEventListener( 'click', () => {

        run( wardrobe, () => wardrobe.dress( [ 'female_casualsuit01', 'shoes01', 'fedora01' ] ) );

    } );

    document.getElementById( 'undress' ).addEventListener( 'click', () => {

        run( wardrobe, () => wardrobe.undress() );

    } );

}

async function run( wardrobe, action ) {

    try {

        setStatus( 'loading fragments…' );
        const stats = await action();
        refresh( wardrobe );
        setStatus( `worn: ${ wardrobe.worn.join( ', ' ) || 'nothing' }`, 'pass' );
        return stats;

    } catch ( error ) {

        // The conflict rule lands here, and it is the point: MPFB attaches two suits with no
        // warning at all, so a refusal a user can read is the feature.
        setStatus( error.message, 'fail' );
        refresh( wardrobe );
        return wardrobe.stats();

    }

}

function refresh( wardrobe ) {

    renderStats( wardrobe );

    for ( const button of elements.garments.querySelectorAll( 'button[data-garment]' ) ) {

        button.setAttribute( 'aria-pressed',
            String( wardrobe.worn.includes( button.dataset.garment ) ) );

    }

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
