// Native browser qualification of the local comparison pages; root serializes this job.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'captures/lower-fallback-review-v1';
assert.ok(/^captures\/lower-fallback-review-v[0-9]+$/.test(out));assert.ok(!fs.existsSync(out));fs.mkdirSync(out);
const source='tools/critic/bob-lower-fallback-pages.mjs',sha=b=>createHash('sha256').update(b).digest('hex');
fs.copyFileSync(source,`${out}/source.mjs`);
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceSha256:sha(fs.readFileSync(source)),errors:[],states:[],pages:[]};
const save=()=>fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');save();
const base='http://localhost:5173/@fs/Users/robault/GitHub/sugata-avatar/';let browser,page;
try{
  browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  for(const [name,file,last]of [['overview','docs/evidence/hair-2026-09-29/review.html',null],['head','captures/lower-fallback-head-v1/review.html',555],['ordinary','captures/lower-fallback-ordinary-v1/review.html',720]]){
    report.pages.push({file,sha256:sha(fs.readFileSync(file))});
    const snapshot=`${out}/page-source/${file}`;
    fs.mkdirSync(snapshot.slice(0,snapshot.lastIndexOf('/')),{recursive:true});
    fs.copyFileSync(file,snapshot,fs.constants.COPYFILE_EXCL);
    for(const width of[1440,390]){
      await page.setViewportSize({width,height:1000});await page.goto(`${base}${file}`,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
      const state=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth}))}));
      assert.ok(state.scrollWidth<=width);assert.equal(state.images.length,name==='overview'?11:2);
      if(name==='overview'){
        assert.equal(await page.locator('#inward-ends h2').textContent(),'A gentler turn toward the neck.');
        await page.locator('#inward-ends').screenshot({path:`${out}/inward-ends-${width}.png`});
      }else{
        await page.locator('#frame').focus();await page.locator('#frame').press('End');
        await page.waitForFunction(last=>document.querySelector('#time').value.startsWith(String(last))&&[...document.images].every(i=>i.complete&&i.naturalWidth),last);
        await page.locator('#previous').click();assert.ok((await page.locator('#time').textContent()).startsWith(String(last-3)));
        await page.locator('#next').click();assert.ok((await page.locator('#time').textContent()).startsWith(String(last)));
        await page.locator('#frame').press('Home');await page.waitForFunction(()=>document.querySelector('#time').value.startsWith('0 /'));
        const initial=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,time:v.currentTime}));
        assert.ok(Math.abs(initial.duration-(last/60+.05))<.001);assert.equal(initial.width,1800);assert.equal(initial.height,868);
        await page.locator('video').evaluate(v=>v.play());await page.waitForFunction(()=>document.querySelector('video').currentTime>1);
        const advanced=await page.locator('video').evaluate(v=>{v.pause();return {time:v.currentTime,paused:v.paused};});
        assert.ok(advanced.time>initial.time);state.playback={initial,advanced};
      }
      await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});report.states.push({name,...state});save();
    }
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.errors.push(error.stack);process.exitCode=1;}
finally{await page?.close();await browser?.close();report.finished=new Date().toISOString();report.limits=['Page controls and advancing media playhead, not continuous perceptual animation review.'];save();console.log(JSON.stringify(report));}
