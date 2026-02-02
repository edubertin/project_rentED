# Security Policy

## Supported Versions
Only the latest release is supported.

## Reporting a Vulnerability
Please open a private security advisory on GitHub or email the maintainer.
Provide a clear description and reproduction steps.

## Known Advisories (Development)
- Next.js has a high-severity advisory affecting Image Optimizer and Server Components. We keep Next 14.2.35 during development to avoid breaking changes and plan to upgrade to Next 16 before production.

## Development-Only Endpoints
- `/users` is a development/testing helper to create users for FK relationships. Remove or protect it before production.
