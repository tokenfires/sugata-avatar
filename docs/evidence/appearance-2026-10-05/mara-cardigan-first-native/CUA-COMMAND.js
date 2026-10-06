const maraNativeFs = await import('node:fs/promises');
const maraNativeCrypto = await import('node:crypto');
const maraNativeLeaf = '/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-05/mara-cardigan-first-native';
const maraNativeURL = 'http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-05/mara-cardigan-technical-design/review.html';
const maraNativeStart = Date.now();
const maraNativeTrace = {startUTC:new Date(maraNativeStart).toISOString(), screenshotAttempts:0, errors:[], before:await cua.listTabs({browser:'3',emit:false})};
let maraNativeTab;
try {
  maraNativeTrace.navigationRequestedUTC = new Date().toISOString();
  maraNativeTab = await cua.createBrowserTab('3',maraNativeURL,{visible:false});
  maraNativeTrace.ownedTab = maraNativeTab.id;
  maraNativeTrace.navigationReturnedUTC = new Date().toISOString();
  maraNativeTrace.initialDOM = await maraNativeTab.playwright.domSnapshot();
  await maraNativeTab.playwright.waitForLoadState({state:'load',timeoutMs:15000});
  maraNativeTrace.ready = await maraNativeTab.playwright.evaluate(() => {
    const i = document.querySelector('img.sheet');
    const r = i?.getBoundingClientRect();
    return {url:location.href,complete:i?.complete,naturalWidth:i?.naturalWidth,naturalHeight:i?.naturalHeight,currentSrc:i?.currentSrc,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}};
  });
  const m = maraNativeTrace.ready;
  if(m.url!==maraNativeURL || !m.complete || m.naturalWidth!==1280 || m.naturalHeight!==960 || m.currentSrc!==maraNativeURL.replace('review.html','cardigan.svg') || m.viewport.width!==1280 || m.viewport.height!==720 || m.document.width>1280 || !Number.isFinite(m.document.height) || m.document.height>1400 || !m.rect || !Number.isFinite(m.rect.width) || !Number.isFinite(m.rect.height) || m.rect.width<=0 || m.rect.height<=0) throw new Error('First image readiness/bounds contract not met');
  if(Date.now()-maraNativeStart>60000) throw new Error('First native collection budget exhausted before screenshot');
  maraNativeTrace.screenshotAttempts = 1;
  maraNativeTrace.screenshotRequestedUTC = new Date().toISOString();
  const bytes = await maraNativeTab.screenshot({fullPage:true});
  maraNativeTrace.screenshotReturnedUTC = new Date().toISOString();
  await maraNativeFs.writeFile(maraNativeLeaf+'/original-first.jpg',bytes,{flag:'wx'});
  maraNativeTrace.image = {path:maraNativeLeaf+'/original-first.jpg',bytes:bytes.length,sha256:maraNativeCrypto.createHash('sha256').update(bytes).digest('hex')};
  maraNativeTrace.captureWithin60Seconds = Date.now()-maraNativeStart<=60000;
  await nodeRepl.emitImage({bytes,mimeType:'image/jpeg'});
} catch(e) {
  maraNativeTrace.errors.push(String(e));
} finally {
  maraNativeTrace.cleanupStartUTC = new Date().toISOString();
  const cleanupStart = Date.now();
  if(maraNativeTab) {
    try {maraNativeTrace.console = await maraNativeTab.dev.logs({levels:['warn','error'],limit:12});} catch(e) {maraNativeTrace.errors.push('console: '+String(e));}
    try {await maraNativeTab.close();maraNativeTrace.closedUTC=new Date().toISOString();} catch(e) {maraNativeTrace.errors.push('close: '+String(e));}
  }
  maraNativeTrace.after = await cua.listTabs({browser:'3',emit:false});
  maraNativeTrace.cleanupMs = Date.now()-cleanupStart;
  maraNativeTrace.endUTC = new Date().toISOString();
  maraNativeTrace.dateElapsedMs = Date.now()-maraNativeStart;
  await maraNativeFs.writeFile(maraNativeLeaf+'/NATIVE-TRACE.json',JSON.stringify(maraNativeTrace,null,2)+'\n',{flag:'wx'});
  nodeRepl.write(maraNativeTrace);
}
