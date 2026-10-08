"""Seal this isolated evidence packet; does not run Blender or modify assets."""
from pathlib import Path
import json,hashlib,datetime,stat
HERE=Path(__file__).resolve().parent
manifest=HERE/'MANIFEST.json'
assert not manifest.exists(), 'Exclusive first seal'
def identity(p):
 b=p.read_bytes()
 return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
for d in (HERE,HERE/'views'):
 job=json.loads((d/'JOB.json').read_text());assert job['exit_code']==0 and not job['timed_out']
 assert json.loads((d/'RESULT.json').read_text()).get('passed',json.loads((d/'RESULT.json').read_text()).get('success'))
pins=[]
for d in (HERE,HERE/'views'):
 for pin in json.loads((d/'EXEC-PLAN.json').read_text())['pins']:
  assert identity(Path(pin['path']))=={k:pin[k] for k in ('path','bytes','sha256')}; pins.append(pin)
rows=[]
for p in sorted(HERE.rglob('*')):
 if not p.is_file() or 'work' in p.relative_to(HERE).parts or '__pycache__' in p.parts or p==manifest:continue
 row=identity(p);row['path']=str(p.relative_to(HERE));rows.append(row)
source=identity(HERE/'work/ari-middle-volume.blend');source['mode']=oct(stat.S_IMODE(Path(source['path']).stat().st_mode));assert source['mode']=='0o444'
m={'sealed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'payloads':rows,'source_local_ignored':source,'external_pins':pins,'decision':'Retain isolated directional study; refuse concept-form qualification; close three-control experiment.','limits':'Numerical and static original-image evidence; full AAA/runtime/motion/material/wardrobe/fit acceptance remains open.'}
manifest.write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({'payloads':len(rows),'external_pins':len(pins),'manifest':identity(manifest)},indent=2))
