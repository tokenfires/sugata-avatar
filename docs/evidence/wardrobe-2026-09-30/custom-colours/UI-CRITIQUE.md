# Independent combined-colour UI review

## Disposition

**Accept the bounded combined wardrobe/hair interaction and observed desktop/mobile layout gate on UI v2.** Together with the separate [material critique](/Users/robault/GitHub/sugata-avatar/docs/evidence/wardrobe-2026-09-30/custom-colours/MATERIAL-CRITIQUE.md), this supports integration of the reviewed controls under the declared creation-time ownership contract. It does not pass or replace the still-failed exact-image property, qualify garment fit or motion, or certify every custom colour.

I reviewed the archived v1 controller, its desktop applied image, the narrow v1→v2 instrument change, the completed [v2 report](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v2/report.json), and all four original v2 screenshots. No product edit or native job was performed by this reviewer.

## Retained v1 image failure and bounded v2 correction

The [v1 desktop applied image](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v1/desktop-applied.png) visibly shows a bare scalp while the recorded recipe reports attached bob02 hair. That image cannot represent the complete configured avatar. In the [v1 controller](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v1/ui.mjs:13), `ready()` waits for Showcase and installs disposal recording, but does not render additional frames. Its URL uses capture mode, which disables the page's ordinary drawing loop. The material packet's controlled-draw images show actual hair on the same product source. This supports a capture startup/history hypothesis, not a proved underlying cause or a proved product UI regression.

Two concrete responses were available:

- **A — retain v1, then apply the already declared material draw protocol before each ready UI observation.** This provides complete-avatar screenshots with a recorded preparation step, but does not qualify the untouched first-frame experience or explain why the startup image lacked hair.
- **B — retain v1 solely as interaction/control-layout evidence and use the material packet separately for avatar appearance.** This avoids another capture, but leaves no complete-avatar desktop plate from the combined workflow.

Root selected A. [V2 source lines 16–19](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v2/ui.mjs:16) stop the renderer clock, reset its epoch, perform 98 zero-time steps and one final draw, and require frame 99/time 0/delta 0 for every ready owner. Product sources are unchanged and match the material feature phase exactly. Hair is visible in both v2 desktop screenshots. This corrects the reviewed capture preparation; it is not a renderer fix, exact-image pass or general startup acceptance.

## Functional evidence

V2 contains **14 state checkpoints, 10 named check groups, four screenshots and 10 unique ready owners**. I independently compared its source inventory to the material feature inventory, verified the archived controller and four PNG hashes, matched all 61 observed GLB response digests to the pinned asset inventory, and read the saved configurations. All ten ready clocks equal the declared values.

The actual controller sequence supports:

- A wardrobe draft leaves the applied hair recipe and base wardrobe unchanged. Explicit Apply adds Top `#617a70` and Shoes `#252a30` while retaining Brown hair with `#8063ac` tint at 0.35.
- Applying a later wardrobe draft ignores an unsubmitted Red hair draft. Conversely, applying tint `#224466` ignores an unsubmitted Bottom `#abcdef` draft and preserves the already applied Top/Shoes recipe.
- An in-place switch to the blouse/skirt retains logical colour parts and hair. Kitchen navigation retains both systems. Selecting the current Ecru base removes wardrobe overrides only; selecting that exact base again preserves owner identity, clock and camera.
- Wardrobe Original removes its style/override fields, disables Mix colours, and retains hair. Hair Original removes both hair base/tint fields while preserving custom wardrobe colours.
- The downloaded [JSON](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v2/combined-look.json), real file-input reopening and named-look reopening reconstruct the same complete combined recipe. Mobile resizing leaves it unchanged. An invalid `#zzzzzz` wardrobe draft disables Apply and leaves exported configuration intact.
- A separate Original-with-override call receives the early validation refusal. It does not produce an additional ready owner.

Exports observe the actual loaded hair recipe and the wardrobe's creation-time recipe plus attached material identity. This does not add same-object shader-node mutation detection beyond the limit recorded in the material critique.

## Actual screenshots

- [Desktop draft](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v2/desktop-clothing-draft.png): green Top and dark Shoes draft fields sit beside the still-Ecru avatar. “Applied: Base palette” and the draft notice explain that distinction. The focused Shoes text field has a visible outline, and Apply/Reset are available. Hair is present.
- [Desktop applied](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v2/desktop-applied.png): the green tee and blue-grey hair agree with the applied combined recipe. Top/Shoes labels show their applied values; unchecked Bottom remains “Base palette.” Apply/Reset are disabled when unchanged. Existing neckline chips and unfinished hair remain visible; they were not repaired or hidden by this feature.
- [Mobile wardrobe](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v2/mobile-clothing-controls.png): at 390×844, labels, enable boxes, text fields, picker swatches and actions fit horizontally. The distinction between a proposed picker value and applied fabric is readable. Vertical scrolling is expected.
- [Mobile hair](/Users/robault/GitHub/sugata-avatar/captures/wardrobe-colours-day-ui-2026-09-30-v2/mobile-hair-controls.png): Brown, base lightness 23%, enabled blue tint at 35%, resolved colour `#383d4a` and disabled unchanged Apply are readable within the viewport. This plate qualifies the controls shown; it does not show the mobile avatar simultaneously.

No new interaction or layout blocker is apparent in these views.

## Ownership, pins and limits

Ready IDs 1–10 match the ordered retirement records 1–10. The first nine follow navigation; the tenth is explicit final disposal by the harness. Each recorded retirement has `disposed:true` and `leaked:[]`. The wrapper records the first retirement per owner, so this is not a census of every `dispose()` invocation or an OS/GPU memory-reclamation proof. Page/console/HTTP error records are empty; 37 retained warnings remain distinct from errors. This UI harness is not a complete device-error or failed-request census.

V2 report SHA256: `159c4732ff051de8f455fc09439680f4e3c95307e54f5bd2e3394a12fdc6ac57`.
Archived UI controller: `c76c4b3b3b352086c8eb836dbb69993db90db3b3af8e4d3dff113dfe8ee0a0b3`.
Bound material report: `aeb5497832cee9562ffb1c51fcf6f013a396ce0e49d4d6c21b0a35ac36e405ef`.

This sequence uses real browser controls, including text entry, a hair tint colour-input fill, navigation, file input and local saved looks. It does not automate an operating-system picker. Current wardrobe values are entered through hex text fields; this run does not independently exercise their native colour-picker handler. It does not repeat Charcoal/source-denim behavior, every tint amount, full keyboard accessibility, normal live-motion startup or all storage failure modes. Existing source/older evidence remains separately scoped; none of these omissions implies a new defect or requires another generic retry loop.
