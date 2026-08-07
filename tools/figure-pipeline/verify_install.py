"""Gate for punch-list item 0.2.

Proves, inside a real headless Blender process, that MPFB2 loaded and that every target the
figure pipeline depends on actually resolves to a file on disk. Exits non-zero on any gap so
install_deps.sh fails loudly instead of leaving a half-installed toolchain behind.

Run: blender --background --python verify_install.py --python-exit-code 1
"""

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mpfb_bridge import dynamic_import

LocationService = dynamic_import("mpfb.services.locationservice", "LocationService")
TargetService = dynamic_import("mpfb.services.targetservice", "TargetService")
ARKIT_FACEUNITS = dynamic_import("mpfb.services.faceservice", "ARKIT_FACEUNITS")
META_VISEMES = dynamic_import("mpfb.services.faceservice", "META_VISEMES")
MICROSOFT_VISEMES = dynamic_import("mpfb.services.faceservice", "MICROSOFT_VISEMES")


def report_missing_targets(label, target_names):
    """Resolve every target name through MPFB and print the ones that do not exist."""
    missing = [name for name in target_names if TargetService.target_full_path(name) is None]

    if missing:
        print(f"FAIL {label}: {len(missing)} of {len(target_names)} missing -> {missing}")
    else:
        print(f"OK   {label}: all {len(target_names)} targets resolve")

    return missing


print("")
print("=== MPFB2 headless install verification ===")
print(f"Blender      : {bpy.app.version_string}")
print(f"MPFB data    : {LocationService.get_mpfb_data()}")
print(f"User data    : {LocationService.get_user_data()}")
print("")

everything_missing = []
everything_missing += report_missing_targets("ARKit face units", ARKIT_FACEUNITS)
everything_missing += report_missing_targets("Meta (OVR) visemes", META_VISEMES)
everything_missing += report_missing_targets("Microsoft visemes", MICROSOFT_VISEMES)

print("")
print("The 52 canonical ARKit face unit names MPFB2 will produce as shape keys:")
for index, name in enumerate(ARKIT_FACEUNITS):
    print(f"  {index + 1:2d}. {name}")
print("")

if everything_missing:
    raise SystemExit("Verification failed - see FAIL lines above.")

print("Verification passed.")
