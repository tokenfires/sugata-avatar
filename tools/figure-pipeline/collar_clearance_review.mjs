// Independent CPU review of the final frozen collar export. No authoring or GPU claims.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Matrix4, Vector3 } from 'three';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { closestPointOnTriangle, SurfaceGrid } from './hair_geometry.mjs';
import { intersectTriangles } from './hair_surface.mjs';
import { transformCasualTrouserFit } from './casual_trouser_fit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHIVE = path.join(ROOT, 'captures/collar-clearance-paused-2026-09-13');
const ID = 'female_casualsuit01';
const SOURCE_SHA256 = '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783';
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const point = (p, i) => Array.from(p.slice(i * 3, i * 3 + 3));
const sub = (a, b) => a.map((v, k) => v - b[k]);
const add = (a, b) => a.map((v, k) => v + b[k]);
const scale = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = a => Math.hypot(...a);
const clamp = x => Math.max(0, Math.min(1, x));
const bounds = tri => ({min: [0,1,2].map(k => Math.min(...tri.map(v => v[k]))), max: [0,1,2].map(k => Math.max(...tri.map(v => v[k])))});
const boxDistance2 = (a, b) => [0,1,2].reduce((s,k) => s + Math.max(0, a.min[k]-b.max[k], b.min[k]-a.max[k]) ** 2, 0);

export function segmentDistance(a, b, c, d) {
    const u=sub(b,a), v=sub(d,c), w=sub(a,c), aa=dot(u,u), bb=dot(u,v), cc=dot(v,v), dd=dot(u,w), ee=dot(v,w);
    let s=0,t=0;
    if(aa<=1e-30 && cc<=1e-30) return {a,b:c,distance:norm(w)};
    if(aa<=1e-30) t=clamp(ee/cc);
    else if(cc<=1e-30) s=clamp(-dd/aa);
    else {
        const denom=aa*cc-bb*bb;
        s=denom>1e-30?clamp((bb*ee-cc*dd)/denom):0;
        t=(bb*s+ee)/cc;
        if(t<0){t=0;s=clamp(-dd/aa);}
        else if(t>1){t=1;s=clamp((bb-dd)/aa);}
    }
    const pa=add(a,scale(u,s)),pb=add(c,scale(v,t));
    return {a:pa,b:pb,distance:norm(sub(pa,pb)),s,t};
}

// For disjoint triangles the minimum is vertex/face or edge/edge. Intersection is
// tested separately, including non-coplanar edge-through-face and coplanar overlap.
export function triangleDistance(a,b) {
    if(boxDistance2(bounds(a),bounds(b))<=1e-20){
        const hit=intersectTriangles(a,b,1e-10);
        if(hit) return {distance:0,a:hit.points[0],b:hit.points[0],kind:hit.kind};
    }
    let best={distance:Infinity};
    const keep=x=>{if(x.distance<best.distance)best=x;};
    for(let k=0;k<3;k++){
        const cp=closestPointOnTriangle(a[k],...b).closest;
        keep({a:a[k],b:cp,distance:norm(sub(a[k],cp)),kind:'vertex-face'});
        const cq=closestPointOnTriangle(b[k],...a).closest;
        keep({a:cq,b:b[k],distance:norm(sub(cq,b[k])),kind:'face-vertex'});
        for(let j=0;j<3;j++)keep({...segmentDistance(a[k],a[(k+1)%3],b[j],b[(j+1)%3]),kind:'edge-edge'});
    }
    return best;
}

function triangles(mesh, selected=null) {
    const ids=selected??Array.from({length:mesh.indices.length/3},(_,i)=>i);
    return ids.map(id=>{const indices=Array.from(mesh.indices.slice(id*3,id*3+3));const vertices=indices.map(i=>point(mesh.positions,i));return {id,indices,vertices,...bounds(vertices)};});
}

