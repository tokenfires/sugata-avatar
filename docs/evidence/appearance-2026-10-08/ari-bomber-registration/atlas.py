"""One fresh source-body point atlas; no seam chords, sourceblend or garment geometry."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,datetime,struct
import bpy,numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
H=Path(__file__).resolve().parent
R={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'outputs':[],'role':'Artist source-registration point atlas, not anatomy/Ari appearance/garment fit','omitted':'Auxiliary eyes/hair/rig/current skin look; no garment','continuous_seam':'UNAUTHORED_REQUIRED','marker_contact':'Source-centered display octahedra deliberately touching/intersecting skin; no clearance claim'}
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
def require(ok,message):
 if not ok:raise RuntimeError(message)
def pins():
 for row in json.loads((H/'EXEC-ATLAS.json').read_text())['pins']:
  p=Path(row['path'])
  with p.open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
  require(p.stat().st_size==row['bytes'] and d==row['sha256'],'Exact pin '+str(p))
def orient(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=1;n.inputs['Metallic'].default_value=0;n.inputs['Specular IOR Level'].default_value=0;return m
def mesh_read(obj):
 me=obj.data;coords=np.empty((len(me.vertices),3),dtype=np.float32);me.vertices.foreach_get('co',coords.ravel());triangles=np.array([tuple(p.vertices) for p in me.polygons],dtype=np.int32);indices=np.empty(len(me.polygons),dtype=np.int32);me.polygons.foreach_get('material_index',indices)
 require(np.isfinite(coords).all() and not obj.modifiers and me.shape_keys is None and obj.parent is None,'Finite owned mesh/no external modifiers or parents')
 return coords,triangles,indices
def display_read(body,world,triangles,markers,local,faces,config,scene,lighting):
 v,t,ix=mesh_read(body);require(np.array_equal(v,world) and np.array_equal(t,triangles) and (ix==0).all() and np.array_equal(np.array(body.matrix_world),np.eye(4)),'Exact source body/indices/transform');require(all(p.use_smooth for p in body.data.polygons),'Body smooth display')
 require([m.name for m in body.data.materials]==['RegistrationGray'],'Exact body slot');body_shas={'body_world_sha256':sha(v),'body_triangles_sha256':sha(t),'body_material_indices_sha256':sha(ix)}
 colors={'RegistrationGray':config['body_color']};colors.update({'Registration-'+k:v for k,v in config['role_colors'].items()});require(set(bpy.data.materials.keys())==set(colors),'Exact5 owned material namespace');materials=[]
 for name,color in colors.items():
  m=bpy.data.materials[name];n=m.node_tree.nodes['Principled BSDF'];rgba=list(n.inputs['Base Color'].default_value);require(np.array_equal(np.array(rgba,dtype=np.float32),np.array([*color,1],dtype=np.float32)),'Exact configured color '+name);require(n.inputs['Roughness'].default_value==1 and n.inputs['Metallic'].default_value==n.inputs['Specular IOR Level'].default_value==0,'Exact matte display '+name);materials.append({'name':name,'rgba':rgba,'roughness':1,'metallic':0,'specular':0})
 observed=[]
 for row in markers:
  obj=bpy.data.objects[row['object']];v,t,ix=mesh_read(obj);require(np.array_equal(v,local) and np.array_equal(t,faces) and (ix==0).all() and not any(p.use_smooth for p in obj.data.polygons),'Exact local octahedral marker mesh')
  matrix=np.array(obj.matrix_world);require(np.array_equal(matrix[:3,:3],np.eye(3)) and np.array_equal(matrix[:3,3].astype(np.float32),np.array(row['source_point'],dtype=np.float32)) and np.array_equal(matrix[3],np.array([0,0,0,1])),'Exact source-centered marker transform')
  require([m.name for m in obj.data.materials]==['Registration-'+row['role']],'Exact role marker slot');observed.append({'object':obj.name,'source_vertex':row['source_vertex'],'source_point':matrix[:3,3].tolist(),'role':row['role'],'local_coordinates_sha256':sha(v),'triangles_sha256':sha(t),'material':obj.data.materials[0].name})
 lights=[]
 for expected in lighting:
  obj=bpy.data.objects[expected['name']];data=obj.data;row={'name':obj.name,'position':list(obj.location),'energy':float(data.energy),'size':float(data.size),'shape':data.shape,'color':list(data.color)};require(row==expected,'Exact achromatic disk light');row['matrix_world']=[list(v) for v in obj.matrix_world];lights.append(row)
 require(scene.world.name=='RegistrationWorld' and np.array_equal(np.array(scene.world.node_tree.nodes['Background'].inputs['Color'].default_value,dtype=np.float32),np.array([.2,.2,.2,1],dtype=np.float32)) and scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value==float(np.float32(.4)),'Exact world')
 require(scene.render.engine=='CYCLES' and scene.cycles.device=='CPU' and scene.cycles.samples==16 and scene.cycles.seed==0 and scene.cycles.use_denoising and scene.cycles.denoiser=='OPENIMAGEDENOISE' and not scene.cycles.denoising_use_gpu,'Exact CPU16 rendering')
 require(scene.render.threads_mode=='FIXED' and scene.render.threads==16 and scene.render.resolution_x==768 and scene.render.resolution_y==1024 and scene.render.resolution_percentage==100 and scene.render.pixel_aspect_x==scene.render.pixel_aspect_y==1,'Exact output domain')
 require(scene.render.film_transparent and not scene.render.use_compositing and not scene.render.use_sequencer and scene.render.image_settings.file_format=='PNG' and scene.render.image_settings.color_mode=='RGBA','Exact PNG pipeline')
 require(scene.view_settings.view_transform=='AgX' and scene.view_settings.look=='None' and scene.display_settings.display_device=='sRGB' and scene.view_settings.exposure==0 and scene.view_settings.gamma==1 and not scene.view_settings.use_curve_mapping,'Exact look')
 return {**body_shas,'materials':materials,'markers':observed,'lighting':lights,'render_look_matches_contract':True}
try:
 pins();require(not any((H/n).exists() for n in ['ATLAS-RESULT.json','atlas-front.png','atlas-front-left.png','atlas-rear.png']),'Exclusive first atlas')
 config=json.loads((H/'ATLAS-CONTRACT.json').read_text());query=json.loads((H/'RESULT.json').read_text());require(query['passed'] and len(query['anchors'])==8,'Eight source references passed')
 source=next(row['path'] for row in json.loads((H/'INPUTS.json').read_text()) if row['path'].endswith('/after-geometry.npz'))
 with np.load(source,allow_pickle=False) as z:world=z['Human_world'];triangles=z['Human_triangles']
 require(world.shape==(13380,3) and world.dtype==np.float32 and triangles.shape==(26756,3) and triangles.dtype==np.int32 and sha(world)==query['source']['world_sha256'] and sha(triangles)==query['source']['triangles_sha256'],'Literal exact source arrays')
 bpy.ops.wm.read_factory_settings(use_empty=True);require(not bpy.data.objects and not bpy.data.meshes,'Fresh factory-empty ownership');scene=bpy.context.scene
 me=bpy.data.meshes.new('RegistrationBodyMesh');me.from_pydata(world.tolist(),[],triangles.tolist());me.update();body=bpy.data.objects.new('RegistrationBody',me);scene.collection.objects.link(body);gray=material('RegistrationGray',config['body_color']);me.materials.append(gray);me.polygons.foreach_set('use_smooth',np.ones(len(triangles),dtype=bool))
 mats={role:material('Registration-'+role,color) for role,color in config['role_colors'].items()};radius=config['marker_radius'];local=np.array([[radius,0,0],[-radius,0,0],[0,radius,0],[0,-radius,0],[0,0,radius],[0,0,-radius]],dtype=np.float32);faces=np.array([[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]],dtype=np.int32);markers=[];framepoints=world.astype(float).tolist()
 for anchor in query['anchors']:
  i=anchor['source_vertex'];require(np.array_equal(world[i],anchor['source_point']),'Exact selected source center');name='Registration-'+anchor['side']+'-'+anchor['role'];me=bpy.data.meshes.new(name+'Mesh');me.from_pydata(local.tolist(),[],faces.tolist());me.update();obj=bpy.data.objects.new(name,me);scene.collection.objects.link(obj);obj.location=anchor['source_point'];me.materials.append(mats[anchor['role']]);bpy.context.view_layer.update()
  vertices,markerfaces,indices=mesh_read(obj);require(np.array_equal(vertices,local) and np.array_equal(markerfaces,faces),'Exact marker source shape');actual=[tuple(obj.matrix_world@v.co) for v in me.vertices];require(np.isfinite(actual).all(),'Finite actual transformed marker geometry');framepoints.extend(actual);markers.append({'side':anchor['side'],'role':anchor['role'],'object':name,'source_vertex':i,'source_point':anchor['source_point'],'marker_radius':float(np.float32(radius)),'local_coordinates_sha256':sha(local),'triangles_sha256':sha(faces)})
 R['markers']=markers;R['source']={'world_sha256':sha(world),'triangles_sha256':sha(triangles),'vertices':len(world),'triangles':len(triangles)}
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.seed=0;scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE';scene.cycles.denoising_use_gpu=False
 scene.render.threads_mode='FIXED';scene.render.threads=16;scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100;scene.render.pixel_aspect_x=1;scene.render.pixel_aspect_y=1
 scene.render.use_compositing=False;scene.render.use_sequencer=False;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
 scene.view_settings.view_transform='AgX';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1;scene.view_settings.use_curve_mapping=False;scene.display_settings.display_device='sRGB'
 target=(world.min(axis=0).astype(float)+world.max(axis=0).astype(float))/2;wo=bpy.data.worlds.new('RegistrationWorld');wo.use_nodes=True;wo.node_tree.nodes['Background'].inputs['Color'].default_value=(.2,.2,.2,1);wo.node_tree.nodes['Background'].inputs['Strength'].default_value=.4;scene.world=wo
 lighting=[]
 for name,pos,energy in [('Key',(-3,-4,4),700),('Fill',(3,-2,3),450),('Rear',(0,4,4),600)]:
  data=bpy.data.lights.new('Registration'+name,'AREA');data.energy=energy;data.size=4;data.shape='DISK';data.color=(1,1,1);obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=pos;orient(obj,target);lighting.append({'name':obj.name,'position':list(obj.location),'energy':float(data.energy),'size':float(data.size),'shape':data.shape,'color':list(data.color)})
 data=bpy.data.cameras.new('RegistrationCamera');data.type='ORTHO';data.sensor_fit='VERTICAL';data.clip_start=.01;data.clip_end=100;camera=bpy.data.objects.new('RegistrationCamera',data);scene.collection.objects.link(camera);scene.camera=camera
 framepoints=np.array(framepoints,dtype=float);require(framepoints.shape==(13380+48,3),'Exact source plus48 marker frame vertices');spans=[]
 for direction in config['view_directions'].values():
  camera.location=Vector(target)+Vector(direction).normalized()*5;orient(camera,target);bpy.context.view_layer.update();inverse=np.array(camera.matrix_world.inverted());localpoints=np.c_[framepoints,np.ones(len(framepoints))]@inverse.T;spans.append(max(2*float(np.abs(localpoints[:,1]).max()),2*float(np.abs(localpoints[:,0]).max())/(768/1024)))
 data.ortho_scale=max(spans)/.92;R['frame']={'target':target.tolist(),'scale':data.ortho_scale,'resolution':[768,1024],'pad_each_side':.04,'actual_source_marker_vertices':len(framepoints)}
 owned={'RegistrationBody','RegistrationKey','RegistrationFill','RegistrationRear','RegistrationCamera'}|{row['object'] for row in markers};require(set(bpy.data.objects.keys())==owned and len(owned)==13,'Exact owned13object namespace');R['owned_display_baseline']=display_read(body,world,triangles,markers,local,faces,config,scene,lighting)
 for name,direction in config['view_directions'].items():
  camera.location=Vector(target)+Vector(direction).normalized()*5;orient(camera,target);bpy.context.view_layer.update();require(display_read(body,world,triangles,markers,local,faces,config,scene,lighting)==R['owned_display_baseline'],'Exact source/display before first pixels')
  projected=np.array([tuple(world_to_camera_view(scene,camera,Vector(p))) for p in framepoints]);require(np.isfinite(projected).all() and (projected[:,2]>0).all() and (projected[:,:2]>=.039999).all() and (projected[:,:2]<=.960001).all(),'Full source+marker frame')
  point_projections=[{'side':row['side'],'role':row['role'],'source_vertex':row['source_vertex'],'normalized':list(world_to_camera_view(scene,camera,Vector(row['source_point']))),'not_occlusion_or_artist_proof':True} for row in markers]
  path=H/('atlas-'+name+'.png');require(not path.exists(),'Exclusive first original');scene.render.filepath=str(path);require(bpy.ops.render.render(write_still=True)=={'FINISHED'} and path.is_file(),'First render completes');payload=path.read_bytes();require(len(payload)<=10485760 and payload[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',payload[16:24])==(768,1024),'Exact PNGdomain/cap')
  require(set(bpy.data.objects.keys())==owned and display_read(body,world,triangles,markers,local,faces,config,scene,lighting)==R['owned_display_baseline'],'Exact source/display after render');R['outputs'].append({'name':name,'file':path.name,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'camera_position':list(camera.location),'projected_min':projected.min(axis=0).tolist(),'projected_max':projected.max(axis=0).tolist(),'anchor_projections':point_projections})
 require(len(R['outputs'])==3,'Three first original views');pins();R['post_pins_exact']=True;R['passed']=True
except Exception as e:R['error']={'type':type(e).__name__,'message':str(e)};print('ATLAS ERROR',str(e))
finally:
 R['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (H/'ATLAS-RESULT.json').open('x') as f:json.dump(R,f,indent=2);f.write('\n')
 print(json.dumps({'passed':R['passed'],'outputs':len(R['outputs']),'error':R.get('error')}))
 if not R['passed']:raise SystemExit(1)
