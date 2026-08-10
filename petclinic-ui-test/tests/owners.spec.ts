import { test, expect } from './support/trace-fixture';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';
import * as fs from 'fs';
import * as path from 'path';

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

  test('shows the first page of owners (sorted by name) on initial load', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // The grid defaults to page 0, size 10, sorted by name ascending (D7).
    const expectedFirstPage = await apiClient.fetchOwnersPage({ page: 0, size: 10, sort: 'name,asc' });
    const expectedFullNames = ApiClient.getFullNames(expectedFirstPage.content);

    // Open the owners page
    await ownersPage.open();

    // Wait for the expected number of owners
    await ownersPage.waitForOwnersCount(expectedFullNames.length);

    // Get actual owner names from the page, displayed surname-first (D5)
    const actualFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFullNames).toEqual(expectedFullNames);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    // Fetch the default first page and choose a prefix from it
    const firstPage = await apiClient.fetchOwnersPage({ page: 0, size: 10, sort: 'name,asc' });
    const prefix = ApiClient.choosePrefixFrom(firstPage.content);

    // Fetch filtered owners from API (same defaults the grid itself uses)
    const expectedFilteredPage = await apiClient.fetchOwnersPage({ lastName: prefix, page: 0, size: 10, sort: 'name,asc' });
    const expectedFilteredFullNames = ApiClient.getFullNames(expectedFilteredPage.content);

    // Open the owners page
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    // Perform search
    await ownersPage.searchByLastNamePrefix(prefix);
    await ownersPage.waitForOwnersCount(expectedFilteredFullNames.length);

    // Get filtered results
    const actualFilteredFullNames = await ownersPage.getOwnerFullNames();

    // Assertions
    expect(actualFilteredFullNames.length).toBeGreaterThan(0);

    // Verify all results match the prefix
    for (const fullName of actualFilteredFullNames) {
      const lastName = ApiClient.extractLastName(fullName);
      expect(lastName.toLowerCase()).toMatch(new RegExp(`^${prefix.toLowerCase()}`));
    }

    // Verify exact match with API results
    expect(actualFilteredFullNames).toEqual(expectedFilteredFullNames);
  });

  test('paginates to the next page of owners', async ({ page }) => {
    const firstPage = await apiClient.fetchOwnersPage({ page: 0, size: 5, sort: 'name,asc' });
    const secondPage = await apiClient.fetchOwnersPage({ page: 1, size: 5, sort: 'name,asc' });
    expect(secondPage.content.length).toBeGreaterThan(0);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.waitForOwnersCount(firstPage.content.length);

    await ownersPage.goToNextPage();
    await ownersPage.waitForOwnersCount(secondPage.content.length);

    const actualNames = await ownersPage.getOwnerFullNames();
    expect(actualNames).toEqual(ApiClient.getFullNames(secondPage.content));
  });

  test('sorts owners by city', async ({ page }) => {
    const expectedPage = await apiClient.fetchOwnersPage({ page: 0, size: 10, sort: 'city,asc' });

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.waitForOwnersCount(10);

    await ownersPage.sortBy('city');
    await ownersPage.waitForOwnersCount(expectedPage.content.length);

    const actualNames = await ownersPage.getOwnerFullNames();
    expect(actualNames).toEqual(ApiClient.getFullNames(expectedPage.content));
  });

  test('shows an error banner (not an empty list) when the query is invalid', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    // Sharing/bookmarking a URL is the single source of truth (D12); an invalid sort
    // value here reaches the backend as-is and is rejected with HTTP 400.
    await ownersPage.open('?sort=name,sideways');

    await expect(ownersPage.errorBanner).toBeVisible();
  });
});
