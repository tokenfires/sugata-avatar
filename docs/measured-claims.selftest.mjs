/**
 * Gate for the objective-gate claims PUNCHLIST.md and PROGRESS.md make in prose.
 *
 * WHY A DOC GATE, AND WHY THIS ONE
 *
 * Punch-list 8.1 is the headline the whole render phase is quoted by, and for a round it read
 * "SIX OF SEVEN GREEN ... G2 0.9201 PASS". Re-measured at HEAD 1985425 over fourteen loads of the
 * exact recipe it names, G2 reads 0.9194-0.9198 and FAILS every time; 0.9201 never recurs. Nothing
 * in the repo could have caught that, because:
 *
 *   - every selftest under packages/ was green, and rightly so — the render was not the defect;
 *   - measure.mjs was green on its own selftest, and rightly so — the tool was not the defect;
 *   - the sentence was internally consistent. 0.9201 IS inside the 0.92-1.04 band, and the roster
 *     listed exactly six PASSes to go with its "six of seven".
 *
 * Two things had to be true at once. First, the shipped default plate is not reproducible from its
 * own identity — six consecutive loads of one build, one seed, one recipe, one step count give
 * five distinct PNGs, because `?capture` pins simulation time and not render state. Second, a
 * value one ten-thousandth inside a band edge was written down as a bare PASS, with no margin
 * stated, against a statistic whose measured load-to-load spread is four times that distance.
 *
 * The first is a diff request against alive.js. The second is what this file gates: **no bare
 * verdict inside the noise**, in either direction, plus three cheaper consistency rules that catch
 * the neighbouring mutations.
 *
 * FOUR RULES
 *
 *   BAND    A stated verdict must agree with the band `measure.mjs` actually enforces. The bands
 *           are IMPORTED from `tools/critic/measure.mjs`, never re-typed here, so tightening a
 *           band in the tool turns every stale verdict in the documents red.
 *   COUNT   An "N of seven green" headline must equal the number of PASS verdicts in its own gate
 *           roster. Catches prose drifting away from the list directly beneath it.
 *   MARGIN  A value closer to a band edge than that gate's measured load-to-load spread does not
 *           license a bare PASS or FAIL. The claim must carry the literal token MARGINAL within
 *           400 characters. This is the rule that catches 8.1.
 *   DRAWS   Every range quoted for the shipped default must be the min and max of the raw draws
 *           PUNCHLIST records in its ```rawdraws block. Arithmetic over the document's own data.
 *
 * WHAT THIS FILE CANNOT DO, STATED RATHER THAN IMPLIED
 *
 * It cannot render. A number that is inside its band, not marginal, and simply wrong for the build
 * is invisible to every rule here. The only defence against that is provenance — `measuredOn`, the
 * page, the width, the recipe and `packagesDigest` — and re-measuring. This gate makes the class
 * that bit us cheap to catch; it does not make prose true.
 *
 * Usage:  node docs/measured-claims.selftest.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { TARGETS } = await import(path.join(repoRoot, "tools/critic/measure.mjs"));

// --- what the tool actually enforces --------------------------------------------------------------
//
// Derived from TARGETS at load, so this file cannot drift from measure.mjs. G3 is relational — it
// compares two patches and has no scalar band — so it is exempt by construction rather than by
// omission, and the exemption is asserted below.

const BANDS = {
  G1: { low: TARGETS.keyShadowRatioMin, high: TARGETS.keyShadowRatioMax, what: "face key:shadow, linear" },
  G2: {
    low: TARGETS.scleraCheekRatio - TARGETS.scleraCheekTolerance,
    high: TARGETS.scleraCheekRatio + TARGETS.scleraCheekTolerance,
    what: "sclera:cheek encoded luma",
  },
  G3: null,
  G4: { low: TARGETS.highPassSigma[0], high: TARGETS.highPassSigma[1], what: "high-pass sigma /255" },
  G5: { low: 0, high: TARGETS.clippedFractionMax, what: "clipped fraction" },
  G6: { low: TARGETS.blackPointBand[0], high: TARGETS.blackPointBand[1], what: "p0.1 luma" },
  G7: { low: 0, high: TARGETS.cardBandOutlierFractionMax, what: "card-band outlier fraction" },
};

// Measured 2026-08-08 at HEAD 1985425, packagesDigest 78bdabba19b059e0: fourteen loads of
// alive.html?bare&freeze&seed=1 at 3840x5120 on the shipped default (TAAU 0.66 + grade + RCAS 1.2),
// ten through ?capture at 60 steps and four free-running at 90 rAF frames. The raw draws live in
// PUNCHLIST's ```rawdraws block and the DRAWS rule below re-derives these from them, so this table
// is a cache of a measurement rather than a set of chosen constants.
//
// G6 spreads zero because its value is a hard 8-bit zero and quantised; a zero spread makes the
// MARGIN rule inert for G6, which is the honest consequence and not a special case.
const LOAD_TO_LOAD_SPREAD = { G1: 0.0005, G2: 0.0004, G4: 0.0135, G5: 0.000001, G6: 0, G7: 0.000046 };

// The MARGINAL token has to NAME the gate it excuses, within 32 characters. Without that, one
// honest "MARGINAL: G2 sits on the floor" would exempt every other gate in the same roster — which
// is not hypothetical: it is how the first draft of this file let four of its own rebuilt defects
// walk through, and the table in section 4 is what showed it.
const MARGINAL_TOKEN = "MARGINAL";
const MARGINAL_RADIUS = 400;
const MARGINAL_NAMES_GATE_WITHIN = 32;

// A claim quoted inside its own retraction is evidence, not an assertion. Markers must PRECEDE the
// claim — that is how these documents are written — so the window is one-sided, which stops a
// retraction of one number silently exempting the corrected number beside it.
const RETRACTION_MARKERS = [
  "used to read", "used to say", "used to carry", "USED TO READ", "USED TO SAY", "USED TO CARRY",
  "earlier revision", "an earlier revision", "the line this replaces", "this replaces",
  "retract", "RETRACT", "withdraw", "stale", "STALE", "superseded", "SUPERSEDED",
  "does not reproduce", "did not reproduce", "could not be reproduced", "historical", "Historical",
  "pre-fix", "proven red", "known-bad", "at `c70195c`", "8.1 stated", "claimed",
];
const RETRACTION_LOOKBEHIND = 260;

const DOCUMENTS = [
  { label: "PUNCHLIST.md", file: path.join(repoRoot, "docs/PUNCHLIST.md") },
  { label: "PROGRESS.md", file: path.join(repoRoot, "docs/PROGRESS.md") },
];

// --- harness ----------------------------------------------------------------------------------

let checks = 0;
let failures = 0;
const failureNames = [];

function check(name, condition, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${name}${detail ? `  — ${detail}` : ""}`);
  } else {
    failures += 1;
    failureNames.push(name);
    console.log(`  FAIL ${name}  — ${detail}`);
  }
}

function section(title) {
  console.log("");
  console.log(title);
  console.log("-".repeat(Math.min(98, title.length + 4)));
}

// --- parsing ------------------------------------------------------------------------------------
//
// Two vehicles carry a gate claim in these documents, and the defect appeared in both: an inline
// roster ("G2 **0.9201** PASS") and a markdown table headed by gate ids (3.12's configuration
// table). A gate that reads only one of them tests half the file.

/** Strips markdown emphasis and code fencing so a number can be found in `**0.9201**`. */
function plain(text) {
  return text.replace(/\*\*/g, "").replace(/[`*_]/g, "");
}

/**
 * Character ranges that are QUOTATION rather than assertion: fenced blocks, inline code spans, and
 * anything between double quotes. `G2 0.9201 PASS` written in backticks is the defect being named,
 * and a gate that cannot tell a specimen from a claim makes it impossible to write the retraction
 * down — which is the one thing these documents most need to be able to do.
 */
function quotedRanges(text) {
  const ranges = [];
  const push = (pattern) => {
    for (const match of text.matchAll(pattern)) ranges.push([match.index, match.index + match[0].length]);
  };
  push(/```[\s\S]*?```/g);
  push(/`[^`\n]*`/g);
  // `*"…"*` is how these documents quote a superseded roster, and a roster is long enough to wrap,
  // so this one form is allowed to span lines. Everything else is single-line, because an unbalanced
  // straight quote would otherwise mask a paragraph and turn the gate off silently.
  push(/\*"[\s\S]{0,600}?"\*/g);
  push(/"[^"\n]{0,400}"/g);
  push(/[“][^”\n]{0,400}[”]/g);
  return ranges;
}

function isQuotation(ranges, index) {
  return ranges.some(([from, to]) => index >= from && index < to);
}

/** The same text with every quotation blanked, for scans that work on a window rather than an index. */
function maskQuotations(text) {
  const characters = [...text];
  for (const [from, to] of quotedRanges(text)) {
    for (let at = from; at < to && at < characters.length; at += 1) characters[at] = " ";
  }
  return characters.join("");
}

/**
 * A number as these documents write one: `0.9201`, `1.6315`, `0.0773%`, `0.9194–0.9198`,
 * `2e-06`. A percent suffix means the value is a percentage of the fraction the band is stated in,
 * which is a unit error waiting to happen and is therefore handled explicitly and asserted below.
 */
const NUMBER = /(-?\d+(?:\.\d+)?(?:e-?\d+)?)\s*(%?)(?:\s*[–—-]\s*(\d+(?:\.\d+)?(?:e-?\d+)?)\s*(%?))?/;

function parseNumber(match) {
  const scale = (suffix) => (suffix === "%" ? 0.01 : 1);
  const first = Number(match[1]) * scale(match[2]);
  if (match[3] === undefined) return [first];
  return [first, Number(match[3]) * scale(match[4] || match[2])];
}

/**
 * Every inline claim: a gate id, a number within 44 characters of it, and a verdict within 44
 * characters after the number, with no sentence break in between. Returns the values (one, or two
 * for a range), the stated verdict, and the index so the margin and retraction windows can be cut.
 */
function inlineClaims(text) {
  const found = [];
  for (const gateMatch of text.matchAll(/\bG([1-7])\b/g)) {
    const id = `G${gateMatch[1]}`;
    const start = gateMatch.index + gateMatch[0].length;
    const numberWindow = plain(text.slice(start, start + 44));
    const numberMatch = NUMBER.exec(numberWindow);
    if (numberMatch === null) continue;
    // A number that is really the next gate's id ("G1 ... G2") or a date is not this claim's value.
    if (/^\s*[.,;)]/.test(numberWindow) && numberMatch.index > 20) continue;
    const afterNumber = start + numberMatch.index + numberMatch[0].length;
    const verdictWindow = plain(text.slice(afterNumber, afterNumber + 44));
    const verdictMatch = /\b(PASS|FAIL)\b/.exec(verdictWindow);
    if (verdictMatch === null) continue;
    // A full stop, a table cell boundary or a new gate id between the number and the verdict means
    // they are not one claim.
    const between = verdictWindow.slice(0, verdictMatch.index);
    if (/[.\n|]|G[1-7]\b/.test(between)) continue;
    found.push({
      id,
      values: parseNumber(numberMatch),
      verdict: verdictMatch[1],
      index: gateMatch.index,
      quote: plain(text.slice(gateMatch.index, afterNumber + verdictMatch.index + 4)).replace(/\s+/g, " "),
    });
  }
  return found;
}

/**
 * Every markdown table whose header names three or more gates, as {id, values, index, quote} per
 * numeric cell. Three is the threshold because two gate columns can occur by accident in a
 * comparison table and three cannot.
 */
function tableClaims(text) {
  const found = [];
  const lines = text.split("\n");
  let offset = 0;
  const lineOffsets = lines.map((line) => {
    const at = offset;
    offset += line.length + 1;
    return at;
  });

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].trim();
    if (header.startsWith("|") === false) continue;
    const cells = header.split("|").slice(1, -1).map((cell) => plain(cell).trim());
    const gateColumns = cells
      .map((cell, column) => ({ column, id: /^(G[1-7])\b/.exec(cell)?.[1] ?? null }))
      .filter((entry) => entry.id !== null);
    if (gateColumns.length < 3) continue;
    if ((lines[index + 1] ?? "").includes("---") === false) continue;

    for (let row = index + 2; row < lines.length; row += 1) {
      const body = lines[row].trim();
      if (body.startsWith("|") === false) break;
      const bodyCells = body.split("|").slice(1, -1).map((cell) => plain(cell).trim());
      for (const { column, id } of gateColumns) {
        const cell = bodyCells[column];
        if (cell === undefined) continue;
        const numberMatch = NUMBER.exec(cell);
        if (numberMatch === null) continue;
        found.push({
          id,
          values: parseNumber(numberMatch),
          verdict: null,
          index: lineOffsets[row],
          quote: `${bodyCells[0] || "row"} | ${id} ${cell}`,
        });
      }
    }
    index += 1;
  }
  return found;
}

