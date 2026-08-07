# Sugata 姿 — progress and resume state

**Read on resume, in this order:**

1. **[`BRIEF.md`](BRIEF.md) — the original request, verbatim.** Everything else is
   interpretation. When interpretation and the brief disagree, the brief wins.
2. **[`LEARNINGS.md`](LEARNINGS.md)** — verification lessons, technical traps, and every command
   known to work. Read Part 1 before writing any gate; it is the accumulated cost of getting
   this wrong repeatedly.
3. **This file** — where the work stands.
4. **[`PUNCHLIST.md`](PUNCHLIST.md)** — the next item and its acceptance gate.

Update this file whenever a phase changes state. It is written to survive total context loss.

Last updated: 2026-08-07 — Phase 2 measured gates all green; POSTURE_HEAD_TRANSFER resolved.

---

## What this project is

A browser-based (Three.js) real-time 3D avatar system that gives an AI agent a body.
The agent configures its own identity — male, female, or anywhere between — and the
avatar embodies what the agent says and how it says it, across the full range of human
emotion, face and body.

**Name:** 姿 (*sugata*) — the figure, form, or bearing of a person.

## Decisions locked in (2026-08-06, with the user)

| Decision | Choice |
|---|---|
| Character source | **Asset-agnostic engine, parametric primary.** Verified: **MPFB2** (CC0 assets, build-time only — code is GPLv3). It ships canonical **ARKit-52 as CC0** in the `faceunits01` pack, plus 22 MS and 15 OVR visemes. Gender axis is **exactly linear**, so identity ships as one morph pair around an androgynous base. See [`research/base-mesh-verification.md`](research/base-mesh-verification.md) — authoritative, supersedes the two earlier asset docs. |
| Completion gate | **Same-tier, not better.** Harsh blind critics must place renders in the same visual family as real-time AAA character work, *and* the emote comparison must decisively beat Live2D/VTuber. Explicitly NOT "critics prefer ours over Stellar Blade" — that gate does not terminate. |
| Audio | **Full duplex.** TTS out drives visemes and prosody; live mic in drives listening behavior, gaze, and backchannel. |
| Consumer | **Portable library.** Clean runtime API any agent embeds, shipped with a demo harness. |

### Standing constraint from the user

Do not scope the vision down. Phase it instead — bigger vision means *more* design,
spikes, and isolated prototypes, not less ambition.

### The honest limit, stated up front

Stellar Blade's character fidelity is largely **art labor**: scan-derived multi-thousand-pixel
PBR texture stacks, artist-groomed hair, baked lighting. That content cannot be authored
from a terminal. What is reachable is **technique parity** — an engine whose shading and
animation are genuinely AAA-tier, so the ceiling is set by the asset fed to it rather than
by the renderer. On the animation/emote axis, beating Live2D is winnable outright: Live2D
is 2.5D mesh deformation with no true gaze, no real head rotation, no body IK, and no
physics beyond hair springs.

---

## Environment (verified 2026-08-06)

- Host: MacBook Pro, Apple M5 Max, 40 GPU cores, 128 GB unified memory, 2.4 TB free.
- Node v24.13.1, npm 10.9.8.
- LM Studio at `http://127.0.0.1:1234`, no auth. `qwen/qwen3.6-35b-a3b` loaded.
  Integration quirks and the model bake-off are documented in
  [`research/lm-studio-integration.md`](research/lm-studio-integration.md) — **read it
  before writing any LM Studio client code**, it contains two non-obvious blockers.
- Repo: git initialised on `main`. No remote configured.

---

## Phase status

**Order revised after research** — the ocular/idle layer has the highest perceptual return per unit
of effort and needs neither shaders nor the affect pipeline, so it moves ahead of rendering and lets
the emote critic loop run in parallel with renderer work.

