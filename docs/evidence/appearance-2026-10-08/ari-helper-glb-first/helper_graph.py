"""JSON-only rest graph rewrite; preserve the unqualified carrier and every BIN byte."""
import copy
import hashlib
import json
import struct


def require(value, message):
    if not value:
        raise RuntimeError(message)


def helper_name(bone, role):
    return "SUGATA_REST_"+role+"__"+bone


def rewrite(carrier, native, factors, decoder):
    require(len(carrier.doc.get("scenes",[]))==1 and carrier.doc.get("scene",0)==0,"Fixed carrier requires exactly one active scene")
    nodes=carrier.doc["nodes"]
    names=[n.get("name") for n in nodes]
    expected=set(native["bones"])|set(native["meshes"])|{"Human.rig"}
    require(len(nodes)==60 and len(set(names))==60 and set(names)==expected,"Exact carrier60 owner/joint identities")
    require(not carrier.doc.get("animations"),"No carrier animations in neutral contract")
    index={name:i for i,name in enumerate(names)}
    require(len(factors)==53 and set(factors)==set(native["bones"]),"Fixed factor joint set")
    joint_ids={index[n] for n in native["bones"]}
    for name,b in native["bones"].items():
        require(carrier.parent.get(index[name])==index[b["parent"] or "Human.rig"],"Carrier named joint ancestry")
        require(not any(k in nodes[index[name]] for k in ("mesh","skin","camera")),"Carrier joint role")
    for skin in carrier.doc["skins"]:
        require(len(skin["joints"])==53 and set(skin["joints"])==joint_ids,"Carrier skin only original53 joints")
    doc=copy.deepcopy(carrier.doc)
    helper_ids={}
    for name in native["bones"]:
        helper_ids[index[name]]=(len(doc["nodes"]),len(doc["nodes"])+1)
        f=factors[name]
        for role,child in [("U",len(doc["nodes"])+1),("V",index[name])]:
            spec=f["H1" if role=="U" else "H2"]
            hname=helper_name(name,role)
            require(hname not in index,"Helper name collision")
            doc["nodes"].append({"name":hname,"translation":spec["translation"],
                "rotation":spec["rotation_xyzw"],"scale":spec["scale"],"children":[child],
                "extras":{"sugata_rest_factor_role":role,"sugata_native_joint":name,"sugata_static_helper":True}})
    for i,n in enumerate(doc["nodes"][:60]):
        if "children" in n:
            n["children"]=[helper_ids[c][0] if c in helper_ids else c for c in n["children"]]
        if i in joint_ids:
            for k in ("matrix","translation","rotation","scale"):
                n.pop(k,None)
    for scene in doc["scenes"]:
        scene["nodes"]=[helper_ids[c][0] if c in helper_ids else c for c in scene.get("nodes",[])]
    require(len(doc["nodes"])==166,"Final166 node count")
    # Whitelist delta: all top-level payloads other than nodes/scenes are identical.
    require({k:v for k,v in doc.items() if k not in ("nodes","scenes")}==
            {k:v for k,v in carrier.doc.items() if k not in ("nodes","scenes")},"Non-graph JSON delta")
    for i,old in enumerate(nodes):
        now=doc["nodes"][i]
        excluded={"children"}|({"matrix","translation","rotation","scale"} if i in joint_ids else set())
        require({k:v for k,v in old.items() if k not in excluded}=={k:v for k,v in now.items() if k not in excluded},"Original node non-transform delta")
    for before,after in zip(carrier.doc["scenes"],doc["scenes"]):
        require({k:v for k,v in before.items() if k!="nodes"}=={k:v for k,v in after.items() if k!="nodes"},"Scene non-root delta")
    payload=json.dumps(doc,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode("utf-8")
    payload+=b" "*(-len(payload)%4)
    # Retain exact original BIN chunk, including its padding.
    raw=carrier.original_bytes
    json_length=struct.unpack_from("<I",raw,12)[0]
    bin_chunk=raw[20+json_length:]
    require(struct.unpack_from("<I",bin_chunk,4)[0]==0x004e4942,"Original BIN chunk type")
    output=struct.pack("<4sII",b"glTF",2,12+8+len(payload)+len(bin_chunk))+struct.pack("<II",len(payload),0x4e4f534a)+payload+bin_chunk
    decoded=decoder.GLB(output,max_accessor_rows=carrier.max_accessor_rows,max_decoded_bytes=carrier.max_decoded_bytes)
    require(decoded.bin==carrier.bin,"Binary payload delta")
    return output,{"original_nodes":60,"final_nodes":166,"helpers":106,"joints":53,
        "non_graph_JSON_unchanged":True,"original_node_non_transform_payloads_unchanged":True,
        "BIN_chunk_sha256":hashlib.sha256(bin_chunk).hexdigest(),"BIN_payload_unchanged":True,
        "helper_indices":{names[j]:list(ids) for j,ids in helper_ids.items()}}
