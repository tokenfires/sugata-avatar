"""One bounded read of exact body/bra source inputs; no skinning, warp or runtime import."""
from pathlib import Path
import datetime, hashlib, json, math, os, struct, sys, traceback

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
STOP = datetime.datetime.fromisoformat('2026-10-04T18:10:00+00:00')
ASSETS = ['assets/wardrobe/body/g050.glb', 'assets/wardrobe/foundation_bra/g050.glb']
NAMES = ['neck_01', 'pelvis', 'hand_r', 'hand_l']

def now():
    return datetime.datetime.now(datetime.timezone.utc)

def require(ok, message):
    if not ok:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def mul(a, b):
    return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def local(n):
    if 'matrix' in n:
        require(not any(k in n for k in ['translation','rotation','scale']), 'matrix/TRS overlap')
        v=n['matrix']; require(len(v)==16, 'matrix length')
        return [[v[j*4+i] for j in range(4)] for i in range(4)]
    t=n.get('translation',[0,0,0]); s=n.get('scale',[1,1,1]); q=n.get('rotation',[0,0,0,1])
    require(len(t)==3 and len(s)==3 and len(q)==4, 'TRS dimensions')
    x,y,z,w=q
    require(abs(sum(a*a for a in q)-1)<1e-5, 'nonunit quaternion')
    r=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
       [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
       [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    return [[r[i][j]*s[j] for j in range(3)]+[t[i]] for i in range(3)]+[[0,0,0,1]]

def read_asset(path, pins, record):
    base_require = require
    def gate(ok, message):
        record['gates'].append({'message':message,'ok':bool(ok)})
        base_require(ok, message)
    record.update({'path':str(path.relative_to(ROOT)), 'expectedPin':pins, 'gates':[], 'accessorObservations':[], 'jointMatches':{}, 'phase':'file read'})
    data=path.read_bytes()
    record.update({'actualBytes':len(data),'actualSha256':sha(data)})
    gate(len(data)==pins['bytes'] and sha(data)==pins['sha256'], 'asset changed')
    gate(12<=len(data)<=20_000_000, 'file bound')
    record['header']={'magicHex':data[:4].hex(),'version':struct.unpack_from('<4sII',data)[1],'declaredLength':struct.unpack_from('<4sII',data)[2]}
    gate(struct.unpack_from('<4sII',data)==(b'glTF',2,len(data)), 'GLB header')
    chunks=[]; off=12
    record.update({'phase':'chunks','chunkInventory':[]})
    while off<len(data):
        gate(off+8<=len(data), 'chunk header bound')
        size,typ=struct.unpack_from('<II',data,off); off+=8
        record['chunkInventory'].append({'type':typ,'bytes':size,'start':off})
        gate(size%4==0 and off+size<=len(data), 'chunk bound/alignment')
        chunks.append((typ,data[off:off+size])); off+=size
    gate([v[0] for v in chunks]==[0x4e4f534a,0x004e4942], 'exact JSON/BIN pair required')
    d=json.loads(chunks[0][1]); binary=chunks[1][1]
    record.update({'phase':'document/accessors','document':d})
    gate(d['asset']['version']=='2.0' and not d.get('extensionsRequired'), 'unsupported asset version/extensions')
    gate(len(d['buffers'])==1 and 'uri' not in d['buffers'][0], 'one embedded buffer required')
    gate(0<=len(binary)-d['buffers'][0]['byteLength']<=3, 'BIN declared length')
    def accessor(index, kind, width):
        observation={'index':index,'expectedType':kind,'expectedWidth':width}
        record['accessorObservations'].append(observation)
        a=d['accessors'][index]
        observation['descriptor']=a
        gate(a['type']==kind and a['componentType']==5126 and not a.get('sparse') and not a.get('normalized'), 'plain float accessor required')
        gate(0<a['count']<=100_000, 'accessor count bound')
        v=d['bufferViews'][a['bufferView']]
        observation['bufferView']=v
        gate(v['buffer']==0 and not v.get('extensions'), 'bufferView authority')
        step=v.get('byteStride',width*4); start=v.get('byteOffset',0)+a.get('byteOffset',0)
        gate(step>=width*4 and step%4==0, 'stride')
        end=start+(a['count']-1)*step+width*4
        gate(start>=v.get('byteOffset',0) and end<=v.get('byteOffset',0)+v['byteLength'] and end<=d['buffers'][0]['byteLength'], 'accessor byte bounds')
        values=[list(struct.unpack_from('<'+'f'*width,binary,start+i*step)) for i in range(a['count'])]
        observation['values']=values
        gate(all(math.isfinite(x) for row in values for x in row), 'nonfinite accessor')
        return {'index':index,'descriptor':a,'bufferView':v,'values':values}
    nodes=d['nodes']; world={}; parents={}; order=[]
    record.update({'phase':'node hierarchy','initialSceneGlobalMatrices':world,'parentMap':parents,'sceneTraversal':order})
    scene_index=d.get('scene',0); scene=d['scenes'][scene_index]
    record['sceneIndex']=scene_index
    def visit(index, parent=None):
        gate(index not in world and 0<=index<len(nodes), 'cycle/shared scene node')
        n=nodes[index]; m=local(n)
        gate(all(math.isfinite(x) for row in m for x in row), 'nonfinite node transform')
        world[index]=m if parent is None else mul(world[parent],m)
        parents[index]=parent; order.append(index)
        for child in n.get('children',[]): visit(child,index)
    for index in scene['nodes']: visit(index)
    primitive_records=[]; body_owners=[]
    record.update({'phase':'primitives/owner','primitives':primitive_records,'bodyOwnerCandidates':body_owners})
    for ni in order:
        n=nodes[ni]
        if 'mesh' not in n: continue
        mi=n['mesh']; mesh=d['meshes'][mi]
        for pi,prim in enumerate(mesh['primitives']):
            gate(prim.get('mode',4)==4, 'triangle primitive required')
            pos=accessor(prim['attributes']['POSITION'],'VEC3',3)
            row={'nodeIndex':ni,'meshIndex':mi,'primitiveIndex':pi,'nodeName':n.get('name'),'meshName':mesh.get('name'),'skinIndex':n.get('skin'),'primitive':prim,'position':pos,'sceneGlobalMatrix':world[ni]}
            primitive_records.append(row)
            if 'skin' in n and prim.get('targets'): body_owners.append([ni,mi,pi])
    if path==ROOT/ASSETS[0]: gate(len(body_owners)==1, 'ambiguous/missing morphed skinned body owner')
    skins=[]
    record.update({'phase':'skins','skins':skins})
    for si,s in enumerate(d.get('skins',[])):
        gate(all(j in world for j in s['joints']), 'joint outside declared scene')
        item={'skinIndex':si,'descriptor':s,'joints':[{'slot':slot,'nodeIndex':j,'name':nodes[j].get('name'),'initialSceneGlobalMatrix':world[j]} for slot,j in enumerate(s['joints'])]}
        skins.append(item)
        if 'inverseBindMatrices' in s: item['inverseBindMatrices']=accessor(s['inverseBindMatrices'],'MAT4',16)
    landmarks={}
    record.update({'phase':'literal joints','landmarks':landmarks})
    joint_ids={j for s in d.get('skins',[]) for j in s['joints']}
    for name in NAMES:
        matches=[j for j in joint_ids if nodes[j].get('name')==name]
        record['jointMatches'][name]=matches
        gate(len(matches)==1, 'missing/ambiguous literal joint '+name)
        j=matches[0]
        landmarks[name]={'nodeIndex':j,'node':nodes[j],'parentIndex':parents[j],'initialSceneGlobalMatrix':world[j],'originMeters':[world[j][i][3] for i in range(3)]}
    record['phase']='complete'
    return {'path':str(path.relative_to(ROOT)),'sha256':sha(data),'bytes':len(data),'document':d,'sceneIndex':scene_index,'sceneTraversal':order,'parentMap':parents,'initialSceneGlobalMatrices':world,'primitives':primitive_records,'bodyOwnerCandidates':body_owners,'skins':skins,'landmarks':landmarks,'limits':'Source scene-global joint origins and undeformed POSITION arrays only; inverse bind values retained without applying skin/morph/restPose/stage. No physical body-contact, coverage or runtime-pose claim.'}

def json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return {'nonfiniteFloat':repr(value)}
    if isinstance(value, dict):
        return {k:json_safe(v) for k,v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    return value

def main():
    report={'pid':os.getpid(),'startedAt':now().isoformat(),'status':'running','completedAssets':[],'error':None,'authorityChecks':[]}
    output={'schema':'knit-registration-source-inputs/1','assets':[],'limits':'No mapping arithmetic, warp, transformed mesh, runtime import, skinning or native capture.'}
    code=1
    try:
        require(now()<STOP, 'deadline before read')
        pins=json.loads((HERE/'AUTHORITY-PINS.json').read_text())['files']
        for name,pin in pins.items():
            check={'path':name,'expectedPin':pin}; report['authorityChecks'].append(check)
            q=ROOT/name; b=q.read_bytes()
            check.update({'actualBytes':len(b),'actualSha256':sha(b)})
            require(len(b)==pin['bytes'] and sha(b)==pin['sha256'], 'authority changed '+name)
        for name in ASSETS:
            require(now()<STOP, 'deadline between asset reads')
            record={}; output['assets'].append(record)
            completed=read_asset(ROOT/name,pins[name],record)
            record.update(completed); report['completedAssets'].append(name)
        encoded=(json.dumps(json_safe(output),indent=2,allow_nan=False)+'\n').encode()
        require(len(encoded)<=10_000_000, 'output bound')
        require(now()<STOP, 'deadline before write')
        (HERE/'SOURCE-DATA.json').write_bytes(encoded)
        report['status']='observed'; code=0
    except Exception:
        report['status']='refused'; report['error']=traceback.format_exc()
        try: (HERE/'PARTIAL-DATA.json').write_text(json.dumps(json_safe(output),indent=2,allow_nan=False)+'\n')
        except Exception: report['partialWriteError']=traceback.format_exc()
    finally:
        report['endedAt']=now().isoformat(); report['exitCode']=code
        report['outputs']={}
        for name in ['SOURCE-DATA.json','PARTIAL-DATA.json']:
            q=HERE/name
            try:
                if q.exists():
                    b=q.read_bytes(); report['outputs'][name]={'bytes':len(b),'sha256':sha(b)}
            except Exception: report['outputs'][name]={'inventoryError':traceback.format_exc()}
        try:
            (HERE/'READ-JOB.json').write_text(json.dumps(report,indent=2)+'\n')
        except Exception:
            report['jobWriteError']=traceback.format_exc(); code=1; report['exitCode']=code
        try:
            print(json.dumps(report))
        except Exception:
            report['stdoutWriteError']=traceback.format_exc(); code=1; report['exitCode']=code
            try: print(json.dumps(report),file=sys.stderr)
            except Exception: pass
    return code

if __name__=='__main__':
    raise SystemExit(main())
