import * as THREE from 'three';
const stage=document.querySelector('#stage'),status=document.querySelector('#status'),record=document.querySelector('#record');
const controller=new AbortController(),owners=[],lifetime={closed:false,reason:null,attempts:[]};
let observed={error:null,ready:false,draws:0};
const publish=()=>{record.textContent=JSON.stringify({...observed,lifetime},null,2);};
function cleanup(reason){
  if(lifetime.closed)return;
  lifetime.closed=true;lifetime.reason=reason;controller.abort();
  for(const [name,resource] of owners){
    const entry={name,error:null};
    try{resource.dispose();}catch(error){entry.error=String(error);}
    lifetime.attempts.push(entry);
  }
  status.textContent='Finished · owned disposal attempted';publish();
}
document.querySelector('#finish').addEventListener('click',()=>cleanup('Finish button'),{once:true});
addEventListener('pagehide',()=>cleanup('pagehide'),{once:true});
function guard(){if(lifetime.closed)throw new Error('Review closed before source allocation');}
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
try{
  const response=await fetch('./export/mesh.json',{signal:controller.signal});guard();
  if(!response.ok)throw new Error('Original retrieval '+response.status);
  const bytes=await response.arrayBuffer();guard();
  const meshSha=await sha(bytes);guard();
  const source=JSON.parse(new TextDecoder().decode(bytes));
  if(source.schema!=='sugata-original-artist-groom-1')throw new Error('Wrong source schema');
  const positions=new Float32Array(source.positions.flat());
  const positionSha=await sha(positions.buffer);guard();
  const actual=[];
  for(const part of source.parts){
    const index=new Uint32Array(part.face_ids.flatMap(i=>source.triangles[i]));
    const indexSha=await sha(index.buffer);guard();
    actual.push({part,index,indexSha});
  }
  // Every await has completed and closure was checked before native allocations.
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xc9c7be);
  const materials=new Map();
  for(const {part,index} of actual){
    if(!materials.has(part.color)){
      const material=new THREE.MeshStandardMaterial({color:part.color,roughness:.68,metalness:0,side:THREE.FrontSide});
      owners.push(['material '+part.color,material]);materials.set(part.color,material);
    }
    const geometry=new THREE.BufferGeometry();owners.push(['geometry '+part.id,geometry]);
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.computeVertexNormals();
    const object=new THREE.Mesh(geometry,materials.get(part.color));object.name=part.id;scene.add(object);
  }
  scene.add(new THREE.HemisphereLight(0xf6f1e4,0x635f58,2));
  const key=new THREE.DirectionalLight(0xffecd6,2.5);key.position.set(-3,5,4);scene.add(key);
  const fill=new THREE.DirectionalLight(0xe0ebf5,1.4);fill.position.set(3,2,-4);scene.add(fill);
  const renderer=new THREE.WebGLRenderer({canvas:stage.querySelector('canvas'),antialias:true,alpha:false});
  owners.push(['renderer',renderer]);renderer.setPixelRatio(1);
  const width=stage.clientWidth,height=stage.clientHeight;renderer.setSize(width,height,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const box=new THREE.Box3();for(const p of source.positions)box.expandByPoint(new THREE.Vector3(...p));
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const pw=Math.floor(width/2),ph=Math.floor(height/2),aspect=pw/ph;
  const half=Math.max(size.x,size.y,size.z)/2*1.26;
  const views=[['front',[0,0,5],[0,1,0]],['profile',[5,0,0],[0,1,0]],['rear',[0,0,-5],[0,1,0]],['top',[0,5,0],[0,0,-1]]];
  observed={error:null,ready:false,meshSha,positionSha,id:source.id,schema:source.schema,vertices:source.positions.length,triangles:source.triangles.length,roots:source.roots.length,scalpFaces:source.scalp.head_face_ids.length,
    parts:actual.map(({part,index,indexSha})=>({id:part.id,kind:part.kind,color:part.color,vertices:part.vertex_ids.length,triangles:part.face_ids.length,indexCount:index.length,indexSha,positionSha})),
    stage:[width,height],bounds:{min:box.min.toArray(),max:box.max.toArray()},views:[],draws:0,limits:source.limits,material:'Fixed brown volume clay; grey fictional reference; no strand shader'};
  renderer.setScissorTest(true);
  for(let i=0;i<views.length;i++){
    const [name,delta,up]=views[i];const x=i%2*pw,y=i<2?ph:0,w=i%2===1?width-pw:pw,h=i<2?height-ph:ph;
    renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
    const camera=new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.1,12);
    camera.position.copy(center).add(new THREE.Vector3(...delta));camera.up.set(...up);camera.lookAt(center);camera.updateMatrixWorld();
    renderer.render(scene,camera);observed.draws++;
    observed.views.push({name,viewport:[x,y,w,h],position:camera.position.toArray(),up:camera.up.toArray(),target:center.toArray(),halfVertical:half,near:.1,far:12,matrixWorld:camera.matrixWorld.toArray(),projectionMatrix:camera.projectionMatrix.toArray()});
  }
  observed.ready=true;status.textContent='Ready · original source · four fixed views · unitless';publish();
}catch(error){observed.error=String(error);cleanup('error');publish();}
