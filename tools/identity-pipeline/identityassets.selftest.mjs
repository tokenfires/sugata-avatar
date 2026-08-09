/**
 * Gate for the identity CENSUS CLAIM — the sentence "203 bidirectional sliders", wherever anyone
 * in this repository writes a version of it.
 *
 *
 * THE DEFECT THIS EXISTS FOR
 *
 * Research §2.2 used to call all 203 detail categories bidirectional. Measured against MPFB's own
 * `target.json`, 195 are and 8 are not: the seven `head-<shape>` categories and `chin-triangle`
 * carry no `opposites` block, name one file each, and run 0 → +1. A UI that draws every category
 * as a −1 → +1 dial applies seven head shapes backwards, so the adjective is a bug and not a
 * quibble. The correction was made — in ONE file. Three live copies survived it:
 *
 *   docs/PUNCHLIST.md ......................... the bolded sentence that opens Phase 10
 *   assets/identity/catalogue.json ............ SHIPPED, inside `census.notes.detail`
 *   tools/identity-pipeline/..._assets.mjs .... the literal that WRITES that line
 *
 * Nothing could have noticed. The repo has no shortage of gates on this data — the catalogue's own
 * selftest checks 72 things about it, and every one of them was green, correctly, because the DATA
 * was never wrong. What was wrong was English sitting beside the data, restating it, derived from
 * nothing. `docs/measured-claims.selftest.mjs` is the same idea pointed at the render gates; this
 * is that idea pointed at the identity census.
 *
 *
 * THE ORACLE IS THE SHIPPED ASSET, AND THE ORACLE IS CHECKED FIRST
 *
 * Every expected number below is read out of `assets/identity/catalogue.json` at run time. None is
 * typed in — a gate that compares one transcription against another transcription measures
 * nothing. But a self-consistent catalogue could still be a self-consistent lie, so ARITHMETIC
 * runs before anything uses those counts: the four independent ways the 530 detail files can be
 * recounted must all agree, and 66 × 4 + 129 × 2 + 8 × 1 must land on 530 exactly. That closure is
 * what makes 195 and 8 evidence rather than assertion.
 *
 *
 * THREE RULES
 *
 *   ARITHMETIC   The catalogue's taxonomy closes on its own detail-file count, four ways.
 *
 *   DERIVED      `census.notes` in the SHIPPED catalogue must equal what `censusNotes()` produces
 *                from that same shipped file. The builder no longer types those sentences; it
 *                templates them. So a hand-edit of the asset goes red, and so does a builder whose
 *                literals drift back in. This is the rule that would have caught the shipped copy.
 *
 *   SWEEP        Three census adjectives, held across every text file in the repository, to the
 *                measured value. `N bidirectional` must be 195, `N unipolar` 8, `N sided` 66 —
 *                in prose, in comments, in JSON, anywhere. This is the rule that would have caught
 *                the PUNCHLIST copy, and it is the only one of the three that is repo-wide.
 *
 *
 * ⚠️ QUOTING THE RETIRED CLAIM IS LEGITIMATE, AND IT IS NOT SILENT
 *
 * A retraction has to be able to say what it retracts. Those sites are listed in `QUOTATIONS`
 * with a reason each, and the gate asserts every listed phrase is STILL PRESENT — an allowlist
 * that can rot into a blanket permit is not an allowlist. Adding a retraction means adding an
 * entry, which is the intended cost: the sweep failure message says so.
 *
 * Usage:  node "tools/identity-pipeline/identityassets.selftest.mjs"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO = path.resolve( HERE, "../.." );
const SELF = path.relative( REPO, fileURLToPath( import.meta.url ) ).split( path.sep ).join( "/" );

const { censusNotes, taxonomyOf } = await import( "./build_identity_assets.mjs" );

const CATALOGUE = JSON.parse(
    fs.readFileSync( path.join( REPO, "assets/identity/catalogue.json" ), "utf8" ) );

/**
 * The claims the sweep enforces, and the reason each one is safe to enforce repo-wide.
 *
 * `valueFrom` reads the catalogue, never a literal. `pattern` is deliberately narrow: it requires
 * whitespace between the number and the adjective, which is what keeps "129 unsided-bidirectional"
 * — a true statement about a different quantity — out of the sweep rather than needing an
 * exemption for it.
 */
