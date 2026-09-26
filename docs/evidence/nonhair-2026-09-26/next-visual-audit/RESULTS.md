# Compare the existing clothing palettes

Wardrobe now has a collapsed **Compare palettes** control below the three existing colour
buttons. It displays matched, complete Studio reference images for Ecru, Charcoal and Original
on the actual selected outfit. Each image applies its palette through the existing control.
The caption explains the fixed Studio reference and starting cut; the user's current room,
framing and cut remain selected. This adds a useful visual comparison of the two current outfit
studies, not new clothing geometry or a broader representative-character library.

## Native images and integration

The six unchanged native Save image PNGs passed exact within-outfit body/worn geometry, rig,
morph, camera and coverage-state comparisons. Root and the independent critic inspected all six
complete images before installation. Their byte hashes, 657 × 868 dimensions, source archive and
qualification limits are in `native-v1/receipt.json` and `NATIVE-CRITIQUE.md`. All accepted assets
and material recipes remain unchanged.

The final integrated browser run, `ui-native-v3`, passes eight focused groups:

- Keyboard disclosure preserves the current avatar/renderer, camera, clock, configuration and
  attention. The original three palette selectors stay unique.
- All six installed references match their qualified image hashes and dimensions. Swapping the
  outfit updates the correct reference group even with a different starting cut. The active
  palette remains a no-op.
- Applying a different reference preserves Kitchen/portrait and Studio/Warm settings, the mixed
  outfit and the user's current cut.
- Mobile cards contain complete images, have no horizontal overflow and show native keyboard
  focus. One exported JSON settings file restores the exact configuration.
- A real injected image-decode failure displays local fallback text; normal palette navigation
  remains usable. One named saved look also reopens the same configuration.
- Eight unique native owners have exactly matching ordered retirement receipts: seven actual
  navigations and one explicit final pagehide handler fixture. All report disposed ownership,
  no leaked handles and zero tracked renderer memory. Browser errors are empty.

The report retains 27 warnings rather than calling the page warning-free. Asset/image responses
include 77 hash-verified 200s and 44 strictly validated 304 revalidations, each linked to an
earlier actually observed matching body/validator. The two rejected earlier UI runs and their
instrument corrections are preserved in `RESPONSE-REPAIR.md`; neither is counted as a pass.
This is focused dev-server evidence, not an exhaustive configuration matrix, BFcache test or
production-build rendering test.

Exact final raw report: `c94ebd736d746c598159cd3ae202be30c868270a177267f914b7300cf253d654`.
Manifest: `373f9c605455a16e6c99b8cc8c0203adb1463e17ca308661b6eb189612517299`.
The compact `ui-native-v3/` packet retains the losslessly compressed report, seal, actual JSON
export and all eight untouched full-page/viewport screenshots. Its receipt is
`d861edabdce50071f7cd6186f864ee122f31592b73a9a662b452ec2929142992`.

Root inspected the final desktop viewport, complete mobile page, focused mobile card and failure
fallback views. The whole-outfit references distinguish the coordinated clothes and footwear;
desktop stays compact and mobile uses larger stacked cards. Dark Charcoal edges are less distinct
against Studio and the fixed images retain existing appearance limitations. This UI does not
declare garment fit, hair, skin, motion or AAA appearance accepted.

All 18 review pages build (208 modules), with the existing large-chunk warning; 92 catalogue
assertions pass. Product integration adds static image imports, one DOM mount and an update from
the actual attached outfit/style. It adds no renderer, storage schema or appearance recipe.
Independent final integrated-image review is recorded separately in `UI-CRITIQUE.md`.
