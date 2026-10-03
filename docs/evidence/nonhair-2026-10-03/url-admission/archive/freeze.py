import pathlib,json,hashlib,os,datetime,shutil,re
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');base=root/'docs/evidence/nonhair-2026-10-03/url-admission';started=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert not (base/'archive').exists(),'One archival closure only'
a=json.loads((base/'AUDIT.json').read_text());f=json.loads((base/'FIXTURES.json').read_text());ind=json.loads((base/'independent.json').read_text())
assert a['status']=='failed' and all(a[k]==[] for k in ['observed','synthetic','refusals'])
assert sha(base/'AUDIT.json')=='134b8df9bfa0fdd36750a667235b295658ba5c1a0ebd067dc68e8764ea00a1d1'
assert sha(base/'independent.json')=='2c96d258173afaaaf4899bc580682be6f39aed4e2cf9821290e4883edbe2fc92'
assert sha(base/'CRITIQUE.md')=='12f4d8555bb0269760379ff453ca4a16654a88b7998029cf6ad66c9115da7d41'
assert sha(base/'verify-refusal.py')==ind['verifierSHA256']
pins=dict(a['inputPins']);pins.update({'tools/critic/vite-declared-resource.mjs':a['helperSHA256'],'tools/critic/qualify-vite-declared-resource.mjs':a['instrumentSHA256']})
assert sha(base/'FIXTURES.json')==a['fixtureSHA256'] and json.loads((base/'INPUT-PINS.json').read_text())==a['inputPins']
prior=json.loads((root/'captures/current-review-2026-10-02-v1/report.json').read_text());rows=[]
for c in f['cases']:
 o=prior
 for k in c['witness'].replace('[','.').replace(']','').split('.'):o=o[int(k)] if isinstance(o,list) else o[k]
 assert (o if isinstance(o,str) else o['url'])==c['url'];assert str(root/c['file'])==c['absoluteFile']
 for p in [c['file'],c['snapshot']]:pins[p]=c['sha256']
 rows.append({'witness':c['witness'],'url':c['url'],'declaredFile':c['absoluteFile'],'sha256':c['sha256']})
assert rows==ind['retainedURLWitnessAndBytes'] and len(rows)==19 and len(pins)==46
for p,h in pins.items():assert sha(root/p)==h,p
lines=(root/'node_modules/vite/dist/node/chunks/node.js').read_text().splitlines()
wrong='\n'.join(lines[1739:1742]);right='\n'.join(lines[2162:2165]);ex=a['installedOracleExcerpts']['normalizePath']
assert wrong=='const normalizePath$1 = '+ex+';' and 'normalizePathRegExp' in lines[1738] and 'posix$1.sep' in wrong
assert right==ind['actualSourceExcerpt'] and 'path.posix.normalize(isWindows ? slash(id) : id)' in right
assert ind['wrongExcerpt']==ex and ind['wrongNamedFunctionExpressionLine']==1740 and ind['actualViteFunctionDeclarationLine']==2163
old=json.loads((root/'docs/evidence/nonhair-2026-10-03/current-review/archive/manifest.json').read_text())
for p,h in old['externalPins'].items():assert sha(root/p)==h,p
source=base/'source';source.mkdir()
for p in list(a['inputPins'])+['tools/critic/vite-declared-resource.mjs','tools/critic/qualify-vite-declared-resource.mjs','docs/evidence/nonhair-2026-10-03/URL-MAPPING-VALUE.md']:
 t=source/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/p,t);assert sha(t)==sha(root/p)
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/url-admission/freeze.py','pid':os.getpid(),'started':started,'finishedVerification':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'root-independent-refusal-provenance-passed','rootAuditSHA256':sha(base/'AUDIT.json'),'criticReceiptSHA256':sha(base/'independent.json'),'checkedUniqueInputFiles':len(pins),'retainedURLWitnesses':len(rows),'priorPreservationPins':len(old['externalPins']),'sourceWitness':{'namedExpressionLine':1740,'expression':wrong,'ViteDeclarationLine':2163,'declaration':right},'completedObserved':0,'completedSynthetic':0,'completedRefusals':0,'limit':'No helper/oracle execution or root rerun. Mutable live documentation equality is only at this verification instant; immutable snapshots preserve those bytes.'}
(base/'ROOT-INDEPENDENT.json').write_text(json.dumps(receipt,indent=2)+'\n')
archive=base/'archive';files={}
for p in sorted(base.rglob('*')):
 if not p.is_file() or archive in p.parents:continue
 rel=p.relative_to(base);t=archive/rel;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,t);assert sha(t)==sha(p);files[str(rel)]={'sha256':sha(t),'bytes':t.stat().st_size}
manifest={'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'status':'refused-oracle-extraction-no-fixture-admission','files':files,'externalPins':old['externalPins'],'historicalMutableInputs':['docs/PROGRESS-2026-10-02.md','docs/PRODUCT-ROADMAP.md'],'limit':'No helper adoption, CPU mapping, HTTP, fragment, browser or appearance acceptance.'}
(archive/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for rel,entry in files.items():assert sha(archive/rel)==entry['sha256']
for p in archive.rglob('*'):
 if p.is_file():p.chmod(0o444)
print(json.dumps({'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':len(files),'bytes':sum(e['bytes'] for e in files.values()),'preservationPins':len(old['externalPins']),'manifestSHA256':sha(archive/'manifest.json'),'rootReceiptSHA256':sha(base/'ROOT-INDEPENDENT.json')}))
