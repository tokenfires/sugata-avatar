"""Inspect only nominated face text and references inside the isolated ZIP."""
import ast
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
import time
import zipfile

HERE = Path(__file__).resolve().parent
start = time.monotonic()
archive_path = HERE / "candidate/makehuman_system_assets_cc0.zip"
manifest = json.loads((HERE / "ZIP-MANIFEST.json").read_text())
plan = json.loads((HERE / "DEPENDENCY-PLAN.json").read_text())
if manifest["archive_sha256"] != plan["source_archive_sha256"]:
    raise RuntimeError("Archive manifest identity mismatch")
digest = hashlib.sha256()
with archive_path.open("rb") as stream:
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        if time.monotonic() - start > 30:
            raise RuntimeError("Archive identity check bound exceeded")
        digest.update(block)
if digest.hexdigest() != plan["source_archive_sha256"]:
    raise RuntimeError("Isolated archive bytes changed")
for pin in plan["pins"]:
    if hashlib.sha256(Path(pin["path"]).read_bytes()).hexdigest() != pin["sha256"]:
        raise RuntimeError("Parser source pin changed")
keys_path = next(p["path"] for p in plan["pins"] if p["path"].endswith("mhmatkeys.py"))
tree = ast.parse(Path(keys_path).read_text())
file_keys = {n.args[0].value.lower() for n in ast.walk(tree) if isinstance(n, ast.Call)
             and isinstance(n.func, ast.Name) and n.func.id == "MhMatFileKey"}
aliases = {}
for node in ast.walk(tree):
    if isinstance(node, ast.Assign) and len(node.targets) == 1:
        target = node.targets[0]
        if isinstance(target, ast.Subscript) and isinstance(target.value, ast.Name) and target.value.id == "MHMAT_ALIAS":
            aliases[ast.literal_eval(target.slice).lower()] = ast.literal_eval(node.value).lower()

witnesses = {}
references = []
licenses = []
errors = []
total = 0
visited = set()

def bound():
    if time.monotonic() - start > 30 or len(witnesses) > 50 or total > 10_000_000:
        raise RuntimeError("Text inquiry bound exceeded")

def target(source, value):
    if "\\" in value or ":" in value or value.startswith("/"):
        raise RuntimeError("External/unsupported path: " + value)
    result = posixpath.normpath(posixpath.join(str(PurePosixPath(source).parent), value))
    if result == ".." or result.startswith("../"):
        raise RuntimeError("Reference escapes archive: " + value)
    return result

def record_license(name, number, line):
    match = re.search(r"licen[sc]e\s*:?\s+(.+)", line, re.I)
    statement = match.group(1).strip() if match else ""
    licenses.append({"member": name, "line": number, "statement": line})
    if re.search(r"AGPL|CC[- ]?BY|all rights reserved|not CC[- ]?0", statement, re.I) or not re.search(r"\bCC[- ]?0\b|publicdomain/zero|creative commons zero", statement, re.I):
        errors.append("Unknown/incompatible explicit license: " + name + ":" + str(number))

with zipfile.ZipFile(archive_path) as archive:
    infos = {i.filename: i for i in archive.infolist()}
    def text(name):
        global total
        bound()
        if name in witnesses:
            return witnesses[name]["text"]
        info = infos.get(name)
        if info is None or info.is_dir() or info.file_size > 2_000_000:
            raise RuntimeError("Missing/non-file/oversize text: " + name)
        if len(witnesses) >= 50 or total + info.file_size > 10_000_000:
            raise RuntimeError("Prospective text inquiry bound exceeded")
        raw = archive.read(name)  # ZIP CRC checked for this member; no geometry/image decoder.
        total += len(raw)
        result = raw.decode("utf-8")
        witnesses[name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "text": result}
        bound()
        return result

    def visit(name, kind):
        bound()
        if (name, kind) in visited:
            return
        visited.add((name, kind))
        if name not in infos or infos[name].is_dir():
            errors.append("Missing dependency: " + name)
            return
        if kind == "binary":
            return
        content = text(name)
        required = set()
        for number, line in enumerate(content.splitlines(), 1):
            words = line.split()
            if not words:
                continue
            if words[0].startswith("#"):
                if re.search(r"licen[sc]e", line, re.I):
                    record_license(name, number, line)
                continue
            key = words[0].lower()
            if key == "license":
                record_license(name, number, line)
            value = None
            next_kind = "binary"
            if kind == "mhclo" and (key in ("obj_file", "material") or key.startswith("vertexboneweights")):
                if len(words) != 2:
                    errors.append("Unsupported MHClO reference syntax: " + name + ":" + str(number))
                    continue
                value = words[1]
                next_kind = "obj" if key == "obj_file" else "mhmat" if key == "material" else "binary"
                required.add(key)
            elif kind == "mhmat":
                canonical_key = aliases.get(key, key)
                if canonical_key in file_keys:
                    if canonical_key in ("litspheretexture", "blendmaterial"):
                        errors.append("Builtin/blend-material dependency needs explicit ownership: " + name + ":" + str(number))
                        references.append({"from": name, "line": number, "key": key,
                                           "value": line.split(None, 1)[1].strip(), "unresolved": True})
                        continue
                    value = line.split(None, 1)[1].strip()
                    next_kind = "binary"
                elif key == "shaderparam" and "texture" in line.lower():
                    errors.append("Shader texture dependency needs explicit ownership: " + name)
            elif kind == "obj" and key == "mtllib":
                errors.append("OBJ MTL dependency needs explicit ownership: " + name + ":" + str(number))
            if value is not None:
                destination = target(name, value)
                references.append({"from": name, "line": number, "key": key,
                                   "value": value, "to": destination, "kind": next_kind,
                                   "present": destination in infos and not infos[destination].is_dir()})
                visit(destination, next_kind)
        if kind == "mhclo" and not {"obj_file", "material"}.issubset(required):
            errors.append("Incomplete MHClO geometry/material declaration: " + name)

    for matches in manifest["required_matches"].values():
        if len(matches) != 1:
            raise RuntimeError("Prior uniqueness gate changed")
        visit(matches[0], "mhclo")
bound()
report = {"observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "archive_sha256": manifest["archive_sha256"], "elapsed_seconds": time.monotonic() - start,
          "text_members": len(witnesses), "text_bytes": total, "references": references,
          "license_statements": licenses, "errors": errors,
          "closure_members": sorted({name for name, kind in visited}), "closure_pass": not errors,
          "limit": "Five-face file-reference closure only. Local-cache origin, currentserver byteidentity unverified. Publisher CC0 rows retained; header conflicts checked, not universal license audit. Selected text ZIP CRC verified. No geometry/image decode, texture content/hash, extraction, native use, appearance or complete character qualification."}
for filename, data in [("TEXT-WITNESSES.json", witnesses), ("DEPENDENCIES.json", report)]:
    with (HERE / filename).open("x") as out:
        json.dump(data, out, indent=2)
        out.write("\n")
print(json.dumps(report, indent=2))
