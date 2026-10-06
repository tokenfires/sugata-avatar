// Run from the repository root. Real manifest/Wardrobe/agency policy; no rendered texture claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CatalogueDresser } from '../../../../packages/core/src/wardrobe/CatalogueDresser.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const root = process.cwd();
const loadModule = file => import( file === 'wardrobe/Wardrobe.js' ? './Wardrobe.mjs' : file === 'wardrobe/WardrobeAgency.js' ? './WardrobeAgency.mjs' : pathToFileURL( path.join( root, 'packages/core/src', file ) ).href );
const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { Figure } = await loadModule( 'figure/Figure.js' );
const { GarmentManifest } = await loadModule( 'wardrobe/GarmentManifest.js' );
const { Wardrobe } = await loadModule( 'wardrobe/Wardrobe.js' );
const { FoundationLayer } = await loadModule( 'wardrobe/FoundationLayer.js' );
const { WardrobeAgency, MemoryStore } = await loadModule( 'wardrobe/WardrobeAgency.js' );

const startedAt = new Date().toISOString();
const checks = [];
function check( name, action ) { action(); checks.push( name ); }
async function loadGltf( file ) {

    const bytes = fs.readFileSync( file );
    const buffer = bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength );
    return new Promise( ( resolve, reject ) => new GLTFLoader().parse( buffer, '', resolve, reject ) );

}
const manifestPath = path.join( root, 'assets/wardrobe/manifest.json' );
const manifest = new GarmentManifest( JSON.parse( fs.readFileSync( manifestPath, 'utf8' ) ), pathToFileURL( manifestPath ).href );
const foundation = new FoundationLayer( manifest, {} );
let floor = foundation.floor();
const figure = new Figure( await loadGltf( path.join( root, 'assets/wardrobe/body/g050.glb' ) ) );
const wardrobe = new Wardrobe( figure, manifest, {
    decencyFloor: () => [ ...floor ],
    loadFragment: url => loadGltf( new URL( url ) )
} );
const casual = [ 'female_casualsuit01', 'shoes01' ];
const elegant = [ 'female_elegantsuit01', 'shoes01' ];
const recipes = [
    { id: 'elegant', label: 'Blouse + skirt', garments: [ ...elegant ] },
    { id: 'casual', label: 'Tee + denim', garments: [ ...casual ] }
];

