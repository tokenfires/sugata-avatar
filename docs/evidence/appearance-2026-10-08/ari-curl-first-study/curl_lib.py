"""Isolated Curve ownership and render-equivalent observers; no source edits."""
from pathlib import Path
from array import array
import hashlib,json,math,importlib.util
import numpy as np
import bpy
from mathutils import Vector

def require(v,label):
 if not v:raise RuntimeError(label)
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def pin(row):
 b=Path(row['path']).read_bytes();require(len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],'Physicalpin '+row['path'])
def digest(a):return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()
def bulk(items,field,width=1,dtype=np.float32):
 a=np.empty(len(items)*width,dtype=dtype);items.foreach_get(field,a);require(np.isfinite(a).all(),'Finite '+field);return a.reshape((len(items),width)) if width>1 else a
def meta():
 return {o.name:[{'name':k.name,'relative':k.relative_key.name,'value':k.value,'min':k.slider_min,'max':k.slider_max,'mute':k.mute,'vertex_group':k.vertex_group,'interpolation':k.interpolation} for k in o.data.shape_keys.key_blocks] for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys}
def mixed(body):
 ks=body.data.shape_keys.key_blocks;a=bulk(ks[0].data,'co',3).astype(np.float64)
 for k in list(ks)[1:]:
  if not k.mute and k.value:
   require(not k.vertex_group,'Ungrouped source mix');a+=(bulk(k.data,'co',3).astype(np.float64)-bulk(k.relative_key.data,'co',3).astype(np.float64))*k.value
 require(np.isfinite(a).all(),'Finite fullmixed');return a.astype(np.float32)
def original_extras(names):
 return {n:{'parent_type':bpy.data.objects[n].parent_type,'parent_bone':bpy.data.objects[n].parent_bone,'matrix_basis':[list(r) for r in bpy.data.objects[n].matrix_basis],'matrix_local':[list(r) for r in bpy.data.objects[n].matrix_local],'hide_render':bpy.data.objects[n].hide_render,'hide_viewport':bpy.data.objects[n].hide_viewport,'hide_get':bpy.data.objects[n].hide_get(),'selected':bpy.data.objects[n].select_get()} for n in sorted(names)}
def original_only(scene,expected):
 names={x['name'] for x in expected['objects']};mats={x['name'] for x in expected['materials']};imgs={x['name'] for x in expected['images']}
 return {'objects':[x for x in scene['objects'] if x['name'] in names],'materials':[x for x in scene['materials'] if x['name'] in mats],'images':[x for x in scene['images'] if x['name'] in imgs],'scene_names':scene['scene_names']}
def persistent(v):
 if isinstance(v,(str,bool,int)) or v is None:return v
 if isinstance(v,float):require(math.isfinite(v),'FiniteRNA');return v
 return [persistent(x) for x in v]
def scalar_rna(owner):
 out={}
 for prop in owner.bl_rna.properties:
  if prop.identifier=='rna_type' or prop.is_readonly or prop.type not in {'BOOLEAN','INT','FLOAT','STRING','ENUM'}:continue
  v=getattr(owner,prop.identifier)
  out[prop.identifier]=persistent(v)
 return out
def material_record(m):
 require(m.animation_data is None and m.node_tree is not None and m.node_tree.animation_data is None,'Ownedmaterial no unrecorded animation')
 return {'name':m.name,'rna':scalar_rna(m),'nodes':[{'name':n.name,'type':n.type,'rna':scalar_rna(n),'inputs':{v.identifier:persistent(v.default_value) for v in n.inputs if hasattr(v,'default_value')}} for n in m.node_tree.nodes],'links':[(l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier) for l in m.node_tree.links]}
