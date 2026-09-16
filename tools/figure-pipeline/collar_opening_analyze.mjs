import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodePng} from '../critic/png.mjs';

const directory = path.resolve(process.argv[2]);
const sha = b => createHash('sha256').update(b).digest('hex');
const report = JSON.parse(fs.readFileSync(directory + '/report.json'));
assert.equal(report.completed, true); assert.deepEqual(report.errors, []);
assert.equal(report.savedPoseReproduced, true);
assert.ok(Object.values(report.disposal.memory).every(n => n === 0));
assert.deepEqual(report.disposal.leaks, []); assert.equal(report.disposalError, undefined);
const images = new Map();
for (const capture of report.captures) {
    const bytes = fs.readFileSync(directory + '/' + capture.name + '.png');
    assert.equal(sha(bytes), capture.sha256);
    images.set(capture.name, decodePng(bytes));
    assert.equal(images.get(capture.name).width, 754); assert.equal(images.get(capture.name).height, 918);
}
const baseline = report.captures[0].state;
for (const capture of report.captures.filter(c => !c.name.includes('-yaw-'))) assert.deepEqual(capture.state, baseline);
const rays = JSON.parse(fs.readFileSync(directory + '/rays.json'));
const rgb = (name, p) => {
    const image = images.get(name), i = (Math.floor(p.y) * image.width + Math.floor(p.x)) * 4;
    return Array.from(image.pixels.slice(i, i + 3), x => Math.round(x * 255));
};
const changed = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));
const groups = [];
for (const label of ['left', 'right']) {
    const samples = [];
    for (let i = 0; i < rays.current.length; i++) {
        const ray = rays.current[i], double = rays.doubleSided[i], full = rays.fullBody[i];
        if (ray.pixel.label !== label) continue;
        const before = rgb('ordinary-converged', ray.pixel), after = rgb('double-sided', ray.pixel);
        // Localization set, not a quality threshold: dark ordinary pixels whose first double-sided hit is the collar back face.
        if (Math.max(...before) >= 20 || double.hits[0]?.id !== 'female_casualsuit01' || double.hits[0].facingDot <= 0) continue;
        samples.push({pixel: ray.pixel, before, after, tag: rgb('foundation-tag', ray.pixel),
            restored: rgb('ordinary-restored', ray.pixel), currentHit: ray.hits[0] ?? null,
            fullBodyHit: full.hits[0] ?? null, doubleSidedHit: double.hits[0]});
    }
    groups.push({label, count: samples.length, currentHitIds: [...new Set(samples.map(s => s.currentHit?.id ?? 'none'))],
        fullBodyHitIds: [...new Set(samples.map(s => s.fullBodyHit?.id ?? 'none'))],
        backFacingTriangles: [...new Set(samples.map(s => s.doubleSidedHit.triangle))].sort((a,b)=>a-b),
        maxFoundationTagDelta: Math.max(0, ...samples.map(s => changed(s.before, s.tag))),
        maxRestorationDelta: Math.max(0, ...samples.map(s => changed(s.before, s.restored))),
        minDoubleSidedChannelIncrease: samples.length ? Math.min(...samples.map(s=>Math.max(...s.after.map((v,k)=>v-s.before[k])))) : null,
        samples});
}
const output = {candidateSHA256: report.candidateSHA256, sourceHashCount: Object.keys(report.sourceHashes).length,
    fixedPoseAcrossControls: true, captureHashesVerified: images.size, zeroTrackedResourcesAfterDispose: true,
    groups, limitation: 'CPU hits exclude GPU hair; selected pixel centers and settled fixed-pose controls are not motion, clearance, containment, all-wardrobe or AAA qualification.'};
fs.writeFileSync(directory + '/analysis.json', JSON.stringify(output, null, 2), {flag: 'wx'});
console.log(JSON.stringify({...output, groups: groups.map(({samples, ...g})=>g)}, null, 2));
