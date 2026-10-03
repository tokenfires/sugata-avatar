import pathlib,json,hashlib,datetime,shutil,os,struct,urllib.parse,urllib.request,re
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');base=root/'docs/evidence/nonhair-2026-10-03/hair-cut';raw=root/'captures/wardrobe-hair-cut-2026-10-03-v1';started=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert not (base/'archive').exists(),'One archival closure only'
r=json.loads((raw/'report.json').read_text());ind=json.loads((base/'independent.json').read_text());assert (base/'CRITIQUE.md').exists()
assert sha(raw/'report.json')==ind['reportSHA256']=='c5b08ca36d2dc97a60e402ef098527eb4ae2458c8ce82f758c6985d1757c2e33'
assert sha(base/'independent.json')=='1ed12b21de420c10c539796aa1fa74740322753d36b247847bb35a8837e61414'
assert sha(base/'verify-cut.py')==ind['verifierSHA256']=='c49eb68bfc99ee5c55b2af4f1f26a052d9c8e9e154bc86731321f04f8fb8bdaf'
assert r['status']=='observed' and r['errors']==[] and r['cleanup']=={'page':'closed','browser':'closed'} and r['finalPinsUnchanged']
assert r['finished']<r['stop'];assert ind['sourcePinCount']==380 and ind['sourceSnapshots']==5 and ind['configurationSnapshotCount']==16
pins=dict(json.loads((root/'docs/evidence/nonhair-2026-10-03/url-admission/archive/manifest.json').read_text())['externalPins'])
for p,h in r['sources'].items():
 if p in pins and pins[p]!=h:assert p in ['packages/testbed/src/showcase.js','packages/testbed/src/showcase.html']
 pins[p]=h
pins['tools/critic/wardrobe-hair-cut-ui.mjs']=r['instrumentSHA256']
for p,h in pins.items():assert sha(root/p)==h,p
for name in ['showcase.js','showcase.html','showcase-settings.mjs','showcase-presets.mjs','viewer-framing.mjs']:assert sha(raw/name)==r['sources']['packages/testbed/src/'+name]
assert sha(raw/'instrument.mjs')==r['instrumentSHA256']
assert [a['label'] for a in r['retirements']]==ind['retirementLabels'] and r['finalRetirement']==ind['finalRetirement']=={'disposed':True,'leaked':[]}
for im,ci in zip(r['images'],ind['images']):
 assert im['file']==ci['file'] and im['sha256']==ci['sha256']==sha(raw/im['file']);assert list(struct.unpack('>II',(raw/im['file']).read_bytes()[16:24]))==ci['dimensions']
assert sha(raw/'guard-export.png')==ind['guardExport']['sha256'];assert sha(raw/'changed-look.json')==ind['jsonReopenSHA256']
assert len(r['assets'])==ind['servedGLBRecords']==31 and len({a['file'] for a in r['assets']})==ind['uniqueServedGLBs']==8
for a in r['assets']:assert sha(root/a['file'])==a['sha256'] and (root/a['file']).stat().st_size==a['bytes']
snapshots=[]
def collect(v):
 if isinstance(v,dict):
  if 'configuration' in v and 'cutButtons' in v:snapshots.append(v)
  for o in v.values():collect(o)
 elif isinstance(v,list):
  for o in v:collect(o)
collect({'cases':r['cases'],'guards':r['guards']});assert len(snapshots)==16
for s in snapshots:
 q=urllib.parse.parse_qs(urllib.parse.urlsplit(s['url']).query,keep_blank_values=True);get=lambda k,d=None:q.get(k,[d])[0];c=s['configuration'];preset=get('preset','casual');outfit=get('outfit',preset)
 assert c['hair']=={'casual':'bob02','elegant':'bob01'}[preset] and c['frame']==get('frame','body') and c['scene']==get('scene','studio')
 assert c['wardrobe']['outfit']==[{'casual':'female_casualsuit01','elegant':'female_elegantsuit01'}[outfit],'shoes01']
 assert c['wardrobe'].get('style','original')==get('style','ecru') and c.get('hairColour')==get('hairColour')
 assert c['hair']==s['hair']['loadedStyle']==s['hair']['style'] and s['hair']['attached'] and s['hair']['colour']['matchesAttached']
 colours={key:get(param) for key,param in [('top','topColor'),('bottom','bottomColor'),('shoes','shoesColor')] if param in q};assert c['wardrobe'].get('colours',{})==colours
 tint={'colour':get('hairTintColour'),'amount':float(get('hairTintAmount'))} if 'hairTintColour' in q else None;assert c.get('hairTint')==tint
 if c['scene']=='studio':assert c['lighting']==get('light','studio')
 else:assert 'lighting' not in c and get('light','studio')=='studio'
 assert c['identity']=={'gender':.5,'mode':'nearest'} and c['quality']=='balanced' and c['seed']==20260807 and c['pose']=='relaxed-standing'
 assert c['wardrobe']['foundation']=={'TORSO':'foundation_bra','HIPS':'foundation_briefs'} and s['storage']=={}
