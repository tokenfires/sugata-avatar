"""One native polygon-preserving continuous-domain construction and unchanged band control.

Loads pinned builder definitions without its terminal CLI invocation. No product writes.
"""
from pathlib import Path
import ast, copy, datetime, gzip, hashlib, inspect, json, math, os, struct, sys, traceback, types
import bmesh
import bpy
from mathutils import Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "captures/foundation-domain-native-2026-09-30-v3"
PROFILE = ROOT / "tmp/wardrobe-sep30/blender-profile"
PARENT = ROOT / "captures/wardrobe-native-oracle-2026-09-30-v2/report.json"
BUILDER = ROOT / "tools/figure-pipeline/build_figure.py"
EXPECTED_BUILDER = "8470ba8b949058d7127cdb22458ed83d1c611042e2f366f1371da698056559f2"
assert not OUT.exists(), "Fresh output required"
assert Path(bpy.utils.user_resource("CONFIG")).resolve().is_relative_to(PROFILE)
OUT.mkdir(parents=True)

def sha(b): return hashlib.sha256(b).hexdigest()
def digest(p): return sha(Path(p).read_bytes())
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def flat(vs): return [float(c) for v in vs for c in v]
def matrix(m): return [list(r) for r in m]
def serial(v):
    if isinstance(v, dict): return {k: serial(x) for k, x in v.items()}
    if isinstance(v, (str, int, float, bool)) or v is None: return v
    return [serial(x) for x in v]

POSES = {
    "identity": {},
    "elbow": {"lowerarm_l": {"axis": [1, 0, 0], "radians": .6}},
    "coupled": {
        "pelvis": {"axis": [0, 0, 1], "radians": .08},
        "spine_02": {"axis": [1, 0, 0], "radians": .15},
        "upperarm_l": {"axis": [0, 0, 1], "radians": -.35},
        "lowerarm_l": {"axis": [1, 0, 0], "radians": .6},
        "thigh_r": {"axis": [1, 0, 0], "radians": -.35},
        "calf_r": {"axis": [1, 0, 0], "radians": .65},
        "head": {"axis": [0, 1, 0], "radians": .2},
    },
}
report = {"started": now(), "pid": os.getpid(), "status": "running", "errors": [],
          "blender": bpy.app.version_string, "buildHash": bpy.app.build_hash.decode(),
          "sources": {}, "artifacts": [], "cases": [], "poses": POSES,
          "scope": "One pre-offset plane/domain intersection with preserved homogeneous polygons; original whole-face band control; no asset promotion."}

