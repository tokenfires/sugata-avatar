import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

started = datetime.now(timezone.utc).isoformat()
folder = Path(__file__).resolve().parent
repo = folder.parents[3]
files = [
    'docs/evidence/hair-2026-10-03/surface-guides/PLAN.md',
    'docs/evidence/hair-2026-10-03/surface-guides/EXECUTION.md',
    'docs/evidence/hair-2026-10-03/surface-guides/model.mjs',
    'docs/evidence/hair-2026-10-03/surface-guides/preview.mjs',
    'docs/evidence/hair-2026-10-03/surface-guides/preview.html',
    'docs/evidence/hair-2026-10-03/surface-guides/GUIDES.json',
    'docs/evidence/hair-2026-10-03/surface-guides/SOURCE-TRIANGLES.json',
    'docs/evidence/hair-2026-10-03/surface-guides/SOURCE-HISTORY.md',
    'docs/evidence/hair-2026-10-03/surface-guides/ROOT-LITERAL.json',
    'docs/evidence/hair-2026-10-03/surface-guides/critic-source-pins.py',
    'looks/ink-denim.json',
    'packages/core/src/Avatar.js',
    'packages/core/src/figure/Figure.js',
    'packages/core/src/wardrobe/Wardrobe.js',
    'packages/core/src/render/Stage.js',
    'packages/testbed/src/showcase-presets.mjs',
    'node_modules/three/src/extras/curves/CatmullRomCurve3.js',
    'node_modules/three/src/extras/core/Curve.js',
    'node_modules/three/src/core/BufferGeometry.js',
    'node_modules/three/src/objects/SkinnedMesh.js',
    'node_modules/three/src/objects/Mesh.js',
    'node_modules/three/src/cameras/PerspectiveCamera.js',
    'node_modules/three/src/renderers/common/Renderer.js',
]
pins = {}
for name in files:
    data = (repo / name).read_bytes()
    pins[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
result = {
    'command': 'python3 docs/evidence/hair-2026-10-03/surface-guides/critic-source-pins.py',
    'pid': os.getpid(), 'started': started,
    'ended': datetime.now(timezone.utc).isoformat(), 'pins': pins,
    'scope': 'Read and hash existing source/input files only. No module import, asset parse, curve/surface evaluation, geometry, browser, GPU or native execution. This pins a source review, not runtime behavior.',
}
target = folder / 'CRITIC-SOURCE-PINS.json'
target.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
