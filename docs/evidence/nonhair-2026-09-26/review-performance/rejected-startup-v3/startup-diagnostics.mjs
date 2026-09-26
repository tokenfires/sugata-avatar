// Capture-local observation only. Never suppress warnings or alter native return values.
import {Node, StackNode, ConditionalNode, WebGPUBackend} from 'three/webgpu';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};

export function installStartupDiagnostics() {
    requireThat(Node.captureStackTrace===false,'Unexpected preexisting node stack tracing.');
    const restorations=[],creation=new Map(),warnings=[],zeroIndexDraws=[];
    let conditional=null,restored=false;
    function wrap(object,key,make) {
        const descriptor=Object.getOwnPropertyDescriptor(object,key);
        requireThat(descriptor && typeof descriptor.value==='function','Expected owned native method '+key);
        const replacement=make(descriptor.value);
        Object.defineProperty(object,key,{...descriptor,value:replacement});
        restorations.push(()=>{requireThat(object[key]===replacement,'Startup observer replaced: '+key);Object.defineProperty(object,key,descriptor);});
    }
    const debugDescriptor=Object.getOwnPropertyDescriptor(Node,'captureStackTrace');
    Object.defineProperty(Node,'captureStackTrace',{...debugDescriptor,value:true});
    restorations.push(()=>{requireThat(Node.captureStackTrace===true,'Node stack flag changed during startup.');Object.defineProperty(Node,'captureStackTrace',debugDescriptor);});
    for(const key of ['If','ElseIf'])wrap(StackNode.prototype,key,original=>function(...args){
        const callStack=new Error('Native StackNode.'+key+' creation').stack;
        const result=original.apply(this,args);
        creation.set(this._currentCond.id,{method:key,callStack});return result;
    });
    wrap(ConditionalNode.prototype,'generate',original=>function(...args){
        const previous=conditional;
        conditional={id:this.id,creation:creation.get(this.id)??null,nodeStack:this.stackTrace?.stack??null,
            buildStack:new Error('Native ConditionalNode.generate').stack,output:args[1]??null};
        try{return original.apply(this,args);}finally{conditional=previous;}
    });
    wrap(console,'warn',original=>function(...args){
        warnings.push({arguments:args.map(a=>typeof a==='string'?a:{type:typeof a,value:String(a)}),
            emissionStack:new Error('Native warning emission').stack,conditional});
        return original.apply(this,args);
    });
    wrap(WebGPUBackend.prototype,'_draw',original=>function(...args){
        const ro=args[0],params=args[6];
        if(params?.vertexCount===0 && ro.geometry?.index){
            const ancestry=[];for(let o=ro.object;o;o=o.parent)ancestry.push(o.name);
            zeroIndexDraws.push({mesh:ro.object.name,ancestry,geometryId:ro.geometry.id,indexCount:ro.geometry.index.count,
                drawRange:{...ro.geometry.drawRange},drawParameters:{...params},material:{name:ro.material.name,type:ro.material.type},
                camera:{name:ro.camera.name,type:ro.camera.type},callStack:new Error('Native zero-index draw submission').stack});
        }
        return original.apply(this,args);
    });
    return {
        report:()=>({warnings,zeroIndexDraws,nodeStackTracePolicy:'true only during unmeasured original page startup; restored before any measured update.',restored}),
        restore(){requireThat(!restored,'Startup observer already restored.');while(restorations.length)restorations.pop()();restored=true;}
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
