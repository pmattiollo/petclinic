## Context

See [proposal.md](proposal.md) for motivation. Current state:

- **Backend**: `GET /api/owners?lastName=<prefix>` returns an unbounded `List<OwnerDto>` via `OwnerRepository.findByLastNameStartingWith`; a separate `GET /api/owners/count` exists. `OwnerRepository extends Repository<Owner, Integer>`. Spring Boot 3.5 / Java 21.
- **Frontend**: Angular 16, a Bootstrap 3 `<table>` in `owner-list` with a "Find Owner by last name" form; `getOwners()` loads the whole table at once. Angular Material 16.2.1 is already a dependency (MatSnackBar, MatDatepicker in use; MatTable/MatSort/MatPaginator available but not wired into owners).
- **Volumetry**: ~10,000 owners expected in production. Guiding principle: a few MB over the wire is a lot — bound payloads server-side; KISS.
- **Constraint**: DB was unavailable during the design interview, so ICU collation support is unverified (see Risks).

This design is the reviewable output of a pre-implementation design interview; the tests target the contract it fixes.

## Goals / Non-Goals

**Goals:**
- Bound the owners payload server-side with real pagination.
- Server-side sorting over a safe column whitelist, with deterministic paging.
- Preserve the existing look (Bootstrap table) and the `lastName` prefix search.
- Keep the sort/search paths index-served at 10k rows.

