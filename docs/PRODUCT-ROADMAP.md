# Sugata product direction

Rob's September 13, 2026 discussion with Ember, supplied as `sugata-avatar-tracking.md`, clarifies the intended experience and phase order. This roadmap carries that direction into the project. Its status column is grounded in current project evidence; the supplied note is a statement of goals, not a completion ledger.

Sugata is an embodiment system for AI agents: a compelling, customizable character whose face, gaze, posture, gestures and actions communicate the agent's intended meaning to a human. The first visual target remains AAA quality, with Stellar Blade on PS5 and MetaHuman as quality references. These references do not choose a new engine or asset dependency. The present browser runtime remains the implementation under development.

**September 29 overnight work is active:** Robert has resumed broad Sugata progress, including hair, after reviewing six bob references. Follow the [overnight checkpoint](OVERNIGHT-2026-09-29.md) and [appearance brief](research/bob-appearance-brief-2026-09-29.md). The first diagnostic evaluates controlled colour changes as an aid to seeing hair structure. Every actionable critic finding needs an actual evidence example and two alternatives; repeated tweak reversals require a fresh diagnosis. The planned morning checkpoint is September 30 at 06:00 Pacific.

**Historical September 26 work window — paused at Robert's request:** Robert explicitly deferred hair and authorized autonomous non-hair
progress with subagents and independent critique. Follow [today's checkpoint](PROGRESS-2026-09-26.md)
and [the recovered work queue](NONHAIR-QUEUE-2026-09-26.md). The earlier hair experiments and their
remaining gates stay preserved; they are not today's prerequisite.

## Phase 1 — AAA characters and expressive agent control

| Area | Intended result | Current evidence / remaining work |
| --- | --- | --- |
| Current review pages | A cohesive place to see what works, what is experimental, and what still needs work. | The hub now inventories 17 destinations and distinguishes current previews, service-dependent features and older diagnostics. Current preview/Converse flows have fresh browser evidence; the catalogue explicitly labels historical pages whose behavior has not been rechecked. Continue updating status with each visible milestone. |
| Hair, skin and character appearance | Convincing complete characters from useful viewpoints and during motion. | Accepted bob collision, crown-root, temporal-history and shading improvements; softer brow/lash edges. The studio shadow filter now softens card-shaped neck/chest patches with matched both-bob portrait/body and motion evidence; see SHADOW-SOFTNESS-2026-09-13.md. Broad hair strips, rear backing, silhouette, broader identities and overall AAA appearance remain open. |
| Wardrobe and customization | Complete, attractive outfits with enough examples to understand customization. | Wardrobe has two starting outfits on one body study, three coordinated material palettes and verified image/settings export with reconstruction. September 26 adds strict JSON reopening, Studio/Kitchen selection and a browser-local list of up to 12 named looks with scoped removal Undo and metadata-only Rename; all supported current settings combinations and native failure/recovery paths are checked. See [today's saved-look evidence](evidence/nonhair-2026-09-26/next-look/README.md), [Rename qualification](evidence/nonhair-2026-09-26/saved-look-rename/RESULT.md), and WARDROBE-COLOURWAYS-2026-09-13.md. The casual trousers now clear the shoes/socks in matched resting and moving-pose views, with foundation coverage preserved; see WARDROBE-TROUSER-FIT-2026-09-13.md. Upper-garment fit, layering, style variety and wider-body coverage still need work. |
| Agent outfit suggestions | The agent can suggest an outfit that fits today's mood or activity and preview an available combination. | Desired feature. It needs a usable wardrobe catalogue and checks that proposed combinations exist and fit. |
| Representative builds | Curated handsome male, beautiful female and deliberate gender-neutral example builds, with starter templates that make onboarding easy. | Identity controls and a limited showcase exist. A neutral midpoint or a passing bake-load check is not yet a curated starter build. Each example needs full appearance, outfit, expression and motion review. |
| Emotive gestures | Expressions and gestures convey intended nuance, including coyness and teasing, and produce the intended human reading. | The current Portrait controls have a timed visual inventory. An unobstructed face diagnostic confirms limited Curious/Determined differentiation. The attention action is available experimentally in Portrait and Wardrobe studies, with native measured eye focus, interrupt/release checks and continuous clothed recordings for both bobs. Production ownership is integrated; broad perceptual eye contact remains open, and some close views reach the existing eye movement limits. See POINT-AIM-INTEGRATION-2026-09-13.md and SHOWCASE-ATTENTION-2026-09-13.md. The stronger face reads as skeptical and remains unshipped. A September 26 fixed comparison passes native control checks; blind still-image review favors gaze hold for direct engagement but finds moderate eye-opening attenuation inconclusive. No behavior is promoted and determination remains open; see [the bounded decision](evidence/nonhair-2026-09-26/expression-next/DECISION.md). The restrained optional smile is now integrated in Portrait and Wardrobe studies, with native owned blending, a final-layer addition budget, repeated-choice/interruption checks and sampled actual speech/joy/sad compositions. It remains an explicit authored choice: a smile can soften a sad reading, and continuous speech/intent recognition are unqualified. See SMILE-INTEGRATION-2026-09-13.md. See ATTENTION-ACTION-2026-09-13.md and ATTENTION-STUDY-2026-09-13.md. No named coy/teasing action was found in the inspected controls; the reported sour reading remains unattributed. Converse connection/structured replies work with a tested installed model, while open-ended interpretation and complete expressive actions remain experimental. See EXPRESSION-INVENTORY-2026-09-13.md. |
| Performance | Representative complete avatars run at a stated, measured interactive quality target. | Targeted renderer and ownership checks exist. A complete Phase 1 performance pass across representative avatars, outfits and gestures is outstanding. Establish explicit device, resolution, frame-time and memory budgets before claiming it passes. |

Keep representation and customization present throughout Phase 1. Attractive examples are a design deliverable with visual review, not a side effect of exposing sliders.

September 26's [wardrobe coupling study](evidence/nonhair-2026-09-26/wardrobe-coupling/README.md)
establishes cached helper arithmetic and exact source-to-export garment correspondence. Native
reshaped-body validation, corrective behavior across identities, skeleton/foundation coupling
and actual fit remain open. The separate [hand-placement comparison](evidence/nonhair-2026-09-26/hand-candidate/RESULTS.md)
improves visible hands in its recorded sequence but changes the closed posture; it remains an
isolated candidate. Neither study constitutes a representative starter build or AAA acceptance.

A September 26 [identity-aware eyelid instrument](evidence/nonhair-2026-09-26/identity-closure-next/README.md)
now reproduces a sampled CPU red/green case at the native blink coefficient, independently
checked by a second 3D intersection method. A body-only eye-height change exposes eye
geometry while the baseline closes on the sampled grid. Fitted native identity behavior,
continuous closure and corrective design remain unqualified; no identity control or blink
calibration changed.

Wardrobe now also offers [matched visual palette references](evidence/nonhair-2026-09-26/next-visual-audit/RESULTS.md)
for each of the two current outfits. Compare palettes preserves the user's room, framing and cut
when applying a choice, and works with the existing JSON and named-look controls. The images
make the available compositions easier to compare; they do not expand the supported body or fit.

A first [Wardrobe timing pilot](evidence/nonhair-2026-09-26/review-performance/PILOT-RESULT.md)
records 240 controlled stepped updates after an instrumented stable warmup. It provides a
bounded baseline on the current M5 Max host; it does not establish live FPS, a budget pass
or representative-build performance.

Expression evaluation must distinguish control correctness from human readability. Record the intended meaning, the actual face/body sequence, the observed reading, and the evidence. An action can have valid numbers and still look annoyed when the agent meant playful. Use matched views and motion, and have the independent critic offer two concrete alternatives with tradeoffs for each proved issue.

## Phase 2 — VTuber-style characters

Develop the stylized polygonal interpretation after the Phase 1 foundation has earned its gates. Preserve agent expression, action and customization capabilities while deliberately redesigning proportions, materials and motion for that style. Do not treat lower geometric complexity as proof of an easier expressive-design problem. The technical effort remains an estimate until tested.

## Phase 3 — Mii-like characters

Develop a simplified, approachable aesthetic with the same clear agent intent and usable customization. Establish style-specific representation, gesture and performance checks. The expectation that this phase is quicker is a planning hypothesis, not a delivery promise.

## Immediate work order

1. Preserve the accepted dynamic hair shading and collision work. The bounded inner-hem study is closed and its geometry remains unshipped.
2. Preserve the integrated eye-focus ownership and the attention action’s tested interruption/release/cancel behavior. The optional soft-smile cue is integrated with its reviewed final-layer budget and owned envelope. Preserve the neutral default, repeat continuity, final-layer composition and explicit-gaze-cue supersession semantics in SMILE-INTEGRATION-2026-09-13.md. Ordinary Avatar.say does not itself supersede attention. Return the next visual slice to character/wardrobe finish and representative builds; do not keep expanding cue infrastructure without a proved need. Resolve remains open: compare a gaze hold alone or moderate eye-opening attenuation without the rejected sustained squint/brow profile. Resolve the reported coy/teasing ambiguity without guessing its source. Each actionable critique needs two alternatives and visual or behavioral evidence.
3. Develop representative starter looks and complete outfits alongside that expression work. Show configurations that humans can compare, save and customize.
4. Continue the remaining Phase 1 character-quality work, then run the full performance pass on the resulting representative builds. Move to the stylized phases against explicit acceptance evidence.

This is a phased route to the original ambition. It does not declare the ambition achieved. The supplied note's historical token-use estimate and “blocker cleared” wording are not current usage telemetry or a finished-hair claim; live usage and dated evidence govern those statements. Preserve the user's pacing boundary and reserve, and never redeem reset credits or push without authorization.
