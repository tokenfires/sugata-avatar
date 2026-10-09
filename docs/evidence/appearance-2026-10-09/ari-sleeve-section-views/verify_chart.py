"""Independent source, stored observer and complete PNG CRC verification."""
from pathlib import Path
import json,hashlib,datetime,struct,zlib
import numpy as np
H=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
q=json.loads((H/'RESULT.json').read_text());r=json.loads((H/'CHART-RESULT.json').read_text());cfg=json.loads((H/'CHART-CONTRACT.json').read_text());job=json.loads((H/'CHART-JOB.json').read_text())
assert r['passed'] and r['post_pins_exact'] and job['exit_code']==0 and not job['timed_out'] and not job['log_truncated']
log=(H/'chart.log').read_bytes();assert len(log)==job['log_bytes'] and sha(log)==job['log_sha256']
for p in json.loads((H/'EXEC-CHART.json').read_text())['pins']:
 with Path(p['path']).open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 assert Path(p['path']).stat().st_size==p['bytes'] and d==p['sha256']
source=next(x['path'] for x in json.loads((H/'INPUTS.json').read_text()) if x['path'].endswith('/after-geometry.npz'))
with np.load(source,allow_pickle=False) as z:w=z['Human_world'];t=z['Human_triangles']
assert w.dtype==np.float32 and t.dtype==np.int32 and w.shape==(13380,3) and t.shape==(26756,3)
assert sha(w.tobytes())==q['source']['world_sha256']==r['body']['world_sha256'] and sha(t.tobytes())==q['source']['triangles_sha256']==r['body']['triangles_sha256']
assert r['body']['material_indices_sha256']==sha(np.zeros(len(t),np.int32).tobytes()) and r['material_face_counts']=={'0':26756,'1':0,'2':0}
maxerr=0
for s,m,ev in zip(q['sections'],r['markers'],r['owned_display_baseline']['markers']):
 lookup={tuple(x['edge']):x['point'] for x in s['source_crossings']};c=s['components'][s['selected_component']];p=np.array([lookup[tuple(e)] for e in c['ordered_edges']]);co=np.ones((len(p),4),np.float32);co[:,:3]=p
 assert m['station']==s['name'] and m['side']==s['side'] and m['control_points']==len(p)==({'elbow':48,'cuff':43}[s['role']])
 assert m['control_points_sha256']==ev['control_sha256']==sha(co.tobytes()) and m['cyclic'] and ev['cyclic'] and m['radius']==float(np.float32(.002))==ev['radius']
 err=float(np.max(np.abs(co[:,:3].astype(float)-p)));assert err==m['display_conversion_max_error'] and err<1e-7;maxerr=max(maxerr,err)
 assert ev['material']=='JunctionMarker-'+s['name'] and ev['vertices']>0
assert len(r['markers'])==len(r['owned_display_baseline']['markers'])==4
expected={'JunctionBody-'+k:v for k,v in cfg['body_materials'].items()};expected.update({'JunctionMarker-'+k:v for k,v in cfg['marker_materials'].items()})
assert set(expected)=={m['name'] for m in r['materials']}
for m in r['materials']:
 assert np.array_equal(np.array(m['base_color'],np.float32),np.array([*expected[m['name']],1],np.float32)) and m['roughness']==1 and m['metallic']==0 and m['specular']==0
assert r['render_settings']=={'engine':'CYCLES','device':'CPU','samples':16,'seed':0,'denoising':True,'denoiser':'OPENIMAGEDENOISE','denoising_use_gpu':False,'threads':16,'transparent':True,'compositing':False,'sequencer':False}
assert r['look']=={'view_transform':'AgX','look':'None','display':'sRGB','exposure':0.0,'gamma':1.0}
assert r['frame']['resolution']==[768,1024] and r['frame']['pad_each_side']==.04 and r['frame']['includes_actual_owned_marker_meshes']
assert np.array_equal(r['frame']['source_world_min'],w.min(axis=0).astype(float)) and np.array_equal(r['frame']['source_world_max'],w.max(axis=0).astype(float))
chunks=[]
assert [o['name'] for o in r['outputs']]==list(cfg['view_directions'])
for o in r['outputs']:
 b=(H/o['file']).read_bytes();assert sha(b)==o['sha256'] and len(b)==o['bytes'] and b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(768,1024)
 pos=8;count=0;end=False
 while pos<len(b):
  n=struct.unpack('>I',b[pos:pos+4])[0];tag=b[pos+4:pos+8];data=b[pos+8:pos+8+n];crc=struct.unpack('>I',b[pos+8+n:pos+12+n])[0];assert zlib.crc32(tag+data)&0xffffffff==crc
  pos+=12+n;count+=1
  if tag==b'IEND':assert n==0;end=True;break
 assert end and pos==len(b)
 assert np.array(o['projected_min'])[:2].min()>=.039999 and np.array(o['projected_max'])[:2].max()<=.960001 and o['projected_min'][2]>0
 chunks.append({'file':o['file'],'chunks':count,'bytes':len(b),'sha256':sha(b)})
record={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'pins':37,'source_world_and_triangles_exact':True,'all_source_face_indices_zero':True,'four_controls_independently_reconstructed':True,'max_display_conversion_error':maxerr,'stored_render_material_frame_checks':True,'complete_png_crcs':chunks,'limits':'Observed preservation guards attributed to native worker; evaluated marker mesh hashes not independently rebuilt. Actual images require separate whole-image judgment. No garment, anatomy, clearance, appearance or motion qualification.'}
(H/'ROOT-RESULT.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
