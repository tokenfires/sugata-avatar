"""Preserve the completed refusal and restored source; no native replay."""
from pathlib import Path
import datetime,hashlib,json,os,shutil,subprocess,tomllib
root=Path.cwd();base=root/'docs/evidence/nonhair-2026-10-03/cut-references';raw=root/'captures/cut-reference-html-2026-10-03-v1';build=root/'captures/cut-reference-targeted-build-2026-10-03-v1'
started=datetime.datetime.now(datetime.timezone.utc).isoformat();digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,3,13,9,tzinfo=datetime.timezone.utc)
r=json.loads((raw/'report.json').read_text());assert digest(raw/'report.json')=='a663aacd47618b9ee16ff792dbf86a464a7e1cd97b56d6b63c3ab5f6f70cfe45'
assert r['status']=='failed' and not any(r[k]for k in ['cases','guards','images','imageResponses']) and len(r['errors'])==5 and len(r['warnings'])==4
assert r['cleanup']=={'page':'closed','browser':'closed'} and r['finalPinsUnchanged'];assert not list(raw.glob('*.png'))
assert digest(raw/'instrument.mjs')==digest(root/'tools/critic/cut-reference-html.mjs')==r['instrumentSHA256']=='515c338bf3be3d3d84b6d2ed8ae4847c05363bfd8cac5e6f82497b6d478f4567'
assert digest(raw/'fixture.mjs')==digest(base/'fixture.mjs')==r['fixtureSHA256']=='2d8e91c572faaa59eceb84bf89b0469f3cf4d096e52151f64260f8d43837bc42'
assert digest(base/'CRITIQUE.md')=='56fe9b56f327810a5dbf8f19ff9c74abdbadd6956abb458e75114e4917e52a03'
assert (root/'packages/testbed/src/showcase.js').read_bytes()==(base/'before/showcase.js').read_bytes()==subprocess.check_output(['git','show','HEAD:packages/testbed/src/showcase.js'])
candidate_files={'packages/testbed/src/showcase.js':'showcase.js','packages/testbed/src/showcase-cut-references.mjs':'showcase-cut-references.mjs','packages/testbed/src/showcase-cut-references.css':'showcase-cut-references.css','packages/testbed/src/cut-references/chin-length.png':'cut-references/chin-length.png','packages/testbed/src/cut-references/long.png':'cut-references/long.png'}
for p,h in r['sources'].items():assert digest(base/'candidate'/candidate_files[p]if p in candidate_files else root/p)==h,p
assert len(r['sources'])==384
for n in ['showcase.js','showcase-cut-references.mjs','showcase-cut-references.css']:assert (base/'candidate'/n).read_bytes()==(raw/n).read_bytes()
http=json.loads((base/'postflight-http.json').read_text())
for x in http['responses']:assert digest(base/x['file'])==x['sha256'] and (base/x['file']).stat().st_size==x['bytes']
assert http['responses'][1]['sha256']=='6507cb6f3033c1ab87513d1c91158615791fbca1d9440b97a010d6f44b3d4c7b' and http['responses'][2]['sha256']=='54341acbbf20d89e4e419bbfade524aec1ac667e45684020299a6e1a19564c4a'
assert b'./showcase.js?t=1791031293411' in (base/'served-html.html').read_bytes()
b=json.loads((base/'build.json').read_text());assert b['result']=='passed' and len(b['outputs'])==74
for p,x in b['outputs'].items():assert digest(root/p)==x['sha256'] and (root/p).stat().st_size==x['bytes']
(base/'raw').mkdir();
for p in raw.iterdir():shutil.copyfile(p,base/'raw'/p.name);assert (base/'raw'/p.name).read_bytes()==p.read_bytes()
current_pins={p:digest(root/p) for p in r['sources'] if p not in candidate_files};current_pins['packages/testbed/src/showcase.js']=digest(root/'packages/testbed/src/showcase.js')
assert len(current_pins)==380
current_pins.update({p:x['sha256'] for p,x in b['outputs'].items()});current_pins['tools/critic/cut-reference-html.mjs']=digest(root/'tools/critic/cut-reference-html.mjs')
for p in (base.parent/'cut-reference-value').iterdir():current_pins[str(p.relative_to(root))]=digest(p)
automation=tomllib.loads(Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml').read_text());assert automation['status']=='ACTIVE' and automation['rrule']=='FREQ=MINUTELY;INTERVAL=10' and automation['target_thread_id']=='01a0ff57-d720-7db2-923f-9e3e0521216c'
assert subprocess.run(['ps','-p','89415','-o','pid='],capture_output=True).returncode!=0
review=subprocess.run(['ps','-p','1023','-o','pid=,command='],capture_output=True,text=True);assert review.returncode==0
files={str(p.relative_to(base)):{'bytes':p.stat().st_size,'sha256':digest(p)}for p in sorted(base.rglob('*'))if p.is_file() and p.name not in ['manifest.json','freeze.json']}
(base/'manifest.json').write_text(json.dumps({'files':files,'currentPreservationPins':current_pins,'nativePinResolution':candidate_files,'limits':'Refusal only; production restored. Postflight HTTP is not native request provenance; no explicit Avatar disposal observation.'},indent=2)+'\n')
for p,x in files.items():assert digest(base/p)==x['sha256']
for p,h in current_pins.items():assert digest(root/p)==h
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/cut-references/freeze.py','pid':os.getpid(),'startedUTC':started,'finishedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':len(files),'bytes':sum(x['bytes']for x in files.values()),'currentPreservationPins':len(current_pins),'nativePins':384,'buildOutputs':74,'manifestSHA256':digest(base/'manifest.json'),'allRehashed':True,'productionRestoredSHA256':digest(root/'packages/testbed/src/showcase.js'),'criticSHA256':digest(base/'CRITIQUE.md'),'nativeAbsent':True,'reviewProcess':review.stdout.strip(),'automation':{k:automation[k]for k in ['status','rrule','target_thread_id']},'retainedImages':0}
(base/'freeze.json').write_text(json.dumps(receipt,indent=2)+'\n')
for p in [*base.rglob('*'),*raw.iterdir(),*build.rglob('*'),*(base.parent/'cut-reference-value').iterdir()]:
 if p.is_file():p.chmod(p.stat().st_mode & ~0o222)
print(json.dumps(receipt))
