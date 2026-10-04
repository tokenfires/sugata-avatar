"""Retained static-page bytes/receipts only; never opens a browser."""
from pathlib import Path
import datetime, hashlib, json, os, struct, sys
ROOT=Path('/Users/robault/GitHub/sugata-avatar')
P=ROOT/'docs/evidence/nonhair-2026-10-03/ink-review-page'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
pins={}
def pin(p,expected=None):
    h=hashlib.sha256(p.read_bytes()).hexdigest()
    if expected is not None: assert h==expected,(str(p),h,expected)
    pins[str(p)]=h
    return h
def read(n): return json.loads((P/n).read_text())
def jpeg_size(p):
    b=p.read_bytes();assert b[:2]==b'\xff\xd8';i=2
    while i<len(b):
        assert b[i]==255,(str(p),i)
        while b[i]==255:i+=1
        marker=b[i];i+=1
        if marker in [0xd8,0xd9] or 0xd0<=marker<=0xd7:continue
        length=struct.unpack('>H',b[i:i+2])[0]
        if marker in [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]:
            h,w=struct.unpack('>HH',b[i+3:i+7]);return [w,h]
        assert marker!=0xda,'SOF not found before scan'
        i+=length
    raise AssertionError('No JPEG frame header')

u=read('UI.json');inputs=read('INPUTS.json');pre=read('PREFLIGHT.json')
for n in ['UI.json','INPUTS.json','PLAN.md','PREFLIGHT.json','AUTHOR.json','CRITIC-CONTRACT.md','CRITIC-SOURCE.md','CUA-COMMANDS.md']:
    pin(P/n)
for name,h in inputs['pins'].items():pin(ROOT/name,h)
assert len(inputs['pins'])==10
page=ROOT/'looks/ink-denim-review.html'
pin(page,'aade8dfb6aa59fe60e5da0bec1aaa1fad08153a02feb2ee4c712c60831683d0e')
pin(P/'PAGE.html.source',pins[str(page)])
assert page.read_bytes()==(P/'PAGE.html.source').read_bytes()
assert pre['status']=='GO' and pre['inputCount']==10
assert pre['utc']<u['firstOpenUtc']<'2026-10-04T00:06:00Z'
names=['desktop-body','desktop-portrait','desktop-action','mobile-portrait','mobile-action']
assert [s['name'] for s in u['states']]==[s['name'] for s in u['screenshots']]==names
assert len(u['actions'])==7
base='http://127.0.0.1:5173/@fs'+str(ROOT)
archive='/docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/'
image_names=['neutral-body','kitchen-body','neutral-portrait','kitchen-portrait','smile-held','smile-released']
expected_images=[base+archive+n+'.png' for n in image_names]
expected_links=[base+'/looks/ink-denim.json','http://127.0.0.1:5173/src/showcase.html']+expected_images+[base+'/looks/INK-DENIM.md']
summary=[]
for s,shot in zip(u['states'],u['screenshots']):
    d=s['dom'];assert d['url']==base+'/looks/ink-denim-review.html'
    width=390 if s['name'].startswith('mobile') else 1280
    assert d['viewport']['width']==d['scrollWidth']==width
    assert d['viewport']['height']==(844 if width==390 else 720)
    assert [i['src'] for i in d['images']]==expected_images
    assert [link['href'] for link in d['links']]==expected_links
    assert d['links'][0]['download']=='ink-denim.json'
    assert d['frame']==('body' if s['name']=='desktop-body' else 'portrait')
    assert d['expressionOpen']==s['name'].endswith('action')
    assert ('figure "Smile held' in s['snapshot'])==d['expressionOpen']
    for index,image in enumerate(d['images']):
        assert image['complete'] is True and [image['naturalWidth'],image['naturalHeight']]==[900,868]
        if index<4:
            selected=(index<2)==(d['frame']=='body')
            box=image['rect']
            if selected:
                assert box['width']>0 and box['height']>0
                assert 0<=box['x'] and box['x']+box['width']<=width
                assert abs(box['height']-box['width']*868/900)<1/32
            else:assert box['width']==box['height']==0
        # Closed-details descendant rectangles/visible booleans intentionally do not imply rendered or AX visibility.
    image=P/shot['file'];pin(image,shot['sha256']);assert image.stat().st_size==shot['bytes']
    size=jpeg_size(image);assert size[0]==width and size[1]>d['viewport']['height']
    summary.append({'name':s['name'],'frame':d['frame'],'expressionOpen':d['expressionOpen'],
                    'viewport':d['viewport'],'JPEGdimensions':size,'horizontalOverflow':False})
download=P/'downloaded-ink-denim.json'
pin(download,u['download']['sha256'])
assert download.stat().st_size==u['download']['bytes']==554
assert download.read_bytes()==(ROOT/'looks/ink-denim.json').read_bytes()
pin(Path(u['download']['returnedPath']),u['download']['sha256'])
assert u['console']['entries']==[]
assert u['finalViewport']=={'height':720,'width':1280}
assert u['cleanup']['viewportReset'] is True and u['cleanup']['closedOwnedTab']==u['tabId']=='2'
assert u['cleanup']['utc']<'2026-10-04T00:16:00Z'
result={'status':'static-page-retained-evidence-agrees','pid':os.getpid(),'started':start,
    'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'interpreter':sys.executable,'version':sys.version,
    'command':'python3 docs/evidence/nonhair-2026-10-03/ink-review-page/critic-ui-readback.py',
    'readerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'pins':pins,'states':summary,
    'actions':len(u['actions']),'imageObservations':30,'linksPerState':9,'existingInputCount':10,
    'downloadSHA256':u['download']['sha256'],'downloadBytes':554,'cleanup':u['cleanup'],
    'limits':['Filesystem/retained DOM/AX metadata only; visual inspection separately recorded in CRITIC-UI.md.',
              'No browser, screenshot, node, Avatar, runtime guard or media modification executed.',
              'Closed details descendants can retain rectangles; their visible flag is not rendered/AX visibility proof.',
              'Correct declared hrefs are not HTTP-navigation proof for every original/guide/editor link.',
              'Empty returned console log is not global network absence or full accessibility/character qualification.']}
with (P/'CRITIC-PIN-READBACK.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'status':result['status'],'pid':result['pid'],'started':result['started'],'finished':result['finished'],
                  'pins':len(pins),'readerSHA256':result['readerSHA256'],'receiptSHA256':pin(P/'CRITIC-PIN-READBACK.json')}))
