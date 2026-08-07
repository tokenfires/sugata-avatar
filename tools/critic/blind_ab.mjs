#!/usr/bin/env node
//
// blind_ab.mjs — makes the subjective half of the critic loop honest.
//
// The problem this solves: an agent asked to compare "our render" against "the reference" knows
// which is which, and that knowledge contaminates the verdict in both directions — flattery and
// overcorrection. So we take the knowledge away. Two images go in; they come out as a.png and
// b.png in a scratch directory, in a random order, with their filenames gone and their metadata
// stripped. The mapping is written OUTSIDE that directory so a critic that lists the folder
// cannot stumble over the answer.
//
// The workflow is: pair -> critic records a verdict naming A or B -> only then, reveal.
// Revealing before the verdict is recorded defeats the entire point.
//
// Usage:
//   node blind_ab.mjs pair <first.png> <second.png> [--root <dir>] [--label <text>]
//   node blind_ab.mjs reveal <sessionId|key.json> [--root <dir>]
//   node blind_ab.mjs list [--root <dir>]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodePng, stripProvenanceChunks } from './png.mjs';

// fileURLToPath, not string surgery on the URL: this repository's path contains a space and a
// non-ASCII character, so import.meta.url arrives percent-encoded.
const THIS_FILE = fileURLToPath(import.meta.url);

const DEFAULT_ROOT = path.join(os.tmpdir(), 'sugata-blind-ab');

// --- entry point ------------------------------------------------------------------------------

function main(argv) {
  const options = parseArguments(argv);

  if (options.command === 'pair') return runPair(options);
  if (options.command === 'reveal') return runReveal(options);
  if (options.command === 'list') return runList(options);

  process.stdout.write(usageText());
  return 0;
}

// --- commands ---------------------------------------------------------------------------------

