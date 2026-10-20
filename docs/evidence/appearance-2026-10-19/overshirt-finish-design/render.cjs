'use strict';
// One foreground CPU artist preview. No children, network or product imports.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const started = Date.now();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const base = __dirname;
const expectedSVG = 'aadbec90ae8a238cf48a08fbaaf65e535740132ae65a1b088656ea8fb6ca78a2';
const sharpRoot = '/Users/robault/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp';
const timer = setTimeout(() => {
  console.error(JSON.stringify({status:'cooperative-timeout',pid:process.pid,elapsedMS:Date.now()-started}));
  process.exit(124);
},19000);
timer.unref();
(async () => {
  const admission = JSON.parse(fs.readFileSync(path.join(base,'ADMISSION.json'),'utf8'));
  if (admission.contract !== 'overshirt-finish-sole-preview-v1' || admission.allowance !== 1) throw Error('no exact admission');
  const age = Date.now()-Date.parse(admission.issuedUTC);
  if (!Number.isFinite(age) || age < 0 || age > 120000 || Date.now() >= Date.parse(admission.deadlineUTC)) throw Error('stale admission');
  for (const pin of admission.pins) {
    const b = fs.readFileSync(pin.path);
    if (b.length !== pin.bytes || sha(b) !== pin.sha256) throw Error('changed admission input: '+pin.path);
  }
  const svg = fs.readFileSync(path.join(base,'finish.svg'));
  if (svg.length > 65536 || sha(svg) !== expectedSVG) throw Error('changed or oversized SVG');
  if (/(?:href|src)\s*=|<!DOCTYPE|<!ENTITY|<image|<script|<foreignObject|@import|url\s*\(/i.test(svg.toString('utf8'))) throw Error('external or active SVG source');
  const manifest = fs.readFileSync(path.join(sharpRoot,'package.json'));
  if (sha(manifest) !== 'ad4a2535d72eb638053a38867b1abf43c328cd1c1dbae5cf4172d498365a8b97') throw Error('changed renderer manifest');
  const out = path.join(base,'finish.png');
  if (fs.existsSync(out)) throw Error('sole output already exists');
  const sharp = require(sharpRoot);
  if (sharp.versions.sharp !== '0.35.5') throw Error('renderer version mismatch');
  sharp.cache(false);
  sharp.concurrency(1);
  const warnings = [];
  const png = await sharp(svg,{density:72,limitInputPixels:1760000,unlimited:false,failOn:'warning'})
    .on('warning',m => warnings.push(String(m)))
    .png().toBuffer();
  if (warnings.length) throw Error('renderer warning: '+warnings.join(';').slice(0,1000));
  if (png.length > 2097152 || png.length < 33 || !png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('invalid output type/size');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  if (width !== 1600 || height !== 1100) throw Error('output dimensions mismatch');
  if (process.resourceUsage().maxRSS > 1048576 || Date.now()-started >= 20000) throw Error('observed resource budget exceeded');
  fs.writeFileSync(out,png,{flag:'wx',mode:0o644});
  console.log(JSON.stringify({status:'complete',pid:process.pid,node:process.version,versions:sharp.versions,
    svgBytes:svg.length,svgSHA256:sha(svg),pngBytes:png.length,pngSHA256:sha(png),width,height,
    maxRSSKiB:process.resourceUsage().maxRSS,elapsedMS:Date.now()-started,warnings}));
})().catch(error => {
  console.error(JSON.stringify({status:'failed',pid:process.pid,error:String(error).slice(0,2000),elapsedMS:Date.now()-started}));
  process.exitCode=1;
}).finally(() => clearTimeout(timer));
