import assert from 'node:assert/strict';
import {Node,StackNode,ConditionalNode,WebGPUBackend} from 'three/webgpu';
import {bool} from 'three/tsl';
import {installStartupDiagnostics,assessCleanupPools} from './startup-diagnostics.mjs';
const bindings=[[Node,'captureStackTrace'],[StackNode.prototype,'If'],[StackNode.prototype,'ElseIf'],[ConditionalNode.prototype,'generate'],[WebGPUBackend.prototype,'_draw']];
const before=bindings.map(([o,k])=>Object.getOwnPropertyDescriptor(o,k));
const warnDescriptor=Object.getOwnPropertyDescriptor(console,'warn'),forwarded=[];
Object.defineProperty(console,'warn',{...warnDescriptor,value:(...args)=>{forwarded.push(args);}});
try {
    const observer=installStartupDiagnostics();
    try {
        const node=new Node();assert.equal(node.stackTrace.isStackTrace,true);
        const stack=new StackNode();assert.equal(stack.If(bool(true),()=>{}),stack);
        const conditional=stack._currentCond;
        conditional.getNodeType=()=> 'float';
        const builder={getDataFromNode(received){assert.equal(received,conditional);console.warn('Synthetic builder warning',17);return {nodeProperty:'unchanged-native-result'};}};
        assert.equal(conditional.generate(builder,'float'),'unchanged-native-result');
        const report=observer.report();assert.equal(report.warnings.length,1);
        assert.deepEqual(forwarded,[['Synthetic builder warning',17]]);
        assert.equal(report.warnings[0].conditional.id,conditional.id);
        assert.match(report.warnings[0].conditional.creation.callStack,/Native StackNode.If creation/);
        assert.match(report.warnings[0].conditional.buildStack,/Native ConditionalNode.generate/);
        assert.match(report.warnings[0].emissionStack,/Native warning emission/);
        assert.ok(Array.isArray(report.warnings[0].conditional.nodeStack));
        const nativeFailure=Error('native builder failed');
        assert.throws(()=>conditional.generate({getDataFromNode(){throw nativeFailure;}},'float'),e=>e===nativeFailure);
        // Execute actual native _draw with a modeled encoder, not a browser/GPU.
        const index={array:new Uint16Array([0,1,2]),count:3},draws=[],updates=[];
        const object={name:'hidden-foundation',parent:null},material={name:'cloth',type:'MeshStandardNodeMaterial'};
        const ro={object,material,context:{},geometry:{id:7,index,drawRange:{start:0,count:0}},camera:{name:'test-camera',type:'PerspectiveCamera'},getIndex:()=>index,getIndirect:()=>null};
        const encoder={setPipeline(){},setIndexBuffer(){},drawIndexed(...a){draws.push(a);}};
        const params={vertexCount:0,instanceCount:1,firstVertex:0};
        const result=WebGPUBackend.prototype._draw.call({get:()=>({buffer:'modeled-buffer'})},ro,{update(...a){updates.push(a);}}, {},'modeled-pipeline',[],[],params,encoder,{bindingGroups:[],attributes:[]});
        assert.equal(result,undefined);assert.deepEqual(draws,[[0,1,0,0,0]]);assert.deepEqual(updates,[[object,0,1]]);
        const zero=observer.report().zeroIndexDraws;assert.equal(zero.length,1);assert.equal(zero[0].mesh,object.name);
        assert.deepEqual(zero[0].drawParameters,params);assert.equal(zero[0].drawRange.count,0);assert.equal(zero[0].indexCount,3);
    } finally {observer.restore();}
    assert.equal(observer.report().restored,true);
    for(let i=0;i<bindings.length;i++)assert.deepEqual(Object.getOwnPropertyDescriptor(...bindings[i]),before[i]);
    assert.throws(()=>observer.restore(),/already restored/);
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
console.log(JSON.stringify({groups:4,nativeClassPassThroughAndExactRestoration:true,nativeZeroIndexSubmissionWithModeledEncoder:true,premeasurementAbsenceBoundary:true,pendingAndContradictoryOwnershipRejected:true,
    scope:'CPU observer and cleanup-boundary checks only; no browser/GPU or warning-source verdict.'}));
