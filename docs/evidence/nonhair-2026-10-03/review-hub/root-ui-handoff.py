import datetime,hashlib,json,os,pathlib,platform,sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');packet=root/'docs/evidence/nonhair-2026-10-03/review-hub'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
m=json.loads((packet/'CRITIC-UI-PINS.json').read_text());n=json.loads((packet/'native/NATIVE.json').read_text())
assert set(m)=={'scope','command','pid','interpreter','pythonVersion','started','ended','status','protected','pins','images','individual','states','operations','ratioChecks','closed','viewportReset','logs','sourceSha256','noteSha256'}
assert m['noteSha256']=='eead01f4f76f3bab31f60587b1482945cbbbc7be74de47558b66e8c78e22c22b' and m['status']=='passed'
assert [len(m[k]) for k in ['protected','pins','images','individual','states','operations','ratioChecks']]==[405,10,4,4,4,5,12]
assert m['states']==n['states'] and m['operations']==n['operations'] and m['closed'] and m['viewportReset'] and m['logs']==[]
assert n['started']<'2026-10-04T01:43:00Z' and n['ended']<'2026-10-04T02:00:00Z'
seen={}
for key in ['protected','pins','images','individual']:
    for row in m[key]:
        b=(root/row['file']).read_bytes();sha=hashlib.sha256(b).hexdigest()
        assert len(b)==row['bytes'] and sha==row['sha256'],row['file'];seen[row['file']]=sha
for state in m['states']:
    assert json.loads((packet/'native'/f"{state['name']}.json").read_text())==state
    assert state['ax'] and state['dom'] and state['state']['document']['width']==state['state']['viewport']['width']
for r in m['ratioChecks']:
    state=next(s for s in m['states'] if s['name']==r['state'])['state']
    im=next(i for i in state['images'] if i['src']==r['source'])
    residual=abs(im['height']-im['width']*im['naturalHeight']/im['naturalWidth'])
    assert residual==r['residualCSS'] and residual<.02
baseline=json.loads((packet/'SOURCE.json').read_text())['acceptedSources']
for name,sha in baseline.items():assert seen[name]==sha
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/root-ui-handoff.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','decision':'adopt exact candidate, then normal build and native hub navigation','pins':seen,'criticReceiptSha256':hashlib.sha256((packet/'CRITIC-UI-PINS.json').read_bytes()).hexdigest(),'readerSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'metadata':'All20keys parsed; 405protected/10packet/4images/4individual; complete4AX/DOMstates equal root originals; all12ratios independently reproduced; root earlier JPEGheader reader retained','limits':'Current candidate static/native acceptance only; postadoption build/hub pending'}
with (packet/'ROOT-UI-HANDOFF.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({k:receipt[k] for k in ['pid','started','ended','status','readerSha256','criticReceiptSha256','decision']}))