const COUNT_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

/** "FIVE OF SEVEN GREEN", "six of seven", "Both pass six of seven". */
function countClaims(text) {
  const found = [];
  const pattern = /\b(one|two|three|four|five|six|seven|[1-7])\s+of\s+seven\b/gi;
  for (const match of text.matchAll(pattern)) {
    const word = match[1].toLowerCase();
    found.push({ stated: COUNT_WORDS[word] ?? Number(word), index: match.index, quote: match[0] });
  }
  return found;
}

/** PUNCHLIST's ```rawdraws block: one line per gate, whitespace-separated draws. */
function rawDraws(text) {
  const block = /```rawdraws[^\n]*\n([\s\S]*?)```/.exec(text);
  if (block === null) return null;
  const draws = {};
  for (const line of block[1].split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (/^G[1-7]$/.test(parts[0]) === false) continue;
    draws[parts[0]] = parts.slice(1).map(Number);
  }
  return draws;
}

// --- adjudication ---------------------------------------------------------------------------------

function bandVerdict(id, value) {
  const band = BANDS[id];
  if (band === null || band === undefined) return null;
  return value >= band.low && value <= band.high ? "PASS" : "FAIL";
}

function marginToEdge(id, value) {
  const band = BANDS[id];
  if (band === null || band === undefined) return Infinity;
  return Math.min(Math.abs(value - band.low), Math.abs(value - band.high));
}

