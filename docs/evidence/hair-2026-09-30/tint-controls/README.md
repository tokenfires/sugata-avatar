# Editable base colour, tint colour and amount

**Locally integrated for the reviewed editing and saved-look workflows. The strict exact-image gate FAILED and remains unresolved.** These are separate findings. No hair geometry, shader, natural-dye fidelity or broad motion improvement is claimed.

## What is available

In Wardrobe studies, open **Hair colour**, choose a base shade and optionally **Add a tint**. Tint colour and Tint amount remain independently editable. Base lightness changes the chosen base before the mix. Apply attaches the result; saved settings and named looks keep the complete recipe.

- At 0%, the existing exact base material input is retained, while the tint recipe can still be saved and edited.
- At 100%, only the tint determines the material input. Changing the base still counts as an edit and survives reopening.
- Turning tint off restores the current base. Original removes both options and restores the exact existing derived linear colour, without first rounding it to a hex colour.
- The optional SDK field is `hairTint: {colour: '#8063ac', amount: 0.35}`, with an explicit `hairColour` base and enabled hair. The mix is linear RGB, quantized once to the established six-digit material input. This is a colour blend, not a pigment or salon-dye simulation.

[Try the controls](http://localhost:5173/src/showcase.html?frame=portrait#hair-colours) · [Visual review](../review.html) · [API](../../../API.md) · [Independent critique](CRITIQUE.md)

## Actual native observations

The final product source is captured in **hair-tint-controls-v3**. It ran on Apple / metal-3 WebGPU at a 1440×1000 browser viewport (900×868 desktop canvas), with a separate 390×844 mobile observation.

| Brown base, tint off | Brown + 35% lavender | 100% lavender |
| --- | --- | --- |
| ![Brown base](../../../../captures/hair-tint-controls-v3/base-canvas.png) | ![35 percent tint](../../../../captures/hair-tint-controls-v3/mixed-canvas.png) | ![100 percent tint](../../../../captures/hair-tint-controls-v3/full-tint-canvas.png) |

Root and the independent critic directly inspected the actual product images. The rendered colours are distinguishable and the captured mobile controls fit without horizontal overflow. The existing fringe gaps, broad cards, crown breaks and lighting influence remain visible. Desktop full-page screenshots follow interaction-induced scrolling and sticky positioning: they document controls/content, not normalized desktop layout comparisons. No OS colour-picker dialog was visually qualified.

The recorded checks establish:

- Strict recipe validation, canonical lowercase colours, copied/frozen ownership, explicit-base requirement and rejection of missing/unknown fields, invalid colours and nonfinite/out-of-range amounts.
- Both cuts × seven bases × five amounts through exact configuration and URL round trips. Uppercase inputs normalize; duplicate or partial URL tint fields reject.
- Unapplied edits leave the attached configuration unchanged. Apply is recipe-aware even at 0%/100%; scene, outfit and cut changes keep the recipe.
- JSON download/open and browser-local named-look save/open restore base, tint and amount. Original restores the original material vector exactly. Live attached material vectors match the resolved recipe in every observed tinted state.
- A precision-sensitive amount, `0.12345678912345678`, survives toggling tint off/on and changing only its colour. The initial shared handler would have reconstructed the amount from a percentage and lost one floating-point unit; separate handlers now retain canonical state.
- Invalid SDK calls reject before allocation. An untracked public tint change causes export refusal. All 15 observed Avatar disposals report empty leak arrays; no browser errors are recorded. Source and accepted-asset hashes match at start/end.

No broad test suite, performance measurement or all-colour motion acceptance was run.

## Exact-image failure retained

All six v3 pairs fail the declared zero-changed-pixel gate, despite identical recorded hair/camera/light/noncolour-uniform state. No result or tolerance was changed to make them pass.

| Pair | Changed pixels / 781,200 | Maximum channel difference |
| --- | ---: | ---: |
| Base → independent same-base reload | 267 | 5/255 |
| Base → zero tint | 223 | 5/255 |
| Mixed → JSON reopen | 207 | 5/255 |
| Full tint → full tint with changed base | 373 | 4/255 |
| Original → Original restored | 96 | 5/255 |
| Mixed → named look reopen | 145 | 4/255 |

The same-base control prevents attributing these differences to tint from this evidence alone. Earlier untinted colour controls also retained a bounded nonidentical-image limitation; see the [prior control packet](../../hair-2026-09-29/colour-controls/README.md). That history does not excuse or resolve this gate.

The [predeclared follow-up](PLAN.md) made three independent loads of the same base, with two repeated 99-frame sequences at epoch zero and two at epoch 10,000 per page. Expanded observed state includes grade/grain/temporal counters, all bone/morph and mesh transforms, material scalars/vectors, lights and GPU hair. All comparisons agree in the recorded fixed state. Object/material IDs are stored separately and excluded from that comparison: the third load swaps body/tongue IDs and changes the tongue material ID. Traversal names/order agree, but they are not actual GPU draw order. These exceptions do not explain within-page differences where the IDs agree.

- Epoch-zero fresh loads differ by 231/268 pixels, maximum 4/5 codes. Same-page resequences differ by 70,034–70,049 pixels, maximum 22 codes.
- At epoch 10,000 the fresh-load comparisons are exact, but each same-page resequence still differs by 172 pixels, maximum 3 codes.
- The high-epoch observations always follow two zero-epoch sequences. Epoch and preceding history are confounded; this is **not** proof that a high counter fixes capture.
- Whole render-target contents and all private renderer histories are not included. Matching recorded state does not prove complete renderer equality. Root inspected the two epoch-zero native images as well as the product views.

Stop this product slice's capture diagnosis here. Retain the failed gate as a separate rendering issue; no reset/clock/shader/default path was changed. The broader history-reset investigation must define a controlled intervention before running again. The SDK promises recipe reconstruction, not byte-identical saved screenshots.

## Decision log and alternatives

1. **Keep an editable recipe.** Flattening the resolved mix into `hairColour` would lose the base and risk mixing twice on reopening. Chosen: optional base + tint recipe through every save path. Alternative: export only final colour, simpler but unable to restore the requested controls.
2. **Preserve untouched precision.** Chosen: separate tint-picker/amount handlers and remembered canonical state. Alternative: make the range itself use 0…1; less conversion code but still requires careful representation when showing percentages.
3. **Preserve exact-image failures.** The initial v1 harness called an unavailable GPU method; v2 corrected readback and failed its first image pair. V3 read state before final draw and added the same-base control; all product observations completed and the strict gate still failed. One bounded expanded diagnostic followed. Chosen: integrate the reviewed optional controls, explicitly withholding exact-render equivalence. Alternative: defer the control entirely until renderer determinism is attributed, which adds no evidence of a control defect and delays usable customization.
4. **Limit desktop layout claims.** Chosen: keep the actual interaction screenshots as content evidence and claim only observed mobile fit. Alternative: normalized top and interaction viewport captures with scroll/element bounds; use this for a future layout change.
5. **Stop representation churn.** This slice followed the rejected one-ring hair proxy. It produces a requested user control while preserving accepted geometry and all rejected candidates.

## Exact commands, jobs and recovery

| Command | Node PID | Outcome |
| --- | ---: | --- |
| `node tools/critic/hair-tint-controls-review.mjs --out=captures/hair-tint-controls-v1` | 78137 | Harness method failure; no product image |
| `node tools/critic/hair-tint-controls-review.mjs --out=captures/hair-tint-controls-v2` | 80183 | First exact image pair failed; images preserved |
| `node tools/critic/hair-tint-controls-review.mjs --out=captures/hair-tint-controls-v3` | 85053 | Functional observations complete; six exact-image failures retained; finished 15:22:32.828 UTC |
| `node tools/critic/hair-tint-repeat-diagnostic.mjs` | 97523 | Declared 12 observations complete; finished 15:30:16.230 UTC; cause unassigned |

All probe-owned browsers and temporary servers closed in their `finally` blocks. The existing review server is retained. The [summary](summary.json) pins report/source hashes; the [manifest](archive-manifest.json) freezes all five raw roots, including failed attempts and exact source copies. This is a local preservation record, not an off-machine backup. No accepted asset changed, and no push or publication occurred.

The local progress gallery and hub shortcut were captured by `node tools/critic/daytime-review-page.mjs`, Node PID 2738, completed at 15:36:19.608 UTC. Its three actual images loaded at 1440px and 390px; no page/HTTP errors or horizontal overflow were recorded. Root inspected both gallery screenshots. The full local packet contains 163 files / 104,049,459 bytes / 50 PNGs.
