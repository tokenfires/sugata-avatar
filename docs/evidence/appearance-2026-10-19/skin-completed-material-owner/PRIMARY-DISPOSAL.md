### Getting Started

- [Installation](https://threejs.org/manual/pages/installation.html)
- [Creating a Scene](https://threejs.org/manual/pages/creating-a-scene.html)
- [Creating Text](https://threejs.org/manual/pages/creating-text.html)
- [Drawing Lines](https://threejs.org/manual/pages/drawing-lines.html)
- [FAQ](https://threejs.org/manual/pages/faq.html)
- [Libraries and Plugins](https://threejs.org/manual/pages/libraries-and-plugins.html)
- [Loading 3D Models](https://threejs.org/manual/pages/loading-3d-models.html)
- [Uniform Types](https://threejs.org/manual/pages/uniform-types.html)
- [Useful Links](https://threejs.org/manual/pages/useful-links.html)
- [WebGL Compatibility Check](https://threejs.org/manual/pages/webgl-compatibility-check.html)

### Next Steps

- [Animation System](https://threejs.org/manual/pages/animation-system.html)
- [Color Management](https://threejs.org/manual/pages/color-management.html)
- [How to create VR content](https://threejs.org/manual/pages/how-to-create-vr-content.html)
- [How to dispose of Objects](https://threejs.org/manual/pages/how-to-dispose-of-objects.html)
- [How to update Things](https://threejs.org/manual/pages/how-to-update-things.html)
- [How to use Post Processing](https://threejs.org/manual/pages/how-to-use-post-processing.html)
- [Matrix Transformations](https://threejs.org/manual/pages/matrix-transformations.html)

* * *

### Basics

- [Fundamentals](https://threejs.org/manual/pages/fundamentals.html)
- [Responsive Design](https://threejs.org/manual/pages/responsive.html)
- [Prerequisites](https://threejs.org/manual/pages/prerequisites.html)
- [Setup](https://threejs.org/manual/pages/setup.html)

### Fundamentals

- [Primitives](https://threejs.org/manual/pages/primitives.html)
- [Scenegraph](https://threejs.org/manual/pages/scenegraph.html)
- [Materials](https://threejs.org/manual/pages/materials.html)
- [Textures](https://threejs.org/manual/pages/textures.html)
- [Lights](https://threejs.org/manual/pages/lights.html)
- [Cameras](https://threejs.org/manual/pages/cameras.html)
- [Shadows](https://threejs.org/manual/pages/shadows.html)
- [Fog](https://threejs.org/manual/pages/fog.html)
- [Render Targets](https://threejs.org/manual/pages/rendertargets.html)
- [Custom BufferGeometry](https://threejs.org/manual/pages/custom-buffergeometry.html)
- [Physics](https://threejs.org/manual/pages/physics.html)

### Tips

- [Rendering On Demand](https://threejs.org/manual/pages/rendering-on-demand.html)
- [Debugging JavaScript](https://threejs.org/manual/pages/debugging-javascript.html)
- [Debugging GLSL](https://threejs.org/manual/pages/debugging-glsl.html)
- [Taking a screenshot](https://threejs.org/manual/pages/tips.html#screenshot)
- [Prevent the Canvas Being Cleared](https://threejs.org/manual/pages/tips.html#preservedrawingbuffer)
- [Get Keyboard Input From a Canvas](https://threejs.org/manual/pages/tips.html#tabindex)
- [Make the Canvas Transparent](https://threejs.org/manual/pages/tips.html#transparent-canvas)
- [Use three.js as Background in HTML](https://threejs.org/manual/pages/tips.html#html-background)

### Optimization

- [Optimizing Lots of Objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html)
- [Optimizing Lots of Objects Animated](https://threejs.org/manual/pages/optimize-lots-of-objects-animated.html)
- [Using OffscreenCanvas in a Web Worker](https://threejs.org/manual/pages/offscreencanvas.html)

### Solutions

- [Load an .OBJ file](https://threejs.org/manual/pages/load-obj.html)
- [Load a .GLTF file](https://threejs.org/manual/pages/load-gltf.html)
- [Add a Background or Skybox](https://threejs.org/manual/pages/backgrounds.html)
- [How to Draw Transparent Objects](https://threejs.org/manual/pages/transparency.html)
- [Multiple Canvases, Multiple Scenes](https://threejs.org/manual/pages/multiple-scenes.html)
- [Picking Objects with the mouse](https://threejs.org/manual/pages/picking.html)
- [Post Processing](https://threejs.org/manual/pages/post-processing.html)
- [Using Shadertoy shaders](https://threejs.org/manual/pages/shadertoy.html)
- [Aligning HTML Elements to 3D](https://threejs.org/manual/pages/align-html-elements-to-3d.html)
- [Using Indexed Textures for Picking and Color](https://threejs.org/manual/pages/indexed-textures.html)
- [Using A Canvas for Dynamic Textures](https://threejs.org/manual/pages/canvas-textures.html)
- [Billboards and Facades](https://threejs.org/manual/pages/billboards.html)
- [Freeing Resources](https://threejs.org/manual/pages/cleanup.html)
- [Making Voxel Geometry (Minecraft)](https://threejs.org/manual/pages/voxel-geometry.html)
- [Start making a Game](https://threejs.org/manual/pages/game.html)

### WebGPU

- [WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer.html)
- [Post-Processing](https://threejs.org/manual/pages/webgpu-postprocessing.html)

### WebXR

- [VR - Basics](https://threejs.org/manual/pages/webxr-basics.html)
- [VR - Look To Select](https://threejs.org/manual/pages/webxr-look-to-select.html)
- [VR - Point To Select](https://threejs.org/manual/pages/webxr-point-to-select.html)

### Reference

- [Material Table](https://threejs.org/manual/pages/material-table.html)

How to dispose of Objects

# How to dispose of Objects

One important aspect in order to improve performance and avoid memory leaks in your application is the disposal of unused library entities.
Whenever you create an instance of a \*three.js\* type, you allocate a certain amount of memory. However, \*three.js\* creates for specific objects
like geometries or materials WebGL related entities like buffers or shader programs which are necessary for rendering. It's important to
highlight that these objects are not released automatically. Instead, the application has to use a special API in order to free such resources.
This guide provides a brief overview about how this API is used and what objects are relevant in this context.


## Geometries

A geometry usually represents vertex information defined as a collection of attributes. \*three.js\* internally creates an object of type [WebGLBuffer](https://developer.mozilla.org/en-US/docs/Web/API/WebGLBuffer)
for each attribute. These entities are only deleted if you call `BufferGeometry.dispose()`. If a geometry becomes obsolete in your application,
execute the method to free all related resources.


## Materials

A material defines how objects are rendered. \*three.js\* uses the information of a material definition in order to construct a shader program for rendering.
Shader programs can only be deleted if the respective material is disposed. For performance reasons, \*three.js\* tries to reuse existing
shader programs if possible. So a shader program is only deleted if all related materials are disposed. You can indicate the disposal of a material by
executing `Material.dispose()`.


## Textures

The disposal of a material has no effect on textures. They are handled separately since a single texture can be used by multiple materials at the same time.
Whenever you create an instance of `Texture`, three.js internally creates an instance of [WebGLTexture](https://developer.mozilla.org/en-US/docs/Web/API/WebGLTexture).
Similar to buffers, this object can only be deleted by calling `Texture.dispose()`.


If you use an `ImageBitmap` as the texture's data source, you have to call [ImageBitmap.close](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap/close)() at the application level to dispose of all CPU-side resources.
An automated call of `ImageBitmap.close()` in `Texture.dispose()` is not possible, since the image bitmap becomes unusable, and the engine has no way of knowing if the image bitmap is used elsewhere.


## Render Targets

Objects of type `WebGLRenderTarget` not only allocate an instance of [WebGLTexture](https://developer.mozilla.org/en-US/docs/Web/API/WebGLTexture) but also
[WebGLFramebuffer](https://developer.mozilla.org/en-US/docs/Web/API/WebGLFramebuffer) s and [WebGLRenderbuffer](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderbuffer) s
for realizing custom rendering destinations. These objects are only deallocated by executing `WebGLRenderTarget.dispose()`.


## Skinned Mesh

Skinned meshes represent their bone hierarchy as skeletons. If you don't need a skinned mesh anymore, consider to call `Skeleton.dispose()` on the skeleton to free internal resources.
Keep in mind that skeletons can be shared across multiple skinned meshes, so only call `dispose()` if the skeleton is not used by other active skinned meshes.


## Miscellaneous

There are other classes from the examples directory like controls or post processing passes which provide `dispose()` methods in order to remove internal event listeners
or render targets. In general, it's recommended to check the API or documentation of a class and watch for `dispose()`. If present, you should use it when cleaning things up.


## FAQ

### Why can't \*three.js\* dispose objects automatically?

This question was asked many times by the community so it's important to clarify this matter. Fact is that \*three.js\* does not know the lifetime or scope
of user-created entities like geometries or materials. This is the responsibility of the application. For example even if a material is currently not used for rendering,
it might be necessary for the next frame. So if the application decides that a certain object can be deleted, it has to notify the engine via calling the respective
`dispose()` method.


### Does removing a mesh from the scene also dispose its geometry and material?

No, you have to explicitly dispose the geometry and material via \*dispose()\*. Keep in mind that geometries and materials can be shared among 3D objects like meshes.


### Does \*three.js\* provide information about the amount of cached objects?

Yes. It's possible to evaluate `renderer.info`, a special property of the renderer with a series of statistical information about the graphics board memory
and the rendering process. Among other things, it tells you how many textures, geometries and shader programs are internally stored. If you notice performance problems
in your application, it's a good idea to debug this property in order to easily identify a memory leak.


### What happens when you call `dispose()` on a texture but the image is not loaded yet?

Internal resources for a texture are only allocated if the image has fully loaded. If you dispose a texture before the image was loaded,
nothing happens. No resources were allocated so there is also no need for clean up.


### What happens when I call `dispose()` and then use the respective object at a later point?

That depends. For geometries, materials, textures, render targets and post processing passes the deleted internal resources can be created again by the engine.
So no runtime error will occur but you might notice a negative performance impact for the current frame, especially when shader programs have to be compiled.

Controls and renderers are an exception. Instances of these classes can not be used after `dispose()` has been called. You have to create new instances in this case.


### How should I manage \*three.js\* objects in my app? When do I know how to dispose things?

In general, there is no definite recommendation for this. It highly depends on the specific use case when calling `dispose()` is appropriate. It's important to highlight that
it's not always necessary to dispose objects all the time. A good example for this is a game which consists of multiple levels. A good place for object disposal is when
switching the level. The app could traverse through the old scene and dispose all obsolete materials, geometries and textures. As mentioned in the previous section, it does not
produce a runtime error if you dispose an object that is actually still in use. The worst thing that can happen is performance drop for a single frame.


### Why `renderer.info.memory` is still reporting geometries and textures after traversing the scene and disposing all reachable textures and geometries?

In certain cases, there are some textures and geometries used internally by Three.js
that are not reachable when traversing the scene graph in order to be disposed.
It is expected that `renderer.info.memory` will still report them even after a full scene cleanup.
However, they do not leak, but they are reused on consecutive scene cleanup/repopulating cycles.

These cases could be related to using `material.envMap`, `scene.background`, `scene.environment`,
or other contexts that would require the engine to create textures or geometries for internal use.


## Examples that demonstrate the usage of dispose()

[WebGL / test / memory](https://threejs.org/examples/#webgl_test_memory)

[WebGL / test / memory2](https://threejs.org/examples/#webgl_test_memory2)