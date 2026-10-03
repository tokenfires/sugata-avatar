from pathlib import Path
import hashlib,json,datetime,os,subprocess
r=Path('docs/evidence/nonhair-2026-10-03/iris-integration');start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
before=json.loads((r/'BEFORE.json').read_text()); edits=json.loads((r/'EDIT-RECIPE.json').read_text())['changes'];fixes=json.loads((r/'SOURCE-CORRECTIONS.json').read_text())['changes'];initial={}
for p,want in before['sources'].items():
 old=(r/'before'/p).read_bytes();assert sha(old)==want
 current=Path(p).read_text();s=current
 for c in reversed(fixes):
  if c['file']==p:assert s.count(c['new'])==1;s=s.replace(c['new'],c['old'])
 initial[p]=s
 for c in reversed(edits):
  if c['file']==p:assert s.count(c['new'])==1;s=s.replace(c['new'],c['old'])
 if p=='docs/API.md':
  startblock=s.index('### Eye colour\n');endblock=s.index('### Hair colour\n',startblock)
  apiBlock=s[startblock:endblock];apiLine="    eyeColour: undefined,         // optional 'original'|'blue'; creation-only, omitted keeps authored iris\n"
  assert s.count(apiLine)==1;s=s.replace(apiLine,'');s=s.replace(apiBlock,'')
  (r/'API-DECLARATION.json').write_text(json.dumps({'insertedLine':apiLine,'insertedSection':apiBlock},indent=2)+'\n')
 assert s.encode()==old,(p,'undeclared mutation')
# Read every exact job output rather than trust a green headline.
jobs=json.loads((r/'CPU-JOBS.json').read_text())['jobs'];assert len(jobs)==14
for job in jobs:
 b=Path(job['output']).read_bytes();assert sha(b)==job['outputSHA256'];assert job['exit']==0
 assert 'FAIL ' not in b.decode() and '0 failed' in b.decode() if job['name'].startswith('avatar') else b'FAIL ' not in b
# Initial critic source receipt is historical before declared owner/text corrections.
crit=json.loads((r/'CRITIC-PRODUCTION-INITIAL-READBACK.json').read_text())
for item in crit['sources']:
 p=item['path'];b=initial[p].encode() if p in initial else Path(p).read_bytes();assert sha(b)==item['sha256'],p
new=['packages/core/src/material/EyeColourOptions.js','packages/testbed/src/showcase-eye-colours.selftest.mjs','tools/critic/iris-integration.mjs']
source={p:sha(Path(p).read_bytes()) for p in list(before['sources'])+new}
# Critic/root reviewed exact prior Blue and retained default source intervention scope.
pigment=json.loads(Path('docs/evidence/nonhair-2026-10-03/iris-pigment/SOURCE-CHECK.json').read_text());assert pigment['chromaticity']==[.46375534541012664,1.0886445839519705,1.7009280765008]
assert "const iris = irisSample.rgb.mul( float( 1 ).add( caustic ) );" in (r/'before/packages/core/src/material/EyeMaterial.js').read_text()
assert "let irisRgb = irisSample.rgb;" in Path('packages/core/src/material/EyeMaterial.js').read_text()
result={'pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 '+str(r/'root-source-readback.py'),'readerSHA256':sha(Path(__file__).read_bytes()),'sources':source,'reverseRecoveryFiles':len(before['sources']),'declaredReplacements':len(edits),'sourceCorrections':len(fixes),'actualCPUJobs':len(jobs),'historicalCriticPinsVerified':len(crit['sources']),'priorFixedBlue':pigment['chromaticity'],'status':'passed exact declared source/default scope and actual CPU receipts; native not admitted by this alone','limits':['Partial-constructor universal fault cleanup and missing-eyes full construction remain unqualified.','Null branch retains prior source expression/node responsibilities; temporal pixel identity is not inferred.','No GPU/native/capture clock/evaluator/contact rerun by this reader.'],'authorFailure':'First editor PID unavailable; exit1/chunkb2b516/by19:55:34. EDIT-INITIAL-FAILURE pid is rollback receipt recorder, not failed author.'}
(r/'ROOT-SOURCE.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'pid':result['pid'],'status':'passed','files':len(source),'jobs':len(jobs)}))
