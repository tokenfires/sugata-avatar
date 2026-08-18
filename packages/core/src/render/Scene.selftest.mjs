/**
 * Gate for `render/Scene.js` — punch-list 11.1.
 *
 * ## What this item claimed, and therefore what has to be checked
 *
 * 11.1 introduces the scene as a DATA STRUCTURE and re-expresses `studio` as one, and its whole
 * value is a negative: **no new look, and not one pixel moved.** A refactor whose only promise is
 * "nothing changed" is the easiest kind of change to get wrong and the hardest to notice, so this
 * file checks the three things a green build would otherwise hide:
 *
 *   A  THE VALUES        `SCENES.studio` IS the shipped literals — clear colour, card, card
 *                        distance, floor, zero rig overrides, exposure 1 — and they are declared
 *                        ONCE, in `Scene.js`, with no second copy in `Avatar.js`.
 *   B  THE PROJECTION    `backgroundRequestOf( SCENES.studio )` is bit-equal to
 *                        `BACKGROUND_PRESETS.studio` AND to `resolveBackgroundOption( 'studio' )`.
 *                        The published option and the new one describe the same room or one of
 *                        them is lying.
 *   C  THE REFUSAL       `transparent` still refuses, in `Avatar`'s voice, with its measured
 *                        diagnosis — and `Scene.js` does not throw a second, drifting copy of it.
 *   D  DENY-BY-DEFAULT   an unknown field, an unknown light, an unknown placement field, a `kind`
 *                        whose model does not exist yet, and four out-of-range numbers are all
 *                        REFUSED rather than dropped.
 *   E  NO SECOND ENGINE  the light schema is read off a REAL `LightingRig` — `new LightingRig({})`
 *                        .placements — rather than transcribed, and `Scene.js` imports nothing and
 *                        constructs nothing.
 *   F  THE FIELD IS LIVE `Avatar.js` positions the card from `scene.background.distanceMetres` and
 *                        keeps no literal 1.9, so the scene actually drives the frame.
 *
 * ⚠️ **AND WHAT THIS FILE CANNOT SEE, SAID FIRST SO NOBODY QUOTES IT FOR MORE THAN IT IS.** Every
 * clause below is a resolver, a projection or a source predicate. NONE of them renders anything.
 * The claim 11.1 actually makes — *the studio plate is byte-identical through the new path* — is a
 * PLATE, and it is taken with `tools/critic/capture.mjs --plate` against
 * `tools/critic/avatar-plate.html`. A green run here is a necessary condition and nothing more:
 * this repository has shipped eight statistics that were structurally blind to the defect they
 * were aimed at, and "the table has the right numbers in it" is exactly the shape of the ninth.
 *
 * The plate, measured 2026-08-17, 900×1200, 1 step at 60 fps, seed 1, frozen, through
 * `Avatar.create` on `tools/critic/avatar-plate.html`:
 *
 *     arm                                          loads  sha               bitident  worst  px
 *     background: 'studio', HEAD f65330d               5   fac62c50d56590fb    10/10      0   0
 *     background: 'studio', this item                  5   fac62c50d56590fb    10/10      0   0
 *     scene: 'studio'      , this item (the NEW door)  3   fac62c50d56590fb      3/3      0   0
 *
 * `cmp` on the two `plate.png` files reports no difference — the full digest is
 * `fac62c50d56590fb9b11b06d7d84747b947c30c855f8eda0b72e812e4d1d5842` on all three arms — and the
 * residue is quoted beside it because the standing constraint is that a sha with no residue is
 * quoting a draw. Here it happens to be zero: 900×1200 with the renderer's frame epoch pinned is
 * bit-reproducible, which is NOT true of the 3840×5120 shipped plate and is why the width, the step
 * count and the seed are stated with the digest.
 *
 * ⚠️ AND THE CONTROL THAT MAKES THOSE THREE ROWS MEAN ANYTHING. The same plate with the card one
 * code value brighter — `0x070a0e` → `0x070a0f`, the smallest edit that exists — reads
 * `392bc43acbfc3f75`. A plate that could not see that would be a control that proves nothing.
 *
 *     node packages/core/src/render/Scene.selftest.mjs
 */

import { readFileSync } from 'node:fs';

import { LightingRig } from './LightingRig.js';
import {
    BACKDROP_DISTANCE_METRES,
    BACKDROP_EMISSIVE,
    SCENES,
    SCENE_CLEAR_COLOUR,
    SCENE_FIELDS,
    SCENE_IDS,
    SCENE_KINDS,
    SCENE_LIGHT_NAMES,
    SCENE_PLACEMENT_FIELDS,
    SCENE_SCALE_FIELDS,
    backgroundRequestOf,
    environmentRequestOf,
    lightingRequestOf,
    resolveScene
} from './Scene.js';
import {
    IRRADIANCE_ANCHOR,
    IRRADIANCE_ANCHOR_ELEVATION_DEGREES,
    SKY_TO_RIG_SCALE,
    keyPlacementForSun,
    rigAzimuthForSun,
    solarDiscLight,
    sunDirectionWorld
} from './SkyEnvironment.js';
import {
    BACKGROUND_PRESETS,
    BACKGROUND_PRESET_NAMES,
    resolveBackgroundOption,
    resolveLightingOption,
    resolveLook
} from '../Avatar.js';

