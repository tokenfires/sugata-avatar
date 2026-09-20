/** Portable guarded-triangle parity gate. No captures, external candidate or GPU timing.
 * node packages/core/src/motion/HairSurface.bounds.selftest.mjs [--gpu] [--report=/tmp/report.json]
 * Guarded production is compared with a route-only predecessor that removes exactly two
 * guards. Missing/partial guards fail explicitly; differing raw/served hashes prevent
 * identical-arm false passes. The predecessor never changes a file on disk.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {triangleBoundsSourcePair} from './fixtures/hair-triangle-bounds-control.mjs';
import {closestSegmentTriangle} from './fixtures/hair-segment-oracle.mjs';
const here=fileURLToPath(new URL('.',import.meta.url)),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=file=>hash(fs.readFileSync(file));
const fixtureFile=here+'fixtures/hair-triangle-bounds-adversarial.json',primitiveFile=here+'fixtures/hair-surface-primitives.json';
assert.equal(sha(fixtureFile),'949c1681e282a1e70f36062989822fa8557ed0c2b236fe091786e94648bc80c4');
assert.equal(sha(primitiveFile),'681ec9e452ed7fc2515615e0eafecfefbd164033a7d1ace80f773a4b2b18c129');
const fixture=JSON.parse(fs.readFileSync(fixtureFile)),primitive=JSON.parse(fs.readFileSync(primitiveFile)),pair=triangleBoundsSourcePair(fs.readFileSync(here+'HairSurfaceQuery.js','utf8'));
assert.equal(pair.mode,'guarded-production','Production triangle guards are absent: this gate requires both promoted guards.');
assert.equal(pair.guarded,fs.readFileSync(here+'HairSurfaceQuery.js','utf8'),'Guarded arm must be the exact production source');
let groups=0;const check=(name,fn)=>{fn();groups++;console.log('PASS '+name);};
check('production requires both guards; strict predecessor extraction round-trips exactly',()=>{
 assert.equal(triangleBoundsSourcePair(pair.baseline).mode,'unguarded-preview');assert.equal(triangleBoundsSourcePair(pair.guarded).mode,'guarded-production');
 assert.equal(triangleBoundsSourcePair(pair.guarded).baseline,pair.baseline);assert.equal(triangleBoundsSourcePair(pair.baseline).guarded,pair.guarded);assert.notEqual(hash(pair.baseline),hash(pair.guarded));
});
check('partial, changed and missing guard boundaries reject instead of comparing identical arms',()=>{
 const changed=pair.guarded.replace(').sub( scale.mul( 8 * 2 ** -23 )',').sub( scale.mul( 4 * 2 ** -23 )');assert.throws(()=>triangleBoundsSourcePair(changed),/Unexpected/);
 const pointEnd='        querySegment(',split=pair.guarded.indexOf(pointEnd),baselineSplit=pair.baseline.indexOf(pointEnd);assert.ok(split>0&&baselineSplit>0);
 assert.throws(()=>triangleBoundsSourcePair(pair.guarded.slice(0,split)+pair.baseline.slice(baselineSplit)),/Partial/);
 assert.throws(()=>triangleBoundsSourcePair(pair.baseline.replace('const c = positionAt( triangle.z )','const c = changedPositionAt( triangle.z )')),/exactly two/);
});
check('immutable fixtures retain18 adversarial records and35 original cases with moving and cross-leaf ties',()=>{
 assert.equal(fixture.cases.length,18);assert.equal(primitive.cases.length,35);assert.equal(new Set(fixture.cases.map(c=>c.name)).size,17);
 assert.equal(fixture.cases.filter(c=>c.alphas?.length===5).length,2);assert.equal(fixture.cases.find(c=>c.name==='exact-zero-tie-across-bvh-leaves').triangles.length,9);
});
const f=Math.fround,add=(a,b)=>f(a+b),sub=(a,b)=>f(a-b),mul=(a,b)=>f(a*b);
function floatBound(start,end,triangle){const lo=[0,1,2].map(k=>Math.min(...triangle.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...triangle.map(p=>p[k]))),scale=Math.max(1,...start.map(Math.abs),...end.map(Math.abs),...lo.map(Math.abs),...hi.map(Math.abs)),guard=mul(scale,8*2**-23),gap=[0,1,2].map(k=>Math.max(0,sub(Math.max(sub(lo[k],Math.max(start[k],end[k])),sub(Math.min(start[k],end[k]),hi[k])),guard)));return add(add(mul(gap[0],gap[0]),mul(gap[1],gap[1])),mul(gap[2],gap[2]));}
let checked=0,positiveBounds=0,maxBoundExcess=0;
check('3072 deterministic Float32 guarded bounds do not exceed the independent double feature distance',()=>{
 let seed=730991;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(const scale of [1e-6,.001,1,16,1024,1e6])for(let i=0;i<512;i++){
  const origin=[random()-.5,random()-.5,random()-.5].map(x=>x*scale),span=scale*(i%3===0?1e-4:.25),triangle=Array.from({length:3},()=>origin.map(x=>f(x+(random()-.5)*span)));
  if(i%5===0)triangle[2]=triangle[1].slice();if(i%13===0)triangle[1]=triangle[2]=triangle[0].slice();
  const start=origin.map(x=>f(x+(random()-.5)*scale)),end=i%2?start.slice():origin.map(x=>f(x+(random()-.5)*scale));
  const exact=closestSegmentTriangle(start,end,...triangle).distanceSquared,lower=floatBound(start,end,triangle);maxBoundExcess=Math.max(maxBoundExcess,lower-exact);checked++;if(lower>0)positiveBounds++;assert.ok(lower<=exact,JSON.stringify({scale,start,end,triangle,lower,exact}));
 }
 assert.equal(checked,3072);assert.equal(positiveBounds,2330);assert.equal(maxBoundExcess,0);
});
const files=['HairSurfaceQuery.js','HairSurface.js','HairSurfaceContact.js','HairSurface.primitives.browser.mjs','HairSurface.bounds.browser.mjs','HairSurface.bounds.selftest.mjs','fixtures/hair-triangle-bounds-control.mjs','fixtures/hair-triangle-bounds-adversarial.json','fixtures/hair-segment-oracle.mjs','fixtures/hair-surface-primitives.json'];
const sourceHashes=()=>Object.fromEntries(files.map(file=>[file,sha(here+file)]));
const report={date:new Date().toISOString(),mode:pair.mode,productionGuardCount:pair.guardCount,rawQueryHashes:{baseline:hash(pair.baseline),guarded:hash(pair.guarded)},sourceHashes:sourceHashes(),cpu:{groups,checked,positiveBounds,maxBoundExcess},arms:{},limits:['The frozen18 adversarial records have17 unique names: the zero-origin ULP control is repeated and is not an independent geometric case.','CPU finite arithmetic checks and GPU parity are not a universal error bound for every ill-conditioned closest-feature calculation.','No runtime captures or candidate file is loaded. Both guards must exist in production; the route-only predecessor removes exactly those guards.','TrianglesTested remains visited count; this does not measure skipped math or GPU time.','Canonical contact/motion/appearance acceptance remains a separate gate.']};
const reportFile=process.argv.find(x=>x.startsWith('--report='))?.slice(9),save=()=>{if(reportFile)fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');};
console.log('Triangle guard source mode: '+pair.mode);
if(process.argv.includes('--gpu')){
 const {startProbeServer,launchProbeBrowser}=await import('../render/MotionProbe.mjs'),server=await startProbeServer({port:5260});let browser;
 const extra=[...fixture.cases,...primitive.cases.map(c=>({name:'original-point-'+c.name,triangles:[c.triangle],normals:[[0,0,1]],start:c.start,end:c.end}))];
 try{browser=await launchProbeBrowser();for(const arm of ['baseline','guarded']){
  const page=await browser.newPage(),errors=[],responseReads=[];let replacements=0,servedHash;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(`${r.url()} ${r.failure()?.errorText}`));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);if(new URL(r.url()).pathname.endsWith('/motion/HairSurfaceQuery.js'))responseReads.push(r.body().then(b=>{servedHash=hash(b);}));});
  await page.route('**/triangle-bound-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Triangle bound parity</title><link rel="icon" href="data:,">'}));
  await page.route('**/motion/HairSurfaceQuery.js',async route=>{const response=await route.fetch(),body=await response.text(),servedPair=triangleBoundsSourcePair(body);assert.equal(servedPair.mode,pair.mode,'Production source mode changed while serving');replacements++;await route.fulfill({response,body:servedPair[arm]});});
  try{await page.goto(server.baseUrl+'/triangle-bound-test.html');const result=await page.evaluate(async ({coreUrl,extraUrl,primitive,extra})=>{const {runHairSurfacePrimitives}=await import(coreUrl),{runAdversarialBounds}=await import(extraUrl);return{core:await runHairSurfacePrimitives(primitive),extra:await runAdversarialBounds(extra)};},{coreUrl:'/@fs'+here+'HairSurface.primitives.browser.mjs',extraUrl:'/@fs'+here+'HairSurface.bounds.browser.mjs',primitive:primitive.cases,extra});await Promise.all(responseReads);report.arms[arm]={...result,errors,replacements,servedQuerySha256:servedHash};save();}finally{await page.close();}
 }
 check('both distinct served arms are attested with stable raw sources and zero browser errors',()=>{assert.deepEqual(sourceHashes(),report.sourceHashes);for(const arm of Object.values(report.arms)){assert.deepEqual(arm.errors,[]);assert.equal(arm.replacements,1);assert.match(arm.servedQuerySha256,/^[a-f0-9]{64}$/);}assert.notEqual(report.arms.baseline.servedQuerySha256,report.arms.guarded.servedQuerySha256);});
 check('35 primitive,144 BVH,8 normal and12 bounds cases plus record clearing retain every value exactly',()=>{const a=report.arms.baseline.core,b=report.arms.guarded.core;for(const key of ['primitives','bvh','normals','bounds'])assert.deepEqual(b[key],a[key],key);assert.ok(a.primitives.every(x=>x.check.passed));assert.ok(a.bvh.every(x=>x.passed));assert.ok(a.normals.every(x=>x.passed));assert.ok(a.bounds.rows.every(x=>x.passed));assert.equal(a.bounds.clearing.passed,true);});
 check('732 added point/segment queries retain all Float32 bits, IDs, normals, boundary flags and telemetry',()=>{const a=report.arms.baseline.extra.rows,b=report.arms.guarded.extra.rows;assert.equal(a.length,244);assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){assert.deepEqual(b[i],a[i],`${a[i].name} alpha${a[i].alpha} seed${a[i].seed}`);assert.ok(a[i].values.every(Number.isFinite));for(let q=0;q<3;q++)assert.equal(a[i].values[q*20+11],1);}report.additionalQueries=a.length*3;});
 check('all test storage and compute resources return to baseline in both arms',()=>{for(const arm of Object.values(report.arms))for(const part of ['core','extra'])assert.deepEqual(arm[part].after,arm[part].before);});
 }catch(error){report.error=error.stack;save();throw error;}finally{await browser?.close();await server.close();}
}
report.groups=groups;report.passed=true;save();console.log(`PASS ${groups} triangle bounds groups (${pair.mode}${process.argv.includes('--gpu')?', actual WebGPU parity':', CPU only'})`);
