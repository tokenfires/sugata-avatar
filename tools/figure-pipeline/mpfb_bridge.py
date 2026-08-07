"""Shared entry point into MPFB2 from a headless Blender script.

Blender extensions are loaded under a generated package prefix (currently
`bl_ext.user_default.mpfb`), and that prefix is not knowable at the time this file is
written. MPFB2's own script samples work around it by scanning `sys.modules` for a module
whose name *ends with* the logical path. This module is that shim, extracted once so the
pipeline scripts do not each carry a copy-pasted block.

Import it by absolute path from a Blender script:

    import importlib.util, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from mpfb_bridge import dynamic_import
"""

import importlib
import sys


def dynamic_import(logical_module_path, symbol_name):
    """Fetch a symbol from an MPFB2 module without knowing the extension's package prefix.

    logical_module_path is the path as MPFB2 documents it, e.g. "mpfb.services.humanservice".
    The module must already be imported — MPFB2 imports its whole service layer during
    registration, so anything under mpfb.services is available once the extension is enabled.
    """
    for loaded_module_name in sys.modules:
        if loaded_module_name.endswith(logical_module_path):
            module = importlib.import_module(loaded_module_name)
            if not hasattr(module, symbol_name):
                raise AttributeError(
                    f"MPFB2 module {loaded_module_name} has no attribute {symbol_name}")
            return getattr(module, symbol_name)

    raise ValueError(
        f"No loaded module ends with '{logical_module_path}'. "
        "MPFB2 is probably not installed or not enabled — run install_deps.sh.")
