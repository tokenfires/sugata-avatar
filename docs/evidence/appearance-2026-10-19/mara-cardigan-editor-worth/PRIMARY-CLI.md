[Join the **official Blender Survey 2026**! 🧡](https://www.blender.org/news/blender-survey-2026/)

ContentsMenuExpandLight modeDark modeAuto light/dark, in light modeAuto light/dark, in dark mode[Skip to content](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html#furo-main-content)

[Back to top](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html#)

[Edit this page](https://projects.blender.org/blender/blender-manual/_edit/main/manual/advanced/command_line/arguments.rst "Edit this page")

# Command Line Arguments [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#command-line-arguments "Link to this heading")

Blender 5.2 LTS

Usage: `blender [args ...] [file] [args ...]`

## Render Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#render-options "Link to this heading")

`-b`, `--background`

Run in background (often used for UI-less rendering).

The audio device is disabled in background-mode by default
and can be re-enabled by passing in `-setaudio Default` afterwards.

`-a`, `--render-anim`

Render frames from start to end (inclusive).

`-S`, `--scene``<name>`

Set the active scene `<name>` for rendering.

`-f`, `--render-frame``<frame>`

Render frame `<frame>` and save it.

- `+<frame>` start frame relative, `-<frame>` end frame relative.

- A comma separated list of frames can also be used (no spaces).

- A range of frames can be expressed using `..` separator between the first and last frames (inclusive).


`-s`, `--frame-start``<frame>`

Set start to frame `<frame>`, supports +/- for relative frames too.

`-e`, `--frame-end``<frame>`

Set end to frame `<frame>`, supports +/- for relative frames too.

`-j`, `--frame-jump``<frames>`

Set number of frames to step forward after each rendered frame.

`-o`, `--render-output``<path>`

Set the render path and file name.
Use `//` at the start of the path to render relative to the blend-file.

You can use path templating features such as `{blend_name}` in the path.
See Blender’s documentation on path templates for more details.

The `#` characters are replaced by the frame number, and used to define zero padding.

- `animation_##_test.png` becomes `animation_01_test.png`

- `test-######.png` becomes `test-000001.png`


When the filename does not contain `#`, the suffix `####` is added to the filename.

The frame number will be added at the end of the filename, eg:

```
blender -b animation.blend -o //render_ -F PNG -x 1 -a
```

Copy to clipboard

`//render_` becomes `//render_####`, writing frames as `//render_0001.png`

`-E`, `--engine``<engine>`

Specify the render engine.
Use `-E help` to list available engines.

`-t`, `--threads``<threads>`

Use amount of `<threads>` for rendering and other operations
\[1-1024\], 0 to use the systems processor count.

## Cycles Render Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#cycles-render-options "Link to this heading")

Cycles add-on options must be specified following a double dash.

`--cycles-device``<device>`

Set the device used for rendering.
Valid options are: `CPU``CUDA``OPTIX``HIP``ONEAPI``METAL`.

Append +CPU to a GPU device to render on both CPU and GPU.

Example:

```
blender -b file.blend -f 20 -- --cycles-device OPTIX
```

Copy to clipboard

`--cycles-print-stats`

Log statistics about render memory and time usage.

## Format Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#format-options "Link to this heading")

`-F`, `--render-format``<format>`

Set the render format.
Valid options are:
`TGA``RAWTGA``JPEG``IRIS``PNG``BMP``HDR``TIFF`.

Formats that can be compiled into Blender, not available on all systems:
`OPEN_EXR``OPEN_EXR_MULTILAYER``FFMPEG``CINEON``DPX``JP2``WEBP`.

`-x`, `--use-extension``<bool>`

Set option to add the file extension to the end of the file.

## Animation Playback Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#animation-playback-options "Link to this heading")

`-a``<options>``<file(s)>`

Instead of showing Blender’s user interface, this runs Blender as an animation player,
to view movies and image sequences rendered in Blender (ignored if `-b` is set).

Playback Arguments:

`-p``<sx>``<sy>`

Open with lower left corner at `<sx>`, `<sy>`.

`-m`

Read from disk (Do not buffer).

`-f``<fps>``<fps_base>`

Specify FPS to start with.

`-j``<frame>`

Set frame step to `<frame>`.

`-s``<frame>`

Play from `<frame>`.

`-e``<frame>`

Play until `<frame>`.

`-c``<cache_memory>`

Amount of memory in megabytes to allow for caching images during playback.
Zero disables (clamping to a fixed number of frames instead).

## Window Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#window-options "Link to this heading")

`-w`, `--window-border`

Force opening with borders, in a normal (non maximized) state.

`-M`, `--window-maximized`

Force opening maximized.

`-W`, `--window-fullscreen`

Force opening full-screen.

`-p`, `--window-geometry``<sx>``<sy>``<w>``<h>`

Open with lower left corner at `<sx>`, `<sy>` and width and height as `<w>`, `<h>`.

`-con`, `--start-console`

Start with the console window open (ignored if `-b` is set), (Windows only).

`--no-native-pixels`

Do not use native pixel size, for high resolution displays (MacBook `Retina`).

`--no-window-frame`

Disable all window decorations (Linux only).

`--no-window-focus`

Open behind other windows and without taking focus.

## Python Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#python-options "Link to this heading")

`-y`, `--enable-autoexec`

Enable automatic Python script execution.

`-Y`, `--disable-autoexec`

Disable automatic Python script execution (Python-drivers & startup scripts), (default).

`-P`, `--python``<filepath>`

Run the given Python script file.

`--python-text``<name>`

Run the given Python script text block.

`--python-expr``<expression>`

Run the given expression as a Python script.

The expression may be a complete multi-line script;
you are limited only by the platform’s maximum argument length.

`--python-console`

Run Blender with an interactive console.

`--python-exit-code``<code>`

Set the exit-code in \[0..255\] to exit if a Python exception is raised
(only for scripts executed from the command line), zero disables.

`--python-use-system-env`

Allow Python to use system environment variables such as `PYTHONPATH` and the user site-packages directory.

`--addons``<addon(s)>`

Comma separated list (no spaces) of add-ons to enable in addition to any default add-ons.

## Network Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#network-options "Link to this heading")

`--online-mode`

Allow internet access, overriding the preference.

`--offline-mode`

Disallow internet access, overriding the preference.

## Logging Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#logging-options "Link to this heading")

`--log``<match>`

Enable logging categories, taking a single comma separated argument.

`--log "*"`: everything
`--log "event"`: every category starting with `event`.
`--log "render,cycles"`: both render and cycles messages.
`--log "*mesh*"`: every category containing `mesh` sub-string.
`--log "*,^operator"`: everything except operators, with `^prefix` to exclude.

`--log-level``<level>`

Set the logging verbosity level.

fatal: Fatal errors only
error: Errors only
warning: Warnings
info: Information about devices, files, configuration, operations
debug: Verbose messages for developers
trace: Very verbose code execution tracing

`--log-show-memory`

Show memory usage for each log message.

`--log-show-source`

Show source file and function name in output.

`--log-show-backtrace`

Show a back trace for each log message (debug builds only).

`--log-file``<filepath>`

Set a file to output the log to.

`--log-list-categories`

List all available logging categories for `--log`, and exit.

## Debug Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#debug-options "Link to this heading")

`-d`, `--debug`

Turn debugging on.

- Enables memory error detection

- Disables mouse grab (to interact with a debugger in some cases)

- Keeps Python’s `sys.stdin` rather than setting it to None


`--debug-value``<value>`

Set debug value of `<value>` on startup.

`--debug-events`

Enable debug messages for the event system.

`--debug-handlers`

Enable debug messages for event handling.

`--debug-libmv`

Enable debug messages from libmv library.

`--debug-memory`

Enable fully guarded memory allocation and debugging.

`--debug-jobs`

Enable time profiling for background jobs.

`--debug-python`

Enable debug messages for Python.

`--debug-depsgraph`

Enable all debug messages from dependency graph.

`--debug-depsgraph-eval`

Enable debug messages from dependency graph related on evaluation.

`--debug-depsgraph-build`

Enable debug messages from dependency graph related on graph construction.

`--debug-depsgraph-tag`

Enable debug messages from dependency graph related on tagging.

`--debug-depsgraph-no-threads`

Switch dependency graph to a single threaded evaluation.

`--debug-depsgraph-time`

Enable debug messages from dependency graph related on timing.

`--debug-depsgraph-pretty`

Enable colors for dependency graph debug messages.

`--debug-depsgraph-uid`

Verify validness of session-wide identifiers assigned to ID data-blocks.

`--debug-ghost`

Enable debug messages for Ghost (Linux only).

`--debug-wintab`

Enable debug messages for Wintab.

`--debug-gpu`

Enable GPU debug context and information for OpenGL 4.3+.

`--debug-gpu-force-workarounds`

Enable workarounds for typical GPU issues and disable all GPU extensions.

`--debug-gpu-compile-shaders`

Compile all statically defined shaders to test platform compatibility.

`--debug-gpu-shader-debug-info`

Enable shader debug info generation (Vulkan only).

`--debug-gpu-scope-capture`

Capture the GPU commands issued inside the give scope name.

`--debug-gpu-shader-source`

Save the compiled GPU shader source code for the given shader name.
The given name can contain leading or trailing wildcard “\*” to match multiple shaders. Files are saved in the current working directory inside a directory named “Shaders”.

`--debug-gpu-shader-no-preprocessor`

Skip preprocessor pass and rely on driver or shader compiler preprocessor instead.
Also disable dead code elimination.

`--debug-gpu-shader-no-dce`

Skip dead code elimination pass.

`--debug-gpu-no-texture-pool`

Disable memory aliasing optimizations in the GPU texture pool.

`--debug-gpu-renderdoc`

Enable RenderDoc integration for GPU frame grabbing and debugging.

`--debug-gpu-vulkan-local-read`

Force Vulkan dynamic rendering local read when supported by device.

`--debug-wm`

Enable debug messages for the window manager, shows all operators in search, shows keymap errors.

`--debug-xr`

Enable debug messages for virtual reality contexts.
Enables the OpenXR API validation layer, (OpenXR) debug messages and general information prints.

`--debug-xr-time`

Enable debug messages for virtual reality frame rendering times.

`--debug-all`

Enable all debug messages.

`--debug-io`

Enable debug messages for I/O.

`--debug-fpe`

Enable floating-point exceptions.

`--debug-exit-on-error`

Immediately exit when internal errors are detected.

`--debug-freestyle`

Enable debug messages for Freestyle.

`--disable-crash-handler`

Disable the crash handler.

`--disable-abort-handler`

Disable the abort handler.

`--verbose``<verbose>`

Set the logging verbosity level for debug messages that support it.

`-q`, `--quiet`

Suppress status printing (warnings & errors are still printed).

## GPU Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#gpu-options "Link to this heading")

`--gpu-backend`

Force to use a specific GPU backend. Valid options: `vulkan`, `metal`, `opengl`.

`--gpu-vsync`

Set the VSync.
Valid options are: `on`, `off` & `auto` for adaptive sync.

- The default settings depend on the GPU driver.

- Disabling VSync can be useful for testing performance.

- `auto` is only supported by the OpenGL backend.


`--gpu-compilation-subprocesses`

Override the Max Compilation Subprocesses setting (OpenGL only).

`--profile-gpu`

Enable CPU & GPU performance profiling for GPU debug groups
(Outputs a profile.json file in the Trace Event Format to the current directory)

## Misc Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#misc-options "Link to this heading")

`--open-last`

Open the most recently opened blend file, instead of the default startup file.

`--app-template``<template>`

Set the application template (matching the directory name), use `default` for none.

`--factory-startup`

Skip reading the `startup.blend` in the users home directory.

`--enable-event-simulate`

Enable event simulation testing feature `bpy.types.Window.event_simulate`.

`--env-system-datafiles`

Set the `BLENDER_SYSTEM_DATAFILES` environment variable.

`--env-system-scripts`

Set the `BLENDER_SYSTEM_SCRIPTS` environment variable.

`--env-system-extensions`

Set the `BLENDER_SYSTEM_EXTENSIONS` environment variable.

`--env-system-python`

Set the `BLENDER_SYSTEM_PYTHON` environment variable.

`-noaudio`

Force sound system to None.

`-setaudio`

Force sound system to a specific device.
`None``Default``SDL``OpenAL``CoreAudio``JACK``PulseAudio``WASAPI`.

`-c`, `--command``<command>`

Run a command which consumes all remaining arguments.
Use `-c help` to list all other commands.
Pass `--help` after the command to see its help text.

This implies `--background` mode.

`-h`, `--help`

Print this help text and exit.

`/?`

Print this help text and exit (Windows only).

`-r`, `--register`

Register blend-file extension for current user, then exit (Windows & Linux only).

`--register-allusers`

Register blend-file extension for all users, then exit (Windows & Linux only).

`--unregister`

Unregister blend-file extension for current user, then exit (Windows & Linux only).

`--unregister-allusers`

Unregister blend-file extension for all users, then exit (Windows & Linux only).

`--qos``<level>`

Set the Quality of Service (QoS) mode for hybrid CPU architectures (Windows only).

default: Uses the default behavior of the OS.
high: Always makes use of performance cores.
eco: Schedules Blender threads exclusively to efficiency cores.

`-v`, `--version`

Print Blender version and exit.

`--`

End option processing, following arguments passed unchanged. Access via Python’s `sys.argv`.

## Other Options [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#other-options "Link to this heading")

`--disable-depsgraph-on-file-load`

Background mode: Do not systematically build and evaluate ViewLayers’ dependency graphs
when loading a blend-file in background mode (`-b` or `-c` options).

Scripts requiring evaluated data then need to explicitly ensure that
an evaluated depsgraph is available
(e.g. by calling `depsgraph = context.evaluated_depsgraph_get()`).

NOTE: this is a temporary option, in the future depsgraph will never be
automatically generated on file load in background mode.

`--disable-liboverride-auto-resync`

Do not perform library override automatic resync when loading a new blend-file.

NOTE: this is an alternative way to get the same effect as when setting the
`No Override Auto Resync` User Preferences Debug option.

`--debug-ffmpeg`

Enable debug messages from FFmpeg video input and output.

`--debug-cycles`

Enable debug messages from Cycles.

## Argument Parsing [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#argument-parsing "Link to this heading")

Arguments must be separated by white space, eg:

```
blender -ba test.blend
```

Copy to clipboard

…will exit since `-ba` is an unknown argument.

## Argument Order [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#argument-order "Link to this heading")

Arguments are executed in the order they are given. eg:

```
blender --background test.blend --render-frame 1 --render-output "/tmp"
```

Copy to clipboard

…will not render to `/tmp` because `--render-frame 1` renders before the output path is set.

```
blender --background --render-output /tmp test.blend --render-frame 1
```

Copy to clipboard

…will not render to `/tmp` because loading the blend-file overwrites the render output that was set.

```
blender --background test.blend --render-output /tmp --render-frame 1
```

Copy to clipboard

…works as expected.

## Environment Variables [¶](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html\#environment-variables "Link to this heading")

BLENDER\_USER\_RESOURCES:

Replace default directory of all user files.
Other `BLENDER_USER_*` variables override when set.

BLENDER\_USER\_CONFIG:

Directory for user configuration files.

BLENDER\_USER\_SCRIPTS:

Directory for user scripts.

BLENDER\_USER\_EXTENSIONS:

Directory for user extensions.

BLENDER\_USER\_DATAFILES:

Directory for user data files (icons, translations, ..).

BLENDER\_SYSTEM\_RESOURCES:

Replace default directory of all bundled resource files.

BLENDER\_SYSTEM\_SCRIPTS:

Directories to add extra scripts.

BLENDER\_SYSTEM\_EXTENSIONS:

Directory for system extensions repository.

BLENDER\_SYSTEM\_DATAFILES:

Directory to replace bundled datafiles.

BLENDER\_SYSTEM\_PYTHON:

Directory to replace bundled Python libraries.

BLENDER\_CUSTOM\_SPLASH:

Full path to an image that replaces the splash screen.

BLENDER\_CUSTOM\_SPLASH\_BANNER:

Full path to an image to overlay on the splash screen.

BLENDER\_OCIO:

Path to override the OpenColorIO configuration file.
If not set, the `OCIO` environment variable is used.

SPNAV\_SOCKET:

The socket path to connect to the 3D-mouse daemon (Unix only).

TEMP:

Store temporary files here (MS-Windows).

TMPDIR:

Store temporary files here (UNIX Systems).
The path must reference an existing directory or it will be ignored.