"""Render six fixed first views of the exact neutral source; never resave it."""
import sys
sys.dont_write_bytecode = True
import datetime
import hashlib
import importlib.util
import json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent
plan = json.loads((HERE / "PLAN.json").read_text())
source = Path(plan["source"]["path"])
if not bpy.app.background or bpy.app.online_access or Path(bpy.data.filepath).resolve() != source:
    raise RuntimeError("Require exact offline background source")
if source.stat().st_size != plan["source"]["bytes"] or hashlib.sha256(source.read_bytes()).hexdigest() != plan["source"]["sha256"]:
    raise RuntimeError("Source identity changed")
warm = json.loads(Path(plan["warm_receipt"]["path"]).read_text())
receipt = source.parent.parent / "scene_receipt.py"
spec = importlib.util.spec_from_file_location("sugata_render_receipt", receipt)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
before = module.capture_scene()
if before != warm["scene"]:
    raise RuntimeError("Loaded source owner signature mismatch")
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
if hasattr(scene.cycles, "denoising_use_gpu"):
    scene.cycles.denoising_use_gpu = False
denoising_settings = {"backend": scene.cycles.denoiser,
                      "use_gpu": getattr(scene.cycles, "denoising_use_gpu", None)}
scene.cycles.seed = 0
scene.render.threads_mode = "FIXED"
scene.render.threads = 16
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
world = bpy.data.worlds.new("SugataReviewWorld")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (.2, .2, .2, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = .4
scene.world = world
depsgraph = bpy.context.evaluated_depsgraph_get()
corners = []
for obj in bpy.data.objects:
    if obj.type == "MESH":
        evaluated = obj.evaluated_get(depsgraph)
        corners.extend(evaluated.matrix_world @ Vector(c) for c in evaluated.bound_box)
minimum = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
maximum = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
center = (minimum + maximum) * .5
extent = maximum - minimum
ortho = max(extent.z, max(extent.x, extent.y) / (768 / 1024)) * 1.10
rig = next(o for o in bpy.data.objects if o.get("sugata_source_role") == "game_engine_rig")
head = rig.data.bones["head"]
head_center = rig.matrix_world @ ((head.head_local + head.tail_local) * .5)

def orient(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()

for name, position, energy, size in [
    ("Key", (-3, -4, 4), 700, 4), ("Fill", (3, -2, 3), 450, 4),
    ("Rear", (0, 4, 4), 600, 4),
]:
    data = bpy.data.lights.new("Sugata" + name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new("Sugata" + name, data)
    scene.collection.objects.link(obj)
    obj.location = Vector(position)
    orient(obj, center)
camera_data = bpy.data.cameras.new("SugataReviewCamera")
camera_data.type = "ORTHO"
camera_data.sensor_fit = "VERTICAL"
camera_data.clip_start = .01
camera_data.clip_end = 100
camera = bpy.data.objects.new("SugataReviewCamera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
outputs = []
for framing, target, scale, resolution in [
    ("body", center, ortho, (768, 1024)), ("head", head_center, .50, (768, 768)),
]:
    for view, direction in [("front", (0, -1, 0)), ("profile", (1, 0, 0)), ("rear", (0, 1, 0))]:
        path = HERE / (framing + "-" + view + ".png")
        if path.exists():
            raise RuntimeError("Refusing first-image replacement")
        camera.location = target + Vector(direction) * 5
        orient(camera, target)
        camera_data.ortho_scale = scale
        scene.render.resolution_x, scene.render.resolution_y = resolution
        bpy.context.view_layer.update()
        projected = [world_to_camera_view(scene, camera, point) for point in corners]
        framing_bounds = {"min_x": min(v.x for v in projected), "max_x": max(v.x for v in projected),
                          "min_y": min(v.y for v in projected), "max_y": max(v.y for v in projected)}
        if framing == "body" and not all(.04 <= v.x <= .96 and .04 <= v.y <= .96 and v.z > 0 for v in projected):
            raise RuntimeError("Complete body framing failed before first output")
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        outputs.append({"path": str(path), "view": view, "framing": framing,
                        "resolution": list(resolution), "target": list(target), "camera": list(camera.location),
                        "ortho_scale": scale, "body_projected_bounds": framing_bounds,
                        "bytes": path.stat().st_size,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
after = module.capture_scene()
owned_after = {**after, "objects": [o for o in after["objects"] if o["source_role"]]}
if owned_after != before:
    raise RuntimeError("Source owner state changed during rendering")
report = {"finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "source_sha256": plan["source"]["sha256"], "outputs": outputs, "source_owner_signature_unchanged": True,
          "denoising": denoising_settings,
          "bounds": {"minimum": list(minimum), "maximum": list(maximum)},
          "limit": "Actual neutral source renders only, no Ari10targets/export/rig-motion/appearance approval before image review."}
with (HERE / "RENDER-RESULT.json").open("x") as out:
    json.dump(report, out, indent=2)
    out.write("\n")
print("SUGATA_RENDER " + json.dumps(report))
