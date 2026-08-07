/**
 * Gate for punch-list items 1.1, 1.3 and 1.4, run against a real figure GLB — not a fixture.
 *
 * The four claims worth proving, in the order the design depends on them:
 *
 *   1. All 52 ARKit names resolve through Figure. The list here is written out independently
 *      rather than imported from ExpressionBank, so a typo in the regions cannot make the
 *      coverage check agree with itself.
 *   2. jawOpen maps to MORE THAN ONE mesh. This is the fact that justifies the whole class; if
 *      it ever stops being true the pipeline has changed and the registry needs re-reading.
 *   3. setMorph and commit write EVERY location, not just the body. Read back off the raw
 *      morphTargetInfluences arrays, because those are what the GPU sees.
 *   4. The regions partition the 52 exactly — no overlap, no omission.
 *
 * Usage:  node packages/core/src/figure/figure.selftest.mjs
 *         node packages/core/src/figure/figure.selftest.mjs assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures: it reads `self.URL`
// and hands the resulting blob URL to createImageBitmap. Nothing here inspects pixels, so the
// two smallest possible stubs let the loader finish and get us to the morph data. These must be
// in place before Figure.js is imported, which is why the import below is dynamic.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Figure } = await import( './Figure.js' );
const {
    ARKIT_REGIONS,
    REGION_NAMES,
    EMOTION_REGIONS,
    SPEECH_REGIONS,
    OVR_VISEMES,
    CUSTOM_SHAPES,
    MAX_CORNER_OFFSET,
    applyRegion,
    addMouthCornerOffset,
    applyVisemes,
    applyCustomShape,
    regionOf,
    missingArkitShapes
} = await import( './ExpressionBank.js' );

/** Apple's canonical 52, transcribed independently of ExpressionBank on purpose. */
const ARKIT_52_CANON = [
    'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
    'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
    'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight',
    'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
    'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight',
    'eyeWideLeft', 'eyeWideRight',
    'jawForward', 'jawLeft', 'jawOpen', 'jawRight',
    'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight',
    'mouthFunnel', 'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight',
    'mouthPressLeft', 'mouthPressRight', 'mouthPucker', 'mouthRight',
    'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
    'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
    'mouthUpperUpLeft', 'mouthUpperUpRight',
    'noseSneerLeft', 'noseSneerRight', 'tongueOut'
];

let checksRun = 0;
const failures = [];

function check( description, condition, detail = '' ) {

    checksRun ++;

    if ( condition ) {

        console.log( `  ok   ${ description }` );
        return true;

    }

    console.log( `  FAIL ${ description }${ detail === '' ? '' : `\n       ${ detail }` }` );
    failures.push( description );
    return false;

}

function heading( title ) {

    console.log( '' );
    console.log( `--- ${ title } ${ '-'.repeat( Math.max( 0, 72 - title.length ) ) }` );

}

/** Reads a morph's weight straight off every influence array that carries it. Ground truth. */
function readEveryLocation( figure, name ) {

    return figure.morphRegistry.get( name ).map( ( location ) => ( {
        mesh: location.mesh.name,
        value: location.influences[ location.index ]
    } ) );

}

// --- 4. regions partition the 52 (no figure needed) -----------------------------------------

function testRegionPartition() {

    heading( '1.4 region segmentation' );

    const seen = new Map();
    const duplicates = [];

    for ( const region of REGION_NAMES ) {

        for ( const name of ARKIT_REGIONS[ region ] ) {

            if ( seen.has( name ) ) duplicates.push( `${ name } in both ${ seen.get( name ) } and ${ region }` );
            seen.set( name, region );

        }

    }

    check( 'no morph appears in two regions', duplicates.length === 0, duplicates.join( '; ' ) );

    const omitted = ARKIT_52_CANON.filter( ( name ) => ! seen.has( name ) );
    check( 'every one of the canonical 52 is in a region', omitted.length === 0, omitted.join( ', ' ) );

    const extra = [ ...seen.keys() ].filter( ( name ) => ! ARKIT_52_CANON.includes( name ) );
    check( 'no region contains a non-ARKit name', extra.length === 0, extra.join( ', ' ) );

    check( `the regions total exactly 52 (got ${ seen.size })`, seen.size === 52 );

    const owned = [ ...EMOTION_REGIONS, ...SPEECH_REGIONS ].sort();
    check(
        'emotion and speech ownership covers every region exactly once',
        owned.length === REGION_NAMES.length && owned.join( ',' ) === [ ...REGION_NAMES ].sort().join( ',' ),
        `owned: ${ owned.join( ', ' ) } vs regions: ${ [ ...REGION_NAMES ].sort().join( ', ' ) }`
    );

    check( 'regionOf resolves a known name', regionOf( 'jawOpen' ) === 'jaw' );
    check( 'regionOf returns undefined for a viseme', regionOf( 'viseme_aa' ) === undefined );

    for ( const region of REGION_NAMES ) {

        console.log( `       ${ region.padEnd( 8 ) } ${ String( ARKIT_REGIONS[ region ].length ).padStart( 2 ) } shapes` );

    }

}

