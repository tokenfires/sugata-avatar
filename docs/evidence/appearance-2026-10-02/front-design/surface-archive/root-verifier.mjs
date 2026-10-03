/** Independent root nearest-point arithmetic: Three.Triangle exhaustive full-body scan. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Vector3,Triangle} from 'three';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
const dir='captures/hair-surface-domain-2026-10-02-v1',reportPath=dir+'/report.json';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(hash(reportPath),'71ec7693deb6886ba5be32c6a44797c6e98a981dedafb469076b8c860b83a28c');
const r=JSON.parse(fs.readFileSync(reportPath)),started=new Date().toISOString();
assert.equal(r.status,'refused control bounds');assert.equal(r.sourcesUnchanged,true);
for(const[p,h]of Object.entries(r.sourceHashes))assert.equal(hash(p),h,p);
const body=readPrimitive(readGlb('assets/figures/figure_g050.glb'),'base.001');
const vertices=Array.from({length:body.vertexCount},(_,v)=>new Vector3().fromArray(body.positions,3*v));
const triangles=Array.from({length:body.triangleCount},(_,t)=>new Triangle(...Array.from(body.indices.slice(3*t,3*t+3),i=>vertices[i])));
const controls=r.orientations.A.controls,results=[];
for(const c of controls){
 const wanted=new Vector3(...c.wanted),closest=new Vector3();let best=Infinity,ties=[];
 for(let t=0;t<triangles.length;t++){triangles[t].closestPointToPoint(wanted,closest);const d=wanted.distanceTo(closest);if(d<best-1e-12){best=d;ties=[{triangle:t,point:closest.toArray()}];}else if(Math.abs(d-best)<=1e-12)ties.push({triangle:t,point:closest.toArray()});}
 const reportedPoint=new Vector3(...c.restSurface),distanceErrorMm=Math.abs(best*1000-c.projectionDistanceMm),closestPointErrorMm=Math.min(...ties.map(x=>reportedPoint.distanceTo(new Vector3(...x.point))*1000));
 assert.ok(distanceErrorMm<1e-8);assert.ok(closestPointErrorMm<1e-7);assert.ok(ties.some(t=>t.triangle===c.bodyTriangle));
 const choices=c.indices.map(vertex=>({vertex,distanceMm:vertices[vertex].distanceTo(reportedPoint)*1000})).sort((a,b)=>a.distanceMm-b.distanceMm||a.vertex-b.vertex);
 assert.equal(choices[0].vertex,c.exportedVertex);assert.ok(Math.abs(choices[0].distanceMm-c.distanceMm)<1e-8);
 results.push({control:c.index,wanted:c.wanted,reportedTriangle:c.bodyTriangle,nearestTies:ties,projectionDistanceMm:best*1000,snapDistanceMm:choices[0].distanceMm,distanceErrorMm,closestPointErrorMm,projectionFails:best*1000>20,snapFails:choices[0].distanceMm>8});
}
assert.deepEqual(results.filter(x=>x.projectionFails).map(x=>x.control),[13,14,15]);
assert.deepEqual(results.filter(x=>x.snapFails).map(x=>x.control),[3]);
assert.deepEqual(r.orientations.A.segments,[]);assert.equal(r.orientations.B,undefined);
const result={started,finished:new Date().toISOString(),pid:process.pid,reportSha256:hash(reportPath),verifierSha256:hash('tools/critic/verify-hair-surface-refusal.mjs'),method:'Exhaustive Three.Triangle.closestPointToPoint against all26756bodyfaces; separate Euclidean snap arithmetic on each declared triangle.',checks:r.checks.map(c=>({name:c.name,pass:c.pass})),controls:results,unexecuted:['Dijkstra','cycle','side/seed predicates','pose-alias gate','cap observations','B','native images'],limits:['Verifies declared refusal; does not admit a revised boundary or prove infeasibility.']};
const dest=dir+'/root-independent.json';fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({dest,pid:process.pid,controls:results.length,maximumDistanceErrorMm:Math.max(...results.map(x=>x.distanceErrorMm)),maximumClosestPointErrorMm:Math.max(...results.map(x=>x.closestPointErrorMm)),sha256:hash(dest)}));
