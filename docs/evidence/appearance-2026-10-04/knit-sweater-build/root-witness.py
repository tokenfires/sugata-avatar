from pathlib import Path
from decimal import Decimal, localcontext
import hashlib,json,datetime,os
d=Path(__file__).resolve().parent;start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
j=json.loads((d/'AUTHOR-JOB.json').read_text(),parse_float=Decimal);w=j['witness']
assert j['status']=='failed' and j['outputs']==[] and w['stage']=='triangle'
assert w['face']==368 and w['triangle']==737 and w['indices']==[223,421,420]
with localcontext() as context:
 context.prec=70
 a,b,c=w['points'];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
 normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
 dot=sum(normal[k]*w['expected'][k] for k in range(3));area=sum(x*x for x in normal).sqrt()
 assert all(abs(normal[k]-w['areaVector'][k])<Decimal('1e-17') for k in range(3))
 assert abs(dot-w['dot'])<Decimal('1e-17') and abs(area-w['area'])<Decimal('1e-17')
 assert dot<w['thresholds']['minimumOutwardDot'] and area>w['thresholds']['minimumTriangleAreaVector']
 for p,h in j['inputs'].items():assert sha(d/p)==h,p
 assert not(d/'sweater.json').exists() and not(d/'sweater.obj').exists()
 out={'pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'jobSha256':sha(d/'AUTHOR-JOB.json'),'sourcePins':j['inputs'],'witness':{'face':368,'triangle':737,'indices':[223,421,420],'normal':[str(x) for x in normal],'area':str(area),'dot':str(dot)},
  'decision':'B/CLOSED: first sleeve join fails declared local outward predicate despite nondegenerate triangle. No model outputs/native or global self-intersection/fit/appearance conclusion. No constructor replay/geometry change permitted.'}
 (d/'ROOT-WITNESS.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
