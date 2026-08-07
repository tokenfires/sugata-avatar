# LM Studio integration — verified findings

Probed 2026-08-06 against a live LM Studio at `http://127.0.0.1:1234` (no auth).
Everything below was measured, not assumed.

## Environment

| | |
|---|---|
| Host | MacBook Pro, Apple M5 Max, 40 GPU cores, 128 GB unified memory |
| Model | `qwen/qwen3.6-35b-a3b` — loaded, 37.75 GB, 262144 ctx, parallel 4 |
| Endpoint | OpenAI-compatible `/v1/chat/completions` |

## Finding 1 — schema-constrained output arrives in `reasoning_content`

`qwen3.6-35b-a3b` is a thinking model. When called with
`response_format: {type: "json_schema", ...}`, it produces **valid, schema-conformant
JSON** — but the payload is delivered in `message.reasoning_content` and
`message.content` is an empty string.

Cause: the grammar constrains generation to bare JSON, so the model never emits the
`</think>` sentinel that LM Studio's reasoning parser uses to split channels. The parser
therefore attributes the whole completion to the thinking channel.

Measured, `finish_reason: "stop"`, 45 completion tokens, 0.95 s:

```json
{"valence": 0.8, "arousal": 0.7, "dominance": 0.6, "primary": "joy", "intensity": 0.75}
```

**Client requirement:** when a JSON schema was requested and `content` is empty, fall
back to `reasoning_content`, then parse. Try `content` first so the code stays correct
against non-thinking models and future LM Studio builds that fix the split.

## Finding 2 — thinking cannot be disabled through the API surface

All four documented disable paths were tried. None suppressed reasoning tokens:

| Attempt | Result |
|---|---|
| `chat_template_kwargs: {enable_thinking: false}` | 44 reasoning tokens, content empty |
| `/no_think` appended to the user message | 46 reasoning tokens, content empty |
| `reasoning_effort: "minimal"` | 44 reasoning tokens, content empty |
| no `response_format`, `max_tokens: 1200` | ran to `finish_reason: "length"`, 1199 tokens, never answered |

The schema constraint is therefore not optional — it is the only thing that makes this
model terminate promptly. Unconstrained, it reasons indefinitely and never emits an answer.

## Finding 3 — `json_object` mode is unsupported

`response_format: {type: "json_object"}` returns **HTTP 400 Bad Request**. Only the full
`json_schema` form works. Always send the complete schema.

## Finding 4 — latency budget

| Call | Wall clock |
|---|---|
| Schema-constrained affect inference (~45 tok) | **0.6 – 0.95 s** |
| Unconstrained generation (1199 tok) | 13.8 s |

Roughly 87 tok/s generation on this hardware.

### Architectural consequence

~1 s is fine per-utterance and impossible per-frame. Affect inference must be two-tier:

- **Tier 1 — reflex (< 1 ms).** Lexicon + prosody. Drives the face the instant sound
  starts. NRC-VAD / Warriner valence-arousal-dominance norms over the token stream,
  plus live F0, energy and speaking-rate features from the audio.
- **Tier 2 — appraisal (~1 s, async).** The LLM pass. Returns a richer affect vector
  that is *blended into* the running state rather than snapped to, so the correction
  reads as a natural settling rather than a pop.

This is not a workaround for slow inference. It mirrors the structure of human affect:
a fast automatic reaction followed by a considered appraisal that colors it. Tier 1
must stand alone and look right on its own, because Tier 2 is allowed to fail.

## Reference request shape

```jsonc
{
  "model": "qwen/qwen3.6-35b-a3b",
  "temperature": 0.2,
  "max_tokens": 150,
  "messages": [ /* ... */ ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "affect",
      "strict": true,
      "schema": { /* full schema — required, additionalProperties:false */ }
    }
  }
}
```

Read `content`; if empty, read `reasoning_content`.

## Finding 5 — model bake-off for Tier 2 affect

Three local models, three utterances each, schema-constrained, identical prompt.

| Model | Avg latency | Verdict |
|---|---|---|
| `qwen/qwen3.6-35b-a3b` | **0.71 s** | **Selected.** Clean JSON every call, well-discriminated affect. |
| `trinity-mini` | 2.44 s | Rejected. Ignores the grammar, emits prose reasoning. |
| `google/gemma-4-26b-a4b-qat` | 6.28 s | Rejected. Degenerates under constraint. |

The 35B is both the fastest and the most accurate, so there is no tradeoff to weigh.
First call in a burst costs ~0.93 s against ~0.59 s warm — keep the model warm with a
periodic no-op ping rather than paying warmup on the user's first utterance.

### The PAD axis earns its place

The 35B's returned vectors:

| Utterance | V | A | D | Primary |
|---|---|---|---|---|
| "Oh — oh wow, I actually did not expect that to work. Look at it go!" | +0.8 | 0.7 | 0.6 | joy |
| "I don't... I really don't know how to tell you this. I'm sorry." | −0.8 | 0.3 | **0.2** | sadness |
| "That is the third time you have ignored me. I am done asking nicely." | −0.8 | 0.7 | **0.6** | anger |

Sadness and anger share a valence of −0.8 and separate on dominance. The sharper case is
anger vs. fear: both strongly negative, both high-arousal, distinguishable *only* by
dominance — and their body language is opposite (expand and advance vs. contract and
retreat). A 2D valence-arousal model cannot drive posture. **Use all three axes.**

### Degenerate-output guard

Gemma returned `"primary": "surprise-surprise-surprise-surprise-..."` and, on the anger
utterance, an all-zero vector. A JSON schema guarantees *parseable*, never *meaningful*.

The affect client must validate semantically, not just structurally:

- reject all-zero / all-identical vectors,
- reject `primary` values outside the known emotion set,
- reject repetition-collapsed strings,
- on any rejection, keep Tier 1's value and log — never let a bad Tier 2 result snap the face.

## Other models available locally

`google/gemma-4-26b-a4b-qat`, `prism-ml/bonsai-27b`, `trinity-mini`,
`qwen3.6-35b-a3b-mtp` (multi-token prediction — worth benchmarking for lower latency),
`unsloth/qwen3.6-35b-a3b-mlx` (MLX build — also worth benchmarking),
`nvidia-nemotron-3-nano-30b-a3b-mlx`, `qwen/qwen3-30b-a3b-2507`.

A small non-thinking model would remove the channel-split problem entirely and cut Tier 2
latency substantially. Worth measuring before committing to the 35B for affect work.
