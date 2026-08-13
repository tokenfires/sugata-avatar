#!/usr/bin/env node
//
// hair_shots.mjs — the five plates a groom is judged on, captured off the real page.
//
// Punch-list 3.6's blind critic looked at `packages/testbed/src/hair.html` and named three
// launch blockers that no number in `verify_glb.mjs` could have found: a razor card border across
// the eyebrow, a lit scalp at the parting, and a staircase at every strand tip. LEARNINGS §1.2 is
// the standing form of that: a selftest proves the numbers and is structurally blind to whether
// the picture is right. Fixing a defect that only a picture can show needs a BEFORE and an AFTER
// picture, taken the same way, and taking them by hand is how a pair ends up being two different
// framings of two different builds.
//
// So this drives `window.hairShot`, which awaits the page's own `renderAsync`, and writes one PNG
// per view. No video, no ffmpeg, no determinism ceremony — `tools/critic/capture.mjs` owns all of
// that for the avatar; this is five stills of one asset.
//
// Playwright is looked up exactly the way capture.mjs looks it up, and for the same reason: it is
// a development instrument and not a dependency of the build.
//
//   node tools/figure-pipeline/hair_shots.mjs --out captures/hair-before
//   node tools/figure-pipeline/hair_shots.mjs --out captures/hair-after --url http://localhost:5173/src/hair.html
//
// With no --url it starts vite itself on a free port and stops it again.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🚩 fileURLToPath, never `import.meta.url.replace('file://', '')`. This repository's own path
// carries a space and a non-ASCII character, and string surgery on a file URL hands back
// `/Users/.../Sugata%20%E5%A7%BF` — a directory that does not exist.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const VIEWS = ['front', 'three-quarter', 'side', 'back', 'top'];

async function main() {
  const options = parseArguments(process.argv.slice(2));
  fs.mkdirSync(options.out, { recursive: true });

  const playwright = await loadPlaywright();
  const server = options.url === null ? await startVite() : null;
  const url = options.url ?? `${server.origin}/src/hair.html`;

  const browser = await playwright.chromium.launch({
    channel: 'chromium', // headless_shell has no GPU and therefore no WebGPU
    headless: true,
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan']
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    const problems = [];
    page.on('pageerror', (error) => problems.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('typeof window.hairShot === "function"', null, { timeout: 60000 });

    const canvas = page.locator('#stage');
    for (const view of VIEWS) {
      await page.evaluate((name) => window.hairShot(name), view);
      const file = path.join(options.out, `${view}.png`);
      await canvas.screenshot({ path: file });
      console.log(`  ${view.padEnd(14)} ${path.relative(REPO_ROOT, file)}`);
    }

    const hud = await page.locator('#hud').textContent();
    fs.writeFileSync(path.join(options.out, 'hud.txt'), hud ?? '');

    if (problems.length > 0) {
      console.log('\npage errors:');
      for (const problem of problems) console.log(`  ${problem}`);
    }
  } finally {
    await browser.close();
    if (server !== null) server.stop();
  }
}

function parseArguments(argv) {
  const options = { out: path.join(REPO_ROOT, 'captures', 'hair'), url: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') options.out = path.resolve(argv[index + 1]);
    if (argv[index] === '--url') options.url = argv[index + 1];
  }
  return options;
}

/** Starts the repo's own vite and waits for it to say which port it took. */
function startVite() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', '--port', '0', '--strictPort=false'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stop = () => child.kill('SIGTERM');
    const timer = setTimeout(() => {
      stop();
      reject(new Error('vite did not report a URL within 60 s'));
    }, 60000);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      const match = /(http:\/\/localhost:\d+)/.exec(chunk);
      if (match !== null) {
        clearTimeout(timer);
        resolve({ origin: match[1], stop });
      }
    });
    child.on('error', reject);
  });
}

async function loadPlaywright() {
  const candidates = ['playwright'];
  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache)) {
    for (const entry of fs.readdirSync(cache)) {
      const candidate = path.join(cache, entry, 'node_modules', 'playwright');
      if (fs.existsSync(candidate)) candidates.push(candidate);
    }
  }

  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const resolved = require.resolve(candidate);
      const namespace = await import(pathToFileURL(resolved).href);
      return namespace.chromium ? namespace : namespace.default;
    } catch {
      // next candidate; only the last failure matters
    }
  }

  throw new Error('playwright not resolvable. See tools/critic/capture.mjs --playwright.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
