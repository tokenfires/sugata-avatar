import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {prepareInputs,assertOpen} from './prepare.mjs';
const leaf=new URL('./',import.meta.url),started=performance.now();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={schema:'actual-shared-preparation-checks-v1',startedUtc:new Date().toISOString(),pid:process.pid,node:process.version,execPath:process.execPath,argv:process.argv,cases:[],error:null};
let exit=0;
try{
  const admissionBytes=readFileSync(new URL('CPU-ADMISSION.json',leaf));
  assert.equal(process.argv[2],sha(admissionBytes));const admission=JSON.parse(admissionBytes);
  assert.equal(admission.allow,'one-pure-input-check-entry');assert.ok(Date.now()<Date.parse(admission.expiresUtc));
  for(const row of admission.pins){const bytes=readFileSync(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);}
  assert.equal(sha(readFileSync(process.execPath)),'91ed66b8cd139609427a3e9d93518dd3b0d5407c737fc9a265bfd991ec623d8a');
  const bytes=readFileSync(new URL('../../appearance-2026-10-04/whole-knit-serving/mesh.json',leaf));
  report.meshSha=sha(bytes);
  let calls=0;const normal=await prepareInputs(bytes,async value=>{calls++;return sha(value);},()=>false);
  assert.equal(calls,3);assert.equal(normal.positions.length,3306);assert.equal(normal.indices.length,6336);
  report.cases.push({name:'normal completion',calls,returned:true,positionSha:normal.positionSha,indexSha:normal.indexSha});
  for(const phase of [1,2,3]){
    let closed=false,calls=0,release,reached;
    const gate=new Promise(resolve=>{release=resolve;});const waiting=new Promise(resolve=>{reached=resolve;});const trace=[];
    const digest=async value=>{calls++;const n=calls;trace.push(`digest${n}:start`);const result=sha(value);if(n===phase){reached();await gate;}trace.push(`digest${n}:resolved`);return result;};
    const outcome=prepareInputs(bytes,digest,()=>closed).then(value=>({returned:true,value}),error=>({returned:false,error:String(error)}));
    await waiting;closed=true;trace.push('closed');release();const result=await outcome;
    assert.equal(result.returned,false);assert.match(result.error,/Closed continuation/);assert.equal(calls,phase);
    report.cases.push({name:`closed during digest${phase}`,calls,returned:result.returned,error:result.error,trace});
  }
  let alreadyClosedCalls=0;
  await assert.rejects(prepareInputs(bytes,async value=>{alreadyClosedCalls++;return sha(value);},()=>true),/Closed continuation/);
  assert.equal(alreadyClosedCalls,0);report.cases.push({name:'already closed',calls:0,returned:false});
  assert.throws(()=>assertOpen(()=>true),/Closed continuation/);report.cases.push({name:'closed between preparation and acquisition guard',returned:false,scope:'Actual assertOpen used by viewer; no resource factory or browser was run'});
  report.pass=true;
}catch(error){exit=1;report.pass=false;report.error=String(error);}
report.elapsedMs=performance.now()-started;if(report.elapsedMs>10000){exit=1;report.pass=false;report.error='10second CPU budget exceeded';}
report.completedUtc=new Date().toISOString();
report.limits='Actual shared pure helper/guard only; no Three/DOM/WebGL/native rendering, child_process or worker. No browser allocation/release/appearance qualification.';
const output=JSON.stringify(report,null,2)+'\n';assert.ok(Buffer.byteLength(output)<8*1024*1024);
writeFileSync(fileURLToPath(new URL('CPU-RESULT.json',leaf)),output,{flag:'wx'});console.log(output);process.exitCode=exit;
