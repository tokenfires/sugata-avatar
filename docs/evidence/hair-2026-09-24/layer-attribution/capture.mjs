import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {decodePng} from '../../../tools/critic/png.mjs';
import {startProbeServer,launchProbeBrowser} from '../../../packages/core/src/render/MotionProbe.mjs';
import {layerMap,sha,palette} from './map.mjs';

const inputRoot=path.resolve('tmp/hair-sep24/layer-attribution');
const root=process.env.LAYER_NO_AA==='1'?path.join(inputRoot,'no-aa'):inputRoot;
fs.mkdirSync(root,{recursive:true});
const provenance=JSON.parse(fs.readFileSync(path.join(inputRoot,'provenance.json')));
const map=layerMap('assets/hair/crop01/g050.glb',provenance);
assert.equal(provenance.sourceSha256,sha(fs.readFileSync('tools/figure-pipeline/hair_cards.py')));
assert.throws(()=>layerMap(map.file,{...provenance,cards:provenance.cards.slice(1)}),/Unmapped card/);
assert.throws(()=>layerMap(map.file,{...provenance,cards:[...provenance.cards,provenance.cards[0]]}),/Duplicate provenance/);
fs.writeFileSync(path.join(root,'layer-map.json'),JSON.stringify(map));
const report={assetSha256:map.sha256,provenanceSha256:sha(fs.readFileSync(path.join(inputRoot,'provenance.json'))),antialias:process.env.LAYER_NO_AA!=='1',layers:map.layers,palette,views:{},errors:[],scope:'Actual WebGPU rest-pose visibility attribution on hair.html, not a new groom or appearance qualification.'};
const server=await startProbeServer({port:5187});let browser;
try{
 browser=await launchProbeBrowser();
 const page=await browser.newPage({viewport:{width:1400,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.route('**/layer-map.json',route=>route.fulfill({json:map}));
 await page.route('**/src/hair.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  if(process.env.LAYER_NO_AA==='1'){
   const aa='canvas, antialias: true, alpha: false';assert.ok(source.includes(aa));
   source=source.replace(aa,'canvas, antialias: false, alpha: false');
  }
  const imports=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const webgpu=imports.find(s=>/three[._]webgpu/.test(s));assert.ok(webgpu,imports.join('\n'));
  const marker='const bounds = new Box3().setFromObject( hair.scene );';assert.ok(source.includes(marker));
  const injection=`
   const {MeshBasicNodeMaterial,Float32BufferAttribute,BufferAttribute,TSL}=await import(${JSON.stringify(webgpu)});
   const layerData=await (await fetch('/layer-map.json')).json();
   const hairMeshes=[]; hair.scene.traverse(o=>{if(o.isMesh)hairMeshes.push(o);});
   if(hairMeshes.length!==1)throw Error('Expected one groom mesh');
   const layerMesh=hairMeshes[0], layerGeometry=layerMesh.geometry;
   if(layerGeometry.attributes.position.count!==layerData.labels.length)throw Error('Vertex count differs');
   const layerIndex=layerGeometry.index.clone(), layerPosition=layerGeometry.attributes.position.array.slice();
   const layerOriginal=layerMesh.material, layerBackground=scene.background.clone();
   const figureMaterials=[]; figure.scene.traverse(o=>{if(o.isMesh)figureMaterials.push([o,o.material]);});
   const layerColors=layerData.labels.flatMap(l=>new Color(layerData.palette[l]).toArray());
   layerGeometry.setAttribute('layerColor',new Float32BufferAttribute(layerColors,3));
   const layerIdMaterial=new MeshBasicNodeMaterial({side:layerOriginal.side,alphaTest:layerOriginal.alphaTest});
   layerIdMaterial.colorNode=TSL.attribute('layerColor','vec3');
   layerIdMaterial.opacityNode=TSL.texture(layerOriginal.map).a;layerIdMaterial.toneMapped=false;
   const layerWhiteMaterial=new MeshBasicNodeMaterial({side:layerOriginal.side,alphaTest:layerOriginal.alphaTest});
   layerWhiteMaterial.colorNode=TSL.vec3(1);layerWhiteMaterial.opacityNode=TSL.texture(layerOriginal.map).a;layerWhiteMaterial.toneMapped=false;
   const blackMaterial=original=>{
    const m=new MeshBasicNodeMaterial({side:original.side,alphaTest:original.alphaTest});
    m.colorNode=TSL.vec3(0);m.toneMapped=false;
    if(original.map)m.opacityNode=TSL.texture(original.map).a;
    return m;
   };
   const layerBlack=figureMaterials.map(([o,m])=>[o,Array.isArray(m)?m.map(blackMaterial):blackMaterial(m)]);
   window.__LAYER_DIAG__=async({mode='pbr',omit=[],only=null}={})=>{
    const selected=[];
    for(let i=0;i<layerIndex.count;i+=3){const label=layerData.labels[layerIndex.array[i]];
     if(!omit.includes(label)&&(only===null||only.includes(label)))selected.push(...layerIndex.array.slice(i,i+3));}
    layerGeometry.setIndex(new BufferAttribute(new layerIndex.array.constructor(selected),1));
    layerMesh.material=mode==='ids'?layerIdMaterial:mode==='white'?layerWhiteMaterial:layerOriginal;
    scene.background=mode==='pbr'?layerBackground:new Color(0);
    for(const [o,m]of(mode==='pbr'?figureMaterials:layerBlack))o.material=m;
    for(let i=0;i<layerPosition.length;i++)if(layerPosition[i]!==layerGeometry.attributes.position.array[i])throw Error('Position changed');
    await place();
    return {triangles:selected.length/3,clock:window.__HAIR_CLOCK__()};
   };
  `;
  source=source.replace(marker,injection+marker);
  await route.fulfill({response,body:source});
 });
 await page.goto(`${server.baseUrl}/src/hair.html?groom=crop01&bake=g050&capture=1`);
 await page.waitForFunction(()=>typeof window.hairShot==='function'&&document.querySelector('#hud').textContent.includes('Renderer'),null,{timeout:120000});
 const hud=await page.locator('#hud').textContent();assert.match(hud,/WebGPU/);fs.writeFileSync(path.join(root,'hud.txt'),hud);
 const shot=async(name,settings)=>{
  const state=await page.evaluate(s=>window.__LAYER_DIAG__(s),settings);
  assert.equal(state.clock.draws,state.clock.frameId);assert.equal(state.clock.time,0);
  const file=path.join(root,`${name}.png`);await page.locator('#stage').screenshot({path:file});return decodePng(fs.readFileSync(file));
 };
 const bytes=Object.entries(palette).map(([name,n])=>[name,[(n>>16)&255,(n>>8)&255,n&255]]);
 for(const view of ['front','three-quarter','side','back','top']){
  await page.evaluate(v=>window.hairShot(v),view);
  await shot(`${view}-pbr`,{mode:'pbr'});
  const ids=await shot(`${view}-ids`,{mode:'ids'});
  const white=await shot(`${view}-white`,{mode:'white'});
  const counts=Object.fromEntries(Object.keys(palette).map(l=>[l,0]));let edgePixels=0,whiteFull=0,black=0;
  for(let k=0;k<ids.pixels.length;k+=4){
   const pixel=Array.from(ids.pixels.slice(k,k+3),x=>Math.round(x*255));
   const found=bytes.find(([,p])=>p.every((x,i)=>Math.abs(x-pixel[i])<=1));
   if(found)counts[found[0]]++;
   else if(pixel.every(x=>x===0))black++;else edgePixels++;
   if([0,1,2].every(i=>white.pixels[k+i]>.999))whiteFull++;
  }
  report.views[view]={counts,edgePixels,whiteFull,black};
  if(process.env.LAYER_NO_AA==='1'){
   assert.equal(edgePixels,0,'Single-sample identity image must contain only palette or black');
   assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),whiteFull,'Layer IDs must partition the white hair mask exactly');
   for(let k=0;k<ids.pixels.length;k+=4)assert.equal([0,1,2].some(i=>ids.pixels[k+i]>0),white.pixels[k]>.999);
  }
  if(process.env.LAYER_ABLATIONS==='1'){
   report.views[view].ablations={};
   for(const omit of [['root'],['underlayer'],['root','underlayer'],['surface'],['fringe']]){
    const name=omit.join('-');
    await shot(`${view}-omit-${name}`,{mode:'pbr',omit});
    const reduced=await shot(`${view}-omit-${name}-white`,{mode:'white',omit});
    let lostFull=0,openedBlack=0;
    for(let k=0;k<white.pixels.length;k+=4){
     if([0,1,2].every(i=>white.pixels[k+i]>.999)){
      if([0,1,2].some(i=>reduced.pixels[k+i]<=.999))lostFull++;
      if([0,1,2].every(i=>reduced.pixels[k+i]===0))openedBlack++;
     }
    }
    report.views[view].ablations[name]={lostFull,openedBlack};
   }
   await shot(`${view}-root-only`,{mode:'pbr',only:['root']});
  }
  // Full layer removal is a liveness control: black figure/background must leave zero hair IDs.
  const absent=await shot(`${view}-no-hair`,{mode:'ids',only:[]});
  assert.ok(absent.pixels.every((x,i)=>i%4===3||x===0));
  // PBR restoration must reproduce the first capture after index/material changes.
  const restored=await shot(`${view}-restored`,{mode:'pbr'});
  assert.deepEqual(restored.pixels,decodePng(fs.readFileSync(path.join(root,`${view}-pbr.png`))).pixels);
 }
 assert.deepEqual(report.errors,[]);report.controlsPassed=true;
 console.log(JSON.stringify(report,null,2));
}catch(error){report.error=error.stack;throw error;}finally{
 fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();
}
