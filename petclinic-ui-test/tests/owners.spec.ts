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

  test('shows the first page of owners, sorted by name, on initial load', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // The default page size is 10 and the default sort is name ascending - the same order
    // and page size the API uses when called with no query params.
    const allOwnersByName = await apiClient.fetchAllOwners();
    const expectedFirstPage = ApiClient.getDisplayNames(allOwnersByName.slice(0, 10));

    // Open the owners page
    await ownersPage.open();

    // Wait for the expected number of owners
    await ownersPage.waitForOwnersCount(expectedFirstPage.length);

    // Get actual owner names from the page
    const actualFullNames = await ownersPage.getOwnerFullNames();

    // The grid must render exactly the first page, in the API's name-ascending order -
    // NOT just the same set in any order, since the whole point of sorting is the order.
    expect(actualFullNames).toEqual(expectedFirstPage);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    // Fetch a page of owners and choose a last name to search for
    const someOwners = await apiClient.fetchOwners();
    const prefix = ApiClient.choosePrefixFrom(someOwners);

    // Fetch filtered owners from API (walking every page, so the expected set is complete)
    const expectedFilteredOwners = await apiClient.fetchOwnersByPrefix(prefix);
    const expectedFilteredFullNames = ApiClient.getDisplayNames(expectedFilteredOwners);

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
    expect(ApiClient.sorted(actualFilteredFullNames)).toEqual(
      ApiClient.sorted(expectedFilteredFullNames)
    );
  });
});
