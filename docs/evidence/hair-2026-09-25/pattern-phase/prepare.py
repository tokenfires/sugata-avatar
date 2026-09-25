from pathlib import Path
import hashlib
import json

p = Path('tmp/hair-sep25/pattern-phase')
sources = ['tools/figure-pipeline/hair_tips.mjs', 'tools/figure-pipeline/hair_opacity.mjs',
           'packages/core/src/render/HairOIT.js', 'packages/core/src/material/HairMaterial.js',
           'packages/core/src/render/Stage.js', 'packages/testbed/src/alive.js',
           'node_modules/three/src/nodes/utils/PostProcessingUtils.js', 'assets/hair/bob01/g050.glb']
hashes = {n: hashlib.sha256(Path(n).read_bytes()).hexdigest() for n in sources}
if (p / 'source-hashes.json').exists():
    assert json.loads((p / 'source-hashes.json').read_text()) == hashes, 'Experiment sources changed'
(p / 'source-hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')
for name in ['tips', 'opacity']:
    s = Path(f'tools/figure-pipeline/hair_{name}.mjs').read_text()
    s = s.replace("const REPO_ROOT = path.resolve(HERE, '..', '..');",
                  "const REPO_ROOT = path.resolve(HERE, '..', '..', '..');")
    s = s.replace('#!/usr/bin/env node\n', "#!/usr/bin/env node\nimport { install } from './candidate.mjs';\n", 1)
    s = s.replace('  console.log(url);',
                  '  const check = await install(page, parseArguments(process.argv.slice(2)).out);\n  console.log(url);')
    s = s.replace('  return page;', '  await check();\n  page.__patternProblems = problems;\n  return page;')
    s = s.replace("  page.on('pageerror', (error) => problems.push(error.message));",
                  "  page.on('pageerror', (error) => problems.push(error.message));\n"
                  "  page.on('console', message => { if (message.type()==='error' && !message.text().startsWith('Failed to load resource')) problems.push(message.text()); });\n"
                  "  page.on('response', response => { if (response.status()>=400 && !response.url().endsWith('/favicon.ico')) problems.push(response.status()+' '+response.url()); });")
    s = s.replace('async function screenshot(page, file) {',
                  "async function screenshot(page, file) {\n  if (page.__patternProblems?.length) throw Error(page.__patternProblems.join('\\n'));")
    if name == 'tips':
        s = s.replace('  const failures = report(measured, options);',
                      "  fs.writeFileSync(path.join(options.out, 'measurements.json'), JSON.stringify(measured,null,2)+'\\n');\n  const failures = report(measured, options);")
    else:
        s = s.replace('      failures.push(...report(view, measured));',
                      "      fs.writeFileSync(path.join(options.out, view.name+'-measurements.json'), JSON.stringify(measured,null,2)+'\\n');\n      failures.push(...report(view, measured));")
    (p / f'{name}.mjs').write_text(s)
print('Prepared isolated route and native measurement copies; production unchanged.')
