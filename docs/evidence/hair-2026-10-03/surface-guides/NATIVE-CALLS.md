# Actual Cua calls; historical record only

Root restored documentation once through `await cua.rewriteDocumentation()`. Selected IAB browser3 retained, default viewport unchanged. No source/SDK page-evaluation hook was used.

```javascript
let surfaceGuideTab = await cua.createBrowserTab('3', 'http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/hair-2026-10-03/surface-guides/preview.html', {visible:false});
await surfaceGuideTab.playwright.getByRole('button',{name:'Create one preview',exact:true}).click();
await surfaceGuideTab.getAXState();
const surfaceGuideState1=await surfaceGuideTab.playwright.locator('#state').textContent();
const surfaceGuideObserved1=JSON.parse(surfaceGuideState1);
await surfaceGuideTab.getAXState();
const surfaceGuideStopped=await surfaceGuideTab.playwright.locator('#state').textContent();
await inkFs.writeFile(surfaceGuideFolder+'/STOPPED-STATE.json',surfaceGuideStopped+'\n',{flag:'wx'});
const surfaceGuideConsole=await surfaceGuideTab.dev.logs({levels:['warn','error'],limit:100});
await inkFs.writeFile(surfaceGuideFolder+'/CONSOLE.json',JSON.stringify(surfaceGuideConsole,null,2)+'\n',{flag:'wx'});
const surfaceGuideContext=await surfaceGuideTab.getScreenshot({emit:false});
await inkFs.writeFile(surfaceGuideFolder+'/stopped-context.jpg',surfaceGuideContext,{flag:'wx'});
await surfaceGuideTab.playwright.locator('#image').getAttribute('hidden');
await nodeRepl.emitImage({bytes:surfaceGuideContext,mimeType:'image/jpeg'});
await surfaceGuideTab.close();
const surfaceGuideRemainingTabs=await cua.listTabs({browser:'3',emit:false});
```

`surfaceGuideFolder` is this absolute evidence folder; inkFs is the existing node:fs/promises binding for artifact preservation. Actual printed state/console/closure fields and resulting bytes are retained. No readiness selector wait, sleep, private runtime read, download-event wait, offered-PNG extraction, next-view click or second Create. Tool wall durations for open/Create/state/preserve/close were .5028/.4004/.1641/.0852/.1068seconds; shell/native PID/start/exit are not supplied by these UI calls. Runtime source createdAt04:37:26.840Z and exact failure/state/close UTCs are retained separately; do not invent a PID or infer exhaustive jobs from them.
