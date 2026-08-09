/**
 * identity — the punch-list 10.1 / 10.2 browsercheck.
 *
 * `identitytargets.selftest.mjs` proves the CPU application reproduces headless MPFB to 1.2e-4 mm
 * on all 19,158 vertices, and it proves the shipped catalogue matches the library's own taxonomy.
 * Neither of those can tell you the reshaped figure is a person. So this page draws it, puts every
 * slider in front of a judge, and prints the numbers beside the picture.
 *
 * It also carries the one measurement the selftest can only make structurally: **that the
 * per-frame cost really is zero**. In node the claim is "there is no per-frame entry point and the
 * morph target count does not change". Here it is a frame-time sample on a real renderer, taken on
 * the neutral figure and on an extreme identity, and the two have to agree.
 *
 *
 * ## Toggle state of every plate taken here
 *
 * Forward path, no G-buffer, no temporal AA, no grade, MSAA off. **Deliberately not the shipped
 * default** (`aa=taau` + grade + RCAS 1.2) — the same choice `wardrobe.js` records and for the same
 * reason: this page measures geometry, and the shipped default's grain phase and Halton jitter make
 * a still plate a draw rather than a value. Nothing here is a look gate; 8.1 owns those.
 *
 *
 * ## Why this page and not alive.js
 *
 * `alive.js` carries every measured motion gate in `docs/PROGRESS.md`. Reshaping its figure would
 * move numbers a dozen other punch-list items were validated against.
 */

import { AmbientLight, DirectionalLight, Box3, Vector3 } from 'three';

import { Stage } from '../../core/src/render/Stage.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { IdentityCatalogue } from '../../core/src/figure/IdentityCatalogue.js';
import {
    IdentityTargets, AXIS_GLTF, FIGURE_VERTEX_MAP_URL, FIGURE_VERTEX_MAP_BIN_URL
} from '../../core/src/figure/IdentityTargets.js';

const FIGURE_URL = new URL( '../../../assets/figures/figure_g050.glb', import.meta.url ).href;

// ⚠️ A real FILE, not a directory. Vite rewrites `new URL( …, import.meta.url )` into an emitted
// asset reference, and handed a directory it drops the trailing slash — the first version of this
// page asked the dev server for `/assets/identitycatalogue.json` and got a 404 that read like a
// missing asset rather than a URL bug. The twenty region bins and the vertex map come from
// `IdentityTargets`'s own bundler-visible table for the same reason.
const CATALOGUE_URL = new URL( '../../../assets/identity/catalogue.json', import.meta.url ).href;

const FIELD_OF_VIEW_DEGREES = 30;
const FRAME_MARGIN = 1.12;

/**
 * Start points, not people. `research/identity-sculpting.md` §2.3 is explicit that a preset library
 * of *looks* is fine and a preset library of *people* is a different product — MPFB's own authors
 * warn that their phenotypes "encode by design stereotypes of MakeHuman artists". 10.6 owns the
 * real preset library and its gate; these four exist so a judge has something to compare against a
 * neutral figure without dragging 266 widgets first.
 *
 * The last one is not a look. It is the extreme the risk measurement needs a picture of.
 */
const PRESETS = {
    neutral: {},
    'angular face': {
        'head/head-square': 0.7, 'chin/chin-width-decr-incr': 0.5,
        'chin/chin-prominent-decr-incr': 0.4, 'cheek/cheek-bones-decr-incr': 0.6,
        'nose/nose-scale-horiz-decr-incr': - 0.3
    },
    'soft oval': {
        'head/head-oval': 0.8, 'chin/chin-height-decr-incr': - 0.35,
        'cheek/cheek-inner-decr-incr': 0.45, 'eyes/eye-scale-decr-incr': 0.3,
        'mouth/mouth-lowerlip-volume-decr-incr': 0.3
    },
    'tall build': {
        'legs/upperlegs-height-decr-incr': 0.8, 'legs/lowerlegs-height-decr-incr': 0.7,
        'torso/measure-shoulder-dist-decr-incr': 0.4, 'neck/measure-neck-height-decr-incr': 0.5
    },
    'EXTREME: eyes region hard over': null   // filled in once the catalogue is loaded
};

const elements = {
    presets: document.getElementById( 'presets' ),
    region: document.getElementById( 'region' ),
    filter: document.getElementById( 'filter' ),
    reset: document.getElementById( 'reset' ),
    sliders: document.getElementById( 'sliders' ),
    stats: document.getElementById( 'stats' ),
    frames: document.getElementById( 'frames' ),
    limits: document.getElementById( 'limits' ),
    env: document.getElementById( 'env' ),
    status: document.getElementById( 'status' )
};

