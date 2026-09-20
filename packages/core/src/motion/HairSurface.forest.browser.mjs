/** Portable actual GPU forest gate; all imported modules are production core files.
 * Single-domain and forest arms also match frozen independent historical output digests. */
import {Matrix3,Matrix4} from 'three';
import {WebGPURenderer} from 'three/webgpu';
import {Fn,If,instancedArray,instanceIndex,uint,float,vec3,vec4,uvec4,uniform,min,normalize,select} from 'three/tsl';
import {createPatch,hydratePatch,updateFromCaptured,motionBuffers,disposePatch} from './HairSurface.js';
import {createSurfaceQuery} from './HairSurfaceQuery.js';
import {createSurfaceContactStage as createStockStage} from './HairSurfaceContact.js';
import {createSurfaceForestQuery} from './HairSurfaceForestQuery.js';
import {createSurfaceContactStage as createForestStage} from './HairSurfaceContact.js';
const insist=(ok,m)=>{if(!ok)throw Error(m);};
const read=async(renderer,b)=>new Uint32Array(await renderer.getArrayBufferAsync(b.value));
const equal=(a,b,name)=>{insist(a.length===b.length,name+' length');for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(name+' bits '+i+': '+a[i]+' != '+b[i]);};
const hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a))).map(x=>x.toString(16).padStart(2,'0')).join('');
function memory(renderer){return{storage:renderer.info.memory.storageAttributes,bytes:renderer.info.memory.storageAttributesSize,pipelines:[...renderer._pipelines.caches.values()].filter(p=>p.isComputePipeline).length};}
function domainInputs(fixture,widened){return fixture.specs.map((spec,i)=>{const sampleIndex=widened?i:0,patch=hydratePatch(fixture.domains[sampleIndex]);return{id:spec.id,patch,motion:motionBuffers(patch),chains:spec.activeChains,sampleIndex};});}
function queryInput(fixture,pose,domain){const q=fixture.poses[pose].queries[domain];return{a:new Float32Array(q.a),b:new Float32Array(q.b),m:new Uint32Array(q.m)};}
function updateLocal(patch,pose){const size=(Math.max(...patch.sourceVertexIds)+1)*3,p=new Float32Array(size),n=new Float32Array(size);for(let i=0;i<patch.sourceVertexIds.length;i++){const offset=patch.sourceVertexIds[i]*3;for(let k=0;k<3;k++){p[offset+k]=pose.positions[i*4+k];n[offset+k]=pose.normals[i*4+k];}}updateFromCaptured(patch,p,n,{advanceHistory:true});}
export async function runForestDirect(fixture){
 const renderer=new WebGPURenderer({canvas:document.createElement('canvas')});await renderer.init();insist(renderer.backend.isWebGPUBackend,'Actual WebGPU required');const before=memory(renderer),results=[];let finalMemory;
 try{for(const widened of[false,true]){
  const domains=domainInputs(fixture,widened),forest=createSurfaceForestQuery(domains,{chainCount:496}),alpha=uniform(1),queries=domains.map(d=>createSurfaceQuery(d.patch,d.motion));
  const arms=[];
  try{
   for(let domain=0;domain<2;domain++)for(const mode of['stock','forest']){
    const input=queryInput(fixture,0,domain),count=input.m.length/4,A=instancedArray(input.a,'vec4'),B=instancedArray(input.b,'vec4'),M=instancedArray(input.m,'uvec4'),F=instancedArray(count*4,'vec4'),U=instancedArray(count,'uvec4');
    const node=Fn(()=>{
     const i=instanceIndex,meta=M.element(i).toVar(),a=A.element(i).xyz.toVar(),b=B.element(i).xyz.toVar(),seed=meta.y.toVar();
     const query=mode==='forest'?forest.forChain(meta.x,alpha):{query:(p,s)=>queries[domain].query(p,s,alpha),querySegment:(p,q,s)=>queries[domain].querySegment(p,q,s,alpha)};
     const store=(hit,point,t)=>{
      F.element(i).assign(vec4(hit.closest,hit.signedDistance));F.element(i.add(uint(count))).assign(vec4(hit.normal,select(hit.openBoundary,float(1),float(0))));
      F.element(i.add(uint(count*2))).assign(vec4(hit.barycentric,t));F.element(i.add(uint(count*3))).assign(vec4(point,select(hit.valid,float(1),float(0))));
      U.element(i).assign(uvec4(hit.sourceTriangle,hit.orderedTriangle,hit.trianglesTested,hit.nodesVisited));
     };
     If(meta.z.greaterThan(0),()=>{const hit=query.query(b,seed);store(hit,b,float(1));}).Else(()=>{const hit=query.querySegment(a,b,seed);store(hit,hit.segmentPoint,hit.segmentT);});
    })().compute(count).setName('forest direct '+mode+' domain'+domain);
    arms.push({domain,mode,count,A,B,M,F,U,node});
   }
   for(let pose=0;pose<fixture.poses.length;pose++){
    if(pose)for(const d of domains)updateLocal(d.patch,fixture.poses[pose].domains[d.sampleIndex]);
    forest.update();queries.forEach(q=>q.update());
    for(const arm of arms){const input=queryInput(fixture,pose,arm.domain);arm.A.value.array.set(input.a);arm.B.value.array.set(input.b);arm.M.value.array.set(input.m);arm.A.value.needsUpdate=arm.B.value.needsUpdate=arm.M.value.needsUpdate=true;}
    for(const blend of[0,.5,1])for(const seedMode of['cold','warm','cross-domain']){
     alpha.value=blend;const output=[];
     for(const arm of arms){
      const seeds=arm.M.value.array;
      for(let i=0;i<arm.count;i++)seeds[i*4+1]=seedMode==='warm'?arm.last?.[i*4+1]??0xffffffff:seedMode==='cross-domain'&&arm.mode==='forest'?(arm.domain===0?forest.layout.domains[1].triangleStart:0):0xffffffff;
      arm.M.value.needsUpdate=true;await renderer.computeAsync(arm.node);const shader=renderer._nodes.getForCompute(arm.node).computeShader;insist((shader.match(/var<storage/g)||[]).length===8,'Exactly eight direct query bindings');const f=await read(renderer,arm.F),u=await read(renderer,arm.U);arm.last=u.slice();
      insist(new Float32Array(f.buffer).every(Number.isFinite),'Finite direct output');const normalized=u.slice();if(arm.mode==='forest')for(let i=0;i<arm.count;i++)if(normalized[i*4+1]!==0xffffffff)normalized[i*4+1]-=forest.layout.domains[arm.domain].triangleStart;
      output.push({domain:arm.domain,mode:arm.mode,f,u:normalized,count:arm.count});
     }
     for(let domain=0;domain<2;domain++){const a=output.find(x=>x.domain===domain&&x.mode==='stock'),b=output.find(x=>x.domain===domain&&x.mode==='forest');equal(a.f,b.f,'direct float');equal(a.u,b.u,'direct integer/range');results.push({widened,pose,alpha:blend,seedMode,domain,count:a.count,floatBitsSha:await hash(a.f),uintBitsSha:await hash(a.u)});}
    }
   }
  }finally{for(const a of arms){a.node.dispose();for(const b of[a.A,a.B,a.M,a.F,a.U])renderer._attributes.delete(b.value);}queries.forEach(q=>q.dispose(renderer));forest.dispose(renderer);domains.forEach(d=>disposePatch(d.patch));}
 }}finally{finalMemory=memory(renderer);equal(Object.values(finalMemory),Object.values(before),'direct resources');renderer.dispose();}
 return{passed:true,rows:results,comparisons:results.reduce((s,x)=>s+x.count,0),before,after:finalMemory};
}

