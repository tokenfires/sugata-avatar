#!/usr/bin/env node
/** New discrete projected-coverage protocol. Never a replay of the missing v1 implementation. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Triangle, Vector3 } from 'three';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { WARDROBE_MASK_CALIBRATION as calibration, WARDROBE_MASK_DATA_SHA256 } from './wardrobe_under_masks.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUTER = 'female_casualsuit01';
const FIELD = '_UNDER_FEMALE_CASUALSUIT01';
export const PROTOCOL = Object.freeze({
    id:'sugata-collar-replacement-coverage-v2', version:1, historicalReplayEquivalent:false,
    coordinateSpace:'shared posed/world metres; authored GLB positions only when mesh ancestors are identity',
    chart:'foundation centroid; closest full-body triangle by Euclidean point-to-triangle distance; exact ties use lowest triangle ID; geometric winding normal',
    basis:'least-aligned world axis, X/Y/Z tie order; u=normalize(axis cross n); v=n cross u',
    marginMetres:0.001, slabMetres:[-0.004,0.03], slabBoundaries:'inclusive; clip in 3D before projection',
    outward:'strictly positive unnormalized face normal dot chart normal',
    maximumUncoveredAreaMetresSquared:1e-14,
    precision:'JavaScript Float64; no clipping epsilon, snapping, small-fragment deletion, or cover enlargement; exact-zero degenerate 3D triangles and nonfinite input throw',
    interpretation:'Discrete local projected coverage of frozen additional-removal footprints; not all-view occlusion, collision clearance, motion continuity, or historical replay parity'
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const add = (a, b) => a.map((x, k) => x + b[k]);
const sub = (a, b) => a.map((x, k) => x - b[k]);
const scale = (a, s) => a.map(x => x * s);
const dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = a => { const length = Math.hypot(...a); assert.ok(length > 0 && Number.isFinite(length), 'Degenerate chart normal'); return scale(a, 1/length); };
const cross2 = (a, b) => a[0]*b[1]-a[1]*b[0];
const turn = (a, b, p) => cross2(sub(b, a), sub(p, a));
const samePoint = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);

/** Signed area with a local origin, avoiding cancellation from a remote world origin. */
export function polygonArea(polygon) {
    let twice = 0;
    for (let i = 1; i + 1 < polygon.length; i++) twice += turn(polygon[0], polygon[i], polygon[i+1]);
    return twice / 2;
}

function clean(polygon) {
    const result = polygon.filter((p, i) => i === 0 || !samePoint(p, polygon[i-1]));
    if (result.length > 1 && samePoint(result[0], result.at(-1))) result.pop();
    return result;
}

export function convexHull(points) {
    const sorted = points.map(p => [...p]).sort((a,b) => a[0]-b[0] || a[1]-b[1]);
    const unique = sorted.filter((p, i) => i === 0 || !samePoint(p, sorted[i-1]));
    if (unique.length < 3) return unique;
    const half = sequence => {
        const hull = [];
        for (const p of sequence) {
            while (hull.length > 1 && turn(hull.at(-2), hull.at(-1), p) <= 0) hull.pop();
            hull.push(p);
        }
        return hull.slice(0, -1);
    };
    return [...half(unique), ...half([...unique].reverse())];
}

/** Inclusive half-space clipping. No epsilon widens the accepted cover. */
function clipHalfSpace(polygon, distance) {
    if (!polygon.length) return [];
    const result = [];
    let a = polygon.at(-1), da = distance(a);
    for (const b of polygon) {
        const db = distance(b), ai = da >= 0, bi = db >= 0;
        if (ai !== bi) {
            const t = da / (da-db);
            result.push(a.map((x, k) => x + t*(b[k]-x)));
        }
        if (bi) result.push(b);
        a = b; da = db;
    }
    return clean(result);
}