function isRetracted(text, index) {
  const before = text.slice(Math.max(0, index - RETRACTION_LOOKBEHIND), index);
  return RETRACTION_MARKERS.some((marker) => before.includes(marker));
}

/** MARGINAL excuses a claim only if it names that claim's gate within 32 characters of the token. */
function isMarkedMarginal(text, index, id) {
  const from = Math.max(0, index - MARGINAL_RADIUS);
  const window = text.slice(from, index + MARGINAL_RADIUS);
  let at = window.indexOf(MARGINAL_TOKEN);
  while (at !== -1) {
    const named = window.slice(Math.max(0, at - MARGINAL_NAMES_GATE_WITHIN),
      at + MARGINAL_TOKEN.length + MARGINAL_NAMES_GATE_WITHIN);
    if (new RegExp(`\\b${id}\\b`).test(named)) return true;
    at = window.indexOf(MARGINAL_TOKEN, at + 1);
  }
  return false;
}

/**
 * The whole adjudication, over one document's text. Returns findings rather than asserting, so the
 * same function can be pointed at a deliberately broken copy to prove the rules bite.
 */
function adjudicate(text) {
  const findings = [];
  const quotes = quotedRanges(text);
  const inline = inlineClaims(text);
  const tables = tableClaims(text);

  for (const claim of [...inline, ...tables]) {
    if (isRetracted(text, claim.index)) continue;
    if (isQuotation(quotes, claim.index)) continue;

    for (const value of claim.values) {
      if (claim.verdict !== null) {
        const expected = bandVerdict(claim.id, value);
        if (expected !== null && expected !== claim.verdict) {
          findings.push({ rule: "BAND", claim, detail: `states ${claim.verdict}, band says ${expected} for ${value}` });
        }
      }
      const spread = LOAD_TO_LOAD_SPREAD[claim.id];
      if (spread !== undefined && spread > 0 && marginToEdge(claim.id, value) < spread) {
        if (isMarkedMarginal(text, claim.index, claim.id) === false) {
          findings.push({
            rule: "MARGIN",
            claim,
            detail: `${value} is ${marginToEdge(claim.id, value).toFixed(6)} from a band edge, ` +
              `inside the measured ${spread} load-to-load spread, and carries no ${MARGINAL_TOKEN}`,
          });
        }
      }
    }
  }

  // COUNT: the nearest inline roster of five or more distinct gates, before or after the phrase.
  for (const count of countClaims(text)) {
    if (isRetracted(text, count.index)) continue;
    if (isQuotation(quotes, count.index)) continue;
    const near = inline.filter((claim) => Math.abs(claim.index - count.index) < 900);
    const verdictsInWindow = rosterVerdicts(text, count.index);
    if (verdictsInWindow.gates < 5) continue;
    if (verdictsInWindow.passes !== count.stated) {
      findings.push({
        rule: "COUNT",
        claim: { id: "-", quote: count.quote, index: count.index },
        detail: `"${count.quote}" against a roster of ${verdictsInWindow.gates} gates with ` +
          `${verdictsInWindow.passes} stated PASS (${near.length} numeric claims nearby)`,
      });
    }
  }

  return findings;
}

