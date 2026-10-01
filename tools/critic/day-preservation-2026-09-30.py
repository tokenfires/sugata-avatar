"""Read-only verification of the day's frozen evidence and accepted asset pins."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
out = (ROOT / (sys.argv[1] if len(sys.argv) > 1 else "captures/day-preservation-2026-09-30-v1")).resolve()
assert out.parent == ROOT / "captures"
out.mkdir(exist_ok=False)
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
digest = lambda p: hashlib.file_digest(p.open("rb"), "sha256").hexdigest()
report = {"started": now(), "pid": os.getpid(), "status": "running", "manifests": [],
          "accepted": [], "references": [], "errors": [], "limits": "Local bytes only; no off-machine backup, semantic requalification, or final process/automation shutdown claim."}
def save():
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")

save()
shutil.copyfile(__file__, out / "instrument.py")
report["instrumentSHA256"] = digest(Path(__file__))
try:
    unique = {}
    for manifest in sorted((ROOT / "docs/evidence").rglob("*archive*.json")):
        relative = str(manifest.relative_to(ROOT))
        if "2026-09-30" not in relative:
            continue
        data = json.loads(manifest.read_text())
        entries = data.get("files") if isinstance(data.get("files"), list) else data.get("entries")
        assert isinstance(entries, list), relative
        expected_count = data.get("fileCount", data.get("files") if isinstance(data.get("files"), int) else len(entries))
        expected_bytes = data.get("totalBytes", data.get("bytes"))
        assert expected_count == len(entries), relative
        assert expected_bytes == sum(entry["bytes"] for entry in entries), relative
        target = out / "manifests" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(manifest, target)
        row = {"path": relative, "sha256": digest(manifest), "fileCount": len(entries),
               "bytes": expected_bytes, "writable": [], "mismatches": []}
        for entry in entries:
            p = (ROOT / entry["path"]).resolve()
            assert p.is_relative_to(ROOT), entry["path"]
            actual = {"bytes": p.stat().st_size, "sha256": digest(p)}
            if actual != {k: entry[k] for k in ["bytes", "sha256"]}:
                row["mismatches"].append({"expected": entry, "actual": actual})
            if p.stat().st_mode & 0o222:
                row["writable"].append(entry["path"])
            previous = unique.setdefault(str(p.relative_to(ROOT)), actual)
            assert previous == actual, "File changed while inventorying"
        assert digest(target) == row["sha256"] == digest(manifest)
        report["manifests"].append(row)
        save()
    pins = {
        "assets/figures/figure_g050.glb": "b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14",
        "assets/wardrobe/body/g050.glb": "fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a",
        "assets/wardrobe/female_casualsuit01/g050.glb": "44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783",
        "assets/wardrobe/foundation_bra/g050.glb": "4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79",
        "assets/wardrobe/foundation_briefs/g050.glb": "53f81630df24817f89bd7f8b59d58977b180855adc54d7f439f54a23f2757747",
        "assets/hair/bob02/g050.glb": "a666a80777f0b93a824857dc2e2cbffe27cd2c8991a3f4ec8215ebc1d94298bd",
        "assets/hair/bob01/g050.glb": "d425444f3d478c63e4842f7a789aa89ac1968c7d13b5aac87ca6717700df56e7",
        "tools/figure-pipeline/build_figure.py": "8470ba8b949058d7127cdb22458ed83d1c611042e2f366f1371da698056559f2",
    }
    for file, expected in pins.items():
        actual = digest(ROOT / file)
        report["accepted"].append({"path": file, "expected": expected, "actual": actual, "match": actual == expected})
    index = ROOT / "reference/bob-appearance-2026-09-29/index.json"
    report["referenceIndexSHA256"] = digest(index)
    shutil.copyfile(index, out / "reference-index.json")
    for entry in json.loads(index.read_text())["references"]:
        p = index.parent / entry["file"]
        actual = {"bytes": p.stat().st_size, "sha256": digest(p)}
        report["references"].append({"id": entry["id"], "path": str(p.relative_to(ROOT)),
            "actual": actual, "match": actual == {k: entry[k] for k in ["bytes", "sha256"]}})
    report["uniqueFiles"] = len(unique)
    report["uniqueBytes"] = sum(e["bytes"] for e in unique.values())
    report["manifestRows"] = sum(m["fileCount"] for m in report["manifests"])
    report["passed"] = (bool(report["manifests"]) and all(not m["mismatches"] and not m["writable"] for m in report["manifests"])
                        and all(e["match"] for e in report["accepted"] + report["references"]))
    report["status"] = "verified" if report["passed"] else "failed"
except Exception as error:
    report["status"] = "failed"
    report["errors"].append(repr(error))
finally:
    report["finished"] = now()
    save()
print(json.dumps({"status": report["status"], "reportSHA256": digest(out / "report.json"),
    "manifests": len(report["manifests"]), "uniqueFiles": report.get("uniqueFiles")}))
sys.exit(0 if report["status"] == "verified" else 1)
