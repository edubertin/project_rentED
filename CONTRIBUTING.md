# Contributing Guide

Thanks for contributing to rentED API. This project favors small, reviewable changes and explicit database migrations.

## Ground Rules
- Keep changes small and focused.
- Do not bypass validations or migrations.
- Add tests for core behavior (1–3 minimal tests per feature).
- The database is the source of truth.

## Development Workflow
1) Create a branch
```
git checkout -b feature/short-description
```

2) Install and run via Docker
```
docker compose up -d --build
```

3) Apply migrations
```
docker compose run --rm api alembic upgrade head
```

4) Run tests
```
docker compose run --rm api pytest
```

5) Commit with a clear message
```
git add .
git commit -m "Concise change summary"
```

## Migrations
- Update models first.
- Generate migration:
```
docker compose run --rm api alembic revision --autogenerate -m "describe_change"
```
- Review and edit the migration file before applying.

## Pull Requests
- Explain the motivation and scope.
- Include testing notes and migration steps if relevant.
- Keep PRs small and focused.

## Code Style
- Use clear, explicit names.
- Prefer readable, boring code.
- Avoid cleverness that hurts maintainability.

---

If you have any questions, open an issue or start a discussion.
