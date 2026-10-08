[Join the **official Blender Survey 2026**! 🧡](https://www.blender.org/news/blender-survey-2026/)

ContentsMenuExpandLight modeDark modeAuto light/dark, in light modeAuto light/dark, in dark mode[Skip to content](https://docs.blender.org/api/current/bpy.types.Curves.html#furo-main-content)

[Back to top](https://docs.blender.org/api/current/bpy.types.Curves.html#)

# Curves(ID) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html\#curves-id "Link to this heading")

base classes — [`bpy_struct`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct "bpy.types.bpy_struct"), [`ID`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID "bpy.types.ID")

classbpy.types.Curves( _ID_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves "Link to this definition")

Hair data-block for hair curves

animation\_data [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.animation_data "Link to this definition")

Animation data for this data-block (readonly)

Type:

[`AnimData`](https://docs.blender.org/api/current/bpy.types.AnimData.html#bpy.types.AnimData "bpy.types.AnimData") \| None

attributes [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.attributes "Link to this definition")

Geometry attributes (default None, readonly)

Type:

[`AttributeGroupCurves`](https://docs.blender.org/api/current/bpy.types.AttributeGroupCurves.html#bpy.types.AttributeGroupCurves "bpy.types.AttributeGroupCurves")\[ [`Attribute`](https://docs.blender.org/api/current/bpy.types.Attribute.html#bpy.types.Attribute "bpy.types.Attribute")\]

color\_attributes [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.color_attributes "Link to this definition")

Geometry color attributes (default None, readonly)

Type:

[`AttributeGroupCurves`](https://docs.blender.org/api/current/bpy.types.AttributeGroupCurves.html#bpy.types.AttributeGroupCurves "bpy.types.AttributeGroupCurves")\[ [`Attribute`](https://docs.blender.org/api/current/bpy.types.Attribute.html#bpy.types.Attribute "bpy.types.Attribute")\]

curve\_offset\_data [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.curve_offset_data "Link to this definition")

(default None, readonly)

Type:

[`bpy_prop_collection`](https://docs.blender.org/api/current/bpy.types.bpy_prop_collection.html#bpy.types.bpy_prop_collection "bpy.types.bpy_prop_collection")\[ [`IntAttributeValue`](https://docs.blender.org/api/current/bpy.types.IntAttributeValue.html#bpy.types.IntAttributeValue "bpy.types.IntAttributeValue")\]

curves [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.curves "Link to this definition")

All curves in the data-block (default None, readonly)

Type:

[`bpy_prop_collection`](https://docs.blender.org/api/current/bpy.types.bpy_prop_collection.html#bpy.types.bpy_prop_collection "bpy.types.bpy_prop_collection")\[ [`CurveSlice`](https://docs.blender.org/api/current/bpy.types.CurveSlice.html#bpy.types.CurveSlice "bpy.types.CurveSlice")\]

materials [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.materials "Link to this definition")

(default None, readonly)

Type:

[`IDMaterials`](https://docs.blender.org/api/current/bpy.types.IDMaterials.html#bpy.types.IDMaterials "bpy.types.IDMaterials")\[ [`Material`](https://docs.blender.org/api/current/bpy.types.Material.html#bpy.types.Material "bpy.types.Material")\]

normals [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.normals "Link to this definition")

The curve normal value at each of the curve’s control points (default None, readonly)

Type:

[`bpy_prop_collection`](https://docs.blender.org/api/current/bpy.types.bpy_prop_collection.html#bpy.types.bpy_prop_collection "bpy.types.bpy_prop_collection")\[ [`FloatVectorValueReadOnly`](https://docs.blender.org/api/current/bpy.types.FloatVectorValueReadOnly.html#bpy.types.FloatVectorValueReadOnly "bpy.types.FloatVectorValueReadOnly")\]

points [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.points "Link to this definition")

Control points of all curves (default None, readonly)

Type:

[`bpy_prop_collection`](https://docs.blender.org/api/current/bpy.types.bpy_prop_collection.html#bpy.types.bpy_prop_collection "bpy.types.bpy_prop_collection")\[ [`CurvePoint`](https://docs.blender.org/api/current/bpy.types.CurvePoint.html#bpy.types.CurvePoint "bpy.types.CurvePoint")\]

position\_data [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.position_data "Link to this definition")

(default None, readonly)

Type:

[`bpy_prop_collection`](https://docs.blender.org/api/current/bpy.types.bpy_prop_collection.html#bpy.types.bpy_prop_collection "bpy.types.bpy_prop_collection")\[ [`FloatVectorAttributeValue`](https://docs.blender.org/api/current/bpy.types.FloatVectorAttributeValue.html#bpy.types.FloatVectorAttributeValue "bpy.types.FloatVectorAttributeValue")\]

selection\_domain [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.selection_domain "Link to this definition")

(default `'POINT'`)

Type:

Literal\[ [Attribute Curves Domain Items](https://docs.blender.org/api/current/bpy_types_enum_items/attribute_curves_domain_items.html#rna-enum-attribute-curves-domain-items)\]

surface [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.surface "Link to this definition")

Mesh object that the curves can be attached to

Type:

[`Object`](https://docs.blender.org/api/current/bpy.types.Object.html#bpy.types.Object "bpy.types.Object") \| None

surface\_collision\_distance [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.surface_collision_distance "Link to this definition")

Distance to keep the curves away from the surface (in \[1.192e-07, inf\], default 0.005)

Type:

float

surface\_uv\_map [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.surface_uv_map "Link to this definition")

The name of the attribute on the surface mesh used to define the attachment of each curve (default “”, never None)

Type:

str

use\_mirror\_x [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.use_mirror_x "Link to this definition")

Enable symmetry in the X axis (default False)

Type:

bool

use\_mirror\_y [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.use_mirror_y "Link to this definition")

Enable symmetry in the Y axis (default False)

Type:

bool

use\_mirror\_z [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.use_mirror_z "Link to this definition")

Enable symmetry in the Z axis (default False)

Type:

bool

use\_sculpt\_collision [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.use_sculpt_collision "Link to this definition")

Enable collision with the surface while sculpting (default False)

Type:

bool

add\_curves( _sizes_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.add_curves "Link to this definition")

add\_curves

Parameters:

**sizes** ( _Sequence_ _\[_ _int_ _\]_) – Sizes, The number of points in each curve (array of 1 items, in \[0, inf\])

remove\_curves( _\*_, _indices=(0,)_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.remove_curves "Link to this definition")

Remove all curves. If indices are provided, remove only the curves with the given indices.

Parameters:

**indices** ( _Sequence_ _\[_ _int_ _\]_) – Indices, The indices of the curves to remove (array of 1 items, in \[0, inf\], optional)

resize\_curves( _sizes_, _\*_, _indices=(0,)_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.resize_curves "Link to this definition")

Resize all existing curves. If indices are provided, resize only the curves with the given indices. If the new size for a curve is smaller, the curve is trimmed. If the new size for a curve is larger, the new end values are default initialized.

Parameters:

- **sizes** ( _Sequence_ _\[_ _int_ _\]_) – Sizes, The number of points in each curve (array of 1 items, in \[1, inf\])

- **indices** ( _Sequence_ _\[_ _int_ _\]_) – Indices, The indices of the curves to resize (array of 1 items, in \[0, inf\], optional)


reorder\_curves( _new\_indices_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.reorder_curves "Link to this definition")

Reorder the curves by the new indices.

Parameters:

**new\_indices** ( _Sequence_ _\[_ _int_ _\]_) – New indices, The new index for each of the curves (array of 1 items, in \[0, inf\])

set\_types( _\*_, _type='CATMULL\_ROM'_, _indices=(0,)_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.set_types "Link to this definition")

Set the curve type. If indices are provided, set only the types with the given curve indices.

Parameters:

- **type** (Literal\[ [Curves Type Items](https://docs.blender.org/api/current/bpy_types_enum_items/curves_type_items.html#rna-enum-curves-type-items)\]) – Type, (optional)

- **indices** ( _Sequence_ _\[_ _int_ _\]_) – Indices, The indices of the curves to resize (array of 1 items, in \[0, inf\], optional)


unit\_test\_compare( _\*_, _curves=None_, _threshold=7.1526e-06_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.unit_test_compare "Link to this definition")

unit\_test\_compare

Parameters:

- **curves** ( [`Curves`](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves "bpy.types.Curves") \| None) – Curves to compare to (optional)

- **threshold** ( _float_) – Threshold, Comparison tolerance threshold (in \[0, inf\], optional)


Returns:

Return value, String description of result of comparison (never None)

Return type:

str

classmethodbl\_rna\_get\_subclass( _id_, _default=None_, _/_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.bl_rna_get_subclass "Link to this definition")Parameters:

- **id** ( _str_) – The RNA type identifier.

- **default** ( [`bpy.types.Struct`](https://docs.blender.org/api/current/bpy.types.Struct.html#bpy.types.Struct "bpy.types.Struct") \| None) – The value to return when not found.


Returns:

The RNA type or default when not found.

Return type:

[`bpy.types.Struct`](https://docs.blender.org/api/current/bpy.types.Struct.html#bpy.types.Struct "bpy.types.Struct")

classmethodbl\_rna\_get\_subclass\_py( _id_, _default=None_, _/_) [¶](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.bl_rna_get_subclass_py "Link to this definition")Parameters:

- **id** ( _str_) – The RNA type identifier.

- **default** ( _type_ _\|_ _None_) – The value to return when not found.


Returns:

The class or default when not found.

Return type:

type

## Inherited Properties [¶](https://docs.blender.org/api/current/bpy.types.Curves.html\#inherited-properties "Link to this heading")

|     |     |
| --- | --- |
| - [`bpy_struct.id_data`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_data "bpy.types.bpy_struct.id_data")<br>  <br>- [`ID.name`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.name "bpy.types.ID.name")<br>  <br>- [`ID.name_full`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.name_full "bpy.types.ID.name_full")<br>  <br>- [`ID.id_type`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.id_type "bpy.types.ID.id_type")<br>  <br>- [`ID.session_uid`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.session_uid "bpy.types.ID.session_uid")<br>  <br>- [`ID.is_evaluated`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_evaluated "bpy.types.ID.is_evaluated")<br>  <br>- [`ID.original`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.original "bpy.types.ID.original")<br>  <br>- [`ID.users`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.users "bpy.types.ID.users")<br>  <br>- [`ID.use_fake_user`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.use_fake_user "bpy.types.ID.use_fake_user")<br>  <br>- [`ID.use_extra_user`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.use_extra_user "bpy.types.ID.use_extra_user")<br>  <br>- [`ID.is_embedded_data`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_embedded_data "bpy.types.ID.is_embedded_data") | - [`ID.is_linked_packed`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_linked_packed "bpy.types.ID.is_linked_packed")<br>  <br>- [`ID.is_missing`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_missing "bpy.types.ID.is_missing")<br>  <br>- [`ID.is_runtime_data`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_runtime_data "bpy.types.ID.is_runtime_data")<br>  <br>- [`ID.is_editable`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_editable "bpy.types.ID.is_editable")<br>  <br>- [`ID.tag`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.tag "bpy.types.ID.tag")<br>  <br>- [`ID.is_library_indirect`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_library_indirect "bpy.types.ID.is_library_indirect")<br>  <br>- [`ID.library`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.library "bpy.types.ID.library")<br>  <br>- [`ID.library_weak_reference`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.library_weak_reference "bpy.types.ID.library_weak_reference")<br>  <br>- [`ID.asset_data`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_data "bpy.types.ID.asset_data")<br>  <br>- [`ID.override_library`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.override_library "bpy.types.ID.override_library")<br>  <br>- [`ID.preview`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.preview "bpy.types.ID.preview") |

## Inherited Functions [¶](https://docs.blender.org/api/current/bpy.types.Curves.html\#inherited-functions "Link to this heading")

|     |     |
| --- | --- |
| - [`bpy_struct.as_pointer`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.as_pointer "bpy.types.bpy_struct.as_pointer")<br>  <br>- [`bpy_struct.driver_add`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.driver_add "bpy.types.bpy_struct.driver_add")<br>  <br>- [`bpy_struct.driver_remove`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.driver_remove "bpy.types.bpy_struct.driver_remove")<br>  <br>- [`bpy_struct.get`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.get "bpy.types.bpy_struct.get")<br>  <br>- [`bpy_struct.id_properties_clear`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_clear "bpy.types.bpy_struct.id_properties_clear")<br>  <br>- [`bpy_struct.id_properties_ensure`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_ensure "bpy.types.bpy_struct.id_properties_ensure")<br>  <br>- [`bpy_struct.id_properties_ui`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_ui "bpy.types.bpy_struct.id_properties_ui")<br>  <br>- [`bpy_struct.is_property_hidden`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_hidden "bpy.types.bpy_struct.is_property_hidden")<br>  <br>- [`bpy_struct.is_property_overridable_library`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_overridable_library "bpy.types.bpy_struct.is_property_overridable_library")<br>  <br>- [`bpy_struct.is_property_readonly`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_readonly "bpy.types.bpy_struct.is_property_readonly")<br>  <br>- [`bpy_struct.is_property_set`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_set "bpy.types.bpy_struct.is_property_set")<br>  <br>- [`bpy_struct.items`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.items "bpy.types.bpy_struct.items")<br>  <br>- [`bpy_struct.keyframe_delete`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keyframe_delete "bpy.types.bpy_struct.keyframe_delete")<br>  <br>- [`bpy_struct.keyframe_insert`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keyframe_insert "bpy.types.bpy_struct.keyframe_insert")<br>  <br>- [`bpy_struct.keys`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keys "bpy.types.bpy_struct.keys")<br>  <br>- [`bpy_struct.path_from_id`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_from_id "bpy.types.bpy_struct.path_from_id")<br>  <br>- [`bpy_struct.path_from_module`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_from_module "bpy.types.bpy_struct.path_from_module")<br>  <br>- [`bpy_struct.path_resolve`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_resolve "bpy.types.bpy_struct.path_resolve")<br>  <br>- [`bpy_struct.pop`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.pop "bpy.types.bpy_struct.pop")<br>  <br>- [`bpy_struct.property_overridable_library_set`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.property_overridable_library_set "bpy.types.bpy_struct.property_overridable_library_set")<br>  <br>- [`bpy_struct.property_unset`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.property_unset "bpy.types.bpy_struct.property_unset")<br>  <br>- [`bpy_struct.rna_ancestors`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.rna_ancestors "bpy.types.bpy_struct.rna_ancestors") | - [`bpy_struct.type_recast`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.type_recast "bpy.types.bpy_struct.type_recast")<br>  <br>- [`bpy_struct.values`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.values "bpy.types.bpy_struct.values")<br>  <br>- [`ID.bl_system_properties_get`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.bl_system_properties_get "bpy.types.ID.bl_system_properties_get")<br>  <br>- [`ID.rename`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.rename "bpy.types.ID.rename")<br>  <br>- [`ID.evaluated_get`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.evaluated_get "bpy.types.ID.evaluated_get")<br>  <br>- [`ID.copy`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.copy "bpy.types.ID.copy")<br>  <br>- [`ID.asset_mark`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_mark "bpy.types.ID.asset_mark")<br>  <br>- [`ID.asset_clear`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_clear "bpy.types.ID.asset_clear")<br>  <br>- [`ID.asset_generate_preview`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_generate_preview "bpy.types.ID.asset_generate_preview")<br>  <br>- [`ID.override_create`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.override_create "bpy.types.ID.override_create")<br>  <br>- [`ID.override_hierarchy_create`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.override_hierarchy_create "bpy.types.ID.override_hierarchy_create")<br>  <br>- [`ID.user_clear`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.user_clear "bpy.types.ID.user_clear")<br>  <br>- [`ID.user_remap`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.user_remap "bpy.types.ID.user_remap")<br>  <br>- [`ID.make_local`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.make_local "bpy.types.ID.make_local")<br>  <br>- [`ID.user_of_id`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.user_of_id "bpy.types.ID.user_of_id")<br>  <br>- [`ID.animation_data_create`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.animation_data_create "bpy.types.ID.animation_data_create")<br>  <br>- [`ID.animation_data_clear`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.animation_data_clear "bpy.types.ID.animation_data_clear")<br>  <br>- [`ID.update_tag`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.update_tag "bpy.types.ID.update_tag")<br>  <br>- [`ID.preview_ensure`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.preview_ensure "bpy.types.ID.preview_ensure")<br>  <br>- [`ID.bl_rna_get_subclass`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.bl_rna_get_subclass "bpy.types.ID.bl_rna_get_subclass")<br>  <br>- [`ID.bl_rna_get_subclass_py`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.bl_rna_get_subclass_py "bpy.types.ID.bl_rna_get_subclass_py") |

## References [¶](https://docs.blender.org/api/current/bpy.types.Curves.html\#references "Link to this heading")

|     |     |
| --- | --- |
| - `bpy.context.curves`<br>  <br>- [`BlendData.hair_curves`](https://docs.blender.org/api/current/bpy.types.BlendData.html#bpy.types.BlendData.hair_curves "bpy.types.BlendData.hair_curves")<br>  <br>- [`BlendDataHairCurves.new`](https://docs.blender.org/api/current/bpy.types.BlendDataHairCurves.html#bpy.types.BlendDataHairCurves.new "bpy.types.BlendDataHairCurves.new") | - [`BlendDataHairCurves.remove`](https://docs.blender.org/api/current/bpy.types.BlendDataHairCurves.html#bpy.types.BlendDataHairCurves.remove "bpy.types.BlendDataHairCurves.remove")<br>  <br>- [`Curves.unit_test_compare`](https://docs.blender.org/api/current/bpy.types.Curves.html#bpy.types.Curves.unit_test_compare "bpy.types.Curves.unit_test_compare") |
