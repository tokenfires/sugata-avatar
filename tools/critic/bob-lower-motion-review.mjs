// Present exact captured PNGs, with a separately encoded convenience video.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const protocol=process.argv.find(x=>x.startsWith('--protocol='))?.slice(11);
assert.ok(['head','ordinary'].includes(protocol));
const root=`captures/lower-${protocol}-v1`,view=protocol==='head'?'right-profile':'left-profile';
const reports=['baseline','candidate'].map(arm=>JSON.parse(fs.readFileSync(`${root}/${arm}-${view}-brown/report.json`)));
const pair=JSON.parse(fs.readFileSync(`${root}/paired-controls.json`));
for(const [i,r] of reports.entries()){
  assert.equal(r.status,'captured');assert.deepEqual(r.errors,[]);
  assert.equal(r.images.length,protocol==='head'?186:241);
  assert.equal(createHash('sha256').update(fs.readFileSync(`${root}/${i?'candidate':'baseline'}-${view}-brown/report.json`)).digest('hex'),pair.reports[i].sha256);
}
assert.ok(pair.sourceHashesEqual);assert.ok(Object.values(pair.setupEquality).every(Boolean));
for(const [k,v] of Object.entries(pair.mismatchCounts))if(k!=='otherVerticesHashEqual')assert.equal(v,0,k);
let html=fs.readFileSync(`captures/side-${protocol}-v1/review.html`,'utf8');
html=html.replace(/<title>.*?<\/title>/,'<title>Inward bob ends — '+(protocol==='head'?'turns and tilts':'ordinary movement')+'</title>')
  .replace(/<h1>.*?<\/h1>/,'<h1>Inward ends, '+(protocol==='head'?'through turns and tilts.':'during ordinary movement.')+'</h1>')
  .replaceAll('Frozen posterior control','Frozen side control').replaceAll('Frozen side candidate v3','Frozen inward-end candidate v1')
  .replaceAll('/side-envelope/README.md','/lower-curve/README.md');
const start=html.indexOf(protocol==='head'?'<p>Matched ':'<p>A matched '),end=html.indexOf('</p>',start);
assert.ok(start>=0&&end>start);
const text=protocol==='head'?'Matched head-only sequence: turns of ±30°, downward tilt of 20°, upward tilt of 15°, and rolls of ±15°. Other motion layers are disabled.':'Matched twelve-second ordinary movement, with the same seed and 17 enabled layers.';
const delta=pair.colliderDifference.maximumSkullRadiusDeltaMm;
const other=pair.otherVertices.maximumDelta.millimetres;
html=html.slice(0,start)+`<p>${text} Recorded body, camera, light, material and clock controls match. Fitted skull radius differs by ${delta.toFixed(6)} mm; the largest measured other-card vertex difference is ${other.toFixed(6)} mm. These numerical comparisons do not establish individual visual visibility.</p>`+html.slice(end+4);
assert.ok(!fs.existsSync(`${root}/review.html`));fs.writeFileSync(`${root}/review.html`,html);
fs.copyFileSync('tools/critic/bob-lower-motion-review.mjs',`${root}/bob-lower-motion-review.mjs`,fs.constants.COPYFILE_EXCL);
console.log(`${root}/review.html`);
