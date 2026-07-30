import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from '../support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// The grid renders the Name column as "Last, First" (see owner-list.component.html).
const displayName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
const lastNameOf = (displayNameText: string) => displayNameText.split(',')[0]?.trim() ?? '';

Given('at least one owner exists', async function (this: PlaywrightWorld) {
  const {data: page} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const owners = page.content;
  const withLastName = owners.find((o: any) => typeof o.lastName === 'string' && o.lastName.length >= 2);
  if (!withLastName) {
    throw new Error('No owner with a usable last name found; cannot run owner-search scenario');
  }
  // Use the whole last name (not just a couple of letters) so the match stays within the
  // default page size even against seed data with several similarly-named owners.
  this.searchPrefix = withLastName.lastName;
  const {data: matchesPage} = await axios.get(`${API_BASE}/owners`, {
    params: {lastName: this.searchPrefix},
    timeout: 10_000,
  });
  const expected: string[] = matchesPage.content.map(displayName).sort();
  if (expected.length === 0) {
    throw new Error(`API returned no owners for prefix "${this.searchPrefix}"; cannot assert data comes back`);
  }
  this.expectedFullNames = expected;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search for owners by a last name part', async function (this: PlaywrightWorld) {
  const prefix = this.searchPrefix;
  const expected = this.expectedFullNames;
  if (!prefix || !expected) {
    throw new Error('Expected a search prefix to have been chosen earlier in the scenario');
  }
  await this.page.locator('#lastName').fill(prefix);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
  // Wait until the filtered result set has settled to the expected size.
  await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(expected.length, {timeout: 10_000});
});

Then('only owners whose last name starts with that part are listed', async function (this: PlaywrightWorld) {
  const prefix = this.searchPrefix!.toLowerCase();
  const cells = this.page.locator('#ownersTable td.ownerFullName');
  const shown = (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);

  expect(shown.length).toBeGreaterThan(0);
  for (const name of shown) {
    expect(lastNameOf(name).toLowerCase()).toMatch(new RegExp(`^${prefix}`));
  }
  expect(shown.sort()).toEqual(this.expectedFullNames);
});
