## Purpose

Defines how clients browse the Owners collection: how a page of owners is requested and
returned, which columns can order it and what that order means, how the last-name filter
combines with paging, and how invalid listing parameters are rejected.

## ADDED Requirements

### Requirement: Owners are returned one page at a time

The owners listing endpoint SHALL return a page envelope containing the requested slice of
owners together with `totalElements`, `totalPages`, the zero-based page number, and the
page size. It SHALL NOT return an unbounded collection of owners under any combination of
parameters.

#### Scenario: Default page when no parameters are supplied

- **WHEN** a client requests the owners listing with no `page` or `size`
- **THEN** the response contains at most 10 owners
- **AND** `number` is 0, `size` is 10, and `totalElements` is the total number of owners matching the filter

#### Scenario: Requesting a later page

- **WHEN** a client requests page 1 with size 5 and at least 8 owners exist
- **THEN** the response contains owners 6 through 10 of the ordered result
- **AND** `number` is 1 and no owner from page 0 appears in the response

#### Scenario: Page beyond the last page

- **WHEN** a client requests a page number greater than `totalPages - 1`
- **THEN** the response status is 200
- **AND** `content` is empty while `totalElements` and `totalPages` still report the true totals

#### Scenario: Totals reflect the filter, not the whole table

- **WHEN** a client requests a page with a `lastName` filter that matches 3 owners
- **THEN** `totalElements` is 3, not the total number of owners in the system

### Requirement: Page size is restricted to an allowlist

The listing SHALL accept a page size of only 5, 10, or 20, defaulting to 10 when the client
supplies none. Any other size SHALL be rejected rather than silently adjusted, so that no
client can request an arbitrarily large slice of the collection.

#### Scenario: An allowed size

- **WHEN** a client requests size 20
- **THEN** the response contains at most 20 owners and reports `size` 20

#### Scenario: A size outside the allowlist

- **WHEN** a client requests size 7
- **THEN** the response status is 400 and no owners are returned

#### Scenario: An oversized request cannot drain the collection

- **WHEN** a client requests size 100000
- **THEN** the response status is 400
- **AND** the system does not load or serialize the full owners table

#### Scenario: A negative page number

- **WHEN** a client requests a negative `page`
- **THEN** the response status is 400

### Requirement: Owners can be ordered by name or by city

The listing SHALL support ordering by exactly two logical columns — Name and City — in
ascending or descending direction, defaulting to Name ascending. Address, Telephone and
the owner's pets SHALL NOT be offered as ordering options, because the stored values admit
no order a user would recognise as correct.

Ordering by Name SHALL order by last name, then first name. Ordering by City SHALL order by
city, then last name.

#### Scenario: Default ordering

- **WHEN** a client requests the listing without specifying an order
- **THEN** owners are ordered ascending by last name, then first name

#### Scenario: Ordering by city descending

- **WHEN** a client requests ordering by City in descending direction
- **THEN** owners are ordered from the alphabetically last city to the first
- **AND** owners sharing a city appear ordered by last name

#### Scenario: An unsupported ordering column is refused

- **WHEN** a client requests ordering by a column outside the supported set, such as telephone
- **THEN** the response status is 400
- **AND** the error names the supported ordering options

#### Scenario: Ordering applies across the whole result, not within a page

- **WHEN** a client requests page 1 ordered by Name ascending
- **THEN** every owner on page 1 sorts at or after the last owner of page 0

### Requirement: Paging is deterministic across requests

For any fixed filter and ordering, the listing SHALL impose a total order on owners, so
that repeatedly paging through the collection returns every matching owner exactly once.
Owners that tie on the requested ordering column SHALL still have a stable relative order
between requests.

#### Scenario: Owners tied on the ordering column

- **GIVEN** seven owners share the city `London` and the page size is 5
- **WHEN** a client requests page 0 and then page 1 ordered by City
- **THEN** no owner appears on both pages
- **AND** the two pages together contain all seven London owners

