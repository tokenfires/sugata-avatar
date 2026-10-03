from pathlib import Path
from hashlib import sha256
from datetime import datetime,timezone
import json,os,sys,xml.etree.ElementTree as E,math,re
r=Path('/Users/robault/GitHub/sugata-avatar');d=r/'docs/evidence/nonhair-2026-10-03/control-net-authorship';started=datetime.now(timezone.utc).isoformat();j=json.loads((d/'control-net.json').read_text());svg=E.fromstring((d/'control-net.svg').read_text())
records=[q for p in j['panels'].values() for row in p['nodes'] for q in row]; ids={}
for q in records:
 assert all(len(q[k])==3 and all(math.isfinite(v) for v in q[k]) for k in ['P','du','dv','duv'])
 if q['id'] in ids:assert ids[q['id']]==q['P']
 ids[q['id']]=q['P']
assert len(records)==60 and len(ids)==50 and sum(len(p['cells']) for p in j['panels'].values())==40
paths=[q for q in svg.iter() if q.tag.endswith('}path')]
assert len(paths)==294
assert all(math.isfinite(float(x)) for q in paths for x in re.findall(r'-?\d+(?:\.\d+)?',q.attrib['d']))
a=j['panels']['minusX']['nodes'][0][4];b=j['panels']['plusX']['nodes'][0][4]
assert a['P']==b['P'] and a['dv']==[-.26,0,0] and b['dv']==[.26,0,0]
head=r/'packages/core/src/motion/HairSkinTransform.js';assert sha256(head.read_bytes()).hexdigest()=='8bb7137ac68b88c8a2fe213f34757d44f5b6addf0b63141f29f98ab3ac4adf7e'
result={'pid':os.getpid(),'started':started,'finished':datetime.now(timezone.utc).isoformat(),'interpreter':sys.executable,'version':sys.version,'command':'inline python3 stdin fs/JSON/XML reader (tool source is the literal command)','hashes':{f:sha256((d/f).read_bytes()).hexdigest() for f in ['control-net.json','author-net.py','control-net.svg']},'records':len(records),'uniquePositionIDs':len(ids),'declaredCells':40,'allSVGPathElementsParsed':len(paths),'firstBackInterval':{'hv':j['v'][1]-j['v'][0],'minusStartDv':a['dv'],'plusStartDv':b['dv'],'differenceCoefficientMetres':-.52*.14,'maximumDifferenceMetres':.52*.14*4/27},'limits':'Read-only source/graph/XML and boundary-polynomial arithmetic; no surface tessellation, mesh, rendered SVG pixels, Avatar or native job.'}
with (d/'CRITIC-READBACK.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result,indent=2))
