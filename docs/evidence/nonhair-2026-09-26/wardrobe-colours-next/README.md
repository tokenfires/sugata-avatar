# Independent wardrobe colours: bounded design

Design only. No product implementation, asset change, browser or GPU run is part of this audit. The coordinator prefers **creation-time colour overrides with an explicit Apply action**. This extends the existing two combined outfits on g050; it does not deliver independent separates, new fits, or the full wardrobe/representation targets in `PUNCHLIST.md` 9.12 and `PRODUCT-ROADMAP.md`.

## Useful next feature

Add a collapsed **Mix colours** section beneath the existing palette controls. A user can enable a custom colour independently for **Top**, **Bottom** and **Shoes**, then choose **Apply colours**. Unchecked parts retain their base palette. Socks remain controlled by the base palette. A short explanation says that applying opens a fresh preview and restarts motion and orbit while keeping the selected outfit, cut, room, framing and light.

Original remains the imported-material path. Disable the customization controls on Original and explain: “Choose Ecru or Charcoal to mix colours.” Do not silently route Original through the styled loader. The API must reject Original plus a supplied colour-override object before asset allocation.

This is a useful next step because the current palette selector changes a coordinated whole outfit, while the existing material recipes already distinguish these three regions. The alternate body diffuse remains explicitly **not selected** in `../skin-attribution/alternate-diffuse/README.md`; it offers no reason to delay this product work.

## Existing ownership and material boundaries

| Source | Current behavior and consequence |
| --- | --- |
| `packages/core/src/wardrobe/WardrobeStyleOptions.js` | Finite Original/Ecru/Charcoal validation; API default Original. Keep those names and defaults. |
| `packages/core/src/wardrobe/WardrobeStyles.js` | Complete GLB SHA validation precedes parse; paired loader/factory recognizes only its verified meshes. Casual tee/denim boundary is vertex 1427; elegant skirt/blouse boundary is 408; shoes/socks boundary is 1542. Keep all source pins and region expressions. |
| `packages/core/src/wardrobe/AvatarWardrobe.js` | Original bypasses the styled loader. Styled options are fixed before Wardrobe construction. Validate optional colours before any native loading and pass them only to Ecru/Charcoal. |
| `packages/core/src/wardrobe/Wardrobe.js:418`, `:579`, `:965`, `:1095` | Style is immutable for a wardrobe lifetime because the fragment cache is keyed by garment ID. Attachment is checked against stored applied material identities. Replacement materials join the existing fragment resource owner before adoption. Originals and borrowed textures retain their existing disposal path. |
| `packages/core/src/Avatar.js:4625`, `:2499` | Configuration is copied by `resolveWardrobeOption`; reporting separates requested style from actual attached appearance. An optional colour object must be copied and validated here, carried through the owner, and exported from actual appearance. |
| `packages/testbed/src/showcase-presets.mjs`, `showcase-settings.mjs` | Actual attached report drives export. Settings accept only a complete supported configuration and reject unknown fields. Selection-to-URL currently serializes a flat object; a nested colour object must not accidentally become `[object Object]`. |
| `packages/testbed/src/showcase-collection.mjs` | A version-1 local collection stores bare configurations, revalidates on Open, canonicalizes on Add, and retains unsupported old entries. Existing compare-before-write, quota/error and scoped Undo behavior must remain. |
| `packages/testbed/src/showcase.js:286`, `showcase-palette-references.mjs` | Whole-palette changes create a fresh owner; references forward to exactly three canonical `[data-style]` buttons. The current same-style no-op must account for applied overrides. Reference images depict complete base palettes, not custom combinations. |

Change only the tint inputs to the existing recipe: `top` replaces the palette top; `bottom` replaces denim or skirt according to the actual garment; `shoes` replaces leather. Preserve luminance modulation, tee print repair/trim, blouse detail, normal/AO maps, regional roughness, alpha/shadow fields, textures, geometry, masks and skinning. Charcoal denim currently uses the sampled source RGB directly because its palette denim value is `null`; adding a bottom override deliberately enables the existing tint-and-luminance branch. No-override Charcoal must keep the sampled branch exactly.

