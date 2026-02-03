# rentED API

<p align="center">
  <img src="frontend/public/brand/logo.png" alt="rentED logo" width="560">
</p>

![CI](https://github.com/edubertin/project_rentED/actions/workflows/ci.yml/badge.svg)
![Secret Scan](https://github.com/edubertin/project_rentED/actions/workflows/secret-scan.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB)
![License](https://img.shields.io/github/license/edubertin/project_rentED)
![Release](https://img.shields.io/github/v/release/edubertin/project_rentED)

A minimal FastAPI + Postgres + Redis backend for property management workflows.
This repository is intentionally lean but structured to grow with clear contracts and migrations.

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
9. API Usage (curl examples)
10. Frontend Dashboard (Next.js)
11. Document Extraction Pipeline (AI)
12. Dashboard Docs and Swagger
13. Testing
14. Security Notes
15. Troubleshooting
16. Roadmap / Next Steps
17. Contributing / Git Workflow
18. License

---

## 1. Overview
rentED API is a backend scaffold for property management operations. It includes:
- Core data model with migrations
- Session-based authentication (HTTP-only cookie)
- CRUD endpoints for properties
- Document upload and AI-backed extraction pipeline
- Work orders endpoint
- Custom documentation dashboard + Swagger

---

## 2. Features
- Healthcheck endpoint: `GET /health`
- Session login (username/password)
- CRUD for properties
- Document upload (local storage) + list by status
- AI extraction pipeline (worker + Redis queue) with confidence scoring
- Review screen to confirm extracted JSON
- Work orders creation + listing
- Activity log entries for document processing/review
- Admin-only user management endpoints (`/users`)
- Alembic migrations
- Dashboard docs at `/docs`
- Swagger UI at `/swagger`

---

## 3. Tech Stack
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis
- RQ
- LangChain (OpenAI)
- pypdf + optional OCR
- passlib (bcrypt)
- Docker Compose

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
    TopNav.js
  pages/
  styles/
  lib/
  next.config.js
  package.json

docker-compose.yml
.env.example
README.md
CONTRIBUTING.md
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

### 5.5 (Optional) Seed admin + 2 properties
```
docker compose run --rm api python scripts/seed.py
```

### 5.6 Open the dashboard docs
- `http://localhost:8000/docs`

### 5.7 Open Swagger UI
- `http://localhost:8000/swagger`

---

## 6. Environment Variables
Defined in `.env.example`:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_TEMPERATURE`
- `OPENAI_MAX_TOKENS` (default 1024)
- `AI_MODE` (`live` or `mock`)
- `AI_CONFIDENCE_THRESHOLD`
- `OCR_MODE` (`none` or `tesseract`)
- `AI_LLM_INPUT_MAX_CHARS` (max characters sent to the LLM)
- `SESSION_TTL_MINUTES`
- `SESSION_COOKIE_NAME`
- `COOKIE_SECURE`
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_NAME`
- `SEED_ADMIN_CELL`

Optional:
- `UPLOAD_DIR` (default: `/app/data/uploads`)
- `NEXT_PUBLIC_API_BASE` (frontend, default: `http://localhost:8000`)

---

## 7. Database Migrations
Migrations are managed by Alembic and should be the source of truth for schema.

Run migrations:
```
docker compose run --rm api alembic upgrade head
```

If you need a new migration after editing models:
```
docker compose run --rm api alembic revision --autogenerate -m "describe_change"
```

---

## 8. Seed Data
Seed script creates:
- 1 admin user
- 2 properties owned by admin

Defaults (override in `.env`):
- Username: `SEED_ADMIN_USERNAME` (default `admin`)
- Password: `SEED_ADMIN_PASSWORD` (default `Admin123!`)

Run:
```
docker compose run --rm api python scripts/seed.py
```

---

## 9. API Usage (curl examples)
### Health
```
curl http://localhost:8000/health
```

### Login
```
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'
```
Use cookies for authenticated calls:
```
curl -c cookies.txt -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'
curl -b cookies.txt http://localhost:8000/properties
```

### Current User
```
curl http://localhost:8000/auth/me
```

### Logout
```
curl -X POST http://localhost:8000/auth/logout
```

### Create Property
```
curl -X POST http://localhost:8000/properties \
  -H "Content-Type: application/json" \
  -d '{"owner_user_id":1,"extras":{"label":"Main"}}'
```

### Create User (admin-only)
This endpoint is admin-only. Do not expose it in production without proper auth controls.
```
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"username":"owner1","password":"Owner123!","role":"property_owner","name":"Owner","cell_number":"(111) 11111 1111","extras":{}}'
```

Roles:
- `admin`
- `real_estate`
- `finance`
- `service_provider`
- `property_owner`

Cell number format:
- `(xxx) xxxxx xxxx`

### List Properties
```
curl http://localhost:8000/properties
```

### Update Property
```
curl -X PUT http://localhost:8000/properties/1 \
  -H "Content-Type: application/json" \
  -d '{"extras":{"label":"Updated"}}'
```

### Delete Property
```
curl -X DELETE http://localhost:8000/properties/1
```

### Upload Document
```
curl -X POST "http://localhost:8000/documents/upload?property_id=1" \
  -F "file=@./path/to/file.pdf"
```

### List Documents by Status
```
curl "http://localhost:8000/documents?status=uploaded"
```

### Process Document (enqueue)
```
curl -X POST http://localhost:8000/documents/1/process
```

### Get Document Extraction
```
curl http://localhost:8000/documents/1/extraction
```

### Confirm Document Review
```
curl -X PUT http://localhost:8000/documents/1/review \
  -H "Content-Type: application/json" \
  -d '{"extraction":{"doc_type":"contract","fields":{},"summary":"ok","alerts":[],"confidence":0.9}}'
```

### Create Work Order
```
curl -X POST http://localhost:8000/work-orders \
  -H "Content-Type: application/json" \
  -d '{"property_id":1,"extras":{"title":"Fix leak"}}'
```

### List Work Orders
```
curl http://localhost:8000/work-orders
```

---

## 10. Frontend Dashboard (Next.js)
The frontend is a minimal Next.js dashboard (no fancy styling) with login + 4 screens:
- Login (index)
- Properties list + create
- Property detail (documents + work orders)
- Work orders list + create
- Document upload

Run it:
```
cd frontend
npm install
npm run dev
```

Then open:
- `http://localhost:3000` (login)

If the API is on a different host/port:
```
set NEXT_PUBLIC_API_BASE=http://localhost:8000
```

---

## 11. Document Extraction Pipeline (AI)
### Flow
1. Upload document -> stored locally.
2. Worker extracts text (PDF/text files; OCR optional for images).
3. AI extracts `doc_type`, fields, summary, alerts, and confidence.
4. Document status moves to `needs_review`.
5. Review endpoint confirms and sets status to `confirmed`.

### Notes
- AI results are stored in `document_extractions.extras`.
- Extracted text is always preserved in the extraction payload.
- Low-confidence results add an alert and still require review.
- Set `AI_MODE=mock` in dev/tests to disable API calls.
- OCR for images uses Tesseract. In Docker it is installed via the API image. Set `OCR_MODE=tesseract` to enable it.
- LLM input is capped by `AI_LLM_INPUT_MAX_CHARS` to avoid oversized responses.

---

## 12. Dashboard Docs and Swagger
- `/docs` provides an interactive dashboard with inline test widgets.
- `/swagger` provides full OpenAPI request/response schemas.
- `/openapi.json` returns raw OpenAPI JSON.

---

## 13. Testing
Run tests inside the container:
```
docker compose run --rm api pytest
```

---

## 14. Security Notes
- All CRUD endpoints require an authenticated session cookie.
- Default Postgres credentials are for local use only.
- Uploads are stored locally in `./data/uploads` (bind-mounted into the container).
- Exposed ports (Postgres/Redis) are open to the host. Restrict or remove in production.
- Store `OPENAI_API_KEY` securely and never commit it.
- Known advisory: Next.js has a high-severity advisory affecting Image Optimizer and Server Components. We keep Next 14.2.35 during development to avoid breaking changes and plan to upgrade to Next 16 before production.
- Session cookies are httpOnly; set `COOKIE_SECURE=true` when using HTTPS.

---

## 15. Troubleshooting
### Migration errors (missing revision)
If you see:
`Can't locate revision identified by '0001_create_items'`

Rebuild the API image to ensure latest migrations are inside:
```
docker compose build api
```

### Upload directory issues
If uploads fail, verify the container can write to `/app/data/uploads`.
Ensure `./data/uploads` exists on the host when using the bind mount.

### Redis warnings
If Redis logs warning about POST/Host commands, it is likely due to port exposure.
For local-only use, bind to 127.0.0.1 or remove the port mapping.

---

## 16. Roadmap / Next Steps
- Define real user fields (email, name, password hash)
- Add email and password reset flows
- Add ownership rules and authorization
- Expand document metadata beyond `extras`
- Extend activity log coverage to more write operations
- Add test coverage for error cases and auth

---

## 17. Contributing / Git Workflow
See `CONTRIBUTING.md` for the full workflow and expectations.

---

## 18. License
MIT. See `LICENSE` for details.
