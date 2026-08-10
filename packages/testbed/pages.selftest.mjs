/**
 * pages.selftest.mjs — the gate on the index page, and on the build config beside it.
 *
 * ## The defect this exists because of, which had already happened twice before the page did
 *
 * `index.html` lists every page in the testbed. That list is a CLAIM ABOUT THE REPOSITORY, and
 * every claim this repository has made about itself has drifted at least once: a gate roster where
 * twelve of thirteen counts had moved (LEARNINGS §1.25p), a build config that did not know two
 * pages existed, a code comment citing a ledger entry nobody had filed (§1.25ae). An index is the
 * purest form of that shape — correct the day it is written, silently wrong the first time
 * somebody adds a page, and wrong in the direction that hides work rather than breaking it.
 *
 * `vite.pages.config.js` already carries the same hazard and says so in its own header: a page
 * missing from its `PAGES` list is never compiled, so a broken import in it passes a green
 * `npm run build:pages`. That config asked, in prose, for new pages to be added on the same
 * commit. This is that request with a gate under it.
 *
 * ## What it closes, and why it takes THREE sources rather than two
 *
 * The filesystem is the ground truth for what exists. `pages.js` is what a human is shown.
 * `vite.pages.config.js` is what gets compiled. Any two of them agreeing proves nothing about the
 * third, and each pair fails differently:
 *
 *   disk vs pages.js       a page nobody can find from the index — the drift this page prevents
 *   disk vs PAGES          a page nobody compiles — the drift that config was written to prevent
 *   pages.js vs PAGES      an index entry pointing at something the build does not produce, i.e.
 *                          a link that works in dev and 404s in the built site
 *
 * So all three are compared pairwise, as SETS, with the difference printed in both directions.
 * "Too few" and "too many" are separate failures with separate messages, because a padded list and
 * a short list are opposite mistakes and a single count check catches neither cleanly.
 *
 * ⚠️ **The commands are checked too, and that is not padding.** `pages.js` tells a reader to run
 * `npm run selftests`. If that script is renamed, the index becomes a page that confidently gives
 * a stranger a command that does not work — which is worse than saying nothing, and is exactly the
 * failure §1.25ae describes in a different file.
 *
 *     node packages/testbed/pages.selftest.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// fileURLToPath, not string surgery: this repository's path contains a space and a non-ASCII
// character, so import.meta.url arrives percent-encoded.
const TESTBED = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( TESTBED, '..', '..' );

const { ALL_PAGES, COMMANDS } = await import( pathToFileURL( path.join( TESTBED, 'pages.js' ) ).href );

let checks = 0;
let failures = 0;

function report( ok, what, detail ) {

    checks += 1;
    if ( ok !== true ) failures += 1;

    console.log( `${ ok === true ? 'PASS' : 'FAIL' }  ${ what }` );
    if ( detail !== undefined && detail !== '' ) console.log( `        ${ detail }` );

}

/**
 * Both directions of a set comparison, reported separately.
 *
 * A single "the sets are equal" assertion would be true or false and tell a reader nothing about
 * which way to fix it. `missing` and `extra` are different bugs with different repairs.
 */
function compareSets( label, expected, actual, expectedName, actualName ) {

    const missing = [ ...expected ].filter( ( item ) => actual.has( item ) === false );
    const extra = [ ...actual ].filter( ( item ) => expected.has( item ) === false );

    report( missing.length === 0,
        `${ label } — everything in ${ expectedName } is in ${ actualName }`,
        missing.length === 0 ? `${ expected.size } entries` : `MISSING: ${ missing.join( ', ' ) }` );

    report( extra.length === 0,
        `${ label } — ${ actualName } claims nothing ${ expectedName } does not have`,
        extra.length === 0 ? `${ actual.size } entries` : `EXTRA: ${ extra.join( ', ' ) }` );

}

// --- 1. what is actually on disk ----------------------------------------------------------------
//
// Walked rather than globbed against a pattern list, so a page added in a NEW subdirectory is
// found. A hard-coded [ '.', 'src' ] would be the same class of assumption this file exists to
// gate — it would silently stop covering the directory somebody adds next.

function htmlFilesUnder( directory, prefix = '' ) {

    const found = [];

    for ( const entry of fs.readdirSync( directory, { withFileTypes: true } ) ) {

        if ( entry.name.startsWith( '.' ) || entry.name === 'node_modules' ) continue;

        const relative = prefix === '' ? entry.name : `${ prefix }/${ entry.name }`;

        if ( entry.isDirectory() ) found.push( ...htmlFilesUnder( path.join( directory, entry.name ), relative ) );
        else if ( entry.name.endsWith( '.html' ) ) found.push( relative );

    }

    return found;

}

const onDisk = new Set( htmlFilesUnder( TESTBED ) );

console.log( '--- the three lists ---------------------------------------------------------------\n' );
console.log( `        on disk    ${ onDisk.size } pages` );

