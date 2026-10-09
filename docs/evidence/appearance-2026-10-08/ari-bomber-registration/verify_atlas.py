"""Root stored source/primitive/material/projection/original-image verification; no native rerun."""
from pathlib import Path
import json,hashlib,struct,zlib,datetime
import numpy as np
H=Path(__file__).resolve().parent
r=json.loads((H/'ATLAS-RESULT.json').read_text());q=json.loads((H/'RESULT.json').read_text());cfg=json.loads((H/'ATLAS-CONTRACT.json').read_text());j=json.loads((H/'ATLAS-JOB.json').read_text())
assert r['passed'] and r['post_pins_exact'] and j['exit_code']==0 and not j['timed_out'] and not j['log_truncated']
log=(H/'atlas.log').read_bytes();assert len(log)==j['log_bytes'] and hashlib.sha256(log).hexdigest()==j['log_sha256']
for pin in json.loads((H/'EXEC-ATLAS.json').read_text())['pins']:
 p=Path(pin['path'])
 with p.open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 assert p.stat().st_size==pin['bytes'] and d==pin['sha256']
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
with np.load(next(x['path'] for x in json.loads((H/'INPUTS.json').read_text()) if x['path'].endswith('/after-geometry.npz')),allow_pickle=False) as z:w=z['Human_world'];t=z['Human_triangles']
base=r['owned_display_baseline'];assert sha(w)==r['source']['world_sha256']==base['body_world_sha256'] and sha(t)==r['source']['triangles_sha256']==base['body_triangles_sha256'] and sha(np.zeros(len(t),dtype=np.int32))==base['body_material_indices_sha256']
radius=cfg['marker_radius'];local=np.array([[radius,0,0],[-radius,0,0],[0,radius,0],[0,-radius,0],[0,0,radius],[0,0,-radius]],dtype=np.float32);faces=np.array([[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]],dtype=np.int32)
assert len(r['markers'])==len(base['markers'])==8
for a,m,obs in zip(q['anchors'],r['markers'],base['markers']):
 assert a['source_vertex']==m['source_vertex']==obs['source_vertex'] and np.array_equal(w[a['source_vertex']],m['source_point']) and np.array_equal(w[a['source_vertex']],obs['source_point'])
 assert a['role']==m['role']==obs['role'] and a['side']==m['side'] and m['marker_radius']==float(np.float32(radius)) and m['local_coordinates_sha256']==obs['local_coordinates_sha256']==sha(local) and m['triangles_sha256']==obs['triangles_sha256']==sha(faces) and obs['material']=='Registration-'+a['role']
colors={'RegistrationGray':cfg['body_color']};colors.update({'Registration-'+k:v for k,v in cfg['role_colors'].items()});assert {m['name'] for m in base['materials']}==set(colors)
for m in base['materials']:assert np.array_equal(np.array(m['rgba'],dtype=np.float32),np.array([*colors[m['name']],1],dtype=np.float32)) and m['roughness']==1 and m['metallic']==m['specular']==0
assert base['render_look_matches_contract'] and r['frame']['actual_source_marker_vertices']==13428 and r['frame']['resolution']==[768,1024] and r['frame']['pad_each_side']==.04
target=(w.min(axis=0).astype(float)+w.max(axis=0).astype(float))/2;assert np.array_equal(target,r['frame']['target']);scale=r['frame']['scale'];assert abs(scale-float(w[:,2].max()-w[:,2].min())/.92)<2e-5
pngs=[];projection_error=0.0
for o in r['outputs']:
 b=(H/o['file']).read_bytes();assert len(b)==o['bytes'] and hashlib.sha256(b).hexdigest()==o['sha256'] and b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(768,1024) and b[24:26]==bytes([8,6])
 pos=8;chunks=0
 while pos<len(b):
  n=struct.unpack('>I',b[pos:pos+4])[0];payload=b[pos+4:pos+8+n];crc=struct.unpack('>I',b[pos+8+n:pos+12+n])[0];assert zlib.crc32(payload)&0xffffffff==crc;pos+=12+n;chunks+=1
 assert pos==len(b) and payload[:4]==b'IEND' and min(o['projected_min'][:2])>=.039999 and max(o['projected_max'][:2])<=.960001 and o['projected_min'][2]>0
 direction=np.array(cfg['view_directions'][o['name']],dtype=float);direction/=np.linalg.norm(direction);right=np.array([-direction[1],direction[0],0]);assert np.max(np.abs(np.array(o['camera_position'])-(target+direction*5)))<1e-6
 assert len(o['anchor_projections'])==8
 for a,p in zip(q['anchors'],o['anchor_projections']):
  assert a['source_vertex']==p['source_vertex'] and a['role']==p['role'] and a['side']==p['side'] and p['not_occlusion_or_artist_proof'];delta=w[a['source_vertex']].astype(float)-target;ideal=np.array([.5+np.dot(delta,right)/(scale*.75),.5+delta[2]/scale,5-np.dot(delta,direction)]);projection_error=max(projection_error,float(np.max(np.abs(ideal-p['normalized']))));assert projection_error<2e-6
 pngs.append({'file':o['file'],'bytes':len(b),'sha256':o['sha256'],'RGBA_domain':[768,1024],'all_chunk_CRCs':chunks})
assert [o['name'] for o in r['outputs']]==['front','front-left','rear']
sourceblend=H.parent/'ari-skin-palette/work/ari-skin-palette.blend';assert hashlib.sha256(sourceblend.read_bytes()).hexdigest()=='ffbda17705259aa61bf1baf8070ecd1c6bb41066061c2665f7338e8daae7d7e0'
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verified':True,'all30physicalpins_exact':True,'source_native_asset_unchanged':True,'source_body_andzero_indices_exact':True,'all8source_centered_marker_shapes_andcolors_exact':True,'all24ideal_ortho_point_projection_max_error':projection_error,'projection_not_occlusion_or_role_proof':True,'first_originals':pngs,'root_whole3originals_viewed':True,'root_artist_judgment':'Retain as eight draft proximal registration references: blue crown/amber front/magenta underarm visible infront+oblique, greenrear visible inrear. Smallpoint visibility supports point-level authorship only; no continuous seam/armhole/garment fit acceptance.','alternatives':[{'route':'Use fixed references to author original continuous attachment paths and independent sections/template','tradeoff':'Concrete path/shape progress; still owes sourcefront-back/section/ease/fullinterior/coverage/contact/rig-morph-pose duties'},{'route':'Direct original asset registration with separately authored path/section/topology choices','tradeoff':'Freer silhouette, equivalent coupling responsibility; doesnotlicense targettuning or promote existingpoints into a seam'}],'current_trial':'CLOSED; no target/display/camera/threshold retakes','continuous_seam_path':'UNAUTHORED_REQUIRED','garment_fit_clearance_motion':'UNKNOWN','native_display_preservation':'Exact guards in reviewedpinnedcode/passreceipt, no secondnative run'}
with (H/'ROOT-ATLAS-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
