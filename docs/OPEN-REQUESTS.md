# Open requests — the cross-file diff-request ledger

**Every cross-file change an agent filed but could not make itself lives here until it is APPLIED
or REJECTED with a written reason. Nothing else in `docs/` is allowed to be the home of a request.**

Gated by [`tools/request-ledger.selftest.mjs`](../tools/request-ledger.selftest.mjs), which runs in
`tools/run-selftests.sh` with every other gate.

---

## Why this file exists, in one paragraph

A fan-out agent measures the right number, correctly declines to edit a file it does not own, files
a precise diff request — and the request evaporates when the round ends. That has produced **two of
the last three engineering blockers** in this project. The worst of them left the repo **failing its
own gate suite at HEAD for a full round**: `sway.selftest.mjs` read 227/229 on a *clean* tree,
because the Sway agent's measured postural table went to `tools/critic/capture.mjs` as a request and
nobody carried it. `af0e68d`'s commit message names the structural fix in its own words — *make the
integrator's diff-request pass a GATED step that fails integration when a request is dropped, rather
than item six on a list of seven.* This is that step.

## 🚩 The rule that makes this a mechanism and not a wish list

**No status in this file is believed.** Every entry carries a `verify:` predicate, and the gate
adjudicates it against the real file, in both directions:

| status | what the gate proves |
|---|---|
| **APPLIED** | `verify` matches the target **at HEAD** — *and does not match it at the entry's `filed-at` commit*. The second clause is the anti-rubber-stamp clause: a pattern that matches both trees cannot tell you the change landed, so it is refused even when the change really did land. |
| **OPEN** | `verify` does **not** match at HEAD (an entry fixed incidentally by someone else is a stale entry, and a ledger of stale entries is worse than no ledger), `anchor` **does** match at HEAD (the request still points at code that exists), and `filed-round` is the **current** round. |
| **REJECTED** | `verify` does not match at HEAD, `anchor` does, and `reason` is a written sentence rather than a word — 40 characters, which is about one clause of English. |

**An OPEN entry does not survive a round boundary.** Rounds are pinned to commits in the fence
below and the gate holds them to git — every declared sha must be a real ancestor of HEAD, the
rounds must be strictly ordered in history, and HEAD may not run more than **14 commits** past the
newest declared round (the last three rounds landed **8, 8 and 8**). You cannot keep committing
without declaring a round, and declaring a round is what turns every carried-over OPEN entry red.

**Entries are never deleted.** A resolved entry stays here as the record, which is why the gate can
hold a coverage floor on the count: a rewrite that hides entries from the parser looks exactly like
a cleared backlog otherwise.

## 🎯 For the integrator — the request pass, in three commands

1. `node tools/request-ledger.selftest.mjs` **before** you start resolving, so you know what the
   round inherited.
2. Resolve every OPEN entry: apply it and flip the status to APPLIED, or reject it and write the
   reason. **"Superseded by something better" is APPLIED with the superseding mechanism as the
   `verify`** — REQ-007 is the worked example.
3. Add the new round to the ```rounds fence and re-run. Any entry still OPEN under the old round
   number goes red and names itself.

⚠️ **The gate reads the WORKING TREE, deliberately** — the tree is what you commit — **so a red
entry during a live fan-out may be another agent's half-saved file rather than a dropped request.**
Two specific shapes to expect. An `ANCHOR` failure means the request now points at code that moved;
re-anchor it, do not delete it. An `OPEN-STALE` means somebody fixed it while you were reading;
flip it to APPLIED and check the `verify` still discriminates against `filed-at`. REQ-030 landed
that way *while this ledger was being written* and is annotated as such.

## The rounds

`R<n>  <commit the round opened at>  <date>  <what the commit was>`

```rounds
R4  1985425  2026-08-08  Six statements that measured false, and the round that made them false
R5  2ec7db9  2026-08-08  An avatar that can be anyone and wears nothing; Phase 9 dresses it
R6  d9fc9e0  2026-08-08  The seven gates are green, and eleven documented numbers were not
R7  af0e68d  2026-08-09  The postural manifest tells a judge the truth again
R8  dcd1968  2026-08-09  Lateral balance is a hip strategy, and the statistic was measuring the arms
```

Rounds before R4 are not reconstructed. Resolved entries are pinned by their `filed-at` **commit**,
which is exact, and carry no round number — inventing one would be the same tidy fiction §1.25e is
about. `filed-round` is required of OPEN entries only, because that is the field the expiry clause
reads.

---

## The eleven this ledger was seeded with

The brief that created this file said eleven requests were outstanding. They were not in one place;
they were reconstructed from `docs/PROGRESS.md`'s two *"Diff requests filed against files this pass
does not own"* sections, from `docs/PUNCHLIST.md`, from commit bodies, and — the largest group —
from **comments in the source that route a reader to "the round report"**, a document that does not
exist in this repository. Each was re-verified by execution before being entered here, and **four of
the eleven turned out to be already resolved or resolved-by-supersession**, which is exactly why a
ledger has to verify rather than transcribe.

| # | request | verified state at `af0e68d` | entry |
|---|---|---|---|
| 1 | `alive.html` gains `?nudge=<mm>` for the 2AFC staircase | absent | REQ-022 OPEN |
| 2 | `stage.js` should export its frame clock; two pages copy it | absent | REQ-023 OPEN |
| 3 | merge the hide-mask attributes into the shipped `figure_g050.glb` | absent | REQ-024 OPEN |
| 4 | `TRAAPost.js` still points at "the round report" for a fix that landed | live | REQ-025 OPEN |
| 5 | `Toksvig.js` same, for a fix that landed in `SkinMaterial.js` | live | REQ-026 OPEN |
| 6 | `post.js` same, twice | live | REQ-027 OPEN |
| 7 | `wardrobe.js` same | live | REQ-028 OPEN |
| 8 | `capture.mjs`'s header attributes the capture residue to the hair cards | live | REQ-029 OPEN |
| 9 | `PROGRESS.md` carries the withdrawn byte-identity claim twice | live | REQ-016 **APPLIED** |
| 10 | `PUNCHLIST.md` says "diff request filed" for requests that landed | live | REQ-019 **APPLIED** |
| 11 | LEARNINGS Part 3's gate-count table has drifted again | live, **every row** | REQ-018 **APPLIED** |

And one that was filed on a claim that had **already measured false when it was written**:
`PROGRESS.md:316` says `LightingRig.selftest.mjs` *"exits 0 even when it prints FAIL — it cannot be
used in a script"*. It has set `process.exitCode` since `7936f37` (2026-08-07), the day **before**
the request was filed. Proven by execution rather than by reading:
`node packages/core/src/render/LightingRig.selftest.mjs --caster-gain=5` prints `FAIL: 85/98` and
exits **1**. The correction is REQ-021; the request itself never needed applying.

---

# Entries

## REQ-001 — `alive.js` must honour `?freeze` inside `__SUGATA_STEP__`

```request
id:          REQ-001
status:      APPLIED
target:      packages/testbed/src/alive.js
filed-by:    re-measurement agent (LEARNINGS §1.19a)
filed-at:    82260d4
change:      In the `?capture` step hook, gate the simulation advance on the freeze flag the same
             way the rAF path already did — `if ( frozen === false ) advanceSimulation( deltaSeconds )`.
