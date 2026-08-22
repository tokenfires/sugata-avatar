# hair-r31-ladder-ours — the strand prototype timed on OUR stack

Companion to `captures/hair-r31-ladder/`, which timed **frostbitten's** renderer. This one times
**ours**: `packages/testbed/src/strand-spike.js`, the camera-facing ribbon prototype built (and
deliberately never timed) by the previous phase — our `.tfx`, our `HairMaterial`, our shipped
`alphaHash`, three r185, WebGPU.

Repository at `4b6bbb08e4a5b9160d0c001159d753497756f4d1`. Every read is pinned against that sha.
The three prototype files were untracked at HEAD and are unmodified by this phase.

## TL;DR — the decision

**The pre-registered rule lands on branch (b): short hair on strands, the bob keeps cards plus a
strand flyaway shell.** The bob fails parity at every parity figure on the record, and it fails on
the coverage-independent part of the cost alone. The crop passes.

---

## 1. The number the round turns on

GPU timestamps (`?gputime=1` → `TimestampQuery.RENDER`), `?aa=off`, minus a `?strandlimit=0`
empty-frame arm so three's full-screen output blit is not counted as hair. **p05 over 240–720
samples per arm.** All arms round-robined inside one browser process, one tab each, nothing
navigated between arms.

### 1920x1080 — the comparand for the frame budget (2.0736 Mpx, same as the shipped 1080x1920 plate)

| bob strands | triangles | raster+shade | +shadow caster | frostbitten's hw raster+shading, same groom, same machine |
|--:|--:|--:|--:|--:|
| 496 | 14,881 | **0.477** | **0.537** | — |
| 992 | 29,761 | **0.797** | **0.894** | — |
| 2,480 | 74,401 | **1.607** | **1.692** | — |
| 4,960 | 148,801 | **2.347** | **2.554** | — |
| 11,408 | 342,241 | **3.641** | **3.954** | 1.370 |
| 24,800 | 744,001 | **5.365** | (not run) | 2.813 |

### 720x900

| bob strands | raster+shade | +shadow caster | frostbitten, same groom |
|--:|--:|--:|--:|
| 496 | **0.323** | **0.357** | 0.084 |
| 992 | **0.568** | **0.538** ⚠️ | 0.112 |
| 2,480 | **0.936** | **1.003** | 0.378 |
| 4,960 | **1.454** | **1.578** | 0.685 |
| 11,408 | **2.373** | **2.611** | 1.367 |
| 24,800 | **4.096** | (not run) | 2.796 |

⚠️ **One row is out of order and is not repaired.** `992 + shadow` at 720x900 reads 0.538 ms,
*below* the same groom with no shadow caster (0.568). A second draw of the same geometry cannot be
free. The shadow arms were run once, in one session, so this row has no cross-process comparand the
way the non-shadow rows do; treat the small-count shadow rows as carrying roughly the ±5% the
non-shadow ladder shows at 496 and 11,408 rather than the ±1% the middle of it shows. Nothing the
decision rests on is inside that band.

Fits, in the form `hair-r31-ladder` reports its own: **0.1498 ms per 1000 strands, intercept
0.4979 ms, R² 0.984** at 720x900; **0.1923 / 0.9255 / R² 0.940** at 1920x1080.

### The crop groom (`crop01`, exported this session at the same density multipliers)

The crop's scalp is the same head; its strands are **6.4x shorter** (arc median 0.0368 m against
the bob's 0.2320 m). Density multiplier 23 — the setting that gives the bob its 11,408 — gives the
crop **8,832**.

| crop strands | raster+shade @1080p | +shadow @1080p | @720x900 | +shadow @720x900 |
|--:|--:|--:|--:|--:|
| 3,840 (d10) | 0.989 | 1.074 | 0.823 | 0.887 |
| 8,832 (d23) | 1.590 | **1.794** | 1.393 | **1.519** |

## 2. Contention, and why the first two designs of this harness were thrown away

