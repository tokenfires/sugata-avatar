"""One fresh owned body-only source chart, never opens/saves a source .blend."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,datetime,math,struct
import bpy,numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
H=Path(__file__).resolve().parent
R={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'outputs':[],'role':'Source-edge attachment path chart, not Ari appearance/anatomy/garment fit','omitted':'eyes/hair/other auxiliaries/rig/materials/shape keys','physical_clearance':'UNKNOWN','marker_contact':'Display-only touching source surface; not clearance-qualified'}
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
def require(ok,message):
 if not ok:raise RuntimeError(message)
def pins():
 for p in json.loads((H/'EXEC-CHART.json').read_text())['pins']:
  b=Path(p['path']).read_bytes();require(len(b)==p['bytes'] and hashlib.sha256(b).hexdigest()==p['sha256'],'Pin changed: '+p['path'])
def orient(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=1;n.inputs['Metallic'].default_value=0;n.inputs['Specular IOR Level'].default_value=0
 return m
def source_readback(body,world,triangles,indices):
 me=body.data;v=np.empty((len(me.vertices),3),dtype=np.float32);me.vertices.foreach_get('co',v.ravel());t=np.array([tuple(p.vertices) for p in me.polygons],dtype=np.int32);ix=np.empty(len(me.polygons),dtype=np.int32);me.polygons.foreach_get('material_index',ix)
 require(np.array_equal(v,world) and np.array_equal(t,triangles),'Exact reconstructed source arrays');require(np.array_equal(ix,indices),'Exact owned face material indices');require(len(body.modifiers)==0 and me.shape_keys is None,'No source modifiers/keys');require(np.array_equal(np.array(body.matrix_world),np.eye(4)),'Identity source-chart body transform')
 return {'world_sha256':sha(v),'triangles_sha256':sha(t),'material_indices_sha256':sha(ix),'vertices':len(v),'triangles':len(t),'object':body.name,'mesh':me.name}
def owned_display(config,body,curve_records,lighting,scene):
 expected_materials={'JunctionBody-'+k:v for k,v in config['body_materials'].items()}
 expected_materials.update({'JunctionMarker-'+k:v for k,v in config['marker_materials'].items()})
 require(set(bpy.data.materials.keys())==set(expected_materials),'Exact owned material namespace')
 material_records=[]
 for name,color in expected_materials.items():
  m=bpy.data.materials[name];n=m.node_tree.nodes['Principled BSDF'];actual=list(n.inputs['Base Color'].default_value)
  require(np.array_equal(np.array(actual,dtype=np.float32),np.array([*color,1],dtype=np.float32)),'Exact configured material color: '+name)
  require(n.inputs['Roughness'].default_value==1 and n.inputs['Metallic'].default_value==0 and n.inputs['Specular IOR Level'].default_value==0,'Exact matte material: '+name)
  material_records.append({'name':name,'color':actual,'roughness':float(n.inputs['Roughness'].default_value),'metallic':float(n.inputs['Metallic'].default_value),'specular':float(n.inputs['Specular IOR Level'].default_value)})
 require([m.name for m in body.data.materials]==['JunctionBody-gray','JunctionBody-l','JunctionBody-r'],'Exact body used slots');require(all(p.use_smooth for p in body.data.polygons),'Exact owned smooth display')
 markers=[]
 for rec in curve_records:
  obj=bpy.data.objects[rec['object']];cu=obj.data
  require(np.array_equal(np.array(obj.matrix_world),np.eye(4)) and not obj.modifiers,'Identity owned marker transform/no modifiers')
  require(cu.dimensions=='3D' and cu.bevel_depth==float(np.float32(config['marker_radius'])) and cu.bevel_resolution==2 and cu.resolution_u==1 and cu.use_fill_caps,'Exact marker display parameters')
  require(len(cu.splines)==1 and cu.splines[0].type=='POLY' and cu.splines[0].use_cyclic_u and len(cu.splines[0].points)==29,'Exact closed marker route')
  require([m.name for m in cu.materials]==['JunctionMarker-'+rec['side']],'Exact marker used slot')
  control=np.empty((29,4),dtype=np.float32);cu.splines[0].points.foreach_get('co',control.ravel());require(sha(control)==rec['control_points_sha256'],'Exact owned marker controls')
  ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
  try:
   require(0<len(mesh.vertices)<=10000 and len(mesh.loops)<=100000,'Owned evaluated marker domain cap');v=np.array([tuple(x.co) for x in mesh.vertices],dtype=np.float32);loops=np.array([x.vertex_index for x in mesh.loops],dtype=np.int32);totals=np.array([x.loop_total for x in mesh.polygons],dtype=np.int32)
   require(np.isfinite(v).all(),'Finite owned marker display')
   markers.append({'object':obj.name,'control_sha256':sha(control),'evaluated_vertices_sha256':sha(v),'evaluated_loops_sha256':sha(loops),'evaluated_polygon_sizes_sha256':sha(totals),'vertices':len(v),'radius':float(cu.bevel_depth),'cyclic':cu.splines[0].use_cyclic_u,'material':cu.materials[0].name})
  finally:ev.to_mesh_clear()
 light_records=[]
 for expected in lighting:
  obj=bpy.data.objects[expected['name']];data=obj.data
  row={'name':obj.name,'position':list(obj.location),'energy':float(data.energy),'size':float(data.size),'shape':data.shape,'color':list(data.color)};require(row==expected,'Exact white disk light: '+obj.name);row['matrix_world']=[list(row) for row in obj.matrix_world];light_records.append(row)
 require(scene.world.name=='JunctionWorld' and list(scene.world.node_tree.nodes['Background'].inputs['Color'].default_value)==list(map(float,np.array([.2,.2,.2,1],dtype=np.float32))) and scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value==float(np.float32(.4)),'Exact neutral world')
 require(scene.render.engine=='CYCLES' and scene.cycles.device=='CPU' and scene.cycles.samples==16 and scene.cycles.seed==0 and scene.cycles.use_denoising and scene.cycles.denoiser=='OPENIMAGEDENOISE' and not scene.cycles.denoising_use_gpu,'Exact CPU renderer')
 require(scene.render.threads_mode=='FIXED' and scene.render.threads==16 and scene.render.resolution_x==768 and scene.render.resolution_y==1024 and scene.render.resolution_percentage==100 and scene.render.pixel_aspect_x==scene.render.pixel_aspect_y==1,'Exact output domain')
 require(scene.render.film_transparent and not scene.render.use_compositing and not scene.render.use_sequencer and scene.render.image_settings.file_format=='PNG' and scene.render.image_settings.color_mode=='RGBA','Exact PNG pipeline')
 require(scene.view_settings.view_transform=='AgX' and scene.view_settings.look=='None' and scene.display_settings.display_device=='sRGB' and scene.view_settings.exposure==0 and scene.view_settings.gamma==1 and not scene.view_settings.use_curve_mapping,'Exact display look')
 return {'materials':material_records,'markers':markers,'lights':light_records,'settings_match_contract':True}
try:
 pins();require(not any((H/n).exists() for n in ['CHART-RESULT.json','chart-front.png','chart-front-left.png','chart-rear.png']),'Exclusive first chart outputs')
 config=json.loads((H/'CHART-CONTRACT.json').read_text());query=json.loads((H/'RESULT.json').read_text());require(query['passed'],'Source query pass required')
 source=next(x['path'] for x in json.loads((H/'INPUTS.json').read_text()) if x['path'].endswith('/after-geometry.npz'))
 with np.load(source,allow_pickle=False) as z:world=z['Human_world'];triangles=z['Human_triangles']
 require(world.dtype==np.float32 and world.shape==(13380,3) and triangles.dtype==np.int32 and triangles.shape==(26756,3),'Literal source domains');require(sha(world)==query['source']['world_sha256'] and sha(triangles)==query['source']['triangles_sha256'],'Exact source hashes')
 require((H/'fields.npz').stat().st_size<=2097152,'Derived archive cap2MiB');indices=np.zeros(len(triangles),dtype=np.int32);used=set()
 with np.load(H/'fields.npz',allow_pickle=False) as z:
  for index,side in enumerate(['l','r'],1):
   ids=z[side+'_arm_faces'];record=next(row for row in query['sides'] if row['side']==side);require(ids.dtype==np.int32 and ids.shape==(4221,) and np.array_equal(ids,np.unique(ids)) and ids.min()>=0 and ids.max()<len(triangles),'Exact sorted sourceface domain');require(sha(ids)==record['arm_component']['sha256'] and record['accepted_source_association'],'Exact sourceface component association');require(not used.intersection(ids.tolist()),'Disjoint sourceface components');used.update(ids.tolist());indices[ids]=index
 bpy.ops.wm.read_factory_settings(use_empty=True);require(not bpy.data.objects and not bpy.data.meshes,'Fresh empty scene ownership');scene=bpy.context.scene
 me=bpy.data.meshes.new('JunctionSourceBodyMesh');me.from_pydata(world.tolist(),[],triangles.tolist());me.update();body=bpy.data.objects.new('JunctionSourceBody',me);scene.collection.objects.link(body)
 colors=config['body_materials']
 for label in ['gray','l','r']:me.materials.append(material('JunctionBody-'+label,colors[label]))
 me.polygons.foreach_set('material_index',indices);me.polygons.foreach_set('use_smooth',np.ones(len(triangles),dtype=bool))
 R['body']=source_readback(body,world,triangles,indices);R['color_scope']='Exact arm-reference face components colored, fullremainingbody retained; source registration only, no garmentcoverage/cuts';R['material_face_counts']={str(i):int(np.count_nonzero(indices==i)) for i in [0,1,2]}
 marker_points=[];curve_records=[]
 for rec in query['sides']:
  points=np.array(rec['cycle_points'],dtype=np.float64);require(points.shape==(29,3) and np.array_equal(points,world[rec['cycle_vertex_ids']]),'Literal29-point sourceedge cycle');co=np.ones((29,4),dtype=np.float32);co[:,:3]=points.astype(np.float32)
  cu=bpy.data.curves.new('JunctionBoundary-'+rec['side'],'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=config['marker_radius'];cu.bevel_resolution=2;cu.use_fill_caps=True;spline=cu.splines.new('POLY');spline.points.add(28);spline.points.foreach_set('co',co.ravel());spline.use_cyclic_u=True
  obj=bpy.data.objects.new(cu.name,cu);scene.collection.objects.link(obj);cu.materials.append(material('JunctionMarker-'+rec['side'],config['marker_materials'][rec['side']]))
  read=np.empty_like(co);spline.points.foreach_get('co',read.ravel());require(np.array_equal(read,co),'Exact owned marker Float32 conversion');error=float(np.max(np.abs(read[:,:3].astype(float)-points)));require(error<1e-7,'Finite bounded display conversion')
  bpy.context.view_layer.update();ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
  try:
   require(0<len(mesh.vertices)<=10000,'Finite owned marker geometry cap');pv=np.array([tuple(v.co) for v in mesh.vertices],dtype=np.float64);require(np.isfinite(pv).all(),'Finite owned marker mesh');marker_points.extend(pv.tolist())
  finally:ev.to_mesh_clear()
  curve_records.append({'side':rec['side'],'object':obj.name,'control_points_sha256':sha(read),'display_conversion_max_error':error,'radius':float(cu.bevel_depth),'control_points':len(read),'cyclic':spline.use_cyclic_u})
 R['markers']=curve_records
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.seed=0;scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE';scene.cycles.denoising_use_gpu=False
 scene.render.threads_mode='FIXED';scene.render.threads=16;scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100;scene.render.pixel_aspect_x=1;scene.render.pixel_aspect_y=1
 scene.render.use_compositing=False;scene.render.use_sequencer=False;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
 scene.view_settings.view_transform='AgX';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1;scene.view_settings.use_curve_mapping=False;scene.display_settings.display_device='sRGB'
 lo=world.min(axis=0).astype(float);hi=world.max(axis=0).astype(float);target=(lo+hi)/2
 wo=bpy.data.worlds.new('JunctionWorld');wo.use_nodes=True;wo.node_tree.nodes['Background'].inputs['Color'].default_value=(.2,.2,.2,1);wo.node_tree.nodes['Background'].inputs['Strength'].default_value=.4;scene.world=wo
 lighting=[]
 for name,pos,energy in [('Key',(-3,-4,4),700),('Fill',(3,-2,3),450),('Rear',(0,4,4),600)]:
  data=bpy.data.lights.new('Junction'+name,'AREA');data.shape='DISK';data.size=4;data.energy=energy;data.color=(1,1,1);obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=pos;orient(obj,target);lighting.append({'name':obj.name,'position':list(obj.location),'energy':float(data.energy),'size':float(data.size),'shape':data.shape,'color':list(data.color)})
 data=bpy.data.cameras.new('JunctionCamera');data.type='ORTHO';data.sensor_fit='VERTICAL';data.clip_start=.01;data.clip_end=100;camera=bpy.data.objects.new('JunctionCamera',data);scene.collection.objects.link(camera);scene.camera=camera
 viewdirs=config['view_directions'];framepoints=np.vstack((world.astype(float),np.array(marker_points)));spans=[]
 for direction in viewdirs.values():
  camera.location=Vector(target)+Vector(direction).normalized()*5;orient(camera,target);bpy.context.view_layer.update();inverse=np.array(camera.matrix_world.inverted());local=np.c_[framepoints,np.ones(len(framepoints))]@inverse.T
  spans.append(max(2*float(np.abs(local[:,1]).max()),2*float(np.abs(local[:,0]).max())/(768/1024)))
 data.ortho_scale=max(spans)/.92
 R['lighting']=lighting;R['look']={'view_transform':scene.view_settings.view_transform,'look':scene.view_settings.look,'display':scene.display_settings.display_device,'exposure':scene.view_settings.exposure,'gamma':scene.view_settings.gamma};R['frame']={'target':target.tolist(),'scale':data.ortho_scale,'resolution':[768,1024],'pad_each_side':.04,'source_world_min':lo.tolist(),'source_world_max':hi.tolist(),'includes_actual_owned_marker_meshes':True}
 R['render_settings']={'engine':scene.render.engine,'device':scene.cycles.device,'samples':scene.cycles.samples,'seed':scene.cycles.seed,'denoising':scene.cycles.use_denoising,'denoiser':scene.cycles.denoiser,'denoising_use_gpu':scene.cycles.denoising_use_gpu,'threads':scene.render.threads,'transparent':scene.render.film_transparent,'compositing':scene.render.use_compositing,'sequencer':scene.render.use_sequencer}
 R['materials']=[{'name':m.name,'base_color':list(m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value),'roughness':float(m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value),'metallic':float(m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value),'specular':float(m.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value)} for m in bpy.data.materials]
 owned=set(['JunctionSourceBody','JunctionBoundary-l','JunctionBoundary-r','JunctionKey','JunctionFill','JunctionRear','JunctionCamera']);require(set(bpy.data.objects.keys())==owned,'Exact owned object namespace')
 R['owned_display_baseline']=owned_display(config,body,curve_records,lighting,scene)
 for name,direction in viewdirs.items():
  camera.location=Vector(target)+Vector(direction).normalized()*5;orient(camera,target);bpy.context.view_layer.update();source_readback(body,world,triangles,indices);require(owned_display(config,body,curve_records,lighting,scene)==R['owned_display_baseline'],'Owned display before first pixels: '+name)
  for curve in R['markers']:
   arr=np.empty((29,4),dtype=np.float32);bpy.data.objects[curve['object']].data.splines[0].points.foreach_get('co',arr.ravel());require(sha(arr)==curve['control_points_sha256'],'Owned marker controls unchanged')
  projected=np.array([tuple(world_to_camera_view(scene,camera,Vector(p))) for p in framepoints]);require(np.isfinite(projected).all() and (projected[:,2]>0).all() and (projected[:,:2]>=.039999).all() and (projected[:,:2]<=.960001).all(),'Complete source+marker frame: '+name)
  path=H/('chart-'+name+'.png');require(not path.exists(),'Exclusive first image: '+name);scene.render.filepath=str(path);require(bpy.ops.render.render(write_still=True)=={'FINISHED'} and path.is_file(),'First render complete: '+name)
  payload=path.read_bytes();require(len(payload)<=10485760 and payload[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',payload[16:24])==(768,1024),'Exact first PNG domain/cap')
  R['outputs'].append({'name':name,'file':path.name,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'camera_position':list(camera.location),'projected_min':projected.min(axis=0).tolist(),'projected_max':projected.max(axis=0).tolist()});require(set(bpy.data.objects.keys())==owned,'Owned namespace after render');require(source_readback(body,world,triangles,indices)==R['body'],'Source unchanged after render');require(owned_display(config,body,curve_records,lighting,scene)==R['owned_display_baseline'],'Owned display unchanged after render: '+name)
 require(len(R['outputs'])==3,'Three first originals');pins();R['post_pins_exact']=True;R['passed']=True
except Exception as e:R['error']={'type':type(e).__name__,'message':str(e)};print('CHART ERROR',str(e))
finally:
 R['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (H/'CHART-RESULT.json').open('x') as f:json.dump(R,f,indent=2);f.write('\n')
 print(json.dumps({'passed':R['passed'],'outputs':len(R['outputs']),'error':R.get('error')}))
 if not R['passed']:raise SystemExit(1)
