/**
 * SeedLexicon — the valence words this repo ships, and the licence reasoning that decided what
 * they could be.
 *
 * 🚩 THE LICENCE FINDING PUNCH-LIST 5.2 ASKS TO BE RESOLVED BEFORE A LEXICON SHIPS.
 * ---------------------------------------------------------------------------------
 * research/affect-and-animation.md §0 is a table of landmines and two of them are aimed squarely
 * at this file:
 *
 *   NRC-VAD v2.1        NON-COMMERCIAL. "You may not rent or license the use of the lexicon."
 *   Warriner et al.     CC BY-NC-ND 3.0. Same problem.
 *   VADER               MIT ✅ — "its rule layer is usable and its `compound` is a well-calibrated
 *                       valence estimate."
 *
 * So: **no NRC-VAD, no Warriner, not now and not later without a purchased licence.** Neither
 * appears in this repo and neither may.
 *
 * That leaves VADER, whose ALGORITHM is implemented in `ReflexAffect.js` from its published
 * description, and whose 7,500-entry LEXICON FILE is not vendored here. Vendoring it is legally
 * fine and is the right eventual answer; it is not done in this round because pulling a
 * quarter-megabyte of third-party data into the tree is a supply-chain decision with a provenance
 * trail, and this file has to work before that happens.
 *
 * What ships instead is the list below: a small English affect lexicon **authored for this repo**,
 * on VADER's own -4..+4 scale, so the rule layer has something to chew on out of the box.
 *
 * ⚠️ IT IS A FLOOR, NOT A CEILING, AND ITS VALUES ARE AUTHORED RATHER THAN MEASURED. It is not
 * derived from NRC-VAD, from Warriner, or from VADER's file; it is not a substitute for any of
 * them; and no accuracy claim is made for it anywhere in this repo. `ReflexAffect.loadLexicon()`
 * replaces it wholesale, and the intended production path is to hand it VADER's `vader_lexicon.txt`
 * (MIT, mean of ten human ratings per term) at deploy time. `ReflexAffect.lexiconProvenance`
 * reports which of the two is loaded, so a gate or a HUD can tell.
 *
 * Coverage is deliberately weighted toward the words an AI agent's own utterances actually contain
 * — appraisal, apology, confidence, uncertainty — rather than toward the product-review vocabulary
 * general-purpose lexicons are built from.
 */

/** What VADER's scale means, so a later editor adds entries on the same footing. */
export const LEXICON_SCALE = Object.freeze( {
    minimum: -4,
    maximum: 4,
    note: 'VADER scale. -4 extremely negative, 0 neutral, +4 extremely positive.'
} );

/**
 * word -> valence, VADER scale.
 *
 * Kept as a plain object rather than a Map literal because it is read once into a Map at module
 * load and this form is what a human edits.
 */
