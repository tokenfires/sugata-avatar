/** One declared analytic full-prefix observation on two ribbons. No sweep or GLB. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readGlb, readPrimitive} from '../lut-bake/glb.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';

const started = new Date().toISOString();
const output = process.argv[2] ?? 'captures/bob-front-prefix-objective-v1';
assert.ok(!fs.existsSync(output), `Preserve existing evidence: ${output}`);
const files = {
  hair: 'captures/bob-side-envelope-v3/candidate.glb',
  body: 'assets/figures/figure_g050.glb',
  inventory: 'captures/bob-front-constraints-v1/report.json',
  previous: 'captures/bob-front-reachability-v1/report.json',
};
const expected = {
  hair: 'bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9',
  body: 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14',
  inventory: '4a48e9a0f804eda92c7d4795e6b025e12eab884caadc269273f88f95e5cb5946',
  previous: 'ae4ad28fac664cff456639589eb822593618dbef7c526c96ccf70e1e0e9cf2ae',
};
const sources = [
  'tools/critic/probe-front-prefix-objective.mjs', 'tools/lut-bake/glb.mjs',
  'tools/figure-pipeline/hair_geometry.mjs', 'tools/figure-pipeline/hair_surface.mjs',
  'tools/critic/png.mjs', 'docs/evidence/hair-2026-09-30/front-prefix-objective/PLAN.md',
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = Object.fromEntries([...Object.values(files), ...sources].map(file => [file, sha(fs.readFileSync(file))]));
for (const [key,file] of Object.entries(files)) assert.equal(pins[file],expected[key],file);
const inventory = JSON.parse(fs.readFileSync(files.inventory));
const previous = JSON.parse(fs.readFileSync(files.previous));
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

function paths(positions) {
  return [Array.from({length:17},(_,r)=>centre(positions,r)),
    ...[0,1].map(side=>Array.from({length:17},(_,r)=>point(positions,r*2+side)))];
}

function localMetrics(original, observed) {
  const before=paths(original.positionsMetres),after=paths(observed.positionsMetres);
  return after.map((points,index)=>({path:['centre','edge0','edge1'][index],
    rootOutgoingDirectionChangeDegrees:angle(sub(points[1],points[0]),sub(before[index][1],before[index][0])),
    affectedSpansMm:[0,1].map(i=>norm(sub(points[i+1],points[i]))*1000),
    originalAffectedSpansMm:[0,1].map(i=>norm(sub(before[index][i+1],before[index][i]))*1000),
    turnsDegrees:[1,2].map(i=>angle(sub(points[i],points[i-1]),sub(points[i+1],points[i]))),
    originalTurnsDegrees:[1,2].map(i=>angle(sub(before[index][i],before[index][i-1]),sub(before[index][i+1],before[index][i]))),
  }));
}

const records=[];
for(const card of [145,204]) {
  const prior=inventory.records.find(r=>r.card===card),ribbon=localRibbon(card);
  assert.deepEqual(prior.freeRings,[1]);assert.equal(prior.suffix.fromRing,2);
  for(let r=0;r<17;r++)assert.deepEqual(centre(ribbon.positions,r),prior.variants.baseline.samples[r].centreMetres);
  const baseline=observe(card,ribbon,ribbon.positions,'baseline');
  const terms=[];
  for(const side of [0,1]) {
    const p=Array.from({length:4},(_,r)=>point(ribbon.positions,r*2+side));
    const h=[0,1,2].map(i=>norm(sub(p[i+1],p[i])));
    assert.ok(h.every(x=>x>0));
    const v=[0,1,2].map(i=>mul(sub(p[i+1],p[i]),1/h[i]));
    terms.push({side,ring:1,originalSpanMetres:h,weight:2/(h[0]+h[1]),a:-(1/h[0]+1/h[1]),b:sub(v[1],v[0])},
      {side,ring:2,originalSpanMetres:h,weight:2/(h[1]+h[2]),a:1/h[1],b:sub(v[2],v[1])});
  }
  const denominator=terms.reduce((s,t)=>s+t.weight*t.a*t.a,0);
  assert.ok(denominator>0);
  const numerator=[0,1,2].map(k=>terms.reduce((s,t)=>s+t.weight*t.a*t.b[k],0));
  const delta=mul(numerator,-1/denominator);
  const positions=ribbon.positions.slice();
  for(const v of [2,3])for(let k=0;k<3;k++)positions[v*3+k]+=delta[k];
  const candidate=observe(card,ribbon,positions,'analytic-fixed-parameter-minimum',{
    translationMetres:delta,translationMm:norm(delta)*1000,
    sourceParameters:'Each edge uses its original three span lengths. Original ring1 width is retained; only two edge positions translate together.'});
  const objective=d=>terms.reduce((s,t)=>s+t.weight*dot(add(t.b,mul(d,t.a)),add(t.b,mul(d,t.a))),0);
  const J0=objective([0,0,0]),J1=objective(delta);
  const gradient=mul(add(numerator,mul(delta,denominator)),2);
  assert.ok(norm(gradient)<=1e-10*Math.max(1,norm(numerator)));
  const metrics=localMetrics(baseline,candidate);
  const angleChecks=metrics.flatMap(m=>m.turnsDegrees.map((degrees,i)=>({path:m.path,ring:i+1,
    originalDegrees:m.originalTurnsDegrees[i],degrees,deltaDegrees:degrees-m.originalTurnsDegrees[i],
    pass:degrees<=m.originalTurnsDegrees[i]+1e-6})));
  const spanChecks=metrics.map(m=>({path:m.path,originalMinimumMm:Math.min(...m.originalAffectedSpansMm),
    minimumMm:Math.min(...m.affectedSpansMm),pass:Math.min(...m.affectedSpansMm)>=Math.min(...m.originalAffectedSpansMm)-1e-9}));
  const gates={angles:angleChecks.every(x=>x.pass),affectedSpans:spanChecks.every(x=>x.pass),
    adjacentArea:candidate.minimumAdjacentTriangleAreaMm2>=baseline.minimumAdjacentTriangleAreaMm2-1e-9,
    body:candidate.triangleBodyPairs===0&&candidate.negativeVertices===0,
    strictlyImprovedProxy:J1<J0*(1-1e-8)};
  const old=previous.records.find(r=>r.card===card);
  records.push({card,terms,hessianScalar:2*denominator,analyticTranslationMetres:delta,
    stationaryGradient:gradient,objectiveUnit:'inverse metres; fixed-parameter second difference, including tangential stretch',
    baselineObjective:J0,derivedObjective:J1,relativeProxyDecrease:(J0-J1)/J0,
    gates,passesAllConservativeGates:Object.values(gates).every(Boolean),angleChecks,spanChecks,metrics,
    previousExactJoinControls:old.witnesses.map(w=>({kind:w.kind,turns:w.turns.slice(0,2),edgeTurns:w.edgeTurns.slice(0,2),
      firstTwoSpansMm:w.spansMm.slice(0,2),minimumAdjacentTriangleAreaMm2:w.minimumAdjacentTriangleAreaMm2})),
    observations:[baseline,candidate]});
}
for(const [file,hash]of Object.entries(pins))assert.equal(sha(fs.readFileSync(file)),hash,file);
const report={status:'complete one-shot whole-prefix objective observation; no asset or appearance claim',
  started,finished:new Date().toISOString(),pid:process.pid,nodeVersion:process.version,
  command:`node tools/critic/probe-front-prefix-objective.mjs ${output}`,pins,records,
  coordinates:'Authored GLB XYZ metres, X lateral/Y up/Z anterior. Arrays are JS doubles; no Float32 asset exported.',
  limits:[
    'One declared unconstrained analytic minimizer per card, followed by fixed conservative gates. No parameter sweep, iterative solver or retuning.',
    'The fixed-parameter quadratic is a proxy that includes tangential stretch, not geometric curvature or photographic fidelity.',
    'Gate failure rejects this minimizer, not general feasibility under the fixed anchors. Non-regression floors are optional engineering constraints.',
    'Only the two affected intervals and rings1/2 are evaluated for bend redistribution. Root position is fixed but outgoing direction can change; it is reported.',
    'The full original32 triangles per observation are audited against all body triangles. Zero crossing and positive sampled vertices do not prove continuous positive clearance.',
    'No new GLB, shading normals, render, alpha/coverage, hair-hair, garment or motion qualification. No cards are promoted or reset to these observations.',
  ]};
fs.mkdirSync(output,{recursive:true});
for(const file of sources) {
  const destination=path.join(output,'source',file);fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(file,destination);assert.equal(sha(fs.readFileSync(destination)),pins[file]);
}
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,reportPath:`${output}/report.json`,reportSha256:sha(fs.readFileSync(`${output}/report.json`)),
  records:records.map(r=>({card:r.card,translationMm:norm(r.analyticTranslationMetres)*1000,
    proxyDecrease:r.relativeProxyDecrease,gates:r.gates,angleChecks:r.angleChecks,spanChecks:r.spanChecks,
    areaMm2:r.observations.map(x=>x.minimumAdjacentTriangleAreaMm2),
    bodyPairs:r.observations.map(x=>x.triangleBodyPairs),negativeVertices:r.observations.map(x=>x.negativeVertices)}))},null,2));
