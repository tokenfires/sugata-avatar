import { PassNode } from 'three/webgpu';
import { captureDrawState, restoreDrawState } from './RenderParticipants.js';

/** The Stage owns this pass; receipt hooks are independent of NodeFrame's cache policy. */
export class StageScenePass extends PassNode {
    static get type() { return 'StageScenePass'; }
    constructor(stage) { super(PassNode.COLOR, stage.scene, stage.camera); this.stageOwner = stage; }
    updateBefore(frame) {
        const stage = this.stageOwner, owner = stage.renderParticipants;
        // Preserve original no-participant successful path; direct-pass failures still restore entry state.
        const entry = captureDrawState(stage);
        let receipt, ended = false;
        try {
            receipt = owner.mainPassBegin(this, frame);
            const result = super.updateBefore(frame);
            ended = true; owner.mainPassEnd(receipt, null);
            return result;
        } catch (error) {
            const cleanup = [];
            try { if (!ended) owner.mainPassEnd(receipt, error); } catch (e) { cleanup.push(e); }
            cleanup.push(...restoreDrawState(entry));
            if (cleanup.length) throw new AggregateError([error, ...cleanup], 'Stage scene failed and cleanup reported errors.', {cause: error});
            throw error;
        }
    }
}
