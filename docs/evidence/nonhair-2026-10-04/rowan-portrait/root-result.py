import datetime,hashlib,json,math,os,struct
from pathlib import Path
p=Path(__file__).resolve().parent;repo=p.parents[3]
start=datetime.datetime.now(datetime.timezone.utc)
assert start<datetime.datetime.fromisoformat('2026-10-04T06:39:00+00:00')
sha=lambda b:hashlib.sha256(b).hexdigest()
expected={'CRITIC-RESULT.md':'3c774a4883578862a88540ecc555374094091c58462fac419d8092c0448d9df5','critic-result-reader.py':'593e7f25041533b4f61f40a47ae507e2aa97cc625485607fa01700fc172b1a0e','CRITIC-RESULT-PINS.json':'887f26fe96323a3e2ce38c8b69b45a15407bb022ef88033cb1f10c52d522860a'}
for name,h in expected.items():assert sha((p/name).read_bytes())==h,name
c=json.loads((p/'CRITIC-RESULT-PINS.json').read_text())
for row in c['pins']:
 b=(p/row['file']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['file']
source=json.loads((p/'CRITIC-SOURCE-PINS.json').read_text())
for row in source['pins']:
 b=(repo/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
f=json.loads((p/'FRONT-STATE.json').read_text());r=json.loads((p/'RETIRED-STATE.json').read_text())
assert {k:v for k,v in f.items() if k!='retirement'}=={k:v for k,v in r.items() if k!='retirement'}
assert f['recipe']==json.loads((p/'ROWAN.json').read_text()) and f['recipeSHA256']==sha((p/'ROWAN.json').read_bytes())
assert f['retirement'] is None and r['retirement']['disposal']=={'disposed':True,'leaked':[]}
assert r['retirement']['error'] is None and r['retirement']['pendingAtRetirement'] is False and r['pending'] is False
assert f['failure'] is None and len(f['views'])==1 and f['views'][0]['name']=='front' and f['views'][0]['degrees']==0 and f['views'][0]['complete']
v=f['views'][0];a=f['creation']['report'];b=v['report']
for report in [a,b]:
 assert report['identity']=={'gender':1,'bake':'figure_g100'}
 assert report['quality']['backend']=='webgpu' and not report['quality']['backendMismatch']
 assert report['hair']['bake']=='figure_g100' and report['hair']['attached'] and report['hair']['loadedStyle']=='bob01'
 assert report['hair']['colour']['applied']=='#2f251f' and report['hair']['colour']['matchesAttached']
 assert report['wardrobe'] is None and report['scene']['lighting']['look']=='neutral'
 assert report['hair']['bodyContact'] is None and report['hair']['bodyContactUnavailableReason']=='No body-contact calibration for bob01 on figure_g100.'
assert a['motion']['frame']==0 and b['motion']['frame']==32 and v['clockSeconds']==0
assert f['creation']['canvas']==v['canvas']=={'width':960,'height':1240,'cssWidth':480,'cssHeight':620}
focus=f['composition']['sourceFocus'];target=list(focus);target[1]+=.045;distance=f['composition']['distanceMetres']
assert math.dist(f['creation']['camera']['position'],focus)==distance
assert v['camera']['target']==target and v['camera']['position']==[target[0],target[1],target[2]+distance]
assert f['creation']['camera']['projection']==v['camera']['projection']
def changes(a,b,path=''):
 if isinstance(a,dict) and isinstance(b,dict):
  out=[]
  for k in sorted(set(a)|set(b)):
   if k not in a or k not in b:out.append({'path':path+'/'+k,'before':a.get(k),'after':b.get(k)})
   else:out.extend(changes(a[k],b[k],path+'/'+k))
  return out
 return [] if a==b else [{'path':path,'before':a,'after':b}]
reports={'completeCreationReport':a,'allChangedFrontReportLeaves':changes(a,b),'creationReportSHA256':sha(json.dumps(a,sort_keys=True,separators=(',',':')).encode()),'frontReportSHA256':sha(json.dumps(b,sort_keys=True,separators=(',',':')).encode())}
with (p/'ROOT-REPORT-READBACK.json').open('x') as out:json.dump(reports,out,indent=2);out.write('\n')
rows=[]
for file in sorted(p.iterdir()):
 assert file.is_file();blob=file.read_bytes();rows.append({'file':file.name,'bytes':len(blob),'sha256':sha(blob)})
end=datetime.datetime.now(datetime.timezone.utc);assert end<datetime.datetime.fromisoformat('2026-10-04T06:39:00+00:00')
out={'command':'python3 docs/evidence/nonhair-2026-10-04/rowan-portrait/root-result.py','pid':os.getpid(),'started':start.isoformat(),'ended':end.isoformat(),'sourcePins':len(source['pins']),'criticResultPins':len(c['pins']),'packetPins':rows,'decision':'B after first real front; no quarter/replay; technical creation/retirement successful','scope':'Root independently reads full handoff/source/states/actualimage and reconciles all pins and stored camera/report operands; no import/runtime/geometry/contact/appearance-from-numbers claim.'}
with (p/'ROOT-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({'pid':out['pid'],'started':out['started'],'ended':out['ended'],'sourcePins':out['sourcePins'],'criticResultPins':out['criticResultPins'],'packetPins':len(rows),'metadataSHA256':sha((p/'ROOT-RESULT.json').read_bytes())}))
