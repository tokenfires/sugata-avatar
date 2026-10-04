import datetime, hashlib, json, os, pathlib, struct, sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/ink-entry-value'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
record=json.loads((packet/'ROOT-OPTIONS.json').read_text())
pins=[]
def pin(p):
    data=(root/p).read_bytes(); out=dict(path=p,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()); pins.append(out); return data,out
for p,expected in record['pins'].items():
    data,out=pin(p); assert out['sha256']==expected,p
images=[]
for p in ['docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-body.png','docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-portrait.png','docs/evidence/nonhair-2026-10-03/ink-review-page/desktop-body.jpg']:
    data,out=pin(p)
    if data[:8]==b'\x89PNG\r\n\x1a\n': dims=struct.unpack('>II',data[16:24]); kind='PNG'
    else:
        assert data[:2]==b'\xff\xd8'; pos=2; dims=None; kind='JPEG'
        while pos<len(data):
            assert data[pos]==255; pos+=1
            while data[pos]==255: pos+=1
            marker=data[pos]; pos+=1
            if marker in [1,*range(0xd0,0xd9)]: continue
            length=struct.unpack('>H',data[pos:pos+2])[0]
            if marker in [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]:
                h,w=struct.unpack('>HH',data[pos+3:pos+7]); dims=(w,h); break
            pos+=length
        assert dims is not None
    images.append(dict(path=p,format=kind,width=dims[0],height=dims[1],sha256=out['sha256']))
for name in ['ROOT-OPTIONS.json','CRITIC-VALUE.md']: pin(str((packet/name).relative_to(root)))
recipe=json.loads((root/'looks/ink-denim.json').read_text()); assert 'hairTint' not in recipe and record['exactRecipe'] is True
receipt=dict(scope='FS/header metadata only; root helper receipt source-read, not re-executed; no SDK/browser/renderer/API evaluation',command='python3 docs/evidence/nonhair-2026-10-03/ink-entry-value/critic-pins.py',pid=os.getpid(),interpreter=sys.executable,python=sys.version,started=start,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),readerSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),pins=pins,images=images,rootHelper=dict(command=record['command'],pid=record['pid'],started=record['started'],ended=record['ended'],exactRecipe=record['exactRecipe'],url=record['relativeUrl']))
(packet/'CRITIC-PINS.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'pid':receipt['pid'],'started':start,'ended':receipt['ended'],'pins':len(pins),'images':images,'rootHelperNotReexecuted':True}))
for name in ['CRITIC-VALUE.md','CRITIC-PINS.json','critic-pins.py']: print(name,hashlib.sha256((packet/name).read_bytes()).hexdigest())
