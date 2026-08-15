#!/usr/bin/env node
//
// hair-transmittance.mjs — did giving the multiple-scattering term Zinke's ENERGY half buy
// anything, and is what it bought distinguishable from turning the term DOWN?
//
// ## The question, and why it needs two arms and not one
//
// Round 27 replaced slide 39's third factor `(C/Luma(C))^(1−Shadow)` — which is ISOLUMINANT, so
// the pedestal cannot get darker anywhere — with Zinke Eq.5's per-channel forward transmittance
// `ā_f^(1+n)`. That change DARKENS the pedestal wherever `n > 0`, and CHECKPOINT §9 records the
// exact trap this walks into:
//
//   *"`scatter` 1 → 0.25 reads p99/mass 1.735 BY DARKENING THE WHOLE GROOM 40.9%. It is a
//    brightness cut wearing a contrast ratio."*
//
// So a contrast ratio that improves is not evidence. **The control is a LEVEL-MATCHED UNIFORM
// SCATTER SCALAR**: the SHIPPED slide-39 term, multiplied by whatever constant `s*` makes its mean
// mass luminance equal the probe's, on the same pixels. If the depth-dependent arm and the
// level-matched constant arm read the same, the depth dependence bought nothing and the round is a
// negative. `s*` is SOLVED from a captured sweep, not chosen.
//
// 🔴 IT DID READ THE SAME, AND THAT IS WHY NOTHING SHIPPED. The probe survives only as
// `?hairdefect=zinke-transmittance`; the shipped default is slide 39, unchanged.
//
// ## Both sides of the trap, at every step
//
// CHECKPOINT §2's trap is that the project's contrast gate and the plate's own dynamic range move
// in OPPOSITE directions under this term. The two live in different transfer domains and on
// different pages, so both are captured:
//
//   RADIANCE  `?grade=0` at exposure 4 — p95/p50 and R p99 / mass mean.
//   GRADED    the shipped path at exposure 1, encoded luma — p95 / 0.0643, the gate's own
//             denominator (`#1A0E0C`'s encoded luma), beside that plate's own p95/p50.
//
// ## Usage
//
//   node tools/critic/hair-transmittance.selftest.mjs
//   node tools/critic/hair-transmittance.mjs --capture --port 5177 --out captures/hair-r27-tf
//   node tools/critic/hair-transmittance.mjs --control 0.09658 --port 5177 --out captures/hair-r27-tf
//   node tools/critic/hair-transmittance.mjs --report --record   --out captures/hair-r27-tf

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildGroomMask,
  codesAt,
  isInvertible,
  loadPlaywright,
  luminance,
  openPage,
  plate,
  plateToSceneLinear,
  readPlate,
  srgbToLinear,
  GPU_FLAGS,
  REPO,
} from './lightpath-probe.mjs';
import { erodeMask } from './hair-lightpath.mjs';

export const WIDTH = 720;
export const HEIGHT = 900;
const STEPS = 8;

/** Identical to `hair-pedestal.mjs`'s and `hair-lobe-sweep.mjs`'s, so every round is comparable. */
const BASE_QUERY = 'bare&freeze&seed=1&capture&aa=msaa&grade=0';

/** The shipped graded path. Same tokens minus `grade=0`, and it is read at the renderer's own 1. */
const GRADED_QUERY = 'bare&freeze&seed=1&capture&aa=msaa';

/** See `hair-lobe-sweep.mjs`'s header: one lobe on a #1A0E0C fibre is unreadable at exposure 1. */
export const EXPOSURE = 4;

/** `hair-lightpath.mjs`'s cut for "this pixel was drawn by HairMaterial", re-derived per run. */
const HAIR_SHADED_MAX = 1.5e-2;

/**
 * The contrast gate's denominator: `HAIR_BASE_COLOUR_HEX` = #1A0E0C at encoded luma. Interpolated
 * into the report's own column heading from this constant, so the label cannot disagree with the
 * arithmetic it labels — the failure `hair-pedestal.mjs` records at the same spot.
 */
export const ASSUMED_ALBEDO_LUMA = ( 0.2126 * 0x1a + 0.7152 * 0x0e + 0.0722 * 0x0c ) / 255;

