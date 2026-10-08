from pathlib import Path
import json,gzip,hashlib,math,datetime,os
HERE=Path(__file__).resolve().parent
prior=HERE.parent/'ari-native-form-contract'
nom=json.loads((prior/'TARGET-NOMINEES.json').read_text())
report={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'native_domain':19158,'targets':[],'passed':False}
def pin(row):
 b=Path(row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path'];return b
try:
 for request in nom['requests']:
  assert len(request['matches'])==1
  f=request['matches'][0];pin(f)
  q=Path(f['path']);text=gzip.decompress(q.read_bytes()).decode('utf8') if q.suffix=='.gz' else q.read_text()
  rows=[]
  for line in text.splitlines():
   line=line.strip()
   if not line or line.startswith(('#','"')):continue
   parts=line.split(' ',4);assert len(parts)==4,('exact library tokenization',request['request'],line)
   idx=int(parts[0]);xyz=[float(parts[1]),-float(parts[3]),float(parts[2])]
   assert 0<=idx<19158 and all(math.isfinite(v) for v in xyz)
   rows.append([idx,*xyz])
  assert rows and len({r[0] for r in rows})==len(rows),'duplicate or empty selected rows'
  report['targets'].append({'request':request['request'],'weight':request['weight'],'file':f,'rows':rows,'row_count':len(rows),'min_index':min(r[0] for r in rows),'max_index':max(r[0] for r in rows),'interpretation':'library raw axes first,-third,second; General scale multiplication not applied here'})
 m=json.loads((HERE.parent.parent/'appearance-2026-10-07/ari-neutral-native-source/INPUTS.json').read_text())
 rigfiles=[r for r in m['files'] if r['path'].endswith('/rigs/standard/rig.game_engine.json')];assert len(rigfiles)==1
 d=json.loads(pin(rigfiles[0]));bones=d['bones'];assert len(bones)==53
 for name,b in bones.items():
  assert not b.get('parent') or b['parent'] in bones
  assert math.isfinite(b['roll'])
  for which in ['head','tail']:
   e=b[which];s=e['strategy'];assert s in ['CUBE','VERTEX','MEAN','XYZ'],(name,which,s)
   assert len(e['default_position'])==3 and all(math.isfinite(v) for v in e['default_position'])
   if s=='CUBE':assert isinstance(e['cube_name'],str) and e['cube_name']
   if s=='VERTEX':assert isinstance(e['vertex_index'],int) and 0<=e['vertex_index']<19158
   if s in ['MEAN','XYZ']:assert e['vertex_indices'] and all(isinstance(i,int) and 0<=i<19158 for i in e['vertex_indices'])
   if s=='XYZ':assert len(e['vertex_indices'])>=3
   if 'offset' in e:assert len(e['offset'])==3 and all(math.isfinite(v) for v in e['offset'])
  assert b.get('roll_strategy') in [None,'ALIGN_Z_WORLD_Z','ALIGN_X_WORLD_X','ALIGN_Z_REFERENCE_Z'],(name,b.get('roll_strategy'))
 report['rig']={'file':rigfiles[0],'document':d,'strategies':{s:sum(e['strategy']==s for b in bones.values() for e in [b['head'],b['tail']]) for s in ['CUBE','VERTEX','MEAN','XYZ']},'roll_strategies':sorted({str(b.get('roll_strategy')) for b in bones.values()})}
 report['passed']=True
except Exception as e:report['exception']=repr(e)
report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(HERE/'INPUT-RESULT.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'targets':[(r['request'],r['row_count']) for r in report['targets']],'rig_strategies':report.get('rig',{}).get('strategies'),'exception':report.get('exception')}))
