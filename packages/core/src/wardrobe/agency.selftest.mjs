/**
 * The measured gate for punch-list 9.13 — agency, and its limits.
 *
 *   node packages/core/src/wardrobe/agency.selftest.mjs
 *
 * Run against the real wardrobe build, not a fixture, because two of the four things being proved
 * are about what ends up on the figure: that no mode can violate 9.8, and that a pinned outfit is
 * still on the body after a restart.
 *
 * ## WHAT THE PUNCH LIST ASKS FOR, AND WHERE EACH ONE IS
 *
 *   `pinned` survives a reload, a PAD swing, a season change and a restart   → §2
 *   `agent` never changes outfit more than once per mood period              → §3
 *   no mode can violate 9.8                                                  → §4
 *   proven red by a Dresser call that ignores the pin                        → §5
 *
 * ## THE TWO THINGS THAT MAKE THIS MEASURABLE AT ALL
 *
 * **The clock is injected.** A mood period is ten minutes. A gate that waited for one would take
 * an hour to prove the hysteresis and would be the slowest thing in the repo; a gate that shortened
 * the period to prove it would be testing a different constant from the one that ships.
 * `WardrobeAgency` takes `clock`, the shipped `MOOD_CHANGE_PERIOD_MS` is used unmodified, and the
 * trace below runs sixty simulated minutes in milliseconds of real time.
 *
 * **The store is a string.** Persistence is proved by constructing a SECOND agency over the same
 * serialised bytes rather than by reading the first one's fields — a restart is a new object built
 * from a string, and anything that survives only in memory is not persistence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { Figure } = await import( '../figure/Figure.js' );
const { GarmentManifest } = await import( './GarmentManifest.js' );
const { Wardrobe } = await import( './Wardrobe.js' );
const { FoundationLayer } = await import( './FoundationLayer.js' );
const {
    WardrobeAgency, MemoryStore, AGENCY_MODES, DEFAULT_MODE, MOOD_LAYER,
    MOOD_CHANGE_PERIOD_MS, MOOD_RETURN_PERIOD_MS, STORE_KEY_PREFIX
} = await import( './WardrobeAgency.js' );

const repoRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );
const MANIFEST_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'manifest.json' );
const BODY_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'body', 'g050.glb' );

const MINUTE_MS = 60 * 1000;

const results = [];

function record( ok, label, detail ) {

    results.push( { ok, label, detail } );
    console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ label }${ detail ? ` — ${ detail }` : '' }` );

}

// --- the rig ---------------------------------------------------------------------------------------

async function loadGltf( filePath ) {

    const file = fs.readFileSync( filePath );
    const buffer = file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength );

    return new Promise( ( resolve, reject ) => {
        new GLTFLoader().parse( buffer, '', resolve, reject );
    } );

}

const manifestSource = JSON.parse( fs.readFileSync( MANIFEST_PATH, 'utf8' ) );
const manifestUrl = pathToFileURL( MANIFEST_PATH ).href;

/**
 * A stand-in for 9.11's `Dresser`, and it says so.
 *
 * ⚠️ 9.11 is not built. This is deliberately NOT a preview of it — it implements no clo arithmetic,
 * no Schiavon & Lee equation, no colour mapping. It is the smallest object that satisfies the
 * interface `WardrobeAgency` needs, so that what is being measured here is the AGENCY and not
 * somebody's outfit taste. When 9.11 lands it drops into the same seam.
 */
class ScriptedDresser {

    constructor( outfits ) {

        this.outfits = outfits;
        this.calls = 0;

    }

    choose() {

        const outfit = this.outfits[ this.calls % this.outfits.length ];
        this.calls += 1;
        return [ ...outfit ];

    }

    explain() {

        return 'a scripted stand-in for 9.11; it cycles a fixed list and has no opinion at all';

    }

}

/** A mood reading at the MOOD layer, which is the only layer selection may read. */
function mood( pleasure, arousal, dominance ) {

    return { layer: MOOD_LAYER, pleasure, arousal, dominance };

}

function context( overrides = {} ) {

    return {
        mood: mood( 0.2, 0.1, 0.0 ),
        temperatureC: 18,
        formality: 2,
        timeOfDay: 'afternoon',
        ...overrides
    };

}

