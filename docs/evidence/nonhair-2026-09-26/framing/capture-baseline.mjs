import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = process.cwd();
const { startProbeServer, launchProbeBrowser } = await import(pathToFileURL(path.join(root, 'packages/core/src/render/MotionProbe.mjs')));
const out = path.join(root, 'docs/evidence/nonhair-2026-09-26/framing/baseline'); fs.mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['packages/testbed/src/showcase.js', 'packages/testbed/src/showcase.html', 'packages/testbed/src/portrait.js', 'packages/testbed/src/portrait.html', 'packages/core/src/Avatar.js', 'packages/core/src/render/Stage.js'];
const report = { date: new Date().toISOString(), sourceHashes: Object.fromEntries(sources.map(name => [name, sha(fs.readFileSync(path.join(root, name)))])), views: [], errors: [] };
let server, browser;
try {
    server = await startProbeServer({ port: 5297 }); browser = await launchProbeBrowser();
    for (const device of ['desktop', 'mobile']) for (const kind of ['portrait', 'showcase-portrait', 'showcase-body']) {
        const page = await browser.newPage({ viewport: device === 'desktop' ? { width: 1440, height: 1000 } : { width: 390, height: 844 }, deviceScaleFactor: 1 });
        page.on('pageerror', error => report.errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
        const url = kind === 'portrait' ? '/src/portrait.html?hair=bob02&capture=' : '/src/showcase.html?preset=casual&frame=' + (kind.endsWith('body') ? 'body' : 'portrait') + '&capture=';
        await page.goto(server.baseUrl + url);
        await page.waitForFunction(() => window.portrait || window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
        const measured = await page.evaluate(async () => {
            const viewer = window.portrait ?? window.showcase;
            if (!viewer) throw new Error(document.querySelector('#error').textContent);
            for (let i = 0; i < 12; i++) { await new Promise(requestAnimationFrame); await viewer.step(0); }
            const { avatar, controls } = viewer, camera = avatar.stage.camera, body = avatar.figure.body;
            const indices = body.geometry.getAttribute('skinIndex'), weights = body.geometry.getAttribute('skinWeight');
            const headIndex = body.skeleton.bones.indexOf(avatar.figure.humanoidBones.head);
            const point = camera.position.clone(), limits = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], count: 0 });
            const head = limits(), bodyBounds = limits(), headWorld = limits();
            const include = (bounds, value) => { const values = value.toArray(); bounds.count++; for (let j = 0; j < 3; j++) { bounds.min[j] = Math.min(bounds.min[j], values[j]); bounds.max[j] = Math.max(bounds.max[j], values[j]); } };
            for (let i = 0; i < body.geometry.attributes.position.count; i++) {
                body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld);
                let headWeight = 0; for (let j = 0; j < 4; j++) if (indices.getComponent(i, j) === headIndex) headWeight += weights.getComponent(i, j);
                if (headWeight >= .5) include(headWorld, point);
                point.project(camera); include(bodyBounds, point); if (headWeight >= .5) include(head, point);
            }
            const canvas = document.querySelector('#stage');
            return { url: location.href, position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov, aspect: camera.aspect,
                distance: camera.position.distanceTo(controls.target), canvas: [canvas.clientWidth, canvas.clientHeight], backing: [canvas.width, canvas.height], head, body: bodyBounds, headWorld,
                orbit: { min: controls.minDistance, max: controls.maxDistance, damping: controls.enableDamping }, configuration: avatar.report().framing };
        });
        const file = `${kind}-${device}.png`; await page.screenshot({ path: path.join(out, file), fullPage: true });
        report.views.push({ kind, device, file, sha256: sha(fs.readFileSync(path.join(out, file))), ...measured });
        console.log(kind, device, 'head x', measured.head.min[0].toFixed(3), measured.head.max[0].toFixed(3), 'body x', measured.body.min[0].toFixed(3), measured.body.max[0].toFixed(3));
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await page.close();
    }
} finally { await browser?.close(); await server?.close(); }
