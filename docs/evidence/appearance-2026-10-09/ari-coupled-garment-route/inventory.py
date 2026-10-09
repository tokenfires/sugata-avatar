"""One bounded filenames-only asset inventory; never loads extension or mesh content."""
from pathlib import Path
import datetime,json,subprocess,selectors,os,time,signal,hashlib
P=Path(__file__).resolve().parent;A=json.loads((P/'ROOT-WORTH.json').read_text());now=lambda:datetime.datetime.now(datetime.timezone.utc);stop=datetime.datetime(2026,10,9,23,5,tzinfo=datetime.timezone.utc)
assert A['whole_read'] and not (P/'INVENTORY.json').exists() and now()<stop
roots=[{'path':x,'exists':Path(x).is_dir()} for x in A['roots']];paths=[];partial=b'';raw=bytearray();proc=None;started=now();clock=time.monotonic();reason='completed';code=None
cmd=['rg','--files','--hidden','--no-ignore','-g','*.mhclo']+[x['path'] for x in roots if x['exists']]
try:
 if len(cmd)>6:
  proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True);sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ)
  while sel.get_map():
   if time.monotonic()-clock>=30 or now()>=stop:reason='time_cap_UNKNOWN';break
   events=sel.select(timeout=.2)
   for key,event in events:
    data=os.read(key.fd,4096)
    if not data:sel.unregister(key.fileobj);continue
    if len(raw)+len(data)>65536:reason='byte_cap_UNKNOWN';break
    raw.extend(data);partial+=data
    while b'\n' in partial:
     line,partial=partial.split(b'\n',1)
     if len(line)>4096:reason='path_length_UNKNOWN';break
     try:text=line.decode('utf-8')
     except UnicodeDecodeError:reason='path_decode_UNKNOWN';break
     if len(paths)>=100:reason='path_cap_UNKNOWN';break
     paths.append(text)
    if reason!='completed':break
   if reason!='completed':break
  sel.close()
  if reason!='completed' and proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL)
  try:code=proc.wait(timeout=max(.1,30-(time.monotonic()-clock)))
  except subprocess.TimeoutExpired:reason='time_cap_UNKNOWN';os.killpg(proc.pid,signal.SIGKILL);code=proc.wait()
  if code not in (0,1) and reason=='completed':reason='rg_failure_UNKNOWN'
 else:reason='both_roots_absent'
except BaseException as ex:
 reason='error_UNKNOWN:'+repr(ex)
 if proc and proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
 code=proc.returncode if proc else None
r={'started':started.isoformat(),'finished':now().isoformat(),'elapsed':time.monotonic()-clock,'parent_pid':os.getpid(),'rg_pid':proc.pid if proc else None,'argv':cmd,'roots':roots,'returncode':code,'reason':reason,'retained_paths':sorted(paths),'retained_count':len(paths),'stdout_bytes':len(raw),'stdout_sha256':hashlib.sha256(raw).hexdigest(),'trailing_unparsed_bytes':len(partial),'limits':'Filenames only, no symlink follow, no file/header/geometry read. Outside roots/unlisted data UNKNOWN; capped/error scan cannot establish absence.'}
with (P/'INVENTORY.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps(r,indent=2))
