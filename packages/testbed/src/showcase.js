import { Avatar } from '../../core/src/Avatar.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SHOWCASE_PRESETS, SHOWCASE_OUTFITS, resolveShowcaseSelection, optionsForShowcase, outfitFromReport, configurationFromReport } from './showcase-presets.mjs';

const params = new URLSearchParams(location.search), captured = params.has('capture');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('stage'), status = document.getElementById('status');
const dialog = document.getElementById('copy-dialog');
let avatar = null, controls = null, selected = null, busy = true, failed = false;
let paused = reducedMotion, frame = 0, previousTime = null;
const setStatus = text => { status.textContent = text; };
function enableControls() {
    for (const control of document.querySelectorAll('fieldset, [data-angle], #pause, #save, #copy')) control.disabled = busy || failed;
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
    if (failed || !avatar || avatar.disposed) return;
    const delta = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, .05); previousTime = time;
    try { controls.update(); avatar.update(paused ? 0 : delta); frame = requestAnimationFrame(animate); }
    catch (error) { showFailure(error); }
}
function updateUrl() {
    const url = new URL(location.href), preset = SHOWCASE_PRESETS.find(p => p.id === selected.preset);
    url.searchParams.set('preset', selected.preset);
    for (const [key, value, normal] of [['outfit', selected.outfit, preset.outfit], ['frame', selected.frame, 'body'], ['light', selected.light, 'studio']])
        if (value === normal) url.searchParams.delete(key); else url.searchParams.set(key, value);
    history.replaceState(null, '', url);
    for (const link of document.querySelectorAll('[data-preset]')) {
        const next = new URL(location.href); next.search = ''; next.searchParams.set('preset', link.dataset.preset);
        if (captured) next.searchParams.set('capture', ''); link.href = next.href;
    }
}
function refresh() {
    const report = avatar.report(); selected.outfit = outfitFromReport(report);
    const preset = SHOWCASE_PRESETS.find(p => p.id === selected.preset);
    for (const link of document.querySelectorAll('[data-preset]')) link.setAttribute('aria-current', String(link.dataset.preset === selected.preset));
    for (const [key, value] of [['outfit', selected.outfit], ['frame', selected.frame], ['light', selected.light]])
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
    if (busy || failed) return false;
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
    if (busy || failed || !avatar) throw new Error('Wait for the look to finish loading before saving it.');
    return configurationFromReport(avatar.report());
}
function configurationText() { return JSON.stringify(currentConfiguration(), null, 2) + '\n'; }
function saveLook() {
    try {
        const text = configurationText(), url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = `sugata-${selected.preset}-${selected.outfit}.json`;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Look saved as JSON');
    } catch (error) { setStatus(error.message); }
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
    for (const button of document.querySelectorAll('[data-frame]')) button.addEventListener('click', () => { frameView(button.dataset.frame); refresh(); });
    for (const button of document.querySelectorAll('[data-light]')) button.addEventListener('click', () => { avatar.setLighting(button.dataset.light); selected.light = button.dataset.light; refresh(); });
    for (const button of document.querySelectorAll('[data-angle]')) button.addEventListener('click', () => {
        const target = controls.target, radius = avatar.stage.camera.position.distanceTo(target), angle = Number(button.dataset.angle) * Math.PI / 180;
        avatar.stage.camera.position.set(target.x + radius * Math.sin(angle), target.y, target.z + radius * Math.cos(angle));
        avatar.stage.camera.lookAt(target); controls.update();
    });
    document.getElementById('pause').addEventListener('click', () => { paused = !paused; previousTime = null; refresh(); setStatus(paused ? 'Motion paused' : 'Live view'); });
    document.getElementById('save').addEventListener('click', saveLook); document.getElementById('copy').addEventListener('click', copyLook);
    document.getElementById('dialog-save').addEventListener('click', saveLook); document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
    window.showcase = { avatar, controls, configuration: currentConfiguration, changeOutfit,
        step: async delta => { if (!captured) throw new Error('Manual stepping requires ?capture.'); controls.update(); await avatar.step(delta); } };
    if (!captured) frame = requestAnimationFrame(animate);
} catch (error) { showFailure(error); }

document.addEventListener('visibilitychange', () => { previousTime = null; });
addEventListener('pagehide', event => { cancelAnimationFrame(frame); if (event.persisted) return; controls?.dispose(); avatar?.dispose(); });
addEventListener('pageshow', event => { if (event.persisted && avatar && !failed && !captured) { previousTime = null; frame = requestAnimationFrame(animate); } });
