# Local editor runtime MVP

The `/editor` route hosts the unmodified public ONLYOFFICE SDKJS/Web Apps distribution and replaces Document Server session traffic with an in-browser adapter. The adapter authenticates one local participant, responds to lock/save-part/media requests, and captures the native editor state for x2t export.

The parent communicates only through protocol v1 envelopes defined in `contracts/editor-bridge.schema.json`. Both channel ends require the exact origin, exact source window, UUID session ID, known message type, and an exact payload shape. Wildcard `postMessage` targets are not used, and the iframe receives only its short-lived editor-purpose token—not a Dokumi business access token.

Recovery snapshots are keyed by user, template, and session in IndexedDB. They include the base revision, checksum, editor state, media, and latest exported DOCX. Records older than seven days are removed on open; quota failures become `RECOVERY_QUOTA_EXCEEDED`; the parent can request a local DOCX download.

Browser acceptance is in `tests/browser/editor-runtime.spec.ts`: it opens a signed fixture, edits the real canvas, captures/export the document, verifies the DOCX XML, reloads the iframe, and proves the matching recovery snapshot is reopened without downloading or reconverting the source.

Runtime/editor/x2t assets are published below `/releases/0.1.0/` with immutable caching. Because the raw x2t WASM exceeds Workers Static Assets' 25 MiB per-file limit, deployment uploads a 7.9 MiB Brotli representation under an opaque `.bin` extension and invokes `src/deploy-worker.ts` for the canonical `.wasm` URL. The Worker uses Cloudflare's manual response encoding mode so the pinned Brotli stream is not compressed again. The response is verified as `Content-Encoding: br` and `Content-Type: application/wasm`; local Vite tests retain the raw file. HTML is no-cache, frame ancestors are restricted to Dokumi creator/app origins, and the runtime exposes an exact-commit AGPL source link without disabling ONLYOFFICE branding or About/legal UI.
