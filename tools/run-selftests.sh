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

cd "$( dirname "$0" )/.." || exit 1

tree_state() { if [ -z "$( git status --porcelain )" ]; then echo clean; else echo DIRTY; fi; }

echo "HEAD: $( git rev-parse --short HEAD )"
echo "tree: $( tree_state )   at $( date -u +%H:%M:%SZ )"
echo

failures=0

run_gate() {

    local label="$1"; shift
    local out code

    out=$( "$@" 2>&1 ); code=$?

    if [ "$code" -ne 0 ]; then failures=$(( failures + 1 )); fi

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

exit "$failures"
