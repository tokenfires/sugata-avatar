"""Independent saved-guide check; does not import or invoke build.py."""
from pathlib import Path
import json, hashlib, math, datetime
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
def vector_area(poly):
    out = [0., 0., 0.]
    if len(poly) < 3: return out
    for i in range(1, len(poly)-1):
        u = [poly[i][k]-poly[0][k] for k in range(3)]
        v = [poly[i+1][k]-poly[0][k] for k in range(3)]
        cross = (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        for k in range(3):out[k] += cross[k]/2
    return out
def norm(v): return math.sqrt(sum(x*x for x in v))
def same(a,b,tol=1e-12): return len(a)==len(b) and max((abs(x-y) for x,y in zip(a,b)),default=0)<=tol
def main():
    raw=(HERE/'guide.json').read_bytes();g=json.loads(raw);s=(ROOT/g['ledger']['path']).read_bytes()
    assert hashlib.sha256(s).hexdigest()==g['ledger']['sha256']=='d221466f48a076c040eef267d9d069c82dca2c0062ba466217ba247138939f5e'
    assert len(s)==g['ledger']['bytes'];ledger=json.loads(s);assert len(g['owners'])==9
    for o,orig in zip(g['owners'],ledger['owners']):
        assert o['positions']==orig['worldPositions']
        for k in ['key','name','association','vertexIDs','triangleIDs','triangles']:assert o[k]==orig[k]
    cut=g['plane']['metres'];assert cut==.28 and g['plane']['coplanar']=='below only'
    seen=set();area_error=0.;side_area={'-X':0.,'+X':0.};degenerate=0;crossing=set();expected_edges={};record_by_id={}
    obj_vertices=[];obj_faces=[];obj_lines=[]
    for r in g['records']:
        key=(r['owner'],r['triangle']);assert key not in seen;seen.add(key);record_by_id[key]=r
        owner=g['owners'][r['owner']];indices=owner['triangles'][r['triangle']];original=[owner['positions'][i] for i in indices]
        va=vector_area(original);a=norm(va);assert a==r['area'];assert r['degenerate']==(a==0)
        degenerate+=int(a==0)
        for i in range(3):
            j=(i+1)%3;pa,pb=original[i],original[j]
            if (pa[1]-cut)*(pb[1]-cut)<0:
                lo,hi=sorted((indices[i],indices[j]));pl,ph=owner['positions'][lo],owner['positions'][hi]
                t=(cut-pl[1])/(ph[1]-pl[1]);p=[(1-t)*pl[k]+t*ph[k] for k in range(3)]
                expected_edges[(r['owner'],lo,hi)]=(t,p)
        expected={'below':[], 'above':[]}
        if a>0:
            for which in expected:
                low=which=='below'
                if all(p[1]==cut for p in original):
                    expected[which]=original[:] if low else [];continue
                # Independent set of convex intersection vertices, not producer traversal.
                for p in original:
                    if (p[1]<=cut if low else p[1]>=cut):expected[which].append(p)
                for i in range(3):
                    j=(i+1)%3;pa,pb=original[i],original[j]
                    if (pa[1]-cut)*(pb[1]-cut)<0:
                        lo,hi=sorted((indices[i],indices[j]));pl,ph=owner['positions'][lo],owner['positions'][hi]
                        t=(cut-pl[1])/(ph[1]-pl[1]);p=[(1-t)*pl[k]+t*ph[k] for k in range(3)]
                        expected[which].append(p);expected_edges[(r['owner'],lo,hi)]=(t,p)
                if len(expected[which])<3:expected[which]=[]
        sum_vector=[0.,0.,0.];sum_area=0.
        for which in ['below','above']:
            poly=r[which];assert len(poly)==len(expected[which]),(key,which)
            for v in poly:
                assert len(v['b'])==3 and len(v['p'])==3 and all(math.isfinite(x) for x in v['b']+v['p'])
                assert abs(sum(v['b'])-1)<=1e-12 and min(v['b'])>=-1e-12
                reconstructed=[sum(v['b'][i]*original[i][k] for i in range(3)) for k in range(3)]
                assert same(v['p'],reconstructed)
                assert any(same(v['p'],p) for p in expected[which])
                assert v['p'][1]<=cut+1e-12 if which=='below' else v['p'][1]>=cut-1e-12
                if 'edge' in v:
                    lo,hi=v['edge'];assert lo<hi and lo in indices and hi in indices
                    t=v['tFromLow'];assert 0<t<1
                    assert abs(v['b'][indices.index(lo)]-(1-t))<=1e-12 and abs(v['b'][indices.index(hi)]-t)<=1e-12
            if poly:
                assert all(any(same(p,v['p']) for v in poly) for p in expected[which])
                pv=vector_area([v['p'] for v in poly]);pa=norm(pv);assert pa>0
                assert sum(pv[k]*va[k] for k in range(3))>0
                sum_area+=pa
                for k in range(3):sum_vector[k]+=pv[k]
                if which=='below':
                    assert owner['key']=='body' and owner['name']=='Human'
                    side=r['belowSide'];assert side in side_area
                    assert all(v['p'][0]<0 for v in poly) if side=='-X' else all(v['p'][0]>0 for v in poly)
                    side_area[side]+=pa
                base=len(obj_vertices)+1;obj_vertices.extend(v['p'] for v in poly)
                obj_faces.extend([base,base+i,base+i+1] for i in range(1,len(poly)-1))
        if r['degenerate']:
            assert not r['below'] and not r['above'] and r['belowSide'] is None
            base=len(obj_vertices)+1;obj_vertices.extend(original);obj_faces.append([base,base+1,base+2])
        err=abs(a-sum_area);area_error=max(area_error,err);assert err<=max(1e-12,a*1e-9)
        assert same(va,sum_vector,max(1e-12,a*1e-9))
        if r['below'] and r['above']:crossing.add(key)
    assert seen=={(oi,ti) for oi,o in enumerate(ledger['owners']) for ti in o['triangleIDs']}
    actual_edges={}
    for e in g['crossingEdges']:
        lo,hi=e['edge'];key=(e['owner'],lo,hi);assert key not in actual_edges;actual_edges[key]=e
        t,p=expected_edges[key];assert abs(t-e['tFromLow'])<=1e-12 and same(p,e['p'])
    assert set(actual_edges)==set(expected_edges)
    trace_ids=set();side_traces={'-X':0,'+X':0}
    for tr in g['traces']:
        key=(tr['owner'],tr['triangle']);assert key in crossing and key not in trace_ids;trace_ids.add(key)
        assert len(tr['ends'])==2;side_traces[tr['side']]+=1
        r=record_by_id[key]
        assert tr['ends']==[v for v in r['below'] if abs(v['p'][1]-cut)<=1e-12]
        base=len(obj_vertices)+1;obj_vertices.extend(v['p'] for v in tr['ends']);obj_lines.append([base,base+1])
    assert trace_ids==crossing and all(x>0 for x in side_area.values()) and all(x>0 for x in side_traces.values())
    assert g['totals']=={'triangles':71512,'degenerate':degenerate,'crossing':len(crossing),'-X':sum(r['belowSide']=='-X' for r in g['records']),'+X':sum(r['belowSide']=='+X' for r in g['records'])}
    assert all(abs(g['sideAreaM2'][k]-v)<=1e-12 for k,v in side_area.items()) and g['sideTraceCount']==side_traces
    for kind,points in [('fullBounds',[p for o in g['owners'] for p in o['positions']]),('belowBounds',[v['p'] for r in g['records'] for v in r['below']])]:
        assert g[kind]=={'min':[min(p[k] for p in points) for k in range(3)],'max':[max(p[k] for p in points) for k in range(3)]}
    v=[];f=[];lines=[]
    for line in (HERE/'source-guide.obj').read_text().splitlines():
        fields=line.split()
        if fields and fields[0]=='v':v.append([float(x) for x in fields[1:]])
        elif fields and fields[0]=='f':f.append([int(x) for x in fields[1:]])
        elif fields and fields[0]=='l':lines.append([int(x) for x in fields[1:]])
    assert v==obj_vertices and f==obj_faces and lines==obj_lines
    result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'owners':9,'sourceVertices':39546,'originalTriangles':len(seen),'degenerate':degenerate,'crossingTriangles':len(crossing),'canonicalCrossingEdges':len(actual_edges),'maximumAreaErrorM2':area_error,'sideAreaM2':side_area,'sideTraceCount':side_traces,'objVertices':len(v),'objTriangles':len(f),'objLines':len(lines),'guideSHA256':hashlib.sha256(raw).hexdigest(),'limits':'Complete-source intent/partition/provenance/OBJ only; no manifold/anatomical/GPU/boot/enclosure/contact/fit/pose/motion acceptance'}
    (HERE/'CHECK.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
