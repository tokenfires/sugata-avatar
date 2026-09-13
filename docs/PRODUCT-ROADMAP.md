# Sugata product direction

Rob's September 13, 2026 discussion with Ember, supplied as `sugata-avatar-tracking.md`, clarifies the intended experience and phase order. This roadmap carries that direction into the project. Its status column is grounded in current project evidence; the supplied note is a statement of goals, not a completion ledger.

Sugata is an embodiment system for AI agents: a compelling, customizable character whose face, gaze, posture, gestures and actions communicate the agent's intended meaning to a human. The first visual target remains AAA quality, with Stellar Blade on PS5 and MetaHuman as quality references. These references do not choose a new engine or asset dependency. The present browser runtime remains the implementation under development.

## Phase 1 — AAA characters and expressive agent control

| Area | Intended result | Current evidence / remaining work |
| --- | --- | --- |
| Current review pages | A cohesive place to see what works, what is experimental, and what still needs work. | The hub now inventories 17 destinations and distinguishes current previews, service-dependent features and older diagnostics. Current preview/Converse flows have fresh browser evidence; the catalogue explicitly labels historical pages whose behavior has not been rechecked. Continue updating status with each visible milestone. |
| Hair, skin and character appearance | Convincing complete characters from useful viewpoints and during motion. | Accepted bob collision, crown-root, temporal-history and shading improvements; softer brow/lash edges. Broad hair strips, rear backing, silhouette, broader identities and overall AAA appearance remain open. |
| Wardrobe and customization | Complete, attractive outfits with enough examples to understand customization. | Wardrobe has two starting outfits on one body study and verified image export. Garment fit, layering, style variety and wider-body coverage still need work. |
| Agent outfit suggestions | The agent can suggest an outfit that fits today's mood or activity and preview an available combination. | Desired feature. It needs a usable wardrobe catalogue and checks that proposed combinations exist and fit. |
| Representative builds | Curated handsome male, beautiful female and deliberate gender-neutral example builds, with starter templates that make onboarding easy. | Identity controls and a limited showcase exist. A neutral midpoint or a passing bake-load check is not yet a curated starter build. Each example needs full appearance, outfit, expression and motion review. |
| Emotive gestures | Expressions and gestures convey intended nuance, including coyness and teasing, and produce the intended human reading. | Affect/gesture machinery exists; some pages remain source-reviewed diagnostics. Converse's connection and structured replies work with a tested installed model, but open-ended interpretation remains imperfect. Audit actual expression sequences, including the reported coy/teasing-to-sour mismatch, before choosing a correction. |
| Performance | Representative complete avatars run at a stated, measured interactive quality target. | Targeted renderer and ownership checks exist. A complete Phase 1 performance pass across representative avatars, outfits and gestures is outstanding. Establish explicit device, resolution, frame-time and memory budgets before claiming it passes. |

Keep representation and customization present throughout Phase 1. Attractive examples are a design deliverable with visual review, not a side effect of exposing sliders.

Expression evaluation must distinguish control correctness from human readability. Record the intended meaning, the actual face/body sequence, the observed reading, and the evidence. An action can have valid numbers and still look annoyed when the agent meant playful. Use matched views and motion, and have the independent critic offer two concrete alternatives with tradeoffs for each proved issue.

## Phase 2 — VTuber-style characters

Develop the stylized polygonal interpretation after the Phase 1 foundation has earned its gates. Preserve agent expression, action and customization capabilities while deliberately redesigning proportions, materials and motion for that style. Do not treat lower geometric complexity as proof of an easier expressive-design problem. The technical effort remains an estimate until tested.

## Phase 3 — Mii-like characters

Develop a simplified, approachable aesthetic with the same clear agent intent and usable customization. Establish style-specific representation, gesture and performance checks. The expectation that this phase is quicker is a planning hypothesis, not a delivery promise.

## Immediate work order

1. Close the current dynamic hair-shading milestone and its bounded inner-hem shape review. Keep rejected geometry unshipped and preserve the accepted collision work.
2. Build a visible expression/gesture inventory using the current runtime. Start with the reported coy/teasing ambiguity; reproduce the actual reading and select one useful correction with two critic alternatives.
3. Develop representative starter looks and complete outfits alongside that expression work. Show configurations that humans can compare, save and customize.
4. Continue the remaining Phase 1 character-quality work, then run the full performance pass on the resulting representative builds. Move to the stylized phases against explicit acceptance evidence.

This is a phased route to the original ambition. It does not declare the ambition achieved. The supplied note's historical token-use estimate and “blocker cleared” wording are not current usage telemetry or a finished-hair claim; live usage and dated evidence govern those statements. Preserve the user's pacing boundary and reserve, and never redeem reset credits or push without authorization.
