def attach_face_parts(basemesh, arguments):
    """Adds eyes, teeth, tongue, brows and lashes from the makehuman_system_assets pack.

    Returns a list of (part object, mhclo path, alpha mode) for the steps that follow, because
    both remaining jobs — binding each part to the rig and giving it the right alpha mode — need
    to know which asset a given Blender object came from.
    """
    if arguments.no_face_parts:
        print("Skipping face parts (--no-face-parts).")
        return []

    attached = []
    for asset_subdir, mhclo_filename, asset_type, alpha_mode in FACE_PART_ASSETS:
        if asset_type == "Eyes":
            mhclo_filename = arguments.eye_proxy
        asset_path = AssetService.find_asset_absolute_path(mhclo_filename, asset_subdir=asset_subdir)
        if asset_path is None:
            print(f"  MISSING {asset_type}: {mhclo_filename} "
                  "(install the makehuman_system_assets pack)")
            continue
        part_object = HumanService.add_mhclo_asset(asset_path, basemesh,
                                                   asset_type=asset_type,
                                                   material_type="GAMEENGINE")
        attached.append((part_object, asset_path, alpha_mode))
        print(f"  added {asset_type}: {mhclo_filename}")

    return attached