| run | gate spread (fixed 4,960-strand render at 720x900, in the same round-robin) |
|---|---|
| bob A | 11.68% / 12.93% |
| bob B | 15.96% / 12.26% |
| bob C (+shadow arms) | 11.10% / 10.51% |
| crop | 10.57% / **88.38%** |

The crop session's 1080p gate is the one wide row: a single round caught the boosted clock, which
is what a gate on a *minimum* looks like. The p05 rows it brackets are unaffected — the 4,960-strand
bob arm carried through that session as the gate's own file reads 2.3361 ms against 2.3443 / 2.3607
/ 2.3471 in the three clean sessions.

For scale, `hair-r31-ladder`'s own gate ran 12.20% / 18.83%.

**Cross-process reproducibility of the rows themselves is 0.6–8.8%, most rows near 1%** — the table
in `data/` prints all three bob runs side by side. The 4,960-strand bob arm appears in all four
runs including the crop session and reads 2.3443 / 2.3607 / 2.3471 / 2.3361 ms at 1920x1080, a
1.0% spread across four independent browser processes.

🔴 **THE MINIMUM IS NOT THE STATISTIC HERE, AND THAT IS A MEASUREMENT, NOT A PREFERENCE.** The
first harness took one `page.evaluate` per frame and reported a **151% gate spread** with nothing
else on the machine. The shape was not contention. Sorted, each arm's samples were tight except for
one or two isolated readings ~35% below everything else with a clean gap: `s24800` at 1920x1080 gave
min 3.4284 against second-smallest 5.2666, and `s11408` at 720x900 gave 1.4404 against 2.1442. The
ratios cluster near 1.5x across arms — a GPU clocking up — and it **did not visit every arm**
(`s11408` at 1920x1080 caught none of it: min 3.4128, second 3.5088). A minimum-of-samples would
therefore have quoted the boosted clock on some rows and the base clock on others, and the ladder's
slope would have been an artefact of which arm got lucky. It also produced a physically impossible
row: 24,800 strands *faster* than 11,408.

The cause was duty cycle. `__STRAND_RENDER__` awaits `onSubmittedWorkDone`, and the loop then
awaited a `mapAsync` before submitting again; the GPU was idle as much as busy and sat at its base
clock. **The fix is in `tools/strand-time.mjs`: submit `burst` frames back to back and resolve
once.** Gate spread fell from 151% to 11%, the bimodality vanished, and p05 became reproducible to
~1% across processes. p05 is quoted rather than min because the residual boost outliers still land
on one arm and not another.

⚠️ **The same fix is WRONG on `alive.html` and that had to be found rather than assumed.**
Burst-then-resolve reported 315 ms for the no-hair arm — not a slow frame: 315.686 / 24 = 13.15 ms.
`resolveQueriesAsync` groups passes by frame id and returns the last group's total, and on that page
a burst's twenty-four steps landed in **one** group. `frame-budget.mjs` resolves per frame there,
which is safe precisely because those frames are ~13 ms and the resolve is a few percent of the
period rather than half of it.

## 3. The comparison, in one table

| quantity | ms | where |
|---|--:|---|
| **today's cards, measured today** — Δ of `alive.html?hair=1` against no-hair, 1080x1920 | **+2.36 p50 / +2.21 p95** (control repeated at the far end: +2.19 / +2.11) | `data/frame-budget.json` |
| today's cards, as the spec's addendum records | +1.46 to +1.71 | `docs/superpowers/specs/2026-08-22-hair-frame-design.md:351` |
| today's cards, as §2 originally estimated | +2.03 | superseded |
| **our prototype, bob 11,408 + shadow, 1920x1080** | **3.954** | this capture |
| **our prototype, bob 4,960 + shadow, 1920x1080** | **2.554** | this capture |
| **our prototype, crop 8,832 + shadow, 1920x1080** | **1.794** | this capture |
| frostbitten's hw raster + shading, **our** groom, 11,408, this machine | 1.370 | `hair-r31-ladder/data/ladder-report.txt` |
| frostbitten's whole LOD-gated hair cost, our groom, 11,408, this machine | 4.215 (720x900) / 4.955 (1080p) | same |

