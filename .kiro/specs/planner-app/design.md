# Design — Planner App

Status: **planned.** Lives in the `user-tailored-planner` repo; a reproducible runnable copy
is vendored into `user-tailored-ui/apps/planner/` for submission (see hackathon compliance).

## Layers (dogfooding the foundation)

- **Domain (planner):** `Task` entity + pure operations (create/edit/reorder/complete). No
  React/model/storage. Enforces task-identity stability.
- **Business persistence:** tasks stored separately from customization state (IndexedDB via a
  thin store; keyed by user). Never mixed with customization history.
- **Customization:** constructs the Planner `CreatorPolicy`, builds the `defaults` view
  (board), and drives the foundation's `CustomizationOrchestrator` through its public API.
- **UI:** React + Vite. Renders the current view via the `UiCapability` port (TailoredUI
  adapter). An "agent" panel takes an utterance → preview → apply/undo.

## Flow wiring

```
utterance → orchestrator.proposeFromUtterance(view, text)
          → validated preview (or structured rejection shown inline)
          → apply → orchestrator.applyAndSave(scope, base, previewView, msg)
          → reopen on load; undo via history ref
```

Agent adapter is injected: `TestDoubleInferenceAdapter` by default (offline), swappable for
the Anthropic adapter when configured — no Planner code change (port boundary).

## Agenda transform

The "focused daily agenda" is expressed purely as a validated proposal: swap `board`→`agenda`
component, set `density: compact`, keep `task-card` + the complete control + all task ids.
This proves meaningful customization without touching business data.

## Testing

- Planner domain unit tests (task ops, identity stability).
- Foundation-integration tests: agenda apply passes; the four violation classes reject;
  save/reopen/undo preserve tasks and the required control.
- Runnable demo exercises the flow; CI uses the test-double adapter.
