"""Prints MPFB2's user data directory so install_deps.sh knows where to unpack asset packs.

Run headlessly: blender --background --python print_user_data_dir.py
The only line on stdout that matters is the MPFB_USER_DATA_DIR= one; MPFB logs around it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mpfb_bridge import dynamic_import

LocationService = dynamic_import("mpfb.services.locationservice", "LocationService")

print("MPFB_USER_DATA_DIR=" + LocationService.get_user_data())
