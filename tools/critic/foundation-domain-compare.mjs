// Exact native/export correspondence and finite coverage for one isolated construction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync, gzipSync } from 'node:zlib';
import { Matrix4, Vector3, Quaternion } from 'three';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { ROOT, hashFile, sha256 } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { originalWardrobeFoundation, WARDROBE_MASK_CALIBRATION } from '../figure-pipeline/wardrobe_under_masks.mjs';
import { topology } from '../figure-pipeline/collar_clearance_review.mjs';

const parentRoot = 'captures/foundation-domain-native-2026-09-30-v3';
const out = path.join(ROOT, 'captures/foundation-domain-comparison-2026-09-30-v1');
assert.ok(!fs.existsSync(out)); fs.mkdirSync(out, {recursive:true});
const parent = JSON.parse(fs.readFileSync(path.join(ROOT,parentRoot,'report.json')));
assert.equal(hashFile(path.join(ROOT,parentRoot,'report.json')), '1fe19dbc023d78e4ee0eb73d04fccf823eeb51251f044bb8a83b644a52d24582');
assert.equal(parent.status, 'constructed-awaiting-export-coverage-and-visual-review');
const files = ['tools/critic/foundation-domain-compare.mjs', 'docs/evidence/wardrobe-2026-09-30/foundation-domain-native/PLAN.md', 'docs/evidence/wardrobe-2026-09-30/foundation-domain-native/QUALIFICATION.md','tools/lut-bake/glb.mjs',
  'tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs',
  'tools/figure-pipeline/hair_surface.mjs','tools/figure-pipeline/collar_replacement_manifest.mjs',
  'docs/evidence/wardrobe-2026-09-30/foundation-native-band/PLAN.md',
  'docs/evidence/wardrobe-2026-09-30/foundation-native-band/COMPARISON-V2.md',
  'docs/evidence/wardrobe-2026-09-30/foundation-native-band/COMPARISON-V3.md',
  'packages/core/src/wardrobe/Wardrobe.js','node_modules/three/src/objects/SkinnedMesh.js',
  'node_modules/three/examples/jsm/loaders/GLTFLoader.js',
  'tools/figure-pipeline/wardrobe_under_masks.mjs',
  'tools/figure-pipeline/fixtures/wardrobe-g050-under-masks-v1.json',
  'tools/figure-pipeline/fixtures/'+WARDROBE_MASK_CALIBRATION.fixture.file,
  'tools/critic/compare-skeleton-export.mjs',
  'assets/wardrobe/body/g050.glb','assets/wardrobe/foundation_bra/g050.glb',
  `${parentRoot}/report.json`,`${parentRoot}/native-rig.json.gz`,
  ...parent.cases.flatMap(c=>[`${parentRoot}/${c.export.file}`,`${parentRoot}/${c.native.file}`,
    ...c.poses.map(p=>`${parentRoot}/${p.file}`)]),
  'captures/foundation-band-feasibility-2026-09-30-v2/report.json',
  'node_modules/three/package.json','node_modules/three/build/three.core.js'];
const pins = Object.fromEntries(files.map(f=>[f,hashFile(path.join(ROOT,f))]));
for(const f of files){const to=path.join(out,'source',f);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(ROOT,f),to);}
const report = {started:new Date().toISOString(),pid:process.pid,status:'running',pins,cases:[],errors:[],
  thresholdMetres:.000342,scope:'Finite native/export positions, corner data, topology and source coverage; no appearance or full-motion acceptance.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const decode=item=>{const b=fs.readFileSync(path.join(ROOT,parentRoot,item.file));assert.equal(sha256(b),item.sha256);const raw=gunzipSync(b);assert.equal(sha256(raw),item.decodedSHA256);return JSON.parse(raw);};
const C=new Matrix4().set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);
const rowMatrix=a=>new Matrix4().set(...a.flat());
const converted=a=>C.clone().multiply(rowMatrix(a));
const point=(p,i)=>Array.from(p.slice(i*3,i*3+3));
const cv=p=>[p[0],p[2],-p[1]];
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const bounds=vs=>({min:[0,1,2].map(k=>Math.min(...vs.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vs.map(v=>v[k])))});
const overlap=(a,b)=>[0,1,2].every(k=>a.min[k]<=b.max[k]&&a.max[k]>=b.min[k]);
const tris=p=>Array.from({length:p.indices.length/3},(_,id)=>{const ids=Array.from(p.indices.slice(id*3,id*3+3));const vertices=ids.map(i=>point(p.positions,i));return{id,indices:ids,vertices,...bounds(vertices)};});
function ray(o,d,t){const [a,b,c]=t.vertices,e1=sub(b,a),e2=sub(c,a),p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-12)return null;
  const inv=1/det,s=sub(o,a),u=dot(s,p)*inv;if(u<0||u>1)return null;const q=cross(s,e1),v=dot(d,q)*inv;
  if(v<0||u+v>1)return null;const distance=dot(e2,q)*inv;if(!(distance>0&&distance<=.030))return null;
  return{triangle:t.id,distance,barycentric:[1-u-v,u,v]};}
