import hashlib, json, math, os, sys
from datetime import datetime, timezone
from pathlib import Path

started = datetime.now(timezone.utc).isoformat()
folder = Path(__file__).resolve().parent
repo = folder.parents[3]
out = {'command': 'python3 docs/evidence/hair-2026-10-03/surface-guides/critic-result-read.py',
       'pid': os.getpid(), 'started': started, 'status': 'reading', 'stage': None,
       'scope': 'Read all retained state/record values, source pins and image bytes. Arithmetic on retained matrices/buffers only; no root projection, curve evaluation, model construction, asset import, browser or GPU.'}
def sha(b): return hashlib.sha256(b).hexdigest()
def sub(a,b): return [x-y for x,y in zip(a,b)]
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a): return math.sqrt(sum(x*x for x in a))
def m3v(m,v): return [sum(m[c*3+r]*v[c] for c in range(3)) for r in range(3)]
def m4v(m,v):
    q = [sum(m[c*4+r]*([*v,1][c]) for c in range(4)) for r in range(4)]
    return [x/q[3] for x in q[:3]]
def maxdiff(a,b): return max(abs(x-y) for x,y in zip(a,b))
def finite_tree(x):
    if isinstance(x,dict): return all(finite_tree(v) for v in x.values())
    if isinstance(x,list): return all(finite_tree(v) for v in x)
    if isinstance(x,float): return math.isfinite(x)
    return True
