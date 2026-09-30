"""Combine disjoint captured ribbon scopes without claiming a new whole-asset pass."""
from pathlib import Path
import json,hashlib,datetime
read=lambda p:json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
out=Path('docs/evidence/hair-2026-09-29/lower-fallback-full-audit');assert not(out/'archive-manifest.json').exists()
results=[]
for protocol,view,count in [('head','right-profile',556),('ordinary','left-profile',721)]:
 for arm in ['baseline','candidate']:
  d=Path(f'captures/lower-fallback-front-audit-v1/{protocol}-{arm}');a=read(d/'numerical-checks.json');assert a['status']=='complete' and a==read(d/'audit-progress.json') and len(a['rows'])==count
  capture=Path(f'captures/lower-fallback-{protocol}-v1/{arm}-{view}-brown');r=read(capture/'report.json');assert a['reportSha256']==sha(capture/'report.json') and a['assetSha256']==r['sourceHashes'][r['routedAsset']]
  for p,h in a['sourceHashes'].items():assert sha(d/'source'/p)==h
  if arm=='candidate':regional=capture/'numerical-checks.json';reuse=None
  else:
   reuse=Path(f'captures/lower-fallback-{protocol}-v1/control-replay.json');u=read(reuse);assert u['status']=='exact-physical-replay; prior-body-audit-reused';assert u['replay']['reportSha256']==sha(capture/'report.json');regional=Path(u['prior']['auditFile']);assert sha(regional)==u['prior']['auditSha256'];assert all(f['allPhysicalFieldsExact'] for f in u['frames'])
  b=read(regional);assert b['status']=='complete' and len(b['rows'])==count and b['summary']['totalTriangleBodyPairs']==0
  assert len(a['selectedCards'])==158 and len(b['selectedCards'])==338 and not(set(a['selectedCards'])&set(b['selectedCards'])) and set(a['selectedCards'])|set(b['selectedCards'])==set(range(496))
  assert a['selectedTriangles']+b['selectedTriangles']==15872
  for i,row in enumerate(a['rows']):assert row['frame']==i and row['time']==b['rows'][i]['time'] and row['rawGeometrySha256']==r['samples'][i]['geometrySha256']
  union=dict(frames=count,cardCount=496,triangleCount=15872,totalTriangleBodyPairs=a['summary']['totalTriangleBodyPairs'],crossingFrames=a['summary']['crossingFrames'],negativeVertexCount=a['summary']['negativeVertexCount']+sum(x['negativeVertices'] for x in b['rows']),minimumVertexClearanceMm=min(a['summary']['minimumVertexClearanceMm'],b['summary']['minimumVertexClearanceMm']),capExcluded=True)
  results.append(dict(protocol=protocol,arm=arm,frontAudit=dict(path=str(d/'numerical-checks.json'),sha256=sha(d/'numerical-checks.json'),summary=a['summary']),regionalAudit=dict(path=str(regional),sha256=sha(regional),summary=b['summary']),controlReplay=None if reuse is None else dict(path=str(reuse),sha256=sha(reuse)),union=union))
w=read('captures/lower-fallback-front58-witness-v1/report.json');assert w['status']=='shared card58 contact independently reproduced' and w['card58AuthoredPositionNormalExact']
for row in w['rows']:assert sha(row['auditFile'])==row['auditSha256'] and len(row['intersections'])==2
roots=[Path('captures/lower-fallback-front-audit-v1'),Path('captures/lower-fallback-front58-witness-v1')]
files=[dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)) for root in roots for p in sorted(root.rglob('*')) if p.is_file()]
manifest=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),roots=[str(p) for p in roots],fileCount=len(files),totalBytes=sum(p['bytes'] for p in files),files=files,generator=dict(path=str(Path(__file__)),sha256=sha(__file__)))
summary=dict(status='ordinary496-ribbon body audit clear in botharms; head sharedfront58contact in botharms; capexcluded',results=results,witness=dict(path='captures/lower-fallback-front58-witness-v1/report.json',sha256=sha('captures/lower-fallback-front58-witness-v1/report.json')),critiqueSha256=sha(out/'CRITIQUE.md'),archive={k:v for k,v in manifest.items() if k!='files'},decision='Preserve experimental inward lead with shared front58 exception; no metric-driven geometry or stiffness tweak. Carry witness into broader front work.',limits=['Disjoint496ribbon union excludes1128cap triangles,garments,hair-hair,alpha and between-update motion.','The independent Three.Ray witness checks onlytwo pairs at256; it is not a second full-sequence oracle.','The original captured raw data remain in earlier frozen archives; this packet adds audits without modifying those roots.'])
for name,data in [('summary.json',summary),('archive-manifest.json',manifest)]:
 with(out/name).open('x')as f:json.dump(data,f,indent=2);f.write('\n')
print(json.dumps({**summary['archive'],'results':[dict(protocol=r['protocol'],arm=r['arm'],union=r['union'])for r in results]},indent=2))
