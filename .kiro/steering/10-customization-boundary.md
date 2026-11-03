---
inclusion: always
---

# Customization Boundary — the core invariant model

This is the heart of the entry: **how user preferences and model-generated changes coexist
with creator-owned rules.** Keep it narrow, enforceable, and honest.

## Three layers, explicit precedence

Precedence is strict and one-directional. Higher layers constrain lower ones; lower layers
can never relax higher ones.

1. **Creator Policy** (trusted) — one explicit, versioned definition owned by the creator.
   Separate file/representation from everything below. Defines **invariants**: allowed
   actions, required controls, measurable visual limits (including applicable accessibility
   and branding constraints). Permissions and business rules hold **independently of
   presentation**.
2. **Defaults** (trusted) — the app's shipped baseline configuration. Must itself satisfy
   the policy.
3. **User Preferences** (untrusted) — produced by the end-user and/or the in-app agent.
   May only select among policy-allowed options; may express overridable/subjective goals.

> Policy > Defaults > Preferences. A preference or model proposal that conflicts with
> policy is **rejected**, not merged.

## Invariants vs. preferences vs. goals

- **Enforced invariants** — deterministically checkable; violation ⇒ reject. Examples:
  a required control must remain present and operable; a visual limit (e.g. min contrast
  ratio, min font size, max density) must hold; a disallowed action must be absent;
  policy/validator definitions must be unmodified.
- **Overridable preferences** — within policy-allowed ranges; applied if valid.
- **Subjective goals** — "make it calmer"; interpreted by the agent into concrete
  proposals that are then validated like anything else. Never trusted as self-justifying.

Every selected invariant MUST have both a **passing** and a **violating** test case,
covering at minimum: required-control removal, visual-limit violation, disallowed action,
and attempts to modify policy or validation.

## The enforced flow (applies to both apps)

```
request  →  real-agent proposal  →  deterministic validation  →  preview
        →  apply  →  save  →  reopen  →  undo
```

- **Validation is deterministic and server-of-truth**, independent of the model. It runs on
  the *proposed configuration* AND on the *resulting view's* invariants.
- **Preview** shows the candidate view without committing it.
- **Apply** only after validation passes. On rejection: explain (cite the rule), keep the
  last valid view (recoverable).
- **Save / reopen / undo** go through versioned customization state (see 20-browser-repos
  and 30-foundation). Reopen and rollback are **revalidated under current policy**;
  incompatible state is migrated or given a safe fallback.

## Trust & isolation rules

- Model output is **data**, never executable code in the host app. No `eval`, no dynamic
  code paths fed by proposals.
- The representation is the **simplest enforceable** one: validated config + design tokens
  + an allow-list of approved components. No open-ended policy DSL.
- Business rules / permissions are enforced in the domain layer, not the view layer, so
  presentation customization can never escalate privileges or bypass rules.

## Explicitly out of scope

- A general policy framework or universal-correctness claims.
- Open-ended research into model alignment.
- Code editing / arbitrary component authoring by end-users (requires PM sign-off first).
