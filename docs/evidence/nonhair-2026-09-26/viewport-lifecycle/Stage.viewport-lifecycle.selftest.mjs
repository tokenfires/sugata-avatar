// CPU lifecycle regression: real Stage methods and native EventTarget once semantics.
// No renderer/backend/browser is constructed. The renderer is an observable sizing boundary.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PerspectiveCamera } from 'three/webgpu';
import { Stage } from '../../../../packages/core/src/render/Stage.js';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const self = fileURLToPath(import.meta.url), stageFile = path.join(root, 'packages/core/src/render/Stage.js');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { version:1, completed:false, scope:'CPU real Stage viewport lifecycle; native EventTarget delivery; instrumented MediaQueryList/ResizeObserver and renderer sizing boundary. No GPU/browser or browser-GC proof.',
    sourceHashes:{'packages/core/src/render/Stage.js':sha(fs.readFileSync(stageFile)), [path.relative(root,self)]:sha(fs.readFileSync(self))}, checks:[] };
function environment() {
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const oldResize = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
    const queries = [], observers = [], deliveries = [];
    class Query extends EventTarget {
        constructor(media) { super(); this.media = media; this.records = []; }
        addEventListener(type, callback, options = {}) {
            const capture = typeof options === 'boolean' ? options : Boolean(options.capture);
            if (this.records.some(r => r.active && r.type === type && r.callback === callback && r.capture === capture)) return;
            const record = {type, callback, capture, once:typeof options === 'object' && Boolean(options.once), active:true};
            record.wrapper = event => { if (record.once) record.active = false; deliveries.push(this.media); callback.call(this,event); };
            this.records.push(record); super.addEventListener(type, record.wrapper, options);
        }
        removeEventListener(type, callback, options = {}) {
            const capture = typeof options === 'boolean' ? options : Boolean(options.capture);
            const record = this.records.find(r => r.active && r.type === type && r.callback === callback && r.capture === capture);
            if (record) { record.active = false; super.removeEventListener(type, record.wrapper, options); }
        }
        change() { this.dispatchEvent(new Event('change')); }
        get active() { return this.records.filter(r => r.active).length; }
    }
    class Observer {
        constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnects = 0; observers.push(this); }
        observe(target) { this.targets.add(target); }
        disconnect() { this.targets.clear(); this.disconnects++; }
    }
    globalThis.window = { devicePixelRatio:1, matchMedia(media) { const query = new Query(media); queries.push(query); return query; } };
    globalThis.ResizeObserver = Observer;
    const restore = () => { for (const [key, prior] of [['window',oldWindow],['ResizeObserver',oldResize]]) {
        if (prior) Object.defineProperty(globalThis,key,prior); else delete globalThis[key];
    } };
    return {queries, observers, deliveries, get active(){return queries.reduce((n,q)=>n+q.active,0);}, restore};
}
function fixture() {
    const stage = new Stage(), sizes = [], renderer = { disposals:0, ratio:1,
        setPixelRatio(ratio) { this.ratio = ratio; }, setSize(width,height,style) { sizes.push({width,height,style,ratio:this.ratio}); },
        dispose() { this.disposals++; } };
    stage.canvas = {clientWidth:800,clientHeight:600}; stage.camera = new PerspectiveCamera(); stage.renderer = renderer;
    return {stage,renderer,sizes};
}
function check(name, run) {
    const env = environment();
    try { const observation = run(env); report.checks.push({name,passed:true,observation}); }
    catch (error) { report.checks.push({name,passed:false,error:error.message,stack:error.stack}); }
    finally { env.restore(); }
}
check('normal DPR delivery fires once, resizes, and repins to the new raw ratio', env => {
    const {stage,sizes} = fixture(); stage.watchViewport(); const first = env.queries[0];
    window.devicePixelRatio = 1.5; first.change(); first.change();
    assert.equal(env.deliveries.length,1); assert.deepEqual(sizes,[{width:800,height:600,style:false,ratio:1.5}]);
    assert.equal(env.queries.length,2); assert.equal(env.queries[1].media,'(resolution: 1.5dppx)');
    assert.equal(first.active,0); assert.equal(env.active,1); assert.equal(stage.camera.aspect,800/600);
    return {deliveries:env.deliveries.length,active:env.active,query:env.queries[1].media};
});
check('dispose before any DPR delivery releases its listener and observer', env => {
    const {stage,renderer,sizes} = fixture(); stage.watchViewport(); const first = env.queries[0]; stage.dispose();
    const activeAfterDispose = env.active; first.change();
    assert.equal(activeAfterDispose,0,'DPR listener retained after Stage.dispose');
    assert.equal(env.deliveries.length,0); assert.equal(env.queries.length,1); assert.equal(sizes.length,0);
    assert.equal(env.observers[0].targets.size,0); assert.equal(renderer.disposals,1); assert.equal(stage.renderer,null);
    return {activeAfterDispose,postDisposeDeliveries:env.deliveries.length};
});
check('unwatch while renderer remains live prevents stale updates and registration resurrection', env => {
    const {stage,sizes} = fixture(); stage.watchViewport(); const first = env.queries[0]; stage.unwatchViewport();
    window.devicePixelRatio = 2; first.change();
    assert.equal(env.deliveries.length,0,'Removed observer still delivered'); assert.equal(sizes.length,0);
    assert.equal(env.active,0); assert.equal(env.queries.length,1); assert.equal(env.observers[0].targets.size,0);
    stage.dispose(); return {deliveries:env.deliveries.length,queries:env.queries.length};
});
check('explicit repinning replaces the old listener rather than duplicating ownership', env => {
    const {stage,sizes} = fixture(); stage.watchViewport(); const first = env.queries[0];
    window.devicePixelRatio = 2; stage.watchPixelRatio(); const second = env.queries[1]; first.change();
    assert.equal(env.deliveries.length,0,'Obsolete query delivered after repin'); assert.equal(sizes.length,0);
    assert.equal(env.active,1); assert.equal(first.active,0); assert.equal(second.active,1);
    second.change(); assert.equal(sizes.length,1); assert.equal(env.active,1); stage.dispose();
    return {deliveries:env.deliveries.length,queryCount:env.queries.length};
});
check('a captured obsolete callback cannot steal a replacement registration', env => {
    const {stage,sizes} = fixture(); stage.watchViewport(); const oldCallback = env.queries[0].records[0].callback;
    window.devicePixelRatio = 1.5; stage.watchPixelRatio(); const current = stage.pixelRatioWatcher, count = env.queries.length;
    // Deliberate adversarial callback replay, separate from EventTarget delivery semantics.
    oldCallback(new Event('change'));
    assert.equal(sizes.length,0,'Obsolete callback resized active Stage');
    assert.equal(stage.pixelRatioWatcher,current); assert.equal(env.queries.length,count); stage.dispose();
    return {capturedCallbackReplay:'inert',queryCount:count};
});
check('retired callback stays inert after an explicit unwatch and rewatch', env => {
    const {stage,sizes} = fixture(); stage.watchViewport(); const oldCallback = env.queries[0].records[0].callback;
    stage.unwatchViewport(); stage.watchViewport(); const current = stage.pixelRatioWatcher;
    oldCallback(new Event('change')); assert.equal(sizes.length,0); assert.equal(stage.pixelRatioWatcher,current); assert.equal(env.active,1);
    stage.dispose(); assert.equal(env.active,0); return {activeAfterDispose:env.active};
});
check('fifty independent create-watch-retire cycles retain no pending listeners', env => {
    for (let i=0;i<50;i++) { const {stage,renderer}=fixture(); stage.watchViewport(); stage.dispose(); stage.dispose(); assert.equal(renderer.disposals,1); }
    const activeAfterRetirement = env.active; for (const query of env.queries) query.change();
    assert.equal(activeAfterRetirement,0,'Repeated retirement accumulates pending DPR listeners'); assert.equal(env.deliveries.length,0);
    assert.ok(env.observers.every(observer=>observer.targets.size===0));
    return {cycles:50,activeAfterRetirement,postRetirementDeliveries:env.deliveries.length};
});
check('DPR clamp and canvas ResizeObserver sizing remain native', env => {
    const {stage,sizes} = fixture(); stage.watchViewport(); window.devicePixelRatio=3; env.queries[0].change();
    assert.equal(sizes[0].ratio,2); assert.equal(env.queries.at(-1).media,'(resolution: 3dppx)');
    stage.canvas.clientWidth=400; stage.canvas.clientHeight=800; env.observers[0].callback();
    assert.deepEqual(sizes.at(-1),{width:400,height:800,style:false,ratio:2}); assert.equal(stage.camera.aspect,.5);
    stage.dispose(); return {sizes};
});
check('listener retirement precedes a renderer-disposal failure and remains idempotent', env => {
    const {stage,renderer}=fixture(); stage.watchViewport(); renderer.dispose=()=>{throw Error('renderer retirement fixture');};
    assert.throws(()=>stage.dispose(),AggregateError); const active=env.active;
    assert.doesNotThrow(()=>stage.unwatchViewport()); assert.doesNotThrow(()=>stage.dispose());
    assert.equal(active,0); assert.equal(env.active,0); assert.equal(stage.renderer,null);
    return {activeAfterFailedRendererDisposal:active};
});
report.completed = report.checks.every(check=>check.passed);
assert.equal(sha(fs.readFileSync(stageFile)),report.sourceHashes['packages/core/src/render/Stage.js'],'Stage changed during CPU test');
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
for(const item of report.checks)console.log((item.passed?'PASS ':'FAIL ')+item.name+(item.passed?'':': '+item.error));
console.log(JSON.stringify({passed:report.checks.filter(c=>c.passed).length,total:report.checks.length,stageSHA256:report.sourceHashes['packages/core/src/render/Stage.js']}));
if(!report.completed)process.exitCode=1;