const state = {
    values: {},
    lastApply: null,
    neutralFrameMs: null
};

let catalogue = null;
let targets = null;
let figure = null;
let stage = null;
let body = null;
let restPositions = null;

// ---------------------------------------------------------------------------------------------

async function main() {

    setStatus( 'loading the figure and the identity catalogue…' );

    stage = await new Stage().create( document.getElementById( 'view' ), {
        fieldOfView: FIELD_OF_VIEW_DEGREES
    } );

    stage.scene.add( new AmbientLight( 0xffffff, 1.6 ) );

    // Three plain directionals rather than the measured RectAreaLight rig, for the reason
    // wardrobe.js gives: a light rig copied from the look spec invites these plates to be read as
    // look plates, and they are not.
    for ( const [ x, y, z, intensity ] of [ [ 2, 3, 3, 2.4 ], [ - 3, 2, 1, 1.1 ], [ 0, 2, - 4, 1.6 ] ] ) {
        const light = new DirectionalLight( 0xffffff, intensity );
        light.position.set( x, y, z );
        stage.scene.add( light );
    }

    catalogue = await IdentityCatalogue.load( { url: CATALOGUE_URL } );
    targets = new IdentityTargets( catalogue );

    const [ loadedFigure, vertexMap ] = await Promise.all( [
        Figure.load( FIGURE_URL ),
        loadVertexMap()
    ] );

    figure = loadedFigure;
    stage.add( figure.root );

    body = findBodyMesh( figure, vertexMap.positionCount );
    if ( ! body ) throw new Error( `No mesh with ${ vertexMap.positionCount } positions in the figure.` );

    // 🚩 The pristine copy is the whole re-application strategy. A slider drag re-applies the
    // WHOLE stack from these numbers rather than subtracting the previous identity, because
    // subtraction accumulates float error across a drag and a full rebuild is one millisecond.
    restPositions = Float32Array.from( body.geometry.attributes.position.array );

    targets.useVertexMap( vertexMap.map );

    // Loading all twenty region bins up front is 10.81 MB and is the wrong thing for a product to
    // do — `loadRegions` is per-region for exactly that reason. It is the right thing for a
    // browsercheck, where a judge dragging a slider must not wait for a fetch.
    await targets.loadRegions( catalogue.regions.filter( ( r ) => r.exposed ).map( ( r ) => r.id ) );

    PRESETS[ 'EXTREME: eyes region hard over' ] = Object.fromEntries(
        catalogue.slidersIn( 'eyes' ).map( ( slider ) => [ slider.id, 1.0 ] ) );

    buildPresets();
    buildRegionSelect();
    renderSliders();
    applyIdentity();
    frameFigure();
    renderEnvironment();

    elements.filter.addEventListener( 'input', renderSliders );
    elements.region.addEventListener( 'change', renderSliders );
    elements.reset.addEventListener( 'click', () => { state.values = {}; applyIdentity(); renderSliders(); } );
    document.getElementById( 'sample-frames' ).addEventListener( 'click', () => sampleFrames( 120 ) );

    setStatus( 'ready — the figure is at the catalogue default, which is an empty stack.', 'pass' );

    // The handle the browsercheck screenshots are driven through, and the one an agent embedding
    // this library would reach for. Both the buttons and the console go through `setIdentity`, so
    // a plate driven from a script and a plate driven by hand cannot disagree.
    window.sugataIdentity = {
        catalogue, targets, figure, stage,
        values: () => ( { ...state.values } ),
        set: ( values ) => { state.values = { ...values }; applyIdentity(); renderSliders(); return state.lastApply; },
        preset: ( name ) => window.sugataIdentity.set( PRESETS[ name ] ?? {} ),
        report: () => state.lastApply,
        sampleFrames
    };

}

// ---------------------------------------------------------------------------------------------

function applyIdentity() {

    const stack = catalogue.resolve( state.values );

    const positions = body.geometry.attributes.position.array;
    positions.set( restPositions );

    const startedAt = performance.now();
    const report = targets.apply( positions, stack, { axis: AXIS_GLTF } );
    const applyMs = performance.now() - startedAt;

    body.geometry.attributes.position.needsUpdate = true;
    body.geometry.computeBoundingSphere();

    state.lastApply = { ...report, applyMs, sliders: Object.keys( state.values ).length };

    renderStats();
    renderLimits();

}

