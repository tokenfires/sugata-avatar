// Original Mara polygon-cage artist source. This file has not been imported/run.
// Entry requires a separately root-admitted exact one-build request.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';

const leaf = fileURLToPath(new URL('.', import.meta.url));
const out = leaf + 'out/';
const started = performance.now();
const absoluteStop = Date.parse('2026-10-19T19:37:55.992117+00:00');
let ownedOut = false, samples = 0, loopSteps = 0;
function guard() {
    samples++;
    assert.ok(Date.now() < absoluteStop, 'Absolute slice stop');
    assert.ok(performance.now() - started < 10000, 'Cooperative post-import 10s');
    assert.ok(process.memoryUsage().rss < 536870912, 'Sampled RSS below512MiB');
}
function pulse() { if (++loopSteps % 256 === 0) guard(); }
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const mean = points => mul(points.reduce(add, [0, 0, 0]), 1 / points.length);
const unit = a => { const n = Math.hypot(...a); assert.ok(n > 1e-12); return mul(a, 1/n); };
const key = (a, b) => a < b ? a + ':' + b : b + ':' + a;
const triangles = faces => faces.flatMap(f => f.length === 3 ? [f] : [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]);

function adjacency(mesh) {
    const { positions: p, faces } = mesh, edges = new Map();
    const vf = p.map(() => []), ve = p.map(() => new Set()), boundary = p.map(() => []);
    faces.forEach((f, fi) => {
        pulse(); assert.ok(f.length === 4 && new Set(f).size === 4);
        f.forEach((a, i) => {
            assert.ok(Number.isInteger(a) && a >= 0 && a < p.length);
            vf[a].push(fi); const b = f[(i + 1) % 4], k = key(a,b);
            if (!edges.has(k)) edges.set(k, { a, b, faces: [], directed: [] });
            edges.get(k).faces.push(fi); edges.get(k).directed.push([a,b]);
            ve[a].add(b); ve[b].add(a);
        });
    });
    for (const edge of edges.values()) {
        assert.ok(edge.faces.length === 1 || edge.faces.length === 2);
        if (edge.faces.length === 1) { boundary[edge.a].push(edge.b); boundary[edge.b].push(edge.a); }
        else assert.deepEqual(edge.directed[0], [...edge.directed[1]].reverse(), 'Opposite edge directions');
    }
    boundary.forEach(b => assert.ok(b.length === 0 || b.length === 2));
    return { edges, vf, ve, boundary };
}

// Independently authored quad refinement. Boundary has no special corner pins.
// The source reference supplies masks, not this cage, algorithm or executable.
function refine(mesh, paths) {
    const { positions: p, faces } = mesh, { edges, vf, ve, boundary } = adjacency(mesh);
    const fp = faces.map(f => mean(f.map(i => p[i]))), edgeIds = new Map();
    const np = p.map((v, i) => {
        const b = boundary[i];
        if (b.length) return add(mul(v,.75), mul(add(p[b[0]],p[b[1]]),.125));
        const neighbors = [...ve[i]], n = neighbors.length;
        assert.ok(n >= 3 && vf[i].length === n);
        return add(mul(v,(n-2)/n), mul(add(neighbors.map(j=>p[j]).reduce(add,[0,0,0]),vf[i].map(j=>fp[j]).reduce(add,[0,0,0])),1/(n*n)));
    });
    for (const [k,e] of edges) {
        edgeIds.set(k,np.length);
        np.push(e.faces.length===1 ? mul(add(p[e.a],p[e.b]),.5) : mul(add(add(p[e.a],p[e.b]),add(fp[e.faces[0]],fp[e.faces[1]])),.25));
    }
    const faceBase = np.length; np.push(...fp); const nf = [];
    faces.forEach((f,fi) => f.forEach((a,i) => nf.push([a,edgeIds.get(key(a,f[(i+1)%4])),faceBase+fi,edgeIds.get(key(f[(i+3)%4],a))])));
    const nextPaths = paths.map(path => {
        const result = [];
        path.forEach((a,i) => { result.push(a); if (i+1<path.length) { const e = edgeIds.get(key(a,path[i+1])); assert.ok(e !== undefined); result.push(e); } });
        return result;
    });
    return { mesh: { positions:np,faces:nf }, paths:nextPaths };
}

function boundaryLoops(mesh) {
    const { edges } = adjacency(mesh), next = new Map();
    for (const e of edges.values()) if (e.faces.length===1) { assert.ok(!next.has(e.a)); next.set(e.a,e.b); }
    const loops = [];
    while (next.size) {
        const first = next.keys().next().value, loop = []; let a = first;
        do { assert.ok(next.has(a)); loop.push(a); const b=next.get(a); next.delete(a); a=b; assert.ok(loop.length<=mesh.positions.length); } while(a!==first);
        loops.push(loop);
    }
    return loops;
}