evidence:    `?freeze&capture` advanced the clock regardless of the flag, so every "frozen plate"
             taken through capture.mjs was a figure already in motion: one step at 30 fps puts the
             head at 0.83 deg of gaze yaw, four steps at 7.18 deg, and G1 falls 1.5976 -> 1.2106.
verify:      packages/testbed/src/alive.js /IS HONOURED HERE TOO/
```

Three agents found this independently in one round. Landed in `c9fa59c`.

## REQ-002 — pin the renderer's frame counter when `?capture` takes the loop

```request
id:          REQ-002
status:      APPLIED
target:      packages/testbed/src/alive.js
filed-by:    third-pass re-measurement agent
filed-at:    1985425
change:      Zero `renderer._nodes.nodeFrame.frameId` and `TRAANode._jitterIndex` at capture
             takeover, or drive both from the capture step index.
evidence:    Six consecutive loads of one build, one seed, one recipe returned FIVE distinct PNGs,
             two differing on 56.4% of pixels. `frameId` read 15 / 16 / 17 / 18 at the first
             accepted step — a count of how many frames the machine fitted into loading a GLB.
verify:      packages/testbed/src/alive.js /CAPTURE_EPOCH_FRAME_ID/
```

Punch-list 3.20. Landed in `4aafd91` + `eaae0e3` + `29a1f1c`.

## REQ-003 — a script that runs every gate

```request
id:          REQ-003
status:      APPLIED
target:      tools/run-selftests.sh
filed-by:    re-measurement agent (LEARNINGS Part 3)
filed-at:    2ec7db9
change:      Create the runner. Its one non-obvious line is the explicit call to
             `tools/critic/selftest.mjs`, whose name does NOT match `*.selftest.mjs` and which every
             glob that assumes it does will silently skip.
evidence:    Four consecutive audits found the gate-count table in LEARNINGS Part 3 wrong at the
             moment it was read — eleven drifted counts across three rounds, and one whole gate file
             the table did not know existed.
verify:      tools/run-selftests.sh /tools\/critic\/selftest\.mjs/
```

Asked for across four rounds before it landed. `npm run selftests`.

## REQ-004 — `capture.mjs` should print the step count beside the digest

```request
id:          REQ-004
status:      APPLIED
target:      tools/critic/capture.mjs
filed-by:    fourth-pass re-measurement agent
filed-at:    2ec7db9
change:      Print `simulation.frameCount` and `fps` in the run summary beside the digest.
evidence:    The step count is part of a plate's identity — the same page and seed read G2 0.9560
             at 1 step and 0.9547 at 60 — and `measure.mjs` reads it out of the manifest to decide
             whether two plates are comparable at all.
verify:      tools/critic/capture.mjs /stepping\s+\$\{manifest\.simulation\.frameCount\} step\(s\) at/
```

## REQ-005 — the zombie guard was one generation behind

```request
id:          REQ-005
status:      APPLIED
target:      tools/critic/selftest.mjs
filed-by:    fourth-pass re-measurement agent
filed-at:    2ec7db9
change:      Add `0.7836 / 0.9189 / 0.9292 / 0.4390` to the `superseded` array beside the
             2026-08-07 generation, and correct the comment that quotes them as current.
evidence:    The guard forbade only the PREVIOUS generation of superseded G2 seed values. The
             capture-epoch pin collapsed the lottery entirely — the same four seeds return one PNG
             and 0.9182 — so the numbers a reader was most likely to re-paste were unguarded.
verify:      tools/critic/selftest.mjs /'0\.7836', '0\.9189'/
```

## REQ-006 — nothing asserted that a shadow caster shares its panel's colour

```request
id:          REQ-006
status:      APPLIED
target:      packages/core/src/render/LightingRig.selftest.mjs
filed-by:    fourth-pass re-measurement agent
filed-at:    2ec7db9
change:      Assert that every caster's colour equals its panel's, so the environment-spill clause's
             "summing only the panels is the conservative direction" argument is sound rather than
             lucky.
evidence:    The string `shadowCaster.color` appeared ZERO times in the selftest while the shipped
             code wrote `new SpotLight( new Color( placement.colour ), 1 )`.