🚩 **THE BRIEF'S "0.858 ms ON THIS MACHINE" IS A MIS-CITATION AND IT MATTERS.** 0.858 is
frostbitten's **published** Sintel figure. `hair-r31-ladder/README.md:47` carries it in a column
headed *their published*, beside the in-process reading of **0.9406**, and that README's own rule
is "all ratios in this document are taken against the in-process Sintel row, never against the
published numbers" — the machine was measured 22% slower than their publication at the start of
that session. On **this machine, on OUR groom**, their hardware raster + shading at 11,408 strands
is **1.3669 ms** (720x900) / **1.3701** (1920x1080).

Against the honest comparand, our ribbon path costs **1.9x** their hardware path at 720x900 and
**2.9x** at 1920x1080, same groom, same strand count, same machine. But it is measured against a
*part* of their pipeline: their **whole** LOD-gated hair cost on our groom is 4.215 / 4.955 ms,
against our 2.611 / 3.954. **Our ribbon prototype is cheaper than their complete hair pipeline at
matched density, and more expensive than the one stage of it that does the same job** — because it
buys the analytic-coverage-plus-hash path instead of their software OIT and tile binning.

## 4. The headroom, re-derived

Measured on the shipped page today, `?bare&freeze&seed=1&frame=body&capture&gputime=1`, 1080x1920
dpr 1, 400 samples per arm, control measured at both ends of the arm order:

| arm | p50 | p95 |
|---|--:|--:|
| no hair | 12.918 | 14.015 |
| no hair (repeat, far end) | 13.087 | 14.119 |
| **with hair (shipped card groom)** | **15.275** | **16.226** |

Against the 16.6 ms budget: **0.37 ms of p95 headroom with hair, 2.59 ms without it.**

✅ **The brief's warning is confirmed and the record's 2.6 ms is confirmed to be the NO-HAIR
figure.** My p95-with-hair (16.226) sits 0.06–0.15 ms **above** the 16.08–16.17 the previous agent measured,
so the two agree; the record's "~2.6 ms headroom" reproduces *exactly* — as headroom on the plate
with no hair on it (2.585 ms here). The number the decision has to be judged against is **0.37 ms**.

## 5. The rule, applied

The rule, fixed before any measurement:

> strand bob at PARITY WITH TODAY'S CARDS → (a) change the primitive for ALL hair;
> parity for a crop but not a bob → (b) short hair on strands, bob keeps cards plus a strand
> flyaway shell; neither, at any strand count with an acceptable silhouette → (c) not yet.

**I applied it at +1.46 to +1.71 ms**, the figure the spec's addendum records, *not* at my own
higher re-measurement of +2.11 to +2.36 — because the rule's clause is "parity", and applying it at
the larger of two candidate parities would let a slower primitive pass. Both verdicts are given
below; the stricter figure is the one the branch is taken on.

### Does the bob reach parity? **No — and not marginally.**

At 1920x1080 with its shadow caster, the bob's break-even against parity is:

| parity figure | break-even bob strands |
|---|--:|
| 1.46 ms | 2,047 |
| 1.71 ms | 2,531 |
| 2.11 ms | 3,683 |
| 2.36 ms | 4,403 |

Against the density the bob needs. The prototype's own census (previous phase, `?aa=off`, 720x900):
frame coverage goes 15.58% → 19.62% → 27.07% → 30.73% → 33.36% → 33.58% across 496 → 24,800, i.e.
**it saturates at 11,408**. The plates in `plates/` show it: at 2,480 the mass is see-through, at
4,960 it is visibly thin at the crown, at 11,408 it reads as a continuous mass. Even the most
generous parity figure buys 4,403 strands — below the count at which the bob stops being
transparent, and less than 40% of the count at which its coverage saturates.

**And most of the cost is not framing-dependent.** The spike frames the groom to fill the frame,
which is the worst case; the card Δ is measured on a body-framed avatar where hair is a fraction of the
frame. Differencing the two resolutions separates the coverage-independent cost from the per-pixel
one:

