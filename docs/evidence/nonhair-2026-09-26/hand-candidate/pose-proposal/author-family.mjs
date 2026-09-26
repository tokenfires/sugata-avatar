// One fixed capture-local family. No arbitrary angle, input path, cap or output path is accepted.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {RestPose} from '../../../../../packages/core/src/figure/RestPose.js';
const ROOT=fileURLToPath(new URL('../../../../../',import.meta.url)), HERE=fileURLToPath(new URL('./',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex'), read=f=>fs.readFileSync(path.join(ROOT,f));
const ALGEBRA='docs/evidence/nonhair-2026-09-26/hand-candidate/pose-proposal/family-algebra-v1.json';
const GEOMETRY='docs/evidence/nonhair-2026-09-26/hand-candidate/feasibility/proposal-receipt-v1.json';
const GEOMETRY_SHA='7128c95380d3b71d4a9efc2a711dc4a8fad02bd1bf68d70d24134928530a7010';
const RIG='docs/evidence/nonhair-2026-09-26/hand-candidate/feasibility/rig-world-v1.json';
const RIG_SHA='e0f273f5f76038951db2c1931062ff6d014ecddec071917034244c2425b8e948';
assert.ok(process.argv.length===2 || (process.argv.length===3&&process.argv[2]==='--check'),'Only --check is accepted');
const check=process.argv[2]==='--check';
assert.equal(hash(read(ALGEBRA)),'3aa3c7b6948ca36a27af8b16af3459311345d5353a3f1ed958247fb0aefa3a1d');
assert.ok(GEOMETRY&&GEOMETRY_SHA,'Final geometry recommendation has not been bound');
assert.equal(hash(read(GEOMETRY)),GEOMETRY_SHA); assert.equal(hash(read(RIG)),RIG_SHA);
const geometry=JSON.parse(read(GEOMETRY));assert.equal(geometry.completed,true);
assert.deepEqual(geometry.proposal,{leftOutwardDegrees:4,rightOutwardDegrees:4,commonNativeInwardCapRadians:0,elbowWristFingerChanges:false,acceptedAssetChanges:false});
for(const [file,expected]of Object.entries(geometry.sourceHashes))assert.equal(hash(read(file)),expected,'Geometry source drift: '+file);
const algebra=JSON.parse(read(ALGEBRA));
for(const [file,expected]of Object.entries(algebra.sourceHashes))assert.equal(hash(read(file)),expected,'Source drift: '+file);
const names=['relaxed-standing','weight-left','weight-right'], axes=Object.fromEntries(['left','right'].map(side=>[side,algebra.sides[side].prependedAxis]));
const old={}, authored={}, texts={}, diffs=[], changes=[];
const why='Isolated hand-clearance candidate: +4 degrees outward in relaxed rig-frontal space; geometry-derived four-degree bracket. Common right multiplier preserves the upper-arm family relation. Full distal clothing clearance remains unproven.';
for(const name of names){
    const source=`packages/core/src/figure/poses/${name}.json`, beforeText=read(source).toString('utf8'), before=JSON.parse(beforeText), expected=structuredClone(before);
    let text=beforeText;
    for(const side of ['left','right']){
        const bone=side+'UpperArm', step={axis:axes[side],degrees:4,why};
        assert.ok(!Array.isArray(before.bones[bone]),'Current exact source is expected to use one upper-arm spec');
        expected.bones[bone]=[step,before.bones[bone]];
        const re=new RegExp('^([ \\t]*)"'+bone+'": (\\{[^}]+\\}),$','gm');
        const matches=[...text.matchAll(re)];assert.equal(matches.length,1,'One exact source object spec required');
        text=text.replace(re,(_,indent,spec)=>`${indent}"${bone}": [\n${indent}    ${JSON.stringify(step)},\n${indent}    ${spec.replace(/\n/g,'\n    ')}\n${indent}],`);
        changes.push({pose:name,bone,operation:'prepend',inserted:step,originalSpec:before.bones[bone]});
    }
    assert.deepEqual(JSON.parse(text),expected,'Only selected specs may change');
    old[name]=new RestPose(before); authored[name]=new RestPose(expected);texts[name]=text;
    for(const [bone,q]of old[name].rotations)if(!bone.endsWith('UpperArm'))assert.deepEqual(authored[name].rotationFor(bone).toArray(),q.toArray(),'Nonselected compiled rotation changed');
    assert.deepEqual(authored[name].hipsOffset.toArray(),old[name].hipsOffset.toArray());
}
let maxRelativeError=0;
for(const side of ['left','right'])for(const name of names){
    const bone=side+'UpperArm', from=old[name].rotationFor(bone).clone().multiply(old[names[0]].rotationFor(bone).clone().invert());
    const to=authored[name].rotationFor(bone).clone().multiply(authored[names[0]].rotationFor(bone).clone().invert());
    maxRelativeError=Math.max(maxRelativeError,...from.toArray().map((x,i)=>Math.abs(x-to.toArray()[i])));
}
assert.ok(maxRelativeError<2e-15);
const receipt={version:1,kind:'fixed-four-degree-rest-family-with-common-zero-native-cap',promotion:false,
    rationale:GEOMETRY,geometryReceiptSHA256:GEOMETRY_SHA,algebraReceiptSHA256:hash(read(ALGEBRA)),
    sourceHashes:{...algebra.sourceHashes,...geometry.sourceHashes,[GEOMETRY]:GEOMETRY_SHA,[RIG]:RIG_SHA},budget:{commonRadians:0},degrees:{left:4,right:4},
    poseHashes:Object.fromEntries(names.map(name=>[name,hash(texts[name])])),changes,maxRelativeQuaternionComponentError:maxRelativeError,
    invariants:['Only six selected upper-arm specification fields change; original text outside those fields is retained.',
        'Original selected specs remain after the inserted step; nonselected metadata/joints/hips offsets remain exact.',
        'Upper-arm local and cumulative family deltas are preserved within reported arithmetic; distal absolute cumulative deltas are not claimed.',
        'Current Sway-chain authored fields stay unchanged; native mass/stance caches must be remeasured.'],
    limits:['No native candidate run yet. Geometry recommendation is a transformed-snapshot feasibility result.',
        'Full distal clothing corridor is unproven, including proximal sleeve pairs; not a penetration or full-clearance verdict.',
        'Cap zero changes genuine Posture telemetry and Gesture yield; not diagnostic B equivalence.']};
receipt.sourceHashes['docs/evidence/nonhair-2026-09-26/hand-candidate/pose-proposal/author-family.mjs']=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
if(!check)fs.mkdirSync(path.join(HERE,'family'),{recursive:true});
for(const name of names){
    const file=path.join(HERE,'family',name+'.json');
    if(check)assert.equal(fs.readFileSync(file,'utf8'),texts[name]);else fs.writeFileSync(file,texts[name],{flag:'wx'});
    const diff=spawnSync('diff',['-u','--label','accepted/'+name+'.json','--label','candidate/'+name+'.json',path.join(ROOT,'packages/core/src/figure/poses',name+'.json'),file],{encoding:'utf8'});
    assert.equal(diff.status,1);diffs.push(diff.stdout);
}
const outputs={'authoring-v1.json':JSON.stringify(receipt,null,2)+'\n','family.diff':diffs.join('\n')};
for(const [file,bytes]of Object.entries(outputs)){if(check)assert.equal(fs.readFileSync(path.join(HERE,file),'utf8'),bytes);else fs.writeFileSync(path.join(HERE,file),bytes,{flag:'wx'});}
console.log(JSON.stringify({check,poseHashes:receipt.poseHashes,commonRadians:0,maxRelativeError,receiptSHA256:hash(outputs['authoring-v1.json'])},null,2));
