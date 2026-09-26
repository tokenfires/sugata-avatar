// Pure accounting for a single caller-owned update. No scalar timestamp fallback.
export const TYPES = Object.freeze(['render', 'compute']);
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
const finite = n => typeof n === 'number' && Number.isFinite(n);

export function accountUpdate(update, resolutions, previouslySeen = new Set()) {
    requireThat(Number.isSafeInteger(update?.id) && update.id > 0, 'Invalid update ID.');
    requireThat(update.updateCalls===1 && Array.isArray(update.receivedDts) && update.receivedDts.length===1 && update.receivedDts[0]===update.dt, 'Expected one native update with the declared dt.');
    requireThat(update.dt===1/60 && finite(update.clockBefore) && update.clockAfter===update.clockBefore+update.dt &&
        Number.isSafeInteger(update.stackFrameBefore) && update.stackFrameAfter===update.stackFrameBefore+1, 'Native clock/frame boundary mismatch.');
    requireThat(Array.isArray(update.queries) && update.queries.length > 0, 'No observed queries.');
    requireThat(Array.isArray(resolutions) && resolutions.length === 2, 'Both query pools must be accounted.');
    const seen = new Set(), rows = [], totals = {render: 0, compute: 0};
    for (const type of TYPES) {
        const queries = update.queries.filter(q => q.type === type);
        requireThat(Number.isSafeInteger(update.passes?.[type]) && update.passes[type] > 0, `Missing native ${type} passes.`);
        requireThat(queries.length === update.passes[type], `Incomplete ${type} pass coverage.`);
        const matches = resolutions.filter(r => r.type === type);
        requireThat(matches.length === 1, `Duplicate/missing ${type} resolution.`);
        const r = matches[0];
        requireThat(r.updateId === update.id, 'Resolution belongs to another update.');
        requireThat(r.pendingBefore === false && r.mapStateBefore === 'unmapped', 'Resolution was already pending/mapped.');
        requireThat(r.pendingAfter === false && r.mapStateAfter === 'unmapped', 'Resolution did not finish.');
        requireThat(r.queryCount === queries.length * 2 && r.remainingQueryCount === 0 && r.remainingOffsets === 0, 'Unattributed or undrained queries.');
        requireThat(Array.isArray(r.offsets) && r.offsets.length === queries.length && Array.isArray(r.values) && r.values.length === queries.length, 'Missing query results.');
        const offsets = new Map(r.offsets), values = new Map(r.values.map(v => [v.uid, v]));
        requireThat(offsets.size === queries.length && values.size === queries.length, 'Duplicate result records.');
        for (let i = 0; i < queries.length; i++) {
            const q = queries[i];
            const pattern=type==='render' && q.groupKind==='render'?/^r:\d+:\d+:f\d+$/:type==='compute' && q.groupKind==='node'?/^c:\d+:\d+:f\d+$/:type==='compute' && q.groupKind==='array'?/^r:\d+:undefined:f\d+$/:null;
            requireThat(q.updateId === update.id && typeof q.uid === 'string' && pattern?.test(q.uid), 'Query ownership/type mismatch.');
            requireThat(!seen.has(q.uid) && !previouslySeen.has(q.uid), 'Reused timestamp UID.');
            requireThat(q.before === i * 2 && q.after === q.before + 2 && q.base === q.before && q.begin === q.base && q.end === q.base + 1, 'Invalid query allocation/write pair.');
            requireThat(q.querySetMatches === true && Number.isSafeInteger(q.maxQueries) && q.end < q.maxQueries, 'Disabled/overflowed timestamp writes.');
            requireThat(offsets.get(q.uid) === q.base, 'Query allocation map mismatch.');
            const v = values.get(q.uid);
            requireThat(v && v.existedBefore === false && v.existsAfter === true && finite(v.durationMs) && v.durationMs >= 0, 'Stale, missing or invalid timestamp result.');
            seen.add(q.uid); totals[type] += v.durationMs;
            rows.push({updateId: update.id, type, uid: q.uid, durationMs: v.durationMs});
        }
    }
    requireThat(seen.size === update.queries.length, 'Unknown query type.');
    requireThat(finite(totals.render) && finite(totals.compute) && finite(totals.render+totals.compute), 'Duration overflow.');
    // Commit only after the entire update passes. Rejected records cannot poison a retry.
    for (const uid of seen) previouslySeen.add(uid);
    return {updateId: update.id, passes: {...update.passes}, durationMs: {...totals, passSum: totals.render + totals.compute}, rows,
        scope: 'Three render/compute pass sum; excludes copies, query resolution, composition and presentation.'};
}

export function summarize(values) {
    requireThat(Array.isArray(values) && values.length > 0 && values.every(finite), 'Finite nonempty samples required.');
    const sorted = [...values].sort((a,b) => a-b), percentile = p => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
    return {count: values.length, median: percentile(.5), p90: percentile(.9), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1),
        convention: 'nearest rank: sorted[ceil(p*n)-1]'};
}
