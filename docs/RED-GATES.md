# Red gates — the declaration every round summary is copied from

**Every gate that is RED at HEAD is named here, with the reason, or `tools/run-selftests.sh` fails
the run for the omission.** Adjudicated in both directions by that script: a red gate missing from
this file is an `UNDECLARED RED`, and a gate named here that passes is a `STALE DECLARATION`.

---

## Why this file exists, in one paragraph

**Three consecutive rounds shipped a summary with a red gate it did not mention**, and all three
were found by the adversarial pass rather than by the round that caused them — R16's shadow bias,
R17's garment casting, and R18's `HairOIT.selftest.mjs` 29/30 and `HairShadow.selftest.mjs` 6 of 8,
which had been red since the groom went 294 to 378 cards. In every case `tools/run-selftests.sh`
had printed the failure, with its name, its exit code and the last twenty lines of its output, and
in every case the summary was written from memory instead. The information was never missing. What
was missing was a step that fails when the information goes unread, which is the same thing
`docs/OPEN-REQUESTS.md` is to a dropped diff request. This is that step for a dropped red.

## The rule

A declaration is one line, and the path is the string the runner prints so that a declaration can
be written by copying a failure rather than by retyping a path:

```
- `path/to/thing.selftest.mjs` — why it is red, in a sentence a reader can act on.
```

**A reason is required and "known issue" is not one.** The point of the line is that the next agent
can tell in one read whether the red is a decision or a defect, and a red nobody can classify is a
red nobody will fix.

⚠️ **A DECLARED RED IS STILL A RED.** The runner's exit code stays "how many gates are failing", so
declaring one buys nothing except honesty — which is the entire point. This file is not a
suppression list and nothing reads it to skip a gate.

🚩 **THE `## Declared red at HEAD` HEADING IS LOAD-BEARING.** The runner reads bullets under that
heading and stops at the next `##`, so a declaration written into the wrong section is not a
declaration and the runner will say so. Resolved entries keep the same bullet format below it
deliberately — a log that deletes its history cannot show a pattern, and the pattern is the reason
this file exists — which is exactly why the parse is scoped rather than whole-document.

---

## The red proof of the check itself, run on the full 48-gate suite this session

The check is a gate, so it needs one, and it is cheap: break this FILE rather than any source, in
both directions at once, and run the suite. Both markers were live in one 19-minute run —
`tools/request-ledger.selftest.mjs` declared while green, and the HairMaterial path suffixed
`.BREAK` so the real red matched nothing:

```
FAILING GATES: 1
UNDECLARED RED   packages/core/src/material/HairMaterial.selftest.mjs
STALE DECLARATION   packages/core/src/material/HairMaterial.selftest.mjs.BREAK is declared red ... and passed
STALE DECLARATION   tools/request-ledger.selftest.mjs is declared red ... and passed
UNDECLARED RED: 1   STALE DECLARATIONS: 2          exit 4
```

Restored to the two bullets below, same run of 48 gates: `UNDECLARED RED: 0   STALE DECLARATIONS: 0`,
exit 1 — the one declared red, and nothing else.

🎯 **THE `.BREAK` SUFFIX IS THE INTERESTING HALF.** It is what a declaration looks like after
somebody renames a gate file or fixes one red and leaves the line behind: a stale line that reads
like a declaration and covers nothing. `UNDECLARED RED` alone would not have caught it, because the
count of declarations was still right. It is caught because the file is adjudicated in BOTH
directions, which is the clause worth keeping when this check is next edited.

---

## Declared red at HEAD

