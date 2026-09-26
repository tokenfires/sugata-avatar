# Non-hair work queue — September 26

Read with [the product roadmap](PRODUCT-ROADMAP.md) and [today's live checkpoint](PROGRESS-2026-09-26.md).
This orders bounded slices within the existing ambition; it does not replace the complete backlog.

## Saved looks and review access

The review LaunchAgent now serves the hub at http://127.0.0.1:5173/. First implementation slice:
reopen the supported look settings the Wardrobe studies can already export. Acceptance requires
actual file selection, attached configuration equality, mixed-outfit and Original-palette replay,
safe errors and same-file retry, accessible desktop/mobile UI, and independent review.

The first implementation passes those functional checks; see today's checkpoint. Its corrected
mobile capture exposed a portrait-framing crop, reproduced on direct navigation and now corrected
with measured head-region projection fitting. Desktop/body/orbit/reset and attention continuity
checks pass; lower long tails and animated excursions are outside that claim. See the final
[framing evidence](evidence/nonhair-2026-09-26/framing/README.md).

September 26 follow-through also adds Studio/Kitchen controls, sticky desktop previews and
a browser-local collection of up to 12 named looks. Independent native/code/image review
approves these bounded controls; see [the saved-look evidence](evidence/nonhair-2026-09-26/next-look/README.md).

The follow-through adds a collapsed **Compare palettes** chooser with six matched native Studio
references, showing the actual outfit's three palettes. Focused desktop/mobile, settings,
mixed-outfit and lifecycle checks pass; see [the qualification](evidence/nonhair-2026-09-26/next-visual-audit/RESULTS.md).
These remain references to two existing outfits on the current body.

## Casual collar fit

The defect is already proved in [the collar stress study](COLLAR-STRESS-2026-09-16.md): foundation
contact during happy gestures and a thin/angular collar. Hands entering trousers is a separate
issue. Follow the exact [bounded fit plan](COLLAR-FIT-PLAN-2026-09-16.md).

Before fitting, recover and hash-check all required historical pose and frozen coverage inputs.
The [September 26 preflight](evidence/collar-2026-09-26/README.md) verified the retained September 22
archive but found the required older mild-pose and coverage inputs absent at their named paths.
Do not repeat that audit; use a known backup or explicitly design fresh replacement qualification.

The [fresh replacement protocol](COLLAR-REQUALIFICATION-2026-09-26.md) defines new controls
and coverage with explicit conventions, preserving the historical gap. The independently tested
operator and capture adapter are complete. Eight native bob02 cases are sealed; the remaining
matrix was intentionally stopped at a fixed-support vest-contact witness. Four intersecting
cloth faces cannot move under the 34-group support. This blocks joint bra/vest clearance under
the proposed interface; the original body-plus-bra-only solve remains untested. See the
[clearance inventory](evidence/collar-2026-09-26/replacement-clearance/README.md). No solver,
trial export or promotion occurred. Preserve the unused trial slot and do not restart this
same support experiment today; a broader fit study requires a separately designed constraint set.

One exported candidate only, jointly constrained against body and bra across saved expressive
poses, restricted to the prescribed 34 welded groups / 43 raw vertices and at most 3 mm extra
displacement. Preserve rear guard, topology, UVs, weights, masks, and accepted default. Stop on a
failed final invariant. Exact new bytes need coverage replay, real motion, oblique views and
independent critique before promotion. No support expansion or threshold relaxation.

## Focused expression readability

[The expression inventory](EXPRESSION-INVENTORY-2026-09-13.md) records weak Curious/Determined
differentiation. Current controls are in `packages/testbed/src/portrait.js`. Use a small isolated
comparison: current behavior, gaze hold alone, or moderate expression-owned eye-opening
attenuation alone. The [attention study](ATTENTION-STUDY-2026-09-13.md) records the rejected
stronger skeptical-reading profile; do not repeat it as a determination fix.

Capture matched onset/hold/release in face and clothed body views. Record intended and observed
meaning; a numeric ownership pass cannot earn the label "determined." Preserve neutral default,
repeat continuity, speech-mouth ownership, explicit gaze supersession, pause/orbit/release and
disposal. Critic gives two concrete alternatives per proved visual issue. Avoid generalized cue
infrastructure. Coy/teasing remains unattributed and must not be invented as a diagnosed defect.

The fixed three-arm comparison is complete and remains isolated. Blind still-image review
favors gaze hold for direct engagement but does not establish determination; eye-opening
attenuation is inconclusive. No production expression change follows. See the
[sealed decision](evidence/nonhair-2026-09-26/expression-next/DECISION.md).

## One useful scene's readability

Scene presets already exist in `packages/core/src/render/Scene.js`. Kitchen's L3 person/background
separation remained red after the September 22 geometry-mask repair. Start with fresh studio and
kitchen controls, inspect actual masks, and test one isolated room/background or composition
candidate with all existing L1–L5 checks and matched portrait/body critique. Preserve studio
calibration. The earlier increase-rim attempt also brightened the wall and is not a fresh idea.

Tools: `tools/critic/scene-probe.mjs`, `scene-gates.mjs`, and the avatar-plate testbed. Keep exact
preset, seed, frame, source and stepping provenance. A future review picker may reconstruct an
owned Avatar; do not imply that missing `Avatar.setScene`, suggest or pin APIs already exist.

Completed bounded slice: kitchen wall `#b4ac9f` passes the unchanged bald clauses and independent
clothed/default-path review. [Evidence and visual comparison](evidence/nonhair-2026-09-26/scene/README.md)
retain the darker rejected alternative and exact limits. Do not repeat the wall-axis trial today.

## Representative builds and performance

The current lookbook is two outfits on g050 with three palettes. Available g000/g050/g100 body
bakes do not establish garment fit on those bodies: the manifest currently covers g050 only.
Do not relabel that single body as three completed representative builds. Wider-body garments
depend on the identity/wardrobe coupling gate in `PUNCHLIST.md` section 10.9.

September 26 closes two data prerequisites without claiming native refitting: cached body/helper
arithmetic and an exact UV/topology map from the casual garment's 2,197 source vertices to its
2,377 exported vertices. Existing trouser corrections are characterized separately. The new
[CPU evidence and independent critique](evidence/nonhair-2026-09-26/wardrobe-coupling/README.md)
retain the absent Blender/native-helper oracle, corrective behavior across identities and
skeleton/foundation coupling as open work. Do not apply current corrective offsets blindly to
another body or mark 9.4 complete.

The isolated [hand-placement candidate](evidence/nonhair-2026-09-26/hand-candidate/RESULTS.md)
has 126 unique measured native geometry times and matched A/D visual evidence. It restores visible
hands in the recorded angry sequence, with wider arms and weaker upper-arm contraction as a
visible tradeoff. The narrow-gap follow-up found a smaller positive left-hand separation bound
of 0.5075335502624511 mm at step 593. These are discrete observations, not a continuous guarantee.
The live default is unchanged; broader motions/outfits remain separate qualification work.
The completed fixed candidate must not be silently retuned.

Complete, visually reviewed male/female/gender-neutral starter looks remain the deliverable.
Run the representative performance pass against explicit device, resolution, frame-time and
memory budgets once those builds are ready. `Stage.frameMs` measures CPU callbacks/submission,
not GPU execution; presentation FPS alone cannot certify the GPU budget.
