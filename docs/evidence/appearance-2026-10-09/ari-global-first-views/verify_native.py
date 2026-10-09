"""Read-only host proof of one native result. No Blender, render or candidate output."""
from pathlib import Path
import json,hashlib,struct,zlib,time,datetime
import numpy as np
H=Path(__file__).resolve().parent
START=time.monotonic()
sha=lambda a:hashlib.sha256(a.tobytes(order='C')).hexdigest()
def clock():assert time.monotonic()-START<60,'Hostverification60s'

def png(path,expected):
    data=path.read_bytes();assert len(data)==expected['bytes'] and hashlib.sha256(data).hexdigest()==expected['sha256']
    assert data[:8]==b'\x89PNG\r\n\x1a\n';offset=8;chunks=0;size=None
    while offset<len(data):
        count=struct.unpack('>I',data[offset:offset+4])[0];kind=data[offset+4:offset+8];payload=data[offset+8:offset+8+count];stored=struct.unpack('>I',data[offset+8+count:offset+12+count])[0]
        assert zlib.crc32(kind+payload)&0xffffffff==stored
        if kind==b'IHDR':size=struct.unpack('>II',payload[:8]);assert size==(768,1024)
        chunks+=1;offset+=count+12
        if kind==b'IEND':break
    assert offset==len(data) and size==(768,1024)
    return chunks

def main():
    r=json.loads((H/'NATIVE-RESULT.json').read_text());job=json.loads((H/'NATIVE-JOB.json').read_text());cfg=json.loads((H/'DISPLAY.json').read_text())
    assert r['passed'] and r['same_process_cold_reopen_exact'] and r['post_pins_exact'] and r['editable']['post_cold_bytes_exact']
    assert job['exit_code']==job['wrapper_exit_code']==0 and job['launch_within_gates'] and job['within_total_wall_gate'] and not job['timed_out_or_interrupted'] and not job['log_truncated']
    log=(H/'native.log').read_bytes();assert len(log)==job['log_bytes'] and hashlib.sha256(log).hexdigest()==job['log_sha256']
    paths={Path(row['path']).name:Path(row['path']) for row in json.loads((H/'INPUTS.json').read_text())}
    for row in json.loads((H/'EXEC.json').read_text())['pins']:
        data=Path(row['path']).read_bytes();assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
    with np.load(paths['after-geometry.npz'],allow_pickle=False) as z:body=z['Human_world'];bt=z['Human_triangles']
    with np.load(paths['geometry.npz'],allow_pickle=False) as z:world=z['world'];tri=z['triangles']
    topo=json.loads(paths['TOPOLOGY.json'].read_text());assert tri.tolist()==topo['triangles']
    slots=np.array([cfg['owner_slot'][owner] for owner in topo['triangle_owners']],np.int32);smooth=np.array([owner.startswith(('outer-','lining-')) for owner in topo['triangle_owners']],bool)
    baselines=r['geometry_baseline']
    for name,v,t,mi,sm in [('GlobalSourceBody',body,bt,np.zeros(len(bt),np.int32),np.ones(len(bt),bool)),('AriGlobalShell-UNQUALIFIED',world,tri,slots,smooth)]:
        b=baselines[name];assert b['vertices']==len(v) and b['triangles']==len(t) and b['vertex_sha256']==sha(v) and b['triangle_sha256']==sha(t) and b['material_index_sha256']==sha(mi) and b['smoothing_sha256']==sha(sm) and b['UV_layers']==0
    display=r['display_baseline'];expected={'GlobalBody-gray':(cfg['body_gray'],1,0)};expected.update({'Global-'+k:(v,cfg['material_roughness'],.2) for k,v in cfg['materials'].items()})
    assert len(display['materials'])==5 and set(m['name'] for m in display['materials'])==set(expected)
    for m in display['materials']:
        color,rough,spec=expected[m['name']];assert m['rgba']==np.array([*color,1],np.float32).astype(float).tolist() and m['roughness']==float(np.float32(rough)) and m['specular']==float(np.float32(spec)) and m['metallic']==0
        route=m['routing'];assert route['use_nodes'] and sorted(route['nodes'])==sorted([['Principled BSDF','ShaderNodeBsdfPrincipled'],['Material Output','ShaderNodeOutputMaterial']]) and route['links']==[['Principled BSDF','BSDF','Material Output','Surface']] and route['active_output']=='Material Output'
    for m,nodes,link,output in [(display['world_routing'],[['Background','ShaderNodeBackground'],['World Output','ShaderNodeOutputWorld']],[['Background','Background','World Output','Surface']],'World Output'),(display['label_routing'],[['Emission','ShaderNodeEmission'],['Material Output','ShaderNodeOutputMaterial']],[['Emission','Emission','Material Output','Surface']],'Material Output')]:
        assert m['use_nodes'] and sorted(m['nodes'])==sorted(nodes) and m['links']==link and m['active_output']==output
    assert [row['body'] for row in display['labels']]==[row['text'] for row in cfg['labels']]
    allpoints=np.vstack((body,world)).astype(np.float64);assert len(allpoints)==14186
    assert len(r['outputs'])==3 and [row['name'] for row in r['outputs']]==list(cfg['views'])
    rows=[];scale=r['frame']['scale']
    for out in r['outputs']:
        clock();matrix=np.asarray(out['camera_matrix_world']);local=np.c_[allpoints,np.ones(len(allpoints))]@np.linalg.inv(matrix).T
        projected=np.column_stack((.5+local[:,0]/(scale*.75),.5+local[:,1]/scale,-local[:,2]))
        error=max(np.max(np.abs(projected.min(axis=0)-out['projected_min'])),np.max(np.abs(projected.max(axis=0)-out['projected_max'])))
        assert error<2e-6 and np.all(projected[:,2]>0) and np.all(projected[:,:2]>=.039998) and np.all(projected[:,:2]<=.960002)
        assert len(out['annotation_bounds'])==2
        for annotation in out['annotation_bounds']:
            assert annotation['vertices']>0 and annotation['projected_min'][1]>out['projected_max'][1]+.001
        rows.append({'view':out['name'],'PNG_chunks_verified':png(H/out['file'],out),'independent_projection_max_delta':float(error)})
    blob=(H/r['editable']['file']).read_bytes();assert len(blob)==r['editable']['bytes'] and hashlib.sha256(blob).hexdigest()==r['editable']['sha256']
    result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed_with_scope':True,'source_geometry_role_buffers_exact':True,'bounded_shader_graphs':7,'complete_frame_points':14186,'images':rows,'opaque_editable_bytes_exact':True,'cold_scope':'Worker-attributed one SAME-PROCESS listeddata/state reopen; no independent/freshprocess nativeopen','appearance':'Actualimageinspection stillrequired; numericalbounds do notqualifyreadability/fit','source_or_candidate_edits':0,'native_jobs':0,'elapsed':time.monotonic()-START}
    clock()
    with (H/'ROOT-NATIVE-VERIFY.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'read_only_verification':'PASS_WITH_SCOPE','elapsed':result['elapsed']}))

if __name__=='__main__':main()
