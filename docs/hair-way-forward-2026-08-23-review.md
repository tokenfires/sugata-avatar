# Review of `hair-way-forward-2026-08-23.md` — what to take, and what not to execute

**Written 2026-08-23 at HEAD `35ee6fc`.** A verification pass over the outside review that sits
beside this file. Every `[M]` citation in that document was checked against the tree, and its three
central arguments were given to independent adversaries told to refute them.

**Method:** 38 claims across five disjoint clusters (lighting, BSDF, temporal resolve, harness,
generator), then three adversarial lenses (the rig argument, the process argument, the sequencing).
Eight agents, 304 tool calls, 18.5 minutes.

**Result: 24 CONFIRMED, 7 MISLEADING, 6 WRONG, 1 UNVERIFIABLE.** All three adversaries returned
"does not hold" on the plan. All three independently named the *same* section as its strongest idea.

> 🎯 **THE ONE-LINE VERDICT.** The diagnosis is worth reading and one idea in it is worth acting on.
> **The five-move plan in its §6 must not be executed as written**: its first move is refuted by a
> file it lists as read, its §5 contains a clause that would flip an already-decided branch, and its
> §7 proposes importing third-party assets on an inverted licence claim into a public MIT repo.

---

## 1. 🔴 The four things that must not be executed as written

### 1.1 §5's "apply it as written" would flip the primitive decision

The review closes §5 with: *"Note the decision rule's clause already updated to measured parity
(+1.46/+1.71 ms) `[M, addendum]`; apply it as written."*

**That is the renegotiation that was proposed, refused and retracted on 2026-08-22.** `f5d50d8`:

> 🔴 AND THE DECISION AGENT CAUGHT MY OWN INSTRUCTION. I told it to apply the rule at the
> re-measured parity figure rather than at the pre-registered 2.0… It pushed back: *"renegotiating
> in the conservative direction is still renegotiating, and it establishes the precedent."*
> Correct… Applied as written above.

Ratified at `docs/CHECKPOINT.md:1162-1165`. **And it is decision-flipping rather than cosmetic:**
`f5d50d8`'s own table has crop01 at 8,832 strands, 1920×1080, at **1.870 ms — PASS against 2.0 with
6.5% margin**, which is the measurement branch (b) rests on. Under 1.46/1.71 the same figure
**fails**, and the branch falls to (c).

**The correction:** the registered threshold is **+2.0 ms p50** and it governs. The addendum's
downward revision was refused and must not be applied; the parity reproduction failure is filed
separately, exactly as it was.

⚠️ The addendum is also this review's own §7 argument turned on itself — it still reads as live
instruction in the spec with no superseded-by line, which is how it got quoted as current.

### 1.2 Move #1 is refuted by a file the review lists as read

§6 ranks *"patch the temporal resolve for thin features"* first, at ~1 day, on the premise that the
finding *"sits untouched since it was written."*

The mechanism is real and every line number checks out — `TAAUNode.js` does gate the thin-feature
lock behind a two-sided depth test at `:743/:744`, invalid history does reset the accumulator at
`:751`, and dithered coverage does change depth in both directions at exactly the hair pixels.
**The finding did not sit untouched. It was executed and refuted.**

`packages/core/src/render/HairVelocity.js:59-81` carries the sweep, red-proved on the same plate
first, at the 35° yaw where the defect is largest — four-frame temporal sd of the hair band:

| arm | sd |
|---|---:|
| shipped | 5.8333 |
| `depthThreshold` 5e-4 → 1e9 | 5.8420 |
| `hasValidHistory` forced true | 5.8332 |
| `currentFrameWeight` 0 | 5.8263 |
| variance clip removed | 5.8784 |
| lock forced 0 | 5.8335 |
| **reprojection velocity forced to zero** | **0.6669** |

Every knob *inside* the resolve is worth under 12%. **The reprojection velocity is worth 8.7×**
(against a 0° floor of 0.6604 at `:49`). The tax was a groom reporting 259.9 px/frame of
displacement it was not making, and it is fixed. `HairOIT.js:194-206` carries the matching
retraction of the same attribution.

⚠️ And the proposed patch has already been tested **in a stronger form than proposed**: because the
gate is `abs().greaterThan( this.depthThreshold )`, setting the threshold to 1e9 removes the
two-sided test entirely rather than making it one-sided. That arm is the 5.8420 row.

🔴 **Its most interesting sentence inherits the refutation.** The `[I]`-tagged inference that part of
the frostbitten primitive gap *"may be this resolve defect wearing a primitive's clothes"* was the
only idea in the document that put a cheap falsifiable confound under a DECIDED branch. It does not
survive: the confound was measured and it is not in the resolve.

