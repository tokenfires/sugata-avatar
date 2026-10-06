const maraRefFs = await import('node:fs/promises');
const maraRefDir = '/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-05/mara-cardigan-technical-design';
const maraRefURL = 'https://cdn.shopify.com/s/files/1/0414/6003/9840/t/2/assets/acf.LAHJAweb.png?v=1602593998';
let maraRefTab = null;
let maraRefImage = null;
const maraRefTrace = {owner:'root',beganUTC:new Date().toISOString(),phases:[],errors:[],screenshots:0};
const maraRefStart = Date.now();
const maraRefCheck = () => {if(Date.now()-maraRefStart>=60000)throw new Error('Reference first-image deadline');};
try {
  maraRefTrace.before = await cua.listTabs({browser:'3',emit:false});
  maraRefCheck();
  maraRefTrace.phases.push({name:'navigation requested',UTC:new Date().toISOString()});
  maraRefTab = await cua.createBrowserTab('iab',maraRefURL,{visible:false});
  maraRefTrace.ownedTab = maraRefTab.id;
  maraRefTrace.phases.push({name:'navigation returned',UTC:new Date().toISOString()});
  maraRefCheck();
  maraRefTrace.dom = await maraRefTab.playwright.domSnapshot();
  maraRefTrace.image = await maraRefTab.playwright.evaluate(() => {const i=document.querySelector('img');if(!i)return null;const r=i.getBoundingClientRect();return {src:i.currentSrc,complete:i.complete,natural:[i.naturalWidth,i.naturalHeight],rect:[r.x,r.y,r.width,r.height],viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};});
  if(!maraRefTrace.image?.complete || maraRefTrace.image.natural.some(v=>v<=0) || maraRefTrace.image.src!==maraRefURL)throw new Error('Reference image incomplete or mismatched');
  maraRefCheck();
  maraRefTrace.screenshots++;
  maraRefTrace.phases.push({name:'first screenshot requested',UTC:new Date().toISOString()});
  maraRefImage=await maraRefTab.screenshot({fullPage:true});
  maraRefTrace.phases.push({name:'first screenshot returned',UTC:new Date().toISOString()});
  maraRefCheck();
  await maraRefFs.writeFile(maraRefDir+'/reference-first.jpg',maraRefImage,{flag:'wx'});
  maraRefTrace.screenshotBytes=maraRefImage.byteLength;
  maraRefTrace.captureWithin60s=true;
} catch(error){maraRefTrace.errors.push(String(error?.message??error));}
finally {
  const maraRefCleanup=Date.now();
  if(maraRefTab)try{await maraRefTab.close();maraRefTrace.closedOwned=true;maraRefTrace.closeUTC=new Date().toISOString();}catch(error){maraRefTrace.errors.push('close: '+String(error));}
  try{maraRefTrace.after=await cua.listTabs({browser:'3',emit:false});}catch(error){maraRefTrace.errors.push('inventory: '+String(error));}
  maraRefTrace.cleanupMs=Date.now()-maraRefCleanup;
  maraRefTrace.completeUTC=new Date().toISOString();
  maraRefTrace.elapsedMs=Date.now()-maraRefStart;
  await maraRefFs.writeFile(maraRefDir+'/REFERENCE-IMAGE-TRACE.json',JSON.stringify(maraRefTrace,null,2)+'\n',{flag:'wx'});
  nodeRepl.write(maraRefTrace);
}
if(maraRefImage)await nodeRepl.emitImage({bytes:maraRefImage,mimeType:'image/jpeg'});