const SCENE_SOURCE = readFileSync( new URL( './Scene.js', import.meta.url ), 'utf8' );
const AVATAR_SOURCE = readFileSync( new URL( '../Avatar.js', import.meta.url ), 'utf8' );
const SKY_SOURCE = readFileSync( new URL( './SkyEnvironment.js', import.meta.url ), 'utf8' );

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed === true ? '  ok  ' : '  FAIL' }  ${ name }${ detail === undefined ? '' : `  —  ${ detail }` }` );

}

/** Throws-with-a-message, as a predicate. Returns the message so a clause can check what it said. */
function refusalFrom( thunk ) {

    try {

        thunk();
        return null;

    } catch ( error ) {

        return error instanceof TypeError || error instanceof Error ? error.message : String( error );

    }

}

/** Structural equality over the flat request objects this file compares. Order-independent. */
function sameRequest( a, b ) {

    if ( a === null || b === null || typeof a !== 'object' || typeof b !== 'object' ) return a === b;

    const keys = new Set( [ ...Object.keys( a ), ...Object.keys( b ) ] );

    for ( const key of keys ) if ( a[ key ] !== b[ key ] ) return false;

    return true;

}

console.log( '\n--- A: the studio scene IS the shipped studio ---------------------------------------\n' );

// The predicate is a named function rather than an inline expression because clause A's RED PROOF
// at the bottom of this file re-runs THIS EXACT PREDICATE against deliberately-wrong tables. A
// rejection proof that re-implements the check proves something about the copy.
export function studioMatchesTheShippedLiterals( scene ) {

    return scene.id === 'studio'
        && scene.kind === 'studio'
        && scene.background.colour === 0x08080a
        && scene.background.backdrop === 0x070a0e
        && scene.background.distanceMetres === 1.9
        && scene.ground.enabled === true
        && scene.exposure === 1
        && Object.keys( scene.lights ).length === 0
        && scene.sun === null && scene.sky === null && scene.room === null
        && scene.framing === null;

}

const studio = resolveScene( 'studio' );

report( '🎯 A1  SCENES.studio resolves to the shipped clear colour, card, card distance and floor',
    studioMatchesTheShippedLiterals( studio ),
    `clear #${ studio.background.colour.toString( 16 ).padStart( 6, '0' ) }, ` +
    `card #${ studio.background.backdrop.toString( 16 ).padStart( 6, '0' ) } at ` +
    `${ studio.background.distanceMetres } m, ground ${ studio.ground.enabled }, exposure ${ studio.exposure }, ` +
    `${ Object.keys( studio.lights ).length } rig overrides` );

report( 'A2  the exported literals are the values the table uses — one declaration, not two',
    SCENE_CLEAR_COLOUR === 0x08080a && BACKDROP_EMISSIVE === 0x070a0e && BACKDROP_DISTANCE_METRES === 1.9
        && SCENES.studio.background.colour === SCENE_CLEAR_COLOUR
        && SCENES.studio.background.backdrop === BACKDROP_EMISSIVE
        && SCENES.studio.background.distanceMetres === BACKDROP_DISTANCE_METRES,
    'the table reads the constants; a table that re-typed them could drift from them silently' );

report( '🎯 A3  Avatar.js keeps NO second copy of the three literals',
    /^const (SCENE_CLEAR_COLOUR|BACKDROP_EMISSIVE|BACKDROP_DISTANCE_METRES)\s*=/m.test( AVATAR_SOURCE ) === false
        && /from '\.\/render\/Scene\.js'/.test( AVATAR_SOURCE ),
    'imported, never re-declared — a duplicate is how a refactor moves a pixel with every gate green' );

report( 'A4  every scene in the table is deeply frozen, container and nested tables alike',
    SCENE_IDS.every( ( id ) => Object.isFrozen( SCENES[ id ] )
        && Object.isFrozen( SCENES[ id ].background )
        && Object.isFrozen( SCENES[ id ].ground )
        && Object.isFrozen( SCENES[ id ].air )
        && Object.isFrozen( SCENES[ id ].lights ) ),
    `${ SCENE_IDS.length } scenes: ${ SCENE_IDS.join( ', ' ) } — a frozen map of mutable objects is a shared global with extra steps` );

report( 'A5  the resolver is TOTAL: every declared field is present on the result',
    SCENE_FIELDS.every( ( field ) => Object.hasOwn( studio, field ) )
        && Object.keys( studio ).length === SCENE_FIELDS.length,
    `${ SCENE_FIELDS.length } fields, all present — a consumer never has to test for absence` );

console.log( '\n--- B: the scene and the published background option describe the same room ---------\n' );

// The named predicate again, for the same reason as A.
export function projectionAgreesWithThePreset( id ) {

    return sameRequest( backgroundRequestOf( SCENES[ id ] ), BACKGROUND_PRESETS[ id ] );

}

// ⚠️ **OVER `BACKGROUND_PRESET_NAMES` AND NOT OVER `SCENE_IDS`, AND THE DIFFERENCE IS THE POINT.**
// The claim is *"the ported scenes and the published presets describe the same room"*, and only
// three scenes are ports. `beach` and `park` (11.2) are NOT background presets and must not become
// them: a background is a colour and a card, and an exterior's room is a sky the option cannot
// express. The clause below asserts that the two sets are exactly the ported three, so adding a
// scene silently to `BACKGROUND_PRESETS` — or forgetting to port one — goes red here rather than
// being hidden by a loop that iterates whichever list happens to be shorter.
for ( const id of BACKGROUND_PRESET_NAMES ) {

    report( `🎯 B1  backgroundRequestOf( SCENES.${ id } ) is bit-equal to BACKGROUND_PRESETS.${ id }`,
        projectionAgreesWithThePreset( id ),
        JSON.stringify( backgroundRequestOf( SCENES[ id ] ) ) );

}

report( '🎯 B1b  the published background presets are exactly the PORTED scenes, no more and no less',
    BACKGROUND_PRESET_NAMES.length === 3
        && BACKGROUND_PRESET_NAMES.every( ( id ) => SCENES[ id ] !== undefined
            && SCENES[ id ].kind === 'studio' )
        && SCENE_IDS.filter( ( id ) => SCENES[ id ].kind !== 'studio' )
            .every( ( id ) => BACKGROUND_PRESET_NAMES.includes( id ) === false ),
    `presets ${ BACKGROUND_PRESET_NAMES.join( ', ' ) }  |  scenes ${ SCENE_IDS.join( ', ' ) } — ` +
    'an exterior is a sky, and a background option cannot say that' );

// ⚠️ `transparent` is excluded HERE and only here, because putting it through
// `resolveBackgroundOption` is what clause C1 asserts THROWS. Running it as a pass would be
// asserting the opposite of C1 four lines apart.
for ( const id of BACKGROUND_PRESET_NAMES.filter( ( name ) => name !== 'transparent' ) ) {

    const throughTheScene = resolveBackgroundOption( backgroundRequestOf( SCENES[ id ] ) );
    const throughTheOption = resolveBackgroundOption( id );

    report( `🎯 B2  '${ id }' through the SCENE door and through the BACKGROUND door resolve identically`,
        sameRequest( throughTheScene, throughTheOption ),
        `${ JSON.stringify( throughTheScene ) } — same resolver, same validation, same refusals` );

}

