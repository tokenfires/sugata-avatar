/** Real Avatar/WebGPU clothing smoke + ownership gate. --production builds and serves emitted assets.
 * node packages/core/src/wardrobe/AvatarWardrobe.browser.selftest.mjs [--production] [--output /tmp/path]
 * Screenshots are review artifacts; this test does not certify aesthetic quality or all motion fit.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../../tools/critic/png.mjs';
import { startProbeServer, launchProbeBrowser } from '../render/MotionProbe.mjs';
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const production = process.argv.includes( '--production' );
const outputIndex = process.argv.indexOf( '--output' );
const output = outputIndex >= 0 ? path.resolve( process.argv[ outputIndex + 1 ] )
    : fs.mkdtempSync( path.join( os.tmpdir(), `sugata-wardrobe-${ production ? 'production' : 'dev' }-` ) );
fs.mkdirSync( output, { recursive: true } );
const sourceFiles = [ 'packages/core/src/Avatar.js', 'packages/core/src/wardrobe/AvatarWardrobe.js', 'packages/core/src/wardrobe/Wardrobe.js', 'packages/core/src/wardrobe/GarmentManifest.js' ];
const hashes = () => Object.fromEntries( sourceFiles.map( file => [ file, createHash( 'sha256' ).update( fs.readFileSync( path.join( root, file ) ) ).digest( 'hex' ) ] ) );
const sourceHashes = hashes();
const html = '<html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#08080a"><canvas width="900" height="1100" id="stage"></canvas><script type="module" src="/entry.js"></script></body></html>';
let server;
if ( production ) {
    const scratch = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-wardrobe-build-' ) );
    fs.writeFileSync( path.join( scratch, 'index.html' ), html );
    fs.writeFileSync( path.join( scratch, 'entry.js' ), `import { Avatar } from ${ JSON.stringify( path.join( root, 'packages/core/src/Avatar.js' ) ) }; window.Avatar = Avatar;` );
    const { build } = await import( 'vite' );
    const dist = path.join( scratch, 'dist' );
    await build( { configFile: false, root: scratch, logLevel: 'error', build: { outDir: dist, target: 'esnext' } } );
    const app = http.createServer( ( request, response ) => {
        const pathname = decodeURIComponent( new URL( request.url, 'http://localhost' ).pathname );
        const file = path.join( dist, pathname === '/' ? 'index.html' : pathname );
        if ( !file.startsWith( dist + path.sep ) || !fs.existsSync( file ) ) { response.writeHead( 404 ); response.end(); return; }
        response.setHeader( 'Content-Type', file.endsWith( '.js' ) ? 'text/javascript' : file.endsWith( '.json' ) ? 'application/json' : file.endsWith( '.html' ) ? 'text/html' : 'application/octet-stream' );
        fs.createReadStream( file ).pipe( response );
    } );
    await new Promise( resolve => app.listen( 0, '127.0.0.1', resolve ) );
    server = { baseUrl: `http://127.0.0.1:${ app.address().port }`, close: () => new Promise( resolve => app.close( resolve ) ) };
} else server = await startProbeServer( { port: 5207 } );
const browser = await launchProbeBrowser();
const checks = [], errors = [], requests = [], views = [];
const check = ( label, condition ) => { assert.ok( condition, label ); checks.push( label ); console.log( `PASS ${ label }` ); };
try {
    const page = await browser.newPage( { viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 } );
    page.on( 'pageerror', error => errors.push( error.message ) );
    page.on( 'console', message => { if ( message.type() === 'error' ) errors.push( message.text() ); } );
    page.on( 'response', response => { if ( response.status() >= 400 ) errors.push( `${ response.status() } ${ response.url() }` ); if ( /\.glb(?:\?|$)|manifest.*\.json/.test( response.url() ) ) requests.push( { url: response.url(), status: response.status() } ); } );
    page.on( 'requestfailed', request => errors.push( `${ request.url() } ${ request.failure()?.errorText }` ) );
    if ( !production ) {
        await page.route( '**/__wardrobe_probe.html', route => route.fulfill( { contentType: 'text/html', body: html.replace( '<script type="module" src="/entry.js"></script>', '' ) } ) );
        await page.goto( server.baseUrl + '/__wardrobe_probe.html' );
        await page.evaluate( async url => { window.Avatar = ( await import( url ) ).Avatar; }, `/@fs${ root }/packages/core/src/Avatar.js` );
    } else { await page.goto( server.baseUrl ); await page.waitForFunction( () => window.Avatar ); }
    const initial = await page.evaluate( async () => {
        window.avatar = await Avatar.create( { canvas: document.querySelector( 'canvas' ), quality: 'balanced', frame: 'body', autoStart: false,
            wardrobe: { outfit: [ 'female_casualsuit01', 'shoes01' ] } } );
        await avatar.step( 0 );
        return avatar.report();
    } );
    check( 'real WebGPU renderer with complete casual outfit and foundation', initial.quality.backend === 'webgpu' && initial.wardrobe.attached && initial.wardrobe.state.worn.length === 4 );
    const capture = async ( outfit, angle ) => {
        const result = await page.evaluate( async angle => {
            const a = avatar, focus = a.focus, radius = a.stage.camera.position.distanceTo( focus ), radians = angle * Math.PI / 180;
            a.stage.camera.position.set( focus.x + radius * Math.sin( radians ), focus.y, focus.z + radius * Math.cos( radians ) );
            a.stage.camera.lookAt( focus ); for ( let i = 0; i < 16; i++ ) await a.step( 0 );
            return { time: a.clockSeconds, camera: a.stage.camera.position.toArray(), wardrobe: a.report().wardrobe };
        }, angle );
        const name = `${ outfit }-${ angle }.png`; await page.locator( 'canvas' ).screenshot( { path: path.join( output, name ) } );
        const pixels = decodePng( fs.readFileSync( path.join( output, name ) ) ).pixels;
        let lit = 0; for ( let i = 0; i < pixels.length; i += 4 ) if ( Math.max( pixels[ i ], pixels[ i + 1 ], pixels[ i + 2 ] ) > .1 ) lit++;
        assert.ok( lit / ( pixels.length / 4 ) > .05, 'captured canvas contains a visible figure/ground' );
        views.push( { name, angle, litFraction: lit / ( pixels.length / 4 ), ...result } );
    };
    for ( const angle of [ 0, 90, 180 ] ) await capture( 'casual', angle );
    const refusal = await page.evaluate( async () => {
        const figure = avatar.figure, wardrobe = avatar.wardrobe, identity = JSON.stringify( avatar.identity.toJSON() ); let error;
        try { await avatar.setIdentity( { gender: 0 } ); } catch ( failure ) { error = failure.message; }
        let conflict; try { await avatar.dress( [ 'female_casualsuit01', 'female_elegantsuit01' ] ); } catch ( failure ) { conflict = failure.message; }
        return { error, conflict, unchanged: figure === avatar.figure && wardrobe === avatar.wardrobe && identity === JSON.stringify( avatar.identity.toJSON() ), state: wardrobe.stats() };
    } );
    check( 'unsupported bake and conflicting outfit leave the same dressed Avatar visible', /g050/.test( refusal.error ) && /cannot be worn/.test( refusal.conflict ) && refusal.unchanged && refusal.state.bodyVisible );
    const elegant = await page.evaluate( async () => { await avatar.dress( [ 'female_elegantsuit01', 'shoes01' ] ); return avatar.report().wardrobe; } );
    check( 'public dress switches to elegant plus shoes atomically', elegant.attached && elegant.state.worn.includes( 'female_elegantsuit01' ) && !elegant.state.worn.includes( 'female_casualsuit01' ) && elegant.state.worn.length === 4 );
    for ( const angle of [ 0, 90, 180 ] ) await capture( 'elegant', angle );
    const ownership = await page.evaluate( async () => {
        const old = avatar.wardrobe, renderer = avatar.stage.renderer;
        const textures = [ ...old.fragments.values() ].flatMap( fragment => [ ...fragment.resources.textures ] );
        const residentBefore = textures.filter( texture => renderer.backend.data.has( texture ) ).length;
        const indices = [ ...old.fragments.values() ].map( fragment => fragment.mesh.geometry.index );
        await avatar.setIdentity( { gender: .5 } ); await avatar.step( 1 / 60 );
        return { rendererUnchanged: renderer === avatar.stage.renderer, retired: old.stats(), residentBefore,
            residentAfter: textures.filter( texture => renderer.backend.data.has( texture ) ).length,
            retiredIndexBuffers: indices.filter( attribute => renderer.backend.data.has( attribute ) ).length,
            current: avatar.report().wardrobe };
    } );
    check( 'same-renderer rebuild retires cached/worn garments and their uploaded textures/index buffers', ownership.rendererUnchanged && ownership.retired.disposed && ownership.retired.residentFragments === 0 && ownership.residentBefore > 0 && ownership.residentAfter === 0 && ownership.retiredIndexBuffers === 0 && ownership.current.attached );
    const pending = await page.evaluate( async () => {
        const current = avatar.wardrobe, Class = current.constructor, original = Class.prototype.dress;
        let release; const gate = new Promise( resolve => release = resolve ); let late, disposedEvents = 0;
        Class.prototype.dress = function ( ids ) {
            const loader = this.loadFragment;
            this.loadFragment = async url => {
                const loaded = await loader( url ); late = loaded;
                loaded.scene.traverse( object => { if ( object.isMesh ) object.geometry.addEventListener( 'dispose', () => disposedEvents++ ); } );
                await gate; return loaded;
            };
            return original.call( this, ids );
        };
        const swap = avatar.setIdentity( { gender: .5 } );
        try {
            const deadline = performance.now() + 30000;
            while ( !late && performance.now() < deadline ) await new Promise( resolve => setTimeout( resolve, 5 ) );
            if ( !late ) throw new Error( 'pending candidate did not reach the controlled fragment load' );
            const candidate = [ ...avatar.pendingWardrobes ][ 0 ];
            avatar.dispose(); avatar.dispose(); release(); await swap;
            return { disposedEvents, candidate: candidate.stats(), report: avatar.report().wardrobe, leaked: avatar.leakedHandles() };
        } finally { Class.prototype.dress = original; release(); }
    } );
    check( 'Avatar disposal retires active and pending wardrobe, including late GLB arrival', pending.disposedEvents > 0 && pending.candidate.disposed && pending.candidate.pendingFragments === 0 && !pending.candidate.bodyVisible && pending.report.pendingCandidates === 0 && !pending.report.attached && pending.leaked.length === 0 );
    if ( production ) check( 'production body, manifest and worn fragments load from emitted asset URLs', [ initial.wardrobe.bodyUrl, initial.wardrobe.manifestUrl, ...Object.values( initial.wardrobe.fragmentUrls ) ].every( url => url.includes( '/assets/' ) && !url.includes( '/@fs/' ) && requests.some( request => request.url === url && request.status === 200 ) ) );
    check( 'no browser, console, network, or WebGPU validation errors', errors.length === 0 );
    check( 'all recorded source hashes stayed fixed throughout the run', JSON.stringify( sourceHashes ) === JSON.stringify( hashes() ) );
    fs.writeFileSync( path.join( output, 'report.json' ), JSON.stringify( { production, checks, initial, refusal, elegant, ownership, pending, views, errors, requests, sourceHashes,
        limitations: 'Appearance remains a human-review task. Existing stand-in fit, foundation intersections, material quality and broad motion coverage are not certified. No throughput or GPU timing claims; private r185 backend.data is read only by this resource regression.' }, null, 2 ) );
    console.log( `${ checks.length } checks passed. Evidence: ${ output }` );
} finally { await browser.close(); await server.close(); }
