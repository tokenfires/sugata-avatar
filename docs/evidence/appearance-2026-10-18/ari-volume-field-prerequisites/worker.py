"""One source-preflight worker; inert until main and saved root admission."""
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import struct
import sys
import time
import zipfile

import kernel as K


P = Path(__file__).resolve().parent
START = time.monotonic()
STAGE = 'startup'
RECORD = {'status': 'UNKNOWN', 'complete': False, 'source_members_decoded': 0,
          'columns_scanned': 0, 'candidate_pairs_tested': 0, 'axis_records': []}


class BoundedUnknown(Exception):
    pass


def budget():
    if time.monotonic() - START > 110:
        raise BoundedUnknown('110-second internal wall budget')


def digest(b):
    return hashlib.sha256(b).hexdigest()


def verify(row):
    b = Path(row['path']).read_bytes()
    if len(b) != row['bytes'] or digest(b) != row['sha256']:
        raise ValueError('input pin: ' + row['path'])


def limit(which, cap):
    before = resource.getrlimit(which)
    target = min([cap] + [x for x in before if x != resource.RLIM_INFINITY])
    if target <= 0:
        raise BoundedUnknown('pre-existing nonpositive resource limit')
    try:
        resource.setrlimit(which, (target, target))
    except (OSError, ValueError) as error:
        raise BoundedUnknown('resource setup: '+str(error)) from error
    after = resource.getrlimit(which)
    if after != (target, target):
        raise BoundedUnknown('resource limit readback')
    return {'before': list(before), 'requested_and_readback': list(after)}


def configure_resources():
    if sys.platform != 'darwin':
        raise BoundedUnknown('declared macOS resource contract only')
    return {'DATA': limit(resource.RLIMIT_DATA, 1073741824),
            'CPU': limit(resource.RLIMIT_CPU, 105),
            'FSIZE': limit(resource.RLIMIT_FSIZE, 8126464),
            'scope': 'Requested/read-back heap-data limit and explicit owned-state caps; not an instantaneous RSS, stack or mapped-memory guarantee. ru_maxrss is raw platform units.'}


def fixtures():
    cases = [
        ('inside', [(0,0,0),(0,4,0),(0,0,4)], 0, (1,1), 'PROPER'),
        ('edge', [(0,0,0),(0,4,0),(0,0,4)], 0, (2,2), 'EDGE'),
        ('vertex', [(0,0,0),(0,4,0),(0,0,4)], 0, (0,0), 'VERTEX'),
        ('outside', [(0,0,0),(0,4,0),(0,0,4)], 0, (4,4), None),
        ('reverse', [(0,0,0),(0,0,4),(0,4,0)], 0, (1,1), 'PROPER'),
        ('coplanar', [(0,0,0),(4,0,0),(0,4,0)], 0, (1,0), 'COPLANAR'),
        ('beyond_segment', [(0,0,0),(4,0,0),(0,4,0)], 0, (5,0), None),
        ('off_line', [(0,0,0),(4,0,0),(0,4,0)], 0, (1,1), None),
        ('axis_y', [(0,0,0),(4,0,0),(0,0,4)], 1, (1,1), 'PROPER'),
        ('axis_z', [(0,0,0),(4,0,0),(0,4,0)], 2, (1,1), 'PROPER'),
    ]
    out = []
    for name, triangle, axis, point, expected in cases:
        actual = K.classify(triangle, axis, point)
        if (actual['kind'] if actual else None) != expected:
            raise AssertionError('exact fixture: ' + name)
        out.append({'name': name, 'triangle': triangle, 'axis': axis, 'point': point, 'result': actual})
    formats = []
    for major in (1,2,3):
        header = repr({'descr': '<f4', 'fortran_order': False, 'shape': (1,3)}).encode()
        prefix = 10 if major == 1 else 12
        header += b' ' * ((-prefix-len(header)-1) % 64) + b'\n'
        blob = b'\x93NUMPY' + bytes((major,0)) + struct.pack('<H' if major == 1 else '<I', len(header)) + header + struct.pack('<fff',1.25,-2.5,0.0)
        rows, metadata = K.decode_npy(blob, '<f4', (1,3))
        if rows != [(1.25,-2.5,0.0)]:
            raise AssertionError('NPY fixture')
        formats.append({'version': major, 'metadata': metadata, 'values': rows})
    bad_header = b"{'descr':'|O','fortran_order':False,'shape':(1,3)}\n"
    bad = b'\x93NUMPY\x01\x00' + struct.pack('<H',len(bad_header)) + bad_header
    try:
        K.decode_npy(bad, '<f4', (1,3))
    except ValueError as error:
        formats.append({'object_dtype_refused': str(error)})
    else:
        raise AssertionError('object dtype admitted')
    return out, formats


