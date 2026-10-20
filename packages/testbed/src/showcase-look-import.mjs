import { readShowcaseSettings, SHOWCASE_SETTINGS_MAX_BYTES } from './showcase-settings.mjs';
import { optionsForShowcase } from './showcase-presets.mjs';
import { savedLookName } from './showcase-collection.mjs';

/** One page-owned file read. Collection validation and persistence stay in SavedLooks. */
export class SavedLookImport {
    constructor(savedLooks, { available = () => true, makeReader = () => new FileReader(),
        schedule = setTimeout, unschedule = clearTimeout } = {}) {
        this.savedLooks = savedLooks; this.available = available; this.makeReader = makeReader;
        this.schedule = schedule; this.unschedule = unschedule;
        this.active = null; this.generation = 0; this.disposed = false;
    }
    get busy() { return this.active !== null; }
    cancel(message = 'Import cancelled. Your saved looks were kept.') {
        const operation = this.active;
        if (!operation) return false;
        operation.cancelled = true; ++this.generation;
        const error = new Error(message);
        operation.cancelError = error;
        try { operation.reader?.abort(); }
        catch { error.message += ' The browser could not confirm that file reading stopped.'; }
        // Empty/done readers need not emit abort. Always settle our own Promise.
        operation.fail?.(error);
        return true;
    }
    dispose() { this.disposed = true; this.cancel(); }
    async add(name, file) {
        if (this.disposed || this.busy || !this.available()) throw new Error('Wait until saved looks are available.');
        name = savedLookName(name);
        if (!file || !Number.isInteger(file.size) || file.size < 0) throw new Error('Choose one saved settings JSON file.');
        if (file.size > SHOWCASE_SETTINGS_MAX_BYTES) throw new Error('Settings files must be 16 KB or smaller.');
        const operation = { generation: ++this.generation, cancelled: false, finished: false, reader: null, timer: null };
        this.active = operation;
        try {
            const text = await new Promise((resolve, reject) => {
                const cleanup = () => {
                    if (operation.cleaned) return;
                    operation.cleaned = true;
                    if (operation.timer !== null) { this.unschedule(operation.timer); operation.timer = null; }
                    if (operation.reader) operation.reader.onload = operation.reader.onerror = operation.reader.onabort = null;
                };
                const finish = (error, value) => {
                    if (operation.finished) return;
                    operation.finished = true; cleanup();
                    if (error) reject(error); else resolve(value);
                };
                operation.cleanup = cleanup; operation.fail = error => finish(error);
                try {
                    const reader = operation.reader = this.makeReader();
                    reader.onload = () => {
                        if (operation.finished) return;
                        try {
                            if (!(reader.result instanceof ArrayBuffer) || reader.result.byteLength > SHOWCASE_SETTINGS_MAX_BYTES)
                                throw new Error('The settings file could not be read within 16 KB.');
                            finish(null, new TextDecoder('utf-8').decode(reader.result));
                        } catch (error) { finish(error); }
                    };
                    reader.onerror = () => finish(new Error('The settings file could not be read. Your saved looks were kept.'));
                    reader.onabort = () => finish(operation.cancelError ?? new Error('File reading was cancelled.'));
                    operation.timer = this.schedule(() => this.cancel('File reading took too long. Your saved looks were kept.'), 15000);
                    reader.readAsArrayBuffer(file);
                } catch (error) { finish(error); }
            });
            const selection = await readShowcaseSettings({ size: file.size, text: async () => text });
            const configuration = optionsForShowcase(selection);
            if (operation.cancelled || operation.generation !== this.generation || this.disposed || this.active !== operation)
                throw operation.cancelError ?? new Error('Import cancelled. Your saved looks were kept.');
            if (!this.available()) throw new Error('Saved looks became unavailable. Import again when they are ready.');
            // No await between this guard and the existing synchronous fresh-read append.
            return this.savedLooks.add(name, configuration);
        } finally {
            operation.cleanup?.();
            if (this.active === operation) this.active = null;
        }
    }
}

/** Candidate UI has no avatar, navigation, attention or current-look dependency. */
export function mountSavedLookImport(root, { savedLooks, available, onSaved }) {
    const form = root.querySelector('form'), fields = root.querySelector('fieldset');
    const name = root.querySelector('[data-import-name]'), file = root.querySelector('[data-import-file]');
    const cancel = root.querySelector('[data-import-cancel]'), status = root.querySelector('[data-import-status]');
    const error = root.querySelector('[data-import-error]');
    const importer = new SavedLookImport(savedLooks, { available });
    let disposed = false;
    function feedback(message, failed = false) {
        status.textContent = failed ? '' : message;
        error.textContent = failed ? message : ''; error.hidden = !failed;
    }
    function refresh() {
        fields.disabled = disposed || importer.busy || !available();
        cancel.hidden = disposed || !importer.busy;
    }
    async function submit(event) {
        event.preventDefault();
        if (disposed || importer.busy || !available()) return;
        feedback('Reading the settings file…');
        let pending;
        try {
            pending = importer.add(name.value, file.files[0]); refresh();
            const item = await pending;
            if (disposed) return;
            name.value = ''; file.value = '';
            let refreshed = false;
            try { refreshed = onSaved(item) !== false; } catch { /* Persistence has already succeeded. */ }
            feedback(`“${item.name}” is saved in this browser. Your current view is unchanged.${refreshed ? '' : ' The saved-look list could not refresh.'}`);
        } catch (cause) {
            if (!disposed) feedback(cause?.message ?? 'The look could not be imported. Your saved looks were kept.', true);
        } finally { refresh(); }
    }
    function cancelImport(message) { return importer.cancel(message); }
    function cancelClick() { cancelImport(); }
    form.addEventListener('submit', submit); cancel.addEventListener('click', cancelClick);
    root.hidden = false; refresh();
    return {
        refresh, cancel: cancelImport,
        dispose() {
            disposed = true; importer.dispose();
            form.removeEventListener('submit', submit); cancel.removeEventListener('click', cancelClick);
            root.hidden = true; refresh();
        }
    };
}
