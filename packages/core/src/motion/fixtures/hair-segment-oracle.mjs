/**
 * Independent CPU closest segment/triangle test oracle, frozen from the 2026-09-09 audit. Self-contained finite 3D math.
 * Returns actual segment t and body-triangle barycentrics; no anatomy or radius policy.
 * A constant-radius capsule clears a triangle when this distance clears its radius.
 * This does NOT minimize distance(t)-radius(t) for a tapered segment.
 */
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const interpolate=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const clamp=value=>Math.max(0,Math.min(1,value));
function point(value,name){
    if(!value||value.length!==3||Array.from(value).some(x=>!Number.isFinite(x)))throw Error(`${name}: finite xyz required`);
}
function distanceSquared(a,b){const d=sub(a,b);return dot(d,d);}
function pointSegment(p,a,b){
    const edge=sub(b,a),lengthSquared=dot(edge,edge);
    const t=lengthSquared>0?clamp(dot(sub(p,a),edge)/lengthSquared):0;
    return{t,point:interpolate(a,b,t)};
}

// Dominant-axis 2D barycentrics avoid subtracting nearly equal Gram determinants.
function barycentric(p,a,b,c,normal){
    const axis=Math.abs(normal[0])>=Math.abs(normal[1])&&Math.abs(normal[0])>=Math.abs(normal[2])?0:Math.abs(normal[1])>=Math.abs(normal[2])?1:2;
    const u=(axis+1)%3,v=(axis+2)%3;
    const determinant=(b[u]-a[u])*(c[v]-a[v])-(b[v]-a[v])*(c[u]-a[u]);
    if(determinant===0)return null;
    const beta=((p[u]-a[u])*(c[v]-a[v])-(p[v]-a[v])*(c[u]-a[u]))/determinant;
    const gamma=((b[u]-a[u])*(p[v]-a[v])-(b[v]-a[v])*(p[u]-a[u]))/determinant;
    return[1-beta-gamma,beta,gamma];
}
function onTriangle(weights){return weights!==null&&weights.every(w=>w>=0&&w<=1);}
function trianglePoint(a,b,c,weights){return a.map((_,k)=>a[k]*weights[0]+b[k]*weights[1]+c[k]*weights[2]);}
function choose(best,candidate){
    if(!best||candidate.distanceSquared<best.distanceSquared
        ||candidate.distanceSquared===best.distanceSquared&&candidate.segmentT<best.segmentT)return candidate;
    return best;
}

function closestPointTriangle(p,a,b,c){
    const normal=cross(sub(b,a),sub(c,a)),normalSquared=dot(normal,normal);
    let best=null;
    if(normalSquared>0){
        const height=dot(sub(p,a),normal)/normalSquared;
        const projected=p.map((value,k)=>value-normal[k]*height),weights=barycentric(projected,a,b,c,normal);
        if(onTriangle(weights))best={point:trianglePoint(a,b,c,weights),barycentric:weights};
    }
    // Also compare edges: they cover degenerate triangles and all outside projections.
    for(const [u,v,i,j]of[[a,b,0,1],[b,c,1,2],[c,a,2,0]]){
        const hit=pointSegment(p,u,v),weights=[0,0,0];weights[i]=1-hit.t;weights[j]=hit.t;
        if(!best||distanceSquared(p,hit.point)<distanceSquared(p,best.point))best={point:hit.point,barycentric:weights};
    }
    return best;
}

function closestSegments(a,b,c,d){
    const u=sub(b,a),v=sub(d,c),w=sub(a,c),normal=cross(u,v),denominator=dot(normal,normal);
    let best=null;
    const add=(s,t)=>{
        const segmentPoint=interpolate(a,b,s),edgePoint=interpolate(c,d,t);
        best=choose(best,{segmentPoint,edgePoint,segmentT:s,edgeT:t,distanceSquared:distanceSquared(segmentPoint,edgePoint)});
    };
    // Four clamped endpoint/segment candidates cover all boundary optima and degeneracy.
    add(0,pointSegment(a,c,d).t);add(1,pointSegment(b,c,d).t);
    add(pointSegment(c,a,b).t,0);add(pointSegment(d,a,b).t,1);
    if(denominator>0){
        // Cross-product form avoids cancellation in (u.u)*(v.v)-(u.v)^2 near parallel.
        const s=dot(cross(v,w),normal)/denominator,t=dot(cross(u,w),normal)/denominator;
        if(Number.isFinite(s)&&Number.isFinite(t)&&s>=0&&s<=1&&t>=0&&t<=1)add(s,t);
    }
    return best;
}

/** Exact feature minimum in ordinary floating arithmetic; degeneracy needs no special caller case. */
export function closestSegmentTriangle(start,end,a,b,c){
    for(const [name,value]of Object.entries({start,end,a,b,c}))point(value,name);
    let best=null;
    const add=(segmentPoint,trianglePoint,segmentT,weights,feature)=>{
        const candidate={segmentPoint,trianglePoint,segmentT,barycentric:weights,
            distanceSquared:distanceSquared(segmentPoint,trianglePoint),feature};
        if(!Number.isFinite(candidate.distanceSquared))throw Error('Closest query overflow; rescale coordinates');
        best=choose(best,candidate);
    };
    for(const [p,t]of[[start,0],[end,1]]){
        const hit=closestPointTriangle(p,a,b,c);add(Array.from(p),hit.point,t,hit.barycentric,'segment-endpoint');
    }
    for(const [u,v,i,j]of[[a,b,0,1],[b,c,1,2],[c,a,2,0]]){
        const hit=closestSegments(start,end,u,v),weights=[0,0,0];weights[i]=1-hit.edgeT;weights[j]=hit.edgeT;
        add(hit.segmentPoint,hit.edgePoint,hit.segmentT,weights,`triangle-edge-${i}${j}`);
    }
    // Interior/interior minimum is a transverse intersection. Parallel/coplanar minima
    // are already represented by an endpoint or an edge pair, including coplanar entry.
    const normal=cross(sub(b,a),sub(c,a)),direction=sub(end,start),denominator=dot(normal,direction);
    if(denominator!==0){
        const t=dot(normal,sub(a,start))/denominator;
        if(Number.isFinite(t)&&t>=0&&t<=1){
            const p=interpolate(start,end,t),weights=barycentric(p,a,b,c,normal);
            if(onTriangle(weights))add(p,trianglePoint(a,b,c,weights),t,weights,'intersection');
        }
    }
    return{...best,distance:Math.sqrt(best.distanceSquared)};
}
