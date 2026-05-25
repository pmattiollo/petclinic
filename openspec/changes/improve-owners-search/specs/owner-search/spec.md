## ADDED Requirements

### Requirement: Search owners across all visible columns
The system SHALL search owners by a single free-text query, matching case-insensitively across `firstName`, `lastName`, `address`, `city`, `telephone`, and the names of their pets. The search uses contains semantics (`LIKE '%...%'`). The search string SHALL be trimmed before querying.

#### Scenario: Match by last name substring
- **WHEN** the client sends `GET /api/owners?search=silva`
- **THEN** the response includes all owners whose `lastName` contains "silva" (case-insensitive)

#### Scenario: Match by first name
- **WHEN** the client sends `GET /api/owners?search=maria`
- **THEN** the response includes all owners whose `firstName` contains "maria" (case-insensitive)

#### Scenario: Match by address
- **WHEN** the client sends `GET /api/owners?search=main st`
- **THEN** the response includes all owners whose `address` contains "main st" (case-insensitive)

#### Scenario: Match by city
- **WHEN** the client sends `GET /api/owners?search=bucharest`
- **THEN** the response includes all owners whose `city` contains "bucharest" (case-insensitive)

#### Scenario: Match by telephone
- **WHEN** the client sends `GET /api/owners?search=0722`
- **THEN** the response includes all owners whose `telephone` contains "0722"

#### Scenario: Match by pet name
- **WHEN** the client sends `GET /api/owners?search=buddy`
- **THEN** the response includes all owners who have at least one pet whose name contains "buddy" (case-insensitive)

#### Scenario: Empty search returns all owners
- **WHEN** the client sends `GET /api/owners?search=`
- **THEN** the response includes all owners

#### Scenario: Search string is trimmed
- **WHEN** the client sends `GET /api/owners?search=  silva  `
- **THEN** the server trims the value and returns owners matching "silva"

### Requirement: API uses `?search=` query parameter
The system SHALL accept `?search=` as the query parameter for owner search. The old `?lastName=` parameter SHALL no longer be supported.

#### Scenario: New param is accepted
- **WHEN** the client sends `GET /api/owners?search=jones`
- **THEN** the response contains owners matching "jones" across all fields

#### Scenario: Old param is not forwarded
- **WHEN** the client sends `GET /api/owners?lastName=jones`
- **THEN** the response does NOT filter by that parameter (treated as unknown param)

### Requirement: Live search with debounce in the frontend
The frontend SHALL trigger the owner search automatically on every input change, with a 300ms debounce after the last keystroke. The "Find Owner" button SHALL be removed.

#### Scenario: Search triggers without button click
- **WHEN** the user types in the search input and pauses for 300ms
- **THEN** the owner list updates automatically without clicking any button

#### Scenario: Search does not fire on every keystroke
- **WHEN** the user types continuously without pausing
- **THEN** no search request is sent until 300ms after the last keystroke

### Requirement: UI text reflects full-text search
The search input label SHALL read "Search" (not "Last name"). The placeholder SHALL describe all searchable fields. The no-results message SHALL include the current search term.

#### Scenario: Label is updated
- **WHEN** the owner list page is displayed
- **THEN** the search input label reads "Search"

#### Scenario: No-results message includes search term
- **WHEN** a search yields no results for the term "xyz"
- **THEN** the page displays a message containing `"xyz"`
