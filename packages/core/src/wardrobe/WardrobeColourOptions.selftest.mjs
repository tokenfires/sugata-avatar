import assert from 'node:assert/strict';
import { resolveWardrobeColours } from './WardrobeStyleOptions.js';
import { resolveWardrobeOption } from '../Avatar.js';
import { createWardrobeStyle } from './WardrobeStyles.js';
import { loadAvatarWardrobe } from './AvatarWardrobe.js';

let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log('PASS ' + name); };
await check('partial data canonicalizes in fixed order, copies input, and preserves no-override shapes', () => {
    const input = { shoes: '#AbC123', top: '#000000' };
    const result = resolveWardrobeColours(input, 'ecru'); input.top = '#ffffff';
    assert.deepEqual(result, { top: '#000000', shoes: '#abc123' });
    assert.deepEqual(Object.keys(result), ['top', 'shoes']); assert.ok(Object.isFrozen(result));
    assert.throws(() => { result.top = '#ffffff'; }, TypeError);
    assert.deepEqual(resolveWardrobeColours(Object.assign(Object.create(null), {bottom: '#FFFFFF'}), 'charcoal'), {bottom: '#ffffff'});
    assert.equal(resolveWardrobeColours({}, 'charcoal'), undefined);
    assert.equal(resolveWardrobeColours(undefined), undefined);
    assert.deepEqual(resolveWardrobeOption({style: 'ecru', colours: {}}), {outfit: [], foundation: {}, style: 'ecru'});
    assert.deepEqual(resolveWardrobeOption({style: 'original'}), {outfit: [], foundation: {}});
    assert.deepEqual(createWardrobeStyle('original'), {materialStyle: 'original'});
});
await check('strict data rejects malformed hex, inherited, hidden, accessor, symbol and pollution keys without invoking getters', () => {
    const accessor = {}; let reads = 0;
    Object.defineProperty(accessor, 'top', {enumerable: true, get() { reads++; return '#123456'; }});
    const hidden = Object.defineProperty({}, 'top', {value: '#123456'});
    const symbol = {[Symbol('top')]: '#123456'};
    for (const value of [null, [], 1, '#123456', Object.create({top: '#123456'}), accessor, hidden, symbol,
        JSON.parse('{"__proto__":{"polluted":true}}'), {constructor: '#123456'}, {prototype: '#123456'}, {socks: '#123456'},
        ...['red', '#abc', '#12345678', ' #123456', '#123456\n', '#xyzxyz', '', null, undefined, 123456, {}].map(top => ({top}))])
        assert.throws(() => resolveWardrobeColours(value, 'ecru'), /wardrobe.colours/);
    assert.equal(reads, 0); assert.equal({}.polluted, undefined);
});
await check('Original rejects even empty overrides before loading and every creation entrypoint copies the same contract', async () => {
    const nativeFetch = globalThis.fetch; let fetches = 0;
    globalThis.fetch = () => { fetches++; throw new Error('must not load'); };
    try {
        for (const colours of [{}, {top: '#123456'}]) {
            assert.throws(() => resolveWardrobeOption({colours}), /Original/);
            assert.throws(() => createWardrobeStyle('original', colours), /Original/);
            await assert.rejects(loadAvatarWardrobe({outfit: [], foundation: {}, colours}), /Original/);
        }
        assert.equal(fetches, 0);
    } finally { globalThis.fetch = nativeFetch; }
    const input = {bottom: '#ABCDEF'}, request = resolveWardrobeOption({style: 'charcoal', colours: input});
    const material = createWardrobeStyle(request.style, request.colours);
    input.bottom = '#000000'; assert.deepEqual(request.colours, {bottom: '#abcdef'});
    assert.deepEqual(material.materialColours, request.colours); assert.notEqual(material.materialColours, request.colours);
});
console.log(`PASS ${checks} wardrobe colour admission groups`);
