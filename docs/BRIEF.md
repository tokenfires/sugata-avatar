# The brief — verbatim

**This file exists so the original request survives context compaction unaltered.**

Everything else in `docs/` is interpretation. This is the source. When interpretation and this
file disagree, **this file wins**. Re-read it before any major decision.

---

## The request, exactly as given (2026-08-06)

> I want you to build an HTML/JS AI driven avatar system at the level of the most recent
> vtuber/live2d and styled like the Stellar Blade PlayStation 5 video game. It should be utterly
> perfect, visually beautiful, with every single thing done at AAA quality—from textures to
> physics to anything you could think of making the embodied presence of AI as humanly realistic
> as possible. An AI agent should be able to emote the full range of human emotions as a full
> body avatar based on anything they say and how they say it. Once built, this system should be
> usable by any AI agent to create an embodied version of themselves as they interact in real
> time with users. The AI should be able to create an avatar that is male, female, or combination
> of the two as an avatar that represents the AI's identity.
>
> Fan out sub-agents and have sub-agents tackle each one individually so that the avatar system
> is utterly perfect. You should /loop on each item and have a separate sub-agent check it
> visually to ensure it looks triple A. That separate sub-agent should be a really harsh critic,
> and if it doesn't look triple A, it should keep going.
>
> For testing, LM Studio is running and can be accessed via "http://127.0.0.1:1234", no
> auth/API key. Use the model "qwen/qwen3.6-35b-a3b" and load it if it is not loaded in LM Studio
> for your testing. Organize tasks in a document/punch list. You may encounter token or usage
> limits. Keep track of your progress and keep a background task running allowing you to resume
> once the 5 hour or weekly limit has been cleared. Use the web for sources and examples.
>
> Don't stop until each sub-agent is utterly wowed with the quality when compared with the actual
> Stellar Blade PlayStation 5 video game and the ability for an AI agent to appear, emote, and
> seem human in its responses and the way it represents itself in a full bodied manor via this
> avatar display system. It should literally compare them side by side blind and say which one
> looks better. It should literally compare how vtuber/live2d animate and emote side by side
> blind and say which one looks better. Do this in ThreeJS. /loop until it's utterly perfect.
> Fan out sub-agents and ultracode.

### One later correction from the user, also verbatim and binding

> The ask wasn't "involve the user in each decision and get approval for each step of the way".

**Read that as standing policy: build, don't gate.** Raise a concern in a sentence or two, state
the assumption, and keep going. Reserve blocking questions for things that would be unsafe or
useless-if-wrong to assume.

### A requirement the first reading missed, added by the user 2026-08-08 (R18)

> When we talk about avatars, the clothing options is as much a requirement as the avatar itself.

**This was an omission, not an extension.** It follows from three requirements already in the
table above and the punch list simply did not carry it. R2 asks for the level of current
VTuber/Live2D work, where outfit variants are definitional. R8 says the avatar represents the AI's
own identity, and clothing is most of how a person expresses identity visually. R4 says "anything
you could think of." What was built instead was a figure that can be male, female or anywhere
between, and is permanently naked. Phase 3.7 (`FabricMaterial`) was the only clothing line in the
whole document, and it is a shader.

The user's further direction, also binding:

> Let's not target vtuber clothes directly as they might come across as cartoon like if direct
> imports are made. We should be making our own for AI and users to use.

> This should not be taken as an "I only build this to the bare minimum specification". If this
> rises to the level of appearance, interactivity, and clothing choice at or above what exists in
> the same level and family as Stellar Blade, then you have correctly achieved the goal.

And three specifics from `reference/README.md`, all in Phase 9: a wardrobe screen where users
**select outfits or mix and match parts** into their own; the wardrobe **controlled by the AI
itself when the user allows it**, so it dresses daily the way a person does, with the user able to
**pin an outfit for consistency**; and a shipping set drawn from the reference the user supplied.

**Two items were added beyond what was asked**, both because they are correctness rather than
taste, and they are called out here so a later reader knows they were deliberate:

- **9.8, the foundation layer.** A mix-and-match screen can remove a top and `undress()` exists, so
  the avatar has to be decent in every reachable state. No reference exists for it anywhere in the
  638 images supplied; it is authored blind.
