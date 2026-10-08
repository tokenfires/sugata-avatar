"""Prepare exact isolated authoring inputs, without native construction or decoding."""
import ast
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import posixpath
import stat
import time
import zipfile

HERE = Path(__file__).resolve().parent
REPO = Path("/Users/robault/GitHub/sugata-avatar")
PACKAGE = Path("/Users/robault/Library/Application Support/Blender/5.2/extensions/blender_org/mpfb")
WORK = HERE / "work"
start = time.monotonic()
records = []
archives = []
total = 0
plan = json.loads((HERE / "ACQUIRE-PLAN.json").read_text())
for pin in plan["pins"]:
    file = Path(pin["path"])
    if file.stat().st_size != pin["bytes"] or hashlib.sha256(file.read_bytes()).hexdigest() != pin["sha256"]:
        raise RuntimeError("Acquisition source/plan input changed")
source_pins = json.loads((HERE / "SOURCE-PINS.json").read_text())
for pin in source_pins["source_pins"]:
    file = Path(pin["path"])
    if file.stat().st_size != pin["bytes"] or hashlib.sha256(file.read_bytes()).hexdigest() != pin["sha256"]:
        raise RuntimeError("Installed source changed")
for item in source_pins["exact_named_installer_caches"]:
    file = Path(item["path"])
    if file.is_symlink() or not file.is_file() or file.stat().st_size != item["bytes"] or file.stat().st_mtime_ns != item["mtime_ns"]:
        raise RuntimeError("Named cache metadata changed")

def bound():
    if time.monotonic() - start > 120 or len(records) > 2500 or total > 200_000_000:
        raise RuntimeError("Input acquisition bound exceeded")

def store(raw, destination, origin):
    global total
    bound()
    if total + len(raw) > 200_000_000 or len(records) >= 2500:
        raise RuntimeError("Prospective input bound exceeded")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("xb") as stream:
        stream.write(raw)
    destination.chmod(0o444)
    total += len(raw)
    records.append({"path": str(destination), "origin": origin, "bytes": len(raw),
                    "sha256": hashlib.sha256(raw).hexdigest()})