#### Scenario: Repeating an identical request

- **WHEN** a client issues the same page request twice with unchanged data
- **THEN** both responses contain the same owners in the same order

### Requirement: The last-name filter composes with paging and ordering

The existing last-name prefix filter SHALL restrict which owners are paged, and the
requested ordering SHALL apply to the filtered result. When the filter changes, the client
SHALL be returned to the first page, since the previously viewed page number is meaningless
against a different result set.

#### Scenario: Filter narrows the paged result

- **WHEN** a client requests page 0 with a last-name filter and an ordering
- **THEN** only owners matching the filter are returned, ordered as requested

#### Scenario: Changing the filter resets to the first page

- **GIVEN** a user is viewing page 3 of the owners grid
- **WHEN** the user changes the last-name search term
- **THEN** the grid displays page 0 of the new result
- **AND** the previously chosen ordering is preserved

#### Scenario: A filter that matches nothing

- **WHEN** a client filters by a last name no owner starts with
- **THEN** the response status is 200 with empty `content`, `totalElements` 0 and `totalPages` 0

### Requirement: Invalid listing parameters produce a client error

Malformed values for the listing parameters SHALL be reported as `400` client errors in the
API's standard error format. They SHALL NOT surface as a server error, since the fault lies
with the request.

#### Scenario: An unparseable ordering value

- **WHEN** a client sends an ordering value that is not one of the supported options
- **THEN** the response status is 400 with the standard error body
- **AND** the response status is not 500

#### Scenario: A non-numeric page number

- **WHEN** a client sends a non-numeric `page`
- **THEN** the response status is 400 with the standard error body

### Requirement: The grid exposes its paging and ordering state in the URL

The Owners grid SHALL reflect the current page, page size, ordering column and direction,
and last-name filter in the browser URL, so that the view can be bookmarked, shared, and
restored by reloading or navigating back.

#### Scenario: Restoring a view from its URL

- **WHEN** a user opens a URL carrying page, size, ordering and filter
- **THEN** the grid displays exactly that page, ordered and filtered as encoded

#### Scenario: Navigating back after changing the page

- **GIVEN** a user moved from page 0 to page 1
- **WHEN** the user navigates back
- **THEN** the grid displays page 0 again

#### Scenario: Only the supported columns offer an ordering control

- **WHEN** a user views the Owners grid
- **THEN** the Name and City headers are interactive ordering controls
- **AND** the Address, Telephone and Pets headers are not

#### Scenario: The active ordering is visible

- **WHEN** the grid is ordered by a column
- **THEN** that column's header indicates the ordering and its direction

### Requirement: The Name column is displayed in the order it is sorted by

Because owners are ordered by surname first, the Name column SHALL display the surname
first, so that reading down the column shows a visibly alphabetical sequence. A user MUST
be able to confirm the list is ordered without knowing which underlying field it is ordered
by.

#### Scenario: The displayed name leads with the surname

- **WHEN** an owner named Harry Potter appears in the grid
- **THEN** the Name column shows `Potter, Harry`

#### Scenario: The column reads alphabetically top to bottom

- **WHEN** the grid is ordered by Name ascending
- **THEN** the first visible character of each Name cell is in non-descending alphabetical order

#### Scenario: The name remains a link to the owner

- **WHEN** a user clicks the displayed name
- **THEN** that owner's details are opened, as before this change

### Requirement: Listing a page costs a bounded number of database queries

Serving one page of owners SHALL issue a number of database queries that does not grow with
the total number of owners in the system, and SHALL NOT load owners outside the requested
page into memory in order to produce it.

#### Scenario: Query count is independent of table size

- **WHEN** a page of 10 owners is served from a table of 10,000 owners
- **THEN** the number of queries issued is the same as when serving 10 owners from a table of 30

#### Scenario: Pets are displayed without a per-owner round trip

- **WHEN** a page of owners with their pets is serialized
- **THEN** the pets for the whole page are fetched together rather than one query per owner