verify:      packages/core/src/render/LightingRig.selftest.mjs /shadowCaster\.color/
```

Landed as an explicit PREMISE equality, and `8771061` then found that PREMISE and CONSERVATISM
between them still bound no magnitude — an equality on colour and a test of a sign cannot. Two more
clauses, MAGNITUDE and REACH, proved red six ways. **The request was right and insufficient**, which
is worth more than either half on its own.

## REQ-007 — `Grade.selftest.mjs`'s grain sequence could not see a freeze at frame 16

```request
id:          REQ-007
status:      APPLIED
target:      packages/core/src/render/Grade.selftest.mjs
filed-by:    fourth-pass re-measurement agent
filed-at:    2ec7db9
change:      Make the top of `SEQUENCE_FRAMES` a consecutive pair, or assert a property of the whole
             sequence.
evidence:    `[ 9, 10, 11, 12, 13, 14, 20 ]` contains exactly one frame at or above 16 and a pairwise
             check needs two, so a grain that freezes at frame 16 is invisible and the file scored
             56/56.
verify:      packages/core/src/render/Grade.selftest.mjs /600 frames/
```

**Superseded rather than applied, and better.** The gate now renders 600 frames, samples 96 of them
and computes its own coverage, so the narrow request would have added a check that could no longer
fail. Recorded as APPLIED because the defect is closed and the `verify` above proves the mechanism
that closes it is in the file — not because the literal text of the request was pasted in.

## REQ-008 — the specular filter belongs in the material, not on a testbed page

```request
id:          REQ-008
status:      APPLIED
target:      packages/core/src/material/SkinMaterial.js
filed-by:    the render agent, via `render/Toksvig.js` and `post.html?specaa=1`
filed-at:    4a8dab3
change:      Install `filteredRoughness` on the skin material's `roughnessNode`, behind a switch so
             the effect stays attributable.
evidence:    Three's own specular AA takes derivatives of `normalViewGeometry`, the interpolated
             VERTEX normal, so the micro-normal is invisible to it — which is the whole reason the
             node had to read the SHADING normal instead. `render/` can offer the node; only the
             material can install it.
verify:      packages/core/src/material/SkinMaterial.js /filteredRoughness/
```

## REQ-009 — morphed meshes need a previous-frame position, which three.js does not give them

```request
id:          REQ-009
status:      APPLIED
target:      packages/core/src/render/MorphVelocity.js
filed-by:    the render agent, via `render/TRAAPost.js`
filed-at:    4a8dab3
change:      A previous-weights path in the morph node, so the velocity buffer differences two
             morphed positions instead of a morphed one against an un-morphed one.
evidence:    `Morph.js` adds its offsets into `positionLocal` and touches `positionPrevious`
             nowhere, so a morph HELD at a constant weight on a still camera reports a large
             constant motion vector. This rig has no jaw bone and no eye bones, so the ENTIRE face
             is morph-driven and the entire face was affected.
verify:      packages/core/src/render/MorphVelocity.js /positionPrevious/
```

Punch-list 3.12's blocker, fixed at the source rather than worked around.

## REQ-010 — G6 needed a black point, and the number that moves it lives in `alive.js`

```request
id:          REQ-010
status:      APPLIED
target:      packages/testbed/src/alive.js
filed-by:    the post agent (`Grade.js`, `post.js?backdrop=`)
filed-at:    4a8dab3
change:      Give the eyelash and eyebrow cards an albedo floor, and sweep the backdrop emissive to
             a value that makes the backdrop rather than the cards the darkest thing in frame.
evidence:    The cards rendered at literally RGB(0,0,0) — 1,431 pure-black pixels, all in the
             brow/lash row band — and nothing downstream can raise a zero-albedo surface. The
             vignette at the top of the spec's band takes 27% off the black point, which is not
             enough on its own.
verify:      packages/testbed/src/alive.js /CARD_ALBEDO_FLOOR/
```

G6 0.00001 -> 0.0042, and `?cards=0` and the default now read the same G6, which is what "the cards
are no longer the darkest thing in frame" means as a measurement.

## REQ-011 — the postural manifest was announcing wrong numbers to a judge

```request
id:          REQ-011
status:      APPLIED
target:      tools/critic/capture.mjs
filed-by:    the Sway fix agent
filed-at:    d9abef5
change:      Update `POSTURAL_JUDGEMENT_SEEDS` and `POSTURAL_EMPTY_SEEDS` to the post-fix measured
             onsets and peaks.
evidence:    `capture.mjs` PRINTS these to a judge before the clip is taken, so every postural
             capture was announcing a peak 1.8 px wrong and an onset 0.1 s wrong. sway.selftest.mjs
             read 227/229 exit 1 on a CLEAN tree for a full round because of it.
verify:      tools/critic/capture.mjs /onsetSeconds: \d+\.\d\d,/
```

🚩 **This is the request whose loss created this ledger, and it is also LEARNINGS §1.25p's worked
example.** Only two of the six rows were red. The third — seed `20260807`'s onset — read **232.2**
against a measured 232.133, an error of **0.067 inside a 0.100 tolerance**. It was PASSING and it
was wrong, and nothing in the repo would ever have flagged it. Re-deriving every row is what found
it: worst declared-versus-measured onset error fell 0.067 -> 0.033, peak 1.813 -> 0.049.

🚩 **AND THE `verify` ABOVE WAS RE-ANCHORED IN R8, BECAUSE IT WAS LEARNINGS §1.25n ONE LEVEL UP.**
It read `/onsetSeconds: 232\.1/` — a LITERAL — and it went red the moment R8 re-derived the same
table against the changed trunk layer, where the value is 231.97. Nothing was wrong with the entry:
a pattern pinned to one measurement dies at the next re-measurement, silently claiming a resolved
request was dropped. It now matches the SHAPE of the change instead — a two-decimal onset, which is
what the round after this one adopted precisely because one decimal leaves 0.05 of margin against a
0.100 s tolerance. At `d9abef5` every onset was one decimal (`19.0`, `297.0`, `232.2`), so the
pattern still discriminates. **A `verify` is a rejection proof and takes the same care as one.**

## REQ-012 — two new pages were missing from the pages build

```request
id:          REQ-012
status:      APPLIED
target:      vite.pages.config.js
filed-by:    the wardrobe and fabric agents
filed-at:    2ec7db9
change:      Add `src/wardrobe.html` and `src/fabric.html` to the PAGES list.
evidence:    `npm run build` compiles ONLY `packages/testbed/index.html` — vite's default single
             entry — so a broken import in any other page passes a green build. `build:pages` is
             the only thing that proves the pages resolve, and a page absent from its list is not
             proven by it.
