#!/bin/bash
# tools/run-selftests.sh — every gate in the repo, one line each, with the tree state it was read at.
#
# WHY THIS EXISTS. Four consecutive audits found the gate-count table in docs/LEARNINGS.md Part 3
# wrong at the moment it was read — eleven drifted counts across three rounds, and one whole gate
# file that the table did not know existed. A count typed into prose is a claim with no gate on it.
# This is the gate on it.
#
# WHY IT PRINTS THE TREE STATE AT BOTH ENDS. A selftest count read during a fan-out is a snapshot,
# not a fact: one round watched LightingRig.selftest.mjs print 63/63 and then 82/82 four minutes
# later at the same HEAD, because its author was mid-save. If the tail line says DIRTY and the head
# line said clean, at least one count below is already history and nothing in the run can tell you
# which one. Quote counts from a run that was clean at BOTH ends, or quote them with the word DIRTY.
#
#   bash tools/run-selftests.sh          # or: npm run selftests
#
# Exit code is the number of gates that failed, capped at 250 by the shell.
#
# 🎯 THE DIFF-REQUEST LEDGER IS ONE OF THE GATES BELOW, and it is registered by the glob rather than
# by name: `tools/request-ledger.selftest.mjs` matches `*.selftest.mjs`, so it is picked up by the
# `find` on line 45 with no entry of its own. It adjudicates every entry in `docs/OPEN-REQUESTS.md`
# against the file that entry names — an APPLIED entry whose change is not in the file goes red, and
# so does an OPEN entry carried past its round. That is the gate on the failure mode that left this
# repo red at HEAD for a full round: a correctly-filed cross-file request that nobody carried.
# LEARNINGS §1.25r.
#
# ⚠️ IT READS THE WORKING TREE, ON PURPOSE — the tree is what the integrator commits — SO IT IS
# SUBJECT TO THE SAME MID-FAN-OUT CAVEAT AS EVERY COUNT BELOW. If the tail line says DIRTY, a red
# ledger entry may be another agent's half-saved file rather than a dropped request.
#
# 🎯 THE DECLARATION CHECK AT THE BOTTOM, AND WHY IT IS IN THE RUNNER RATHER THAN IN A GATE FILE.
# THREE ROUNDS RUNNING, A RED GATE REACHED THE ROUND SUMMARY UNDECLARED and was found only by the
# adversarial pass — R16 (shadow bias), R17 (garment casting), R18 (HairOIT 29/30 and HairShadow
# 6 of 8, both regressed by the groom going 294 -> 378 cards). Every one of those was printed by
# THIS SCRIPT, in the FAILING GATES block, and read by nobody. The information was never missing.
# What was missing was a step that fails when it goes unread.
#
# So `docs/RED-GATES.md` is that step, and it is deliberately the same shape as
# `docs/OPEN-REQUESTS.md`: a written declaration, adjudicated in BOTH directions against the thing
# it describes, by something that runs whether or not anybody wants it to.
#
#   UNDECLARED RED       a gate failed and the file does not name it. This is the failure mode.
#   STALE DECLARATION    the file names a gate that is green. A declaration that outlives its red
#                        is how the file becomes a rubber stamp, so it is refused in that direction
#                        too — exactly the ledger's anti-rubber-stamp clause one level up.
#
# Both add to the exit code. ⚠️ A DECLARED RED STILL EXITS NON-ZERO — the exit code stays "how many
# gates are red", because a run that exited 0 with three gates red would trade this failure mode for
# a worse one. What the declaration buys is that clearing UNDECLARED RED to zero requires editing a
# TRACKED FILE, so the red appears in the diff the integrator reads rather than in scrollback that
# nobody does. The summary is then a copy of a file, not a recollection.

cd "$( dirname "$0" )/.." || exit 1

DECLARATIONS="docs/RED-GATES.md"

tree_state() { if [ -z "$( git status --porcelain )" ]; then echo clean; else echo DIRTY; fi; }

echo "HEAD: $( git rev-parse --short HEAD )"
echo "tree: $( tree_state )   at $( date -u +%H:%M:%SZ )"
echo

