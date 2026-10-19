import * as THREE from 'three';

// Generic transport/fit-camera/lifetime pattern from frozen Mara viewer only. No Mara geometry/model/builder.
const start=document.querySelector('#start'),status=document.querySelector('#status'),record=document.querySelector('#record'),views=document.querySelector('#views');
let used=false;
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
start.addEventListener('click',async()=>{
  if(used)return;used=true;start.disabled=true;status.textContent='Producing the one admitted six-view packet…';
  const entered=performance.now(),controller=new AbortController(),geometries=[],materials=[];
  const result={schema:'Ari-first-bomber-six-view-result-v1',started_utc:new Date().toISOString(),views:[],cleanup:[],scope:'One original unitless standalone Ari jacket; component selections explicitly hide layers, no fit/cloth/rig/runtime/AAA qualification'};
  let closed=false,renderer,context,timer,headerTimer;
  const check=()=>{if(closed)throw Error('entry closed');if(performance.now()-entered>60000)throw Error('soft checked entry deadline');};
  function clean(reason) {
    if(closed)return;closed=true;clearTimeout(timer);clearTimeout(headerTimer);controller.abort();result.abortRequested=true;result.cleanupReason=reason;
    for(const [name,owner] of [...geometries.map((x,i)=>[`geometry${i}`,x]),...materials.map((x,i)=>[`material${i}`,x]),['renderer',renderer]]) {
      const r={name,present:!!owner,error:null};try{owner?.dispose();}catch(e){r.error=String(e);}result.cleanup.push(r);
    }
    result.contextLoss={available:false,requested:false,error:null};
    try{const ext=context?.getExtension('WEBGL_lose_context');result.contextLoss.available=!!ext;if(ext){ext.loseContext();result.contextLoss.requested=true;}}catch(e){result.contextLoss.error=String(e);}
  }
  const onHide=()=>clean('pagehide');window.addEventListener('pagehide',onHide,{once:true});
  timer=setTimeout(()=>clean('soft overall timer'),60000);
  async function get(name) {
    check();headerTimer=setTimeout(()=>controller.abort(),15000);let response;
    try{response=await fetch(new URL(name,import.meta.url),{signal:controller.signal,cache:'no-store'});}finally{clearTimeout(headerTimer);}
    check();if(!response.ok)throw Error(`HTTP${response.status}:${name}`);
    const bytes=await response.arrayBuffer();check();return bytes;
  }
  try {
    const admissionBytes=await get('GPU-ADMISSION.json'),admission=JSON.parse(new TextDecoder().decode(admissionBytes));
    if(Date.now()>Date.parse(admission.expires_utc)||Date.now()>Date.parse(admission.absolute_deadline_utc))throw Error('admission expired');
    result.admissionSHA256=await sha(admissionBytes);check();
    const bytes=await get('out/model.json');if(bytes.byteLength>8388608)throw Error('model byte cap');
    result.modelSHA256=await sha(bytes);check();if(result.modelSHA256!==admission.model_sha256)throw Error('model identity mismatch');
    const model=JSON.parse(new TextDecoder().decode(bytes));
    const counts={parts:model.parts.length,vertices:model.parts.reduce((s,p)=>s+p.vertices.length,0),triangles:model.parts.reduce((s,p)=>s+p.faces.length,0)};
    if(counts.parts>16||counts.vertices>16384||counts.triangles>32768)throw Error('geometry caps');result.counts=counts;
    const names=Object.keys(model.materials),mi=new Map(names.map((n,i)=>[n,i]));
    // No GPU owners before all asynchronous data/admission/hash checks complete.
    for(const name of names)materials.push(new THREE.MeshStandardMaterial({color:model.materials[name],roughness:0.9,metalness:0}));
    const meshes=new Map();const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9e0');const garment=new THREE.Group();scene.add(garment);
    for(const part of model.parts) {
      check();const g=new THREE.BufferGeometry();geometries.push(g);
      const faces=[...part.faces].sort((a,b)=>Number(!a.role.startsWith('bag_'))-Number(!b.role.startsWith('bag_'))||mi.get(a.material)-mi.get(b.material));
      g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(part.vertices.flat()),3));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(faces.flatMap(f=>f.v)),1));
      let first=0;for(let k=1;k<=faces.length;k++)if(k===faces.length||faces[k].material!==faces[first].material){g.addGroup(first*3,(k-first)*3,mi.get(faces[first].material));first=k;}
      g.computeVertexNormals();const mesh=new THREE.Mesh(g,materials);garment.add(mesh);meshes.set(part.id,{mesh,geometry:g,bagIndices:faces.filter(f=>f.role.startsWith('bag_')).length*3,allTriangles:faces.length});
    }
    scene.add(new THREE.HemisphereLight(0xfff7e9,0x645b50,2));
    const key=new THREE.DirectionalLight(0xffeed6,3);key.position.set(-100,180,160);scene.add(key);
    const fill=new THREE.DirectionalLight(0xd9e5ef,1.2);fill.position.set(140,80,-110);scene.add(fill);
    const canvas=document.createElement('canvas');context=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!context)throw Error('WebGL2 unavailable');
    renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(570,340,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    result.threeRevision=THREE.REVISION;result.contextAttributes=context.getContextAttributes();
    const box=new THREE.Box3().setFromObject(garment),center=box.getCenter(new THREE.Vector3()),corners=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).sub(center));
    const roles=[
      {id:'front',caption:'Whole jacket · front, separate zipper halves and short hem',direction:[0,0,1],mode:'assembly'},
      {id:'low-side',caption:'Whole jacket · low side oblique from +X, depth and open cuffs',direction:[1,-0.45,0],mode:'assembly'},
      {id:'rear',caption:'Whole jacket · rear shoulders, sleeves and short trim',direction:[0,0,-1],mode:'assembly'},
      {id:'lining-front',caption:'Layer study · shell hidden; lining, facings, collar and left guard',direction:[0.65,0.5,1.6],mode:'lining'},
      {id:'lining-rear',caption:'Layer study · shell hidden; back/sleeve lining and neck facing',direction:[-0.65,0.4,-1.6],mode:'lining'},
      {id:'outer-bags',caption:'Surface selection · only outer-mouth bag surfaces and mouth tapes; shell/lining hidden',direction:[0.35,0.5,1.6],mode:'bags'}
    ];
    let outputBytes=0;
    for(const role of roles) {
      check();const shown=[];let expectedTriangles=0;for(const [id,item]of meshes){item.geometry.setDrawRange(0,Infinity);item.mesh.visible=role.mode==='assembly'||(role.mode==='lining'&&['full_lining_and_facings','pointed_collar','left_guard_G_L','separate_zip_R','separate_zip_L'].includes(id))||(role.mode==='bags'&&(id==='shell_with_outer_bags'||id.startsWith('outer_mouth_')));if(role.mode==='bags'&&id==='shell_with_outer_bags')item.geometry.setDrawRange(0,item.bagIndices);if(item.mesh.visible){shown.push(id);expectedTriangles+=role.mode==='bags'&&id==='shell_with_outer_bags'?item.bagIndices/3:item.allTriangles;}}
      const dir=new THREE.Vector3(...role.direction).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize();
      const aspect=570/340,hx=Math.max(...corners.map(p=>Math.abs(p.dot(right)))),hy=Math.max(...corners.map(p=>Math.abs(p.dot(up)))),hh=Math.max(hy,hx/aspect)*1.12;
      const camera=new THREE.OrthographicCamera(-hh*aspect,hh*aspect,hh,-hh,0.1,1000);camera.position.copy(center).addScaledVector(dir,300);camera.up.copy(up);camera.lookAt(center);
      renderer.render(scene,camera);check();if(renderer.info.render.triangles!==expectedTriangles)throw Error('role triangle submission mismatch');const url=canvas.toDataURL('image/png'),n=atob(url.split(',')[1]).length;outputBytes+=n;if(outputBytes>16777216)throw Error('six-image byte ceiling');
      const figure=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=role.caption;img.src=url;img.alt=role.caption;img.width=570;img.height=340;img.dataset.role=role.id;figure.append(caption,img);views.append(figure);
      result.views.push({id:role.id,mode:role.mode,shownParts:shown,expectedTriangles,selection:'Original coordinates unchanged; explicit whole assembly/layer/face selections only',width:570,height:340,bytes:n,direction:dir.toArray(),up:up.toArray(),camera:camera.position.toArray(),halfHeight:hh,drawCalls:renderer.info.render.calls,submittedTriangles:renderer.info.render.triangles});
    }
    result.outputBytes=outputBytes;result.status='complete';result.checkedEntryMs=performance.now()-entered;
    clean('six-view packet complete');status.textContent='One six-view packet complete. This is an unfitted artist jacket with labelled layer selections.';
  } catch(e) {result.status='failed';result.error=String(e);result.checkedEntryMs=performance.now()-entered;clean('failure');status.textContent='Packet stopped. Preserve evidence; no retry.';}
  finally {window.removeEventListener('pagehide',onHide);result.finished_utc=new Date().toISOString();record.textContent=JSON.stringify(result,null,2);record.hidden=false;}
},{once:true});