// index.html is the hub itself. It is a page, it must be built, and it must NOT list itself — a
// card linking to the page you are already on is noise, and worse, it would make the disk-vs-index
// comparison pass by counting the index as its own coverage.
const INDEX_PAGE = 'index.html';

const listed = new Set( ALL_PAGES.map( ( page ) => page.path ) );
console.log( `        pages.js   ${ listed.size } cards` );

const pagesConfig = fs.readFileSync( path.join( REPOSITORY_ROOT, 'vite.pages.config.js' ), 'utf8' );
const configBlock = pagesConfig.match( /const PAGES = \[([\s\S]*?)\];/ );

report( configBlock !== null,
    'vite.pages.config.js still declares a PAGES array this gate can read',
    configBlock === null ? 'the `const PAGES = [ … ];` form did not match — re-anchor this gate'
        : 'matched' );

const built = new Set( configBlock === null ? []
    : [ ...configBlock[ 1 ].matchAll( /'([^']+)'/g ) ].map( ( match ) => match[ 1 ] ) );
console.log( `        built      ${ built.size } entries\n` );

// --- 2. the three pairwise closures -------------------------------------------------------------

console.log( '--- closure ------------------------------------------------------------------------\n' );

const shouldBeListed = new Set( [ ...onDisk ].filter( ( page ) => page !== INDEX_PAGE ) );

compareSets( 'INDEX', shouldBeListed, listed, 'the filesystem', 'pages.js' );
compareSets( 'BUILD', onDisk, built, 'the filesystem', "vite.pages.config.js's PAGES" );
compareSets( 'LINKS', listed, new Set( [ ...built ].filter( ( page ) => page !== INDEX_PAGE ) ),
    'pages.js', 'the built page set' );

report( listed.has( INDEX_PAGE ) === false,
    'the index does not list itself',
    listed.has( INDEX_PAGE ) ? 'index.html has a card pointing at the page it is on' : 'no self-link' );

report( built.has( INDEX_PAGE ),
    'the index is itself built, so a broken import in it cannot pass build:pages',
    built.has( INDEX_PAGE ) ? 'index.html is in PAGES' : 'index.html is NOT in PAGES' );

// --- 3. every card is complete, and every href resolves -----------------------------------------
//
// A card with an empty blurb is a card that will be filled in later and never is. A card whose
// href does not resolve is a 404 the index hands to a stranger, which is the specific failure this
// whole file exists to prevent — so it is checked against the filesystem, not against the list the
// hrefs were derived from.

console.log( '\n--- the cards ----------------------------------------------------------------------\n' );

for ( const page of ALL_PAGES ) {

    const complete = typeof page.name === 'string' && page.name !== ''
        && typeof page.phase === 'string' && page.phase !== ''
        && typeof page.blurb === 'string' && page.blurb.length >= 40
        && Array.isArray( page.gates );

    report( complete, `${ page.path } — the card carries a name, a phase, a real blurb and a gate list`,
        complete ? `“${ page.blurb.slice( 0, 58 ) }…”` : JSON.stringify( page ) );

    const resolves = fs.existsSync( path.join( TESTBED, page.path ) );
    report( resolves, `${ page.path } — the link resolves to a file on disk`,
        resolves ? 'present' : 'THE INDEX WOULD 404 HERE' );

}

// --- 4. the commands the index tells a stranger to run ------------------------------------------

console.log( '\n--- the commands -------------------------------------------------------------------\n' );

const scripts = JSON.parse( fs.readFileSync( path.join( REPOSITORY_ROOT, 'package.json' ), 'utf8' ) ).scripts;

for ( const { group, items } of COMMANDS ) {

    for ( const item of items ) {

        const npmScript = item.run.match( /^npm run (\S+)$/ );

        // Only `npm run …` can be checked against package.json. Anything else is checked as a file
        // that must exist, and an unrecognised shape is a FAILURE rather than a skip — a silent
        // skip is how a command stops being covered without anybody deciding that it should.
        if ( npmScript !== null ) {

            const named = Object.hasOwn( scripts, npmScript[ 1 ] );
            report( named, `${ group } — \`${ item.run }\` is a real script in package.json`,
                named ? scripts[ npmScript[ 1 ] ] : `package.json has no "${ npmScript[ 1 ] }" script` );

        } else {

            const invoked = item.run.match( /^(?:node|bash) (\S+)/ );
            const exists = invoked !== null && fs.existsSync( path.join( REPOSITORY_ROOT, invoked[ 1 ] ) );

            report( exists, `${ group } — \`${ item.run }\` names a file that exists`,
                exists ? invoked[ 1 ] : 'not an `npm run …`, `node <file>` or `bash <file>` form' );

        }

    }

}

console.log( '' );
console.log( '='.repeat( 84 ) );
console.log( failures === 0 ? `PASS — ${ checks } assertions.` : `FAIL — ${ failures } of ${ checks }.` );

process.exit( failures === 0 ? 0 : 1 );
