## Context

The current `GET /api/owners?lastName=` endpoint uses a Spring Data derived query (`findByLastNameStartingWith`) that only matches the start of the last name. The frontend sends requests on button click. This change replaces both with a live, full-text search.

## Goals / Non-Goals

**Goals:**
- Full-text contains search across all owner columns and pet names, server-side
- Live search with debounce (no button) in the frontend
- Rename API param `?lastName=` → `?search=`

**Non-Goals:**
- Pagination or sorting changes
- Backwards compatibility for `?lastName=` param
- Full-text search indexing / external search engine (Elasticsearch, etc.)

## Decisions

### 1. JPQL `LIKE '%...%'` with `LOWER()` instead of a full-text index

A custom `@Query` with `LOWER(field) LIKE LOWER(CONCAT('%', :search, '%'))` on all columns covers the requirement with zero new infrastructure. Postgres full-text indexing (`tsvector`) would be faster at scale but adds operational complexity not justified for a clinic app.

`LEFT JOIN o.pets p` + `SELECT DISTINCT o` handles the one-to-many join without duplicates.

### 2. Trim in the controller, not the repository

Trimming in `OwnerRestController` before passing to the repository keeps the query parameter clean and makes the behavior explicit at the HTTP boundary. The repository method receives an already-sanitised string.

### 3. Empty search → return all owners (no conditional branching)

`LIKE '%''%'` matches every row, so an empty `search` string naturally returns all owners without a special code path.

### 4. 300ms debounce in the frontend, no button

Angular `ReactiveFormsModule` `valueChanges` pipe with `debounceTime(300)` and `distinctUntilChanged()` sends requests only when the user pauses typing. The "Find Owner" button is removed; "Add Owner" stays.

## Risks / Trade-offs

- **Performance on large datasets** → `LIKE '%...%'` cannot use a B-tree index; full table scan on every keystroke. Acceptable for clinic scale; mitigated by 300ms debounce reducing request rate. [Mitigation: add a GIN/trigram index if needed later]
- **DISTINCT + JOIN overhead** → queries with many pets per owner do more work. At 1M owners × avg 2–10 pets, the join produces up to 10M rows before DISTINCT; combined with `LIKE '%...%'` full scans this is a real concern at scale. [Mitigation: add a PostgreSQL GIN/trigram index (`pg_trgm`) on the searched columns before reaching production load]
- **Debounce UX** → 300ms feels instant to users but prevents a request on every character; a known acceptable trade-off.

## Migration Plan

1. Deploy backend with renamed param (`?search=`). No other consumers exist.
2. Deploy frontend simultaneously (or immediately after) — both changes are in the same repo, so a single release is preferred.
3. No data migration required.
4. Rollback: revert both backend and frontend; no DB changes to undo.
