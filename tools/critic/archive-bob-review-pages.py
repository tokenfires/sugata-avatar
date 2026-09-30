"""Preserve failed and passed native review checks without altering their evidence."""
from pathlib import Path
import json,hashlib,datetime

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
read=lambda p:json.loads(Path(p).read_text())
out=Path('docs/evidence/hair-2026-09-29/review-controls');out.mkdir(exist_ok=True)
assert not(out/'archive-manifest.json').exists()
versions=[];files=[]
for v in range(2,7):
 root=Path(f'captures/lower-fallback-review-v{v}');r=read(root/'report.json')
 assert r['status']==('failed' if v<4 else 'passed') and r.get('finished')
 assert sha(root/'source.mjs')==r['sourceSha256']
 for p in r['pages']:assert sha(root/'page-source'/p['file'])==p['sha256']
 if v==6:
  assert len(r['states'])==8 and not r['errors']
  assert {(s['name'],s['width']) for s in r['states']}=={(n,w)for n in ['overview','head','ordinary','dark']for w in [1440,390]}
  for p in r['pages']:assert sha(p['file'])==p['sha256']
  for s in r['states']:
   assert s['scrollWidth']<=s['width']
   if s['name']=='overview':assert s['views']==['back','rear-oblique','front','right-profile','left-profile']
   else:assert s['playback']['advanced']['time']>1
 versions.append(dict(version=v,report=str(root/'report.json'),sha256=sha(root/'report.json'),status=r['status'],states=len(r['states']),pid=r['pid'],started=r['started'],finished=r['finished']))
 files.extend(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p))for p in sorted(root.rglob('*'))if p.is_file())
manifest=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),fileCount=len(files),totalBytes=sum(f['bytes']for f in files),pngCount=sum(f['path'].endswith('.png')for f in files),files=files,generator=dict(path=str(Path(__file__)),sha256=sha(__file__)))
summary=dict(status='v6 passed final current pages at1440and390; earlier failures retained',versions=versions,archive={k:v for k,v in manifest.items()if k!='files'},limits=['v2 requested an uncaptured rear-left view; replaced with captured front view.','v3 native-select Home assertion failed; v4 onward use selectOption for that control. OS menu keyboard behavior is not qualified.','Motion range controls retain Home/End/previous/next checks. Advancing video playhead does not prove perceptual animation quality.'])
for name,d in [('summary.json',summary),('archive-manifest.json',manifest)]:
 with(out/name).open('x')as f:json.dump(d,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in manifest.items()if k!='files'},indent=2))
