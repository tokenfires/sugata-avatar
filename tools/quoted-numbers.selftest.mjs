#!/usr/bin/env node
//
// quoted-numbers.selftest.mjs — the gate on `quoted-numbers.mjs`.
//
// 🚩 THE STANDING RULE THIS FILE EXISTS FOR. Eight structurally-blind statistics have shipped in
// this phase — the most recent found IN THE ROUND THAT WROTE IT, when `coherentLock` rose on purely
// isotropic noise because a normalised ratio had been multiplied back by an amplitude. So every
// operator gets validated against inputs whose answer is ARITHMETIC before it is pointed at
// anything real, and against something the author actually looked at.
//
// For this gate both of those are available in an unusually strong form, because the failure it
// checks for has a REAL HISTORICAL INSTANCE with both halves recorded. `docs/CHECKPOINT.md` §8:
// five wrong numbers in one comment block in `tools/critic/lock-coherence.mjs` —
//
//     wrong    0.110      0.823      7.5      0.0139      55.5
//     true     0.119454   0.830304   6.9508   0.014152    54.6314
//
// — against what `lock-coherence.selftest.mjs` prints on the same lines: 0.119454, 0.830304, 6.95,
// 0.014152, 54.63. §C runs the agreement rule over all ten and requires the true five to pass and
// the wrong five to fail, with no subprocess and no tolerance to choose. That is the bound this
// gate is pinned at, and §Z then runs the same rule over the real tree with the real producers.
//
// The "crop you looked at" half is §Z's own output: the tags in `lock-coherence.mjs` and
// `band-power.mjs` were written by reading the producer's printed line and the prose side by side,
// and the run prints the matched line beside every claim so the next reader can do the same.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    REPO_ROOT, adjudicate, checkTree, claimAgrees, countFile, extractNumbers, isTagLine,
    literalAppears, numberInterval, parseProducer, parseTags, regexAllowedAfter, scanSource,
    scannerDisagreement
} from './quoted-numbers.mjs';

let passed = 0;
let failed = 0;

function check( name, run ) {

    try {

        run();
        passed += 1;
        console.log( `  ok    ${ name }` );

    } catch ( error ) {

        failed += 1;
        console.log( `  FAIL  ${ name }\n        ${ error.message.split( '\n' )[ 0 ] }` );

    }

}

async function checkAsync( name, run ) {

    try {

        await run();
        passed += 1;
        console.log( `  ok    ${ name }` );

    } catch ( error ) {

        failed += 1;
        console.log( `  FAIL  ${ name }\n        ${ error.message.split( '\n' )[ 0 ] }` );

    }

}

console.log( 'quoted-numbers.selftest.mjs — the claim checker against inputs whose answer is arithmetic' );
console.log();

// ------------------------------------------------------------------------------------------------
// §A  what counts as a number
// ------------------------------------------------------------------------------------------------

check( '§A extractNumbers finds exactly the numerals a reader would count, in order', () => {

    const line = '  gain at 53 px 0.773162,  at 4.8 px 0.014152,  ratio 54.63x';
    const found = extractNumbers( line ).map( ( entry ) => entry.literal );

    assert.deepEqual( found, [ '53', '0.773162', '4.8', '0.014152', '54.63' ] );

} );

check( '§A2 the forms prose actually uses: grouped thousands, exponents, ranges, section refs', () => {

    assert.deepEqual( extractNumbers( '256,106 px raw → 120,069 at 20' ).map( ( e ) => e.literal ),
        [ '256,106', '120,069', '20' ] );

    assert.deepEqual( extractNumbers( 'leaks at 1.05e-6 at 30°' ).map( ( e ) => e.literal ),
        [ '1.05e-6', '30' ] );

    assert.deepEqual( extractNumbers( 'a 0.4→0.6 step reads §6 of R25' ).map( ( e ) => e.literal ),
        [ '0.4', '0.6', '6', '25' ] );

    // ⚠️ AND THE OVER-COUNT IS DELIBERATE AND VISIBLE HERE: `§6` and `R25` are counted. The coverage
    // denominator is a CEILING on what tagging could reach, so the share it produces is a floor.
    assert.equal( extractNumbers( 'the widths 11/121/53 are the groom\'s own cell' ).length, 3 );

} );

