/**
 * request-ledger.selftest.mjs — the gate on `docs/OPEN-REQUESTS.md`.
 *
 * ## Why this file exists
 *
 * A fan-out agent measures the right number, correctly declines to edit a file it does not own,
 * and files a diff request. The round ends. The request evaporates. That has produced two of the
 * last three engineering blockers in this project, and one of them —  the postural manifest in
 * `tools/critic/capture.mjs` — left the repo **failing its own gate suite at HEAD for a full
 * round**, which is the worst state a tree can be left in: an integrator sees red with no
 * uncommitted change to blame. `af0e68d`'s commit message says so in its first paragraph and
 * names the structural fix: *make the integrator's diff-request pass a GATED step that fails
 * integration when a request is dropped, rather than item six on a list of seven.*
 *
 * This is that gate. `docs/OPEN-REQUESTS.md` is the ledger; this file is the thing that stops the
 * ledger from being a wish list.
 *
 * ## 🚩 The design problem, which is that a ledger is trivially rubber-stampable
 *
 * A status field is prose. `status: APPLIED` typed by the agent who wanted it to be applied is
 * exactly the artefact that failed us — it is the same disease as a hand-typed check count
 * (LEARNINGS §1.25e) and the same disease as a gate that documents its assumption in a comment
 * instead of testing it (§1.25l). So **no status here is believed**. Every one is adjudicated
 * against the real file, and the adjudication runs in BOTH directions:
 *
 *   APPLIED   `verify` must MATCH at HEAD  ...and must NOT match at the entry's `filed-at` commit.
 *             The second clause is the anti-rubber-stamp clause and it is the reason `filed-at`
 *             is mandatory. It proves the pattern DISCRIMINATES the change rather than matching
 *             something that was always there. A vacuous `verify` — `/./`, the file's own header,
 *             a word from an unrelated line — matches both versions and is REFUSED, even though
 *             the change really did land. Green here means "this regex can tell the two trees
 *             apart", which is the only reading of "APPLIED" worth having.
 *
 *   OPEN      `verify` must NOT match at HEAD — an entry that was fixed incidentally by someone
 *             else is a STALE ENTRY, and a ledger of stale entries is worse than no ledger.
 *             `anchor` must MATCH at HEAD, so the request still points at code that exists.
 *             And `filed-round` must be the CURRENT round: an OPEN entry does not survive a
 *             round boundary. That is the whole mechanism. Everything else here is plumbing.
 *
 *   REJECTED  `verify` must NOT match at HEAD (a rejected change that is present is a
 *             contradiction), `anchor` must match, and `reason` must be a written sentence
 *             rather than a word — REJECTION_REASON_FLOOR characters, sized in the constant.
 *
 * ## Rounds, and why they are pinned to commits
 *
 * "OPEN past its round" needs a definition of round that an agent in a hurry cannot soften. A
 * self-declared integer alone can be left un-incremented forever, which turns the expiry clause
 * off silently — the exact failure mode this whole file is about. So the ledger declares a
 * ```rounds fence mapping each round to the commit it opened at, and this gate holds it to git:
 *
 *   - every declared sha must resolve to a real commit and be an ancestor-or-self of HEAD;
 *   - round numbers strictly increase, and so do their commits' positions in history;
 *   - HEAD may not be more than ROUND_COMMIT_CEILING commits past the newest declared round.
 *
 * The last clause is what closes the loophole. Measured from this repo's own history, the last
 * three rounds landed 8, 8 and 8 commits (`30f2170..af0e68d`, `d9fc9e0..30f2170^`,
 * `2ec7db9..d9fc9e0^`), so the ceiling is 14 — roughly 75% of headroom over the observed size.
 * You cannot keep committing without declaring a new round, and declaring a new round is what
 * turns every carried-over OPEN entry red.
 *
 * ## Proved red, six ways, and printed on every run
 *
 * Rule 4 of this project's standing constraints: a gate that only catches its own known-bad is
 * decorative. Two of the six below are the two failures the brief names; the other four are
 * different mutations in the same class, and — this is the part that matters — they are caught by
 * DIFFERENT clauses, not by the same clause with a different input. The table prints which clause
 * caught which, so a successor who weakens one can see the coverage collapse.
 *
 *   run: node tools/request-ledger.selftest.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const LEDGER_PATH = 'docs/OPEN-REQUESTS.md';

/**
 * A rejection has to survive a reader who was not in the room. Forty characters is about one
 * clause of English — enough to name the measurement or the tradeoff, too short to be "no" or
 * "superseded". It is a floor on effort, not a claim that forty is the right length.
 */
