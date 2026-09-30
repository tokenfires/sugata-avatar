import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Color, SRGBColorSpace } from 'three';
const root = 'captures/hair-colour-controls';
const outputName = process.argv.find(v => v.startsWith('--out='))?.slice(6) ?? 'material-controls.json';
assert.ok(/^[a-z0-9-]+\.json$/.test(outputName));
const bases = new Map();
const checks = [], sources = {}, hash = bytes => createHash('sha256').update(bytes).digest('hex');
let maximumDecodeDifference = 0;
for (const area of ['material-v1', 'calibration-v1', 'confirmation-v1']) for (const dir of fs.readdirSync(`${root}/${area}`)) {
    const file = `${root}/${area}/${dir}/report.json`, bytes = fs.readFileSync(file), r = JSON.parse(bytes);
    assert.equal(r.status, 'captured'); assert.deepEqual(r.errors, []); sources[file] = hash(bytes);
    for (const c of r.cases) {
        const key = `${r.preset}/${r.scene ?? 'studio'}/${r.light ?? 'studio'}/${c.name.replace('default-repeat', 'exact-default')}`;
        if (!bases.has(key)) bases.set(key, c);
        const baseline = bases.get(key);
        const strip = s => { const v = structuredClone(s); delete v.configuration.hairColour; return v; };
        assert.deepEqual(strip(c.fixedState), strip(baseline.fixedState));
        let decodeDifference = 0;
        if (r.hairColour) {
            const expected = new Color().setHex(parseInt(r.hairColour.slice(1), 16), SRGBColorSpace).toArray();
            decodeDifference = Math.max(...c.applied.map((v, i) => Math.abs(v - expected[i])));
            assert.ok(decodeDifference <= Number.EPSILON * 4, 'Cross-runtime colour decode differs beyond floating-point rounding.');
        }
        maximumDecodeDifference = Math.max(maximumDecodeDifference, decodeDifference);
        checks.push({file, case: c.name, heldStateEqualExcludingColourOption: true, applied: r.hairColour ?? 'Original', decodeDifference});
    }
}
const report = {checks, maximumDecodeDifference, sources, limits: [
    'Held physical/camera/noncolour state is exactly equal across these captures. sRGB decoding is compared across browser and Node runtimes with four machine epsilons for roundoff.',
    'The first exact floating-point comparison found a 0.000000000000000000867 difference in the black green channel; that was a cross-runtime arithmetic assumption, not an image mismatch.',
    'This measurement does not assert bit-exact material image repeats or assess colour appearance.'
]};
fs.writeFileSync(`${root}/${outputName}`, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
fs.copyFileSync(new URL(import.meta.url), `${root}/${outputName.replace('.json', '-source.mjs')}`);
console.log(JSON.stringify({cases: checks.length, maximumDecodeDifference}));
