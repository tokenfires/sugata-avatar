import { Color } from 'three/webgpu';
import { velocity } from 'three/tsl';

const METHODS = ['begin', 'mainPassBegin', 'mainPassEnd', 'finish', 'abort', 'invalidate', 'dispose'];
export function requireSynchronous(value, label) {
    if (value && typeof value.then === 'function') {
        Promise.resolve(value).catch(() => {});
        throw new Error(`${label} must be synchronous.`);
    }
    return value;
}
export function captureDrawState(stage) {
    const r = stage.renderer, c = stage.camera, s = stage.scene;
    const lighting = r.lighting, lightsNode = lighting?.getNode(s), defaultLights = lighting?.getNode({});
    const shadowLayers=[];s.traverse(object=>{if(object.isLight && object.shadow?.camera)shadowLayers.push([object.shadow.camera,object.shadow.camera.layers.mask]);});
    return { renderer: r, camera: c, scene: s, target: r.getRenderTarget(), mrt: r.getMRT(),
        cubeFace: r.getActiveCubeFace?.(), mip: r.getActiveMipmapLevel?.(),
        renderObjectOverride: r.getRenderObjectFunction?.(), clearColor: r.getClearColor?.(new Color()), clearAlpha: r.getClearAlpha?.(),
        rendererPixelRatio: r.getPixelRatio?.(), scissorTest: r.getScissorTest?.(), toneMappingExposure: r.toneMappingExposure,
        background: s.background, backgroundNode: s.backgroundNode, shadowLayers,
        toneMapping: r.toneMapping, outputColorSpace: r.outputColorSpace, xr: r.xr.enabled,
        autoClear: r.autoClear, transparent: r.transparent, opaque: r.opaque, contextNode: r.contextNode,
        overrideMaterial: s.overrideMaterial, sceneName: s.name, layerMask: c.layers.mask,
        view: c.view, viewFields: c.view ? {...c.view} : null,
        projection: c.projectionMatrix.clone(), projectionInverse: c.projectionMatrixInverse.clone(),
        velocityProjection: velocity.projectionMatrix, lighting, lightsNode, defaultLights,
        lightStack: lighting?._cache.slice(), sceneLights: lightsNode?.getLights(), defaultLightsValue: defaultLights?.getLights(),
        // r185 _renderScene has no finally around object callbacks. These are entry bookkeeping,
        // not node FRAME caches: failed cached images remain refused until a real fresh scene.
        callDepth: r._callDepth, renderContext: r._currentRenderContext,
        renderObjectFunction: r._currentRenderObjectFunction, handleObjectFunction: r._handleObjectFunction,
        renderId: r._nodes?.nodeFrame?.renderId };
}
export function restoreDrawState(entry) {
    const r = entry.renderer, c = entry.camera, s = entry.scene, errors = [];
    const restore = fn => { try { fn(); } catch (error) { errors.push(error); } };
    restore(() => r.setRenderTarget(entry.target, entry.cubeFace, entry.mip));
    restore(() => r.setMRT(entry.mrt));
    restore(() => r.setRenderObjectFunction?.(entry.renderObjectOverride));
    restore(() => { if(entry.clearColor)r.setClearColor(entry.clearColor,entry.clearAlpha); });
    restore(() => { if(entry.rendererPixelRatio!==undefined)r.setPixelRatio(entry.rendererPixelRatio); });
    restore(() => { if(entry.scissorTest!==undefined)r.setScissorTest(entry.scissorTest); });
    restore(() => { r.toneMappingExposure = entry.toneMappingExposure; r.toneMapping = entry.toneMapping; r.outputColorSpace = entry.outputColorSpace;
        r.xr.enabled = entry.xr; r.autoClear = entry.autoClear; r.transparent = entry.transparent;
        r.opaque = entry.opaque; r.contextNode = entry.contextNode; });
    restore(() => { s.background=entry.background; s.backgroundNode=entry.backgroundNode;
        for(const [camera,mask] of entry.shadowLayers)camera.layers.mask=mask;
        s.overrideMaterial = entry.overrideMaterial; s.name = entry.sceneName; c.layers.mask = entry.layerMask;
        c.view = entry.view; if (c.view) Object.assign(c.view, entry.viewFields);
        c.projectionMatrix.copy(entry.projection); c.projectionMatrixInverse.copy(entry.projectionInverse);
        velocity.setProjectionMatrix(entry.velocityProjection); });
    restore(() => { if (entry.lighting) {
        entry.lighting._cache.splice(0, entry.lighting._cache.length, ...entry.lightStack);
        entry.lightsNode.setLights(entry.sceneLights); entry.defaultLights.setLights(entry.defaultLightsValue);
    } });
    restore(() => { r._callDepth = entry.callDepth; r._currentRenderContext = entry.renderContext;
        r._currentRenderObjectFunction = entry.renderObjectFunction; r._handleObjectFunction = entry.handleObjectFunction;
        if (r._nodes?.nodeFrame) r._nodes.nodeFrame.renderId = entry.renderId; });
    return errors;
}