const REJECTION_REASON_FLOOR = 40;

/**
 * The ledger must not be able to go quiet. If a rewrite hides entries from the parser the count
 * collapses, and a collapsed count is indistinguishable from a clean desk — so the count itself
 * is gated, at the number of entries this file shipped with. Same shape as
 * `docs/measured-claims.selftest.mjs`'s live-claim coverage floor, for the same reason.
 *
 * ⚠️ RAISE IT WHEN A ROUND ADDS ENTRIES, or the floor stops being a floor: entries are never
 * deleted, so a ledger that has grown to 34 and is still gated at 30 tolerates four disappearing.
 * 30 at R7, 34 at R8.
 */
const MIN_ENTRIES = 34;

/** See the header: 8, 8 and 8 commits in the last three rounds. */
const ROUND_COMMIT_CEILING = 14;

const STATUSES = [ 'OPEN', 'APPLIED', 'REJECTED' ];

let checks = 0;
let failures = 0;

function check( label, passed, detail = '' ) {

    checks += 1;
    if ( passed !== true ) failures += 1;

    const mark = passed === true ? 'ok  ' : 'FAIL';
    console.log( `${ mark }  ${ label }${ detail === '' ? '' : `   ${ detail }` }` );

}

function section( title ) {

    console.log( `\n--- ${ title } ${ '-'.repeat( Math.max( 0, 92 - title.length ) ) }\n` );

}

// ================================================================================================
// git, and the file-at-a-commit reader every clause is built on
// ================================================================================================

function git( ...args ) {

    return execFileSync( 'git', args,
        { cwd: REPO, encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'ignore' ] } ).trim();

}

/**
 * The contents of `path` at `commit`, or `null` when the file did not exist there.
 *
 * `null` is a real answer and not an error: a request filed against a file that did not yet exist
 * — `tools/run-selftests.sh` is exactly that case — has a pre-image with no match in it, which is
 * precisely what the discrimination clause wants to see.
 */
function fileAtCommit( commit, path ) {

    try {

        // stderr is discarded on purpose: "exists on disk, but not in <sha>" is the ANSWER to this
        // question for a file the request predates, not a problem worth printing 30 times.
        return execFileSync( 'git', [ 'show', `${ commit }:${ path }` ],
            { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
                stdio: [ 'ignore', 'pipe', 'ignore' ] } );

    } catch {

        return null;

    }

}

function fileAtHead( path ) {

    try {

        return readFileSync( resolve( REPO, path ), 'utf8' );

    } catch {

        return null;

    }

}

// ================================================================================================
// the parser
// ================================================================================================

/**
 * Entries are ```request fences of `key: value` lines. A fence rather than a table because a
 * `change:` line contains commas, pipes and backticks, and because a fence is the one markdown
 * construct that survives being reflowed by a well-meaning editor.
 */
function parseEntries( text ) {

    const entries = [];
    const fence = /```request\n([\s\S]*?)```/g;

    for ( const match of text.matchAll( fence ) ) {

        const fields = {};
        let lastKey = null;

        for ( const line of match[ 1 ].split( '\n' ) ) {

            if ( line.trim() === '' ) continue;

            const keyed = line.match( /^([a-z-]+):\s*(.*)$/ );

            if ( keyed !== null ) {

                lastKey = keyed[ 1 ];
                fields[ lastKey ] = keyed[ 2 ].trim();

            } else if ( lastKey !== null ) {

                // A continuation line, so a `change:` can be a paragraph.
                fields[ lastKey ] = `${ fields[ lastKey ] } ${ line.trim() }`.trim();

            }

        }

        entries.push( fields );

    }

    return entries;

}

function parseRounds( text ) {

    const fence = text.match( /```rounds\n([\s\S]*?)```/ );
    if ( fence === null ) return [];

    const rounds = [];

    for ( const line of fence[ 1 ].split( '\n' ) ) {

        const row = line.trim().match( /^R(\d+)\s+([0-9a-f]{7,40})\s+(\S+)\s+(.*)$/ );
        if ( row === null ) continue;

        rounds.push( { number: Number( row[ 1 ] ), sha: row[ 2 ], date: row[ 3 ], label: row[ 4 ] } );

    }

    return rounds;

}