/** A wardrobe over the real body, with the real foundation floor. */
async function buildRig( options = {} ) {

    const manifest = new GarmentManifest( manifestSource, manifestUrl );
    const foundation = new FoundationLayer( manifest, {} );
    const figure = new Figure( await loadGltf( BODY_PATH ) );

    const wardrobe = new Wardrobe( figure, manifest, {
        decencyFloor: foundation.floor,
        loadFragment: ( url ) => loadGltf( fileURLToPath( url ) )
    } );

    const clock = { now: 1_000_000 };
    const store = options.store ?? new MemoryStore();

    const agency = new WardrobeAgency( wardrobe, {
        dresser: options.dresser ?? new ScriptedDresser( [ [ 'female_casualsuit01', 'shoes01' ] ] ),
        store,
        profile: options.profile ?? 'gate',
        clock: () => clock.now
    } );

    // Woken, as any real caller does: an agency that has never dressed the figure has an empty
    // `worn` and a body that is not drawn, which is decent but is not the state under test.
    await agency.wake();

    return { manifest, foundation, wardrobe, agency, store, clock };

}

/** Whether the decency floor is on the figure. The bookkeeping half of 9.8; geometry is 9.8's gate. */
function floorIsWorn( rig ) {

    return rig.foundation.currentFloor().every( ( id ) => rig.wardrobe.worn.includes( id ) );

}

// --- main ---------------------------------------------------------------------------------------------

console.log( '='.repeat( 78 ) );
console.log( 'agency selftest — punch-list 9.13' );
console.log( '='.repeat( 78 ) );

const missing = [ MANIFEST_PATH, BODY_PATH ].filter( ( candidate ) => fs.existsSync( candidate ) === false );

if ( missing.length > 0 ) {

    for ( const candidate of missing ) console.log( `  SKIP ${ path.relative( repoRoot, candidate ) } — not built` );
    console.log( 'FAIL — build the wardrobe artefacts first.' );
    process.exit( 1 );

}

// --- §1 the default, and the voice -----------------------------------------------------------------------

console.log( '' );
console.log( '--- 1. the first run, and the preference that works in every mode ---' );

const first = await buildRig();

record( first.agency.mode === DEFAULT_MODE && DEFAULT_MODE === 'pinned',
    'a fresh store produces a PINNED agency',
    `mode ${ first.agency.mode }; an avatar does not change its own appearance before it is asked` );

record( first.store.read( `${ STORE_KEY_PREFIX }:gate` ) === null,
    'and it did so with nothing written yet — the default is the code\'s, not a stored value' );

// 🎯 The preference, in the mode that refuses to act on it.
const pinnedPreference = first.agency.expressPreference( context() );

record( pinnedPreference.outfit.length > 0 && pinnedPreference.mode === 'pinned',
    'the AI states a preference while PINNED',
    `"${ pinnedPreference.reason }" -> ${ pinnedPreference.outfit.join( ', ' ) }` );

record( first.agency.unheardPreferences().length === 1,
    'and it is kept rather than discarded',
    `${ first.agency.unheardPreferences().length } unheard preference on the record` );

let moodGuardCaught = false;

try {

    first.agency.expressPreference( { mood: { layer: 'affect', pleasure: 0, arousal: 0, dominance: 0 } } );

} catch ( error ) {

    moodGuardCaught = /affect layer/.test( error.message );

}

record( moodGuardCaught,
    'RED: an AFFECT-layer reading is refused, not used',
    'the affect layer has a 150-250 ms attack; selection on it changes clothes mid-sentence' );

for ( const call of [
    () => first.agency.setMode( 'agent' ),
    () => first.agency.pin( [] ),
    () => first.agency.confirm( 'x' )
] ) {

    let refused = false;
    try { await call(); } catch ( error ) { refused = /user/.test( error.message ); }
    if ( refused === false ) record( false, 'the user owns the switch', 'an agent-initiated call was accepted' );

}

record( results.every( ( result ) => result.label !== 'the user owns the switch' ),
    'the user owns the switch — setMode, pin and confirm all refuse without { by: \'user\' }' );

// --- §2 pinned survives everything ---------------------------------------------------------------------

console.log( '' );
console.log( '--- 2. pinned survives a reload, a PAD swing, a season change and a restart ---' );

const pinned = await buildRig( { dresser: new ScriptedDresser( [
    [ 'female_elegantsuit01' ], [ 'female_casualsuit01', 'fedora01' ]
] ) } );

await pinned.agency.pin( [ 'female_casualsuit01', 'shoes01' ], { by: 'user' } );
const pinnedOutfit = [ ...pinned.wardrobe.worn ];

record( pinned.agency.mode === 'pinned' && pinnedOutfit.includes( 'female_casualsuit01' ),
    'the user pins an outfit', pinnedOutfit.join( ', ' ) );

// A PAD swing: every corner of the mood cube, and a season change with it.
const swings = [];

