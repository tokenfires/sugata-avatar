"""First fixed refused-sleeve views on the qualified Ari actor. No save or retune."""
from pathlib import Path
import json, hashlib, datetime, time, sys, ast, importlib.util, math, os, struct
sys.dont_write_bytecode=True
import bpy
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent
E=json.loads((P/'EXEC.json').read_text()); I=E['inputs']; T=time.monotonic()
R={'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'fit_status':'REFUSED_TRANSVERSE','candidate_promotion':False,'saved':False,'outputs':[],'checks':[]}
def check(x,label):
 if not x: raise RuntimeError(label)
 R['checks'].append(label)
def sha(b):return hashlib.sha256(b).hexdigest()
def write(name,v):
 b=(json.dumps(v,indent=2)+'\n').encode();check(len(b)<=8388608,'JSON bound '+name)
 with (P/name).open('xb') as f:f.write(b)
def clock():check(time.monotonic()-T<175 and datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(E['finish_before']),'Native clock')
def pins():
 for row in E['pins']:
  b=Path(row['path']).read_bytes();check(len(b)==row['bytes'] and sha(b)==row['sha256'],'Pin '+row['path'])
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def clean_value(v):
 if isinstance(v,str):check(len(v)<=4096,'Bounded string');return v
 if v is None or isinstance(v,(bool,int)):return v
 if isinstance(v,float):check(math.isfinite(v),'finite shader value');return v
 check(len(v)<=16,'fixed shader array bound');return [clean_value(x) for x in v]
def graph(m):
 check(m.use_nodes and m.node_tree is not None and len(m.node_tree.nodes)==2 and len(m.node_tree.links)==1,'Complete owned two-node graph')
 check(m.animation_data is None and m.node_tree.animation_data is None,'Unanimated owned material/tree')
 return {'name':m.name,'diffuse_color':list(m.diffuse_color),'use_nodes':m.use_nodes,'backface_culling':m.use_backface_culling,'nodes':[{'name':n.name,'id':n.bl_idname,'mute':n.mute,'parent':n.parent.name if n.parent else None,'active':getattr(n,'is_active_output',None),'target':getattr(n,'target',None),'inputs':{s.identifier:clean_value(s.default_value) for s in n.inputs if hasattr(s,'default_value')}} for n in m.node_tree.nodes],'links':[[l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier] for l in m.node_tree.links]}
MAT_FIELDS=['use_nodes','surface_render_method','displacement_method','blend_method','alpha_threshold','use_backface_culling','use_backface_culling_shadow','use_backface_culling_lightprobe_volume','use_transparency_overlap','use_transparent_shadow','use_raytrace_refraction','diffuse_color','roughness','metallic']
NODE_FIELDS=['bl_idname','mute','is_active_output','target','interpolation','extension','projection','blend_type','use_clamp']
def source_materials():
 out={}
 for name,old in material_reference.items():
  m=bpy.data.materials[name];check(m.node_tree is not None and len(m.node_tree.nodes)<=8 and len(m.node_tree.links)<=8,'Finite original source graph')
  nodes=[]
  for n in m.node_tree.nodes:
   check(len(n.inputs)<=64,'Finite original shader input count')
   row={'name':n.name,'type':n.type,'fields':{k:clean_value(getattr(n,k)) for k in NODE_FIELDS if k in next(r for r in old['record']['nodes'] if r['name']==n.name)['rna']},'inputs':{a.identifier:clean_value(a.default_value) for a in n.inputs if hasattr(a,'default_value')}}
   nodes.append(row)
  out[name]={'fields':{k:clean_value(getattr(m,k)) for k in MAT_FIELDS if k in old['record']['rna']},'nodes':nodes,'links':sorted([[l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier] for l in m.node_tree.links]),'image_pointers':{n.name:n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE'},'users':m.users,'fake_user':m.use_fake_user,'custom':dict(m.items()),'tree_custom':dict(m.node_tree.items()),'nodes_custom':{n.name:dict(n.items()) for n in m.node_tree.nodes}}
 return out
def material_projection(old):
 return {'fields':{k:old['record']['rna'][k] for k in MAT_FIELDS if k in old['record']['rna']},'nodes':[{'name':n['name'],'type':n['type'],'fields':{k:n['rna'][k] for k in NODE_FIELDS if k in n['rna']},'inputs':n['inputs']} for n in old['record']['nodes']],'links':sorted(old['record']['links']),'image_pointers':old['image_pointers'],'users':old['users'],'fake_user':old['fake_user'],'custom':old['custom'],'tree_custom':old['tree_custom'],'nodes_custom':old['nodes_custom']}
def original_state():
 s=H.capture_scene(); s['objects']=[r for r in s['objects'] if r['name'] in names];s['materials']=[r for r in s['materials'] if r['name'] in matnames]
 check({r['name'] for r in s['images']}==imgnames,'Exact source image scope')
 return {'scene':s,'metadata':C.meta(),'extras':C.original_extras(names),'mixed_sha256':C.digest(C.mixed(bpy.data.objects['Human'])),'source_materials':source_materials()}
def sleeve_state():
 o=bpy.data.objects['SugataRejectedSleeves'];me=o.data;me.calc_loop_triangles()
 v=C.bulk(me.vertices,'co',3);tri=C.bulk(me.loop_triangles,'vertices',3,np.int32);role=C.bulk(me.polygons,'material_index',1,np.int32);sm=C.bulk(me.polygons,'use_smooth',1,np.int32)
 check(v.shape==mv.shape and v.tobytes()==mv.tobytes(),'Exact sleeve native coordinates')
 check(tri.shape==mt.shape and tri.tobytes()==mt.tobytes(),'Exact sleeve native triangle order')
 check(role.tobytes()==mr.astype(np.int32).tobytes() and not sm.any(),'Exact face role and flat smoothing')
 check(o.parent is None and len(o.modifiers)==len(o.constraints)==0 and me.shape_keys is None and len(me.uv_layers)==0,'No unowned panel deformation/UV')
 return {'v':C.digest(v),'tri':C.digest(tri),'role':C.digest(role),'smoothing':C.digest(sm),'matrix':[list(x) for x in o.matrix_world],'slots':[[s.link,s.material.name] for s in o.material_slots],'fit_status':o['fit_status'],'graphs':[graph(m) for m in me.materials]}
def label_state():
 cfg=E['label'];o=bpy.data.objects[cfg['object']];f=o.data;m=bpy.data.materials[cfg['material']]
 check(o.type=='FONT' and o.parent==cam and not o.modifiers and not o.constraints and o.animation_data is None,'Owned camera-local FONT label')
 check(f.body==cfg['body'] and f.size==float(np.float32(cfg['size'])) and f.align_x=='CENTER' and f.align_y=='BOTTOM' and f.extrude==f.bevel_depth==0,'Literal per-image standalone/refusal text and glyph settings')
 check(list(o.location)==np.asarray([0,cam.data.ortho_scale*cfg['y_fraction'],-1],dtype=np.float32).astype(float).tolist() and list(o.rotation_euler)==[0,0,0] and list(o.scale)==[1,1,1],'Fixed annotation transform')
 check([x.name for x in f.materials]==[cfg['material']] and f.animation_data is None,'One unanimated annotation route')
 g=graph(m);em=m.node_tree.nodes['RefusalEmission'];out=m.node_tree.nodes['RefusalOutput']
 check(list(em.inputs['Color'].default_value)==np.asarray(cfg['rgba'],dtype=np.float32).astype(float).tolist() and em.inputs['Strength'].default_value==1,'Exact annotation emission sockets')
 check(out.target=='ALL' and out.is_active_output and not em.mute and not out.mute and em.parent is None and out.parent is None,'Exact active unmuted annotation output')
 check(g['links']==[['RefusalEmission','Emission','RefusalOutput','Surface']] and not any(x.is_linked for x in em.inputs) and not out.inputs['Volume'].is_linked and not out.inputs['Displacement'].is_linked,'No extra annotation route')
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());check([list(x) for x in ev.matrix_world]==[list(x) for x in o.matrix_world],'Exact undeformed annotation world matrix');corners=[list(x) for x in ev.bound_box];check(len(corners)==8 and np.isfinite(corners).all() and max(x[0] for x in corners)>min(x[0] for x in corners) and max(x[1] for x in corners)>min(x[1] for x in corners),'Actual nonempty glyph bounds')
 return {'body':f.body,'size':f.size,'align':[f.align_x,f.align_y],'extrude':f.extrude,'bevel':f.bevel_depth,'matrix_basis':[list(x) for x in o.matrix_basis],'parent':o.parent.name,'font_observed':f.font.name,'actual_local_corners':corners,'graph':g}
def display():
 s=bpy.context.scene
 observed={'render':{k:getattr(s.render,k) for k in ['engine','resolution_x','resolution_y','resolution_percentage','pixel_aspect_x','pixel_aspect_y','threads_mode','threads','film_transparent','use_compositing','use_sequencer']},'image':{k:getattr(s.render.image_settings,k) for k in ['file_format','color_mode','color_depth','compression']},'cycles':{k:getattr(s.cycles,k) for k in ['device','samples','seed','use_denoising','denoiser','denoising_use_gpu']},'look':{k:getattr(s.view_settings,k) for k in ['view_transform','look','exposure','gamma','use_curve_mapping']},'display_device':s.display_settings.display_device,'camera':{'data':{k:getattr(cam.data,k) for k in ['type','sensor_fit','clip_start','clip_end','ortho_scale']},'matrix':[list(x) for x in cam.matrix_world]},'lights':{n:{'matrix':[list(x) for x in bpy.data.objects[n].matrix_world],'data':{k:clean_value(getattr(bpy.data.objects[n].data,k)) for k in ['type','energy','exposure','color','shape','size','use_nodes']},'nodes': [{'id':x.bl_idname,'inputs':{a.identifier:clean_value(a.default_value) for a in x.inputs if hasattr(a,'default_value')}} for x in bpy.data.objects[n].data.node_tree.nodes] if bpy.data.objects[n].data.node_tree else None,'links':[[l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier] for l in bpy.data.objects[n].data.node_tree.links] if bpy.data.objects[n].data.node_tree else None} for n in diag if n!=cam.name},'label':label_state(),'world':{'use_nodes':world.use_nodes,'nodes':[{'id':n.bl_idname,'inputs':{a.identifier:clean_value(a.default_value) for a in n.inputs if hasattr(a,'default_value')}} for n in world.node_tree.nodes],'links':[[l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier] for l in world.node_tree.links]}}

 expected_render={'engine':'CYCLES','resolution_x':768,'resolution_y':1024,'resolution_percentage':100,'pixel_aspect_x':1,'pixel_aspect_y':1,'threads_mode':'FIXED','threads':16,'film_transparent':True,'use_compositing':False,'use_sequencer':False}
 check(observed['render']==expected_render,'Exact intended CPU image/output/render domain')
 check(observed['image']=={'file_format':'PNG','color_mode':'RGBA','color_depth':'8','compression':15},'Exact intended PNG pipeline')
 check(observed['cycles']=={'device':'CPU','samples':16,'seed':0,'use_denoising':True,'denoiser':'OPENIMAGEDENOISE','denoising_use_gpu':False},'Exact intended CPU Cycles/denoiser domain')
 check(observed['camera']['data']=={'type':'ORTHO','sensor_fit':'VERTICAL','clip_start':float(np.float32(.01)),'clip_end':100,'ortho_scale':R['frame']['scale']},'Exact intended orthographic camera')
 check(observed['look']=={'view_transform':'AgX','look':'None','exposure':0,'gamma':1,'use_curve_mapping':False} and observed['display_device']=='sRGB','Exact intended display look')
 return observed
def check_original():
 check({o.name for o in bpy.data.objects}==names|{'SugataRejectedSleeves',E['label']['object']}|set(diag),'Exact original plus declared diagnostic owners')
 check({m.name for m in bpy.data.materials}==allmats|set(E['materials'])|{E['label']['material']},'Exact original plus four role materials and header')
 check(original_state()==base,'Original explicit state unchanged')
try:
 clock();pins();check(bpy.app.version==(5,2,2),'Bounded Blender version');check(bpy.app.background and not bpy.app.online_access,'Offline background')
 C=module('sugata_diagnostic_geometry',I['lib']['path']);H=module('sugata_diagnostic_source',I['helper']['path'])
 prior=json.loads(Path(I['cold']['path']).read_text()); expected=prior['state'];names={o['name'] for o in expected['scene']['objects']};matnames={m['name'] for m in expected['scene']['materials']};imgnames={im['name'] for im in expected['scene']['images']}
 check(bpy.ops.wm.open_mainfile(filepath=I['actor']['path'])=={'FINISHED'},'Exact saved actor open')
 check(Path(bpy.data.filepath).resolve()==Path(I['actor']['path']).resolve() and len(bpy.data.objects)==7 and {o.name for o in bpy.data.objects}==names,'Exact original actor owners')
 material_reference={**expected['original_materials'],'AriPaletteSkin':expected['owned']};allmats=set(material_reference);check({m.name for m in bpy.data.materials}==allmats,'Exact prior whole material namespace');check(not (set(E['materials'])&allmats),'Exclusive material names')
 base=original_state();write('SOURCE-OBSERVED.json',base)
 check(base=={**{k:expected[k] for k in ['scene','metadata','extras','mixed_sha256']},'source_materials':{n:material_projection(v) for n,v in material_reference.items()}},'Exact prior qualified explicit actor snapshot including retained unassigned material')
 meshes=sorted(n for n in names if bpy.data.objects[n].type=='MESH');g,arrays=C.evaluated(meshes,500000,1000000);check(g==prior['geometry'],'All original evaluated signatures exact')
 with np.load(I['geometry']['path'],allow_pickle=False) as archive:
  check(set(arrays)==set(archive.files),'All eighteen original array names')
  for n,a in arrays.items():check(a.shape==archive[n].shape and a.dtype==archive[n].dtype and a.tobytes()==archive[n].tobytes(),'Original raw geometry '+n)
 with np.load(I['sleeves']['path'],allow_pickle=False) as archive:mv=archive['world32'].copy();mt=archive['triangles'].copy();mr=archive['face_role'].copy()
 pr=json.loads(Path(I['sleeve_result']['path']).read_text())
 for n,a in [('world32',mv),('triangles',mt),('face_role',mr)]:check(C.digest(a)==pr['arrays'][n]['raw_sha256'],'Exact mesh input '+n)
 witness=json.loads(Path(I['witness']['path']).read_text());check(mv[mt[witness['cloth_triangle_id']]].tolist()==witness['cloth_points'] and arrays['Human_world'][arrays['Human_triangles'][witness['body_triangle_id']]].tolist()==witness['body_points'],'Certified pair source correspondence')
 R['source_geometry']=g; R['body_crossing_pair']=[witness['cloth_triangle_id'],witness['body_triangle_id']]
 for n,color in E['materials'].items():
  m=bpy.data.materials.new(n);m.use_nodes=True;m.use_backface_culling=False;m.diffuse_color=color;m.node_tree.nodes.clear()
  d=m.node_tree.nodes.new('ShaderNodeBsdfDiffuse');d.name='DiagnosticDiffuse';d.inputs['Color'].default_value=color;d.inputs['Roughness'].default_value=.6;d.inputs['Normal'].default_value=(0,0,0)
  out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');out.name='DiagnosticOutput';out.target='ALL';out.is_active_output=True;m.node_tree.links.new(d.outputs['BSDF'],out.inputs['Surface'])
  check(not d.mute and not out.mute and d.parent is None and out.parent is None,'Unmuted bare owned nodes')
  check(list(d.inputs['Color'].default_value)==np.asarray(color,dtype=np.float32).astype(float).tolist() and d.inputs['Roughness'].default_value==float(np.float32(.6)) and list(d.inputs['Normal'].default_value)==[0,0,0],'Exact intended Float32 role socket values')
  check(out.target=='ALL' and out.is_active_output,'Declared active output target')
  check(out.inputs['Surface'].is_linked and not out.inputs['Volume'].is_linked and not out.inputs['Displacement'].is_linked and not any(x.is_linked for x in d.inputs),'Complete opaque diffuse route/no displacement')
 me=bpy.data.meshes.new('SugataRejectedSleeveMesh');me.from_pydata(mv.tolist(),[],mt.tolist());me.update();obj=bpy.data.objects.new('SugataRejectedSleeves',me);bpy.context.scene.collection.objects.link(obj)
 for n in E['materials']:me.materials.append(bpy.data.materials[n])
 me.polygons.foreach_set('material_index',mr.astype(np.int32));me.polygons.foreach_set('use_smooth',np.zeros(len(mt),np.int32));obj['fit_status']='REFUSED_TRANSVERSE'
 js=sleeve_state();check(js['slots']==[['DATA',n] for n in E['materials']],'Exact owned role slot route');check(js['matrix']==[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],'Identity panel world frame');write('SLEEVE-OBSERVED.json',js)
 nodes=ast.parse(Path(I['renderer']['path']).read_text()).body;selected=[n for n in nodes if isinstance(n,ast.FunctionDef) and n.name in {'settings','orient'}];check({n.name for n in selected}=={'settings','orient'},'Exact two established renderer helpers');require=check;REPORT=R;R['shared_look']=E['look'];exec(compile(ast.Module(body=selected,type_ignores=[]),I['renderer']['path'],'exec'),globals())
 scene=bpy.context.scene;oldworld=scene.world;oldcamera=scene.camera;cam,diag,world=settings(scene,E['lighting_center']);check(len(diag)==4 and not set(diag)&names,'Exclusive existing renderer owners')
 scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.image_settings.color_depth='8';scene.render.image_settings.compression=15
 points=np.concatenate([a for n,a in arrays.items() if n.endswith('_world')]+[mv]).astype(float);check(len(points)==47048 and np.isfinite(points).all(),'Complete finite actor plus panel frame domain')
 target=Vector(((points.min(0)+points.max(0))/2).tolist());spans=[]
 for view,direction in E['views']:
  cam.location=target+Vector(direction).normalized()*5;orient(cam,target);bpy.context.view_layer.update();local=np.c_[points,np.ones(len(points))]@np.array(cam.matrix_world.inverted()).T;spans.append(max(np.abs(local[:,1]).max()*2,np.abs(local[:,0]).max()*2/(768/1024)))
 cam.data.ortho_scale=max(spans)*1.20;R['frame']={'target':list(target),'scale':cam.data.ortho_scale,'point_count':len(points),'views':E['views'],'resolution':[768,1024]}

 cfg=E['label'];check(cfg['object'] not in bpy.data.objects and cfg['material'] not in bpy.data.materials,'Exclusive annotation names')
 font=bpy.data.curves.new('RefusalLabelFont','FONT');font.body=cfg['body'];font.size=cfg['size'];font.align_x='CENTER';font.align_y='BOTTOM';font.extrude=font.bevel_depth=0
 label=bpy.data.objects.new(cfg['object'],font);scene.collection.objects.link(label);label.parent=cam;label.location=(0,cam.data.ortho_scale*cfg['y_fraction'],-1)
 lm=bpy.data.materials.new(cfg['material']);lm.use_nodes=True;lm.diffuse_color=cfg['rgba'];lm.use_backface_culling=False;lm.node_tree.nodes.clear()
 em=lm.node_tree.nodes.new('ShaderNodeEmission');em.name='RefusalEmission';em.inputs['Color'].default_value=cfg['rgba'];em.inputs['Strength'].default_value=1
 out=lm.node_tree.nodes.new('ShaderNodeOutputMaterial');out.name='RefusalOutput';out.target='ALL';out.is_active_output=True;lm.node_tree.links.new(em.outputs['Emission'],out.inputs['Surface']);font.materials.append(lm);bpy.context.view_layer.update()
 write('LABEL-OBSERVED.json',label_state())
 for view,direction in E['views']:
  clock();cam.location=target+Vector(direction).normalized()*5;orient(cam,target);bpy.context.view_layer.update();check_original();check(sleeve_state()==js,'Unchanged sleeve before '+view)
  proj=[world_to_camera_view(scene,cam,Vector(p)) for p in points];check(all(.04<=p.x<=.96 and .04<=p.y<=.96 and p.z>0 for p in proj),'All points inside frame '+view)
  lb=label_state();lp=[world_to_camera_view(scene,cam,label.matrix_world@Vector(x)) for x in lb['actual_local_corners']]
  check(all(.02<=x.x<=.98 and .02<=x.y<=.98 and x.z>0 for x in lp) and min(x.y for x in lp)>max(x.y for x in proj)+.002,'Actual glyph bounds inside frame and above actor '+view)
  state=display();write('PRE-'+view+'.json',{'label_bounds':{'minx':min(x.x for x in lp),'maxx':max(x.x for x in lp),'miny':min(x.y for x in lp),'maxy':max(x.y for x in lp)},**{'display':state,'bounds':{k:op(getattr(p,a) for p in proj) for k,a,op in [('minx','x',min),('maxx','x',max),('miny','y',min),('maxy','y',max)]}}})
  private=P/'private-render';private.mkdir();temp=private/(view+'.png');check(not (P/temp.name).exists(),'Exclusive first output');scene.render.filepath=str(temp)
  check(bpy.ops.render.render(write_still=True)=={'FINISHED'} and temp.is_file(),'First render '+view);clock();b=temp.read_bytes();check(0<len(b)<=10485760 and b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(768,1024),'PNG bound/dimensions')
  os.link(temp,P/temp.name);temp.unlink();private.rmdir();(P/(view+'.png')).chmod(0o444);R['outputs'].append({'file':view+'.png','bytes':len(b),'sha256':sha(b),'camera':[list(x) for x in cam.matrix_world]})
  check_original();check(sleeve_state()==js and display()==state,'Explicit state unchanged after '+view)
 after,post=C.evaluated(meshes,500000,1000000);check(after==g and set(post)==set(arrays) and all(post[n].tobytes()==arrays[n].tobytes() for n in arrays),'All original evaluated geometry after pixels exact')
 with (P/'actor-geometry.npz').open('xb') as out:np.savez_compressed(out,**arrays)
 check((P/'actor-geometry.npz').stat().st_size<=8388608,'Geometry archive bound');(P/'actor-geometry.npz').chmod(0o444)
 with (P/'post-actor-geometry.npz').open('xb') as out:np.savez_compressed(out,**post)
 check((P/'post-actor-geometry.npz').stat().st_size<=8388608,'Post geometry archive bound');(P/'post-actor-geometry.npz').chmod(0o444)
 R['post_geometry_archived']=True
 write('CLEANUP-SOURCE-BEFORE-REMOVAL.json',original_state())
 bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(me)
 for n in E['materials']:bpy.data.materials.remove(bpy.data.materials[n])
 bpy.data.objects.remove(label,do_unlink=True);bpy.data.curves.remove(font);bpy.data.materials.remove(lm)
 for n in diag:
  o=bpy.data.objects[n];d=o.data;bpy.data.objects.remove(o,do_unlink=True)
  if isinstance(d,bpy.types.Camera):bpy.data.cameras.remove(d)
  else:bpy.data.lights.remove(d)
 scene.world=oldworld;scene.camera=oldcamera;bpy.data.worlds.remove(world)
 check({o.name for o in bpy.data.objects}==names and {m.name for m in bpy.data.materials}==allmats and original_state()==base,'Declared owner cleanup/source restoration');write('RESTORED.json',original_state());pins();clock();check([x['file'] for x in R['outputs']]==['front.png','oblique.png','rear.png'],'Exactly three first originals');R['post_pins']=True;R['passed']=True
except Exception as ex:R['error']={'type':type(ex).__name__,'message':str(ex)}
finally:
 R['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();R['elapsed']=time.monotonic()-T;R['limits']='Three first static diagnostic images only. REFUSED_TRANSVERSE remains. No depth/full contact/fit/finished wardrobe/calibrated materials/anatomy/motion/export/runtime acceptance; no save. Explicit source and listed display fields only, not universal RNA coverage.';write('RESULT.json',R);print(json.dumps({'passed':R['passed'],'outputs':len(R['outputs']),'error':R.get('error')}),flush=True)
 if not R['passed']:raise SystemExit(1)
