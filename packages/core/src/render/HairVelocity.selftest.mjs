/**
 * Gate for `render/HairVelocity.js` — punch-list 3.22.
 *
 * ## 🎯 It reads the BUFFER, not the frame, and that is the whole design of this file
 *
 * The defect is a motion vector, and a motion vector is not in the picture. It reaches the picture
 * only through `TAAUNode`'s reprojection, where it is one of eight terms, and round 16, round 21 and
 * `HairOIT.js`'s own header all attributed the resulting speckle to a different one of the eight.
 * Six knobs inside the resolve were mutated in flight before this file was written and not one of
 * them moved the picture by 12%; forcing the reprojection velocity to zero moved it 8.7x. So the
 * gate that means anything is the one that reads `velocity` out of the G-buffer and states it in
 * pixels per frame — and the picture clause is the corroboration, not the measurement.
 *
 * ## The stimulus, and why a `?freeze` plate cannot carry this gate
 *
 * The false velocity is the displacement between the solver's answer and the skinned rest pose. At
 * rest those agree, so **the shipped frozen plate reads zero on both arms** — measured, 0.0003
 * px/frame at p50 — and a gate taken there would be green with the fix deleted. The figure is
 * therefore yawed 35 degrees before the steps are taken, which is what actually displaces the
 * groom. `?freeze` still holds the head still, so nothing else in the frame is moving and every
 * pixel of the difference is attributable.
 *
 * ## Clauses
 *
 *   A1  RED PROOF. `?hairvel=off` is three r185 unpatched on this path, and it reports a p90 past
 *       `TAAUNode.maxVelocityLength` — the length at which the resolve declares its own history
 *       worthless. It is the same shape as `TRAAPost.selftest.mjs` T3.
 *   A2  `?hairvel=hold` puts the groom back on the jitter floor every other object in the frame
 *       sits on, so the solver contributes no velocity of its own.
 *   A3  and the picture follows: the per-pixel temporal sd over four CONSECUTIVE converged frames
 *       of a page where nothing is moving collapses.
 *   A4  the instrument's own floor. With `?hairmotion=0` the solver never displaces anything, so
 *       the two arms must agree — a gate that fired there would be measuring the flag, not the fix.
 */

import { fileURLToPath } from 'node:url';

import { startProbeServer, launchProbeBrowser } from './MotionProbe.mjs';
import { decodePng } from '../../../../tools/critic/png.mjs';
import { encodedLuma } from '../../../../tools/critic/color.mjs';

/** `TAAUNode.maxVelocityLength` at three r185 — the length at which the resolve gives up. */
const RESOLVE_GIVES_UP_AT_PIXELS = 128;

/**
 * The Halton camera jitter puts this much apparent motion on every pixel of the figure in every
 * arm, `?hairmotion=0` included. Measured this session at 900x1200 portrait: p50 0.3788, max
 * 0.3791 px/frame, identical to five decimal places across four unrelated configurations.
 */
const JITTER_FLOOR_PIXELS = 0.3792;

/** Degrees of figure yaw. Round 21 read the defect here and attributed it to the framing. */
const YAW_DEGREES = 35;

const STEPS = 96;
const HAIR_BAND = { x0: 200, y0: 150, x1: 800, y1: 1000 };

const results = [];

