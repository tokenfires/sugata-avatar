// Inert source: one admitted static native, no Avatar/asset/source import or fallback.
const finish=document.querySelector('#finish'),status=document.querySelector('#status'),receipt=document.querySelector('#receipt'),canvas=document.querySelector('#canvas');
const record={identity:'sugata-original-neutral-head-v1-20261005',url:location.href,state:'preparing',errors:[],fetches:[],uploads:[],views:[],allocations:[],cleanup:[],limits:'Returned renders/readback are not GPU completion; disposal is not certified GPU retirement.'};
let closed=false,renderer=null;const geometries=[],materials=[];const abort=new AbortController();
function show(){status.textContent=record.state;receipt.textContent=JSON.stringify(record,null,2);}
function live(){if(closed)throw new Error('closed during async setup');}
function dispose(reason){
  if(closed)return;closed=true;abort.abort();record.closure=reason;
  for(const [kind,list] of [['geometry',geometries],['material',materials],['renderer',renderer?[renderer]:[]]])for(const owner of list){
    const row={kind,uuid:owner.uuid||null,attempted:true};record.cleanup.push(row);
    try{owner.dispose();row.returned=true;}catch(e){row.error=String(e);}
  }
  finish.disabled=true;record.state=reason==='finish'?'finished':'failed';show();
}
window.addEventListener('error',event=>{record.errors.push({type:'error',message:event.message||'resource error',source:event.filename||event.target?.src||event.target?.href||null});if(record.state==='ready')dispose('late error');else show();},true);
window.addEventListener('unhandledrejection',event=>{record.errors.push({type:'rejection',message:String(event.reason)});if(record.state==='ready')dispose('late rejection');else show();});
canvas.addEventListener('webglcontextlost',()=>{record.errors.push({type:'context lost'});dispose('context lost');});
window.addEventListener('pagehide',()=>dispose('pagehide'));
finish.addEventListener('click',()=>dispose('finish'));
async function digest(bytes){live();const hash=await crypto.subtle.digest('SHA-256',bytes);live();return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function load(path,expected=null){
  live();const response=await fetch(new URL(path,location.href),{signal:abort.signal,cache:'no-store'});live();
  if(!response.ok)throw new Error(`fetch ${path}: ${response.status}`);
  const bytes=await response.arrayBuffer();live();const sha256=await digest(bytes);live();
  const row={path,bytes:bytes.byteLength,sha256};record.fetches.push(row);
  if(expected&&(row.bytes!==expected.bytes||row.sha256!==expected.sha256))throw new Error(`byte identity ${path}`);
  return bytes;
}
async function main(){
  try{
    const cfgBytes=await load('NATIVE-ADMISSION.json');live();
    const cfg=JSON.parse(new TextDecoder().decode(cfgBytes));record.admission_sha256=await digest(cfgBytes);live();
    if(cfg.decision!=='A one unchanged native only'||Date.now()>=Date.parse(cfg.nomination_stop_utc))throw new Error('native admission/cutoff');
    const THREE=await import('three');live();record.three_revision=THREE.REVISION;
    if(THREE.REVISION!=='185')throw new Error('installed Three identity');
    // Every fetched source is guarded and checked before owning any GPU resources.
    for(const row of cfg.source_bindings){await load(row.path,row);live();}
    const meshBytes=await load('output/mesh.json',cfg.mesh);live();
    const mesh=JSON.parse(new TextDecoder().decode(meshBytes));
    const checked=JSON.parse(new TextDecoder().decode(await load('output/CHECK.json',cfg.check)));live();
    if(!checked.decision.startsWith('A')||mesh.schema!=='sugata-original-neutral-head-mesh-v1')throw new Error('numeric/schema identity');
    if(JSON.stringify(mesh.materials)!==JSON.stringify(cfg.materials)||mesh.parts.map(p=>p.name).join()!=='Skin,EyeLeft,EyeRight')throw new Error('part/material identity');
    const buffers=[];
    for(const part of mesh.parts){
      const values={};
      for(const [field,Type,ext] of [['positions',Float32Array,'f32'],['normals',Float32Array,'f32'],['triangles',Uint32Array,'u32']]){
        const path=`${part.name}-${field}.${ext}`,expected=mesh.files.find(r=>r.path===path);
        if(!expected)throw new Error(`missing binary ${path}`);
        const bytes=await load('output/'+path,expected);live();const array=new Type(bytes);
        if(array.length!==part[field].length*3||!array.every((v,i)=>v===part[field][Math.floor(i/3)][i%3]))throw new Error(`all JSON/binary ${path}`);
        values[field]=array;
      }
      buffers.push({part,values});
    }
    if(record.errors.length)throw new Error('resource errors before allocation');live();
    if(window.innerWidth<1232||window.innerHeight<680)throw new Error('fixed whole canvas viewport does not fit');
    record.browser_viewport=[window.innerWidth,window.innerHeight];
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
    record.allocations.push({kind:'renderer',canvasId:canvas.id});renderer.setPixelRatio(1);renderer.setSize(1200,540,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{record.errors.push({type:'shader',program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)});};
    const scene=new THREE.Scene();scene.background=new THREE.Color('#242a31');
    scene.add(new THREE.AmbientLight(0xffffff,1));
    const key=new THREE.DirectionalLight(0xffffff,1.8);key.position.set(3,4,5);scene.add(key);
    const fill=new THREE.DirectionalLight(0xffffff,.4);fill.position.set(-3,1,-4);scene.add(fill);
    const names=mesh.material_order;
    for(const name of names){const spec=mesh.materials[name];const m=new THREE.MeshStandardMaterial({color:spec.colour,roughness:spec.roughness,metalness:0,side:THREE.FrontSide});materials.push(m);record.allocations.push({kind:'material',uuid:m.uuid,name,colour:spec.colour,linearColour:m.color.toArray(),roughness:m.roughness,side:m.side});}
    const objects=[];
    for(const {part,values} of buffers){
      live();const g=new THREE.BufferGeometry();geometries.push(g);record.allocations.push({kind:'geometry',uuid:g.uuid,part:part.name});
      g.setAttribute('position',new THREE.BufferAttribute(values.positions,3));g.setAttribute('normal',new THREE.BufferAttribute(values.normals,3));g.setIndex(new THREE.BufferAttribute(values.triangles,1));
      // Preserve the saved face order; groups partition every original triangle once.
      let begin=0;
      for(let i=1;i<=part.face_materials.length;i++)if(i===part.face_materials.length||part.face_materials[i]!==part.face_materials[begin]){g.addGroup(begin*3,(i-begin)*3,part.face_materials[begin]);begin=i;}
      g.computeBoundingBox();const object=new THREE.Mesh(g,materials);object.name=part.name;object.frustumCulled=false;scene.add(object);objects.push(object);
      const upload={part:part.name,geometry_uuid:g.uuid,vertices:g.attributes.position.count,triangles:g.index.count/3,groups:g.groups.map(r=>({...r})),materials:part.face_materials,bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()]};
      for(const [field,attr] of [['positions',g.attributes.position],['normals',g.attributes.normal],['triangles',g.index]]){upload[field+'_sha256']=await digest(attr.array.buffer);live();}
      record.uploads.push(upload);
    }
    const cameras=[];const positions=[[0,0,4],[4,0,0],[0,0,-4]];const halfY=1.28,halfX=halfY*400/540;
    for(let v=0;v<3;v++){
      live();const camera=new THREE.OrthographicCamera(-halfX,halfX,halfY,-halfY,.1,10);camera.position.fromArray(positions[v]);camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
      let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(const object of objects){object.updateMatrixWorld(true);const p=object.geometry.attributes.position;for(let i=0;i<p.count;i++){const projected=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld).project(camera);const a=projected.toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],a[k]);max[k]=Math.max(max[k],a[k]);}}}
      if(min.some(x=>!Number.isFinite(x)||x<=-1)||max.some(x=>!Number.isFinite(x)||x>=1))throw new Error('full projected framing');
      const row={name:['front','profile','rear'][v],position:camera.position.toArray(),up:camera.up.toArray(),target:[0,0,0],quaternion:camera.quaternion.toArray(),frustum:[camera.left,camera.right,camera.top,camera.bottom,camera.near,camera.far],viewport:[v*400,0,400,540],projectedBounds:[min,max]};record.views.push(row);cameras.push(camera);
    }
    renderer.setScissorTest(true);renderer.info.autoReset=false;renderer.info.reset();
    for(let v=0;v<3;v++){
      live();renderer.setViewport(v*400,0,400,540);renderer.setScissor(v*400,0,400,540);renderer.render(scene,cameras[v]);
      record.views[v].actualViewport=renderer.getViewport(new THREE.Vector4()).toArray();record.views[v].actualScissor=renderer.getScissor(new THREE.Vector4()).toArray();
    }
    record.renderer={drawingBuffer:renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(),outputColorSpace:renderer.outputColorSpace,scissorTest:renderer.getScissorTest(),renderCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,programs:renderer.info.programs.length};
    record.expectedTriangles=mesh.parts.reduce((n,p)=>n+p.triangles.length,0)*3;record.expectedDrawCalls=record.uploads.reduce((n,u)=>n+u.groups.length,0)*3;
    if(record.errors.length||record.renderer.triangles!==record.expectedTriangles||record.renderer.renderCalls!==record.expectedDrawCalls||record.renderer.geometries!==3||record.renderer.drawingBuffer.join()!=='1200,540')throw new Error('actual draw/resources identity');
    // One guarded callback lets DOM state become available; no epoch search or GPU fence claim.
    await new Promise(resolve=>requestAnimationFrame(resolve));live();
    if(record.errors.length)throw new Error('resource error before ready');record.state='ready';finish.disabled=false;show();
  }catch(error){record.errors.push({type:'setup refusal',message:String(error)});dispose('setup refusal');}
}
show();main();
