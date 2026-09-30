/** Read-only four-card constraint inventory. Writes evidence only, never a GLB or candidate. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readGlb, readPrimitive} from '../lut-bake/glb.mjs';
import {SurfaceGrid, rayTriangle} from '../figure-pipeline/hair_geometry.mjs';

const started = new Date().toISOString();
const output = 'captures/bob-front-constraints-v1';
assert.ok(!fs.existsSync(output), `Preserve existing evidence: ${output}`);
const files = {
  baseline: 'captures/bob-side-envelope-v3/candidate.glb',
  body: 'assets/figures/figure_g050.glb',
  cubic: 'captures/bob-front-flow-v1/candidate.glb',
  support: 'captures/bob-front-support-v1/candidate.glb',
};
const expected = {
  baseline: 'bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9',
  body: 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14',
  cubic: '8503966620ed993eea2e2dbb2a60bea6265c84256e1848e6e72c0cfde8dde412',
  support: '488f5ea56c7afdebf83b6c65330f86e24109f798c81468e14ee0f5b78e847cc0',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
for (const [key, file] of Object.entries(files)) assert.equal(sha(fs.readFileSync(file)), expected[key]);
const reports = {
  cubic: 'captures/bob-front-flow-v1/candidate-report.json',
  support: 'captures/bob-front-support-v1/candidate-report.json',
  audit: 'captures/bob-front-prototype-audit-v1/summary.json',
};
const cubicReport = read(reports.cubic), supportReport = read(reports.support), audit = read(reports.audit);
assert.equal(cubicReport.outputSha256, expected.cubic);
assert.equal(supportReport.outputSha256, expected.support);
assert.equal(audit.status, 'complete; both candidates rejected');
assert.equal(audit.baseline.sha256, expected.baseline);
assert.equal(audit.baseline.triangleBodyPairs, 0);
assert.equal(audit.baseline.negativeVertices, 0);
const sourceFiles = [
  'tools/critic/inventory-front-constraints.mjs',
  'tools/lut-bake/glb.mjs',
  'tools/figure-pipeline/hair_geometry.mjs',
  'tools/critic/bob-front-flow.mjs',
  'tools/critic/bob-front-support.mjs',
  'tools/critic/audit-bob-front-prototypes.mjs',
];
assert.equal(sha(fs.readFileSync(sourceFiles[3])), cubicReport.sourceSha256);
assert.equal(sha(fs.readFileSync(sourceFiles[4])), supportReport.sourceSha256);
assert.equal(sha(fs.readFileSync(sourceFiles[5])), audit.sourceSha256);
const pinnedPaths = [...Object.values(files), ...Object.values(reports), ...sourceFiles];
const pins = Object.fromEntries(pinnedPaths.map(file => [file, sha(fs.readFileSync(file))]));
const geometries = Object.fromEntries(Object.entries(files).map(([key, file]) =>
  [key, readPrimitive(readGlb(file), key === 'body' ? 'base.001' : 'hair_bob02')]));
const {body, baseline} = geometries;
const grid = new SurfaceGrid(body.positions, body.normals, body.indices);
const support = supportReport.parameters.support;
const add = (a,b) => a.map((x,k)=>x+b[k]);
const sub = (a,b) => a.map((x,k)=>x-b[k]);
const mul = (a,s) => a.map(x=>x*s);
const length = a => Math.hypot(...a);
const dot = (a,b) => a.reduce((s,x,k)=>s+x*b[k],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => length(a) > 1e-12 ? mul(a,1/length(a)) : null;
const angle = (a,b) => a && b ? Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*180/Math.PI : null;
const vertex = (card,ring,side) => 652+card*34+ring*2+side;
const triplet = (array,v) => Array.from(array.slice(v*3,v*3+3));
const edge = (g,c,r,s) => triplet(g.positions,vertex(c,r,s));
const centre = (g,c,r) => mul(add(edge(g,c,r,0),edge(g,c,r,1)),.5);
const width = (g,c,r) => sub(edge(g,c,r,1),edge(g,c,r,0));
function nearest(point) {
  const hit = grid.nearest(point);
  assert.ok(hit && Number.isFinite(hit.signed));
  return {signedMm: hit.signed*1000, closestMetres: hit.closest,
    bodyPrimitiveTriangle: hit.triangle/3};
}

/** Axis lies in authored XZ, ray direction is unit length, positive distance is in metres. */
function radialSection(point, maximumHalfWidthMetres) {
  const theta = Math.atan2(point[2]-support.cz,point[0]);
  const originMetres = [0,point[1],support.cz];
  const unitDirection = [Math.cos(theta),0,Math.sin(theta)];
  const hits = [];
  for (let offset=0; offset<body.indices.length; offset+=3) {
    const hit = rayTriangle(originMetres,unitDirection,body.positions,body.indices,offset);
    if (hit) hits.push({bodyPrimitiveTriangle:offset/3, distanceMetres:hit.distance,
      pointMetres:add(originMetres,mul(unitDirection,hit.distance)), barycentric:hit.bary});
  }
  hits.sort((a,b)=>a.distanceMetres-b.distanceMetres);
  const uniqueDistancesMetres = [];
  for (const hit of hits) {
    if (!uniqueDistancesMetres.length || hit.distanceMetres-uniqueDistancesMetres.at(-1)>1e-8)
      uniqueDistancesMetres.push(hit.distanceMetres);
  }
  const shellTerm = 1-((point[1]-support.cy)/support.ry)**2;
  const bareEllipsoidRadiusMetres = Math.sqrt(Math.max(0,shellTerm)) /
    Math.sqrt((Math.cos(theta)/support.rx)**2+(Math.sin(theta)/support.rz)**2);
  const requestedRadiusMetres = bareEllipsoidRadiusMetres+support.extraRadius+maximumHalfWidthMetres;
  const actualRadiusMetres = Math.hypot(point[0],point[2]-support.cz);
  const farthestHitMetres = uniqueDistancesMetres.at(-1) ?? null;
  return {originMetres, unitDirection, thetaRadians:theta,
    originNearestBody:nearest(originMetres), hits, uniqueDistancesMetres, farthestHitMetres,
    noForwardIntersection: hits.length===0, shellTerm,
    shellTermClamped: shellTerm<0, actualRadiusMetres, bareEllipsoidRadiusMetres,
    maximumHalfWidthMetres, extraRadiusMetres:support.extraRadius, requestedRadiusMetres,
    requestedMinusActualMm:(requestedRadiusMetres-actualRadiusMetres)*1000,
    bareShellMinusFarthestHitMm:farthestHitMetres===null ? null : (bareEllipsoidRadiusMetres-farthestHitMetres)*1000,
    requestedMinusFarthestHitMm:farthestHitMetres===null ? null : (requestedRadiusMetres-farthestHitMetres)*1000};
}

