import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../tools/critic/png.mjs';
import {startProbeServer,launchProbeBrowser} from '../../../packages/core/src/render/MotionProbe.mjs';
const root='tmp/hair-sep24/material-attribution';fs.mkdirSync(root,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const asset='assets/hair/crop01/g050.glb',bytes=fs.readFileSync(asset);
const arms=['baseline','no-normal','rough-one','lambert','lambert-no-normal'];
const report={asset,assetSha256:sha(bytes),sourceSha256:sha(fs.readFileSync('packages/testbed/src/hair.js')),
 scope:'Fixed shipping crop01/g050 rest-pose PBR material attribution; diagnostic arms, not promotion or public HairMaterial qualification',
 loads:[],views:{},errors:[]};
const server=await startProbeServer({port:5187});let browser;
try{
 browser=await launchProbeBrowser();
 const page=await browser.newPage({viewport:{width:1400,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.errors.push(`${r.status()} ${r.url()}`);});
 await page.route('**/assets/hair/crop01/g050.glb',route=>{report.loads.push(sha(bytes));return route.fulfill({body:bytes,contentType:'model/gltf-binary'});});
 await page.route('**/src/hair.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  const imports=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const webgpu=imports.find(s=>/three[._]webgpu/.test(s));assert.ok(webgpu);
  const marker='const bounds = new Box3().setFromObject( hair.scene );';assert.ok(source.includes(marker));
  source=source.replace(marker,`
   const {MeshLambertNodeMaterial,MeshBasicNodeMaterial,TSL}=await import(${JSON.stringify(webgpu)});
   const meshes=[];hair.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
   if(meshes.length!==1)throw Error('Expected one groom mesh');
   const mesh=meshes[0],original=mesh.material,parent=mesh.parent;
   const bodies=[];figure.scene.traverse(o=>{if(o.isMesh)bodies.push([o,o.material]);});
   const originalBackground=scene.background.clone();
   const blank=m=>{const b=new MeshBasicNodeMaterial({side:m.side,alphaTest:m.alphaTest});
    b.colorNode=TSL.vec3(0);b.toneMapped=false;if(m.map)b.opacityNode=TSL.texture(m.map).a;return b;};
   const blackBodies=bodies.map(([o,m])=>[o,Array.isArray(m)?m.map(blank):blank(m)]);
   const lambert=()=>{
    const m=new MeshLambertNodeMaterial();
    for(const key of ['map','alphaMap','normalMap','normalMapType','side','alphaTest','transparent','opacity','depthWrite','depthTest','depthFunc','alphaToCoverage','alphaHash','toneMapped','emissiveMap','emissiveIntensity','vertexColors','fog'])m[key]=original[key];
    m.color.copy(original.color);m.normalScale.copy(original.normalScale);m.emissive.copy(original.emissive);
    return m;
   };
   const materials={baseline:original,'no-normal':original.clone(),'rough-one':original.clone(),lambert:lambert(),'lambert-no-normal':lambert()};
   materials['no-normal'].normalMap=null;materials['rough-one'].roughness=1;materials['lambert-no-normal'].normalMap=null;
   let active=original;
   const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   const geometry=async()=>{
    const attrs=Object.entries(mesh.geometry.attributes).sort(([a],[b])=>a.localeCompare(b));
    const result={};for(const [name,a]of attrs)result[name]={count:a.count,itemSize:a.itemSize,hash:await digest(a.array)};
    result.indices=await digest(mesh.geometry.index.array);return result;
   };
   const describe=m=>({type:m.type,color:m.color.toArray(),map:m.map?.uuid??null,alphaMap:m.alphaMap?.uuid??null,
    normalMap:m.normalMap?.uuid??null,normalScale:m.normalScale.toArray(),roughness:m.roughness??null,metalness:m.metalness??null,
    side:m.side,alphaTest:m.alphaTest,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,depthTest:m.depthTest,
    alphaHash:m.alphaHash,alphaToCoverage:m.alphaToCoverage,toneMapped:m.toneMapped});
   window.__MATERIAL_DIAG__=async({arm='baseline',mode='pbr',badCutoff=false}={})=>{
    if(!materials[arm])throw Error('Unknown arm');active=materials[arm];mesh.material=active;
    if(!mesh.parent)parent.add(mesh);
    for(const [o,m]of bodies)o.material=m;scene.background=originalBackground;
    if(mode==='body')mesh.removeFromParent();
    if(mode==='mask'||mode==='empty'){
     const m=new MeshBasicNodeMaterial({side:active.side,alphaTest:badCutoff?0:active.alphaTest,opacity:active.opacity});
     m.colorNode=TSL.vec3(1);m.opacityNode=TSL.texture(active.map).a;m.toneMapped=false;
     mesh.material=m;for(const [o,b]of blackBodies)o.material=b;scene.background=new Color(0);
     if(mode==='empty')mesh.removeFromParent();
    }
    await place();
    const result={material:describe(active),geometry:await geometry(),centre:centre.toArray(),camera:camera.matrixWorld.elements.slice(),
     head:figure.scene.getObjectByName('head').matrixWorld.elements.slice(),lights:[key,rim,fill].map(l=>({type:l.type,color:l.color.toArray(),intensity:l.intensity,position:l.position.toArray(),target:l.target?.position.toArray()??null})),clock:window.__HAIR_CLOCK__()};
    if(mesh.material!==active)mesh.material.dispose();
    mesh.material=active;return result;
   };
  `+marker);
  await route.fulfill({response,body:source});
 });
 await page.goto(`${server.baseUrl}/src/hair.html?groom=crop01&bake=g050&capture=1`);
 await page.waitForFunction(()=>typeof window.hairShot==='function'&&document.querySelector('#hud').textContent.includes('Renderer'),null,{timeout:120000});
 report.hud=await page.locator('#hud').textContent();assert.match(report.hud,/WebGPU/);assert.doesNotMatch(report.hud,/FAILED/);
 report.adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter(),i=a.info;return {vendor:i.vendor,architecture:i.architecture,description:i.description};});
 const shot=async(name,settings)=>{
  const state=await page.evaluate(s=>window.__MATERIAL_DIAG__(s),settings);
  assert.equal(state.clock.frameId,state.clock.draws);assert.equal(state.clock.time,0);
  const file=path.join(root,name+'.png');await page.locator('#stage').screenshot({path:file});
  return {state,image:decodePng(fs.readFileSync(file)),sha256:sha(fs.readFileSync(file))};
 };
 const difference=(a,b)=>{assert.equal(a.width,b.width);assert.equal(a.height,b.height);let changed=0;for(let k=0;k<a.pixels.length;k+=4)if([0,1,2].some(c=>a.pixels[k+c]!==b.pixels[k+c]))changed++;return changed;};
 const fixed=s=>({geometry:s.geometry,centre:s.centre,camera:s.camera,head:s.head,lights:s.lights});
 for(const view of ['front','three-quarter','side','back','top']){
  await page.evaluate(v=>window.hairShot(v),view);
  const base=await shot(view+'-baseline',{arm:'baseline'}),body=await shot(view+'-body',{mode:'body'}),mask=await shot(view+'-mask',{mode:'mask'});
  const row=report.views[view]={baseline:base.state,baselineSha256:base.sha256,bodySha256:body.sha256,maskSha256:mask.sha256,arms:{}};
  for(const arm of arms){
   const rendered=arm==='baseline'?base:await shot(view+'-'+arm,{arm});
   const detached=await shot(view+'-'+arm+'-body',{arm,mode:'body'});
   const armMask=await shot(view+'-'+arm+'-mask',{arm,mode:'mask'});
   assert.deepEqual(fixed(rendered.state),fixed(base.state));
   const preserved=['color','map','alphaMap','normalScale','side','alphaTest','opacity','transparent','depthWrite','depthTest','alphaHash','alphaToCoverage','toneMapped'];
   for(const key of preserved)assert.deepEqual(rendered.state.material[key],base.state.material[key]);
   const material=rendered.state.material;
   if(arm==='no-normal'||arm==='lambert-no-normal')assert.equal(material.normalMap,null);
   else assert.equal(material.normalMap,base.state.material.normalMap);
   if(arm==='rough-one')assert.equal(material.roughness,1);
   if(arm==='no-normal')assert.equal(material.roughness,base.state.material.roughness);
   if(arm.startsWith('lambert'))assert.equal(material.type,'MeshLambertNodeMaterial');
   assert.equal(difference(body.image,detached.image),0);assert.equal(difference(mask.image,armMask.image),0);
   const luma=[],deltas=[];let changedHair=0;
   for(let k=0;k<mask.image.pixels.length;k+=4)if([0,1,2].every(c=>mask.image.pixels[k+c]>.999)){
    const luminance=p=>.2126*p[k]+.7152*p[k+1]+.0722*p[k+2];
    luma.push(luminance(rendered.image.pixels));deltas.push(Math.abs(luminance(rendered.image.pixels)-luminance(base.image.pixels)));
    if([0,1,2].some(c=>rendered.image.pixels[k+c]!==base.image.pixels[k+c]))changedHair++;
   }
   luma.sort((a,b)=>a-b);assert.ok(luma.length>0);
   row.arms[arm]={material:rendered.state.material,imageSha256:rendered.sha256,changedHairPixels:changedHair,maskPixels:luma.length,
    lumaP50:luma[Math.floor(luma.length*.5)],lumaP95:luma[Math.floor(luma.length*.95)],lumaP99:luma[Math.floor(luma.length*.99)],
    meanAbsoluteLumaDifference:deltas.reduce((s,v)=>s+v,0)/deltas.length,
    bodyChangedPixels:0,maskChangedPixels:0};
   if(arm!=='baseline')assert.ok(changedHair>0,'Ablation must change rendered hair');
  }
  const bad=await shot(view+'-bad-cutoff',{mode:'mask',badCutoff:true});row.badCutoffChangedPixels=difference(mask.image,bad.image);assert.ok(row.badCutoffChangedPixels>0);
  const empty=await shot(view+'-empty',{mode:'empty'});assert.ok(empty.image.pixels.every((v,i)=>i%4===3||v===0));
  const restored=await shot(view+'-restored',{arm:'baseline'});assert.equal(difference(base.image,restored.image),0);row.restoredChangedPixels=0;
  console.log(`${view}: five live material arms; fixed geometry/lights/body/cutout and exact baseline restoration pass`);
 }
 assert.ok(report.loads.length>0&&report.loads.every(h=>h===report.assetSha256));assert.deepEqual(report.errors,[]);report.controlsPassed=true;
}catch(error){report.error=error.stack;throw error;}finally{
 fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();
}
