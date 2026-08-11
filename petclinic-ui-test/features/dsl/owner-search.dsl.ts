import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The glue code for the "Search owners by last name" feature, extracted as
// plain functions shared by owner-search.steps.ts (Cucumber) and
// owner-search.spec.ts (plain TypeScript).

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const lastNameOf = (name: string) => name.trim().split(/\s+/).pop() ?? '';

export interface OwnerSearch {
  /** The last-name part typed into the filter. */
  prefix: string;
  /** The owner full names the API returns for that part — the expected result set. */
  expectedFullNames: string[];
}

export async function pickLastNamePartOfAnExistingOwner(): Promise<OwnerSearch> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const withLastName = owners.find((o: any) => typeof o.lastName === 'string' && o.lastName.length >= 2);
  if (!withLastName) {
    throw new Error('No owner with a usable last name found; cannot run owner-search scenario');
  }
  // "One name part": the first two letters of a real owner's last name.
  const prefix = withLastName.lastName.slice(0, 2);
  const {data: matches} = await axios.get(`${API_BASE}/owners`, {params: {lastName: prefix}, timeout: 10_000});
  const expectedFullNames: string[] = matches.map(fullName).sort();
  if (expectedFullNames.length === 0) {
    throw new Error(`API returned no owners for prefix "${prefix}"; cannot assert data comes back`);
  }
  return {prefix, expectedFullNames};
}

export async function openOwnersPage(page: Page): Promise<void> {
  await page.goto('/owners');
  await page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
}

export async function searchOwnersByLastNamePart(page: Page, search: OwnerSearch): Promise<void> {
  await page.locator('#lastName').fill(search.prefix);
  await page.locator('#search-owner-form button[type="submit"]').click();
  // Wait until the filtered result set has settled to the expected size.
  await expect(page.locator('#ownersTable td.ownerFullName'))
    .toHaveCount(search.expectedFullNames.length, {timeout: 10_000});
}

export async function expectOnlyOwnersWhoseLastNameStartsWithThatPart(
  page: Page,
  search: OwnerSearch,
): Promise<void> {
  const prefix = search.prefix.toLowerCase();
  const cells = page.locator('#ownersTable td.ownerFullName');
  const shown = (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);

  expect(shown.length).toBeGreaterThan(0);
  for (const name of shown) {
    expect(lastNameOf(name).toLowerCase()).toMatch(new RegExp(`^${prefix}`));
  }
  expect(shown.sort()).toEqual(search.expectedFullNames);
}
