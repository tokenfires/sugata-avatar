from pathlib import Path
import json,hashlib,datetime,os
p=Path('docs/evidence/nonhair-2026-10-03/editor-focus-value');h=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest();start=datetime.datetime.now(datetime.timezone.utc).isoformat();pins={};candidate=p/'CANDIDATE.html.source'
for name in ['ROOT-SOURCE.json','critic-source-check.json']:
 r=json.loads((p/name).read_text())
 for q,v in r['pins'].items():
  witness=str(candidate)if q=='packages/testbed/src/showcase.html'else q
  assert h(witness)==v,(q,witness);pins[witness]=v
j=json.loads((p/'NATIVE-JOB.json').read_text());assert j['pid']==99261 and j['exitCode']==1;assert h(p/'native.log')==j['logSHA256'];assert 'sole native launch cutoff' in(p/'native.log').read_text();assert 'clothing-descriptions.mjs:8:8' in(p/'native.log').read_text();assert j['started']>'2026-10-03T20:49:00';assert not Path('captures/clothing-descriptions-2026-10-03-v1').exists()
r=json.loads((p/'RESTORATION.json').read_text());assert h('packages/testbed/src/showcase.html')==r['acceptedHTML']==h(p/'BEFORE.html.source');assert h(candidate)==r['candidateHTML'];pins['packages/testbed/src/showcase.html']=r['acceptedHTML']
b=json.loads((p/'BUILD-JOB.json').read_text());assert b['exitCode']==0 and h(p/'build-pages.log')==b['logSHA256']
for n in ['native.log','build-pages.log','CRITIC-PREFLIGHT.md','critic-source-check.py','critic-source-check.json','ROOT-DECISION.md','ROOT-PREFLIGHT.json','RESTORATION.json','NATIVE-JOB.json','BUILD-JOB.json']:pins[str(p/n)]=h(p/n)
r=dict(pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),readerSHA256=h(__file__),pins=pins,status='exact source-qualified isolated candidate/accepted rollback and late pre-browser refusal independently reconciled; no native/AX/images',nativeAttempts=1,browserLaunches=0,actualAXStates=0,images=0)
(p/'ROOT-REFUSAL.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['pid','started','finished','nativeAttempts','browserLaunches','images']}));print('pins',len(pins))
