# Independent editor value decision

Read-only value gate, 20:32–20:42 UTC, 2026-10-03. No product edits, browser/GPU/native jobs, control interactions or appearance experiment by the critic.

**Decline new focus styling. Conditionally recommend one small clothing-editor description association.** Its value is exposing existing applied-versus-draft context at the control, not improving character appearance or establishing assistive-technology conformance.

## Actual witnesses

I actually viewed these unchanged accepted originals at original resolution:

- `docs/evidence/nonhair-2026-10-03/mobile-toolbar/archive/capture/mobile-body.png` (390×844): the focused Reset view has a conspicuous pale ring at approximately x176–270, y707–763. This is a positive focus witness, not evidence for restyling.
- `docs/evidence/nonhair-2026-10-03/hair-cut/archive/capture/desktop-long-bob.png`: selected Long bob, Tee + denim, Ecru, Portrait and Neutral are visibly distinguished in the sidebar. Mix colours is collapsed, so this original does not qualify the expanded editor or screen-reader output.
- `docs/evidence/nonhair-2026-10-03/hair-cut/archive/capture/mobile-chin-bob.png`: selected Chin-length bob, Blouse + skirt, Charcoal, Full look and Kitchen are distinguished. Mix colours is also collapsed. The dark hairstyle/context limitation remains unrelated to this proposal.

Current `packages/testbed/src/showcase.html:8` already defines a 2px accent outline for keyboard-focused buttons, links and summaries. `showcase-colour-controls.css:9` covers clothing inputs and `showcase-hair-colours.css:8` covers hair inputs/selects. No suppressed outline was found in the inspected editor sources. `showcase.js:221–226` supplies starter current and loaded-cut/choice pressed semantics. These facts and the actual Reset ring do not prove every control's keyboard traversal or focus contrast.

## One source-proved relation gap

`showcase.html:43–45` gives each clothing row a named checkbox, hex field and picker, plus a nearby `Applied:` text block. None of these nine inputs has `aria-describedby` or another explicit description relation to that applied text or the existing instruction/proposal text (`:41`, `:46`). `showcase-colour-controls.mjs:73–74` updates the applied text from the actual canonical clothing colours, independently of draft input values. `:39` already distinguishes draft-only state in a live status; `:27–28` already states the Apply/restart consequence. The missing relation is therefore demonstrable in source: there is useful current-state/context text, but a focused control has no declared description tying it to that text. This is not an observed screen-reader failure, an absent visible label, or a claimed WCAG violation.

**A — recommended:** add stable IDs to the existing full `Applied:` block in each row and existing concise guidance/proposal text; explicitly associate the row controls with the matching applied block and relevant instruction. Keep current accessible names, visible wording, styles and behaviour. The picker already names its initial grey as a proposal, so avoid unnecessary duplication. Global live feedback should not become all nine inputs' permanent description: an error in Top would then describe an unrelated valid Bottom. If error text is linked, link it only to a currently invalid hex field; Apply/Reset can use the editor-wide draft feedback where appropriate. This is a small, auditable semantic change; repetitive descriptions remain a usability tradeoff and actual assistive speech is untested.

**B — alternative:** incorporate applied/context text into each accessible or visible label. It can make the relation explicit without description references, but creates longer/changing names, risks duplicating visible text and is a wider presentation change. Retaining current markup is also reasonable if no narrowly specified description contract can be declared; the existing labels, nearby instructions and live status already provide substantial support.

## Bounded question and stop

Before implementation, declare the exact ID/control matrix and scope to the three clothing rows. One short product slice can ask: **do the descriptions resolve to the correct actual applied values and relevant help while draft/invalid/reset states change, without describing another row's error or changing the applied configuration?** Inspect ordinary current UI/DOM only; root owns any observation. Check unique/existing description targets, unchanged names, current row values, edited draft plus live draft-only status, invalid hex plus disabled Apply, Reset restoring the draft, and existing native disabled semantics for unavailable/Original controls. Do not Apply, reload an owner or promote any rendered appearance on this evidence. No blanket screen-reader, tab-order or accessibility-conformance claim.

Recommend at most a 20-minute implementation/one-observation slice after a new root plan; stop on a missing/misbound target or changed applied state. No editor redesign, focus-style change, new schema/cue/material or reopened closed packet. If the exact narrow relations cannot be stated first, decline the slice rather than expand into a generic accessibility audit.

## Readback pins

Saved 2026-10-03T20:37:26.855678+00:00; fs hashes only, no experiment.

- `packages/testbed/src/showcase.html` — 6e2b676c1353a9462c5a0c4f6ba59d3cff4a3202070cf064204ac2bcf55533fb
- `packages/testbed/src/showcase-colour-controls.mjs` — 16042662a79de2ba1469c4addf3b4c8ad6607a8004681003e007dc28a9961b88
- `packages/testbed/src/showcase-colour-controls.css` — f35072f31f03bd6d74e5be216ea7f781311a1781afb2765c455588921134699e
- `packages/testbed/src/showcase-hair-colours.css` — 08fd40c81cedcebec6669e4cbb68c4c14df0502a0ed0908a5465e2822ff4c678
- `packages/testbed/src/showcase.js` — 46cb5812515e43dae775d72a767399321d644d224386eafa32aa8d0632fbf189
- `docs/evidence/nonhair-2026-10-03/mobile-toolbar/archive/capture/mobile-body.png` — 35762fafc996857da75b97fe6ad86e21c294ef0f97b9d939ada7156e515dd3b6
- `docs/evidence/nonhair-2026-10-03/hair-cut/archive/capture/desktop-long-bob.png` — 82f8b02ff93380de2f88023b7f4c39da1411e213c47b8e845244cc4bb21567e5
- `docs/evidence/nonhair-2026-10-03/hair-cut/archive/capture/mobile-chin-bob.png` — 8aa09475e8127b0318addb6ef8d86ce1e46edfa898d82cbfabfbf91d191078bd