export function topology(mesh, weldPositions=mesh.positions) {
    const groups=[],lookup=new Map(),groupOf=[];
    for(let i=0;i<mesh.positions.length/3;i++){
        const key=point(weldPositions,i).map(x=>Math.round(x/1e-7)).join(':');
        if(!lookup.has(key)){lookup.set(key,groups.length);groups.push([]);}
        groupOf[i]=lookup.get(key);groups[groupOf[i]].push(i);
    }
    const edges=new Map(),parent=groups.map((_,i)=>i),used=new Set();
    const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    for(let t=0;t<mesh.indices.length;t+=3)for(let k=0;k<3;k++){
        const a=groupOf[mesh.indices[t+k]],b=groupOf[mesh.indices[t+(k+1)%3]],key=a<b?`${a}:${b}`:`${b}:${a}`;
        if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b,t/3]);used.add(a);used.add(b);parent[root(a)]=root(b);
    }
    let maxWeldSeparation=0;
    for(const group of groups)for(const i of group)maxWeldSeparation=Math.max(maxWeldSeparation,norm(sub(point(mesh.positions,i),point(mesh.positions,group[0]))));
    return {weldTolerance:1e-7,weldedVertices:used.size,edges:edges.size,triangles:mesh.indices.length/3,eulerCharacteristic:used.size-edges.size+mesh.indices.length/3,
        boundaryEdges:[...edges.values()].filter(e=>e.length===1).length,
        nonmanifoldEdges:[...edges.values()].filter(e=>e.length>2).length,
        orientationErrors:[...edges.values()].filter(e=>e.length===2&&e[0][0]!==e[1][1]).length,
        components:new Set([...used].map(root)).size,maxWeldSeparation};
}

export function winding(p,tris) {
    let sum=0,correction=0;
    for(const tri of tris){
        const [a,b,c]=tri.vertices.map(v=>sub(v,p)),la=norm(a),lb=norm(b),lc=norm(c);
        const angle=2*Math.atan2(dot(a,cross(b,c)),la*lb*lc+dot(a,b)*lc+dot(b,c)*la+dot(c,a)*lb);
        const y=angle-correction,t=sum+y;correction=(t-sum)-y;sum=t;
    }
    return sum/(4*Math.PI);
}

// An independent parity check; grazing/edge hits are ambiguous, never silently
// counted as exterior. Fixed irrational-looking directions avoid axis alignment.
const PARITY_DIRECTIONS=[[1,.371,.127],[-.217,1,.413],[.319,-.173,1],[1,-.731,.229],[-.617,.331,-1]];
export function rayParity(origin,direction,tris){
    const length=norm(direction),d=scale(direction,1/length),hits=[];let ambiguous=false;
    for(const tri of tris){
        const [a,b,c]=tri.vertices,e1=sub(b,a),e2=sub(c,a),h=cross(d,e2),det=dot(e1,h);
        if(Math.abs(det)<1e-16)continue;
        const inv=1/det,s=sub(origin,a),u=dot(s,h)*inv;if(u<0||u>1)continue;
        const q=cross(s,e1),v=dot(d,q)*inv;if(v<0||u+v>1)continue;
        const t=dot(e2,q)*inv;if(t<=1e-10)continue;
        if(Math.min(u,v,1-u-v)<1e-9)ambiguous=true;hits.push(t);
    }
    hits.sort((a,b)=>a-b);for(let i=1;i<hits.length;i++)if(Math.abs(hits[i]-hits[i-1])<1e-9)ambiguous=true;
    return {crossings:hits.length,inside:ambiguous?null:hits.length%2===1,ambiguous};
}

function recomputeNormals(mesh){
    const out=new Float64Array(mesh.positions.length);
    for(let t=0;t<mesh.indices.length;t+=3){const ids=Array.from(mesh.indices.slice(t,t+3)),v=ids.map(i=>point(mesh.positions,i)),n=cross(sub(v[1],v[0]),sub(v[2],v[0]));for(const i of ids)for(let k=0;k<3;k++)out[3*i+k]+=n[k];}
    for(let i=0;i<out.length/3;i++){const n=point(out,i),length=norm(n);if(length)for(let k=0;k<3;k++)out[i*3+k]/=length;}
    return out;
}

