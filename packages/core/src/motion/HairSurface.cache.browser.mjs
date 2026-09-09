/** Portable actual-WebGPU input-cache correctness probes; production modules only. */
import {WebGPURenderer} from 'three/webgpu';
import {instancedArray,uniform} from 'three/tsl';
import {createPatch,hydratePatch,motionBuffers,updateFromCaptured,disposePatch} from './HairSurface.js';
import {createSurfaceQuery} from './HairSurfaceQuery.js';
import {createSurfaceContactStage} from './HairSurfaceContact.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runCacheInvalidation(){
 const renderer=new WebGPURenderer({canvas:document.createElement('canvas')});await renderer.init();check(renderer.backend.isWebGPUBackend,'Actual WebGPU required');
 const resource=()=>({storage:renderer.info.memory.storageAttributes,bytes:renderer.info.memory.storageAttributesSize,compute:[...renderer._pipelines.caches.values()].filter(p=>p.isComputePipeline).length}),before=resource();
 const triangle=z=>[0,0,z,1,0,z,0,1,z],normals=[0,0,1,0,0,1,0,0,1],patch=createPatch({bodyIndices:[0,1,2],sourceTriangleIds:[0],sourcePositions:triangle(0),sourceNormals:normals}),query=createSurfaceQuery(patch,motionBuffers(patch)),alpha=uniform(1),surface={query:(p,s)=>query.query(p,s,alpha),querySegment:(a,b,s)=>query.querySegment(a,b,s,alpha),mayOverlapSegment:(a,b,r)=>query.mayOverlapSegment(a,b,r)};
 const positions=[.2,.2,.00005,.3,.2,.00005,.4,.2,.00005,.2,.3,.00005,.3,.3,.00005,.4,.3,.00005],groom={chainCount:2,pointsPerChain:3,particleCount:6,restOffsets:Array.from({length:6},()=>[.01,0,0]).flat()},states=[];
 for(const enabled of [false,true]){const p=instancedArray(new Float32Array(positions),'vec3'),v=instancedArray(6,'vec3'),l=instancedArray(new Float32Array([0,.1,.1,0,.1,.1]),'float'),stage=createSurfaceContactStage({renderer,groom,positionBuffer:p,velocityBuffer:v,restLengthBuffer:l,surface,activeChains:[0,1],outerIterations:2,lengthIterations:1,cacheQueryInputs:enabled});check(stage.counts.queryInputReuse?.enabled===enabled,'Production input-cache contract is absent');states.push({p,v,l,stage,enabled});}
 const read=async b=>new Uint32Array(await renderer.getArrayBufferAsync(b.value));
 const write=(s,xyz)=>{const stride=s.p.value.itemSize,data=new Float32Array(6*stride);for(let i=0;i<6;i++)data.set(xyz.slice(i*3,i*3+3),i*stride);renderer.backend.device.queue.writeBuffer(renderer.backend.get(s.p.value).buffer,0,data);};
 const rows=[];let priorPlanes,directDefaultOffTraversals;
 async function run(label,{snapshot=false,input=null,expected,changedPlane=false}={}){
  const results=[];
  for(const s of states){if(input)write(s,input);let invalidated;
   if(snapshot){await renderer.computeAsync(s.stage.snapshotNode);if(s.enabled){const m=new Float32Array((await read(s.stage.namedBuffers.metadata)).buffer),n=s.stage.counts.contactCount;invalidated=Array.from({length:n},(_,i)=>m[(n+i)*4+3]);check(invalidated.every(x=>x===0),'Snapshot failed to invalidate every record, including the second write range');}}
   await renderer.computeAsync(s.stage.queryNode);
   const planes=Array.from(await read(s.stage.namedBuffers.planes)),parameters=Array.from(await read(s.stage.namedBuffers.parameters)),cache=Array.from(await read(s.stage.namedBuffers.cache)),metadata=new Float32Array((await read(s.stage.namedBuffers.metadata)).buffer),n=s.stage.counts.contactCount;
   const flags=s.enabled?Array.from({length:n},(_,i)=>metadata[(n*2+i)*4+3]):Array(n).fill(0),positionBits=Array.from(await read(s.p));
   check(new Float32Array(new Uint32Array(planes).buffer).every(Number.isFinite),'Nonfinite plane');
   check(flags.every((flag,i)=>!flag||(cache[i*4+2]===0&&cache[i*4+3]===0)),'Reused queries claim traversal work');
   results.push({enabled:s.enabled,planes,parameters,cache,flags,invalidated,positionBits});
  }
  const [a,b]=results;check(JSON.stringify(a.planes)===JSON.stringify(b.planes),label+' plane mismatch');check(JSON.stringify(a.parameters)===JSON.stringify(b.parameters),label+' parameter mismatch');check(a.cache.every((x,i)=>i%4>=2||x===b.cache[i]),label+' nearest/active mismatch');
  if(expected)check(JSON.stringify(b.flags)===JSON.stringify(expected),label+' incorrect reuse flags '+JSON.stringify(b.flags));
  if(changedPlane)check(priorPlanes.some((x,i)=>x!==b.planes[i]),label+' control must change plane with identical query points');
  rows.push({label,results});priorPlanes=b.planes;return b;
 }
 try{
  await renderer.computeAsync(states[0].stage.queryNode);
  const directCache=await read(states[0].stage.namedBuffers.cache);directDefaultOffTraversals=Array.from(directCache).filter((x,i)=>i%4===3&&x>0).length;check(directDefaultOffTraversals===8,'Default-off direct queryNode must work before snapshot');
  await run('fresh-snapshot',{snapshot:true,expected:Array(8).fill(0)});
  await run('same-inputs',{expected:Array(8).fill(1)});
  positions[0]+=.01;await run('A-only-change-point-B-still-reuses',{input:positions,expected:[1,1,0,1,1,1,1,1]});
  const next=new Float32Array([positions[3]]);new Uint32Array(next.buffer)[0]++;positions[3]=next[0];await run('one-ULP-B-change-misses',{input:positions,expected:[0,1,0,0,1,1,1,1]});
  positions[12]=0;await run('positive-zero-input',{input:positions});positions[12]=-0;const zero=await run('negative-zero-is-different-bits',{input:positions,expected:[1,1,1,1,0,1,0,0]});check(zero.positionBits[4*states[1].p.value.itemSize]===0x80000000,'GPU must actually retain negative-zero input');
  updateFromCaptured(patch,triangle(.002),normals,{reset:true});query.update();await run('new-body-pose-snapshot-invalidates',{snapshot:true,expected:Array(8).fill(0),changedPlane:true});
  updateFromCaptured(patch,triangle(0),normals,{reset:true});updateFromCaptured(patch,triangle(.004),normals,{advanceHistory:true});query.update();alpha.value=0;await run('moving-body-alpha-zero',{snapshot:true,expected:Array(8).fill(0),changedPlane:true});
  await run('alpha-zero-repeat',{expected:Array(8).fill(1)});alpha.value=1;await run('alpha-one-snapshot-invalidates',{snapshot:true,expected:Array(8).fill(0),changedPlane:true});
  await run('alpha-one-repeat',{expected:Array(8).fill(1)});
 }finally{for(const s of states){s.stage.dispose();s.stage.dispose();for(const b of[s.p,s.v,s.l])renderer._attributes.delete(b.value);}query.dispose(renderer);disposePatch(patch);}
 const after=resource();renderer.dispose();check(JSON.stringify(after)===JSON.stringify(before),'Resources must return to baseline');return{rows,before,after,directDefaultOffTraversals,passed:true};
}

