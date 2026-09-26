// Narrow measurement admission for the unchanged, source-bound Wardrobe workload.
// These observed dependency diagnostics are retained, never suppressed or called harmless.
import {STARTUP_FIXTURE as fixture} from './startup-workload-fixture.mjs';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const STARTUP_SOURCE_PINS=Object.freeze({...fixture.sourcePins});

function assessInitial({pageName,warnings,ready,sourceHashes},retired) {
    requireThat(pageName===fixture.pageName,'Only the diagnosed default Wardrobe startup is admitted.');
    for(const [file,hash] of Object.entries(STARTUP_SOURCE_PINS))requireThat(sourceHashes?.[file]===hash,'Undiagnosed dependency bytes: '+file);
    requireThat(Array.isArray(warnings) && warnings.length===4,'Require exactly four observed startup warnings.');
    warnings.forEach((w,i)=>{
        requireThat(w.type==='console-warning' && w.phase==='original-page-startup','Warning outside original startup.');
        requireThat(w.message===fixture.messages[i],'Unexpected startup warning text/order at '+i);
    });
    const diagnostic=ready.startupDiagnostic;
    requireThat(diagnostic?.restored===retired && ready.native.nodeCaptureStackTrace===!retired,'Startup observation ownership does not match its declared phase.');
    requireThat(equal(ready.native.figure,{missingHumanoidBones:['jaw','eyeLeft','eyeRight'],bonesByRigName:53}),'Missing-bone witness changed.');
    requireThat(equal(ready.native.hairUniforms,{kinematic:0,ftlEnabled:1}),'Native shader branch uniforms changed.');
    requireThat(diagnostic.warnings.length===3,'Require exactly three raw JS warnings.');
    for(const [i,browserIndex] of [0,2,3].entries()) {
        const js=diagnostic.warnings[i];
        requireThat(equal(js.arguments,[warnings[browserIndex].message]),'Raw JS/browser warning mismatch.');
        requireThat(typeof js.emissionStack==='string' && (i===0
            ? /Figure\.buildBoneIndex .*\/Figure\.js:423:21\)/.test(js.emissionStack)
            : /ConditionalNode\.generate /.test(js.emissionStack)),'Missing native warning emission witness.');
        if(i>0)requireThat(js.arguments[0].includes(`(HairDynamics.js:${i===1?770:778}:13)`),'Wrong native TSL creation site.');
    }
    requireThat(equal(ready.census.meshes,fixture.meshes),'Actual complete default mesh/material/draw census changed.');
    const draws=diagnostic.zeroIndexDraws;
    requireThat(Array.isArray(draws) && draws.length>0,'Native zero-index submissions were not observed.');
    for(const d of draws)validateZeroDraw(d);
    return {admitted:true,referenceReportSHA256:fixture.reportSHA256,sourcePins:STARTUP_SOURCE_PINS,
        browserWarnings:4,rawJSWarnings:3,tslSites:['HairDynamics.js:770:13','HairDynamics.js:778:13'],
        zeroIndexSubmissions:draws.length,scope:'Exact observed startup diagnostics retained for unchanged-workload measurement; no warning-harmlessness or hair-quality verdict.'};
}

function validateZeroDraw(d) {
        requireThat(d.mesh==='garment_foundation_briefs' && d.indexCount===37494 &&
            equal(d.drawRange,{start:0,count:0}) &&
            equal(d.drawParameters,{vertexCount:0,firstVertex:0,instanceCount:1,firstInstance:0}),
            'Unattributed zero-index submission.');
        requireThat(equal(d.material,{name:'ShadowMaterial',type:'NodeMaterial'}) ||
            equal(d.material,{name:'foundation_briefs',type:'MeshStandardMaterial'}),'Unexpected zero-index material.');
        requireThat(typeof d.callStack==='string' && d.callStack.includes('WebGPUBackend.draw '),'Missing native draw witness.');
    
}

