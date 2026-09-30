# Sugata overnight progress September 29

## Active authorization and deadline

Robert explicitly resumed Sugata work on September 29 after the six-image bob discussion. Hair is now in scope, and he authorized useful progress on any area of the product plan overnight. The earlier September 26 pause and hair deferral are historical. His latest steering requires a ten-minute recovery wakeup, a valid evidence example and two alternatives for every actionable critic finding, and avoidance of repeated tweak reversals without new evidence.

The planned final checkpoint is September 30 at 06:00 America/Los_Angeles, or 13:00 UTC. Stop starting substantial work at 05:45, collect or safely stop owned jobs, save the morning report, and pause automation `advance-sugata-avatar-visual-quality`. A newer stop or pause overrides this window immediately. Recovery wakes should resume productive work when capacity permits and must not duplicate a live job. Continue useful cycles within an active turn rather than idling for the next wake.

Current chat: `01a0f00c-2aad-7912-aece-8ba7e084bd9c`. Repository: `/Users/robault/GitHub/sugata-avatar`. Starting branch `codex/nonhair-progress-2026-09-26`, HEAD `d75d970a81ba16d7a2bb1be1c2cca7cbc95e000c`. Tonight now uses new branch `codex/bob-appearance-2026-09-29` from that exact commit. Initial untracked change is the new [bob appearance brief](research/bob-appearance-brief-2026-09-29.md). Six reference copies and their index are preserved locally in ignored `reference/bob-appearance-2026-09-29/`. Other existing worktrees contain preserved work and are not free scratch space.

## Current work and next step

First slice is complete: [controlled colour diagnostics](evidence/hair-2026-09-29/colour-diagnostic/README.md) support Robert's idea. Medium brown improves visibility of broad overlaps, pale exposes some boundaries but loses finer contrast, and intended dark remains a required confirmation. No hairstyle was changed. The [independent critique](evidence/hair-2026-09-29/colour-diagnostic/CRITIQUE.md) gives concrete image regions and two alternatives.

**Next bounded step:** map the neutral rear-oblique crossing patch and hooked tail to current bob02/g050 cards or locks. Compare authored/rest paths and final held-pose paths. Prove a discontinuity or displacement before choosing one isolated geometry candidate. Preserve shading/coverage as possible explanations until attribution distinguishes them. Use the medium brown and exact dark comparison from this slice; stop tuning diagnostic colours. A smooth-guide rear prototype is the critic's second alternative if source correspondence shows that repeated local tweaks cannot solve the representation.

Use the production Showcase on g050 with bob02 as the initial medium-target baseline. This does not rename the asset or imply it already meets the new brief. Run serial native WebGPU captures in an isolated process, with fixed clocks and equal render histories per arm, recording exact source and asset hashes. Do not route changed production modules. The underlying material exposes a base-colour uniform; a diagnostic may adjust that input while retaining all other settings. Keep diagnostic colours labelled and return to intended colours before judging a candidate improvement.

An independent subagent `hair_critic` is inspecting the brief and all six references. It is read-only and has no GPU/browser ownership. Root owns all capture jobs. Before launching any GPU job, inventory current processes and update this record with command, PID/session, output directory, and status. Use the existing native probe helper from `packages/core/src/render/MotionProbe.mjs`; sandboxed loopback and process checks fail, while approved native checks work.

If the comparison produces a clear local defect, choose one evidence-supported candidate and assess it. If useful progress depends on a larger unresolved renderer or geometry mechanism, save that finding and select another bounded, valuable item from [the product roadmap](PRODUCT-ROADMAP.md). Preserve the full appearance ambition and outstanding requirements.

## Critic contract and decision log

Every actionable finding must include a valid example: an actual reference/candidate image or frame, its view and region, the visible mismatch, and why it matters to the selected brief. A numerical finding additionally needs a reproducible witness and its scope. Hypotheses must be labelled as such. Each finding must offer two concrete alternatives and the tradeoff of each. A broad claim such as too messy is insufficient.

Record each experiment's question, predicted visible change, held controls, chosen alternative, result, and next decision. Preserve rejected evidence. Do not reverse a change merely because a subsequent critic expresses a different preference. Reproduce the conflicting evidence and identify whether the reference, view, metric, cause, or target changed. If local tweaks begin to repeat or undo one another without new evidence, stop tuning that lever and change the diagnostic perspective, representation, or problem framing. Two unsuccessful local adjustments to the same hypothesis trigger that review; this is a chosen working rule for tonight, not a performance threshold.

The medium target remains grounded in R1 through R3. Short, wavy, tousled and curly references apply only to their respective variants. Treat colour as an inspection tool and requested customization direction. Visual improvements require actual images; code checks and contact measurements alone cannot qualify appearance.

## Completed setup

