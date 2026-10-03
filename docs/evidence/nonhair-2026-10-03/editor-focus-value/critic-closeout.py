from pathlib import Path
from datetime import datetime, timezone
import json, hashlib, os, sys
b=Path('/Users/robault/GitHub/sugata-avatar');p=b/'docs/evidence/nonhair-2026-10-03/editor-focus-value'
start=datetime.now(timezone.utc).isoformat()
h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
j=json.loads((p/'NATIVE-JOB.json').read_text());restore=json.loads((p/'RESTORATION.json').read_text());pre=json.loads((p/'ROOT-PREFLIGHT.json').read_text());cutoff=datetime.fromisoformat('2026-10-03T20:49:00+00:00')
assert datetime.fromisoformat(j['started'])>cutoff
assert datetime.fromisoformat(pre['at'])>cutoff
assert j['exitCode']==1 and j['status']=='collected'
log=(p/'native.log').read_text();assert h(p/'native.log')==j['logSHA256']
assert 'AssertionError [ERR_ASSERTION]: sole native launch cutoff' in log and 'clothing-descriptions.mjs:8:8' in log
source=(b/'tools/critic/clothing-descriptions.mjs').read_text()
assert source.index("assert.ok(Date.now()<Date.parse('2026-10-03T20:49:00Z')")<source.index('fs.mkdirSync(raw')<source.index('browser=await bounded(()=>launchProbeBrowser()')
assert not (b/'captures/clothing-descriptions-2026-10-03-v1').exists()
assert (b/'packages/testbed/src/showcase.html').read_bytes()==(p/'BEFORE.html.source').read_bytes()
assert h(b/'packages/testbed/src/showcase.html')==restore['acceptedHTML']=='6e2b676c1353a9462c5a0c4f6ba59d3cff4a3202070cf064204ac2bcf55533fb'
assert h(p/'CANDIDATE.html.source')==restore['candidateHTML']=='77a045a1c885662f7847fe2f59acde24c166502d99e37e180cc4fc8cdb03802b'
checks=[]
for receipt,key in [('ROOT-SOURCE.json','pins'),('critic-source-check.json','pins')]:
    rows=json.loads((p/receipt).read_text())[key]
    for rel,expected in rows.items():
        actual=p/'CANDIDATE.html.source' if rel=='packages/testbed/src/showcase.html' else b/rel
        assert h(actual)==expected,(receipt,rel)
        checks.append({'receipt':receipt,'recordedPath':rel,'verifiedPath':str(actual.relative_to(b)),'sha256':expected,'mapping':'preserved candidate after declared exact rollback' if rel=='packages/testbed/src/showcase.html' else 'unchanged current path'})
for rel,expected in json.loads((p/'SOURCE-PINS.json').read_text()).items():assert h(b/rel)==expected,rel
assert h(p/'CRITIC-PREFLIGHT.md')==pre['critic']
assert h(p/'critic-source-check.py')==pre['reader']
assert h(p/'critic-source-check.json')==pre['receipt']
r={'status':'cutoff-refusal-preserved','pid':os.getpid(),'startedUTC':start,'finishedUTC':datetime.now(timezone.utc).isoformat(),'command':'python3 docs/evidence/nonhair-2026-10-03/editor-focus-value/critic-closeout.py','python':sys.version,'readerSHA256':h(Path(__file__)),'nativeJob':j,'expiredRootPreflightUTC':pre['at'],'rawDirectoryAbsent':True,'exactAcceptedHTMLRestored':True,'candidatePreserved':True,'sourceMappings':checks,'pins':{str(f.relative_to(b)):h(f) for f in [p/'NATIVE-JOB.json',p/'native.log',p/'RESTORATION.json',p/'ROOT-PREFLIGHT.json',p/'BUILD-JOB.json',p/'build-pages.log',b/'tools/critic/clothing-descriptions.mjs',p/'CANDIDATE.html.source',p/'BEFORE.html.source']},'limits':['No browser/native/AX/images/runtime retirement or appearance evidence from this attempt.','Source maps verify preserved candidate versus restored live HTML; this is not a native final-pin gate.','No rerun, observer repair, new cutoff or root checker execution.']}
assert h(p/'build-pages.log')==json.loads((p/'BUILD-JOB.json').read_text())['logSHA256']
with (p/'critic-closeout.json').open('x') as f:f.write(json.dumps(r,indent=2)+'\n')
print(json.dumps({'status':r['status'],'pid':r['pid'],'startedUTC':start,'finishedUTC':r['finishedUTC'],'sourceMappings':len(checks),'readerSHA256':r['readerSHA256'],'receiptSHA256':h(p/'critic-closeout.json')}))
