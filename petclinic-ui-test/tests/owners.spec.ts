import { test, expect } from './support/trace-fixture';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';
import * as fs from 'fs';
import * as path from 'path';

/** What the grid shows per page when the user has not chosen otherwise. */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Plain string comparison, which orders by code unit — the same order the database uses, since it runs under the
 * C collation. Using localeCompare here would disagree with the server on exactly the interesting cases.
 */
function isOrdered(values: string[], direction: 'ascending' | 'descending'): boolean {
  for (let i = 1; i < values.length; i++) {
    const inOrder = direction === 'ascending'
      ? values[i - 1] <= values[i]
      : values[i - 1] >= values[i];
    if (!inOrder) {
      return false;
    }
  }
  return values.length > 0;
}

test.describe('Owners Page', () => {
  let apiClient: ApiClient;
  let screenshotDir: string;

  test.beforeAll(() => {
    apiClient = new ApiClient();
    screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Capture screenshot after each test
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('shows the first page of owners on initial load', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // The listing is paged: the first screen holds one page, not every owner.
    const expectedOwners = await apiClient.fetchOwners();
    const expectedFullNames = ApiClient.getFullNames(expectedOwners);

    await ownersPage.open();
    await ownersPage.waitForOwnersCount(DEFAULT_PAGE_SIZE);

    const actualFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFullNames).toHaveLength(DEFAULT_PAGE_SIZE);
    // Every owner shown is a real owner, and they are the alphabetically first ones.
    expect(expectedFullNames).toEqual(expect.arrayContaining(actualFullNames));
    expect(actualFullNames).toEqual(ApiClient.sorted(expectedFullNames).slice(0, DEFAULT_PAGE_SIZE));
  });

  test('orders the Name column alphabetically as it is displayed', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.waitForOwnersCount(DEFAULT_PAGE_SIZE);

    const shown = await ownersPage.getOwnerFullNames();

    // The point of rendering "Lastname, Firstname": reading down the column must look sorted. Were the grid to
    // show "Harry Potter" while ordering by surname, this would read H, J, S, G... and look broken to a user.
    expect(shown).toEqual(ApiClient.sorted(shown));
  });

  test('sorting by City reorders the grid and can be reversed', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.waitForOwnersCount(DEFAULT_PAGE_SIZE);

    // Poll the ordering of a single snapshot rather than reading once: the rows are replaced asynchronously, and
    // one read can catch the grid mid-render, holding some rows of the old ordering and some of the new.
    await ownersPage.sortByCity();
    await expect
      .poll(async () => isOrdered(await ownersPage.getCities(), 'ascending'))
      .toBe(true);

    await ownersPage.sortByCity();
    await expect
      .poll(async () => isOrdered(await ownersPage.getCities(), 'descending'))
      .toBe(true);
  });

  test('pages forward and back without repeating or losing an owner', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await ownersPage.setPageSize(5);
    await ownersPage.waitForOwnersCount(5);
    const firstPage = await ownersPage.getOwnerFullNames();

    await ownersPage.goToNextPage();
    await ownersPage.waitForOwnersCount(5);
    const secondPage = await ownersPage.getOwnerFullNames();

    // The reason every ordering carries an id tiebreaker: without it, owners tied on the sort column can appear
    // on both pages while others are never shown at all.
    expect(secondPage.filter((name) => firstPage.includes(name))).toEqual([]);

    await ownersPage.goToPreviousPage();
    await ownersPage.waitForOwnersCount(5);
    expect(await ownersPage.getOwnerFullNames()).toEqual(firstPage);
  });

  test('a shared link reopens the same page, ordering and filter', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    await page.goto('/owners?page=1&size=5&sort=CITY&direction=DESC');
    await ownersPage.waitForOwnersCount(5);
    const fromTheLink = await ownersPage.getOwnerFullNames();

    await page.reload();
    await ownersPage.waitForOwnersCount(5);

    expect(await ownersPage.getOwnerFullNames()).toEqual(fromTheLink);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    // Fetch all owners and choose a prefix
    const allOwners = await apiClient.fetchOwners();
    const prefix = ApiClient.choosePrefixFrom(allOwners);

    // Fetch filtered owners from API
    const expectedFilteredOwners = await apiClient.fetchOwnersByPrefix(prefix);
    const expectedFilteredFullNames = ApiClient.getFullNames(expectedFilteredOwners);

    // Open the owners page
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    // Perform search — capped at a page, since the grid shows one page of the matches
    await ownersPage.searchByLastNamePrefix(prefix);
    await ownersPage.waitForOwnersCount(Math.min(expectedFilteredFullNames.length, DEFAULT_PAGE_SIZE));

    // Get filtered results
    const actualFilteredFullNames = await ownersPage.getOwnerFullNames();

    // Assertions
    expect(actualFilteredFullNames.length).toBeGreaterThan(0);

    // Verify all results match the prefix
    for (const fullName of actualFilteredFullNames) {
      const lastName = ApiClient.extractLastName(fullName);
      expect(lastName.toLowerCase()).toMatch(new RegExp(`^${prefix.toLowerCase()}`));
    }

    // Verify the shown owners all come from the API's result set (a page of it, not necessarily all of it)
    expect(ApiClient.sorted(expectedFilteredFullNames)).toEqual(
      expect.arrayContaining(actualFilteredFullNames)
    );
  });
});
