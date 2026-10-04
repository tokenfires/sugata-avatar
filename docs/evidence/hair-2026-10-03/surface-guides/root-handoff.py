import datetime, hashlib, json, math, os
from pathlib import Path
p=Path(__file__).resolve().parent;repo=p.parents[3];started=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest();critic=json.loads((p/'CRITIC-RESULT-READBACK.json').read_text());root=json.loads((p/'ROOT-RESULT.json').read_text())
assert sha((p/'CRITIC-RESULT.md').read_bytes())=='3ac4ff463bf966a790fa30d9b12f541eade3a63249a67588b36260637ed0ac4f'
for name,row in critic['pins'].items():
 b=(p/name).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
source=json.loads((p/'CRITIC-SOURCE-PINS.json').read_text())
for name,row in source['pins'].items():
 b=(repo/name).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
assert critic['geometry']['minDoubleArea']==root['minimumActualDoubleArea'] and critic['geometry']['maxNormalUnitError']==root['maximumActualNormalUnitError']
s=json.loads((p/'STOPPED-STATE.json').read_text());g=json.loads((p/'GUIDES.json').read_text());view=s['states'][0];head=s['attachment']['headWorld'];camera=view['camera']['matrix'];proj=view['camera']['projection']
def inv4(m):
 a=[[m[c*4+r] for c in range(4)]+[float(r==c) for c in range(4)] for r in range(4)]
 for c in range(4):
  k=max(range(c,4),key=lambda r:abs(a[r][c]));assert abs(a[k][c])>1e-15;a[c],a[k]=a[k],a[c];v=a[c][c];a[c]=[x/v for x in a[c]]
  for r in range(4):
   if r!=c:v=a[r][c];a[r]=[x-v*y for x,y in zip(a[r],a[c])]
 return [a[r][4+c] for c in range(4) for r in range(4)]
def mul(m,v):return [sum(m[c*4+r]*v[c] for c in range(4)) for r in range(4)]
inverseCamera=inv4(camera);mins=[math.inf]*3;maxs=[-math.inf]*3;rootResidual=0;orthogonalResidual=0
for record,guide in zip(s['records'],g['guides']):
 posed=[sum(record['posedVertices'][i][k]*guide['root']['bary'][i] for i in range(3)) for k in range(3)];rootResidual=max(rootResidual,max(abs(a-b) for a,b in zip(posed,record['posedRoot'])))
 for key in ['restFrame','posedFrame','rotation']:
  m=record[key]
  for i in range(3):
   for j in range(3):orthogonalResidual=max(orthogonalResidual,abs(sum(m[i*3+k]*m[j*3+k] for k in range(3))-(i==j)))
 for i in range(0,len(record['headLocalVertices']),3):
  q=mul(proj,mul(inverseCamera,mul(head,record['headLocalVertices'][i:i+3]+[1])));q=[x/q[3] for x in q[:3]]
  for k,v in enumerate(q):mins[k]=min(mins[k],v);maxs[k]=max(maxs[k],v)
residual=max(abs(x-y) for row,expected in [(mins,view['bounds']['min']),(maxs,view['bounds']['max'])] for x,y in zip(row,expected))
assert residual<1e-12 and rootResidual<1e-12 and orthogonalResidual<1e-12
assert critic['retirement']==root['retirement']==s['retirement'] and critic['completedViews']==root['nativeViewsComplete']==0
pins={}
for name in ['CRITIC-RESULT.md','CRITIC-RESULT-READBACK.json','critic-result-read.py','root-handoff.py','ROOT-RESULT.json','RECEIPT.md','ROOT-VISUAL.md']:
 b=(p/name).read_bytes();pins[name]={'bytes':len(b),'sha256':sha(b)}
result={'command':'python3 docs/evidence/hair-2026-10-03/surface-guides/root-handoff.py','pid':os.getpid(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pins':pins,'criticNativeBindings':len(critic['pins']),'criticSourceBindings':len(source['pins']),'nominalBounds':{'min':mins,'max':maxs,'residual':residual,'scope':'Independent arithmetic replay using stored construction head matrix and actual recorded camera matrix/projection, not an independently observed view-time head matrix or in-pass framing.'},'posedRootResidual':rootResidual,'orthonormalResidual':orthogonalResidual,'decision':'B: no composed image/appearance adoption; retain exact artist-source construction lead, first margin refusal and clean recorded release. No immediate replay.'}
with (p/'ROOT-HANDOFF.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