| # | Phase | Status |
|---|---|---|
| 0 | Foundation — scaffold, asset pipeline, critic harness, spikes | **done** (0.4/0.5/0.9/0.11 open) |
| 1 | Body and identity — gender morph pair, ARKit bank, rig | **done** |
| 2 | **Ocular + idle** — blink, saccade, VOR, breath, sway | **built; all measured gates green, visual judgement outstanding** |
| 3 | Rendering — skin, eyes, hair, cloth, lighting, post | not started |
| 4 | Speech — viseme timeline, TTS, coarticulation | not started |
| 5 | Affect — PAD, WASABI activation, AU mapping, mic-in | not started |
| 6 | Body motion — gesture, posture, IK, physics | not started |
| 7 | Runtime API and testbed | not started |
| 8 | Blind critic loops until same-tier | not started |

### 2026-08-07, later — the POSTURE_HEAD_TRANSFER disagreement is resolved

**It was not a tuning disagreement. It was a frame-of-reference error, and the coefficient was out
by 8.3×.** The section below is kept as the record of how it was diagnosed; what follows supersedes
its conclusion.

Static equilibrium decides the coefficient rather than leaving it to be tuned: a body that is not
accelerating has no net moment, so the ground reaction force acts along a line through the centre
of mass, and its point of application on the floor — the centre of pressure — sits under it.
Duarte's "shifting" is, in his own words, *"a fast displacement of the average position of COP from
one region to another"*: a change in the **sustained mean**, so the identity applies. A 22 mm
centre-of-pressure shift IS a 22 mm centre-of-mass shift.

So the model is re-rooted the same way the pendulum was: every amplitude is now stated in
centre-of-pressure metres, the new `figure/BodyMass.js` says where the centre of mass is for a
given pose, both the lean and the contrapposto blend are **solved** so the centre of mass lands
where the literature says, and **head excursion is an output**. Measured on figure_g050:

| quantity | measured | was |
|---|---|---|
| head travel per unit centre-of-mass travel | **1.676** | assumed 0.20 |
| contrapposto response per unit blend | COM 38.0 / −40.7 mm, head 57.1 / −63.3 mm | head only |
| lateral postural events per minute | **1.51** | 0.28 |
| balance band, centre-of-pressure RMS | ML 3.05, AP 4.87 mm (medians, 900 s) | applied as head excursion |
| composite centre-of-pressure RMS, 900 s | ML median 11.63, AP median 8.22 mm | — |
| worst sole slide over 900 s | **0.17 mm** | 0.54 mm, then 2.49 before the pivot fix |

Four further defects were found in the same pass, each independently confirmed:

- **The amplitude draw.** `|N(22, 38)|` has a mean of 35 mm, not Duarte's 22 — the layer drew
  shifts 60% too large. A reported SD exceeding its mean on a positive quantity means the
  distribution is *skewed*; it is now lognormal matched on both moments.
- **Fidgets are weight shifts too.** Duarte separates fidget from shift on whether the body
  *returns*, not on whether it loaded a leg. Only shifts relayed, at 0.30/min, which is why 7 of
  12 ninety-second windows contained no postural event. Counting both gives 1.575/min — punch-list
  2.9's 1–1.5 and Cassell's independently measured 1.4–1.6.
- **A shift that springs back in 30 s is a fidget.** `SHIFT_RETURN_SECONDS = 30` against a 199 s
  inter-shift interval contradicted the paper being implemented, and cost most of the composite
  amplitude. It now holds for one interval.
- **Fidget direction was never drawn** — every fidget in the layer's history pushed the body toward
  the character's left.

**The elderly-cohort correction, applied in the same pass.** Quijoux's two sets are aged 71.3 and
78.7, and sway rises from about age 60 — so those are elderly reference values driving a young
avatar. That is the *same class* of error as the frame one and it points the other way; fixing one
and not the other would have made the result uninterpretable. No young-adult COP RMS in millimetres
was found to substitute, so the correction taken is to author at the force-plate column itself
(3.0 / 4.9 mm) rather than at the gate-band midpoint — the low end, which is the side the age bias
says to err on.

**Two more defects, found by the rewritten gates rather than by the code's author** — both the
same lesson, both now in LEARNINGS §1.11a/b: *when an amplitude changes by an order of magnitude,
re-audit every constant whose cost was argued as negligible.*

- **Foot planting broke by 40×.** `STANCE_RESPONSE_PROBE_BLEND` measured the contrapposto once
  and scaled linearly, justified by a genuine measurement — the *centre-of-mass* response varies
  0.3% across the range. True, and it does not cover the **ankle**, which rides an arc. At blend
  1.0 the linearisation left 2 mm of vertical: a foot off the floor. It is a table now.
