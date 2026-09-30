// Reconstruct a shared contact from original samples, with an independent Three.js segment/triangle check.
import fs from'node:fs';import assert from'node:assert/strict';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{Vector3,Matrix4,Ray}from'three';import{readGlb,readPrimitive}from'../lut-bake/glb.mjs';
const out='captures/lower-fallback-front58-witness-v1';assert.ok(!fs.existsSync(out));const sha=b=>createHash('sha256').update(b).digest('hex'),digest=p=>sha(fs.readFileSync(p)),read=p=>JSON.parse(fs.readFileSync(p)),rows=[];
const frame=256,source='tools/critic/witness-front58-contact.mjs',bodyAsset='assets/figures/figure_g050.glb';
const point=(a,v)=>new Vector3().fromArray(a,v*3);
function independentIntersections(h,b){
 const hits=[];for(const[from,to]of[[h,b],[b,h]])for(let e=0;e<3;e++){
  const a=from[e],delta=from[(e+1)%3].clone().sub(a),len=delta.length(),ray=new Ray(a,delta.clone().normalize()),hit=ray.intersectTriangle(to[0],to[1],to[2],false,new Vector3());
  if(hit&&hit.distanceTo(a)<=len+1e-10&&!hits.some(p=>p.distanceTo(hit)<1e-8))hits.push(hit);
 }return hits;
}
for(const arm of['baseline','candidate']){
 const auditPath=`captures/lower-fallback-front-audit-v1/head-${arm}/numerical-checks.json`,audit=read(auditPath);assert.equal(audit.status,'complete');const witness=audit.rows.find(r=>r.frame===frame);assert.deepEqual(witness.contactCards,[58]);assert.equal(witness.triangleBodyPairs,2);
 const dir=`captures/lower-fallback-head-v1/${arm}-right-profile-brown`,report=read(`${dir}/report.json`),s=report.samples[frame],bytes=fs.readFileSync(`${dir}/${s.geometryFile}`);assert.equal(sha(bytes),s.geometrySha256);const raw=JSON.parse(gunzipSync(bytes));assert.equal(raw.frame,frame);assert.equal(audit.reportSha256,digest(`${dir}/report.json`));
 const front=`captures/lower-fallback-head-front-v1/${arm}-front-brown`,fr=read(`${front}/report.json`),fb=fs.readFileSync(`${front}/${fr.samples[frame].geometryFile}`);assert.equal(sha(fb),fr.samples[frame].geometrySha256);assert.deepEqual(JSON.parse(gunzipSync(fb)),raw);
 const intersections=[];for(const ex of witness.examples){
  assert.equal(ex.card,58);const hi=audit.indices.slice(ex.hairTriangle*3,ex.hairTriangle*3+3),bi=report.setup.descriptor.bodyIndices.slice(ex.bodyTriangle*3,ex.bodyTriangle*3+3),h=hi.map(i=>point(raw.otherVertices,i)),b=bi.map(i=>point(raw.bodyPositions,i)),hits=independentIntersections(h,b);
  assert.equal(hits.length,2);const error=Math.max(...ex.points.map(p=>Math.min(...hits.map(q=>q.distanceTo(new Vector3(...p))))));assert.ok(error<1e-8);
  intersections.push({hairTriangle:ex.hairTriangle,bodyTriangle:ex.bodyTriangle,hairVertexIndices:hi,bodyVertexIndices:bi,hairWorldMetres:h.map(p=>p.toArray()),bodyWorldMetres:b.map(p=>p.toArray()),independentIntersections: hits.map(p=>p.toArray()),maximumEndpointDifferenceMetres:error});
 }
 const camera=new Matrix4().fromArray(fr.setup.camera).invert(),projection=new Matrix4().fromArray(fr.setup.projection),p=new Vector3(...witness.minimumWitness.point).applyMatrix4(camera).applyMatrix4(projection);
 const imagePins=[252,255,258,261].map(f=>{const im=fr.images.find(i=>i.frame===f);assert.ok(im);const path=`${front}/${im.file}`;assert.equal(digest(path),im.sha256);return {frame:f,path,sha256:im.sha256};});
 rows.push({arm,auditFile:auditPath,auditSha256:digest(auditPath),sourceReportSha256:digest(`${dir}/report.json`),frontReportSha256:digest(`${front}/report.json`),rawSampleSha256:sha(bytes),sameFrontPhysicalSampleExact:true,frame,minimumWitness:witness.minimumWitness,intersections,frontLocator:{imageWidth:900,imageHeight:868,x:(p.x+1)*450,y:(1-p.y)*434,ndcZ:p.z,limit:'Projected geometry locator, not alpha-visible pixel ownership. Exact256PNG was not captured;255/258 bracket it.'},imagePins});
}
const assets=['captures/bob-side-envelope-v3/candidate.glb','captures/bob-lower-fallback-v1/candidate.glb'],primitives=assets.map(p=>readPrimitive(readGlb(p),'hair_bob02'));
for(const k of['positions','normals'])assert.deepEqual(primitives[0][k].slice((652+58*34)*3,(652+59*34)*3),primitives[1][k].slice((652+58*34)*3,(652+59*34)*3));
fs.mkdirSync(out);fs.copyFileSync(source,`${out}/source.mjs`);
const result={status:'shared card58 contact independently reproduced',generated:new Date().toISOString(),sourceSha256:digest(source),threeVersion:read('node_modules/three/package.json').version,threeRaySourceSha256:digest('node_modules/three/src/math/Ray.js'),assets:assets.map(p=>({path:p,sha256:digest(p)})),bodyAssetSha256:digest(bodyAsset),card58AuthoredPositionNormalExact:true,rows,limits:['Three.js segment/triangle reconstruction confirms these two frame256 geometric pairs only; it is not a second full-sequence oracle.','Both arms share the contact. A shallower candidate contact is not perceptual improvement or all-motion clearance.','Root inspected252/255/258/261 frontpairs and found no attributable new gap/crease; no alpha/occlusion attribution is established.','No geometry edit or render was made.']};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,rows:rows.map(r=>({arm:r.arm,min:r.minimumWitness.signedMm,locator:r.frontLocator,pairs:r.intersections.length}))}));
