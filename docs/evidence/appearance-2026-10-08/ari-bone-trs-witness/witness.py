"""Exact mathutils round-trip witnesses from frozen JSON; never load an avatar."""
import sys
sys.dont_write_bytecode=True
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import traceback
import bpy
import mathutils
from mathutils import Matrix

HERE=Path(__file__).resolve().parent
PLAN=json.loads((HERE/"RUN-PLAN.json").read_text())
REPORT={"started_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"pid":os.getpid(),
        "records":[],"complete":False,"scope":"Saved53 native matrices; no candidate load/construction/export"}


def require(value,message):
    if not value:
        raise RuntimeError(message)


def identity(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1048576),b""):
            h.update(block)
    return {"path":str(path),"bytes":path.stat().st_size,"sha256":h.hexdigest()}


def rows(m):
    values=[list(row) for row in m]
    require(len(values)==4 and all(len(row)==4 for row in values),"Matrix arity")
    require(all(math.isfinite(x) for row in values for x in row),"Nonfinite matrix")
    return values


def factory_state():
    return {"filepath":bpy.data.filepath,"scenes":sorted(s.name for s in bpy.data.scenes),
            "frame":bpy.context.scene.frame_current,
            "objects":[{"name":o.name,"type":o.type,"world":rows(o.matrix_world),
                        "parent":o.parent.name if o.parent else None,"data":o.data.name if o.data else None,
                        "vertices":len(o.data.vertices) if o.type=="MESH" else None}
                       for o in sorted(bpy.data.objects,key=lambda o:o.name)]}


def run():
    require(bpy.app.background and not bpy.app.online_access and bpy.data.filepath=="","Exact scratch offline/no file")
    require(tuple(bpy.app.version)==tuple(PLAN["expected_version"])
            and bpy.app.build_hash.decode()==PLAN["expected_build_hash"],"Same Blender/mathutils build")
    require(Path(bpy.app.binary_path).resolve()==Path(PLAN["binary"]["path"]),"Scratch binary path")
    require(identity(Path(PLAN["binary"]["path"]))==PLAN["binary"],"Binary identity")
    require(all(identity(Path(p["path"]))==p for p in PLAN["pins"]),"Input/script/source pin")
    require(not (HERE/"RESULT.json").exists(),"First witness output collision")
    before=factory_state()
    require(not any(o["type"]=="ARMATURE" for o in before["objects"]),"Unexpected factory rig")
    REPORT["build"]={"version":list(bpy.app.version),"hash":bpy.app.build_hash.decode(),
                     "binary":PLAN["binary"],"mathutils_module":mathutils.__name__,
                     "mathutils_file":getattr(mathutils,"__file__",None),"Matrix_module":Matrix.__module__}
    cold=json.loads(Path(PLAN["input"]["path"]).read_text())
    require(cold["passed"] and len(cold["checks"])==3 and all(c["pass"] for c in cold["checks"]),"Qualified cold input")
    rig=next(o for o in cold["scene"]["objects"] if o["name"]=="Human.rig")
    bones=rig["rig"]["bones"]
    byname={b["name"]:b for b in bones}
    require(len(bones)==len(byname)==53,"Exact53 unique input bones")
    rw=Matrix(rig["matrix_world"])
    C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
    REPORT["input"]={"identity":PLAN["input"],"rig_world":rows(rw),"C":rows(C),
                     "bone_order":[b["name"] for b in bones],"bound":1e-6}
    for b in bones:
        rec={"bone":b["name"],"parent":b["parent"],"input_rest":b["matrix_local"],"rig_world":rows(rw)}
        REPORT["records"].append(rec)
        rest=Matrix(b["matrix_local"])
        require(b["parent"] is None or b["parent"] in byname,"Missing parent")
        parent=Matrix(byname[b["parent"]]["matrix_local"]) if b["parent"] else None
        rec["input_parent_rest"]=rows(parent) if parent else None
        w=rw@rest@C
        pw=rw@parent@C if parent else rw
        local=pw.inverted()@w
        rec.update(world=rows(w),parent_world=rows(pw),local=rows(local))
        t,q,s=local.decompose()
        require(all(math.isfinite(x) for x in [*t,*q,*s]),"Nonfinite decomposition")
        rec.update(translation=list(t),quaternion_wxyz=list(q),scale=list(s))
        reconstructed=Matrix.LocRotScale(t,q,s)
        rec["reconstructed"]=rows(reconstructed)
        residual=[[float(reconstructed[i][j])-float(local[i][j]) for j in range(4)] for i in range(4)]
        require(all(math.isfinite(x) for row in residual for x in row),"Nonfinite residual")
        i,j=max(((i,j) for i in range(4) for j in range(4)),key=lambda ij:abs(residual[ij[0]][ij[1]]))
        maximum=abs(residual[i][j])
        rec.update(residual=residual,max_abs_residual=maximum,worst_element=[i,j],
                   local_at_worst=float(local[i][j]),reconstructed_at_worst=float(reconstructed[i][j]),
                   roundtrip_pass=maximum<=1e-6)
    failures=[r for r in REPORT["records"] if not r["roundtrip_pass"]]
    worst=max(REPORT["records"],key=lambda r:r["max_abs_residual"])
    after=factory_state()
    require(before==after,"Factory scene changed")
    require(all(identity(Path(p["path"]))==p for p in PLAN["physical_native_guards"]),"Native files changed")
    REPORT.update(factory_before=before,factory_after=after,native_files_unchanged=True,
                  first_failed_bone=failures[0]["bone"] if failures else None,
                  failed_bones=[r["bone"] for r in failures],max_bone=worst["bone"],max_abs_residual=worst["max_abs_residual"],
                  all_roundtrips_pass=not failures,complete=True)


try:
    run()
except Exception as error:
    REPORT.update(exception=repr(error),traceback=traceback.format_exc())
finally:
    REPORT["finished_utc"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (HERE/"RESULT.json").open("x") as f:
        json.dump(REPORT,f,indent=2,allow_nan=False);f.write("\n")
    print("SUGATA_WITNESS "+json.dumps({k:REPORT.get(k) for k in
          ["complete","first_failed_bone","failed_bones","max_bone","max_abs_residual","exception"]}),flush=True)
if not REPORT["complete"]:
    raise RuntimeError("Scratch witness incomplete; retain first report without retry")
