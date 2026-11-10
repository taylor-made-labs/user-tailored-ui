# Design — user-tailored-ui (forward spec)

Implements `requirements.md`. Builds on `customization-foundation/design.md`. Items marked
**ASSUMPTION** are guesses for the user to correct.

## 1. Shape

```
 creator-policy.json ──(schema check)──▶ CreatorPolicy (trusted, read-only)
                                              │
 user words ─▶ InferenceProvider ─▶ Proposal ─▶ Validator ─▶ per-part verdicts
              (real; port)          (data)      (pure)        │ valid parts
                                                              ▼
                  View ◀── apply ◀── preview ◀──── Orchestrator
                    │
                    └─▶ CustomizationHistory (browser-repos, IndexedDB-git)
                          save · reopen(revalidate) · undo
 Business data (tasks / stock) lives in its own IndexedDB store. Never rolled back by undo.
```

Hexagonal, as today. New or changed ports/adapters are in bold.

| Port | Adapters |
|---|---|
| `InferenceProvider` | **AnthropicMessagesAdapter** (browser/broker), AgentSdkAdapter (dev only), TestDoubleAdapter (tests only) |
| `CustomizationHistory` | **BrowserReposHistory** (hoisted into the foundation), InMemory (tests) |
| `UiCapability` | in-repo adapter now; **TailoredUiAdapter** if T4.1 passes |
| **`PolicySource`** (new) | `JsonPolicySource` (loads + schema-validates `creator-policy.json`) |
| **`KeyStore`** (new) | `SessionKeyStore` (memory), `IdbKeyStore` (IndexedDB `secrets`) |

## 2. Creator policy file

`apps/<app>/creator-policy.json`, validated against `schemas/creator-policy.v1.schema.json`
(JSON Schema 2020-12) by Ajv at build time (Vite plugin) and at load time.

```json
{
  "$schema": "../../schemas/creator-policy.v1.schema.json",
  "schemaVersion": "1.0.0",
  "policyVersion": "2026.11.1",
  "allowedActions": ["task.create", "task.edit", "task.reorder", "task.complete"],
  "requiredControls": [{ "id": "complete-task", "ruleId": "required-control.complete-task",
                          "why": "Users must always be able to finish a task." }],
  "allowedComponents": ["board", "agenda", "task-card", "add-task"],
  "layout": { "slots": { "top": ["add-task"], "main": ["board", "agenda"] } },
  "tokens": {
    "fontScale": { "type": "number", "min": 1, "max": 2, "ruleId": "token-range.fontScale" },
    "density":   { "type": "enum", "values": ["compact", "comfortable"] },
    "accent":    { "type": "color", "palette": ["#0f766e", "#1d4ed8", "#9333ea"],
                   "minContrastAgainst": "#ffffff", "minRatio": 4.5 }
  },
  "inference": { "keyModes": ["byok", "managed"], "byokRoute": "broker" }
}
```

Design choices:
- Every rule has a `ruleId`. Rejections cite it. Default ids are derived
  (`required-control.<id>`) so they stay stable if the creator omits one.
- `additionalProperties: false` everywhere; `description` + `examples` on every field so an
  AI agent can use the schema as its documentation.
- Errors come from Ajv, then are rewritten into `path: message. Fix hint.` (R4.4).
- Versioning: `schemaVersion` is the file format; `policyVersion` is the creator's own
  content version, stored with every saved customization for revalidation (R4.7).
- The existing `CreatorPolicy` TS type stays as the in-memory form; the loader maps JSON →
  that type. **ASSUMPTION A13:** the mapping is lossless for current fields; `layout` and
  `color` are additions to the validator.
- Later creator editor (phase 5): a form generated from the same JSON Schema
  (**ASSUMPTION A14:** a schema-driven form library such as `@rjsf/core`; chosen at that
  time).

## 3. Partial apply (A1)

Today: whole-proposal accept/reject. Change: the validator splits a proposal into
**parts** (each token, each slot change, each control change, each action) and returns
`{part, ok, ruleId?, message?}[]`. The orchestrator builds the candidate from the ok parts
only, then re-runs resulting-view invariants on the candidate. If the combination of ok
parts breaks an invariant, the offending part is rejected too (loop until stable;
bounded by part count). Pure function, same input gives the same output. Policy-tamper
attempts reject the whole proposal (not partial) because they signal a bad proposal.

## 4. Inference and keys

