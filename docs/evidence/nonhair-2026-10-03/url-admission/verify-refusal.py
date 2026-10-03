import pathlib,hashlib,json,re,os,sys,datetime
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); folder=root/'docs/evidence/nonhair-2026-10-03/url-admission'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
a=json.loads((folder/'AUDIT.json').read_text()); f=json.loads((folder/'FIXTURES.json').read_text()); prior=json.loads((root/'captures/current-review-2026-10-02-v1/report.json').read_text())
assert a['status']=='failed' and a['observed']==[] and a['synthetic']==[] and a['refusals']==[]
assert 'ReferenceError: normalizePathRegExp is not defined' in a['error']
pins={}
for p,h in a['inputPins'].items():assert sha(root/p)==h,p; pins[p]=h
for p,h in [('tools/critic/vite-declared-resource.mjs',a['helperSHA256']),('tools/critic/qualify-vite-declared-resource.mjs',a['instrumentSHA256'])]:assert sha(root/p)==h,p; pins[p]=h
assert sha(folder/'FIXTURES.json')==a['fixtureSHA256']
assert json.loads((folder/'INPUT-PINS.json').read_text())==a['inputPins']
def get(o,s):
 for k in re.sub(r'\[(\d+)\]',r'.\1',s).split('.'):o=o[int(k)] if isinstance(o,list) else o[k]
 return o
rows=[]
for c in f['cases']:
 observed=get(prior,c['witness']); actual=observed if isinstance(observed,str) else observed['url'];assert actual==c['url']
 assert str(root/c['file'])==c['absoluteFile']
 for p in [c['file'],c['snapshot']]:assert sha(root/p)==c['sha256'],p; pins[p]=c['sha256']
 rows.append({'witness':c['witness'],'url':c['url'],'declaredFile':c['absoluteFile'],'sha256':c['sha256']})
assert len(rows)==19
source=(root/'node_modules/vite/dist/node/chunks/node.js').read_text()
wrong=re.search(r'function normalizePath\([^)]*\) \{\n[\s\S]*?\n\}',source).group(0)
right=re.search(r'^function normalizePath\([^)]*\) \{\n[\s\S]*?\n\}',source,re.M).group(0)
assert wrong==a['installedOracleExcerpts']['normalizePath'] and 'normalizePathRegExp' in wrong and 'posix$1.sep' in wrong
assert right!=wrong and 'path.posix.normalize(isWindows ? slash(id) : id)' in right
assert 'const normalizePath$1 = '+wrong+';' in source
line=lambda s: source[:source.index(s)].count('\n')+1
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/url-admission/verify-refusal.py','interpreter':sys.executable,'version':sys.version,'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed-narrow-refusal-audit','verifierSHA256':sha(pathlib.Path(__file__)),'auditSHA256':sha(folder/'AUDIT.json'),'rootAuditPID':a['pid'],'rootStarted':a['started'],'rootFinished':a['finished'],'inputPinCount':len(a['inputPins']),'fixtureCount':len(rows),'uniqueCheckedFilePinCount':len(pins),'fixtureSHA256':a['fixtureSHA256'],'helperSHA256':a['helperSHA256'],'instrumentSHA256':a['instrumentSHA256'],'wrongNamedFunctionExpressionLine':line('const normalizePath$1 = function normalizePath(filename)'), 'actualViteFunctionDeclarationLine':line('function normalizePath(id)'), 'wrongExcerpt':wrong,'actualSourceExcerpt':right,'completedObserved':0,'completedSynthetic':0,'completedRefusals':0,'retainedURLWitnessAndBytes':rows,'limits':['No helper execution, root-audit rerun, VM oracle correction, network or browser.','Fixture witness and byte consistency do not qualify helper outputs.','Failure is an extraction-oracle error; no Vite resolver, mapping or browser-delivery contradiction established.']}
(folder/'independent.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'status':receipt['status'],'pid':os.getpid(),'inputPins':len(a['inputPins']),'fixtures':len(rows),'uniqueCheckedFilePins':len(pins),'receiptSHA256':sha(folder/'independent.json')}))
