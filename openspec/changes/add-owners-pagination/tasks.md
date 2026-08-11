## 1. Prerequisite bug fix (blocks typed query params)

- [x] 1.1 Write a failing test asserting that a query parameter that cannot be converted to its target type returns 400, not 500 (design.md D5)
- [x] 1.2 Add a `MethodArgumentTypeMismatchException` handler to `ExceptionControllerAdvice` returning 400 + `ProblemDetail`, and make 1.1 pass
- [x] 1.3 Confirm the existing `@ExceptionHandler(Exception.class)` no longer intercepts it

## 2. Database

- [x] 2.1 Add `V9__index_owners_for_listing.sql` creating `(last_name, first_name, id)` and `(city, last_name, id)` on `owners`
- [x] 2.2 Boot the backend and verify Flyway applies V9 and both indexes exist in `pg_indexes`
- [x] 2.3 `EXPLAIN` the default listing query. **Finding:** at 28 rows the planner correctly prefers a seq scan + sort (cost 1.89) — the index is not yet worth using. With `enable_seqscan=off` it plans `Index Scan using owners_last_name_first_name_id_idx` with no sort step, confirming the index matches the ORDER BY exactly and will be chosen as the table grows. Re-check against production volumes.

## 3. Listing contract — backend

- [x] 3.1 Add `OwnerSortField` enum (`NAME`, `CITY`), each mapping to its `Sort` with the trailing `id` tiebreaker (design.md D2, D3)
- [x] 3.2 Add `OwnerListingCriteria` record binding `page`, `size`, `sort`, `direction`, `lastName`, with `@Min(0)` on page and `@AssertTrue` for `size ∈ {5,10,20}` (design.md D4)
- [x] 3.3 Add `OwnerPageDto` record: `content`, `totalElements`, `totalPages`, `number`, `size` (design.md D1)
- [x] 3.4 Declare `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` on `OwnerRepository` (bare `Repository` base — declare explicitly)

## 4. Listing behaviour — backend, test-first

- [x] 4.1 Failing test: no parameters → at most 10 owners, `number` 0, `size` 10, `totalElements` = full count
- [x] 4.2 Failing test: `size=5&page=1` returns the second slice and shares no owner with page 0
- [x] 4.3 Failing test: page beyond the last → 200, empty `content`, totals still correct
- [x] 4.4 Failing test: default order is `(last_name, first_name)` ascending
- [x] 4.5 Failing test: `sort=CITY&direction=DESC` orders by city descending, then last name
- [x] 4.6 Failing test: paging twice through owners tied on `city` yields each owner exactly once (the seven `London` owners, `size=5`)
- [x] 4.7 Failing test: `size=7`, `size=100000`, `page=-1`, `sort=TELEPHONE` each return 400
- [x] 4.8 Failing test: `lastName` filter narrows `totalElements`, and a no-match filter gives empty content with totals 0
- [x] 4.9 Rewrite `listOwners` to take `@ModelAttribute @Validated OwnerListingCriteria`, call the paged finder, map to `OwnerPageDto`; make 4.1–4.8 pass

## 5. Bounded query count

- [x] 5.1 Failing test asserting the query count for one page of owners does not grow with the number of owners in the table (design.md D6)
- [x] 5.2 Add `@BatchSize` to `Owner.pets` and `Pet.visits`; make 5.1 pass
- [x] 5.3 Verify via SQL logging that serving a page issues owners + pets + visits queries and no per-owner round trip. **Measured:** 22 statements before, **4 after** (owners page, count, batched pets, batched visits)
- [x] 5.4 Confirm no `JOIN FETCH` is combined with `Pageable` anywhere and no `HHH000104` warning appears in the logs

## 6. Update existing backend callers

- [x] 6.1 Update `OwnerTest` list tests (`getAll`, `getAllWithAddressFilter`, `getAllWithNameFilter_notFound`) and the `search(...)` helper to deserialize the envelope
- [x] 6.2 Update the Cucumber step in `OwnerSteps` that asserts on `GET /api/owners?lastName=`
- [x] 6.3 Update `OwnerSearchThroughLatencyProxyTest` for the new response shape
- [x] 6.4 Run the full backend suite green

## 7. Contract artifacts

- [x] 7.1 Regenerate `openapi.yaml` and confirm `OpenApiExtractorTest` passes
- [x] 7.2 Verify the spec documents `sort`/`direction` as enums and `size` as an allowlist. **Found:** springdoc first rendered the whole record as one object param named `criteria`; fixed with `@ParameterObject`, which flattens it into page/size/sort/direction/lastName with proper enums
- [x] 7.3 Run `npm run lint:openapi` (Spectral)
- [x] 7.4 Regenerate frontend types with `npm run generate:api`