def save(): (OUT / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")

def archive(name, obj):
    raw = (json.dumps(obj, separators=(",", ":"), allow_nan=False) + "\n").encode()
    encoded = gzip.compress(raw, mtime=0)
    (OUT / name).write_bytes(encoded)
    item = {"file": name, "bytes": len(encoded), "sha256": sha(encoded), "decodedSHA256": sha(raw)}
    report["artifacts"].append(item)
    return item

def bind(p):
    p = Path(p).resolve()
    relative = str(p.relative_to(ROOT))
    data = p.read_bytes()
    report["sources"][relative] = sha(data)
    dest = OUT / "source" / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

def attributes(mesh):
    result = {}
    for a in mesh.attributes:
        if not a.name.startswith("_"): continue
        assert a.domain == "POINT" and a.data_type == "FLOAT", (a.name, a.domain, a.data_type)
        result[a.name] = [float(v.value) for v in a.data]
    return result

def weight_rows(obj, rig):
    names = {b.name for b in rig.data.bones if b.use_deform}
    groups = {g.index: g.name for g in obj.vertex_groups}
    return [[[groups[e.group], float(e.weight)] for e in v.groups
             if groups[e.group] in names and e.weight > 0] for v in obj.data.vertices]

def admit_rig(obj, rig, names):
    identity = matrix(Matrix.Identity(4))
    assert set(b.name for b in rig.data.bones) == names
    assert matrix(obj.matrix_world) == identity and matrix(rig.matrix_world) == identity
    for b in rig.data.bones:
        assert b.use_deform and b.inherit_scale == "FULL" and b.use_inherit_rotation
        assert b.use_local_location and not b.use_connect and not rig.pose.bones[b.name].constraints
    assert all(m.type == "ARMATURE" for m in obj.modifiers)
    assert len(obj.modifiers) == 1
    m = obj.modifiers[0]
    assert m.object == rig and m.use_vertex_groups and not m.use_bone_envelopes
    assert not m.use_deform_preserve_volume and not m.use_multi_modifier and not m.vertex_group
    assert m.show_viewport and m.show_render
    return {"boneNames": sorted(names), "matrixWorld": matrix(obj.matrix_world),
            "rigWorld": matrix(rig.matrix_world), "useVertexGroups": m.use_vertex_groups,
            "useBoneEnvelopes": m.use_bone_envelopes, "preserveVolume": m.use_deform_preserve_volume,
            "multiModifier": m.use_multi_modifier, "vertexGroup": m.vertex_group,
            "bones": {b.name: {"inheritScale": b.inherit_scale, "inheritRotation": b.use_inherit_rotation,
                               "localLocation": b.use_local_location, "connected": b.use_connect,
                               "deform": b.use_deform, "constraints": len(rig.pose.bones[b.name].constraints)}
                      for b in rig.data.bones}}

def native_mesh(obj, rig):
    obj.data.calc_loop_triangles()
    weights = weight_rows(obj, rig)
    assert all(rows and abs(sum(v for _, v in rows) - 1) < .001 for rows in weights)
    return {"objectName": obj.name, "meshName": obj.data.name,
            "materials": [m.name if m else None for m in obj.data.materials],
            "positions": flat(v.co for v in obj.data.vertices),
            "normals": flat(v.vector for v in obj.data.vertex_normals),
            "polygons": [list(p.vertices) for p in obj.data.polygons],
            "triangles": [list(p.vertices) for p in obj.data.loop_triangles],
            "triangleLoops": [list(p.loops) for p in obj.data.loop_triangles],
            "loopVertexIndices": [int(v.vertex_index) for v in obj.data.loops],
            "cornerNormals": flat(n.vector for n in obj.data.corner_normals),
            "uvLayers": {a.name: flat(v.uv for v in a.data) for a in obj.data.uv_layers},
            "activeUV": obj.data.uv_layers.active.name if obj.data.uv_layers.active else None,
            "smoothPolygons": [bool(p.use_smooth) for p in obj.data.polygons],
            "hasCustomNormals": obj.data.has_custom_normals,
            "sharpEdges": [bool(v.value) for v in obj.data.attributes["sharp_edge"].data]
                          if "sharp_edge" in obj.data.attributes else None,
            "attributes": attributes(obj.data), "weights": weights,
            "matrixWorld": matrix(obj.matrix_world),
            "modifiers": [{"name": m.name, "type": m.type, "viewport": m.show_viewport,
                           "render": m.show_render, "object": getattr(getattr(m, "object", None), "name", None)}
                          for m in obj.modifiers]}

def pose_rig(rig, specification):
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
        b.rotation_mode = "QUATERNION"
    for name, q in specification.items():
        rig.pose.bones[name].rotation_quaternion = Quaternion(q["axis"], q["radians"])
    bpy.context.view_layer.update()

def evaluated_mesh(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        assert len(mesh.vertices) == len(obj.data.vertices)
        assert [list(p.vertices) for p in mesh.polygons] == [list(p.vertices) for p in obj.data.polygons]
        return {"positions": flat(v.co for v in mesh.vertices),
                "normals": flat(n.vector for n in mesh.vertex_normals), "matrixWorld": matrix(evaluated.matrix_world)}
    finally: evaluated.to_mesh_clear()


def split_weight_domain(shell, rig, effective):
    """Keep homogeneous polygons; conformingly split only the field and its neighbours."""
    mesh=shell.data
    snapshot=native_mesh(shell,rig)
    group_names={g.index:g.name for g in shell.vertex_groups}
    full_groups=[{e.group:float(e.weight) for e in v.groups} for v in mesh.vertices]
    snapshot["vertexGroups"]=[{"index":i,"name":n} for i,n in group_names.items()]
    snapshot["allGroupRows"]=full_groups
    snapshot["materialIndices"]=[p.material_index for p in mesh.polygons]
    snapshot["attributeSchema"]=[{"name":a.name,"type":a.data_type,"domain":a.domain} for a in mesh.attributes]
    editor_schema={".uv_select_vert":("BOOLEAN","CORNER"),".uv_select_edge":("BOOLEAN","CORNER"),".uv_select_face":("BOOLEAN","FACE")}
    editor_before={}
    for name,(kind,domain) in editor_schema.items():
        a=mesh.attributes.get(name)
        if a:
            assert (a.data_type,a.domain)==(kind,domain)
            editor_before[name]=[bool(v.value) for v in a.data]
    snapshot["editorSelection"]=editor_before
    before=archive("domain-before.json.gz",snapshot)
    supported=set(editor_schema)|set(snapshot["attributes"])|set(snapshot["uvLayers"])|{"position",".edge_verts",".corner_vert",".corner_edge","material_index","sharp_face","sharp_edge",".select_vert",".select_edge",".select_poly"}
    assert all(a["name"] in supported for a in snapshot["attributeSchema"]), snapshot["attributeSchema"]
    assert not snapshot["hasCustomNormals"]
    assert snapshot["sharpEdges"] is None or not any(snapshot["sharpEdges"])
    assert all(snapshot["smoothPolygons"])
    verts=[list(v.co) for v in mesh.vertices]
    original_count=len(verts)
    point_attrs={n:values[:] for n,values in snapshot["attributes"].items()}
    deform_names={b.name for b in rig.data.bones if b.use_deform}
    torso_indices={i for i,n in group_names.items() if n in builder.TORSO_BONES}
    other_indices={i for i,n in group_names.items() if n in deform_names and n not in builder.TORSO_BONES}
    def maximum(rows,indices): return max([rows.get(i,0.0) for i in indices] or [0.0])
    field=[maximum(w,torso_indices)-maximum(w,other_indices) for w in full_groups]
    original_dominant=builder.dominant_bone_per_vertex(shell,rig)
    source_ties=[i for i,d in enumerate(field) if d==0 and effective[0]<=verts[i][2]<=effective[1]]
    # This specific source has no ties in the slab; preserve an unexpected tie as a failed admission.
    assert not source_ties, source_ties
    def in_height(ids): return all(effective[0]<=verts[i][2]<=effective[1] for i in ids)
    def mixed(ids): return min(field[i] for i in ids)<0<max(field[i] for i in ids)
    poly_ids=[list(p.vertices) for p in mesh.polygons]
    poly_loops=[list(p.loop_indices) for p in mesh.polygons]
    tri_by_poly={i:[] for i in range(len(mesh.polygons))}
    for t in mesh.loop_triangles: tri_by_poly[t.polygon_index].append((list(t.vertices),list(t.loops)))
    mixed_polys={i for i,vs in enumerate(poly_ids) if in_height(vs) and mixed(vs)}
    assert mixed_polys
    def area(ids):
        a,b,c=[verts[i] for i in ids]
        u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
        return math.sqrt(sum(x*x for x in [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]))/2
    certificates=[]
    for pi,triangles in tri_by_poly.items():
        if not in_height(poly_ids[pi]): continue
        for ids,loops in triangles:
            ds=[field[i] for i in ids]
            if all(d>0 for d in ds) or all(d<0 for d in ds):
                positive=all(d>0 for d in ds)
                own,opposition=(torso_indices,other_indices) if positive else (other_indices,torso_indices)
                winners=[g for g in sorted(own) if all(full_groups[i].get(g,0)>maximum(full_groups[i],opposition) for i in ids)]
                assert winners, ("uncertified homogeneous triangle",pi,ids)
                certificates.append({"polygon":pi,"vertices":ids,"kind":"positive" if positive else "negative","bone":group_names[winners[0]]})
            else:
                ts=[g for g in sorted(torso_indices) if all(full_groups[i].get(g,0)==maximum(full_groups[i],torso_indices) for i in ids)]
                ns=[g for g in sorted(other_indices) if all(full_groups[i].get(g,0)==maximum(full_groups[i],other_indices) for i in ids)]
                assert ts and ns,("changing active pair",pi,ids)
                certificates.append({"polygon":pi,"vertices":ids,"kind":"mixed","pair":[group_names[ts[0]],group_names[ns[0]]]})
    record={"before":before,"sourceVertices":original_count,"sourcePolygons":len(poly_ids),
            "sourceTies":source_ties,"mixedPolygons":sorted(mixed_polys),"certificates":certificates,
            "interpolationComponentBound":.000002,"positionStorageBoundMetres":.000001}
    report["domainConstruction"]=record
    cuts=[];cut_map={}
    def f32(x):return struct.unpack("f",struct.pack("f",x))[0]
    def cut(a,b):
        key=tuple(sorted((a,b)))
        if key in cut_map:return cut_map[key]
        a,b=key;da,db=field[a],field[b]
        assert da*db<0
        t=da/(da-db)
        expected=[verts[a][k]+t*(verts[b][k]-verts[a][k]) for k in range(3)]
        position=[f32(x) for x in expected]
        keys=full_groups[a].keys()|full_groups[b].keys()
        expected_groups={g:full_groups[a].get(g,0)+t*(full_groups[b].get(g,0)-full_groups[a].get(g,0)) for g in keys}
        actual_groups={g:f32(v) for g,v in expected_groups.items()}
        id=len(verts);verts.append(position);full_groups.append(actual_groups);field.append(0.0)
        expected_attrs={n:rows[a]+t*(rows[b]-rows[a]) for n,rows in point_attrs.items()}
        actual_attrs={n:f32(v) for n,v in expected_attrs.items()}
        for n,rows in point_attrs.items():rows.append(actual_attrs[n])
        cuts.append({"vertex":id,"edge":[a,b],"t":t,"expectedPosition":expected,"position":position,
            "expectedGroups":expected_groups,"groups":actual_groups,"expectedAttributes":expected_attrs,"attributes":actual_attrs,
            "storedWeightDifference":maximum(actual_groups,torso_indices)-maximum(actual_groups,other_indices)})
        assert math.dist(expected,position)<=record["positionStorageBoundMetres"]
        assert max([abs(actual_groups[g]-v) for g,v in expected_groups.items()]+[abs(actual_attrs[n]-v) for n,v in expected_attrs.items()]+[0])<=record["interpolationComponentBound"]
        cut_map[key]=id;return id
    # Construct all shared field intersections before propagating them to neighbouring polygons.
    for pi in sorted(mixed_polys):
        for ids,loops in tri_by_poly[pi]:
            assert area(ids)>0,("mixed source triangle degenerate",pi,ids)
            for k,a in enumerate(ids):
                b=ids[(k+1)%3]
                if field[a]*field[b]<0:cut(a,b)
    affected={}
    for pi,ids in enumerate(poly_ids):
        if pi in mixed_polys:continue
        edges={tuple(sorted((a,ids[(k+1)%len(ids)]))) for k,a in enumerate(ids)}&cut_map.keys()
        if edges:affected[pi]=edges
    # Any such neighbour in this finite source must be outside the slab.
    assert all(not in_height(poly_ids[pi]) for pi in affected)
    record["outsideNeighbours"]={str(pi):[list(e) for e in sorted(es)] for pi,es in affected.items()}
    out_polys=[];out_uv={n:[] for n in snapshot["uvLayers"]};lineage=[]
    def emit(ids,pi,source_ids,source_loops,kind):
        assert len(ids)>=3 and len(set(ids))==len(ids)
        if len(ids)==3 and kind!="unchanged-polygon":assert area(ids)>0,("new affected triangle degenerate",pi,ids,kind)
        corners=[]
        for id in ids:
            if id in source_ids:
                index=source_ids.index(id);corner={"vertex":id,"sourceLoop":source_loops[index]}
                for n,rows in snapshot["uvLayers"].items():out_uv[n].extend(rows[source_loops[index]*2:source_loops[index]*2+2])
            else:
                item=cuts[id-original_count];a,b=item["edge"];t=item["t"]
                assert a in source_ids and b in source_ids
                la=source_loops[source_ids.index(a)];lb=source_loops[source_ids.index(b)]
                corner={"vertex":id,"edgeLoops":[la,lb],"t":t,"UV":{}}
                for n,rows in snapshot["uvLayers"].items():
                    expected=[rows[la*2+k]+t*(rows[lb*2+k]-rows[la*2+k]) for k in range(2)]
                    actual=[f32(x) for x in expected];out_uv[n].extend(actual)
                    assert max(abs(x-y) for x,y in zip(actual,expected))<=record["interpolationComponentBound"]
                    corner["UV"][n]={"expected":expected,"actual":actual}
            corners.append(corner)
        lineage.append({"originalPolygon":pi,"kind":kind,"vertices":ids,"corners":corners})
        out_polys.append(ids)
    for pi,ids in enumerate(poly_ids):
        if pi in mixed_polys:
            for tri,loops in tri_by_poly[pi]:
                for sign in [1,-1]:
                    poly=[]
                    for k,a in enumerate(tri):
                        b=tri[(k+1)%3]
                        if field[a]*sign>=0:poly.append(a)
                        if field[a]*field[b]<0:poly.append(cut_map[tuple(sorted((a,b)))])
                    if len(poly)>=3:emit(poly,pi,tri,loops,"domain-positive" if sign==1 else "domain-negative")
        elif pi in affected:
            for tri,loops in tri_by_poly[pi]:
                assert area(tri)>0,("outside source triangle degenerate",pi,tri)
                pieces=[tri]
                for edge in sorted(affected[pi]):
                    mid=cut_map[edge];replacement=[]
                    for part in pieces:
                        found=False
                        for k,a in enumerate(part):
                            b=part[(k+1)%3]
                            if tuple(sorted((a,b)))==edge:
                                c=part[(k+2)%3];replacement.extend([[a,mid,c],[mid,b,c]]);found=True;break
                        if not found:replacement.append(part)
                    pieces=replacement
                for part in pieces:emit(part,pi,tri,loops,"outside-edge-propagation")
        else:emit(ids[:],pi,ids,poly_loops[pi],"unchanged-polygon")
    # Preserve intended full data before native reconstruction, including on a later admission failure.
    record["emission"]=archive("domain-emission.json.gz",{"vertexGroups":snapshot["vertexGroups"],"vertices":verts,
        "groups":full_groups,"pointAttributes":point_attrs,"polygons":out_polys,"UVs":out_uv,"lineage":lineage,"cuts":cuts,"field":field})
    save()
    # A fresh mesh carries the admitted complete vertex/group/corner data, not a four-weight subset.
    new=bpy.data.meshes.new(mesh.name+".domain")
    new.from_pydata(verts,[],out_polys)
    for material in mesh.materials:new.materials.append(material)
    shell.data=new
    # Assigning a fresh mesh may clear the object's vertex-group definitions.
    # Restore every saved name in its original index order before adding weights.
    groups_after_assignment=[{"index":g.index,"name":g.name} for g in shell.vertex_groups]
    assert not groups_after_assignment or groups_after_assignment==snapshot["vertexGroups"]
    if not groups_after_assignment:
        for index,name in sorted(group_names.items()):
            g=shell.vertex_groups.new(name=name)
            assert g.index==index and g.name==name
    restored_groups=[{"index":g.index,"name":g.name} for g in shell.vertex_groups]
    assert restored_groups==snapshot["vertexGroups"]
    record["groupDefinitions"]={"afterMeshAssignment":groups_after_assignment,"restored":restored_groups}
    save()
    for i,rows in enumerate(full_groups):
        for g,w in rows.items():shell.vertex_groups[g].add([i],w,"REPLACE")
    for n,rows in point_attrs.items():
        a=new.attributes.new(n,"FLOAT","POINT")
        for i,v in enumerate(rows):a.data[i].value=v
    for n,rows in out_uv.items():
        a=new.uv_layers.new(name=n)
        for i,v in enumerate(a.data):v.uv=(rows[2*i],rows[2*i+1])
    if snapshot["activeUV"]:new.uv_layers.active_index=list(new.uv_layers.keys()).index(snapshot["activeUV"])
    for i,p in enumerate(new.polygons):
        pi=lineage[i]["originalPolygon"];p.use_smooth=snapshot["smoothPolygons"][pi];p.material_index=snapshot["materialIndices"][pi]
    new.update();bpy.context.view_layer.update()
    assert [list(p.vertices) for p in new.polygons]==out_polys
    assert [list(v.co) for v in new.vertices]==verts
    for i,v in enumerate(new.vertices):assert {e.group:float(e.weight) for e in v.groups}==full_groups[i]
    actual=native_mesh(shell,rig)
    assert actual["attributes"]==point_attrs and actual["uvLayers"]==out_uv
    original_edges={tuple(sorted((a,ids[(k+1)%len(ids)]))) for ids in poly_ids for k,a in enumerate(ids)}
    current_edges={tuple(sorted(e.vertices)) for e in new.edges}
    record["adjacency"]={"originalEdges":len(original_edges),"currentEdges":len(current_edges),
        "added":[list(e) for e in sorted(current_edges-original_edges)],"removed":[list(e) for e in sorted(original_edges-current_edges)]}
    record["data"]=archive("domain-construction.json.gz",{"vertexGroups":snapshot["vertexGroups"],"cuts":cuts,
        "allGroupRows":full_groups,"lineage":lineage,"field":field,"native":actual})
    record["editorSelection"]={"before":editor_before,"after":{name:[bool(v.value) for v in new.attributes[name].data] for name in editor_schema if name in new.attributes},
        "policy":"Editor UV selection state may reset on the isolated reconstructed mesh; rendering attributes remain independently preserved."}
    record["newVertices"]=len(cuts);record["newPolygons"]=len(out_polys)
    selected={i for i,p in enumerate(verts) if effective[0]<=p[2]<=effective[1] and
              (field[i]>0 or i>=original_count or (field[i]==0 and original_dominant[i] in builder.TORSO_BONES))}
    neighbours=builder.vertex_neighbours(new)
    graph_boundary={i for i in selected if any(j not in selected for j in neighbours[i])}
    contour_vertices={i for i in selected if verts[i][2] in effective or i>=original_count}
    assert graph_boundary==contour_vertices,{"offContour":sorted(graph_boundary-contour_vertices),"notPinned":sorted(contour_vertices-graph_boundary)}
    counts={}
    for ids in out_polys:
        if not all(i in selected for i in ids):continue
        for k,a in enumerate(ids):
            edge=tuple(sorted((a,ids[(k+1)%len(ids)])));counts[edge]=counts.get(edge,0)+1
    assert all(n<=2 for n in counts.values())
    boundary=[e for e,n in counts.items() if n==1];adj={};rows=[]
    for a,b in boundary:
        plane=next((z for z in effective if verts[a][2]==z and verts[b][2]==z),None)
        domain=a>=original_count and b>=original_count
        assert plane is not None or domain,(a,b)
        rows.append({"edge":[a,b],"plane":plane,"domain":domain})
        adj.setdefault(a,set()).add(b);adj.setdefault(b,set()).add(a)
    assert all(len(ns)==2 for ns in adj.values()) and set(adj)==contour_vertices
    seen=set();loops=[]
    for first in sorted(adj):
        if first in seen:continue
        queue=[first];seen.add(first)
        for v in queue:
            for n in adj[v]:
                if n not in seen:seen.add(n);queue.append(n)
        loops.append({"vertices":queue,"heightMin":min(verts[i][2] for i in queue),"heightMax":max(verts[i][2] for i in queue)})
    assert len(loops)==2
    record["selection"]={"vertices":len(selected),"selected":sorted(selected),"boundary":rows,"loops":loops}
    report["boundaryConstruction"]["selection"]={"vertices":len(selected),"boundaryVertices":len(adj),"source":"combined height planes and provenance-owned domain contour"}
    save();return selected


def cut_patch_at_planes(shell, rig, region_of, marks):
    nominal = [marks.bust_z - .50 * (marks.bust_z - marks.spine_03_z),
               marks.bust_z + .45 * (marks.clavicle_z - marks.bust_z)]
    effective = [struct.unpack("f", struct.pack("f", z))[0] for z in nominal]
    record = {"nominal": nominal, "effective": effective, "splits": [],
              "positionToleranceMetres": .000001, "attributeTolerance": .000002}
    report["boundaryConstruction"] = record
    for label, plane in zip(["lower", "upper"], effective):
        snapshot = native_mesh(shell, rig)
        group_names = {g.index: g.name for g in shell.vertex_groups}
        snapshot["vertexGroups"] = [{"index":i,"name":n} for i,n in group_names.items()]
        before = archive(label + "-before-cut.json.gz", snapshot)
        bm = bmesh.new()
        try:
            bm.from_mesh(shell.data)
            bm.verts.ensure_lookup_table(); bm.verts.index_update()
            bm.faces.ensure_lookup_table(); bm.faces.index_update()
            original_verts = set(bm.verts)
            old_positions = {v: list(v.co) for v in bm.verts}
            deform = bm.verts.layers.deform.active
            assert deform is not None
            float_layers = {n: bm.verts.layers.float[n] for n in snapshot["attributes"]}
            old_weights = {v: dict(v[deform]) for v in bm.verts}
            old_masks = {v: {n: float(v[layer]) for n, layer in float_layers.items()} for v in bm.verts}
            face_id = bm.faces.layers.int.new("cut_original_face")
            uv_layers = {n: bm.loops.layers.uv[n] for n in snapshot["uvLayers"]}
            old_uv = {}
            for f in bm.faces:
                f[face_id] = f.index
                old_uv[f.index] = {loop.vert: {n: list(loop[layer].uv) for n, layer in uv_layers.items()} for loop in f.loops}
            crossings = []
            for e in list(bm.edges):
                a, b = e.verts
                za, zb = float(a.co.z), float(b.co.z)
                if (za-plane)*(zb-plane) < 0:
                    t = (plane-za)/(zb-za)
                    position = [float(a.co[k]) + t*(float(b.co[k])-float(a.co[k])) for k in range(3)]
                    crossings.append({"a": a, "b": b, "ids": [a.index,b.index], "t": t,
                                      "position": position, "faces": [f[face_id] for f in e.link_faces]})
            assert crossings
            result = bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                dist=0, plane_co=(0,0,plane), plane_no=(0,0,1), clear_inner=False, clear_outer=False)
            cut_verts = {g for g in result["geom_cut"] if isinstance(g,bmesh.types.BMVert)}
            new_verts = set(bm.verts)-original_verts
            assert len(new_verts) == len(crossings) and new_verts <= cut_verts
            bm.verts.index_update(); bm.faces.index_update()
            witnesses, used, displacements = [], set(), []
            for v in cut_verts:
                displacements.append({"vertex": v.index, "before": list(v.co), "zDisplacement": plane-float(v.co.z)})
                v.co.z = plane
                assert v.co.z == plane
            for v in original_verts:
                assert list(v.co) == old_positions[v], ("old vertex moved",v.index)
                assert dict(v[deform]) == old_weights[v]
                assert all(v[layer] == old_masks[v][n] for n,layer in float_layers.items())
            for v in sorted(new_verts,key=lambda v:v.index):
                matches = [(math.dist(v.co,edge["position"]),i) for i,edge in enumerate(crossings)]
                matches.sort()
                distance, index = matches[0]
                assert distance <= record["positionToleranceMetres"]
                assert len(matches)==1 or matches[1][0] > record["positionToleranceMetres"], ("ambiguous crossing",v.index)
                assert index not in used
                used.add(index)
                e = crossings[index]; a,b,t=e["a"],e["b"],e["t"]
                assert (old_weights[a].keys()|old_weights[b].keys()|dict(v[deform]).keys()) <= group_names.keys()
                weights = {g:(1-t)*old_weights[a].get(g,0)+t*old_weights[b].get(g,0) for g in old_weights[a].keys()|old_weights[b].keys()}
                observed = dict(v[deform])
                weight_error = max([abs(observed.get(g,0)-weights.get(g,0)) for g in observed.keys()|weights.keys()] or [0])
                mask_expected = {n:(1-t)*old_masks[a][n]+t*old_masks[b][n] for n in float_layers}
                mask_actual = {n:float(v[layer]) for n,layer in float_layers.items()}
                mask_error = max([abs(mask_actual[n]-value) for n,value in mask_expected.items()] or [0])
                uv_observations = []
                for loop in v.link_loops:
                    fid=loop.face[face_id]
                    assert fid in e["faces"] and a in old_uv[fid] and b in old_uv[fid]
                    for n,layer in uv_layers.items():
                        expected_uv=[(1-t)*old_uv[fid][a][n][k]+t*old_uv[fid][b][n][k] for k in range(2)]
                        actual=list(loop[layer].uv)
                        uv_observations.append({"originalFace":fid,"layer":n,"expected":expected_uv,"actual":actual,
                                                "maxError":max(abs(actual[k]-expected_uv[k]) for k in range(2))})
                uv_error=max([u["maxError"] for u in uv_observations] or [0])
                assert max(weight_error,mask_error,uv_error) <= record["attributeTolerance"], (weight_error,mask_error,uv_error)
                witnesses.append({"vertex":v.index,"edge":e["ids"],"edgeParameter":t,"expectedPosition":e["position"],
                    "actualPosition":list(v.co),"positionErrorMetres":distance,"expectedWeights":weights,"actualWeights":observed,
                    "weightError":weight_error,"expectedMasks":mask_expected,"actualMasks":mask_actual,"maskError":mask_error,
                    "cornerUVs":uv_observations,"uvError":uv_error})
            assert len(used)==len(crossings)
            bm.faces.layers.int.remove(face_id)
            bm.to_mesh(shell.data); shell.data.update()
            row = {"label":label,"effectivePlane":plane,"before":before,"verticesBefore":len(original_verts),
                "verticesAfter":len(bm.verts),"newVertices":len(new_verts),"cutVertices":len(cut_verts),
                "snapDisplacements":displacements,"witnesses":witnesses,"vertexGroups":snapshot["vertexGroups"]}
            record["splits"].append(archive(label+"-cut-receipts.json.gz",row))
            record["splits"][-1].update({"label":label,"newVertices":len(new_verts),
                "maxPositionErrorMetres":max(w["positionErrorMetres"] for w in witnesses),
                "maxWeightError":max(w["weightError"] for w in witnesses),
                "maxMaskError":max(w["maskError"] for w in witnesses),
                "maxUVError":max(w["uvError"] for w in witnesses)})
        finally: bm.free()
        archive(label+"-after-cut.json.gz",native_mesh(shell,rig))
        save()
    return split_weight_domain(shell, rig, effective)


try:
    save()
    assert report["buildHash"] == "d13f752e3b9c"
    assert digest(PARENT) == "28b28844d2e9391314650ad489e4c45c72cfd42542f088ebe931b6c9a8203261"
    parent = json.loads(PARENT.read_text())
    for filename, expected in parent["inputs"].items():
        assert digest(filename) == expected, filename
    report["validatedParentInputs"] = len(parent["inputs"])
    for p in sorted((ROOT / "tools/figure-pipeline").glob("*.py")): bind(p)
    for relative in ["tools/critic/foundation-domain-native.py", "tools/critic/foundation-native-band-inputs.mjs",
                     "docs/evidence/wardrobe-2026-09-30/foundation-native-band/PLAN.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-cut-band/PLAN.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-cut-band/SOURCE-REVIEW.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-cut-band/CONTROL-RECOVERY.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-domain-native/PLAN.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-domain-native/SOURCE-REVIEW.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-domain-native/EDITOR-STATE-RECOVERY.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-domain-native/GROUP-RECOVERY.md",
                     "tmp/foundation-domain-native-sep30/primitive_extract.py",
                     "tmp/foundation-domain-native-sep30/uvcalc_transform.py", "tmp/foundation-domain-native-sep30/exporter-source.json",
                     "tmp/foundation-band-sep30/input-receipt.json", "tmp/foundation-band-sep30/accepted-inputs.json.gz",
                     "tmp/foundation-domain-native-sep30/runtime-preflight.json", "tmp/foundation-domain-native-sep30/blender-mount.plist",
                     "captures/foundation-native-band-2026-09-30-v1/band-native.json.gz",
                     "tmp/wardrobe-sep30/blender-isolated.sh", "tools/figure-pipeline/.cache/mpfb-2.0.17.zip",
                     "captures/skeleton-native-pose-2026-09-30-v1/body-0.json.gz"]:
        bind(ROOT / relative)
    receipt = json.loads((ROOT / "tmp/foundation-band-sep30/input-receipt.json").read_text())
    encoded = Path(receipt["path"]).read_bytes()
    assert sha(encoded) == receipt["sha256"]
    decoded = gzip.decompress(encoded)
    assert sha(decoded) == receipt["decodedSHA256"]
    inputs = json.loads(decoded)
    for p, expected in inputs["pins"].items():
        assert digest(ROOT / p) == expected, p
        bind(ROOT / p)
    source = BUILDER.read_bytes()
    assert sha(source) == EXPECTED_BUILDER
    tree = ast.parse(source, filename=str(BUILDER))
    last = tree.body[-1]
    assert isinstance(last, ast.Expr) and isinstance(last.value, ast.Call)
    assert isinstance(last.value.func, ast.Name) and last.value.func.id == "main"
    assert not last.value.args and not last.value.keywords
    assert ast.get_source_segment(source.decode(), last) == "main()"
    tree.body.pop()
    builder = types.ModuleType("sugata_foundation_probe_builder")
    builder.__file__ = str(BUILDER)
    sys.modules[builder.__name__] = builder
    exec(compile(tree, str(BUILDER), "exec"), builder.__dict__)
    report["removedTerminalCall"] = {"line": last.lineno, "source": "main()", "builderSHA256": EXPECTED_BUILDER}
    original_function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "cut_conformal_shell")
    cloned_function = copy.deepcopy(original_function)
    cloned_function.name = "cut_conformal_shell_intersected"
    anchors = [i for i,n in enumerate(cloned_function.body) if isinstance(n,ast.Assign) and
               len(n.targets)==1 and isinstance(n.targets[0],ast.Name) and n.targets[0].id=="normals"]
    assert len(anchors)==1
    insertion = ast.parse("refined = cut_patch_at_planes(shell, rig, region_of, marks)").body[0]
    ast.copy_location(insertion,cloned_function.body[anchors[0]])
    cloned_function.body.insert(anchors[0],insertion)
    modified=ast.fix_missing_locations(ast.Module(body=[cloned_function],type_ignores=[]))
    builder.cut_patch_at_planes=cut_patch_at_planes
    exec(compile(modified,str(BUILDER),"exec"),builder.__dict__)
    (OUT/"inserted-function.py").write_text(ast.unparse(modified)+"\n")
    report["functionInsertion"]={"anchorLine":original_function.body[anchors[0]].lineno,
        "insertion":"refined = cut_patch_at_planes(shell, rig, region_of, marks)",
        "functionSHA256":digest(OUT/"inserted-function.py")}
    builder.clear_startup_scene()
    inventory = json.loads((ROOT / "docs/evidence/nonhair-2026-09-26/wardrobe-coupling/inventory-v1.json").read_text())
    recipe = inventory["sourceData"]["neutralRetainedRecipe"]
    body = builder.HumanService.create_human(macro_detail_dict=recipe["macro"])
    builder.HumanObjectProperties.set_value("gender", .5, entity_reference=body)
    builder.TargetService.reapply_macro_details(body)
    stack = builder.TargetService.calculate_target_stack_from_macro_info_dict(builder.TargetService.get_macro_info_dict_from_basemesh(body))
    assert [{"file": n, "weight": w} for n, w in stack] == recipe["mpfbStack"]
    assert len(body.data.vertices) == 19158
    a = body.data.attributes.new("probe_source_index", "FLOAT", "POINT")
    for i, row in enumerate(a.data): row.value = i
    rig = builder.HumanService.add_builtin_rig(body, "game_engine", import_weights=True)
    assert len(rig.data.bones) == 53
    builder.bake_for_export(body)
    builder.bake_macro_shape_keys(body)
    bpy.context.view_layer.update()
    assert len(body.data.vertices) == 13380
    old_bytes = (ROOT / "captures/skeleton-native-pose-2026-09-30-v1/body-0.json.gz").read_bytes()
    assert sha(old_bytes) == "ccff3c6427938371ce942e645e8571c0c707d2c580a17f00a0d459600bc97085"
    old = json.loads(gzip.decompress(old_bytes))
    report["rigAdmission"] = admit_rig(body, rig, set(old["restBones"]))
    for b in rig.data.bones:
        assert matrix(b.matrix_local) == old["restBones"][b.name]["matrixLocal"]
        assert list(b.head_local) == old["restBones"][b.name]["head"]
        assert list(b.tail_local) == old["restBones"][b.name]["tail"]
    mapping = [int(v.value) for v in body.data.attributes["probe_source_index"].data]
    assert len(set(mapping)) == 13380
    expected = {r["source"]: r for r in inputs["vertices"]}
    assert set(mapping) == set(expected)
    actual_weights = weight_rows(body, rig)
    assert all(sorted(actual_weights[i]) == sorted(old["fullWeights"][s]) for i, s in enumerate(mapping))
    residuals = []
    for i, source_id in enumerate(mapping):
        v = body.data.vertices[i].co
        actual = [v.x, v.z, -v.y]
        reference = expected[source_id]["values"]["position"]
        residuals.append(math.dist(actual, reference))
    report["bodyAdmission"] = {"vertices": len(mapping), "maxMetres": max(residuals),
                               "thresholdMetres": .000001, "worstSource": mapping[residuals.index(max(residuals))]}
    save()
    assert max(residuals) < .000001, report["bodyAdmission"]
    for name in inputs["maskNames"]:
        assert name not in body.data.attributes
        a = body.data.attributes.new(name, "FLOAT", "POINT")
        for i, source_id in enumerate(mapping): a.data[i].value = expected[source_id]["values"]["masks"][name]
        assert all(a.data[i].value == expected[s]["values"]["masks"][name] for i, s in enumerate(mapping))
    body.data.attributes.remove(body.data.attributes["probe_source_index"])
    report["body"] = archive("native-body.json.gz", {**native_mesh(body, rig), "sourceIndices": mapping, "residuals": residuals})
    marks = builder.measure_landmarks(body, rig)
    report["landmarks"] = serial(vars(marks))
    report["rig"] = archive("native-rig.json.gz", {"matrixWorld": matrix(rig.matrix_world),
        "bones": [{"name": b.name, "parent": b.parent.name if b.parent else None,
                   "matrixLocal": matrix(b.matrix_local), "head": list(b.head_local), "tail": list(b.tail_local),
                   "useDeform": b.use_deform} for b in rig.data.bones]})
    def band_only(point, dominant, m):
        return (dominant in builder.TORSO_BONES and
                m.bust_z - .50 * (m.bust_z - m.spine_03_z) <= point.z <=
                m.bust_z + .45 * (m.clavicle_z - m.bust_z))
    manifest = builder.read_wardrobe_manifest(str(ROOT / "assets/wardrobe/manifest.json"), ["foundation_bra"])
    args = types.SimpleNamespace(keep_morph_normals=False, rig="game_engine", hide_mask_attribute=True,
                                 foundation=["foundation_bra"])
    dominant = builder.dominant_bone_per_vertex(body, rig)
    shells = []
    for label, constructor in [("band-control", builder.cut_conformal_shell), ("band", builder.cut_conformal_shell_intersected)]:
        predicate=band_only
        region = {v.index for v in body.data.vertices if predicate(v.co, dominant[v.index], marks)}
        assert region
        shell, standoff = constructor(body, rig, "foundation_bra", region,
            predicate, marks, manifest["foundation_bra"], roll_hem=True)
        builder.force_alpha_mode(shell, manifest["foundation_bra"]["alphaMode"])
        assert all(not n.lower().startswith(("_hide_", "_decency_")) for n in shell.data.attributes.keys())
        assert "_NATIVE_VERTEX" not in shell.data.attributes
        a = shell.data.attributes.new("_NATIVE_VERTEX", "FLOAT", "POINT")
        for i, row in enumerate(a.data): row.value = i
        data = native_mesh(shell, rig)
        if label=="band-control":
            report["observedControl"] = archive("observed-control-native.json.gz",data)
            prior_bytes=(ROOT/"captures/foundation-native-band-2026-09-30-v1/band-native.json.gz").read_bytes()
            assert sha(prior_bytes)=="124370fda57558ba6a4b6efabe9b09355f275625bbd3b58446db9c4894532b35"
            prior=json.loads(gzip.decompress(prior_bytes))
            fields=["positions","normals","polygons","triangles","triangleLoops","loopVertexIndices","cornerNormals",
                    "uvLayers","activeUV","smoothPolygons","hasCustomNormals","sharpEdges","attributes","weights"]
            matches={f:data[f]==prior[f] for f in fields}
            def cycle_key(face):
                return min(tuple(face[i:]+face[:i]) for i in range(len(face)))
            def face_corners(mesh):
                rows={}; cursor=0
                for i,face in enumerate(mesh["polygons"]):
                    key=cycle_key(face); assert key not in rows
                    rows[key]={"smooth":mesh["smoothPolygons"][i],"corners":{v:{
                        "normal":mesh["cornerNormals"][(cursor+k)*3:(cursor+k+1)*3],
                        "uv":{n:arr[(cursor+k)*2:(cursor+k+1)*2] for n,arr in mesh["uvLayers"].items()}}
                        for k,v in enumerate(face)}}
                    cursor+=len(face)
                return rows
            before,after=face_corners(prior),face_corners(data)
            semantic={"orientedPolygons":sorted(before)==sorted(after),
                      "orientedTriangles":sorted(map(cycle_key,prior["triangles"]))==sorted(map(cycle_key,data["triangles"]))}
            assert all(semantic.values())
            semantic["smoothFaces"]=all(before[f]["smooth"]==after[f]["smooth"] for f in before)
            semantic["cornerUVs"]=all(before[f]["corners"][v]["uv"]==after[f]["corners"][v]["uv"] for f in before for v in before[f]["corners"])
            normal_residuals=[x-y for x,y in zip(data["normals"],prior["normals"])]
            corner_residuals=[{"face":list(f),"vertex":v,"before":before[f]["corners"][v]["normal"],
                "after":after[f]["corners"][v]["normal"]} for f in before for v in before[f]["corners"]]
            report["unchangedBandControl"]={"orderedFields":matches,"semantic":semantic,
                "exactNormalIdentity":matches["normals"] and all(r["before"]==r["after"] for r in corner_residuals),
                "normalComponentMax":max(map(abs,normal_residuals)),
                "cornerNormalComponentMax":max(abs(x-y) for r in corner_residuals for x,y in zip(r["before"],r["after"])),
                "normalResiduals":archive("control-normal-residuals.json.gz",{"vertexComponents":normal_residuals,"corners":corner_residuals}),
                "scope":"Exact geometric and mapped data control only; no exact normal/shading identity. Frozen parent GLB remains image baseline."}
            exact_fields=["positions","activeUV","hasCustomNormals","sharpEdges","attributes","weights"]
            assert all(matches[f] for f in exact_fields) and all(semantic.values()), report["unchangedBandControl"]
        shell_admission = admit_rig(shell, rig, set(old["restBones"]))
        assert all("_under_" + n[6:] in data["attributes"] for n in inputs["maskNames"] if n.startswith("_HIDE_"))
        item = {"label": label, "region": sorted(region), "standoff": serial(vars(standoff)),
                "rigAdmission": shell_admission,
                "vertices": len(shell.data.vertices), "fullInfluenceMax": max(map(len, data["weights"])),
                "native": archive(label + "-native.json.gz", data), "poses": []}
        file = OUT / (label + ".glb")
        builder.export_glb([rig, shell], str(file), args)
        item["export"] = {"file": file.name, "sha256": digest(file), "bytes": file.stat().st_size}
        report["cases"].append(item)
        shells.append((shell, item))
        save()
    for label, specification in POSES.items():
        pose_rig(rig, specification)
        bones = {b.name: {"matrix": matrix(b.matrix), "basis": matrix(b.matrix_basis)} for b in rig.pose.bones}
        for shell, item in shells:
            observation = {"pose": label, "bones": bones, "rigWorld": matrix(rig.matrix_world),
                           "shell": evaluated_mesh(shell), "body": evaluated_mesh(body)}
            item["poses"].append(archive(item["label"] + "-" + label + ".json.gz", observation))
        save()
    pose_rig(rig, {})
    blend = OUT / "construction.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    report["blend"] = {"file": blend.name, "sha256": digest(blend), "bytes": blend.stat().st_size}
    report["loadedMPFB"] = []
    for name, module in sorted(list(sys.modules.items())):
        file = getattr(module, "__file__", None)
        if file and ".mpfb" in name and Path(file).suffix == ".py":
            p = str(Path(file).resolve())
            assert p in parent["inputs"] and digest(p) == parent["inputs"][p], p
            report["loadedMPFB"].append({"module": name, "path": p, "sha256": digest(p)})
    for relative, expected_hash in report["sources"].items(): assert digest(ROOT / relative) == expected_hash
    report["status"] = "constructed-awaiting-export-coverage-and-visual-review"
except BaseException as error:
    report["status"] = "failed"
    report["errors"].append({"type": type(error).__name__, "message": str(error), "traceback": traceback.format_exc()})
    raise
finally:
    report["finished"] = now()
    save()
