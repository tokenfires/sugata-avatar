// CPU freeze/preflight, or an explicitly launched serial GPU instrumentation smoke.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {assessStartup,assessWarningBoundary,STARTUP_SOURCE_PINS} from './startup-policy.mjs';
import {ORBIT_SOURCE_PIN} from './orbit-replay.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../..');
const relative=p=>path.relative(ROOT,p),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),hash=p=>sha(fs.readFileSync(p));
const OWN=['probe.mjs','runtime.mjs','timestamp-accounting.mjs','timestamp-accounting.selftest.mjs','native-uid.selftest.mjs','native-uid-proof-v1.json','process-receipt.py','process-receipt.selftest.py','startup-diagnostics.mjs','startup-diagnostics.selftest.mjs','startup-policy.mjs','startup-policy.selftest.mjs','startup-workload-fixture.mjs','native-startup-v4/report.json.gz','rejected-startup-v3/startup-diagnostics.mjs','bootstrap.mjs','bootstrap.selftest.mjs','orbit-replay.mjs','orbit-replay.selftest.mjs','warmup-runtime.mjs'];
const json=value=>JSON.stringify(value,null,2)+'\n';
async function bounded(promise,label,milliseconds=30000) {let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),milliseconds);})]);}finally{clearTimeout(timer);}}
function walk(directory) {return fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    const p=path.join(directory,e.name);assert.equal(e.isSymbolicLink(),false,'Do not silently follow source symlinks: '+p);
    return e.isDirectory()?walk(p):e.isFile()?[p]:[];
});}
function sourceFiles() {
    return [...new Set(['packages/core/src','packages/testbed/src','assets','node_modules/three/src','node_modules/three/build','node_modules/three/examples/jsm','node_modules/vite/dist'].flatMap(p=>walk(path.join(ROOT,p)))
        .concat(['package.json','package-lock.json','vite.config.js','tools/critic/png.mjs','node_modules/three/package.json','node_modules/vite/package.json'].map(p=>path.join(ROOT,p)),OWN.map(f=>path.join(HERE,f))))].sort();
}
function packageVersion(name){return JSON.parse(fs.readFileSync(path.join(ROOT,'node_modules',name,'package.json'))).version;}
async function playwrightMetadata() {
    const require=createRequire(import.meta.url),cache=path.join(process.env.HOME??'','.npm','_npx');
    const candidates=[process.env.PLAYWRIGHT_MODULE,'playwright',...(fs.existsSync(cache)?fs.readdirSync(cache).map(n=>path.join(cache,n,'node_modules/playwright')).filter(p=>fs.existsSync(p)):[])].filter(Boolean);
    for(const candidate of candidates)try{const resolved=require.resolve(candidate),imported=await import(resolved),module=imported.default??imported;
        const packagePath=path.join(path.dirname(resolved),'package.json'),executable=module.chromium.executablePath();
        assert.ok(fs.existsSync(executable),'Installed Chromium unavailable.');
        const coreEntry=require.resolve('playwright-core',{paths:[path.dirname(resolved)]}),coreRoot=path.dirname(coreEntry);
        const sourcePaths=[resolved,packagePath,coreEntry,path.join(coreRoot,'package.json'),path.join(coreRoot,'lib/coreBundle.js')];
        return {resolved,version:JSON.parse(fs.readFileSync(packagePath)).version,
            sourceHashes:Object.fromEntries(sourcePaths.map(p=>[p,hash(p)])),
            registryDefaultExecutable:executable,registryDefaultExecutableSHA256:hash(executable),
            executableScope:'Registry hint only until matched to native process executable/argv.'};
    }catch{ /* same candidate order as the pinned MotionProbe loader; no installs */ }
    throw Error('No existing usable Playwright/Chromium installation; installation is outside this task.');
}
async function makeManifest(pageName,diagnoseStartup=false,diagnoseWarmup=false) {
    assert.ok(['showcase','portrait'].includes(pageName));assert.equal(packageVersion('three'),'0.185.1');
    if(!diagnoseStartup)assert.equal(pageName,'showcase','Only Wardrobe/casual/bob02 has a source-reviewed startup policy.');
    return {version:1,kind:diagnoseStartup?'current-review-page-startup-diagnostic':diagnoseWarmup?'current-review-page-unmeasured-warmup':'current-review-page-timestamp-smoke',pageName,createdAt:new Date().toISOString(),
        revision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}),
        versions:{node:process.version,three:packageVersion('three'),vite:packageVersion('vite')},launcher:await playwrightMetadata(),
        viewport:{width:1440,height:1000},deviceScaleFactor:2,warmup:8,samples:12,dt:1/60,
        sources:Object.fromEntries(sourceFiles().map(p=>[relative(p),hash(p)])),
        scope:diagnoseStartup?'Unmeasured original page startup diagnostics only; zero measured updates, no timestamp accounting or performance verdict.':diagnoseWarmup?
            '20 UNMEASURED original public steps; source-bound persistent native controls replay and raw warning traces through8. No duration/performance result.':
            '20 native fixed steps for timestamp coverage/accounting validation only. No performance budget, representative-avatar, native presentation or leak qualification.'};
}
function verify(manifest) {
    assert.equal(manifest.version,1);assert.ok(['current-review-page-timestamp-smoke','current-review-page-startup-diagnostic','current-review-page-unmeasured-warmup'].includes(manifest.kind));assert.ok(['showcase','portrait'].includes(manifest.pageName));
    assert.deepEqual(manifest.viewport,{width:1440,height:1000});assert.equal(manifest.deviceScaleFactor,2);assert.equal(manifest.warmup,8);assert.equal(manifest.samples,12);assert.equal(manifest.dt,1/60);
    assert.deepEqual(Object.keys(manifest.sources),sourceFiles().map(relative));
    for(const [file,expected] of Object.entries(manifest.sources))assert.equal(hash(path.join(ROOT,file)),expected,'Stale source: '+file);
    assert.deepEqual(manifest.versions,{node:process.version,three:packageVersion('three'),vite:packageVersion('vite')});
    assert.ok(manifest.launcher?.sourceHashes,'Actual launcher source binding required.');
    for(const [file,h] of Object.entries(manifest.launcher.sourceHashes))assert.equal(hash(file),h,'Stale installed launcher: '+file);
    assert.equal(hash(manifest.launcher.registryDefaultExecutable),manifest.launcher.registryDefaultExecutableSHA256,'Stale browser registry bytes');
    if(manifest.kind==='current-review-page-timestamp-smoke') {
        assert.equal(manifest.pageName,'showcase','Undiagnosed page cannot use Wardrobe startup admission.');
        for(const [file,pin] of Object.entries(STARTUP_SOURCE_PINS))assert.equal(manifest.sources[file],pin,'Startup policy requires new source diagnosis: '+file);
    }
    if(manifest.kind==='current-review-page-unmeasured-warmup') {
        assert.equal(manifest.pageName,'showcase');assert.equal(manifest.sources[ORBIT_SOURCE_PIN.path],ORBIT_SOURCE_PIN.sha256,'Unreviewed controls source.');
    }
}
const [mode,manifestPath,output]=process.argv.slice(2);
if(mode==='--write-manifest'||mode==='--write-startup-manifest'||mode==='--write-warmup-manifest') {
    assert.equal(process.argv.length,5,'Usage: probe.mjs --write-manifest manifest.json showcase|portrait');
    fs.writeFileSync(manifestPath,json(await makeManifest(output,mode==='--write-startup-manifest',mode==='--write-warmup-manifest')),{flag:'wx'});console.log('Wrote fresh manifest '+manifestPath);process.exit(0);
}
assert.ok(['--preflight','--smoke','--startup-diagnostic','--warmup-diagnostic'].includes(mode),'Usage: probe.mjs --preflight|--smoke|--startup-diagnostic|--warmup-diagnostic manifest.json fresh-output-directory');assert.equal(process.argv.length,5);
const manifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(manifestBytes);verify(manifest);
const diagnoseStartup=manifest.kind==='current-review-page-startup-diagnostic';
const diagnoseWarmup=manifest.kind==='current-review-page-unmeasured-warmup';
if(mode!=='--preflight'){assert.equal(diagnoseStartup,mode==='--startup-diagnostic','Manifest purpose/entry point mismatch.');assert.equal(diagnoseWarmup,mode==='--warmup-diagnostic','Manifest purpose/entry point mismatch.');}
const out=path.resolve(output);assert.equal(fs.existsSync(out),false,'Refuse to overwrite an earlier run.');fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(out,name),typeof value==='string'||Buffer.isBuffer(value)?value:json(value),{flag:'wx'});
write('manifest.json',manifestBytes);
const report={version:1,kind:manifest.kind,completed:false,manifestSHA256:sha(manifestBytes),createdAt:new Date().toISOString(),
    pageName:manifest.pageName,scope:manifest.scope,errors:[],warnings:[],responses:[],sourcesStable:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),json(report));
