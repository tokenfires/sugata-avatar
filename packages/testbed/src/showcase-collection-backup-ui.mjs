import { CollectionBackup, COLLECTION_BACKUP_MAX_BYTES } from './showcase-collection-backup.mjs';
import { SAVED_LOOKS_KEY } from './showcase-collection.mjs';

export function mountCollectionBackup({ root = document, storage, onMutation = () => {} } = {}) {
    const manager = new CollectionBackup(storage), find = id => root.getElementById(id);
    const file = find('backup-file'), download = find('download-collection'), restore = find('restore-collection');
    const cancel = find('cancel-backup'), undo = find('undo-restore'), status = find('backup-status'), error = find('backup-error');
    const preview = find('backup-preview'), notice = find('replacement-notice');
    const urls = new Map(), listeners = [];
    let disposed = false, reading = false, generation = 0, blocked = true, hasPreview = false, canUndo = false;
    const listen = (target, name, callback) => {
        target.addEventListener(name, callback); listeners.push(() => target.removeEventListener(name, callback));
    };
    function feedback(message, failed = false) {
        error.hidden = !failed; error.textContent = failed ? message : '';
        status.textContent = failed ? '' : message;
    }
    function buttons() {
        file.disabled = download.disabled = disposed || reading || blocked;
        restore.disabled = disposed || reading || blocked || !hasPreview;
        cancel.disabled = disposed || (!reading && !hasPreview);
        undo.disabled = disposed || reading || blocked || !canUndo; undo.hidden = !canUndo;
    }
    function names(element, looks) {
        element.replaceChildren();
        for (const item of looks) {
            const li = root.createElement('li'), name = root.createElement('span');
            name.textContent = item.name; li.append(name);
            if (!item.available) {
                const label = root.createElement('small'); label.textContent = 'Unavailable in this version · kept in your backup'; li.append(label);
            }
            element.append(li);
        }
    }
    function hidePreview() {
        hasPreview = false; preview.hidden = true; find('incoming-look-list').replaceChildren(); notice.textContent = '';
    }
    function refresh() {
        if (disposed) return false;
        try {
            const state = manager.inspect(); blocked = false; canUndo = state.canUndo;
            names(find('current-look-list'), state.looks);
            find('current-count').textContent = `${state.looks.length} / 12`;
            find('current-empty').hidden = state.looks.length !== 0;
            if (!state.hasPreview) hidePreview();
            if (state.stalePreview) feedback('Saved looks changed. Choose your backup again to review the replacement.', true);
            buttons(); return true;
        } catch (cause) {
            blocked = true; canUndo = false; hidePreview();
            find('current-count').textContent = 'Unavailable'; find('current-look-list').replaceChildren(); find('current-empty').hidden = true;
            feedback(cause.message, true); buttons(); return false;
        }
    }
    function revoke(url) {
        const timer = urls.get(url); if (timer !== undefined) clearTimeout(timer);
        URL.revokeObjectURL(url); urls.delete(url);
    }
    listen(download, 'click', () => {
        if (disposed || reading || blocked) return;
        let anchor, url;
        try {
            const text = manager.backupText();
            url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); urls.set(url, null);
            anchor = root.createElement('a'); anchor.href = url; anchor.download = 'sugata-saved-looks.json'; root.body.append(anchor); anchor.click();
            urls.set(url, setTimeout(() => revoke(url), 1000));
            feedback('Backup download requested. Keep the file somewhere you can find it again.');
        } catch (cause) { if (url) revoke(url); feedback(cause.message, true); }
        finally { anchor?.remove(); }
    });
    listen(file, 'change', async () => {
        if (disposed || reading || blocked || !file.files?.[0]) return;
        const selected = file.files[0], token = ++generation;
        manager.cancelPreview(); hidePreview(); reading = true; feedback('Reading your backup…'); buttons();
        try {
            if (selected.size > COLLECTION_BACKUP_MAX_BYTES) throw new Error('Collection backups must be 2 MB or smaller.');
            const text = await selected.text();
            if (disposed || token !== generation) return;
            const incoming = manager.preview(text);
            names(find('incoming-look-list'), incoming.looks);
            notice.textContent = incoming.unchanged ? 'This backup matches your saved collection. Restoring it will make no change.' :
                `Restore will replace all ${incoming.replacing} current saved looks with ${incoming.looks.length} backed-up looks.`;
            hasPreview = true; preview.hidden = false;
            feedback('Backup preview ready. Your saved looks have not changed.');
        } catch (cause) {
            if (!disposed && token === generation) { manager.cancelPreview(); hidePreview(); feedback(cause.message, true); }
        } finally {
            // Cancel invalidates its result, but File.text still owns the sole physical read.
            if (!disposed) { reading = false; file.value = ''; buttons(); }
        }
    });
    listen(cancel, 'click', () => {
        if (disposed) return;
        ++generation; file.value = ''; manager.cancelPreview(); hidePreview();
        feedback('Backup preview cancelled. Your saved looks have not changed.'); buttons(); file.focus();
    });
    listen(restore, 'click', () => {
        if (disposed || reading || blocked || !hasPreview) return;
        try {
            const changed = manager.restore(); hidePreview();
            if (changed) onMutation('restore');
            if (refresh()) {
                feedback(changed ? 'Collection restored. You can undo this replacement while this page stays open.' : 'Your saved collection already matches this backup. No change was made.');
                (canUndo ? undo : download).focus();
            }
        } catch (cause) { refresh(); feedback(cause.message, true); }
    });
    listen(undo, 'click', () => {
        if (disposed || reading || blocked || !canUndo) return;
        try {
            manager.undo(); onMutation('undo');
            if (refresh()) { feedback('Your previous saved collection is restored.'); download.focus(); }
        } catch (cause) { refresh(); feedback(cause.message, true); }
    });
    listen(window, 'storage', event => {
        if (event.key === SAVED_LOOKS_KEY || event.key === null) {
            if (refresh()) feedback('Saved looks updated from another tab. Your wardrobe preview is unchanged.');
        }
    });
    listen(find('retry-collection'), 'click', () => {
        if (disposed || reading) return;
        if (refresh()) feedback('Saved looks are ready.');
    });
    function dispose() {
        if (disposed) return;
        disposed = true; ++generation; reading = false; manager.dispose(); hidePreview();
        for (const remove of listeners.splice(0)) remove();
        for (const url of [...urls.keys()]) revoke(url);
        buttons();
    }
    listen(window, 'pagehide', dispose);
    // Retained solely to renew snapshots after BFCache, never to revive a pending import/Undo.
    const shown = event => { if (event.persisted) location.reload(); };
    window.addEventListener('pageshow', shown);
    refresh();
    return Object.freeze({ refresh, dispose, release: () => { dispose(); window.removeEventListener('pageshow', shown); } });
}