const CLAIMS = [
    {
        adjective: "bidirectional",
        pattern: claimPattern( "bidirectional" ),
        valueFrom: ( t ) => t.bipolar,
        what: "categories with an `opposites` block, running −1 → +1"
    },
    {
        adjective: "unipolar",
        pattern: claimPattern( "unipolar" ),
        valueFrom: ( t ) => t.unipolar,
        what: "categories naming one file, running 0 → +1"
    },
    {
        adjective: "sided",
        pattern: claimPattern( "sided" ),
        valueFrom: ( t ) => t.sided,
        what: "categories flagged `has_left_and_right`, drawing two widgets"
    }
];

/**
 * `1,258` and `203` are claims; `0,` is the second element of a JS array literal.
 *
 * The number accepts thousands separators and nothing else, which is the difference between
 * "1,258 sided" and `let categories = 0, sided = 0` — the latter is real code in
 * identitycatalogue.selftest.mjs and a looser `[\d,]*` swept it up as a claim of "0 sided".
 */
function claimPattern( adjective ) {
    return new RegExp( String.raw`(\d+(?:,\d{3})*)\s+${ adjective }\b`, "g" );
}

/**
 * Sites that quote the retired claim on purpose. Each is asserted present, so a stale entry fails
 * the gate rather than quietly widening it.
 *
 * The phrase is written as "all 203 bidirectional" in both, and that is not a coincidence worth
 * relying on — it is the shape a retraction takes. It is still matched literally.
 */
const QUOTATIONS = [
    {
        file: "docs/research/identity-sculpting.md",
        phrase: "all 203 bidirectional",
        why: "§2.2's own ⚠️ CORRECTED block, which has to name what it corrected."
    },
    {
        file: "packages/core/src/figure/identitycatalogue.selftest.mjs",
        phrase: "all 203 bidirectional",
        why: "the unipolar check's rationale string, which cites the claim it disproves."
    },
    {
        file: "tools/identity-pipeline/build_identity_assets.mjs",
        phrase: 'said "203 bidirectional sliders"',
        why: "the builder's header and censusNotes()'s own 🚩, both recording the defect that made "
            + "the function necessary. Both write the quotation the same way on purpose — one "
            + "entry exempts one form of words, not a file."
    }
];

/**
 * Files the sweep does not read, and why. A silent exclusion is a lie by omission — the builder
 * says so about regions and it is true about files.
 */
const EXCLUDED_FROM_SWEEP = {
    [ SELF ]: "this file declares the patterns and the allowlisted phrases, so it matches itself.",
    "docs/OPEN-REQUESTS.md": "the diff-request ledger records both sides of every correction by "
        + "design; policing it would make filing a correction impossible."
};

const TEXT_EXTENSIONS = new Set( [ ".md", ".mjs", ".js", ".json", ".html", ".py", ".sh", ".css" ] );

/**
 * ⚠️ `dist` and `dist-pages` hold BUILT COPIES OF THE SHIPPED ASSET, and one of them was carrying
 * the defective sentence when this gate first ran. They are skipped because they are gitignored
 * build output that regenerates from `assets/` — the source is what a gate can hold. A stale bundle
 * is a stale bundle; rebuild it.
 */
const SKIP_DIRS = new Set( [
    ".git", "node_modules", "dist", "dist-pages", "build", "reference", "captures"
] );

const results = [];

// ---------------------------------------------------------------------------------------------

console.log( "\nARITHMETIC — the catalogue closes on its own file count\n" );
const taxonomy = checkArithmetic( CATALOGUE );

console.log( "\nDERIVED — the shipped census notes, re-derived from the shipped catalogue\n" );
checkDerivedNotes( CATALOGUE );

