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
 */

import {
    AVATAR_DEFAULTS, Avatar, FRAME_MODES, QUALITY_REQUESTS, QUALITY_TIERS, resolveAgainstBase
} from './Avatar.js';

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

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
}

// --- results -------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( '\n🚩 THIS GATE COVERS THE CONTRACT, NOT THE PICTURE. It runs under node, so it\n'
    + '   cannot see whether the avatar renders, whether construction order matches alive.js,\n'
    + '   whether dispose() frees GPU memory, or whether feel() moves a bone. Those were verified\n'
    + '   by execution in a browser and recorded in the commit body. A green run here is not a\n'
    + '   statement about the avatar.\n\n' );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