/** Disjoint convex pieces of subject minus a convex CCW cover. Boundary overlap has zero area. */
export function subtractConvex(subject, cover) {
    assert.ok(polygonArea(subject) >= 0 && polygonArea(cover) > 0, 'Expected CCW convex polygons');
    let inside = subject;
    const outside = [];
    for (let i = 0; i < cover.length && inside.length >= 3; i++) {
        const a = cover[i], b = cover[(i+1)%cover.length];
        const piece = clipHalfSpace(inside, p => -turn(a,b,p));
        if (polygonArea(piece) > 0) outside.push(piece);
        inside = clipHalfSpace(inside, p => turn(a,b,p));
    }
    return outside;
}

/** Subtraction computes the union's complement, so overlaps cannot count twice. */
export function uncoveredArea(footprint, covers) {
    assert.ok(polygonArea(footprint) > 0, 'Empty or reversed footprint');
    let fragments = [footprint];
    for (const cover of covers) {
        if (polygonArea(cover) <= 0) continue;
        fragments = fragments.flatMap(fragment => subtractConvex(fragment, cover));
        assert.ok(fragments.length <= 100000, 'Coverage fragmentation limit reached; result is not qualified');
        if (!fragments.length) break;
    }
    return { area: fragments.reduce((sum, p) => sum + polygonArea(p), 0), fragments };
}

/** Local coordinates are [u,v,depth]. Both slab boundary planes are included exactly. */
export function clipDepth(polygon, low = -0.004, high = 0.03) {
    assert.ok(Number.isFinite(low) && Number.isFinite(high) && low <= high);
    return clipHalfSpace(clipHalfSpace(polygon, p => p[2]-low), p => high-p[2]);
}

export function expandedFootprint(projectedTriangle, halfExtent = 0.001) {
    assert.ok(halfExtent > 0 && Number.isFinite(halfExtent));
    return convexHull(projectedTriangle.flatMap(p => [-halfExtent, halfExtent].flatMap(x =>
        [-halfExtent, halfExtent].map(y => [p[0]+x, p[1]+y]))));
}

function meshTriangles(mesh) {
    assert.ok(mesh.positions?.length > 0 && mesh.positions.length%3 === 0, 'Invalid mesh positions');
    assert.ok(mesh.indices?.length > 0 && mesh.indices.length%3 === 0, 'Invalid mesh indices');
    assert.ok(Array.from(mesh.positions).every(Number.isFinite), 'Nonfinite position');
    assert.ok(Array.from(mesh.indices).every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length/3), 'Out-of-range index');
    const triangles = [];
    for (let offset = 0; offset < mesh.indices.length; offset += 3) {
        const points = Array.from(mesh.indices.slice(offset, offset+3), i => Array.from(mesh.positions.slice(i*3,i*3+3)));
        const normal = cross(sub(points[1],points[0]),sub(points[2],points[0]));
        assert.ok(normal.every(Number.isFinite) && dot(normal,normal) > 0, `Degenerate triangle ${offset/3}; coverage is unclassifiable`);
        triangles.push({id:offset/3, points, normal,
            min:[0,1,2].map(k => Math.min(...points.map(p=>p[k]))),
            max:[0,1,2].map(k => Math.max(...points.map(p=>p[k])))});
    }
    return triangles;
}

export function createChart(foundationTriangle, bodyIndex) {
    const origin = scale(foundationTriangle.reduce(add,[0,0,0]),1/3);
    assert.ok(origin.every(Number.isFinite),'Nonfinite chart origin');
    const nearest = bodyIndex.nearest(origin), n = normalize(nearest.normal);
    assert.ok(Number.isFinite(nearest.distanceSq) && nearest.distanceSq >= 0 && nearest.closest.every(Number.isFinite),'Nonfinite nearest-body result');
    const abs = n.map(Math.abs), axis = abs.indexOf(Math.min(...abs));
    const reference = [0,0,0]; reference[axis] = 1;
    const u = normalize(cross(reference,n)), v = cross(n,u);
    const bodyDistance=Math.sqrt(nearest.distanceSq);
    assert.ok(Number.isFinite(bodyDistance),'Nonfinite nearest-body distance');
    return {origin,n,u,v,bodyTriangle:nearest.id,bodyDistance};
}