/** The shipped term's scatter scalars, swept so `s*` is solved rather than picked. */
export const LEVEL_ARMS = [ 0, 0.05, 0.1, 0.2, 0.4 ];

// --- operators, every one of them validated in `--selftest` -------------------------------------

/**
 * Linear interpolation of the scatter scalar that matches a target mean.
 *
 * 🎯 THE MONOTONICITY IS NOT AN ASSUMPTION, IT IS ARITHMETIC. The shipped term enters the shaded
 * result as `+ scatter · S` with `S ≥ 0` and everything else in the expression independent of the
 * scalar, so mean luminance is AFFINE and strictly increasing in it. That is why a two-point
 * interpolation between the bracketing arms is exact up to the tone curve, and why this function
 * REFUSES rather than extrapolates when the target sits outside the swept range: an extrapolated
 * `s*` would be a level match nobody measured.
 *
 * @param {number[]} scalars - the swept scatter scalars, ascending.
 * @param {number[]} means - each arm's mean mass luminance, in the same order.
 * @param {number} target - the mean to match.
 * @returns {?number} the interpolated scalar, or null if `target` is outside the swept range.
 */
export function solveLevelMatch( scalars, means, target ) {

    if ( scalars.length !== means.length || scalars.length < 2 ) return null;

    for ( let index = 0; index + 1 < scalars.length; index += 1 ) {

        const low = means[ index ];
        const high = means[ index + 1 ];

        if ( target < Math.min( low, high ) || target > Math.max( low, high ) ) continue;
        if ( high === low ) return scalars[ index ];

        const t = ( target - low ) / ( high - low );

        return scalars[ index ] + t * ( scalars[ index + 1 ] - scalars[ index ] );

    }

    return null;

}

/** Saturation as `(max − min)/max`, and hue in degrees. Both on LINEAR RGB, both hand-checkable. */
export function chroma( [ r, g, b ] ) {

    const max = Math.max( r, g, b );
    const min = Math.min( r, g, b );

    if ( max <= 0 ) return { saturation: 0, hueDegrees: 0, redOverBlue: 0 };

    let hue = 0;
    const span = max - min;

    if ( span > 0 ) {

        if ( max === r ) hue = 60 * ( ( ( g - b ) / span ) % 6 );
        else if ( max === g ) hue = 60 * ( ( b - r ) / span + 2 );
        else hue = 60 * ( ( r - g ) / span + 4 );

    }

    return {
        saturation: span / max,
        hueDegrees: ( hue + 360 ) % 360,
        redOverBlue: b > 0 ? r / b : Infinity
    };

}

/**
 * Spearman's rank correlation, average ranks on ties.
 *
 * 🚩 IT RETURNS EXACTLY 0 ON A CONSTANT INPUT rather than a small positive number, and that clause
 * is the one this round needs: the question it is asked is whether the depth-dependent arm and a
 * level-matched constant multiple of the OLD arm are the same picture, and a rank operator that
 * leaked a trend on a degenerate input would answer "different" for free.
 */
export function spearman( a, b ) {

    if ( a.length !== b.length || a.length < 2 ) return 0;

    const rank = ( values ) => {

        const order = values.map( ( v, i ) => [ v, i ] ).sort( ( x, y ) => x[ 0 ] - y[ 0 ] );
        const ranks = new Float64Array( values.length );

        let index = 0;

        while ( index < order.length ) {

            let end = index;
            while ( end + 1 < order.length && order[ end + 1 ][ 0 ] === order[ index ][ 0 ] ) end += 1;

            const shared = ( index + end ) / 2;
            for ( let k = index; k <= end; k += 1 ) ranks[ order[ k ][ 1 ] ] = shared;

            index = end + 1;

        }

        return ranks;

    };

    const ra = rank( a );
    const rb = rank( b );
    const mean = ( ra.length - 1 ) / 2;

    let cov = 0;
    let va = 0;
    let vb = 0;

    for ( let i = 0; i < ra.length; i += 1 ) {

        const da = ra[ i ] - mean;
        const db = rb[ i ] - mean;
        cov += da * db;
        va += da * da;
        vb += db * db;

    }

    return va === 0 || vb === 0 ? 0 : cov / Math.sqrt( va * vb );

}

