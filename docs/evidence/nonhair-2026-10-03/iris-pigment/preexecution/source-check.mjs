/** CPU source/copy/colour-contract check; no EyeMaterial constructor or renderer. */
import fs from 'node:fs'; import crypto from 'node:crypto'; import assert from 'node:assert/strict';
import { Color, ColorManagement } from 'three/webgpu';
const started=new Date().toISOString(),p='docs/evidence/nonhair-2026-10-03/iris-pigment',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const recipe=JSON.parse(fs.readFileSync(p+'/COPY-RECIPE.json')),original=fs.readFileSync(recipe.original),copy=fs.readFileSync(p+'/PreviewEyeMaterial.mjs');
assert.equal(sha(original),recipe.originalSHA256);assert.equal(sha(copy),recipe.copySHA256);let reversed=copy.toString();
for(const x of recipe.changes.toReversed()){assert.equal(reversed.split(x.to).length-1,1);reversed=reversed.replace(x.to,x.from);}assert.equal(reversed,original.toString());
assert.equal(recipe.changes.length,4);assert.equal(ColorManagement.enabled,true);
const c=JSON.parse(fs.readFileSync(p+'/candidate.json'));assert.equal(c.blue,'#527b97');assert.deepEqual(c.lumaWeights,[.2126,.7152,.0722]);
const linear=new Color(c.blue).toArray(),luma=linear.reduce((s,x,i)=>s+x*c.lumaWeights[i],0),chromaticity=linear.map(x=>x/luma);assert.ok(luma>0&&chromaticity.every(Number.isFinite));assert.ok(Math.abs(chromaticity.reduce((s,x,i)=>s+x*c.lumaWeights[i],0)-1)<1e-12);
const result={pid:process.pid,started,finished:new Date().toISOString(),command:'node '+p+'/source-check.mjs',sourceSHA256:sha(fs.readFileSync(p+'/source-check.mjs')),originalSHA256:sha(original),copySHA256:sha(copy),declaredDifferences:4,completeCopyReversedExactly:true,blue:c.blue,linear,luma,chromaticity,colourManagement:true,status:'passed copy/normalization contract only; no constructor/GPU/uniform/appearance qualification'};
fs.writeFileSync(p+'/SOURCE-CHECK.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
