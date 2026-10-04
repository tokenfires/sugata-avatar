# Independent source review — direct Portrait Neutral

Decision: **GO for the isolated, finite control/layout trial; A remains worthwhile.** Reviewed and saved 2026-10-04 at approximately 07:08 UTC, before the 07:10 source handoff target and the 07:12 first-open cutoff. No native activity or product edits were performed by the critic. This is source admission only. Actual candidate desktop/mobile/Kitchen observations, independent original-image review, guarded adoption, and actual-route review remain required.

## Exact change and existing responsibility

I read the complete PLAN, candidate HTML, unchanged portrait.js, viewer-scenes.mjs and portrait-selection.mjs; I read the current Avatar.setLighting/applyLighting/resolver contexts and compared the complete HTML diff. The candidate adds exactly three lines: the second-row full-width selector at candidate line 41; the native Neutral button with stable label and initially false aria-pressed at line 117; and the colour-inspection note at line 119. Its script remains ./portrait.js at line 129. The original source snapshot and current accepted portrait.html are byte-identical; the candidate snapshot and route are byte-identical. There is no current git diff in accepted portrait.html or portrait.js.

The existing two-column grid at lines 36–39 preserves Studio/Warm on the first row. The new selector spans only Neutral across both columns. The existing choice size, pressed styling, focus-visible outline and disabled fieldset remain. The new note states a supported inspection purpose, not colour calibration or an appearance improvement.

portrait.js:153–158 already registers every [data-light] native button, calls avatar.setLighting(button.dataset.light), and assigns one true pressed peer. Avatar.js:2130–2137 validates a live owner, resolves the request and applies it; :2222 onward carries neutralColours and rebuilds the light units; :4202 onward validates the existing look. This is a missing direct affordance, not a missing lighting implementation.

**A:** the declared third native button uses that existing owner and handler, with minimal source change and an immediately usable choice. **B:** retain current Portrait and direct consumers to existing Showcase/SDK Neutral; less UI/source work, but the witnessed direct Portrait gap remains. A is preferable under the finite observation gates.

## Room, pause, defaults and keyboard scope

portrait.js:83–93 derives the room, hides #light-controls for Kitchen and creates through optionsForReviewScene. The complete viewer-scenes helper accepts Neutral in Studio and omits lighting for Kitchen; it rejects an explicit non-Studio light there. Room navigation at :141–150 retains the route and selects the new room through an ordinary fresh document. No light persistence is promised. Candidate Studio → candidate Kitchen and later actual Studio are the declared maximum three documents.

Pause is an ordinary existing toggle (:40–44 and :184 onward). The initial paused flag is prefers-reduced-motion dependent (:11,20). During the trial, inspect the actual label/aria-pressed state and reach paused=true; if already paused, do not toggle it back to motion merely to satisfy wording “Pause motion.” This is an observation instruction, not a requested source change.

Native Enter on Neutral and Space on Warm are a useful bounded interaction check: observe the actual focused native button and exactly one pressed light. The stable labels avoid renaming the toggles. CSS/source supports the expected route, but keyboard execution, layout, overflow and legibility are unobserved until the root's sole trial.

The current Avatar.create call supplies no quality override. Preserve current defaults. “Auto → Balanced for supported WebGPU hair” is source behavior, not an observed native tier/backend report in this trial. No hidden window.avatar/report, capture stepping, allocator inspection or extra wrapper is admitted.

**A:** qualify current direct controls and their desktop/mobile layout, then observe Kitchen hiding. This delivers the actual affordance without expanding state or persistence. **B:** add an exposed runtime tier/owner ledger, persistence or separate rendering experiment; more technical observability but materially broader scope, so defer it. A is the admitted responsibility.

## Lifetime and evidence limits

The existing pagehide handler at portrait.js:218–225 cancels RAF/attention and invokes attention, controls and Avatar disposal when the document is not persisted. Its pageshow handler handles cached documents. This source was not changed. The handler is registered after the async initialization body, so this review does not certify partial/late-create retirement. The plan correctly uses known managed tabs, closes them, and explicitly withholds a full runtime retirement, late-owner or GPU allocator census. No source ownership guarantee should be inferred from DOM readiness or closing a tab.

The actual new control may alter the rendered light choice, but there is no admitted matched-phase, unchanged pose, pixel identity, convergence, high-tier transition, hair/skin fix or calibration claim. Historical accepted Neutral evidence informs purpose only; previous high-transition and exact-image refusals remain closed.

**A:** preserve the observed-tab cleanup and source-lifecycle limits and decide this small affordance from actual finite UI originals. **B:** require a new full disposal/rendering observer first; it expands a straightforward UI slice and enters closed instrumentation routes. A is sufficient for this explicitly limited UI contract.

The root must stop on the first actual source/readiness/control/layout/runtime failure. Conditional GO expires at the plan's fixed cutoff. After candidate A, only exact reviewed HTML bytes may replace guarded original portrait.html; close/reset the candidate before adoption, then use one fresh actual route. Any adoption or actual-route failure restores the exact original and defers. No repair, replay, extra tab, deadline extension, shader/JS/core edit or lighting retune is admitted.

## Input bindings and readback

FS hash command returned exit 0, chunk f9d110. PID/start/end were not returned; the following clock read was 07:07:09 UTC. The command was:

```sh
shasum -a 256 docs/evidence/nonhair-2026-10-04/portrait-neutral-ui/PLAN.md docs/evidence/nonhair-2026-10-04/portrait-neutral-ui/original-portrait-source.txt docs/evidence/nonhair-2026-10-04/portrait-neutral-ui/candidate-portrait-source.txt packages/testbed/src/portrait.html packages/testbed/src/portrait-neutral-candidate.html packages/testbed/src/portrait.js packages/testbed/src/viewer-scenes.mjs packages/testbed/src/portrait-selection.mjs packages/core/src/Avatar.js
```

| Actual file | SHA256 |
| --- | --- |
| PLAN.md | 994a1eb862d84b9b0d8102d69d1611b6c87ef5012566f02660ef20ab2ec2fbcb |
| original-portrait-source.txt and accepted portrait.html | a61e72ef3d0b65d03f2a7699dd984c556591980d8be13e1998704c61e9478764 |
| candidate-portrait-source.txt and portrait-neutral-candidate.html | 0e8c682ded5282e4dc68710b19edf637b694e986dc3a7d342107c378c528348c |
| portrait.js | d62d9d190d9fd00a0309821ea6432ce999d0514a96b6bf7f94497e638adbf5c0 |
| viewer-scenes.mjs | 2bdbea123cf516bc4dc41dcf0347d80cdaab46bc1dbe799f7574dc484a3bc407 |
| portrait-selection.mjs | 3b7dc0923eb153daf27afcddf2ac4d0ea20a77d42a14d98795de535a29ae3769 |
| Avatar.js | fdbe49aec99f9c718bde269b5e434cda07af1504ea8df386a634714cea112b18 |

The full-read/diff commands returned exit 0 in chunks e05a60 and e0573a. The diff contains only the three declared additions; original/candidate byte counts are 9867/10105. No test, build, asset parse, material construction, model evaluation, UI/GPU/browser job or appearance inspection was performed in this source gate. The independently actually viewed prior originals and their limits are retained in the preceding portrait-neutral-worth/CRITIC-WORTH.md (39348aa1037a6c2800bb122b4ba527a0b287475eaad0d03d8b1d19624e0990d0); those are not current Portrait Neutral pixels.
