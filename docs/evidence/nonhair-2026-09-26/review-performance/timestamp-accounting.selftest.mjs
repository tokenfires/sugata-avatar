import assert from 'node:assert/strict';
import {accountUpdate, summarize} from './timestamp-accounting.mjs';
function fixture() {
    const update = {id: 7, dt:1/60, updateCalls:1, receivedDts:[1/60], clockBefore:0, clockAfter:1/60, stackFrameBefore:1, stackFrameAfter:2, passes: {render: 2, compute: 1}, queries: []}, resolutions = [];
    for (const [type, count] of Object.entries(update.passes)) {
        const r = {type, updateId: 7, pendingBefore: false, pendingAfter: false, mapStateBefore: 'unmapped', mapStateAfter: 'unmapped',
            queryCount: count*2, remainingQueryCount: 0, remainingOffsets: 0, offsets: [], values: [], scalar: 999};
        for (let i=0;i<count;i++) {
            const uid = `${type === 'render' ? 'r' : 'c'}:${i}:123:f${100+i}`;
            update.queries.push({type, uid, groupKind:type==='compute'?'node':'render', updateId: 7, before: i*2, after: i*2+2, base: i*2, begin: i*2, end: i*2+1, querySetMatches: true, maxQueries: 2048});
            r.offsets.push([uid,i*2]); r.values.push({uid, existedBefore: false, existsAfter: true, durationMs: type === 'render' ? i+1 : .5});
        }
        resolutions.push(r);
    }
    return {update, resolutions};
}
let groups=0;
function test(name, run) { run(); groups++; console.log('PASS '+name); }
function bad(edit, pattern) {const f=fixture(), seen=new Set();edit(f);assert.throws(()=>accountUpdate(f.update,f.resolutions,seen),pattern);assert.equal(seen.size,0);}
test('uses every fresh pass across distinct Three frame IDs, never scalar',()=>{const f=fixture();const got=accountUpdate(f.update,f.resolutions);assert.deepEqual(got.durationMs,{render:3,compute:.5,passSum:3.5});assert.equal(got.rows.length,3);});
test('rejects stale scalar-only or cached UID data',()=>{bad(f=>{f.resolutions[0].values=[];},/Missing/);bad(f=>{f.resolutions[0].values[0].existedBefore=true;},/Stale/);const f=fixture(),seen=new Set();accountUpdate(f.update,f.resolutions,seen);assert.throws(()=>accountUpdate(f.update,f.resolutions,seen),/Reused/);});
test('rejects render-only, missing and duplicate results',()=>{bad(f=>{f.update.queries=f.update.queries.filter(q=>q.type==='render');},/Incomplete compute/);bad(f=>{f.resolutions[0].values[1]=f.resolutions[0].values[0];},/Duplicate/);bad(f=>{f.resolutions[0].values[0].existsAfter=false;},/Stale/);});
test('rejects overflow, absent writes and altered allocation',()=>{bad(f=>{f.update.queries[0].maxQueries=1;},/overflowed/);bad(f=>{f.update.queries[0].begin=null;},/allocation/);bad(f=>{f.update.queries[0].querySetMatches=false;},/Disabled/);bad(f=>{f.resolutions[0].offsets[0][1]=2;},/map mismatch/);});
test('rejects another update, pending resolve and undrained queries',()=>{bad(f=>{f.resolutions[0].updateId=8;},/another update/);bad(f=>{f.update.queries[0].updateId=8;},/ownership/);bad(f=>{f.resolutions[0].pendingBefore=true;},/already pending/);bad(f=>{f.resolutions[0].remainingQueryCount=2;},/undrained/);});
test('rejects invalid durations but preserves measured zero',()=>{for(const value of [NaN,Infinity,-.01])bad(f=>{f.resolutions[0].values[0].durationMs=value;},/invalid/);const f=fixture();f.resolutions[0].values[0].durationMs=0;assert.equal(accountUpdate(f.update,f.resolutions).rows[0].durationMs,0);});
test('rejects unexpected passes/types and duplicate resolution',()=>{bad(f=>{f.update.passes.render++;},/Incomplete/);bad(f=>{f.update.queries[0].type='other';},/Incomplete/);bad(f=>{f.resolutions[1]=f.resolutions[0];},/Duplicate/);});
test('nearest-rank summary includes slow samples and validates input',()=>{assert.deepEqual(summarize([5,1,2,3,100]),{count:5,median:3,p90:100,p95:100,p99:100,max:100,convention:'nearest rank: sorted[ceil(p*n)-1]'});assert.throws(()=>summarize([1,NaN]));});
test('rejects zero/two updates and a replaced delta',()=>{bad(f=>{f.update.updateCalls=2;},/one native update/);bad(f=>{f.update.updateCalls=0;},/one native update/);bad(f=>{f.update.receivedDts=[0];},/declared dt/);});
test('rejects wrong native time or frame progression',()=>{bad(f=>{f.update.clockAfter=0;},/boundary/);bad(f=>{f.update.stackFrameAfter=3;},/boundary/);});
test('admits unchanged array-compute UID only with native array/type evidence',()=>{const f=fixture(),q=f.update.queries.at(-1),r=f.resolutions[1];q.groupKind='array';q.uid='r:0:undefined:f100';r.offsets[0][0]=q.uid;r.values[0].uid=q.uid;assert.equal(accountUpdate(f.update,f.resolutions).durationMs.compute,.5);q.groupKind='node';assert.throws(()=>accountUpdate(f.update,f.resolutions),/ownership/);});
console.log(JSON.stringify({groups,scope:'Synthetic timestamp accounting only; no native GPU evidence.'}));
