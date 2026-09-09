/** Portable CPU oracle and optional actual-WebGPU query/contact primitive gates.
 * node packages/core/src/motion/HairSurface.primitives.selftest.mjs [--gpu] [--report=/tmp/report.json]
 * --gpu includes historical segment-parameter and contact-normal rejection controls served only
 * to isolated test pages. It does not modify any source file or measure contact performance.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Triangle, Vector3 } from 'three';
import { closestSegmentTriangle } from './fixtures/hair-segment-oracle.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtureFile=here+'fixtures/hair-surface-primitives.json';
assert.equal(sha(fixtureFile),'681ec9e452ed7fc2515615e0eafecfefbd164033a7d1ace80f773a4b2b18c129','Frozen input fixture changed; review provenance before updating.');
const fixture=JSON.parse(fs.readFileSync(fixtureFile,'utf8'));
let groups=0;const check=(name,fn)=>{fn();groups++;console.log('PASS '+name);};
const close=(a,b,e=1e-12)=>assert.ok(Math.abs(a-b)<=e,`${a} vs ${b} (tolerance ${e})`);
const tri=[[0,0,0],[1,0,0],[0,1,0]];
function query(a,b,body=tri){const h=closestSegmentTriangle(a,b,...body),coordinateTolerance=1e-12*Math.max(1,...a.map(Math.abs),...b.map(Math.abs),...body.flat().map(Math.abs));close(h.barycentric.reduce((s,x)=>s+x,0),1);assert.ok(h.segmentT>=0&&h.segmentT<=1);assert.ok(h.barycentric.every(x=>x>=0&&x<=1));for(let k=0;k<3;k++){close(h.segmentPoint[k],a[k]+(b[k]-a[k])*h.segmentT,coordinateTolerance);close(h.trianglePoint[k],body.reduce((s,p,i)=>s+p[k]*h.barycentric[i],0),coordinateTolerance);}return h;}
check('frozen 20 original and 15 near-parallel cases preserve analytic witnesses and provenance',()=>{
 assert.equal(fixture.cases.filter(x=>x.family==='original').length,20);assert.equal(fixture.cases.filter(x=>x.family==='nearParallel').length,15);
 assert.equal(new Set(fixture.cases.map(x=>x.name)).size,35);
 for(const c of fixture.cases){const h=query(c.start,c.end,c.triangle);if(c.expected)close(h.distance,c.expected.distance,1e-12);if(c.family==='nearParallel'){close(h.segmentT,.5,1e-7);close(h.distance,Math.abs(c.start[1]),1e-12);}}
});
check('oracle handles transverse, endpoint, parallel/coplanar, all-edge and degenerate optima',()=>{
 close(query([.25,.25,-1],[.25,.25,1]).distance,0);close(query([.25,.25,1],[.25,.25,2]).distance,1);
 for(const z of [0,1])close(query([-1,.25,z],[2,.25,z]).distance,z);
 for(const [p,d] of [[[.3,-.2],.2],[[.75,.75],Math.SQRT1_2/2],[[-.2,.3],.2]]){const h=query([...p,-1],[...p,1]);close(h.distance,d);close(h.segmentT,.5);}
 close(query([.25,.25,1],[.25,.25,1]).distance,1);close(query([.5,-1,1],[.5,1,1],[[0,0,0],[1,0,0],[2,0,0]]).distance,1);close(query([-1,.3,0],[1,.3,0],[[0,0,0],[0,0,0],[0,0,0]]).distance,.3);
 close(query([-.1,.2,1e-12],[.9,.2,-1e-12]).distance,0,1e-20);
});
check('oracle rejects malformed inputs and preserves reversed/transformed geometry',()=>{
 for(const bad of [[NaN,0,0],[Infinity,0,0],[0,0]])assert.throws(()=>query(bad,[0,0,1]));
 const a=[.3,-.2,-1],b=[.3,-.2,1],base=query(a,b);close(query(b,a,[tri[0],tri[2],tri[1]]).distance,base.distance);
 for(const scale of [1e-5,1e5]){const map=p=>p.map((v,k)=>(v+[.731,-.247,1.416][k])*scale);close(query(map(a),map(b),tri.map(map)).distance,base.distance*scale,1e-10*scale);}
});
let maxOracleError=0;
check('300 deterministic oracle cases agree with independent Three convex minimization',()=>{
 let seed=82515;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32*2-1;};
 for(let i=0;i<300;i++){const [a,b,...body]=Array.from({length:5},()=>[random(),random(),random()]),h=query(a,b,body),triangle=new Triangle(...body.map(p=>new Vector3(...p))),p=new Vector3(),q=new Vector3();
  const f=t=>{p.set(...a.map((v,k)=>v+(b[k]-v)*t));triangle.closestPointToPoint(p,q);return p.distanceToSquared(q);};let lo=0,hi=1;
  for(let j=0;j<100;j++){const u=lo+(hi-lo)/3,v=hi-(hi-lo)/3;if(f(u)<f(v))hi=v;else lo=u;}
  const reference=Math.sqrt(Math.min(f(0),f(1),f((lo+hi)/2)));maxOracleError=Math.max(maxOracleError,Math.abs(h.distance-reference));close(h.distance,reference,1e-10);
 }
});
const files=['HairSurface.js','HairSurfaceQuery.js','HairSurfaceContact.js','HairSurface.primitives.browser.mjs','HairSurface.primitives.selftest.mjs','fixtures/hair-segment-oracle.mjs','fixtures/hair-segment-v1-control.txt','fixtures/hair-surface-primitives.json'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,sha(here+file)]));
const report={date:new Date().toISOString(),sourceHashes:hashes(),cpu:{groups,randomCases:300,maxOracleError},limitations:['Primitive correctness and small generated BVH fixtures; no contact-convergence, all-bake clearance, appearance or performance claim.','Local smooth-normal sign on an open patch does not determine whole-body inside/outside.','Float32 metre-scale gate is 0.001 mm on distance and reconstructed witnesses; tied minima do not require equal t or barycentrics.']};
const reportPath=process.argv.find(x=>x.startsWith('--report='))?.slice(9);
const save=()=>{if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');};
if(process.argv.includes('--gpu')){
 const {startProbeServer,launchProbeBrowser}=await import('../render/MotionProbe.mjs');
 const server=await startProbeServer({port:5257});let browser;
 try{
  browser=await launchProbeBrowser();
  async function run(control=null){const page=await browser.newPage(),errors=[];let replacements=0;
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>errors.push(`${r.url()} ${r.failure()?.errorText}`));
   await page.route('**/hair-primitive-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Hair primitive regression</title><link rel="icon" href="data:,">'}));
   if(control){const name=control==='segment'?'HairSurfaceQuery.js':'HairSurfaceContact.js';await page.route(`**/${name}`,async route=>{
    const response=await route.fetch();let body=await response.text();
    if(control==='segment'){const start=body.indexOf('const segmentParameters ='),end=body.indexOf('// Convex minimum:',start);assert.ok(start>=0&&end>start,'Historical replacement boundary must still exist');body=body.slice(0,start)+fs.readFileSync(here+'fixtures/hair-segment-v1-control.txt','utf8')+body.slice(end);}
    else {const current='distanceSquared.greaterThan( directionUncertainty.mul( directionUncertainty ) )';assert.equal(body.split(current).length,2,'Historical normal threshold boundary must still exist');body=body.replace(current,'distanceSquared.greaterThan( 1e-20 )');}
    replacements++;await route.fulfill({response,body});
   });}
   try{await page.goto(server.baseUrl+'/hair-primitive-test.html');const result=await page.evaluate(async ({url,cases,only})=>{const {runHairSurfacePrimitives}=await import(url);return runHairSurfacePrimitives(cases,{only});},{url:'/@fs'+here+'HairSurface.primitives.browser.mjs',cases:control==='segment'?fixture.cases.filter(c=>c.family==='nearParallel'):fixture.cases,only:control==='segment'?'primitives':control==='normal'?'normals':null});return{...result,errors,replacements};}finally{await page.close();}
  }
  report.gpu=await run();save();
  check('actual WebGPU core primitives have no browser errors, finite witnesses and correct minima',()=>{assert.deepEqual(report.gpu.errors,[]);assert.equal(report.gpu.primitives.length,35);for(const row of report.gpu.primitives)assert.equal(row.check.passed,true,JSON.stringify(row));});
  check('144 generated multi-leaf BVH queries preserve global minima across three poses and four seeds',()=>{assert.equal(report.gpu.bvh.length,144);for(const row of report.gpu.bvh)assert.equal(row.passed,true,JSON.stringify(row));});
  check('eight contact directions preserve authored coplanar normals and separated distance gradients',()=>{assert.equal(report.gpu.normals.length,8);for(const row of report.gpu.normals)assert.equal(row.passed,true,JSON.stringify(row));});
  check('12 bounds cases have no missed tube/box overlap and disjoint records clear stale planes',()=>{assert.equal(report.gpu.bounds.rows.length,12);for(const row of report.gpu.bounds.rows)assert.equal(row.passed,true,JSON.stringify(row));assert.equal(report.gpu.bounds.clearing.passed,true);});
  check('all primitive owners release their storage and compute pipelines on the same renderer',()=>assert.deepEqual(report.gpu.after,report.gpu.before));
  report.controls={segment:await run('segment'),normal:await run('normal')};save();
  check('historical Float32 segment denominator is rejected by a saved near-parallel witness',()=>{const c=report.controls.segment;assert.deepEqual(c.errors,[]);assert.equal(c.replacements,1);assert.ok(c.primitives.some(x=>x.check.distanceErrorMm>=.001));assert.deepEqual(c.after,c.before);});
  check('historical tiny direction threshold is rejected by the coplanar tangent-residue witness',()=>{const c=report.controls.normal;assert.deepEqual(c.errors,[]);assert.equal(c.replacements,1);assert.equal(c.normals.find(x=>x.name==='coplanar-Float32-tangent-residue').passed,false);assert.deepEqual(c.after,c.before);});
  check('all loaded core and test source hashes stay unchanged throughout the GPU proof',()=>assert.deepEqual(hashes(),report.sourceHashes));
 }catch(error){report.error=error.stack;save();throw error;}finally{await browser?.close();await server.close();}
}
report.groups=groups;report.passed=true;save();console.log(`PASS ${groups} hair surface primitive groups${process.argv.includes('--gpu')?' including actual WebGPU and historical rejection controls':' (CPU only; add --gpu for shader checks)'}`);
