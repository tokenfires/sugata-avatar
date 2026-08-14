#!/usr/bin/env node
//
// hair-plates.mjs — the two hair plates, portrait and three-quarter, off `alive.html`.
//
// ## Why this exists rather than `hair_shots.mjs`
//
// 🚩 `captures/hair-r23-*` WERE TAKEN OFF `packages/testbed/src/hair.html`, WHICH DOES NOT RUN THE
// HAIR SHADER. That page builds a `MeshStandardNodeMaterial` from the groom's baked albedo and
// normal sheets — its own HUD says so in capital letters — so nothing in
// `packages/core/src/material/HairMaterial.js` reaches those pixels. The frostbitten control's
// "sugata" arm used `captures/hair-r23-after/front.png` and `three-quarter.png`, i.e. the GEOMETRY
// under a plain material. That is a real and useful control for the groom; it is not a plate of
// this renderer, and a shader change measured there would read exactly zero.
//
// `alive.html?hair=1` is the page that runs the material. This tool takes its plates.
//
// ## The two views, and why the camera moves rather than the figure
//
// `frameFigure` places the camera once at load and `trackFigure` never touches it again, so a
// camera moved after load stays moved across every subsequent `__SUGATA_STEP__`. The three-quarter
// is therefore the SAME lit figure seen from `--azimuth` degrees round — the rig does not re-aim,
// because `lights.aimAt` already ran. Turning the FIGURE instead would have changed which side of
// the head the key falls on, which is a different picture and not a different view of this one.
//
// ## Usage
//
//   node tools/critic/hair-plates.mjs --out captures/hair-r24-before
//   node tools/critic/hair-plates.mjs --out captures/hair-r24-lockalbedo --query '&hairlock=1'
//
// Writes `portrait.png`, `three-quarter.png` and `manifest.json` (URL, backend, subsystem census
// and each plate's sha256) into `--out`.

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO_ROOT = path.resolve( HERE, '..', '..' );

/**
 * The plate configuration, and every token in it is load-bearing.
 *
 * `bare` removes the overlays, `freeze` stops the motion stack, `seed=1` pins the draw, `capture`
 * hands the clock to `__SUGATA_STEP__`, `hair=1` is the whole subject — hair is OPT-IN on this page
 * — and `aa=msaa&grade=0` is the measurement plate this entire phase's numbers were taken on: no
 * temporal accumulation to converge and no RCAS sharpen sitting on top of the exact spatial
 * frequencies this round is measuring.
 */
const PLATE_QUERY = '?bare&freeze&seed=1&hair=1&capture&aa=msaa&grade=0';

const DEFAULTS = {
    width: 720,
    height: 900,
    azimuth: 35,
    steps: 8,
    out: 'captures/hair-plates',
    query: '',
    url: null
};

async function main() {

    const options = parseArguments( process.argv.slice( 2 ) );
    fs.mkdirSync( options.out, { recursive: true } );

    const playwright = await loadPlaywright();
    const server = options.url === null ? await startVite() : null;
    const origin = options.url ?? server.origin;
    const url = `${ origin }/alive.html${ PLATE_QUERY }${ options.query }`;

    const browser = await playwright.chromium.launch( {
        channel: 'chromium',                  // headless_shell has no GPU and therefore no WebGPU
        headless: true,
        args: [ '--enable-unsafe-webgpu', '--enable-features=Vulkan' ]
    } );

    const manifest = { url, width: options.width, height: options.height,
        azimuthDegrees: options.azimuth, steps: options.steps, plates: {} };

    try {

        const page = await browser.newPage( {
            viewport: { width: options.width, height: options.height },
            deviceScaleFactor: 1,
            colorScheme: 'dark'
        } );

        const problems = [];
        page.on( 'pageerror', ( error ) => problems.push( String( error ) ) );
        page.on( 'console', ( message ) => { if ( message.type() === 'error' ) problems.push( message.text() ); } );

        await page.goto( url, { waitUntil: 'load' } );
        await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function',
            null, { timeout: 120000 } );

        manifest.census = await page.evaluate( () => globalThis.sugata.subsystems() );
        manifest.hair = await page.evaluate( () => globalThis.sugata.session?.hairMaterial?.describe?.() ?? null );

        // 🚩 PROVENANCE, IN THE SIDECAR RATHER THAN IN A README A READER HAS TO TRUST.
        //
        // The whole reason this file exists is that `captures/hair-r23-*` came off `hair.html`,
        // where `renderer.shadowMap.enabled` is false, there is no `LightingRig` and the groom wears
        // a `MeshStandardNodeMaterial` — and a control was invalidated a round later because nothing
        // beside those plates said so. The header explains that; it did not RECORD it. These three
        // reads are the recording: the material CLASS on the groom, the shadow-map flag, and the
        // light count. A plate whose sidecar says `MeshStandardNodeMaterial` is not a plate of this
        // renderer, and now that is a fact about the file rather than a fact about the reader.
        manifest.provenance = await page.evaluate( () => {

            const stage = globalThis.sugata.stage;
            let hairMaterialClass = null;
            let lights = 0;

            stage.scene.traverse( ( object ) => {

                if ( object.material?.name === 'sugata.hair' ) hairMaterialClass = object.material.constructor.name;
                if ( object.isLight === true ) lights ++;

            } );

            return {
                hairMaterialClass,
                shadowMapEnabled: stage.renderer.shadowMap.enabled,
                lights,
                environment: stage.scene.environment === null ? null : 'set',
                toneMappingExposure: stage.renderer.toneMappingExposure
            };

        } );

        await step( page, options.steps );
        manifest.plates.portrait = await shoot( page, path.join( options.out, 'portrait.png' ) );

        // The orbit. `focus` is on the figure's own axis at the camera's own height — see
        // `frameFigure` — so the whole move is a rotation of (x, z) about the origin.
        const orbit = await page.evaluate( ( degrees ) => {

            const camera = globalThis.sugata.stage.camera;
            const radius = Math.hypot( camera.position.x, camera.position.z );
            const before = Math.atan2( camera.position.x, camera.position.z );
            const after = before + degrees * Math.PI / 180;

            camera.position.set( Math.sin( after ) * radius, camera.position.y, Math.cos( after ) * radius );
            camera.lookAt( 0, camera.position.y, 0 );

            return { radius, fromDegrees: before * 180 / Math.PI, toDegrees: after * 180 / Math.PI };

        }, options.azimuth );

        manifest.orbit = orbit;

        await step( page, options.steps );
        manifest.plates[ 'three-quarter' ] = await shoot( page, path.join( options.out, 'three-quarter.png' ) );

        manifest.pageProblems = problems;
        if ( problems.length > 0 ) console.log( `\npage errors:\n  ${ problems.join( '\n  ' ) }` );

    } finally {

        await browser.close();
        server?.stop();

    }

    fs.writeFileSync( path.join( options.out, 'manifest.json' ), `${ JSON.stringify( manifest, null, 2 ) }\n` );
    console.log( `\n  manifest  ${ path.relative( REPO_ROOT, path.join( options.out, 'manifest.json' ) ) }` );

}

