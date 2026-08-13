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
 *   FILED-AT  ...and `filed-at` must be a REAL COMMIT THIS HISTORY DESCENDS FROM, for every
 *             status. See the next section: without this, the clause above is optional.
 *
 *   PRE-IMAGE ...and when the target file is not IN that commit, the clause above passed for
 *             free and the entry must say so with `pre-image: absent — <why>`. Same defect as
 *             FILED-AT one level down: there the pre-image COMMIT was unreadable, here the
 *             commit reads perfectly and the FILE is not in it. Both end at `before === null`,
 *             which is the green side of the discrimination clause. The case is legitimate and
 *             common — three entries here fulfilled their request BY creating the file, and a
 *             fourth was applied to a file that had not been committed yet — so it is
 *             declared rather than refused, and the declaration is itself adjudicated: claiming
 *             absence over a file that was right there fails the same clause.
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
 * ## 🚩 The hole in the paragraph above, found by a verifier in R9 — an ERROR READ AS DATA
 *
 * Everything the APPLIED clause claims rests on `before`, the pre-image read out of `filed-at`.
 * `fileAtCommit()` answered "that commit does not resolve" with the same `null` it uses for "the
 * file did not exist at that commit". The first is an ERROR; the second is an ANSWER; they shared
 * a return value. And `matches( verify, null )` is `false` — which is the PASSING side of the
 * discrimination clause. So an unresolvable `filed-at` did not weaken the anti-rubber-stamp
 * clause, it switched it OFF, and it switched it off in the green direction.
 *
 * Measured, on the real ledger, before the fix below: `REQ-013` with `filed-at: deadbee` and
 * `verify: packages/testbed/src/alive.js /const /` — a pattern hitting **195 lines at HEAD and
 * 144 at `2ec7db9`**, so discriminating nothing whatsoever — ran `PASS: 11/11 checks green`,
 * `exit 0`. A fully rubber-stamped entry, which is the one thing this file exists to refuse.
 *
 * Nothing anywhere validated `filed-at`. The ```rounds fence has always been held to git, and
 * that clause is thorough — but it validates ROUND shas, and only round shas. The standard was
 * simply never applied to the field the discrimination clause actually reads.
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
 * ## Proved red on every run, and the invariant is COVERAGE rather than a count
 *
 * Rule 4 of this project's standing constraints: a gate that only catches its own known-bad is
 * decorative. Every mutation below is spliced into the REAL ledger and run through the REAL
 * adjudicator against the REAL tree, and each one declares the clause that must catch it.
 *
 * ⚠️ THE HEADER USED TO SAY "six ways" WHILE SEVEN PROOFS RAN, for two rounds — a hand-typed count
 * in the file whose entire subject is hand-typed claims. So the number is not asserted here any
 * more; the run prints it, and what the run ASSERTS is that every clause the adjudicator can emit
 * has a proof standing behind it. That clause vocabulary is read out of this file's own source
 * rather than listed by hand, which is how the four clauses that had no proof at all — SCHEMA,
 * TARGET, ANCHOR and REJECTED-STALE — were found.
 *
 * And the old "each proof is caught by a DIFFERENT clause" assertion is gone, because it was the
 * right instinct with the wrong invariant: it would have FORBIDDEN the FILED-AT fix. Rule 4 asks
 * for a clause to be broken more than one way, which necessarily puts two proofs on one clause.
 * FILED-AT accordingly carries four, failing for four different reasons.
 *
 * ## Ablation, because "the proofs pass" is not the same claim as "the code is load-bearing"
 *
 * Every piece of the FILED-AT fix was removed in turn and the suite re-run. Measured, at the
 * commit this landed on — and TWO of the six rows changed the code that shipped:
 *
 *   remove the clause entirely  16/23  exit 1   all four mechanisms go NOT CAUGHT
 *   remove the hex-shape test   20/23  exit 1   ...but only AFTER RED 15 existed; before it, 22/22
 *                                               GREEN. The test was decorative and ablation is the
 *                                               only thing that said so.
 *   remove rev-parse ^{commit}  22/23  exit 1   ...and only the DIAGNOSIS check goes red. The
 *                                               ancestry call errors on a bad sha too, so
 *                                               detection never needed this half; what needed it
 *                                               was not calling `deadbee` "a commit".
 *   remove --is-ancestor        20/23  exit 1   RED 10 goes NOT CAUGHT
 *   remove the VACUOUS guard    18/23  exit 1   the three APPLIED mechanisms throw instead of
 *                                               failing — which is how the crash-instead-of-report
 *                                               bug in `redProof`'s catch branch was found
 *   remove fileAtCommit's throw 23/23  exit 0   ⚠️ BY DESIGN, and stated rather than hidden: the
 *                                               adjudicator validates before it reads, so nothing
 *                                               here reaches that throw. It guards the NEXT caller
 *                                               and it has no proof. It is the one line in this
 *                                               fix that is a seatbelt rather than a gate.
 *
 * And the same three rows for PRE-IMAGE, measured the round it landed, against 26/26 green:
 *
 *   remove the undeclared half  24/26  exit 1   RED 16 goes NOT CAUGHT, and so does the check that
 *                                               the two mechanisms are told apart
 *   remove the declared half    24/26  exit 1   RED 17 goes NOT CAUGHT, symmetrically
 *   believe the declaration     24/26  exit 1   `declaredAbsent = true` — 50 LIVE violations, so
 *                                               this half is not merely proved, it is holding the
 *                                               real ledger up: 50 of the 54 APPLIED entries have
 *                                               a pre-image and would be excused from the clause
 *                                               that reads it
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
 * 30 at R7, 34 at R8, 59 at R10 — the jump is the round that discovered the Fix phase runs after
 * integration, so five agents' 43 requests had no integrator to file them with. 68 at the R15
 * ledger pass, which added no entries and found the floor nine behind the count: the instruction
 * above had not been followed for two rounds, and nine entries could have gone missing in silence.
 */
const MIN_ENTRIES = 68;

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
 * Is `sha` usable as a PRE-IMAGE — a real commit this history descends from? Returns `null` when
 * it is, and the reason it is not when it is not.
 *
 * 🚩 THIS IS THE FIX FOR THE HOLE IN THE HEADER'S THIRD SECTION. Four things have to be true
 * before "the pattern did not match there" means anything, and none of them used to be checked:
 *
 *   1. it looks like a sha at all — which also keeps a leading dash out of an argv position;
 *   2. it resolves, unambiguously, in this repository;
 *   3. it is a COMMIT, not a tree or a blob pasted out of `git ls-tree`;
 *   4. HEAD descends from it. A `filed-at` on a rebased-away branch resolves fine and READS fine,
 *      and the answer it produces is about a tree that is nobody's ancestor.
 *
 * `rev-parse --verify <sha>^{commit}` settles 2 and 3 in one call; `merge-base --is-ancestor`
 * settles 4. This is precisely the standard the ```rounds fence has always been held to — the bug
 * was that it was never applied to the field the discrimination clause actually reads.
 */