- **9.10, cultural and religious everyday dress.** The supplied reference contains nothing outside
  a Western wardrobe. For a system whose premise is an AI choosing how to represent itself, a
  wardrobe that can only represent one culture is a limit of the product, not of the art budget.

⚠️ **The licence finding that decided the "author our own" approach**, recorded so it is not
relitigated: Fab's EULA §6(b)(iii) forbids making Content available in "modeling tools that allow
works to be exported", §4(c) requires end users be restricted from extracting Content, both price
tiers grant identical rights, and every listing sampled from the reference seller carries
`isAiForbidden: true`. Booth has no machine-readable licence field at all. **The library consumes
what a user legally acquires; it never bundles.**

---

## Requirements extracted, with nothing added

Each maps to punch-list phases. If a phase does not trace back to a line here, it is scope creep.

| # | Requirement | Where it lives |
|---|---|---|
| R1 | HTML/JS, **ThreeJS** | all |
| R2 | Quality level of the most recent VTuber/Live2D | Phase 8 emote gate |
| R3 | **Styled like Stellar Blade (PS5)** | Phase 3, `research/stellar-blade-look-spec.md` |
| R4 | AAA quality everywhere — textures, physics, "anything you could think of" | Phases 3, 6 |
| R5 | Emote **the full range of human emotions**, **full body** | Phases 5, 6 |
| R6 | Driven by **anything they say and how they say it** | Phases 4, 5 (text + prosody) |
| R7 | **Usable by any AI agent** to embody itself, **in real time** | Phase 7 (the `Avatar` API) |
| R8 | Avatar **male, female, or a combination** — the AI's identity | Phase 1 (`Identity.js`) |
| R9 | Fan out sub-agents per item | every workflow |
| R10 | **Separate harsh critic sub-agent**, checks **visually**, loops until AAA | Phase 8 + every judge |
| R11 | **Blind side-by-side** vs Stellar Blade; say which looks better | Phase 8.1 |
| R12 | **Blind side-by-side** vs VTuber/Live2D emote; say which looks better | Phase 8.2 |
| R13 | LM Studio `http://127.0.0.1:1234`, model `qwen/qwen3.6-35b-a3b`, load if needed | Phase 5 |
| R14 | Organize tasks in a document/punch list | `PUNCHLIST.md` |
| R15 | Survive token/usage limits; **background task to resume** | `~/.claude/scheduled-tasks/sugata-avatar-resume/` |
| R16 | Track progress | `PROGRESS.md` |
| R17 | Use the web for sources and examples | `research/` — 9 docs |
| R18 | **A wardrobe** — outfits by mood and season, mix-and-match, chosen by the AI or pinned by the user | Phase 9, `research/wardrobe-system.md` |

---

## The one place I pushed back, and what was decided

**Concern raised:** a blind critic preferring our render *over* Stellar Blade is not reachable,
because Stellar Blade's fidelity is largely art labour — scan-derived texture stacks, artist-groomed
hair, baked lighting — which cannot be authored from a terminal. The last 20% is not shader math.

**Decision (user's, via the options panel):** completion gate is **"same tier, not better."** Harsh
blind critics must place our renders in the same visual family as real-time AAA character work.

**Note the asymmetry, and keep it:** on the *emote* axis (R12) the gate stays a **decisive win**,
because Live2D is 2.5D mesh deformation with no true gaze, no real head rotation, no body IK and
no physics beyond hair springs. That comparison is winnable outright.

R11 and R12 both remain in the punch list as written. The gate is how we decide to *stop*, not
permission to aim lower.

## The other three decisions the user made explicitly

| Question | Chosen |
|---|---|
| Character source | Asset-agnostic engine, **parametric primary** (became MPFB2/CC0) |
| Audio | **Full duplex** — TTS out *and* live mic in, so the avatar listens as well as speaks |
| Consumer | **Portable library any agent embeds** |

## Standing constraint from the user's CLAUDE.md

> When my vision seems too big, do NOT talk me into scoping it down. Keep the full vision as the
> target and help me phase it.

**Phasing is allowed. Shrinking the target is not.**
