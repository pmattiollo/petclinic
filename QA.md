# QA — Design decisions for Issue #25 (Owners grid: sort + pagination)

Captured from a design interview ("grilling") before implementation, so the
reasoning is reviewable and the tests have a contract to target.

## Context

- **Issue #25 — Add pagination to Owners grid**
  - The grid should be sortable by any column.
  - The grid should be paginated in pages of 5, 10, or 20 rows per page.
- **Current state (before this change):**
  - Backend: `GET /api/owners?lastName=<prefix>` returns an unbounded
    `List<OwnerDto>` (`OwnerRepository.findByLastNameStartingWith`), plus
    `GET /api/owners/count`. `OwnerRepository extends Repository<Owner, Integer>`.
  - Frontend: Angular 16, a Bootstrap 3 `<table>` in `owner-list`, a "Find
    Owner by last name" form, `getOwners()` loads the whole table at once.
  - Angular Material 16.2.1 is already a dependency (MatSnackBar, MatDatepicker
    used; MatTable/MatSort/MatPaginator available but not wired into owners).
- **Volumetry (business):** ~**10,000** owners expected in production (NOT the
  ~1M some old commit messages cite — that figure is wrong).
- **Guiding principle:** a few MB over the network is a lot — do not ship
  unbounded payloads; bound them (paginate) server-side. KISS: simplest option
  that does not bite later.

## Decision log

| # | Decision | Choice | Rationale | Rejected |
|---|----------|--------|-----------|----------|
| Q1 | Where does paging + sorting run? | **Server-side** | Fixes the real cause (unbounded list); scales past 10k; "sortable by any column" becomes "any column the DB can index". | Client-side (still ships every row). |
| Q2 | Existing `lastName` search | **Keep as-is**, applied server-side alongside paging | No regression; multi-field search stays out of #25 scope (belongs to #22). | Expand to multi-field `q` (scope creep); drop it (regression). |
| Q3 | Response envelope shape | **Custom `PageDto<T>`** `{content, totalElements, totalPages, number, size}` | Clean, stable, typed OpenAPI schema → frontend gets real types; frontend already has a matching `owner-page.ts`. Spring Boot 3.x discourages serializing `Page` directly. | Native `Page`/`PagedModel` (leaky `pageable`/`sort`, unstable contract). |
| Q4 | Which columns are sortable | **Name + City** (whitelist); everything else → 400 | Real data: City groups meaningfully (London×7, Hogsmeade×3); shared last names make Name a real directory. Telephone/Address sort is technically possible but humanly meaningless; Pets is a collection (no SQL order). | All scalar columns; literal "any column". |
| Q5 | Name column display | **"Last, First"** (e.g. "Baskerville, Henry") in the list | Visible order matches the sort key → no "invisible key" trap. Phonebook convention. Detail/edit screens still show "First Last". Recorded in AGENTS.md. | Keep "First Last" with a bold-lastname cue; keep "First Last" and ignore mismatch. |
| Q6 | Page-size set + default | **{5, 10, 20}, default 10**, strict whitelist → 400 | UI offers exactly these three; rejects `?size=100000` (the scale hole we are closing). | Silent clamp to `[1,20]` (hides bugs, accepts `size=7`). |
| Q7 | Default sort + clearability | **default `name,asc`; never-clears (asc↔desc only)** | Pagination needs a deterministic order always; there is no "unsorted" state. (`matSortDisableClear` on the frontend.) | 3-state cycle with an "unsorted" state (non-deterministic paging). |
| Q8 | Tiebreaker | **Append `id ASC` to every sort chain** | Total order → stable pages under LIMIT/OFFSET even when Name/City tie. `id ASC` fixed regardless of primary direction; one composite index serves it. | No tiebreaker (intermittent row-jumping between pages). |
| Q9 | Case / locale-aware ordering | **Recollate `last_name`, `first_name`, `city` to ICU `ro-x-icu`** (Romanian) | Linguistically correct ordering incl. diacritics (ă, â, î, ș, ț); plain `ORDER BY` then just works. | `lower()` + functional index (case-insensitive but not linguistic); do nothing (C/byte order looks wrong). |
| Q10 | Indexes | `owners_name_sort_idx(last_name, first_name, id)`, `owners_city_sort_idx(city, last_name, first_name, id)`, `owners_lastname_pattern_idx(last_name text_pattern_ops)` | Sort indexes inherit the `ro-x-icu` collation from the recollated columns; the `text_pattern_ops` index keeps `LIKE 'prefix%'` index-served after recollation (ICU otherwise disables prefix optimization). | Rely on default indexes; no pattern index (prefix search seq-scans). |
| Q11 | Frontend grid widget | **Keep the Bootstrap `<table>`**; add `matSort`/`mat-sort-header` on the two sortable headers + `<mat-paginator [pageSizeOptions]="[5,10,20]">`, all server-driven | Preserves the app's Bootstrap 3 look; reuses Material (already a dep) only for the sort arrows and pager. | Full `mat-table` migration (visual re-theme, more churn). |
| Q12 | Client state | **URL query params are the single source of truth** (`lastName/page/size/sort`); snap to page 0 on sort/size/search change; ~300ms search debounce | Deep-linkable, back-button works, one place owns the state. | Component-local state (no deep-link, back button breaks). |
| Q13 | Repository / query build | `Page<Owner> findByLastNameStartingWith(String, Pageable)`; **controller builds `Sort` from the {name,city} whitelist + `id` tiebreaker**, not from a raw client `Pageable` | Keeps the sort allowlist server-side; derived query stays minimal. | Pass client `Sort` straight through (arbitrary/unsafe sort columns). |
| Q14 | Pets loading (N+1) | **`@BatchSize(50)` on `Owner.pets`**; never `JOIN FETCH` + `Pageable` | Batch fetch turns N per-owner queries into ~ceil(N/50); JOIN FETCH + Pageable forces in-memory pagination (Hibernate HHH000104). | JOIN FETCH (breaks paging); default lazy (N+1 per page). |
| Q15 | Request validation | `page>=0`, `size∈{5,10,20}`, `sort∈{name,city}×{asc,desc}` → otherwise **400** | Explicit boundary validation; no silent fallback that masks client bugs. | Silent clamp / fallback to default sort. |
| Q16 | Frontend load/error UX | `switchMap` cancels stale reloads; load errors surface in an **error banner** (not an empty list); dim + spinner while fetching | A failed reload must not masquerade as "no owners"; stale responses must not overwrite fresh ones. | Plain subscribe (race conditions, error looks like empty result). |