build=json.loads((base/'checks/targeted-build.json').read_text());assert sha(base/'checks/targeted-build.json')==ind['targetedBuildSHA256'];assert len(build['outputs'])==ind['targetedBuildOutputs']==72
for p,o in build['outputs'].items():assert sha(root/p)==o['sha256'] and (root/p).stat().st_size==o['bytes'];pins[p]=o['sha256']
assert sum(o['bytes'] for o in build['outputs'].values())==ind['targetedBuildBytes']==129949900
for name in ['settings','presets','build']:
 d=json.loads((base/'checks'/f'{name}.json').read_text());assert d['exit']==0 and sha(base/'checks'/f'{name}.stdout')==d['stdoutSHA256']
value=root/'docs/evidence/nonhair-2026-10-03/wardrobe-cut-selection/NEXT-VALUE.md';assert sha(value)=='ed668ee53e17c1008e60b101a6a7a7d303880aab95aa2199c4d7520d708fd028';shutil.copyfile(value,base/'NEXT-VALUE.md')
archive=base/'archive';(archive/'capture').mkdir(parents=True)
files={}
def copy(p,rel):
 t=archive/rel;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,t);assert sha(p)==sha(t);files[str(rel)]={'sha256':sha(t),'bytes':t.stat().st_size}
for p in sorted(raw.rglob('*')):
 if p.is_file():copy(p,pathlib.Path('capture')/p.relative_to(raw))
for p in sorted(base.rglob('*')):
 if p.is_file() and archive not in p.parents:copy(p,p.relative_to(base))
for p,h in pins.items():assert sha(root/p)==h,p
# Static review availability/byte identity only. Native originals qualify their own UI cases.
http=[]
for rel in ['review.html','README.md','CRITIQUE.md','archive/capture/desktop-long-bob.png','archive/capture/mobile-chin-bob.png','archive/capture/narrow-short-control.png']:
 p=base/rel;url='http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/'+str(p.relative_to(root))
 with urllib.request.urlopen(url,timeout=5) as response:
  data=response.read();assert response.status==200
  if p.suffix=='.html':
   text=data.decode();assert 'Choose a cut. Keep your recipe.' in text
   for name in ['desktop-before.png','desktop-long-bob.png','mobile-before.png','mobile-chin-bob.png','narrow-short-control.png']:assert name in text
  else:assert hashlib.sha256(data).hexdigest()==sha(p)
  http.append({'file':str(p.relative_to(root)),'status':response.status,'sourceSHA256':sha(p),'servedSHA256':hashlib.sha256(data).hexdigest(),'identity':'HTML may be development-transformed; title/media names only' if p.suffix=='.html' else 'exact bytes'})
receipt={'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'accepted-bounded-hair-cut-control','files':files,'externalPins':pins,'rootHandoffReconciled':{'criticReceipt':sha(base/'independent.json'),'criticVerifier':sha(base/'verify-cut.py'),'critique':sha(base/'CRITIQUE.md'),'nativeSourceSnapshots':5,'independentURLConfigurations':16},'http':http,'limit':'HTTP bytes do not qualify the review HTML layout. Actual five UI originals qualify finite native control cases; mobile dark hair remains low contrast. No new hair/fit/motion/identity/AAA qualification.'}
(archive/'manifest.json').write_text(json.dumps(receipt,indent=2)+'\n')
for rel,e in files.items():assert sha(archive/rel)==e['sha256']
for p in list(archive.rglob('*'))+list(raw.rglob('*'))+[root/p for p in build['outputs']]:
 if p.is_file():p.chmod(0o444)
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-03T11:31:00+00:00')
print(json.dumps({'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':len(files),'bytes':sum(e['bytes'] for e in files.values()),'externalPins':len(pins),'manifestSHA256':sha(archive/'manifest.json')}))
