"""Preservation only after Robert's explicit pause; no experiment or construction."""
import datetime, hashlib, json, os, pathlib, tomllib

root = pathlib.Path.cwd()
packet = root / 'docs/evidence/nonhair-2026-10-03/longsleeve-authoring-value'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
automation_path = pathlib.Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml')
automation = tomllib.loads(automation_path.read_text())
assert automation['status'] == 'PAUSED'
assert automation['target_thread_id'] == '01a0ff57-d720-7db2-923f-9e3e0521216c'
sources = [
    'tools/figure-pipeline/build_figure.py',
    'captures/wardrobe-native-oracle-2026-09-30-v2/source/native-mpfb/services/clothesservice.py',
    'captures/wardrobe-native-oracle-2026-09-30-v2/source/native-mpfb/entities/clothes/mhclo.py',
    'captures/wardrobe-native-oracle-2026-09-30-v2/source/native-mpfb/entities/clothes/vertexmatch.py',
    'captures/wardrobe-native-oracle-2026-09-30-v2/source/native-mpfb/ui/create_assets/makeclothes/operators/writeclotheslibrary.py',
    'docs/evidence/nonhair-2026-10-03/capsule-source/AUTHORING-RESPONSIBILITY.md',
    'docs/evidence/nonhair-2026-10-03/capsule-method/RECEIPT.md',
    'docs/evidence/wardrobe-2026-09-30/native-refit/README.md',
    'docs/evidence/wardrobe-2026-09-30/skeleton-export-bridge/README.md',
    'docs/evidence/nonhair-2026-10-03/capsule-source/inputs/male_casualsuit02.png',
    'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-body.png',
]
record = dict(pid=os.getpid(), started=started,
              finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),
              scriptSha256=digest(pathlib.Path(__file__)),
              criticSha256=digest(packet / 'CRITIC-VALUE.md'),
              inputs={name: digest(root / name) for name in sources},
              automation=dict(id=automation['id'], status=automation['status'],
                              targetThreadId=automation['target_thread_id'],
                              updatedAt=automation['updated_at'], sha256=digest(automation_path)),
              decision='Explicit human pause. No final value or construction admission.',
              jobs='Critic interrupted; no matching native/Blender/build job. Review PID1023 retained.',
              resume='Await explicit human resume; timer remains paused across restart.')
(packet / 'PAUSE-READBACK.json').write_text(json.dumps(record, indent=2) + '\n')
(packet / 'RECEIPT.md').write_text('''# Paused before construction

Entry294080f. Planned21:46–22:01UTC source/reference value gate; Robert explicitly paused for an app update, observed21:51UTC. Stop supersedes the planned endpoint. No new relaxed top, changed source OBJ/MHCLO, construction, importer, runtime recovery, fit evaluator, native/GPU/browser capture or product/asset change. Source possibility is not authoring or builder admission.

[Partial critic](CRITIC-VALUE.md) was saved21:52:52.965390UTC during stop collection. Root reads the entire note and reconciles it against its own pre-pause reads of the native attach/bind/export object tuples, full from-mix fitting, file-axis reader, direct-component writer and fresh VertexMatch source, plus actual source thumbnail and Ink body pixels. It agrees that native object ownership avoids the old guessed mesh name, while top/trouser ownership, group responsibility, offset serialization and full outfit/skin/fit/appearance remain unresolved. No further semantic source investigation after pause.

Each source issue has actual witnesses/explanation/A-B tradeoffs in the partial note. A is a future explicit native top authoring/correspondence/complete outfit contract; B retains current supported looks. Neither is admitted during this pause. Generic load/change-offset/save is not proven, and head fallback is not an authored sleeve bind; no existing runtime defect or unweighted shipped garment is claimed. Preserve all closed readers/observers/foundation/hair routes and the complete AAA/representation/wardrobe/expression roadmap.

Root read commands: chunksd87b85/8f22ab/cddc89/5c456b/d1be12/103c80/8ebd56/0c77e6/5fe73e/59b893. The two shell reads containing guessed filenames/globs returned missing-path/no-match diagnostics; they created no result or asset defect. Source functions were then read at their actual enumerated paths. Primary reference: [current official MakeClothes guidance](https://static.makehumancommunity.org/mpfb/docs/assets/creating_clothes.html), opened through web during this window. Its face/group/check/save requirements are documentation, not local toolchain qualification; no linked remote image pixels claimed. Root re-viewed the two unchanged local witnesses at21:47:16UTC, no new capture or bitmap edit.

Stop inventory chunk2c9c00 at21:51:42UTC and69ceff at21:53:00UTC: no matching owned Blender/native/build process; root critic interrupted with previous_status running after stop collection request. Only review PID1023 on127.0.0.1:5173 retained. App API modeupdate sets advance-sugata-avatar-visual-quality toPAUSED; API view plus saved TOML readback confirm status/destination, with original prompt/schedule/name preserved. [Pause readback](PAUSE-READBACK.json) pins exact files and timer bytes; no experiment replay, build or test needed for this preservation.

No push/publication/purchase/model/subscription/reset-credit or other-project action. Explicit human resume is required before further Sugata work or reactivating recovery. App restart and old queued heartbeat are not authorization. Latest usable delivery remains optional Ink and denim at463407f; duplicate endpoint gate closed at294080f.
''')
files = {str(p.relative_to(packet)): dict(bytes=p.stat().st_size, sha256=digest(p))
         for p in sorted(packet.iterdir()) if p.is_file()}
(packet / 'PRESERVATION.json').write_text(json.dumps(dict(pid=os.getpid(), files=files), indent=2) + '\n')
for p in packet.iterdir():
    if p.is_file(): p.chmod(0o444)
print(json.dumps({k:v for k,v in record.items() if k != 'inputs'}))
