import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reconstructBaseline, parseOBJPositions, mappedResidual, parseMhclo,
    requiredIndices, compactBody, fitMhclo, applyCompactDetails, BASE_COUNT } from './cpu-refit.mjs';
import { IdentityCatalogue } from '../../../../packages/core/src/figure/IdentityCatalogue.js';
import { IdentityTargets, AXIS_BLENDER } from '../../../../packages/core/src/figure/IdentityTargets.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rel=p=>path.relative(ROOT,p),read=p=>fs.readFileSync(path.resolve(ROOT,p));
const inventoryPath=path.join(HERE,'inventory-v1.json'),inventory=JSON.parse(fs.readFileSync(inventoryPath));
assert.equal(sha(fs.readFileSync(inventoryPath)),'a5efb4f0882a47fa3276b4b059427a85d008fad28c4177030a17c358387e99f0');
const own=['read-cache.py','cpu-refit.mjs','prove-refit.mjs','cpu-refit.selftest.mjs'].map(n=>path.join(HERE,n));
const inputs=[...inventory.files,...inventory.archives.map(({path,sha256})=>({path,sha256})),
    ...own.map(p=>({path:rel(p),sha256:sha(fs.readFileSync(p))}))];
function checkInputs() { for(const i of inputs) assert.equal(sha(read(i.path)),i.sha256,'Input changed: '+i.path); }
checkInputs();
const out=path.resolve(HERE,process.argv[2]??'proof-v1');
assert.ok(out.startsWith(HERE+path.sep));assert.ok(!fs.existsSync(out),'Fresh output required');
const data=JSON.parse(execFileSync('python3',[path.join(HERE,'read-cache.py')],{maxBuffer:32*1024*1024}));
assert.equal(data.macroTargets.length,8);assert.equal(data.detailTargets.length,2);
const raw=parseOBJPositions(data.baseOBJ),baseline=reconstructBaseline(raw,data.macroTargets);
function glbPositions(file,name) {
    const bytes=read(file);assert.equal(bytes.toString('utf8',0,4),'glTF');
    const size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+size)),binary=bytes.subarray(28+size);
    const primitive=doc.meshes.find(m=>m.name===name).primitives[0],a=doc.accessors[primitive.attributes.POSITION],v=doc.bufferViews[a.bufferView];
    assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
    const p=new Float32Array(a.count*3),start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
    for(let i=0;i<a.count;i++) for(let c=0;c<3;c++) p[3*i+c]=binary.readFloatLE(start+i*stride+c*4);
    return p;
}
const mapBytes=read('assets/identity/figure-vertex-map.bin'),mapping=Uint16Array.from({length:mapBytes.length/2},(_,i)=>mapBytes.readUInt16LE(i*2));
assert.equal(new Set(mapping).size,13380);assert.equal(Math.max(...mapping),13379);
const figure=glbPositions('assets/figures/figure_g050.glb','base.001'),body=glbPositions('assets/wardrobe/body/g050.glb','base.001');
assert.deepEqual(figure,body);
const correspondence=mappedResidual(baseline.positions,figure,mapping);
// Save the measured failure as well as success; no refit is produced before this passes.
fs.mkdirSync(out);
const artifacts=[];
function saveJSON(name,object) {
    const decoded=Buffer.from(JSON.stringify(object)+'\n'),encoded=gzipSync(decoded,{level:9});
    const file=path.join(out,name+'.json.gz');fs.writeFileSync(file,encoded,{flag:'wx'});
    artifacts.push({path:rel(file),bytes:encoded.length,sha256:sha(encoded),decodedBytes:decoded.length,decodedSHA256:sha(decoded)});
}
saveJSON('baseline',{space:'blender-z-up-metres',positions:Array.from(baseline.positions),grounding:baseline.grounding,
    recipe:data.recipe,macroTargetOrder:data.macroTargets.map(t=>({file:t.file,weight:t.weight})),correspondence,
    limits:'CPU source-derived float32 model; omitted helpers have no independent native positional oracle.'});