Both `HairVelocity.js` and `HairOIT.js` appear in the review's own §0 "What I read" list.

### 1.3 The MakeHuman CC0 claim is inverted, in a public MIT repo

§7 proposes importing an artist-made groom as a control cell, on the basis that *"MakeHuman
community hair libraries are CC0; verify per-file."*

`docs/research/character-assets.md:38-39`, marked **verified** in this repo:

> ⚠️ Caveat, **verified**: community-uploaded assets on makehumancommunity.org are **not**
> automatically CC0. **Stick to the `makehuman_system_assets` pack.**

The CC0 grant is scoped to *core* assets. The default is the opposite of what the review assumes, so
"verify per-file" is carrying a false premise rather than a caveat. This repo is public
(`tokenfires/sugata-avatar`) and MIT, and `docs/CHECKPOINT.md:124` already records an
assets-versus-code licence split being got wrong once — the Sintel meshes are BlendSwap-licensed,
not MIT.

**The control-cell idea itself is good** (artist groom × our renderer × our rig isolates the shading
stack from the generator). It needs a licence-checked source, and no CC0 hair groom has ever been
swept in this project — a repo-wide grep for CC0 across the hair research returns zero hits.

### 1.4 "58 commits past a ceiling of 14" is 97 at HEAD

`git rev-list --count a20bfcb..HEAD` = **97**; `ROUND_COMMIT_CEILING` is 14 at
`tools/request-ledger.selftest.mjs:178`. The 58 is faithful to §14, where it was written, and 58 is
exactly the count at `18a348a` — but the document is headed "at HEAD `35ee6fc`", where the figure
reads as present-tense state and understates the overrun by 40%.

🎯 This is the review's own §7 lint proposal demonstrating its own necessity: a monotonically
growing counter quoted through an `[M]` tag is a stale number wearing a citation. The fence is now
~7× its ceiling and ~12× a normal round.

---

## 2. The claim ledger

**24 CONFIRMED.** Including every load-bearing number in §4.1's light-budget arithmetic: 81.83% of
forehead luminance beyond any shadowing algorithm, the rim at `#0f30ff` E16 (`LightingRig.js:612`),
`studio` frozen as the nine-scene anchor, `36ba35d` repairing the exterior rim, TT matching its
source to 5.7°, the 20–60 px silhouette halo, arc lengths 244 mm against Sintel's 101, byte-
reproducible bakes, crop01's buried front third, and `strand-time.mjs:317` on minima across clock
states. **The review read the record accurately far more often than not**, and its errors are
compression slips rather than fabrications.

**6 WRONG** — §1.1–1.4 above, plus:

- **"the pedestal fake keeps carrying 59–88% of the mass"** (§4.1). No measurement reports the
  pedestal at 88% of mass. 59.03% of the mass, 87.39% on the crown, is one quantity
  (`CHECKPOINT.md:557-558`). **88.8% is the fake's share of a top-decile CHROMA-GAIN delta**
  (`req-064-refuted-2026-08-23.md:67-83`); **88.4% is TT's share of scattering energy**
  (`CHECKPOINT.md:1103`). Two other pedestal shares on record use yet other denominators — 66% of
  mass *lightness*, 65.4% of the groom's *rise above its indirect floor*. The range as written spans
  at least two incommensurable statistics, which is this repo's own named defect class.
- The refuted `[I]` clause in §6.2 (see §1.2).

**7 MISLEADING**, each faithful to a source but wrong at the join:

| § | as written | the correction |
|---|---|---|
| 4.1 | shadowable budget "17.55%, groom removes 96–100%" | ceiling is **18.54%** (17.55 + 0.98 pp GTAO-reached ambient); groom removes 17.82% = **96.1%**. The 100.1% is a separate chest measurement against a 26.17% ceiling. Conclusion (occlusion saturated, ~0.7 pp left) survives. |
| 2.2 | tint hack "ceiling measured at 1.0927×" | 1.0927× bounds what the **depth input** can move slide 39's **luminance** inside its form. Not a tint ceiling and not a ceiling on the hack: sweeping `scatter` 0→4 moves encoded p50 6.7×. The tint-side figure is 1.0096× against 11.72× with TT on. |
| 4.2 | "p95/p50 1.872 → 4.291 with a near-axis source" | `hair.md:1301-1304` retires the baseline itself — *"the 1.872… does not reproduce on this build."* The light is **12° off** the camera axis, not near-axis. And the delta bundles two changes: fake-off **alone** gives 3.286. |
| 4.1 | "REQ-064's refutation points here" (at the rig) | The refutation rules the rig out: *"That is the next lever, and it is a MATERIAL change rather than a rig one."* §4's rig case stands on §7's light budget, not on REQ-064. |
| 2.4 | "twice in three days… (`5d2fc78`, `35ee6fc`)" | The recurring shape is real and the diagnosis exact, but neither cited commit produced confident numbers. The two genuine silent-bald events are **`04fe601`** and **`35ee6fc`**. |
| 5 | ladder worked "precisely because every arm shared one page class" | Over-attributed. The operative cause is **duty cycle** (burst submission): v1/v2 shared a page class and still spread 151% bimodally. The ladder itself round-robined 720×900 against 1920×1080 and held ~1%. |
| 5 | Apple-Silicon clocks uncontrollable → cross-page A/B invalid | Plausible premise, unsourced, and the inference is over-strong. `frame-budget.mjs:182-188` names a **measured** non-clock cause of the same symptom. |