function pathSamples(g,card) {
  const centres=Array.from({length:17},(_,r)=>centre(g,card,r));
  let arcMetres=0;
  const samples=centres.map((point,r)=>{
    if(r)arcMetres+=length(sub(point,centres[r-1]));
    const widthVectorMetres=width(g,card,r), widthAxis=unit(widthVectorMetres);
    const tangent=unit(sub(centres[Math.min(16,r+1)],centres[Math.max(0,r-1)]));
    return {ring:r,centreMetres:point,edgesMetres:[edge(g,card,r,0),edge(g,card,r,1)],
      normals:[0,1].map(s=>triplet(g.normals,vertex(card,r,s))),widthVectorMetres,
      widthMm:length(widthVectorMetres)*1000,widthAxis,tangent,
      widthDotTangent:widthAxis&&tangent?dot(widthAxis,tangent):null,
      geometricNormalFromWidthCrossTangent:widthAxis&&tangent?unit(cross(widthAxis,tangent)):null,
      centreNearestBody:nearest(point),edgeNearestBody:[0,1].map(s=>nearest(edge(g,card,r,s))),
      centreDeltaFromBaselineMm:length(sub(point,centre(baseline,card,r)))*1000};
  });
  const turns=[];
  for(let r=1;r<16;r++)turns.push({ring:r,degrees:angle(unit(sub(centres[r],centres[r-1])),unit(sub(centres[r+1],centres[r])))});
  return {arcMetres,samples,turns,undefinedTurns:turns.filter(x=>x.degrees===null)};
}

