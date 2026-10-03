/** Root recheck: Three camera/Box3 path independent of capture's dot/cross fit. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {Vector3,Box3,Matrix4,OrthographicCamera,WebGPUCoordinateSystem} from 'three';
import {decodePng} from './png.mjs';
const root=process.cwd(),rel='captures/full-body-coverage-2026-10-02-v1',out=path.join(root,rel),old='captures/skeleton-full-influences-gpu-2026-09-30-v2';
const read=p=>fs.readFileSync(path.join(root,p)),sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(read(p));
const result={started:new Date().toISOString(),pid:process.pid,method:'Three lookAt/extractRotation/Box3 fit and complete project path; root actual original images reviewed separately.',inputs:{},checks:[]};
const report=json(rel+'/report.json');result.inputs[rel+'/report.json']=sha(read(rel+'/report.json'));
assert.equal(report.status,'observed');assert.deepEqual(report.errors,[]);assert.ok(Date.parse(report.finished)<Date.parse(report.hardStop));assert.equal(report.computeRuns,0);
for(const[p,h]of Object.entries(report.inputs)){assert.equal(sha(read(p)),h,p);result.inputs[p]=h;const copy=path.join(out,'sources',p);if(fs.existsSync(copy))assert.equal(sha(fs.readFileSync(copy)),h,p+' snapshot');}
const prepared=json(old+'/inputs.json'),raw=JSON.parse(gunzipSync(read(old+'/1-coupled.json.gz'))),data=json(rel+'/inputs.json');assert.equal(sha(read(rel+'/inputs.json')),report.prepared.sha256);
const native=Array.from(new Float32Array(prepared.cases.find(c=>c.name==='1-coupled').expected)),gpu=raw.observed.positions;
assert.deepEqual(data.native,native);assert.deepEqual(data.gpu,gpu);assert.deepEqual(data.indices,prepared.indices);assert.ok(gpu.every(v=>Math.fround(v)===v));
const orientation=new OrthographicCamera();orientation.position.set(-2.4,.56,4);orientation.lookAt(0,0,0);orientation.updateMatrixWorld(true);
const rotation=new Matrix4().extractRotation(orientation.matrixWorld),inverse=rotation.clone().invert(),box=new Box3();
for(let i=0;i<14517;i++)box.expandByPoint(new Vector3(...native.slice(i*3,i*3+3)).applyMatrix4(inverse));
const target=box.getCenter(new Vector3()).applyMatrix4(rotation),size=box.getSize(new Vector3()),halfSpan=Math.max(size.y/2,size.x/2/1.2)/.70;
const camera=new OrthographicCamera(-halfSpan*1.2,halfSpan*1.2,halfSpan,-halfSpan,.01,20);
camera.coordinateSystem=WebGPUCoordinateSystem;camera.position.copy(target).add(new Vector3(-2.4,.56,4).normalize().multiplyScalar(5));camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
let maxMatrixError=0,maxPixelError=0,maxDepthError=0;
const compare=(actual,expected)=>{assert.equal(actual.length,expected.length);for(let i=0;i<actual.length;i++){const e=Math.abs(actual[i]-expected[i]);maxMatrixError=Math.max(maxMatrixError,e);assert.ok(e<1e-12);}};
compare(target.toArray(),data.camera.target);compare([halfSpan],[data.camera.halfSpan]);
for(const view of report.views){
 compare(camera.matrixWorldInverse.toArray(),view.common.viewMatrix);compare(camera.projectionMatrix.toArray(),view.common.projectionMatrix);assert.equal(view.common.coordinateSystem,WebGPUCoordinateSystem);
 const artifact=read(rel+'/'+view.projections.file);assert.equal(sha(artifact),view.projections.sha256);const unpacked=gunzipSync(artifact);assert.equal(sha(unpacked),view.projections.decodedSHA256);const projections=JSON.parse(unpacked);assert.equal(projections.length,14517);
 const points=view.arm==='native'?native:gpu;
 for(let i=0;i<14517;i++){const p=new Vector3(...points.slice(i*3,i*3+3)).project(camera),actual=[(p.x+1)*600,(1-p.y)*500,p.z];for(let c=0;c<3;c++){const e=Math.abs(actual[c]-projections[i][c]);if(c<2)maxPixelError=Math.max(maxPixelError,e);else maxDepthError=Math.max(maxDepthError,e);assert.ok(e<1e-9);}assert.ok(actual[0]>=179.999&&actual[0]<=1020.001&&actual[1]>=149.999&&actual[1]<=850.001&&actual[2]>=0&&actual[2]<=1);}
 assert.equal(sha(read(rel+'/'+view.file)),view.sha256);const image=decodePng(read(rel+'/'+view.file));assert.equal(image.width,1200);assert.equal(image.height,1000);
}
assert.deepEqual(report.views[0].common,report.views[1].common);assert.deepEqual(report.cleanup,{gpu:{disposed:true,privateStorageAttributesReleased:1,errors:[]},page:'closed',browser:'closed',server:'closed'});
for(const a of report.artifacts){const b=read(rel+'/'+a.file);assert.equal(sha(b),a.sha256);assert.equal(sha(gunzipSync(b)),a.decodedSHA256);}
const a=decodePng(read(rel+'/body-complete-native.png')),b=decodePng(read(rel+'/body-complete-gpu.png'));let changedPixels=0,maxCodeDifference=0;
for(let y=120;y<1000;y++)for(let x=0;x<1200;x++){let changed=false;for(let c=0;c<4;c++){const i=(y*1200+x)*4+c,d=Math.abs(a.pixels[i]-b.pixels[i]);changed||=d!==0;maxCodeDifference=Math.max(maxCodeDifference,d*255);}if(changed)changedPixels++;}
result.checks=['All retained/new positions and indices exact','All current input/source copies rehashed','Shared camera independently reconstructed from native via Three Box3','All29034image projections/frustum bounds reproduced','Actual originals1200×1000 PNGCRC/dimensions/hashes','Both common render records byte-equivalent JSON','Every compressed/decoded artifact hash','GPU/page/browser/server cleanup and timely finish'];
result.maxMatrixError=maxMatrixError;result.maxPixelError=maxPixelError;result.maxDepthError=maxDepthError;result.projections=29034;
result.supportingPixelComparison={region:{x:0,y:120,width:1200,height:880},changedPixels,maxCodeDifference,note:'Labels excluded. Supporting observation only; no pixel-exact acceptance requirement and no new capture.'};
result.inputs['tools/critic/verify-full-body-coverage.mjs']=sha(read('tools/critic/verify-full-body-coverage.mjs'));result.inputs['tools/critic/png.mjs']=sha(read('tools/critic/png.mjs'));
result.finished=new Date().toISOString();result.passed=true;fs.writeFileSync(path.join(out,'root-independent.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pid:process.pid,passed:true,maxMatrixError,maxPixelError,maxDepthError,changedPixels,maxCodeDifference,resultSha256:sha(read(rel+'/root-independent.json'))}));
