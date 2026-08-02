# dokumi-onlyoffice-browser

- Repository ini publik dan seluruh kode yang dikirim ke browser wajib tersedia sebagai corresponding source.
- Pertahankan license, copyright, attribution, branding, About, legal notice, serta additional terms ONLYOFFICE.
- Jangan memakai `branding: false`, membuka feature komersial, atau mengklaim runtime sebagai produk resmi ONLYOFFICE.
- Jangan menambahkan business secret, access token Dokumi, signed URL, document fixture privat, atau data pengguna.
- Pin semua upstream dengan commit SHA dan checksum; jangan memakai branch bergerak atau `latest` dalam build/release.
- Source SDKJS dan Web Apps tidak boleh dimodifikasi pada fase pertama. Patch x2t harus berada di fork publik dengan history yang dapat diaudit.
- Jalankan `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:lock`, dan quality gate upstream yang relevan sebelum handoff.
