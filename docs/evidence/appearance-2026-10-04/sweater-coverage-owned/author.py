"""First complete source-triangle responsibility, not a garment constructor."""
from pathlib import Path
import datetime, hashlib, json, math, os, sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def pin(path):
    b=path.read_bytes()
    return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(name, value):
    (HERE/name).write_text(json.dumps(value,separators=(',',':'),allow_nan=False)+'\n')
job={'pid':os.getpid(),'started':now(),'scope':'source responsibility only','status':'started'}
result={'owners':[],'status':'partial'}
try:
    inputs=json.loads((HERE/'INPUTS.json').read_text())
    for p in inputs['inputs']:
        if pin(ROOT/p['path'])!={k:p[k] for k in ['bytes','sha256']}: raise ValueError('Input changed: '+p['path'])
    policy=json.loads((HERE/'POLICY.json').read_text())
    job['policy']=pin(HERE/'POLICY.json')
    ledger=json.loads((ROOT/policy['ledger']['path']).read_text())
    observations=json.loads((ROOT/policy['observations']['path']).read_text())
    bones={b['name']:b['world'][12:15] for b in observations['sources'][0]['meshes'][0]['bones']}
    planes=[{'name':'neck','normal':[0.,-1.,0.],'origin':[0.,policy['neckY'],0.]},
            {'name':'hem','normal':[0.,1.,0.],'origin':[0.,policy['hemY'],0.]}]
    for side in ['l','r']:
        hand,elbow=bones['hand_'+side],bones['lowerarm_'+side]
        axis=[hand[i]-elbow[i] for i in range(3)]; length=math.hypot(*axis)
        if not length>0: raise ValueError('Cuff axis missing')
        axis=[v/length for v in axis]
        origin=[hand[i]-policy['cuffProximalMetres']*axis[i] for i in range(3)]
        planes.append({'name':'cuff_'+side,'normal':[-v for v in axis],'origin':origin,'elbow':elbow,'hand':hand,'outward':axis})
    result.update({'policy':policy,'planes':planes,'ledgerPin':pin(ROOT/policy['ledger']['path'])})
    max_error=0.; total=0; shared={}; shared_error=0.
    def clean(poly):
        out=[]
        for b in poly:
            if not out or b!=out[-1]: out.append(b)
        if len(out)>1 and out[0]==out[-1]: out.pop()
        return out
    for owner in ledger['owners']:
        positions=owner['worldPositions']
        out={'key':owner['key'],'name':owner['name'],'uuid':owner['uuid'],'required':[],
             'exposed':{p['name']:[] for p in planes},'cut':[],'degenerate':[],
             'sourceTriangles':len(owner['triangles']),'sourceVertices':len(positions)}
        source_area=required_area=exposed_area=0.
        distances=[[math.fsum(p['normal'][i]*(v[i]-p['origin'][i]) for i in range(3)) for v in positions] for p in planes]
        if not all(math.isfinite(x) for ds in distances for x in ds): raise ValueError('Nonfinite plane operands')
        for tid,ids in enumerate(owner['triangles']):
            if ledger['owners'][len(result['owners'])]['triangleIDs'][tid]!=tid: raise ValueError('Remapped source IDs')
            pts=[positions[v] for v in ids]
            def world(b): return [math.fsum(b[j]*pts[j][i] for j in range(3)) for i in range(3)]
            def area(poly):
                if len(poly)<3: return 0.
                vs=[world(b) for b in poly]; a=vs[0]; terms=[]
                for j in range(1,len(vs)-1):
                    u=[vs[j][i]-a[i] for i in range(3)];v=[vs[j+1][i]-a[i] for i in range(3)]
                    cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
                    terms.append(.5*math.hypot(*cross))
                return math.fsum(terms)
            original=[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]]
            original_area=area(original);source_area+=original_area
            if original_area==0.:
                out['degenerate'].append(tid);total+=1;continue
            remaining=original; exterior=[]; traces=[]
            for pi,plane in enumerate(planes):
                ds=[distances[pi][v] for v in ids]
                def signed(b): return math.fsum(b[j]*ds[j] for j in range(3))
                def intersection(a,b,da,db):
                    global shared_error
                    zero=[j for j in range(3) if a[j]==0. and b[j]==0.]
                    if len(zero)==1:
                        inds=sorted([j for j in range(3) if j!=zero[0]],key=lambda j:ids[j])
                        lo,hi=inds; t=ds[lo]/(ds[lo]-ds[hi]); c=[0.,0.,0.];c[lo]=1.-t;c[hi]=t
                        key=(owner['uuid'],ids[lo],ids[hi],plane['name'])
                        witness={'edge':[ids[lo],ids[hi]],'plane':plane['name'],'t':t,'world':world(c)}
                        if key in shared:
                            error=max(abs(witness['world'][i]-shared[key]['world'][i]) for i in range(3))
                            shared_error=max(shared_error,error)
                            if witness['t']!=shared[key]['t'] or error>policy['sharedEdgeMetres']: raise ValueError('Shared edge cut mismatch')
                        else: shared[key]=witness
                        return c
                    t=da/(da-db)
                    return [a[j]+t*(b[j]-a[j]) for j in range(3)]
                def clipped(poly,inside):
                    output=[]
                    if not poly: return output
                    for j,b in enumerate(poly):
                        a=poly[j-1];da,db=signed(a),signed(b)
                        ina=da>=0. if inside else da<=0.;inb=db>=0. if inside else db<=0.
                        if ina!=inb: output.append(intersection(a,b,da,db))
                        if inb: output.append(b)
                    return clean(output)
                if not remaining: break
                values=[signed(b) for b in remaining]
                if all(v>=0. for v in values): continue
                if all(v<=0. for v in values):
                    exterior.append({'reason':plane['name'],'polygon':remaining});remaining=[];break
                inside=clipped(remaining,True); outside=clipped(remaining,False)
                edge=clean([b for b in inside if abs(signed(b))<=policy['tracePlaneMetres']])
                if len(edge)>=2: traces.append({'plane':plane['name'],'polygon':edge})
                if area(outside)>0.: exterior.append({'reason':plane['name'],'polygon':outside})
                remaining=inside if area(inside)>0. else []
            ra=area(remaining); ea=math.fsum(area(e['polygon']) for e in exterior)
            error=abs(original_area-ra-ea);max_error=max(max_error,error)
            if not math.isfinite(error) or error>policy['areaErrorSquareMetres']: raise ValueError('Partition area loss')
            if owner['key']=='bra' and exterior: raise ValueError('Bra exposure: '+str(tid))
            required_area+=ra;exposed_area+=ea
            if remaining==original and not exterior: out['required'].append(tid)
            elif not remaining and len(exterior)==1 and exterior[0]['polygon']==original:
                out['exposed'][exterior[0]['reason']].append(tid)
            else: out['cut'].append({'id':tid,'required':remaining,'exposed':exterior,'traces':traces,'areaError':error})
            total+=1
        out['areaSquareMetres']={'source':source_area,'required':required_area,'exposed':exposed_area}
        result['owners'].append(out);write('PARTIAL.json',result)
    if len(result['owners'])!=9 or total!=71512: raise ValueError('Incomplete original owners/IDs')
    result.update({'status':'complete','triangleCount':total,'maximumAreaErrorSquareMetres':max_error,
                   'sharedEdgeWitnesses':list(shared.values()),'maximumSharedEdgeErrorMetres':shared_error})
    write('PARTITION.json',result)
    rows=['# Original source coverage intent','','This partitions source triangles; no garment coverage or fit is measured.','',
          '| Source owner | Whole required | Whole exposed | Cut triangles | Zero-area originals |','|---|---:|---:|---:|---:|']
    for m in result['owners']:
        rows.append('| '+m['key']+'/'+m['name']+' | '+str(len(m['required']))+' | '+str(sum(map(len,m['exposed'].values())))+' | '+str(len(m['cut']))+' | '+str(len(m['degenerate']))+' |')
    rows+=['',f'Maximum per-triangle area residual: {max_error:.6g}m². Shared original-edge cut residual: {shared_error:.6g}m.',
           '', 'All original bra triangles are required. Degenerate zero-area originals retain IDs without a positive-area responsibility; they are not omitted. Boundary traces do not establish garment opening loops.',
           '', 'Planes, full exposed reasons and barycentric cut fragments are retained in PARTITION.json.']
    (HERE/'WORKSHEET.md').write_text('\n'.join(rows)+'\n')
    job['status']='complete'
except Exception as e:
    job.update({'status':'refused','error':str(e)})
finally:
    job['finished']=now();write('JOB.json',job);print(json.dumps(job));
if job['status']!='complete':sys.exit(1)
