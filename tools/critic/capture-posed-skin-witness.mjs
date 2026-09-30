import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const rel='captures/skeleton-posed-visual-2026-09-30-v1',out=path.join(root,rel);
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const read=p=>fs.readFileSync(path.resolve(root,p)),sha=b=>createHash('sha256').update(b).digest('hex');
const report={started:new Date().toISOString(),pid:process.pid,status:'running',inputs:{},views:[],errors:[],scope:'Actual native full/four geometry inspection only; no SDK rendering or acceptance gate.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
function bind(p,copy=false){report.inputs[p]=sha(read(p));if(copy){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}}
function decode(dir,a){const p=dir+'/'+a.file;bind(p);const bytes=read(p);assert.equal(sha(bytes),a.sha256);const raw=gunzipSync(bytes);assert.equal(sha(raw),a.decodedSHA256);return JSON.parse(raw);}
let server,browser;
try{
 for(const p of ['tools/critic/capture-posed-skin-witness.mjs','tools/critic/posed-skin-view.html','tools/critic/posed-skin-view.mjs','packages/core/src/render/MotionProbe.mjs','vite.config.js','package-lock.json','docs/evidence/wardrobe-2026-09-30/skeleton-posed-skin/VISUAL-PLAN.md'])bind(p,true);
 const nr='captures/skeleton-native-pose-2026-09-30-v1',br='captures/skeleton-export-bridge-2026-09-30-v1';
 for(const [dir,pin] of [[nr,'226a55bc568bec712c847b5a12b91b6c7a019170d91dd26c2d56e60c140f2be1'],[br,'a1c1ec374c41f2fd1c197d666a6b25d7c0f11bf52b796c4a5b02cc03270ed3e9']]){bind(dir+'/report.json',true);assert.equal(report.inputs[dir+'/report.json'],pin);}
 const native=JSON.parse(read(nr+'/report.json')),bridge=JSON.parse(read(br+'/report.json'));
 const asset=decode(br,bridge.artifacts.find(a=>a.file==='parsed-asset.json.gz'));
 const arms=Object.fromEntries(['native-full','export-four'].map(arm=>{const rows=native.observations.filter(r=>r.weight===0&&r.pose==='coupled'&&r.arm===arm);assert.equal(rows.length,1);return [arm,decode(nr,rows[0].artifact)];}));
 assert.deepEqual(arms['native-full'].poseBones,arms['export-four'].poseBones);
 const map=arm=>asset.vertexMap.flatMap(i=>{const [x,y,z]=arms[arm].bodyPositions.slice(i*3,i*3+3);return [x,z,-y];});
 const full=map('native-full'),four=map('export-four');
 const errorsMm=asset.vertexMap.map((_,i)=>Math.hypot(...full.slice(i*3,i*3+3).map((v,c)=>v-four[i*3+c]))*1000);
 const file='assets/figures/figure_g050.glb';bind(file);assert.equal(report.inputs[file],'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14');
 const glb=read(file);assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);
 const jsonSize=glb.readUInt32LE(12);assert.equal(glb.readUInt32LE(16),0x4e4f534a);const json=JSON.parse(glb.subarray(20,20+jsonSize));const binHeader=20+jsonSize;assert.equal(glb.readUInt32LE(binHeader+4),0x004e4942);const bin=glb.subarray(binHeader+8);
 const nodes=json.nodes.filter(n=>n.mesh!==undefined&&json.meshes[n.mesh].name==='base.001');assert.equal(nodes.length,1);assert.equal(nodes[0].name,'Human');const primitives=json.meshes[nodes[0].mesh].primitives;assert.equal(primitives.length,1);const primitive=primitives[0];assert.equal(primitive.mode??4,4);
 const a=json.accessors[primitive.indices],v=json.bufferViews[a.bufferView];assert.equal(a.type,'SCALAR');assert.ok(!a.sparse&&!a.normalized);assert.equal(v.buffer,0);assert.equal(json.accessors[primitive.attributes.POSITION].count,asset.vertexMap.length);
 const spec={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE']}[a.componentType];assert.ok(spec);const [size,method]=spec,stride=v.byteStride??size,offset=(v.byteOffset??0)+(a.byteOffset??0);
 assert.ok((a.byteOffset??0)+(a.count-1)*stride+size<=v.byteLength);assert.ok((v.byteOffset??0)+v.byteLength<=bin.length);
 const indices=Array.from({length:a.count},(_,i)=>bin[method](offset+i*stride));assert.equal(indices.length%3,0);assert.ok(indices.every(i=>i<asset.vertexMap.length));
 const vertex=errorsMm.indexOf(Math.max(...errorsMm));assert.equal(vertex,4561);assert.equal(asset.vertexMap[vertex],4169);
 const data={full,four,indices,errorsMm,thresholdMm:.342,witness:{vertex,original:asset.vertexMap[vertex],full:full.slice(vertex*3,vertex*3+3),four:four.slice(vertex*3,vertex*3+3),mm:errorsMm[vertex]}};
 fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(data)+'\n');report.geometry={file:'geometry.json',sha256:sha(read(rel+'/geometry.json')),vertices:asset.vertexMap.length,triangles:indices.length/3,aboveThreshold:errorsMm.filter(mm=>mm>=.342).length,witness:data.witness};save();
 server=await startProbeServer({port:5301});report.baseUrl=server.baseUrl;browser=await launchProbeBrowser();
 const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.stack));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${server.baseUrl}/@fs${root}tools/critic/posed-skin-view.html?data=${encodeURIComponent('/@fs'+out+'/geometry.json')}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.captureReady);
 for(const [name,arm,close,marked] of [['context-full','full',false,false],['context-four','four',false,false],['waist-full','full',true,false],['waist-four','four',true,false],['waist-four-marked','four',true,true]]){
  const state=await page.evaluate(args=>window.captureView(args),{arm,close,marked});assert.ok(!/swiftshader|llvmpipe|software/i.test(state.renderer.renderer));assert.equal(state.positions,14517);assert.equal(state.triangles,indices.length/3);
  const file=name+'.png';await page.screenshot({path:path.join(out,file)});report.views.push({name,file,sha256:sha(read(rel+'/'+file)),...state});save();
 }
 assert.deepEqual(report.errors,[]);for(const [p,h]of Object.entries(report.inputs))assert.equal(sha(read(p)),h,p);report.status='captured';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{await browser?.close();await server?.close();report.finished=new Date().toISOString();report.ownedBrowserAndServerClosed=true;save();console.log(JSON.stringify({out,status:report.status,views:report.views.length,pid:report.pid}));}
