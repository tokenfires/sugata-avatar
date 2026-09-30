"""Preserve the completed, physically matched fringe visibility intervention."""
from pathlib import Path
import datetime, hashlib, json
root=Path('captures/bob-fringe-ablation-v1')
out=Path('docs/evidence/hair-2026-09-29/fringe-attribution');out.mkdir(parents=True,exist_ok=True)
assert not (out/'archive-manifest.json').exists()
read=lambda p:json.loads(p.read_text())
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
paired=read(root/'paired-controls.json')
assert paired['status']=='complete; index-only held visibility intervention'
assert digest(Path(paired['asset']))==paired['assetSha256']
assert digest(root/'audit-bob-fringe-ablation.mjs')==paired['sourceSha256']
assert len(paired['rows'])==3
for row in paired['rows']:
    assert row['allRecordedStateExact'] and row['allGeometryExceptIndicesExact'] and row['removedTriangles']==1088
reports=[]
for item in paired['reports']:
    file=Path(item['path']);assert digest(file)==item['sha256'];r=read(file)
    assert r['status']=='captured' and not r['errors'] and len(r['cases'])==3
    for c in r['cases']:
        assert digest(file.parent/c['filename'])==c['imageSha256'] and c['candidateLoads']==1 and not c['errors']
    for g in r['geometryFiles']:assert digest(file.parent/g['filename'])==g['sha256']
    for p,h in r['sourceHashes'].items():
        assert digest(file.parent/'source'/p if p.startswith(('tools/','packages/')) else Path(p))==h
    reports.append(dict(file=str(file),sha256=item['sha256'],pid=r['pid'],finished=r['finished']))
files=[dict(path=str(p),bytes=p.stat().st_size,sha256=digest(p))for p in sorted(root.rglob('*'))if p.is_file()]
manifest=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),roots=[str(root)],fileCount=len(files),totalBytes=sum(f['bytes']for f in files),pngCount=sum(f['path'].endswith('.png')for f in files),generator=dict(path=str(Path(__file__)),sha256=digest(Path(__file__))),files=files)
summary=dict(status='Fringe contributes eyebrow tabs and some crown coverage; residual front breaks need separate attribution',asset=paired['asset'],assetSha256=paired['assetSha256'],reports=reports,pairedControlsSha256=digest(root/'paired-controls.json'),rows=paired['rows'],archive={k:v for k,v in manifest.items()if k!='files'},limits=paired['limits']+['This is a visibility diagnosis, not a changed asset or completed bob.','Local ignored raw evidence is not backed up by the tracked manifest.'])
for name,value in [('summary',summary),('archive-manifest',manifest)]:
    p=out/f'.{name}.pending.json';p.write_text(json.dumps(value,indent=2)+'\n');p.replace(out/f'{name}.json')
print(json.dumps(summary['archive'],indent=2))
