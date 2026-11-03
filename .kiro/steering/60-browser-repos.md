---
inclusion: fileMatch
fileMatchPattern: ["**/browser-repos/**", "**/adapters/history/**", "**/*git*.ts"]
---

# browser-repos / history-storage rules (scoped)

Loads only when working on the browser Git library or the history-store adapter.

## Core boundaries
- Core is **free of UI, LLM calls, and app logic**. It is reusable outside this product.
- Use pinned, tested **isomorphic-git** + **LightningFS** backed by **IndexedDB**.
- **IndexedDB only** — never `localStorage`, never `chrome.storage`.
- Bundle executable deps locally for **Manifest V3**: no runtime CDN code, no `eval`.

## Operations
- Local ops work **offline** without a server or native Git. Network ops require explicit
  caller requests; any CORS proxy must be explicitly configured.
- Prioritize local work and recovery before sync. Surface network/CORS/auth/divergence/
  conflict errors distinctly.
- Credentials come from caller hooks; NEVER persist them or include them in repo data,
  remote URLs, exports, commits, or logs.
- Support: multiple repos, reopen, file read/write, status, staging, commits,
  branches/checkouts, history, and lossless export/import (working tree, .git, binaries,
  staged + untracked, branches, history). Validate paths and archive entries.

## Durability (don't assume)
- Test LightningFS in real MV3 workers, abrupt termination, and reopening. Treat memory as
  disposable; serialize conflicting mutations across contexts; establish durability rather
  than assuming awaited writes are crash-safe. If inadequate, show evidence and propose the
  smallest storage alternative before changing the design.
- Report quota errors and storage loss clearly; browser storage is NOT a backup.

## Usage scope for the product
- Used for **customization history**, scoped per user+app, separate from business data and
  creator-owned source. Rollback must not revert tasks/stock or shared code, affect other
  users, or change creator defaults.