/**
 * A `verify:` or `anchor:` line is `<path> /<pattern>/<flags>`. The path is carried on the line
 * rather than taken from `target:` so that a request may be adjudicated against a DIFFERENT file
 * from the one it edits — the wardrobe body merge is verified against the asset it would delete,
 * not against the page that mentions it.
 */
function parsePredicate( line ) {

    if ( line === undefined ) return null;

    const parsed = line.match( /^(\S+)\s+\/([\s\S]*)\/([a-z]*)$/ );
    if ( parsed === null ) return null;

    let pattern;

    try {

        pattern = new RegExp( parsed[ 2 ], parsed[ 3 ] );

    } catch {

        return null;

    }

    return { path: parsed[ 1 ], pattern };

}

function matches( predicate, content ) {

    if ( content === null ) return false;

    // A global regex carries lastIndex between calls, and these are re-run against several trees.
    predicate.pattern.lastIndex = 0;

    return predicate.pattern.test( content );

}

// ================================================================================================
// the adjudicator — one pure function, so the red proofs can run it over mutated ledgers
// ================================================================================================

/**
 * Adjudicate a ledger and return a list of violations, each `{ id, clause, detail }`.
 *
 * Pure with respect to the ledger TEXT and impure only through git and the working tree, which is
 * the point: the red proofs below hand it a mutated ledger and a substituted tree reader, and get
 * back the same adjudication the real run performs.
 */
