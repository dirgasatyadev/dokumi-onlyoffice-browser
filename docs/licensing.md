# Licensing and release compliance

This project is distributed under GNU AGPL v3.0 with the applicable ONLYOFFICE Section 7 additional terms included in the root `LICENSE` file. This document is an engineering compliance checklist, not legal advice.

Every distribution must:

- retain all upstream license, copyright, warranty, attribution, and origin notices;
- identify ONLYOFFICE as the original developer in an accessible interactive notice;
- state prominently that Dokumi's integration is modified and is not an official ONLYOFFICE product;
- preserve license/About access and provide a Source Code link for the exact running release;
- retain CC BY-SA notices for applicable non-code content;
- comply separately with the ONLYOFFICE Trademark Policy;
- never ship an x2t WASM binary without its exact public source, patches, and build scripts.

SDKJS and Web Apps are consumed unmodified in the first phase. If either source tree is patched later, the patch, modification date, changelog, source archive, and build instructions must be public before deployment.

Perform an independent legal review before commercial production release.
