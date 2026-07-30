## Context

`GET /api/owners` today does `ownerRepository.findByLastNameStartingWith(lastName)` and maps the
whole result to `List<OwnerDto>`, unpaged and unsorted. `OwnerDto` carries the full
`pets → visits` graph; both associations are `LAZY` with no batching, so rendering the list costs
~45 queries. The `owners` table has a single index (`owners_pkey`) and the cluster collation is
`C`, with no per-column collation.

Motivation and the functional decisions: see `proposal.md` (written for a non-technical
audience). The original decision log is `sumar.md` (D1–D9). Requirements:
`specs/owner-listing/spec.md`.

One constraint shapes everything: production reaches ~10.000 owners, while the dev seed has 28.
Decisions are sized for 10k.

## Goals / Non-Goals

**Goals:**
- One page of owners = one bounded, index-backed query plus a bounded number of batch fetches.
- An API shape we own, decoupled from Spring's `Page` serialization.
- Sort parameters that cannot be used to steer the persistence layer.
- Deterministic page boundaries.

**Non-Goals:**
- Keyset ("seek") pagination. Offset pagination is adequate at 10k rows with a covering index,
  and the UI needs `totalPages` for a classic paginator.
- A separate lightweight list DTO. See the trade-off below.
- Reusing the abandoned implementation on `feat/25-owners-grid-pagination` (commit `a942ac1`),
  not even as reference (D1). The orphan `petclinic-frontend/src/app/owners/owner-page.ts` left
  on the current branch is rewritten as part of this change.

## API contract

**BREAKING.** `GET /api/owners` returns `OwnerPageDto { content, totalElements, totalPages,
number, size }` instead of `OwnerDto[]`.

| Param | Values | Default |
|---|---|---|
| `lastName` | prefix string (unchanged) | `""` |
| `page` | 0-based index | `0` |
| `size` | `5` \| `10` \| `20`, anything else clamped to the default | `10` |
| `sort` | `name,asc` \| `name,desc` \| `city,asc` \| `city,desc`; unknown keys fall back silently | `name,asc` |

## Decisions

### Server-side pagination and sorting

The alternative — `MatTableDataSource` sorting and paging in the browser — needs zero API change,
but sends all 10.000 owners (with their pets and visits) over the wire on every list load. That
is precisely the cost being removed. Paging and sorting therefore happen in SQL.

### Hand-written page envelope, not `Page<OwnerDto>`

`GET /api/owners` returns `OwnerPageDto { content, totalElements, totalPages, number, size }`.

Serializing Spring Data's `Page` directly would be less code but leaks internals
(`pageable.sort.unsorted`, `pageable.offset`, …) into the public contract and has changed shape
between Spring versions. A hand-written record keeps the OpenAPI document honest and stable.

### Break the endpoint instead of adding a paged sibling

Adding `GET /api/owners/paged` and leaving the old endpoint alive would keep the unbounded query
in production forever — the very query this change exists to remove. The endpoint changes shape
in place; all callers are in this repository.

Blast radius (verified): MCP server and chatbot use repositories directly and are unaffected.
Breaking consumers to update: `owners.feature`, `OwnerTest`, `BasicAuthenticationConfigTest`,
`OwnerSearchThroughLatencyProxyTest`, `openapi.yaml` → `npm run generate:api` → `api-types.ts`,
plus the Angular list component and service specs.

### UI sort keys mapped server-side; `Pageable` is never bound from the request

The client sends `?sort=name,asc` or `?sort=city,desc`. The server maps:

| UI key | direction | ORDER BY |
|---|---|---|
| `name` | asc  | `last_name ASC, first_name ASC, id ASC` |
| `name` | desc | `last_name DESC, first_name DESC, id DESC` |
| `city` | asc  | `city ASC, last_name ASC, first_name ASC, id ASC` |
| `city` | desc | `city DESC, last_name ASC, first_name ASC, id ASC` |

