import { Matrix4 } from 'three/webgpu';
import { Fn, instancedArray, instanceIndex, uniform, uint, float, vec2, vec4,
    vertexIndex, min, max, varying, select, mrt, velocity } from 'three/tsl';
import { requireSynchronous } from './RenderParticipants.js';

const owners = new WeakMap();
const sameState = (a,b) => a.write===b.write && a.reset===b.reset && a.builtReset===b.builtReset && a.ready===b.ready && a.rawComputeUsed===b.rawComputeUsed;
const sameMatrix = (a,b) => a.elements.every((x,i)=>Object.is(x,b.elements[i]));

/** One original-card snapshot committed only after an observed, successful TAAU beauty. */
export function createCardRenderHistory({stage,dynamics,mesh,material}) {
    if (owners.has(mesh)) throw Error('Card render history is already installed.');
    const renderer=stage.renderer,camera=stage.camera,scene=stage.scene;
    if (!dynamics?.borrowCardEdges || dynamics.disposed || renderer?._initialized!==true || !stage.registerRenderParticipant)
        throw Error('Card history requires initialized owned dynamics and Stage.');
    const oldMRT=material.mrtNode,oldBefore=mesh.onBeforeRender,oldAfter=mesh.onAfterRender;
    const geometry=mesh.geometry,positionNode=material.positionNode;
    let source=null,previous=null,copyNode=null,override=null,unregister=null,disposed=false,published=false,transaction=null;
    let commits=0,cachedDraws=0,invalidations=0,lastReason='awaiting first beauty',lastState=null,lastDraw=null,valid=false;
    let temporalSeen=stage.temporal,temporalEpoch=stage.temporal?.resetEpoch;
    let vertexCount=0,vertexBase=0,directLease=null;
    const directDraws=[];
    const currentMVP=uniform(new Matrix4()),previousMVP=uniform(new Matrix4()),mode=uniform(0),scratchMVP=new Matrix4();
    function live(){if(disposed || dynamics.disposed || !source?.live)throw Error('Card render history is retired.');}
    function invalidate(reason='explicit invalidation') {valid=false;mode.value=0;lastState=null;lastReason=reason;invalidations++;}
    function supported(){return stage.renderPipeline && stage.scenePass && stage.temporal?.mode==='taau' &&
        typeof stage.temporal.getUnjitteredProjection==='function' && stage.viewMode==='beauty' && renderer._initialized===true && !renderer.xr?.isPresenting;}
    function identity(){return !disposed && source?.live && stage.renderer===renderer && stage.camera===camera && stage.scene===scene &&
        mesh.geometry===geometry && material.positionNode===positionNode && mesh.material===material && material.mrtNode===override && mesh.onBeforeRender===before && mesh.onAfterRender===after;}
    function restoreDirectLease() {
        if(!directLease)return;
        directLease=null;
        // Preserve a material replacement made by an external callback.
        if(!disposed && material.mrtNode===oldMRT){material.mrtNode=override;material.needsUpdate=true;}
    }
    function borrowNativeMRT() {
        if(directLease && material.mrtNode===oldMRT){directLease.depth++;return directLease;}
        if(material.mrtNode!==override)return null;
        material.mrtNode=oldMRT;material.needsUpdate=true;
        return directLease={depth:1};
    }
    function releaseDraw(receipt) {
        const index=directDraws.lastIndexOf(receipt);
        if(index<0)return;
        // A caught nested failure may skip its after callback. Once the enclosing callback
        // returns, all such descendants are finished too; unwind them along with this receipt.
        const ended=directDraws.splice(index);
        for(let i=ended.length-1;i>=0;i--){
            const lease=ended[i].lease;
            if(lease && directLease===lease && --lease.depth===0)restoreDirectLease();
        }
    }
    function originalMaterialDraw(s,m){
        return m===material && !(material.allowOverride===true && s.overrideMaterial!=null);
    }
    function sourceReady(state){return state.ready && state.builtReset===state.reset && !state.rawComputeUsed;}
    function readable(){return !disposed && source?.live && valid && lastState && sourceReady(source.state()) && source.state().reset===lastState.reset;}
    function eligible(){
        if(!identity() || !supported())return false;
        return velocity.projectionMatrix===stage.temporal.getUnjitteredProjection();
    }
    function matrix(){
        scratchMVP.multiplyMatrices(stage.temporal.getUnjitteredProjection(),camera.matrixWorldInverse).multiply(mesh.matrixWorld);
        if(!scratchMVP.elements.every(Number.isFinite))throw Error('Card render history received a nonfinite MVP.');
        return scratchMVP;
    }
    function observed(r,s,c,m){return transaction?.inPass && r===renderer && s===scene && c===camera &&
        r.getRenderTarget()===stage.scenePass.renderTarget && m===material;}
    function before(r,s,c,g,m,group){
        // Every callback invocation gets a receipt, including shadows and nested MRT draws
        // that need no lease. An inner after callback must never consume its parent's lease.
        const receipt={r,s,c,g,group,lease:null};directDraws.push(receipt);
        try {
            requireSynchronous(oldBefore.call(this,r,s,c,g,m,group),'Groom before callback');
            const ownIndex=directDraws.lastIndexOf(receipt);
            if(ownIndex>=0 && directDraws.length>ownIndex+1)releaseDraw(directDraws[ownIndex+1]);
            if(!observed(r,s,c,m)){
                if(!disposed && originalMaterialDraw(s,m)){
                    invalidate('hold fallback: groom rendered outside owned beauty');
                    if(transaction)transaction.eligible=false;
                    if(!r.getMRT()?.has('velocity'))receipt.lease=borrowNativeMRT();
                }
                return;
            }
            if(!transaction.eligible || !eligible() || scene.overrideMaterial!==null || stage.scenePass.overrideMaterial!==null){
                transaction.eligible=false;invalidate('unsupported active beauty projection or material');return;
            }
            if(!sameState(transaction.state,source.state()))throw Error('Card source changed during beauty.');
            const value=matrix();
            if(transaction.before && !sameMatrix(value,currentMVP.value))throw Error('Multiple groom transforms in one beauty.');
            currentMVP.value.copy(value);mode.value=valid?2:1;transaction.before++;
        } catch(error) {releaseDraw(receipt);throw error;}
    }
    function after(r,s,c,g,m,group){
        const receipt=directDraws.at(-1);
        // Three passes the source material before a shadow draw and the override afterwards.
        const matches=receipt && receipt.r===r && receipt.s===s && receipt.c===c && receipt.g===g && receipt.group===group;
        try {
            requireSynchronous(oldAfter.call(this,r,s,c,g,m,group),'Groom after callback');
            if(!observed(r,s,c,m) || !transaction.eligible)return;
            if(!eligible() || !sameState(transaction.state,source.state()) || !sameMatrix(matrix(),currentMVP.value))
                throw Error('Card source or transform changed while rendering.');
            transaction.after++;
        } finally {if(matches)releaseDraw(receipt);}
    }
    const owner={
        get disposed(){return disposed;},
        begin(tx){
            // Renderer callbacks have no finally in r185. A failed direct draw may skip after;
            // its native lease is retired before the next owned image or on disposal.
            if(directLease || directDraws.length){restoreDirectLease();directDraws.length=0;invalidate('hold fallback: interrupted direct draw');}
            live();
            if(stage.temporal!==temporalSeen || stage.temporal?.resetEpoch!==temporalEpoch){invalidate('temporal epoch changed');temporalSeen=stage.temporal;temporalEpoch=stage.temporal?.resetEpoch;}
            const state=source.state();
            if(lastState && state.reset!==lastState.reset)invalidate('solver reset generation changed');
            transaction={stageTransaction:tx,state,epoch:tx.epoch,temporal:stage.temporal,temporalEpoch:stage.temporal?.resetEpoch,
                inPass:false,before:0,after:0,eligible:false};
            if(!supported())invalidate('hold fallback: unsupported render path');
            else if(!sourceReady(state))invalidate('hold fallback: source not ready');
        },
        mainPassBegin(receipt){
            if(!transaction)return;
            mode.value=0; transaction.inPass=true;
            transaction.eligible=receipt.pass===stage.scenePass && receipt.frame.renderer===renderer && receipt.transaction.passes===1 &&
                supported() && identity() && sourceReady(transaction.state);
            if(!transaction.eligible)invalidate('hold fallback: unsupported scene pass');
        },
        mainPassEnd(){if(transaction)transaction.inPass=false;},
        finish(tx){
            if(disposed)return;
            const t=transaction;transaction=null;
            if(!t)return;
            if(tx.passes===0 && t.before===0 && t.after===0){cachedDraws++;return;}
            if(tx.passes!==1 || tx.completedPasses!==1 || !t.eligible || t.before<1 || t.before!==t.after ||
                !identity() || tx.epoch!==stage.renderParticipants.epoch || t.temporal!==stage.temporal || t.temporalEpoch!==stage.temporal?.resetEpoch ||
                !sameState(t.state,source.state())){invalidate('fresh beauty was not a stable observed groom; reseed required');return;}
            lastDraw={mode:mode.value===2?'exact':'seeding',currentMVP:currentMVP.value.toArray(),previousMVP:previousMVP.value.toArray(),source:t.state};
            requireSynchronous(renderer.compute(copyNode),'Card history copy submission');
            live();if(!identity() || !sameState(t.state,source.state()))throw Error('Card source changed during history copy.');
            previousMVP.value.copy(currentMVP.value);lastState=t.state;valid=true;commits++;lastReason=null;
        },
        abort({error}){transaction=null;restoreDirectLease();directDraws.length=0;invalidate(error?.message || 'beauty aborted');},
        invalidate({reason}={}){invalidate(reason);},
        report(){return {requested:'auto',mode:disposed?'disposed':mode.value===2?'exact':mode.value===1?'seeding':'hold',reason:lastReason,
            live:!disposed,valid,commits,cachedDraws,invalidations,lastDraw,cardVertexBase:vertexBase,cardVertexCount:vertexCount,
            ownedHistoryBuffers:previous?1:0,paddedHistoryBytes:previous?vertexCount*16:0,caps:'native hold; exact cards only'};},
        async readPrevious(){
            live();if(!readable())throw Error('Card history readback unavailable before accepted seed or after invalidation/reset.');
            const epoch=commits,attribute=previous.value;
            const raw=new Float32Array(await renderer.getArrayBufferAsync(attribute));live();
            if(!readable() || epoch!==commits)throw Error('Card history readback epoch changed.');
            const data=new Float32Array(vertexCount*3);for(let i=0;i<vertexCount;i++)for(let k=0;k<3;k++)data[3*i+k]=raw[attribute.itemSize*i+k];
            return data;
        },
        dispose(){
            if(disposed)return;disposed=true;valid=false;mode.value=0;transaction=null;directLease=null;directDraws.length=0;lastReason='disposed';
            const errors=[],release=fn=>{try{fn();}catch(e){errors.push(e);}};
            release(()=>unregister?.());unregister=null;
            release(()=>{if(mesh.onBeforeRender===before)mesh.onBeforeRender=oldBefore;});
            release(()=>{if(mesh.onAfterRender===after)mesh.onAfterRender=oldAfter;});
            release(()=>{if(override && material.mrtNode===override){material.mrtNode=oldMRT;material.needsUpdate=true;}});
            release(()=>source?.release());release(()=>copyNode?.dispose());
            release(()=>{if(previous)renderer._attributes?.delete(previous.value);});
            source=null;previous=null;copyNode=null;owners.delete(mesh);
            if(errors.length)throw new AggregateError(errors,'Card history cleanup failed.');
        }
    };
    try{
        source=dynamics.borrowCardEdges(()=>owner.dispose());vertexCount=source.cardVertexCount;vertexBase=source.cardVertexBase;
        if(source.space!=='mesh-local' || !source.state || vertexCount!==2*source.chainCount*source.pointsPerChain ||
            mesh.geometry.attributes.position.count!==vertexBase+vertexCount)throw Error('Unexpected card cardinality or space.');
        const index=mesh.geometry.index;if(!index)throw Error('Indexed groom required.');
        for(let i=0;i<index.count;i+=3){let n=0;for(let k=0;k<3;k++)n+=index.getX(i+k)>=vertexBase?1:0;if(n!==0&&n!==3)throw Error('Mixed cap/card triangle.');}
        previous=instancedArray(vertexCount,'vec3');
        copyNode=Fn(()=>{previous.element(instanceIndex).assign(source.read(instanceIndex));})().compute(vertexCount).setName('committed card render history');
        const i=min(max(vertexIndex,uint(vertexBase)).sub(uint(vertexBase)),uint(vertexCount-1));
        const inCard=varying(select(vertexIndex.greaterThanEqual(uint(vertexBase)).and(vertexIndex.lessThan(uint(vertexBase+vertexCount))),float(1),float(0)),'cardRenderHistoryMask');
        const currentClip=varying(currentMVP.mul(vec4(source.read(i),1)),'cardRenderHistoryCurrentClip');
        const previousClip=varying(previousMVP.mul(vec4(previous.element(i),1)),'cardRenderHistoryPreviousClip');
        const exact=currentClip.xy.div(currentClip.w).sub(previousClip.xy.div(previousClip.w));
        const existingVelocity=oldMRT?.get('velocity') || velocity;
        const cardVelocity=select(mode.greaterThan(1.5),exact,select(mode.greaterThan(.5),vec2(0),existingVelocity));
        override=mrt({...oldMRT?.outputNodes,velocity:select(inCard.greaterThan(.5),cardVelocity,existingVelocity)});
        if(oldMRT)override.blendModes={...oldMRT.blendModes};
        unregister=stage.registerRenderParticipant(owner);
        material.mrtNode=override;material.needsUpdate=true;mesh.onBeforeRender=before;mesh.onAfterRender=after;
        published=true;owners.set(mesh,owner);return owner;
    }catch(error){try{owner.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Card history construction failed.',{cause:error});}throw error;}
}
