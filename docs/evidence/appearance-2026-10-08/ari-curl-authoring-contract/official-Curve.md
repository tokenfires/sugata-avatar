[Join the **official Blender Survey 2026**! 🧡](https://www.blender.org/news/blender-survey-2026/)

ContentsMenuExpandLight modeDark modeAuto light/dark, in light modeAuto light/dark, in dark mode[Skip to content](https://docs.blender.org/api/current/bpy.types.Curve.html#furo-main-content)

[Back to top](https://docs.blender.org/api/current/bpy.types.Curve.html#)

# Curve(ID) [¶](https://docs.blender.org/api/current/bpy.types.Curve.html\#curve-id "Link to this heading")

base classes — [`bpy_struct`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct "bpy.types.bpy_struct"), [`ID`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID "bpy.types.ID")

Subclasses

- [SurfaceCurve(Curve)](https://docs.blender.org/api/current/bpy.types.SurfaceCurve.html)
- [TextCurve(Curve)](https://docs.blender.org/api/current/bpy.types.TextCurve.html)

classbpy.types.Curve( _ID_) [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve "Link to this definition")

Curve data-block storing curves, splines and NURBS

animation\_data [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.animation_data "Link to this definition")

Animation data for this data-block (readonly)

Type:

[`AnimData`](https://docs.blender.org/api/current/bpy.types.AnimData.html#bpy.types.AnimData "bpy.types.AnimData") \| None

bevel\_depth [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_depth "Link to this definition")

Radius of the bevel geometry, not including extrusion (in \[-inf, inf\], default 0.0)

Type:

float

bevel\_factor\_end [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_factor_end "Link to this definition")

Define where along the spline the curve geometry ends (0 for the beginning, 1 for the end) (in \[0, 1\], default 1.0)

Type:

float

bevel\_factor\_mapping\_end [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_factor_mapping_end "Link to this definition")

Determine how the geometry end factor is mapped to a spline (default `'RESOLUTION'`)

- `RESOLUTION`
Resolution – Map the geometry factor to the number of subdivisions of a spline (U resolution).

- `SEGMENTS`
Segments – Map the geometry factor to the length of a segment and to the number of subdivisions of a segment.

- `SPLINE`
Spline – Map the geometry factor to the length of a spline.


Type:

Literal\[‘RESOLUTION’, ‘SEGMENTS’, ‘SPLINE’\]

bevel\_factor\_mapping\_start [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_factor_mapping_start "Link to this definition")

Determine how the geometry start factor is mapped to a spline (default `'RESOLUTION'`)

- `RESOLUTION`
Resolution – Map the geometry factor to the number of subdivisions of a spline (U resolution).

- `SEGMENTS`
Segments – Map the geometry factor to the length of a segment and to the number of subdivisions of a segment.

- `SPLINE`
Spline – Map the geometry factor to the length of a spline.


Type:

Literal\[‘RESOLUTION’, ‘SEGMENTS’, ‘SPLINE’\]

bevel\_factor\_start [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_factor_start "Link to this definition")

Define where along the spline the curve geometry starts (0 for the beginning, 1 for the end) (in \[0, 1\], default 0.0)

Type:

float

bevel\_mode [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_mode "Link to this definition")

Determine how to build the curve’s bevel geometry (default `'ROUND'`)

- `ROUND`
Round – Use circle for the section of the curve’s bevel geometry.

- `OBJECT`
Object – Use an object for the section of the curve’s bevel geometry segment.

- `PROFILE`
Profile – Use a custom profile for each quarter of curve’s bevel geometry.


Type:

Literal\[‘ROUND’, ‘OBJECT’, ‘PROFILE’\]

bevel\_object [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_object "Link to this definition")

The name of the Curve object that defines the bevel shape

Type:

[`Object`](https://docs.blender.org/api/current/bpy.types.Object.html#bpy.types.Object "bpy.types.Object") \| None

bevel\_profile [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_profile "Link to this definition")

The path for the curve’s custom profile (readonly)

Type:

[`CurveProfile`](https://docs.blender.org/api/current/bpy.types.CurveProfile.html#bpy.types.CurveProfile "bpy.types.CurveProfile") \| None

bevel\_resolution [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bevel_resolution "Link to this definition")

The number of segments in each quarter-circle of the bevel (in \[0, 32\], default 4)

Type:

int

cycles [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.cycles "Link to this definition")

Cycles mesh settings (readonly)

Type:

`CyclesMeshSettings` \| None

dimensions [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.dimensions "Link to this definition")

Select 2D or 3D curve type (default `'2D'`)

- `2D`
2D – Clamp the Z axis of the curve.

- `3D`
3D – Allow editing on the Z axis of this curve, also allows tilt and curve radius to be used.


Type:

Literal\[‘2D’, ‘3D’\]

eval\_time [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.eval_time "Link to this definition")

Parametric position along the length of the curve that Objects ‘following’ it should be at (position is evaluated by dividing by the ‘Path Length’ value) (in \[-inf, inf\], default 0.0)

Type:

float

extrude [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.extrude "Link to this definition")

Length of the depth added in the local Z direction along the curve, perpendicular to its normals (in \[0, inf\], default 0.0)

Type:

float

fill\_mode [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.fill_mode "Link to this definition")

Mode of filling curve (default `'FULL'`)

Type:

Literal\[‘FULL’, ‘BACK’, ‘FRONT’, ‘HALF’\]

fill\_rule [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.fill_rule "Link to this definition")

Fill rule for Delaunay fill solver (default `'EVEN_ODD'`)

- `EVEN_ODD`
Even-Odd – Alternate inside/outside based on crossing count.

- `NONZERO`
Non-Zero – Overlapping curves with the same winding direction are filled as a union.


Type:

Literal\[‘EVEN\_ODD’, ‘NONZERO’\]

fill\_solver [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.fill_solver "Link to this definition")

Triangulation solver for filling 2D curves (default `'SWEEP_LINE'`)

- `SWEEP_LINE`
Sweep Line – Fast without support for self-intersection.

- `CDT`
Delaunay – Constrained Delaunay Triangulation (CDT), robust with support for self-intersections.


Type:

Literal\[‘SWEEP\_LINE’, ‘CDT’\]

is\_editmode [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.is_editmode "Link to this definition")

True when used in editmode (default False, readonly)

Type:

bool

materials [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.materials "Link to this definition")

(default None, readonly)

Type:

[`IDMaterials`](https://docs.blender.org/api/current/bpy.types.IDMaterials.html#bpy.types.IDMaterials "bpy.types.IDMaterials")\[ [`Material`](https://docs.blender.org/api/current/bpy.types.Material.html#bpy.types.Material "bpy.types.Material")\]

offset [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.offset "Link to this definition")

Distance to move the curve parallel to its normals (in \[-inf, inf\], default 0.0)

Type:

float

path\_duration [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.path_duration "Link to this definition")

The number of frames that are needed to traverse the path, defining the maximum value for the ‘Evaluation Time’ setting (in \[1, 1048574\], default 100)

Type:

int

render\_resolution\_u [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.render_resolution_u "Link to this definition")

Surface resolution in U direction used while rendering (zero uses preview resolution) (in \[0, 1024\], default 0)

Type:

int

render\_resolution\_v [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.render_resolution_v "Link to this definition")

Surface resolution in V direction used while rendering (zero uses preview resolution) (in \[0, 1024\], default 0)

Type:

int

resolution\_u [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.resolution_u "Link to this definition")

Number of computed points in the U direction between every pair of control points (in \[1, 1024\], default 12)

Type:

int

resolution\_v [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.resolution_v "Link to this definition")

The number of computed points in the V direction between every pair of control points (in \[1, 1024\], default 12)

Type:

int

shape\_keys [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.shape_keys "Link to this definition")

(readonly)

Type:

[`Key`](https://docs.blender.org/api/current/bpy.types.Key.html#bpy.types.Key "bpy.types.Key") \| None

splines [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.splines "Link to this definition")

Collection of splines in this curve data object (default None, readonly)

Type:

[`CurveSplines`](https://docs.blender.org/api/current/bpy.types.CurveSplines.html#bpy.types.CurveSplines "bpy.types.CurveSplines")\[ [`Spline`](https://docs.blender.org/api/current/bpy.types.Spline.html#bpy.types.Spline "bpy.types.Spline")\]

taper\_object [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.taper_object "Link to this definition")

Curve object name that defines the taper (width)

Type:

[`Object`](https://docs.blender.org/api/current/bpy.types.Object.html#bpy.types.Object "bpy.types.Object") \| None

taper\_radius\_mode [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.taper_radius_mode "Link to this definition")

Determine how the effective radius of the spline point is computed when a taper object is specified (default `'OVERRIDE'`)

- `OVERRIDE`
Override – Override the radius of the spline point with the taper radius.

- `MULTIPLY`
Multiply – Multiply the radius of the spline point by the taper radius.

- `ADD`
Add – Add the radius of the bevel point to the taper radius.


Type:

Literal\[‘OVERRIDE’, ‘MULTIPLY’, ‘ADD’\]

texspace\_location [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.texspace_location "Link to this definition")

(array of 3 items, in \[-inf, inf\], default (0.0, 0.0, 0.0))

Type:

[`mathutils.Vector`](https://docs.blender.org/api/current/mathutils.html#mathutils.Vector "mathutils.Vector")

texspace\_size [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.texspace_size "Link to this definition")

(array of 3 items, in \[-inf, inf\], default (1.0, 1.0, 1.0))

Type:

[`mathutils.Vector`](https://docs.blender.org/api/current/mathutils.html#mathutils.Vector "mathutils.Vector")

twist\_mode [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.twist_mode "Link to this definition")

The type of tilt calculation for 3D Curves (default `'MINIMUM'`)

- `Z_UP`
Z-Up – Use Z-Up axis to calculate the curve twist at each point.

- `MINIMUM`
Minimum – Use the least twist over the entire curve.

- `TANGENT`
Tangent – Use the tangent to calculate twist.


Type:

Literal\[‘Z\_UP’, ‘MINIMUM’, ‘TANGENT’\]

twist\_smooth [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.twist_smooth "Link to this definition")

Smoothing iteration for tangents (in \[-inf, inf\], default 0.0)

Type:

float

use\_auto\_texspace [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_auto_texspace "Link to this definition")

Adjust active object’s texture space automatically when transforming object (default True)

Type:

bool

use\_deform\_bounds [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_deform_bounds "Link to this definition")

Option for curve-deform: Use the mesh bounds to clamp the deformation (default False)

Type:

bool

use\_fill\_caps [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_fill_caps "Link to this definition")

Fill caps for beveled curves (default False)

Type:

bool

use\_map\_taper [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_map_taper "Link to this definition")

Map effect of the taper object to the beveled part of the curve (default False)

Type:

bool

use\_path [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_path "Link to this definition")

Enable the curve to become a translation path (default False)

Type:

bool

use\_path\_clamp [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_path_clamp "Link to this definition")

Clamp the curve path children so they cannot travel past the start/end point of the curve (default False)

Type:

bool

use\_path\_follow [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_path_follow "Link to this definition")

Make curve path children rotate along the path (default False)

Type:

bool

use\_radius [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_radius "Link to this definition")

Option for paths and curve-deform: apply the curve radius to objects following it and to deformed objects (default True)

Type:

bool

use\_stretch [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.use_stretch "Link to this definition")

Option for curve-deform: make deformed child stretch along entire path (default False)

Type:

bool

transform( _matrix_, _\*_, _shape\_keys=False_) [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.transform "Link to this definition")

Transform curve by a matrix

Parameters:

- **matrix** ( [`mathutils.Matrix`](https://docs.blender.org/api/current/mathutils.html#mathutils.Matrix "mathutils.Matrix") \| Sequence\[Sequence\[float\]\]) – Matrix (multi-dimensional array of 4 \* 4 items, in \[-inf, inf\])

- **shape\_keys** ( _bool_) – Transform Shape Keys (optional)


validate\_material\_indices() [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.validate_material_indices "Link to this definition")

Validate material indices of splines or letters, return True when the curve has had invalid indices corrected (to default 0)

Returns:

Result

Return type:

bool

update\_gpu\_tag() [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.update_gpu_tag "Link to this definition")

update\_gpu\_tag

classmethodbl\_rna\_get\_subclass( _id_, _default=None_, _/_) [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bl_rna_get_subclass "Link to this definition")Parameters:

- **id** ( _str_) – The RNA type identifier.

- **default** ( [`bpy.types.Struct`](https://docs.blender.org/api/current/bpy.types.Struct.html#bpy.types.Struct "bpy.types.Struct") \| None) – The value to return when not found.


Returns:

The RNA type or default when not found.

Return type:

[`bpy.types.Struct`](https://docs.blender.org/api/current/bpy.types.Struct.html#bpy.types.Struct "bpy.types.Struct")

classmethodbl\_rna\_get\_subclass\_py( _id_, _default=None_, _/_) [¶](https://docs.blender.org/api/current/bpy.types.Curve.html#bpy.types.Curve.bl_rna_get_subclass_py "Link to this definition")Parameters:

- **id** ( _str_) – The RNA type identifier.

- **default** ( _type_ _\|_ _None_) – The value to return when not found.


Returns:

The class or default when not found.

Return type:

type

## Inherited Properties [¶](https://docs.blender.org/api/current/bpy.types.Curve.html\#inherited-properties "Link to this heading")

|     |     |
| --- | --- |
| - [`bpy_struct.id_data`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_data "bpy.types.bpy_struct.id_data")<br>  <br>- [`ID.name`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.name "bpy.types.ID.name")<br>  <br>- [`ID.name_full`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.name_full "bpy.types.ID.name_full")<br>  <br>- [`ID.id_type`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.id_type "bpy.types.ID.id_type")<br>  <br>- [`ID.session_uid`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.session_uid "bpy.types.ID.session_uid")<br>  <br>- [`ID.is_evaluated`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_evaluated "bpy.types.ID.is_evaluated")<br>  <br>- [`ID.original`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.original "bpy.types.ID.original")<br>  <br>- [`ID.users`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.users "bpy.types.ID.users")<br>  <br>- [`ID.use_fake_user`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.use_fake_user "bpy.types.ID.use_fake_user")<br>  <br>- [`ID.use_extra_user`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.use_extra_user "bpy.types.ID.use_extra_user")<br>  <br>- [`ID.is_embedded_data`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_embedded_data "bpy.types.ID.is_embedded_data") | - [`ID.is_linked_packed`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_linked_packed "bpy.types.ID.is_linked_packed")<br>  <br>- [`ID.is_missing`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_missing "bpy.types.ID.is_missing")<br>  <br>- [`ID.is_runtime_data`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_runtime_data "bpy.types.ID.is_runtime_data")<br>  <br>- [`ID.is_editable`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_editable "bpy.types.ID.is_editable")<br>  <br>- [`ID.tag`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.tag "bpy.types.ID.tag")<br>  <br>- [`ID.is_library_indirect`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.is_library_indirect "bpy.types.ID.is_library_indirect")<br>  <br>- [`ID.library`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.library "bpy.types.ID.library")<br>  <br>- [`ID.library_weak_reference`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.library_weak_reference "bpy.types.ID.library_weak_reference")<br>  <br>- [`ID.asset_data`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_data "bpy.types.ID.asset_data")<br>  <br>- [`ID.override_library`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.override_library "bpy.types.ID.override_library")<br>  <br>- [`ID.preview`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.preview "bpy.types.ID.preview") |

## Inherited Functions [¶](https://docs.blender.org/api/current/bpy.types.Curve.html\#inherited-functions "Link to this heading")

|     |     |
| --- | --- |
| - [`bpy_struct.as_pointer`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.as_pointer "bpy.types.bpy_struct.as_pointer")<br>  <br>- [`bpy_struct.driver_add`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.driver_add "bpy.types.bpy_struct.driver_add")<br>  <br>- [`bpy_struct.driver_remove`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.driver_remove "bpy.types.bpy_struct.driver_remove")<br>  <br>- [`bpy_struct.get`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.get "bpy.types.bpy_struct.get")<br>  <br>- [`bpy_struct.id_properties_clear`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_clear "bpy.types.bpy_struct.id_properties_clear")<br>  <br>- [`bpy_struct.id_properties_ensure`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_ensure "bpy.types.bpy_struct.id_properties_ensure")<br>  <br>- [`bpy_struct.id_properties_ui`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.id_properties_ui "bpy.types.bpy_struct.id_properties_ui")<br>  <br>- [`bpy_struct.is_property_hidden`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_hidden "bpy.types.bpy_struct.is_property_hidden")<br>  <br>- [`bpy_struct.is_property_overridable_library`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_overridable_library "bpy.types.bpy_struct.is_property_overridable_library")<br>  <br>- [`bpy_struct.is_property_readonly`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_readonly "bpy.types.bpy_struct.is_property_readonly")<br>  <br>- [`bpy_struct.is_property_set`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.is_property_set "bpy.types.bpy_struct.is_property_set")<br>  <br>- [`bpy_struct.items`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.items "bpy.types.bpy_struct.items")<br>  <br>- [`bpy_struct.keyframe_delete`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keyframe_delete "bpy.types.bpy_struct.keyframe_delete")<br>  <br>- [`bpy_struct.keyframe_insert`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keyframe_insert "bpy.types.bpy_struct.keyframe_insert")<br>  <br>- [`bpy_struct.keys`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.keys "bpy.types.bpy_struct.keys")<br>  <br>- [`bpy_struct.path_from_id`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_from_id "bpy.types.bpy_struct.path_from_id")<br>  <br>- [`bpy_struct.path_from_module`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_from_module "bpy.types.bpy_struct.path_from_module")<br>  <br>- [`bpy_struct.path_resolve`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.path_resolve "bpy.types.bpy_struct.path_resolve")<br>  <br>- [`bpy_struct.pop`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.pop "bpy.types.bpy_struct.pop")<br>  <br>- [`bpy_struct.property_overridable_library_set`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.property_overridable_library_set "bpy.types.bpy_struct.property_overridable_library_set")<br>  <br>- [`bpy_struct.property_unset`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.property_unset "bpy.types.bpy_struct.property_unset")<br>  <br>- [`bpy_struct.rna_ancestors`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.rna_ancestors "bpy.types.bpy_struct.rna_ancestors") | - [`bpy_struct.type_recast`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.type_recast "bpy.types.bpy_struct.type_recast")<br>  <br>- [`bpy_struct.values`](https://docs.blender.org/api/current/bpy.types.bpy_struct.html#bpy.types.bpy_struct.values "bpy.types.bpy_struct.values")<br>  <br>- [`ID.bl_system_properties_get`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.bl_system_properties_get "bpy.types.ID.bl_system_properties_get")<br>  <br>- [`ID.rename`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.rename "bpy.types.ID.rename")<br>  <br>- [`ID.evaluated_get`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.evaluated_get "bpy.types.ID.evaluated_get")<br>  <br>- [`ID.copy`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.copy "bpy.types.ID.copy")<br>  <br>- [`ID.asset_mark`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_mark "bpy.types.ID.asset_mark")<br>  <br>- [`ID.asset_clear`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_clear "bpy.types.ID.asset_clear")<br>  <br>- [`ID.asset_generate_preview`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.asset_generate_preview "bpy.types.ID.asset_generate_preview")<br>  <br>- [`ID.override_create`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.override_create "bpy.types.ID.override_create")<br>  <br>- [`ID.override_hierarchy_create`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.override_hierarchy_create "bpy.types.ID.override_hierarchy_create")<br>  <br>- [`ID.user_clear`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.user_clear "bpy.types.ID.user_clear")<br>  <br>- [`ID.user_remap`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.user_remap "bpy.types.ID.user_remap")<br>  <br>- [`ID.make_local`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.make_local "bpy.types.ID.make_local")<br>  <br>- [`ID.user_of_id`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.user_of_id "bpy.types.ID.user_of_id")<br>  <br>- [`ID.animation_data_create`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.animation_data_create "bpy.types.ID.animation_data_create")<br>  <br>- [`ID.animation_data_clear`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.animation_data_clear "bpy.types.ID.animation_data_clear")<br>  <br>- [`ID.update_tag`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.update_tag "bpy.types.ID.update_tag")<br>  <br>- [`ID.preview_ensure`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.preview_ensure "bpy.types.ID.preview_ensure")<br>  <br>- [`ID.bl_rna_get_subclass`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.bl_rna_get_subclass "bpy.types.ID.bl_rna_get_subclass")<br>  <br>- [`ID.bl_rna_get_subclass_py`](https://docs.blender.org/api/current/bpy.types.ID.html#bpy.types.ID.bl_rna_get_subclass_py "bpy.types.ID.bl_rna_get_subclass_py") |

## References [¶](https://docs.blender.org/api/current/bpy.types.Curve.html\#references "Link to this heading")

|     |     |
| --- | --- |
| - `bpy.context.curve`<br>  <br>- [`BlendData.curves`](https://docs.blender.org/api/current/bpy.types.BlendData.html#bpy.types.BlendData.curves "bpy.types.BlendData.curves")<br>  <br>- [`BlendDataCurves.new`](https://docs.blender.org/api/current/bpy.types.BlendDataCurves.html#bpy.types.BlendDataCurves.new "bpy.types.BlendDataCurves.new") | - [`BlendDataCurves.remove`](https://docs.blender.org/api/current/bpy.types.BlendDataCurves.html#bpy.types.BlendDataCurves.remove "bpy.types.BlendDataCurves.remove")<br>  <br>- [`Object.to_curve`](https://docs.blender.org/api/current/bpy.types.Object.html#bpy.types.Object.to_curve "bpy.types.Object.to_curve") |
