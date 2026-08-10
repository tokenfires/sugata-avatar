/**
 * pass-profile — name every render context in one frame of `alive.html` and cost it.
 *
 * The perf round could see that six passes cost 13.98 of 16.22 ms but not WHICH six, because
 * three keys its timestamp pool by a numeric render-context id. This wraps
 * `backend.getTimestampUID` to record, alongside the uid, the render target texture name and
 * size — which is enough to name every pass a post chain builds.
 *
 * 🚩 IT NAMES PASSES RELIABLY AND PRICES THEM UNRELIABLY. READ THIS BEFORE ACTING ON A NUMBER.
 *
 * Measured on this machine at 1080p portrait, twenty passes, shipped default: the sum of the
 * per-pass p50s matches the frame total to 0.3%, so the timestamps are internally consistent. They
 * are also individually meaningless in the middle of the range. SIX passes spanning 960x540 to
 * 1920x1080, doing everything from a brightness threshold to a full G-buffer, all land within 5% of
 * the same ~1.44 ms plateau —
 *
 *     05 ShadowMap 4096x4096                       0.266     <- real geometry, a sixteenth of the plateau
 *     06 UnrealBloomPass.h0 960x540                1.449
 *     07 ? 1920x1080                               1.443     <- worth 5.62 ms by toggle
 *     08 UnrealBloomPass.bright 960x540            1.456
 *     09 UnrealBloomPass.h0 960x540                0.059     <- the same pass, second mip, 25x cheaper
 *
 * — while the pass this tool priced at 1.443 was worth 5.62 ms when it was actually removed, and a
 * 4096-square shadow map with real geometry prices at 0.266. The plateau is a stall or
 * serialisation artefact, not work, and its microarchitectural cause is UNINVESTIGATED.
 *
 * So: ATTRIBUTE BY TOGGLE. Use this list to find WHAT to toggle and never to price it. The three
 * unnamed full-resolution contexts it printed are what pointed at `convertToTexture` building a
 * redundant full-resolution RTT every frame; that is the job it is good at, and it is the job it
 * was written for.
 *
 * Usage: node pass-profile.mjs [--query "aa=taau"] [--frame body] [--size 1080p] [--samples 120]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( HERE, '..', '..' );

const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

const SIZES = {
    '1080p': { width: 1920, height: 1080, dpr: 1 },
    'pageDefault': { width: 1728, height: 1117, dpr: 2 },
    '720p': { width: 1280, height: 720, dpr: 1 }
};

async function main() {

    const options = parse( process.argv.slice( 2 ) );
    const playwright = await loadPlaywright();
    const server = await startViteServer();
    const browser = await playwright.chromium.launch( { channel: 'chromium', headless: true, args: GPU_FLAGS } );

    try {

        const size = SIZES[ options.size ];
        const context = await browser.newContext( {
            viewport: { width: size.width, height: size.height },
            deviceScaleFactor: size.dpr, colorScheme: 'dark'
        } );
        const page = await context.newPage();

        await page.route( '**/src/alive.js*', async ( route ) => {
            const response = await route.fetch();
            const body = await response.text();
            const needle = 'await stage.create( document.getElementById( \'stage\' ), {';
            const patched = body.replace( needle, needle + '\n        trackTimestamp: true,' );
            await route.fulfill( { response, body: patched, headers: { ...response.headers(), 'content-length': String( Buffer.byteLength( patched ) ) } } );
        } );

        page.on( 'pageerror', ( e ) => console.warn( `  page error: ${ e.message }` ) );
        page.on( 'console', ( m ) => { if ( m.type() === 'error' ) console.warn( `  console: ${ m.text() }` ); } );

        const url = new URL( '/alive.html', server.baseUrl );
        url.searchParams.set( 'bare', '1' );
        url.searchParams.set( 'seed', '1' );
        url.searchParams.set( 'capture', '1' );
        if ( options.frame === 'body' ) url.searchParams.set( 'frame', 'body' );
        for ( const pair of options.query.split( '&' ).filter( Boolean ) ) {
            const i = pair.indexOf( '=' );
            url.searchParams.set( pair.slice( 0, i ), pair.slice( i + 1 ) );
        }

        console.log( `url       ${ url.href }` );
        await page.goto( url.href, { waitUntil: 'load', timeout: 180_000 } );
        await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function', null, { timeout: 180_000 } );

        const environment = await page.evaluate( () => {
            const stage = globalThis.sugata.stage;
            return {
                backend: stage.backendName,
                trackTimestamp: stage.renderer.backend.trackTimestamp === true,
                drawingBuffer: [ stage.renderer.domElement.width, stage.renderer.domElement.height ],
                resolutionScale: stage.resolutionScale
            };
        } );
        if ( environment.trackTimestamp !== true ) throw new Error( 'trackTimestamp patch did not take' );
        console.log( `env       ${ JSON.stringify( environment ) }` );

        const result = await page.evaluate( async ( { warmup, samples } ) => {

            const stage = globalThis.sugata.stage;
            const renderer = stage.renderer;
            const backend = renderer.backend;

            // Name the passes. The uid is minted per render context per frame; the render context
            // still carries its render target, so the texture name three already assigns is the
            // attribution the numeric id lacks.
            const named = new Map();
            const seqByFrame = new Map();
            const original = backend.getTimestampUID.bind( backend );
            backend.getTimestampUID = function ( renderContext ) {
                const uid = original( renderContext );
                if ( named.has( uid ) === false ) {
                    const frame = uid.slice( uid.lastIndexOf( ':f' ) + 2 );
                    const seq = ( seqByFrame.get( frame ) ?? 0 );
                    seqByFrame.set( frame, seq + 1 );
                    const target = renderContext.renderTarget ?? null;
                    const textures = target === null ? [] : ( target.textures ?? [ target.texture ] );
                    const colour = textures.map( ( t ) => t?.name || '(no name)' ).join( '+' );
                    const depth = target?.depthTexture?.name ?? null;
                    const material = renderContext.scene?.children?.[ 0 ]?.material?.name ?? null;
                    const objectName = renderContext.scene?.children?.[ 0 ]?.name ?? null;
                    named.set( uid, {
                        seq,
                        id: renderContext.id,
                        target: target === null ? 'CANVAS'
                            : `${ colour }${ depth ? `|depth:${ depth }` : '' }`,
                        material, objectName,
                        width: renderContext.width ?? target?.width ?? null,
                        height: renderContext.height ?? target?.height ?? null,
                        objects: renderContext.scene?.children?.length ?? null
                    } );
                }
                return uid;
            };

            for ( let i = 0; i < warmup; i ++ ) {
                const ok = await globalThis.__SUGATA_STEP__( 1 / 60 );
                if ( ok === false ) { i --; await new Promise( ( r ) => setTimeout( r, 50 ) ); }
            }
            await renderer.resolveTimestampsAsync( 'render' );

            const pool = backend.timestampQueryPool.render;
            const perPass = new Map();   // key -> array of ms
            const totals = [];

            for ( let i = 0; i < samples; i ++ ) {
                pool.timestamps.clear();
                await globalThis.__SUGATA_STEP__( 1 / 60 );
                const total = await renderer.resolveTimestampsAsync( 'render' );
                if ( typeof total !== 'number' || total <= 0 ) continue;
                totals.push( total );

                // Keep only the newest frame's uids, matching what resolveTimestampsAsync returns.
                let newest = -1;
                for ( const uid of pool.timestamps.keys() ) {
                    const f = Number( uid.slice( uid.lastIndexOf( ':f' ) + 2 ) );
                    if ( f > newest ) newest = f;
                }
                for ( const [ uid, ms ] of pool.timestamps ) {
                    const f = Number( uid.slice( uid.lastIndexOf( ':f' ) + 2 ) );
                    if ( f !== newest ) continue;
                    const meta = named.get( uid ) ?? { seq: 99, target: '?', width: null, height: null, id: null };
                    const key = `${ String( meta.seq ).padStart( 2, '0' ) } ${ meta.target }`
                        + `${ meta.material ? ` [${ meta.material }]` : '' } ${ meta.width }x${ meta.height }`;
                    if ( perPass.has( key ) === false ) perPass.set( key, [] );
                    perPass.get( key ).push( ms );
                }
            }

            return {
                totals,
                passes: [ ...perPass ].map( ( [ key, values ] ) => ( { key, values } ) )
            };

        }, { warmup: options.warmup, samples: options.samples } );

        const p = ( a, q ) => { const s = a.slice().sort( ( x, y ) => x - y ); return s[ Math.min( s.length - 1, Math.floor( s.length * q ) ) ]; };
        const f = ( v ) => ( v === undefined ? '—' : v.toFixed( 3 ) );

        console.log( '' );
        console.log( 'pass                                                          p50      p99      n' );
        let sum = 0;
        result.passes.sort( ( a, b ) => a.key.localeCompare( b.key ) );
        for ( const { key, values } of result.passes ) {
            sum += p( values, 0.5 );
            console.log( `${ key.padEnd( 58 ) } ${ f( p( values, 0.5 ) ).padStart( 8 ) } ${ f( p( values, 0.99 ) ).padStart( 8 ) } ${ String( values.length ).padStart( 6 ) }` );
        }
        console.log( `${ 'SUM of per-pass p50'.padEnd( 58 ) } ${ f( sum ).padStart( 8 ) }` );
        console.log( `${ 'FRAME TOTAL'.padEnd( 58 ) } ${ f( p( result.totals, 0.5 ) ).padStart( 8 ) } ${ f( p( result.totals, 0.99 ) ).padStart( 8 ) } ${ String( result.totals.length ).padStart( 6 ) }` );

        fs.writeFileSync( path.join( HERE, `pass-profile.${ options.label }.json` ), JSON.stringify( { url: url.href, environment, result }, null, 2 ) );
        await context.close();

    } finally {
        await browser.close();
        await server.close();
    }

}