if(mode==='--preflight') {
    report.processScopeProbe=processReceipt({operation:'snapshot'});
    report.preflightOnly=true;report.sourcesStable=true;report.completed=true;report.files=Object.keys(manifest.sources).length;save();
    console.log(json({preflight:true,page:manifest.pageName,files:report.files,manifestSHA256:report.manifestSHA256,steps:diagnoseStartup?0:20}));process.exit(0);
}
// All operations above this point are CPU/file-only. Both explicit native modes require root's GPU handoff.
const {launchProbeBrowser}=await import('../../../../packages/core/src/render/MotionProbe.mjs');
const {startReviewProbeServer}=await import('./bootstrap.mjs');
let server,browser,context,page,startupWarnings;const reads=[],served=new Map();let collecting=true,phase='before-page';
const assetFile=url=>{const u=new URL(url);if(u.searchParams.has('import')||u.searchParams.has('url'))return null;const p=decodeURIComponent(u.pathname),at=p.indexOf('/assets/');return at<0?null:p.slice(at+1);};
function processReceipt(request){return JSON.parse(execFileSync('python3',['-B',path.join(HERE,'process-receipt.py')],{input:json({rootPID:process.pid,...request}),encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024}));}
function environment() {
    const run=(cmd,args)=>{try{return execFileSync(cmd,args,{encoding:'utf8'}).trim();}catch(e){return {unavailable:String(e.message)};}};
    let hardware;
    try{const data=JSON.parse(execFileSync('system_profiler',['SPHardwareDataType','SPDisplaysDataType','-json'],{encoding:'utf8'}));
        const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
        hardware={machine:(data.SPHardwareDataType??[]).map(o=>pick(o,['machine_name','machine_model','chip_type','number_processors','physical_memory'])),
            gpu:(data.SPDisplaysDataType??[]).map(o=>({...pick(o,['sppci_model','spdisplays_cores','spdisplays_metal']),displays:(o.spdisplays_ndrvs??[]).map(d=>pick(d,['_name','spdisplays_resolution','spdisplays_pixelresolution','spdisplays_main','spdisplays_online','spdisplays_display_type']))}))};
    }catch(e){hardware={unavailable:String(e.message)};}
    return {os:run('sw_vers',[]),architecture:process.arch,node:process.version,nodeExecutableSHA256:hash(process.execPath),hardware,
        power:run('pmset',['-g','batt']),thermal:run('pmset',['-g','therm']),
        launch:{channel:'chromium',headless:true,flags:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--hide-scrollbars']}};
}
try {
    for(const file of Object.keys(manifest.sources).filter(f=>!f.startsWith('assets/'))){const destination=path.join(out,'source',file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(ROOT,file),destination,fs.constants.COPYFILE_EXCL);assert.equal(hash(destination),manifest.sources[file]);}
    report.environmentBefore=environment();report.playwright=await playwrightMetadata();assert.deepEqual(report.playwright,manifest.launcher);
    for(const [file,h] of Object.entries(manifest.launcher.sourceHashes)){const dest=path.join(out,'launcher-source',h);fs.mkdirSync(path.dirname(dest),{recursive:true});if(!fs.existsSync(dest))fs.copyFileSync(file,dest,fs.constants.COPYFILE_EXCL);assert.equal(hash(dest),h);}
    server=await startReviewProbeServer({port:5391,pageName:manifest.pageName});report.bootstrap=server.bootstrap;write('bootstrap.html',server.deferredHTML);
    report.processBefore=processReceipt({operation:'snapshot'});
    browser=await launchProbeBrowser();report.browserVersion=browser.version();
    report.browserProcess=processReceipt({operation:'capture',before:report.processBefore,expectedExecutable:manifest.launcher.registryDefaultExecutable,
        expectedSHA256:manifest.launcher.registryDefaultExecutableSHA256,requiredFlags:['--headless','--enable-unsafe-webgpu','--ignore-gpu-blocklist','--hide-scrollbars']});
    const cdp=await browser.newBrowserCDPSession();
    try{report.browserCDP=await cdp.send('Browser.getVersion');
        try{const command=await cdp.send('Browser.getBrowserCommandLine');assert.deepEqual(command.arguments,report.browserProcess.selected.argv);report.browserCommandLine={available:true,...command};}
        catch(error){if(!String(error).includes('Command line not returned because --enable-automation not set'))throw error;report.browserCommandLine={available:false,error:String(error),requiredReplacement:'Exact native process receipt recorded above.'};}
    }finally{await cdp.detach();}
    context=await browser.newContext({viewport:manifest.viewport,deviceScaleFactor:2,colorScheme:'dark',reducedMotion:'no-preference'});page=await context.newPage();
    page.on('pageerror',e=>report.errors.push({type:'pageerror',message:String(e)}));
    page.on('console',m=>{if(m.type()==='warning')report.warnings.push({type:'console-warning',phase,message:m.text(),location:m.location()});
        else if(m.type()==='error')report.errors.push({type:'console-error',phase,message:m.text(),location:m.location()});});
    page.on('requestfailed',r=>report.errors.push({type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
    page.on('response',r=>{
        if(r.status()>=400)report.errors.push({type:'http',url:r.url(),status:r.status()});
        if(!collecting){report.errors.push({type:'response-during-smoke',url:r.url()});return;}
        reads.push(r.body().then(bytes=>{
            const digest=sha(bytes),file=assetFile(r.url());
            if(file){assert.ok(Object.hasOwn(manifest.sources,file),'Unknown asset response '+file);assert.equal(digest,manifest.sources[file],'Actual asset bytes '+file);}
            else if(r.ok()){const destination=path.join(out,'served',digest);fs.mkdirSync(path.dirname(destination),{recursive:true});if(!fs.existsSync(destination))fs.writeFileSync(destination,bytes,{flag:'wx'});served.set(digest,bytes.length);}
            report.responses.push({url:r.url(),status:r.status(),sha256:digest,bytes:bytes.length,asset:file});
        }).catch(e=>{report.errors.push({type:'response-hash',message:String(e)});}));
    });
    await page.route(/\/assets\//,async route=>{
        const file=assetFile(route.request().url());if(!file)return route.continue();
        try{assert.ok(Object.hasOwn(manifest.sources,file),'Unbound asset request '+file);const bytes=fs.readFileSync(path.join(ROOT,file));assert.equal(sha(bytes),manifest.sources[file]);
            const ext=path.extname(file),type={'.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json'}[ext]??'application/octet-stream';
            await route.fulfill({status:200,contentType:type,body:bytes});
        }catch(e){report.errors.push({type:'asset-route',message:String(e)});await route.abort();}
    });
    phase='bootstrap';await page.goto(`${server.baseUrl}/src/${manifest.pageName}.html?capture`);
    assert.equal(report.bootstrap.requests.length,1,'Require one native network HTML transform.');
    // The new page CSS imports Vite's client. Its synchronous console-forwarding setup
    // must complete before taking ownership of console.warn; do not race that import.
    phase='vite-client-bootstrap';report.viteClientBootstrap=await bounded(page.evaluate(async()=>{
        const client=await import('/@vite/client');
        return {moduleResolved:true,source:new URL('/@vite/client',location.href).href,exports:Object.keys(client),
            consoleWarn:{name:console.warn.name,length:console.warn.length},scope:'Unchanged Vite client evaluated before startup observers.'};
    }),'Native Vite client readiness');
    await page.waitForLoadState('networkidle');await bounded(Promise.all(reads),'Vite client response hashes');assert.deepEqual(report.errors,[]);
    phase='original-page-startup';report.ready=await bounded(page.evaluate(async({root,pageName,diagnoseStartup,diagnoseWarmup,sourceHashes})=>{window.reviewPerf=await import('/@fs'+root+'/docs/evidence/nonhair-2026-09-26/review-performance/'+(diagnoseWarmup?'warmup-runtime.mjs':'runtime.mjs'));return reviewPerf.begin({pageName,diagnoseStartup,sourceHashes});},{root:ROOT,pageName:manifest.pageName,diagnoseStartup,diagnoseWarmup,sourceHashes:manifest.sources}),'Original page readiness',120000);
    phase='ready-unmeasured';
    await page.waitForLoadState('networkidle');await bounded(Promise.all(reads),'Response hashes');verify(manifest);assert.deepEqual(report.errors,[]);
    const actualGLB=report.responses.filter(r=>r.asset?.endsWith('.glb')).map(r=>r.asset).sort();
    const expectedGLB=manifest.pageName==='showcase'?['assets/wardrobe/body/g050.glb','assets/wardrobe/female_casualsuit01/g050.glb','assets/wardrobe/foundation_bra/g050.glb','assets/wardrobe/foundation_briefs/g050.glb','assets/wardrobe/shoes01/g050.glb','assets/hair/bob02/g050.glb']:['assets/figures/figure_g050.glb','assets/hair/bob02/g050.glb'];
    assert.deepEqual(actualGLB,expectedGLB.sort(),'Actual complete default geometry responses');
    await page.screenshot({path:path.join(out,'ready.png')});report.readyPNG={file:'ready.png',sha256:hash(path.join(out,'ready.png'))};
    if(diagnoseWarmup){
        collecting=false;report.unmeasuredStepReturns=[];
        for(let step=1;step<=20;step++){
            phase=(step<=8?'unmeasured-traced-warmup-step-':'unmeasured-after-trace-step-')+step;
            report.unmeasuredStepReturns.push(await bounded(page.evaluate(()=>reviewPerf.advance()),'Unmeasured native step'+step,30000));
        }
        collecting=true;phase='after-unmeasured-diagnostic';
        report.warmupDiagnostic=await page.evaluate(()=>reviewPerf.diagnostic());
        assert.equal(report.warmupDiagnostic.completed,true);assert.equal(report.warmupDiagnostic.records.length,20);assert.deepEqual(report.errors,[]);
        assert.equal(report.warmupDiagnostic.startupEvidence.restored,true);assert.equal(report.warmupDiagnostic.measurementCompleted,false);
        assert.ok(report.warmupDiagnostic.startupEvidence.warnings.every(w=>!String(w.arguments[0]).includes('Stack trace not available.')),'A native warning remains unlocated; no exemption.');
        report.diagnosticCompleted=true;report.measurementCompleted=false;
        report.warningDisposition='Raw startup/first8-step diagnostic traces only; no new timing admission. Any warning after trace restoration rejects this diagnostic.';
        await page.screenshot({path:path.join(out,'end.png')});report.endPNG={file:'end.png',sha256:hash(path.join(out,'end.png'))};
    }else if(diagnoseStartup){
        report.startupDiagnostic=await page.evaluate(()=>reviewPerf.diagnostic());
        assert.deepEqual(report.startupDiagnostic.records,[]);assert.equal(report.startupDiagnostic.lastAttempt,null);
        assert.equal(report.ready.startupDiagnostic.restored,true);
        report.diagnosticCompleted=true;report.measurementCompleted=false;
        report.warningDisposition='Raw, unclassified startup evidence retained. Warnings are not admitted for measurement.';
    }else{
        report.startupAdmission=assessStartup({pageName:manifest.pageName,warnings:report.warnings,ready:report.ready,sourceHashes:manifest.sources});
        startupWarnings=structuredClone(report.warnings);
        phase='measured-updates';collecting=false;report.smoke=await bounded(page.evaluate(()=>reviewPerf.smoke()),'Timestamp smoke',60000);collecting=true;phase='after-measurement';
        assert.equal(report.smoke.completed,true);assert.equal(report.smoke.records.length,20);assert.deepEqual(report.errors,[]);
        report.warningBoundary=assessWarningBoundary(report.warnings,startupWarnings);
        await page.screenshot({path:path.join(out,'end.png')});report.endPNG={file:'end.png',sha256:hash(path.join(out,'end.png'))};
        report.measurementCompleted=true;
    }
}catch(error){report.failure=error.stack;process.exitCode=1;
    if(page){try{await bounded(page.screenshot({path:path.join(out,'failure.png')}),'Failure screenshot',10000);report.failurePNG={file:'failure.png',sha256:hash(path.join(out,'failure.png')),scope:'No extra draw; actual compositor state at failure, not a readiness or exact-frame qualification.'};}catch(e){report.failurePNGError=String(e);}
        try{report.failureDiagnostic=await bounded(page.evaluate(()=>window.reviewPerf?.diagnostic()),'Failure diagnostic',5000);}catch(e){report.diagnosticFailure=String(e);}}
}
finally {
    try {
        collecting=true;phase='retirement';
        if(page){try{report.retirement=await bounded(page.evaluate(()=>window.reviewPerf?.finish()),'Native retirement');assert.equal(report.retirement?.completed,true);}catch(e){report.cleanupFailure=e.stack;process.exitCode=1;}}
        try{await bounded(Promise.all(reads),'Final response hashes');verify(manifest);assert.equal(hash(manifestPath),report.manifestSHA256);report.sourcesStable=true;}catch(e){report.sourceFailure=e.stack;process.exitCode=1;}
        report.environmentAfter=environment();report.servedResponseBlobs=served.size;
        if(!diagnoseStartup && !diagnoseWarmup && report.measurementCompleted)report.warningBoundary=assessWarningBoundary(report.warnings,startupWarnings);
        report.completed=!report.failure&&!report.cleanupFailure&&!report.sourceFailure&&report.sourcesStable&&report.errors.length===0&&
            (diagnoseStartup||diagnoseWarmup?report.diagnosticCompleted===true:report.smoke?.completed===true&&report.warningBoundary?.unchanged===true);
        if(report.smoke){const raw=Buffer.from(json(report.smoke)),bytes=gzipSync(raw);write('smoke.json.gz',bytes);report.smokeArtifact={file:'smoke.json.gz',sha256:sha(bytes),decodedSHA256:sha(raw),updates:report.smoke.records.length};delete report.smoke;}
        save();
    }catch(error){report.finalizationFailure=error.stack;report.completed=false;process.exitCode=1;}
    finally {
        for(const [name,close] of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>server?.close()]])try{await bounded(close(),'Close '+name);}catch(e){report.errors.push({type:'close-'+name,message:String(e)});report.completed=false;process.exitCode=1;}
        if(!diagnoseStartup && !diagnoseWarmup && report.measurementCompleted)try{report.warningBoundary=assessWarningBoundary(report.warnings,startupWarnings);}
        catch(e){report.warningFailure=e.stack;report.completed=false;process.exitCode=1;}
        if(diagnoseWarmup && report.warnings.some(w=>w.phase!=='original-page-startup' && !/^unmeasured-traced-warmup-step-[1-8]$/.test(w.phase))){report.warningFailure='Warning outside observed startup/first8 steps; no timing admission.';report.completed=false;process.exitCode=1;}
        if(report.errors.length){report.completed=false;process.exitCode=1;}
        save();if(report.completed)write('seal.json',{reportSHA256:hash(path.join(out,'report.json')),manifestSHA256:report.manifestSHA256,scope:manifest.scope});
        console.log(json({completed:report.completed,output:out,failure:report.failure,cleanupFailure:report.cleanupFailure,errors:report.errors.length}));
    }
}