// Rebuild copied from the existing frozen contact probe; GPU vertices are read, not inferred on CPU.
function makeRebuild(renderer,fixture,p){
 const n=fixture.groom.particleCount,restCentreBuffer=instancedArray(new Float32Array(fixture.groom.restCentres),'vec3'),restOffsetBuffer=instancedArray(new Float32Array(fixture.groom.restOffsets),'vec3'),vertices=instancedArray(n*2,'vec3');
 const rotation=uniform(new Matrix3().setFromMatrix4(new Matrix4().fromArray(fixture.frameData.headMatrix)));
 const node=Fn(()=>{
  const points=uint(fixture.groom.pointsPerChain),ring=instanceIndex.mod(points),before=instanceIndex.sub(min(ring,uint(1))),after=instanceIndex.add(min(points.sub(ring).sub(uint(1)),uint(1)));
  const tangent=normalize(p.element(after).sub(p.element(before)).add(vec3(0,1e-9,0))).toVar();
  const restTangent=normalize(rotation.mul(restCentreBuffer.element(after).sub(restCentreBuffer.element(before))).add(vec3(0,1e-9,0))).toVar();
  const restOffset=rotation.mul(restOffsetBuffer.element(instanceIndex)).toVar(),halfTurn=restTangent.mul(restTangent.dot(restOffset).mul(2)).sub(restOffset).toVar(),bisector=normalize(restTangent.add(tangent)).toVar();
  const rotated=bisector.mul(bisector.dot(halfTurn).mul(2)).sub(halfTurn),offset=select(restTangent.dot(tangent).lessThan(-.9999),restOffset,rotated).toVar(),center=p.element(instanceIndex).toVar();
  vertices.element(instanceIndex.mul(uint(2))).assign(center.sub(offset));vertices.element(instanceIndex.mul(uint(2)).add(uint(1))).assign(center.add(offset));
 })().compute(n).setName('forest test GPU ribbon rebuild');
 return{node,vertices,dispose(){node.dispose();for(const b of[restCentreBuffer,restOffsetBuffer,vertices])renderer._attributes.delete(b.value);}};
}
async function packed3(renderer,buffer,count){const raw=await read(renderer,buffer),out=new Uint32Array(count*3),stride=buffer.value.itemSize;for(let i=0;i<count;i++)out.set(raw.subarray(i*stride,i*stride+3),i*3);return out;}
export async function runForestStageCases(fixtures,specs){
 const renderer=new WebGPURenderer({canvas:document.createElement('canvas')});await renderer.init();insist(renderer.backend.isWebGPUBackend,'Actual WebGPU required');const before=memory(renderer),rows=[];let after;
 try{for(const fixture of fixtures)for(const iterations of[16,64]){
  const results={};
  for(const mode of['single','partition-independent','partition-forest','nape-independent','nape-forest']){
   const useForest=mode.endsWith('forest'),expanded=mode.startsWith('nape'),n=fixture.groom.particleCount,patches=[],surfaces=[],stages=[];let forest,rebuild;
   const p=instancedArray(new Float32Array(fixture.frameData.centers),'vec3'),v=instancedArray(n,'vec3'),l=instancedArray(new Float32Array(fixture.restLengths),'float');
   try{
    patches.push(hydratePatch(fixture.patch));
    if(mode!=='single')patches.push(expanded?hydratePatch(fixture.napePatch):hydratePatch(fixture.patch));
    const domains=patches.map((patch,i)=>({id:specs[i].id,patch,motion:motionBuffers(patch),chains:mode==='single'?fixture.activeChains:specs[i].activeChains}));
    const options={renderer,groom:fixture.groom,positionBuffer:p,velocityBuffer:v,restLengthBuffer:l,outerIterations:iterations,lengthIterations:1,cacheQueryInputs:true};
    if(useForest){forest=createSurfaceForestQuery(domains,{chainCount:496});stages.push(createForestStage({...options,surface:forest,activeChains:fixture.activeChains}));}
    else for(const d of domains){const surface=createSurfaceQuery(d.patch,d.motion);surfaces.push(surface);stages.push(createStockStage({...options,surface,activeChains:d.chains}));}
    rebuild=makeRebuild(renderer,fixture,p);
    // Reset omits velocity finalization; initialize its independently owned buffer before readback.
    const velocityInit=Fn(()=>v.element(instanceIndex).assign(vec3(0)))().compute(n).setName('forest test velocity initialization');
    try{await renderer.computeAsync(velocityInit);}finally{velocityInit.dispose();}
    const nodes=[];for(const stage of stages)nodes.push(...(iterations===64?stage.nodes.slice(0,-1):stage.nodes));nodes.push(rebuild.node);await renderer.computeAsync(nodes);
    for(const stage of stages){const shader=renderer._nodes.getForCompute(stage.queryNode).computeShader;insist((shader.match(/var<storage/g)||[]).length===8,'Exactly eight stage query bindings');}
    const centers=await packed3(renderer,p,n),velocities=await packed3(renderer,v,n),vertices=await packed3(renderer,rebuild.vertices,n*2),count=496*32,planes=new Uint32Array(count*4),parameters=new Uint32Array(count),cache=new Uint32Array(count*4),reuse=new Uint32Array(count);
    for(let index=0;index<stages.length;index++){
     const stage=stages[index],chains=useForest||mode==='single'?fixture.activeChains:domains[index].chains,plane=await read(renderer,stage.namedBuffers.planes),parameter=await read(renderer,stage.namedBuffers.parameters),c=await read(renderer,stage.namedBuffers.cache),meta=new Float32Array((await read(renderer,stage.namedBuffers.metadata)).buffer),contacts=stage.counts.contactCount;
     for(let local=0;local<chains.length;local++)for(let k=0;k<32;k++){
      const from=local*32+k,to=chains[local]*32+k;planes.set(plane.subarray(from*4,from*4+4),to*4);parameters[to]=parameter[from];cache.set(c.subarray(from*4,from*4+4),to*4);reuse[to]=meta[(contacts*2+from)*4+3];
      // Compare local IDs in each domain. The canonical source ID remains independently tested above.
      if(useForest&&cache[to*4]!==0xffffffff){const descriptor=forest.layout.domains.find(d=>domains.find(x=>x.id===d.id).chains.includes(chains[local]));cache[to*4]-=descriptor.triangleStart;}
     }
    }
    for(const [name,bits]of Object.entries({centers,velocities,vertices,planes,parameters}))insist(new Float32Array(bits.buffer).every(Number.isFinite),'Finite stage '+name);
    const result={centers,velocities,vertices,planes,parameters,cache,reuse};
    if(mode==='partition-independent'||mode==='partition-forest')for(const name of['centers','velocities','vertices','planes','parameters','cache','reuse'])equal(result[name],results.single[name],fixture.label+' '+mode+' '+iterations+' '+name);
    if(mode==='nape-forest')for(const name of Object.keys(result))equal(result[name],results['nape-independent'][name],fixture.label+' '+mode+' '+iterations+' '+name);
    results[mode]=result;const channels={};for(const [name,bits]of Object.entries(result))channels[name]={length:bits.length,sha256:await hash(bits)};
    rows.push({label:fixture.label,mode,iterations,channels,resources:memory(renderer),queryStorageBindings:8,stages:stages.length,forest:forest?.layout??null});
   }finally{stages.forEach(s=>s.dispose());surfaces.forEach(s=>s.dispose(renderer));forest?.dispose(renderer);rebuild?.dispose();for(const b of[p,v,l])renderer._attributes.delete(b.value);patches.forEach(disposePatch);}
   equal(Object.values(memory(renderer)),Object.values(before),'Per-arm stage cleanup');
  }
 }}finally{after=memory(renderer);equal(Object.values(after),Object.values(before),'Final stage cleanup');renderer.dispose();}
 return{passed:true,rows,before,after};
}

