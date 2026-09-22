// Recover the proposed bounded fit support. This inspects topology; it never fits or exports a GLB.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readGlb, readPrimitive, readAccessor} from '../lut-bake/glb.mjs';
import {transformCasualTrouserFit} from './casual_trouser_fit.mjs';
import {transformCasualCollarFit, CASUAL_COLLAR_FIT} from './casual_collar_fit.mjs';
import {collarBand} from './collar_lining_topology.mjs';
import {sha256} from './collar_stress_inputs.mjs';

export function deriveFitSupport(source, joints, weights, interiorTriangles) {
    const seeds=[544,545,1327,1328,1329,1331], rearFace=1515;
    assert.equal(source.vertexCount,2377);
    const groups=[],byPosition=new Map(),groupOf=[];
    for(let i=0;i<source.vertexCount;i++){
        const p=Array.from(source.positions.slice(3*i,3*i+3));
        const key=p.map(v=>Math.round(v/1e-7)).join(':');
        if(!byPosition.has(key)){byPosition.set(key,groups.length);groups.push({id:groups.length,position:p,vertices:[],neighbors:new Map(),distance:Infinity});}
        const g=byPosition.get(key);groupOf[i]=g;groups[g].vertices.push(i);
    }
    for(let t=0;t<source.indices.length;t+=3)for(let k=0;k<3;k++){
        const a=groupOf[source.indices[t+k]],b=groupOf[source.indices[t+(k+1)%3]];
        const distance=Math.hypot(...groups[a].position.map((v,k)=>v-groups[b].position[k]));
        groups[a].neighbors.set(b,distance);groups[b].neighbors.set(a,distance);
    }
    const boundary=collarBand(source.positions,source.indices,{width:.045});
    for(const vertices of boundary.boundaryVertices)groups[groupOf[vertices[0]]].distance=0;
    const pending=new Set(groups.map(g=>g.id));
    while(pending.size){
        let best=null;for(const id of pending)if(best===null||groups[id].distance<groups[best].distance)best=id;
        if(groups[best].distance>=.045)break;
        pending.delete(best);
        for(const [id,distance] of groups[best].neighbors)groups[id].distance=Math.min(groups[id].distance,groups[best].distance+distance);
    }
    const faceGroups=faces=>new Set(faces.flatMap(t=>Array.from(source.indices.slice(3*t,3*t+3),i=>groupOf[i])));
    const ring=faces=>{const original=faceGroups(faces),all=new Set(original);for(const id of original)for(const neighbor of groups[id].neighbors.keys())all.add(neighbor);return all;};
    const proposed=ring(seeds),rear=ring([rearFace]);
    const movable=[...proposed].filter(id=>groups[id].distance<.045&&groups[id].position[1]>1.32).sort((a,b)=>a-b);
    const fixed=[...proposed].filter(id=>!movable.includes(id)).sort((a,b)=>a-b);
    assert.ok(movable.every(id=>!rear.has(id)),'Moving support overlaps the fixed rear guard');
    const vertices=movable.flatMap(id=>groups[id].vertices).sort((a,b)=>a-b),selected=new Set(vertices);
    const incident=[];
    for(let t=0;t<source.indices.length;t+=3)if(Array.from(source.indices.slice(t,t+3)).some(i=>selected.has(i)))incident.push(t/3);
    for(const id of movable){
        const [first,...duplicates]=groups[id].vertices;
        for(const vertex of duplicates)for(const [name,values] of [['joints',joints],['weights',weights]])
            assert.deepEqual(values.slice(4*vertex,4*vertex+4),values.slice(4*first,4*first+4),`Welded group ${id} has different ${name}`);
    }
    const outsideInterior=incident.filter(t=>!interiorTriangles.includes(t));
    assert.equal(movable.length,34);assert.equal(vertices.length,43);assert.equal(incident.length,91);
    assert.equal(fixed.length,1);assert.equal(outsideInterior.length,10);
    const describe=id=>({group:id,vertices:groups[id].vertices,sourcePosition:groups[id].position,distanceFromRim:groups[id].distance});
    return {seeds,movingGroups:movable.map(describe),movingVertices:vertices,incidentTriangles:incident,
        incidentOutsideInterior:outsideInterior,fixedContactGroups:fixed.map(describe),rearGuard:{face:rearFace,
            groups:[...rear].sort((a,b)=>a-b),vertices:[...rear].flatMap(id=>groups[id].vertices).sort((a,b)=>a-b)},
        maximumAdditionalDisplacementMetres:.003,minimumSeedBraSeparationMetres:.0005,
        minimumNormalDot:.95,areaRatioRange:[.8,1.25]};
}

export function inspectFitSupport() {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sugata-fit-support-'));
    try{
        const previous=transformCasualTrouserFit(),candidate=transformCasualCollarFit();
        const sourceFile=path.join(directory,'source.glb'),candidateFile=path.join(directory,'candidate.glb');
        fs.writeFileSync(sourceFile,previous.bytes);fs.writeFileSync(candidateFile,candidate.bytes);
        const glb=readGlb(sourceFile),source=readPrimitive(glb,CASUAL_COLLAR_FIT.garment);
        const attrs=glb.json.meshes.find(m=>m.name===CASUAL_COLLAR_FIT.garment).primitives[0].attributes;
        const interior=readGlb(candidateFile).json.meshes.find(m=>m.name===CASUAL_COLLAR_FIT.garment).extras.sugataInterior.triangles;
        return {version:1,status:'Proposed support recovered; no solve, candidate export or fit qualification.',
            sourceSHA256:sha256(previous.bytes),candidateSHA256:sha256(candidate.bytes),
            instrumentSHA256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
            support:deriveFitSupport(source,readAccessor(glb,attrs.JOINTS_0).data,readAccessor(glb,attrs.WEIGHTS_0).data,interior)};
    }finally{fs.rmSync(directory,{recursive:true});}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    assert.equal(process.argv.length,3,'Usage: node collar_fit_support.mjs NEW_REPORT.json');
    const report=inspectFitSupport();fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log('Recovered 34 welded groups / 43 vertices / 91 faces; joint/weight agreement and disjoint rear guard pass. No geometry changed.');
}