/**
 * The roster a count phrase is speaking about: every `G<n> ... PASS|FAIL` within 900 characters,
 * whether or not it carries a number, because "G3 PASS" is a verdict with no scalar and still
 * counts toward "six of seven".
 */
function rosterVerdicts(text, index) {
  const from = Math.max(0, index - 900);
  // Quotations are blanked first: a retracted roster quoted verbatim beside its correction is the
  // most natural thing to write here, and counting it would make the correction unwritable.
  const window = plain(maskQuotations(text).slice(from, index + 900));
  const seen = new Map();
  // Dots are allowed between the gate id and its verdict, because the value has one; another gate
  // id is not, because that would let G1's verdict be read off G2's. Getting this wrong is how the
  // first draft counted one gate in a seven-gate roster and skipped the COUNT rule silently.
  for (const match of window.matchAll(/\bG([1-7])\b((?:(?!\bG[1-7]\b)[^\n|]){0,60}?)\b(PASS|FAIL)\b/g)) {
    const id = `G${match[1]}`;
    if (seen.has(id) === false) seen.set(id, match[3]);
  }
  return {
    gates: seen.size,
    passes: [...seen.values()].filter((verdict) => verdict === "PASS").length,
  };
}

// --- 1. the instrument, on text whose answer is known by construction ----------------------------

section("1. THE INSTRUMENT — parsing and adjudication on synthesised text");

const near = (a, b) => Math.abs(a - b) < 1e-9;
check("bands come from measure.mjs, not from this file",
  near(BANDS.G2.low, 0.92) && near(BANDS.G2.high, 1.04) && near(BANDS.G4.low, 1.5) && near(BANDS.G6.high, 0.016),
  `G2 ${BANDS.G2.low.toFixed(4)}-${BANDS.G2.high.toFixed(4)}, G4 ${BANDS.G4.low}-${BANDS.G4.high}, ` +
  `G6 ${BANDS.G6.low}-${BANDS.G6.high} — all derived from TARGETS at load`);