async function startViteServer() {
    const { createServer } = await import( pathToFileURL( path.join( REPOSITORY_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js' ) ).href );
    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5193, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'warn'
    } );
    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );
    console.log( `vite      ${ server.baseUrl }` );
    return server;
}

async function loadPlaywright() {
    const candidates = [ path.join( REPOSITORY_ROOT, 'node_modules', 'playwright' ), 'playwright' ];
    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );
    if ( fs.existsSync( cache ) ) {
        for ( const entry of fs.readdirSync( cache ) ) {
            const candidate = path.join( cache, entry, 'node_modules', 'playwright' );
            if ( fs.existsSync( candidate ) ) candidates.push( candidate );
        }
    }
    const require = createRequire( pathToFileURL( path.join( REPOSITORY_ROOT, 'package.json' ) ).href );
    for ( const candidate of candidates ) {
        try {
            const resolved = require.resolve( candidate );
            const ns = await import( pathToFileURL( resolved ).href );
            if ( ns.chromium ) return ns;
            if ( ns.default?.chromium ) return ns.default;
        } catch { /* next */ }
    }
    throw new Error( 'playwright not resolvable' );
}

function parse( argv ) {
    const options = { query: '', frame: 'portrait', size: '1080p', samples: 120, warmup: 150, label: 'base' };
    for ( let i = 0; i < argv.length; i ++ ) {
        const flag = argv[ i ]; const value = argv[ i + 1 ];
        switch ( flag ) {
            case '--query': options.query = value; i ++; break;
            case '--frame': options.frame = value; i ++; break;
            case '--size': options.size = value; i ++; break;
            case '--samples': options.samples = Number( value ); i ++; break;
            case '--warmup': options.warmup = Number( value ); i ++; break;
            case '--label': options.label = value; i ++; break;
            default: throw new Error( `unknown flag ${ flag }` );
        }
    }
    return options;
}

main().catch( ( e ) => { console.error( e ); process.exit( 1 ); } );