// --- 1. all 52 resolve through Figure -------------------------------------------------------

function testArkitCoverage( figure ) {

    heading( '1.1 morph registry — coverage' );

    const missingFromFigure = ARKIT_52_CANON.filter( ( name ) => ! figure.hasMorph( name ) );
    check( 'all 52 ARKit names resolve on the figure', missingFromFigure.length === 0,
        missingFromFigure.join( ', ' ) );

    check( 'missingArkitShapes() agrees', missingArkitShapes( figure ).length === 0,
        missingArkitShapes( figure ).join( ', ' ) );

    const missingVisemes = OVR_VISEMES.filter( ( name ) => ! figure.hasMorph( name ) );
    check( 'all 15 OVR visemes resolve on the figure', missingVisemes.length === 0,
        missingVisemes.join( ', ' ) );

    check( 'morphNames is sorted and complete',
        figure.morphNames.length === figure.morphRegistry.size &&
        figure.morphNames.every( ( name, i ) => i === 0 || figure.morphNames[ i - 1 ] < name ),
        `${ figure.morphNames.length } names / ${ figure.morphRegistry.size } registry entries` );

    check( 'hasMorph rejects a name that is not there', figure.hasMorph( 'notAShape' ) === false );

    console.log( `       ${ figure.morphNames.length } distinct morph names across ` +
                 `${ figure.meshes.length } meshes` );

}

// --- 2. multi-mesh morphs -------------------------------------------------------------------

function testMultiMeshMapping( figure ) {

    heading( '1.1 morph registry — the multi-mesh problem' );

    const jawLocations = figure.morphRegistry.get( 'jawOpen' ) ?? [];
    check( `jawOpen maps to MORE THAN ONE mesh (got ${ jawLocations.length })`,
        jawLocations.length > 1,
        jawLocations.map( ( l ) => l.mesh.name ).join( ', ' ) );

    // The specific failure this guards against: opening the jaw on the body alone leaves the
    // teeth and tongue behind inside the head.
    const jawMeshNames = jawLocations.map( ( l ) => l.mesh.name.toLowerCase() );
    check( 'jawOpen reaches the teeth', jawMeshNames.some( ( name ) => name.includes( 'teeth' ) ),
        jawMeshNames.join( ', ' ) );
    check( 'jawOpen reaches the tongue', jawMeshNames.some( ( name ) => name.includes( 'tongue' ) ),
        jawMeshNames.join( ', ' ) );

    const gazeMeshNames = ( figure.morphRegistry.get( 'eyeLookUpLeft' ) ?? [] )
        .map( ( l ) => l.mesh.name.toLowerCase() );
    check( 'eyeLookUpLeft reaches the eyeballs',
        gazeMeshNames.some( ( name ) => name.includes( 'low-poly' ) || name.includes( 'eyeball' ) ),
        gazeMeshNames.join( ', ' ) );

    const multiMesh = figure.morphNames.filter( ( name ) => figure.morphLocationCount( name ) > 1 );
    check( 'a substantial number of morphs are multi-mesh', multiMesh.length > 10,
        `${ multiMesh.length } of ${ figure.morphNames.length }` );

    console.log( `       ${ multiMesh.length } of ${ figure.morphNames.length } morphs live on ` +
                 'more than one mesh' );

}

// --- 3. writes land in every location -------------------------------------------------------