export function chartPoint(point, chart) {
    const relative = sub(point,chart.origin);
    return [dot(relative,chart.u),dot(relative,chart.v),dot(relative,chart.n)];
}

export function projectedCover(points, chart) {
    const normal = cross(sub(points[1],points[0]),sub(points[2],points[0]));
    if (!(dot(normal,chart.n) > 0)) return [];
    return clipDepth(points.map(p=>chartPoint(p,chart))).map(p=>p.slice(0,2));
}

function footprintBounds(footprint, chart) {
    const corners = footprint.flatMap(p => PROTOCOL.slabMetres.map(depth =>
        add(chart.origin,add(scale(chart.u,p[0]),add(scale(chart.v,p[1]),scale(chart.n,depth))))));
    // Conservative floating-point padding affects broad-phase inclusion only; exact clipping still decides coverage.
    const box = {min:[0,1,2].map(k=>Math.min(...corners.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...corners.map(p=>p[k])))};
    for (let k=0;k<3;k++) { const pad=32*Number.EPSILON*Math.max(1,Math.abs(box.min[k]),Math.abs(box.max[k])); box.min[k]-=pad; box.max[k]+=pad; }
    return box;
}

export function evaluateCoverage({body, foundation, outer, triangleIds, excludedOuterTriangles = []}) {
    const bodyIndex = body instanceof TriangleIndex ? body : new TriangleIndex(body);
    const outerIndex = outer instanceof TriangleIndex ? outer : new TriangleIndex(outer);
    const foundationTriangles = meshTriangles(foundation);
    assert.ok(Array.isArray(triangleIds) && triangleIds.length > 0, 'Explicit nonempty foundation triangle selection required');
    assert.equal(new Set(triangleIds).size,triangleIds.length,'Duplicate foundation triangle');
    assert.ok(triangleIds.every(i=>Number.isInteger(i)&&i>=0&&i<foundationTriangles.length),'Unknown foundation triangle');
    assert.ok(Array.isArray(excludedOuterTriangles) && excludedOuterTriangles.every(i=>Number.isInteger(i)&&i>=0&&i<outerIndex.triangles.length),'Unknown excluded outer triangle');
    const excluded = new Set(excludedOuterTriangles), rows = [];
    for (const id of triangleIds) {
        const chart = createChart(foundationTriangles[id].points,bodyIndex);
        const footprint = expandedFootprint(foundationTriangles[id].points.map(p=>chartPoint(p,chart)));
        const nearby = outerIndex.intersecting(footprintBounds(footprint,chart));
        const covers = nearby.filter(t=>!excluded.has(t.id)).map(t=>({id:t.id,polygon:projectedCover(t.points,chart)}))
            .filter(c=>polygonArea(c.polygon)>0);
        const result = uncoveredArea(footprint,covers.map(c=>c.polygon));
        assert.ok(Number.isFinite(result.area) && result.area >= 0,'Nonfinite or negative uncovered area');
        assert.ok(result.area <= polygonArea(footprint)*(1+128*Number.EPSILON),'Uncovered partition exceeds footprint area');
        rows.push({foundationTriangle:id,bodyTriangle:chart.bodyTriangle,bodyDistance:chart.bodyDistance,
            chart:{origin:chart.origin,n:chart.n,u:chart.u,v:chart.v},footprintArea:polygonArea(footprint),
            uncoveredArea:result.area,pass:result.area<=PROTOCOL.maximumUncoveredAreaMetresSquared,
            outerTriangles:covers.map(c=>c.id),uncoveredFragments:result.fragments,
            ...(! (result.area<=PROTOCOL.maximumUncoveredAreaMetresSquared) ? {failureWitness:{
                foundationWorld:foundationTriangles[id].points,foundationChart:foundationTriangles[id].points.map(p=>chartPoint(p,chart)),
                footprint,bodyWorld:bodyIndex.triangles[chart.bodyTriangle].points,
                outerWorld:covers.map(c=>({id:c.id,points:outerIndex.triangles[c.id].points,clippedProjection:c.polygon}))
            }} : {})});
    }
    return {selected:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,
        maximumUncoveredArea:Math.max(...rows.map(r=>r.uncoveredArea)),excludedOuterTriangles:[...excluded].sort((a,b)=>a-b),rows};
}