def curve_record(obj):
 c=obj.data;require(obj.type=='CURVE' and c.dimensions=='3D' and len(c.splines)==2000,'ActualeditableCurve counts/type')
 require(c.animation_data is None and obj.animation_data is None and c.shape_keys is None and c.bevel_object is None and c.taper_object is None and len(obj.modifiers)==0 and len(obj.constraints)==0,'OwnedCurve no unrecorded animation/keys/externalbevel/modifiers/constraints')
 records=[];arrays={};start=0
 for i,s in enumerate(c.splines):
  require(s.type=='POLY' and len(s.points)==41 and not s.use_cyclic_u,'ActualPOLY41')
  row={'type':s.type,'rna':scalar_rna(s),'arrays':{}}
  for field,width,dtype in [('co',4,np.float32),('radius',1,np.float32),('tilt',1,np.float32),('weight',1,np.float32),('weight_softbody',1,np.float32),('hide',1,np.int32),('select',1,np.int32)]:
   a=bulk(s.points,field,width,dtype);arrays[str(i)+'_'+field]=a;row['arrays'][field]={'shape':list(a.shape),'dtype':str(a.dtype),'sha256':digest(a)}
  row['point_start']=start;start+=len(s.points);records.append(row)
 return {'name':obj.name,'data_name':c.name,'object_rna':scalar_rna(obj),'curve_rna':scalar_rna(c),'parent':obj.parent.name if obj.parent else None,'parent_type':obj.parent_type,'parent_bone':obj.parent_bone,'matrix_world':[list(r) for r in obj.matrix_world],'matrix_parent_inverse':[list(r) for r in obj.matrix_parent_inverse],'matrix_basis':[list(r) for r in obj.matrix_basis],'matrix_local':[list(r) for r in obj.matrix_local],'modifiers':[(m.name,m.type) for m in obj.modifiers],'vertex_groups':[g.name for g in obj.vertex_groups],'materials':[s.material.name if s.material else None for s in obj.material_slots],'material_records':[material_record(s.material) for s in obj.material_slots if s.material],'splines':records,'total_controls':start},arrays

def evaluated(names,max_vertices,max_triangles):
 saved=[];out={};arrays={};totalv=totalt=0
 try:
  for n in names:
   o=bpy.data.objects[n]
   for m in o.modifiers:
    saved.append((m,m.show_viewport,getattr(m,'levels',None)));m.show_viewport=m.show_render
    if m.type=='SUBSURF':m.levels=m.render_levels
  bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
  for n in sorted(names):
   o=bpy.data.objects[n];require(o.type in {'MESH','CURVE'},'Declared evaluable owner');ev=o.evaluated_get(dg);mesh=None
   try:
    mesh=ev.to_mesh(preserve_all_data_layers=True,depsgraph=dg);require(mesh is not None,'Actual evaluated mesh '+n)
    mesh.calc_loop_triangles();totalv+=len(mesh.vertices);totalt+=len(mesh.loop_triangles)
    require(totalv<=max_vertices and totalt<=max_triangles,'Prospectivegeometry budget')
    local=bulk(mesh.vertices,'co',3);mat=np.asarray(ev.matrix_world,dtype=np.float64);world=(np.column_stack((local,np.ones(len(local))))@mat.T)[:,:3].astype(np.float32)
    tris=bulk(mesh.loop_triangles,'vertices',3,np.int32);edges=bulk(mesh.edges,'vertices',2,np.int32)
    require(np.isfinite(world).all(),'Finite evaluated world');arrays[n+'_world']=world;arrays[n+'_triangles']=tris;arrays[n+'_edges']=edges
    out[n]={'vertices':len(world),'triangles':len(tris),'edges':len(edges),'world_sha256':digest(world),'triangles_sha256':digest(tris),'edges_sha256':digest(edges),'min':world.min(axis=0).tolist(),'max':world.max(axis=0).tolist()}
   finally:
    if mesh is not None:ev.to_mesh_clear()
 finally:
  for m,show,level in saved:
   m.show_viewport=show
   if level is not None:m.levels=level
  bpy.context.view_layer.update()
 return out,arrays