Binding `Pageable` directly (Spring's `PageableHandlerMethodArgumentResolver`) would resolve any
property path in the entity graph: `?sort=pets.visits.description` becomes unapproved joins — a
pathological query triggered from a query parameter. It would also leak entity field names into
the API. An explicit whitelist avoids both.

`id` is appended to every ordering as the tiebreaker (spec: *Pagination is stable across pages*)
and is included in the indexes so the ordering is served straight from the index.

**Unknown sort key → silent fallback to the default sort, not `400`.** `400` was the
recommendation; tolerance was chosen instead. Accepted risk: a client asking for an unsupported
sort gets data in a different order than requested, with no signal that it happened.

### Sorting by City keeps the name ascending

The requested direction applies to the **city only**. Under `city,desc`, owners sharing a city
are still listed by last name ascending, then first name ascending.

Rationale: the direction toggle in the header is a statement about the column the user clicked,
not about the whole ordering. "Cities from Z to A" does not imply "and, within a city, people
from Z to A" — the secondary criterion exists to make the grid readable, and a name list is
readable ascending. The same reasoning keeps the two name columns coupled under `name,desc`,
where the direction genuinely does belong to the name.

Consequence in SQL: `city,desc` is a **mixed-direction** ordering
(`city DESC, last_name ASC, …`). This is not a detail — see the index decision below.

### Only Name and City are sortable

The real data decided this, not taste:
- addresses start with the house number (`14 Kensington…`, `221B Baker…`, `4 Privet…`) — sorting
  by `address` sorts by house number;
- telephones are text with an international prefix (`0032…`, `0034…`, `0441…`) and one row is
  `NULL` (`V5__clear_demo_owner_phone.sql`) — sorting by `telephone` sorts by country;
- `pets` has no defined sort semantics (count? first pet's name?) and would need an expensive
  join at 10k.

This is a conscious deviation from #25's "sortable by any column": 2 of 5 columns, chosen so that
no offered sort lies. Non-sortable columns get no sort arrows and no explanatory tooltip.

### Migration `V9`: collation before indexes, and one index per city direction

```sql
ALTER TABLE owners ALTER COLUMN last_name  TYPE varchar(30) COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE varchar(30) COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE varchar(80) COLLATE "en-US-x-icu";
CREATE INDEX owners_last_first_idx   ON owners (last_name, first_name, id);
CREATE INDEX owners_city_name_idx    ON owners (city, last_name, first_name, id);
CREATE INDEX owners_city_desc_name_idx ON owners (city DESC, last_name, first_name, id);
```

Order is not cosmetic: an index built under the old collation cannot serve an `ORDER BY` under
the new one, so it would have to be rebuilt anyway.

**Why two city indexes.** `name,desc` reverses every column, so PostgreSQL serves it with a
backward scan of `owners_last_first_idx` — one index covers both directions. `city,desc` does
**not** reverse every column: a backward scan of `(city, last_name, …)` yields
`city DESC, last_name DESC`, which is the wrong order. A mixed ordering needs an index whose
direction pattern matches, hence the explicit `city DESC` index. `owners_city_idx (city, id)`
from the earlier draft is dropped — it can no longer serve either city ordering now that the
name is the secondary criterion.

The alternative is a single ascending city index and a sort step for the descending direction.
At 10k rows that sort costs a few milliseconds — but it means re-sorting the entire table on
every page of a descending city sort, which is the offset-pagination pathology this change
exists to remove. A second index on a 10k-row table is cheap; the write path here is a
low-traffic admin CRUD.

Under `C`, `Adams, Zamfir, de Vries, van Gogh, Ångström, Émile, Öztürk` — lowercase and
diacritics land after `Z`. Invisible on the 28-row seed, obvious on 10k real names.

### N+1: `@BatchSize`, not `JOIN FETCH`

`@BatchSize` on `Owner.pets` and `Pet.visits` turns ~45 queries per page into ~3, with zero
payload change.

`JOIN FETCH` is not an option here: Hibernate cannot push `LIMIT` through a row-multiplying join,
so it fetches everything and paginates in memory (`HHH000104`) — exactly the failure mode being
removed.

A list DTO without `visits` would be cleaner still, but adds a second owner type in the frontend
for a negligible bandwidth win at 20 rows/page. Deferred (see *Technical follow-ups* below).

**No query-counting test** — decided explicitly. Accepted consequence: an N+1 regression is not
blocked automatically. Deferred (see *Technical follow-ups* below).

### Frontend: Material grid, state in the URL

`MatTable` + `MatSort` + `MatPaginator` (Angular Material 16.2.1, already a dependency),
restyled to match the existing Bootstrap table; `table-layout: fixed` so columns don't jump when
sorting. Page size options 5 / 10 / 20, default 10.

`page`, `size`, `sort`, `lastName` live in the route query params — the component reacts to the
`ActivatedRoute` params rather than owning the state — giving shareable deep links and a working
Back button for free.

**Page 1 is the reset point for every non-pagination change.** Search term, sort key, sort
direction and page size all reset `page` to 0; only the paginator's own next/previous/goto
changes the page index. Rationale: page *n* means nothing once the ordering or the result set
underneath it changes — the user is looking at an arbitrary window of a list they have not seen
the start of, and with a narrowed search or a larger page size that window can be empty. Trying
to preserve the user's position instead (e.g. keeping the first visible owner in view across a
re-sort) is a different, more expensive feature and was not asked for.

Implementation note: with the state in the URL this is one rule in one place — the handlers for
search, sort and page-size navigate with `page: 0`, the paginator handler is the only one that
carries `page` through.

The Name column renders `"McCallister, Kevin"`. Today it renders `"Kevin McCallister"` while the
sort is by last name, which would make a correctly sorted grid look unsorted.

## Code Impact

**Backend**
- `OwnerRestController.listOwners` (signature + OpenAPI annotations), new `OwnerPageDto`, sort
  key mapping, `OwnerRepository.findByLastNameStartingWith` becomes paged.
- `Owner.pets`, `Pet.visits`: `@BatchSize`.
- New `db/migration/V9__owners_collation_and_indexes.sql`.

**API contract**
- `openapi.yaml` → `npm run generate:api` → `api-types.ts`.
- `spectral lint` must stay green on the new envelope schema.

**Frontend**
- `owner-list.component.*`, `owner.service.ts`, the orphan `owners/owner-page.ts` (rewritten),
  `owners.module.ts` (Material table/sort/paginator imports).

**Tests that break and must be updated**
- `owners.feature` ("the response JSON array has size 2"), `OwnerTest`,
  `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`,
  `owner-list.component.spec.ts`, `owner.service.spec.ts`.

**Not affected**
- MCP server and chatbot use repositories directly, not `GET /api/owners`.

**Docs**
- `user-manual/manual.md` + regenerated screenshot.

**Technical follow-ups, out of scope here**
1. `OwnerDto.telephone` is `@NotNull @Pattern("^[0-9]*$")` while real data contains a `NULL`
   (`V5__clear_demo_owner_phone.sql`) — a pre-existing dishonest contract.
2. A slimmer list DTO without `visits`.
3. A query-counting test guarding against N+1 regressions.
4. Sorting by address / telephone would need normalized columns (`street_name`, E.164 phone),
   not just an `ORDER BY`.

## Risks / Trade-offs

- **`ALTER COLUMN … COLLATE` takes `ACCESS EXCLUSIVE` and rewrites the column** → instant at 10k
  rows, but not an online operation. Run it in a maintenance window; the table is small enough
  that the lock is measured in milliseconds.
- **Prefix search may stop using the index under ICU collation** →
  `findByLastNameStartingWith` does `LIKE 'prefix%'`, which needs `text_pattern_ops` to use a
  B-tree under a non-`C` collation. Verify the plan during implementation and add
  `owners_last_name_pattern_idx (last_name text_pattern_ops)` if the search regresses.
- **Silent fallback on unknown sort keys** → a client gets a different order than requested with
  no error. Mitigation: only two keys exist, both documented in `openapi.yaml`, and the UI can
  only produce valid ones.
- **Breaking `GET /api/owners`** → any unknown external consumer breaks at once. Mitigation:
  blast radius was checked across the repo (MCP and chatbot bypass the endpoint); the OpenAPI
  document and generated client types are regenerated in the same change.
- **Offset pagination degrades on deep pages** → at 10k rows and 20 rows/page the deepest offset
  is 500 pages, served from a covering index; acceptable. Revisit only if owner count grows by
  an order of magnitude.
- **`PackagesArchTest` may reject new inter-package dependencies** → if it fires, update the
  architecture diagram; do not weaken the guardrail.

## Migration Plan

1. Deploy `V9` with the application (Flyway runs on startup, `ddl-auto=none`).
2. Backend and frontend ship together — the envelope is a breaking API change, so a partial
   rollout would leave the old SPA parsing an object as an array.
3. Rollback: revert the application; `V9` can stay in place (ICU collation and the two indexes
   are harmless to the previous code). If it must be undone, write `V10` reverting the collation
   and dropping the indexes — never edit `V9` after release.

## Open Questions

- Does `findByLastNameStartingWith` still use an index after the collation change, or does it
  need `text_pattern_ops`? Answerable by reading the plan during implementation; it adds an
  index at most, and changes neither the contract nor the task breakdown.