export function assessStartup(input) {return assessInitial(input,true);}
export function assessCompilationWarmup({pageName,warnings,ready,warm,sourceHashes}) {
    requireThat(Array.isArray(warnings) && warnings.length===6,'Require exactly six source-attributed warnings before measurement.');
    const admission=assessInitial({pageName,warnings:warnings.slice(0,4),ready,sourceHashes},false);
    requireThat(warm.step===8 && warm.startupEvidence?.restored===true && warm.checkpoint?.native.nodeCaptureStackTrace===false,'First8 tracing steps must retire before measurement.');
    const diagnostic=warm.startupEvidence;
    requireThat(diagnostic.warnings.length===5,'Require exactly five raw JS warning witnesses.');
    for(let i=0;i<5;i++) {
        const js=diagnostic.warnings[i],initial=i<3,browserIndex=[0,2,3,4,5][i];
        requireThat(equal(js.arguments,[warnings[browserIndex].message]),'Raw JS/browser warning mismatch.');
        requireThat(equal(js.context,{phase:initial?'original-page-startup':'unmeasured-traced-warmup',step:initial?0:1}),'Unexpected JS warning phase or step.');
        if(initial)requireThat(equal(js,ready.startupDiagnostic.warnings[i]),'Initial warning witness mutated.');
        else {
            const w=warnings[browserIndex];requireThat(w.type==='console-warning' && w.phase==='unmeasured-traced-warmup-step-1' && w.message===fixture.messages[i-1],'Unexpected compile-warm warning source/count/phase.');
            requireThat(/ConditionalNode\.generate /.test(js.emissionStack) && w.message.includes(`(HairDynamics.js:${i===3?770:778}:13)`),'Wrong native compile-warm warning origin.');
        }
    }
    for(const d of diagnostic.zeroIndexDraws)requireThat(equal(d.context,{phase:'original-page-startup',step:0}) ||
        (d.context?.phase==='unmeasured-traced-warmup' && Number.isSafeInteger(d.context.step) && d.context.step>=1 && d.context.step<=8),'Draw witness outside tracing window.');
    // Reuse the exact draw identity checks without replacing actual observation metadata.
    requireThat(equal(warm.checkpoint.census.meshes,ready.census.meshes),'Warmup full census changed.');
    for(const d of diagnostic.zeroIndexDraws)validateZeroDraw(d);
    requireThat(diagnostic.zeroIndexDraws.length>ready.startupDiagnostic.zeroIndexDraws.length,'Require retained initial and warmup draw observations.');
    ready.startupDiagnostic.zeroIndexDraws.forEach((d,i)=>requireThat(equal(d,diagnostic.zeroIndexDraws[i]),'Initial draw observations changed.'));
    assessWarmWorkload(ready,warm.checkpoint,{updates:8});
    return {...admission,referenceWarmupReportSHA256:'17ece5d26cb808b762472a2e5d6bb4e4978ff05166e0867d69963078c9ce9d3e',browserWarnings:6,rawJSWarnings:5,traceSteps:8,
        zeroIndexSubmissions:diagnostic.zeroIndexDraws.length,scope:'Only these exact source/phase/count compilation diagnostics precede measurement. No late warnings admitted; no harmlessness claim.'};
}

export function assessWarningBoundary(warnings,startupWarnings) {
    requireThat(equal(warnings,startupWarnings),'New, changed or late warning; measurement rejected.');
    return {unchanged:true,count:warnings.length,scope:'No warnings added after admitted startup.'};
}

export function assessWarmWorkload(initial,current,{updates}) {
    requireThat(Number.isSafeInteger(updates) && updates>=8 && updates<=840,'Only bounded native workload checkpoints are admitted.');
    requireThat(equal(current.census.meshes,initial.census.meshes) && equal(current.census.meshes,fixture.meshes),'Warmed mesh/material/draw census changed.');
    requireThat(equal(current.native.figure,initial.native.figure) && equal(current.native.hairUniforms,{kinematic:0,ftlEnabled:1}) &&
        current.native.nodeCaptureStackTrace===false,'Native startup state/observation changed.');
    const a=initial.report.hair,h=current.report.hair;
    for(const key of ['style','loadedStyle','bake','unavailableReason','attached','meshes','oit','stageReportsOit','velocityRepaired','bodyContact','bodyContactUnavailableReason'])
        requireThat(equal(h[key],a[key]),'Default hair workload changed: '+key);
    requireThat(h.attached && h.style==='bob02' && h.solver.chains===496 && h.solver.particles===8432,'Incomplete native groom workload.');
    requireThat(Number.isSafeInteger(a.solver.steps) && h.solver.steps-a.solver.steps===updates*2 &&
        current.native.substepSeconds===1/120 && current.native.computeCallsLastFrame===1,'Native solver progression/submission changed.');
    const history=h.history,frame=h.cardFrame,commitsDelta=history.commits-a.history.commits;
    requireThat(history.live===true && history.valid===true && history.mode==='exact' && history.reason===null && history.lastDraw?.mode==='exact',
        'No valid current exact beauty history after normal warmup.');
    // Native CardRenderHistory commits once per successful fresh main pass. Every public
    // step in this fixed workload must render one; do not guess a raw startup draw count.
    requireThat(commitsDelta===updates && history.cachedDraws===a.history.cachedDraws && history.invalidations===a.history.invalidations,
        'Missing fresh beauty commits or unexpected cached/invalidated history.');
    requireThat(history.lastDraw.source.ready===true && history.lastDraw.source.rawComputeUsed===false &&
        history.lastDraw.source.reset===history.lastDraw.source.builtReset,'Unready or raw-compute card history.');
    requireThat(frame.live===true && frame.available===true && frame.mode==='smooth' && frame.reason===null && equal(frame.layout,a.cardFrame.layout),
        'Actual smooth card draw was not observed.');
    return {admitted:true,updates,solverStepsInitial:a.solver.steps,solverStepsCurrent:h.solver.steps,solverStepsDelta:h.solver.steps-a.solver.steps,
        commitsInitial:a.history.commits,commitsCurrent:history.commits,commitsDelta,historyMode:history.mode,cardFrameMode:frame.mode,
        scope:'Native workload/draw progression only; appearance still needs the end plate, and no hair correctness or performance budget is certified.'};
}
