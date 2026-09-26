import assert from 'node:assert/strict';
import { SHOWCASE_PRESETS, SHOWCASE_OUTFITS, optionsForShowcase, configurationFromReport, resolveShowcaseSelection } from './showcase-presets.mjs';
import { SHOWCASE_SETTINGS_MAX_BYTES, readShowcaseSettings, selectionFromConfiguration, showcaseSettingsUrl } from './showcase-settings.mjs';

let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log('PASS ' + name); };
const file = text => ({ size: Buffer.byteLength(text), text: async () => text });
const exported = options => configurationFromReport({ disposal: { disposed: false },
    identity: { gender: .5, bake: 'figure_g050' },
    hair: { style: options.hair, loadedStyle: options.hair, attached: true },
    wardrobe: { attached: true, appearance: { attached: true, style: options.wardrobe.style ?? 'original' },
        pendingCandidates: 0, foundation: options.wardrobe.foundation,
        state: { worn: [...options.wardrobe.outfit, ...Object.values(options.wardrobe.foundation)] } },
    framing: { mode: options.frame }, scene: { id: options.scene, lighting: { look: options.lighting } },
    quality: { requested: options.quality }, motion: { seed: options.seed } });
const normal = () => optionsForShowcase(resolveShowcaseSelection(new URLSearchParams()));

await check('48 complete attached-look exports reopen through JSON and page URL without losing settings', async () => {
    let combinations = 0;
    for (const preset of SHOWCASE_PRESETS) for (const outfit of Object.keys(SHOWCASE_OUTFITS))
        for (const style of ['ecru', 'charcoal', 'original']) for (const frame of ['body', 'portrait'])
            for (const light of ['studio', 'warm']) {
                const expected = optionsForShowcase({ preset: preset.id, outfit, style, frame, light });
                const settings = exported(expected), selected = await readShowcaseSettings(file(JSON.stringify(settings)));
                const url = showcaseSettingsUrl(selected, 'http://localhost:5173/src/showcase.html?capture=&gender=0&debug=old');
                assert.deepEqual(optionsForShowcase(resolveShowcaseSelection(url.searchParams)), settings);
                assert.equal(url.pathname, '/src/showcase.html'); assert.equal(url.origin, 'http://localhost:5173');
                assert.equal(url.searchParams.has('capture'), true); assert.equal(url.searchParams.has('debug'), false);
                assert.equal(url.searchParams.has('gender'), false); combinations++;
            }
    assert.equal(combinations, 48);
});
await check('JSON object key order, garment order and explicit original fabric preserve the same look', () => {
    const settings = normal(); settings.wardrobe.style = 'original'; settings.wardrobe.outfit.reverse();
    const reorder = value => Array.isArray(value) ? value : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])])) : value;
    const selection = selectionFromConfiguration(reorder(settings));
    assert.equal(selection.style, 'original'); assert.equal(selection.outfit, 'casual'); assert.equal(selection.preset, 'casual');
    assert.equal(showcaseSettingsUrl(selection, 'http://localhost/src/showcase.html').searchParams.has('capture'), false);
});
await check('unsupported or incomplete settings fail before they can become a partial restored look', () => {
    for (const mutate of [
        value => { value.identity.gender = 0; }, value => { value.identity.mode = 'interpolate'; },
        value => { value.seed++; }, value => { value.wardrobe.foundation.TORSO = 'foundation_vest'; },
        value => { value.wardrobe.foundation.HIPS = 'foundation_boxer_brief'; },
        value => { delete value.wardrobe.foundation; }, value => { delete value.pose; },
        value => { value.wardrobe.outfit = ['female_casualsuit01', 'female_casualsuit01']; },
        value => { value.wardrobe.outfit.push('fedora01'); }, value => { value.wardrobe.style = 'unavailable'; },
        value => { value.hair = 'arbitrary'; }, value => { value.scene = 'outdoors'; },
        value => { value.frame = 'neck'; }, value => { value.lighting = 'cool'; },
        value => { value.assetRoot = 'https://example.invalid/assets/'; },
        value => { value.identity.extra = true; }, value => { value.wardrobe.foundation.EXTRA = 'unknown'; }
    ]) {
        const settings = normal(); mutate(settings); const before = JSON.stringify(settings);
        assert.throws(() => selectionFromConfiguration(settings)); assert.equal(JSON.stringify(settings), before);
    }
    for (const invalid of [null, [], 'settings', 2, {}, { hair: 'bob01', wardrobe: null }])
        assert.throws(() => selectionFromConfiguration(invalid));
});
await check('malformed, oversized and unreadable files reject with actionable errors', async () => {
    await assert.rejects(readShowcaseSettings(file('{invalid')), /not valid JSON/);
    await assert.rejects(readShowcaseSettings({ size: SHOWCASE_SETTINGS_MAX_BYTES + 1,
        text: () => { throw new Error('must not read oversize input'); } }), /16 KB/);
    await assert.rejects(readShowcaseSettings({ size: 12, text: async () => { throw new Error('File could not be read'); } }), /could not be read/);
});
console.log(`PASS ${checks} showcase settings groups`);
