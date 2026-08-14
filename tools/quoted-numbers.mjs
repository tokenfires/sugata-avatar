#!/usr/bin/env node
//
// quoted-numbers.mjs — the gate on NUMBERS WRITTEN INTO PROSE.
//
// ## Why this exists
//
// Four times in this phase a justification comment has carried numbers that are simply wrong, and
// every one of them was written by an author who had the right number on screen at the time:
//
//   * `docs/LEARNINGS.md` §1.25r — the gate-count table, eleven drifted counts across three rounds.
//   * `hair_alpha.SAMPLED_LOD` 1.492 — a constant quoted for two rounds from a Jacobian measured in
//     the wrong pixel space, so the prose and the shipped scale disagreed by log2(1/0.66).
//   * `docs/RED-GATES.md`'s own history carries two more.
//   * MOST RECENTLY, `docs/CHECKPOINT.md` §8: **five wrong numbers in one comment block** in
//     `tools/critic/lock-coherence.mjs` — 0.110 / 0.823 / 7.5x / 0.0139 / 55.5x against true values
//     0.119454 / 0.830304 / 6.9508 / 0.014152 / 54.6314 — in a file **whose own selftest printed
//     the right values two lines from the label carrying the wrong ones.**
//
// The pattern is not carelessness about arithmetic. It is that a number written into prose during
// authoring is a CLAIM WITH NO GATE ON IT: the selftest asserts what the code computes, and nobody
// ever re-reads the sentence beside it. `tools/run-selftests.sh` exists for exactly this shape of
// failure one level up ("a count typed into prose is a claim with no gate on it. This is the gate
// on it"). This is that gate for a number typed into a comment.
//
// ## The convention — a TAGGED CLAIM
//
// A tagged claim is one line in the same comment block as the prose, naming the number AND the
// command that produces it:
//
//   `@claim <number> [±<tolerance>|±#<n>] :: node <script.mjs> [args...] :: <selector> #<n>`
//
// 🚩 THE MARKER MUST BE THE FIRST TOKEN ON ITS LINE, which is why every mention of it in this
// header sits inside backticks. A file has to be able to describe the convention without each
// mention becoming a claim — and a gate whose own documentation made it depend on another tool's
// twenty-three-second selftest would be paying that cost forever.
//
//   <number>      the numeric literal EXACTLY as it is written in the prose, no unit.
//   ±<tolerance>  optional. An absolute tolerance, for a STOCHASTIC quantity.
//   ±#<n>         optional. The tolerance is the n-th number ON THE PRODUCER'S OWN MATCHED LINE —
//                 so a seed-scatter claim is checked against the scatter the producer printed,
//                 rather than against a tolerance the author picked to make the check pass. That
//                 distinction is the whole reason this form exists.
//   node …        the producer. Runs with no shell, `node` only, one repo-relative `.mjs` path.
//   <selector>    a substring that must match EXACTLY ONE line of the producer's stdout.
//   #<n>          which numeric literal on that line, 1-based.
//
// Example, live in `tools/critic/lock-coherence.mjs` and quoted here rather than repeated as a tag:
//
//   `@claim 0.119454 :: node tools/critic/lock-coherence.selftest.mjs :: single fine box: 53 px #4`
//
// ### How two numbers are compared, and why not by equality
//
// A producer prints `6.95` and the prose says `6.9508`; another prints `0.119454` and the prose
// says `0.12`. Both are honest roundings and equality would refuse them, so the rule is:
//
//   **the two numbers AGREE when the intervals implied by their own printed precisions OVERLAP.**
//
// `6.95` means "somewhere in [6.945, 6.955)" and `6.9508` lies inside it; `0.12` means
// "[0.115, 0.125)" and 0.119454 lies inside that. It is a rule about what the ink says, and it
// needs no tolerance parameter to be chosen — which matters, because a tolerance chosen by the
// author of the claim is a tolerance chosen to make the claim pass.
//
// 🚩 On the five historical numbers this rule is unambiguous in BOTH directions, which is the
// bound this gate is pinned at (`quoted-numbers.selftest.mjs` §C, arithmetic, no subprocess):
// the true values 0.119454 / 0.830304 / 6.9508 / 0.014152 / 54.6314 all agree with what the
// selftest prints, and the wrong values 0.110 / 0.823 / 7.5 / 0.0139 / 55.5 all fail — the nearest
// miss is 7.5 against a printed 6.95, which needs an interval 55 times wider than its own to pass.
//
// ## 🚩 WHAT THIS GATE CANNOT SEE, STATED BEFORE ANY COVERAGE NUMBER IS QUOTED
//
// **1. IT ONLY CHECKS WHAT IS TAGGED, AND ALMOST NOTHING IS TAGGED.** Every run prints the count of
// numerals in comment prose across the scanned tree beside the count of tagged claims, because a
// gate that checks ten numbers out of thousands and does not say so is worse than no gate — it
// converts "unchecked" into "checked" in the reader's head. The tagged set is deliberately small
// (`lock-coherence.mjs` and `band-power.mjs`) and retrofitting the tree is NOT this round's work.
//
// **2. THE UNTAGGED COUNT IS AN OVER-COUNT, ON PURPOSE.** It counts every numeric literal in
// comment text — section refs (§7), round labels (R25), dates, pixel widths, array indices in
// prose. Many of those are not claims and could never be tagged. It is a CEILING on what tagging
// could ever cover, not an estimate of what should be tagged, and the coverage percentage it
// produces is therefore a FLOOR. Both directions of that are stated in the output.
//
// **3. IT READS COMMENTS, NOT STRINGS.** A number inside a string literal is invisible to it, and
// that blind spot has a live instance in this very repository: `lock-coherence.selftest.mjs`'s §1b
// check LABEL still reads *"a single fine box would only separate 7.5x"* — 7.5 is the fifth of the
// five wrong numbers, corrected in the prose and left standing in the label, where it is printed to
// the terminal on every run of the suite. The run prints the string-literal numeral count so the
// size of that blind spot is a number rather than a caveat.
//
// **4. THE BINDING IS BLOCK-LEVEL.** A tag proves its number appears in the same comment block, not
// which sentence it is in. Two different quantities that share a literal inside one block are
// indistinguishable to this gate. A tag whose number appears NOWHERE in its block is reported as
// `ORPHAN` — that is the clause that stops a tag from being updated while the prose it describes
// is left behind.
//
// **5. THE COMMENT SCANNER IS A HEURISTIC AT ONE EDGE.** It is a character state machine over
// strings and comments, and a regex literal containing `//` would open a comment that is not there.
// The run prints how far it disagrees with a dumb `^\s*//` line count over the scanned tree so the
// size of that is also a number — 0 missed and 0 invented over the 176 files scanned when this
// landed, which is the number the run reprints on every invocation rather than trusting this
// sentence. It was 71 missed before the regex and nested-template branches existed.
//
// **6. IT COMPARES MAGNITUDES.** Signs and units are not checked: `54.6314x` and `54.6314%` are the
// same claim to this gate, and a claim quoted in a different unit from its producer (24.7% against
// a printed 0.2458) will read as a mismatch. Quote a claim in the producer's own unit.
//
// ## Usage
//
//   node tools/quoted-numbers.mjs                 # verify every tagged claim, then print coverage
//   node tools/quoted-numbers.mjs --no-run        # parse and bind tags only; run no producers
//   node tools/quoted-numbers.mjs --file <path>   # restrict to one file
//
// Exit code is the number of claims that did not verify. `quoted-numbers.selftest.mjs` is the gate
// on this file, and it runs the real tree as its last clause — so a wrong number in a tagged
// comment turns the SUITE red, which is the only thing that makes any of this load-bearing.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character.
const HERE = path.dirname( fileURLToPath( import.meta.url ) );
export const REPO_ROOT = path.resolve( HERE, '..' );

