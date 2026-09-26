import assert from 'node:assert/strict';
import { SavedLooks, SAVED_LOOKS_KEY, savedLookSelection, savedLookName } from './showcase-collection.mjs';
import { optionsForShowcase } from './showcase-presets.mjs';
const store = () => { const entries = new Map(); return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), entries }; };
const options = (overrides = {}) => optionsForShowcase({ preset: 'casual', outfit: 'casual', style: 'ecru', frame: 'body', scene: 'studio', light: 'studio', ...overrides });
let checks = 0; const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
check('all 72 supported settings save canonically and reopen with names separate from options', () => {
    let combinations = 0;
    for (const preset of ['casual', 'elegant']) for (const outfit of ['casual', 'elegant']) for (const style of ['ecru', 'charcoal', 'original'])
        for (const frame of ['body', 'portrait']) for (const [scene, light] of [['studio', 'studio'], ['studio', 'warm'], ['kitchen', 'studio']]) {
            const storage = store(), library = new SavedLooks(() => storage, () => 'id'), expected = options({ preset, outfit, style, frame, scene, light });
            const item = library.add(' A look ', expected), restored = new SavedLooks(() => storage).open(item.id);
            assert.equal(item.name, 'A look'); assert.deepEqual(optionsForShowcase(restored.selection), expected);
            assert.deepEqual(restored.item.configuration, expected); assert.equal(Object.hasOwn(expected, 'name'), false); combinations++;
        }
    assert.equal(combinations, 72);
});
check('names, duplicates, identity and cap reject without changing stored data', () => {
    const storage = store(); let next = 0; const library = new SavedLooks(() => storage, () => `id-${next++}`);
    for (const name of ['', '  ', 'x'.repeat(41), 'a\nb', 'a\u0085b', 'a\u2028b', 'a\u2029b', null]) assert.throws(() => library.add(name, options()));
    assert.equal(savedLookName(' <img onerror=bad> '), '<img onerror=bad>'); assert.equal(savedLookName('🌿'.repeat(40)).length, 80);
    library.add('My look', options()); const before = storage.getItem(SAVED_LOOKS_KEY);
    assert.throws(() => library.add('my LOOK', options()), /already saved/); assert.equal(storage.getItem(SAVED_LOOKS_KEY), before);
    assert.throws(() => library.add('invalid', { ...options(), identity: { gender: 0, mode: 'nearest' } }));
    for (let i = 1; i < 12; i++) library.add(`look ${i}`, options()); const full = storage.getItem(SAVED_LOOKS_KEY);
    assert.throws(() => library.add('overflow', options()), /12/); assert.equal(storage.getItem(SAVED_LOOKS_KEY), full);
    assert.equal(storage.entries.size, 1); assert.ok(!SAVED_LOOKS_KEY.includes('agency'));
});
check('latest-read mutations preserve another tab, and scoped undo refuses any changed list', () => {
    const storage = store(); let next = 0; const a = new SavedLooks(() => storage, () => `a-${next++}`), b = new SavedLooks(() => storage, () => `b-${next++}`);
    const first = a.add('first', options()); a.read(); b.add('second', options()); a.add('third', options()); assert.equal(a.read().looks.length, 3);
    a.remove(first.id, first); assert.equal(a.canUndo(a.read().raw), true); a.undo(); assert.deepEqual(a.read().looks[0], first);
    a.remove(first.id, first); b.add('fourth', options()); const changed = storage.getItem(SAVED_LOOKS_KEY);
    assert.throws(() => a.undo(), /changed/); assert.equal(storage.getItem(SAVED_LOOKS_KEY), changed);
    const data = JSON.parse(changed); data.looks.push({ ...first, name: 'replacement' }); storage.setItem(SAVED_LOOKS_KEY, JSON.stringify(data));
    assert.throws(() => a.undo(), /changed/); assert.throws(() => a.remove(first.id, first), /changed/);
    assert.equal(a.open(first.id).item.name, 'replacement');
});
check('unsupported entries stay readable/removable, while malformed envelope blocks all writes', () => {
    const storage = store(), library = new SavedLooks(() => storage, () => 'new');
    const unsupported = { id: 'old', name: 'Older look', configuration: { hair: 'other' } };
    storage.setItem(SAVED_LOOKS_KEY, JSON.stringify({ version: 1, looks: [unsupported] }));
    assert.deepEqual(library.read().looks[0], unsupported); assert.throws(() => savedLookSelection(unsupported)); assert.throws(() => library.open('old'));
    library.add('Current', options()); assert.deepEqual(library.read().looks[0], unsupported); library.remove('old', unsupported); library.undo(); assert.deepEqual(library.read().looks[0], unsupported);
    for (const raw of ['{invalid', '{}', JSON.stringify({ version: 2, looks: [] }), JSON.stringify({ version: 1, looks: [unsupported, unsupported] }), JSON.stringify({ version: 1, looks: [], extra: true })]) {
        storage.setItem(SAVED_LOOKS_KEY, raw); assert.throws(() => library.read()); assert.throws(() => library.add('New', options())); assert.throws(() => library.undo()); assert.equal(storage.getItem(SAVED_LOOKS_KEY), raw);
    }
});
check('storage access/quota/interleaved changes fail visibly and preserve prior bytes', () => {
    assert.throws(() => new SavedLooks(() => { throw new Error('SecurityError'); }).read(), /unavailable/);
    assert.throws(() => new SavedLooks(() => ({ getItem() { throw new Error('SecurityError'); } })).read(), /unavailable/);
    const storage = store(), library = new SavedLooks(() => storage, () => 'id'); library.add('Original', options());
    const original = storage.getItem(SAVED_LOOKS_KEY); storage.setItem = () => { throw new Error('QuotaExceededError'); };
    assert.throws(() => library.remove('id'), /could not be updated/); assert.equal(storage.getItem(SAVED_LOOKS_KEY), original); assert.equal(library.undoRecord, null);
    let reads = 0, writes = 0; const raced = new SavedLooks(() => ({ getItem: () => ++reads === 1 ? null : original, setItem: () => writes++ }), () => 'new');
    assert.throws(() => raced.add('New', options()), /changed/); assert.equal(writes, 0);
});
console.log(`PASS ${checks} saved collection groups`);