- Reviewed the current roadmap, September 26 stop, and September 25 hair handoff. Outstanding renderer gates and rejected experiments remain preserved.
- Inspected the working tree and all existing worktrees. No source or accepted asset changes at setup.
- Native process inventory found the persistent review Vite server, PID 2323, and no Sugata capture job. Loopback hub returned HTTP 200. The initial sandbox refusal did not indicate a stopped server.
- Read the current material and Showcase interfaces. There is a material base-colour input but no user-facing Showcase hair-colour control.
- Reference brief and six local copies are saved. The critic reports that the brief is faithful and sufficient for appearance comparison, with the controlled diagnostic procedure the next missing piece.

## Active jobs

Automation `advance-sugata-avatar-visual-quality` is verified ACTIVE on this chat with a ten-minute cadence and finite overnight schedule. All root capture jobs have exited. Last run: `node tools/critic/hair-colour-diagnostic.mjs --out=captures/hair-colour-2026-09-29/neutral-v1 --lighting=neutral-chromaticity --views=back,rear-oblique,right-profile`, PID 28381, process session `90336`, exit 0, finished at 2026-09-30 03:26:24 UTC. Critic `/root/hair_critic` has completed its read-only review. Recheck current processes before the next capture.

A bounded `/usr/bin/caffeinate -i -t 34093` process, PID 29545, was started at 2026-09-30 03:31:47 UTC to prevent idle system sleep until 13:00 UTC. The display may sleep. Its local recovery record is `tmp/hair-sep29/awake.json`. On an earlier explicit stop, verify this exact process identity before releasing the owned assertion. The process inventory at setup showed only this assertion and the existing review Vite server among owned long-running services; all capture processes had exited.

Pilot v1 completed four rear images on the Apple Metal WebGPU adapter with exact recorded physical/camera/hair-setting state. It reproduced the broken crown, central rear patch, and pointed nape section. The critic supplied actual image regions and two alternatives for each. Three material colours offer different visibility, but the blue studio rim dominates. Independent default repeats differ in 321,313 pixels; the central rear rectangle has approximately 17/255 p99 maximum RGB-channel difference, so fine comparisons are not qualified. Source inspection confirms Avatar deliberately leaves the renderer node clock running under manual stepping. The existing `alive.js` capture-clock pattern is being applied inside the diagnostic harness only.

Pilot v2 stopped at its invariant check: the newly recorded grade object included `grainFrame`, which intentionally advanced from 1 to 97. Pilot v3 then compared the uniform object rather than its numeric value. These were instrument bookkeeping errors, not changed physical or material settings. Both sources and failure reports are retained. V4 records the numeric grain counter separately and requires it to equal the planned renderer frame. No tolerance was relaxed. V4 dark repeats differ in 92 pixels at max 6/255, with all expected clocks held.

Neutral-v1 completed twelve captures, four per view. Dark repeats differ in 2 pixels at max 1/255 for back, exactly match for rear oblique, and differ in 74 pixels at max 2/255 for profile. All image hashes, Apple adapter records, temporal clocks, and light-colour luminance proxies were checked. Root and critic directly inspected actual images. The crossed rear sections, crown facets, and uneven nape persist across diagnostic colours and neutral lighting. These large observations are supported; motion, opposite-side appearance, clearance, and final colours remain unqualified.

Raw evidence lives under `captures/hair-colour-2026-09-29/`, with complete reports and source snapshots. Tracked summary, archive manifest and critique are in `docs/evidence/hair-2026-09-29/colour-diagnostic/`. Do not reopen the older TAAU ablation program solely to perfect this appearance instrument.

### Decisions made

| Question | Alternatives and choice | Result and next action |
| --- | --- | --- |
| Can colour reveal structure? | Keep only dark, or compare held dark/middle/pale. Chose the comparison. | Different colours expose different features; keep medium plus dark, pale as supplemental. |
| How to handle repeat noise? | Persistent short sequences, or the documented owned-clock method. Chose bounded clock ownership. | Repeat error reduced greatly; remaining limits retained. No broad renderer work. |
| How to remove blue contamination? | Neutralize all light colours in a separate diagnostic, or isolate only the rim hue. Chose neutralization. | Persistent shape defects remain; stop colour/light tuning and trace geometry. |
| What structural path next? | Source-to-image attribution then one mechanism, or smooth-guide rear prototype. Choose attribution first. | Pending; pivot to the prototype perspective if evidence shows local tweaking is inadequate. |

## Preservation and delivery

Keep accepted assets and defaults stable while a candidate is unqualified. Record exact changed output, visual evidence, relevant focused checks, and material limitations. Preserve isolated experiments and unrelated worktrees. Use local recoverable checkpoints; no push, publication, model change, credit redemption, or unrelated paused-project work is part of this overnight request. Keep the review server available.

Notify Robert on meaningful progress, failure requiring action, or completion; routine unchanged wakes stay quiet. Morning delivery should lead with what visibly improved, show the evidence, identify rejected ideas and remaining uncertainty, and link the next concrete step.
