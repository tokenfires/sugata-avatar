"""One original-source decode; no fitted garment, renderer or asset writes."""
from pathlib import Path
from datetime import datetime, timezone
import copy, hashlib, json, math, os, struct, sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
def utc(): return datetime.now(timezone.utc).isoformat()
def require(ok, why):
    if not ok: raise ValueError(why)
def save(name, obj): (HERE/name).write_text(json.dumps(obj,indent=2,allow_nan=False)+'\n')
def f32(x): return struct.unpack('<f',struct.pack('<f',x))[0]
def mm(a,b): return [sum(a[r+4*k]*b[k+4*c] for k in range(4)) for c in range(4) for r in range(4)]
def mv(a,p): return [sum(a[r+4*k]*p[k] for k in range(4)) for r in range(4)]
def v3(a,p):
    v=mv(a,list(p)+[1]); require(v[3]!=0,'zero homogeneous denominator'); return [v[k]/v[3] for k in range(3)]
def finite(rows): return all(math.isfinite(x) for row in rows for x in row)
def bounds(rows): return {'min':[min(p[k] for p in rows) for k in range(3)],'max':[max(p[k] for p in rows) for k in range(3)]}

def glb(blob):
    require(len(blob)>=20,'short GLB')
    magic,ver,total=struct.unpack_from('<III',blob)
    require((magic,ver,total)==(0x46546c67,2,len(blob)),'GLB header')
    chunks=[]; offset=12
    while offset<len(blob):
        require(offset+8<=len(blob),'chunk header range')
        length,kind=struct.unpack_from('<II',blob,offset); start=offset+8
        require(length%4==0 and start+length<=len(blob),'chunk extent/alignment')
        chunks.append((kind,start,length)); offset=start+length
    require([c[0] for c in chunks]==[0x4e4f534a,0x004e4942],'exact JSON/BIN pair')
    _,a,n=chunks[0]; doc=json.loads(blob[a:a+n].decode('utf-8'))
    _,a,n=chunks[1]; require(len(doc['buffers'])==1 and 'uri' not in doc['buffers'][0],'one embedded buffer')
    size=doc['buffers'][0]['byteLength']; require(size<=n and n-size<=3,'BIN padding')
    require(not doc.get('extensionsRequired'),'required extensions unsupported')
    return doc,blob[a:a+size],[{'kind':k,'byteOffset':s,'byteLength':l} for k,s,l in chunks]