export function percentile( sorted, q ) {

    if ( sorted.length === 0 ) return 0;

    const index = Math.min( sorted.length - 1, Math.max( 0, Math.round( q * ( sorted.length - 1 ) ) ) );

    return sorted[ index ];

}

export function stats( values ) {

    const sorted = [ ...values ].sort( ( a, b ) => a - b );
    const mean = values.reduce( ( a, b ) => a + b, 0 ) / Math.max( 1, values.length );

    return {
        n: values.length,
        mean,
        min: sorted[ 0 ] ?? 0,
        p10: percentile( sorted, 0.10 ),
        p50: percentile( sorted, 0.50 ),
        p90: percentile( sorted, 0.90 ),
        p95: percentile( sorted, 0.95 ),
        p99: percentile( sorted, 0.99 ),
        max: sorted[ sorted.length - 1 ] ?? 0
    };

}

// --- page plumbing, lifted verbatim in shape from `hair-pedestal.mjs` ----------------------------

async function waitForFigure( page ) {

    await page.waitForFunction(
        async () => ( await globalThis.__SUGATA_STEP__( 0 ) ) === true,
        null, { timeout: 180_000, polling: 250 } );

}

async function withPage( port, query, fn ) {

    const { chromium } = await loadPlaywright();
    // 🚩 `channel: 'chromium'` IS LOAD-BEARING AND ITS ABSENCE IS SILENT — see `hair-lobe-sweep.mjs`.
    const browser = await chromium.launch( { channel: 'chromium', args: GPU_FLAGS } );

    try {

        const url = `http://localhost:${ port }/alive.html?${ query }`;
        const { context, page, errors } = await openPage( browser, url, { width: WIDTH, height: HEIGHT } );

        try {

            await waitForFigure( page );
            const out = await fn( page, url );
            if ( errors.length > 0 ) console.log( `  page errors: ${ errors.join( ' | ' ) }` );
            return out;

        } finally { await context.close(); }

    } finally { await browser.close(); }

}

const SET_EXPOSURE = ( value ) => { window.sugata.stage.renderer.toneMappingExposure = value; };

const CENSUS_SCRIPT = () => {

    const s = window.sugata;
    let material = null;
    let describe = null;

    s.stage.scene.traverse( ( o ) => {

        if ( o.material?.name === 'sugata.hair' ) {

            material = o.material.constructor.name;
            describe = o.material.describe ? o.material.describe() : null;

        }

    } );

    return {
        materialClass: material,
        hairDefect: describe?.defect ?? null,
        scatter: describe?.scatter ?? null,
        shadowMapEnabled: s.stage.renderer.shadowMap.enabled,
        toneMappingExposure: s.stage.renderer.toneMappingExposure
    };

};

async function shoot( port, out, name, query, manifest, exposure = EXPOSURE ) {

    const file = path.join( out, `${ name }.png` );

    await withPage( port, query, async ( page, url ) => {

        await page.evaluate( SET_EXPOSURE, exposure );
        const census = await page.evaluate( CENSUS_SCRIPT );
        await plate( page, file, STEPS );

        manifest[ name ] = { url, exposure, census };
        console.log( `  ${ name.padEnd( 16 ) } <- ${ url }   [exposure=${ exposure }, defect=${ census.hairDefect }, scatter=${ census.scatter }]` );

        // 🚩 PROVENANCE IS PART OF THE EXPERIMENT — `packages/testbed/src/hair.html` runs a
        // `MeshStandardNodeMaterial` with `shadowMap.enabled` false, and a round was invalidated
        // because nothing beside its plates said so.
        // ⚠️ `mask-bald` is the ONE arm with no groom in the scene, so it has no hair material to
        // report and a check that fired there would train a reader to ignore this line.
        if ( query.includes( 'hair=1' ) && census.materialClass !== 'HairNodeMaterial' ) {

            console.log( `  🔴 PROVENANCE: materialClass is ${ census.materialClass }, not HairNodeMaterial` );

        }

        if ( census.shadowMapEnabled !== true && query.includes( 'shadows=0' ) === false ) {

            console.log( '  🔴 PROVENANCE: renderer.shadowMap.enabled is false on a shadows-on arm' );

        }

    } );

}

