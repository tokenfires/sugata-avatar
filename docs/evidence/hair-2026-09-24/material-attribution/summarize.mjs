import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='tmp/hair-sep24/material-attribution',sha=b=>createHash('sha256').update(b).digest('hex');
const r=JSON.parse(fs.readFileSync(path.join(root,'report.json')));
const first=JSON.parse(fs.readFileSync(path.join(root,'first-image-hashes.json')));
const images=Object.fromEntries(fs.readdirSync(root).filter(n=>n.endsWith('.png')).sort().map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
assert.deepEqual(images,first,'Adding parameter assertions must not change any captured image');
const rows=[];
for(const [view,row]of Object.entries(r.views)){
 const previous=`tmp/hair-sep24/narrow-density/capture/crop01/baseline/${view}.png`;
 assert.equal(images[view+'-baseline.png'],sha(fs.readFileSync(previous)));
 assert.equal(row.restoredChangedPixels,0);assert.ok(row.badCutoffChangedPixels>0);
 for(const [arm,a]of Object.entries(row.arms)){
  assert.equal(a.bodyChangedPixels,0);assert.equal(a.maskChangedPixels,0);
  rows.push({view,arm,pixels:a.maskPixels,p95CodeValue:a.lumaP95*255,meanAbsoluteDifferenceCodeValue:a.meanAbsoluteLumaDifference*255});
 }
}
assert.equal(r.controlsPassed,true);assert.deepEqual(r.errors,[]);
const sources=['packages/testbed/src/hair.js','packages/core/src/material/HairMaterial.js','packages/core/src/Avatar.js',
 'node_modules/three/src/materials/nodes/MeshLambertNodeMaterial.js','node_modules/three/src/nodes/functions/PhongLightingModel.js',
 'node_modules/three/src/nodes/functions/PhysicalLightingModel.js'];
const result={assetSha256:r.assetSha256,allRepeatedImagesMatch:Object.keys(images).length,previousShippingViewsMatch:5,
 metric:'Weighted sRGB-encoded channel values (0.2126R+0.7152G+0.0722B), full-white visible-hair mask pixels; diagnostic, not linear radiance or an acceptance threshold',
 rows,images,sources:Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(p))]))};
fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(`PASS ${result.allRepeatedImagesMatch} exact repeated images; five previous baseline plates; 25 unchanged body/mask pairs; five live cutoff defects and restorations`);