function check( name, passed, detail ) {

    results.push( { name, passed, detail } );
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

/**
 * Boots one arm, yaws the figure, steps it, and returns both the velocity attachment's statistics
 * and the four consecutive converged frames the picture clause reads.
 */
async function driveArm( browser, baseUrl, query, { yaw = YAW_DEGREES } = {} ) {

    const context = await browser.newContext( { viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 } );
    const page = await context.newPage();
    const errors = [];

    page.on( 'pageerror', ( error ) => errors.push( error.message ) );

    await page.goto( `${ baseUrl }/alive.html${ query }&capture`, { waitUntil: 'domcontentloaded' } );
    await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function', null,
        { timeout: 120000, polling: 200 } );

    // The bake is still loading while `__SUGATA_STEP__` returns false, so the first accepted step
    // is the epoch rather than the first call.
    for ( let attempt = 0; attempt < 200; attempt += 1 ) {

        if ( await page.evaluate( () => globalThis.__SUGATA_STEP__( 0 ) ) === true ) break;
        await page.waitForTimeout( 50 );

    }

    if ( yaw !== 0 ) {

        await page.evaluate( ( degrees ) => {

            const root = globalThis.sugata.session.figure.root;
            root.rotation.y = degrees * Math.PI / 180;
            root.updateMatrixWorld( true );

        }, yaw );

    }

    const plates = [];

    for ( let step = 1; step <= STEPS; step += 1 ) {

        await page.evaluate( () => globalThis.__SUGATA_STEP__( 1 / 60 ) );

        if ( step > STEPS - 4 ) plates.push( decodePng( await page.screenshot() ) );

    }

    const velocity = await page.evaluate( async () => {

        const stage = globalThis.sugata.stage;
        const target = stage.gbuffer.pass.renderTarget;
        const index = target.textures.map( ( texture ) => texture.name ).indexOf( 'velocity' );
        const raw = await stage.renderer.readRenderTargetPixelsAsync(
            target, 0, 0, target.width, target.height, index );

        return { raw: Array.from( raw ), width: target.width, height: target.height, isHalf: raw.constructor.name === 'Uint16Array' };

    } );

    await context.close();

    return { velocity: velocityStatistics( velocity ), plates, errors };

}

/**
 * The `velocity` attachment is RG16F and comes back as raw half-float BITS, not as decoded floats.
 * Reading it as numbers gives p50 13,940,579 and every threshold below it passes for the wrong
 * reason, so the decode is here and not assumed.
 */
function velocityStatistics( { raw, width, height, isHalf } ) {

    const decodeHalf = ( bits ) => {

        const sign = ( bits & 0x8000 ) ? -1 : 1;
        const exponent = ( bits >> 10 ) & 0x1f;
        const fraction = bits & 0x3ff;

        if ( exponent === 0 ) return sign * Math.pow( 2, -14 ) * ( fraction / 1024 );
        if ( exponent === 31 ) return fraction ? NaN : sign * Infinity;

        return sign * Math.pow( 2, exponent - 15 ) * ( 1 + fraction / 1024 );

    };

    const magnitudes = [];

    for ( let pixel = 0; pixel < width * height; pixel += 1 ) {

        const x = isHalf ? decodeHalf( raw[ pixel * 4 ] ) : raw[ pixel * 4 ];
        const y = isHalf ? decodeHalf( raw[ pixel * 4 + 1 ] ) : raw[ pixel * 4 + 1 ];

        // The attachment holds an NDC offset; the resolve turns it into texels of the SCENE pass,
        // which is what `maxVelocityLength` is stated in.
        const pixels = Math.hypot( x * 0.5 * width, y * 0.5 * height );

        if ( Number.isFinite( pixels ) && pixels > 0 ) magnitudes.push( pixels );

    }

    magnitudes.sort( ( a, b ) => a - b );

    const quantile = ( t ) => ( magnitudes.length === 0 ? 0 : magnitudes[ Math.floor( t * ( magnitudes.length - 1 ) ) ] );

    return { nonZero: magnitudes.length, p50: quantile( 0.5 ), p90: quantile( 0.9 ), max: quantile( 1 ) };

}

/** Mean per-pixel temporal sd of the encoded luma over the hair band, in 8-bit code values. */
function temporalSigma( plates ) {

    const { width } = plates[ 0 ];
    const luma = plates.map( ( plate ) => {

        const values = new Float64Array( plate.width * plate.height );

        for ( let i = 0, p = 0; i < values.length; i += 1, p += 4 ) {

            values[ i ] = encodedLuma( plate.pixels[ p ] * 255, plate.pixels[ p + 1 ] * 255, plate.pixels[ p + 2 ] * 255 );

        }

        return values;

    } );

    let total = 0;
    let counted = 0;

    for ( let y = HAIR_BAND.y0; y < HAIR_BAND.y1; y += 1 ) {

        for ( let x = HAIR_BAND.x0; x < HAIR_BAND.x1; x += 1 ) {

            const i = y * width + x;
            let mean = 0;

            for ( const plane of luma ) mean += plane[ i ];
            mean /= luma.length;

            let variance = 0;

            for ( const plane of luma ) variance += ( plane[ i ] - mean ) ** 2;

            total += Math.sqrt( variance / luma.length );
            counted += 1;

        }

    }

    return total / counted;

}