---

## 3. ✅ What survives, and is worth acting on

### 3.1 §2.3 — art constants versus physics claims, and the studio-freeze deadlock

**All three adversaries picked this independently as the review's strongest idea, and it survived
every attempt to break it.** It is the only genuinely new structural claim in the document.

The observation: a correctly-attributed cause — the `#0f30ff` rim at irradiance 16, unshadowed — is
sitting unrepaired not because anyone doubts it, but because a freeze policy owns the constant. And
there is a natural experiment already in the tree: `36ba35d` attributed exterior-scene hue failures
to that same rim by single-light removal (park floor hue 219.0 → 138.4 with `rim.irradiance:0`,
against 233.7 with `?noenv`) and those scenes improved immediately. Studio's rim did not get that
repair because it is load-bearing for calibration.

Its sharpest sentence, which is worth quoting into the record:

> Freezing an asset is calibration hygiene; freezing its lighting forever is how a known-bad rim
> survived four rounds of correct diagnoses.

🎯 **AND IT IS ALREADY FILED.** `docs/OPEN-REQUESTS.md` REQ-078 is that owner call, measured and
unmade, with `db4eb78` behind it. The review's best idea is a request that already exists. **This is
an owner decision, not a round.**

### 3.2 §3.3 — pairwise judging

Methodologically sound and independent of everything else. Absolute LLM ratings are noisy; forced
pairwise comparisons aggregate robustly (Bradley–Terry / Elo with error bars). The control run is
the right evidence: six of six judges refused "same-tier" for a **known-good** asset, so the
absolute scale has no usable resolution at this end. The rewritten `JUDGE-BRIEF.md` already demotes
judges to describers; ranking is the next step, and the decoy axes stay.

⚠️ **§3.2's reference harness does NOT survive with it.** It re-proposes what
`tools/critic/hair-reference.mjs` already tried: that tool retracted its figures twice and its
clauses **stand down on a clean clone**, because the plates are SHIFT UP / SIE copyright and
`.gitignore` refuses them — the red declared in `docs/RED-GATES.md:73` this morning. The proposal
does not engage that constraint, and its supporting assertion — that region-level statistics are
"comparatively illumination-tolerant" — is asserted rather than measured.

### 3.3 §5's interleaved-pair design, as a method rather than a plan

Toggling attach/detach inside one running page so both halves of a pair share the immediately
preceding clock state **by construction** is better than the per-arm hygiene `35ee6fc` added, and
should be the standing method for any future perf gate.

⚠️ It does not clear P0's actual blocker. `35ee6fc`: *"WHICH RESOURCE 404s IS NOT YET NAMED…
`/assets/hair/bob01/g050.glb` serves 200."* A redesign that begins by re-implementing the harness
does not find that 404. **Name the 404 first; then adopt the interleaved design.**

### 3.4 Move 3 is four projects wearing one row

"Hair-eval rig + TT-on + fibre art pass, 1–2 days + gates" bundles: a new declared baseline;
reopening TT; the fibre art pass (REQ-078, an owner call); and a gate re-baseline whose cost the
review understates as *"one more baseline table, not a recalibration of the world."*

`tools/critic/scene-gates.mjs:33-44` says otherwise in its own voice: *"Every committed gate assumes
the studio rig. Put the same figure outdoors and four of seven go red — and **TWO OF THOSE REDS ARE
THE GATE'S OWN FRAME**"*, with `regions.lighting-portrait.json` hard-coding `faceKey` to the studio
key's +42°, and *"No amount of re-lighting repairs that."*

---

## 4. ⚠️ Two corrections this review earns against OUR OWN record

**This is the review's most valuable single effect, and it is not one of its arguments.** Verifying
its claims forced a re-derivation that found an error in work committed hours earlier, in this
repository, by the round that refuted REQ-064.

### 4.1 🔴 The refutation quoted a STALE FIBRE COLOUR throughout, and its pre-check used the wrong transfer

