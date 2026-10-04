import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {readGlb,readAccessor} from '../../../../tools/lut-bake/glb.mjs';
const folder=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(folder,'../../../..'),started=new Date().toISOString();
const sha=b=>createHash('sha256').update(b).digest('hex'),guides=JSON.parse(fs.readFileSync(path.join(folder,'GUIDES.json'))),critic=JSON.parse(fs.readFileSync(path.join(folder,'CRITIC-LITERAL-READBACK.json')));
for(const [file,row] of Object.entries(critic.pins)){const b=fs.readFileSync(path.join(folder,file));if(sha(b)!==row.sha256||b.length!==row.bytes)throw Error('Critic binding changed '+file);}
const source=fs.readFileSync(path.join(repo,guides.source.file));if(sha(source)!==critic.bodySha256)throw Error('Body changed');
const glb=readGlb(path.join(repo,guides.source.file)),primitive=glb.json.meshes.find(m=>m.name===guides.source.mesh).primitives[0],positions=readAccessor(glb,primitive.attributes.POSITION).data,indices=readAccessor(glb,primitive.indices).data;
const records=[];let maximumRootResidual=0,maximumNormalResidual=0;
for(const g of guides.guides){
 const r=g.root,ids=Array.from(indices.slice(r.triangle*3,r.triangle*3+3));if(JSON.stringify(ids)!==JSON.stringify(r.indices))throw Error('Native IDs '+g.id);
 const triangle=ids.map(i=>Array.from(positions.slice(i*3,i*3+3))),v=triangle.map(p=>new Vector3(...p)),point=new Vector3();v.forEach((p,i)=>point.addScaledVector(p,r.bary[i]));
 const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
 maximumRootResidual=Math.max(maximumRootResidual,point.distanceTo(new Vector3(...r.position)));maximumNormalResidual=Math.max(maximumNormalResidual,normal.distanceTo(new Vector3(...r.normal)));
 if(maximumRootResidual>1e-12||maximumNormalResidual>1e-12)throw Error('Root/normal mismatch');
 records.push({id:g.id,triangle:r.triangle,indices:ids,restVertices:triangle});
}
const literal={source:guides.source,records};fs.writeFileSync(path.join(folder,'SOURCE-TRIANGLES.json'),JSON.stringify(literal,null,2)+'\n',{flag:'wx'});
fs.chmodSync(path.join(folder,'GUIDES.json'),0o444);fs.chmodSync(path.join(folder,'SOURCE-TRIANGLES.json'),0o444);
const pins={};for(const file of ['GUIDES.json','SOURCE-TRIANGLES.json','PLAN.md','author.mjs','AUTHOR.json','CRITIC-LITERAL.md','critic-literal-read.py','CRITIC-LITERAL-READBACK.json','prepare.mjs']){const b=fs.readFileSync(path.join(folder,file));pins[file]={bytes:b.length,sha256:sha(b)};}
const result={command:'node docs/evidence/hair-2026-10-03/surface-guides/prepare.mjs',pid:process.pid,started,ended:new Date().toISOString(),pins,source:guides.source,maximumRootResidual,maximumNormalResidual,scope:'Root independently reconciles every critic pin and all actual native triangles, weighted roots and oriented normals. Literal source snapshots made read-only before construction. No curve/geometry/native activity.'};
fs.writeFileSync(path.join(folder,'ROOT-LITERAL.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
