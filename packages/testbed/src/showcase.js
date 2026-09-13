import { Avatar } from '../../core/src/Avatar.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SHOWCASE_PRESETS, SHOWCASE_OUTFITS, resolveShowcaseSelection, optionsForShowcase, outfitFromReport, configurationFromReport } from './showcase-presets.mjs';

const params = new URLSearchParams(location.search), captured = params.has('capture');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('stage'), status = document.getElementById('status');
const dialog = document.getElementById('copy-dialog');
let avatar = null, controls = null, selected = null, busy = true, failed = false;
let paused = reducedMotion, frame = 0, previousTime = null;
let savingImage = false;
const downloadUrls = new Set();
const setStatus = text => { status.textContent = text; };
function enableControls() {
    for (const control of document.querySelectorAll('fieldset, [data-angle], #pause, #save-image, #save, #copy')) control.disabled = busy || savingImage || failed;
}
function showFailure(error) {
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
    try { controls.update(); avatar.update(paused ? 0 : delta); frame = requestAnimationFrame(animate); }
    catch (error) { showFailure(error); }
}
function updateUrl() {
    const url = new URL(location.href), preset = SHOWCASE_PRESETS.find(p => p.id === selected.preset);
    url.searchParams.set('preset', selected.preset);
    for (const [key, value, normal] of [['style', selected.style, 'ecru'], ['outfit', selected.outfit, preset.outfit], ['frame', selected.frame, 'body'], ['light', selected.light, 'studio']])
        if (value === normal) url.searchParams.delete(key); else url.searchParams.set(key, value);
    history.replaceState(null, '', url);
    for (const link of document.querySelectorAll('[data-preset]')) {
        const next = new URL(location.href); next.search = ''; next.searchParams.set('preset', link.dataset.preset);
        if (selected.style !== 'ecru') next.searchParams.set('style', selected.style);
        if (captured) next.searchParams.set('capture', ''); link.href = next.href;
    }
}
function refresh() {
    const report = avatar.report(); selected.outfit = outfitFromReport(report); selected.style = report.wardrobe.appearance.style;
    const preset = SHOWCASE_PRESETS.find(p => p.id === selected.preset);
    for (const link of document.querySelectorAll('[data-preset]')) link.setAttribute('aria-current', String(link.dataset.preset === selected.preset));
    for (const [key, value] of [['style', selected.style], ['outfit', selected.outfit], ['frame', selected.frame], ['light', selected.light]])
        for (const button of document.querySelectorAll(`[data-${key}]`)) button.setAttribute('aria-pressed', String(button.dataset[key] === value));
    document.getElementById('view-name').textContent = `${preset.number} / ${selected.outfit === preset.outfit ? preset.name : 'Your combination'}`;
    document.getElementById('cut-label').textContent = report.hair.loadedStyle === 'bob02' ? 'Chin-length bob' : 'Long bob';
    document.getElementById('pause').textContent = paused ? 'Resume motion' : 'Pause motion';
    document.getElementById('pause').setAttribute('aria-pressed', String(paused));
    enableControls(); updateUrl();
}
function frameView(mode) {
    avatar.setFraming(mode); selected.frame = mode;
    controls.target.copy(avatar.focus);
    if (mode === 'portrait') { controls.target.y += .045; avatar.stage.camera.position.y += .045; }
    const distance = avatar.stage.camera.position.distanceTo(controls.target);
    controls.minDistance = distance * .7; controls.maxDistance = distance * 1.5;
    controls.update(); controls.saveState();
}
async function changeOutfit(id) {
    if (busy || savingImage || failed) return false;
    if (!Object.hasOwn(SHOWCASE_OUTFITS, id)) throw new Error('Unknown outfit.');
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

try {
    selected = resolveShowcaseSelection(params);
    avatar = await Avatar.create({canvas, ...optionsForShowcase(selected), autoStart: false});
    controls = new OrbitControls(avatar.stage.camera, canvas); controls.enablePan = false;
    controls.enableDamping = !reducedMotion; controls.dampingFactor = .1;
    controls.minPolarAngle = Math.PI * .26; controls.maxPolarAngle = Math.PI * .70;
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
        busy = true; enableControls(); setStatus('Preparing colours…'); location.assign(next.href);
    });
    for (const button of document.querySelectorAll('[data-frame]')) button.addEventListener('click', () => { frameView(button.dataset.frame); refresh(); });
    for (const button of document.querySelectorAll('[data-light]')) button.addEventListener('click', () => { avatar.setLighting(button.dataset.light); selected.light = button.dataset.light; refresh(); });
    for (const button of document.querySelectorAll('[data-angle]')) button.addEventListener('click', () => {
        const target = controls.target, radius = avatar.stage.camera.position.distanceTo(target), angle = Number(button.dataset.angle) * Math.PI / 180;
        avatar.stage.camera.position.set(target.x + radius * Math.sin(angle), target.y, target.z + radius * Math.cos(angle));
        avatar.stage.camera.lookAt(target); controls.update();
    });
    document.getElementById('pause').addEventListener('click', () => { paused = !paused; previousTime = null; refresh(); setStatus(paused ? 'Motion paused' : 'Live view'); });
    document.getElementById('save-image').addEventListener('click', saveImage);
    document.getElementById('save').addEventListener('click', saveLook); document.getElementById('copy').addEventListener('click', copyLook);
    document.getElementById('dialog-save').addEventListener('click', saveLook); document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
    window.showcase = { avatar, controls, configuration: currentConfiguration, changeOutfit, saveImage,
        step: async delta => { if (!captured) throw new Error('Manual stepping requires ?capture.'); if (savingImage) throw new Error('Wait for the image export before stepping.'); controls.update(); await avatar.step(delta); } };
    if (!captured) frame = requestAnimationFrame(animate);
} catch (error) { showFailure(error); }

document.addEventListener('visibilitychange', () => { previousTime = null; });
addEventListener('pagehide', event => { cancelAnimationFrame(frame); for (const url of downloadUrls) revokeDownload(url); if (event.persisted) return; controls?.dispose(); avatar?.dispose(); });
addEventListener('pageshow', event => { if (event.persisted && avatar && !failed && !captured && !savingImage) { previousTime = null; frame = requestAnimationFrame(animate); } });
