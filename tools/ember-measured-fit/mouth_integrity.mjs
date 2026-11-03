// Two-state, read-only triangle crossing diagnostic. No anatomy or appearance pass.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
const directory='docs/evidence/ember-2026-10-31-eye-bridge/';
const source=directory+'candidate.glb';
const expected='bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef';
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const limits={states:[0,.45],seconds:20,candidatePairsPerState:100000,reportBytes:1048576,heapMiB:256};
const sourceHash=digest(source);if(sourceHash!==expected)throw Error('Frozen source changed');
const g=readGlb(source),j=g.json;
const selected=['base.001','teeth_base','tongue01'];
const data=selected.map(name=>{
 const meshIndex=j.meshes.findIndex(m=>m.name===name),m=j.meshes[meshIndex];
 if(!m||m.primitives.length!==1)throw Error('Unexpected mesh '+name);
 const p=m.primitives[0],k=m.extras.targetNames.indexOf('jawOpen');
 if(k<0||(m.weights??[]).some(w=>w!==0))throw Error('Unexpected rest morphs');
 return {name,meshIndex,positions:readAccessor(g,p.attributes.POSITION).data,
  delta:readAccessor(g,p.targets[k].POSITION).data,index:readAccessor(g,p.indices).data};
});
const parents=new Map();j.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
const matrices=new Map();
function world(i){if(matrices.has(i))return matrices.get(i);const n=j.nodes[i];
 const m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));
 if(parents.has(i))m.premultiply(world(parents.get(i)));matrices.set(i,m);return m;}
const identity=new Matrix4();
const difference=m=>Math.max(...m.elements.map((v,i)=>Math.abs(v-identity.elements[i])));
let meshTransformError=0,bindError=0;
for(const [i,n]of j.nodes.entries())if(data.some(m=>m.meshIndex===n.mesh)){
 if((n.weights??[]).some(w=>w!==0))throw Error('Nonzero node rest morph');
 meshTransformError=Math.max(meshTransformError,difference(world(i)));
 const skin=j.skins[n.skin];if(!skin)throw Error('Missing skin');
 const inverse=readAccessor(g,skin.inverseBindMatrices).data;
 skin.joints.forEach((bone,k)=>{const b=world(bone).clone().multiply(new Matrix4().fromArray(inverse,k*16));bindError=Math.max(bindError,difference(b));});
}
if(meshTransformError>1e-8||bindError>2e-6)throw Error('Raw coordinates cannot stand for rest-skinned world positions');
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
function triangle(v,ids){const points=ids.map(i=>Array.from(v.subarray(i*3,i*3+3)));
 const normal=cross(sub(points[1],points[0]),sub(points[2],points[0]));
 return {points,normal,area2:norm(normal),min:[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),max:[0,1,2].map(a=>Math.max(...points.map(p=>p[a])))};}
function triangles(d,w){const v=Float64Array.from(d.positions,(x,i)=>x+w*d.delta[i]);const out=[];
 for(let i=0;i<d.index.length;i+=3)out.push(triangle(v,Array.from(d.index.subarray(i,i+3))));return out;}
// Moller-Trumbore segment/triangle test with interior-only witnesses. Boundary
// contacts and coplanar overlaps are deliberately excluded from crossing claims.
function segment(a,b,t){const direction=sub(b,a),e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross(direction,e2),det=dot(e1,h);
 const scale=norm(direction)*norm(e1)*norm(e2);if(scale===0||Math.abs(det)<1e-10*scale)return null;
 const s=sub(a,t[0]),u=dot(s,h)/det;if(u<=1e-7||u>=1-1e-7)return null;
 const q=cross(s,e1),v=dot(direction,q)/det;if(v<=1e-7||u+v>=1-1e-7)return null;
 const along=dot(e2,q)/det,edgeLength=norm(direction);if(along*edgeLength<=1e-7||(1-along)*edgeLength<=1e-7)return null;
 return a.map((x,i)=>x+along*direction[i]);}
function intersect(a,b){
 if(a.area2<1e-14||b.area2<1e-14)return {kind:'degenerate'};
 const parallel=norm(cross(a.normal,b.normal))/(a.area2*b.area2)<1e-8;
 const distance=Math.abs(dot(a.normal,sub(b.points[0],a.points[0])))/a.area2;
 if(parallel&&distance<1e-7)return {kind:'coplanar-candidate'};
 for(const [from,to]of [[a,b],[b,a]])for(let e=0;e<3;e++){
  const p=segment(from.points[e],from.points[(e+1)%3],to.points);if(p)return {kind:'interior-crossing',point:p};
 }return {kind:'no-interior-crossing'};
}
function fixture(points){return triangle(new Float64Array(points.flat()),[0,1,2]);}
const fixtureA=fixture([[0,0,0],[1,0,0],[0,1,0]]);
const fixtureCases=[
 ['crossing',fixture([[.2,.2,-1],[.2,.2,1],[.7,.2,1]]),'interior-crossing'],
 ['separated',fixture([[0,0,1],[1,0,1],[0,1,1]]),'no-interior-crossing'],
 ['coplanar',fixture([[.1,.1,0],[.6,.1,0],[.1,.6,0]]),'coplanar-candidate'],
 ['edge-contact',fixture([[0,0,0],[1,0,0],[.5,0,1]]),'no-interior-crossing'],
 ['degenerate',fixture([[0,0,0],[0,0,0],[0,0,0]]),'degenerate']
];
const fixtureResults=fixtureCases.map(([name,b,wanted])=>{const actual=intersect(fixtureA,b).kind;if(actual!==wanted)throw Error('Checker fixture failed: '+name);return {name,actual};});
const preflight={source,sourceHash,checkerHash:digest('tools/ember-measured-fit/mouth_integrity.mjs'),limits,
 meshTransformError,bindError,meshes:data.map(d=>({name:d.name,vertices:d.positions.length/3,triangles:d.index.length/3})),
 maximumAabbComparisons:2*448*(26756+7120),fixtureResults,
 interpretation:'Noncoplanar interior triangle crossings only. Coplanar/boundary contacts, mesh containment without surface crossings and full anatomy are not qualified.'};
