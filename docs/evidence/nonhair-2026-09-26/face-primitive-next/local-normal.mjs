// Evidence-local arithmetic. No source assets, renderer, scene ownership or mutation.
import assert from 'node:assert/strict';
import {intersectTriangles} from '../../../../tools/figure-pipeline/hair_surface.mjs';
export const CONTACT_EPSILON_M = 1e-9;
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const dot = (a,b) => a.reduce((v,x,i)=>v+x*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
const unit = a => {const n=length(a);assert.ok(Number.isFinite(n)&&n>0,'Degenerate geometric normal sum');return a.map(x=>x/n);};
const vec = (p,i) => Array.from(p.slice(i*3,i*3+3));
const same = (a,b) => a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const finite = a => assert.ok(Array.from(a).every(Number.isFinite),'Nonfinite geometry');
function triangle(p,indices,f) {return Array.from(indices.slice(f*3,f*3+3),i=>vec(p,i));}
function areaVector(tri) {
    const n=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));
    const longest=Math.max(length(sub(tri[0],tri[1])),length(sub(tri[0],tri[2])),length(sub(tri[1],tri[2])));
    assert.ok(longest>CONTACT_EPSILON_M&&length(n)/longest>CONTACT_EPSILON_M,'Degenerate triangle altitude');
    return n;
}
export function transportNormal(authored,g0,g1) {
    finite([...authored,...g0,...g1]);assert.ok(length(authored)>0,'Degenerate authored normal');
    const a=unit(g0),b=unit(g1),d=dot(a,b);
    assert.ok(d>0,'Opposite or nonpositive geometric normal hemisphere');
    if(same(a,b))return authored.slice();
    const v=cross(a,b);if(v.every(x=>x===0))return authored.slice();
    // Unit quaternion [cross(a,b), 1+dot(a,b)] supplies the unique shortest rotation.
    const q=[...v,1+d],qn=Math.hypot(...q);assert.ok(Number.isFinite(qn)&&qn>0,'Invalid normal rotation');
    for(let i=0;i<4;i++)q[i]/=qn;
    const t=cross(q.slice(0,3),authored).map(x=>2*x),u=cross(q.slice(0,3),t);
    const out=authored.map((x,i)=>x+q[3]*t[i]+u[i]);finite(out);return out;
}
export function transportLocalNormals({positions,normals,displaced,indices,mapping}) {
    assert.equal(positions.length%3,0);assert.equal(normals.length,positions.length);assert.equal(displaced.length,positions.length);assert.equal(mapping.length,positions.length/3);assert.equal(indices.length%3,0);
    finite(positions);finite(normals);finite(displaced);
    const count=mapping.length,groups=new Map();
    for(let i=0;i<count;i++) {assert.ok(Number.isSafeInteger(mapping[i])&&mapping[i]>=0,'Invalid source mapping');if(!groups.has(mapping[i]))groups.set(mapping[i],[]);groups.get(mapping[i]).push(i);}
    for(const group of groups.values())for(const i of group) {
        assert.ok(same(vec(positions,i),vec(positions,group[0]))&&same(vec(displaced,i),vec(displaced,group[0])),'Conflicting weld positions');
        assert.ok(same(vec(normals,i),vec(normals,group[0])),'Conflicting authored weld normals');
    }
    const changedPositions=[];for(let i=0;i<count;i++)if(!same(vec(positions,i),vec(displaced,i)))changedPositions.push(i);
    const moved=new Set(changedPositions.map(i=>mapping[i])),stars=new Map(Array.from(groups.keys(),s=>[s,[]])),affectedFaces=[],normalSources=new Set();
    for(let f=0;f<indices.length/3;f++) {
        const ids=Array.from(indices.slice(3*f,3*f+3));assert.ok(ids.every(i=>Number.isSafeInteger(i)&&i>=0&&i<count),'Invalid triangle index');
        const src=ids.map(i=>mapping[i]);assert.equal(new Set(src).size,3,'Collapsed source-index triangle');
        for(const s of src)stars.get(s).push(f);
        if(src.some(s=>moved.has(s))) {affectedFaces.push(f);for(const s of src)normalSources.add(s);}
    }
    const out=Float32Array.from(normals),allStarFaces=new Set(),changedNormals=[],faceMetrics=[];
    for(const f of affectedFaces) {
        const a=areaVector(triangle(positions,indices,f)),b=areaVector(triangle(displaced,indices,f)),cos=dot(unit(a),unit(b));
        assert.ok(cos>0,'Reference-facing triangle reversal');
        faceMetrics.push({face:f,area0:length(a)/2,area1:length(b)/2,referenceCosine:cos});
    }
    let maxRotationDegrees=0;
    for(const s of normalSources) {
        const a=[0,0,0],b=[0,0,0];
        for(const f of stars.get(s)) {allStarFaces.add(f);const p=areaVector(triangle(positions,indices,f)),q=areaVector(triangle(displaced,indices,f));for(let c=0;c<3;c++){a[c]+=p[c];b[c]+=q[c];}}
        maxRotationDegrees=Math.max(maxRotationDegrees,Math.acos(Math.min(1,Math.max(-1,dot(unit(a),unit(b)))))*180/Math.PI);
        for(const i of groups.get(s)) {
            const n=transportNormal(vec(normals,i),a,b);for(let c=0;c<3;c++)out[3*i+c]=n[c];
            if(!same(vec(normals,i),vec(out,i)))changedNormals.push(i);
        }
    }
    return {normals:out,changedPositions,changedNormals,normalSources:[...normalSources].sort((a,b)=>a-b),affectedFaces,completeStarFaces:[...allStarFaces].sort((a,b)=>a-b),faceMetrics,maxRotationDegrees};
}
function bbox(tri) {return {min:[0,1,2].map(c=>Math.min(...tri.map(p=>p[c]))),max:[0,1,2].map(c=>Math.max(...tri.map(p=>p[c])))};}
function overlaps(a,b) {return a.min.every((v,i)=>v<=b.max[i]+CONTACT_EPSILON_M&&a.max[i]>=b.min[i]-CONTACT_EPSILON_M);}
function onSimplex(p,shared) {
    if(shared.length===0)return false;
    if(shared.length===1)return length(sub(p,shared[0]))<=CONTACT_EPSILON_M;
    assert.equal(shared.length,2,'Duplicate topological face');
    const d=sub(shared[1],shared[0]),t=dot(sub(p,shared[0]),d)/dot(d,d),q=shared[0].map((x,i)=>x+Math.max(0,Math.min(1,t))*d[i]);
    return length(sub(p,q))<=CONTACT_EPSILON_M;
}
/** Adjacency only permits the actual shared point/edge, never additional overlap. */
export function intersectionBeyondSharedSimplex(a,b,sourceA,sourceB) {
    const hit=intersectTriangles(a,b,CONTACT_EPSILON_M);if(hit===null)return null;
    const shared=sourceA.filter(s=>sourceB.includes(s)).map(s=>a[sourceA.indexOf(s)]);
    if(shared.length===3)return {kind:'duplicate-source-face',points:hit.points};
    if(hit.points.every(p=>onSimplex(p,shared)))return null;
    return {...hit,sharedSourceIDs:sourceA.filter(s=>sourceB.includes(s))};
}
export function checkLocalSelfIntersection({positions,indices,mapping,affectedFaces}) {
    finite(positions);const triangles=Array.from({length:indices.length/3},(_,f)=>triangle(positions,indices,f)),bounds=triangles.map(bbox),seen=new Set(),witnesses=[];
    let broadPairs=0,intersectionsChecked=0;
    for(const a of affectedFaces)for(let b=0;b<triangles.length;b++) {
        if(a===b||!overlaps(bounds[a],bounds[b]))continue;
        const key=a<b?`${a}:${b}`:`${b}:${a}`;if(seen.has(key))continue;seen.add(key);broadPairs++;
        const sa=Array.from(indices.slice(a*3,a*3+3),i=>mapping[i]),sb=Array.from(indices.slice(b*3,b*3+3),i=>mapping[i]);
        const hit=intersectionBeyondSharedSimplex(triangles[a],triangles[b],sa,sb);intersectionsChecked++;
        if(hit)witnesses.push({faces:[a,b],...hit});
    }
    return {affectedFaces:affectedFaces.length,broadPairs,intersectionsChecked,witnesses,passed:witnesses.length===0,epsilonM:CONTACT_EPSILON_M};
}
