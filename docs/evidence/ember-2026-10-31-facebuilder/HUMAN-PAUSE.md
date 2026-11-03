# Human pause and route clarification — October 31, 2026

Robert questioned whether the result was a photo wrapped around a head, the flat hair and black rear coverage, and whether Sugata's direction had changed. He then said: “I've paused the 10 minute timer.” Root stopped work and performed only state inspection, existing-image review and this recoverable pause checkpoint.

## Verified state

- Starting HEAD: `5b9d865d`; checkout was clean before this documentation-only pause update.
- Queried `automation_update` in view mode for `advance-sugata-avatar-visual-quality`; the app rendered its card. Read the existing automation TOML: `status = PAUSED`, `kind = heartbeat`, `FREQ=MINUTELY;INTERVAL=10`, target chat `01a0ff57-d720-7db2-923f-9e3e0521216c`, updated_at `1793447934480`. The user had already paused it; no duplicate update or reactivation was needed.
- `collaboration.list_agents` reports the quality critic completed. Declared process inspection (`ps -axo pid,ppid,stat,etime,command` filtered for Sugata/Vite/Blender/FaceBuilder) found retained Vite PID 989 and Blender UI PID 59699, with no owned background fitting/export job. This is a scoped inspection, not a machine-wide workload audit. Neither application was terminated.
- Root re-opened existing `browser-front-photo.jpg` and `browser-profile-photo.jpg` as local image files. No browser/native capture, rendering, fitting, export, texture generation, source-asset modification or candidate revision was performed.
- Saved editable projects, neutral and photo-expression exports, original references, frozen evidence, accepted/default assets and the unrendered skin-coverage v001 study remain unchanged. Earlier exact file hashes are in `skin-coverage-v001-files.json`; no new asset output exists in this slice.

## What this result actually establishes

FaceBuilder fitted a 3D head to the two portraits and projected photographic colour onto it. The displayed hair is photographic colour flattened onto the scalp/neck surface, not constructed hair. Black rear-head/underjaw/neck regions are missing usable projected texture coverage. Eyes and much of the visible facial expression are carried in the photo texture; independent working eyes, finished skin, hair and animated integration have not been demonstrated. The initial browser view proves this static export can be displayed; it does not establish the finished avatar milestone, accepted geometry/likeness, or the full animation/customization route.

This is a change in asset authoring toward an external tool, already disclosed centrally. It is not a demonstrated renderer change, nor a reduction of the complete Ember/AAA target. A trial approval did not accept the result as finished. The pending coverage study would replace peripheral photo artifacts with provisional colour; it cannot supply the missing hair, eyes or skin finish.

## Stop boundary and next discussion

Work remains paused even if supported browser access returns. Do not launch the pending material review, reopen consumed experiments, start a critic task, or activate the timer from a queued heartbeat. Explain the intended path from this limited face source to a complete character, what remains unproven and what a meaningful next visible deliverable would include. Await Robert's explicit steering/resume before any substantial work. Preserve the full roadmap and existing no-purchase/no-subscription/no-push/no-publication limits.

## Reviewed plan and recovery update — still paused

Subsequent October31 human reference clarification is recorded in `docs/research/EMBER-LIKENESS-BRIEF-2026-10-30.md` and linked from the current plan: face/hair priorities, per-image generation differences, accepted subtle expression variation and outfit-only uses. Root read seven existing local images (two close portraits, two named expressions, three outfit views); no captures, image edits or experiments. The first combined documentation patch failed its exact-line check and made no changes; the corrected patch was applied and diff-checked. Existing timer instructions already load the brief and plan, so no timer rewrite or activation is needed for these annotations. Still await explicit resume.

Robert subsequently reviewed the measured-fitting plan positively, confirmed that generated reference images can vary, and asked about timer changes and how he could help. This permits updating the plan and recovery instructions; it does not revoke his explicit pause. `docs/EMBER-AVATAR-NEXT.md` now leads with the measured-fitting proposal, reference-conflict handling, diagnostic colours, early animation proof and complete-character stages. Its older plan is retained under a historical heading. Work-window/resume pointers were updated consistently.

Updated the existing automation through `automation_update(mode=update)` with its same ID, name, heartbeat kind, ten-minute schedule and destination chat, explicitly preserving PAUSED. App update returned PAUSED; view mode rendered the card. Read the saved TOML and compared the entire prompt exactly with the submitted text, plus status and cadence. The new prompt no longer mandates automatic continuation of the skin-coverage study. [Exact readback](measured-plan-automation-readback.json).

This slice performed documentation/API updates and readback only: no fitting, rendering, captures, source asset edits, tests, independent critic job or runtime changes. `git diff --check` verifies the documentation edits. All existing candidate assets and outputs remain unchanged; no new build artifact or appearance claim exists. Next action is explicit human resume, followed by the new plan's bounded source/measurement/critic/root preflight. No additional reference set is requested; meaningful input conflicts should be presented with concrete image witnesses when found.
