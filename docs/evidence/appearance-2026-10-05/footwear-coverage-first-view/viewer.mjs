import * as THREE from '../../../../node_modules/three/build/three.module.js';
const stage=document.querySelector('#stage'),status=document.querySelector('#status');
const evidence=window.guideObservation={phase:'loading',error:null,disposeAttempts:[],scope:'saved source intent only'};
let alive=true,finished=false;const owners=[];
function own(resource,name){owners.push({resource,name});return resource;}
function finish(){
  if(finished)return;finished=true;alive=false;
  for(const {resource,name} of owners){try{resource.dispose();evidence.disposeAttempts.push({name,returned:true});}catch(err){evidence.disposeAttempts.push({name,returned:false,error:String(err)});}}
  evidence.phase='finished';status.textContent='Finished — disposal attempts recorded; GPU retirement unmeasured.';
}
window.addEventListener('pagehide',finish,{once:true});document.querySelector('#finish').addEventListener('click',finish);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
async function load(){
  const response=await fetch('./guide.json');if(!response.ok)throw Error(`guide HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();if(!alive)return;
  const sha=await digest(bytes);if(!alive)return;
  const guide=JSON.parse(new TextDecoder().decode(bytes));
  const buffers=new Map();
  function push(name,points){if(!buffers.has(name))buffers.set(name,[]);buffers.get(name).push(...points.flat());}
  for(const rec of guide.records){
    for(const [role,poly] of [[rec.belowSide,rec.below],['outside',rec.above]]){
      if(!poly.length)continue;
      for(let i=1;i<poly.length-1;i++)push(`${rec.owner}.${role}`,[poly[0].p,poly[i].p,poly[i+1].p]);
    }
    if(rec.degenerate){const o=guide.owners[rec.owner];push(`${rec.owner}.degenerate`,o.triangles[rec.triangle].map(i=>o.positions[i]));}
  }
  const draws=[];
  for(const [name,values] of buffers){
    const position=new Float32Array(values);const hash=await digest(position.buffer);if(!alive)return;
    draws.push({name,position,hash});
  }
  const traceArray=new Float32Array(guide.traces.flatMap(tr=>tr.ends.flatMap(e=>e.p)));
  const traceSHA=await digest(traceArray.buffer);if(!alive)return;
  // All asynchronous work precedes GPU allocation; every returned resource is immediately registered.
  const renderer=own(new THREE.WebGLRenderer({antialias:true,alpha:false}),'renderer');
  renderer.setPixelRatio(1);renderer.setSize(stage.clientWidth,stage.clientHeight,false);stage.append(renderer.domElement);
  renderer.setScissorTest(true);renderer.setClearColor(0x1a2026,1);
  const materials=new Map();
  function material(role,owner){
    const key=role==='outside'?`${role}.${owner}`:role;
    if(!materials.has(key)){
      const color=role==='-X'?0x30b9c2:role==='+X'?0x638df0:role==='degenerate'?0x7a818b:guide.owners[owner].key==='bra'?0x927da0:guide.owners[owner].key==='briefs'?0xa09ab0:0xbba58f;
      materials.set(key,own(new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,side:THREE.DoubleSide}),`material.${key}`));
    }return materials.get(key);
  }
  const geometry=draws.map(draw=>{
    const geo=own(new THREE.BufferGeometry(),`geometry.${draw.name}`);geo.setAttribute('position',new THREE.BufferAttribute(draw.position,3));geo.computeVertexNormals();
    return {draw,geo};
  });
  const traceGeo=own(new THREE.BufferGeometry(),'trace.geometry');traceGeo.setAttribute('position',new THREE.BufferAttribute(traceArray,3));
  const traceMaterial=own(new THREE.LineBasicMaterial({color:0xffd15b,depthTest:false}),'trace.material');
  const width=stage.clientWidth,height=stage.clientHeight;const panelWidth=Math.floor(width/3);
  const definitions=[{name:'Full source front',bound:guide.fullBounds,offset:[0,.12,4],full:true},{name:'Lower region profile / oblique',bound:guide.belowBounds,offset:[4,.12,1],full:false},{name:'Full source rear',bound:guide.fullBounds,offset:[0,.12,-4],full:true}];
  const panels=[];
  for(let i=0;i<definitions.length;i++){
    const def=definitions[i],scene=new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff,0x59616d,2));const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(2,3,4);scene.add(key);
    const included=[];
    for(const {draw,geo} of geometry){const [owner,role]=draw.name.split('.');if(!def.full&&role!=='-X'&&role!=='+X')continue;scene.add(new THREE.Mesh(geo,material(role,Number(owner))));included.push(draw.name);}
    const trace=new THREE.LineSegments(traceGeo,traceMaterial);trace.renderOrder=10;scene.add(trace);
    const w=i===2?width-panelWidth*2:panelWidth,aspect=w/height;
    const target=new THREE.Vector3(...def.bound.min.map((v,k)=>(v+def.bound.max[k])/2));
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,20);camera.position.copy(target).add(new THREE.Vector3(...def.offset));camera.lookAt(target);camera.updateMatrixWorld(true);
    let extent=0;
    for(let bits=0;bits<8;bits++){
      const corner=new THREE.Vector3(...def.bound.min.map((v,k)=>(bits&(1<<k))?def.bound.max[k]:v));corner.applyMatrix4(camera.matrixWorldInverse);extent=Math.max(extent,Math.abs(corner.x)/aspect,Math.abs(corner.y));
    }
    const half=extent*1.18;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
    renderer.setViewport(panelWidth*i,0,w,height);renderer.setScissor(panelWidth*i,0,w,height);renderer.render(scene,camera);
    panels.push({name:def.name,full:def.full,bound:def.bound,included,viewport:[panelWidth*i,0,w,height],target:target.toArray(),half,aspect,position:camera.position.toArray(),matrixWorldInverse:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),near:.1,far:20});
  }
  evidence.phase='ready';evidence.guideSHA256=sha;evidence.sourceLedger=guide.ledger;evidence.originalOwners=guide.owners.map(o=>({key:o.key,name:o.name,vertices:o.vertexIDs.length,triangles:o.triangleIDs.length}));
  evidence.groups=draws.map(d=>({name:d.name,vertices:d.position.length/3,positionSHA256:d.hash}));evidence.trace={vertices:traceArray.length/3,positionSHA256:traceSHA};evidence.panels=panels;evidence.stage={width,height};evidence.resources=owners.map(o=>o.name);
  status.textContent='Ready — complete original source; blue/teal chosen region, yellow cut trace.';
}
load().catch(err=>{evidence.error=String(err);finish();evidence.phase='error';status.textContent=`Refused — ${err}`;});
