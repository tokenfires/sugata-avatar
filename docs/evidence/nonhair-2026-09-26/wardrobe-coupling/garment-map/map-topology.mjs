// Correspondence uses UV storage bits and face IDs only. Positions are never accepted here.
import assert from 'node:assert/strict';
const f=Math.fround;
function finite(x){assert.ok(typeof x==='number'&&Number.isFinite(x));return x;}
function index(x,n){assert.ok(Number.isSafeInteger(x)&&x>=0&&x<n,'Invalid discrete index');return x;}
const bitsBuffer=new ArrayBuffer(4),bitsFloat=new Float32Array(bitsBuffer),bitsInt=new Uint32Array(bitsBuffer);
export function uvKey(u,v){finite(u);finite(v);bitsFloat[0]=u;const a=bitsInt[0];bitsFloat[0]=v;const b=bitsInt[0];assert.ok(Number.isFinite(f(u))&&Number.isFinite(f(v)));return a+':'+b;}
export function sourceUV(uv){assert.equal(uv.length,2);finite(uv[0]);finite(uv[1]);return [f(uv[0]),f(1-f(uv[1]))];}
const cornerKey=(v,uv)=>v+'@'+uv;
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
const cyclicKey=a=>a.map((_,i)=>[...a.slice(i),...a.slice(0,i)].join(':')).sort()[0];

export function parseOBJ(text){
    let vertexCount=0;const texcoords=[],faces=[];
    for(const line of text.split(/\r?\n/)){
        const w=line.trim().split(/\s+/);if(!line.trim()||w[0].startsWith('#'))continue;
        if(w[0]==='v'){assert.equal(w.length,4);w.slice(1).map(Number).forEach(finite);vertexCount++;}
        else if(w[0]==='vt'){assert.equal(w.length,3);texcoords.push(w.slice(1).map(Number));texcoords.at(-1).forEach(finite);}
        else if(w[0]==='f'){
            assert.equal(w.length,5,'This fixed source is quad-only');
            faces.push(w.slice(1).map(s=>{const p=s.split('/');assert.equal(p.length,2);return {vertex:Number(p[0])-1,uv:Number(p[1])-1};}));
        }else throw Error('Unsupported source OBJ row: '+w[0]);
    }
    assert.ok(vertexCount&&texcoords.length&&faces.length);
    for(const face of faces){assert.equal(new Set(face.map(c=>c.vertex)).size,4);for(const c of face){index(c.vertex,vertexCount);index(c.uv,texcoords.length);}}
    return {vertexCount,texcoords,faces};
}

export function establishMap(obj,gltfUV,indices){
    assert.equal(gltfUV.length%2,0);assert.equal(indices.length%3,0);
    const vertexCount=gltfUV.length/2,byUV=new Map(),byCorner=new Map();
    const sourceKeys=obj.texcoords.map(t=>uvKey(...sourceUV(t)));
    obj.faces.forEach((face,faceID)=>face.forEach(c=>{
        index(c.vertex,obj.vertexCount);index(c.uv,obj.texcoords.length);
        const key=sourceKeys[c.uv];if(!byUV.has(key))byUV.set(key,new Map());
        const candidates=byUV.get(key);if(!candidates.has(c.vertex))candidates.set(c.vertex,new Set());candidates.get(c.vertex).add(c.uv);
        const ck=cornerKey(c.vertex,key);if(!byCorner.has(ck))byCorner.set(ck,new Set());byCorner.get(ck).add(faceID);
    }));
    const map=[],witnesses=[],unresolved=[],gKeys=[];
    for(let i=0;i<vertexCount;i++){
        const u=gltfUV[2*i],v=gltfUV[2*i+1];finite(u);finite(v);
        assert.equal(f(u),u,'GLB UV must already be float32');assert.equal(f(v),v);
        const key=uvKey(u,v);gKeys.push(key);const candidates=byUV.get(key)??new Map();
        if(candidates.size!==1){unresolved.push({gltfVertex:i,uvBits:key,candidateSourceVertices:[...candidates.keys()].sort((a,b)=>a-b)});map.push(null);continue;}
        const sourceVertex=[...candidates.keys()][0];map.push(sourceVertex);
        witnesses.push({gltfVertex:i,sourceVertex,uvBits:key,objTexcoordIDs:[...candidates.get(sourceVertex)].sort((a,b)=>a-b)});
    }
    // Intentionally no guessed coordinate/topology fallback for ambiguous UV records.
    if(unresolved.length)return {status:'unresolved',unresolved,map,witnesses};
    assert.equal(new Set(gKeys).size,vertexCount,'Expected unique GLB UV pairs on this fixed asset');
    const triangleSourceFace=[],faceTriangles=obj.faces.map(()=>[]),usedGLTF=new Set();
    for(let t=0;t<indices.length/3;t++){
        const g=Array.from(indices.slice(t*3,t*3+3));g.forEach(i=>{index(i,vertexCount);usedGLTF.add(i);});
        const source=g.map(i=>map[i]);assert.equal(new Set(source).size,3,'Degenerate mapped triangle');
        let possible=null;
        for(const i of g){const set=byCorner.get(cornerKey(map[i],gKeys[i]))??new Set();possible=possible===null?new Set(set):new Set([...possible].filter(x=>set.has(x)));}
        assert.equal(possible.size,1,'Triangle does not identify one source quad');
        const faceID=[...possible][0],face=obj.faces[faceID].map(c=>c.vertex);
        const ordered=face.filter(v=>source.includes(v));
        assert.equal(cyclicKey(source),cyclicKey(ordered),'Triangle reverses source winding');
        triangleSourceFace.push(faceID);faceTriangles[faceID].push(t);
    }
    for(let faceID=0;faceID<obj.faces.length;faceID++){
        const ts=faceTriangles[faceID];assert.equal(ts.length,2,'Each source quad must have exactly two triangles');
        const edges=new Map(),directions=new Map(),all=[];
        for(const t of ts){const tri=Array.from(indices.slice(t*3,t*3+3),i=>map[i]);all.push(...tri);
            for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],e=edgeKey(a,b);edges.set(e,(edges.get(e)??0)+1);directions.set(e,(directions.get(e)??0)+(a<b?1:-1));}}
        assert.equal(new Set(all).size,4,'Triangles do not cover all source corners');
        const face=obj.faces[faceID].map(c=>c.vertex),boundary=new Set(face.map((a,k)=>edgeKey(a,face[(k+1)%4])));
        assert.equal(edges.size,5);assert.equal([...edges.values()].filter(n=>n===2).length,1);
        for(const [e,n]of edges){if(boundary.has(e))assert.equal(n,1);else{assert.equal(n,2);assert.equal(directions.get(e),0,'Diagonal orientation does not cancel');}}
    }
    assert.equal(usedGLTF.size,vertexCount);assert.equal(new Set(map).size,obj.vertexCount);
    return {status:'unique',map,witnesses,triangleSourceFace,faceTriangles,unresolved:[],
        counts:{gltfVertices:vertexCount,sourceVertices:obj.vertexCount,sourceTexcoordRecords:obj.texcoords.length,
            sourceDistinctTransformedUVPairs:byUV.size,gltfTriangles:indices.length/3,sourceQuads:obj.faces.length,
            uvRecordsWithEquivalentDuplicateIDs:witnesses.filter(w=>w.objTexcoordIDs.length>1).length}};
}

export function validateMap(candidate,obj,gltfUV,indices){
    const proof=establishMap(obj,gltfUV,indices);assert.equal(proof.status,'unique');assert.deepEqual(candidate,proof.map,'Candidate map contradicts discrete UV/topology');return proof;
}
