## 1. Backend: Repository

- [ ] 1.1 Write a failing test for `searchAcrossAllFields` in `OwnerRepositoryTest` covering: substring match on lastName, firstName, address, city, telephone, pet name, case-insensitivity, trim, and empty string returns all
- [ ] 1.2 Add `searchAcrossAllFields(@Param("search") String search)` custom JPQL query to `OwnerRepository` (replace `findByLastNameStartingWith`)

## 2. Backend: Controller

- [ ] 2.1 Write a failing test for `GET /api/owners?search=` in `OwnerRestControllerTest` verifying the new param name and trim behaviour
- [ ] 2.2 Update `listOwners` in `OwnerRestController` (line 59): rename param `lastName` → `search`, add `.trim()`, call `searchAcrossAllFields`
- [ ] 2.3 Delete the old `findByLastNameStartingWith` method from `OwnerRepository` (line 12) once all tests pass

## 3. Frontend: Service

- [ ] 3.1 Update `ownerService.searchOwners(lastName)` call signature / URL param from `?lastName=` to `?search=`; remove the empty-string special case (empty search is handled by the backend)

## 4. Frontend: Component

- [ ] 4.1 Switch `owner-list.component.ts` from template-driven (`ngModel`) to reactive form (`FormControl`) with `valueChanges.pipe(debounceTime(300), distinctUntilChanged())`
- [ ] 4.2 Remove the `searchByLastName()` method and its button click handler; single subscribe calls the service on every debounced value
- [ ] 4.3 Remove the "Find Owner" button from `owner-list.component.html` (line 18); keep "Add Owner"

## 5. Frontend: UI Text

- [ ] 5.1 Change input label from "Last name" to "Search"
- [ ] 5.2 Add descriptive placeholder (e.g. "Search by name, address, city, telephone or pet...")
- [ ] 5.3 Update no-results message to include the current search term (e.g. `No owners found for "{{search}}"`)

## 6. Verification

- [ ] 6.1 Run backend tests: `./mvnw test` — all green
- [ ] 6.2 Run frontend tests: `npm run test-headless` — all green
- [ ] 6.3 Manual smoke test: start full stack, verify live search works end-to-end across all fields
