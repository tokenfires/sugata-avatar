import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {prepareStressAssets, readStressAsset} from './collar_stress_inputs.mjs';
import {CASUAL_COLLAR_FIT} from './casual_collar_fit.mjs';
import {verifyCaptureInstrument} from './collar_stress_review.mjs';
import {sha256} from './collar_stress_inputs.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sugata-stress-inputs-'));
try {
    const assets=prepareStressAssets(directory);
    for(const [key,expected] of [['previous',CASUAL_COLLAR_FIT.sourceSHA256],
        ['candidate',CASUAL_COLLAR_FIT.outputSHA256],['geometry',CASUAL_COLLAR_FIT.geometrySHA256]]) {
        const file=readStressAsset(directory,assets[key],expected);
        assert.ok(fs.statSync(file).size>1_000_000);
    }
    assert.throws(()=>prepareStressAssets(directory),/EEXIST/,'Never overwrite a prior capture');
    assert.throws(()=>readStressAsset(directory,null,CASUAL_COLLAR_FIT.outputSHA256),/Missing/);
    assert.throws(()=>readStressAsset(directory,{...assets.candidate,sha256:'wrong'},CASUAL_COLLAR_FIT.outputSHA256),/identity/);
    assert.throws(()=>readStressAsset(directory,{...assets.candidate,file:'../elsewhere.glb'},CASUAL_COLLAR_FIT.outputSHA256),/belong/);
    const file=path.join(directory,assets.candidate.file),bytes=fs.readFileSync(file);bytes[bytes.length-1]^=1;
    fs.writeFileSync(file,bytes);
    assert.throws(()=>readStressAsset(directory,assets.candidate,CASUAL_COLLAR_FIT.outputSHA256),/changed/);
    const tool='tools/figure-pipeline/collar_stress_inputs.mjs',current=fs.readFileSync(new URL('./collar_stress_inputs.mjs',import.meta.url));
    // A matching working-tree helper cannot substitute for a missing frozen instrument.
    assert.throws(()=>verifyCaptureInstrument(directory,tool,sha256(current),2),/missing/);
    fs.mkdirSync(path.dirname(path.join(directory,tool)),{recursive:true});
    fs.writeFileSync(path.join(directory,tool),current);
    verifyCaptureInstrument(directory,tool,sha256(current),2);
    fs.appendFileSync(path.join(directory,tool),'\n// mutation\n');
    assert.throws(()=>verifyCaptureInstrument(directory,tool,sha256(current),2),/changed/);
    console.log('PASS frozen stress inputs and instruments reproduce without archives; overwrite, missing, wrong, escaped and corrupted inputs refused');
} finally {fs.rmSync(directory,{recursive:true});}