def read_source(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 100_000_000:
        raise RuntimeError("Unsupported source file: " + str(path))
    before = path.stat()
    raw = path.read_bytes()
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError("Source changed during read: " + str(path))
    return raw

def checked_archive(path):
    raw = read_source(path)
    archives.append({"path": str(path), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
    archive = zipfile.ZipFile(path)
    seen = set()
    types = {}
    total_zip = 0
    for info in archive.infolist():
        p = PurePosixPath(info.filename)
        key = str(p).casefold()
        if (not p.parts or p.is_absolute() or ".." in p.parts or "\\" in info.filename
                or ":" in info.filename or key in seen or info.flag_bits & 1
                or stat.S_IFMT(info.external_attr >> 16) not in (0, stat.S_IFREG, stat.S_IFDIR)):
            raise RuntimeError("Unsupported archive member: " + info.filename)
        seen.add(key)
        mode_type = stat.S_IFMT(info.external_attr >> 16)
        if mode_type != 0 and info.is_dir() != (mode_type == stat.S_IFDIR):
            raise RuntimeError("Conflicting archive directory mode")
        types[key] = info.is_dir()
        total_zip += info.file_size
    for key in types:
        for parent in PurePosixPath(key).parents:
            if str(parent) in types and not types[str(parent)]:
                raise RuntimeError("Archive file/parent conflict")
    if len(seen) > 10000 or total_zip > 1_000_000_000:
        raise RuntimeError("Archive metadata bound exceeded")
    return archive

WORK.mkdir(exist_ok=False)
data_source = PACKAGE / "data"
for file in sorted(data_source.rglob("*")):
    bound()
    if file.is_symlink():
        raise RuntimeError("Unexpected data symlink: " + str(file))
    if file.is_file():
        store(read_source(file), WORK / "mpfb/data" / file.relative_to(data_source), str(file))
data_metadata = json.loads((HERE / "DATA-METADATA.json").read_text())
if len(records) != data_metadata["regular_file_count"] or total != data_metadata["aggregate_bytes"]:
    raise RuntimeError("Canonical data bundle count/bytes changed")

face_packet = REPO / "docs/evidence/appearance-2026-10-07/ari-system-assets"
faces = json.loads((face_packet / "EXTRACTED.json").read_text())
for item in faces["files"]:
    raw = read_source(Path(item["path"]))
    if hashlib.sha256(raw).hexdigest() != item["sha256"]:
        raise RuntimeError("Frozen face bytes changed")
    store(raw, WORK / "user/data" / item["member"], item["path"])

for name in ("faceunits01.zip", "visemes01.zip", "visemes02.zip"):
    source = REPO / "tools/figure-pipeline/.cache" / name
    with checked_archive(source) as archive:
        for info in archive.infolist():
            bound()
            if info.is_dir():
                continue
            if stat.S_IFMT(info.external_attr >> 16) not in (0, stat.S_IFREG) or info.file_size > 2_000_000:
                raise RuntimeError("Oversize functional target member")
            store(archive.read(info), WORK / "user/data" / info.filename, str(source) + "!" + info.filename)

# Selected skin's active GAMEENGINE file inputs, with exact material retained.
skin_name = "skins/young_caucasian_female/young_caucasian_female.mhmat"
skin_source = face_packet / "candidate/makehuman_system_assets_cc0.zip"
if skin_source.is_symlink() or not skin_source.is_file() or skin_source.stat().st_size != 280737770:
    raise RuntimeError("Frozen system archive metadata changed")
skin_digest = hashlib.sha256()
with skin_source.open("rb") as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        bound()
        skin_digest.update(chunk)
skin_sha = skin_digest.hexdigest()
if skin_sha != "b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107":
    raise RuntimeError("Frozen system archive changed")
archives.append({"path": str(skin_source), "bytes": skin_source.stat().st_size, "sha256": skin_sha})
with zipfile.ZipFile(skin_source) as archive:
    raw = archive.read(skin_name)
    text = raw.decode("utf-8")
    store(raw, WORK / "user/data" / skin_name, str(skin_source) + "!" + skin_name)
    selected = set()
    for number, line in enumerate(text.splitlines(), 1):
        words = line.split(None, 1)
        if len(words) != 2 or words[0].startswith("#"):
            continue
        key = words[0].lower()
        if key in ("diffusetexture", "diffusemaptexture", "albedotexture", "albedomaptexture", "basecolortexture", "basecolormaptexture", "normalmaptexture"):
            value = words[1].strip()
            target = posixpath.normpath(posixpath.join(str(PurePosixPath(skin_name).parent), value))
            if value.startswith("/") or "\\" in value or ":" in value or target.startswith("../"):
                raise RuntimeError("Unsupported skin reference")
            selected.add(target)
    if not selected:
        raise RuntimeError("Selected skin has no owned GAMEENGINE texture")
    for name in sorted(selected):
        info = archive.getinfo(name)
        if info.is_dir() or info.file_size > 40_000_000:
            raise RuntimeError("Unsupported skin texture")
        store(archive.read(name), WORK / "user/data" / name, str(skin_source) + "!" + name)
    (HERE / "SKIN-WITNESS.json").write_text(json.dumps({"member": skin_name, "text": text,
        "active_texture_members": sorted(selected), "limit": "Retain legacy declarations; GAMEENGINE only consumes selected diffuse/normal images. No image decode."}, indent=2) + "\n")

bound()
report = {"finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "elapsed_seconds": time.monotonic() - start, "file_count": len(records), "bytes": total,
          "archives": archives, "files": records, "work": str(WORK),
          "limit": "Opaque byte/CRC input copy only; source data retained, original files unmodified. No target geometry parsing, native execution or appearance qualification."}
with (HERE / "INPUTS.json").open("x") as out:
    json.dump(report, out, indent=2)
    out.write("\n")
print(json.dumps({k: v for k, v in report.items() if k != "files"}, indent=2))
