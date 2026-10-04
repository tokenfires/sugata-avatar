from pathlib import Path
import json, hashlib, datetime, math, struct, os, sys, traceback

P=Path(__file__).resolve().parent
R=P.parents[3]
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(n): return json.loads((P/n).read_text())
def meta(q):
    b=q.read_bytes(); return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def f32(v): return struct.unpack('<f',struct.pack('<f',v))[0]
def colvec(m,v):
    return [math.fsum(m[c*4+r]*v[c] for c in range(4)) for r in range(4)]
def vec3(m,v):
    q=colvec(m,[*v,1.0]); assert q[3]!=0; return [x/q[3] for x in q[:3]]
def product(a,b):
    return [math.fsum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def error(a,b):
    assert len(a)==len(b)
    return max((abs(x-y) for x,y in zip(a,b)),default=0.0)
def bounds(points):
    return {'min':[min(v[k] for v in points) for k in range(3)],'max':[max(v[k] for v in points) for k in range(3)]}
def within(a,b,t):
    assert error(a,b)<=t,(a,b,t)
job={'pid':os.getpid(),'started':now(),'command':sys.argv,'maximumInvocations':1,
     'scope':'saved JSON/text only; no GLB decoding or primary/oracle import or CPU engine objects',
     'currentOwner':None,'currentVertex':None}
try:
    c=read('CONTRACT.json'); pins=read('SOURCE-INPUTS.json')['files']
    for name,m in pins.items(): assert meta(R/name)==m,name
    for name,m in c['inputs'].items(): assert meta(R/name)==m,name
    job['verifiedSourcePins']=pins
    l=read('LEDGER.json'); e=read('CPU-ORACLE.json')
    obs=json.loads((R/c['observationPath']).read_text())
    for process,streams,child,gate in [('RUN-PROCESS.json',['STDOUT.txt','STDERR.txt'],'READER-JOB.json','readerGateUTC'),('ORACLE-PROCESS.json',['ORACLE-STDOUT.txt','ORACLE-STDERR.txt'],'CPU-ORACLE-JOB.json','oracleGateUTC')]:
        p=read(process); j=read(child)
        assert p['childExit']==0 and p['childReaped'] and not p['timedOut'] and not p['late'] and not p['recordingErrors']
        assert p['maximumInvocations']==j['maximumInvocations']==1
        assert json.loads((P/streams[0]).read_text())==j and (P/streams[1]).read_bytes()==b''
        assert datetime.datetime.fromisoformat(p['completed'])<datetime.datetime.fromisoformat(c[gate])
        assert datetime.datetime.fromisoformat(j['completed'])<datetime.datetime.fromisoformat(c[gate])
        for name,m in p['capturedStreams'].items(): assert meta(P/name)==m,name
        for name,m in p['actualFiles'].items(): assert m['exists'] and meta(P/name)=={k:m[k] for k in ['bytes','sha256']},name
    assert read('LEDGER-PARTIAL.json')=={k:l[k] for k in ['scope','inputs','assets','owners']}
    ep=read('CPU-ORACLE-PARTIAL.json'); assert ep['owners']==e['owners']
    assert e['ledgerSHA256']==meta(P/'LEDGER.json')['sha256']
    assert l['inputs']==e['inputs']==c['inputs']
    assert e['originalSHA256']=={a['key']:a['sha256'] for a in l['assets']}
    assert len(l['assets'])==len(obs['sources'])==3 and len(l['owners'])==len(e['owners'])==9
    expected=[('body','Human',14517,26756),('body','Humancornea',524,980),('body','Humaneyebrow001',124,192),('body','Humaneyelashes01',250,368),('body','Humanhigh-poly',552,1060),('body','Humanteeth_base',4494,7120),('body','Humantongue01',253,448),('bra','Humanfoundation_bra',12030,22090),('briefs','Humanfoundation_briefs',6802,12498)]
    sources={s['key']:s for s in obs['sources']}; assets={a['key']:a for a in l['assets']}
    for key,a in assets.items():
        d=json.loads(json.dumps(a['originalDocument']))
        for sk in d['skins']:
            for i in sk['joints']:d['nodes'][i]['isBone']=True
        for node in d['nodes']:
            if 'mesh' in node and 'skin' in node:d['meshes'][node['mesh']]['isSkinnedMesh']=True
        assert d==sources[key]['rawDocument']
        assert meta(R/a['path'])=={'bytes':a['bytes'],'sha256':a['sha256']}
    maxLedger=0.0;maxEngine=0.0;maxPair=0.0;maxMatrix=0.0;allPoints=[];summary=[];totalTriangles=0
    for o,t,exp in zip(l['owners'],e['owners'],expected):
        key,name,n,nt=exp;job['currentOwner']=[key,name]
        assert (o['key'],o['name'],len(o['basePositions']),len(o['triangles']))==exp
        assert (t['key'],t['name'],t['vertexCount'],t['triangleCount'])==exp
        assert o['association']==t['association']
        s=sources[key];d=assets[key]['originalDocument'];a=o['association']
        matches=[m for m in s['meshes'] if m['uuid']==o['uuid']];assert len(matches)==1
        m=matches[0];assert m['name']==name and m['association']==a and m['skinned'] and m['vertexCount']==n
        assert all(v==0 for v in m['originalMorphInfluences']+m['zeroMorphInfluences'])
        nodes=[v for v in s['nodes'] if v['uuid']==o['uuid']];assert len(nodes)==1
        assert o['sourceNodeRecord']==nodes[0] and o['sourceMeshRecord']==m
        prim=d['meshes'][a['meshes']]['primitives'][a['primitives']];skin=d['skins'][d['nodes'][a['nodes']]['skin']]
        assert len(m['zeroMorphInfluences'])==len(prim.get('targets',[])) and prim.get('mode',4)==4
        ids={'positions':prim['attributes']['POSITION'],'joints':prim['attributes']['JOINTS_0'],'weights':prim['attributes']['WEIGHTS_0'],'triangles':prim['indices'],'inverseBind':skin['inverseBindMatrices']}
        counts={'positions':n,'joints':n,'weights':n,'triangles':nt*3,'inverseBind':53}
        types={'positions':('VEC3',5126,12),'joints':('VEC4',5121,4),'weights':('VEC4',5126,16),'triangles':('SCALAR',5123,2),'inverseBind':('MAT4',5126,64)}
        for k,i in ids.items():
            q=o['accessors'][k];v=d['accessors'][i];bv=d['bufferViews'][v['bufferView']]
            assert q['accessor']==i and q['descriptor']==v and q['bufferView']==bv
            typ,comp,width=types[k];assert (v['type'],v['componentType'],v['count'])==(typ,comp,counts[k])
            assert q['elementBytes']==width and q['strideBytes']==bv.get('byteStride',width)
        assert o['vertexIDs']==list(range(n)) and o['triangleIDs']==list(range(nt))
        for tri in o['triangles']:assert len(tri)==3 and all(isinstance(i,int) and 0<=i<n for i in tri)
        assert len(o['inverseBindMatrices'])==len(o['boneSkinMatrices'])==len(m['bones'])==len(skin['joints'])==53
        for bid,b,ibm,bs in zip(skin['joints'],m['bones'],o['inverseBindMatrices'],o['boneSkinMatrices']):
            assert b['association']['nodes']==bid and b['name']==d['nodes'][bid]['name']
            assert ibm==b['inverseBind'] and len(ibm)==16 and all(math.isfinite(v) and f32(v)==v for v in ibm)
            residual=error(product(b['world'],ibm),bs);maxMatrix=max(maxMatrix,residual);assert residual<=1e-14
        assert len(o['worldPositions'])==len(o['jointIndices'])==len(o['rawWeights'])==len(o['loaderNormalizedFloat32Weights'])==len(t['engineWorldPositions'])==n
        independent=[];ownerLedger=0.0;ownerEngine=0.0;ownerPair=0.0
        for i,(base,ji,rw,nw,pw,pe) in enumerate(zip(o['basePositions'],o['jointIndices'],o['rawWeights'],o['loaderNormalizedFloat32Weights'],o['worldPositions'],t['engineWorldPositions'])):
            job['currentVertex']=i
            assert len(base)==3 and len(ji)==len(rw)==len(nw)==4
            assert all(math.isfinite(x) and f32(x)==x for x in base+rw+nw)
            assert all(isinstance(j,int) and 0<=j<53 for j in ji)
            length=((abs(rw[0])+abs(rw[1]))+abs(rw[2]))+abs(rw[3])
            normal=[f32(w*(1.0/length)) for w in rw] if length else [1.0,0.0,0.0,0.0]
            assert nw==normal,(name,i,nw,normal)
            bound=colvec(m['bind'],[*base,1.0]);parts=[]
            for j,w in zip(ji,nw):
                # Independent order: apply original IBM and recorded bone world separately,
                # rather than use the portable reader's pre-multiplied skin matrix.
                parts.append((w,colvec(m['bones'][j]['world'],colvec(o['inverseBindMatrices'][j],bound))))
            combined=[math.fsum(w*v[k] for w,v in parts) for k in range(3)]
            reconstructed=vec3(nodes[0]['world'],vec3(m['bindInverse'],combined))
            assert all(math.isfinite(x) for x in pw+pe+reconstructed)
            erL=error(reconstructed,pw);erE=error(reconstructed,pe);erP=error(pw,pe)
            ownerLedger=max(ownerLedger,erL);ownerEngine=max(ownerEngine,erE);ownerPair=max(ownerPair,erP)
            assert max(erL,erE,erP)<=c['oracleToleranceMetres'],(name,i,erL,erE,erP)
            independent.append(reconstructed)
        assert error(t['currentNormalizedWeights'],o['loaderNormalizedFloat32Weights'][-1])==0
        assert t['currentVertex']==n-1
        assert ownerPair==t['maximumPointResidualMetres']
        for k in ['min','max']:
            within(bounds(o['worldPositions'])[k],o['bounds'][k],1e-15)
            within(bounds(t['engineWorldPositions'])[k],t['bounds'][k],1e-15)
            within(bounds(independent)[k],o['bounds'][k],1e-9)
        maxLedger=max(maxLedger,ownerLedger);maxEngine=max(maxEngine,ownerEngine);maxPair=max(maxPair,ownerPair)
        allPoints.extend(independent);totalTriangles+=nt
        summary.append({'key':key,'name':name,'vertices':n,'triangles':nt,'independentToPortableMaximum':ownerLedger,'independentToEngineMaximum':ownerEngine,'portableToEngineMaximum':ownerPair})
    assert len(allPoints)==l['vertexCount']==e['vertexCount']==obs['framing']['vertexCount']==39546
    b=bounds(allPoints)
    for k in ['min','max']:
        within(b[k],l['bounds'][k],1e-9);within(b[k],e['bounds'][k],1e-9)
        within(b[k],obs['framing']['bounds'][k],c['boundToleranceMetres'])
        assert l['observedBounds'][k]==e['observedBounds'][k]==obs['framing']['bounds'][k]
    assert maxPair==e['maximumPointResidualMetres']
    inv=(P/'INVENTORY.md').read_text()
    for key,name,n,nt in expected:assert f'| {key} | {name} | {n} | {nt} |' in inv
    files=['LEDGER.json','LEDGER-PARTIAL.json','INVENTORY.md','READER-JOB.json','RUN-PROCESS.json','STDOUT.txt','STDERR.txt','CPU-ORACLE.json','CPU-ORACLE-PARTIAL.json','CPU-ORACLE-JOB.json','ORACLE-PROCESS.json','ORACLE-STDOUT.txt','ORACLE-STDERR.txt','SOURCE-RESULT.md','SOURCE-RECEIPT.json','SOURCE-INPUTS.json','CONTRACT.json','ROOT-PRIMARY.json','critic-data.py']
    job.update(status='A saved original-source CPU ledger only',owners=summary,vertexCount=len(allPoints),triangleCount=totalTriangles,maximumIndependentPortableResidual=maxLedger,maximumIndependentEngineResidual=maxEngine,maximumPortableEngineResidual=maxPair,maximumSkinMatrixResidual=maxMatrix,bounds=b,bindings={n:meta(P/n) for n in files},limitations=['Original GLB arrays independently decoded by admitted oracle, not decoded again by this saved-only checker.','No GPU/fit/contact/enclosure/morph-motion/appearance/cause qualification.'])
    code=0
except Exception as ex:
    job.update(status='B first saved-data failure',exception=repr(ex),traceback=traceback.format_exc());code=1
job['completed']=now()
(P/'CRITIC-DATA.json').write_text(json.dumps(job,indent=2)+'\n')
print(json.dumps(job))
sys.exit(code)
