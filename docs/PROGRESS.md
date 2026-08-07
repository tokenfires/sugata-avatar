# Sugata 姿 — progress and resume state

**Read this file first when resuming.** It is the single source of truth for where the
work stands. Update it at the end of every working session and whenever a phase changes
state. It is written to survive a total context loss.

Last updated: 2026-08-06 — design phase.

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
| 0 | Foundation — scaffold, asset pipeline, critic harness, spikes | not started |
| 1 | Body and identity — gender morph pair, ARKit bank, rig | not started |
| 2 | **Ocular + idle** — blink, saccade, VOR, breath, sway | not started |
| 3 | Rendering — skin, eyes, hair, cloth, lighting, post | not started |
| 4 | Speech — viseme timeline, TTS, coarticulation | not started |
| 5 | Affect — PAD, WASABI activation, AU mapping, mic-in | not started |
| 6 | Body motion — gesture, posture, IK, physics | not started |
| 7 | Runtime API and testbed | not started |
| 8 | Blind critic loops until same-tier | not started |

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
