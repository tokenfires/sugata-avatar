from pathlib import Path
import json,hashlib,datetime,stat
P=Path(__file__).resolve().parent
assert (P/'ROOT-READBACK.json').exists()
def pin(f,name):
 h=hashlib.sha256()
 with f.open('rb') as source:
  while True:
   chunk=source.read(8*1024*1024)
   if not chunk:break
   h.update(chunk)
 return {'path':name,'bytes':f.stat().st_size,'sha256':h.hexdigest()}
e=json.loads((P/'EXEC-PLAN.json').read_text())
for x in e['pins']:assert pin(Path(x['path']),x['path'])==x
rawnames={'BEFORE.json','WARM.json'};payload=[]
for f in sorted(P.iterdir()):
 if f.is_file() and f.name not in rawnames|{'MANIFEST.json'}:f.chmod(0o444);payload.append(pin(f,f.name))
local=[]
for f in sorted([P/n for n in rawnames]+list((P/'work').iterdir())):
 if f.is_file():assert stat.S_IMODE(f.stat().st_mode)==0o444;local.append(pin(f,str(f.relative_to(P))))
assert not list(P.glob('*.png')) and not (P/'REOPEN.json').exists() and not (P/'CLEANUP.json').exists()
m={'sealed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'payloads':payload,'execution_pins':e['pins'],'local_ignored_readonly_outputs':local,'native_attempts':1,'candidate_promotion':False,'images':0,'failure':'Saved-open namespace guard; actual namespace witness absent/cause UNKNOWN','large_audit_limit':'Exact raw2GB localignored; compact summaries replaceonly6pixelarrays perrecord with text/count descriptors. No rawrewrite or current palette retry.'}
with (P/'MANIFEST.json').open('x') as out:json.dump(m,out,indent=2);out.write('\n')
(P/'MANIFEST.json').chmod(0o444);print({'payloads':len(payload),'pins':len(e['pins']),'ignored_readonly_outputs':len(local),'sealed_utc':m['sealed_utc']})
