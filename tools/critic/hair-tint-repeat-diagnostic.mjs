/** Bounded repeat diagnostic; see tint-controls/PLAN.md. No product rendering changes. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
import {decodePng} from './png.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.resolve(root,'captures/hair-tint-repeat-diagnostic-v1');
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources=[...Object.keys(JSON.parse(fs.readFileSync(path.join(root,'captures/hair-tint-controls-v3/report.json'))).sourceHashes),'tools/critic/hair-tint-repeat-diagnostic.mjs','docs/evidence/hair-2026-09-30/tint-controls/PLAN.md'];
const hashes=()=>Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:hashes(),captures:[],comparisons:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const p of sources.filter(x=>!x.startsWith('assets/'))){const d=path.join(out,'source',p);fs.mkdirSync(path.dirname(d),{recursive:true});fs.copyFileSync(path.join(root,p),d);}save();
let server,browser,page;const seen=new Map();const errors=[];
function compare(a,b){const x=seen.get(a),y=seen.get(b),p=decodePng(x.bytes),q=decodePng(y.bytes);assert.equal(p.width,q.width);assert.equal(p.height,q.height);let changed=0,max=0;for(let i=0;i<p.pixels.length;i+=4){let d=0;for(let j=0;j<4;j++)d=Math.max(d,Math.abs(p.pixels[i+j]-q.pixels[i+j]));if(d)changed++;max=Math.max(max,d);}const keys=Object.keys(x.fixed).filter(k=>JSON.stringify(x.fixed[k])!==JSON.stringify(y.fixed[k]));report.comparisons.push({a,b,changedPixels:changed,maximumChannelDifference:max,fixedStateDifferences:keys});save();}
try{
 server=await startProbeServer({port:5301});browser=await launchProbeBrowser();report.baseUrl=server.baseUrl;save();
 for(let load=0;load<3;load++){
  page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${server.baseUrl}/src/showcase.html?preset=casual&frame=portrait&hairColour=%23413934&capture=`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');
  for(const epoch of [0,10000])for(let repeat=0;repeat<2;repeat++){
   const name=`load-${load}-epoch-${epoch}-repeat-${repeat}`;console.log(name);
   const result=await page.evaluate(async epoch=>{
    const a=showcase.avatar,f=a.stage.renderer._nodes.nodeFrame;a.stage.renderer._animation.stop();f.frameId=epoch;f.time=0;f.deltaTime=0;f.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();showcase.controls.enableDamping=false;showcase.controls.update();
    for(let i=0;i<98;i++){f.update();f.time=0;f.deltaTime=0;await showcase.step(0);}
    const h=await a.hairDynamics.readCentrelines(),v=await a.hairDynamics.readVertices();
    const simple=o=>{const r={};for(const [k,n]of Object.entries(o??{})){const val=n?.isUniformNode?n.value:n;if(typeof val==='number'||typeof val==='boolean'||typeof val==='string')r[k]=val;else if(val?.isVector2||val?.isVector3||val?.isVector4||val?.isColor)r[k]=val.toArray();}return r;};
    const bones=[],morphs=[],meshes=[],lights=[],materials=[];const idOrder=[];
    a.stage.scene.traverse(o=>{if(o.isBone)bones.push([o.name,...o.matrixWorld.elements]);if(o.morphTargetInfluences)morphs.push([o.name,...o.morphTargetInfluences]);if(o.isMesh){meshes.push({name:o.name,type:o.type,visible:o.visible,renderOrder:o.renderOrder,matrix:o.matrixWorld.toArray()});idOrder.push({name:o.name,id:o.id,materialIds:(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.id)});for(const m of(Array.isArray(o.material)?o.material:[o.material])){const s=simple(m);delete s.id;delete s.uuid;delete s.version;materials.push({mesh:o.name,...s});}}if(o.isLight)lights.push({name:o.name,...simple(o),matrix:o.matrixWorld.toArray()});});
    for(const light of lights){delete light.id;delete light.uuid;}
    f.update();f.time=0;f.deltaTime=0;a.stage.draw();
    const data=a.stage.canvas.toDataURL('image/png');const info=a.stage.renderer.backend.device?.adapterInfo;
    return{data,idOrder,backend:a.stage.backendName,adapter:info?{vendor:info.vendor,architecture:info.architecture}:null,fixed:{clock:{frameId:f.frameId,grainFrame:a.stage.grade?.grainFrame?.value,temporal:a.stage.temporal?.frameEpoch(),time:f.time,delta:f.deltaTime},grade:simple(a.stage.grade),bones,morphs,meshes,lights,materials,camera:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray(),positions:Array.from(h.positions),velocities:Array.from(h.velocities),vertices:Array.from(v.positions),configuration:showcase.configuration(),width:a.stage.canvas.width,height:a.stage.canvas.height}};
   },epoch);
   assert.equal(result.backend,'webgpu');const bytes=Buffer.from(result.data.split(',')[1],'base64');fs.writeFileSync(path.join(out,`${name}.png`),bytes);delete result.data;fs.writeFileSync(path.join(out,`${name}.json`),JSON.stringify(result)+'\n');seen.set(name,{...result,bytes});report.captures.push({name,sha256:sha(bytes),stateSha256:sha(fs.readFileSync(path.join(out,`${name}.json`))),backend:result.backend,adapter:result.adapter});save();
   if(repeat===1)compare(`load-${load}-epoch-${epoch}-repeat-0`,name);else if(load>0)compare(`load-0-epoch-${epoch}-repeat-0`,name);
  }
  await page.evaluate(()=>showcase.avatar.dispose());await page.close();
 }
 assert.deepEqual(hashes(),report.sourceHashes);assert.deepEqual(errors,[]);report.status='observed';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{report.browserErrors=errors;report.finished=new Date().toISOString();save();await browser?.close();await server?.close();}
