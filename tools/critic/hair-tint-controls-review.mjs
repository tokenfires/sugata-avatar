/** Native product qualification for an editable base/tint recipe; no hairstyle qualification. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
import {resolveHairTint,mixedHairColour,hairColourLinear} from '../../packages/core/src/material/HairColourOptions.js';
import {HAIR_COLOURS} from '../../packages/testbed/src/showcase-hair-colours.mjs';
import {resolveShowcaseSelection,optionsForShowcase} from '../../packages/testbed/src/showcase-presets.mjs';
import {selectionFromConfiguration,showcaseSettingsUrl} from '../../packages/testbed/src/showcase-settings.mjs';
import {decodePng} from './png.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.resolve(root,process.argv.find(x=>x.startsWith('--out='))?.slice(6)??'captures/hair-tint-controls-v1');
assert.ok(!fs.existsSync(out),'Preserve prior evidence; use a fresh output path.');
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources=['tools/critic/hair-tint-controls-review.mjs','tools/critic/png.mjs','packages/core/src/render/MotionProbe.mjs',
'packages/core/src/Avatar.js','packages/core/src/material/HairColourOptions.js','packages/core/src/material/HairMaterial.js',
'packages/core/src/render/Stage.js','packages/core/src/render/Grade.js','packages/core/src/render/TRAAPost.js',
'packages/core/src/motion/HairDynamics.js','packages/testbed/src/showcase.js','packages/testbed/src/showcase.html',
'packages/testbed/src/showcase-hair-colours.mjs','packages/testbed/src/showcase-hair-colours.css',
'packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-settings.mjs','packages/testbed/src/showcase-collection.mjs',
'packages/testbed/src/viewer-framing.mjs','assets/hair/bob01/g050.glb','assets/hair/bob02/g050.glb','assets/figures/figure_g050.glb'];
const hashes=()=>Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
fs.mkdirSync(out,{recursive:true});
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:hashes(),checks:[],states:[],images:[],comparisons:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const file of sources.filter(p=>!p.startsWith('assets/'))){const dest=path.join(out,'source',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
save();
const check=(name,fn)=>{fn();report.checks.push(name);save();};
check('Strict recipe validation and endpoints',()=>{
 assert.equal(resolveHairTint(undefined,null),null);
 for(const value of [null,{},[],{colour:'#8063ac'},{colour:'#8063ac',amount:'0.5'},{colour:'#8063ac',amount:NaN},{colour:'#8063ac',amount:Infinity},{colour:'#8063ac',amount:-.1},{colour:'#8063ac',amount:1.1},{colour:'red',amount:.5},{colour:'#8063ac',amount:.5,extra:true}])assert.throws(()=>resolveHairTint(value,'#413934'));
 assert.throws(()=>resolveHairTint({colour:'#8063ac',amount:.5},null));
 const input={colour:'#ABcdEF',amount:.25},tint=resolveHairTint(input,'#413934');input.colour='#000000';assert.deepEqual(tint,{colour:'#abcdef',amount:.25});assert.ok(Object.isFrozen(tint));
 assert.equal(mixedHairColour('#000000',{colour:'#ffffff',amount:.5}),'#bcbcbc');
 assert.equal(mixedHairColour('#413934',{colour:'#8063ac',amount:0}),'#413934');assert.equal(mixedHairColour('#413934',{colour:'#8063ac',amount:1}),'#8063ac');
});
check('Both cuts, seven bases and exact tint recipe round trips',()=>{
 for(const preset of ['casual','elegant'])for(const base of HAIR_COLOURS)for(const amount of [0,.35,1,1e-8,.123456789]){
  const s=resolveShowcaseSelection(new URLSearchParams({preset,hairColour:base.hex,hairTintColour:'#8063ac',hairTintAmount:String(amount)}));
  const c=optionsForShowcase(s);assert.deepEqual(selectionFromConfiguration(c),s);
  assert.deepEqual(resolveShowcaseSelection(showcaseSettingsUrl(s,'http://localhost/src/showcase.html').searchParams),s);
  assert.deepEqual(c.hairTint,{colour:'#8063ac',amount});
  const upper=structuredClone(c);upper.hairColour=upper.hairColour.toUpperCase();upper.hairTint.colour=upper.hairTint.colour.toUpperCase();assert.deepEqual(optionsForShowcase(selectionFromConfiguration(upper)),c);
 }
 for(const query of ['hairTintColour=%238063ac','hairTintAmount=.5','hairColour=%23413934&hairTintColour=%238063ac&hairTintAmount=','hairColour=%23413934&hairTintColour=%238063ac&hairTintAmount=2','hairColour=%23413934&hairTintColour=%238063ac&hairTintAmount=0&hairTintAmount=1'])assert.throws(()=>resolveShowcaseSelection(new URLSearchParams(query)));
});
let server,browser,page;const browserErrors=[];const captures=new Map();
async function ready(){
 await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});
 assert.equal(await page.locator('#error').textContent(),'');
 await page.evaluate(()=>{const a=showcase.avatar,dispose=a.dispose.bind(a);a.dispose=()=>{dispose();const values=JSON.parse(sessionStorage.getItem('tint-disposals')??'[]');values.push(a.report().disposal);sessionStorage.setItem('tint-disposals',JSON.stringify(values));};});
}
async function openColours(){await page.locator('#hair-colours').evaluate(e=>{e.open=true;});}
async function apply(){await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('#apply-hair-colour').click()]);await ready();await openColours();}
async function state(label){
 const s=await page.evaluate(()=>({configuration:showcase.configuration(),colour:showcase.avatar.report().hair.colour,backend:showcase.avatar.stage.backendName,url:location.href,
 controls:{base:document.querySelector('#hair-colour').value,enabled:document.querySelector('#hair-tint-enabled').checked,tint:document.querySelector('#hair-tint-colour').value,amount:Number(document.querySelector('#hair-tint-amount').value)/100,applyDisabled:document.querySelector('#apply-hair-colour').disabled}}));
 assert.equal(s.backend,'webgpu');assert.equal(s.colour.matchesAttached,true);
 const c=s.configuration;
 assert.equal(s.colour.requested,c.hairColour??null);assert.equal(s.colour.applied,c.hairColour??null);
 assert.deepEqual(s.colour.requestedTint,c.hairTint??null);assert.deepEqual(s.colour.appliedTint,c.hairTint??null);
 if(c.hairColour){assert.equal(s.colour.resolved,mixedHairColour(c.hairColour,c.hairTint));assert.deepEqual(s.colour.linear,hairColourLinear(s.colour.resolved));}
 report.states.push({label,...s});save();return s;
}
async function capture(label,{ui=true}={}){
 console.log(`CAPTURE ${label}`);
 const canvas=await page.evaluate(async()=>{
  const a=showcase.avatar,f=a.stage.renderer._nodes.nodeFrame;
  a.stage.renderer._animation.stop();f.frameId=0;f.time=0;f.deltaTime=0;f.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();
  showcase.controls.enableDamping=false;showcase.controls.update();
  for(let i=0;i<98;i++){f.update();f.time=0;f.deltaTime=0;await showcase.step(0);}
  const c=await a.hairDynamics.readCentrelines(),v=await a.hairDynamics.readVertices();
  const info=a.stage.renderer.backend?.adapter?.info??a.stage.renderer.backend?.device?.adapterInfo;
  const lights=[];a.stage.scene.traverse(o=>{if(o.isLight)lights.push({name:o.name,type:o.type,colour:o.color.toArray(),intensity:o.intensity,matrix:o.matrixWorld.toArray()});});
  const uniforms={};for(const [key,node]of Object.entries(a.hairMaterial.hairUniforms)){if(key==='baseColour')continue;const value=node?.value;if(typeof value==='number'||typeof value==='boolean')uniforms[key]=value;else if(value?.toArray)uniforms[key]=value.toArray();}
  f.update();f.time=0;f.deltaTime=0;a.stage.draw();
  return {data:a.stage.canvas.toDataURL('image/png'),clock:{frame:f.frameId,time:f.time,delta:f.deltaTime},
    fixed:{camera:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray(),target:showcase.controls.target.toArray(),
      positions:Array.from(c.positions),velocities:Array.from(c.velocities),vertices:Array.from(v.positions),headMatrix:c.headMatrix,
      lights,uniforms,
      width:a.stage.canvas.width,height:a.stage.canvas.height},adapter:info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null};
 });
 const bytes=Buffer.from(canvas.data.split(',')[1],'base64'),filename=`${label}-canvas.png`;
 fs.writeFileSync(path.join(out,filename),bytes);assert.equal(canvas.clock.frame,99);assert.equal(canvas.clock.time,0);
 const stateFile=`${label}-fixed.json`;fs.writeFileSync(path.join(out,stateFile),JSON.stringify(canvas.fixed)+'\n');
 const record={label,filename,sha256:sha(bytes),clock:canvas.clock,adapter:canvas.adapter,fixedStateFile:stateFile,fixedStateSha256:sha(fs.readFileSync(path.join(out,stateFile)))};
 if(ui){record.ui=`${label}-ui.png`;await page.screenshot({path:path.join(out,record.ui),fullPage:true});record.uiSha256=sha(fs.readFileSync(path.join(out,record.ui)));}
 captures.set(label,{...canvas,bytes});report.images.push(record);save();
}
function compare(a,b){const x=captures.get(a),y=captures.get(b);assert.deepEqual(x.fixed,y.fixed);
 const u=decodePng(x.bytes),v=decodePng(y.bytes);assert.equal(u.width,v.width);assert.equal(u.height,v.height);
 let changed=0,max=0;for(let i=0;i<u.pixels.length;i+=4){let diff=0;for(let j=0;j<4;j++)diff=Math.max(diff,Math.abs(u.pixels[i+j]-v.pixels[i+j]));if(diff>0)changed++;max=Math.max(max,diff);}
 const row={a,b,fixedStateExact:true,changedPixels:changed,maximumChannelDifference:max,pass:changed===0};report.comparisons.push(row);save();
}
try{
 server=await startProbeServer({port:5301});browser=await launchProbeBrowser();report.baseUrl=server.baseUrl;save();
 page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',e=>browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text());});page.on('response',r=>{if(r.status()>=400)browserErrors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${server.baseUrl}/src/showcase.html?preset=casual&frame=portrait&capture=`,{waitUntil:'domcontentloaded'});await ready();await openColours();
 const original=await state('Original');assert.equal(original.controls.enabled,false);await capture('original');
 await page.locator('#hair-shade').selectOption('#413934');await apply();const base=await state('Brown base');await capture('base');
 const baseUrl=page.url();await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await ready();await openColours();await state('Independent base repeat');await capture('base-repeat');compare('base','base-repeat');
 await page.locator('#hair-tint-enabled').check();await page.locator('#hair-tint-amount').focus();await page.locator('#hair-tint-amount').press('Home');
 assert.equal(await page.locator('#hair-tint-amount').inputValue(),'0');assert.equal(await page.locator('#apply-hair-colour').isEnabled(),true);
 await apply();const zero=await state('Zero tint retains recipe');assert.deepEqual(zero.configuration,{...base.configuration,hairTint:{colour:'#8063ac',amount:0}});assert.equal(zero.controls.enabled,true);assert.equal(zero.controls.amount,0);assert.equal(zero.controls.applyDisabled,true);
 await capture('zero');compare('base','zero');
 await page.locator('#hair-tint-amount').press('Home');for(let i=0;i<35;i++)await page.locator('#hair-tint-amount').press('ArrowRight');assert.equal(await page.locator('#hair-tint-amount').inputValue(),'35');
 assert.deepEqual((await state('Unapplied tint draft')).configuration,zero.configuration);await apply();const mixed=await state('Tint applied');assert.deepEqual(mixed.configuration.hairTint,{colour:'#8063ac',amount:.35});await capture('mixed');
 const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending;await download.saveAs(path.join(out,'tinted-look.json'));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'tinted-look.json'))),mixed.configuration);
 await page.locator('#saved-looks').evaluate(e=>{e.open=true;});await page.locator('#saved-look-name').fill('Brown with lavender tint');await page.locator('#save-local-look').click();
 const local=await page.evaluate(()=>JSON.parse(localStorage.getItem('sugata:showcase:saved-looks:v1')));assert.deepEqual(local.looks[0].configuration,mixed.configuration);
 await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('[data-scene=kitchen]').click()]);await ready();await openColours();assert.deepEqual((await state('Kitchen keeps recipe')).configuration.hairTint,mixed.configuration.hairTint);await capture('kitchen');
 await page.locator('[data-outfit=elegant]').click();await page.waitForFunction(()=>document.querySelector('[data-outfit=elegant]').getAttribute('aria-pressed')==='true'&&!document.querySelector('#outfit-controls').disabled);assert.deepEqual((await state('Outfit keeps recipe')).configuration.hairTint,mixed.configuration.hairTint);
 await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('[data-preset=elegant]').click()]);await ready();await openColours();await page.locator('[data-frame=portrait]').click();assert.equal((await state('Other cut keeps recipe')).configuration.hair,'bob01');await capture('long-bob');
 await page.setViewportSize({width:390,height:844});await capture('mobile-long-bob');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1440,height:1000});
 await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('#settings-file').setInputFiles(path.join(out,'tinted-look.json'))]);await ready();await openColours();const reopened=await state('JSON reopens editable recipe');assert.deepEqual(reopened.configuration,mixed.configuration);assert.equal(reopened.controls.base,'#413934');assert.equal(reopened.controls.amount,.35);assert.equal(reopened.controls.applyDisabled,true);await capture('json-reopened');compare('mixed','json-reopened');
 await page.locator('#hair-tint-amount').press('End');await apply();const full=await state('Full tint');assert.equal(full.configuration.hairTint.amount,1);assert.equal(full.colour.resolved,'#8063ac');await capture('full-tint');
 await page.locator('#hair-shade').selectOption('#aa4029');assert.ok(await page.locator('#apply-hair-colour').isEnabled());await apply();const red=await state('Same final colour retains changed base');assert.equal(red.configuration.hairColour,'#aa4029');assert.equal(red.configuration.hairTint.amount,1);await capture('full-tint-red-base');compare('full-tint','full-tint-red-base');
 await page.locator('#hair-tint-enabled').uncheck();await apply();const off=await state('Tint off restores current base');assert.equal(Object.hasOwn(off.configuration,'hairTint'),false);assert.equal(off.colour.resolved,'#aa4029');await capture('tint-off');
 await page.locator('#hair-shade').selectOption('original');await apply();const restored=await state('Exact Original restored');assert.deepEqual(restored.configuration,original.configuration);assert.deepEqual(restored.colour.linear,original.colour.linear);await capture('original-restored');compare('original','original-restored');
 await page.locator('#saved-looks').evaluate(e=>{e.open=true;});await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('[data-open-look]').click()]);await ready();await openColours();const named=await state('Named look restores editing controls');assert.deepEqual(named.configuration,mixed.configuration);assert.equal(named.controls.base,'#413934');assert.equal(named.controls.amount,.35);assert.equal(named.controls.enabled,true);await capture('named-reopened');compare('mixed','named-reopened');
 const precise=.12345678912345678,preciseUrl=new URL(page.url());preciseUrl.searchParams.set('hairTintAmount',String(precise));
 await page.goto(preciseUrl.href,{waitUntil:'domcontentloaded'});await ready();await openColours();assert.equal((await state('Precise amount loaded')).configuration.hairTint.amount,precise);
 await page.locator('#hair-tint-enabled').uncheck();await page.locator('#hair-tint-enabled').check();assert.equal(await page.locator('#apply-hair-colour').isDisabled(),true);
 await page.locator('#hair-tint-colour').fill('#224466');await apply();const picked=await state('Tint picker preserves untouched precise amount');assert.deepEqual(picked.configuration.hairTint,{colour:'#224466',amount:precise});await capture('picker-precision');
 report.invalidSdk=await page.evaluate(async root=>{const {Avatar}=await import(`/@fs/${root}packages/core/src/Avatar.js`);const values=[];for(const options of [{hair:'bob02',hairTint:{colour:'#8063ac',amount:.5}},{hair:'bob02',hairColour:'#413934',hairTint:{colour:'#8063ac',amount:2}}]){try{const a=await Avatar.create({canvas:document.createElement('canvas'),...options});a.dispose();values.push('unexpected-success');}catch(e){values.push(e.message);}}return values;},root);
 assert.match(report.invalidSdk[0],/explicit hairColour/);assert.match(report.invalidSdk[1],/amount/);
 report.tamper=await page.evaluate(()=>{const a=showcase.avatar,prior=a.hairTint;try{a.hairTint={colour:'#000000',amount:.5};try{showcase.configuration();return 'unexpected-success';}catch(e){return e.message;}}finally{a.hairTint=prior;}});assert.match(report.tamper,/attached hair colour/);
 await page.evaluate(()=>showcase.avatar.dispose());report.disposals=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tint-disposals')));assert.ok(report.disposals.every(d=>d.disposed));
 assert.deepEqual(browserErrors,[]);assert.deepEqual(hashes(),report.sourceHashes);report.checks.push('Native recipe-aware Apply, zero/full endpoints, both cuts, scene/outfit retention, JSON and named-look reopening, mobile fit, original restoration, precision-sensitive picker and mismatch refusal');
 assert.ok(report.comparisons.every(c=>c.pass),'Exact paired-image gate failed; all remaining observations were collected without weakening it.');report.status='captured';
}catch(error){report.status='failed';report.errors.push(error.stack);throw error;}
finally{report.browserErrors=browserErrors;report.finished=new Date().toISOString();save();await browser?.close();await server?.close();}
