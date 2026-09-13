# Coordinated wardrobe colours — September 13, 2026

The Wardrobe studies page now offers Ecru, Charcoal and Original for both existing g050 outfits. Ecru is the lookbook's starting palette: a warm tonal top, dark indigo denim or a dark skirt, and restrained brown shoes. Charcoal offers a darker top and footwear; its jeans retain their original fading. The original printed tee and striped blouse remain available.

These are authored material variations on two existing combined garments. They do not add independently wearable separates, new body fits or completed representative characters. The accepted trouser fit, garment IDs, body/foundation masks, skinning and hair are preserved.

[Compare the matched views](../captures/wardrobe-colourways-2026-09-13/review.html). The local archive retains the original experiments and failed candidates; the live page uses only the final integrated materials.

## Use and saved settings

Choose a palette in `/src/showcase.html`. The palette follows outfit changes. Changing palette opens a fresh owned Avatar while retaining the selected outfit, framing and light; as with choosing another starting haircut, orbit and motion time restart. PNG exports capture the current view, and JSON exports preserve the applied palette.

```js
const avatar = await Avatar.create({
    canvas,
    identity: { gender: 0.5 },
    hair: 'bob02',
    frame: 'body',
    wardrobe: {
        style: 'ecru', // 'original' (API default), 'ecru', or 'charcoal'
        outfit: ['female_casualsuit01', 'shoes01'],
        foundation: { TORSO: 'foundation_bra', HIPS: 'foundation_briefs' }
    }
});
await avatar.dress(['female_elegantsuit01', 'shoes01']); // Keeps the ecru palette.
```

The API default remains original. The lookbook explicitly selects ecru. `wardrobe.appearance` in `avatar.report()` reports the fixed style and whether the stored applied material identities remain attached. Export refuses an unattached or unknown style. The public API does not expose a live style mutation method; create a new Avatar with different options. Saved Original settings retain their prior shape without an added style field.

## Appearance and ownership

The tee's full measured print area borrows unprinted cloth from its back UV patch. Tonal collar/cuff trim and restrained cloth variation remain. Denim, blouse stripes/buttons, skirt shading, shoe detail and sock ribbing retain source texture information. Original normal and occlusion maps remain in use. The finite recipes depend on the exact known atlas and vertex ordering.

For a styled known garment, the paired loader fetches once, checks the complete GLB SHA-256, then parses it. The same qualification applies at an external `assetBaseUrl`. Changed assets fail by name before parsing; callers may explicitly select Original for their own assets. Foundations and garments without an authored recipe retain their original material path. Only g050 clothing is currently supported.

Replacement materials are registered in the fragment's existing resource owner before adoption. Factory construction owns its allocation until it can return successfully, retiring an unreturned material if configuration throws. Source textures remain borrowed by the replacement and owned once by the fragment. Keeping the source diffuse in `.map` preserves the existing anisotropic filtering and shadow/alpha discovery path. All six recorded styles retain the corresponding Original geometry/vertex/index/storage/texture counts and bytes. No vertex attributes, geometry, texture assets or storage buffers are added. Shader programs and uniform bindings do change.

Retirement evidence covers normal internal disposal, failed adoption, cache release/reload and loads arriving after disposal. A pre-existing limitation remains: arbitrary user disposal listeners that throw can interrupt the existing resource-drain loop. This slice does not claim recovery from every cleanup exception.

## Review and rejected alternatives

The independent critic proves issues and supplies two alternatives for each:

- Uniform tee recolouring removed useful collar and cuff cues. Preserve tonal source detail and replace the complete printed patch, as selected; alternatively author an independent cloth/trim mask. The earlier patch missed part of the logo and was expanded using measured texel bounds.
- Late colour-region attributes can escape Three's first-render-object teardown, even if geometry counts reach zero. Use the validated existing vertex index, as selected; alternatively provide explicit attribute lifetime ownership. The proof measures missing retirement calls, not VRAM growth.
- Replacing a material before adoption could hide the diffuse from texture filtering. Retain `.map`, as selected; alternatively configure source textures before replacement.
- A factory that allocates and throws before returning cannot transfer that resource to its caller. Retire locally on construction failure, as selected; alternatively use an immediate owner-registration callback.
- Constant sock colour erased the ribbing exposed below the skirt. Tint the existing sock luminance, as selected; alternatively author a separate restrained knit pattern. The final close-up retains visible rib detail.

The first browser prototype mixed two Three module graphs and generated shader errors. Its initial harness missed console errors and reported completion; those images are explicitly invalid and are preserved as failure evidence. Subsequent captures listen for renderer console errors before saving images. The first built-page gate also retained an obsolete expected default configuration; the test now expects the deliberately selected ecru style. This was a test expectation failure, with no runtime repair required.

## Qualification and limits

Thirty final PNGs cover two outfits × three palettes × five views at four seconds of natural idle. All six actual skinned geometry/rig/hair/clock snapshots and corresponding cameras match the saved original controls exactly. All six renderer runs have no errors and all recorded native memory counters reach zero at retirement. Those states prove material-only changes within this comparison, not unrestricted garment collision clearance.

Six focused CPU groups cover exact-source qualification, configuration, geometry/mask equality between palettes, material cache identities, release/reload, late loads, adoption failure and factory-local rollback. Three independent production groups additionally verify exact assets at external URLs, altered-UV refusal before parsing with Original compatibility, concurrent load sharing, supersession, honest attachment reporting and exact-once normal retirement. The existing Avatar public API 137 assertions, Avatar wardrobe 13 groups and wardrobe 50 assertions pass. The built lookbook passes 24 browser groups, including real saved-settings reconstruction and previous-avatar retirement. Current-canvas PNG export passes 13 groups. Preset 4 groups and catalogue 92 assertions pass. All 18 testbed pages build; the existing large-chunk warning remains. This is not the full repository test suite or a frame-time benchmark.

The blouse's pronounced folds and collar, the shoe/crew-sock proportions, tightly fitted tee, wider clothing variety, independent separates and additional body fits remain open. Pale fabric makes existing hair transparency more noticeable. Current hair/face quality and the full AAA goal remain unfinished. Strong blue studio rim lighting changes perceived rear colours; the saved rear views are continuity evidence, not neutral-light colour calibration.

The evidence ledger and file manifest are in `docs/evidence/wardrobe-colourways-2026-09-13.json` and its companion `.manifest.json`. The raw local archive includes source snapshots, all candidates, comparison images, runtime states, browser logs and independent reviews. No assets were regenerated or pushed.

Final local archive: 279 files / 149,930,832 bytes, all reread and hash-verified. Tracked manifest SHA-256: `5fe505a34cb8da608d8848315b5f3f39029f5db081ac5897b7956096df0558d2`. The independent final review accepts this bounded integration. The watcher-free preview on port 5197 was refreshed at 14:09 PDT and its controls, modules, status text and archived gallery/image were HTTP-verified by 14:12 PDT.