function loadPinned(file, expected, id, meshName = id) {
    file = path.resolve(file);
    assert.match(expected,/^[a-f0-9]{64}$/,'Explicit SHA-256 required');
    const bytes = fs.readFileSync(file);
    assert.equal(sha(bytes),expected,`Asset hash mismatch: ${id}`);
    const glb = readGlb(file), meshIndex = glb.json.meshes.findIndex(m=>m.name===meshName);
    const primitive = readPrimitive(glb,meshName);
    const nodes = glb.json.nodes.map((n,i)=>({...n,index:i}));
    const meshNodes = nodes.filter(n=>n.mesh===meshIndex);
    assert.equal(meshNodes.length,1,'Expected a single mesh instance');
    let node = meshNodes[0];
    const seen = new Set();
    while (node) {
        assert.ok(!seen.has(node.index),'Cyclic node ancestry'); seen.add(node.index);
        assert.ok(!node.matrix&&!node.translation&&!node.rotation&&!node.scale,'Authored coordinates require identity mesh ancestry');
        const parents = nodes.filter(n=>n.children?.includes(node.index));
        assert.ok(parents.length<=1,'Ambiguous mesh ancestry'); node=parents[0];
    }
    return {id,file,sha256:expected,glb,primitive,mesh:{positions:primitive.positions,indices:primitive.indices}};
}

function snapshotMesh(snapshot, asset) {
    const matches=snapshot.meshes.filter(m=>m.id===asset.id);
    assert.equal(matches.length,1,`Snapshot must contain one ${asset.id}`);
    const mesh=matches[0];
    assert.equal(mesh.positions.length,asset.primitive.positions.length,`${asset.id}: position count mismatch`);
    assert.deepEqual(mesh.fullIndices,Array.from(asset.primitive.indices),`${asset.id}: full source topology mismatch`);
    return {positions:mesh.positions,indices:mesh.fullIndices};
}

