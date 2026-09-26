// Capture-local observation only. Never suppress warnings or alter native return values.
import {Node, WebGPUBackend} from 'three/webgpu';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};

export function installStartupDiagnostics({context=()=>null}={}) {
    requireThat(Node.captureStackTrace===false,'Unexpected preexisting node stack tracing.');
    const restorations=[],warnings=[],zeroIndexDraws=[];
    let restored=false;
    function wrap(object,key,make) {
        const descriptor=Object.getOwnPropertyDescriptor(object,key);
        requireThat(descriptor && typeof descriptor.value==='function','Expected owned native method '+key);
        const replacement=make(descriptor.value);
        // Native Node.build selects its generation/caching path by generate.length.
        // Preserve reflective arity for every observer, not only direct-call behavior.
        Object.defineProperty(replacement,'length',Object.getOwnPropertyDescriptor(descriptor.value,'length'));
        requireThat(replacement.length===descriptor.value.length,'Native method arity changed: '+key);
        Object.defineProperty(object,key,{...descriptor,value:replacement});
        restorations.push(()=>{requireThat(object[key]===replacement,'Startup observer replaced: '+key);Object.defineProperty(object,key,descriptor);});
    }
    const debugDescriptor=Object.getOwnPropertyDescriptor(Node,'captureStackTrace');
    Object.defineProperty(Node,'captureStackTrace',{...debugDescriptor,value:true});
    restorations.push(()=>{requireThat(Node.captureStackTrace===true,'Node stack flag changed during startup.');Object.defineProperty(Node,'captureStackTrace',debugDescriptor);});
    // Leave every shader node method untouched. Native Node stack tracing already
    // includes its creation stack in Three's formatted TSL warning arguments.
    wrap(console,'warn',original=>function(...args){
        warnings.push({context:context(),arguments:args.map(a=>typeof a==='string'?a:{type:typeof a,value:String(a)}),
            emissionStack:new Error('Native warning emission').stack});
        return original.apply(this,args);
    });
    wrap(WebGPUBackend.prototype,'_draw',original=>function(...args){
        const ro=args[0],params=args[6];
        if(params?.vertexCount===0 && ro.geometry?.index){
            const ancestry=[];for(let o=ro.object;o;o=o.parent)ancestry.push(o.name);
            zeroIndexDraws.push({context:context(),mesh:ro.object.name,ancestry,geometryId:ro.geometry.id,indexCount:ro.geometry.index.count,
                drawRange:{...ro.geometry.drawRange},drawParameters:{...params},material:{name:ro.material.name,type:ro.material.type},
                camera:{name:ro.camera.name,type:ro.camera.type},callStack:new Error('Native zero-index draw submission').stack});
        }
        return original.apply(this,args);
    });
    return {
        report:()=>({warnings,zeroIndexDraws,nodeStackTracePolicy:'true only within the explicitly unmeasured observation window; restored before any measured update.',restored}),
        restore(){requireThat(!restored,'Startup observer already restored.');const errors=[];
            while(restorations.length)try{restorations.pop()();}catch(error){errors.push(error);}
            restored=errors.length===0;if(errors.length)throw new AggregateError(errors,'Startup observer ownership restoration failed.');}
    };
}

// Pool absence is valid retirement evidence only if no measurement was ever attempted.
// This predicate is never used by per-update timestamp accounting.
export function assessCleanupPools(rows,{measurementStarted}) {
    requireThat(typeof measurementStarted==='boolean','Explicit measurement-start boundary required.');
    requireThat(rows.length===2 && rows[0].type==='render' && rows[1].type==='compute','Both pool types required.');
    const idle=rows.every(p=>p.present
        ? p.allocated===0 && p.offsets.length===0 && !p.pending && p.mapState==='unmapped'
        : !measurementStarted && p.allocated===0 && p.offsets.length===0 && !p.pending && p.mapState===null);
    return {idle,measurementStarted,absentTypes:rows.filter(p=>!p.present).map(p=>p.type),
        scope:measurementStarted?'Measured run requires both allocated pools idle.':'Premeasurement retirement only; absent pools have no allocated resources.'};
}
