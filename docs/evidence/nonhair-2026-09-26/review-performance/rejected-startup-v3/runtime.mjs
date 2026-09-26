// Capture-local short smoke. Imports and calls the unchanged current review page.
import {Stage} from '../../../../packages/core/src/render/Stage.js';
import {Vector2, REVISION} from 'three/webgpu';
import {accountUpdate, TYPES} from './timestamp-accounting.mjs';
import {installStartupDiagnostics, assessCleanupPools} from './startup-diagnostics.mjs';
const requireThat = (ok, message) => { if (!ok) throw Error(message); };
let view, avatar, stage, renderer, backend, active=null, pendingStep=null, passContext=null, counter=0, failure=null, lastAttempt=null, startupEvidence=null;
const restorations=[], seen=new Set(), records=[], transitions=[];
const fail = error => { failure ??= String(error?.stack ?? error); throw error; };
function replace(object, key, wrapper) {
    const own=Object.getOwnPropertyDescriptor(object,key), original=object[key];
    requireThat(typeof original==='function', 'Missing native method '+key);
    Object.defineProperty(object,key,{configurable:true,writable:true,value:wrapper(original)});
    const installed=object[key];
    restorations.push(()=>{requireThat(object[key]===installed,'Observer method replaced: '+key);if(own)Object.defineProperty(object,key,own);else delete object[key];});
}
function counts() {return {renderCalls:renderer.info.render.calls,computeCalls:renderer.info.compute.calls,drawCalls:renderer.info.render.drawCalls,triangles:renderer.info.render.triangles};}
function dimensions() {
    const c=stage.canvas, b=renderer.getDrawingBufferSize(new Vector2()), s=renderer.getSize(new Vector2()), rect=c.getBoundingClientRect();
    return {window:[innerWidth,innerHeight],dpr:devicePixelRatio,visualViewport:visualViewport?{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}:null,
        canvasCSS:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},client:[c.clientWidth,c.clientHeight],backing:[c.width,c.height],
        logical:s.toArray(),drawingBuffer:b.toArray(),pixelRatio:renderer.getPixelRatio(),sceneTarget:stage.scenePass?{width:stage.scenePass.renderTarget.width,height:stage.scenePass.renderTarget.height}:null,
        temporalEpoch:stage.temporal?.frameEpoch?.()??null,resolutionScale:stage.resolutionScale,
        camera:{position:stage.camera.position.toArray(),quaternion:stage.camera.quaternion.toArray(),zoom:stage.camera.zoom,fov:stage.camera.fov,effectiveFOV:stage.camera.getEffectiveFOV(),aspect:stage.camera.aspect},
        scroll:[scrollX,scrollY],visibility:document.visibilityState};
}
function assertWorkload(pageName) {
    const r=avatar.report();
    requireThat(r.identity.bake==='figure_g050' && r.identity.gender===.5,'Unexpected body.');
    requireThat(r.motion.seed===20260807 && r.scene.id==='studio' && r.quality.backend==='webgpu' && r.quality.tier==='balanced' && !r.quality.backendMismatch,'Unexpected seed/scene/tier/backend.');
    requireThat(r.hair.attached && r.hair.style==='bob02' && r.hair.loadedStyle==='bob02','Incomplete default hair workload.');
    requireThat(view.attention.phase==='idle' && !matchMedia('(prefers-reduced-motion: reduce)').matches && document.visibilityState==='visible','Unexpected pause/attention/visibility state.');
    requireThat(document.querySelector('#pause').getAttribute('aria-pressed')==='false','Page is paused.');
    if(pageName==='showcase') {
        const expected=['female_casualsuit01','shoes01','foundation_bra','foundation_briefs'].sort();
        requireThat(r.wardrobe?.attached && r.wardrobe.pendingCandidates===0 && JSON.stringify([...r.wardrobe.state.worn].sort())===JSON.stringify(expected),'Incomplete default outfit.');
        requireThat(r.wardrobe.appearance?.attached && r.wardrobe.appearance.style==='ecru' && r.framing.mode==='body' && r.quality.requested==='balanced','Unexpected Wardrobe appearance.');
    } else requireThat(r.wardrobe===null && r.framing.mode==='portrait' && r.quality.requested==='auto','Unexpected Portrait workload.');
    return r;
}
function census() {
    const meshes=[];
    stage.scene.traverse(o=>{if(o.isMesh){const g=o.geometry;meshes.push({name:o.name,visible:o.visible,vertices:g.attributes.position?.count??null,
        indices:g.index?.count??null,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'},
        groups:g.groups.map(x=>({...x})),materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,type:m.type,visible:m.visible}))});}});
    return {meshes,memory:{...renderer.info.memory},stage:stage.stats,dimensions:dimensions()};
}