failures=0
red_gates=()

run_gate() {

    local label="$1"; shift
    local out code

    out=$( "$@" 2>&1 ); code=$?

    if [ "$code" -ne 0 ]; then failures=$(( failures + 1 )); red_gates+=( "$label" ); fi

    printf 'exit=%d  %-58s %s\n' "$code" "$label" "${out##*$'\n'}"

    # A failing gate is the whole reason to run this, so it gets its tail rather than one line.
    if [ "$code" -ne 0 ]; then echo "$out" | tail -20 | sed 's/^/         | /'; fi

}

while read -r f; do run_gate "$f" node "$f"; done < <(
    find . -name "*.selftest.mjs" -not -path "./node_modules/*" | sort
)

# 🚩 THE ONE NON-OBVIOUS LINE. tools/critic/selftest.mjs does NOT match *.selftest.mjs — the name
# has no prefix — so every glob that assumes it does silently skips the most-quoted gate in the
# project. Named explicitly, because a runner that misses a gate is worse than no runner.
run_gate "tools/critic/selftest.mjs" node tools/critic/selftest.mjs
run_gate "tools/figure-pipeline/verify_glb.mjs" node tools/figure-pipeline/verify_glb.mjs

echo
echo "tree: $( tree_state )   at $( date -u +%H:%M:%SZ )"
echo "FAILING GATES: $failures"

# --- the declaration check ----------------------------------------------------------------------
#
# A gate is DECLARED by a line in `docs/RED-GATES.md` of the form
#
#     - `packages/core/src/render/HairOIT.selftest.mjs` — <why it is red, in a sentence>
#
# The path is the same string this script prints in its `exit=` line, with any leading `./` removed,
# so a declaration can be written by copying a failure line rather than by retyping a path.
#
# 🚩 ONLY THE `## Declared red at HEAD` SECTION IS READ, and that heading is load-bearing. The file
# also keeps RESOLVED entries in the same bullet format on purpose — a red-gate log that deletes its
# history cannot show a pattern, and the pattern is the whole reason the file exists — so a parse of
# the whole document would read every fixed gate as a stale declaration. If the heading is missing
# the parse yields nothing, which fails in the loud direction: every red becomes undeclared.

declared=()

if [ -f "$DECLARATIONS" ]; then

    while read -r path; do declared+=( "$path" ); done < <(
        awk '/^## Declared red at HEAD/ { inside = 1; next } /^## / { inside = 0 } inside' "$DECLARATIONS" \
            | sed -n 's/^- `\([^`]*\)`.*/\1/p' | sed 's#^\./##' | sort -u
    )

fi

contains() { local needle="$1"; shift; local item; for item in "$@"; do [ "$item" = "$needle" ] && return 0; done; return 1; }

undeclared=0
stale=0

echo

for gate in "${red_gates[@]}"; do

    gate="${gate#./}"

    if [ "${#declared[@]}" -eq 0 ] || ! contains "$gate" "${declared[@]}"; then

        undeclared=$(( undeclared + 1 ))
        echo "UNDECLARED RED   $gate"

    fi

done

for gate in "${declared[@]}"; do

    # The red list carries the `./` the `find` produced; strip it on both sides so the comparison is
    # about the gate and not about how the runner happened to spell it.
    if [ "${#red_gates[@]}" -eq 0 ] || ! contains "$gate" "${red_gates[@]#./}"; then

        stale=$(( stale + 1 ))
        echo "STALE DECLARATION   $gate is declared red in $DECLARATIONS and passed"

    fi

done

if [ ! -f "$DECLARATIONS" ] && [ "$failures" -ne 0 ]; then

    echo "MISSING          $DECLARATIONS does not exist, so every red above is undeclared"

fi

echo "UNDECLARED RED: $undeclared   STALE DECLARATIONS: $stale"

# 🚩 READ THIS BEFORE WRITING THE ROUND SUMMARY. Both numbers above must be 0, and the reds that
# remain must be quoted into the summary from the file rather than remembered. That is the whole
# mechanism: three rounds running, the summary was written from memory and the memory was short.

exit $(( failures + undeclared + stale ))
