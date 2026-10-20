import assert from 'node:assert/strict';
import { SavedLookImport } from './showcase-look-import.mjs';
import { SavedLooks, SAVED_LOOKS_KEY } from './showcase-collection.mjs';
import { optionsForShowcase } from './showcase-presets.mjs';

const original = optionsForShowcase({ preset: 'casual', outfit: 'casual', style: 'original', frame: 'body', scene: 'studio', light: 'studio' });
const mixed = optionsForShowcase({ preset: 'elegant', outfit: 'casual', style: 'charcoal', frame: 'portrait', scene: 'kitchen', light: 'studio',
    hairColour: '#765344', hairTint: { colour: '#239c88', amount: .35 }, topColor: '#b78383', shoesColor: '#623c28' });
const entry = (id, name, configuration = original) => ({ id, name, configuration });
const encode = looks => JSON.stringify({ version: 1, looks });
const file = (configuration = mixed, extra = {}) => {
    const text = typeof configuration === 'string' ? configuration : JSON.stringify(configuration);
    return { text, size: new TextEncoder().encode(text).length, ...extra };
};
class Reader {
    constructor() { this.abortCalls = 0; this.abortEvent = true; }
    readAsArrayBuffer(input) {
        if (input.throwRead) throw new Error('reader failed synchronously');
        if (!input.hold) this.load(input.text);
    }
    load(text) { this.result = new TextEncoder().encode(text).buffer; this.onload?.(); }
    abort() {
        ++this.abortCalls;
        if (this.throwAbort) throw new Error('abort failed');
        if (this.abortEvent) this.onabort?.();
    }
}
function harness(looks = [entry('existing', 'Existing')], overrides = {}) {
    const storage = {
        raw: encode(looks), gets: 0, sets: 0, blocked: false, writeFailure: false,
        getItem(key) { assert.equal(key, SAVED_LOOKS_KEY); ++this.gets; this.onGet?.(this.gets); if (this.blocked) throw new Error('blocked'); return this.raw; },
        setItem(key, raw) { assert.equal(key, SAVED_LOOKS_KEY); if (this.writeFailure) throw new Error('quota'); ++this.sets; this.raw = raw; }
    };
    let next = 0, enabled = true, timerId = 0, cancellations = 0;
    const readers = [], timers = new Map();
    const saved = new SavedLooks(() => storage, overrides.makeId ?? (() => `imported_${++next}`));
    const importer = new SavedLookImport(saved, {
        available: () => enabled,
        makeReader() { if (overrides.factoryFailure) throw new Error('reader unavailable'); const r = new Reader(); readers.push(r); return r; },
        schedule(callback, ms) { assert.equal(ms, 15000); timers.set(++timerId, callback); return timerId; },
        unschedule(id) { assert.ok(timers.delete(id), 'timer is cleared only once'); ++cancellations; }
    });
    return { importer, storage, saved, readers, timers, initial: storage.raw,
        enable(value) { enabled = value; }, fire() { for (const callback of [...timers.values()]) callback(); },
        get cancellations() { return cancellations; } };
}
function untouched(h) { assert.equal(h.storage.raw, h.initial); assert.equal(h.storage.sets, 0); assert.equal(h.importer.busy, false); assert.equal(h.timers.size, 0); }
function retired(h) { assert.equal(h.importer.busy, false); assert.equal(h.timers.size, 0); for (const r of h.readers) assert.equal(r.onload, null); }
let count = 0;
async function test(name, check) {
    await check(); ++count; assert.ok(count <= 40);
    console.log(JSON.stringify({ case: count, name, passed: true }));
}