if(process.argv.includes('--preflight')){
 fs.writeFileSync(directory+'mouth-integrity-preflight.json',JSON.stringify(preflight,null,2)+'\n');console.log(JSON.stringify(preflight));
}else if(process.argv.includes('--run-admitted-two-states')){
 const prior=JSON.parse(fs.readFileSync(directory+'mouth-integrity-preflight.json'));
 if(prior.checkerHash!==preflight.checkerHash||prior.sourceHash!==sourceHash)throw Error('Preflight changed');
 fs.writeFileSync(directory+'MOUTH-INTEGRITY.started.json',JSON.stringify({startedUtc:new Date().toISOString(),preflight,command:'node --max-old-space-size=256 tools/ember-measured-fit/mouth_integrity.mjs --run-admitted-two-states'},null,2)+'\n',{flag:'wx'});
 const start=performance.now(),states=[];let failure=null;
 try{
  let neutral;
  for(const weight of limits.states){
   const all=data.map(d=>triangles(d,weight));if(weight===0)neutral=all;
   const state={jawOpen:weight,pairCandidates:0,pairs:[],surfaceChanges:[]};
   for(let k=0;k<all.length;k++){
    const degenerate=[],rotatedBeyond90=[];
    all[k].forEach((t,i)=>{if(t.area2<1e-14)degenerate.push(i);else if(neutral[k][i].area2>=1e-14&&dot(t.normal,neutral[k][i].normal)<0)rotatedBeyond90.push(i);});
    state.surfaceChanges.push({mesh:data[k].name,degenerateCount:degenerate.length,degenerateExamples:degenerate.slice(0,16),normalBeyond90Count:rotatedBeyond90.length,normalBeyond90Examples:rotatedBeyond90.slice(0,16)});
   }
   for(const other of [0,1]){
    const result={pair:['tongue01',data[other].name],counts:{},examples:[],tongueTriangles:new Set(),otherTriangles:new Set()};
    for(let ti=0;ti<all[2].length;ti++){
     if((performance.now()-start)/1000>limits.seconds)throw Error('Time cap');
     const a=all[2][ti];
     for(let oi=0;oi<all[other].length;oi++){
      const b=all[other][oi];if(a.min.some((v,k)=>v>b.max[k]+1e-7||a.max[k]<b.min[k]-1e-7))continue;
      if(++state.pairCandidates>limits.candidatePairsPerState)throw Error('Candidate pair cap');
      const hit=intersect(a,b);result.counts[hit.kind]=(result.counts[hit.kind]??0)+1;
      if(hit.kind==='interior-crossing'){
       result.tongueTriangles.add(ti);result.otherTriangles.add(oi);
       if(result.examples.length<24)result.examples.push({tongueTriangle:ti,otherTriangle:oi,pointMetres:hit.point,tongueVertices:Array.from(data[2].index.subarray(ti*3,ti*3+3)),otherVertices:Array.from(data[other].index.subarray(oi*3,oi*3+3))});
      }
     }
    }
    result.tongueTriangles=[...result.tongueTriangles];result.otherTriangles=[...result.otherTriangles];state.pairs.push(result);
   }
   states.push(state);
  }
 }catch(e){failure=String(e);}
 const result={...preflight,seconds:(performance.now()-start)/1000,heapBytes:process.memoryUsage().heapUsed,failure,states,
  limitsOfConclusion:['Crossing can involve interior mouth lining or intended contact; a hit alone is not a visible defect.',
   'A normal rotation beyond90 degrees is a motion measurement, not proof of an inverted mesh.',
   'No-hit results do not establish anatomy, mouth occlusion, likeness, skin finish or dynamic clearance between the two samples.']};
 const serialized=JSON.stringify(result,null,2)+'\n';if(Buffer.byteLength(serialized)>limits.reportBytes)throw Error('Report size cap');
 fs.writeFileSync(directory+'mouth-integrity-result.json',serialized,{flag:'wx'});
 console.log(JSON.stringify({seconds:result.seconds,heapBytes:result.heapBytes,failure,states:states.map(s=>({jawOpen:s.jawOpen,pairCandidates:s.pairCandidates,pairs:s.pairs.map(p=>({pair:p.pair,counts:p.counts})),surfaceChanges:s.surfaceChanges}))}));if(failure)process.exitCode=1;
}else throw Error('Preflight or explicit admitted-run flag required');
