import assert from 'node:assert/strict';
import {Node,StackNode,ConditionalNode,WebGPUBackend} from 'three/webgpu';
import {bool} from 'three/tsl';
import {installStartupDiagnostics,assessCleanupPools} from './startup-diagnostics.mjs';
import {installStartupDiagnostics as rejectedV3} from './rejected-startup-v3/startup-diagnostics.mjs';
const bindings=[[Node,'captureStackTrace'],[StackNode.prototype,'If'],[StackNode.prototype,'ElseIf'],[ConditionalNode.prototype,'generate'],[WebGPUBackend.prototype,'_draw']];
const before=bindings.map(([o,k])=>Object.getOwnPropertyDescriptor(o,k));
const warnDescriptor=Object.getOwnPropertyDescriptor(console,'warn'),forwarded=[];
const nativeGenerate=ConditionalNode.prototype.generate;
function dispatchProbe(){
    const node=new ConditionalNode(bool(true),bool(false));let formats=0,types=0;
    node.getNodeType=()=>{types++;return 'float';};
    const data={buildStages:{setup:true,analyze:true},nodeProperty:'native-result'};
    const builder={context:{},buildStage:'generate',getBuildStage:()=> 'generate',getNodeFromHash:()=>null,
        getDataFromNode:()=>data,addChain(){},removeChain(){},format(value,from,to){formats++;return `formatted(${value},${from},${to})`;}};
    return {length:node.generate.length,outputs:[node.build(builder,'float'),node.build(builder,'vec3')],formats,types,snippet:data.snippet??null};
}
const expected={length:2,outputs:['native-result','native-result'],formats:0,types:2,snippet:null};
assert.deepEqual(dispatchProbe(),expected);
Object.defineProperty(console,'warn',{...warnDescriptor,value:(...args)=>{forwarded.push(args);}});
let red;
try {
    const broken=rejectedV3();
    try {red=dispatchProbe();assert.notDeepEqual(red,expected);assert.equal(red.length,0);assert.equal(red.formats,2);assert.equal(red.snippet,'native-result');}
    finally {broken.restore();}
    const observationContext={phase:'unmeasured-traced-warmup',step:1};
    const observer=installStartupDiagnostics({context:()=>({...observationContext})});
    try {
        assert.equal(ConditionalNode.prototype.generate,nativeGenerate,'No shader method interception remains.');
        assert.deepEqual(dispatchProbe(),expected,'Actual Node.build retains native output-parameter dispatch without generic caching.');
        for(let i=1;i<bindings.length;i++)assert.equal(bindings[i][0][bindings[i][1]].length,before[i].value.length);
        const node=new Node();assert.equal(node.stackTrace.isStackTrace,true);
        console.warn('Synthetic warning with native creation trace',node.stackTrace.getError('TSL source test'));
        const report=observer.report();assert.equal(report.warnings.length,1);assert.equal(forwarded.length,1);
        assert.deepEqual(report.warnings[0].context,observationContext);
        assert.equal(report.warnings[0].arguments[0],forwarded[0][0]);assert.equal(report.warnings[0].arguments[1],forwarded[0][1]);
        assert.match(report.warnings[0].emissionStack,/Native warning emission/);
        // Execute actual native _draw with a modeled encoder, not a browser/GPU.
        const index={array:new Uint16Array([0,1,2]),count:3},draws=[],updates=[];
        const object={name:'hidden-foundation',parent:null},material={name:'cloth',type:'MeshStandardNodeMaterial'};
        const ro={object,material,context:{},geometry:{id:7,index,drawRange:{start:0,count:0}},camera:{name:'test-camera',type:'PerspectiveCamera'},getIndex:()=>index,getIndirect:()=>null};
        const encoder={setPipeline(){},setIndexBuffer(){},drawIndexed(...a){draws.push(a);}};
        const params={vertexCount:0,instanceCount:1,firstVertex:0};
        const result=WebGPUBackend.prototype._draw.call({get:()=>({buffer:'modeled-buffer'})},ro,{update(...a){updates.push(a);}}, {},'modeled-pipeline',[],[],params,encoder,{bindingGroups:[],attributes:[]});
        assert.equal(result,undefined);assert.deepEqual(draws,[[0,1,0,0,0]]);assert.deepEqual(updates,[[object,0,1]]);
        const zero=observer.report().zeroIndexDraws;assert.equal(zero.length,1);assert.equal(zero[0].mesh,object.name);
        assert.deepEqual(zero[0].context,observationContext);
        assert.deepEqual(zero[0].drawParameters,params);assert.equal(zero[0].drawRange.count,0);assert.equal(zero[0].indexCount,3);
        const nativeFailure=Error('native encoder failed');encoder.drawIndexed=()=>{throw nativeFailure;};
        assert.throws(()=>WebGPUBackend.prototype._draw.call({get:()=>({buffer:'modeled-buffer'})},ro,{update(){}},{},'modeled-pipeline',[],[],params,encoder,{bindingGroups:[],attributes:[]}),e=>e===nativeFailure);
    } finally {observer.restore();}
    assert.equal(observer.report().restored,true);
    for(let i=0;i<bindings.length;i++)assert.deepEqual(Object.getOwnPropertyDescriptor(...bindings[i]),before[i]);
    assert.throws(()=>observer.restore(),/already restored/);
    // A later owner is never overwritten, but all other owned descriptors still retire.
    const displaced=installStartupDiagnostics(),later=()=>{};console.warn=later;
    assert.throws(()=>displaced.restore(),e=>e instanceof AggregateError && e.errors.some(x=>x.message==='Startup observer replaced: warn'));
    assert.equal(console.warn,later);assert.equal(displaced.report().restored,false);
    for(let i=0;i<bindings.length;i++)assert.deepEqual(Object.getOwnPropertyDescriptor(...bindings[i]),before[i]);
} finally {Object.defineProperty(console,'warn',warnDescriptor);}
const absent=['render','compute'].map(type=>({type,present:false,allocated:0,offsets:[],pending:false,mapState:null}));
assert.equal(assessCleanupPools(absent,{measurementStarted:false}).idle,true);
assert.equal(assessCleanupPools(absent,{measurementStarted:true}).idle,false);
const idle=absent.map(p=>({...p,present:true,mapState:'unmapped'}));
assert.equal(assessCleanupPools(idle,{measurementStarted:true}).idle,true);
assert.equal(assessCleanupPools([idle[0],absent[1]],{measurementStarted:true}).idle,false);
assert.equal(assessCleanupPools([idle[0],absent[1]],{measurementStarted:false}).idle,true);
for(const mutation of [{allocated:2},{offsets:[['uid',0]]},{pending:true},{mapState:'pending'}])
    assert.equal(assessCleanupPools([{...idle[0],...mutation},idle[1]],{measurementStarted:false}).idle,false);
assert.equal(assessCleanupPools([{...absent[0],allocated:2},absent[1]],{measurementStarted:false}).idle,false);
assert.throws(()=>assessCleanupPools(absent,{}),/Explicit measurement/);
assert.throws(()=>assessCleanupPools(absent.slice(0,1),{measurementStarted:false}),/Both pool types/);
console.log(JSON.stringify({groups:7,nativeNodeBuildBaseline:expected,rejectedV3NodeBuild:red,nativeClassAndConsolePassThrough:true,nativeZeroIndexSubmissionWithModeledEncoder:true,
    exactRestorationAndLaterOwnerRefusal:true,premeasurementAbsenceBoundary:true,pendingAndContradictoryOwnershipRejected:true,
    scope:'CPU observer and cleanup checks only; no browser/GPU or warning-source verdict.'}));
