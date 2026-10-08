[Join the **official Blender Survey 2026**! 🧡](https://www.blender.org/news/blender-survey-2026/)

ContentsMenuExpandLight modeDark modeAuto light/dark, in light modeAuto light/dark, in dark mode[Skip to content](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#furo-main-content)

[Back to top](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#)

# SplinePoint(bpy\_struct) [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html\#splinepoint-bpy-struct "Link to this heading")

base class — [`bpy_struct`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct "bpy.types.bpy_struct")

classbpy.types.SplinePoint( _bpy\_struct_) [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint "Link to this definition")

Spline point without handles

co [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.co "Link to this definition")

Point coordinates (array of 4 items, in \[-inf, inf\], default (0.0, 0.0, 0.0, 0.0))

Type:

[`mathutils.Vector`](https://docs.blender.org/api/current/mathutils.html#mathutils.Vector "mathutils.Vector")

hide [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.hide "Link to this definition")

Visibility status (default False)

Type:

bool

radius [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.radius "Link to this definition")

Radius for beveling (in \[0, inf\], default 0.0)

Type:

float

select [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.select "Link to this definition")

Selection status (default False)

Type:

bool

tilt [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.tilt "Link to this definition")

Tilt in 3D View (in \[-376.991, 376.991\], default 0.0)

Type:

float

weight [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.weight "Link to this definition")

NURBS weight (in \[-inf, inf\], default 0.0)

Type:

float

weight\_softbody [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.weight_softbody "Link to this definition")

Softbody goal weight (in \[0.01, 100\], default 0.0)

Type:

float

classmethodbl\_rna\_get\_subclass( _id_, _default=None_, _/_) [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.bl_rna_get_subclass "Link to this definition")Parameters:

- **id** ( _str_) – The RNA type identifier.

- **default** ( [`bpy.types.Struct`](https://docs.blender.org/api/current/bpy.types.Struct.html#bpy.types.Struct "bpy.types.Struct") \| None) – The value to return when not found.


Returns:

The RNA type or default when not found.

Return type:

[`bpy.types.Struct`](https://docs.blender.org/api/current/bpy.types.Struct.html#bpy.types.Struct "bpy.types.Struct")

classmethodbl\_rna\_get\_subclass\_py( _id_, _default=None_, _/_) [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html#bpy.types.SplinePoint.bl_rna_get_subclass_py "Link to this definition")Parameters:

- **id** ( _str_) – The RNA type identifier.

- **default** ( _type_ _\|_ _None_) – The value to return when not found.


Returns:

The class or default when not found.

Return type:

type

## Inherited Properties [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html\#inherited-properties "Link to this heading")

|     |     |
| --- | --- |
| - [`bpy_struct.id_data`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_data "bpy.types.bpy_struct.id_data") |  |

## Inherited Functions [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html\#inherited-functions "Link to this heading")

|     |     |
| --- | --- |
| - [`bpy_struct.as_pointer`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.as_pointer "bpy.types.bpy_struct.as_pointer")<br>  <br>- [`bpy_struct.driver_add`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.driver_add "bpy.types.bpy_struct.driver_add")<br>  <br>- [`bpy_struct.driver_remove`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.driver_remove "bpy.types.bpy_struct.driver_remove")<br>  <br>- [`bpy_struct.get`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.get "bpy.types.bpy_struct.get")<br>  <br>- [`bpy_struct.id_properties_clear`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_clear "bpy.types.bpy_struct.id_properties_clear")<br>  <br>- [`bpy_struct.id_properties_ensure`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_ensure "bpy.types.bpy_struct.id_properties_ensure")<br>  <br>- [`bpy_struct.id_properties_ui`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_ui "bpy.types.bpy_struct.id_properties_ui")<br>  <br>- [`bpy_struct.is_property_hidden`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_hidden "bpy.types.bpy_struct.is_property_hidden")<br>  <br>- [`bpy_struct.is_property_overridable_library`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_overridable_library "bpy.types.bpy_struct.is_property_overridable_library")<br>  <br>- [`bpy_struct.is_property_readonly`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_readonly "bpy.types.bpy_struct.is_property_readonly")<br>  <br>- [`bpy_struct.is_property_set`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_set "bpy.types.bpy_struct.is_property_set")<br>  <br>- [`bpy_struct.items`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.items "bpy.types.bpy_struct.items") | - [`bpy_struct.keyframe_delete`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keyframe_delete "bpy.types.bpy_struct.keyframe_delete")<br>  <br>- [`bpy_struct.keyframe_insert`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keyframe_insert "bpy.types.bpy_struct.keyframe_insert")<br>  <br>- [`bpy_struct.keys`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keys "bpy.types.bpy_struct.keys")<br>  <br>- [`bpy_struct.path_from_id`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_from_id "bpy.types.bpy_struct.path_from_id")<br>  <br>- [`bpy_struct.path_from_module`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_from_module "bpy.types.bpy_struct.path_from_module")<br>  <br>- [`bpy_struct.path_resolve`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_resolve "bpy.types.bpy_struct.path_resolve")<br>  <br>- [`bpy_struct.pop`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.pop "bpy.types.bpy_struct.pop")<br>  <br>- [`bpy_struct.property_overridable_library_set`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.property_overridable_library_set "bpy.types.bpy_struct.property_overridable_library_set")<br>  <br>- [`bpy_struct.property_unset`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.property_unset "bpy.types.bpy_struct.property_unset")<br>  <br>- [`bpy_struct.rna_ancestors`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.rna_ancestors "bpy.types.bpy_struct.rna_ancestors")<br>  <br>- [`bpy_struct.type_recast`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.type_recast "bpy.types.bpy_struct.type_recast")<br>  <br>- [`bpy_struct.values`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.values "bpy.types.bpy_struct.values") |

## References [¶](https://docs.blender.org/api/current/bpy.types.SplinePoint.html\#references "Link to this heading")

|     |     |
| --- | --- |
| - [`Spline.points`](https://docs.blender.org/api/current/bpy.types.Spline.html#bpy.types.Spline.points "bpy.types.Spline.points") |  |
