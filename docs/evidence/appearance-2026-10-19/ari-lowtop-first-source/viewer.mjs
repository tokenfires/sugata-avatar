import * as THREE from 'three';

const button=document.querySelector('#start'),status=document.querySelector('#status'),record=document.querySelector('#record'),holder=document.querySelector('#views');
let used=false;
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(v=>v.toString(16).padStart(2,'0')).join('');
button.addEventListener('click',async()=>{
  if(used)return;used=true;button.disabled=true;status.textContent='Rendering the six reviewed views…';
  const started=performance.now(),controller=new AbortController(),geometries=[],materials=[],cleanup=[];
  let closed=false,renderer,context,timer,headerTimer;
  const result={schema:'ari-first-six-view-browser-result-v1',started_utc:new Date().toISOString(),views:[],cleanup,scope:'One unitless left-shoe artist blockout, no body/last/fit/physical manufacturing/motion/AAA acceptance'};
  const check=()=>{if(closed)throw Error('entry cancelled');if(performance.now()-started>60000)throw Error('checked entry deadline');};
  function clean(reason){
    if(closed)return;closed=true;clearTimeout(timer);clearTimeout(headerTimer);controller.abort();result.abortRequested=true;result.cleanupReason=reason;
    for(const [name,owner] of [...geometries.map((g,i)=>[`geometry-${i}`,g]),...materials.map((m,i)=>[`material-${i}`,m]),['renderer',renderer]]){
      const row={name,present:!!owner,error:null};try{owner?.dispose();}catch(e){row.error=String(e);}cleanup.push(row);
    }
    const loss={available:false,requested:false,error:null};try{const ext=context?.getExtension('WEBGL_lose_context');loss.available=!!ext;if(ext){ext.loseContext();loss.requested=true;}}catch(e){loss.error=String(e);}result.contextLoss=loss;
  }
  const hide=()=>clean('pagehide');window.addEventListener('pagehide',hide,{once:true});timer=setTimeout(()=>clean('overall timer'),60000);
  async function get(name){
    check();headerTimer=setTimeout(()=>controller.abort(),15000);let response;
    try{response=await fetch(new URL(name,import.meta.url),{signal:controller.signal,cache:'no-store'});}finally{clearTimeout(headerTimer);}
    check();if(!response.ok)throw Error(`${name}:HTTP${response.status}`);const bytes=await response.arrayBuffer();check();return bytes;
  }
  try{
    const admissionBytes=await get('GPU-ADMISSION.json');check();const admission=JSON.parse(new TextDecoder().decode(admissionBytes));
    if(Date.now()>Date.parse(admission.expires_utc)||Date.now()>Date.parse(admission.absolute_deadline_utc))throw Error('render admission expired');
    const admissionHash=await hash(admissionBytes);check();result.admissionSHA256=admissionHash;
    const dataBytes=await get('model.json');check();if(dataBytes.byteLength>2097152)throw Error('model size cap');
    const dataHash=await hash(dataBytes);check();if(dataHash!==admission.model_sha256)throw Error('model hash mismatch');
    const model=JSON.parse(new TextDecoder().decode(dataBytes));check();result.modelSHA256=dataHash;
    const count=model.parts.reduce((a,p)=>({vertices:a.vertices+p.positions.length,triangles:a.triangles+p.triangles.length}),{vertices:0,triangles:0});
    if(count.vertices>8192||count.triangles>16000||model.parts.length>28)throw Error('mesh count cap');result.counts={...count,parts:model.parts.length};
    // All awaits/guards and input hashes precede GPU owners. This whole owner/render/encode phase is synchronous.
    const materialNames=Object.keys(model.materials),materialIndex=new Map(materialNames.map((n,i)=>[n,i]));
    for(const name of materialNames){const m=new THREE.MeshStandardMaterial({color:model.materials[name].colour,roughness:model.materials[name].roughness,metalness:0});materials.push(m);}
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x26343b);const shoe=new THREE.Group();scene.add(shoe);
    for(const part of model.parts){
      check();const geometry=new THREE.BufferGeometry();geometries.push(geometry);
      const ordered=[...part.triangles].sort((a,b)=>materialIndex.get(a.material)-materialIndex.get(b.material));
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(part.positions.flat()),3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(ordered.flatMap(f=>f.v)),1));
      let start=0;for(const name of materialNames){const n=ordered.filter(t=>t.material===name).length;if(n){geometry.addGroup(start,n*3,materialIndex.get(name));start+=n*3;}}
      geometry.computeVertexNormals();shoe.add(new THREE.Mesh(geometry,materials));
    }
    scene.add(new THREE.HemisphereLight(0xe3edf1,0x59615f,2));
    const key=new THREE.DirectionalLight(0xfff1db,3.2);key.position.set(-2,4,3);scene.add(key);
    const fill=new THREE.DirectionalLight(0xcbdce8,1.5);fill.position.set(3,2,-3);scene.add(fill);
    const canvas=document.createElement('canvas');context=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!context)throw Error('WebGL2 unavailable');
    renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);renderer.setSize(570,340,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    result.contextAttributes=context.getContextAttributes();result.threeRevision=THREE.REVISION;
    const box=new THREE.Box3().setFromObject(shoe),centre=box.getCenter(new THREE.Vector3()),aspect=570/340;
    const views=[
      {id:'top',caption:'Top • toe up, medial edge right',direction:[0,1,0],up:[0,0,1]},
      {id:'lateral',caption:'Outer side • toe left',direction:[1,0,0],up:[0,1,0]},
      {id:'medial',caption:'Inner side • toe right',direction:[-1,0,0],up:[0,1,0]},
      {id:'front',caption:'Front • toe toward camera',direction:[0,0,1],up:[0,1,0]},
      {id:'rear',caption:'Rear • heel toward camera',direction:[0,0,-1],up:[0,1,0]},
      {id:'underside',caption:'Underside • toe up, medial edge left',direction:[0,-1,0],up:[0,0,1]}
    ];
    const corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).sub(centre));
    let imageBytes=0;
    for(const view of views){
      check();const dir=new THREE.Vector3(...view.direction),up=new THREE.Vector3(...view.up),right=new THREE.Vector3().crossVectors(dir.clone().negate(),up).normalize();
      const halfWidth=Math.max(...corners.map(p=>Math.abs(p.dot(right)))),halfY=Math.max(...corners.map(p=>Math.abs(p.dot(up))));
      const halfHeight=Math.max(halfY,halfWidth/aspect)*1.15,camera=new THREE.OrthographicCamera(-halfHeight*aspect,halfHeight*aspect,halfHeight,-halfHeight,0.1,20);
      camera.position.copy(centre).addScaledVector(dir,6);camera.up.copy(up);camera.lookAt(centre);renderer.render(scene,camera);check();
      const url=canvas.toDataURL('image/png'),bytes=atob(url.split(',')[1]).length;imageBytes+=bytes;if(imageBytes>16777216)throw Error('six-view image cap');
      const figure=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=view.caption;img.src=url;img.alt=view.caption;img.width=570;img.height=340;figure.append(caption,img);holder.append(figure);
      result.views.push({id:view.id,width:570,height:340,bytes,direction:view.direction,up:view.up,halfHeight,renderCalls:renderer.info.render.calls,renderTriangles:renderer.info.render.triangles});
    }
    result.imageBytes=imageBytes;result.bounds={min:box.min.toArray(),max:box.max.toArray()};result.status='complete';
  }catch(error){result.status='failed';result.error=String(error);}
  finally{
    clean(result.status||'incomplete');window.removeEventListener('pagehide',hide);result.completed_utc=new Date().toISOString();result.checkedElapsedMs=performance.now()-started;
    result.limits='60s cooperative checks/timer cannot interrupt synchronous GPU task. Known owner disposal/context-loss request is not private-constructor/physical-driver retirement proof. No physical fit or material qualification.';
    record.textContent=JSON.stringify(result,null,2);status.textContent=result.status==='complete'?'Six views complete • ready for independent image review.':`Stopped: ${result.error||result.cleanupReason}`;
  }
});
