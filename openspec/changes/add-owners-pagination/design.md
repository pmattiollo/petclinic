## Context

**The business goal, in the PO's words:** the Owners screen must stay usable and fast when
the clinic grows from 28 owners to 10,000 — shown a page at a time, in a predictable
order, with the two column orderings that are actually useful, and with a link that can be
shared. See `proposal.md`; `specs/owner-listing/spec.md` holds the behaviour contract.

The constraints that shape the approach:

- `OwnerRepository` extends the bare `org.springframework.data.repository.Repository`, not
  `JpaRepository`/`PagingAndSortingRepository`. Paged finders must be declared explicitly.
- The project has **no service layer** by design (`CLAUDE.md`): controller → repository.
- `Owner.pets` and `Pet.visits` are `LAZY` with no batch configuration, and `OwnerDto`
  nests pets which nest visits — so serializing a page triggers a query cascade.
- The database collation is **`C`** (verified via `pg_database`). Two consequences: a plain
  btree on `last_name` already supports `LIKE 'Dav%'` prefix scans without
  `text_pattern_ops`, and ordering is byte order, so `de Silva` sorts after `Zorro`.
- `openapi.yaml` is generated output, guarded by `OpenApiExtractorTest`, and the frontend's
  types are generated from it (`npm run generate:api`). A controller signature change is a
  three-artifact change.
- `ExceptionControllerAdvice` registers `@ExceptionHandler(Exception.class)` → 500, which
  swallows Spring's own 400-worthy binding exceptions.
- Angular Material is present but used **only** for datepickers; every table in the app is
  Bootstrap 3.

## Goals / Non-Goals

**Goals:**
- One canonical response shape for the listing, expressible in OpenAPI and generating clean
  frontend types.
- A sort contract that is a closed set by construction, so an unknown value cannot reach
  Spring Data as a property name.
- Bounded query count and bounded memory per page, independent of table size.
- Preserve the existing e2e selectors (`#ownersTable`, `td.ownerFullName`) so the Playwright
  suite changes only where pagination genuinely changed the behaviour.

**Non-Goals:**
- No generic/reusable pagination framework for other grids — solve this grid, extract later
  if a second caller appears.
- No change to `OwnerDto`'s field set. Trimming pets/visits out of list rows is a worthwhile
  payload optimisation but is a separate contract change.
- No cursor/keyset pagination. Offset paging is correct for a 10k table with a jump-to-page UI.

## Decisions

### D1: A hand-written `OwnerPageDto`, not Spring's `Page<T>`

`Page` serializes as `PageImpl` with an unstable shape (`pageable`, `sort`, `first`, `last`,
`numberOfElements`, …), logs a serialization warning, and produces a messy OpenAPI schema
that leaks Spring internals into the generated TypeScript.

*Alternatives:* returning `Page<OwnerDto>` directly (rejected: unstable contract); a bare
array plus an `X-Total-Count` header (rejected: the total falls outside the generated types,
and CORS must expose the header).

The controller maps `Page<Owner>` → `OwnerPageDto` explicitly. `content`, `totalElements`,
`totalPages`, `number`, `size` — nothing more, matching the already-present (currently dead)
`owner-page.ts` on the frontend and the existing wiremock stub.

### D2: Sort as a closed enum, not a Spring `Pageable`

The listing exposes `sort=NAME|CITY` and `direction=ASC|DESC` bound to Java enums, with the
enum owning its `Sort`:

```
NAME → Sort.by(direction, "lastName", "firstName", "id")
CITY → Sort.by(direction, "city", "lastName", "id")
```

Two properties this buys, which a `Pageable` parameter does not:

1. **Name is a composite.** "Sort by Name" is `(last_name, first_name)`; there is no single
   entity field to name in `?sort=`.
2. **The whitelist is the type system.** With `Pageable`, `?sort=user.password,asc` reaches
   Spring Data as a property reference — a `PropertyReferenceException`, i.e. a 500 and an
   information leak. With an enum, an unknown value never binds.

*Alternative considered:* `Pageable` plus a `@SortWhitelist` validator — more moving parts
than an enum for exactly two legal sorts.

### D3: The `id` tiebreaker is mandatory, not cosmetic

Postgres gives no ordering guarantee among rows tied on the `ORDER BY` key, and `OFFSET`
re-executes the query per request. Seven of twenty-eight seeded owners live in `London`; at
`size=5` a `city`-only sort can return the same owner on pages 0 and 1 while another is
never shown. Every sort therefore terminates in `id`. This is what makes
*"Paging is deterministic across requests"* in the spec true rather than usually-true.

### D4: Criteria bound as one validated object

`page`, `size`, `sort`, `direction`, `lastName` bind into a single `OwnerListingCriteria`
record via `@ModelAttribute @Validated`, carrying `@Min(0)` on `page` and an `@AssertTrue`
that `size ∈ {5,10,20}`. Violations become `MethodArgumentNotValidException` /
`ConstraintViolationException`, both already mapped to `400` + `ProblemDetail` by
`ExceptionControllerAdvice`.