try {

    const chooser = new CatalogueDresser( wardrobe, recipes );
    check( 'actual manifest selects both declared recipes and the live foundation', () => {
        const rows = chooser.catalogue();
        assert.deepEqual( rows.map( row => row.formality ), [ 4, 2 ] );
        for ( const row of rows ) for ( const id of floor ) assert.ok( row.garments.includes( id ) );
        assert.deepEqual( chooser.choose( { formality: 2 } ), wardrobe.validateOutfit( casual ) );
        assert.deepEqual( chooser.choose( { formality: 4 } ), wardrobe.validateOutfit( elegant ) );
    } );
    check( 'constructor inputs and catalogue/choice outputs cannot rewrite stored recipes', () => {
        recipes[ 0 ].label = 'changed'; recipes[ 0 ].garments.length = 0;
        const rows = chooser.catalogue(); rows[ 0 ].label = 'changed again'; rows[ 0 ].garments.length = 0;
        chooser.choose( { formality: 4 } ).length = 0;
        assert.equal( chooser.catalogue()[ 0 ].label, 'Blouse + skirt' );
        assert.deepEqual( chooser.choose( { formality: 4 } ), wardrobe.validateOutfit( elegant ) );
    } );
    check( 'invalid preferences leave the wardrobe and previous explanation unchanged', () => {
        const before = [ ...wardrobe.worn ], reason = chooser.explain();
        for ( const value of [ 0, 6, 2.5, NaN, Infinity, '4', null ] ) assert.throws( () => chooser.choose( { formality: value } ), /integer/ );
        assert.throws( () => chooser.choose( null ), /integer/ );
        assert.deepEqual( wardrobe.worn, before ); assert.equal( chooser.explain(), reason );
    } );
    check( 'a valid foundation/footwear set is refused as incomplete outer clothing', () => {
        assert.ok( wardrobe.validateOutfit( [ 'shoes01' ] ).includes( 'foundation_bra' ) );
        assert.throws( () => new CatalogueDresser( wardrobe, [ { id: 'incomplete', label: 'Incomplete', garments: [ 'shoes01' ] } ] ), /complete declared outer/ );
    } );
    check( 'actual conflict and unknown-garment policy is retained', () => {
        assert.throws( () => new CatalogueDresser( wardrobe, [ { id: 'conflict', label: 'Conflict', garments: [ ...casual, ...elegant ] } ] ), /cannot be worn/ );
        assert.throws( () => new CatalogueDresser( wardrobe, [ { id: 'missing', label: 'Missing', garments: [ 'absent-garment' ] } ] ) );
    } );
    check( 'a sparse catalogue refuses before it can create an empty candidate', () => {
        assert.throws( () => new CatalogueDresser( wardrobe, new Array( 1 ) ), /dense array/ );
    } );
    check( 'changed live floor replaces prior foundation ids in each proposal', () => {
        floor = [ 'foundation_vest', 'foundation_boxer_brief' ];
        const proposal = chooser.choose( { formality: 2 } );
        for ( const id of floor ) assert.ok( proposal.includes( id ) );
        assert.ok( !proposal.includes( 'foundation_bra' ) && !proposal.includes( 'foundation_briefs' ) );
        floor = foundation.floor();
    } );
    check( 'changed unsupported figure policy refuses without changing the last explanation', () => {
        const reason = chooser.explain(); wardrobe.figureKey = 'g100';
        try { assert.throws( () => chooser.choose( { formality: 2 } ), /no fragment for figure/ ); }
        finally { wardrobe.figureKey = 'g050'; }
        assert.equal( chooser.explain(), reason );
    } );
    check( 'an unresolved tie preserves caller order', () => {
        assert.deepEqual( chooser.choose( { formality: 3 } ), wardrobe.validateOutfit( elegant ) );
        assert.match( chooser.explain(), /catalogue order/ );
    } );

    const agency = new WardrobeAgency( wardrobe, { dresser: chooser, store: new MemoryStore(), profile: 'catalogue-test', clock: () => 1_000_000 } );
    await agency.wake();
    await agency.pin( casual, { by: 'user' } );
    check( 'a tie preserves the actual currently worn candidate', () => {
        assert.deepEqual( chooser.choose( { formality: 3 } ), wardrobe.validateOutfit( casual ) );
        assert.match( chooser.explain(), /current recipe/ );
    } );
    const mood = { layer: 'mood', pleasure: 0.2, arousal: 0.1, dominance: 0 };
    const before = [ ...wardrobe.worn ];
    await agency.consider( { formality: 4, mood } );
    check( 'real pinned agency records a different proposal and leaves the actual outfit alone', () => {
        assert.equal( agency.mode, 'pinned' ); assert.deepEqual( wardrobe.worn, before );
        const preference = agency.preferences.at( -1 );
        assert.deepEqual( preference.outfit, wardrobe.validateOutfit( elegant ) );
        assert.equal( preference.honoured, false ); assert.match( preference.reason, /authored catalogue/ );
    } );
    await agency.consider( { formality: 2, mood } );
    check( 'canonical floor inclusion recognizes a proposal already worn', () => {
        assert.equal( agency.preferences.at( -1 ).differsFromWorn, false );
        assert.deepEqual( wardrobe.worn, before );
    } );
    console.log( JSON.stringify( { startedAt, completedAt: new Date().toISOString(), pid: process.pid, checks, passed: checks.length, scope: 'CPU policy/agency only; 1x1 image stubs; no rendered fit or mood/climate qualification' }, null, 2 ) );

} finally {

    wardrobe.dispose(); figure.dispose();

}
