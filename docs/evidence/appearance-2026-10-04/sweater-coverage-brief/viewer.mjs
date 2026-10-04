import * as THREE from 'three';
// New diagnostic world-position meshes; no GLB loader, garment or skinning.
const record={started:new Date().toISOString(),threeRevision:THREE.REVISION,status:'loading',inputs:[],groups:[],draws:[],disposals:[],limits:'Coverage intent in saved original pose only; no garment, GPU source equivalence, fit, manifold or motion.'};
const resources=new Set(),status=document.querySelector('#status'),output=document.querySelector('#record'),link=document.querySelector('#download');
const scene=new THREE.Scene();let renderer,cameras,width,height,finished=false,blob;
const finite=vs=>vs.every(Number.isFinite);
async function sha(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
function publish(){output.textContent=JSON.stringify(record);if(blob)URL.revokeObjectURL(blob);blob=URL.createObjectURL(new Blob([output.textContent],{type:'application/json'}));link.href=blob;}
async function read(pin){const row={...pin};record.inputs.push(row);const response=await fetch(pin.url);row.status=response.status;if(!response.ok)throw Error('Fetch refused '+pin.url);const bytes=await response.arrayBuffer();row.observedBytes=bytes.byteLength;row.observedSHA256=await sha(bytes);publish();if(bytes.byteLength!==pin.bytes||row.observedSHA256!==pin.sha256)throw Error('Input changed '+pin.url);if(finished)throw Error('Finished during data read');return JSON.parse(new TextDecoder().decode(bytes));}
function cleanup(reason){finished=true;record.cleanupReason=reason;for(const r of resources){const row={type:r.type||r.constructor.name,attempted:true};try{r.dispose();row.returned=true;}catch(e){row.error=String(e);}record.disposals.push(row);}resources.clear();document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=true);publish();}
document.querySelector('#finish').addEventListener('click',()=>{record.finished=new Date().toISOString();cleanup('explicit Finish');status.textContent='Review finished; observations retained';});
window.addEventListener('pagehide',()=>cleanup('pagehide'));
function fail(e){record.status='refused';record.error=String(e);cleanup('refusal');status.textContent='Coverage brief refused';}
function world(owner,tid,b){const ids=owner.triangles[tid];return [0,1,2].map(k=>b.reduce((s,v,j)=>s+v*owner.worldPositions[ids[j]][k],0));}
const colors={body:{required:0x91bad1,exposed:0xbea087},bra:{required:0x178fa8,exposed:0xd55e69},briefs:{required:0x697eaf,exposed:0x8767aa}};
async function construct(ledger,partition){
  if(partition.status!=='complete'||partition.owners.length!==9||partition.triangleCount!==71512)throw Error('Incomplete partition');
  record.planes=partition.planes;record.bounds=ledger.bounds;record.owners=[];
  const all=[];
  for(let oi=0;oi<partition.owners.length;oi++){
    const p=partition.owners[oi],owner=ledger.owners[oi];if(p.uuid!==owner.uuid||p.sourceTriangles!==owner.triangles.length)throw Error('Source owner mismatch');
    const arrays={required:[],exposed:[]},line=[];const ids=[];
    function append(tid,poly,group){if(poly.length<3)return;const points=poly.map(b=>world(owner,tid,b));for(let j=1;j<points.length-1;j++)arrays[group].push(...points[0],...points[j],...points[j+1]);}
    const original=[[1,0,0],[0,1,0],[0,0,1]];
    for(const tid of p.required){ids.push(tid);append(tid,original,'required');}
    for(const [reason,list] of Object.entries(p.exposed))for(const tid of list){ids.push(tid);append(tid,original,'exposed');}
    for(const cut of p.cut){ids.push(cut.id);append(cut.id,cut.required,'required');for(const e of cut.exposed)append(cut.id,e.polygon,'exposed');
      if(owner.key==='body'&&owner.name==='Human')for(const t of cut.traces)for(let j=1;j<t.polygon.length;j++)line.push(...world(owner,cut.id,t.polygon[j-1]),...world(owner,cut.id,t.polygon[j]));}
    for(const tid of p.degenerate){ids.push(tid);append(tid,original,'exposed');}
    if(new Set(ids).size!==p.sourceTriangles||ids.some(i=>!Number.isInteger(i)||i<0||i>=p.sourceTriangles))throw Error('Source ID omission');
    record.owners.push({uuid:p.uuid,key:p.key,name:p.name,sourceTriangles:p.sourceTriangles,wholeRequired:p.required.length,wholeExposed:Object.fromEntries(Object.entries(p.exposed).map(([k,v])=>[k,v.length])),cut:p.cut.length,degenerate:p.degenerate.length});
    for(const [kind,positions] of Object.entries(arrays)){
      if(!positions.length)continue;if(!finite(positions))throw Error('Nonfinite source fragments');
      const buffer=new Float32Array(positions),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(buffer,3));geometry.computeVertexNormals();resources.add(geometry);
      const material=new THREE.MeshStandardMaterial({color:colors[p.key][kind],side:THREE.DoubleSide,roughness:1,metalness:0});resources.add(material);
      const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);all.push(buffer);
      record.groups.push({uuid:p.uuid,key:p.key,name:p.name,kind,vertices:buffer.length/3,triangles:buffer.length/9,positionsSHA256:await sha(buffer),normalsSHA256:await sha(geometry.attributes.normal.array),color:material.color.getHex(),side:material.side,matrix:mesh.matrix.toArray()});
    }
    if(line.length){const buffer=new Float32Array(line),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(buffer,3));resources.add(geometry);const material=new THREE.LineBasicMaterial({color:0xf8cf70,depthTest:false});resources.add(material);const lines=new THREE.LineSegments(geometry,material);lines.renderOrder=2;lines.frustumCulled=false;scene.add(lines);record.boundary={segments:buffer.length/6,positionsSHA256:await sha(buffer),depthTest:false,scope:'Main-body cut provenance; not welded loops'};}
  }
  return all;
}
function configure(ledger,buffers){
  const min=new THREE.Vector3(...ledger.bounds.min),max=new THREE.Vector3(...ledger.bounds.max),size=max.clone().sub(min),center=min.clone().add(max).multiplyScalar(.5);
  const canvas=document.querySelector('#view');width=Math.floor(canvas.getBoundingClientRect().width);height=560;const aspect=Math.floor(width/2)/height;
  const half=.6*Math.max(size.y,Math.hypot(size.x,size.z)/aspect),span=Math.max(size.x,size.y,size.z),eye=3*span;
  if(width<2||!finite([...min.toArray(),...max.toArray()]))throw Error('Missing source framing');
  cameras=[new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,1).normalize()].map(d=>{const c=new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,20*span);c.position.copy(center).addScaledVector(d,eye);c.lookAt(center);c.updateMatrixWorld(true);return c;});
  record.framing={width,height,half,panelAspect:aspect,eye,sourceVertexCount:ledger.vertexCount};record.cameras=cameras.map(c=>({world:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray(),position:c.position.toArray(),target:center.toArray()}));
  record.clip=cameras.map((camera,index)=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let pass=true,count=0;for(const a of buffers)for(let i=0;i<a.length;i+=3){const v=new THREE.Vector3(a[i],a[i+1],a[i+2]).project(camera).toArray();if(!finite(v)||Math.abs(v[0])>.97||Math.abs(v[1])>.97||v[2]<-1||v[2]>1)pass=false;v.forEach((x,k)=>{min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x);});count++;}return {camera:index,min,max,count,pass};});
  publish();if(record.clip.some(x=>!x.pass))throw Error('Fixed camera clips source; no reframing');
  scene.background=new THREE.Color(0x18202a);scene.add(new THREE.HemisphereLight(0xecf4ff,0x595361,2.2));const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(2,4,5);scene.add(light);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});resources.add(renderer);renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
}
function draw(mode){if(finished)return;const indices=[0,mode==='Front/Back'?1:2],left=Math.floor(width/2);renderer.setScissorTest(true);indices.forEach((ci,i)=>{const x=i?left:0,w=i?width-left:left;renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);renderer.render(scene,cameras[ci]);});record.draws.push({utc:new Date().toISOString(),mode,cameraIndices:indices});record.status='ready';publish();document.querySelector('#right').textContent=mode==='Front/Back'?'Back':'Oblique';status.textContent='Ready — '+mode;}
async function main(){const pins=await fetch('./NATIVE-INPUTS.json').then(r=>{if(!r.ok)throw Error('Native input manifest refused');return r.json();});const ledger=await read(pins.ledger),partition=await read(pins.partition);const buffers=await construct(ledger,partition);configure(ledger,buffers);draw('Front/Back');document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=false;b.addEventListener('click',()=>{try{draw(b.dataset.mode);}catch(e){fail(e);}});});}
publish();main().catch(fail);
