// One sequential real-source caller/control probe. No UI or appearance qualification.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const loadModule = relative => import( pathToFileURL( path.join( root, relative ) ).href );
const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { Figure } = await loadModule( 'packages/core/src/figure/Figure.js' );
const { GarmentManifest } = await loadModule( 'packages/core/src/wardrobe/GarmentManifest.js' );
const { FoundationLayer } = await loadModule( 'packages/core/src/wardrobe/FoundationLayer.js' );
const { Wardrobe } = await loadModule( 'packages/core/src/wardrobe/Wardrobe.js' );
const manifestPath = path.join( root, 'assets/wardrobe/manifest.json' );
const manifestSource = JSON.parse( fs.readFileSync( manifestPath, 'utf8' ) );
const outer = [ 'female_casualsuit01', 'shoes01' ];
const key = 'sugata.wardrobe.foundation.v1:browsercheck';
const clone = value => JSON.parse( JSON.stringify( value ) );
async function loadGltf( file ) {
    const bytes = fs.readFileSync( file );
    return new Promise( ( resolve, reject ) => new GLTFLoader().parse(
        bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '', resolve, reject ) );
}
async function exercise( slot, next ) {
    const record = { slot, next, initialRequest: [ ...outer ], states: {}, settlements: [] };
    let figure = null, wardrobe = null, foundation = null, storedRaw = null;
    const loads = [], memoryWrites = [], owned = [];
    const own = async ( label, ids ) => {
        const request = [ ...ids ];
        const promise = wardrobe.dress( ids );
        // Observe every owned promise immediately; await still returns the original outcome.
        promise.catch( () => {} ); owned.push( promise );
        try {
            const stats = await promise;
            record.settlements.push( { label, request, status: 'fulfilled', returnedWorn: [ ...stats.worn ] } );
            return stats;
        } catch ( error ) {
            record.settlements.push( { label, request, status: 'rejected', name: error.name, message: error.message } );
            throw error;
        }
    };
    const snapshot = () => clone( {
        worn: wardrobe.worn, floor: foundation.currentFloor(), preference: foundation.toJSON(),
        storedRaw, memoryWrites, loads, token: wardrobe.dressToken,
        loadingOutfit: wardrobe.loadingOutfit, pending: wardrobe.pendingFragments.size,
        resident: [ ...wardrobe.fragments.keys() ], disposed: wardrobe.disposed,
        bodyVisible: wardrobe.body.visible
    } );
    try {
        const manifest = new GarmentManifest( manifestSource, pathToFileURL( manifestPath ).href );
        foundation = new FoundationLayer( manifest );
        figure = new Figure( await loadGltf( path.join( root, 'assets/wardrobe/body/g050.glb' ) ) );
        wardrobe = new Wardrobe( figure, manifest, {
            decencyFloor: foundation.floor,
            loadFragment: async ( url, id ) => {
                const load = { id, url, status: 'loading' }; loads.push( load );
                try { const gltf = await loadGltf( fileURLToPath( url ) ); load.status = 'fulfilled'; return gltf; }
                catch ( error ) { load.status = 'rejected'; load.message = error.message; throw error; }
            }
        } );
        await own( 'initial', [ ...outer ] );
        record.states.initial = snapshot();
        // Exact current caller order, with a private memory store replacing personal localStorage.
        foundation.prefer( slot, next );
        storedRaw = JSON.stringify( foundation );
        memoryWrites.push( { key, value: storedRaw } );
        record.states.selectedSaved = snapshot();
        record.recipeRequest = [ ...wardrobe.worn ];
        try { await own( 'currentCallerRecipe', wardrobe.worn ); record.recipeError = null; }
        catch ( error ) { record.recipeError = { name: error.name, message: error.message }; }
        record.states.afterRecipe = snapshot();
        // Paired explicit control: preserve outer garment IDs; let the selected floor add itself.
        record.controlRequest = [ ...outer ];
        await own( 'replacementControl', [ ...outer ] );
        record.states.afterControl = snapshot();
        record.complete = true;
    } catch ( error ) {
        record.unexpectedFailure = { name: error.name, message: error.message };
        throw error;
    } finally {
        const settled = await Promise.allSettled( owned );
        record.drained = settled.map( item => ( { status: item.status,
            ...( item.status === 'rejected' ? { name: item.reason.name, message: item.reason.message } : {} ) } ) );
        if ( wardrobe ) { wardrobe.dispose(); record.states.disposed = snapshot(); }
        if ( figure ) { figure.dispose(); record.figureDisposeCalled = true; }
        console.log( JSON.stringify( { foundationCase: record } ) );
    }
}
await exercise( 'TORSO', 'foundation_vest' );
await exercise( 'HIPS', 'foundation_boxer_brief' );
console.log( JSON.stringify( { probeComplete: true, node: process.version, pid: process.pid,
    cases: 2, scope: 'Sequential real-source CPU IDs and private memory save; testbed run/catch/DOM not invoked.' } ) );
