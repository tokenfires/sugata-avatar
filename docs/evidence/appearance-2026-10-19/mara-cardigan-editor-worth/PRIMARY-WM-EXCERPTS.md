bpy.ops.wm.obj\_import( _\*_, _filepath=''_, _directory=''_, _files=None_, _check\_existing=False_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _global\_scale=1.0_, _clamp\_size=0.0_, _forward\_axis='NEGATIVE\_Z'_, _up\_axis='Y'_, _use\_split\_objects=True_, _use\_split\_groups=False_, _import\_vertex\_groups=False_, _validate\_meshes=True_, _close\_spline\_loops=True_, _collection\_separator=''_, _mtl\_name\_collision\_mode='MAKE\_UNIQUE'_, _filter\_glob='\*.obj;\*.mtl'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.obj_import "Link to this definition")

Load a Wavefront OBJ scene

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **directory** ( _str_) – Directory, Directory of the file (optional, never None)

- **files** (`bpy_prop_collection`\[`OperatorFileListElement`\] \| None) – Files, (optional)

- **check\_existing** ( _bool_) – Check Existing, Check and warn on overwriting existing files (optional)

- **filter\_blender** ( _bool_) – Filter .blend files, (optional)

- **filter\_backup** ( _bool_) – Filter backup .blend files, (optional)

- **filter\_image** ( _bool_) – Filter image files, (optional)

- **filter\_movie** ( _bool_) – Filter movie files, (optional)

- **filter\_python** ( _bool_) – Filter Python files, (optional)

- **filter\_font** ( _bool_) – Filter font files, (optional)

- **filter\_sound** ( _bool_) – Filter sound files, (optional)

- **filter\_text** ( _bool_) – Filter text files, (optional)

- **filter\_archive** ( _bool_) – Filter archive files, (optional)

- **filter\_btx** ( _bool_) – Filter btx files, (optional)

- **filter\_alembic** ( _bool_) – Filter Alembic files, (optional)

- **filter\_usd** ( _bool_) – Filter USD files, (optional)

- **filter\_obj** ( _bool_) – Filter OBJ files, (optional)

- **filter\_volume** ( _bool_) – Filter OpenVDB volume files, (optional)

- **filter\_folder** ( _bool_) – Filter folders, (optional)

- **filter\_blenlib** ( _bool_) – Filter Blender IDs, (optional)

- **filemode** ( _int_) – File Browser Mode, The setting for the file browser mode to load a .blend file, a library or a special file (in \[1, 9\], optional)

- **display\_type** ( _Literal_ _\[_ _'DEFAULT'_ _,_ _'LIST\_VERTICAL'_ _,_ _'LIST\_HORIZONTAL'_ _,_ _'THUMBNAIL'_ _\]_) –

Display Type, (optional)


  - `DEFAULT`
    Default – Automatically determine display type for files.

  - `LIST_VERTICAL`
    Short List – Display files as short list.

  - `LIST_HORIZONTAL`
    Long List – Display files as a detailed list.

  - `THUMBNAIL`
    Thumbnails – Display files as thumbnails.


- **sort\_method** ( _str_) – File sorting mode, (optional)

- **global\_scale** ( _float_) – Scale, Value by which to enlarge or shrink the objects with respect to the world’s origin (in \[0.0001, 10000\], optional)

- **clamp\_size** ( _float_) – Clamp Bounding Box, Resize the objects to keep bounding box under this value. Value 0 disables clamping (in \[0, 1000\], optional)

- **forward\_axis** ( _Literal_ _\[_ _'X'_ _,_ _'Y'_ _,_ _'Z'_ _,_ _'NEGATIVE\_X'_ _,_ _'NEGATIVE\_Y'_ _,_ _'NEGATIVE\_Z'_ _\]_) –

Forward Axis, (optional)


  - `X`
    X – Positive X axis.

  - `Y`
    Y – Positive Y axis.

  - `Z`
    Z – Positive Z axis.

  - `NEGATIVE_X`
    -X – Negative X axis.

  - `NEGATIVE_Y`
    -Y – Negative Y axis.

  - `NEGATIVE_Z`
    -Z – Negative Z axis.


