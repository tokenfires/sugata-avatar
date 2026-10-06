import assert from 'node:assert/strict';
import { CollectionBackup, decodeCollectionBackup, COLLECTION_BACKUP_MAX_BYTES, COLLECTION_RAW_MAX_CODE_UNITS } from './showcase-collection-backup.mjs';
import { SavedLooks, SAVED_LOOKS_KEY } from './showcase-collection.mjs';
import { optionsForShowcase } from './showcase-presets.mjs';

const memory = (initial = null) => {
    const entries = new Map(initial === null ? [] : [[SAVED_LOOKS_KEY, initial]]), writes = [];
    return { entries, writes, getItem(key) { return entries.get(key) ?? null; },
        setItem(key, value) { writes.push(['set', key, value]); entries.set(key, value); },
        removeItem(key) { writes.push(['remove', key]); entries.delete(key); } };
};
const raw = (name = 'Keep', id = 'keep') => JSON.stringify({ version: 1, looks: [{ id, name, configuration: null }] });
const pack = text => JSON.stringify({ format: 'sugata-saved-looks', version: 1, raw: text });
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

await check('all96 supported configurations and colour/tint data retain complete identity/order/names', () => {
    let count = 0;
    for (const preset of ['casual', 'elegant']) for (const outfit of ['casual', 'elegant'])
        for (const style of ['original', 'ecru', 'charcoal']) for (const frame of ['body', 'portrait'])
            for (const [scene, light] of [['studio', 'studio'], ['studio', 'warm'], ['studio', 'neutral'], ['kitchen', 'studio']]) {
                const selection = { preset, outfit, style, frame, scene, light, hairColour: '#59443b', hairTint: { colour: '#776699', amount: .23 },
                    ...(style === 'original' ? {} : { topColor: '#c5ba9e', bottomColor: '#292e34', shoesColor: '#714d36' }) };
                const configuration = optionsForShowcase(selection), text = JSON.stringify({ version: 1, looks: [
                    { id: 'original', name: 'My studio look', configuration }, { id: 'future', name: 'Future look', configuration: { format: 99 } }] });
                const source = memory(text), owner = new CollectionBackup(() => source), destination = memory(), restore = new CollectionBackup(() => destination);
                const file = owner.backupText(), preview = restore.preview(file);
                assert.equal(preview.replacing, 0); assert.equal(source.writes.length, 0); assert.equal(destination.writes.length, 0);
                assert.deepEqual(preview.looks, [{ name: 'My studio look', available: true }, { name: 'Future look', available: false }]);
                assert.equal(restore.restore(), true); assert.equal(destination.getItem(SAVED_LOOKS_KEY), text);
                const restored = new SavedLooks(() => destination).open('original'); assert.deepEqual(restored.item.configuration, configuration);
                assert.deepEqual(new SavedLooks(() => destination).read().looks.map(item => [item.id, item.name]), [['original', 'My studio look'], ['future', 'Future look']]);
                count++;
            }
    assert.equal(count, 96);
});
await check('actual Blob UTF8 transport preserves raw lexemes, overflow, negative zero and lone surrogates', async () => {
    const text = '{ "version":1, "looks":[{"id":"future","name":"Future","configuration":{"x":1e400,"negativeZero":-0,"decimal":1.000,"s":"' + String.fromCharCode(0xd800) + '"}}] }';
    const source = memory(text), owner = new CollectionBackup(() => source), backup = owner.backupText();
    const fileText = await new Blob([backup], { type: 'application/json' }).text();
    assert.equal(fileText, backup); assert.equal(decodeCollectionBackup(fileText).raw, text);
    const destination = memory(raw()), restored = new CollectionBackup(() => destination); restored.preview(fileText); restored.restore();
    assert.equal(destination.getItem(SAVED_LOOKS_KEY), text);
    const config = new SavedLooks(() => destination).read().looks[0].configuration;
    assert.equal(config.x, Infinity); assert.equal(Object.is(config.negativeZero, -0), true); assert.equal(config.s.charCodeAt(0), 0xd800);
    assert.equal(source.getItem(SAVED_LOOKS_KEY), text); assert.equal(source.writes.length, 0);
});
await check('null absence and empty envelope remain distinct through restore and one exact Undo', () => {
    for (const before of [null, '{"version":1,"looks":[]}']) for (const incoming of [null, '{ "version":1, "looks":[] }', raw('Incoming', 'in')]) {
        const store = memory(before), owner = new CollectionBackup(() => store);
        owner.preview(pack(incoming)); assert.equal(store.writes.length, 0);
        assert.equal(owner.restore(), before !== incoming); assert.equal(store.getItem(SAVED_LOOKS_KEY), incoming);
        if (before !== incoming) { assert.equal(owner.inspect().canUndo, true); owner.undo(); assert.equal(store.getItem(SAVED_LOOKS_KEY), before); assert.equal(owner.inspect().canUndo, false); assert.throws(() => owner.undo()); }
        assert.deepEqual([...store.entries.keys()], before === null ? [] : [SAVED_LOOKS_KEY]);
    }
});
await check('invalid metadata, unknown envelopes and duplicate names/IDs refuse without writes', () => {
    const invalidRaw = ['bad', '{}', '{"version":2,"looks":[]}', JSON.stringify({ version: 1, looks: [{ id: 'a', name: 'Name', configuration: null }, { id: 'a', name: 'Other', configuration: null }] }),
        JSON.stringify({ version: 1, looks: [{ id: 'a', name: 'Café', configuration: null }, { id: 'b', name: 'CAFE\u0301', configuration: null }] }),
        JSON.stringify({ version: 1, looks: Array.from({ length: 13 }, (_, i) => ({ id: String(i), name: String(i), configuration: null })) })];
    const invalidBackup = ['bad', '[]', '{}', pack(false), pack(123), JSON.stringify({ format: 'other', version: 1, raw: null }),
        JSON.stringify({ format: 'sugata-saved-looks', version: 2, raw: null }), JSON.stringify({ format: 'sugata-saved-looks', version: 1, raw: null, extra: true }),
        ...invalidRaw.map(pack)];
    for (const text of invalidBackup) {
        const store = memory(raw()), owner = new CollectionBackup(() => store); assert.throws(() => owner.preview(text));
        assert.equal(store.getItem(SAVED_LOOKS_KEY), raw()); assert.equal(store.writes.length, 0); assert.equal(owner.inspect().hasPreview, false);
    }
});
await check('literal raw code-unit boundary and transport byte/code-unit caps are distinct', () => {
    const base = '{"version":1,"looks":[]}', boundary = base + ' '.repeat(COLLECTION_RAW_MAX_CODE_UNITS - base.length);
    assert.equal(decodeCollectionBackup(pack(boundary)).raw, boundary);
    assert.throws(() => decodeCollectionBackup(pack(boundary + ' ')), /oversized/);
    assert.throws(() => decodeCollectionBackup(' '.repeat(COLLECTION_BACKUP_MAX_BYTES + 1)), /2 MB/);
    assert.throws(() => decodeCollectionBackup('é'.repeat(COLLECTION_BACKUP_MAX_BYTES / 2 + 1)), /2 MB/);
    assert.throws(() => decodeCollectionBackup(null), /2 MB/);
});
await check('invalid or inaccessible current store blocks backup/preview/Restore without repair', () => {
    for (const text of ['bad', '{"version":2,"looks":[]}']) {
        const store = memory(text), owner = new CollectionBackup(() => store);
        assert.throws(() => owner.backupText()); assert.throws(() => owner.preview(pack(raw('Incoming')))); assert.throws(() => owner.restore());
        assert.equal(store.getItem(SAVED_LOOKS_KEY), text); assert.equal(store.writes.length, 0);
    }
    const owner = new CollectionBackup(() => { throw Error('access denied'); });
    assert.throws(() => owner.inspect()); assert.throws(() => owner.backupText()); assert.throws(() => owner.preview(pack(null)));
});
await check('stale preview and Undo refuse separate-owner updates; observed changes invalidate permanently', () => {
    const store = memory(raw()), owner = new CollectionBackup(() => store), incoming = raw('Incoming', 'in');
    owner.preview(pack(incoming)); store.setItem(SAVED_LOOKS_KEY, raw('Other', 'other')); const changed = store.getItem(SAVED_LOOKS_KEY), attempts = store.writes.length;
    assert.throws(() => owner.restore(), /changed/); assert.equal(store.getItem(SAVED_LOOKS_KEY), changed); assert.equal(store.writes.length, attempts);
    owner.preview(pack(incoming)); owner.restore(); assert.equal(owner.inspect().canUndo, true);
    store.setItem(SAVED_LOOKS_KEY, raw('Later', 'later')); assert.equal(owner.inspect().canUndo, false);
    store.setItem(SAVED_LOOKS_KEY, incoming); assert.throws(() => owner.undo(), /changed/); assert.equal(store.getItem(SAVED_LOOKS_KEY), incoming);
    owner.preview(pack(raw())); store.setItem(SAVED_LOOKS_KEY, raw('Observed', 'observed')); assert.equal(owner.inspect().stalePreview, true);
    store.setItem(SAVED_LOOKS_KEY, incoming); assert.throws(() => owner.restore(), /preview/);
});
await check('raw no-op preserves an existing Undo and never consumes a storage write', () => {
    const before = raw(), after = raw('Incoming', 'in'), store = memory(before), owner = new CollectionBackup(() => store);
    owner.preview(pack(after)); owner.restore(); const writes = store.writes.length;
    assert.equal(owner.preview(pack(after)).unchanged, true); assert.equal(owner.restore(), false);
    assert.equal(store.writes.length, writes); assert.equal(owner.inspect().canUndo, true); owner.undo(); assert.equal(store.getItem(SAVED_LOOKS_KEY), before);
});
await check('commit-time interleaving is refused even after initial snapshot passes', () => {
    const store = memory(raw()), owner = new CollectionBackup(() => store); owner.preview(pack(raw('Incoming', 'in')));
    let reads = 0; const get = store.getItem.bind(store), later = raw('Concurrent', 'later');
    store.getItem = key => { if (++reads === 2) store.entries.set(key, later); return get(key); };
    assert.throws(() => owner.restore(), /changed/); assert.equal(get(SAVED_LOOKS_KEY), later); assert.equal(store.writes.length, 0);
});
await check('prewrite access/read/set/remove failures preserve raw and publish no new Undo', () => {
    for (const where of ['access', 'first-read', 'commit-read', 'set', 'remove']) {
        const before = raw(), store = memory(before), owner = new CollectionBackup(() => store); owner.preview(pack(where === 'remove' ? null : raw('Incoming', 'in')));
        const get = store.getItem.bind(store); let reads = 0;
        if (where === 'access') owner.storage = () => { throw Error('denied'); };
        if (where === 'first-read' || where === 'commit-read') store.getItem = key => { if (++reads === (where === 'first-read' ? 1 : 2)) throw Error('denied'); return get(key); };
        if (where === 'set') store.setItem = () => { throw Error('quota'); };
        if (where === 'remove') store.removeItem = () => { throw Error('denied'); };
        assert.throws(() => owner.restore()); assert.equal(get(SAVED_LOOKS_KEY), before); assert.equal(store.writes.length, 0);
        owner.storage = () => store; store.getItem = get; assert.equal(owner.inspect().canUndo, false);
    }
});
await check('failed Undo retains exact prior raw and permits retry when prewrite error clears', () => {
    for (const absent of [false, true]) {
        const before = absent ? null : raw(), after = raw('Incoming', 'in'), store = memory(before), owner = new CollectionBackup(() => store);
        owner.preview(pack(after)); owner.restore(); const set = store.setItem.bind(store), remove = store.removeItem.bind(store);
        if (absent) store.removeItem = () => { throw Error('denied'); }; else store.setItem = () => { throw Error('quota'); };
        assert.throws(() => owner.undo()); assert.equal(store.getItem(SAVED_LOOKS_KEY), after); assert.equal(owner.inspect().canUndo, true);
        store.setItem = set; store.removeItem = remove; owner.undo(); assert.equal(store.getItem(SAVED_LOOKS_KEY), before);
    }
});
await check('cancellation and disposal remove pending transaction authority without touching storage', () => {
    const store = memory(raw()), owner = new CollectionBackup(() => store);
    owner.preview(pack(null)); owner.cancelPreview(); assert.throws(() => owner.restore()); assert.equal(store.writes.length, 0);
    owner.preview(pack(null)); owner.restore(); owner.dispose(); assert.throws(() => owner.undo()); assert.equal(store.getItem(SAVED_LOOKS_KEY), null);
});
console.log(`PASS ${checks} whole-collection backup groups; fixture-memory only`);
