/**
 * Terminal owner for future artist previews. No browser/GPU/client side effects.
 * Callers route synchronous factories and publication through this owner.
 * waitData observes data promises; it cannot cancel them or own async factories.
 * Private partial constructors, callback internals and physical disposal are not
 * guaranteed. A release is attempted once; failures remain visible in inspect().
 */
export class PreviewClosedError extends Error {
    constructor(reason) {
        super('Preview lifetime is closed');
        this.name = 'PreviewClosedError';
        this.reason = reason;
    }
}

export function createPreviewLifetime({ parentSignal, limit = 64 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) throw new RangeError('Resource limit must be 1–64');
    if (parentSignal !== undefined && !(parentSignal instanceof AbortSignal)) throw new TypeError('A same-realm AbortSignal is required');
    const controller = new AbortController(), entries = new Map(), failures = [];
    let closed = false, closing = false, reason, closedError, parentDetach = 'not-needed', inFlight = 0;

    const inspect = () => Object.freeze({
        closed, closing, reason, created: entries.size, inFlightFactories: inFlight,
        releaseAttempts: [...entries.values()].filter(entry => entry.attempted).length,
        pendingReleases: [...entries.values()].filter(entry => !entry.attempted).length,
        parentDetach,
        failures: Object.freeze(failures.map(failure => Object.freeze({ ...failure })))
    });
    const checkpoint = () => {
        if (!closed && parentSignal?.aborted) close(parentSignal.reason);
        if (closed) throw closedError;
    };
    const releaseOne = entry => {
        if (entry.attempted) return { attempted: false };
        // Commit the attempt before callback reentrancy; never retry a failure.
        entry.attempted = true;
        try { entry.dispose(entry.value); return { attempted: true }; }
        catch (error) { failures.push({ stage: 'release', label: entry.label, error }); return { attempted: true, failed: true, error }; }
    };
    const onParentAbort = () => { if (parentSignal.aborted) close(parentSignal.reason); };

    function close(firstReason = 'closed') {
        if (closed) return inspect();
        closed = true; closing = true; reason = firstReason;
        closedError = new PreviewClosedError(reason);
        if (parentDetach === 'pending') {
            try { parentSignal.removeEventListener('abort', onParentAbort); parentDetach = 'removed'; }
            catch (error) { parentDetach = 'failed'; failures.push({ stage: 'parent-detach', error }); }
        }
        try { controller.abort(reason); }
        catch (error) { failures.push({ stage: 'abort', error }); }
        // Explicit release() is refused during close so callbacks cannot reorder
        // this reverse drain. Already explicitly released entries are skipped.
        for (const entry of [...entries.values()].reverse()) releaseOne(entry);
        closing = false;
        return inspect();
    }

    function create(factory, dispose, label = 'resource') {
        if (typeof factory !== 'function' || typeof dispose !== 'function') throw new TypeError('Synchronous factory and disposer required');
        if (typeof label !== 'string' || label.length > 128) throw new TypeError('Short resource label required');
        checkpoint();
        if (entries.size + inFlight >= limit) throw new RangeError('Lifetime resource limit reached');
        let value;
        inFlight++;
        try { value = factory(); }
        finally { inFlight--; }
        if ((typeof value !== 'object' && typeof value !== 'function') || value === null) throw new TypeError('Factory must return a new resource object');
        if (value instanceof Promise) throw new TypeError('Asynchronous resource factories are outside this protocol');
        if (entries.has(value)) throw new TypeError('Resource identity was already registered in this lifetime');
        const entry = { value, dispose, label, attempted: false };
        entries.set(value, entry);
        if (closed) { releaseOne(entry); throw closedError; }
        return value;
    }

    function release(value) {
        const entry = entries.get(value);
        if (!entry || closing) return false;
        const result = releaseOne(entry);
        if (result.failed) throw result.error;
        return result.attempted;
    }

    async function waitData(data) {
        // Attach both settlement handlers even when already closed: a supplied
        // rejected data promise must not become an unhandled orphan here.
        const outcome = Promise.resolve(data).then(value => ({ ok: true, value }), error => ({ ok: false, error }));
        checkpoint();
        const result = await outcome;
        checkpoint();
        if (!result.ok) throw result.error;
        return result.value;
    }

    function publish(commit) {
        if (typeof commit !== 'function') throw new TypeError('Synchronous publication callback required');
        checkpoint();
        const result = commit();
        // A synchronous callback may reenter close; do not publish its result as
        // still authorized. Already-started callback side effects cannot be undone.
        checkpoint();
        return result;
    }

    if (parentSignal !== undefined) {
        if (parentSignal.aborted) close(parentSignal.reason);
        else {
            parentDetach = 'pending';
            try { parentSignal.addEventListener('abort', onParentAbort); }
            catch (error) { close(error); throw error; }
            // Standard same-realm methods cannot asynchronously interleave here;
            // this also observes a signal aborted by a synchronous wrapper.
            if (parentSignal.aborted && !closed) close(parentSignal.reason);
        }
    }
    return Object.freeze({ signal: controller.signal, checkpoint, create, release, waitData, publish, close, inspect });
}