function testWritesReachEveryLocation( figure ) {

    heading( '1.1 morph registry — setMorph and commit write every location' );

    figure.resetMorphs();
    figure.setMorph( 'jawOpen', 0.75 );

    const afterSet = readEveryLocation( figure, 'jawOpen' );
    check( `setMorph('jawOpen', 0.75) wrote all ${ afterSet.length } locations`,
        afterSet.every( ( entry ) => entry.value === 0.75 ),
        afterSet.map( ( e ) => `${ e.mesh }=${ e.value }` ).join( ', ' ) );

    check( 'getMorph reads it back', figure.getMorph( 'jawOpen' ) === 0.75 );

    figure.setMorphs( { eyeBlinkLeft: 1, eyeBlinkRight: 1 } );
    const blink = readEveryLocation( figure, 'eyeBlinkLeft' );
    check( `setMorphs wrote all ${ blink.length } eyeBlinkLeft locations`,
        blink.every( ( entry ) => entry.value === 1 ),
        blink.map( ( e ) => `${ e.mesh }=${ e.value }` ).join( ', ' ) );

    figure.setMorph( 'jawOpen', 4 );
    check( 'setMorph clamps above 1', readEveryLocation( figure, 'jawOpen' ).every( ( e ) => e.value === 1 ) );
    figure.setMorph( 'jawOpen', -2 );
    check( 'setMorph clamps below 0', readEveryLocation( figure, 'jawOpen' ).every( ( e ) => e.value === 0 ) );

    figure.resetMorphs();
    const everythingZero = figure.morphNames.every(
        ( name ) => readEveryLocation( figure, name ).every( ( entry ) => entry.value === 0 ) );
    check( 'resetMorphs zeroes every location on every mesh', everythingZero );

    // The frame model: two layers stack additively on the same shape, one commit pushes it out.
    figure.beginFrame();
    figure.weights.jawOpen += 0.4;
    figure.weights.jawOpen += 0.1;
    check( 'beginFrame does not touch the influence arrays yet',
        readEveryLocation( figure, 'jawOpen' ).every( ( entry ) => entry.value === 0 ) );

    figure.commit();
    const committed = readEveryLocation( figure, 'jawOpen' );
    check( `commit() pushed the accumulated 0.5 to all ${ committed.length } locations`,
        committed.every( ( entry ) => Math.abs( entry.value - 0.5 ) < 1e-6 ),
        committed.map( ( e ) => `${ e.mesh }=${ e.value }` ).join( ', ' ) );

    figure.beginFrame();
    figure.weights.jawOpen = 3;
    figure.commit();
    check( 'commit() clamps an overshooting additive stack',
        readEveryLocation( figure, 'jawOpen' ).every( ( entry ) => entry.value === 1 ) );

    figure.resetMorphs();

}

// --- bones ----------------------------------------------------------------------------------

function testBones( figure ) {

    heading( '1.1 bone lookup' );

    check( 'the figure has a skeleton', figure.skeleton !== null && figure.body !== null );
    check( 'head resolves', figure.bone( 'head' ) !== undefined );
    check( 'neck resolves', figure.bone( 'neck' ) !== undefined );
    check( 'spine resolves', figure.bone( 'spine' ) !== undefined );
    check( 'hips resolves', figure.bone( 'hips' ) !== undefined );
    check( 'raw rig names still work', figure.bone( 'spine_03' ) !== undefined );

    // Not a failure — the shipped game_engine rig genuinely has neither. What matters is that
    // Figure says so out loud rather than handing a motion layer undefined without comment.
    check( 'absent bones are reported rather than silently missing',
        figure.missingHumanoidBones.every( ( name ) => figure.humanoidBones[ name ] === undefined ) );

    console.log( `       ${ figure.boneNames.length } bones; ` +
                 `absent humanoid slots: ${ figure.missingHumanoidBones.join( ', ' ) || 'none' }` );

}

// --- ExpressionBank behaviour ----------------------------------------------------------------

