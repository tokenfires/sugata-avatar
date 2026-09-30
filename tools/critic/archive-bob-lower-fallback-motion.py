"""Freeze complete fallback motion evidence with scoped body clearance and visual limits."""
from pathlib import Path
import datetime, hashlib, json

read=lambda p:json.loads(p.read_text())
def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''): h.update(block)
    return h.hexdigest()
def write(p,d):p.write_text(json.dumps(d,indent=2)+'\n')
out=Path('docs/evidence/hair-2026-09-29/lower-fallback-motion');out.mkdir(parents=True,exist_ok=True);assert not (out/'archive-manifest.json').exists()
assets={'captures/bob-side-envelope-v3/candidate.glb':'bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9',
        'captures/bob-lower-fallback-v1/candidate.glb':'8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7'}
for f,h in assets.items():assert digest(Path(f))==h
protocols={};capture_reports=[];audit_sources={}
for protocol,view,count,image_count,reuse_name in [('head','right-profile',556,186,'control-replay.json'),('ordinary','left-profile',721,241,'control-replay.json')]:
    root=Path(f'captures/lower-fallback-{protocol}-v1');pair=read(root/'paired-controls.json')
    assert pair['sourceHashesEqual'] and all(pair['setupEquality'].values()) and all(pair['descriptorEquality'].values())
    assert all(v==0 for k,v in pair['mismatchCounts'].items() if k!='otherVerticesHashEqual')
    arms={}
    for i,arm in enumerate(['baseline','candidate']):
        d=root/f'{arm}-{view}-brown';r=read(d/'report.json')
        assert r['status']=='captured' and not r['errors'] and len(r['samples'])==count and len(r['images'])==image_count
        assert r['arm']==arm and r['protocol']==protocol and r['view']==view
        assert digest(d/'report.json')==pair['reports'][i]['sha256']
        assert r['sourceHashes'][r['routedAsset']]==assets[r['routedAsset']]
        arms[arm]=dict(directory=str(d),reportSha256=digest(d/'report.json'),pid=r['pid'],finished=r['finished'])
        capture_reports.append((d,r))
    candidate=root/f'candidate-{view}-brown';a=read(candidate/'numerical-checks.json')
    assert a['status']=='complete' and a==read(candidate/'audit-progress.json')
    assert a['reportSha256']==arms['candidate']['reportSha256'] and a['sourceReport']==str(candidate/'report.json')
    assert len(a['rows'])==count and [r['frame'] for r in a['rows']]==list(range(count))
    assert a['summary']['totalTriangleBodyPairs']==0 and sum(row['negativeVertices'] for row in a['rows'])==0
    assert len(a['selectedCards'])==338 and a['selectedTriangles']==10816
    assert a['selectedCards']==read(candidate/'report.json')['selectedCards']
    for f,h in a['sourceHashes'].items():
        assert f not in audit_sources or audit_sources[f]==h
        audit_sources[f]=h
    reuse=read(root/reuse_name)
    assert reuse['status']=='exact-physical-replay; prior-body-audit-reused' and reuse['frameCount']==count
    assert reuse['replay']['reportSha256']==arms['baseline']['reportSha256']
    prior=Path(reuse['prior']['directory']);assert digest(prior/'report.json')==reuse['prior']['reportSha256']
    assert digest(Path(reuse['prior']['auditFile']))==reuse['prior']['auditSha256']
    assert digest(Path(reuse['sourceSnapshot']))==reuse['sourceSha256']
    for record in reuse['verifiedCaptureSnapshots']+reuse['prior']['sourceSnapshots']:
        assert digest(Path(record['file']))==record['sha256']
    assert all(f['allPhysicalFieldsExact'] for f in reuse['frames'])
    for record in reuse['frames']:
        n=record['frame'];assert digest(prior/f'sample-{n:04}.json.gz')==record['priorGeometrySha256']
        assert digest(root/f'baseline-{view}-brown'/f'sample-{n:04}.json.gz')==record['replayGeometrySha256']
    preview=read(root/'preview-cadence.json');assert digest(root/'paired-preview.mp4')==preview['sha256']
    assert preview['frameCount']==image_count and all(abs(float(f['pts'])-i/20)<1e-8 for i,f in enumerate(preview['frames']))
    assert digest(root/'encode-bob-lower-fallback-preview.py')==preview['sourceSha256']
    arms['candidate']['audit']=dict(file=str(candidate/'numerical-checks.json'),sha256=digest(candidate/'numerical-checks.json'),summary=a['summary'],
        minimumRow=min(a['rows'],key=lambda r:r['minimumVertexClearanceMm']),negativeVertexCount=sum(r['negativeVertices'] for r in a['rows']))
    arms['baseline']['auditReuse']=dict(file=str(root/reuse_name),sha256=digest(root/reuse_name),summary=reuse['reusedSummary'])
    protocols[protocol]=dict(arms=arms,pairedControlsSha256=digest(root/'paired-controls.json'),colliderDifference=pair['colliderDifference'],otherVertices=pair['otherVertices'],preview={k:v for k,v in preview.items() if k!='frames'})