verify:      vite.pages.config.js /wardrobe/
```

A new page under `packages/testbed/` belongs in that list **on the same commit**.

## REQ-013 — the toggle fingerprint was blind to most of the render state

```request
id:          REQ-013
status:      APPLIED
target:      packages/testbed/src/alive.js
filed-by:    the gate-hardening agent
filed-at:    2ec7db9
change:      Expose a render-state entry point that walks every readable property of the renderer
             and the scene, deny-by-default, as a SEPARATE object from `shadingState()`.
evidence:    The fingerprint did not include `toneMappingExposure`, so a flag could move the
             exposure and the toggle gate would report the scene unchanged.
verify:      packages/testbed/src/alive.js /renderState/
```

Kept separate from `shadingState()` deliberately: `?shadows=0`, `?aa=off` and `?scale=1` legitimately
move render state and would have read as collateral inside an exact entity-set comparison. Two
questions, two objects.

## REQ-014 — the gate runner needed an npm entry point

```request
id:          REQ-014
status:      APPLIED
target:      package.json
filed-by:    the wardrobe agent
filed-at:    2ec7db9
change:      Add `selftests`, `verify:glb` and the wardrobe build script.
evidence:    A runner nobody can find is a runner nobody runs; the glb verifier had been rediscovered
             from LEARNINGS Part 3 in three separate rounds.
verify:      package.json /"selftests"/
```

## REQ-015 — the byte-identity overclaim needed a rule, not a correction

```request
id:          REQ-015
status:      APPLIED
target:      docs/measured-claims.selftest.mjs
filed-by:    the plate re-measurement agent
filed-at:    2ec7db9
change:      A REPRO rule that holds every "one PNG / byte-identical" phrase in the documents to the
             `plates` fence's own `bitident=` and `worst=` fields.
evidence:    103 loads over seven runs of the shipped default returned 671 of 1053 pairs
             bit-identical, worst delta 2/255 on 164 px of 19,660,800 — and two runs of thirty loads
             on the same build an hour apart gave twelve distinct digests and then one. Three
             agreeing loads was an observation of one run written down as a property of the build.
verify:      docs/measured-claims.selftest.mjs /REPRO/
```

## REQ-016 — `PROGRESS.md` carried the withdrawn byte-identity claim twice

```request
id:          REQ-016
status:      APPLIED
target:      docs/PROGRESS.md
filed-by:    the plate re-measurement agent (`cd2e567`, "DIFF REQUEST, not mine to edit")
filed-at:    cd2e567
change:      Replace "three loads, one PNG, sha256 d3c9946f73e5eaa1" at the fourth-pass header and
             in the Phase 3 row of the status table with the measured statement: a modal digest, a
             residue, and gate stability rather than byte identity.
evidence:    `measured-claims.selftest.mjs`'s REPRO rule counted both, printed both, and held the
             backlog at a ceiling of 2 so a third would go red. The ceiling is lowered to 0 by
             REQ-017 in the same change.
verify:      docs/PROGRESS.md /gate STABILITY\s+rather than byte identity/
```

🎯 **"A correction filed in a report is not a correction made"** — `PROGRESS.md`'s own words, one
section above the sentence it failed to correct.

## REQ-017 — lower the byte-identity backlog ceiling once the backlog is empty

```request
id:          REQ-017
status:      APPLIED
target:      docs/measured-claims.selftest.mjs
filed-by:    the plate re-measurement agent (`cd2e567`)
filed-at:    cd2e567
change:      Lower `BACKLOG_CEILING` from 2 to 0 when REQ-016 lands, as that constant's own detail
             line instructs.
evidence:    A ratchet that is not lowered after the backlog clears is a licence to re-introduce two
             of the defect. The rule already prints "LOWER THE CEILING, the backlog shrank" when the
             count falls below it.
verify:      docs/measured-claims.selftest.mjs /BACKLOG_CEILING = 0/
```

## REQ-018 — LEARNINGS Part 3's gate-count table had drifted on every row

```request
id:          REQ-018
status:      APPLIED
target:      docs/LEARNINGS.md
filed-by:    this ledger round
filed-at:    af0e68d
change:      Re-derive the whole declared-versus-measured gate-count table from one clean run of
             `tools/run-selftests.sh`, not only the rows a reader noticed.
evidence:    The table was last measured at `c70195c` and every row it lists has moved since. It is
             the same shape as REQ-011: the failing row is evidence the table has drifted, and drift
             does not respect row boundaries.
verify:      docs/LEARNINGS.md /re-derived 2026-08-09/
```

## REQ-019 — `PUNCHLIST.md` said "diff request filed" for requests that had landed

```request
id:          REQ-019
status:      APPLIED
target:      docs/PUNCHLIST.md
filed-by:    this ledger round
filed-at:    af0e68d
change:      Point the two "diff request filed" notes at their ledger entries and state their
             resolved status, and correct the stale `alive-toggles.selftest.mjs` counts.