function testExpressionBank( figure ) {

    heading( '1.3 / 1.4 ExpressionBank' );

    figure.beginFrame();
    applyRegion( figure, 'brow', { browInnerUp: 0.8, browDownLeft: 0.3 } );
    check( 'applyRegion writes its own region', figure.weights.browInnerUp === 0.8 &&
        figure.weights.browDownLeft === 0.3 );

    // The load-bearing guard: affect cannot reach the mouth through applyRegion.
    figure.beginFrame();
    applyRegion( figure, 'brow', { mouthPucker: 1 } );
    check( 'applyRegion refuses a name from another region', figure.weights.mouthPucker === 0 );

    figure.beginFrame();
    applyRegion( figure, 'notARegion', { browInnerUp: 1 } );
    check( 'applyRegion refuses an unknown region', figure.weights.browInnerUp === 0 );

    // Emotion over speech: the viseme keeps its shape, the corners ride on top.
    figure.beginFrame();
    applyVisemes( figure, { viseme_aa: 1 } );
    applyRegion( figure, 'jaw', { jawOpen: 0.6 } );
    addMouthCornerOffset( figure, { smile: 0.25 } );
    check( 'viseme survives an emotional smile', figure.weights.viseme_aa === 1 &&
        figure.weights.jawOpen === 0.6 );
    check( 'the smile is additive on the corners', figure.weights.mouthSmileLeft === 0.25 &&
        figure.weights.mouthSmileRight === 0.25 );

    figure.beginFrame();
    addMouthCornerOffset( figure, { smile: 1 } );
    check( `the corner offset is capped at ${ MAX_CORNER_OFFSET }`,
        figure.weights.mouthSmileLeft === MAX_CORNER_OFFSET,
        String( figure.weights.mouthSmileLeft ) );

    figure.beginFrame();
    applyVisemes( figure, { browInnerUp: 1 } );
    check( 'applyVisemes refuses a non-viseme', figure.weights.browInnerUp === 0 );

    // AU23 is genuinely absent from this asset, so the approximation is the live path.
    check( 'mouthTighten is declared as a custom shape',
        CUSTOM_SHAPES.mouthTighten.facs.includes( 'AU23' ) );
    check( 'the figure really does lack mouthTighten (hence the fallback)',
        figure.hasMorph( 'mouthTighten' ) === false );

    figure.beginFrame();
    applyCustomShape( figure, 'mouthTighten', 1 );
    check( 'applyCustomShape falls back to shapes the figure has',
        figure.weights.mouthPressLeft === 0.6 && figure.weights.mouthPressRight === 0.6 &&
        Math.abs( figure.weights.mouthFunnel - 0.15 ) < 1e-6,
        `press ${ figure.weights.mouthPressLeft } / funnel ${ figure.weights.mouthFunnel }` );

    figure.resetMorphs();

}

// --- entry point ------------------------------------------------------------------------------

async function main() {

    const figureDir = path.dirname( fileURLToPath( import.meta.url ) );
    const repoRoot = path.resolve( figureDir, '..', '..', '..', '..' );
    const defaultGlb = path.join( repoRoot, 'assets', 'figures', 'figure_g050.glb' );
    const glbPath = path.resolve( process.argv[ 2 ] ?? defaultGlb );

    console.log( '='.repeat( 78 ) );
    console.log( `Figure / ExpressionBank self-test — ${ glbPath }` );
    console.log( '='.repeat( 78 ) );

    if ( ! fs.existsSync( glbPath ) ) {

        console.error( `No GLB at ${ glbPath }. Run tools/figure-pipeline/build.sh first.` );
        process.exit( 1 );

    }

    const fileBuffer = fs.readFileSync( glbPath );
    const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength );

    const figure = await Figure.parse( arrayBuffer );

    testRegionPartition();
    testArkitCoverage( figure );
    testMultiMeshMapping( figure );
    testWritesReachEveryLocation( figure );
    testBones( figure );
    testExpressionBank( figure );

    console.log( '' );
    console.log( '='.repeat( 78 ) );

    if ( failures.length === 0 ) {

        console.log( `PASS — ${ checksRun } checks.` );
        process.exit( 0 );

    }

    console.log( `FAIL — ${ failures.length } of ${ checksRun } checks failed:` );
    for ( const failure of failures ) console.log( `  - ${ failure }` );
    process.exit( 1 );

}

// One catch-all at the boundary: this script IS the boundary where results become a report.
try {

    await main();

} catch ( error ) {

    console.error( '' );
    console.error( 'FAIL — the self-test threw before it could finish:' );
    console.error( error );
    process.exit( 1 );

}