/** The pixels every arm agrees are hair, so every row of the report is one pixel set. */
function gate( out, armNames ) {

    const read = ( name ) => readPlate( path.join( out, `${ name }.png` ) );
    const solid = erodeMask( buildGroomMask( read( 'mask-bald' ), read( 'mask-haired' ) ), WIDTH, HEIGHT, 2 );
    const floor = read( 'floor' );

    const plates = Object.fromEntries( armNames.map( ( n ) => [ n, read( n ) ] ) );
    const every = [ floor, ...Object.values( plates ) ];

    const set = [];
    let inside = 0;

    for ( let k = 0; k < WIDTH * HEIGHT; k += 1 ) {

        if ( solid[ k ] !== 1 ) continue;

        const codes = codesAt( floor, k * 4 );
        if ( isInvertible( codes ) === false ) continue;
        inside += 1;

        if ( luminance( plateToSceneLinear( codes, EXPOSURE ) ) >= HAIR_SHADED_MAX ) continue;
        if ( every.every( ( p ) => isInvertible( codesAt( p, k * 4 ) ) ) === false ) continue;

        set.push( k );

    }

    return { set, inside, floor, plates };

}

// --- capture ------------------------------------------------------------------------------------

async function capture( port, out ) {

    fs.mkdirSync( out, { recursive: true } );
    const manifestPath = path.join( out, 'manifest.json' );
    const manifest = fs.existsSync( manifestPath ) ? JSON.parse( fs.readFileSync( manifestPath, 'utf8' ) ) : {};

    // 🚩 THE PROBE IS THE DEFECT ARM AND THE SHIPPED TERM IS THE DEFAULT, because round 27 refused
    // the probe. `-tf` names the Zinke transmittance arm and `-s39` the shipped slide 39 one, in
    // both directions, so the arm names keep their meaning whichever way the material's default
    // points and a plate captured this session still reads correctly if a later round flips it.
    const PROBE = '&hairdefect=zinke-transmittance';

    await shoot( port, out, 'mask-bald', `${ BASE_QUERY }&shadows=0`, manifest );
    await shoot( port, out, 'mask-haired', `${ BASE_QUERY }&shadows=0&hair=1`, manifest );

    // The indirect floor — no lobe, no pedestal. Every radiance row below is measured above it.
    await shoot( port, out, 'floor', `${ BASE_QUERY }&hair=1&hairlobes=&hairscatter=0`, manifest );

    await shoot( port, out, 'mass-tf', `${ BASE_QUERY }&hair=1${ PROBE }`, manifest );
    await shoot( port, out, 'mass-s39', `${ BASE_QUERY }&hair=1`, manifest );
    await shoot( port, out, 'r-only', `${ BASE_QUERY }&hair=1&hairlobes=r&hairscatter=0`, manifest );
    await shoot( port, out, 'ped-tf', `${ BASE_QUERY }&hair=1&hairlobes=&hairscatter=1${ PROBE }`, manifest );
    await shoot( port, out, 'ped-s39', `${ BASE_QUERY }&hair=1&hairlobes=&hairscatter=1`, manifest );

    // 🎯 THE LEVEL-MATCH SWEEP. The SHIPPED term at scalars that bracket the probe's brightness, so
    // `s*` is interpolated from measured plates rather than chosen.
    for ( const s of LEVEL_ARMS ) {

        // eslint-disable-next-line no-await-in-loop
        await shoot( port, out, `lvl-s${ String( s ).replace( '.', 'p' ) }`,
            `${ BASE_QUERY }&hair=1&hairscatter=${ s }`, manifest );

    }

    // The graded path, at the renderer's own exposure. Both sides of the trap, same tree, same run.
    await shoot( port, out, 'graded-tf', `${ GRADED_QUERY }&hair=1${ PROBE }`, manifest, 1 );
    await shoot( port, out, 'graded-s39', `${ GRADED_QUERY }&hair=1`, manifest, 1 );

    fs.writeFileSync( manifestPath, JSON.stringify( manifest, null, 2 ) );
    console.log( `  wrote ${ manifestPath }` );

}

