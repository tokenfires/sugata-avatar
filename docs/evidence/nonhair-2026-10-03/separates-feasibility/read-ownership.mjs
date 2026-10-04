import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {readGlb, readAccessor} from '../../../../tools/lut-bake/glb.mjs';

const started = new Date().toISOString(), folder = new URL('./', import.meta.url);
const root = new URL('../../../../', import.meta.url), pins = [];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function pin(file, expected) {
    const bytes = fs.readFileSync(new URL(file, root));
    const row = {file, bytes:bytes.length, sha256:sha(bytes)};
    if (expected) assert.equal(row.sha256, expected, file);
    pins.push(row); return bytes;
}
pin('assets/wardrobe/manifest.json', 'c537f9d376942dc886c1aad3b3d4327a45cd61cfbe7d45d2194fd54bddee7688');
pin('packages/core/src/wardrobe/WardrobeStyles.js', '7dcfc646d6d3fd50a739e4ac4ff36a86b422bf581ae5170c610e3e21e9ac0089');
pin('tools/lut-bake/glb.mjs');
const manifest = JSON.parse(fs.readFileSync(new URL('assets/wardrobe/manifest.json', root)));
const definitions = [
    {id:'female_casualsuit01', file:'assets/wardrobe/female_casualsuit01/g050.glb', hashes:['44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783','d81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a'], label:i=>i>=1427?'denim':'tee'},
    {id:'female_elegantsuit01', file:'assets/wardrobe/female_elegantsuit01/g050.glb', hashes:['0acd22bbf9a847de6fa051bec0860157b72ba626f9504a26f8313713938f1440'], label:i=>i<408?'skirt':'blouse'}
];
const declarations = definitions.map(({id})=>{
    const entry=manifest.garments.find(x=>x.id===id); assert.ok(entry);
    return {id, layer:entry.layer, slots:entry.slots, hideMask:entry.hideMask, fragments:entry.fragments};
});
function metadata(glb, attrs) {
    return Object.fromEntries(Object.entries(attrs).map(([name,index])=>{
        const a=glb.json.accessors[index];
        return [name,{accessor:index, componentType:a.componentType, type:a.type, count:a.count, normalized:a.normalized??false, sparse:a.sparse?.count??0}];
    }));
}
function masks(glb, attrs) {
    return Object.entries(attrs).filter(([name])=>/^_(HIDE|UNDER)_/i.test(name)).map(([name,index])=>{
        const a=readAccessor(glb,index); assert.equal(a.components,1);
        return {name, accessor:index, count:a.count, flagged:a.data.reduce((n,v)=>n+(v!==0),0)};
    });
}
const garments=[];
for (const def of definitions) {
    const bytes=pin(def.file); assert.ok(def.hashes.includes(sha(bytes)), 'unqualified garment bytes');
    const glb=readGlb(new URL(def.file,root)), meshes=[];
    for (const [meshIndex,mesh] of glb.json.meshes.entries()) {
        for (const [primitiveIndex,p] of mesh.primitives.entries()) {
            assert.equal(p.mode??4,4,'triangles only');
            assert.ok(p.indices!==undefined && p.attributes.POSITION!==undefined);
            const position=readAccessor(glb,p.attributes.POSITION), idx=readAccessor(glb,p.indices);
            assert.equal(position.components,3); assert.equal(idx.components,1); assert.equal(idx.count%3,0);
            const count=position.count, parent=Array.from({length:count},(_,i)=>i), used=new Set(), byPart={}, mixed=[];
            function find(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;}
            function join(a,b){parent[find(a)]=find(b);}
            for(let t=0;t<idx.count/3;t++) {
                const corners=Array.from(idx.data.slice(t*3,t*3+3));
                assert.ok(corners.every(i=>Number.isInteger(i)&&i>=0&&i<count));
                for(const i of corners) used.add(i);
                join(corners[0],corners[1]); join(corners[1],corners[2]);
                const labels=new Set(corners.map(def.label));
                if(labels.size!==1) mixed.push({triangle:t,corners,labels:[...labels]});
                else (byPart[[...labels][0]]??=[]).push(t);
            }
            const groups=new Map(), aliases=new Map();
            for(const i of used) {
                const group=find(i); if(!groups.has(group)) groups.set(group,[]); groups.get(group).push(i);
                const xyz=Array.from(position.data.slice(i*3,i*3+3)); assert.ok(xyz.every(Number.isFinite));
                const key=xyz.map(v=>Object.is(v,-0)?'-0':String(v)).join(',');
                if(!aliases.has(key)) aliases.set(key,[]); aliases.get(key).push(i);
            }
            const aliasGroups=[...aliases].filter(([,vertices])=>vertices.length>1);
            const crossLabels=aliasGroups.filter(([,vertices])=>new Set(vertices.map(def.label)).size>1);
            const componentRows=[...groups.values()].map(vertices=>({vertices:vertices.length, labels:[...new Set(vertices.map(def.label))]})).sort((a,b)=>b.vertices-a.vertices);
            meshes.push({meshIndex,name:mesh.name,primitiveIndex,material:p.material,sourceVertexCount:count,usedVertexCount:used.size,sourceTriangleCount:idx.count/3,attributes:metadata(glb,p.attributes),regions:Object.fromEntries(Object.entries(byPart).map(([label,triangles])=>[label,{triangleCount:triangles.length,sourceTriangleOrdinals:triangles,ordinalJsonSha256:sha(JSON.stringify(triangles))}])),mixedTriangleCount:mixed.length,mixedTriangles:mixed,indexedComponents:componentRows,exactPositionAliases:{groups:aliasGroups.length,crossRegionGroups:crossLabels.length,crossRegionWitnesses:crossLabels.slice(0,8).map(([position,vertices])=>({position,vertices,labels:vertices.map(def.label)})),meaning:'Exact decoded position equality, signed zero preserved; no tolerance weld or topology modification'},underMaskAttributes:masks(glb,p.attributes),skinNodes:glb.json.nodes.filter(n=>n.mesh===meshIndex).map(n=>({name:n.name,skin:n.skin})),extras:mesh.extras??null});
        }
    }
    garments.push({id:def.id,file:def.file,meshes});
}
const bodyFile='assets/wardrobe/body/g050.glb'; pin(bodyFile);
const body=readGlb(new URL(bodyFile,root));
const bodyMasks=body.json.meshes.flatMap((mesh,meshIndex)=>mesh.primitives.map((p,primitiveIndex)=>({meshIndex,name:mesh.name,primitiveIndex,masks:masks(body,p.attributes)})));
const result={command:'node docs/evidence/nonhair-2026-10-03/separates-feasibility/read-ownership.mjs',pid:process.pid,node:process.version,started,ended:new Date().toISOString(),readerSha256:sha(fs.readFileSync(new URL('./read-ownership.mjs',import.meta.url))),pins,declarations,garments,bodyMasks,scope:'Read-only triangle/attribute/mask ledger. No GLTFLoader, texture decode, construction, geometry changes, welding, mask inference, Avatar, GPU, browser or fit/appearance qualification.'};
fs.writeFileSync(new URL('OWNERSHIP.json',folder),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pid:result.pid,started,ended:result.ended,readerSha256:result.readerSha256,receiptSha256:sha(fs.readFileSync(new URL('OWNERSHIP.json',folder))),garments:garments.map(x=>({id:x.id,meshes:x.meshes.map(m=>({name:m.name,vertices:m.sourceVertexCount,triangles:m.sourceTriangleCount,regions:Object.fromEntries(Object.entries(m.regions).map(([k,v])=>[k,v.triangleCount])),mixed:m.mixedTriangleCount,components:m.indexedComponents.length,crossPositionAliases:m.exactPositionAliases.crossRegionGroups}))})),bodyMasks}));
