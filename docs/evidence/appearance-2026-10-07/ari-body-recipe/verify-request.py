"""Static source/request association only. No runtime imports or binary assets."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import subprocess

ROOT = Path(__file__).resolve().parents[4]
PACKET = Path(__file__).resolve().parent
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
plan = json.loads((PACKET / "PLAN.json").read_text())
pins = []
for pin in plan["input_pins"]:
    path = ROOT / pin["path"]
    assert path.suffix in (".md", ".json", ".png", ".js", ".mjs", ".py")
    data = path.read_bytes()
    assert len(data) == pin["bytes"]
    assert hashlib.sha256(data).hexdigest() == pin["sha256"], pin["path"]
    pins.append(pin["path"])

leads = json.loads((ROOT / plan["input_pins"][2]["path"]).read_text())
recipe = json.loads((PACKET / "RECIPE.json").read_text())
assert recipe["executable"] is False
assert recipe["status"] == "held-before-construction"
assert len(recipe["recipe"]) == len(plan["proposed_recipe"]) == 8
expected_targets = []
for choice, request, declaration in zip(plan["proposed_recipe"], recipe["recipe"], leads["declared_only_sliders"]):
    assert choice["slider_id"] == request["slider_id"] == declaration["id"]
    assert all(request[key] == value for key, value in choice.items())
    ends = {key: value for key, value in declaration["ends"].items() if key.startswith("positive-")}
    assert request["declared_positive_ends"] == ends
    assert len(ends) == (2 if declaration["sided"] else 1)
    for key, end in ends.items():
        expected_targets.append({
            "slider_id": declaration["id"], "side": key.removeprefix("positive-"),
            "native_target": declaration["region"] + "/" + end["target"],
            "region": declaration["region"], "weight": choice["value"],
            "catalogue_offset": end["offset"], "catalogue_count": end["count"],
            "execution": "held; no bytes read or offsets applied"
        })
assert recipe["expanded_request_targets"] == expected_targets
assert len(expected_targets) == 10

presentation = json.loads((PACKET / "PRESENTATION.json").read_text())
board = (ROOT / presentation["path"]).read_bytes()
prior = subprocess.check_output(["git", "show", "6e8fe98:docs/ARTIST-WARDROBE.html"], cwd=ROOT)
assert hashlib.sha256(board).hexdigest() == presentation["after_sha256"]
assert hashlib.sha256(prior).hexdigest() == presentation["before_sha256"]
assert board.decode().count(presentation["addition"]) == 1
assert board.decode().replace(presentation["addition"], "").encode() == prior

links = []
for name in ["AUTHORING-REQUEST.md", "README.md"]:
    for raw in re.findall(r"\]\(([^)]+)\)", (PACKET / name).read_text()):
        assert not raw.startswith(("http:", "https:"))
        clean = re.sub(r":\d+$", "", raw)
        target = Path(clean) if clean.startswith("/") else PACKET / clean
        assert target.resolve().is_relative_to(ROOT)
        assert target.is_file(), raw
        links.append({"document": name, "link": raw})

changed = subprocess.check_output(["git", "diff", "--name-only"], cwd=ROOT, text=True).splitlines()
assert set(changed) <= {"docs/ARTIST-WARDROBE.html", "docs/WORK-WINDOW-2026-10-07.md"}
record = {
    "started_utc": started,
    "finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "pid": os.getpid(), "command": "python3 docs/evidence/appearance-2026-10-07/ari-body-recipe/verify-request.py",
    "observer_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "status": "pass", "input_pins": pins, "controls": 8, "target_requests": 10,
    "held_non_executable": True, "declarations_equal": True, "board_reversal_exact": True,
    "local_links_checked": links, "changed_tracked_paths": changed,
    "limits": "Static text/source/image-byte association only. No geometry/binary asset, numeric-domain validation, target execution, source trial, browser, HTTP or appearance qualification."
}
(PACKET / "STATIC-CHECK.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({key: record[key] for key in ["status", "pid", "controls", "target_requests", "board_reversal_exact"]}))