export const TAG_MARKER = '@claim';

/**
 * A numeric literal as prose writes one: an optional thousands-grouped integer part, an optional
 * fraction, an optional exponent. No sign — see blind spot 6; a leading `−` in this repository is
 * as often a dash as a minus, and a sign the gate cannot read is better than a sign it guesses.
 */
const NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/** Files whose comments are scanned for tags and counted for coverage. */
const SCAN_DIRECTORIES = [ 'tools', 'packages' ];
const SCAN_EXTENSIONS = [ '.mjs', '.js' ];
const SKIP_DIRECTORIES = new Set( [ 'node_modules', 'dist', 'dist-pages', '.git', '__pycache__' ] );

// ------------------------------------------------------------------------------------------------
// The operator: what counts as a number, and when do two of them agree
// ------------------------------------------------------------------------------------------------

/**
 * Every numeric literal in a piece of text, in order, with the position it was found at.
 *
 * @param {string} text
 * @returns {{ literal: string, index: number }[]}
 */
export function extractNumbers( text ) {

    const found = [];
    NUMBER_PATTERN.lastIndex = 0;

    let match = NUMBER_PATTERN.exec( text );

    while ( match !== null ) {

        found.push( { literal: match[ 0 ], index: match.index } );
        match = NUMBER_PATTERN.exec( text );

    }

    return found;

}