const preImageVerdicts = new Map();

function preImageVerdict( sha ) {

    if ( preImageVerdicts.has( sha ) === true ) return preImageVerdicts.get( sha );

    let verdict = null;

    if ( /^[0-9a-f]{7,40}$/.test( sha ) === false ) {

        verdict = `"${ sha }" is not a 7-to-40 character hex sha`;

    }

    if ( verdict === null ) {

        try {

            git( 'rev-parse', '--verify', `${ sha }^{commit}` );

        } catch {

            verdict = `${ sha } does not resolve to a commit in this repository`;

        }

    }

    if ( verdict === null ) {

        try {

            git( 'merge-base', '--is-ancestor', sha, 'HEAD' );

        } catch {

            verdict = `${ sha } is a commit, but HEAD does not descend from it, so its tree is `
                + 'the pre-image of nothing here';

        }

    }

    preImageVerdicts.set( sha, verdict );

    return verdict;

}

/**
 * The contents of `path` at `commit`, or `null` when the file did not exist there.
 *
 * `null` is a real answer and not an error: a request filed against a file that did not yet exist
 * — `tools/run-selftests.sh` is exactly that case — has a pre-image with no match in it, which is
 * precisely what the discrimination clause wants to see.
 *
 * ⚠️ AND THAT IS EXACTLY WHY THIS NOW THROWS on an unusable commit. "Unknown" and "empty" are
 * different answers and they used to share this return value, which is the whole defect. The
 * adjudicator validates `filed-at` before it gets here and so never reaches the throw; the throw
 * is a guard against the NEXT caller, who will not have read this comment.
 *
 * Reads are memoised because every red proof below re-adjudicates the whole ledger — every entry,
 * once per proof — and git objects are immutable. The run prints both counts rather than this
 * comment carrying them: they were "34 entries, fourteen times" when the sentence was written and
 * neither number survived two rounds, which is §1.25e happening inside the file about §1.25e.
 */
