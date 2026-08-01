# Dokumi ONLYOFFICE Browser Runtime

Public browser runtime for editing Dokumi template DOCX files with unmodified ONLYOFFICE SDKJS/Web Apps and an x2t WebAssembly worker.

> This repository is an integration project maintained by Dokumi. It is not an official ONLYOFFICE product and is not endorsed by Ascensio System SIA.

## Status

The repository is currently at the governance and reproducible-source baseline. It does **not** yet contain a working editor runtime. The implementation sequence is:

1. reproducible upstream fetch and verification;
2. x2t WASM DOCX/`Editor.bin` round-trip;
3. local DocService adapter;
4. IndexedDB recovery;
5. strict parent/iframe bridge;
6. static deployment and release source package.

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
pnpm verify:lock
```

See [docs/building.md](docs/building.md), [docs/licensing.md](docs/licensing.md), and [docs/release-process.md](docs/release-process.md).

## Security

Do not report vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).