console.log( "\nSWEEP — every census adjective in the repository, against the measured count\n" );
checkSweep( taxonomy );

console.log( "\nPROVEN RED — each rule against deliberately corrupted input\n" );
proveRed();

report();

// ---------------------------------------------------------------------------------------------

/**
 * Returns the taxonomy ONLY if it survives, and `null` otherwise.
 *
 * The sweep's every expected value comes from here. A catalogue that cannot count itself would
 * make the sweep confidently wrong in both directions — passing stale prose that happens to match
 * the broken count, failing correct prose that does not — and a gate that reports wrong sites with
 * full confidence is worse than one that admits it has no oracle.
 */
function checkArithmetic( raw ) {

    checkArithmeticQuietly( raw, record );

    try {
        checkArithmeticQuietly( raw, assertEmit );
    } catch {
        return null;
    }

    return taxonomyOf( raw.regions, raw.sliders );

}

function checkArithmeticQuietly( raw, emit ) {

    const t = taxonomyOf( raw.regions, raw.sliders );
    const detail = raw.census.detail;
    const unsidedBipolar = raw.sliders.filter( ( s ) => ! s.sided && s.range === "bipolar" ).length;
    const endsTotal = raw.sliders.reduce( ( n, s ) => n + Object.keys( s.ends ).length, 0 );
    const regionRaw = raw.regions.reduce( ( n, r ) => n + r.rawTargetCount, 0 );

    emit( t.bipolar + t.unipolar === t.categories, "bipolar + unipolar = categories",
        `${ t.bipolar } + ${ t.unipolar }`, String( t.categories ),
        "every category has a range and there is no third kind" );

    emit( t.sided === raw.sliders.filter( ( s ) => s.sided && s.range === "bipolar" ).length,
        "every sided category is bipolar", String( t.sided ),
        String( raw.sliders.filter( ( s ) => s.sided && s.range === "bipolar" ).length ),
        "the 8 unipolar are head shapes and a chin, none of them sided" );

    emit( t.sided * 4 + unsidedBipolar * 2 + t.unipolar === detail,
        "sided x4 + unsided-bipolar x2 + unipolar",
        `${ t.sided }x4 + ${ unsidedBipolar }x2 + ${ t.unipolar }x1 = ${ t.sided * 4 + unsidedBipolar * 2 + t.unipolar }`,
        String( detail ), "the closure that makes 195/8 evidence rather than assertion" );

    emit( endsTotal === detail, "slider ends sum to the detail files",
        String( endsTotal ), String( detail ), "a second, independent recount of the same 530" );

    emit( regionRaw === detail, "region raw counts sum to the detail files",
        String( regionRaw ), String( detail ), "a third recount, off the region table" );

}

/**
 * The shipped sentences against the same sentences rebuilt from the shipped numbers.
 *
 * Note what this does NOT do: it does not compare against a string typed into this file. The
 * builder owns the wording; this gate owns the fact that the wording is a function of the data.
 */
function checkDerivedNotes( raw ) {

    checkDerivedNotesQuietly( raw, record );

}

function checkDerivedNotesQuietly( raw, emit ) {

    const rebuilt = censusNotes( raw.census, taxonomyOf( raw.regions, raw.sliders ) );
    const shipped = raw.census.notes ?? {};

    emit( Object.keys( shipped ).sort().join( "," ) === Object.keys( rebuilt ).sort().join( "," ),
        "note keys", Object.keys( shipped ).sort().join( "," ), Object.keys( rebuilt ).sort().join( "," ),
        "a dropped note is a claim that stopped being checked" );

    for ( const key of Object.keys( rebuilt ) ) {
        const same = shipped[ key ] === rebuilt[ key ];
        emit( same, `note ${ key }`,
            same ? "derived" : fromDivergence( shipped[ key ], rebuilt[ key ] ),
            same ? "derived" : fromDivergence( rebuilt[ key ], shipped[ key ] ),
            "derived from the catalogue, not typed beside it" );
    }

}

