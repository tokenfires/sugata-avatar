// Single local feature candidate preparation, CPU only; no global fit or native renderer.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Vector3, Quaternion } from 'three';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
import { IdentityCatalogue } from '../../packages/core/src/figure/IdentityCatalogue.js';
import { IdentityTargets } from '../../packages/core/src/figure/IdentityTargets.js';
const out='docs/evidence/ember-2026-10-31-local-feature-v001/';
const prior='docs/evidence/ember-2026-10-31-local-feature-attribution/';
const fit='docs/evidence/ember-2026-10-31-measured-fit/';
const source='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';
const limits={cpuSeconds:30,rssBytes:256*1024**2,outputBytes:5*1024**2};
const c0=process.cpuUsage(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const priorPreflight=JSON.parse(fs.readFileSync(prior+'preflight.json'));
const inputPaths=[...Object.keys(priorPreflight.inputs),prior+'source-report.json',prior+'README.md',import.meta.filename];
const inputs=Object.fromEntries(inputPaths.map(p=>[p,{bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))}]));
for(const [p,v]of Object.entries(priorPreflight.inputs))if(inputs[p].sha256!==v.sha256)throw Error('Inspection input changed '+p);
fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');if(b.length>limits.outputBytes)throw Error('Output cap');fs.writeFileSync(out+name,b,{flag:'wx'});};
const guard=()=>{const c=process.cpuUsage(c0);if(c.user+c.system>limits.cpuSeconds*1e6||process.memoryUsage().rss>limits.rssBytes)throw Error('Resource cap');};
const changes={'cheek/cheek-volume-decr-incr':-.1,'chin/chin-width-decr-incr':-.1,'mouth/mouth-lowerlip-volume-decr-incr':-.1};
if(process.argv[2]==='--preflight'){
 write('preflight.json',{inputs,limits,changes,scope:'One CPU position/normal patch. Native-ID area-weighted normal rotations, applied also to relative morph NORMAL deltas in browser. All expression POSITION deltas preserved.'});console.log(JSON.stringify({preflight:true,inputs:inputPaths.length,limits,changes}));
}else if(process.argv[2]==='--run'){
 const pre=JSON.parse(fs.readFileSync(out+'preflight.json'));if(JSON.stringify(pre.inputs)!==JSON.stringify(inputs))throw Error('Preflight changed');
 write('STARTED.json',{utc:new Date().toISOString(),pid:process.pid,limits});
 try{
 const report=JSON.parse(fs.readFileSync(prior+'source-report.json'));
 if(report.correspondence.failureCount||!report.inputsUnchanged)throw Error('Unqualified correspondence');
 for(const name of ['cheek-reduce-current-positive','chin-narrow-current-positive','lower-lip-volume-decrease']){const f=report.fields.find(f=>f.name===name);if(!f||f.helpersMoved||f.parts.some(p=>p.barycentricMoved||p.scaleAxisChanges))throw Error('Part coupling changed');}
 const cat=JSON.parse(fs.readFileSync('assets/identity/catalogue.json')),c=new IdentityCatalogue(cat),t=new IdentityTargets(cat,{baseUrl:new URL('../../assets/identity/',import.meta.url).href,fetchBytes:async url=>{const b=fs.readFileSync(new URL(url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}});
 await t.loadRegions(['cheek','chin','mouth']);
 const identity=JSON.parse(fs.readFileSync(fit+'candidate-correction-v001.json')).identity,stack=[],values={};
 for(const [id,change]of Object.entries(changes)){const before=identity[id]??0,after=before+change;values[id]={before,after};stack.push(...c.resolve({[id]:after}),...c.resolve({[id]:before}).map(s=>({...s,weight:-s.weight})));}
 const field=new Float64Array(cat.library.basemeshVertexCount*3);t.apply(field,stack);
 const mb=fs.readFileSync('assets/identity/figure-vertex-map.bin'),map=new Uint16Array(mb.buffer,mb.byteOffset,mb.length/2),pb=fs.readFileSync(fit+'candidate-correction-v001-positions.f32'),fitted=new Float32Array(pb.buffer,pb.byteOffset,pb.length/4);
 const known=new Map();for(let i=0;i<map.length;i++)known.set(map[i],Array.from(fitted.subarray(i*3,i*3+3)));
 const buckets=new Map(),cell=1e-5;
 for(const [id,p]of known){const k=p.map(x=>Math.floor(x/cell)).join(',');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push([id,p]);}
 const g=readGlb(source),mesh=g.json.meshes.find(m=>m.name==='base.001'),p=mesh.primitives[0];
 const positions=readAccessor(g,p.attributes.POSITION).data,normals=readAccessor(g,p.attributes.NORMAL).data,indices=readAccessor(g,p.indices).data;
 if(positions.length!==14517*3)throw Error('Body size changed');
 const native=new Uint16Array(positions.length/3);let correspondenceError=0;
 for(let i=0;i<native.length;i++){const q=Array.from(positions.subarray(i*3,i*3+3)),xyz=q.map(v=>Math.floor(v/cell)),hits=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const [id,p]of buckets.get([xyz[0]+x,xyz[1]+y,xyz[2]+z].join(','))??[]){const d=Math.hypot(...q.map((v,k)=>v-p[k]));if(d<=2e-6)hits.push({id,d});}if(hits.length!==1)throw Error('Nonunique correspondence '+i);native[i]=hits[0].id;correspondenceError=Math.max(correspondenceError,hits[0].d);}
 const changedPositions=new Float32Array(positions.length);let maxShiftMm=0,moved=0;
 for(let i=0;i<native.length;i++){const d=field.subarray(native[i]*3,native[i]*3+3);for(let k=0;k<3;k++)changedPositions[i*3+k]=positions[i*3+k]+d[k];const shift=Math.hypot(...Array.from(d))*1000;maxShiftMm=Math.max(maxShiftMm,shift);if(shift>1e-8)moved++;}
 if(maxShiftMm>2.5)throw Error('Displacement cap');guard();
 const oldSum=new Float64Array(field.length),newSum=new Float64Array(field.length),a=new Vector3(),b=new Vector3(),d=new Vector3();
 const face=(array,ids)=>{a.fromArray(array,ids[0]*3);b.fromArray(array,ids[1]*3).sub(a);d.fromArray(array,ids[2]*3).sub(a);return b.cross(d).clone();};
 let minimumFaceAgreement=1,baselineDegenerate=0;
 for(let i=0;i<indices.length;i+=3){const ids=Array.from(indices.subarray(i,i+3)),n0=face(positions,ids),n1=face(changedPositions,ids),l0=n0.length(),l1=n1.length();if(l0<1e-15){baselineDegenerate++;if(l1>1e-12)throw Error('Changed baseline degenerate');continue;}if(l1<1e-15)throw Error('New degenerate triangle');const agreement=n0.dot(n1)/(l0*l1);minimumFaceAgreement=Math.min(minimumFaceAgreement,agreement);if(agreement<.8)throw Error('Face rotated >36.9 degrees');for(const v of ids)for(let k=0;k<3;k++){oldSum[native[v]*3+k]+=n0.getComponent(k);newSum[native[v]*3+k]+=n1.getComponent(k);}}
 const rotations=new Map(),q=new Quaternion();let maxRotationRadians=0;
 for(const id of new Set(native)){const n0=new Vector3().fromArray(oldSum,id*3),n1=new Vector3().fromArray(newSum,id*3);if(n0.lengthSq()<1e-30||n1.lengthSq()<1e-30)throw Error('Near-zero normal sum '+id);n0.normalize();n1.normalize();if(n0.dot(n1)<.5)throw Error('Unstable normal rotation '+id);q.identity();if(n0.distanceToSquared(n1)>1e-24)q.setFromUnitVectors(n0,n1);if(!q.toArray().every(Number.isFinite))throw Error('Nonfinite normal rotation');rotations.set(id,q.clone());maxRotationRadians=Math.max(maxRotationRadians,2*Math.acos(Math.min(1,Math.abs(q.w))));}
 const changedNormals=new Float32Array(normals.length),normalRotations=new Float32Array(native.length*4);let changedNormalVertices=0,normalHaloVertices=0;
 for(let i=0;i<native.length;i++){const q=rotations.get(native[i]);new Vector3().fromArray(normals,i*3).applyQuaternion(q).toArray(changedNormals,i*3);q.toArray(normalRotations,i*4);if(Math.abs(q.w-1)>1e-12){changedNormalVertices++;if(Math.hypot(...field.subarray(native[i]*3,native[i]*3+3))<1e-11)normalHaloVertices++;}}
 guard();const outputFiles={};for(const [name,array]of [['positions.f32',changedPositions],['normals.f32',changedNormals],['normal-rotations.f32',normalRotations]]){const bytes=Buffer.from(array.buffer);fs.writeFileSync(out+name,bytes,{flag:'wx'});outputFiles[name]={bytes:bytes.length,sha256:sha(bytes)};}
 for(const [p,v]of Object.entries(inputs))if(sha(fs.readFileSync(p))!==v.sha256)throw Error('Input modified '+p);
 const cpu=process.cpuUsage(c0),result={source,sourceHash:inputs[source].sha256,values,outputs:outputFiles,bodyVertices:native.length,moved,maxShiftMm,correspondenceError,minimumFaceAgreement,baselineDegenerate,maxRotationRadians,changedNormalVertices,normalHaloVertices,morphNormalChannels:(p.targets??[]).filter(t=>t.NORMAL!==undefined).length,normalMethod:'Per-native old/new summed face-area normals define one rotation applied to existing base normals and any existing relative expression NORMAL deltas; UV copies receive same rotation. Expression POSITION deltas remain frozen. Normal rotation through expressions is approximate; no missing normal channels are created.',inputsUnchanged:true,resources:{cpuSeconds:(cpu.user+cpu.system)/1e6,rssBytes:process.memoryUsage().rss},limits:['Rest-source preparation only, no visual or animated-clearance acceptance.','Cleft and lower-lip height unchanged; dimple remains unresolved.']};
 write('build-result.json',result);write('process-result.json',{ok:true,utc:new Date().toISOString(),resources:result.resources});console.log(JSON.stringify(result));
 }catch(error){write('process-result.json',{ok:false,error:error.stack,utc:new Date().toISOString()});throw error;}
}else throw Error('Use --preflight or --run');
