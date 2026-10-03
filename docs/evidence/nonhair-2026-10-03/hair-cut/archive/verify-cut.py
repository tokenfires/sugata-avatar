import pathlib,json,hashlib,struct,os,sys,datetime,urllib.parse,collections,math
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); folder=root/'docs/evidence/nonhair-2026-10-03/hair-cut'; raw=root/'captures/wardrobe-hair-cut-2026-10-03-v1'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((raw/'report.json').read_text()); assert sha(raw/'report.json')=='c5b08ca36d2dc97a60e402ef098527eb4ae2458c8ce82f758c6985d1757c2e33'
assert r['status']=='observed' and not r['errors'] and r['finalPinsUnchanged'] is True
assert r['cleanup']=={'page':'closed','browser':'closed'} and r['borrowedReviewServerRetained'] is True
parse=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
assert parse(r['started'])<parse(r['finished'])<parse(r['stop'])
pins={}
for p,h in r['sources'].items():assert sha(root/p)==h,p;pins[p]=h
assert len(r['sources'])==380
assert sha(root/'tools/critic/wardrobe-hair-cut-ui.mjs')==r['instrumentSHA256']==sha(raw/'instrument.mjs')
for n in ['showcase.js','showcase.html','showcase-settings.mjs','showcase-presets.mjs','viewer-framing.mjs']:assert sha(raw/n)==r['sources']['packages/testbed/src/'+n]
expected_files={'assets/wardrobe/body/g050.glb','assets/wardrobe/foundation_bra/g050.glb','assets/wardrobe/foundation_briefs/g050.glb','assets/wardrobe/female_casualsuit01/g050.glb','assets/wardrobe/female_elegantsuit01/g050.glb','assets/wardrobe/shoes01/g050.glb','assets/hair/bob02/g050.glb','assets/hair/bob01/g050.glb'}
assert {c['file'] for c in r['assetInventory']}==expected_files
inventory={c['file']:c for c in r['assetInventory']}
for a in r['assets']:
 assert a['file'] in expected_files
 c=inventory[a['file']]; u=urllib.parse.urlsplit(a['url']);assert u.scheme=='http' and u.netloc=='127.0.0.1:5173' and u.path in c['paths']
 assert a['sha256']==c['sha256']==r['sources'][a['file']]==sha(root/a['file'])
 assert (root/a['file']).stat().st_size==a['bytes']
assert {a['file'] for a in r['assets']}==expected_files
snapshots=[]
def collect(o):
 if isinstance(o,dict):
  if 'configuration' in o and 'cutButtons' in o:snapshots.append(o)
  for v in o.values():collect(v)
 elif isinstance(o,list):
  for v in o:collect(v)
collect({'cases':r['cases'],'guards':r['guards']})
def expected_config(url):
 p={k:v[-1] for k,v in urllib.parse.parse_qs(urllib.parse.urlsplit(url).query,keep_blank_values=True).items()}
 preset=p.get('preset','casual');assert preset in ('casual','elegant');cut={'casual':'bob02','elegant':'bob01'}[preset]; outfit=p.get('outfit',preset);style=p.get('style','ecru');scene=p.get('scene','studio');light=p.get('light','studio')
 config={'identity':{'gender':.5,'mode':'nearest'},'hair':cut,'frame':p.get('frame','body'),'quality':'balanced','scene':scene,'seed':20260807,'pose':'relaxed-standing','wardrobe':{'outfit':[{'casual':'female_casualsuit01','elegant':'female_elegantsuit01'}[outfit],'shoes01'],'foundation':{'TORSO':'foundation_bra','HIPS':'foundation_briefs'}}}
 if scene=='studio':config['lighting']=light
 else:assert scene=='kitchen' and light=='studio'
 if style!='original':config['wardrobe']['style']=style
 colours={key:p[param].lower() for key,param in [('top','topColor'),('bottom','bottomColor'),('shoes','shoesColor')] if param in p}
 if colours:config['wardrobe']['colours']=colours
 if 'hairColour' in p:config['hairColour']=p['hairColour'].lower()
 if 'hairTintColour' in p:config['hairTint']={'colour':p['hairTintColour'].lower(),'amount':float(p['hairTintAmount'])}
 return config