Use the existing sRGB-hex-to-linear `Color` conversion once. Do not multiply a second tint over an already tinted output or rewrite texture pixels. No new vertex attributes, textures, buffer owners or mutable cached-material service is needed. Existing material identity readback is an ownership check, not an exhaustive detector of arbitrary external shader-node mutation; keep that limit explicit.

## Proposed strict optional contract

```js
wardrobe: {
    style: 'ecru',
    colours: { top: '#617a70', shoes: '#49342b' },
    outfit: ['female_casualsuit01', 'shoes01'],
    foundation: { TORSO: 'foundation_bra', HIPS: 'foundation_briefs' }
}
```

The example is a proposed configuration shape, not a visually qualified palette. `colours` is optional and partial; allowed own keys are exactly `top`, `bottom`, `shoes`. Each present value must be a string matching `^#[0-9a-fA-F]{6}$`, normalized to lowercase. Do not accept named CSS colours, shorthand, alpha, whitespace, null, numbers or implicit coercion. Build a fresh canonical object in fixed part order and freeze it; do not retain a caller-owned object.

Accept only ordinary or null-prototype data objects. Inspect own descriptors/keys before reading values: reject unknown names (including `__proto__`, `constructor`, `prototype`), symbols, accessors and non-enumerable supplied fields; reject inherited/custom-prototype inputs and arrays. Do not merge untrusted input into a prototype-bearing palette. This is strict data admission, not a general guarantee about hostile Proxy traps. For styled bases an empty valid object canonicalizes to absence. Original rejects a supplied object, even empty; an absent/undefined optional member stays absent. Keep unrelated existing wardrobe option semantics unchanged.

Extend the creation-time factory with an optional validated override argument. Hold the canonical colours as immutable Wardrobe-owned metadata alongside the fixed style. `appearance()` returns a fresh immutable copy of the effective override metadata only when applicable, retaining the existing material attachment check. `configurationFromReport` must use this actual owner metadata, never draft DOM values or an earlier request, and refuse pending/unattached states. Caller mutation of the input or a returned report must not change the owned materials or later exports. Without overrides, retain the old configuration and appearance shapes exactly.

Use three explicit optional flat selection/URL fields, `topColor`, `bottomColor`, `shoesColor`, and map them deliberately to `wardrobe.colours`. Reject duplicate fields and malformed values; canonicalize case and omit absent parts. Extend both directions of settings reconstruction and URL writing together. `refresh()` must read the attached owner colours before updating controls/URLs; `updateUrl()` and the separately authored preset links must explicitly write/remove all three fields. Saved JSON stays the existing bare Avatar configuration, and the local collection envelope stays version 1. Old valid settings and all existing combinations must round-trip unchanged. A previous application version may reject a newly customized configuration as unsupported; its existing collection reader should retain that entry rather than corrupt it. This is backward reading compatibility in the new application, not a promise that old binaries can render new fields.

## Draft and navigation semantics

- Each part has a labeled **Use custom colour** checkbox and an explicit draft value. Disabled/unchecked values never enter Apply. No body/material changes occur while editing; Apply is enabled only for a valid draft differing from the attached configuration. Reset draft restores actual attached choices without rendering or navigation.
- Do not invent a single current hex for source-textured Charcoal denim. When no override exists, label it “Source fabric colour”; its custom value is unset until the user enters or explicitly chooses a tint. A native colour picker may offer a clearly labeled proposed tint, but opening/toggling a control must not silently submit an untouched black/default value. A paired hex field permits exact keyboard input and validation.
- Applying validates the complete destination first, then follows the existing fresh-owner palette navigation and cleanup path. It preserves the selected outfit, accepted cut, room, frame and light. It does not promise continuity of orbit, attention, pause state or motion time across the new owner. Invalid input retains the existing owner and view.
- Switching the actual outfit preserves applied logical part overrides: Top maps tee to blouse, Bottom maps denim to skirt, Shoes stays shoes. Discard unsubmitted drafts with clear feedback when the outfit changes. Each cached or newly loaded garment must use the same immutable recipe. This is colour mapping, not swapping separate garment meshes.
- Choosing any whole palette or its reference clears all applied overrides and drafts, **including a reference for the currently selected base**. If it is already the same base with no applied overrides, clear draft locally and retain the existing no-reload behavior. Base-palette switching never silently carries custom colours forward.
- Room navigation preserves applied colour fields; frame/light changes retain the current owner and draft. Starting-preset links keep the current existing style/room behavior and carry applied logical colours while discarding draft; their existing authored-outfit/framing reset remains. Hair assets/behavior do not change.
- Label the canonical choices as the base palette and show “Custom colours” when overrides are attached. Custom combinations must not mark any whole-palette reference as an exact current look. Keep exactly three canonical `[data-style]` buttons. Saved-look descriptions identify customized parts; settings and image export describe/capture the applied look even if a draft is unfinished.

