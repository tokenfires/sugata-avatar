// CPU mesh-composition diagnostics, not native emotions or approval of source-bound amplitudes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {Mesh,BufferGeometry,BufferAttribute,Vector3} from 'three';
import {createTipWidthOperator,inspectPatchLayout,sha} from './TipWidthCandidate.mjs';
import {checkLocalSelfIntersection,cross,sub,dot} from './local-normal.mjs';
import {readAccessor} from '../../../../tools/lut-bake/glb.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..'),out=path.resolve(process.argv[2]??path.join(here,'composition-v1'));
assert.ok(out.startsWith(here+path.sep)&&!fs.existsSync(out),'Fresh evidence directory only');
const channels=['jawOpen','mouthPucker','mouthSmileLeft','mouthSmileRight','noseSneerLeft','noseSneerRight'];
const inputs={bodyBytes:'assets/wardrobe/body/g050.glb',mapBytes:'assets/identity/figure-vertex-map.bin',catalogueBytes:'assets/identity/catalogue.json',noseBytes:'assets/identity/targets/nose.bin'};
const files=[...Object.values(inputs),'node_modules/three/src/objects/Mesh.js','node_modules/three/package.json',...['check-raw-compositions.mjs','TipWidthCandidate.mjs','local-normal.mjs','verify-local-geometry.py'].map(n=>path.relative(root,path.join(here,n))),'packages/core/src/figure/IdentityTargets.js','packages/core/src/figure/IdentityCatalogue.js','tools/lut-bake/glb.mjs','tools/figure-pipeline/hair_surface.mjs'];
const sourceHashes=Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),data=Object.fromEntries(Object.entries(inputs).map(([k,p])=>[k,fs.readFileSync(path.join(root,p))]));
fs.mkdirSync(out);const report={kind:'tip-width-raw-single-channel-composition',completed:false,sourceHashes,amplitude:1,channels,cases:[],nativeRuns:0,scope:'Each single raw shape at its diagnostic clamp endpoint, fresh source copies; no native feeling, range approval, combined expressions or normal recomputation.'};
try{
 const op=await createTipWidthOperator(data),candidates=[op.candidate(-1),op.candidate(0),op.candidate(1)],layout=inspectPatchLayout(data.bodyBytes),mapping=Uint16Array.from({length:data.mapBytes.length/2},(_,i)=>data.mapBytes.readUInt16LE(i*2));
 const bodyMesh=layout.glb.json.meshes.find(m=>m.name==='base.001'),names=bodyMesh.extras.targetNames,affected=[...new Set(candidates.flatMap(c=>c.receipt.affectedFaces??[]))].sort((a,b)=>a-b);
 const vector=new Vector3();
 for(const channel of channels){
  const index=names.indexOf(channel);assert.ok(index>=0);const morph=Float32Array.from(readAccessor(layout.glb,layout.primitive.targets[index].POSITION).data);
  const composed=candidates.map(c=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(c.positions.slice(),3));g.morphAttributes.position=[new BufferAttribute(morph.slice(),3)];g.morphTargetsRelative=true;const mesh=new Mesh(g);mesh.morphTargetInfluences[0]=1;
   const p=new Float32Array(c.positions.length);for(let i=0;i<p.length/3;i++){mesh.getVertexPosition(i,vector).toArray(p,3*i);for(let k=0;k<3;k++)assert.equal(p[3*i+k],Math.fround(c.positions[3*i+k]+morph[3*i+k]),'Native Three mesh composition disagrees');}g.dispose();mesh.material.dispose();return p;
  });
  const baseline=checkLocalSelfIntersection({positions:composed[1],indices:layout.indices,mapping,affectedFaces:affected}),baseKeys=new Set(baseline.witnesses.map(w=>w.faces.slice().sort((a,b)=>a-b).join(':')));
  const entry={channel,weight:1,morphSHA256:sha(Buffer.from(morph.buffer)),baseline,arms:[],independent:null};report.cases.push(entry);
  for(let arm=0;arm<3;arm++){
   const p=composed[arm];let minimumFaceCosine=1,minimumArea=Infinity,minimumAltitude=Infinity;
   for(const f of affected){const ids=Array.from(layout.indices.slice(3*f,3*f+3)),tri=src=>ids.map(i=>Array.from(src.slice(3*i,3*i+3))),a=tri(composed[1]),b=tri(p),n0=cross(sub(a[1],a[0]),sub(a[2],a[0])),n1=cross(sub(b[1],b[0]),sub(b[2],b[0])),l0=Math.hypot(...n0),l1=Math.hypot(...n1),longest=Math.max(...[[0,1],[0,2],[1,2]].map(([i,j])=>Math.hypot(...sub(b[i],b[j]))));
    minimumFaceCosine=Math.min(minimumFaceCosine,dot(n0,n1)/(l0*l1));minimumArea=Math.min(minimumArea,l1/2);minimumAltitude=Math.min(minimumAltitude,l1/longest);
   }
   const intersection=checkLocalSelfIntersection({positions:p,indices:layout.indices,mapping,affectedFaces:affected}),newWitnesses=intersection.witnesses.filter(w=>!baseKeys.has(w.faces.slice().sort((a,b)=>a-b).join(':')));
   const row={endpoint:candidates[arm].receipt.weight,positionsSHA256:sha(Buffer.from(p.buffer)),minimumFaceCosine,minimumArea,minimumAltitude,intersection,newWitnesses};entry.arms.push(row);
   assert.ok(minimumFaceCosine>0&&minimumAltitude>1e-9,'Composed face degeneration/reversal');assert.equal(newWitnesses.length,0,'New composed self-intersection');
  }
  // The unmodified exact verifier independently checks all cases when the actual baseline
  // is clear. If baseline contacts exist, keep the numerical witnesses and stop: do not
  // delete contacts or modify the independent oracle merely to obtain a pass.
  assert.equal(baseline.witnesses.length,0,'Existing local baseline contacts need classification before further qualification');
  const payload=JSON.stringify({indices:Array.from(layout.indices),mapping:Array.from(mapping),reference:Array.from(composed[1]),cases:composed.map((p,i)=>({weight:candidates[i].receipt.weight,positions:Array.from(p),affectedFaces:affected}))});
  const r=spawnSync('python3',[path.join(here,'verify-local-geometry.py')],{input:payload,encoding:'utf8',maxBuffer:4*1024*1024});fs.writeFileSync(path.join(out,channel+'-exact.txt'),r.stdout+r.stderr,{flag:'wx'});assert.equal(r.status,0,r.stderr);entry.independent=JSON.parse(r.stdout);assert.equal(entry.independent.inputSHA256,sha(payload));
 }
 for(const [f,h]of Object.entries(sourceHashes))assert.equal(sha(fs.readFileSync(path.join(root,f))),h,'Source drift');report.completed=true;
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;}finally{const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,'report.json'),bytes);fs.writeFileSync(path.join(out,'seal.json'),JSON.stringify({completed:report.completed,reportSHA256:sha(bytes)},null,2)+'\n');console.log(JSON.stringify({completed:report.completed,cases:report.cases.length,failure:report.failure?.message,reportSHA256:sha(bytes),out}));}
