# rentED API

![CI](https://github.com/edubertin/project_rentED/actions/workflows/ci.yml/badge.svg)
![Release](https://img.shields.io/github/v/release/edubertin/project_rentED)
![License](https://img.shields.io/github/license/edubertin/project_rentED)

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
10. Dashboard Docs and Swagger
11. Testing
12. Troubleshooting
13. Roadmap / Next Steps
14. Contributing / Git Workflow
15. License

---

## 1. Overview
rentED API is a backend scaffold for property management operations. It includes:
- Core data model with migrations
- JWT login placeholder
- CRUD endpoints for properties
- Document upload and processing stub
- Work orders endpoint
- Custom documentation dashboard + Swagger

---

## 2. Features
- Healthcheck endpoint: `GET /health`
- JWT login (role-based placeholder)
- CRUD for properties
- Document upload (local storage) + list by status
- Mock document processing endpoint
- Work orders creation + listing
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

### 5.4 (Optional) Seed admin + 2 properties
```
docker compose run --rm api python scripts/seed.py
```

### 5.5 Open the dashboard docs
- `http://localhost:8000/docs`

### 5.6 Open Swagger UI
- `http://localhost:8000/swagger`

---

## 6. Environment Variables
Defined in `.env.example`:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`

Optional:
- `JWT_SECRET` (default: `dev-secret`)
- `JWT_TTL_MINUTES` (default: `60`)
- `UPLOAD_DIR` (default: `/app/data/uploads`)

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

### Login (role-based placeholder)
```
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

### Create Property
```
curl -X POST http://localhost:8000/properties \
  -H "Content-Type: application/json" \
  -d '{"owner_user_id":1,"extras":{"label":"Main"}}'
```

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

### Process Document (mock)
```
curl -X POST http://localhost:8000/documents/1/process
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

## 10. Dashboard Docs and Swagger
- `/docs` provides an interactive dashboard with inline test widgets.
- `/swagger` provides full OpenAPI request/response schemas.
- `/openapi.json` returns raw OpenAPI JSON.

---

## 11. Testing
Run tests inside the container:
```
docker compose run --rm api pytest
```

---

## 12. Troubleshooting
### Migration errors (missing revision)
If you see:
`Can't locate revision identified by '0001_create_items'`

Rebuild the API image to ensure latest migrations are inside:
```
docker compose build api
```

### Upload directory issues
If uploads fail, verify the container can write to `/app/data/uploads`.

### Redis warnings
If Redis logs warning about POST/Host commands, it is likely due to port exposure.
For local-only use, bind to 127.0.0.1 or remove the port mapping.

---

## 13. Roadmap / Next Steps
- Define real user fields (email, name, password hash)
- Replace role-based login with credential validation
- Add ownership rules and authorization
- Expand document metadata beyond `extras`
- Add activity log entries on write operations
- Add test coverage for error cases and auth

---

## 14. Contributing / Git Workflow
See `CONTRIBUTING.md` for the full workflow and expectations.

---

## 15. License
MIT. See `LICENSE` for details.
