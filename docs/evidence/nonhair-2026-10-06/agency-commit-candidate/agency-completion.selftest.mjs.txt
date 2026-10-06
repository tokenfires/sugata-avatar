// Real-rig asynchronous completion regressions. CPU policy only; no rendered fit claim.
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
const { WardrobeAgency, MemoryStore, MOOD_CHANGE_PERIOD_MS } = await import( './WardrobeAgency.js' );
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const manifestPath = path.join( root, 'assets/wardrobe/manifest.json' );
const manifestSource = JSON.parse( fs.readFileSync( manifestPath, 'utf8' ) );
const mood = { layer: 'mood', pleasure: 0, arousal: 0, dominance: 0 };
const records = [];

function deferred() {
    let resolve;
    const promise = new Promise( done => { resolve = done; } );
    return { promise, resolve };
}
function hold( id, fail = false ) {
    return { id, fail, entered: deferred(), released: deferred() };
}
async function loadGltf( file ) {
    const bytes = fs.readFileSync( file );
    return new Promise( ( resolve, reject ) => new GLTFLoader().parse(
        bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '', resolve, reject ) );
}
async function build( gates, choices ) {
    const manifest = new GarmentManifest( manifestSource, pathToFileURL( manifestPath ).href );
    const foundation = new FoundationLayer( manifest, {} );
    const figure = new Figure( await loadGltf( path.join( root, 'assets/wardrobe/body/g050.glb' ) ) );
    const wardrobe = new Wardrobe( figure, manifest, {
        decencyFloor: foundation.floor,
        loadFragment: async ( url, id ) => {
            const gate = gates.find( item => item.id === id );
            if ( gate ) {
                gate.entered.resolve();
                await gate.released.promise;
                if ( gate.fail ) throw new Error( `owned failed load: ${ id }` );
            }
            return loadGltf( fileURLToPath( url ) );
        }
    } );
    const store = new MemoryStore();
    const clock = { now: 1_000_000 };
    let choice = 0;
    const agency = new WardrobeAgency( wardrobe, {
        dresser: { choose: () => [ ...choices[ choice++ % choices.length ] ] },
        store, profile: 'completion-regression', clock: () => clock.now
    } );
    try { await agency.wake(); }
    catch ( error ) { wardrobe.dispose(); figure.dispose(); throw error; }
    return { wardrobe, agency, store, clock, foundation, figure };
}
function snapshot( r ) {
    return JSON.parse( JSON.stringify( {
        worn: r.wardrobe.worn, floor: r.foundation.currentFloor(),
        mode: r.agency.mode, pinnedOutfit: r.agency.pinnedOutfit,
        currentRequest: r.agency.currentRequest, pending: r.agency.pending,
        lastChangeAt: r.agency.lastChangeAt, lastWornAt: Object.fromEntries( r.agency.lastWornAt ),
        preferences: r.agency.preferences, pinHolds: r.agency.pinHolds(),
        storedRaw: r.store.read( r.agency.key )
    } ) );
}
function requestIs( r, ids ) {
    assert.deepEqual( r.agency.currentRequest, ids );
    assert.deepEqual( JSON.parse( r.store.read( r.agency.key ) ).currentRequest, ids );
    assert.deepEqual( r.wardrobe.worn, r.wardrobe.validateOutfit( ids ) );
}
function result( outcome ) {
    return { applied: outcome.applied, status: outcome.status ?? null,
        honoured: outcome.preference?.honoured, worn: outcome.stats.worn };
}
// Disclosed caller-boundary scheduling seam: the real implementation commits normally;
// only delivery back to Agency is held. All arguments, including onApplied, are forwarded.
function holdDeliveredCommit( r, id ) {
    const entered = deferred(), released = deferred();
    const dress = r.wardrobe.dress.bind( r.wardrobe );
    r.wardrobe.dress = async ( ...args ) => {
        const stats = await dress( ...args );
        if ( args[ 0 ].includes( id ) ) { entered.resolve(); await released.promise; }
        return stats;
    };
    return { entered, released };
}
async function exercise( name, gates, choices, action ) {
    const r = await build( gates, choices );
    const owned = [], cleanups = [];
    const own = promise => {
        // Observe rejection immediately without changing the original promise returned to tests.
        promise.catch( () => {} ); owned.push( promise ); return promise;
    };
    const record = { name, initial: snapshot( r ), stages: {} };
    try {
        await action( r, record, own, cleanups );
        record.final = snapshot( r );
        assert.ok( record.final.floor.every( id => record.final.worn.includes( id ) ) || r.wardrobe.disposed );
        record.passed = true;
    } catch ( error ) {
        record.failure = String( error ); record.atFailure = snapshot( r ); throw error;
    } finally {
        for ( const gate of gates ) gate.released.resolve();
        for ( const cleanup of cleanups ) cleanup();
        const settled = [];
        // Drain requests added synchronously by a committing callback during cleanup as well.
        for ( let cursor = 0; cursor < owned.length; ) {
            const end = owned.length;
            settled.push( ...await Promise.allSettled( owned.slice( cursor, end ) ) );
            cursor = end;
        }
        record.settled = settled.map( item => ( { status: item.status,
            ...( item.status === 'rejected' ? { error: String( item.reason ) } : {} ) } ) );
        r.wardrobe.dispose(); r.figure.dispose();
        record.cleanup = { disposed: r.wardrobe.disposed, pendingFragments: r.wardrobe.pendingFragments.size };
        records.push( record ); console.log( JSON.stringify( { completionCase: record } ) );
    }
}

