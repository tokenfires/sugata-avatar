// Read-only source coverage inventory. This exports no geometry and changes no asset.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { Matrix4, Vector3, Quaternion } from 'three';
import { ROOT, hashFile, sha256 } from './collar_replacement_manifest.mjs';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { SurfaceGrid } from './hair_geometry.mjs';
import { topology } from './collar_clearance_review.mjs';

const output = path.resolve(ROOT, process.argv[2] ?? 'captures/foundation-band-feasibility-2026-09-30-v2');
assert.ok(!fs.existsSync(output), 'Fresh output required');
fs.mkdirSync(output, { recursive: true });
const sourceFiles = [
  'tools/figure-pipeline/foundation_band_feasibility.mjs',
  'docs/evidence/wardrobe-2026-09-30/foundation-band/PLAN.md',
  'docs/evidence/wardrobe-2026-09-30/foundation-band/V2.md',
  'tools/figure-pipeline/build_figure.py',
  'packages/core/src/wardrobe/decency.selftest.mjs',
  'packages/core/src/wardrobe/FoundationLayer.js',
  'packages/core/src/wardrobe/Wardrobe.js',
  'tools/figure-pipeline/collar_replacement_manifest.mjs',
  'tools/lut-bake/glb.mjs', 'tools/figure-pipeline/hair_geometry.mjs',
  'tools/figure-pipeline/collar_clearance_review.mjs', 'tools/figure-pipeline/hair_surface.mjs',
  'tools/figure-pipeline/casual_trouser_fit.mjs', 'tools/figure-pipeline/casual_trouser_cuff.mjs',
  'tools/figure-pipeline/hair_fall.mjs', 'packages/core/src/motion/HairDynamics.js',
  'tools/critic/png.mjs', 'node_modules/three/package.json',
  'node_modules/three/build/three.core.js', 'node_modules/three/build/three.module.js',
  'node_modules/three/build/three.webgpu.js', 'node_modules/three/build/three.tsl.js',
  'package.json', 'package-lock.json'
];
const groupSource = 'tmp/wardrobe-sep30/blender-profile/extensions/user_default/mpfb/entities/socketobject/_extra_vertex_groups.py';
const mpfbZip = 'tools/figure-pipeline/.cache/mpfb-2.0.17.zip';
const bodyFile = 'assets/wardrobe/body/g050.glb';
const braFile = 'assets/wardrobe/foundation_bra/g050.glb';
const previous = 'captures/neckline-attachment-2026-09-30-v1';
const inputFiles = [groupSource, mpfbZip, bodyFile, braFile, 'assets/figures/figure_g050.glb',
  'assets/wardrobe/foundation_briefs/g050.glb', 'assets/wardrobe/foundation_boxer_brief/g050.glb',
  'assets/wardrobe/manifest.json', 'assets/identity/figure-vertex-map.json', 'assets/identity/figure-vertex-map.bin',
  `${previous}/report.json`, `${previous}/snapshot.json.gz`];
const pins = Object.fromEntries([...sourceFiles, ...inputFiles].map(p => [p, hashFile(path.join(ROOT, p))]));
for (const p of sourceFiles) {
  const target = path.join(output, 'source', p);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, p), target);
}
const report = { started: new Date().toISOString(), pid: process.pid, node: process.version,
  status: 'running', pins, errors: [], scope: 'Source-space coverage feasibility; no candidate export, actual appearance or motion acceptance.' };
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
save();
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p)));
const point = (p, i) => Array.from(p.slice(3 * i, 3 * i + 3));
const sub = (a, b) => a.map((x, k) => x - b[k]);
const dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => { const n = Math.hypot(...a); assert.ok(n > 0); return a.map(x => x / n); };
const bounds = points => ({ min: [0,1,2].map(k => Math.min(...points.map(p => p[k]))), max: [0,1,2].map(k => Math.max(...points.map(p => p[k]))) });
const overlap = (a, b) => [0,1,2].every(k => a.min[k] <= b.max[k] && a.max[k] >= b.min[k]);
const triangles = p => Array.from({length: p.indices.length / 3}, (_, id) => {
  const indices = Array.from(p.indices.slice(3 * id, 3 * id + 3));
  const vertices = indices.map(i => point(p.positions, i));
  return {id, indices, vertices, ...bounds(vertices)};
});

