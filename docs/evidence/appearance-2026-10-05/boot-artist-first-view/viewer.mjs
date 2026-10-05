import * as THREE from 'three';
const stage=document.querySelector('#stage'),status=document.querySelector('#status'),record=document.querySelector('#record');
const owners=[],lifetime={closed:false,reason:null,attempts:[]};
let observed={error:null,draws:0};
function publish(){record.textContent=JSON.stringify({...observed,lifetime},null,2);}
function cleanup(reason){
  if(lifetime.closed)return;
  lifetime.closed=true;lifetime.reason=reason;
  for(const [name,owner] of owners){
    const attempt={name,error:null};
    try{owner.dispose();}catch(error){attempt.error=String(error);}
    lifetime.attempts.push(attempt);
  }
  publish();
}
addEventListener('pagehide',()=>cleanup('pagehide'),{once:true});
try{
  const response=await fetch('./export/mesh.json');
  if(!response.ok)throw new Error(`Mesh retrieval ${response.status}`);
  const bytes=await response.arrayBuffer();
  if(lifetime.closed)throw new Error('Study closed while loading');
  const meshSha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(lifetime.closed)throw new Error('Study closed during checksum');
  const mesh=JSON.parse(new TextDecoder().decode(bytes));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xd1cec7);
  const colors=new Map(),renderedParts=[];
  for(const part of mesh.parts){
    if(!part.visible)continue;
    if(!colors.has(part.color)){
      const material=new THREE.MeshStandardMaterial({color:part.color,roughness:.78,metalness:0,side:THREE.FrontSide});
      owners.push([`material ${part.color}`,material]);colors.set(part.color,material);
    }
    const geometry=new THREE.BufferGeometry();owners.push([`geometry ${part.id}`,geometry]);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.positions.flat(),3));
    geometry.setIndex(part.face_ids.flatMap(i=>mesh.triangles[i]));geometry.computeVertexNormals();
    const object=new THREE.Mesh(geometry,colors.get(part.color));object.name=part.id;scene.add(object);renderedParts.push(part.id);
  }
  scene.add(new THREE.HemisphereLight(0xf3f0e8,0x66615b,2));
  const key=new THREE.DirectionalLight(0xffedd8,2.5);key.position.set(-2,4,4);scene.add(key);
  const fill=new THREE.DirectionalLight(0xdde8f1,1);fill.position.set(3,2,-3);scene.add(fill);
  const renderer=new THREE.WebGLRenderer({canvas:stage.querySelector('canvas'),antialias:true,alpha:false});
  owners.push(['renderer',renderer]);renderer.setPixelRatio(1);renderer.setSize(stage.clientWidth,stage.clientHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const box=new THREE.Box3();for(const p of mesh.positions)box.expandByPoint(new THREE.Vector3(...p));
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const width=stage.clientWidth,height=stage.clientHeight,panel=Math.floor(width/3),aspect=panel/height;
  const half=Math.max(size.y/2,Math.max(size.x,size.z)/2/aspect)*1.18;
  const views={front:[center.x,center.y+.35,center.z+4],profile:[center.x+4,center.y+.35,center.z],rear:[center.x,center.y+.35,center.z-4]};
  observed={error:null,meshSha,vertices:mesh.positions.length,triangles:mesh.triangles.length,parts:mesh.parts.length,
    renderedParts,excludedParts:mesh.parts.filter(p=>!p.visible).map(p=>p.id),viewport:[width,height],
    bounds:{min:box.min.toArray(),max:box.max.toArray()},draws:0,
    camera:{halfVertical:half,near:.1,far:10,target:center.toArray(),views},
    material:'Fixed brown upper/counter/front facing, tan laces and darker sole/heel clay',limits:mesh.limits};
  renderer.setScissorTest(true);
  for(const [i,[name,position]] of Object.entries(views).entries()){
    const x=i*panel,w=i===2?width-x:panel;renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);
    const camera=new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.1,10);
    camera.position.set(...position);camera.lookAt(center);camera.updateMatrixWorld();renderer.render(scene,camera);observed.draws++;
  }
  status.textContent='Ready · original paired source · three fixed views · unitless';publish();
}catch(error){observed.error=String(error);status.textContent=`Study stopped: ${error.message}`;cleanup('error');publish();}
