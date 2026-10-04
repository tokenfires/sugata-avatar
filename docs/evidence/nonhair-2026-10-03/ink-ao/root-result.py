import datetime,hashlib,json,os,pathlib,struct
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');p=pathlib.Path(__file__).resolve().parent;started=datetime.datetime.now(datetime.timezone.utc).isoformat()
pre=json.loads((p/'PREFLIGHT.json').read_text());pins=[]
for v in pre['pins']:
 d=(root/v['file']).read_bytes();assert len(d)==v['bytes'] and hashlib.sha256(d).hexdigest()==v['sha256'],v['file'];pins.append(v)
states={};observations=[]
for tier,frames in [('balanced',['body','portrait']),('high',['body'])]:
 options=json.loads((p/f'INK-{tier}.json').read_text())
 for frame in frames:
  log=json.loads((p/f'capture/{tier}-{frame}-state.json').read_text());assert log['options']==options and log['failure'] is None and log['retirement'] is None
  s=log['states'][-1];r=s['report'];assert s['name']==f'{tier}-{frame}' and s['complete'] is True and s['clockSeconds']==0 and s['canvas']=={'width':1800,'height':2100}
  assert r['quality']['requested']==tier and r['quality']['tier']==tier and r['quality']['backend']=='webgpu' and r['quality']['backendMismatch'] is False
  assert r['identity']['bake']=='figure_g050' and r['identity']['gender']==.5 and r['hair']['attached'] is True and r['hair']['loadedStyle']=='bob02'
  colour=r['hair']['colour'];assert colour['applied']==colour['resolved']=='#413934' and colour['requestedTint'] is None and colour['appliedTint'] is None and colour['matchesAttached'] is True
  w=r['wardrobe'];assert w['attached'] is True and w['lastError'] is None and w['pendingCandidates']==0 and sorted(w['state']['worn'])==sorted(['foundation_bra','foundation_briefs','female_casualsuit01','shoes01'])
  assert w['appearance']['attached'] is True and w['appearance']['style']=='ecru' and w['appearance']['colours']==options['wardrobe']['colours']
  assert r['framing']['mode']==frame and r['scene']['id']=='studio' and r['scene']['lighting']['look']=='neutral' and r['scene']['lighting']['ambientAttached']==(tier=='balanced')
  assert (r['subsystems']['ambientOcclusion'] is not None)==(tier=='high') and r['motion']['seed']==20260807 and r['disposal']['disposed'] is False
  d=(p/f'capture/{tier}-{frame}.png').read_bytes();assert d[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',d[16:24])==(1800,2100)
  observations.append(dict(name=s['name'],at=s['at'],bytes=len(d),sha256=hashlib.sha256(d).hexdigest(),dimensions=[1800,2100],camera=s['camera'],quality=r['quality'],lighting=r['scene']['lighting'],ambientOcclusion=r['subsystems']['ambientOcclusion']))
  states[(tier,frame)]=s
 retirement=json.loads((p/f'capture/{tier}-retirement.json').read_text());assert retirement['failure'] is None and len(retirement['states'])==len(frames)
 rr=retirement['retirement'];assert rr['reason']=='manual' and rr['pendingAtRetirement'] is False and rr['ownerReturned'] is True and rr['disposal']=={'disposed':True,'leaked':[]} and rr['error'] is None
 logs=json.loads((p/f'capture/{tier}-console.json').read_text());assert len(logs)==3 and all(v['level']=='warn' for v in logs)
assert states[('balanced','body')]['camera']==states[('high','body')]['camera']
assert not (p/'capture/high-portrait.png').exists()
for file in sorted(p.rglob('*')):
 if file.is_file() and file.name!='ROOT-RESULT.json':
  d=file.read_bytes();pins.append(dict(file=str(file.relative_to(root)),bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/ink-ao/root-result.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),pins=pins,observations=observations,bodyNominalCameraEqual=True,decision='B: no four-image recommendation; first readiness-control failure stopped before High Portrait. Three actual originals retained; root viewed each whole original.',limits=['Readiness deadline is not proof of Avatar.create/render failure: next AX Ready/high-body actual nullfailure/complete true.','No performance/motion/fit/representation/whole-groom/convergence/in-pass camera/network/allocator qualification.','No retry/sourcefix/default/Showcase/asset change.'])
with (p/'ROOT-RESULT.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],pins=len(pins),bodyNominalCameraEqual=True,observations=[{k:v for k,v in x.items() if k in ['name','at','bytes','sha256','dimensions']} for x in observations],decision=out['decision'])))