**Non-Goals:**
- Multi-field / free-text `q` search (belongs to Issue #22).
- Full `mat-table` migration or visual re-theme.
- Sorting by non-scalar or humanly-meaningless columns (Pets, Telephone, Address).
- Changing detail/edit screens' "First Last" name display.

## Decisions

- **D1 — Paging + sorting run server-side.** Fixes the real cause (unbounded list) and scales past 10k. Alternative (client-side) still ships every row — rejected.
- **D2 — Keep the `lastName` prefix filter as-is**, applied server-side alongside paging. Avoids regression and scope creep into multi-field search.
- **D3 — Response envelope is a custom `PageDto<T>(List<T> content, long totalElements, int totalPages, int number, int size)`.** Clean, stable, typed OpenAPI schema; frontend already has a matching `owner-page.ts`. Spring Boot 3.x discourages serializing `Page` directly (leaky/unstable `pageable`/`sort`). This is **BREAKING** (array → envelope): update `OwnerService`, all in-repo consumers, `openapi.yaml`, and `api-types.ts` (regenerated, never hand-edited).
- **D4 — Sortable columns are whitelisted to {`name`, `city`}**; everything else → 400. City groups meaningfully and shared last names make Name a real directory; Telephone/Address sort is meaningless and Pets is a collection with no SQL order. Alternative (all scalar columns / literal "any column") rejected.
- **D5 — Name column renders "Last, First"** in the list so the visible order matches the sort key (no "invisible key" trap; phonebook convention). Detail/edit keep "First Last". Recorded in AGENTS.md.
- **D6 — Page-size set {5, 10, 20}, default 10, strict whitelist → 400.** UI offers exactly these three and rejects `?size=100000` — the scale hole being closed. Silent clamp rejected (hides bugs).
- **D7 — Default sort `name,asc`, never-clears (asc↔desc only).** Pagination needs a deterministic order always; there is no "unsorted" state. Frontend uses `matSortDisableClear`.
- **D8 — Only the chosen column carries the requested direction; every trailing column (secondary sort + the `id` tiebreaker) stays ASC.** So `name,desc` → `last_name DESC, first_name ASC, id ASC` and `city,desc` → `city DESC, last_name ASC, first_name ASC, id ASC`. Rationale: (a) within an equal primary value, records stay in a stable, readable A→Z order regardless of the primary direction (people in the same city listed by name A→Z); (b) the always-ASC `id` gives a total order → stable pages under LIMIT/OFFSET even when Name/City tie. Alternative (mirror every column to DESC) rejected: it flips the within-group order for no user benefit and still needs the ASC `id` for stability, so it is already mixed-direction anyway.
- **D9 — Case/locale-aware ordering via ICU `ro-x-icu` collation** on `last_name`, `first_name`, `city`. Linguistically correct including diacritics (ă, â, î, ș, ț); plain `ORDER BY` then just works. Fallback if ICU absent: `lower()` + functional indexes (case-insensitive, portable) — rest of the plan unaffected.
- **D10 — Indexes:** `owners_name_sort_idx(last_name, first_name, id)`, `owners_city_sort_idx(city, last_name, first_name, id)`, `owners_lastname_pattern_idx(last_name text_pattern_ops)`. Sort indexes inherit the ro-x-icu collation from the recollated columns; the `text_pattern_ops` index keeps `LIKE 'prefix%'` index-served after recollation (ICU otherwise disables the prefix optimization).
- **D11 — Frontend grid widget: keep the Bootstrap `<table>`**; add `matSort`/`mat-sort-header` on the two sortable headers + `<mat-paginator [pageSizeOptions]="[5,10,20]">`, all server-driven. Preserves the Bootstrap 3 look; reuses Material (already a dep) only for sort arrows and the pager.
- **D12 — Client state: URL query params are the single source of truth** (`lastName`/`page`/`size`/`sort`); snap to page 0 on sort/size/search change; ~300ms search debounce. Deep-linkable; back button works; one owner of state.
- **D13 — Repository/query build:** `Page<Owner> findByLastNameStartingWith(String, Pageable)`; the controller builds `Sort` from the {name, city} whitelist, appends the ASC secondary column(s) and the `id ASC` tiebreaker (D8), and does **not** accept a raw client `Pageable`. Keeps the sort allowlist server-side; derived query stays minimal.
- **D14 — Pets loading:** `@BatchSize(50)` on `Owner.pets`; never `JOIN FETCH` + `Pageable`. Batch fetch turns N per-owner queries into ~ceil(N/50); `JOIN FETCH` + `Pageable` forces in-memory pagination (Hibernate HHH000104).
- **D15 — Request validation:** `page>=0`, `size ∈ {5,10,20}`, `sort ∈ {name,city}×{asc,desc}` → otherwise 400. Explicit boundary validation; no silent fallback that masks client bugs.
- **D16 — Frontend load/error UX:** `switchMap` cancels stale reloads; load errors surface in an error banner (not an empty list); dim + spinner while fetching. A failed reload must not masquerade as "no owners"; stale responses must not overwrite fresh ones.

### Resulting contract

`GET /api/owners`

| param | type | validation                                               | default |
| --- | --- |----------------------------------------------------------| --- |
| `lastName` | string | prefix filter (unchanged)                                | `""` |
| `page` | int | `>= 0` else 400                                          | `0` |
| `size` | int | `∈ {5,10,20}` else 400                                   | `10` |
| `sort` | string | `"<col>,<dir>"`, col ∈ {name,city}, dir ∈ {asc,desc} else 400 | `name,asc` |

Response `200`: `PageDto<OwnerDto>` where `record PageDto<T>(List<T> content, long totalElements, int totalPages, int number, int size)`.

Server-expanded sort chains (only the chosen column carries the direction; every column after it stays ASC):
- `name,asc` → `last_name ASC, first_name ASC, id ASC`
- `name,desc` → `last_name DESC, first_name ASC, id ASC`
- `city,asc` → `city ASC, last_name ASC, first_name ASC, id ASC`
- `city,desc` → `city DESC, last_name ASC, first_name ASC, id ASC`

## Risks / Trade-offs

- **ICU availability + exact collation name unverified** (DB was down during the interview) → Before implementing, with the DB up, verify `SELECT collname FROM pg_collation WHERE collname LIKE 'ro%';`. If `ro-x-icu` is absent, fall back to D9 option (A) `lower()` + functional indexes; the rest of the plan is unaffected.
- **Recollation rewrites the columns** → trivial at 10k rows, but it is a schema migration; run it in its own Flyway version.
- **`text_pattern_ops` index is mandatory once columns are ICU-collated** → otherwise the `lastName` prefix search silently degrades to a seq scan. Confirm with `EXPLAIN` at ~10k rows.
- **Descending sort mixes directions (`<col> DESC, … ASC`), which the all-ASC composite indexes (D10) do not serve as a pure scan** → the ascending paths are fully index-served; for the descending paths Postgres may add a cheap sort on top of the index. At ~10k rows this is negligible, so we keep the two all-ASC indexes for now. Confirm with `EXPLAIN` at ~10k rows on every path; only if the descending sort is actually costly, add a matching mixed-direction index (e.g. `(city DESC, last_name ASC, first_name ASC, id ASC)`) — do not pre-add per-direction indexes speculatively.
- **Breaking response shape** → all in-repo consumers, `openapi.yaml`, and `api-types.ts` must be updated together to avoid a compile/runtime mismatch.

## Migration Plan

New Flyway version:
1. Recollate columns to `ro-x-icu`: `ALTER TABLE owners ALTER COLUMN last_name TYPE varchar(...) COLLATE "ro-x-icu";` (same for `first_name`, `city`).
2. Create the three indexes from D10.

Rollback: drop the three indexes and recollate the columns back to the database default; no data loss (column rewrite only). Deploy backend + frontend together because of the breaking response shape.

## Open Questions

- ~~Whether the descending sort paths need their own mixed-direction indexes~~ **Resolved**: verified with `EXPLAIN` at ~10k rows. Ascending paths (`name,asc` / `city,asc`) and the `lastName` prefix count both use a pure `Index Only Scan` (no seq scan, no sort node). Descending paths (`name,desc` / `city,desc`) use an `Index Only Scan Backward` plus a cheap `Incremental Sort` (only the ASC tiebreaker columns are sorted per equal-primary-key group) — not a full sort. No mixed-direction index was added.

The other unknown (ICU collation availability) is resolved by verification at implementation start with a defined fallback (D9), so it does not block planning.