const bufferHash=async view=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',view))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function runFrozenCacheCases(fixtures){
 const renderer=new WebGPURenderer({canvas:document.createElement('canvas')});await renderer.init();check(renderer.backend.isWebGPUBackend,'Actual WebGPU required');
 const resource=()=>({storage:renderer.info.memory.storageAttributes,bytes:renderer.info.memory.storageAttributesSize,compute:[...renderer._pipelines.caches.values()].filter(p=>p.isComputePipeline).length}),before=resource(),results=[];let after;
 try{for(const fixture of fixtures)for(const enabled of [false,true]){
  const patch=hydratePatch(fixture.patch),surface=createSurfaceQuery(patch,{previousPositions:patch.positions,previousNormals:patch.normals,unionBoundsMin:patch.boundsMin,unionBoundsMax:patch.boundsMax}),n=fixture.groom.particleCount,p=instancedArray(new Float32Array(fixture.initialCenters),'vec3'),v=instancedArray(n,'vec3'),l=instancedArray(new Float32Array(fixture.restLengths),'float');let stage;
  try{stage=createSurfaceContactStage({renderer,groom:fixture.groom,positionBuffer:p,velocityBuffer:v,restLengthBuffer:l,surface,activeChains:fixture.activeChains,outerIterations:64,lengthIterations:1,cacheQueryInputs:enabled});check(stage.counts.queryInputReuse?.enabled===enabled,'Production input-cache contract is absent');
   const packed3=async buffer=>{const raw=new Float32Array(await renderer.getArrayBufferAsync(buffer.value)),out=new Float32Array(n*3),stride=buffer.value.itemSize;for(let i=0;i<n;i++)for(let k=0;k<3;k++)out[i*3+k]=raw[i*stride+k];return out;};
   const rows=[];await renderer.computeAsync(stage.nodes.slice(0,1+16*2));
   for(const iteration of [16,64]){if(iteration===64)await renderer.computeAsync(stage.nodes.slice(1+16*2));
    const centers=await packed3(p),velocities=iteration===64?await packed3(v):new Float32Array(n*3),planes=new Float32Array(await renderer.getArrayBufferAsync(stage.namedBuffers.planes.value)),parameters=new Float32Array(await renderer.getArrayBufferAsync(stage.namedBuffers.parameters.value)),rawCache=new Uint32Array(await renderer.getArrayBufferAsync(stage.namedBuffers.cache.value)),metadata=new Float32Array(await renderer.getArrayBufferAsync(stage.namedBuffers.metadata.value)),cache=new Uint32Array(stage.counts.contactCount*2);
    const reuse={reused:0,reusedActive:0,actualTraversals:0,rootBoundsRejected:0,reusedWorkNonzero:0},count=stage.counts.contactCount;
    for(let i=0;i<count;i++){cache[i*2]=rawCache[i*4];cache[i*2+1]=rawCache[i*4+1];const reused=enabled?metadata[(count*2+i)*4+3]:0;check(reused===0||reused===1,'Reuse flag must be0 or1');if(reused){reuse.reused++;reuse.reusedActive+=rawCache[i*4+1];reuse.reusedWorkNonzero+=rawCache[i*4+2]||rawCache[i*4+3]?1:0;}else if(rawCache[i*4+3]>0)reuse.actualTraversals++;else reuse.rootBoundsRejected++;}
    const channels={};for(const[key,array]of Object.entries({centers,velocities,planes,parameters,cache})){check(array.every(Number.isFinite),key+' must be finite');channels[key]={length:array.length,sha256:await bufferHash(array)};}
    rows.push({iteration,channels,reuse});
   }
   results.push({label:fixture.label,enabled,counts:stage.counts,rows});
  }finally{stage?.dispose();surface.dispose(renderer);for(const b of[p,v,l])renderer._attributes?.delete(b.value);disposePatch(patch);}
 }}finally{after=resource();renderer.dispose();check(JSON.stringify(after)===JSON.stringify(before),'Frozen fixture resources must return to baseline');}
 return{before,after,results};
}