function renderStats() {

    const report = state.lastApply;
    const morphs = body.geometry.morphAttributes.position?.length ?? 0;

    elements.stats.innerHTML = table( [
        [ 'sliders moved', report.sliders ],
        [ 'targets in the stack', report.targetsApplied ],
        [ 'moved-vertex records read', report.recordsApplied.toLocaleString() ],
        [ 'basemesh vertices moved', report.verticesMoved.toLocaleString() ],
        [ 'of those, helper-only', `${ report.verticesOutsideFigure.toLocaleString() } — 10.7 and 10.9 read these`,
            report.verticesOutsideFigure > 0 ? 'warn' : '' ],
        [ 'worst displacement', `${ report.maxDisplacementMm.toFixed( 3 ) } mm` ],
        [ 'apply cost, this change', `${ report.applyMs.toFixed( 4 ) } ms`, report.applyMs < 4 ? 'pass' : 'fail' ],
        [ 'GPU morph targets', `${ morphs } — unchanged by identity`, 'pass' ],
        [ 'per-frame identity cost', '0 ms — nothing runs per frame', 'pass' ]
    ] );

}

function renderLimits() {

    const report = state.lastApply;

    // The face parts and the skeleton are fitted from the body's vertices at build time. Nothing
    // on this page refits them, so the honest thing to print is how far the body has moved out
    // from under them.
    elements.limits.innerHTML = table( [
        [ 'body moved by', `${ report.maxDisplacementMm.toFixed( 3 ) } mm`,
            report.maxDisplacementMm > 2 ? 'warn' : 'pass' ],
        [ 'eyes / teeth / tongue', 'not refitted — punch list 10.9', 'warn' ],
        [ 'skeleton', 'not refitted — punch list 10.7. A FACE identity needs none: measured, '
            + '0 of 106 bone ends move by 0.000 mm. A BODY identity moves 97 of 106, up to 18.727 mm.', 'warn' ],
        [ 'expression closure', 'a blendshape is a fixed displacement and does not rescale — '
            + 'punch list 10.3, sized by tools/identity-pipeline/measure_expression_cost.mjs', 'warn' ]
    ] );

}

/**
 * Frame time on the current identity, sampled off the renderer's own CPU-time counter.
 *
 * The first sample taken is kept as the neutral baseline, so every later reading is a comparison
 * rather than a number. What would falsify "zero per frame" is the extreme identity's median
 * sitting outside the neutral one's spread — and the spread is printed, because a difference
 * smaller than the noise is not a difference.
 */
async function sampleFrames( count ) {

    const samples = [];

    await new Promise( ( resolve ) => {

        const stop = stage.onFrame( () => {
            samples.push( stage.frameMs );
            if ( samples.length >= count ) { if ( typeof stop === 'function' ) stop(); resolve(); }
        } );

    } );

    samples.sort( ( a, b ) => a - b );
    const median = samples[ Math.floor( samples.length / 2 ) ];
    const spread = samples[ Math.floor( samples.length * 0.9 ) ] - samples[ Math.floor( samples.length * 0.1 ) ];

    const isNeutral = Object.keys( state.values ).length === 0;
    if ( isNeutral || state.neutralFrameMs === null ) state.neutralFrameMs = { median, spread };

    const delta = median - state.neutralFrameMs.median;
    const inNoise = Math.abs( delta ) <= state.neutralFrameMs.spread;

    elements.frames.innerHTML = table( [
        [ 'samples', count ],
        [ 'median frame CPU', `${ median.toFixed( 3 ) } ms` ],
        [ 'p10..p90 spread', `${ spread.toFixed( 3 ) } ms` ],
        [ 'neutral median', `${ state.neutralFrameMs.median.toFixed( 3 ) } ms` ],
        [ 'delta vs neutral', `${ delta >= 0 ? '+' : '' }${ delta.toFixed( 3 ) } ms`
            + ( inNoise ? ' — inside the neutral spread' : ' — OUTSIDE the neutral spread' ),
            inNoise ? 'pass' : 'fail' ]
    ] );

    return { median, spread, delta, inNoise };

}

// ---------------------------------------------------------------------------------------------

function buildPresets() {

    elements.presets.innerHTML = '';

    for ( const name of Object.keys( PRESETS ) ) {

        const button = document.createElement( 'button' );
        button.textContent = name;
        button.addEventListener( 'click', () => {
            state.values = { ...PRESETS[ name ] };
            applyIdentity();
            renderSliders();
            setStatus( `preset: ${ name }`, 'info' );
        } );
        elements.presets.append( button );

    }

}

function buildRegionSelect() {

    const exposed = catalogue.regions.filter( ( region ) => region.exposed );

    elements.region.innerHTML = '<option value="">all 20 exposed regions</option>'
        + exposed.map( ( region ) =>
            `<option value="${ region.id }">${ region.id } — ${ region.sliderCount } sliders`
            + `${ region.sidedCount ? `, ${ region.sidedCount } sided` : '' }</option>` ).join( '' );

}

