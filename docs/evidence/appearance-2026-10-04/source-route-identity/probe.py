import datetime, hashlib, json, os, pathlib, sys, urllib.error, urllib.request

ROOT = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
OUT = pathlib.Path(__file__).resolve().parent
EXPECTED_BYTES = 11916776
EXPECTED_SHA = 'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a'
URLS = [
    'http://127.0.0.1:5173/assets/wardrobe/body/g050.glb',
    'http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/assets/wardrobe/body/g050.glb'
]
CAP = 16 * 1024 * 1024
def utc(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(data): return hashlib.sha256(data).hexdigest()
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None

job = {'pid':os.getpid(), 'startedUTC':utc(), 'responses':[], 'maximumRequests':2,
       'noRedirects':True, 'timeoutSeconds':5, 'capBytes':CAP,
       'status':'started', 'parseCount':0, 'nativeCount':0}
code = 1
try:
    for name,pin in json.loads((OUT/'INPUTS.json').read_text())['files'].items():
        path=ROOT/name; data=path.read_bytes()
        if len(data)!=pin['bytes'] or sha(data)!=pin['sha256']:
            raise RuntimeError('Source pin mismatch '+name)
    original=(ROOT/'assets/wardrobe/body/g050.glb').read_bytes()
    if len(original)!=EXPECTED_BYTES or sha(original)!=EXPECTED_SHA:
        raise RuntimeError('Original body identity mismatch')
    job['expectedBody']={'bytes':len(original),'sha256':sha(original)}
    opener=urllib.request.build_opener(NoRedirect())
    for i,url in enumerate(URLS):
        row={'index':i,'url':url,'requestedUTC':utc()}; job['responses'].append(row)
        try: response=opener.open(urllib.request.Request(url,headers={'Accept':'*/*'}),timeout=5)
        except urllib.error.HTTPError as error: response=error
        with response:
            row['status']=response.code; row['headers']=list(response.headers.items())
            data=response.read(CAP+1); row['receivedUTC']=utc()
        row['observedBytes']=len(data); row['complete']=len(data)<=CAP
        row['sha256']=sha(data); row['first16Hex']=data[:16].hex()
        row['bodyFile']='response-'+str(i)+'.bin'
        (OUT/row['bodyFile']).write_bytes(data)
        row['savedUTC']=utc()
        row['matchesOriginal']=row['complete'] and len(data)==EXPECTED_BYTES and sha(data)==EXPECTED_SHA
        if not row['complete']: raise RuntimeError('Response exceeds declared cap')
    job['status']='complete'; code=0
except Exception as error:
    job['status']='refused'; job['error']=repr(error)
finally:
    job['endedUTC']=utc(); job['exitCode']=code
    try:
        (OUT/'JOB.json').write_text(json.dumps(job,indent=2)+'\n')
    except Exception as error:
        job['jobWriteError']=repr(error);code=1;job['exitCode']=code
    print(json.dumps(job,indent=2),flush=True)
sys.exit(code)