- **`PIVOT_HEIGHT_FRACTION_OF_ANKLE = 0.5`** was a well-argued idealisation costing a tenth of a
  millimetre — until the lean grew six-fold and the sole, 29 mm below that pivot, slid **2.49 mm**.
  At the joint it is 0.16 mm and the sole is planted for free.

**Measured on screen** — lateral silhouette-centroid travel in pixels, `tools/critic/travel.mjs`:

| band | before, 90 s | after, 90 s | after, **420 s** |
|---|---|---|---|
| head | 4.92 / 26.6 | 5.55 / 31.7 | **9.91 / 69.5** |
| shoulder | 1.99 / 13.0 | 2.87 / 18.2 | **7.82 / 45.5** |
| hip | 1.45 / 9.5 | 2.02 / 12.9 | **6.00 / 36.6** |
| knee | 0.75 / 5.1 | 1.04 / 6.8 | **3.11 / 18.1** |
| ankle | 0.27 / 2.2 | 0.31 / 2.6 | **0.85 / 4.6** |

The 90 s columns measure the balance band almost alone — at 0.30 shifts/min a 90 s window cannot
contain a weight shift (§1.4, again), which is why the 420 s column exists. Against the failing
diagnosis's **1.6 pixels**, the hip now travels **36.6 px peak-to-peak**.

### The one shortfall, recorded rather than tuned away

The fore-and-aft composite sits at **8.22 mm** against Bates' lower quartile of 10.34. Two
calibration attempts are written up in `Sway.js`; the second is the informative one, because
widening the clamp moved it 0.05 mm and proved the clamp was never what held it down. Worked the
other way: Duarte's fore-and-aft processes carry 6.7 mm of the 8.22 where Bates would need 15.6 —
**2.3× his shift amplitude or five times his rate, both of which contradict the paper this layer
implements event by event.** Duarte is the process; Bates is a composite from another task. Where
they conflict the process wins, and the shortfall is asserted in both selftests as a known state
that goes red the day it closes. The lateral axis — the visible one — sits inside Bates' IQR.

### Where Phase 2 actually stands

The gate is **"reads as alive when silent and unshaded."** It has failed twice, both times with a
precise, useful diagnosis. What works and what does not:

**Works, measured:** blink asymmetry (33–67 ms closing, 167–267 ms opening — a 3–4× ratio, the
snap-shut/roll-open that Live2D ships backwards); Poisson blink timing at 25.8/min with sd ≈ mean;
45 saccades/min with a real fixation-duration distribution; arms decorrelated left-to-right at
r = −0.05; **no loop** — image self-similarity is minimal at the shortest lag and rises
monotonically to 15 s; no drift, jitter or accumulation over 20 s; arousal visibly changes the
*character* of motion (hand path ×2.16 vs excursion ×1.68 — faster, not just bigger, which is the
correct signature).

**Fails:** the lower body had **exactly 0.0000 mm** of motion (Sway modelled as a spine bend rather
than an ankle-rooted inverted pendulum); the face below the eyes never moved once in 20 s
(`ExpressionBank` exists, was never in the stack); the 20 s clip could not contain any postural
event; eyes sit pinned near their mechanical limit because the head does not share the load.

**All four were fixed (commit `Sway becomes an ankle-rooted pendulum`).** Gate result at that
point:

**PORTRAIT: PASS. FULL BODY: FAIL.**

⚠️ **The diagnosis below is superseded** — see the 2026-08-07 entry above. It was recorded as a
modelling disagreement to be settled by choosing between two budgets. It was neither: it was a
frame-of-reference error, and the coefficient was out by 8.3× rather than 2.7×. Kept verbatim
because how a wrong diagnosis was written down is worth as much as the right one.

- Weight shifts fire at **0.28/min**, so **7 of 12** ninety-second windows contain none at all.
- When one does fire it moves the body ~4.5 mm ML — **1.6 pixels** at full-body framing.
  Side-by-side plates before and after a shift are indistinguishable.
