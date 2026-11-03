// One isolated card-fit preparation; frozen head and all morph deltas remain unchanged.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Triangle, Vector3 } from 'three';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
import { decodePng } from '../critic/png.mjs';
const out='docs/evidence/ember-2026-10-31-brow-lash-v001/';
const path='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const started=process.cpuUsage();
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'STARTED.json',JSON.stringify({utc:new Date().toISOString(),pid:process.pid,limits:{cpuSeconds:30,rssMiB:256,outputMiB:5},scriptHash:sha(fs.readFileSync(import.meta.filename))}),{flag:'wx'});
const hash=sha(fs.readFileSync(path));if(hash!=='bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef')throw Error('Frozen source changed');
function guard(){const c=process.cpuUsage(started);if(c.user+c.system>30e6||process.memoryUsage().rss>256*1024**2)throw Error('Resource cap');}
const g=readGlb(path),j=g.json;
const get=name=>{const m=j.meshes.find(m=>m.name===name),p=m?.primitives[0];if(!p||m.primitives.length!==1)throw Error('Missing single primitive');return {m,p,positions:readAccessor(g,p.attributes.POSITION).data};};
const body=get('base.001'),brow=get('eyebrow001'),lash=get('eyelashes01');
const indices=readAccessor(g,body.p.indices).data,normals=readAccessor(g,body.p.attributes.NORMAL).data;
const tri=new Triangle(),point=new Vector3(),bary=new Vector3(),n=new Vector3();
function nearest(q){let distance=Infinity,answer;for(let k=0;k<indices.length;k+=3){const ids=[indices[k],indices[k+1],indices[k+2]];
 const ys=ids.map(i=>body.positions[i*3+1]);if(q.y<Math.min(...ys)-.008||q.y>Math.max(...ys)+.008)continue;
 tri.a.fromArray(body.positions,ids[0]*3);tri.b.fromArray(body.positions,ids[1]*3);tri.c.fromArray(body.positions,ids[2]*3);
 if(Math.abs((tri.a.x+tri.b.x+tri.c.x)/3-q.x)>.015||Math.abs((tri.a.z+tri.b.z+tri.c.z)/3-q.z)>.015||tri.getNormal(n).z<.35)continue;
 tri.closestPointToPoint(q,point);const d=point.distanceToSquared(q);if(d>=distance)continue;
 tri.getBarycoord(point,bary);n.set(0,0,0);for(let z=0;z<3;z++)n.addScaledVector(new Vector3().fromArray(normals,ids[z]*3),bary.getComponent(z));n.normalize();
 distance=d;answer={point:point.clone(),normal:n.clone(),triangle:k/3};
 }if(!answer)throw Error('No local skin surface');return {...answer,distance:Math.sqrt(distance)};}
const positions=new Float32Array(brow.positions.length),rows=[];
for(let i=0;i<brow.positions.length/3;i++){const p=new Vector3().fromArray(brow.positions,i*3),old=nearest(p),query=p.clone().add(new Vector3(0,.002,0)),next=nearest(query);
 const gap=p.clone().sub(old.point).dot(old.normal),result=next.point.clone().addScaledVector(next.normal,gap),shift=result.distanceTo(p);
 if(old.distance>.004||shift>.003||result.y-p.y<.0005)throw Error('Card fit guard failed at '+i);
 result.toArray(positions,i*3);rows.push({vertex:i,sourceGap:gap,sourceDistance:old.distance,delta:result.clone().sub(p).toArray(),shift,newSkinTriangle:next.triangle});guard();}
const browIndices=readAccessor(g,brow.p.indices).data;let minimumNormalAgreement=1;
for(let k=0;k<browIndices.length;k+=3){const ids=[browIndices[k],browIndices[k+1],browIndices[k+2]],a=new Triangle(...ids.map(i=>new Vector3().fromArray(brow.positions,i*3))),b=new Triangle(...ids.map(i=>new Vector3().fromArray(positions,i*3)));if(a.getArea()<1e-12||b.getArea()<1e-12)throw Error('Degenerate brow triangle');const agreement=a.getNormal(new Vector3()).dot(b.getNormal(new Vector3()));minimumNormalAgreement=Math.min(minimumNormalAgreement,agreement);if(agreement<.5)throw Error('Brow triangle rotated more than60 degrees');}
const maps=[];
for(const card of [brow,lash]){const material=j.materials[card.p.material],tex=j.textures[material.pbrMetallicRoughness.baseColorTexture.index],im=j.images[tex.source],v=j.bufferViews[im.bufferView],bytes=g.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
 if(im.mimeType!=='image/png'||bytes.readUInt32BE(16)>1024||bytes.readUInt32BE(20)>1024)throw Error('Map outside budget');const d=decodePng(bytes);let opaque=0,soft=0,sum=0;
 for(let i=0;i<d.pixels.length;i+=4){const a=d.pixels[i+3];if(a>=.5){opaque++;sum+=Math.max(d.pixels[i],d.pixels[i+1],d.pixels[i+2]);}if(a>0&&a<1)soft++;}
 const file=card.m.name+'-source.png';fs.writeFileSync(out+file,bytes,{flag:'wx'});maps.push({mesh:card.m.name,vertices:card.positions.length/3,material,sampler:j.samplers[tex.sampler],image:im.name,width:d.width,height:d.height,opaqueTexels:opaque,softAlphaTexels:soft,meanMaxRgbOpaque:sum/opaque,file,sha256:sha(bytes)});guard();}
const bytes=Buffer.from(positions.buffer);fs.writeFileSync(out+'brow-positions.f32',bytes,{flag:'wx'});
const cpu=process.cpuUsage(started),report={source:path,sourceHash:hash,scope:'Brow cards only raised 2mm with nearest frozen-body surface and original signed skin offset; no body/eye/lash geometry or morph target edits.',maps,projection:{minimumNormalAgreement,vertices:rows.length,maxShift:Math.max(...rows.map(r=>r.shift)),maxSourceDistance:Math.max(...rows.map(r=>r.sourceDistance)),minRise:Math.min(...rows.map(r=>r.delta[1])),maxRise:Math.max(...rows.map(r=>r.delta[1])),rows},positions:{file:'brow-positions.f32',sha256:sha(bytes),bytes:bytes.length},resources:{cpuSeconds:(cpu.user+cpu.system)/1e6,peakRssBytes:process.resourceUsage().maxRSS*1024}};
guard();fs.writeFileSync(out+'source-and-fit.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...report,projection:{...report.projection,rows:undefined}}));
