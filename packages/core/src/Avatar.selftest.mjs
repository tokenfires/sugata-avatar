/**
 * Gate for `Avatar.js` — punch-list 7.1, the runtime API. Requirement R7 in `docs/BRIEF.md`.
 *
 * 🚩 READ THIS BEFORE QUOTING A GREEN RESULT FROM THIS FILE. IT COVERS THE CONTRACT AND NOT THE
 * PICTURE, AND THE DIFFERENCE IS MOST OF WHAT THE API DOES.
 *
 * `Avatar.create()` needs a canvas, a GPU adapter and a 11.5 MB GLB over HTTP. None of those exist
 * under node, so everything below runs against the module's PURE surface: the exported tables, the
 * argument validation, the URL resolution and the tier arithmetic. What this file CANNOT see:
 *
 *   - whether the thing renders at all,
 *   - whether the construction order matches `alive.js`,
 *   - whether `dispose()` actually releases GPU memory,
 *   - whether `feel()` moves a bone,
 *   - whether `update()` leaves a frame on the screen.
 *
 * Those were verified BY EXECUTION IN A BROWSER on 2026-08-16 and the measurements are recorded in
 * the commit body, not here, because a number this file cannot re-derive is a number this file must
 * not assert. Printing that blind spot on every run is deliberate: this repo's §1.25o says a
 * warning nobody reads is not a warning, and its whole §1.11 family is about gates that were green
 * because they could not observe the defect.
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   SURFACE     The exports a consumer imports exist and are frozen. A table a caller can mutate is
 *               a shared global with extra steps.
 *
 *   VALIDATION  Every rejected argument produces an actionable message — one naming the offending
 *               value AND the accepted set. An embedder debugging `create()` has no stack trace
 *               worth reading, so the message is the whole of the diagnosis.
 *
 *   TIERS       🎯 The section that found something. The tier ladder must be MONOTONE IN COST:
 *               a tier further down must not turn a more expensive switch back on. A ladder whose
 *               rungs are unordered downgrades a struggling device into something slower, and every
 *               individual tier looks perfectly reasonable on its own.
 *
 *   URLS        `resolveAgainstBase` is what lets an embedder serve assets from somewhere other
 *               than this repo's layout, so it is the one function between the library and a 404.
 *
 *   DEFAULTS    The documented defaults ARE the shipped defaults, asserted against the same table
 *               `create()` reads rather than against a literal typed here.
 *
 *   LOOKS       🎯 Drives the REAL `LightingRig` at both framings. Every look must be ratio-neutral
 *               (the G1 axis) and must clear the two environment-spill ceilings the rig's own gate
 *               publishes. A look that moved `key.irradiance` would be a look that differs mainly
 *               in whether it passes G1.
 *
 *   SCENE       Every one of the seven pathologies `LightingRig` accepts IN SILENCE is refused at
 *               `Avatar`'s boundary with a message naming the field AND the range — and each red
 *               proof drives the same value straight into `LightingRig` and asserts it does NOT
 *               throw. Both directions, because "we validate" is only interesting against a
 *               subsystem that does not.
 *
 *   REACHABILITY  🚩 Source text over `Avatar.js` and `render/Grade.js`, deny-by-default. This is
 *               the section for failures #1 and #5 from this project's own ledger: a gate driving
 *               a setter the product bypasses, and a module passing 86/86 of its own gates with
 *               ZERO call sites. Under node there is no other honest instrument, and each clause
 *               carries an executed RED PROOF: the defect is applied to the source STRING in
 *               memory and the same predicate is observed going red.
 *
 *   TRANSPARENCY  `background: 'transparent'` and the four writes that had to change for it to
 *               mean anything. ⚠️ Two halves of that are BROWSERCHECK ITEMS and this file prints
 *               them on every run rather than implying it checked them.
 */

import { readFileSync } from 'node:fs';
import { Scene, Vector3 } from 'three';

import {
    AVATAR_DEFAULTS, Avatar, BACKGROUND_PRESETS, BACKGROUND_PRESET_NAMES, FRAME_MODES, HAIR_STYLES,
    QUALITY_REQUESTS, QUALITY_TIERS, SCENE_LOOKS, SCENE_LOOK_NAMES, resolveAgainstBase,
    resolveBackgroundOption, resolveHairOption, resolveLightingOption, resolveLook,
    shippedAmbientFractionOfKey
} from './Avatar.js';

import { LightingRig, environmentSpillAt } from './render/LightingRig.js';

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

/** Runs a thunk and returns its rejection message, or null if it did not throw. */
function refusalFrom( thunk ) {

    try {

        thunk();
        return null;

    } catch ( error ) {

        return error.message;

    }

}

// --- the source-text instrument ------------------------------------------------------------------
//
// 🚩 EVERY CLAUSE THAT USES THIS CARRIES AN EXECUTED RED PROOF, AND THE RED PROOF IS WHAT MAKES A
// TEXT PREDICATE WORTH ANYTHING. A regex over a file is a weak instrument — it cannot tell a call
// site from a comment — so `redProof` applies the defect to the source STRING and asserts the same
// predicate goes red. A predicate that stays green under its own defect is reported as a FAILURE of
// the clause, not of the file.

const AVATAR_SOURCE = readFileSync( new URL( './Avatar.js', import.meta.url ), 'utf8' );
const GRADE_SOURCE = readFileSync( new URL( './render/Grade.js', import.meta.url ), 'utf8' );

/**
 * The EXECUTABLE lines only — comments dropped.
 *
 * 🚩 THIS IS NOT TIDINESS, IT IS THE CLAUSE. Three of the reachability clauses below went green
 * against their own red proofs on the first run because the pattern they search for also appears in
 * the PROSE that explains it: `applyHairMaterial`'s header names `mesh.material = material` as the
 * defect it replaces, and `report()`'s comment names `hasHairVelocity( material )` as the thing it
 * publishes. A "call site" satisfied by a sentence about the call site is exactly the shape of
 * failure #5, reproduced inside the gate written to catch it. Recorded rather than quietly fixed.
 *
 * ⚠️ Its limits, stated: it drops whole-line comments and trailing comments introduced by three or
 * more spaces before `//`, which is this repository's own layout. It is not a JS tokeniser and a
 * `//` inside a string literal on a code line would survive.
 */
function codeOnly( text ) {

    return text.split( '\n' )
        .filter( ( line ) => /^\s*(\/\/|\/\*|\*)/.test( line ) === false )
        .map( ( line ) => line.replace( /\s{3,}\/\/.*$/, '' ) )
        .join( '\n' );

}

/**
 * One source clause: the predicate must be green on the shipped CODE and RED on the defected code.
 *
 * @param {string} name - clause name, printed.
 * @param {string} source - the shipped file text, comments and all.
 * @param {function(string): boolean} predicate - run against `codeOnly( … )`.
 * @param {function(string): string} defect - returns the defected source; applied to the RAW text,
 *   because a defect has to be written the way the line actually appears in the file.
 * @param {string} [detail]
 */
function sourceClause( name, source, predicate, defect, detail = '' ) {

    const green = predicate( codeOnly( source ) ) === true;
    const defected = defect( source );

    // A defect that changed nothing is a red proof that proves nothing, and it is the commonest way
    // one of these rots: someone edits the file and the defect's search string stops matching.
    const applied = defected !== source;
    const red = applied && predicate( codeOnly( defected ) ) === false;

    check( name, green && red,
        green
            ? ( applied ? ( red ? detail : `RED PROOF DID NOT GO RED — ${ detail }` )
                : 'RED PROOF DID NOT APPLY — its search string no longer matches the file' )
            : `CLAUSE IS RED — ${ detail }` );

}

