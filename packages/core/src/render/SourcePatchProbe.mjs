/**
 * A selftest instrument: drive `post.html` with one module's SOURCE rewritten in flight.
 *
 * ## Why this exists
 *
 * `Grade.js` carries `GRAIN_DEFECTS` — a table of deliberately broken grains a gate can render and
 * watch its checks go red. That is the right pattern and it has one hard edge: a defect that is
 * not already in the table cannot be reached from a URL, so proving a gate against a NEW mechanism
 * means editing the implementation. In a fan-out that implementation belongs to somebody else, and
 * a temporary patch to a file another agent is writing is a merge accident with a stopwatch on it.
 *
 * So this fetches the module vite is serving, rewrites the text, and fulfils the request with the
 * rewritten body. Nothing is written to the working tree, the proof is re-runnable by anyone, and
 * the defect goes through the real module graph — the patched `Grade.js` is compiled, instantiated
 * and rendered exactly as the shipped one is.
 *
 * ## The one rule
 *
 * **A patch whose anchor is not found is a silent no-op, and a silent no-op in a rejection proof
 * produces a clean run that reads as "the gate does not catch this".** That is the wrong
 * conclusion drawn from the right observation, so `patchesApplied` is returned and every caller
 * must assert it. `capturePatchedPlates` throws rather than returning if a declared patch never
 * matched, which is the same rule enforced one level harder.
 *
 * Mirrors `MotionProbe.capturePlates`'s signature and semantics deliberately: same `keep`, same
 * `frames`, same `stepSeconds`, same returned shape, so a caller can swap one for the other and
 * compare. It re-implements rather than wraps because `capturePlates` owns its browser context and
 * there is no hook into it for a route.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( HERE, '..', '..', '..', '..' );

const { decodePng } = await import( pathToFileURL( path.join( REPOSITORY_ROOT, 'tools', 'critic', 'png.mjs' ) ).href );

const READY_TIMEOUT_MS = 120_000;

/**
 * @typedef {Object} SourcePatch
 * @property {string} urlPattern - glob the route matches, e.g. `'**\/Grade.js*'`.
 * @property {string} anchor - literal text to replace. Must appear at least once in the served
 *   module or the capture throws.
 * @property {string} replacement - what to put in its place.
 */

/**
 * One `post.html` load with `patch` applied to whatever module it matches, stepped `frames` times.
 *
 * @param {Object} options - as `MotionProbe.capturePlates`, plus:
 * @param {?SourcePatch} [options.patch=null] - null runs the shipped source, which is what makes
 *   this usable for the control arm of a comparison as well as the defect arm.
 * @returns {Promise<{ frames: Map<number, {width:number,height:number,data:Uint8Array}>, patchesApplied: number, errors: string[] }>}
 */
export async function capturePatchedPlates( {
    browser, baseUrl, query, page: pagePath = '/src/post.html',
    width = 900, height = 1200, frames = 1, fps = 60, stepSeconds = null, keep = null, patch = null
} ) {

    const wanted = new Set( keep ?? [ frames ] );

    const context = await browser.newContext( {
        viewport: { width, height },
        deviceScaleFactor: 1,
        colorScheme: 'dark',
        reducedMotion: 'no-preference'
    } );

    const page = await context.newPage();
    const errors = [];

    let patchesApplied = 0;

    page.on( 'pageerror', ( error ) => errors.push( error.message ) );
    page.on( 'console', ( message ) => {

        if ( message.type() === 'error' && /favicon/i.test( message.location()?.url ?? '' ) === false ) {

            errors.push( `console: ${ message.text() }` );

        }

    } );

    if ( patch !== null ) {

        await page.route( patch.urlPattern, async ( route ) => {

            const response = await route.fetch();
            const body = await response.text();

            if ( body.includes( patch.anchor ) === false ) {

                await route.fulfill( { response } );
                return;

            }

            patchesApplied += 1;

            await route.fulfill( {
                status: 200,
                headers: { ...response.headers(), 'content-type': 'application/javascript' },
                body: body.replaceAll( patch.anchor, patch.replacement )
            } );

        } );

    }

    const separator = query.startsWith( '?' ) ? '&' : '?';
    const url = `${ baseUrl }${ pagePath }${ query }${ separator }capture`;

    await page.goto( url, { waitUntil: 'domcontentloaded' } );

    await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function',
        null, { timeout: READY_TIMEOUT_MS, polling: 200 } )
        .catch( () => {

            throw new Error( `post.html never became ready for ${ url }` +
                ( errors.length > 0 ? `\n  ${ errors.join( '\n  ' ) }` : '' ) );

        } );

    // Asserted before a single frame is measured. See the header: a proof that did not apply its
    // defect is the most misleading result this instrument can produce.
    if ( patch !== null && patchesApplied === 0 ) {

        await context.close();

        throw new Error( `SourcePatchProbe: the anchor was never found in any module matching ` +
            `'${ patch.urlPattern }'. Nothing was patched, so the run that would have followed is a ` +
            'run of the SHIPPED source and any green result from it means nothing.' );

    }

    const decoded = new Map();
    const step = stepSeconds ?? ( 1 / fps );

    for ( let frame = 1; frame <= frames; frame += 1 ) {

        const stepped = await page.evaluate( ( dt ) => globalThis.__SUGATA_STEP__( dt ), step );

        if ( stepped !== true ) throw new Error( `__SUGATA_STEP__ refused at frame ${ frame } of ${ url }` );

        if ( wanted.has( frame ) === false ) continue;

        const { width: shotWidth, height: shotHeight, pixels } = decodePng( await page.screenshot() );

        decoded.set( frame, { width: shotWidth, height: shotHeight, data: pixels } );

    }

    await context.close();

    return { frames: decoded, patchesApplied, errors };

}
