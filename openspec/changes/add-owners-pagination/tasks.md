## 1. Fix pre-existing e2e breakage (can land first, independently)

- [ ] 1.1 Fix the `OwnersPage.ts`/`owner-search.steps.ts` selector mismatch
      (`td.ownerFullName` vs. rendered `owner-full-name`) and remove the
      try/catch that swallows `waitForOwnersCount` timeouts
- [ ] 1.2 Run the Playwright suite and confirm it is green before any pagination
      code lands

## 2. Database: index and N+1 fix

- [ ] 2.1 Add `db/migration/V10__index_owners_for_paged_grid.sql` with
      `owners(last_name, first_name, id)` and
      `owners(city, last_name, first_name, id)` B-tree indexes
- [ ] 2.2 Regenerate `DB.sql` and `DB.puml` (`DbSchemaExtractorTest` /
      DB.puml delta guard) and commit alongside the migration
- [ ] 2.3 Add `@BatchSize` to `Owner.pets` to avoid N+1 queries when paging
- [ ] 2.4 Run `JpaMatchesDBSchemaTest` to confirm `ddl-auto=validate` passes

## 3. Backend: failing tests first (red)

- [ ] 3.1 Add Cucumber scenarios to `owners.feature` covering: default page
      size (10), explicit `page`/`size`, sort by `name` both directions, sort
      by `city` both directions, 400 on invalid `sort`, 400 on invalid `size`,
      400 on negative `page`, empty page beyond the last page returns 200,
      and stable ordering across pages using the two duplicate-surname
      fixture rows (Potter, Darling)
- [ ] 3.2 Confirm the new scenarios fail (red) against the current
      `List<OwnerDto>`-returning endpoint

## 4. Backend: paged endpoint implementation

- [ ] 4.1 Add `OwnerPageDto` (`content`, `totalElements`, `totalPages`,
      `number`, `size`) and a mapper method `ownerMapper.toOwnerPageDto(page)`
- [ ] 4.2 Introduce a `@ParameterObject` criteria/paging bean
      (`lastName`, `page`, `size`, `sort`) for `OwnerRestController.listOwners`
      instead of discrete `@RequestParam`s
- [ ] 4.3 Add an explicit paging repository method (repositories extend the
      bare `Repository`, so `findAll(Pageable)` is not inherited) with the
      `name`/`city` sort mapping (`last_name, first_name, id` /
      `city, last_name, first_name, id`) and `id` always ascending as final
      tiebreaker
- [ ] 4.4 Implement whitelist validation for `sort` (`name,asc`/`name,desc`/
      `city,asc`/`city,desc`) and `size` (positive integer), and reject
      negative `page`, all returning 400 with the allowed values in the
      message
- [ ] 4.5 Confirm out-of-range `page` returns 200 with empty `content` and
      correct `totalElements`/`totalPages`
- [ ] 4.6 Run the Cucumber suite from step 3.1 and confirm green
- [ ] 4.7 Regenerate `openapi.yaml` (`OpenApiExtractorTest`) and review the
      diff given its CODEOWNERS protection

## 5. Backend: update existing call sites for the new envelope

- [ ] 5.1 Update `OwnerTest.search()` away from
      `new TypeReference<List<OwnerDto>>() {}`
- [ ] 5.2 Update `OwnerSteps`' `jsonPath().getList("$")` /
      `getList("lastName", ...)` usages to read the new envelope shape
- [ ] 5.3 Update `OwnerSearchThroughLatencyProxyTest`'s
      `jsonPath("$", hasSize(...))` assertion
- [ ] 5.4 Prove the new contract with raw `curl`, including both 400 cases
      and a happy-path paged request

## 6. Frontend: regenerate types and service

- [ ] 6.1 Run `npm run generate:api` to regenerate `api-types.ts` from the
      updated `openapi.yaml`
- [ ] 6.2 Update `owner.service.ts` methods from `Observable<Owner[]>` to the
      new paged envelope type, passing through `page`/`size`/`sort` params
- [ ] 6.3 Update `owner-search.steps.ts` (ui-test) to read owners from
      `response.content` instead of the bare array

## 7. Frontend: grid rework

- [ ] 7.1 Remove orphaned `owner-page.ts` interface and dead CSS
      (`.owners-pagination`, `.owners-page-size`, `#nameGroup`,
      `.owner-search-input`) left over from the earlier revert
- [ ] 7.2 Add clickable `Name`/`City` `<th>` headers with sort direction
      indicator (▲/▼) and `aria-sort`; clicking the active column toggles
      direction, clicking a new column starts at `asc`
- [ ] 7.2b Change the `Name` cell in `owner-list.component.html` from
      `{{ owner.firstName }} {{ owner.lastName }}` to
      `{{ owner.lastName }}, {{ owner.firstName }}` so the displayed order
      matches the surname-first sort key
- [ ] 7.3 Add a hand-rolled pager footer (Bootstrap 3 table, no Angular
      Material)
- [ ] 7.4 Persist grid state (`lastName`, `page`, `size`, `sort`) in the URL
      query params
- [ ] 7.5 Implement edge behaviors: changing `lastName` resets to page 0;
      changing the sort column or direction also resets to page 0 (rows on a
      given page number change once the order changes, so staying put would
      show unrelated data); changing page size keeps the first visible row in
      view; navigate back to the last non-empty page if the current page
      becomes empty
- [ ] 7.6 Make the "Find Owner" button write `lastName` into the URL query
      params instead of local component state (no live/debounced search —
      that remains issue #24)
- [ ] 7.7 Fix `owner-list.component.spec.ts`'s `ActivatedRoute` stub to
      provide `queryParams` (current stub only has `params`)

## 8. E2E and documentation (final step: acceptance criteria as browser tests)

- [ ] 8.1 Rework `owners.spec.ts`'s "shows all owners on initial load" test
      for the new default page size of 10 (no longer expects all 28 rows)
- [ ] 8.2 As the final acceptance step, translate **every** UI-observable
      requirement/scenario in `specs/owners-pagination/spec.md` into its own
      Gherkin scenario, executed end-to-end via Playwright driving a real
      browser (not just API-level checks): default page size, sort toggling
      on Name/City, paging without losing duplicate-named owners, search
      resets to page 1, sort change resets to page 1, empty-page fallback,
      and URL state surviving a reload/deep link (e.g.
      `?page=1&sort=city,desc` restores the expected state)
- [ ] 8.3 Reshoot `user-manual/screenshots/owners-list.png` and update the
      accompanying manual text
- [ ] 8.4 Regenerate the codemap (`./generate-codecity.sh`)

## 9. Delivery

- [ ] 9.1 Push each numbered group above as its own commit/PR, backend-first,
      and watch CI to green after each push before starting the next group
