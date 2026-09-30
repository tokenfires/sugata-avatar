/** Fixed-groom diagnostics on the actual Showcase. Production modules are never routed.
 * node tools/critic/hair-colour-diagnostic.mjs --out=captures/hair-colour-2026-09-29/pilot-v1
 * Optional: --views=back,rear-oblique,right-profile --preset=casual --frames=96
 * Each arm starts in a fresh browser context. Default arms change only the base-colour vector.
 * Optional geometry export, card removal, layer hues and isolated GLB routing are recorded explicitly.
 * This records appearance evidence; it does not qualify motion or a replacement hairstyle.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';
import { decodePng } from './png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const arg = (name, fallback) => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const out = path.resolve(root, arg('out', 'captures/hair-colour-2026-09-29/pilot-v1'));
const preset = arg('preset', 'casual');
const scene = arg('scene', 'studio'), light = arg('light', 'studio');
assert.ok(['studio', 'kitchen'].includes(scene) && ['studio', 'warm'].includes(light));
const hairColour = arg('hair-colour', null);
assert.ok(hairColour === null || /^#[0-9a-f]{6}$/.test(hairColour));
const candidate = arg('candidate', null);
assert.ok(candidate === null || (preset === 'casual' && candidate.startsWith('captures/') && candidate.endsWith('.glb')), 'Candidates must be isolated bob02 GLBs in captures/.');
const frames = Number(arg('frames', '96'));
const clockMode = arg('clock', 'owned');
assert.ok(['owned', 'ambient'].includes(clockMode));
const lightingMode = arg('lighting', 'original');
assert.ok(['original', 'neutral-chromaticity'].includes(lightingMode));
const angles = { front: 0, 'front-right': 45, 'right-profile': 90, 'rear-oblique': 135, 'rear-left': -135, back: 180, 'left-profile': -90, 'front-left': -45 };
const views = arg('views', 'back').split(',');
assert.ok(['casual', 'elegant'].includes(preset));
assert.ok(Number.isInteger(frames) && frames >= 24 && frames <= 512);
assert.ok(views.length && views.every(v => Object.hasOwn(angles, v)));
assert.ok(!fs.existsSync(path.join(out, 'report.json')), 'Use a new output directory; retain prior evidence.');
fs.mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const sourcePaths = [
    'tools/critic/hair-colour-diagnostic.mjs', 'tools/critic/hair-attribution-browser.mjs', 'packages/core/src/render/MotionProbe.mjs',
    'packages/testbed/src/showcase.html', 'packages/testbed/src/showcase.js',
    'packages/testbed/src/showcase-presets.mjs', 'packages/testbed/src/viewer-framing.mjs',
    'packages/testbed/src/showcase-hair-colours.mjs', 'packages/testbed/src/showcase-hair-colours.css',
    'packages/testbed/src/showcase-settings.mjs', 'packages/core/src/material/HairColourOptions.js',
    'packages/core/src/Avatar.js', 'packages/core/src/render/Stage.js',
    'packages/core/src/render/LightingRig.js', 'packages/core/src/render/Grade.js',
    'packages/core/src/render/TRAAPost.js',
    'packages/core/src/material/HairMaterial.js', 'packages/core/src/render/HairOIT.js',
    'packages/core/src/motion/HairDynamics.js',
    'assets/hair/bob01/g050.glb', 'assets/hair/bob02/g050.glb',
    ...(candidate === null ? [] : [candidate])
];
const sourceHashes = () => Object.fromEntries(sourcePaths.map(p => [p, sha(fs.readFileSync(path.join(root, p)))]));
const identityMode = arg('identity', 'off');
assert.ok(['off', 'layers'].includes(identityMode));
const hideCards = arg('hide-cards', '').split(',').filter(Boolean).map(Number);
assert.ok(hideCards.every(c => Number.isInteger(c) && c >= 0));
const hideCaps = arg('hide-caps', 'off') === 'on';
const exportGeometry = arg('geometry', 'off') === 'on';
const colourSelection = arg('colours', 'all');
const colours = [
    { id: 'exact-default', hex: null, label: 'Exact current dark' },
    { id: 'medium-brown', hex: '765344', label: 'Medium brown diagnostic' },
    { id: 'pale-neutral', hex: 'c8baa4', label: 'Pale desaturated diagnostic' },
    { id: 'default-repeat', hex: null, label: 'Exact dark repeated independently' }
].filter(c => colourSelection === 'all' || colourSelection.split(',').includes(c.id));
assert.ok(colours.length > 0);
if (colours.some(c => c.id === 'default-repeat')) assert.ok(colours.some(c => c.id === 'exact-default'));
const report = { started: new Date().toISOString(), pid: process.pid, preset, scene, light, hairColour, candidate, frames, views, clockMode, lightingMode, hideCards, hideCaps, identityMode,
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 }, sourceHashes: sourceHashes(),
    cases: [], errors: [], status: 'running',
    limits: ['Fixed-pose appearance only; no motion or final-colour qualification.',
        'Base colour affects scattering and temporal guide inputs as well as visible colour.',
        'The owned clock stops the private renderer animation and resets node/temporal epochs using the existing alive capture pattern; independent dark repeats measure residual image differences.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let server, browser, page;
save();
for (const relative of sourcePaths.filter(p => !p.startsWith('assets/'))) {
    const copy = path.join(out, 'source', relative);
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(path.join(root, relative), copy);
}
try {
    server = await startProbeServer({ port: 5297 });
    browser = await launchProbeBrowser();
    report.baseUrl = server.baseUrl; save();
    for (const view of views) {
        let held = null, dark = null;
        for (const colour of colours) {
            const name = `${preset}-${view}-${colour.id}`;
            console.log(`START ${name}`);
            page = await browser.newPage({ viewport: { width: report.viewport.width, height: report.viewport.height }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
            page.on('requestfailed', r => errors.push(`${r.url()} ${r.failure()?.errorText}`));
            page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
            let candidateLoads = 0;
            if (candidate !== null) await page.route('**/hair/bob02/g050.glb', async route => {
                candidateLoads++;
                await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: fs.readFileSync(path.join(root, candidate)) });
            });
            await page.goto(`${server.baseUrl}/src/showcase.html?preset=${preset}&frame=portrait&scene=${scene}&light=${light}&capture=${hairColour === null ? '' : '&hairColour=' + encodeURIComponent(hairColour)}`, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
            assert.equal(await page.locator('#error').textContent(), '');
            assert.equal(candidateLoads, candidate === null ? 0 : 1, 'Capture must load exactly the requested candidate.');
            const setup = await page.evaluate(async ({ angle, hex, clockMode, lightingMode, hideCards, hideCaps, identityMode, attributionUrl }) => {
                const a = showcase.avatar, controls = showcase.controls;
                const nodeFrame = a.stage.renderer._nodes?.nodeFrame;
                const bootFrame = nodeFrame?.frameId;
                if (clockMode === 'owned') {
                    if (typeof a.stage.renderer._animation?.stop !== 'function' || typeof nodeFrame?.update !== 'function') throw new Error('Renderer capture clock unavailable');
                    a.stage.renderer._animation.stop();
                    nodeFrame.frameId = 0; nodeFrame.time = 0; nodeFrame.deltaTime = 0; nodeFrame.lastTime = undefined;
                    a.stage.temporal?.resetFrameEpoch();
                }
                window.colourDiagnosticTick = () => {
                    if (clockMode !== 'owned') return;
                    nodeFrame.update(); nodeFrame.time = 0; nodeFrame.deltaTime = 0;
                };
                window.colourDiagnosticClock = () => ({ frameId: nodeFrame?.frameId, time: nodeFrame?.time,
                    deltaTime: nodeFrame?.deltaTime, grainFrame: a.stage.grade?.grainFrame?.value ?? null,
                    temporal: a.stage.temporal?.frameEpoch() ?? null });
                controls.enableDamping = false;
                controls.update();
                const target = controls.target, radius = a.stage.camera.position.distanceTo(target);
                const theta = angle * Math.PI / 180;
                a.stage.camera.position.set(target.x + radius * Math.sin(theta), target.y, target.z + radius * Math.cos(theta));
                a.stage.camera.lookAt(target); controls.update();
                const lightingChanges = [];
                if (lightingMode === 'neutral-chromaticity') {
                    // Diagnostic: remove hue while preserving each colour's linear RGB luma.
                    // Positions, scalar intensities, dimensions, exposure and materials stay fixed.
                    // This is not a replacement light rig or a spectral illuminance calibration.
                    a.stage.scene.traverse(o => {
                        if (!o.isLight) return;
                        for (const key of ['color', 'groundColor']) {
                            const color = o[key]; if (!color?.isColor) continue;
                            const before = color.toArray();
                            const luma = .2126 * before[0] + .7152 * before[1] + .0722 * before[2];
                            color.setRGB(luma, luma, luma);
                            lightingChanges.push({ name: o.name, type: o.type, key, before, after: color.toArray(), luma, intensity: o.intensity });
                        }
                    });
                }
                const hidden = { cards: hideCards, caps: hideCaps, removedTriangles: 0 };
                if (hideCards.length || hideCaps) {
                    let mesh; a.hairRoot.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
                    const g = a.hairDynamics.groom, original = mesh.geometry.index.array, kept = [];
                    if (hideCards.some(c => c >= g.chainCount)) throw new Error('Hidden card outside groom');
                    const selected = new Set(hideCards);
                    for (let i = 0; i < original.length; i += 3) {
                        const card = Math.floor((original[i] - g.cardVertexBase) / (g.pointsPerChain * 2));
                        if (card < 0 ? hideCaps : selected.has(card)) hidden.removedTriangles++;
                        else kept.push(original[i], original[i + 1], original[i + 2]);
                    }
                    // Removal is an attribution diagnostic. Solver buffers/layout remain intact.
                    mesh.geometry.setIndex(kept);
                }
                // The requested configuration is held before intentional diagnostic overrides.
                // The export contract correctly rejects a later untracked uniform/node edit.
                const requestedConfiguration = showcase.configuration();
                const node = a.hairMaterial.hairUniforms.baseColour;
                const exactDefault = node.value.toArray();
                if (hex !== null) {
                    const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
                    node.value.fromArray(rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
                }
                const identity = identityMode === 'layers' ? (await import(attributionUrl)).installLayerColours(a) : null;
                window.colourDiagnosticState = async () => {
                    const digest = async array => {
                        if (!ArrayBuffer.isView(array)) throw new Error('Expected typed GPU readback');
                        if (!Array.from(array).every(Number.isFinite)) throw new Error('Nonfinite GPU readback');
                        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
                        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
                    };
                    const c = await a.hairDynamics.readCentrelines(), v = await a.hairDynamics.readVertices();
                    const bones = [];
                    a.figure.root.traverse(o => { if (o.isBone) bones.push([o.name, ...o.matrixWorld.elements]); });
                    const lights = [];
                    a.stage.scene.traverse(o => { if (o.isLight) lights.push({ name: o.name, type: o.type,
                        colour: o.color.toArray(), intensity: o.intensity, visible: o.visible,
                        matrix: o.matrixWorld.toArray(), groundColour: o.groundColor?.toArray() ?? null,
                        width: o.width ?? null, height: o.height ?? null }); });
                    const grade = {};
                    for (const [key, node] of Object.entries(a.stage.grade ?? {})) {
                        // This is a render counter, checked against the owned clock below.
                        if (key === 'grainFrame') continue;
                        if (typeof node === 'number' || typeof node === 'boolean') grade[key] = node;
                        else if (typeof node?.value === 'number') grade[key] = node.value;
                    }
                    const uniforms = {};
                    for (const [key, node] of Object.entries(a.hairMaterial.hairUniforms)) {
                        if (key === 'baseColour') continue;
                        const value = node?.value;
                        if (typeof value === 'number' || typeof value === 'boolean') uniforms[key] = value;
                        else if (value?.isVector2 || value?.isVector3 || value?.isVector4 || value?.isColor) uniforms[key] = value.toArray();
                    }
                    return { clock: a.clockSeconds, steps: c.steps,
                        positions: await digest(c.positions), velocities: await digest(c.velocities), vertices: await digest(v.positions),
                        bones, camera: a.stage.camera.position.toArray(), quaternion: a.stage.camera.quaternion.toArray(),
                        projection: a.stage.camera.projectionMatrix.toArray(), target: controls.target.toArray(),
                        configuration: requestedConfiguration, uniforms, settings: a.hairMaterial.hairSettings,
                        alphaTest: a.hairMaterial.alphaTest, opacity: a.hairMaterial.opacity,
                        canvas: [a.stage.canvas.width, a.stage.canvas.height], lights, grade,
                        rendering: { backend: a.stage.backendName, scale: a.stage.resolutionScale, msaa: a.stage.multisampled,
                            hairOIT: a.stage.hairOITMode, aa: a.stage.temporal?.mode ?? 'off',
                            toneMapping: a.stage.renderer.toneMapping, exposure: a.stage.renderer.toneMappingExposure,
                            rigExposure: a.lights.exposure } };
                };
                // Prepare zero-time state before taking the invariant snapshot.
                colourDiagnosticTick(); await showcase.step(0);
                const device = a.stage.renderer.backend.device;
                const adapter = a.stage.renderer.backend.adapter?.info ?? device?.adapterInfo;
                return { exactDefault, applied: node.value.toArray(), backend: a.stage.backendName, bootFrame, lightingChanges, hidden, identity,
                    adapter: adapter ? { vendor: adapter.vendor, architecture: adapter.architecture, device: adapter.device, description: adapter.description } : null,
                    stats: a.stage.stats, state: await colourDiagnosticState() };
            }, { angle: angles[view], hex: colour.hex, clockMode, lightingMode, hideCards, hideCaps, identityMode, attributionUrl: `/@fs/${root}tools/critic/hair-attribution-browser.mjs` });
            assert.equal(setup.backend, 'webgpu', 'Native WebGPU is required.');
            const before = setup.state;
            await page.evaluate(async count => { for (let i = 0; i < count; i++) { colourDiagnosticTick(); await showcase.step(0); } }, frames);
            if (exportGeometry && colour === colours[0]) {
                const geometry = await page.evaluate(async () => {
                    const a = showcase.avatar, d = a.hairDynamics, g = d.groom;
                    let mesh; a.hairRoot.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
                    const c = await d.readCentrelines(), v = await d.readVertices();
                    const head = mesh.matrixWorld.clone().fromArray(c.headMatrix);
                    const point = mesh.position.clone();
                    const world = values => {
                        const result = [];
                        for (let i = 0; i < values.length; i += 3) result.push(...point.fromArray(values, i).applyMatrix4(head).toArray());
                        return result;
                    };
                    const project = values => {
                        const result = [];
                        for (let i = 0; i < values.length; i += 3) {
                            point.fromArray(values, i).project(a.stage.camera);
                            result.push((point.x + 1) * a.stage.canvas.width / 2, (1 - point.y) * a.stage.canvas.height / 2, point.z);
                        }
                        return result;
                    };
                    const restCentres = world(g.restCentres);
                    const authored = mesh.geometry.getAttribute('position');
                    if (authored.itemSize !== 3 || authored.count !== g.vertexCount) throw new Error('Unexpected authored position layout');
                    const restVertices = world(Array.from(authored.array).slice(g.cardVertexBase * authored.itemSize));
                    return { chainCount: g.chainCount, pointsPerChain: g.pointsPerChain, vertexBase: g.cardVertexBase,
                        size: [a.stage.canvas.width, a.stage.canvas.height], headMatrix: c.headMatrix, steps: c.steps,
                        meshName: mesh.name, extras: mesh.geometry.userData, meshExtras: mesh.userData,
                        restCentres, liveCentres: Array.from(c.positions), restVertices, liveVertices: Array.from(v.positions),
                        restCentresScreen: project(restCentres), liveCentresScreen: project(c.positions),
                        restVerticesScreen: project(restVertices), liveVerticesScreen: project(v.positions),
                        uv: Array.from(mesh.geometry.getAttribute('uv').array),
                        uv1: Array.from(mesh.geometry.getAttribute('uv1').array),
                        indices: Array.from(mesh.geometry.index.array) };
                });
                const geometryFile = `${preset}-${view}-geometry.json`;
                fs.writeFileSync(path.join(out, geometryFile), JSON.stringify(geometry) + '\n');
                report.geometryFiles ??= []; report.geometryFiles.push({ view, filename: geometryFile, sha256: sha(fs.readFileSync(path.join(out, geometryFile))) }); save();
            }
            const capture = await page.evaluate(async () => {
                const a = showcase.avatar;
                const state = await colourDiagnosticState();
                colourDiagnosticTick(); a.stage.draw();
                const data = document.querySelector('#stage').toDataURL('image/png');
                return { state, data, clock: colourDiagnosticClock(), applied: a.hairMaterial.hairUniforms.baseColour.value.toArray() };
            });
            assert.deepEqual(capture.state, before, 'Zero-time render settling changed physical, camera or non-colour material state.');
            assert.deepEqual(capture.applied, setup.applied);
            if (clockMode === 'owned') {
                assert.equal(capture.clock.frameId, frames + 2);
                assert.equal(capture.clock.time, 0); assert.equal(capture.clock.deltaTime, 0);
                if (capture.clock.grainFrame !== null) assert.equal(capture.clock.grainFrame, frames + 2);
            }
            if (held === null) held = before;
            else assert.deepEqual(before, held, 'Colour arms must share exact physical, camera, configuration and non-colour material state.');
            const bytes = Buffer.from(capture.data.split(',')[1], 'base64');
            const filename = `${name}.png`;
            fs.writeFileSync(path.join(out, filename), bytes);
            const decoded = decodePng(bytes);
            assert.equal(decoded.width, before.canvas[0]); assert.equal(decoded.height, before.canvas[1]);
            let low = Infinity, high = -Infinity;
            for (let i = 0; i < decoded.pixels.length; i += 4) {
                const sum = decoded.pixels[i] + decoded.pixels[i + 1] + decoded.pixels[i + 2];
                low = Math.min(low, sum); high = Math.max(high, sum);
            }
            assert.ok(high - low > .6, 'Actual canvas must contain visible contrast.');
            const record = { name, view, candidateLoads, angle: angles[view], colour, filename, imageSha256: sha(bytes),
                size: [decoded.width, decoded.height], exactDefault: setup.exactDefault, applied: setup.applied,
                backend: setup.backend, adapter: setup.adapter, stats: setup.stats, bootFrame: setup.bootFrame, clock: capture.clock,
                lightingChanges: setup.lightingChanges, hidden: setup.hidden, identity: setup.identity,
                stateSha256: sha(JSON.stringify(before)), fixedState: before, errors };
            if (colour.id === 'exact-default') dark = decoded;
            if (colour.id === 'default-repeat') {
                let changedPixels = 0, maxDifference = 0;
                for (let i = 0; i < decoded.pixels.length; i += 4) {
                    let changed = false;
                    for (let k = 0; k < 4; k++) {
                        const d = Math.abs(decoded.pixels[i + k] - dark.pixels[i + k]);
                        changed ||= d !== 0; maxDifference = Math.max(maxDifference, d);
                    }
                    if (changed) changedPixels++;
                }
                record.darkRepeat = { changedPixels, maxDifference, exact: changedPixels === 0 };
            }
            report.cases.push(record); save();
            assert.deepEqual(errors, [], 'Browser errors must be investigated.');
            await page.evaluate(() => { showcase.controls.dispose(); showcase.avatar.dispose(); });
            await page.close(); page = null;
            console.log(`CAPTURED ${name} ${record.size.join('x')} ${record.imageSha256.slice(0, 12)}`);
        }
    }
    assert.deepEqual(sourceHashes(), report.sourceHashes, 'Source/asset bytes changed during capture.');
    report.status = 'captured'; report.finished = new Date().toISOString(); save();
    const items = report.cases.map(c => `<figure><img src="${c.filename}" alt="${c.name}"><figcaption>${c.view} · ${c.colour.label}</figcaption></figure>`).join('\n');
    fs.writeFileSync(path.join(out, 'review.html'), `<!doctype html><meta charset="utf-8"><title>Bob colour diagnostic</title><style>body{background:#20231f;color:#eee;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0}img{width:100%;height:auto}figcaption{padding:10px}p{max-width:75ch}</style><h1>Bob colour diagnostic</h1><p>Lighting: ${lightingMode}. Same source groom and fixed pose within each view; material base colour varies between selected colour arms. Any card removal is recorded in report.json and changes occlusion; it is an attribution diagnostic. These are diagnostic colours, not qualified replacement assets. See report.json for controls and repeat differences.</p><main>${items}</main>`);
    console.log(`DONE ${report.cases.length} captures; ${out}`);
} catch (error) {
    report.status = 'failed'; report.errors.push(error.stack); report.finished = new Date().toISOString(); save();
    await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
} finally {
    await page?.close().catch(() => {});
    await browser?.close(); await server?.close();
}