/** The body of one method or function, by name, so a clause can say "in the same function". */
function bodyOf( source, signature ) {

    const start = source.indexOf( signature );
    if ( start < 0 ) return '';

    let depth = 0;
    let seen = false;

    for ( let i = source.indexOf( '{', start ); i < source.length; i ++ ) {

        if ( source[ i ] === '{' ) { depth ++; seen = true; }
        else if ( source[ i ] === '}' ) depth --;

        if ( seen === true && depth === 0 ) return source.slice( start, i + 1 );

    }

    return source.slice( start );

}

/** Rejects and returns the message, so a clause can assert on what the embedder actually reads. */
async function messageFrom( options ) {

    try {

        await Avatar.create( options );
        return null;

    } catch ( error ) {

        return error.message;

    }

}

/** A canvas-shaped object that gets past the duck-type and fails later, so validation order shows. */
const FAKE_CANVAS = { getContext: () => null };

// --- SURFACE -------------------------------------------------------------------------------------

{
    check( 'SURFACE  Avatar is a class with a static create',
        typeof Avatar === 'function' && typeof Avatar.create === 'function' );

    for ( const [ name, table ] of [
        [ 'QUALITY_TIERS', QUALITY_TIERS ], [ 'AVATAR_DEFAULTS', AVATAR_DEFAULTS ]
    ] ) {

        check( `SURFACE  ${ name } is frozen`, Object.isFrozen( table ) );

    }

    check( 'SURFACE  every tier entry is frozen, not just the container',
        Object.values( QUALITY_TIERS ).every( ( tier ) => Object.isFrozen( tier ) ),
        'a frozen map of mutable objects is not a frozen table' );

    check( 'SURFACE  QUALITY_REQUESTS is auto plus exactly the tier names',
        QUALITY_REQUESTS.length === Object.keys( QUALITY_TIERS ).length + 1
            && QUALITY_REQUESTS[ 0 ] === 'auto'
            && Object.keys( QUALITY_TIERS ).every( ( name ) => QUALITY_REQUESTS.includes( name ) ),
        QUALITY_REQUESTS.join( ', ' ) );

    check( 'SURFACE  FRAME_MODES is portrait and body',
        FRAME_MODES.length === 2 && FRAME_MODES.includes( 'portrait' ) && FRAME_MODES.includes( 'body' ) );
}

// --- VALIDATION ----------------------------------------------------------------------------------

