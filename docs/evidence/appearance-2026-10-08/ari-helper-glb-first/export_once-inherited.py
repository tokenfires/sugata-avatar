"""One offline numerical diagnostic export; preserve loaded owners and input files."""
import sys
sys.dont_write_bytecode = True
import datetime
import hashlib
import importlib.util
import json
import math
import os
from collections import Counter
from pathlib import Path
import traceback
import bpy
import numpy as np
from mathutils import Matrix, Quaternion

HERE = Path(__file__).resolve().parent
PLAN = json.loads((HERE / "RUN-PLAN.json").read_text())
OUT = HERE / "work"
REPORT = {"started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "pid": os.getpid(), "checks": [], "export_calls": 0, "passed": False,
          "scope": "Numerical neutral GLB only; materials/images/shaders/appearance/motion/Ari held"}
ATTRS = [("_SUGATA_NATIVE_VERTEX", "POINT"), ("_SUGATA_NATIVE_CORNER", "CORNER"),
         ("_SUGATA_NATIVE_FACE", "FACE")]
C = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
SOURCE = Path(PLAN["source"]["path"])
MODULES = {}
NATIVE = {}
ARRAYS = {}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def identity(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            h.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": h.hexdigest()}


def pin_matches(pin):
    return identity(Path(pin["path"])) == pin


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def check(name, condition, **witness):
    REPORT["checks"].append({"name": name, "pass": bool(condition), **witness})


def array(collection, prop, width, dtype=np.float32):
    a = np.zeros(len(collection)*width, dtype=dtype)
    collection.foreach_get(prop, a)
    return a.reshape(-1, width)


def matrix(m):
    return np.asarray(m, dtype=np.float64)


def swizzle_positions(a, world):
    a = a.astype(np.float64) @ matrix(world)[:3,:3].T + matrix(world)[:3,3]
    return a[:,[0,2,1]] * [1,1,-1]


def compare(name, actual, expected, epsilon=1e-6, distance=False, **context):
    require(actual.shape == expected.shape, "Shape mismatch: " + name)
    require(np.isfinite(actual).all() and np.isfinite(expected).all(), "Nonfinite compare: " + name)
    d = np.linalg.norm(actual-expected, axis=-1) if distance else np.abs(actual-expected)
    require(np.isfinite(d).all(), "Nonfinite computed residual: " + name)
    flat = int(np.argmax(d)) if d.size else 0
    ix = tuple(int(i) for i in np.unravel_index(flat, d.shape)) if d.size else ()
    maximum = float(d.max()) if d.size else 0.0
    check(name, maximum <= epsilon, max_error=maximum, bound=epsilon,
          max_index=list(ix), actual_at_max=actual[ix].tolist() if d.size else None,
          expected_at_max=expected[ix].tolist() if d.size else None, **context)


def cyclic(triple):
    a,b,c = map(int,triple)
    return min((a,b,c),(b,c,a),(c,a,b))


def capture_native(meshes, rig, decoder):
    bones = list(rig.data.bones)
    names = [b.name for b in bones]
    require(len(names) == 53 and len(names) == len(set(names)), "Native53bone identity")
    require(rig.parent is None and rig.animation_data is None, "Unsupported rig parent/animation")
    require(np.max(np.abs(matrix(rig.matrix_world)-np.eye(4))) <= 1e-9,
            "This diagnostic requires native identity rig object frame")
    require(abs(rig.matrix_world.determinant()) > 1e-8, "Singular rig frame")
    native_bones = {}
    for b in bones:
        require(np.max(np.abs(matrix(rig.pose.bones[b.name].matrix_basis)-np.eye(4))) <= 1e-6,
                "Nonneutral pose: " + b.name)
        world_v = rig.matrix_world @ b.matrix_local @ C
        parent_v = rig.matrix_world @ b.parent.matrix_local @ C if b.parent else rig.matrix_world
        local_v = parent_v.inverted() @ world_v
        t,q,s = local_v.decompose()
        node = {"translation":[t.x,t.z,-t.y], "rotation":[q.x,q.z,-q.y,q.w],
                "scale":[s.x,s.z,s.y]}
        expected_local = decoder.trs(node)
        # Independent physical world frame and inverse bind, not a chain of replayed locals.
        expected_global = matrix(C @ rig.matrix_world @ b.matrix_local)
        expected_ibm = matrix((C @ rig.matrix_world @ b.matrix_local).inverted())
        require(np.isfinite(expected_global).all(), "Nonfinite bone world")
        require(np.max(np.abs(matrix(Matrix.LocRotScale(t,q,s))-matrix(local_v))) <= 1e-6,
                "Unrepresentable bone shear")
        native_bones[b.name] = {"parent":b.parent.name if b.parent else None,
                               "local":expected_local.tolist(), "global":expected_global.tolist(),
                               "inverse_bind":expected_ibm.tolist(), "replay_trs":node}
    NATIVE["bones"] = native_bones
    NATIVE["rig_world"] = matrix(C @ rig.matrix_world @ C.inverted()).tolist()
    NATIVE["meshes"] = {}
    material_names = []
    for o in meshes:
        m = o.data
        require(o.parent == rig and o.parent_type == "OBJECT", "Unexpected mesh parent")
        require(np.max(np.abs(matrix(o.matrix_world)-np.eye(4))) <= 1e-9,
                "This diagnostic requires native identity mesh object frame: "+o.name)
        require(o.animation_data is None and m.animation_data is None, "Animated native mesh")
        require(len(m.vertices) < 2**24 and len(m.loops) < 2**24 and len(m.polygons) < 2**24,
                "Diagnostic FLOAT ID bound")
        mods = [x for x in o.modifiers if x.type == "ARMATURE"]
        require(len(mods)==1 and mods[0].object==rig and mods[0].show_viewport and mods[0].show_render
                and mods[0].use_vertex_groups and not mods[0].use_bone_envelopes
                and not mods[0].use_deform_preserve_volume and not mods[0].use_multi_modifier
                and not mods[0].vertex_group, "Unsupported armature modifier")
        require(all(x.type == "ARMATURE" or (x.type == "SUBSURF" and x.levels == 0) for x in o.modifiers),
                "Unexpected modifier; applyFalse owns raw mesh only")
        slots = [s.material.name if s.material else None for s in o.material_slots]
        require(slots and None not in slots and len(set(slots))==len(slots), "Material slot ambiguity")
        material_names.extend(slots)
        require(len(m.uv_layers)==1 and m.uv_layers[0].active_render, "Require sole render UV")
        points = array(m.vertices, "co", 3)
        loop_points = array(m.loops, "vertex_index", 1, np.int32)[:,0]
        require(np.isfinite(points).all(), "Nonfinite native point")
        # Complete point-domain preservation requires the selected triangle representation to own each point.
        unreferenced=sorted(set(range(len(points)))-set(map(int,loop_points)))
        require(not unreferenced,"Native point without face-loop association: "+o.name+":"+repr(unreferenced[:8]))
        uv = array(m.uv_layers[0].data, "uv", 2).astype(np.float64)
        require(np.isfinite(uv).all(), "Nonfinite native UV")
        uv[:,1] = 1-uv[:,1]
        m.calc_loop_triangles()
        tris = []
        face_for_loop = np.empty(len(m.loops), dtype=np.int32)
        for f in m.polygons:
            require(0 <= f.material_index < len(slots), "Native polygon material range")
            for li in f.loop_indices:
                face_for_loop[li] = f.index
        for tri in m.loop_triangles:
            tris.append([int(tri.material_index), int(tri.polygon_index), *map(int,tri.loops)])
        keys = list(m.shape_keys.key_blocks) if m.shape_keys else []
        if keys:
            require(m.shape_keys.use_relative and m.shape_keys.animation_data is None, "Unsupported shape animation")
            require(all(k.relative_key==keys[0] and not k.mute and not k.vertex_group for k in keys[1:]),
                    "Unsupported eligible key semantics")
            base = array(keys[0].data, "co", 3)
            eligible = keys[1:]
        else:
            base, eligible = points, []
        base_world = swizzle_positions(base,o.matrix_world)
        arrays = {"base":base_world,"loop_points":loop_points,"face_for_loop":face_for_loop,"uv":uv,
                  "triangles":np.asarray(tris,dtype=np.int32)}
        weights = [float(k.value) for k in eligible]
        require(np.isfinite(weights).all(), "Nonfinite shape defaults")
        for i,k in enumerate(eligible):
            arrays["morph_"+str(i)] = swizzle_positions(array(k.data,"co",3),o.matrix_world)-base_world
        bone_weights = np.zeros((len(points),53),dtype=np.float64)
        raw = []
        bone_index = {n:i for i,n in enumerate(names)}
        for v in m.vertices:
            memberships = []
            for g in v.groups:
                w = float(g.weight)
                require(math.isfinite(w) and w >= 0, "Invalid native influence")
                group = o.vertex_groups[g.group].name
                memberships.append([int(g.group),w])
                if group in bone_index and w > 0:
                    require(w > .0001, "Native cutoff participant")
                    bone_weights[v.index,bone_index[group]] += w
            raw.append([int(v.index),memberships])
        raw_hash = hashlib.sha256(json.dumps(raw,separators=(",",":")).encode()).hexdigest()
        sums = bone_weights.sum(axis=1)
        require((sums > 0).all() and np.isfinite(sums).all(), "No positive native skin sum")
        arrays["weights"] = bone_weights/sums[:,None]
        deps = bpy.context.evaluated_depsgraph_get()
        eo = o.evaluated_get(deps)
        em = eo.to_mesh(preserve_all_data_layers=True,depsgraph=deps)
        try:
            require(len(em.vertices)==len(points), "Default evaluated topology changes")
            arrays["visible_default"] = swizzle_positions(array(em.vertices,"co",3),eo.matrix_world)
        finally:
            eo.to_mesh_clear()
        for k,a in arrays.items():
            require(np.isfinite(a).all(), "Nonfinite native array")
            ARRAYS[o.name+"/"+k] = a
        NATIVE["meshes"][o.name] = {"vertices":len(points),"loops":len(loop_points),"faces":len(m.polygons),
                "triangles":len(tris),"materials":slots,"shape_names":[k.name for k in eligible],
                "shape_weights":weights,"bone_names":names,"raw_influences_sha256":raw_hash,
                "world":matrix(o.matrix_world).tolist(),
                "all_key_metadata":MODULES["metadata_helper"].snapshot(m.shape_keys) if m.shape_keys else None,
                "default_geometry_scope":"Native evaluated viewport; raw mesh export/applyFalse; render subdivision held"}
    require(len(material_names)==len(set(material_names)), "Cross-owner material identity ambiguous")
    NATIVE["material_names"] = material_names


def audit(glb, decoder):
    d = glb.doc
    require(not d.get("animations") and not d.get("cameras"), "Unexpected animation/camera")
    nodes = d["nodes"]
    names = [n.get("name") for n in nodes]
    expected_names = set(NATIVE["meshes"]) | set(NATIVE["bones"]) | {"Human.rig"}
    require(None not in names and len(set(names))==len(names) and set(names)==expected_names,
            "Complete native owner/bone node identity")
    require(glb.reachable==set(range(len(nodes))), "Unreachable native output node")
    byname = {n:i for i,n in enumerate(names)}
    ri = byname["Human.rig"]
    require(ri not in glb.parent and "skin" not in nodes[ri] and "mesh" not in nodes[ri], "Rig root structure")
    compare("rig_world",glb.worlds[ri],np.asarray(NATIVE["rig_world"]))
    for name,b in NATIVE["bones"].items():
        i = byname[name]
        parent = b["parent"] or "Human.rig"
        check("joint_parent:"+name,glb.parent.get(i)==byname[parent],expected_parent=parent,
              actual_parent=names[glb.parent[i]] if i in glb.parent else None)
        require("mesh" not in nodes[i] and "skin" not in nodes[i], "Joint owns mesh/skin")
        compare("joint_local:"+name,decoder.trs(nodes[i]),np.asarray(b["local"]))
        compare("joint_global_rest:"+name,glb.worlds[i],np.asarray(b["global"]))
    meshes = d.get("meshes",[])
    materials = d.get("materials",[])
    require(len(meshes)==6 and sorted(m.get("name") for m in materials)==sorted(NATIVE["material_names"]),
            "Complete mesh/material identities")
    mesh_indices,skin_indices = set(),set()
    for owner,native in NATIVE["meshes"].items():
        node = nodes[byname[owner]]
        require(glb.parent.get(byname[owner])==ri and "mesh" in node and "skin" in node,"Mesh/rig/skin structure")
        # nodes.py55–76 omits skinned-node TRS. Native identity object frames are explicitly guarded.
        mesh_local=decoder.trs(node)
        mesh_world=glb.worlds[byname[owner]]
        require(abs(np.linalg.det(mesh_world))>1e-8,"Singular decoded mesh frame")
        compare("mesh_local_identity:"+owner,mesh_local,np.eye(4))
        compare("mesh_global_identity:"+owner,mesh_world,np.eye(4))
        mi,si = node["mesh"],node["skin"]
        require(type(mi) is int and 0 <= mi < len(meshes) and mi not in mesh_indices,"Mesh index reuse")
        require(type(si) is int and 0 <= si < len(d.get("skins",[])), "Skin index")
        mesh_indices.add(mi);skin_indices.add(si)
        skin = d["skins"][si]
        joints = skin["joints"]
        require(len(joints)==53 and len(set(joints))==53 and all(type(j) is int and 0<=j<len(nodes) for j in joints), "Skin joint indices")
        joint_names = [names[j] for j in joints]
        require(set(joint_names)==set(NATIVE["bones"]),"Complete skin53bones")
        if "skeleton" in skin:
            require(skin["skeleton"]==ri or skin["skeleton"] in joints,"Skeleton root index")
        ibm = glb.accessor(skin["inverseBindMatrices"])
        require(ibm.shape==(53,16) and d["accessors"][skin["inverseBindMatrices"]]["type"]=="MAT4", "IBM accessor")
        ibm = ibm.reshape(53,4,4).transpose(0,2,1)
        expected_ibm = np.asarray([NATIVE["bones"][name]["inverse_bind"] for name in joint_names])
        compare("inverse_binds:"+owner,ibm,expected_ibm)
        action = np.asarray([glb.worlds[j] for j in joints]) @ ibm
        compare("decoded_rest_skin_matrices:"+owner,action,np.repeat(np.eye(4)[None],53,axis=0))
        local_action=np.linalg.inv(mesh_world)[None] @ action
        m = meshes[mi]
        expected_shapes = native["shape_names"]
        require(m.get("extras",{}).get("targetNames",[])==expected_shapes,"Eligible target names/order")
        mesh_defaults = np.asarray(m.get("weights",[]),dtype=np.float64)
        effective = np.asarray(node.get("weights",m.get("weights",[])),dtype=np.float64)
        compare("mesh_morph_defaults:"+owner,mesh_defaults,np.asarray(native["shape_weights"]))
        compare("effective_morph_defaults:"+owner,effective,np.asarray(native["shape_weights"]))
        expected_triangles = Counter((int(t[0]),int(t[1]),cyclic(t[2:])) for t in ARRAYS[owner+"/triangles"])
        actual_triangles = Counter()
        seen_points = set()
        for pi,prim in enumerate(m["primitives"]):
            require(prim.get("mode",4)==4 and not prim.get("extensions"),"Require uncompressed triangle primitive")
            mat_index = prim["material"]
            require(type(mat_index) is int and 0 <= mat_index < len(materials),"Primitive material index")
            mat_name = materials[mat_index]["name"]
            require(mat_name in native["materials"],"Primitive material not native slot")
            slot = native["materials"].index(mat_name)
            attrs = prim["attributes"]
            def decoded(attr,kind,component=5126):
                ai = attrs[attr]
                a = d["accessors"][ai]
                require(a["type"]==kind and a["componentType"]==component and not a.get("normalized",False),"Attribute encoding: "+attr)
                return glb.accessor(ai)
            points = decoded("_SUGATA_NATIVE_VERTEX","SCALAR")[:,0]
            corners = decoded("_SUGATA_NATIVE_CORNER","SCALAR")[:,0]
            faces = decoded("_SUGATA_NATIVE_FACE","SCALAR")[:,0]
            require(len(points)==len(corners)==len(faces) and all((a==np.floor(a)).all() for a in (points,corners,faces)),"Diagnostic exact integer IDs")
            points,corners,faces = (a.astype(np.int64) for a in (points,corners,faces))
            require((points>=0).all() and (points<native["vertices"]).all() and (corners>=0).all()
                    and (corners<native["loops"]).all() and (faces>=0).all() and (faces<native["faces"]).all(),"Diagnostic IDs range")
            require(np.array_equal(ARRAYS[owner+"/loop_points"][corners],points)
                    and np.array_equal(ARRAYS[owner+"/face_for_loop"][corners],faces),"Exact native point/corner/face transport")
            require(len(set(map(int,corners)))==len(corners),"Unexpected duplicate diagnostic corner")
            ai=prim["indices"];ia=d["accessors"][ai]
            require(ia["type"]=="SCALAR" and ia["componentType"] in (5121,5123,5125) and not ia.get("normalized",False),"Index encoding")
            indices=glb.accessor(ai)[:,0].astype(np.int64)
            require(len(indices)%3==0 and (indices>=0).all() and (indices<len(points)).all(),"Triangle indices range")
            require(set(map(int,indices))==set(range(len(points))),"Unreferenced output vertex")
            seen_points.update(map(int,points))
            for tri in indices.reshape(-1,3):
                require(len(set(map(int,faces[tri])))==1,"Triangle spans native faces")
                actual_triangles[(slot,int(faces[tri[0]]),cyclic(corners[tri]))]+=1
            context={"owner":owner,"primitive":pi,"points":len(points),"triangles":len(indices)//3}
            pos=decoded("POSITION","VEC3").astype(np.float64)
            compare("positions:"+owner+":"+str(pi),pos,ARRAYS[owner+"/base"][points],distance=True,**context)
            uv=decoded("TEXCOORD_0","VEC2").astype(np.float64)
            compare("UV:"+owner+":"+str(pi),uv,ARRAYS[owner+"/uv"][corners],**context)
            targets=prim.get("targets",[])
            require(len(targets)==len(expected_shapes),"Complete eligible targets")
            default=pos.copy()
            for ki,target in enumerate(targets):
                require(set(target)=={"POSITION"},"Position-only morph contract")
                ai=target["POSITION"];a=d["accessors"][ai]
                require(a["type"]=="VEC3" and a["componentType"]==5126 and not a.get("normalized",False),"Morph encoding")
                delta=glb.accessor(ai).astype(np.float64)
                compare("morph:"+owner+":"+expected_shapes[ki]+":"+str(pi),delta,ARRAYS[owner+"/morph_"+str(ki)][points],distance=True,**context)
                default+=effective[ki]*delta
            compare("default_visible:"+owner+":"+str(pi),default,ARRAYS[owner+"/visible_default"][points],distance=True,**context)
            js=sorted(int(k.split("_")[1]) for k in attrs if k.startswith("JOINTS_"))
            ws=sorted(int(k.split("_")[1]) for k in attrs if k.startswith("WEIGHTS_"))
            require(js and js==ws==list(range(len(js))),"Complete paired skin sets")
            jout=np.concatenate([glb.accessor(attrs["JOINTS_"+str(k)]) for k in js],axis=1)
            wout=np.concatenate([glb.accessor(attrs["WEIGHTS_"+str(k)]) for k in ws],axis=1).astype(np.float64)
            for k in js:
                ja=d["accessors"][attrs["JOINTS_"+str(k)]];wa=d["accessors"][attrs["WEIGHTS_"+str(k)]]
                require(ja["type"]==wa["type"]=="VEC4" and ja["componentType"] in (5121,5123)
                        and not ja.get("normalized",False) and wa["componentType"]==5126 and not wa.get("normalized",False),"Skin encoding")
            require(jout.shape==wout.shape and len(jout)==len(points) and (jout>=0).all() and (jout<53).all() and (wout>=0).all(),"Skin slot bounds")
            native_order=native["bone_names"]
            correspondence=np.asarray([native_order.index(n) for n in joint_names],dtype=np.int64)
            weights=np.zeros((len(points),53),dtype=np.float64)
            for vi in range(len(points)):
                positive=wout[vi]>0
                ji=correspondence[jout[vi,positive].astype(np.int64)]
                require(len(set(map(int,ji)))==len(ji),"Duplicate positive skin contribution")
                weights[vi,ji]=wout[vi,positive]
            expected=ARRAYS[owner+"/weights"][points]
            check("complete_positive_skin_set:"+owner+":"+str(pi),np.array_equal(weights>0,expected>0),**context)
            compare("normalized_skin_weights:"+owner+":"+str(pi),weights,expected,**context)
            # Independent decoded whole weighted rest action on effective morph positions.
            homogeneous=np.column_stack([default,np.ones(len(default))])
            transformed=np.zeros_like(homogeneous)
            for column in range(jout.shape[1]):
                mapped=local_action[jout[:,column].astype(np.int64)]
                transformed+=np.einsum("nij,nj->ni",mapped,homogeneous)*wout[:,column,None]
            transformed=transformed@mesh_world.T
            compare("rest_skinned_default_world:"+owner+":"+str(pi),transformed[:,:3],ARRAYS[owner+"/visible_default"][points],distance=True,**context)
            compare("rest_skin_homogeneous_sum:"+owner+":"+str(pi),transformed[:,3],np.ones(len(points)),**context)
        check("complete_triangle_multiset:"+owner,actual_triangles==expected_triangles,
              source_triangles=sum(expected_triangles.values()),output_triangles=sum(actual_triangles.values()),
              missing=list((expected_triangles-actual_triangles).items())[:5],extra=list((actual_triangles-expected_triangles).items())[:5])
        check("complete_referenced_native_points:"+owner,seen_points==set(range(native["vertices"])),source_points=native["vertices"],output_points=len(seen_points))
    require(mesh_indices==set(range(len(meshes))) and skin_indices==set(range(len(d.get("skins",[])))),"Unused output mesh/skin")
    REPORT["format"]={"nodes":len(nodes),"meshes":len(meshes),"skins":len(skin_indices),"materials":len(materials),
                      "accessors":len(d.get("accessors",[])),"extensions_used":d.get("extensionsUsed",[])}


def run():
    require(bpy.app.background and not bpy.app.online_access and Path(bpy.data.filepath).resolve()==SOURCE,"Exact offline source")
    require(pin_matches(PLAN["source"]) and pin_matches(PLAN["pristine"])
            and all(pin_matches(p) for p in PLAN["pins"]),"Source/instrument pin changed")
    require(not OUT.exists() and all(not (HERE/n).exists() for n in
            ["RESULT.json","COLD-RESULT.json","NATIVE.json","GLB-DOCUMENT.json"]),"First-output directory/record collision")
    OUT.mkdir()
    for name in ("scene_helper","metadata_helper","cold_guard","decoder","rna_helper"):
        MODULES[name]=module("sugata_numeric_"+name,PLAN[name]["path"])
    decoder=MODULES["decoder"]
    before=MODULES["scene_helper"].capture_scene()
    warm=json.loads(Path(PLAN["warm_receipt"]["path"]).read_text())
    MODULES["cold_guard"].qualify(HERE,before,warm,MODULES["metadata_helper"])
    meshes=sorted([o for o in bpy.data.objects if o.type=="MESH"],key=lambda o:o.name)
    require(len(meshes)==6 and len(bpy.data.objects)==7,"Exact six meshes/one rig")
    rig=bpy.data.objects["Human.rig"]
    require(rig.type=="ARMATURE","Rig type")
    # Every operator literal is checked against the actual registered RNA before mutation/export.
    options=PLAN["kwargs"]
    REPORT["RNA"]=[]
    MODULES["rna_helper"].validate(bpy,options,REPORT["RNA"],PLAN["format_source"])
    capture_native(meshes,rig,decoder)
    for o in before["objects"]:
        if o["type"]=="MESH":
            require(NATIVE["meshes"][o["name"]]["raw_influences_sha256"]==o["mesh"]["influences_sha256"],"Raw skin hash binding")
    with (HERE/"NATIVE.json").open("x") as f:
        json.dump(NATIVE,f,indent=2,allow_nan=False);f.write("\n")
    np.savez_compressed(OUT/"native-arrays.npz",**ARRAYS)
    REPORT["native_arrays"]=identity(OUT/"native-arrays.npz")
    added=[]
    selected_before=[o for o in bpy.context.selected_objects]
    active_before=bpy.context.view_layer.objects.active
    try:
        for o in meshes:
            for name,domain in ATTRS:
                require(o.data.attributes.get(name) is None,"Diagnostic attribute collision")
                attr=o.data.attributes.new(name=name,type="FLOAT",domain=domain)
                added.append((o,attr))
                attr.data.foreach_set("value",np.arange(len(attr.data),dtype=np.float32))
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes+[rig]:
            o.select_set(True)
        bpy.context.view_layer.objects.active=rig
        bpy.context.view_layer.update()
        require(set(bpy.context.selected_objects)==set(meshes+[rig]),"Exact selected owner set")
        outfile=OUT/"candidate.glb"
        REPORT["export_started_utc"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
        REPORT["export_calls"]+=1
        status=bpy.ops.export_scene.gltf(filepath=str(outfile),**options)
        REPORT["operator_status"]=sorted(status)
        require("FINISHED" in status and outfile.is_file(),"Exporter did not finish/save first GLB")
        require(outfile.stat().st_size <= PLAN["decoder_limits"]["max_glb_bytes"],"First GLB exceeds declared byte budget")
        REPORT["candidate_glb"]=identity(outfile)
        raw=outfile.read_bytes()
        row_budget=max([53]+[n["triangles"]*3 for n in NATIVE["meshes"].values()])
        REPORT["decoder_limits"]={**PLAN["decoder_limits"],"max_accessor_rows":row_budget}
        glb=decoder.GLB(raw,max_accessor_rows=row_budget,**PLAN["decoder_limits"])
        with (HERE/"GLB-DOCUMENT.json").open("x") as f:
            json.dump(glb.doc,f,indent=2,allow_nan=False);f.write("\n")
        audit(glb,decoder)
    finally:
        for o,attr in reversed(added):
            o.data.attributes.remove(attr)
        bpy.ops.object.select_all(action="DESELECT")
        for o in selected_before:
            o.select_set(True)
        bpy.context.view_layer.objects.active=active_before
        bpy.context.view_layer.update()
        after=MODULES["scene_helper"].capture_scene()
        check("complete_owner_state_unchanged",after==before)
        check("body_provenance_unchanged",MODULES["cold_guard"].capture_provenance(bpy.data.objects["Human"])==warm["mapping"])
        check("expanded_body_keys_unchanged",MODULES["metadata_helper"].snapshot(bpy.data.objects["Human"].data.shape_keys)==warm["extended_key_metadata"]["restored"])
        for o in meshes:
            meta=MODULES["metadata_helper"].snapshot(o.data.shape_keys) if o.data.shape_keys else None
            check("all_key_metadata_unchanged:"+o.name,meta==NATIVE["meshes"][o.name]["all_key_metadata"])
        check("selection_active_restored",set(bpy.context.selected_objects)==set(selected_before)
              and bpy.context.view_layer.objects.active==active_before)
        check("saved_source_bytes_unchanged",pin_matches(PLAN["source"]))
        check("pristine_bytes_unchanged",pin_matches(PLAN["pristine"]))
        REPORT["owner_before_after"]={"before":before,"after":after}
    REPORT["passed"]=bool(REPORT["checks"]) and all(c["pass"] for c in REPORT["checks"])


try:
    run()
except Exception as error:
    REPORT["exception"]=repr(error)
    REPORT["traceback"]=traceback.format_exc()
finally:
    REPORT["finished_utc"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (HERE/"RESULT.json").open("x") as f:
        json.dump(REPORT,f,indent=2,allow_nan=False);f.write("\n")
    print("SUGATA_RESULT "+json.dumps({"passed":REPORT["passed"],"checks":len(REPORT["checks"]),"exports":REPORT["export_calls"],"exception":REPORT.get("exception")}),flush=True)
if not REPORT["passed"]:
    raise RuntimeError("First numerical GLB refused; preserve output without retry")