- Cause: `POSTURE_HEAD_TRANSFER = 0.20` bounds the contrapposto blend to 0.077 of the pose, so a
  shift buys articulation (hip roll, lumbar counter-bend, free-knee flexion) but almost no travel.
  Duarte's 22 mm ML COP shift is ~a fifth of a full weight transfer; the two budgets disagree by
  ~2.7×. Raising the coefficient would move the validated head-RMS gates, so it was documented
  rather than changed.

### 🔜 Next actions, in order

1. **Close out the Phase 2 full-body gate.** The modelling disagreement is resolved (see above);
   what remains is evidence, not design:
   - a **300–600 s** full-body capture — long enough to contain weight shifts, which 90 s cannot;
   - the portrait gate re-checked, because head excursion grew 1.65× and the portrait gate was
     passing before this change;
   - a blind visual judge on the long clip.
2. **Phase 3 rendering** — the eyes and skin will read as dead until the eye and skin shaders
   exist. That is expected and was correctly excluded from the motion gate. `3.3` (eyes) has the
   best effort-to-impact ratio in the whole project: ~40 lines of TSL.
3. Open Phase 0 items: `0.4`/`0.5` (Anny morph pair + vertex-order diff), `0.9` (hair perf spike),
   `0.11` (faceunit visual check at gender extremes).

### Known open leads, recorded so they are not rediscovered

- **The fore-and-aft composite shortfall** — 8.22 mm against Bates' Q1 of 10.34. Analysed above;
  closing it requires contradicting Duarte. Asserted as a known state in both selftests.
- **Sway mean resultant velocity measures 18.2 mm/s** against Quijoux's 11–20 eyes-open — inside
  the band, but at the *Wii-board* end while every amplitude is now authored at the *force-plate*
  end (11.0). Reported, not gated. It is the strongest remaining lead on the balance-band spectrum
  and closing it means slowing the upper noise band and re-running the f95 gates.
- **The anthropometry is Dempster (1955), eight elderly male cadavers.** de Leva's 1996 adjustment
  of Zatsiorsky–Seluyanov is the modern standard and is re-referenced to joint centres, which is
  exactly what `BodyMass` needs. It would move the head/centre-of-mass lever by perhaps 10% — a
  second-order correction to a defect that was 8×, but worth half an hour with the paper before
  anyone quotes the lever to three digits.
- **Quijoux's cohorts are elderly** (mean 71 and 79) and no young-adult COP RMS in millimetres was
  found. Mitigated by authoring at the low end of the band; not resolved.
- **Swallows render as lip compression only** — the asset has no throat articulation.
- Full-body lighting is a scaled portrait rig; rim and kicker stop reading at body scale.

Detailed per-item punch list lives in [`PUNCHLIST.md`](PUNCHLIST.md) once the design is
approved.

## Research — complete

All eight passes are in [`research/`](research/). Read in this order when resuming:

1. [`base-mesh-verification.md`](research/base-mesh-verification.md) — **authoritative on the
   character source**, supersedes the two earlier asset docs.
2. [`stellar-blade-look-spec.md`](research/stellar-blade-look-spec.md) — measured render parameters
   and the **six objective critic gates**.
3. [`affect-and-animation.md`](research/affect-and-animation.md) — PAD tables, WASABI activation,
   lipsync, gaze, physics. Contains a **licensing landmine** (NRC-VAD is non-commercial).
4. [`rendering-stack.md`](research/rendering-stack.md) and
   [`eyes-and-lighting.md`](research/eyes-and-lighting.md) — three.js reality, verified at r185.
5. [`body-motion-numbers.md`](research/body-motion-numbers.md) — implementable constants.
6. [`lm-studio-integration.md`](research/lm-studio-integration.md) — **read before any LLM client code.**
7. [`character-assets.md`](research/character-assets.md),
   [`generative-3d-and-template-bases.md`](research/generative-3d-and-template-bases.md) —
   superseded on the character choice, still useful for licensing landscape and the
   "six services died in eight months" record.

---

## Measured budgets (2026-08-07, this hardware)

Real GPU-timestamp measurements from `tools/spikes`, independently reproduced by a second agent.
**Use these; do not re-estimate.** Full detail and the fitted cost model in `tools/spikes/README.md`.

