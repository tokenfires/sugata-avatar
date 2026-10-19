[Join the **official Blender Survey 2026**! 🧡](https://www.blender.org/news/blender-survey-2026/)

ContentsMenuExpandLight modeDark modeAuto light/dark, in light modeAuto light/dark, in dark mode[Skip to content](https://docs.blender.org/api/5.2/bpy.ops.wm.html#furo-main-content)

[Back to top](https://docs.blender.org/api/5.2/bpy.ops.wm.html#)

# Wm Operators [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html\#module-bpy.ops.wm "Link to this heading")

bpy.ops.wm.alembic\_export( _\*_, _filepath=''_, _check\_existing=True_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=True_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _filter\_glob='\*.abc'_, _start=-2147483648_, _end=-2147483648_, _xsamples=1_, _gsamples=1_, _sh\_open=0.0_, _sh\_close=1.0_, _selected=False_, _flatten=False_, _collection=''_, _uvs=True_, _packuv=True_, _normals=True_, _vcolors=False_, _orcos=True_, _face\_sets=False_, _subdiv\_schema=False_, _apply\_subdiv=False_, _curves\_as\_mesh=False_, _use\_instancing=True_, _global\_scale=1.0_, _triangulate=False_, _quad\_method='SHORTEST\_DIAGONAL'_, _ngon\_method='BEAUTY'_, _export\_hair=True_, _export\_particles=True_, _export\_custom\_properties=True_, _as\_background\_job=False_, _evaluation\_mode='RENDER'_, _init\_scene\_frame\_range=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.alembic_export "Link to this definition")

Export current scene in an Alembic archive

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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

- **filter\_glob** ( _str_) – (optional, never None)

- **start** ( _int_) – Start Frame, Start frame of the export, use the default value to take the start frame of the current scene (in \[-inf, inf\], optional)

- **end** ( _int_) – End Frame, End frame of the export, use the default value to take the end frame of the current scene (in \[-inf, inf\], optional)

- **xsamples** ( _int_) – Transform Samples, Number of times per frame transformations are sampled (in \[1, 128\], optional)

- **gsamples** ( _int_) – Geometry Samples, Number of times per frame object data are sampled (in \[1, 128\], optional)

- **sh\_open** ( _float_) – Shutter Open, Time at which the shutter is open (in \[-1, 1\], optional)

- **sh\_close** ( _float_) – Shutter Close, Time at which the shutter is closed (in \[-1, 1\], optional)

- **selected** ( _bool_) – Selected Objects Only, Export only selected objects (optional)

- **flatten** ( _bool_) – Flatten Hierarchy, Do not preserve objects’ parent/children relationship (optional)

- **collection** ( _str_) – Collection, (optional, never None)

- **uvs** ( _bool_) – UV Coordinates, Export UV coordinates (optional)

- **packuv** ( _bool_) – Merge UVs, (optional)

- **normals** ( _bool_) – Normals, Export normals (optional)

- **vcolors** ( _bool_) – Color Attributes, Export color attributes (optional)

- **orcos** ( _bool_) – Generated Coordinates, Export undeformed mesh vertex coordinates (optional)

- **face\_sets** ( _bool_) – Face Sets, Export per face shading group assignments (optional)

- **subdiv\_schema** ( _bool_) – Use Subdivision Schema, Export meshes using Alembic’s subdivision schema (optional)

- **apply\_subdiv** ( _bool_) – Apply Subdivision Surface, Export subdivision surfaces as meshes (optional)

- **curves\_as\_mesh** ( _bool_) – Curves as Mesh, Export curves and NURBS surfaces as meshes (optional)

- **use\_instancing** ( _bool_) – Use Instancing, Export data of duplicated objects as Alembic instances; speeds up the export and can be disabled for compatibility with other software (optional)

- **global\_scale** ( _float_) – Scale, Value by which to enlarge or shrink the objects with respect to the world’s origin (in \[0.0001, 1000\], optional)

- **triangulate** ( _bool_) – Triangulate, Export polygons (quads and n-gons) as triangles (optional)

- **quad\_method** (Literal\[ [Modifier Triangulate Quad Method Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/modifier_triangulate_quad_method_items.html#rna-enum-modifier-triangulate-quad-method-items)\]) – Quad Method, Method for splitting the quads into triangles (optional)

- **ngon\_method** (Literal\[ [Modifier Triangulate Ngon Method Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/modifier_triangulate_ngon_method_items.html#rna-enum-modifier-triangulate-ngon-method-items)\]) – N-gon Method, Method for splitting the n-gons into triangles (optional)

- **export\_hair** ( _bool_) – Export Hair, Exports hair particle systems as animated curves (optional)

- **export\_particles** ( _bool_) – Export Particles, Exports non-hair particle systems (optional)

- **export\_custom\_properties** ( _bool_) – Export Custom Properties, Export custom properties to Alembic .userProperties (optional)

- **as\_background\_job** ( _bool_) – Run as Background Job, Enable this to run the import in the background, disable to block Blender while importing. This option is deprecated; EXECUTE this operator to run in the foreground, and INVOKE it to run as a background job (optional)

- **evaluation\_mode** ( _Literal_ _\[_ _'RENDER'_ _,_ _'VIEWPORT'_ _\]_) –

Settings, Determines visibility of objects, modifier settings, and other areas where there are different settings for viewport and rendering (optional)


  - `RENDER`
    Render – Use Render settings for object visibility, modifier settings, etc.

  - `VIEWPORT`
    Viewport – Use Viewport settings for object visibility, modifier settings, etc.


- **init\_scene\_frame\_range** ( _bool_) – (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.alembic\_import( _\*_, _filepath=''_, _directory=''_, _files=None_, _check\_existing=False_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=True_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _relative\_path=True_, _display\_type='DEFAULT'_, _sort\_method=''_, _filter\_glob='\*.abc'_, _scale=1.0_, _set\_frame\_range=True_, _validate\_meshes=False_, _always\_add\_cache\_reader=False_, _is\_sequence=False_, _as\_background\_job=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.alembic_import "Link to this definition")

Load an Alembic archive

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

- **relative\_path** ( _bool_) – Relative Path, Select the file relative to the blend file (optional)

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

- **filter\_glob** ( _str_) – (optional, never None)

- **scale** ( _float_) – Scale, Value by which to enlarge or shrink the objects with respect to the world’s origin (in \[0.0001, 1000\], optional)

- **set\_frame\_range** ( _bool_) – Set Frame Range, If checked, update scene’s start and end frame to match those of the Alembic archive (optional)

- **validate\_meshes** ( _bool_) – Validate Meshes, Ensure the data is valid (when disabled, data may be imported which causes crashes displaying or editing) (optional)

- **always\_add\_cache\_reader** ( _bool_) – Always Add Cache Reader, Add cache modifiers and constraints to imported objects even if they are not animated so that they can be updated when reloading the Alembic archive (optional)

- **is\_sequence** ( _bool_) – Is Sequence, Set to true if the cache is split into separate files (optional)

- **as\_background\_job** ( _bool_) – Run as Background Job, Enable this to run the export in the background, disable to block Blender while exporting. This option is deprecated; EXECUTE this operator to run in the foreground, and INVOKE it to run as a background job (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.append( _\*_, _filepath=''_, _directory=''_, _filename=''_, _files=None_, _check\_existing=False_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=True_, _filemode=1_, _display\_type='DEFAULT'_, _sort\_method=''_, _link=False_, _do\_reuse\_local\_id=False_, _clear\_asset\_data=False_, _autoselect=True_, _active\_collection=True_, _instance\_collections=False_, _instance\_object\_data=True_, _set\_fake=False_, _use\_recursive=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.append "Link to this definition")

Append from a Library .blend file

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **directory** ( _str_) – Directory, Directory of the file (optional, never None)

- **filename** ( _str_) – File Name, Name of the file (optional, never None)

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

- **link** ( _bool_) – Link, Link the objects or data-blocks rather than appending (optional)

- **do\_reuse\_local\_id** ( _bool_) – Re-Use Local Data, Try to re-use previously matching appended data-blocks instead of appending a new copy (optional)

- **clear\_asset\_data** ( _bool_) – Clear Asset Data, Don’t add asset meta-data or tags from the original data-block (optional)

- **autoselect** ( _bool_) – Select, Select new objects (optional)

- **active\_collection** ( _bool_) – Active Collection, Put new objects on the active collection (optional)

- **instance\_collections** ( _bool_) – Instance Collections, Create instances for collections, rather than adding them directly to the scene (optional)

- **instance\_object\_data** ( _bool_) – Instance Object Data, Create instances for object data which are not referenced by any objects (optional)

- **set\_fake** ( _bool_) – Fake User, Set “Fake User” for appended items (except objects and collections) (optional)

- **use\_recursive** ( _bool_) – Localize All, Localize all appended data, including those indirectly linked from other libraries (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.batch\_rename( _\*_, _data\_type='OBJECT'_, _data\_source='SELECT'_, _actions=None_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.batch_rename "Link to this definition")

Rename multiple items at once

Parameters:

- **data\_type** ( _Literal_ _\[_ _'OBJECT'_ _,_ _'COLLECTION'_ _,_ _'MATERIAL'_ _,_ _'MESH'_ _,_ _'CURVE'_ _,_ _'META'_ _,_ _'VOLUME'_ _,_ _'GREASEPENCIL'_ _,_ _'ARMATURE'_ _,_ _'LATTICE'_ _,_ _'LIGHT'_ _,_ _'LIGHT\_PROBE'_ _,_ _'CAMERA'_ _,_ _'SPEAKER'_ _,_ _'BONE'_ _,_ _'NODE'_ _,_ _'SEQUENCE\_STRIP'_ _,_ _'ACTION\_CLIP'_ _,_ _'SCENE'_ _,_ _'BRUSH'_ _\]_) – Type, Type of data to rename (optional)

- **data\_source** ( _Literal_ _\[_ _'SELECT'_ _,_ _'ALL'_ _\]_) – Source, (optional)

- **actions** (`bpy_prop_collection`\[`BatchRenameAction`\] \| None) – actions, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:3315](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L3315)

bpy.ops.wm.blend\_strings\_utf8\_validate() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.blend_strings_utf8_validate "Link to this definition")

Check and fix all strings in current .blend file to be valid UTF-8 Unicode (needed for some old, 2.4x area files)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/file.py:289](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/file.py#L289)

bpy.ops.wm.call\_asset\_shelf\_popover( _\*_, _name=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.call_asset_shelf_popover "Link to this definition")

Open a predefined asset shelf in a popup

Parameters:

**name** ( _str_) – Asset Shelf Name, Identifier of the asset shelf to display (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.call\_menu( _\*_, _name=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.call_menu "Link to this definition")

Open a predefined menu

Parameters:

**name** ( _str_) – Name, Name of the menu (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.call\_menu\_pie( _\*_, _name=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.call_menu_pie "Link to this definition")

Open a predefined pie menu

Parameters:

**name** ( _str_) – Name, Name of the pie menu (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.call\_panel( _\*_, _name=''_, _keep\_open=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.call_panel "Link to this definition")

Open a predefined panel

Parameters:

- **name** ( _str_) – Name, Name of the menu (optional, never None)

- **keep\_open** ( _bool_) – Keep Open, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.clear\_recent\_files( _\*_, _remove='ALL'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.clear_recent_files "Link to this definition")

Clear the recent files list

Parameters:

**remove** ( _Literal_ _\[_ _'ALL'_ _,_ _'MISSING'_ _\]_) – Remove, (optional)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.collection\_export\_all() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.collection_export_all "Link to this definition")

Invoke all configured exporters for all collections

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.context\_collection\_boolean\_set( _\*_, _data\_path\_iter=''_, _data\_path\_item=''_, _type='TOGGLE'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_collection_boolean_set "Link to this definition")

Set boolean values for a collection of items

Parameters:

- **data\_path\_iter** ( _str_) – data\_path\_iter, The data path relative to the context, must point to an iterable (optional, never None)

- **data\_path\_item** ( _str_) – data\_path\_item, The data path from each iterable to the value (int or float) (optional, never None)

- **type** ( _Literal_ _\[_ _'TOGGLE'_ _,_ _'ENABLE'_ _,_ _'DISABLE'_ _\]_) – Type, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:875](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L875)

bpy.ops.wm.context\_cycle\_array( _\*_, _data\_path=''_, _reverse=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_cycle_array "Link to this definition")

Set a context array value (useful for cycling the active mesh edit mode)

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **reverse** ( _bool_) – Reverse, Cycle backwards (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:673](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L673)

bpy.ops.wm.context\_cycle\_enum( _\*_, _data\_path=''_, _reverse=False_, _wrap=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_cycle_enum "Link to this definition")

Toggle a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **reverse** ( _bool_) – Reverse, Cycle backwards (optional)

- **wrap** ( _bool_) – Wrap, Wrap back to the first/last values (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:624](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L624)

bpy.ops.wm.context\_cycle\_int( _\*_, _data\_path=''_, _reverse=False_, _wrap=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_cycle_int "Link to this definition")

Set a context value (useful for cycling active material, shape keys, groups, etc.)

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **reverse** ( _bool_) – Reverse, Cycle backwards (optional)

- **wrap** ( _bool_) – Wrap, Wrap back to the first/last values (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:584](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L584)

bpy.ops.wm.context\_menu\_enum( _\*_, _data\_path=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_menu_enum "Link to this definition")

Undocumented, consider [contributing](https://developer.blender.org/).

Parameters:

**data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:703](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L703)

bpy.ops.wm.context\_modal\_mouse( _\*_, _data\_path\_iter=''_, _data\_path\_item=''_, _header\_text=''_, _input\_scale=0.01_, _invert=False_, _initial\_x=0_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_modal_mouse "Link to this definition")

Adjust arbitrary values with mouse input

Parameters:

- **data\_path\_iter** ( _str_) – data\_path\_iter, The data path relative to the context, must point to an iterable (optional, never None)

- **data\_path\_item** ( _str_) – data\_path\_item, The data path from each iterable to the value (int or float) (optional, never None)

- **header\_text** ( _str_) – Header Text, Text to display in header during scale (optional, never None)

- **input\_scale** ( _float_) – input\_scale, Scale the mouse movement by this value before applying the delta (in \[-inf, inf\], optional)

- **invert** ( _bool_) – invert, Invert the mouse input (optional)

- **initial\_x** ( _int_) – initial\_x, (in \[-inf, inf\], optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:1023](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L1023)

bpy.ops.wm.context\_pie\_enum( _\*_, _data\_path=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_pie_enum "Link to this definition")

Undocumented, consider [contributing](https://developer.blender.org/).

Parameters:

**data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:735](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L735)

bpy.ops.wm.context\_scale\_float( _\*_, _data\_path=''_, _value=1.0_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_scale_float "Link to this definition")

Scale a float context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _float_) – Value, Assign value (in \[-inf, inf\], optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:338](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L338)

bpy.ops.wm.context\_scale\_int( _\*_, _data\_path=''_, _value=1.0_, _always\_step=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_scale_int "Link to this definition")

Scale an int context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _float_) – Value, Assign value (in \[-inf, inf\], optional)

- **always\_step** ( _bool_) – Always Step, Always adjust the value by a minimum of 1 when ‘value’ is not 1.0 (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:376](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L376)

bpy.ops.wm.context\_set\_boolean( _\*_, _data\_path=''_, _value=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_set_boolean "Link to this definition")

Set a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _bool_) – Value, Assignment value (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:267](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L267)

bpy.ops.wm.context\_set\_enum( _\*_, _data\_path=''_, _value=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_set_enum "Link to this definition")

Set a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _str_) – Value, Assignment value (as a string) (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:267](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L267)

bpy.ops.wm.context\_set\_float( _\*_, _data\_path=''_, _value=0.0_, _relative=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_set_float "Link to this definition")

Set a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _float_) – Value, Assignment value (in \[-inf, inf\], optional)

- **relative** ( _bool_) – Relative, Apply relative to the current value (delta) (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:267](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L267)

bpy.ops.wm.context\_set\_id( _\*_, _data\_path=''_, _value=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_set_id "Link to this definition")

Set a context value to an ID data-block

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _str_) – Value, Assign value (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:817](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L817)

bpy.ops.wm.context\_set\_int( _\*_, _data\_path=''_, _value=0_, _relative=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_set_int "Link to this definition")

Set a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _int_) – Value, Assign value (in \[-inf, inf\], optional)

- **relative** ( _bool_) – Relative, Apply relative to the current value (delta) (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:267](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L267)

bpy.ops.wm.context\_set\_string( _\*_, _data\_path=''_, _value=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_set_string "Link to this definition")

Set a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _str_) – Value, Assign value (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:267](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L267)

bpy.ops.wm.context\_set\_value( _\*_, _data\_path=''_, _value=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_set_value "Link to this definition")

Set a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value** ( _str_) – Value, Assignment value (as a string) (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:480](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L480)

bpy.ops.wm.context\_toggle( _\*_, _data\_path=''_, _module=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_toggle "Link to this definition")

Toggle a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **module** ( _str_) – Module, Optionally override the context with a module (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:504](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L504)

bpy.ops.wm.context\_toggle\_enum( _\*_, _data\_path=''_, _value\_1=''_, _value\_2=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.context_toggle_enum "Link to this definition")

Toggle a context value

Parameters:

- **data\_path** ( _str_) – Context Attributes, Context data-path (expanded using visible windows in the current .blend file) (optional, never None)

- **value\_1** ( _str_) – Value, Toggle enum (optional, never None)

- **value\_2** ( _str_) – Value, Toggle enum (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:545](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L545)

bpy.ops.wm.debug\_menu( _\*_, _debug\_value=0_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.debug_menu "Link to this definition")

Open a popup to set the debug level

Parameters:

**debug\_value** ( _int_) – Debug Value, (in \[-32768, 32767\], optional)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.doc\_view( _\*_, _doc\_id=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.doc_view "Link to this definition")

Open online reference docs in a web browser

Parameters:

**doc\_id** ( _str_) – Doc ID, (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:1379](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L1379)

bpy.ops.wm.doc\_view\_manual( _\*_, _doc\_id=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.doc_view_manual "Link to this definition")

Load online manual

Parameters:

**doc\_id** ( _str_) – Doc ID, (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:1352](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L1352)

bpy.ops.wm.doc\_view\_manual\_ui\_context() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.doc_view_manual_ui_context "Link to this definition")

View a context based online manual in a web browser

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.drop\_blend\_file( _\*_, _filepath=''_, _use\_scripts=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.drop_blend_file "Link to this definition")

Undocumented, consider [contributing](https://developer.blender.org/).

Parameters:

- **filepath** ( _str_) – filepath, (optional, never None)

- **use\_scripts** ( _bool_) – Trusted Source, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:3736](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L3736)

bpy.ops.wm.drop\_import\_file( _\*_, _directory=''_, _files=None_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.drop_import_file "Link to this definition")

Operator that allows file handlers to receive file drops

Parameters:

- **directory** ( _str_) – Directory, Directory of the file (optional, never None)

- **files** (`bpy_prop_collection`\[`OperatorFileListElement`\] \| None) – Files, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.fbx\_import( _\*_, _filepath=''_, _directory=''_, _files=None_, _check\_existing=False_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _global\_scale=1.0_, _mtl\_name\_collision\_mode='MAKE\_UNIQUE'_, _import\_colors='SRGB'_, _use\_custom\_normals=True_, _use\_custom\_props=True_, _use\_custom\_props\_enum\_as\_string=True_, _import\_subdivision=False_, _ignore\_leaf\_bones=False_, _validate\_meshes=True_, _use\_anim=True_, _anim\_offset=1.0_, _filter\_glob='\*.fbx'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.fbx_import "Link to this definition")

Import FBX file into current scene

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

- **global\_scale** ( _float_) – Scale, (in \[1e-06, 1e+06\], optional)

- **mtl\_name\_collision\_mode** ( _Literal_ _\[_ _'MAKE\_UNIQUE'_ _,_ _'REFERENCE\_EXISTING'_ _\]_) –

Material Name Collision, Behavior when the name of an imported material conflicts with an existing material (optional)


  - `MAKE_UNIQUE`
    Make Unique – Import each FBX material as a unique Blender material.

  - `REFERENCE_EXISTING`
    Reference Existing – If a material with the same name already exists, reference that instead of importing.


- **import\_colors** ( _Literal_ _\[_ _'NONE'_ _,_ _'SRGB'_ _,_ _'LINEAR'_ _\]_) –

Vertex Colors, Import vertex color attributes (optional)


  - `NONE`
    None – Do not import color attributes.

  - `SRGB`
    sRGB – Vertex colors in the file are in sRGB color space.

  - `LINEAR`
    Linear – Vertex colors in the file are in linear color space.


- **use\_custom\_normals** ( _bool_) – Custom Normals, Import custom normals, if available (otherwise Blender will compute them) (optional)

- **use\_custom\_props** ( _bool_) – Custom Properties, Import user properties as custom properties (optional)

- **use\_custom\_props\_enum\_as\_string** ( _bool_) – Enums As Strings, Store custom property enumeration values as strings (optional)

- **import\_subdivision** ( _bool_) – Subdivision Data, Import FBX subdivision information as subdivision surface modifiers (optional)

- **ignore\_leaf\_bones** ( _bool_) – Ignore Leaf Bones, Ignore the last bone at the end of each chain (used to mark the length of the previous bone) (optional)

- **validate\_meshes** ( _bool_) – Validate Meshes, Ensure the data is valid (when disabled, data may be imported which causes crashes displaying or editing) (optional)

- **use\_anim** ( _bool_) – Import Animation, Import FBX animation (optional)

- **anim\_offset** ( _float_) – Offset, Offset to apply to animation timestamps, in frames (in \[-1e+06, 1e+06\], optional)

- **filter\_glob** ( _str_) – Extension Filter, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.grease\_pencil\_export\_pdf( _\*_, _filepath=''_, _check\_existing=True_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=True_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _use\_fill=True_, _selected\_object\_type='ACTIVE'_, _frame\_mode='ACTIVE'_, _stroke\_sample=0.0_, _use\_uniform\_width=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.grease_pencil_export_pdf "Link to this definition")

Export Grease Pencil to PDF

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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

- **use\_fill** ( _bool_) – Fill, Export strokes with fill enabled (optional)

- **selected\_object\_type** ( _Literal_ _\[_ _'ACTIVE'_ _,_ _'SELECTED'_ _,_ _'VISIBLE'_ _\]_) –

Object, Which objects to include in the export (optional)


  - `ACTIVE`
    Active – Include only the active object.

  - `SELECTED`
    Selected – Include selected objects.

  - `VISIBLE`
    Visible – Include all visible objects.


- **frame\_mode** ( _Literal_ _\[_ _'ACTIVE'_ _,_ _'SELECTED'_ _,_ _'SCENE'_ _\]_) –

Frames, Which frames to include in the export (optional)


  - `ACTIVE`
    Active – Include only active frame.

  - `SELECTED`
    Selected – Include selected frames.

  - `SCENE`
    Scene – Include all scene frames.


- **stroke\_sample** ( _float_) – Sampling, Precision of stroke sampling. Low values mean a more precise result, and zero disables sampling (in \[0, 100\], optional)

- **use\_uniform\_width** ( _bool_) – Uniform Width, Export strokes with uniform width (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.grease\_pencil\_export\_svg( _\*_, _filepath=''_, _check\_existing=True_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=True_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _use\_fill=True_, _selected\_object\_type='ACTIVE'_, _frame\_mode='ACTIVE'_, _stroke\_sample=0.0_, _use\_uniform\_width=False_, _use\_clip\_camera=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.grease_pencil_export_svg "Link to this definition")

Export Grease Pencil to SVG

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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

- **use\_fill** ( _bool_) – Fill, Export strokes with fill enabled (optional)

- **selected\_object\_type** ( _Literal_ _\[_ _'ACTIVE'_ _,_ _'SELECTED'_ _,_ _'VISIBLE'_ _\]_) –

Object, Which objects to include in the export (optional)


  - `ACTIVE`
    Active – Include only the active object.

  - `SELECTED`
    Selected – Include selected objects.

  - `VISIBLE`
    Visible – Include all visible objects.


- **frame\_mode** ( _Literal_ _\[_ _'ACTIVE'_ _,_ _'SELECTED'_ _,_ _'SCENE'_ _\]_) –

Frames, Which frames to include in the export (optional)


  - `ACTIVE`
    Active – Include only active frame.

  - `SELECTED`
    Selected – Include selected frames.

  - `SCENE`
    Scene – Include all scene frames.


- **stroke\_sample** ( _float_) – Sampling, Precision of stroke sampling. Low values mean a more precise result, and zero disables sampling (in \[0, 100\], optional)

- **use\_uniform\_width** ( _bool_) – Uniform Width, Export strokes with uniform width (optional)

- **use\_clip\_camera** ( _bool_) – Clip Camera, Clip drawings to camera size when exporting in camera view (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.grease\_pencil\_import\_svg( _\*_, _filepath=''_, _directory=''_, _files=None_, _check\_existing=False_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=True_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _relative\_path=True_, _display\_type='DEFAULT'_, _sort\_method=''_, _resolution=10_, _scale=10.0_, _use\_scene\_unit=False_, _recenter\_bounds=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.grease_pencil_import_svg "Link to this definition")

Import SVG into Grease Pencil

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

- **relative\_path** ( _bool_) – Relative Path, Select the file relative to the blend file (optional)

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

- **resolution** ( _int_) – Resolution, Resolution of the generated strokes (in \[1, 100000\], optional)

- **scale** ( _float_) – Scale, Scale of the final strokes (in \[1e-06, 1e+06\], optional)

- **use\_scene\_unit** ( _bool_) – Scene Unit, Apply current scene’s unit (as defined by unit scale) to imported data (optional)

- **recenter\_bounds** ( _bool_) – Center on Bounds, Center the imported SVG on its bounding box (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.id\_linked\_relocate( _\*_, _id\_session\_uid=0_, _filepath=''_, _directory=''_, _filename=''_, _check\_existing=False_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=True_, _filemode=1_, _relative\_path=True_, _display\_type='DEFAULT'_, _sort\_method=''_, _link=True_, _do\_reuse\_local\_id=False_, _clear\_asset\_data=False_, _autoselect=True_, _active\_collection=False_, _instance\_collections=False_, _instance\_object\_data=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.id_linked_relocate "Link to this definition")

Relocate a linked ID, i.e. select another ID to link, and remap its local usages to that newly linked data-block). Currently only designed as an internal operator, not directly exposed to the user

Parameters:

- **id\_session\_uid** ( _int_) – Linked ID Session UID, Unique runtime identifier for the linked ID to relocate (in \[0, inf\], optional)

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **directory** ( _str_) – Directory, Directory of the file (optional, never None)

- **filename** ( _str_) – File Name, Name of the file (optional, never None)

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

- **relative\_path** ( _bool_) – Relative Path, Select the file relative to the blend file (optional)

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

- **link** ( _bool_) – Link, Link the objects or data-blocks rather than appending (optional)

- **do\_reuse\_local\_id** ( _bool_) – Re-Use Local Data, Try to re-use previously matching appended data-blocks instead of appending a new copy (optional)

- **clear\_asset\_data** ( _bool_) – Clear Asset Data, Don’t add asset meta-data or tags from the original data-block (optional)

- **autoselect** ( _bool_) – Select, Select new objects (optional)

- **active\_collection** ( _bool_) – Active Collection, Put new objects on the active collection (optional)

- **instance\_collections** ( _bool_) – Instance Collections, Create instances for collections, rather than adding them directly to the scene (optional)

- **instance\_object\_data** ( _bool_) – Instance Object Data, Create instances for object data which are not referenced by any objects (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.interface\_theme\_preset\_add( _\*_, _name=''_, _remove\_name=False_, _remove\_active=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.interface_theme_preset_add "Link to this definition")

Add a custom theme to the preset list

Parameters:

- **name** ( _str_) – Name, Name of the preset, used to make the path name (optional, never None)

- **remove\_name** ( _bool_) – remove\_name, (optional)

- **remove\_active** ( _bool_) – remove\_active, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/presets.py:119](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/presets.py#L119)

bpy.ops.wm.interface\_theme\_preset\_remove( _\*_, _name=''_, _remove\_name=False_, _remove\_active=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.interface_theme_preset_remove "Link to this definition")

Remove a custom theme from the preset list

Parameters:

- **name** ( _str_) – Name, Name of the preset, used to make the path name (optional, never None)

- **remove\_name** ( _bool_) – remove\_name, (optional)

- **remove\_active** ( _bool_) – remove\_active, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/presets.py:119](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/presets.py#L119)

bpy.ops.wm.interface\_theme\_preset\_save( _\*_, _name=''_, _remove\_name=False_, _remove\_active=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.interface_theme_preset_save "Link to this definition")

Save a custom theme in the preset list

Parameters:

- **name** ( _str_) – Name, Name of the preset, used to make the path name (optional, never None)

- **remove\_name** ( _bool_) – remove\_name, (optional)

- **remove\_active** ( _bool_) – remove\_active, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/presets.py:754](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/presets.py#L754)

bpy.ops.wm.keyconfig\_preset\_add( _\*_, _name=''_, _remove\_name=False_, _remove\_active=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.keyconfig_preset_add "Link to this definition")

Add a custom keymap configuration to the preset list

Parameters:

- **name** ( _str_) – Name, Name of the preset, used to make the path name (optional, never None)

- **remove\_name** ( _bool_) – remove\_name, (optional)

- **remove\_active** ( _bool_) – remove\_active, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/presets.py:119](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/presets.py#L119)

bpy.ops.wm.keyconfig\_preset\_remove( _\*_, _name=''_, _remove\_name=False_, _remove\_active=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.keyconfig_preset_remove "Link to this definition")

Remove a custom keymap configuration from the preset list

Parameters:

- **name** ( _str_) – Name, Name of the preset, used to make the path name (optional, never None)

- **remove\_name** ( _bool_) – remove\_name, (optional)

- **remove\_active** ( _bool_) – remove\_active, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/presets.py:119](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/presets.py#L119)

bpy.ops.wm.lib\_reload( _\*_, _library=''_, _filepath=''_, _directory=''_, _filename=''_, _hide\_props\_region=True_, _check\_existing=False_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _relative\_path=True_, _display\_type='DEFAULT'_, _sort\_method=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.lib_reload "Link to this definition")

Reload the given library

Parameters:

- **library** ( _str_) – Library, Library to reload (optional, never None)

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **directory** ( _str_) – Directory, Directory of the file (optional, never None)

- **filename** ( _str_) – File Name, Name of the file (optional, never None)

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

- **relative\_path** ( _bool_) – Relative Path, Select the file relative to the blend file (optional)

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


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.lib\_relocate( _\*_, _library=''_, _filepath=''_, _directory=''_, _filename=''_, _files=None_, _hide\_props\_region=True_, _check\_existing=False_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _relative\_path=True_, _display\_type='DEFAULT'_, _sort\_method=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.lib_relocate "Link to this definition")

Relocate the given library to one or several others

Parameters:

- **library** ( _str_) – Library, Library to relocate (optional, never None)

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **directory** ( _str_) – Directory, Directory of the file (optional, never None)

- **filename** ( _str_) – File Name, Name of the file (optional, never None)

- **files** (`bpy_prop_collection`\[`OperatorFileListElement`\] \| None) – Files, (optional)

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

- **relative\_path** ( _bool_) – Relative Path, Select the file relative to the blend file (optional)

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


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.link( _\*_, _filepath=''_, _directory=''_, _filename=''_, _files=None_, _check\_existing=False_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=True_, _filemode=1_, _relative\_path=True_, _display\_type='DEFAULT'_, _sort\_method=''_, _link=True_, _do\_reuse\_local\_id=False_, _clear\_asset\_data=False_, _autoselect=True_, _active\_collection=True_, _instance\_collections=True_, _instance\_object\_data=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.link "Link to this definition")

Link from a Library .blend file

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

- **directory** ( _str_) – Directory, Directory of the file (optional, never None)

- **filename** ( _str_) – File Name, Name of the file (optional, never None)

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

- **relative\_path** ( _bool_) – Relative Path, Select the file relative to the blend file (optional)

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

- **link** ( _bool_) – Link, Link the objects or data-blocks rather than appending (optional)

- **do\_reuse\_local\_id** ( _bool_) – Re-Use Local Data, Try to re-use previously matching appended data-blocks instead of appending a new copy (optional)

- **clear\_asset\_data** ( _bool_) – Clear Asset Data, Don’t add asset meta-data or tags from the original data-block (optional)

- **autoselect** ( _bool_) – Select, Select new objects (optional)

- **active\_collection** ( _bool_) – Active Collection, Put new objects on the active collection (optional)

- **instance\_collections** ( _bool_) – Instance Collections, Create instances for collections, rather than adding them directly to the scene (optional)

- **instance\_object\_data** ( _bool_) – Instance Object Data, Create instances for object data which are not referenced by any objects (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.memory\_statistics() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.memory_statistics "Link to this definition")

Print memory statistics to the console

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.obj\_export( _\*_, _filepath=''_, _check\_existing=True_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _export\_animation=False_, _start\_frame=-2147483648_, _end\_frame=2147483647_, _forward\_axis='NEGATIVE\_Z'_, _up\_axis='Y'_, _global\_scale=1.0_, _apply\_modifiers=True_, _apply\_transform=True_, _export\_eval\_mode='DAG\_EVAL\_VIEWPORT'_, _export\_selected\_objects=False_, _export\_uv=True_, _export\_normals=True_, _export\_colors=False_, _export\_materials=True_, _export\_pbr\_extensions=False_, _path\_mode='AUTO'_, _export\_triangulated\_mesh=False_, _export\_curves\_as\_nurbs=False_, _export\_object\_groups=False_, _export\_material\_groups=False_, _export\_vertex\_groups=False_, _export\_smooth\_groups=False_, _smooth\_group\_bitflags=False_, _filter\_glob='\*.obj;\*.mtl'_, _collection=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.obj_export "Link to this definition")

Save the scene to a Wavefront OBJ file

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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

- **export\_animation** ( _bool_) – Export Animation, Export multiple frames instead of the current frame only (optional)

- **start\_frame** ( _int_) – Start Frame, The first frame to be exported (in \[-inf, inf\], optional)

- **end\_frame** ( _int_) – End Frame, The last frame to be exported (in \[-inf, inf\], optional)

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


- **global\_scale** ( _float_) – Scale, Value by which to enlarge or shrink the objects with respect to the world’s origin (in \[0.0001, 10000\], optional)

- **apply\_modifiers** ( _bool_) – Apply Modifiers, Apply modifiers to exported meshes (optional)

- **apply\_transform** ( _bool_) – Apply Transform, Apply object transforms to exported vertices (optional)

- **export\_eval\_mode** ( _Literal_ _\[_ _'DAG\_EVAL\_RENDER'_ _,_ _'DAG\_EVAL\_VIEWPORT'_ _\]_) –

Object Properties, Determines properties like object visibility, modifiers etc., where they differ for Render and Viewport (optional)


  - `DAG_EVAL_RENDER`
    Render – Export objects as they appear in render.

  - `DAG_EVAL_VIEWPORT`
    Viewport – Export objects as they appear in the viewport.


- **export\_selected\_objects** ( _bool_) – Export Selected Objects, Export only selected objects instead of all supported objects (optional)

- **export\_uv** ( _bool_) – Export UVs, (optional)

- **export\_normals** ( _bool_) – Export Normals, Export per-face normals if the face is flat-shaded, per-face-corner normals if smooth-shaded (optional)

- **export\_colors** ( _bool_) – Export Colors, Export per-vertex colors (optional)

- **export\_materials** ( _bool_) – Export Materials, Export MTL library. There must be a Principled-BSDF node for image textures to be exported to the MTL file (optional)

- **export\_pbr\_extensions** ( _bool_) – Export Materials with PBR Extensions, Export MTL library using PBR extensions (roughness, metallic, sheen, coat, anisotropy, transmission) (optional)

- **path\_mode** ( _Literal_ _\[_ _'AUTO'_ _,_ _'ABSOLUTE'_ _,_ _'RELATIVE'_ _,_ _'MATCH'_ _,_ _'STRIP'_ _,_ _'COPY'_ _\]_) –

Path Mode, Method used to reference paths (optional)


  - `AUTO`
    Auto – Use relative paths with subdirectories only.

  - `ABSOLUTE`
    Absolute – Always write absolute paths.

  - `RELATIVE`
    Relative – Write relative paths where possible.

  - `MATCH`
    Match – Match absolute/relative setting with input path.

  - `STRIP`
    Strip – Write filename only.

  - `COPY`
    Copy – Copy the file to the destination path.


- **export\_triangulated\_mesh** ( _bool_) – Export Triangulated Mesh, All ngons with four or more vertices will be triangulated. Meshes in the scene will not be affected. Behaves like Triangulate Modifier with ngon-method: “Beauty”, quad-method: “Shortest Diagonal”, min vertices: 4 (optional)

- **export\_curves\_as\_nurbs** ( _bool_) – Export Curves as NURBS, Export curves in parametric form instead of exporting as mesh (optional)

- **export\_object\_groups** ( _bool_) – Export Object Groups, Append mesh name to object name, separated by a ‘\_’ (optional)

- **export\_material\_groups** ( _bool_) – Export Material Groups, Generate an OBJ group for each part of a geometry using a different material (optional)

- **export\_vertex\_groups** ( _bool_) – Export Vertex Groups, Export the name of the vertex group of a face. It is approximated by choosing the vertex group with the most members among the vertices of a face (optional)

- **export\_smooth\_groups** ( _bool_) – Export Smooth Groups, Generate smooth groups identifiers for each group of smooth faces, as unique integer values by default (optional)

- **smooth\_group\_bitflags** ( _bool_) – Bitflags Smooth Groups, If exporting smoothgroups, generate ‘bitflags’ values for the groups, instead of unique integer values. The same bitflag value can be re-used for different groups of smooth faces, as long as they have no common sharp edges or vertices (optional)

- **filter\_glob** ( _str_) – Extension Filter, (optional, never None)

- **collection** ( _str_) – Collection, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

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

bpy.ops.wm.operator\_cheat\_sheet() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.operator_cheat_sheet "Link to this definition")

List all the operators in a text-block, useful for scripting

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2289](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2289)

bpy.ops.wm.operator\_defaults() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.operator_defaults "Link to this definition")

Set the active operator to its default values

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.operator\_pie\_enum( _\*_, _data\_path=''_, _prop\_string=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.operator_pie_enum "Link to this definition")

Undocumented, consider [contributing](https://developer.blender.org/).

Parameters:

- **data\_path** ( _str_) – Operator, Operator name (in Python as string) (optional, never None)

- **prop\_string** ( _str_) – Property, Property name (as a string) (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:777](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L777)

bpy.ops.wm.operator\_preset\_add( _\*_, _name=''_, _remove\_name=False_, _remove\_active=False_, _operator=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.operator_preset_add "Link to this definition")

Add or remove an Operator Preset

Parameters:

- **name** ( _str_) – Name, Name of the preset, used to make the path name (optional, never None)

- **remove\_name** ( _bool_) – remove\_name, (optional)

- **remove\_active** ( _bool_) – remove\_active, (optional)

- **operator** ( _str_) – Operator, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/presets.py:119](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/presets.py#L119)

bpy.ops.wm.operator\_presets\_cleanup( _\*_, _operator=''_, _properties=None_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.operator_presets_cleanup "Link to this definition")

Remove outdated operator properties from presets that may cause problems

Parameters:

- **operator** ( _str_) – operator, (optional, never None)

- **properties** (`bpy_prop_collection`\[`OperatorFileListElement`\] \| None) – properties, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/presets.py:967](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/presets.py#L967)

bpy.ops.wm.owner\_disable( _\*_, _owner\_id=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.owner_disable "Link to this definition")

Disable add-on for workspace

Parameters:

**owner\_id** ( _str_) – UI Tag, (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2337](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2337)

bpy.ops.wm.owner\_enable( _\*_, _owner\_id=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.owner_enable "Link to this definition")

Enable add-on for workspace

Parameters:

**owner\_id** ( _str_) – UI Tag, (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2322](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2322)

bpy.ops.wm.path\_open( _\*_, _filepath=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.path_open "Link to this definition")

Open a path in a file browser

Parameters:

**filepath** ( _str_) – filepath, (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:1185](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L1185)

bpy.ops.wm.ply\_export( _\*_, _filepath=''_, _check\_existing=True_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _forward\_axis='Y'_, _up\_axis='Z'_, _global\_scale=1.0_, _apply\_modifiers=True_, _export\_selected\_objects=False_, _collection=''_, _export\_uv=True_, _export\_normals=False_, _export\_colors='SRGB'_, _export\_attributes=True_, _export\_triangulated\_mesh=False_, _ascii\_format=False_, _filter\_glob='\*.ply'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.ply_export "Link to this definition")

Save the scene to a PLY file

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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


- **global\_scale** ( _float_) – Scale, Value by which to enlarge or shrink the objects with respect to the world’s origin (in \[0.0001, 10000\], optional)

- **apply\_modifiers** ( _bool_) – Apply Modifiers, Apply modifiers to exported meshes (optional)

- **export\_selected\_objects** ( _bool_) – Export Selected Objects, Export only selected objects instead of all supported objects (optional)

- **collection** ( _str_) – Source Collection, Export only objects from this collection (and its children) (optional, never None)

- **export\_uv** ( _bool_) – Export UVs, (optional)

- **export\_normals** ( _bool_) – Export Vertex Normals, Export specific vertex normals if available, export calculated normals otherwise (optional)

- **export\_colors** ( _Literal_ _\[_ _'NONE'_ _,_ _'SRGB'_ _,_ _'LINEAR'_ _\]_) –

Export Vertex Colors, Export vertex color attributes (optional)


  - `NONE`
    None – Do not import/export color attributes.

  - `SRGB`
    sRGB – Vertex colors in the file are in sRGB color space.

  - `LINEAR`
    Linear – Vertex colors in the file are in linear color space.


- **export\_attributes** ( _bool_) – Export Vertex Attributes, Export custom vertex attributes (optional)

- **export\_triangulated\_mesh** ( _bool_) – Export Triangulated Mesh, All ngons with four or more vertices will be triangulated. Meshes in the scene will not be affected. Behaves like Triangulate Modifier with ngon-method: “Beauty”, quad-method: “Shortest Diagonal”, min vertices: 4 (optional)

- **ascii\_format** ( _bool_) – ASCII Format, Export file in ASCII format, export as binary otherwise (optional)

- **filter\_glob** ( _str_) – Extension Filter, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.ply\_import( _\*_, _filepath=''_, _directory=''_, _files=None_, _check\_existing=False_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _global\_scale=1.0_, _use\_scene\_unit=False_, _forward\_axis='Y'_, _up\_axis='Z'_, _merge\_verts=False_, _import\_colors='SRGB'_, _import\_attributes=True_, _filter\_glob='\*.ply'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.ply_import "Link to this definition")

Import an PLY file as an object

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

- **global\_scale** ( _float_) – Scale, (in \[1e-06, 1e+06\], optional)

- **use\_scene\_unit** ( _bool_) – Scene Unit, Apply current scene’s unit (as defined by unit scale) to imported data (optional)

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


- **merge\_verts** ( _bool_) – Merge Vertices, Merges vertices by distance (optional)

- **import\_colors** ( _Literal_ _\[_ _'NONE'_ _,_ _'SRGB'_ _,_ _'LINEAR'_ _\]_) –

Vertex Colors, Import vertex color attributes (optional)


  - `NONE`
    None – Do not import/export color attributes.

  - `SRGB`
    sRGB – Vertex colors in the file are in sRGB color space.

  - `LINEAR`
    Linear – Vertex colors in the file are in linear color space.


- **import\_attributes** ( _bool_) – Vertex Attributes, Import custom vertex attributes (optional)

- **filter\_glob** ( _str_) – Extension Filter, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.previews\_batch\_clear( _\*_, _files=None_, _directory=''_, _filter\_blender=True_, _filter\_folder=True_, _use\_scenes=True_, _use\_collections=True_, _use\_objects=True_, _use\_intern\_data=True_, _use\_trusted=False_, _use\_backups=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.previews_batch_clear "Link to this definition")

Clear selected .blend file’s previews

Parameters:

- **files** (`bpy_prop_collection`\[`OperatorFileListElement`\] \| None) – files, (optional)

- **directory** ( _str_) – directory, (optional, never None)

- **filter\_blender** ( _bool_) – filter\_blender, (optional)

- **filter\_folder** ( _bool_) – filter\_folder, (optional)

- **use\_scenes** ( _bool_) – Scenes, Clear scenes’ previews (optional)

- **use\_collections** ( _bool_) – Collections, Clear collections’ previews (optional)

- **use\_objects** ( _bool_) – Objects, Clear objects’ previews (optional)

- **use\_intern\_data** ( _bool_) – Materials & Textures, Clear ‘internal’ previews (materials, textures, images, etc.) (optional)

- **use\_trusted** ( _bool_) – Trusted Blend Files, Enable Python evaluation for selected files (optional)

- **use\_backups** ( _bool_) – Save Backups, Keep a backup (.blend1) version of the files when saving with cleared previews (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/file.py:204](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/file.py#L204)

bpy.ops.wm.previews\_batch\_generate( _\*_, _files=None_, _directory=''_, _filter\_blender=True_, _filter\_folder=True_, _use\_scenes=True_, _use\_collections=True_, _use\_objects=True_, _use\_intern\_data=True_, _use\_trusted=False_, _use\_backups=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.previews_batch_generate "Link to this definition")

Generate selected .blend file’s previews

Parameters:

- **files** (`bpy_prop_collection`\[`OperatorFileListElement`\] \| None) – Collection of file paths with common `directory` root (optional)

- **directory** ( _str_) – Root path of all files listed in `files` collection (optional, never None)

- **filter\_blender** ( _bool_) – Show Blender files in the File Browser (optional)

- **filter\_folder** ( _bool_) – Show folders in the File Browser (optional)

- **use\_scenes** ( _bool_) – Scenes, Generate scenes’ previews (optional)

- **use\_collections** ( _bool_) – Collections, Generate collections’ previews (optional)

- **use\_objects** ( _bool_) – Objects, Generate objects’ previews (optional)

- **use\_intern\_data** ( _bool_) – Materials & Textures, Generate ‘internal’ previews (materials, textures, images, etc.) (optional)

- **use\_trusted** ( _bool_) – Trusted Blend Files, Enable Python evaluation for selected files (optional)

- **use\_backups** ( _bool_) – Save Backups, Keep a backup (.blend1) version of the files when saving with generated previews (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/file.py:95](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/file.py#L95)

bpy.ops.wm.previews\_clear( _\*_, _id\_type=set()_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.previews_clear "Link to this definition")

Clear data-block previews (only for some types like objects, materials, textures, etc.)

Parameters:

**id\_type** ( _set_ _\[_ _Literal_ _\[_ _'ALL'_ _,_ _'GEOMETRY'_ _,_ _'SHADING'_ _,_ _'SCENE'_ _,_ _'COLLECTION'_ _,_ _'OBJECT'_ _,_ _'MATERIAL'_ _,_ _'LIGHT'_ _,_ _'WORLD'_ _,_ _'TEXTURE'_ _,_ _'IMAGE'_ _\]_ _\]_) –

Data-Block Type, Which data-block previews to clear (optional)

- `ALL`
All Types.

- `GEOMETRY`
All Geometry Types – Clear previews for scenes, collections and objects.

- `SHADING`
All Shading Types – Clear previews for materials, lights, worlds, textures and images.

- `SCENE`
Scenes.

- `COLLECTION`
Collections.

- `OBJECT`
Objects.

- `MATERIAL`
Materials.

- `LIGHT`
Lights.

- `WORLD`
Worlds.

- `TEXTURE`
Textures.

- `IMAGE`
Images.


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.previews\_ensure() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.previews_ensure "Link to this definition")

Ensure data-block previews are available and up-to-date (to be saved in .blend file, only for some types like materials, textures, etc.)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.properties\_add( _\*_, _data\_path=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.properties_add "Link to this definition")

Add your own property to the data-block

Parameters:

**data\_path** ( _str_) – Property Edit, Property data\_path edit (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2171](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2171)

bpy.ops.wm.properties\_context\_change( _\*_, _context=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.properties_context_change "Link to this definition")

Jump to a different tab inside the properties editor

Parameters:

**context** ( _str_) – Context, (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2214](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2214)

bpy.ops.wm.properties\_edit( _\*_, _data\_path=''_, _property\_name=''_, _property\_type='FLOAT'_, _is\_overridable\_library=False_, _description=''_, _use\_soft\_limits=False_, _array\_length=3_, _default\_int=(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)_, _min\_int=-10000_, _max\_int=10000_, _soft\_min\_int=-10000_, _soft\_max\_int=10000_, _step\_int=1_, _default\_bool=(False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False,False)_, _default\_float=(0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0)_, _min\_float=-10000.0_, _max\_float=-10000.0_, _soft\_min\_float=-10000.0_, _soft\_max\_float=-10000.0_, _precision=3_, _step\_float=0.1_, _subtype=''_, _default\_string=''_, _id\_type='OBJECT'_, _eval\_string=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.properties_edit "Link to this definition")

Change a custom property’s type, or adjust how it is displayed in the interface

Parameters:

- **data\_path** ( _str_) – Property Edit, Property data\_path edit (optional, never None)

- **property\_name** ( _str_) – Property Name, Property name edit (optional, never None)

- **property\_type** ( _Literal_ _\[_ _'FLOAT'_ _,_ _'FLOAT\_ARRAY'_ _,_ _'INT'_ _,_ _'INT\_ARRAY'_ _,_ _'BOOL'_ _,_ _'BOOL\_ARRAY'_ _,_ _'STRING'_ _,_ _'DATA\_BLOCK'_ _,_ _'PYTHON'_ _\]_) –

Type, (optional)


  - `FLOAT`
    Float – A single floating-point value.

  - `FLOAT_ARRAY`
    Float Array – An array of floating-point values.

  - `INT`
    Integer – A single integer.

  - `INT_ARRAY`
    Integer Array – An array of integers.

  - `BOOL`
    Boolean – A true or false value.

  - `BOOL_ARRAY`
    Boolean Array – An array of true or false values.

  - `STRING`
    String – A string value.

  - `DATA_BLOCK`
    Data-Block – A data-block value.

  - `PYTHON`
    Python – Edit a Python value directly, for unsupported property types.


- **is\_overridable\_library** ( _bool_) – Library Overridable, Allow the property to be overridden when the data-block is linked (optional)

- **description** ( _str_) – Description, (optional, never None)

- **use\_soft\_limits** ( _bool_) – Soft Limits, Limits the Property Value slider to a range, values outside the range must be inputted numerically (optional)

- **array\_length** ( _int_) – Array Length, (in \[1, 32\], optional)

- **default\_int** ( _Sequence_ _\[_ _int_ _\]_) – Default Value, (array of 32 items, in \[-inf, inf\], optional)

- **min\_int** ( _int_) – Min, (in \[-inf, inf\], optional)

- **max\_int** ( _int_) – Max, (in \[-inf, inf\], optional)

- **soft\_min\_int** ( _int_) – Soft Min, (in \[-inf, inf\], optional)

- **soft\_max\_int** ( _int_) – Soft Max, (in \[-inf, inf\], optional)

- **step\_int** ( _int_) – Step, (in \[1, inf\], optional)

- **default\_bool** ( _Sequence_ _\[_ _bool_ _\]_) – Default Value, (array of 32 items, optional)

- **default\_float** ( _Sequence_ _\[_ _float_ _\]_) – Default Value, (array of 32 items, in \[-inf, inf\], optional)

- **min\_float** ( _float_) – Min, (in \[-inf, inf\], optional)

- **max\_float** ( _float_) – Max, (in \[-inf, inf\], optional)

- **soft\_min\_float** ( _float_) – Soft Min, (in \[-inf, inf\], optional)

- **soft\_max\_float** ( _float_) – Soft Max, (in \[-inf, inf\], optional)

- **precision** ( _int_) – Precision, (in \[0, 8\], optional)

- **step\_float** ( _float_) – Step, (in \[0.001, inf\], optional)

- **subtype** ( _str_) – Subtype, (optional)

- **default\_string** ( _str_) – Default Value, (optional, never None)

- **id\_type** ( _Literal_ _\[_ _'ACTION'_ _,_ _'ARMATURE'_ _,_ _'BRUSH'_ _,_ _'CACHEFILE'_ _,_ _'CAMERA'_ _,_ _'COLLECTION'_ _,_ _'CURVE'_ _,_ _'CURVES'_ _,_ _'FONT'_ _,_ _'GREASEPENCIL'_ _,_ _'GREASEPENCIL\_V3'_ _,_ _'IMAGE'_ _,_ _'KEY'_ _,_ _'LATTICE'_ _,_ _'LIBRARY'_ _,_ _'LIGHT'_ _,_ _'LIGHT\_PROBE'_ _,_ _'LINESTYLE'_ _,_ _'MASK'_ _,_ _'MATERIAL'_ _,_ _'MESH'_ _,_ _'META'_ _,_ _'MOVIECLIP'_ _,_ _'NODETREE'_ _,_ _'OBJECT'_ _,_ _'PAINTCURVE'_ _,_ _'PALETTE'_ _,_ _'PARTICLE'_ _,_ _'POINTCLOUD'_ _,_ _'SCENE'_ _,_ _'SCREEN'_ _,_ _'SOUND'_ _,_ _'SPEAKER'_ _,_ _'TEXT'_ _,_ _'TEXTURE'_ _,_ _'VOLUME'_ _,_ _'WINDOWMANAGER'_ _,_ _'WORKSPACE'_ _,_ _'WORLD'_ _\]_) – ID Type, (optional)

- **eval\_string** ( _str_) – Value, Python value for unsupported custom property types (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:1904](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L1904)

bpy.ops.wm.properties\_edit\_value( _\*_, _data\_path=''_, _property\_name=''_, _eval\_string=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.properties_edit_value "Link to this definition")

Edit the value of a custom property

Parameters:

- **data\_path** ( _str_) – Property Edit, Property data\_path edit (optional, never None)

- **property\_name** ( _str_) – Property Name, Property name edit (optional, never None)

- **eval\_string** ( _str_) – Value, Value for custom property types that can only be edited as a Python expression (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2128](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2128)

bpy.ops.wm.properties\_remove( _\*_, _data\_path=''_, _property\_name=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.properties_remove "Link to this definition")

Internal use (edit a property data\_path)

Parameters:

- **data\_path** ( _str_) – Property Edit, Property data\_path edit (optional, never None)

- **property\_name** ( _str_) – Property Name, Property name edit (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2228](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2228)

bpy.ops.wm.quit\_blender() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.quit_blender "Link to this definition")

Quit Blender

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.radial\_control( _\*_, _data\_path\_primary=''_, _data\_path\_secondary=''_, _use\_secondary=''_, _rotation\_path=''_, _color\_path=''_, _fill\_color\_path=''_, _fill\_color\_override\_path=''_, _fill\_color\_override\_test\_path=''_, _zoom\_path=''_, _image\_id=''_, _secondary\_tex=False_, _release\_confirm=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.radial_control "Link to this definition")

Set some size property (e.g. brush size) with mouse wheel

Parameters:

- **data\_path\_primary** ( _str_) – Primary Data Path, Primary path of property to be set by the radial control (optional, never None)

- **data\_path\_secondary** ( _str_) – Secondary Data Path, Secondary path of property to be set by the radial control (optional, never None)

- **use\_secondary** ( _str_) – Use Secondary, Path of property to select between the primary and secondary data paths (optional, never None)

- **rotation\_path** ( _str_) – Rotation Path, Path of property used to rotate the texture display (optional, never None)

- **color\_path** ( _str_) – Color Path, Path of property used to set the color of the control (optional, never None)

- **fill\_color\_path** ( _str_) – Fill Color Path, Path of property used to set the fill color of the control (optional, never None)

- **fill\_color\_override\_path** ( _str_) – Fill Color Override Path, (optional, never None)

- **fill\_color\_override\_test\_path** ( _str_) – Fill Color Override Test, (optional, never None)

- **zoom\_path** ( _str_) – Zoom Path, Path of property used to set the zoom level for the control (optional, never None)

- **image\_id** ( _str_) – Image ID, Path of ID that is used to generate an image for the control (optional, never None)

- **secondary\_tex** ( _bool_) – Secondary Texture, Tweak brush secondary/mask texture (optional)

- **release\_confirm** ( _bool_) – Confirm On Release, Finish operation on key release (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.read\_factory\_settings( _\*_, _use\_factory\_startup\_app\_template\_only=False_, _app\_template='Template'_, _use\_empty=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.read_factory_settings "Link to this definition")

Load factory default startup file and preferences. To make changes permanent, use “Save Startup File” and “Save Preferences”

Parameters:

- **use\_factory\_startup\_app\_template\_only** ( _bool_) – Factory Startup App-Template Only, (optional)

- **app\_template** ( _str_) – (optional, never None)

- **use\_empty** ( _bool_) – Empty, After loading, remove everything except scenes, windows, and workspaces. This makes it possible to load the startup file with its scene configuration and window layout intact, but no objects, materials, animations, … (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.read\_factory\_userpref( _\*_, _use\_factory\_startup\_app\_template\_only=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.read_factory_userpref "Link to this definition")

Load factory default preferences. To make changes to preferences permanent, use “Save Preferences”

Parameters:

**use\_factory\_startup\_app\_template\_only** ( _bool_) – Factory Startup App-Template Only, (optional)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.read\_history() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.read_history "Link to this definition")

Reloads history and bookmarks

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.read\_homefile( _\*_, _filepath=''_, _load\_ui=True_, _use\_splash=False_, _use\_factory\_startup=False_, _use\_factory\_startup\_app\_template\_only=False_, _app\_template='Template'_, _use\_empty=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.read_homefile "Link to this definition")

Open the default file

Parameters:

- **filepath** ( _str_) – File Path, Path to an alternative start-up file (optional, never None)

- **load\_ui** ( _bool_) – Load UI, Load user interface setup from the .blend file (optional)

- **use\_splash** ( _bool_) – Splash, (optional)

- **use\_factory\_startup** ( _bool_) – Factory Startup, Load the default (‘factory startup’) blend file. This is independent of the normal start-up file that the user can save (optional)

- **use\_factory\_startup\_app\_template\_only** ( _bool_) – Factory Startup App-Template Only, (optional)

- **app\_template** ( _str_) – (optional, never None)

- **use\_empty** ( _bool_) – Empty, After loading, remove everything except scenes, windows, and workspaces. This makes it possible to load the startup file with its scene configuration and window layout intact, but no objects, materials, animations, … (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.read\_userpref() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.read_userpref "Link to this definition")

Load last saved preferences

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.recover\_auto\_save( _\*_, _filepath=''_, _hide\_props\_region=True_, _check\_existing=False_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=False_, _filter\_blenlib=False_, _filemode=8_, _display\_type='LIST\_VERTICAL'_, _sort\_method=''_, _use\_scripts=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.recover_auto_save "Link to this definition")

Open an automatically saved file to recover it

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

- **use\_scripts** ( _bool_) – Trusted Source, Allow .blend file to execute scripts automatically, default available from system preferences (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.recover\_last\_session( _\*_, _use\_scripts=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.recover_last_session "Link to this definition")

Open the last closed file (“quit.blend”)

Parameters:

**use\_scripts** ( _bool_) – Trusted Source, Allow .blend file to execute scripts automatically, default available from system preferences (optional)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.redraw\_timer( _\*_, _type='DRAW'_, _iterations=10_, _time\_limit=0.0_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.redraw_timer "Link to this definition")

Simple redraw timer to test the speed of updating the interface

Parameters:

- **type** ( _Literal_ _\[_ _'DRAW'_ _,_ _'DRAW\_SWAP'_ _,_ _'DRAW\_WIN'_ _,_ _'DRAW\_WIN\_SWAP'_ _,_ _'ANIM\_STEP'_ _,_ _'ANIM\_PLAY'_ _,_ _'UNDO'_ _\]_) –

Type, (optional)


  - `DRAW`
    Draw Region – Draw region.

  - `DRAW_SWAP`
    Draw Region & Swap – Draw region and swap.

  - `DRAW_WIN`
    Draw Window – Draw window.

  - `DRAW_WIN_SWAP`
    Draw Window & Swap – Draw window and swap.

  - `ANIM_STEP`
    Animation Step – Animation steps.

  - `ANIM_PLAY`
    Animation Play – Animation playback.

  - `UNDO`
    Undo/Redo – Undo and redo.


- **iterations** ( _int_) – Iterations, Number of times to redraw (in \[1, inf\], optional)

- **time\_limit** ( _float_) – Time Limit, Seconds to run the test for (override iterations) (in \[0, inf\], optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.revert\_mainfile( _\*_, _use\_scripts=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.revert_mainfile "Link to this definition")

Reload the saved file

Parameters:

**use\_scripts** ( _bool_) – Trusted Source, Allow .blend file to execute scripts automatically, default available from system preferences (optional)

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

bpy.ops.wm.save\_auto\_save() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.save_auto_save "Link to this definition")

Create an autosave in the temp directory for the current file

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.save\_homefile() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.save_homefile "Link to this definition")

Make the current file the default startup file

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.save\_mainfile( _\*_, _filepath=''_, _hide\_props\_region=True_, _check\_existing=True_, _filter\_blender=True_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _compress=False_, _relative\_remap=False_, _exit=False_, _incremental=False_, _show\_save\_modified\_images\_dialog=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.save_mainfile "Link to this definition")

Save the current Blender file

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

- **exit** ( _bool_) – Exit, Exit Blender after saving (optional)

- **incremental** ( _bool_) – Incremental, Save the current Blender file with a numerically incremented name that does not overwrite any existing files (optional)

- **show\_save\_modified\_images\_dialog** ( _bool_) – Show Save Modified Images Dialog, Show a popup dialog to save modified images before saving the blend file (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.save\_userpref() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.save_userpref "Link to this definition")

Make the current preferences default

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.search\_menu() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.search_menu "Link to this definition")

Pop-up a search over all menus in the current context

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.search\_operator() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.search_operator "Link to this definition")

Pop-up a search over all available operators in current context

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.search\_single\_menu( _\*_, _menu\_idname=''_, _initial\_query=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.search_single_menu "Link to this definition")

Pop-up a search for a menu in current context

Parameters:

- **menu\_idname** ( _str_) – Menu Name, Menu to search in (optional, never None)

- **initial\_query** ( _str_) – Initial Query, Query to insert into the search box (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.set\_stereo\_3d( _\*_, _display\_mode='ANAGLYPH'_, _anaglyph\_type='RED\_CYAN'_, _interlace\_type='ROW\_INTERLEAVED'_, _use\_interlace\_swap=False_, _use\_sidebyside\_crosseyed=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.set_stereo_3d "Link to this definition")

Toggle 3D stereo support for current window (or change the display mode)

Parameters:

- **display\_mode** (Literal\[ [Stereo3D Display Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/stereo3d_display_items.html#rna-enum-stereo3d-display-items)\]) – Display Mode, (optional)

- **anaglyph\_type** (Literal\[ [Stereo3D Anaglyph Type Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/stereo3d_anaglyph_type_items.html#rna-enum-stereo3d-anaglyph-type-items)\]) – Anaglyph Type, (optional)

- **interlace\_type** (Literal\[ [Stereo3D Interlace Type Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/stereo3d_interlace_type_items.html#rna-enum-stereo3d-interlace-type-items)\]) – Interlace Type, (optional)

- **use\_interlace\_swap** ( _bool_) – Swap Left/Right, Swap left and right stereo channels (optional)

- **use\_sidebyside\_crosseyed** ( _bool_) – Cross-Eyed, Right eye should see left image and vice versa (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.set\_working\_color\_space( _\*_, _convert\_colors=True_, _working\_space=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.set_working_color_space "Link to this definition")

Change the working color space of all colors in this blend file

Parameters:

- **convert\_colors** ( _bool_) – Convert Colors in All Data-blocks, Change colors in all data-blocks to the new working space (optional)

- **working\_space** ( _str_) – Working Space, Color space to set (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.splash() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.splash "Link to this definition")

Open the splash screen with release info

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.splash\_about() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.splash_about "Link to this definition")

Open a window with information about Blender

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.stl\_export( _\*_, _filepath=''_, _check\_existing=True_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _ascii\_format=False_, _use\_batch=False_, _export\_selected\_objects=False_, _collection=''_, _global\_scale=1.0_, _use\_scene\_unit=False_, _forward\_axis='Y'_, _up\_axis='Z'_, _apply\_modifiers=True_, _evaluation\_mode='DAG\_EVAL\_RENDER'_, _filter\_glob='\*.stl'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.stl_export "Link to this definition")

Save the scene to an STL file

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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

- **ascii\_format** ( _bool_) – ASCII Format, Export file in ASCII format, export as binary otherwise (optional)

- **use\_batch** ( _bool_) – Batch Export, Export each object to a separate file (optional)

- **export\_selected\_objects** ( _bool_) – Export Selected Objects, Export only selected objects instead of all supported objects (optional)

- **collection** ( _str_) – Source Collection, Export only objects from this collection (and its children) (optional, never None)

- **global\_scale** ( _float_) – Scale, (in \[1e-06, 1e+06\], optional)

- **use\_scene\_unit** ( _bool_) – Scene Unit, Apply current scene’s unit (as defined by unit scale) to exported data (optional)

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


- **apply\_modifiers** ( _bool_) – Apply Modifiers, Apply modifiers to exported meshes (optional)

- **evaluation\_mode** ( _Literal_ _\[_ _'DAG\_EVAL\_RENDER'_ _,_ _'DAG\_EVAL\_VIEWPORT'_ _\]_) –

Object Properties, Determines properties like object visibility, modifiers etc., where they differ for Render and Viewport (optional)


  - `DAG_EVAL_RENDER`
    Render – Export objects as they appear in render.

  - `DAG_EVAL_VIEWPORT`
    Viewport – Export objects as they appear in the viewport (Multiresolution modifiers in Sculpt Mode will not be evaluated).


- **filter\_glob** ( _str_) – Extension Filter, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.stl\_import( _\*_, _filepath=''_, _directory=''_, _files=None_, _check\_existing=False_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=False_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _global\_scale=1.0_, _use\_scene\_unit=False_, _use\_facet\_normal=False_, _forward\_axis='Y'_, _up\_axis='Z'_, _use\_mesh\_validate=True_, _filter\_glob='\*.stl'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.stl_import "Link to this definition")

Import an STL file as an object

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

- **global\_scale** ( _float_) – Scale, (in \[1e-06, 1e+06\], optional)

- **use\_scene\_unit** ( _bool_) – Scene Unit, Apply current scene’s unit (as defined by unit scale) to imported data (optional)

- **use\_facet\_normal** ( _bool_) – Facet Normals, Use (import) facet normals (note that this will still give flat shading) (optional)

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


- **use\_mesh\_validate** ( _bool_) – Validate Mesh, Ensure the data is valid (when disabled, data may be imported which causes crashes displaying or editing) (optional)

- **filter\_glob** ( _str_) – Extension Filter, (optional, never None)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.sysinfo( _\*_, _filepath=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.sysinfo "Link to this definition")

Generate system information, saved into a text file

Parameters:

**filepath** ( _str_) – filepath, (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2257](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2257)

bpy.ops.wm.tool\_set\_by\_brush\_type( _\*_, _brush\_type=''_, _space\_type='EMPTY'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.tool_set_by_brush_type "Link to this definition")

Look up the most appropriate tool for the given brush type and activate that

Parameters:

- **brush\_type** ( _str_) – Brush Type, Brush type identifier for which the most appropriate tool will be looked up (optional, never None)

- **space\_type** ( _Literal_ _\[_ _'EMPTY'_ _,_ _'VIEW\_3D'_ _,_ _'IMAGE\_EDITOR'_ _,_ _'NODE\_EDITOR'_ _,_ _'SEQUENCE\_EDITOR'_ _,_ _'CLIP\_EDITOR'_ _,_ _'DOPESHEET\_EDITOR'_ _,_ _'GRAPH\_EDITOR'_ _,_ _'NLA\_EDITOR'_ _,_ _'TEXT\_EDITOR'_ _,_ _'CONSOLE'_ _,_ _'INFO'_ _,_ _'TOPBAR'_ _,_ _'STATUSBAR'_ _,_ _'OUTLINER'_ _,_ _'PROPERTIES'_ _,_ _'FILE\_BROWSER'_ _,_ _'SPREADSHEET'_ _,_ _'PREFERENCES'_ _\]_) – Type, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2471](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2471)

bpy.ops.wm.tool\_set\_by\_id( _\*_, _name=''_, _cycle=False_, _as\_fallback=False_, _space\_type='EMPTY'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.tool_set_by_id "Link to this definition")

Set the tool by name (for key-maps)

Parameters:

- **name** ( _str_) – Identifier, Identifier of the tool (optional, never None)

- **cycle** ( _bool_) – Cycle, Cycle through tools in this group (optional)

- **as\_fallback** ( _bool_) – Set Fallback, Set the fallback tool instead of the primary tool (optional)

- **space\_type** ( _Literal_ _\[_ _'EMPTY'_ _,_ _'VIEW\_3D'_ _,_ _'IMAGE\_EDITOR'_ _,_ _'NODE\_EDITOR'_ _,_ _'SEQUENCE\_EDITOR'_ _,_ _'CLIP\_EDITOR'_ _,_ _'DOPESHEET\_EDITOR'_ _,_ _'GRAPH\_EDITOR'_ _,_ _'NLA\_EDITOR'_ _,_ _'TEXT\_EDITOR'_ _,_ _'CONSOLE'_ _,_ _'INFO'_ _,_ _'TOPBAR'_ _,_ _'STATUSBAR'_ _,_ _'OUTLINER'_ _,_ _'PROPERTIES'_ _,_ _'FILE\_BROWSER'_ _,_ _'SPREADSHEET'_ _,_ _'PREFERENCES'_ _\]_) – Type, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2380](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2380)

bpy.ops.wm.tool\_set\_by\_index( _\*_, _index=0_, _cycle=False_, _expand=True_, _as\_fallback=False_, _space\_type='EMPTY'_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.tool_set_by_index "Link to this definition")

Set the tool by index (for key-maps)

Parameters:

- **index** ( _int_) – Index in Toolbar, (in \[-inf, inf\], optional)

- **cycle** ( _bool_) – Cycle, Cycle through tools in this group (optional)

- **expand** ( _bool_) – expand, Include tool subgroups (optional)

- **as\_fallback** ( _bool_) – Set Fallback, Set the fallback tool instead of the primary (optional)

- **space\_type** ( _Literal_ _\[_ _'EMPTY'_ _,_ _'VIEW\_3D'_ _,_ _'IMAGE\_EDITOR'_ _,_ _'NODE\_EDITOR'_ _,_ _'SEQUENCE\_EDITOR'_ _,_ _'CLIP\_EDITOR'_ _,_ _'DOPESHEET\_EDITOR'_ _,_ _'GRAPH\_EDITOR'_ _,_ _'NLA\_EDITOR'_ _,_ _'TEXT\_EDITOR'_ _,_ _'CONSOLE'_ _,_ _'INFO'_ _,_ _'TOPBAR'_ _,_ _'STATUSBAR'_ _,_ _'OUTLINER'_ _,_ _'PROPERTIES'_ _,_ _'FILE\_BROWSER'_ _,_ _'SPREADSHEET'_ _,_ _'PREFERENCES'_ _\]_) – Type, (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2430](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2430)

bpy.ops.wm.toolbar() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.toolbar "Link to this definition")

Undocumented, consider [contributing](https://developer.blender.org/).

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2538](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2538)

bpy.ops.wm.toolbar\_fallback\_pie() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.toolbar_fallback_pie "Link to this definition")

Undocumented, consider [contributing](https://developer.blender.org/).

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2562](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2562)

bpy.ops.wm.toolbar\_prompt() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.toolbar_prompt "Link to this definition")

Leader key like functionality for accessing tools

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:2662](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L2662)

bpy.ops.wm.url\_open( _\*_, _url=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.url_open "Link to this definition")

Open a website in the web browser

Parameters:

**url** ( _str_) – URL, URL to open (optional, never None)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:1085](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L1085)

bpy.ops.wm.url\_open\_preset( _\*_, _type=''_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.url_open_preset "Link to this definition")

Open a preset website in the web browser

Parameters:

**type** ( _str_) – Site, (optional)

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

File:

[startup/bl\_operators/wm.py:1168](https://projects.blender.org/blender/blender/src/branch/main/scripts/startup/bl_operators/wm.py#L1168)

bpy.ops.wm.usd\_export( _\*_, _filepath=''_, _check\_existing=True_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=True_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _display\_type='DEFAULT'_, _sort\_method=''_, _filter\_glob='\*.usd'_, _selected\_objects\_only=False_, _collection=''_, _export\_animation=False_, _incremental\_frames=0_, _export\_hair=False_, _export\_uvmaps=True_, _rename\_uvmaps=True_, _export\_mesh\_colors=True_, _export\_normals=True_, _export\_materials=True_, _export\_subdivision='BEST\_MATCH'_, _export\_armatures=True_, _only\_deform\_bones=False_, _export\_shapekeys=True_, _use\_instancing=False_, _evaluation\_mode='RENDER'_, _generate\_preview\_surface=True_, _generate\_materialx\_network=False_, _convert\_orientation=False_, _export\_global\_forward\_selection='NEGATIVE\_Z'_, _export\_global\_up\_selection='Y'_, _export\_textures\_mode='NEW'_, _overwrite\_textures=False_, _relative\_paths=True_, _xform\_op\_mode='TRS'_, _root\_prim\_path='/root'_, _export\_custom\_properties=True_, _custom\_properties\_namespace='userProperties'_, _accessibility\_label=''_, _accessibility\_description=''_, _author\_blender\_name=True_, _convert\_world\_material=True_, _allow\_unicode=True_, _export\_meshes=True_, _export\_lights=True_, _export\_cameras=True_, _export\_curves=True_, _export\_points=True_, _export\_volumes=True_, _triangulate\_meshes=False_, _quad\_method='SHORTEST\_DIAGONAL'_, _ngon\_method='BEAUTY'_, _usdz\_downscale\_size='KEEP'_, _usdz\_downscale\_custom\_size=128_, _merge\_parent\_xform=False_, _convert\_scene\_units='METERS'_, _meters\_per\_unit=1.0_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.usd_export "Link to this definition")

Export current scene in a USD archive

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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

- **filter\_glob** ( _str_) – (optional, never None)

- **selected\_objects\_only** ( _bool_) – Selection Only, Only export selected objects. Unselected parents of selected objects are exported as empty transform (optional)

- **collection** ( _str_) – Collection, (optional, never None)

- **export\_animation** ( _bool_) – Animation, Export all frames in the render frame range, rather than only the current frame (optional)

- **incremental\_frames** ( _int_) – Incremental Save, Incrementally save after the specified number of frames to reduce peak memory usage. Incremental saves can result in longer export times and potential issues with some file synchronization services. Zero disables incremental save (in \[0, inf\], optional)

- **export\_hair** ( _bool_) – Hair, Export hair particle systems as USD curves (optional)

- **export\_uvmaps** ( _bool_) – UV Maps, Include all mesh UV maps in the export (optional)

- **rename\_uvmaps** ( _bool_) – Rename UV Maps, Rename active render UV map to “st” to match USD conventions (optional)

- **export\_mesh\_colors** ( _bool_) – Color Attributes, Include mesh color attributes in the export (optional)

- **export\_normals** ( _bool_) – Normals, Include normals of exported meshes in the export (optional)

- **export\_materials** ( _bool_) – Materials, Export viewport settings of materials as USD preview materials, and export material assignments as geometry subsets (optional)

- **export\_subdivision** ( _Literal_ _\[_ _'IGNORE'_ _,_ _'TESSELLATE'_ _,_ _'BEST\_MATCH'_ _\]_) –

Subdivision, Choose how subdivision modifiers will be mapped to the USD subdivision scheme during export (optional)


  - `IGNORE`
    Ignore – Scheme = None. Export base mesh without subdivision.

  - `TESSELLATE`
    Tessellate – Scheme = None. Export subdivided mesh.

  - `BEST_MATCH`
    Best Match – Scheme = Catmull-Clark, when possible. Reverts to exporting the subdivided mesh for the Simple subdivision type.


- **export\_armatures** ( _bool_) – Armatures, Export armatures and meshes with armature modifiers as USD skeletons and skinned meshes (optional)

- **only\_deform\_bones** ( _bool_) – Only Deform Bones, Only export deform bones and their parents (optional)

- **export\_shapekeys** ( _bool_) – Shape Keys, Export shape keys as USD blend shapes (optional)

- **use\_instancing** ( _bool_) – Instancing, Export instanced objects as references in USD rather than real objects (optional)

- **evaluation\_mode** ( _Literal_ _\[_ _'RENDER'_ _,_ _'VIEWPORT'_ _\]_) –

Use Settings for, Determines visibility of objects, modifier settings, and other areas where there are different settings for viewport and rendering (optional)


  - `RENDER`
    Render – Use Render settings for object visibility, modifier settings, etc.

  - `VIEWPORT`
    Viewport – Use Viewport settings for object visibility, modifier settings, etc.


- **generate\_preview\_surface** ( _bool_) – USD Preview Surface Network, Generate an approximate USD Preview Surface shader representation of a Principled BSDF node network (optional)

- **generate\_materialx\_network** ( _bool_) – MaterialX Network, Generate a MaterialX network representation of the materials (optional)

- **convert\_orientation** ( _bool_) – Convert Orientation, Convert orientation axis to a different convention to match other applications (optional)

- **export\_global\_forward\_selection** ( _Literal_ _\[_ _'X'_ _,_ _'Y'_ _,_ _'Z'_ _,_ _'NEGATIVE\_X'_ _,_ _'NEGATIVE\_Y'_ _,_ _'NEGATIVE\_Z'_ _\]_) –

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


- **export\_global\_up\_selection** ( _Literal_ _\[_ _'X'_ _,_ _'Y'_ _,_ _'Z'_ _,_ _'NEGATIVE\_X'_ _,_ _'NEGATIVE\_Y'_ _,_ _'NEGATIVE\_Z'_ _\]_) –

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


- **export\_textures\_mode** ( _Literal_ _\[_ _'KEEP'_ _,_ _'PRESERVE'_ _,_ _'NEW'_ _\]_) –

Export Textures, Texture export method (optional)


  - `KEEP`
    Keep – Use original location of textures.

  - `PRESERVE`
    Preserve – Preserve file paths of textures from already imported USD files.
    Export remaining textures to a ‘textures’ folder next to the USD file.

  - `NEW`
    New Path – Export textures to a ‘textures’ folder next to the USD file.


- **overwrite\_textures** ( _bool_) – Overwrite Textures, Overwrite existing files when exporting textures (optional)

- **relative\_paths** ( _bool_) – Relative Paths, Use relative paths to reference external files (i.e. textures, volumes) in USD, otherwise use absolute paths (optional)

- **xform\_op\_mode** ( _Literal_ _\[_ _'TRS'_ _,_ _'TOS'_ _,_ _'MAT'_ _\]_) –

Xform Ops, The type of transform operators to write (optional)


  - `TRS`
    Translate, Rotate, Scale – Export with translate, rotate, and scale Xform operators.

  - `TOS`
    Translate, Orient, Scale – Export with translate, orient quaternion, and scale Xform operators.

  - `MAT`
    Matrix – Export matrix operator.


- **root\_prim\_path** ( _str_) – Root Prim, If set, add a transform primitive with the given path to the stage as the parent of all exported data (optional, never None)

- **export\_custom\_properties** ( _bool_) – Custom Properties, Export custom properties as USD attributes (optional)

- **custom\_properties\_namespace** ( _str_) – Namespace, If set, add the given namespace as a prefix to exported custom property names. This only applies to property names that do not already have a prefix (e.g., it would apply to name ‘bar’ but not ‘foo:bar’) and does not apply to blender object and data names which are always exported in the ‘userProperties:blender’ namespace (optional, never None)

- **accessibility\_label** ( _str_) – Label, Set the accessibility label for the exported stage’s default prim (optional, never None)

- **accessibility\_description** ( _str_) – Description, Set the accessibility description for the exported stage’s default prim (optional, never None)

- **author\_blender\_name** ( _bool_) – Blender Names, Author USD custom attributes containing the original Blender object and object data names (optional)

- **convert\_world\_material** ( _bool_) – World Dome Light, Convert the world material to a USD dome light. Currently works for simple materials, consisting of an environment texture connected to a background shader, with an optional vector multiply of the texture color (optional)

- **allow\_unicode** ( _bool_) – Allow Unicode, Preserve UTF-8 encoded characters when writing USD prim and property names (requires software utilizing USD 24.03 or greater when opening the resulting files) (optional)

- **export\_meshes** ( _bool_) – Meshes, Export all meshes (optional)

- **export\_lights** ( _bool_) – Lights, Export all lights (optional)

- **export\_cameras** ( _bool_) – Cameras, Export all cameras (optional)

- **export\_curves** ( _bool_) – Curves, Export all curves (optional)

- **export\_points** ( _bool_) – Point Clouds, Export all point clouds (optional)

- **export\_volumes** ( _bool_) – Volumes, Export all volumes (optional)

- **triangulate\_meshes** ( _bool_) – Triangulate Meshes, Triangulate meshes during export (optional)

- **quad\_method** (Literal\[ [Modifier Triangulate Quad Method Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/modifier_triangulate_quad_method_items.html#rna-enum-modifier-triangulate-quad-method-items)\]) – Quad Method, Method for splitting the quads into triangles (optional)

- **ngon\_method** (Literal\[ [Modifier Triangulate Ngon Method Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/modifier_triangulate_ngon_method_items.html#rna-enum-modifier-triangulate-ngon-method-items)\]) – N-gon Method, Method for splitting the n-gons into triangles (optional)

- **usdz\_downscale\_size** ( _Literal_ _\[_ _'KEEP'_ _,_ _'256'_ _,_ _'512'_ _,_ _'1024'_ _,_ _'2048'_ _,_ _'4096'_ _,_ _'CUSTOM'_ _\]_) –

USDZ Texture Downsampling, Choose a maximum size for all exported textures (optional)


  - `KEEP`
    Keep – Keep all current texture sizes.

  - `256`
    256 – Resize to a maximum of 256 pixels.

  - `512`
    512 – Resize to a maximum of 512 pixels.

  - `1024`
    1024 – Resize to a maximum of 1024 pixels.

  - `2048`
    2048 – Resize to a maximum of 2048 pixels.

  - `4096`
    4096 – Resize to a maximum of 4096 pixels.

  - `CUSTOM`
    Custom – Specify a custom size.


- **usdz\_downscale\_custom\_size** ( _int_) – USDZ Custom Downscale Size, Custom size for downscaling exported textures (in \[64, 16384\], optional)

- **merge\_parent\_xform** ( _bool_) – Merge parent Xform, Merge USD primitives with their Xform parent if possible. USD does not allow nested UsdGeomGprims, intermediary Xform prims will be defined to keep the USD file valid when encountering object hierarchies. (optional)

- **convert\_scene\_units** ( _Literal_ _\[_ _'METERS'_ _,_ _'KILOMETERS'_ _,_ _'CENTIMETERS'_ _,_ _'MILLIMETERS'_ _,_ _'INCHES'_ _,_ _'FEET'_ _,_ _'YARDS'_ _,_ _'CUSTOM'_ _\]_) –

Units, Set the USD Stage meters per unit to the chosen measurement, or a custom value (optional)


  - `METERS`
    Meters – Scene meters per unit to 1.0.

  - `KILOMETERS`
    Kilometers – Scene meters per unit to 1000.0.

  - `CENTIMETERS`
    Centimeters – Scene meters per unit to 0.01.

  - `MILLIMETERS`
    Millimeters – Scene meters per unit to 0.001.

  - `INCHES`
    Inches – Scene meters per unit to 0.0254.

  - `FEET`
    Feet – Scene meters per unit to 0.3048.

  - `YARDS`
    Yards – Scene meters per unit to 0.9144.

  - `CUSTOM`
    Custom – Specify a custom scene meters per unit value.


- **meters\_per\_unit** ( _float_) – Meters Per Unit, Custom value for meters per unit in the USD Stage (in \[0.0001, 1000\], optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.usd\_import( _\*_, _filepath=''_, _check\_existing=False_, _filter\_blender=False_, _filter\_backup=False_, _filter\_image=False_, _filter\_movie=False_, _filter\_python=False_, _filter\_font=False_, _filter\_sound=False_, _filter\_text=False_, _filter\_archive=False_, _filter\_btx=False_, _filter\_alembic=False_, _filter\_usd=True_, _filter\_obj=False_, _filter\_volume=False_, _filter\_folder=True_, _filter\_blenlib=False_, _filemode=8_, _relative\_path=True_, _display\_type='DEFAULT'_, _sort\_method=''_, _filter\_glob='\*.usd'_, _scale=1.0_, _set\_frame\_range=True_, _import\_cameras=True_, _import\_curves=True_, _import\_lights=True_, _import\_materials=True_, _import\_meshes=True_, _import\_volumes=True_, _import\_shapes=True_, _import\_skeletons=True_, _import\_blendshapes=True_, _import\_points=True_, _import\_subdivision=False_, _support\_scene\_instancing=True_, _import\_visible\_only=True_, _create\_collection=False_, _read\_mesh\_uvs=True_, _read\_mesh\_colors=True_, _read\_mesh\_attributes=True_, _prim\_path\_mask=''_, _import\_guide=False_, _import\_proxy=False_, _import\_render=True_, _import\_all\_materials=False_, _import\_usd\_preview=True_, _set\_material\_blend=True_, _light\_intensity\_scale=1.0_, _mtl\_purpose='MTL\_FULL'_, _mtl\_name\_collision\_mode='MAKE\_UNIQUE'_, _import\_textures\_mode='IMPORT\_PACK'_, _import\_textures\_dir='//textures/'_, _tex\_name\_collision\_mode='USE\_EXISTING'_, _property\_import\_mode='ALL'_, _validate\_meshes=False_, _create\_world\_material=True_, _import\_defined\_only=True_, _merge\_parent\_xform=True_, _apply\_unit\_conversion\_scale=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.usd_import "Link to this definition")

Import USD stage into current scene

Parameters:

- **filepath** ( _str_) – File Path, Path to file (optional, never None)

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

- **relative\_path** ( _bool_) – Relative Path, Select the file relative to the blend file (optional)

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

- **filter\_glob** ( _str_) – (optional, never None)

- **scale** ( _float_) – Scale, Value by which to enlarge or shrink the objects with respect to the world’s origin (in \[0.0001, 1000\], optional)

- **set\_frame\_range** ( _bool_) – Set Frame Range, Update the scene’s start and end frame to match those of the USD archive (optional)

- **import\_cameras** ( _bool_) – Cameras, (optional)

- **import\_curves** ( _bool_) – Curves, (optional)

- **import\_lights** ( _bool_) – Lights, (optional)

- **import\_materials** ( _bool_) – Materials, (optional)

- **import\_meshes** ( _bool_) – Meshes, (optional)

- **import\_volumes** ( _bool_) – Volumes, (optional)

- **import\_shapes** ( _bool_) – USD Shapes, (optional)

- **import\_skeletons** ( _bool_) – Armatures, (optional)

- **import\_blendshapes** ( _bool_) – Shape Keys, (optional)

- **import\_points** ( _bool_) – Point Clouds, (optional)

- **import\_subdivision** ( _bool_) – Import Subdivision Scheme, Create subdivision surface modifiers based on the USD SubdivisionScheme attribute (optional)

- **support\_scene\_instancing** ( _bool_) – Scene Instancing, Import USD scene graph instances as collection instances (optional)

- **import\_visible\_only** ( _bool_) – Visible Primitives Only, Do not import invisible USD primitives. Only applies to primitives with a non-animated visibility attribute. Primitives with animated visibility will always be imported (optional)

- **create\_collection** ( _bool_) – Create Collection, Add all imported objects to a new collection (optional)

- **read\_mesh\_uvs** ( _bool_) – UV Coordinates, Read mesh UV coordinates (optional)

- **read\_mesh\_colors** ( _bool_) – Color Attributes, Read mesh color attributes (optional)

- **read\_mesh\_attributes** ( _bool_) – Mesh Attributes, Read USD Primvars as mesh attributes (optional)

- **prim\_path\_mask** ( _str_) – Path Mask, Import only the primitive at the given path and its descendants. Multiple paths may be specified in a list delimited by commas or semicolons (optional, never None)

- **import\_guide** ( _bool_) – Guide, Import guide geometry (optional)

- **import\_proxy** ( _bool_) – Proxy, Import proxy geometry (optional)

- **import\_render** ( _bool_) – Render, Import final render geometry (optional)

- **import\_all\_materials** ( _bool_) – Import All Materials, Also import materials that are not used by any geometry. Note that when this option is false, materials referenced by geometry will still be imported (optional)

- **import\_usd\_preview** ( _bool_) – Import USD Preview, Convert UsdPreviewSurface shaders to Principled BSDF shader networks (optional)

- **set\_material\_blend** ( _bool_) – Set Material Blend, If the Import USD Preview option is enabled, the material blend method will automatically be set based on the shader’s opacity and opacityThreshold inputs (optional)

- **light\_intensity\_scale** ( _float_) – Light Intensity Scale, Scale for the intensity of imported lights (in \[0.0001, 10000\], optional)

- **mtl\_purpose** ( _Literal_ _\[_ _'MTL\_ALL\_PURPOSE'_ _,_ _'MTL\_PREVIEW'_ _,_ _'MTL\_FULL'_ _\]_) –

Material Purpose, Attempt to import materials with the given purpose. If no material with this purpose is bound to the primitive, fall back on loading any other bound material (optional)


  - `MTL_ALL_PURPOSE`
    All Purpose – Attempt to import ‘allPurpose’ materials..

  - `MTL_PREVIEW`
    Preview – Attempt to import ‘preview’ materials. Load ‘allPurpose’ materials as a fallback.

  - `MTL_FULL`
    Full – Attempt to import ‘full’ materials. Load ‘allPurpose’ or ‘preview’ materials, in that order, as a fallback.


- **mtl\_name\_collision\_mode** ( _Literal_ _\[_ _'MAKE\_UNIQUE'_ _,_ _'REFERENCE\_EXISTING'_ _\]_) –

Material Name Collision, Behavior when the name of an imported material conflicts with an existing material (optional)


  - `MAKE_UNIQUE`
    Make Unique – Import each USD material as a unique Blender material.

  - `REFERENCE_EXISTING`
    Reference Existing – If a material with the same name already exists, reference that instead of importing.


- **import\_textures\_mode** ( _Literal_ _\[_ _'IMPORT\_NONE'_ _,_ _'IMPORT\_PACK'_ _,_ _'IMPORT\_COPY'_ _\]_) –

Import Textures, Behavior when importing textures from a USDZ archive (optional)


  - `IMPORT_NONE`
    None – Don’t import textures.

  - `IMPORT_PACK`
    Packed – Import textures as packed data.

  - `IMPORT_COPY`
    Copy – Copy files to textures directory.


- **import\_textures\_dir** ( _str_) – Textures Directory, Path to the directory where imported textures will be copied (optional, never None)

- **tex\_name\_collision\_mode** ( _Literal_ _\[_ _'USE\_EXISTING'_ _,_ _'OVERWRITE'_ _\]_) –

File Name Collision, Behavior when the name of an imported texture file conflicts with an existing file (optional)


  - `USE_EXISTING`
    Use Existing – If a file with the same name already exists, use that instead of copying.

  - `OVERWRITE`
    Overwrite – Overwrite existing files.


- **property\_import\_mode** ( _Literal_ _\[_ _'NONE'_ _,_ _'USER'_ _,_ _'ALL'_ _\]_) –

Custom Properties, Behavior when importing USD attributes as Blender custom properties (optional)


  - `NONE`
    None – Do not import USD custom attributes.

  - `USER`
    User – Import USD attributes in the ‘userProperties’ namespace as Blender custom properties. The namespace will be stripped from the property names.

  - `ALL`
    All Custom – Import all USD custom attributes as Blender custom properties. Namespaces will be retained in the property names.


- **validate\_meshes** ( _bool_) – Validate Meshes, Ensure the data is valid (when disabled, data may be imported which causes crashes displaying or editing) (optional)

- **create\_world\_material** ( _bool_) – World Dome Light, Convert the first discovered USD dome light to a world background shader (optional)

- **import\_defined\_only** ( _bool_) – Defined Primitives Only, Import only defined USD primitives. When disabled this allows importing USD primitives which are not defined, such as those with an override specifier (optional)

- **merge\_parent\_xform** ( _bool_) – Merge parent Xform, Allow USD primitives to merge with their Xform parent if they are the only child in the hierarchy (optional)

- **apply\_unit\_conversion\_scale** ( _bool_) – Apply Unit Conversion Scale, Scale the scene objects by the USD stage’s meters per unit value. This scaling is applied in addition to the value specified in the Scale option (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.window\_close() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.window_close "Link to this definition")

Close the current window

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.window\_fullscreen\_toggle() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.window_fullscreen_toggle "Link to this definition")

Toggle the current window full-screen

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.window\_new() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.window_new "Link to this definition")

Create a new window

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.window\_new\_main() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.window_new_main "Link to this definition")

Create a new main window with its own workspace and scene selection

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.xr\_navigation\_fly( _\*_, _mode='VIEWER\_FORWARD'_, _snap\_turn\_threshold=0.95_, _lock\_location\_z=False_, _lock\_direction=False_, _speed\_frame\_based=False_, _turn\_speed\_factor=0.333333_, _fly\_speed\_factor=0.333333_, _speed\_interpolation0=(0.0,0.0)_, _speed\_interpolation1=(1.0,1.0)_, _alt\_mode='VIEWER\_FORWARD'_, _alt\_lock\_location\_z=False_, _alt\_lock\_direction=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.xr_navigation_fly "Link to this definition")

Move/turn relative to the VR viewer or controller

Parameters:

- **mode** ( _Literal_ _\[_ _'FORWARD'_ _,_ _'BACK'_ _,_ _'LEFT'_ _,_ _'RIGHT'_ _,_ _'UP'_ _,_ _'DOWN'_ _,_ _'TURNLEFT'_ _,_ _'TURNRIGHT'_ _,_ _'VIEWER\_FORWARD'_ _,_ _'VIEWER\_BACK'_ _,_ _'VIEWER\_LEFT'_ _,_ _'VIEWER\_RIGHT'_ _,_ _'CONTROLLER\_FORWARD'_ _\]_) –

Mode, Fly mode (optional)


  - `FORWARD`
    Forward – Move along navigation forward axis.

  - `BACK`
    Back – Move along navigation back axis.

  - `LEFT`
    Left – Move along navigation left axis.

  - `RIGHT`
    Right – Move along navigation right axis.

  - `UP`
    Up – Move along navigation up axis.

  - `DOWN`
    Down – Move along navigation down axis.

  - `TURNLEFT`
    Turn Left – Turn counter-clockwise around navigation up axis.

  - `TURNRIGHT`
    Turn Right – Turn clockwise around navigation up axis.

  - `VIEWER_FORWARD`
    Viewer Forward – Move along viewer’s forward axis.

  - `VIEWER_BACK`
    Viewer Back – Move along viewer’s back axis.

  - `VIEWER_LEFT`
    Viewer Left – Move along viewer’s left axis.

  - `VIEWER_RIGHT`
    Viewer Right – Move along viewer’s right axis.

  - `CONTROLLER_FORWARD`
    Controller Forward – Move along controller’s forward axis.


- **snap\_turn\_threshold** ( _float_) – Snap Turn Threshold, Input state threshold when using snap turn (in \[0, 1\], optional)

- **lock\_location\_z** ( _bool_) – Lock Elevation, Prevent changes to viewer elevation (optional)

- **lock\_direction** ( _bool_) – Lock Direction, Limit movement to viewer’s initial direction (optional)

- **speed\_frame\_based** ( _bool_) – Frame Based Speed, Apply fixed movement deltas every update (optional)

- **turn\_speed\_factor** ( _float_) – Turn Speed Factor, Ratio between the min and max turn speed (in \[0, 1\], optional)

- **fly\_speed\_factor** ( _float_) – Fly Speed Factor, Ratio between the min and max fly speed (in \[0, 1\], optional)

- **speed\_interpolation0** ( [`mathutils.Vector`](https://docs.blender.org/api/5.2/mathutils.html#mathutils.Vector "mathutils.Vector") \| Sequence\[float\]) – Speed Interpolation 0, First cubic spline control point between min/max speeds (array of 2 items, in \[0, 1\], optional)

- **speed\_interpolation1** ( [`mathutils.Vector`](https://docs.blender.org/api/5.2/mathutils.html#mathutils.Vector "mathutils.Vector") \| Sequence\[float\]) – Speed Interpolation 1, Second cubic spline control point between min/max speeds (array of 2 items, in \[0, 1\], optional)

- **alt\_mode** ( _Literal_ _\[_ _'FORWARD'_ _,_ _'BACK'_ _,_ _'LEFT'_ _,_ _'RIGHT'_ _,_ _'UP'_ _,_ _'DOWN'_ _,_ _'TURNLEFT'_ _,_ _'TURNRIGHT'_ _,_ _'VIEWER\_FORWARD'_ _,_ _'VIEWER\_BACK'_ _,_ _'VIEWER\_LEFT'_ _,_ _'VIEWER\_RIGHT'_ _,_ _'CONTROLLER\_FORWARD'_ _\]_) –

Mode (Alt), Fly mode when hands are swapped (optional)


  - `FORWARD`
    Forward – Move along navigation forward axis.

  - `BACK`
    Back – Move along navigation back axis.

  - `LEFT`
    Left – Move along navigation left axis.

  - `RIGHT`
    Right – Move along navigation right axis.

  - `UP`
    Up – Move along navigation up axis.

  - `DOWN`
    Down – Move along navigation down axis.

  - `TURNLEFT`
    Turn Left – Turn counter-clockwise around navigation up axis.

  - `TURNRIGHT`
    Turn Right – Turn clockwise around navigation up axis.

  - `VIEWER_FORWARD`
    Viewer Forward – Move along viewer’s forward axis.

  - `VIEWER_BACK`
    Viewer Back – Move along viewer’s back axis.

  - `VIEWER_LEFT`
    Viewer Left – Move along viewer’s left axis.

  - `VIEWER_RIGHT`
    Viewer Right – Move along viewer’s right axis.

  - `CONTROLLER_FORWARD`
    Controller Forward – Move along controller’s forward axis.


- **alt\_lock\_location\_z** ( _bool_) – Lock Elevation (Alt), When hands are swapped, prevent changes to viewer elevation (optional)

- **alt\_lock\_direction** ( _bool_) – Lock Direction (Alt), When hands are swapped, limit movement to viewer’s initial direction (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.xr\_navigation\_grab( _\*_, _lock\_location=False_, _lock\_location\_z=False_, _lock\_rotation=False_, _lock\_rotation\_z=False_, _lock\_scale=False_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.xr_navigation_grab "Link to this definition")

Navigate the VR scene by grabbing with controllers

Parameters:

- **lock\_location** ( _bool_) – Lock Location, Prevent changes to viewer location (optional)

- **lock\_location\_z** ( _bool_) – Lock Elevation, Prevent changes to viewer elevation (optional)

- **lock\_rotation** ( _bool_) – Lock Rotation, Prevent changes to viewer rotation (optional)

- **lock\_rotation\_z** ( _bool_) – Lock Up Orientation, Prevent changes to viewer up orientation (optional)

- **lock\_scale** ( _bool_) – Lock Scale, Prevent changes to viewer scale (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.xr\_navigation\_reset( _\*_, _location=True_, _rotation=True_, _scale=True_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.xr_navigation_reset "Link to this definition")

Reset VR navigation deltas relative to session base pose

Parameters:

- **location** ( _bool_) – Location, Reset location deltas (optional)

- **rotation** ( _bool_) – Rotation, Reset rotation deltas (optional)

- **scale** ( _bool_) – Scale, Reset scale deltas (optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.xr\_navigation\_swap\_hands() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.xr_navigation_swap_hands "Link to this definition")

Swap VR navigation controls between left / right controllers

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.xr\_navigation\_teleport( _\*_, _selectable\_only=True_, _force=8.5_, _range=0.15_, _ray\_line\_width=6.0_, _destination\_indicator\_width=0.18_, _hit\_color=(0.4,0.6,0.9,1.0)_, _miss\_color=(1.0,0.35,0.35,1.0)_, _fallback\_color=(0.5,0.45,0.8,1.0)_) [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.xr_navigation_teleport "Link to this definition")

Set VR viewer location to controller raycast hit location

Parameters:

- **selectable\_only** ( _bool_) – Selectable Only, Only allow selectable objects to influence raycast result (optional)

- **force** ( _float_) – Force, Velocity force controlling the teleportation arc parabola in m/s (in \[0, inf\], optional)

- **range** ( _float_) – Range, Time step range controlling the teleportation arc parabola (in \[0, inf\], optional)

- **ray\_line\_width** ( _float_) – Ray Line Width, Visual width of the teleportation ray line (in \[0, inf\], optional)

- **destination\_indicator\_width** ( _float_) – Destination Indicator Width, Visual width of the hit destination indicator (in \[0, inf\], optional)

- **hit\_color** ( _Sequence_ _\[_ _float_ _\]_) – Hit Color, Color of raycast when it succeeds (array of 4 items, in \[0, 1\], optional)

- **miss\_color** ( _Sequence_ _\[_ _float_ _\]_) – Miss Color, Color of raycast when it misses (array of 4 items, in \[0, 1\], optional)

- **fallback\_color** ( _Sequence_ _\[_ _float_ _\]_) – Fallback Color, Color of raycast when a fallback case succeeds (array of 4 items, in \[0, 1\], optional)


Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]

bpy.ops.wm.xr\_session\_toggle() [¶](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.xr_session_toggle "Link to this definition")

Open a view for use with virtual reality headsets, or close it if already opened

Returns:

Result of the operator call.

Return type:

set\[Literal\[ [Operator Return Items](https://docs.blender.org/api/5.2/bpy_types_enum_items/operator_return_items.html#rna-enum-operator-return-items)\]\]