function query(position,normal,triangles){const origin=position.map((v,k)=>v+.0001*normal[k]),box=bounds([origin,origin.map((v,k)=>v+.030*normal[k])]);let best=null;
  for(const t of triangles){if(!overlap(box,t))continue;const hit=ray(origin,normal,t);if(hit&&(!best||hit.distance<best.distance))best=hit;}return best;}
function worlds(json){const parents=new Map(),cache=new Map();json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
  function visit(i){if(cache.has(i))return cache.get(i);const n=json.nodes[i],m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));if(parents.has(i))m.premultiply(visit(parents.get(i)));cache.set(i,m);return m;}return visit;}
function links(p){const lookup=new Map(),groups=[],edges=new Map(),stars=new Map();for(let i=0;i<p.vertexCount;i++){const key=point(p.positions,i).map(v=>Math.round(v/1e-7)).join(':');if(!lookup.has(key))lookup.set(key,lookup.size);groups[i]=lookup.get(key);}
  let degenerate=0,minArea=Infinity;for(const t of tris(p)){const gs=t.indices.map(i=>groups[i]);const area=Math.hypot(...cross(sub(t.vertices[1],t.vertices[0]),sub(t.vertices[2],t.vertices[0])))/2;minArea=Math.min(minArea,area);if(new Set(gs).size<3||area===0)degenerate++;
    for(let k=0;k<3;k++){const a=gs[k],b=gs[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b]);if(!stars.has(a))stars.set(a,[]);stars.get(a).push([b,gs[(k+2)%3]]);}}
  let paths=0,cycles=0;const failures=[];for(const [group,pairs]of stars){const graph=new Map(),seenEdges=new Set();let repeated=false;for(const [a,b]of pairs){const key=[a,b].sort((a,b)=>a-b).join(':');if(seenEdges.has(key))repeated=true;seenEdges.add(key);for(const [x,y]of [[a,b],[b,a]]){if(!graph.has(x))graph.set(x,new Set());graph.get(x).add(y);}}const queue=[graph.keys().next().value],visited=new Set(queue);for(let i=0;i<queue.length;i++)for(const n of graph.get(queue[i]))if(!visited.has(n)){visited.add(n);queue.push(n);}const degrees=[...graph.values()].map(s=>s.size),ends=degrees.filter(n=>n===1).length;if(repeated||visited.size!==graph.size||degrees.some(n=>n<1||n>2)||![0,2].includes(ends))failures.push({group,pairs,degrees});else if(ends===2)paths++;else cycles++;}
  const boundary=new Map();for(const rows of edges.values())if(rows.length===1)for(const [a,b]of [rows[0],rows[0].slice().reverse()]){if(!boundary.has(a))boundary.set(a,new Set());boundary.get(a).add(b);}
  const seen=new Set(),components=[];for(const v of boundary.keys())if(!seen.has(v)){const queue=[v];seen.add(v);for(let i=0;i<queue.length;i++)for(const n of boundary.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}components.push({vertices:queue.length,nonTwoDegree:queue.filter(i=>boundary.get(i).size!==2)});}
  return{paths,cycles,failures,degenerate,minTriangleArea:minArea,boundaryComponents:components};}
const cycleKey=a=>a.map((_,i)=>a.slice(i).concat(a.slice(0,i)).join(':')).sort()[0];