## 8. Frontend

- [x] 8.1 Point `owner-page.ts` at the generated `OwnerPageDto` type (currently dead) and delete the duplicate hand-written interface
- [x] 8.2 Update `OwnerService.getOwners` to take page/size/sort/direction/lastName and return the page envelope; build the query with `HttpParams` instead of string concatenation
- [x] 8.3 Drive `owner-list.component` from route query params — read on init, write on every page/sort/filter change (design.md D9)
- [x] 8.4 Reset to page 0 when the last-name filter changes, preserving the current ordering
- [x] 8.5 Make the Name and City `<th>` clickable ordering controls with a direction indicator; leave Address, Telephone and Pets as plain headers
- [x] 8.6 Add a Bootstrap pager with a 5/10/20 page-size selector, keeping `#ownersTable` and `td.ownerFullName` intact (design.md D8)
- [x] 8.7 Render the Name cell surname-first as `{{owner.lastName}}, {{owner.firstName}}`, keeping it a link to the owner detail route and keeping the `.ownerFullName` class (design.md D11)
- [x] 8.8 Fix the invalid nested `<tr>` inside the Pets `<td>` while the template is being touched
- [x] 8.9 Remove the leftover `console.log` calls and the unused `listOfOwnersWithLastName` field
- [x] 8.10 Correct `wiremock/mappings/get-api-owners.json` so the stub matches the real envelope. **No edit needed:** the stub already described a paged envelope the backend never returned — it becomes correct as of this change
- [x] 8.11 Update `owner-list.component.spec.ts` and `owner.service.spec.ts`; run `npm run test-headless` green

## 9. End-to-end

- [x] 9.1 Update `ApiClient.getFullNames` to build `Lastname, Firstname` so it matches the new display (design.md D11)
- [x] 9.2 Update `OwnersPage.waitForOwnersCount` and `owners.spec.ts` — the suite currently assumes the whole list is on one page
- [x] 9.3 Add an e2e covering: sort by Name, then by City, then page forward and back
- [x] 9.4 Add an e2e asserting the Name column reads alphabetically top-to-bottom on its visible text, which only holds if 8.7 shipped
- [x] 9.5 Add an e2e covering: change page size to 5, verify row count and total pages
- [x] 9.6 Add an e2e covering: reload a deep-linked URL and get the same page, ordering and filter
- [x] 9.7 Update `features/dsl/owner-search.dsl.ts` — read `.content` from both API calls, build names surname-first, fix `lastNameOf` (with `Potter, Harry` it currently returns `Harry`), and stop asserting the whole result set fits on one page
- [x] 9.8 Keep the Cucumber `.feature` and its TypeScript twin `features/owner-search.spec.ts` in step — the scenario now exists twice
- [x] 9.9 Run BOTH Playwright projects green (`chromium` and `features`). **13 passed.** Also fixed `features/dsl/add-visit.dsl.ts`, an owners-listing consumer not in the original inventory. 2 chatbot tests fail for an unrelated pre-existing reason: they expect owner `George Franklin` while the seeded owner #1 is `Kevin McCallister`

## 10. Close out

- [x] 10.1 Run the full backend suite, frontend tests and e2e together. **Backend 165/165, frontend 113/113, e2e 13 passed** (2 pre-existing chatbot failures, unrelated)
- [x] 10.2 Verify the grid by hand against the running app on the seeded 28 owners. **Paged all 6 pages at size 5 sorted by CITY: 28 rows collected, 28 unique, 0 duplicates**
- [ ] 10.3 Comment on GitHub issue #25 explaining that sorting is offered on Name and City only, with the data that motivated narrowing "any column"
- [x] 10.4 Deferred follow-ups, each a separate decision:
  - `GET /api/owners/count` is now redundant with `totalElements`, but has its own callers and a `permitAll` rule
  - List rows still carry every pet and its visit history, though the grid shows only pet names — trimming means changing `OwnerDto`, shared with the detail endpoint
  - The last-name filter stays case-sensitive (`C` collation + `StartingWith`): "potter" does not find "Potter"
  - Ordering is byte-order, so `de Silva` sorts after `Zorro`; fixing it needs a collation or `lower()` decision plus its own index
  - `tests/pages/OwnersPage.ts` has a pre-existing `tsc` error (`Cannot find name 'document'`, missing the `dom` lib)
  - `OwnerDto` uses Lombok `@Data`, which `.claude/rules/java-code-preferences.md` bans