export async function begin({pageName,diagnoseStartup=false}) {
    requireThat(['showcase','portrait'].includes(pageName) && !avatar,'Unsupported/repeated bootstrap.');
    requireThat(new URLSearchParams(location.search).has('capture'),'Smoke requires capture mode.');
    requireThat(REVISION==='185','Only source-bound Three r185 admitted.');
    const descriptor=Object.getOwnPropertyDescriptor(Stage.prototype,'create'), nativeCreate=descriptor.value;
    let creates=0;
    async function create(canvas,options) {
        creates++;requireThat(creates===1,'Unexpected second Stage.');
        requireThat(!Object.hasOwn(options,'trackTimestamp'),'Page supplied unexpected timestamp option.');
        const result=await nativeCreate.call(this,canvas,{...options,trackTimestamp:true});
        stage=this;renderer=this.renderer;backend=renderer.backend;
        requireThat(backend.isWebGPUBackend===true && backend.trackTimestamp===true && backend.hasTimestamp===true && backend.device.features.has('timestamp-query'),'Native timestamp capability unavailable.');
        transitions.push({phase:'after-native-Stage-create',from:true,to:false,reason:'Do not accumulate queries during unmeasured native asset construction.',
            pools:TYPES.map(type=>{const p=backend.timestampQueryPool[type];return {type,allocated:p?.currentQueryIndex??0,offsets:p?[...p.queryOffsets]:[],pending:!!p?.pendingResolve,mapState:p?.resultBuffer.mapState??null};})});
        backend.trackTimestamp=false;
        return result;
    }
    const startupObserver=diagnoseStartup?installStartupDiagnostics():null;
    Object.defineProperty(Stage.prototype,'create',{...descriptor,value:create});
    try {await import(`/src/${pageName}.js`);}
    finally {try{requireThat(Stage.prototype.create===create,'Stage construction observer replaced.');Object.defineProperty(Stage.prototype,'create',descriptor);}finally{try{startupObserver?.restore();}finally{startupEvidence=startupObserver?.report()??null;}}}
    view=window[pageName];requireThat(creates===1 && view?.avatar && view.avatar.stage===stage,'Original page did not become ready.');avatar=view.avatar;
    const report=assertWorkload(pageName);
    await backend.device.queue.onSubmittedWorkDone();
    backend.trackTimestamp=true;transitions.push({phase:'ready-before-warmup',from:false,to:true});
    // Stage may have drawn once before its native create returned. Drain/discard only those
    // unmeasured startup records; no simulation/render/reset is added here.
    const startup=[];
    for(const type of TYPES) {
        const pool=backend.timestampQueryPool[type];
        if(pool){requireThat(!pool.pendingResolve && pool.resultBuffer.mapState==='unmapped','Startup pool already resolving.');
            const uids=[...pool.queryOffsets.keys()];await renderer.resolveTimestampsAsync(type);
            requireThat(pool.currentQueryIndex===0 && pool.queryOffsets.size===0 && !pool.pendingResolve && pool.resultBuffer.mapState==='unmapped','Startup queries did not drain.');
            for(const uid of pool.timestamps.keys())seen.add(uid);
            startup.push({type,discardedUIDs:uids,resolvedUIDs:pool.timestamps.size,remainingQueries:pool.currentQueryIndex,remainingOffsets:pool.queryOffsets.size,pending:!!pool.pendingResolve,mapState:pool.resultBuffer.mapState});}
    }
    replace(avatar,'update',original=>function(dt){
        try {
            requireThat(this===avatar && pendingStep && !active,'Unexpected/reentrant Avatar update.');
            const row=pendingStep;row.updateCalls++;row.receivedDts.push(dt);requireThat(row.updateCalls===1 && dt===row.dt,'Expected exactly one native update with declared dt.');
            active=row;row.clockBefore=avatar.clockSeconds;row.stackFrameBefore=avatar.stack.frame;row.rendererFrameBefore=renderer.info.frame;row.before=counts();
            const start=performance.now();let result;
            try {result=original.call(this,dt);} finally {row.cpuMs=performance.now()-start;active=null;}
            requireThat(result===undefined,'Avatar.update became asynchronous.');
            row.clockAfter=avatar.clockSeconds;row.stackFrameAfter=avatar.stack.frame;row.rendererFrameAfter=renderer.info.frame;row.after=counts();return result;
        }catch(error){active=null;return fail(error);}
    });
    for(const [method,type] of [['beginRender','render'],['beginCompute','compute']])replace(backend,method,original=>function(context){
        const previous=passContext;
        try{requireThat(this===backend && active,'GPU pass outside attributed update.');active.passes[type]++;passContext={type,groupKind:type==='render'?'render':Array.isArray(context)?'array':'node'};
            active.targets.push(type==='render'?{type,width:context.width,height:context.height,textures:context.textures?.map(t=>t.name)??['canvas']}:{type,name:context.name??'',id:context.id});
            return original.call(this,context);
        }catch(error){return fail(error);}finally{passContext=previous;}
    });
    replace(backend,'initTimestampQuery',original=>function(type,uid,descriptor){
        try {
            requireThat(this===backend && active && TYPES.includes(type) && passContext?.type===type,'Timestamp outside attributed native pass.');
            const before=this.timestampQueryPool[type]?.currentQueryIndex??0;
            const result=original.call(this,type,uid,descriptor), pool=this.timestampQueryPool[type], w=descriptor.timestampWrites;
            requireThat(pool && w,'Missing native timestamp write.');
            active.queries.push({type,uid,groupKind:passContext.groupKind,updateId:active.id,before,after:pool.currentQueryIndex,base:pool.queryOffsets.get(uid),
                begin:w.beginningOfPassWriteIndex,end:w.endOfPassWriteIndex,querySetMatches:w.querySet===pool.querySet,maxQueries:pool.maxQueries});
            return result;
        }catch(error){return fail(error);}
    });
    replace(backend.device.queue,'onSubmittedWorkDone',original=>function(...args){
        const row=pendingStep;requireThat(row,'Unattributed queue barrier.');const start=performance.now(),promise=original.apply(this,args);row.queueCalls++;
        promise.then(()=>{row.queueWaitMs=performance.now()-start;},error=>{failure??=String(error);});return promise;
    });
    const info=backend.device.adapterInfo,adapterInfo=info?Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter','subgroupMinSize','subgroupMaxSize'].filter(k=>info[k]!==undefined).map(k=>[k,info[k]])):null;
    const identityText=adapterInfo?Object.values(adapterInfo).join(' '):'';
    requireThat(adapterInfo?.isFallbackAdapter!==true && !/swiftshader|llvmpipe|software/i.test(identityText),'Software adapter is outside this smoke.');
    const limits=Object.fromEntries(Object.getOwnPropertyNames(Object.getPrototypeOf(backend.device.limits)).filter(k=>typeof backend.device.limits[k]==='number').map(k=>[k,backend.device.limits[k]]));
    return {pageName,report,census:census(),transitions,startup,startupDiagnostic:startupObserver?.report()??null,capability:{backend:stage.backendName,trackTimestamp:backend.trackTimestamp,hasTimestamp:backend.hasTimestamp,
        features:[...backend.device.features],adapterInfo,limits,hardwareIdentity:identityText.trim()?'reported (verify against host)':'unavailable; no hardware-performance claim',threeRevision:REVISION},
        scope:'Short instrument smoke; warmup and sample count do not qualify steady-state performance.'};
}