for ( const pleasure of [ -1, 1 ] ) {
    for ( const arousal of [ -1, 1 ] ) {
        for ( const dominance of [ -1, 1 ] ) {
            for ( const temperatureC of [ -20, 0, 20, 40 ] ) {

                pinned.clock.now += 30 * MINUTE_MS;
                const outcome = await pinned.agency.consider(
                    context( { mood: mood( pleasure, arousal, dominance ), temperatureC } ) );
                swings.push( outcome );

            }
        }
    }
}

record( swings.every( ( outcome ) => outcome.applied === false && outcome.status === 'pinned' ),
    `${ swings.length } PAD corners x season steps, and none of them changed the outfit`,
    'eight corners of the mood cube at -20, 0, 20 and 40 degrees, thirty simulated minutes apart' );

record( JSON.stringify( pinned.wardrobe.worn ) === JSON.stringify( pinnedOutfit ),
    'the figure is still wearing exactly what was pinned', pinned.wardrobe.worn.join( ', ' ) );

record( pinned.agency.unheardPreferences().length === swings.length,
    'and it said what it would have worn every single time',
    `${ pinned.agency.unheardPreferences().length } preferences expressed and not honoured` );

// A reload: a new agency over the same store object.
const reloaded = new WardrobeAgency( pinned.wardrobe, {
    dresser: new ScriptedDresser( [ [ 'fedora01' ] ] ),
    store: pinned.store,
    profile: 'gate',
    clock: () => pinned.clock.now
} );

record( reloaded.mode === 'pinned' &&
        JSON.stringify( reloaded.pinnedOutfit ) === JSON.stringify( pinnedOutfit ),
    'a RELOAD restores the mode and the pinned outfit',
    `${ reloaded.mode }: ${ reloaded.pinnedOutfit.join( ', ' ) }` );

// A restart: a new store built from the serialised bytes, and a new figure.
const serialised = pinned.store.read( `${ STORE_KEY_PREFIX }:gate` );
const restarted = await buildRig( {
    store: new MemoryStore( { [ `${ STORE_KEY_PREFIX }:gate` ]: serialised } ),
    dresser: new ScriptedDresser( [ [ 'fedora01' ] ] )
} );

await restarted.agency.wake();

record( restarted.agency.mode === 'pinned' &&
        pinnedOutfit.every( ( id ) => restarted.wardrobe.worn.includes( id ) ),
    'a RESTART wakes the figure in the clothes it went to sleep in',
    `${ serialised.length } bytes of state; worn ${ restarted.wardrobe.worn.join( ', ' ) }` );

record( floorIsWorn( restarted ),
    'and the foundation layer came back with it',
    restarted.foundation.currentFloor().join( ', ' ) );

// --- §3 agent mode, and the mood period ------------------------------------------------------------------

console.log( '' );
console.log( '--- 3. agent mode changes at most once per mood period ---' );

const agent = await buildRig( { dresser: new ScriptedDresser( [
    [ 'female_casualsuit01', 'shoes01' ],
    [ 'female_elegantsuit01', 'fedora01' ],
    [ 'shoes01', 'fedora01' ]
] ) } );

agent.agency.setMode( 'agent', { by: 'user' } );

const traceMinutes = 60;
const applied = [];
const decencyBreaks = [];

for ( let minute = 0; minute < traceMinutes; minute += 1 ) {

    agent.clock.now += MINUTE_MS;

    // A mood that moves every minute, which is what the affect layer would do to it and what the
    // mood layer is supposed to absorb.
    const swing = Math.sin( minute / 3 );
    const outcome = await agent.agency.consider( context( { mood: mood( swing, -swing, swing / 2 ) } ) );

    if ( outcome.applied ) applied.push( minute );
    if ( floorIsWorn( agent ) === false ) decencyBreaks.push( minute );

}

const maximumChanges = Math.ceil( traceMinutes * MINUTE_MS / MOOD_CHANGE_PERIOD_MS );

record( applied.length <= maximumChanges,
    `${ applied.length } outfit changes in ${ traceMinutes } simulated minutes, at most ` +
    `${ maximumChanges } allowed`,
    `changes at minute ${ applied.join( ', ' ) }; the mood period is ` +
    `${ MOOD_CHANGE_PERIOD_MS / MINUTE_MS } minutes and 60 decisions were asked for` );

const gaps = applied.slice( 1 ).map( ( minute, position ) => minute - applied[ position ] );

record( gaps.every( ( gap ) => gap * MINUTE_MS >= MOOD_CHANGE_PERIOD_MS ),
    'and no two changes are closer together than one mood period',
    gaps.length === 0 ? 'only one change' : `gaps of ${ gaps.join( ', ' ) } minutes` );