evidence:    PUNCHLIST:678 said `shadowCaster.color` appears zero times in the selftest — it appears
             five times at HEAD (REQ-006). PUNCHLIST:874's `SEQUENCE_FRAMES` request was superseded
             by the 600-frame horizon (REQ-007). Both read as live requests.
verify:      docs/PUNCHLIST.md /OPEN-REQUESTS\.md/
```

## REQ-020 — move the G2 sclera rect 56 px outboard

```request
id:          REQ-020
status:      REJECTED
target:      tools/critic/regions.lighting-portrait.json
filed-by:    the eye agent
filed-at:    2ec7db9
change:      Move the sclera rect from x 0.4033 to x 0.4656, which takes G2 from 0.7836 to 0.9483 at
             seed 1.
evidence:    Rendered as a 10x magnified crop with BOTH rects drawn and looked at: the shipped rect
             sits on the sclera, the proposed one sits ~56 px outboard on bare cheek skin outside the
             eye. And across seeds 1/42/4242/20260807 neither rect is stable — shipped passes 1 of 4,
             shifted passes 1 of 4.
reason:      Applying it would make G2 compare cheek against cheek and pass trivially, and the shift
             only re-rolls a lottery rather than fixing one: both rects pass exactly one seed of
             four. The shipped rect does clip the limbal ring, but that is not why G2 was red — G2
             was red because a fixed rect cannot gate an eye that moves. Rejecting a green-making
             change is the point of having a judge look at the crop.
verify:      tools/critic/regions.lighting-portrait.json /0\.4656/
anchor:      tools/critic/regions.lighting-portrait.json /0\.4033/
```

## REQ-021 — `PROGRESS.md`'s claim that `LightingRig.selftest.mjs` cannot be scripted

```request
id:          REQ-021
status:      APPLIED
target:      docs/PROGRESS.md
filed-by:    this ledger round, correcting a request filed at 82260d4
filed-at:    af0e68d
change:      Correct the sentence "LightingRig.selftest.mjs exits 0 even when it prints FAIL — it
             cannot be used in a script. Filed as a diff request." It measures false and it measured
             false on the day it was written.
evidence:    `process.exitCode = failures === 0 ? 0 : 1` has been the last line of that file since
             `7936f37`, 2026-08-07 — the day BEFORE the request was filed. Proven by execution, not
             by reading: `node packages/core/src/render/LightingRig.selftest.mjs --caster-gain=5`
             prints `FAIL: 85/98 checks green` and exits 1.
verify:      docs/PROGRESS.md /exits 1 on a failing run, proven by execution/
```

🚩 **A request is a claim and a claim gets verified.** This one cost nothing because nobody applied
it; had somebody "fixed" it, they would have changed working code to satisfy a false report. Verify
every entry in this file against the tree before acting on it — which is what the gate does for
status, and what a human still has to do for `change`.

---

# Open — filed in R7, and red in R8 if they are still here

## REQ-022 — `alive.html` needs `?nudge=<mm>` before the 1.6 px floor can be measured

```request
id:          REQ-022
status:      APPLIED
target:      packages/testbed/src/alive.js
filed-by:    the docs-audit agent (LEARNINGS §1.14a), re-filed by the ledger round
filed-round: R7
filed-at:    82260d4
first-filed: 82260d4, 2026-08-08
change:      Add `?nudge=<mm>`: offset the FIGURE laterally by a commanded amount, applied after the
             pre-roll and compatible with `?freeze`. It must move the body, not the camera — a camera
             nudge changes perspective and parallax and is a different stimulus.
evidence:    `sway.selftest.mjs:632` calls 1.6 px "the one empirical datum this project owns on the
             subject" and cites five lines inside a block PROGRESS marks superseded. Its two halves
             are out by 1.85x: 4.5 mm at the printed 0.6574 px/mm is 2.958 px, not 1.6. What the
             project actually owns is a BRACKET from two blind-judge observations — 0.48 px
             peak-to-peak reported as "the hands never move", and 10.6 px of pelvis excursion
             reported as a counted event. Every gate that cites 1.6 px is citing a number nobody
             measured.
verify:      packages/testbed/src/alive.js /session\.nudgeMetres/
anchor:      packages/testbed/src/alive.js /const frozen = query\.has\( 'freeze' \)/
```

The measurement it unblocks is ~20 captures and one afternoon: a 2AFC staircase at
d in {0.5, 0.75, 1.1, 1.7, 2.5, 3.8, 5.6, 8.4} mm (0.33–5.5 px, straddling the bracket), each pair
blinded through `blind_ab.mjs`, with a d = 0 catch trial so a judge that always says "different" is
detected. The 75%-correct point is the threshold. **Then write the answer in ONE place and make
every gate cite that place.**

## REQ-023 — `stage.js` should export its frame clock; two pages have copied it

```request
id:          REQ-023
status:      APPLIED
target:      packages/testbed/src/stage.js
filed-by:    the lighting agent, then independently the fabric agent
filed-round: R7
filed-at:    7936f37
first-filed: 7936f37, 2026-08-07
change:      Export `scheduleTask` (the MessageChannel macrotask pump) from `packages/testbed/src/
             stage.js`, then delete the copies in `packages/testbed/src/lighting.js` and
             `packages/testbed/src/fabric.js` and import it.
evidence:    A hidden pane throttles `setTimeout(fn, 0)` to 8 callbacks per second; the same
             measurement puts a MessageChannel at 553,921. Every capture page needs it, so the
             fifteen lines have now been written three times — each copy carrying the same comment
             explaining that it is a copy. LEARNINGS §1.25 on copies: they drift.
