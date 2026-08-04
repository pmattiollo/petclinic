## Why

Today the Owners list shows every single owner on one page, with no way to sort it or
control how many rows appear at once. This won't hold up as the clinic gets more
owners, and it also means two different owners can accidentally look like duplicates
or get lost between pages since there's no reliable order. Issue #25 asks us to add
paging (like "page 1 of 3") so the list stays fast and usable as it grows, and stays
solid for anyone building on our API in the future, not just our own screen.

## What Changes

- The Owners screen will show a limited number of rows per page (10 by default), with
  a way to move between pages instead of one long list.
- Users can click the **Name** or **City** column headers to sort the list, in either
  direction. The **Name** column will also display as "Last name, First name" going
  forward, to match how it's sorted.
- The list order is now guaranteed to stay stable — the same owner won't ever appear
  twice or vanish when moving between pages, even when two owners share the same name.
- Searching by last name still works as before. Starting a new search, or changing
  the sort order (Name/City, or direction), takes you back to page 1 — staying on the
  same page number after either of these would show unrelated rows.
- If a search or page selection would leave you looking at an empty page, the screen
  automatically shows you the last page that actually has results, instead of a blank
  grid.
- Invalid input (e.g. an out-of-range sort choice) is now rejected clearly instead of
  silently ignored.
- This is a breaking change to how the owners list is fetched behind the scenes. Since
  we don't have outside users of our API yet, there's no impact to any real customer —
  but it's called out here because from this point on, changes like this do matter once
  the API has outside consumers.
- Along the way we're also fixing a currently-broken automated test, cleaning up some
  leftover unused code from an earlier attempt at this feature, and making sure large
  owner searches stay fast at the database level.
- Not included in this piece of work: a broader "search everything" box (tracked
  separately as issue #24), and paging for the Visits screen (issue #23).

## Capabilities

### New Capabilities
- `owners-pagination`: paged, sortable, and reliably ordered owners listing, with
  clear rejection of invalid input.

### Modified Capabilities
- (none — this is a new capability; no existing spec covers owner listing today)

## Impact

- **Users**: the Owners screen behaves differently — paged instead of one long list,
  sortable by Name/City, and the Name column reads "Last, First".
- **API consumers**: the shape of the data returned when listing owners is changing
  (see design.md for the technical details). No current outside consumers are
  affected.
- **Documentation**: the user manual's Owners screenshot and description will be
  updated to match the new look.