`docs/research/req-064-refuted-2026-08-23.md`, `LightingRig.js`'s `GLINT_LIGHTS` block,
`tools/critic/hair-glint.mjs`'s header, REQ-064's REJECTED reason and commit `516a1eb` all quote a
**`#150F17`** fibre. `docs/CHECKPOINT.md:66` is explicit that this is wrong:

> **The albedo was a physical error, now fixed.** `#150F17` is R21 G15 B23 — blue above red.

The shipped constant is `HAIR_BASE_COLOUR_HEX = 0x1A0E0C` (`HairMaterial.js:283`), a warm brown. The
stale hex was inherited from REQ-064's own entry text, which predates the correction, and carried
forward without being re-derived. The CPU-mirror pre-check compounded it by linearising with gamma
2.2 instead of the sRGB EOTF.

Re-derived on the shipped constant:

| | published | corrected |
|---|---:|---:|
| TRT relative chroma | 0.4981 | **0.6712** |
| TRT hue | not stated | **7.1° (red)** — the stale fibre gives **283.7° (violet)** |
| TRT share of an on-axis light's contribution | 19.0% | **25.9%** |
| absorption ceiling, mean | 0.022 | **0.01669** |

🎯 **The hue row is the one worth reading twice.** The refutation's claim that TRT is the lobe which
would warm the highlight toward copper is **correct for the shipped fibre**, and it was reached from
a computation that said the opposite. Right conclusion, wrong arithmetic — which is a worse position
than being wrong, because nothing in the round could have caught it.

⚠️ **Every MEASURED number in that round is unaffected**: 0.1141 codes, 88.8%, 644 px of 236,792,
decoy 0.004, drift 0.0000. Those came off the shipped renderer, which uses the shipped constant. What
was wrong is the analytic pre-check that shaped the sweep, and the hex quoted beside every figure.
All five sites are corrected.

### 4.2 The TRT ceiling is stronger than the refutation stated, and closes a door it left ajar

The adversary computed it more carefully than the refutation did.

`absorbTRT = pow(colour, 0.8/cosθ_d)` (`HairMaterial.js:1925` CPU mirror, `:3167` TSL twin). `cosθ_d`
is in (0,1], so the exponent `0.8/cosθ_d` is **minimised** at θ_d = 0 and the absorption term is
therefore **maximised** there. **`C^0.8` is a ceiling over every rig geometry that exists — a rig can
only move it down.**

Computed from the shipped `HAIR_BASE_COLOUR_HEX = 0x1A0E0C` (`HairMaterial.js:283`), linear
(1.0330e-2, 4.3914e-3, 3.6765e-3): ceiling (0.02578, 0.01300, 0.01128), mean **0.01669**. At θ_d of
30/45/60° the mean falls to 0.00897 / 0.00319 / 0.00032 — a **52× collapse by 60°**. And the studio
rig already sits near the ceiling: key elevation 18 gives θ_d ≈ 9° and **95.1% of maximum**; rim
elevation 26 gives ≈ 90.0%.

**So the entire headroom a new rig could buy on this term is +5 to +10%, against gate 2's 9×
shortfall.** The refutation said the ceiling is the fibre; this says it more strongly and closes the
"but under a different rig…" reading that §8 of the review proposes. TRT's closure is **not**
rig-relative.

⚠️ TT's closure is a different case and the review is right that it is rig-relative — the 91.21%
rim share and the 0.48% clear-path fraction are facts about *this* rig and *this* groom. But the
ceiling is measured either way: a physically-correct TT recovers at most the other 8.79%, warm, worth
about 2% of the mass. A new rig does not change what TT is worth; it changes whether TT is *violet*.

---

## 5. 🚩 How to use an outside review, on this evidence

The failure mode here is specific and worth naming, because it will recur with any reader who has
the repository but not the sessions:

**It cannot tell a LIVE finding from a CLOSED one.** Move #1 is a real mechanism, correctly located,
with correct line numbers — and already refuted. The refutation lives in a commit body and a file
header, which is exactly where this project puts its durable record, and a reader who greps for the
*mechanism* finds the finding without finding its retraction.

That is not a flaw in the reviewer. It is an argument for the review's own §7 proposal — machine-
readable status lines on instruction-bearing sections, with a lint gate — applied to **findings** as
well as to handoffs. Three of the six WRONG verdicts above (§1.1's addendum, §1.2's TAAU finding,
§1.4's commit count) are all one shape: **a superseded statement that still reads as current.**

**The usable protocol: take its framing, verify every number.** One structural idea (§2.3) that the
project had not articulated, against 13 of 38 citations that do not survive checking, is a good
trade — provided the checking actually happens before anything is executed.