front=Path('captures/lower-fallback-head-front-v1');repeat=read(front/'view-repeat.json')
assert repeat['status']=='complete' and all(all(v==0 for v in a['mismatchCounts'].values()) for a in repeat['arms'])
for i,arm in enumerate(['baseline','candidate']):
    d=front/f'{arm}-front-brown';r=read(d/'report.json')
    assert r['status']=='captured' and not r['errors'] and len(r['samples'])==556 and len(r['images'])==187
    assert repeat['arms'][i]['reportHashes'][1]==digest(d/'report.json')
    assert repeat['arms'][i]['reportHashes'][0]==protocols['head']['arms'][arm]['reportSha256']
    capture_reports.append((d,r))
native=[]
for version in [1]:
    d=Path(f'captures/lower-fallback-review-v{version}');r=read(d/'report.json');assert r['status']=='passed' and not r['errors']
    assert digest(d/'source.mjs')==r['sourceSha256']
    for p in r['pages']:assert digest(d/'page-source'/p['file'])==p['sha256']
    native.append(dict(directory=str(d),reportSha256=digest(d/'report.json'),finished=r['finished'],pid=r['pid']))
snapshot=Path('captures/lower-fallback-motion-audit-source-v1')
for f,h in audit_sources.items():
    dest=snapshot/f
    if dest.exists():assert digest(dest)==h
    else:
        origin=Path(f);assert digest(origin)==h;dest.parent.mkdir(parents=True,exist_ok=True)
        with dest.open('xb') as stream:stream.write(origin.read_bytes())
for d,r in capture_reports:
    for record in r['samples']:assert digest(d/record['geometryFile'])==record['geometrySha256']
    for record in r['images']:assert digest(d/record['file'])==record['sha256']
    for f,h in r['sourceHashes'].items():
        p=d/'source'/f if f.startswith(('tools/','packages/')) else Path(f)
        assert digest(p)==h
roots=[Path(f'captures/{n}') for n in ['lower-fallback-head-v1','lower-fallback-ordinary-v1','lower-fallback-head-front-v1','lower-fallback-review-v1','lower-fallback-motion-audit-source-v1']]
files=[dict(path=str(p),bytes=p.stat().st_size,sha256=digest(p)) for root in roots for p in sorted(root.rglob('*')) if p.is_file()]
source=Path(__file__);manifest=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),roots=[str(p) for p in roots],
    fileCount=len(files),totalBytes=sum(f['bytes'] for f in files),pngCount=sum(f['path'].endswith('.png') for f in files),files=files,
    generator=dict(path=str(source),sha256=digest(source)),frozenAssets=assets)
summary=dict(status='head and ordinary body audits clear; modest contour gain in sampled images; close head margin and minor front373 exception',
    protocols=protocols,frontReplay=dict(file=str(front/'view-repeat.json'),sha256=digest(front/'view-repeat.json'),allPhysicalFieldsExact=True),nativeReview=native,
    decision='Retain fallback as the scoped experimental lead; no accepted-asset replacement. Front and crown style remain separate work.',
    limits=['All body audits remain scoped to338selected cards, one figure/outfit and captured updates; no garments,hair-hair,alpha or continuous-time coverage.',
            'A small candidate-only dash at373 remains unattributed to a single visible card. The new audit covers338 selected cards and excludes fringe494. Minimum head clearance is only0.078131mm.',
            'Reuse is for unchanged controls with exact raw physical inputs, not modified-candidate inheritance or pixel equality.',
            'Raw evidence is local and ignored; this tracked manifest does not back it up off-machine.'],archive={k:v for k,v in manifest.items() if k!='files'})
write(out/'.summary.pending.json',summary);write(out/'.archive-manifest.pending.json',manifest)
(out/'.summary.pending.json').replace(out/'summary.json');(out/'.archive-manifest.pending.json').replace(out/'archive-manifest.json')
print(json.dumps(summary['archive'],indent=2))