await test('canonical mixed recipe appends and preserves the existing item', async () => {
    const h = harness(), before = h.saved.read().looks[0];
    const item = await h.importer.add('  Imported  ', file());
    assert.equal(item.name, 'Imported'); assert.deepEqual(item.configuration, mixed);
    assert.deepEqual(h.saved.read().looks, [before, item]); assert.equal(h.storage.sets, 1); retired(h);
});
await test('original has no invented colour or wardrobe style', async () => {
    const h = harness(); const item = await h.importer.add('Original copy', file(original));
    assert.deepEqual(item.configuration, original); assert.equal(item.configuration.wardrobe.style, undefined); retired(h);
});
await test('UTF-8 decoding removes a BOM and keeps Unicode names', async () => {
    const h = harness(); const item = await h.importer.add('日常 🌿', file('\ufeff' + JSON.stringify(mixed)));
    assert.equal(item.name, '日常 🌿'); assert.deepEqual(item.configuration, mixed); retired(h);
});
for (const [name, input] of [
    ['malformed JSON', file('{')], ['unsupported settings', file({ ...mixed, quality: 'future' })],
    ['partial configuration', file({ hair: 'bob02' })], ['collection envelope', file({ version: 1, looks: [] })],
    ['empty file', file('')]
]) await test(name + ' leaves storage intact', async () => {
    const h = harness(); await assert.rejects(h.importer.add('Bad file', input)); untouched(h);
});
await test('oversize metadata refuses before allocating a reader', async () => {
    const h = harness(); await assert.rejects(h.importer.add('Big', file(mixed, { size: 16385 })), /16 KB/);
    assert.equal(h.readers.length, 0); untouched(h);
});
await test('an exactly 16384-byte supported file remains usable', async () => {
    const h = harness(); const item = await h.importer.add('At limit', file(JSON.stringify(mixed).padEnd(16384, ' ')));
    assert.deepEqual(item.configuration, mixed); retired(h);
});
await test('oversize read result refuses even with dishonest injected size', async () => {
    const h = harness(); await assert.rejects(h.importer.add('Big buffer', file(' '.repeat(16385), { size: 1 })), /16 KB/); untouched(h);
});
await test('missing or invalid file metadata refuses before reading', async () => {
    const h = harness(); for (const input of [null, { size: -1 }, { size: NaN }, { size: .5 }]) await assert.rejects(h.importer.add('File', input));
    assert.equal(h.readers.length, 0); untouched(h);
});
await test('invalid names refuse before reading', async () => {
    const h = harness(); for (const name of ['', '  ', 'line\nbreak', 'x'.repeat(41)]) await assert.rejects(h.importer.add(name, file()));
    assert.equal(h.readers.length, 0); untouched(h);
});
await test('forty Unicode scalar characters remain accepted', async () => {
    const h = harness(); assert.equal((await h.importer.add('🌿'.repeat(40), file())).name, '🌿'.repeat(40)); retired(h);
});
await test('normalized duplicate names are refused', async () => {
    const h = harness([entry('existing', 'Café')]); await assert.rejects(h.importer.add('CAFE\u0301', file()), /already saved/); untouched(h);
});
await test('all twelve spaces are preserved on full collection refusal', async () => {
    const h = harness(Array.from({ length: 12 }, (_, i) => entry(`id_${i}`, `Look ${i}`)));
    await assert.rejects(h.importer.add('Thirteenth', file()), /12/); untouched(h);
});
await test('blocked storage read leaves raw data intact', async () => {
    const h = harness(); h.storage.blocked = true; await assert.rejects(h.importer.add('Blocked', file()), /unavailable/); untouched(h);
});
await test('failed storage write reports failure without success', async () => {
    const h = harness(); h.storage.writeFailure = true; await assert.rejects(h.importer.add('Quota', file()), /could not be updated/); untouched(h);
});
await test('invalid new ID refuses without persistence', async () => {
    const h = harness(undefined, { makeId: () => '../bad' }); await assert.rejects(h.importer.add('ID', file()), /could not be created/); untouched(h);
});
await test('unrelated non-encodable numbers refuse reserialization', async () => {
    const h = harness(); h.storage.raw = encode([entry('future', 'Future', { value: 'NONFINITE' })]).replace('"NONFINITE"', '1e400'); h.initial = h.storage.raw;
    await assert.rejects(h.importer.add('New', file()), /cannot be safely/); untouched(h);
});
await test('unrelated supported-preservable future data stays visible and unchanged', async () => {
    const future = entry('future', 'Future', { future: true }), h = harness([future]);
    await h.importer.add('New', file()); assert.deepEqual(h.saved.read().looks[0], future); retired(h);
});
await test('collection changes during reading are included in fresh append', async () => {
    const h = harness(), pending = h.importer.add('Imported', file(mixed, { hold: true }));
    const existing = [entry('existing', 'Existing'), entry('other', 'Other tab')]; h.storage.raw = encode(existing);
    h.readers[0].load(JSON.stringify(mixed)); const item = await pending;
    assert.deepEqual(h.saved.read().looks, [...existing, item]); retired(h);
});
await test('established raw recheck refuses a change immediately before write', async () => {
    const h = harness(), changed = encode([entry('other', 'Concurrent')]); h.storage.onGet = n => { if (n === 2) h.storage.raw = changed; };
    await assert.rejects(h.importer.add('Imported', file()), /changed/); assert.equal(h.storage.raw, changed); assert.equal(h.storage.sets, 0); retired(h);
});
await test('double submit creates only one reader and one appended item', async () => {
    const h = harness(), pending = h.importer.add('First', file(mixed, { hold: true }));
    await assert.rejects(h.importer.add('Second', file()), /Wait/); assert.equal(h.readers.length, 1);
    h.readers[0].load(JSON.stringify(mixed)); await pending; assert.equal(h.storage.sets, 1); retired(h);
});
await test('cancel settles even when abort emits no event and ignores late load', async () => {
    const h = harness(), pending = h.importer.add('Cancelled', file(mixed, { hold: true })), r = h.readers[0], late = r.onload;
    r.abortEvent = false; h.importer.cancel(); await assert.rejects(pending, /cancelled/);
    r.result = new TextEncoder().encode(JSON.stringify(mixed)).buffer; late(); assert.equal(r.abortCalls, 1); untouched(h);
});
await test('timeout aborts and settles without a real timer wait', async () => {
    const h = harness(), pending = h.importer.add('Timeout', file(mixed, { hold: true }));
    h.fire(); await assert.rejects(pending, /too long/); assert.equal(h.readers[0].abortCalls, 1); untouched(h);
});
await test('terminal disposal prevents a pending and future import', async () => {
    const h = harness(), pending = h.importer.add('Disposed', file(mixed, { hold: true }));
    h.importer.dispose(); await assert.rejects(pending, /cancelled/); await assert.rejects(h.importer.add('Later', file()), /Wait/); untouched(h);
});
await test('host becoming unavailable before commit refuses then permits explicit retry', async () => {
    const h = harness(), pending = h.importer.add('Busy', file(mixed, { hold: true }));
    h.enable(false); h.readers[0].load(JSON.stringify(mixed)); await assert.rejects(pending, /became unavailable/); untouched(h);
    h.enable(true); await h.importer.add('Ready', file()); assert.equal(h.storage.sets, 1); retired(h);
});
await test('thrown abort still settles and reports unconfirmed browser reading stop', async () => {
    const h = harness(), pending = h.importer.add('Abort failure', file(mixed, { hold: true })); h.readers[0].throwAbort = true;
    h.importer.cancel(); await assert.rejects(pending, /could not confirm/); untouched(h);
});
await test('synchronous read failure cleans the timer and permits no write', async () => {
    const h = harness(); await assert.rejects(h.importer.add('Read failure', file(mixed, { throwRead: true })), /synchronously/); untouched(h);
});
await test('reader construction failure leaves no active operation', async () => {
    const h = harness(undefined, { factoryFailure: true }); await assert.rejects(h.importer.add('No reader', file()), /unavailable/); untouched(h);
});
await test('asynchronous read error leaves storage intact', async () => {
    const h = harness(), pending = h.importer.add('Error', file(mixed, { hold: true })); h.readers[0].onerror();
    await assert.rejects(pending, /could not be read/); untouched(h);
});
await test('old completion cannot release or write over a later operation', async () => {
    const h = harness(), first = h.importer.add('Old', file(mixed, { hold: true })), r = h.readers[0], late = r.onload, lateError = r.onerror;
    h.importer.cancel(); await assert.rejects(first); const second = h.importer.add('New', file(mixed, { hold: true }));
    r.result = new TextEncoder().encode(JSON.stringify(mixed)).buffer; late(); lateError(); assert.equal(h.importer.busy, true); assert.equal(h.storage.sets, 0);
    h.readers[1].load(JSON.stringify(mixed)); assert.equal((await second).name, 'New'); assert.equal(h.storage.sets, 1); retired(h);
});
await test('cancel after load but before async conversion cannot commit', async () => {
    const h = harness(), pending = h.importer.add('Late cancel', file(mixed, { hold: true }));
    h.readers[0].load(JSON.stringify(mixed)); h.importer.cancel(); await assert.rejects(pending, /cancelled/); untouched(h);
});
console.log(JSON.stringify({ passed: count, limit: 40, storage: 'fake only', reader: 'fake only', owners: 'real settings/options/SavedLooks' }));
