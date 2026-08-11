import {Given, When, Then} from '@cucumber/cucumber';
import {PlaywrightWorld} from '../support/world';
import {
  expectOnlyOwnersWhoseLastNameStartsWithThatPart,
  openOwnersPage,
  pickLastNamePartOfAnExistingOwner,
  searchOwnersByLastNamePart,
} from '../dsl/owner-search.dsl';

// One-line adapters over the glue functions in ../dsl, shared verbatim with
// ../owner-search.spec.ts.

Given('at least one owner exists', async function (this: PlaywrightWorld) {
  this.ownerSearch = await pickLastNamePartOfAnExistingOwner();
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await openOwnersPage(this.page);
});

When('I search for owners by a last name part', async function (this: PlaywrightWorld) {
  await searchOwnersByLastNamePart(this.page, this.requireOwnerSearch());
});

Then('only owners whose last name starts with that part are listed', async function (this: PlaywrightWorld) {
  await expectOnlyOwnersWhoseLastNameStartsWithThatPart(this.page, this.requireOwnerSearch());
});