function adjudicate( text, { readHead = fileAtHead, readAt = fileAtCommit } = {} ) {

    const violations = [];
    const fail = ( id, clause, detail ) => violations.push( { id, clause, detail } );

    const rounds = parseRounds( text );
    const entries = parseEntries( text );

    // --- the rounds fence ---------------------------------------------------------------------

    if ( rounds.length === 0 ) fail( '-', 'ROUNDS', 'no ```rounds fence, so CURRENT is undefined' );

    let previousPosition = Infinity;

    for ( const round of rounds ) {

        let position = null;

        try {

            git( 'merge-base', '--is-ancestor', round.sha, 'HEAD' );
            position = Number( git( 'rev-list', '--count', `${ round.sha }..HEAD` ) );

        } catch {

            fail( `R${ round.number }`, 'ROUNDS',
                `${ round.sha } is not a commit reachable from HEAD` );
            continue;

        }

        if ( position >= previousPosition ) {

            fail( `R${ round.number }`, 'ROUNDS',
                `R${ round.number } opens at ${ round.sha }, which is not later in history than ` +
                'the round declared above it' );

        }

        previousPosition = position;

    }

    const numbers = rounds.map( ( round ) => round.number );

    for ( let index = 1; index < numbers.length; index += 1 ) {

        if ( numbers[ index ] <= numbers[ index - 1 ] ) {

            fail( `R${ numbers[ index ] }`, 'ROUNDS', 'round numbers must strictly increase' );

        }

    }

    const current = rounds.length === 0 ? null : rounds[ rounds.length - 1 ];

    if ( current !== null ) {

        let ahead = null;

        try {

            ahead = Number( git( 'rev-list', '--count', `${ current.sha }..HEAD` ) );

        } catch { /* already reported above */ }

        if ( ahead !== null && ahead > ROUND_COMMIT_CEILING ) {

            fail( `R${ current.number }`, 'ROUNDS',
                `HEAD is ${ ahead } commits past the newest declared round, ceiling is ` +
                `${ ROUND_COMMIT_CEILING }. Declare the new round — which is what expires the ` +
                'OPEN entries below' );

        }

    }

    // --- coverage -----------------------------------------------------------------------------

    if ( entries.length < MIN_ENTRIES ) {

        fail( '-', 'COVERAGE',
            `${ entries.length } entries parsed, floor is ${ MIN_ENTRIES }. Either the ledger ` +
            'shrank without entries being resolved, or a rewrite hid them from the parser' );

    }

    const seen = new Set();

    // --- the entries --------------------------------------------------------------------------

    for ( const entry of entries ) {

        const id = entry.id ?? '(no id)';

        if ( entry.id === undefined ) fail( id, 'SCHEMA', 'entry has no id' );
        if ( seen.has( id ) ) fail( id, 'SCHEMA', 'duplicate id' );
        seen.add( id );

        // `filed-round` is required only of OPEN entries, below. A resolved entry is pinned by its
        // `filed-at` COMMIT, which is exact; round numbers before the ```rounds fence begins are
        // not reconstructed and inventing them here would be the kind of tidy fiction §1.25e is
        // about.
        for ( const field of [ 'status', 'target', 'filed-by', 'filed-at',
            'change', 'evidence', 'verify' ] ) {

            if ( entry[ field ] === undefined || entry[ field ] === '' ) {

                fail( id, 'SCHEMA', `missing ${ field }` );

            }

        }

        const status = entry.status;

        if ( STATUSES.includes( status ) === false ) {

            fail( id, 'SCHEMA', `status ${ status } is not one of ${ STATUSES.join( ' / ' ) }` );
            continue;

        }

        const verify = parsePredicate( entry.verify );

        if ( verify === null ) {

            fail( id, 'SCHEMA', 'verify is not `<path> /<pattern>/<flags>`' );
            continue;

        }

        const roundOf = Number( ( entry[ 'filed-round' ] ?? '' ).replace( /^R/, '' ) );

        if ( status === 'OPEN' && Number.isFinite( roundOf ) === false ) {

            fail( id, 'SCHEMA',
                `OPEN entries need filed-round: R<n>; got ${ entry[ 'filed-round' ] }` );

        }

        const head = readHead( verify.path );
        const presentAtHead = matches( verify, head );

        if ( head === null ) {

            fail( id, 'TARGET', `${ verify.path } does not exist at HEAD` );
            continue;

        }

        if ( status === 'APPLIED' ) {

            // Clause 1: it is actually there.
            if ( presentAtHead === false ) {

                fail( id, 'APPLIED-ABSENT',
                    `claims APPLIED, but verify does not match ${ verify.path } at HEAD` );

            }

            // Clause 2: the pattern can tell the two trees apart. This is the anti-rubber-stamp
            // clause — see the header. It runs even when clause 1 already failed, because the two
            // answer different questions and a reader deserves both.
            const before = readAt( entry[ 'filed-at' ], verify.path );

            if ( matches( verify, before ) === true ) {

                fail( id, 'APPLIED-VACUOUS',
                    `verify already matched ${ verify.path } at filed-at ` +
                    `${ entry[ 'filed-at' ] }, so it does not discriminate the change` );

            }

        } else {

            // OPEN and REJECTED both assert the change is NOT in the file.
            if ( presentAtHead === true ) {

                fail( id, `${ status }-STALE`,
                    `status is ${ status }, but verify MATCHES ${ verify.path } at HEAD — the ` +
                    'change is present and the ledger is lying about it' );

            }

            const anchor = parsePredicate( entry.anchor );

            if ( anchor === null ) {

                fail( id, 'SCHEMA', `${ status } entries need an anchor: <path> /<pattern>/` );

            } else if ( matches( anchor, readHead( anchor.path ) ) === false ) {

                fail( id, 'ANCHOR',
                    `anchor does not match ${ anchor.path } at HEAD — the request points at ` +
                    'code that has moved or gone' );

            }

        }

        if ( status === 'OPEN' && current !== null && roundOf !== current.number ) {

            fail( id, 'EXPIRED',
                `filed in R${ roundOf } and still OPEN in R${ current.number }. Apply it or ` +
                'reject it with a written reason — a request does not survive a round boundary' );

        }

        if ( status === 'REJECTED' ) {

            const reason = entry.reason ?? '';

            if ( reason.length < REJECTION_REASON_FLOOR ) {

                fail( id, 'REASON',
                    `rejection reason is ${ reason.length } characters, floor is ` +
                    `${ REJECTION_REASON_FLOOR }` );

            }

        }

    }

    return { violations, entries, rounds, current };

}

// ================================================================================================
// 1. THE LIVE ADJUDICATION
// ================================================================================================

const ledgerText = readFileSync( resolve( REPO, LEDGER_PATH ), 'utf8' );

section( `1. ${ LEDGER_PATH }, adjudicated against the tree at HEAD ${ git( 'rev-parse', '--short', 'HEAD' ) }` );

const live = adjudicate( ledgerText );

