"""Postflight bytes/state readback only; never launches or replays the native sequence."""
from pathlib import Path
import hashlib,json,struct,datetime,os
root=Path(__file__).resolve().parents[4];packet=Path(__file__).parent
raw=root/'captures/listener-view-2026-10-03-v1'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((raw/'report.json').read_text())
assert sha(raw/'report.json')=='3b14ff1dea70a81f20db9cd4a64d4a13623798ffc4befb11213662f80ab10ac5'
assert r['status']=='observed' and not r['errors'] and r['finished']<r['stop']
assert sha(root/'tools/critic/listener-view.mjs')==sha(raw/'instrument.mjs')==r['instrumentSHA256']
assert all(sha(root/p)==v for p,v in r['sources'].items())
assert sha(Path(r['recipe']['file']))==r['recipe']['sha256']
expected=json.loads(Path(r['recipe']['file']).read_text())
assert sha(packet/'PLAN.md')==r['planSHA256']
assert len(r['images'])==9 and len(r['events'])==5
base=r['events'][0]['state'];states=[]
for e in r['events']:
    states.append(e['state'])
    if 'before' in e:states.append(e['before'])
images=[]
for i in r['images']:
    p=raw/i['file'];b=p.read_bytes()
    assert b[:8]==b'\x89PNG\r\n\x1a\n' and sha(p)==i['sha256']
    dims=struct.unpack('>II',b[16:24]);assert dims==((1440,2060) if i['fullPage'] else (900,868))
    assert i['requested']<=i['completed']
    states.extend([i['before'],i['after']]);images.append(dict(file=i['file'],bytes=len(b),sha256=sha(p),dimensions=dims,elapsed=i['elapsedFromAnchor']))
assert len(states)==24
for s in states:
    assert s['configuration']==expected and s['camera']==base['camera'] and s['frame']==base['frame']
    assert s['url']==base['url'] and s['backend']=='webgpu' and s['webGPU'] is True
    assert s['canvas']==dict(width=900,height=868)
    assert s['attention']['expression']=='neutral' and s['attention']['smileWeight']==0
release=next(e for e in r['events'] if e['label']=='actual Release')
assert release['before']['attention']['phase']=='attending' and release['before']['attention']['holdsGaze']
assert release['state']['attention']['phase']=='releasing' and not release['state']['attention']['holdsGaze']
assert release['state']['attention']['time']==0
assert r['events'][-1]['state']['attention']['phase']=='idle'
assert r['cleanup']==dict(page='closed',context='closed',browser='closed')
assert r['finalRetirement']==dict(disposed=True,leaked=[])
assert r['retirements']==[dict(disposed=True,leaked=[])]
assert sha(raw/r['video']['file'])==r['video']['sha256'] and (raw/r['video']['file']).stat().st_size==r['video']['bytes']
result=dict(pid=os.getpid(),started=started,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceSHA256=sha(Path(__file__)),kind='filesystem/JSON/header postflight only; no native replay or pixel oracle',reportSHA256=sha(raw/'report.json'),sourcePins=len(r['sources']),states=len(states),images=images,manualRelease=release,disposal=r['finalRetirement'],video=r['video'],videoLimit='Native video preserved; no continuous-naturalness qualification claimed by this reader.')
with (packet/'root-readback.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['images','manualRelease']}))