/** Second capture phase: the level-matched control, at the `s*` `--report` solved. */
async function captureControl( port, out, star ) {

    const manifestPath = path.join( out, 'manifest.json' );
    const manifest = JSON.parse( fs.readFileSync( manifestPath, 'utf8' ) );

    await shoot( port, out, 'ctl', `${ BASE_QUERY }&hair=1&hairscatter=${ star }`, manifest );
    await shoot( port, out, 'graded-ctl', `${ GRADED_QUERY }&hair=1&hairscatter=${ star }`, manifest, 1 );

    manifest.levelMatch = { star };
    fs.writeFileSync( manifestPath, JSON.stringify( manifest, null, 2 ) );
    console.log( `  wrote ${ manifestPath }` );

}

// --- report -------------------------------------------------------------------------------------

/**
 * 🚩 WHY THIS FILE EXISTS, AND WHAT IT DOES NOT PROVE. `/captures/` is gitignored — the plates are
 * large and regenerable — so a `@claim` whose producer read them would go red on a clean tree and
 * `tools/quoted-numbers.mjs` could not gate a single number this round measured. Round 26 shipped a
 * false number for exactly this reason: the sentence was not tagged, and the gate certified the
 * round green anyway.
 *
 * So `--report --record` writes what it measured HERE, machine-written, committed, and the selftest
 * prints it under stable selectors for the claims in `HairMaterial.js` to be checked against.
 *
 * ⚠️ STATE THE LIMIT: this checks PROSE against a RECORDED MEASUREMENT, not prose against pixels.
 * It catches the failure this project actually has — a number typed into a comment that disagrees
 * with the read-out that produced it — and it cannot catch a stale record. `--report --record`
 * rewrites it from the plates on every run, and the record carries the capture directory and the
 * gate size so a reader can tell which run it is.
 */
const RECORD = path.join( REPO, 'tools', 'critic', 'hair-transmittance.measured.json' );

