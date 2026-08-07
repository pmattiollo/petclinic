## Purpose

Defines how clients browse the owners directory: a bounded, sortable, last-name-filterable listing of owners returned as a stable page envelope, so large owner sets stay navigable without shipping the whole table.

## ADDED Requirements

### Requirement: Paginated owners listing

The system SHALL return owners from `GET /api/owners` as a bounded page. The response SHALL be a page envelope containing `content` (the owners on the page), `totalElements` (total matching owners), `totalPages`, `number` (zero-based page index), and `size`. The system MUST NOT return an unbounded list.

The `page` parameter selects the zero-based page (default `0`) and the `size` parameter selects the page size (default `10`).

#### Scenario: Default page returned

- **WHEN** a client calls `GET /api/owners` with no pagination parameters
- **THEN** the response is a page envelope with `number` = 0, `size` = 10, and at most 10 owners in `content`, and `totalElements` reflects the total matching owner count

#### Scenario: Specific page requested

- **WHEN** a client calls `GET /api/owners?page=1&size=5`
- **THEN** the response contains the second page of 5 owners with `number` = 1 and `size` = 5

#### Scenario: Page beyond available data

- **WHEN** a client requests a `page` past the last page of results
- **THEN** the response is a valid page envelope with an empty `content` list and the correct `totalElements`/`totalPages`

### Requirement: Page-size whitelist

The system SHALL accept only page sizes in the set {5, 10, 20}. Any other `size` value MUST be rejected with HTTP `400`; the system MUST NOT silently clamp or substitute a default.

#### Scenario: Allowed size

- **WHEN** a client calls `GET /api/owners?size=20`
- **THEN** the response is a page of at most 20 owners

#### Scenario: Disallowed size rejected

- **WHEN** a client calls `GET /api/owners?size=7` or `GET /api/owners?size=100000`
- **THEN** the system responds with HTTP `400` and returns no owner data

### Requirement: Sortable columns whitelist

The system SHALL accept a `sort` parameter of the form `<col>,<dir>` where `col` ∈ {`name`, `city`} and `dir` ∈ {`asc`, `desc`}. The default when `sort` is omitted SHALL be `name,asc`. Any other column or direction MUST be rejected with HTTP `400`.

The chosen direction applies only to the selected column: sorting by `name` orders by last name in the chosen direction, then by first name ascending; sorting by `city` orders by city in the chosen direction, then by name ascending. Records that share the selected column value SHALL stay in ascending order of the remaining columns regardless of the chosen direction.

#### Scenario: Sort by city descending

- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners are returned ordered by city in descending order across pages, and owners sharing the same city are ordered by name ascending

#### Scenario: Non-whitelisted sort column rejected

- **WHEN** a client calls `GET /api/owners?sort=pets,asc` or `GET /api/owners?sort=telephone,asc`
- **THEN** the system responds with HTTP `400`

#### Scenario: Invalid sort direction rejected

- **WHEN** a client calls `GET /api/owners?sort=name,sideways`
- **THEN** the system responds with HTTP `400`

### Requirement: Deterministic, stable ordering

The system SHALL guarantee a total order for every returned page so that pages never overlap or drop rows when owners share the same sorted value. When the requested sort columns tie, ordering MUST fall back to a stable tiebreaker so a given owner appears on exactly one page for a fixed query.

#### Scenario: Stable paging under ties

- **WHEN** multiple owners share the same last name (or city) and the client pages through all results
- **THEN** each owner appears on exactly one page and no owner is skipped or duplicated between adjacent pages

### Requirement: Last-name prefix filter preserved

The system SHALL continue to support the existing last-name prefix filter via the `lastName` query parameter, applied together with pagination and sorting. Omitting `lastName` (or passing an empty value) SHALL match all owners.

#### Scenario: Filter combined with paging

- **WHEN** a client calls `GET /api/owners?lastName=Da&page=0&size=5&sort=name,asc`
- **THEN** the response contains only owners whose last name starts with "Da", as a page of at most 5, ordered by name ascending

### Requirement: Invalid pagination parameters rejected

The system SHALL reject a negative `page` value with HTTP `400`.

#### Scenario: Negative page rejected

- **WHEN** a client calls `GET /api/owners?page=-1`
- **THEN** the system responds with HTTP `400`

### Requirement: Name displayed surname-first in the grid

The owners grid SHALL display each owner's name in "Last, First" form (e.g. "Baskerville, Henry") so the visible order matches the sort key. Detail and edit screens are unaffected and may continue to show "First Last".

#### Scenario: Grid row shows surname-first

- **WHEN** the owners grid renders an owner named Henry Baskerville
- **THEN** the name cell shows "Baskerville, Henry"

### Requirement: Grid state is deep-linkable and resilient

The owners grid SHALL keep its filter, page, size, and sort in the URL as the single source of truth, so a grid view can be shared or restored via the URL and the browser back button navigates between states. Changing the sort, size, or search term SHALL reset to the first page. A failed data reload MUST surface as an error indication and MUST NOT be presented as an empty result, and a stale in-flight request MUST NOT overwrite a newer one.

#### Scenario: Sharing a URL restores the grid

- **WHEN** a user copies the grid URL containing `lastName`, `page`, `size`, and `sort` and opens it in a new session
- **THEN** the grid loads showing the same filtered, sorted, paginated view

#### Scenario: Sort change resets to first page

- **WHEN** a user on page 3 changes the sort column or direction
- **THEN** the grid reloads showing page 0 of the newly sorted results

#### Scenario: Reload failure shows an error

- **WHEN** a data reload for the grid fails
- **THEN** the grid shows an error indication rather than an empty owners list
