from pathlib import Path
import hashlib,json,re,os,datetime
r=Path.cwd();d=Path(__file__).resolve().parent;old=d.parent/'knit-sweater-cage';start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(d/'FINAL.md')=='c829f3fc54b7fc8f4f5d95a7fdffd4dfc2ee9ad18790f126bdc2dab4d00fe5e5'
paths={'RECEIPT.md':d/'RECEIPT.md','CHECKPOINT.md':d/'CHECKPOINT.md','KNIT-CHARACTER-TARGET-2026-10-04.md':r/'docs/research/KNIT-CHARACTER-TARGET-2026-10-04.md','DAY-REPORT-2026-10-04.md':r/'docs/DAY-REPORT-2026-10-04.md'}
pins={}
for name,h in re.findall(r'^- ([\w.-]+) `([a-f0-9]{64})`',(d/'FINAL.md').read_text(),re.M):assert sha(paths[name])==h; pins[name]=h
assert len(pins)==4
assert sha(d/'RESULT.md')=='1484beda0005f8d0f10933f78c4040df64f89b9b4db5fceee1be1c6798f67840'
assert sha(d/'critic-witness.py')=='93c42d8f54503614218646b33c8d666fd6bae48c6cfa036bb411b1242a77cf0e'
job=json.loads((d/'AUTHOR-JOB.json').read_text());critic=json.loads((d/'CRITIC-WITNESS.json').read_text());root=json.loads((d/'ROOT-WITNESS.json').read_text())
assert job['status']=='failed' and job['outputs']==[] and critic['outputsAbsent']
for name,h in job['inputs'].items():assert sha(d/name)==h
assert critic['pins']==job['inputs']==root['sourcePins']
assert sha(d/'AUTHOR-JOB.json')==critic['rawJobSha256']==root['jobSha256']
assert all(not(p/n).exists() for p in [old,d] for n in ['sweater.json','sweater.obj'])
assert not(old/'AUTHOR-JOB.json').exists()
assert sha(r/'assets/wardrobe/body/g050.glb')=='fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a'
assert sha(d.parent/'knit-character-concept/concept-v1.png')=='f3b288db55fa2800ab7a7cd3007146be8328b73ee0692ce45783238947e87e77'
links=[]
for p in paths.values():
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if target.startswith(('https://','http://')):continue
  dest=Path(target) if target.startswith('/') else p.parent/target.split('#')[0]
  assert dest.exists(),(p,target);links.append({'from':str(p.relative_to(r)),'target':target})
result={'pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fullFinalRead':'5bc3a4','fullResultReads':['f1377c','153444','f69c1e'],'fourFinalPins':pins,'sourcePins':job['inputs'],'localLinkOccurrences':len(links),'decision':'B source construction; A accurate wording. No output/native/current-avatar edits. Preserve both owned packets only.'}
(d/'FINAL-ROOT.json').write_text(json.dumps(result,indent=2)+'\n')
manifests={}
for packet in [old,d]:
 payloads=sorted(p for p in packet.rglob('*') if p.is_file() and p.name!='MANIFEST.json')
 manifest={str(p.relative_to(packet)):{'bytes':p.stat().st_size,'sha256':sha(p)} for p in payloads}
 path=packet/'MANIFEST.json';path.write_text(json.dumps(manifest,indent=2)+'\n')
 assert json.loads(path.read_text())==manifest
 for p in payloads:assert sha(p)==manifest[str(p.relative_to(packet))]['sha256'];p.chmod(0o444)
 path.chmod(0o444)
 manifests[packet.name]={'payloads':len(payloads),'bytes':sum(x['bytes'] for x in manifest.values()),'manifestSha256':sha(path)}
print(json.dumps({'root':result,'preserved':manifests}))
