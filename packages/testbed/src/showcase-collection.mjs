import { selectionFromConfiguration } from './showcase-settings.mjs';
import { optionsForShowcase } from './showcase-presets.mjs';

export const SAVED_LOOKS_KEY = 'sugata:showcase:saved-looks:v1';
export const SAVED_LOOKS_LIMIT = 12;
const MAX_STORED_LENGTH = 256 * 1024;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const copy = value => JSON.parse(JSON.stringify(value));
const nameKey = value => value.normalize('NFC').toLowerCase();
export function savedLookName(value) {
    if (typeof value !== 'string') throw new Error('Give this look a name.');
    const name = value.trim();
    if (!name || [...name].length > 40 || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(name)) throw new Error('Use a name with 1–40 characters on one line.');
    return name;
}
function parse(raw) {
    if (raw === null) return { version: 1, looks: [] };
    let data;
    try { if (raw.length > MAX_STORED_LENGTH) throw new Error(); data = JSON.parse(raw); }
    catch { throw new Error('The saved collection could not be read. Its stored data was kept.'); }
    const invalid = () => { throw new Error('This saved collection is unavailable in this version. Its stored data was kept.'); };
    if (!exactKeys(data, ['version', 'looks']) || data.version !== 1 || !Array.isArray(data.looks) || data.looks.length > SAVED_LOOKS_LIMIT) invalid();
    const ids = new Set(), names = new Set();
    for (const item of data.looks) {
        if (!exactKeys(item, ['id', 'name', 'configuration']) || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) invalid();
        let name; try { name = savedLookName(item.name); } catch { invalid(); }
        if (name !== item.name || ids.has(item.id) || names.has(nameKey(name))) invalid();
        ids.add(item.id); names.add(nameKey(name));
        // An obsolete/unsupported configuration remains removable and visible as unavailable.
        // Only metadata/envelope corruption blocks collection writes; Open validates options.
    }
    return data;
}
export function savedLookSelection(item) {
    return selectionFromConfiguration(item.configuration);
}

/** Page-owned storage, separate from wardrobe agency. No renderer, DOM or in-memory fallback. */
export class SavedLooks {
    constructor(storage = () => globalThis.localStorage, makeId = () => globalThis.crypto.randomUUID()) {
        this.storage = storage; this.makeId = makeId; this.undoRecord = null;
    }
    read() {
        let storage, raw;
        try { storage = this.storage(); raw = storage.getItem(SAVED_LOOKS_KEY); }
        catch { throw new Error('Saved looks are unavailable in this browser. You can still download settings.'); }
        return { storage, raw, ...parse(raw) };
    }
    commit(snapshot, data) {
        const encoded = JSON.stringify(data);
        if (encoded.length > MAX_STORED_LENGTH) throw new Error('The saved collection is too large. Existing looks were kept.');
        try {
            if (snapshot.storage.getItem(SAVED_LOOKS_KEY) !== snapshot.raw) throw new Error('changed');
        } catch (error) {
            if (error.message === 'changed') throw new Error('The saved collection changed. Try again.');
            throw new Error('Saved looks could not be read. Existing stored looks were kept.');
        }
        try { snapshot.storage.setItem(SAVED_LOOKS_KEY, encoded); }
        catch { throw new Error('Saved looks could not be updated. Existing stored looks were kept.'); }
        return encoded;
    }
    add(name, configuration) {
        name = savedLookName(name);
        const canonical = optionsForShowcase(selectionFromConfiguration(configuration));
        const current = this.read();
        if (current.looks.some(item => nameKey(item.name) === nameKey(name))) throw new Error('That name is already saved. Choose another name.');
        if (current.looks.length >= SAVED_LOOKS_LIMIT) throw new Error('All 12 saved-look spaces are used. Remove a look before saving another.');
        const id = this.makeId();
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || current.looks.some(item => item.id === id)) throw new Error('A new saved look could not be created. Try again.');
        const item = { id, name, configuration: canonical };
        this.commit(current, { version: 1, looks: [...current.looks, item] }); this.undoRecord = null;
        return copy(item);
    }
    open(id) {
        const item = this.read().looks.find(item => item.id === id);
        if (!item) throw new Error('This saved look was removed. Choose another look.');
        return { item: copy(item), selection: savedLookSelection(item) };
    }
    remove(id, expectedItem) {
        const current = this.read(), index = current.looks.findIndex(item => item.id === id);
        if (index < 0) throw new Error('This saved look was already removed.');
        if (expectedItem && JSON.stringify(current.looks[index]) !== JSON.stringify(expectedItem)) throw new Error('This saved look changed. Review it before removing it.');
        const item = current.looks[index], remaining = current.looks.filter(entry => entry.id !== id);
        const after = this.commit(current, { version: 1, looks: remaining });
        this.undoRecord = { before: { version: 1, looks: current.looks }, after };
        return copy(item);
    }
    canUndo(raw) { return this.undoRecord !== null && this.undoRecord.after === raw; }
    undo() {
        const current = this.read();
        if (!this.canUndo(current.raw)) throw new Error('The saved collection changed. That removal can no longer be undone.');
        this.commit(current, this.undoRecord.before); this.undoRecord = null;
    }
}
