# Project Memory - AGENTS.md ~ CLAUDE.md

This file is automatically loaded in any conversation you have with an agent in this folder. It's the most important file in any repo, pushed on git, improved on any AI fail, reviewed every sprint, symlinked to AGENTS.md for inclusiveness.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21); also hosts the Spring AI MCP server at `/mcp`
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)
- `petclinic-database/` - embedded Postgres launcher used by `./start-database.sh` and by tests
- `petclinic-chatbot/` - Spring AI triage assistant (RAG over specialties + books visits via the backend's MCP); needs pgvector from its own `docker-compose.yml`
- `petclinic-ui-test/` - Playwright/TypeScript e2e tests (Cucumber features), run by `./start-ui-tests.sh`
- `petclinic-observability/` - OpenTelemetry collector + Grafana stack (`./start-grafana.sh`)
- `refactoring-legacy/` - self-contained OpenRewrite recipe module, run manually against the backend
- `user-manual/` - end-user manual (`manual.md`) with generated screenshots
- `openspec/` - spec-driven change proposals (`changes/`, `specs/`)

## Common Commands

### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-chatbot.sh         # Spring AI chatbot on localhost:8082 (needs OPENAI_API_KEY + pgvector)
./start-grafana.sh
./start-ui-tests.sh        # Playwright e2e suite
```

The C4 model viewer now lives with the backend docs it serves:
```sh
petclinic-backend/docs/scripts/start-structurizr.sh   # optional: Structurizr view of the C4 model (localhost:8081)
```

## Architecture


### Living Architecture & Guardrails

See [GUARDRAILS.md](GUARDRAILS.md) for the full list of guardrail tests, living architecture diagrams, and CI drift checks.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)
- **The backend seeds the DB via Flyway on startup** (`ddl-auto=none`; schema in `V1`,
  sample data in `V3__sample_data.sql`, under `db/migration/`). A freshly (re)started
  Postgres therefore looks **empty until the backend boots** — that is normal, *not* a broken
  DB. Do not be surprised by an empty DB after a restart; start the backend and it re-seeds
  itself.
- ⚠️ `./start-database.sh` runs `rm -rf data` first — it **wipes the on-disk data dir** (and any
  rows added at runtime). Flyway recreates the seed on the next backend boot regardless, but to
  preserve runtime data start Postgres from the jar directly; use the script only for a
  deliberate reset.
- ⚠️ **Production scale: `owners` will quickly reach ~10.000 rows.** The dev seed has 28, which
  is misleading — size owner queries, grids, indexes and fetch plans for 10k, not for the seed.

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default user: `admin`/`admin`

## Domain Model (ER Model)

Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## API Endpoints
Backend exposes REST API at http://localhost:8080/api/
- Owners: `/api/owners`, `/api/owners/{id}`
- Pets: `/api/pets`, `/api/pets/{id}`
- Vets: `/api/vets`, `/api/vets/{id}`
- Visits: `/api/visits`
- PetTypes: `/api/pettypes`
- Specialties: `/api/specialties`
- Users: `/api/users`

OpenAPI docs: http://localhost:8080/swagger-ui.html

## Development Notes

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names.
- Always run tests after any refactoring
- Keep explanations concise
- Challenge ambiguous prompts. Tell me when I'm wrong!  
