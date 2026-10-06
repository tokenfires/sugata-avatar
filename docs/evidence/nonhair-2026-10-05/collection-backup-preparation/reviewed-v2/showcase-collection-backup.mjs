import { SavedLooks, SAVED_LOOKS_KEY, savedLookSelection } from './showcase-collection.mjs';

export const COLLECTION_BACKUP_MAX_BYTES = 2 * 1024 * 1024;
export const COLLECTION_RAW_MAX_CODE_UNITS = 256 * 1024;
const format = 'sugata-saved-looks';
const encode = value => new TextEncoder().encode(value);

function metadata(raw) {
    if (raw !== null && (typeof raw !== 'string' || raw.length > COLLECTION_RAW_MAX_CODE_UNITS))
        throw new Error('This backup contains an invalid or oversized collection.');
    // The existing collection reader owns metadata. Configuration text stays untouched.
    return new SavedLooks(() => ({ getItem: key => {
        if (key !== SAVED_LOOKS_KEY) throw new Error('Unexpected collection key.');
        return raw;
    } })).read().looks;
}
function descriptions(looks) {
    return Object.freeze(looks.map(item => {
        let available = true;
        try { savedLookSelection(item); } catch { available = false; }
        return Object.freeze({ name: item.name, available });
    }));
}
export function decodeCollectionBackup(text) {
    if (typeof text !== 'string' || text.length > COLLECTION_BACKUP_MAX_BYTES || encode(text).length > COLLECTION_BACKUP_MAX_BYTES)
        throw new Error('Collection backups must be 2 MB or smaller.');
    let value;
    try { value = JSON.parse(text); }
    catch { throw new Error('Choose a valid Sugata collection backup file.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== 3 || !['format', 'version', 'raw'].every(key => Object.hasOwn(value, key)) ||
        value.format !== format || value.version !== 1)
        throw new Error('This file is not a supported Sugata collection backup.');
    return Object.freeze({ raw: value.raw, looks: descriptions(metadata(value.raw)) });
}

/** Exact raw text owner. Never applies configurations or opens the avatar. */
export class CollectionBackup {
    #preview = null;
    #undo = null;
    constructor(storage = () => globalThis.localStorage) { this.storage = storage; }
    #current() { return new SavedLooks(this.storage).read(); }
    #write(snapshot, raw) {
        let current;
        try { current = snapshot.storage.getItem(SAVED_LOOKS_KEY); }
        catch { throw new Error('Saved looks could not be read. No change was made.'); }
        if (current !== snapshot.raw) throw new Error('Your saved looks changed. Preview the backup again.');
        try {
            if (raw === null) snapshot.storage.removeItem(SAVED_LOOKS_KEY);
            else snapshot.storage.setItem(SAVED_LOOKS_KEY, raw);
        } catch { throw new Error('Saved looks could not be updated. Try again.'); }
    }
    inspect() {
        const snapshot = this.#current();
        let stalePreview = false;
        if (this.#preview && this.#preview.before !== snapshot.raw) {
            this.#preview = null; stalePreview = true;
        }
        if (this.#undo && this.#undo.after !== snapshot.raw) this.#undo = null;
        return Object.freeze({ looks: descriptions(snapshot.looks), canUndo: this.#undo !== null,
            hasPreview: this.#preview !== null, stalePreview });
    }
    backupText() {
        const snapshot = this.#current();
        const text = JSON.stringify({ format, version: 1, raw: snapshot.raw }) + '\n';
        const bytes = encode(text);
        if (bytes.length > COLLECTION_BACKUP_MAX_BYTES || JSON.parse(new TextDecoder().decode(bytes)).raw !== snapshot.raw)
            throw new Error('This browser cannot make an exact collection backup. Your saved looks were kept.');
        return text;
    }
    preview(text) {
        const incoming = decodeCollectionBackup(text), snapshot = this.#current();
        this.#preview = { raw: incoming.raw, before: snapshot.raw };
        return Object.freeze({ looks: incoming.looks, replacing: snapshot.looks.length,
            unchanged: incoming.raw === snapshot.raw });
    }
    cancelPreview() { this.#preview = null; }
    restore() {
        if (!this.#preview) throw new Error('Choose a backup and preview it first.');
        const snapshot = this.#current(), pending = this.#preview;
        if (snapshot.raw !== pending.before) {
            this.#preview = null;
            throw new Error('Your saved looks changed. Preview the backup again.');
        }
        if (pending.raw === snapshot.raw) { this.#preview = null; return false; }
        this.#write(snapshot, pending.raw);
        this.#undo = { before: snapshot.raw, after: pending.raw }; this.#preview = null;
        return true;
    }
    undo() {
        const snapshot = this.#current();
        if (!this.#undo || snapshot.raw !== this.#undo.after) {
            this.#undo = null;
            throw new Error('Your saved looks changed. This restore can no longer be undone.');
        }
        this.#write(snapshot, this.#undo.before);
        this.#undo = null; this.#preview = null;
    }
    dispose() { this.#preview = null; this.#undo = null; }
}
