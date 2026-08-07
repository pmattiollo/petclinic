## Why

The Owners screen shows the whole list of owners at once and gives no way to order it. The business expects around 10,000 owners. At that size a single "show everything" list becomes slow to open and impractical to scan. Issue #25 asks for a list you can order by column and move through a page at a time.

## What Changes

- The Owners list shows a handful of rows at a time — 5, 10, or 20, starting at 10 — with controls to move between pages, instead of loading everyone at once.
- You can order the list by owner name or by city, either direction (A→Z or Z→A).
- The existing "find owner by last name" search keeps working, together with ordering and paging.
- Names in the list are shown surname-first, e.g. "Baskerville, Henry", so what you read matches the order the list is sorted in. The owner detail and edit screens are unchanged.
- The list stays quick to open even as the number of owners grows, and it orders Romanian names correctly (including ă, â, î, ș, ț).
- The current view (search, order, page) can be shared or bookmarked and comes back exactly as you left it; the browser Back button behaves as expected; and if the list ever fails to load you get a clear message instead of a blank screen.

## Capabilities

### New Capabilities
- `owners-listing`: Browsing the owners directory — searchable by last name, orderable by column, and shown a page at a time.

### Modified Capabilities
<!-- None: no existing capability describes browsing the owners list yet. -->

## Impact

- **What owners see**: the Owners list screen gains ordering and paging; every other screen stays the same.
- **Data quality**: a one-time database update makes ordering correct for Romanian names and keeps the list fast at scale.
- **Confidence**: automated tests are added for paging, ordering, search, and the "failed to load" message.
- **For the development team**: this touches how the app requests and displays the owners list.