function runPair(options) {
  const [firstPath, secondPath] = options.arguments;
  if (!firstPath || !secondPath) {
    throw new Error('pair needs two image paths. Run with --help.');
  }

  // crypto.randomInt, not Math.random: the whole value of this tool is that the assignment is
  // not guessable or reproducible from a seed someone might later find in a log.
  const swap = crypto.randomInt(2) === 1;
  const assignment = swap
    ? { a: secondPath, b: firstPath }
    : { a: firstPath, b: secondPath };

  const sessionId = `${timestampSlug()}-${crypto.randomBytes(4).toString('hex')}`;
  const imagesDir = path.join(options.root, sessionId);
  fs.mkdirSync(imagesDir, { recursive: true });

  const written = {
    a: writeStrippedCopy(assignment.a, path.join(imagesDir, 'a.png')),
    b: writeStrippedCopy(assignment.b, path.join(imagesDir, 'b.png')),
  };

  const keyPath = path.join(options.root, `${sessionId}.key.json`);
  fs.writeFileSync(
    keyPath,
    JSON.stringify(
      {
        sessionId,
        label: options.label,
        createdAt: new Date().toISOString(),
        imagesDir,
        a: path.resolve(assignment.a),
        b: path.resolve(assignment.b),
      },
      null,
      2
    )
  );

  const result = {
    sessionId,
    imagesDir,
    images: { a: written.a.path, b: written.b.path },
    dimensions: {
      a: `${written.a.width}x${written.a.height}`,
      b: `${written.b.width}x${written.b.height}`,
    },
    // Deliberately a total, not a per-slot count. Different encoders leave different numbers of
    // text/timestamp chunks behind, so "a: 4, b: 0" would announce that A came from the tool that
    // writes metadata and B from the one that does not — the tell this command exists to remove.
    strippedChunkTotal: written.a.removedChunkCount + written.b.removedChunkCount,
    warnings: blindnessWarnings(written),
    revealCommand: `node "${THIS_FILE}" reveal ${sessionId} --root "${options.root}"`,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

function runReveal(options) {
  const target = options.arguments[0];
  if (!target) throw new Error('reveal needs a sessionId or a path to a key file.');

  const keyPath = target.endsWith('.json')
    ? target
    : path.join(options.root, `${target}.key.json`);

  if (!fs.existsSync(keyPath)) {
    throw new Error(`No key file at ${keyPath}. Was this session created with a different --root?`);
  }

  process.stdout.write(`${fs.readFileSync(keyPath, 'utf8')}\n`);
  return 0;
}

function runList(options) {
  if (!fs.existsSync(options.root)) {
    process.stdout.write('[]\n');
    return 0;
  }

  // Deliberately reports only session ids and labels, never the mapping — `list` has to be safe
  // to run in front of a critic that has not given its verdict yet.
  const sessions = fs
    .readdirSync(options.root)
    .filter((name) => name.endsWith('.key.json'))
    .map((name) => {
      const key = JSON.parse(fs.readFileSync(path.join(options.root, name), 'utf8'));
      return { sessionId: key.sessionId, label: key.label, createdAt: key.createdAt, imagesDir: key.imagesDir };
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  process.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
  return 0;
}

// --- helpers ------------------------------------------------------------------------------------

// Copies at the chunk level rather than re-encoding. Re-encoding would change the pixels, and
// the same images usually go on to measure.mjs — a blinding step must not alter what is measured.
function writeStrippedCopy(sourcePath, destinationPath) {
  const source = fs.readFileSync(sourcePath);
  const stripped = stripProvenanceChunks(source);
  fs.writeFileSync(destinationPath, stripped.buffer);

  const image = decodePng(stripped.buffer);
  return {
    path: destinationPath,
    width: image.width,
    height: image.height,
    removedChunkCount: stripped.removedChunkCount,
  };
}

// Blinding is only as good as its weakest tell. Anything that lets a critic identify the images
// without looking at their content gets said out loud rather than quietly ignored.
function blindnessWarnings(written) {
  const warnings = [];

  if (written.a.width !== written.b.width || written.a.height !== written.b.height) {
    warnings.push(
      `The two images are different sizes (${written.a.width}x${written.a.height} vs ${written.b.width}x${written.b.height}). Resolution is a giveaway — render and crop both to the same dimensions before pairing, or the comparison is not blind.`
    );
  }

  return warnings;
}

function parseArguments(argv) {
  const options = { command: null, arguments: [], root: DEFAULT_ROOT, label: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...options, command: null };
    if (arg === '--root') {
      i += 1;
      options.root = path.resolve(argv[i]);
    } else if (arg === '--label') {
      i += 1;
      options.label = argv[i];
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option ${arg}.`);
    } else if (options.command === null) {
      options.command = arg;
    } else {
      options.arguments.push(arg);
    }
  }

  return options;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
}

function usageText() {
  return [
    'blind_ab.mjs — blind A/B pairing so a critic cannot tell which render is ours.',
    '',
    'Usage:',
    '  node blind_ab.mjs pair <first.png> <second.png> [--root <dir>] [--label <text>]',
    '  node blind_ab.mjs reveal <sessionId|key.json> [--root <dir>]',
    '  node blind_ab.mjs list [--root <dir>]',
    '',
    `Default root: ${DEFAULT_ROOT}`,
    '',
    'pair    randomises the two images into <root>/<sessionId>/a.png and b.png, strips text and',
    '        timestamp metadata, and writes the mapping to <root>/<sessionId>.key.json — one level',
    '        ABOVE the images, so listing the image directory reveals nothing.',
    'reveal  prints the mapping. Record the verdict first; revealing early defeats the purpose.',
    'list    session ids and labels only, never the mapping. Safe to run mid-experiment.',
    '',
  ].join('\n');
}

// One catch-all at the boundary.
if (process.argv[1] && THIS_FILE === path.resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`blind_ab.mjs: ${error.message}\n`);
    process.exitCode = 2;
  }
}