export const SEED_LEXICON = Object.freeze( {

    // --- strongly positive ---------------------------------------------------------------------
    wonderful: 3.4, amazing: 3.2, fantastic: 3.3, excellent: 3.2, brilliant: 3.1, superb: 3.2,
    delighted: 3.1, thrilled: 3.2, ecstatic: 3.5, overjoyed: 3.4, triumph: 3.0, perfect: 3.1,
    love: 3.2, adore: 3.1, beautiful: 2.9, gorgeous: 3.0, magnificent: 3.1, glorious: 3.0,
    breakthrough: 2.8, masterpiece: 3.0,

    // --- positive ----------------------------------------------------------------------------
    good: 1.9, great: 2.6, nice: 1.8, happy: 2.7, glad: 2.1, pleased: 2.0, pleasant: 1.9,
    enjoy: 2.2, enjoyed: 2.2, like: 1.5, likes: 1.5, liked: 1.5, fun: 2.3, lovely: 2.5,
    proud: 2.4, pride: 2.2, grateful: 2.6, thankful: 2.5, thanks: 1.9, thank: 1.9,
    appreciate: 2.1, appreciated: 2.1, welcome: 1.6, kind: 1.9, kindness: 2.3, gentle: 1.6,
    generous: 2.3, warm: 1.4, warmth: 1.7, comfort: 1.7, comfortable: 1.6, calm: 1.3,
    relief: 1.9, relieved: 2.0, hope: 1.6, hopeful: 1.9, optimistic: 2.0, confident: 1.8,
    ready: 1.0, clear: 1.0, correct: 1.4, right: 1.2, works: 1.5, worked: 1.5, working: 1.0,
    success: 2.5, successful: 2.4, succeeded: 2.4, solved: 2.1, fixed: 1.7, improved: 1.8,
    better: 1.7, best: 2.5, strong: 1.4, safe: 1.5, healthy: 1.7, helpful: 1.9, help: 1.2,
    interesting: 1.5, curious: 1.0, clever: 1.8, smart: 1.8, elegant: 1.9, careful: 0.9,
    honest: 1.8, fair: 1.3, trust: 1.9, trusted: 1.9, agree: 1.3, yes: 1.1, sure: 0.9,
    together: 1.3, friend: 2.0, friendly: 2.0, funny: 1.9, laugh: 2.1, smile: 2.0,

    // --- negative ------------------------------------------------------------------------------
    bad: -2.0, poor: -1.7, wrong: -1.9, broken: -2.0, broke: -1.7, fail: -2.3, failed: -2.4,
    failure: -2.5, failing: -2.2, error: -1.8, mistake: -1.7, bug: -1.5, crash: -2.0,
    crashed: -2.1, problem: -1.6, issue: -1.0, trouble: -1.8, difficult: -1.3, hard: -0.9,
    confusing: -1.5, confused: -1.4, unclear: -1.1, stuck: -1.6, slow: -1.0, late: -1.1,
    lost: -1.6, missing: -1.2, worse: -2.1, worst: -3.0, ugly: -2.2, weak: -1.4,
    sad: -2.4, unhappy: -2.3, sorry: -1.2, apologise: -1.0, apologize: -1.0, apology: -1.0,
    regret: -1.9, ashamed: -2.4, shame: -2.2, guilty: -2.0, disappointed: -2.3,
    disappointing: -2.2, upset: -2.1, hurt: -2.2, painful: -2.3, pain: -2.2, lonely: -2.4,
    tired: -1.2, exhausted: -1.9, bored: -1.5, boring: -1.7, dull: -1.3, empty: -1.4,
    worried: -1.9, worry: -1.8, anxious: -2.1, afraid: -2.3, scared: -2.4, fear: -2.4,
    terrified: -3.1, panic: -2.8, nervous: -1.7, dread: -2.6, threat: -2.3, danger: -2.4,
    angry: -2.6, anger: -2.5, furious: -3.2, mad: -2.2, annoyed: -1.8, annoying: -1.9,
    irritated: -1.9, frustrated: -2.2, frustrating: -2.1, hate: -3.2, hated: -3.1,
    disgusting: -3.0, disgusted: -2.9, revolting: -3.0, gross: -2.2, awful: -3.0,
    terrible: -3.0, horrible: -3.1, dreadful: -2.9, appalling: -3.0, unacceptable: -2.6,
    rude: -2.2, cruel: -2.9, unfair: -2.1, dishonest: -2.4, betrayed: -3.0, ignored: -1.8,
    hopeless: -2.9, useless: -2.4, pointless: -2.1, impossible: -1.8, refuse: -1.5,
    reject: -1.7, rejected: -2.2,

    // ⚠️ NOTE WHAT IS ABSENT: `no`, `not`, `never` and `nothing` are NEGATORS and belong to
    // NEGATIONS below, not here. They were in this table for one revision and the smoke test caught
    // what that does — a negator scored as a valence word is counted twice, once as itself and once
    // as the -0.74 flip it applies to the word after it, so "I actually did not expect that to
    // work" came out at -0.224 on the strength of the word "not" alone. VADER's own lexicon
    // contains none of the four.

    // --- interjections, which carry most of the valence in short spoken turns -------------------
    wow: 2.4, yay: 2.6, hooray: 2.7, aha: 1.4, phew: 1.2,
    ugh: -1.8, ouch: -1.9, oops: -1.2, argh: -2.1, alas: -1.6,

    // --- hedges and uncertainty, which read as mildly negative valence and matter for an agent ---
    maybe: -0.2, perhaps: -0.2, unsure: -1.0, uncertain: -0.9, doubt: -1.2, doubtful: -1.3,
    guess: -0.3, suppose: -0.2, probably: -0.1, hesitant: -1.0

} );

