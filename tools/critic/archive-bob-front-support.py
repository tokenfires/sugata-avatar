"""Freeze two rejected front constructions and the four-witness constraint packet."""
from pathlib import Path
import json,hashlib,datetime
read=lambda p:json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,d):Path(p).write_text(json.dumps(d,indent=2)+'\n')
out=Path('docs/evidence/hair-2026-09-29/front-support');assert not(out/'archive-manifest.json').exists()
constraint=read('captures/bob-front-constraints-v1/report.json')
for p,h in constraint['pins'].items():assert sha(p)==h
assert constraint['status']=='complete read-only constraint inventory; feasibility undetermined'
audit=read('captures/bob-front-prototype-audit-v1/summary.json');assert audit['status']=='complete; both candidates rejected';assert audit['baseline']['triangleBodyPairs']==0
captures=[]
for root in ['captures/bob-front-flow-v1','captures/bob-front-support-v1']:
 a=read(root+'/candidate-report.json');assert sha(root+'/candidate.glb')==a['outputSha256'];assert a['restTriangleBodyPairs']>0
 r=read(root+'/neutral/report.json');assert r['status']=='captured' and r['errors']==[] and len(r['cases'])==3
 for case in r['cases']:assert sha(root+'/neutral/'+case['filename'])==case['imageSha256']
 for g in r['geometryFiles']:assert sha(root+'/neutral/'+g['filename'])==g['sha256']
 for p,h in r['sourceHashes'].items():
  assert sha(p)==h
  if p.startswith(('tools/','packages/')):assert sha(root+'/neutral/source/'+p)==h
 captures.append(dict(root=root,assetSha256=a['outputSha256'],reportSha256=sha(root+'/candidate-report.json'),captureReportSha256=sha(root+'/neutral/report.json'),restPairs=a['restTriangleBodyPairs'],minimumMm=a['minimumSelectedVertexClearanceMm']))
roots=[Path('captures/'+n) for n in ['bob-front-flow-v1','bob-front-support-v1','bob-front-prototype-audit-v1','bob-front-constraints-v1']]
files=[dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)) for root in roots for p in sorted(root.rglob('*')) if p.is_file()]
manifest=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),roots=[str(p) for p in roots],fileCount=len(files),totalBytes=sum(p['bytes'] for p in files),pngCount=sum(p['path'].endswith('.png') for p in files),files=files,generator=dict(path=str(Path(__file__)),sha256=sha(__file__)))
summary=dict(status='both front constructions rejected; no third candidate; constraints inventoried, feasibility undetermined',captures=captures,audit=dict(path='captures/bob-front-prototype-audit-v1/summary.json',sha256=sha('captures/bob-front-prototype-audit-v1/summary.json')),constraint=dict(path='captures/bob-front-constraints-v1/report.json',sha256=sha('captures/bob-front-constraints-v1/report.json')),critiqueSha256=sha(out/'CRITIQUE.md'),archive={k:v for k,v in manifest.items() if k!='files'},decision='Use the four exact witnesses for a local mesh-supported full-ribbon feasibility study before another whole-front asset. No handle/global-offset/fallback sweep.',limits=['No feasibility solver or candidate motion was run.','Actual native images and geometry confirm both failures; apparent forehead opening is not a safe style improvement.','Local ignored evidence; manifest is not an off-machine backup.'])
write(out/'summary.json',summary);write(out/'archive-manifest.json',manifest);print(json.dumps(summary['archive'],indent=2))
