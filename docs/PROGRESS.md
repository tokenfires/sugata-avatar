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

Last updated: 2026-08-07 — Phases 0–2 built, aliveness gate iterating.

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
| 2 | **Ocular + idle** — blink, saccade, VOR, breath, sway | **built; gate failing, iterating** |
| 3 | Rendering — skin, eyes, hair, cloth, lighting, post | not started |
| 4 | Speech — viseme timeline, TTS, coarticulation | not started |
| 5 | Affect — PAD, WASABI activation, AU mapping, mic-in | not started |
| 6 | Body motion — gesture, posture, IK, physics | not started |
| 7 | Runtime API and testbed | not started |
| 8 | Blind critic loops until same-tier | not started |

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

**All four were fixed (commit `Sway becomes an ankle-rooted pendulum`).** Current gate result:

**PORTRAIT: PASS. FULL BODY: FAIL.**

The remaining failure is precise and is *not* a bug — it is a modelling disagreement:

- Weight shifts fire at **0.28/min**, so **7 of 12** ninety-second windows contain none at all.
- When one does fire it moves the body ~4.5 mm ML — **1.6 pixels** at full-body framing.
  Side-by-side plates before and after a shift are indistinguishable.
- Cause: `POSTURE_HEAD_TRANSFER = 0.20` bounds the contrapposto blend to 0.077 of the pose, so a
  shift buys articulation (hip roll, lumbar counter-bend, free-knee flexion) but almost no travel.
  Duarte's 22 mm ML COP shift is ~a fifth of a full weight transfer; the two budgets disagree by
  ~2.7×. Raising the coefficient would move the validated head-RMS gates, so it was documented
  rather than changed.

### 🔜 Next actions, in order

1. **Resolve the `POSTURE_HEAD_TRANSFER` disagreement** (Phase 2 full-body gate). Either raise it
   and re-validate the head gates, or accept that weight shifts are articulation-only and raise
   the *event rate* instead. This is the last thing between here and the Phase 2 gate.
2. **Phase 3 rendering** — the eyes and skin will read as dead until the eye and skin shaders
   exist. That is expected and was correctly excluded from the motion gate. `3.3` (eyes) has the
   best effort-to-impact ratio in the whole project: ~40 lines of TSL.
3. Open Phase 0 items: `0.4`/`0.5` (Anny morph pair + vertex-order diff), `0.9` (hair perf spike),
   `0.11` (faceunit visual check at gender extremes).

### Known open leads, recorded so they are not rediscovered

- **Sway mean resultant velocity measures 22.0 mm/s** against Quijoux's 11–20 eyes-open. Found
  while adding the measurement; deliberately left as a note rather than a gate, because it is a
  property of the pre-existing balance-band spectrum, not of the pendulum change that exposed it.
  Closing it means slowing the upper noise band and re-running the f95 gates.
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