export function compare(patch,target,{gridSteps=16,globalInside=false}={}){
    const targetTriangles=triangles(target),grid=new SurfaceGrid(target.positions,target.normals??recomputeNormals(target),target.indices);
    const rows=[];let denseCount=0,denseMinimum=Infinity,denseSignedMinimum=Infinity,negativeSamples=0,belowMargin=0;
    let minimum={distance:Infinity},crossings=0,windingMin=Infinity,windingMax=-Infinity,parityInside=0,parityAmbiguous=0,parityOutside=0;
    for(const tri of patch){
        const centroid=scale(tri.vertices.reduce(add,[0,0,0]),1/3),seed=grid.nearest(centroid);
        let best={distance:Math.abs(seed.signed),a:centroid,b:seed.closest,targetTriangle:seed.triangle/3,kind:'seed'};
        for(const other of targetTriangles){if(boxDistance2(tri,other)>best.distance**2+1e-20)continue;const hit=triangleDistance(tri.vertices,other.vertices);if(hit.distance<best.distance)best={...hit,targetTriangle:other.id};}
        if(best.distance===0)crossings++;
        if(best.distance<minimum.distance)minimum={teeTriangle:tri.id,...best};
        let sampledMinimum=Infinity,localSignedMinimum=Infinity,negative=0,under=0;
        for(let a=0;a<=gridSteps;a++)for(let b=0;b<=gridSteps-a;b++){
            const weights=[a,b,gridSteps-a-b].map(v=>v/gridSteps),p=[0,1,2].map(k=>tri.vertices.reduce((s,v,j)=>s+v[k]*weights[j],0)),hit=grid.nearest(p),distance=Math.abs(hit.signed);
            denseCount++;sampledMinimum=Math.min(sampledMinimum,distance);localSignedMinimum=Math.min(localSignedMinimum,hit.signed);
            if(hit.signed<0)negative++;if(hit.signed<.00148)under++;
        }
        denseMinimum=Math.min(denseMinimum,sampledMinimum);denseSignedMinimum=Math.min(denseSignedMinimum,localSignedMinimum);negativeSamples+=negative;belowMargin+=under;
        const w=globalInside?winding(centroid,targetTriangles):null;
        if(w!==null){windingMin=Math.min(windingMin,w);windingMax=Math.max(windingMax,w);}
        const parity=globalInside?PARITY_DIRECTIONS.map(d=>rayParity(centroid,d,targetTriangles)):null;
        if(parity)for(const r of parity){if(r.ambiguous)parityAmbiguous++;else if(r.inside)parityInside++;else parityOutside++;}
        rows.push({teeTriangle:tri.id,minimum:best,sampledMinimum,localSignedMinimum,negativeSamples:negative,belowSolverTolerance:under,winding:w,parity});
    }
    return {minimum,triangleCount:patch.length,targetTriangleCount:target.indices.length/3,crossingTriangles:crossings,
        dense:{gridSteps,samplesWithEdgeDuplicates:denseCount,minimumUnsigned:denseMinimum,minimumLocalNormalSigned:denseSignedMinimum,negativeLocalNormalSamples:negativeSamples,belowSolverMarginMinusTolerance:belowMargin},
        winding:globalInside?{min:windingMin,max:windingMax,centroidsTested:patch.length,insideByAbsoluteWindingOverHalf:rows.filter(r=>Math.abs(r.winding)>.5).length}:null,
        rayParity:globalInside?{directions:PARITY_DIRECTIONS,inside:parityInside,outside:parityOutside,ambiguous:parityAmbiguous}:null,rows};
}

