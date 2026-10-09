import datetime, hashlib, io, json, pathlib, sys
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
CFG = json.loads((HERE / 'EXEC.json').read_text())
R = {'passed': False, 'started': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'checks': [], 'observations': {}, 'arrays': []}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write_json(name, value):
    with (HERE / name).open('x') as f:
        json.dump(value, f, indent=2, allow_nan=False)
        f.write('\n')

def require(name, ok, witness=None):
    item = {'name': name, 'passed': bool(ok)}
    if witness is not None:
        item['witness'] = witness
    R['checks'].append(item)
    if not ok:
        raise RuntimeError(name)

def check_pins(stage):
    for p in CFG['pins']:
        b = pathlib.Path(p['path']).read_bytes()
        require(stage + ':' + p['path'], len(b) == p['bytes'] and digest(b) == p['sha256'])

def witness(faceid, v, tri, role, domain):
    return {'face': int(faceid), 'indices': tri[faceid].tolist(), 'vertices': v[tri[faceid]].tolist(), 'role': int(role[faceid]), 'domain': int(domain[faceid])}

def main():
    check_pins('before')
    require('first output paths', not any((HERE / n).exists() for n in ('RESULT.json','OBSERVED.json','targets.npz')))
    require('deadline', datetime.datetime.now(datetime.timezone.utc) < datetime.datetime.fromisoformat(CFG['finish_by']))
    d = json.loads((HERE / 'DOMAINS.json').read_text())
    req, exp = d['required'], d['exposed']
    gap_witnesses = []
    for a in req:
        for b in exp:
            axes = [i for i in range(3) if a['hi'][i] < b['lo'][i] or b['hi'][i] < a['lo'][i]]
            gap_witnesses.append({'required': a['id'], 'exposed': b['id'], 'separated_axes': axes})
            require('closed boxes disjoint:' + a['id'] + '/' + b['id'], bool(axes), gap_witnesses[-1])
    source = pathlib.Path(CFG['body_archive'])
    with np.load(source, allow_pickle=False) as z:
        raw_v = z['Human_world']
        raw_t = z['Human_triangles']
    R['observations']['source_members'] = {'world_dtype': str(raw_v.dtype), 'world_shape': list(raw_v.shape), 'world_sha256': digest(raw_v.tobytes(order='C')), 'tri_dtype': str(raw_t.dtype), 'tri_shape': list(raw_t.shape), 'tri_sha256': digest(raw_t.tobytes(order='C'))}
    require('world member', raw_v.dtype == np.dtype('<f4') and raw_v.shape == (13380,3) and digest(raw_v.tobytes(order='C')) == CFG['world_sha256'], R['observations']['source_members'])
    require('triangle member', raw_t.dtype == np.dtype('<i4') and raw_t.shape == (26756,3) and digest(raw_t.tobytes(order='C')) == CFG['tri_sha256'], R['observations']['source_members'])
    require('finite source world', np.isfinite(raw_v).all())
    bad = np.flatnonzero(((raw_t < 0) | (raw_t >= len(raw_v))).any(axis=1))
    require('all triangle indices', len(bad) == 0, {'first_bad_face': int(bad[0]) if len(bad) else None})
    v, tri = raw_v.astype(np.float64), raw_t.astype(np.int32, copy=True)
    ground, top = float(v[:,2].min()), float(v[:,2].max())
    h = top - ground
    require('positive finite source height', np.isfinite(h) and h > 0)
    src = json.loads(pathlib.Path(CFG['source_map']).read_text())
    require('stored identity frame', src['body_object']['matrix_world'] == [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]])
    require('source bounds exact', v.min(axis=0).tolist() == src['body_evaluated_geometry']['min'] and v.max(axis=0).tolist() == src['body_evaluated_geometry']['max'])
    normalized = v / h
    normalized[:,2] = (v[:,2] - ground) / h
    face_p = normalized[tri]
    def membership(boxes):
        return np.stack([((face_p >= np.asarray(b['lo'])) & (face_p <= np.asarray(b['hi']))).all(axis=2).all(axis=1) for b in boxes], axis=1)
    mr, me = membership(req), membership(exp)
    has_r, has_e = mr.any(axis=1), me.any(axis=1)
    dual = has_r & has_e
    labels = np.zeros(len(tri), dtype=np.uint8)
    labels[has_r & ~dual] = 1
    labels[has_e & ~dual] = 2
    domain = np.full(len(tri), -1, dtype=np.int16)
    domain[labels == 1] = mr[labels == 1].argmax(axis=1)
    domain[labels == 2] = me[labels == 2].argmax(axis=1) + len(req)
    ids = {name: np.flatnonzero(labels == code) for name, code in d['role_codes'].items()}
    selected = np.flatnonzero(labels > 0)
    sample_count = len(selected) * 4
    cross = np.cross(v[tri[:,1]] - v[tri[:,0]], v[tri[:,2]] - v[tri[:,0]])
    norm = np.linalg.norm(cross, axis=1)
    bad_area = np.flatnonzero(~np.isfinite(norm) | (norm <= 2e-12))
    obs = R['observations']
    obs.update({'source_height': h, 'ground': ground, 'counts': {k: len(x) for k,x in ids.items()}, 'contact_body_triangles': len(tri), 'domain_counts': {b['id']: int(np.count_nonzero(domain == i)) for i,b in enumerate(req+exp)}, 'dual_membership_count': int(np.count_nonzero(dual)), 'first_dual': witness(int(np.flatnonzero(dual)[0]),v,tri,labels,domain) if dual.any() else None, 'whole_face_witnesses': {k: [witness(int(f),v,tri,labels,domain) for f in arr[:2]] for k,arr in ids.items()}, 'target_count': sample_count, 'first_bad_area_face': int(bad_area[0]) if len(bad_area) else None, 'closed_box_gap_witnesses': gap_witnesses})
    write_json('OBSERVED.json', R)
    require('no actual dual membership', not dual.any(), obs['first_dual'])
    require('nonempty required/exposed/held', all(len(ids[k]) > 0 for k in ('REQUIRED','EXPOSED','HELD')), obs['counts'])
    require('all face roles partition', sum(len(x) for x in ids.values()) == len(tri))
    require('all source face areas', len(bad_area) == 0, {'first_bad_area_face': obs['first_bad_area_face'], 'double_area_limit': 2e-12})
    require('target cap', sample_count <= d['targets']['max_targets'], {'count': sample_count, 'cap': d['targets']['max_targets']})
    bary = np.asarray([[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]],dtype=np.float64)
    require('fixed barycentric operands', np.isfinite(bary).all() and (bary >= 0).all() and np.max(np.abs(bary.sum(axis=1)-1)) <= 1e-15)
    points = np.einsum('bj,fjk->fbk',bary,v[tri[selected]]).reshape((-1,3))
    normals = np.repeat((cross[selected] / norm[selected,None]),4,axis=0)
    face_ids = np.repeat(selected.astype(np.int32),4)
    bary_ids = np.tile(bary,(len(selected),1))
    target_role, target_domain = labels[face_ids], domain[face_ids]
    require('finite fixed source targets', np.isfinite(points).all() and np.isfinite(normals).all() and np.isfinite(bary_ids).all())
    require('unit geometric normals', np.max(np.abs(np.linalg.norm(normals,axis=1)-1)) <= 1e-12)
    arrays = {'face_role':labels,'face_domain':domain,'target_face':face_ids,'target_role':target_role,'target_domain':target_domain,'target_bary':bary_ids,'target_point':points,'target_normal':normals}
    for name,a in arrays.items():
        R['arrays'].append({'name':name,'dtype':str(a.dtype),'shape':list(a.shape),'raw_sha256':digest(a.tobytes(order='C'))})
    buf = io.BytesIO()
    np.savez_compressed(buf,**arrays)
    data = buf.getvalue()
    require('archive cap', len(data) <= 8*1024*1024, {'bytes':len(data),'cap':8*1024*1024})
    with (HERE/'targets.npz').open('xb') as f:
        f.write(data)
    R['output'] = {'path':str(HERE/'targets.npz'),'bytes':len(data),'sha256':digest(data)}
    R['limits'] = ['Source authored intent and four samples only','Not anatomical/full-surface/physical/pose/appearance qualification','All body faces retained for later contact','No candidate geometry read or evaluated']
    check_pins('after')
    require('finish deadline', datetime.datetime.now(datetime.timezone.utc) < datetime.datetime.fromisoformat(CFG['finish_by']))
    R['passed'] = True

try:
    main()
except Exception as e:
    R['error'] = {'type':type(e).__name__,'message':str(e)}
finally:
    R['finished'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if not (HERE/'OBSERVED.json').exists():
        write_json('OBSERVED.json',R)
    write_json('RESULT.json',R)
    print(json.dumps({'passed':R['passed'],'error':R.get('error'),'counts':R['observations'].get('counts'),'targets':R['observations'].get('target_count')}))
sys.exit(0 if R['passed'] else 1)
