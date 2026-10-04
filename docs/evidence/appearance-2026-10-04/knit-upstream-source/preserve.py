from pathlib import Path
import json,hashlib,re,datetime,os
r=Path.cwd();d=Path(__file__).resolve().parent;start=datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(d/'FINAL.md')=='efea62c2553836b11bd2d72dad5b5a6fc52046f7d9e57d6cb8396e0e516d7688'
assert sha(d/'RESULT.md')=='8a71b4d21ef00460b16aec294cdc6c2a2788fd9bb9c9bfdccb6934bf6a9061d0'
guide=r/'docs/research/KNIT-UPSTREAM-SOURCE-2026-10-04.md'
mapping={'RECEIPT':d/'RECEIPT.md','OBSERVATIONS':d/'OBSERVATIONS.md','Fieldguide':guide}
finalPins={}
for label,h in re.findall(r'^- (.+) `([a-f0-9]{64})`',(d/'FINAL.md').read_text(),re.M):
 p=mapping[label];assert sha(p)==h,label;finalPins[str(p.relative_to(r))]=h
assert len(finalPins)==3
resultPins={'FETCH-1.json':'77cd8f06f47d03b039bb8de249eb623f5c700966eefd64d0521d387281df6565','FETCH-2.json':'a56cd70dd128a426a403cc281d3665fb9b59adc5670fddb41bd9cfb7bb1e4f6c','artist-image.jpg':'480890c762c17980374d8c6f74e964f655b9cdd57c08186695c1b65c312f5ef2','original-fisherman.obj':'2844465f4e798666a90f631ea4a89ae30d3e526ef045a978d338908750d21d09','DOWNLOAD-JOB.json':'9ae62648f09325c0db6413fabe43af78863f32c2dff601d95df037708e810d4f'}
for n,h in resultPins.items():assert sha(d/n)==h,n
assert sha(guide)=='ebb7c9260000c7e8e32b4d11205e3c09ca6b24e0fd458b74bc4da9bc995a8812'
credit=0;providers=[]
for name in ['SEARCH-1.json','SEARCH-2.json']:
 s=json.loads((d/name).read_text())['result']['value']['structuredContent'];assert s['success'];assert len(s['data']['web'])==3;credit+=s['creditsUsed'];providers.append(s['id'])
for name in ['FETCH-1.json','FETCH-2.json']:
 s=json.loads((d/name).read_text())['result']['value']['structuredContent'];m=s['metadata'];assert m['statusCode']==200;credit+=m['creditsUsed'];providers.append(m['scrapeId'])
assert credit==6
f1=json.loads((d/'FETCH-1.json').read_text())['result']['value']['structuredContent']['markdown']
row=next(line for line in f1.splitlines() if 'toigo_fisherman_sweater.png' in line);assert all(x in row for x in ['MargaretToigo','CC0','node/1187'])
f2=json.loads((d/'FETCH-2.json').read_text())['result']['value']['structuredContent']['markdown']
job=json.loads((d/'DOWNLOAD-JOB.json').read_text());assert job['url'] in f2 and job['status']=='downloaded-source-only'
assert job['output']['bytes']==(d/'original-fisherman.obj').stat().st_size==172798
assert job['output']['sha256']==sha(d/'original-fisherman.obj')
assert [x['method'] for x in job['requests']]==['HEAD','GET'] and all(x['status']==200 for x in job['requests'])
assert datetime.datetime.fromisoformat(job['finished'])<datetime.datetime(2026,10,4,10,59,11,tzinfo=datetime.timezone.utc)
closed=json.loads((d/'REFERENCE-CLOSED.json').read_text());assert closed['tabId']=='17' and len(closed['remaining'])==1 and closed['remaining'][0]['id']=='1'
links=[]
for p in [guide,d/'RECEIPT.md']:
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if target.startswith(('https://','http://')):continue
  path=Path(target) if target.startswith('/') else p.parent/target.split('#')[0];assert path.exists(),(p,target);links.append(target)
root={'pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fullResultRead':'f03378','deduplicatedPrimaryRead':'462051','finalPins':finalPins,'resultPins':resultPins,'providerIds':providers,'reportedProviderCredits':credit,'localLinkOccurrences':len(links),'decision':'A documented source/reference only; exact received bytes unparsed; root actual image agrees fitted/target mismatch; original tab closed; no native/geometry/fit admission'}
(d/'FINAL-ROOT.json').write_text(json.dumps(root,indent=2)+'\n')
payloads=sorted(p for p in d.iterdir() if p.is_file() and p.name!='MANIFEST.json');manifest={p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in payloads}
m=d/'MANIFEST.json';m.write_text(json.dumps(manifest,indent=2)+'\n');assert json.loads(m.read_text())==manifest
for p in payloads:assert sha(p)==manifest[p.name]['sha256'];p.chmod(0o444)
m.chmod(0o444)
print(json.dumps({'root':root,'preserved':{'payloads':len(payloads),'bytes':sum(x['bytes'] for x in manifest.values()),'manifestSha256':sha(m)}}))