### 4.1 Adapter
`AnthropicMessagesAdapter` uses `@anthropic-ai/sdk` with a configurable `baseURL`:
- managed / broker routes: `baseURL = <broker>`, no key in the browser.
- direct BYOK: `baseURL` default, `dangerouslyAllowBrowser: true`, user's key.
It sends the surface (allowed tokens, components, slots, actions, current view summary)
and asks for JSON only matching the proposal shape. The reply is parsed with a strict
schema (the proposal shape as JSON Schema). Anything else is `invalid-response`.
Model id is a config value. **ASSUMPTION A15:** a Haiku-class model at default settings
(matches the existing Agent SDK adapter default); tune after the first live run.

### 4.2 Where each call goes

| Mode | Browser sends | Goes to | Key lives | Browser bundle has key? |
|---|---|---|---|---|
| Managed | request, no key | broker → Anthropic | server env var | No |
| BYOK, default | request + user key header | broker (pass-through) → Anthropic | user's browser; broker memory per request only | No (user types it) |
| BYOK, direct (opt-in) | request + user key + browser-access header | `api.anthropic.com` | user's browser | No (user types it) |

The direct route is labeled in the UI as key-exposing (steering 40). It exists because it
needs no backend for a quick demo.

### 4.3 Broker
A small stateless HTTP function (**ASSUMPTION A16:** AWS Lambda behind a function URL or
API Gateway, since the user is connecting AWS; Cloudflare Worker is the fallback — human
choice, see tasks H2). One route: `POST /v1/messages`.
- Managed: adds `x-api-key` from `process.env.ANTHROPIC_API_KEY`.
- BYOK: forwards the caller's `x-api-key`; never logs headers or bodies.
- Checks: origin allow-list (CORS), model allow-list, `max_tokens` cap, body-size cap,
  per-IP rate limit. Streams or buffers the reply (buffered is enough: proposals are small).
- Errors map to `InferenceError` kinds (401→auth, 402/429 quota text→quota, 429→rate-limit).

### 4.4 KeyStore
`SessionKeyStore` is default. `IdbKeyStore` writes `{id:'anthropic', key}` to IndexedDB DB
`utui-secrets` only on "remember". Key is wrapped in an opaque `SecretString` class whose
`toString`/`toJSON` print `[redacted]` so it cannot leak through logging or JSON. The
history adapter and exporter take no `SecretString`; a canary test enforces it (R3.4).
Hardening later (T3.6): WebCrypto AES-GCM with a non-extractable key.

## 5. History wiring (browser-repos)

Move the duplicated `history-browser-repos.ts` from the two apps into the foundation as
one adapter. The apps import it via `src/ports/foundation.ts`. `browser-repos` is a pinned
dependency; replace the tarball built from `369ab3d` with a tarball from `main` at a
recorded SHA (T1.1), and make `vendor-apps.sh` stop deleting wiring (T1.2).

Preferred alternative (**ASSUMPTION A17**): foundation publishes a workspace package and
the apps consume it, so `vendor-apps.sh` goes away. This is larger; T1.2 does the
minimal safe fix first (script preserves a list of app-owned paths) and records the
workspace approach as a later option.

## 6. TailoredUI

Facts in R6. Plan: T4.1 spikes (≤ half a day) to read the fork source and decide what
it can supply. Likely contribution (A11): token model and component descriptors feeding
the `UiCapability` adapter. If kept: fork changes go on `taylor-made-labs/TailoredUI`
branch `utui/*`, one concern per commit, pinned by SHA, listed in README. If not usable
in time: say so (R6.6).

## 7. Testing

- Unit: schema (valid + invalid fixtures per field), validator partial apply, key canary,
  adapter with mocked fetch (success, bad JSON, 401, 429, network).
- Integration: apps with `fake-indexeddb` (exists).
- Browser: Playwright against `vite preview`, real IndexedDB, reload + undo (R7.1).
- Live (gated): R1 path against real model (R7.3). Model output varies, so the live test
  asserts shape and rule ids (the "3x font" and "remove complete" asks must be rejected),
  not exact text.
- Bundle checks in CI: no `sk-ant-`, no test-double in production build.
- **Every selected invariant keeps one passing and one violating test** (steering 10).

## 8. Risks

| Risk | Handling |
|---|---|
| Model returns off-shape or hostile JSON | Strict parse; validator is the guarantee |
| Real model won't produce a violation on cue | The demo asks for a violation in plain words; model usually complies. If it refuses, that is fine; the validator tests prove the rule. Note in README. |
| IndexedDB-git not durable on abrupt close | Steering 60 asks for evidence; Playwright test + documented limit |
| Broker abuse (managed key) | Origin + model + token caps + rate limit; spend alarm (human task H3) |
| Fork gives nothing usable | R6.6, honest README |
