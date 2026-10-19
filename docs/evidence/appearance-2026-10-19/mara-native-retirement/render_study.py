"""One isolated fixed neutral diffuse comparison. Inert until root admission."""
import sys
sys.dont_write_bytecode = True
import copy
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
CONTRACT = json.loads((HERE / "CONTRACT.json").read_bytes())

def pin(path):
    data = path.read_bytes()
    return {"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

def write(name, data):
    with (HERE / name).open("x") as stream:
        json.dump(data, stream, indent=2)
        stream.write("\n")

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def orient(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()

def run():
    require(bpy.app.background and not bpy.app.online_access, "offline background required")
    require(bpy.app.version[:3] == (5, 2, 2), "fixed API version")
    source = Path(CONTRACT["source"])
    require(Path(bpy.data.filepath).resolve() == source, "exact source required")
    cold = json.loads(Path(CONTRACT["cold"]).read_bytes())["scene"]
    helper = Path(CONTRACT["helper"])
    spec = importlib.util.spec_from_file_location("sugata_diffuse_scene_receipt", helper)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    before = module.capture_scene()
    require(before == cold, "exact cold owner signature")
    owner_names = {obj["name"] for obj in before["objects"]}
    body = bpy.data.objects["Human"]
    require(body.type == "MESH" and body.get("sugata_source_role") == "body_with_helpers", "body owner")
    require(len(body.material_slots) == 1 and body.material_slots[0].material.name == "Human.body", "body material")
    require(len(body.data.uv_layers) == 1 and body.data.uv_layers[0].name == "UVMap", "one original UV")
    require(body.data.uv_layers.active == body.data.uv_layers[0] and body.data.uv_layers[0].active_render, "active render UV")
    material = body.material_slots[0].material
    node = material.node_tree.nodes["DiffuseTexture"]
    alpha_node = material.node_tree.nodes["AlphaMapTexture"]
    original_image = node.image
    require(node.type == "TEX_IMAGE" and original_image.name == "young_lightskinned_female_diffuse.png", "original image node")
    require(original_image.colorspace_settings.name == "sRGB" and alpha_node.image == original_image, "original colour/alpha binding")
    require(not node.inputs["Vector"].is_linked, "preserve original vector input")
    require(len(node.outputs["Color"].links) == 1, "one colour consumer")
    link = node.outputs["Color"].links[0]
    require(link.to_node.name == "Principled BSDF" and link.to_socket.identifier == "Base Color", "direct base colour")
    require(len(bpy.data.scenes) == 1, "one recorded source scene")
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.cycles.seed = 0
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 8
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.render.use_file_extension = True
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    world = bpy.data.worlds.new("MaraDiffuseStudyWorld")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.2, .2, .2, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .4
    scene.world = world
    rig = next(o for o in bpy.data.objects if o.get("sugata_source_role") == "game_engine_rig")
    require(len(rig.data.bones) == 53, "complete recorded rig")
    head = rig.data.bones["head"]
    target = rig.matrix_world @ ((head.head_local + head.tail_local) * .5) + Vector((0, 0, -.04))
    lights = []
    for name, position, energy, size in CONTRACT["lights"]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.size, data.shape = energy, size, "DISK"
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = Vector(position)
        orient(obj, target)
        lights.append(obj)
    camera_data = bpy.data.cameras.new("MaraDiffuseStudyCamera")
    camera_data.type = "ORTHO"
    camera_data.sensor_fit = "VERTICAL"
    camera_data.ortho_scale = .34
    camera_data.clip_start, camera_data.clip_end = .01, 100
    camera = bpy.data.objects.new("MaraDiffuseStudyCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    def owners():
        receipt = module.capture_scene()
        receipt["objects"] = [o for o in receipt["objects"] if o["name"] in owner_names]
        return receipt

    def stage():
        return {"engine": scene.render.engine, "device": scene.cycles.device,
                "samples": scene.cycles.samples, "denoise": scene.cycles.use_denoising,
                "seed": scene.cycles.seed, "threads": scene.render.threads,
                "resolution": [scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage],
                "output": [scene.render.image_settings.file_format, scene.render.image_settings.color_mode,
                           scene.render.image_settings.color_depth, scene.render.film_transparent],
                "composite_sequencer": [scene.render.use_compositing, scene.render.use_sequencer],
                "view": [scene.view_settings.view_transform, scene.view_settings.look, scene.view_settings.exposure, scene.view_settings.gamma],
                "world": [list(world.node_tree.nodes["Background"].inputs["Color"].default_value), world.node_tree.nodes["Background"].inputs["Strength"].default_value],
                "lights": [{"name": o.name, "matrix": [list(r) for r in o.matrix_world], "energy": o.data.energy,
                            "size": o.data.size, "shape": o.data.shape, "color": list(o.data.color)} for o in lights],
                "camera": {"matrix": [list(r) for r in camera.matrix_world], "type": camera_data.type,
                           "sensor_fit": camera_data.sensor_fit, "scale": camera_data.ortho_scale,
                           "clips": [camera_data.clip_start, camera_data.clip_end]},
                "frame": scene.frame_current}

    require(owners() == before, "staging changed recorded owners")
    write("BEFORE.json", before)
    outputs, matched = [], {}
    replacement = None
    for variant in ["control", "candidate"]:
        if variant == "candidate":
            replacement_path = Path(CONTRACT["diffuse"])
            replacement = bpy.data.images.load(str(replacement_path), check_existing=False)
            require(list(replacement.size) == [2048, 2048], "literal diffuse size")
            require(replacement.colorspace_settings.name == "sRGB", "literal diffuse sRGB; no colour conversion")
            replacement.pack(data=replacement_path.read_bytes(), data_len=replacement_path.stat().st_size)
            require(hashlib.sha256(replacement.packed_file.data).hexdigest() == CONTRACT["diffuse_sha256"], "packed exact diffuse")
            node.image = replacement
            require(alpha_node.image == original_image, "alpha binding unchanged")
        for view, direction in CONTRACT["views"]:
            path = HERE / (variant + "-" + view + ".png")
            require(not path.exists(), "no first-image replacement")
            camera.location = target + Vector(direction).normalized() * 5
            orient(camera, target)
            bpy.context.view_layer.update()
            settings = stage()
            if variant == "control":
                matched[view] = settings
            else:
                require(settings == matched[view], "unmatched render settings")
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            outputs.append({**pin(path), "variant": variant, "view": view, "stage": settings})
        current = owners()
        expected = copy.deepcopy(before)
        if variant == "candidate":
            expected["materials"] = copy.deepcopy(before["materials"])
            body_mat = next(m for m in expected["materials"] if m["name"] == "Human.body")
            next(n for n in body_mat["nodes"] if n["name"] == "DiffuseTexture")["image"] = replacement.name
            expected["images"] = sorted(before["images"] + [{"name": replacement.name, "filepath": replacement.filepath,
                "size": list(replacement.size), "colorspace": replacement.colorspace_settings.name,
                "packed_files": len(replacement.packed_files), "packed_sha256": CONTRACT["diffuse_sha256"]}], key=lambda i: i["name"])
        require(current == expected, "only diffuse-image association may change")
    # Save the isolated diagnostic with front camera selected; no seventh image.
    camera.location = target + Vector((0, -1, 0)) * 5
    orient(camera, target)
    bpy.context.view_layer.update()
    after = owners()
    require(after == current, "owner change before save")
    write("AFTER.json", after)
    save_path = HERE / "candidate.blend"
    require(not save_path.exists(), "candidate must be absent")
    bpy.ops.wm.save_as_mainfile(filepath=str(save_path), check_existing=False, relative_remap=False)
    require(owners() == after, "recorded owner change on save")
    require(pin(source)["sha256"] == CONTRACT["source_sha256"], "physical original changed")
    result = {"finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "outputs": outputs,
              "candidate": pin(save_path), "before": pin(HERE / "BEFORE.json"), "after": pin(HERE / "AFTER.json"),
              "recorded_owner_diff": "only Human.body.DiffuseTexture.image and added exact packed image",
              "active_uv": {"name": body.data.uv_layers.active.name, "active_render": body.data.uv_layers[0].active_render},
              "limit": "First fixed diffuse mapping images; no Mara form/palette/age/identity/expression/AAA acceptance. Saved source not cold-persistence-qualified."}
    write("RESULT.json", result)
    print("SUGATA_DIFFUSE " + json.dumps(result))

try:
    run()
except BaseException as error:
    if not (HERE / "FAILURE.json").exists():
        write("FAILURE.json", {"utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "type": type(error).__name__, "error": str(error)})
    raise
