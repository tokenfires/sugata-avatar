import * as THREE from 'three';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const record = document.querySelector('#record');
const owners = [];
const lifetime = {closed:false, reason:null, attempts:[]};
let observed = {error:null, draws:0};
function publish(){ record.textContent = JSON.stringify({...observed,lifetime},null,2); }
function cleanup(reason){
  if(lifetime.closed) return;
  lifetime.closed = true; lifetime.reason = reason;
  for(const [name, owner] of owners){
    const attempt = {name,error:null};
    try{owner.dispose();}catch(error){attempt.error=String(error);}
    lifetime.attempts.push(attempt);
  }
  publish();
}
addEventListener('pagehide',()=>cleanup('pagehide'),{once:true});
try{
  const response = await fetch('./export/mesh.json');
  if(!response.ok) throw new Error(`Mesh retrieval ${response.status}`);
  const bytes = await response.arrayBuffer();
  if(lifetime.closed) throw new Error('Study closed while loading');
  const meshSha = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const mesh = JSON.parse(new TextDecoder().decode(bytes));
  const geometry = new THREE.BufferGeometry(); owners.push(['geometry',geometry]);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.positions.flat(),3));
  geometry.setIndex(mesh.quads.flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]]));
  geometry.computeVertexNormals(); geometry.computeBoundingBox();
  const outer = new THREE.MeshStandardMaterial({color:0x727955,roughness:1,metalness:0,side:THREE.FrontSide});
  owners.push(['outer material',outer]);
  const inner = new THREE.MeshStandardMaterial({color:0x3d4634,roughness:1,metalness:0,side:THREE.BackSide});
  owners.push(['inner material',inner]);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x192b27);
  scene.add(new THREE.Mesh(geometry,outer),new THREE.Mesh(geometry,inner));
  scene.add(new THREE.HemisphereLight(0xe6ece1,0x4f6055,2.0));
  const key = new THREE.DirectionalLight(0xfff1da,3); key.position.set(-2,3,4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xd6e6f1,1.4); fill.position.set(3,2,-3); scene.add(fill);
  const renderer = new THREE.WebGLRenderer({canvas:stage.querySelector('canvas'),antialias:true,alpha:false});
  owners.push(['renderer',renderer]);
  renderer.setPixelRatio(1); renderer.setSize(stage.clientWidth,stage.clientHeight,false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const box = geometry.boundingBox, center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const height = stage.clientHeight, width = stage.clientWidth;
  const panel = Math.floor(width/3), aspect = panel/height;
  // Same predeclared scale in every view, fit once from first bounds, no tuning UI.
  const half = Math.max(size.y/2,Math.max(size.x,size.z)/2/aspect)*1.16;
  const views = {front:[center.x,center.y,center.z+4],profile:[center.x+4,center.y,center.z],rear:[center.x,center.y,center.z-4]};
  observed = {error:null,meshSha,vertices:mesh.positions.length,quads:mesh.quads.length,triangles:mesh.quads.length*2,
    viewport:[width,height],bounds:{min:box.min.toArray(),max:box.max.toArray()},draws:0,
    camera:{halfVertical:half,near:.1,far:10,target:center.toArray(),views},material:'Olive outer clay / darker inner clay',limits:mesh.limits};
  renderer.setScissorTest(true);
  for(const [i,[name,position]] of Object.entries(views).entries()){
    const x = i*panel, w = i === 2 ? width-x : panel;
    renderer.setViewport(x,0,w,height); renderer.setScissor(x,0,w,height);
    const camera = new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.1,10);
    camera.position.set(...position); camera.lookAt(center); camera.updateMatrixWorld();
    renderer.render(scene,camera); observed.draws++;
  }
  status.textContent = `Ready · three fixed views · ${observed.vertices} vertices / ${observed.quads} quads · unitless`;
  publish();
}catch(error){
  observed.error = String(error); status.textContent = `Study stopped: ${error.message}`;
  cleanup('error'); publish();
}
