import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createPreviewLifetime, PreviewClosedError } from './artist-preview-lifetime.mjs';

// The actual shared owner is the only implementation under test. Resources,
// publications and data settlement have an independent visible event trace.
const started = performance.now(), cases = [];
const stop = process.env.SUGATA_PREVIEW_PROOF_STOP === undefined ? Date.now() + 5000 : Date.parse(process.env.SUGATA_PREVIEW_PROOF_STOP);
function guard() {
    assert.ok(Number.isFinite(stop) && Date.now() < stop, 'Absolute proof stop');
    assert.ok(performance.now() - started < 5000, 'Cooperative post-import 5s');
    assert.ok(process.memoryUsage().rss < 402653184, 'Sampled RSS below384MiB');
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fake(owner, trace, label, duringRelease = () => {}) {
    return owner.create(() => { trace.push('create:' + label); return { label }; }, value => { trace.push('release:' + value.label); duringRelease(value); }, label);
}
function closed(fn, reason) { assert.throws(fn, error => error instanceof PreviewClosedError && error.reason === reason); }
function observeParent(parent, trace) {
    const signal = parent.signal, add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal), live = new Set();
    signal.addEventListener = (type, fn, options) => { if (type === 'abort') { trace.push('listen:add'); live.add(fn); } return add(type, fn, options); };
    signal.removeEventListener = (type, fn, options) => { if (type === 'abort') { trace.push('listen:remove'); assert.ok(live.delete(fn), 'Remove exact owned listener'); } return remove(type, fn, options); };
    return live;
}
async function scenario(name, body) {
    guard(); assert.ok(cases.length < 30); const trace = []; await body(trace); guard(); cases.push({ name, trace });
}

