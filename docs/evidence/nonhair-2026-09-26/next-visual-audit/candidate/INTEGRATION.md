# Candidate integration (not applied)

Copy this small module/CSS into testbed source only after reference capture/review and root authorization. Keep production selectors, startup and URL/settings/saved-look schemas unchanged.

1. Bundle the six unchanged downloaded PNGs as static testbed imports, e.g. `import casualEcru from './palette-references/casual-ecru.png'`; form the six `{outfit, style, src}` records from those imports. No `/Users` paths or server-port URLs. Keep image/source receipts in the evidence folder.
2. Import `mountPaletteReferences` and the CSS. At module setup, before the existing `[data-style]` handler registration, mount once into `document.getElementById('style-controls')`.
3. In existing `refresh()`, after `selected.outfit` is read from the actual report, call `paletteReferences.update(selected.outfit, selected.style)`. This remains correct for mixed preset/outfit combinations. The six reference actions use `data-reference-style` and forward to the unique matching canonical button’s `.click()`. The original `[data-style]` cardinality stays three; the module updates only reference pressed states. Existing three text buttons, native tests, disabled state and same-style guard remain unchanged.
4. Keep `<details>` initially collapsed. This candidate creates no Avatar, fetch controller, animation, storage record, navigation function or live styling API. The fieldset owns loading/disabled behavior. Images fail locally without disabling canonical palette actions.

Shape of the two setup lines (actual import variable names are root-owned):

```js
const paletteReferences = mountPaletteReferences(document.getElementById('style-controls'), [
    {outfit:'casual', style:'ecru', src:casualEcru},
    {outfit:'casual', style:'charcoal', src:casualCharcoal},
    {outfit:'casual', style:'original', src:casualOriginal},
    {outfit:'elegant', style:'ecru', src:elegantEcru},
    {outfit:'elegant', style:'charcoal', src:elegantCharcoal},
    {outfit:'elegant', style:'original', src:elegantOriginal}
]);
// Within refresh, after actual wardrobe readback:
paletteReferences.update(selected.outfit, selected.style);
```

The group caption explicitly names the reference starting cut. Applying a palette keeps the actual cut, outfit, framing, scene and applicable light by reusing the untouched current handler. Current styling has three desktop columns and readable stacked mobile cards. Visual suitability is pending a real browser review; syntax checks cannot establish it.
