# Next visible slice: compare the existing clothing palettes

September 26 read-only planning audit. No new renderer/browser/GPU job, source/asset edit, or material selection was made. Existing rendered PNGs were visually inspected, alongside the current queue, roadmap and source.

**Recommendation:** add a small, matched visual palette chooser for the two supported outfits. Show three real full-look reference images together (Ecru / Charcoal / Original), with an outfit switch and an explicit action to apply the chosen palette through the existing Wardrobe navigation. This gives the user a visual way to compare and customize the clothes already available.

## What is proved

The unmet capability is simultaneous appearance comparison, not a claim that a current colourway is defective. `showcase.html:31–33` provides text-only starting cards, outfit buttons and palette buttons. The actual desktop/mobile plates below confirm that presentation. `showcase.js:267–274` recreates the page for each palette selection, releasing attention and restarting the owned view. `showcase.js:36–55` and the latest saved-look plates show names and configuration summaries without visual previews. Users can inspect/export one live look at a time; they cannot compare the three current palettes in the product.

The reviewed Kitchen plates make the need concrete: the Ecru blouse reads as pale fabric with restrained dark stripes, dark socks and brown shoes; the Original witness has prominent red/black stripes and pale socks. These are different garment compositions, not adequately described by a single colour name. These particular images are **not a matched palette experiment**: camera, motion, cut and capture contexts differ. They establish visible ingredients and the UI gap only. No complete current six-look matched image set was found in the inspected paths; the historical September 13 documentation links a local `captures/wardrobe-colourways-2026-09-13/review.html` archive that is absent at that exact path. Its old numerical prose is not a replacement image set.

This advances the roadmap's concrete instruction to show configurations people can compare, save and customize. It does not satisfy the separate male/female/gender-neutral starter-build requirement: these remain two garments on g050 with three palettes.

## Two bounded alternatives

| Alternative | Useful outcome | Tradeoff |
| --- | --- | --- |
| **A — matched real-image chooser (recommended)** | One visible three-column palette comparison for the selected whole outfit; all garments and footwear stay in frame. A labelled “Apply palette” uses existing navigation. A fixed Studio-reference label avoids implying it is the current camera or Kitchen lighting. | Requires six fresh serial native reference captures and a small static image UI. It shows appearance more honestly than swatches, but does not dynamically reflect every cut/room/orbit. Keep the fixed reference explicit; no additional live avatars. |
| B — labelled coordinated swatches beside the current palette buttons | Shows top, lower garment and footwear colours with minimal UI and no renderer work; retain names and current pressed state. | Swatches cannot show the printed Original fabrics, retained denim fading, blouse texture, socks or lighting. They help discoverability but leave the main composition comparison unresolved. Do not claim they are exact rendered colours. |

Prefer A over adding another speculative colour recipe. The current dark-sock/brown-shoe proportions and pronounced blouse folds remain documented quality opportunities, but these images alone do not select a justified material/geometry correction. A comparison makes the next aesthetic choice reviewable without reopening fit or body identity work.

## Small executable qualification plan

After root releases the source/GPU freeze, capture only the six whole-outfit/palette references from current production assets: two unchanged authored presets × three styles: Everyday/casual with accepted bob02, and After hours/elegant with accepted bob01, on g050. Use Studio/default-light/full-look, existing seed 20260807 and the same native idle duration/camera within each preset. The accepted cut stays fixed across its three styles; hair is neither a compared variable nor a modification. Use unchanged production Wardrobe material setup and actual attached style readback. Capture serially; verify equal body/rig/camera/garment geometry and masks across the three palettes within each outfit, no browser/renderer errors, and clean retirement. Keep the existing hair as captured and outside evaluation. Do not reuse unmatched Kitchen/Studio screenshots as the six matched thumbnails.

Use ordinary full-look images with `object-fit: contain`; no generated visuals, head/foot cropping, thumbnail-only hidden outfit detail, colour-only selection state or extra live WebGPU canvases. Labels must name the outfit and palette, plus “Studio reference”; thumbnails are examples, not the live state. On mobile allow a readable stacked comparison instead of shrinking three complete figures into an unusable strip. Opening/closing the chooser must leave the live owner, clock, camera and attention unchanged. Applying a palette may use the existing documented fresh-view behavior, preserving the user's actual cut/outfit/frame/room/light parameters. Selecting the already active palette remains a no-op.

Focused product evidence: one desktop and one mobile comparison screenshot; keyboard open/close/select and visible focus; broken-image feedback; actual applied `appearance.style` and preserved selection after one alternative palette; existing save/open settings remain compatible. Independent critique must judge whether the six real images make the outfit differences legible. No new schema, local-storage image cache, cue API, body fit, garment split, or material recipe is needed.

## Minimal integration contract

Keep the existing `#style-controls` fieldset, three canonical `[data-style]` buttons, style IDs and native palette navigation unchanged. Add one collapsed **Compare palettes** disclosure inside that fieldset, below the current buttons. It contains three real full-look references for the currently attached outfit, with Ecru / Charcoal / Original names and explicit “Apply … palette” actions. The common caption can read: “Studio, full-look references. Your scene and framing stay as selected.” Show a small outfit label, since a mixed starting cut/outfit can legitimately select either whole garment.

The three image actions use `data-reference-style` and forward to the unique existing `[data-style]` button’s `.click()`, retaining the existing handler instead of adding navigation policy. The original selector cardinality stays three so current native tests remain unambiguous. Adding references under the existing fieldset lets ordinary loading/navigation disablement cover them. A small `update(outfit, style)` method called by `refresh()` sets reference pressed states and chooses the group from the **actual attached** `selected.outfit`; do not infer it from `selected.preset`, since mixed combinations are supported. No buttons may use `data-preset` or change haircut/outfit implicitly. Hidden alternate-outfit cards must not be keyboard focusable. Keep native `<details>/<summary>` semantics and usable minimum target sizes.

