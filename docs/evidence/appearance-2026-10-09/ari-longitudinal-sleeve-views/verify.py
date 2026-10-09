"""Stored output consumer: original raw preservation, routes, framing and PNG CRCs. No native run."""
from pathlib import Path
import json,hashlib,struct,zlib,time
import numpy as np
P=Path(__file__).resolve().parent;T=time.monotonic();E=json.loads((P/'EXEC.json').read_text());I=E['inputs'];R=json.loads((P/'RESULT.json').read_text())
assert R['passed'] and R['post_pins'] and R['post_geometry_archived'] and R['fit_status']=='REFUSED_TRANSVERSE' and not R['saved'] and not R['candidate_promotion']
sha=lambda x:hashlib.sha256(x).hexdigest()
for pin in E['pins']:
 d=Path(pin['path']).read_bytes();assert len(d)==pin['bytes'] and sha(d)==pin['sha256']
arrays={}
with np.load(I['geometry']['path'],allow_pickle=False) as original, np.load(P/'actor-geometry.npz',allow_pickle=False) as before,np.load(P/'post-actor-geometry.npz',allow_pickle=False) as after:
 assert set(original.files)==set(before.files)==set(after.files) and len(original.files)==18
 for n in original.files:
  a,b,c=original[n],before[n],after[n];assert a.shape==b.shape==c.shape and a.dtype==b.dtype==c.dtype and a.tobytes()==b.tobytes()==c.tobytes();arrays[n]=a
state=json.loads(Path(I['cold']['path']).read_text())['state'];source=json.loads((P/'SOURCE-OBSERVED.json').read_text());assert source==json.loads((P/'RESTORED.json').read_text())==json.loads((P/'CLEANUP-SOURCE-BEFORE-REMOVAL.json').read_text())
for n in ['scene','metadata','extras','mixed_sha256']:assert source[n]==state[n]
materials={**state['original_materials'],'AriPaletteSkin':state['owned']};assert set(source['source_materials'])==set(materials)
for name,observed in source['source_materials'].items():
 old=materials[name]
 for k,v in observed['fields'].items():assert v==old['record']['rna'][k]
 for node in observed['nodes']:
  prior=next(x for x in old['record']['nodes'] if x['name']==node['name']);assert node['type']==prior['type'] and node['inputs']==prior['inputs']
  for k,v in node['fields'].items():assert v==prior['rna'][k]
 assert sorted(observed['links'])==sorted(old['record']['links'])
 for k in ['image_pointers','users','fake_user','custom','tree_custom','nodes_custom']:assert observed[k]==old[k]
with np.load(I['sleeves']['path'],allow_pickle=False) as z:mv=z['world32'];mt=z['triangles'];mr=z['face_role']
sleeve=json.loads((P/'SLEEVE-OBSERVED.json').read_text());assert sleeve['v']==sha(mv.tobytes()) and sleeve['tri']==sha(mt.tobytes()) and sleeve['role']==sha(mr.astype(np.int32).tobytes()) and sleeve['smoothing']==sha(np.zeros(len(mt),dtype=np.int32).tobytes())
assert sleeve['slots']==[['DATA',n] for n in E['materials']] and sleeve['matrix']==np.eye(4).tolist()
assert len(sleeve['graphs'])==len(E['materials'])==4
for g,(name,color) in zip(sleeve['graphs'],E['materials'].items()):
 assert g['name']==name and g['use_nodes'] and not g['backface_culling'] and g['links']==[['DiagnosticDiffuse','BSDF','DiagnosticOutput','Surface']]
 nodes={x['name']:x for x in g['nodes']};d=nodes['DiagnosticDiffuse'];out=nodes['DiagnosticOutput'];assert len(nodes)==2 and d['id']=='ShaderNodeBsdfDiffuse' and out['id']=='ShaderNodeOutputMaterial'
 assert d['inputs']['Color']==np.asarray(color,np.float32).astype(float).tolist() and d['inputs']['Roughness']==float(np.float32(.6)) and d['inputs']['Normal']==[0,0,0] and out['active'] and out['target']=='ALL'
 assert not d['mute'] and not out['mute'] and d['parent'] is None and out['parent'] is None
