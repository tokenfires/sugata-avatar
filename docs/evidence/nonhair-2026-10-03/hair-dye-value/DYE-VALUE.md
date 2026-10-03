# Hair dye value decision

Independent critic, 2026-10-03. **No supported conversion, attachment or documented-contract defect; do not admit a dye/shader experiment from this lavender witness.** This closes the read-only value question, not natural-shade fidelity or AAA hair quality.

## Actual witnesses

I viewed the original `captures/wardrobe-hair-cut-2026-10-03-v1/desktop-before.png` (1440×2060): the head, approximately x180–650/y140–740, reads pale lavender with broad strips and stippled edges. I also viewed the original accepted Brown `captures/hair-colour-controls/calibration-v1/brown-low/casual-front-exact-default.png` (900×868): crown/front locks read brown/taupe, with a cooler violet side and rim. These different Studio/Neutral framing conditions are **not a matched tint comparison**. The colour-controls README explicitly limits the authored Brown shade to the sampled Studio front view and notes the blue rim and room dependence.

`HairColourOptions.js:29–36` decodes sRGB inputs, blends in linear RGB, encodes/quantizes once, then supplies the resolved six-digit material colour. Independent scalar arithmetic using the installed `ColorManagement.js:205–213` constants reproduces #564665 from #413934 plus #8063ac at .25. The resolved decoded vector is [0.09305896283800832, 0.061246054224174035, 0.13013647668074665], matching both retained cut states within 1e-15. `independent.json` retains exact values and hashes. A prior rational-coefficient sRGB check differed by approximately 9.62e-12; that reflects Three's stored decimal constants, not a discovered material error.

`Avatar.js:3328,3456` passes the resolved hex to `createHairMaterial`; `HairMaterial.js:3619–3627` explicitly decodes sRGB into its Vector3 uniform. `applyHairMaterial:4048–4061` assigns that material to each selected groom mesh. `Avatar.js:3549–3554` retains the recipe and attachment vector; `2651–2659` reports the live uniform versus the attachment vector. The retained report says both requested/applied recipe and attachment match. This report is not a separate GPU uniform/readback proof.

## Interpretation and alternatives

`HairMaterial.js:2968` modulates the base by the lock field; its primary R lobe at 3197–3201 is achromatic, TT at 3209 and TRT at 3270 use absorption powers, and scattering at 3383–3386 uses sqrt(colour), luma-relative powers and lighting-dependent factors. Consequently this input is not a display swatch. These operations support a plausible nonlinear material response, **not attribution of the particular screenshot's brightness to one term, physical correctness, or an aesthetic pass**.

The API at 460–466 already calls this a linear-RGB colour blend rather than physical dye simulation and states that lighting/scattering affect appearance. Neutral Studio's accepted README calls it colour inspection rather than calibration. Current UI promises 0% base/100% tint and applying to see the result; it does not promise perceptual dye percentages. No user-confusion witness justifies another explanatory control here.

- **A — retain this supported recipe and its existing limits; prefer another visual domain now.** Lowest effort and avoids a speculative shader change. Natural-shade fidelity and the visibly coarse/stippled hair remain open.
- **B — defer a new dye-response design contract until an independently authored appearance target exists.** It must distinguish intended body colour, highlights and shadow/lighting tolerance in named front/oblique conditions; include hue/chroma/lightness relations and dark/pale strand readability. This could later support a concrete design decision, but requires real aesthetic intent. A flat hex-to-pixel match, gamma tweak, uniform oracle, colour search or replay of the historical many-arm calibration cannot substitute for it.

No product/assets or closed packets changed; no browser, GPU, native capture or generation was launched. Source reads that guessed a nonexistent HairColourBinding.js/showcase-hair-colour.mjs were corrected by the actual Avatar/material/UI witnesses above; no inference rests on those absent paths. Review stops with this decision.