check("G3 is exempt because it is relational, and the exemption is declared",
  BANDS.G3 === null && bandVerdict("G3", -99) === null, "no scalar band exists for a two-patch comparison");

{
  const one = inlineClaims("G2 **0.9201** PASS");
  check("inline claim: gate, emphasised value and verdict", one.length === 1 &&
    one[0].id === "G2" && one[0].values[0] === 0.9201 && one[0].verdict === "PASS", JSON.stringify(one[0]?.values));

  const ranged = inlineClaims("G2 **0.9194–0.9198 FAIL**");
  check("inline claim: an en-dashed range yields both endpoints", ranged.length === 1 &&
    ranged[0].values.length === 2 && ranged[0].values[0] === 0.9194 && ranged[0].values[1] === 0.9198,
    JSON.stringify(ranged[0]?.values));

  const percent = inlineClaims("G7 0.0773% PASS");
  check("inline claim: a percent suffix is converted to the band's fraction",
    percent.length === 1 && Math.abs(percent[0].values[0] - 0.000773) < 1e-9,
    `0.0773% -> ${percent[0]?.values[0]} against a band top of ${BANDS.G7.high}`);

  check("the percent conversion is load-bearing: unconverted, 0.0773 would read FAIL",
    bandVerdict("G7", 0.000773) === "PASS" && bandVerdict("G7", 0.0773) === "FAIL",
    "a unit slip here would invert every G5 and G7 verdict in the documents");

  const prose = inlineClaims("G2 also gained its second half — the spec sentence has a luma clause.");
  check("inline parser does not invent a claim out of prose with no number+verdict pair",
    prose.length === 0, `${prose.length} found`);

  const split = inlineClaims("G4 1.6315 is the shipped figure. Elsewhere the run was a PASS.");
  check("a full stop between the value and the verdict breaks the claim",
    split.length === 0, `${split.length} found`);
}

{
  const table = [
    "| configuration | G1 | G2 | G4 | G6 |",
    "|---|---:|---:|---:|---:|",
    "| shipped | 1.6636 | 0.9201 | 1.6315 | 0.00001 |",
  ].join("\n");
  const cells = tableClaims(table);
  check("table claim: a header naming three or more gates is adjudicated by column",
    cells.length === 4 && cells[1].id === "G2" && cells[1].values[0] === 0.9201,
    cells.map((cell) => `${cell.id}=${cell.values[0]}`).join(" "));

  const twoGates = tableClaims("| plate | G1 linear | side |\n|---|---|---|\n| portrait | 1.6265 | inside |");
  check("a table with fewer than three gate columns is not a gate table",
    twoGates.length === 0, `${twoGates.length} found`);
}

check("MARGIN measures distance to the NEAREST edge, both sides",
  Math.abs(marginToEdge("G2", 0.9201) - 0.0001) < 1e-9 && Math.abs(marginToEdge("G4", 2.0980) - 0.002) < 1e-9,
  `G2 0.9201 -> ${marginToEdge("G2", 0.9201).toFixed(6)}, G4 2.0980 -> ${marginToEdge("G4", 2.098).toFixed(6)}`);

check("a retraction marker only exempts what FOLLOWS it",
  isRetracted("this used to read G2 0.9201 PASS", 30) && isRetracted("G2 0.9201 PASS, and it used to read", 0) === false,
  "one-sided window, so retracting one number cannot exempt the corrected one beside it");

{
  const specimen = "the defect was `G2 0.9201 PASS`, and the live reading is G2 0.9350 PASS";
  const ranges = quotedRanges(specimen);
  check("a backticked specimen is a quotation, and the live claim beside it is not",
    isQuotation(ranges, specimen.indexOf("G2 0.9201")) && isQuotation(ranges, specimen.lastIndexOf("G2 0.9350")) === false,
    "otherwise the retraction cannot be written down at all");
}

{
  const wrapped = 'it stated *"G1 1.6180 PASS ·\nG2 0.9201 PASS"* — six of seven.\nToday G2 0.9350 PASS.';
  const ranges = quotedRanges(wrapped);
  check("a superseded roster quoted across two lines is masked, and the live one after it is not",
    isQuotation(ranges, wrapped.indexOf("G2 0.9201")) &&
    isQuotation(ranges, wrapped.indexOf("G2 0.9350")) === false &&
    rosterVerdicts(wrapped, wrapped.indexOf("six of seven")).gates < 2,
    "COUNT must not read its roster out of the retraction it sits beside");
}

