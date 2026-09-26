// PNG review only. Never imports or runs the avatar, capture adapter, or motion filters.
const ids = ['scope', 'previous', 'play', 'next', 'time', 'detail', 'timeline', 'status', 'error', 'error-message', 'retry', 'comparison', 'close-status', 'close-comparison', 'limit', 'binding'];
const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const manifestURL = new URL('./review-manifest.json', import.meta.url), cache = new Map();
let manifest, index = 0, closeStep = 0, playing = false, timer, generation = 0, closeGeneration = 0, loading = false;
const label = control => `${control.id} · ${control.label}`;
const caption = (control, close = false) => {
    const figure = document.createElement('figure'), title = document.createElement('figcaption');
    title.textContent = label(control); figure.append(title);
    if (close) {
        const pair = document.createElement('div'); pair.className = 'close-pair';
        for (const side of ['Left', 'Right']) {
            const block = document.createElement('div'), name = document.createElement('p'), holder = document.createElement('div');
            name.className = 'side-label'; name.textContent = side + ' hand'; holder.className = 'image'; holder.dataset.side = side;
            block.append(name, holder); pair.append(block);
        }
        figure.append(pair);
    } else {
        const holder = document.createElement('div'), note = document.createElement('p'); holder.className = 'image';
        holder.textContent = 'Loading matched frame…'; note.className = 'note'; note.textContent = control.note; figure.append(holder, note);
    }
    return figure;
};
function source(image) {
    const url = new URL(image.src, manifestURL);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw Error('Images must be served from this same local review site.');
    return url.href;
}
function validate(m) {
    if (m?.version !== 1 || m.fps !== 60 || typeof m.scope !== 'string' || typeof m.limit !== 'string' ||
        JSON.stringify(m.closeSteps) !== '[0,455,637]' || JSON.stringify(m.controls?.map(c => c.id)) !== '["A","D"]') throw Error('Unexpected review protocol.');
    if (!Array.isArray(m.samples) || m.samples.length < 2 || m.samples[0].step !== 0 || m.samples.at(-1).step !== 720) throw Error('Incomplete full-body timeline.');
    m.samples.forEach((s, i) => {
        if (!Number.isInteger(s.step) || s.time !== s.step / 60 || i && s.step <= m.samples[i - 1].step) throw Error('Native steps and timestamps are invalid.');
    });
    for (const c of m.controls) {
        if (typeof c.label !== 'string' || typeof c.note !== 'string' || !Array.isArray(c.fullBody) || c.fullBody.length !== m.samples.length || !Array.isArray(c.close) || c.close.length !== 6) throw Error('Missing matched control images.');
        c.fullBody.forEach((image, i) => {
            if (image.step !== m.samples[i].step || image.time !== m.samples[i].time) throw Error('A control is at a different time.');
            image.url = source(image);
        });
        for (const step of m.closeSteps) for (const side of ['Left', 'Right']) {
            const matches = c.close.filter(image => image.step === step && image.side === side);
            if (matches.length !== 1 || matches[0].time !== step / 60) throw Error('Missing or duplicate close view.'); matches[0].url = source(matches[0]);
        }
    }
    return m;
}
function pause() { playing = false; clearTimeout(timer); timer = null; ++generation; loading = false; el.play.textContent = 'Play'; if (manifest) controls(); }
function fail(error) {
    pause(); el.error.hidden = false; el['error-message'].textContent = error.message;
    el.status.textContent = 'Loading failed. The last complete matched images are retained.'; el.play.disabled = true;
}
function load(url) {
    if (cache.has(url)) { const promise = cache.get(url); cache.delete(url); cache.set(url, promise); return promise; }
    const promise = new Promise((resolve, reject) => {
        const img = new Image(); img.decoding = 'async';
        img.onload = async () => { try { await img.decode(); if (!img.naturalWidth || !img.naturalHeight) throw Error('Empty image'); resolve(img); } catch { cache.delete(url); reject(Error('Could not decode ' + new URL(url).pathname)); } };
        img.onerror = () => { cache.delete(url); reject(Error('Could not load ' + new URL(url).pathname)); }; img.src = url;
    });
    cache.set(url, promise); while (cache.size > 30) cache.delete(cache.keys().next().value); return promise;
}
async function node(image, text) { const decoded = await load(image.url), copy = decoded.cloneNode(); await copy.decode(); copy.alt = text; copy.dataset.step = image.step; return copy; }
function controls() {
    const sample = manifest.samples[index]; el.time.textContent = `${sample.time.toFixed(3)} s`;
    el.detail.textContent = `Native step ${sample.step} · ${sample.step < 360 ? 'Happy' : 'Angry'} · sample ${index + 1}/${manifest.samples.length}`;
    el.timeline.value = sample.step; el.timeline.setAttribute('aria-valuetext', `Native step ${sample.step}, ${sample.time.toFixed(3)} seconds`);
    el.timeline.disabled = false; el.previous.disabled = index === 0; el.next.disabled = index === manifest.samples.length - 1; el.play.disabled = !el.error.hidden;
}
function nearest(step) { let selected = 0; for (let i = 1; i < manifest.samples.length; i++) if (Math.abs(manifest.samples[i].step - step) < Math.abs(manifest.samples[selected].step - step)) selected = i; return selected; }
async function show(next) {
    const token = ++generation; loading = true; el.play.disabled = !playing; el.status.textContent = 'Loading both matched full-body images…';
    try {
        const nodes = await Promise.all(manifest.controls.map(c => node(c.fullBody[next], `${label(c)}, full body, native step ${manifest.samples[next].step}`)));
        if (token !== generation) return false;
        nodes.forEach((image, i) => el.comparison.children[i].querySelector('.image').replaceChildren(image));
        index = next; loading = false; controls(); el.status.textContent = playing ? 'Playing recorded time intervals. Buffering pauses all controls together.' : 'Paused · shared slider and frame buttons show matched recorded steps.';
        for (let n = index + 1; n < Math.min(index + 4, manifest.samples.length); n++) for (const c of manifest.controls) load(c.fullBody[n].url).catch(() => {});
        return true;
    } catch (error) { if (token === generation) fail(error); return false; }
}
function schedule() {
    clearTimeout(timer);
    if (!playing || loading) return;
    if (index === manifest.samples.length - 1) { pause(); el.status.textContent = 'End of the 12-second trace · Play restarts from the beginning.'; return; }
    // Each irregular sample is held for its actual Δstep/60 interval. Decode time is a pause.
    const delay = (manifest.samples[index + 1].time - manifest.samples[index].time) * 1000;
    timer = setTimeout(async () => { if (!playing) return; const shown = await show(index + 1); if (shown && playing) schedule(); }, delay);
}
async function showClose(step) {
    const token = ++closeGeneration; el['close-status'].textContent = `Loading four close views at step ${step}…`;
    try {
        const all = await Promise.all(manifest.controls.map(c => Promise.all(['Left', 'Right'].map(side => {
            const image = c.close.find(p => p.step === step && p.side === side); return node(image, `${label(c)}, ${side.toLowerCase()} hand and hip, native step ${step}`);
        }))));
        if (token !== closeGeneration) return;
        all.forEach((images, i) => images.forEach((image, side) => el['close-comparison'].children[i].querySelectorAll('.image')[side].replaceChildren(image)));
        closeStep = step; document.querySelectorAll('[data-close]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.close) === step)));
        el['close-status'].textContent = `Fixed close views · native step ${step} · ${(step / 60).toFixed(3)} s. Independent of full-body playback.`;
    } catch (error) { if (token === closeGeneration) { el['close-status'].textContent = 'Close-view loading failed; previous complete close views retained.'; fail(error); } }
}
async function loadManifest() {
    pause(); ++closeGeneration; el.error.hidden = true;
    try {
        const response = await fetch(manifestURL, {cache: 'no-store'}); if (!response.ok) throw Error(`Review manifest unavailable (HTTP ${response.status}).`);
        manifest = validate(await response.json()); el.scope.textContent = manifest.scope; el.limit.textContent = manifest.limit;
        el.binding.textContent = Object.entries(manifest.provenance).map(([key,value])=>`${key}: ${value}`).join("\n");
        el.comparison.replaceChildren(...manifest.controls.map(c => caption(c)));
        el['close-comparison'].replaceChildren(...manifest.controls.map(c => caption(c, true)));
        await Promise.all([show(0), showClose(0)]);
    } catch (error) { fail(error); }
}
el.play.addEventListener('click', async () => {
    if (playing) { pause(); controls(); el.status.textContent = 'Paused · both full-body controls retain the same step.'; return; }
    if (!manifest || loading) return;
    if (index === manifest.samples.length - 1 && !await show(0)) return;
    if (!el.error.hidden) return; playing = true; el.play.textContent = 'Pause'; schedule();
});
el.previous.addEventListener('click', () => { pause(); show(Math.max(0, index - 1)); });
el.next.addEventListener('click', () => { pause(); show(Math.min(manifest.samples.length - 1, index + 1)); });
el.timeline.addEventListener('input', () => { pause(); show(nearest(Number(el.timeline.value))); });
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { if (manifest) { pause(); show(nearest(Number(b.dataset.step))); } }));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { if (manifest) showClose(Number(b.dataset.close)); }));
el.retry.addEventListener('click', () => { cache.clear(); el.error.hidden = true; if (manifest) Promise.all([show(index), showClose(closeStep)]); else loadManifest(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); el.status.textContent = 'Paused while the gallery is in the background.'; } });
window.addEventListener('pagehide', () => { pause(); ++closeGeneration; });
loadManifest();
