import * as THREE from '/@fs/Users/robault/GitHub/sugata-avatar/node_modules/three/build/three.module.js';

const status=document.querySelector('#status'),canvas=document.querySelector('#garment');
let active=true,renderer=null;
const controller=new AbortController(),geometries=[],materials=[];
const timeout=setTimeout(()=>controller.abort('first-view-load-budget'),10000);
const requireValue=(test,message)=>{if(!test)throw Error(message);};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
function dispose(){
  if(!active)return;active=false;clearTimeout(timeout);controller.abort('page-collected');
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();if(renderer)renderer.dispose();
}
addEventListener('pagehide',dispose,{once:true});
function makeGeometry(positions,triangles){
  requireValue(active,'page closed before allocation');
  const g=new THREE.BufferGeometry();geometries.push(g);
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));g.setIndex(triangles.flat());g.computeVertexNormals();
  return g;
}
function makeMesh(geometry,colour){
  requireValue(active,'page closed before material');
  const material=new THREE.MeshStandardMaterial({color:colour,roughness:1,metalness:0,side:THREE.DoubleSide});materials.push(material);
  return new THREE.Mesh(geometry,material);
}
async function read(url,maxBytes){
  const response=await fetch(url,{signal:controller.signal,cache:'no-store'});requireValue(response.ok,'required source response');
  const length=Number(response.headers.get('Content-Length')||0);requireValue(length<=maxBytes,'declared response byte cap');
  const bytes=await response.arrayBuffer();requireValue(bytes.byteLength<=maxBytes,'actual response byte cap');return bytes;
}
(async()=>{
  requireValue(THREE.REVISION==='185','unexpected Three revision');
  const admission=JSON.parse(new TextDecoder().decode(await read('NATIVE-ADMISSION.json',65536)));
  const issued=Date.parse(admission.issuedUTC),deadline=Date.parse(admission.deadlineUTC);
  requireValue(admission.contract==='sage-shirt-first-three-view-v1'&&admission.allowance===1&&Number.isFinite(issued)&&Number.isFinite(deadline)&&Date.now()>=issued&&Date.now()-issued<120000&&Date.now()<deadline,'no finite fresh first-view admission');
  const bytes=await read('trial-001/model.json',1048576),hash=await digest(bytes);
  requireValue(active&&hash===admission.modelSHA256,'model association refused');
  const model=JSON.parse(new TextDecoder().decode(bytes));
  requireValue(model.schema==='sage-shirt-artist-mesh-1'&&model.positions.length===1458&&model.quads.length===1392&&model.buttons.length===4,'saved mesh scope');
  requireValue(model.positions.every(p=>p.length===3&&p.every(Number.isFinite)),'nonfinite mesh positions');
  requireValue(model.quads.every(f=>f.v.length===4&&f.v.every(i=>Number.isInteger(i)&&i>=0&&i<1458)),'mesh index scope');
  requireValue(model.buttons.every(b=>b.positions.length===17&&b.triangles.length===16&&b.positions.every(p=>p.length===3&&p.every(Number.isFinite))&&b.triangles.every(t=>t.length===3&&t.every(i=>Number.isInteger(i)&&i>=0&&i<17))),'decorative disc scope');
  const features=[...new Set(model.quads.map(f=>f.feature))];requireValue(features.length===9&&features.every(f=>/^#[0-9a-f]{6}$/i.test(model.palette[f])),'material feature scope');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#fbfaf5');
  scene.add(new THREE.AmbientLight(0xffffff,1.4));
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(2,4,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,1.5);fill.position.set(-3,2,-4);scene.add(fill);
  for(const feature of features){
    const triangles=model.quads.filter(f=>f.feature===feature).flatMap(f=>[[f.v[0],f.v[1],f.v[2]],[f.v[0],f.v[2],f.v[3]]]);
    scene.add(makeMesh(makeGeometry(model.positions,triangles),model.palette[feature]));
  }
  for(const b of model.buttons)scene.add(makeMesh(makeGeometry(b.positions,b.triangles),model.palette.buttons));
  requireValue(active,'closed page before renderer');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);renderer.setSize(1200,440,false);renderer.setScissorTest(true);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const cameras=[new THREE.Vector3(0,.7,4),new THREE.Vector3(4,.7,0),new THREE.Vector3(0,.7,-4)];
  for(let i=0;i<3;i++){
    requireValue(active,'closed page before render');
    const camera=new THREE.OrthographicCamera(-1.25,1.25,1.375,-1.375,.1,10);camera.position.copy(cameras[i]);camera.lookAt(0,.7,0);
    renderer.setViewport(i*400,0,400,440);renderer.setScissor(i*400,0,400,440);renderer.render(scene,camera);
  }
  requireValue(active&&Date.now()<deadline,'view finished after closure/deadline');clearTimeout(timeout);
  status.textContent='First three views rendered · saved source '+hash.slice(0,12);
  status.dataset.complete='true';status.dataset.modelSha256=hash;status.dataset.views='3';status.dataset.triangles='2848';
})().catch(error=>{if(active){status.textContent='First view stopped: '+String(error);status.dataset.failed='true';console.error('Sage first view stopped',String(error));dispose();}});