{
    const byStatus = {};
    for ( const entry of live.entries ) byStatus[ entry.status ] = ( byStatus[ entry.status ] ?? 0 ) + 1;

    console.log( `    ${ live.entries.length } entries — ` +
        STATUSES.map( ( status ) => `${ byStatus[ status ] ?? 0 } ${ status }` ).join( ', ' ) );
    console.log( `    current round R${ live.current?.number } opened at ${ live.current?.sha }, ` +
        `HEAD is ${ git( 'rev-list', '--count', `${ live.current?.sha }..HEAD` ) } commits past it\n` );

    for ( const violation of live.violations ) {

        console.log( `    ${ violation.clause.padEnd( 16 ) } ${ violation.id }  ${ violation.detail }` );

    }
}

check( 'every ledger entry adjudicates against the real file it names',
    live.violations.length === 0,
    live.violations.length === 0 ? 'no violations'
        : `${ live.violations.length } violations, listed above` );

check( 'the ledger declares a current round pinned to a real commit',
    live.current !== undefined && live.current !== null,
    live.current === null ? 'no rounds fence' : `R${ live.current.number } @ ${ live.current.sha }` );

check( 'entry count is at or above the coverage floor',
    live.entries.length >= MIN_ENTRIES, `${ live.entries.length } >= ${ MIN_ENTRIES }` );

// ================================================================================================
// 2. THE RED PROOFS — six mutations, and the clause each one has to reach
// ================================================================================================
//
// 🚩 Every proof mutates the REAL ledger text and runs the REAL adjudicator over the REAL tree.
// A fixture ledger would be shaped to the parser that reads it; the whole lesson of
// `docs/measured-claims.selftest.mjs` §"a fixture can be shaped to the parser" is that the only
// convincing proof splices the mutation into the live document.
//
// The `clause` column is asserted, not printed for interest. A mutation that turns the gate red
// through the WRONG clause is a coincidence, not coverage — §1.25n is the round a rejection proof
// went vacuous while still exiting 1.

section( '2. the red proofs — mutate the live ledger, and name the clause that must catch it' );

/** Swap one field of one entry, in the raw text, leaving every other byte alone. */
function mutateField( text, id, field, value ) {

    const fences = [ ...text.matchAll( /```request\n([\s\S]*?)```/g ) ];
    const target = fences.find( ( fence ) => fence[ 1 ].includes( `id:          ${ id }` )
        || new RegExp( `^id:\\s+${ id }\\s*$`, 'm' ).test( fence[ 1 ] ) );

    if ( target === undefined ) throw new Error( `red proof cannot find entry ${ id }` );

    const body = target[ 1 ];

    // The field AND its continuation lines — a `reason:` or a `change:` is a paragraph, and
    // replacing only its first line would leave the rest of the paragraph attached to the new
    // value. RED 5 depends on this: a one-word reason with four continuation lines still hanging
    // off it is not a one-word reason.
    const line = new RegExp( `^${ field }:.*(?:\\n(?![a-z-]+:).*)*$`, 'm' );
    const replaced = line.test( body )
        ? body.replace( line, `${ field }: ${ value }` )
        : `${ body }${ field }: ${ value }\n`;

    return text.slice( 0, target.index ) + '```request\n' + replaced + '```'
        + text.slice( target.index + target[ 0 ].length );

}

const anApplied = live.entries.find( ( entry ) => entry.status === 'APPLIED' );
const anOpen = live.entries.find( ( entry ) => entry.status === 'OPEN' );
const aRejected = live.entries.find( ( entry ) => entry.status === 'REJECTED' );

const proofs = [];

function redProof( label, clause, mutate, options ) {

    let result;

    try {

        result = adjudicate( mutate( ledgerText ), options );

    } catch ( error ) {

        proofs.push( { label, clause, caught: false, detail: `threw: ${ error.message }` } );
        return;

    }

    const hits = result.violations.filter( ( violation ) => violation.clause === clause );
    const others = result.violations.filter( ( violation ) => violation.clause !== clause );

    proofs.push( {
        label, clause,
        caught: hits.length > 0,
        detail: hits.length > 0
            ? `${ hits[ 0 ].id }: ${ hits[ 0 ].detail.slice( 0, 96 ) }`
            : `NOT CAUGHT — ${ others.length } other violations` } );

}

