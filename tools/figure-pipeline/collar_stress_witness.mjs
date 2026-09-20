// Exact-frame material controls and CPU pixel ownership for the expressive-motion gray patch.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const STRESS=ROOT+'/captures/collar-expression-stress-2026-09-16';
const ARCHIVE=ROOT+'/captures/collar-clearance-paused-2026-09-13';
const OUT=path.resolve(process.argv[2]);assert.equal(fs.existsSync(OUT),false);fs.mkdirSync(OUT,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),hashFile=p=>sha(fs.readFileSync(p));
const capture=JSON.parse(fs.readFileSync(STRESS+'/gpu-v1/report.json'));assert.equal(capture.completed,true);
const reference=capture.runs.find(r=>r.hair==='bob02'&&r.arm==='owned').states.find(s=>s.step===99);
const paths=[...Object.keys(capture.sourceHashes),'tools/figure-pipeline/collar_stress_witness.mjs','tools/figure-pipeline/collar_opening_browser.mjs'];
const sources=()=>Object.fromEntries(paths.map(p=>[p,hashFile(ROOT+'/'+p)]));
const candidatePath=ROOT+'/captures/collar-window-2026-09-16/casual-collar-interior-v1.glb',candidateBytes=fs.readFileSync(candidatePath);
assert.equal(sha(candidateBytes),capture.candidateSHA256);
const report={completed:false,candidateSHA256:capture.candidateSHA256,candidatePath,assetLoading:'Frozen d81 routed into the real loader; installed default is unchanged.',referenceReportSHA256:hashFile(STRESS+'/gpu-v1/report.json'),step:99,sourceHashes:sources(),runs:[],stateComparison:'Both states use JSON number semantics because the reference was saved as JSON; signed zero is normalized to zero. No numeric tolerance is applied.',scope:'One-factor bra-colour and global-cloth-side controls at the exact new motion witness. No body mask or geometry edits.'};
fs.copyFileSync(fileURLToPath(import.meta.url),OUT+'/collar_stress_witness.mjs');
const save=()=>fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
const server=await createServer({configFile:ROOT+'/vite.config.js',server:{host:'127.0.0.1',port:5357,strictPort:true,hmr:false,watch:{ignored:['**']},fs:{allow:[ROOT]}},logLevel:'error'});
let browser;
try{
 await server.listen();browser=await launchProbeBrowser();
 for(const arm of ['ordinary','bra-magenta','cloth-double']){
  const rec={arm,errors:[],loadedAssets:[]};report.runs.push(rec);save();const reads=[];
  const page=await browser.newPage({viewport:{width:1280,height:1050},deviceScaleFactor:1,reducedMotion:'no-preference'});
  page.on('pageerror',e=>rec.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());});
  page.on('response',r=>{if(r.ok()&&/\/assets\/wardrobe\/female_casualsuit01\/g050\.glb(?:\?.*)?$/.test(r.url()))reads.push(r.body().then(b=>rec.loadedAssets.push({url:r.url(),sha256:sha(b)})));});
  await page.route(/\/assets\/wardrobe\/female_casualsuit01\/g050\.glb(?:\?.*)?$/,async route=>{
   if(new URL(route.request().url()).searchParams.has('import'))return route.continue();
   await route.fulfill({status:200,contentType:'model/gltf-binary',body:candidateBytes});
  });
  try{
   await page.goto('http://127.0.0.1:5357/src/showcase.html?preset=casual&outfit=casual&style=ecru&frame=portrait&capture=');
   await page.waitForFunction(()=>window.showcase,null,{timeout:120000});
   await Promise.all(reads);assert.equal(rec.loadedAssets.length,1);assert.equal(rec.loadedAssets[0].sha256,capture.candidateSHA256);
   await page.evaluate(async({ARCHIVE,arm})=>{
    window.avatar=showcase.avatar;window.helper=await import('/@fs'+ARCHIVE+'/browser.mjs');const a=avatar;
    const f=a.wardrobe.fragments.get('female_casualsuit01');if(!f.interior||f.interior.fullTriangles!==140)throw Error('Expected owned collar');
    if(arm==='bra-magenta')a.wardrobe.wornMeshes.get('foundation_bra').material.color.setRGB(1,0,1);
    if(arm==='cloth-double'){f.interior.dispose();f.interior=null;f.mesh.material.side=2;f.mesh.material.needsUpdate=true;}
    showcase.controls.target.copy(a.focus);showcase.controls.target.y+=.045;
    window.probe=await helper.setup(a,{arm:'owned',motion:'natural',yaw:12});
    const c=a.stage.camera,t=a.focus.clone();t.y-=.03;const radius=Math.hypot(c.position.x-t.x,c.position.z-t.z)*1.25,r=25*Math.PI/180;
    c.position.set(t.x+Math.sin(r)*radius,t.y+.04,t.z+Math.cos(r)*radius);c.lookAt(t);
    showcase.controls.target.copy(t);showcase.controls.minDistance=radius*.7;showcase.controls.maxDistance=radius*1.5;showcase.controls.update();showcase.controls.saveState();
    for(let i=0;i<128;i++)await helper.draw(a);
    const pad={pleasure:.8,arousal:.8,dominance:1};a.feel('happy',1);a.feel(pad);
    await a.say('Closer, then farther.',{speechPlan:{synthetic:true,durationSeconds:6,words:[
     {text:'closer',startTime:1.5,endTime:1.9,stressed:true,contrastGroup:'span'},
     {text:'farther',startTime:4.5,endTime:4.9,stressed:true,contrastGroup:'span'}]}});
    a.feel('happy',1);a.feel(pad);
    for(let i=0;i<99;i++)await helper.step(a,1/60);
   },{ARCHIVE,arm});
   rec.state=await page.evaluate(async()=>({physical:await helper.physical(avatar),bones:Array.from(avatar.figure.body.skeleton.boneMatrices),morphs:Array.from(avatar.figure.body.morphTargetInfluences),rendererFrame:avatar.stage.renderer._nodes.nodeFrame.frameId,affect:avatar.report().affect,gesture:avatar.gesture.report()}));
   rec.state=JSON.parse(JSON.stringify(rec.state));
   const {step,...expected}=reference;assert.deepEqual(rec.state,expected,'Exact99 motion/physical/renderer state must reproduce');
   const bytes=await page.locator('#stage').screenshot();fs.writeFileSync(OUT+'/'+arm+'.png',bytes);rec.imageSHA256=sha(bytes);
   if(arm==='ordinary'){
    const points=[];for(let y=550;y<=575;y++)for(let x=172;x<=194;x++)points.push({label:'gray',x:x+.5,y:y+.5});
    const rays=await page.evaluate(async({ROOT,points})=>{const picker=await import('/@fs'+ROOT+'/tools/figure-pipeline/collar_opening_browser.mjs');return picker.pick(avatar,points);},{ROOT,points});
    fs.writeFileSync(OUT+'/rays.json',JSON.stringify(rays));rec.raysSHA256=hashFile(OUT+'/rays.json');
   }
   assert.deepEqual(rec.errors,[]);
  }catch(error){rec.failure=error.stack;throw error;}
  finally{
   try{rec.disposal=await page.evaluate(()=>{const a=window.avatar;if(!a)return null;const r=a.stage.renderer;showcase.attention.dispose();showcase.controls.dispose();helper.dispose(a,probe);return{memory:structuredClone(r.info.memory),leaks:a.leakedHandles()};});}
   finally{await page.close();save();}
  }
  assert.ok(Object.values(rec.disposal.memory).every(v=>v===0));assert.deepEqual(rec.disposal.leaks,[]);console.log('Completed '+arm);
 }
 assert.deepEqual(sources(),report.sourceHashes);report.completed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{save();await browser?.close();await server.close();console.log(JSON.stringify({completed:report.completed,failure:report.failure}));}
