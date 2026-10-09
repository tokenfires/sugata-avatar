"""One fixed evaluated-body section extraction. No bpy or garment construction."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import json, hashlib, datetime, os, math
from collections import defaultdict
import numpy as np
HERE = Path(__file__).resolve().parent
RESULT = {'started_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'sections': [], 'passed': False, 'garment_fit': 'UNKNOWN', 'appearance': 'NOT_TESTED'}
class Refusal(Exception):
    pass
def require(condition, message, witness=None):
    if not condition:
        RESULT['refusal'] = {'reason': message, 'witness': witness}
        raise Refusal(message)
def sha(a):
    return hashlib.sha256(a.tobytes()).hexdigest()
def verify_pins():
    for p in json.loads((HERE / 'INPUTS.json').read_text()):
        raw = Path(p['path']).read_bytes()
        require(len(raw) == p['bytes'] and hashlib.sha256(raw).hexdigest() == p['sha256'], 'Physical input changed', p['path'])
def cross(a,b):
    return a[...,0]*b[...,1] - a[...,1]*b[...,0]
def contour_checks(q, section, component):
    n = len(q)
    require(3 <= n <= 4096, 'Contour count outside fixed bounds', {'section': section, 'component': component, 'count': n})
    nextq = np.roll(q,-1,axis=0)
    require(abs(float(np.sum(cross(q,nextq))/2)) > 1e-12, 'Degenerate projected area', {'section':section,'component':component})
    pairs = n*(n-3)//2
    RESULT['self_intersection_pairs'] = RESULT.get('self_intersection_pairs',0)+pairs
    require(RESULT['self_intersection_pairs'] <= 1000000, 'Self-intersection pair budget exceeded')
    for i in range(n):
        js = np.arange(i+2,n)
        if i == 0:
            js = js[js != n-1]
        if not len(js):
            continue
        a,b = q[i],nextq[i]
        c,d = q[js],nextq[js]
        orient1,orient2 = cross(b-a,c-a),cross(b-a,d-a)
        orient3,orient4 = cross(d-c,a-c),cross(d-c,b-c)
        overlap = np.all(np.maximum(np.minimum(a,b),np.minimum(c,d)) <= np.minimum(np.maximum(a,b),np.maximum(c,d))+1e-12,axis=1)
        hit = overlap & (orient1*orient2 <= 0) & (orient3*orient4 <= 0)
        require(not hit.any(), 'Projected nonadjacent segments intersect', {'section':section,'component':component,'segment':i,'others':js[hit].tolist()})
    ab = nextq-q
    denom = np.sum(ab*ab,axis=1)
    require((denom>0).all(), 'Zero-length projected segment', {'section':section,'component':component})
    t = np.clip(-np.sum(q*ab,axis=1)/denom,0,1)
    closest = q+t[:,None]*ab
    mindistance = float(np.linalg.norm(closest,axis=1).min())
    require(mindistance > 1e-9, 'Station origin lies on contour boundary', {'section':section,'component':component,'distance':mindistance})
    candidates = (q[:,1]>0) != (nextq[:,1]>0)
    a,b = q[candidates], nextq[candidates]
    intercept = a[:,0] + (-a[:,1])*(b[:,0]-a[:,0])/(b[:,1]-a[:,1])
    inside = bool(np.count_nonzero(intercept>0)%2)
    return {'origin_inside': inside,'origin_boundary_distance':mindistance,'signed_area':float(np.sum(cross(q,nextq))/2),'max_radial_extent':float(np.linalg.norm(q,axis=1).max())}
def extract(world, triangles, station):
    s = dict(station)
    RESULT['sections'].append(s)
    origin,normal = np.asarray(s['origin'],float),np.asarray(s['normal'],float)
    require(np.isfinite(origin).all() and np.isfinite(normal).all() and abs(float(np.linalg.norm(normal))-1)<1e-12,'Invalid authored plane',s['name'])
    dist = (world-origin)@normal
    near = np.flatnonzero(np.abs(dist)<=1e-10)
    require(not len(near), 'Source vertex on plane', {'station':s['name'],'evaluated_vertex_ids':near.tolist(),'points':world[near].tolist()})
    td = dist[triangles]
    ids = np.flatnonzero((td.min(axis=1)<0)&(td.max(axis=1)>0))
    s['crossing_triangle_count'] = len(ids)
    require(len(ids)>0,'Plane has no source contour',s['name'])
    points,adj,segments = {},defaultdict(list),[]
    for ti in ids:
        tri = triangles[ti]
        edges=[]
        for j in range(3):
            a,b = sorted((int(tri[j]),int(tri[(j+1)%3])))
            if (dist[a]<0) != (dist[b]<0):
                e=(a,b); edges.append(e)
                if e not in points:
                    fraction=float(dist[a]/(dist[a]-dist[b]))
                    point = world[a]+fraction*(world[b]-world[a])
                    require(0<fraction<1 and np.isfinite(point).all(),'Invalid source edge crossing',{'edge':e,'triangle':int(ti)})
                    points[e]={'edge':list(e),'fraction':fraction,'point':point.tolist()}
        require(len(edges)==2 and edges[0]!=edges[1],'Degenerate crossing triangle',{'triangle':int(ti),'edges':edges})
        a,b=edges
        adj[a].append(b);adj[b].append(a)
        segments.append({'triangle':int(ti),'edges':[list(a),list(b)]})
    s['source_crossings'] = [points[e] for e in sorted(points)]
    s['source_segments'] = segments
    bad = {str(k):len(v) for k,v in adj.items() if len(v)!=2 or len(set(v))!=2}
    require(not bad,'Contour graph is not simple degree2',{'station':s['name'],'degrees':bad})
    axis=np.eye(3)[int(np.argmin(np.abs(normal)))];u=np.cross(axis,normal);u=u/np.linalg.norm(u);v=np.cross(normal,u)
    s['plane_basis']={'u':u.tolist(),'v':v.tolist()}
    remaining=set(points);loops=[]
    while remaining:
        start=min(remaining);route=[start];previous=start;current=min(adj[start])
        while current!=start:
            require(current in remaining and current not in route,'Repeated/disconnected contour node',{'station':s['name'],'edge':current})
            route.append(current)
            follow=[x for x in adj[current] if x!=previous]
            require(len(follow)==1,'Ambiguous next contour node',current)
            previous,current=current,follow[0]
        require(len(route)>=3 and route[-1] in adj[start],'Contour closure invalid',s['name'])
        remaining.difference_update(route)
        xyz=np.asarray([points[e]['point'] for e in route]);q=np.column_stack(((xyz-origin)@u,(xyz-origin)@v))
        record={'ordered_edges':[list(e) for e in route],'projected_points':q.tolist()}
        record.update(contour_checks(q,s['name'],len(loops)))
        loops.append(record)
    s['components']=loops
    selected=[i for i,x in enumerate(loops) if x['origin_inside']]
    require(len(selected)==1,'Origin does not select exactly one component',{'station':s['name'],'component_ids':selected})
    s['selected_component']=selected[0]
    extent=loops[selected[0]]['max_radial_extent']
    require(extent<=s['max_radial_extent'],'Selected contour exceeds artist association bound',{'station':s['name'],'component':selected[0],'extent':extent,'fixed_bound':s['max_radial_extent']})
    s['accepted_source_reference']=True
try:
    require(not (HERE/'RESULT.json').exists(),'Refuse duplicate output')
    verify_pins()
    pins=json.loads((HERE/'INPUTS.json').read_text())
    archive=next(Path(x['path']) for x in pins if x['path'].endswith('/after-geometry.npz'))
    require(archive.stat().st_size<=1048576,'Encoded archive bound')
    cold=json.loads(next(Path(x['path']).read_text() for x in pins if x['path'].endswith('/COLD.json')))
    expected=cold['geometry']['Human']
    with np.load(archive,allow_pickle=False) as data:
        require(data.files.count('Human_world')==1 and data.files.count('Human_triangles')==1,'Literal producer arrays absent or ambiguous',data.files)
        rawworld=data['Human_world'];triangles=data['Human_triangles']
    require(rawworld.shape==(13380,3) and rawworld.dtype==np.dtype('float32'),'World source domain/dtype mismatch')
    require(triangles.shape==(26756,3) and triangles.dtype==np.dtype('int32'),'Triangle source domain/dtype mismatch')
    require(sha(rawworld)==expected['world_sha256'] and sha(triangles)==expected['triangles_sha256'],'Exact COLD source arrays mismatch')
    require(np.isfinite(rawworld).all() and triangles.min()>=0 and triangles.max()<len(rawworld),'Finite indexed source')
    require(rawworld.min(axis=0).tolist()==expected['min'] and rawworld.max(axis=0).tolist()==expected['max'],'Source bounds mismatch')
    RESULT['source_arrays']={'world':{'name':'Human_world','dtype':str(rawworld.dtype),'shape':list(rawworld.shape),'sha256':sha(rawworld)},'triangles':{'name':'Human_triangles','dtype':str(triangles.dtype),'shape':list(triangles.shape),'sha256':sha(triangles)}}
    world=rawworld.astype(np.float64)
    distinct=(triangles[:,0]!=triangles[:,1]) & (triangles[:,1]!=triangles[:,2]) & (triangles[:,2]!=triangles[:,0])
    source_triangle_points=world[triangles]
    twice_area=np.linalg.norm(np.cross(source_triangle_points[:,1]-source_triangle_points[:,0],source_triangle_points[:,2]-source_triangle_points[:,0]),axis=1)
    invalid=np.flatnonzero(~distinct | ~np.isfinite(twice_area) | (twice_area<=0))
    require(not len(invalid),'Degenerate source triangle',None if not len(invalid) else {'first_evaluated_triangle_id':int(invalid[0]),'evaluated_vertex_ids':triangles[invalid[0]].tolist(),'points':source_triangle_points[invalid[0]].tolist(),'twice_area':float(twice_area[invalid[0]])})
    RESULT['source_triangle_eligibility']={'all_distinct_nonzero_area':True,'triangle_count':len(triangles),'minimum_twice_area':float(twice_area.min()),'minimum_triangle_id':int(twice_area.argmin()),'area_units':'native squared; numerical source eligibility only'}
    stations=json.loads((HERE/'STATIONS.json').read_text())['ordered_stations']
    require(len(stations)==10,'Ten fixed stations only')
    for station in stations:
        extract(world,triangles,station)
    RESULT['passed']=True
except Refusal as e:
    print('REFUSED:',str(e))
except Exception as e:
    RESULT['unexpected_error']={'type':type(e).__name__,'message':str(e)}
    print('ERROR:',str(e))
finally:
    try:
        verify_pins(); RESULT['post_pins_exact']=True
    except Exception as e:
        RESULT['post_pin_error']=str(e);RESULT['passed']=False
    RESULT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    encoded=json.dumps(RESULT,indent=2).encode()+b'\n'
    if len(encoded)>8388608:
        raise RuntimeError('8MiB output cap')
    with (HERE/'RESULT.json').open('xb') as f:f.write(encoded)
    print(json.dumps({'passed':RESULT['passed'],'sections_visited':len(RESULT['sections']),'bytes':len(encoded),'refusal':RESULT.get('refusal'),'unexpected_error':RESULT.get('unexpected_error')}))
    sys.exit(0 if RESULT['passed'] else 1)
