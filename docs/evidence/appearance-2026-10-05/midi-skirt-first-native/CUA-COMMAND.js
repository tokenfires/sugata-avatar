const midiFirstFs = await import('node:fs/promises');
const midiFirstDir = '/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-05/midi-skirt-first-native';
let midiFirstTab = null;
let midiFirstImage = null;
const midiFirstTrace = { owner: 'root', startedUTC: new Date().toISOString(), phases: [], errors: [], screenshotAttempts: 0 };
const midiFirstStart = Date.now();
const midiFirstDeadline = midiFirstStart + 60000;
const midiFirstStep = (name) => midiFirstTrace.phases.push({ name, UTC: new Date().toISOString(), elapsedMilliseconds: Date.now()-midiFirstStart });
const midiFirstCheck = () => { if(Date.now() >= midiFirstDeadline) throw new Error('External first navigation/capture deadline'); };
try {
  midiFirstTrace.tabsBefore = await cua.listTabs({browser:'3',emit:false});
  midiFirstCheck();
  midiFirstStep('navigation requested');
  midiFirstTab = await cua.createBrowserTab('iab','http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-05/midi-skirt-viewer-preparation/review.html',{visible:false});
  midiFirstTrace.ownedTabId = midiFirstTab.id;
  midiFirstStep('navigation returned');
  midiFirstCheck();
  midiFirstTrace.initialDOM = await midiFirstTab.playwright.domSnapshot();
  let midiFirstState = await midiFirstTab.playwright.locator('#record').textContent({timeoutMs:2000});
  midiFirstTrace.initialRecord = JSON.parse(midiFirstState);
  if(midiFirstTrace.initialRecord.state === 'preparing') {
    midiFirstStep('single bounded readiness wait');
    await midiFirstTab.playwright.getByText('Ready · first unchanged front, right profile and rear · no fit or motion claim',{exact:true}).waitFor({state:'visible',timeoutMs:Math.max(1,Math.min(40000,midiFirstDeadline-Date.now()-5000))});
  }
  midiFirstCheck();
  midiFirstTrace.readyDOM = await midiFirstTab.playwright.domSnapshot();
  midiFirstTrace.readyRecord = JSON.parse(await midiFirstTab.playwright.locator('#record').textContent({timeoutMs:2000}));
  if(midiFirstTrace.readyRecord.state !== 'ready' || midiFirstTrace.readyRecord.renders !== 3 || midiFirstTrace.readyRecord.finishCalls !== 0) throw new Error('First readiness refused');
  midiFirstTrace.layout = await midiFirstTab.playwright.evaluate(() => { const c=document.querySelector('#views'); const b=c.getBoundingClientRect(); return { viewport:[innerWidth,innerHeight],document:[document.documentElement.clientWidth,document.documentElement.scrollWidth,document.documentElement.scrollHeight],canvasRect:[b.x,b.y,b.width,b.height],backing:[c.width,c.height] }; });
  if(JSON.stringify(midiFirstTrace.layout.viewport) !== '[1280,720]' || JSON.stringify(midiFirstTrace.layout.backing) !== '[1280,560]') throw new Error('Actual fixed frame refused');
  midiFirstCheck();
  midiFirstTrace.screenshotAttempts++;
  midiFirstStep('first screenshot requested');
  midiFirstImage = await midiFirstTab.screenshot({fullPage:false});
  midiFirstStep('first screenshot returned');
  midiFirstCheck();
  await midiFirstFs.writeFile(midiFirstDir+'/screenshot.jpg',midiFirstImage,{flag:'wx'});
  midiFirstTrace.screenshotBytes = midiFirstImage.byteLength;
  midiFirstTrace.captureWithin60s = true;
} catch(error) {
  midiFirstTrace.errors.push({phase:'native',message:String(error?.message ?? error),UTC:new Date().toISOString()});
} finally {
  midiFirstTrace.cleanupStartUTC = new Date().toISOString();
  const midiCleanupStart = Date.now();
  if(midiFirstTab) {
    try {
      if(await midiFirstTab.playwright.getByRole('button',{name:'Finish review',exact:true}).isEnabled()) {
        await midiFirstTab.playwright.getByRole('button',{name:'Finish review',exact:true}).click({timeoutMs:3000});
        midiFirstStep('Finish clicked');
      }
      midiFirstTrace.finishDOM = await midiFirstTab.playwright.domSnapshot();
      midiFirstTrace.finishRecord = JSON.parse(await midiFirstTab.playwright.locator('#record').textContent({timeoutMs:2000}));
      midiFirstTrace.finishButtonEnabled = await midiFirstTab.playwright.getByRole('button',{name:'Finish review',exact:true}).isEnabled();
      midiFirstTrace.console = await midiFirstTab.dev.logs({levels:['warn','error'],limit:12});
    } catch(error) { midiFirstTrace.errors.push({phase:'finish',message:String(error?.message ?? error)}); }
    try { await midiFirstTab.close(); midiFirstStep('only owned tab closed'); midiFirstTrace.closedOwnedTab = true; }
    catch(error) { midiFirstTrace.errors.push({phase:'close',message:String(error?.message ?? error)}); }
  }
  try { midiFirstTrace.tabsAfter = await cua.listTabs({browser:'3',emit:false}); }
  catch(error) { midiFirstTrace.errors.push({phase:'inventory',message:String(error?.message ?? error)}); }
  midiFirstTrace.cleanupMilliseconds = Date.now()-midiCleanupStart;
  midiFirstTrace.cleanupWithin15s = midiFirstTrace.cleanupMilliseconds <= 15000;
  midiFirstTrace.completedUTC = new Date().toISOString();
  midiFirstTrace.totalMilliseconds = Date.now()-midiFirstStart;
  await midiFirstFs.writeFile(midiFirstDir+'/NATIVE-TRACE.json',JSON.stringify(midiFirstTrace,null,2)+'\n',{flag:'wx'});
  nodeRepl.write({ownedTabId:midiFirstTrace.ownedTabId,screenshotAttempts:midiFirstTrace.screenshotAttempts,screenshotBytes:midiFirstTrace.screenshotBytes,ready:midiFirstTrace.readyRecord?.state,finish:midiFirstTrace.finishRecord?.state,finishCalls:midiFirstTrace.finishRecord?.finishCalls,cleanupErrors:midiFirstTrace.finishRecord?.cleanupErrors,captureWithin60s:midiFirstTrace.captureWithin60s,cleanupWithin15s:midiFirstTrace.cleanupWithin15s,closed:midiFirstTrace.closedOwnedTab,tabsAfter:midiFirstTrace.tabsAfter,errors:midiFirstTrace.errors,totalMilliseconds:midiFirstTrace.totalMilliseconds});
}
if(midiFirstImage) await nodeRepl.emitImage({bytes:midiFirstImage,mimeType:'image/jpeg'});
