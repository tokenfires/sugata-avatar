"""Copy one preserved local cache and validate central-directory metadata only."""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import time
import zipfile

HERE = Path(__file__).resolve().parent
SOURCE = Path("/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/.cache/makehuman_system_assets_cc0.zip")
DEST = HERE / "candidate" / "makehuman_system_assets_cc0.zip"
LIMIT = 300_000_000

start = time.monotonic()
count = 0
def check_time():
    if time.monotonic() - start > 300:
        raise RuntimeError("Acquisition effort bound exceeded")

job = {"started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
       "pid": os.getpid(), "source": str(SOURCE), "destination": str(DEST),
       "origin": "Existing named local installer cache; current server byte identity unverified",
       "compressed_cap": LIMIT, "uncompressed_cap": 1_000_000_000,
       "seconds_cap": 300, "success": False}
with (HERE / "CACHE-start.json").open("x") as out:
    json.dump(job, out, indent=2)
try:
    DEST.parent.mkdir(exist_ok=False)
    partial = DEST.with_suffix(".zip.partial")
    digest = hashlib.sha256()
    if SOURCE.is_symlink() or not SOURCE.is_file():
        raise RuntimeError("Require regular non-symlink cache source")
    source_stat = SOURCE.stat()
    job["source_before"] = {"bytes": source_stat.st_size, "mtime_ns": source_stat.st_mtime_ns}
    if source_stat.st_size != 280737770 or source_stat.st_size > LIMIT:
        raise RuntimeError("Cache metadata changed or too large")
    with SOURCE.open("rb") as response, partial.open("xb") as out:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            count += len(chunk)
            check_time()
            if count > LIMIT:
                raise RuntimeError("Transfer bound exceeded")
            out.write(chunk)
            digest.update(chunk)
    check_time()
    source_after = SOURCE.stat()
    job["source_after"] = {"bytes": source_after.st_size, "mtime_ns": source_after.st_mtime_ns}
    if job["source_before"] != job["source_after"] or count != source_stat.st_size:
        raise RuntimeError("Cache metadata changed during copy or byte count mismatch")
    partial.rename(DEST)
    job.update(bytes=count, sha256=digest.hexdigest())
    with zipfile.ZipFile(DEST) as archive:
        infos = archive.infolist()
        if len(infos) > 10000 or sum(i.file_size for i in infos) > 1_000_000_000:
            raise RuntimeError("Archive metadata bounds exceeded")
        seen = set()
        types = {}
        for info in infos:
            check_time()
            path = PurePosixPath(info.filename)
            key = str(path).casefold()
            if not path.parts or path.is_absolute() or ".." in path.parts or "\\" in info.filename or ":" in info.filename or key in seen:
                raise RuntimeError("Unsafe or duplicate archive path: " + info.filename)
            seen.add(key)
            mode_type = stat.S_IFMT(info.external_attr >> 16)
            if mode_type not in (0, stat.S_IFREG, stat.S_IFDIR) or info.flag_bits & 1:
                raise RuntimeError("Special or encrypted archive member: " + info.filename)
            if info.is_dir() != (mode_type == stat.S_IFDIR) and mode_type != 0:
                raise RuntimeError("Conflicting directory mode: " + info.filename)
            types[key] = info.is_dir()
        for key in types:
            for parent in PurePosixPath(key).parents:
                if str(parent) in types and not types[str(parent)]:
                    raise RuntimeError("Archive file/parent conflict: " + key)
        required = ["high-poly.mhclo", "teeth_base.mhclo", "tongue01.mhclo",
                    "eyebrow001.mhclo", "eyelashes01.mhclo"]
        matches = {name: [i.filename for i in infos if not i.is_dir() and
                         stat.S_IFMT(i.external_attr >> 16) in (0, stat.S_IFREG) and
                         PurePosixPath(i.filename).name == name]
                   for name in required}
        manifest = {"archive_sha256": digest.hexdigest(), "member_count": len(infos),
                    "total_uncompressed_bytes": sum(i.file_size for i in infos),
                    "required_matches": matches,
                    "members": [{"name": i.filename, "bytes": i.file_size,
                                 "compressed_bytes": i.compress_size, "crc32": i.CRC,
                                 "compression": i.compress_type, "external_attr": i.external_attr}
                                for i in infos]}
        with (HERE / "ZIP-MANIFEST.json").open("x") as out:
            json.dump(manifest, out, indent=2)
            out.write("\n")
        if not all(len(m) == 1 for m in matches.values()):
            raise RuntimeError("Required face member missing or ambiguous")
        check_time()
        job.update(success=True, required_matches=matches, member_count=len(infos),
                   total_uncompressed_bytes=manifest["total_uncompressed_bytes"])
except Exception as error:
    job["error"] = repr(error)
finally:
    job.update(downloaded_bytes=count, finished_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               elapsed_seconds=time.monotonic() - start)
    with (HERE / "CACHE.json").open("x") as out:
        json.dump(job, out, indent=2)
        out.write("\n")
    print(json.dumps({k: v for k, v in job.items() if k != "headers"}, indent=2))
if not job["success"]:
    raise SystemExit(1)
