import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

export const POLICY = 'For comparisons with JSON-retained records only, recursively canonicalize numeric -0 to +0. Preserve every other value, type, own property, array hole and prototype; no rounding, epsilon or hash normalization.';

/** JSON-shaped records only; unsupported containers/accessors fail closed instead of coercing. */
export function canonicalizeSignedZero(value) {
    const paths = [], active = new WeakSet();
    const visit = (input, path) => {
        if (Object.is(input, -0)) { paths.push(path); return 0; }
        if (input === null || typeof input !== 'object') return input;
        const prototype = Object.getPrototypeOf(input);
        if ((!Array.isArray(input) && prototype !== Object.prototype && prototype !== null) || active.has(input)) throw TypeError('Expected acyclic JSON-shaped record at ' + path);
        active.add(input);
        const output = Array.isArray(input) ? Object.setPrototypeOf([], prototype) : Object.create(prototype);
        for (const key of Reflect.ownKeys(input)) {
            if (typeof key !== 'string') throw TypeError('Symbol property is not a JSON record at ' + path);
            const descriptor = Object.getOwnPropertyDescriptor(input, key);
            if (!Object.hasOwn(descriptor, 'value')) throw TypeError('Accessor is not a JSON record at ' + path);
            const next = path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
            Object.defineProperty(output, key, { ...descriptor, value: visit(descriptor.value, next) });
        }
        active.delete(input); return output;
    };
    return { value: visit(value, ''), paths, count: paths.length };
}

export function compareRetained(actual, expected, { label, audit, requireEqual = true } = {}) {
    assert.equal(typeof label, 'string'); assert.ok(Array.isArray(audit));
    const a = canonicalizeSignedZero(actual), b = canonicalizeSignedZero(expected);
    const receipt = { label, policy: POLICY, actual: { count: a.count, paths: a.paths }, expected: { count: b.count, paths: b.paths }, equal: isDeepStrictEqual(a.value, b.value) };
    audit.push(receipt);
    if (requireEqual) assert.deepStrictEqual(a.value, b.value, label);
    return receipt.equal;
}
