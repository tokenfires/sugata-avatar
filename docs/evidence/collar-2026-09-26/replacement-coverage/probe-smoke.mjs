// CPU-only integration against a completed, exact-hashed native bra smoke capture.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {runCoverage,PROTOCOL} from '../../../../tools/figure-pipeline/collar_coverage_v2.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const [captureArg,outArg,summaryArg]=process.argv.slice(2);
assert.ok(captureArg&&outArg&&summaryArg,'Usage: node probe-smoke.mjs CAPTURE_DIR FRESH_OUTPUT_DIR NEW_SUMMARY_JSON');
const captureDir=path.resolve(captureArg),out=path.resolve(outArg),summaryPath=path.resolve(summaryArg);
assert.ok(!fs.existsSync(out)&&!fs.existsSync(summaryPath),'Fresh output and summary required');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),hashFile=file=>sha(fs.readFileSync(file));
const relative=file=>path.relative(ROOT,file),reportFile=path.join(captureDir,'report.json'),reportBytes=fs.readFileSync(reportFile),capture=JSON.parse(reportBytes);
assert.equal(capture.completed,true);assert.equal(capture.mode,'smoke');assert.equal(capture.historicalReplay,false);
assert.equal(capture.runs.length,1);const run=capture.runs[0];
assert.equal(run.completed,true);assert.deepEqual(run.errors,[]);assert.equal(run.hair,'bob02');assert.equal(run.sequence,'mild');
assert.equal(run.asset.role,'accepted-installed');assert.equal(run.asset.sha256,'44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783');
assert.ok(run.loadedAssets.some(a=>a.sha256===run.asset.sha256),'Actual outer response hash missing');
assert.deepEqual(run.geometry.map(g=>g.step),[0,30,60,90,98,99,120,150,180,210,240,270,300,330,360]);
const manifestFile=path.join(captureDir,'manifest.json');assert.equal(hashFile(manifestFile),capture.manifestSHA256);
const outerPath=path.join(ROOT,run.asset.assetPath);assert.equal(hashFile(outerPath),run.asset.sha256);
const sources=['tools/figure-pipeline/collar_coverage_v2.mjs',relative(fileURLToPath(import.meta.url))];
const sourceHashes=Object.fromEntries(sources.map(f=>[f,hashFile(path.join(ROOT,f))]));
fs.mkdirSync(out,{recursive:true});
const summary={protocol:PROTOCOL.id,sourceHashes,captureReport:{file:relative(reportFile),sha256:sha(reportBytes)},
    captureManifest:{file:relative(manifestFile),sha256:capture.manifestSHA256},asset:run.asset,run:run.name,
    foundation:'foundation_bra',discretePoses:15,rows:[],errors:[],
    limits:['Only the actual captured bra/body/outer positions at these15 discrete poses are tested.',
        'No vest, second haircut, expressive sequence, d81/trial runtime or between-frame coverage is established.',
        'Projected additional-mask coverage does not qualify collision clearance, fit, all-view occlusion, continuous motion or historical parity.']};
for(const geometry of run.geometry){
    const snapshotPath=path.resolve(captureDir,geometry.file);
    assert.ok(snapshotPath.startsWith(captureDir+path.sep),'Snapshot path escape');
    const encoded=fs.readFileSync(snapshotPath),decoded=gunzipSync(encoded),snapshot=JSON.parse(decoded);
    assert.equal(sha(encoded),geometry.sha256);assert.equal(sha(decoded),geometry.decodedSHA256);
    assert.equal(snapshot.time,geometry.time);assert.equal(snapshot.capture.step,geometry.step);
    assert.equal(snapshot.capture.manifestSHA256,capture.manifestSHA256);assert.deepEqual(snapshot.capture.asset,run.asset);
    assert.equal(snapshot.capture.hair,run.hair);assert.equal(snapshot.capture.sequence,run.sequence);
    const name=`bra-step-${geometry.step}.json`,outputPath=path.join(out,name);
    const input={file:relative(snapshotPath),encodedSha256:geometry.sha256,decodedSha256:geometry.decodedSHA256,encodedBytes:encoded.length,decodedBytes:decoded.length};
    try{
        const result=runCoverage({outerPath,outerSha256:run.asset.sha256,snapshotPath,snapshotSha256:geometry.sha256,
            foundationIds:['foundation_bra'],outputPath});
        const raw=fs.readFileSync(outputPath),packed=gzipSync(raw,{level:9}),compressedPath=outputPath+'.gz';
        assert.deepEqual(gunzipSync(packed),raw);fs.writeFileSync(compressedPath,packed,{flag:'wx'});
        const f=result.foundations[0];
        summary.rows.push({step:geometry.step,time:geometry.time,input,selected:f.selected,passed:f.passed,failed:f.failed,
            maximumUncoveredArea:f.maximumUncoveredArea,failedTriangles:f.rows.filter(r=>!r.pass).map(r=>({id:r.foundationTriangle,uncoveredArea:r.uncoveredArea})),
            output:{file:relative(compressedPath),encodedSha256:sha(packed),decodedSha256:sha(raw),encodedBytes:packed.length,decodedBytes:raw.length,rawLocalFile:relative(outputPath)}});
    }catch(error){
        const failure={step:geometry.step,input,error:{name:error.name,message:error.message,stack:error.stack}};
        fs.writeFileSync(path.join(out,`error-step-${geometry.step}.json`),JSON.stringify(failure,null,2)+'\n',{flag:'wx'});summary.errors.push(failure);
    }
}
assert.equal(hashFile(reportFile),sha(reportBytes),'Capture report changed during probe');
for(const [f,hash] of Object.entries(sourceHashes))assert.equal(hashFile(path.join(ROOT,f)),hash,'Probe source changed');
summary.completed=summary.rows.length+summary.errors.length===15;
summary.posesPassing=summary.rows.filter(r=>r.failed===0).length;summary.posesFailing=summary.rows.filter(r=>r.failed>0).length;
summary.totalFootprintEvaluations=summary.rows.reduce((s,r)=>s+r.selected,0);summary.pass=summary.errors.length===0&&summary.posesPassing===15;
fs.mkdirSync(path.dirname(summaryPath),{recursive:true});fs.writeFileSync(summaryPath,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({completed:summary.completed,pass:summary.pass,posesPassing:summary.posesPassing,posesFailing:summary.posesFailing,
    errors:summary.errors.length,totalFootprintEvaluations:summary.totalFootprintEvaluations,steps:summary.rows.map(r=>({step:r.step,failed:r.failed,max:r.maximumUncoveredArea})),summary:relative(summaryPath)},null,2));
if(summary.errors.length)process.exitCode=1;
