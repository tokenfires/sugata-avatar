import datetime,hashlib,json,os,pathlib,platform,sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/review-hub'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
m=json.loads((packet/'native/NATIVE.json').read_text())
assert m['closed'] and m['viewportReset'] and m['logs']==[]
assert [s['name'] for s in m['states']]==['candidate-desktop','candidate-phone','candidate-phone-ink','candidate-gallery-link']
assert len(m['captures'])==4
def jpgdim(b):
    assert b[:2]==b'\xff\xd8'; i=2
    while i<len(b):
        assert b[i]==255
        while b[i]==255: i+=1
        marker=b[i];i+=1
        if marker==1 or 0xd0<=marker<=0xd9: continue
        n=int.from_bytes(b[i:i+2],'big')
        if marker in (0xc0,0xc1,0xc2): return [int.from_bytes(b[i+5:i+7],'big'),int.from_bytes(b[i+3:i+5],'big')]
        i+=n
    raise AssertionError('No JPEG dimensions')
rows=[]
for s,c,dims in zip(m['states'],m['captures'],[[1280,3080],[390,4260],[390,844],[390,844]]):
    assert json.loads((packet/'native'/f"{s['name']}.json").read_text())==s
    state=s['state'];assert state['document']['width']==state['viewport']['width']
    if s['name']!='candidate-gallery-link':
        assert len(state['images'])==4
        for image,expected in zip(state['images'],[[1440,2060],[1440,2060],[900,868],[900,868]]):
            assert image['complete'] and [image['naturalWidth'],image['naturalHeight']]==expected
            assert abs(image['height']-image['width']*expected[1]/expected[0])<.02
    b=pathlib.Path(c['file']).read_bytes();assert len(b)==c['bytes'] and hashlib.sha256(b).hexdigest()==c['sha256']
    assert jpgdim(b)==dims;rows.append({**c,'dimensions':dims})
assert m['states'][2]['state']['url'].endswith('review.candidate.html#ink')
assert m['states'][3]['state']['url']=='http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/looks/ink-denim-review.html'
source=json.loads((packet/'SOURCE.json').read_text())
for name,sha in source['acceptedSources'].items(): assert hashlib.sha256((root/name).read_bytes()).hexdigest()==sha,name
for r in source['pins']+source['media']+source['links']:
    b=(root/r['file']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/read-native.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','acceptedSourceCount':len(source['acceptedSources']),'captures':rows,'nativeSha256':hashlib.sha256((packet/'native/NATIVE.json').read_bytes()).hexdigest(),'readerSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'rootVisualSha256':hashlib.sha256((packet/'ROOT-VISUAL.md').read_bytes()).hexdigest(),'limits':'Actual four static UI images reviewed; no Avatar, general network/assistive/motion/fit/AAA claim'}
with (packet/'ROOT-NATIVE.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({k:receipt[k] for k in ['pid','started','ended','status','nativeSha256','readerSha256','rootVisualSha256']}))
