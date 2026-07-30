## Purpose

Defines how the list of pet owners is requested, paginated, sorted, filtered and presented, so
that the clinic can browse ~10.000 owners without transferring or rendering the whole table, and
so that the order shown on screen is an order the underlying data can honestly support.

## ADDED Requirements

### Requirement: Owners are returned one page at a time

The owners list endpoint SHALL return a page envelope containing the requested slice of owners
plus the pagination metadata `totalElements`, `totalPages`, `number` (0-based page index) and
`size`. It SHALL NOT return an unbounded list of owners.

The page index SHALL default to `0` and the page size SHALL default to `10`.

#### Scenario: Default request returns the first page

- **WHEN** a client requests the owners list without pagination parameters
- **THEN** the response contains at most 10 owners in `content`
- **AND** `number` is `0`, `size` is `10`, and `totalElements` is the total number of owners
  matching the filter

#### Scenario: Explicit page is requested

- **WHEN** a client requests page `2` with size `5` and at least 11 owners match
- **THEN** the response contains the 11th to 15th owners in the current sort order
- **AND** `number` is `2` and `size` is `5`

#### Scenario: Page beyond the last one

- **WHEN** a client requests a page index greater than `totalPages - 1`
- **THEN** the response contains an empty `content` array
- **AND** `totalElements` and `totalPages` still describe the full result set

### Requirement: Page size is restricted to the supported options

The endpoint SHALL accept only the page sizes `5`, `10` and `20`. Any other requested size SHALL
be replaced by the default size of `10` rather than rejected, so that a client can never request
an unbounded or arbitrarily large page.

#### Scenario: Supported page size

- **WHEN** a client requests a page size of `20`
- **THEN** the response contains at most 20 owners and `size` is `20`

#### Scenario: Unsupported page size

- **WHEN** a client requests a page size of `1000`
- **THEN** the response contains at most 10 owners and `size` is `10`

### Requirement: Only Name and City are sortable

The endpoint SHALL support sorting by exactly two client-facing sort keys, `name` and `city`,
each in ascending or descending direction. Sorting by `address`, `telephone` or `pets` SHALL NOT
be supported, and the grid SHALL NOT offer sort controls for those columns.

Sorting by `name` SHALL order owners by last name first, then first name. The default sort SHALL
be `name` ascending.

Sorting by `city` SHALL use the name as its secondary criterion, **always ascending**, whichever
direction the city is sorted in. The requested direction applies to the city alone.

#### Scenario: Sort by name ascending is the default

- **WHEN** a client requests the owners list without a sort parameter
- **THEN** the owners are ordered by last name ascending, then first name ascending

#### Scenario: Sort by city ascending

- **WHEN** a client requests sorting by `city` ascending
- **THEN** the owners are ordered by city ascending
- **AND** owners sharing a city are ordered by last name ascending, then first name ascending

#### Scenario: Sort by city descending keeps names ascending

- **WHEN** a client requests sorting by `city` descending
- **THEN** the owners are ordered by city descending
- **AND** owners sharing a city are still ordered by last name ascending, then first name
  ascending — the descending direction never applies to the name

#### Scenario: Non-sortable columns offer no sort control

- **WHEN** a user views the owners grid
- **THEN** the Address, Telephone and Pets columns display no sorting affordance

### Requirement: Unknown sort keys fall back to the default sort

An unrecognised sort key SHALL be ignored and the default sort applied, without returning an
error. Sort keys SHALL NOT be interpreted as paths into the persistence model, so a client cannot
cause additional joins or traversals through the sort parameter.

#### Scenario: Unknown sort key

- **WHEN** a client requests sorting by `telephone`
- **THEN** the response succeeds with owners ordered by the default sort

#### Scenario: Sort key naming a nested path

- **WHEN** a client requests sorting by `pets.visits.description`
- **THEN** the response succeeds with owners ordered by the default sort
- **AND** no additional data is traversed on behalf of that parameter

