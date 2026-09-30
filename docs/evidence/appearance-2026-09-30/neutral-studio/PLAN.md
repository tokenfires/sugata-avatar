# Optional Neutral Studio lighting

## Actual observation and decision

The complete-avatar custom-colour plates show strong blue highlights on casual charcoal shoes (`#252a30`) and elegant brown shoes (`#35291f`), plus a violet-blue neck/shoulder rim. Root and the independent critic inspected the actual originals in `captures/wardrobe-colours-day-2026-09-30-v1`. LightingRig's body rim is authored blue, and its hemisphere has blue sky/warm ground. These sources plausibly contribute to the colour-inspection limitation; no claim that the rim alone causes every blue pixel follows. Existing artistic looks remain valid and unchanged.

Two directions:

1. **Chosen:** persist an optional `neutral` Studio light through the SDK, viewer URL, settings JSON and named looks. Achromatize each resolved rig light in linear working RGB while preserving that source colour's luminance and its scalar intensity, placement and shadow configuration. This supports a shareable inspection view, but needs complete light ownership/rebuild and state qualification.
2. **Alternative:** a transient inspection toggle with explicit return to the artistic look. Smaller configuration surface, but saved/shared views would not reproduce that transient choice.

This is a colour-inspection option, not calibrated colour. Material albedo, texture, hair response, tone mapping, background and floor continue to affect pixels. A selected hex is not expected to equal its rendered pixels. Do not retune material colours to compensate for lighting.

## Implementation contract

- Preserve current Studio, Warm, other existing SDK look recipes and defaults exactly. Add Neutral as an optional look and a third Studio viewer button. Kitchen retains its own room lighting and rejects an explicit nondefault Studio light in the review viewer.
- Resolve each direct source, shadow half, optional glint and both hemisphere colours to an achromatic `Color(Y,Y,Y)`, using the installed Three working-space luminance coefficients on the source's linear components. Do not convert through an eight-bit hex on the neutral path. Source intensity/exposure, geometry, ratios and shadow configuration remain unchanged; intensity alone does not describe total coloured light energy.
- Own the mode inside LightingRig so creation, rebuild, framing and live switching agree. Preserve authored source colours rather than repeatedly neutralizing already-neutral values. Restoring another look must restore its original colour recipe.
- The high-quality ambient-occlusion composite owns a separate hemisphere snapshot. It must receive both new ambient colours on live switching as well as intensity; creation/framing must remain consistent. Report enough actual linear state to verify this path. Balanced viewer captures alone cannot qualify the high tier.
- Preserve existing hair base/tint, clothes, material maps, physical motion and controls. Neutral is saved as a light choice, not baked into any material or asset. Label it correctly in saved-look summaries.
- Keep the candidate in the reusable attached worktree at `/Users/robault/.codex/worktrees/sugata-hair-colours/sugata-avatar`, branch `codex/neutral-studio-2026-09-30`, from reviewed main checkpoint611e4f4. Its only pre-existing untracked item is node_modules; no process owned that checkout at inventory. Root main remains the accepted review source until qualification.

## Bounded verification

First inspect actual source and independently review the implementation. Run focused checks for per-source luminance preservation, authored return, both framings, shadow halves/glint, the ambient descriptor/composite update, and the URL/settings/named-look/Kitchen boundaries. Do not run unrelated suites.

Root then serializes actual native captures using the existing fixed preparation protocol, with source/asset hashes, unchanged physical/material state and observed live lighting. Compare authored Studio versus Neutral for both complete custom looks at body framing and matched portrait views; inspect actual originals. Inspect selected shoe/neck/hair regions without preclaiming hue or luminance outcomes. Do not introduce an exact-image tolerance or erase the existing failed reproducibility gate.

Exercise live Studio→Neutral→Warm→Studio, Neutral framing changes/reload and persistence through actual JSON/named looks, plus the high-quality composite colour update. Capture desktop/mobile controls and record cleanup. Any material actionable finding needs an actual source/frame example and two alternatives with tradeoffs. No promotion before independent visual and functional review. Preserve all original evidence and accepted assets; keep main review service available.
