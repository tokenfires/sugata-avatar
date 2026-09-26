// CPU source/algebra inspection only. Does not author/export a candidate family or modify a rig.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Quaternion, Vector3} from 'three';
import {RestPose} from '../../../../../packages/core/src/figure/RestPose.js';
import {HUMANOID_TO_FIGURE_BONE} from '../../../../../packages/core/src/figure/Skeleton.js';
import {readGlb} from '../../../../../tools/lut-bake/glb.mjs';

const root=fileURLToPath(new URL('../../../../../', import.meta.url));
const here=fileURLToPath(new URL('./', import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(root,f));
const primary='captures/hand-attribution-2026-09-26/primary-v4/';
const reportBytes=read(primary+'report.json'), report=JSON.parse(reportBytes), seal=JSON.parse(read(primary+'seal.json'));
assert.equal(sha(reportBytes),'bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e');
assert.equal(sha(reportBytes),seal.reportSHA256); assert.equal(report.completed,true);
assert.equal(sha(read(primary+'manifest.json')),'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d');
const names=['relaxed-standing','weight-left','weight-right'];
const sources={}, texts={}, data={}, poses={};
for(const file of ['packages/core/src/figure/RestPose.js','packages/core/src/figure/Skeleton.js','packages/core/src/motion/Sway.js',
    'packages/core/src/affect/PostureLayer.js','packages/core/src/motion/Gesture.js','tools/lut-bake/glb.mjs','assets/wardrobe/body/g050.glb',
    ...names.map(n=>`packages/core/src/figure/poses/${n}.json`)]) {
    sources[file]=sha(read(file)); assert.equal(sources[file],report.sourceHashes[file],`Source drift: ${file}`);
}
for(const n of names){texts[n]=read(`packages/core/src/figure/poses/${n}.json`).toString('utf8');data[n]=JSON.parse(texts[n]);poses[n]=new RestPose(data[n]);}
const glb=readGlb(path.join(root,'assets/wardrobe/body/g050.glb')), nodes=glb.json.nodes;
const rawParents=new Map();nodes.forEach((n,i)=>(n.children??[]).forEach(c=>rawParents.set(c,i)));
const rawByHumanoid=new Map(Object.entries(HUMANOID_TO_FIGURE_BONE).flatMap(([h,b])=>{const i=nodes.findIndex(n=>n.name===b);return i<0?[]:[[h,i]];}));
const humanoidByRaw=new Map([...rawByHumanoid].map(([h,i])=>[i,h]));
const parentOf=h=>{let i=rawParents.get(rawByHumanoid.get(h));while(i!==undefined){if(humanoidByRaw.has(i))return humanoidByRaw.get(i);i=rawParents.get(i);}return null;};
const cumulative=(pose,h)=>{const parent=parentOf(h);return (parent?cumulative(pose,parent):new Quaternion()).multiply(pose.rotationFor(h)??new Quaternion());};
const maxComponent=(a,b)=>Math.min(Math.max(...a.toArray().map((x,i)=>Math.abs(x-b.toArray()[i]))),Math.max(...a.toArray().map((x,i)=>Math.abs(x+b.toArray()[i]))));
const exactCompiled=p=>({hips:p.hipsOffset.toArray(),rotations:[...p.rotations].map(([n,q])=>[n,q.toArray()])});
const result={version:1,kind:'source-bound-pose-family-algebra-inspection',candidateAuthored:false,sourceHashes:sources,
    retainedPrimaryReportSHA256:sha(reportBytes),scope:'Algebra and exact accepted bytes only; no skinned geometry, candidate clearance, cap or native candidate run.',
    calibrationDegrees:[-7,-1,0,1,7],calibrationPolicy:'Synthetic signed angles exercise multiplication order; none is selected as a candidate.',sides:{},checks:[]};
for(const [side,humanoid,sign] of [['left','leftUpperArm',1],['right','rightUpperArm',-1]]){
    const q0=poses[names[0]].rotationFor(humanoid), W0=cumulative(poses[names[0]],humanoid), parent=parentOf(humanoid);
    const axis=new Vector3(0,0,sign).applyQuaternion(W0.clone().invert()).normalize();
    const record={humanoid,parent,acceptedNormalizedCumulative:W0.toArray(),outwardRigAxis:[0,0,sign],prependedAxis:axis.toArray(),
        family:Object.fromEntries(names.map(n=>[n,{sourceSpec:data[n].bones[humanoid],compiled:poses[n].rotationFor(humanoid).toArray()}])),calibration:[]};
    for(const degrees of result.calibrationDegrees){
        const E=new Quaternion().setFromAxisAngle(axis,degrees*Math.PI/180), variants={}, compiled={};
        for(const n of names){
            variants[n]=structuredClone(data[n]);
            if(degrees!==0){const original=variants[n].bones[humanoid];variants[n].bones[humanoid]=[{axis:axis.toArray(),degrees,why:'Algebra-only calibration; not an authored candidate.'},...(Array.isArray(original)?original:[original])];}
            compiled[n]=new RestPose(variants[n]);
            for(const [bone,q] of poses[n].rotations)if(bone!==humanoid)assert.deepEqual(compiled[n].rotationFor(bone).toArray(),q.toArray());
            const before=structuredClone(data[n]),after=structuredClone(variants[n]);delete before.bones[humanoid];delete after.bones[humanoid];assert.deepEqual(after,before);
            if(degrees===0){assert.deepEqual(variants[n],data[n]);assert.deepEqual(exactCompiled(compiled[n]),exactCompiled(poses[n]));}
        }
        const relaxedActual=cumulative(compiled[names[0]],humanoid), relaxedExpected=new Quaternion().setFromAxisAngle(new Vector3(0,0,sign),degrees*Math.PI/180).multiply(W0);
        let maxLocal=0,maxCumulative=0,maxNonselectedCumulative=0;
        for(const n of names){
            const before=poses[n].rotationFor(humanoid).clone().multiply(q0.clone().invert());
            const after=compiled[n].rotationFor(humanoid).clone().multiply(compiled[names[0]].rotationFor(humanoid).clone().invert());
            maxLocal=Math.max(maxLocal,maxComponent(before,after));
            maxCumulative=Math.max(maxCumulative,maxComponent(cumulative(poses[n],humanoid).multiply(W0.clone().invert()),cumulative(compiled[n],humanoid).multiply(relaxedActual.clone().invert())));
            // Deliberately measure the stronger, unsupported distal absolute-frame invariant.
            for(const bone of [`${side}LowerArm`,`${side}Hand`]) maxNonselectedCumulative=Math.max(maxNonselectedCumulative,
                maxComponent(cumulative(poses[n],bone).multiply(cumulative(poses[names[0]],bone).invert()),cumulative(compiled[n],bone).multiply(cumulative(compiled[names[0]],bone).invert())));
        }
        const relaxedError=maxComponent(relaxedActual,relaxedExpected);
        assert.ok(maxLocal<2e-15 && maxCumulative<2e-15 && relaxedError<2e-15,'Authoring algebra changed');
        record.calibration.push({degrees,relaxedRigDeltaComponentError:relaxedError,localRelativeComponentError:maxLocal,upperArmCumulativeRelativeComponentError:maxCumulative,
            distalCumulativeRelativeComponentDifference:maxNonselectedCumulative,zeroCompiledExact:degrees===0?true:null});
    }
    result.sides[side]=record;
}
// Concrete negative control: appended rather than prepended E is the wrong multiplication order.
const left=result.sides.left, original=data['relaxed-standing'].bones.leftUpperArm, wrong=structuredClone(data['relaxed-standing']);
wrong.bones.leftUpperArm=[original,{axis:left.prependedAxis,degrees:7}];
const wrongWorld=cumulative(new RestPose(wrong),'leftUpperArm'), expected=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),7*Math.PI/180).multiply(cumulative(poses['relaxed-standing'],'leftUpperArm'));
const wrongError=maxComponent(wrongWorld,expected);assert.ok(wrongError>1e-4);
result.negativeControl={wrongAppendOrderComponentError:wrongError,rejected:true};
result.checks=['Exact source hashes match sealed native A inputs','Zero route leaves all JSON values and compiled rotations exact',
    'Every nonselected joint and metadata value survives all algebra calibrations','Per-side upper-arm local/cumulative family deltas preserved within measured floating error',
    'Wrong multiplication order rejected; stronger distal cumulative invariant measured and not claimed'];
result.sourceHashes['docs/evidence/nonhair-2026-09-26/hand-candidate/pose-proposal/inspect-family.mjs']=sha(fs.readFileSync(fileURLToPath(import.meta.url)));
result.sourceHashes['node_modules/three/src/math/Quaternion.js']=sha(read('node_modules/three/src/math/Quaternion.js'));
result.sourceHashes['node_modules/three/src/math/Vector3.js']=sha(read('node_modules/three/src/math/Vector3.js'));
fs.writeFileSync(path.join(here,'family-algebra-v1.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({checks:result.checks.length,axes:Object.fromEntries(Object.entries(result.sides).map(([s,v])=>[s,v.prependedAxis])),negativeControl:result.negativeControl,reportSHA256:sha(fs.readFileSync(path.join(here,'family-algebra-v1.json')))},null,2));