function normals(p, ts) {
    const n = p.map(() => [0,0,0]);
    for (const [a,b,c] of ts) { pulse(); const v=cross(sub(p[b],p[a]),sub(p[c],p[a])); assert.ok(Math.hypot(...v)>1e-10,'Nondegenerate triangle'); for(const i of [a,b,c]) n[i]=add(n[i],v); }
    return n.map(unit);
}

function solidSheet(mesh, thickness, outerMaterial, innerMaterial, bridgeMaterial) {
    const ts=triangles(mesh.faces), ns=normals(mesh.positions,ts), n=mesh.positions.length;
    const p=[...mesh.positions.map(v=>[...v]),...mesh.positions.map((v,i)=>sub(v,mul(ns[i],thickness)))];
    const t=[...ts.map(v=>[...v]),...ts.map(([a,b,c])=>[c+n,b+n,a+n])];
    const materials=[...ts.map(()=>outerMaterial),...ts.map(()=>innerMaterial)];
    const loops=boundaryLoops(mesh);
    for(const loop of loops) for(let i=0;i<loop.length;i++) {
        const a=loop[i],b=loop[(i+1)%loop.length];t.push([b,a,a+n],[b,a+n,b+n]);materials.push(bridgeMaterial,bridgeMaterial);
    }
    return { positions:p,triangles:t,materials,offsetWitness:{thickness,outerVertices:n,loops:loops.map(v=>v.length)} };
}

function sampleUpper(upper, upperTriangles, x, z) {
    let highest = -Infinity, hits=0;
    for(const f of upperTriangles) {
        pulse(); const [a,b,c]=f.map(i=>upper.positions[i]);
        const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
        if(Math.abs(den)<1e-12) continue;
        const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
        const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
        if(Math.min(u,v,w)>=-1e-9) { highest=Math.max(highest,u*a[1]+v*b[1]+w*c[1]); hits++; }
    }
    assert.ok(hits>0 && Number.isFinite(highest),'Own-upper embedding point covered'); return highest;
}

function plate(poly, bottom, top, material, preserveTop = false) {
    assert.ok(poly.length>=3 && top>bottom); const n=poly.length;
    const p=[...poly.map(v=>[v[0],preserveTop?v[1]:top,v[2]]),...poly.map(v=>[v[0],bottom,v[2]])];
    p.push(mean(p.slice(0,n)),mean(p.slice(n,2*n))); const t=[];
    for(let i=0;i<n;i++) { const j=(i+1)%n;t.push([i,j,2*n],[j+n,i+n,2*n+1],[j,i,i+n],[j,i+n,j+n]); }
    return { positions:p,triangles:t,materials:t.map(()=>material) };
}
function clip(poly, z, side) {
    const result=[];
    for(let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length],ai=side*(a[2]-z)>=0,bi=side*(b[2]-z)>=0;
        if(ai) result.push([...a]);
        if(ai!==bi) { const t=(z-a[2])/(b[2]-a[2]); result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),z]); }
    }
    // Only exact duplicate consecutive corner intersections are removed.
    return result.filter((v,i)=>JSON.stringify(v)!==JSON.stringify(result[(i+result.length-1)%result.length]));
}
function scalePlan(poly, s) { const c=mean(poly);return poly.map(v=>[c[0]+s*(v[0]-c[0]),v[1],c[2]+s*(v[2]-c[2])]); }
function pipe(mesh,path,radius,offset,material) {
    const ns=normals(mesh.positions,triangles(mesh.faces)), centers=path.map(i=>add(mesh.positions[i],mul(ns[i],offset))),p=[],t=[];
    for(let i=0;i<path.length;i++) {
        const tangent=unit(sub(centers[Math.min(i+1,path.length-1)],centers[Math.max(0,i-1)]));
        const binormal=unit(cross(tangent,ns[path[i]])), normal=unit(cross(binormal,tangent));
        for(let j=0;j<6;j++) p.push(add(centers[i],add(mul(normal,radius*Math.cos(j*Math.PI/3)),mul(binormal,radius*Math.sin(j*Math.PI/3)))));
    }
    for(let i=0;i<path.length-1;i++) for(let j=0;j<6;j++) { const a=i*6+j,b=i*6+(j+1)%6,c=(i+1)*6+j,d=(i+1)*6+(j+1)%6;t.push([a,b,d],[a,d,c]); }
    const first=p.length;p.push(centers[0]);const last=p.length;p.push(centers.at(-1));
    for(let j=0;j<6;j++) { t.push([first,(j+1)%6,j]);const k=(path.length-1)*6;t.push([last,k+j,k+(j+1)%6]); }
    return {positions:p,triangles:t,materials:t.map(()=>material),pathWitness:{indices:path,radius,offset}};
}