/** A missing per-chain facade must fail visibly, not silently exercise the first surface twice. */
export async function runForestSelectorWitness(){
 const renderer=new WebGPURenderer({canvas:document.createElement('canvas')});await renderer.init();insist(renderer.backend.isWebGPUBackend,'Actual WebGPU required');const before=memory(renderer),patches=[],arms=[];let forest,after;
 try{
  const positions=[0,0,0,1,0,0,0,1,0,0,0,.2,1,0,.2,0,1,.2],normals=Array.from({length:6},()=>[0,0,1]).flat();
  for(const ids of[[0],[0,1]])patches.push(createPatch({bodyIndices:[0,1,2,3,4,5],sourceTriangleIds:ids,sourcePositions:positions,sourceNormals:normals}));
  forest=createSurfaceForestQuery(patches.map((patch,i)=>({id:'domain'+i,patch,motion:motionBuffers(patch),chains:[i]})),{chainCount:2});
  const groom={chainCount:2,pointsPerChain:3,particleCount:6,restOffsets:Array.from({length:6},()=>[.01,0,0]).flat()},points=Array.from({length:6},(_,i)=>[.2+i%3*.1,.2,i<3?.00005:.20005]).flat();
  for(const scoped of[false,true]){
   const p=instancedArray(new Float32Array(points),'vec3'),v=instancedArray(6,'vec3'),l=instancedArray(new Float32Array([0,.1,.1,0,.1,.1]),'float');let stage;
   try{
    const surface=scoped?forest:{query:forest.query,querySegment:forest.querySegment,mayOverlapSegment:forest.mayOverlapSegment};
    stage=createForestStage({renderer,groom,positionBuffer:p,velocityBuffer:v,restLengthBuffer:l,surface,activeChains:[0,1],outerIterations:1});await renderer.computeAsync(stage.queryNode);
    const c=await read(renderer,stage.namedBuffers.cache),active=Array.from({length:8},(_,i)=>c[i*4+1]);insist(active.slice(0,4).every(x=>x===1),'First domain witness active');
    insist(active.slice(4).every(x=>x===(scoped?1:0)),'Missing facade must lose exactly the second domain');arms.push({scoped,active});
   }finally{stage?.dispose();for(const b of[p,v,l])renderer._attributes.delete(b.value);}
  }
 }finally{forest?.dispose(renderer);patches.forEach(disposePatch);after=memory(renderer);equal(Object.values(after),Object.values(before),'selector witness resources');renderer.dispose();}
 return{passed:true,arms,before,after};
}