// ------------------------------------------------------------------------------------------------
// §B  what a printed numeral asserts
// ------------------------------------------------------------------------------------------------

check( '§B numberInterval reads the LITERAL, so a trailing zero narrows the interval', () => {

    assert.equal( numberInterval( '0.110' ).ulp, 0.001 );
    assert.equal( numberInterval( '0.11' ).ulp, 0.01 );
    assert.equal( numberInterval( '16' ).ulp, 1 );
    assert.equal( numberInterval( '6.95' ).half, 0.005 );
    assert.equal( numberInterval( '54,631' ).value, 54631 );

    // 1.05e-6 asserts its own last place, scaled: ±0.5e-8.
    assert.ok( Math.abs( numberInterval( '1.05e-6' ).half - 5e-9 ) < 1e-20 );

    assert.equal( numberInterval( 'x' ), null );

} );

// ------------------------------------------------------------------------------------------------
// §C  🎯 THE HISTORICAL INSTANCE, BOTH DIRECTIONS, NO SUBPROCESS
// ------------------------------------------------------------------------------------------------

check( '§C 🎯 the five true numbers of CHECKPOINT §8 all AGREE with what the producer prints', () => {

    // claim, produced — the produced column is what lock-coherence.selftest.mjs prints on the lines
    // "gain at 53 px …" and "single fine box: 53 px …".
    const truth = [
        [ '0.119454', '0.119454' ],
        [ '0.830304', '0.830304' ],
        [ '6.9508', '6.95' ],           // an honest rounding in the PRODUCER's direction
        [ '0.014152', '0.014152' ],
        [ '54.6314', '54.63' ]
    ];

    for ( const [ claim, produced ] of truth ) {

        const verdict = claimAgrees( claim, produced );
        assert.ok( verdict.ok, `${ claim } should agree with ${ produced }: |Δ| ${ verdict.delta } > ${ verdict.allowed }` );

    }

    // And the reader can round the other way too: a claim quoted coarser than the producer prints.
    assert.ok( claimAgrees( '0.12', '0.119454' ).ok );
    assert.ok( claimAgrees( '55', '54.63' ).ok );

} );

check( '§C2 🎯 all five of the WRONG numbers FAIL, and the narrowest miss is 55x its own interval', () => {

    const wrong = [
        [ '0.110', '0.119454' ],
        [ '0.823', '0.830304' ],
        [ '7.5', '6.95' ],
        [ '0.0139', '0.014152' ],
        [ '55.5', '54.63' ]
    ];

    for ( const [ claim, produced ] of wrong ) {

        const verdict = claimAgrees( claim, produced );
        assert.ok( ! verdict.ok, `${ claim } must NOT agree with ${ produced }` );

    }

    // The nearest miss, quoted rather than asserted vaguely: 7.5 against 6.95 is |Δ| 0.55 against
    // an allowed 0.055 — an interval ten times its own would still refuse it.
    const nearest = claimAgrees( '7.5', '6.95' );
    assert.ok( Math.abs( nearest.delta - 0.55 ) < 1e-9, `Δ was ${ nearest.delta }` );
    assert.ok( Math.abs( nearest.allowed - 0.055 ) < 1e-9, `allowed was ${ nearest.allowed }` );
    console.log( `        nearest miss 7.5 vs 6.95: |Δ| ${ nearest.delta.toFixed( 3 ) } against allowed ${ nearest.allowed.toFixed( 3 ) } — ${ ( nearest.delta / nearest.allowed ).toFixed( 1 ) }x` );

} );

check( '§C3 the rule is NOT equality and NOT a fixed tolerance — both would be wrong here', () => {

    // Equality would refuse the true 6.9508 against a printed 6.95.
    assert.notEqual( '6.9508', '6.95' );
    assert.ok( claimAgrees( '6.9508', '6.95' ).ok );

    // A fixed absolute tolerance cannot serve both scales: 0.0139 vs 0.014152 differs by 2.5e-4,
    // which is smaller than the 0.55 that MUST be caught at the other end of the same file.
    const small = claimAgrees( '0.0139', '0.014152' );
    const large = claimAgrees( '7.5', '6.95' );
    assert.ok( ! small.ok && ! large.ok );
    assert.ok( small.delta < large.allowed, 'a single tolerance passing the large miss would pass the small one' );

} );

