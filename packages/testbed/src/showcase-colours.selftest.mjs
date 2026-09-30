import assert from 'node:assert/strict';
import { optionsForShowcase, resolveShowcaseSelection, configurationFromReport } from './showcase-presets.mjs';
import { selectionFromConfiguration, readShowcaseSettings, showcaseSettingsUrl } from './showcase-settings.mjs';
import { SavedLooks, SAVED_LOOKS_KEY } from './showcase-collection.mjs';
import { coloursFromSelection, selectionWithColours, writeColourParams, customColourLabel } from './showcase-colours.mjs';
import { coloursFromDraft, mountColourControls } from './showcase-colour-controls.mjs';

let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log('PASS ' + name); };
const base = (values = {}) => ({preset: 'casual', outfit: 'casual', style: 'ecru', frame: 'body', scene: 'studio', light: 'studio', ...values});
const report = configuration => ({disposal: {disposed: false}, identity: {gender: .5, bake: 'figure_g050'},
    hair: {style: configuration.hair, loadedStyle: configuration.hair, attached: true},
    wardrobe: {attached: true, pendingCandidates: 0, appearance: {attached: true, style: configuration.wardrobe.style ?? 'original',
        ...(configuration.wardrobe.colours ? {colours: configuration.wardrobe.colours} : {})},
        requestedStyle: 'original', requestedColours: {top: '#ff0000'}, foundation: configuration.wardrobe.foundation,
        state: {worn: [...configuration.wardrobe.outfit, ...Object.values(configuration.wardrobe.foundation)]}},
    framing: {mode: configuration.frame}, scene: {id: configuration.scene, lighting: {look: configuration.lighting ?? 'studio'}},
    quality: {requested: 'balanced'}, motion: {seed: configuration.seed}});

await check('representative partial/full colours round-trip through actual export, strict JSON and canonical URL', async () => {
    for (const selection of [base({topColor: '#617A70', shoesColor: '#383A3F', scene: 'kitchen'}),
        base({preset: 'casual', outfit: 'elegant', style: 'charcoal', topColor: '#CBBBAD', bottomColor: '#3D5054', shoesColor: '#4B3639', frame: 'portrait', light: 'warm'}),
        base({style: 'charcoal', shoesColor: '#000000'}), base({bottomColor: '#FFFFFF'})]) {
        const expected = optionsForShowcase(selection), r = report(expected), exported = configurationFromReport(r);
        assert.deepEqual(exported, expected);
        const restored = await readShowcaseSettings({size: 1000, text: async () => JSON.stringify(exported)});
        const url = showcaseSettingsUrl(restored, 'http://localhost/src/showcase.html?capture=&debug=x');
        assert.equal(url.searchParams.has('debug'), false); assert.equal(url.searchParams.has('capture'), true);
        assert.deepEqual(optionsForShowcase(resolveShowcaseSelection(url.searchParams)), expected);
        assert.equal([...url.searchParams.values()].some(v => v === '[object Object]' || v === 'undefined'), false);
        const firstPart = Object.keys(exported.wardrobe.colours)[0]; exported.wardrobe.colours[firstPart] = '#ff0000';
        assert.notEqual(exported.wardrobe.colours[firstPart], r.wardrobe.appearance.colours[firstPart]);
    }
});
await check('invalid or duplicated colours and Original combinations reject without changing the supplied settings', () => {
    for (const query of ['topColor=%23123456&topColor=%23abcdef', 'bottomColor=red', 'shoesColor=%23abc',
        'style=original&topColor=%23123456', 'topColor=', 'shoesColor=%23000000ff'])
        assert.throws(() => resolveShowcaseSelection(new URLSearchParams(query)));
    for (const colours of [{socks: '#123456'}, {top: '#123456', extra: '#123456'}, JSON.parse('{"__proto__":"#123456"}'), {bottom: null}]) {
        const config = optionsForShowcase(base()); config.wardrobe.colours = colours;
        const before = JSON.stringify(config); assert.throws(() => selectionFromConfiguration(config)); assert.equal(JSON.stringify(config), before);
    }
    const original = optionsForShowcase(base({style: 'original'})); original.wardrobe.colours = {};
    assert.throws(() => selectionFromConfiguration(original), /Original/);
    const config = optionsForShowcase(base()); config.wardrobe.colours = {top: '#ABCDEF'};
    assert.equal(selectionFromConfiguration(config).topColor, '#abcdef'); assert.equal(config.wardrobe.colours.top, '#ABCDEF');
    config.wardrobe.colours = {}; assert.deepEqual(selectionFromConfiguration(config), base());
    const r = report(optionsForShowcase(base({topColor: '#abcdef'}))); r.wardrobe.appearance.attached = false;
    assert.throws(() => configurationFromReport(r), /not attached/);
});
await check('logical overrides follow mixed outfits; base selection removes every override URL key and keeps scene/frame/light', () => {
    const custom = base({topColor: '#617a70', bottomColor: '#123456', frame: 'portrait', light: 'warm'});
    const mixed = optionsForShowcase({...custom, outfit: 'elegant'});
    assert.equal(mixed.wardrobe.outfit[0], 'female_elegantsuit01'); assert.deepEqual(mixed.wardrobe.colours, {top: '#617a70', bottom: '#123456'});
    const cleared = selectionWithColours({...custom, style: 'charcoal'}, undefined);
    const url = showcaseSettingsUrl(custom, 'http://localhost/src/showcase.html'); writeColourParams(url.searchParams, cleared);
    assert.equal(url.searchParams.has('topColor'), false); assert.equal(url.searchParams.has('bottomColor'), false);
    assert.equal(url.searchParams.get('frame'), 'portrait'); assert.equal(url.searchParams.get('light'), 'warm');
    assert.equal(customColourLabel(custom), 'Custom colours: top, bottom'); assert.equal(customColourLabel(cleared), '');
    assert.equal(coloursFromSelection(base({style: 'charcoal'})), undefined, 'source denim is not converted into an invented hex');
});
await check('custom named looks preserve the version-1 envelope, actual normalized options and unrelated unsupported entries', () => {
    let raw = JSON.stringify({version: 1, looks: [{id: 'old', name: 'Unsupported', configuration: {hair: 'other'}}]});
    const storage = {getItem: key => {assert.equal(key, SAVED_LOOKS_KEY); return raw;}, setItem: (key, value) => {assert.equal(key, SAVED_LOOKS_KEY); raw = value;}};
    const saved = new SavedLooks(() => storage, () => 'custom');
    const input = optionsForShowcase(base({outfit: 'elegant', shoesColor: '#ABCDEF', topColor: '#FFFFFF'}));
    const item = saved.add('My combination', input); input.wardrobe.colours.top = '#000000';
    const reopened = saved.open(item.id); assert.deepEqual(reopened.item.configuration, item.configuration);
    assert.deepEqual(optionsForShowcase(reopened.selection), item.configuration);
    assert.equal(JSON.parse(raw).version, 1); assert.equal(JSON.parse(raw).looks[0].id, 'old');
    const before = raw; saved.remove(item.id, item); saved.undo(); assert.equal(raw, before);
    storage.setItem = () => {throw new Error('quota');}; assert.throws(() => saved.remove(item.id), /could not be updated/); assert.equal(raw, before);
});
await check('unchecked and untouched picker drafts have no implicit colour value', () => {
    const draft = {top: {enabled: false, value: 'invalid'}, bottom: {enabled: false, value: '#808080'}, shoes: {enabled: false, value: ''}};
    assert.equal(coloursFromDraft(draft, 'charcoal'), undefined);
    draft.bottom.enabled = true; draft.bottom.value = ''; assert.throws(() => coloursFromDraft(draft, 'charcoal'));
    draft.bottom.value = '#AABBCC'; assert.deepEqual(coloursFromDraft(draft, 'charcoal'), {bottom: '#aabbcc'});
});