// Reconstruct the solver's movable band and exact order-4 stencil independently
// from the accepted asset; do not assume every changed vertex was a solver DOF.
function solverStencil(source, recipe, steps=recipe.cfg.gridSteps){
    const groups=[],lookup=new Map(),groupOf=[];
    for(let i=0;i<source.vertexCount;i++){
        const p=point(source.positions,i),key=p.map(x=>Math.round(x/1e-7)).join(':');
        if(!lookup.has(key)){lookup.set(key,groups.length);groups.push({p,vertices:[],neighbors:new Map(),distance:Infinity});}
        groupOf[i]=lookup.get(key);groups[groupOf[i]].vertices.push(i);
    }
    const edges=new Map();
    for(let t=0;t<source.indices.length;t+=3)for(let k=0;k<3;k++){
        const a=groupOf[source.indices[t+k]],b=groupOf[source.indices[t+(k+1)%3]],key=a<b?`${a}:${b}`:`${b}:${a}`;
        if(!edges.has(key))edges.set(key,{a,b,count:0});edges.get(key).count++;
        const d=norm(sub(groups[a].p,groups[b].p));groups[a].neighbors.set(b,d);groups[b].neighbors.set(a,d);
    }
    const neck=[...edges.values()].filter(e=>e.count===1&&[e.a,e.b].every(i=>groups[i].p[1]>1.28&&Math.abs(groups[i].p[0])<.13));
    assert.equal(neck.length,20);for(const i of new Set(neck.flatMap(e=>[e.a,e.b])))groups[i].distance=0;
    const pending=new Set(groups.map((_,i)=>i));
    while(pending.size){let best=-1;for(const i of pending)if(best===-1||groups[i].distance<groups[best].distance)best=i;
        if(groups[best].distance>.06)break;pending.delete(best);
        for(const[i,d]of groups[best].neighbors)groups[i].distance=Math.min(groups[i].distance,groups[best].distance+d);
    }
    groups.forEach(g=>g.movable=g.distance<recipe.cfg.band&&g.p[1]>recipe.cfg.minimumY);
    const samples=[],seen=new Set(),activeTriangles=[];
    for(let t=0;t<source.indices.length;t+=3){
        const ids=Array.from(source.indices.slice(t,t+3)),gi=ids.map(i=>groupOf[i]);if(!gi.some(i=>groups[i].movable))continue;activeTriangles.push(t/3);
        for(let a=0;a<=steps;a++)for(let b=0;b<=steps-a;b++){
            const weights=[a,b,steps-a-b].map(v=>v/steps),terms=gi.map((g,k)=>[g,weights[k]]).filter(([,w])=>w>0).sort((a,b)=>a[0]-b[0]);
            const key=terms.flat().join(':');if(seen.has(key))continue;seen.add(key);if(!terms.some(([g])=>groups[g].movable))continue;
            samples.push({triangle:t/3,terms:terms.map(([g,w])=>({group:g,vertex:groups[g].vertices[0],weight:w,movable:groups[g].movable}))});
        }
    }
    assert.equal(groups.filter(g=>g.movable).length,recipe.movableGroups);assert.equal(activeTriangles.length,recipe.activeTriangles);
    if(steps===recipe.cfg.gridSteps)assert.equal(samples.length,recipe.samples);
    return {steps,groups:groups.filter(g=>g.movable).length,activeTriangles,samples};
}

function stencilResiduals(tee,body,stencil,recipe){
    const grid=new SurfaceGrid(body.positions,body.normals??recomputeNormals(body),body.indices),violations=[];
    let minimum={signed:Infinity},belowMargin=0;
    for(let i=0;i<stencil.samples.length;i++){
        const sample=stencil.samples[i],p=[0,1,2].map(k=>sample.terms.reduce((s,t)=>s+tee.positions[t.vertex*3+k]*t.weight,0)),hit=grid.nearest(p);
        const row={sample:i,triangle:sample.triangle,point:p,signed:hit.signed,targetTriangle:hit.triangle/3,terms:sample.terms};
        if(hit.signed<minimum.signed)minimum=row;if(hit.signed<recipe.cfg.margin)belowMargin++;
        if(hit.signed<recipe.cfg.margin-.00002)violations.push(row);
    }
    return {steps:stencil.steps,samples:stencil.samples.length,minimum,belowMargin,belowMarginMinusTolerance:violations.length,violations};
}

