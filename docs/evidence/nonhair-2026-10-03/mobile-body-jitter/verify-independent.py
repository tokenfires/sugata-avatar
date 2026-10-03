"""Independent scalar skin/projection and strict triangle/rectangle SAT helpers.
This file does not run a browser or change an avatar. The packet entry follows
only after the fixed observer schema is independently reviewed.
"""
import datetime, hashlib, json, math, os, pathlib, struct, sys

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def mv(matrix, vector):
    return [sum(matrix[row + 4*col] * vector[col] for col in range(4)) for row in range(4)]

def mm(a, b):
    return [sum(a[row+4*k] * b[k+4*col] for k in range(4)) for col in range(4) for row in range(4)]

def point(matrix, xyz):
    result = mv(matrix, [*xyz, 1.0])
    assert result[3] != 0
    return [c / result[3] for c in result[:3]]

def posed(mesh, vertex):
    base = vertex['base'][:3]
    xyz = base.copy()
    for morph in vertex['morphs']:
        delta = morph['value'][:3]
        if not mesh['morphTargetsRelative']:
            delta = [delta[k] - base[k] for k in range(3)]
        xyz = [xyz[k] + morph['weight'] * delta[k] for k in range(3)]
    bound = mv(mesh['bindMatrix'], [*xyz, 1.0])
    skinned = [0.0, 0.0, 0.0]
    for joint, weight in zip(vertex['skinIndex'], vertex['skinWeight']):
        if weight:
            bone = mesh['bones'][int(joint)]
            value = mv(mm(bone['matrixWorld'], bone['inverse']), bound)
            skinned = [skinned[k] + weight*value[k] for k in range(3)]
    # Three's Vector3 LBS retains xyz and applies bindInverse with implicitw1.
    local = point(mesh['bindMatrixInverse'], skinned)
    return local, point(mesh['matrixWorld'], local)

def project(world, camera, projection, css):
    view = mv(camera['matrixWorldInverse'], [*world, 1.0])
    clip = mv(projection, view)
    assert all(math.isfinite(v) for v in clip) and clip[3] > 0
    assert (0 if camera['coordinateSystem'] == 2001 else -clip[3]) <= clip[2] <= clip[3]
    ndc = [v/clip[3] for v in clip[:3]]
    return view, clip, ndc, [(ndc[0]+1)*css['width']/2, (1-ndc[1])*css['height']/2]

def overlap_sat(triangle, rectangle):
    """Positive-area intersection via separating axes, unlike polygon clipping."""
    if rectangle['width'] <= 0 or rectangle['height'] <= 0:
        return False
    a, b, c = triangle
    if (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) == 0:
        return False
    x, y, w, h = (rectangle[k] for k in ('x','y','width','height'))
    corners = [(x,y),(x+w,y),(x+w,y+h),(x,y+h)]
    axes = [(1.0,0.0),(0.0,1.0)]
    for p,q in zip(triangle, triangle[1:]+triangle[:1]):
        axes.append((p[1]-q[1], q[0]-p[0]))
    for nx,ny in axes:
        if nx == 0 and ny == 0:
            continue
        left = [nx*p[0]+ny*p[1] for p in triangle]
        right = [nx*p[0]+ny*p[1] for p in corners]
        if max(left) <= min(right) or max(right) <= min(left):
            return False
    return True

def error(a,b):
    assert len(a)==len(b)
    return max((abs(x-y) for x,y in zip(a,b)), default=0.0)

