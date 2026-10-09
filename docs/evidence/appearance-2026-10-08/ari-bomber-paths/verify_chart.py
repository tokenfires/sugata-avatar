"""Stored-only independent root chart receipt/source/first-original verification."""
from pathlib import Path
import json,hashlib,datetime,struct,zlib
import numpy as np
H=Path(__file__).resolve().parent
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
r=json.loads((H/'CHART-RESULT.json').read_text());q=json.loads((H/'RESULT.json').read_text());cfg=json.loads((H/'CHART-CONTRACT.json').read_text());job=json.loads((H/'CHART-JOB.json').read_text())
assert r['passed'] and r['post_pins_exact'] and job['exit_code']==0 and not job['timed_out'] and not job['log_truncated']
log=(H/'chart.log').read_bytes();assert len(log)==job['log_bytes'] and hashlib.sha256(log).hexdigest()==job['log_sha256']
for pin in json.loads((H/'EXEC-CHART.json').read_text())['pins']:
 p=Path(pin['path'])
 with p.open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 assert p.stat().st_size==pin['bytes'] and d==pin['sha256']
with np.load(next(x['path'] for x in json.loads((H/'INPUTS.json').read_text()) if x['path'].endswith('/after-geometry.npz')),allow_pickle=False) as z:w=z['Human_world'];t=z['Human_triangles']
assert sha(w)==r['body']['world_sha256'] and sha(t)==r['body']['triangles_sha256']
with np.load(H/'fields.npz',allow_pickle=False) as z:
 ix=np.zeros(len(t),dtype=np.int32)
 for n,index in [('l',1),('r',2)]:ix[z[n+'_arm_faces']]=index
assert sha(ix)==r['body']['material_indices_sha256'] and {str(i):int(np.count_nonzero(ix==i)) for i in [0,1,2]}==r['material_face_counts']
for marker in r['markers']:
 rec=next(x for x in q['sides'] if x['side']==marker['side']);p=np.array(rec['cycle_points'])
 co=np.ones((29,4),dtype=np.float32);assert np.array_equal(p,w[rec['cycle_vertex_ids']]);co[:,:3]=p.astype(np.float32);assert sha(co)==marker['control_points_sha256'] and float(np.max(np.abs(co[:,:3].astype(float)-p)))==marker['display_conversion_max_error'] and marker['radius']==float(np.float32(cfg['marker_radius'])) and marker['cyclic']
expected={'JunctionBody-'+k:v for k,v in cfg['body_materials'].items()};expected.update({'JunctionMarker-'+k:v for k,v in cfg['marker_materials'].items()})
assert {m['name'] for m in r['materials']}==set(expected)
for m in r['materials']:
 assert np.array_equal(np.array(m['base_color'],dtype=np.float32),np.array([*expected[m['name']],1],dtype=np.float32)) and m['roughness']==1 and m['metallic']==m['specular']==0
assert r['look']=={'view_transform':'AgX','look':'None','display':'sRGB','exposure':0.0,'gamma':1.0}
assert r['render_settings']=={'engine':'CYCLES','device':'CPU','samples':16,'seed':0,'denoising':True,'denoiser':'OPENIMAGEDENOISE','denoising_use_gpu':False,'threads':16,'transparent':True,'compositing':False,'sequencer':False}
assert np.array_equal(w.min(axis=0),r['frame']['source_world_min']) and np.array_equal(w.max(axis=0),r['frame']['source_world_max'])
assert np.array_equal((w.min(axis=0).astype(float)+w.max(axis=0).astype(float))/2,r['frame']['target'])
assert abs(r['frame']['scale']-(w[:,2].max()-w[:,2].min())/.92)<2e-5 and r['frame']['pad_each_side']==.04
assert [o['name'] for o in r['outputs']]==['front','front-left','rear'];pngs=[]
for o in r['outputs']:
 b=(H/o['file']).read_bytes();assert len(b)==o['bytes'] and hashlib.sha256(b).hexdigest()==o['sha256'] and b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(768,1024) and b[25]==6
 pos=8;chunks=0
 while pos<len(b):
  length=struct.unpack('>I',b[pos:pos+4])[0];tagdata=b[pos+4:pos+8+length];crc=struct.unpack('>I',b[pos+8+length:pos+12+length])[0];assert zlib.crc32(tagdata)&0xffffffff==crc;pos+=length+12;chunks+=1
 assert pos==len(b) and tagdata[:4]==b'IEND'
 assert min(o['projected_min'][:2])>=.039999 and max(o['projected_max'][:2])<=.960001 and o['projected_min'][2]>0
 pngs.append({'file':o['file'],'bytes':len(b),'sha256':o['sha256'],'RGBA_domain':[768,1024],'all_chunk_CRCs':True})
sourceblend=H.parent/'ari-skin-palette/work/ari-skin-palette.blend'
assert hashlib.sha256(sourceblend.read_bytes()).hexdigest()=='ffbda17705259aa61bf1baf8070ecd1c6bb41066061c2665f7338e8daae7d7e0'
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stored_receipt_verified':True,'native_job_collected':True,'all30physicalpins_exact':True,'source_native_file_unchanged':True,'body_source_and_face_indices_exact':True,'marker_original_source_F32_controls_exact':True,'configured_materials_render_look_exact':True,'first_originals':pngs,'root_whole3originals_viewed':True,'root_image_decision':'Retain proximal source attachment references: front/oblique/rear show closed shoulder-to-underarm courses through fixeddraftroles. Rear/underarm angular turns reflect source-edge path; smoothdesigner seam/fullarmhole/garmentfit remainunqualified.','alternatives':[{'route':'Use fixed sourcepathrefs for original garmentsections/template/ease/interior authorship','tradeoff':'Freer authored shape costs complete original seam/topology/interior/coverage/contact/rig duties'},{'route':'Author original designer garmentboundary with independently owned registration against thesefixed source refs','tradeoff':'Freer smoothseam design costs complete sourcecorrespondence/coupling/contact; no currentroute/point/radius retuning'}],'native_display_preservation':'Verified guards in pinned code/pass receipt; no second native job','physical_clearance':'UNKNOWN','garment_fit':'UNKNOWN','current_trial':'CLOSED; no field/seed/radius/plane/image retake'}
with (H/'ROOT-CHART-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
