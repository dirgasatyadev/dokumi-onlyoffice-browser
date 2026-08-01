# Building

## Requirements

- Node.js 24.x
- pnpm 11.17.0
- Git
- `tar` with gzip support for corresponding-source packaging
- approximately 2 GiB free space for verified upstream archives and packaging workspace

## Governance baseline

```bash
pnpm install --frozen-lockfile
pnpm verify:lock
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm generate:sbom
```

`pnpm build` currently emits only a governance scaffold manifest. `pnpm generate:sbom` emits a CycloneDX 1.6 inventory for application dependencies and locked upstream sources. A functional editor build is intentionally deferred until the x2t round-trip ticket.

## Upstream source

```bash
pnpm fetch:upstream
pnpm verify:upstream
```

Downloads are streamed into `.cache/upstream`, checked for exact byte length and SHA-256, and excluded from Git. A missing, truncated, or changed archive fails verification.

## Corresponding-source package

Commit all intended source first, then run:

```bash
pnpm package:source
```

Packaging fails on a dirty worktree. The output under `dist/source/` contains the repository at `HEAD`, exact upstream archives, a source manifest, and a sibling SHA-256 file.
