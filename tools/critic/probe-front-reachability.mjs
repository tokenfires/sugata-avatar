/** Four-card necessary bounds and two declared long-card ribbon witnesses. No GLB or search. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readGlb, readPrimitive} from '../lut-bake/glb.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';

const started = new Date().toISOString();
const output = process.argv[2] ?? 'captures/bob-front-reachability-v1';
assert.ok(!fs.existsSync(output), `Preserve existing evidence: ${output}`);
const files = {
  hair: 'captures/bob-side-envelope-v3/candidate.glb',
  body: 'assets/figures/figure_g050.glb',
  inventory: 'captures/bob-front-constraints-v1/report.json',
};
const expected = {
  hair: 'bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9',
  body: 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14',
  inventory: '4a48e9a0f804eda92c7d4795e6b025e12eab884caadc269273f88f95e5cb5946',
};
const sources = [
  'tools/critic/probe-front-reachability.mjs', 'tools/lut-bake/glb.mjs',
  'tools/figure-pipeline/hair_geometry.mjs', 'tools/figure-pipeline/hair_surface.mjs',
  'tools/critic/png.mjs',
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = Object.fromEntries([...Object.values(files), ...sources].map(file => [file, sha(fs.readFileSync(file))]));
for (const [key,file] of Object.entries(files)) assert.equal(pins[file],expected[key],file);
const inventory = JSON.parse(fs.readFileSync(files.inventory));
const hair = readPrimitive(readGlb(files.hair),'hair_bob02');
const body = readPrimitive(readGlb(files.body),'base.001');
const grid = new SurfaceGrid(body.positions,body.normals,body.indices);
const add = (a,b) => a.map((x,k)=>x+b[k]);
const sub = (a,b) => a.map((x,k)=>x-b[k]);
const mul = (a,s) => a.map(x=>x*s);
const dot = (a,b) => a.reduce((s,x,k)=>s+x*b[k],0);
const norm = a => Math.hypot(...a);
const unit = a => mul(a,1/norm(a));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const angle = (a,b) => Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))))*180/Math.PI;
const point = (positions,v) => Array.from(positions.slice(3*v,3*v+3));
const centre = (positions,r) => mul(add(point(positions,r*2),point(positions,r*2+1)),.5);
const bounds = {min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};

function localRibbon(card) {
  const first=652+card*34, positions=Array.from(hair.positions.slice(first*3,(first+34)*3));
  const indices=[], sourceTriangles=[];
  for(let i=0;i<hair.indices.length;i+=3) {
    const tri=Array.from(hair.indices.slice(i,i+3));
    if(tri.every(v=>v>=first&&v<first+34)) {
      indices.push(...tri.map(v=>v-first));sourceTriangles.push(i/3);
    }
  }
  assert.equal(indices.length,96);
  return {positions,indices,sourceTriangles};
}

function observe(card, original, positions, kind, parameters={}) {
  const centres=Array.from({length:17},(_,r)=>centre(positions,r));
  const spans=centres.slice(1).map((p,r)=>norm(sub(p,centres[r]))*1000);
  const turns=centres.slice(1,-1).map((p,i)=>({ring:i+1,degrees:angle(sub(p,centres[i]),sub(centres[i+2],p))}));
  const edgeTurns=Array.from({length:15},(_,i)=>({ring:i+1,degrees:[0,1].map(side=>{
    const before=point(positions,i*2+side),at=point(positions,(i+1)*2+side),after=point(positions,(i+2)*2+side);
    return angle(sub(at,before),sub(after,at));
  })}));
  const vertices=Array.from({length:34},(_,v)=>{
    const p=point(positions,v),nearest=grid.nearest(p);assert.ok(nearest);
    return {ring:Math.floor(v/2),side:v%2,pointMetres:p,signedMm:nearest.signed*1000,
      bodyTriangle:nearest.triangle/3,closestMetres:nearest.closest};
  });
  const triangles=[];
  for(let i=0;i<original.indices.length;i+=3) {
    const indices=original.indices.slice(i,i+3),[a,b,c]=indices.map(v=>point(positions,v));
    triangles.push({localTriangle:i/3,sourceTriangle:original.sourceTriangles[i/3],indices,
      areaMm2:norm(cross(sub(b,a),sub(c,a)))*.5e6,
      adjacentToMovedRing:indices.some(v=>v===2||v===3)});
  }
  // Original local indices and full, unbounded body; no alpha or proxy surface.
  const crossings=measureHairSurface({positions,indices:original.indices},body,
    {headBounds:bounds,faceBounds:bounds,epsilon:1e-9,exampleLimit:100});
  for(const example of crossings.head.examples) {
    example.originalCard=card;
    example.sourceHairTriangle=original.sourceTriangles[example.hairTriangle];
  }
  const rings=centres.map((c,r)=>{
    const width=sub(point(positions,r*2+1),point(positions,r*2));
    const oldWidth=sub(point(original.positions,r*2+1),point(original.positions,r*2));
    const tangent=unit(sub(centres[Math.min(16,r+1)],centres[Math.max(0,r-1)]));
    return {ring:r,centreMetres:c,widthMm:norm(width)*1000,widthVectorDeltaMm:norm(sub(width,oldWidth))*1000,
      widthDotTangent:dot(unit(width),tangent),centreDeltaMm:norm(sub(c,centre(original.positions,r)))*1000};
  });
  for(let v=0;v<34;v++)if(kind==='baseline'||(v!==2&&v!==3))
    assert.deepEqual(point(positions,v),point(original.positions,v),'Unexpected fixed record change');
  return {kind,parameters,positionsMetres:positions,spansMm:spans,turns,edgeTurns,rings,vertices,triangles,
    prefixArcMm:spans[0]+spans[1],triangleBodyPairs:crossings.head.pairs,crossings,
    negativeVertices:vertices.filter(v=>v.signedMm<0).length,
    minimumSignedVertex:vertices.reduce((a,b)=>a.signedMm<b.signedMm?a:b),
    minimumAdjacentTriangleAreaMm2:Math.min(...triangles.filter(t=>t.adjacentToMovedRing).map(t=>t.areaMm2)),
    rootAndSuffixPositionRecordsExact:true,
    float32MaximumRoundTripDeltaMm:Math.max(...Array.from({length:34},(_,v)=>
      norm(point(positions,v).map(x=>Math.fround(x)-x))*1000))};
}

const records=[];
for(const card of [7,46,145,204]) {
  const prior=inventory.records.find(r=>r.card===card),ribbon=localRibbon(card);
  for(let r=0;r<17;r++)assert.deepEqual(centre(ribbon.positions,r),prior.variants.baseline.samples[r].centreMetres);
  const original=observe(card,ribbon,ribbon.positions,'baseline');
  if(card<78) {
    const chord=norm(sub(prior.requestedEndpointMetres,centre(ribbon.positions,0)));
    const arc=original.spansMm.reduce((s,x)=>s+x,0)/1000;
    records.push({card,kind:'short-card necessary reach bound',requestedEndpointMetres:prior.requestedEndpointMetres,
      originalArcMm:arc*1000,rootToRequestedEndpointMm:chord*1000,minimumArcGrowthFactor:chord/arc,
      fixedArcEndpointFeasible:chord<=arc,
      interpretation:'Triangle inequality excludes this requested endpoint if original arc length is retained. No body-aware route is constructed; the endpoint and length-preservation condition are experimental assumptions.',
      witnesses:[original]});
    continue;
  }
  assert.deepEqual(prior.freeRings,[1]);assert.equal(prior.suffix.fromRing,2);
  const c0=centre(ribbon.positions,0),c1=centre(ribbon.positions,1),c2=centre(ribbon.positions,2),c3=centre(ribbon.positions,3);
  const tangent=unit(sub(c3,c2)),d=sub(c2,c0),arc=original.prefixArcMm/1000,projection=dot(d,tangent);
  assert.ok(arc>projection&&arc>=norm(d));
  const lambdaMax=(arc*arc-dot(d,d))/(2*(arc-projection)),oldSpan=norm(sub(c2,c1));
  assert.ok(lambdaMax>0&&lambdaMax<arc);
  const witnesses=[original];
  for(const [kind,lambda] of [['exact-tangent-preserve-prefix-arc',lambdaMax],['exact-tangent-preserve-final-span',oldSpan]]) {
    const target=sub(c2,mul(tangent,lambda)),delta=sub(target,c1),positions=ribbon.positions.slice();
    for(const v of [2,3])for(let k=0;k<3;k++)positions[v*3+k]+=delta[k];
    const observed=observe(card,ribbon,positions,kind,{lambdaMm:lambda*1000,targetCentreMetres:target,
      ring1WidthFrame:'Original edge vector retained by translating both edges together in JS double precision; no width rotation or normal update.'});
    observed.prefixArcGrowthFactor=observed.prefixArcMm/original.prefixArcMm;
    observed.lastPrefixSpanRatio=observed.spansMm[1]/original.spansMm[1];
    if(kind==='exact-tangent-preserve-prefix-arc')assert.ok(Math.abs(observed.prefixArcMm-original.prefixArcMm)<1e-9);
    assert.ok(observed.turns.find(t=>t.ring===2).degrees<1e-4);
    witnesses.push(observed);
  }
  records.push({card,kind:'one-free-ring exact join tangent family',rootMetres:c0,joinMetres:c2,
    suffixTangent:tangent,originalPrefixArcMm:arc*1000,rootToJoinChordMm:norm(d)*1000,
    chordProjectionOnSuffixMm:projection*1000,lambdaMaximumAtOriginalArcMm:lambdaMax*1000,
    originalFinalSpanMm:oldSpan*1000,maximumLambdaToOriginalSpanRatio:lambdaMax/oldSpan,
    derivation:'c1=c2-lambda*t, lambda>0. Prefix arc=|d-lambda*t|+lambda. With L=original prefix arc, d=c2-c0, and L>d.t, arc<=L implies lambda<=(L^2-|d|^2)/(2*(L-d.t)). Squaring requires lambda<=L, checked for these witnesses.',
    interpretation:'Exact zero discrete join angle and no prefix growth are diagnostic conditions, not photographic requirements. The family is necessary/sufficient for this centreline length inequality only, before width, body, appearance or motion.',witnesses});
}
for(const [file,hash]of Object.entries(pins))assert.equal(sha(fs.readFileSync(file)),hash,file);
const report={status:'complete bounded reachability diagnostics; no new asset or appearance qualification',
  started,finished:new Date().toISOString(),pid:process.pid,nodeVersion:process.version,command:`node tools/critic/probe-front-reachability.mjs ${output}`,pins,records,
  coordinates:'Authored GLB XYZ metres, X lateral/Y up/Z anterior; diagnostic arrays evaluated in JS double precision. No Float32 candidate is exported.',
  limits:[
    'No search or optimizer. Two long-card witnesses were declared before evaluation; short cards have bounds and baseline controls only.',
    'Zero triangle crossings plus sampled positive vertices is a bounded rest-body observation, not proof of a positive clearance over the entire ribbon.',
    'Signed closest-point distance uses interpolated body normals, not watertight inside/outside parity.',
    'Only each witness card is audited against the body. Cap, other hair, hair-hair, garments, alpha, visible coverage, dynamics and motion are unqualified.',
    'A clear near-collapsed segment is not a usable groom pass; retain segment and adjacent triangle-area evidence.',
    'A failed fixed-width witness rejects that sample/frame only. No general full-ribbon infeasibility conclusion follows.',
    'No GLB, shading normals, render or visible improvement is produced. Root and suffix positions remain exact in each diagnostic array; no byte claim is made for a future export.',
  ]};
fs.mkdirSync(output,{recursive:true});
for(const file of sources) {
  const destination=path.join(output,'source',file);fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(file,destination);assert.equal(sha(fs.readFileSync(destination)),pins[file]);
}
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,report:`${output}/report.json`,reportSha256:sha(fs.readFileSync(`${output}/report.json`)),
  records:records.map(r=>({card:r.card,minimumArcGrowthFactor:r.minimumArcGrowthFactor,
    lambdaMaximumAtOriginalArcMm:r.lambdaMaximumAtOriginalArcMm,witnesses:r.witnesses.map(w=>({kind:w.kind,
      pairs:w.triangleBodyPairs,negativeVertices:w.negativeVertices,minSignedMm:w.minimumSignedVertex.signedMm,
      prefixArcMm:w.prefixArcMm,firstTwoSpansMm:w.spansMm.slice(0,2),firstTwoTurns:w.turns.slice(0,2),
      edgeJoinDegrees:w.edgeTurns.find(t=>t.ring===2).degrees,
      minimumAdjacentTriangleAreaMm2:w.minimumAdjacentTriangleAreaMm2,prefixArcGrowthFactor:w.prefixArcGrowthFactor}))}))},null,2));