code = 1
try:
    out['stage'] = 'source and native bytes'
    before = json.loads((folder/'CRITIC-SOURCE-PINS.json').read_text())
    for name,row in before['pins'].items():
        b=(repo/name).read_bytes(); assert len(b)==row['bytes'] and sha(b)==row['sha256'], name
    out['sourcePinsUnchanged'] = len(before['pins'])
    native={}
    for name in ['STOPPED-STATE.json','CONSOLE.json','CLOSE.json','stopped-context.jpg','critic-result-read.py']:
        b=(folder/name).read_bytes(); native[name]={'bytes':len(b),'sha256':sha(b)}
    out['pins']=native
    state=json.loads((folder/'STOPPED-STATE.json').read_text())
    close=json.loads((folder/'CLOSE.json').read_text())
    console=json.loads((folder/'CONSOLE.json').read_text())
    guides=json.loads((folder/'GUIDES.json').read_text())
    source=json.loads((folder/'SOURCE-TRIANGLES.json').read_text())
    recipe=json.loads((repo/'looks/ink-denim.json').read_text())
    assert finite_tree(state)
    assert state['options']==recipe
    for url,name in [('../../../../looks/ink-denim.json',repo/'looks/ink-denim.json'),('./GUIDES.json',folder/'GUIDES.json'),('./SOURCE-TRIANGLES.json',folder/'SOURCE-TRIANGLES.json')]:
        b=name.read_bytes(); assert state['inputs'][url]=={'bytes':len(b),'sha256':sha(b)}
    assert len(state['states'])==1 and state['states'][0]['name']=='original-front'
    view=state['states'][0]; assert view['complete'] is False and view['originalVisible'] is True and view['proposalVisible'] is False
    r=view['report']; assert r['quality']['backend']=='webgpu' and not r['quality']['backendMismatch'] and r['quality']['requested']=='balanced'
    assert r['identity']=={'gender':.5,'bake':'figure_g050'}
    assert r['hair']['loadedStyle']=='bob02' and r['hair']['attached'] and r['hair']['colour']['matchesAttached']
    assert r['hair']['colour']['applied']==recipe['hairColour'] and r['hair']['colour']['appliedTint'] is None
    assert r['wardrobe']['appearance']=={'style':'ecru','colours':recipe['wardrobe']['colours'],'attached':True}
    assert r['wardrobe']['foundation']==recipe['wardrobe']['foundation']
    assert sorted(r['wardrobe']['state']['worn'])==sorted([*recipe['wardrobe']['outfit'],*recipe['wardrobe']['foundation'].values()])
    assert r['motion']['seed']==recipe['seed'] and r['motion']['timeSeconds']==0 and r['motion']['frame']==64 and r['speech']['clockSeconds']==0
    assert r['scene']['id']=='studio' and r['scene']['lighting']['look']=='neutral'
    out['stage']='all retained geometry and attachment records'
    assert len(state['records'])==36
    byguide={x['id']:x for x in guides['guides']}; bysource={x['id']:x for x in source['records']}
    minima=[]; maxima=[]; minarea=math.inf; maxnormalerror=0; maxmetricerror=0; maxrooterror=0; vertices=0; triangles=0
    head=state['attachment']['headWorld']
    for rec in state['records']:
        g=byguide[rec['id']]; assert rec['sourceTriangle']==bysource[rec['id']]
        assert rec['vertices']==98 and rec['triangles']==96 and len(rec['centres'])==49 and len(rec['tangents'])==49
        assert len(rec['headLocalVertices'])==294 and len(rec['normals'])==294 and len(rec['indices'])==288
        points=[rec['headLocalVertices'][i:i+3] for i in range(0,294,3)]
        normals=[rec['normals'][i:i+3] for i in range(0,294,3)]
        area=min(norm(cross(sub(points[rec['indices'][i+1]],points[rec['indices'][i]]),sub(points[rec['indices'][i+2]],points[rec['indices'][i]]))) for i in range(0,288,3))
        err=max(abs(norm(n)-1) for n in normals)
        assert area>=1e-12 and err<=2e-6
        maxmetricerror=max(maxmetricerror,abs(area-rec['validation']['minDoubleArea']),abs(err-rec['validation']['maxNormalUnitError']))
        minarea=min(minarea,area); maxnormalerror=max(maxnormalerror,err)
        posed=[sum(rec['posedVertices'][i][k]*g['root']['bary'][i] for i in range(3)) for k in range(3)]
        maxrooterror=max(maxrooterror,maxdiff(posed,rec['posedRoot']))
        for m in ['restFrame','posedFrame','rotation']:
            cols=[rec[m][i:i+3] for i in range(0,9,3)]
            assert max(abs(sum(cols[a][k]*cols[b][k] for k in range(3))-(a==b)) for a in range(3) for b in range(3))<1e-12
        for p in points:
            world=m4v(head,p); camera=m4v([1,0,0,0,0,1,0,0,0,0,1,0,0,-1.55,-.92,1],world)
            ndc=m4v(view['camera']['projection'],camera); minima.append(ndc); maxima.append(ndc)
        vertices+=rec['vertices']; triangles+=rec['triangles']
    actualmin=[min(p[k] for p in minima) for k in range(3)]; actualmax=[max(p[k] for p in maxima) for k in range(3)]
    projectionResidual=max(maxdiff(actualmin,view['bounds']['min']),maxdiff(actualmax,view['bounds']['max']))
    assert projectionResidual<1e-10 and maxmetricerror<1e-12 and maxrooterror<1e-12
    assert vertices==3528 and triangles==3456 and view['bounds']['coordinateSystem']==2001
    assert view['bounds']['min'][0]<-.94 and view['bounds']['min'][0]>-1
    assert all(-1<=p[0]<=1 and -1<=p[1]<=1 and 0<=p[2]<=1 for p in minima)
    assert 'Actual modelling geometry outside fixed frame' in state['failure']['message']
    out['geometry']={'vertices':vertices,'triangles':triangles,'minDoubleArea':minarea,'maxNormalUnitError':maxnormalerror,'metricResidual':maxmetricerror,'rootResidual':maxrooterror,'nominalProjectionResidual':projectionResidual,'boundsMin':actualmin,'boundsMax':actualmax,'leftMarginNDC':1+actualmin[0],'failedMarginNDC':.06,'scope':'Stored construction head matrix and recorded camera projection reproduce the recorded bound; not an observed temporal-pass or candidate-image claim.'}
    out['stage']='retirement and finite console'
    ret=state['retirement']; assert ret==close['retirement']
    assert ret['reason']=='failure' and ret['ownerReturned'] and ret['modelDisposed']
    assert ret['modelDisposal']['attempts']==['detach',*[f'geometry-{i}' for i in range(36)],'material']
    assert ret['modelDisposal']['errors']==[] and ret['errors']==[] and ret['disposal']=={'disposed':True,'leaked':[]}
    assert close['closedTab']=='8' and [t['id'] for t in close['remainingTabs']]==['1']
    out['retirement']=ret; out['consoleCounts']={level:sum(row['level']==level for row in console) for level in ['warn','error']}
    assert out['consoleCounts']=={'warn':3,'error':0}
    out['failure']=state['failure']; out['offeredStudyImages']=0; out['completedViews']=0
    out['status']='retained-data checks pass; trial remains refused at fixed margin'
    code=0
except Exception as e:
    out['status']='reader failed'; out['error']=repr(e)
finally:
    out['ended']=datetime.now(timezone.utc).isoformat()
    (folder/'CRITIC-RESULT-READBACK.json').write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps(out))
sys.exit(code)