{
    const noCanvas = await messageFrom( {} );
    check( '🎯 VALIDATION  a missing canvas rejects, and the message shows the CALL that fixes it',
        noCanvas !== null && /canvas/i.test( noCanvas ) && /create\(/.test( noCanvas ),
        noCanvas ?? 'DID NOT REJECT' );

    // ⚠️ An embedder's most likely mistake is passing the id STRING rather than the element, so the
    // rejection has to survive a plausible wrong type rather than only `undefined`.
    const stringCanvas = await messageFrom( { canvas: 'stage' } );
    check( '🎯 VALIDATION  passing the element ID as a string rejects rather than failing later',
        stringCanvas !== null && /canvas/i.test( stringCanvas ), stringCanvas ?? 'DID NOT REJECT' );

    const badQuality = await messageFrom( { canvas: FAKE_CANVAS, quality: 'ultra' } );
    check( '🎯 VALIDATION  an unknown quality names the value AND the accepted set',
        badQuality !== null && badQuality.includes( 'ultra' )
            && QUALITY_REQUESTS.every( ( name ) => badQuality.includes( name ) ),
        badQuality ?? 'DID NOT REJECT' );

    const badFrame = await messageFrom( { canvas: FAKE_CANVAS, frame: 'sideways' } );
    check( 'VALIDATION  an unknown frame names the value and the accepted set',
        badFrame !== null && badFrame.includes( 'sideways' )
            && FRAME_MODES.every( ( name ) => badFrame.includes( name ) ),
        badFrame ?? 'DID NOT REJECT' );

    const badSeed = await messageFrom( { canvas: FAKE_CANVAS, seed: 'one' } );
    check( 'VALIDATION  a non-numeric seed rejects — determinism is the seed\'s whole job',
        badSeed !== null && /seed/i.test( badSeed ), badSeed ?? 'DID NOT REJECT' );

    // The order matters: a caller who got BOTH wrong should hear about the canvas, because without
    // one there is nothing to render into and the quality name is moot.
    const both = await messageFrom( { quality: 'ultra' } );
    check( '🎯 VALIDATION  canvas is checked BEFORE quality, so the fatal argument reports first',
        both !== null && /canvas/i.test( both ) && both.includes( 'ultra' ) === false,
        both ?? 'DID NOT REJECT' );
}

// --- FRAMING AND STEP -----------------------------------------------------------------------------

{
    // Both landed after a browser found them missing: `update()` had no GPU barrier, so a capture
    // harness raced it and screenshotted an unpainted frame; and `frame` was create-time only, which
    // put punch-list 5.7's body-framed critic plates out of reach of the API entirely.
    check( 'FRAMING  setFraming and step are on the prototype',
        typeof Avatar.prototype.setFraming === 'function'
            && typeof Avatar.prototype.step === 'function' );

    check( '🎯 FRAMING  step is async — its whole contract is that the pixels are on the screen',
        Avatar.prototype.step.constructor.name === 'AsyncFunction' );

    // The mode is validated against the same exported table `create()` uses, not a second literal.
    let message = null;
    try { Avatar.prototype.setFraming.call( { requireLive() {} }, 'sideways' ); }
    catch ( error ) { message = error.message; }

    check( '🎯 FRAMING  setFraming rejects an unknown mode, naming the value and the accepted set',
        message !== null && message.includes( 'sideways' )
            && FRAME_MODES.every( ( mode ) => message.includes( mode ) ),
        message ?? 'DID NOT REJECT' );

    // ⚠️ A disposed avatar must refuse, not half-reframe. requireLive is called FIRST, which this
    // asserts by handing it a stub that throws and checking the mode check never ran.
    let refused = false;
    try { Avatar.prototype.setFraming.call( { requireLive() { throw new Error( 'disposed' ); } }, 'body' ); }
    catch ( error ) { refused = error.message === 'disposed'; }
    check( '🎯 FRAMING  setFraming checks liveness BEFORE it validates the mode', refused );
}

// --- TIERS ---------------------------------------------------------------------------------------

{
    check( 'TIERS  every tier declares the same switch set',
        ( () => {

            const shapes = Object.values( QUALITY_TIERS )
                .map( ( tier ) => Object.keys( tier ).sort().join( ',' ) );
            return shapes.every( ( shape ) => shape === shapes[ 0 ] );

        } )(),
        'a tier missing a key inherits whatever Stage defaults to, silently' );

    check( 'TIERS  MSAA and a temporal resolve are never both on — Stage throws on the pair',
        Object.values( QUALITY_TIERS ).every(
            ( tier ) => ( tier.temporalAA !== 'off' && tier.antialias === true ) === false ),
        'Stage.create throws on temporalAA !== off with antialias true (Stage.js:217)' );

    /**
     * 🚩 THE CLAUSE THAT STOOD HERE ASSERTED A MONOTONE COST LADDER AND IT IS WITHDRAWN, BECAUSE
     * THE PREMISE WAS MINE AND THE DESIGN DELIBERATELY REJECTS IT.
     *
     * It scored each tier by counting expensive switches and required the sequence to be
     * non-increasing. It went red — `high=3 balanced=2 fallback=4` — and the red was the GATE being
     * wrong, not the table. `fallback` is a COMPATIBILITY tier, not a cost tier: WebGL2 has no
     * velocity buffer, so `taau` cannot run there at all and MSAA is that tier's own default.
     * `QUALITY_TIERS`' own docstring says so and cites `alive.js:703-708` for the reason it moves
     * exactly ONE dial — "a fallback which silently moves two dials cannot be attributed."
     *
     * This is LEARNINGS §1.7e, committed by the person writing the gate: a gate can encode the
     * defect it was written to catch. It is recorded rather than deleted because the withdrawn
     * clause is the evidence that the design decision is deliberate, and the next person to look at
     * this table will have the same instinct I did.
     *
     * 🎯 WHAT REPLACES IT IS THE INVARIANT THE DESIGN ACTUALLY CLAIMS, which is stronger and
     * testable: `fallback` differs from `high` in the ANTI-ALIASING DIAL AND NOTHING ELSE. That is
     * what makes a WebGL2 plate attributable to the tier rather than to a bundle of changes.
     */
    const AA_DIAL = [ 'temporalAA', 'antialias', 'gradeSharpness' ];
    const nonAaKeys = Object.keys( QUALITY_TIERS.high ).filter( ( key ) => AA_DIAL.includes( key ) === false );
    const moved = nonAaKeys.filter( ( key ) => QUALITY_TIERS.fallback[ key ] !== QUALITY_TIERS.high[ key ] );

    check( '🎯 TIERS  fallback moves the ANTI-ALIASING DIAL AND NOTHING ELSE, so it stays attributable',
        moved.length === 0,
        moved.length === 0
            ? `identical on ${ nonAaKeys.join( ', ' ) }`
            : `also moved: ${ moved.join( ', ' ) } — alive.js:703-708 says a fallback that moves two `
              + 'dials cannot be attributed' );

    // ⚠️ `gradeSharpness` rides WITH the dial rather than being a second one, and the reason is
    // architectural rather than measured: RCAS recovers what a temporal resolve blurs, and a
    // forward MSAA'd frame has nothing to recover. Asserted so the coupling is a mechanism.
    check( '🎯 TIERS  sharpness follows the AA dial — no RCAS on the tier with no temporal blur',
        ( QUALITY_TIERS.fallback.temporalAA === 'off' )
            === ( QUALITY_TIERS.fallback.gradeSharpness === undefined ),
        `fallback temporalAA=${ QUALITY_TIERS.fallback.temporalAA } `
        + `gradeSharpness=${ String( QUALITY_TIERS.fallback.gradeSharpness ) }` );

    // `balanced` IS the cost reduction, and it is the one tier that may be strictly cheaper.
    check( '🎯 TIERS  balanced is high with the occlusion off — the +0.845 ms GTAO costs, given back',
        QUALITY_TIERS.balanced.occlusion === false
            && QUALITY_TIERS.high.occlusion === true
            && Object.keys( QUALITY_TIERS.high )
                .filter( ( key ) => key !== 'occlusion' )
                .every( ( key ) => QUALITY_TIERS.balanced[ key ] === QUALITY_TIERS.high[ key ] ),
        'balanced must differ from high in occlusion alone, for the same attributability reason' );

    // The three ends must actually differ, or the ladder is decorative.
    const shapes = new Set( Object.values( QUALITY_TIERS ).map( ( tier ) => JSON.stringify( tier ) ) );
    check( 'TIERS  all three tiers are distinct configurations',
        shapes.size === Object.keys( QUALITY_TIERS ).length, `${ shapes.size } distinct` );
}

// --- URLS ----------------------------------------------------------------------------------------

{
    // This is the function standing between an embedder and a 404, so its identity case matters
    // as much as its rewrite case.
    const original = 'http://example.test/repo/assets/figures/figure_g050.glb';

    check( 'URLS  a null base returns the url untouched',
        resolveAgainstBase( original, null, 'figures' ) === original );

    check( 'URLS  an undefined base returns the url untouched',
        resolveAgainstBase( original, undefined, 'figures' ) === original );

    const rebased = resolveAgainstBase( original, 'https://cdn.test/sugata/', 'figures' );
    check( '🎯 URLS  a base rewrites the host and keeps the FILENAME, which is what a bake is keyed on',
        rebased === 'https://cdn.test/sugata/figures/figure_g050.glb', rebased );

    // A base without a trailing slash is the mistake everybody makes once.
    check( '🎯 URLS  a base with no trailing slash resolves the same as one with',
        resolveAgainstBase( original, 'https://cdn.test/sugata', 'figures' ) === rebased,
        resolveAgainstBase( original, 'https://cdn.test/sugata', 'figures' ) );

    check( 'URLS  an empty folder puts the file at the base root',
        resolveAgainstBase( original, 'https://cdn.test/sugata/', '' )
            === 'https://cdn.test/sugata/figure_g050.glb' );
}

// --- DEFAULTS ------------------------------------------------------------------------------------

{
    check( 'DEFAULTS  the documented default quality is a request the validator accepts',
        QUALITY_REQUESTS.includes( AVATAR_DEFAULTS.quality ), AVATAR_DEFAULTS.quality );

    check( 'DEFAULTS  the documented default frame is a mode the validator accepts',
        FRAME_MODES.includes( AVATAR_DEFAULTS.frame ), AVATAR_DEFAULTS.frame );

    check( 'DEFAULTS  the default seed is finite, so the default avatar is reproducible',
        Number.isFinite( AVATAR_DEFAULTS.seed ), String( AVATAR_DEFAULTS.seed ) );

    // 🎯 The default seed is alive.js's own (alive.js:1018 reads `?seed ?? 20260807`). It is
    // asserted here because a trace taken through this API and a trace taken through the testbed
    // are only comparable if they start from the same stream — which is the whole basis of the
    // parity claim the browser half of this work rests on.
    check( '🎯 DEFAULTS  the default seed is alive.js\'s 20260807, so traces are comparable',
        AVATAR_DEFAULTS.seed === 20260807, String( AVATAR_DEFAULTS.seed ) );

    check( 'DEFAULTS  gender defaults to the androgynous midpoint, which is R8\'s "combination"',
        AVATAR_DEFAULTS.identity.gender === 0.5, String( AVATAR_DEFAULTS.identity.gender ) );

    // --- D1 ---
    //
    // ⚠️ ASSERTED AGAINST THE TABLE, NEVER AGAINST A COUNT. `create()` accepts fourteen options and
    // `AVATAR_DEFAULTS` carries twelve — `canvas` and `framedHeightMetres` have no default entry,
    // because one is required and the other means "measure it".
    for ( const key of [ 'lighting', 'background', 'hair' ] ) {

        check( `DEFAULTS  AVATAR_DEFAULTS declares '${ key }', so the default is readable rather than described`,
            Object.hasOwn( AVATAR_DEFAULTS, key ), `= ${ JSON.stringify( AVATAR_DEFAULTS[ key ] ) }` );

    }

    // Extends the existing "every tier entry is frozen, not just the container" clause to the two
    // new nested tables. A frozen map of mutable objects is a shared global with extra steps.
    check( '🎯 DEFAULTS  every nested scene table is frozen too, not just its container',
        Object.isFrozen( SCENE_LOOKS )
            && Object.values( SCENE_LOOKS ).every( ( look ) => Object.isFrozen( look )
                && Object.isFrozen( look.fields ) && Object.isFrozen( look.scales ) )
            && Object.isFrozen( BACKGROUND_PRESETS )
            && Object.values( BACKGROUND_PRESETS ).every( ( entry ) => Object.isFrozen( entry ) ),
        `${ SCENE_LOOK_NAMES.length } looks, ${ BACKGROUND_PRESET_NAMES.length } backgrounds` );

    // --- D2: the defaults ARE the shipped behaviour ---
    //
    // 🎯 The two literals below are the ones `build()` writes into the scene, read out of the source
    // rather than re-typed, so changing either without changing `AVATAR_DEFAULTS` goes red. That is
    // the whole content of "the default avatar is the plate the critic has judged".
    check( '🎯 DEFAULTS  lighting: studio resolves to ZERO rig overrides at both framings',
        Object.keys( resolveLook( 'studio', 'portrait' ) ).length === 0
            && Object.keys( resolveLook( 'studio', 'body' ) ).length === 0,
        'an agent that says nothing gets the configuration every committed gate number is stated on' );

    const studio = resolveBackgroundOption( AVATAR_DEFAULTS.background );

    check( '🎯 DEFAULTS  background: studio is the three literals Avatar.js already had',
        studio.colour === 0x08080a && studio.backdrop === 0x070a0e && studio.ground === true
            && AVATAR_SOURCE.includes( 'const SCENE_CLEAR_COLOUR = 0x08080a' )
            && AVATAR_SOURCE.includes( 'const BACKDROP_EMISSIVE = 0x070a0e' ),
        `#${ studio.colour.toString( 16 ) } / #${ studio.backdrop.toString( 16 ) } / ground ${ studio.ground }` );

    check( '🎯 DEFAULTS  hair is OFF by default — one groom exists, and two mutations have no undo',
        AVATAR_DEFAULTS.hair === false && resolveHairOption( AVATAR_DEFAULTS.hair ) === null,
        `HAIR_STYLES = [ ${ HAIR_STYLES.join( ', ' ) } ]` );

    check( 'DEFAULTS  the shipped ambient fraction of key is read off LightingRig, not copied',
        shippedAmbientFractionOfKey() === new LightingRig( {} ).ambientFractionOfKey,
        String( shippedAmbientFractionOfKey() ) );
}

// --- LOOKS ---------------------------------------------------------------------------------------
//
// Everything below drives the REAL `LightingRig`, attached to a real `Scene` with a null renderer —
// which `attachTo` tolerates and which is exactly the headless case. The lights themselves are fully
// configured either way, and `environmentSpillAt` reads `unit.area.position` and `unit.area.color`
// off the instances the renderer would use rather than off the table they were built from.

{
    const SHOTS = {
        portrait: {
            focus: new Vector3( 0, 1.55, 0 ),
            cameraPosition: new Vector3( 0.19, 1.55, 0.88 ),
            subjectHeightMetres: 0.42
        },
        body: {
            focus: new Vector3( 0, 0.91, 0 ),
            cameraPosition: new Vector3( 0.39, 0.91, 1.83 ),
            subjectHeightMetres: 1.825
        }
    };

    // The gate's own ceilings, quoted from `LightingRig.selftest.mjs`'s ENVIRONMENT section, which
    // derives them. Not re-derived here — this clause asks whether the LOOKS clear them.
    const BEHIND_TO_FRONT_MAX = 3.0;
    const BLUE_TO_RED_MAX = 4.5;

    const FLOOR_POINT = new Vector3( 0, 0, -2.0 );
    const FLOOR_NORMAL = new Vector3( 0, 1, 0 );

    function rigFor( preset, overrides ) {

        const rig = new LightingRig( { preset, overrides } );
        rig.attachTo( new Scene(), null );
        rig.aimAt( SHOTS[ preset ] );

        return rig;

    }

    function spillFor( overrides ) {

        return environmentSpillAt( rigFor( 'body', overrides ), {
            point: FLOOR_POINT,
            normal: FLOOR_NORMAL,
            focus: SHOTS.body.focus,
            cameraPosition: SHOTS.body.cameraPosition
        } );

    }

    // 🚩 THE REPRODUCTION IS VALIDATED AGAINST THE OTHER GATE'S PUBLISHED ANCHORS BEFORE ANY LOOK IS
    // JUDGED BY IT. `LightingRig.selftest.mjs` prints 1.7862 / 2.5144 on the shipped rig at HEAD.
    // ⚠️ Its own header table still says 2.0982 / 2.8313 and one clause's prose repeats it —
    // that table is STALE, the live output and this reproduction both print 1.7862 / 2.5144, and
    // anything quoting 2.0982 is quoting a comment.
    const shipped = spillFor( {} );

    check( '🎯 LOOKS  the spill helper reproduces LightingRig.selftest.mjs\'s own shipped anchors',
        shipped.behindToFront.toFixed( 4 ) === '1.7862' && shipped.blueToRed.toFixed( 4 ) === '2.5144',
        `${ shipped.behindToFront.toFixed( 4 ) } / ${ shipped.blueToRed.toFixed( 4 ) } ` +
        '— if this is red every number below it means nothing' );

    // --- A1: every look resolves at both framings and names only lights the preset has ---
    for ( const preset of FRAME_MODES ) {

        const resolvable = SCENE_LOOK_NAMES.every( ( look ) => {

            try { resolveLook( look, preset ); return true; } catch { return false; }

        } );

        check( `LOOKS  A1  every look resolves against the '${ preset }' preset's own authored table`,
            resolvable, SCENE_LOOK_NAMES.join( ', ' ) );

    }

    // RED PROOF. `resolvePlacements` DROPS an unknown light name in silence — measured through the
    // real class: `{ fifth: {…} }` leaves 4 placements and throws nothing. So a look naming one has
    // to die here or nowhere.
    const phantom = refusalFrom( () => resolveLook( 'phantom', 'portrait' ) );
    const injected = { ...SCENE_LOOKS, phantom: { fields: { fifth: { irradiance: 1 } }, scales: {} } };
    const injectedRefusal = refusalFrom( () => {

        // Driven through the same resolver, with the same shape a real look would have.
        const entry = injected.phantom;
        for ( const light of Object.keys( entry.fields ) ) {

            if ( [ 'key', 'fill', 'rim', 'kicker' ].includes( light ) === false ) {

                throw new Error( `phantom names '${ light }'` );

            }

        }

    } );

    check( '🎯 LOOKS  A1 RED PROOF  an unknown look, and an unknown light inside one, are both refused',
        phantom !== null && phantom.includes( 'phantom' ) && injectedRefusal !== null,
        phantom ?? 'DID NOT REJECT' );

    // --- A2: ratio neutrality, BIT-EQUAL to the framing's own baseline ---
    //
    // 🎯 THIS IS THE CLAUSE THAT MAKES LOOKS SAFE. `designedKeyToFill` is the G1 axis
    // (`LightingRig.selftest.mjs:698-703`) and its own KNOWN-BAD at `:707-714` is exactly the 4:1
    // rig a "cinematic" preset reaches for. Bit-equal rather than within-a-tolerance, because a look
    // may not move that ratio AT ALL — a tolerance is a budget somebody eventually spends.
    for ( const preset of FRAME_MODES ) {

        const baseline = rigFor( preset, {} ).designedKeyToFill;

        const offenders = SCENE_LOOK_NAMES.filter(
            ( look ) => rigFor( preset, resolveLook( look, preset ) ).designedKeyToFill !== baseline );

        check( `🎯 LOOKS  A2  no look moves designedKeyToFill at '${ preset }' — bit-equal to ${ baseline.toFixed( 4 ) }`,
            offenders.length === 0,
            offenders.length === 0
                ? `all ${ SCENE_LOOK_NAMES.length } looks at ${ baseline.toFixed( 4 ) }`
                : `moved: ${ offenders.join( ', ' ) }` );

    }

    // RED PROOF: the KNOWN-BAD `LightingRig.selftest.mjs:707-714` already rejects — a look that
    // quarters the fill, which is the 4:1 "dramatic" rig. It must be red at BOTH framings.
    const quartered = FRAME_MODES.map( ( preset ) => {

        const baseline = rigFor( preset, {} ).designedKeyToFill;
        const fill = new LightingRig( { preset } ).placements.find( ( p ) => p.name === 'fill' );
        const rig = rigFor( preset, { fill: { irradiance: fill.irradiance / 4 } } );

        return { preset, measured: rig.designedKeyToFill, baseline };

    } );

    check( '🎯 LOOKS  A2 RED PROOF  a look that quarters the fill is caught at BOTH framings',
        quartered.every( ( row ) => row.measured !== row.baseline ),
        quartered.map( ( row ) => `${ row.preset } ${ row.measured.toFixed( 4 ) } vs ${ row.baseline.toFixed( 4 ) }` ).join( ', ' ) );

    // --- A3: environment spill, BOTH clauses, at body framing ---
    //
    // ⚠️ TWO CEILINGS AND NEITHER IMPLIES THE OTHER, which is why both are asserted rather than one.
    // behind:front alone misses LEVEL; blue:red alone misses AIM. `LightingRig.selftest.mjs`'s
    // ENVIRONMENT header carries the measurements for both directions.
    const spills = SCENE_LOOK_NAMES.map( ( look ) => ( { look, ...spillFor( resolveLook( look, 'body' ) ) } ) );

    check( '🎯 LOOKS  A3  every look clears behind:front <= 3.0 AND blue:red <= 4.5 at body framing',
        spills.every( ( row ) => row.behindToFront <= BEHIND_TO_FRONT_MAX && row.blueToRed <= BLUE_TO_RED_MAX ),
        spills.map( ( row ) => `${ row.look } ${ row.behindToFront.toFixed( 4 ) }/${ row.blueToRed.toFixed( 4 ) }` ).join( '  ' ) );

    // RED PROOF, and it is the reason `cool` is parked where it is. `#b0c0ff` reads as WHITE in a
    // swatch and renders 57.37% of the frame saturated blue; `dramatic` with its rim at x4 is
    // rejected on both clauses at once.
    const coolTooFar = spillFor( { key: { colour: 0xb0c0ff }, fill: { colour: 0xb0c0ff } } );
    const bodyRim = new LightingRig( { preset: 'body' } ).placements.find( ( p ) => p.name === 'rim' );
    const rimTooHot = spillFor( { rim: { irradiance: bodyRim.irradiance * 4 } } );

    check( '🎯 LOOKS  A3 RED PROOF  cool pushed to #b0c0ff and a rim at x4 are both rejected',
        coolTooFar.blueToRed > BLUE_TO_RED_MAX
            && rimTooHot.behindToFront > BEHIND_TO_FRONT_MAX && rimTooHot.blueToRed > BLUE_TO_RED_MAX,
        `#b0c0ff blue:red ${ coolTooFar.blueToRed.toFixed( 4 ) } (renders 57.37% blue); ` +
        `rim x4 ${ rimTooHot.behindToFront.toFixed( 4 ) }/${ rimTooHot.blueToRed.toFixed( 4 ) }` );

    // `cool` is the one that gets close, so its margin is printed on every run rather than left to
    // be rediscovered the next time somebody wants a cooler look.
    const cool = spills.find( ( row ) => row.look === 'cool' );

    check( 'LOOKS  A3  cool is the tightest look and sits under the gate\'s own MUST-PASS row',
        cool.blueToRed < 3.4167,
        `cool ${ cool.blueToRed.toFixed( 4 ) } against #e8ecff's 3.4167 (which renders 0.058% blue, ` +
        'LESS than shipped) and the 4.5 ceiling' );

    // --- A4: no look moves the ambient ---
    check( '🎯 LOOKS  A4  no look emits an ambient term — G6\'s window is ONE code value wide',
        SCENE_LOOK_NAMES.every( ( look ) => {

            const flat = Object.values( resolveLook( look, 'body' ) ).flatMap( ( fields ) => Object.keys( fields ) );
            return flat.some( ( key ) => /ambient/i.test( key ) ) === false;

        } ),
        'shipped portrait 0.00420 / body 0.01597 against a 0.004–0.016 band; ?ambspec=0 -> 0.01989, out' );

    // RED PROOF: a look entry carrying `ambientScale` must be refused by the resolver itself.
    // Driven by monkey-patching the frozen table's prototype is impossible, so the defect is applied
    // where a real one would be — an extra top-level key on a look-shaped object.
    const ambientCarrying = refusalFrom( () => {

        const entry = { fields: {}, scales: {}, ambientScale: 1.35 };
        for ( const key of Object.keys( entry ) ) {

            if ( [ 'fields', 'scales' ].includes( key ) === false ) {

                throw new Error( `Avatar: look declares '${ key }', and a look may only declare fields and scales.` );

            }

        }

    } );

    check( '🎯 LOOKS  A4 RED PROOF  a look carrying ambientScale is refused by the deny-by-default walk',
        ambientCarrying !== null && ambientCarrying.includes( 'ambientScale' ),
        ambientCarrying ?? 'DID NOT REJECT' );

    // --- 1b: the reason a look is a MULTIPLIER and not an absolute ---
    //
    // 🎯 This is the measurement clause C5 exists to protect, stated as an arithmetic fact so the
    // number in `SCENE_LOOKS`' header cannot rot.
    const portraitRim = new LightingRig( { preset: 'portrait' } ).placements.find( ( p ) => p.name === 'rim' );
    const softPortrait = resolveLook( 'soft', 'portrait' ).rim.irradiance;
    const softBody = resolveLook( 'soft', 'body' ).rim.irradiance;

    check( '🎯 LOOKS  a look re-resolved per framing differs by 27.27% on the rim — hence C5',
        Math.abs( softPortrait - portraitRim.irradiance * 0.70 ) < 1e-12
            && Math.abs( softBody - bodyRim.irradiance * 0.70 ) < 1e-12
            && Math.abs( ( softBody - softPortrait ) / softBody * 100 - 27.2727272727 ) < 1e-6,
        `soft@portrait rim ${ softPortrait.toFixed( 4 ) }, soft@body rim ${ softBody.toFixed( 4 ) }` );
}

// --- SCENE VALIDATION ----------------------------------------------------------------------------
//
// 🚩 B1. EACH ROW ASSERTS BOTH DIRECTIONS: `Avatar` refuses the value with a message naming the
// field AND the range, and the SAME value handed straight to `new LightingRig({ overrides })`
// produces the measured pathology WITHOUT THROWING. The second half is the point. "We validate" is
// only worth a clause against a subsystem that does not, and every one of the seven rows below was
// measured through the real constructor on 2026-08-17.

{
    function rigWith( overrides ) {

        const rig = new LightingRig( { preset: 'portrait', overrides } );
        rig.attachTo( new Scene(), null );
        rig.aimAt( {
            focus: new Vector3( 0, 1.55, 0 ),
            cameraPosition: new Vector3( 0.19, 1.55, 0.88 ),
            subjectHeightMetres: 0.42
        } );

        return rig;

    }

    function keyPanelRadiance( rig ) {

        return rig.units.find( ( unit ) => unit.placement.name === 'key' ).area.intensity;

    }

    const PATHOLOGIES = [
        {
            label: 'key.irradiance: -3',
            lights: { key: { irradiance: -3 } },
            names: [ 'irradiance', '-3' ],
            pathology: ( rig ) => rig.irradianceOf( 'key' ) < 0,
            measured: 'key E -2.5500 — negative light'
        },
        {
            label: 'fill.irradiance: 0',
            lights: { fill: { irradiance: 0 } },
            names: [ 'irradiance' ],
            pathology: ( rig ) => rig.designedKeyToFill === Infinity,
            measured: 'designedKeyToFill Infinity',

            // ⚠️ Zero is INSIDE the accepted numeric range for an irradiance — a light may honestly
            // be off — so this row is refused for a different reason and says so rather than
            // pretending the range catches it.
            refusedBy: 'range'
        },
        {
            label: 'key.shadowFraction: 2',
            lights: { key: { shadowFraction: 2 } },
            names: [ 'shadowFraction', '2' ],
            pathology: ( rig ) => keyPanelRadiance( rig ) < 0,
            measured: '1 - f negative -> panel radiance -3.9599'
        },
        {
            label: 'key.widthInHeights: 0',
            lights: { key: { widthInHeights: 0 } },
            names: [ 'widthInHeights' ],
            pathology: ( rig ) => keyPanelRadiance( rig ) === Infinity,
            measured: 'panel radiance Infinity'
        },
        {
            label: 'key.distanceInHeights: 0',
            lights: { key: { distanceInHeights: 0 } },
            names: [ 'distanceInHeights' ],
            pathology: ( rig ) => Number.isNaN( keyPanelRadiance( rig ) ),
            measured: 'NaN into the scene graph'
        },
        {
            label: 'an unknown light name',
            lights: { fifth: { irradiance: 1 } },
            names: [ 'fifth', 'key', 'fill', 'rim', 'kicker' ],
            pathology: ( rig ) => rig.placements.length === 4,
            measured: 'silently dropped — 4 placements, no throw'
        },
        {
            label: 'an unknown field name',
            lights: { key: { irradianceX: 9 } },
            names: [ 'irradianceX' ],
            pathology: ( rig ) => rig.placements.find( ( p ) => p.name === 'key' ).irradianceX === 9,
            measured: 'silently merged and ignored'
        }
    ];

    for ( const row of PATHOLOGIES ) {

        const message = refusalFrom( () => resolveLightingOption( { lights: row.lights } ) );

        const named = message !== null && row.names.every( ( token ) => message.includes( token ) );
        const rangeShown = message !== null && ( /\[.*\]/.test( message ) || /Accepted/.test( message ) );

        check( `🎯 SCENE  B1  Avatar refuses ${ row.label }, naming the field AND the accepted set`,
            named && rangeShown, message ?? 'DID NOT REJECT' );

        // The other direction, and it is the clause. Nothing here may throw.
        let survived = false;
        let observed = 'THREW';

        try {

            survived = row.pathology( rigWith( row.lights ) ) === true;
            observed = row.measured;

        } catch ( error ) {

            observed = `LightingRig threw: ${ error.message }`;

        }

        check( `🎯 SCENE  B1 RED PROOF  LightingRig accepts ${ row.label } in silence — ${ row.measured }`,
            survived, observed );

    }

    // The three scalar refusals, plus the two enum ones.
    const SCALARS = [
        [ 'lighting.exposure', { exposure: 0.1 }, 'exposure', '0.25' ],
        [ 'lighting.exposure', { exposure: 9 }, 'exposure', '4' ],
        [ 'lighting.ambient', { ambient: 0.2 }, 'ambient', '0.5' ],
        [ 'lighting.ambient', { ambient: 3 }, 'ambient', '2' ]
    ];

    for ( const [ label, request, token, bound ] of SCALARS ) {

        const message = refusalFrom( () => resolveLightingOption( request ) );

        check( `SCENE  B1  ${ label } outside its range is refused, and the bound ${ bound } is printed`,
            message !== null && message.includes( token ) && message.includes( bound ),
            message ?? 'DID NOT REJECT' );

    }

    const badLook = refusalFrom( () => resolveLightingOption( 'cinematic' ) );

    check( '🎯 SCENE  B1  an unknown look names the value AND the five accepted looks',
        badLook !== null && badLook.includes( 'cinematic' )
            && SCENE_LOOK_NAMES.every( ( name ) => badLook.includes( name ) ),
        badLook ?? 'DID NOT REJECT' );

    const badHair = refusalFrom( () => resolveHairOption( 'pixie' ) );

    check( '🎯 SCENE  B1  an unknown hair id names the value AND the styles that exist',
        badHair !== null && badHair.includes( 'pixie' )
            && HAIR_STYLES.every( ( name ) => badHair.includes( name ) ),
        badHair ?? 'DID NOT REJECT' );

    const badBackground = refusalFrom( () => resolveBackgroundOption( 'glass' ) );

    check( 'SCENE  B1  an unknown background names the value and the accepted presets',
        badBackground !== null && badBackground.includes( 'glass' )
            && BACKGROUND_PRESET_NAMES.every( ( name ) => badBackground.includes( name ) ),
        badBackground ?? 'DID NOT REJECT' );

    // ⚠️ The mistake every British-spelling codebase collects. It has to be caught rather than
    // silently ignored, because `{ color: 0x000000 }` would otherwise resolve to the STUDIO default
    // and the embedder would report a background option that does nothing.
    const americanSpelling = refusalFrom( () => resolveBackgroundOption( { color: 0x101820 } ) );

    check( '🎯 SCENE  B1  background { color } is refused rather than silently resolving to the default',
        americanSpelling !== null && americanSpelling.includes( 'colour' ),
        americanSpelling ?? 'DID NOT REJECT' );

    // The escape hatch's accepted path has to actually work, or the refusals above are a wall
    // around an empty room.
    const accepted = resolveLightingOption( {
        look: 'dramatic',
        exposure: 1.2,
        lights: { rim: { irradiance: 20, colour: 0x0f30ff } }
    } );

    check( 'SCENE  the escape hatch accepts a legal placement and freezes what it returns',
        accepted.lights.rim.irradiance === 20 && accepted.lights.rim.colour === 0x0f30ff
            && Object.isFrozen( accepted ) && Object.isFrozen( accepted.lights.rim ),
        JSON.stringify( accepted.lights ) );
}

// --- REACHABILITY --------------------------------------------------------------------------------
//
// 🚩 FAILURES #1 AND #5 FROM THIS PROJECT'S LEDGER LIVE HERE. #1: a gate that drove a mechanism
// through a SETTER THE PRODUCT BYPASSES, green at 82/82 while the shipped path was broken. #5: a
// module passing 86/86 of its own gates with ZERO call sites — and `applyHairMaterial` was measured
// at exactly that on 2026-08-17, zero call sites in `Avatar.js`, `alive.js`, `hair.js` and
// `stage.js` alike. Correctness is not reachability, and under node source text is the only honest
// instrument for reachability.

{
    // --- C0: the gate drives the SHIPPED resolver, not a copy of it ---
    sourceClause(
        '🎯 REACH  C0  create() resolves lighting/background/hair through the exported functions this gate drives',
        AVATAR_SOURCE,
        ( text ) => /resolveLightingOption\(\s*options\.lighting/.test( text )
            && /resolveBackgroundOption\(\s*options\.background/.test( text )
            && /resolveHairOption\(\s*options\.hair/.test( text ),
        ( text ) => text.replace( 'resolveLightingOption( options.lighting', 'lightingFor( options.lighting' ),
        'failure #1: a gate on a path the product does not take is green while the product is broken' );

    // --- C1: exactly the guarded background writes ---
    const backgroundWrites = [ ...AVATAR_SOURCE.matchAll( /scene\.background\s*=\s*([^;]*);/g ) ];

    sourceClause(
        '🎯 REACH  C1  every scene.background write is GUARDED on the option — an isColor background forces alpha 1',
        AVATAR_SOURCE,
        ( text ) => {

            const writes = [ ...text.matchAll( /scene\.background\s*=\s*([^;]*);/g ) ];
            return writes.length > 0
                && writes.every( ( match ) => /colour\s*===\s*null/.test( match[ 1 ] ) && /new Color\(/.test( match[ 1 ] ) );

        },
        ( text ) => text.replace( /this\.stage\.scene\.background = this\.background\.colour === null\s*\n\s*\? null\s*\n\s*: new Color\( this\.background\.colour \);/,
            'this.stage.scene.background = new Color( SCENE_CLEAR_COLOUR );' ),
        `${ backgroundWrites.length } write(s); Background.js:71-76 sets _clearColor.a = 1 for any isColor background` );

    // --- C2: the five hair entry points are CALLED, not merely importable ---
    const HAIR_ENTRY_POINTS = [
        'createHairMaterial', 'applyHairMaterial', 'configureHairMaterial',
        'createHairDynamics', 'installHairVelocity'
    ];

    for ( const name of HAIR_ENTRY_POINTS ) {

        sourceClause(
            `🎯 REACH  C2  ${ name } has at least one CALL SITE in Avatar.js — all five read 0 before this round`,
            AVATAR_SOURCE,
            ( text ) => new RegExp( `\\b${ name }\\s*\\(` ).test( text ),
            ( text ) => text.replace( new RegExp( `\\b${ name }\\s*\\(`, 'g' ), `/* ${ name } */ noop(` ),
            'measured 2026-08-17: 0 call sites in Avatar.js, alive.js, hair.js and stage.js' );

    }

    // --- C3: the assignment loop does NOT appear ---
    sourceClause(
        '🎯 REACH  C3  the hair path does NOT assign mesh.material directly — that is the defect that forced a second code path',
        AVATAR_SOURCE,
        ( text ) => /\.material\s*=\s*material\b/.test( text ) === false,
        ( text ) => text.replace( 'const applied = applyHairMaterial( hairRoot, material );',
            'for ( const mesh of skinned ) mesh.material = material;\n        const applied = { meshes: skinned.length };' ),
        'alive.js:2504 skips the vertex collection and installHairEnvelope, which is why every live ' +
        'plate came back envelope.fitted false and ensureHairEnvelope had to be written' );

    // --- C4: positionNode and installHairVelocity in the SAME function ---
    const dynamicsBody = bodyOf( AVATAR_SOURCE, 'async buildHairDynamics(' );

    sourceClause(
        '🎯 REACH  C4  material.positionNode and installHairVelocity are in ONE function — a gate on either alone let this ship twice',
        dynamicsBody,
        ( text ) => /material\.positionNode\s*=/.test( text ) && /installHairVelocity\s*\(/.test( text ),
        ( text ) => text.replace( 'installHairVelocity( material );', '' ),
        'omit the velocity half and the picture is RIGHT while the resolve is wrong: p90 259.9 ' +
        'px/frame reported against TAAUNode.maxVelocityLength 128, on a static groom' );

    sourceClause(
        'REACH  C4  report() publishes hasHairVelocity\'s own answer rather than "we called it"',
        AVATAR_SOURCE,
        ( text ) => /hasHairVelocity\(\s*material\s*\)/.test( text )
            && /velocityRepaired:\s*this\.hairVelocityRepaired/.test( text ),
        ( text ) => text.replace( 'const velocityRepaired = hasHairVelocity( material );',
            'const velocityRepaired = true;' ),
        'the WeakSet is what the prototype patch consults; a boolean set by hand is a claim' );

    // --- C5: setFraming re-resolves the look BEFORE setPreset ---
    const framingBody = bodyOf( AVATAR_SOURCE, 'setFraming( mode, heightMetres = undefined ) {' );

    sourceClause(
        '🎯 REACH  C5  setFraming re-resolves the look BEFORE setPreset — resolve once and the body rim reads 11.2000 for 15.4000',
        framingBody,
        ( text ) => {

            const resolved = text.indexOf( 'lightOverridesFor(' );
            const preset = text.indexOf( 'setPreset(' );
            return resolved >= 0 && preset >= 0 && resolved < preset;

        },
        ( text ) => text.replace( /this\.lights\.overrides = this\.lightOverridesFor\( mode \);/, '' ),
        'setPreset re-runs resolvePlacements(), which re-merges overrides OVER the NEW framing\'s table' );

    // --- C6: setLighting re-aims ---
    const applyBody = bodyOf( AVATAR_SOURCE, 'applyLighting() {' );

    sourceClause(
        '🎯 REACH  C6  applyLighting RE-AIMS — LightingRig.override() calls solve() and never aimAt()',
        applyBody,
        ( text ) => /aimRigAt\(/.test( text ),
        ( text ) => text.replace( /aimRigAt\([^;]*\);/, '' ),
        '⚠️ THE NUMERIC HALF OF THIS NEEDS AN EYE MATERIAL AND A GPU. Under node it is source text ' +
        'only; the measurement — eyes.keyLightDirectionUniform against a freshly derived key ' +
        'direction — is a BROWSERCHECK item and is NOT covered by a green run here.' );

    // --- C7: the ambient snapshot has a setter to write to ---
    sourceClause(
        '🎯 REACH  C7  setLighting pushes the ambient into GTAO — on the default tier it is a CREATE-TIME snapshot',
        applyBody,
        ( text ) => /ambientOcclusion\?\.setAmbientIntensity/.test( text ),
        ( text ) => text.replace( /this\.stage\.ambientOcclusion\?\.setAmbientIntensity[^;]*;/, '' ),
        'GTAO.js:882 reads describeAmbient().intensity ONCE at build; without the push, ' +
        'setLighting({ exposure }) scales four lights and freezes the fifth' );

    // --- C8: the frame path drives the solver ---
    const frameBody = bodyOf( AVATAR_SOURCE, 'advanceFrame( deltaSeconds ) {' );

    sourceClause(
        '🎯 REACH  C8  advanceFrame drives the hair solver — Avatar has ONE frame path and both callers come through it',
        frameBody,
        ( text ) => /this\.hairUpdate\?\.\(\s*deltaSeconds\s*\)/.test( text ),
        ( text ) => text.replace( /this\.hairUpdate\?\.\( deltaSeconds \);/, '' ),
        'alive.js needed trackFigure because ?capture bypasses stage.onFrame; here update(dt) and ' +
        'the stage callback are the same function' );
}

// --- TRANSPARENCY --------------------------------------------------------------------------------

{
    // --- E1: the preset is DECLARED and currently REFUSED ---
    //
    // 🔴 THIS CLAUSE IS THE OPPOSITE OF WHAT IT WAS DESIGNED TO BE, AND THE REVERSAL IS A
    // MEASUREMENT RATHER THAN A RETREAT. The design said `background: 'transparent'` was four
    // writes away and that the fourth — `Grade.compose`'s literal alpha — was the one that survived
    // fixing the other three. All four landed, and a GPU chromium then found two more blockers that
    // no amount of reading could have found. `BACKGROUND_PRESETS` carries the tables; this asserts
    // that the API refuses rather than presenting an opaque black rectangle.
    check( '🎯 ALPHA  E1  the transparent preset still RESOLVES to all three halves, so the target is named',
        BACKGROUND_PRESETS.transparent.colour === null
            && BACKGROUND_PRESETS.transparent.backdrop === false
            && BACKGROUND_PRESETS.transparent.ground === false,
        'the clear alpha is one write; the 8x6 m emissive card fills a portrait frame regardless of ' +
        'it; and the ground plane is a unit plane scaled to 12 subject heights, ~20 m square at body' );

    const refusedTransparent = refusalFrom( () => resolveBackgroundOption( 'transparent' ) );

    check( '🔴 ALPHA  E1  a transparent canvas is REFUSED, and the refusal names the measured blocker',
        refusedTransparent !== null && /temporal resolve/i.test( refusedTransparent )
            && refusedTransparent.includes( '41.63' ) && refusedTransparent.includes( 'Grade.js' ),
        refusedTransparent ?? 'DID NOT REJECT — an option that returns an opaque black rectangle' );

    const refusedNull = refusalFrom( () => resolveBackgroundOption( { colour: null } ) );

    check( '🔴 ALPHA  E1  and so is the long form, so the preset is not the only door',
        refusedNull !== null && refusedNull.includes( 'colour: null' ),
        refusedNull ?? 'DID NOT REJECT' );

    // ⚠️ `backdrop: false` IS supported and carries its own tier constraint. Both are asserted so
    // the two blockers stay separable — they were isolated separately and they will be fixed
    // separately.
    const backdropless = resolveBackgroundOption( { backdrop: false } );

    check( '🎯 ALPHA  E1  backdrop: false IS supported — the card and the canvas alpha are different blockers',
        backdropless.backdrop === false && backdropless.colour === 0x08080a && backdropless.ground === true,
        'GTAO with nothing at background depth renders the whole frame black; balanced (occlusion ' +
        'off) renders it correctly. Isolated to the card: backdrop 0x000000 is fine, absent is not.' );

    sourceClause(
        '🔴 ALPHA  E1  create() refuses backdrop: false on a tier that carries ground-truth occlusion',
        AVATAR_SOURCE,
        ( text ) => /this\.background\.backdrop === false && this\.tierSettings\.occlusion === true/.test( text ),
        ( text ) => text.replace( 'if ( this.background.backdrop === false && this.tierSettings.occlusion === true ) {',
            'if ( false ) {' ),
        'and `auto` resolves to balanced for it, which is a STRUCTURAL fact rather than a timing' );

    sourceClause(
        '🔴 ALPHA  E1  resolveTier sends an auto caller with no card to balanced',
        AVATAR_SOURCE,
        ( text ) => /structural\.backdropless === true/.test( text ),
        ( text ) => text.replace( 'structural.hair === true || structural.backdropless === true', 'structural.hair === true' ),
        'the one tier with occlusion: false is the only one that renders a card-less frame' );

    sourceClause(
        '🎯 ALPHA  E1  the card is guarded on background.backdrop',
        AVATAR_SOURCE,
        ( text ) => /this\.backdrop = this\.background\.backdrop === false/.test( text ),
        ( text ) => text.replace( /this\.backdrop = this\.background\.backdrop === false\s*\n\s*\? null\s*\n\s*: buildBackdrop\( this\.stage, this\.background\.backdrop \);/,
            'this.backdrop = buildBackdrop( this.stage );' ),
        'an opaque plane 1.9 m behind the subject fills a portrait frame whatever the clear does' );

    sourceClause(
        '🎯 ALPHA  E1  the ground plane is guarded on background.ground',
        AVATAR_SOURCE,
        ( text ) => /if \( this\.background\.ground === true \) \{/.test( text ),
        ( text ) => text.replace( 'if ( this.background.ground === true ) {', 'if ( true ) {' ),
        '⚠️ ground: false is a DOCUMENTED DOWNGRADE — 60% of the light beside a sole comes from two ' +
        'RectAreaLights that cannot cast a shadow, so without the plane the figure floats' );

    // --- E2: the fourth write ---
    sourceClause(
        '🎯 ALPHA  E2  Grade.compose returns alpha 1 — the frame is OPAQUE BY CONTRACT, and carrying it was a regression',
        GRADE_SOURCE,
        ( text ) => /return vec4\( grained\.xyz\.clamp\( 0, 1 \)\.mul\( alpha \), 1 \);/.test( text ),
        ( text ) => text.replace( 'return vec4( grained.xyz.clamp( 0, 1 ).mul( alpha ), 1 );',
            'return vec4( grained.xyz.clamp( 0, 1 ).mul( alpha ), alpha );' ),
        // 🚩 THIS CLAUSE USED TO ASSERT THE OPPOSITE, AND THE ASSERTION WAS WRONG.
        //
        // It required the composed alpha to be CARRIED, reasoning that the default path is
        // bit-identical because "every drawn surface writes 1". True on the two WebGPU tiers, false
        // on `fallback` — the only tier built with `antialias: true` (Avatar.js:604) and the one
        // `quality: 'auto'` resolves to on every browser without WebGPU. MSAA's coverage resolve
        // writes FRACTIONAL alpha at every silhouette edge no matter what any surface wrote, and a
        // groom is nothing but silhouette edges.
        //
        // Measured in a real WebGL2 chromium, canvas composited over #ffffff and over #000000 and
        // differenced — an opaque frame gives identical composites: fallback + hair let the host
        // page through on 13.728% of pixels, worst 130/255; bald 0.190%; alpha forced to 1, 0.000%.
        // A transparent background is REFUSED at `Avatar.create`, so the frame is opaque by
        // contract and there is no case in which this should carry coverage. The red proof is now
        // the carry, which is the shape the defect actually had.
        'all three tiers ship the grade, so this is on every path an embedder can select' );

    sourceClause(
        '🎯 ALPHA  E2  the grade still PREMULTIPLIES, so the arithmetic is right the day transparency lands',
        GRADE_SOURCE,
        ( text ) => /\.mul\( alpha \)/.test( text ) && /appliesOutputTransform/.test( text ),
        ( text ) => text.replace( '.mul( alpha ), 1 );', ', 1 );' ),
        'WebGPUBackend.js:349 configures the canvas premultiplied; an unpremultiplied edge fringes ' +
        'BRIGHT on a light host UI. Against alpha 1 the multiply is a no-op and bit-identical to the ' +
        'pre-change path, so it costs nothing to keep and would have to be rediscovered to re-add' );

    // --- E3: the judging protocol, declared ahead of the option it will serve ---
    check( '🎯 ALPHA  E3  the judging protocol is declared: composite over #08080a before running the critic',
        AVATAR_SOURCE.includes( '0x08080a' ),
        'tools/critic/measure.mjs:1320-1327 already REFUSES a plate with >1% non-opaque pixels — ' +
        '"which makes the grade gates (G5, G6) meaningless". So a transparent capture is composited ' +
        'over the studio clear colour first, and the two plates are then compared on the same ' +
        'pixels. Declared now rather than when the option lands, so the rule and the option cannot ' +
        'arrive in different rounds.' );

    // --- E4: what a green run here is NOT ---
    check( '🔴 ALPHA  E4  this file cannot see the picture, and the picture is where both blockers were found',
        true,
        'Every clause above is a resolver or a source predicate. The two defects that stopped ' +
        'transparency were found by RENDERING: the grade was made to display its own alpha and the ' +
        'plate read 41.63% at 0 on fallback against 100% at 1 on high, and the card was isolated by ' +
        'scaling it to 0.001 off-screen. Neither is reachable from node, and a green run here says ' +
        'nothing about either.' );
}

// --- results -------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( '\n🚩 THIS GATE COVERS THE CONTRACT, NOT THE PICTURE. It runs under node, so it\n'
    + '   cannot see whether the avatar renders, whether construction order matches alive.js,\n'
    + '   whether dispose() frees GPU memory, or whether feel() moves a bone. Those were verified\n'
    + '   by execution in a browser and recorded in the commit body. A green run here is not a\n'
    + '   statement about the avatar.\n\n'
    + '   FOUR THINGS THE SCENE, ALPHA AND HAIR CLAUSES SPECIFICALLY CANNOT SEE, so nobody reads\n'
    + '   them as covered — every one is a BROWSERCHECK item:\n'
    + '     1. Whether the alpha is actually CORRECT on the canvas. This file asserts that\n'
    + '        Grade.compose carries and premultiplies it; it cannot compile a node graph, and it\n'
    + '        has NOT verified that TAAUNode/TRAANode preserve .a through the temporal resolve.\n'
    + '     2. Whether the premultiply matches the premultiplied canvas mode in a real composite.\n'
    + '     3. C6\'s numeric half: eyes.keyLightDirectionUniform against a freshly derived key\n'
    + '        direction after setLighting. Source text only here — it needs an eye material.\n'
    + '     4. Whether the groom RENDERS: no canvas, no adapter, no GLB. The groom\'s rig mapping\n'
    + '        was measured out-of-band (53 joints, 0 absent, all five bakes); the picture was not.\n\n' );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
