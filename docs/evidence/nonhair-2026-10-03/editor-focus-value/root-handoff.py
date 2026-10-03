from pathlib import Path
import json,hashlib,datetime,os
p=Path('docs/evidence/nonhair-2026-10-03/editor-focus-value');h=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest();start=datetime.datetime.now(datetime.timezone.utc).isoformat();c=json.loads((p/'critic-closeout.json').read_text());assert h(p/'critic-closeout.py')==c['readerSHA256'];assert h(p/'critic-closeout.json')=='4a6aea2833d75af74f7eae2fe3a31be1454894de14ed69a6d4cb2ba6c7224249';assert h(p/'CRITIC-POSTFLIGHT.md')=='b61e9c465953a4c8af7146c9a41d04b0aa33933d53021900aa35ce45323194bd';pins=dict(c['pins'])
for x in c['sourceMappings']:assert h(x['verifiedPath'])==x['sha256'];pins[x['verifiedPath']]=x['sha256']
for q,v in json.loads((p/'SOURCE-PINS.json').read_text()).items():assert h(q)==v;pins[q]=v
for q,v in pins.items():assert h(q)==v
assert c['nativeJob']==json.loads((p/'NATIVE-JOB.json').read_text());assert c['expiredRootPreflightUTC']>='2026-10-03T20:49:00';assert not Path('captures/clothing-descriptions-2026-10-03-v1').exists()
for n in ['critic-closeout.py','critic-closeout.json','CRITIC-POSTFLIGHT.md','ROOT-REFUSAL.json']:pins[str(p/n)]=h(p/n)
r=dict(pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),command='python3 '+str(p/'root-handoff.py'),sourceSHA256=h(__file__),pins=pins,sourceMappingRows=31,status='full critic handoff/reader/metadata independently reconciled; source-only candidate, exact accepted rollback; no native/AX/images')
(p/'ROOT-HANDOFF.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['pid','started','finished','sourceMappingRows']}));print('distinctpins',len(pins),'receipt',h(p/'ROOT-HANDOFF.json'))