### Requirement: Pagination is stable across pages

Every ordering SHALL end with a unique tiebreaker so that owners sharing the same sort value have
a deterministic relative order. Reading consecutive pages of an unchanged data set SHALL return
each owner exactly once.

#### Scenario: Owners sharing a city

- **WHEN** several owners live in the same city and the list is sorted by `city`
- **THEN** they are ordered by last name ascending, then first name ascending, then by the
  tiebreaker — deterministic and identical on repeated requests

#### Scenario: Walking all pages

- **WHEN** a client reads every page of an unchanged owner set
- **THEN** each owner appears exactly once across all pages, with none skipped or duplicated

### Requirement: Ordering follows natural-language rules

Ordering by name or city SHALL follow natural-language collation rather than byte order, so that
letter case and diacritics do not push entries after the end of the alphabet.

#### Scenario: Mixed case and diacritics

- **WHEN** owners named `Adams`, `Ångström`, `de Vries`, `Émile`, `Öztürk`, `van Gogh` and
  `Zamfir` are sorted by name ascending
- **THEN** they are ordered as `Adams`, `Ångström`, `de Vries`, `Émile`, `Öztürk`, `van Gogh`,
  `Zamfir`

### Requirement: Name search combines with pagination

The existing last-name search SHALL be applied on the server before pagination, so that
`totalElements` reflects the number of matching owners rather than the total number of owners.

#### Scenario: Search narrows the result set

- **WHEN** a client requests owners whose last name starts with a given prefix
- **THEN** `content` contains only matching owners and `totalElements` counts only matching owners

### Requirement: Changing what the list shows returns to the first page

Any change to the composition or ordering of the result set — the search term, the sort key, the
sort direction, or the page size — SHALL return the grid to the first page. Only paginating
itself SHALL change the current page index.

#### Scenario: Searching while on a later page

- **WHEN** a user is on page 3 and submits a new search
- **THEN** the results are shown starting from page 1

#### Scenario: Changing the sort column while on a later page

- **WHEN** a user is on page 3 and clicks a different sortable column header
- **THEN** the list is re-sorted and shown starting from page 1

#### Scenario: Reversing the sort direction while on a later page

- **WHEN** a user is on page 3 and toggles the direction of the current sort column
- **THEN** the list is re-sorted and shown starting from page 1

#### Scenario: Changing the page size while on a later page

- **WHEN** a user is on page 3 and selects a different page size
- **THEN** the list is shown starting from page 1 with the new page size

#### Scenario: Paginating does not reset

- **WHEN** a user moves to the next or previous page without changing search, sorting or page
  size
- **THEN** only the page index changes and the search term, sort and page size are preserved

### Requirement: The owners grid renders the sorted name

The owners grid SHALL display an owner's name in an order consistent with the order it is sorted
by, showing the last name before the first name.

#### Scenario: Name column rendering

- **WHEN** the grid displays an owner with first name `Kevin` and last name `McCallister`
- **THEN** the Name column reads `McCallister, Kevin`

### Requirement: List state is shareable and navigable

The current page, page size, sort key, sort direction and search term SHALL be reflected in the
application URL, so that the list state can be shared as a link and restored by browser
navigation.

#### Scenario: Deep link restores the list state

- **WHEN** a user opens a URL that carries page, size, sort and search term
- **THEN** the grid loads with exactly that page, page size, sorting and search term applied

#### Scenario: Back button returns to the previous list state

- **WHEN** a user changes page or sorting and then presses the browser Back button
- **THEN** the grid returns to the previous page and sorting

### Requirement: A page of owners costs a bounded number of queries

Retrieving one page of owners SHALL NOT issue a number of database queries proportional to the
number of owners, pets or visits on that page.

#### Scenario: Page of owners with pets and visits

- **WHEN** a page of 20 owners that own pets with visits is retrieved
- **THEN** the number of database queries issued stays a small constant, independent of how many
  pets and visits those owners have