/** Read-only asset/snapshot adapter. Writes one exclusive report; never changes GLBs or masks. */
export function runCoverage({outerPath,outerSha256,snapshotPath,snapshotSha256,foundationIds=['foundation_bra','foundation_vest'],outputPath,excludedOuterTriangles=[]}) {
    assert.ok(outputPath,'A fresh report output path is required');
    assert.ok(foundationIds.length>0 && foundationIds.every(id=>['foundation_bra','foundation_vest'].includes(id)),'Unsupported foundation');
    assert.equal(new Set(foundationIds).size,foundationIds.length,'Duplicate foundation');
    assert.ok(!fs.existsSync(outputPath),'Refuse to overwrite an existing report');
    const body=loadPinned(path.join(ROOT,'assets/wardrobe/body/g050.glb'),calibration.bodySha256,'body','base.001');
    const outer=loadPinned(outerPath,outerSha256,OUTER);
    const foundations=foundationIds.map(id=>{
        const entry=calibration.garments.find(g=>g.id===id);
        const asset=loadPinned(path.join(ROOT,`assets/wardrobe/${id}/g050.glb`),entry.outputSha256,id);
        const field=entry.fields.find(f=>f.name===FIELD);
        assert.equal(field.additionallyHiddenTriangles.length,id==='foundation_bra'?3669:4101);
        const primitive=asset.glb.json.meshes.find(m=>m.name===id).primitives[0];
        const mask=readAccessor(asset.glb,primitive.attributes[FIELD]).data;
        assert.ok(field.additionallyHiddenTriangles.every(t=>Array.from(asset.primitive.indices.slice(t*3,t*3+3)).some(v=>mask[v]>.5)),'Frozen selection is not currently masked');
        return {...asset,selected:field.additionallyHiddenTriangles};
    });
    let snapshot=null, snapshotSource=null;
    if (snapshotPath) {
        const bytes=fs.readFileSync(snapshotPath);
        assert.match(snapshotSha256??'',/^[a-f0-9]{64}$/,'Snapshot SHA-256 required');
        assert.equal(sha(bytes),snapshotSha256,'Snapshot hash mismatch');
        snapshot=JSON.parse((snapshotPath.endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8'));
        assert.ok(Array.isArray(snapshot.meshes)&&Number.isFinite(snapshot.time),'Invalid snapshot');
        snapshotSource={file:path.resolve(snapshotPath),sha256:snapshotSha256,time:snapshot.time};
    } else assert.ok(!snapshotSha256,'Snapshot hash supplied without a snapshot');
    const geometry=asset=>snapshot?snapshotMesh(snapshot,asset):asset.mesh;
    const bodyIndex=new TriangleIndex(geometry(body)),outerIndex=new TriangleIndex(geometry(outer));
    const sources=[fileURLToPath(import.meta.url),path.join(ROOT,'tools/lut-bake/glb.mjs'),path.join(ROOT,'tools/figure-pipeline/wardrobe_under_masks.mjs'),
        path.join(ROOT,'tools/figure-pipeline/fixtures/wardrobe-g050-under-masks-v1.json'),path.join(ROOT,'node_modules/three/src/math/Triangle.js'),path.join(ROOT,'node_modules/three/src/math/Vector3.js')];
    const sourceHashes=Object.fromEntries(sources.map(file=>[path.relative(ROOT,file),sha(fs.readFileSync(file))]));
    const report={protocol:PROTOCOL,createdAt:new Date().toISOString(),mode:snapshot?'supplied-discrete-snapshot':'authored',
        sourceHashes,calibrationSha256:WARDROBE_MASK_DATA_SHA256,
        assets:[body,outer,...foundations].map(({id,file,sha256})=>({id,file,sha256})),snapshot:snapshotSource,
        sourceContract:calibration.authoringContract,foundations:[],
        limits:['No historical implementation or capture equivalence is asserted.',
            'Snapshot hash/topology binding does not prove runtime capture provenance; the capture manifest must independently bind loaded assets and sources.',
            'These checks cover the frozen casual bra/vest additional-removal selections only, not original mask removals or arbitrary viewing rays.',
            'CPU positions and local projected coverage do not qualify motion continuity, GPU deformations, cloth clearance, or promotion.']};
    for (const foundation of foundations) report.foundations.push({id:foundation.id,...evaluateCoverage({body:bodyIndex,outer:outerIndex,
        foundation:geometry(foundation),triangleIds:foundation.selected,excludedOuterTriangles})});
    report.pass=report.foundations.every(f=>f.failed===0);
    // Report binds unchanged input bytes at completion, including the instrument itself.
    for(const asset of [body,outer,...foundations])assert.equal(sha(fs.readFileSync(asset.file)),asset.sha256,'Asset changed during qualification');
    if(snapshotSource)assert.equal(sha(fs.readFileSync(snapshotSource.file)),snapshotSource.sha256,'Snapshot changed during qualification');
    for(const [file,expected] of Object.entries(sourceHashes))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),expected,'Source changed during qualification');
    fs.mkdirSync(path.dirname(path.resolve(outputPath)),{recursive:true});
    fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    return report;
}


const bounds = items => ({min:[0,1,2].map(k => Math.min(...items.map(x=>x.min[k]))), max:[0,1,2].map(k => Math.max(...items.map(x=>x.max[k])))});
const boxDistanceSq = (box,p) => [0,1,2].reduce((sum,k) => sum + Math.max(box.min[k]-p[k], 0, p[k]-box.max[k])**2, 0);
const overlap = (a,b) => [0,1,2].every(k => a.min[k] <= b.max[k] && a.max[k] >= b.min[k]);