**Allowlist over clamping**: silently serving 100 rows to a client that asked for 500 is a
lie the client cannot detect. The UI only ever offers 5/10/20.

### D5: Add a `MethodArgumentTypeMismatchException` handler (pre-existing bug)

Spring raises this for `?sort=BOGUS` or `?page=abc`. Spring MVC's default resolver would
answer `400`, but `@ExceptionHandler(Exception.class)` in
`ExceptionControllerAdvice.java:72` is more specific-by-registration and turns it into
**500**. This defect exists today (`?lastName` is a `String`, so nothing currently
mistypes); introducing typed parameters is what makes it reachable. A dedicated handler
returning `400` + `ProblemDetail` is a prerequisite, not a nice-to-have.

### D6: `@BatchSize`, never `JOIN FETCH`, with `Pageable`

Hibernate cannot apply `LIMIT`/`OFFSET` in SQL when a collection is join-fetched. It logs
`HHH000104` and paginates **in memory** — reading all 10,000 owners to hand back 10. The
existing `findByIdFetchingPets` is safe only because it fetches one owner.

Instead, `@BatchSize(size = 25)` on `Owner.pets` and `Pet.visits`. Serving a page becomes:
one query for the page of owners, one `IN`-query for their pets, one for the visits —
constant in table size, satisfying *"Listing a page costs a bounded number of queries"*.

*Alternative:* drop pets from the list payload entirely. Better for payload size, but it
changes `OwnerDto`, which is shared with the detail endpoint — deferred (Non-Goals).

### D7: Two indexes in `V9`, exploiting the `C` collation

```sql
CREATE INDEX owners_last_name_first_name_id_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_last_name_id_idx       ON owners (city, last_name, id);
```

The first serves both the default sort *and* the existing `findByLastNameStartingWith`
prefix filter — under `C` collation a plain btree supports `LIKE 'Dav%'`, so no
`text_pattern_ops` variant is needed.

Honest sizing: at 10k rows Postgres would seq-scan and top-N sort in single-digit
milliseconds; these indexes are cheap insurance that keeps the plan stable as the table
grows, not a fix for a measured problem.

### D8: Keep the Bootstrap table; hand-roll the sort headers and pager

Material in this app is datepicker-only. `MatTable` + `MatSort` + `MatPaginator` would drag
a Material theme into a Bootstrap 3 page, restructure the markup, and break the
`#ownersTable` / `td.ownerFullName` hooks the Playwright suite and the Cucumber UI steps
depend on. The interaction needed is two clickable headers and a pager — small enough to
own outright.

### D9: URL query params as the single source of grid state

`page`, `size`, `sort`, `direction`, `lastName` live in the Angular route's query params;
the component reacts to them rather than holding parallel state. Deep-linkable, survives
reload, and the Back button works — which is the spec requirement — and it removes the class
of bug where the URL and the displayed page disagree.

### D10: Break the endpoint outright, no compatibility path

Every caller is in this repo. A dual-shape endpoint (array without `?page`, envelope with
it) cannot be expressed as one OpenAPI response schema and would generate a union type on
the frontend. One shape, all callers updated in the same change.

### D12: The direction applies to the tiebreaker too

`Sort.by(direction, "city", "lastName", "id")` reverses *every* term, so `CITY DESC` also
orders the owners within each city by descending last name. That is the intended reading of
"reverse the order": clicking a header twice presents the exact reverse of the list, rather
than the same city blocks with their contents still ascending. Confirmed by
`OwnerListingTest.orderByCityDescending_thenByLastName`, which asserts the reversed
tiebreak explicitly rather than accepting whatever came out.

### D11: Render the Name column surname-first (`Potter, Harry`)

`owner-list.component.html:41` renders `{{firstName}} {{lastName}}` while D2 orders by
`(last_name, first_name)`. The sort key is then the *second* token in the cell, so a
correctly ordered column reads `Henry Baskerville, James Bond, Sam Carraclough, George
Darling` — H, J, S, G down the visible edge. That is the same defect this design rejects
the Address column for: an ordering the user reads as broken.

Two ways to close the gap; we change the display, not the sort.

*Alternative — sort by `(first_name, last_name)` to match the display:* rejected. The only
search control on this screen filters by last name (`findByLastNameStartingWith`), so the
screen is already surname-oriented; ordering by first name would make the grid's primary
order the weakest identifier for looking a client up.

*Alternative — split into separate First name / Last name columns:* rejected. Widens the
grid and breaks the full name as a single link to the owner detail route.

Formatting stays in the template — `{{owner.lastName}}, {{owner.firstName}}` — not in the
DTO, since `OwnerDto` is shared with the detail screen and other consumers.

Knock-on: `ApiClient.getFullNames` in the e2e support code builds the expected strings and
must use the same format; any spec asserting on `td.ownerFullName` text needs the same
update. The `.ownerFullName` selector itself is unchanged, so the page object survives.

