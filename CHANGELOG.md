# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog], and this project adheres to [Semantic Versioning].

## [Unreleased]
- Refresh top navigation with sliding indicator, mobile drawer, and scroll effects.
- Refactor Properties list with kebab actions, mobile cards, and status badges.
- Unify Work Orders toolbar (search + filters + CTA) and empty state UX.
- Fix Work Order delete flow (clear assigned interest before delete).
- Add seed_real_photos script to generate properties with real images and work orders.
- Document deferred Next.js security upgrade in README.

## [0.2.1] - 2026-02-05
- Implement Work Orders module with quote/fixed flows, admin approvals, and status transitions.
- Add public provider portal with expiring token links and proof submission (Pix + photo).
- Add work order delete endpoint with audit log events.
- Introduce ADRs for portal design, status model, token hashing, proof requirements, and event logging.
- Add seed_large script updates and dashboard UX improvements for work orders.

## [0.2.0] - 2026-02-04
- Consolidate rental contract import into Create/Edit Property with LLM suggest/apply flow.
- Add contract field overwrite confirmation and persist contract fields per property.
- Improve property detail layout with carousel, rent/net display, and rented badge.
- Add activity log page with user-scoped visibility and linked files list.
- Add document download endpoint and property contract linkage.
- Polish UI alignment, dark scrollbars, and photo preview behavior.

## [0.1.5] - 2026-02-03
- Add property import flow using LLM to prefill the create form.
- Add property photo uploads (up to 10) with thumbnail preview.
- Link uploaded contract documents to property details with download links.
- Enforce property ownership visibility for non-admin users.
- Update docs and samples for the new import workflow.

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