def read_member(archive, spec):
    name = spec['name'] + '.npy'
    with zipfile.ZipFile(archive) as z:
        info = [x for x in z.infolist() if x.filename == name]
        if len(info) != 1 or not spec['bytes'] <= info[0].file_size <= spec['bytes']+4108:
            raise ValueError('NPZ member identity/size')
        if info[0].flag_bits & 1:
            raise ValueError('encrypted member')
        with z.open(info[0]) as stream:
            blob = stream.read(spec['bytes']+4109)
            if stream.read(1) or len(blob) != info[0].file_size:
                raise ValueError('bounded member read')
    rows, metadata = K.decode_npy(blob, spec['dtype'], spec['shape'], spec['raw_sha256'])
    RECORD['source_members_decoded'] += 1
    return rows, metadata


def node_witness(axis, other, u, v, q32, qint, vertices, exponent):
    bounds = [min(p[axis] for p in vertices), max(p[axis] for p in vertices)]
    chosen = None
    for i in (0, len(qint[axis])-1):
        if qint[axis][i] < bounds[0] or qint[axis][i] > bounds[1]:
            chosen = i; break
    if chosen is None:
        return {'proven_nonboundary': False, 'reason': 'no endpoint outside full source axis bbox'}
    index = [0,0,0]; index[axis] = chosen; index[other[0]] = u; index[other[1]] = v
    point = [q32[a][index[a]] for a in range(3)]
    integer = [qint[a][index[a]] for a in range(3)]
    gid = ((index[0]*len(q32[1])) + index[1])*len(q32[2]) + index[2]
    return {'proven_nonboundary': True, 'indices': index, 'gid': gid, 'q32': point,
            'q32_bits_hex': [struct.pack('<f',x).hex() for x in point],
            'point_int': integer, 'source_axis_bounds_int': bounds,
            'strict_outside_axis': axis, 'scale_exponent': exponent,
            'meaning': 'Strictly outside complete represented source axis bounds, so exact point-on-source boundary exception cannot apply. No physical classification or native metric query.'}