// Same two-sided Moller-Trumbore convention and finite reach as the existing floor gate.
function hitTriangle(origin, direction, tri, reach) {
  const [a,b,c] = tri.vertices, e1 = sub(b,a), e2 = sub(c,a), p = cross(direction,e2), determinant = dot(e1,p);
  if (Math.abs(determinant) < 1e-12) return null;
  const inverse = 1 / determinant, s = sub(origin,a), u = dot(s,p) * inverse;
  if (u < 0 || u > 1) return null;
  const q = cross(s,e1), v = dot(direction,q) * inverse;
  if (v < 0 || u + v > 1) return null;
  const distance = dot(e2,q) * inverse;
  if (!(distance > 0 && distance <= reach)) return null;
  return {triangle: tri.id, distance, euclideanDistance: distance * Math.hypot(...direction), barycentric: [1-u-v,u,v], point: origin.map((x,k)=>x+distance*direction[k])};
}
function worldMatrices(json) {
  const parents = new Map(), memo = new Map();
  json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>{assert.ok(!parents.has(c));parents.set(c,i);}));
  function visit(i, stack = new Set()) {
    if (memo.has(i)) return memo.get(i);
    assert.ok(!stack.has(i));
    const n = json.nodes[i], matrix = n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(
      new Vector3().fromArray(n.translation??[0,0,0]), new Quaternion().fromArray(n.rotation??[0,0,0,1]), new Vector3().fromArray(n.scale??[1,1,1]));
    if (parents.has(i)) matrix.premultiply(visit(parents.get(i),new Set([...stack,i])));
    memo.set(i,matrix); return matrix;
  }
  return visit;
}
function vertexLinks(p, selected) {
  const lookup = new Map(), groupOf = [], links = new Map();
  for (let i=0;i<p.vertexCount;i++) {
    const key=point(p.positions,i).map(v=>Math.round(v/1e-7)).join(':');
    if(!lookup.has(key))lookup.set(key,lookup.size);groupOf[i]=lookup.get(key);
  }
  for(const f of selected)for(let k=0;k<3;k++) {
    const gs=f.indices.map(i=>groupOf[i]);assert.equal(new Set(gs).size,3);
    if(!links.has(gs[k]))links.set(gs[k],[]);links.get(gs[k]).push([gs[(k+1)%3],gs[(k+2)%3]]);
  }
  const failures=[];let paths=0,cycles=0;
  for(const [group,pairs]of links) {
    const adjacent=new Map(),unique=new Set();let repeated=false;
    for(const [a,b]of pairs){const key=[a,b].sort((x,y)=>x-y).join(':');if(unique.has(key))repeated=true;unique.add(key);for(const [x,y]of [[a,b],[b,a]]){if(!adjacent.has(x))adjacent.set(x,new Set());adjacent.get(x).add(y);}}
    const queue=[adjacent.keys().next().value],seen=new Set(queue);
    for(let k=0;k<queue.length;k++)for(const n of adjacent.get(queue[k]))if(!seen.has(n)){seen.add(n);queue.push(n);}
    const degrees=[...adjacent.values()].map(x=>x.size),ends=degrees.filter(x=>x===1).length;
    if(repeated||seen.size!==adjacent.size||degrees.some(x=>x<1||x>2)||![0,2].includes(ends))failures.push({group,pairs,repeated,degrees,connected:seen.size===adjacent.size});
    else if(ends===2)paths++;else cycles++;
  }
  return {vertices:links.size,paths,cycles,failures,pass:failures.length===0};
}

