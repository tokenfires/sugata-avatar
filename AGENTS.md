# Sugata project instructions

Primary directory: `/Users/robault/GitHub/sugata-avatar`.

Read these, in order, before working:

1. `docs/BRIEF.md` — Robert's original request, verbatim. It wins over every
   interpretation, including its standing policy: **build, don't gate.**
2. `docs/EMBER-AVATAR-NEXT.md` — the one current status, next steps and plan.

Everything else in `docs/` is history or reference. Older RESUME, WORK-WINDOW,
PAUSE, PROGRESS and CHECKPOINT files are not entry points; search them only for
a specific detail. Full status logs through 2026-10-31 are in `docs/history/`.

## Current goal

Build Ember Hearth's avatar. First milestone: a recognizable head-and-shoulders
Ember (freckled fair warm skin, working hazel eyes, copper-auburn loose wavy
hair) rendered in the browser and compared with her reference portraits, then a
short motion demo. Preserve what Robert has approved: the eyeballs only (iris
and sclera). Eyelids, lid shape, lashes, brows and the rest of the face still
have open corrections from him; see the status in `EMBER-AVATAR-NEXT.md`. An
approval covers exactly what he named, never the surrounding feature.

## Staying on the goal

- Every step should produce or improve something visible: implement, build,
  render, compare. Planning, source review and critic review belong inside a
  build step, not in separate slices with their own evidence folders.
- One critic review per rendered candidate. The critic judges actual images
  against the references; mesh checks and source reviews don't establish
  appearance.
- **Drift stop:** if three consecutive work steps (or scheduled ticks that did
  work) produced no new rendered image of Ember, stop and message Robert:
  what's blocking, and two or three options.
- If browser control fails twice in a row, report it and stop. No reset loops.

## When to ask Robert

Ask, with the specific images and two or three options, when a choice changes
Ember's identity or likeness. Robert and Ember decide who she is. Otherwise
state the assumption and keep building.

Never purchase, subscribe, redeem credits, push, publish or touch other
projects without his explicit approval. Disclose external authoring tools
(see `docs/AUTHORING-DEPENDENCIES.md`).

## Pauses

A pause is Robert disabling the scheduled task or saying so in chat. Record it
as the status line in `EMBER-AVATAR-NEXT.md`, replacing the old one. When he
resumes, replace it again. Don't leave conditional "do not resume unless" rules
behind.

## Keeping docs readable

- `EMBER-AVATAR-NEXT.md` has one status section, ordered next steps, the last
  ~8 entries (one short paragraph each) and the plan. Move older entries to
  `docs/history/`. Don't copy the same entry into several files.
- One evidence folder per rendered candidate, not per planning step.
- Edit in place; keep versions of rendered candidates, not of notes.