### Morph targets are essentially free

| Targets (13.7k verts, all weights animated every frame) | WebGPU Δ | WebGL2 Δ |
|---|---|---|
| 52 | 0.164 ms | — |
| **69** (52 ARKit + 15 OVR + 2 gender) | **0.219 ms** | 0.215 ms |
| 69 **with morph normals** | **0.504 ms** | 0.505 ms |

≈ 0.0032 ms per target, ~3% of a 16.6 ms frame at our full rig. **The blendshape budget is a
non-constraint** — a genuine surprise, since three.js iterates a `DataArrayTexture` layer per
target. Morph normals cost 2.3×; enable them only if the shading visibly needs it.

WebGPU and WebGL2 are within noise of each other here.

### RectAreaLights are the expensive part

Fitted cost model, WebGPU: **0.265 ms + 0.618 ms per Mpx lit, per light.**
(WebGL2: 0.539 + 0.682.)

| Lights @1080p | WebGPU Δ |
|---|---|
| **4** (key + fill + rim + kicker) | **3.604 ms — 22% of frame** |
| 8 | 7.421 ms — 45% of frame |

**The classic portrait rig costs about a fifth of the frame.** Affordable, and it confirms the
3–4 light budget. Eight is not viable alongside skin, hair and the post chain.

⚠️ Measured caveat: at 7–8 lights the WebGL2 tier goes non-monotonic under sustained load
(thermal drift across a suite run). The 4-light figure was stable in every run.

## Session log

### 2026-08-06 — design phase

- Confirmed empty repo, initialised git on `main`.
- Verified hardware and toolchain.
- **Spike: LM Studio affect inference.** Found two blockers and resolved both; selected
  `qwen3.6-35b-a3b` over `trinity-mini` and `gemma-4-26b` by measurement. Established that
  affect inference must be two-tier (reflex + appraisal) because the LLM pass costs ~0.7 s.
  Full write-up in `research/lm-studio-integration.md`.
- Ran eight design-research passes (see above). Key outcomes:
  - **WebGPU/TSL is forced as the primary path** — TAA, SSGI, SSR and temporal upscaling exist
    only there, and no velocity buffer exists in WebGL at all.
  - **MPFB2 confirmed as the character source**, and it ships ARKit-52 as CC0 — reversing the
    earlier "no blendshapes" finding. **The highest-risk assumption (headless operation) is
    resolved**: first-class supported path.
  - **The gender axis is exactly linear**, so identity is one morph pair around an androgynous base.
  - **Dominance is not readable from a static face** — it must be carried by posture, gaze policy
    and gesture amplitude. Structural argument for full-body.
  - **Animate early**: every timing constraint agrees, and AV-sync tolerance is asymmetric.
  - Stellar Blade decomposed into measured parameters, yielding **six objective critic gates**.
- Design spec updated with all of the above; phase order revised.
- **Next:** user approval on the spec, then write the implementation plan and punch list, then
  Phase 0.

---

## How to resume after a usage-limit interruption

1. Read this file, then `PUNCHLIST.md`, then the design spec in `docs/superpowers/specs/`.
2. Read `research/lm-studio-integration.md` before touching affect or LLM code.
3. `git log --oneline -20` for what actually landed.
4. Find the first punch-list item not marked done and continue there.
5. Update the session log and the phase table before stopping.

### 2026-08-07 — Phases 0–2 built; paused for an OS update

Four workflows, ~4.4M subagent tokens. Phase 0 and 1 complete, Phase 2 built with the portrait
gate passing and the full-body gate failing on one documented coefficient.

Shipped: deterministic byte-reproducible video capture; MPFB2 pipeline producing five figures
with 52 named ARKit morphs + 15 visemes across the gender sweep; Figure/ExpressionBank/Identity/
Skeleton; MotionStack; Blink, Gaze, Breath, Sway, IdleMotion, BodyIdle, FacialIdle, Pupil;
RestPose with contrapposto variants; the six objective critic gates.

Every defect this session was found by adversarial verification or visual judgement, never by
the agent that wrote the code. That pattern is documented in LEARNINGS.md Part 4 and should
continue.