// ------------------------------------------------------------------------------------------------
// §D  tolerances, including the one sourced from the producer
// ------------------------------------------------------------------------------------------------

check( '§D an absolute tolerance widens the rule, and only by what it says', () => {

    assert.ok( ! claimAgrees( '0.1715', '0.1723' ).ok );
    assert.ok( claimAgrees( '0.1715', '0.1723', 0.0085 ).ok );
    assert.ok( ! claimAgrees( '0.1715', '0.1723', 0.0005 ).ok );

} );

check( '§D2 🎯 ±#n takes the tolerance from the PRODUCER\'s own printed scatter', () => {

    const line = '        coherence floor 0.1723 ± 0.0085   alignment floor 0.0184 ± 0.0115   (8 seeds, 512x512)';
    const source = [
        '// the floor is 0.1715 at the default widths.',
        '// @claim 0.1715 ±#2 :: node tools/quoted-numbers.mjs :: coherence floor #1'
    ].join( '\n' );

    const tags = parseTags( source, 'fixture.mjs' );
    assert.equal( tags.length, 1 );
    assert.equal( tags[ 0 ].error, null );
    assert.equal( tags[ 0 ].tolerance, '#2' );

    const [ result ] = adjudicate( tags, { 'node tools/quoted-numbers.mjs': { output: line, code: 0 } } );
    assert.ok( result.ok, result.note );
    assert.equal( result.allowed, 0.0085 );
    assert.equal( result.produced, '0.1723' );

    // 🚩 AND IT IS A REAL CONSTRAINT: the same claim against a line whose scatter is ten times
    // tighter fails. The tolerance is the producer's, not the author's.
    const tight = '        coherence floor 0.1723 ± 0.0002';
    const [ refused ] = adjudicate( tags, { 'node tools/quoted-numbers.mjs': { output: tight, code: 0 } } );
    assert.ok( ! refused.ok );

} );

// ------------------------------------------------------------------------------------------------
// §E  the tag grammar, and the producer as a security boundary
// ------------------------------------------------------------------------------------------------

check( '§E a well-formed tag parses into its four parts', () => {

    const source = [
        '// the leak is 0.014152 at lock scale.',
        '// @claim 0.014152 :: node tools/quoted-numbers.mjs --no-run :: gain at 53 px #4'
    ].join( '\n' );

    const [ tag ] = parseTags( source, 'fixture.mjs' );

    assert.equal( tag.error, null );
    assert.equal( tag.claim, '0.014152' );
    assert.equal( tag.tolerance, null );
    assert.deepEqual( tag.command, [ 'node', 'tools/quoted-numbers.mjs', '--no-run' ] );
    assert.equal( tag.selector, 'gain at 53 px' );
    assert.equal( tag.which, 4 );
    assert.equal( tag.line, 2 );

} );

check( '§E2 a malformed tag is REPORTED, never skipped — an unparsed tag looks exactly like a checked one', () => {

    const malformed = [
        '@claim 0.5 :: node tools/quoted-numbers.mjs',                        // two fields
        '@claim about half :: node tools/quoted-numbers.mjs :: label #1',      // not a number
        '@claim 0.5 :: node tools/quoted-numbers.mjs :: label',                // no #n
        '@claim 0.5 :: node tools/quoted-numbers.mjs :: #1'                    // empty selector
    ];

    for ( const text of malformed ) {

        const [ tag ] = parseTags( `// 0.5 is the number.\n// ${ text }`, 'fixture.mjs' );
        assert.ok( tag.error !== null, `should not have parsed: ${ text }` );

    }

} );

check( '§E3 the producer is `node <repo .mjs>` and nothing else — this text becomes a process', () => {

    assert.equal( parseProducer( 'node tools/quoted-numbers.mjs' ).error, null );

    for ( const bad of [
        'bash tools/run-selftests.sh',
        'node tools/quoted-numbers.mjs; rm -rf /',
        'node ../../etc/passwd.mjs',
        'node tools/run-selftests.sh',
        'node tools/no-such-file.mjs',
        'node',
        'node tools/quoted-numbers.selftest.mjs'        // would run the tree checker inside itself
    ] ) {

        assert.ok( parseProducer( bad ).error !== null, `should have been refused: ${ bad }` );

    }

} );

