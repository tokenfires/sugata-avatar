import datetime, hashlib, json, os
from pathlib import Path
p=Path(__file__).resolve().parent;repo=p.parents[3];started=datetime.datetime.now(datetime.timezone.utc)
assert started<datetime.datetime.fromisoformat('2026-10-04T05:00:00+00:00')
sha=lambda b:hashlib.sha256(b).hexdigest();d=json.loads((p/'CRITIC-WORTH-PINS.json').read_text())
assert len(d['pins'])==9 and d['exitCode']==0
for row in d['pins']:
 file=Path(row['path']);assert file.is_relative_to(repo);b=file.read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
assert sha((p/'critic-worth-pins.py').read_bytes())==d['sourceSHA256']
assert sha((p/'WORTH.md').read_bytes())=='52753a047f270a046cf6c2acb7098c03ac19be655db452860512fea9ff111d9d'
pins={}
for name in ['PLAN.md','WORTH.md','CRITIC-WORTH-PINS.json','critic-worth-pins.py','root-close.py']:
 b=(p/name).read_bytes();pins[name]={'bytes':len(b),'sha256':sha(b)}
ended=datetime.datetime.now(datetime.timezone.utc);assert ended<datetime.datetime.fromisoformat('2026-10-04T05:00:00+00:00')
result={'command':'python3 docs/evidence/nonhair-2026-10-03/body-breadth-worth/root-close.py','pid':os.getpid(),'started':started.isoformat(),'ended':ended.isoformat(),'pins':pins,'independentCurrentBindings':9,'decision':'B: no literal new artist curation target; supported nearest-bake variation alone does not deliver a curated starter. No global image absence/duplication or endpoint appearance inference.','scope':'Root fully reads handoff/reader/metadata, independently reconciles all nine current source/image bindings; no parser/import/runtime/native activity.'}
with (p/'ROOT-CLOSE.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