/** Exact triangle query with conservative AABB pruning; stable face-ID tie breaking. */
export class TriangleIndex {
    constructor(mesh) {
        this.triangles = meshTriangles(mesh);
        const build = items => {
            const node = bounds(items);
            if (items.length <= 12) return {...node,items};
            const size = sub(node.max,node.min), axis = size.indexOf(Math.max(...size));
            items.sort((a,b) => (a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]) || a.id-b.id);
            const mid = Math.floor(items.length/2);
            return {...node,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
        };
        this.root = build([...this.triangles]);
    }
    nearest(point) {
        assert.ok(point?.length===3 && Array.from(point).every(Number.isFinite),'Nonfinite nearest-body query');
        const query = new Vector3(...point), closest = new Vector3(), triangle = new Triangle();
        let best = null;
        const visit = node => {
            // Broaden only the search bound against Float64 rounding; the winning distance and exact tie test remain unmodified.
            if (best && boxDistanceSq(node,point) > best.distanceSq+32*Number.EPSILON*Math.max(1,best.distanceSq)) return;
            if (node.items) {
                for (const item of node.items) {
                    if (dot(item.normal,item.normal) === 0) continue;
                    triangle.a.fromArray(item.points[0]); triangle.b.fromArray(item.points[1]); triangle.c.fromArray(item.points[2]);
                    triangle.closestPointToPoint(query,closest);
                    const distanceSq = closest.distanceToSquared(query);
                    assert.ok(closest.toArray().every(Number.isFinite) && Number.isFinite(distanceSq) && distanceSq>=0,
                        `Nonfinite nearest-body arithmetic at triangle ${item.id}; coverage is unclassifiable`);
                    if (!best || distanceSq < best.distanceSq || (distanceSq === best.distanceSq && item.id < best.id)) {
                        best = {...item,distanceSq,closest:closest.toArray()};
                    }
                }
            } else {
                const nodes = [node.left,node.right].sort((a,b) => boxDistanceSq(a,point)-boxDistanceSq(b,point));
                nodes.forEach(visit);
            }
        };
        visit(this.root);
        assert.ok(best, 'Body has no nondegenerate triangle');
        return best;
    }
    intersecting(box) {
        const found = [];
        const visit = node => {
            if (!overlap(node,box)) return;
            if (node.items) found.push(...node.items.filter(item => overlap(item,box)));
            else { visit(node.left); visit(node.right); }
        };
        visit(this.root);
        return found.sort((a,b)=>a.id-b.id);
    }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
    const args=process.argv.slice(2), options={};
    const names={'--outer':'outerPath','--outer-sha256':'outerSha256','--snapshot':'snapshotPath','--snapshot-sha256':'snapshotSha256','--output':'outputPath'};
    try {
        for(let i=0;i<args.length;i+=2){
            assert.ok(args[i+1]&&!args[i+1].startsWith('--'),'Every option needs a value');
            if(args[i]==='--foundation')options.foundationIds=args[i+1]==='both'?['foundation_bra','foundation_vest']:[args[i+1]];
            else if(args[i]==='--exclude-outer-triangles')options.excludedOuterTriangles=JSON.parse(fs.readFileSync(args[i+1],'utf8'));
            else {assert.ok(names[args[i]],`Unknown option ${args[i]}`);assert.ok(!(names[args[i]] in options),'Duplicate option');options[names[args[i]]]=args[i+1];}
        }
        assert.ok(options.outerPath&&options.outerSha256&&options.outputPath,'Usage: node collar_coverage_v2.mjs --outer GLB --outer-sha256 HASH --output NEW_JSON [--foundation foundation_bra|foundation_vest|both] [--snapshot JSON_GZ --snapshot-sha256 HASH] [--exclude-outer-triangles JSON_ID_ARRAY]');
        const report=runCoverage(options);
        console.log(JSON.stringify({protocol:PROTOCOL.id,pass:report.pass,foundations:report.foundations.map(({id,selected,failed,maximumUncoveredArea})=>({id,selected,failed,maximumUncoveredArea})),output:path.resolve(options.outputPath)}));
        if(!report.pass)process.exitCode=2;
    } catch(error) {console.error(error.message);process.exitCode=1;}
}