check( '§E4 the marker must LEAD its line, so a file can document the convention without claiming it', () => {

    assert.ok( isTagLine( ' @claim 1 :: node x.mjs :: y #1' ) );
    assert.ok( ! isTagLine( ' `@claim <number> …` is the form' ) );
    assert.ok( ! isTagLine( ' Parse every @claim tag in one file' ) );

    // The header of quoted-numbers.mjs quotes the marker five times and declares no tags.
    const source = fs.readFileSync( path.join( REPO_ROOT, 'tools/quoted-numbers.mjs' ), 'utf8' );
    assert.equal( parseTags( source, 'tools/quoted-numbers.mjs' ).length, 0 );

} );

// ------------------------------------------------------------------------------------------------
// §F  the binding — a tag that describes prose which is not there
// ------------------------------------------------------------------------------------------------

check( '§F an ORPHAN tag is red: the number must appear in the prose of its own block', () => {

    const bound = '// the ratio is 54.6314x.\n// @claim 54.6314 :: node tools/quoted-numbers.mjs :: r #1';
    const orphan = '// the ratio is 55.5x.\n// @claim 54.6314 :: node tools/quoted-numbers.mjs :: r #1';

    assert.equal( parseTags( bound, 'f.mjs' )[ 0 ].error, null );
    assert.match( parseTags( orphan, 'f.mjs' )[ 0 ].error, /ORPHAN/ );

    // 🎯 THIS IS THE CLAUSE THAT REFUSES THE HALF-FIX. The historical instance was a corrected
    // number left in one place and stale in another; a tag updated without its prose reads exactly
    // like that, and is refused for exactly that reason.

} );

check( '§F2 a number binds only as a WHOLE numeral — 0.110 does not hide inside 0.1102', () => {

    assert.ok( literalAppears( 'the floor is 0.110 here', '0.110' ) );
    assert.ok( ! literalAppears( 'the floor is 0.1102 here', '0.110' ) );
    assert.ok( ! literalAppears( 'the floor is 10.110 here', '0.110' ) );

} );

check( '§F3 the block is the binding scope: a gap of one source line ends it', () => {

    const separated = [
        '// 54.6314 lives up here.',
        'const x = 1;',
        '// @claim 54.6314 :: node tools/quoted-numbers.mjs :: r #1'
    ].join( '\n' );

    assert.match( parseTags( separated, 'f.mjs' )[ 0 ].error, /ORPHAN/ );

} );

// ------------------------------------------------------------------------------------------------
// §G  the scanner — comments, strings, regexes, nested templates
// ------------------------------------------------------------------------------------------------

const SCANNER_FIXTURE = [
    'const pattern = /[;|&$`"\'#]/g;              // a class full of quotes: 1 numeral here',   // line 1
    'const divided = total / 2 / 3;               // a division, not a regex: 2 numerals',      // 2
    'const message = `outer ${ inner( `deep ${ 4 }` ) } 5 tail`;',                              // 3
    'const text = "a string with 6 and 7 in it";',                                              // 4
    '',                                                                                          // 5
    '// a block of prose carrying 8 and 9',                                                     // 6
    '// and 10 on its second line',                                                             // 7
    'const after = 11;',                                                                        // 8
    '/* a real block comment with 12 */'                                                        // 9
].join( '\n' );

