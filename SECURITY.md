# Security policy

## Reporting

Do not disclose a suspected vulnerability in a public issue. Use GitHub's **Security → Report a vulnerability** workflow for this repository.

Include the affected commit/release, browser, reproduction steps, impact, and whether document content or credentials may have been exposed. Do not attach private documents, production tokens, signed URLs, cookies, or user data.

## Supported versions

Until the first production release, only the current default branch is supported. After release, the latest production version and the immediately preceding rollback version will receive security fixes.

## Security invariants

- no Dokumi business access token enters the iframe;
- exact-origin and exact-source-window message validation;
- no wildcard `postMessage` target;
- short-lived, narrowly scoped editor tokens and signed URLs;
- checksum and DOCX archive validation before a saved revision becomes active;
- upstream inputs pinned by commit and checksum;
- no document content, token, signed URL, or credential in telemetry/logs.
