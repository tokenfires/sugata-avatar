"""Independent saved-data simplex/halfspace proof; never imports the author."""
from pathlib import Path
import datetime, hashlib, json, math, os
H=Path(__file__).resolve().parent; R=H.parents[3]
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
ledger=json.loads((R/'docs/evidence/appearance-2026-10-04/original-surface-ledger/LEDGER.json').read_text())
d=json.loads((H/'PARTITION.json').read_text()); policy=json.loads((H/'POLICY.json').read_text())
assert d['status']=='complete' and d['policy']==policy and len(d['owners'])==len(ledger['owners'])==9
observed=json.loads((R/'docs/evidence/appearance-2026-10-04/shared-quad-knit/OBSERVATIONS.json').read_text())
bones={b['name']:b['world'][12:15] for b in observed['sources'][0]['meshes'][0]['bones']}
assert d['planes'][0]=={'name':'neck','normal':[0,-1,0],'origin':[0,1.425,0]}
assert d['planes'][1]=={'name':'hem','normal':[0,1,0],'origin':[0,.82,0]}
for p,side in zip(d['planes'][2:],['l','r']):
 v=[bones['hand_'+side][i]-bones['lowerarm_'+side][i] for i in range(3)]
 length=math.sqrt(sum(x*x for x in v));axis=[x/length for x in v]
 assert max(abs(p['normal'][i]+axis[i]) for i in range(3))<=1e-15
 assert max(abs(p['origin'][i]-(bones['hand_'+side][i]-.015*axis[i])) for i in range(3))<=1e-15
planes=d['planes']; total=0; max_simplex_error=0.; max_side_error=0.; checked_fragments=0
unit=[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]]
for m,source in zip(d['owners'],ledger['owners']):
 assert all(m[k]==source[k] for k in ['uuid','key','name'])
 assert m['sourceTriangles']==len(source['triangles']) and m['sourceVertices']==len(source['worldPositions'])
 listed=m['required']+sum(m['exposed'].values(),[])+[c['id'] for c in m['cut']]+m['degenerate']
 assert sorted(listed)==list(range(len(source['triangles'])))
 if m['key']=='bra':assert not any(m['exposed'].values()) and all(not c['exposed'] for c in m['cut'])
 def verify_polygon(tid,poly,reason):
  global checked_fragments,max_side_error
  if not poly:return 0.
  assert len(poly)>=3
  ids=source['triangles'][tid];vertices=[source['worldPositions'][v] for v in ids]
  for b in poly:
   assert len(b)==3 and all(math.isfinite(x) and -1e-12<=x<=1+1e-12 for x in b) and abs(sum(b)-1)<=1e-12
   point=[sum(b[j]*vertices[j][i] for j in range(3)) for i in range(3)]
   for pi,p in enumerate(planes):
    signed=sum(p['normal'][i]*(point[i]-p['origin'][i]) for i in range(3))
    if reason is None or pi<reason:
     max_side_error=max(max_side_error,-signed);assert signed>=-1e-12
    elif pi==reason:
     max_side_error=max(max_side_error,signed);assert signed<=1e-12
  area=.5*math.fsum(poly[j-1][1]*b[2]-b[1]*poly[j-1][2] for j,b in enumerate(poly))
  assert area>=-1e-12
  for j,b in enumerate(poly):
   a,c=poly[j-1],poly[(j+1)%len(poly)]
   turn=(b[1]-a[1])*(c[2]-b[2])-(b[2]-a[2])*(c[1]-b[1]);assert turn>=-1e-12
  checked_fragments+=1;return area
 for tid in m['required']:assert abs(verify_polygon(tid,unit,None)-.5)<=1e-12
 for name,ids in m['exposed'].items():
  reason=next(i for i,p in enumerate(planes) if p['name']==name)
  for tid in ids:assert abs(verify_polygon(tid,unit,reason)-.5)<=1e-12
 for cut in m['cut']:
  area=verify_polygon(cut['id'],cut['required'],None)
  for e in cut['exposed']:
   reason=next(i for i,p in enumerate(planes) if p['name']==e['reason'])
   area+=verify_polygon(cut['id'],e['polygon'],reason)
  error=abs(area-.5);max_simplex_error=max(max_simplex_error,error);assert error<=1e-12
 for tid in m['degenerate']:
  pts=[source['worldPositions'][v] for v in source['triangles'][tid]]
  a=[pts[1][i]-pts[0][i] for i in range(3)];b=[pts[2][i]-pts[0][i] for i in range(3)]
  assert [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]==[0.,0.,0.]
 total+=len(listed)
assert total==d['triangleCount']==71512
assert d['maximumAreaErrorSquareMetres']<=1e-10 and d['maximumSharedEdgeErrorMetres']<=1e-12
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'method':'all original IDs + convex barycentric polygon simplex areas + direct world halfspace sides; no author import/rerun',
     'triangleCount':total,'fragmentsChecked':checked_fragments,'maximumSimplexAreaError':max_simplex_error,'maximumWorldSideErrorMetres':max_side_error,
     'partition':pin(H/'PARTITION.json'),'reader':pin(H/'root-data.py'),'allBraRequired':True,'result':'A original-source coverage partition only'}
(H/'ROOT-DATA.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
