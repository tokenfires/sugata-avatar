import * as THREE from 'three';
const canvas=document.querySelector('canvas');
const status=document.querySelector('#status');
const record=document.querySelector('#observed-record');
let renderer,geometry,materials=[];
let observed={ready:false,error:null,draws:[]};
const lifetime={closed:false,reason:null,attempts:[]};
function publish(){record.textContent=JSON.stringify({...observed,lifetime});}
function cleanup(reason){
  if(lifetime.closed)return;
  lifetime.closed=true;lifetime.reason=reason;
  for(const [name,owner] of [['geometry',geometry],...materials.map((m,i)=>[`material${i}`,m]),['renderer',renderer]]){
    const attempt={name,present:!!owner,error:null};
    try{owner?.dispose();}catch(error){attempt.error=String(error);}
    lifetime.attempts.push(attempt);
  }
  publish();
}
addEventListener('pagehide',()=>cleanup('pagehide'),{once:true});
try{
  const response=await fetch('./export/mesh.json');
  if(!response.ok)throw new Error(`Mesh retrieval ${response.status}`);
  const bytes=await response.arrayBuffer();
  const meshSha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(lifetime.closed)throw new Error('Closed during loading');
  const mesh=JSON.parse(new TextDecoder().decode(bytes));
  const indices=mesh.quads.flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]]);
  geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.positions.flat(),3));
  geometry.setIndex(indices);
  mesh.regions.forEach((r,i)=>geometry.addGroup(i*6,6,r==='waistband'?0:1));
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  materials=[0x516070,0x69727a].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,side:THREE.DoubleSide}));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x192b32);
  scene.add(new THREE.Mesh(geometry,materials));
  scene.add(new THREE.HemisphereLight(0xe5edf5,0x56696c,2.1));
  const key=new THREE.DirectionalLight(0xfff1dc,3.2);key.position.set(-1,2,3);scene.add(key);
  const fill=new THREE.DirectionalLight(0xc8dfff,1.1);fill.position.set(1,1,-2);scene.add(fill);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(1);renderer.setSize(1180,640,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.setScissorTest(true);
  const views=[['front',[0,2.4,10]],['profile',[10,2.4,0]],['back',[0,2.4,-10]]];
  const boxes=[[0,0,393,640],[393,0,393,640],[786,0,394,640]];
  observed={ready:false,error:null,meshSha,vertices:mesh.positions.length,quads:mesh.quads.length,triangles:indices.length/3,bounds:geometry.boundingBox,viewport:[1180,640],pixelRatio:1,limits:mesh.limits,draws:[]};
  for(let i=0;i<views.length;i++){
    const [view,position]=views[i];const [x,y,width,height]=boxes[i];const aspect=width/height;
    const camera=new THREE.OrthographicCamera(-2.25*aspect,2.25*aspect,2.25,-2.25,.1,20);
    camera.position.set(...position);camera.lookAt(0,2.4,0);camera.updateMatrixWorld();
    renderer.setViewport(x,y,width,height);renderer.setScissor(x,y,width,height);renderer.render(scene,camera);
    observed.draws.push({view,position,target:[0,2.4,0],up:[0,1,0],verticalHalfExtent:2.25,near:.1,far:20,viewport:boxes[i]});
  }
  observed.ready=true;publish();status.textContent='Artist mesh ready · fixed front / profile / back';
}catch(error){observed.error=String(error);status.textContent=`Study stopped: ${error.message}`;cleanup('error');publish();}