/**
 * These sentences share a long prefix, so printing their first 30 characters prints the same 30
 * characters twice and tells the reader nothing. Print from where they part instead.
 */
function fromDivergence( text, other ) {

    if ( typeof text !== "string" ) return String( text );

    let i = 0;
    while ( i < text.length && i < String( other ?? "" ).length && text[ i ] === other[ i ] ) i ++;

    const tail = text.slice( i, i + 34 );
    return i === 0 ? tail : `…${ tail }`;

}

function checkSweep( taxonomy ) {

    const files = textFiles( REPO );
    record( files.length > 100, "files swept", String( files.length ), ">100",
        "a sweep over an empty list passes everything" );

    checkQuotationsPresent( files, record );

    if ( taxonomy === null ) {
        for ( const claim of CLAIMS ) {
            record( false, `"N ${ claim.adjective }" — NOT RUN`, "no oracle", "a counted catalogue",
                "ARITHMETIC failed above, so there is no measured value to hold prose to" );
        }
        return;
    }

    for ( const claim of CLAIMS ) {
        const expected = claim.valueFrom( taxonomy );
        const wrong = sweepFor( claim, files, expected );
        record( wrong.length === 0, `"N ${ claim.adjective }" = ${ expected }`,
            wrong.length === 0 ? "no stale sites" : wrong.map( ( w ) => `${ w.file }:${ w.line }` ).join( " " ),
            "no stale sites", claim.what );
        for ( const site of wrong ) {
            console.log( `        ${ site.file }:${ site.line }  says ${ site.said }, measured ${ expected }` );
            console.log( `        → correct it, or add a QUOTATIONS entry in ${ SELF } saying why it quotes the retired claim.` );
        }
    }

}

function checkQuotationsPresent( files, emit ) {

    for ( const quotation of QUOTATIONS ) {
        const known = files.find( ( f ) => f.rel === quotation.file );
        const present = known ? normalise( known.text ).text.includes( quotation.phrase ) : false;
        emit( present, `quotation site ${ quotation.file }`, present ? "present" : "GONE", "present",
            "an allowlist entry whose phrase has left is a permit, not an exemption" );
    }

}

/** Sites whose stated number disagrees with the measured one, minus the declared quotations. */
function sweepFor( claim, files, expected ) {

    const wrong = [];

    for ( const file of files ) {

        const normalised = normalise( file.text );
        const text = normalised.text;
        const allowed = QUOTATIONS.filter( ( q ) => q.file === file.rel ).map( ( q ) => q.phrase );

        claim.pattern.lastIndex = 0;
        let match;

        while ( ( match = claim.pattern.exec( text ) ) !== null ) {

            if ( Number( match[ 1 ].replace( /,/g, "" ) ) === expected ) continue;

            // The window spans the words that make a quotation a quotation — "used to call all …"
            // before, `sliders"` after — and no further, so an allowlisted phrase exempts its own
            // sentence rather than its whole paragraph.
            const window = text.slice( Math.max( 0, match.index - 32 ),
                match.index + match[ 0 ].length + 32 );
            if ( allowed.some( ( phrase ) => window.includes( phrase ) ) ) continue;

            wrong.push( {
                file: file.rel,
                line: lineOf( file.text, normalised, match.index ),
                said: match[ 1 ]
            } );

        }

    }

    return wrong;

}

/**
 * Claims wrap across lines, and "203\nbidirectional" is the same claim as "203 bidirectional".
 *
 * 🚩 IT IS NOT ENOUGH TO COLLAPSE WHITESPACE. The wrapped forms that actually occur here carry a
 * continuation marker — `>` in the research doc's blockquotes, ` * ` in every JSDoc header in the
 * repo — and a whitespace-only collapse turns "and 8\n> unipolar" into "8 > unipolar", which no
 * pattern matches. That is a claim going unswept because of where a paragraph wrapped, which is
 * the failure this whole gate exists to prevent. Measured when this gate was written: stripping
 * the markers is what brings research §2.2's own "8 unipolar" into the sweep at all.
 *
 * Returns the collapsed text plus a map from collapsed offset back to original offset, so a
 * reported line number points at the real line rather than at a lucky substring.
 */