def main():
    started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    root=pathlib.Path(__file__).resolve().parents[4]
    packet=root/'captures/mobile-body-jitter-2026-10-03-v1'
    path=packet/'report.json'
    report=json.loads(path.read_text())
    for name,pin in report['sources'].items(): assert digest(root/name)==pin,name
    for name,pin in report['dependencies'].items(): assert digest(root/name)==pin,name
    for asset in report['assets']: assert digest(root/asset['file'])==asset['sha256']==report['sources'][asset['file']]
    assert digest(root/'tools/critic/mobile-body-jitter.mjs')==digest(packet/'instrument.mjs')==report['instrumentSHA256']
    images=[]
    for image in report['images']:
        data=(packet/image['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==image['sha256']
        dimensions=list(struct.unpack('>II',data[16:24]))
        assert dimensions==image['size']
        images.append({'file':image['file'],'sha256':image['sha256'],'dimensions':dimensions})
    assert report['finished']<report['hardStop'] and report['finalPinsUnchanged']
    assert report['cleanup']=={'page':'closed','browser':'closed'}
    if report['status']!='observed':
        print(json.dumps({'status':'verified-partial-refusal','reportSHA256':digest(path),'errors':report['errors'],'pass':report.get('pass'),'images':images,'scope':'No completed baseline qualification.'},indent=2));return
    assert report['errors']==[] and len(images)==2
    assert report['backend']['isWebGPUBackend'] and report['backend']['stats']['temporalAA']=='taau'
    assert report['retirement']['disposed'] and not report['retirement']['leaked']
    sample=report['sample'];before=sample['before'];final=report['finalState']
    assert before==sample['after']
    for state in (before,final):
        assert state['paused']=='true' and state['camera']['viewEnabled'] is False
    def effective(state):
        clone=json.loads(json.dumps(state));del clone['camera']['view'];return clone
    assert effective(before)==effective(final)
    passage=report['pass'];p=passage['records']['begin'];assert passage['primaryError'] is None
    assert p==passage['records']['end'] and p['coordinateSystem']==2001
    assert passage['records']['finish']['passes']==passage['records']['finish']['completedPasses']==1
    assert p['nominal']==before['camera']['projection']
    assert p['aspect']==before['camera']['aspect'] and p['view']['enabled']
    assert [p['view'][k] for k in ('fullWidth','fullHeight','width','height')]==p['input']*2
    assert not passage['afterView']['enabled']
    assert passage['afterTemporal']['jitterIndex']==(passage['beforeTemporal']['jitterIndex']+1)%31
    css=before['canvas']['css'];camera={**before['camera'],'matrixWorldInverse':p['inverse']}
    bound=[.5*css[k]/p['input'][i] for i,k in enumerate(('width','height'))]
    assert error(bound,report['jitter']['boundCSS'])==0
    def halton(n,b):
        f=1.;r=0.
        while n:f/=b;r+=f*(n%b);n//=b
        return r
    table=[[halton(i+1,2)-.5,halton(i+1,3)-.5] for i in range(32)]
    assert table==report['jitter']['table']
    offset=[p['view']['offsetX'],p['view']['offsetY']]
    assert offset==table[p['temporal']['jitterIndex']]==report['jitter']['offsetInput']
    assert all(abs(v)<.5 for v in offset)
    expectedShift=[-offset[i]*css[k]/p['input'][i] for i,k in enumerate(('width','height'))]
    overlays={o['selector']:{'x':o['rect']['x']-css['x'],'y':o['rect']['y']-css['y'],'width':o['rect']['width'],'height':o['rect']['height']} for o in before['overlays'] if o['shown'] and o['rect']['width']>0 and o['rect']['height']>0}
    maximum={'local':0.,'world':0.,'clip':0.,'ndc':0.,'css':0.,'shift':0.,'edge':0.}
    results=[];totalVertices=0;totalTriangles=0
    finals={m['uuid']:m for m in report['finalGeometryState']}
    for mesh in sample['meshes']:
        coverage=next(c for c in report['coverage'] if c['owner']==mesh['owner'])
        assert finals[mesh['uuid']]['matrixWorld']==mesh['matrixWorld']
        assert finals[mesh['uuid']]['bones']==[b['matrixWorld'] for b in mesh['bones']]
        assert [{'weight':w,'i':i} for i,w in enumerate(finals[mesh['uuid']]['morphs']) if w]==[{'weight':m['weight'],'i':m['i']} for m in mesh['morphs']]
        by={'nominal':{},'actual':{}};mins={k:{edge:math.inf for edge in ('left','right','top','bottom')} for k in by}
        for vertex in mesh['vertices']:
            local,world=posed(mesh,vertex)
            maximum['local']=max(maximum['local'],error(local,vertex['local']))
            maximum['world']=max(maximum['world'],error(world,vertex['world']))
            for name,P in [('nominal',p['nominal']),('actual',p['projection'])]:
                view,clip,ndc,pixel=project(world,camera,P,css)
                recorded=vertex['projections'][name]
                for label,value in [('clip',clip),('ndc',ndc),('css',pixel)]:maximum[label]=max(maximum[label],error(value,recorded[label]))
                assert error([pixel[0]+css['x'],pixel[1]+css['y']],recorded['cssGlobal'])<1e-9
                assert error([pixel[i]*before['canvas']['buffer'][i]/css[k] for i,k in enumerate(('width','height'))],recorded['buffer'])<1e-9
                by[name][vertex['id']]=pixel
                for edge,distance in {'left':pixel[0],'right':css['width']-pixel[0],'top':pixel[1],'bottom':css['height']-pixel[1]}.items():mins[name][edge]=min(mins[name][edge],distance)
            delta=[by['actual'][vertex['id']][i]-by['nominal'][vertex['id']][i] for i in range(2)]
            maximum['shift']=max(maximum['shift'],error(delta,expectedShift))
            assert all(abs(delta[i])<=bound[i]+1e-9 for i in range(2))
        active=set(v['id'] for v in mesh['vertices']);assert active==set(i for t in mesh['triangles'] for i in t['ids'])
        start=mesh['drawRange']['start'];end=min(mesh['indexCount'],start+(mesh['drawRange']['count'] if mesh['drawRange']['count']!='Infinity' else mesh['indexCount']))
        assert all(start<=t['offset'] and t['offset']+3<=end and t['offset']%3==0 for t in mesh['triangles'])
        lost={k:[] for k in ('nominal','actual','robust')};hits={selector:{k:[] for k in ('nominal','actual','robust','possible')} for selector in overlays}
        for triangle in mesh['triangles']:
            for name in ('nominal','actual'):
                if any(not(0<=by[name][i][0]<=css['width'] and 0<=by[name][i][1]<=css['height']) for i in triangle['ids']):lost[name].append(triangle['offset'])
            if any(not(-bound[0]<=by['nominal'][i][0]<=css['width']+bound[0] and -bound[1]<=by['nominal'][i][1]<=css['height']+bound[1]) for i in triangle['ids']):lost['robust'].append(triangle['offset'])
            for selector,r in overlays.items():
                for name in ('nominal','actual','robust','possible'):
                    sign=1 if name=='robust' else -1 if name=='possible' else 0
                    rectangle={'x':r['x']+sign*bound[0],'y':r['y']+sign*bound[1],'width':r['width']-2*sign*bound[0],'height':r['height']-2*sign*bound[1]}
                    points=[by['actual' if name=='actual' else 'nominal'][i] for i in triangle['ids']]
                    if overlap_sat(points,rectangle):hits[selector][name].append(triangle['offset'])
        for name,offsets in lost.items():
            assert len(offsets)==coverage['lost'][name]['count'],(mesh['owner'],'lost',name,len(offsets),coverage['lost'][name]['count'])
            assert [w['offset'] for w in coverage['lost'][name]['witnesses']]==offsets[:8]
        for selector,sets in hits.items():
            for name,offsets in sets.items():
                assert len(offsets)==coverage['overlap'][selector][name]['count'],(mesh['owner'],selector,name,len(offsets),coverage['overlap'][selector][name]['count'])
                assert [w['offset'] for w in coverage['overlap'][selector][name]['witnesses']]==offsets[:8]
        for name in mins:
            for edge,distance in mins[name].items():
                reported=coverage['minEdgesCSS'][name][edge]
                if not mesh['vertices']:assert reported is None
                else:maximum['edge']=max(maximum['edge'],abs(reported-distance))
        contained=bool(mesh['vertices']) and all(distance>bound[0 if edge in ('left','right') else 1] for edge,distance in mins['nominal'].items())
        assert contained==coverage['containedForEnvelope']
        totalVertices+=len(mesh['vertices']);totalTriangles+=len(mesh['triangles'])
        results.append({'owner':mesh['owner'],'vertices':len(mesh['vertices']),'triangles':len(mesh['triangles']),'lost':{k:len(v) for k,v in lost.items()},'overlap':{selector:{k:len(v) for k,v in sets.items()} for selector,sets in hits.items()},'minEdgesCSS':{k:{edge:(None if not mesh['vertices'] else value) for edge,value in distances.items()} for k,distances in mins.items()},'containedForEnvelope':contained})
    assert maximum['local']<1e-12 and maximum['world']<1e-12
    assert all(maximum[k]<1e-9 for k in ('clip','ndc','css','shift','edge'))
    print(json.dumps({'status':'verified-recorded-support','reportSHA256':digest(path),'instrumentSHA256':report['instrumentSHA256'],'verifierSHA256':digest(pathlib.Path(__file__)),'pins':{'sources':len(report['sources']),'dependencies':len(report['dependencies']),'servedGLBs':len(report['assets'])},'images':images,'vertices':totalVertices,'triangles':totalTriangles,'maximumDiscrepancy':maximum,'jitter':{'input':p['input'],'boundCSS':bound,'offsetInput':offset,'expectedShiftCSS':expectedShift},'results':results,'scope':'Recorded accessor inputs independently reproduce LBS/world/projection; strict separating-axis intersection agrees with polygon clipping. No shader/raster/physical visibility or all-pose acceptance.','execution':{'command':'python3 docs/evidence/nonhair-2026-10-03/mobile-body-jitter/verify-independent.py > docs/evidence/nonhair-2026-10-03/mobile-body-jitter/independent.json','interpreter':sys.executable,'version':sys.version.split()[0],'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat()}},indent=2))

if __name__=='__main__':main()
