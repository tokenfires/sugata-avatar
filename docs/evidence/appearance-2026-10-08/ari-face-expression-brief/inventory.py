from pathlib import Path
import json,hashlib,re,math,datetime,os
P=Path(__file__).resolve().parent
I=json.loads((P/'INPUTS.json').read_text())
for r in I['pins']:
 b=Path(r['path']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,9,1,35,tzinfo=datetime.timezone.utc)
source=next(r for r in I['pins'] if r['path'].endswith('/COLD-OBSERVED.json'));assert source['bytes']<2*1024*1024
D=json.loads(Path(source['path']).read_text());M=D['metadata'];objects=D['scene']['objects'];meshes=[o for o in objects if o['type']=='MESH'];rigs=[o for o in objects if o['type']=='ARMATURE'];assert len(objects)==7 and len(meshes)==6 and len(rigs)==1 and len(rigs[0]['rig']['bones'])==53
assert set(M)=={o['name'] for o in meshes};assert sum(len(v) for v in M.values())==252 and all(len(v)<=300 for v in M.values())
pattern=re.compile('smile|corner|squint|cheek|jaw|mouth',re.I);owners=[];groups={}
for o in sorted(meshes,key=lambda o:o['name']):
 name=o['name'];meta=M[name];keys=o['mesh']['shape_keys'];assert len(meta)==len(keys)
 keymap={k['name']:k for k in keys};assert len(keymap)==len(keys);assert {k['name'] for k in meta}==set(keymap)
 candidates=[]
 for k in meta:
  assert isinstance(k['name'],str) and len(k['name'])<=512 and isinstance(k['relative'],str) and len(k['relative'])<=512
  assert all(math.isfinite(k[f]) for f in ['value','min','max']);v=keymap[k['name']];assert v['value']==k['value'] and v['relative_key']==k['relative'] and v['vertices']==o['mesh']['vertices'];assert re.fullmatch('[a-f0-9]{64}',v['coordinates_sha256'])
  if pattern.search(k['name']):
   row={'metadata':k,'native_vertices':v['vertices'],'source_coordinate_sha256_identity_only':v['coordinates_sha256'],'effect_semantics_support_and_dependencies':'UNKNOWN'};candidates.append(row);groups.setdefault(k['name'],[]).append(name)
 owners.append({'owner':name,'parent':o['parent'],'native_vertices':o['mesh']['vertices'],'key_count':len(meta),'all_key_names':[k['name'] for k in meta],'candidate_count':len(candidates),'candidates':candidates})
R={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'query_pid':os.getpid(),'source':source,'fixed_filter':pattern.pattern,'owner_count':6,'total_key_records':252,'rig_name':rigs[0]['name'],'rest_bones':53,'owners':owners,'exact_candidate_name_memberships':groups,'geometric_support_semantics_auxiliary_zero_effect_animation_driver_correspondence':'UNKNOWN; no native shape delta or dependency reads performed','no_native_or_setters_coefficients_sculpt_save_render':True,'next_decision':'Candidate presence nominates future readonly delta/dependency/aux witness; no expression or morphology trial admitted','material_state':'pinned COLD .5 baseline; .75 image-only response restored','records_used':'three existing images/root actual viewing; one pinned COLD metadata/mesh/rig reuse; prior RESULT-REVIEW and ROOT-READBACK; standard-library JSON parser only'}
b=(json.dumps(R,indent=2)+'\n').encode();assert len(b)<=512*1024
with (P/'INVENTORY.json').open('xb') as f:f.write(b)
print(json.dumps({'utc':R['utc'],'pid':R['query_pid'],'owners':6,'keys':252,'rest_bones':53,'selected_rows':sum(o['candidate_count'] for o in owners),'distinct_selected_names':len(groups),'owner_counts':[(o['owner'],o['candidate_count']) for o in owners],'names':list(groups),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'next_expression_operations_held':True}))
