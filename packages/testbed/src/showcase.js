import { AttentionAction } from '../../core/src/motion/AttentionAction.js';
import { Avatar } from '../../core/src/Avatar.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SHOWCASE_PRESETS, SHOWCASE_OUTFITS, resolveShowcaseSelection, optionsForShowcase, outfitFromReport, configurationFromReport } from './showcase-presets.mjs';
import { readShowcaseSettings, showcaseSettingsUrl } from './showcase-settings.mjs';
import { ViewerFraming, flushOrbitDamping } from './viewer-framing.mjs';
import { SavedLooks, SAVED_LOOKS_KEY, SAVED_LOOKS_LIMIT, savedLookSelection } from './showcase-collection.mjs';
import { mountPaletteReferences } from './showcase-palette-references.mjs';
import './showcase-palette-references.css';
import casualEcru from './palette-references/casual-ecru.png';
import casualCharcoal from './palette-references/casual-charcoal.png';
import casualOriginal from './palette-references/casual-original.png';
import elegantEcru from './palette-references/elegant-ecru.png';
import elegantCharcoal from './palette-references/elegant-charcoal.png';
import elegantOriginal from './palette-references/elegant-original.png';

const params = new URLSearchParams(location.search), captured = params.has('capture');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('stage'), status = document.getElementById('status');
const dialog = document.getElementById('copy-dialog');
let avatar = null, controls = null, framing = null, selected = null, busy = true, failed = false;
let paused = reducedMotion, frame = 0, previousTime = null;
let savingImage = false, attention = null, attentionError = null;
let navigationPending = false;
const downloadUrls = new Set();
const setStatus = text => { status.textContent = text; };
const savedLooks = new SavedLooks();
const paletteReferences = mountPaletteReferences(document.getElementById('style-controls'), [
    {outfit: 'casual', style: 'ecru', src: casualEcru},
    {outfit: 'casual', style: 'charcoal', src: casualCharcoal},
    {outfit: 'casual', style: 'original', src: casualOriginal},
    {outfit: 'elegant', style: 'ecru', src: elegantEcru},
    {outfit: 'elegant', style: 'charcoal', src: elegantCharcoal},
    {outfit: 'elegant', style: 'original', src: elegantOriginal}
]);
let collectionBlocked = true, collectionCount = 0;
const collectionAvailable = () => !busy && !savingImage && !failed && avatar && !avatar.disposed && !collectionBlocked;
function updateCollectionControls() {
    document.getElementById('collection-controls').disabled = !collectionAvailable();
    document.getElementById('save-local-look').disabled = !collectionAvailable() || collectionCount >= SAVED_LOOKS_LIMIT;
    for (const button of document.querySelectorAll('[data-open-look]')) button.disabled = !collectionAvailable() || button.dataset.unavailable === 'true';
}
function enableControls() {
    for (const control of document.querySelectorAll('fieldset, [data-angle], #pause, #save-image, #save, #copy, #open-settings')) control.disabled = busy || savingImage || failed;
    updateCollectionControls(); updateAttention();
}
function collectionFeedback(message, error = false) {
    const feedback = document.getElementById('collection-error'); feedback.hidden = !error; feedback.textContent = error ? message : '';
    document.getElementById('collection-status').textContent = error ? '' : message;
}
function renderCollection() {
    const list = document.getElementById('saved-look-list');
    try {
        const current = savedLooks.read(); collectionBlocked = false; collectionCount = current.looks.length;
        list.replaceChildren(); document.getElementById('saved-look-count').textContent = `${collectionCount} / ${SAVED_LOOKS_LIMIT}`;
        document.getElementById('saved-look-empty').hidden = collectionCount !== 0;
        document.getElementById('undo-look').hidden = !savedLooks.canUndo(current.raw);
        for (const item of current.looks) {
            const row = document.createElement('li'), name = document.createElement('strong'), description = document.createElement('small'), actions = document.createElement('div');
            name.textContent = item.name; description.id = `saved-description-${item.id}`; actions.className = 'saved-look-actions';
            const open = document.createElement('button'), remove = document.createElement('button');
            open.type = remove.type = 'button'; open.className = remove.className = 'secondary';
            open.textContent = 'Open'; remove.textContent = 'Remove'; open.dataset.openLook = item.id; remove.dataset.removeLook = item.id;
            open.setAttribute('aria-label', `Open saved look ${item.name}`); remove.setAttribute('aria-label', `Remove saved look ${item.name}`);
            open.setAttribute('aria-describedby', description.id);
            try {
                const look = savedLookSelection(item), style = { ecru: 'Ecru', charcoal: 'Charcoal', original: 'Original' }[look.style];
                description.textContent = `${look.preset === 'casual' ? 'Chin-length bob' : 'Long bob'} · ${SHOWCASE_OUTFITS[look.outfit].label} · ${style} · ${look.scene === 'kitchen' ? 'Kitchen' : look.light === 'warm' ? 'Warm Studio' : 'Studio'} · ${look.frame === 'portrait' ? 'Portrait' : 'Full look'}`;
            } catch { open.dataset.unavailable = 'true'; description.textContent = 'Unavailable in this version. You can keep or remove this saved entry.'; }
            open.addEventListener('click', () => {
                if (!collectionAvailable()) return;
                try {
                    const { item: latest } = savedLooks.open(item.id), text = JSON.stringify(latest.configuration);
                    collectionFeedback('Opening saved look…');
                    openLook({ size: new Blob([text]).size, text: async () => text });
                } catch (error) { renderCollection(); collectionFeedback(error.message, true); }
            });
            remove.addEventListener('click', () => {
                if (!collectionAvailable()) return;
                try {
                    const removed = savedLooks.remove(item.id, item);
                    if (renderCollection()) { collectionFeedback(`Removed “${removed.name}”. You can undo this removal.`); document.getElementById('undo-look').focus(); }
                } catch (error) { renderCollection(); collectionFeedback(error.message, true); }
            });
            actions.append(open, remove); row.append(name, description, actions); list.append(row);
        }
        updateCollectionControls(); return true;
    } catch (error) {
        collectionBlocked = true; list.replaceChildren(); document.getElementById('saved-look-empty').hidden = true;
        document.getElementById('saved-look-count').textContent = 'Unavailable'; document.getElementById('undo-look').hidden = true;
        collectionFeedback(error.message, true); updateCollectionControls(); return false;
    }
}
function updateAttention() {
    const phase = attention?.phase ?? 'idle', unavailable = busy || savingImage || failed || attention === null;
    for (const id of ['look-toward-me', 'look-with-smile']) document.getElementById(id).disabled = unavailable || paused;
    document.getElementById('release-attention').disabled = unavailable || phase !== 'attending';
    const message = failed ? 'Attention unavailable' : busy ? 'Preparing attention' :
        savingImage ? 'Holding this view for your image' : paused ? 'Resume motion to try attention.' : attentionError ?? (
            phase === 'attending' ? (attention.expression === 'soft-smile' ? 'Looking toward you with a small smile' : 'Looking toward this view') : phase === 'releasing' ? 'Returning to idle' : 'Ready when you are');
    const label = document.getElementById('attention-status');
    if (label.textContent !== message) label.textContent = message;
}
function releaseAttention({immediate = false} = {}) {
    attention?.cancel({immediate}); attentionError = null; updateAttention();
}
function showFailure(error) {
    attention?.cancel({immediate: true});
    failed = true; cancelAnimationFrame(frame); enableControls();
    document.getElementById('loading').hidden = true;
    document.getElementById('error').textContent = `This look could not load.\n${error?.message ?? error}`;
    document.getElementById('error').hidden = false; setStatus('Look unavailable');
}
addEventListener('error', event => showFailure(event.error ?? event.message));
addEventListener('unhandledrejection', event => showFailure(event.reason));
function animate(time) {
    if (failed || savingImage || !avatar || avatar.disposed) return;
    const delta = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, .05); previousTime = time;
    try { framing.update(); controls.update(); avatar.update(paused ? 0 : delta); updateAttention(); frame = requestAnimationFrame(animate); }
    catch (error) { showFailure(error); }
}
function updateUrl() {
    const url = new URL(location.href), preset = SHOWCASE_PRESETS.find(p => p.id === selected.preset);
    url.searchParams.set('preset', selected.preset);
    for (const [key, value, normal] of [['style', selected.style, 'ecru'], ['outfit', selected.outfit, preset.outfit], ['frame', selected.frame, 'body'], ['light', selected.light, 'studio'], ['scene', selected.scene, 'studio']])
        if (value === normal) url.searchParams.delete(key); else url.searchParams.set(key, value);
    history.replaceState(null, '', url);
    for (const link of document.querySelectorAll('[data-preset]')) {
        const next = new URL(location.href); next.search = ''; next.searchParams.set('preset', link.dataset.preset);
        if (selected.style !== 'ecru') next.searchParams.set('style', selected.style);
        if (selected.scene !== 'studio') next.searchParams.set('scene', selected.scene);
        if (captured) next.searchParams.set('capture', ''); link.href = next.href;
    }
}
function refresh() {
    const report = avatar.report(); selected.outfit = outfitFromReport(report); selected.style = report.wardrobe.appearance.style;
    paletteReferences.update(selected.outfit, selected.style);
    const preset = SHOWCASE_PRESETS.find(p => p.id === selected.preset);
    for (const link of document.querySelectorAll('[data-preset]')) link.setAttribute('aria-current', String(link.dataset.preset === selected.preset));
    for (const [key, value] of [['style', selected.style], ['outfit', selected.outfit], ['frame', selected.frame], ['light', selected.light], ['scene', selected.scene]])
        for (const button of document.querySelectorAll(`[data-${key}]`)) button.setAttribute('aria-pressed', String(button.dataset[key] === value));
    document.getElementById('lighting-controls').hidden = selected.scene === 'kitchen';
    document.getElementById('view-name').textContent = `${preset.number} / ${selected.outfit === preset.outfit ? preset.name : 'Your combination'}`;
    document.getElementById('cut-label').textContent = report.hair.loadedStyle === 'bob02' ? 'Chin-length bob' : 'Long bob';
    document.getElementById('pause').textContent = paused ? 'Resume motion' : 'Pause motion';
    document.getElementById('pause').setAttribute('aria-pressed', String(paused));
    enableControls(); updateUrl();
}
function frameView(mode) {
    releaseAttention({immediate: true});
    flushOrbitDamping(controls);
    avatar.setFraming(mode); selected.frame = mode;
    controls.target.copy(avatar.focus);
    if (mode === 'portrait') { controls.target.y += .045; avatar.stage.camera.position.y += .045; }
    const distance = avatar.stage.camera.position.distanceTo(controls.target);
    controls.minDistance = distance * .7; controls.maxDistance = distance * 1.5;
    controls.update(); framing.setFraming(mode); controls.saveState();
}
async function changeOutfit(id) {
    if (busy || savingImage || failed) return false;
    if (!Object.hasOwn(SHOWCASE_OUTFITS, id)) throw new Error('Unknown outfit.');
    releaseAttention({immediate: true});
    busy = true; enableControls(); setStatus('Changing clothes…');
    let attached = false;
    try { await avatar.dress([...SHOWCASE_OUTFITS[id].garments]); if (avatar.disposed) return false;
        attached = true; await avatar.step(0); setStatus(paused ? 'Motion paused' : 'Live view'); return true;
    } catch (error) {
        if (!avatar.disposed) {
            if (attached) showFailure(error);
            else setStatus('Could not change outfit. Your current look is retained.');
        }
        return false;
    } finally { busy = false; if (!avatar.disposed && !failed) refresh(); }
}
function currentConfiguration() {
    if (busy || savingImage || failed || !avatar) throw new Error('Wait for the look to finish loading before saving it.');
    return configurationFromReport(avatar.report());
}
function configurationText() { return JSON.stringify(currentConfiguration(), null, 2) + '\n'; }
function revokeDownload(url) { URL.revokeObjectURL(url); downloadUrls.delete(url); }
function downloadBlob(blob, filename) {
    const link = document.createElement('a'), url = URL.createObjectURL(blob); downloadUrls.add(url);
    try {
        link.href = url; link.download = filename; document.body.append(link); link.click();
        setTimeout(() => revokeDownload(url), 1000);
    } catch (error) { revokeDownload(url); throw error; }
    finally { link.remove(); }
}
function saveLook() {
    try {
        const text = configurationText();
        downloadBlob(new Blob([text], {type: 'application/json'}), `sugata-${selected.preset}-${selected.outfit}-${selected.style}.json`);
        setStatus('Settings downloaded as JSON');
    } catch (error) { setStatus(error.message); }
}
async function openLook(file) {
    if (!file || busy || savingImage || failed || !avatar || avatar.disposed) return false;
    const feedback = document.getElementById('settings-error'); feedback.hidden = true; feedback.textContent = '';
    busy = true; enableControls(); setStatus('Reading settings…');
    let navigating = false;
    try {
        const restored = await readShowcaseSettings(file);
        if (failed || avatar.disposed) return false;
        const url = showcaseSettingsUrl(restored, location.href);
        releaseAttention({immediate: true}); setStatus('Opening saved look…');
        navigationPending = true; location.assign(url.href); navigating = true; return true;
    } catch (error) {
        if (!avatar.disposed) {
            feedback.textContent = `Settings not opened. ${error.message} Your current look is retained.`;
            feedback.hidden = false; setStatus('Settings not opened');
        }
        return false;
    } finally {
        if (!navigating) { busy = false; if (!avatar.disposed) enableControls(); }
    }
}
async function saveImage() {
    if (savingImage) return false;
    let held = false, orbitEnabled;
    try {
        const configuration = currentConfiguration();
        if (avatar.disposed) throw new Error('This look is no longer available.');
        // Hold the page clock while toBlob encodes. No update/step, orbit damping, or elapsed-time catch-up.
        savingImage = held = true; cancelAnimationFrame(frame); previousTime = null;
        orbitEnabled = controls.enabled; controls.enabled = false; enableControls(); setStatus('Preparing PNG…');
        const blob = await new Promise((resolve, reject) => {
            // Submit and snapshot in the same task: yielding before toBlob can lose a WebGPU canvas frame.
            avatar.stage.draw();
            canvas.toBlob(result => result ? resolve(result) : reject(new Error('The canvas could not be encoded.')), 'image/png');
        });
        if (avatar.disposed || failed) throw new Error('This look is no longer available.');
        if (blob.type !== 'image/png' || blob.size === 0) throw new Error('The canvas did not produce a PNG image.');
        downloadBlob(blob, `sugata-${configuration.hair}-${selected.outfit}-${selected.style}-${configuration.frame}.png`);
        setStatus('PNG image downloaded'); return true;
    } catch (error) { if (!avatar?.disposed) setStatus(`Image could not be saved. ${error.message}`); return false; }
    finally {
        if (held) {
            savingImage = false; previousTime = null; controls.enabled = orbitEnabled;
            enableControls();
            if (!captured && !failed && !avatar.disposed) frame = requestAnimationFrame(animate);
        }
    }
}
async function copyLook() {
    try {
        const text = configurationText();
        try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); setStatus('Settings copied'); }
        catch { document.getElementById('config-text').value = text; dialog.showModal(); document.getElementById('config-text').select(); setStatus('Settings ready to copy'); }
    } catch (error) { setStatus(error.message); }
}