check( '§G the scanner finds every comment a reader would, and the count is hand-checked', () => {

    const { blocks, stringNumerals } = scanSource( SCANNER_FIXTURE );

    // Four blocks: the two trailing `//` on lines 1–2 are consecutive so they MERGE into one, the
    // prose on 6–7 is another, and the `/* */` on line 9 is the third.
    assert.equal( blocks.length, 3, `blocks: ${ JSON.stringify( blocks.map( ( b ) => [ b.kind, b.startLine, b.endLine ] ) ) }` );
    assert.deepEqual( blocks.map( ( block ) => block.kind ), [ 'block', 'line', 'line' ] );

    const commentNumerals = blocks.flatMap( ( block ) => block.lines ).flatMap( ( entry ) => extractNumbers( entry.text ) ).length;

    // Hand count: line 1 "1", line 2 "2", lines 6–7 "8", "9", "10", line 9 "12" → 6.
    assert.equal( commentNumerals, 6, `comment numerals: ${ commentNumerals }` );

    // Hand count of numerals inside STRING literals: the `5` in the outer template's tail, and the
    // 6 and 7 in the double-quoted string. The regex literal is not a string and contributes none —
    // and neither does the `4`, which sits inside a `${ }` hole and is therefore CODE, which is the
    // distinction that makes this count mean anything.
    assert.equal( stringNumerals, 3, `string numerals: ${ stringNumerals }` );

    assert.deepEqual( scannerDisagreement( SCANNER_FIXTURE, blocks ), { missed: 0, invented: 0, total: 0 } );

} );

check( '§G2 a regex character class carrying a backtick does NOT open a string', () => {

    // The exact construct that cost 71 comment lines across five files before the regex branch
    // existed — including ten in quoted-numbers.mjs itself.
    const source = 'if ( /[;|&$`]/.test( token ) ) return;\n// this comment must still be seen, with 13 in it';
    const { blocks } = scanSource( source );

    assert.equal( blocks.length, 1 );
    assert.equal( extractNumbers( blocks[ 0 ].lines[ 0 ].text )[ 0 ].literal, '13' );

} );

check( '§G3 regexAllowedAfter separates a regex from a division, keyword exceptions included', () => {

    assert.ok( regexAllowedAfter( '' ) );
    assert.ok( regexAllowedAfter( '.replace(' ) );
    assert.ok( regexAllowedAfter( '=' ) );
    assert.ok( regexAllowedAfter( 'return' ) );
    assert.ok( ! regexAllowedAfter( 'total' ) );
    assert.ok( ! regexAllowedAfter( ')' ) );
    assert.ok( ! regexAllowedAfter( '2' ) );

} );

check( '§G4 nested `${ }` holes close the INNER template, not the outer one', () => {

    const source = 'const m = `a ${ b( `c ${ d } e` ) } f`;\n// the comment after three levels, with 14';
    const { blocks } = scanSource( source );

    assert.equal( blocks.length, 1 );
    assert.equal( extractNumbers( blocks[ 0 ].lines[ 0 ].text )[ 0 ].literal, '14' );

} );

check( '§G5 countFile keeps tag machinery OUT of the untagged prose count', () => {

    const source = [
        '// the ratio is 54.6314x and the floor is 0.1715.',
        '// @claim 54.6314 :: node tools/quoted-numbers.mjs :: r #1'
    ].join( '\n' );

    const counts = countFile( source );

    // Two numerals in the prose line; the tag line's own 54.6314 and #1 are not prose.
    assert.equal( counts.commentNumerals, 2 );
    assert.equal( counts.tagLines, 1 );

} );

// ------------------------------------------------------------------------------------------------
// §H  adjudication against a producer's output
// ------------------------------------------------------------------------------------------------

function fixtureTag( claim, selector, which ) {

    const source = `// the number is ${ claim } exactly.\n// @claim ${ claim } :: node tools/quoted-numbers.mjs :: ${ selector } #${ which }`;
    return parseTags( source, 'fixture.mjs' );

}

check( '§H an AMBIGUOUS selector is refused rather than guessed', () => {

    const output = [ '  ratio 6.95x', '  ratio 54.63x' ].join( '\n' );
    const [ result ] = adjudicate( fixtureTag( '6.95', 'ratio', 1 ), { 'node tools/quoted-numbers.mjs': { output, code: 0 } } );

    assert.ok( ! result.ok );
    assert.match( result.note, /matched 2 output lines/ );

} );

