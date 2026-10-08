"""Observe static RNA and the one exact already-loaded format callback; no addon import."""
import ast
import hashlib
from pathlib import Path
import sys


def require(value, message):
    if not value:
        raise RuntimeError(message)


def format_ids(bpy, source_pin, record):
    path=Path(source_pin["path"]).resolve()
    raw=path.read_bytes()
    require(len(raw)==source_pin["bytes"] and hashlib.sha256(raw).hexdigest()==source_pin["sha256"],"Callback source identity")
    mod=sys.modules.get("io_scene_gltf2")
    require(mod is not None,"Format addon not already loaded")
    record["module"]={"name":mod.__name__,"file":str(Path(mod.__file__).resolve()),"sha256":source_pin["sha256"]}
    require(mod.__name__=="io_scene_gltf2" and Path(mod.__file__).resolve()==path,"Loaded addon source path")
    tree=ast.parse(raw.decode("utf-8"),filename=str(path))
    bases=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=="ExportGLTF2_Base"]
    funcs=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="get_format_items"]
    require(len(bases)==len(funcs)==1,"Exact source class/function declarations")
    props=[n for n in bases[0].body if isinstance(n,ast.AnnAssign) and isinstance(n.target,ast.Name) and n.target.id=="export_format"]
    require(len(props)==1 and isinstance(props[0].annotation,ast.Call),"Exact source format property")
    declaration=props[0].annotation
    require(isinstance(declaration.func,ast.Name) and declaration.func.id=="EnumProperty","Source format enum constructor")
    items=[k.value for k in declaration.keywords if k.arg=="items"]
    require(len(items)==1 and isinstance(items[0],ast.Name) and items[0].id=="get_format_items","Source callback binding")
    fn=getattr(mod,"get_format_items",None)
    require(callable(fn) and getattr(fn,"__module__",None)==mod.__name__ and hasattr(fn,"__code__"),"Loaded callback function")
    require(Path(fn.__code__.co_filename).resolve()==path and fn.__code__.co_firstlineno==funcs[0].lineno,
            "Loaded callback source location")
    require(fn.__globals__.get("bpy") is bpy,"Callback bpy context identity")
    cls=getattr(mod,"ExportGLTF2",None)
    base=getattr(mod,"ExportGLTF2_Base",None)
    require(cls is not None and base is not None and base in cls.__mro__ and cls.bl_idname=="export_scene.gltf",
            "Loaded operator/base identity")
    registered=bpy.ops.export_scene.gltf.get_rna_type().identifier
    require(cls.bl_rna.identifier==registered,"Actual registered operator identity")
    require(bpy.types.Operator.bl_rna_get_subclass_py(registered) is cls,"Registered Python class object identity")
    annotation=base.__annotations__.get("export_format")
    keywords=getattr(annotation,"keywords",None)
    require(isinstance(keywords,dict) and keywords.get("items") is fn,"Loaded annotation callback object identity")
    # The pinned function's scene/context parameters are unused; it reads its global bpy.context.
    require(not any(isinstance(n,ast.Name) and isinstance(n.ctx,ast.Load) and n.id in ("scene","context")
                    for n in ast.walk(funcs[0])),"Unsupported callback parameter use")
    addons=bpy.context.preferences.addons
    require("io_scene_gltf2" in addons,"Required preference context absent")
    prefs=addons["io_scene_gltf2"].preferences
    before=bool(prefs.allow_embedded_format)
    record["callback"]={"name":fn.__name__,"defined_line":fn.__code__.co_firstlineno,
                        "registered_operator":registered,"registered_class_object_matches":True,"annotation_object_matches":True,
                        "context":"actual bpy.context; no import/enable/preference mutation",
                        "allow_embedded_format_before":before,"explicit_observer_calls":1}
    values=fn(None,bpy.context)
    after=bool(prefs.allow_embedded_format)
    record["callback"]["allow_embedded_format_after"]=after
    require(before==after,"Callback preference changed")
    require(isinstance(values,(list,tuple)) and len(values)>0,"Callback items collection")
    require(all(isinstance(v,(tuple,list)) and len(v)>=3 and all(isinstance(x,str) for x in v[:3]) for v in values),
            "Callback item structure")
    ids=[v[0] for v in values]
    record["callback"]["returned_ids"]=ids
    require(len(ids)==len(set(ids)) and all(ids),"Callback duplicate/empty identifiers")
    return ids


def validate(bpy, options, records, source_pin):
    props=bpy.ops.export_scene.gltf.get_rna_type().properties
    for name,value in options.items():
        record={"name":name,"value":value,"present":name in props}
        records.append(record)
        require(name in props,"Missing RNA option: "+name)
        p=props[name]
        record.update(type=p.type,readonly=bool(p.is_readonly))
        require(not p.is_readonly,"Read-only RNA option: "+name)
        if type(value) is bool:
            require(p.type=="BOOLEAN","RNA boolean type: "+name)
        elif type(value) is str:
            require(p.type=="ENUM","RNA enum type: "+name)
            static=list(p.enum_items.keys())
            record["observed_RNA_ids"]=static
            ids=format_ids(bpy,source_pin,record) if name=="export_format" else static
            require(value in ids,"RNA enum value: "+name)
        else:
            raise RuntimeError("Unexpected planned option type")
        record["accepted"]=True
    require("filepath" in props and props["filepath"].type=="STRING","Filepath RNA")