## Two alternatives and decision

**Recommended: immutable overrides with explicit Apply.** Reuses the qualified material factory, cache ownership and page navigation. It is straightforward to serialize, source-bind and retire. The tradeoff is a reload and motion/orbit restart rather than instant feedback; arbitrary user colours also need honest freedom-of-choice wording, not an appearance-quality guarantee.

**Defer: live uniform colour editing.** Provides immediate preview but needs a mutable native owner/API spanning cached and later-loaded fragments, transactional failure behavior, actual uniform readback and fresh lifecycle qualification. Original still cannot become a styled material for free. That is unnecessary scope for the first useful independent-colour slice.

## Bounded acceptance before integration

1. **Admission and backward compatibility (CPU):** partial/full/empty canonical objects; uppercase normalization; exact malformed/unknown/prototype/accessor/symbol cases; Original refusal before loading; caller/report mutation isolation. Retain existing 72 supported settings combinations and explicit-Original behavior. Add a small representative set of custom configurations across both outfits, including Charcoal source denim without an override; test strict JSON/URL and named-look round-trip, duplicate URL fields, storage failures/concurrency and unsupported-entry retention.
2. **Real material/resource ownership (CPU):** use existing exact GLBs and extend the current `WardrobeStyles.selftest.mjs` controls. Confirm no-override recipe equivalence; part override mapping; untouched socks and non-colour nodes/maps; exact geometry/index/mask equality; cache reuse and new-outfit construction; release/reload; adoption/factory failures and late arrival after disposal. Original retains its existing loader/material path. Run the relevant public API/wardrobe tests because option and report shapes are public.
3. **Focused native UI and rendering:** serial fresh pages, no broad colour sweep. Inspect one two-part casual combination and one three-part elegant combination, plus return to their unchanged base controls. Match native body/worn geometry, masks, rig, camera and motion state; record actual attached colour metadata and source/material bindings. Inspect ordinary front and rear/side renders for retained fabric, blouse stripes, trim, leather and sock ribbing. Check Studio/Warm and Kitchen ownership without lighting overrides; extreme valid hex endpoints may be smoke-tested for shader/finite behavior but are not aesthetically approved by that check.
4. **Meaningful interaction/lifecycle:** desktop keyboard and narrow mobile draft/validation/Apply; untouched Charcoal denim; applied mixed-outfit switch; same-base reference clearing custom colours; base-style no-op; Original guidance/refusal; one JSON and one named-look reconstruction; exports while an unapplied draft exists. Count each created owner and its actual retirement, retain raw warnings separately from errors/GPU failures, check native zero-memory cleanup, and keep the existing persisted-navigation controls behavior. Build all pages and run focused relevant tests after implementation; no tests were run or claimed by this design audit.

The whole RGB space cannot receive a finite visual-quality certificate. This feature exposes user-selected tints through already qualified region recipes; source detail, honest reconstruction and ownership are the acceptance targets. Existing garment fit, scene calibration, skin, hair and broader representative-look ambitions remain separate work.

`source-inventory.json` binds the exact files read for this design. It is an audit receipt, not a production manifest or a native qualification result.
