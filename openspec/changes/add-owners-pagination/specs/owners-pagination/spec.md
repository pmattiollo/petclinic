## Purpose

Provides server-side pagination, whitelisted sorting, and stable ordering for listing
Owners through the Owners screen (and the underlying API), so the list stays usable
and predictable as the owner count grows and as future consumers rely on it.

## ADDED Requirements

### Requirement: Owners are shown a page at a time
The Owners screen SHALL display only a limited number of owners at once (10 by
default), with a way to move to other pages, instead of listing every owner at once.

#### Scenario: Owners screen shows a default page of results
- **WHEN** a user opens the Owners screen with more than 10 owners in the system
- **THEN** the grid shows at most 10 owners, and a pager control lets the user move to
  the next page

#### Scenario: Moving to another page
- **WHEN** a user clicks to go to page 2 of the Owners grid
- **THEN** the grid shows the next set of owners, and the page indicator reflects
  page 2

### Requirement: Owners can be sorted by Name or City
The Owners screen SHALL let users sort the grid by clicking the **Name** or **City**
column header, toggling between ascending and descending order. The **Name** column
SHALL display each owner as "Last name, First name".

#### Scenario: Sorting by Name ascending
- **WHEN** a user clicks the **Name** column header
- **THEN** the grid re-sorts alphabetically by last name (showing "Last, First" in
  each row), and the header shows an ascending sort indicator

#### Scenario: Toggling sort direction
- **WHEN** a user clicks the **Name** column header a second time
- **THEN** the grid re-sorts in descending order by last name, and the header shows a
  descending sort indicator

#### Scenario: Sorting by City
- **WHEN** a user clicks the **City** column header
- **THEN** the grid re-sorts by city, and the previously active **Name** sort
  indicator is cleared

### Requirement: Owner order stays stable across pages
Owners SHALL never appear twice or go missing when a user pages through the full
Owners list in a given sort order, even when multiple owners share the same first and
last name.

#### Scenario: Paging through owners with duplicate names does not lose or repeat rows
- **WHEN** the Owners list contains two owners with an identical first and last name,
  and a user pages through the entire list sorted by Name
- **THEN** both owners appear, each exactly once, across the full set of pages

### Requirement: Searching resets to the first page
Starting a new last-name search on the Owners screen SHALL take the user back to page 1
of the results.

#### Scenario: New search returns to page 1
- **WHEN** a user is viewing page 2 of the Owners grid and submits a new last-name
  search
- **THEN** the results are shown starting at page 1

### Requirement: Changing the sort order resets to the first page
Changing the sort column or sort direction on the Owners screen SHALL take the user
back to page 1 of the results, since the rows on any given page number change once the
order changes.

#### Scenario: Changing sort column returns to page 1
- **WHEN** a user is viewing page 3 of the Owners grid sorted by Name and clicks the
  **City** column header
- **THEN** the results are shown starting at page 1, now sorted by City

#### Scenario: Toggling sort direction returns to page 1
- **WHEN** a user is viewing page 3 of the Owners grid and clicks the currently active
  sort column header to reverse its direction
- **THEN** the results are shown starting at page 1, in the reversed order

### Requirement: Users are never left on an empty page
If changing the page size or narrowing a search would leave the current page with no
rows, the Owners screen SHALL automatically show the last page that has results
instead of an empty grid.

#### Scenario: Narrowing a search away from the current page
- **WHEN** a user is viewing page 3 of results and submits a search that reduces the
  result set to 1 page
- **THEN** the screen shows page 1 with the narrowed results, not an empty grid

### Requirement: Owners grid state is shareable via the page URL
The current search, page, page size, and sort order of the Owners screen SHALL be
reflected in the browser's URL, so reloading or sharing the link restores the same
view.

#### Scenario: Reloading the page keeps the same view
- **WHEN** a user has sorted by City descending and moved to page 2, then reloads the
  browser page
- **THEN** the Owners screen still shows page 2 sorted by City descending

### Requirement: Invalid listing input is rejected, not silently ignored
Requests to list owners with an out-of-range sort choice, an invalid page size, or a
negative page number SHALL be rejected with a `400 Bad Request` response that states
the allowed values, rather than silently falling back to defaults.

#### Scenario: Invalid sort value is rejected
- **WHEN** the owners listing endpoint is called with a sort choice outside of
  Name/City ascending/descending
- **THEN** the response is `400 Bad Request` and lists the allowed sort choices

#### Scenario: Invalid page size is rejected
- **WHEN** the owners listing endpoint is called with a page size of zero or a
  negative number
- **THEN** the response is `400 Bad Request` and states that the page size must be a
  positive number

#### Scenario: Negative page number is rejected
- **WHEN** the owners listing endpoint is called with a negative page number
- **THEN** the response is `400 Bad Request`

### Requirement: A page number beyond the last page is not an error
Requesting a page number past the end of the results SHALL return an empty result set
with correct totals, not an error, since result sets can legitimately shrink between
requests.

#### Scenario: Requesting a page far beyond the available results
- **WHEN** the owners listing endpoint is called for a page number well beyond the
  total number of pages
- **THEN** the response succeeds with no owners in it, alongside the correct total
  count and total page count