## Resulting contract

`GET /api/owners`

| Param | Type | Rules | Default |
|-------|------|-------|---------|
| `lastName` | string | prefix filter (unchanged behavior) | `""` |
| `page` | int | `>= 0` else 400 | `0` |
| `size` | int | `∈ {5,10,20}` else 400 | `10` |
| `sort` | string | `"<col>,<dir>"`, `col ∈ {name,city}`, `dir ∈ {asc,desc}` else 400 | `name,asc` |

Response `200`: `PageDto<OwnerDto>`

```
record PageDto<T>(List<T> content, long totalElements, int totalPages, int number, int size)
```

Server-expanded sort chains (id always last):
- `name,asc`  → `last_name ASC, first_name ASC, id ASC`
- `name,desc` → `last_name DESC, first_name DESC, id ASC`
- `city,asc`  → `city ASC, last_name ASC, first_name ASC, id ASC`
- `city,desc` → `city DESC, last_name DESC, first_name DESC, id ASC`

BREAKING: array → envelope. Update the Angular `OwnerService`, all in-repo
consumers, `openapi.yaml`, and `api-types.ts` (regenerated, never hand-edited).

## DB migration plan (new Flyway version)

1. Recollate columns to `ro-x-icu`:
   `ALTER TABLE owners ALTER COLUMN last_name TYPE varchar(...) COLLATE "ro-x-icu";`
   (same for `first_name`, `city`).
2. Create the three indexes from Q10.

## Implementation plan (TDD-ordered)

1. **Backend contract test (red):** `GET /api/owners?page=0&size=10&sort=name,asc`
   returns a `PageDto` envelope; assert `content`, `totalElements`, page/size.
2. `PageDto<T>` record; map `Page<Owner>` → `PageDto<OwnerDto>`.
3. Controller: parse/validate `page/size/sort` (Q15), build `Sort` from the
   whitelist + `id` tiebreaker (Q8/Q13), call
   `findByLastNameStartingWith(lastName, PageRequest.of(...))`.
4. 400 tests: `size=7`, `size=100000`, `page=-1`, `sort=pets,asc`,
   `sort=name,sideways`.
5. `@BatchSize(50)` on `Owner.pets` (Q14); assert a page issues ~3 queries, not ~N.
6. Flyway migration: recollation + indexes; `EXPLAIN` at ~10k rows confirms
   index-served, no seq scan on any path (sort + prefix search).
7. Frontend `OwnerService.getOwnersPage(...)` → `PageDto`; regenerate `api-types.ts`.
8. `owner-list`: Bootstrap table + `matSort` + `mat-paginator([5,10,20], 10)`;
   Name rendered "Last, First"; URL params as source of truth; page-0 snap;
   300ms debounce; `switchMap`; error banner; dim/spinner (Q11/Q12/Q16).
9. Update UI/e2e tests to the paginated model.

## Risks / open items

- **ICU availability + exact collation name unverified.** The DB was **down**
  during this interview (localhost:5432 closed), so `datcollate` and ICU support
  could not be read. Before implementing, with the DB up, verify:
  `SELECT collname FROM pg_collation WHERE collname LIKE 'ro%';`
  If `ro-x-icu` is absent, fall back to Q9 option (A) `lower()` + functional
  indexes (case-insensitive, portable) — the rest of the plan is unaffected.
- Recollation rewrites the columns; trivial at 10k rows, but it is a schema
  migration — run it in its own Flyway version.
- `text_pattern_ops` index is mandatory once columns are ICU-collated, or the
  `lastName` prefix search silently degrades to a seq scan.
