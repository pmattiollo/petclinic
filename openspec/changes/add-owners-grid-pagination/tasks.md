## 1. Database migration

- [x] 1.1 Write `petclinic-backend/src/main/resources/db/migration/V9__owners_collation_and_indexes.sql`: `ALTER COLUMN` for `last_name`, `first_name`, `city` to `COLLATE "en-US-x-icu"`, then `CREATE INDEX owners_last_first_idx (last_name, first_name, id)`, `owners_city_name_idx (city, last_name, first_name, id)` and `owners_city_desc_name_idx (city DESC, last_name, first_name, id)` — collation first, indexes after
- [x] 1.2 Start the backend against a fresh DB and confirm Flyway applies `V9` cleanly on top of the existing seed
- [x] 1.3 Verify with `EXPLAIN` that all four orderings are served from an index without a sort step: `last_name, first_name, id`, its `DESC` mirror, `city, last_name, first_name, id`, and `city DESC, last_name, first_name, id` — each with `LIMIT 20`
- [x] 1.4 Verify with `EXPLAIN` that `findByLastNameStartingWith` still uses an index under ICU collation; if it regressed to a seq scan, add `owners_last_name_pattern_idx (last_name text_pattern_ops)` to `V9` (resolves the design's Open Question)

## 2. Backend: paged and sorted endpoint

- [x] 2.1 Add `OwnerPageDto { content, totalElements, totalPages, number, size }` under `rest/dto`, with OpenAPI `@Schema` annotations
- [x] 2.2 Add a paged repository query: `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` on `OwnerRepository`
- [x] 2.3 Add the sort-key whitelist mapping `name → last_name, first_name, id` (direction applies to all three) and `city → city, last_name, first_name, id` (direction applies to `city` only; the name stays **ascending** in both directions), with silent fallback to `name,asc` for unknown or malformed keys — do **not** bind `Pageable` from the request
- [x] 2.4 Clamp the page size to the allowed set 5 / 10 / 20, falling back to 10; default page index 0
- [x] 2.5 Change `OwnerRestController.listOwners` to accept `page`, `size`, `sort` alongside `lastName` and return `OwnerPageDto`; update `@Operation` / `@ApiResponse` and the `ApiExamples` payload to the envelope shape
- [x] 2.6 Add `@BatchSize` to `Owner.pets` and `Pet.visits`

## 3. Backend tests

- [x] 3.1 Unit/slice tests for the sort-key mapping: `name,asc`, `name,desc`, `city,asc`, `city,desc`, unknown key falls back to default, `pets.visits.description` falls back to default
- [x] 3.2 Test that `city,desc` keeps the name ascending: seed several owners in the same city and assert they come back by last name ascending, then first name ascending, under **both** `city,asc` and `city,desc`
- [x] 3.3 Tests for pagination: default page/size, explicit page and size, page past the end returns empty `content` with correct `totalElements`, unsupported size falls back to 10
- [x] 3.4 Test that every page ends with the `id` tiebreaker: seed owners sharing a city / last name and assert a deterministic order and that walking all pages yields each owner exactly once
- [x] 3.5 Test ICU ordering: insert `Adams`, `Ångström`, `de Vries`, `Émile`, `Öztürk`, `van Gogh`, `Zamfir` and assert that exact order
- [x] 3.6 Test that name search combines with pagination: `totalElements` counts only matching owners
- [x] 3.7 Update `petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java` to the envelope shape
- [x] 3.8 Update `petclinic-backend/src/test/java/victor/training/petclinic/security/BasicAuthenticationConfigTest.java`
- [x] 3.9 Update `petclinic-backend/src/test/java/victor/training/petclinic/perf/OwnerSearchThroughLatencyProxyTest.java`
- [x] 3.10 Update `petclinic-backend/src/test/resources/features/functional/owners.feature` (the "response JSON array has size 2" step now reads `content`)
- [x] 3.11 Run the backend suite; if `PackagesArchTest` complains about new package dependencies, update the architecture diagram rather than relaxing the guardrail

## 4. API contract

- [x] 4.1 Update `openapi.yaml`: `listOwners` returns `OwnerPageDto`, document the `page`, `size` (enum 5/10/20) and `sort` (enum of `name,asc|name,desc|city,asc|city,desc`) parameters
- [x] 4.2 Run `spectral lint` on `openapi.yaml` and fix any findings
- [x] 4.3 Run `npm run generate:api` in `petclinic-frontend` and commit the regenerated `src/app/generated/api-types.ts`

## 5. Frontend: grid, service and URL state

- [x] 5.1 Rewrite the orphan `petclinic-frontend/src/app/owners/owner-page.ts` as the page envelope type used by the service (align it with the generated API types)
- [x] 5.2 Change `OwnerService.getOwners`/`searchOwners` into a single call taking `{ lastName, page, size, sort }` and returning `Observable<OwnerPage>`
- [x] 5.3 Import `MatTableModule`, `MatSortModule` and `MatPaginatorModule` in `owners.module.ts`
- [x] 5.4 Rewrite `owner-list.component.html/.ts` on `MatTable` + `MatSort` + `MatPaginator`: page size options 5 / 10 / 20 (default 10), sort arrows only on Name and City, name rendered as `"Last, First"`
- [x] 5.5 Drive the component from `ActivatedRoute` query params (`page`, `size`, `sort`, `lastName`) and write state changes back to the URL via `router.navigate`, so deep links and the Back button work
- [x] 5.6 Reset `page` to 0 whenever the search term, sort key, sort direction or page size changes; only the paginator's own navigation carries the page index through
- [x] 5.7 Restyle `owner-list.component.css` so the Material table matches the existing Bootstrap look, with `table-layout: fixed` so columns don't jump while sorting
- [x] 5.8 Update `owner-list.component.spec.ts` and `owner.service.spec.ts` for the envelope, the sort/page parameters, the page-1 reset on search / sort column / sort direction / page size, the fact that paginating alone preserves the other params, and the `"Last, First"` rendering
- [x] 5.9 Run the Angular unit tests

## 6. End-to-end and docs

- [x] 6.1 Add Playwright coverage in `petclinic-ui-test` for navigating between pages, changing page size, and sorting by Name and City
- [x] 6.2 Add an e2e test that, from page 3, changing the sort column, reversing the direction, and changing the page size each land the user back on page 1
- [x] 6.3 Assert in an e2e test that Address, Telephone and Pets expose no sort control
- [x] 6.4 Run `./start-ui-tests.sh` against the running stack
- [x] 6.4 Update `user-manual/manual.md` for the paginated, sortable grid and regenerate the owners screenshot
- [x] 6.5 Delete `sumar.md` (its decisions now live in `proposal.md` and `design.md`) or link it from the change as the historical decision log
