# Dokumi ONLYOFFICE Browser Runtime

Public browser runtime for editing Dokumi template DOCX files with unmodified ONLYOFFICE SDKJS/Web Apps and an x2t WebAssembly worker.

> This repository is an integration project maintained by Dokumi. It is not an official ONLYOFFICE product and is not endorsed by Ascensio System SIA.

## Status

The MVP now contains the pinned public editor distribution, local single-participant DocService adapter, strict parent/iframe bridge, IndexedDB recovery, and browser-side DOCX export. It does not require ONLYOFFICE Document Server for an editing session.

1. reproducible upstream fetch and verification;
2. x2t WASM DOCX/`Editor.bin` round-trip (complete);
3. local DocService adapter (complete);
4. IndexedDB recovery (complete);
5. strict parent/iframe bridge (complete);
6. versioned static deployment and corresponding-source release pipeline (complete).

## Licensing and attribution

The code in this repository is distributed under GNU AGPL v3.0 with the applicable ONLYOFFICE Section 7 additional terms included in [LICENSE](LICENSE). Some upstream non-code content may be licensed under CC BY-SA 4.0. See [NOTICE.md](NOTICE.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and [SOURCE_OFFER.md](SOURCE_OFFER.md).

ONLYOFFICE and its marks belong to their respective owner. The license does not grant trademark rights; use remains subject to the [ONLYOFFICE Trademark Policy](https://www.onlyoffice.com/trademark-policy).

## Upstream sources

All upstream inputs are pinned by immutable commit SHA, archive byte length, and SHA-256 digest in [upstream.lock.json](upstream.lock.json):

- `ONLYOFFICE/sdkjs`;
- `ONLYOFFICE/web-apps`;
- public fork `dirgasatyadev/onlyoffice-x2t-wasm`, based on `cryptpad/onlyoffice-x2t-wasm`.

No upstream archive is committed to Git. Fetch and verify it locally:

```bash
pnpm fetch:upstream
pnpm verify:upstream
```

The browser build also fetches the pinned x2t release artifact and verifies the archive plus both extracted files against `artifacts.lock.json`:

```bash
pnpm fetch:x2t
pnpm verify:artifacts
pnpm build
```

The editor ZIP and its exact corresponding-source archive are independently pinned in `editor.lock.json`:

```bash
pnpm fetch:editor
pnpm fetch:editor-source
pnpm verify:editor
```

The complete source package is intentionally large because it contains the exact upstream source archives:

```bash
pnpm package:source
```

## Development

Requires Node.js 24 and pnpm 11.17.0.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e --project=chromium
pnpm generate:sbom
pnpm verify:lock
```

See [docs/building.md](docs/building.md), [docs/x2t-testing.md](docs/x2t-testing.md), [docs/licensing.md](docs/licensing.md), and [docs/release-process.md](docs/release-process.md).

## Security

Do not report vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).