function replayAudit(source,candidate,body,states,inputs){
    const src=readGlb(source.file),def=src.json.meshes.find(m=>m.name===ID),node=src.json.nodes.find(n=>n.mesh===src.json.meshes.indexOf(def));
    assert.ok(!node.matrix&&!node.translation&&!node.rotation&&!node.scale);assert.ok(!def.primitives[0].targets?.length);
    const skin=src.json.skins[node.skin],bg=readGlb(body.file),bs=bg.json.skins[0],inverse=readAccessor(bg,bs.inverseBindMatrices).data;
    const inverseByName=new Map(bs.joints.map((j,i)=>[bg.json.nodes[j].name,new Matrix4().fromArray(inverse,i*16)]));
    const jointNames=skin.joints.map(j=>src.json.nodes[j].name),indices=source.attributes.JOINTS_0,weights=source.attributes.WEIGHTS_0;
    const priorFile=path.join(ROOT,'captures/tee-neckline-2026-09-13/casual-neckline-v2.glb'),prior=readPrimitive(readGlb(priorFile),ID);
    const captureRoot=path.join(ROOT,'captures/tee-neckline-2026-09-13/qualification-v1'),captureReportFile=path.join(captureRoot,'report.json'),captureReport=JSON.parse(fs.readFileSync(captureReportFile));inputs.push(priorFile,captureReportFile);
    const result=[];
    for(const state of states.filter(s=>s.id!=='authored')){
        const [hair,,stepText]=state.id.split('-'),step=Number(stepText),frameFile=path.join(captureRoot,`${hair}-current/meshes-${step}.json.gz`),priorFrameFile=path.join(captureRoot,`${hair}-fit/meshes-${step}.json.gz`);
        const descriptor=arm=>captureReport.runs.find(r=>r.id===`${hair}-${arm}`).samples.find(s=>s.step===step).geometry;
        assert.equal(sha(frameFile),descriptor('current').sha256);assert.equal(sha(priorFrameFile),descriptor('fit').sha256);inputs.push(frameFile,priorFrameFile);
        const frame=JSON.parse(gunzipSync(fs.readFileSync(frameFile))),priorFrame=JSON.parse(gunzipSync(fs.readFileSync(priorFrameFile))),rawFitFile=path.join(ARCHIVE,`cpu-native/${hair}-fit/meshes-${step}.json.gz`),rawFit=JSON.parse(gunzipSync(fs.readFileSync(rawFitFile)));
        assert.deepEqual(rawFit.rig,frame.rig);assert.equal(rawFit.time,frame.time);
        for(const id of ['body','foundation_bra','foundation_briefs','shoes01'])assert.deepEqual(rawFit.meshes.find(m=>m.id===id),frame.meshes.find(m=>m.id===id));
        const actual=frame.meshes.find(m=>m.id===ID).positions,actualPrior=priorFrame.meshes.find(m=>m.id===ID).positions;
        const matrices=jointNames.map(name=>new Matrix4().fromArray(frame.rig[name]).multiply(inverseByName.get(name)));
        const pose=(positions,i)=>{const v=new Vector3(...point(positions,i)),out=new Vector3();let sum=0;for(let k=0;k<4;k++)sum+=weights[i*4+k];assert.ok(sum>0);for(let k=0;k<4;k++){const w=weights[i*4+k]/sum;if(w)out.addScaledVector(v.clone().applyMatrix4(matrices[indices[i*4+k]]),w);}return out.toArray();};
        let maxSourceError=0,maxPriorAnchorError=0,maxCandidateAnchorError=0,candidateFloat32Mismatches=0;
        for(let i=0;i<source.vertexCount;i++){
            const p=pose(source.positions,i),q=pose(candidate.positions,i),r=pose(prior.positions,i);
            for(let k=0;k<3;k++){
                maxSourceError=Math.max(maxSourceError,Math.abs(p[k]-actual[i*3+k]));
                maxPriorAnchorError=Math.max(maxPriorAnchorError,Math.abs(actual[i*3+k]+r[k]-p[k]-actualPrior[i*3+k]));
                const predicted=Math.fround(actual[i*3+k]+q[k]-p[k]);
                maxCandidateAnchorError=Math.max(maxCandidateAnchorError,Math.abs(predicted-state.tee.positions[i*3+k]));
                if(predicted!==state.tee.positions[i*3+k])candidateFloat32Mismatches++;
            }
        }
        assert.ok(maxSourceError<1e-6&&maxPriorAnchorError<1e-6&&maxCandidateAnchorError<2e-7);
        result.push({state:state.id,sourceCaptureHashVerified:true,priorCaptureHashVerified:true,nonCandidateMeshesAndRigIdentical:true,maxSourceError,maxPriorAnchorError,maxCandidateAnchorError,candidateFloat32Mismatches});
    }
    return result;
}