check( '§H2 a selector that matches nothing, and an index past the end of the line, are both red', () => {

    const output = '  ratio 6.95x';

    const [ missing ] = adjudicate( fixtureTag( '6.95', 'no such label', 1 ), { 'node tools/quoted-numbers.mjs': { output, code: 0 } } );
    assert.match( missing.note, /matched no output line/ );

    const [ past ] = adjudicate( fixtureTag( '6.95', 'ratio', 9 ), { 'node tools/quoted-numbers.mjs': { output, code: 0 } } );
    assert.match( past.note, /carries 1 numbers/ );

} );

check( '§H3 a producer that exits red still has its numbers read, and the exit is reported', () => {

    const [ result ] = adjudicate( fixtureTag( '6.95', 'ratio', 1 ), { 'node tools/quoted-numbers.mjs': { output: '  ratio 6.95x', code: 1 } } );

    // 🚩 The producer's own gate owns its red. If this gate refused to read a red producer's output,
    // a wrong number would hide behind an unrelated failing clause for as long as it took to fix.
    assert.ok( result.ok );
    assert.equal( result.producerCode, 1 );

} );

check( '§H4 the whole path end to end: a wrong claim against a real producer line is caught', () => {

    const output = '        single fine box: 53 px 0.830304, 4.8 px 0.119454,  ratio 6.95x';
    const outputs = { 'node tools/quoted-numbers.mjs': { output, code: 0 } };

    const good = adjudicate( fixtureTag( '0.119454', 'single fine box: 53 px', 4 ), outputs );
    assert.ok( good[ 0 ].ok, good[ 0 ].note );

    // The historical wrong value, through the whole machine rather than through claimAgrees alone.
    const bad = parseTags( '// the leak is 0.110 at 4.8 px.\n// @claim 0.110 :: node tools/quoted-numbers.mjs :: single fine box: 53 px #4', 'f.mjs' );
    const verdict = adjudicate( bad, outputs );

    assert.ok( ! verdict[ 0 ].ok );
    assert.match( verdict[ 0 ].note, /0\.110 against produced 0\.119454/ );

} );

// ------------------------------------------------------------------------------------------------
// §Z  the real tree, with the real producers
// ------------------------------------------------------------------------------------------------

await checkAsync( '§Z 🎯 every tagged claim in the tree verifies against the command it names', async () => {

    const started = Date.now();
    const { tags, results, coverage } = await checkTree();

    console.log( `        ${ tags.length } tags in ${ Object.keys( coverage.perFile ).length } files, producers run in ${ ( ( Date.now() - started ) / 1000 ).toFixed( 1 ) }s` );

    for ( const result of results ) {

        console.log( `        ${ result.ok ? '·' : '✗' } ${ result.tag.file }:${ result.tag.line }  ${ result.tag.claim === undefined ? result.tag.raw : result.tag.claim } ${ result.ok ? '==' : 'vs' } ${ result.produced === undefined ? '—' : result.produced }` );

    }

    // A gate that checks nothing must not pass. The tagged set is small on purpose and named in
    // `docs/RED-GATES.md`; zero is a different thing and it means the tags were lost.
    assert.ok( tags.length >= 8, `only ${ tags.length } tagged claims found — the tagged set is lock-coherence.mjs and band-power.mjs` );

    const bad = results.filter( ( result ) => ! result.ok );
    assert.equal( bad.length, 0, bad.map( ( result ) => `${ result.tag.file }:${ result.tag.line } ${ result.note }` ).join( ' | ' ) );

    // ⚠️ REACH, PRINTED WITH THE RESULT AND NOT ONLY IN THE TOOL'S OWN OUTPUT, because a reader who
    // sees "every tagged claim verifies" and not "of 23,000 numerals in comment prose" has been
    // told the tree is checked. It is not. Two files are.
    const share = ( 100 * coverage.tagged / coverage.commentNumerals ).toFixed( 3 );
    console.log( `        REACH: ${ coverage.tagged } tagged of ${ coverage.commentNumerals } numerals in comment prose across ${ coverage.files } files — ${ share }%` );
    console.log( `        and ${ coverage.stringNumerals } numerals in string literals are out of reach entirely (scanner disagreement ${ coverage.missed } missed / ${ coverage.invented } invented)` );

} );

console.log();
console.log( `${ passed } passed, ${ failed } failed` );

process.exit( failed === 0 ? 0 : 1 );