const records=[];
for(const card of [7,46,145,204]) {
  const recipe=supportReport.records.find(r=>r.card===card),oldRecipe=cubicReport.records.find(r=>r.card===card);
  assert.ok(recipe&&oldRecipe);assert.deepEqual(recipe.control,oldRecipe.control);
  assert.equal(recipe.side,oldRecipe.side);assert.equal(recipe.fixedSuffixFrom,oldRecipe.fixedSuffixFrom);
  const maximumHalfWidthMetres=Math.max(...Array.from({length:17},(_,r)=>length(width(baseline,card,r))/2));
  const variants=Object.fromEntries(['baseline','cubic','support'].map(k=>[k,pathSamples(geometries[k],card)]));
  const j=recipe.fixedSuffixFrom;
  const suffix=j===null?null:{fromRing:j,centreMetres:centre(baseline,card,j),
    nextCentreMetres:centre(baseline,card,j+1),
    unitTangent:unit(sub(centre(baseline,card,j+1),centre(baseline,card,j))),
    fixedRings:Array.from({length:17-j},(_,i)=>i+j),
    originalRootToJoinChordMm:length(sub(centre(baseline,card,j),centre(baseline,card,0)))*1000,
    joins:Object.fromEntries(['baseline','cubic','support'].map(k=>[k,variants[k].turns.find(t=>t.ring===j)]))};
  const freeRings=Array.from({length:j===null?16:j-1},(_,i)=>i+1);
  for(const k of ['cubic','support']){
    assert.deepEqual(variants[k].samples[0].edgesMetres,variants.baseline.samples[0].edgesMetres);
    if(suffix)for(const r of suffix.fixedRings)assert.deepEqual(variants[k].samples[r].edgesMetres,variants.baseline.samples[r].edgesMetres);
  }
  records.push({card,kind:recipe.kind,requestedEndpointMetres:recipe.control[3],
    originalTipMetres:centre(baseline,card,16),side:recipe.side,
    originalRootFrame:variants.baseline.samples[0],freeRings,freeRingCount:freeRings.length,
    suffix,maximumHalfWidthMetres,sourceRecipe:recipe,
    inheritedBaselineClearanceEvidence:{report:reports.audit,sha256:pins[reports.audit],
      scope:'All158 front cards at source rest, including this card; fresh oracle is not rerun by this inventory.',
      triangleBodyPairs:audit.baseline.triangleBodyPairs,negativeVertices:audit.baseline.negativeVertices},
    variants,
    radialSupportAtOriginalPath:variants.baseline.samples.map(s=>({ring:s.ring,...radialSection(s.centreMetres,maximumHalfWidthMetres)})),
    radialSupportAtFailedSupportPath:variants.support.samples.map(s=>({ring:s.ring,...radialSection(s.centreMetres,maximumHalfWidthMetres)})),
    feasibility:{solverRun:false,result:'undetermined',
      fixedRootEdgesAndSuffixChecked:true,originalPathProvidesClearanceControlOnly:true}});
}
// Fail instead of publishing evidence if an input changed while this observer was running.
for(const [file,hash] of Object.entries(pins))assert.equal(sha(fs.readFileSync(file)),hash,file);
const result={status:'complete read-only constraint inventory; feasibility undetermined',
  started,finished:new Date().toISOString(),pid:process.pid,nodeVersion:process.version,pins,
  assets:Object.fromEntries(Object.entries(files).map(([k,p])=>[k,{path:p,sha256:expected[k]}])),
  coordinateConvention:{space:'authored GLB POSITION accessor coordinates shared by the pinned hair and figure assets; no pose or world transform',
    lengthUnit:'metres unless field name ends Mm',axes:'X lateral, Y vertical, Z anterior',
    ribbonLayout:'cap652 vertices then496cards,17rings,2edges; vertex=652+34*card+2*ring+side'},
  rayMethod:{origin:'[0, sampleCentreY, ellipsoid.cz] in authored metres',
    direction:'[cos(theta),0,sin(theta)], theta=atan2(sampleCentreZ-cz,sampleCentreX); unit length',
    intersection:'hair_geometry.rayTriangle: double-sided Moller-Trumbore; determinant cutoff1e-12; barycentric bounds inclusive; distance strictly>0',
    scope:'Every pinned body primitive triangle; no visibility/alpha or selected-head subset',
    deduplication:'Retain every raw hit. Separately retain sorted distances more than1e-8metres from the last retained distance.',
    farthest:'Largest positive intersection on that ray, not necessarily nearest skin or an enclosing support surface',
    originClassification:'Nearest signed distance uses interpolated body normals; no watertight parity classification is inferred'},
  supportParameters:support,records,
  limits:[
    'No optimization or feasibility solver was run. No new curve, ribbon, GLB or capture was constructed.',
    'Positive centres or positive sampled edges do not prove triangle clearance. The existing baseline full158-card oracle is referenced, not rerun.',
    'Horizontal rays can miss above the crown or from an outside origin. No hit is reported as null, never converted to zero body radius or positive clearance.',
    'Farthest intersection is a directional sample, not proof that the actual head is globally star-shaped about this axis.',
    'A clear original path demonstrates one clearance configuration, not feasibility of the requested swept endpoint or aesthetic flow.',
    'The requested endpoints and side assignment come from rejected prototypes; they are a controlled request to examine, not an accepted design constraint.',
    'Root width and source shading normals are retained as evidence. Width-cross-tangent normal is a geometric diagnostic, not a replacement vertex normal.',
    'This packet cannot establish visible ownership, coverage, motion, garments, hair-hair clearance or any promotion gate.',
  ]};
fs.mkdirSync(output,{recursive:true});
for(const file of [...sourceFiles,...Object.values(reports)]){
  const dest=path.join(output,'source',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);
  assert.equal(sha(fs.readFileSync(dest)),pins[file]);
}
const reportPath=path.join(output,'report.json');fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,reportPath,reportSha256:sha(fs.readFileSync(reportPath)),
  cards:records.map(r=>({card:r.card,freeRingCount:r.freeRingCount,
    rootRayHits:r.radialSupportAtOriginalPath[0].uniqueDistancesMetres,
    rootBareShellRadiusMm:r.radialSupportAtOriginalPath[0].bareEllipsoidRadiusMetres*1000,
    rootRequestedMinusActualMm:r.radialSupportAtOriginalPath[0].requestedMinusActualMm}))},null,2));
