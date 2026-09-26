"""Read pinned cached data only; no Blender import, extraction, installation or writes."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[4]
INVENTORY = Path(__file__).with_name("inventory-v1.json")
PIN = "a5efb4f0882a47fa3276b4b059427a85d008fad28c4177030a17c358387e99f0"


def digest(data):
    return hashlib.sha256(data).hexdigest()


raw = INVENTORY.read_bytes()
assert digest(raw) == PIN, "Inventory changed"
inventory = json.loads(raw)
members = {}
for archive in inventory["archives"]:
    path = ROOT / archive["path"]
    assert digest(path.read_bytes()) == archive["sha256"], str(path)
    with zipfile.ZipFile(path) as stream:
        for entry in archive["members"]:
            data = stream.read(entry["path"])
            assert digest(data) == entry["sha256"], entry["path"]
            if entry["path"].endswith(".gz"):
                data = gzip.decompress(data)
                assert digest(data) == entry["decodedSHA256"], entry["path"]
            members[entry["path"]] = data.decode("utf-8")

def target(name):
    lines = members["data/targets/" + name + ".target.gz"].splitlines()
    return [[int(w[0]), *map(float, w[1:])] for line in lines
            if (w := line.split()) and not w[0].startswith(("#", '"'))]

recipe = inventory["sourceData"]["neutralRetainedRecipe"]
json.dump({
    "inventorySHA256": PIN,
    "baseOBJ": members["data/3dobjs/base.obj"],
    "recipe": recipe,
    "macroTargets": [{**row, "records": target(row["file"])} for row in recipe["mpfbStack"]],
    "detailTargets": [{"file": name, "records": target(name)} for name in [
        "torso/measure-shoulder-dist-incr", "legs/upperlegs-height-incr"]],
    "mhclo": members["clothes/female_casualsuit01/female_casualsuit01.mhclo"],
}, sys.stdout, separators=(",", ":"), allow_nan=False)
