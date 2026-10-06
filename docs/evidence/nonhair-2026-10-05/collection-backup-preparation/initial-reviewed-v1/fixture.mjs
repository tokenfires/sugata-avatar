import { mountCollectionBackup } from '../../../../packages/testbed/src/showcase-collection-backup-ui.mjs';
import { SAVED_LOOKS_KEY } from '../../../../packages/testbed/src/showcase-collection.mjs';
import { optionsForShowcase } from '../../../../packages/testbed/src/showcase-presets.mjs';

const key = 'sugata:review:collection-backup:8e3183e2-4384-4f17-b616-b9e247cb250f';
const receipt = document.getElementById('fixture-receipt'), add = document.getElementById('fixture-add'), finish = document.getElementById('fixture-finish');
let owned = false, lastOwned = null, controller = null, finished = false;
const operations = [];
function physicalRead() { return localStorage.getItem(key); }
function observe(stage) {
    const raw = physicalRead();
    receipt.textContent = JSON.stringify({ key, stage, raw, count: raw === null ? 0 : JSON.parse(raw).looks.length,
        operations, owned, finished, fixtureKeyAbsent: raw === null }, null, 2);
}
function write(raw, stage) {
    if (!owned || finished || physicalRead() !== lastOwned) throw new Error('Fixture ownership changed; refusing write.');
    if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw);
    lastOwned = raw; operations.push({ stage, raw });
}
const storage = {
    getItem(logical) { if (logical !== SAVED_LOOKS_KEY) throw new Error('Unexpected logical key.'); return physicalRead(); },
    setItem(logical, raw) { if (logical !== SAVED_LOOKS_KEY) throw new Error('Unexpected logical key.'); write(raw, 'set'); },
    removeItem(logical) { if (logical !== SAVED_LOOKS_KEY) throw new Error('Unexpected logical key.'); write(null, 'remove'); }
};
let seedRaw, addedRaw;
function clean() {
    if (finished || !owned) return;
    controller?.release();
    if (physicalRead() !== lastOwned) { operations.push({ stage: 'cleanup-refused-external-change' }); finished = true; observe('cleanup-refused'); return; }
    localStorage.removeItem(key); lastOwned = null; owned = false; finished = true;
    operations.push({ stage: 'cleanup' }); add.disabled = finish.disabled = true;
    observe('finished');
}
try {
    if (physicalRead() !== null) throw new Error('Fixture key already exists; refusing initialization.');
    const configuration = JSON.stringify(optionsForShowcase({ preset: 'casual', outfit: 'casual', style: 'charcoal', frame: 'body', scene: 'studio', light: 'neutral',
        hairColour: '#59443b', hairTint: { colour: '#776699', amount: .23 }, topColor: '#c5ba9e', bottomColor: '#292e34', shoesColor: '#714d36' }));
    seedRaw = `{\n "version":1,\n "looks":[\n {"id":"studio","name":"Quiet morning","configuration":${configuration}},\n {"id":"future","name":"Future styling","configuration":{"overflow":1e400,"zero":-0,"glyph":"${String.fromCharCode(0xd800)}"}}\n ]\n}`;
    addedRaw = seedRaw.replace('\n ]\n}', ',\n {"id":"added","name":"Later test look","configuration":null}\n ]\n}');
    localStorage.setItem(key, seedRaw); owned = true; lastOwned = seedRaw; operations.push({ stage: 'initialize', raw: seedRaw });
    controller = mountCollectionBackup({ storage: () => storage, onMutation: kind => observe(kind) });
    observe('ready');
    add.addEventListener('click', () => {
        if (finished || physicalRead() !== seedRaw) { receipt.textContent = 'Fixture Add refused: source changed.'; return; }
        write(addedRaw, 'add-test-look'); add.disabled = true; controller.refresh(); observe('added');
    });
    finish.addEventListener('click', clean);
    window.addEventListener('pagehide', clean, { once: true });
} catch (cause) {
    controller?.release(); add.disabled = finish.disabled = true;
    receipt.textContent = JSON.stringify({ key, stage: 'refused', error: cause.message, owned, finished }, null, 2);
    if (owned) clean();
}
