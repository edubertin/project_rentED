<p align="center">
  <img src="frontend/public/brand/logo.png" alt="rentED logo" width="680">
</p>

![CI](https://github.com/edubertin/project_rentED/actions/workflows/ci.yml/badge.svg)
![Secret Scan](https://github.com/edubertin/project_rentED/actions/workflows/secret-scan.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB)
![License](https://img.shields.io/github/license/edubertin/project_rentED)
![Release](https://img.shields.io/github/v/release/edubertin/project_rentED)

rentED is a property management platform that combines a FastAPI backend and a Next.js dashboard
with AI-assisted rental contract ingestion. It streamlines property onboarding, captures structured
contract data, and keeps owners, documents, and activity logs organized for ongoing operations.

---

## Table of Contents
1. Overview
2. Features
3. Tech Stack
4. Project Structure
5. Quick Start (Docker)
6. Environment Variables
7. Database Migrations
8. Seed Data
9. Key Workflows
10. Sample Contracts for Testing
11. Dashboard Docs and Swagger
12. Testing
13. Security Notes
14. Roadmap / Next Steps
15. Contributing
16. License

---

## 1. Overview
rentED focuses on clean contracts, strict ownership rules, and fast onboarding:
- Properties with photos (1 to 10)
- Owner-aware access control (admin sees all, owners see only theirs)
- Contract-driven prefill via LLM suggestions
- Documents linked to properties with download access
- Activity log per user (admin sees all)

---

## 2. Features
- Healthcheck: `GET /health`
- Session-based authentication (HTTP-only cookie)
- Admin-only user management
- Property CRUD with photo uploads
- Contract import suggestions (LLM) inside Create/Edit Property
- Documents linked to properties with downloads
- Activity log for core actions (login, create/update property)
- Alembic migrations and Docker-first setup

---

## 3. Tech Stack
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis + RQ
- LangChain (OpenAI)
- pypdf + optional OCR
- passlib (bcrypt)
- Docker Compose
- Next.js

---

## 4. Project Structure
```
backend/
  app/
    auth.py
    db.py
    deps.py
    main.py
    models.py
    schemas.py
    ai.py
    storage.py
    static/
      docs.html
      dashboard.css
  alembic/
  scripts/
    seed.py
  tests/
  Dockerfile
  requirements.txt

frontend/
  components/
  pages/
  styles/
  lib/
  next.config.js
  package.json

docker-compose.yml
.env.example
README.md
CHANGELOG.md
LICENSE
```

---

## 5. Quick Start (Docker)
### 5.1 Create env file
```
copy .env.example .env
```

### 5.2 Build and start services
```
docker compose up -d --build
```

### 5.3 Run migrations
```
docker compose run --rm api alembic upgrade head
```

### 5.4 Start worker
```
docker compose up -d worker
```

### 5.5 (Optional) Seed admin + sample data
```
docker compose run --rm api python scripts/seed.py
```

### 5.6 Open the dashboards
- API Docs: `http://localhost:8000/docs`
- Swagger: `http://localhost:8000/swagger`
- Frontend: `http://localhost:3000`

---

## 6. Environment Variables
Defined in `.env.example`:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URL`, `REDIS_URL`
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TEMPERATURE`, `OPENAI_MAX_TOKENS`
- `AI_MODE` (`live` or `mock`)
- `AI_CONFIDENCE_THRESHOLD`
- `AI_LLM_INPUT_MAX_CHARS`
- `OCR_MODE` (`none` or `tesseract`)
- `SESSION_TTL_MINUTES`, `SESSION_COOKIE_NAME`, `COOKIE_SECURE`
- `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_ADMIN_CELL`,
  `SEED_ADMIN_EMAIL`, `SEED_ADMIN_CPF`

Optional:
- `UPLOAD_DIR` (default: `/app/data/uploads`)
- `NEXT_PUBLIC_API_BASE` (frontend)

---

## 7. Database Migrations
```
docker compose run --rm api alembic upgrade head
```

Create a new migration after model changes:
```
docker compose run --rm api alembic revision --autogenerate -m "describe_change"
```

---

## 8. Seed Data
Seed script creates one admin and sample properties.
Defaults (override in `.env`):
- Username: `admin`
- Password: `Admin123!`

Run:
```
docker compose run --rm api python scripts/seed.py
```

---

## 9. Key Workflows
### 9.1 Authentication
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

### 9.2 Create Property (LLM suggestions)
1. Fill the base property fields.
2. Upload 1 to 10 photos.
3. If rented, upload a contract and click **Suggest fields**.
4. Select fields to apply and click **Apply fields**.
5. Save the property.

The contract document is stored and linked to the property automatically.

### 9.3 Documents
- Upload: `POST /documents/upload?property_id=...`
- List: `GET /documents?property_id=...`
- Download: `GET /documents/{id}/download`

### 9.4 Activity Log
- `GET /activity-log`
- Admin sees all entries, other users see only their own.

---

## 10. Sample Contracts for Testing
Sample contract PDF for local testing:
- `samples/contracts/ms_imoveis_avalyst_contract_sample.pdf`

Suggested flow:
1. Create Property -> enable **Rented**.
2. Upload the sample contract and review suggested fields.
3. Apply fields, add required photos, then save.

---

## 11. Dashboard Docs and Swagger
- `/docs` provides a custom interactive dashboard.
- `/swagger` provides full OpenAPI schemas.
- `/openapi.json` returns raw OpenAPI JSON.

---

## 12. Testing
Run tests inside the container:
```
docker compose run --rm api pytest
```

---

## 13. Security Notes
- All CRUD endpoints require a session cookie.
- Admin accounts cannot be deleted via the API.
- Uploads are stored locally in `./data/uploads` (bind-mounted).
- Do not commit `.env` or API keys.
- Exposed ports are for local dev only; lock them down in production.

---

## 14. Roadmap / Next Steps
- Work orders workflow (UI + API)
- More activity log coverage
- Contract templates and multi-model support
- Storage backend abstraction (S3/MinIO)

---

## 15. Contributing
See `CONTRIBUTING.md` for the workflow and standards.

---

## 16. License
MIT. See `LICENSE` for details.
