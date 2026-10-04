"""Root-owned one-child execution and independent available-file receipts."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

HERE=Path(__file__).resolve().parent
def utc():return datetime.now(timezone.utc).isoformat()
def run():
    record={'runnerPID':os.getpid(),'started':utc(),'maximumInvocations':1,'command':[sys.executable,str(HERE/'author.py')],'cwd':str(HERE),'timeoutSeconds':30,'recordingErrors':[]}
    out=b'';err=b''
    def write(name,data):
        try:(HERE/name).write_bytes(data)
        except Exception as e:record['recordingErrors'].append({'file':name,'type':type(e).__name__,'message':str(e)})
    try:
        c=json.loads((HERE/'ARTIST.json').read_text());deadline=datetime.fromisoformat(c['authorGateUTC'].replace('Z','+00:00'))
        if datetime.now(timezone.utc)>=deadline:raise RuntimeError('author gate already expired; child not started')
        child=subprocess.run(record['command'],cwd=HERE,capture_output=True,timeout=30,check=False)
        out,err=child.stdout,child.stderr
        record.update({'childStarted':True,'childExit':child.returncode,'timedOut':False,'childReaped':True})
    except subprocess.TimeoutExpired as e:
        out,err=e.output or b'',e.stderr or b''
        record.update({'childStarted':True,'childExit':None,'timedOut':True,'childReaped':True,'exception':str(e)})
    except Exception as e:
        record.update({'childStarted':False,'childExit':None,'timedOut':False,'childReaped':True,'exceptionType':type(e).__name__,'exception':str(e)})
    record['childFinished']=utc()
    write('STDOUT.txt',out);write('STDERR.txt',err)
    record['capturedStreams']={k:{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for k,b in [('STDOUT.txt',out),('STDERR.txt',err)]}
    inventory={}
    for name in ['RAW.json','mesh.json','sweater.obj','AUTHOR-JOB.json']:
        try:
            p=HERE/name
            if p.exists():
                b=p.read_bytes();inventory[name]={'exists':True,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
            else:inventory[name]={'exists':False}
        except Exception as e:
            inventory[name]={'inventoryErrorType':type(e).__name__,'inventoryError':str(e)}
            record['recordingErrors'].append({'file':name,'phase':'inventory','type':type(e).__name__,'message':str(e)})
    record['actualFiles']=inventory;record['completed']=utc()
    try:
        record['late']=datetime.now(timezone.utc)>=deadline
    except NameError:record['late']=True
    record['status']='A process only; independent data pending' if record.get('childExit')==0 and not(record.get('timedOut') or record['late'] or record['recordingErrors']) else 'B process/accounting; no dependent work'
    write('RUN-PROCESS.json',(json.dumps(record,indent=2,allow_nan=False)+'\n').encode())
    if record['recordingErrors']:record['status']='B process/accounting; no dependent work'
    print(json.dumps(record,allow_nan=False))
    return 0 if record['status'].startswith('A ') else 1

if __name__=='__main__':sys.exit(run())