verify:      packages/testbed/src/frame-clock.js /export function scheduleTask/
anchor:      packages/testbed/src/stage.js /function scheduleTask/
```

Small, and filed anyway: three copies of a clock is how two pages come to render at different rates
and nobody notices until a plate disagrees with itself.

## REQ-024 — the wardrobe body and the shipped figure should be one artefact

```request
id:          REQ-024
status:      REJECTED
target:      packages/testbed/src/wardrobe.js
filed-by:    the wardrobe agent
filed-round: R7
filed-at:    3019623
first-filed: 3019623, 2026-08-08
change:      Rebuild `assets/figures/figure_g050.glb` with the per-vertex `_HIDE_*` attributes and
             point `BODY_URL` at it, retiring `assets/wardrobe/body/g050.glb`. Re-measure every gate
             that names the figure's sha256 in the same commit — do not carry the old numbers.
evidence:    Measured cost of the attributes: body 11,742,100 bytes against the nude 11,567,392, so
             +58,068 per garment as FLOAT32. Measured benefit of not merging: nothing — the runtime
             index rebuild already equals the baked build exactly (17,012 = 17,012 and
             21,380 = 21,380, identical as a 1 um centroid multiset). The split exists only because
             adding attributes changes the shipped figure's sha256 and every gate measured against
             it, which is a reason to sequence the change, not to avoid it.
reason:      REJECTED AS A REQUEST AND CONVERTED, on the entry's own advice: it is asset work with a
             gate-re-measurement cost, not a diff, and the ledger is the wrong home for it. It is
             now punch-list 9.21, where a sequencing dependency can be written down. The dependency
             is the reason: `307db6c` measured that garments do not survive identity — two body
             sliders drift the suit 106.887 mm — and the JS refit needs 22.6 KB of helper vertices
             shipped per garment because the exporter deletes 1,879 of the 1,885 it reads. Phase 10
             will rebuild the figure for that. Doing it twice re-measures every gate that names the
             figure's sha256 twice, and 10.1 landed in the same round this was filed, so the merge
             pass now has a date it can be attached to. Nothing is lost: 9.8's four foundation
             fragments already ride the wardrobe body, and the runtime rebuild is exact.
