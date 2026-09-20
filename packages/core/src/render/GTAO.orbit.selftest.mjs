/**
 * Rendered regression for orbiting beyond the studio backdrop with GTAO enabled.
 *
 * A foreground pixel can sample clear sky in the lower-resolution bent-normal target.
 * Normalizing its zero direction used to put NaNs into the deferred composite; bloom then
 * spread those NaNs across the entire frame. This gate reads the actual GPU targets as well
 * as the canvas. A routed old-code arm must reproduce the failure, so a missing AO/bloom path
 * cannot make the test pass. No production defect toggle or avatar API change is needed.
 *
 * Usage: node packages/core/src/render/GTAO.orbit.selftest.mjs
 * Optional GTAO_ORBIT_CAPTURE=/absolute/path saves PNGs and the JSON report.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchProbeBrowser, startProbeServer } from './MotionProbe.mjs';
import { decodePng } from '../../../../tools/critic/png.mjs';

const captureDirectory = process.env.GTAO_ORBIT_CAPTURE;
if ( captureDirectory ) await fs.mkdir( captureDirectory, { recursive: true } );
const report = { arms: {}, checks: [] };
function check( name, condition ) {
    assert.equal( condition, true, name );
    report.checks.push( name );
    console.log( `PASS ${ name }` );
}

const server = await startProbeServer( { port: 5199 } );
try {
    for ( const arm of [ 'corrected', 'old-normalize-zero' ] ) {
        const browser = await launchProbeBrowser();
        try {
            const page = await browser.newPage( { viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 } );
            const errors = [];
            let qualityInjections = 0;
            let rejectionInjections = 0;
            page.on( 'pageerror', ( error ) => errors.push( error.message ) );
            page.on( 'console', ( message ) => {
                if ( message.type() === 'error' ) errors.push( message.text() );
            } );
            page.on( 'requestfailed', ( request ) => errors.push( `${ request.url() }: ${ request.failure()?.errorText }` ) );
            page.on( 'response', ( response ) => {
                if ( response.status() >= 400 ) errors.push( `${ response.status() } ${ response.url() }` );
            } );
            await page.route( '**/src/portrait.js*', async ( route ) => {
                const response = await route.fetch();
                const source = await response.text();
                const body = source.replace( 'autoStart: false', "quality: 'high', autoStart: false" );
                assert.notEqual( body, source, 'portrait quality injection matched' );
                qualityInjections++;
                await route.fulfill( { response, body } );
            } );
            if ( arm === 'old-normalize-zero' ) {
                await page.route( '**/render/GTAO.js*', async ( route ) => {
                    const response = await route.fetch();
                    const source = await response.text();
                    const body = source.replace(
                        /occlusionTexel\.rgb\.length\(\)\.greaterThan\( 1e-5 \)\s*\.select\( occlusionTexel\.rgb, viewNormal \)\.normalize\(\)\.toVar\(\)/,
                        'occlusionTexel.rgb.normalize().toVar()'
                    );
                    assert.notEqual( body, source, 'old-code rejection injection matched' );
                    rejectionInjections++;
                    await route.fulfill( { response, body } );
                } );
            }
            await page.goto( `${ server.baseUrl }/src/portrait.html?capture&hair=bob02`, { waitUntil: 'domcontentloaded' } );
            await page.waitForFunction( () => window.portrait || !document.querySelector( '#error' ).hidden, null, { timeout: 90_000 } );
            assert.equal( await page.locator( '#error' ).textContent(), '' );
            const angles = arm === 'corrected' ? [ 0, 45, 90, 180, -90 ] : [ 0, 90 ];
            const poses = [];
            for ( const angle of angles ) {
                const pose = await page.evaluate( async ( angle ) => {
                    const { avatar, controls } = window.portrait;
                    const stage = avatar.stage;
                    controls.enableDamping = false;
                    const target = controls.target;
                    const distance = stage.camera.position.distanceTo( target );
                    const radians = angle * Math.PI / 180;
                    stage.camera.position.set(
                        target.x + Math.sin( radians ) * distance,
                        target.y,
                        target.z + Math.cos( radians ) * distance
                    );
                    controls.update();
                    for ( let frame = 0; frame < 24; frame++ ) await window.portrait.step( 0 );

                    const half = ( word ) => {
                        const sign = word & 0x8000 ? -1 : 1;
                        const exponent = ( word >> 10 ) & 31;
                        const mantissa = word & 1023;
                        if ( exponent === 31 ) return mantissa ? NaN : sign * Infinity;
                        return exponent === 0
                            ? sign * 2 ** -14 * ( mantissa / 1024 )
                            : sign * 2 ** ( exponent - 15 ) * ( 1 + mantissa / 1024 );
                    };
                    const read = async ( target ) => {
                        if ( !target ) throw new Error( 'Required render target is absent' );
                        const raw = await stage.renderer.readRenderTargetPixelsAsync(
                            target, 0, 0, target.width, target.height
                        );
                        if ( !( raw instanceof Uint16Array ) ) throw new Error( 'Expected RGBA16F readback' );
                        // WebGPU readback retains its 256-byte row padding, except after the last
                        // row. Count image pixels only; padding must never look like clear normals.
                        const rowWords = Math.ceil( target.width * 8 / 256 ) * 128;
                        if ( raw.length !== rowWords * ( target.height - 1 ) + target.width * 4 ) {
                            throw new Error( 'Unexpected WebGPU readback stride' );
                        }
                        const result = {
                            width: target.width, height: target.height,
                            pixels: target.width * target.height,
                            nonFinitePixels: 0, clearDirections: 0, occludedPixels: 0
                        };
                        for ( let y = 0; y < target.height; y++ ) {
                            for ( let x = 0; x < target.width; x++ ) {
                                const i = y * rowWords + x * 4;
                                const values = [ 0, 1, 2, 3 ].map( ( component ) => half( raw[ i + component ] ) );
                                if ( values.some( ( value ) => !Number.isFinite( value ) ) ) result.nonFinitePixels++;
                                if ( values[ 0 ] === 0 && values[ 1 ] === 0 && values[ 2 ] === 0 ) result.clearDirections++;
                                if ( values[ 3 ] < 0.95 ) result.occludedPixels++;
                            }
                        }
                        return result;
                    };
                    if ( !stage.ambientOcclusion?.bentNormalEnabled || !stage.grade?.bloomNode ) {
                        throw new Error( 'Bent-normal GTAO and bloom must both be enabled' );
                    }
                    return {
                        angle,
                        settings: stage.ambientOcclusion.describe(),
                        occlusion: await read( stage.ambientOcclusion.occlusion._target ),
                        composite: await read( stage.grade.bloomNode.inputNode.renderTarget ),
                        bloom: await read( stage.grade.bloomNode._renderTargetsHorizontal[ 0 ] )
                    };
                }, angle );
                const png = await page.locator( '#stage' ).screenshot();
                const pixels = decodePng( png );
                // The DOM caption overlaps the canvas near its bottom. Exclude that strip so
                // caption text cannot make an otherwise black canvas count as a visible figure.
                const measuredPixels = pixels.width * Math.floor( pixels.height * 0.8 );
                let visiblePixels = 0;
                for ( let i = 0; i < measuredPixels * 4; i += 4 ) {
                    if ( Math.max( pixels.pixels[ i ], pixels.pixels[ i + 1 ], pixels.pixels[ i + 2 ] ) > 30 / 255 ) visiblePixels++;
                }
                pose.visibleFraction = visiblePixels / measuredPixels;
                poses.push( pose );
                if ( captureDirectory ) await fs.writeFile( path.join( captureDirectory, `${ arm }-${ angle }.png` ), png );
                console.log( JSON.stringify( { arm, angle, visibleFraction: pose.visibleFraction,
                    compositeNonFinite: pose.composite.nonFinitePixels, bloomNonFinite: pose.bloom.nonFinitePixels } ) );
            }
            check( `${ arm }: exactly one quality injection`, qualityInjections === 1 );
            check( `${ arm }: no runtime, console or network errors`, errors.length === 0 );
            if ( arm === 'old-normalize-zero' ) check( 'exactly one old-code injection', rejectionInjections === 1 );
            report.arms[ arm ] = { poses, errors };
        } finally {
            await browser.close();
        }
    }
    const corrected = report.arms.corrected.poses;
    check( 'every corrected angle retains a visible figure', corrected.every( ( pose ) => pose.visibleFraction > 0.1 ) );
    check( 'every corrected AO, composite and bloom target is finite', corrected.every( ( pose ) =>
        [ pose.occlusion, pose.composite, pose.bloom ].every( ( target ) => target.nonFinitePixels === 0 ) ) );
    check( 'valid bent normals and nontrivial AO remain active', corrected.every( ( pose ) =>
        pose.settings.bentNormal && pose.occlusion.occludedPixels > 100 &&
        pose.occlusion.pixels - pose.occlusion.clearDirections > 1000 ) );
    check( 'the corrected side view exercises cleared AO directions', corrected.find( ( pose ) => pose.angle === 90 ).occlusion.clearDirections > 1000 );
    const [ oldFront, oldSide ] = report.arms[ 'old-normalize-zero' ].poses;
    check( 'the old code still renders front-on with finite composite and bloom', oldFront.visibleFraction > 0.1 &&
        oldFront.composite.nonFinitePixels === 0 && oldFront.bloom.nonFinitePixels === 0 );
    check( 'the old side view has finite AO but a non-finite composite', oldSide.occlusion.nonFinitePixels === 0 && oldSide.composite.nonFinitePixels > 100 );
    check( 'bloom spreads the old defect to its entire target and blacks the canvas',
        oldSide.bloom.nonFinitePixels === oldSide.bloom.pixels && oldSide.visibleFraction < 0.001 );
    console.log( `PASS ${ report.checks.length } orbit regression checks` );
} finally {
    if ( captureDirectory ) await fs.writeFile( path.join( captureDirectory, 'report.json' ), `${ JSON.stringify( report, null, 2 ) }\n` );
    await server.close();
}
