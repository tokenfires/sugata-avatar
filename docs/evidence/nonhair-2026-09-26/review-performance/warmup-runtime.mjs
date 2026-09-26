// Explicitly UNMEASURED diagnostic. Native page/controls/steps; no timestamp observers.
import {Node} from 'three/webgpu';
import {installStartupDiagnostics} from './startup-diagnostics.mjs';
import {captureOrbitState,createOrbitReplay,assertOrbitEqual} from './orbit-replay.mjs';
import {assessWarmWorkload} from './startup-policy.mjs';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
let view,avatar,stage,observer,replay,initial,expectedOrbit,step=0,phase='before-startup',failure=null;
const records=[],checkpoints=[];
function census(){
    const meshes=[];stage.scene.traverse(o=>{if(o.isMesh){const g=o.geometry;meshes.push({name:o.name,visible:o.visible,vertices:g.attributes.position?.count??null,
        indices:g.index?.count??null,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'},groups:g.groups.map(x=>({...x})),
        materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,type:m.type,visible:m.visible}))});}});
    return {meshes,memory:{...stage.renderer.info.memory}};
}
function workload(){
    const report=avatar.report();
    requireThat(report.identity.bake==='figure_g050' && report.identity.gender===.5 && report.motion.seed===20260807 && report.scene.id==='studio','Unexpected native identity/scene.');
    requireThat(report.quality.backend==='webgpu' && report.quality.tier==='balanced' && report.quality.requested==='balanced' && !report.quality.backendMismatch,'Unexpected native backend/tier.');
    requireThat(report.framing.mode==='body' && report.wardrobe.appearance.style==='ecru' && report.wardrobe.pendingCandidates===0 &&
        JSON.stringify([...report.wardrobe.state.worn].sort())===JSON.stringify(['female_casualsuit01','foundation_bra','foundation_briefs','shoes01']),'Unexpected actual full outfit.');
    requireThat(report.hair.attached && report.hair.style==='bob02' && report.hair.loadedStyle==='bob02' && view.attention.phase==='idle','Unexpected hair/attention state.');
    requireThat(document.visibilityState==='visible' && !matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('#pause').getAttribute('aria-pressed')==='false','Unexpected pause/visibility.');
    return {report,census:census(),native:{figure:{missingHumanoidBones:[...avatar.figure.missingHumanoidBones],bonesByRigName:avatar.figure.bonesByRigName.size},
        hairUniforms:{kinematic:avatar.hairDynamics.uniforms.kinematic.value,ftlEnabled:avatar.hairDynamics.uniforms.ftlEnabled.value},
        substepSeconds:avatar.hairDynamics.substepSeconds,computeCallsLastFrame:avatar.hairDynamics.computeCallsLastFrame,nodeCaptureStackTrace:Node.captureStackTrace}};
}

export async function begin({pageName,sourceHashes}) {
    requireThat(pageName==='showcase' && !avatar && new URLSearchParams(location.search).has('capture'),'Only one default captured Wardrobe diagnostic.');
    phase='original-page-startup';observer=installStartupDiagnostics({context:()=>({phase,step})});
    try {
        await import('/src/showcase.js');view=window.showcase;avatar=view?.avatar;stage=avatar?.stage;
        requireThat(avatar && !avatar.disposed && stage.renderer.backend.isWebGPUBackend===true,'Original page did not become ready.');
        requireThat(stage.renderer.backend.trackTimestamp===false,'Unmeasured diagnostic requires native default timestamp-disabled Stage.');
        initial=workload();const orbit=captureOrbitState(view.controls);replay=createOrbitReplay(orbit,{sourceHashes});expectedOrbit=orbit;
        phase='ready-unmeasured';
        return {pageName,...initial,orbit,measurementCompleted:false,profiling:'Native default trackTimestamp=false; no timing/query observers.',
            scope:'Original startup plus20 normal public steps, all unmeasured. Native node traces remain enabled only through step8.'};
    } catch(error){failure=String(error.stack??error);throw error;}
}

export async function advance() {
    requireThat(avatar && !failure && step<20,'Invalid diagnostic advance.');
    const row={step:++step,dt:1/60,measured:false};records.push(row);phase=step<=8?'unmeasured-traced-warmup':'unmeasured-after-trace';
    try {
        row.before=captureOrbitState(view.controls);row.clockBefore=avatar.clockSeconds;row.frameBefore=avatar.stack.frame;
        assertOrbitEqual(row.before,expectedOrbit,'before public step'+step);
        // The original page performs framing.update(), controls.update() without dt, then
        // native Avatar.step(1/60), including queue/paint waits and attention reporting.
        await view.step(row.dt);
        row.after=captureOrbitState(view.controls);row.clockAfter=avatar.clockSeconds;row.frameAfter=avatar.stack.frame;
        row.expected=replay.step();assertOrbitEqual(row.after,row.expected.state,'public step'+step);expectedOrbit=row.expected.state;
        requireThat(row.clockAfter===row.clockBefore+row.dt && row.frameAfter===row.frameBefore+1,'Native clock/frame changed.');
        row.exactOrbitReplay=true;
        if(step===8){observer.restore();row.observerRestored=true;requireThat(Node.captureStackTrace===false,'Node trace flag not restored.');}
        if(step===8 || step===20){const current={updates:step,...workload()};checkpoints.push(current);current.assessment=assessWarmWorkload(initial,current,{updates:step});}
        requireThat(stage.renderer.backend.trackTimestamp===false,'Unexpected timestamp tracking.');
        return {step,exactOrbitReplay:true,observerRestored:observer.report().restored,checkpoint:checkpoints.at(-1)?.updates===step?checkpoints.at(-1):null};
    }catch(error){failure=String(error.stack??error);throw error;}
}

export function diagnostic(){return {completed:step===20 && !failure && observer.report().restored,measurementCompleted:false,phase,step,failure,
    initial,records,checkpoints,replay:replay?.report()??null,startupEvidence:observer?.report()??null,
    scope:'Unmeasured source/owner/warning diagnosis. No duration, steady-state, presentation, hair-quality or exclusive-system performance verdict.'};}

export async function finish(){
    const cleanupErrors=[];
    // Native Stage.dispose clears stage.renderer; retain its object for after-dispose census.
    const renderer=stage?.renderer??null;
    if(observer && !observer.report().restored)try{observer.restore();}catch(error){cleanupErrors.push(String(error.stack??error));}
    try{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));}catch(error){cleanupErrors.push(String(error.stack??error));}
    const memory=renderer?{...renderer.info.memory}:null;
    const result={cleanupErrors,disposed:avatar?.disposed??false,leaks:avatar?.leakedHandles()??null,memory,
        stageRendererCleared:stage?.renderer===null,avatarStageCleared:avatar?.stage===null,stageBackend:stage?.backendName??null,
        observerRestored:observer?.report().restored??false,nodeCaptureStackTrace:Node.captureStackTrace};
    result.completed=result.disposed && result.leaks.length===0 && memory!==null && Object.values(memory).every(n=>n===0) &&
        result.stageRendererCleared && result.avatarStageCleared && result.stageBackend==='disposed' && cleanupErrors.length===0 && result.observerRestored && Node.captureStackTrace===false;
    return result;
}