async function resolve(row,type) {
    const pool=backend.timestampQueryPool[type];requireThat(pool,'Expected '+type+' pool missing.');
    const offsets=[...pool.queryOffsets], r={type,updateId:row.id,pendingBefore:!!pool.pendingResolve,mapStateBefore:pool.resultBuffer.mapState,
        queryCount:pool.currentQueryIndex,offsets,values:offsets.map(([uid])=>({uid,existedBefore:pool.hasTimestampQuery(uid)}))};
    requireThat(!r.pendingBefore && r.mapStateBefore==='unmapped','Pool not idle before resolve.');
    r.scalarIgnored=await renderer.resolveTimestampsAsync(type);
    // Array-shaped native compute groups receive an r: UID in Three r185. Read the pool
    // selected by the observed native pass type; backend.getTimestamp(uid) guesses wrongly.
    for(const v of r.values){v.existsAfter=pool.hasTimestampQuery(v.uid);v.durationMs=v.existsAfter?pool.getTimestamp(v.uid):null;}
    r.pendingAfter=!!pool.pendingResolve;r.mapStateAfter=pool.resultBuffer.mapState;r.remainingQueryCount=pool.currentQueryIndex;r.remainingOffsets=pool.queryOffsets.size;
    return r;
}

export async function smoke({warmup=8,samples=12}={}) {
    requireThat(avatar && !pendingStep && records.length===0 && warmup===8 && samples===12,'Only the declared short smoke is admitted.');
    const initial=dimensions(),resourceCount=performance.getEntriesByType('resource').length;
    for(let i=0;i<warmup+samples;i++) {
        const row={id:++counter,phase:i<warmup?'smoke-warmup':'smoke-sample',dt:1/60,updateCalls:0,receivedDts:[],passes:{render:0,compute:0},queries:[],targets:[],queueCalls:0};
        pendingStep=row;lastAttempt=row;const start=performance.now();
        try {await view.step(row.dt);row.stepWallMs=performance.now()-start;requireThat(!failure,'Observer failure: '+failure);requireThat(row.queueCalls===1,'Native step queue barrier changed.');}
        catch(error){return fail(error);}finally{pendingStep=null;}
        try{const resolutions=[];row.resolutions=resolutions;for(const type of TYPES)resolutions.push(await resolve(row,type));
            row.accounting=accountUpdate(row,resolutions,seen);records.push(row);
        }catch(error){return fail(error);}
    }
    requireThat(performance.getEntriesByType('resource').length===resourceCount,'Resources loaded during smoke.');
    const final=dimensions();
    for(const key of ['window','dpr','canvasCSS','client','backing','logical','drawingBuffer','pixelRatio','sceneTarget','resolutionScale','scroll','visibility'])
        requireThat(JSON.stringify(initial[key])===JSON.stringify(final[key]),'Viewport/target changed: '+key);
    for(const key of ['position','quaternion','zoom','fov','effectiveFOV'])requireThat(JSON.stringify(initial.camera[key])===JSON.stringify(final.camera[key]),'Camera changed: '+key);
    return {completed:true,records,initial,final,census:census(),failure,
        metricsScope:'Instrumented fixed-step smoke only. No steady-state CPU/GPU, live cadence, presented FPS or performance-budget verdict.'};
}