export function selftest(){
    const a=[[0,0,0],[1,0,0],[0,1,0]],b=a.map(v=>add(v,[0,0,.002]));
    assert.ok(Math.abs(triangleDistance(a,b).distance-.002)<1e-14);
    assert.equal(triangleDistance(a,[[.2,.2,-1],[.2,.2,1],[.8,.2,1]]).distance,0);
    assert.equal(triangleDistance(a,[[.2,.2,0],[.7,.2,0],[.2,.7,0]]).distance,0);
    const edge=segmentDistance([-1,0,0],[1,0,0],[0,-1,.003],[0,1,.003]);assert.ok(Math.abs(edge.distance-.003)<1e-14);
    assert.ok(Math.abs(segmentDistance([0,0,0],[1,0,0],[2,1,0],[3,1,0]).distance-Math.SQRT2)<1e-14);
    const tetra={positions:[0,0,0,1,0,0,0,1,0,0,0,1],indices:[0,2,1,0,1,3,0,3,2,1,2,3]};
    assert.equal(topology(tetra).boundaryEdges,0);
    assert.ok(Math.abs(winding([.1,.1,.1],triangles(tetra))-1)<1e-12);
    assert.ok(Math.abs(winding([2,2,2],triangles(tetra)))<1e-12);
    assert.equal(rayParity([.1,.1,.1],PARITY_DIRECTIONS[0],triangles(tetra)).inside,true);
    assert.equal(rayParity([2,2,2],PARITY_DIRECTIONS[0],triangles(tetra)).inside,false);
    assert.equal(rayParity([-.1,0,0],[1,0,0],triangles(tetra)).ambiguous,true);
    const buried={positions:[.1,.1,.1,.2,.1,.1,.1,.2,.1],indices:[0,1,2]};
    assert.ok(Math.abs(winding([.13,.13,.1],triangles(tetra))-1)<1e-12);
    assert.ok(triangles(tetra).every(t=>triangleDistance(triangles(buried)[0].vertices,t.vertices).distance>0));
    return {casesPassed:12,pass:true,cases:['parallel separation','transverse intersection','coplanar intersection','interior edge-edge nearest','disjoint segments','closed tetrahedron','inside winding','outside winding','inside ray parity','outside ray parity','grazing ray rejection','contained triangle without crossing']};
}

export function reconstructAcceptedSource(outDir){
    const source=transformCasualTrouserFit(),file=path.join(outDir,'accepted-source.glb');
    assert.equal(createHash('sha256').update(source.bytes).digest('hex'),SOURCE_SHA256);
    fs.writeFileSync(file,source.bytes,{flag:'wx'});
    return {file,sha256:SOURCE_SHA256,method:'Reconstructed from immutable original trouser fixture; independent of the installed garment.',
        inputs:['tools/figure-pipeline/casual_trouser_fit.mjs','tools/figure-pipeline/casual_trouser_cuff.mjs','tools/figure-pipeline/fixtures/casual-g050-original.glb','assets/wardrobe/shoes01/g050.glb'].map(file=>({file,sha256:sha(path.join(ROOT,file))}))};
}

function loadAsset(id,name=id,fileOverride=null){const file=fileOverride??path.join(ROOT,`assets/wardrobe/${id}/g050.glb`),g=readGlb(file),p=readPrimitive(g,name),attrs=g.json.meshes.find(m=>m.name===name).primitives[0].attributes;return {...p,id,file,attributes:Object.fromEntries(Object.entries(attrs).map(([k,v])=>[k,readAccessor(g,v).data]))};}