- **up\_axis** ( _Literal_ _\[_ _'X'_ _,_ _'Y'_ _,_ _'Z'_ _,_ _'NEGATIVE\_X'_ _,_ _'NEGATIVE\_Y'_ _,_ _'NEGATIVE\_Z'_ _\]_) –

Up Axis, (optional)


  - `X`
    X – Positive X axis.

  - `Y`
    Y – Positive Y axis.

  - `Z`
    Z – Positive Z axis.

  - `NEGATIVE_X`
    -X – Negative X axis.

  - `NEGATIVE_Y`
    -Y – Negative Y axis.

  - `NEGATIVE_Z`
    -Z – Negative Z axis.


- **use\_split\_objects** ( _bool_) – Split By Object, Import each OBJ ‘o’ as a separate object (optional)

- **use\_split\_groups** ( _bool_) – Split By Group, Import each OBJ ‘g’ as a separate object (optional)

- **import\_vertex\_groups** ( _bool_) – Vertex Groups, Import OBJ groups as vertex groups (optional)

- **validate\_meshes** ( _bool_) – Validate Meshes, Ensure the data is valid (when disabled, data may be imported which causes crashes displaying or editing) (optional)

- **close\_spline\_loops** ( _bool_) – Detect Cyclic Curves, Join curve endpoints if overlapping control points are detected (if disabled, no curves will be cyclic) (optional)

- **collection\_separator** ( _str_) – Path Separator, Character used to separate objects name into hierarchical structure (optional, never None)

- **mtl\_name\_collision\_mode** ( _Literal_ _\[_ _'MAKE\_UNIQUE'_ _,_ _'REFERENCE\_EXISTING'_ _\]_) –

Material Name Collision, How to handle naming collisions when importing materials (optional)


  - `MAKE_UNIQUE`
    Make Unique – Create new materials with unique names for each OBJ file.

  - `REFERENCE_EXISTING`
    Reference Existing – Use existing materials with same name instead of creating new ones.


- **filter\_glob** ( _str_) – Extension Filter, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]


bpy.ops.wm.open\_mainfile( _\*_, _filepath=''_, _hide\_props\_region=True_, _check\_existing=False_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _load\_ui=True_, _use\_scripts=False_, _display\_file\_selector=True_, _state=0_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.open_mainfile "Link to this definition")

Open a Blender file

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **hide\_props\_region** ( _bool_) – Hide Operator Properties, Collapse the region displaying the operator settings (optional)

- **check\_existing** ( _bool_) – Check Existing, Check and warn on overwriting existing files (optional)

- **filter\_blender** ( _bool_) – Filter .blend files, (optional)

- **filter\_backup** ( _bool_) – Filter backup .blend files, (optional)

- **filter\_image** ( _bool_) – Filter image files, (optional)

- **filter\_movie** ( _bool_) – Filter movie files, (optional)

- **filter\_python** ( _bool_) – Filter Python files, (optional)

- **filter\_font** ( _bool_) – Filter font files, (optional)

- **filter\_sound** ( _bool_) – Filter sound files, (optional)

- **filter\_text** ( _bool_) – Filter text files, (optional)

- **filter\_archive** ( _bool_) – Filter archive files, (optional)

- **filter\_btx** ( _bool_) – Filter btx files, (optional)

- **filter\_alembic** ( _bool_) – Filter Alembic files, (optional)

- **filter\_usd** ( _bool_) – Filter USD files, (optional)

- **filter\_obj** ( _bool_) – Filter OBJ files, (optional)

- **filter\_volume** ( _bool_) – Filter OpenVDB volume files, (optional)

- **filter\_folder** ( _bool_) – Filter folders, (optional)

- **filter\_blenlib** ( _bool_) – Filter Blender IDs, (optional)

- **filemode** ( _int_) – File Browser Mode, The setting for the file browser mode to load a .blend file, a library or a special file (in \[1, 9\], optional)