Use a finite six-entry manifest containing outfit, authored reference preset, style, image URL and descriptive alt text. Static import URLs must build with the testbed and work from its configured base path; no capture-directory absolute machine path, origin/port, runtime fetch service, persisted thumbnails or new dependency. Reference image load failure should show an inline “Reference unavailable” state while the canonical palette controls still work. Check that collapsed images do not initiate any additional live avatar or animation.

Acceptance is intentionally small: (1) inspect all six matched references uncropped and confirm hashes/provenance; (2) desktop keyboard disclosure and palette apply; (3) mobile layout and visible focus; (4) actual outfit swap updates the reference group, including a mixed preset/outfit; (5) a Kitchen/portrait selection applies a different palette without changing its scene/frame or accepted cut, while Studio/Warm likewise preserves its light; (6) same-style selection does not recreate the owner; (7) one failed thumbnail leaves live controls usable; (8) existing JSON export/import and a named saved look reopen the same supported configuration. Reuse the qualified native lifecycle path and check retirement/errors for the few actual navigations; do not rerun unrelated expression/collar/fit suites.

The reference grooms are exactly those of the existing authored presets. The chooser never changes or compares hair; it compares only the material styles within each outfit. The existing user-selected cut remains governed by the untouched current URL/configuration contract. Six cards do not imply six asset outfits, wider-body fit, or completed representative starter builds.

## Actual images inspected

- [casual-body.png](../scene/promoted-clothed-measured/casual-body.png) — Current accepted Kitchen, Ecru tee/denim: whole outfit and brown shoes are visible.
  SHA-256 `1670a9bac91896bb989ec7fccb69f485694be3522c106b5b64a5a558bf581e8c`.
- [elegant-body.png](../scene/promoted-clothed-measured/elegant-body.png) — Current accepted Kitchen, Ecru blouse/skirt: blouse texture, dark skirt, dark crew socks and brown shoes are visible.
  SHA-256 `4bffdf0b947f8b424c91003d1617dcfe20797ed7dc756f5e9f4ac786e547b7a1`.
- [showcase-body-bob02-desktop.png](../framing/accepted/showcase-body-bob02-desktop.png) — Earlier today, Studio full look: the actual clothed avatar is large, while starting looks and palette options are text-only. This predates Room/Saved looks UI.
  SHA-256 `1b85a90a5a709eb469bde263689dbae67f3ec7f16ffc1269fdca427b69c11dc4`.
- [showcase-1440x1000-initial.png](../review-scroll/candidate-v1/showcase-1440x1000-initial.png) — Studio portrait UI after sticky-preview work: both starting cards and all three palettes remain text-only.
  SHA-256 `621803dd215538f1cc3f333459c5582294edd6b1b8f1f305d91f5606bb1a47ad`.
- [showcase-1440x1000-mobile.png](../review-scroll/candidate-v1/showcase-1440x1000-mobile.png) — Mobile scrolled UI: text-only starting cards. Not evidence of initial head cropping.
  SHA-256 `327f2e6be92cfe2899e14884e2f1741a6e0a5b474e6ee779a6edf214c77bea49`.
- [two-saved-looks-desktop.png](../next-look/native-v2/two-saved-looks-desktop.png) — Latest saved-look desktop witness, Original blouse in Kitchen: red/black stripes, pale socks and brown shoes; saved rows contain names/configuration text only.
  SHA-256 `eec411d9d8af94f36766f8c2767170da5a2967b05cf6fca9b7c3b8f5675b5159`.
- [saved-looks-mobile.png](../next-look/native-v2/saved-looks-mobile.png) — Latest full-page mobile witness: starting cards, palette choices and two saved looks are all text-only.
  SHA-256 `4624c8f8a362b00f8b2372cb9457f8586c443f60fea40c315169c1dfd079cd4c`.

## Source binding at audit time

- `docs/NONHAIR-QUEUE-2026-09-26.md` — `6ad1569fe907de7e56bea5ab62cbe7ab83e61f4f20c6e40de62738f2f3055891`
- `docs/PRODUCT-ROADMAP.md` — `aab968772e4a825180c31249696965e47e613f1a3c5384c7171a2814372cdce6`
- `docs/WARDROBE-COLOURWAYS-2026-09-13.md` — `68643834e7ef3151583b541a80962c8478e6fd0114bd0058faaf76b411fd6d4e`
- `packages/testbed/src/showcase.html` — `487436a733aeb9b7d1e27969e7388e24e70acd131af7aab4448f677e524ddd33`
- `packages/testbed/src/showcase.js` — `1debe294b31fc00df9ff63f97b64ec43dd9453e609bb6308eb446206b36bc497`
- `packages/testbed/src/showcase-presets.mjs` — `9dcb441064e0c39b7c48eebdc60a2aee871c624c4fc00562250c9b5c3ae3a95b`
- `packages/testbed/src/showcase-collection.mjs` — `6e223be74c389559590310543085b7f6fbc15f75d2255b145e98ecdbb0095aa5`
- `packages/core/src/wardrobe/WardrobeStyles.js` — `b896ec3978130374a04760e576d61d1f049abc32a4cc9f592ad7f57fba75ee5a`

Limits: this is a product/visual planning recommendation, not an implemented feature or usability study. Hair, collar support, the missing native wardrobe oracle and accepted assets remain untouched. The broader wardrobe/representative-build ambition remains open.
