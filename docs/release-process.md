# Release process

1. Confirm the worktree is clean and CI is green.
2. Run `pnpm fetch:upstream` and `pnpm verify:upstream`.
3. Run lint, typecheck, tests, browser tests, and the production build applicable to the release.
4. Generate `pnpm generate:sbom` and `pnpm package:source`.
5. Record runtime artifact, SBOM, and source archive SHA-256 values in the release manifest.
6. Publish all artifacts in the same GitHub release.
7. Deploy only immutable versioned assets.
8. Verify the runtime legal/About view links to that release's license and source archive.
9. Retain the prior validated release for rollback.

Never release from a dirty tree, moving branch reference, or unverified upstream cache.