function normalise( text ) {

    let out = "";
    const origin = [];
    let i = 0;

    while ( i < text.length ) {

        if ( /\s/.test( text[ i ] ) ) {

            const start = i;
            while ( i < text.length && /\s/.test( text[ i ] ) ) i ++;

            // Eat one line-leading continuation marker and the space after it.
            if ( text.slice( start, i ).includes( "\n" ) ) {
                const marker = /^(?:\*|>|\/\/|#+)[ \t]*/.exec( text.slice( i ) );
                if ( marker ) i += marker[ 0 ].length;
            }

            if ( out.length > 0 ) { out += " "; origin.push( start ); }
            continue;

        }

        out += text[ i ]; origin.push( i ); i ++;

    }

    return { text: out, origin };

}

function lineOf( original, normalised, index ) {
    const at = normalised.origin[ index ] ?? 0;
    return original.slice( 0, at ).split( "\n" ).length;
}

function textFiles( root ) {

    const out = [];

    ( function walk( dir ) {
        for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
            if ( SKIP_DIRS.has( entry.name ) ) continue;
            const full = path.join( dir, entry.name );
            if ( entry.isDirectory() ) { walk( full ); continue; }
            if ( ! TEXT_EXTENSIONS.has( path.extname( entry.name ) ) ) continue;
            const rel = path.relative( root, full ).split( path.sep ).join( "/" );
            if ( EXCLUDED_FROM_SWEEP[ rel ] ) continue;
            out.push( { rel, text: fs.readFileSync( full, "utf8" ) } );
        }
    } )( root );

    return out;

}

// ---------------------------------------------------------------------------------------------

/**
 * Two independent corruptions per rule. Independent means a single fix would not silence both:
 * one attacks the number, the other attacks the structure that makes the number meaningful.
 */
