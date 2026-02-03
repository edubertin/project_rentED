# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog], and this project adheres to [Semantic Versioning].

## [Unreleased]
- TBD.

## [0.1.4] - 2026-02-03
- Add admin-only Users dashboard with create/edit/delete flows.
- Enforce stricter username, name, and password validation rules.
- Protect admin accounts from deletion.
- Improve dashboard styling consistency and error messaging.
- Update docs for auth rules and Users management.

## [0.1.3] - 2026-02-02
- Add session-based authentication with admin-only user management.
- Add login page and auth guards to frontend.
- Add AI extraction pipeline (LangChain + OpenAI) with confidence and review flow.
- Add OCR option for images (Tesseract).
- Record document processing activity logs.
- Update Next.js to 14.2.35 and document known advisory for dev.

## [0.1.1] - 2026-02-02
- Add Next.js dashboard (properties, detail, work orders, upload).
- Add dashboard docs and Swagger separation.
- Add CORS for local dev ports and upload bind mount.

## [0.1.0] - 2026-02-02
- Initial backend scaffold, migrations, tests, docs dashboard, and Swagger.

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
[Semantic Versioning]: https://semver.org/