| arm | geometry-bound floor | per-Mpx |
|---|--:|--:|
| bob 11,408 + shadow | **2.001 ms** | +0.942 ms/Mpx |
| bob 4,960 + shadow | 1.134 ms | +0.685 ms/Mpx |
| crop 8,832 + shadow | **1.394 ms** | +0.193 ms/Mpx |

The bob at 11,408 costs **2.00 ms before a single pixel is covered**, at any framing, with the
deferred-stack integration, the OIT compositing and the dynamics all still unpaid. That floor alone
is 17–37% over the parity figure the rule is applied at (1.46–1.71). ⚠️ It is *not* over my own
higher re-measurement (2.11–2.36) — the floor is 5% under it — so the framing-independent argument
carries branch (a)'s refusal only at the applied figure. At my figure the refusal rests on the
measured rows instead, where the bob at 11,408 costs 3.954 ms against 2.11–2.36: 1.7x over, with
1.3 ms of that above the floor being real covered pixels the shipped frame would also have to pay
for at whatever fraction of it the hair occupies. Branch (a) is refuted on both readings; only the
*shape* of the refutation differs.

### Does the crop reach parity? **Yes.**

At the same density multiplier that makes the bob read (23 → 8,832 crop strands), the crop with its
shadow caster costs **1.794 ms** at full-frame 1080p framing, **1.519 ms** at 720x900, and its
coverage-independent floor is **1.394 ms**. Against parity at 1.46–1.71 that is inside on the floor
and at 720x900 and 5–23% over on the worst-case full-frame 1080p row; against my own measured
parity of 2.11–2.36 it is inside on every row. Since the shipped frame never has hair filling it,
the crop is within parity in the framing the rule is about. `plates/crop-720x900-s8832.png` shows a
dense, continuous cap — denser than the bob at 11,408.

### → **BRANCH (b).**

## 6. What I could not establish, and the one measurement that would settle it

⚠️ **THE STRAND NUMBERS ARE RASTER+SHADE(+SHADOW) ON A BARE PAGE; THE CARD NUMBER IS A WHOLE-FRAME
DELTA ON THE SHIPPED STACK.** Everything above compares a lower bound on the ribbon cost against a
fully integrated card cost. That asymmetry is generous to the prototype, which is why it is safe for
the branch-(a) refusal — the bob loses even so — but it is **not** safe for the branch-(b)
acceptance, whose margin (0.32 ms at my parity figure, negative at the stricter one on the
worst-case row) is smaller than the integration cost could plausibly be.

**The one measurement that would settle branch (b): render the ribbons inside `alive.html`'s own
deferred stack and take the same Δ-against-no-hair that the cards get** — same page, same framing,
same 1080x1920, same `frame-budget.mjs`. Until then branch (b) is the right call on the evidence
and its crop margin is provisional.

Two smaller gaps, named rather than glossed:

- **The parity figure itself is contested.** +1.46–1.71 (spec addendum, today, no capture path
  recorded) against my +2.11–2.36 (this capture, method documented, control reproduced to 1.3% at
  both ends of the arm order). I did not find the addendum's capture and could not reconcile them.
  The branch is unchanged either way.
- **The crop silhouette is my reading of a plate, not a blind judgement.** The prototype also
  renders pale and over-lit (`depthMapUrl` is null, so slide 44's exponential is a constant 1), a
  card artefact with no ribbon equivalent — so any look judgement on these plates is bounded.

## Files

```
data/strand-time-runA.json          bob ladder, process 1  (raw samples kept)
data/strand-time-runB.json          bob ladder, process 2
data/strand-time-runC-shadows.json  bob ladder + shadow arms, process 3
data/strand-time-crop.json          crop ladder + shadow arms, process 4
data/frame-budget.json              alive.html with and without its card groom
plates/                             every timed arm, plus the crop
tools/strand-time.mjs               the ladder
tools/frame-budget.mjs              the shipped-frame arms
```

The `.tfx` exports are **not in the repository** — the bob's six live in the session scratchpad and
the crop's two were written there by `tools/figure-pipeline/tfx_export.py` this session
(`--hair crop01 --gender 0.5 --strand-density 10|23`). If that scratchpad is cleared they must be
re-exported before any of this can be re-run.