function audit(part) {
    const {positions:p,triangles:t,materials}=part,edges=new Map(),links=p.map(()=>[]); let volume=0;
    assert.equal(materials.length,t.length);assert.ok(p.every(v=>v.length===3&&v.every(Number.isFinite)));
    for(const [a,b,c] of t) {
        pulse(); assert.ok(new Set([a,b,c]).size===3); for(const i of [a,b,c]) assert.ok(Number.isInteger(i)&&i>=0&&i<p.length);
        assert.ok(Math.hypot(...cross(sub(p[b],p[a]),sub(p[c],p[a])))>1e-10);
        volume+=dot(p[a],cross(p[b],p[c]))/6;
        for(const [i,j,k] of [[a,b,c],[b,c,a],[c,a,b]]) { const e=key(i,j);if(!edges.has(e))edges.set(e,[]);edges.get(e).push([i,j]);links[i].push([j,k]); }
    }
    for(const e of edges.values()) assert.ok(e.length===2&&e[0][0]===e[1][1]&&e[0][1]===e[1][0],'Closed oriented edge');
    for(const fan of links) {
        const graph=new Map();for(const [a,b]of fan)for(const [i,j]of [[a,b],[b,a]]){if(!graph.has(i))graph.set(i,[]);graph.get(i).push(j);}
        assert.ok(graph.size>=3&&[...graph.values()].every(v=>v.length===2),'Vertex link degree');
        const reached=new Set(),todo=[graph.keys().next().value];while(todo.length){const a=todo.pop();if(reached.has(a))continue;reached.add(a);todo.push(...graph.get(a).filter(v=>!reached.has(v)));}assert.equal(reached.size,graph.size,'Single cyclic vertex link');
    }
    assert.ok(volume>1e-10,'Positive oriented artist volume');
    return {vertices:p.length,triangles:t.length,edges:edges.size,euler:p.length-edges.size+t.length,signedVolume:volume};
}