function report( out, record = false ) {

    const manifestPath = path.join( out, 'manifest.json' );
    const manifest = JSON.parse( fs.readFileSync( manifestPath, 'utf8' ) );

    const levelNames = LEVEL_ARMS.map( ( s ) => `lvl-s${ String( s ).replace( '.', 'p' ) }` );
    const hasControl = manifest.ctl !== undefined;
    const armNames = [ 'mass-tf', 'mass-s39', 'r-only', 'ped-tf', 'ped-s39', ...levelNames,
        ...( hasControl ? [ 'ctl' ] : [] ) ];

    const { set, inside, floor, plates } = gate( out, armNames );

    console.log( `\n  GATE  ${ inside } invertible pixels in the eroded groom mask; ${ set.length } shaded by HairMaterial AND invertible in all ${ armNames.length + 1 } arms.` );
    console.log( '  Every row below is that one pixel set.' );

    for ( const [ name, entry ] of Object.entries( manifest ) ) {

        if ( entry?.census?.materialClass && entry.census.materialClass !== 'HairNodeMaterial' ) {

            console.log( `  🔴 PROVENANCE ${ name }: ${ entry.census.materialClass }` );

        }

    }

    const rgbAt = ( png, k, exposure = EXPOSURE ) => plateToSceneLinear( codesAt( png, k * 4 ), exposure );
    const floorRgb = set.map( ( k ) => rgbAt( floor, k ) );
    const floorL = floorRgb.map( luminance );

    const above = ( name ) => set.map( ( k, i ) => luminance( rgbAt( plates[ name ], k ) ) - floorL[ i ] );
    const meanRgb = ( name ) => {

        const total = [ 0, 0, 0 ];
        set.forEach( ( k, i ) => {

            const rgb = rgbAt( plates[ name ], k );
            for ( let c = 0; c < 3; c += 1 ) total[ c ] += rgb[ c ] - floorRgb[ i ][ c ];

        } );

        return total.map( ( v ) => v / set.length );

    };

    const rL = above( 'r-only' );
    const rStats = stats( rL );

    // --- 1. the level match, solved -------------------------------------------------------------

    const massTf = above( 'mass-tf' );
    const massTfStats = stats( massTf );
    const levelMeans = levelNames.map( ( n ) => stats( above( n ) ).mean );
    const star = solveLevelMatch( LEVEL_ARMS, levelMeans, massTfStats.mean );

    console.log( '\n================================================================================' );
    console.log( ' 1. THE LEVEL-MATCHED CONTROL, SOLVED FROM PLATES' );
    console.log( '================================================================================\n' );
    console.log( `    target: the round-27 arm's mean mass rise above the floor = ${ massTfStats.mean.toExponential( 4 ) }\n` );
    console.log( '    scatter   mean rise    ' );

    LEVEL_ARMS.forEach( ( s, i ) => console.log( `    ${ String( s ).padStart( 7 ) }   ${ levelMeans[ i ].toExponential( 4 ) }` ) );

    console.log( `\n    🎯 s* = ${ star === null ? 'OUT OF RANGE — the sweep does not bracket the target' : star.toFixed( 6 ) }` );

    if ( hasControl ) {

        const ctl = stats( above( 'ctl' ) );
        console.log( `    control captured at s* : mean rise ${ ctl.mean.toExponential( 4 ) }, ` +
            `${ ( ( ctl.mean / massTfStats.mean - 1 ) * 100 ).toFixed( 2 ) }% from the target` );

    }

    // --- 2. both sides of the trap --------------------------------------------------------------

    console.log( '\n================================================================================' );
    console.log( ' 2. ⚠️ BOTH SIDES OF THE TRAP — radiance dynamic range AND the contrast gate' );
    console.log( '================================================================================\n' );

    const radianceRows = [
        [ 'A  slide 39 (the defect arm)', 'mass-s39' ],
        [ 'B  round 27, Zinke T_f', 'mass-tf' ],
        ...( hasControl ? [ [ 'C  A at s*, LEVEL MATCHED', 'ctl' ] ] : [] )
    ];

    console.log( '  RADIANCE, ?grade=0 at exposure 4, floor subtracted' );
    console.log( '    arm                            mean       p50        p95     p95/p50   R p99/mean   pedestal share' );

    for ( const [ label, name ] of radianceRows ) {

        const s = stats( above( name ) );
        const pedName = name === 'mass-s39' ? 'ped-s39' : ( name === 'mass-tf' ? 'ped-tf' : null );
        const ped = pedName === null ? null : stats( above( pedName ) );

        console.log(
            `    ${ label.padEnd( 30 ) } ${ s.mean.toExponential( 3 ) }  ${ s.p50.toExponential( 3 ) }  ` +
            `${ s.p95.toExponential( 3 ) }   ${ ( s.p95 / s.p50 ).toFixed( 3 ) }      ` +
            `${ ( rStats.p99 / s.mean ).toFixed( 3 ) }        ` +
            `${ ped === null ? '   n/a' : `${ ( 100 * ped.mean / s.mean ).toFixed( 2 ) }%` }` );

    }

    console.log( `\n  GRADED, the shipped path at exposure 1, encoded luma; the gate divides by ${ ASSUMED_ALBEDO_LUMA.toFixed( 4 ) } (#1A0E0C)` );
    console.log( '    arm                            p50        p95      p95/albedo   p95/p50' );

    const gradedRows = [
        [ 'A  slide 39 (the defect arm)', 'graded-s39' ],
        [ 'B  round 27, Zinke T_f', 'graded-tf' ],
        ...( hasControl ? [ [ 'C  A at s*, LEVEL MATCHED', 'graded-ctl' ] ] : [] )
    ];

    const gradedPlates = Object.fromEntries( gradedRows.map( ( [ , n ] ) =>
        [ n, readPlate( path.join( out, `${ n }.png` ) ) ] ) );

    for ( const [ label, name ] of gradedRows ) {

        const values = set.map( ( k ) => {

            const codes = codesAt( gradedPlates[ name ], k * 4 );

            return ( 0.2126 * codes[ 0 ] + 0.7152 * codes[ 1 ] + 0.0722 * codes[ 2 ] ) / 255;

        } );

        const s = stats( values );

        console.log(
            `    ${ label.padEnd( 30 ) } ${ s.p50.toFixed( 4 ) }     ${ s.p95.toFixed( 4 ) }     ` +
            `${ ( s.p95 / ASSUMED_ALBEDO_LUMA ).toFixed( 2 ) } : 1     ${ ( s.p95 / s.p50 ).toFixed( 3 ) }` );

    }

    // --- 3. colour ------------------------------------------------------------------------------

    console.log( '\n================================================================================' );
    console.log( ' 3. WHAT THE SIX JUDGES WERE LOOKING AT — mean linear RGB above the floor' );
    console.log( '================================================================================\n' );
    console.log( '    arm                                R          G          B      sat    hue°    R/B' );

    const colourRows = [
        [ 'A  mass, slide 39', 'mass-s39' ],
        [ 'B  mass, Zinke T_f', 'mass-tf' ],
        ...( hasControl ? [ [ 'C  mass, A at s*', 'ctl' ] ] : [] ),
        [ '   pedestal, slide 39', 'ped-s39' ],
        [ '   pedestal, Zinke T_f', 'ped-tf' ],
        [ '   R alone', 'r-only' ]
    ];

    for ( const [ label, name ] of colourRows ) {

        const rgb = meanRgb( name );
        const c = chroma( rgb );

        console.log(
            `    ${ label.padEnd( 30 ) } ${ rgb.map( ( v ) => v.toFixed( 6 ) ).join( '  ' ) }  ` +
            `${ c.saturation.toFixed( 4 ) }  ${ c.hueDegrees.toFixed( 1 ).padStart( 5 ) }  ${ c.redOverBlue.toFixed( 3 ) }` );

    }

    // --- 4. the discriminator -------------------------------------------------------------------

    if ( hasControl ) {

        const b = stats( above( 'mass-tf' ) );
        const c = stats( above( 'ctl' ) );

        console.log( '\n================================================================================' );
        console.log( ' 4. 🎯 THE DISCRIMINATOR — depth dependence against a level-matched CONSTANT' );
        console.log( '================================================================================\n' );
        console.log( '    At equal mean brightness, a term that varies with depth must have a DIFFERENT' );
        console.log( '    shape from a constant multiple of the same term. If these two rows agree, the' );
        console.log( '    depth dependence bought nothing and the round is a negative.\n' );
        console.log( `    p95/p50        Zinke T_f ${ ( b.p95 / b.p50 ).toFixed( 4 ) }   vs   level-matched constant ${ ( c.p95 / c.p50 ).toFixed( 4 ) }   ` +
            `ratio ${ ( ( b.p95 / b.p50 ) / ( c.p95 / c.p50 ) ).toFixed( 4 ) }` );
        console.log( `    p90/p10        Zinke T_f ${ ( b.p90 / b.p10 ).toFixed( 4 ) }   vs   level-matched constant ${ ( c.p90 / c.p10 ).toFixed( 4 ) }   ` +
            `ratio ${ ( ( b.p90 / b.p10 ) / ( c.p90 / c.p10 ) ).toFixed( 4 ) }` );
        console.log( `    R p99 / mean   Zinke T_f ${ ( rStats.p99 / b.mean ).toFixed( 4 ) }   vs   level-matched constant ${ ( rStats.p99 / c.mean ).toFixed( 4 ) }` );

        const bc = chroma( meanRgb( 'mass-tf' ) );
        const cc = chroma( meanRgb( 'ctl' ) );

        console.log( `    saturation     Zinke T_f ${ bc.saturation.toFixed( 4 ) }   vs   level-matched constant ${ cc.saturation.toFixed( 4 ) }` );
        console.log( `    hue°           Zinke T_f ${ bc.hueDegrees.toFixed( 1 ) }   vs   level-matched constant ${ cc.hueDegrees.toFixed( 1 ) }` );
        console.log( '\n    ⚠️ `R p99 / mean` is a CHECK ON THE MATCH AND NOT EVIDENCE: R is byte-identical' );
        console.log( '       across both arms and the means are matched by construction, so the two must agree.' );
        console.log( '       Its job here is to say the level match landed, and it does.' );

        // --- the two arms, PER PIXEL ------------------------------------------------------------
        const bL = above( 'mass-tf' );
        const cL = above( 'ctl' );
        const ratio = bL.map( ( v, i ) => ( cL[ i ] > 0 ? v / cL[ i ] : 1 ) );
        const rs = stats( ratio );

        let deltaSum = 0;
        set.forEach( ( k, i ) => {

            const rgbB = rgbAt( plates[ 'mass-tf' ], k );
            const rgbC = rgbAt( plates.ctl, k );
            deltaSum += ( Math.abs( rgbB[ 0 ] - rgbC[ 0 ] ) + Math.abs( rgbB[ 1 ] - rgbC[ 1 ] ) +
                Math.abs( rgbB[ 2 ] - rgbC[ 2 ] ) ) / 3;

        } );

        console.log( '\n    PER PIXEL, the two arms against each other on the same 8 steps of the same seed:' );
        console.log( `      Spearman(B, C) ${ spearman( bL, cL ).toFixed( 4 ) }` );
        console.log( `      B/C luminance ratio   p10 ${ rs.p10.toFixed( 4 ) }   p50 ${ rs.p50.toFixed( 4 ) }   p90 ${ rs.p90.toFixed( 4 ) }` );
        console.log( `      mean |ΔRGB| in radiance ${ ( deltaSum / set.length ).toExponential( 3 ) } against a mass mean of ${ b.mean.toExponential( 3 ) }` );

        if ( record ) {

            const gradedLuma = ( name ) => {

                const png = readPlate( path.join( out, `${ name }.png` ) );
                const values = set.map( ( k ) => {

                    const codes = codesAt( png, k * 4 );

                    return ( 0.2126 * codes[ 0 ] + 0.7152 * codes[ 1 ] + 0.0722 * codes[ 2 ] ) / 255;

                } );

                return stats( values );

            };

            const a = stats( above( 'mass-s39' ) );
            const pedA = stats( above( 'ped-s39' ) );
            const pedB = stats( above( 'ped-tf' ) );
            const ac = chroma( meanRgb( 'mass-s39' ) );

            fs.writeFileSync( RECORD, `${ JSON.stringify( {
                capturedFrom: path.relative( REPO, out ),
                gatedPixels: set.length,
                starScatter: star,
                pedestalShare: { slide39: 100 * pedA.mean / a.mean, zinke: 100 * pedB.mean / b.mean },
                radianceP95OverP50: { slide39: a.p95 / a.p50, zinke: b.p95 / b.p50, levelMatched: c.p95 / c.p50 },
                radianceP90OverP10: { zinke: b.p90 / b.p10, levelMatched: c.p90 / c.p10 },
                rP99OverMassMean: { slide39: rStats.p99 / a.mean, zinke: rStats.p99 / b.mean },
                gradedGateRatio: {
                    slide39: gradedLuma( 'graded-s39' ).p95 / ASSUMED_ALBEDO_LUMA,
                    zinke: gradedLuma( 'graded-tf' ).p95 / ASSUMED_ALBEDO_LUMA,
                    levelMatched: gradedLuma( 'graded-ctl' ).p95 / ASSUMED_ALBEDO_LUMA
                },
                saturation: { slide39: ac.saturation, zinke: bc.saturation, levelMatched: cc.saturation },
                hueDegrees: { slide39: ac.hueDegrees, zinke: bc.hueDegrees, levelMatched: cc.hueDegrees },
                spearmanZinkeVsLevelMatched: spearman( bL, cL ),
                meanAbsDeltaRgb: deltaSum / set.length
            }, null, 2 ) }\n` );

            console.log( `\n    recorded ${ path.relative( REPO, RECORD ) }` );

        }

    }

    console.log( '' );

}

// --- CLI ------------------------------------------------------------------------------------------

async function main() {

    const flag = ( name, fallback ) => {

        const index = process.argv.indexOf( name );

        return index >= 0 && process.argv[ index + 1 ] ? process.argv[ index + 1 ] : fallback;

    };

    const port = Number( flag( '--port', '5173' ) );
    const out = path.resolve( flag( '--out', path.join( REPO, 'captures', 'hair-r27-tf' ) ) );

    if ( process.argv.includes( '--capture' ) ) await capture( port, out );
    else if ( process.argv.includes( '--control' ) ) await captureControl( port, out, Number( flag( '--control', '0' ) ) );
    else if ( process.argv.includes( '--report' ) ) report( out, process.argv.includes( '--record' ) );
    else console.log( 'pass --capture | --control <s*> | --report [--record], with --out and --port.' );

}

if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === path.resolve( fileURLToPath( import.meta.url ) ) ) {

    await main();

}

export { srgbToLinear };