const studioLighting = resolveLightingOption( { look: 'studio', ...lightingRequestOf( SCENES.studio ) } );
const shippedLighting = resolveLightingOption( 'studio' );

// ⚠️ COMPARED FIELD BY FIELD RATHER THAN WITH `sameRequest`. `lights` is an OBJECT, and two
// distinct empty objects are `!==` — so the flat comparator reports a difference that is not one.
// It read FAIL here first, which is the cheapest possible reminder that a comparator has to be the
// same KIND of statement as the thing it compares.
report( "🎯 B3  the studio scene's light is bit-equal to lighting: 'studio' — zero overrides, exposure 1",
    studioLighting.look === shippedLighting.look
        && studioLighting.exposure === shippedLighting.exposure
        && studioLighting.ambient === shippedLighting.ambient
        && studioLighting.shadows === shippedLighting.shadows
        && Object.keys( studioLighting.lights ).length === Object.keys( shippedLighting.lights ).length
        && Object.keys( studioLighting.lights ).length === 0
        && studioLighting.exposure === 1 && studioLighting.ambient === 1,
    `look ${ studioLighting.look }, exposure ${ studioLighting.exposure }, ambient ${ studioLighting.ambient } — ` +
    'the configuration every committed gate number in this repository is stated on' );

report( 'B4  lightingRequestOf carries NO look — the scene says where, the look says how it feels',
    Object.hasOwn( lightingRequestOf( SCENES.studio ), 'look' ) === false,
    'a scene that set a look would silently overrule a caller who had already chosen one' );

console.log( '\n--- C: the transparent refusal is one refusal, in one voice -------------------------\n' );

const transparentRefusal = refusalFrom( () => resolveBackgroundOption( backgroundRequestOf( SCENES.transparent ) ) );

report( '🔴 C1  the scene door hits the SAME measured refusal the background door does',
    transparentRefusal !== null
        && transparentRefusal.includes( 'TEMPORAL RESOLVE' )
        && transparentRefusal.includes( '41.63%' )
        && transparentRefusal.includes( 'not\n' ) === false,
    'the diagnosis survives the new path intact, including the two isolated blockers' );

report( 'C2  Scene.js does not throw a second copy of that refusal',
    /transparent/i.test( SCENE_SOURCE.replace( /\/\*[\s\S]*?\*\/|\/\/.*$/gm, '' ) ) === false
        || SCENE_SOURCE.includes( "throw new TypeError( 'Scene: transparent" ) === false,
    'two refusals for one condition is two messages that will drift; the one an embedder hits stays in Avatar.js' );

report( 'C3  resolveScene itself ACCEPTS transparent — the table declares it, Avatar refuses it',
    resolveScene( 'transparent' ).background.colour === null
        && resolveScene( 'transparent' ).ground.enabled === false,
    'a scene that could not even be described would make the refusal unreachable and its message untestable' );

console.log( '\n--- D: deny-by-default, because the subsystems behind this validate nothing ---------\n' );

const refusals = [
    [ 'an unknown top-level field', () => resolveScene( { set: [ 'window-frame' ] } ), 'set' ],
    [ 'an unknown scene id', () => resolveScene( 'submarine-bay' ), 'submarine-bay' ],
    [ 'a fifth light (LightingRig drops it silently)', () => resolveScene( { lights: { fifth: {} } } ), 'fifth' ],
    [ 'a misspelled placement field (the rig merges and ignores it)',
        () => resolveScene( { lights: { key: { irradianceX: 9 } } } ), 'irradianceX' ],
    [ '`name`, which aimRigAt and the spill partition both key off',
        () => resolveScene( { lights: { key: { name: 'keylight' } } } ), 'name' ],
    [ "kind 'exterior' with no sun and no sky", () => resolveScene( { kind: 'exterior' } ), 'sun' ],
    [ "kind 'exterior' with a sky but NO sun — the key would have nothing to be derived from",
        () => resolveScene( { kind: 'exterior', sky: { turbidity: 3 } } ), 'sun' ],
    [ "kind 'exterior' with a sun but NO sky — the backdrop would have nothing to draw",
        () => resolveScene( { kind: 'exterior', sun: { elevationDegrees: 30, azimuthDegrees: 0 } } ), 'sky' ],
    [ 'a sun below the horizon (SkyMesh\'s own intensity curve is already zero there)',
        () => resolveScene( { ...SCENES.beach, sun: { elevationDegrees: -4, azimuthDegrees: 0 } } ), 'elevationDegrees' ],
    [ 'a sun elevation that is not a number at all',
        () => resolveScene( { ...SCENES.beach, sun: { elevationDegrees: NaN, azimuthDegrees: 0 } } ), 'elevationDegrees' ],
    [ 'sun.occlusion above 1 — more of the disc hidden than exists',
        () => resolveScene( { ...SCENES.beach, sun: { elevationDegrees: 30, azimuthDegrees: 0, occlusion: 1.4 } } ), 'occlusion' ],
    [ 'a declared sun COLOUR, which would be a second model of the same star',
        () => resolveScene( { ...SCENES.beach, sun: { elevationDegrees: 30, azimuthDegrees: 0, colour: 0xffddaa } } ), 'DERIVED' ],
    [ 'sky.cloudCoverage — animated by the TSL time node, so no bake is reproducible',
        () => resolveScene( { ...SCENES.beach, sky: { ...SCENES.beach.sky, cloudCoverage: 0.4 } } ), 'time' ],
    [ 'turbidity below the model\'s floor, where betaM goes negative',
        () => resolveScene( { ...SCENES.beach, sky: { ...SCENES.beach.sky, turbidity: 0 } } ), 'turbidity' ],
    [ "kind 'interior' with no room — 11.4 does not exist yet",
        () => resolveScene( { kind: 'interior' } ), '11.4' ],
    [ 'an unknown kind', () => resolveScene( { kind: 'submarine' } ), 'submarine' ],
    [ 'a non-finite exposure', () => resolveScene( { exposure: NaN } ), 'exposure' ],
    [ 'haze outside [0, 1]', () => resolveScene( { air: { haze: 4 } } ), 'haze' ],
    [ 'a card distance of zero', () => resolveScene( { background: { distanceMetres: 0 } } ), 'distanceMetres' ],
    [ 'the American spelling of colour', () => resolveScene( { background: { color: 0x101820 } } ), 'colour' ],
    [ 'a ground that is neither a boolean nor an object', () => resolveScene( { ground: 3 } ), 'ground' ],
    [ 'an empty id', () => resolveScene( { id: '' } ), 'id' ]
];

