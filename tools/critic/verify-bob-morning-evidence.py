"""Read-only byte preservation audit of the September 29 evidence and original inputs."""
from pathlib import Path
import json,hashlib,datetime,os
root=Path.cwd();out=root/'captures/bob-morning-preservation-v2';assert not out.exists();out.mkdir()

def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb')as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
source=Path(__file__).resolve();(out/source.name).write_bytes(source.read_bytes())
report=dict(started=datetime.datetime.now(datetime.timezone.utc).isoformat(),pid=os.getpid(),status='running',sourceSha256=sha(source),manifests=[],uniqueFiles=0,uniqueBytes=0,acceptedAssets=[],references=[],errors=[])
def save():
 (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
save();seen={}
try:
 for manifest in sorted((root/'docs/evidence/hair-2026-09-29').rglob('*manifest.json')):
  d=json.loads(manifest.read_text());files=d['files'];total=0
  assert isinstance(files,list)and files
  for f in files:
   p=root/f['path'];expected=(f['bytes'],f['sha256'])
   if str(p)in seen:assert seen[str(p)]==expected
   else:
    assert p.is_file()and p.stat().st_size==f['bytes'],str(p)
    assert sha(p)==f['sha256'],str(p)
    seen[str(p)]=expected;report['uniqueFiles']+=1;report['uniqueBytes']+=f['bytes']
   total+=f['bytes']
  if 'fileCount'in d:assert d['fileCount']==len(files)
  if 'bytes'in d:assert d['bytes']==total
  if 'totalBytes'in d:assert d['totalBytes']==total
  if 'pngCount'in d:assert d['pngCount']==sum(f['path'].endswith('.png')for f in files)
  report['manifests'].append(dict(file=str(manifest.relative_to(root)),sha256=sha(manifest),files=len(files),bytes=total));save()
 pins={'assets/hair/bob02/g050.glb':'a666a80777f0b93a824857dc2e2cbffe27cd2c8991a3f4ec8215ebc1d94298bd','assets/hair/bob01/g050.glb':'d425444f3d478c63e4842f7a789aa89ac1968c7d13b5aac87ca6717700df56e7','assets/figures/figure_g050.glb':'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14'}
 for p,h in pins.items():assert sha(root/p)==h;report['acceptedAssets'].append(dict(path=p,sha256=h))
 ref=root/'reference/bob-appearance-2026-09-29';index=json.loads((ref/'index.json').read_text());report['referenceIndexSha256']=sha(ref/'index.json')
 for r in index['references']:
  for p in [ref/r['file'],Path(r['original_path'])]:assert p.stat().st_size==r['bytes']and sha(p)==r['sha256'],str(p)
  report['references'].append(r)
 report['status']='passed';report['limits']=['Checks bytes listed in existing manifests and original reference pins; not a second visual, semantic or physical qualification.','Ignored captures remain local; this report is not an off-machine backup.','Unlisted files and unrelated worktrees are outside the preservation audit.']
except Exception as e:
 report['status']='failed';report['errors'].append(repr(e));raise
finally:
 report['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();save();print(json.dumps({k:v for k,v in report.items()if k not in ['manifests','references']},indent=2))
