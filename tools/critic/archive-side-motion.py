"""Archive the four completed, frozen side-motion runs. No geometry or rendering work."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--inspect", action="store_true", help="Print ownership/status; write nothing.")
args = parser.parse_args()
assert Path.cwd().resolve() == Path(__file__).resolve().parents[2], "Run from repository root"
jobs = []
for protocol, view, states, images in [("head", "right-profile", 556, 186), ("ordinary", "left-profile", 721, 241)]:
    for arm in ["baseline", "candidate"]:
        root = Path(f"captures/side-{protocol}-v1/{arm}-{view}-brown")
        progress = read(root / "audit-progress.json")
        jobs.append(dict(protocol=protocol, arm=arm, root=root, states=states, images=images, progress=progress))
status = [dict(protocol=j["protocol"], arm=j["arm"], pid=j["progress"]["pid"],
               status=j["progress"]["status"], savedStates=len(j["progress"]["rows"])) for j in jobs]
if args.inspect:
    print(json.dumps(status, indent=2))
    raise SystemExit(0)
assert all(j["progress"]["status"] == "complete" for j in jobs), f"Audits unfinished; no files written: {status}"

out = Path("docs/evidence/hair-2026-09-29/side-motion")
assert not (out / "archive-manifest.json").exists(), "Final archive already exists; inspect before rewriting"
summary = read(out / "summary.json")
for protocol in ["head", "ordinary"]:
    paired = Path(f"captures/side-{protocol}-v1/paired-controls.json")
    assert digest(paired) == summary["protocols"][protocol]["pairedControlsSha256"]
for number, record in summary["nativeReview"].items():
    assert digest(Path(f"captures/side-review-v{number}/report.json")) == record["reportSha256"]
for j in jobs:
    root = j["root"]
    report = read(root / "report.json")
    audit = read(root / "numerical-checks.json")
    assert audit == j["progress"], f"Final/progress disagree: {root}"
    assert report["status"] == "captured" and not report["errors"]
    assert len(report["samples"]) == j["states"] and len(report["images"]) == j["images"]
    assert [r["frame"] for r in audit["rows"]] == list(range(j["states"]))
    assert len(audit["selectedCards"]) == 338 and audit["selectedTriangles"] == 10816
    assert audit["selectedCards"] == report["setup"]["descriptor"]["selectedCards"]
    assert audit["reportSha256"] == digest(root / "report.json")
    assert audit["sourceReport"] == str(root / "report.json")
    old = summary["protocols"][j["protocol"]]["arms"][j["arm"]]
    assert old["reportSha256"] == audit["reportSha256"], "Frozen capture report changed"
    j.update(report=report, audit=audit)

asset_pins = {
    "captures/bob-posterior-envelope-v3/candidate.glb": summary["baselineSha256"],
    "captures/bob-side-envelope-v3/candidate.glb": summary["candidateSha256"],
}
for file, expected in asset_pins.items():
    assert digest(Path(file)) == expected, f"Frozen asset changed: {file}"

roots = [Path(f"captures/{name}") for name in ["side-head-v1", "side-ordinary-v1", "side-review-v1", "side-review-v2"]]
audit_snapshot = Path("captures/side-motion-audit-source-v1")
expected_sources = {}
for j in jobs:
    for file, expected in j["audit"]["sourceHashes"].items():
        assert file not in expected_sources or expected_sources[file] == expected
        expected_sources[file] = expected
# Preserve verified source bytes independently of a future change to the checkout.
# A partially copied snapshot can resume only when every existing file matches its pin.
for file, expected in expected_sources.items():
    target = audit_snapshot / file
    if target.exists():
        assert digest(target) == expected, f"Existing audit snapshot differs: {target}"
    else:
        origin = Path(file)
        assert digest(origin) == expected, f"Live audit source differs from recorded pin: {origin}"
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(origin.read_bytes())
        assert digest(target) == expected
roots.append(audit_snapshot)
files = []
for root in roots:
    assert root.is_dir()
    for p in sorted(root.rglob("*")):
        if p.is_file():
            files.append(dict(path=str(p), bytes=p.stat().st_size, sha256=digest(p)))
index = {f["path"]: f for f in files}
assert len(index) == len(files)
for j in jobs:
    root, report = j["root"], j["report"]
    for sample in report["samples"]:
        assert index[str(root / sample["geometryFile"])]["sha256"] == sample["geometrySha256"]
    for image in report["images"]:
        assert index[str(root / image["file"])]["sha256"] == image["sha256"]
    for source, expected in report["sourceHashes"].items():
        snapshot = root / "source" / source
        if source.startswith(("tools/", "packages/")):
            assert index[str(snapshot)]["sha256"] == expected, f"Source snapshot changed: {snapshot}"

generated = datetime.datetime.now(datetime.timezone.utc).isoformat()
source = Path("tools/critic/archive-side-motion.py")
manifest = dict(generated=generated, roots=[str(p) for p in roots], fileCount=len(files),
                totalBytes=sum(f["bytes"] for f in files), pngCount=sum(f["path"].endswith(".png") for f in files),
                generator=dict(path=str(source), sha256=digest(source)), frozenAssets=asset_pins, files=files)
summary["generated"] = generated
summary["status"] = "captures-paired-data-and-body-audits-complete; sampled-appearance-positive; experimental"
for j in jobs:
    root, audit = j["root"], j["audit"]
    item = summary["protocols"][j["protocol"]]["arms"][j["arm"]]
    item.pop("auditSnapshot", None)
    item["auditResult"] = dict(file=str(root / "numerical-checks.json"),
        sha256=index[str(root / "numerical-checks.json")]["sha256"], summary=audit["summary"],
        finished=audit["finished"], pid=audit["pid"],
        minimumRow=min(audit["rows"], key=lambda row: row["minimumVertexClearanceMm"]),
        negativeVertexCount=sum(row["negativeVertices"] for row in audit["rows"]))
summary["limits"] = [
    "Completed sampled body audits and reviewed still images do not promote the candidate or establish all-motion acceptance.",
    "Selected body contacts omit garments, other-card contact, hair-hair, final alpha/occlusion and time between captured updates.",
    "Discrete actual-image inspection does not establish continuous perceptual quality or settling.",
    "Raw evidence remains local in ignored captures directories; the tracked manifest preserves paths and hashes, not the files themselves.",
]
summary["archive"] = {k: v for k, v in manifest.items() if k != "files"}
# The manifest is the completion marker. A stop before its final rename permits a
# retry; the already-published summary retains the same source pins on that retry.
manifest_pending = out / ".archive-manifest.pending.json"
summary_pending = out / ".summary.pending.json"
write(manifest_pending, manifest)
write(summary_pending, summary)
summary_pending.replace(out / "summary.json")
manifest_pending.replace(out / "archive-manifest.json")
print(json.dumps({k: v for k, v in manifest.items() if k != "files"}, indent=2))
