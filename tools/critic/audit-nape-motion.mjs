// Numerical support for sampled images; never a visual or continuous-motion acceptance gate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3} from 'three';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
const dir=process.argv.find(x=>x.startsWith('--directory='))?.slice(12);
assert.ok(dir?.startsWith('captures/'));
const reportFile=path.join(dir,'report.json'), report=JSON.parse(fs.readFileSync(reportFile));
assert.equal(report.status,'captured');
const output=path.join(dir,'numerical-checks.json');assert.ok(!fs.existsSync(output));
const sha=b=>createHash('sha256').update(b).digest('hex'), bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};
const point=new Vector3(),matrix=new Matrix4(),left=new Vector3(),right=new Vector3();
const rows=[];
for(const sample of report.samples){
  const bytes=fs.readFileSync(path.join(dir,sample.geometryFile));assert.equal(sha(bytes),sample.geometrySha256);
  const raw=JSON.parse(gunzipSync(bytes));assert.deepEqual(raw.hashes,sample.hashes);
  const body={positions:raw.bodyPositions,indices:report.setup.descriptor.bodyIndices};
  const hair={positions:raw.selectedVertices,indices:report.setup.descriptor.selectedIndices};
  const contacts=measureHairSurface(hair,body,{headBounds:bounds,faceBounds:bounds,exampleLimit:10});
  const grid=new SurfaceGrid(raw.bodyPositions,raw.bodyNormals,body.indices);
  const distances=[];for(let i=0;i<hair.positions.length;i+=3){const hit=grid.nearest(hair.positions.slice(i,i+3));assert.ok(hit);distances.push(hit.signed*1000);}
  matrix.fromArray(raw.headMatrix);let rootMax=0;
  for(let i=0;i<2;i++){point.fromArray(report.setup.descriptor.restPositions,i*3).applyMatrix4(matrix);left.fromArray(hair.positions,i*3);rootMax=Math.max(rootMax,point.distanceTo(left)*1000);}
  const axis=ring=>right.fromArray(hair.positions,ring*6+3).sub(left.fromArray(hair.positions,ring*6)).clone().normalize();
  const rootAngle=axis(0).angleTo(axis(1))*180/Math.PI;
  const tipLag=point.fromArray(report.setup.descriptor.restCentres,16*3).applyMatrix4(matrix).distanceTo(left.fromArray(raw.selectedCentres,16*3))*1000;
  rows.push({frame:raw.frame,time:raw.time,degrees:raw.degrees,triangleBodyPairs:contacts.head.pairs,
    minimumVertexClearanceMm:Math.min(...distances),rootVertexMaxErrorMm:rootMax,rootToRing1Degrees:rootAngle,tipLagMm:tipLag,
    crossings:contacts.head.examples,selectedScreen:raw.selectedScreen});
}
const result={sourceReport:reportFile,reportSha256:sha(fs.readFileSync(reportFile)),selectedCard:281,selectedTriangles:32,
  frames:rows.length,summary:{crossingFrames:rows.filter(r=>r.triangleBodyPairs>0).length,totalTriangleBodyPairs:rows.reduce((n,r)=>n+r.triangleBodyPairs,0),
    minimumVertexClearanceMm:Math.min(...rows.map(r=>r.minimumVertexClearanceMm)),maxRootErrorMm:Math.max(...rows.map(r=>r.rootVertexMaxErrorMm)),
    maxRootToRing1Degrees:Math.max(...rows.map(r=>r.rootToRing1Degrees)),maxTipLagMm:Math.max(...rows.map(r=>r.tipLagMm)),finalTipLagMm:rows.at(-1).tipLagMm},
  rows,limits:['Actual GPU card281 against each sampled morphed/skinned full body; no garment triangles, hair-hair or continuous-time contact test.','No triangle-shell crossings does not exclude a triangle wholly inside a body; signed vertex samples support but do not prove complete positive clearance.','No root angle or tip lag threshold establishes appearance acceptance.'],
  sourceHashes:Object.fromEntries(['tools/critic/audit-nape-motion.mjs','tools/figure-pipeline/hair_surface.mjs','tools/figure-pipeline/hair_geometry.mjs'].map(p=>[p,sha(fs.readFileSync(p))]))};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result.summary,null,2));
