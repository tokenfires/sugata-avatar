"""Freeze original-dark rear motion and its exact links to prior physical audits."""
from pathlib import Path
import json,hashlib,datetime
read=lambda p:json.loads(Path(p).read_text())
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
out=Path('docs/evidence/hair-2026-09-29/lower-fallback-dark-motion');assert not(out/'archive-manifest.json').exists();root=Path('captures/lower-fallback-dark-head-v1')
pair=read(root/'paired-controls.json');assert pair['sourceHashesEqual'] and all(pair['setupEquality'].values()) and all(pair['descriptorEquality'].values());assert all(v==0 for k,v in pair['mismatchCounts'].items() if k!='otherVerticesHashEqual')
for i,arm in enumerate(['baseline','candidate']):
 d=root/f'{arm}-rear-oblique-dark';r=read(d/'report.json');assert r['status']=='captured' and not r['errors'] and len(r['samples'])==556 and len(r['images'])==186
 assert sha(d/'report.json')==pair['reports'][i]['sha256'];reuse=read(root/f'{arm}-physical-replay.json');assert reuse['status']=='exact full physical replay; prior body audit linked';assert reuse['frameCount']==556 and all(f['allPhysicalFieldsExact'] for f in reuse['frames']);assert reuse['replay']['reportSha256']==sha(d/'report.json')
 assert sha(reuse['prior']['auditFile'])==reuse['prior']['auditSha256'];assert sha(Path(reuse['prior']['directory'])/'report.json')==reuse['prior']['reportSha256'];assert sha(reuse['sourceSnapshot'])==reuse['sourceSha256']
 for s in reuse['snapshots']+reuse['auditSources']:assert sha(s['file'])==s['sha256']
 for s in r['samples']:assert sha(d/s['geometryFile'])==s['geometrySha256']
 for im in r['images']:assert sha(d/im['file'])==im['sha256']
 for p,h in r['sourceHashes'].items():
  assert sha(p)==h
  if p.startswith(('tools/','packages/')):assert sha(d/'source'/p)==h
cadence=read(root/'preview-cadence.json');assert cadence['frameCount']==186 and cadence['width']==1800 and cadence['height']==868;assert sha(root/'paired-preview.mp4')==cadence['sha256'];assert sha(root/'encode-bob-lower-fallback-dark-preview.py')==cadence['sourceSha256'];assert all(abs(float(f['pts'])-i/20)<1e-8 for i,f in enumerate(cadence['frames']))
files=[dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(root.rglob('*')) if p.is_file()]
manifest=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),root=str(root),fileCount=len(files),totalBytes=sum(p['bytes'] for p in files),pngCount=sum(p['path'].endswith('.png') for p in files),files=files,generator=dict(path=str(Path(__file__)),sha256=sha(__file__)))
summary=dict(status='sampled inward contour retained in original-dark rear motion; exact physical replay links prior338-card audits',critiqueSha256=sha(out/'CRITIQUE.md'),pairedControlsSha256=sha(root/'paired-controls.json'),preview={k:v for k,v in cadence.items() if k!='frames'},archive={k:v for k,v in manifest.items() if k!='files'},limits=['No new body oracle for this viewing condition; per-arm556states exactly replay prior audited states.','The separate158-card head audit finds a shared card58 contact. The prior338-card pass is not an all496 pass.','Nine image pairs independently reviewed; no continuous perceptual or all-motion acceptance.','Local ignored evidence; manifest is not an off-machine backup.'])
for name,data in [('summary.json',summary),('archive-manifest.json',manifest)]:
 with(out/name).open('x')as f:json.dump(data,f,indent=2);f.write('\n')
print(json.dumps(summary['archive'],indent=2))
