/**
 * Skin area transmission: actual WebGPU form-factor and avatar regression.
 *
 * Compares the GPU helper to the independent coaxial rectangle integral, then changes a real
 * rear panel's size at fixed focus irradiance. On-minus-off transmission must stay near its
 * original value. A routed copy of the previous radiance-only area call must fail that invariant.
 * The unmodified diffuse/specular output at transmission strength zero must remain byte-identical.
 *
 * Usage: node packages/core/src/material/SkinTransmission.selftest.mjs
 * Optional SKIN_TRANSMISSION_CAPTURE=/absolute/path saves the compact report and rendered plates.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startProbeServer, launchProbeBrowser } from '../render/MotionProbe.mjs';
import { projectedSolidAngle } from '../render/LightingRig.js';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const captureDirectory = process.env.SKIN_TRANSMISSION_CAPTURE;
if ( captureDirectory ) await fs.mkdir( captureDirectory, { recursive: true } );
const report = { checks: [], helper: [], arms: {} };
function check( name, condition ) {
    assert.equal( condition, true, name );
    report.checks.push( name );
    console.log( `PASS ${ name }` );
}

// Unit view-space FRONT surface normals. The helper integrates their back hemisphere.
const makeCase = ( name, width, height, distance ) => ( {
    name, normal: [ 0, 0, 1 ], position: [ 0, 0, 0 ], lightPosition: [ 0, 0, -distance ],
    halfWidth: [ -width / 2, 0, 0 ], halfHeight: [ 0, height / 2, 0 ],
    expected: projectedSolidAngle( width, height, distance ) / Math.PI
} );
const base = makeCase( 'coaxial', 0.3, 0.3, 1 );
const helperCases = [
    ...[ 0.02, 0.1, 0.3, 1, 4 ].map( size => makeCase( `size-${ size }`, size, size, 1 ) ),
    makeCase( 'distance-2', 0.3, 0.3, 2 ),
    { ...base, name: 'emitter-away', halfWidth: [ 0.15, 0, 0 ], expected: 0 },
    { ...base, name: 'front-only', lightPosition: [ 0, 0, 1 ], halfWidth: [ 0.15, 0, 0 ], expected: 0 },
    { ...base, name: 'horizon', normal: [ 1, 0, 0 ], expected: null },
    { ...base, name: 'horizon-plus', normal: [ Math.sqrt( 1 - 1e-8 ), 0, 1e-4 ], expected: null },
    { ...base, name: 'horizon-minus', normal: [ Math.sqrt( 1 - 1e-8 ), 0, -1e-4 ], expected: null },
    { ...base, name: 'zero-normal', normal: [ 0, 0, 0 ], expected: 0 },
    { ...base, name: 'zero-width', halfWidth: [ 0, 0, 0 ], expected: 0 },
    { ...base, name: 'zero-height', halfHeight: [ 0, 0, 0 ], expected: 0 },
    { ...base, name: 'coplanar-center', position: [ 0, 0, -1 ], expected: 0 },
    { ...base, name: 'coplanar-edge', position: [ 0.15, 0, -1 ], expected: 0 },
    { ...base, name: 'coplanar-corner', position: [ 0.15, 0.15, -1 ], expected: 0 }
];
const rotate = vector => {
    const [ x, y, z ] = vector, a = 0.71;
    return [ x * Math.cos( a ) + z * Math.sin( a ), y, -x * Math.sin( a ) + z * Math.cos( a ) ];
};
helperCases.push( { ...base, name: 'rigid-rotation', ...Object.fromEntries(
    [ 'normal', 'position', 'lightPosition', 'halfWidth', 'halfHeight' ].map( key => [ key, rotate( base[ key ] ) ] ) ) } );

const server = await startProbeServer( { port: 5204 } );
try {
    for ( const arm of [ 'corrected', 'old-radiance-only' ] ) {
        const browser = await launchProbeBrowser();
        try {
            const page = await browser.newPage( { viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 } );
            const errors = [];
            let rejectionInjections = 0;
            page.on( 'pageerror', error => errors.push( error.message ) );
            page.on( 'console', message => { if ( message.type() === 'error' ) errors.push( message.text() ); } );
            page.on( 'response', response => { if ( response.status() >= 400 ) errors.push( `${ response.status() } ${ response.url() }` ); } );
            page.on( 'requestfailed', request => errors.push( `${ request.url() } ${ request.failure()?.errorText }` ) );
            if ( arm === 'old-radiance-only' ) {
                await page.route( '**/material/SkinMaterial.js*', async route => {
                    const response = await route.fetch(), source = await response.text();
                    const body = source.replace(
                        /if \( this\.transmittance !== null \) \{\s*const formFactor = rectangularBackTransmissionFormFactor\( \{[\s\S]*?\.mul\( DIFFUSE_CONTRIBUTION \)\.mul\( this\.nodes\.transmissionStrength \) \);\s*\}/,
                        'const transmitted = this.transmitted( input.lightColor, toLight );\n' +
                        '        if ( transmitted !== null ) input.reflectedLight.directDiffuse.addAssign( transmitted );'
                    );
                    assert.notEqual( body, source, 'old area-call injection matched' );
                    rejectionInjections++;
                    await route.fulfill( { response, body } );
                } );
            }
            await page.goto( `${ server.baseUrl }/src/portrait.html?capture&hair=bob02`, { waitUntil: 'domcontentloaded' } );
            await page.waitForFunction( () => window.portrait || !document.querySelector( '#error' ).hidden, null, { timeout: 90_000 } );
            assert.equal( await page.locator( '#error' ).textContent(), '' );

            if ( arm === 'corrected' ) {
                report.helper = await page.evaluate( async ( { root, cases } ) => {
                    const moduleUrl = `/@fs${ root }/packages/core/src/material/SkinMaterial.js`;
                    const source = await ( await fetch( moduleUrl ) ).text();
                    // Resolve the SAME transformed public modules SkinMaterial imports. Importing
                    // a private three/src node would create a second TSL graph in a bundled app.
                    const urlFor = name => {
                        const result = source.match( new RegExp( `from ["']([^"']*${ name }[^"']*)["']` ) );
                        if ( !result ) throw new Error( `Cannot locate transformed ${ name } import` );
                        return result[ 1 ];
                    };
                    const [ { rectangularBackTransmissionFormFactor }, tsl, gpu ] = await Promise.all( [
                        import( moduleUrl ), import( urlFor( 'three_tsl' ) ), import( urlFor( 'three_webgpu' ) )
                    ] );
                    const { uniform, vec4 } = tsl;
                    const { Vector3, RenderTarget, FloatType, NodeMaterial, QuadMesh, RendererUtils } = gpu;
                    const values = Object.fromEntries( [ 'normal', 'position', 'lightPosition', 'halfWidth', 'halfHeight' ]
                        .map( key => [ key, uniform( new Vector3() ) ] ) );
                    const material = new NodeMaterial();
                    material.fragmentNode = vec4( rectangularBackTransmissionFormFactor( values ), 0, 0, 1 );
                    material.toneMapped = false;
                    const quad = new QuadMesh( material );
                    const target = new RenderTarget( 1, 1, { type: FloatType, depthBuffer: false } );
                    const renderer = avatar.stage.renderer;
                    if ( avatar.stage.backendName !== 'webgpu' ) throw new Error( 'WebGPU required' );
                    const saved = RendererUtils.resetRendererState( renderer );
                    try {
                        const output = [];
                        for ( const item of cases ) {
                            for ( const key of Object.keys( values ) ) values[ key ].value.fromArray( item[ key ] );
                            renderer.setRenderTarget( target );
                            quad.render( renderer );
                            const pixels = await renderer.readRenderTargetPixelsAsync( target, 0, 0, 1, 1 );
                            if ( !( pixels instanceof Float32Array ) ) throw new Error( 'Expected RGBA32F helper output' );
                            output.push( { ...item, measured: pixels[ 0 ] } );
                        }
                        return output;
                    } finally {
                        RendererUtils.restoreRendererState( renderer, saved );
                        material.dispose(); target.dispose();
                    }
                }, { root, cases: helperCases } );
                const helper = name => report.helper.find( item => item.name === name ).measured;
                check( 'GPU factor is finite and bounded in every regular and degenerate case',
                    report.helper.every( item => Number.isFinite( item.measured ) && item.measured >= 0 && item.measured <= 1 ) );
                check( 'GPU integral matches the independent coaxial rectangle integral at five sizes and another distance',
                    report.helper.filter( item => item.expected > 0 ).every( item => Math.abs( item.measured / item.expected - 1 ) < 0.0001 ) );
                check( 'nonemitting/front-only panels and declared degenerate cases contribute exactly zero',
                    report.helper.filter( item => item.expected === 0 ).every( item => item.measured === 0 ) );
                check( 'a panel crossing the receiver horizon contributes even with center cosine zero', helper( 'horizon' ) > 0 );
                check( 'horizon response is continuous on both sides',
                    Math.max( Math.abs( helper( 'horizon-plus' ) - helper( 'horizon' ) ),
                        Math.abs( helper( 'horizon-minus' ) - helper( 'horizon' ) ) ) < 0.0001 );
                const baseFactor = helper( 'size-0.3' ), farFactor = helper( 'distance-2' );
                check( 'distance changes the factor by the independent solid-angle ratio',
                    Math.abs( farFactor / baseFactor - projectedSolidAngle( 0.3, 0.3, 2 ) / projectedSolidAngle( 0.3, 0.3, 1 ) ) < 0.0001 );
                check( 'rigidly rotating the scene preserves the back-hemisphere integral', Math.abs( helper( 'rigid-rotation' ) - baseFactor ) < 1e-6 );
            }

            const setup = await page.evaluate( async root => {
                const { avatar, controls } = portrait, stage = avatar.stage;
                if ( stage.backendName !== 'webgpu' ) throw new Error( 'WebGPU required' );
                stage.setTemporalAA( 'off' ); stage.setGrade( null ); stage.setResolutionScale( 1 );
                stage.camera.clearViewOffset(); controls.enableDamping = false; avatar.hairRoot.visible = false;
                for ( const unit of avatar.lights.units ) {
                    unit.area.intensity = 0;
                    if ( unit.shadowCaster ) unit.shadowCaster.intensity = 0;
                }
                if ( avatar.lights.ambientLight ) avatar.lights.ambientLight.intensity = 0;
                if ( avatar.lights.glintLight ) avatar.lights.glintLight.intensity = 0;
                const unit = avatar.lights.units.find( item => item.placement.name === 'rim' ), area = unit.area;
                const luminance = 0.2126 * area.color.r + 0.7152 * area.color.g + 0.0722 * area.color.b;
                area.color.setRGB( luminance, luminance, luminance );
                const { projectedSolidAngle } = await import( `/@fs${ root }/packages/core/src/render/LightingRig.js` );
                window.areaTransmissionProbe = {
                    area, width: area.width, height: area.height, distance: area.position.distanceTo( avatar.lights.focus ),
                    irradiance: unit.placement.irradiance * avatar.lights.exposure, projectedSolidAngle
                };
                const material = avatar.figure.body.material;
                return { backend: stage.backendName, neutralRGB: area.color.toArray(),
                    distances: material.skinUniforms.transmissionDistances.value.toArray(),
                    regionMap: material.hasRegionMap, cavityMap: material.hasCavityMap };
            }, root );
            const poses = [];
            for ( const scale of [ 1, 0.5 ] ) for ( const transmission of [ 0, 1 ] ) {
                const pose = await page.evaluate( async ( { scale, transmission } ) => {
                    const { avatar, controls } = portrait, stage = avatar.stage, p = areaTransmissionProbe;
                    p.area.width = p.width * scale; p.area.height = p.height * scale;
                    const solidAngle = p.projectedSolidAngle( p.area.width, p.area.height, p.distance );
                    p.area.intensity = p.irradiance / solidAngle;
                    avatar.figure.body.material.skinUniforms.transmissionStrength.value = transmission;
                    const t = controls.target, radius = stage.camera.position.distanceTo( t );
                    stage.camera.position.set( t.x + Math.SQRT1_2 * radius, t.y, t.z + Math.SQRT1_2 * radius );
                    controls.update();
                    for ( let frame = 0; frame < 4; frame++ ) await portrait.step( 0 );
                    const target = stage.gbuffer.pass.renderTarget;
                    const index = target.textures.findIndex( texture => texture.name === 'output' );
                    if ( index < 0 ) throw new Error( 'Scene output absent' );
                    const raw = await stage.renderer.readRenderTargetPixelsAsync( target, 0, 0, target.width, target.height, index );
                    if ( !( raw instanceof Uint16Array ) ) throw new Error( 'Expected RGBA16F output' );
                    const rowWords = Math.ceil( target.width * 8 / 256 ) * 128;
                    if ( raw.length !== rowWords * ( target.height - 1 ) + target.width * 4 ) throw new Error( 'Unexpected row stride' );
                    const half = word => {
                        const sign = word & 32768 ? -1 : 1, exponent = ( word >> 10 ) & 31, mantissa = word & 1023;
                        return exponent === 31 ? ( mantissa ? NaN : sign * Infinity ) : exponent === 0
                            ? sign * 2 ** -14 * mantissa / 1024 : sign * 2 ** ( exponent - 15 ) * ( 1 + mantissa / 1024 );
                    };
                    let nonFinite = 0;
                    const active = new Uint16Array( target.width * target.height * 4 );
                    for ( let y = 0; y < target.height; y++ ) {
                        active.set( raw.subarray( y * rowWords, y * rowWords + target.width * 4 ), y * target.width * 4 );
                    }
                    for ( const word of active ) if ( !Number.isFinite( half( word ) ) ) nonFinite++;
                    const rectangles = { eye: [ 108, 306, 65, 57 ], mouth: [ 56, 437, 65, 48 ], ear: [ 307, 311, 40, 92 ], thickCheek: [ 214, 377, 45, 50 ] };
                    const means = {};
                    for ( const [ name, [ x, y, width, height ] ] of Object.entries( rectangles ) ) {
                        const rgb = [ 0, 0, 0 ];
                        for ( let py = y; py < y + height; py++ ) for ( let px = x; px < x + width; px++ ) {
                            const offset = py * rowWords + px * 4;
                            for ( let k = 0; k < 3; k++ ) rgb[ k ] += half( raw[ offset + k ] );
                        }
                        means[ name ] = rgb.map( value => value / ( width * height ) );
                    }
                    let binary = ''; const bytes = new Uint8Array( active.buffer );
                    for ( let offset = 0; offset < bytes.length; offset += 32768 ) binary += String.fromCharCode( ...bytes.subarray( offset, offset + 32768 ) );
                    return { scale, transmission, solidAngle, radiance: p.area.intensity, irradiance: p.area.intensity * solidAngle,
                        nonFinite, means, pixels: btoa( binary ), time: avatar.clockSeconds,
                        head: avatar.figure.root.getObjectByName( 'head' ).matrixWorld.toArray(), camera: stage.camera.position.toArray() };
                }, { scale, transmission } );
                pose.outputSha256 = createHash( 'sha256' ).update( Buffer.from( pose.pixels, 'base64' ) ).digest( 'hex' );
                delete pose.pixels;
                poses.push( pose );
                if ( captureDirectory ) await page.locator( '#stage' ).screenshot( { path: path.join( captureDirectory, `${ arm }-${ scale }-${ transmission }.png` ) } );
            }
            const delta = ( scale, region ) => poses.find( pose => pose.scale === scale && pose.transmission === 1 ).means[ region ]
                .map( ( value, channel ) => value - poses.find( pose => pose.scale === scale && pose.transmission === 0 ).means[ region ][ channel ] );
            const ratios = Object.fromEntries( [ 'eye', 'mouth', 'ear' ].map( region => [ region,
                delta( 0.5, region ).map( ( value, channel ) => value / delta( 1, region )[ channel ] ) ] ) );
            const radianceRatio = poses.find( pose => pose.scale === 0.5 ).radiance / poses[ 0 ].radiance;
            check( `${ arm }: all scene-buffer components are finite`, poses.every( pose => pose.nonFinite === 0 ) );
            check( `${ arm }: pose, camera and animation clock remain fixed`, poses.every( pose => pose.time === 0 &&
                JSON.stringify( pose.head ) === JSON.stringify( poses[ 0 ].head ) &&
                JSON.stringify( pose.camera ) === JSON.stringify( poses[ 0 ].camera ) ) );
            check( `${ arm }: supplied irradiance remains constant`, poses.every( pose => Math.abs( pose.irradiance - poses[ 0 ].irradiance ) < 1e-10 ) );
            check( `${ arm }: zero browser errors`, errors.length === 0 );
            if ( arm === 'corrected' ) {
                check( 'actual eye, mouth and ear retain positive transmission', [ 'eye', 'mouth', 'ear' ].every( region => delta( 1, region )[ 0 ] > 0.001 ) );
                check( 'thick cheek transmits less than the thin ear', delta( 1, 'thickCheek' )[ 0 ] < delta( 1, 'ear' )[ 0 ] / 5 );
                check( 'actual thin-tissue transmission is invariant to panel size within finite-panel variation',
                    Object.values( ratios ).every( rgb => rgb.every( ratio => Math.abs( ratio - 1 ) < 0.03 ) ) );
            } else {
                check( 'exactly one prior-code rejection injection', rejectionInjections === 1 );
                check( 'prior code fails invariance with the predicted inverse-solid-angle growth', Object.values( ratios ).every( rgb =>
                    rgb.every( ratio => ratio > 3 && Math.abs( ratio / radianceRatio - 1 ) < 0.002 ) ) );
            }
            report.arms[ arm ] = { setup, poses, ratios, radianceRatio, errors };
            console.log( JSON.stringify( { arm, ratios, radianceRatio } ) );
        } finally {
            await browser.close();
        }
    }
    for ( const scale of [ 1, 0.5 ] ) {
        const original = report.arms[ 'old-radiance-only' ].poses.find( pose => pose.scale === scale && pose.transmission === 0 );
        const corrected = report.arms.corrected.poses.find( pose => pose.scale === scale && pose.transmission === 0 );
        check( `transmission-off scene output at scale ${ scale } is byte-identical to the original`, original.outputSha256 === corrected.outputSha256 );
    }
    console.log( `PASS ${ report.checks.length } skin transmission regression checks` );
} finally {
    if ( captureDirectory ) await fs.writeFile( path.join( captureDirectory, 'report.json' ), `${ JSON.stringify( report, null, 2 ) }\n` );
    await server.close();
}