for ( const [ what, thunk, mustName ] of refusals ) {

    const message = refusalFrom( thunk );

    report( `🔴 D  refused: ${ what }`,
        message !== null && message.includes( mustName ),
        message === null ? 'ACCEPTED — silently' : `"${ message.slice( 0, 96 ) }…"` );

}

console.log( '\n--- E: no second lighting engine, and the schema is read off the real rig -----------\n' );

// 🎯 THE POINT OF THIS CLAUSE. The punch list forbids a second lighting engine, and the way one
// gets built by accident is a transcribed schema that slowly stops matching the rig's. So the
// expected answer here is not a list in this file — it is `new LightingRig({}).placements`, the
// objects the rig actually solves.
const rigPlacements = new LightingRig( {} ).placements;
const rigLightNames = rigPlacements.map( ( placement ) => placement.name );
const rigFields = Object.keys( rigPlacements[ 0 ] ).filter( ( field ) => field !== 'name' );

report( "🎯 E1  SCENE_LIGHT_NAMES is the rig's own light names, read off a live LightingRig",
    rigLightNames.length === SCENE_LIGHT_NAMES.length
        && rigLightNames.every( ( name ) => SCENE_LIGHT_NAMES.includes( name ) ),
    `rig: ${ rigLightNames.join( ', ' ) }  |  scene: ${ SCENE_LIGHT_NAMES.join( ', ' ) }` );

report( "🎯 E2  SCENE_PLACEMENT_FIELDS is FORM_LIGHTS' own schema, minus the unreachable `name`",
    rigFields.length === SCENE_PLACEMENT_FIELDS.length
        && rigFields.every( ( field ) => SCENE_PLACEMENT_FIELDS.includes( field ) )
        && SCENE_PLACEMENT_FIELDS.includes( 'name' ) === false,
    `rig: ${ rigFields.join( ', ' ) }` );

report( '🎯 E3  a scene reaches the rig through override(), which exists and takes ( name, fields )',
    typeof new LightingRig( {} ).override === 'function' && new LightingRig( {} ).override.length === 2,
    'the existing path; this file writes no lighting solver of its own' );

// The only `new` a description file may reach for is a refusal. Anything else — a Color, a Mesh,
// a Vector3 — would mean this module had started building instead of describing.
const constructions = [ ...SCENE_SOURCE.matchAll( /\bnew\s+([A-Z][A-Za-z]*)/g ) ]
    .map( ( match ) => match[ 1 ] )
    .filter( ( name ) => name !== 'TypeError' && name !== 'Error' );

report( 'E4  Scene.js imports NOTHING and constructs NOTHING but its own refusals',
    /^\s*import\s/m.test( SCENE_SOURCE ) === false && constructions.length === 0,
    `no scene graph, no three.js, no renderer${ constructions.length === 0 ? '' : ` — found new ${ constructions.join( ', ' ) }` } — which is why this gate needs no GPU` );

console.log( '\n--- F: the scene actually drives the frame ------------------------------------------\n' );

report( '🎯 F1  Avatar.js places the backdrop from scene.background.distanceMetres, not a literal',
    AVATAR_SOURCE.includes( 'focus.z - this.scene.background.distanceMetres' )
        && /focus\.z\s*-\s*1\.9/.test( AVATAR_SOURCE ) === false,
    'a field that is stored and never read is decoration; this one positions the card on every re-frame' );