async function main() {
    await scenario('open data/factory/publication/manual release/close', async trace => {
        const owner = createPreviewLifetime(), data = await owner.waitData(Promise.resolve('model'));
        const value = fake(owner, trace, data); assert.equal(owner.publish(() => { trace.push('publish'); return 7; }), 7);
        assert.equal(owner.release(value), true); owner.close('done'); assert.deepEqual(trace, ['create:model', 'publish', 'release:model']);
        assert.equal(owner.inspect().pendingReleases, 0);
    });
    await scenario('terminal close refuses new factory and publication invocation', trace => {
        const owner = createPreviewLifetime(); owner.close('closed-before');
        closed(() => fake(owner, trace, 'late'), 'closed-before'); closed(() => owner.publish(() => trace.push('late-publication')), 'closed-before');
        assert.deepEqual(trace, []); assert.equal(owner.signal.aborted, true);
    });
    await scenario('model data fulfils after close without factory or publication', async trace => {
        const owner = createPreviewLifetime(), data = deferred(), task = owner.waitData(data.promise);
        const rejected = assert.rejects(task, e => e instanceof PreviewClosedError && e.reason === 'pagehide');
        owner.close('pagehide'); data.resolve('model'); await rejected;
        closed(() => fake(owner, trace, 'model'), 'pagehide'); closed(() => owner.publish(() => trace.push('publish')), 'pagehide'); assert.deepEqual(trace, []);
    });
    await scenario('rejected deferred data after close reports lifetime reason', async trace => {
        const owner = createPreviewLifetime(), data = deferred(), original = Error('data failure');
        const task = owner.waitData(data.promise), rejected = assert.rejects(task, e => e instanceof PreviewClosedError && e.reason === 'closed-during-data');
        owner.close('closed-during-data'); data.reject(original); await rejected; assert.deepEqual(trace, []);
    });
    await scenario('open data rejection preserves original error identity', async trace => {
        const owner = createPreviewLifetime(), error = Error('open rejection');
        await assert.rejects(owner.waitData(Promise.reject(error)), e => e === error); assert.equal(owner.inspect().closed, false); owner.close(); assert.deepEqual(trace, []);
    });
    await scenario('close between fulfilled wait and next owner operation', async trace => {
        const owner = createPreviewLifetime(); assert.equal(await owner.waitData('data'), 'data'); trace.push('settled'); owner.close('between');
        closed(() => fake(owner, trace, 'late'), 'between'); closed(() => owner.publish(() => trace.push('publish')), 'between'); assert.deepEqual(trace, ['settled']);
    });
    await scenario('last decode/hash seam cannot publish after close', async trace => {
        const owner = createPreviewLifetime(), hash = deferred(), waiting = deferred();
        const task = (async () => { await owner.waitData('decoded pixels'); trace.push('decoded'); waiting.resolve(); await owner.waitData(hash.promise); owner.publish(() => trace.push('published')); })();
        const rejected = assert.rejects(task, e => e instanceof PreviewClosedError && e.reason === 'last-seam');
        await waiting.promise; owner.close('last-seam'); hash.resolve('digest'); await rejected; assert.deepEqual(trace, ['decoded']);
    });
    await scenario('reverse drain skips explicit release and repeated close', trace => {
        const owner = createPreviewLifetime(), a = fake(owner, trace, 'a'), b = fake(owner, trace, 'b'); fake(owner, trace, 'c');
        assert.equal(owner.release(b), true); owner.close('first'); owner.close('second'); assert.equal(owner.release(a), false);
        assert.deepEqual(trace, ['create:a', 'create:b', 'create:c', 'release:b', 'release:c', 'release:a']);
        assert.equal(owner.inspect().reason, 'first'); assert.equal(owner.inspect().releaseAttempts, 3);
    });
    await scenario('release errors remain visible while reverse cleanup continues', trace => {
        const owner = createPreviewLifetime(), ea = Error('a'), ec = Error('c');
        fake(owner, trace, 'a', () => { throw ea; }); fake(owner, trace, 'b'); fake(owner, trace, 'c', () => { throw ec; });
        const result = owner.close('done'); assert.deepEqual(trace, ['create:a', 'create:b', 'create:c', 'release:c', 'release:b', 'release:a']);
        assert.deepEqual(result.failures.map(f => [f.label, f.error]), [['c', ec], ['a', ea]]); assert.equal(result.pendingReleases, 0); assert.equal(result.releaseAttempts, 3);
    });
    await scenario('explicit failed release propagates exactly and is never retried', trace => {
        const owner = createPreviewLifetime(), error = Error('dispose'); const a = fake(owner, trace, 'a', () => { throw error; });
        assert.throws(() => owner.release(a), e => e === error); owner.close(); assert.equal(owner.release(a), false);
        assert.deepEqual(trace, ['create:a', 'release:a']); assert.equal(owner.inspect().failures[0].error, error);
    });
    await scenario('throw undefined is still a release failure', trace => {
        const owner = createPreviewLifetime(), a = fake(owner, trace, 'a', () => { throw undefined; });
        let didThrow = false, caught = 1; try { owner.release(a); } catch (error) { didThrow = true; caught = error; }
        assert.equal(didThrow, true); assert.equal(caught, undefined); owner.close(); assert.equal(owner.inspect().failures.length, 1); assert.deepEqual(trace, ['create:a', 'release:a']);
    });
    await scenario('disposer reentrancy preserves terminal state and reverse order', trace => {
        const owner = createPreviewLifetime(); let attemptedRelease;
        const a = fake(owner, trace, 'a'); fake(owner, trace, 'b', () => {
            trace.push('reenter'); const result = owner.close('ignored'); attemptedRelease = owner.release(a); trace.push('closing:' + result.closing);
            try { fake(owner, trace, 'late'); } catch (error) { trace.push(error.name); }
        });
        owner.close('outer'); assert.equal(attemptedRelease, false); assert.deepEqual(trace, ['create:a', 'create:b', 'release:b', 'reenter', 'closing:true', 'PreviewClosedError', 'release:a']);
        assert.equal(owner.inspect().failures.length, 0);
    });
    await scenario('factory reenters close and late completed resource is not returned', trace => {
        const owner = createPreviewLifetime(); fake(owner, trace, 'early'); let returned = false;
        closed(() => { owner.create(() => { trace.push('factory:late'); owner.close('inside-factory'); return { label: 'late' }; }, r => trace.push('release:' + r.label), 'late'); returned = true; }, 'inside-factory');
        assert.equal(returned, false); assert.deepEqual(trace, ['create:early', 'factory:late', 'release:early', 'release:late']); assert.equal(owner.inspect().pendingReleases, 0);
    });
    await scenario('late completed disposer failure is recorded before closed error', trace => {
        const owner = createPreviewLifetime(), error = Error('late disposal');
        closed(() => owner.create(() => { owner.close('factory-close'); return {}; }, () => { trace.push('late-attempt'); throw error; }, 'late'), 'factory-close');
        assert.equal(owner.inspect().failures[0].error, error); assert.deepEqual(trace, ['late-attempt']); assert.equal(owner.inspect().pendingReleases, 0);
    });
    await scenario('resource identity is registered once for the entire lifetime', trace => {
        const owner = createPreviewLifetime(), resource = fake(owner, trace, 'one');
        assert.throws(() => owner.create(() => resource, () => trace.push('wrong-disposer')), /already registered/); owner.release(resource);
        assert.throws(() => owner.create(() => resource, () => trace.push('wrong-disposer')), /already registered/); owner.close(); assert.deepEqual(trace, ['create:one', 'release:one']);
    });
    await scenario('factory throw preserves error and releases its reserved slot', trace => {
        const owner = createPreviewLifetime({ limit: 1 }), error = Error('constructor failed');
        assert.throws(() => owner.create(() => { trace.push('throwing-factory'); throw error; }, () => trace.push('unowned')), e => e === error);
        assert.equal(owner.inspect().inFlightFactories, 0); fake(owner, trace, 'next'); owner.close(); assert.deepEqual(trace, ['throwing-factory', 'create:next', 'release:next']);
    });
    await scenario('pre-aborted parent creates no listener or resources', trace => {
        const parent = new AbortController(), reason = { why: 'already' }; parent.abort(reason); const live = observeParent(parent, trace), owner = createPreviewLifetime({ parentSignal: parent.signal });
        assert.equal(owner.inspect().closed, true); assert.equal(owner.signal.reason, reason); closed(() => fake(owner, trace, 'late'), reason); assert.equal(live.size, 0); assert.deepEqual(trace, []);
    });
    await scenario('parent abort detaches exact listener before notification and drain', trace => {
        const parent = new AbortController(), live = observeParent(parent, trace), owner = createPreviewLifetime({ parentSignal: parent.signal }), reason = { why: 'parent' };
        const a = fake(owner, trace, 'a'); fake(owner, trace, 'b'); let releaseDuringClose, blockedName;
        owner.signal.addEventListener('abort', () => { trace.push('owned:abort'); releaseDuringClose = owner.release(a); try { fake(owner, trace, 'late'); } catch (e) { blockedName = e.name; } });
        parent.abort(reason); assert.equal(live.size, 0); assert.equal(owner.signal.reason, reason); assert.equal(releaseDuringClose, false); assert.equal(blockedName, 'PreviewClosedError');
        assert.deepEqual(trace, ['listen:add', 'create:a', 'create:b', 'listen:remove', 'owned:abort', 'release:b', 'release:a']); assert.equal(owner.inspect().parentDetach, 'removed');
    });
    await scenario('manual close removes parent listener once and preserves first reason', trace => {
        const parent = new AbortController(), live = observeParent(parent, trace), owner = createPreviewLifetime({ parentSignal: parent.signal }); fake(owner, trace, 'a');
        owner.close('manual'); parent.abort('later'); owner.close('again'); assert.equal(live.size, 0); assert.equal(owner.signal.reason, 'manual'); assert.deepEqual(trace, ['listen:add', 'create:a', 'listen:remove', 'release:a']);
    });
    await scenario('resource cap reserves synchronous reentrant factory slots', trace => {
        const owner = createPreviewLifetime({ limit: 1 }); owner.create(() => {
            trace.push('outer-factory'); assert.throws(() => fake(owner, trace, 'nested'), /resource limit/); return { label: 'outer' };
        }, r => trace.push('release:' + r.label));
        assert.equal(owner.inspect().created, 1); assert.equal(owner.inspect().inFlightFactories, 0); owner.close(); assert.deepEqual(trace, ['outer-factory', 'release:outer']);
    });
    await scenario('capacity is lifetime-wide and invalid callbacks never invoke factories', trace => {
        const owner = createPreviewLifetime({ limit: 1 }), a = fake(owner, trace, 'a'); owner.release(a);
        assert.throws(() => fake(owner, trace, 'excess'), /resource limit/); assert.throws(() => owner.create(() => trace.push('bad'), null), /factory and disposer/);
        assert.throws(() => createPreviewLifetime({ limit: 0 }), /1–64/); assert.throws(() => createPreviewLifetime({ parentSignal: {} }), /AbortSignal/); owner.close(); assert.deepEqual(trace, ['create:a', 'release:a']);
    });
    await scenario('already closed data call consumes supplied rejected promise', async trace => {
        const owner = createPreviewLifetime(); owner.close('preclosed'); await assert.rejects(owner.waitData(Promise.reject(Error('input'))), e => e instanceof PreviewClosedError && e.reason === 'preclosed');
        assert.deepEqual(trace, []);
    });
    await scenario('publication error preserves error and publication-close refuses its return', trace => {
        const owner = createPreviewLifetime(), error = Error('commit'); assert.throws(() => owner.publish(() => { throw error; }), e => e === error);
        closed(() => owner.publish(() => { trace.push('commit-start'); owner.close('inside-commit'); trace.push('commit-end'); return 'stale'; }), 'inside-commit');
        closed(() => owner.publish(() => trace.push('later')), 'inside-commit'); assert.deepEqual(trace, ['commit-start', 'commit-end']);
    });
    await scenario('unknown release and repeated release have no side effects', trace => {
        const owner = createPreviewLifetime(); assert.equal(owner.release({}), false); const a = fake(owner, trace, 'a'); assert.equal(owner.release(a), true); assert.equal(owner.release(a), false); owner.close(); assert.deepEqual(trace, ['create:a', 'release:a']);
    });
    assert.equal(cases.length, 24); guard();
}

let error, failed = false;
try { await main(); } catch (caught) { failed = true; error = caught; process.exitCode = 1; }
const report = { schema: 'sugata-preview-lifetime-proof-v1', status: failed ? 'FAILED' : 'PASS', pid: process.pid, utc: new Date().toISOString(), node: process.versions.node, groups: cases.length, cases,
    error: failed ? String(error?.stack ?? error) : null, post_import_ms: performance.now() - started, sampled_rss_bytes: process.memoryUsage().rss,
    limits: 'Deterministic actual shared owner/deferred data/synchronous fake resource and publication traces only. No geometry/DOM/browser/GPU/network/file mutation, private constructor/physical retirement/performance/appearance or future client adoption proof.' };
const text = JSON.stringify(report, null, 2) + '\n';
assert.ok(Buffer.byteLength(text) <= 65536, 'Proof output ceiling'); process.stdout.write(text);
