/**
 * Actual WebGPU ownership gate for same-renderer Avatar identity/groom rebuilds.
 * The corrected path must stay at one solver's resources, including when a caller keeps an old
 * solver handle. A routed copy of Avatar's previous retirement (drop without dispose) must grow
 * by exactly one solver per rebuild. The same sequence must produce identical vertex readbacks.
 * Also exercises unused solvers, repeated disposal, reads pending across disposal, and late loads.
 * Usage: node packages/core/src/motion/HairDynamics.disposal.selftest.mjs
 * Optional HAIR_DISPOSAL_CAPTURE=/absolute/path records the report.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startProbeServer, launchProbeBrowser } from '../render/MotionProbe.mjs';
import { BufferAttribute, BufferGeometry } from 'three';
import { readGlb, readPrimitive } from '../../../../tools/lut-bake/glb.mjs';
import { createHairDynamics } from './HairDynamics.js';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const capture = process.env.HAIR_DISPOSAL_CAPTURE;
if ( capture ) await fs.mkdir( capture, { recursive: true } );
const report = { checks: [], arms: {} };
const check = ( name, condition ) => {
    assert.equal( condition, true, name ); report.checks.push( name ); console.log( `PASS ${ name }` );
};
// These are ownership/microtask tests, not a CPU simulation of the physics kernel. The real
// asset supplies the solver layout; the controlled promises target both nested-await gaps.
{
    const primitive = readPrimitive( readGlb( path.join( root, 'assets/hair/bob02/g050.glb' ) ), 'hair_bob02' );
    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( primitive.positions ), 3 ) );
    geometry.setIndex( new BufferAttribute( new Uint32Array( primitive.indices ), 1 ) );
    const make = renderer => createHairDynamics( { renderer, geometry } );
    const unused = make( {} ); unused.dispose(); unused.dispose();
    check( 'pre-initialization disposal is idempotent without an attribute manager', unused.disposed );
    let submissions = 0;
    const uninitialized = make( { _initialized: false, compute() { submissions++; } } );
    assert.throws( () => uninitialized.update( 1 / 30 ), /initialize the renderer/ );
    uninitialized.dispose();
    check( 'update before renderer initialization cannot schedule deferred compute', submissions === 0 );
    let reads = 0;
    const between = make( { getArrayBufferAsync( attribute ) { reads++; return Promise.resolve( attribute.array.buffer.slice( 0 ) ); } } );
    const firstRead = between.readCentrelines(); queueMicrotask( () => between.dispose() );
    await assert.rejects( firstRead, /solver has been disposed/ );
    check( 'disposal between inner and outer awaits prevents the next GPU read', reads === 1 );
    const completions = [];
    const final = make( { getArrayBufferAsync( attribute ) {
        return new Promise( resolve => completions.push( () => resolve( attribute.array.buffer.slice( 0 ) ) ) );
    } } );
    const lastRead = final.readCentrelines(); completions[ 0 ]();
    for ( let i = 0; i < 5 && completions.length < 2; i++ ) await Promise.resolve();
    assert.equal( completions.length, 2, 'final-unpack control reached the second read' );
    completions[ 1 ](); queueMicrotask( () => final.dispose() );
    await assert.rejects( lastRead, /solver has been disposed/ );
    check( 'disposal after the final unpack prevents returning retired centreline data', final.disposed );
    geometry.dispose();
}
const server = await startProbeServer( { port: 5206 } );
try {
    for ( const arm of [ 'corrected', 'old-retirement' ] ) {
        const browser = await launchProbeBrowser();
        try {
            const page = await browser.newPage( { viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 } );
            const errors = []; let injections = 0;
            page.on( 'pageerror', error => errors.push( error.message ) );
            page.on( 'console', message => { if ( message.type() === 'error' ) errors.push( { text: message.text(), location: message.location() } ); } );
            page.on( 'response', response => { if ( response.status() >= 400 ) errors.push( `${ response.status() } ${ response.url() }` ); } );
            page.on( 'requestfailed', request => errors.push( `${ request.url() } ${ request.failure()?.errorText }` ) );
            if ( arm === 'old-retirement' ) await page.route( '**/core/src/Avatar.js*', async route => {
                const response = await route.fetch(), source = await response.text();
                const body = source.replace( 'this.hairDynamics?.dispose?.();', '/* Previous retirement dropped the solver without disposing it. */' );
                assert.notEqual( body, source, 'prior retirement injection matched' ); injections++;
                await route.fulfill( { response, body } );
            } );
            await page.goto( `${ server.baseUrl }/src/portrait.html?capture&hair=bob02`, { waitUntil: 'domcontentloaded' } );
            await page.waitForFunction( () => window.portrait, null, { timeout: 120_000 } );
            const result = await page.evaluate( async ( { arm, root } ) => {
                const { avatar } = portrait, renderer = avatar.stage.renderer;
                if ( avatar.stage.backendName !== 'webgpu' ) throw new Error( 'WebGPU required' );
                const snapshot = () => ( {
                    storage: renderer.info.memory.storageAttributes,
                    storageBytes: renderer.info.memory.storageAttributesSize,
                    compute: [ ...renderer._pipelines.caches.values() ].filter( p => p.isComputePipeline ).length,
                    programs: renderer._pipelines.programs.compute.size,
                    uniforms: renderer.info.memory.uniformBuffers,
                    // Count real backend buffers reached through Three's strong attribute map.
                    retainedBuffers: [ ...renderer.info.memoryMap ].filter( ( [ attribute, data ] ) =>
                        data?.type === 'storageAttributes' && renderer.backend.data.get( attribute )?.buffer ).length
                } );
                const digest = async typed => [ ...new Uint8Array( await crypto.subtle.digest( 'SHA-256', typed.buffer ) ) ]
                    .map( value => value.toString( 16 ).padStart( 2, '0' ) ).join( '' );
                const sequence = []; let retired;
                for ( let rebuild = 0; rebuild <= 3; rebuild++ ) {
                    if ( rebuild > 0 ) {
                        if ( rebuild === 1 ) retired = avatar.hairDynamics;
                        await avatar.setIdentity( { gender: 0.5 } );
                    }
                    await portrait.step( 1 / 30 );
                    const vertices = await avatar.hairDynamics.readVertices();
                    sequence.push( { ...snapshot(), time: avatar.clockSeconds,
                        vertexHash: await digest( vertices.positions ),
                        finite: vertices.positions.every( Number.isFinite ), steps: vertices.steps } );
                }
                const result = { sequence };
                if ( arm === 'corrected' ) {
                    result.retiredDisposed = retired.disposed;
                    const refused = async fn => {
                        try { await fn(); return false; } catch ( error ) { return /HairDynamics\..*: solver has been disposed/.test( error.message ); }
                    };
                    result.retiredRefusals = await Promise.all( [ () => retired.update( 1 / 30 ),
                        () => retired.computeNodesFor( 1 ), () => retired.readVertices(), () => retired.readCentrelines() ].map( refused ) );

                    // Construct and retire without ever submitting: no renderer data exists yet.
                    const { createHairDynamics } = await import( `/@fs${ root }/packages/core/src/motion/HairDynamics.js` );
                    const beforeUnused = snapshot();
                    const unused = createHairDynamics( { renderer, geometry: avatar.hairRoot.children[ 0 ].geometry } );
                    unused.dispose(); unused.dispose();
                    result.unusedDisposal = unused.disposed && JSON.stringify( beforeUnused ) === JSON.stringify( snapshot() );

                    // Let actual readback copies submit, but hold delivery across retirement. A centreline
                    // read must reject after its first await instead of reading the retired velocity buffer.
                    const active = avatar.hairDynamics, originalRead = renderer.getArrayBufferAsync;
                    let releaseRead, readCalls = 0;
                    const delivery = new Promise( resolve => { releaseRead = resolve; } );
                    renderer.getArrayBufferAsync = async function ( ...args ) {
                        readCalls++;
                        const data = await originalRead.apply( this, args );
                        await delivery; return data;
                    };
                    const centreRead = refused( () => active.readCentrelines() );
                    const vertexRead = refused( () => active.readVertices() );
                    avatar.disposeHair();
                    const once = snapshot(); active.dispose(); active.dispose();
                    result.idempotent = JSON.stringify( once ) === JSON.stringify( snapshot() );
                    result.afterHairRetirement = snapshot();
                    releaseRead();
                    result.pendingReadRefusals = await Promise.all( [ centreRead, vertexRead ] );
                    result.pendingReadCalls = readCalls;
                    renderer.getArrayBufferAsync = originalRead;

                    // Hold one unpublished solver after allocation and before attachHair's final token
                    // check. The newer identity must retain its own solver when the loser resumes.
                    const originalBuild = avatar.buildHairDynamics;
                    const holdNextBuild = () => {
                        let release, ready, pending;
                        const barrier = new Promise( resolve => { release = resolve; } );
                        const allocated = new Promise( resolve => { ready = resolve; } );
                        let hold = true;
                        avatar.buildHairDynamics = async function ( ...args ) {
                            const solver = await originalBuild.apply( this, args );
                            if ( hold ) { hold = false; pending = solver; ready(); await barrier; }
                            return solver;
                        };
                        return { allocated, release, get pending() { return pending; } };
                    };
                    const held = holdNextBuild();
                    const losing = avatar.setIdentity( { gender: 0.5 } );
                    await held.allocated;
                    await avatar.setIdentity( { gender: 0.5 } );
                    const winner = avatar.hairDynamics;
                    await portrait.step( 1 / 30 ); held.release(); await losing;
                    result.lateLoser = held.pending.dynamics.disposed && avatar.hairDynamics === winner && !winner.disposed;
                    result.afterLateLoser = snapshot();
                    avatar.buildHairDynamics = originalBuild;

                    const disposing = holdNextBuild();
                    const lastLoad = avatar.setIdentity( { gender: 0.5 } );
                    await disposing.allocated;
                    avatar.dispose(); disposing.release(); await lastLoad;
                    result.lateAfterAvatarDisposal = disposing.pending.dynamics.disposed && avatar.hairDynamics === null && avatar.hairRoot === null;
                    avatar.buildHairDynamics = originalBuild;
                } else {
                    result.retiredDisposed = retired.disposed;
                    const active = avatar.hairDynamics;
                    avatar.dispose();
                    // The old-retirement arm leaves this allocated solver alive until after its
                    // renderer is gone. Explicit cleanup must still be safe and idempotent.
                    active.dispose(); active.dispose();
                    result.disposedAfterRenderer = active.disposed;
                }
                result.afterAvatar = { memory: { ...renderer.info.memory },
                    tracked: renderer.info.memoryMap.size, pipelineCaches: renderer._pipelines.caches.size,
                    deviceLost: ( await renderer.backend.device.lost ).reason };
                return result;
            }, { arm, root } );
            report.arms[ arm ] = { ...result, errors, injections };
            check( `${ arm }: zero browser errors`, errors.length === 0 );
            check( `${ arm }: all live solver vertices remain finite`, result.sequence.every( sample => sample.finite ) );
            check( `${ arm }: full Avatar disposal clears tracked resources and destroys its device`,
                result.afterAvatar.tracked === 0 && result.afterAvatar.pipelineCaches === 0 &&
                result.afterAvatar.memory.total === 0 && result.afterAvatar.deviceLost === 'destroyed' );
            if ( arm === 'corrected' ) {
                const first = result.sequence[ 0 ];
                check( 'three same-renderer rebuilds retain exactly one solver resource set', result.sequence.every( sample =>
                    sample.storage === first.storage && sample.retainedBuffers === first.storage && sample.storageBytes === first.storageBytes &&
                    sample.compute === first.compute && sample.programs === first.programs ) );
                check( 'a retained reference to the retired solver cannot update, export kernels or read', result.retiredDisposed && result.retiredRefusals.every( Boolean ) );
                check( 'an unsubmitted solver disposes twice without allocating or deleting other resources', result.unusedDisposal );
                check( 'active disposal is idempotent and releases all solver buffers and pipelines', result.idempotent &&
                    result.afterHairRetirement.storage === 0 && result.afterHairRetirement.compute === 0 && result.afterHairRetirement.programs === 0 );
                check( 'pending reads reject ownership loss without a second centreline read', result.pendingReadRefusals.every( Boolean ) && result.pendingReadCalls === 2 );
                check( 'an unpublished losing solver is disposed without retiring the winner', result.lateLoser &&
                    result.afterLateLoser.storage === first.storage && result.afterLateLoser.compute === first.compute );
                check( 'an unpublished solver resolving after Avatar disposal cannot resurrect hair', result.lateAfterAvatarDisposal );
            } else {
                const first = result.sequence[ 0 ];
                check( 'exactly one old-retirement rejection injection', injections === 1 );
                check( 'allocated solver cleanup remains idempotent after renderer disposal', result.disposedAfterRenderer );
                check( 'old retirement retains an additional solver resource set after every rebuild', !result.retiredDisposed && result.sequence.every( ( sample, i ) =>
                    sample.storage === first.storage * ( i + 1 ) && sample.storageBytes === first.storageBytes * ( i + 1 ) &&
                    sample.compute === first.compute * ( i + 1 ) && sample.programs === first.programs * ( i + 1 ) ) );
            }
            console.log( JSON.stringify( { arm, sequence: result.sequence } ) );
        } finally { await browser.close(); }
    }
    check( 'cleanup preserves every vertex bit-for-bit through the matched rebuild sequence',
        report.arms.corrected.sequence.every( ( sample, i ) => sample.vertexHash === report.arms[ 'old-retirement' ].sequence[ i ].vertexHash &&
            sample.time === report.arms[ 'old-retirement' ].sequence[ i ].time ) );
    console.log( `PASS ${ report.checks.length } hair disposal regression checks` );
} finally {
    if ( capture ) await fs.writeFile( path.join( capture, 'report.json' ), JSON.stringify( report, null, 2 ) + '\n' );
    await server.close();
}
