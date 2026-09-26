// Evidence-local arithmetic. No renderer, GLB mutation, native MPFB or fit qualification.
import assert from 'node:assert/strict';

export const SCALE = Math.fround(0.1);
export const BASE_COUNT = 19158;
export const BODY_COUNT = 13380;
export const MAPPED_GATE_MM = 0.001;
const f = Math.fround;
function finite(x) { assert.equal(typeof x, 'number'); assert.ok(Number.isFinite(x), 'Nonfinite number'); return x; }
function index(x, n) { assert.ok(Number.isSafeInteger(x) && x >= 0 && x < n, 'Invalid source index'); return x; }
function floats(a, count = a.length) {
    assert.ok(Array.isArray(a) || ArrayBuffer.isView(a));
    assert.equal(a.length, count);
    for (const x of a) finite(x);
}
function checkedF(x) { finite(x); return finite(f(x)); }

export function parseOBJPositions(text, count = BASE_COUNT) {
    const rows = text.split(/\r?\n/).filter(l => /^v\s/.test(l)).map(l => {
        const w = l.trim().split(/\s+/); assert.equal(w.length, 4);
        const v = w.slice(1).map(Number); floats(v, 3); return v;
    });
    assert.equal(rows.length, count, 'OBJ vertex count changed');
    return Float64Array.from(rows.flat());
}

function checkTarget(records, count) {
    assert.ok(Array.isArray(records)); const seen = new Set();
    for (const row of records) {
        floats(row, 4); index(row[0], count);
        assert.ok(!seen.has(row[0]), 'Repeated target index'); seen.add(row[0]);
    }
}

// Explicit CPU model: stored float32 basis/keys/weights, ordered float32 relative-key sum.
// Blender importer/evaluator operation ordering is not observed by this CPU instrument.
export function reconstructBaseline(obj, targets, { bodyCount = BODY_COUNT } = {}) {
    floats(obj); assert.equal(obj.length % 3, 0);
    const count = obj.length / 3; index(bodyCount - 1, count);
    const basis = new Float32Array(obj.length);
    for (let i = 0; i < count; i++) {
        basis[3*i] = checkedF(checkedF(obj[3*i]) * SCALE);
        basis[3*i+1] = checkedF(-checkedF(obj[3*i+2]) * SCALE);
        basis[3*i+2] = checkedF(checkedF(obj[3*i+1]) * SCALE);
    }
    const keys = targets.map(t => {
        finite(t.weight); checkTarget(t.records, count);
        const positions = basis.slice();
        for (const [i,x,y,z] of t.records) {
            positions[3*i] = checkedF(basis[3*i] + x*SCALE);
            positions[3*i+1] = checkedF(basis[3*i+1] - z*SCALE);
            positions[3*i+2] = checkedF(basis[3*i+2] + y*SCALE);
        }
        return { positions, weight: checkedF(t.weight) };
    });
    function mix() {
        const out = basis.slice();
        for (const key of keys) for (let i=0; i<out.length; i++)
            out[i] = checkedF(out[i] + checkedF(checkedF(key.positions[i] - basis[i]) * key.weight));
        return out;
    }
    const before = mix();
    let minZ = Infinity, lowestIndex = -1;
    for (let i=0; i<bodyCount; i++) if (before[3*i+2] < minZ) { minZ = before[3*i+2]; lowestIndex = i; }
    const ground = Math.abs(minZ);
    for (let i=0; i<count; i++) {
        basis[3*i+2] = checkedF(basis[3*i+2] + ground);
        for (const key of keys) key.positions[3*i+2] = checkedF(key.positions[3*i+2] + ground);
    }
    // Reapplying the same already-loaded macro targets changes no key or weight.
    return { positions: mix(), grounding: { minZ, translationZ: ground, lowestIndex, bodyCount } };
}

export function mappedResidual(blender, gltf, mapping, gateMm = MAPPED_GATE_MM) {
    floats(blender); floats(gltf, mapping.length*3); finite(gateMm); assert.ok(gateMm > 0);
    let squared = 0, maxMm = -1, worst = null, exactPositions = 0;
    const perAxisMaxMm = [0,0,0];
    for (let i=0; i<mapping.length; i++) {
        const source = index(mapping[i], blender.length/3);
        const predicted = [blender[source*3], blender[source*3+2], -blender[source*3+1]];
        const actual = Array.from(gltf.slice(i*3,i*3+3));
        const d = predicted.map((x,c) => x-actual[c]);
        const mm = Math.hypot(...d)*1000; finite(mm); squared += mm*mm;
        d.forEach((x,c)=>perAxisMaxMm[c]=Math.max(perAxisMaxMm[c],Math.abs(x)*1000));
        if (d.every(x=>x===0)) exactPositions++;
        if (mm > maxMm) { maxMm=mm; worst={position:i,sourceIndex:source,predicted,actual,deltaM:d}; }
    }
    assert.ok(mapping.length > 0); finite(squared);
    return { passed:maxMm < gateMm, gateMm, strict:true, positions:mapping.length,
        uniqueSources:new Set(mapping).size, maxMm, rmsMm:Math.sqrt(squared/mapping.length), perAxisMaxMm, exactPositions, worst };
}

