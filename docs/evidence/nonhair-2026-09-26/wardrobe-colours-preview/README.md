# Static colour-control prototype review

`review.html` presents a held control idea, with the explicit status **Prototype — not in the live Wardrobe yet**. There is no JavaScript, live avatar, canvas, editable form or background simulation. Product/default promotion is not implied.

Four original PNGs were copied without modification by `prepare.mjs`: casual front base/custom examples from the rejected `feature-native-v1` rendering run, and desktop/mobile viewport witnesses from the accepted isolated UI run. `provenance.json` binds their absolute source paths, exact hashes, dimensions and raw report hashes. The body examples are illustrations, not accepted material proof. The technical page retains that distinction and the subsequent unsuccessful repeatability controls.

The page uses the existing olive/warm review palette. It has responsive uncropped images, original-image links, a keyboard skip link, descriptive alt text, and links to Today’s work and the current live Wardrobe. The desktop controls witness is shown full width; the phone witness is limited to its original width. Main-page copy explains Top/Bottom/Shoes, explicit Apply, applied settings and named looks, whole-palette clearing and the current Original restriction. Renderer details stay on the separate technical page.

CPU preflight completed with 14 exact source bindings, four image originals and 27 existing local link/resource destinations. Root's native static-page QA then passed four groups with four original screenshots, eight exact HTTP response bodies and zero errors or warnings. Browser and server closed cleanly. Root and the independent critic inspected the actual desktop/mobile viewport and full-page images; see `NATIVE-CRITIQUE.md`. This qualifies the static review page, not the held colour feature.

The exact compact result is in `native-v1/`, with receipt `5ae3052e2bd2b24cade2b2d976ec2770250bd3fe719f68ecb70ff9b9ebcfa7ca` and report `e810ae23aa9e6bb784871c01d971d0c5691b63fd35a86f3d32ffc99a47daa8d5`. The complete source archive remains in the ignored raw capture directory. Today’s work links this preview as its sixth comparison card.

The separate root-owned `check-today-link.mjs` then exercised that sixth card at 1440 × 1000 and 390 × 844: real keyboard Enter navigation, exact held status and return navigation, with no overflow or browser errors. Report `fb78843dd7c56b702ba1594b5226fff4726c83f80dcc41901f0908145fc20355` and both original card/focus screenshots are preserved in `today-link-v2/`. Root inspected both images. The first link-check harness incorrectly treated the old page's already-idle load state as completion of a newly requested navigation; its failed report/controller/image remain in `today-link-v1/`. The correction explicitly awaits the target URL before testing its page. No page/product change was needed for that harness failure.

```sh
node docs/evidence/nonhair-2026-09-26/wardrobe-colours-preview/probe.mjs --run docs/evidence/nonhair-2026-09-26/wardrobe-colours-preview/qa-manifest-v1.json captures/wardrobe-colours-preview-2026-09-26/native-v1
```

The controller serves only this page’s static bound files and opens native Chromium. It checks the held status, no script/canvas/avatar, keyboard skip navigation, complete image hashes/dimensions, uncropped ratios, no horizontal overflow, desktop/mobile layouts and the technical link. Four original browser screenshots are retained (viewport and full page for each size), along with response hashes, source copies, errors/warnings, shutdown and a completion seal. Links to live pages are checked as destinations without loading their renderers. Failure preserves the report and screenshot. This does not re-run or upgrade any avatar rendering qualification.

The author changed no product, Today landing, checkpoint, asset or dependency file and launched no browser/GPU job. Root performed the isolated static browser check and owns the Today link and integration checkpoint. Product/default assets remain unchanged.
