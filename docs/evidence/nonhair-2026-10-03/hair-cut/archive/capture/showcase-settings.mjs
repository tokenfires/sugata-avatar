import { resolveHairColour, resolveHairTint } from '../../core/src/material/HairColourOptions.js';
import { SHOWCASE_PRESETS, SHOWCASE_OUTFITS, optionsForShowcase } from './showcase-presets.mjs';
import { selectionWithColours, coloursFromSelection } from './showcase-colours.mjs';

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
    const hairColour = resolveHairColour(configuration.hairColour);
    const hairTint = resolveHairTint(configuration.hairTint, hairColour);
    const selection = selectionWithColours({ ...(hairColour === null ? {} : { hairColour }), ...(hairTint === null ? {} : { hairTint }),
        preset: preset.id, outfit, style: configuration.wardrobe?.style ?? 'original',
        frame: configuration.frame, scene: configuration.scene,
        light: configuration.scene === 'kitchen' && configuration.lighting === undefined ? 'studio' : configuration.lighting }, configuration.wardrobe?.colours);
    let expected;
    try { expected = optionsForShowcase(selection); }
    catch { throw new Error('These clothes, colours, framing, scene or light are unavailable in this study.'); }
    // The SDK also accepts explicit "original"; exports omit it. Both mean the same attached fabrics.
    if (configuration.wardrobe.style === 'original') expected.wardrobe.style = 'original';
    // Both hex cases are valid SDK input; reopened URLs and new exports are canonical lowercase.
    if (hairColour !== null) expected.hairColour = configuration.hairColour;
    if (hairTint !== null) expected.hairTint = configuration.hairTint;
    // Validate the supplied object before normalizing its hex spelling for comparison.
    // Empty styled colour objects are accepted as the canonical no-override configuration.
    const normalized = { ...configuration, wardrobe: { ...configuration.wardrobe } };
    if (Object.hasOwn(normalized.wardrobe, 'colours')) {
        if (expected.wardrobe.colours) normalized.wardrobe.colours = expected.wardrobe.colours;
        else delete normalized.wardrobe.colours;
    }
    sameOptions(normalized, expected);
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
    const canonical = selectionWithColours(selection, coloursFromSelection(selection));
    // Discard unrelated/debug overrides instead of allowing them to change the restored options.
    url.search = '';
    for (const [key, value] of Object.entries(canonical)) {
        if (key === 'hairTint') {
            url.searchParams.set('hairTintColour', value.colour);
            url.searchParams.set('hairTintAmount', String(value.amount));
        } else url.searchParams.set(key, value);
    }
    if (capture) url.searchParams.set('capture', '');
    return url;
}
