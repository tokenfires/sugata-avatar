"""One admitted finite byte-preserving package; no art generation or rendering."""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
import datetime
import hashlib
import json
import os
import stat
import sys
import time
import zipfile

LEAF = Path(__file__).resolve().parent
START = time.perf_counter()
RAW_CAP, ZIP_CAP, FILE_CAP = 16 * 1024**2, 8 * 1024**2, 32
created = []
result = {"schema": "ari-portablekit-actual-package-v1", "pid": os.getpid(),
          "started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat()}


def check():
    if time.perf_counter() - START > 10:
        raise RuntimeError("10s cooperative packaging deadline")


def read(path):
    check()
    with path.open("rb") as stream:
        raw = stream.read(RAW_CAP + 1)
    if len(raw) > RAW_CAP:
        raise RuntimeError("input byte cap")
    return raw


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def safe_member(name):
    q = PurePosixPath(name)
    if not name or q.is_absolute() or ".." in q.parts or "\\" in name or str(q) != name:
        raise RuntimeError("unsafe member")
    return q


class Gallery(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "base", "iframe", "object", "embed", "link"}:
            raise RuntimeError("active or external gallery surface")
        for key, value in attrs:
            if key.startswith("on"):
                raise RuntimeError("event handler")
            if key == "id":
                if value in self.ids:
                    raise RuntimeError("duplicate gallery ID")
                self.ids.add(value)
            if key in {"src", "href"}:
                self.links.append(value)


def main():
    if len(sys.argv) != 2:
        raise RuntimeError("one exact admission SHA required")
    admission_raw = read(LEAF / "PACKAGE-ADMISSION.json")
    if digest(admission_raw) != sys.argv[1]:
        raise RuntimeError("admission identity")
    admission = json.loads(admission_raw)
    now = datetime.datetime.now(datetime.timezone.utc)
    if now > datetime.datetime.fromisoformat(admission["expires_utc"]) or now > datetime.datetime.fromisoformat(admission["absolute_deadline_utc"]):
        raise RuntimeError("admission expired")
    for row in admission["pins"]:
        raw = read(Path(row["path"]))
        if len(raw) != row["bytes"] or digest(raw) != row["sha256"]:
            raise RuntimeError("changed admitted input: " + row["path"])
    result["admission_sha256"] = digest(admission_raw)
    config = json.loads(read(LEAF / "FILES.json"))
    payload, members = {}, []
    for row in config["art_files"]:
        name = row["package_path"]
        safe_member(name)
        source = Path(row["source_path"])
        if any(q.is_symlink() for q in [source, *source.parents]):
            raise RuntimeError("symlink art source")
        raw = read(source)
        if name in payload or len(raw) != row["bytes"] or digest(raw) != row["sha256"]:
            raise RuntimeError("art identity or duplicate member")
        payload[name] = raw
        members.append({**row, "kind": "unchanged accepted art/data"})
    if len(payload) != 13 or sum(map(len, payload.values())) != 3342469:
        raise RuntimeError("finite art selection mismatch")
    for source_name, name in [("gallery.html", "index.html"), ("KIT-README.md", "README.md")]:
        raw = read(LEAF / source_name)
        payload[name] = raw
        members.append({"package_path": name, "source_path": str(LEAF / source_name),
                        "bytes": len(raw), "sha256": digest(raw), "kind": "new static delivery text"})
    manifest = {"schema": "ari-portable-artist-files-v1", "reference_asset_Git_commit": config["reference_asset_Git_commit"],
                "members_excluding_this_manifest": members, "manifest_self_excluded": True,
                "historical_path_mappings": config["historical_path_mappings"],
                "scope": "13 unchanged accepted 2D art/data files; new static gallery/notes. No new art, fit, 3D, runtime or AAA qualification.",
                "browser_scope": "Closed local file graph only at packaging time; actual file:// operation needs its separate later gate."}
    payload["MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    if len(payload) > FILE_CAP or sum(map(len, payload.values())) > RAW_CAP:
        raise RuntimeError("package file/raw cap")
    gallery = Gallery()
    gallery_text = payload["index.html"].decode()
    if any(token in gallery_text for token in ["url(", "@import", "<script"]):
        raise RuntimeError("gallery style/script dependency")
    gallery.feed(gallery_text)
    gallery.close()
    for value in gallery.links:
        if value.startswith("#"):
            if value[1:] not in gallery.ids:
                raise RuntimeError("missing local anchor")
        elif str(safe_member(value)) not in payload:
            raise RuntimeError("missing active file")
    out, archive = LEAF / "ari-artist-kit", LEAF / "ari-artist-kit.zip"
    if any(q.exists() or q.is_symlink() for q in [out, archive, LEAF / "PACKAGE-RESULT.json"]):
        raise RuntimeError("output already exists")
    out.mkdir()
    created.append(str(out))
    for name, raw in payload.items():
        check()
        target = out.joinpath(*safe_member(name).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(raw)
        created.append(str(target))
        if read(target) != raw:
            raise RuntimeError("copy readback")
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        created.append(str(archive))
        for name, raw in payload.items():
            check()
            info = zipfile.ZipInfo("ari-artist-kit/" + name, date_time=(2026, 10, 19, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            bundle.writestr(info, raw, compresslevel=6)
    archive_raw = read(archive)
    if len(archive_raw) > ZIP_CAP:
        raise RuntimeError("ZIP cap")
    with zipfile.ZipFile(archive) as bundle:
        if bundle.namelist() != ["ari-artist-kit/" + name for name in payload] or bundle.testzip() is not None:
            raise RuntimeError("archive membership or CRC")
        for name, raw in payload.items():
            check()
            if bundle.read("ari-artist-kit/" + name) != raw:
                raise RuntimeError("archive byte identity")
    check()
    result.update(status="complete", archive={"path": str(archive), "bytes": len(archive_raw), "sha256": digest(archive_raw)},
                  members=[{"path": str(out / name), "package_path": name, "bytes": len(raw), "sha256": digest(raw)} for name, raw in payload.items()],
                  art_files=13, files=len(payload), raw_bytes=sum(map(len, payload.values())),
                  active_gallery_links=len(gallery.links), static_file_graph_closed=True,
                  historical_path_mappings=manifest["historical_path_mappings"],
                  browser_qualified=False, limits="10s cooperative post-import checks, not hard OS wall/peak-memory limit. No browser/editor/physical-fit/appearance qualification.")


try:
    main()
except Exception as error:
    result.update(status="failed", error=repr(error))
finally:
    result.update(created=created, completed_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), checked_elapsed_ms=(time.perf_counter() - START) * 1000)
    with (LEAF / "PACKAGE-RESULT.json").open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(json.dumps(result))
if result["status"] != "complete":
    sys.exit(1)
