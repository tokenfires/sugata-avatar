"""One saved-only review. No producer/root checker/Three import or asset decode."""
import collections, datetime, hashlib, json, math, os, pathlib, struct, sys, traceback

ROOT = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
BASE = ROOT / 'docs/evidence/appearance-2026-10-04/sweater-coverage-owned'
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda b: hashlib.sha256(b).hexdigest()
out = {'pid': os.getpid(), 'started': now(), 'status': 'reviewing',
       'method': 'Saved barycentric source fragments -> IEEE Float32; scalar unindexed normal formula; rigid camera inverse; JPEG SOF. No clipping/producer/engine/root-checker replay.',
       'bindings': [], 'groups': [], 'maximumInvocations': 1}

def bind(path):
    p = pathlib.Path(path)
    if not p.is_absolute(): p = ROOT / p
    b = p.read_bytes()
    row = {'path': str(p.relative_to(ROOT)), 'bytes': len(b), 'sha256': sha(b)}
    if row not in out['bindings']: out['bindings'].append(row)
    return b

def load(path): return json.loads(bind(path))
def check_pin(row):
    b = bind(row['path'])
    assert len(b) == row['bytes'] and sha(b) == row['sha256'], row['path']
def packed(values): return struct.pack('<' + 'f' * len(values), *values)
def f32(v): return struct.unpack('<f', struct.pack('<f', v))[0]

def jpeg_size(data):
    assert data[:2] == b'\xff\xd8' and data[-2:] == b'\xff\xd9'
    i = 2
    while i < len(data):
        assert data[i] == 255
        while data[i] == 255: i += 1
        marker = data[i]; i += 1
        length = int.from_bytes(data[i:i+2], 'big')
        if marker in (192,193,194,195,197,198,199,201,202,203,205,206,207):
            return [int.from_bytes(data[i+5:i+7], 'big'), int.from_bytes(data[i+3:i+5], 'big')]
        i += length
    raise AssertionError('JPEG SOF missing')