async function main() {

    const server = await startProbeServer( { port: 5191 } );
    const browser = await launchProbeBrowser();

    try {

        const base = '?bare&freeze&seed=1&grain=0&hair=1';

        const off = await driveArm( browser, server.baseUrl, `${ base }&hairvel=off` );
        const hold = await driveArm( browser, server.baseUrl, `${ base }&hairvel=hold` );
        const rigid = await driveArm( browser, server.baseUrl, `${ base }&hairmotion=0&hairvel=off` );
        const rigidHeld = await driveArm( browser, server.baseUrl, `${ base }&hairmotion=0&hairvel=hold` );

        const pageErrors = [ ...off.errors, ...hold.errors, ...rigid.errors, ...rigidHeld.errors ];

        check( 'no page threw while the four arms were driven',
            pageErrors.length === 0,
            pageErrors.length === 0 ? 'four arms, no page error' : pageErrors.join( ' | ' ) );

        // --- A1, the red proof ------------------------------------------------------------------

        check( 'A1 RED PROOF: without the assignment the groom reports a velocity the resolve gives up on',
            off.velocity.p90 > RESOLVE_GIVES_UP_AT_PIXELS,
            `?hairvel=off reads p50 ${ off.velocity.p50.toFixed( 3 ) }, p90 ${ off.velocity.p90.toFixed( 3 ) }, ` +
            `max ${ off.velocity.max.toFixed( 3 ) } px/frame against TAAUNode.maxVelocityLength ${ RESOLVE_GIVES_UP_AT_PIXELS } — ` +
            'on a groom that is geometrically static, at ' + YAW_DEGREES + ' degrees of figure yaw. This is three r185 ' +
            'unpatched: `material.positionNode` overwrites `positionLocal` and nothing assigns `positionPrevious`, ' +
            'so the number is the displacement from the skinned rest pose, not a motion.' );

        // --- A2, the fix ------------------------------------------------------------------------

        check( 'A2 with the assignment the groom sits on the same jitter floor as everything else',
            hold.velocity.max <= JITTER_FLOOR_PIXELS,
            `?hairvel=hold reads p50 ${ hold.velocity.p50.toFixed( 4 ) }, p90 ${ hold.velocity.p90.toFixed( 4 ) }, ` +
            `max ${ hold.velocity.max.toFixed( 4 ) } px/frame against the Halton floor ${ JITTER_FLOOR_PIXELS } — ` +
            `${ ( off.velocity.p90 / hold.velocity.p90 ).toFixed( 0 ) }x below the arm above at p90` );

        // --- A3, and the picture ----------------------------------------------------------------

        const offSigma = temporalSigma( off.plates );
        const holdSigma = temporalSigma( hold.plates );

        check( 'A3 and the picture follows: four consecutive converged frames of a still page agree again',
            holdSigma < 1 && offSigma / holdSigma > 4,
            `per-pixel temporal sd over the hair band: off ${ offSigma.toFixed( 4 ) } cv, hold ${ holdSigma.toFixed( 4 ) } cv ` +
            `— ${ ( offSigma / holdSigma ).toFixed( 2 ) }x. Nothing in the scene is moving on either plate; the ` +
            'difference is entirely the stochastic coverage being integrated or not.' );

        // --- A4, the instrument's floor ---------------------------------------------------------

        const rigidDelta = Math.abs( rigid.velocity.p90 - rigidHeld.velocity.p90 );

        check( 'A4 the fix is inert where the solver never displaces anything, which is what makes A1 a measurement',
            rigidDelta < 0.01 && rigid.velocity.p90 <= JITTER_FLOOR_PIXELS,
            `?hairmotion=0: off p90 ${ rigid.velocity.p90.toFixed( 4 ) }, hold p90 ${ rigidHeld.velocity.p90.toFixed( 4 ) } ` +
            `px/frame, ${ rigidDelta.toFixed( 5 ) } apart. A gate that fired here would be reading the flag rather ` +
            'than the repair, and every gate plate in the repository is captured at rest.' );

    } finally {

        await browser.close();
        await server.close();

    }

    const green = results.filter( ( result ) => result.passed ).length;

    console.log( `\n${ green === results.length ? 'PASS' : 'FAIL' }: ${ green }/${ results.length } checks green` );

    if ( green !== results.length ) process.exitCode = 1;

}

if ( process.argv[ 1 ] === fileURLToPath( import.meta.url ) ) await main();