for s in snapshots:
 cfg=s['configuration'];assert cfg==expected_config(s['url']);assert s['hair']['attached'] is True and s['hair']['loadedStyle']==s['hair']['style']==cfg['hair']
 assert s['hair']['colour']['matchesAttached'] is True
 assert s['hair']['colour']['requested']==s['hair']['colour']['applied']==cfg.get('hairColour')
 assert s['hair']['colour']['requestedTint']==s['hair']['colour']['appliedTint']==cfg.get('hairTint')
 assert {b['cut'] for b in s['cutButtons']}=={'bob01','bob02'}
 for b in s['cutButtons']:assert b['pressed']==str(b['cut']==cfg['hair']).lower() and b['disabled'] is False
 cut_preset={'bob02':'casual','bob01':'elegant'}[cfg['hair']];outfit='casual' if 'female_casualsuit01' in cfg['wardrobe']['outfit'] else 'elegant'
 for a in s['starters']:assert a['current']==str(a['preset']==cut_preset and outfit==cut_preset).lower()
 assert s['frame']['mode']==cfg['frame'] and s['storage']=={} and s['pause']=='true'
 assert math.isfinite(s['frame']['zoom']) and s['frame']['zoom']>0
assert len(r['cases'])==2
for c in r['cases']:
 assert c['after']['configuration']==dict(c['before']['configuration'],hair=c['target'])
 assert c['before']['storage']==c['after']['storage']
assert [c['target'] for c in r['cases']]==['bob01','bob02'];assert [c['keyboard'] for c in r['cases']]==[False,True]
kinds=collections.Counter(g['kind'] for g in r['guards']);assert kinds['layout']==5 and kinds['same attached cut no-op']==3
layouts=[]
for g in r['guards']:
 kind=g['kind']
 if kind=='same attached cut no-op':
  assert g['before']['configuration']==g['after']['configuration'] and g['before']['url']==g['after']['url'] and g['before']['storage']==g['after']['storage']
 elif kind=='layout':
  assert g['overflow'] is False and len(g['buttons'])==2
  for b in g['buttons']:
   q=b['rect'];assert q['width']>=100 and q['height']>=43 and q['x']>=0 and q['x']+q['width']<=g['width']+.01 and b['scrollWidth']<=b['clientWidth']
  layouts.append({'label':g['label'],'width':g['width'],'buttonRects':[b['rect'] for b in g['buttons']],'focused':[b['cut'] for b in g['buttons'] if b['focused']]})
 elif kind=='actual downloaded JSON reopening':
  assert sha(raw/'changed-look.json')==g['sha256'];assert json.loads((raw/'changed-look.json').read_text())==g['before']['configuration']==g['after']['configuration'];assert g['before']['storage']==g['after']['storage']
 elif kind=='real PNG export disabled/no navigation':
  assert g['before']['configuration']==g['after']['configuration'] and g['before']['url']==g['held']['url']==g['after']['url'];assert g['before']['storage']==g['held']['storage']==g['after']['storage'];assert g['held']['sameOwner'] is True;assert sha(raw/'guard-export.png')==g['exportSHA256']
 elif kind in ('real outfit busy guard','deliberate observed failure availability'):
  assert g['disabled'] is True and g['before']==g['after']