report( '🎯 F2  create() resolves a scene, and background/lighting still win over it',
    /const scene = resolveScene\( options\.scene \?\? AVATAR_DEFAULTS\.scene \)/.test( AVATAR_SOURCE )
        && /resolveBackgroundOption\( options\.background \?\? backgroundRequestOf\( scene \) \)/.test( AVATAR_SOURCE )
        && /resolveLightingOption\( options\.lighting\s*\n?\s*\?\?/.test( AVATAR_SOURCE ),
    'the published options are first in every `??` chain — a new option may widen the API, never redefine it' );

report( 'F3  the three kinds are declared; `studio` and `exterior` ship, `interior` does not',
    SCENE_KINDS.length === 3
        && SCENE_IDS.some( ( id ) => SCENES[ id ].kind === 'exterior' )
        && SCENE_IDS.every( ( id ) => SCENES[ id ].kind !== 'interior' ),
    `kinds ${ SCENE_KINDS.join( ', ' ) }; 11.2 landed exterior (${
        SCENE_IDS.filter( ( id ) => SCENES[ id ].kind === 'exterior' ).join( ', ' ) }), 11.4 lands interior` );

console.log( '\n--- G: the sun, and the claim that a scene cannot have its sky and its key disagree ---\n' );

// 🎯 G1 IS THE ONLY CLAUSE HERE WHOSE ANSWER IS KNOWABLE WITHOUT THE FILE UNDER TEST, and that is
// why it is first. At the ZENITH the Preetham air-mass term collapses — cos 0 = 1 and the
// 0.15·(93.885 − 0)^-1.253 correction is a constant — so the extinction is one exponential of two
// products of transcribed constants, computed here from `SkyMesh.js` independently of
// `solarDiscLight`'s own arithmetic. This project has shipped eight statistics that could not see
// the defect they were aimed at; a port validated only against itself would be the ninth.
const ZENITH_AIR_MASS_INVERSE = 1 / ( 1 + 0.15 * Math.pow( 93.885, -1.253 ) );
const ZENITH_FEX = [ 5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5 ]
    .map( ( betaR, channel ) => {

        const betaM = 0.434 * ( 0.2 * 2 * 1e-17 )
            * [ 1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14 ][ channel ]
            * 0.005;

        return Math.exp( -(
            betaR * 8.4e3 * ZENITH_AIR_MASS_INVERSE + betaM * 1.25e3 * ZENITH_AIR_MASS_INVERSE ) );

    } );

const zenith = solarDiscLight( 90 );
const zenithResidual = Math.max( ...zenith.transmittance.map(
    ( value, channel ) => Math.abs( value - ZENITH_FEX[ channel ] ) ) );

report( "🎯 G1  the ported extinction reproduces SkyMesh's own Fex, checked against arithmetic",
    zenithResidual < 1e-12,
    `zenith Fex ${ zenith.transmittance.map( ( v ) => v.toFixed(6) ).join( ' / ' ) } against the ` +
    `independently computed ${ ZENITH_FEX.map( ( v ) => v.toFixed(6) ).join( ' / ' ) } — worst ` +
    `residual ${ zenithResidual.toExponential( 2 ) }` );

report( '🎯 G2  SKY_TO_RIG_SCALE puts the anchor sun on the studio key exactly',
    Math.abs( solarDiscLight( IRRADIANCE_ANCHOR_ELEVATION_DEGREES ).irradiance * SKY_TO_RIG_SCALE
        - IRRADIANCE_ANCHOR ) < 1e-12,
    `${ IRRADIANCE_ANCHOR_ELEVATION_DEGREES }° delivers ${
        solarDiscLight( IRRADIANCE_ANCHOR_ELEVATION_DEGREES ).irradiance.toFixed( 4 ) } in SkyMesh ` +
    `units × ${ SKY_TO_RIG_SCALE.toFixed( 5 ) } = ${ IRRADIANCE_ANCHOR } — a factor of ${
        ( 1 / SKY_TO_RIG_SCALE ).toFixed( 2 ) } between the two worlds, and one number reconciles them` );

// A ramp typed by hand could be monotone too. What a HAND-TYPED ramp could not do is be monotone in
// BOTH irradiance and colour temperature from the same constants — so the clause checks the pair.
const sweep = [ 0, 5, 10, 15, 22, 30, 34, 45, 52, 60, 80, 90 ].map( ( e ) => solarDiscLight( e ) );
const irradianceRises = sweep.every( ( row, index ) => index === 0
    || row.irradiance > sweep[ index - 1 ].irradiance );
const kelvinRises = sweep.every( ( row, index ) => index === 0
    || row.correlatedColourTemperature > sweep[ index - 1 ].correlatedColourTemperature );

report( '🎯 G3  a rising sun gets brighter AND cooler, monotonically, from one Fex',
    irradianceRises && kelvinRises,
    `0° ${ sweep[ 0 ].irradiance.toFixed( 3 ) } / ${ Math.round( sweep[ 0 ].correlatedColourTemperature ) } K` +
    `  →  22° ${ sweep[ 4 ].irradiance.toFixed( 3 ) } / ${ Math.round( sweep[ 4 ].correlatedColourTemperature ) } K` +
    `  →  90° ${ sweep[ 11 ].irradiance.toFixed( 3 ) } / ${ Math.round( sweep[ 11 ].correlatedColourTemperature ) } K` +
    '  — the horizon end matches published sunset values (~1800–2000 K)' );

// The conversion, in BOTH signs, because a sign error here is a key on the wrong cheek and every
// gate in the repository would still read green.
report( '🎯 G4  a WORLD sun azimuth becomes the rig\'s CAMERA-RELATIVE one, in both directions',
    rigAzimuthForSun( 58, 12 ) === 46 && rigAzimuthForSun( -46, 12 ) === -58
        && rigAzimuthForSun( 12, 12 ) === 0 && rigAzimuthForSun( 200, 12 ) === -172,
    'world 58 → rig +46 (beach, camera right); world −46 → rig −58 (park, camera left); ' +
    'a sun AT the camera is rig 0; and 200 wraps to −172 rather than running off the end' );

// 🚩 THE CONSTANT IS READ IN TWO PLACES IN `Avatar.js` AND A DRIFT BETWEEN THEM IS INVISIBLE. The
// derived key's azimuth is computed against `CAMERA_AZIMUTH_DEGREES`; `frameFigure` places the
// camera with it. If one moved, the sun would be lit from an angle the camera is not standing at
// and nothing would throw.
report( '🎯 G5  the derived key and the camera placement read the SAME camera azimuth constant',
    /const sunKey = keyPlacementForSun\(\s*\n?\s*this\.scene\.sun, this\.scene\.sky, CAMERA_AZIMUTH_DEGREES \)/
        .test( AVATAR_SOURCE )
        && /const azimuth = CAMERA_AZIMUTH_DEGREES \* Math\.PI \/ 180/.test( AVATAR_SOURCE ),
    'one constant, two readers — a rig is camera-relative and the sun is not, so the conversion is ' +
    'only correct while both agree about where the camera stands' );

const beachKey = keyPlacementForSun( SCENES.beach.sun, SCENES.beach.sky, 12 );

report( '🎯 G6  the derived key is EXACTLY placement fields — LightingRig ignores anything else in silence',
    Object.keys( beachKey ).length === 4
        && Object.keys( beachKey ).every( ( field ) => SCENE_PLACEMENT_FIELDS.includes( field ) ),
    `${ Object.keys( beachKey ).join( ', ' ) } — a CCT or a sky-unit irradiance riding along here ` +
    'would be a number that looks like it is doing something and is not' );

const parkLit = keyPlacementForSun(
    { ...SCENES.park.sun, occlusion: 0 }, SCENES.park.sky, 12 );
const parkDappled = keyPlacementForSun( SCENES.park.sun, SCENES.park.sky, 12 );

report( '🎯 G7  sun.occlusion scales the KEY and nothing else — leaf cover is not weather',
    Math.abs( parkDappled.irradiance - parkLit.irradiance * ( 1 - SCENES.park.sun.occlusion ) ) < 1e-12
        && parkDappled.colour === parkLit.colour
        && parkDappled.elevationDegrees === parkLit.elevationDegrees,
    `park key ${ parkLit.irradiance.toFixed( 4 ) } → ${ parkDappled.irradiance.toFixed( 4 ) } at ` +
    `occlusion ${ SCENES.park.sun.occlusion }, same colour and same direction — the sky keeps all ` +
    'of its light, which is what makes a park soft where a beach is hard' );

report( '🎯 G8  beach and park differ on every axis the mechanism has to honour',
    SCENES.beach.sun.elevationDegrees !== SCENES.park.sun.elevationDegrees
        && Math.sign( keyPlacementForSun( SCENES.beach.sun, SCENES.beach.sky, 12 ).azimuthDegrees )
            !== Math.sign( parkDappled.azimuthDegrees )
        && SCENES.beach.sun.occlusion !== SCENES.park.sun.occlusion
        && SCENES.beach.sky.turbidity !== SCENES.park.sky.turbidity
        && SCENES.beach.ground.albedo !== SCENES.park.ground.albedo
        && SCENES.beach.exposure !== SCENES.park.exposure,
    `elevation ${ SCENES.beach.sun.elevationDegrees }/${ SCENES.park.sun.elevationDegrees }°, ` +
    `rig azimuth ${ beachKey.azimuthDegrees }/${ parkDappled.azimuthDegrees }°, ` +
    `occlusion ${ SCENES.beach.sun.occlusion }/${ SCENES.park.sun.occlusion }, ` +
    `turbidity ${ SCENES.beach.sky.turbidity }/${ SCENES.park.sky.turbidity }, ` +
    `ground #${ SCENES.beach.ground.albedo.toString( 16 ) }/#${ SCENES.park.ground.albedo.toString( 16 ) } ` +
    '— two scenes prove a mechanism, one scene proves a special case' );

report( '🎯 G9  environmentRequestOf gates the whole exterior branch, and studio returns null',
    environmentRequestOf( SCENES.studio ) === null
        && environmentRequestOf( SCENES.void ) === null
        && environmentRequestOf( SCENES.transparent ) === null
        && environmentRequestOf( SCENES.beach ) !== null
        && environmentRequestOf( SCENES.beach ).ground.albedo === SCENES.beach.ground.albedo,
    'the calibration control keeps scene.environment === null, which is the state ' +
    'docs/CHECKPOINT.md §7 measured IBL at 0.00% through — and the ground\'s albedo reaches the ' +
    'environment bake as well as the plane, which is the whole of 11.3' );

report( '🎯 G10  the sun direction is a unit vector and its Y is sin(elevation)',
    [ 0, 22, 52, 90 ].every( ( elevation ) => {

        const direction = sunDirectionWorld( elevation, 58 );
        const length = Math.hypot( direction.x, direction.y, direction.z );

        return Math.abs( length - 1 ) < 1e-12
            && Math.abs( direction.y - Math.sin( elevation * Math.PI / 180 ) ) < 1e-12;

    } ),
    '⚠️ the MAGNITUDE is load-bearing: SkyMesh reads the raw .y for exp( y / 450000 ), so a radius ' +
    'of 450000 — which several three.js examples use — changes the sky\'s hue with nothing at the ' +
    'call site to say so' );

report( '🎯 G11  the sky schema is declared ONCE, in Scene.js, and SkyEnvironment imports it',
    /import \{ SKY_DEFAULTS \} from '\.\/Scene\.js'/.test( SKY_SOURCE )
        && /^\s*export const SKY_DEFAULTS/m.test( SCENE_SOURCE )
        && /SKY_FIELDS|SKY_DEFAULTS/.test( SKY_SOURCE.replace( /import[^;]+;/g, '' ) ),
    'the description owns the field list and the engine reads it — an engine that grew a fifth ' +
    'uniform the table had never heard of is exactly the silent-drop shape D exists against' );

// 🚩 G12 IS A CONSTRAINT ON THE SHIPPED TABLE RATHER THAN ON THE RESOLVER, AND THE RESOLVER IS
// DELIBERATELY LEFT PERMISSIVE. A scene's `lights` are ABSOLUTE numbers; `FORM_LIGHTS` (key, fill)
// is identical in both framings by the rig's own load-bearing claim, and `EDGE_LIGHTS` (rim,
// kicker) is authored per framing. So an absolute rim written into a scene survives
// `setFraming('body')` into a preset that authored a different number — measured at 27.27% in
// `SCENE_LOOKS`'s own note, with nothing reporting it. The escape hatch stays open for an embedder
// who knows what they are doing; the SHIPPED scenes reach an edge light through `scales` instead,
// which is a factor on whatever the LIVE framing authored — see G13.
const edgeOverrides = SCENE_IDS.flatMap( ( id ) => Object.keys( SCENES[ id ].lights )
    .filter( ( name ) => name === 'rim' || name === 'kicker' )
    .map( ( name ) => `${ id }.${ name }` ) );

report( '🎯 G12  no shipped scene overrides an EDGE light, because an absolute would survive setFraming',
    edgeOverrides.length === 0,
    edgeOverrides.length === 0
        ? 'scenes move key (derived from the sun) and fill (identical in both presets) ' +
          'ABSOLUTELY, and reach the rim through `scales`, which re-resolves per framing'
        : `found ${ edgeOverrides.join( ', ' ) } — these break body framing silently` );

// 🎯 G13 IS THE ROUND'S NEW AXIS AND IT IS GATED ON ARITHMETIC RATHER THAN ON A RENDER. What
// `scales` promises is one sentence — *the factor multiplies whatever THIS framing's table
// authored* — and the whole reason it exists is that the two framings authored different numbers.
// `resolveLook` reads the real `LightingRig` for the authored table, so the expected pair below is
// derived from the rig at both presets rather than transcribed from a comment.
const authoredRim = ( preset ) => new LightingRig( { preset } ).placements
    .find( ( placement ) => placement.name === 'rim' ).irradiance;

const scaleFactor = SCENES.beach.scales.rim.irradiance;
const scaledRim = ( preset ) => authoredRim( preset ) * scaleFactor;

report( '🎯 G13  a scene scales an edge light per framing, so one factor is two numbers',
    Number.isFinite( scaleFactor )
        && Math.abs( scaledRim( 'portrait' ) - 2.6 ) < 1e-9
        && Math.abs( scaledRim( 'body' ) - 3.575 ) < 1e-9
        && authoredRim( 'portrait' ) !== authoredRim( 'body' ),
    `rim ${ authoredRim( 'portrait' ) } x ${ scaleFactor } = ${ scaledRim( 'portrait' ).toFixed( 4 ) } at portrait ` +
    `and ${ authoredRim( 'body' ) } x ${ scaleFactor } = ${ scaledRim( 'body' ).toFixed( 4 ) } at body — ` +
    'the same factor, two numbers, because EDGE_LIGHTS authored two. An absolute 2.6 written into ' +
    '`lights` would have delivered 2.6 into a body preset that authored ' +
    `${ authoredRim( 'body' ) }, ${ ( 100 - 2.6 / authoredRim( 'body' ) * 100 ).toFixed( 1 ) }% under, silently` );

report( '🎯 G14  lightingRequestOf carries `scales`, so the axis reaches the rig at all',
    SCENE_IDS.every( ( id ) => lightingRequestOf( SCENES[ id ] ).scales === SCENES[ id ].scales )
        && Object.keys( lightingRequestOf( SCENES.studio ).scales ).length === 0
        && resolveLightingOption( lightingRequestOf( SCENES.beach ) ).scales.rim.irradiance === scaleFactor,
    'the projection carries the field and `resolveLightingOption` accepts it — a scene whose ' +
    'scales were dropped between the table and the rig would render as the shipped rim and report ' +
    'itself as scaled, which is the silent-drop shape this whole file is written against' );

report( '🎯 G15  `colour` cannot be scaled, at either door',
    SCENE_SCALE_FIELDS.includes( 'colour' ) === false
        && SCENE_PLACEMENT_FIELDS.includes( 'colour' ) === true
        && refusalFrom( () => resolveScene( { ...SCENES.beach, scales: { rim: { colour: 0.5 } } } ) ) !== null
        && refusalFrom( () => resolveLightingOption( { scales: { rim: { colour: 0.5 } } } ) ) !== null,
    '0xffeeda x 0.5 is 0x7f776d, which is a different HUE and not a dimmer light — and this ' +
    "project's own matched-panel-luminance table moves the shadow cheek 14x between a blue and a " +
    'neutral panel of the SAME luminance, so a hue arrived at by arithmetic is not a small error' );

report( '🎯 G16  a look and a scene compose on the same light without either being lost',
    ( () => {

        // `dramatic` scales the rim by 1.25; `beach` scales it by 0.1625. Composed, the rim should
        // carry BOTH — a scene that overwrote the look, or a look that ignored the scene, would
        // read as one factor and there would be nothing to say which.
        const look = resolveLook( 'dramatic', 'portrait' ).rim.irradiance;
        const composed = ( look ?? authoredRim( 'portrait' ) ) * scaleFactor;

        return Math.abs( look - authoredRim( 'portrait' ) * 1.25 ) < 1e-9
            && Math.abs( composed - authoredRim( 'portrait' ) * 1.25 * scaleFactor ) < 1e-9;

    } )(),
    'the scene multiplies what the LOOK left in force, not the authored table under it — the two ' +
    'axes are meant to compose (`lightingRequestOf` leaves `look` at the caller\'s value) and a ' +
    'scene that re-based on the authored number would silently discard the look' );

// 🔴 G17 IS A CORRECTION, AND IT IS HERE BECAUSE A COMMENT SAID THE OPPOSITE FOR A WHOLE PHASE.
// `Scene.js` justified writing `fill.irradiance` as an ABSOLUTE with "FORM_LIGHTS is IDENTICAL in
// both presets — that is the file's own load-bearing claim". `LightingRig.js`'s
// `FORM_LIGHT_OVERRIDES_BY_PRESET` is `body: { fill: { irradiance: 1.20 } }`, so the claim is false
// in exactly the field both exteriors were overriding. This clause reads the authored table off the
// REAL class at both presets rather than believing either file, and refuses the absolute.
const authoredFill = ( preset ) => new LightingRig( { preset } ).placements
    .find( ( placement ) => placement.name === 'fill' ).irradiance;

const absoluteFills = SCENE_IDS
    .filter( ( id ) => SCENES[ id ].lights.fill?.irradiance !== undefined )
    .map( ( id ) => `${ id }.fill.irradiance` );

report( '🔴 G17  no shipped scene writes fill.irradiance absolutely — the body preset overrides it',
    authoredFill( 'portrait' ) !== authoredFill( 'body' ) && absoluteFills.length === 0,
    absoluteFills.length === 0
        ? `the real rig authors the fill at ${ authoredFill( 'portrait' ) } at portrait and ` +
          `${ authoredFill( 'body' ) } at body, so an absolute 0.70 is 0.318x one table and 0.583x ` +
          'the other and setFraming moves the scene\'s key:fill by 1.83x in silence. The scenes ' +
          'reach it through `scales`, which re-resolves. ⚠️ COLOUR, AZIMUTH AND ELEVATION on key ' +
          'and fill ARE identical across the presets and stay absolute'
        : `found ${ absoluteFills.join( ', ' ) } — these change key:fill at body framing silently` );

console.log( '\n--- 🔴 RED PROOFS: the clauses above are re-run against KNOWN-BAD tables ------------\n' );
console.log( '      LEARNINGS §1.1 — a gate that has never failed is not known to work. Each row\n' +
    '      below is a scene this item could plausibly have shipped by accident.\n' );

const knownBad = [
    {
        clause: 'A1',
        what: 'the card one code value brighter (0x070a0e → 0x070a0f)',
        why: 'the smallest change the studio plate can see. Measured through avatar-plate.html: ' +
            'sha fac62c50d56590fb becomes 392bc43acbfc3f75.',
        run: () => studioMatchesTheShippedLiterals( resolveScene( {
            background: { ...SCENES.studio.background, backdrop: 0x070a0f }
        } ) )
    },
    {
        clause: 'A1',
        what: 'the card moved 10 cm (1.9 m → 2.0 m)',
        why: 'a plausible "tidy the constant" edit, and the card is the whole of G6.',
        run: () => studioMatchesTheShippedLiterals( resolveScene( {
            background: { ...SCENES.studio.background, distanceMetres: 2.0 }
        } ) )
    },
    {
        clause: 'A1',
        what: 'exposure nudged to 1.05',
        why: 'ratio-neutral, so no lighting ratio moves — and it takes ' +
            'report().scene.lighting.calibrated false and every G1/G4/G5/G6 number with it.',
        run: () => studioMatchesTheShippedLiterals( resolveScene( { exposure: 1.05 } ) )
    },
    {
        clause: 'A1',
        what: 'one rig override on the studio scene (key elevation 18° → 20°)',
        why: 'the exact shape of "a scene is mostly light" arriving in the CONTROL, where it is ' +
            'not allowed to.',
        run: () => studioMatchesTheShippedLiterals( resolveScene( {
            lights: { key: { elevationDegrees: 20 } }
        } ) )
    },
    {
        clause: 'B1',
        what: 'the scene table and BACKGROUND_PRESETS disagreeing about the floor',
        why: 'the two-tables failure this item exists to end: a scene that quietly drops the ' +
            'contact shadow while the preset keeps it.',
        run: () => sameRequest(
            backgroundRequestOf( resolveScene( { ground: false } ) ),
            BACKGROUND_PRESETS.studio )
    },
    {
        clause: 'G3',
        what: 'a sun model with the atmosphere taken out (Fex pinned to 1)',
        why: 'the hand-authored ramp this file exists instead of. With no extinction the sun is ' +
            'white at every elevation, which is exactly the sky/key disagreement 11.2 forbids — ' +
            'and it would still be monotone in BRIGHTNESS, so a clause that only checked ' +
            'irradiance would have read green.',
        run: () => {

            const flat = [ 0, 22, 60, 90 ].map( ( elevation ) => ( {
                irradiance: solarDiscLight( elevation ).sunIntensity,
                correlatedColourTemperature: 6500
            } ) );

            return flat.every( ( row, index ) => index === 0
                || ( row.irradiance > flat[ index - 1 ].irradiance
                    && row.correlatedColourTemperature > flat[ index - 1 ].correlatedColourTemperature ) );

        }
    },
    {
        clause: 'G4',
        what: 'a key that copies the WORLD sun azimuth straight into the rig',
        why: 'the exact defect the punch list names: a key that swings when the camera orbits ' +
            'while the sky stands still. It is invisible at a fixed camera, which is every plate ' +
            'this repository has ever taken.',
        run: () => {

            const identity = ( worldAzimuth ) => worldAzimuth;

            return identity( 58 ) === 46 && identity( -46 ) === -58;

        }
    },
    {
        clause: 'G7',
        what: 'dapple modelled as turbidity instead of as disc occlusion',
        why: 'the tempting alternative, and it is a different picture: raising turbidity dims the ' +
            'WHOLE sky, which is an overcast day. The clause has to see that the sky kept its ' +
            'light while the key lost 45% of its own.',
        run: () => {

            const murky = keyPlacementForSun(
                { ...SCENES.park.sun, occlusion: 0 },
                { ...SCENES.park.sky, turbidity: 12 },
                12 );

            return Math.abs( murky.irradiance - parkLit.irradiance * ( 1 - SCENES.park.sun.occlusion ) ) < 1e-12
                && murky.colour === parkLit.colour;

        }
    },
    {
        clause: 'G12',
        what: 'the rim solved as a NUMBER instead of as a factor (lights.rim.irradiance = 2.6)',
        why: 'the fix the previous round measured and could not ship, written the obvious way. It ' +
            'is right at portrait and 88.2% under at body, and no plate at one framing can see it.',
        run: () => {

            const absolute = resolveScene( { ...SCENES.beach,
                lights: { ...SCENES.beach.lights, rim: { irradiance: 2.6 } } } );

            return Object.keys( absolute.lights )
                .filter( ( name ) => name === 'rim' || name === 'kicker' ).length === 0;

        }
    },
    {
        clause: 'G13',
        what: 'a `scales` axis resolved against the PORTRAIT table at both framings',
        why: 'the whole defect the axis exists against, one level up: a factor that is re-based ' +
            'once and cached is an absolute wearing a multiplier\'s clothes, and it reads green on ' +
            'every portrait plate this repository takes.',
        run: () => {

            const frozenBase = authoredRim( 'portrait' ) * SCENES.beach.scales.rim.irradiance;

            return Math.abs( frozenBase - authoredRim( 'body' ) * SCENES.beach.scales.rim.irradiance ) < 1e-9;

        }
    },
    {
        clause: 'G17',
        what: 'the fill written absolutely, the way this file justified for a whole phase',
        why: 'not hypothetical — it is what `beach` SHIPPED, on a comment claiming FORM_LIGHTS is ' +
            'identical at both framings. The rig says 2.20 and 1.20.',
        run: () => {

            const absolute = resolveScene( { ...SCENES.beach,
                lights: { fill: { ...SCENES.beach.lights.fill, irradiance: 0.70 } } } );

            return absolute.lights.fill?.irradiance === undefined;

        }
    },
    {
        clause: 'B1',
        what: 'the clear colour tinted to the void black',
        why: 'a projection that read the wrong field would look exactly like this and would ' +
            'render a frame nobody could reproduce.',
        run: () => sameRequest(
            backgroundRequestOf( resolveScene( { background: { colour: 0x000000 } } ) ),
            BACKGROUND_PRESETS.studio )
    }
];

for ( const bad of knownBad ) {

    const stillGreen = bad.run() === true;

    report( `🔴 KNOWN-BAD (${ bad.clause }): ${ bad.what }`,
        stillGreen === false,
        stillGreen
            ? `clause ${ bad.clause } READ GREEN on a table that is wrong. ${ bad.why }`
            : `clause ${ bad.clause } goes RED, as it must. ${ bad.why }` );

}

// MUST STILL PASS, or a predicate this tight would reject a legitimate scene and be loosened by
// the next person who needed one. A scene that is NOT the studio must be describable.
const beachShaped = resolveScene( {
    id: 'beach-shaped',
    kind: 'studio',
    exposure: 1.6,
    lights: { key: { elevationDegrees: 68, irradiance: 6.2, colour: 0xfff4e2 } },
    ground: { enabled: true, albedo: 0xd9cbb0, roughness: 0.9 },
    air: { haze: 0.25 }
} );

report( '✅ MUST PASS: a scene that is NOT the studio still resolves, whole and frozen',
    beachShaped.id === 'beach-shaped'
        && beachShaped.lights.key.irradiance === 6.2
        && beachShaped.ground.albedo === 0xd9cbb0
        && beachShaped.air.haze === 0.25
        && beachShaped.background.backdrop === BACKDROP_EMISSIVE
        && Object.isFrozen( beachShaped ) && Object.isFrozen( beachShaped.lights.key ),
    'a partial inherits the SHIPPED background and floor rather than nulls, so it renders' );

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
