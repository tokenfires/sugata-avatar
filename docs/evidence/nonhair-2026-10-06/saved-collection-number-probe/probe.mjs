import assert from 'node:assert/strict';
import { SavedLooks, SAVED_LOOKS_KEY } from '../../../../packages/testbed/src/showcase-collection.mjs';
import { optionsForShowcase } from '../../../../packages/testbed/src/showcase-presets.mjs';

// Only this injected Map is written. No browser, DOM, localStorage or renderer.
const options = optionsForShowcase({ preset: 'casual', outfit: 'casual', style: 'ecru', frame: 'body', scene: 'studio', light: 'studio' });
const rawFor = literal => `{"version":1,"looks":[{"id":"other","name":"Other","configuration":null},{"id":"future","name":"Future","configuration":{"nested":[{"number":${literal}}]}}]}`;
function fixture(raw) {
    const entries = new Map([[SAVED_LOOKS_KEY, raw]]), writes = [];
    let contractError = null;
    const keyCheck = key => {
        if (key !== SAVED_LOOKS_KEY) { contractError = new Error('Unexpected storage key'); throw contractError; }
    };
    const storage = {
        getItem(key) { keyCheck(key); return entries.get(key) ?? null; },
        setItem(key, value) { keyCheck(key); if (typeof value !== 'string') { contractError = new Error('Unexpected storage value type'); throw contractError; } entries.set(key, value); writes.push(value); }
    };
    const library = new SavedLooks(() => storage, () => 'new');
    return { library, writes, raw: () => entries.get(SAVED_LOOKS_KEY), interleave: value => entries.set(SAVED_LOOKS_KEY, value),
        assertContract: () => { if (contractError) throw contractError; assert.equal(entries.size, 1); } };
}
function number(raw) {
    const item = JSON.parse(raw).looks.find(item => item.id === 'future');
    return item ? { present: true, value: item.configuration.nested[0].number } : { present: false };
}
function tag(observation) {
    if (!observation.present) return { present: false };
    const value = observation.value;
    const type = value === null ? 'null' : typeof value;
    const meaning = type === 'number' ? Object.is(value, -0) ? 'negative-zero' : value === Infinity ? 'positive-infinity' : value === -Infinity ? 'negative-infinity' : Number.isNaN(value) ? 'NaN' : 'finite' : type;
    return { present: true, type, meaning, ...(meaning === 'finite' ? { value } : {}) };
}
function invoke(run) {
    try { return { status: 'ok', value: run() }; }
    catch (error) {
        // A target API refusal is an observation, not an oracle failure.
        if (!(error instanceof Error) || !['This saved look changed. Review it before removing it.', 'The saved collection changed. That removal can no longer be undone.'].includes(error.message)) throw error;
        return { status: 'refused', message: error.message };
    }
}
function operation(result) { return { status: result.status, ...(result.message ? { message: result.message } : {}) }; }
const cases = [];
for (const literal of ['1e400', '-0']) {
    for (const action of ['add', 'remove-other', 'remove-own-undo', 'stale-expected']) {
        const beforeRaw = rawFor(literal), f = fixture(beforeRaw), before = number(beforeRaw);
        assert.equal(before.present, true);
        assert.ok(literal === '-0' ? Object.is(before.value, -0) : before.value === Infinity);
        const selected = f.library.read().looks;
        let op, undo, intermediateRaw, returned, interleavedRaw;
        if (action === 'add') op = invoke(() => f.library.add('New supported look', options));
        if (action === 'remove-other') op = invoke(() => f.library.remove('other', selected[0]));
        if (action === 'remove-own-undo') {
            op = invoke(() => f.library.remove('future', selected[1]));
            intermediateRaw = f.raw();
            if (op.status === 'ok') {
                returned = tag({ present: true, value: op.value.configuration.nested[0].number });
                undo = invoke(() => f.library.undo());
            }
        }
        if (action === 'stale-expected') {
            interleavedRaw = rawFor(literal === '1e400' ? 'null' : '0');
            f.interleave(interleavedRaw);
            op = invoke(() => f.library.remove('future', selected[1]));
        }
        f.assertContract();
        const afterRaw = f.raw(), after = number(afterRaw);
        const sameMeaning = before.present && after.present && Object.is(before.value, after.value);
        const violated = action === 'stale-expected' ? op.status === 'ok' || afterRaw !== interleavedRaw : op.status === 'ok' && (!undo || undo.status === 'ok') && !sameMeaning;
        cases.push({ literal, action, beforeRaw, before: tag(before), operation: operation(op),
            ...(intermediateRaw !== undefined ? { intermediateRaw, returned, undo: undo ? operation(undo) : null } : {}),
            ...(interleavedRaw !== undefined ? { interleavedRaw } : {}),
            afterRaw, after: tag(after), sameMeaning, violated, writes: f.writes });
    }
}
assert.equal(cases.length, 8);
console.log(JSON.stringify({ format: 'sugata-number-fidelity-observation-v1', nodeVersion: process.version, cases,
    violations: cases.filter(row => row.violated).length, scope: 'Injected memory only; decoded 1e400/-0 meanings and expected-item distinction, not full lexical fidelity or human loss.' }, null, 2));
