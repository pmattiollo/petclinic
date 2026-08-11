import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The glue code for the "Search owners by last name" feature, extracted as
// plain functions shared by owner-search.steps.ts (Cucumber) and
// owner-search.spec.ts (plain TypeScript).

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// The grid renders the surname first ("Potter, Harry") so its alphabetical ordering is visible in the column
// being read — so the surname is what precedes the comma, not the last whitespace-separated token.
const fullName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
const lastNameOf = (name: string) => name.split(',')[0].trim();

/** The largest page the server allows — the listing is paged and never returns every owner at once. */
const MAX_PAGE_SIZE = 20;

/** What the grid shows per page when the user has not chosen otherwise. */
const DEFAULT_PAGE_SIZE = 10;

export interface OwnerSearch {
  /** The last-name part typed into the filter. */
  prefix: string;
  /** The owner full names the API returns for that part — the expected result set. */
  expectedFullNames: string[];
}

export async function pickLastNamePartOfAnExistingOwner(): Promise<OwnerSearch> {
  const {data: firstPage} = await axios.get(`${API_BASE}/owners`,
    {params: {size: MAX_PAGE_SIZE}, timeout: 10_000});
  const withLastName = firstPage.content
    .find((o: any) => typeof o.lastName === 'string' && o.lastName.length >= 2);
  if (!withLastName) {
    throw new Error('No owner with a usable last name found; cannot run owner-search scenario');
  }
  // "One name part": the first two letters of a real owner's last name.
  const prefix = withLastName.lastName.slice(0, 2);
  const {data: matches} = await axios.get(`${API_BASE}/owners`,
    {params: {lastName: prefix, size: MAX_PAGE_SIZE}, timeout: 10_000});
  const expectedFullNames: string[] = matches.content.map(fullName).sort();
  if (expectedFullNames.length === 0) {
    throw new Error(`API returned no owners for prefix "${prefix}"; cannot assert data comes back`);
  }
  if (matches.totalElements > MAX_PAGE_SIZE) {
    throw new Error(`Prefix "${prefix}" matches ${matches.totalElements} owners, more than one page holds`);
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
  // The grid shows one page at a time, so a search matching more owners than fit on a page shows only the first
  // page of them — waiting for the full result set would hang until the timeout.
  await expect(page.locator('#ownersTable td.ownerFullName'))
    .toHaveCount(expectedRowsOnFirstPage(search), {timeout: 10_000});
}

function expectedRowsOnFirstPage(search: OwnerSearch): number {
  return Math.min(search.expectedFullNames.length, DEFAULT_PAGE_SIZE);
}

export async function expectOnlyOwnersWhoseLastNameStartsWithThatPart(
  page: Page,
  search: OwnerSearch,
): Promise<void> {
  const prefix = search.prefix.toLowerCase();
  const cells = page.locator('#ownersTable td.ownerFullName');
  const shown = (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);

  expect(shown.length).toBe(expectedRowsOnFirstPage(search));
  for (const name of shown) {
    expect(lastNameOf(name).toLowerCase()).toMatch(new RegExp(`^${prefix}`));
  }
  // Everything on the page must come from the expected result set. It is a page of it, not all of it.
  expect(search.expectedFullNames).toEqual(expect.arrayContaining(shown));
}