try{
  save();const bodyGlb=readGlb(path.join(ROOT,'assets/wardrobe/body/g050.glb')),body=readPrimitive(bodyGlb,'base.001');
  const shippedGlb=readGlb(path.join(ROOT,'assets/wardrobe/foundation_bra/g050.glb')),shipped=readPrimitive(shippedGlb,'foundation_bra');
  const ba=bodyGlb.json.meshes[0].primitives[0].attributes;
  const chest=Array.from(readAccessor(bodyGlb,ba._DECENCY_CHEST).data,(v,i)=>({v,i})).filter(r=>r.v>.5).map(r=>r.i);assert.equal(chest.length,110);
  const targets=chest.map(vertex=>({vertex,position:point(body.positions,vertex),normal:point(body.normals,vertex)}));
  const fan=[];for(const f of tris(body).filter(t=>t.indices.some(i=>chest.includes(i))))for(let a=0;a<=4;a++)for(let b=0;b<=4-a;b++){const w=[a,b,4-a-b].map(v=>v/4),position=[0,1,2].map(k=>f.vertices.reduce((s,v,i)=>s+w[i]*v[k],0)),raw=[0,1,2].map(k=>f.indices.reduce((s,v,i)=>s+w[i]*body.normals[v*3+k],0)),length=Math.hypot(...raw);fan.push({bodyFace:f.id,barycentric:w,position,normal:raw.map(v=>v/length)});}assert.equal(fan.length,3780);
  const originalTris=tris(shipped),originalRequired=targets.map(r=>query(r.position,r.normal,originalTris)),originalFan=fan.map(r=>query(r.position,r.normal,originalTris));assert.ok(originalRequired.every(Boolean));
  report.originalCoverage={requiredCovered:originalRequired.filter(Boolean).length,fanCovered:originalFan.filter(Boolean).length};
  const rig=decode(parent.rig);
  for(const item of parent.cases){const native=decode(item.native),g=readGlb(path.join(ROOT,parentRoot,item.export.file));assert.equal(hashFile(path.join(ROOT,parentRoot,item.export.file)),item.export.sha256);
    assert.equal(g.json.meshes.length,1);const primitive=g.json.meshes[0].primitives[0],p=readPrimitive(g,g.json.meshes[0].name),a=primitive.attributes;
    assert.ok(!Object.keys(a).some(n=>n.startsWith('.uv_select')));
    const values=Object.fromEntries(Object.entries(a).map(([n,v])=>[n,Array.from(readAccessor(g,v).data)])),ids=values._NATIVE_VERTEX;
    assert.equal(ids.length,p.vertexCount);assert.ok(ids.every(v=>Number.isInteger(v)&&v>=0&&v<item.vertices));assert.equal(new Set(ids).size,item.vertices);
    const nodes=g.json.nodes.map((n,i)=>({n,i})).filter(({n})=>n.mesh===0);assert.equal(nodes.length,1);const world=worlds(g.json);assert.deepEqual(world(nodes[0].i).elements,new Matrix4().elements);
    const skin=g.json.skins[nodes[0].n.skin],names=skin.joints.map(i=>g.json.nodes[i].name),ibm=readAccessor(g,skin.inverseBindMatrices).data;
    assert.deepEqual(new Set(names),new Set(rig.bones.map(b=>b.name)));
    const binds=names.map((_,i)=>new Matrix4().fromArray(ibm,i*16));
    let restMax=0,maskMax=0,restJointMax=0,restJointWitnessMax=0;for(let i=0;i<p.vertexCount;i++){restMax=Math.max(restMax,Math.hypot(...sub(point(p.positions,i),cv(point(native.positions,ids[i])))));for(const [n,rows]of Object.entries(native.attributes)){const exported=values[n.toUpperCase()];assert.ok(exported,n);maskMax=Math.max(maskMax,Math.abs(exported[i]-rows[ids[i]]));}}
    for(let i=0;i<names.length;i++){const b=rig.bones.find(b=>b.name===names[i]),m=converted(b.matrixLocal),actual=world(skin.joints[i]);restJointMax=Math.max(restJointMax,...m.elements.map((v,k)=>Math.abs(v-actual.elements[k])));for(const p of [[0,0,0],[1,0,0],[0,1,0],[0,0,1]])restJointWitnessMax=Math.max(restJointWitnessMax,new Vector3(...p).applyMatrix4(m).distanceTo(new Vector3(...p).applyMatrix4(actual)));}
    assert.ok(restJointWitnessMax<.0001, "Native/export rest-frame admission");
    const triLookup=new Map();native.triangles.forEach((t,i)=>{const key=cycleKey(t);assert.ok(!triLookup.has(key));triLookup.set(key,i);});
    let normalMax=0,uvMax=0;const seen=new Set();for(let t=0;t<p.indices.length;t+=3){const raw=Array.from(p.indices.slice(t,t+3)),mapped=raw.map(i=>ids[i]),key=cycleKey(mapped);assert.ok(triLookup.has(key));const index=triLookup.get(key);assert.ok(!seen.has(index));seen.add(index);const nativeTriangle=native.triangles[index],loops=native.triangleLoops[index];for(let k=0;k<3;k++){const loop=loops[nativeTriangle.indexOf(mapped[k])],normal=cv(point(native.cornerNormals,loop));normalMax=Math.max(normalMax,...sub(point(p.normals,raw[k]),normal).map(Math.abs));if(native.activeUV){const uv=native.uvLayers[native.activeUV];uvMax=Math.max(uvMax,Math.abs(values.TEXCOORD_0[raw[k]*2]-uv[loop*2]),Math.abs(values.TEXCOORD_0[raw[k]*2+1]-(1-uv[loop*2+1])));}}}assert.equal(seen.size,native.triangles.length);
    const row={label:item.label,export:item.export,nativeVertices:item.vertices,exportVertices:p.vertexCount,triangles:p.indices.length/3,
      correspondence:{restPositionMaxMetres:restMax,customAttributeMax:maskMax,restJointMatrixMax:restJointMax,restJointWitnessMaxMetres:restJointWitnessMax,cornerNormalComponentMax:normalMax,uvComponentMax:uvMax,orientedTrianglesMatched:seen.size},
      topology:topology(p),vertexLinks:links(p),poses:[],influences:{nativeMaximum:Math.max(...native.weights.map(w=>w.length)),exportSets:Object.keys(a).filter(n=>n.startsWith('WEIGHTS_'))}};
    assert.equal(maskMax,0);assert.equal(restMax,0);
    for(const posed of item.poses){const observation=decode(posed),matrices=names.map((name,i)=>converted(observation.bones[name].matrix).multiply(binds[i]));
      const residuals=[],predicted=[],stale=[];for(let i=0;i<p.vertexCount;i++){const rawWeights=values.WEIGHTS_0.slice(i*4,i*4+4),sum=rawWeights.reduce((s,v)=>s+Math.abs(v),0),weights=rawWeights.map(w=>Math.fround(w*(1/sum))),position=new Vector3().fromArray(p.positions,i*3),value=new Vector3();assert.ok(sum>0);for(let k=0;k<4;k++)if(weights[k])value.addScaledVector(position.clone().applyMatrix4(matrices[values.JOINTS_0[i*4+k]]),weights[k]);const target=cv(point(observation.shell.positions,ids[i]));predicted.push(...value.toArray());residuals.push(value.distanceTo(new Vector3(...target)));stale.push(value.clone().add(new Vector3(.05,0,0)).distanceTo(new Vector3(...target)));}
      const max=Math.max(...residuals),worst=residuals.indexOf(max),artifact=item.label+'-'+observation.pose+'-residuals.json.gz';const bytes=gzipSync(JSON.stringify({residuals,predicted}));fs.writeFileSync(path.join(out,artifact),bytes);
      row.poses.push({pose:observation.pose,maxMetres:max,meanMetres:residuals.reduce((s,v)=>s+v,0)/residuals.length,pass:max<report.thresholdMetres,worstExport:worst,worstNative:ids[worst],fullWeights:native.weights[ids[worst]],exportWeights:values.WEIGHTS_0.slice(worst*4,worst*4+4).map((v,k)=>[names[values.JOINTS_0[worst*4+k]],v]),negativeOffsetControlMax:Math.max(...stale),negativeControlInterpretable:max<report.thresholdMetres,negativeControlDetected:max<report.thresholdMetres&&Math.max(...stale)>report.thresholdMetres,artifact:{file:artifact,sha256:sha256(bytes)}});
    }
    const all=tris(p),required=targets.map(r=>({...r,hit:query(r.position,r.normal,all)})),supplement=fan.map((r,i)=>({...r,original:originalFan[i],hit:query(r.position,r.normal,all)}));
    row.coverage={requiredCovered:required.filter(r=>r.hit).length,requiredMissing:required.filter(r=>!r.hit).map(r=>r.vertex),fanCovered:supplement.filter(r=>r.hit).length,fanBaselineMissing:originalFan.filter(r=>!r).length,newFanLosses:supplement.filter(r=>r.original&&!r.hit).length};
    const coverageBytes=gzipSync(JSON.stringify({required,supplement}));fs.writeFileSync(path.join(out,item.label+'-coverage.json.gz'),coverageBytes);row.coverageArtifact={file:item.label+'-coverage.json.gz',sha256:sha256(coverageBytes)};
    row.casualRetainedFaces=all.filter(t=>t.indices.every(i=>values._UNDER_FEMALE_CASUALSUIT01[i]<=.5)).map(t=>t.id);
    if(item.label==='original-control'){const originalAttributes=shippedGlb.json.meshes[0].primitives[0].attributes;row.shippedControlComparison={indicesExact:JSON.stringify(Array.from(shipped.indices))===JSON.stringify(Array.from(p.indices)),attributes:Object.fromEntries(Object.entries(originalAttributes).map(([n,v])=>{const old=Array.from(readAccessor(shippedGlb,v).data),current=values[n];return[n,{sameLength:old.length===current.length,exact:JSON.stringify(old)===JSON.stringify(current),max:old.length===current.length?Math.max(...old.map((x,i)=>Math.abs(x-current[i]))):null}];}))};}
    if(item.label==='original-control'){
      const fixtureBytes=originalWardrobeFoundation('foundation_bra');
      fs.writeFileSync(path.join(out,'original-authoring-foundation.glb'),fixtureBytes);
      const fixture=readGlb(path.join(out,'original-authoring-foundation.glb'));
      const source=readPrimitive(fixture,'foundation_bra');
      const fp=fixture.json.meshes[0].primitives[0];
      const canonical=p=>tris(p).map(t=>cycleKey(t.indices)).sort();
      row.shippedControlComparison.orientedTriangleMultisetsExact=JSON.stringify(canonical(p))===JSON.stringify(canonical(shipped));
      row.authoringFixtureComparison={sha256:sha256(fixtureBytes),orientedTriangleMultisetsExact:JSON.stringify(canonical(p))===JSON.stringify(canonical(source)),attributes:{}};
      for(const [n,v]of Object.entries(fp.attributes)){
        const old=Array.from(readAccessor(fixture,v).data);
        row.authoringFixtureComparison.attributes[n]={exact:JSON.stringify(old)===JSON.stringify(values[n]),sameLength:old.length===values[n].length};
      }
      row.maskDifferences={};
      for(const name of ['_UNDER_FEMALE_CASUALSUIT01','_UNDER_FEMALE_ELEGANTSUIT01']){
        const accepted=Array.from(readAccessor(shippedGlb,shippedGlb.json.meshes[0].primitives[0].attributes[name]).data),current=values[name];
        const oldFaces=tris(shipped).filter(t=>t.indices.every(i=>accepted[i]<=.5)).map(t=>cycleKey(t.indices));
        const newFaces=all.filter(t=>t.indices.every(i=>current[i]<=.5)).map(t=>cycleKey(t.indices));
        const os=new Set(oldFaces),ns=new Set(newFaces);
        row.maskDifferences[name]={changedVertices:accepted.map((v,i)=>({vertex:i,accepted:v,rebuilt:current[i]})).filter(r=>r.accepted!==r.rebuilt),acceptedFaces:oldFaces.length,rebuiltFaces:newFaces.length,addedFaces:newFaces.filter(t=>!os.has(t)),lostFaces:oldFaces.filter(t=>!ns.has(t))};
      }
      row.maskInterpretation='Rebuilt control uses original native inheritance. Accepted shipped masks have later calibrated additions. Shipped original remains visual baseline; no calibration is reapplied to this new band.';
    }
    report.cases.push(row);save();
  }
  report.finitePrerequisitesPass=report.cases.every(c=>c.poses.every(p=>p.pass&&p.negativeControlDetected)&&c.coverage.requiredCovered===110&&c.coverage.newFanLosses===0&&c.vertexLinks.failures.length===0&&c.vertexLinks.degenerate===0&&c.topology.nonmanifoldEdges===0&&c.topology.orientationErrors===0&&c.topology.components===1&&c.topology.eulerCharacteristic===0&&c.vertexLinks.boundaryComponents.length===2&&c.vertexLinks.boundaryComponents.every(b=>b.nonTwoDegree.length===0));
  report.status=report.finitePrerequisitesPass?'finite-correspondence-and-coverage-prerequisites-met':'finite-prerequisites-failed';
  for(const [f,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,f)),h,f);
}catch(error){report.status='instrument-failed';report.errors.push({message:error.message,stack:error.stack});process.exitCode=1;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,pid:process.pid,cases:report.cases.map(c=>({label:c.label,coverage:c.coverage,skinMax:Math.max(...c.poses.map(p=>p.maxMetres)),links:c.vertexLinks.failures.length})),errors:report.errors}));}