export function parseMhclo(text, { bodyCount = BASE_COUNT, garmentCount = 2197 } = {}) {
    const rules=[], scales={}; let section='', found=false;
    for (const line of text.split(/\r?\n/)) {
        const w=line.trim().split(/\s+/); if (!line.trim() || w[0].startsWith('#')) continue;
        if (w[0]==='verts') { assert.ok(!found); assert.deepEqual(w,['verts','0']); found=true; section='verts'; continue; }
        if (/^[xyz]_scale$/.test(w[0])) {
            assert.equal(w.length,4); assert.ok(!Object.hasOwn(scales,w[0]));
            const [a,b,denominator]=w.slice(1).map(Number); index(a,bodyCount);index(b,bodyCount); finite(denominator);assert.ok(denominator>0);
            scales[w[0]]={indices:[a,b],denominator}; continue;
        }
        if (section==='verts' && /^\d+$/.test(w[0])) {
            assert.ok(w.length===1 || w.length===9, 'Malformed mhclo rule');
            const n=w.map(Number); floats(n);
            const indices=(n.length===1 ? [n[0],n[0],n[0]] : n.slice(0,3)); indices.forEach(i=>index(i,bodyCount));
            rules.push({ indices, weights:n.length===1 ? [1,0,0] : n.slice(3,6),
                offsets:n.length===1 ? [0,0,0] : [n[6],-n[8],n[7]] }); continue;
        }
        if (section==='verts') { assert.equal(w[0],'delete_verts','Unexpected token inside mhclo vertex section'); section=''; }
    }
    assert.ok(found);assert.equal(rules.length,garmentCount);
    assert.deepEqual(Object.keys(scales).sort(),['x_scale','y_scale','z_scale']);
    return { format:'sugata-cached-mhclo-v1', space:'blender-z-up-metres', bodyCount, garmentCount, rules, scales };
}

export function requiredIndices(model) {
    return [...new Set([...model.rules.flatMap(r=>r.indices),...Object.values(model.scales).flatMap(s=>s.indices)])].sort((a,b)=>a-b);
}

export function compactBody(positions, indices) {
    floats(positions);assert.equal(positions.length%3,0);
    assert.ok(new Set(indices).size===indices.length);
    return { indices:[...indices], positions:Float64Array.from(indices.flatMap(i=>{
        index(i,positions.length/3); return Array.from(positions.slice(3*i,3*i+3));
    })) };
}

// Portable packets retain only target records for their explicitly listed body dependencies.
// This is the existing packed-data operation: float32 raw*scale, then weighted double sum.
export function applyCompactDetails(body, targets, weights) {
    floats(body.positions,body.indices.length*3);assert.equal(targets.length,weights.length);
    const rows=new Map();
    body.indices.forEach((i,k)=>{index(i,BASE_COUNT);assert.ok(!rows.has(i));rows.set(i,k);});
    const delta=new Float64Array(body.positions.length);
    targets.forEach((target,k)=>{
        finite(weights[k]);assert.ok(weights[k]>=0 && weights[k]<=1);
        checkTarget(target.records,BASE_COUNT);
        for(const [id,x,y,z] of target.records) {
            assert.ok(rows.has(id),'Target record outside declared compact dependency set');
            const i=rows.get(id)*3;
            delta[i]+=checkedF(x*SCALE)*weights[k];
            delta[i+1]-=checkedF(z*SCALE)*weights[k];
            delta[i+2]+=checkedF(y*SCALE)*weights[k];
        }
    });
    floats(delta);
    return {indices:[...body.indices],positions:Float64Array.from(body.positions,(x,i)=>finite(x+delta[i])),delta};
}

// Fixed mhclo semantics; double mode is an analytic reference, NOT a native oracle.
export function fitMhclo(model, body, { arithmetic = 'float32-vector' } = {}) {
    assert.ok(arithmetic==='float32-vector' || arithmetic==='float64-reference');
    assert.equal(model.format,'sugata-cached-mhclo-v1');assert.equal(model.space,'blender-z-up-metres');
    assert.equal(model.rules.length,model.garmentCount);
    floats(body.positions,body.indices.length*3);
    const rows=new Map();
    for (let k=0;k<body.indices.length;k++) { const i=index(body.indices[k],model.bodyCount); assert.ok(!rows.has(i)); rows.set(i,k); }
    const F=arithmetic==='float32-vector' ? checkedF : finite;
    function V(i,c) { index(i,model.bodyCount); assert.ok(rows.has(i),'Missing required helper/body coordinate'); return F(body.positions[rows.get(i)*3+c]); }
    function size(name,axis) {
        const s=model.scales[name];assert.ok(s);floats(s.indices,2);finite(s.denominator);assert.ok(s.denominator>0);
        // Vector item access yields Python scalar floats; the ratio is a scalar double.
        return finite(Math.abs(V(s.indices[0],axis)-V(s.indices[1],axis))/s.denominator);
    }
    const scale={x:size('x_scale',0),y:size('y_scale',2),z:size('z_scale',1)};
    assert.ok(scale.x>0 && scale.y>0 && scale.z>0,'Collapsed scale references');
    const positions=new Float64Array(model.garmentCount*3);
    for (let i=0;i<model.rules.length;i++) {
        const r=model.rules[i];floats(r.indices,3);floats(r.weights,3);floats(r.offsets,3);
        // mathutils Vector converts offset components/scalars to floats; no normalization.
        const offsets=r.offsets.map(F), weights=r.weights.map(F), scales=[scale.x,scale.z,scale.y];
        for(let c=0;c<3;c++) {
            const a=F(weights[0]*V(r.indices[0],c)),b=F(weights[1]*V(r.indices[1],c)),d=F(weights[2]*V(r.indices[2],c));
            positions[3*i+c]=F(F(F(a+b)+d)+F(offsets[c]*scales[c]));
        }
    }
    return { positions, scale, arithmetic };
}