// 🚩 The RETURN period, which is a different constant and a different failure. Without it a mood
// sitting on a boundary flips between two outfits forever, one flip per change period — which the
// clause above would read as perfectly legal.
const returning = await buildRig( { dresser: new ScriptedDresser( [
    [ 'female_casualsuit01' ], [ 'female_elegantsuit01' ], [ 'female_casualsuit01' ]
] ) } );

returning.agency.setMode( 'agent', { by: 'user' } );

returning.clock.now += 11 * MINUTE_MS;
await returning.agency.consider( context() );          // -> casual suit
returning.clock.now += 11 * MINUTE_MS;
await returning.agency.consider( context() );          // -> elegant suit
returning.clock.now += 11 * MINUTE_MS;
const flipBack = await returning.agency.consider( context() );   // -> casual suit again, too soon

record( flipBack.applied === false && flipBack.status === 'mood-period',
    'RED: an outfit taken off cannot come back inside the return period',
    `${ flipBack.reason }; the change period is ${ MOOD_CHANGE_PERIOD_MS / MINUTE_MS } minutes and ` +
    `the return period is ${ MOOD_RETURN_PERIOD_MS / MINUTE_MS }, so 11 minutes clears one and not the other` );

// --- §4 no mode can violate 9.8 --------------------------------------------------------------------------

console.log( '' );
console.log( '--- 4. no mode can violate 9.8 ---' );

record( decencyBreaks.length === 0,
    `the foundation layer was on the figure at all ${ traceMinutes } steps of the agent trace`,
    agent.foundation.currentFloor().join( ', ' ) );

// A dresser that actively tries to undress the avatar, in every mode.
class StrippingDresser {

    choose() {

        return [];

    }

    explain() {

        return 'asks for nothing at all, which is the outfit 9.8 exists to make safe';

    }

}

const stripping = await buildRig( { dresser: new StrippingDresser() } );
const stripFailures = [];

for ( const mode of AGENCY_MODES ) {

    stripping.agency.setMode( mode, { by: 'user' } );
    stripping.clock.now += 30 * MINUTE_MS;

    const outcome = await stripping.agency.consider( context() );

    if ( mode === 'ask' && outcome.status === 'awaiting-user' ) {

        await stripping.agency.confirm( outcome.preference.at.toString(), { by: 'user' } );

    }

    if ( floorIsWorn( stripping ) === false ) {

        stripFailures.push( `${ mode }: worn ${ stripping.wardrobe.worn.join( ', ' ) || 'nothing' }` );

    }

}

record( stripFailures.length === 0,
    'a dresser asking for NOTHING leaves the foundation layer on, in all three modes',
    `worn ${ stripping.wardrobe.worn.join( ', ' ) } — dress() unions the floor into every outfit` );

// --- §5 ask mode, and the proposal ------------------------------------------------------------------------

console.log( '' );
console.log( '--- 5. ask mode proposes and waits ---' );

const asking = await buildRig( { dresser: new ScriptedDresser( [ [ 'female_elegantsuit01', 'fedora01' ] ] ) } );
asking.agency.setMode( 'ask', { by: 'user' } );
asking.clock.now += 30 * MINUTE_MS;

const before = [ ...asking.wardrobe.worn ];
const proposal = await asking.agency.consider( context() );

record( proposal.applied === false && proposal.status === 'awaiting-user' &&
        JSON.stringify( asking.wardrobe.worn ) === JSON.stringify( before ),
    'a proposal changes nothing until the user answers',
    `proposed ${ proposal.preference.outfit.join( ', ' ) }; still wearing ${ asking.wardrobe.worn.join( ', ' ) }` );

const confirmed = await asking.agency.confirm( proposal.preference.at.toString(), { by: 'user' } );

record( confirmed.applied && asking.wardrobe.worn.includes( 'female_elegantsuit01' ),
    'and everything the user confirms is applied', asking.wardrobe.worn.join( ', ' ) );

// 🚩 A confirmed preference must stop being an UNHEARD one, and the first build of `consider`
// spread the preference into the pending proposal — so `honoured` was set on a copy and the
// entry on the record stayed unheard forever. Nothing else in this file could see it.
record( asking.agency.unheardPreferences().length === 0,
    'and it is struck off the list of things the AI asked for and did not get',
    `${ asking.agency.state().preferencesExpressed } expressed, ` +
    `${ asking.agency.unheardPreferences().length } unheard` );

