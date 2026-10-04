"""Preservation and delivery checks only; never opens a browser."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import datetime,hashlib,json,os,re
ROOT=Path('/Users/robault/GitHub/sugata-avatar')
P=ROOT/'docs/evidence/nonhair-2026-10-03/ink-review-page'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs=json.loads((P/'INPUTS.json').read_text())['pins'];a=json.loads((P/'ADOPTION.json').read_text())
for f,x in inputs.items():
 target=P/'INK-DENIM.before.md.source' if f=='looks/INK-DENIM.md' else ROOT/f
 assert h(target)==x,(f,target)
assert (ROOT/'looks/INK-DENIM.md').read_bytes()==(P/'INK-DENIM.before.md.source').read_bytes()+a['append'].encode()
assert h(ROOT/'looks/INK-DENIM.md')==a['newGuideSHA256']
assert h(ROOT/'looks/ink-denim-review.html')==h(P/'PAGE.html.source')==a['pageSHA256']
links=[]
for f in [ROOT/'looks/INK-DENIM.md',P/'README.md',P/'RECEIPT.md',P/'ROOT-VISUAL.md',P/'CHECKPOINT.md']:
 for ref in re.findall(r'\]\(([^)]+)\)',f.read_text()):
  u=urlsplit(ref)
  if u.scheme or ref.startswith('#'):continue
  target=(f.parent/unquote(u.path)).resolve();assert target.is_file(),(f,ref,target);links.append({'source':str(f.relative_to(ROOT)),'ref':ref,'target':str(target.relative_to(ROOT))})
ui=json.loads((P/'UI.json').read_text())
for s in ui['screenshots']:assert h(P/s['file'])==s['sha256']
assert h(P/'downloaded-ink-denim.json')==h(ROOT/'looks/ink-denim.json')
files=[f for f in P.rglob('*') if f.is_file() and f.name!='PRESERVATION.json']
manifest={str(f.relative_to(P)):{'sha256':h(f),'bytes':f.stat().st_size} for f in files}
r={'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 docs/evidence/nonhair-2026-10-03/ink-review-page/freeze.py','files':manifest,'fileCount':len(files),'bytes':sum(x['bytes'] for x in manifest.values()),'unchangedInputCount':9,'guideEpoch':a,'pageSHA256':h(ROOT/'looks/ink-denim-review.html'),'linkChecks':links,'status':'Exact accepted page/guide epoch and nine unchanged inputs; packet preserved readonly, no browser/native/product experiment'}
with (P/'PRESERVATION.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
for f in P.rglob('*'):
 if f.is_file():f.chmod(0o444)
print(json.dumps({'pid':r['pid'],'started':r['started'],'finished':r['finished'],'files':r['fileCount'],'bytes':r['bytes'],'links':len(links),'manifestSHA256':h(P/'PRESERVATION.json')}))