export function run(outDir){
    fs.mkdirSync(outDir,{recursive:true});
    const sourceReconstruction=reconstructAcceptedSource(outDir);
    const candidateFile=path.join(ARCHIVE,'casual-collar-v2.glb'),source=loadAsset(ID,ID,sourceReconstruction.file),candidate=readPrimitive(readGlb(candidateFile),ID),body=loadAsset('body','base.001'),bra=loadAsset('foundation_bra');
    assert.equal(sha(candidateFile),'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e');
    assert.equal(sha(source.file),'44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783');
    assert.deepEqual(source.indices,candidate.indices);
    const moved=new Set(Array.from({length:source.vertexCount},(_,i)=>i).filter(i=>point(source.positions,i).some((v,k)=>v!==candidate.positions[i*3+k]))),changedTriangles=[];
    for(let t=0;t<source.indices.length;t+=3)if(Array.from(source.indices.slice(t,t+3)).some(i=>moved.has(i)))changedTriangles.push(t/3);
    const retained=[];for(let t=0;t<bra.indices.length;t+=3){const ids=Array.from(bra.indices.slice(t,t+3));if(ids.every(i=>bra.attributes._UNDER_FEMALE_CASUALSUIT01[i]<=.5))retained.push(...ids);}
    const inputs=[candidateFile,source.file,body.file,bra.file,path.join(ARCHIVE,'solve-v2.mjs'),path.join(ARCHIVE,'solve-v2.json')];
    const states=[{id:'authored',tee:candidate,body,bra:{...bra,indices:retained}}];
    for(const hair of ['bob02','bob01'])for(const step of [0,90,270]){
        const file=path.join(ARCHIVE,`cpu-native/${hair}-fit/meshes-${step}.json.gz`);inputs.push(file);
        const frame=JSON.parse(gunzipSync(fs.readFileSync(file))),get=id=>frame.meshes.find(m=>m.id===id),b=get('body'),br=get('foundation_bra'),tee=get(ID);
        assert.deepEqual(tee.fullIndices,Array.from(candidate.indices));assert.deepEqual(b.fullIndices,Array.from(body.indices));assert.deepEqual(br.drawnIndices,retained);
        states.push({id:`${hair}-native-${step}`,time:frame.time,tee:{positions:tee.positions,indices:tee.fullIndices},body:{positions:b.positions,indices:b.fullIndices},bra:{positions:br.positions,indices:br.drawnIndices}});
    }
    const recipe=JSON.parse(fs.readFileSync(path.join(ARCHIVE,'solve-v2.json'))),stencil4=solverStencil(source,recipe),stencil16=solverStencil(source,recipe,16);
    const replay=replayAudit(source,candidate,body,states,inputs);
    const report={version:4,createdAt:new Date().toISOString(),selftest:selftest(),sourceReconstruction,sourceSHA256:sha(source.file),candidateSHA256:sha(candidateFile),replay,
        instruments:['tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','tools/lut-bake/glb.mjs','node_modules/three/build/three.core.js','package-lock.json'].map(file=>({file,sha256:sha(path.join(ROOT,file))})),
        patch:{movedVertices:moved.size,changedTriangles,scope:'Every triangle incident to a position changed from accepted garment, including fixed boundary vertices.'},
        method:{wholeTriangle:'Exhaustive AABB-pruned minimum over vertex-face and edge-edge features, with a separate triangle-intersection predicate (1e-10 m tolerance). Final exported Float32 coordinates or frozen CPU native replays.',
            dense:'Order-16 barycentric lattice (153 samples per triangle), recomputed on final frozen state. Local smooth-normal sign is not a volume oracle.',
            containment:'Full-body closure/orientation checked after 1e-7 m authored positional weld, retained in poses; compensated solid-angle winding and five-direction non-grazing ray parity at every changed-triangle centroid. Whole-triangle positive separation makes each triangle disjoint from the body surface. The bra is an open sheet and has no canonical enclosed volume.'},
        inputs:inputs.map(file=>({file:path.relative(ROOT,file),sha256:sha(file)})),states:[],
        limits:['Only the 180 changed-incident triangles are evaluated, not all unchanged garment surfaces.','Six native arrays are existing CPU predictions anchored to prior GPU rig/body snapshots, not new GPU candidate geometry captures.','Three discrete pose times cannot qualify continuous motion or unseen identities.','Clearance is geometric; visual quality, foundation coverage and material behavior are separate.','Floating-point distances are not interval-arithmetic certificates. Body self-intersection is not globally audited.']};
    for(const state of states){
        const patch=triangles(state.tee,changedTriangles),bodyTopology=topology(state.body,body.positions),braTopology=topology(state.bra,bra.positions);
        const row={id:state.id,time:state.time,bodyTopology,retainedBraTopology:braTopology,
            solverStencilFinalResiduals:stencilResiduals(state.tee,state.body,stencil4,recipe),denseMovableSupportResiduals:stencilResiduals(state.tee,state.body,stencil16,recipe),
            fullBody:compare(patch,state.body,{globalInside:true}),retainedBra:compare(patch,state.bra)};
        report.states.push(row);fs.writeFileSync(path.join(outDir,`${state.id}.json`),JSON.stringify(row,null,2),{flag:'wx'});
        console.log(JSON.stringify({state:row.id,bodyMinimumMm:row.fullBody.minimum.distance*1000,bodyMinimumTriangle:row.fullBody.minimum.teeTriangle,bodySignedMinimumMm:row.fullBody.dense.minimumLocalNormalSigned*1000,
            solverStencilMinMm:row.solverStencilFinalResiduals.minimum.signed*1000,solverStencilViolations:row.solverStencilFinalResiduals.belowMarginMinusTolerance,denseSupportMinMm:row.denseMovableSupportResiduals.minimum.signed*1000,
            bodyWinding:row.fullBody.winding,braMinimumMm:row.retainedBra.minimum.distance*1000,braTriangle:row.retainedBra.minimum.teeTriangle,braNegativeLocalSamples:row.retainedBra.dense.negativeLocalNormalSamples}));
    }
    fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    if(process.argv.includes('--selftest'))console.log(JSON.stringify(selftest()));
    else {if(!process.argv[2])throw new Error('Usage: node collar_clearance_review.mjs FRESH_OUTPUT_DIRECTORY | --selftest');run(path.resolve(process.argv[2]));}
}