export async function finish() {
    const result={failure,restored:[],cleanupErrors:[]};
    if(!avatar){try{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));}catch(error){result.cleanupErrors.push(String(error));}
        return {...result,completed:false,reason:'Original page never became ready; original cleanup event still dispatched.'};}
    requireThat(!pendingStep && !active,'Cannot retire during an update.');
    const pools=TYPES.map(type=>({type,pool:backend.timestampQueryPool[type]})), originalMemory={...renderer.info.memory};
    const poolState=()=>pools.map(({type,pool:p})=>({type,present:!!p,allocated:p?.currentQueryIndex??0,offsets:p?[...p.queryOffsets]:[],pending:!!p?.pendingResolve,mapState:p?.resultBuffer.mapState??null}));
    result.poolsBeforeCleanup=poolState();
    result.measurementStarted=counter>0;
    requireThat(result.measurementStarted || (lastAttempt===null && records.length===0),'Contradictory premeasurement cleanup state.');
    result.originalPoolAssessment=assessCleanupPools(result.poolsBeforeCleanup,{measurementStarted:result.measurementStarted});
    const originallyIdle=result.originalPoolAssessment.idle;
    result.cleanupDrains=[];
    for(const {type,pool} of pools)if(pool)for(let attempt=0;attempt<2 && (pool.currentQueryIndex>0 || pool.pendingResolve);attempt++){
        let timer;try{await Promise.race([renderer.resolveTimestampsAsync(type),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Cleanup query drain timeout: '+type)),5000);})]);
            result.cleanupDrains.push({type,attempt,remaining:pool.currentQueryIndex,offsets:[...pool.queryOffsets],pending:!!pool.pendingResolve,mapState:pool.resultBuffer.mapState});
        }catch(error){result.cleanupErrors.push(String(error));break;}finally{clearTimeout(timer);}}
    result.finalPoolAssessment=assessCleanupPools(poolState(),{measurementStarted:result.measurementStarted});
    result.poolsIdleBeforeDisposal=result.finalPoolAssessment.idle;
    // Restore timing/queue/pass observers before invoking the original page teardown handler.
    while(restorations.length){try{restorations.pop()();result.restored.push(true);}catch(error){result.cleanupErrors.push(String(error));}}
    try{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));}catch(error){result.cleanupErrors.push(String(error));}
    const after=avatar.report();
    result.cleanup={trigger:'Synthetic non-persisted pagehide invoking unchanged page handler; not navigation qualification.',beforeMemory:originalMemory,
        disposed:avatar.disposed,leaks:avatar.leakedHandles(),memory:{...renderer.info.memory},pools:pools.map(({type,pool})=>({type,disposed:pool?.isDisposed??null})),report:after.disposal};
    result.completed=result.cleanupErrors.length===0 && !failure && originallyIdle && result.poolsIdleBeforeDisposal && avatar.disposed && result.cleanup.leaks.length===0 &&
        pools.every(({pool})=>pool?pool.isDisposed===true:!result.measurementStarted);
    return result;
}

export function diagnostic() {return {failure,records,lastAttempt,startupEvidence,active:active?.id??null,pendingStep:pendingStep?.id??null};}
