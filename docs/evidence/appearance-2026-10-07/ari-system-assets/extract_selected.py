"""Freeze exactly the source-reviewed active five-face files; no native use."""
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import time
import zipfile

HERE = Path(__file__).resolve().parent
start = time.monotonic()
plan = json.loads((HERE / "EXTRACT-PLAN.json").read_text())
root = Path(plan["destination"])
if root != HERE / "candidate/data" or len(plan["members"]) != 20 or len(set(plan["members"])) != 20:
    raise RuntimeError("Selected destination/count mismatch")
for pin in plan["pins"]:
    file = Path(pin["path"])
    if file.stat().st_size != pin["bytes"] or hashlib.sha256(file.read_bytes()).hexdigest() != pin["sha256"]:
        raise RuntimeError("Extraction input pin changed")
if not json.loads((HERE / "ROOT-CONSUMER-REVIEW.json").read_text())["admit_selected_extraction"]:
    raise RuntimeError("Consumer source gate held")

def bound():
    if time.monotonic() - start > 30:
        raise RuntimeError("Selected extraction effort bound exceeded")

digest = hashlib.sha256()
with (HERE / "candidate/makehuman_system_assets_cc0.zip").open("rb") as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        bound()
        digest.update(chunk)
if digest.hexdigest() != plan["source_archive_sha256"]:
    raise RuntimeError("Archive byte identity changed")

files = []
total = 0
with zipfile.ZipFile(HERE / "candidate/makehuman_system_assets_cc0.zip") as archive:
    infos = {i.filename: i for i in archive.infolist()}
    for name in plan["members"]:
        p = PurePosixPath(name)
        info = infos[name]
        if (not p.parts or p.is_absolute() or ".." in p.parts or "\\" in name or ":" in name
                or info.is_dir() or stat.S_IFMT(info.external_attr >> 16) not in (0, stat.S_IFREG)
                or info.flag_bits & 1 or info.file_size > 20_000_000):
            raise RuntimeError("Unadmitted selected archive member: " + name)
        total += info.file_size
    if total != plan["total_selected_bytes"] or total > 100_000_000:
        raise RuntimeError("Selected metadata byte bound mismatch")
    bound()
    root.mkdir(exist_ok=False)
    for name in plan["members"]:
        bound()
        path = root / name
        if not path.resolve().is_relative_to(root.resolve()):
            raise RuntimeError("Selected destination escapes root")
        raw = archive.read(name)  # Opaque bytes, CRC checked; no image or geometry decoder.
        if len(raw) != infos[name].file_size:
            raise RuntimeError("Selected member size mismatch")
        bound()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as out:
            out.write(raw)
        path.chmod(0o444)
        files.append({"member": name, "path": str(path), "bytes": len(raw),
                      "sha256": hashlib.sha256(raw).hexdigest(), "crc_checked": True})
bound()
report = {"finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "elapsed_seconds": time.monotonic() - start,
          "archive_sha256": digest.hexdigest(), "destination": str(root),
          "files": files, "file_count": len(files), "bytes": total,
          "limit": "Exact active GAMEENGINE face input files only. Native inputs/config/expression/rest-bind/rig/export and appearance still unqualified; localcache origin, no currentserver byteidentity. No global installation/preferences, image/mesh decode or native execution."}
with (HERE / "EXTRACTED.json").open("x") as out:
    json.dump(report, out, indent=2)
    out.write("\n")
print(json.dumps(report, indent=2))
