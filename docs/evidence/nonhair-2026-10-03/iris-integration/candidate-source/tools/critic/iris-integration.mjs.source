/** One native qualification of creation-only Original/Blue; no capture epoch or hue search. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ROOT, collectSourceHashes, hashFile } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';
import { optionsForShowcase, resolveShowcaseSelection } from '../../packages/testbed/src/showcase-presets.mjs';
const packet = 'docs/evidence/nonhair-2026-10-03/iris-integration';
const raw = ROOT + '/captures/iris-integration-2026-10-03-v1';
const stop = Date.parse('2026-10-03T20:29:00Z'), observationStop = stop - 180000;
assert.ok(Date.now() < Date.parse('2026-10-03T20:18:00Z'), 'native launch cutoff');
assert.ok(!fs.existsSync(raw), 'sole new packet'); fs.mkdirSync(raw, {recursive: true});
const inputs = Object.fromEntries(['PLAN.md', 'OWNERSHIP-CONTRACT.md', 'BEFORE.json', 'EDIT-RECIPE.json',
    'CRITIC-VALUE.md', 'CRITIC-CONTRACT.md', 'CONTRACT-ADDENDUM.md', 'SOURCE-CORRECTIONS.json', 'CPU-JOBS.json', 'ROOT-SOURCE.json', 'CRITIC-PREFLIGHT.md'].map(n => [packet + '/' + n, hashFile(ROOT + '/' + packet + '/' + n)]));
const report = {pid: process.pid, started: new Date().toISOString(), command: 'node tools/critic/iris-integration.mjs',
    sources: collectSourceHashes(ROOT), inputs, instrumentSHA256: hashFile(new URL(import.meta.url)),
    status: 'running', states: [], images: [], retirements: [], errors: [], warnings: [], failedResources: [],
    limits: ['Actual optional Blue/customization on current g050, Original source path preserved; no pixel-exact temporal identity.',
        'One finite 1.2-second neutral attention hold and .5-second manual release; no pupil extremes, continuous-motion, identity-range or AAA qualification.',
        'Nominal public step/draw and frame synchronization only; no renderer clock/history/phase search or perceptual/physical calibration.']};
const save = () => fs.writeFileSync(raw + '/report.json', JSON.stringify(report, null, 2) + '\n');
fs.copyFileSync(new URL(import.meta.url), raw + '/instrument.mjs'); save();
let browser, page, failed;
async function bounded(fn, name, cleanup = false) {
    let timer; try { return await Promise.race([fn(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(name + ' timed out')), cleanup ? 10000 : Math.max(1, observationStop - Date.now()));
    })]); } finally { clearTimeout(timer); }
}
const blueVector = [0.46375534541012664, 1.0886445839519705, 1.7009280765008];
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden);
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => { await showcase.step(0); await new Promise(requestAnimationFrame); });
    await page.evaluate(() => {
        const a = showcase.avatar, e = a.eyes, rawGlobe = e.originalGlobeMaterial, rawCornea = e.originalCorneaMaterial;
        const source = Array.isArray(rawGlobe) ? rawGlobe[0] : rawGlobe;
        const map = source.map, occlusion = a.eyeOcclusion;
        window.irisOwner = {a, e, map, occlusion, pupil: a.layers.pupil, gaze: a.layers.gaze,
            uniforms: Object.fromEntries(['pupilScaleUniform', 'scleraBrightnessUniform', 'scleraChromaUniform', 'limbalRingUniform', 'catchlightIntensityUniform', 'causticScaleUniform', 'keyLightDirectionUniform'].map(k => [k, e[k]])),
            cornea: e.corneaMaterial, catchlight: e.catchlight, mapDisposed: 0, events: []};
        map.addEventListener('dispose', () => irisOwner.mapDisposed++);
        for (const [name, resource] of [['globe', e.globeMaterial], ['cornea', e.corneaMaterial], ['catchlight', e.catchlight.texture]])
            resource.addEventListener('dispose', () => irisOwner.events.push({name, uuid: resource.uuid, at: new Date().toISOString()}));
        const eyeDispose = e.dispose.bind(e);
        e.dispose = () => { const before = irisOwner.mapDisposed; eyeDispose();
            irisOwner.eyeRetirement = {borrowedMapDisposals: irisOwner.mapDisposed - before,
                restoredGlobe: e.globeMesh.material === rawGlobe, restoredCornea: e.corneaMesh.material === rawCornea}; };
        const dispose = a.dispose.bind(a);
        a.dispose = () => {
            if (a.disposed) return dispose();
            const requested = a.eyeColour, resources = {globe: e.globeMaterial.uuid, cornea: e.corneaMaterial.uuid, catchlight: e.catchlight.texture.uuid};
            const started = new Date().toISOString(); dispose();
            const rows = JSON.parse(sessionStorage.getItem('iris-integration-retired') ?? '[]');
            rows.push({url: location.href, requested, started, finished: new Date().toISOString(), resources,
                eye: irisOwner.eyeRetirement, events: irisOwner.events, disposal: a.report().disposal});
            sessionStorage.setItem('iris-integration-retired', JSON.stringify(rows));
        };
    });
}
async function state(label) {
    const s = await page.evaluate(() => {
        const a = showcase.avatar, e = a.eyes, o = irisOwner;
        const v = x => x?.toArray ? x.toArray() : x?.elements ? Array.from(x.elements) : x;
        return {configuration: showcase.configuration(), eyes: a.report().eyes, backend: a.stage.backendName,
            eyeOwnerSame: e === o.e, mapSame: (Array.isArray(e.originalGlobeMaterial) ? e.originalGlobeMaterial[0] : e.originalGlobeMaterial).map === o.map,
            mapDisposals: o.mapDisposed, corneaSame: e.corneaMaterial === o.cornea && e.corneaMesh.material === o.cornea,
            occlusionSame: a.eyeOcclusion === o.occlusion, pupilOwnerSame: a.layers.pupil === o.pupil, gazeOwnerSame: a.layers.gaze === o.gaze,
            uniformsSame: Object.entries(o.uniforms).every(([k, value]) => e[k] === value),
            uniforms: Object.fromEntries(Object.entries(o.uniforms).map(([k, value]) => [k, v(value.value)])),
            optics: {ior: e.corneaIor, roughness: e.corneaRoughness, specular: e.corneaSceneSpecular, refraction: e.refractionEnabled},
            eyeMeshes: {globe: e.globeMesh.uuid, cornea: e.corneaMesh.uuid, activeGlobe: e.globeMesh.material.uuid, ownedGlobe: e.globeMaterial.uuid},
            occlusion: a.eyeOcclusion.meshes.map(m => ({uuid: m.uuid, parent: m.parent?.uuid ?? null})),
            frames: Object.fromEntries(['left','right'].map(side => [side, {eyeToWorld: v(e.frames[side].eyeToWorld.value), worldToEye: v(e.frames[side].worldToEye.value)}])),
            gazeMorphs: Object.fromEntries(Object.entries(e.globeMesh.morphTargetDictionary).map(([name, i]) => [name, e.globeMesh.morphTargetInfluences[i]])),
            pupilScale: a.pupilScale, attention: showcase.attention.report(),
            control: {draft: document.querySelector('#eye-shade').value, applied: document.querySelector('#eye-colour-status').textContent,
                disabled: document.querySelector('#eye-colour-controls').disabled},
            camera: {aspect: a.stage.camera.aspect, position: a.stage.camera.position.toArray(), quaternion: a.stage.camera.quaternion.toArray(), fov: a.stage.camera.fov},
            url: location.href};
    });
    assert.equal(s.backend, 'webgpu');
    for (const k of ['eyeOwnerSame','mapSame','corneaSame','occlusionSame','pupilOwnerSame','gazeOwnerSame','uniformsSame']) assert.equal(s[k], true, k);
    assert.equal(s.eyes.ownerAvailable, true); assert.equal(s.mapDisposals, 0); assert.equal(s.eyes.attached, true); assert.equal(s.eyes.matchesAttached, true); assert.equal(s.eyes.matchesRequest, true);
    assert.equal(s.eyes.requested, s.eyes.applied); assert.deepEqual(s.eyes.chromaticity, s.eyes.applied === 'blue' ? blueVector : null);
    assert.equal(s.configuration.eyeColour ?? null, s.eyes.applied); assert.equal(s.uniforms.pupilScaleUniform, s.pupilScale);
    assert.equal(s.eyeMeshes.activeGlobe, s.eyeMeshes.ownedGlobe); assert.equal(s.control.disabled, false);
    report.states.push({label, at: new Date().toISOString(), ...s}); save(); return s;
}
async function image(name, locator) {
    await page.evaluate(async () => { await showcase.step(0); await new Promise(requestAnimationFrame); });
    await page.waitForFunction(() => Math.abs(showcase.avatar.stage.camera.aspect - document.querySelector('#stage').clientWidth / document.querySelector('#stage').clientHeight) < .002);
    const before = await state(name + ':before'); const file = name + '.png';
    await (locator ? page.locator(locator) : page).screenshot({path: raw + '/' + file, ...(locator ? {} : {fullPage: true})});
    const after = await state(name + ':after'); assert.deepEqual(after.configuration, before.configuration);
    assert.deepEqual(after.eyes, before.eyes); assert.deepEqual(after.camera, before.camera);
    report.images.push({file, at: new Date().toISOString(), sha256: hashFile(raw + '/' + file), before: report.states.length - 2, after: report.states.length - 1}); save();
}
async function camera(view) {
    await page.evaluate(view => {
        const a = showcase.avatar, c = showcase.controls; c.enabled = false; c.enableDamping = false;
        a.stage.camera.fov = 26; c.target.set(0, 1.55, .033);
        a.stage.camera.position.set(...(view === 'front' ? [0,1.55,.88] : [.4235,1.55,.7665]));
        a.stage.camera.lookAt(c.target); a.stage.camera.updateProjectionMatrix(); c.update();
    }, view);
}
async function apply(value) {
    await page.locator('#eye-colours').evaluate(e => { e.open = true; }); await page.locator('#eye-shade').selectOption(value);
    await Promise.all([page.waitForNavigation({waitUntil: 'domcontentloaded'}), page.locator('#apply-eye-colour').click()]); await ready();
}
function checkRetirements(rows) {
    assert.equal(rows.length, 6); assert.deepEqual(rows.map(r => r.requested), [null,'blue',null,'blue',null,'blue']);
    for (const r of rows) { assert.equal(r.eye.borrowedMapDisposals, 0); assert.equal(r.eye.restoredGlobe, true); assert.equal(r.eye.restoredCornea, true);
        assert.deepEqual(r.events.map(({name,uuid}) => ({name,uuid})), Object.entries(r.resources).map(([name,uuid]) => ({name,uuid})));
        assert.equal(r.disposal.disposed, true); assert.deepEqual(r.disposal.leaked, []); }
}
try { await bounded(async () => {
    browser = await launchProbeBrowser(); page = await browser.newPage({viewport: {width:1440,height:1000}, deviceScaleFactor:1, reducedMotion:'reduce'}); page.setDefaultTimeout(45000);
    page.on('pageerror', e => report.errors.push(e.stack ?? e.message)); page.on('console', m => { if(m.type()==='error') report.errors.push(m.text()); if(m.type()==='warning') report.warnings.push(m.text()); });
    page.on('response', r => { if(r.status()>=400) report.failedResources.push({url:r.url(),status:r.status()}); });
    page.on('requestfailed', r => report.failedResources.push({url:r.url(),failure:r.failure()}));
    const initialUrl = 'http://127.0.0.1:5173/src/showcase.html?preset=casual&style=ecru&frame=portrait&hairColour=%23765344&topColor=%23abb099&capture=#eye-colours';
    const requestedConfiguration = optionsForShowcase(resolveShowcaseSelection(new URL(initialUrl).searchParams));
    report.requestedConfiguration = requestedConfiguration;
    await page.goto(initialUrl, {waitUntil:'domcontentloaded'}); await ready();
    const original = await state('original-initial'); assert.deepEqual(original.configuration, requestedConfiguration); assert.equal(original.eyes.applied, null); assert.equal(original.control.draft,'original');
    await camera('front'); await image('original-front','#stage'); await camera('oblique'); await image('original-oblique','#stage');
    await page.locator('#eye-shade').selectOption('blue'); const draft = await state('blue-draft'); assert.deepEqual(draft.configuration,original.configuration); assert.equal(draft.control.applied,'Applied: Original');
    await apply('blue'); const blue = await state('blue-applied'); assert.deepEqual(blue.configuration,{...original.configuration,eyeColour:'blue'}); assert.equal(blue.control.draft,'blue'); assert.equal(blue.control.applied,'Applied: Blue');
    assert.deepEqual(blue.optics,original.optics); const {pupilScaleUniform:ignored1,keyLightDirectionUniform:ignored2,...blueFixed}=blue.uniforms;
    const {pupilScaleUniform:ignored3,keyLightDirectionUniform:ignored4,...originalFixed}=original.uniforms; assert.deepEqual(blueFixed,originalFixed);
    await camera('front'); await image('blue-front','#stage'); await camera('oblique'); await image('blue-oblique','#stage');
    const downloadEvent=page.waitForEvent('download'); await page.locator('#save').click(); const download=await downloadEvent; await download.saveAs(raw+'/blue-settings.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(raw+'/blue-settings.json')),blue.configuration); report.downloadSHA256=hashFile(raw+'/blue-settings.json');
    await page.locator('#saved-looks').evaluate(e=>{e.open=true;}); await page.locator('#saved-look-name').fill('Blue eyes study'); await page.locator('#save-local-look').click();
    report.local=await page.evaluate(()=>JSON.parse(localStorage.getItem('sugata:showcase:saved-looks:v1'))); assert.deepEqual(report.local.looks[0].configuration,blue.configuration);
    assert.match(await page.locator('#saved-look-list').textContent(),/Blue eyes/); await image('desktop-blue-controls');
    await page.setViewportSize({width:390,height:844}); await page.locator('#eye-colours').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); await image('mobile-blue-controls');
    await apply('original'); const restored=await state('original-restored'); assert.deepEqual(restored.configuration,original.configuration); assert.equal(restored.control.draft,'original'); assert.equal(restored.control.applied,'Applied: Original');
    const fileChooser=page.waitForEvent('filechooser'); await page.locator('#open-settings').click(); await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), (async () => (await fileChooser).setFiles(raw+'/blue-settings.json'))()]); await ready();
    assert.deepEqual((await state('JSON-reopened-blue')).configuration,blue.configuration);
    await apply('original'); await page.locator('#saved-looks').evaluate(e=>{e.open=true;});
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('[data-open-look]').click()]); await ready();
    assert.deepEqual((await state('local-reopened-blue')).configuration,blue.configuration);
    await page.setViewportSize({width:1440,height:1000}); await camera('oblique');
    await page.locator('#pause').click(); assert.equal(await page.locator('#look-toward-me').isEnabled(),true);
    const start=await state('attention-before'); await page.locator('#look-toward-me').click();
    for(let i=0;i<72;i++) await page.evaluate(()=>showcase.step(1/60)); const held=await state('attention-held');
    assert.equal(held.attention.phase,'attending'); assert.equal(held.attention.holdsGaze,true); assert.deepEqual(held.configuration,blue.configuration);
    assert.notDeepEqual(held.frames,start.frames); assert.notDeepEqual(held.gazeMorphs,start.gazeMorphs); await image('blue-attention-held','#stage');
    await page.locator('#release-attention').click(); const release=await state('manual-release-start'); assert.equal(release.attention.phase,'releasing');
    for(let i=0;i<30;i++) await page.evaluate(()=>showcase.step(1/60)); const released=await state('attention-released');
    assert.equal(released.attention.phase,'idle'); assert.equal(released.attention.holdsGaze,false); assert.deepEqual(released.configuration,blue.configuration); await image('blue-attention-released','#stage');
    report.sequence={holdSteps:72,releaseSteps:30,dt:1/60,pupilScales:[start.pupilScale,held.pupilScale,released.pupilScale]};
    assert.deepEqual(report.errors,[]); assert.deepEqual(report.failedResources,[]); report.status='observed';
},'whole native packet'); } catch(e) {failed=e; report.errors.push(e.stack??String(e)); report.status='failed'; save();}
finally {
    report.cleanup={};
    try { if(page && !page.isClosed()) report.retirements=await bounded(()=>page.evaluate(()=>{showcase?.attention?.dispose(); showcase?.controls?.dispose(); showcase?.avatar?.dispose(); return JSON.parse(sessionStorage.getItem('iris-integration-retired')??'[]');}), 'owned Avatar retirement',true); }
    catch(e){failed??=e;report.errors.push(e.stack??String(e));}
    for(const [name,obj] of [['page',page],['browser',browser]]) try {if(obj) await bounded(()=>obj.close(),name+' close',true);report.cleanup[name]=obj?'closed':'not-created';} catch(e){failed??=e;report.cleanup[name]='failed';report.errors.push(e.stack??String(e));}
    try {assert.deepEqual(collectSourceHashes(ROOT),report.sources);for(const [p,h]of Object.entries(inputs)) assert.equal(hashFile(ROOT+'/'+p),h);assert.equal(hashFile(new URL(import.meta.url)),report.instrumentSHA256);
        checkRetirements(report.retirements);assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedResources,[]);assert.ok(Date.now()<stop);report.finalPinsUnchanged=true;
    }catch(e){failed??=e;report.errors.push(e.stack??String(e));}
    report.finished=new Date().toISOString();report.status=failed?'failed':'passed';save();
}
console.log(JSON.stringify({pid:process.pid,status:report.status,images:report.images.length,errors:report.errors.length,out:raw}));if(failed)process.exitCode=1;