check("MARGINAL must NAME the gate it excuses",
  isMarkedMarginal("MARGINAL: G2 sits on its floor. Here is a claim.", 40, "G2") &&
  isMarkedMarginal("MARGINAL: G2 sits on its floor. Here is a claim.", 40, "G1") === false,
  "one honest MARGINAL must not blanket-exempt every other gate in the same roster");

// --- 2. the documents ------------------------------------------------------------------------------

section("2. THE DOCUMENTS — every live gate claim in PUNCHLIST.md and PROGRESS.md");

const texts = new Map();
let totalClaims = 0;

for (const document of DOCUMENTS) {
  const text = fs.readFileSync(document.file, "utf8");
  texts.set(document.label, text);

  const inline = inlineClaims(text);
  const tables = tableClaims(text);
  const live = [...inline, ...tables].filter((claim) => isRetracted(text, claim.index) === false);
  totalClaims += live.length;

  const findings = adjudicate(text);

  check(`${document.label} carries gate claims for this gate to check`,
    live.length >= 8, `${inline.length} inline + ${tables.length} table cells, ${live.length} live`);

  for (const rule of ["BAND", "COUNT", "MARGIN"]) {
    const hits = findings.filter((finding) => finding.rule === rule);
    check(`${document.label} ${rule}`, hits.length === 0,
      hits.length === 0 ? "clean" :
        hits.map((hit) => `[${hit.claim.id}] "${hit.claim.quote}" ${hit.detail}`).join("\n         "));
  }
}

// --- 3. DRAWS — the ranges are arithmetic over the recorded draws ---------------------------------

section("3. DRAWS — every quoted range re-derived from PUNCHLIST's recorded draws");

const punchlist = texts.get("PUNCHLIST.md");
const draws = rawDraws(punchlist);

check("PUNCHLIST records the raw draws behind its ranges", draws !== null && Object.keys(draws).length >= 5,
  draws === null ? "no ```rawdraws block" : `${Object.keys(draws).length} gates`);

if (draws !== null) {
  const loadCount = new Set(Object.values(draws).map((list) => list.length));
  check("every gate records the same number of draws", loadCount.size === 1,
    `${[...loadCount].join(", ")} draws per gate`);

  for (const [id, list] of Object.entries(draws)) {
    const low = Math.min(...list);
    const high = Math.max(...list);
    const spread = LOAD_TO_LOAD_SPREAD[id];
    if (spread === undefined) continue;
    const derived = Number((high - low).toPrecision(6));
    check(`${id} spread is the draws' own range`, Math.abs(derived - spread) < 1e-9,
      `${low}-${high} = ${derived}, stated ${spread}`);
  }

  // The ranges quoted in prose must be the draws' own extremes. Only the gates whose ranges the
  // documents actually print are checked, and which those are is reported rather than assumed.
  const quotedRanges = [];
  for (const [label, text] of texts) {
    for (const claim of [...inlineClaims(text), ...tableClaims(text)]) {
      if (claim.values.length !== 2) continue;
      if (isRetracted(text, claim.index)) continue;
      quotedRanges.push({ label, ...claim });
    }
  }
  check("the documents quote ranges rather than single values for the shipped default",
    quotedRanges.length >= 4, `${quotedRanges.length} ranges found`);

  for (const range of quotedRanges) {
    const list = draws[range.id];
    if (list === undefined) continue;
    const inside = range.values[0] >= Math.min(...list) - 1e-9 && range.values[1] <= Math.max(...list) + 1e-9;
    const show = (value) => Number(value.toPrecision(6));
    check(`${range.label} range ${range.id} ${show(range.values[0])}–${show(range.values[1])} lies inside the recorded draws`,
      inside, `draws span ${Math.min(...list)}–${Math.max(...list)}`);
  }
}

// --- 4. rebuilt defects — nine of them, and which named check each one trips ----------------------
//
// 🚩 A gate that only catches its own known-bad is decorative. So the reintroduction of the
// original defect is only the first row. The other eight are DIFFERENT mutations in the same
// class — the other band edge, the other direction of verdict, a different gate, a different
// syntactic vehicle, a unit slip, a count drift, and a tampered draw — and the table prints how
// many checks each trips, so a row caught by exactly one check is visibly load-bearing.

section("4. REBUILT DEFECTS — nine mutations, and which rule catches each");

const SHIPPED_ROSTER =
  "- [ ] **8.1** measured on the shipped default:\n" +
  "      G1 **1.6634–1.6637** PASS · G2 **0.9194–0.9198 FAIL** · G3 PASS · G4 **1.6227–1.6362** PASS ·\n" +
  "      G5 0.0001%–0.0002% PASS · G6 **0.00001 FAIL** · G7 0.0736%–0.0767% PASS.\n" +
  "      MARGINAL: G2 sits inside its own load-to-load spread of the 0.92 floor.\n" +
  "      Five of seven green.\n";

