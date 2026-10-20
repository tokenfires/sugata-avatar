'use strict';
// One ordinary foreground CPU preview of an original vector asset.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = __dirname;
const started = Date.now();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const sharpRoot = '/Users/robault/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp';
const timer = setTimeout(() => {
  console.error(JSON.stringify({status:'cooperative-timeout',pid:process.pid,elapsedMS:Date.now()-started}));
  process.exit(124);
},19000);
timer.unref();
(async () => {
  const admissionBytes = fs.readFileSync(path.join(base,'ADMISSION.json'));
  const admission = JSON.parse(admissionBytes);
  const age = Date.now()-Date.parse(admission.issuedUTC);
  if (admission.contract !== 'sage-shirt-first-preview-v1' || admission.allowance !== 1 ||
      !Number.isFinite(age) || age < 0 || age > 120000 || Date.now() >= Date.parse(admission.deadlineUTC)) {
    throw Error('missing or stale exact admission');
  }
  for (const pin of admission.pins) {
    const bytes = fs.readFileSync(pin.path);
    if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256) throw Error('changed admission input: '+pin.path);
  }
  const svg = fs.readFileSync(path.join(base,'shirt.svg'));
  if (svg.length > 40960 || sha(svg) !== 'af38e75fa68d19eb90a8edf50df6640f73631e205ec82df405b93db1eebfb701') throw Error('changed SVG');
  if (/(?:href|src)\s*=|<!DOCTYPE|<!ENTITY|<image|<script|<foreignObject|<filter|@import|url\s*\(/i.test(svg.toString('utf8'))) throw Error('active or external SVG');
  const manifest = fs.readFileSync(path.join(sharpRoot,'package.json'));
  if (sha(manifest) !== 'ad4a2535d72eb638053a38867b1abf43c328cd1c1dbae5cf4172d498365a8b97') throw Error('changed renderer manifest');
  const out = path.join(base,'shirt.png');
  if (fs.existsSync(out)) throw Error('sole output already exists');
  const used = fs.openSync(path.join(base,'ADMISSION.used'),'wx',0o644);
  try {
    fs.writeFileSync(used,JSON.stringify({pid:process.pid,at:new Date().toISOString(),admissionSHA256:sha(admissionBytes)})+'\n');
    fs.fsyncSync(used);
  } finally { fs.closeSync(used); }
  const sharp = require(sharpRoot);
  if (sharp.versions.sharp !== '0.35.5') throw Error('unexpected renderer version');
  sharp.cache(false);
  sharp.concurrency(1);
  const warnings=[];
  const png = await sharp(svg,{density:72,limitInputPixels:2160000,unlimited:false,failOn:'warning'})
    .on('warning',message => warnings.push(String(message)))
    .png().toBuffer();
  if (warnings.length) throw Error('renderer warning: '+warnings.join(';').slice(0,1000));
  if (png.length < 33 || png.length > 3145728 || !png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('invalid PNG type/size');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  if (width !== 1800 || height !== 1200) throw Error('unexpected output dimensions');
  if (process.resourceUsage().maxRSS > 1048576 || Date.now()-started >= 20000) throw Error('observed resource budget exceeded');
  const output = fs.openSync(out,'wx',0o644);
  try { fs.writeFileSync(output,png); fs.fsyncSync(output); }
  finally { fs.closeSync(output); }
  console.log(JSON.stringify({status:'complete',pid:process.pid,node:process.version,versions:sharp.versions,
    svgBytes:svg.length,svgSHA256:sha(svg),pngBytes:png.length,pngSHA256:sha(png),width,height,
    maxRSSKiB:process.resourceUsage().maxRSS,elapsedMS:Date.now()-started,warnings}));
})().catch(error => {
  console.error(JSON.stringify({status:'failed',pid:process.pid,error:String(error).slice(0,2000),elapsedMS:Date.now()-started}));
  process.exitCode=1;
}).finally(() => clearTimeout(timer));