async function main() {
    guard(); const admissionBytes=await fs.readFile(leaf+'CPU-ADMISSION.json');
    assert.equal(process.env.NODE_OPTIONS,'');assert.equal(process.env.NODE_PATH,'');
    assert.deepEqual(process.execArgv,['--max-old-space-size=128']);
    assert.equal(sha(admissionBytes),process.env.SUGATA_ADMISSION_SHA256,'Exact root admission');
    const admission=JSON.parse(admissionBytes);assert.equal(admission.status,'ADMITTED_ONE_CPU_BUILD');
    assert.ok(Date.now()<Date.parse(admission.expires_utc));assert.equal(admission.absolute_stop_utc,'2026-10-19T19:37:55.992117+00:00');
    assert.deepEqual(process.argv.slice(1),[fileURLToPath(import.meta.url)]);
    for(const row of admission.inputs) {guard();const bytes=await fs.readFile(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,row.path);}
    assert.ok(Date.now()<Date.parse(admission.expires_utc));guard();
    await fs.mkdir(out,{recursive:false});ownedOut=true;
    const design=JSON.parse(await fs.readFile(leaf+'design.json','utf8'));assert.equal(design.subdivision_steps,2);
    const original=design.upper.rows.flatMap(row=>row.xy.map(([x,y])=>[x,y,row.z]));assert.equal(original.length,99);
    const used=[...new Set(design.upper.quads.flat())].sort((a,b)=>a-b),map=new Map(used.map((id,i)=>[id,i]));assert.equal(used.length,90);
    assert.deepEqual(original.map((_,i)=>i).filter(i=>!map.has(i)),design.upper.unused_original_ids);
    let upper={positions:used.map(i=>original[i]),faces:design.upper.quads.map(f=>f.map(i=>map.get(i)))};
    assert.equal(adjacency(upper).edges.size,154);
    assert.deepEqual(boundaryLoops(upper),[design.upper.outer_boundary_original_ids,design.upper.entry_boundary_original_ids].map(loop=>loop.map(i=>map.get(i))));
    let paths=[design.upper.apron_path_original_ids,design.upper.counter_path_original_ids].map(path=>path.map(i=>map.get(i)));
    for(let i=0;i<2;i++) ({mesh:upper,paths}=refine(upper,paths));
    assert.equal(upper.positions.length,1128);assert.equal(upper.faces.length,1024);
    const loops=boundaryLoops(upper).sort((a,b)=>b.length-a.length);assert.deepEqual(loops.map(v=>v.length),[144,64]);
    const footprint=loops[0].map(i=>upper.positions[i]);footprint.forEach(p=>assert.ok(Math.abs(p[1]-.23)<1e-12));
    let saddle={positions:[...design.saddle.outer_xz,...design.saddle.inner_xz].map(([x,z])=>[x,0,z]),faces:Array.from({length:16},(_,i)=>[i,(i+1)%16,16+(i+1)%16,16+i])};
    for(let i=0;i<2;i++) saddle=refine(saddle,[]).mesh;
    assert.equal(saddle.positions.length,320);assert.equal(saddle.faces.length,256);
    const upperTriangles=triangles(upper.faces);
    saddle.positions=saddle.positions.map(([x,,z])=>[x,sampleUpper(upper,upperTriangles,x,z)+design.saddle.vertical_embedding_offset,z]);
    const heel=clip(footprint,-.85,-1),forepart=clip(footprint,-.10,1);
    const parts=[
        solidSheet(upper,design.upper.inward_normal_offset,0,2,2),
        solidSheet(saddle,design.saddle.inward_normal_offset,1,1,1),
        plate(footprint,.10,.23,3,true),plate(forepart,.025,.10,4),plate(heel,-.045,.10,3),
        plate(scalePlan(heel,.94),-.08,-.045,4),plate(scalePlan(footprint,.90),.235,.25,2),
        pipe(upper,paths[0],design.detail_policy.apron_radius,design.detail_policy.apron_normal_offset,5),
        pipe(upper,paths[1],design.detail_policy.counter_radius,design.detail_policy.counter_normal_offset,1)
    ].map((part,i)=>({...part,id:design.parts[i]}));
    let vertices=0,tris=0;const audits=parts.map(part=>{const a=audit(part);vertices+=a.vertices;tris+=a.triangles;return {id:part.id,...a};});
    assert.equal(parts.length,9);assert.ok(vertices<=5490&&tris<=10952&&vertices<=8192&&tris<=16000);
    assert.deepEqual(parts.slice(0,2).map(p=>[p.positions.length,p.triangles.length]),[[2256,4512],[640,1280]]);
    const contacts=loops[0].map((index,i)=>({upper:index,sole:i}));contacts.forEach(({upper:index,sole})=>assert.deepEqual(parts[0].positions[index],parts[2].positions[sole]));
    const model={schema:'mara-loafer-original-cage-volume-v1',qualification:design.qualification,frame:design.frame,materials:design.materials,parts,audits,contacts,cage:{usedOriginalIds:used,upperOriginal:original,quads:design.upper.quads,subdivisionSteps:2,boundaryPolicy:design.boundary_policy,refinedUpper:upper,refinedPaths:paths},limits:design.limits};
    const modelText=JSON.stringify(model)+'\n';assert.ok(Buffer.byteLength(modelText)<=2097152);
    let obj='# Original unitless Mara loafer artist source; no last/fit/manufacturing claim\nmtllib materials.mtl\n',base=1;
    for(const part of parts) { obj+='o '+part.id+'\ns 1\n';for(const v of part.positions)obj+='v '+v.map(x=>x.toFixed(8)).join(' ')+'\n';let material=-1;part.triangles.forEach((f,i)=>{if(part.materials[i]!==material){material=part.materials[i];obj+='usemtl '+design.materials[material].id+'\n';}obj+='f '+f.map(x=>x+base).join(' ')+'\n';});base+=part.positions.length; }
    const mtl=design.materials.map(m=>{const rgb=[1,3,5].map(i=>parseInt(m.colour.slice(i,i+2),16)/255);return 'newmtl '+m.id+'\nKd '+rgb.map(v=>v.toFixed(6)).join(' ')+'\nNs 12\n';}).join('\n');
    assert.ok(Buffer.byteLength(obj)<=2097152&&Buffer.byteLength(mtl)<=8192);guard();
    for(const [name,text]of [['model.json',modelText],['loafer.obj',obj],['materials.mtl',mtl]]) {guard();await fs.writeFile(out+name,text,{flag:'wx'});}
    return {status:'PASS',vertices,triangles:tris,parts:parts.length,audits,sharedOuterContacts:contacts.length,outputs:[['model.json',modelText],['loafer.obj',obj],['materials.mtl',mtl]].map(([name,text])=>({name,bytes:Buffer.byteLength(text),sha256:sha(text)}))};
}
let result;
try { result=await main();guard(); }
catch(error) {process.exitCode=1;result={status:'FAILED',error:String(error?.stack??error)};}
result={schema:'mara-loafer-single-build-result-v1',...result,pid:process.pid,utc:new Date().toISOString(),node:process.versions.node,postImportMs:performance.now()-started,sampledRss:process.memoryUsage().rss,guardSamples:samples,loopSteps,limits:'One new unitless artist cage/model; data only, no appearance/physical cavity/fit/client/GPU/physical release/performance qualification.'};
const text=JSON.stringify(result,null,2)+'\n';
assert.ok(Buffer.byteLength(text)<=32768);
if(ownedOut) {try {await fs.writeFile(out+'BUILD-RESULT.json',text,{flag:'wx'});} catch(error){process.exitCode=1;process.stderr.write('Result write failed: '+String(error)+'\n');}}
process.stdout.write(text);