const declining = await buildRig( { dresser: new ScriptedDresser( [ [ 'female_elegantsuit01' ] ] ) } );
declining.agency.setMode( 'ask', { by: 'user' } );
declining.clock.now += 30 * MINUTE_MS;

const toDecline = await declining.agency.consider( context() );
declining.agency.decline( toDecline.preference.at.toString(), { by: 'user' } );

record( declining.wardrobe.worn.includes( 'female_elegantsuit01' ) === false &&
        declining.agency.unheardPreferences().length > 0,
    'a declined proposal is not applied, and is not forgotten either',
    `${ declining.agency.unheardPreferences().length } unheard preference kept on the record` );

// --- §6 THE RED THE PUNCH LIST NAMES ------------------------------------------------------------------------

console.log( '' );
console.log( '--- 6. RED: a Dresser call that ignores the pin ---' );

/**
 * 🚩 What this is actually simulating, and why it is not the same as `consider()` in pinned mode.
 *
 * `consider()` asks the agency, and the agency refuses. The failure worth gating is the one where
 * something ELSE holds the wardrobe and dresses it — a Dresser wired straight to `wardrobe.dress`,
 * a debug console, a second agency. The pin is not a lock on the wardrobe and cannot be; what it
 * can be is an invariant that something checks, and `pinHolds()` is that something.
 */
const bypassed = await buildRig( { dresser: new ScriptedDresser( [ [ 'female_elegantsuit01' ] ] ) } );

await bypassed.agency.pin( [ 'female_casualsuit01', 'shoes01' ], { by: 'user' } );

record( bypassed.agency.pinHolds(), 'the pin holds before anything goes round it' );

const rogue = bypassed.agency.dresser.choose( context() );
await bypassed.wardrobe.dress( rogue );

record( bypassed.agency.pinHolds() === false,
    'RED: a Dresser call straight to wardrobe.dress is CAUGHT',
    `pinned ${ bypassed.agency.pinnedOutfit.join( ', ' ) }, worn ` +
    `${ bypassed.wardrobe.worn.join( ', ' ) }` );

record( floorIsWorn( bypassed ),
    'and even the rogue outfit could not take the foundation layer off',
    bypassed.wardrobe.worn.join( ', ' ) );

await bypassed.agency.restorePin();

record( bypassed.agency.pinHolds() && bypassed.wardrobe.worn.includes( 'female_casualsuit01' ),
    'restorePin puts it back', bypassed.wardrobe.worn.join( ', ' ) );

/**
 * 🚩 A SECOND MECHANISM IN THE SAME CLASS. The one above changes the outfit behind the agency's
 * back; this one corrupts the agency's own memory of what was pinned, which is the failure a
 * `pinHolds()` reading its own field would be blind to. It reads the WARDROBE, so it sees it.
 */
const forgotten = await buildRig( { dresser: new ScriptedDresser( [ [ 'fedora01' ] ] ) } );
await forgotten.agency.pin( [ 'female_casualsuit01' ], { by: 'user' } );

forgotten.store.write( `${ STORE_KEY_PREFIX }:gate`, JSON.stringify( {
    version: 1,
    mode: 'pinned',
    pinnedOutfit: [ 'female_elegantsuit01' ],
    lastChangeAt: null,
    lastWornAt: {},
    preferences: []
} ) );

const woken = new WardrobeAgency( forgotten.wardrobe, {
    dresser: new ScriptedDresser( [ [ 'fedora01' ] ] ),
    store: forgotten.store,
    profile: 'gate',
    clock: () => forgotten.clock.now
} );

record( woken.pinHolds() === false,
    'RED: a stored pin that disagrees with what is worn is caught too',
    `stored ${ woken.pinnedOutfit.join( ', ' ) }, worn ${ forgotten.wardrobe.worn.join( ', ' ) }` );

// And a corrupt store must not produce an agent that starts changing clothes.
const corrupt = await buildRig( {
    store: new MemoryStore( { [ `${ STORE_KEY_PREFIX }:gate` ]: '{not json' } )
} );

record( corrupt.agency.mode === 'pinned',
    'a store it cannot parse leaves it PINNED rather than free',
    'an agency that has lost its memory should not take that as permission' );

// --- summary --------------------------------------------------------------------------------------------------

const failed = results.filter( ( result ) => result.ok === false );

console.log( '' );
console.log( '='.repeat( 78 ) );
console.log( failed.length === 0
    ? `PASS — ${ results.length } assertions.`
    : `FAIL — ${ failed.length } of ${ results.length }: ${ failed.map( ( result ) => result.label ).join( '; ' ) }` );

process.exit( failed.length === 0 ? 0 : 1 );
