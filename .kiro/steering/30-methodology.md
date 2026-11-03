---
inclusion: always
---

# Development methodology — tracer bullet + flywheel + dogfooding

We combine three complementary methodologies. They reinforce the PM directive to "verify
the smallest end-to-end customization flow in one app before expanding."

## 1. Tracer bullet (thin, end-to-end, real)

Build the **narrowest path that touches every layer and actually runs**, end to end,
before thickening any one layer. Our first tracer bullet is the enforced flow:

```
request → real-agent proposal → deterministic validation → preview → apply → save → reopen → undo
```

implemented in `src/domain/customization/orchestrator.ts`, wired to real ports (inference,
history) with labeled test-double adapters. It connects inference → validator → history
with no app-specific logic. We thicken layers (real Anthropic adapter, browser-repos store,
TailoredUI capability, Planner/Inventory UIs) only after the bullet flies and is tested.

**Rule:** a new capability is "done" only when it is exercised end-to-end by a test or a
runnable demo — never a layer in isolation claimed as working.

## 2. Flywheel (compounding reuse)

Each turn of the wheel makes the next cheaper. The shared foundation (domain + ports +
validator + orchestrator) is built once; Planner and Inventory both spin it. Every invariant
we add ships with reusable passing/violating test fixtures. The second app must cost
dramatically less than the first — if it does not, the foundation is leaking app-specific
concerns and needs tightening. Momentum comes from contracts that are reused, not recopied.

**Rule:** before adding code to an app, ask whether it belongs in the shared foundation so
both apps (and future adopters) benefit.

## 3. Dogfooding (we use what we ship)

We use the foundation the same way a third-party adopter would: through its public exports
and ports, never by reaching into internals. The Planner and Inventory apps are our own
first customers and our honesty check — if adopting the foundation is awkward for us, it is
awkward for judges and future adopters. Development evidence (specs, decisions, the friction
we hit) stays in the public `.kiro/`.

**Rule:** if we cannot adopt the foundation without special-casing or private access, fix
the foundation, not the app.

## How they interact

- The **tracer bullet** proves the flow is real and enforceable.
- The **flywheel** turns that proven flow into cheap, compounding reuse across both apps.
- **Dogfooding** keeps the reuse honest by making us the first consumer of our own contracts.