/**
 * The interval a printed numeral actually asserts.
 *
 * `0.110` asserts 0.110 ± 0.0005 — the trailing zero is information and is preserved because this
 * reads the LITERAL rather than the parsed value. `16` asserts 16 ± 0.5. `1.05e-6` asserts
 * ± 0.5e-8, its own last place scaled by its exponent.
 *
 * @returns {{ value: number, ulp: number, half: number, literal: string } | null}
 */
export function numberInterval( literal ) {

    const clean = String( literal ).replace( /,/g, '' );
    const parts = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec( clean );

    if ( parts === null ) return null;

    const decimals = parts[ 2 ] === undefined ? 0 : parts[ 2 ].length;
    const exponent = parts[ 3 ] === undefined ? 0 : parseInt( parts[ 3 ], 10 );
    const ulp = Math.pow( 10, exponent - decimals );

    return { value: Number( clean ), ulp, half: ulp / 2, literal: String( literal ) };

}

/**
 * Do a claimed number and a produced number agree?
 *
 * Without a tolerance: their printed-precision intervals must OVERLAP, which admits an honest
 * rounding in either direction and refuses anything else. With a tolerance: the absolute difference
 * must be within it, which is the form a stochastic quantity needs — and `±#n` sources that
 * tolerance from the producer's own printed scatter rather than from the author.
 */
export function claimAgrees( claimLiteral, producedLiteral, tolerance = null ) {

    const claim = numberInterval( claimLiteral );
    const produced = numberInterval( producedLiteral );

    if ( claim === null || produced === null ) {

        return { ok: false, reason: 'unparseable numeral', delta: NaN, allowed: NaN, rule: 'none' };

    }

    const delta = Math.abs( claim.value - produced.value );

    if ( tolerance !== null ) {

        return { ok: delta <= tolerance, delta, allowed: tolerance, rule: `±${ tolerance }` };

    }

    const allowed = claim.half + produced.half;

    return { ok: delta <= allowed, delta, allowed, rule: 'printed precision' };

}

// ------------------------------------------------------------------------------------------------
// The scanner: comment blocks, and the numbers that are NOT in them
// ------------------------------------------------------------------------------------------------

/**
 * Split a source file into COMMENT BLOCKS, and count the numerals that live in string literals.
 *
 * A block is one `/* … *\/` comment, or a maximal run of `//` lines on consecutive source lines.
 * The run is what makes block-level binding useful: this repository writes one long `//` banner per
 * file, and a tag anywhere in that banner is beside the prose it is about.
 *
 * 🚩 The string-literal numeral count is not a by-product, it is blind spot 3 made countable: the
 * fifth of the five historical wrong numbers is alive right now inside a string literal.
 */
