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

`pnpm build` verifies and prepares the pinned x2t and ONLYOFFICE editor files under immutable `/releases/0.1.0/` paths, builds the application, and emits a release manifest. `pnpm generate:sbom` emits a CycloneDX 1.6 inventory for application dependencies, locked upstream sources, x2t, and the editor distribution. See [x2t-testing.md](x2t-testing.md) for the browser round-trip gate.

## x2t release artifact

```bash
pnpm fetch:x2t
pnpm verify:artifacts
```

The archive and extracted `x2t.js`/`x2t.wasm` files must match exact byte lengths and SHA-256 values in `artifacts.lock.json`. Cached and public copies are excluded from Git.

## Editor distribution and source

```bash
pnpm fetch:editor
pnpm fetch:editor-source
pnpm verify:editor
```

`editor.lock.json` binds the public CryptPad editor release ZIP to its immutable source commit and separately checksums the corresponding-source tarball. The runtime copies the distribution without patching SDKJS or Web Apps; the only generated addition is a scope-relative copy of the distribution's canonical service worker.

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

Packaging fails on a dirty worktree. The output under `dist/source/` contains the repository at `HEAD`, exact upstream archives (including the editor corresponding source), a source manifest, and a sibling SHA-256 file.
