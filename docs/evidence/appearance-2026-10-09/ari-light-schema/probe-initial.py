"""One factory light-schema witness; no model, image, save or render."""
import sys
sys.dont_write_bytecode=True
import bpy,json,hashlib,datetime,struct,traceback
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent
R={'passed':False,'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':[],'observations':[]}
FIELDS=['type','energy','color','shape','size','size_y','spread','normalize','exposure','diffuse_factor','specular_factor','transmission_factor','volume_factor','use_temperature','temperature','use_shadow','use_custom_distance','cutoff_distance']
f32=lambda x:struct.unpack('f',struct.pack('f',x))[0]
TARGET=[0,-.11460304260253906,.829715676678461]
FIXTURES=[('GlobalKey',[-3,-4,4],700),('GlobalFill',[3,-2,3],450),('GlobalRear',[0,4,4],600)]
def check(name,actual,expected):
 R['checks'].append({'name':name,'observed':actual,'expected':expected,'passed':actual==expected})
 if actual!=expected:raise RuntimeError(name)
def pins():
 for row in json.loads((H/'EXEC.json').read_text())['pins']:
  b=Path(row['path']).read_bytes()
  check('pin:'+row['path'],{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()},{'bytes':row['bytes'],'sha256':row['sha256']})
def snapshot(obj):
 d=obj.data;out={'name':obj.name,'position':list(obj.location),'rotation':list(obj.rotation_euler),'scale':list(obj.scale),'matrix_world':[list(r) for r in obj.matrix_world],'fields':{},'field_errors':{}}
 for field in FIELDS:
  try:
   v=getattr(d,field);out['fields'][field]=list(v) if field=='color' else v
  except Exception as e:out['field_errors'][field]=str(e)
 try:out['legacy_use_nodes']=d.use_nodes
 except Exception as e:out['legacy_error']=str(e)
 try:
  t=d.node_tree
  if t is None:out['representation']={'kind':'None'}
  else:
   out['representation']={'kind':'NodeTree','node_count':len(t.nodes),'link_count':len(t.links),'nodes':[(n.name,n.bl_idname) for n in list(t.nodes)[:16]],'links':[(x.from_node.name,x.from_socket.name,x.to_node.name,x.to_socket.name) for x in list(t.links)[:16]],'truncated':len(t.nodes)>16 or len(t.links)>16}
 except Exception as e:out['representation']={'error':str(e)}
 return out
try:
 R['version']=list(bpy.app.version);R['version_string']=bpy.app.version_string;R['build_hash']=bpy.app.build_hash.decode();R['target']=TARGET;R['fixtures']=FIXTURES;R['fields']=FIELDS
 pins()
 for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
 for d in list(bpy.data.lights):bpy.data.lights.remove(d)
 objects=[]
 for name,pos,power in FIXTURES:
  d=bpy.data.lights.new(name,'AREA');obj=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(obj)
  R['observations'].append({'stage':'factory-default','snapshot':snapshot(obj)})
  d.shape='DISK';d.size=4;d.energy=power;d.color=(1,1,1);obj.location=pos
  obj.rotation_euler=(Vector(TARGET)-obj.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update();objects.append(obj)
 R['configured']=[snapshot(o) for o in objects]
 R['repeat']=[snapshot(o) for o in objects]
 # Persist all observations before individual runtime gates, even on failure.
 with (H/'OBSERVED.json').open('x') as f:json.dump(R,f,indent=2);f.write('\n')
 check('installed version',R['version'],[5,2,2]);check('build hash',R['build_hash'],'d13f752e3b9c')
 check('object names',sorted(bpy.data.objects.keys()),sorted(x[0] for x in FIXTURES))
 check('light names',sorted(bpy.data.lights.keys()),sorted(x[0] for x in FIXTURES))
 check('repeat read-only snapshots',R['repeat'],R['configured'])
 for row,fixture in zip(R['configured'],FIXTURES):
  name,pos,power=fixture;check(name+':field errors',row['field_errors'],{})
  expected={'type':'AREA','energy':power,'color':[1.,1.,1.],'shape':'DISK','size':4.,'size_y':.25,'spread':f32(3.141592653589793),'normalize':True,'exposure':0.,'diffuse_factor':1.,'specular_factor':1.,'transmission_factor':1.,'volume_factor':1.,'use_temperature':False,'temperature':6500.,'use_shadow':True,'use_custom_distance':False,'cutoff_distance':40.}
  for field,value in expected.items():check(name+':'+field,row['fields'].get(field),value)
  check(name+':position',row['position'],pos);check(name+':scale',row['scale'],[1.,1.,1.])
  rep=row['representation'];supported=rep=={'kind':'None'} or (rep.get('kind')=='NodeTree' and rep.get('node_count')==rep.get('link_count')==0 and rep.get('truncated') is False)
  check(name+':supported None or empty-tree branch',{'supported':supported,'representation':rep},{'supported':True,'representation':rep})
 pins();R['passed']=True
except Exception as e:
 R['error']={'type':type(e).__name__,'message':str(e)};traceback.print_exc()
finally:
 R['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (H/'RESULT.json').open('x') as f:json.dump(R,f,indent=2);f.write('\n')
 print('ARI_LIGHT_SCHEMA_RESULT='+json.dumps({'passed':R['passed'],'observations':len(R['observations']),'error':R.get('error')}))
if not R['passed']:raise RuntimeError('Light-schema witness refused; no retry')
