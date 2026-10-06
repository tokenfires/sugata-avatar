// Real-rig foundation refresh ownership. CPU policy only; no UI or rendered fit acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );
const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { Figure } = await import( '../figure/Figure.js' );
const { GarmentManifest } = await import( './GarmentManifest.js' );
const { FoundationLayer } = await import( './FoundationLayer.js' );
const { Wardrobe } = await import( './Wardrobe.js' );
const { WardrobeAgency, MemoryStore } = await import( './WardrobeAgency.js' );
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const manifestPath = path.join( root, 'assets/wardrobe/manifest.json' );
const manifestSource = JSON.parse( fs.readFileSync( manifestPath, 'utf8' ) );
const outer = [ 'female_casualsuit01', 'shoes01' ];
const mood = { layer: 'mood', pleasure: 0, arousal: 0, dominance: 0 };
const clone = value => JSON.parse( JSON.stringify( value ) );
const withoutFoundation = ids => ids.filter( id => !id.startsWith( 'foundation_' ) );
const records = [];
function deferred() {
    let resolve;
    const promise = new Promise( done => { resolve = done; } );
    return { promise, resolve };
}
function heldLoad( id, fail = false ) {
    return { id, fail, entered: deferred(), released: deferred() };
}
async function loadGltf( file ) {
    const bytes = fs.readFileSync( file );
    return new Promise( ( resolve, reject ) => new GLTFLoader().parse(
        bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '', resolve, reject ) );
}
async function exercise( name, gates, action ) {
    const documents = [], attempts = [], loads = [], owned = [], cleanups = [];
    const document = raw => {
        if ( raw === null ) return null;
        let index = documents.indexOf( raw );
        if ( index < 0 ) { index = documents.length; documents.push( raw ); }
        return index;
    };
    class RecordingStore extends MemoryStore {
        failNext = false;
        write( key, value ) {
            const attempt = { key, document: document( value ), committed: false }; attempts.push( attempt );
            if ( this.failNext ) { this.failNext = false; throw new Error( 'owned foundation store failure' ); }
            super.write( key, value ); attempt.committed = true;
        }
    }
    const r = { wardrobe: null, figure: null, foundation: null, agency: null,
        store: new RecordingStore(), clock: { now: 1_000_000 }, foundationRaw: null,
        choice: [ ...outer ] };
    const rec = { name, states: {}, settlements: [], errors: {} };
    r.own = ( label, promise ) => {
        promise.catch( () => {} ); owned.push( promise );
        promise.then( value => rec.settlements.push( { label, status: 'fulfilled',
            returnedWorn: [ ...( value.stats?.worn ?? value.worn ?? [] ) ] } ),
        error => rec.settlements.push( { label, status: 'rejected', name: error.name, message: error.message } ) );
        return promise;
    };
    r.snapshot = () => clone( {
        worn: r.wardrobe.worn, floor: r.foundation.currentFloor(), foundationPreference: r.foundation.toJSON(),
        foundationSavedJSON: r.foundationRaw, mode: r.agency.mode, pin: r.agency.pinnedOutfit,
        request: r.agency.currentRequest, pending: r.agency.pending === null ? null :
            { ...r.agency.pending, id: r.agency.pendingId }, preferences: r.agency.preferences,
        lastChangeAt: r.agency.lastChangeAt, history: Object.fromEntries( r.agency.lastWornAt ), clock: r.clock.now,
        storedDocument: document( r.store.read( r.agency.key ) ), writes: attempts.length,
        token: r.wardrobe.dressToken, loading: r.wardrobe.loadingOutfit,
        pendingFragments: r.wardrobe.pendingFragments.size, disposed: r.wardrobe.disposed,
        resident: r.wardrobe.fragments.size, pinHolds: r.agency.pinHolds()
    } );
    r.stage = name => { rec.states[ name ] = r.snapshot(); return rec.states[ name ]; };
    // Source-equivalent preference/save order with private memory; testbed run/DOM is not imported.
    r.select = ( label, slot, id ) => {
        r.foundation.prefer( slot, id );
        r.foundationRaw = JSON.stringify( r.foundation );
        return r.own( label, r.agency.refreshFoundation( { by: 'user' } ) );
    };
    r.pin = ( label, ids = null ) => r.own( label, r.agency.pin( ids, { by: 'user' } ) );
    try {
        const manifest = new GarmentManifest( manifestSource, pathToFileURL( manifestPath ).href );
        r.foundation = new FoundationLayer( manifest );
        r.figure = new Figure( await loadGltf( path.join( root, 'assets/wardrobe/body/g050.glb' ) ) );
        r.wardrobe = new Wardrobe( r.figure, manifest, {
            decencyFloor: r.foundation.floor,
            loadFragment: async ( url, id ) => {
                const load = { id, file: path.relative( root, fileURLToPath( url ) ), status: 'loading' }; loads.push( load );
                const gate = gates.find( item => item.id === id );
                try {
                    if ( gate ) { gate.entered.resolve(); await gate.released.promise;
                        if ( gate.fail ) throw new Error( 'owned foundation load failure' ); }
                    const gltf = await loadGltf( fileURLToPath( url ) ); load.status = 'fulfilled'; return gltf;
                } catch ( error ) { load.status = 'rejected'; load.message = error.message; throw error; }
            }
        } );
        r.agency = new WardrobeAgency( r.wardrobe, { dresser: { choose: () => [ ...r.choice ] },
            store: r.store, profile: `foundation-refresh:${ name }`, clock: () => r.clock.now } );
        await r.own( 'initialDress', r.wardrobe.dress( [ ...outer ] ) );
        rec.initial = r.snapshot();
        await action( r, rec, cleanups );
        rec.final = r.snapshot(); rec.passed = true;
    } catch ( error ) {
        rec.failure = { name: error.name, message: error.message }; throw error;
    } finally {
        for ( const gate of gates ) gate.released.resolve();
        for ( const cleanup of cleanups ) cleanup();
        rec.drained = ( await Promise.allSettled( owned ) ).map( item => ( { status: item.status,
            ...( item.status === 'rejected' ? { name: item.reason.name, message: item.reason.message } : {} ) } ) );
        if ( r.wardrobe ) {
            r.wardrobe.dispose();
            rec.cleanup = { disposed: r.wardrobe.disposed, pendingFragments: r.wardrobe.pendingFragments.size,
                resident: r.wardrobe.fragments.size, worn: [ ...r.wardrobe.worn ] };
        }
        if ( r.figure ) { r.figure.dispose(); rec.figureDisposeCalled = true; }
        rec.documents = documents; rec.writeAttempts = attempts; rec.loads = loads;
        records.push( rec ); console.log( JSON.stringify( { foundationRefreshCase: rec } ) );
    }
}
function preserved( before, after ) {
    for ( const field of [ 'mode', 'pending', 'preferences', 'lastChangeAt', 'history', 'clock' ] ) {
        assert.deepEqual( after[ field ], before[ field ], field );
    }
}
function switched( r, before, after ) {
    preserved( before, after );
    assert.deepEqual( withoutFoundation( after.worn ), withoutFoundation( before.worn ) );
    assert.deepEqual( after.worn.filter( id => id.startsWith( 'foundation_' ) ), after.floor );
    assert.deepEqual( after.pin, before.pin === null ? null :
        r.wardrobe.manifest.sortByLayer( [ ...after.floor, ...withoutFoundation( before.pin ) ] ) );
    assert.deepEqual( after.request, before.request === null ? null : withoutFoundation( before.request ) );
    assert.equal( after.pinHolds, before.pinHolds );
    assert.equal( after.pendingFragments, 0 ); assert.equal( after.loading, null );
}
await exercise( 'null-torso-and-same-choice', [], async r => {
    const before = r.stage( 'before' );
    await r.select( 'torso', 'TORSO', 'foundation_vest' ); switched( r, before, r.stage( 'after' ) );
    const resident = r.wardrobe.fragments.size;
    await r.select( 'same', 'TORSO', 'foundation_vest' );
    switched( r, before, r.stage( 'same' ) ); assert.equal( r.wardrobe.fragments.size, resident );
} );
await exercise( 'null-hips', [], async r => {
    const before = r.stage( 'before' );
    await r.select( 'hips', 'HIPS', 'foundation_boxer_brief' ); switched( r, before, r.stage( 'after' ) );
} );
await exercise( 'active-pin-two-slots', [], async r => {
    await r.pin( 'pin' ); const before = r.stage( 'before' );
    await r.select( 'torso', 'TORSO', 'foundation_vest' ); switched( r, before, r.stage( 'torso' ) );
    await r.select( 'hips', 'HIPS', 'foundation_boxer_brief' ); switched( r, before, r.stage( 'after' ) );
    await r.own( 'restore', r.agency.restorePin() ); assert.equal( r.stage( 'restored' ).pinHolds, true );
} );
await exercise( 'dormant-pin-own-outers-restart', [], async r => {
    await r.pin( 'pin', [ 'fedora01' ] ); r.agency.setMode( 'agent', { by: 'user' } );
    r.clock.now += 2_000_000; await r.own( 'consider', r.agency.consider( { mood } ) );
    const before = r.stage( 'before' );
    await r.select( 'torso', 'TORSO', 'foundation_vest' ); switched( r, before, r.stage( 'after' ) );
    r.agency = new WardrobeAgency( r.wardrobe, { dresser: { choose: () => [ ...outer ] },
        store: r.store, profile: r.agency.profile, clock: () => r.clock.now } );
    r.stage( 'restarted' ); await r.own( 'wake', r.agency.wake() ); r.stage( 'woken' );
    r.agency.setMode( 'pinned', { by: 'user' } ); await r.own( 'restore', r.agency.restorePin() );
    assert.deepEqual( r.stage( 'restored' ).worn, r.agency.pinnedOutfit );
} );
await exercise( 'preexisting-pin-drift', [], async r => {
    await r.pin( 'pin', [ 'fedora01' ] );
    await r.own( 'rogueDress', r.wardrobe.dress( [ ...outer ] ) );
    const before = r.stage( 'before' ); assert.equal( before.pinHolds, false );
    await r.select( 'torso', 'TORSO', 'foundation_vest' ); switched( r, before, r.stage( 'after' ) );
} );
await exercise( 'ask-pending-history', [], async r => {
    await r.pin( 'pin', [ 'fedora01' ] ); r.agency.setMode( 'agent', { by: 'user' } );
    r.clock.now += 2_000_000; await r.own( 'consider', r.agency.consider( { mood } ) );
    r.agency.setMode( 'ask', { by: 'user' } ); r.clock.now += 2_000_000; r.choice = [ 'fedora01' ];
    await r.own( 'propose', r.agency.consider( { mood } ) );
    const pending = r.agency.pending, before = r.stage( 'before' ); assert.notEqual( pending, null );
    await r.select( 'hips', 'HIPS', 'foundation_boxer_brief' ); switched( r, before, r.stage( 'after' ) );
    assert.equal( r.agency.pending, pending );
} );
await exercise( 'invalid-choice-and-user-mark', [], async ( r, rec ) => {
    const before = r.stage( 'before' );
    try { r.select( 'invalid', 'TORSO', 'foundation_boxer_brief' ); assert.fail( 'invalid choice accepted' ); }
    catch ( error ) { assert.match( error.message, /cannot fill/ ); rec.errors.invalid = error.message; }
    await assert.rejects( r.own( 'unauthorized', r.agency.refreshFoundation( { by: 'agent' } ) ), /user's call/ );
    assert.deepEqual( r.stage( 'after' ), before );
} );
{
    const gate = heldLoad( 'foundation_vest', true );
    await exercise( 'precommit-load-failure', [ gate ], async r => {
        await r.pin( 'pin' ); const before = r.stage( 'before' );
        const request = r.select( 'failed', 'TORSO', 'foundation_vest' ); await gate.entered.promise;
        r.stage( 'loading' ); gate.released.resolve(); await assert.rejects( request, /owned foundation load failure/ );
        const after = r.stage( 'after' ); preserved( before, after );
        for ( const field of [ 'worn', 'pin', 'request', 'storedDocument', 'writes' ] ) assert.deepEqual( after[ field ], before[ field ] );
    } );
}
{
    const gate = heldLoad( 'foundation_vest' );
    await exercise( 'superseded-refresh', [ gate ], async r => {
        await r.pin( 'pin' ); r.stage( 'before' );
        const old = r.select( 'obsolete', 'TORSO', 'foundation_vest' ); await gate.entered.promise;
        r.stage( 'loading' ); const newer = r.pin( 'newerPin', [ 'fedora01' ] ); r.stage( 'newerRequested' );
        gate.released.resolve(); await Promise.all( [ old, newer ] );
        const after = r.stage( 'after' ); assert.deepEqual( after.request, [ 'fedora01' ] );
        assert.deepEqual( after.worn, [ 'foundation_briefs', 'foundation_vest', 'fedora01' ] ); assert.equal( after.pinHolds, true );
    } );
}
await exercise( 'actualcommit-delivery-held', [], async ( r, rec, cleanups ) => {
    await r.pin( 'pin' ); r.stage( 'before' );
    const entered = deferred(), released = deferred(); let first = true;
    const dress = r.wardrobe.dress.bind( r.wardrobe );
    // Disclosed caller-boundary seam: actual implementation/callback commits, only first delivery is held.
    r.wardrobe.dress = async ( ...args ) => {
        const hold = first; first = false; const stats = await dress( ...args );
        if ( hold ) { entered.resolve(); await released.promise; }
        return stats;
    };
    cleanups.push( () => released.resolve() );
    const old = r.select( 'heldDelivery', 'TORSO', 'foundation_vest' ); await entered.promise;
    r.stage( 'committedHeld' ); await r.pin( 'newerPin', [ 'fedora01' ] ); r.stage( 'newerApplied' );
    released.resolve(); await old;
    assert.deepEqual( r.stage( 'after' ), rec.states.newerApplied );
} );
await exercise( 'disposed-refusal', [], async r => {
    r.wardrobe.dispose(); const before = r.stage( 'before' );
    await assert.rejects( r.select( 'disposed', 'TORSO', 'foundation_vest' ), /disposed/ );
    const after = r.stage( 'after' ); preserved( before, after );
    for ( const field of [ 'worn', 'pin', 'request', 'storedDocument', 'writes', 'token' ] ) assert.deepEqual( after[ field ], before[ field ] );
} );
await exercise( 'postcommit-store-rejection', [], async r => {
    await r.pin( 'pin' ); const before = r.stage( 'before' ); r.store.failNext = true;
    await assert.rejects( r.select( 'postcommitError', 'TORSO', 'foundation_vest' ), /owned foundation store failure/ );
    const after = r.stage( 'after' ); switched( r, before, after );
    assert.equal( after.storedDocument, before.storedDocument ); assert.equal( after.writes, before.writes + 1 );
} );
assert.equal( records.length, 12 );
console.log( JSON.stringify( { foundationRefreshComplete: true, cases: records.length, node: process.version,
    pid: process.pid, scope: '12 new real-source CPU cases; testbed helper/DOM and personal storage not executed.' } ) );