export function scanSource( source ) {

    const blocks = [];
    const lineComments = [];
    let stringNumerals = 0;

    let state = 'code';
    let line = 1;
    let buffer = '';
    let bufferLine = 1;
    let quote = '';
    let inCharacterClass = false;
    const templates = [];

    // The last few non-space characters of CODE, which is all a regex-literal test needs. Without
    // it, `/[;|&$`]/` — a character class carrying a quote or a backtick — opens a string that never
    // closes and swallows every comment after it. That was measured, in this very file, before this
    // branch existed: 71 comment lines lost across five files, 10 of them here.
    let codeTail = '';

    for ( let i = 0; i < source.length; i ++ ) {

        const character = source[ i ];
        const following = source[ i + 1 ];

        if ( state === 'code' ) {

            if ( character === '/' && following === '/' ) { state = 'line'; buffer = ''; bufferLine = line; i += 1; continue; }
            if ( character === '/' && following === '*' ) { state = 'block'; buffer = ''; bufferLine = line; i += 1; continue; }
            if ( character === '/' && regexAllowedAfter( codeTail ) ) { state = 'regex'; inCharacterClass = false; continue; }
            if ( character === '"' || character === "'" || character === '`' ) { state = 'string'; quote = character; buffer = ''; continue; }

            // A `${ … }` hole is CODE inside a template, and the code inside it may open another
            // template. Counting braces on a stack is what lets a nested backtick close the inner
            // template instead of the outer one — measured before this branch existed: twenty
            // comment lines lost in `alive-toggles.selftest.mjs`, whose message strings nest three
            // deep.
            if ( character === '{' && templates.length > 0 ) templates[ templates.length - 1 ].braces += 1;

            if ( character === '}' && templates.length > 0 ) {

                const top = templates[ templates.length - 1 ];

                if ( top.braces === 0 ) { templates.pop(); state = 'string'; quote = '`'; buffer = ''; continue; }

                top.braces -= 1;

            }

            if ( character === '\n' ) line += 1;
            if ( ! /\s/.test( character ) ) codeTail = ( codeTail + character ).slice( -16 );
            continue;

        }

        if ( state === 'regex' ) {

            if ( character === '\\' ) { i += 1; continue; }
            if ( character === '\n' ) { line += 1; state = 'code'; continue; }   // an unterminated regex was a division after all
            if ( character === '[' ) { inCharacterClass = true; continue; }
            if ( character === ']' ) { inCharacterClass = false; continue; }
            if ( character === '/' && ! inCharacterClass ) { state = 'code'; codeTail = ( codeTail + '/' ).slice( -16 ); continue; }
            continue;

        }

        if ( state === 'line' ) {

            if ( character === '\n' ) { lineComments.push( { line: bufferLine, text: buffer } ); state = 'code'; line += 1; continue; }
            buffer += character;
            continue;

        }

        if ( state === 'block' ) {

            if ( character === '*' && following === '/' ) { blocks.push( blockFromComment( bufferLine, buffer ) ); state = 'code'; i += 1; continue; }
            if ( character === '\n' ) line += 1;
            buffer += character;
            continue;

        }

        // state === 'string'
        if ( character === '\\' ) {

            const escaped = source[ i + 1 ];
            if ( escaped === '\n' ) line += 1;
            buffer += character + ( escaped === undefined ? '' : escaped );
            i += 1;
            continue;

        }

        if ( character === '$' && following === '{' && quote === '`' ) {

            stringNumerals += extractNumbers( buffer ).length;
            templates.push( { braces: 0 } );
            state = 'code';
            codeTail = '{';
            i += 1;
            continue;

        }

        if ( character === quote ) { stringNumerals += extractNumbers( buffer ).length; state = 'code'; continue; }
        if ( character === '\n' ) line += 1;
        buffer += character;

    }

    if ( state === 'line' ) lineComments.push( { line: bufferLine, text: buffer } );

    return { blocks: blocks.concat( mergeLineComments( lineComments ) ), stringNumerals };

}

/**
 * Is a `/` here the start of a REGEX LITERAL, or a division?
 *
 * The standard heuristic, and the only one that does not need a parser: after a value — an
 * identifier, a number, a closing bracket — `/` divides; after an operator, a comma, an opening
 * bracket or nothing, it opens a regex. The keyword list is the exception the character test gets
 * wrong, because `return /x/` ends in a letter and is not a division.
 */
export function regexAllowedAfter( codeTail ) {

    const previous = codeTail.slice( -1 );

    if ( previous === '' ) return true;

    const word = /([A-Za-z$_]+)$/.exec( codeTail );

    if ( word !== null && /^(return|typeof|case|in|of|delete|void|instanceof|new|do|else|yield|await)$/.test( word[ 1 ] ) ) return true;

    return ! /[A-Za-z0-9_$)\]]/.test( previous );

}

/** One `/* … *\/` comment becomes one block, with a line number for each of its lines. */
function blockFromComment( startLine, body ) {

    const lines = body.split( '\n' ).map( ( text, offset ) => ( {
        line: startLine + offset,
        text: text.replace( /^\s*\*/, '' )
    } ) );

    return { kind: 'block', startLine, endLine: startLine + lines.length - 1, lines };

}

/** Consecutive `//` lines are one block; a gap of a source line ends it. */
function mergeLineComments( comments ) {

    const blocks = [];
    let current = null;

    for ( const comment of comments ) {

        if ( current !== null && comment.line === current.endLine + 1 ) {

            current.lines.push( comment );
            current.endLine = comment.line;
            continue;

        }

        current = { kind: 'line', startLine: comment.line, endLine: comment.line, lines: [ comment ] };
        blocks.push( current );

    }

    return blocks;

}

/**
 * How far the state machine's idea of "this line is a comment" differs from a dumb "the line starts
 * with two slashes" count, in BOTH directions — blind spot 5 made countable.
 *
 *   MISSED    a line the dumb count calls a comment and the scanner did not see. A string state
 *             that never closed swallows real comments this way.
 *   INVENTED  a line the scanner calls a `//` comment whose source carries no `//` at all. A regex
 *             literal containing `//` opens a comment that is not there and runs away this way.
 */