assert len(r['retirements'])==4 and {x['label'] for x in r['retirements']}=={'desktop-long-bob','json-reopen','context-change','mobile-chin-bob'}
for x in r['retirements']:assert x['persisted'] is False and x['disposal']=={'disposed':True,'leaked':[]}
assert r['finalRetirement']=={'disposed':True,'leaked':[]}
images=[]
for im in r['images']:
 b=(raw/im['file']).read_bytes();assert sha(raw/im['file'])==im['sha256'] and b[:8]==b'\x89PNG\r\n\x1a\n'; w,h=struct.unpack('>II',b[16:24]);assert w==im['viewport']['width'];assert h>=im['viewport']['height'];images.append(dict(im,dimensions=[w,h]))
assert len(images)==5
b=(raw/'guard-export.png').read_bytes();guard={'file':'guard-export.png','sha256':sha(raw/'guard-export.png'),'dimensions':list(struct.unpack('>II',b[16:24]))};assert guard['dimensions']==[282,510]
assert {p.name for p in raw.glob('*.png')}=={i['file'] for i in images}|{'guard-export.png'}
buildpath=folder/'checks/targeted-build.json';build=json.loads(buildpath.read_text());assert build['result']=='passed';assert build['options']['build']['rollupOptions']['input']==str(root/'packages/testbed/src/showcase.html')
for p,h in build['sourceHashes'].items():assert sha(root/p)==h==r['sources'][p]
assert sha(folder/'build-entry.mjs')==build['scriptSHA256'];assert len(build['outputs'])==72
for p,o in build['outputs'].items():assert sha(root/p)==o['sha256'] and (root/p).stat().st_size==o['bytes']
compiled=(root/'captures/wardrobe-hair-cut-targeted-build-2026-10-03-v1/src/showcase.html').read_text();assert 'id="hair-cut-controls"' in compiled and 'data-cut="bob01"' in compiled and 'data-cut="bob02"' in compiled
warnings=collections.Counter()
for w in r['warnings']:
 if w.startswith('Figure: this rig has no jaw'):key='rig fallback'
 elif w.startswith('Calling [RenderPassEncoder'):key='zero-index draw'
 elif w.startswith('THREE.TSL: Return statement'):key='inline Fn return'
 elif w.startswith('Compilation log for [ShaderModule "compute_surface adaptive contact ring-major queries"]:'):key='adaptive-contact shader compilation'
 else:raise AssertionError(w)
 warnings[key]+=1
assert sum(warnings.values())==22 and warnings['adaptive-contact shader compilation']==3
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/hair-cut/verify-cut.py','interpreter':sys.executable,'version':sys.version,'pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed-bounded-control-audit','verifierSHA256':sha(pathlib.Path(__file__)),'reportSHA256':sha(raw/'report.json'),'sourcePinCount':len(r['sources']),'sourceSnapshots':5,'configurationSnapshotCount':len(snapshots),'transitionCount':2,'snapshotConfigurationsMatchIndependentURLReconstruction':True,'jsonReopenSHA256':sha(raw/'changed-look.json'),'servedGLBRecords':len(r['assets']),'uniqueServedGLBs':8,'retirementLabels':[x['label'] for x in r['retirements']],'finalRetirement':r['finalRetirement'],'cleanup':r['cleanup'],'finishedBeforeDeadline':True,'images':images,'guardExport':guard,'layouts':layouts,'warningCounts':dict(warnings),'targetedBuildSHA256':sha(buildpath),'targetedBuildOutputs':72,'targetedBuildBytes':sum(x['bytes'] for x in build['outputs'].values()),'limits':['No browser, native capture, renderer, SDK helper execution, API mutation or product edit.','Same-owner no-op and during-export disabled condition are assertions in the pinned observed instrument; owner identifiers were not separately retained for independent reconstruction.','Finite report/URL/configuration/source/image/served-byte identity audit; no geometric, fit, temporal, colour-fidelity, shader-warning or AAA qualification.']}
(folder/'independent.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'status':receipt['status'],'pid':os.getpid(),'snapshots':len(snapshots),'warnings':dict(warnings),'receiptSHA256':sha(folder/'independent.json')}))
