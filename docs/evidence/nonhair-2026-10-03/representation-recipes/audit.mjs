// One CPU-only recipe extraction and fixed declaration audit; no Avatar or asset loader.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { GarmentManifest } from '../../../../packages/core/src/wardrobe/GarmentManifest.js';
import { readShowcaseSettings, showcaseSettingsUrl } from '../../../../packages/testbed/src/showcase-settings.mjs';
import { optionsForShowcase, resolveShowcaseSelection } from '../../../../packages/testbed/src/showcase-presets.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const packet = fileURLToPath(new URL('./', import.meta.url));
const stop = '2026-10-03T13:33:00Z';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const checkTime = () => assert(Date.now() < Date.parse(stop), 'Fixed packet deadline reached.');
const read = relative => fs.readFile(path.join(root, relative));
const receipt = { started: new Date().toISOString(), pid: process.pid, node: process.version,
    command: 'node docs/evidence/nonhair-2026-10-03/representation-recipes/audit.mjs',
    stop, scope: 'CPU-only: settings reconstruction, declared fragments and physical-file headers; no appearance or fit verdict',
    inputs: [], recipes: [], queries: [], physicalFiles: [] };
const capture = 'captures/wardrobe-hair-cut-2026-10-03-v1';
const inputs = [
    `${capture}/report.json`, `${capture}/changed-look.json`,
    `${capture}/desktop-before.png`, `${capture}/desktop-long-bob.png`,
    'assets/wardrobe/manifest.json', 'packages/core/src/wardrobe/GarmentManifest.js',
    'packages/core/src/figure/Identity.js', 'packages/core/src/Avatar.js',
    'packages/core/src/material/HairColourOptions.js', 'packages/core/src/wardrobe/WardrobeStyleOptions.js',
    'packages/testbed/src/showcase-settings.mjs', 'packages/testbed/src/showcase-presets.mjs',
    'packages/testbed/src/showcase-colours.mjs', 'packages/testbed/src/viewer-scenes.mjs',
    'packages/testbed/src/showcase.html', 'packages/testbed/src/showcase.js',
    'node_modules/three/package.json', 'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js',
    'docs/PRODUCT-ROADMAP.md', 'docs/research/POSE-AWARE-FIT-NEXT-2026-09-30.md',
    'docs/evidence/nonhair-2026-10-03/representation-value/CRITIC-VALUE.md',
    'docs/evidence/nonhair-2026-10-03/representation-recipes/PLAN.md',
    'docs/evidence/nonhair-2026-10-03/representation-recipes/audit.mjs'
];
try {
    checkTime();
    for (const relative of inputs) {
        const bytes = await read(relative);
        receipt.inputs.push({ path: relative, bytes: bytes.length, sha256: sha(bytes) });
    }
    const nativeBytes = await read(`${capture}/report.json`);
    assert.equal(sha(nativeBytes), 'c5b08ca36d2dc97a60e402ef098527eb4ae2458c8ce82f758c6985d1757c2e33');
    const native = JSON.parse(nativeBytes);
    assert.deepEqual(native.errors, []);
    const initial = native.guards.find(g => g.kind === 'initial supported complex recipe');
    const transition = native.cases.find(c => c.label === 'desktop-long-bob');
    const reopening = native.guards.find(g => g.kind === 'actual downloaded JSON reopening');
    const chin = initial.snapshot.configuration;
    const longBytes = await read(`${capture}/changed-look.json`);
    const long = JSON.parse(longBytes);
    assert.deepEqual(chin, transition.before.configuration);
    assert.deepEqual(long, transition.after.configuration);
    assert.deepEqual(long, reopening.after.configuration);
    assert.equal(sha(longBytes), reopening.sha256);
    assert.equal(chin.hair, 'bob02');
    assert.equal(long.hair, 'bob01');
    assert.deepEqual({ ...chin, hair: 'bob01' }, long);

    const recipes = [
        { path: 'looks/sage-lavender-chin.json', bytes: Buffer.from(JSON.stringify(chin, null, 2) + '\n'),
            configuration: chin, origin: `${capture}/report.json: guards[kind=initial supported complex recipe].snapshot.configuration` },
        { path: 'looks/sage-lavender-long.json', bytes: longBytes,
            configuration: long, origin: `${capture}/changed-look.json (exact downloaded/reopened bytes)` }
    ];
    for (const recipe of recipes) {
        const selection = await readShowcaseSettings({ size: recipe.bytes.length, text: async () => recipe.bytes.toString('utf8') });
        assert.deepEqual(optionsForShowcase(selection), recipe.configuration);
        const url = showcaseSettingsUrl(selection, 'http://127.0.0.1:5173/src/showcase.html');
        assert.deepEqual(optionsForShowcase(resolveShowcaseSelection(url.searchParams)), recipe.configuration);
        receipt.recipes.push({ path: recipe.path, origin: recipe.origin, bytes: recipe.bytes.length,
            sha256: sha(recipe.bytes), selection, url: url.href, exactSettingsAndUrlReconstruction: true });
    }

    const source = JSON.parse(await read('assets/wardrobe/manifest.json'));
    const manifest = new GarmentManifest(source);
    const ids = ['foundation_bra', 'foundation_vest', 'foundation_briefs', 'foundation_boxer_brief',
        'female_casualsuit01', 'female_elegantsuit01', 'shoes01'];
    const keys = ['g000', 'g025', 'g050', 'g075', 'g100'];
    for (const id of ids) {
        assert.deepEqual(Object.keys(manifest.require(id).fragments), ['g050']);
        for (const key of keys) {
            const row = { id, key, admitted: false };
            try { row.url = manifest.fragmentUrl(id, key); row.admitted = true; }
            catch (error) { row.error = error.message; }
            assert.equal(row.admitted, key === 'g050');
            if (row.admitted) assert.equal(row.url, `${id}/g050.glb`);
            else assert.equal(row.error, `GarmentManifest: '${id}' has no fragment for figure '${key}'. It declares g050.`);
            receipt.queries.push(row);
            const relative = `assets/wardrobe/${id}/${key}.glb`;
            let bytes;
            try { bytes = await read(relative); }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
            if (bytes) {
                assert(bytes.length >= 12);
                const header = { magic: bytes.toString('ascii', 0, 4), version: bytes.readUInt32LE(4), length: bytes.readUInt32LE(8) };
                assert.equal(header.magic, 'glTF'); assert.equal(header.version, 2); assert.equal(header.length, bytes.length);
                receipt.physicalFiles.push({ path: relative, present: true, bytes: bytes.length, sha256: sha(bytes), header,
                    declared: row.admitted, limit: 'Header/inventory only; geometry, fit and appearance not evaluated.' });
            } else receipt.physicalFiles.push({ path: relative, present: false, declared: row.admitted });
        }
    }
    assert.equal(receipt.queries.length, 35);
    assert.equal(receipt.queries.filter(row => row.admitted).length, 7);
    assert.equal(receipt.physicalFiles.filter(row => row.present).length, 21);
    for (const pin of receipt.inputs) assert.equal(sha(await read(pin.path)), pin.sha256, `Input changed: ${pin.path}`);
    checkTime();
    await fs.mkdir(path.join(root, 'looks'), { recursive: true });
    for (const recipe of recipes) await fs.writeFile(path.join(root, recipe.path), recipe.bytes, { flag: 'wx' });
    receipt.status = 'pass';
    receipt.decision = 'Deliver exact existing g050 recipe examples. Non-g050 wardrobe remains undeclared despite endpoint files; complete representative capsule authoring and visual/pose qualification must precede broader support.';
} catch (error) { receipt.status = 'refused'; receipt.error = { name: error.name, message: error.message }; process.exitCode = 1; }
receipt.finished = new Date().toISOString();
await fs.writeFile(path.join(packet, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, pid: receipt.pid, started: receipt.started, finished: receipt.finished,
    inputs: receipt.inputs.length, recipes: receipt.recipes.length, queries: receipt.queries.length,
    admitted: receipt.queries.filter(row => row.admitted).length, error: receipt.error }));
