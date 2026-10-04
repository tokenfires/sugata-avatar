import datetime, hashlib, json, os, subprocess
from pathlib import Path
folder=Path(__file__).resolve().parent;repo=folder.parents[3]
started=datetime.datetime.now(datetime.timezone.utc)
assert started < datetime.datetime.fromisoformat('2026-10-04T04:50:00+00:00'), 'First-open cutoff exceeded'
review=(folder/'CRITIC-SOURCE.md').read_text()
assert 'GO' in review.splitlines()[0], 'No final source admission'
metadata=json.loads((folder/'CRITIC-SOURCE-PINS.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
for filename,pin in metadata['pins'].items():
 b=(repo/filename).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256'],filename
literal=json.loads((folder/'ROOT-LITERAL.json').read_text())
for filename,pin in literal['pins'].items():
 b=(folder/filename).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256'],filename
assert sha((repo/literal['source']['file']).read_bytes())==literal['source']['sha256']
assert subprocess.run(['git','diff','--name-only'],cwd=repo,capture_output=True,text=True,check=True).stdout=='', 'Tracked sources changed'
checks=[]
for name in ['model.mjs','preview.mjs']:
 command=['node','--check',str(folder/name)];r=subprocess.run(command,capture_output=True,text=True)
 checks.append({'command':command,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr});assert r.returncode==0,name
for name in ['GUIDES.json','SOURCE-TRIANGLES.json']:assert (folder/name).stat().st_mode&0o222==0,'Literal is not frozen '+name
pins={}
for file in sorted(folder.iterdir()):
 if file.is_file():b=file.read_bytes();pins[file.name]={'bytes':len(b),'sha256':sha(b)}
ended=datetime.datetime.now(datetime.timezone.utc);assert ended < datetime.datetime.fromisoformat('2026-10-04T04:50:00+00:00')
result={'command':'python3 docs/evidence/hair-2026-10-03/surface-guides/preflight.py','pid':os.getpid(),'started':started.isoformat(),'ended':ended.isoformat(),'reviewedSourceRows':len(metadata['pins']),'reviewedLiteralRows':len(literal['pins']),'pins':pins,'syntax':checks,'trackedDiff':[],'scope':'Root source/pin/syntax admission, no model/Avatar/browser/render activity. Root separately fully reads the final critic handoff before this invocation.'}
with (folder/'ROOT-PREFLIGHT.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
