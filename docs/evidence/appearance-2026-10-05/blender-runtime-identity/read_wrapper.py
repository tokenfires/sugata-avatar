"""One exact Homebrew wrapper source observation, not launcher execution."""
from pathlib import Path
import hashlib,json,re,shlex,datetime,os,plistlib
ROOT=Path(__file__).resolve().parents[4]
E=Path(__file__).resolve().parent
P=json.loads((E/'PLAN.json').read_text())
def pin(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  while chunk:=f.read(1048576):h.update(chunk)
 return {'path':str(path),'bytes':path.stat().st_size,'sha256':h.hexdigest()}
def main():
 now=datetime.datetime.now(datetime.timezone.utc)
 assert now<datetime.datetime.fromisoformat(P['stop_utc'])
 q={'started_utc':now.isoformat(),'pid':os.getpid(),'scope':'One exact wrapper source and its literal target metadata; no execution/search'}
 try:
  w=Path(P['bounds']['exact_wrapper'])
  assert w.is_file() and w.stat().st_size==P['bounds']['wrapper_bytes_expected'],'wrapper identity size'
  raw=w.read_bytes();assert len(raw)==74 and len(raw)<=1024,'actual wrapper size'
  with(E/'WRAPPER.txt').open('xb')as f:f.write(raw)
  q['wrapper']= {'path':str(w),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
  text=raw.decode('utf-8')
  lines=[line.strip()for line in text.splitlines()if line.strip()and not line.lstrip().startswith('#')]
  assert len(lines)==1,'wrapper command count'
  tokens=shlex.split(lines[0],comments=False,posix=True)
  assert len(tokens)==3 and tokens[0]=='exec' and tokens[2]=='$@' and lines[0].rstrip().endswith('"$@"'),'direct exec grammar'
  target=tokens[1]
  assert target.startswith('/') and not any(x in target for x in ['$',chr(96),'*','?','[',']','\\','\n','\r',';','|','&']), 'literal target'
  t=Path(target)
  assert t.resolve()!=w.resolve(),'recursive wrapper'
  assert t.is_file() and os.access(t,os.X_OK),'target missing/nonexecutable'
  q['literal_command']=lines[0];q['target']=pin(t);q['target']['resolved_path']=str(t.resolve())
  if t.parent.name=='MacOS' and t.parent.parent.name=='Contents':
   info=t.parent.parent/'Info.plist'
   assert info.is_file() and info.stat().st_size<=65536,'target bundle plist missing/large'
   rawinfo=info.read_bytes();assert len(rawinfo)<=65536,'actual plist cap'
   values=plistlib.loads(rawinfo)
   fields={k:values.get(k)for k in ['CFBundleIdentifier','CFBundleExecutable','CFBundleShortVersionString','CFBundleVersion']}
   assert all(v is None or isinstance(v,str)and len(v)<=512 for v in fields.values()),'plist fields'
   q['bundle']={'info':pin(info),'fields':fields}
  q['decision']='One literal existing target identified; runtime version and source suitability untested'
 except Exception as err:
  q['decision']='Stopped firstsource failure; no lookup/fallback/execution'
  q['error']=type(err).__name__+': '+str(err)[:500]
 q['completed_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with(E/'TARGET.json').open('x')as f:f.write(json.dumps(q,indent=2)+'\n')
 print(json.dumps(q,indent=2))
 return 0 if q['decision'].startswith('One literal')else 1
if __name__=='__main__':raise SystemExit(main())
