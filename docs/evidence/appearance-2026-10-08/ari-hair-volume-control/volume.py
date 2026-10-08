"""First diagnostic originals of unchanged known-refused temporary volume."""
from pathlib import Path
import sys,json,hashlib,datetime,math,ast,importlib.util,collections
sys.dont_write_bytecode=True
import numpy as np
import bpy
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent;WORK=P/'work';E=json.loads((P/'EXEC-PLAN.json').read_text());REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'execution_passed':False,'strict_forehead_passed':False,'candidate_promotion':False,'outputs':[],'checks':[]}
def require(ok,label):
 if not ok:raise RuntimeError(label)
 REPORT['checks'].append(label)
def load(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def write(name,value):
 with (P/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')
def buffer(name,arrays):
 f=WORK/name;np.savez_compressed(f,**arrays);f.chmod(0o444);return {'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
def original():
 return C.original_only(helper.capture_scene(),before)==before and C.original_extras(old_names)==old_extra and C.meta()==W['full_native_key_metadata'] and C.digest(C.mixed(bpy.data.objects['Human']))==W['body_new_mixed_coordinate_sha256']
def owned(o):
 d=o.data;require(o.type=='MESH' and len(o.modifiers)==0 and len(o.constraints)==0 and not o.vertex_groups and o.animation_data is None and d.animation_data is None and d.shape_keys is None,'Ownedbaremassmesh')
 return {'name':o.name,'object_rna':C.scalar_rna(o),'data_rna':C.scalar_rna(d),'custom':dict(o.items()),'extras':C.original_extras([o.name])[o.name],'matrix_world':[list(x) for x in o.matrix_world],'vertices':[list(v.co) for v in d.vertices],'faces':[list(f.vertices) for f in d.polygons],'smooth':[f.use_smooth for f in d.polygons],'materials':[C.material_record(s.material) for s in o.material_slots],'attributes':[(a.name,a.data_type,a.domain) for a in d.attributes],'uv_layers':[u.name for u in d.uv_layers],'actual_role_attribute':C.bulk(d.attributes['sugata_mass_role'].data,'value',1,np.int32).tolist()}
try:
 require(bpy.app.background and not bpy.app.online_access,'OfflineCPU diagnosticonly')
 for r in E['pins']:
  b=Path(r['path']).read_bytes();require(len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],'Stdlibpin beforecode '+r['path'])
 C=load('sugata_mass_lib',P/'mass_lib.py');M=json.loads((P/'MASS.json').read_text());F=json.loads((P/'SOURCE-REFUSAL.json').read_text());W=json.loads(Path(E['warm']).read_text());require(F['outer_forehead_aabb_refused'] and F['native_attempts']==0 and E['diagnostic_only'] and not E['candidate_promotion'],'Explicitknownrefusal/newdispatch');require(not WORK.exists(),'Exclusivework');WORK.mkdir()
 helper=load('sugata_mass_scene',E['scene_helper']);require(bpy.ops.wm.open_mainfile(filepath=E['source']['path'])=={'FINISHED'},'Exactv2open');before=helper.capture_scene();require(before==W['scene'] and C.meta()==W['full_native_key_metadata'],'Completeold7/108/252');old_names={x['name'] for x in before['objects']};old_extra=C.original_extras(old_names);require(original(),'Oldmixed/extrasinitial')
 body=bpy.data.objects['Human'];mixed=C.mixed(body);mat=np.asarray(body.matrix_world);world=(np.column_stack((mixed,np.ones(len(mixed))))@mat.T)[:,:3]
 for v in M['vertex_ledger']:require(np.max(np.abs(world[v['native_vertex']]-np.asarray(v['source'])))<=1e-6,'Actualnativevertexassociation '+str(v['native_vertex']))
 d=bpy.data.meshes.new('AriTemporaryVolumeData');d.from_pydata(M['vertices'],[],M['faces']);d.update();o=bpy.data.objects.new('AriTemporaryVolume',d);bpy.context.scene.collection.objects.link(o);o.parent=bpy.data.objects['Human.rig'];o.parent_type='BONE';o.parent_bone='head';o.matrix_world=Matrix.Identity(4);o['sugata_role']='temporary-hair-volume-diagnostic';o['sugata_strict_forehead']='REFUSED';o['sugata_mass_manifest']=str(P/'MASS.json');bpy.context.view_layer.update();require(np.max(np.abs(np.asarray(o.matrix_world)-np.eye(4)))<=1e-6,'Nearidentityworld')
 for f in d.polygons:f.use_smooth=M['smooth_faces']
 role_codes={'outer':0,'base':1,'wall':2};role_values=np.asarray([role_codes[r] for r in M['face_roles']],dtype=np.int32);role_attr=d.attributes.new('sugata_mass_role','INT','FACE');require(role_attr.data_type=='INT' and role_attr.domain=='FACE' and len(role_attr.data)==len(M['faces']),'ActualINTFACEroleattribute');role_attr.data.foreach_set('value',role_values);require(np.array_equal(C.bulk(role_attr.data,'value',1,np.int32),role_values),'Actualnativerolevalues')
 m=bpy.data.materials.new('AriVolumeControlSlate');m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');require(n is not None,'ActualPrincipled');n.inputs['Base Color'].default_value=M['material_rgba'];n.inputs['Roughness'].default_value=M['roughness'];n.inputs['Metallic'].default_value=0;d.materials.append(m)
 native=owned(o);require(native['vertices']==M['vertices'] and native['faces']==M['faces'],'Exactfixednativeverts/faces');all_names=old_names|{o.name};mass_name=o.name;require(set(x.name for x in bpy.data.objects)==all_names and original(),'Soleadditiveowner/oldexact');d.calc_loop_triangles();polyids=[t.polygon_index for t in d.loop_triangles];roles=[M['face_roles'][i] for i in polyids];sourcefaces=[M['face_source_triangles'][i] for i in polyids];write('ROLE-TRANSPORT.json',{'triangle_polygon':polyids,'triangle_role':roles,'triangle_source':sourcefaces,'native_faces':M['faces'],'native_roles':M['face_roles']})
 records,arrays=C.evaluated(['Human',mass_name],M['bounds']['all_vertices'],M['bounds']['all_triangles']);g=records[mass_name];require(g['vertices']<=M['bounds']['mass_vertices'] and g['triangles']<=M['bounds']['mass_triangles'],'Massgeometrybudget');require(g['triangles']==len(polyids),'Exacttrirolecount');
 dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);em=ev.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
 try:
  em.calc_loop_triangles();er=em.attributes.get('sugata_mass_role');require(er is not None and er.data_type=='INT' and er.domain=='FACE','Actualevaluatedroleattribute');values=C.bulk(er.data,'value',1,np.int32);require(np.array_equal(values,role_values) and [t.polygon_index for t in em.loop_triangles]==polyids,'Native/evaluatedroletransport');write('EVALUATED-ROLES.json',{'polygon_role_values':values.tolist(),'triangle_role_values':[int(values[i]) for i in polyids],'triangle_polygon':polyids})
 finally:ev.to_mesh_clear()
 require(C.digest(C.bulk(d.loop_triangles,'vertices',3,np.int32))==g['triangles_sha256'],'Actualnative/evaltriassociation');REPORT['buffers']=[buffer('actual-static-geometry.npz',arrays)];write('NATIVE.json',native);write('GEOMETRY.json',records)
 verts=arrays[mass_name+'_world'];tris=arrays[mass_name+'_triangles'];tv=verts[tris];lo=tv.min(axis=1);hi=tv.max(axis=1);env={'strict_forehead_passed':False,'candidate_promotion':False,'role_counts':dict(collections.Counter(roles)),'ear_overlaps':[],'forehead_overlaps':[],'outer_forehead_source_faces':[],'limits':'Base/wall sourcefootprint andcontacts intentional; conservative AABB flags notphysical/pixel obstruction.'}
 for i,role in enumerate(roles):
  for side,box in M['artist_ear_boxes'].items():
   if np.all(hi[i]>=box['min']) and np.all(lo[i]<=box['max']):env['ear_overlaps'].append({'triangle':i,'polygon':polyids[i],'role':role,'side':side,'indices':tris[i].tolist(),'coordinates':tv[i].tolist()})
  gate=M['artist_forehead_gate']
  if lo[i,1]<gate['front_y'] and lo[i,2]<gate['min_z']:
   env['forehead_overlaps'].append({'triangle':i,'polygon':polyids[i],'source_triangle':sourcefaces[i],'role':role,'indices':tris[i].tolist(),'coordinates':tv[i].tolist()})
   if role=='outer':env['outer_forehead_source_faces'].append(polyids[i])
 env['outer_forehead_source_faces']=sorted(set(env['outer_forehead_source_faces']));write('ENVELOPE.json',env);require(env['outer_forehead_source_faces']==[128,532],'KnownstrictforeheadREFUSED preserved');require(not any(x['role']=='outer' for x in env['ear_overlaps']),'Noouterearboxoverlap')
 # All native face roles contribute to edge responsibility; base/wall rays are retained.
 edge_roles=collections.defaultdict(set)
 for f,role in zip(M['faces'],M['face_roles']):
  for u,v in zip(f,f[1:]+f[:1]):edge_roles[tuple(sorted((u,v)))].add(role)
 hv=arrays['Human_world'];ht=arrays['Human_triangles'];bvh=BVHTree.FromPolygons([Vector(p) for p in hv],[list(map(int,t)) for t in ht],all_triangles=True,epsilon=0.0);require(bvh is not None,'ActualHumanBVH');edges=arrays[mass_name+'_edges'];contact={'edge_role_counts':{},'edge_hit_counts':{},'ray_tests':0,'degenerate_edges':0,'first_outer_hit':None,'hit_witnesses':[],'nearest_base_min_m':None,'nearest_outer_min_m':None,'limits':'ObservedBVHsegments only; base/walls intentionallyskinanchored, no certifiedpropercrossing/penetration/solidoccupancy/clearance/selfcontact/otheranatomy/motion.'}
 for i,p in enumerate(verts):
  loc,norm,face,dist=bvh.find_nearest(Vector(p));require(loc is not None and all(math.isfinite(x) for x in [dist,*loc,*norm]) and isinstance(face,int) and 0<=face<len(ht),'Finitecomplete nearest');key='nearest_outer_min_m' if i<len(M['source_ids']) else 'nearest_base_min_m'
  if contact[key] is None or dist<contact[key]:contact[key]=dist
 for i,edge in enumerate(edges):
  responsibility='outer' if 'outer' in edge_roles[tuple(sorted(map(int,edge)))] else 'base_or_wall';contact['edge_role_counts'][responsibility]=contact['edge_role_counts'].get(responsibility,0)+1;a=Vector(verts[edge[0]]);delta=Vector(verts[edge[1]])-a;length=delta.length;require(math.isfinite(length),'Finiteedge')
  if length<=1e-10:contact['degenerate_edges']+=1;continue
  loc,norm,face,dist=bvh.ray_cast(a,delta/length,length);contact['ray_tests']+=1
  if loc is not None:
   require(all(math.isfinite(x) for x in [dist,*loc,*norm]) and -1e-7<=dist<=length+1e-7 and isinstance(face,int) and 0<=face<len(ht),'Finitecompletehit');contact['edge_hit_counts'][responsibility]=contact['edge_hit_counts'].get(responsibility,0)+1;witness={'edge':i,'indices':edge.tolist(),'roles':sorted(edge_roles[tuple(sorted(map(int,edge)))]),'responsibility':responsibility,'start':list(a),'end':list(a+delta),'length_m':length,'hit':list(loc),'distance_m':dist,'Human_triangle':int(face),'triangle_indices':ht[face].tolist(),'triangle_coordinates':hv[ht[face]].tolist(),'label':'Observedsegmenthit; base/wallsourceanchoring intended, not penetration/clearance verdict'}
   contact['hit_witnesses'].append(witness)
   if responsibility=='outer' and contact['first_outer_hit'] is None:contact['first_outer_hit']=witness
 write('CONTACT.json',contact);require(contact['first_outer_hit'] is None,'Noobservedouteredgehit');require(original() and owned(o)==native,'Postcontactold+nativeexact')
 code=ast.parse(Path(E['renderer']).read_text());wanted={'render_domain','restore','bbox','orient','settings'};nodes=[n for n in code.body if isinstance(n,ast.FunctionDef) and n.name in wanted];require({n.name for n in nodes}==wanted,'Exactfrozenrenderfunctions');exec(compile(ast.Module(body=nodes,type_ignores=[]),E['renderer'],'exec'),globals());_,heads,counts,saved=render_domain();restore(saved);require(counts[mass_name]['render_vertices']==g['vertices'],'Everymasspointframed');require(original() and owned(o)==native,'Boundsobserverrestoresource');lo2,hi2=bbox(heads);center=(lo2+hi2)/2;scale=float(max(hi2-lo2)*1.12);frame={'center':list(center),'scale':scale,'resolution':[768,768],'min':list(lo2),'max':list(hi2)};warm=helper.capture_scene();extras=C.original_extras(all_names);write('WARM.json',{'scene':warm,'extras':extras,'metadata':C.meta(),'owned':native,'geometry':records,'frame':frame,'domains':counts})
 target=WORK/'ari-hair-volume-control.blend';require(bpy.ops.wm.save_as_mainfile(filepath=str(target),check_existing=False,copy=True,relative_remap=False)=={'FINISHED'},'Owneddiagnosticsave');require(original() and helper.capture_scene()==warm and C.original_extras(all_names)==extras and owned(o)==native,'Postsavefullrecords');target.chmod(0o444);filehash=hashlib.sha256(target.read_bytes()).hexdigest();require(bpy.ops.wm.open_mainfile(filepath=str(target))=={'FINISHED'},'Sameprocessfreshsavedopen');o=bpy.data.objects[mass_name];require(original() and helper.capture_scene()==warm and C.original_extras(all_names)==extras and owned(o)==native,'Freshopenfullrecords');cold,_=C.evaluated(['Human',mass_name],M['bounds']['all_vertices'],M['bounds']['all_triangles']);require(cold==records,'Freshopenevaluatedexact');
 dg=bpy.context.evaluated_depsgraph_get();cev=o.evaluated_get(dg);cm=cev.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
 try:
  cm.calc_loop_triangles();ca=cm.attributes.get('sugata_mass_role');require(ca is not None and ca.data_type=='INT' and ca.domain=='FACE','Freshopenevaluatedroleattribute');coldroles=C.bulk(ca.data,'value',1,np.int32).tolist();coldpoly=[t.polygon_index for t in cm.loop_triangles];require(coldroles==role_values.tolist() and coldpoly==polyids,'Freshopenevaluatedroletransport')
 finally:cev.to_mesh_clear()
 write('REOPEN.json',{'scene':helper.capture_scene(),'extras':C.original_extras(all_names),'metadata':C.meta(),'owned':owned(o),'geometry':cold,'evaluated_roles':{'polygon_role_values':coldroles,'triangle_polygon':coldpoly},'same_process':True})
 scene=bpy.context.scene;oldworld=scene.world;oldcamera=scene.camera;camera,diag,worlddiag=settings(scene,center);require(len(diag)==4 and not set(diag)&all_names,'Owneddiagnostics');scene.render.resolution_x=768;scene.render.resolution_y=768;camera.data.ortho_scale=scale;_,heads,counts2,saved=render_domain();require(counts==counts2,'Exactframingdomain')
 for view,direction in [('front',(0,-1,0)),('profile',(1,0,0)),('rear',(0,1,0))]:
  camera.location=Vector(center)+Vector(direction)*5;orient(camera,Vector(center));bpy.context.view_layer.update();projected=[world_to_camera_view(scene,camera,Vector(p)) for p in heads];require(all(.04<=p.x<=.96 and .04<=p.y<=.96 and p.z>0 for p in projected),'Allpointframe '+view);png=P/('volume-'+view+'.png');require(not png.exists(),'Firstexclusiveoriginal');scene.render.filepath=str(png);require(bpy.ops.render.render(write_still=True)=={'FINISHED'} and png.is_file(),'Firstoriginal '+view);png.chmod(0o444);REPORT['outputs'].append({'view':view,'path':str(png),'bytes':png.stat().st_size,'sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'resolution':[768,768],'projection':{'minx':min(p.x for p in projected),'maxx':max(p.x for p in projected),'miny':min(p.y for p in projected),'maxy':max(p.y for p in projected)}})
 restore(saved)
 for name in diag:
  obj=bpy.data.objects[name];data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
  if isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
  else:bpy.data.lights.remove(data)
 scene.world=oldworld;scene.camera=oldcamera;bpy.data.worlds.remove(worlddiag);require(original() and helper.capture_scene()==warm and C.original_extras(all_names)==extras and owned(o)==native,'Normalcleanupcomplete');write('CLEANUP.json',{'scene':helper.capture_scene(),'extras':C.original_extras(all_names),'metadata':C.meta(),'owned':owned(o)})
 for r in E['pins']:C.pin(r)
 REPORT.update({'execution_passed':True,'source':str(target),'source_bytes':target.stat().st_size,'source_sha256':filehash,'geometry':records,'frame':frame,'domains':counts,'envelope':env,'contact':contact,'same_process_reopen':True,'old_source_exact':True})
except Exception as ex:REPORT['exception']=repr(ex)
finally:
 REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();REPORT['limits']='KnownstrictforeheadREFUSED diagnosticonly/no promotion. Temporarysmoothvolume, nothairline/curls/solidoccupancy/physicalclearance/motion/export/runtime/AAA. Failureisolated,no rollback/retake.';write('RESULT.json',REPORT);print('SUGATA_VOLUME_CONTROL '+json.dumps({k:v for k,v in REPORT.items() if k!='checks'}),flush=True)
if not REPORT['execution_passed']:raise SystemExit(1)
