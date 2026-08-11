## Why

The Owners screen shows every owner in the clinic on a single page, all at once. With the
28 owners we have today that is fine. The business expects around **10,000 owners** within
a couple of months of going live. At that size the screen would try to display ten thousand
rows at once: slow to appear, and unusable for the one thing receptionists do with it —
finding a person.

There is also no way to order the list. Owners come back in no particular order, so the
same search can present them differently from one day to the next.

This addresses GitHub issue #25.

## What Changes

- **The Owners list is shown one page at a time**, with a pager to move between pages. The
  user chooses 5, 10 or 20 owners per page; 10 to start with.
- **The list is always in a predictable order.** By default owners are listed
  alphabetically by surname, then first name — like a phone book.
- **Names are shown surname first: "Potter, Harry" instead of "Harry Potter."** Without
  this the alphabetical order would be invisible: the screen would show *Henry
  Baskerville, James Bond, Sam Carraclough, George Darling* — correctly ordered by
  surname, but reading down the column a user sees H, J, S, G and concludes the list is
  unsorted. Surname-first also matches the search box on this screen, which already
  searches by surname only.
- **Two columns can be reordered by clicking their heading: Name and City.** Clicking again
  reverses the order.
- **The remaining three columns keep plain headings.** We looked at the real owner records
  before deciding, and ordering by them would produce results a user would read as broken:
  - *Address* would be ordered as text, so "4 Privet Drive" lands after "671 Lincoln
    Boulevard" — house numbers in the wrong order.
  - *Telephone* numbers are stored in mixed formats with different country prefixes, and
    one owner has none at all, so the ordering would group by country rather than anything
    a receptionist recognises.
  - *Pets* has only three possible values (0, 1 or 2 pets), and 24 of the 28 owners have
    exactly one — so ordering by it barely changes the list.

  This is a deliberate narrowing of the request in issue #25, which asked for every column
  to be orderable. We would rather offer two orderings that are genuinely useful than five
  where three mislead. **This point is worth confirming with the reporter.**
- **Searching by surname continues to work** and now combines with the ordering. Starting a
  new search returns the user to the first page, since the page they were on no longer
  refers to the same set of people.
- **A view of the list can be shared or bookmarked.** Sending someone the link reopens the
  same page, in the same order, with the same search applied — and the browser's Back
  button behaves as expected.
- **Nobody sees the same owner twice.** Because there is a guaranteed order, paging through
  the list shows every owner exactly once. Without it, an owner could appear on two
  consecutive pages while another is never shown at all — seven of our owners live in
  London, so this is a real effect, not a theoretical one.
- **The screen stays equally fast as the clinic grows.** Displaying a page of owners costs
  the same whether there are 30 owners or 10,000.
- **A fault found along the way is fixed.** Certain malformed links to the Owners screen are
  currently reported as a failure of our system rather than as a bad link. This becomes
  reachable through the new pager options, so it is corrected as part of this work.

## Capabilities

### New Capabilities
- `owner-listing`: browsing the Owners collection — how a page of owners is requested and
  returned, which columns can order it and what that order means, how the surname search
  combines with paging, and how invalid requests are rejected.

### Modified Capabilities
<!-- None: openspec/specs/ is currently empty, so there is no existing capability to amend. -->

## Impact

**What users see**
- The Owners screen: a pager, a rows-per-page choice, and two clickable column headings.
  Everything else on the screen is unchanged.

**Release risk**
- The Owners screen and the service behind it must be **released together**. The way the
  two exchange the list of owners changes, and an older screen will not understand a newer
  service. Nothing outside our own application depends on it, so no other team is affected.
- The change is reversible: going back to the previous version restores today's behaviour.

**Not included in this change** — each is a genuine issue, none is caused by this work, and
each deserves its own decision:
- Searching by surname is case-sensitive: searching "potter" does not find "Potter".
- The list still carries each owner's pets and their visit history, even though the screen
  only shows pet names.
- A separate, now-redundant way of asking how many owners exist is left in place.
