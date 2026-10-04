import * as THREE from 'three';

const ORIGINAL='2844465f4e798666a90f631ea4a89ae30d3e526ef045a978d338908750d21d09';
const PREVIEW='36c046e92e781f1b2359223ed04989e28e40463f65a83a1a4ea8433533c12065';
const DEADLINE=Date.parse('2026-10-04T12:50:00Z');
const surface=document.querySelector('#surface'),status=document.querySelector('#status'),receipt=document.querySelector('#receipt');
const buttons=[...document.querySelectorAll('[data-view]')],disposeButton=document.querySelector('#dispose');
const report={started:new Date().toISOString(),phase:'loading',sourceUnits:'unknown',originalSha256:ORIGINAL,previewSha256:PREVIEW,knownOpening:[935,39,1010,934],limit:'Visual source-reference diagnostic only; original complete-control B remains unchanged.',resources:[],cleanup:[],views:{},capturesExpected:4};
const owners=[],abort=new AbortController();let closed=false,scene=null,renderer=null,camera=null;
const publish=()=>{receipt.textContent=JSON.stringify(report,null,2);};
const check=()=>{if(closed)throw new Error('diagnostic closed');if(Date.now()>=DEADLINE)throw new Error('absolute deadline reached');};
const assert=(okay,message,witness={})=>{if(!okay){const e=new Error(message);e.witness=witness;throw e;}};
const own=(name,dispose)=>{owners.push({name,dispose});report.resources.push(name);};
const cleanup=reason=>{
  if(closed)return;closed=true;abort.abort();
  for(const owner of [...owners].reverse())try{owner.dispose();report.cleanup.push({name:owner.name,okay:true});}catch(e){report.cleanup.push({name:owner.name,okay:false,message:e.message});}
  report.phase='disposed';report.closedAt=new Date().toISOString();report.closedReason=reason;
  buttons.forEach(b=>b.disabled=true);disposeButton.disabled=true;status.textContent='Diagnostic disposed';publish();
};
addEventListener('pagehide',()=>cleanup('pagehide'),{once:true});
disposeButton.addEventListener('click',()=>cleanup('explicit dispose'));
const hash=async bytes=>{check();const digest=await crypto.subtle.digest('SHA-256',bytes);check();return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');};
const load=async(url,expected)=>{
  check();const response=await fetch(url,{cache:'no-store',signal:abort.signal});check();assert(response.ok,'input HTTP failure',{url,status:response.status});
  const bytes=await response.arrayBuffer();check();const actual=await hash(bytes);check();assert(actual===expected,'input SHA mismatch',{url,expected,actual});return bytes;
};
const fail=e=>{report.failure={message:e.message,witness:e.witness??null,utc:new Date().toISOString()};cleanup('failure');status.textContent='Diagnostic refused: '+e.message;publish();};

async function start(){
  const originalBytes=await load(new URL('../knit-upstream-source/original-fisherman.obj',import.meta.url),ORIGINAL);check();
  assert(originalBytes.byteLength===172798,'original byte length mismatch',{bytes:originalBytes.byteLength});
  const previewBytes=await load(new URL('../knit-original-control/preview.json',import.meta.url),PREVIEW);check();
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(previewBytes));
  assert(data.original.sha256===ORIGINAL&&data.original.bytes===172798,'preview source binding mismatch');
  assert(data.vertices.length===2126&&data.faces.length===2082&&data.triangles.length===4164&&data.triangleMap.length===4164,'source counts mismatch');
  assert(data.normals.length===0,'original normal absence changed');
  const positions=new Float32Array(data.vertices.length*3),indices=new Uint32Array(data.triangles.length*3);let castError=0,minDisplayArea=Infinity;
  for(let i=0;i<data.vertices.length;i++){
    const v=data.vertices[i];assert(Array.isArray(v)&&v.length===3&&v.every(Number.isFinite),'invalid original position',{i,v});
    for(let k=0;k<3;k++){positions[3*i+k]=v[k];assert(Number.isFinite(positions[3*i+k]),'nonfinite Float32 position',{i,k,value:v[k]});castError=Math.max(castError,Math.abs(positions[3*i+k]-v[k]));}
  }
  for(let i=0;i<data.triangles.length;i++){
    const triangle=data.triangles[i],map=data.triangleMap[i],face=data.faces[map.face];
    assert(face&&face.ordinal===map.face&&face.line===map.line&&triangle.length===3&&map.cornerOrdinals.length===3,'source triangle map mismatch',{i,map});
    for(let k=0;k<3;k++){const index=triangle[k];assert(Number.isInteger(index)&&index>=0&&index<data.vertices.length&&face.corners[map.cornerOrdinals[k]]?.v===index,'source corner/index mismatch',{i,k,index,map});indices[3*i+k]=index;}
    const p=triangle.map(j=>[positions[j*3],positions[j*3+1],positions[j*3+2]]),a=p[1].map((x,k)=>x-p[0][k]),b=p[2].map((x,k)=>x-p[0][k]);
    const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],area=Math.hypot(...cross);
    assert(Number.isFinite(area)&&area>0,'Float32 display triangle degenerate',{i,map,triangle,points:p,cross,area});minDisplayArea=Math.min(minDisplayArea,area);
  }
  report.buffers={positionsSha256:await hash(positions.buffer)};check();report.buffers.indicesSha256=await hash(indices.buffer);check();
  report.buffers.vertices=data.vertices.length;report.buffers.triangles=data.triangles.length;report.buffers.maxFloat32CastError=castError;report.buffers.minFloat32TwiceArea=minDisplayArea;
  const min=[0,1,2].map(k=>Math.min(...data.vertices.map(v=>v[k]))),max=[0,1,2].map(k=>Math.max(...data.vertices.map(v=>v[k]))),center=min.map((v,k)=>(v+max[k])/2);
  report.displayTransform={translation:center.map(v=>-v),rotation:[0,0,0],scale:[1,1,1],sourcePositionsUnchanged:true};report.sourceBounds={min,max};
  check();scene=new THREE.Scene();scene.background=new THREE.Color('#f1efe8');own('scene clear',()=>scene.clear());
  const geometry=new THREE.BufferGeometry();own('geometry',()=>geometry.dispose());geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();
  const normals=geometry.getAttribute('normal');assert(normals&&[...normals.array].every(Number.isFinite),'nonfinite derived display normals');report.displayNormals='Three indexed area-weighted derived normals from fixed fans, without altering original positions/faces/UVs/winding';
  const material=new THREE.MeshStandardMaterial({color:0xc4c7cf,roughness:.88,metalness:0,side:THREE.FrontSide});own('material',()=>material.dispose());
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...center.map(v=>-v));scene.add(mesh);
  scene.add(new THREE.AmbientLight(0xffffff,.55));const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(7,9,12);scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,.55);fill.position.set(-7,3,-12);scene.add(fill);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});own('renderer dispose',()=>renderer.dispose());own('renderer context',()=>renderer.forceContextLoss());own('canvas remove',()=>renderer.domElement.remove());
  const width=surface.clientWidth,height=surface.clientHeight;assert(width>0&&height>0,'empty display',{width,height});renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;surface.append(renderer.domElement);
  report.viewport={cssWidth:width,cssHeight:height,drawingWidth:renderer.domElement.width,drawingHeight:renderer.domElement.height,devicePixelRatio,rendererPixelRatio:1,windowWidth:innerWidth,windowHeight:innerHeight};
  const aspect=width/height,diagonal=Math.hypot(...min.map((v,k)=>max[k]-v)),distance=2*diagonal,directions={'+Z':[0,0,1],'+X':[1,0,0],'−Z':[0,0,-1],XZ:[Math.SQRT1_2,0,Math.SQRT1_2]};
  for(const [label,direction]of Object.entries(directions)){
    const right=[direction[2],0,-direction[0]];let x=0,y=0;for(const v of data.vertices){const p=v.map((n,k)=>n-center[k]);x=Math.max(x,Math.abs(p.reduce((s,n,k)=>s+n*right[k],0)));y=Math.max(y,Math.abs(p[1]));}
    const halfHeight=1.08*Math.max(y,x/aspect);report.views[label]={direction,right,position:direction.map(v=>distance*v),target:[0,0,0],up:[0,1,0],left:-halfHeight*aspect,rightExtent:halfHeight*aspect,top:halfHeight,bottom:-halfHeight,near:.01,far:distance+2*diagonal,margin:1.08};
  }
  camera=new THREE.OrthographicCamera();
  const show=label=>{
    check();const view=report.views[label];assert(view,'unknown fixed view',{label});camera.position.set(...view.position);camera.up.set(...view.up);camera.lookAt(...view.target);
    Object.assign(camera,{left:view.left,right:view.rightExtent,top:view.top,bottom:view.bottom,near:view.near,far:view.far});camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.render(scene,camera);
    report.phase='ready';report.view=label;report.lastRenderedAt=new Date().toISOString();buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===label)));status.textContent='Ready · source-axis '+label;publish();
  };
  for(const button of buttons){button.disabled=false;button.addEventListener('click',()=>{try{show(button.dataset.view);}catch(e){fail(e);}});}
  disposeButton.disabled=false;check();show('+Z');
}
start().catch(e=>{if(closed){report.lateAfterClose={message:e.message,utc:new Date().toISOString()};publish();}else fail(e);});
