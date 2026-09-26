// Fixed default-Wardrobe stepped pilot. No dynamic benchmark parameters.
export const PILOT=Object.freeze({traceSteps:8,minWarmup:180,maxWarmup:600,window:60,samples:240,dt:1/60});
const need=(ok,message)=>{if(!ok)throw Error(message);};
export function passSignature(row) {
    need(row.accounting && row.passes.render>0 && row.passes.compute>0,'Completed render+compute accounting required.');
    return {counts:{...row.accounting.passes},targets:row.targets.map(t=>t.type==='render'?{type:t.type,width:t.width,height:t.height,textures:[...t.textures]}:{type:t.type,name:t.name}),
        groups:row.queries.map(q=>({type:q.type,groupKind:q.groupKind}))};
}
export function warmupStability(rows) {
    const last=rows.at(-1)?.step;
    need(Number.isSafeInteger(last) && last>=PILOT.minWarmup && last<=PILOT.maxWarmup && last%PILOT.window===0,'Undeclared stability boundary.');
    const window=rows.filter(r=>r.step>=last-2*PILOT.window);
    need(window.length===2*PILOT.window+1,'Need two complete60-update windows including their initial boundary.');
    for(let i=0;i<window.length;i++)need(window[i].step===last-120+i,'Noncontiguous stability census.');
    for(const row of window) {
        need(row.snapshot && row.snapshot.pipelines && row.snapshot.memory && row.snapshot.passes && Number.isSafeInteger(row.snapshot.resources),'Missing native stability census.');
        for(const n of [...Object.values(row.snapshot.pipelines),...Object.values(row.snapshot.memory),row.snapshot.resources])need(Number.isFinite(n)&&n>=0,'Invalid native resource count.');
    }
    const base=JSON.stringify(window[0].snapshot),changed=window.filter(r=>JSON.stringify(r.snapshot)!==base).map(r=>r.step);
    return {stable:changed.length===0,first:last-120,last,windows:[[last-120,last-60],[last-60,last]],changedSteps:changed,
        scope:'Exact renderer memory/program/pipeline and resource-entry/pass-signature census stability under the final timestamp instrument. Not thermal/DVFS or statistically stationary timing.'};
}
export function assertSampleCensus(snapshot,admitted) {
    need(snapshot && admitted && JSON.stringify(snapshot)===JSON.stringify(admitted),'Sample resource/pass census diverged from admitted warmup; reject pilot summary.');
    return true;
}
export function summarizeSamples(rows) {
    need(rows.length===PILOT.samples && rows.every(r=>r.phase==='sample'),'Exactly240 measured sample rows required.');
    const stats=values=>{need(values.every(v=>Number.isFinite(v)&&v>=0),'Invalid timing.');const sorted=[...values].sort((a,b)=>a-b);const at=p=>sorted[Math.ceil(p*sorted.length)-1];return {count:values.length,median:(sorted[119]+sorted[120])/2,p90:at(.9),p95:at(.95),p99:at(.99),max:sorted.at(-1),percentiles:'nearest rank; median arithmetic middle pair'};};
    return {...Object.fromEntries(['cpuMs','stepWallMs','queueWaitMs'].map(k=>[k,stats(rows.map(r=>r[k]))])),
        ...Object.fromEntries(['render','compute','passSum'].map(k=>[k+'Ms',stats(rows.map(r=>r.accounting.durationMs[k]))]))};
}