## Affected Code

**Backend** (`petclinic-backend/`)
- `rest/OwnerRestController.java` — `listOwners` signature and return type
- `rest/OwnerListingCriteria.java`, `rest/OwnerSortField.java`, `rest/dto/OwnerPageDto.java` — new
- `repository/OwnerRepository.java` — paged finder declared explicitly on the bare `Repository` base
- `domain/Owner.java`, `domain/Pet.java` — `@BatchSize` on the lazy collections
- `rest/error/ExceptionControllerAdvice.java` — new `MethodArgumentTypeMismatchException` handler
- `src/main/resources/db/migration/V9__index_owners_for_listing.sql` — new

**Contract artifacts** (all three must move in one commit)
- `openapi.yaml` — regenerated; guarded by `OpenApiExtractorTest`, linted by `.spectral.yaml`
- `petclinic-frontend/src/app/generated/api-types` — `npm run generate:api`
- `petclinic-frontend/wiremock/mappings/get-api-owners.json` — already stubs a paged envelope
  the real backend never returned; becomes correct for the first time

**Frontend** (`petclinic-frontend/`)
- `owners/owner-list/owner-list.component.{ts,html}` — sort headers, pager, query-param
  state, and the surname-first Name cell (D11)
- `owners/owner.service.ts` — `HttpParams` instead of string concatenation
- `owners/owner-page.ts` — dead file today; becomes the real response type

**Tests**
- `rest/OwnerTest.java` — `getAll`, `getAllWithAddressFilter`, `getAllWithNameFilter_notFound`
  and the `search(...)` helper, which deserializes into `List<OwnerDto>`
- `functional/OwnerSteps.java:52`, `perf/OwnerSearchThroughLatencyProxyTest.java`
- `owner-list.component.spec.ts`, `owner.service.spec.ts`
- `petclinic-ui-test/tests/owners.spec.ts` + `pages/OwnersPage.ts` — `waitForOwnersCount`
  assumes the whole list is on one page
- `petclinic-ui-test/tests/support/api-client.ts` — `getFullNames` must emit the
  surname-first format (D11)
- `petclinic-ui-test/features/dsl/owner-search.dsl.ts` — the glue shared by the Cucumber
  suite (`features/owner-search.feature` + `step_definitions/owner-search.steps.ts`) and its
  plain-TypeScript twin (`features/owner-search.spec.ts`), both added on `main` while this
  change was being planned. One file, five breakages:
  1. `axios.get('/api/owners')` destructures a bare array — becomes `.content`
  2. the filtered call does the same
  3. `fullName()` builds `${firstName} ${lastName}` — must become surname-first (D11)
  4. `lastNameOf()` takes the **last** whitespace token, which for `Potter, Harry` returns
     `Harry` — the prefix assertion silently inverts
  5. `toHaveCount(expectedFullNames.length)` assumes the whole result set is on one page
- `petclinic-ui-test/playwright.config.ts` — now runs two projects (`chromium`, `features`);
  both must pass. `tests/support/trace-fixture.ts` adds a ~1s OTel flush per test — expected,
  do not revert.

**Deliberately untouched**
- `GET /api/owners/count` — redundant with `totalElements`, but removing it is a separate
  contract change with its own callers (`OwnerTest:124`, `permitAll` security rule).
- `OwnerDto`'s field set — trimming pets/visits out of list rows would change the DTO shared
  with the detail endpoint.
- `findByLastNameStartingWith`'s case sensitivity — pre-existing under `C` collation.

## Risks / Trade-offs

- **Contract break lands in three generated artifacts at once** → regenerate `openapi.yaml`
  and the frontend types in the same commit; `OpenApiExtractorTest` fails loudly if they drift.
- **`@BatchSize` is invisible in review and easy to lose** → an assertion on query count (or
  the existing perf test) is what keeps D6 honest; without it, a later refactor to
  `JOIN FETCH` silently reintroduces full-table loading.
- **Sorting under `C` collation is case- and accent-sensitive** → `de Silva` after `Zorro`.
  Accepted for now: pre-existing, affects the current filter equally, and fixing it means a
  collation or `ORDER BY lower(...)` decision that would need its own index.
- **Narrowing "any column" to two contradicts the issue text** → recorded in the proposal
  with the data that motivated it; the issue is the place to confirm with the reporter.
- **The existing wiremock stub already returns a paged envelope** the real backend never
  produced → frontend tests may currently pass against a fiction; verify against the real
  backend, not only the stub.
- **Offset paging degrades at deep offsets** → irrelevant at 10k with a jump-to-page UI;
  revisit only if the table grows by orders of magnitude.

## Migration Plan

1. `V9` index migration ships first — additive, safe to apply ahead of the code, no lock of
   consequence on a 10k table.
2. Backend and frontend deploy together; the API break is only tolerable because both sides
   are in this repo and this deployment.
3. Rollback = revert the code; the `V9` indexes can stay (harmless, and Flyway will not
   un-apply them).