// This small DOM fixture exercises the real draft controller's events/state only. It does
// not claim browser focus, fieldset inheritance, accessibility or rendered layout coverage.
class Control {
    constructor() { this.value = ''; this.checked = false; this.disabled = false; this.textContent = ''; this.events = new Map(); this.attributes = {}; }
    addEventListener(type, fn) { this.events.set(type, fn); }
    fire(type) { this.events.get(type)?.(); }
    setAttribute(key, value) { this.attributes[key] = value; }
}
await check('actual draft controller requires Apply, preserves drafts on refresh, resets on outfit changes and obeys Original/busy ownership', () => {
    const fieldset = new Control(), apply = new Control(), reset = new Control(), feedback = new Control(), guidance = new Control();
    const rows = Object.fromEntries(['top', 'bottom', 'shoes'].map(part => [part, Object.fromEntries(['[type=checkbox]', '[type=text]', '[type=color]', '[data-current-colour]'].map(key => [key, new Control()]))]));
    const controls = {fieldset, '[data-apply-colours]': apply, '[data-reset-colours]': reset, '[data-colour-feedback]': feedback, '[data-colour-guidance]': guidance};
    const container = {querySelector(selector) { const match = selector.match(/^\[data-colour-part="(\w+)"\]$/); return match ? {querySelector: key => rows[match[1]][key]} : controls[selector]; }};
    const applied = [], ui = mountColourControls(container, colours => applied.push(colours));
    ui.update({style: 'charcoal', outfit: 'casual'}); ui.setDisabled(false);
    assert.equal(rows.bottom['[data-current-colour]'].textContent, 'Source fabric colour');
    const enable = rows.bottom['[type=checkbox]'], text = rows.bottom['[type=text]'], picker = rows.bottom['[type=color]'];
    assert.equal(text.value, ''); assert.equal(picker.value, '#808080'); assert.equal(apply.disabled, true);
    enable.checked = true; enable.fire('change'); assert.equal(apply.disabled, true); assert.equal(text.value, '');
    text.value = '#3D5054'; text.fire('input'); assert.equal(apply.disabled, false); assert.equal(applied.length, 0);
    ui.update({style: 'charcoal', outfit: 'casual'}); assert.equal(text.value, '#3D5054');
    ui.setDisabled(true); apply.fire('click'); assert.equal(applied.length, 0);
    ui.setDisabled(false); apply.fire('click'); assert.deepEqual(applied, [{bottom: '#3d5054'}]);
    ui.update({style: 'charcoal', outfit: 'elegant', colours: applied[0]}); assert.equal(text.value, '#3d5054'); assert.equal(apply.disabled, true);
    ui.setDisabled(false); assert.match(feedback.textContent, /Draft reset for this outfit/);
    text.value = '#000000'; text.fire('input'); reset.fire('click'); assert.equal(text.value, '#3d5054');
    ui.update({style: 'original', outfit: 'elegant'}); assert.equal(fieldset.disabled, true); assert.equal(enable.checked, false);
    assert.match(guidance.textContent, /Choose Ecru or Charcoal/); assert.equal(applied.length, 1);
});
console.log(`PASS ${checks} custom colour settings/draft groups; native rendering and UI qualification pending`);
