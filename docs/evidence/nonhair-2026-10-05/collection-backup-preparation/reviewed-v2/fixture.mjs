import { mountCollectionBackup } from '../../../../packages/testbed/src/showcase-collection-backup-ui.mjs';
import { SAVED_LOOKS_KEY } from '../../../../packages/testbed/src/showcase-collection.mjs';
import { optionsForShowcase } from '../../../../packages/testbed/src/showcase-presets.mjs';

const key = 'sugata:review:collection-backup:8e3183e2-4384-4f17-b616-b9e247cb250f';
const receipt = document.getElementById('fixture-receipt'), add = document.getElementById('fixture-add'), finish = document.getElementById('fixture-finish');
let owned = false, lastOwned = null, controller = null, finished = false;
const operations = [];
const errors = [];
let retirement = 'not-attempted';
function failure(stage, cause) { errors.push({ stage, message: String(cause?.message ?? cause) }); }
function physicalRead() { return localStorage.getItem(key); }
function observe(stage) {
    let raw = null, rawKnown = false, count = null, parseError = null;
    try { raw = physicalRead(); rawKnown = true; } catch (cause) { failure('observe-read', cause); }
    if (rawKnown) {
        try {
            if (raw === null) count = 0;
            else {
                const value = JSON.parse(raw);
                if (!Array.isArray(value?.looks)) throw new Error('Fixture collection metadata unavailable.');
                count = value.looks.length;
            }
        } catch (cause) { parseError = String(cause?.message ?? cause); }
    }
    receipt.textContent = JSON.stringify({ key, stage, raw, rawKnown, count, parseError,
        operations, errors, retirement, owned, finished, fixtureKeyAbsent: rawKnown ? raw === null : null }, null, 2);
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
    try { controller?.release(); retirement = 'released'; }
    catch (cause) { retirement = 'error'; failure('controller-release', cause); }
    let current, readable = false, stage = 'cleanup-error';
    try { current = physicalRead(); readable = true; } catch (cause) { failure('cleanup-read', cause); }
    if (readable && current !== lastOwned) {
        operations.push({ stage: 'cleanup-refused-external-change' }); stage = 'cleanup-refused';
    } else if (readable) {
        try {
            localStorage.removeItem(key); lastOwned = null; owned = false;
            operations.push({ stage: 'cleanup' }); stage = errors.length ? 'cleanup-error' : 'finished';
        } catch (cause) { failure('cleanup-remove', cause); }
    }
    finished = true; add.disabled = finish.disabled = true;
    observe(stage);
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
        try {
            if (finished || physicalRead() !== seedRaw) throw new Error('Fixture Add refused: source changed.');
            write(addedRaw, 'add-test-look'); add.disabled = true; controller.refresh(); observe('added');
        } catch (cause) { failure('add-test-look', cause); observe('add-refused'); }
    });
    finish.addEventListener('click', clean);
    window.addEventListener('pagehide', clean, { once: true });
} catch (cause) {
    failure('initialize', cause); add.disabled = finish.disabled = true;
    if (owned) clean(); else observe('refused');
}
