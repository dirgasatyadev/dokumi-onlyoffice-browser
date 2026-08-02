# Corresponding source

Every deployed runtime release must provide the complete corresponding source for that exact build through a plainly visible **Source Code** link in the runtime legal/About interface.

The source release contains:

- this repository at the exact release commit;
- the locked SDKJS source archive;
- the locked Web Apps source archive;
- the locked x2t WASM fork source archive, including history references and build scripts;
- adapter, bridge, worker, recovery, deployment, and packaging source;
- lockfiles, build instructions, patches, notices, and release manifest.

Generate it with:

```bash
pnpm fetch:upstream
pnpm verify:upstream
pnpm package:source
```

The generated archive is placed under `dist/source/`. Release automation must publish its SHA-256 checksum beside the binary/runtime artifact. Archives and caches are excluded from Git because the upstream source package is large.

Source requests and compliance concerns may be opened through the repository's public issue tracker. Security vulnerabilities must use the private process in `SECURITY.md`.
