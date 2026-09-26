# Next small Wardrobe slice: named saved looks

Design only, September 26, 2026. No implementation, browser/GPU run, asset change or new fit judgment.

**Recommend a small, explicitly local “Saved looks” collection on the current Wardrobe page.** This implements the missing save/name portion of PUNCHLIST 9.12 and makes repeated human review easier. It is a partial customization improvement; it does not complete the wardrobe screen, agent outfit suggestions, representative builds or identity serialization.

## Documented need and current gap

- [PRODUCT-ROADMAP](../../../PRODUCT-ROADMAP.md), Wardrobe/customization and immediate work item 3, calls for examples people can compare, save and customize. [PUNCHLIST](../../../PUNCHLIST.md), 9.12, explicitly asks to save/name an outfit and reload it. Naming is a documented need; a browser-local collection is the proposed implementation, not a claim the roadmap prescribed this storage design.
- `showcase.js:104–122` exports the attached configuration as an unnamed Avatar-options JSON file with a generated `preset-outfit-style` filename. `openLook` at 123–143 restores an explicitly selected file through strict validation and full navigation. This works; the gap is that the page cannot list or name a person's saved combinations for later review. The filename also does not distinguish view/room/light variants.
- `showcase.html:30,38–40` contains two starting-look links and file export/import controls, with no name field or saved collection. `showcase.js:70` labels all mixed combinations “Your combination.” Its URL preserves current options, but there is no in-page history/collection of named choices.
- A targeted source search found no local/session storage use in the current Showcase implementation. The older `wardrobe.js:213–219` **does** use `WardrobeAgency` with `LocalStorageStore` and a `browsercheck` profile: do not claim persistence is absent from the whole project or reuse that agency store for review bookmarks.

## Why this over a combination catalogue

The page already exposes both whole outfits, all three palettes and both existing cuts. These make 12 appearance combinations on the same g050 body; framing and supported room/light choices bring the settings matrix to 72, not 72 different outfits. A new catalogue would mostly repackage choices already reachable through a few buttons. Thumbnail generation, curation and updates would cost more than a named list and would not increase style variety.

The two suits are single `BASE` garments, each occupying torso/arms/hips/legs in the current manifest. Their shirts and trousers/skirts cannot be independently mixed through the current garment API. An “individual pieces” catalogue would promise something the accepted assets do not provide. A future explicit catalogue is useful before agent suggestions, but should be derived from the supported study definitions and reviewed combinations, not all manifest entries (which also include the excluded fedora and alternate foundations).

## Smallest implementation

1. Add one collapsed “Saved looks on this browser” section to Showcase: a labeled name field, **Save current look**, and a compact list with a plain-language outfit/palette/room summary plus **Open** and **Remove**. Give the last removal an Undo action. Keep existing JSON portability and PNG controls. No thumbnails, accounts, automatic outfits, background autosave or automatic restore on startup.
2. Use a page-owned helper/module and a distinct versioned storage key, e.g. `sugata:showcase:saved-looks:v1`. Store a bounded list (proposed 12) of `{id,name,configuration}` inside `{version:1,looks:[...]}`. Names are trimmed, limited to 40 characters and rendered with `textContent`; reject empty/duplicate names clearly rather than silently overwrite. Metadata stays outside Avatar options, so existing strict JSON export/import remains compatible.
3. Save only `currentConfiguration()` after actual attachment, then validate/canonicalize through `selectionFromConfiguration` plus `optionsForShowcase`. Preserve mixed outfit, cut, palette including Original omission, framing, native Kitchen lighting omission and explicit Studio light. Open through the existing validated navigation path; do not add in-place renderer mutation. Saving/removing metadata must preserve current Avatar, camera, clock and attention.
4. Read the latest storage before mutation and react to `storage` events without changing the current look. Catch unavailable storage/quota errors; announce failure and preserve existing bytes/UI rather than claiming persistence. An invalid stored configuration cannot replace the current Avatar; leave its entry visible as unavailable. A malformed/unknown top-level collection blocks writes instead of overwriting stored data. Revalidate on Open, since another tab may have changed/removed the entry.
5. Say “Saved in this browser” and retain JSON download for portability. Storage belongs to the current origin/profile: `127.0.0.1:5173` and `localhost:5173` are different collections, and clearing browser data removes them. This is not cross-device persistence, `IdentityFile`, or agent pin/agency state. Camera orbit, motion time and attention remain viewing state and are not saved.

Suggested ownership: `showcase.html/.js`, one new pure collection helper/selftest and one focused native gate. No Portrait, core runtime, manifest, accepted asset or haircut changes.

## Acceptance without reopening appearance qualification

- CPU: complete supported configuration round trips; name/duplicate/count bounds; safe plain-text names; malformed/version/unsupported records; read/write/quota failures preserve prior data; Remove/Undo; latest-read semantics and no agency-key collision. Reuse the existing 72 settings matrix rather than invent a second validator.
- Native desktop: save two distinctly named actual looks (mixed charcoal/Warm Studio and Original/Kitchen), reload the page, reopen both and compare **attached** configuration and pressed controls; confirm saving/removing does not move the camera or release attention. Verify one JSON export still contains plain supported Avatar options.
- Native mobile: same persisted collection on the same browser context/origin after fresh mobile navigation; keyboard/focus labels, useful summaries and Open/Remove/Undo remain readable with no horizontal overflow. Exercise one unavailable-storage failure and one invalid stored look without disturbing the current view. One second-tab storage-event witness is sufficient; no full room/settings matrix replay.
- Independent critic uses the names/list to find a saved look, reopen it, and judge whether the section is understandable and pleasant. Bind source/asset hashes and ordinary screenshots; serialize GPU work and close owned sessions. These gates prove persistence/usability only, not new fit or representative character quality.

## Priority relative to the real remaining backlog

| Work | Value / next decision |
|---|---|
| Isolated expression readability experiment | Greater potential character-quality value; already has a bounded design. Keep it ahead of polishing a catalogue. A successful ownership gate alone cannot earn a new intent label. |
| Collar/upper-garment fit and socks/skirt finish | Greater visual value, but the current collar support has a verified fixed-face limit and is explicitly stopped today. A broader constraint/asset study needs its own design; a UI slice cannot fix it. |
| Representative male/female/gender-neutral builds | Central deliverable, not satisfied by relabeling g050. `manifest.figureCoverage` and every current garment fragment declare only g050. PUNCHLIST 10.9 wardrobe coupling gates 9.4 wider fits; asset existence or bake-load success is insufficient. |
| Named saved looks | Best small independent user-visible step within today's accepted-asset boundary: directly documented, builds on exact restoration already earned, supports the user's ongoing review. Implement one bounded collection, then return to visual-quality work. |
| Explicit catalogue / automated suggestions | Defer a larger gallery or Dresser. The available combinations can be described from current constants, but a catalogue does not establish fit, per-piece mixing, thermal/formality recommendations or permission to change an agent's clothes. |

PUNCHLIST 9.12 remains open after this slice: per-piece assembly and exhaustive interpenetration qualification are larger requirements. PUNCHLIST 10.5/10.6 remain open too: this collection does not carry identity intent/provenance, target-library migration or curated representative-build gates.
