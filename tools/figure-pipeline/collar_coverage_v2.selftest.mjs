import assert from 'node:assert/strict';
import { Vector3, Triangle } from 'three';
import { PROTOCOL, polygonArea, convexHull, subtractConvex, uncoveredArea, expandedFootprint,
    clipDepth, TriangleIndex, createChart, projectedCover, evaluateCoverage } from './collar_coverage_v2.mjs';

let groups=0;
const test=(name,fn)=>{fn();groups++;console.log('ok',name);};
const close=(actual,expected,tolerance=1e-14)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
const mesh=triangles=>({positions:triangles.flat(2),indices:triangles.flat().map((_,i)=>i)});
const squareMesh=(low=-0.01,high=0.01,z=0.003)=>mesh([
    [[low,low,z],[high,low,z],[high,high,z]],[[low,low,z],[high,high,z],[low,high,z]]]);
const body=squareMesh(-1,1,0);
const foundation=mesh([[[-0.002,-0.002,0.001],[0.002,-0.002,0.001],[0,0.002,0.001]]]);
const chart={origin:[0,0,0],u:[1,0,0],v:[0,1,0],n:[0,0,1]};

test('Minkowski square expansion is the exact convex hull, not a bounding rectangle',()=>{
    const hull=expandedFootprint([[0,0],[0.01,0],[0,0.01]]);
    close(polygonArea(hull),0.000094);
    assert.ok(polygonArea(hull)<0.000144);
    assert.equal(hull.length,5);
    assert.deepEqual(convexHull([[0,0],[1,0],[1,0],[0,1],[.2,.2]]),[[0,0],[1,0],[0,1]]);
});
test('Full cover and coincident seam have zero uncovered area',()=>{
    const footprint=rect(0,0,1,1);
    assert.equal(uncoveredArea(footprint,[footprint]).area,0);
    assert.equal(uncoveredArea(footprint,[[[0,0],[1,0],[1,1]],[[0,0],[1,1],[0,1]]]).area,0);
    assert.equal(uncoveredArea(footprint,[rect(0,0,.5,1),rect(.5,0,1,1)]).area,0);
});
test('Overlapping cover cannot double-count area or hide a gap',()=>{
    const footprint=rect(0,0,1,1);
    close(uncoveredArea(footprint,[rect(0,0,.7,1),rect(.3,0,.8,1)]).area,.2);
    close(uncoveredArea(footprint,[rect(0,0,.7,1),rect(0,0,.7,1)]).area,.3);
    assert.equal(uncoveredArea(footprint,[rect(0,0,.7,1),rect(.3,0,1,1)]).area,0);
});
test('Convex subtraction partitions area and preserves a small interior hole',()=>{
    const subject=rect(0,0,1,1),cover=rect(.25,.25,.75,.75);
    close(subtractConvex(subject,cover).reduce((sum,p)=>sum+polygonArea(p),0),.75);
    const size=1e-6,a=.005,b=a+size,whole=rect(0,0,.01,.01);
    const strips=[rect(0,0,a,.01),rect(b,0,.01,.01),rect(a,0,b,a),rect(a,b,b,.01)];
    const hole=uncoveredArea(whole,strips).area;
    close(hole,size*size,1e-22);
    assert.ok(hole>PROTOCOL.maximumUncoveredAreaMetresSquared);
    assert.equal(PROTOCOL.maximumUncoveredAreaMetresSquared,1e-14);
});
test('Cover-order changes do not change analytic union area',()=>{
    const p=rect(-1,-1,1,1),a=rect(-2,-2,.2,2),b=rect(-.2,-.2,2,.2),c=rect(.1,-2,2,-.1);
    close(uncoveredArea(p,[a,b,c]).area,.64);
    close(uncoveredArea(p,[c,b,a]).area,.64);
});
test('Inclusive slab planes and strict outside rejection',()=>{
    for(const z of [-.004,.03])assert.equal(projectedCover([[0,0,z],[1,0,z],[0,1,z]],chart).length,3);
    for(const z of [-.004000000001,.030000000001])assert.equal(projectedCover([[0,0,z],[1,0,z],[0,1,z]],chart).length,0);
});
test('Slab clips crossing triangles before projection; both planes participate',()=>{
    const polygon=clipDepth([[0,0,0],[1,0,1],[0,1,0]],.25,.75);
    assert.equal(polygon.length,4);
    assert.ok(polygon.every(p=>p[2]>=.25&&p[2]<=.75));
    close(polygonArea(polygon),.25);
    const lower=projectedCover([[-1,-1,-.014],[1,-1,.006],[0,1,.006]],chart);
    close(polygonArea(lower),1.5);
});
test('Reversed and edge-on faces never contribute outward cover',()=>{
    assert.equal(projectedCover([[0,0,0],[0,1,0],[1,0,0]],chart).length,0);
    assert.equal(projectedCover([[0,0,0],[0,1,0],[0,0,.01]],chart).length,0);
});
test('Nearest-body query uses triangle distance rather than centroid distance; exact ties use ID',()=>{
    const triangles=[[[0,0,0],[10,0,0],[0,10,0]],[[0,0,.1],[.1,0,.1],[0,.1,.1]]];
    const index=new TriangleIndex(mesh(triangles));
    assert.equal(index.nearest([.01,.01,.001]).id,0);
    const tie=new TriangleIndex(mesh([triangles[0],[...triangles[0]].reverse()]));
    assert.equal(tie.nearest([.1,.1,.01]).id,0);
    const c=createChart([[0,0,.01],[.01,0,.01],[0,.01,.01]],tie);
    assert.deepEqual(c.n,[0,0,1]);assert.deepEqual(c.u,[0,-1,0]);assert.deepEqual(c.v,[1,0,-0]);
});
test('BVH nearest agrees with exhaustive Three triangle search across nonlocal queries',()=>{
    const tris=[];
    for(let i=0;i<50;i++){const x=(i*17%31)/13,y=(i*7%19)/11,z=(i*3%13)/17;tris.push([[x,y,z],[x+.07,y+.01,z],[x+.02,y+.09,z+.03]]);}
    const index=new TriangleIndex(mesh(tris)),tmp=new Vector3(),t=new Triangle();
    for(let j=0;j<40;j++){
        const p=[(j*11%37)/17-.2,(j*5%23)/13-.1,(j*3%17)/15],q=new Vector3(...p);
        const all=tris.map((v,id)=>{t.a.fromArray(v[0]);t.b.fromArray(v[1]);t.c.fromArray(v[2]);return{id,distanceSq:t.closestPointToPoint(q,tmp).distanceToSquared(q)};}).sort((a,b)=>a.distanceSq-b.distanceSq||a.id-b.id);
        const nearest=index.nearest(p);assert.equal(nearest.id,all[0].id);close(nearest.distanceSq,all[0].distanceSq);
    }
});
test('End-to-end coverage and removed-cover/reversed/slab-negative controls',()=>{
    const outer=squareMesh();
    const positive=evaluateCoverage({body,foundation,outer,triangleIds:[0]});
    assert.equal(positive.failed,0);close(positive.rows[0].uncoveredArea,0,1e-18);
    const removed=evaluateCoverage({body,foundation,outer,triangleIds:[0],excludedOuterTriangles:[0]});
    assert.equal(removed.failed,1);assert.ok(removed.rows[0].uncoveredArea>1e-8);
    const backwards={...outer,indices:outer.indices.slice().reverse()};
    assert.equal(evaluateCoverage({body,foundation,outer:backwards,triangleIds:[0]}).failed,1);
    assert.equal(evaluateCoverage({body,foundation,outer:squareMesh(-.01,.01,.04),triangleIds:[0]}).failed,1);
});
test('Shared translation and uniform unit scale preserve expected area relations',()=>{
    const translate=m=>({...m,positions:m.positions.map((v,i)=>v+[2,-3,4][i%3])});
    assert.equal(evaluateCoverage({body:translate(body),foundation:translate(foundation),outer:translate(squareMesh()),triangleIds:[0]}).failed,0);
    const p=rect(0,0,.01,.01),cover=rect(0,0,.007,.01);
    close(uncoveredArea(p,[cover]).area,0.00003);
    close(uncoveredArea(p.map(p=>p.map(x=>x*3)),[cover.map(p=>p.map(x=>x*3))]).area,0.00027);
});
test('Invalid geometry and selections fail closed',()=>{
    assert.throws(()=>new TriangleIndex(mesh([[[0,0,0],[1,0,0],[2,0,0]]])),/Degenerate/);
    assert.throws(()=>new TriangleIndex({positions:[NaN,0,0],indices:[0,0,0]}),/Nonfinite/);
    assert.throws(()=>new TriangleIndex({positions:[0,0,0],indices:[0,1,0]}),/Out-of-range/);
    assert.throws(()=>evaluateCoverage({body,foundation,outer:squareMesh(),triangleIds:[1]}),/Unknown foundation/);
    assert.throws(()=>evaluateCoverage({body,foundation,outer:squareMesh(),triangleIds:[0,0]}),/Duplicate/);
    assert.throws(()=>evaluateCoverage({body,foundation,outer:squareMesh(),triangleIds:[0],excludedOuterTriangles:[9]}),/Unknown excluded/);
});
test('Finite extreme inputs causing nearest-point arithmetic overflow fail closed',()=>{
    const extreme=mesh([[[-1e100,-1e100,0],[1e100,-1e100,0],[0,1e100,0]]]);
    assert.throws(()=>new TriangleIndex(extreme).nearest([0,0,.001]),/Nonfinite nearest-body arithmetic/);
    assert.throws(()=>evaluateCoverage({body:extreme,foundation,outer:squareMesh(),triangleIds:[0]}),/Nonfinite nearest-body arithmetic/);
    assert.throws(()=>new TriangleIndex(body).nearest([NaN,0,0]),/Nonfinite nearest-body query/);
});
console.log(`${groups} analytic groups passed; protocol=${PROTOCOL.id}; no asset qualification implied.`);