function proveRed() {

    // ARITHMETIC. (a) the closure breaks because a category changed polarity — the exact mutation
    // that would make "203 bidirectional" true again by moving the data instead of the prose.
    provenRed( "arithmetic catches a category flipped to bipolar", () => {
        const broken = structuredClone( CATALOGUE );
        broken.sliders.find( ( s ) => s.id === "head/head-oval" ).range = "bipolar";
        checkArithmeticQuietly( broken, assertEmit );
    } );

    // (b) a different break in the same class: the counts are untouched and a region's raw total
    // is off by one, so only the third recount disagrees.
    provenRed( "arithmetic catches a drifted region raw count", () => {
        const broken = structuredClone( CATALOGUE );
        broken.regions.find( ( r ) => r.id === "head" ).rawTargetCount = 28;
        checkArithmeticQuietly( broken, assertEmit );
    } );

    // DERIVED. (a) the defect itself, reintroduced verbatim into the shipped asset.
    provenRed( "derived catches the original defective sentence", () => {
        const broken = structuredClone( CATALOGUE );
        broken.census.notes.detail =
            "530 files, grouped by target.json into 203 bidirectional sliders / 21 regions.";
        checkDerivedNotesQuietly( broken, assertEmit );
    } );

    // (b) a different break in the same class, and the one a careless fix produces: the sentence
    // is reworded correctly by hand, with one number quietly wrong. Nothing about it looks stale.
    provenRed( "derived catches a plausible hand-reworded note", () => {
        const broken = structuredClone( CATALOGUE );
        broken.census.notes.detail = "530 files, grouped by target.json into 203 slider "
            + "categories — 196 bidirectional, 7 unipolar — across 21 regions.";
        checkDerivedNotesQuietly( broken, assertEmit );
    } );

    // (c) a third, because the round that produced this gate lost a whole file's worth of claims
    // to a correction that landed in one place: a note deleted rather than corrected.
    provenRed( "derived catches a deleted note", () => {
        const broken = structuredClone( CATALOGUE );
        delete broken.census.notes.asym;
        checkDerivedNotesQuietly( broken, assertEmit );
    } );

    // SWEEP. Its check is "this file list yields no stale sites", so `sweepClean` IS the rule and
    // corrupting the input has to make it throw — the same shape as the two rules above.

    // (a) the PUNCHLIST copy, reintroduced verbatim as a file the sweep must find on its own.
    provenRed( "sweep catches the punch-list sentence", () => {
        sweepClean( CLAIMS[ 0 ], 195, [ { rel: "docs/FAKE.md",
            text: "`targets/target.json` groups them into 203 bidirectional sliders across 21 regions." } ] );
    } );

    // (b) a different break in the same class: a DIFFERENT adjective, wrapped across a line, behind
    // a JSDoc continuation marker. A line-based sweep and a bidirectional-only rule each miss this
    // one on their own, so it is not the same test twice — and it is the form research §2.2's own
    // "8 unipolar" takes, behind a `>` blockquote marker.
    provenRed( "sweep catches a wrapped claim on another adjective", () => {
        sweepClean( CLAIMS[ 1 ], 8, [ { rel: "packages/core/src/figure/FAKE.js",
            text: "/**\n * ... the 66 sided categories and the 9\n * unipolar ones ...\n */" } ] );
    } );

    // (c) the allowlist must not be a blanket permit: a stale claim in an allowlisted FILE, but
    // outside the allowlisted PHRASE, still has to be caught.
    provenRed( "sweep catches a stale claim inside an allowlisted file", () => {
        sweepClean( CLAIMS[ 0 ], 195, [ { rel: "docs/research/identity-sculpting.md",
            text: "It groups the detail targets into 203 bidirectional slider categories." } ] );
    } );

    // (d) and the allowlist must not rot: an entry whose phrase has left the file is a permit.
    provenRed( "quotation allowlist catches a departed phrase", () => {
        checkQuotationsPresent( QUOTATIONS.map( ( q, i ) =>
            ( { rel: q.file, text: i === 0 ? "nothing to see here" : q.phrase } ) ), assertEmit );
    } );

    // (e) and it must not be satisfiable by a NEIGHBOURING file's copy of the same phrase, which
    // is how an allowlist quietly becomes repo-wide.
    provenRed( "quotation allowlist is per-file", () => {
        checkQuotationsPresent( [ { rel: "docs/SOMEWHERE-ELSE.md", text: QUOTATIONS[ 0 ].phrase } ],
            assertEmit );
    } );

}

/** The SWEEP rule itself, as an assertion, so proveRed can corrupt its input. */
function sweepClean( claim, expected, files ) {
    const wrong = sweepFor( claim, files, expected );
    assert( wrong.length === 0,
        `${ wrong.length } stale "N ${ claim.adjective }" site(s): `
        + wrong.map( ( w ) => `${ w.file }:${ w.line } says ${ w.said }` ).join( ", " ) );
}

// ---------------------------------------------------------------------------------------------

function assertEmit( pass, label, measured, expected ) {
    if ( ! pass ) throw new Error( `gate fired: ${ label } = ${ measured }, expected ${ expected }` );
}

function assert( condition, what ) {
    if ( ! condition ) throw new Error( `gate fired: ${ what }` );
}

/** Runs a check against corrupted input and passes only if the check FAILS. */
function provenRed( label, run ) {

    let fired = false;
    try { run(); } catch { fired = true; }
    record( fired, label, fired ? "went red" : "stayed green", "went red",
        "a gate that only catches its own known-bad is decorative" );

}

function record( pass, label, measured, expected, why ) {

    results.push( pass );
    console.log( `  ${ pass ? "PASS" : "FAIL" }  ${ label.padEnd( 46 ) } ${ String( measured ).padStart( 20 ) }`
        + `   expected ${ String( expected ).padEnd( 20 ) } ${ why }` );

}

function report() {

    const passed = results.filter( Boolean ).length;
    console.log( `\n${ passed }/${ results.length } gates passed\n` );
    if ( passed !== results.length ) process.exit( 1 );

}