{
    const gate = hold( 'fedora01' );
    await exercise( 'old-consider-new-pin', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        r.agency.setMode( 'agent', { by: 'user' } );
        const old = own( r.agency.consider( { mood } ) ); await gate.entered.promise;
        await own( r.agency.pin( [ 'shoes01' ], { by: 'user' } ) );
        rec.stages.newerPin = snapshot( r ); gate.released.resolve(); rec.old = result( await old );
        assert.equal( rec.old.applied, false ); assert.equal( rec.old.status, 'superseded' );
        assert.equal( r.agency.preferences[ 0 ].honoured, false ); requestIs( r, [ 'shoes01' ] );
        assert.equal( r.agency.lastChangeAt, null ); assert.deepEqual( Object.fromEntries( r.agency.lastWornAt ), {} );
        assert.ok( r.agency.pinHolds() );
    } );
}
{
    const gate = hold( 'fedora01' );
    await exercise( 'old-pin-new-pin', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        const old = own( r.agency.pin( [ 'fedora01' ], { by: 'user' } ) ); await gate.entered.promise;
        await own( r.agency.pin( [ 'shoes01' ], { by: 'user' } ) ); rec.stages.newerPin = snapshot( r );
        gate.released.resolve(); rec.oldReturnedWorn = ( await old ).worn;
        requestIs( r, [ 'shoes01' ] ); assert.ok( r.agency.pinHolds() );
        assert.deepEqual( rec.oldReturnedWorn, r.wardrobe.worn );
    } );
}
await exercise( 'serial-honour', [], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
    r.agency.setMode( 'agent', { by: 'user' } ); rec.old = result( await own( r.agency.consider( { mood } ) ) );
    rec.stages.considered = snapshot( r ); requestIs( r, [ 'fedora01' ] ); assert.equal( rec.old.applied, true );
    await own( r.agency.pin( [ 'shoes01' ], { by: 'user' } ) );
    requestIs( r, [ 'shoes01' ] ); assert.equal( r.agency.preferences[ 0 ].honoured, true );
} );
{
    const gate = hold( 'fedora01' );
    await exercise( 'invalid-newer-preserves-valid-old', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        r.agency.setMode( 'agent', { by: 'user' } ); const old = own( r.agency.consider( { mood } ) );
        await gate.entered.promise;
        await assert.rejects( own( r.agency.pin( [ 'absent-garment' ], { by: 'user' } ) ) );
        rec.stages.afterInvalid = snapshot( r ); gate.released.resolve(); rec.old = result( await old );
        assert.equal( rec.old.applied, true ); requestIs( r, [ 'fedora01' ] );
    } );
}
{
    const oldGate = hold( 'fedora01' ), newGate = hold( 'shoes01', true );
    await exercise( 'valid-failed-newer-obsoletes-unapplied-old', [ oldGate, newGate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        r.agency.setMode( 'agent', { by: 'user' } ); const old = own( r.agency.consider( { mood } ) );
        await oldGate.entered.promise; const newer = own( r.agency.pin( [ 'shoes01' ], { by: 'user' } ) );
        await newGate.entered.promise; newGate.released.resolve(); await assert.rejects( newer, /owned failed load/ );
        rec.stages.afterFailure = snapshot( r ); oldGate.released.resolve(); rec.old = result( await old );
        assert.equal( rec.old.applied, false ); assert.equal( r.agency.preferences[ 0 ].honoured, false );
        assert.equal( r.agency.currentRequest, null ); assert.equal( r.agency.lastChangeAt, null );
        assert.deepEqual( r.wardrobe.worn, r.foundation.currentFloor() );
    } );
}
{
    const gate = hold( 'shoes01', true );
    await exercise( 'applied-old-newer-pending-then-fails', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own, cleanups ) => {
        const delivery = holdDeliveredCommit( r, 'fedora01' ); cleanups.push( delivery.released.resolve );
        r.agency.setMode( 'agent', { by: 'user' } ); const old = own( r.agency.consider( { mood } ) );
        await delivery.entered.promise; rec.stages.committedBeforeDelivery = snapshot( r );
        requestIs( r, [ 'fedora01' ] ); assert.equal( r.agency.preferences[ 0 ].honoured, true );
        const newer = own( r.agency.pin( [ 'shoes01' ], { by: 'user' } ) ); await gate.entered.promise;
        rec.stages.newerPending = snapshot( r ); requestIs( r, [ 'fedora01' ] );
        gate.released.resolve(); await assert.rejects( newer, /owned failed load/ );
        rec.stages.newerFailed = snapshot( r ); delivery.released.resolve(); rec.old = result( await old );
        assert.equal( rec.old.applied, true ); requestIs( r, [ 'fedora01' ] );
        assert.equal( r.agency.mode, 'agent' );
    } );
}
await exercise( 'two-real-commits-before-old-delivery', [], [ [ 'fedora01' ], [ 'shoes01' ] ], async ( r, rec, own, cleanups ) => {
    const delivery = holdDeliveredCommit( r, 'fedora01' ); cleanups.push( delivery.released.resolve );
    r.agency.setMode( 'agent', { by: 'user' } ); const old = own( r.agency.consider( { mood } ) );
    await delivery.entered.promise; rec.stages.oldCommitted = snapshot( r );
    r.clock.now += MOOD_CHANGE_PERIOD_MS + 1;
    rec.newer = result( await own( r.agency.consider( { mood } ) ) ); rec.stages.newerCommitted = snapshot( r );
    assert.equal( rec.newer.applied, true ); delivery.released.resolve(); rec.old = result( await old );
    assert.equal( rec.old.applied, true ); requestIs( r, [ 'shoes01' ] );
    assert.deepEqual( r.agency.preferences.map( item => item.honoured ), [ true, true ] );
    assert.deepEqual( Object.fromEntries( r.agency.lastWornAt ), { fedora01: r.clock.now } );
    assert.equal( r.agency.lastChangeAt, r.clock.now );
} );
{
    const gate = hold( 'fedora01' );
    await exercise( 'callback-once-invalid-option-preserves-old', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        const seen = [];
        const old = own( r.wardrobe.dress( [ 'fedora01' ], { onApplied: stats => { seen.push( [ ...stats.worn ] ); } } ) );
        await gate.entered.promise;
        await assert.rejects( own( r.wardrobe.dress( [ 'shoes01' ], { onApplied: 'invalid' } ) ), /onApplied/ );
        assert.deepEqual( seen, [] ); gate.released.resolve(); const stats = await old;
        rec.callbacks = seen; rec.returnedWorn = stats.worn;
        assert.deepEqual( seen, [ r.wardrobe.validateOutfit( [ 'fedora01' ] ) ] );
        assert.deepEqual( stats.worn, seen[ 0 ] ); assert.equal( r.wardrobe.loadingOutfit, null );
    } );
}
await exercise( 'callback-throw-is-postcommit', [], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
    const sentinel = new Error( 'owned postcommit callback failure' ); let calls = 0;
    await assert.rejects( own( r.wardrobe.dress( [ 'fedora01' ], { onApplied: () => { calls++; throw sentinel; } } ) ), error => error === sentinel );
    rec.calls = calls; rec.stages.afterThrow = snapshot( r ); assert.equal( calls, 1 );
    assert.deepEqual( r.wardrobe.worn, r.wardrobe.validateOutfit( [ 'fedora01' ] ) );
    assert.equal( r.wardrobe.loadingOutfit, null );
    await own( r.wardrobe.dress( [ 'shoes01' ] ) ); assert.deepEqual( r.wardrobe.worn, r.wardrobe.validateOutfit( [ 'shoes01' ] ) );
} );
{
    const gate = hold( 'shoes01' );
    await exercise( 'callback-reentrant-commit-snapshot-and-loading-owner', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        const seen = []; let newer;
        const first = own( r.wardrobe.dress( [ 'fedora01' ], { onApplied: stats => {
            seen.push( [ ...stats.worn ] ); newer = own( r.wardrobe.dress( [ 'shoes01' ], {
                onApplied: next => { seen.push( [ ...next.worn ] ); }
            } ) );
        } } ) );
        const firstStats = await first; await gate.entered.promise;
        rec.firstReturnedWorn = firstStats.worn; rec.loadingAfterOldFinally = [ ...r.wardrobe.loadingOutfit ];
        assert.deepEqual( firstStats.worn, r.wardrobe.validateOutfit( [ 'fedora01' ] ) );
        assert.deepEqual( r.wardrobe.loadingOutfit, r.wardrobe.validateOutfit( [ 'shoes01' ] ) );
        gate.released.resolve(); await newer; rec.callbacks = seen;
        assert.deepEqual( seen, [ r.wardrobe.validateOutfit( [ 'fedora01' ] ), r.wardrobe.validateOutfit( [ 'shoes01' ] ) ] );
        assert.deepEqual( r.wardrobe.worn, seen[ 1 ] ); assert.equal( r.wardrobe.loadingOutfit, null );
    } );
}
{
    const gate = hold( 'fedora01' );
    await exercise( 'pin-input-alias-captured', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        const ids = [ 'fedora01' ]; const pending = own( r.agency.pin( ids, { by: 'user' } ) );
        await gate.entered.promise; ids[ 0 ] = 'shoes01'; rec.mutatedCallerIds = [ ...ids ];
        gate.released.resolve(); await pending; requestIs( r, [ 'fedora01' ] ); assert.ok( r.agency.pinHolds() );
        await assert.rejects( own( r.agency.pin( 'shoes01', { by: 'user' } ) ), /array/ );
        requestIs( r, [ 'fedora01' ] );
    } );
}
{
    const failed = hold( 'fedora01', true ), disposed = hold( 'shoes01' );
    await exercise( 'ordinary-failure-and-disposed-load-never-notify', [ failed, disposed ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        let calls = 0;
        const failure = own( r.wardrobe.dress( [ 'fedora01' ], { onApplied: () => { calls++; } } ) );
        await failed.entered.promise; failed.released.resolve(); await assert.rejects( failure, /owned failed load/ );
        rec.stages.afterFailure = snapshot( r ); assert.equal( r.store.read( r.agency.key ), null );
        const pending = own( r.wardrobe.dress( [ 'shoes01' ], { onApplied: () => { calls++; } } ) );
        await disposed.entered.promise; r.wardrobe.dispose(); disposed.released.resolve();
        await assert.rejects( pending, /disposed/ ); rec.calls = calls; assert.equal( calls, 0 );
        assert.equal( r.wardrobe.loadingOutfit, null ); assert.deepEqual( r.wardrobe.worn, [] );
    } );
}
{
    const gate = hold( 'fedora01' );
    await exercise( 'ask-confirm-obsolete-to-new-user-pin', [ gate ], [ [ 'fedora01' ] ], async ( r, rec, own ) => {
        r.agency.setMode( 'ask', { by: 'user' } ); const proposal = await own( r.agency.consider( { mood } ) );
        const old = own( r.agency.confirm( String( proposal.preference.at ), { by: 'user' } ) );
        await gate.entered.promise; await own( r.agency.pin( [ 'shoes01' ], { by: 'user' } ) );
        rec.stages.newerPin = snapshot( r ); gate.released.resolve(); rec.old = result( await old );
        assert.equal( rec.old.applied, false ); assert.equal( r.agency.preferences[ 0 ].honoured, false );
        assert.equal( r.agency.pending, null ); requestIs( r, [ 'shoes01' ] ); assert.ok( r.agency.pinHolds() );
    } );
}
assert.equal( records.length, 13 );
assert.ok( records.every( record => record.passed && record.cleanup.disposed && record.cleanup.pendingFragments === 0 ) );
console.log( JSON.stringify( { completionPassed: records.length, pid: process.pid,
    scope: 'CPU policy and owned callback scheduling only; bitmap stubs, no rendered fit/appearance/performance acceptance' } ) );