const fileContents = new Map();

function fileAtCommit( commit, path ) {

    const unusable = preImageVerdict( commit );

    if ( unusable !== null ) throw new Error( `pre-image unreadable — ${ unusable }` );

    const key = `${ commit }:${ path }`;

    if ( fileContents.has( key ) === true ) return fileContents.get( key );

    let content;

    try {

        // stderr is discarded on purpose: "exists on disk, but not in <sha>" is the ANSWER to this
        // question for a file the request predates, not a problem worth printing 30 times.
        content = execFileSync( 'git', [ 'show', key ],
            { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
                stdio: [ 'ignore', 'pipe', 'ignore' ] } );

    } catch {

        content = null;

    }

    fileContents.set( key, content );

    return content;

}

const headContents = new Map();

function fileAtHead( path ) {

    if ( headContents.has( path ) === true ) return headContents.get( path );

    let content;

    try {

        content = readFileSync( resolve( REPO, path ), 'utf8' );

    } catch {

        content = null;

    }

    headContents.set( path, content );

    return content;

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

        // Provenance, and it runs for EVERY status rather than only for APPLIED. The APPLIED
        // branch is the one that reads this commit, but half a validated field is how the last
        // hole got in: an OPEN entry whose `filed-at` is fiction becomes an APPLIED entry whose
        // `filed-at` is fiction the moment somebody flips the status, and at that point the
        // discrimination clause is already off.
        const filedAt = entry[ 'filed-at' ];
        const filedAtIsPresent = filedAt !== undefined && filedAt !== '';
        const filedAtUnusable = filedAtIsPresent
            ? preImageVerdict( filedAt )
            : 'the field is missing, and SCHEMA has already said so';

        if ( filedAtIsPresent === true && filedAtUnusable !== null ) {

            fail( id, 'FILED-AT', `${ filedAtUnusable }. This is the commit the anti-rubber-stamp `
                + 'clause reads, and an unreadable pre-image turns that clause off in the GREEN '
                + 'direction rather than the red one' );

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
            //
            // 🚩 It does NOT run when `filed-at` is unusable, and that guard is the point of the
            // whole fix. Running it anyway would compare HEAD against a tree we could not read and
            // then report no violation — a reassuring silence about a question that was never
            // asked, which is the exact shape of the defect. FILED-AT has already failed the entry.
            if ( filedAtUnusable === null ) {

                const before = readAt( filedAt, verify.path );

                if ( matches( verify, before ) === true ) {

                    fail( id, 'APPLIED-VACUOUS',
                        `verify already matched ${ verify.path } at filed-at ` +
                        `${ filedAt }, so it does not discriminate the change` );

                }

                // Clause 3: clause 2 has to have been EARNED, and when the target file is not at
                // `filed-at` at all it was not. `before` is `null`, `matches` is false, and the
                // anti-rubber-stamp clause returns its passing answer to a question no tree was
                // asked — `/./` scores exactly as well as a surgical pattern. That is the R9 hole
                // one level down: R9 was an unreadable COMMIT turning clause 2 off, this is a
                // legitimately-read commit in which the FILE is simply absent.
                //
                // It is refused as a silent pass and permitted as a DECLARED one, because the case
                // is real and common — three entries here fulfilled their request by creating the
                // file (REQ-003 `run-selftests.sh`, REQ-009 `MorphVelocity.js`, REQ-023
                // `frame-clock.js`) and no pattern can discriminate a tree that does not contain
                // the file. `pre-image: absent` is the author saying so in the entry, where the
                // next reader of that green tick will see it.
                //
                // ⚠️ The declaration is adjudicated in BOTH directions for the same reason every
                // other field here is: a `pre-image: absent` on an entry whose file was right
                // there at `filed-at` is a claim that the strongest clause in this gate did not
                // apply, which is worth exactly as much scrutiny as the status field.
                const declaredAbsent = /^absent\b/.test( entry[ 'pre-image' ] ?? '' );

                if ( before === null && declaredAbsent === false ) {

                    fail( id, 'PRE-IMAGE',
                        `${ verify.path } does not exist at filed-at ${ filedAt }, so the ` +
                        'anti-rubber-stamp clause passed this entry for free — any pattern at ' +
                        'all discriminates an absent file. Declare it: `pre-image: absent — <why ' +
                        'no tree in this history holds the pre-image>`' );

                }

                if ( before !== null && declaredAbsent === true ) {

                    fail( id, 'PRE-IMAGE',
                        `declares pre-image absent, but ${ verify.path } is present at filed-at ` +
                        `${ filedAt } — the discrimination clause did run, and the declaration ` +
                        'excuses it from a scrutiny it does not need' );

                }

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
// 2. THE RED PROOFS — each mutation, and the clause it has to reach
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

/**
 * A commit object carrying `sha`'s exact tree, parented on HEAD so that HEAD cannot descend from
 * it. Nothing references it: `commit-tree` writes one loose object and touches no ref, no index
 * and no working file, and `git gc` prunes it. The identity and both dates are pinned so a given
 * HEAD always yields the same sha rather than a fresh dangling object on every run.
 *
 * RED 10 needs this and there is no other way to get it: this repository is linear, so every
 * commit that exists is an ancestor of HEAD and the ancestry half of FILED-AT would have no
 * proof — which is the definition of a decorative clause.
 */
function commitOffTheHistory( sha ) {

    return execFileSync( 'git',
        [ 'commit-tree', `${ sha }^{tree}`, '-p', 'HEAD',
            '-m', 'request-ledger.selftest RED 10 — deliberately off this history' ],
        { cwd: REPO, encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'ignore' ],
            env: { ...process.env,
                GIT_AUTHOR_NAME: 'red proof', GIT_AUTHOR_EMAIL: 'proof@localhost',
                GIT_COMMITTER_NAME: 'red proof', GIT_COMMITTER_EMAIL: 'proof@localhost',
                GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
                GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' } } ).trim();

}

const applied = live.entries.filter( ( entry ) => entry.status === 'APPLIED' );

const anApplied = applied[ 0 ];
const anOpen = live.entries.find( ( entry ) => entry.status === 'OPEN' );
const aRejected = live.entries.find( ( entry ) => entry.status === 'REJECTED' );

/**
 * The FILED-AT proofs are filed against a DIFFERENT applied entry from RED 1–3 on purpose. The
 * verifier who found the hole first mutated the entry those three are built on and got a red for
 * the wrong reason — the proofs broke, not the adjudication — and had to move the identical
 * mutation one entry down to see the truth. A proof that only works on the one entry every other
 * proof already touches is not independent evidence.
 */
const anotherApplied = applied[ 1 ];

const proofs = [];

function redProof( label, clause, mutate, options ) {

    let result;

    try {

        result = adjudicate( mutate( ledgerText ), options );

    } catch ( error ) {

        // ⚠️ THIS RETURNS THE PROOF, and the first draft returned nothing. A mutation that throws
        // is a legitimate red — but callers hold onto the returned proof to assert its diagnosis,
        // and `undefined` turned a clean named FAIL into a TypeError stack trace with no summary
        // line after it. Found by ablating the APPLIED-VACUOUS guard, which is exactly the state
        // that makes these mutations throw. A gate is allowed to fail; it is not allowed to crash
        // instead of saying what it found.
        const threw = { label, clause, caught: false, diagnosis: '',
            detail: `threw: ${ error.message }` };

        proofs.push( threw );

        return threw;

    }

    const hits = result.violations.filter( ( violation ) => violation.clause === clause );
    const others = result.violations.filter( ( violation ) => violation.clause !== clause );

    const proof = {
        label, clause,
        caught: hits.length > 0,
        diagnosis: hits.length > 0 ? hits[ 0 ].detail : '',
        detail: hits.length > 0
            ? `${ hits[ 0 ].id }: ${ hits[ 0 ].detail.slice( 0, 96 ) }`
            : `NOT CAUGHT — ${ others.length } other violations` };

    proofs.push( proof );

    return proof;

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

// --- FILED-AT, broken three different ways ------------------------------------------------------
//
// 🚩 RED 2 proves APPLIED-VACUOUS catches a vacuous PATTERN. It said nothing about a vacuous
// PRE-IMAGE, and a verifier walked straight through the gap. So the clause that closes it gets
// three proofs failing for three different reasons, and they are caught by different HALVES of it:
// 8 and 9 by the resolve half, 10 by the ancestry half. Delete either half and exactly one of
// these three goes green, which is what makes both halves load-bearing rather than ornamental.

// RED 8 — the reported defect, reproduced verbatim: a sha naming no object at all, paired with a
// `verify` that discriminates nothing. Before FILED-AT existed this ran 11/11 green at exit 0,
// because `null` was the passing side of the discrimination clause.
const namesNoObject = redProof( 'APPLIED at a filed-at naming no object, with a vacuous verify',
    'FILED-AT',
    ( text ) => mutateField(
        mutateField( text, anotherApplied.id, 'filed-at', 'deadbee' ),
        anotherApplied.id, 'verify', `${ anotherApplied.target } /./` ) );

// RED 9 — a real object in this repository, forty hex characters of it, that happens to be a TREE.
// The `git ls-tree` copy-paste. `git show <tree>:<path>` fails exactly the way an unknown sha
// does, so it used to produce the identical silent no-op through a completely different route.
const wrongObjectType = redProof( 'APPLIED at a filed-at that is a real object of the wrong type',
    'FILED-AT',
    ( text ) => mutateField( text, anotherApplied.id, 'filed-at', git( 'rev-parse', 'HEAD^{tree}' ) ) );

// RED 10 — the one the resolve half cannot see. A real commit, right type, carrying the entry's
// OWN honest pre-image tree — so `git show` succeeds and the discrimination clause returns the
// correct answer. Nothing is wrong with the content. What is wrong is the PROVENANCE: this commit
// is not in HEAD's history and the gate never asked. That is the rebased-away-branch case, and the
// only reason the answer came out right here is that the proof deliberately made it come out right.
const offThisHistory = redProof( 'APPLIED at a real commit this history does not descend from',
    'FILED-AT',
    ( text ) => mutateField( text, anotherApplied.id, 'filed-at',
        commitOffTheHistory( anotherApplied[ 'filed-at' ] ) ) );

// RED 15 — the fourth mechanism, and the one ABLATION had to find rather than inspection: with the
// hex-shape test removed the suite still read 22/22, so the test was decorative until this proof
// existed. `filed-at: HEAD` resolves, is an ancestor-of-self, and is accepted by everything else in
// the clause — and it is not a pin at all. It means a different commit tomorrow, which makes the
// pre-image of an APPLIED entry drift silently until the discrimination clause is comparing HEAD
// with itself. `main`, `HEAD~3` and `<sha>^` are the same defect; the rule is a shape rule because
// `filed-at` has exactly one legitimate form and telling immutable expressions from moving ones at
// parse time buys nothing.
//
// Filed against an OPEN entry on purpose: OPEN never runs the discrimination clause, so nothing but
// FILED-AT can possibly catch this one.
const notAPinAtAll = redProof( 'filed-at is a moving reference rather than an immutable sha',
    'FILED-AT',
    ( text ) => mutateField( text, anOpen.id, 'filed-at', 'HEAD' ) );

// --- PRE-IMAGE, the R9 hole one level down ------------------------------------------------------
//
// 🚩 FILED-AT closed "the pre-image COMMIT is unreadable". It said nothing about "the commit reads
// fine and the FILE is not in it", which reaches the identical end state: `before` is `null`,
// `matches` is false, and APPLIED-VACUOUS returns its passing answer without having compared
// anything. Measured on this ledger when the clause was added — three entries were taking that
// free pass silently (REQ-003, REQ-009, REQ-023) and a fourth had just been flipped to APPLIED on
// it (REQ-068, whose target `tools/spikes/hair-groom.js` was first committed by the same commit
// that carried the fix). All four are legitimate; none of them was DECLARED, and a reader had no
// way to tell them from an entry whose pattern had actually been tested against a real pre-image.
//
// Two mechanisms, in opposite directions, because the declaration is a claim like any other.

const aBornAfterFiling = applied.find(
    ( entry ) => /^absent\b/.test( entry[ 'pre-image' ] ?? '' ) );

if ( aBornAfterFiling === undefined ) {

    throw new Error( 'RED 16 needs an APPLIED entry declaring `pre-image: absent` and the ledger '
        + 'has none — if the class has genuinely emptied, delete the proof AND the clause together '
        + 'rather than leaving a clause with nothing behind it' );

}

// RED 16 — the silent free pass: the target postdates `filed-at` and the entry does not say so.
// This is the shape REQ-068 shipped in for a round.
const undeclaredAbsence = redProof(
    'APPLIED whose target did not exist at filed-at, taking the free pass silently', 'PRE-IMAGE',
    ( text ) => mutateField( text, aBornAfterFiling.id, 'pre-image',
        'the twelve-segment version was right there' ) );

// RED 17 — the inverse, and the reason the declaration is adjudicated rather than trusted: an
// entry excusing itself from the strongest clause in this gate when the clause did in fact run.
// Filed against RED 1–3's entry, whose target is present at its `filed-at` — proved by RED 1,
// which reads that very tree and finds the pre-image in it.
const falseAbsence = redProof(
    'pre-image declared absent on an entry whose file was right there', 'PRE-IMAGE',
    ( text ) => mutateField( text, anApplied.id, 'pre-image', 'absent' ) );

// --- the four clauses that had no proof at all --------------------------------------------------
//
// Found by the coverage assertion below, not by inspection. That is the argument for deriving the
// clause vocabulary from the source rather than listing it by hand: SCHEMA, TARGET, ANCHOR and
// REJECTED-STALE had shipped for two rounds with nothing standing behind them.

// RED 11 — two entries at the same address. An id is what the ledger is indexed by, and a code
// comment citing REQ-025 has no way to tell which of two REQ-025s it meant.
redProof( 'two entries carrying the same id', 'SCHEMA',
    ( text ) => mutateField( text, live.entries[ 1 ].id, 'id', live.entries[ 0 ].id ) );

// RED 12 — the verify names a file that is not at HEAD. Without this clause "did not match" reads
// as a clean negative when the honest answer is that there was nothing to look in.
redProof( 'verify points at a file that does not exist at HEAD', 'TARGET',
    ( text ) => mutateField( text, anApplied.id, 'verify',
        'packages/testbed/src/this-file-does-not-exist.js /anything/' ) );

// RED 13 — the anchor has rotted: the entry is still OPEN and the code it points at has moved.
// The ledger's header tells the integrator to re-anchor rather than delete; this is what makes
// that instruction reachable instead of advisory.
redProof( 'an OPEN entry anchored to code that is no longer there', 'ANCHOR',
    ( text ) => mutateField( text, anOpen.id, 'anchor',
        `${ anOpen.target } /ZZ_NO_SUCH_TOKEN_IN_ANY_FILE_ZZ/` ) );

// RED 14 — RED 3's mirror on the other status: a change was REJECTED and is in the file anyway.
// `/./` matches every non-empty file, so this is the strongest available "it is present".
redProof( 'REJECTED, but the change is in the file', 'REJECTED-STALE',
    ( text ) => mutateField( text, aRejected.id, 'verify', `${ aRejected.target } /./` ) );

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

// ================================================================================================
// 2b. THE COVERAGE STATEMENT ABOUT THE PROOFS THEMSELVES
// ================================================================================================
//
// This used to assert "N proofs, N distinct clauses". Wrong invariant, twice over: it says nothing
// about a clause with NO proof — four had none — and it would have FORBIDDEN the FILED-AT fix,
// since rule 4 requires breaking a clause more than one way and that puts two proofs on one clause.
//
// So the vocabulary is read out of this file's own source and the assertion is inverted: every
// clause the adjudicator can emit must have a proof standing behind it. A successor who adds a
// clause and no proof gets a red naming the clause.

/**
 * Every clause string `adjudicate()` is capable of emitting, read from this file's own source.
 *
 * ⚠️ COMMENTS ARE STRIPPED BEFORE THE SCAN, and the first draft of this function did not do that:
 * a sentence in the comment above it spelled out the shape of the call it was looking for, the
 * scan read the prose as code, and the coverage check went red demanding a red proof for a clause
 * named CLAUSE. Funny, and also the correct behaviour of the check — but a source scanner that
 * reads documentation as source will eventually do the inverse and miss a real clause, so it reads
 * code only. Every `//` in this file is a whole line, verified by grep, so the line rule is safe.
 */
function clausesTheAdjudicatorCanEmit() {

    const code = readFileSync( fileURLToPath( import.meta.url ), 'utf8' )
        .replace( /\/\*[\s\S]*?\*\//g, '' )
        .replace( /^[ \t]*\/\/.*$/gm, '' );

    // The failure helper takes the clause as its second argument, and the first never contains a
    // comma.
    const literal = [ ...code.matchAll( /\bfail\(\s*[^,]+,\s*'([A-Z][A-Z-]*)'/g ) ]
        .map( ( hit ) => hit[ 1 ] );

    // Exactly one clause is built at runtime — `${ status }-STALE` — and a source scan cannot
    // expand it, so its two expansions are named. The count of runtime-built forms is asserted
    // below, so a successor who adds a second one gets a red rather than a silently short list.
    const runtimeBuilt = [ ...code.matchAll( /\bfail\(\s*[^,]+,\s*`([^`]*)`/g ) ]
        .map( ( hit ) => hit[ 1 ] );

    return { clauses: new Set( [ ...literal, 'OPEN-STALE', 'REJECTED-STALE' ] ), runtimeBuilt };

}

{
    const { clauses, runtimeBuilt } = clausesTheAdjudicatorCanEmit();
    const proved = new Set( proofs.filter( ( proof ) => proof.caught ).map( ( p ) => p.clause ) );
    const unproved = [ ...clauses ].filter( ( clause ) => proved.has( clause ) === false );

    check( 'the clause vocabulary read from this file is fully expanded — exactly one clause is '
        + 'built at runtime, and it is the STALE pair',
    runtimeBuilt.length === 1 && /-STALE$/.test( runtimeBuilt[ 0 ] ),
    `${ runtimeBuilt.length } runtime-built form(s): ${ runtimeBuilt.join( ', ' ) || 'none' }` );

    // The scan's other failure direction. Comment-stripping that ate real code, or a clause name
    // typed one way in the proof and another in the adjudicator, both show up as a proof declaring
    // a clause the source does not contain — and both would otherwise make the coverage check
    // pass by shrinking the thing it is measuring against.
    const undeclared = proofs
        .map( ( proof ) => proof.clause )
        .filter( ( clause ) => clauses.has( clause ) === false );

    check( 'every clause a red proof declares actually exists in the adjudicator, so the scan '
        + 'cannot pass by under-reading the source',
    undeclared.length === 0,
    undeclared.length === 0 ? `${ proofs.length } proofs, every clause found in source`
        : `not in source: ${ [ ...new Set( undeclared ) ].join( ', ' ) }` );

    check( 'every clause the adjudicator can emit has a red proof behind it, so no clause is '
        + 'decorative',
    unproved.length === 0,
    unproved.length === 0
        ? `${ proofs.length } proofs cover all ${ clauses.size } clauses`
        : `NO PROOF for ${ unproved.join( ', ' ) }` );

    // Rule 4 as an assertion rather than a habit: the clause this round added is proved red by
    // three mutations that fail for three different reasons, not by three inputs to one reason.
    const filedAtMechanisms = proofs.filter(
        ( proof ) => proof.clause === 'FILED-AT' && proof.caught ).length;

    check( 'FILED-AT is proved red four DIFFERENT ways — not a pin, no object, wrong object type, '
        + 'and right object off this history',
    filedAtMechanisms === 4, `${ filedAtMechanisms } mechanisms` );

    // 🚩 AND THE CHECK THAT STOPS HALF OF FILED-AT BEING DECORATIVE, which ablation caught before
    // it shipped. `merge-base --is-ancestor` ERRORS on a sha naming no object and on a sha naming
    // a tree, so it catches RED 8 and RED 9 unaided: with the `rev-parse --verify ^{commit}` call
    // ablated, the suite still read 21/22 green and the only red was this check. Detection did not
    // need the resolve half. The DIAGNOSIS did — without it "deadbee" is reported as "a commit
    // HEAD does not descend from", a confident false statement about what is wrong, and this
    // project has spent three rounds on what a gate that misdescribes its own finding costs.
    //
    // So the diagnosis is asserted, and asserting it is what makes the resolve half load-bearing.
    const shape = /is not a 7-to-40 character hex sha/;
    const resolution = /does not resolve to a commit/;
    const ancestry = /does not descend/;

    const told = ( proof, expected ) => expected.test( proof.diagnosis )
        && [ shape, resolution, ancestry ].filter(
            ( other ) => other !== expected && other.test( proof.diagnosis ) ).length === 0;

    // The same standard on the clause this round added, and it is not ceremony: the two mechanisms
    // ask the author for OPPOSITE edits — add the declaration, or delete it. A clause that reported
    // one while meaning the other would send a reader to remove the only line telling them the
    // discrimination never happened.
    const absenceDiagnosis = /does not exist at filed-at/;
    const presenceDiagnosis = /declares pre-image absent, but/;

    check( 'PRE-IMAGE is proved red BOTH ways and tells them apart — an undeclared absence and a '
        + 'declared absence that is not one ask for opposite edits',
    absenceDiagnosis.test( undeclaredAbsence.diagnosis )
        && presenceDiagnosis.test( undeclaredAbsence.diagnosis ) === false
        && presenceDiagnosis.test( falseAbsence.diagnosis )
        && absenceDiagnosis.test( falseAbsence.diagnosis ) === false,
    `undeclared: ${ absenceDiagnosis.test( undeclaredAbsence.diagnosis ) ? 'absence' : 'WRONG' }, `
        + `false-declaration: ${ presenceDiagnosis.test( falseAbsence.diagnosis ) ? 'presence' : 'WRONG' }` );

    check( 'FILED-AT tells the four mechanisms APART — one shape failure, two resolution failures '
        + 'and one ancestry failure, not one verdict wearing four hats',
    told( notAPinAtAll, shape ) && told( namesNoObject, resolution )
        && told( wrongObjectType, resolution ) && told( offThisHistory, ancestry ),
    `not-a-pin: ${ told( notAPinAtAll, shape ) ? 'shape' : 'WRONG' }, `
        + `no-object: ${ told( namesNoObject, resolution ) ? 'resolution' : 'WRONG' }, `
        + `wrong-type: ${ told( wrongObjectType, resolution ) ? 'resolution' : 'WRONG' }, `
        + `off-history: ${ told( offThisHistory, ancestry ) ? 'ancestry' : 'WRONG' }` );
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
