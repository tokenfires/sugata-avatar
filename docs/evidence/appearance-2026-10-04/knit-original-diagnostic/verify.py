from pathlib import Path
import datetime, hashlib, json, struct, os

p=Path(__file__).resolve().parent
h=lambda b:hashlib.sha256(b).hexdigest()
admission=json.loads((p/'ROOT-SOURCE.json').read_text())
for name,pin in admission['pins'].items():
    assert h(Path(pin['file']).read_bytes())==pin['sha256'],name
def report(path):
    s=path.read_text();return json.JSONDecoder().raw_decode(s[s.index('{\n'):])[0]
data=json.loads((p.parent/'knit-original-control/preview.json').read_text())
position_bytes=b''.join(struct.pack('<f',x) for v in data['vertices'] for x in v)
index_bytes=b''.join(struct.pack('<I',x) for t in data['triangles'] for x in t)
rows=[];states=[]
for stem,axis in [('source-plus-z','+Z'),('source-plus-x','+X'),('source-minus-z','−Z'),('source-xz','XZ')]:
    meta=json.loads((p/(stem+'.json')).read_text());image=(p/(stem+'.jpg')).read_bytes();state=(p/(stem+'-state.txt')).read_bytes();r=report(p/(stem+'-state.txt'))
    assert h(image)==meta['sha256'] and len(image)==meta['bytes'] and h(state)==meta['stateSha256']
    assert image[:2]==b'\xff\xd8' and image[-2:]==b'\xff\xd9','complete JPEG markers'
    assert meta['tabId']=='18' and meta['sourceAxis']==axis and r['view']==axis and r['phase']=='ready' and 'failure' not in r
    assert meta['captureReturned']<'2026-10-04T12:50:00Z' and r['lastRenderedAt']<'2026-10-04T12:50:00Z'
    assert r['originalSha256']=='2844465f4e798666a90f631ea4a89ae30d3e526ef045a978d338908750d21d09' and r['previewSha256']=='36c046e92e781f1b2359223ed04989e28e40463f65a83a1a4ea8433533c12065'
    assert r['buffers']['positionsSha256']==h(position_bytes) and r['buffers']['indicesSha256']==h(index_bytes)
    assert r['displayTransform']['scale']==[1,1,1] and r['displayTransform']['rotation']==[0,0,0]
    assert r['knownOpening']==[935,39,1010,934] and r['viewport']['windowWidth']==1280 and r['viewport']['windowHeight']==720
    rows.append({'file':stem+'.jpg','sha256':h(image),'bytes':len(image),'meta':meta,'renderedAt':r['lastRenderedAt']});states.append(r)
for r in states[1:]:
    for key in ['views','buffers','displayTransform','viewport','resources','sourceBounds']:assert r[key]==states[0][key],key
disposed=report(p/'DISPOSED-state.txt');meta=json.loads((p/'DISPOSED.json').read_text())
assert h((p/'DISPOSED-state.txt').read_bytes())==meta['stateSha256']
assert disposed['phase']=='disposed' and disposed['closedReason']=='explicit dispose' and len(disposed['cleanup'])==6
assert all(c['okay'] for c in disposed['cleanup']) and set(c['name']for c in disposed['cleanup'])==set(disposed['resources'])
closed=json.loads((p/'CLOSED.json').read_text());assert closed['ownedTab']=='18' and [t['id'] for t in closed['remaining']]==['1']
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'images':rows,'positionsSha256':h(position_bytes),'indicesSha256':h(index_bytes),'float32MaxErrorObserved':states[0]['buffers']['maxFloat32CastError'],'minDisplayTwiceAreaObserved':states[0]['buffers']['minFloat32TwiceArea'],'cleanup':disposed['cleanup'],'closedAt':closed['closedAt'],'root':'Every native original independently viewed in CUA; metadata/ready/camera/Float32 buffers/source pins/closure verified here. Numerical checks support reference utility only. No original OBJ decoding, inventory replay, geometry edit, native recapture or complete/fit/material/Avatar qualification.'}
(p/'ROOT-NATIVE.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