try {
  assert.equal(pins[bodyFile], 'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a');
  assert.equal(pins['assets/figures/figure_g050.glb'], 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14');
  assert.equal(pins[braFile], '4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79');
  assert.equal(pins[mpfbZip], '4f0a879d64a39bf646fbf5f53601ac678855da329d650617dca5737548239a87');
  const zipCheck = spawnSync('python3', ['-c', `import sys,zipfile,hashlib,json\nfrom pathlib import Path\nz=zipfile.ZipFile(sys.argv[1]); names=[n for n in z.namelist() if n == 'entities/socketobject/_extra_vertex_groups.py']; assert len(names)==1\nb=z.read(names[0]); assert b==Path(sys.argv[2]).read_bytes()\nprint(json.dumps({'entry':names[0],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}))`, path.join(ROOT,mpfbZip),path.join(ROOT,groupSource)], {encoding:'utf8'});
  assert.equal(zipCheck.status,0,zipCheck.stderr);report.membershipSource=JSON.parse(zipCheck.stdout);
  const groupText=fs.readFileSync(path.join(ROOT,groupSource),'utf8');
  const match=groupText.match(/vertex_group_information\["basemesh"\]\["nipple"\] = (\[[^\n]+\])/);
  assert.ok(match);const nipple=JSON.parse(match[1]);assert.equal(new Set(nipple).size,nipple.length);
  const bg=readGlb(path.join(ROOT,bodyFile)),body=readPrimitive(bg,'base.001');
  const ordinary=readPrimitive(readGlb(path.join(ROOT,'assets/figures/figure_g050.glb')),'base.001');
  assert.deepEqual(body.positions,ordinary.positions);assert.deepEqual(body.indices,ordinary.indices);
  const braGlb=readGlb(path.join(ROOT,braFile)),bra=readPrimitive(braGlb,'foundation_bra');
  for(const [g,name]of [[bg,'base.001'],[braGlb,'foundation_bra']]) {
    const mi=g.json.meshes.findIndex(m=>m.name===name),nodes=g.json.nodes.map((n,i)=>({n,i})).filter(({n})=>n.mesh===mi);
    assert.equal(nodes.length,1);assert.deepEqual(worldMatrices(g.json)(nodes[0].i).elements,new Matrix4().elements);
  }
  const metadata=read('assets/identity/figure-vertex-map.json');assert.equal(metadata.groundingY,0);assert.equal(metadata.positionCount,body.vertexCount);
  const mapBytes=fs.readFileSync(path.join(ROOT,'assets/identity/figure-vertex-map.bin'));assert.equal(mapBytes.length,2*body.vertexCount);
  const inverseMap=new Map();for(let i=0;i<body.vertexCount;i++){const id=mapBytes.readUInt16LE(2*i);if(!inverseMap.has(id))inverseMap.set(id,[]);inverseMap.get(id).push(i);}
  assert.equal(inverseMap.size,13380);
  const mapped=nipple.map(id=>{const raw=inverseMap.get(id);assert.ok(raw?.length);const position=point(body.positions,raw[0]);for(const i of raw)assert.deepEqual(point(body.positions,i),position);return{basemesh:id,rawVertices:raw,position};});
  const centres=[-1,1].map(sign=>{const rows=mapped.filter(r=>(r.position[0]<0?-1:1)===sign);assert.ok(rows.length);return [0,1,2].map(k=>rows.reduce((s,r)=>s+r.position[k],0)/rows.length);});
  const world=worldMatrices(bg.json),heads={};
  for(const name of ['clavicle_l','spine_03']){const nodes=bg.json.nodes.map((n,i)=>({n,i})).filter(({n})=>n.name===name);assert.equal(nodes.length,1);heads[name]=new Vector3().setFromMatrixPosition(world(nodes[0].i)).toArray();}
  const bust=(centres[0][1]+centres[1][1])/2,ceiling=bust+.45*(heads.clavicle_l[1]-bust),floor=bust-.50*(bust-heads.spine_03[1]);
  report.anatomicalPlane={bust,ceiling,floor,centres,heads,mappedNippleVertices:mapped,interpretation:'One reconstructed anatomical source-space plane through the already offset/rolled export, not original pre-offset membership.'};
  const all=triangles(bra);
  for(const f of all)f.category=f.max[1]<=ceiling?'below':f.min[1]>ceiling?'above':'mixed';
  const kept=all.filter(f=>f.category==='below'),mixed=all.filter(f=>f.category==='mixed');
  report.faces={below:kept.map(f=>f.id),above:all.filter(f=>f.category==='above').map(f=>f.id),mixed:mixed.map(f=>f.id)};
  const prior=read(`${previous}/report.json`);assert.equal(prior.status,'no-admissible-cycle-under-declared-closure');
  assert.equal(pins[`${previous}/snapshot.json.gz`],prior.savedSnapshotSHA256);
  const snapshot=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,previous,'snapshot.json.gz'))));
  const actual=snapshot.meshes.find(m=>m.id==='foundation_bra');assert.deepEqual(actual.fullIndices,Array.from(bra.indices));
  const faceByCorners=new Map(all.map(f=>[f.indices.join(':'),f]));assert.equal(faceByCorners.size,all.length);
  report.currentCasualFaces=Array.from({length:actual.drawnIndices.length/3},(_,i)=>{const ids=actual.drawnIndices.slice(i*3,i*3+3),f=faceByCorners.get(ids.join(':'));assert.ok(f);return{face:f.id,indices:ids,category:f.category,sourceBounds:{min:f.min,max:f.max}};});
  const ba=bg.json.meshes.find(m=>m.name==='base.001').primitives[0].attributes;
  const chestAttribute=readAccessor(bg,ba._DECENCY_CHEST).data;
  const chest=Array.from(chestAttribute,(v,i)=>({v,i})).filter(r=>r.v>.5).map(r=>r.i);assert.equal(chest.length,110);
  const reach=.030,lift=.0001,gateSource=fs.readFileSync(path.join(ROOT,'packages/core/src/wardrobe/decency.selftest.mjs'),'utf8');
  assert.match(gateSource,/const COVER_REACH_M = 0\.030;/);assert.match(gateSource,/const RAY_LIFT_M = 0\.0001;/);
  report.coverageSettings={reachMetres:reach,liftMetres:lift,determinantCutoff:1e-12,distanceField:'Ray parameter t in the original raw-normal gate; euclideanDistance is t times normal length.',chestVertices:chest,sourceBounds:bounds(chest.map(i=>point(body.positions,i)))};
  const tri={id:0,vertices:[[0,0,0],[1,0,0],[0,1,0]]};
  report.rayControls=[
    ['front',[.2,.2,1],[0,0,-1],2,true],['back',[.2,.2,-1],[0,0,1],2,true],
    ['miss',[2,2,1],[0,0,-1],2,false],['finite reach',[.2,.2,1],[0,0,-1],.9,false]
  ].map(([name,o,d,r,expected])=>{const hit=hitTriangle(o,d,tri,r);assert.equal(Boolean(hit),expected);if(hit)assert.equal(hit.distance,1);return{name,expected,hit};});
  const tooLow=report.coverageSettings.sourceBounds.min[1]-.005;
  const query=(position,normal,details=false,targetFaces=all)=>{
    const origin=position.map((v,k)=>v+lift*normal[k]),end=origin.map((v,k)=>v+reach*normal[k]),box=bounds([origin,end]);
    let original=null,below=null,lowControl=null;const hits=[];
    for(const f of targetFaces){if(!overlap(box,f))continue;const hit=hitTriangle(origin,normal,f,reach);if(!hit)continue;
      if(details)hits.push({...hit,category:f.category});
      if(!original||hit.distance<original.distance)original=hit;
      if(f.category==='below'&&(!below||hit.distance<below.distance))below=hit;
      if(f.max[1]<=tooLow&&(!lowControl||hit.distance<lowControl.distance))lowControl=hit;
    }
    return {position,normal,origin,original,below,lowControl,...(details?{hits}:{} )};
  };
  report.chestRays=chest.map(vertex=>({vertex,...query(point(body.positions,vertex),point(body.normals,vertex),true)}));
  report.requiredCoverage={originalCovered:report.chestRays.filter(r=>r.original).length,belowCovered:report.chestRays.filter(r=>r.below).length,
    originalMissing:report.chestRays.filter(r=>!r.original).map(r=>r.vertex),belowMissing:report.chestRays.filter(r=>!r.below).map(r=>r.vertex),
    exactFirstHitPreserved:report.chestRays.filter(r=>JSON.stringify(r.original)===JSON.stringify(r.below)).length};
  const emptyRays=chest.map(vertex=>({vertex,...query(point(body.positions,vertex),point(body.normals,vertex),false,[])}));
  report.controls={emptyTorso:{covered:emptyRays.filter(r=>r.original).length,missing:emptyRays.filter(r=>!r.original).length,pass:emptyRays.every(r=>!r.original)&&report.chestRays.every(r=>r.original),rays:emptyRays},tooLow:{height:tooLow,covered:report.chestRays.filter(r=>r.lowControl).length,lost:report.chestRays.filter(r=>r.original&&!r.lowControl).map(r=>r.vertex)}};
  assert.ok(report.controls.emptyTorso.pass);assert.ok(report.controls.tooLow.lost.length>0);
  const chestSet=new Set(chest),fan=triangles(body).filter(f=>f.indices.some(i=>chestSet.has(i)));
  report.fan={order:4,faces:fan.map(f=>f.id),rays:[]};
  for(const f of fan)for(let a=0;a<=4;a++)for(let b=0;b<=4-a;b++){
    const barycentric=[a,b,4-a-b].map(v=>v/4),position=[0,1,2].map(k=>f.vertices.reduce((s,p,i)=>s+barycentric[i]*p[k],0)),normal=unit([0,1,2].map(k=>f.indices.reduce((s,v,i)=>s+barycentric[i]*body.normals[v*3+k],0)));
    const r=query(position,normal);report.fan.rays.push({bodyFace:f.id,barycentric,original:r.original,below:r.below});
  }
  report.fan.summary={samplesIncludingDuplicates:report.fan.rays.length,baselineUncovered:report.fan.rays.filter(r=>!r.original).length,lostCoveredSamples:report.fan.rays.filter(r=>r.original&&!r.below).length,belowCovered:report.fan.rays.filter(r=>r.below).length};
  const rayMinY=Math.min(...report.chestRays.map(r=>Math.min(r.origin[1],r.origin[1]+reach*r.normal[1])));
  report.floorConfigurations=[];
  for(const id of ['foundation_briefs','foundation_boxer_brief']){
    const p=readPrimitive(readGlb(path.join(ROOT,`assets/wardrobe/${id}/g050.glb`)),id),b=bounds(Array.from({length:p.vertexCount},(_,i)=>point(p.positions,i)));
    assert.ok(b.max[1]<rayMinY);
    report.floorConfigurations.push({torso:'foundation_bra',hips:id,hipBounds:b,lowestChestRayY:rayMinY,hipCannotSupplyChestHits:true,torsoOriginalCovered:report.requiredCoverage.originalCovered,torsoBelowCovered:report.requiredCoverage.belowCovered});
  }
  report.subsetTopology=topology({positions:bra.positions,indices:kept.flatMap(f=>f.indices)});
  report.subsetVertexLinks=vertexLinks(bra,kept);
  const attr=braGlb.json.meshes.find(m=>m.name==='foundation_bra').primitives[0].attributes;
  const joints=readAccessor(braGlb,attr.JOINTS_0).data,weights=readAccessor(braGlb,attr.WEIGHTS_0).data;
  const bodyGrid=new SurfaceGrid(body.positions,body.normals,body.indices);
  report.mixedTriangles=mixed.map(f=>{
    const crossings=[];
    for(let k=0;k<3;k++){
      const ia=f.indices[k],ib=f.indices[(k+1)%3],a=point(bra.positions,ia),b=point(bra.positions,ib);
      if((a[1]<=ceiling)===(b[1]<=ceiling))continue;
      const t=(ceiling-a[1])/(b[1]-a[1]),p=a.map((v,j)=>v+t*(b[j]-v)),hit=bodyGrid.nearest(p);
      const jointSet=new Set();for(const v of [ia,ib])for(let c=0;c<4;c++)if(weights[v*4+c]>0)jointSet.add(joints[v*4+c]);
      crossings.push({edge:[ia,ib],fraction:t,point:p,bodyNearest:{triangle:hit.triangle/3,point:hit.closest,signed:hit.signed},skinInfluenceUnion:[...jointSet].sort((a,b)=>a-b)});
    }
    assert.equal(crossings.length,2);return{face:f.id,indices:f.indices,crossings};
  });
  report.mixedSummary={triangles:mixed.length,maxEdgeInfluenceUnion:Math.max(...report.mixedTriangles.flatMap(f=>f.crossings.map(e=>e.skinInfluenceUnion.length))),nearestBodyMinimumUnsigned:Math.min(...report.mixedTriangles.flatMap(f=>f.crossings.map(e=>Math.abs(e.bodyNearest.signed))))};
  report.vertexCoverageFeasible=report.requiredCoverage.originalCovered===chest.length&&report.requiredCoverage.belowCovered===chest.length;
  report.additionalFanPrerequisite=report.fan.summary.lostCoveredSamples===0;
  report.feasibleSourceSubset=report.vertexCoverageFeasible&&report.additionalFanPrerequisite;
  report.status=report.feasibleSourceSubset?'source-vertex-and-fan-prerequisites-met':'source-band-prerequisites-not-established';
  report.limits=[
    'No clipped mesh, new hem, asset export, native image, pose range or runtime transition qualification.',
    'The horizontal plane is reconstructed from current exported anatomy; original offset/relaxation/roll labels are not recovered.',
    'Nearest-body witnesses are geometric correspondences, not original subdivision or skin provenance.',
    'The supplementary fan has fixed samples including duplicates; it is neither a complete surface coverage certificate nor a new product target.',
    'Topology and skin-union receipts inform a separate construction contract; source coverage does not qualify the new rim.'
  ];
  for(const [p,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,p)),h,p);
} catch(error) {
  report.status='failed';report.errors.push(error.stack);throw error;
} finally {
  report.finished=new Date().toISOString();save();
}
console.log(JSON.stringify({status:report.status,pid:report.pid,plane:report.anatomicalPlane?.ceiling,faces:Object.fromEntries(Object.entries(report.faces??{}).map(([k,v])=>[k,v.length])),required:report.requiredCoverage,fan:report.fan?.summary,mixed:report.mixedSummary,reportSHA256:hashFile(path.join(output,'report.json'))}));
