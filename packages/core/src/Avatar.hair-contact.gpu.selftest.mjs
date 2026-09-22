/** Legacy single-domain actual WebGPU integration: canonical nod, bind-aware roots and lifetime.
 * node packages/core/src/Avatar.hair-contact.gpu.selftest.mjs [--report=/tmp/report.json]
 * Reproduces the calibrated g050 candidate from the tracked original fixture in memory; routes
 * only its canonical development asset URL. Shipping assets and implementation stay untouched.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer,launchProbeBrowser } from './render/MotionProbe.mjs';
import { transformHairLongFall } from '../../../tools/figure-pipeline/hair_long_fall.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),here=fileURLToPath(new URL('.',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),fileSha=file=>sha(fs.readFileSync(file));
const goldenFile=path.join(here,'motion/fixtures/avatar-hair-contact-canonical.json');assert.equal(fileSha(goldenFile),'8855a92fbf452b279b1f7fade2aecb39da63ca7a750044814572ec44348e2e36');
const golden=JSON.parse(fs.readFileSync(goldenFile,'utf8'));
const legacyFile=path.join(here,'motion/fixtures/hair-body-contact-g050-legacy-v1.data.mjs'),legacySource=fs.readFileSync(legacyFile,'utf8');assert.equal(sha(legacySource),'2340a128b0d4a82e2265e91fbd80d211ee900b57c4e6d4fbc907f5bdcbebe942');
const candidate=transformHairLongFall(path.join(root,'tools/figure-pipeline/fixtures/bob01-g050-original.glb'),path.join(root,'assets/figures/figure_g050.glb'));
assert.equal(sha(candidate.bytes),golden.provenance.groomSha256,'Portable candidate must exactly reproduce the golden loaded GLB.');
const sourceFiles=['render/CardRenderHistory.js','Avatar.js','Avatar.hair-contact.browser.mjs','Avatar.hair-contact.gpu.selftest.mjs',...['HairSurfaceForest','HairSurfaceForestQuery','HairBodyContactForest','HairDynamics','HairSkinTransform','HairSurface','HairSurfaceQuery','HairSurfaceContact','HairBodyContact','HairBodyContactCalibration','HairBodyContactCalibration.data'].map(n=>'motion/'+n+'.js')];
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,fileSha(here+file)]));
const report={date:new Date().toISOString(),legacyCalibrationSha256:sha(legacySource),legacyCalibrationRoute:'Explicit route-only original g050 record; production registry data is not rebaselined',sourceHashes:sourceHashes(),candidateSha256:sha(candidate.bytes),goldenSha256:fileSha(goldenFile),checks:[],errors:[],loadedAssets:[],limits:['The portrait UI still reloads when switching hairstyles; this probes the runtime attachment boundary on one renderer, not a material-prototype uninstall.','The entire run explicitly selects the frozen legacy single-domain g050 calibration. Canonical equality covers the saved nod at0 and0.1seconds only. Root/native checks cover root centres, rebuilt midpoints and widths; transported edge positions can differ from static skinning. No dynamic whole-hair rigid equivariance or contact convergence claim.','Open neck/shoulder contact is not all-body, scalp, or garment clearance; no performance claim.']};
const reportPath=process.argv.find(x=>x.startsWith('--report='))?.slice(9),save=()=>{if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');};
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);save();};
const server=await startProbeServer({port:5258});let browser,page,replacements=0;const assetReads=[];
try{
 browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
 page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});page.on('requestfailed',request=>report.errors.push(`${request.url()} ${request.failure()?.errorText}`));
 page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);if(response.ok()&&new URL(response.url()).pathname.endsWith('.glb'))assetReads.push(response.body().then(bytes=>report.loadedAssets.push({url:response.url(),sha256:sha(bytes)})).catch(error=>report.errors.push(error.message)));});
 await page.route(url=>decodeURIComponent(url.pathname).endsWith('/assets/hair/bob01/g050.glb'),route=>{replacements++;return route.fulfill({status:200,contentType:'model/gltf-binary',body:candidate.bytes});});
 await page.route('**/HairBodyContactCalibration.data.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:legacySource}));
 await page.goto(server.baseUrl+'/src/portrait.html?capture=&bake=g050&gender=0.5&hair=bob01',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.portrait||!document.querySelector('#error').hidden,null,{timeout:120000});
 const failure=await page.locator('#error').textContent();assert.equal(failure,'');
 const moduleUrl='/@fs'+here+'Avatar.hair-contact.browser.mjs';
 report.canonical=await page.evaluate(async url=>(await import(url)).captureCanonicalContact(),moduleUrl);save();
 check('canonical nod at0/.1seconds preserves every saved GPU center, ribbon vertex, body vertex and full head matrix bit-for-bit',()=>{
  assert.equal(report.canonical.length,2);for(let i=0;i<2;i++){const actual=report.canonical[i],expected=golden.frames[i];for(const key of ['frame','time','steps','vertexBase','verticesSpace','centers','vertices','bodyPositions','headMatrix'])assert.deepEqual(actual[key],expected[key],`frame${expected.frame} ${key}`);assert.equal(actual.contact.calibration,'bob01-g050-long-fall-neck-v1');assert.equal(actual.contact.forest,undefined);assert.equal(actual.contact.activeChains,496);assert.equal(actual.contact.outerIterations,16);assert.equal(actual.contact.resetIterations,64);}
 });
 report.runtime=await page.evaluate(async url=>(await import(url)).runAvatarContactLifecycle(),moduleUrl);save();
 check('all496 GPU roots and rebuilt midpoints follow native Three skinning with preserved widths under translation and rotation',()=>{assert.equal(report.runtime.transforms.length,4);for(const row of report.runtime.transforms){assert.equal(row.finite,true);assert.equal(row.roots,496);assert.ok(row.maxCenterErrorMm<.002,JSON.stringify(row));assert.ok(row.maxRootMidpointErrorMm<.002,JSON.stringify(row));assert.ok(row.maxRootWidthErrorMm<.002,JSON.stringify(row));assert.equal(row.resources.storage,36);}});
 check('retiring rendered card history releases exactly one padded buffer while the solver stays live',()=>{
  const h=report.runtime.historyRetirement;
  assert.equal(h.definition.live,true);assert.ok(h.definition.commits>0);assert.equal(h.definition.ownedHistoryBuffers,1);
  assert.equal(h.before.storage,36);assert.equal(h.after.storage,35);
  assert.equal(h.before.bytes-h.after.bytes,h.definition.cardVertexCount*16);
  assert.equal(h.definition.paddedHistoryBytes,h.definition.cardVertexCount*16);
  assert.equal(h.disposed,true);assert.equal(h.solverDisposed,false);
  for(const row of report.runtime.transforms)assert.deepEqual(row.resources,h.before);
 });
 check('unsupported scale refuses before submission and leaves a live unchanged solver that resumes on valid input',()=>{const s=report.runtime.scale;assert.match(s.message,/unit rigid.*scale and shear/);assert.equal(s.submissions,0);assert.deepEqual(s.after,s.before);assert.equal(s.disposed,false);assert.equal(s.resumed,true);});
 check('same-renderer contact/bob02/off and identity rebuilds own exactly35/8/0 storage buffers without accumulation',()=>{const r=report.runtime;assert.deepEqual(r.baseline,{storage:0,bytes:0,compute:0});assert.equal(r.sequence.length,7);for(const row of r.sequence){const expected=row.style===null?0:row.contact?35:8;assert.equal(row.resources.storage,expected,JSON.stringify(row));if(row.contact)assert.equal(row.contact.activeChains,496);}const contactRows=r.sequence.filter(x=>x.contact);for(const row of contactRows)assert.deepEqual(row.resources,contactRows[0].resources);});
 check('retired contact and default solver handles refuse future updates and reads',()=>{assert.ok(report.runtime.retired.length>=6);for(const row of report.runtime.retired)assert.deepEqual(row,{disposed:true,refused:3});});
 check('disposing during real browser geometry digests cannot publish a solver or submit GPU work afterward',()=>{const p=report.runtime.pending;assert.ok(p.digestCalls>0);assert.equal(p.disposed,true);assert.equal(p.hairNull,true);assert.equal(p.computeAfterRetirement,0);assert.deepEqual(p.memoryAfter,{storage:0,bytes:0});});
 await Promise.all(assetReads);report.replacedGroomRequests=replacements;
 check('all routed correctedg050 loads have the exact portable asset hash and browser errors remain empty',()=>{assert.ok(replacements>=3);const g=report.loadedAssets.filter(a=>decodeURIComponent(new URL(a.url).pathname).endsWith('/assets/hair/bob01/g050.glb'));assert.equal(g.length,replacements);for(const asset of g)assert.equal(asset.sha256,report.candidateSha256);assert.deepEqual(report.errors,[]);});
 check('all production and test source hashes remain unchanged through the integration run',()=>assert.deepEqual(sourceHashes(),report.sourceHashes));
 report.passed=true;save();console.log(`PASS ${report.checks.length} actual Avatar hair/contact GPU integration groups`);
}catch(error){report.error=error.stack;if(page)report.partial=await page.evaluate(()=>window.__avatarContactProgress??null).catch(()=>null);save();throw error;}
finally{await browser?.close();await server.close();}
