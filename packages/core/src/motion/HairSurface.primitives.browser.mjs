/** Browser-only WebGPU regression support. Core modules and tracked fixtures only. */
import { WebGPURenderer } from 'three/webgpu';
import { Fn, instancedArray, instanceIndex, uniform, uint, float, vec3, vec4, bool, select } from 'three/tsl';
import { createPatch, updateFromCaptured, motionBuffers, resetHistory, disposePatch } from './HairSurface.js';
import { createSurfaceQuery } from './HairSurfaceQuery.js';
import { createSurfaceContactStage } from './HairSurfaceContact.js';
import { closestSegmentTriangle } from './fixtures/hair-segment-oracle.mjs';
const f32 = values => values.map(Math.fround);
const norm = values => Math.hypot(...values);
const delta = (a,b) => a.map((v,k)=>v-b[k]);
const unitTriangle = [[0,0,0],[1,0,0],[0,1,0]];
const normals = [0,0,1,0,0,1,0,0,1];
const patchFor = triangle => createPatch({bodyIndices:[0,1,2],sourceTriangleIds:[0],sourcePositions:triangle.flat(),sourceNormals:normals});
const free = (renderer,buffers) => buffers.forEach(b=>renderer._attributes?.delete(b.value));
const readFloat = async (renderer,buffer) => Array.from(new Float32Array(await renderer.getArrayBufferAsync(buffer.value)));
const readUint = async (renderer,buffer) => Array.from(new Uint32Array(await renderer.getArrayBufferAsync(buffer.value)));
function queryHarness(renderer,patch,count=1) {
    const surface=createSurfaceQuery(patch,motionBuffers(patch)),alpha=uniform(1),seed=uniform(0xffffffff,'uint');
    const input=instancedArray(count*2,'vec4'),output=instancedArray(count*5,'vec4');
    const node=Fn(()=>{
        const i=instanceIndex,base=i.mul(5);
        const hit=surface.querySegment(input.element(i.mul(2)).xyz,input.element(i.mul(2).add(1)).xyz,seed,alpha);
        output.element(base).assign(vec4(hit.closest,hit.signedDistance));
        output.element(base.add(1)).assign(vec4(hit.segmentPoint,hit.segmentT));
        output.element(base.add(2)).assign(vec4(hit.barycentric,select(hit.valid,float(1),float(0))));
        output.element(base.add(3)).assign(vec4(hit.normal,select(hit.openBoundary,float(1),float(0))));
        output.element(base.add(4)).assign(vec4(float(hit.sourceTriangle),float(hit.orderedTriangle),float(hit.nodesVisited),float(hit.trianglesTested)));
    })().compute(count).setName('core hair segment primitive regression');
    return {surface,alpha,seed,input,async run(segments){segments.forEach(({start,end},i)=>input.value.array.set([...start,0,...end,0],i*8));input.value.needsUpdate=true;surface.update();await renderer.computeAsync(node);const raw=await readFloat(renderer,output);return segments.map((_,i)=>({closest:raw.slice(i*20,i*20+4),segment:raw.slice(i*20+4,i*20+8),barycentric:raw.slice(i*20+8,i*20+12),normal:raw.slice(i*20+12,i*20+16),details:raw.slice(i*20+16,i*20+20)}));},dispose(){node.dispose();surface.dispose(renderer);free(renderer,[input,output]);disposePatch(patch);}};
}
function verify(start,end,triangle,actual,uniqueT=false) {
    const expected=closestSegmentTriangle(start,end,...triangle),distanceErrorMm=Math.abs(Math.abs(actual.closest[3])-expected.distance)*1000;
    const t=actual.segment[3],weights=actual.barycentric.slice(0,3),closest=actual.closest.slice(0,3),point=actual.segment.slice(0,3);
    const segmentReconstructionMm=norm(delta(point,start.map((v,k)=>v+(end[k]-v)*t)))*1000;
    const triangleReconstructionMm=norm(delta(closest,[0,1,2].map(k=>triangle.reduce((s,p,i)=>s+p[k]*weights[i],0))))*1000;
    const measuredDistanceMm=Math.abs(norm(delta(point,closest))-Math.abs(actual.closest[3]))*1000;
    const uniqueClosestErrorMm=uniqueT?norm(delta(closest,expected.trianglePoint))*1000:null;
    const uniqueSegmentErrorMm=uniqueT?norm(delta(point,expected.segmentPoint))*1000:null;
    const signDot=delta(point,closest).reduce((s,v,k)=>s+v*actual.normal[k],0);
    const signConsistent=Math.abs(actual.closest[3])<1e-12||((actual.closest[3]<0)===(signDot<0));
    const finite=Object.values(actual).flat().every(Number.isFinite),valid=actual.barycentric[3]===1;
    return {distanceErrorMm,segmentReconstructionMm,triangleReconstructionMm,measuredDistanceMm,uniqueClosestErrorMm,uniqueSegmentErrorMm,t,expectedT:expected.segmentT,signConsistent,finite,valid,
        passed:finite&&valid&&t>=0&&t<=1&&weights.every(w=>w>=-1e-5&&w<=1+1e-5)&&Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-5&&distanceErrorMm<.001&&segmentReconstructionMm<.001&&triangleReconstructionMm<.001&&measuredDistanceMm<.001&&signConsistent&&(!uniqueT||(uniqueClosestErrorMm<.001&&uniqueSegmentErrorMm<.001)),expected};
}
async function primitives(renderer,fixtures) {
    const patch=patchFor(unitTriangle),state=queryHarness(renderer,patch),rows=[];
    try {for(const c of fixtures){const triangle=c.triangle.map(f32),start=f32(c.start),end=f32(c.end);updateFromCaptured(patch,triangle.flat(),normals,{reset:true});const [actual]=await state.run([{start,end}]);rows.push({name:c.name,family:c.family,check:verify(start,end,triangle,actual,c.uniqueT),actual});}}
    finally{state.dispose();}return rows;
}
// More than one BVH leaf; a stale or distant seed must only give an upper bound.
async function bvh(renderer) {
    const positions=[],indices=[],ns=[];
    for(let y=0;y<3;y++)for(let x=0;x<3;x++){const base=positions.length/3;positions.push(x*.4,y*.4,0,(x+1)*.4,y*.4,0,x*.4,(y+1)*.4,0);indices.push(base,base+1,base+2);ns.push(...normals);}
    const patch=createPatch({bodyIndices:indices,sourceTriangleIds:Array.from({length:9},(_,i)=>i),sourcePositions:positions,sourceNormals:ns});resetHistory(patch);
    const state=queryHarness(renderer,patch,12),rows=[];
    try {
        const moved=positions.map((v,i)=>v+(i%3===2?.1:0));updateFromCaptured(patch,moved,ns,{advanceHistory:true});
        for(const alpha of [0,.5,1]){state.alpha.value=alpha;const pos=id=>[0,1,2].map(k=>positions[patch.sourceVertexIds[id]*3+k]+(k===2?.1*alpha:0));
            const segments=Array.from({length:12},(_,i)=>({start:f32([-.1+i*.11,.15+(i%3)*.4,-.03]),end:f32([.21+i*.085,.15+(i%3)*.4,.15])}));
            const expected=segments.map(({start,end})=>{let best=null;for(let i=0;i<9;i++){const tri=Array.from(patch.triangles.slice(i*4,i*4+3)).map(pos),h=closestSegmentTriangle(start,end,...tri);if(!best||h.distance<best.distance)best=h;}return best;});
            let unseeded;
            for(const seed of [0xffffffff,0,8,0xfffffffe]){state.seed.value=seed;const actual=await state.run(segments);if(!unseeded)unseeded=actual;
                actual.forEach((hit,i)=>{const triangle=Array.from(patch.triangles.slice(Math.round(hit.details[1])*4,Math.round(hit.details[1])*4+3)).map(pos),check=verify(segments[i].start,segments[i].end,triangle,hit),globalErrorMm=Math.abs(Math.abs(hit.closest[3])-expected[i].distance)*1000,seedDistanceDeltaMm=Math.abs(hit.closest[3]-unseeded[i].closest[3])*1000;
                    rows.push({alpha,seed,index:i,globalErrorMm,seedDistanceDeltaMm,check,passed:check.passed&&globalErrorMm<.001&&seedDistanceDeltaMm<.001});});
            }
        }
    }finally{state.dispose();}return rows;
}
const normalCases=[
 {name:'coplanar-Float32-tangent-residue',point:[2**-25,.25,0],closest:[0,.25,0],normal:[0,0,1],signed:2**-25,expected:[0,0,1]},
 {name:'intersection-Float32-oblique-residue',point:[2**-25,.25,-1e-9],closest:[0,.25,0],normal:[0,0,1],signed:-Math.hypot(2**-25,1e-9),expected:[0,0,1]},
 {name:'coordinate-scaled-contact-residue',point:[1e-6,16,0],closest:[0,16,0],normal:[0,0,1],signed:1e-6,expected:[0,0,1]},
 {name:'separated-open-boundary-10-micrometres',point:[-1e-5,1.5,0],closest:[0,1.5,0],normal:[0,0,1],signed:1e-5,expected:[-1,0,0]},
 {name:'separated-oblique-inside-distance-gradient',point:[-1e-4,.25,-1e-4],closest:[0,.25,0],normal:[0,0,1],signed:-Math.SQRT2*1e-4,expected:[Math.SQRT1_2,0,Math.SQRT1_2]},
 {name:'actual-query-coplanar-entry',start:[-1,.25,0],end:[2,.25,0],triangle:unitTriangle,expected:[0,0,1]},
 {name:'actual-query-transverse-intersection',start:[.25,.25,-1],end:[.25,.25,1],triangle:unitTriangle,expected:[0,0,1]},
 {name:'actual-query-separated-open-edge',retainsDistanceGradient:true,start:[-.00001,.25,-.001],end:[-.00001,.25,.001],triangle:unitTriangle,expected:[-1,0,0]}
];
function stageFor(renderer,surface,a,b){const positionBuffer=instancedArray(new Float32Array([...a,...b]),'vec3'),velocityBuffer=instancedArray(2,'vec3'),restLengthBuffer=instancedArray(new Float32Array([0,norm(delta(a,b))]),'float');
    const stage=createSurfaceContactStage({renderer,groom:{chainCount:1,pointsPerChain:2,particleCount:2,restOffsets:[.01,0,0,.01,0,0]},positionBuffer,velocityBuffer,restLengthBuffer,surface,activeChains:[0],outerIterations:1,lengthIterations:1});
    return {stage,dispose(){stage.dispose();free(renderer,[positionBuffer,velocityBuffer,restLengthBuffer]);}};
}
async function contactNormals(renderer){const rows=[];
    for(const c of normalCases){let patch,state,surface,gradient=null;
        if(c.triangle){patch=patchFor(c.triangle);state=queryHarness(renderer,patch);surface=state.surface;
            if(c.retainsDistanceGradient){const[h]=await state.run([{start:f32(c.start),end:f32(c.end)}]);const d=delta(h.segment.slice(0,3),h.closest.slice(0,3)),sign=h.closest[3]<0?-1:1;gradient=d.map(x=>sign*x/norm(d));}}
        else {const hit=()=>({closest:vec3(...c.closest),segmentPoint:vec3(...c.point),segmentT:float(.5),normal:vec3(...c.normal),signedDistance:float(c.signed),orderedTriangle:uint(0),openBoundary:bool(true),valid:bool(true),trianglesTested:uint(1),nodesVisited:uint(1)});surface={query:hit,querySegment:hit,mayOverlapSegment:()=>bool(true)};}
        const owner=stageFor(renderer,surface,c.start??c.point,c.end??c.point);
        try{await renderer.computeAsync(owner.stage.queryNode);const planes=await readFloat(renderer,owner.stage.namedBuffers.planes),cache=await readUint(renderer,owner.stage.namedBuffers.cache),parameters=await readFloat(renderer,owner.stage.namedBuffers.parameters),plane=planes.slice(4,8),normalError=norm(delta(plane.slice(0,3),c.expected)),distanceGradientError=gradient?norm(delta(plane.slice(0,3),gradient)):null;
            const finite=planes.every(Number.isFinite)&&parameters.every(Number.isFinite),active=cache[5]===1;rows.push({name:c.name,plane,normalError,distanceGradientError,finite,active,passed:finite&&active&&(gradient?distanceGradientError<1e-6&&plane[0]<-.99&&Math.abs(plane[2])<1e-6:normalError<1e-6)});
        }finally{owner.dispose();state?.dispose();}
    }return rows;
}
const boundsGroups=[
 {name:'static',currentY:0,previousY:0,low:[0,0,0],high:[1,1,0],cases:[
  {name:'endpoint-on-patch-box',a:[.25,.25,0],b:[.25,.25,0],radius:0},
  {name:'endpoint-exact-radius-boundary',a:[.25,.25,.01],b:[.25,.25,.01],radius:.01},
  {name:'endpoint-corner-radius-boundary',a:[-.01,0,.01],b:[-.01,0,.01],radius:Math.hypot(.01,.01)},
  {name:'far-above-endpoint',a:[.25,2.5,0],b:[.25,2.5,0],radius:.01,mustExclude:true},
  {name:'far-forward-segment',a:[.25,.25,1],b:[.75,.25,1],radius:.01,mustExclude:true},
  {name:'endpoints-outside-segment-crosses-box',a:[-1,.25,0],b:[2,.25,0],radius:0},
  {name:'segment-crosses-patch-plane',a:[.25,.25,-1],b:[.25,.25,1],radius:0},
  {name:'just-outside-radius-may-be-admitted',a:[.25,.25,.010000000000000002],b:[.25,.25,.010000000000000002],radius:.01},
  {name:'box-overlap-is-not-triangle-contact',a:[.8,1,0],b:[1,.8,0],radius:0}
 ]},
 {name:'swept-union',currentY:2,previousY:0,low:[0,0,0],high:[1,3,0],cases:[
  {name:'mid-sweep-outside-current-pose-box',a:[.25,1.5,0],b:[.25,1.5,0],radius:0},
  {name:'far-above-entire-sweep',a:[.25,4.5,0],b:[.25,4.5,0],radius:.1,mustExclude:true},
  {name:'segment-swept-radius-boundary',a:[-.2,.5,.05],b:[1.2,2.5,.05],radius:.05}
 ]}
];
async function bounds(renderer){const rows=[];let clearing;
 for(const group of boundsGroups){const patch=patchFor(unitTriangle.map(p=>[p[0],p[1]+group.previousY,p[2]]));resetHistory(patch);updateFromCaptured(patch,unitTriangle.map(p=>[p[0],p[1]+group.currentY,p[2]]).flat(),normals,{advanceHistory:true});const surface=createSurfaceQuery(patch,motionBuffers(patch));
  try{for(const c of group.cases){const output=instancedArray(1,'uint'),node=Fn(()=>output.element(uint(0)).assign(select(surface.mayOverlapSegment(vec3(...c.a),vec3(...c.b),float(c.radius)),uint(1),uint(0))))().compute(1);
   try{await renderer.computeAsync(node);const admitted=(await readUint(renderer,output))[0]===1,gap=[0,1,2].map(k=>Math.max(group.low[k]-Math.max(c.a[k],c.b[k]),Math.min(c.a[k],c.b[k])-group.high[k],0)),doubleLowerBound=norm(gap),mustInclude=doubleLowerBound<=c.radius;rows.push({name:c.name,group:group.name,admitted,doubleLowerBound,radius:c.radius,mustInclude,mustExclude:!!c.mustExclude,passed:(!mustInclude||admitted)&&(!c.mustExclude||!admitted)});}finally{node.dispose();free(renderer,[output]);}}
   if(group.name==='static'){const owner=stageFor(renderer,surface,[.25,2,0],[.25,2.1,0]),{stage}=owner;stage.namedBuffers.cache.value.array.set([17,1,777,888,23,1,777,888]);stage.namedBuffers.planes.value.array.fill(7);stage.namedBuffers.parameters.value.array.fill(.7);
    try{await renderer.computeAsync(stage.queryNode);const cache=await readUint(renderer,stage.namedBuffers.cache),planes=await readFloat(renderer,stage.namedBuffers.planes),parameters=await readFloat(renderer,stage.namedBuffers.parameters);clearing={cache,planes,parameters,passed:JSON.stringify(cache)===JSON.stringify([17,0,0,0,23,0,0,0])&&planes.every(x=>x===0)&&parameters[0]===1&&parameters[1]===0};}finally{owner.dispose();}}
  }finally{surface.dispose(renderer);disposePatch(patch);}}
 return{rows,clearing};
}
export async function runHairSurfacePrimitives(fixtures,{only=null}={}) {
    const renderer=new WebGPURenderer({canvas:document.createElement('canvas')});await renderer.init();
    if(!renderer.backend.isWebGPUBackend)throw Error('Actual WebGPU backend required');
    const resource=()=>({storage:renderer.info.memory.storageAttributes,bytes:renderer.info.memory.storageAttributesSize,compute:[...renderer._pipelines.caches.values()].filter(x=>x.isComputePipeline).length});
    const report={environment:{userAgent:navigator.userAgent,backend:'WebGPU',adapter:renderer.backend.device.adapterInfo?{...renderer.backend.device.adapterInfo}:null},before:resource()};
    try{if(!only||only==='primitives')report.primitives=await primitives(renderer,fixtures);if(!only)report.bvh=await bvh(renderer);if(!only||only==='normals')report.normals=await contactNormals(renderer);if(!only)report.bounds=await bounds(renderer);report.after=resource();return report;}finally{renderer.dispose();}
}