try:
    sources = load(BASE / 'SOURCE-INPUTS.json')['sources']
    originals = load(BASE / 'INPUTS.json')['inputs']
    for row in sources + originals: check_pin(row)
    out['sourcePinCount'], out['originalPinCount'] = len(sources), len(originals)
    # Pin the qualified independent partition review; its calculation is not rerun here.
    for n in ('DATA-RESULT.md', 'DATA-RECEIPT.json', 'CRITIC-DATA.json', 'critic-partition.py',
              'PLAN.md', 'POLICY.json', 'viewer.mjs', 'index.html'):
        bind(BASE/n)
    bind(ROOT/'node_modules/three/src/core/BufferGeometry.js')
    bind(ROOT/'node_modules/three/src/math/Vector3.js')
    ledger = load(ROOT/'docs/evidence/appearance-2026-10-04/original-surface-ledger/LEDGER.json')
    part = load(BASE/'PARTITION.json'); obs = load(BASE/'OBSERVATIONS.json')
    manifest = load(BASE/'NATIVE-INPUTS.json'); job = load(BASE/'NATIVE-JOB.json')
    console = load(BASE/'CONSOLE.json'); admission = load(BASE/'ROOT-NATIVE-ADMISSION.json')
    assert part['status'] == 'complete' and len(ledger['owners']) == len(part['owners']) == 9
    assert ledger['vertexCount'] == 39546 and part['triangleCount'] == 71512
    assert obs['planes'] == part['planes'] and obs['bounds'] == ledger['bounds']
    assert obs['threeRevision'] == '185' and obs['status'] == 'ready' and 'error' not in obs
    for key, row in manifest.items():
        actual = obs['inputs'][0 if key == 'ledger' else 1]
        assert all(actual[k] == v for k,v in row.items())
        assert actual['status'] == 200 and actual['observedBytes'] == row['bytes'] and actual['observedSHA256'] == row['sha256']
    identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
    colors = {'body': {'required': 0x91bad1, 'exposed': 0xbea087},
              'bra': {'required': 0x178fa8, 'exposed': 0xd55e69},
              'briefs': {'required': 0x697eaf, 'exposed': 0x8767aa}}
    buffers, boundary, gi = [], [], 0
    for oi, (owner,p) in enumerate(zip(ledger['owners'],part['owners'])):
        assert owner['uuid'] == p['uuid'] and owner['key'] == p['key'] and owner['name'] == p['name']
        assert p['sourceTriangles'] == len(owner['triangles'])
        row = obs['owners'][oi]
        assert row == {k:p[k] for k in ('uuid','key','name','sourceTriangles')} | {
            'wholeRequired':len(p['required']), 'wholeExposed':{k:len(v) for k,v in p['exposed'].items()},
            'cut':len(p['cut']), 'degenerate':len(p['degenerate'])}
        arrays = {'required': [], 'exposed': []}; ids = []
        def point(tid,b):
            coords = [owner['worldPositions'][v] for v in owner['triangles'][tid]]
            return [((0.0 + b[0]*coords[0][k]) + b[1]*coords[1][k]) + b[2]*coords[2][k] for k in range(3)]
        def append(tid,poly,kind):
            q = [point(tid,b) for b in poly]
            for j in range(1,len(q)-1):
                for x in (q[0],q[j],q[j+1]): arrays[kind].extend(x)
        unit = [[1,0,0],[0,1,0],[0,0,1]]
        for tid in p['required']: ids.append(tid); append(tid,unit,'required')
        for values in p['exposed'].values():
            for tid in values: ids.append(tid); append(tid,unit,'exposed')
        for c in p['cut']:
            ids.append(c['id']); append(c['id'],c['required'],'required')
            for e in c['exposed']: append(c['id'],e['polygon'],'exposed')
            if owner['key'] == 'body' and owner['name'] == 'Human':
                for trace in c['traces']:
                    for j in range(1,len(trace['polygon'])):
                        boundary.extend(point(c['id'],trace['polygon'][j-1])); boundary.extend(point(c['id'],trace['polygon'][j]))
        for tid in p['degenerate']: ids.append(tid); append(tid,unit,'exposed')
        assert sorted(ids) == list(range(p['sourceTriangles']))
        for kind,values in arrays.items():
            if not values: continue
            pb = packed(values); a = struct.unpack('<'+'f'*len(values),pb)
            normals = []
            for t in range(0,len(a),9):
                A,B,C = a[t:t+3],a[t+3:t+6],a[t+6:t+9]
                cb = [C[k]-B[k] for k in range(3)]; ab = [A[k]-B[k] for k in range(3)]
                cross = [f32(cb[1]*ab[2]-cb[2]*ab[1]), f32(cb[2]*ab[0]-cb[0]*ab[2]), f32(cb[0]*ab[1]-cb[1]*ab[0])]
                length = math.sqrt(cross[0]*cross[0]+cross[1]*cross[1]+cross[2]*cross[2])
                multiplier = 1/(length or 1)
                n = [f32(x*multiplier) for x in cross]
                normals.extend(n*3)
            nb = packed(normals); g = obs['groups'][gi]; gi += 1
            assert all(g[k] == p[k] for k in ('uuid','key','name')) and g['kind'] == kind
            assert g['vertices'] == len(a)//3 and g['triangles'] == len(a)//9
            assert g['positionsSHA256'] == sha(pb) and g['normalsSHA256'] == sha(nb), (p['name'],kind,'buffer')
            assert g['matrix'] == identity and g['side'] == 2 and g['color'] == colors[p['key']][kind]
            out['groups'].append({'uuid':p['uuid'],'kind':kind,'vertices':len(a)//3,'triangles':len(a)//9,
                                  'positionsSHA256':sha(pb),'normalsSHA256':sha(nb)})
            buffers.append(a)
    assert gi == len(obs['groups']) == 11
    assert obs['boundary']['positionsSHA256'] == sha(packed(boundary))
    assert len(boundary)//6 == obs['boundary']['segments'] == 268 and obs['boundary']['depthTest'] is False
    out['boundarySegments'] = 268
    # Independently invert the rigid camera frame using its transpose, then project.
    clip_error = 0.0
    for ci,c in enumerate(obs['cameras']):
        w,P = c['world'],c['projection']; lo,hi = [math.inf]*3,[-math.inf]*3; count = 0
        assert w[12:15] == c['position'] and c['target'] == obs['cameras'][0]['target']
        for buf in buffers:
            for i in range(0,len(buf),3):
                d = [buf[i+k]-w[12+k] for k in range(3)]
                v = [math.fsum(w[4*j+k]*d[k] for k in range(3)) for j in range(3)]
                z = [P[0]*v[0]+P[12],P[5]*v[1]+P[13],P[10]*v[2]+P[14]]
                assert abs(z[0]) <= .97 and abs(z[1]) <= .97 and -1 <= z[2] <= 1
                for k in range(3): lo[k] = min(lo[k],z[k]); hi[k] = max(hi[k],z[k])
                count += 1
        old = obs['clip'][ci]
        assert old['pass'] is True and old['count'] == count == 217170
        clip_error = max(clip_error,*[abs(lo[k]-old['min'][k]) for k in range(3)],*[abs(hi[k]-old['max'][k]) for k in range(3)])
    assert clip_error < 1e-13
    out['maximumClipReplayError'] = clip_error
    center = [(ledger['bounds']['min'][k]+ledger['bounds']['max'][k])*.5 for k in range(3)]
    size = [ledger['bounds']['max'][k]-ledger['bounds']['min'][k] for k in range(3)]
    framing = obs['framing']; assert framing['width'] == 1240 and framing['height'] == 560
    assert framing['sourceVertexCount'] == 39546 and framing['panelAspect'] == (1240//2)/560
    assert abs(framing['half']-.6*max(size[1],math.hypot(size[0],size[2])/framing['panelAspect'])) < 1e-15
    assert framing['eye'] == 3*max(size) and obs['cameras'][0]['target'] == center
    assert [d['cameraIndices'] for d in obs['draws']] == [[0,1],[0,2]]
    assert [d['mode'] for d in obs['draws']] == ['Front/Back','Front/Oblique']
    assert job['maximumCreations'] == job['maximumReadyWaits'] == 1 and job['tabId'] == '31' and job['ready']
    assert admission['utc'] < job['creationStarted'] < job['creationReturned'] < job['readyWaitReturned']
    for capture,draw in zip(job['captures'],obs['draws']):
        assert capture['mode'] == draw['mode'] and draw['utc'] < capture['started'] < capture['returned'] < job['cutoff']
        b = bind(BASE/capture['name']); assert len(b) == capture['bytes'] and jpeg_size(b) == [1280,859]
    assert obs['finished'] < job['observationsSaved'] < job['closed'] and obs['cleanupReason'] == 'explicit Finish'
    assert job['baselineTabs'] == job['tabsAfter'] and [x['id'] for x in job['tabsAfter']] == ['1','24','25','26','27','28']
    assert len(obs['disposals']) == 25 and all(x.get('attempted') and x.get('returned') and 'error' not in x for x in obs['disposals'])
    assert collections.Counter(x['type'] for x in obs['disposals']) == {'BufferGeometry':12,'MeshStandardMaterial':11,'LineBasicMaterial':1,'WebGLRenderer':1}
    assert console['limit'] == 20 and console['entries'] == [] and console['exhaustive'] is False
    out.update(status='pass', originalOwnerCount=9, sourceTriangleCount=71512, groupsCount=11,
               drawVertexCount=217170, disposalsReturned=25, jpegDimensions=[1280,859],
               baselineTabIds=['1','24','25','26','27','28'], noSourceAssetProducerEngineOrRootCheckerExecuted=True)
except BaseException as e:
    out['status'] = 'refused'; out['error'] = repr(e); out['traceback'] = traceback.format_exc()
finally:
    out['completed'] = now()
    (BASE/'CRITIC-NATIVE.json').write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps(out))
sys.exit(0 if out['status']=='pass' else 1)