verify:      packages/testbed/src/wardrobe.js /const BODY_URL = new URL\( '\.\.\/\.\.\/\.\.\/assets\/figures/
anchor:      packages/testbed/src/wardrobe.js /const BODY_URL = new URL\( '\.\.\/\.\.\/\.\.\/assets\/wardrobe\/body\/g050\.glb'/
```

⚠️ **Sequenced against Phase 10 and converted to punch-list 9.21, R8.** `307db6c` measured that
garments do NOT survive identity — two body sliders drift the suit 106.887 mm — and the JS refit
needs 22.6 KB of helper vertices per garment shipped, because the exporter deletes 1,879 of the
1,885 it reads. 10.1 landed in R8, so the pass that rebuilds the figure for identity is now a real
item rather than a hypothetical, and this merges onto it.

## REQ-025 — `TRAAPost.js` routes the reader to a round report for a fix that landed

```request
id:          REQ-025
status:      APPLIED
target:      packages/core/src/render/TRAAPost.js
filed-by:    the ledger round
filed-round: R7
filed-at:    4a8dab3
change:      Replace "the diff request is recorded in the round report" with a pointer to
             `docs/OPEN-REQUESTS.md` REQ-009 and the file that answers it,
             `packages/core/src/render/MorphVelocity.js`. The paragraph above it, which bounds the
             failure mode as lost temporal detail rather than a smeared ghost, stays as written —
             it is still the correct account of what happens when the reprojection is wrong.
evidence:    The request landed as `MorphVelocity.js`, whose header opens "gives morph targets a
             previous-frame position, which three.js does not". The comment sends a reader to a
             document that does not exist in this repository, so the fix reads as outstanding.
verify:      packages/core/src/render/TRAAPost.js /OPEN-REQUESTS/
anchor:      packages/core/src/render/TRAAPost.js /recorded in the round report/
```

## REQ-026 — `Toksvig.js` says its request is unapplied; it was applied

```request
id:          REQ-026
status:      APPLIED
target:      packages/core/src/render/Toksvig.js
filed-by:    the ledger round
filed-round: R7
filed-at:    4a8dab3
change:      The section headed "Where this has to be applied, and why it is not applied here" is
             now false. Retitle it and point at the install site — `SkinMaterial.js`'s
             `material.roughnessNode = specularAntiAliasing ? filteredRoughness( roughness ) :
             roughness` — and at REQ-008. Keep the ownership reasoning: `render/` offers the node,
             the material installs it, and that division is still why the node lives here.
evidence:    `filteredRoughness` is imported and installed in `packages/core/src/material/
             SkinMaterial.js`. The file that offers the node is the last place in the repo still
             saying it has nowhere to go.
verify:      packages/core/src/render/Toksvig.js /OPEN-REQUESTS/
anchor:      packages/core/src/render/Toksvig.js /The round report carries the diff request/
```

## REQ-027 — `post.js` carries two more dangling round-report pointers

```request
id:          REQ-027
status:      APPLIED
target:      packages/testbed/src/post.js
filed-by:    the ledger round
filed-round: R7
filed-at:    4a8dab3
change:      Two comments, both now answered. At the `?backdrop=` sweep, "a sweep is what turns
             'darken the card' into a diff request with a number in it" — the number landed
             (REQ-010, `CARD_ALBEDO_FLOOR` and `BACKDROP_EMISSIVE = 0x070a0e` in `alive.js`), so
             cite it. At `?specaa=1`, "the round report carries the diff request" — it landed
             (REQ-008), so cite that. Both switches stay: they are the attribution mechanism and are
             worth more now that the fixes are default.
evidence:    G6 moved 0.00001 -> 0.0042 on the shipped default and `?cards=0` now reads the SAME G6,
             which is the sweep's own conclusion arriving. Neither comment knows.
verify:      packages/testbed/src/post.js /OPEN-REQUESTS/
anchor:      packages/testbed/src/post.js /round report carries/
```

## REQ-028 — `wardrobe.js` points at "the report" for REQ-024

```request
id:          REQ-028
status:      APPLIED
target:      packages/testbed/src/wardrobe.js
filed-by:    the ledger round
filed-round: R7
filed-at:    3019623
change:      "See the report for the diff request that merges them" becomes a pointer to
             `docs/OPEN-REQUESTS.md` REQ-024, which is where that request now lives and where its
             status is adjudicated.
evidence:    The request is real and still open; only its address is wrong. A pointer to a document
             that does not exist is how a live request becomes invisible, which is the defect this
             whole ledger exists to close.
verify:      packages/testbed/src/wardrobe.js /OPEN-REQUESTS\.md` REQ-024/
anchor:      packages/testbed/src/wardrobe.js /See the report for the diff request that merges them/
```

## REQ-029 — `capture.mjs`'s header still blames the hair cards for the capture residue

```request
id:          REQ-029
status:      APPLIED
target:      tools/critic/capture.mjs
filed-by:    the plate re-measurement agent (`cd2e567`)
filed-round: R7
filed-at:    cd2e567
change:      The file header's line "So the render is deterministic to within an alpha-to-coverage
             resolve on the two hair cards" must carry the narrowing the tolerance block 740 lines
             below already carries. Add the measurement's framing to the sentence and the literal
             cross-reference token `NARROWED AT 3840` so the two places can never again be updated
             one at a time.
evidence:    That attribution was measured at 350x600 on the MSAA-era default. Re-measured at
             3840x5120 on today's shipped default, 103 loads over seven runs: the TAAU path leaves a
             residue (671/1053 pairs bit-identical, worst delta 2/255 on 164 px of 19,660,800) and
             `?aa=msaa&grade=0` — which still has the cards and still has alpha-to-coverage — leaves
             NONE, 290/290 over 45 loads including two deliberately concurrent runs. There are two
             residues and the cards are the smaller.
verify:      tools/critic/capture.mjs /NARROWED AT 3840/
anchor:      tools/critic/capture.mjs /So the render is deterministic to within an alpha-to-coverage resolve on the two hair cards/
```

🚩 **A number that appears twice will be updated once.** The tolerance block was corrected in
`cd2e567` and the header was not, in the same file, in the same commit.

## REQ-030 — the MAGNITUDE clause hardcodes an inverse square and asserts neither half of it

```request
id:          REQ-030
status:      APPLIED
target:      packages/core/src/render/GroundContact.selftest.mjs
filed-by:    the ledger round (LEARNINGS §1.25q, third instance)
filed-at:    af0e68d
change:      Beside the caster oracle, assert the two properties the oracle's arithmetic depends on:
             `shadowCaster.distance === 0` and `shadowCaster.decay === 2`. Two equalities, in the
             same PREMISE block that already asserts the caster's colour. The same clause exists in
             `packages/core/src/render/LightingRig.selftest.mjs:1278` and needs the same pair.
evidence:    Both files compute `intensity x spotAttenuation / d²` under a comment reading "with
             `distance` 0 and `decay` 2 the distance term is a plain inverse square". Measured at
             af0e68d: `.decay` and `.distance` appear in neither selftest as an assertion — only in
             that comment and in `LightingRig.js:1073`, which sets them. Set `distance` to anything
             finite and three switches to a windowed falloff the oracle does not model.
verify:      packages/core/src/render/GroundContact.selftest.mjs /decay` 2 -> 1/
```

⚠️ **APPLIED by a concurrent agent, not by this round, and the entry is written that way on
purpose.** This defect was found here by inspection at `af0e68d` and, in the same hours, found
independently by the agent who owns those two files — whose working tree already scores the
injections: `shadowCaster.decay` 2 → 1 moves **41.64%** of a rendered statistic and `distance` 0 →
1.2 moves **79.47%**, both at 65/65 before the clause existed. That is the fourth time this round
that a defect surfaced twice before it surfaced once, and it is the reason the entry is adjudicated
against the **working tree** rather than against HEAD: the tree is what the integrator commits. **If
integration drops that agent's work, this entry goes red** — which is the mechanism doing its job,
not a false alarm.

Third time this pair of files has been caught by the same shape, and the previous two fixes are
what produced this clause. The comment is *correct*; that is what makes it invisible. **If a comment
states the condition under which a check is valid, it is an assertion someone forgot to write.**

---

# R8's entries

The R8 fan-out filed **34 diff requests and 26 docs corrections** across six agents. Most were
applied during integration and are recorded in the round's commits rather than here — a request the
integrator applies in the same pass is a diff, not a ledger entry. What is below is the residue:
work that was declined, deferred with a reason, or that belongs to a phase that has not started.

🚩 **One request was to file MORE entries, and it is refused on the gate's own terms.** The identity
agent asked for its five `docs/research/identity-sculpting.md` corrections and its `PUNCHLIST.md`
entry to be transcribed here as OPEN. All six were APPLIED during integration, and **the gate
REFUSES an OPEN entry whose change is present at HEAD** — `OPEN-STALE`, one of its seven red proofs,
on the stated grounds that *"an entry fixed incidentally by someone else is a stale entry, and a
ledger of stale entries is worse than no ledger."* Filing them would have turned the suite red to
record work that was done. The purpose behind the request — that a correctly-filed request must not
evaporate — is what the whole R8 request pass exists for, and it is met by applying them and saying
so, not by writing them down twice.

## REQ-031 — `Stage.js` should assert or document `renderer.shadowMap.type`

```request
id:          REQ-031
status:      OPEN
target:      packages/core/src/render/Stage.js
filed-by:    the lighting-gate agent
filed-round: R8
filed-at:    af0e68d
first-filed: af0e68d, 2026-08-09
change:      Assert or document `renderer.shadowMap.type`. `LightingRig.attachTo` sets
             `shadowMap.enabled` and deliberately does not touch `type`, because Stage owns the
             filter — but nothing in the repo asserts what it is, and three's
             `ShadowNode.getShadowFilterFn` selects the WHOLE shadow filter from it.
evidence:    `LightingRig.selftest.mjs`'s THE RENDERER FLAG clause proves `enabled` is set for a
             shadowing rig and not for a non-shadowing one, and states this as the limit it cannot
             reach. The neighbouring field is not cosmetic: `renderer.shadowMap.enabled` defaults to
             FALSE on the WebGPU path and `AnalyticLightNode.setupShadow` returns immediately when
             it is false, so the same shape one field over is a rig that builds a perfect caster
             casting nothing. This is the one hole R8's light-state closure explicitly declares it
             cannot close, and a declared hole with no entry is a hole nobody is carrying.
verify:      packages/core/src/render/Stage.js /shadowMap\.type/
anchor:      packages/core/src/render/Stage.js /this\.renderer = new WebGPURenderer\( \{/
```

⚠️ **The anchor is the renderer construction, not a shadow field, because `Stage.js` mentions
shadows NOWHERE** — measured, `grep -n shadow packages/core/src/render/Stage.js` returns nothing.
That absence IS the request: the file that owns the renderer has no opinion about the filter three
will select from `shadowMap.type`, and a default nobody wrote down is a default nobody can attribute
a plate to.

## REQ-032 — nothing ramps between the two mouth-corner caps

```request
id:          REQ-032
status:      OPEN
target:      packages/core/src/affect/ExpressionLayer.js
filed-by:    the R8 integrator, out of the affect agent's ExpressionBank request
filed-round: R8
filed-at:    af0e68d
first-filed: af0e68d, 2026-08-09
change:      Read `context.shared.speaking` and ramp the corner cap between `MAX_CORNER_OFFSET` and
             `MAX_CORNER_OFFSET_SILENT` rather than switching. Both halves of the mechanism landed
             in R8 and neither is wired: `figure/ExpressionBank.js` now takes a `cap`, and
             `voice/VisemeLayer.js` now publishes `shared.speaking`. `ExpressionLayer` still clamps
             unconditionally to `MAX_CORNER_OFFSET`.
evidence:    Measured on figure_g050: `mouthSmileLeft` travels 18.68 mm at weight 1, so the 0.35 cap
             delivers 6.54 mm and discards 12.14 mm. That is the single largest measured reason a
             settled joy renders as polite rather than joyful, and punch-list 5.7's critic gate is
             expected to turn on it. The cap's own stated reason — keeping the viseme legible
             underneath — does not apply when nothing is speaking.
             ⚠️ RAMP, do not switch: `MAX_CORNER_OFFSET_SILENT` is 1.0 against 0.35, so a hard
             switch pops a smile 12 mm the instant speech starts. The ramp constant is not measured
             and needs one; a viseme onset is ~40-80 ms.
anchor:      packages/core/src/affect/ExpressionLayer.js /MAX_CORNER_OFFSET/
verify:      packages/core/src/affect/ExpressionLayer.js /shared\.speaking|MAX_CORNER_OFFSET_SILENT/
```

## REQ-033 — the foundation layer is built at one identity out of five

```request
id:          REQ-033
status:      OPEN
target:      tools/figure-pipeline/README.md
filed-by:    the R8 integrator, out of the wardrobe agent's own openConcern
filed-round: R8
filed-at:    af0e68d
first-filed: af0e68d, 2026-08-09
change:      Build the four foundation garments at g000 and g100 as well as g050 and record the
             clearance and coverage the build reports for each, in the README's measured table.
             The command is the documented one with `--gender 0` and `--gender 1`; about 25 s a
             figure.
evidence:    9.8 ships with `assets/wardrobe/foundation_*/g050.glb` and nothing else. The claim
             that the shells fit every identity by construction is an argument FROM the
             construction — they are cut from the basemesh AT the requested identity, so there is
             no fitting step to drift — and it is not yet a measurement. The build already has the
             instrument: it FAILS on a shell that folded through the body, on a standoff outside
             [0.05 mm, 2x the cut offset], and on any decency-floor combination that leaves a
             region uncovered, and it fired three times while 9.8 was being built.
anchor:      tools/figure-pipeline/README.md /--foundation/
verify:      tools/figure-pipeline/README.md /foundation_bra.*g000|g000.*foundation_bra/
```

## REQ-034 — the defect table has two sets of pixel figures and one page

```request
id:          REQ-034
status:      OPEN
target:      packages/testbed/src/light-defects.js
filed-by:    the R8 integrator
filed-round: R8
filed-at:    af0e68d
first-filed: af0e68d, 2026-08-09
change:      Re-measure all fourteen switches on `alive.html` at the recipe the seven objective
             gates use — `?bare&freeze&seed=1&capture`, 3840x5120, 60 steps at 60 fps, dpr 1 — and
             put that column beside the existing `lighting.html` one in this module's table, each
             labelled with its page, framing and step count.
evidence:    R8 wired the switches onto `alive.html` and spot-measured three of them at 900x1200
             portrait: `statedefect=decay` moves 29.21% of samples at worst Δ16/255 there, against
             96.11% / Δ70 on `lighting.html` at body framing and 41.64% / Δ8 as an earlier verifier
             reported on `alive.html`. Three numbers, three recipes, one mechanism. A defect's pixel
             footprint is a property of the plate (LEARNINGS §1.20), so none of the three is wrong
             and none of them answers the question a judge asks. One table, one recipe per column.
anchor:      packages/testbed/src/light-defects.js /% of frame moved/
verify:      packages/testbed/src/light-defects.js /3840x5120/
```
