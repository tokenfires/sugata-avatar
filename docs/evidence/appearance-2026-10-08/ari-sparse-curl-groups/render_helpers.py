"""Inherited mesh observer/settings; explicitly extended to every CURVE point."""
def render_domain():
    saved = []
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for m in o.modifiers:
                saved.append((m, m.show_viewport, getattr(m, 'levels', None)))
                m.show_viewport = m.show_render
                if m.type == 'SUBSURF':
                    m.levels = m.render_levels
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    body = []
    head = []
    counts = {}
    for o in bpy.data.objects:
        if o.type not in {'MESH','CURVE'} or o.hide_render:
            continue
        ev = o.evaluated_get(dg)
        mesh = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
        groups = {g.index: g.name for g in o.vertex_groups}
        headids = {i for i, n in groups.items() if n in {'head', 'neck_01'}}
        if o.name == 'Human':
            require({'head', 'neck_01'}.issubset(set(groups.values())), 'Actual head/neck_01 groups exist')
        local = []
        nh = 0
        for v in mesh.vertices:
            p = ev.matrix_world @ v.co
            require(all((math.isfinite(x) for x in p)), 'Finite render-domain point')
            body.append(tuple(p))
            local.append(tuple(p))
            if o.name != 'Human' or any((g.group in headids and g.weight > 0 for g in v.groups)):
                head.append(tuple(p))
                nh += 1
        counts[o.name] = {'render_vertices': len(mesh.vertices), 'head_domain_vertices': nh, 'head_group_ids_names': {str(i): groups[i] for i in sorted(headids)}}
        ev.to_mesh_clear()
    require(head and counts['Human']['head_domain_vertices'] > 0, 'Full body head attachment domain retained')
    return (body, head, counts, saved)

def restore(saved):
    for m, visible, level in saved:
        m.show_viewport = visible
        if level is not None:
            m.levels = level
    bpy.context.view_layer.update()

def bbox(points):
    a = np.asarray(points)
    lo = a.min(axis=0)
    hi = a.max(axis=0)
    return (lo, hi)

def orient(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()

def settings(scene, center):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.seed = 0
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    if hasattr(scene.cycles, 'denoising_use_gpu'):
        scene.cycles.denoising_use_gpu = False
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 16
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = 1
    scene.render.pixel_aspect_y = 1
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    world = bpy.data.worlds.new('SugataSharedWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.2, 0.2, 0.2, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.4
    scene.world = world
    names = []
    for name, pos, energy, size in [('Key', (-3, -4, 4), 700, 4), ('Fill', (3, -2, 3), 450, 4), ('Rear', (0, 4, 4), 600, 4)]:
        d = bpy.data.lights.new('Sugata' + name, 'AREA')
        d.energy = energy
        d.shape = 'DISK'
        d.size = size
        o = bpy.data.objects.new('Sugata' + name, d)
        scene.collection.objects.link(o)
        o.location = Vector(pos)
        orient(o, center)
        names.append(o.name)
    d = bpy.data.cameras.new('SugataSharedCamera')
    d.type = 'ORTHO'
    d.sensor_fit = 'VERTICAL'
    d.clip_start = 0.01
    d.clip_end = 100
    c = bpy.data.objects.new('SugataSharedCamera', d)
    scene.collection.objects.link(c)
    scene.camera = c
    names.append(c.name)
    look = {'view_transform': scene.view_settings.view_transform, 'look': scene.view_settings.look, 'display': scene.display_settings.display_device, 'exposure': scene.view_settings.exposure, 'gamma': scene.view_settings.gamma, 'curve_mapping': scene.view_settings.use_curve_mapping, 'compositing': scene.render.use_compositing, 'sequencer': scene.render.use_sequencer, 'pixel_aspect': [scene.render.pixel_aspect_x, scene.render.pixel_aspect_y]}
    require(not look['curve_mapping'], 'No unowned tone curve')
    if 'shared_look' in REPORT:
        require(look == REPORT['shared_look'], 'Identical inherited display/look controls')
    else:
        REPORT['shared_look'] = look
    return (c, names, world)