def run():
    global STAGE
    STAGE = 'resource_setup'; RECORD['resource_limits'] = configure_resources()
    config = json.loads((P/'CONFIG.json').read_text())
    admission = json.loads((P/'ADMISSION.json').read_text())
    if admission['execution_admitted'] is not True or admission['config_sha256'] != digest((P/'CONFIG.json').read_bytes()):
        raise ValueError('root admission binding')
    for row in config['pins']:
        verify(row)
    RECORD['runtime'] = {'version': sys.version, 'executable': str(Path(sys.executable).resolve()), 'pid': os.getpid()}
    RECORD['input_pins_verified'] = len(config['pins'])
    K.check = budget
    STAGE = 'synthetic_exact_fixtures'
    RECORD['fixtures'], RECORD['format_fixtures'] = fixtures()
    STAGE = 'two_bounded_source_members'
    contract = json.loads(Path(config['contract']).read_text())
    specs = {x['name']: x for x in contract['frame']['buffers']}
    archive = next(x['path'] for x in contract['sources'] if x['path'].endswith('/ari-skin-palette/work/after-geometry.npz'))
    vertices_float, vmeta = read_member(archive, specs['Human_world'])
    faces, fmeta = read_member(archive, specs['Human_triangles'])
    RECORD['source_members'] = {'Human_world': vmeta, 'Human_triangles': fmeta}
    q64, q32 = K.stations(contract['grid'])
    exponent, vertices, qint = K.lattice(vertices_float, q32)
    RECORD['grid'] = {'q64_axes': q64, 'q32_axes': q32, 'scale_exponent': exponent,
                      'node_count': math.prod(map(len,q32)), 'columns_expected': 51872}
    STAGE = 'complete_source_chain'
    gate = K.source_gate(vertices, faces); gate['scale_exponent'] = exponent
    RECORD['source_gate'] = gate
    if gate['status'] != 'PASS':
        RECORD.update(status='REFUSED_SOURCE_GATE', complete=False)
        return
    RECORD['source_bounds_int'] = [[min(p[a] for p in vertices), max(p[a] for p in vertices)] for a in range(3)]
    log = hashlib.sha256()
    for axis in range(3):
        other = [a for a in range(3) if a != axis]
        STAGE = 'axis_%s_projected_bins' % axis
        bins, references = K.bins_for_axis(vertices, faces, qint, axis, 1000000)
        axis_record = {'axis': axis, 'references': references, 'nonempty_bins': len(bins),
                       'columns_scanned': 0, 'pairs_tested': 0, 'proper_hits': 0, 'complete': False}
        RECORD['axis_records'].append(axis_record)
        STAGE = 'axis_%s_exact_columns' % axis
        for u in range(len(qint[other[0]])):
            for v in range(len(qint[other[1]])):
                budget(); RECORD['columns_scanned'] += 1; axis_record['columns_scanned'] += 1
                point = (qint[other[0]][u], qint[other[1]][v])
                ids = bins.get((u,v), ())
                for ordinal, fid in enumerate(ids):
                    if ordinal % 128 == 0:
                        budget()
                    RECORD['candidate_pairs_tested'] += 1; axis_record['pairs_tested'] += 1
                    triangle = [vertices[i] for i in faces[fid]]
                    result = K.classify(triangle, axis, point)
                    log.update(json.dumps([axis,u,v,fid,result],sort_keys=True,separators=(',',':')).encode()+b'\n')
                    if result is None:
                        continue
                    if result['kind'] == 'PROPER':
                        axis_record['proper_hits'] += 1; continue
                    witness = {'axis': axis, 'other_axes': other, 'column_indices': [u,v],
                               'projected_point_int': list(point), 'face_id': fid,
                               'source_indices': list(faces[fid]), 'vertices_int': triangle,
                               'vertices_F32': [vertices_float[i] for i in faces[fid]],
                               'predicate': result, 'scale_exponent': exponent,
                               'node': node_witness(axis,other,u,v,q32,qint,vertices,exponent)}
                    RECORD['witness'] = witness
                    RECORD['prefix_digest'] = log.hexdigest()
                    RECORD.update(status='REFUSED_AMBIGUOUS_COLUMN' if witness['node']['proven_nonboundary'] else 'UNKNOWN_COLUMN', complete=False)
                    return
        axis_record['complete'] = True
        del bins
    RECORD['prefix_digest'] = log.hexdigest()
    if RECORD['columns_scanned'] != 51872:
        raise AssertionError('whole column count')
    RECORD.update(status='PASS_PREREQUISITES_ONLY', complete=True)


def main():
    code = 0
    try:
        run()
    except (BoundedUnknown, MemoryError) as error:
        RECORD.update(status='UNKNOWN', complete=False, stop={'type':type(error).__name__, 'message':str(error)})
    except RuntimeError as error:
        if str(error) != 'projected reference cap':
            code = 1
        RECORD.update(status='UNKNOWN', complete=False, stop={'type':type(error).__name__, 'message':str(error)})
    except BaseException as error:
        code = 1
        RECORD.update(status='UNKNOWN', complete=False, unexpected={'type':type(error).__name__, 'message':str(error)})
    RECORD.update(stage=STAGE, collected_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  elapsed_seconds=time.monotonic()-START, ru_maxrss_raw=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                  qualification='Formal represented source/column eligibility only; no native metric, field, mesh, physical inside/fit/coverage, image or AAA acceptance.')
    try:
        config = json.loads((P/'CONFIG.json').read_text())
        for row in config['pins']:
            verify(row)
        RECORD['post_pins_verified'] = len(config['pins'])
    except BaseException as error:
        code = 1; RECORD['post_pin_error'] = {'type':type(error).__name__, 'message':str(error)}
    raw = (json.dumps(RECORD,indent=2,allow_nan=False)+'\n').encode()
    if len(raw) > 8126464:
        raise RuntimeError('result output cap; no partial success record')
    with (P/'RESULT.json').open('xb') as f:
        f.write(raw)
    print(json.dumps({'status':RECORD['status'],'bytes':len(raw),'sha256':digest(raw),'pid':os.getpid()}))
    return code


if __name__ == '__main__':
    sys.exit(main())
