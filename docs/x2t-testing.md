# x2t WASM testing and baseline

The x2t tests live in `tests/browser/x2t-roundtrip.spec.ts` and run against the production Vite bundle, not a mock converter. The corpus is generated locally by `tests/browser/fixture.ts`; it contains no user document or Dokumi private data.

Run the minimum Chromium gate:

```bash
pnpm exec playwright install chromium
pnpm test:e2e --project=chromium
```

Run the compatibility gate:

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

The golden fixture covers body text, a table, an image, header/footer relationships, a `{{nama_lengkap}}` placeholder, Japanese, Greek, and emoji. The near-limit case is a valid 49,295,971-byte DOCX, below the 50 MiB application limit. Tests validate OPC entries, absence of a macro project, retained content, media extraction, transferable-buffer detachment, main-thread heartbeats, structured initialization failure, and VFS cleanup after both conversion directions.

## Baseline — 1 August 2026

Environment: Windows x64, 6 logical CPUs, Playwright 1.62.1, x2t release `v9.3.0+0` at source commit `96886ff143e05471144c4426fb304b4d794370d2`.

| Corpus / browser | Open | Save | WASM linear-memory high-water | Result |
| --- | ---: | ---: | ---: | --- |
| Golden / Chromium | 297 ms | 284 ms | 297,730,048 bytes | pass |
| Golden / Firefox | 64 ms | 159 ms | 297,730,048 bytes | pass |
| Golden / WebKit | 475 ms | 49 ms | 297,730,048 bytes | pass |
| Near-limit / Chromium | 3,553 ms | 3,699 ms | 357,302,272 bytes | pass |

These are smoke-test observations, not service-level objectives. Linear-memory size is the best runtime-local memory signal exposed by this Emscripten build; it excludes browser-process overhead. Current uncompressed assets are 135,941 bytes for `x2t.js` and 35,985,703 bytes for `x2t.wasm` (36,121,644 bytes total). CI runs Chromium; Firefox and WebKit remain the local release compatibility gate.
