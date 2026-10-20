// Exact one live nod trial. New browser/context, no user profile, no old observer/helper entry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from '/Users/robault/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const leaf=path.join(root,'docs/evidence/appearance-2026-10-20/acknowledgment-nod');
const out=path.join(leaf,'native-001');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const utc=()=>new Date().toISOString();
const report={started:utc(),pid:process.pid,status:'RUNNING',errors:[],warnings:[],children:[],stages:[],outputs:[],limits:{wallSeconds:180,nodeOldSpaceMiB:256,aggregateOutputsBytes:100663296,hardTotalRSS:false,universalDescendantProof:false}};
let server,browser,context,page,video,processClosed,child,expired=false,contextClosed=false,videoSaved=false;
const began=performance.now();
function totalBytes(dir=out) { let n=0; for(const d of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,d.name); if(d.isDirectory())n+=totalBytes(p);else if(d.isFile())n+=fs.statSync(p).size;else throw new Error('Unexpected output type.'); } return n; }
function check() { if(expired||performance.now()-began>180000)throw new Error('Native wall budget exceeded.');if(totalBytes()>report.limits.aggregateOutputsBytes)throw new Error('Output budget exceeded.'); }
function save(stage) { report.stages.push({stage,utc:utc(),wallMs:performance.now()-began});check();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n'); }
async function bounded(promise,ms,label) { let id;try{return await Promise.race([promise,new Promise((_,reject)=>{id=setTimeout(()=>reject(new Error(`${label} timeout`)),ms);})]);}finally{clearTimeout(id);} }
async function command(argv,label) {
    const record={label,argv,started:utc(),pid:null,collected:false};report.children.push(record);
    const stdout=fs.openSync(path.join(out,`${label}.stdout`),'wx'),stderr=fs.openSync(path.join(out,`${label}.stderr`),'wx');
    let owned,done;
    try {
        owned=spawn(argv[0],argv.slice(1),{stdio:['ignore',stdout,stderr]});child=owned;record.pid=owned.pid;
        done=new Promise((resolve,reject)=>{owned.once('error',reject);owned.once('close',(code,signal)=>{Object.assign(record,{collected:true,code,signal,end:utc()});resolve(code);});});
        const code=await bounded(done,15000,label);assert.equal(code,0,`${label} failed`);check();
    } finally {
        if(owned&&!record.collected) { owned.kill('SIGKILL');try{await bounded(done,3000,`${label} collection`);}catch(e){report.errors.push(e.message);} }
        child=null;fs.closeSync(stdout);fs.closeSync(stderr);
    }
}
// Fresh exclusive finite admission, separate from the static source review and CPU result.
const admission=JSON.parse(fs.readFileSync(path.join(leaf,'NATIVE-ADMISSION.json')));
assert.equal(admission.allowRun,true);assert.ok(Date.now()<Date.parse(admission.beforeUTC));
for(const pin of admission.pins) {const b=fs.readFileSync(path.resolve(root,pin.path));assert.equal(b.length,pin.bytes,pin.path);assert.equal(sha(b),pin.sha256,pin.path);}
fs.mkdirSync(out);fs.writeFileSync(path.join(leaf,'NATIVE-ADMISSION.used'),utc()+'\n',{flag:'wx'});
fs.mkdirSync(path.join(out,'videos'));fs.mkdirSync(path.join(out,'frames'));
fs.writeFileSync(path.join(out,'owner-start.json'),JSON.stringify({pid:process.pid,started:report.started,admissionSHA256:sha(fs.readFileSync(path.join(leaf,'NATIVE-ADMISSION.json')))},null,2)+'\n',{flag:'wx'});
const stopTimer=setTimeout(()=>{expired=true;child?.kill('SIGKILL');server?.kill().catch(e=>report.errors.push(`budget browser kill: ${e.message}`));},180000);
try {
    server=await chromium.launchServer({channel:'chromium',headless:true,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--hide-scrollbars'],timeout:30000});
    const process=server.process();report.browserPID=process.pid;
    processClosed=new Promise(resolve=>{process.once('close',(code,signal)=>{report.browserCollection={pid:process.pid,code,signal,utc:utc(),collected:true};resolve();});});
    browser=await chromium.connect(server.wsEndpoint(),{timeout:15000});report.browserVersion=browser.version();
    assert.equal(report.browserVersion,admission.expectedBrowserVersion,'Installed browser version changed');
    context=await browser.newContext({viewport:{width:720,height:850},deviceScaleFactor:1,reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'videos'),size:{width:720,height:850}}});
    report.pageCreationWall=Date.now();page=await context.newPage();video=page.video();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
    page.on('response',r=>{if(r.status()>=400) {
        if(new URL(r.url()).pathname==='/favicon.ico')report.warnings.push(`Optional favicon HTTP ${r.status()}`);
        else report.errors.push(`HTTP ${r.status()} ${r.url()}`);
    }});
    await page.goto('http://127.0.0.1:5173/src/nod-study.html',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.nodStudy||!document.querySelector('#error').hidden,null,{timeout:90000});
    assert.equal(await page.locator('#error').textContent(),'');
    report.before=await page.evaluate(()=>nodStudy.report());assert.equal(report.before.closed,false);assert.equal(report.before.paused,false);
    assert.equal(report.before.avatar.hair.attached,true);assert.equal(report.before.avatar.wardrobe.attached,true);
    assert.equal(report.before.nod.phase,'idle');
    await page.screenshot({path:path.join(out,'before.png')});save('ready');
    report.cueWall=Date.now();report.cue=await page.evaluate(()=>nodStudy.record());
    await page.locator('#nod').click({timeout:3000});
    // Actual live RAF; no manual simulation stepping, paused screenshot loop or renderer epoch manipulation.
    await page.waitForFunction(()=>nodStudy.recording?.completed===true,null,{timeout:6000});
    await page.waitForTimeout(1100);
    report.after=await page.evaluate(()=>nodStudy.report());
    const trace=report.after.trace;assert.ok(trace.length>=24&&trace.length<=360);
    assert.ok(trace.every((r,i)=>Number.isFinite(r.pitchDegrees)&&(!i||r.wallMs>trace[i-1].wallMs)));
    assert.ok(Math.max(...trace.map(r=>r.pitchDegrees))>=11.5,'Down stroke absent');
    assert.ok(Math.min(...trace.map(r=>r.pitchDegrees))<=-1.4,'Return/rebound absent');
    assert.equal(report.after.nod.phase,'idle');assert.equal(report.after.nod.lastStop,'finished');
    assert.equal(report.after.attention.phase,'idle');assert.equal(report.after.attention.holdsGaze,false);
    assert.deepEqual(report.after.avatar.motion.layers,report.before.avatar.motion.layers);
    await page.screenshot({path:path.join(out,'after.png')});
    report.retirement=await page.evaluate(()=>{nodStudy.dispose();return nodStudy.avatar.report().disposal;});
    assert.equal(report.retirement.disposed,true);assert.deepEqual(report.retirement.leaked,[]);save('motion-collected');
} catch(e) {report.errors.push(`${e.name}: ${e.message}`);}
finally {
    if(context)try{await bounded(context.close(),15000,'context close');contextClosed=true;}catch(e){report.errors.push(e.message);}
    if(video&&contextClosed)try{await bounded(video.saveAs(path.join(out,'first.webm')),15000,'video save');videoSaved=true;}catch(e){report.errors.push(e.message);}
    if(browser)try{await bounded(browser.close(),5000,'connection close');}catch(e){report.errors.push(e.message);}
    if(server) {
        try{await bounded(server.close(),7000,'browser server close');}catch(e){report.errors.push(e.message);try{await bounded(server.kill(),5000,'browser kill');}catch(x){report.errors.push(x.message);}}
        if(processClosed)try{await bounded(processClosed,5000,'browser process collection');}catch(e){report.errors.push(e.message);}
    }
}
try {
    assert.ok(contextClosed&&videoSaved&&report.browserCollection?.collected,'Collection incomplete');
    assert.equal(report.errors.length,0,report.errors.join('\n'));check();
    // One fixed derived window, no time/angle search or retake. Raw first video is retained whole.
    const seek=Math.max(0,(report.cueWall-report.pageCreationWall)/1000-.75);report.derivedWindow={seekSeconds:seek,seconds:4,fps:10,limit:40,alignment:'Approximate wall offset with0.75s lead; video PTS, not exact trace/frame registration. Full original remains authority.'};
    await command(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-nostdin','-n','-ss',String(seek),'-i',path.join(out,'first.webm'),'-t','4','-vf','fps=10','-frames:v','40',path.join(out,'frames/%03d.png')],'frames');
    const frames=fs.readdirSync(path.join(out,'frames')).filter(n=>/^\d{3}\.png$/.test(n)).sort();assert.ok(frames.length>=38&&frames.length<=40,'Fixed window incomplete');
    await command(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-nostdin','-n','-framerate','10','-i',path.join(out,'frames/%03d.png'),'-vf','scale=360:425,tile=8x5','-frames:v','1',path.join(out,'sequence.png')],'sheet');
    report.frameFiles=frames;report.status='A_COLLECTION_ONLY';save('derived-first-video');
} catch(e) {report.errors.push(`${e.name}: ${e.message}`);report.status='B_OR_UNKNOWN';}
finally {
    clearTimeout(stopTimer);report.end=utc();report.wallSeconds=(performance.now()-began)/1000;
    if(expired||report.wallSeconds>180||report.errors.length||report.children.some(c=>!c.collected)||!report.browserCollection?.collected)report.status='B_OR_UNKNOWN';
    function inventory(dir=out) {for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {const file=path.join(dir,entry.name);if(entry.isDirectory())inventory(file);else if(entry.isFile()&&!['report.json','terminal.json'].includes(entry.name)) {const b=fs.readFileSync(file);report.outputs.push({path:path.relative(out,file),bytes:b.length,sha256:sha(b)});}}}
    try{inventory();report.totalBytes=totalBytes();if(report.totalBytes>report.limits.aggregateOutputsBytes)report.status='B_OR_UNKNOWN';}catch(e){report.errors.push(e.message);report.status='B_OR_UNKNOWN';}
    report.wallSeconds=(performance.now()-began)/1000;
    if(report.wallSeconds>180) {report.errors.push('Final inventory exceeded wall budget.');report.status='B_OR_UNKNOWN';}
    for(const name of ['report.json','terminal.json'])try{fs.writeFileSync(path.join(out,name),JSON.stringify(report,null,2)+'\n');}catch(e){report.errors.push(`receipt ${name}: ${e.message}`);report.status='B_OR_UNKNOWN';}
    if(totalBytes()>report.limits.aggregateOutputsBytes) {
        report.status='B_OR_UNKNOWN';report.errors.push('Final receipts exceeded output budget.');
        for(const name of ['report.json','terminal.json'])try{fs.writeFileSync(path.join(out,name),JSON.stringify(report,null,2)+'\n');}catch(e){report.errors.push(`final receipt ${name}: ${e.message}`);}
    }
    console.log(JSON.stringify({status:report.status,pid:report.pid,browserPID:report.browserPID,browserCollected:report.browserCollection?.collected,wallSeconds:report.wallSeconds,errors:report.errors,out}));
    process.exitCode=report.status==='A_COLLECTION_ONLY'?0:1;
}
