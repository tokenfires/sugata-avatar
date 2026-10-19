#!/usr/bin/env python3
"""Metadata-only fixed-import runtime inventory. Never imports the garment builder."""
import collections, ctypes, errno, fractions, hashlib, heapq, importlib.util
import itertools, json, math, os, pathlib, resource, selectors, signal, stat
import struct, subprocess, sys, time, traceback
from pathlib import Path

def main():
    if sys.platform != "darwin" or not sys.flags.isolated or not sys.flags.no_site:
        raise RuntimeError("require Darwin isolated no-site runtime")
    base = Path(__file__).resolve().parent
    out = base / "RUNTIME.json"
    if out.exists():
        raise RuntimeError("runtime inventory already exists; no duplicate preflight")
    modules = []
    seen = set()
    total = 0
    def pin(path):
        nonlocal total
        p = Path(path).resolve(strict=True)
        if not p.is_file():
            raise RuntimeError("non-file runtime dependency")
        size = p.stat().st_size
        if size > 64 * 1024**2:
            raise RuntimeError("runtime file cap")
        total += size
        if total > 256 * 1024**2:
            raise RuntimeError("runtime cumulative cap")
        return dict(path=str(p), bytes=size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    executable = pin(sys.executable)
    # Hashing is exercised before native-image enumeration, so its provider is loaded.
    for name, module in sorted(tuple(sys.modules.items())):
        filename = getattr(module, "__file__", None)
        if filename and not str(filename).startswith("<"):
            path = str(Path(filename).resolve())
            if path not in seen and path != str(Path(__file__).resolve()):
                seen.add(path)
                modules.append(pin(path))
                if len(modules) > 300:
                    raise RuntimeError("module file count cap")
    dyld = ctypes.CDLL(None)
    count = dyld._dyld_image_count
    count.restype = ctypes.c_uint32
    getname = dyld._dyld_get_image_name
    getname.argtypes = [ctypes.c_uint32]
    getname.restype = ctypes.c_char_p
    n = int(count())
    if n > 4096:
        raise RuntimeError("loaded image count cap")
    system = []
    native = []
    for i in range(n):
        raw = getname(i)
        if not raw:
            raise RuntimeError("missing loaded image path")
        name = os.fsdecode(raw)
        if name.startswith(("/System/", "/usr/lib/")):
            system.append(dict(path=name, provenance="trusted host OS/shared cache; bytes not independently pinned"))
        else:
            native.append(pin(name))
            if len(native) > 150:
                raise RuntimeError("non-system image count cap")
    # No geometry, arbitrary imports, subprocess, platform.platform or child helper call.
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    record = dict(kind="metadata_only_fixed_standard_library_import_inventory",
        utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), pid=os.getpid(),
        executable=executable, version=sys.version, flags=repr(sys.flags),
        platform=sys.platform, uname=list(os.uname()), modules=modules,
        nonSystemImages=native, trustedSystemImages=system,
        readBytes=total, observedSelfMaxRSSRaw=rss, rssUnits="Darwin bytes per pinned local getrusage(2)",
        constructorImported=False, geometryEvaluated=False, childProcessesStarted=0,
        limits="runtime import metadata only; this is not actual target peak, performance or retirement qualification")
    encoded = (json.dumps(record, indent=2) + "\n").encode()
    with out.open("xb") as f:
        f.write(encoded)
    print(json.dumps(dict(path=str(out), bytes=len(encoded), sha256=hashlib.sha256(encoded).hexdigest(),
        modules=len(modules), nonSystemImages=len(native), trustedSystemImages=len(system),
        readBytes=total, rawRSS=rss, targetInvoked=False)))
if __name__ == "__main__":
    main()
