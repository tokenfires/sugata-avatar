/** Optional authored nod study. No camera/gaze/idle/smile leases and no inferred emotion. */
import { Quaternion, Vector3 } from 'three';
import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { toBoneDeltaFrame } from './Breath.js';

// Artist choices, not measured population constants. Positive rig X tips forward/down.
export const NOD_DESIGN = Object.freeze({ downAt: .32, reboundAt: .78, endAt: 1.15,
    downDegrees: 12, reboundDegrees: -1.5, cancelSeconds: .18 });
const RAD = Math.PI / 180;
const X = new Vector3(1, 0, 0);
const ease = u => { u = Math.max(0, Math.min(1, u)); return u ** 3 * (u * (u * 6 - 15) + 10); };
export function nodPitch(time) {
    if (!Number.isFinite(time) || time < 0) throw new RangeError('Nod time must be finite and nonnegative.');
    const d = NOD_DESIGN;
    if (time <= d.downAt) return d.downDegrees * ease(time / d.downAt);
    if (time <= d.reboundAt) return d.downDegrees + (d.reboundDegrees - d.downDegrees) * ease((time - d.downAt) / (d.reboundAt - d.downAt));
    if (time < d.endAt) return d.reboundDegrees * (1 - ease((time - d.reboundAt) / (d.endAt - d.reboundAt)));
    return 0;
}

export class AcknowledgmentNod extends Layer {
    constructor(avatar) {
        // After gaze's head orientation and before eye/VOR prediction. Addition, not priority.
        super({name: 'acknowledgmentNod', order: MOTION_ORDER.HEAD + 50, boneChannels: ['head']});
        this.avatar = avatar;
        this.disposed = false;
        this.phase = 'idle'; this.time = 0; this.pitchDegrees = 0;
        this.lastStop = null; this.boundHead = null;
        this.restFrame = new Quaternion(); this.rigDelta = new Quaternion(); this.localDelta = new Quaternion();
        this.readyFrame();
        try { avatar.stack.add(this); }
        catch (error) { this.dispose(); throw error; }
    }
    readyFrame() {
        const stack = this.avatar?.stack, gaze = this.avatar?.layers?.gaze;
        const head = stack?.target?.getBone('head');
        // Gaze owns this cached full rest frame, measured on bind, not from a live posed head.
        const rest = gaze?.head?.boneAxes?.get('head')?.rest;
        if (this.disposed || !stack?.target || !head || !stack.restRotationOf('head') ||
            gaze?.stack !== stack || gaze?.head?.stack !== stack || gaze.headBone !== head ||
            !gaze.enabled || !gaze.head.enabled || !rest?.isQuaternion ||
            !rest.toArray().every(Number.isFinite) || Math.abs(rest.lengthSq() - 1) > 1e-6)
            throw new Error('Nod needs the active bound head/gaze rest frame.');
        return {stack, head, rest};
    }
    nod() {
        const {stack, head, rest} = this.readyFrame();
        if (this.stack !== stack || !this.enabled || stack.findLayer(this.name) !== this)
            throw new Error('Enable the installed nod control first.');
        if (this.phase !== 'idle') return false; // Busy repeats preserve the current trajectory.
        this.restFrame.copy(rest); this.boundHead = head;
        this.time = 0; this.pitchDegrees = 0; this.phase = 'nodding'; this.lastStop = null;
        return true;
    }
    cancel({immediate = false} = {}) {
        if (immediate) { this.retire('cancelled'); return; }
        if (this.phase !== 'nodding') return;
        this.cancelPitch = this.pitchDegrees; this.time = 0; this.phase = 'cancelling';
    }
    update(dt) {
        if (this.phase === 'idle') return null;
        if (!Number.isFinite(dt) || dt < 0) { this.retire('invalid-delta'); return null; }
        let current;
        try { current = this.readyFrame(); }
        catch { this.retire('owner-unavailable'); return null; }
        if (current.stack !== this.stack || current.head !== this.boundHead || current.rest.angleTo(this.restFrame) > 1e-7) {
            this.retire('binding-changed'); return null;
        }
        this.time += dt;
        if (this.phase === 'cancelling') {
            if (this.time >= NOD_DESIGN.cancelSeconds) { this.retire('cancelled'); return null; }
            this.pitchDegrees = this.cancelPitch * (1 - ease(this.time / NOD_DESIGN.cancelSeconds));
        } else {
            if (this.time >= NOD_DESIGN.endAt) { this.retire('finished'); return null; }
            this.pitchDegrees = nodPitch(this.time);
        }
        this.rigDelta.setFromAxisAngle(X, this.pitchDegrees * RAD);
        toBoneDeltaFrame(this.rigDelta, this.restFrame, this.localDelta);
        this.contribution.rotateBone('head', this.localDelta);
        return this.contribution;
    }
    retire(reason) {
        this.phase = 'idle'; this.time = 0; this.pitchDegrees = 0; this.cancelPitch = 0;
        this.boundHead = null; this.lastStop = reason;
        this.contribution.clear();
    }
    onBind() { this.retire('bound'); }
    reset() { this.retire('reset'); }
    onDisabledFrame() { this.retire('disabled'); }
    report() { return {phase: this.phase, time: this.time, pitchDegrees: this.pitchDegrees,
        lastStop: this.lastStop, enabled: this.enabled, disposed: this.disposed}; }
    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.retire('disposed');
        this.stack?.remove(this); // remove clears stack before its idempotent dispose callback.
    }
}