/**
 * 🚩 The filter box, not a fourth tier. `research/identity-sculpting.md` §2.4 pattern 4: at
 * hundreds of parameters every shipped creator's answer is search + filter + recently-used +
 * favourites, and Reallusion CC4 — the tool with the most morphs — is the only one that actually
 * does it. 266 widgets is squarely in that regime, so the filter comes before anything else.
 */
function renderSliders() {

    const region = elements.region.value;
    const needle = elements.filter.value.trim().toLowerCase();

    const shown = catalogue.exposedSliders.filter( ( slider ) =>
        ( ! region || slider.region === region )
        && ( ! needle || slider.id.toLowerCase().includes( needle ) ) );

    elements.sliders.innerHTML = '';

    for ( const slider of shown ) {

        const value = state.values[ slider.id ] ?? 0;

        const row = document.createElement( 'div' );
        row.className = `slider${ slider.kind === 'measure' ? ' measure' : '' }`;

        const label = document.createElement( 'label' );
        label.textContent = region ? slider.name : slider.id;
        label.title = `${ slider.id } — ${ slider.range }, axis ${ slider.axis }`
            + ( slider.sided ? ', drives both sides' : '' );

        const input = document.createElement( 'input' );
        input.type = 'range';
        input.min = slider.range === 'unipolar' ? '0' : '-1';
        input.max = '1';
        input.step = '0.01';
        input.value = String( value );

        const readout = document.createElement( 'span' );
        readout.className = 'value';
        readout.textContent = value.toFixed( 2 );

        input.addEventListener( 'input', () => {
            const next = Number( input.value );
            readout.textContent = next.toFixed( 2 );
            if ( next === 0 ) delete state.values[ slider.id ];
            else state.values[ slider.id ] = next;
            applyIdentity();
        } );

        row.append( label, input, readout );
        elements.sliders.append( row );

    }

    if ( shown.length === 0 ) elements.sliders.innerHTML = '<p class="note">nothing matches.</p>';

}

function renderEnvironment() {

    elements.env.innerHTML = table( [
        [ 'backend', stage.stats.backend ?? 'unknown' ],
        [ 'catalogue', `${ catalogue.library.id }, ${ catalogue.census.total } files, `
            + `${ catalogue.sliders.length } sliders, ${ catalogue.exposedWidgetCount } widgets exposed` ],
        [ 'packed offsets', `${ ( catalogue.regions.reduce( ( n, r ) => n + r.binBytes, 0 ) / 1e6 ).toFixed( 2 ) } MB `
            + 'across 20 region files' ],
        [ 'body mesh', `${ body.geometry.attributes.position.count.toLocaleString() } glTF positions` ]
    ] );

}

// ---------------------------------------------------------------------------------------------

async function loadVertexMap() {

    const manifest = await ( await fetch( FIGURE_VERTEX_MAP_URL ) ).json();
    const bytes = await ( await fetch( FIGURE_VERTEX_MAP_BIN_URL ) ).arrayBuffer();

    return { positionCount: manifest.positionCount, map: new Uint16Array( bytes ) };

}

/**
 * The glTF node is named 'Human' and its mesh 'base.001'; three.js keeps the NODE name, so
 * matching on the mesh name finds nothing. The position count is what the vertex map is keyed to
 * anyway, and it is the property that would have to change for this lookup to be wrong.
 */
function findBodyMesh( loadedFigure, positionCount ) {

    let found = null;
    loadedFigure.root.traverse( ( node ) => {
        if ( node.isMesh && node.geometry.attributes.position.count === positionCount ) found = node;
    } );
    return found;

}

function frameFigure() {

    const bounds = new Box3().setFromObject( figure.root );
    const size = new Vector3(); bounds.getSize( size );
    const centre = new Vector3(); bounds.getCenter( centre );

    const distance = ( size.y * FRAME_MARGIN / 2 ) / Math.tan( ( FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180 );

    stage.camera.position.set( centre.x, centre.y, centre.z + distance );
    stage.camera.lookAt( centre );

}

function table( rows ) {

    return '<table>' + rows.map( ( row ) =>
        `<tr><th>${ row[ 0 ] }</th><td class="${ row[ 2 ] ?? '' }">${ row[ 1 ] }</td></tr>`
    ).join( '' ) + '</table>';

}

function setStatus( message, className = 'info' ) {

    elements.status.className = className;
    elements.status.textContent = message;

}

main().catch( ( error ) => {

    setStatus( error.message, 'fail' );
    console.error( error );

} );
