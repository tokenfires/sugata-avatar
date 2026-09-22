import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {deriveFitSupport, inspectFitSupport} from './collar_fit_support.mjs';
import {prepareStressAssets} from './collar_stress_inputs.mjs';
import {readGlb, readPrimitive, readAccessor} from '../lut-bake/glb.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sugata-fit-support-test-'));
try{
    const assets=prepareStressAssets(directory),glb=readGlb(path.join(directory,assets.previous.file));
    const source=readPrimitive(glb,'female_casualsuit01');
    const attrs=glb.json.meshes.find(m=>m.name==='female_casualsuit01').primitives[0].attributes;
    const joints=readAccessor(glb,attrs.JOINTS_0).data,weights=readAccessor(glb,attrs.WEIGHTS_0).data;
    const candidate=readGlb(path.join(directory,assets.candidate.file));
    const interior=candidate.json.meshes.find(m=>m.name==='female_casualsuit01').extras.sugataInterior.triangles;
    const support=deriveFitSupport(source,joints,weights,interior);
    assert.deepEqual(support,inspectFitSupport().support);
    const saved=JSON.parse(fs.readFileSync(new URL('../../docs/evidence/collar-fit-support-2026-09-22.json',import.meta.url)));
    assert.deepEqual(support,saved.support);
    const duplicate=support.movingGroups.find(g=>g.vertices.length>1).vertices[1];
    const wrongWeights=weights.slice();wrongWeights[duplicate*4]+=.125;
    assert.throws(()=>deriveFitSupport(source,joints,wrongWeights,interior),/different weights/);
    const wrongJoints=joints.slice();wrongJoints[duplicate*4]^=1;
    assert.throws(()=>deriveFitSupport(source,wrongJoints,weights,interior),/different joints/);
    assert.throws(()=>deriveFitSupport({...source,vertexCount:source.vertexCount-1},joints,weights,interior));
    console.log('PASS exact fit support recovered; mismatched seam weights, joints and topology refused');
}finally{fs.rmSync(directory,{recursive:true});}