- `tools/figure-pipeline/hair_alpha.selftest.mjs` — RED BY CORRECTION, 18 of 19, and the sheet did
  not move. `hair_alpha.SAMPLED_LOD` was 1.492 for two rounds, taken from a Jacobian `hair_lod.mjs`
  measured in **CSS pixels** while the page ships TAAU at `resolutionScale` 0.66 — so the gate was
  reading the atlas `log2(1/0.66)` = 0.599 of a mip FINER than the hardware does, which flatters the
  exact statistic clause A exists to refuse. Corrected at source this round: the tool now takes its
  Jacobian on the scene pass and reads **2.075 where it read 1.492 on the same 648-card groom**, a
  shift of +0.583 against the +0.599 the arithmetic predicts (the histogram's bins are 0.05 wide),
  and `hair_layers.mjs` reads 2.011 for the same quantity by an independent per-pixel route. On this
  round's wider cards the constant measures **1.925**, and at 1.925 clause A names exactly one
  strip: **strip 7 at 1.90 runs per row against a floor of 3.00.**
  🚩 **AND WHAT IS RED IS THE WISP STRIP, WHICH IS THE OPPOSITE OF THE DEFECT CLAUSE A WAS WRITTEN
  FOR.** Strip 7 is 88.4% transparent in runs 1.12 texels wide; the board the clause was written
  against was 96.4% opaque in runs of 33.55. Clause C separates them and reports the widest run on
  the sheet at 5.97 against its ceiling of 20. That is an observation, not a licence: re-deriving A
  to clear its own red is precisely the failure mode the threshold exists to prevent, so the red is
  carried. **NEXT AGENT:** the replacement, if there is one, has to be red-proved against a wisp
  strip AND against a board — the cap strip on this very sheet is the second of those and clause L
  already uses it. Bound pinned by mutation this session, file restored byte-identically after each
  edit: green at floor 1.85 and 1.89, RED at 1.90, 1.91 and 1.95. Owned by `tools/figure-pipeline/**`.

- `tools/request-ledger.selftest.mjs` — 25 of 26, and the failing clause is the ROUNDS clause rather
  than any entry: *"R12 — HEAD is 15 commits past the newest declared round, ceiling is 14. Declare
  the new round — which is what expires the OPEN entries below."* It went red AT THE MOMENT R20's own
  commit landed, because that commit is the fifteenth, so the round that caused it could not have
  seen it in its own pre-commit run. It is a clock, not a dropped request: 14 OPEN entries are being
  carried on a round number that no longer describes the tree. **THE FIX IS ONE LINE IN
  `docs/OPEN-REQUESTS.md`** — declare the current round and its opening commit, in the form the
  ROUNDS clause parses — and that file is outside `tools/figure-pipeline/**`, so R21 declared the red
  rather than editing it. ⚠️ The 14 OPEN entries EXPIRE when that line is written, so whoever writes
  it has to adjudicate them in the same edit; declaring the round alone will turn one red into
  fourteen. Owned by whoever owns `docs/OPEN-REQUESTS.md`.

- `packages/core/src/render/HairOIT.selftest.mjs` — INTERMITTENT, 31/32 on **2 of 10 runs** this
  session and 32/32 on the other eight. Not a decision and not yet a located defect: the failing
  clause is above the 20 lines `run-selftests.sh` tails, and on the standalone run where it first
  appeared the output was overwritten before it was read. What R20 does know is that on the suite
  run that reproduced it, B1/B2/B3 and C1/C2/C3 all printed PASS with their usual numbers, so the
  failure is in the **A block** — the order-independence and instrument-zero clauses. A1–A3 include
  `A3`, which asserts an EXACT zero over 392,000 px for five arms loaded twice apiece; ten pairs of
  renders required to be bit-identical is the shape of thing that fails one run in five.
  🚩 **NEXT AGENT: capture the FAIL line before anything else** — run it in a loop redirecting to
  distinct files until one goes red. Owned by `packages/core/src/render/**`.
  ⚠️ **AND THIS ENTRY EXPOSES A GAP IN THIS FILE'S OWN MACHINERY.** An intermittent gate cannot be
  declared cleanly in either direction: on a run where it passes, this line reads as a `STALE
  DECLARATION` and the runner will say so. That is the adjudicator behaving correctly on an input it
  was not designed for — it assumes a gate's colour is a function of the tree. A stale marker on
  THIS line means "it passed this time", not "the declaration was wrong", and deleting the line on
  that basis would be the rubber stamp the file exists to refuse.

- `packages/core/src/material/HairMaterial.selftest.mjs` — RED BY DESIGN, 38/42. The four failing
  clauses are the ones the current groom cannot satisfy: they encode the density and opacity target
  the round is working toward, and turning them green is the work item rather than a repair to the
  gate. Owned by `packages/core/src/material/**`. Do not re-derive these thresholds to clear them —
  that is the failure mode the whole gate exists to prevent.

## Resolved, kept as the record

Entries are not deleted, for `docs/OPEN-REQUESTS.md`'s reason: a file that forgets cannot show a
pattern, and the pattern here is what the round was fixing.

- `packages/core/src/motion/HairDynamics.selftest.mjs` — was 30/31 at R19, and the FIRST red this
  file's machinery caught on its own. Clause X applied a 0.25 ms budget — 1.5% of 16.6 ms, a real
  derivation — to `p95` of 120 single-frame COMPUTE timestamps. GATE WRONG, and the threshold did
  not move. The solver got CHEAPER (p50 0.02746–0.02837 ms over six sittings, against the 0.06554 ms
  the ceiling was derived against); what changed is that this pool used to quantise to 65.536 µs, so
  `p95` could only ever report one or two ticks, and headless Chromium now resolves it to the
  nanosecond — turning `p95` into a reading of the machine's scheduling of a fixed workload. Proved
  with a second pool the solver does not touch: on the slowest tenth of frames by COMPUTE the RENDER
  pool looked 8.37x–14.03x slower too, against a null of 1.0. Re-derived onto `p50`.

  ⚠️ **AND THAT COMMON-MODE CONTROL WAS THEN WITHDRAWN, after it went red in two consecutive full
  suite runs.** Re-measured on the same shipped build it reads 9.24x, 1.14x and 0.57x — the last one
  below its own null — so it is weather, not a property of the build, and the four agreeing sittings
  behind it were one sitting's worth of evidence. It is printed as a diagnostic now and asserted by
  nothing. What licenses `p50` instead was already in the run: `__HAIR_GPU_COST__` measures the
  dispatch arithmetic directly at 0.01807–0.01848 ms a frame, a 2.3% spread across every sitting,
  so a 0.38 ms frame cannot be that arithmetic. Clause Xb now asserts the one exactly-reproducible
  precondition — every frame ran the same substep count. Both clauses red-proved at source. Green
  32/32 at R20. LEARNINGS §1.25ag.

- `packages/core/src/render/HairOIT.selftest.mjs` — was 29/30 from R17 to R18, undeclared. Clause
  A3 bounded the `cutout` arm's draw-order residue with `max <= 2` code values, a worst-single-pixel
  statistic over 392,000 samples. A depth-resolved arm can only move where two admitted fragments
  tie in depth, and 378 cards packed into the envelope 294 occupied make more ties: measured 3
  pixels over 2 cv with a worst of 2.7. Re-derived as a SHARE with a same-run liveness control
  (A3b) and a source red proof. Green 31/31 at R18.

- `packages/core/src/render/HairShadow.selftest.mjs` — was 6 of 8 from R17 to R18, undeclared. Both
  failing clauses were red proofs referencing the `hairShadowCutoff = 1` arm, which was chosen as
  "nothing casts" when nothing in the atlas was fully opaque. The `mass` layer made 39.406% of
  `assets/hair/bob01/albedo.png` exactly alpha 1.0, so that arm now casts a real shadow. Replaced by
  a `noCast` arm at cutoff 1.5 — above the range of a texture sample, so it is a statement about the
  mask and not about the atlas. Neither threshold moved. Green 8 of 8 at R18.