// RED 1 — the defect the brief names first: an entry claims APPLIED and the change is not in the
// file. Reproduced faithfully by reading the target at the commit the request was FILED at, which
// is a tree where the change genuinely is absent. No hand-written fixture is involved.
redProof( 'APPLIED, but the change is not in the file', 'APPLIED-ABSENT',
    ( text ) => text,
    { readHead: ( path ) => fileAtCommit( anApplied[ 'filed-at' ], path ) } );

// RED 2 — a DIFFERENT defect in the same class: the entry is honest and the change really landed,
// but the `verify` is a rubber stamp. `/./` matches every non-empty file, so clause 1 goes green
// on a check that proves nothing. Only the discrimination clause can see this, and it is the
// reason `filed-at` is a required field.
redProof( 'APPLIED with a verify that matches anything', 'APPLIED-VACUOUS',
    ( text ) => mutateField( text, anApplied.id, 'verify', `${ anApplied.target } /./` ) );

// RED 3 — the inverse staleness: something was fixed incidentally and the entry still says OPEN.
// Built by relabelling a genuinely-applied entry, so the tree is untouched and the only lie is
// the status field.
redProof( 'OPEN, but the change is already in the file', 'OPEN-STALE',
    ( text ) => mutateField( text, anApplied.id, 'status', 'OPEN' ) );

// RED 4 — the failure this whole file exists to stop: a request that outlives its round.
redProof( 'OPEN and carried past its round', 'EXPIRED',
    ( text ) => mutateField( text, anOpen.id, 'filed-round',
        `R${ live.current.number - 1 }` ) );

// RED 5 — a rejection with no argument in it. "no" is not a reason a successor can re-open.
redProof( 'REJECTED with a one-word reason', 'REASON',
    ( text ) => mutateField( text, aRejected.id, 'reason', 'superseded' ) );

// RED 6 — the parser-blindness floor. A rewrite that hides entries from the fence reader looks
// exactly like a cleared backlog, so the count is gated. This is the mutation that a future agent
// tidying the document would perform by accident.
redProof( 'the entries are reformatted out of the parser\'s reach', 'COVERAGE',
    ( text ) => text.replaceAll( '```request', '```yaml' ) );

// RED 7 — the round fence itself is the load-bearing part of EXPIRED, so it gets its own proof:
// declare a round at a commit that is not in this history and the expiry clock is unpinned.
redProof( 'a round declared at a commit that is not in this history', 'ROUNDS',
    ( text ) => text.replace( /```rounds\n/, '```rounds\nR99 0000000  2026-01-01  fictional\n' ) );

console.log( '    mutation                                                  clause            caught' );
console.log( `    ${ '-'.repeat( 100 ) }` );

for ( const proof of proofs ) {

    console.log( `    ${ proof.label.padEnd( 56 ) }  ${ proof.clause.padEnd( 16 ) }  ` +
        `${ proof.caught ? 'yes' : 'NO ' }   ${ proof.detail }` );

}

console.log();

for ( const proof of proofs ) {

    check( `RED: "${ proof.label }" is caught by ${ proof.clause }`, proof.caught, proof.detail );

}

// A coverage statement about the proofs themselves: seven mutations, seven distinct clauses. If a
// successor collapses two clauses into one, this goes red and says why.
{
    const distinct = new Set( proofs.map( ( proof ) => proof.clause ) );

    check( 'each red proof is caught by a DIFFERENT clause, so the coverage is not one check ' +
        'answering seven questions',
    distinct.size === proofs.length, `${ distinct.size } clauses for ${ proofs.length } proofs` );
}

// ================================================================================================
// 3. THE ONE THING A STATUS FIELD CAN STILL HIDE, stated rather than wished away
// ================================================================================================
//
// This gate proves that a `verify` pattern discriminates the commit the request was filed at from
// HEAD. It does NOT prove the pattern is the RIGHT pattern for the change described in prose — an
// entry could apply a cosmetic edit that its regex happens to catch and call the request done.
// That is the same honest limit `docs/measured-claims.selftest.mjs` states about itself: it cannot
// re-render, so a number inside its band and simply wrong is invisible to it.
//
// The mitigation is that `evidence:` must carry a MEASUREMENT and the integrator reads it. That is
// a human clause and it is written down as one, because a gate that claimed to cover it would be
// the third instance of the defect in §1.25l.

section( '3. summary' );

console.log( `${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
