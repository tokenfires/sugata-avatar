import assert from 'node:assert/strict';
import { canonicalizeSignedZero, compareRetained } from './retained-json-comparison.mjs';

const audit = [], source = { camera: [-0, 0, 1], nested: { 'a/b~c': -0 }, flag: false, text: '-0', nil: null };
assert.equal(compareRetained(source, JSON.parse(JSON.stringify(source)), { label: 'signed-zero JSON boundary', audit }), true);
assert.deepEqual(audit[0].actual, { count: 2, paths: ['/camera/0', '/nested/a~1b~0c'] });
assert.deepEqual(audit[0].expected, { count: 0, paths: [] });
assert.ok(Object.is(source.camera[0], -0)); assert.ok(Object.is(source.nested['a/b~c'], -0));
assert.equal(canonicalizeSignedZero(source).value.text, '-0');
console.log('PASS 1: only numeric signed zero changes, exact paths retained, originals unchanged');

const float = new Float64Array([1]), bits = new BigUint64Array(float.buffer); bits[0] += 1n;
assert.equal(float[0], 1 + Number.EPSILON);
for (const [actual, expected] of [[{x: float[0]}, {x: 1}], [{x: Number.MIN_VALUE}, {x: 0}], [{x: -Number.MIN_VALUE}, {x: -0}], [{x: Infinity}, {x: null}], [{x: NaN}, {x: null}]]) {
    const rejected = [];
    assert.throws(() => compareRetained(actual, expected, { label: 'nonzero difference', audit: rejected }), assert.AssertionError);
    assert.equal(rejected[0].equal, false);
}
console.log('PASS 2: nextafter, tiny finite and other nonzero/value differences still fail exactly');

for (const [actual, expected] of [[{x: undefined}, {}], [{x: 0}, {x: '0'}], [[0], {0: 0}], [[, 0], [undefined, 0]], [Object.assign(Object.create(null), {x: 0}), {x: 0}]]) {
    assert.throws(() => compareRetained(actual, expected, { label: 'structural difference', audit: [] }), assert.AssertionError);
}
assert.throws(() => canonicalizeSignedZero(new Map([['x', -0]])), TypeError);
assert.throws(() => canonicalizeSignedZero({get x() { throw Error('must not call getter'); }}), TypeError);
const cycle = {}; cycle.self = cycle; assert.throws(() => canonicalizeSignedZero(cycle), TypeError);
const observed = []; assert.equal(compareRetained({x: 1}, {x: 2}, {label: 'observed difference', audit: observed, requireEqual: false}), false);
assert.equal(observed.length, 1);
console.log('PASS 3: structure/types/holes/prototypes preserved; unsupported records fail closed; observational comparison audited');
