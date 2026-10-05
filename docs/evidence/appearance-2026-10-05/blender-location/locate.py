"""One metadata-only installed Blender location inventory; no candidate execution."""
from pathlib import Path
import datetime,json,os,plistlib,shutil,hashlib,time
ROOT=Path(__file__).resolve().parents[4]
E=Path(__file__).resolve().parent
P=json.loads((E/'PLAN.json').read_text())
def now():return datetime.datetime.now(datetime.timezone.utc)
def check():assert now()<datetime.datetime.fromisoformat(P['stop_utc']),'fixed stop'
def pin(p):
 b=p.read_bytes();return {'path':str(p.relative_to(ROOT)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def candidate(p):
 return {'path':str(p),'exists':p.exists(),'is_file':p.is_file(),'is_symlink':p.is_symlink(),'resolved_path':str(p.resolve()),'executable_access':os.access(p,os.X_OK),'bytes':p.stat().st_size if p.is_file() else None}
def main():
 check()
 for r in P['inputs']:assert pin(ROOT/r['path'])==r,'input drift'
 start=time.monotonic()
 q={'started_utc':now().isoformat(),'pid':os.getpid(),'path_results':[],'application_roots':[],'scope':'PATH lookups/immediate app entries/matching Info.plist core metadata only; no execution/version or recursive search'}
 try:
  for name in P['bounds']['path_names']:
   check();s=shutil.which(name)
   q['path_results'].append({'name':name,'candidate':candidate(Path(s)) if s else None})
  for label in P['bounds']['application_roots']:
   check();root=Path(label)
   row={'root':label,'exists':root.exists(),'is_dir':root.is_dir(),'matches':[]}
   q['application_roots'].append(row)
   if not root.exists():continue
   assert root.is_dir(),'root not directory'
   count=0
   with os.scandir(root) as entries:
    names=[]
    for n,entry in enumerate(entries,1):
     count=n
     assert n<=P['bounds']['immediate_entries_each_max'],'entry cap'
     if entry.name.lower().endswith('.app') and 'blender' in entry.name.lower():
      names.append(entry.name)
      assert len(names)<=P['bounds']['matching_bundles_each_max'],'bundle cap'
   row['immediate_entry_count']=count
   for name in sorted(names):
    check();app=root/name;info=app/'Contents/Info.plist'
    assert info.is_file() and info.stat().st_size<=65536,'missing/large matching plist'
    b=info.read_bytes();assert len(b)<=65536,'actual plist size'
    d=plistlib.loads(b);assert isinstance(d,dict),'plist shape'
    keys=['CFBundleIdentifier','CFBundleExecutable','CFBundleShortVersionString','CFBundleVersion']
    fields={k:d.get(k) for k in keys}
    assert all(v is None or isinstance(v,str) and len(v)<=512 for v in fields.values()),'metadata type/size'
    exe=fields['CFBundleExecutable']
    assert isinstance(exe,str) and exe not in ('','.','..') and '/' not in exe and '\\' not in exe,'declared executable basename'
    row['matches'].append({'bundle':str(app),'metadata':fields,'plist':{'path':str(info),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()},'candidate':candidate(app/'Contents/MacOS'/exe)})
  q['decision']='Complete scoped location observations; candidate suitability/version untested'
 except Exception as error:
  q['decision']='Stopped at first observation error; no retry/expansion'
  q['error']=type(error).__name__+': '+str(error)[:500]
 q.update({'completed_utc':now().isoformat(),'elapsed_seconds':time.monotonic()-start})
 check()
 with(E/'LOCATION.json').open('x')as f:f.write(json.dumps(q,indent=2)+'\n')
 print(json.dumps(q,indent=2))
 return 0 if q['decision'].startswith('Complete') else 1
if __name__=='__main__':raise SystemExit(main())