/** VADER's booster/degree modifiers. Positive intensifies, negative attenuates. */
export const BOOSTERS = Object.freeze( {
    absolutely: 1, amazingly: 1, awfully: 1, completely: 1, considerably: 1, decidedly: 1,
    deeply: 1, enormously: 1, entirely: 1, especially: 1, exceptionally: 1, extremely: 1,
    fabulously: 1, fully: 1, greatly: 1, highly: 1, hugely: 1, incredibly: 1, intensely: 1,
    majorly: 1, more: 1, most: 1, particularly: 1, purely: 1, quite: 1, really: 1,
    remarkably: 1, so: 1, substantially: 1, thoroughly: 1, totally: 1, tremendously: 1,
    unbelievably: 1, unusually: 1, utterly: 1, very: 1,

    almost: -1, barely: -1, hardly: -1, kinda: -1, less: -1, little: -1, marginally: -1,
    occasionally: -1, partly: -1, scarcely: -1, slightly: -1, somewhat: -1, sorta: -1
} );

/** VADER's negation set, trimmed to the forms an English utterance actually uses. */
export const NEGATIONS = Object.freeze( new Set( [
    'not', 'no', 'never', 'none', 'nobody', 'nothing', 'neither', 'nowhere', 'cannot',
    "can't", "won't", "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't",
    "shouldn't", "wouldn't", "couldn't", "haven't", "hasn't", "hadn't", "ain't", 'without',
    'lack', 'lacking', 'lacks', 'despite', 'rarely', 'seldom', 'hardly'
] ) );

/**
 * 🚩 AUTHORED, AND WEAKER THAN EVERYTHING ELSE IN THIS FILE.
 *
 * There is no dominance lexicon this project may ship: NRC-VAD is the standard one and it is
 * non-commercial. research §2 places valence in the text and arousal in the acoustics and says
 * nothing about where a fast dominance estimate would come from, because there is no fast source —
 * research/lm-studio-integration.md's whole two-tier argument turns on dominance being the axis
 * only the appraisal pass can supply.
 *
 * So this is a stopgap and is treated as one: a handful of surface markers, weighted, reported at
 * `DOMINANCE_CONFIDENCE` so that `AffectState.push` blends it in weakly rather than letting it own
 * the axis, and REPLACED OUTRIGHT the moment punch-list 5.3's tier 2 lands. Its only job is to keep
 * anger and fear from collapsing onto the same posture while tier 2 does not exist. No accuracy
 * claim is made for it and none should be.
 */
export const DOMINANCE_MARKERS = Object.freeze( {

    // Asserting, directing, certain.
    must: 0.6, will: 0.3, shall: 0.4, now: 0.3, stop: 0.6, enough: 0.6, done: 0.4,
    demand: 0.9, insist: 0.8, require: 0.5, expect: 0.4, refuse: 0.7, definitely: 0.6,
    obviously: 0.5, clearly: 0.4, certainly: 0.5, always: 0.3, absolutely: 0.5,
    'no': 0.3, wrong: 0.4, unacceptable: 0.8, again: 0.3,

    // Hedging, deferring, submitting.
    sorry: -0.7, apologise: -0.8, apologize: -0.8, please: -0.3, maybe: -0.5, perhaps: -0.5,
    might: -0.4, could: -0.2, possibly: -0.5, unsure: -0.7, uncertain: -0.6, hope: -0.3,
    wondering: -0.4, wonder: -0.3, guess: -0.4, suppose: -0.4, hesitant: -0.6,
    afraid: -0.7, scared: -0.9, worried: -0.6, helpless: -1.0, hopeless: -0.8,
    'can\'t': -0.5, unable: -0.6

} );

/** How much weight `ReflexAffect` claims for its dominance estimate. See DOMINANCE_MARKERS. */
export const DOMINANCE_CONFIDENCE = 0.25;

/**
 * What is loaded, in one object a HUD or a gate can print. `entries` is counted from the table
 * rather than typed, because a hand-typed count is a claim with no gate on it (LEARNINGS §1.25e).
 */
export const SEED_LEXICON_PROVENANCE = Object.freeze( {
    name: 'sugata-seed',
    licence: 'authored in this repository',
    entries: Object.keys( SEED_LEXICON ).length,
    warning: 'Authored, not measured. Load VADER\'s MIT lexicon for production accuracy.'
} );
