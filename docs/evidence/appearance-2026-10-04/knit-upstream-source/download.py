from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlparse
import datetime,json,hashlib,os
d=Path(__file__).resolve().parent;target=d/'original-fisherman.obj';assert not target.exists()
url='http://www.makehumancommunity.org/sites/default/files/clothes/1968/1552483805/sweater_fisherman.obj'
limit=2*1024*1024
job={'pid':os.getpid(),'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'limitBytes':limit,'status':'running','scope':'One size HEAD then one GET only if <=2MiB; original source bytes only; no decode/extraction/parse/edit/execute','sourcePage':'http://www.makehumancommunity.org/clothes/fisherman_sweater.html','primaryDocumentedLicense':'CC0 - Creative Commons Zero','catalogDocumentedAuthor':'MargaretToigo','requests':[]}
try:
 assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,4,10,59,59,tzinfo=datetime.timezone.utc)
 with urlopen(Request(url,method='HEAD'),timeout=10) as response:
  headers=dict(response.headers);final=response.url;status=response.status
  job['requests'].append({'method':'HEAD','status':status,'finalURL':final,'headers':headers})
  assert urlparse(final).hostname=='www.makehumancommunity.org','Unexpected source redirect'
  length=response.headers.get('Content-Length');assert length is not None,'No declared source size; no GET'
  assert 0<int(length)<=limit,'Source exceeds2MiB/empty; no GET'
 with urlopen(Request(url,method='GET'),timeout=10) as response:
  job['requests'].append({'method':'GET','status':response.status,'finalURL':response.url,'headers':dict(response.headers)})
  assert urlparse(response.url).hostname=='www.makehumancommunity.org','Unexpected source redirect'
  data=response.read(limit+1);assert len(data)<=limit,'Actual source exceeds2MiB'
  target.write_bytes(data)
  job['output']={'file':target.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'qualification':'Original received source bytes only; geometry/header/fit unparsed'}
  assert 'text/html' not in response.headers.get('Content-Type',''),'HTML received; retain unqualified'
 job['status']='downloaded-source-only'
except Exception as e:
 job['status']='stopped';job['error']=str(e)
 if getattr(e,'headers',None) is not None:job['failureHeaders']=dict(e.headers)
 if getattr(e,'code',None) is not None:job['httpErrorCode']=e.code
 if target.exists():job['retainedOutput']={'file':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'qualification':'Unqualified received bytes'}
job['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(d/'DOWNLOAD-JOB.json').write_text(json.dumps(job,indent=2)+'\n');print(json.dumps(job))
