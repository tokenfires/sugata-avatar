// Present captured frames unchanged; the encoded video is a convenience preview.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = 'captures/envelope-motion-v1';
const reports = ['baseline', 'candidate'].map(arm => JSON.parse(fs.readFileSync(`${root}/${arm}-rear-left-brown/report.json`)));
for (const report of reports) { assert.equal(report.status, 'captured'); assert.equal(report.images.length, 241); }
const images = reports.map((report, i) => report.images.map(image => ({ frame: image.frame, src: `${i ? 'candidate' : 'baseline'}-rear-left-brown/${image.file}` })));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Posterior bob — ordinary movement</title><link rel="icon" href="data:,">
<style>body{font:16px/1.6 system-ui;background:#101310;color:#e9ede2;max-width:1500px;margin:24px auto;padding:0 20px}h1{font:40px/1.15 Georgia}p{max-width:90ch}a{color:#d7e6bb}video{width:100%;display:block;background:#000}.labels,main{display:grid;grid-template-columns:1fr 1fr;gap:16px}.labels{margin:12px 0;font-weight:600}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:20px 0}input{flex:1;min-width:180px}button{font:inherit;padding:8px 14px}figure{margin:0}img{width:100%;display:block}figcaption{background:#20271e;padding:10px}.status{color:#edcaa0}@media(max-width:650px){main{grid-template-columns:1fr}.labels{font-size:13px}h1{font-size:30px}}</style>
<a href="../../docs/evidence/hair-2026-09-29/review.html">← Overnight review</a><h1>A cleaner rear field, during ordinary motion.</h1>
<p class="status">Experimental candidate. Body-contact audits are recorded separately; this page does not declare a clearance or appearance pass.</p>
<p>Same seed, ordinary motion layers, body poses, camera, light, material and clock. The new groom increases the fitted skull sphere radius by approximately 1.025 mm. Other-card hashes differ; this capture does not retain their coordinates to measure that difference.</p>
<div class="labels"><span>Accepted source</span><span>Frozen posterior candidate v3</span></div>
<video id="video" controls preload="metadata" playsinline src="paired-preview-v2.mp4" aria-label="Paired 12-second ordinary motion preview"></video>
<p>The video encodes the original sequence at 20 fps for convenient playback. It is a compressed preview. Use the unchanged PNGs below for exact frame inspection; body geometry was recorded at every 60 Hz update.</p>
<div class="controls"><button id="previous" aria-label="Previous captured frame">Previous</button><label for="frame">Frame</label><input id="frame" type="range" min="0" max="240" value="0"><button id="next" aria-label="Next captured frame">Next</button><output id="time" aria-live="polite"></output></div>
<main>${['Accepted source', 'Frozen candidate'].map((label, i) => `<figure><img id="image${i}" alt="${label}, original captured PNG"><figcaption>${label}</figcaption></figure>`).join('')}</main>
<p>One body, outfit, seed, view and 12-second interval. This does not qualify other cuts, bodies, garments, wind, head extremes or all motion. Each geometric contact needs interpretation against the actual rendered image; alpha and occlusion are absent from the numerical oracle.</p>
<p><a href="paired-controls.json">Recorded control comparison</a> · <a href="../../docs/evidence/hair-2026-09-29/posterior-envelope/README.md">Static construction and independent critique</a></p>
<script>const images=${JSON.stringify(images)},range=document.querySelector('#frame'),time=document.querySelector('#time');function draw(){const i=Number(range.value),frame=images[0][i].frame;time.value=frame+' / 720 · '+(frame/60).toFixed(2)+'s';for(let n=0;n<2;n++)document.querySelector('#image'+n).src=images[n][i].src;}range.addEventListener('input',draw);document.querySelector('#previous').onclick=()=>{range.value=Math.max(0,Number(range.value)-1);draw();};document.querySelector('#next').onclick=()=>{range.value=Math.min(240,Number(range.value)+1);draw();};draw();</script></html>`;
fs.writeFileSync(`${root}/review.html`, html);
console.log(`${root}/review.html`);
