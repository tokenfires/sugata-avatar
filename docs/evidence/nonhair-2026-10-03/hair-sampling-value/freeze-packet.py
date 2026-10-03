"""Freeze the already-closed packet; no capture or verifier replay."""
from pathlib import Path
import datetime,hashlib,json,os,shutil,subprocess,tomllib
root=Path.cwd();base=root/'docs/evidence/nonhair-2026-10-03/hair-sampling-value';raw=root/'captures/hair-input-resolution-2026-10-03-v1'
started=datetime.datetime.now(datetime.timezone.utc).isoformat();digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,3,12,30,tzinfo=datetime.timezone.utc)
assert sorted(p.name for p in raw.iterdir())==['instrument.mjs','report.json']
assert digest(raw/'report.json')=='6547b61b58ce5bb56f906cd76bd53af77da8f1503975b65ae54f151cd321f7ad'
assert digest(raw/'instrument.mjs')==digest(root/'tools/critic/hair-input-resolution.mjs')=='a8c284224f027ec3c1863b21f287fbf22069c8de595fe19cad65e2ffdaeac288'
assert digest(base/'root-verify-refusal.py')=='7a4e1f81c638f1a4d1e63b61e4a802cafc148caf6073cb4cd9767ad7ddfb1851'
assert digest(base/'critic-verify-refusal.py')==digest(base/'verify-refusal.py')=='4285b551e4f104a10bab2a1f765cb7a45eeda2d41370b1656349afa664dea868'
(base/'raw').mkdir()
for p in raw.iterdir():
 q=base/'raw'/p.name;shutil.copyfile(p,q);assert q.read_bytes()==p.read_bytes()
r=json.loads((raw/'report.json').read_text());pins={**r['sources'],**r['dependencies']};assert len(pins)==390
for a in r['assets']:pins[a['file']]=a['sha256']
pins.update(json.loads((base/'root-refusal.json').read_text())['postflightSourcePins']);pins['tools/critic/hair-input-resolution.mjs']=digest(root/'tools/critic/hair-input-resolution.mjs')
for p,h in pins.items():assert digest(root/p)==h,p
automation=tomllib.loads((Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml')).read_text())
assert automation['status']=='ACTIVE' and automation['rrule']=='FREQ=MINUTELY;INTERVAL=10' and automation['target_thread_id']=='01a0ff57-d720-7db2-923f-9e3e0521216c'
review=subprocess.run(['ps','-p','1023','-o','pid=,command='],capture_output=True,text=True);assert review.returncode==0
native=subprocess.run(['ps','-p','94730','-o','pid='],capture_output=True,text=True);assert native.returncode!=0
files={str(p.relative_to(base)):{'bytes':p.stat().st_size,'sha256':digest(p)}for p in sorted(base.rglob('*'))if p.is_file() and p.name not in ['manifest.json','freeze.json']}
m={'files':files,'externalPins':pins,'limits':'Refusal only, zero saved images; no phase repair, replay or preference.'};(base/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
for p,x in files.items():assert digest(base/p)==x['sha256']
receipt={'pid':os.getpid(),'startedUTC':started,'finishedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 docs/evidence/nonhair-2026-10-03/hair-sampling-value/freeze-packet.py','files':len(files),'bytes':sum(x['bytes']for x in files.values()),'externalPins':len(pins),'manifestSHA256':digest(base/'manifest.json'),'allRehashed':True,'nativeAbsent':True,'reviewProcess':review.stdout.strip(),'automation':{k:automation[k]for k in ['status','rrule','target_thread_id']},'retainedImages':0,'fullResolutionArms':0}
(base/'freeze.json').write_text(json.dumps(receipt,indent=2)+'\n')
for p in [*base.rglob('*'),*raw.iterdir()]:
 if p.is_file():p.chmod(p.stat().st_mode & ~0o222)
print(json.dumps(receipt))
