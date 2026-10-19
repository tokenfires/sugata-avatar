import * as THREE from 'three';

const run=document.querySelector('#run'),state=document.querySelector('#state'),record=document.querySelector('#record'),frames=document.querySelector('#frames');
const roles=[
  {id:'whole-front',title:'01 / Whole front oblique',note:'Same full model; waist, shared crotch and both plain hems.',position:[6,4.2,14],target:[0,2.5,0],height:5.8,w:570,h:440,select:()=>true},
  {id:'whole-right',title:'02 / Whole wearer-right profile',note:'Wearer right is −X; +Z remains front. No body or shoe fit.',position:[-14,3,0],target:[0,2.5,0],height:5.8,w:570,h:440,select:()=>true},
  {id:'whole-rear',title:'03 / Whole rear oblique',note:'Full seat and rear-band gathering; no added rear pockets.',position:[-6,4.5,-14],target:[0,2.5,0],height:5.8,w:570,h:440,select:()=>true},
  {id:'upper-selection',title:'04 / Upper shell, pleats and waist',note:'Only shell triangles wholly at y≥3.65 plus fly layers. A declared face selection, not a garment opening or exploded arrangement.',position:[5,6.3,12],target:[0,4.15,0.2],height:2.7,w:570,h:400,select:(p,t)=>p.name!=='shell'||t.v.every(i=>p.positions[i][1]>=3.65)},
  {id:'bag-selection',title:'05 / Two shell-owned bag branches',note:'Only bag-tagged outer/inward/floor triangles in unchanged coordinates. Surrounding shell intentionally omitted; shared mouth indices are in the export.',position:[5,5.5,10],target:[0,3.65,0.2],height:3,w:570,h:400,select:(p,t)=>p.name==='shell'&&t.role.startsWith('bag-')},
  {id:'fly-selection',title:'06 / Overlap, guard and static tapes',note:'Four separate closed parts, unchanged coordinates. Exact root contacts express artist attachment, not a welded seam, operating zipper or clearance certificate.',position:[3,5.4,12],target:[0,4.65,0.85],height:1.25,w:570,h:400,select:p=>p.name!=='shell'}
];
const maxModel=4194304,maxPNG=786432,maxAllPNG=4194304,owners=[],disposals=[],errors=[];
let entered=false,renderer,controller,timer,begin,active=false,totalPNG=0;
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
const need=(x,s)=>{if(!x)throw Error(s);};
const own=(kind,value)=>{owners.push({kind,value,disposed:false});return value;};
function cleanup(){
  controller?.abort();clearTimeout(timer);
  for(const o of [...owners].reverse())if(!o.disposed){o.disposed=true;try{o.value.dispose();disposals.push({kind:o.kind,ok:true});}catch(e){errors.push(String(e));disposals.push({kind:o.kind,ok:false,error:String(e)});}}
  let contextLossRequested=false;
  if(renderer){try{renderer.forceContextLoss();contextLossRequested=true;}catch(e){errors.push(String(e));}}
  return {known_owners:owners.length,disposals:[...disposals],abort_requested:!!controller,context_loss_requested:contextLossRequested,physical_driver_retirement:'unproved',partial_constructor_allocations:'not independently observable'};
}
window.addEventListener('pagehide',()=>{if(active)cleanup();},{once:true});
function guard(admission){need(performance.now()-begin<12000,'cooperative packet time');need(Date.now()<Date.parse(admission.expires_utc)&&Date.now()<Date.parse(admission.absolute_deadline_utc),'GPU admission expired');}
async function getJSON(name,cap){const res=await fetch(new URL(name,import.meta.url),{signal:controller.signal,cache:'no-store'});need(res.ok,'HTTP '+name);const bytes=await res.arrayBuffer();need(bytes.byteLength<=cap,'input bytes '+name);return {value:JSON.parse(new TextDecoder().decode(bytes)),bytes,sha256:await digest(bytes)};}
function geometry(p,selected,materialNames){
  const g=own('geometry',new THREE.BufferGeometry());
  const positions=new Float32Array(p.positions.flat());need(positions.length<=36000&&positions.every(Number.isFinite),'GPU position bound');g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const indices=[],groups=[];let last='',start=0,count=0;
  for(const t of selected){need(t.v.length===3&&t.v.every(i=>Number.isInteger(i)&&i>=0&&i<p.positions.length),'GPU triangle indices');if(t.material!==last){if(count)groups.push({start,count,materialIndex:materialNames.indexOf(last)});last=t.material;start=indices.length;count=0;}indices.push(...t.v);count+=3;}
  if(count)groups.push({start,count,materialIndex:materialNames.indexOf(last)});need(indices.length<=72000&&groups.every(g=>g.materialIndex>=0),'GPU face bound');g.setIndex(indices);for(const x of groups)g.addGroup(x.start,x.count,x.materialIndex);g.computeVertexNormals();return g;
}
run.disabled=false;state.textContent='Ready — no model fetch or GPU entry yet.';
run.addEventListener('click',async()=>{
  if(entered)return;entered=true;run.disabled=true;begin=performance.now();active=true;controller=new AbortController();timer=setTimeout(()=>controller.abort(),12000);
  const result={schema:'ari-trouser-fixed-first-GPU-v1',start_utc:new Date().toISOString(),three_revision:THREE.REVISION,roles:[],status:'RUNNING',limits:'Fixed artist views only; no globalclearance/fit/rig/cloth/runtime/performance or physical GPU retirement qualification.'};
  let success=false;
  try{
    need(THREE.REVISION==='185','installed primary runtime identity');
    const admission=await getJSON('GPU-ADMISSION.json',65536),a=admission.value;
    need(a.status==='ADMITTED_ONE_GPU'&&a.role_count===6,'GPU stage admission');guard(a);
    const packet=await getJSON('out/model.json',maxModel),model=packet.value;
    need(packet.sha256===a.model.sha256&&packet.bytes.byteLength===a.model.bytes,'actual model identity');
    need(model.design_sha256===a.design_sha256&&model.totals.parts===5&&model.totals.vertices===4300&&model.totals.triangles===8588,'model identity/workload');
    result.admission_sha256=admission.sha256;result.model={bytes:packet.bytes.byteLength,sha256:packet.sha256,design_sha256:model.design_sha256};
    const canvas=document.createElement('canvas');renderer=own('renderer',new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'}));
    renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    const names=Object.keys(model.materials),materials=names.map(n=>{const m=model.materials[n];return own('material',new THREE.MeshStandardMaterial({color:m.color,roughness:m.roughness,metalness:0}));});
    for(const r of roles){
      guard(a);const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e5dc');scene.add(own('hemisphere-light',new THREE.HemisphereLight('#eef5ff','#8c857a',2)));const light=own('directional-light',new THREE.DirectionalLight('#fff4de',2.4));light.position.set(-4,8,10);scene.add(light);
      const meshes=[],details=[];
      try{
        for(const p of model.parts){const chosen=p.triangles.filter(t=>r.select(p,t));if(!chosen.length)continue;const g=geometry(p,chosen,names),mesh=new THREE.Mesh(g,materials);scene.add(mesh);meshes.push(mesh);details.push({part:p.name,triangles:chosen.length});}
        const aspect=r.w/r.h,camera=new THREE.OrthographicCamera(-r.height*aspect/2,r.height*aspect/2,r.height/2,-r.height/2,0.1,60);camera.position.set(...r.position);camera.up.set(0,1,0);camera.lookAt(...r.target);camera.updateMatrixWorld();renderer.setSize(r.w,r.h,false);renderer.render(scene,camera);guard(a);
        const data=canvas.toDataURL('image/png'),raw=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));need(raw.length<=maxPNG&&(totalPNG+=raw.length)<=maxAllPNG,'PNG byte ceilings');
        const figure=document.createElement('figure'),title=document.createElement('h2'),img=document.createElement('img'),note=document.createElement('figcaption');title.textContent=r.title;img.alt=r.title+' — original fixed model view';img.width=r.w;img.height=r.h;img.src=data;await img.decode();guard(a);need(img.naturalWidth===r.w&&img.naturalHeight===r.h,'native PNG dimensions');note.textContent=r.note;figure.append(title,img,note);frames.append(figure);
        result.roles.push({id:r.id,width:r.w,height:r.h,bytes:raw.length,sha256:await digest(raw),camera:{position:r.position,target:r.target,vertical_height:r.height,near:0.1,far:60,up:[0,1,0]},selected:details,triangles:details.reduce((n,p)=>n+p.triangles,0),same_model_coordinates:true});
      }finally{
        for(const mesh of meshes){scene.remove(mesh);const owner=owners.find(o=>o.value===mesh.geometry);if(owner&&!owner.disposed){owner.disposed=true;try{owner.value.dispose();disposals.push({kind:owner.kind,ok:true});}catch(e){errors.push(String(e));}}}
      }
    }
    need(result.roles.length===6,'complete role packet');success=true;
  }catch(e){errors.push(String(e?.stack||e));}
  finally{
    result.cleanup=cleanup();active=false;result.errors=[...errors];result.status=success&&!errors.length?'COMPLETE':'FAILED';result.end_utc=new Date().toISOString();result.post_click_ms=performance.now()-begin;result.total_PNG_bytes=totalPNG;
    record.textContent=JSON.stringify(result,null,2);record.dataset.status=result.status;state.textContent=result.status==='COMPLETE'?'Complete first fixed packet. Review the actual images; no replay.':'Closed incomplete packet. No retry.';
  }
},{once:true});