/** Stage-owned synchronous beauty receipts; a cached redraw never means a new image. */
export class RenderParticipants {
    constructor(stage) { this.stage = stage; this.clients = new Set(); this.transaction = null;
        this.epoch = 0; this.failedImage = false; this.disposed = false; }
    register(client) {
        if (this.disposed) throw new Error('Stage render participants are disposed.');
        if (this.transaction) throw new Error('Cannot register a render participant during Stage.draw.');
        for (const key of METHODS) if (typeof client[key] !== 'function') throw new TypeError(`Render participant requires ${key}().`);
        if (this.clients.has(client)) throw new Error('Render participant is already registered.');
        this.clients.add(client);
        // Removal is always allowed, including during callbacks and disposal.
        return () => this.clients.delete(client);
    }
    notify(method, context, collect = false) {
        const errors = [];
        for (const client of [...this.clients]) {
            if (!this.clients.has(client)) continue;
            try { requireSynchronous(client[method](context), `Render participant ${method}`); }
            catch (error) { if (!collect) throw error; errors.push(error); }
        }
        return errors;
    }
    invalidate(reason) {
        this.epoch++;
        const errors = this.notify('invalidate', {reason, epoch: this.epoch}, true);
        if (errors.length) throw new AggregateError(errors, 'Render participant invalidation failed.');
    }
    draw(render) {
        if (this.disposed) throw new Error('Stage render participants are disposed.');
        if (this.transaction) throw new Error('Stage.draw cannot reenter a render transaction.');
        if (this.clients.size === 0 && !this.failedImage) return render();
        const entry = captureDrawState(this.stage);
        const tx = { stage: this.stage, epoch: this.epoch, passes: 0, completedPasses: 0, inPass: false, failedImage: this.failedImage };
        this.transaction = tx;
        try {
            this.notify('begin', tx);
            const result = requireSynchronous(render(), 'Stage beauty submission');
            if (this.failedImage && tx.passes === 0) throw new Error('Stage.draw requires a fresh scene after a failed image; cached output is unavailable.');
            this.notify('finish', tx);
            if (tx.passes === 1 && tx.completedPasses === 1) this.failedImage = false;
            return result;
        } catch (error) {
            this.failedImage = true;
            const cleanup = this.notify('abort', { ...tx, error }, true);
            try { this.stage.temporal?.resetFrameEpoch(); } catch (e) { cleanup.push(e); }
            cleanup.push(...restoreDrawState(entry));
            if (cleanup.length) throw new AggregateError([error, ...cleanup], 'Stage image failed and cleanup reported errors.', {cause: error});
            throw error;
        } finally { this.transaction = null; }
    }
    mainPassBegin(pass, frame) {
        const tx = this.transaction;
        if (!tx) {
            this.invalidate('Scene pass executed outside Stage.draw');
            return {direct: true, pass, frame};
        }
        tx.passes++; tx.inPass = true;
        const receipt = { ...tx, transaction: tx, pass, frame, direct: false };
        this.notify('mainPassBegin', receipt);
        return receipt;
    }
    mainPassEnd(receipt, error) {
        if (receipt?.direct) {
            if (error) { this.failedImage = true; this.stage.temporal?.resetFrameEpoch(); }
            return;
        }
        if (!receipt) return;
        const tx = receipt.transaction;
        tx.inPass = false;
        if (!error) tx.completedPasses++;
        this.notify('mainPassEnd', { ...receipt, error });
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        const errors = this.notify('dispose', undefined, true);
        this.clients.clear(); this.transaction = null;
        if (errors.length) throw new AggregateError(errors, 'Stage render participant disposal failed.');
    }
}
