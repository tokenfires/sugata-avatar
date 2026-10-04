# Actual root Cua presentation commands

Cua selected browser3 was retained after documentation refresh; no other browser was selected. Source preflight12288 exit0 (22e13d) was checked before first open. All filesystem writes below are artifact bytes only; browser interaction uses Cua. No raw browser/GPU/server process was launched.

```javascript
await cua.rewriteDocumentation();
var inkPageOpenUtc = new Date().toISOString();
var inkReviewTab = await cua.createBrowserTab("3", "http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/looks/ink-denim-review.html", {visible:false});
```

First open00:05:31.397UTC/tab2 before00:06 cutoff. Initial actual AX Full look/native selector and closed disclosure. The persistent `inkRecord(name)` read a fresh `playwright.domSnapshot()` and read-only DOM URL/viewport/scrollWidth/select.value/details.open/six image currentSrc, complete, natural sizes, bounding rects/captions and nine link text/href/download fields. It saved each state and unmodified `tab.screenshot({fullPage:true})` JPEG bytes through node:fs/promises, SHA256 through node:crypto and UI.json. Five original native JPEG emissions were actually viewed by root. DOM visibility boolean is only getClientRects length; closed-details descendant rects do not override actual AX/screenshot visibility. Screenshot full-page coordinates differ from current scroll-dependent DOM y values.

```javascript
await inkRecord('desktop-body');
await inkReviewTab.playwright.getByLabel('Compare captured views').press('ArrowDown');
await inkReviewTab.getAXState(); // Native popup opens; Full look remains selected.
await inkReviewTab.playwright.getByLabel('Compare captured views').press('ArrowDown');
await inkReviewTab.playwright.getByLabel('Compare captured views').press('Enter');
await inkReviewTab.getAXState(); // Portrait selected and paired portrait context.
await inkRecord('desktop-portrait');
await inkReviewTab.playwright.getByText('Existing small smile · two separate stills',{exact:true}).press('Enter');
await inkReviewTab.getAXState(); // Both correctly captioned Neutral portraits disclosed.
await inkRecord('desktop-action');
var inkDownloadedPath = await inkReviewTab.playwright.getByRole('link',{name:'Download this look',exact:true}).downloadMedia({timeoutMs:20000});
var inkDownloadedBytes = await inkFs.readFile(inkDownloadedPath);
await inkFs.writeFile(inkPacket+'/downloaded-ink-denim.json',inkDownloadedBytes);
await inkReviewTab.getAXState();
await (await inkReviewBrowser.capabilities.get('viewport')).documentation();
await inkReviewTab.playwright.getByText('Existing small smile · two separate stills',{exact:true}).press('Enter');
await (await inkReviewBrowser.capabilities.get('viewport')).set({width:390,height:844});
await inkReviewTab.getAXState(); // Disclosure closed.
await inkRecord('mobile-portrait');
await inkReviewTab.playwright.getByText('Existing small smile · two separate stills',{exact:true}).click();
await inkReviewTab.getAXState(); // Disclosure open.
await inkRecord('mobile-action');
await inkReviewTab.dev.logs({levels:['error','warn'],limit:100});
await (await inkReviewBrowser.capabilities.get('viewport')).reset();
await inkReviewTab.getAXState();
await inkReviewTab.playwright.evaluate(()=>({width:innerWidth,height:innerHeight}));
await inkReviewTab.close();
```

Actual visible file link downloadMedia returned /Users/robault/Downloads/ink-denim.json,554bytes/SHA80562c5d8584fb75c127afd5dc240470fdf46c1a9f964d9075cbe38de3f07407, exactly accepted recipe and saved packet copy. This exercises the documented file-link API, not a claim that a native download confirmation dialog or click event was tested. Generic Wardrobe URL only inspected, Avatar not launched. Six actual media URLs loaded complete900×868; original links agree with loaded URLs. Guide URL/source target checked without navigation.

Five actual states/screenshot hashes and timestamps, seven UI action descriptions, empty captured warn/error console list (limit100), first open and ownedtab closure00:06:41.982UTC are in UI.json. Temporary viewport reset to1280×720; user original tab unmodified. No global network/assistive speech/continuous motion/AAA/calibration or body-breadth claim. Independent root16562/readback e5a744 verifies exact ten inputs, five JPEG hashes, complete natural sizes and preserved image ratio, no horizontal overflow, exact JSON, first-open timing and cleanup. Review1023/5173 remains listening. Critic actual-image decision remains required before adoption.
