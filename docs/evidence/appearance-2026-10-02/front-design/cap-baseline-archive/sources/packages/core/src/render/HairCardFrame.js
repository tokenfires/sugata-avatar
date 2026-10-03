import { float, uint, uniform, vertexIndex, min, max, vec4, varying, modelViewMatrix } from 'three/tsl';
import { installHairCardFrame } from '../material/HairMaterial.js';

const owners = new WeakMap();

export class UnsupportedHairCardFrameLayoutError extends Error {}

/** Validate the actual atlas and indexed cap/card separation before borrowing a GPU frame. */
export function inspectCardFrameLayout( geometry, source ) {
    const { cardVertexBase: base, cardVertexCount: count, pointsPerChain: rings, chainCount: cards } = source;
    const uv = geometry?.attributes?.uv, index = geometry?.index;
    if ( source.space !== 'mesh-local' || ![base,count,rings,cards].every(Number.isSafeInteger) ||
        base < 0 || cards < 1 || rings < 2 || count !== 2 * rings * cards ||
        geometry?.attributes?.position?.count !== base + count || uv?.count !== base + count || !index || index.count % 3 )
        throw new UnsupportedHairCardFrameLayoutError( 'Unsupported hair card frame geometry or source layout.' );
    const width = uv.getX(base + 1) - uv.getX(base);
    if ( !Number.isFinite(width) || width <= 0 ) throw new UnsupportedHairCardFrameLayoutError( 'Hair card frame needs positive atlas width.' );
    const close = (a,b) => Number.isFinite(a) && Math.abs(a-b) <= 1e-7;
    for ( let c=0; c<cards; c++ ) {
        const start=base+c*2*rings, left=uv.getX(start), right=uv.getX(start+1);
        if ( !close(right-left,width) ) throw new UnsupportedHairCardFrameLayoutError( 'Hair card frame requires uniform atlas widths.' );
        for ( let r=0; r<rings; r++ ) {
            const i=start+2*r, v=r/(rings-1);
            if ( !close(uv.getX(i),left) || !close(uv.getX(i+1),right) || !close(uv.getY(i),v) || !close(uv.getY(i+1),v) )
                throw new UnsupportedHairCardFrameLayoutError( 'Hair card frame requires straight, evenly spaced atlas strips.' );
        }
    }
    for ( let i=0; i<index.count; i+=3 ) {
        let n=0;
        for ( let k=0; k<3; k++ ) {
            const vertex=index.getX(i+k);
            if ( !Number.isSafeInteger(vertex) || vertex<0 || vertex>=base+count ) throw new UnsupportedHairCardFrameLayoutError( 'Hair card frame index outside geometry.' );
            n += vertex >= base ? 1 : 0;
        }
        if ( n!==0 && n!==3 ) throw new UnsupportedHairCardFrameLayoutError( 'Hair card frame cannot mix cap and card vertices in one triangle.' );
    }
    return Object.freeze({base,count,rings,cards,width});
}

/** Smooth the original moving cards using their existing buffer. Owns no GPU allocation. */
export function createHairCardFrame( { dynamics, mesh, material } ) {
    if ( owners.has(mesh) ) throw new Error( 'Hair card frame is already installed on this mesh.' );
    if ( !dynamics?.borrowCardEdges || dynamics.disposed || !material?.isHairNodeMaterial || mesh?.material !== material )
        throw new Error( 'Hair card frame requires live dynamics and the attached hair material.' );
    const geometry=mesh.geometry, positionNode=material.positionNode;
    let source=null, remove=null, disposed=false, frame=null, layout=null;
    let lastReason='awaiting a draw', lastObject=null, unsupportedReason=null;
    function availability( object=mesh ) {
        if ( disposed ) return 'source retired';
        if ( unsupportedReason !== null ) return unsupportedReason;
        if ( !source?.live || dynamics.disposed ) return 'source retired';
        if ( object!==mesh || mesh.geometry!==geometry || mesh.material!==material || material.positionNode!==positionNode || material.hair.cardFrame!==frame )
            return 'groom or material changed';
        const state=source.state();
        if ( !state.ready || state.builtReset!==state.reset ) return 'source awaiting a completed rebuild';
        if ( state.rawComputeUsed ) return 'source used untracked compute';
        return null;
    }
    const enabled=uniform(0).onObjectUpdate( ({object}) => {
        lastObject=object; lastReason=availability(object);
        return lastReason===null ? 1 : 0;
    } );
    const owner={
        get disposed(){return disposed;},
        report(){
            const reason=availability();
            return {mode:disposed?'disposed':reason===null && enabled.value===1 && lastObject===mesh?'smooth':'derivative',
                available:reason===null,reason:reason ?? lastReason,live:!disposed,
                layout,ownedBuffers:0,addedVertexBytes:0};
        },
        dispose(){
            if(disposed)return;disposed=true;enabled.value=0;
            const errors=[];
            try{remove?.();}catch(error){errors.push(error);}
            try{source?.release();}catch(error){errors.push(error);}
            owners.delete(mesh);source=null;remove=null;
            if(errors.length)throw new AggregateError(errors,'Hair card frame cleanup failed.');
        }
    };
    try {
        source=dynamics.borrowCardEdges(()=>owner.dispose());
        try { layout=inspectCardFrameLayout(geometry,source); }
        catch ( error ) {
            // Smoothing is optional for externally hosted grooms. A valid solver layout may
            // use a different atlas; retain derivative shading without keeping its borrow.
            // Installation, source and cleanup failures are deliberately not swallowed.
            if ( !(error instanceof UnsupportedHairCardFrameLayoutError) ) throw error;
            source.release();source=null;unsupportedReason=error.message;
            owners.set(mesh,owner);
            return owner;
        }
        const {base,count,rings,width}=layout;
        // Caps still execute the vertex stage: clamp every read even where the fragment mask
        // selects native derivatives. Difference vectors use w=0, excluding translation.
        const i=min(max(vertexIndex,uint(base)).sub(uint(base)),uint(count-1));
        const stride=uint(2*rings),card=i.div(stride),ring=i.mod(stride).div(uint(2)),edge=i.mod(uint(2));
        const start=card.mul(stride),lo=max(ring,uint(1)).sub(uint(1)),hi=min(ring.add(uint(1)),uint(rings-1));
        const p0=source.read(start.add(lo.mul(uint(2))).add(edge)),p1=source.read(start.add(hi.mul(uint(2))).add(edge));
        const left=source.read(start.add(ring.mul(uint(2)))),right=source.read(start.add(ring.mul(uint(2))).add(uint(1)));
        const along=p1.sub(p0).mul(float(rings-1).div(float(hi.sub(lo))));
        const across=right.sub(left).div(float(width));
        frame={enabled,
            inCard:varying(vertexIndex.greaterThanEqual(uint(base)).select(float(1),float(0)),'hairCardFrameMask'),
            along:varying(modelViewMatrix.mul(vec4(along,0)).xyz,'hairCardFrameAlong'),
            across:varying(modelViewMatrix.mul(vec4(across,0)).xyz,'hairCardFrameAcross')};
        remove=installHairCardFrame(material,frame);
        owners.set(mesh,owner);
        return owner;
    } catch(error) {
        try{owner.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Hair card frame construction failed.',{cause:error});}
        throw error;
    }
}