- **display\_type** ( _Literal_ _\[_ _'DEFAULT'_ _,_ _'LIST\_VERTICAL'_ _,_ _'LIST\_HORIZONTAL'_ _,_ _'THUMBNAIL'_ _\]_) –

Display Type, (optional)


  - `DEFAULT`
    Default – Automatically determine display type for files.

  - `LIST_VERTICAL`
    Short List – Display files as short list.

  - `LIST_HORIZONTAL`
    Long List – Display files as a detailed list.

  - `THUMBNAIL`
    Thumbnails – Display files as thumbnails.


- **sort\_method** ( _str_) – File sorting mode, (optional)

- **load\_ui** ( _bool_) – Load UI, Load user interface setup in the .blend file (optional)

- **use\_scripts** ( _bool_) – Trusted Source, Allow .blend file to execute scripts automatically, default available from system preferences (optional)

- **display\_file\_selector** ( _bool_) – Display File Selector, (optional)

- **state** ( _int_) – State, (in \[-inf, inf\], optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]


bpy.ops.wm.save\_as\_mainfile( _\*_, _filepath=''_, _hide\_props\_region=True_, _check\_existing=True_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _compress=False_, _relative\_remap=True_, _copy=False_, _show\_save\_modified\_images\_dialog=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.save_as_mainfile "Link to this definition")

Save the current file in the desired location

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **hide\_props\_region** ( _bool_) – Hide Operator Properties, Collapse the region displaying the operator settings (optional)

- **check\_existing** ( _bool_) – Check Existing, Check and warn on overwriting existing files (optional)

- **filter\_blender** ( _bool_) – Filter .blend files, (optional)

- **filter\_backup** ( _bool_) – Filter backup .blend files, (optional)

- **filter\_image** ( _bool_) – Filter image files, (optional)

- **filter\_movie** ( _bool_) – Filter movie files, (optional)

- **filter\_python** ( _bool_) – Filter Python files, (optional)

- **filter\_font** ( _bool_) – Filter font files, (optional)

- **filter\_sound** ( _bool_) – Filter sound files, (optional)

- **filter\_text** ( _bool_) – Filter text files, (optional)

- **filter\_archive** ( _bool_) – Filter archive files, (optional)

- **filter\_btx** ( _bool_) – Filter btx files, (optional)

- **filter\_alembic** ( _bool_) – Filter Alembic files, (optional)

- **filter\_usd** ( _bool_) – Filter USD files, (optional)

- **filter\_obj** ( _bool_) – Filter OBJ files, (optional)

- **filter\_volume** ( _bool_) – Filter OpenVDB volume files, (optional)

- **filter\_folder** ( _bool_) – Filter folders, (optional)

- **filter\_blenlib** ( _bool_) – Filter Blender IDs, (optional)

- **filemode** ( _int_) – File Browser Mode, The setting for the file browser mode to load a .blend file, a library or a special file (in \[1, 9\], optional)

- **display\_type** ( _Literal_ _\[_ _'DEFAULT'_ _,_ _'LIST\_VERTICAL'_ _,_ _'LIST\_HORIZONTAL'_ _,_ _'THUMBNAIL'_ _\]_) –

Display Type, (optional)


  - `DEFAULT`
    Default – Automatically determine display type for files.

  - `LIST_VERTICAL`
    Short List – Display files as short list.

  - `LIST_HORIZONTAL`
    Long List – Display files as a detailed list.

  - `THUMBNAIL`
    Thumbnails – Display files as thumbnails.


- **sort\_method** ( _str_) – File sorting mode, (optional)

- **compress** ( _bool_) – Compress, Write compressed .blend file (optional)

- **relative\_remap** ( _bool_) – Remap Relative, Remap relative paths when saving to a different directory (optional)

- **copy** ( _bool_) – Save Copy, Save a copy of the actual working state but does not make saved file active (optional)

- **show\_save\_modified\_images\_dialog** ( _bool_) – Show Save Modified Images Dialog, Show a popup dialog to save modified images before saving the blend file (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]