const SHIPPED_TABLE =
  "| configuration | G1 | G2 | G4 | G6 |\n" +
  "|---|---:|---:|---:|---:|\n" +
  "| shipped | 1.6635 | 0.9500 | 1.8000 | 0.00001 |\n";

const DEFECTS = [
  {
    name: "the original: G2 0.9201 quoted as a bare PASS",
    text: SHIPPED_ROSTER
      .replace("G2 **0.9194–0.9198 FAIL**", "G2 **0.9201** PASS")
      .replace("      MARGINAL: G2 sits inside its own load-to-load spread of the 0.92 floor.\n", "")
      .replace("Five of seven", "Six of seven"),
  },
  {
    name: "same class, OTHER band edge, OTHER gate: G1 1.4302 PASS against a 1.43 floor",
    text: SHIPPED_ROSTER.replace("G1 **1.6634–1.6637** PASS", "G1 **1.4302** PASS"),
  },
  {
    name: "same class, CEILING rather than floor: G4 2.0980 PASS against a 2.1 ceiling",
    text: SHIPPED_ROSTER.replace("G4 **1.6227–1.6362** PASS", "G4 **2.0980** PASS"),
  },
  {
    name: "same class, MARGINAL FAIL: a red quoted with no margin either",
    text: SHIPPED_ROSTER.replace("G4 **1.6227–1.6362** PASS", "G4 **1.4999** FAIL"),
  },
  {
    name: "verdict contradicts the band outright: G2 0.8500 PASS",
    text: SHIPPED_ROSTER.replace("G2 **0.9194–0.9198 FAIL**", "G2 **0.8500** PASS"),
  },
  {
    name: "the band moved and the doc did not: G1 1.3440 PASS, the historical one-sided pass",
    text: SHIPPED_ROSTER.replace("G1 **1.6634–1.6637** PASS", "G1 **1.3440** PASS"),
  },
  {
    name: "unit slip: G7 0.0736 written as a fraction where the doc means percent",
    text: SHIPPED_ROSTER.replace("G7 0.0736%–0.0767% PASS", "G7 0.0736 PASS"),
  },
  {
    name: "count drift: the roster still lists five passes, the headline says six",
    text: SHIPPED_ROSTER.replace("Five of seven", "Six of seven"),
  },
  {
    name: "DIFFERENT VEHICLE, same class: the marginal value hides in a table cell",
    text: SHIPPED_TABLE.replace("0.9500", "0.9201"),
  },
];

console.log("");
console.log("  defect                                                                       trips  by");
console.log("  " + "-".repeat(96));

let uncaught = 0;
for (const defect of DEFECTS) {
  const findings = adjudicate(defect.text);
  const rules = [...new Set(findings.map((finding) => finding.rule))];
  if (findings.length === 0) uncaught += 1;
  console.log(`  ${defect.name.padEnd(74)} ${String(findings.length).padStart(5)}  ${rules.join(", ") || "NOTHING"}`);
}
console.log("");

check("every rebuilt defect is caught by at least one rule", uncaught === 0, `${uncaught} walked through`);

check("the clean roster the defects are cut from is itself clean",
  adjudicate(SHIPPED_ROSTER).length === 0,
  adjudicate(SHIPPED_ROSTER).map((finding) => `${finding.rule}: ${finding.detail}`).join("; ") || "no findings");

check("the MARGINAL token is what makes the clean roster clean, not luck",
  adjudicate(SHIPPED_ROSTER.replace(/^.*MARGINAL.*$/m, "")).some((finding) => finding.rule === "MARGIN"),
  "removing the one MARGINAL line turns the honest FAIL red, which is the rule doing its job");

