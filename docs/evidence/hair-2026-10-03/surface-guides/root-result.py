import datetime, hashlib, json, math, os
from pathlib import Path
p=Path(__file__).resolve().parent;repo=p.parents[3];started=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest();pre=json.loads((p/'ROOT-PREFLIGHT.json').read_text())
for name,pin in pre['pins'].items():
 b=(p/name).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256'],name
s=json.loads((p/'STOPPED-STATE.json').read_text());close=json.loads((p/'CLOSE.json').read_text());console=json.loads((p/'CONSOLE.json').read_text());guides=json.loads((p/'GUIDES.json').read_text())
assert len(s['states'])==1 and not s['states'][0]['complete'] and s['failure'] is not None
assert s['states'][0]['name']=='original-front' and s['states'][0]['originalVisible'] and not s['states'][0]['proposalVisible']
b=s['states'][0]['bounds'];assert b['vertices']==3528 and b['coordinateSystem']==2001 and b['clipDepth']==[0,1]
assert -1<b['min'][0]<-.94 and all(-1<v<1 for v in b['min'][:2]+b['max'][:2]) and 0<b['min'][2]<b['max'][2]<1
assert len(s['records'])==36
minimumArea=math.inf;maxNormalError=0
for record,guide in zip(s['records'],guides['guides']):
 assert record['id']==guide['id'] and record['sourceTriangle']['indices']==guide['root']['indices']
 v=record['headLocalVertices'];n=record['normals'];idx=record['indices'];assert len(v)==len(n)==294 and len(idx)==288 and all(math.isfinite(x) for x in v+n)
 for i in range(0,len(idx),3):
  a,c,d=[v[j*3:j*3+3] for j in idx[i:i+3]];u=[c[k]-a[k] for k in range(3)];w=[d[k]-a[k] for k in range(3)];cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];area=math.sqrt(sum(x*x for x in cross));assert area>=1e-12;minimumArea=min(minimumArea,area)
 for i in range(0,len(n),3):
  error=abs(math.sqrt(sum(x*x for x in n[i:i+3]))-1);assert error<=2e-6;maxNormalError=max(maxNormalError,error)
r=s['retirement'];assert r==close['retirement'] and r['reason']=='failure' and r['ownerReturned'] and r['modelDisposed'] and r['errors']==[]
assert r['modelDisposal']['attempts']==['detach']+[f'geometry-{i}' for i in range(36)]+['material'] and r['modelDisposal']['errors']==[]
assert r['disposal']=={'disposed':True,'leaked':[]} and close['closedTab']=='8' and [t['id'] for t in close['remainingTabs']]==['1']
assert not list(p.glob('*.png')) and len(console)==3 and all(x['level']=='warn' for x in console)
pins={}
for file in sorted(p.iterdir()):
 if file.is_file():data=file.read_bytes();pins[file.name]={'bytes':len(data),'sha256':sha(data)}
result={'command':'python3 docs/evidence/hair-2026-10-03/surface-guides/root-result.py','pid':os.getpid(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pins':pins,'nativeViewsComplete':0,'ribbons':36,'vertices':3528,'triangles':3456,'minimumActualDoubleArea':minimumArea,'maximumActualNormalUnitError':maxNormalError,'firstMarginFailure':b,'retirement':r,'console':{'observedWarnings':3,'observedErrors':0,'limit':100},'decision':'B: stopped first framing contract failure, no appearance acceptance or camera/model/margin repair. Editable direct-source guides and actual constructed buffers retained as unqualified artist source.','limits':['NDC margin breach is not proof of visible clipping; all sampled vertices are inside actual clip boundaries.','Native JPEG context shows the retained previous original body draw; no composed original-front or candidate PNG was encoded.','Stored initial head matrix is not separately observed current head matrix at view; no independent exact framing reconstruction or temporal pixel equality.','No coverage/contact/fit/motion/fine-strand/production/AAA qualification; no allocator/network/served-byte exhaustiveness.']}
with (p/'ROOT-RESULT.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in result.items() if k!='pins'}))
