# Owners list: pages and sorting

*Written for a functional review. Everything about how it gets built lives in `design.md`.*

## Why

Today the owners screen shows **all** owners on a single, unordered screen. With the handful of
owners in our demo data that is fine. In real use we expect to reach **~10.000 owners**, and at
that size the screen becomes unusable: the receptionist waits for the whole list to load and
then scrolls through thousands of rows to find one person.

Issue [#25](https://github.com/victorrentea/petclinic/issues/25) asks for a list you can sort by
clicking a column heading, shown in pages of 5, 10 or 20 rows.

## What Changes

**How the list is shown**
- The list is split into pages. The user picks **5, 10 or 20** rows per page; the default is
  **10**.
- The default order is **by name, A→Z**.
- Only the page being looked at is fetched, so the screen opens at the same speed whether the
  clinic has 30 owners or 10.000.

**What can be sorted**
- Clicking the **Name** or **City** heading sorts the list by that column, and clicking again
  reverses it.
- **Address, Telephone and Pets cannot be sorted**, and show no sorting arrow.

  This is a deliberate departure from the wording of #25 ("sortable by *any* column"), and the
  main thing worth your attention. The reason is that the data would not sort the way anyone
  expects: our addresses begin with the house number, so sorting them groups "4 Privet Drive"
  with "40 Main Street" and has nothing to do with the street; our telephone numbers begin with
  an international prefix, so sorting them groups people by country rather than by number. For
  "Pets", nobody could tell us what the order should even mean — the number of pets, or the
  first pet's name? We would rather offer two orderings that are right than four of which two
  quietly mislead.

**How names are displayed**
- The Name column changes from "Kevin McCallister" to **"McCallister, Kevin"**, because the list
  is ordered by family name. Showing the first name first while ordering by the family name
  makes a correctly sorted list look scrambled.

**Sorting by City**
- When sorting by city, people within the same city are always listed **by name A→Z**, in both
  city directions. Ascending/descending applies to the city, which is the column the user
  clicked — it does not turn the names upside down as well.

**Searching**
- Searching by last name still works and now combines with paging: the record count shown
  reflects the number of people found, not the total number of owners in the clinic.

**Moving around the list**
- Changing the search term, the sort column, the sort direction or the page size always returns
  the user to the **first page**. Anything else would leave them somewhere in the middle of a
  list they have not seen the beginning of — sometimes on a page that no longer exists.
- The list's position is part of the page address, so a colleague can be sent a link to
  "page 4 of the owners in Madrid" and the browser's Back button behaves as expected.

**Correct alphabetical order**
- Names with accents or lowercase prefixes (`Ångström`, `Émile`, `Öztürk`, `de Vries`,
  `van Gogh`) currently sort *after* `Z`. They will be ordered the way a person would order
  them. Invisible in the demo data, unmissable with 10.000 real names.

**Stable pages**
- Two owners with the same name, or living in the same city, always keep the same relative
  order, so nobody is shown twice or skipped while paging through the list.

## Capabilities

### New Capabilities
- `owner-listing`: what the owners list shows and in what order — paging, the sortable columns,
  page sizes, how search combines with paging, and when the list returns to the first page.

### Modified Capabilities
<!-- None: no previously specified behaviour changes. -->

## Impact

**Who notices**
- Anyone using the owners screen. The screen looks different (a paged, sortable grid instead of
  one long table) and names read "Family name, First name".
- The user manual and its screenshot of the owners screen are updated.

**Anything that reads the owners list from outside the application** has to be adjusted, because
the list now answers with one page at a time instead of everything at once. We checked what this
touches: only our own screens and automated tests. The chat assistant and the appointment
booking integration do not use it and are unaffected.

**No data is changed.** No owner, pet or visit record is added, removed or edited by this
change.

## Not in this change

1. **Sorting by address or telephone.** Possible later, but only if we first record addresses
   and phone numbers in a structured way (street separately from house number, phone numbers in
   a standard international format). It is a data question, not a screen question.
2. **One owner has no telephone number recorded**, while the system elsewhere claims a telephone
   is mandatory. A pre-existing inconsistency; we are not fixing it under the umbrella of this
   change.

## Open Questions for the Product Owner

1. **Two sortable columns instead of five** — do you accept Name and City only, on the grounds
   above? This is the one decision that visibly deviates from the issue as written.
2. **"McCallister, Kevin"** — is the family-name-first display acceptable on this screen? It is
   the honest consequence of sorting by family name, but it is a visible change for every user.
3. **Default page size 10** — right default for the way the front desk works, or would 20 suit
   them better?
4. **If a saved link asks for an ordering we do not support** (say, an old bookmark asking for
   "sorted by telephone"), the list opens in its default order without complaining. The
   alternative is showing the user an error. Silent is friendlier; it also means the user does
   not learn that the requested order was ignored. Which do you prefer?
5. **Sorting by pets** — if there is a real need, tell us what the order should mean (number of
   pets? first pet's name?) and we can plan it separately.