export function scannerDisagreement( source, blocks ) {

    const sourceLines = source.split( '\n' );
    const seen = new Set();

    for ( const block of blocks ) {

        if ( block.kind !== 'line' ) continue;

        for ( const entry of block.lines ) seen.add( entry.line );

    }

    let missed = 0;
    let invented = 0;

    sourceLines.forEach( ( text, offset ) => {

        const number = offset + 1;

        if ( /^\s*\/\//.test( text ) && ! seen.has( number ) ) missed += 1;
        if ( seen.has( number ) && ! text.includes( '//' ) ) invented += 1;

    } );

    return { missed, invented, total: missed + invented };

}

/**
 * Does `literal` appear in `text` as its own numeral, rather than inside a longer one?
 *
 * `0.110` must not bind to the `0.110` inside `0.1102`, or a tag would certify a number the prose
 * does not carry.
 */
export function literalAppears( text, literal ) {

    for ( const found of extractNumbers( text ) ) {

        if ( found.literal === literal ) return true;

    }

    return false;

}

// ------------------------------------------------------------------------------------------------
// The tags
// ------------------------------------------------------------------------------------------------

/**
 * Is this comment line a TAG?
 *
 * 🚩 The marker must be the FIRST token on the line. A directive that leads its line is how every
 * linter in the world spells this, and here it buys something specific: a file may describe the
 * convention — quote the marker in a sentence, sketch the grammar in backticks — without every
 * mention becoming a claim somebody has to produce a command for. This file's own header does
 * exactly that, deliberately: documenting a tag must not make this gate depend on a
 * twenty-three-second selftest belonging to another tool.
 */
export function isTagLine( text ) {

    return text.trimStart().startsWith( TAG_MARKER );

}

/**
 * Parse every tag in one source file, binding each to the prose in its own block.
 *
 * A malformed tag is returned with an `error` rather than skipped: a tag that does not parse is a
 * claim nobody is checking while looking exactly like a claim somebody is, which is the failure
 * mode one level down from the one this file exists for.
 */
export function parseTags( source, file ) {

    const { blocks } = scanSource( source );
    const tags = [];

    for ( const block of blocks ) {

        const tagLines = block.lines.filter( ( entry ) => isTagLine( entry.text ) );
        const prose = block.lines.filter( ( entry ) => ! isTagLine( entry.text ) )
            .map( ( entry ) => entry.text ).join( '\n' );

        for ( const entry of tagLines ) {

            tags.push( parseOneTag( entry, prose, file, block ) );

        }

    }

    return tags;

}

function parseOneTag( entry, prose, file, block ) {

    const tag = { file, line: entry.line, blockStart: block.startLine, raw: entry.text.trim(), error: null };
    const body = entry.text.slice( entry.text.indexOf( TAG_MARKER ) + TAG_MARKER.length ).trim();
    const fields = body.split( ' :: ' ).map( ( field ) => field.trim() );

    if ( fields.length !== 3 ) {

        tag.error = `expected three ' :: ' separated fields, found ${ fields.length }`;
        return tag;

    }

    const claim = /^(\d[\d,]*(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:\s*±\s*(#?\d[\d.]*))?$/.exec( fields[ 0 ] );

    if ( claim === null ) {

        tag.error = `first field is not "<number> [±<tolerance>|±#<n>]": "${ fields[ 0 ] }"`;
        return tag;

    }

    tag.claim = claim[ 1 ];
    tag.tolerance = claim[ 2 ] === undefined ? null : claim[ 2 ];

    const selector = /^(.*?)\s*#(\d+)$/.exec( fields[ 2 ] );

    if ( selector === null ) {

        tag.error = `third field must end with "#<n>": "${ fields[ 2 ] }"`;
        return tag;

    }

    tag.selector = selector[ 1 ];
    tag.which = parseInt( selector[ 2 ], 10 );

    if ( tag.selector === '' ) { tag.error = 'the selector is empty'; return tag; }
    if ( tag.which < 1 ) { tag.error = 'the number index is 1-based'; return tag; }

    const command = parseProducer( fields[ 1 ] );

    if ( command.error !== null ) { tag.error = command.error; return tag; }

    tag.command = command.tokens;

    // The binding. A tag whose number is not in its own block certifies nothing.
    if ( ! literalAppears( prose, tag.claim ) ) {

        tag.error = `ORPHAN — ${ tag.claim } does not appear in the comment block at line ${ block.startLine }`;

    }

    return tag;

}

/**
 * A producer is `node <repo-relative .mjs> [args]`, run with no shell.
 *
 * ⚠️ This function is a SECURITY BOUNDARY as much as a parser: it turns text found in a source
 * comment into a process. `node` only, a path that must resolve inside the repository and exist,
 * and no shell metacharacters in any token — the tokens go to `execFile` as an array, so nothing
 * is ever handed to a shell in the first place, and this check is the second lock.
 */
export function parseProducer( text ) {

    const tokens = text.split( /\s+/ ).filter( ( token ) => token !== '' );

    if ( tokens.length < 2 || tokens[ 0 ] !== 'node' ) {

        return { tokens: null, error: `producer must be "node <script.mjs> …", found "${ text }"` };

    }

    for ( const token of tokens ) {

        if ( /[;|&$><`(){}*?~!\\]/.test( token ) ) return { tokens: null, error: `producer token "${ token }" carries a shell metacharacter` };

    }

    const script = tokens[ 1 ];
    const resolved = path.resolve( REPO_ROOT, script );

    // 🚩 A tag may not name THIS gate's own selftest, and the reason is not tidiness: the selftest's
    // last clause runs every producer in the tree, so a tag pointing at it would run the tree
    // checker from inside the tree checker, forever. The temptation is real — the honest way to
    // check a number this gate itself prints is to have some other command print it.
    if ( resolved === path.join( REPO_ROOT, 'tools', 'quoted-numbers.selftest.mjs' ) ) {

        return { tokens: null, error: 'a producer may not be this gate\'s own selftest — it runs every producer, so the tag would recurse' };

    }

    if ( ! script.endsWith( '.mjs' ) ) return { tokens: null, error: `producer script must be a .mjs file, found "${ script }"` };
    if ( ! resolved.startsWith( REPO_ROOT + path.sep ) ) return { tokens: null, error: `producer script escapes the repository: "${ script }"` };
    if ( ! fs.existsSync( resolved ) ) return { tokens: null, error: `producer script does not exist: "${ script }"` };

    return { tokens, error: null };

}

// ------------------------------------------------------------------------------------------------
// Running the producers and adjudicating
// ------------------------------------------------------------------------------------------------

/** Run one producer, capturing stdout and stderr together — a gate prints to both. */
export function runProducer( tokens ) {

    return new Promise( ( resolve ) => {

        execFile( tokens[ 0 ], tokens.slice( 1 ), { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 },
            ( error, stdout, stderr ) => {

                resolve( {
                    output: `${ stdout }${ stderr }`,
                    code: error === null ? 0 : ( error.code === undefined ? 1 : error.code )
                } );

            } );

    } );

}

/**
 * Adjudicate every tag against its producer's output.
 *
 * `outputs` maps a joined command to `{ output, code }`, so the caller decides how the producers
 * are run — the selftest hands in fixtures for the arithmetic clauses and the real thing for the
 * tree clause, and neither path is a different adjudicator.
 */
export function adjudicate( tags, outputs ) {

    return tags.map( ( tag ) => {

        if ( tag.error !== null ) return { tag, ok: false, note: tag.error };

        const produced = outputs[ tag.command.join( ' ' ) ];

        if ( produced === undefined ) return { tag, ok: false, note: 'producer was not run' };

        const matched = produced.output.split( '\n' ).filter( ( line ) => line.includes( tag.selector ) );

        if ( matched.length === 0 ) return { tag, ok: false, note: `selector "${ tag.selector }" matched no output line`, producerCode: produced.code };
        if ( matched.length > 1 ) return { tag, ok: false, note: `selector "${ tag.selector }" matched ${ matched.length } output lines — an ambiguous selector is refused rather than guessed`, producerCode: produced.code };

        const numbers = extractNumbers( matched[ 0 ] );

        if ( numbers.length < tag.which ) {

            return { tag, ok: false, note: `the matched line carries ${ numbers.length } numbers, #${ tag.which } was asked for`, line: matched[ 0 ], producerCode: produced.code };

        }

        const producedLiteral = numbers[ tag.which - 1 ].literal;
        const tolerance = resolveTolerance( tag, numbers );

        if ( tolerance.error !== null ) return { tag, ok: false, note: tolerance.error, line: matched[ 0 ], producerCode: produced.code };

        const verdict = claimAgrees( tag.claim, producedLiteral, tolerance.value );

        return {
            tag,
            ok: verdict.ok,
            produced: producedLiteral,
            delta: verdict.delta,
            allowed: verdict.allowed,
            rule: verdict.rule,
            line: matched[ 0 ],
            producerCode: produced.code,
            note: verdict.ok ? '' : `claim ${ tag.claim } against produced ${ producedLiteral } — |Δ| ${ verdict.delta.toPrecision( 3 ) } exceeds ${ Number( verdict.allowed ).toPrecision( 3 ) } (${ verdict.rule })`
        };

    } );

}

function resolveTolerance( tag, numbers ) {

    if ( tag.tolerance === null ) return { value: null, error: null };

    if ( tag.tolerance.startsWith( '#' ) ) {

        const which = parseInt( tag.tolerance.slice( 1 ), 10 );

        if ( numbers.length < which ) return { value: null, error: `the tolerance asked for number #${ which } and the line carries ${ numbers.length }` };

        return { value: Number( numbers[ which - 1 ].literal.replace( /,/g, '' ) ), error: null };

    }

    return { value: Number( tag.tolerance ), error: null };

}

// ------------------------------------------------------------------------------------------------
// Coverage — the half of this gate that is about its own reach
// ------------------------------------------------------------------------------------------------

/** Every file this gate looks at, repo-relative, sorted. */
export function scannedFiles( root = REPO_ROOT ) {

    const found = [];

    const walk = ( directory ) => {

        for ( const entry of fs.readdirSync( directory, { withFileTypes: true } ) ) {

            if ( entry.isDirectory() ) {

                if ( ! SKIP_DIRECTORIES.has( entry.name ) ) walk( path.join( directory, entry.name ) );
                continue;

            }

            if ( SCAN_EXTENSIONS.includes( path.extname( entry.name ) ) ) found.push( path.join( directory, entry.name ) );

        }

    };

    for ( const directory of SCAN_DIRECTORIES ) {

        const full = path.join( root, directory );
        if ( fs.existsSync( full ) ) walk( full );

    }

    return found.map( ( file ) => path.relative( root, file ) ).sort();

}

/**
 * Count what is checked against what could be, over one file.
 *
 * `commentNumerals` counts every numeral in comment text EXCEPT the ones on tag lines themselves —
 * a tag's own machinery is not prose. `tagged` is one per bound tag: the occurrence in the prose
 * that the tag names. Everything else is `untagged`, and blind spot 2 says why that is a ceiling.
 *
 * `disagreement` is this scanner's own honesty check: how far its idea of "a line that is a
 * comment" differs from a dumb "starts with two slashes" count. It is reported, never asserted on
 * files this gate does not own.
 */
export function countFile( source ) {

    const { blocks, stringNumerals } = scanSource( source );

    let commentNumerals = 0;
    let tagLines = 0;

    for ( const block of blocks ) {

        for ( const entry of block.lines ) {

            if ( isTagLine( entry.text ) ) { tagLines += 1; continue; }

            commentNumerals += extractNumbers( entry.text ).length;

        }

    }

    const disagreement = scannerDisagreement( source, blocks );
    const scannedCommentLines = blocks.reduce( ( total, block ) => total + block.lines.length, 0 );

    return {
        commentNumerals,
        stringNumerals,
        tagLines,
        disagreement,
        scannedCommentLines
    };

}

/**
 * The numerals this gate does NOT scan, so the reach statement is complete rather than flattering.
 * Whole-file counts, code included — these are files the gate has no scanner for at all.
 */
export function countUnscanned( root = REPO_ROOT ) {

    const totals = { markdown: 0, python: 0, shell: 0, files: 0 };

    const walk = ( directory ) => {

        for ( const entry of fs.readdirSync( directory, { withFileTypes: true } ) ) {

            const full = path.join( directory, entry.name );

            if ( entry.isDirectory() ) {

                if ( ! SKIP_DIRECTORIES.has( entry.name ) ) walk( full );
                continue;

            }

            const extension = path.extname( entry.name );
            const bucket = extension === '.md' ? 'markdown' : extension === '.py' ? 'python' : extension === '.sh' ? 'shell' : null;

            if ( bucket === null ) continue;

            totals[ bucket ] += extractNumbers( fs.readFileSync( full, 'utf8' ) ).length;
            totals.files += 1;

        }

    };

    for ( const directory of [ 'docs', 'tools', 'packages' ] ) {

        const full = path.join( root, directory );
        if ( fs.existsSync( full ) ) walk( full );

    }

    return totals;

}

// ------------------------------------------------------------------------------------------------
// The gate
// ------------------------------------------------------------------------------------------------

/**
 * Read the tree, verify every tagged claim, and measure this gate's own reach.
 *
 * @param {{ root?: string, run?: boolean, only?: string }} options
 */
export async function checkTree( options = {} ) {

    const root = options.root === undefined ? REPO_ROOT : options.root;
    const run = options.run !== false;
    const files = scannedFiles( root ).filter( ( file ) => options.only === undefined || file === options.only );

    const tags = [];
    const coverage = { files: files.length, commentNumerals: 0, stringNumerals: 0, tagged: 0, perFile: {}, missed: 0, invented: 0 };

    for ( const file of files ) {

        const source = fs.readFileSync( path.join( root, file ), 'utf8' );
        const counts = countFile( source );
        const fileTags = parseTags( source, file );

        coverage.commentNumerals += counts.commentNumerals;
        coverage.stringNumerals += counts.stringNumerals;
        coverage.missed += counts.disagreement.missed;
        coverage.invented += counts.disagreement.invented;

        if ( fileTags.length > 0 ) {

            coverage.perFile[ file ] = { tags: fileTags.length, commentNumerals: counts.commentNumerals };
            coverage.tagged += fileTags.length;

        }

        tags.push( ...fileTags );

    }

    // The tagged occurrences are not untagged prose, so they come out of the denominator's other half.
    coverage.untagged = coverage.commentNumerals - coverage.tagged;

    const outputs = {};

    if ( run ) {

        const commands = [ ...new Set( tags.filter( ( tag ) => tag.command !== undefined ).map( ( tag ) => tag.command.join( ' ' ) ) ) ];
        const results = await Promise.all( commands.map( ( command ) => runProducer( command.split( ' ' ) ) ) );

        commands.forEach( ( command, index ) => { outputs[ command ] = results[ index ]; } );

    }

    return { tags, results: run ? adjudicate( tags, outputs ) : [], coverage, ran: run };

}

async function main() {

    const argv = process.argv.slice( 2 );
    const run = ! argv.includes( '--no-run' );
    const onlyIndex = argv.indexOf( '--file' );
    const only = onlyIndex === -1 ? undefined : argv[ onlyIndex + 1 ];

    const started = Date.now();
    const { tags, results, coverage, ran } = await checkTree( { run, only } );

    console.log( 'quoted-numbers.mjs — every number that names the command which produces it' );
    console.log();

    let failures = 0;

    for ( const result of ran ? results : tags.map( ( tag ) => ( { tag, ok: tag.error === null, note: tag.error === null ? 'parsed, producer not run' : tag.error } ) ) ) {

        const tag = result.tag;
        const where = `${ tag.file }:${ tag.line }`;

        if ( ! result.ok ) failures += 1;

        const mark = result.ok ? 'ok  ' : 'FAIL';
        const claim = tag.claim === undefined ? tag.raw : tag.claim;
        const produced = result.produced === undefined ? '' : ` == ${ result.produced }`;

        console.log( `  ${ mark }  ${ where }  ${ claim }${ produced }${ result.ok ? '' : `\n        ${ result.note }` }` );

        if ( result.ok && result.rule !== undefined ) console.log( `        ${ result.rule }, |Δ| ${ result.delta.toPrecision( 3 ) } <= ${ Number( result.allowed ).toPrecision( 3 ) }   ← "${ tag.selector }" #${ tag.which }` );
        if ( result.producerCode !== undefined && result.producerCode !== 0 ) console.log( `        ⚠️ the producer exited ${ result.producerCode } — its own gate owns that red, this one still read its numbers` );

    }

    const unscanned = countUnscanned();
    const share = coverage.commentNumerals === 0 ? 0 : 100 * coverage.tagged / coverage.commentNumerals;

    console.log();
    console.log( '  COVERAGE — what this gate can see, and what it cannot' );
    console.log( `    tagged claims                 ${ coverage.tagged }  in ${ Object.keys( coverage.perFile ).length } files` );
    console.log( `    numerals in comment prose     ${ coverage.commentNumerals }  across ${ coverage.files } scanned .mjs/.js files under ${ SCAN_DIRECTORIES.join( ', ' ) }` );
    console.log( `    → tagged share                ${ share.toFixed( 3 ) }%   ⚠️ the denominator is an OVER-count (§7 refs, dates, widths), so this is a FLOOR` );
    console.log( `    numerals in string literals   ${ coverage.stringNumerals }  ← OUT OF REACH: this gate reads comments, not strings` );
    console.log( `    numerals in unscanned files   ${ unscanned.markdown } markdown, ${ unscanned.python } python, ${ unscanned.shell } shell  (whole-file counts, no scanner)` );
    console.log( `    scanner disagreement          ${ coverage.missed } missed + ${ coverage.invented } invented comment lines against a dumb ^\\s*// count` );

    for ( const [ file, counts ] of Object.entries( coverage.perFile ) ) {

        console.log( `    ${ file }: ${ counts.tags } tagged of ${ counts.commentNumerals } numerals in its comments` );

    }

    console.log();
    console.log( `${ tags.length - failures } verified, ${ failures } failed   (${ ( ( Date.now() - started ) / 1000 ).toFixed( 1 ) }s${ ran ? '' : ', producers not run' })` );

    process.exit( failures === 0 ? 0 : 1 );

}

if ( process.argv[ 1 ] !== undefined && path.resolve( process.argv[ 1 ] ) === path.resolve( fileURLToPath( import.meta.url ) ) ) {

    await main();

}