// A tampered draw must break the arithmetic, or DRAWS is decorative.
{
  const tampered = punchlist.replace(/(```rawdraws[^\n]*\nG1 1\.6637)/, "$1 9.9999");
  const list = rawDraws(tampered)?.G1 ?? [];
  const derived = Number((Math.max(...list) - Math.min(...list)).toPrecision(6));
  check("DRAWS: tampering with one recorded draw breaks the stated spread",
    Math.abs(derived - LOAD_TO_LOAD_SPREAD.G1) > 1e-9, `tampered spread ${derived} vs stated ${LOAD_TO_LOAD_SPREAD.G1}`);
}

// --- 5. the defect put back into the REAL file, and four attempts to evade the gate ---------------
//
// Section 4 cuts its mutations from a fixture, which is the weaker proof: a fixture can be shaped,
// however unconsciously, to the parser that reads it. So the original 8.1 paragraph goes back into
// the actual PUNCHLIST text and the whole adjudication runs over the real document.

section("5. THE REAL FILE — the original 8.1 headline put back, and four evasions");

{
  const original =
    "- [ ] **8.1** Loop: render vs AAA reference until same-tier, **all seven** measured gates green.\n" +
    "      **SIX OF SEVEN GREEN as of 2026-08-08, re-measured after integration on the shipped\n" +
    "      defaults** — 3840x5120, portrait regions, 60 rendered frames, TAAU 0.66 + grade:\n" +
    "      G1 **1.6636** PASS · G2 **0.9201** PASS · G3 PASS · G4 **1.6315** PASS · G5 0.0002% PASS ·\n" +
    "      G6 **0.00001 FAIL** · G7 0.0773% PASS.\n";

  const reinfected = punchlist.replace(/- \[ \] \*\*8\.1\*\* Loop:[\s\S]*?\n(?=- \[ \] \*\*8\.2\*\*)/, original);
  check("the reinfection actually replaced 8.1 in the real file", reinfected !== punchlist &&
    reinfected.includes("G2 **0.9201** PASS"), "otherwise the next check proves nothing");

  const findings = adjudicate(reinfected);
  const rules = [...new Set(findings.map((finding) => finding.rule))];
  check("PUNCHLIST.md with the original 8.1 headline restored goes RED",
    findings.some((finding) => finding.rule === "MARGIN" && finding.claim.id === "G2"),
    `${findings.length} findings, rules ${rules.join(", ") || "NONE"}`);

  // And G7 0.0773% is above every recorded draw, which is a DRAWS question rather than a MARGIN one.
  const g7 = draws?.G7 ?? [];
  check("the restored G7 0.0773% is outside the recorded draws, so DRAWS would have caught it too",
    0.000773 > Math.max(...g7), `0.000773 against a maximum draw of ${Math.max(...g7)}`);
}

// 🚩 Four ways to write the same defect that this gate CANNOT see. Printed, not hidden, because a
// gate whose blind spots are undocumented is worse than one with none: it invites the next agent to
// trust it further than it goes. Two are phrasing the parser does not reach; two are abuse of the
// gate's own exemptions, which any exemption mechanism is open to.
const EVASIONS = [
  { name: "prose: 'the sclera:cheek ratio is 0.9201, a pass' — no gate id, lowercase verdict",
    text: "The sclera:cheek ratio is 0.9201, a pass on the shipped default.\n" },
  { name: "inverted order: '0.9201 on G2, PASS' — value before the gate id",
    text: "Measured 0.9201 on G2, PASS.\n" },
  { name: "abuse of the retraction exemption: prefix a LIVE claim with a marker word",
    text: "The stale figure is gone. G2 0.9201 PASS.\n" },
  { name: "abuse of the quotation exemption: put the live claim in backticks",
    text: "The shipped default reads `G2 0.9201 PASS`.\n" },
];

console.log("");
console.log("  evasion this gate does NOT catch                                             trips  by");
console.log("  " + "-".repeat(96));
let caughtEvasions = 0;
for (const evasion of EVASIONS) {
  const findings = adjudicate(evasion.text);
  if (findings.length > 0) caughtEvasions += 1;
  console.log(`  ${evasion.name.padEnd(74)} ${String(findings.length).padStart(5)}  ` +
    `${[...new Set(findings.map((finding) => finding.rule))].join(", ") || "NOTHING — known hole"}`);
}
console.log("");

check("the known holes are still holes, so this list is a measurement and not a wish",
  caughtEvasions === 0, `${caughtEvasions} of ${EVASIONS.length} are now caught — update the list`);

// The blind spots above are survivable only while the documents keep writing claims in a form the
// parser reaches. If a rewrite hides them, the claim COUNT collapses — so the count itself is
// gated, at 80% of what is present today, and a wholesale reformatting goes red instead of quiet.
const COVERAGE_FLOOR = { "PUNCHLIST.md": 20, "PROGRESS.md": 27 };
for (const document of DOCUMENTS) {
  const text = texts.get(document.label);
  const live = [...inlineClaims(text), ...tableClaims(text)]
    .filter((claim) => isRetracted(text, claim.index) === false && isQuotation(quotedRanges(text), claim.index) === false);
  check(`${document.label} still exposes enough claims for the parser to be worth having`,
    live.length >= COVERAGE_FLOOR[document.label],
    `${live.length} live claims against a floor of ${COVERAGE_FLOOR[document.label]} (80% of the count when this gate was written)`);
}

// --- result ---------------------------------------------------------------------------------------

console.log("");
console.log("=".repeat(98));
console.log(`${totalClaims} live gate claims adjudicated across ${DOCUMENTS.length} documents, ` +
  `against bands imported from tools/critic/measure.mjs.`);
console.log("Honest limit: this gate cannot render. A number inside its band, not marginal, and simply");
console.log("wrong for the build is invisible here — provenance and a re-run are the only defence.");
if (failures === 0) {
  console.log(`PASS — ${checks} checks.`);
  process.exit(0);
}
console.log(`FAIL — ${failures} of ${checks} checks failed: ${failureNames.join(", ")}`);
process.exit(1);
