"""Independent native-output buffers/routing/artifact/complete PNG CRC checks."""
from pathlib import Path
import json,hashlib,struct,zlib,datetime
import numpy as np
H=Path(__file__).resolve().parent
r=json.loads((H/'NATIVE-RESULT.json').read_text());b=json.loads((H/'RESULT.json').read_text());c=json.loads((H/'CONTRACT.json').read_text());j=json.loads((H/'NATIVE-JOB.json').read_text());sha=lambda x:hashlib.sha256(x).hexdigest()
assert r['passed'] and r['cold_reopen_exact'] and r['post_pins_exact'] and r['fit']==b['fit']=='REFUSED_TRANSVERSE' and j['exit_code']==0 and not j['timed_out']
log=(H/'native.log').read_bytes();assert len(log)==j['log_bytes'] and sha(log)==j['log_sha256'] and not j['log_truncated']
for p in json.loads((H/'EXEC-NATIVE.json').read_text())['pins']:
 q=Path(p['path'])
 with q.open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 assert q.stat().st_size==p['bytes'] and d==p['sha256'],q
with np.load(H/'geometry.npz',allow_pickle=False) as z:a={k:z[k] for k in z.files}
g=r['geometry_baseline'];assert g['body']['world_sha256']==b['source']['world_sha256'] and g['body']['triangles_sha256']==b['source']['triangles_sha256'] and g['body']['material_indices_sha256']==sha(np.zeros(26756,np.int32).tobytes())
for side,entry in zip(['l','r'],g['modules']):
 assert entry['side']==side and entry['vertices']==320 and entry['triangles']==640
 for suffix,key in [('vertices','vertex_sha256'),('triangles','triangle_sha256'),('material_ids','material_ids_sha256'),('loop_uv','loop_uv_sha256')]:assert sha(a[side+'_'+suffix].tobytes())==entry[key]
colors={'SleeveBody-gray':(c['body_gray'],1,0)};colors.update({'Sleeve-'+k:(v,c['material_roughness'],.2) for k,v in c['materials'].items()})
for m in r['display_baseline']['materials']:
 rgb,rough,spec=colors[m['name']];assert np.array_equal(np.array(m['rgba'],np.float32),np.array([*rgb,1],np.float32)) and m['roughness']==float(np.float32(rough)) and m['specular']==float(np.float32(spec)) and m['metallic']==0
 route=m['routing'];assert route['use_nodes'] and sorted(route['nodes'])==[['Material Output','ShaderNodeOutputMaterial'],['Principled BSDF','ShaderNodeBsdfPrincipled']] and route['links']==[['Principled BSDF','BSDF','Material Output','Surface']] and route['active_output']=='Material Output' and route['output_target'] in [None,'ALL']
for key,source,out,kind in [('label_routing','Emission','Material Output','ShaderNodeEmission'),('world_routing','Background','World Output','ShaderNodeBackground')]:
 route=r['display_baseline'][key];assert route['use_nodes'] and [source,kind] in route['nodes'] and len(route['nodes'])==2 and route['links']==[[source,source,out,'Surface']] and route['active_output']==out and route['output_target'] in [None,'ALL']
assert r['display_baseline']['label_body']=='DIAGNOSTIC: FIT REFUSED (104 TRIANGLE PAIRS)' and r['frame']['all_body_and_module_vertices']==14020 and r['frame']['resolution']==[768,1024] and r['frame']['pad_each_side']==.04
files=[]
for o in r['outputs']:
 payload=(H/o['file']).read_bytes();assert len(payload)==o['bytes'] and sha(payload)==o['sha256'] and payload[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',payload[16:24])==(768,1024) and payload[24:26]==bytes([8,6])
 pos=8;count=0;end=False
 while pos<len(payload):
  n=struct.unpack('>I',payload[pos:pos+4])[0];kind=payload[pos+4:pos+8];data=payload[pos+8:pos+8+n];crc=struct.unpack('>I',payload[pos+8+n:pos+12+n])[0];assert zlib.crc32(kind+data)&0xffffffff==crc;pos+=n+12;count+=1
  if kind==b'IEND':assert n==0;end=True;break
 assert end and pos==len(payload) and min(o['projected_min'][:2])>=.039999 and max(o['projected_max'][:2])<=.960001 and o['projected_min'][2]>0
 files.append({'file':o['file'],'bytes':len(payload),'sha256':sha(payload),'chunks':count})
assert len(files)==3
file=r['editable'];payload=(H/file['file']).read_bytes();assert len(payload)==file['bytes'] and sha(payload)==file['sha256'] and file['exclusive_final_link'] and len(payload)<=67108864 and not (H/'private-save').exists()
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'physical_pins':42,'logical_source_and_modules_exact':True,'shader_routes_and_declared_scalars_exact':True,'complete_png_crc':files,'editable':file,'fit':'REFUSED_TRANSVERSE104trianglepairs','limits':'Cold geometry/UV/metadata/display equality is native-worker attributed, not separately reopened by root. Shader proof covers bounded routes and listed inputs. Actual full images decide readability/authoring direction only; source covariance/fit/occupancy/coverage/selfcontact/motion/wholejacket/appearance unqualified.'}
(H/'ROOT-NATIVE-RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