async function step( page, count ) {

    for ( let index = 0; index < count; index ++ ) {

        const stepped = await page.evaluate( ( dt ) => globalThis.__SUGATA_STEP__( dt ), 1 / 60 );
        if ( stepped === false ) throw new Error( `__SUGATA_STEP__ refused at step ${ index } — the figure is not loaded.` );

    }

}

async function shoot( page, file ) {

    const png = await page.screenshot( { timeout: 120000 } );
    fs.writeFileSync( file, png );

    const digest = createHash( 'sha256' ).update( png ).digest( 'hex' );
    console.log( `  ${ path.basename( file ).padEnd( 20 ) } ${ digest.slice( 0, 16 ) }  ${ png.length } bytes` );

    return { file: path.relative( REPO_ROOT, file ), sha256: digest, bytes: png.length };

}

function parseArguments( argv ) {

    const options = { ...DEFAULTS };

    for ( let index = 0; index < argv.length; index ++ ) {

        const key = argv[ index ].replace( /^--/, '' );
        const value = argv[ index + 1 ];

        if ( Object.hasOwn( options, key ) === false ) throw new Error( `unknown option --${ key }` );

        options[ key ] = typeof DEFAULTS[ key ] === 'number' ? Number( value ) : value;
        index += 1;

    }

    return options;

}

function startVite() {

    return new Promise( ( resolve, reject ) => {

        const child = spawn( 'npx', [ 'vite', '--port', '0', '--strictPort=false' ], {
            cwd: REPO_ROOT,
            stdio: [ 'ignore', 'pipe', 'pipe' ]
        } );

        const stop = () => child.kill( 'SIGTERM' );
        const timer = setTimeout( () => { stop(); reject( new Error( 'vite did not report a URL within 60 s' ) ); }, 60000 );

        child.stdout.setEncoding( 'utf8' );
        child.stdout.on( 'data', ( chunk ) => {

            const match = /(http:\/\/localhost:\d+)/.exec( chunk );

            if ( match !== null ) {

                clearTimeout( timer );
                resolve( { origin: match[ 1 ], stop } );

            }

        } );

        child.on( 'error', reject );

    } );

}

async function loadPlaywright() {

    const candidates = [ 'playwright' ];
    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );

    if ( fs.existsSync( cache ) ) {

        for ( const entry of fs.readdirSync( cache ) ) {

            const candidate = path.join( cache, entry, 'node_modules', 'playwright' );
            if ( fs.existsSync( candidate ) ) candidates.push( candidate );

        }

    }

    const require = createRequire( import.meta.url );

    for ( const candidate of candidates ) {

        try {

            const resolved = require.resolve( candidate );
            const namespace = await import( pathToFileURL( resolved ).href );
            return namespace.chromium ? namespace : namespace.default;

        } catch {

            // next candidate; only the last failure matters

        }

    }

    throw new Error( 'playwright not resolvable. See tools/critic/capture.mjs --playwright.' );

}

await main();