label=json.loads((P/'LABEL-OBSERVED.json').read_text());assert label['body']==E['label']['body'] and label['size']==float(np.float32(E['label']['size'])) and label['align']==['CENTER','BOTTOM'] and label['extrude']==label['bevel']==0
assert label['graph']['links']==[['RefusalEmission','Emission','RefusalOutput','Surface']]
points=np.concatenate([a for n,a in arrays.items() if n.endswith('_world')]+[mv]).astype(float);assert len(points)==R['frame']['point_count']==47048
assert [x['file'] for x in R['outputs']]==['front.png','oblique.png','rear.png'] and len(E['views'])==3
maxdelta=0.;crcs={}
for item,(view,direction) in zip(R['outputs'],E['views']):
 assert item['file']==view+'.png';pre=json.loads((P/('PRE-'+view+'.json')).read_text());display=pre['display'];camera=np.asarray(display['camera']['matrix']);assert camera.tolist()==item['camera']
 scale=display['camera']['data']['ortho_scale'];assert scale==R['frame']['scale']
 assert display['render']=={'engine':'CYCLES','resolution_x':768,'resolution_y':1024,'resolution_percentage':100,'pixel_aspect_x':1,'pixel_aspect_y':1,'threads_mode':'FIXED','threads':16,'film_transparent':True,'use_compositing':False,'use_sequencer':False}
 assert display['image']=={'file_format':'PNG','color_mode':'RGBA','color_depth':'8','compression':15}
 assert display['cycles']=={'device':'CPU','samples':16,'seed':0,'use_denoising':True,'denoiser':'OPENIMAGEDENOISE','denoising_use_gpu':False}
 assert display['camera']['data']=={'type':'ORTHO','sensor_fit':'VERTICAL','clip_start':float(np.float32(.01)),'clip_end':100,'ortho_scale':scale}
 assert display['look']=={'view_transform':'AgX','look':'None','exposure':0,'gamma':1,'use_curve_mapping':False} and display['display_device']=='sRGB'
 local=np.c_[points,np.ones(len(points))]@np.linalg.inv(camera).T;xy=np.c_[.5+local[:,0]/(scale*768/1024),.5+local[:,1]/scale]
 bounds=dict(minx=float(xy[:,0].min()),maxx=float(xy[:,0].max()),miny=float(xy[:,1].min()),maxy=float(xy[:,1].max()));delta=max(abs(bounds[k]-pre['bounds'][k]) for k in bounds);assert delta<5e-7;maxdelta=max(maxdelta,delta)
 assert (xy>=.04-5e-7).all() and (xy<=.96+5e-7).all() and (local[:,2]<0).all()
 ls=display['label'];assert ls==label;corners=np.asarray(ls['actual_local_corners']);basis=np.asarray(ls['matrix_basis']);q=np.c_[corners,np.ones(len(corners))]@basis.T;lxy=np.c_[.5+q[:,0]/(scale*768/1024),.5+q[:,1]/scale]
 lb=dict(minx=float(lxy[:,0].min()),maxx=float(lxy[:,0].max()),miny=float(lxy[:,1].min()),maxy=float(lxy[:,1].max()));assert max(abs(lb[k]-pre['label_bounds'][k]) for k in lb)<5e-7 and lb['miny']>bounds['maxy']+.002-5e-7
 assert (lxy>=.02-5e-7).all() and (lxy<=.98+5e-7).all()
 data=(P/item['file']).read_bytes();assert len(data)==item['bytes'] and sha(data)==item['sha256'] and data[:8]==b'\x89PNG\r\n\x1a\n';offset=8;count=0
 while offset<len(data):
  size=struct.unpack('>I',data[offset:offset+4])[0];kind=data[offset+4:offset+8];chunk=data[offset+8:offset+8+size];crc=struct.unpack('>I',data[offset+8+size:offset+12+size])[0];assert zlib.crc32(kind+chunk)&0xffffffff==crc;count+=1;offset+=12+size
  if kind==b'IHDR':assert struct.unpack('>II',chunk[:8])==(768,1024) and chunk[8:10]==bytes([8,6])
  if kind==b'IEND':assert size==0 and offset==len(data);break
 assert kind==b'IEND';crcs[view]=count
assert time.monotonic()-T<120
report={'passed':True,'all18original_before_after_raw_buffers_exact':True,'original_declared_scene_metadata_extras_and_all7material_projections_exact':True,'sleeve_raw_routes4roles_and_header_exact':True,'all47048points3views_projection_maxdelta':maxdelta,'actual_glyph_corner_projection_and_nonoverlap':True,'PNG_CRC_chunks':crcs,'all_pins':len(E['pins']),'limits':'Stored receipts/raw buffers only. Actual whole images required for shape judgment; static fit remains refused. No native replay or universal source-state guarantee.'}
with (P/'ROOT-RESULT.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report))