def accessor(doc,buf,index,kind,component):
    a=doc['accessors'][index]
    require(a['type']==kind and a['componentType']==component,'accessor type')
    require(not a.get('normalized',False) and 'sparse' not in a and not a.get('extensions'),'selected accessor unsupported encoding')
    view=doc['bufferViews'][a['bufferView']]; require(view['buffer']==0 and not view.get('extensions'),'buffer view authority')
    components={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[kind]
    fmt,width={5121:('B',1),5123:('H',2),5126:('f',4)}[component]
    packed=width*components; stride=view.get('byteStride',packed); off=a.get('byteOffset',0); begin=view.get('byteOffset',0)
    count=a['count']; require(isinstance(count,int) and count>0,'accessor count')
    require(stride>=packed and stride%width==0 and off%width==0 and begin%width==0,'accessor alignment/stride')
    require(begin>=0 and off>=0 and begin+view['byteLength']<=len(buf) and off+(count-1)*stride+packed<=view['byteLength'],'accessor byte range')
    rows=[list(struct.unpack_from('<'+fmt*components,buf,begin+off+i*stride)) for i in range(count)]
    require(finite(rows),'nonfinite accessor')
    return rows,{'accessor':index,'descriptor':a,'bufferView':view,'elementBytes':packed,'strideBytes':stride}

def run():
    contract=json.loads((HERE/'CONTRACT.json').read_text())
    deadline=datetime.fromisoformat(contract['readerGateUTC'].replace('Z','+00:00'))
    require(datetime.now(timezone.utc)<deadline,'reader gate expired')
    for rel,pin in contract['inputs'].items():
        b=(ROOT/rel).read_bytes(); require(len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],'input pin: '+rel)
    obs=json.loads((ROOT/contract['observationPath']).read_text())
    require(obs['threeRevision']=='185' and obs['framing']['vertexCount']==39546,'observation revision/count')
    require([s['key'] for s in obs['sources']]==['body','bra','briefs'],'complete source order')
    ledger={'scope':'complete original zero-morph CPU surfaces only; no contact/fit/GPU equivalence','inputs':contract['inputs'],'assets':[],'owners':[]}
    expected=[('body','Human',14517),('body','Humancornea',524),('body','Humaneyebrow001',124),('body','Humaneyelashes01',250),('body','Humanhigh-poly',552),('body','Humanteeth_base',4494),('body','Humantongue01',253),('bra','Humanfoundation_bra',12030),('briefs','Humanfoundation_briefs',6802)]
    for src,inp in zip(obs['sources'],obs['inputs']):
        key=src['key']; require(inp['key']==key,'asset/source alignment'); blob=(ROOT/inp['path']).read_bytes()
        require(len(blob)==inp['bytes'] and hashlib.sha256(blob).hexdigest()==inp['sha256'],'original bytes')
        doc,buf,chunks=glb(blob); marked=copy.deepcopy(doc)
        for skin in marked.get('skins',[]):
            for node in skin['joints']: marked['nodes'][node]['isBone']=True
        for node in marked['nodes']:
            if 'mesh' in node and 'skin' in node: marked['meshes'][node['mesh']]['isSkinnedMesh']=True
        require(marked==src['rawDocument'],'complete loader-marked original document')
        asset={'key':key,'path':inp['path'],'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'chunks':chunks,'originalDocument':doc}; ledger['assets'].append(asset)
        for mesh in src['meshes']:
            assoc=mesh['association']; node=doc['nodes'][assoc['nodes']]
            require(mesh['skinned'] and node['mesh']==assoc['meshes'],'source mesh association')
            primitive=doc['meshes'][assoc['meshes']]['primitives'][assoc['primitives']]
            require(primitive.get('mode',4)==4 and not primitive.get('extensions'),'triangle primitive')
            require(len(mesh['zeroMorphInfluences'])==len(primitive.get('targets',[])) and all(x==0 for x in mesh['zeroMorphInfluences']) and all(x==0 for x in mesh['originalMorphInfluences']),'zero morph scope')
            skin=doc['skins'][node['skin']]; require(len(skin['joints'])==53==len(mesh['bones']),'complete skin')
            ibm,ibmd=accessor(doc,buf,skin['inverseBindMatrices'],'MAT4',5126)
            require(len(ibm)==53,'inverse bind count')
            require([b['association']['nodes'] for b in mesh['bones']]==skin['joints'],'joint order')
            require([b['inverseBind'] for b in mesh['bones']]==ibm,'decoded inverse-bind operands')
            owners=[n for n in src['nodes'] if n['uuid']==mesh['uuid']]
            require(len(owners)==1,'one recorded node by UUID'); owner=owners[0]
            require(owner['association']==assoc,'recorded node association')
            world=owner['world']; bind=mesh['bind']; inverse=mesh['bindInverse']
            require(finite([world,bind,inverse]+[b['world'] for b in mesh['bones']]) and all(len(a)==16 for a in [world,bind,inverse]+[b['world'] for b in mesh['bones']]),'matrix operands')
            attrs=primitive['attributes']; pos,pd=accessor(doc,buf,attrs['POSITION'],'VEC3',5126); joints,jd=accessor(doc,buf,attrs['JOINTS_0'],'VEC4',5121); weights,wd=accessor(doc,buf,attrs['WEIGHTS_0'],'VEC4',5126); ids,td=accessor(doc,buf,primitive['indices'],'SCALAR',5123)
            require(len(pos)==len(joints)==len(weights)==mesh['vertexCount'],'vertex array cardinality')
            require(len(ids)%3==0 and all(0<=v[0]<len(pos) for v in ids),'triangle indices')
            require(all(0<=j<53 for row in joints for j in row),'joint index range')
            normalized=[]; output=[]; transforms=[mm(b['world'],ibm[i]) for i,b in enumerate(mesh['bones'])]
            for p,js,ws in zip(pos,joints,weights):
                norm=sum(abs(w) for w in ws); nw=[f32(w*(1/norm)) for w in ws] if norm else [1.0,0.0,0.0,0.0]; normalized.append(nw)
                base=mv(bind,p+[1]); xyz=[0.0,0.0,0.0]
                for j,w in zip(js,nw):
                    if w!=0:
                        transformed=mv(transforms[j],base)
                        for k in range(3): xyz[k]+=transformed[k]*w
                output.append(v3(world,v3(inverse,xyz)))
            require(finite(output),'nonfinite reconstructed points')
            ledger['owners'].append({'key':key,'name':mesh['name'],'uuid':mesh['uuid'],'association':assoc,'sourceNodeRecord':owner,'sourceMeshRecord':mesh,'accessors':{'positions':pd,'joints':jd,'weights':wd,'triangles':td,'inverseBind':ibmd},'vertexIDs':list(range(len(pos))),'basePositions':pos,'jointIndices':joints,'rawWeights':weights,'loaderNormalizedFloat32Weights':normalized,'inverseBindMatrices':ibm,'boneSkinMatrices':transforms,'worldPositions':output,'triangleIDs':list(range(len(ids)//3)),'triangles':[[ids[i+k][0] for k in range(3)] for i in range(0,len(ids),3)],'bounds':bounds(output)})
            save('LEDGER-PARTIAL.json',ledger)
    require([(o['key'],o['name'],len(o['worldPositions'])) for o in ledger['owners']]==expected,'all nine exact roles')
    allpoints=[p for o in ledger['owners'] for p in o['worldPositions']]; require(len(allpoints)==39546,'full point union')
    ledger['bounds']=bounds(allpoints); ledger['vertexCount']=len(allpoints)
    ledger['observedBounds']=obs['framing']['bounds']; ledger['maximumBoundErrorMetres']=max(abs(ledger['bounds'][s][k]-ledger['observedBounds'][s][k]) for s in ['min','max'] for k in range(3))
    save('LEDGER.json',ledger)
    lines=['# Complete original source inventory','','Source data only. CPU zero-morph reconstruction; no fit, coverage, contact or GPU point equivalence.','','| Asset | Owner | Vertices | Triangles |','| --- | --- | --- | --- |']
    lines += ['| '+o['key']+' | '+o['name']+' | '+str(len(o['worldPositions']))+' | '+str(len(o['triangles']))+' |' for o in ledger['owners']]
    lines += ['','Union bound maximum error: '+str(ledger['maximumBoundErrorMetres'])+' metres.','']
    (HERE/'INVENTORY.md').write_text('\n'.join(lines))
    require(ledger['maximumBoundErrorMetres']<=contract['boundToleranceMetres'],'fixed union bound refusal')
    require(datetime.now(timezone.utc)<deadline,'late full reader result')
    return {'owners':9,'vertices':len(allpoints),'maximumBoundErrorMetres':ledger['maximumBoundErrorMetres'],'status':'A original-source data only; independent review pending'}

if __name__=='__main__':
    job={'pid':os.getpid(),'started':utc(),'command':sys.argv,'maximumInvocations':1}; code=1
    try: job.update(run()); code=0
    except Exception as e: job.update({'status':'B reader; no dependent work','exceptionType':type(e).__name__,'exception':str(e)})
    job['completed']=utc()
    try: save('READER-JOB.json',job)
    except Exception as e: print('job recording error: '+str(e),file=sys.stderr); code=1
    print(json.dumps(job,allow_nan=False)); sys.exit(code)
