/** Actual WebGPU regression for hair.html's capture clock.
 * Fast capture steps used to share a renderer frame: the solver advanced while Three reused
 * stale bone uploads for the body. Compare pixels across load/step delays and inspect the
 * skeleton buffer that the skinning node uploads. Frozen and free-running clocks are controls.
 * node packages/testbed/src/hair-capture-clock.selftest.mjs [--out directory]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../core/src/render/MotionProbe.mjs';

const outIndex = process.argv.indexOf( '--out' );
const out = outIndex < 0 ? fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-hair-clock-' ) )
    : path.resolve( process.argv[ outIndex + 1 ] );
fs.mkdirSync( out, { recursive: true } );
const report = { cases: [], checks: [], errors: [] };
const sha = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const server = await startProbeServer();
let browser;

function check( name, assertion ) {
    assertion();
    report.checks.push( name );
    console.log( `ok ${ name }` );
}

async function capture( label, defect = null, delayed = false ) {
    const context = await browser.newContext( { viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 } );
    const page = await context.newPage();
    const row = { label, defect, delayed, frames: [] };
    report.cases.push( row );
    page.on( 'pageerror', error => report.errors.push( String( error ) ) );
    page.on( 'response', response => {
        if ( response.status() >= 400 ) report.errors.push( `${ response.status() } ${ response.url() }` );
    } );
    await page.route( '**/src/hair.js', async route => {
        const response = await route.fetch();
        let body = await response.text();
        if ( defect !== null ) {
            const target = defect === 'frozen' ? 'captureFrame.update();' : 'renderer._animation.stop();';
            assert.equal( body.split( target ).length, 2, 'control must replace exactly one operation' );
            body = body.replace( target, '/* clock operation deliberately removed by regression test */' );
        }
        const anchor = 'window.hairShot = async ( name ) => {';
        assert.equal( body.split( anchor ).length, 2 );
        body = body.replace( anchor, `window.__HAIR_TEST_POSE__ = () => {
            let bodyMesh = null;
            figure.scene.traverse( object => {
                if ( object.isSkinnedMesh && ( bodyMesh === null ||
                    object.geometry.attributes.position.count > bodyMesh.geometry.attributes.position.count ) ) bodyMesh = object;
            } );
            const skeleton = bodyMesh.skeleton;
            const index = skeleton.bones.findIndex( bone => bone.name === 'head' );
            if ( index < 0 ) throw new Error( 'No body head joint.' );
            const expected = new Matrix4().multiplyMatrices( skeleton.bones[ index ].matrixWorld, skeleton.boneInverses[ index ] );
            return { actual: Array.from( skeleton.boneMatrices.slice( index * 16, index * 16 + 16 ) ),
                expected: Array.from( new Float32Array( expected.elements ) ) };
        };
        ${ anchor }` );
        await route.fulfill( { response, body } );
    } );
    if ( delayed ) {
        await page.route( '**/assets/hair/crop01/g050.glb', async route => {
            await new Promise( resolve => setTimeout( resolve, 150 ) );
            await route.continue();
        } );
    }
    try {
        await page.goto( `${ server.baseUrl }/src/hair.html?groom=crop01&bake=g050&motion=1&head=shake&capture` );
        await page.waitForFunction( () => typeof window.__HAIR_STEP__ === 'function', null, { timeout: 120000 } );
        assert.match( await page.locator( '#hud' ).textContent(), /Renderer\s+: WebGPU/ );
        for ( let frame = 1; frame <= 30; frame ++ ) {
            const state = await page.evaluate( async wait => {
                if ( wait ) await new Promise( resolve => setTimeout( resolve, 20 ) );
                await window.__HAIR_STEP__( 1 / 60 );
                return { clock: window.__HAIR_CLOCK__(), pose: window.__HAIR_TEST_POSE__() };
            }, delayed );
            if ( ! [ 1, 15, 30 ].includes( frame ) ) continue;
            await page.evaluate( () => new Promise( resolve => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );
            const pixels = await page.locator( '#stage' ).screenshot( { path: path.join( out, `${ label }-${ frame }.png` ) } );
            row.frames.push( { frame, ...state, sha256: sha( pixels ),
                boneError: Math.max( ...state.pose.actual.map( ( value, index ) => Math.abs( value - state.pose.expected[ index ] ) ) ) } );
        }
        if ( defect === null ) {
            row.reset = await page.evaluate( async () => {
                const before = window.__HAIR_CLOCK__();
                window.__HAIR_RESET__();
                await window.__HAIR_STEP__( 1 / 60 );
                return { before, after: window.__HAIR_CLOCK__(),
                    simulationSeconds: window.__HAIR_STATE__().simulationSeconds,
                    pose: window.__HAIR_TEST_POSE__() };
            } );
        }
        return row;
    } finally {
        await context.close();
    }
}

try {
    browser = await launchProbeBrowser();
    const fast = await capture( 'fast' );
    const delayed = await capture( 'delayed', null, true );
    check( 'fast and delayed captures give identical images at three moving poses', () => {
        assert.deepEqual( fast.frames.map( f => f.sha256 ), delayed.frames.map( f => f.sha256 ) );
    } );
    check( 'each captured draw advances the renderer clock and the body bone upload', () => {
        for ( const run of [ fast, delayed ] ) for ( const frame of run.frames ) {
            assert.equal( frame.clock.draws, frame.frame + 1 ); // one initial draw, then N steps
            assert.equal( frame.clock.frameId, frame.clock.draws );
            assert.ok( Math.abs( frame.clock.time - frame.frame / 60 ) < 1e-12 );
            assert.equal( frame.boneError, 0 );
        }
    } );
    check( 'different simulation poses produce different images', () => {
        assert.equal( new Set( fast.frames.map( f => f.sha256 ) ).size, 3 );
    } );
    check( 'reset rewinds time while keeping renderer frame IDs monotonic', () => {
        for ( const { reset } of [ fast, delayed ] ) {
            assert.equal( reset.after.frameId, reset.before.frameId + 1 );
            assert.equal( reset.after.draws, reset.before.draws + 1 );
            assert.equal( reset.after.time, 1 / 60 );
            assert.equal( reset.after.time, reset.simulationSeconds );
            assert.deepEqual( reset.pose.actual, reset.pose.expected );
        }
    } );
    const frozen = await capture( 'frozen', 'frozen' );
    check( 'removing renderer ticks leaves stale body bone uploads and is rejected', () => {
        assert.ok( frozen.frames.every( f => f.clock.frameId !== f.clock.draws ) );
        assert.ok( frozen.frames.every( f => f.boneError > 1e-4 ) );
        assert.notEqual( frozen.frames.at( -1 ).sha256, fast.frames.at( -1 ).sha256 );
    } );
    const drifting = await capture( 'drifting', 'drifting', true );
    check( 'leaving the internal animation loop running is rejected by the clock oracle', () => {
        assert.ok( drifting.frames.every( f => f.clock.frameId !== f.clock.draws ) );
    } );
    check( 'all GPU runs finish without browser or asset errors', () => assert.deepEqual( report.errors, [] ) );
    report.passed = true;
    console.log( `PASS ${ report.checks.length } hair capture clock groups` );
} catch ( error ) {
    report.error = error.stack;
    throw error;
} finally {
    fs.writeFileSync( path.join( out, 'report.json' ), JSON.stringify( report, null, 2 ) + '\n' );
    await browser?.close();
    await server.close();
}
