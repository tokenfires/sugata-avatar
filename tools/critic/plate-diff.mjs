/**
 * plate-diff — one still per variant, from a fresh load each, differenced against the first.
 *
 * The perf question is "can this pass go", and the only thing that answers it is what the pass
 * puts on screen. `?bloom=0` is 5.75 ms; whether that is 5.75 ms of picture or 5.75 ms of black
 * is a pixel measurement, not an argument.
 *
 * 🎯 WHY THIS EXISTS BESIDE `capture.mjs --plate`, WHICH ALREADY COMPARES PLATES. `capture.mjs`
 * answers "is this the same picture" with a sha256, which is a boolean over the last code value.
 * That is the right instrument for reproducibility and the wrong one for CHANGE: the shipped 3840
 * plate's own recorded residue is Δ2 on 164 px, so a bare digest comparison reports a false
 * positive on a restructure that moved nothing. This reports maxΔ, meanΔ and the populations over
 * Δ0/Δ1/Δ2, which is what turns "this should be pixel-identical" into "0 of 19,660,800 pixels
 * differ", and "nothing in our frame blooms" into "78% of pixels, mean 4.48/255, max 232".
 *
 * It takes ONE screenshot per plate rather than sixty, so a 3840x5120 pair costs minutes against
 * `capture.mjs --plate`'s recorded 363 s per plate. That is the whole of the trade: it cannot speak
 * about reproducibility ACROSS loads, only about difference BETWEEN configurations, and every plate
 * is taken from a fresh load so the comparison is not contaminated by a warm resolve.
 *
 * ⚠️ REUSE DEBT, RECORDED RATHER THAN HIDDEN. This file decodes PNG itself — 8-bit RGB/RGBA,
 * non-interlaced — instead of importing `tools/critic/png.mjs` beside it. That is a second decoder
 * in one directory and it should be reconciled. It is deliberately NOT reconciled in the round that
 * landed the file, because `png.mjs` normalises to [0,1] and this reads raw code values, and the
 * unit mismatch between exactly those two conventions is what produced a plausible 46% reading off
 * an all-black frame in the same round (LEARNINGS §1.25z). Reconcile it with a known-answer test in
 * front of it, not as a tidy-up.
 *
 * Usage: node plate-diff.mjs --variants "" --variants "bloom=0" --steps 60 --width 900 --height 1200
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( HERE, '..', '..' );
const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

async function main() {

    const options = parse( process.argv.slice( 2 ) );
    const playwright = await loadPlaywright();
    const server = await startViteServer();
    const browser = await playwright.chromium.launch( { channel: 'chromium', headless: true, args: GPU_FLAGS } );

    const plates = [];

    for ( const file of options.references ) {
        plates.push( { variant: `FILE ${ path.basename( file ) }`, pixels: decodePng( fs.readFileSync( file ) ), file } );
    }

    try {

        for ( const variant of options.variants ) {

            const context = await browser.newContext( {
                viewport: { width: options.width, height: options.height },
                deviceScaleFactor: 1, colorScheme: 'dark'
            } );
            const page = await context.newPage();
            page.on( 'pageerror', ( e ) => console.warn( `  page error: ${ e.message }` ) );

            const url = new URL( '/alive.html', server.baseUrl );
            url.searchParams.set( 'bare', '1' );
            url.searchParams.set( 'freeze', '1' );
            url.searchParams.set( 'seed', '1' );
            url.searchParams.set( 'capture', '1' );
            if ( options.frame === 'body' ) url.searchParams.set( 'frame', 'body' );
            for ( const pair of variant.split( '&' ).filter( Boolean ) ) {
                const i = pair.indexOf( '=' );
                url.searchParams.set( pair.slice( 0, i ), pair.slice( i + 1 ) );
            }

            await page.goto( url.href, { waitUntil: 'load', timeout: 180_000 } );
            await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function', null, { timeout: 180_000 } );
            await page.evaluate( async ( steps ) => {
                for ( let i = 0; i < steps; i ++ ) {
                    const ok = await globalThis.__SUGATA_STEP__( 1 / 60 );
                    if ( ok === false ) { i --; await new Promise( ( r ) => setTimeout( r, 50 ) ); }
                }
            }, options.steps );

            const png = await page.locator( '#stage' ).screenshot( { type: 'png' } );
            const file = path.join( HERE, `plate-${ variant.replace( /[^a-z0-9]+/gi, '_' ) || 'base' }.png` );
            fs.writeFileSync( file, png );
            plates.push( { variant: variant || '(base)', pixels: decodePng( png ), file } );
            console.log( `captured ${ variant || '(base)' }  ->  ${ path.basename( file ) }` );
            await context.close();

        }

    } finally {
        await browser.close();
        await server.close();
    }

    const reference = plates[ 0 ];
    console.log( '' );
    console.log( `reference: ${ reference.variant }   ${ reference.pixels.width }x${ reference.pixels.height }` );
    console.log( 'variant                    maxΔ  meanΔ×1000   px Δ>0      px Δ>1      px Δ>2   of' );
    for ( const plate of plates.slice( 1 ) ) {
        const d = diff( reference.pixels, plate.pixels );
        console.log( `${ plate.variant.padEnd( 24 ) } ${ String( d.max ).padStart( 5 ) } ${ ( d.mean * 1000 ).toFixed( 4 ).padStart( 11 ) } ${ String( d.over0 ).padStart( 10 ) } ${ String( d.over1 ).padStart( 11 ) } ${ String( d.over2 ).padStart( 11 ) }  ${ d.total }` );
    }

}

function diff( a, b ) {
    if ( a.width !== b.width || a.height !== b.height ) throw new Error( 'size mismatch' );
    let max = 0, sum = 0, over0 = 0, over1 = 0, over2 = 0;
    const total = a.width * a.height;
    for ( let i = 0; i < total; i ++ ) {
        let worst = 0;
        for ( let c = 0; c < 3; c ++ ) {
            const delta = Math.abs( a.data[ i * 4 + c ] - b.data[ i * 4 + c ] );
            if ( delta > worst ) worst = delta;
        }
        sum += worst;
        if ( worst > max ) max = worst;
        if ( worst > 0 ) over0 ++;
        if ( worst > 1 ) over1 ++;
        if ( worst > 2 ) over2 ++;
    }
    return { max, mean: sum / total, over0, over1, over2, total };
}

// --- a minimal PNG reader: 8-bit RGB/RGBA, non-interlaced, which is what Chromium writes -------

function decodePng( buffer ) {
    let offset = 8;
    let width = 0, height = 0, colourType = 0, bitDepth = 0;
    const idat = [];
    while ( offset < buffer.length ) {
        const length = buffer.readUInt32BE( offset );
        const type = buffer.toString( 'ascii', offset + 4, offset + 8 );
        const body = buffer.subarray( offset + 8, offset + 8 + length );
        if ( type === 'IHDR' ) {
            width = body.readUInt32BE( 0 );
            height = body.readUInt32BE( 4 );
            bitDepth = body[ 8 ];
            colourType = body[ 9 ];
            if ( bitDepth !== 8 || ( colourType !== 6 && colourType !== 2 ) ) throw new Error( `unsupported PNG ${ bitDepth }/${ colourType }` );
        } else if ( type === 'IDAT' ) {
            idat.push( body );
        } else if ( type === 'IEND' ) break;
        offset += 12 + length;
    }
    const raw = zlib.inflateSync( Buffer.concat( idat ) );
    const channels = colourType === 6 ? 4 : 3;
    const stride = width * channels;
    const data = new Uint8Array( width * height * 4 );
    let previous = new Uint8Array( stride );
    for ( let y = 0; y < height; y ++ ) {
        const filter = raw[ y * ( stride + 1 ) ];
        const line = raw.subarray( y * ( stride + 1 ) + 1, y * ( stride + 1 ) + 1 + stride );
        const current = new Uint8Array( stride );
        for ( let x = 0; x < stride; x ++ ) {
            const left = x >= channels ? current[ x - channels ] : 0;
            const up = previous[ x ];
            const upLeft = x >= channels ? previous[ x - channels ] : 0;
            let value = line[ x ];
            if ( filter === 1 ) value += left;
            else if ( filter === 2 ) value += up;
            else if ( filter === 3 ) value += ( left + up ) >> 1;
            else if ( filter === 4 ) {
                const p = left + up - upLeft;
                const pa = Math.abs( p - left ), pb = Math.abs( p - up ), pc = Math.abs( p - upLeft );
                value += ( pa <= pb && pa <= pc ) ? left : ( pb <= pc ? up : upLeft );
            }
            current[ x ] = value & 0xff;
        }
        for ( let x = 0; x < width; x ++ ) {
            data[ ( y * width + x ) * 4 + 0 ] = current[ x * channels + 0 ];
            data[ ( y * width + x ) * 4 + 1 ] = current[ x * channels + 1 ];
            data[ ( y * width + x ) * 4 + 2 ] = current[ x * channels + 2 ];
            data[ ( y * width + x ) * 4 + 3 ] = channels === 4 ? current[ x * channels + 3 ] : 255;
        }
        previous = current;
    }
    return { width, height, data };
}

async function startViteServer() {
    const { createServer } = await import( pathToFileURL( path.join( REPOSITORY_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js' ) ).href );
    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5194, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'warn'
    } );
    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );
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
            const ns = await import( pathToFileURL( require.resolve( candidate ) ).href );
            if ( ns.chromium ) return ns;
            if ( ns.default?.chromium ) return ns.default;
        } catch { /* next */ }
    }
    throw new Error( 'playwright not resolvable' );
}

function parse( argv ) {
    const options = { variants: [], references: [], steps: 60, width: 900, height: 1200, frame: 'portrait' };
    for ( let i = 0; i < argv.length; i ++ ) {
        const flag = argv[ i ]; const value = argv[ i + 1 ];
        switch ( flag ) {
            case '--variants': options.variants.push( value ); i ++; break;
            case '--reference': options.references.push( value ); i ++; break;
            case '--steps': options.steps = Number( value ); i ++; break;
            case '--width': options.width = Number( value ); i ++; break;
            case '--height': options.height = Number( value ); i ++; break;
            case '--frame': options.frame = value; i ++; break;
            default: throw new Error( `unknown flag ${ flag }` );
        }
    }
    if ( options.variants.length + options.references.length < 2 ) throw new Error( 'need at least two plates' );
    return options;
}

main().catch( ( e ) => { console.error( e ); process.exit( 1 ); } );