document.getElementById('save-local-form').addEventListener('submit', event => {
    event.preventDefault(); if (!collectionAvailable()) return;
    const input = document.getElementById('saved-look-name');
    try {
        const item = savedLooks.add(input.value, currentConfiguration());
        if (renderCollection()) { input.value = ''; collectionFeedback(`“${item.name}” is saved in this browser.`); }
    } catch (error) { renderCollection(); collectionFeedback(error.message, true); }
});
document.getElementById('undo-look').addEventListener('click', () => {
    if (!collectionAvailable()) return;
    try { savedLooks.undo(); if (renderCollection()) { collectionFeedback('Saved look restored.'); document.getElementById('saved-look-name').focus(); } }
    catch (error) { renderCollection(); collectionFeedback(error.message, true); }
});
addEventListener('storage', event => {
    if (event.key === SAVED_LOOKS_KEY || event.key === null)
        if (renderCollection()) collectionFeedback('Saved looks updated from another tab. Your current view is unchanged.');
});
renderCollection();

try {
    selected = resolveShowcaseSelection(params);
    avatar = await Avatar.create({canvas, ...optionsForShowcase(selected), autoStart: false});
    attention = new AttentionAction(avatar);
    controls = new OrbitControls(avatar.stage.camera, canvas); controls.enablePan = false;
    controls.enableDamping = !reducedMotion; controls.dampingFactor = .1;
    controls.minPolarAngle = Math.PI * .26; controls.maxPolarAngle = Math.PI * .70;
    framing = new ViewerFraming(avatar, controls, canvas);
    frameView(selected.frame); await avatar.step(0);
    // Attachment is observed before controls or export become available; a requested garment is insufficient.
    configurationFromReport(avatar.report());
    busy = false; refresh(); document.getElementById('loading').hidden = true; setStatus(paused ? 'Motion paused' : 'Live view');
    for (const button of document.querySelectorAll('[data-outfit]')) button.addEventListener('click', () => changeOutfit(button.dataset.outfit));
    // Like changing the starting haircut, a palette opens a fresh owned Avatar. Keep the current
    // outfit/framing/light in the URL; no in-place mutation of the garment-ID fragment cache.
    for (const button of document.querySelectorAll('[data-style]')) button.addEventListener('click', () => {
        if (busy || savingImage || failed || button.dataset.style === selected.style) return;
        const next = new URL(location.href); next.searchParams.set('style', button.dataset.style);
        releaseAttention({immediate: true});
        busy = true; enableControls(); setStatus('Preparing colours…'); navigationPending = true; location.assign(next.href);
    });
    for (const button of document.querySelectorAll('[data-frame]')) button.addEventListener('click', () => { frameView(button.dataset.frame); refresh(); });
    for (const button of document.querySelectorAll('[data-scene]')) button.addEventListener('click', () => {
        if (busy || savingImage || failed || button.dataset.scene === selected.scene) return;
        const next = new URL(location.href); next.searchParams.set('scene', button.dataset.scene); next.searchParams.delete('light');
        releaseAttention({immediate: true});
        busy = true; enableControls(); setStatus('Preparing the scene…'); navigationPending = true; location.assign(next.href);
    });
    for (const button of document.querySelectorAll('[data-light]')) button.addEventListener('click', () => {
        if (selected.scene !== 'studio' || busy || savingImage || failed) return;
        avatar.setLighting(button.dataset.light); selected.light = button.dataset.light; refresh();
    });
    for (const button of document.querySelectorAll('[data-angle]')) button.addEventListener('click', () => {
        releaseAttention({immediate: true});
        flushOrbitDamping(controls);
        const target = controls.target, radius = avatar.stage.camera.position.distanceTo(target), angle = Number(button.dataset.angle) * Math.PI / 180;
        avatar.stage.camera.position.set(target.x + radius * Math.sin(angle), target.y, target.z + radius * Math.cos(angle));
        avatar.stage.camera.lookAt(target); controls.update();
    });
    controls.addEventListener('start', () => releaseAttention({immediate: true}));
    for (const [id, expression] of [['look-toward-me', 'neutral'], ['look-with-smile', 'soft-smile']])
        document.getElementById(id).addEventListener('click', () => {
            if (busy || savingImage || failed || paused) return;
            try { attention.lookAtCamera(avatar.stage.camera, {expression}); attentionError = null; }
            catch (error) { attentionError = error.message; }
            updateAttention();
        });
    document.getElementById('release-attention').addEventListener('click', () => releaseAttention());
    document.getElementById('pause').addEventListener('click', () => { paused = !paused; if (paused) releaseAttention({immediate: true}); previousTime = null; refresh(); setStatus(paused ? 'Motion paused' : 'Live view'); });
    document.getElementById('save-image').addEventListener('click', saveImage);
    document.getElementById('save').addEventListener('click', saveLook); document.getElementById('copy').addEventListener('click', copyLook);
    const settingsFile = document.getElementById('settings-file');
    document.getElementById('open-settings').addEventListener('click', () => settingsFile.click());
    settingsFile.addEventListener('change', () => { const file = settingsFile.files[0]; settingsFile.value = ''; openLook(file); });
    document.getElementById('dialog-save').addEventListener('click', saveLook); document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
    window.showcase = { avatar, controls, attention, framing, configuration: currentConfiguration, changeOutfit, saveImage, openLook,
        step: async delta => { if (!captured) throw new Error('Manual stepping requires ?capture.'); if (savingImage) throw new Error('Wait for the image export before stepping.'); framing.update(); controls.update(); await avatar.step(paused ? 0 : delta); updateAttention(); } };
    if (!captured) frame = requestAnimationFrame(animate);
} catch (error) { showFailure(error); }

document.addEventListener('visibilitychange', () => { previousTime = null; });
addEventListener('pagehide', event => { cancelAnimationFrame(frame); releaseAttention({immediate: true}); for (const url of downloadUrls) revokeDownload(url); if (event.persisted) return; attention?.dispose(); controls?.dispose(); avatar?.dispose(); });
addEventListener('pageshow', event => {
    if (!event.persisted || !avatar || avatar.disposed || failed) return;
    renderCollection();
    // Restore only navigation's busy state. An unfinished file read or dress operation stays busy.
    if (navigationPending) {
        navigationPending = false; busy = false; refresh(); setStatus(paused ? 'Motion paused' : 'Live view');
    }
    if (!captured && !savingImage) {
        cancelAnimationFrame(frame); previousTime = null; frame = requestAnimationFrame(animate);
    }
});
