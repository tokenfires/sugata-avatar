/**
 * Contact-factory submission and ownership contract. Real TSL nodes and the existing bob02 groom,
 * with a synchronous renderer spy: this measures CPU orchestration, not contact geometry or GPU
 * performance. Existing HairDynamics/disposal WebGPU suites gate the unchanged default kernels.
 * Usage: node packages/core/src/motion/HairDynamics.contact.selftest.mjs [--gpu]
 * Optional --gpu adds real observed/mutated substep roots, final rebuild and resource checks.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { ComputeNode } from 'three/webgpu';
import { Fn } from 'three/tsl';
import { readGlb, readPrimitive } from '../../../../tools/lut-bake/glb.mjs';
import { createHairDynamics } from './HairDynamics.js';

const primitive = readPrimitive( readGlb( fileURLToPath( new URL( '../../../../assets/hair/bob02/g050.glb', import.meta.url ) ) ), 'hair_bob02' );
const geometry = new BufferGeometry();
geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( primitive.positions ), 3 ) );
geometry.setIndex( new BufferAttribute( new Uint32Array( primitive.indices ), 1 ) );
const originalPositions = geometry.attributes.position.array.slice();
let checks = 0;
function check( name, fn ) { fn(); checks++; console.log( `PASS ${ name }` ); }
function spy( extra = {} ) {
    const calls = [], deleted = [], events = [];
    return { calls, deleted, events, _initialized: true,
        compute( nodes ) { calls.push( nodes ); events.push( 'compute' ); },
        _attributes: { delete( attribute ) { deleted.push( attribute ); events.push( 'delete' ); } }, ...extra };
}
const make = ( renderer = spy(), options = {} ) => createHairDynamics( { renderer, geometry, ...options } );
const names = nodes => nodes.map( node => node.name );
function factory( state = {} ) {
    return context => {
        state.context = context; state.prepared = []; state.selected = []; state.disposals = 0;
        state.nodes = Array.from( { length: context.maxSubstepsPerFrame }, ( _, i ) =>
            [ Fn( () => {} )().compute( 1 ).setName( `contact ${ i }` ),
                Fn( () => {} )().compute( 1 ).setName( `velocity ${ i }` ) ] );
        return state.owner = {
            prepare( frame ) { state.prepared.push( { ...frame } ); this.reset = frame.reset; },
            nodesFor( i ) { state.selected.push( i ); return state.nodes[ i ].slice( 0, this.reset ? 1 : 2 ); },
            dispose() { state.disposals++; context.renderer.events?.push( 'contact disposal' );
                for ( const nodes of state.nodes ) for ( const node of nodes ) node.dispose(); },
            report() { return { prepared: state.prepared.length }; }
        };
    };
}
// Count actual solver ComputeNode disposal independently of the contact callback and renderer spy.
const nodeDisposals = [];
const originalDispose = ComputeNode.prototype.dispose;
ComputeNode.prototype.dispose = function () { nodeDisposals.push( this.name ); return originalDispose.call( this ); };
try {
    check( 'invalid factory and per-kernel contact reject before reading geometry or allocating', () => {
        let reads = 0;
        const badGeometry = new Proxy( {}, { get() { reads++; throw Error( 'geometry accessed' ); } } );
        for ( const contactFactory of [ null, false, {}, 1, async () => ({}) ] ) {
            assert.throws( () => createHairDynamics( { renderer: {}, geometry: badGeometry, contactFactory } ), /synchronous function/ );
        }
        assert.throws( () => createHairDynamics( { renderer: {}, geometry: badGeometry,
            contactFactory() {}, submit: 'perkernel' } ), /one-pass submission/ );
        assert.equal( reads, 0 );
    } );
    check( 'default raw node order, one-pass update, diagnostic path and report remain available', () => {
        const renderer = spy(), d = make( renderer );
        assert.deepEqual( names( d.computeNodesFor( 2 ) ), [ 'hair DFTL step 0', 'hair DFTL step 1', 'hair card rebuild' ] );
        assert.equal( d.contactReport(), null ); d.update( 1 / 60 );
        assert.equal( renderer.calls.length, 1 ); assert.deepEqual( renderer.calls[ 0 ], d.computeNodesFor( 2 ) ); d.dispose();
        const diagnostic = spy(), p = make( diagnostic, { submit: 'perkernel' } ); p.update( 1 / 60 );
        assert.equal( diagnostic.calls.length, 3 ); assert.equal( p.computeCallsLastFrame, 3 ); p.dispose();
    } );
    check( 'factory receives exactly frozen private borrowed context and timing', () => {
        const state = {}, renderer = spy(), d = make( renderer, { contactFactory: factory( state ) } );
        assert.deepEqual( Object.keys( state.context ).sort(), [ 'renderer', 'groom', 'positionBuffer', 'velocityBuffer',
            'restLengthBuffer', 'substepSeconds', 'maxSubstepsPerFrame' ].sort() );
        assert.equal( Object.isFrozen( state.context ), true ); assert.equal( state.context.renderer, renderer );
        assert.equal( state.context.groom, d.groom ); assert.equal( state.context.substepSeconds, d.substepSeconds );
        assert.equal( state.context.maxSubstepsPerFrame, d.maxSubstepsPerFrame );
        for ( const key of [ 'positionBuffer', 'velocityBuffer', 'restLengthBuffer' ] ) assert.equal( key in d, false );
        assert.throws( () => d.computeNodesFor( 2 ), /use update/ );
        assert.deepEqual( d.contactReport(), { prepared: 0 } ); d.dispose();
    } );
    check( 'zero-delta reset, normal frames and no-step frames preserve preparation/reset semantics', () => {
        const state = {}, renderer = spy(), d = make( renderer, { contactFactory: factory( state ) } );
        assert.equal( d.update( 0 ), 1 );
        assert.deepEqual( state.prepared, [ { substeps: 1, reset: true } ] );
        assert.deepEqual( names( renderer.calls[ 0 ] ), [ 'hair DFTL step 0', 'contact 0', 'hair card rebuild' ] );
        assert.equal( d.update( d.substepSeconds / 3 ), 0 );
        assert.equal( d.update( 0 ), 0 ); assert.equal( state.prepared.length, 1 ); assert.equal( renderer.calls.length, 1 );
        assert.equal( d.update( 1 / 60 ), 2 );
        assert.deepEqual( state.prepared[ 1 ], { substeps: 2, reset: false } );
        assert.deepEqual( names( renderer.calls[ 1 ] ), [ 'hair DFTL step 0', 'contact 0', 'velocity 0',
            'hair DFTL step 1', 'contact 1', 'velocity 1', 'hair card rebuild' ] );
        assert.equal( d.computeCallsLastFrame, 1 );
        assert.equal( d.update( 10 ), 4 );
        assert.deepEqual( state.selected.slice( -4 ), [ 0, 1, 2, 3 ] );
        assert.equal( renderer.calls[ 2 ].filter( node => node.name === 'hair card rebuild' ).length, 1 );
        d.reset(); assert.equal( d.update( 0 ), 1 ); assert.deepEqual( state.prepared.at( -1 ), { substeps: 1, reset: true } );
        assert.equal( d.stepsTaken, 1 ); d.dispose();
    } );
    check( 'prepare precedes head interpolation and only one final rebuild follows every substep', () => {
        const state = {}, renderer = spy(), f = factory( state ); let preparations = 0, observed = 0;
        const d = make( renderer, { contactFactory: context => {
            const owner = f( context ); const prepare = owner.prepare;
            owner.prepare = function ( frame ) { preparations++; return prepare.call( this, frame ); }; return owner;
        } } );
        d.update( 0 ); d.setHeadMatrix( new Matrix4().makeTranslation( .1, 0, 0 ), new Matrix4(), new Matrix4() );
        const decompose = Matrix4.prototype.decompose;
        Matrix4.prototype.decompose = function ( ...args ) { observed++; assert.equal( preparations, 2 ); return decompose.apply( this, args ); };
        try { d.update( 1 / 60 ); } finally { Matrix4.prototype.decompose = decompose; }
        assert.ok( observed >= 2 ); assert.equal( renderer.calls.length, 2 ); d.dispose();
    } );
    check( 'throwing factory cleans all five solver kernels and eight attributes', () => {
        const renderer = spy(), start = nodeDisposals.length, failure = Error( 'factory failed' );
        assert.throws( () => make( renderer, { contactFactory() { throw failure; } } ), error => error === failure );
        assert.equal( renderer.deleted.length, 8 ); assert.equal( new Set( renderer.deleted ).size, 8 );
        assert.equal( nodeDisposals.length - start, 5 );
    } );
    check( 'partial factory resources remain the factory responsibility until ownership is returned', () => {
        const renderer = spy(), start = nodeDisposals.length;
        assert.throws( () => make( renderer, { contactFactory() {
            const earlier = [ Fn( () => {} )().compute( 1 ).setName( 'partial 0' ), Fn( () => {} )().compute( 1 ).setName( 'partial 1' ) ];
            try { throw Error( 'stage 2 failed' ); } finally { earlier.forEach( node => node.dispose() ); }
        } } ), /stage 2 failed/ );
        assert.equal( nodeDisposals.length - start, 7 ); assert.equal( renderer.deleted.length, 8 );
    } );
    check( 'malformed returned owner is disposed before all borrowed storage is released', () => {
        for ( const missing of [ 'prepare', 'nodesFor', 'report' ] ) {
            const renderer = spy(), state = {}, f = factory( state );
            assert.throws( () => make( renderer, { contactFactory: context => {
                const owner = f( context ); delete owner[ missing ]; return owner;
            } } ), new RegExp( missing ) );
            assert.equal( state.disposals, 1 ); assert.equal( renderer.events[ 0 ], 'contact disposal' );
            assert.equal( renderer.deleted.length, 8 );
        }
        for ( const owner of [ undefined, null, 1, {} ] ) {
            const renderer = spy(); assert.throws( () => make( renderer, { contactFactory: () => owner } ), /contact/ );
            assert.equal( renderer.deleted.length, 8 );
        }
    } );
    check( 'promise-returning factory and async hooks reject the synchronous contract', () => {
        const renderer = spy();
        assert.throws( () => make( renderer, { contactFactory: () => Promise.resolve( {} ) } ), /must be synchronous/ );
        assert.equal( renderer.deleted.length, 8 );
        const state = {}, f = factory( state );
        assert.throws( () => make( spy(), { contactFactory: context => {
            const owner = f( context ); owner.prepare = async () => {}; return owner;
        } } ), /prepare.*synchronous/ ); assert.equal( state.disposals, 1 );
    } );
    check( 'dispose releases contact once before borrowed buffers and preserves caller geometry', () => {
        const state = {}, renderer = spy(), d = make( renderer, { contactFactory: factory( state ) } );
        let geometryDisposals = 0; geometry.addEventListener( 'dispose', () => geometryDisposals++ );
        d.update( 0 ); renderer.events.length = 0; d.dispose(); d.dispose();
        assert.equal( renderer.events[ 0 ], 'contact disposal' ); assert.equal( state.disposals, 1 );
        assert.equal( renderer.deleted.length, 8 );
        for ( const key of [ 'positionBuffer', 'velocityBuffer', 'restLengthBuffer' ] )
            assert.equal( renderer.deleted.filter( attr => attr === state.context[ key ].value ).length, 1 );
        assert.equal( geometryDisposals, 0 ); assert.deepEqual( geometry.attributes.position.array, originalPositions );
        for ( const operation of [ () => d.update( 0 ), () => d.reset(), () => d.computeNodesFor( 1 ), () => d.contactReport() ] )
            assert.throws( operation, /solver has been disposed/ );
    } );
    check( 'every cleanup is attempted even when contact, a solver kernel and a buffer throw', () => {
        const renderer = spy(), state = {}, f = factory( state ), start = nodeDisposals.length;
        const d = make( renderer, { contactFactory: context => {
            const owner = f( context ); const dispose = owner.dispose;
            owner.dispose = function () { dispose.call( this ); throw Error( 'contact release failed' ); }; return owner;
        } } );
        const saved = ComputeNode.prototype.dispose;
        ComputeNode.prototype.dispose = function () {
            const result = saved.call( this ); if ( this.name === 'hair DFTL step 0' ) throw Error( 'kernel release failed' ); return result;
        };
        const savedDelete = renderer._attributes.delete;
        renderer._attributes.delete = attribute => { savedDelete( attribute ); if ( renderer.deleted.length === 1 ) throw Error( 'buffer release failed' ); };
        try { assert.throws( () => d.dispose(), error => error instanceof AggregateError && error.errors.length === 3 ); }
        finally { ComputeNode.prototype.dispose = saved; }
        assert.equal( nodeDisposals.length - start, 13 ); assert.equal( renderer.deleted.length, 8 );
        d.dispose(); assert.equal( state.disposals, 1 ); assert.equal( renderer.deleted.length, 8 );
    } );
    check( 'constructor reports original validation failure together with cleanup failure', () => {
        const renderer = spy();
        assert.throws( () => make( renderer, { contactFactory: () => ( { dispose() { throw Error( 'cleanup failed' ); } } ) } ),
            error => error instanceof AggregateError && /prepare/.test( error.cause.message ) && /cleanup failed/.test( error.errors[ 1 ].message ) );
        assert.equal( renderer.deleted.length, 8 );
        const nonErrorRenderer = spy();
        assert.throws( () => make( nonErrorRenderer, { contactFactory: () => ( {
            get prepare() { throw null; }, dispose() { throw Error( 'cleanup failed' ); }
        } ) } ), error => error instanceof AggregateError && error.cause === null && error.errors[ 0 ] === null );
        assert.equal( nonErrorRenderer.deleted.length, 8 );
    } );
    check( 'prepare failure and malformed nodes retire history without submitting a batch', () => {
        for ( const failure of [ 'prepare', 'nodes', 'sparse', 'promise' ] ) {
            const state = {}, renderer = spy(), f = factory( state );
            const d = make( renderer, { contactFactory: context => {
                const owner = f( context );
                if ( failure === 'prepare' ) owner.prepare = () => { throw Error( 'prepare failed' ); };
                else owner.nodesFor = () => failure === 'nodes' ? [ {} ] : failure === 'sparse' ? new Array( 1 ) : Promise.resolve( [] );
                return owner;
            } } );
            assert.throws( () => d.update( 0 ), /prepare failed|ComputeNodes|synchronous/ );
            assert.equal( renderer.calls.length, 0 ); assert.equal( state.disposals, 1 ); assert.equal( d.disposed, true );
            assert.equal( renderer.deleted.length, 8 ); assert.throws( () => d.update( 0 ), /disposed/ );
        }
    } );
    check( 'retirement during prepare or node selection cannot submit borrowed buffers', () => {
        for ( const hook of [ 'prepare', 'nodesFor' ] ) {
            const renderer = spy(), state = {}, f = factory( state ); let d;
            d = make( renderer, { contactFactory: context => {
                const owner = f( context ), original = owner[ hook ];
                owner[ hook ] = function ( ...args ) { const value = original.apply( this, args ); d.dispose(); return value; }; return owner;
            } } );
            assert.throws( () => d.update( 0 ), /disposed/ ); assert.equal( renderer.calls.length, 0 );
            assert.equal( state.disposals, 1 ); assert.equal( renderer.deleted.length, 8 );
        }
    } );
    check( 'retirement from a returned node getter cannot cross the final submission boundary', () => {
        const renderer = spy(), node = Fn( () => {} )().compute( 1 ); let d, disposals = 0;
        Object.defineProperty( node, 'isComputeNode', { get() { d.dispose(); return true; } } );
        d = make( renderer, { contactFactory: () => ( {
            prepare() {}, nodesFor() { return [ node ]; }, report() { return {}; },
            dispose() { disposals++; node.dispose(); }
        } ) } );
        assert.throws( () => d.update( 0 ), /disposed/ );
        assert.equal( renderer.calls.length, 0 ); assert.equal( renderer.deleted.length, 8 );
        assert.equal( disposals, 1 ); assert.equal( d.stepsTaken, 0 );
    } );
    check( 'failed submission retires advanced contact history and zero contact nodes remain valid', () => {
        const state = {}, renderer = spy(), f = factory( state );
        const d = make( renderer, { contactFactory: context => {
            const owner = f( context ); owner.nodesFor = () => []; return owner;
        } } );
        d.update( 0 ); assert.deepEqual( names( renderer.calls[ 0 ] ), [ 'hair DFTL step 0', 'hair card rebuild' ] );
        renderer.compute = () => { throw Error( 'submission failed' ); };
        assert.throws( () => d.update( 1 / 60 ), /submission failed/ );
        assert.equal( state.prepared.length, 2 ); assert.equal( state.disposals, 1 );
        assert.equal( d.disposed, true ); assert.equal( renderer.deleted.length, 8 );
        assert.throws( () => d.update( 1 / 60 ), /disposed/ );
    } );
    check( 'contact report cannot return after retirement', () => {
        const renderer = spy(), state = {}, f = factory( state ); let d;
        d = make( renderer, { contactFactory: context => { const owner = f( context );
            owner.report = () => { d.dispose(); return {}; }; return owner; } } );
        assert.throws( () => d.contactReport(), /disposed/ );
    } );
    check( 'unused/pre-init and renderer-shutdown contact disposal are idempotent', () => {
        for ( const renderer of [ {}, { _initialized: false }, spy() ] ) {
            const state = {}, d = make( renderer, { contactFactory: factory( state ) } );
            if ( renderer._initialized === false ) assert.throws( () => d.update( 0 ), /initialize the renderer/ );
            delete renderer._attributes; d.dispose(); d.dispose(); assert.equal( state.disposals, 1 );
        }
    } );
} finally {
    ComputeNode.prototype.dispose = originalDispose; geometry.dispose();
}
console.log( `PASS ${ checks } contact factory contract checks (CPU orchestration; no GPU geometry/performance claim)` );

if ( process.argv.includes( '--gpu' ) ) {
    const { startProbeServer, launchProbeBrowser } = await import( '../render/MotionProbe.mjs' );
    const server = await startProbeServer( { port: 5218 } );
    let browser;
    try {
        browser = await launchProbeBrowser(); const page = await browser.newPage(); const errors = [];
        page.on( 'pageerror', error => errors.push( error.message ) );
        page.on( 'console', message => { if ( message.type() === 'error' ) errors.push( message.text() ); } );
        page.on( 'response', response => { if ( response.status() >= 400 ) errors.push( `${ response.status() } ${ response.url() }` ); } );
        page.on( 'requestfailed', request => errors.push( `${ request.url() } ${ request.failure()?.errorText }` ) );
        await page.goto( `${ server.baseUrl }/src/portrait.html?capture&hair=bob02`, { waitUntil: 'domcontentloaded' } );
        await page.waitForFunction( () => window.portrait, null, { timeout: 120_000 } );
        const result = await page.evaluate( async moduleUrl => {
            // Use Vite's resolved import URLs so the probe shares the solver's TSL singleton.
            const source = await ( await fetch( moduleUrl ) ).text();
            const urls = [ ...source.matchAll( /from\s*['"]([^'"]+)['"]/g ) ].map( match => match[ 1 ] ).filter( url => url.startsWith( '/' ) );
            const modules = await Promise.all( urls.map( url => import( url ) ) );
            const { Matrix4 } = modules.find( module => module.Matrix4 );
            const { Fn, instancedArray, uint, vec3 } = modules.find( module => module.instancedArray );
            const { createHairDynamics } = await import( moduleUrl );
            const { avatar } = portrait, renderer = avatar.stage.renderer;
            if ( avatar.stage.backendName !== 'webgpu' ) throw Error( 'Actual WebGPU required' );
            const geometry = avatar.hairRoot.children[ 0 ].geometry;
            const resources = () => ( { storage: renderer.info.memory.storageAttributes,
                bytes: renderer.info.memory.storageAttributesSize,
                compute: [ ...renderer._pipelines.caches.values() ].filter( node => node.isComputePipeline ).length } );
            const initial = resources(), arms = {};
            for ( const arm of [ 'default', 'observe', 'mutate' ] ) {
                let trace, context, prepared = [], contactDisposed = 0;
                const contactFactory = arm === 'default' ? undefined : borrowed => {
                    context = borrowed; trace = instancedArray( borrowed.maxSubstepsPerFrame, 'vec3' );
                    const nodes = Array.from( { length: borrowed.maxSubstepsPerFrame }, ( _, i ) => Fn( () => {
                        trace.element( uint( i ) ).assign( borrowed.positionBuffer.element( uint( 0 ) ) );
                        if ( arm === 'mutate' ) borrowed.positionBuffer.element( uint( 0 ) ).addAssign( vec3( .001, 0, 0 ) );
                    } )().compute( 1 ).setName( `contact test ${ arm } ${ i }` ) );
                    return { prepare( frame ) { prepared.push( { ...frame } ); }, nodesFor( i ) { return [ nodes[ i ] ]; },
                        report() { return { prepared }; }, dispose() {
                            contactDisposed++; nodes.forEach( node => node.dispose() ); renderer._attributes?.delete( trace.value );
                        } };
                };
                const d = createHairDynamics( { renderer, geometry, contactFactory } );
                try {
                    d.setHeadMatrix( new Matrix4(), new Matrix4(), new Matrix4() ); d.reset(); d.update( 0 );
                    d.setHeadMatrix( new Matrix4().makeTranslation( .04, 0, 0 ), new Matrix4(), new Matrix4() );
                    d.update( 1 / 60 );
                    const centres = await d.readCentrelines(), vertices = await d.readVertices();
                    let traced = null;
                    if ( trace ) {
                        const raw = new Float32Array( await renderer.getArrayBufferAsync( trace.value ) );
                        traced = [ 0, 1 ].map( i => Array.from( raw.slice( i * trace.value.itemSize, i * trace.value.itemSize + 3 ) ) );
                    }
                    arms[ arm ] = { positions: Array.from( centres.positions ), velocities: Array.from( centres.velocities ),
                        vertices: Array.from( vertices.positions ), traced, prepared,
                        restRoot: Array.from( d.groom.restCentres.slice( 0, 3 ) ), steps: d.stepsTaken,
                        computeCalls: d.computeCallsLastFrame, active: resources() };
                } finally { d.dispose(); d.dispose(); }
                arms[ arm ].after = resources(); arms[ arm ].contactDisposed = contactDisposed;
            }
            avatar.dispose(); return { initial, arms };
        }, `/@fs${ fileURLToPath( new URL( './HairDynamics.js', import.meta.url ) ) }` );
        check( 'WebGPU contact smoke has zero browser errors and finite buffers', () => {
            assert.deepEqual( errors, [] );
            for ( const arm of Object.values( result.arms ) ) for ( const key of [ 'positions', 'velocities', 'vertices' ] )
                assert.equal( arm[ key ].every( Number.isFinite ), true );
        } );
        check( 'WebGPU observe-only hook preserves every position, velocity and rebuilt vertex bit-for-bit', () => {
            for ( const key of [ 'positions', 'velocities', 'vertices' ] ) assert.deepEqual( result.arms.observe[ key ], result.arms.default[ key ] );
        } );
        check( 'WebGPU each contact reads its own interpolated solved root and final rebuild sees the final correction', () => {
            for ( const name of [ 'observe', 'mutate' ] ) {
                const arm = result.arms[ name ];
                for ( let i = 0; i < 2; i++ ) for ( let axis = 0; axis < 3; axis++ ) {
                    const expected = arm.restRoot[ axis ] + ( axis === 0 ? .02 * ( i + 1 ) : 0 );
                    assert.ok( Math.abs( arm.traced[ i ][ axis ] - expected ) < 2e-7, `${ name } substep ${ i } root axis ${ axis }` );
                }
                assert.deepEqual( arm.prepared, [ { substeps: 1, reset: true }, { substeps: 2, reset: false } ] );
                assert.equal( arm.computeCalls, 1 ); assert.equal( arm.steps, 3 );
            }
            assert.ok( Math.abs( result.arms.mutate.positions[ 0 ] - result.arms.default.positions[ 0 ] - .001 ) < 2e-7 );
            const actualCentre = ( result.arms.mutate.vertices[ 0 ] + result.arms.mutate.vertices[ 3 ] ) / 2;
            const defaultCentre = ( result.arms.default.vertices[ 0 ] + result.arms.default.vertices[ 3 ] ) / 2;
            assert.ok( Math.abs( actualCentre - defaultCentre - .001 ) < 2e-7 );
        } );
        check( 'WebGPU repeated contact/default owners release all private storage and compute pipelines', () => {
            for ( const [ name, arm ] of Object.entries( result.arms ) ) {
                assert.deepEqual( arm.after, result.initial );
                assert.equal( arm.active.storage - result.initial.storage, name === 'default' ? 8 : 9 );
                assert.equal( arm.contactDisposed, name === 'default' ? 0 : 1 );
            }
        } );
        // Optional durable small report, retaining numeric deltas rather than huge equal arrays.
        if ( process.env.HAIR_CONTACT_REPORT ) {
            const fs = await import( 'node:fs/promises' );
            const { createHash } = await import( 'node:crypto' );
            for ( const arm of Object.values( result.arms ) ) for ( const key of [ 'positions', 'velocities', 'vertices' ] ) {
                const values = new Float32Array( arm[ key ] );
                arm[ `${ key }Hash` ] = createHash( 'sha256' ).update( Buffer.from( values.buffer ) ).digest( 'hex' );
                delete arm[ key ];
            }
            await fs.writeFile( process.env.HAIR_CONTACT_REPORT, JSON.stringify( { checks, errors, ...result }, null, 2 ) + '\n' );
        }
        console.log( `PASS ${ checks } contact factory checks including actual WebGPU hook ordering, equivalence and cleanup` );
    } finally { await browser?.close(); await server.close(); }
}