assert.ok(correspondence.passed,JSON.stringify(correspondence));
const model=parseMhclo(data.mhclo),indices=requiredIndices(model);
assert.equal(indices.length,1885);
const compactNeutral=compactBody(baseline.positions,indices),compactTargets=data.detailTargets.map(t=>({...t,records:t.records.filter(r=>indices.includes(r[0]))}));
const catalogue=new IdentityCatalogue(JSON.parse(read('assets/identity/catalogue.json')));
const targets=new IdentityTargets(catalogue,{baseUrl:'file:///',fetchBytes:async url=>{
    const b=read('assets/identity/'+url.slice('file:///'.length));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
}});
await targets.loadRegions(['torso','legs']);
const sliders=['torso/measure-shoulder-dist-decr-incr','legs/upperlegs-height-decr-incr'];
const cases=[];
for(const weight of [0,0.25,1]) {
    const values=Object.fromEntries(sliders.map(id=>[id,weight])),stack=catalogue.resolve(values);
    if(weight) assert.deepEqual(stack.map(t=>t.target).sort(),['measure-shoulder-dist-incr','upperlegs-height-incr']);
    const deltas=new Float64Array(BASE_COUNT*3);targets.useBasemeshSpace().apply(deltas,stack,{axis:AXIS_BLENDER});
    const shaped=Float64Array.from(baseline.positions,(x,i)=>x+deltas[i]);
    const compact=compactBody(shaped,indices),fit=fitMhclo(model,compact),double=fitMhclo(model,compact,{arithmetic:'float64-reference'});
    const portable=applyCompactDetails(compactNeutral,compactTargets,[weight,weight]);
    assert.deepEqual(portable.positions,compact.positions,'Compact packet differs from current full IdentityTargets');
    assert.deepEqual(fitMhclo(model,portable).positions,fit.positions);
    const input32=Float32Array.from(compact.positions),sameInputDouble=fitMhclo(model,{indices,positions:input32},{arithmetic:'float64-reference'});
    function error(a,b) { let maxMm=0,worst=-1;for(let i=0;i<a.length/3;i++){const e=Math.hypot(...[0,1,2].map(c=>a[3*i+c]-b[3*i+c]))*1000;if(e>maxMm){maxMm=e;worst=i;}}return {maxMm,worst}; }
    const result={weight,values,stack,scale:fit.scale,positionCount:model.garmentCount,
        float32VsDoubleReference:error(fit.positions,double.positions),float32VsDoubleSameRoundedBody:error(fit.positions,sameInputDouble.positions),
        bodyDependencyPositions:Array.from(compact.positions),bodyDependencyDeltas:Array.from(compactBody(deltas,indices).positions),
        garmentPositions:Array.from(fit.positions),nativeOracle:false,fitQualified:false};
    saveJSON('case-'+String(weight).replace('.','_'),result);
    cases.push({weight,scale:fit.scale,compactVsFullIdentityTargetsExact:true,float32VsDoubleReference:result.float32VsDoubleReference,
        float32VsDoubleSameRoundedBody:result.float32VsDoubleSameRoundedBody});
}
saveJSON('portable-inputs',{format:'sugata-one-garment-coupling-data-v1',inventorySHA256:data.inventorySHA256,
    model,indices,baseline:Array.from(compactBody(baseline.positions,indices).positions),
    detailTargets:compactTargets,
    scaleFactor:Math.fround(.1),targetSourceSpace:'MakeHuman Y-up, raw target units',bodySpace:'Blender Z-up metres',
    limits:'Original mhclo arithmetic only. Retains raw signed unnormalized weights. Helper baseline is CPU-derived; no native oracle; installed trouser correction absent.'});
checkInputs();
const report={protocol:'cached-g050-one-garment-cpu-v1',completed:true,recordedUTC:new Date().toISOString(),
    inputSources:inputs,artifacts,correspondence,grounding:baseline.grounding,cases,
    method:{model:'Source-derived float32 basis/key storage and retained macro-order relative sum. Ground then reevaluate same keys.',
        axes:'OBJ/MakeHuman(x,y,z) to Blender(x,-z,y); glTF(x,z,-y). No fitted translation or scaling.',
        currentNativeEvidence:false,bodyOnlyGateMm:0.001,bodyOnlyGateStrict:true},
    nativeBlock:inventory.nativeAvailability,
    limits:['Helpers are reconstructed, not independently observed in native MPFB.',
        'No exact Blender importer/evaluator rounding claim; nonzero mapped residual is retained.',
        'Double/reference comparison only diagnoses the CPU arithmetic, not native correctness.',
        'No installed garment mutation, glTF garment source mapping, fit qualification, skeleton refit, foundations, motion or9.4 work.']};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out:rel(out),correspondence,grounding:baseline.grounding,cases,artifacts},null,2));
