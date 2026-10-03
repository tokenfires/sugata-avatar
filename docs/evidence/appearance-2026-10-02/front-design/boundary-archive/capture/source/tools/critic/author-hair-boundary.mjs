/** One artistic landmark proposal projected to pinned exported body triangles. No asset writer. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readGlb, readPrimitive} from '../lut-bake/glb.mjs';
import {SurfaceGrid, closestPointOnTriangle} from '../figure-pipeline/hair_geometry.mjs';
const out='docs/evidence/appearance-2026-10-02/front-design/boundary-landmarks.json';
assert.ok(!fs.existsSync(out),'Preserve the first authored proposal.');
const bodyFile='assets/figures/figure_g050.glb';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(hash(bodyFile),'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14');
const body=readPrimitive(readGlb(bodyFile),'base.001');
const grid=new SurfaceGrid(body.positions,body.normals,body.indices);
const position=i=>Array.from(body.positions.slice(3*i,3*i+3));
// Metres, x lateral / y up / z front. Artistic choices, not anatomy-derived thresholds.
const opening=[[-.076,1.575,.100],[-.066,1.595,.120],[-.052,1.616,.115],[-.031,1.629,.090],[-.015,1.632,.090],[0,1.619,.105],[.019,1.608,.123],[.037,1.591,.132],[.052,1.574,.132],[.066,1.565,.120],[.076,1.565,.100]];
const part=[opening[4],[-.018,1.646,.075],[-.022,1.658,.050],[-.019,1.653,.019],[-.012,1.641,-.014]];
function anchor(wanted){
 const hit=grid.nearest(wanted);assert.ok(hit,'Missing body correspondence.');
 const indices=Array.from(body.indices.slice(hit.triangle,hit.triangle+3));
 const {closest,bary}=closestPointOnTriangle(wanted,...indices.map(position));
 const distance=Math.hypot(...wanted.map((x,k)=>x-closest[k]));
 assert.ok(distance<=.020,'Stop: authored landmark more than20mm from head; no retune.');
 assert.ok(bary.every(x=>x>=-1e-10&&x<=1+1e-10));
 assert.ok(closest[1]>=1.55,'Stop: landmark left the head.');
 return {wanted,bodyTriangle:hit.triangle/3,indices,bary,restSurface:closest,projectionDistanceMm:distance*1000};
}
const orientations={};
for(const [name,sign] of [['A',1],['B',-1]]) orientations[name]={
 semantics:`Part on ${sign===1?'negative':'positive'}X; heavier framing on ${sign===1?'positive':'negative'}X; partner temple more revealed. Viewer left/right changes with camera.`,
 opening:opening.map(p=>anchor([p[0]*sign,p[1],p[2]])),
 part:part.map(p=>anchor([p[0]*sign,p[1],p[2]]))
};
const sources=[bodyFile,'tools/critic/author-hair-boundary.mjs','tools/lut-bake/glb.mjs','tools/figure-pipeline/hair_geometry.mjs','docs/evidence/appearance-2026-10-02/front-design/BOUNDARY-PLAN.md',
'reference/bob-appearance-2026-09-29/02-medium-face-framing.jpg','reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg'];
const report={created:new Date().toISOString(),pid:process.pid,bodyFile,mesh:'base.001',sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(p)])),orientations,
 limits:['One fixed artistic landmark proposal, no fitted hairstyle or coverage gate.','The open-ended opening stroke marks upper framing intent; its temple endpoints do not close an open/backing domain.','Straight joins are illustrative chords, not an authored continuous surface path.','Part is separate flow intent, not skin exposure, opaque crease width or guide geometry.','Projection binds each landmark only; no source scalp-group/map inference.']};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,pid:process.pid,anchors:32,maximumProjectionMm:Math.max(...Object.values(orientations).flatMap(o=>[...o.opening,...o.part]).map(p=>p.projectionDistanceMm)),sha256:hash(out)}));
