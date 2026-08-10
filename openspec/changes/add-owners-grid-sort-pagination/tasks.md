# Tasks

TDD-ordered. Reference [design.md](design.md) for the "how" (decisions D1–D16) and [specs/owners-listing/spec.md](specs/owners-listing/spec.md) for the contract.

## 1. Verify DB prerequisites

- [x] 1.1 With the DB up, run `SELECT collname FROM pg_collation WHERE collname LIKE 'ro%';` and confirm `ro-x-icu` exists. If absent, switch D9/D10 to the `lower()` + functional-index fallback before proceeding.

## 2. Backend contract (red → green)

- [x] 2.1 Write a failing contract test: `GET /api/owners?page=0&size=10&sort=name,asc` returns a `PageDto` envelope; assert `content`, `totalElements`, `number`, `size`.
- [x] 2.2 Add the `PageDto<T>(List<T> content, long totalElements, int totalPages, int number, int size)` record; map `Page<Owner>` → `PageDto<OwnerDto>`.
- [x] 2.3 Change `OwnerRepository` to `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` (keep prefix filter, D2/D13).
- [x] 2.4 In `OwnerController`: parse/validate `page`/`size`/`sort` (D15), build `Sort` from the {name, city} whitelist with the requested direction on the chosen column and ascending secondary column(s) + `id ASC` tiebreaker (D8/D13), and call the paged repository method. Make 2.1 pass.

## 3. Backend validation (400 paths)

- [x] 3.1 Add failing tests then make them pass for: `size=7`, `size=100000`, `page=-1`, `sort=pets,asc`, `sort=name,sideways` — each returns HTTP `400` with no owner data.
- [x] 3.2 Confirm defaults: no params → `page=0`, `size=10`, `sort=name,asc`.

## 4. N+1 / Pets loading

- [x] 4.1 Add `@BatchSize(50)` on `Owner.pets` (D14).
- [x] 4.2 Add a test asserting one page issues ~ceil(N/50) queries (~3), not ~N.

## 5. Database migration

- [x] 5.1 New Flyway version: recollate `owners.last_name`, `first_name`, `city` to `ro-x-icu` (or the fallback from 1.1).
- [x] 5.2 Same migration: create `owners_name_sort_idx(last_name, first_name, id)`, `owners_city_sort_idx(city, last_name, first_name, id)`, `owners_lastname_pattern_idx(last_name text_pattern_ops)` (D10).
- [x] 5.3 `EXPLAIN` at ~10k rows confirms index-served (no seq scan) on the prefix search and the ascending sort paths. For the descending paths (mixed `<col> DESC, … ASC`), confirm the plan is acceptable; only add a matching mixed-direction index if `EXPLAIN` shows a costly sort (see design Risks).

## 6. API contract propagation

- [x] 6.1 Update `openapi.yaml`: `GET /api/owners` response = `PageDto<OwnerDto>`; document `page`/`size`/`sort` params and their validation.
- [x] 6.2 Regenerate `api-types.ts` (never hand-edit); update all in-repo consumers of the old array shape.

## 7. Frontend service

- [x] 7.1 Add `OwnerService.getOwnersPage(lastName, page, size, sort)` returning `PageDto<OwnerDto>`; remove reliance on the unbounded `getOwners()` for the grid.

## 8. Frontend grid

- [x] 8.1 Wire the existing Bootstrap `<table>` with `matSort`/`mat-sort-header` on Name and City, `matSortDisableClear`, default `name,asc` (D7/D11).
- [x] 8.2 Add `<mat-paginator [pageSizeOptions]="[5,10,20]">` defaulting to 10, server-driven (D11).
- [x] 8.3 Render the Name column as "Last, First" (D5).
- [x] 8.4 Make URL query params (`lastName`/`page`/`size`/`sort`) the single source of truth; snap to page 0 on sort/size/search change; ~300ms search debounce (D12).
- [x] 8.5 Use `switchMap` to cancel stale reloads; show an error banner on load failure (not an empty list); dim + spinner while fetching (D16).

## 9. Tests & docs

- [x] 9.1 Update UI/e2e tests to the paginated model (page controls, sort headers, "Last, First" display, error banner).
- [x] 9.2 Confirm AGENTS.md already records the "Last, First" grid convention; update if needed.
- [x] 9.3 Run the full backend + frontend test suites; all green.
