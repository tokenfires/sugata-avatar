"""One exact material and literal diffuse source read; no model or native APIs."""
import signal
signal.alarm(15)
import resource
resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import struct
import sys
import traceback
import zipfile
import zlib

P = Path(__file__).resolve().parent
R = P.parents[3]
generated = []

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def require(ok, message):
    if not ok:
        raise ValueError(message)

def save_json(name, obj):
    b = (json.dumps(obj, indent=2) + '\n').encode()
    require(len(b) <= 32768, 'metadata output cap')
    with (P / name).open('xb') as f:
        f.write(b)
    generated.append(name)

def matching_row(rows, name):
    found = [r for r in rows if r.get('name') == name]
    require(len(found) == 1, 'exact unique member required')
    r = found[0]
    parts = PurePosixPath(name)
    require(not parts.is_absolute() and '..' not in parts.parts and '\\' not in name,
            'unsafe member path')
    require(stat.S_ISREG(r['external_attr'] >> 16), 'ordinary source file required')
    require(r['compression'] in (0, 8) and r['compressed_bytes'] > 0,
            'unsupported compression')
    return r

def member(z, rows, name, maximum):
    r = matching_row(rows, name)
    require(0 < r['bytes'] <= maximum, 'member byte cap')
    infos = [x for x in z.infolist() if x.filename == name]
    require(len(infos) == 1, 'unique actual member required')
    i = infos[0]
    require(not i.is_dir() and not i.flag_bits & 1, 'directory or encrypted member')
    actual = {'name': i.filename, 'bytes': i.file_size,
              'compressed_bytes': i.compress_size, 'crc32': i.CRC,
              'compression': i.compress_type, 'external_attr': i.external_attr}
    require(actual == r, 'actual member metadata differs from frozen row')
    b = z.read(i)
    require(len(b) == r['bytes'] and zlib.crc32(b) & 0xffffffff == r['crc32'],
            'decompressed length or CRC mismatch')
    return b, r

def preserve(name, data):
    require(PurePosixPath(name).name == name and name not in ('', '.', '..'),
            'source basename required')
    p = P / 'source' / name
    with p.open('xb') as f:
        f.write(data)
    p.chmod(0o444)
    generated.append(str(p.relative_to(P)))
    return {'path': str(p.relative_to(R)), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest(), 'mode': '0444'}

try:
    admission = P / 'ROOT-ADMISSION.json'
    require(len(sys.argv) == 2 and sha(admission) == sys.argv[1], 'root admission identity')
    a = json.loads(admission.read_bytes())
    require(a['decision'] == 'ADMIT_ONE_EXACT_MATERIAL_SOURCE_READ', 'admission scope')
    save_json('CLAIM.json', {'attempt': 1, 'pid': os.getpid(), 'utc': now(),
                             'admission_sha256': sys.argv[1]})
    for r in a['pins']:
        p = R / r['path']
        require(p.stat().st_size == r['bytes'] and sha(p) == r['sha256'], 'input pin')
    plan = json.loads((P / 'PLAN.json').read_bytes())
    require(now() < plan['launch_before_utc'], 'launch deadline')
    manifest_path = R / plan['manifest']['path']
    require(manifest_path.stat().st_size <= 2097152, 'manifest cap')
    m = json.loads(manifest_path.read_bytes())
    archive = R / plan['archive']['path']
    require(archive.stat().st_size == plan['archive']['bytes'] and
            sha(archive) == plan['archive']['sha256'] == m['archive_sha256'],
            'archive identity')
    require(m['member_count'] == len(m['members']) == 517, 'manifest count')
    (P / 'source').mkdir(exist_ok=False)
    with zipfile.ZipFile(archive, 'r') as z:
        require(len(z.infolist()) == 517, 'actual member count')
        material, mr = member(z, m['members'], plan['material_member'], 8192)
        text = material.decode('utf-8', errors='strict')
        material_output = preserve(PurePosixPath(mr['name']).name, material)
        directives = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            pair = line.split(None, 1)
            if pair[0].lower().endswith('texture'):
                require(len(pair) == 2, 'empty texture directive')
                directives.append(pair)
        require(len(directives) == 1 and directives[0][0] == 'diffuseTexture',
                'only one literal diffuse texture supported; other active maps require new ownership')
        literal = directives[0][1]
        require(PurePosixPath(literal).name == literal and '\\' not in literal and
                literal.lower().endswith('.png') and literal not in ('.', '..'),
                'literal PNG basename required')
        texture_name = str(PurePosixPath(mr['name']).parent / literal)
        texture, tr = member(z, m['members'], texture_name, 8388608 - len(material))
        require(len(texture) >= 33 and texture[:8] == b'\x89PNG\r\n\x1a\n' and
                texture[8:16] == b'\x00\x00\x00\rIHDR', 'PNG header')
        w, h, depth, colour, compression, filtering, interlace = struct.unpack('>IIBBBBB', texture[16:29])
        require(0 < w <= 4096 and 0 < h <= 4096 and depth == 8 and colour in (2, 6) and
                compression == filtering == 0 and interlace in (0, 1), 'bounded RGB/RGBA PNG required')
        texture_output = preserve(literal, texture)
    require(sha(archive) == plan['archive']['sha256'], 'archive post identity')
    for p in (material_output, texture_output):
        require(sha(R / p['path']) == p['sha256'], 'output post identity')
    save_json('RESULT.json', {'status': 'EXACT_SOURCE_BYTES_RETAINED_PENDING_ACTUAL_IMAGE_REVIEW',
              'pid': os.getpid(), 'finished_utc': now(), 'material_member': mr,
              'material_text': text, 'directives': directives, 'literal_diffuse_member': tr,
              'material': material_output, 'texture': texture_output, 'png_header':
              {'width': w, 'height': h, 'depth': depth, 'colour_type': colour, 'interlace': interlace},
              'archive_sha256': plan['archive']['sha256'], 'generated': generated,
              'scope': 'Exact local source material and diffuse only. PNG header is not pixel decode or appearance. No native, form, UV registration, expression, fit, motion, runtime or Mara qualification.'})
    print('EXACT_SOURCE_RETAINED', os.getpid(), material_output['sha256'], texture_output['sha256'])
except Exception as e:
    try:
        save_json('FAILURE.json', {'status': 'STOP_NO_RETRY', 'pid': os.getpid(), 'utc': now(),
                  'error': str(e)[:2000], 'traceback': traceback.format_exc()[:5000],
                  'partial_outputs_retained': generated})
    except Exception:
        pass
    print('SOURCE_READ_STOP', type(e).__name__, str(e), file=sys.stderr)
    raise SystemExit(1)
