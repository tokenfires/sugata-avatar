"""Read-only independent exported-anchor inventory; no styled domain or solver.
Direct GLB/accessor definitions only, no execution of earlier geometric audits.
"""
import ast, hashlib, json, struct, os, sys
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
started=datetime.now(timezone.utc).isoformat()
path=Path('docs/evidence/appearance-2026-10-02/front-design/anatomy-anchors.json')
raw=path.read_bytes();r=json.loads(raw)
assert hashlib.sha256(raw).hexdigest()=='f846be59e18ce5485a41ddac67a90342b19733a4a42209b862fd6c3fb22eb9ba'
helper=Path('docs/evidence/appearance-2026-10-02/root-coverage/verify-local-result.py')
functions=[x for x in ast.parse(helper.read_text()).body if isinstance(x,ast.FunctionDef) and x.name in ('glb','accessor','mesh')]
exec(compile(ast.Module(body=functions,type_ignores=[]),str(helper),'exec'),globals())
for p,h in r['sourceHashes'].items(): assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==h
g=glb('assets/figures/figure_g050.glb');p,a,ix=mesh(g,'base.001');pos=a['POSITION'].astype(float)
def bounds(x):return [{'min':float(mn),'max':float(mx)} for mn,mx in zip(x.min(axis=0),x.max(axis=0))]
for name,rec in r['meshBounds'].items():
    mp,ma,mi=mesh(g,name);xyz=ma['POSITION'].astype(float)
    assert rec['vertices']==len(xyz) and rec['triangles']==len(mi) and rec['bounds']==bounds(xyz)
    if 'medialWitnesses' in rec:
        for w in rec['medialWitnesses']:
            ids=np.flatnonzero(np.sign(xyz[:,0])==w['sideSign']);v=int(ids[np.argmin(abs(xyz[ids,0]))])
            assert v==w['vertex'] and xyz[v].tolist()==w['point']
bodymesh=next(m for m in g['json']['meshes'] if m['name']=='base.001')
assert r['metadata']['bodyMeshExtraKeys']==list(bodymesh.get('extras',{}))
assert r['metadata']['bodyAttributeNames']==list(p['attributes'])
assert not any(n.get('name') in ('scalp','ears') for n in g['json']['nodes'])
assert not r['metadata']['hasLiteralScalpName'] and not r['metadata']['hasLiteralEarsGroupName']
crown=np.flatnonzero(pos[:,1]==pos[:,1].max())
assert r['crownWitnesses']==[{'vertex':int(v),'point':pos[v].tolist()} for v in crown]
names=bodymesh['extras']['targetNames']; summaries={}
def morph_accessor(asset,index):
    # Independent sparse expansion: target accessors need not have a base view.
    ac=asset['json']['accessors'][index];size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']]
    dtype={5121:'<u1',5123:'<u2',5125:'<u4',5126:'<f4'}[ac['componentType']]
    assert ac['componentType']==5126 and not ac.get('normalized')
    if 'bufferView' in ac:
        view=asset['json']['bufferViews'][ac['bufferView']];offset=view.get('byteOffset',0)+ac.get('byteOffset',0)
        data=np.ndarray((ac['count'],size),dtype=dtype,buffer=asset['bin'],offset=offset,
                        strides=(view.get('byteStride',size*4),4)).copy()
    else:data=np.zeros((ac['count'],size),dtype=dtype)
    if 'sparse' in ac:
        sparse=ac['sparse'];ispec=sparse['indices'];vspec=sparse['values'];n=sparse['count']
        iv=asset['json']['bufferViews'][ispec['bufferView']];vv=asset['json']['bufferViews'][vspec['bufferView']]
        itype={5121:'<u1',5123:'<u2',5125:'<u4'}[ispec['componentType']]
        ids=np.frombuffer(asset['bin'],dtype=itype,count=n,offset=iv.get('byteOffset',0)+ispec.get('byteOffset',0))
        values=np.frombuffer(asset['bin'],dtype=dtype,count=n*size,offset=vv.get('byteOffset',0)+vspec.get('byteOffset',0)).reshape(n,size)
        assert len(np.unique(ids))==n and ids.max()<ac['count']
        data[ids]=values
    return data
for name,rec in r['supports'].items():
    delta=morph_accessor(g,p['targets'][names.index(name)]['POSITION']).astype(float)
    magnitude=np.linalg.norm(delta,axis=1);ids=np.flatnonzero(magnitude>.00015)
    assert rec['vertexIds']==ids.tolist() and rec['vertices']==len(ids) and rec['bounds']==bounds(pos[ids])
    assert abs(rec['maxDisplacementMm']-magnitude[ids].max()*1000)<1e-11
    summaries[name]={'vertices':len(ids),'bounds':bounds(pos[ids]),'maxDisplacementMm':float(magnitude[ids].max()*1000)}
finished=datetime.now(timezone.utc).isoformat()
print(json.dumps({'status':'independent exported anchor records agree','started':started,'finished':finished,'pid':os.getpid(),
                 'interpreter':sys.executable,'pythonVersion':sys.version,'numpyVersion':np.__version__,
                 'reportSha256':hashlib.sha256(raw).hexdigest(),'sourcePins':r['sourceHashes'],
                 'genericReaderSha256':hashlib.sha256(helper.read_bytes()).hexdigest(),
                 'meshBounds':r['meshBounds'],'crownWitnesses':r['crownWitnesses'],'supports':summaries,
                 'limits':['Source-coordinate inventory only, not registration/rendered landmarks.','Morph footprint does not specify styled hairline/part/open regions.',
                           'No domain selection, geometry construction, guide audit, capture or generator executed.']},indent=2))
