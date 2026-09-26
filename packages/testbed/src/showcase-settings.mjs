import { SHOWCASE_PRESETS, SHOWCASE_OUTFITS, optionsForShowcase } from './showcase-presets.mjs';

export const SHOWCASE_SETTINGS_MAX_BYTES = 16 * 1024;

function sameOptions(actual, expected, path = 'settings') {
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length ||
            expected.some(value => !actual.includes(value))) throw new Error(`Unsupported ${path}.`);
    } else if (expected !== null && typeof expected === 'object') {
        if (!actual || typeof actual !== 'object' || Array.isArray(actual)) throw new Error(`Missing ${path}.`);
        for (const key of Object.keys(actual)) if (!Object.hasOwn(expected, key))
            throw new Error(`Unsupported ${path}.${key}.`);
        for (const [key, value] of Object.entries(expected)) sameOptions(actual[key], value, `${path}.${key}`);
    } else if (actual !== expected) throw new Error(`Unsupported ${path}.`);
}

/** Restore only complete settings that this page can faithfully reconstruct, never a partial look. */
export function selectionFromConfiguration(configuration) {
    const preset = SHOWCASE_PRESETS.find(item => item.hair === configuration?.hair);
    if (!preset) throw new Error('Choose settings saved from one of these two wardrobe studies.');
    const garments = configuration?.wardrobe?.outfit;
    const outfit = Object.keys(SHOWCASE_OUTFITS).find(id => Array.isArray(garments) &&
        garments.length === SHOWCASE_OUTFITS[id].garments.length &&
        SHOWCASE_OUTFITS[id].garments.every(garment => garments.includes(garment)));
    const selection = { preset: preset.id, outfit, style: configuration.wardrobe?.style ?? 'original',
        frame: configuration.frame, light: configuration.lighting };
    let expected;
    try { expected = optionsForShowcase(selection); }
    catch { throw new Error('These clothes, colours, framing or light are unavailable in this study.'); }
    // The SDK also accepts explicit "original"; exports omit it. Both mean the same attached fabrics.
    if (configuration.wardrobe.style === 'original') expected.wardrobe.style = 'original';
    sameOptions(configuration, expected);
    return selection;
}

export async function readShowcaseSettings(file) {
    if (file.size > SHOWCASE_SETTINGS_MAX_BYTES) throw new Error('Settings files must be 16 KB or smaller.');
    const text = await file.text();
    let configuration;
    try { configuration = JSON.parse(text); }
    catch { throw new Error('This file is not valid JSON. Choose a saved settings file.'); }
    return selectionFromConfiguration(configuration);
}

export function showcaseSettingsUrl(selection, href) {
    const url = new URL(href), capture = url.searchParams.has('capture');
    // Discard unrelated/debug overrides instead of allowing them to change the restored options.
    url.search = '';
    for (const [key, value] of Object.entries(selection)) url.searchParams.set(key, value);
    if (capture) url.searchParams.set('capture', '');
    return url;
}
